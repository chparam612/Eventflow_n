import { randomUUID } from 'node:crypto';
import { BigQuery } from '@google-cloud/bigquery';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import {
  sanitizeTelemetryRecord,
  validateTelemetryRecord,
  buildBigQueryRow,
  resolveTelemetryExportPlan
} from './telemetry.js';

initializeApp();
const db = getDatabase();
const bigQueryProjectId =
  process.env.BIGQUERY_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
const bq = bigQueryProjectId
  ? new BigQuery({ projectId: bigQueryProjectId })
  : new BigQuery();

function resolveAuthRole(auth = {}) {
  const email = String(auth.token?.email || '').toLowerCase();
  if (email.includes('control')) return 'control';
  if (email.includes('staff')) return 'staff';
  if (auth.token?.firebase?.sign_in_provider === 'anonymous') return 'attendee';
  return 'unknown';
}

function getExportMode() {
  const mode = String(process.env.TELEMETRY_EXPORT_MODE || 'queue').toLowerCase();
  if (['queue', 'bigquery', 'hybrid'].includes(mode)) return mode;
  return 'queue';
}

function getBigQueryTable() {
  const dataset = String(process.env.BIGQUERY_DATASET || process.env.TELEMETRY_BQ_DATASET || '').trim();
  const table = String(process.env.BIGQUERY_TABLE || process.env.TELEMETRY_BQ_TABLE || '').trim();
  if (!dataset || !table) return null;
  return bq.dataset(dataset).table(table);
}

function hasBigQueryConfig() {
  const dataset = String(process.env.BIGQUERY_DATASET || process.env.TELEMETRY_BQ_DATASET || '').trim();
  const table = String(process.env.BIGQUERY_TABLE || process.env.TELEMETRY_BQ_TABLE || '').trim();
  return Boolean(dataset && table);
}

async function insertBigQueryRow(row, eventId) {
  const table = getBigQueryTable();
  if (!table) {
    throw new HttpsError(
      'failed-precondition',
      'BigQuery export mode requires BIGQUERY_DATASET and BIGQUERY_TABLE configuration.'
    );
  }
  try {
    await table.insert([row]);
  } catch (error) {
    logger.error('telemetry_bigquery_insert_failed', {
      eventId,
      code: error?.code || 'unknown',
      message: error?.message || String(error)
    });
    throw new HttpsError('internal', 'Failed to insert telemetry event to BigQuery. Check telemetry_bigquery_insert_failed logs.');
  }
}

export const ingestTelemetry = onCall(
  {
    region: 'asia-south1',
    timeoutSeconds: 30,
    memory: '256MiB',
    cors: true
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required for telemetry ingestion.');
    }

    const rawRecord = request.data;
    const verdict = validateTelemetryRecord(rawRecord);
    if (!verdict.valid) {
      throw new HttpsError('invalid-argument', verdict.reason);
    }

    const cleanRecord = sanitizeTelemetryRecord(rawRecord);
    const authUid = request.auth.uid;
    const authRole = resolveAuthRole(request.auth);
    const isAnonymous = request.auth.token?.firebase?.sign_in_provider === 'anonymous';

    if (cleanRecord.uid && cleanRecord.uid !== 'anon' && cleanRecord.uid !== authUid && !isAnonymous) {
      throw new HttpsError('permission-denied', 'Telemetry uid does not match authenticated user.');
    }

    const eventId = randomUUID();
    const receivedAt = Date.now();
    const exportMode = getExportMode();
    const exportPlan = resolveTelemetryExportPlan(exportMode, hasBigQueryConfig());
    const diagnostics = [...exportPlan.warnings];

    const envelope = {
      schemaVersion: 'eventflow.telemetry.v1',
      eventId,
      receivedAt,
      authUid,
      authRole,
      isAnonymous,
      record: cleanRecord
    };

    const writes = [
      db.ref('ingestedTelemetry').child(eventId).set(envelope)
    ];

    const bqRow = buildBigQueryRow(cleanRecord, envelope);
    const queueEnabled = exportPlan.queueEnabled;
    const bigQueryEnabled = exportPlan.bigQueryEnabled;

    if (diagnostics.includes('bigquery_config_missing')) {
      logger.warn('telemetry_bigquery_config_missing', {
        eventId,
        requestedMode: exportPlan.requestedMode,
        effectiveMode: exportPlan.effectiveMode
      });
    }

    if (queueEnabled) {
      writes.push(
        db.ref('telemetryExportQueue').child(eventId).set({
          status: 'pending',
          createdAt: receivedAt,
          mode: exportPlan.effectiveMode,
          requestedMode: exportPlan.requestedMode,
          row: bqRow
        })
      );
    }

    try {
      await Promise.all(writes);
      let bigQueryInserted = false;
      if (bigQueryEnabled) {
        await insertBigQueryRow(bqRow, eventId);
        bigQueryInserted = true;
      }
        logger.info('telemetry_ingested', {
          eventId,
          eventName: cleanRecord.eventName,
          route: cleanRecord.route,
          authRole,
          requestedMode: exportPlan.requestedMode,
          effectiveMode: exportPlan.effectiveMode,
          bigQueryInserted
        });
      return {
        ok: true,
        eventId,
        requestedMode: exportPlan.requestedMode,
        effectiveMode: exportPlan.effectiveMode,
        queuedForExport: queueEnabled,
        bigQueryInserted,
        diagnostics,
        schemaVersion: envelope.schemaVersion
      };
    } catch (error) {
      logger.error('telemetry_ingest_failed', {
        eventId,
        code: error?.code || 'unknown',
        message: error?.message || String(error)
      });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Telemetry ingestion failed');
    }
  }
);

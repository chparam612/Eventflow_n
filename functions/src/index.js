import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import {
  sanitizeTelemetryRecord,
  validateTelemetryRecord,
  buildBigQueryRow
} from './telemetry.js';

initializeApp();
const db = getDatabase();

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
    if (exportMode === 'queue' || exportMode === 'hybrid') {
      writes.push(
        db.ref('telemetryExportQueue').child(eventId).set({
          status: 'pending',
          createdAt: receivedAt,
          mode: exportMode,
          row: bqRow
        })
      );
    }

    if (exportMode === 'bigquery' || exportMode === 'hybrid') {
      logger.info('telemetry_bigquery_candidate', {
        eventId,
        schemaVersion: bqRow.schemaVersion,
        eventName: bqRow.eventName,
        route: bqRow.route,
        authRole
      });
    }

    try {
      await Promise.all(writes);
      logger.info('telemetry_ingested', {
        eventId,
        eventName: cleanRecord.eventName,
        route: cleanRecord.route,
        authRole,
        exportMode
      });
      return {
        ok: true,
        eventId,
        exportMode,
        queuedForExport: exportMode === 'queue' || exportMode === 'hybrid',
        schemaVersion: envelope.schemaVersion
      };
    } catch (error) {
      logger.error('telemetry_ingest_failed', {
        eventId,
        code: error?.code || 'unknown',
        message: error?.message || String(error)
      });
      throw new HttpsError('internal', 'Telemetry ingestion failed');
    }
  }
);

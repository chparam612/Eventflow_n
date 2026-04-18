const MAX_EVENT_NAME = 60;
const MAX_SOURCE = 40;
const MAX_ROUTE = 120;
const MAX_ROLE = 40;
const MAX_UID = 80;
const MAX_PARAM_KEYS = 24;
const MAX_PARAM_KEY_LEN = 40;
const MAX_PARAM_VALUE_LEN = 200;

function clip(value, len) {
  return String(value ?? '').slice(0, len);
}

function normalizeParamValue(value) {
  if (typeof value === 'string') return value.slice(0, MAX_PARAM_VALUE_LEN);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return '';
  return clip(JSON.stringify(value), MAX_PARAM_VALUE_LEN);
}

export function sanitizeParams(input = {}) {
  if (!input || typeof input !== 'object') return {};
  const safe = {};
  for (const [rawKey, rawValue] of Object.entries(input).slice(0, MAX_PARAM_KEYS)) {
    const key = clip(rawKey, MAX_PARAM_KEY_LEN).trim();
    if (!key) continue;
    safe[key] = normalizeParamValue(rawValue);
  }
  return safe;
}

export function sanitizeTelemetryRecord(input = {}) {
  if (!input || typeof input !== 'object') {
    return {
      eventName: 'unknown',
      params: {},
      source: 'web',
      route: '/',
      role: 'unknown',
      uid: 'anon',
      ts: Date.now()
    };
  }

  const ts = Number(input.ts);
  const normalizedTs = Number.isFinite(ts) ? ts : Date.now();

  return {
    eventName: clip(input.eventName || 'unknown', MAX_EVENT_NAME),
    params: sanitizeParams(input.params),
    source: clip(input.source || 'web', MAX_SOURCE),
    route: clip(input.route || '/', MAX_ROUTE),
    role: clip(input.role || 'unknown', MAX_ROLE),
    uid: clip(input.uid || 'anon', MAX_UID),
    ts: normalizedTs
  };
}

export function validateTelemetryRecord(record = {}) {
  const eventName = String(record.eventName || '').trim();
  if (!eventName) return { valid: false, reason: 'eventName is required' };
  if (eventName.length > MAX_EVENT_NAME) return { valid: false, reason: 'eventName too long' };
  if (record.params !== undefined && (record.params === null || typeof record.params !== 'object')) {
    return { valid: false, reason: 'params must be an object when provided' };
  }
  const ts = Number(record.ts);
  if (!Number.isFinite(ts)) return { valid: false, reason: 'ts must be a number' };
  return { valid: true };
}

export function buildBigQueryRow(record = {}, envelope = {}) {
  const params = sanitizeParams(record.params);
  const densityPct = Number(params.densityPct || params.avgDensityPct || 0);
  const chars = Number(params.chars || 0);

  return {
    schemaVersion: 'eventflow.telemetry.v1',
    eventId: clip(envelope.eventId || '', 64),
    receivedAt: Number(envelope.receivedAt || Date.now()),
    authUid: clip(envelope.authUid || '', MAX_UID),
    authRole: clip(envelope.authRole || 'unknown', MAX_ROLE),
    isAnonymous: Boolean(envelope.isAnonymous),
    eventName: clip(record.eventName || 'unknown', MAX_EVENT_NAME),
    source: clip(record.source || 'web', MAX_SOURCE),
    route: clip(record.route || '/', MAX_ROUTE),
    role: clip(record.role || 'unknown', MAX_ROLE),
    uid: clip(record.uid || 'anon', MAX_UID),
    ts: Number(record.ts || Date.now()),
    paramsJson: clip(JSON.stringify(params), 4000),
    densityPct: Number.isFinite(densityPct) ? densityPct : 0,
    messageChars: Number.isFinite(chars) ? chars : 0,
    nudgeEffectivenessProxy: Number.isFinite(densityPct) ? Math.max(0, 100 - densityPct) : 0
  };
}

import {
  sanitizeParams,
  sanitizeTelemetryRecord,
  validateTelemetryRecord,
  buildBigQueryRow
} from '../functions/src/telemetry.js';

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${expected}, got ${actual}`);
  }
}

console.log('\n🛰️ TELEMETRY INGEST TESTS');

const params = sanitizeParams({
  zoneId: 'north',
  chars: 42,
  deep: { level: 'ok' },
  bad: undefined
});
assertEqual(params.zoneId, 'north', 'zoneId should be retained');
assertEqual(params.chars, 42, 'number should be retained');
assertEqual(typeof params.deep, 'string', 'nested object should be serialized');
assertEqual(params.bad, '', 'undefined param should become empty string');
console.log('  ✅ sanitizeParams');

const record = sanitizeTelemetryRecord({
  eventName: 'control_nudge_sent',
  params: { densityPct: 78 },
  source: 'web',
  route: '/control',
  role: 'control',
  uid: 'abc123',
  ts: Date.now()
});
assertEqual(record.eventName, 'control_nudge_sent', 'eventName mismatch');
assertEqual(record.route, '/control', 'route mismatch');
assertEqual(record.params.densityPct, 78, 'params mismatch');
console.log('  ✅ sanitizeTelemetryRecord');

const validVerdict = validateTelemetryRecord({
  eventName: 'route_view',
  params: {},
  ts: Date.now()
});
assertEqual(validVerdict.valid, true, 'expected valid verdict');

const invalidVerdict = validateTelemetryRecord({
  eventName: '',
  ts: Date.now()
});
assertEqual(invalidVerdict.valid, false, 'expected invalid verdict');
console.log('  ✅ validateTelemetryRecord');

const row = buildBigQueryRow(
  {
    eventName: 'control_nudge_sent',
    params: { densityPct: 75, chars: 180 },
    source: 'web',
    route: '/control',
    role: 'control',
    uid: 'abc123',
    ts: Date.now()
  },
  {
    eventId: 'evt_123',
    receivedAt: Date.now(),
    authUid: 'auth_123',
    authRole: 'control',
    isAnonymous: false
  }
);
assertEqual(row.schemaVersion, 'eventflow.telemetry.v1', 'schema version mismatch');
assertEqual(row.eventId, 'evt_123', 'event id mismatch');
assertEqual(row.authRole, 'control', 'auth role mismatch');
assertEqual(row.nudgeEffectivenessProxy, 25, 'nudge effectiveness proxy mismatch');
assert(row.paramsJson.includes('densityPct'), 'params json should include density');
console.log('  ✅ buildBigQueryRow');

console.log('Tests: 4 passed, 0 failed');

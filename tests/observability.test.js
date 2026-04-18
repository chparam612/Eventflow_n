import { sanitizeTelemetryParams, buildTelemetryRecord, toBooleanSetting, toNumberSetting } from '../src/observability.js';

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${expected}, got ${actual}`);
  }
}

console.log('\n📡 OBSERVABILITY TESTS');

const sanitized = sanitizeTelemetryParams({
  zoneId: 'north',
  chars: 120,
  ok: true,
  nested: { bad: 'x' },
  empty: undefined
});
assertEqual(sanitized.zoneId, 'north', 'zoneId should be kept');
assertEqual(sanitized.chars, 120, 'number should be kept');
assertEqual(sanitized.ok, true, 'boolean should be kept');
assertEqual(typeof sanitized.nested, 'string', 'object should be stringified');
assertEqual(sanitized.empty, '', 'undefined should become empty string');
console.log('  ✅ sanitizeTelemetryParams');

const record = buildTelemetryRecord('control_nudge_sent', { zoneId: 'north' }, {
  source: 'unit-test',
  route: '/control',
  role: 'control',
  uid: 'abc123'
});
assertEqual(record.eventName, 'control_nudge_sent', 'eventName mismatch');
assertEqual(record.route, '/control', 'route mismatch');
assertEqual(record.role, 'control', 'role mismatch');
assertEqual(record.uid, 'abc123', 'uid mismatch');
assert(typeof record.ts === 'number' && record.ts > 0, 'timestamp should be numeric');
console.log('  ✅ buildTelemetryRecord');

assertEqual(toNumberSetting('120000', 1000, 1000, 300000), 120000, 'numeric parsing failed');
assertEqual(toNumberSetting('invalid', 5000, 1000, 10000), 5000, 'fallback for invalid number failed');
assertEqual(toNumberSetting('999999', 5000, 1000, 10000), 10000, 'max clamp failed');
console.log('  ✅ toNumberSetting');

assertEqual(toBooleanSetting('true', false), true, 'true string parse failed');
assertEqual(toBooleanSetting('0', true), false, '0 string parse failed');
assertEqual(toBooleanSetting('unknown', true), true, 'fallback parse failed');
console.log('  ✅ toBooleanSetting');

console.log('Tests: 4 passed, 0 failed');

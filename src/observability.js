/**
 * EventFlow V2 — Observability Utilities
 * Shared sanitization and config parsers for telemetry + runtime controls.
 */

const MAX_PARAM_KEYS = 16;

function normalizeValue(value) {
  if (typeof value === 'string') return value.slice(0, 120);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return '';
  return String(value).slice(0, 120);
}

export function sanitizeTelemetryParams(params = {}) {
  if (!params || typeof params !== 'object') return {};
  const safe = {};
  const entries = Object.entries(params).slice(0, MAX_PARAM_KEYS);
  for (const [key, val] of entries) {
    const cleanKey = String(key || '').trim().slice(0, 40);
    if (!cleanKey) continue;
    safe[cleanKey] = normalizeValue(val);
  }
  return safe;
}

export function buildTelemetryRecord(eventName, params = {}, context = {}) {
  const routeFromWindow = typeof window !== 'undefined' ? window.location?.pathname : '/';
  const roleFromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem('ef_role') : 'unknown';
  const uidFromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem('ef_uid') : 'anon';
  return {
    eventName: String(eventName || 'unknown').slice(0, 60),
    params: sanitizeTelemetryParams(params),
    source: String(context.source || 'web').slice(0, 40),
    route: String(context.route || routeFromWindow || '/').slice(0, 120),
    role: String(context.role || roleFromStorage || 'unknown').slice(0, 40),
    uid: String(context.uid || uidFromStorage || 'anon').slice(0, 80),
    ts: Date.now()
  };
}

export function toNumberSetting(value, defaultValue, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, parsed));
}

export function toBooleanSetting(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return defaultValue;
  const norm = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(norm)) return true;
  if (['false', '0', 'no', 'off'].includes(norm)) return false;
  return defaultValue;
}

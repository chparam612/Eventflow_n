/**
 * EventFlow V2 — Cloud Service Integration Hooks
 * BigQuery-ready event shaping + optional Cloud Function/ML endpoints.
 */

const CLOUD_BACKEND_BASE = (typeof window !== 'undefined' && window.__EF_CLOUD_BACKEND_BASE__) || '';

export function buildBigQueryEvent(eventType, payload = {}) {
  return {
    eventType,
    eventTime: new Date().toISOString(),
    source: 'eventflow-web',
    payload
  };
}

export function classifySurgeRisk(density = 0, predictedPercent = 0) {
  const effective = Math.max(density * 100, predictedPercent);
  if (effective >= 90) return 'critical';
  if (effective >= 75) return 'high';
  if (effective >= 55) return 'medium';
  return 'low';
}

export async function invokeCloudEndpoint(route, payload = {}) {
  if (!CLOUD_BACKEND_BASE) return null;
  try {
    const res = await fetch(`${CLOUD_BACKEND_BASE}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

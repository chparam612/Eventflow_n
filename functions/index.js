import { onRequest } from 'firebase-functions/v2/https';

/**
 * EventFlow Cloud Workflow Stubs
 * Deploy these as HTTP Cloud Functions/Cloud Run handlers in production.
 */

function json(res, body, status = 200) {
  return res.status(status).json(body);
}

export const instructionAck = onRequest(async (req, res) => {
  const payload = req.body;
  if (!payload?.instructionId || !payload?.staffUid) {
    return json(res, { ok: false, error: 'invalid_payload' }, 400);
  }
  return json(res, { ok: true, workflow: 'instruction_ack', receivedAt: Date.now() });
});

export const emergencyValidate = onRequest(async (req, res) => {
  const payload = req.body;
  const allowed = ['FIRE', 'SECURITY', 'MEDICAL'];
  if (!allowed.includes(payload?.type) || !payload?.zone) {
    return json(res, { ok: false, error: 'invalid_emergency' }, 400);
  }
  return json(res, { ok: true, workflow: 'emergency_validate', receivedAt: Date.now() });
});

export const classifySurge = onRequest(async (req, res) => {
  const payload = req.body;
  const pct = Number(payload?.densityPercent || 0);
  const risk = pct >= 90 ? 'critical' : pct >= 75 ? 'high' : pct >= 55 ? 'medium' : 'low';
  return json(res, { ok: true, risk });
});

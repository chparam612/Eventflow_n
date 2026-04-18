/**
 * EventFlow Cloud Workflow Stubs
 * Deploy these as HTTP Cloud Functions/Cloud Run handlers in production.
 */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function instructionAck(request) {
  const payload = await request.json();
  if (!payload?.instructionId || !payload?.staffUid) {
    return json({ ok: false, error: 'invalid_payload' }, 400);
  }
  return json({ ok: true, workflow: 'instruction_ack', receivedAt: Date.now() });
}

export async function emergencyValidate(request) {
  const payload = await request.json();
  const allowed = ['FIRE', 'SECURITY', 'MEDICAL'];
  if (!allowed.includes(payload?.type) || !payload?.zone) {
    return json({ ok: false, error: 'invalid_emergency' }, 400);
  }
  return json({ ok: true, workflow: 'emergency_validate', receivedAt: Date.now() });
}

export async function classifySurge(request) {
  const payload = await request.json();
  const pct = Number(payload?.densityPercent || 0);
  const risk = pct >= 90 ? 'critical' : pct >= 75 ? 'high' : pct >= 55 ? 'medium' : 'low';
  return json({ ok: true, risk });
}

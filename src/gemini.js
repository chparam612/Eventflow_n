/**
 * EventFlow V2 — Gemini AI Module
 * Uses gemini-2.0-flash for fast responses
 */

// Replace with your actual Gemini API key
const GEMINI_KEY = 'YOUR_GEMINI_KEY_HERE';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

// ─── Attendee system context ────────────────────────────────────────────────
const ATTENDEE_SYSTEM = `You are EventFlow AI, a friendly crowd assistant at
Narendra Modi Stadium (NMS), Ahmedabad — 132,000 capacity cricket venue.
Your role: help cricket fans navigate safely and comfortably.
RULES:
- Be warm and friendly, max 2 short sentences
- Give ONE clear recommendation with specific gate/zone name
- Never cause panic — use positive framing always
- Mention real NMS locations: Gates A–I, North/South/East/West stands, 
  Parking P1(North) P2(South) P3(East) P4(West), concourses
- If crowd is heavy, suggest an alternative, never just say "it's crowded"`;

// ─── Core API call ─────────────────────────────────────────────────────────
async function callGemini(prompt, maxTokens = 200) {
  if (!GEMINI_KEY || GEMINI_KEY === 'YOUR_GEMINI_KEY_HERE') {
    return null; // Key not set — use fallback
  }
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: maxTokens,
          topP: 0.85
        }
      })
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) {
    console.warn('[Gemini] Call failed:', e.message);
    return null;
  }
}

// ─── Attendee Chat ─────────────────────────────────────────────────────────
export async function askAttendee(message, crowdContext) {
  const ctxStr = crowdContext
    ? '\nLive zone data: ' + Object.entries(crowdContext)
      .map(([z, d]) => `${z}:${Math.round(d * 100)}%`)
      .join(', ')
    : '';

  const prompt = ATTENDEE_SYSTEM + ctxStr + '\n\nFan question: ' + message;
  const reply = await callGemini(prompt, 150);

  // Fallback responses keyed to common queries
  if (!reply) {
    const lc = message.toLowerCase();
    if (lc.includes('gate') || lc.includes('enter'))
      return 'Head to Gate B on the North side — it\'s the least crowded right now. Walk time is about 5 minutes from parking.';
    if (lc.includes('food') || lc.includes('eat'))
      return 'Best time for food is the first 30 minutes — concession lines are shorter on the West concourse right now.';
    if (lc.includes('exit') || lc.includes('leave'))
      return 'For the smoothest exit, leave 10 minutes before the final over, or wait 20 minutes after the match — Gate G South is quickest.';
    if (lc.includes('park') || lc.includes('car'))
      return 'P2 South has the most space right now. Exit via Gate G and follow the orange signs — about 8 minutes walk.';
    return 'I\'m temporarily offline. Check the venue screens or ask any ground staff member in the orange vest for assistance.';
  }
  return reply;
}

// ─── Control Room AI Insights ──────────────────────────────────────────────
export async function getAIInsights(densities) {
  const summary = Object.entries(densities)
    .map(([z, d]) => `${z}:${Math.round(d * 100)}%`)
    .join(', ');

  const prompt = `You are EventFlow Control AI at NMS stadium.
Current zone densities: ${summary}

Return exactly 3 JSON crowd management insights for the control room.
Response must be valid JSON only, no markdown, no extra text:
{"insights":[
  {"type":"warning","zone":"zone name","message":"under 12 words","action":"under 8 words"},
  {"type":"info","zone":"zone name","message":"under 12 words","action":"under 8 words"},
  {"type":"action","zone":"zone name","message":"under 12 words","action":"under 8 words"}
]}`;

  const raw = await callGemini(prompt, 350);

  if (!raw) {
    // Deterministic fallback insights based on actual densities
    const critical = Object.entries(densities).filter(([, d]) => d > 0.8);
    const busy = Object.entries(densities).filter(([, d]) => d > 0.6 && d <= 0.8);
    return {
      insights: [
        critical.length > 0
          ? { type: 'warning', zone: critical[0][0], message: `${critical[0][0]} at ${Math.round(critical[0][1] * 100)}% — immediate action needed`, action: 'Dispatch staff now' }
          : { type: 'info', zone: 'All Zones', message: 'All zones within normal density range', action: 'Continue monitoring' },
        busy.length > 0
          ? { type: 'action', zone: busy[0][0], message: `${busy[0][0]} approaching capacity — redirect flow`, action: 'Open backup gates' }
          : { type: 'info', zone: 'Parking', message: 'Parking zones flowing smoothly — no intervention', action: 'Maintain status' },
        { type: 'info', zone: 'Concourse', message: 'Concourse density normal for match phase', action: 'Monitor food stalls' }
      ]
    };
  }

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    // Validate structure
    if (Array.isArray(parsed.insights)) return parsed;
    throw new Error('Invalid shape');
  } catch (e) {
    console.warn('[Gemini] Insight parse failed:', e.message);
    return { insights: [] };
  }
}

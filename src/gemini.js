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
  if (!GEMINI_KEY || GEMINI_KEY === 'YOUR_API_KEY_HERE') {
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
    if (res.status === 429) {
      // Suppress console error and return graceful string indicating rate limit
      return "Notice: Currently experiencing high traffic. AI functionality conditionally paused. Route guidance nominal.";
    }
    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) {
    if (!e.message.includes('429')) console.warn('[Gemini] Call failed:', e.message);
    return null;
  }
}

// ─── Attendee Chat ─────────────────────────────────────────────────────────
export async function askAttendee(message, crowdContext) {
  const ctx = crowdContext ? 
    '\nLive NMS crowd data: ' + JSON.stringify(crowdContext) 
    : '';
  
  try {
    const reply = await callGemini(
      ATTENDEE_SYSTEM + ctx + '\n\nFan question: ' + message
    );
    if (reply) return reply;
    throw new Error('empty response');
  } catch(e) {
    // Use live crowd context for intelligent fallback
    if (crowdContext && crowdContext.zones) {
      const clear = crowdContext.zones
        .filter(z => z.status === 'CLEAR')
        .map(z => z.name);
      const busy = crowdContext.zones
        .filter(z => z.status === 'CRITICAL' || z.status === 'BUSY')
        .map(z => z.name);

      let response = '';
      if (message.toLowerCase().includes('exit') ||
          message.toLowerCase().includes('gate') ||
          message.toLowerCase().includes('niklo') ||
          message.toLowerCase().includes('bahar')) {
        response = clear.length > 0
          ? `Gate ${clear[0].replace(' Stand','') === 'North' ? 'B' :
             clear[0].replace(' Stand','') === 'South' ? 'G' :
             clear[0].replace(' Stand','') === 'East' ? 'D' : 'F'} is clearest right now (${clear[0]} area). Head there for fastest exit.`
          : 'Gate B on the North side is your best exit route right now.';
      } else if (message.toLowerCase().includes('food') ||
                 message.toLowerCase().includes('khana')) {
        response = 'Best time for food is first 15 min of play — concession lines are shortest then. North concourse usually has the shortest queues.';
      } else if (message.toLowerCase().includes('crowd') ||
                 message.toLowerCase().includes('bheed')) {
        response = busy.length > 0
          ? `Avoid ${busy[0]} area right now — it is at high capacity. ${clear.length > 0 ? clear[0] + ' side is clear.' : 'Try alternative entrances.'}`
          : 'All zones are manageable right now. Proceed normally.';
      } else {
        response = clear.length > 0
          ? `${clear[0]} area is clear right now. For any movement, that direction is recommended.`
          : 'Follow venue staff instructions for guidance. All systems operational.';
      }
      return response;
    }
    return 'Gate B (North entrance) is least crowded right now. For food, try the North concourse. Exit early via Gate G South to avoid the rush.';
  }
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

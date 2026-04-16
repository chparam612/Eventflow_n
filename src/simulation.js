/**
 * EventFlow V2 — Simulation Engine
 * Models crowd flow at Narendra Modi Stadium (132,000 cap)
 * Based on real T20 match timeline: 18:00 start
 */

// ─── Zone Definitions ──────────────────────────────────────────────────────
export const ZONES = {
  north:   { name: 'North Stand',      cap: 35000, gate: 'B', section: 'north' },
  south:   { name: 'South Stand',      cap: 35000, gate: 'G', section: 'south' },
  east:    { name: 'East Stand',       cap: 25000, gate: 'D', section: 'east'  },
  west:    { name: 'West Stand',       cap: 25000, gate: 'F', section: 'west'  },
  concN:   { name: 'North Concourse',  cap: 6000,  gate: 'A', section: 'north' },
  concS:   { name: 'South Concourse',  cap: 6000,  gate: 'H', section: 'south' },
  gates:   { name: 'Gate Area',        cap: 4000,  gate: '-', section: 'gates' },
  parking: { name: 'Parking Zone',     cap: 8000,  gate: '-', section: 'parking' }
};

// ─── Match Timeline (minutes from 18:00 / t=0) ────────────────────────────
// Cricket T20 match at NMS — gates open 2h before, match starts at t=120
const TIMELINE = [
  { t: 0,   event: 'gates_open',      loads: { gates: 0.55, parking: 0.30, concN: 0.15, concS: 0.15 } },
  { t: 30,  event: 'early_fans',      loads: { gates: 0.70, parking: 0.50, north: 0.30, south: 0.20 } },
  { t: 60,  event: 'rush_hour',       loads: { gates: 0.90, parking: 0.75, concN: 0.65, concS: 0.60, north: 0.55, south: 0.55 } },
  { t: 90,  event: 'settling',        loads: { gates: 0.55, parking: 0.80, north: 0.70, south: 0.70, east: 0.60, west: 0.60 } },
  { t: 120, event: 'match_start',     loads: { north: 0.85, south: 0.85, east: 0.75, west: 0.75, gates: 0.30, concN: 0.40, concS: 0.40 } },
  { t: 150, event: 'settled',         loads: { north: 0.90, south: 0.88, east: 0.80, west: 0.80, concN: 0.25, concS: 0.25 } },
  { t: 240, event: 'innings_break',   loads: { concN: 0.92, concS: 0.88, gates: 0.50, north: 0.60, south: 0.65 } },
  { t: 270, event: 'innings_2_start', loads: { north: 0.88, south: 0.88, east: 0.78, west: 0.78, concN: 0.35, concS: 0.35 } },
  { t: 390, event: 'last_overs',      loads: { north: 0.92, south: 0.90, east: 0.82, west: 0.82, gates: 0.35, parking: 0.90 } },
  { t: 420, event: 'match_end',       loads: { gates: 0.95, parking: 0.95, concN: 0.85, concS: 0.85, north: 0.70, south: 0.70 } },
  { t: 450, event: 'crowd_clearing',  loads: { gates: 0.60, parking: 0.70, north: 0.40, south: 0.40, east: 0.35, west: 0.35 } },
  { t: 480, event: 'empty',           loads: { north: 0.05, south: 0.05, east: 0.05, west: 0.05, gates: 0.10, parking: 0.20, concN: 0.05, concS: 0.05 } }
];

// ─── State ─────────────────────────────────────────────────────────────────
let currentTick = 0; // minutes since 18:00
let staffOverrides = {}; // { zoneId: 'clear' | 'crowded' }
let _lastDensity = {};

export function setTick(minutes) {
  currentTick = Math.max(0, Math.min(480, minutes));
}

export function getTick() { return currentTick; }

export function getTickLabel() {
  const base = 18 * 60; // 18:00
  const total = (base + currentTick) % (24 * 60);
  const h = Math.floor(total / 60).toString().padStart(2, '0');
  const m = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function setStaffOverride(zoneId, status) {
  staffOverrides[zoneId] = status;
}

export function clearStaffOverride(zoneId) {
  delete staffOverrides[zoneId];
}

// ─── Density Calculation ───────────────────────────────────────────────────
export function getZoneDensity() {
  // Accumulate loads from all past timeline events
  let loads = {};
  for (const event of TIMELINE) {
    if (currentTick >= event.t) {
      Object.assign(loads, event.loads);
    }
  }

  const result = {};
  for (const id of Object.keys(ZONES)) {
    let base = loads[id] !== undefined ? loads[id] : 0.10;

    // Staff overrides shift density
    if (staffOverrides[id] === 'crowded') base = Math.min(0.98, base * 1.3 + 0.1);
    if (staffOverrides[id] === 'clear')   base = Math.max(0.05, base * 0.6);

    // Realistic noise
    const noise = (Math.random() - 0.5) * 0.03;
    result[id] = Math.max(0, Math.min(1, base + noise));
  }

  _lastDensity = { ...result };
  return result;
}

export function getLastDensity() { return { ..._lastDensity }; }

// ─── Status Helpers ────────────────────────────────────────────────────────
export function getZoneStatus(density, isBlocked = false) {
  if (isBlocked) return 'blocked';
  if (density >= 0.8) return 'critical';
  if (density >= 0.6) return 'busy';
  return 'clear';
}

export function getStatusColor(status) {
  if (status === 'blocked')  return '#060A10'; // Black
  if (status === 'critical') return '#FF4757';
  if (status === 'busy')     return '#FFD166';
  return '#00C49A';
}

export function getStatusEmoji(status) {
  if (status === 'blocked')  return '🚧';
  if (status === 'critical') return '🔴';
  if (status === 'busy')     return '🟡';
  return '🟢';
}

// ─── Gate Recommendation ───────────────────────────────────────────────────
export function getRecommendedGate(section, density) {
  const primary = { north: 'B', south: 'G', east: 'D', west: 'F' };
  const alternate = { north: 'A', south: 'H', east: 'C', west: 'E' };

  const d = density?.[section] || 0;
  const gate = d > 0.75 ? (alternate[section] || 'B') : (primary[section] || 'B');
  const pct = Math.round(d * 100);
  const waitMin = d > 0.75 ? Math.round(d * 20) : Math.round(d * 8);
  return { gate, density: d, pct, waitMin };
}

// ─── Exit Plan ─────────────────────────────────────────────────────────────
export function getExitPlan(section, transport, density) {
  const gateMap = { north: 'B', south: 'G', east: 'D', west: 'F' };
  const gate = gateMap[section] || 'B';
  const now = density?.[section] || 0.5;

  return [
    {
      id: 'now',
      label: 'Leave Now',
      gate,
      eta: now > 0.7 ? Math.round(now * 25) : Math.round(now * 10 + 3),
      density: now,
      note: 'Good if you want to beat the rush'
    },
    {
      id: 'wait15',
      label: 'Wait 15 Minutes',
      gate,
      eta: Math.round(now * 10),
      density: Math.max(0.15, now - 0.28),
      note: 'Crowd drops significantly — much smoother'
    },
    {
      id: 'stay',
      label: 'Stay for Ceremony',
      gate,
      eta: 5,
      density: 0.15,
      note: 'Smoothest exit — see the full presentation'
    }
  ];
}

// ─── Simulation Tick ───────────────────────────────────────────────────────
export function simulateTick() {
  currentTick = Math.min(currentTick + 1, 480);
  return getZoneDensity();
}

// ─── Nudge Logic ───────────────────────────────────────────────────────────
export function shouldShowNudge() {
  // Near innings break or match end
  const nearBreak = currentTick >= 235 && currentTick <= 250;
  const nearEnd   = currentTick >= 410 && currentTick <= 430;
  return nearBreak || nearEnd;
}

export function getNudgeType() {
  if (currentTick >= 235 && currentTick <= 250) return 'break';
  if (currentTick >= 410 && currentTick <= 430) return 'end';
  return null;
}

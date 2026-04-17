/**
 * EventFlow V2 — Attendee Flow
 * Screens: intake → plan → escort → during → exit → feedback
 */
import {
  getZoneDensity, getZoneStatus, getStatusColor, getStatusEmoji,
  getRecommendedGate, getExitPlan, shouldShowNudge, getNudgeType, ZONES
} from '/src/simulation.js';
import { 
  saveAttendeeData, saveFeedback, listenZones, listenNudges, 
  listenEmergency 
} from '/src/firebase.js';
import { renderAIChat, initAIChat } from './aiChat.js';
import { rankBestExit } from '/src/evacuationEngine.js';
import { calculateAverageDensity } from '/src/analyticsEngine.js';
import { loginAnonymously } from '/src/auth.js';

// ─── State ────────────────────────────────────────────────────────────────
let screen = 'intake';
let intakeStep = 0;
let answers = {};
let currentDensities = {};
let cleanupFns = [];
let nudgeShown = false;

const INTAKE_QUESTIONS = [
  {
    id: 'arrival', text: 'When are you arriving?',
    emoji: '🕔',
    options: [
      { id: 'early', label: 'Before 5 PM', sub: '3h before' },
      { id: 'before', label: '5–6 PM', sub: '2h before' },
      { id: 'match', label: '6–7 PM', sub: 'Just in time' },
      { id: 'late', label: 'After 7 PM', sub: 'Late arrival' }
    ]
  },
  {
    id: 'group', text: 'How many in your group?',
    emoji: '👥',
    options: [
      { id: '1', label: 'Just me', sub: 'Solo fan' },
      { id: '2-3', label: '2–3 people', sub: 'Small group' },
      { id: '4-6', label: '4–6 people', sub: 'Group' },
      { id: '7+', label: '7+ people', sub: 'Large group' }
    ]
  },
  {
    id: 'transport', text: 'How are you getting here?',
    emoji: '🚗',
    options: [
      { id: 'car', label: 'Car / Bike', sub: 'Need parking' },
      { id: 'metro', label: 'Metro / Bus', sub: 'Motera station' },
      { id: 'cab', label: 'Auto / Cab', sub: 'Drop at gate' },
      { id: 'walk', label: 'Walking', sub: 'Nearby' }
    ]
  },
  {
    id: 'parking', text: 'Which parking zone?',
    emoji: '🅿️',
    options: [
      { id: 'P1', label: 'P1 North', sub: 'Gate A/B side' },
      { id: 'P2', label: 'P2 South', sub: 'Gate G/H side' },
      { id: 'P3', label: 'P3 East', sub: 'Gate C/D side' },
      { id: 'P4', label: 'P4 West', sub: 'Gate E/F side' }
    ]
  },
  {
    id: 'destination', text: 'Where are you headed after?',
    emoji: '🏠',
    options: [
      { id: 'home-north', label: 'Home (North)', sub: 'N Ahmedabad' },
      { id: 'home-south', label: 'Home (South)', sub: 'S Ahmedabad' },
      { id: 'station', label: 'Railway Station', sub: 'Ahmedabad Jn' },
      { id: 'airport', label: 'Airport', sub: 'AMR Airport' }
    ]
  }
];

// ─── Section from answers ─────────────────────────────────────────────────
function getSectionFromAnswers() {
  const pk = answers.parking;
  if (pk === 'P1') return 'north';
  if (pk === 'P2') return 'south';
  if (pk === 'P3') return 'east';
  if (pk === 'P4') return 'west';
  const dest = answers.destination || '';
  if (dest.includes('north')) return 'north';
  if (dest.includes('south')) return 'south';
  return 'north';
}

// ─── Shared Zone Status Strip ─────────────────────────────────────────────
function zoneStrip(densities) {
  const main = ['north', 'south', 'east', 'west'];
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;" role="list" aria-label="Live zone crowd status">
    ${main.map(id => {
      const d = densities[id] || 0;
      const s = getZoneStatus(d);
      const zoneName = ZONES[id]?.name?.replace(' Stand', '') || id;
      return `<span class="pill pill-${s}" role="listitem"
        aria-label="${zoneName} stand status: ${s.toLowerCase()}, ${Math.round(d * 100)}% capacity">
        ${getStatusEmoji(s)} ${zoneName}
        <span style="font-family:'Space Grotesk',sans-serif;">${Math.round(d * 100)}%</span>
      </span>`;
    }).join('')}
  </div>`;
}

// ─── RENDER ───────────────────────────────────────────────────────────────
export function render() {
  return `<div id="attendee-root" style="
    min-height:100vh;background:var(--bg-deep);
    display:flex;flex-direction:column;max-width:480px;margin:0 auto;">
    <div id="attendee-screen"></div>
    ${renderAIChat()}
  </div>`;
}

// ────────────────────────────────────────────────────────
// SCREEN RENDERERS
// ────────────────────────────────────────────────────────

function renderIntake() {
  const showParking = answers.transport === 'car';
  const step = showParking ? intakeStep : (intakeStep >= 3 ? intakeStep + 1 : intakeStep);
  const questions = INTAKE_QUESTIONS.filter((q, i) => {
    if (q.id === 'parking' && !showParking) return false;
    return true;
  });
  const totalSteps = questions.length;
  const q = questions[intakeStep < questions.length ? intakeStep : questions.length - 1];
  const pct = Math.round(((intakeStep) / totalSteps) * 100);

  return `
  <div class="fade-in" style="padding:20px 16px;display:flex;flex-direction:column;gap:20px;">

    <!-- Header -->
    <div style="display:flex;align-items:center;gap:12px;">
      <button onclick="window._attBack()" aria-label="Go back to previous screen" style="
        background:var(--bg-card);border:1px solid var(--border);
        border-radius:8px;width:34px;height:34px;
        color:var(--text-secondary);font-size:1rem;cursor:pointer;
        display:flex;align-items:center;justify-content:center;">←</button>
      <div style="flex:1;">
        <div style="font-family:'Space Grotesk',sans-serif;font-size:1rem;
          font-weight:600;color:var(--text-primary);">Quick Setup</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">
          Step ${intakeStep + 1} of ${totalSteps}</div>
      </div>
    </div>

    <!-- Progress bar -->
    <div style="height:3px;background:var(--border);border-radius:4px;overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:var(--green);
        border-radius:4px;transition:width 0.3s ease;"></div>
    </div>

    <!-- Question -->
    <div style="text-align:center;padding:16px 0 8px;">
      <div style="font-size:2.5rem;margin-bottom:12px;">${q.emoji}</div>
      <h2 style="font-family:'Space Grotesk',sans-serif;
        font-size:1.2rem;font-weight:600;color:var(--text-primary);">
        ${q.text}</h2>
    </div>

    <!-- Options -->
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${q.options.map(opt => `
        <button class="intake-opt" data-qid="${q.id}" data-val="${opt.id}"
          aria-label="${opt.label} — ${opt.sub}" aria-pressed="${answers[q.id] === opt.id ? 'true' : 'false'}" style="
          background:var(--bg-card);border:1px solid var(--border);
          border-radius:14px;padding:16px 18px;text-align:left;
          cursor:pointer;transition:all 0.2s;width:100%;
          ${answers[q.id] === opt.id ? 'border-color:rgba(0,196,154,0.5);background:rgba(0,196,154,0.05);' : ''}">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="font-family:'Space Grotesk',sans-serif;font-weight:600;
                font-size:0.95rem;color:var(--text-primary);">${opt.label}</div>
              <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:2px;">
                ${opt.sub}</div>
            </div>
            <div style="width:18px;height:18px;border-radius:50%;
              border:2px solid ${answers[q.id] === opt.id ? '#00C49A' : 'rgba(255,255,255,0.15)'};
              background:${answers[q.id] === opt.id ? '#00C49A' : 'transparent'};
              display:flex;align-items:center;justify-content:center;
              font-size:0.7rem;color:#000;" aria-hidden="true">
              ${answers[q.id] === opt.id ? '✓' : ''}
            </div>
          </div>
        </button>
      `).join('')}

      ${intakeStep + 1 < totalSteps
        ? `<button id="intake-next-btn" aria-label="Next question" style="
            margin-top:8px;background:var(--green);color:#000;
            font-weight:700;border:none;border-radius:12px;
            padding:16px;font-size:0.95rem;cursor:pointer;
            opacity:${answers[q.id] ? '1' : '0.4'};
            transition:all 0.2s;" ${!answers[q.id] ? 'disabled aria-disabled="true"' : ''}>
            Next →
          </button>`
        : `<button id="intake-done-btn" aria-label="Generate my personalised crowd plan" style="
            margin-top:8px;background:var(--green);color:#000;
            font-weight:700;border:none;border-radius:12px;
            padding:18px;font-size:1rem;cursor:pointer;
            opacity:${answers[q.id] ? '1' : '0.4'};
            transition:all 0.2s;" ${!answers[q.id] ? 'disabled aria-disabled="true"' : ''}>
            Generate My Plan ✨
          </button>`
      }
    </div>
  </div>
  <style>
    .intake-opt:hover { border-color:rgba(0,196,154,0.3)!important;background:rgba(0,196,154,0.03)!important; }
  </style>`;
}

function renderPlan() {
  const section = getSectionFromAnswers();
  const gateInfo = getRecommendedGate(section, currentDensities);
  const density = currentDensities;

  const arrivalLabel = {
    early: 'Before 5 PM', before: '5–6 PM', match: '6–7 PM', late: 'After 7 PM'
  }[answers.arrival] || '6 PM';

  const timeline = answers.arrival === 'early'
    ? [
        { time: arrivalLabel, label: 'Arrive & Park', icon: '🏟️' },
        { time: '+30 min',    label: 'Enter via Gate ' + gateInfo.gate, icon: '🎟️' },
        { time: '+60 min',    label: 'Explore concessions & find seat', icon: '🍕' },
        { time: '20:00',      label: 'Match starts — enjoy!', icon: '🏏' },
      ]
    : [
        { time: arrivalLabel, label: 'Arrive — head straight to Gate ' + gateInfo.gate, icon: '🏃' },
        { time: '+15 min',    label: 'Through gate & to your seat', icon: '🎟️' },
        { time: '20:00',      label: 'Match starts — you\'re in!', icon: '🏏' },
      ];

  return `
  <div class="fade-in" style="padding:16px;display:flex;flex-direction:column;gap:12px;">

    <!-- Welcome -->
    <div style="padding:4px 0 8px;">
      <h1 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;
        font-weight:700;color:var(--text-primary);">Welcome to the Match! 🏏</h1>
      <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:4px;">
        Your personalized NMS guide is ready</p>
    </div>

    <!-- Recommended Gate CARD -->
    <div style="
      background:linear-gradient(135deg,rgba(0,196,154,0.12),rgba(0,196,154,0.04));
      border:1px solid rgba(0,196,154,0.3);border-radius:18px;padding:20px;">
      <div style="font-size:0.72rem;font-weight:600;letter-spacing:0.08em;
        color:#00C49A;text-transform:uppercase;margin-bottom:8px;">
        ⭐ Recommended Entry</div>
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="text-align:center;">
          <div style="font-family:'Space Grotesk',sans-serif;
            font-size:3rem;font-weight:700;color:#00C49A;line-height:1;">
            ${gateInfo.gate}</div>
          <div style="font-size:0.72rem;color:#00C49A;font-weight:500;">GATE</div>
        </div>
        <div style="flex:1;">
          <div style="font-size:0.92rem;color:var(--text-primary);margin-bottom:4px;">
            ${ZONES[section]?.name || 'North Stand'}</div>
          <div style="font-size:0.82rem;color:var(--text-secondary);">
            ${gateInfo.pct}% capacity · ~${gateInfo.waitMin} min wait</div>
          <div style="margin-top:8px;">
            <span class="pill pill-${getZoneStatus(gateInfo.density)}">
              ${getZoneStatus(gateInfo.density).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
      <button id="plan-escort-btn" style="
        width:100%;margin-top:16px;background:#00C49A;color:#000;
        border:none;border-radius:10px;padding:13px;
        font-family:'Space Grotesk',sans-serif;
        font-weight:700;font-size:0.92rem;cursor:pointer;
        transition:all 0.2s;">
        Take Me There →
      </button>
    </div>

    <!-- Live Zone Status -->
    <div style="background:var(--bg-card);border:1px solid var(--border);
      border-radius:16px;padding:16px;">
      <div style="font-size:0.72rem;font-weight:600;letter-spacing:0.08em;
        color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;">
        📡 Live Zones</div>
      <div id="plan-zone-strip">${zoneStrip(density)}</div>
    </div>

    <!-- Your Timeline -->
    <div style="background:var(--bg-card);border:1px solid var(--border);
      border-radius:16px;padding:16px;">
      <div style="font-size:0.72rem;font-weight:600;letter-spacing:0.08em;
        color:var(--text-muted);text-transform:uppercase;margin-bottom:12px;">
        🗓️ Your Timeline</div>
      <div style="display:flex;flex-direction:column;gap:0;">
        ${timeline.map((t, i) => `
          <div style="display:flex;gap:12px;align-items:flex-start;
            ${i < timeline.length - 1 ? 'padding-bottom:14px;border-left:2px solid var(--border);margin-left:9px;' : ''}">
            <div style="
              width:20px;height:20px;border-radius:50%;flex-shrink:0;
              background:${i === 0 ? '#00C49A' : 'var(--border)'};
              border:2px solid ${i === 0 ? '#00C49A' : 'rgba(255,255,255,0.1)'};
              display:flex;align-items:center;justify-content:center;
              font-size:0.6rem;margin-left:${i < timeline.length - 1 ? '-11px' : '0'};
              ${i > 0 ? 'background:var(--bg-card2);' : ''}
              "></div>
            <div style="flex:1;${i > 0 ? 'padding-top:0;' : ''}">
              <div style="font-size:0.72rem;color:var(--text-muted);">${t.time}</div>
              <div style="font-size:0.88rem;color:var(--text-primary);margin-top:1px;">
                ${t.icon} ${t.label}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Exit Preview -->
    <div style="
      background:var(--bg-card2);border:1px solid var(--border);
      border-radius:14px;padding:14px;
      display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:0.82rem;color:var(--text-secondary);">
          🚪 Exit plan ready for you</div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">
          Tap 20 min before you plan to leave</div>
      </div>
      <button id="plan-exit-btn" style="
        background:none;border:1px solid var(--border-accent);
        border-radius:8px;color:#00C49A;padding:7px 12px;
        font-size:0.78rem;cursor:pointer;white-space:nowrap;">
        See Plan
      </button>
    </div>
  </div>`;
}

function renderEscort(mode = 'arrival') {
  const section = getSectionFromAnswers();
  const gateInfo = getRecommendedGate(section, currentDensities);

  const steps = mode === 'arrival'
    ? [
        { text: `Head to Gate ${gateInfo.gate} — follow the green signage. Entrance is clearly marked.`, icon: '🏃' },
        { text: `Show your ticket at scanner. Have your QR code ready to scan — takes ~30 seconds.`, icon: '🎟️' },
        { text: `Pass through security at Bay ${gateInfo.gate}${section === 'north' ? '2' : '1'}. Remove metal items beforehand.`, icon: '🔐' },
        { text: `Your seat is in the ${ZONES[section]?.name || 'stand'}. Follow the stand signs to your row.`, icon: '💺' }
      ]
    : [
        { text: `Make your way to the exit aisle in the ${ZONES[section]?.name || 'stand'}. Use the railings.`, icon: '↗️' },
        { text: `Head towards Gate ${gateInfo.gate} — orange exit signs guide you through the concourse.`, icon: '🚪' },
        { text: `Exit at Gate ${gateInfo.gate}. ${answers.transport === 'car' ? 'Parking ' + (answers.parking || 'P1') + ' is a 3-minute walk on your right.' : 'Transport is directly ahead.'}`, icon: '🚗' },
        { text: `You\'re free! ${answers.transport === 'metro' ? 'Motera Metro is 400m ahead.' : answers.transport === 'cab' ? 'Cab pickup zone is marked in yellow.' : 'Take care going home!'}`, icon: '🎉' }
      ];

  let currentStep = 0;

  return `
  <div class="fade-in" style="
    min-height:100vh;background:var(--bg-deep);
    display:flex;flex-direction:column;">

    <!-- Top bar -->
    <div style="
      display:flex;align-items:center;gap:12px;padding:14px 16px;
      background:var(--bg-card);border-bottom:1px solid var(--border);">
      <button onclick="window._attBack()" style="
        background:none;border:none;color:var(--text-secondary);
        font-size:1rem;cursor:pointer;">← Back</button>
      <div style="flex:1;text-align:center;">
        <div style="font-family:'Space Grotesk',sans-serif;font-weight:600;
          font-size:0.92rem;color:var(--text-primary);">
          ${mode === 'arrival' ? '🎟️ Getting to Your Seat' : '🚪 Exit Guide'}
        </div>
      </div>
      <div style="width:50px;"></div>
    </div>

    <!-- Progress -->
    <div style="padding:20px 16px;flex:1;display:flex;flex-direction:column;gap:16px;" class="fade-in">
      <div style="text-align:center;">
        <div id="escort-step-num" style="
          font-family:'Space Grotesk',sans-serif;
          font-size:0.75rem;font-weight:600;color:var(--text-muted);
          text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">
          Step 1 of ${steps.length}</div>
        <div style="display:flex;justify-content:center;gap:6px;margin-bottom:16px;">
          ${steps.map((_, i) => `<div class="escort-dot escort-dot-${i}" style="
            width:${i === 0 ? '24px' : '8px'};height:8px;border-radius:4px;
            background:${i === 0 ? '#00C49A' : 'var(--border)'};
            transition:all 0.3s;"></div>`).join('')}
        </div>
      </div>

      <!-- Step card -->
      <div id="escort-step-card" style="
        background:var(--bg-card);border:1px solid var(--border);
        border-radius:18px;padding:24px;text-align:center;
        flex:1;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:16px;">
        <div id="escort-icon" style="font-size:3rem;">${steps[0].icon}</div>
        <p id="escort-text" style="
          font-size:1rem;line-height:1.6;
          color:var(--text-primary);max-width:300px;">${steps[0].text}</p>
        <div id="escort-path-status" style="
          display:flex;align-items:center;gap:6px;
          background:rgba(0,196,154,0.08);border:1px solid rgba(0,196,154,0.2);
          border-radius:20px;padding:6px 14px;">
          <span style="width:6px;height:6px;border-radius:50%;background:#00C49A;
            display:inline-block;animation:pulse 2s ease-in-out infinite;"></span>
          <span style="font-size:0.78rem;color:#00C49A;">Path is clear</span>
        </div>
      </div>

      <!-- Navigation -->
      <div style="display:flex;gap:10px;">
        <button id="escort-prev-btn" style="
          flex:1;background:var(--bg-card);border:1px solid var(--border);
          border-radius:12px;padding:14px;
          color:var(--text-secondary);cursor:pointer;
          font-size:0.9rem;transition:all 0.2s;opacity:0.4;" disabled>
          ← Back
        </button>
        <button id="escort-next-btn" aria-label="Next step" style="
          flex:2;background:#00C49A;border:none;
          border-radius:12px;padding:14px;
          color:#000;font-weight:700;cursor:pointer;
          font-size:0.9rem;transition:all 0.2s;">
          Next Step →
        </button>
      </div>
    </div>

    <style>
      @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
    </style>
  </div>`;
}

function renderDuring() {
  const density = currentDensities;
  const nudgeType = getNudgeType();

  return `
  <div class="fade-in" style="padding:16px;display:flex;flex-direction:column;gap:12px;">

    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding: 4px 0;">
      <div>
        <h1 style="font-family:'Space Grotesk',sans-serif;font-size:1.2rem;
          font-weight:700;color:var(--text-primary);">Live Stadium 🏟️</h1>
        <div style="font-size:0.78rem;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
          NMS · Match in progress 
          <span id="att-global-density" style="padding:2px 6px;border-radius:12px;font-size:0.65rem;font-weight:700;background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);">
            CALCULATING...
          </span>
        </div>
      </div>
      <div style="
        display:flex;align-items:center;gap:6px;
        background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.15);
        border-radius:12px;padding:5px 10px;">
        <span style="width:6px;height:6px;border-radius:50%;background:var(--red);
          animation:pulse 1.5s ease-in-out infinite;display:inline-block;"></span>
        <span style="font-size:0.72rem;color:var(--red);font-weight:600;">LIVE</span>
      </div>
    </div>

    <!-- Smart nudge (conditional) -->
    ${nudgeShown ? '' : nudgeType ? `
    <div id="smart-nudge" style="
      background:rgba(255,209,102,0.1);border:1px solid rgba(255,209,102,0.3);
      border-radius:16px;padding:16px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
        <div>
          <div style="font-size:0.72rem;font-weight:600;color:var(--yellow);
            text-transform:uppercase;margin-bottom:6px;">🕐 Smart Nudge</div>
          <p style="font-size:0.88rem;color:var(--text-primary);line-height:1.5;margin:0;">
            ${nudgeType === 'break'
              ? 'Innings break in 5 min! Head to food stalls now — queues are 3× shorter right now.'
              : 'Match ending soon! Consider leaving now via Gate ' + getRecommendedGate(getSectionFromAnswers(), currentDensities).gate + ' for the smoothest exit.'}
          </p>
        </div>
        <button onclick="document.getElementById('smart-nudge')?.remove();window._nudgeShown=true;" style="
          background:none;border:none;color:var(--text-muted);
          font-size:1rem;cursor:pointer;flex-shrink:0;padding:2px;">✕</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button onclick="window._attScreen('escort')" style="
          background:var(--yellow);color:#000;border:none;
          border-radius:8px;padding:8px 16px;font-size:0.82rem;
          font-weight:600;cursor:pointer;">Guide Me</button>
        <button onclick="document.getElementById('smart-nudge')?.remove();" style="
          background:none;border:1px solid var(--border);
          border-radius:8px;padding:8px 16px;font-size:0.82rem;
          color:var(--text-secondary);cursor:pointer;">Later</button>
      </div>
    </div>` : ''}

    <!-- Nudge from Firebase -->
    <div id="during-nudge" style="display:none;
      background:rgba(0,196,154,0.08);border:1px solid rgba(0,196,154,0.2);
      border-radius:14px;padding:14px;">
      <div style="font-size:0.72rem;color:#00C49A;font-weight:600;margin-bottom:4px;">
        📲 From Control Room</div>
      <div id="during-nudge-text" style="font-size:0.88rem;color:var(--text-primary);"></div>
    </div>

    <!-- Zone Status -->
    <div style="background:var(--bg-card);border:1px solid var(--border);
      border-radius:16px;padding:16px;">
      <div style="font-size:0.72rem;font-weight:600;letter-spacing:0.08em;
        color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;">
        📡 Live Zones</div>
      <div id="during-zone-strip">${zoneStrip(density)}</div>
    </div>

    <!-- Mini map container -->
    <div style="background:var(--bg-card);border:1px solid var(--border);
      border-radius:16px;overflow:hidden;position:relative;">
      <div id="during-map" style="width:100%;height:200px;"></div>
    </div>

    <!-- Nearest Safe Exit (New Feature) -->
    <div style="background:rgba(0,196,154,0.05);border:1px solid rgba(0,196,154,0.3);
      border-radius:16px;padding:16px;">
      <div style="font-size:0.72rem;font-weight:600;letter-spacing:0.08em;
        color:#00C49A;text-transform:uppercase;margin-bottom:8px;">
        🛡️ Nearest Safe Exit</div>
      <div id="safe-exit-info" style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:1rem;color:var(--text-primary);font-weight:700;">
          Gate <span id="safe-gate-label">-</span>
        </div>
        <div style="font-size:0.85rem;color:var(--text-secondary);">
          Est. <span id="safe-time-label">-</span> min
        </div>
      </div>
    </div>

    <!-- Exit button -->
    <div style="display:flex; gap:10px;">
      <button onclick="window._attScreen('exit')" style="
        flex:1;background:none;border:1px solid var(--border-accent);
        border-radius:12px;padding:14px;
        color:#00C49A;font-size:0.9rem;cursor:pointer;
        font-weight:600;transition:all 0.2s;">
        🚪 Plan My Exit
      </button>
      <button onclick="localStorage.setItem('ef_start_zone', '${getSectionFromAnswers()}'); window.location.href='/attendee-navigation.html';" style="
        flex:1;background:#00C49A;border:none;
        border-radius:12px;padding:14px;
        color:#000;font-size:0.9rem;cursor:pointer;
        font-weight:700;transition:all 0.2s;">
        🧭 Navigation
      </button>
    </div>
  </div>
  <style>
    @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
  </style>`;
}

function renderExit() {
  const section = getSectionFromAnswers();
  const options = getExitPlan(section, answers.transport, currentDensities);
  let selected = 'now';

  return `
  <div class="fade-in" style="padding:16px;display:flex;flex-direction:column;gap:12px;">
    <div style="display:flex;align-items:center;gap:12px;padding:4px 0 8px;">
      <button onclick="window._attBack()" style="
        background:var(--bg-card);border:1px solid var(--border);
        border-radius:8px;width:34px;height:34px;
        color:var(--text-secondary);cursor:pointer;
        display:flex;align-items:center;justify-content:center;">←</button>
      <h1 style="font-family:'Space Grotesk',sans-serif;
        font-size:1.2rem;font-weight:700;color:var(--text-primary);">Your Exit Plan 🚪</h1>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;" id="exit-options">
      ${options.map((opt, i) => {
        const s = getZoneStatus(opt.density);
        const isRec = i === 0 && opt.density < 0.7;
        return `
          <div class="exit-opt" data-id="${opt.id}" style="
            background:${i === 0 ? 'rgba(0,196,154,0.05)' : 'var(--bg-card)'};
            border:${i === 0 ? '1px solid rgba(0,196,154,0.3)' : '1px solid var(--border)'};
            border-radius:16px;padding:18px;cursor:pointer;transition:all 0.2s;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;">
              <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                  <span style="font-family:'Space Grotesk',sans-serif;
                    font-weight:700;font-size:0.95rem;color:var(--text-primary);">
                    ${opt.label}</span>
                  ${isRec ? `<span style="background:rgba(0,196,154,0.12);
                    border:1px solid rgba(0,196,154,0.25);
                    color:#00C49A;border-radius:20px;padding:2px 8px;
                    font-size:0.7rem;font-weight:600;">Recommended</span>` : ''}
                </div>
                <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">
                  ${opt.note}</div>
                <div style="display:flex;gap:8px;align-items:center;">
                  <span class="pill pill-${s}">
                    ${getStatusEmoji(s)} ${Math.round(opt.density * 100)}% crowd
                  </span>
                  <span style="font-size:0.8rem;color:var(--text-muted);">
                    ~${opt.eta} min · Gate ${opt.gate}
                  </span>
                </div>
              </div>
              <div class="exit-radio" data-id="${opt.id}" style="
                width:20px;height:20px;border-radius:50%;flex-shrink:0;
                border:2px solid ${i === 0 ? '#00C49A' : 'rgba(255,255,255,0.15)'};
                background:${i === 0 ? '#00C49A' : 'transparent'};margin-left:12px;
                margin-top:2px;"></div>
            </div>
          </div>`;
      }).join('')}
    </div>

    <button id="exit-start-btn" style="
      background:#00C49A;color:#000;border:none;border-radius:12px;
      padding:16px;font-family:'Space Grotesk',sans-serif;
      font-weight:700;font-size:0.95rem;cursor:pointer;
      transition:all 0.2s;margin-top:4px;">
      🚪 Start Exit Guide
    </button>
  </div>`;
}

function renderFeedback() {
  let starRating = 0;
  let selectedChips = new Set();
  let helpfulness = '';

  return `
  <div class="fade-in" style="padding:20px 16px;display:flex;flex-direction:column;gap:20px;">
    <div style="text-align:center;padding:16px 0 8px;">
      <div style="font-size:2.5rem;margin-bottom:12px;">🏏</div>
      <h1 style="font-family:'Space Grotesk',sans-serif;
        font-size:1.3rem;font-weight:700;color:var(--text-primary);">How was today?</h1>
      <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:4px;">
        Help us improve EventFlow for everyone</p>
    </div>

    <!-- Star Rating -->
    <div style="background:var(--bg-card);border:1px solid var(--border);
      border-radius:16px;padding:18px;text-align:center;">
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px;">
        Rate your experience</div>
      <div style="display:flex;justify-content:center;gap:12px;" id="star-row">
        ${[1,2,3,4,5].map(n => `
          <button id="star-${n}" onclick="window._fbStar(${n})"
            style="background:none;border:none;font-size:2rem;cursor:pointer;
            transition:transform 0.15s;opacity:0.4;">⭐</button>`).join('')}
      </div>
    </div>

    <!-- Aspect chips -->
    <div style="background:var(--bg-card);border:1px solid var(--border);
      border-radius:16px;padding:16px;">
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:10px;">
        What went well?</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;" id="chip-row">
        ${['Entry','Finding Seat','Food','Restrooms','Exit','Navigation','All Good! 🎉'].map(c => `
          <button class="fb-chip" data-chip="${c}" onclick="window._fbChip('${c}', this)"
            style="padding:7px 14px;border-radius:20px;font-size:0.8rem;
            border:1px solid var(--border);background:var(--bg-card2);
            color:var(--text-secondary);cursor:pointer;transition:all 0.2s;">${c}</button>
        `).join('')}
      </div>
    </div>

    <!-- Helpfulness -->
    <div style="background:var(--bg-card);border:1px solid var(--border);
      border-radius:16px;padding:16px;">
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:10px;">
        Was EventFlow helpful?</div>
      <div style="display:flex;gap:8px;">
        ${['Very 😍','Somewhat 😊','Not Really 😐'].map(h => `
          <button class="helpfulness-btn" data-h="${h}" onclick="window._fbHelp('${h}', this)"
            style="flex:1;padding:10px 4px;border-radius:10px;font-size:0.8rem;
            border:1px solid var(--border);background:var(--bg-card2);
            color:var(--text-secondary);cursor:pointer;transition:all 0.2s;">${h}</button>
        `).join('')}
      </div>
    </div>

    <!-- Submit -->
    <button id="fb-submit-btn" style="
      background:var(--green);color:#000;border:none;border-radius:12px;
      padding:16px;font-family:'Space Grotesk',sans-serif;
      font-weight:700;font-size:0.95rem;cursor:pointer;transition:all 0.2s;">
      Submit Feedback ✓
    </button>
  </div>`;
}

function renderThankYou() {
  return `
  <div class="fade-in" style="
    min-height:100vh;background:var(--bg-deep);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:2rem;text-align:center;gap:20px;">
    <div style="font-size:4rem;animation:bounceIn 0.5s ease;">🏏</div>
    <h1 style="font-family:'Space Grotesk',sans-serif;
      font-size:1.5rem;font-weight:700;color:var(--text-primary);">
      Thank you! See you next match</h1>
    <p style="color:var(--text-secondary);max-width:280px;line-height:1.6;">
      Your feedback helps us improve EventFlow for 132,000 fans at NMS.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
      ${['⭐','🏏','🎟️','🟢','🎉','✨','🎊'].map(e =>
        `<span style="font-size:1.5rem;animation:confettiFall ${1.5+Math.random()*2}s ease forwards;
          animation-delay:${Math.random()*0.5}s;display:inline-block;">${e}</span>`
      ).join('')}
    </div>
    <button onclick="window.location.replace('/')" style="
      background:var(--green);color:#000;border:none;
      border-radius:12px;padding:14px 28px;
      font-family:'Space Grotesk',sans-serif;
      font-weight:700;cursor:pointer;margin-top:8px;">
      Back to Home
    </button>
    <style>
      @keyframes bounceIn {
        0%   { transform:scale(0); }
        60%  { transform:scale(1.2); }
        100% { transform:scale(1); }
      }
      @keyframes confettiFall {
        from { transform:translateY(0) rotate(0deg);opacity:1; }
        to   { transform:translateY(60px) rotate(360deg);opacity:0; }
      }
    </style>
  </div>`;
}

// ─── SCREEN SWITCHER ──────────────────────────────────────────────────────
function showScreen(name) {
  screen = name;
  const root = document.getElementById('attendee-screen');
  if (!root) return;

  let html = '';
  if (name === 'intake')    html = renderIntake();
  else if (name === 'plan') html = renderPlan();
  else if (name === 'escort') html = renderEscort('arrival');
  else if (name === 'escort-exit') html = renderEscort('exit');
  else if (name === 'during') html = renderDuring();
  else if (name === 'exit')  html = renderExit();
  else if (name === 'feedback') html = renderFeedback();
  else if (name === 'thanks') html = renderThankYou();

  root.innerHTML = html;
  root.scrollTop = 0;
  attachScreenListeners(name);
}

// ─── SCREEN EVENT LISTENERS ───────────────────────────────────────────────
function attachScreenListeners(name) {
  if (name === 'intake') {
    // Option selection
    document.querySelectorAll('.intake-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        const val = btn.dataset.val;
        answers[qid] = val;

        // Enable next/done button
        const nextBtn = document.getElementById('intake-next-btn') || document.getElementById('intake-done-btn');
        if (nextBtn) { nextBtn.disabled = false; nextBtn.style.opacity = '1'; }

        // Re-render to show selection
        showScreen('intake');
      });
    });

    document.getElementById('intake-next-btn')?.addEventListener('click', () => {
      // Skip parking if not car
      const showParking = answers.transport === 'car';
      const filtered = INTAKE_QUESTIONS.filter(q => q.id !== 'parking' || showParking);
      if (intakeStep + 1 < filtered.length) {
        intakeStep++;
        showScreen('intake');
      }
    });

    document.getElementById('intake-done-btn')?.addEventListener('click', async () => {
      const uid = localStorage.getItem('ef_uid') || 'anon';
      try { await saveAttendeeData(uid, { ...answers, completedAt: Date.now() }); } catch (e) {}
      intakeStep = 0;
      currentDensities = getZoneDensity();
      showScreen('plan');
    });
  }

  if (name === 'plan') {
    currentDensities = getZoneDensity();
    document.getElementById('plan-estate-btn')?.addEventListener('click', () => showScreen('during'));
    document.getElementById('plan-escort-btn')?.addEventListener('click', () => showScreen('escort'));
    document.getElementById('plan-exit-btn')?.addEventListener('click', () => showScreen('exit'));
  }

  if (name === 'escort') attachEscortListeners(4, 'during');
  if (name === 'escort-exit') attachEscortListeners(4, 'feedback');

  if (name === 'during') {
    // Init mini map with a layout delay so bounds calculate properly
    setTimeout(() => { if (document.getElementById('during-map')) initDuringMap(); }, 150);
    // Listen for nudges
    const unNudge = listenNudges((nudges) => {
      if (nudges.length > 0) {
        const latest = nudges[0];
        const el = document.getElementById('during-nudge');
        const txt = document.getElementById('during-nudge-text');
        if (el && txt) {
          txt.textContent = latest.message;
          el.style.display = 'block';
        }
      }
    });
    cleanupFns.push(unNudge);
  }

  if (name === 'exit') {
    // Select radio
    document.querySelectorAll('.exit-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const id = opt.dataset.id;
        document.querySelectorAll('.exit-opt').forEach(o => {
          o.style.borderColor = 'var(--border)';
          o.style.background = 'var(--bg-card)';
          const radio = o.querySelector('.exit-radio');
          if (radio) { radio.style.background = 'transparent'; radio.style.borderColor = 'rgba(255,255,255,0.15)'; }
        });
        opt.style.borderColor = 'rgba(0,196,154,0.4)';
        opt.style.background = 'rgba(0,196,154,0.04)';
        const radio = opt.querySelector('.exit-radio');
        if (radio) { radio.style.background = '#00C49A'; radio.style.borderColor = '#00C49A'; }
      });
    });
    document.getElementById('exit-start-btn')?.addEventListener('click', () => showScreen('escort-exit'));
  }

  if (name === 'feedback') {
    window._fbStar = (n) => {
      for (let i = 1; i <= 5; i++) {
        const el = document.getElementById('star-' + i);
        if (el) el.style.opacity = i <= n ? '1' : '0.25';
      }
      window._fbStarVal = n;
    };
    window._fbChip = (chip, el) => {
      if (el.style.background === 'rgba(0,196,154,0.12)') {
        el.style.background = 'var(--bg-card2)';
        el.style.color = 'var(--text-secondary)';
        el.style.borderColor = 'var(--border)';
      } else {
        el.style.background = 'rgba(0,196,154,0.12)';
        el.style.color = '#00C49A';
        el.style.borderColor = 'rgba(0,196,154,0.3)';
      }
    };
    window._fbHelp = (h, el) => {
      document.querySelectorAll('.helpfulness-btn').forEach(b => {
        b.style.background = 'var(--bg-card2)';
        b.style.color = 'var(--text-secondary)';
        b.style.borderColor = 'var(--border)';
      });
      el.style.background = 'rgba(0,196,154,0.1)';
      el.style.color = '#00C49A';
      el.style.borderColor = 'rgba(0,196,154,0.3)';
      window._fbHelpVal = h;
    };

    document.getElementById('fb-submit-btn')?.addEventListener('click', async () => {
      const chips = [...document.querySelectorAll('.fb-chip')]
        .filter(b => b.style.color === 'rgb(0, 196, 154)').map(b => b.dataset.chip);
      try {
        await saveFeedback({
          rating: window._fbStarVal || 0,
          aspects: chips,
          helpfulness: window._fbHelpVal || '',
          uid: localStorage.getItem('ef_uid') || 'anon'
        });
      } catch (e) {}
      showScreen('thanks');
    });
  }
}

function attachEscortListeners(totalSteps, nextScreen) {
  let step = 0;
  const steps = [
    { icon: '🏃', status: 'clear' },
    { icon: '🎟️', status: 'clear' },
    { icon: '🔐', status: 'busy' },
    { icon: '💺', status: 'clear' }
  ];

  const updateStep = (n) => {
    step = n;
    const stepEl = document.getElementById('escort-step-num');
    const iconEl = document.getElementById('escort-icon');
    const statusEl = document.getElementById('escort-path-status');
    const prevBtn = document.getElementById('escort-prev-btn');
    const nextBtn = document.getElementById('escort-next-btn');

    if (stepEl) stepEl.textContent = `Step ${n + 1} of ${totalSteps}`;

    // Dots
    document.querySelectorAll('[class^="escort-dot"]').forEach((d, i) => {
      d.style.width = i === n ? '24px' : '8px';
      d.style.background = i <= n ? '#00C49A' : 'var(--border)';
    });

    if (iconEl) iconEl.textContent = steps[n]?.icon || '✅';

    const isBusy = (steps[n]?.status === 'busy');
    if (statusEl) {
      statusEl.style.background = isBusy ? 'rgba(255,209,102,0.08)' : 'rgba(0,196,154,0.08)';
      statusEl.style.borderColor = isBusy ? 'rgba(255,209,102,0.2)' : 'rgba(0,196,154,0.2)';
      statusEl.innerHTML = `
        <span style="width:6px;height:6px;border-radius:50%;
          background:${isBusy ? '#FFD166' : '#00C49A'};display:inline-block;"></span>
        <span style="font-size:0.78rem;color:${isBusy ? '#FFD166' : '#00C49A'};">
          ${isBusy ? 'Quieter route available →' : 'Path is clear'}</span>`;
    }

    if (prevBtn) { prevBtn.disabled = n === 0; prevBtn.style.opacity = n === 0 ? '0.4' : '1'; }
    if (nextBtn) {
      nextBtn.textContent = n === totalSteps - 1 ? "I've Arrived! ✓" : "Next Step →";
    }
  };

  document.getElementById('escort-prev-btn')?.addEventListener('click', () => {
    if (step > 0) updateStep(step - 1);
  });

  document.getElementById('escort-next-btn')?.addEventListener('click', () => {
    if (step < totalSteps - 1) {
      updateStep(step + 1);
    } else {
      showScreen(nextScreen);
    }
  });
}

function initDuringMap() {
  const mapEl = document.getElementById('during-map');
  if (!mapEl || !window.google?.maps) return;
  const miniMap = new window.google.maps.Map(mapEl, {
    center: { lat: 23.0921, lng: 72.5952 },
    zoom: 16,
    mapTypeId: 'satellite',
    disableDefaultUI: true,
    gestureHandling: 'none'
  });
  // Simple zone color overlays
  const BOUNDS = {
    north: { n: 23.0943, s: 23.0928, e: 72.5967, w: 72.5938 },
    south: { n: 23.0910, s: 23.0896, e: 72.5967, w: 72.5938 },
    east:  { n: 23.0928, s: 23.0910, e: 72.5978, w: 72.5963 },
    west:  { n: 23.0928, s: 23.0910, e: 72.5942, w: 72.5927 }
  };
  Object.entries(BOUNDS).forEach(([id, b]) => {
    const d = currentDensities[id] || 0;
    const color = d >= 0.8 ? '#FF4757' : d >= 0.6 ? '#FFD166' : '#00C49A';
    new window.google.maps.Rectangle({
      bounds: { north: b.n, south: b.s, east: b.e, west: b.w },
      fillColor: color, fillOpacity: 0.3,
      strokeColor: color, strokeOpacity: 0.5, strokeWeight: 1,
      map: miniMap
    });
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────
export async function init(navigate) {
  // Silent anonymous authentication to establish Firebase database write permissions
  try {
    await loginAnonymously();
  } catch (e) {
    console.warn("Silent auth failed:", e);
  }

  // Reset state
  screen = 'intake'; intakeStep = 0; answers = {}; currentDensities = {}; nudgeShown = false;

  // Global nav helpers
  window._attBack = () => {
    if (screen === 'intake' && intakeStep > 0) { intakeStep--; showScreen('intake'); }
    else if (screen === 'intake') navigate('/');
    else if (screen === 'plan') { intakeStep = INTAKE_QUESTIONS.length - 1; showScreen('intake'); }
    else if (screen === 'escort') showScreen('plan');
    else if (screen === 'during') showScreen('plan');
    else if (screen === 'exit') showScreen('during');
    else if (screen === 'escort-exit') showScreen('exit');
    else if (screen === 'feedback') showScreen('exit');
  };

  window._attScreen = (name) => showScreen(name);
  window._nudgeShown = false;

  // Start with intake
  showScreen('intake');

  // Live zone listener
  const unZones = listenZones((zones) => {
    Object.entries(zones).forEach(([id, z]) => {
      if (z.density !== undefined) currentDensities[id] = z.density;
    });
    // Update zone strips if visible
    const strip = document.getElementById('plan-zone-strip') || document.getElementById('during-zone-strip');
    if (strip) strip.innerHTML = zoneStrip(currentDensities);
  });
  cleanupFns.push(unZones);

  // Init AI chat
  initAIChat(() => currentDensities);

  function updateGlobalDensityBadge() {
    const el = document.getElementById('att-global-density');
    if(!el || !currentDensities) return;
    
    const enrichedZones = Object.entries(currentDensities).map(([id, d]) => {
      const zDef = ZONES[id] || {};
      return {
        id,
        capacity: zDef.cap || 10000,
        currentFans: Math.round(d * (zDef.cap || 10000))
      };
    });
    
    const avgDens = calculateAverageDensity(enrichedZones);
    let level = 'Low';
    let color = '#00C49A';
    if(avgDens > 85) { level = 'High'; color = '#FF4757'; }
    else if(avgDens > 60) { level = 'Medium'; color = '#FFD166'; }

    el.textContent = `Crowd: ${level}`;
    el.style.color = color;
    el.style.border = `1px solid ${color}`;
    el.style.background = `${color}1A`;
  }

  // ── Emergency Listener ──
  let lastEmergency = { active: false };
  const unEmerg = listenEmergency((state) => {
    lastEmergency = state;
    let banner = document.getElementById('att-emerg-banner');
    if (state.active) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'att-emerg-banner';
        banner.style = `
          position:fixed; bottom:0; left:0; right:0; z-index:9999;
          background:#FF4757; color:#fff; padding:16px;
          border-top:2px solid rgba(255,255,255,0.3);
          box-shadow:0 -10px 30px rgba(0,0,0,0.5);
          display:flex; flex-direction:column; gap:10px;
          animation: slideUp 0.3s ease-out;
        `;
        document.body.appendChild(banner);
      }
      banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:1.5rem;">🚨</span>
          <div style="flex:1;">
            <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1rem;">EMERGENCY ALERT</div>
            <div style="font-size:0.85rem;opacity:0.9;">${state.type} in ${ZONES[state.zone]?.name || state.zone}. Follow instructions.</div>
          </div>
        </div>
        <button id="att-safe-exit-btn" style="
          width:100%; padding:12px; background:#fff; color:#FF4757;
          border:none; border-radius:10px; font-weight:700; cursor:pointer;">
          VIEW SAFE EXIT ROUTE →
        </button>
      `;
      document.getElementById('att-safe-exit-btn')?.addEventListener('click', () => {
        showScreen('exit');
      });
    } else {
      if (banner) banner.remove();
    }
    updateSafeExitUI();
  });
  cleanupFns.push(unEmerg);

  function updateSafeExitUI() {
    const { recommendedGate, rankedList } = rankBestExit(ZONES, currentDensities, lastEmergency.active ? lastEmergency.zone : null);
    const gateLabel = document.getElementById('safe-gate-label');
    const timeLabel = document.getElementById('safe-time-label');
    if (gateLabel && timeLabel && recommendedGate) {
      const best = rankedList.find(r => r.id === recommendedGate);
      gateLabel.textContent = ZONES[recommendedGate]?.gate || '-';
      timeLabel.textContent = best ? best.time : '-';
    }
  }

  function updatePolling() {
      updateSafeExitUI();
      updateGlobalDensityBadge();
  }

  // Polling for UI
  const evacInt = setInterval(updatePolling, 5000);
  cleanupFns.push(() => clearInterval(evacInt));
  
  // Initial immediate call
  updatePolling();

  return () => {
    cleanupFns.forEach(fn => { try { fn(); } catch(e) {} });
    cleanupFns = [];
    delete window._attBack;
    delete window._attScreen;
    delete window._setLang;
  };
}

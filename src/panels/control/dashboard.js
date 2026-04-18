/**
 * EventFlow V2 — Control Room Dashboard
 * Desktop 3-column layout: Staff List | NMS Map | Actions + AI
 */
import { getCurrentUser, isControlUser, logout } from '/src/auth.js';
import {
  writeZone, pushInstruction, pushNudge,
  listenZones, listenAllStaff, listenEmergency, setEmergencyStatus,
  pushAnalyticsEvent, pushPerformanceMetric, invokeCloudWorkflow
} from '/src/firebase.js';
import {
  simulateTick, setTick, getTick, getTickLabel,
  getZoneDensity, getZoneStatus, ZONES
} from '/src/simulation.js';
import { getAIInsights } from '/src/gemini.js';
import { predictFutureDensity, detectSurgeRisk } from '/src/predictiveEngine.js';
import { rankBestExit } from '/src/evacuationEngine.js';
import { calculateDensityColor } from '/src/heatmapEngine.js';
import { calculateTotalVisitors, calculateAverageDensity, findPeakZone, calculateGateUtilization, estimateAverageWaitTime } from '/src/analyticsEngine.js';
import { calculateEvacuationRoutes, getEmergencyMessage } from '/src/emergencyEngine.js';
import { buildBigQueryEvent, classifySurgeRisk, invokeCloudEndpoint } from '/src/cloudServices.js';

// NMS approximate bounding coords for each zone overlay
const ZONE_BOUNDS = {
  north:   { n: 23.0945, s: 23.0930, e: 72.6000, w: 72.5970 },
  south:   { n: 23.0910, s: 23.0895, e: 72.6000, w: 72.5970 },
  east:    { n: 23.0932, s: 23.0910, e: 72.6015, w: 72.5995 },
  west:    { n: 23.0932, s: 23.0910, e: 72.5975, w: 72.5955 },
  concN:   { n: 23.0938, s: 23.0930, e: 72.5995, w: 72.5975 },
  concS:   { n: 23.0918, s: 23.0910, e: 72.5995, w: 72.5975 },
  gates:   { n: 23.0945, s: 23.0940, e: 72.5990, w: 72.5980 },
  parking: { n: 23.0965, s: 23.0950, e: 72.6025, w: 72.5955 }
};

let mapInstance = null;
let zoneRectangles = {};
let simInterval = null;
let aiInterval = null;
let nudgesSent = 0;
let cleanupFirebase = [];

export function render() {
  return `
  <div style="min-height:100vh;background:var(--bg-deep);display:flex;flex-direction:column;">

    <!-- TOP BAR -->
    <div style="
      display:flex;align-items:center;gap:16px;
      padding:10px 20px;
      background:var(--bg-card);border-bottom:1px solid var(--border);
      position:sticky;top:0;z-index:100;">
      <div style="display:flex;align-items:center;gap:10px;flex:1;">
        <div style="
          font-family:'Space Grotesk',sans-serif;
          font-size:1rem;font-weight:700;color:var(--text-primary);">
          EventFlow <span style="color:var(--red);">COMMAND</span>
        </div>
        <div style="
          display:flex;align-items:center;gap:6px;
          background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.2);
          border-radius:20px;padding:4px 10px;">
          <span style="width:6px;height:6px;border-radius:50%;
            background:var(--red);animation:pulse 1.5s ease-in-out infinite;
            display:inline-block;"></span>
          <span style="font-size:0.72rem;color:var(--red);font-weight:600;">LIVE · NMS</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:20px;">
        <div style="text-align:center;">
          <div id="ctrl-total" style="
            font-family:'Space Grotesk',sans-serif;font-weight:700;
            font-size:1.1rem;color:var(--text-primary);">—</div>
          <div style="font-size:0.68rem;color:var(--text-muted);">inside</div>
        </div>
        <div style="text-align:center;">
          <div id="ctrl-time" style="
            font-family:'Space Grotesk',sans-serif;font-weight:600;
            font-size:0.9rem;color:var(--text-secondary);">18:00</div>
          <div style="font-size:0.68rem;color:var(--text-muted);">match time</div>
        </div>
        <div style="text-align:center;">
          <div id="ctrl-staff-count" style="
            font-family:'Space Grotesk',sans-serif;font-weight:700;
            font-size:1.1rem;color:#00C49A);">0</div>
          <div style="font-size:0.68rem;color:var(--text-muted);">staff online</div>
        </div>
        <button id="ctrl-logout-btn" aria-label="Log out of EventFlow" style="
          background:none;border:1px solid var(--border);
          border-radius:8px;color:var(--text-secondary);
          font-size:0.78rem;padding:6px 12px;cursor:pointer;">
          Log Out
        </button>
      </div>
    </div>

    <!-- 3-COLUMN LAYOUT -->
    <div style="
      display:grid;grid-template-columns:230px 1fr 280px;
      gap:0;flex:1;overflow:hidden;height:calc(100vh - 53px);">

      <!-- LEFT: Staff List -->
      <div style="
        background:var(--bg-card);border-right:1px solid var(--border);
        overflow-y:auto;padding:14px;">
        <div style="
          font-size:0.7rem;font-weight:600;letter-spacing:0.08em;
          color:var(--text-muted);text-transform:uppercase;margin-bottom:12px;">
          Staff Online</div>
        <div id="staff-list" style="display:flex;flex-direction:column;gap:6px;" aria-live="polite" aria-label="Live staff status list">
          <div style="color:var(--text-muted);font-size:0.82rem;">Waiting for staff…</div>
        </div>
      </div>

      <!-- CENTER: Map + Scrubber -->
      <div style="
        display:flex;flex-direction:column;overflow:hidden;
        background:var(--bg-deep);">

        <!-- Map -->
        <div id="nms-map" style="flex:1;min-height:0;"></div>

        <!-- Simulation Scrubber -->
        <div style="
          padding:14px 20px;background:var(--bg-card);
          border-top:1px solid var(--border);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="font-size:0.75rem;color:var(--text-secondary);">
              ⚡ Simulation · T=<span id="ctrl-tick-label">0</span>min
              (<span id="ctrl-time-label">18:00</span>)
            </div>
            <div style="
              font-size:0.7rem;color:var(--text-muted);
              background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.15);
              border-radius:12px;padding:2px 8px;">Demo Mode</div>
          </div>
          <input type="range" id="ctrl-scrubber"
            min="0" max="480" value="0" step="1"
            style="
              width:100%;height:4px;appearance:none;
              background:linear-gradient(to right,#00C49A 0%,var(--border) 0%);
              border-radius:4px;outline:none;border:none;cursor:pointer;padding:0;" />
          <div style="display:flex;justify-content:space-between;margin-top:6px;">
            <span style="font-size:0.7rem;color:var(--text-muted);">18:00 Gates Open</span>
            <span style="font-size:0.7rem;color:var(--text-muted);">20:00 Match</span>
            <span style="font-size:0.7rem;color:var(--text-muted);">02:00 Empty</span>
          </div>
        </div>
      </div>

      <!-- RIGHT: Alerts + Actions + AI -->
      <div style="
        background:var(--bg-card);border-left:1px solid var(--border);
        overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px;">

        <!-- Heatmap Toggle (New) -->
        <div style="background:var(--bg-deep);border:1px solid var(--border);
          border-radius:12px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.72rem;font-weight:700;color:var(--text-secondary);">🔥 HEATMAP MODE</span>
          <label class="switch">
            <input type="checkbox" id="heatmap-toggle" checked>
            <span class="slider round"></span>
          </label>
        </div>

        <!-- Emergency Action -->
        <div style="border:1px solid rgba(255,71,87,0.3);background:rgba(255,71,87,0.05);
          border-radius:12px;padding:12px;text-align:center;">
          <button id="ctrl-emergency-btn" aria-label="Activate emergency evacuation mode" style="
            width:100%;padding:12px;background:var(--red);color:#fff;
            border:none;border-radius:8px;font-weight:700;
            display:flex;align-items:center;justify-content:center;gap:8px;
            cursor:pointer;transition:all 0.2s;">
            🚨 EMERGENCY MODE
          </button>
          <div id="emerg-status-badge" style="display:none;margin-top:8px;font-size:0.75rem;font-weight:700;color:var(--red);">
            ACTIVE: <span id="emerg-type-val">FIRE</span> @ <span id="emerg-zone-val">NORTH</span>
          </div>
        </div>

        <!-- Evacuation Estimates (New) -->
        <div style="background:var(--bg-card2);border:1px solid var(--border);
          border-radius:12px;padding:12px;">
          <div style="font-size:0.7rem;font-weight:600;letter-spacing:0.08em;
            color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;">
            🚪 Evacuation Estimates</div>
          <div id="evacuation-list" style="display:flex;flex-direction:column;gap:8px;">
            <div style="color:var(--text-muted);font-size:0.75rem;">Initializing estimates…</div>
          </div>
        </div>

        <!-- Live Alerts -->
        <div>
          <div style="font-size:0.7rem;font-weight:600;letter-spacing:0.08em;
            color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">
            🚨 Live Alerts</div>
          <div id="alert-list" style="display:flex;flex-direction:column;gap:6px;"
            aria-live="polite" aria-label="Live zone status updates">
            <div style="color:var(--text-muted);font-size:0.8rem;">All zones normal</div>
          </div>
        </div>

        <div style="height:1px;background:var(--border);"></div>

        <!-- Analytics Dashboard (New) -->
        <div>
          <div style="font-size:0.7rem;font-weight:600;letter-spacing:0.08em;
            color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;"
            aria-label="Analytics Dashboard">
            📊 Analytics Dashboard</div>
          <div style="display:grid;grid-template-columns:1fr;gap:8px;">
            <!-- CARD 1: Total Visitors -->
            <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;padding:10px;" aria-label="Total visitors inside stadium">
               <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:2px;">👥 Total Visitors Inside</div>
               <div id="analytics-total" style="font-size:1.1rem;font-weight:700;color:var(--text-primary);">--</div>
            </div>
            <!-- CARD 2: Average Stadium Density -->
            <div id="analytics-avg-card" style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;padding:10px;" aria-label="Average stadium density">
               <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:2px;">📈 Average Stadium Density</div>
               <div id="analytics-avg" style="font-size:1.1rem;font-weight:700;color:var(--text-primary);">--%</div>
            </div>
            <!-- CARD 3: Peak Congestion Zone -->
             <div id="analytics-peak-card" style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;padding:10px;" aria-label="Peak congestion zone">
               <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                 <div style="font-size:0.75rem;color:var(--text-secondary);">🔥 Peak Zone</div>
                 <div id="analytics-emerg-alert" style="font-size:0.65rem;font-weight:700;color:#FF4757;display:none;">🚨 EMERGENCY</div>
               </div>
               <div id="analytics-peak" style="font-size:0.95rem;font-weight:700;color:var(--text-primary);">--</div>
            </div>
            <!-- CARD 4: Gate Utilization -->
             <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;padding:10px;" aria-label="Gate Utilization">
               <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:6px;">🚪 Gate Utilization</div>
               <div id="analytics-gates" style="font-size:0.8rem;color:var(--text-primary);display:flex;flex-direction:column;gap:4px;">--</div>
            </div>
            <!-- CARD 5: Avg Wait Time -->
             <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;padding:10px;" aria-label="Average wait time">
               <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:2px;">⏱️ Estimated Average Wait</div>
               <div id="analytics-wait" style="font-size:1.1rem;font-weight:700;color:var(--text-primary);">-- min</div>
            </div>
          </div>
        </div>

        <div style="height:1px;background:var(--border);"></div>

        <div style="height:1px;background:var(--border);"></div>

        <!-- Heatmap Legend (New) -->
        <div>
          <div style="font-size:0.7rem;font-weight:600;letter-spacing:0.08em;
            color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">
            📊 Visualization Legend</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div style="display:flex;align-items:center;gap:6px;font-size:0.65rem;color:var(--text-secondary);">
              <div style="width:10px;height:10px;background:#3498DB;border-radius:2px;"></div> Low (0-30%)
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:0.65rem;color:var(--text-secondary);">
              <div style="width:10px;height:10px;background:#F1C40F;border-radius:2px;"></div> Med (31-60%)
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:0.65rem;color:var(--text-secondary);">
              <div style="width:10px;height:10px;background:#E74C3C;border-radius:2px;"></div> High (61-85%)
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:0.65rem;color:var(--text-secondary);">
              <div style="width:10px;height:10px;background:#C0392B;border-radius:2px;"></div> Crit (85%+)
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:0.65rem;color:var(--text-secondary);">
              <div style="width:10px;height:10px;background:#A29BFE;border-radius:2px;"></div> Prediction
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:0.65rem;color:var(--text-secondary);">
              <div style="width:10px;height:10px;background:#000000;border-radius:2px;"></div> Emergency
            </div>
          </div>
        </div>

        <!-- Instruction Dispatch -->
        <div>
          <div style="font-size:0.7rem;font-weight:600;letter-spacing:0.08em;
            color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">
            📡 Dispatch</div>

          <select id="ctrl-zone-sel" aria-label="Select target zone for dispatch" style="width:100%;margin-bottom:8px;font-size:0.85rem;">
            ${Object.entries(ZONES).map(([id, z]) =>
              `<option value="${id}">${z.name}</option>`).join('')}
          </select>

          <!-- Quick instruction buttons -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
            ${[
              ['Redirect gate', '🔀 Redirect'],
              ['Reduce entry', '🚫 Reduce'],
              ['Open backup gate', '🚪 Backup'],
              ['Medical team needed', '🚑 Medical']
            ].map(([msg, label]) => `
              <button class="quick-instr-btn" data-msg="${msg}"
                aria-label="Quick instruction: ${msg}" style="
                background:var(--bg-card2);border:1px solid var(--border);
                border-radius:8px;padding:8px 4px;font-size:0.75rem;
                color:var(--text-primary);cursor:pointer;transition:all 0.2s;">${label}</button>
            `).join('')}
          </div>

          <textarea id="ctrl-instr-text" aria-label="Custom instruction message for dispatch" placeholder="Custom instruction…" style="
            width:100%;height:60px;resize:none;margin-bottom:8px;
            font-size:0.85rem;"></textarea>

          <div style="display:flex;gap:6px;">
            <button id="ctrl-send-staff" aria-label="Send instruction to staff in selected zone" style="
              flex:1;background:var(--orange);color:#fff;border:none;
              border-radius:8px;padding:9px;font-weight:600;
              font-size:0.82rem;cursor:pointer;transition:all 0.2s;">
              📡 Staff
            </button>
            <button id="ctrl-send-nudge" aria-label="Broadcast nudge notification to all attendees" style="
              flex:1;background:rgba(0,196,154,0.12);color:#00C49A;
              border:1px solid rgba(0,196,154,0.25);
              border-radius:8px;padding:9px;font-weight:600;
              font-size:0.82rem;cursor:pointer;transition:all 0.2s;">
              📲 Nudge Fans
            </button>
          </div>
          <div id="ctrl-send-confirm" style="
            font-size:0.78rem;color:#00C49A;margin-top:6px;display:none;">
            ✓ Sent successfully</div>
        </div>

        <div style="height:1px;background:var(--border);"></div>

        <!-- AI Insights -->
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="font-size:0.7rem;font-weight:600;letter-spacing:0.08em;
              color:var(--text-muted);text-transform:uppercase;">🤖 AI Insights</div>
            <button id="ai-refresh-btn" aria-label="Refresh AI crowd insights" style="
              background:none;border:none;font-size:0.72rem;
              color:var(--text-muted);cursor:pointer;padding:2px 4px;">↻ Refresh</button>
          </div>
          <div id="ai-insights" style="display:flex;flex-direction:column;gap:6px;">
            <div style="color:var(--text-muted);font-size:0.8rem;">Loading AI insights…</div>
          </div>
        </div>

        <div style="height:1px;background:var(--border);"></div>

        <!-- Live Metrics -->
        <div>
          <div style="font-size:0.7rem;font-weight:600;letter-spacing:0.08em;
            color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">
            📊 Metrics</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="background:var(--bg-card2);border:1px solid var(--border);
              border-radius:10px;padding:10px;text-align:center;">
              <div id="metric-avg" style="font-family:'Space Grotesk',sans-serif;
                font-size:1.2rem;font-weight:700;color:var(--text-primary);">–%</div>
              <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px;">Avg Density</div>
            </div>
            <div style="background:var(--bg-card2);border:1px solid var(--border);
              border-radius:10px;padding:10px;text-align:center;">
              <div id="metric-nudges" style="font-family:'Space Grotesk',sans-serif;
                font-size:1.2rem;font-weight:700;color:#00C49A;">0</div>
              <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px;">Nudges Sent</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <style>
    @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
    #ctrl-scrubber::-webkit-slider-thumb {
      appearance:none;width:14px;height:14px;border-radius:50%;
      background:#00C49A;cursor:pointer;border:2px solid #060A10;
    }
    .quick-instr-btn:hover { border-color:rgba(255,107,53,0.4)!important;background:rgba(255,107,53,0.06)!important; }
    
    /* Emergency Modal Overlay */
    #emerg-modal-overlay {
      position:fixed;top:0;left:0;right:0;bottom:0;
      background:rgba(0,0,0,0.85);backdrop-filter:blur(4px);
      display:none;align-items:center;justify-content:center;z-index:1000;
    }
    .emerg-pulsing { animation: emerg-pulse 1s infinite alternate; }
    @keyframes emerg-pulse { from { opacity: 0.6; } to { opacity: 1; } }
  </style>
  
  <div id="emerg-modal-overlay" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="emerg-modal-title" aria-describedby="emerg-modal-desc" tabindex="-1">
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:24px;width:320px;box-shadow:0 20px 40px rgba(0,0,0,0.4);">
      <h3 id="emerg-modal-title" style="margin-top:0;color:var(--red);display:flex;align-items:center;gap:10px;">🚨 Activate Emergency</h3>
      <p id="emerg-modal-desc" style="font-size:0.8rem;color:var(--text-muted);margin-bottom:20px;">This will block the selected zone and immediately alert all staff and attendees.</p>
      
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:0.75rem;color:var(--text-secondary);margin-bottom:6px;">Type</label>
        <select id="emerg-type-sel" style="width:100%;padding:10px;background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);">
          <option value="FIRE">🔥 FIRE</option>
          <option value="SECURITY">👮 SECURITY THREAT</option>
          <option value="MEDICAL">🚑 MASS MEDICAL INCIDENT</option>
        </select>
      </div>
      
      <div style="margin-bottom:24px;">
        <label style="display:block;font-size:0.75rem;color:var(--text-secondary);margin-bottom:6px;">Blocked Zone</label>
        <select id="emerg-zone-sel" style="width:100%;padding:10px;background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);">
          ${Object.entries(ZONES).map(([id, z]) => `<option value="${id}">${z.name}</option>`).join('')}
        </select>
      </div>
      
      <div style="display:flex;gap:10px;">
        <button id="emerg-cancel" style="flex:1;padding:12px;background:transparent;border:1px solid var(--border);border-radius:8px;color:var(--text-secondary);cursor:pointer;">Cancel</button>
        <button id="emerg-confirm" style="flex:1;padding:12px;background:var(--red);border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">ACTIVATE</button>
      </div>
    </div>
  </div>`;
}

export async function init(navigate) {
  // ── Auth guard ──
  const user = await getCurrentUser();
  if (!user || !isControlUser(user)) { navigate('/control-login'); return; }

  let currentEmergency = { active: false };
  let densities = {}; // TASK 1: Declare shared densities object
  let heatmapEnabled = true; // Default ON
  let lastZoneSnapshotHash = '';

  // ── DOM refs ──
  const scrubber   = document.getElementById('ctrl-scrubber');
  const tickLabel  = document.getElementById('ctrl-tick-label');
  const timeLabel  = document.getElementById('ctrl-time-label');
  const totalEl    = document.getElementById('ctrl-total');
  const metricAvg  = document.getElementById('metric-avg');
  const metricNudges = document.getElementById('metric-nudges');
  const dashboardInitStart = performance.now();

  function throttle(fn, waitMs = 800) {
    let last = 0;
    let timeout = null;
    let queuedArgs = null;
    const run = () => {
      timeout = null;
      last = Date.now();
      fn(...(queuedArgs || []));
      queuedArgs = null;
    };
    return (...args) => {
      queuedArgs = args;
      const now = Date.now();
      const remaining = waitMs - (now - last);
      if (remaining <= 0) {
        if (timeout) clearTimeout(timeout);
        run();
      } else if (!timeout) {
        timeout = setTimeout(run, remaining);
      }
    };
  }

  const refreshLiveUI = throttle((liveDensities, predictions) => {
    updateMapOverlays(liveDensities, predictions);
    updateMetrics(liveDensities);
    renderAlerts(liveDensities);
    renderPredictiveAlerts(predictions);
    updateAnalyticsDashboard(liveDensities);
  }, 1000);

  // ── Helpers ──
  function getInsightColor(type) {
    if (type === 'warning') return { bg: 'rgba(255,71,87,0.08)', border: 'rgba(255,71,87,0.2)', text: '#FF4757' };
    if (type === 'action')  return { bg: 'rgba(255,107,53,0.08)', border: 'rgba(255,107,53,0.2)', text: '#FF6B35' };
    return { bg: 'rgba(0,196,154,0.06)', border: 'rgba(0,196,154,0.15)', text: '#00C49A' };
  }

  function renderAlerts(densities) {
    const alertEl = document.getElementById('alert-list');
    if (!alertEl) return;
    const critical = Object.entries(densities).filter(([, d]) => d > 0.8);
    if (critical.length === 0) {
      alertEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;">All zones normal ✓</div>';
      return;
    }
    alertEl.innerHTML = critical.map(([id, d]) => `
      <div style="
        background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.2);
        border-radius:10px;padding:10px 12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span style="font-size:0.78rem;font-weight:600;color:#FF4757;">
              🔴 ${ZONES[id]?.name || id}</span>
            <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:2px;">
              ${Math.round(d * 100)}% density</div>
          </div>
          <button class="dispatch-from-alert" data-zone="${id}" style="
            background:rgba(255,71,87,0.15);border:1px solid rgba(255,71,87,0.3);
            border-radius:6px;color:#FF4757;font-size:0.72rem;
            padding:4px 8px;cursor:pointer;">Dispatch</button>
        </div>
      </div>`).join('');

    document.querySelectorAll('.dispatch-from-alert').forEach(btn => {
      btn.addEventListener('click', () => {
        const zel = document.getElementById('ctrl-zone-sel');
        if (zel) zel.value = btn.dataset.zone;
        const txt = document.getElementById('ctrl-instr-text');
        if (txt) txt.value = 'Immediate crowd control needed — redirect to alternate gate';
      });
    });
  }

  function renderStaffList(staffData) {
    const el = document.getElementById('staff-list');
    if (!el) return;
    const entries = Object.entries(staffData);
    if (entries.length === 0) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;">No staff online</div>';
      document.getElementById('ctrl-staff-count').textContent = '0';
      return;
    }
    const online = entries.filter(([, s]) => s.online !== false);
    document.getElementById('ctrl-staff-count').textContent = online.length;
    el.innerHTML = entries.map(([uid, s]) => {
      const color = s.status === 'crowded' ? '#FF4757' : (s.status === 'clear' ? '#00C49A' : 'var(--text-muted)');
      const zone = ZONES[s.zone]?.name || s.zone || 'Unknown';
      const ago = s.updatedAt ? Math.round((Date.now() - s.updatedAt) / 60000) : '?';
      return `
        <button type="button" style="
          background:var(--bg-card2);border:1px solid var(--border);
          border-radius:10px;padding:10px 12px;cursor:pointer;transition:all 0.2s;
          width:100%;text-align:left;" class="staff-row-select"
          data-zone="${s.zone || 'north'}"
          title="Click to dispatch to ${zone}"
          aria-label="Select ${zone} for dispatch">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="width:7px;height:7px;border-radius:50%;
              background:${color};display:inline-block;flex-shrink:0;"></span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.8rem;color:var(--text-primary);
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${zone}</div>
              <div style="font-size:0.7rem;color:var(--text-muted);">
                ${s.status || 'offline'} · ${ago}m ago</div>
            </div>
          </div>
        </button>`;
    }).join('');
    el.querySelectorAll('.staff-row-select').forEach(btn => {
      btn.addEventListener('click', () => {
        const zel = document.getElementById('ctrl-zone-sel');
        if (zel) zel.value = btn.dataset.zone || 'north';
      });
    });
  }

  async function renderAIInsights(densities) {
    const el = document.getElementById('ai-insights');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;">⏳ Thinking…</div>';
    const result = await getAIInsights(densities);
    if (!result.insights || result.insights.length === 0) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;">No insights available</div>';
      return;
    }
    el.innerHTML = result.insights.map(ins => {
      const c = getInsightColor(ins.type);
      const icon = ins.type === 'warning' ? '⚠️' : (ins.type === 'action' ? '⚡' : 'ℹ️');
      return `
        <div style="
          background:${c.bg};border:1px solid ${c.border};
          border-radius:10px;padding:10px 12px;">
          <div style="font-size:0.75rem;font-weight:600;color:${c.text};margin-bottom:3px;">
            ${icon} ${(ins.zone || '').toUpperCase()}</div>
          <div style="font-size:0.8rem;color:var(--text-primary);margin-bottom:4px;">
            ${ins.message || ''}</div>
          <div style="font-size:0.72rem;color:var(--text-secondary);">
            → ${ins.action || ''}</div>
        </div>`;
    }).join('');
  }

  // ── Map Init ──
  let lastDensities = {};

  function initMap() {
    const mapEl = document.getElementById('nms-map');
    if (!mapEl || !window.google?.maps) return;

    mapInstance = new window.google.maps.Map(mapEl, {
      center: { lat: 23.0918, lng: 72.5976 },
      zoom: 17,
      mapId: 'e4b9db3073df26e8',
      mapTypeId: 'satellite',
      disableDefaultUI: false,
      zoomControl: true,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      tilt: 0
    });

    const mapBounds = new window.google.maps.LatLngBounds();

    // Draw zone rectangles
    Object.entries(ZONE_BOUNDS).forEach(([id, bounds]) => {
      mapBounds.extend({ lat: bounds.n, lng: bounds.e });
      mapBounds.extend({ lat: bounds.s, lng: bounds.w });
      const rect = new window.google.maps.Rectangle({
        bounds: { north: bounds.n, south: bounds.s, east: bounds.e, west: bounds.w },
        fillColor: '#00C49A',
        fillOpacity: 0.25,
        strokeColor: '#00C49A',
        strokeOpacity: 0.6,
        strokeWeight: 1.5,
        map: mapInstance
      });

      // Info window on click
      const infoWindow = new window.google.maps.InfoWindow();
      rect.addListener('click', (e) => {
        infoWindow.setContent(`
          <div style="font-family:'Space Grotesk',sans-serif;padding:4px 2px;">
            <b>${ZONES[id]?.name || id}</b><br>
            Density: ${Math.round((lastDensities[id] || 0) * 100)}%<br>
            Status: ${getZoneStatus(lastDensities[id] || 0)}
          </div>`);
        infoWindow.setPosition(e.latLng);
        infoWindow.open(mapInstance);
      });

      zoneRectangles[id] = rect;
    });

    // Gate labels A–H around stadium
    const gatePositions = [
      { label: 'A', lat: 23.0952, lng: 72.5975 },
      { label: 'B', lat: 23.0952, lng: 72.5988 },
      { label: 'C', lat: 23.0938, lng: 72.6008 },
      { label: 'D', lat: 23.0921, lng: 72.6015 },
      { label: 'E', lat: 23.0902, lng: 72.6008 },
      { label: 'F', lat: 23.0921, lng: 72.5955 },
      { label: 'G', lat: 23.0890, lng: 72.5988 },
      { label: 'H', lat: 23.0890, lng: 72.5975 }
    ];

    gatePositions.forEach(g => {
      // AdvancedMarkerElement — modern Maps JS API (replaces deprecated google.maps.Marker)
      const pinEl = document.createElement('div');
      pinEl.style.cssText = `
        width:22px;height:22px;border-radius:50%;
        background:#131C2E;border:1px solid rgba(255,255,255,0.3);
        display:flex;align-items:center;justify-content:center;
        color:#F0F4F8;font-size:11px;font-weight:700;
        font-family:'Space Grotesk',sans-serif;
      `;
      pinEl.textContent = g.label;
      pinEl.setAttribute('title', 'Gate ' + g.label);

      new window.google.maps.marker.AdvancedMarkerElement({
        position: { lat: g.lat, lng: g.lng },
        map: mapInstance,
        content: pinEl,
        title: 'Gate ' + g.label
      });
    });

    updateMapOverlays(getZoneDensity());
    mapInstance.fitBounds(mapBounds);
  }

  function renderPredictiveAlerts(predictions) {
    const el = document.getElementById('predictive-alerts');
    if (!el) return;
    const risky = Object.entries(predictions).filter(([, p]) => p.risk);
    if (risky.length === 0) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;">No surges predicted</div>';
      return;
    }
    el.innerHTML = risky.map(([id, p]) => {
      const name = ZONES[id]?.name || id;
      const color = p.level === 'HIGH' ? '#A29BFE' : '#FFD166';
      return `
        <div style="background:rgba(162,155,254,0.08);border:1px solid ${color}44;
          border-radius:10px;padding:10px 12px;">
          <div style="font-size:0.75rem;font-weight:600;color:${color};margin-bottom:3px;">
            ⚠️ Surge Risk: ${p.level}</div>
          <div style="font-size:0.8rem;color:var(--text-primary);margin-bottom:4px;">
            ${name} predicted at ${p.percent}% in 10m</div>
        </div>`;
    }).join('');
  }

  function updateMapOverlays(densitiesData, predictions = {}) {
    if (!densitiesData) densitiesData = {}; // Safety fallback
    lastDensities = densitiesData;
    
    Object.entries(zoneRectangles).forEach(([id, rect]) => {
      const d = densitiesData[id] || 0;
      const pred = predictions[id]?.risk && predictions[id]?.percent >= 90;
      const isBlocked = currentEmergency.active && currentEmergency.zone === id;
      
      let color, opacity;
      if (isBlocked) { 
        // TASK 4: Blocked zones MUST be BLACK
        color = '#000000'; 
        opacity = 0.9; 
      } 
      else if (pred) { color = '#A29BFE'; opacity = 0.55; }
      else if (heatmapEnabled) {
        color = calculateDensityColor(d * 100);
        opacity = 0.4;
      }
      else if (d >= 0.8) { color = '#FF4757'; opacity = 0.45; }
      else if (d >= 0.6) { color = '#FFD166'; opacity = 0.35; }
      else { color = '#00C49A'; opacity = 0.25; }
      
      rect.setOptions({ 
        fillColor: color, 
        fillOpacity: opacity, 
        strokeColor: color,
        strokeWeight: isBlocked ? 4 : 1.5
      });
    });
  }

  function updateMetrics(densities) {
    const vals = Object.values(densities);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const totalInside = Math.round(vals.reduce((t, d, i) => {
      const cap = Object.values(ZONES)[i]?.cap || 10000;
      return t + d * cap;
    }, 0));
    if (totalEl) totalEl.textContent = totalInside.toLocaleString('en-IN');
    if (metricAvg) metricAvg.textContent = Math.round(avg * 100) + '%';
  }

  function updateAnalyticsDashboard(densities) {
    if(!document.getElementById('analytics-total')) return; // Check if rendered

    const enrichedZones = Object.entries(densities).map(([id, d]) => {
      const zDef = ZONES[id] || {};
      return {
        id,
        capacity: zDef.cap || 10000,
        currentFans: Math.round(d * (zDef.cap || 10000)),
        exitRate: zDef.exitRate || 20
      };
    });

    const totalFans = calculateTotalVisitors(enrichedZones);
    const avgDens = calculateAverageDensity(enrichedZones);
    const peak = findPeakZone(enrichedZones);
    const gates = calculateGateUtilization(enrichedZones);
    const avgWait = estimateAverageWaitTime(enrichedZones);

    // Card 1
    document.getElementById('analytics-total').textContent = totalFans.toLocaleString('en-IN');
    
    // Card 2
    const avgCard = document.getElementById('analytics-avg-card');
    document.getElementById('analytics-avg').textContent = avgDens + '%';
    avgCard.style.border = avgDens > 85 ? '1px solid #FF4757' : (avgDens > 60 ? '1px solid #FFD166' : '1px solid #00C49A');
    document.getElementById('analytics-avg').style.color = avgDens > 85 ? '#FF4757' : (avgDens > 60 ? '#FFD166' : '#00C49A');

    // Card 3
    const peakCard = document.getElementById('analytics-peak-card');
    const emergAlert = document.getElementById('analytics-emerg-alert');
    const peakName = ZONES[peak.zoneId]?.name?.replace(' Stand','') || peak.zoneId || '--';
    document.getElementById('analytics-peak').textContent = peak.zoneId ? `${peakName} (${peak.densityPercent}%)` : '--';
    
    if (currentEmergency.active) {
      if (currentEmergency.zone === peak.zoneId || avgDens > 85) {
         peakCard.style.border = '1px solid #FF4757';
         emergAlert.style.display = 'block';
         document.getElementById('analytics-peak').style.color = '#FF4757';
      } else {
         peakCard.style.border = '1px solid #FF4757';
         emergAlert.style.display = 'block';
         document.getElementById('analytics-peak').textContent = `${ZONES[currentEmergency.zone]?.name} (BLOCKED)`;
         document.getElementById('analytics-peak').style.color = '#FF4757';
      }
    } else {
      peakCard.style.border = peak.densityPercent > 85 ? '1px solid #FF4757' : '1px solid var(--border)';
      emergAlert.style.display = 'none';
      document.getElementById('analytics-peak').style.color = peak.densityPercent > 85 ? '#FF4757' : 'var(--text-primary)';
    }

    // Card 4
    const gatesEl = document.getElementById('analytics-gates');
    const mainGates = gates.filter(g => ['north','south','east','west'].includes(g.zoneId));
    gatesEl.innerHTML = mainGates.map(g => {
       const color = g.utilizationPercent > 85 ? '#FF4757' : (g.utilizationPercent > 60 ? '#FFD166' : '#00C49A');
       const n = ZONES[g.zoneId]?.name?.replace(' Stand','') || g.zoneId;
       return `<div style="display:flex;justify-content:space-between;">
           <span>${n}</span>
           <span style="color:${color};">${g.utilizationPercent}%</span>
         </div>`;
    }).join('');

    // Card 5
    document.getElementById('analytics-wait').textContent = `${avgWait} min`;
  }

  async function autoAlertCheck(densities) {
    const criticalZones = Object.entries(densities)
      .filter(([id, d]) => d > 0.8)
      .map(([id, d]) => ({ id, density: d }));
    
    for (const zone of criticalZones) {
      // Auto-push instruction to staff
      const zoneNames = {
        north: 'North Stand', south: 'South Stand',
        east: 'East Stand', west: 'West Stand',
        concN: 'North Concourse', concS: 'South Concourse',
        gates: 'Gate Area', parking: 'Parking Zone'
      };
      const name = zoneNames[zone.id] || zone.id;
      const pct = Math.round(zone.density * 100);
      
      // Only alert if not alerted in last 5 minutes
      const lastAlert = sessionStorage.getItem('alert:'+zone.id);
      const now = Date.now();
      if (lastAlert && now - parseInt(lastAlert) < 300000) continue;
      
      sessionStorage.setItem('alert:'+zone.id, now.toString());
      
      // Auto-dispatch to staff
      await pushInstruction(
        zone.id,
        `AUTO-ALERT: ${name} at ${pct}% capacity. Redirect crowd to adjacent gates.`,
        'system'
      );
      
      // Auto-nudge attendees
      await pushNudge(
        zone.id,
        `${name} is getting crowded. Alternative routes are available nearby.`
      );
      await pushAnalyticsEvent('auto_alert_dispatched', buildBigQueryEvent('auto_alert_dispatched', {
        zoneId: zone.id,
        zoneName: name,
        densityPercent: pct,
        riskClass: classifySurgeRisk(zone.density, pct)
      }));
      await invokeCloudEndpoint('/classifySurge', { zoneId: zone.id, densityPercent: pct });
      
      console.log('Auto-alert sent for:', name, pct + '%');
    }
  }

  function calculatePredictions(densities) {
    const predictions = {};
    Object.keys(densities).forEach(id => {
      const pred = predictFutureDensity({
        id,
        currentFans: (densities[id] || 0) * (ZONES[id]?.cap || 10000),
        capacity: ZONES[id]?.cap || 10000
        // entry/exit rates will use defaults in predictFutureDensity
      });
      predictions[id] = detectSurgeRisk(pred.predictedPercent);
    });
    return predictions;
  }

  // Init map when ready
  if (window._mapsReady) {
    initMap();
  } else {
    window.addEventListener('mapsReady', initMap, { once: true });
  }

  // ── Simulation auto-tick every 5s ──
  async function doTick() {
    const densities = simulateTick();
    const predictions = calculatePredictions(densities);
    refreshLiveUI(densities, predictions);

    // Update scrubber
    const tick = getTick();
    if (scrubber) {
      const pct = (tick / 480) * 100;
      scrubber.value = tick;
      scrubber.style.background = `linear-gradient(to right,#00C49A ${pct}%,rgba(255,255,255,0.08) ${pct}%)`;
    }
    if (tickLabel) tickLabel.textContent = tick;
    if (timeLabel) timeLabel.textContent = getTickLabel();
    if (ctrlTimeEl) ctrlTimeEl.textContent = getTickLabel();

    // Write to Firebase
    await Promise.all(Object.entries(densities).map(([id, d]) => writeZone(id, d, getZoneStatus(d))));

    await autoAlertCheck(densities);
  }

  const ctrlTimeEl = document.getElementById('ctrl-time');
  simInterval = setInterval(doTick, 5000);
  doTick(); // immediate first tick

  // ── Scrubber ──
  scrubber?.addEventListener('input', async () => {
    const val = parseInt(scrubber.value);
    const pct = (val / 480) * 100;
    scrubber.style.background = `linear-gradient(to right,#00C49A ${pct}%,rgba(255,255,255,0.08) ${pct}%)`;
    setTick(val);
    if (tickLabel) tickLabel.textContent = val;
    if (timeLabel) timeLabel.textContent = getTickLabel();
    if (ctrlTimeEl) ctrlTimeEl.textContent = getTickLabel();
    clearInterval(simInterval);
    simInterval = null;

    const densities = await new Promise(res => {
      const { getZoneDensity } = window._efSim || {};
      import('/src/simulation.js').then(m => res(m.getZoneDensity()));
    });
    const predictions = calculatePredictions(densities);
    refreshLiveUI(densities, predictions);
    await Promise.all(Object.entries(densities).map(([id, d]) => writeZone(id, d, getZoneStatus(d))));
  });

  // ── Firebase: listen zones ──
  const unListenZones = listenZones((zones) => {
    // TASK 1: Populate densities with fallback
    if (!zones) zones = {};
    Object.entries(zones).forEach(([id, z]) => {
      densities[id] = z.density || 0; 
    });

    const snapshotHash = JSON.stringify(densities);
    if (snapshotHash === lastZoneSnapshotHash) return;
    lastZoneSnapshotHash = snapshotHash;

    const updateLagSamples = Object.values(zones)
      .map(z => Date.now() - (z?.updatedAt || Date.now()))
      .filter(v => Number.isFinite(v) && v >= 0);
    if (updateLagSamples.length) {
      const avgLagMs = Math.round(updateLagSamples.reduce((a, b) => a + b, 0) / updateLagSamples.length);
      pushPerformanceMetric('control_zone_update_lag_ms', avgLagMs, { zoneCount: Object.keys(zones).length }).catch(() => {});
    }
    
    if (Object.keys(densities).length > 0) {
      const predictions = calculatePredictions(densities);
      refreshLiveUI(densities, predictions);
    }
  });
  cleanupFirebase.push(unListenZones);

  // ── Emergency Actions ──
  const emergBtn = document.getElementById('ctrl-emergency-btn');
  const modal = document.getElementById('emerg-modal-overlay');
  const setModalOpen = (open) => {
    if (!modal) return;
    modal.style.display = open ? 'flex' : 'none';
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) modal.focus();
  };
  
  emergBtn?.addEventListener('click', () => {
    if (currentEmergency.active) {
      if (confirm('Clear active emergency and restore normal operations?')) {
        setEmergencyStatus(false);
      }
    } else {
      setModalOpen(true);
    }
  });

  document.getElementById('emerg-cancel')?.addEventListener('click', () => setModalOpen(false));
  
  document.getElementById('emerg-confirm')?.addEventListener('click', async () => {
    try { // TASK 8: Prevent UI Crash
      const type = document.getElementById('emerg-type-sel').value;
      const zone = document.getElementById('emerg-zone-sel').value;
      const name = ZONES[zone]?.name || zone;
      
      setModalOpen(false);
      await setEmergencyStatus(true, type, zone);
      await invokeCloudWorkflow('/emergencyValidate', { type, zone, activatedBy: user.email });
      await pushAnalyticsEvent('emergency_activated', { type, zone, activatedBy: user.email });
      
      // TASK 6: Logging
      console.log("Emergency Activated:", type);
      console.log("Zone Blocked:", zone);
      
      // Auto-broadcast 
      const routes = calculateEvacuationRoutes(ZONES, densities, zone);
      const target = routes.safeRoutes[0] || 'south';
      const msg = getEmergencyMessage(type, name, ZONES[target]?.name || target);
      
      await pushInstruction(zone, msg, 'CONTROL');
      await pushNudge(zone, msg);
    } catch (error) {
      console.error("Emergency activation error:", error);
    }
  });

  const unListenEmerg = listenEmergency((state) => {
    currentEmergency = state;
    const badge = document.getElementById('emerg-status-badge');
    if (emergBtn) {
      emergBtn.textContent = state.active ? '🚨 CLEAR EMERGENCY' : '🚨 EMERGENCY MODE';
      emergBtn.style.background = state.active ? 'var(--text-primary)' : 'var(--red)';
    }
    if (badge) {
      badge.style.display = state.active ? 'block' : 'none';
      if (state.active) {
        document.getElementById('emerg-type-val').textContent = state.type;
        document.getElementById('emerg-zone-val').textContent = (ZONES[state.zone]?.name || state.zone).toUpperCase();
      }
    }
    updateMapOverlays(lastDensities);
  });
  cleanupFirebase.push(unListenEmerg);

  // ── Evacuation Estimates Polling (TASK) ──
  function updateEvacuationUI() {
    const { recommendedGate, rankedList } = rankBestExit(ZONES, densities, currentEmergency.active ? currentEmergency.zone : null);
    const listEl = document.getElementById('evacuation-list');
    if (!listEl) return;

    listEl.innerHTML = rankedList.map(item => {
      const name = ZONES[item.id]?.name || item.id;
      const gate = ZONES[item.id]?.gate || '-';
      const isBlocked = item.status === "BLOCKED";
      const isBest = item.id === recommendedGate;
      
      const color = isBlocked ? '#000000' : (isBest ? '#00C49A' : 'var(--text-secondary)');
      const label = isBlocked ? '🚫 BLOCKED' : `${item.time} min`;
      const check = isBest ? ' ✅' : '';
      
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;
          padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:6px;
          border-left:3px solid ${color};">
          <div style="font-size:0.75rem;color:var(--text-primary);font-weight:600;">
            Gate ${gate} (${name.replace(' Stand','')})
          </div>
          <div style="font-size:0.75rem;color:${color};font-weight:700;">
            ${label}${check}
          </div>
        </div>
      `;
    }).join('');
  }

  const evacInterval = setInterval(updateEvacuationUI, 5000);
  cleanupFirebase.push(() => clearInterval(evacInterval));

  const unListenStaff = listenAllStaff(renderStaffList);
  cleanupFirebase.push(unListenStaff);

  // ── Heatmap Toggle Switch ──
  const toggle = document.getElementById('heatmap-toggle');
  if (toggle) {
    toggle.addEventListener('change', (e) => {
      heatmapEnabled = e.target.checked;
      const predictions = calculatePredictions(densities);
      updateMapOverlays(densities, predictions);
    });
  }

  // ── 3-Second UI Pulse (TASK) ──
  const pulseInt = setInterval(() => {
    const predictions = calculatePredictions(densities);
    updateMapOverlays(densities, predictions);
    updateAnalyticsDashboard(densities);
  }, 8000);
  cleanupFirebase.push(() => clearInterval(pulseInt));

  // ── Quick instruction buttons ──
  document.querySelectorAll('.quick-instr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const txtEl = document.getElementById('ctrl-instr-text');
      if (txtEl) txtEl.value = btn.dataset.msg;
    });
  });

  // ── Send to Staff ──
  document.getElementById('ctrl-send-staff')?.addEventListener('click', async () => {
    const zone = document.getElementById('ctrl-zone-sel')?.value;
    const msg  = document.getElementById('ctrl-instr-text')?.value?.trim();
    if (!msg) return;
    await pushInstruction(zone, msg, user.email);
    await pushAnalyticsEvent('manual_staff_dispatch', { zone, sender: user.email, messageLength: msg.length });
    const conf = document.getElementById('ctrl-send-confirm');
    if (conf) { conf.style.display = 'block'; setTimeout(() => conf.style.display = 'none', 2500); }
    document.getElementById('ctrl-instr-text').value = '';
  });

  // ── Nudge attendees ──
  document.getElementById('ctrl-send-nudge')?.addEventListener('click', async () => {
    const zone = document.getElementById('ctrl-zone-sel')?.value;
    const msg  = document.getElementById('ctrl-instr-text')?.value?.trim()
              || 'Please move toward Gate ' + (ZONES[zone]?.gate || 'B') + ' to reduce crowding.';
    await pushNudge(zone, msg);
    await pushAnalyticsEvent('manual_attendee_nudge', { zone, sender: user.email, messageLength: msg.length });
    nudgesSent++;
    if (metricNudges) metricNudges.textContent = nudgesSent;
    const conf = document.getElementById('ctrl-send-confirm');
    if (conf) { conf.textContent = '✓ Nudge sent to attendees'; conf.style.display = 'block'; setTimeout(() => { conf.style.display = 'none'; conf.textContent = '✓ Sent successfully'; }, 2500); }
  });

  // ── AI Insights (immediately + every 2 min) ──
  const { getZoneDensity: gzd } = await import('/src/simulation.js');
  renderAIInsights(gzd());
  aiInterval = setInterval(() => renderAIInsights(gzd()), 120000);

  document.getElementById('ai-refresh-btn')?.addEventListener('click', () => renderAIInsights(gzd()));

  // ── Logout ──
  document.getElementById('ctrl-logout-btn')?.addEventListener('click', () => logout());
  pushPerformanceMetric('control_dashboard_init_ms', Math.round(performance.now() - dashboardInitStart), { user: user.email }).catch(() => {});

  // ── Cleanup ──
  return () => {
    if (simInterval) clearInterval(simInterval);
    if (aiInterval) clearInterval(aiInterval);
    cleanupFirebase.forEach(fn => { try { fn(); } catch (e) {} });
    cleanupFirebase = [];
    zoneRectangles = {};
    mapInstance = null;
  };
}

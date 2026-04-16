/**
 * EventFlow V2 — Control Room Dashboard
 * Desktop 3-column layout: Staff List | NMS Map | Actions + AI
 */
import { getCurrentUser, isControlUser, logout } from '/src/auth.js';
import {
  writeZone, pushInstruction, pushNudge,
  listenZones, listenAllStaff
} from '/src/firebase.js';
import {
  simulateTick, setTick, getTick, getTickLabel,
  getZoneDensity, getZoneStatus, getStatusColor, ZONES
} from '/src/simulation.js';
import { getAIInsights } from '/src/gemini.js';

// NMS approximate bounding coords for each zone overlay
const ZONE_BOUNDS = {
  north:   { n: 23.0943, s: 23.0928, e: 72.5967, w: 72.5938 },
  south:   { n: 23.0910, s: 23.0896, e: 72.5967, w: 72.5938 },
  east:    { n: 23.0928, s: 23.0910, e: 72.5978, w: 72.5963 },
  west:    { n: 23.0928, s: 23.0910, e: 72.5942, w: 72.5927 },
  concN:   { n: 23.0930, s: 23.0923, e: 72.5960, w: 72.5945 },
  concS:   { n: 23.0916, s: 23.0908, e: 72.5960, w: 72.5945 },
  gates:   { n: 23.0936, s: 23.0930, e: 72.5955, w: 72.5949 },
  parking: { n: 23.0950, s: 23.0942, e: 72.5980, w: 72.5920 }
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
        <button id="ctrl-logout-btn" style="
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
        <div id="staff-list" style="display:flex;flex-direction:column;gap:6px;">
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

        <!-- Live Alerts -->
        <div>
          <div style="font-size:0.7rem;font-weight:600;letter-spacing:0.08em;
            color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">
            🚨 Live Alerts</div>
          <div id="alert-list" style="display:flex;flex-direction:column;gap:6px;">
            <div style="color:var(--text-muted);font-size:0.8rem;">All zones normal</div>
          </div>
        </div>

        <div style="height:1px;background:var(--border);"></div>

        <!-- Instruction Dispatch -->
        <div>
          <div style="font-size:0.7rem;font-weight:600;letter-spacing:0.08em;
            color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">
            📡 Dispatch</div>

          <select id="ctrl-zone-sel" style="width:100%;margin-bottom:8px;font-size:0.85rem;">
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
              <button class="quick-instr-btn" data-msg="${msg}" style="
                background:var(--bg-card2);border:1px solid var(--border);
                border-radius:8px;padding:8px 4px;font-size:0.75rem;
                color:var(--text-primary);cursor:pointer;transition:all 0.2s;">${label}</button>
            `).join('')}
          </div>

          <textarea id="ctrl-instr-text" placeholder="Custom instruction…" style="
            width:100%;height:60px;resize:none;margin-bottom:8px;
            font-size:0.85rem;"></textarea>

          <div style="display:flex;gap:6px;">
            <button id="ctrl-send-staff" style="
              flex:1;background:var(--orange);color:#fff;border:none;
              border-radius:8px;padding:9px;font-weight:600;
              font-size:0.82rem;cursor:pointer;transition:all 0.2s;">
              📡 Staff
            </button>
            <button id="ctrl-send-nudge" style="
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
            <button id="ai-refresh-btn" style="
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
  </style>`;
}

export async function init(navigate) {
  // ── Auth guard ──
  const user = await getCurrentUser();
  if (!user || !isControlUser(user)) { navigate('/control-login'); return; }

  // ── DOM refs ──
  const scrubber   = document.getElementById('ctrl-scrubber');
  const tickLabel  = document.getElementById('ctrl-tick-label');
  const timeLabel  = document.getElementById('ctrl-time-label');
  const totalEl    = document.getElementById('ctrl-total');
  const metricAvg  = document.getElementById('metric-avg');
  const metricNudges = document.getElementById('metric-nudges');

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
        <div style="
          background:var(--bg-card2);border:1px solid var(--border);
          border-radius:10px;padding:10px 12px;cursor:pointer;transition:all 0.2s;"
          onclick="document.getElementById('ctrl-zone-sel').value='${s.zone || 'north'}'"
          title="Click to dispatch to ${zone}">
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
        </div>`;
    }).join('');
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
      { label: 'A', lat: 23.0944, lng: 72.5940 },
      { label: 'B', lat: 23.0944, lng: 72.5952 },
      { label: 'C', lat: 23.0932, lng: 72.5978 },
      { label: 'D', lat: 23.0921, lng: 72.5980 },
      { label: 'E', lat: 23.0905, lng: 72.5978 },
      { label: 'F', lat: 23.0921, lng: 72.5925 },
      { label: 'G', lat: 23.0898, lng: 72.5952 },
      { label: 'H', lat: 23.0898, lng: 72.5940 }
    ];

    gatePositions.forEach(g => {
      new window.google.maps.Marker({
        position: { lat: g.lat, lng: g.lng },
        map: mapInstance,
        label: { text: g.label, color: '#F0F4F8', fontSize: '11px', fontWeight: '700' },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#131C2E',
          fillOpacity: 0.9,
          strokeColor: 'rgba(255,255,255,0.3)',
          strokeWeight: 1
        },
        title: 'Gate ' + g.label
      });
    });

    updateMapOverlays(getZoneDensity());
    mapInstance.fitBounds(mapBounds);
  }

  function updateMapOverlays(densities) {
    lastDensities = densities;
    Object.entries(zoneRectangles).forEach(([id, rect]) => {
      const d = densities[id] || 0;
      let color, opacity;
      if (d >= 0.8) { color = '#FF4757'; opacity = 0.45; }
      else if (d >= 0.6) { color = '#FFD166'; opacity = 0.35; }
      else { color = '#00C49A'; opacity = 0.25; }
      rect.setOptions({ fillColor: color, fillOpacity: opacity, strokeColor: color });
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
      
      console.log('Auto-alert sent for:', name, pct + '%');
    }
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
    updateMapOverlays(densities);
    updateMetrics(densities);
    renderAlerts(densities);

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
    for (const [id, d] of Object.entries(densities)) {
      await writeZone(id, d, getZoneStatus(d));
    }

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
    updateMapOverlays(densities);
    updateMetrics(densities);
    renderAlerts(densities);
    for (const [id, d] of Object.entries(densities)) {
      await writeZone(id, d, getZoneStatus(d));
    }
  });

  // ── Firebase: listen zones ──
  const unListenZones = listenZones((zones) => {
    const densities = {};
    Object.entries(zones).forEach(([id, z]) => { densities[id] = z.density || 0; });
    if (Object.keys(densities).length > 0) {
      updateMapOverlays(densities);
      updateMetrics(densities);
      renderAlerts(densities);
    }
  });
  cleanupFirebase.push(unListenZones);

  // ── Firebase: listen staff ──
  const unListenStaff = listenAllStaff(renderStaffList);
  cleanupFirebase.push(unListenStaff);

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

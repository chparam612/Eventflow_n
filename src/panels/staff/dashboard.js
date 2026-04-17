/**
 * EventFlow V2 — Staff Dashboard
 * Mobile-first, one-handed operation
 */
import { getCurrentUser, isStaffUser, logout } from '/src/auth.js';
import { 
  writeStaffStatus, listenInstructions, pushInstruction, 
  listenEmergency 
} from '/src/firebase.js';
import { setStaffOverride, clearStaffOverride, ZONES } from '/src/simulation.js';

export function render() {
  return `
  <div style="
    min-height: 100vh; background: var(--bg-deep);
    display: flex; flex-direction: column;
    max-width: 480px; margin: 0 auto;">

    <!-- Top Bar -->
    <div style="
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px;
      background: var(--bg-card); border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 50;">
      <div>
        <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;
          font-size:0.95rem;color:var(--text-primary);">EventFlow Staff</div>
        <div id="staff-zone-name" style="font-size:0.75rem;color:var(--text-secondary);">
          Loading zone…</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span id="staff-conn-dot" style="
          width:7px;height:7px;border-radius:50%;background:#00C49A;display:inline-block;"></span>
        <button id="staff-logout-btn" aria-label="Log out of EventFlow" style="
          background:none;border:1px solid var(--border);border-radius:8px;
          color:var(--text-secondary);font-size:0.78rem;padding:5px 10px;">
          Log Out
        </button>
      </div>
    </div>

    <div style="padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 12px;" class="fade-in">

      <!-- INSTRUCTION CARD -->
      <div id="instruction-card" style="
        background: var(--bg-card);
        border: 1px solid rgba(0,196,154,0.25);
        border-radius: 16px; padding: 16px;"
        aria-live="assertive" aria-label="Urgent instructions from control room" role="alert">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:0.7rem;font-weight:600;letter-spacing:0.08em;
            color:#00C49A;text-transform:uppercase;">📡 Control Room</span>
        </div>
        <p id="instruction-text" style="
          color:var(--text-primary);font-size:0.92rem;line-height:1.5;
          margin-bottom:12px;">No instructions — all clear ✓</p>
        <button id="ack-btn" aria-label="Acknowledge instruction from control room" style="
          background:rgba(0,196,154,0.1);border:1px solid rgba(0,196,154,0.25);
          border-radius:8px;color:#00C49A;font-size:0.82rem;
          padding:8px 16px;cursor:pointer;transition:all 0.2s;
          display:none;" disabled>✓ Acknowledged</button>
      </div>

      <!-- ZONE STATUS TOGGLE -->
      <div style="
        background: var(--bg-card); border: 1px solid var(--border);
        border-radius: 16px; padding: 16px;">
        <div style="font-size:0.72rem;font-weight:600;letter-spacing:0.08em;
          color:var(--text-muted);text-transform:uppercase;margin-bottom:12px;">
          Zone Status — Report Live</div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          <button id="btn-clear" aria-label="Report my zone as clear" style="
            width:100%; padding: 20px; border-radius: 14px;
            font-family: 'Space Grotesk',sans-serif;
            font-size: 1.1rem; font-weight: 700;
            border: 2px solid rgba(0,196,154,0.3);
            background: rgba(0,196,154,0.12); color: #00C49A;
            cursor: pointer; transition: all 0.2s;
            display: flex; align-items: center; justify-content: center; gap: 10px;">
            🟢 My Zone is CLEAR
          </button>
          <button id="btn-crowded" aria-label="Report my zone as crowded" style="
            width:100%; padding: 20px; border-radius: 14px;
            font-family: 'Space Grotesk',sans-serif;
            font-size: 1.1rem; font-weight: 700;
            border: 2px solid rgba(255,255,255,0.1);
            background: transparent; color: var(--text-secondary);
            cursor: pointer; transition: all 0.2s;
            display: flex; align-items: center; justify-content: center; gap: 10px;">
            🔴 My Zone is CROWDED
          </button>
        </div>
      </div>

      <!-- QUICK REPORTS -->
      <div style="
        background: var(--bg-card); border: 1px solid var(--border);
        border-radius: 16px; padding: 16px;">
        <div style="font-size:0.72rem;font-weight:600;letter-spacing:0.08em;
          color:var(--text-muted);text-transform:uppercase;margin-bottom:12px;">
          Quick Report</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button class="quick-report-btn" data-type="overcrowding" aria-label="Quick report: overcrowding" style="
            background: var(--bg-card2); border: 1px solid var(--border);
            border-radius: 10px; padding: 12px 8px; font-size: 0.82rem;
            color: var(--text-primary); cursor: pointer; transition: all 0.2s;
            display:flex;flex-direction:column;align-items:center;gap:4px;">
            <span style="font-size:1.2rem;" aria-hidden="true">👥</span>Overcrowding
          </button>
          <button class="quick-report-btn" data-type="clear" aria-label="Quick report: area is clear" style="
            background: var(--bg-card2); border: 1px solid var(--border);
            border-radius: 10px; padding: 12px 8px; font-size: 0.82rem;
            color: var(--text-primary); cursor: pointer; transition: all 0.2s;
            display:flex;flex-direction:column;align-items:center;gap:4px;">
            <span style="font-size:1.2rem;" aria-hidden="true">✅</span>Area Clear
          </button>
          <button class="quick-report-btn" data-type="medical" aria-label="Quick report: medical assistance needed" style="
            background: var(--bg-card2); border: 1px solid var(--border);
            border-radius: 10px; padding: 12px 8px; font-size: 0.82rem;
            color: var(--text-primary); cursor: pointer; transition: all 0.2s;
            display:flex;flex-direction:column;align-items:center;gap:4px;">
            <span style="font-size:1.2rem;" aria-hidden="true">🚑</span>Medical Needed
          </button>
          <button class="quick-report-btn" data-type="other" aria-label="Quick report: other issue" style="
            background: var(--bg-card2); border: 1px solid var(--border);
            border-radius: 10px; padding: 12px 8px; font-size: 0.82rem;
            color: var(--text-primary); cursor: pointer; transition: all 0.2s;
            display:flex;flex-direction:column;align-items:center;gap:4px;">
            <span style="font-size:1.2rem;" aria-hidden="true">⚠️</span>Other
          </button>
        </div>
      </div>

      <!-- Custom message popup (hidden) -->
      <div id="custom-report-box" style="
        background: var(--bg-card2); border: 1px solid var(--border-accent);
        border-radius: 12px; padding: 14px; display: none;">
        <textarea id="custom-report-text" placeholder="Describe the situation…" style="
          width:100%;height:80px;resize:none;border-radius:8px;
          font-size:0.88rem;padding:10px;"></textarea>
        <button id="custom-report-send" aria-label="Submit custom situation report" style="
          margin-top:8px;background:var(--orange);color:#fff;border:none;
          border-radius:8px;padding:10px 20px;font-weight:600;cursor:pointer;width:100%;">
          Send Report
        </button>
      </div>

      <!-- Recent Reports -->
      <div style="
        background: var(--bg-card); border: 1px solid var(--border);
        border-radius: 16px; padding: 16px;">
        <div style="font-size:0.72rem;font-weight:600;letter-spacing:0.08em;
          color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;">
          Recent Reports</div>
        <div id="recent-reports" style="display:flex;flex-direction:column;gap:6px;">
          <div style="color:var(--text-muted);font-size:0.82rem;">No reports sent yet</div>
        </div>
      </div>

    </div>

    <!-- Safe bottom -->
    <div style="height: env(safe-area-inset-bottom, 16px);"></div>

    <style>
      .quick-report-btn:hover { border-color: var(--border-accent) !important; background: var(--bg-card) !important; }
      .quick-report-btn:active { transform: scale(0.97); }
    </style>
    
    <!-- Emergency Overlay (Hidden by default) -->
    <div id="staff-emerg-overlay" style="
      position:fixed;top:0;left:0;right:0;bottom:0;
      background:#060A10;z-index:1001;display:none;
      flex-direction:column;align-items:center;justify-content:center;
      padding:24px;text-align:center;">
      <div style="font-size:4rem;margin-bottom:20px;animation:emerg-pulse 1s infinite alternate;">🚨</div>
      <h1 style="color:#FF4757;font-family:'Space Grotesk',sans-serif;margin:0 0 10px 0;">EMERGENCY ACTIVE</h1>
      <p id="staff-emerg-msg" style="color:#fff;font-size:1.1rem;line-height:1.5;margin-bottom:30px;">
        Evacuate fans immediately!
      </p>
      <button id="staff-emerg-ack" aria-label="Confirm and begin zone evacuation" style="
        width:100%;padding:18px;background:#FF4757;color:#fff;
        border:none;border-radius:12px;font-size:1.1rem;font-weight:700;
        cursor:pointer;box-shadow:0 10px 20px rgba(255,71,87,0.3);">
        Start Evacuation
      </button>
    </div>
  </div>`;
}

export async function init(navigate) {
  // ── Auth guard ──
  const user = await getCurrentUser();
  if (!user || !isStaffUser(user)) { navigate('/staff-login'); return; }

  const uid  = user.uid;
  const zone = localStorage.getItem('ef_zone') || 'north';
  const zoneName = ZONES[zone]?.name || zone;

  document.getElementById('staff-zone-name').textContent = zoneName;

  let zoneStatus = 'clear';
  const reports = [];
  let cleanupInstructions = null;

  // ── Write initial Firebase status ──
  await writeStaffStatus(uid, zone, 'clear', true);

  // ── Listen for instructions ──
  const listenFn = await import('/src/firebase.js').then(m => m.listenInstructions);
  cleanupInstructions = listenFn(zone, (items) => {
    const latest = items[0];
    const textEl = document.getElementById('instruction-text');
    const ackBtn = document.getElementById('ack-btn');
    if (!textEl) return;
    if (latest) {
      textEl.textContent = latest.message;
      textEl.style.color = 'var(--yellow)';
      ackBtn.style.display = 'inline-block';
      ackBtn.disabled = false;
      ackBtn.dataset.id = latest.id;
    } else {
      textEl.textContent = 'No instructions — all clear ✓';
      textEl.style.color = 'var(--text-primary)';
      ackBtn.style.display = 'none';
    }
  });

  // ── Acknowledge button ──
  document.getElementById('ack-btn')?.addEventListener('click', function () {
    this.textContent = '✓ Acknowledged';
    this.style.background = 'rgba(0,196,154,0.05)';
    this.style.color = 'var(--text-muted)';
    this.disabled = true;
    document.getElementById('instruction-text').style.color = 'var(--text-muted)';
  });

  // ── Zone toggle ──
  const setStatus = async (status) => {
    zoneStatus = status;
    const btnClear   = document.getElementById('btn-clear');
    const btnCrowded = document.getElementById('btn-crowded');
    if (!btnClear || !btnCrowded) return;

    if (status === 'clear') {
      btnClear.style.background    = 'rgba(0,196,154,0.15)';
      btnClear.style.borderColor   = 'rgba(0,196,154,0.5)';
      btnClear.style.color         = '#00C49A';
      btnCrowded.style.background  = 'transparent';
      btnCrowded.style.borderColor = 'rgba(255,255,255,0.1)';
      btnCrowded.style.color       = 'var(--text-secondary)';
      clearStaffOverride(zone);
    } else {
      btnCrowded.style.background  = 'rgba(255,71,87,0.15)';
      btnCrowded.style.borderColor = 'rgba(255,71,87,0.5)';
      btnCrowded.style.color       = '#FF4757';
      btnClear.style.background    = 'transparent';
      btnClear.style.borderColor   = 'rgba(255,255,255,0.1)';
      btnClear.style.color         = 'var(--text-secondary)';
      setStaffOverride(zone, 'crowded');
    }
    await writeStaffStatus(uid, zone, status, true);
  };

  setStatus('clear'); // default

  document.getElementById('btn-clear')?.addEventListener('click', () => setStatus('clear'));
  document.getElementById('btn-crowded')?.addEventListener('click', () => setStatus('crowded'));

  // ── Quick report buttons ──
  const addReport = (type) => {
    const msgs = {
      overcrowding: '👥 Overcrowding reported',
      clear: '✅ Area confirmed clear',
      medical: '🚑 Medical assistance requested',
      other: '⚠️ Custom report sent'
    };
    reports.unshift({ type, msg: msgs[type] || type, time: new Date().toLocaleTimeString() });
    const el = document.getElementById('recent-reports');
    if (el) {
      el.innerHTML = reports.slice(0, 3).map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;
          padding:8px 10px;border-radius:8px;background:var(--bg-card2);">
          <span style="font-size:0.82rem;color:var(--text-primary);">${r.msg}</span>
          <span style="font-size:0.72rem;color:var(--text-muted);">${r.time}</span>
        </div>`).join('');
    }
  };

  document.querySelectorAll('.quick-report-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type === 'other') {
        const box = document.getElementById('custom-report-box');
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
        return;
      }
      // Flash effect
      btn.style.borderColor = 'rgba(0,196,154,0.4)';
      setTimeout(() => btn.style.borderColor = 'var(--border)', 800);
      addReport(type);
    });
  });

  document.getElementById('custom-report-send')?.addEventListener('click', () => {
    const txt = document.getElementById('custom-report-text')?.value?.trim();
    if (!txt) return;
    addReport('other');
    document.getElementById('custom-report-text').value = '';
    document.getElementById('custom-report-box').style.display = 'none';
  });

  // ── Logout ──
  document.getElementById('staff-logout-btn')?.addEventListener('click', async () => {
    await writeStaffStatus(uid, zone, 'offline', false);
    await logout();
  });

  // ── Emergency Listener ──
  const emergOverlay = document.getElementById('staff-emerg-overlay');
  const emergMsg = document.getElementById('staff-emerg-msg');
  const unListenEmerg = listenEmergency((state) => {
    if (state.active && state.zone === zone) {
      if (emergOverlay) emergOverlay.style.display = 'flex';
      if (emergMsg) emergMsg.textContent = `🚨 ${state.type} detected in ${zoneName.toUpperCase()}. Redirect fans to nearest safe exit immediately.`;
    } else {
      if (emergOverlay) emergOverlay.style.display = 'none';
    }
  });

  document.getElementById('staff-emerg-ack')?.addEventListener('click', async () => {
    if (emergOverlay) emergOverlay.style.display = 'none';
    await pushInstruction(zone, `ACK: Evacuation started by staff ${uid.slice(0,5)}`, 'STAFF');
  });

  // ── Cleanup ──
  return () => {
    if (cleanupInstructions) cleanupInstructions();
    if (unListenEmerg) unListenEmerg();
    writeStaffStatus(uid, zone, 'offline', false).catch(() => {});
  };
}

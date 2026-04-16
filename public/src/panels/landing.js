/**
 * EventFlow V2 — Landing Page
 * Role selector: Fan / Staff / Control with language switcher
 */

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'gu', label: 'ગુજ' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలు' }
];

export function render() {
  return `
  <div class="fade-in" style="
    min-height: 100vh;
    background: var(--bg-deep);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.25rem;
    gap: 0;
    position: relative;
    overflow: hidden;">

    <!-- Background glow orbs -->
    <div style="
      position: absolute; top: -80px; left: 50%; transform: translateX(-50%);
      width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(0,196,154,0.06) 0%, transparent 70%);
      pointer-events: none;"></div>
    <div style="
      position: absolute; bottom: -60px; right: -60px;
      width: 300px; height: 300px;
      background: radial-gradient(circle, rgba(255,71,87,0.04) 0%, transparent 70%);
      pointer-events: none;"></div>

    <!-- Logo Block -->
    <div style="text-align: center; margin-bottom: 28px;">
      <div style="
        display: inline-flex; align-items: center; gap: 10px;
        margin-bottom: 10px;">
        <div style="
          width: 42px; height: 42px; border-radius: 12px;
          background: linear-gradient(135deg, rgba(0,196,154,0.2), rgba(0,196,154,0.05));
          border: 1px solid rgba(0,196,154,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;">⬡</div>
        <div style="
          font-family: 'Space Grotesk', sans-serif;
          font-size: 1.8rem; font-weight: 700;
          background: linear-gradient(135deg, #00C49A, #00E5B4);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;">EventFlow</div>
      </div>
      <div style="color: var(--text-muted); font-size: 0.82rem; letter-spacing: 0.05em;">
        NARENDRA MODI STADIUM · AHMEDABAD
      </div>
      <div style="
        display: inline-flex; align-items: center; gap: 6px;
        margin-top: 8px; background: rgba(0,196,154,0.08);
        border: 1px solid rgba(0,196,154,0.15); border-radius: 20px;
        padding: 4px 12px;">
        <span style="width:7px;height:7px;border-radius:50%;background:#00C49A;
          animation: pulse 1.8s ease-in-out infinite;display:inline-block;"></span>
        <span style="font-size: 0.76rem; color: #00C49A; font-weight: 500;">LIVE · Match Day</span>
      </div>
    </div>

    <!-- Language Selector -->
    <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-bottom: 28px;" id="lang-row">
      ${LANGS.map(l => `
        <button id="lang-${l.code}" onclick="window._setLang('${l.code}')" style="
          padding: 5px 13px; border-radius: 20px; font-size: 0.78rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent; color: var(--text-secondary);
          transition: all 0.2s; cursor: pointer;">${l.label}</button>
      `).join('')}
    </div>

    <!-- Role Cards -->
    <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 390px;" id="role-cards">

      <!-- Fan Card -->
      <button id="btn-fan" style="
        background: var(--bg-card); border: 1px solid rgba(0,196,154,0.2);
        border-radius: 16px; padding: 18px 20px; text-align: left;
        width: 100%; transition: all 0.2s; cursor: pointer;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="
            width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0;
            background: var(--green-dim);
            border: 1px solid rgba(0,196,154,0.2);
            display: flex; align-items: center; justify-content: center; font-size: 20px;">🎟️</div>
          <div style="flex: 1; min-width: 0;">
            <div style="
              font-family: 'Space Grotesk', sans-serif;
              font-weight: 600; color: var(--text-primary); font-size: 0.97rem;">Match Attendee</div>
            <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 2px;">
              Your personal crowd-free match plan</div>
          </div>
          <div style="color: #00C49A; font-size: 1rem; flex-shrink: 0;">→</div>
        </div>
      </button>

      <!-- Staff Card -->
      <button id="btn-staff" style="
        background: var(--bg-card); border: 1px solid rgba(255,107,53,0.2);
        border-radius: 16px; padding: 18px 20px; text-align: left;
        width: 100%; transition: all 0.2s; cursor: pointer;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="
            width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0;
            background: var(--orange-dim);
            border: 1px solid rgba(255,107,53,0.2);
            display: flex; align-items: center; justify-content: center; font-size: 20px;">🧑‍✈️</div>
          <div style="flex: 1; min-width: 0;">
            <div style="
              font-family: 'Space Grotesk', sans-serif;
              font-weight: 600; color: var(--text-primary); font-size: 0.97rem;">Ground Staff</div>
            <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 2px;">
              Zone reporting and live instructions</div>
          </div>
          <div style="color: var(--orange); font-size: 1rem; flex-shrink: 0;">→</div>
        </div>
      </button>

      <!-- Control Card -->
      <button id="btn-control" style="
        background: var(--bg-card); border: 1px solid rgba(255,71,87,0.2);
        border-radius: 16px; padding: 18px 20px; text-align: left;
        width: 100%; transition: all 0.2s; cursor: pointer;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="
            width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0;
            background: var(--red-dim);
            border: 1px solid rgba(255,71,87,0.2);
            display: flex; align-items: center; justify-content: center; font-size: 20px;">🖥️</div>
          <div style="flex: 1; min-width: 0;">
            <div style="
              font-family: 'Space Grotesk', sans-serif;
              font-weight: 600; color: var(--text-primary); font-size: 0.97rem;">Control Room</div>
            <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 2px;">
              Command center — authorized access</div>
          </div>
          <div style="color: var(--red); font-size: 1rem; flex-shrink: 0;">→</div>
        </div>
      </button>
    </div>

    <!-- Capacity badge -->
    <div style="margin-top: 28px; text-align: center;">
      <div style="
        display: inline-flex; gap: 16px; align-items: center;
        padding: 10px 20px; border-radius: 12px;
        background: var(--bg-card); border: 1px solid var(--border);">
        <div style="text-align: center;">
          <div style="font-family:'Space Grotesk',sans-serif;font-size:1.1rem;font-weight:700;color:var(--text-primary);">132K</div>
          <div style="font-size:0.7rem;color:var(--text-muted);">Capacity</div>
        </div>
        <div style="width:1px;height:28px;background:var(--border);"></div>
        <div style="text-align: center;">
          <div style="font-family:'Space Grotesk',sans-serif;font-size:1.1rem;font-weight:700;color:var(--text-primary);">8</div>
          <div style="font-size:0.7rem;color:var(--text-muted);">Zones</div>
        </div>
        <div style="width:1px;height:28px;background:var(--border);"></div>
        <div style="text-align: center;">
          <div style="font-family:'Space Grotesk',sans-serif;font-size:1.1rem;font-weight:700;color:#00C49A;">LIVE</div>
          <div style="font-size:0.7rem;color:var(--text-muted);">Status</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top: 20px; color: var(--text-muted); font-size: 0.72rem; text-align: center; line-height: 1.6;">
      EventFlow v2.0 · Built for Google Prompt Wars 2026
    </div>

    <style>
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%       { opacity: 0.5; transform: scale(0.85); }
      }
      #btn-fan:hover   { border-color: rgba(0,196,154,0.5);  background: rgba(0,196,154,0.04); transform: translateY(-1px); }
      #btn-staff:hover { border-color: rgba(255,107,53,0.5); background: rgba(255,107,53,0.04); transform: translateY(-1px); }
      #btn-control:hover { border-color: rgba(255,71,87,0.5); background: rgba(255,71,87,0.04); transform: translateY(-1px); }
      #btn-fan:active, #btn-staff:active, #btn-control:active { transform: translateY(0); }
    </style>
  </div>`;
}

export async function init(navigate) {
  const { loginAnonymously } = await import('/src/auth.js');

  // ── Language switcher ──
  function highlightLang(code) {
    document.querySelectorAll('[id^="lang-"]').forEach(btn => {
      const active = btn.id === 'lang-' + code;
      btn.style.background    = active ? 'rgba(0,196,154,0.12)' : 'transparent';
      btn.style.color         = active ? '#00C49A' : 'var(--text-secondary)';
      btn.style.borderColor   = active ? 'rgba(0,196,154,0.35)' : 'rgba(255,255,255,0.1)';
    });
  }

  // Click → save & reload (router re-renders with new lang applied by DOM walker)
  window._setLang = (code) => {
    if (localStorage.getItem('ef_lang') === code) return; // already set, no reload needed
    localStorage.setItem('ef_lang', code);
    window.location.reload();
  };

  // Highlight the already-saved language without triggering a reload
  const saved = localStorage.getItem('ef_lang') || 'en';
  highlightLang(saved);

  // ── Fan button ──
  document.getElementById('btn-fan')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-fan');
    if (!btn) return;
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.innerHTML = btn.innerHTML.replace('🎟️', '<div class="spinner" style="width:20px;height:20px;border-top-color:#00C49A;border-color:rgba(0,196,154,0.2);"></div>');
    await loginAnonymously();
    navigate('/attendee');
  });

  // ── Staff button ──
  document.getElementById('btn-staff')?.addEventListener('click', () => {
    navigate('/staff-login');
  });

  // ── Control button ──
  document.getElementById('btn-control')?.addEventListener('click', () => {
    navigate('/control-login');
  });

  return () => {
    delete window._setLang;
  };
}

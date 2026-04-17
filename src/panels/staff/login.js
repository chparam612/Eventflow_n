/**
 * EventFlow V2 — Staff Login Panel
 */
import { loginWithEmail } from '/src/auth.js';

const ZONES = [
  { id: 'north',   label: 'North Stand' },
  { id: 'south',   label: 'South Stand' },
  { id: 'east',    label: 'East Stand' },
  { id: 'west',    label: 'West Stand' },
  { id: 'concN',   label: 'North Concourse' },
  { id: 'concS',   label: 'South Concourse' },
  { id: 'gates',   label: 'Gate Area' },
  { id: 'parking', label: 'Parking Zone' }
];

export function render() {
  return `
  <div class="fade-in" style="
    min-height: 100vh; background: var(--bg-deep);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 2rem 1.25rem;">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="
        width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 14px;
        background: var(--orange-dim); border: 1px solid rgba(255,107,53,0.3);
        display: flex; align-items: center; justify-content: center; font-size: 24px;">🧑‍✈️</div>
      <h1 style="
        font-family: 'Space Grotesk', sans-serif;
        font-size: 1.45rem; font-weight: 700; color: var(--text-primary);">Staff Login</h1>
      <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">
        EventFlow Ground Staff · NMS</p>
    </div>

    <!-- Form Card -->
    <div style="
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 20px; padding: 24px; width: 100%; max-width: 380px;">

      <!-- Error -->
      <div id="staff-login-error" class="error-msg" style="margin-bottom: 16px;"></div>

      <form id="staff-login-form" action="#" onsubmit="return false;" autocomplete="on"
        style="display:flex;flex-direction:column;gap:0;">

        <!-- Email -->
        <div style="margin-bottom: 14px;">
          <label for="staff-email" style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-bottom: 6px;">
            Staff Email</label>
          <input type="email" id="staff-email" name="email"
            placeholder="staff@eventflow.demo"
            style="width:100%;" autocomplete="username" />
        </div>

        <!-- Password -->
        <div style="margin-bottom: 14px;">
          <label for="staff-pass" style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-bottom: 6px;">
            Password</label>
          <input type="password" id="staff-pass" name="password"
            placeholder="••••••••"
            style="width:100%;" autocomplete="current-password" />
        </div>

        <!-- Zone -->
        <div style="margin-bottom: 22px;">
          <label for="staff-zone" style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-bottom: 6px;">
            Your Zone</label>
          <select id="staff-zone" name="zone" style="width:100%;">
            ${ZONES.map(z => `<option value="${z.id}">${z.label}</option>`).join('')}
          </select>
        </div>

        <!-- Submit -->
        <button id="staff-login-btn" type="submit" class="btn-primary"
          aria-label="Sign in to staff panel"
          style="background: var(--orange); color: #fff;">
          Sign In
        </button>

      </form>

      <!-- Demo hint -->
      <div style="
        margin-top: 18px; padding: 12px; border-radius: 10px;
        background: rgba(255,107,53,0.06); border: 1px solid rgba(255,107,53,0.15);
        text-align: center;">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Demo Credentials</div>
        <div style="font-size: 0.82rem; color: var(--text-secondary);">
          <span style="font-family:'Space Grotesk',sans-serif;">staff@eventflow.demo</span>
        </div>
        <div style="font-size: 0.82rem; color: var(--text-secondary);">
          Password: <span style="font-family:'Space Grotesk',sans-serif;">Staff@123</span>
        </div>
      </div>
    </div>

    <!-- Back -->
    <button onclick="history.back()" style="
      margin-top: 20px; background: none; border: none;
      color: var(--text-muted); font-size: 0.85rem; cursor: pointer;">
      ← Back to Home
    </button>
  </div>`;
}

export async function init(navigate) {
  const btn   = document.getElementById('staff-login-btn');
  const errEl = document.getElementById('staff-login-error');

  const showError = (msg) => {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  };

  btn?.addEventListener('click', async () => {
    const email = document.getElementById('staff-email')?.value?.trim();
    const pass  = document.getElementById('staff-pass')?.value;
    const zone  = document.getElementById('staff-zone')?.value;

    errEl.style.display = 'none';

    if (!email || !pass) { showError('Please fill in all fields.'); return; }
    if (!email.includes('staff')) { showError('Not a staff account. Check your email.'); return; }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-top-color:#fff;border-color:rgba(255,255,255,0.2);"></div> Signing in…';

    try {
      await loginWithEmail(email, pass);
      localStorage.setItem('ef_zone', zone);
      navigate('/staff');
    } catch (e) {
      showError(e.message);
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  // Enter key support
  ['staff-email', 'staff-pass'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') btn?.click();
    });
  });
}

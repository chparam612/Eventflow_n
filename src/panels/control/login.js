/**
 * EventFlow V2 — Control Room Login
 */
import { loginWithEmail } from '/src/auth.js';

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
        background: var(--red-dim); border: 1px solid rgba(255,71,87,0.3);
        display: flex; align-items: center; justify-content: center; font-size: 24px;">🖥️</div>
      <h1 style="
        font-family: 'Space Grotesk', sans-serif;
        font-size: 1.45rem; font-weight: 700; color: var(--text-primary);">Control Room</h1>
      <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">
        EventFlow Command Center · NMS</p>
    </div>

    <!-- Form Card -->
    <div style="
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 20px; padding: 24px; width: 100%; max-width: 380px;">

      <div id="ctrl-login-error" class="error-msg" style="margin-bottom: 16px;"></div>

      <form id="ctrl-login-form" action="#" onsubmit="return false;" autocomplete="on"
        style="display:flex;flex-direction:column;gap:0;">

        <div style="margin-bottom: 14px;">
          <label for="ctrl-email" style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-bottom: 6px;">
            Control Email</label>
          <input type="email" id="ctrl-email" name="email"
            placeholder="control@eventflow.demo"
            style="width:100%;" autocomplete="username" />
        </div>

        <div style="margin-bottom: 22px;">
          <label for="ctrl-pass" style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-bottom: 6px;">
            Password</label>
          <input type="password" id="ctrl-pass" name="password"
            placeholder="••••••••"
            style="width:100%;" autocomplete="current-password" />
        </div>

        <button id="ctrl-login-btn" type="submit" class="btn-primary"
          aria-label="Sign in to Control Room"
          style="background: var(--red); color: #fff;">
          Access Control Room
        </button>

      </form>

      <div style="
        margin-top: 18px; padding: 12px; border-radius: 10px;
        background: rgba(255,71,87,0.06); border: 1px solid rgba(255,71,87,0.15);
        text-align: center;">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Demo Credentials</div>
        <div style="font-size: 0.82rem; color: var(--text-secondary);">
          <span style="font-family:'Space Grotesk',sans-serif;">control@eventflow.demo</span>
        </div>
        <div style="font-size: 0.82rem; color: var(--text-secondary);">
          Password: <span style="font-family:'Space Grotesk',sans-serif;">Control@123</span>
        </div>
      </div>
    </div>

    <button onclick="history.back()" style="
      margin-top: 20px; background: none; border: none;
      color: var(--text-muted); font-size: 0.85rem; cursor: pointer;">
      ← Back to Home
    </button>
  </div>`;
}

export async function init(navigate) {
  const btn   = document.getElementById('ctrl-login-btn');
  const errEl = document.getElementById('ctrl-login-error');

  const showError = (msg) => { errEl.textContent = msg; errEl.style.display = 'block'; };

  btn?.addEventListener('click', async () => {
    const email = document.getElementById('ctrl-email')?.value?.trim();
    const pass  = document.getElementById('ctrl-pass')?.value;
    errEl.style.display = 'none';

    if (!email || !pass) { showError('Please fill in all fields.'); return; }
    if (!email.includes('control')) { showError('Not a control room account.'); return; }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-top-color:#fff;border-color:rgba(255,255,255,0.2);"></div> Signing in…';

    try {
      await loginWithEmail(email, pass);
      navigate('/control');
    } catch (e) {
      showError(e.message);
      btn.disabled = false;
      btn.textContent = 'Access Control Room';
    }
  });

  ['ctrl-email', 'ctrl-pass'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') btn?.click();
    });
  });
}

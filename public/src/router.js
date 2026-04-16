/**
 * EventFlow V2 — SPA Router
 * Hash-free History API routing with auth guards and lazy panel loading
 */

const routes = {
  '/':              () => import('/src/panels/landing.js'),
  '/attendee':      () => import('/src/panels/attendee/index.js'),
  '/staff-login':   () => import('/src/panels/staff/login.js'),
  '/staff':         () => import('/src/panels/staff/dashboard.js'),
  '/control-login': () => import('/src/panels/control/login.js'),
  '/control':       () => import('/src/panels/control/dashboard.js'),
};

let currentUnmount = null;

// ─── Navigate ──────────────────────────────────────────────────────────────
export async function navigate(path) {
  // Teardown current panel
  if (currentUnmount) {
    try { currentUnmount(); } catch (e) {}
    currentUnmount = null;
  }
  window.history.pushState({}, '', path);
  await renderRoute(path);
}

// ─── Render Current Route ──────────────────────────────────────────────────
async function renderRoute(path) {
  const app = document.getElementById('app');
  if (!app) return;

  // Show inline spinner
  app.innerHTML = `
    <div class="page-loader">
      <div class="spinner spinner-light" style="width:32px;height:32px;"></div>
    </div>`;

  // ── Auth guards ──
  if (path === '/staff' || path === '/control') {
    try {
      const { getCurrentUser, isStaffUser, isControlUser } = await import('/src/auth.js');
      const user = await getCurrentUser();
      if (!user) {
        navigate(path === '/staff' ? '/staff-login' : '/control-login');
        return;
      }
      if (path === '/staff' && !isStaffUser(user)) {
        navigate('/staff-login');
        return;
      }
      if (path === '/control' && !isControlUser(user)) {
        navigate('/control-login');
        return;
      }
    } catch (e) {
      console.warn('[Router] Auth check failed:', e);
      navigate(path === '/staff' ? '/staff-login' : '/control-login');
      return;
    }
  }

  // ── Load panel module ──
  const loader = routes[path];
  if (!loader) {
    app.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;
        justify-content:center;min-height:100vh;gap:16px;padding:2rem;">
        <div style="font-family:'Space Grotesk',sans-serif;font-size:3rem;font-weight:700;
          color:rgba(255,255,255,0.1);">404</div>
        <div style="color:var(--text-secondary);">Page not found</div>
        <button onclick="history.back()" class="btn-secondary"
          style="padding:10px 24px;border-radius:8px;">← Go Back</button>
      </div>`;
    return;
  }

  try {
    const mod = await loader();
    const html = mod.render ? mod.render() : '<div>Panel error</div>';
    app.innerHTML = html;
    app.scrollTop = 0;

    if (mod.init) {
      const cleanup = await mod.init(navigate);
      currentUnmount = cleanup || null;
    }

    // ── Apply Translations ──
    const lang = localStorage.getItem('ef_lang') || 'en';
    if (lang !== 'en') {
      try {
        const [enRes, toRes] = await Promise.all([
          fetch('/src/i18n/en.json'),
          fetch(`/src/i18n/${lang}.json`)
        ]);
        if (enRes.ok && toRes.ok) {
          const enMap = await enRes.json();
          const toMap = await toRes.json();
          const dict = {};
          for (const k in enMap) if (toMap[k]) dict[enMap[k]] = toMap[k];
          
          // Sort keys from longest to shortest to prevent partial overlapping replacements
          const sortedKeys = Object.keys(dict).sort((a,b) => b.length - a.length);

          const walk = document.createTreeWalker(app, NodeFilter.SHOW_TEXT, null, false);
          let n;
          while ((n = walk.nextNode())) {
            let txt = n.nodeValue;
            if (txt.trim()) {
              sortedKeys.forEach(enText => {
                if (txt.includes(enText)) {
                  txt = txt.replace(enText, dict[enText]);
                }
              });
              n.nodeValue = txt;
            }
          }
          
          app.querySelectorAll('input, textarea').forEach(el => {
            let txt = el.placeholder;
            if (txt) {
              sortedKeys.forEach(enText => {
                if (txt.includes(enText)) txt = txt.replace(enText, dict[enText]);
              });
              el.placeholder = txt;
            }
          });
        }
      } catch(e) { console.warn('Translation error:', e); }
    }

  } catch (e) {
    console.error('[Router] Panel load failed:', e);
    app.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;
        justify-content:center;min-height:100vh;gap:16px;padding:2rem;">
        <div style="font-size:1.4rem;">⚠️</div>
        <div style="color:var(--text-secondary);text-align:center;">
          Failed to load panel.<br>
          <small style="color:var(--text-muted);">${e.message}</small>
        </div>
        <button onclick="window.location.reload()" class="btn-primary"
          style="width:auto;padding:10px 24px;">Reload</button>
      </div>`;
  }
}

// ─── Init Router ───────────────────────────────────────────────────────────
export function initRouter() {
  window.addEventListener('popstate', () => {
    if (currentUnmount) { try { currentUnmount(); } catch (e) {} currentUnmount = null; }
    renderRoute(window.location.pathname);
  });

  // Handle clicks on [data-link] elements (event delegation)
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-link]');
    if (el) {
      e.preventDefault();
      navigate(el.dataset.link);
    }
  });

  renderRoute(window.location.pathname || '/');
}

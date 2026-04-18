import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toDocument(html) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    runScripts: 'outside-only'
  });
  dom.window.eval(axe.source);
  return dom;
}

async function runAxe(name, html) {
  const dom = toDocument(html);
  const results = await dom.window.axe.run(dom.window.document, {
    rules: {
      // jsdom does not compute color contrast like real browser canvas
      'color-contrast': { enabled: false }
    }
  });

  const serious = results.violations.filter(v =>
    v.impact === 'critical' || v.impact === 'serious'
  );

  if (serious.length > 0) {
    const details = serious.map(v => `${v.id}: ${v.help}`).join('\n');
    throw new Error(`${name} has serious accessibility violations:\n${details}`);
  }
}

async function main() {
  console.log('\n♿ AXE ACCESSIBILITY SMOKE TESTS');

  const publicIndex = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const attendeeNavigation = fs.readFileSync(path.join(__dirname, '../public/attendee-navigation.html'), 'utf8');

  await runAxe('public/index.html', publicIndex);
  console.log('  ✅ public/index.html');

  await runAxe('public/attendee-navigation.html', attendeeNavigation);
  console.log('  ✅ public/attendee-navigation.html');

  // Source-level accessibility guard checks for dynamic SPA panels.
  const staffLoginSrc = fs.readFileSync(path.join(__dirname, '../src/panels/staff/login.js'), 'utf8');
  const staffDashboardSrc = fs.readFileSync(path.join(__dirname, '../src/panels/staff/dashboard.js'), 'utf8');
  const controlLoginSrc = fs.readFileSync(path.join(__dirname, '../src/panels/control/login.js'), 'utf8');
  const controlDashboardSrc = fs.readFileSync(path.join(__dirname, '../src/panels/control/dashboard.js'), 'utf8');
  const attendeeSrc = fs.readFileSync(path.join(__dirname, '../src/panels/attendee/index.js'), 'utf8');

  const mustInclude = (source, value, name) => {
    if (!source.includes(value)) {
      throw new Error(`${name} is missing required accessibility marker: ${value}`);
    }
  };

  mustInclude(staffLoginSrc, 'role="alert"', 'staff login');
  mustInclude(staffLoginSrc, 'aria-live="assertive"', 'staff login');
  mustInclude(controlLoginSrc, 'role="alert"', 'control login');
  mustInclude(controlLoginSrc, 'aria-live="assertive"', 'control login');
  mustInclude(controlDashboardSrc, 'role="dialog"', 'control dashboard emergency modal');
  mustInclude(controlDashboardSrc, 'aria-modal="true"', 'control dashboard emergency modal');
  mustInclude(staffDashboardSrc, 'role="alertdialog"', 'staff emergency overlay');
  mustInclude(staffDashboardSrc, 'aria-modal="true"', 'staff emergency overlay');
  mustInclude(attendeeSrc, 'role="radiogroup"', 'attendee exit route options');
  mustInclude(attendeeSrc, "banner.setAttribute('role', 'alert')", 'attendee emergency banner');

  console.log('  ✅ source-level accessibility guard checks');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

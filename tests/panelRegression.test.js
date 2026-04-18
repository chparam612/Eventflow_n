import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ❌ ${name}`);
    console.log(`     → ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log('\n🧩 PANEL REGRESSION TESTS');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const controlPath = join(rootDir, 'src/panels/control/dashboard.js');
const attendeePath = join(rootDir, 'src/panels/attendee/index.js');
const staffPath = join(rootDir, 'src/panels/staff/dashboard.js');

const controlSrc = readFileSync(controlPath, 'utf8');
const attendeeSrc = readFileSync(attendeePath, 'utf8');
const staffSrc = readFileSync(staffPath, 'utf8');

test('Control dashboard imports emergency helpers used in activation flow', () => {
  assert(
    controlSrc.includes("import { calculateEvacuationRoutes, getEmergencyMessage } from '/src/emergencyEngine.js';"),
    'Missing emergencyEngine imports for emergency activation helpers.'
  );
});

test('Control topbar staff count style has valid color token', () => {
  assert(!controlSrc.includes('color:#00C49A);'), 'Malformed CSS color token still present.');
});

test('Predictive alerts have both render target and DOM mount', () => {
  assert(controlSrc.includes("document.getElementById('predictive-alerts')"), 'Predictive alerts renderer target missing.');
  assert(controlSrc.includes('id="predictive-alerts"'), 'Predictive alerts container not mounted in dashboard UI.');
});

test('Emergency modal handlers guard absent DOM node', () => {
  assert(controlSrc.includes('if (modal) modal.style.display = \'flex\';'), 'Missing modal open guard.');
  assert(controlSrc.includes('if (modal) modal.style.display = \'none\';'), 'Missing modal close guard.');
});

test('Control dashboard no longer keeps stale TASK markers', () => {
  assert(!/TASK \d+/.test(controlSrc), 'Stale TASK markers found in control dashboard.');
});

test('Attendee plan screen has no dead plan-estate button binding', () => {
  assert(!attendeeSrc.includes('plan-estate-btn'), 'Dead plan-estate-btn binding still present.');
});

test('Attendee panel drops unused getStatusColor import', () => {
  assert(!attendeeSrc.includes('getStatusColor'), 'Unused getStatusColor import still present.');
});

test('Staff dashboard no longer loads listenInstructions via dynamic firebase import', () => {
  assert(
    !/import\('\/src\/firebase\.js'\)\s*\.then\s*\((?:[^)]*)\)\s*=>[\s\S]*listenInstructions/.test(staffSrc),
    'Old dynamic firebase import pattern for listenInstructions still present.'
  );
});

console.log('\n──────────────────────────────────────────────────');
console.log(`  Results: ${passed}/${passed + failed} tests passed`);
if (failed > 0) process.exit(1);
console.log('\n🎉 Panel regressions passed');

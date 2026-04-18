/**
 * EventFlow V2 — Build Script (ESM)
 * Copies src/ into public/src/ for Firebase Hosting deployment
 * Usage: node build.js
 */
import fs   from 'fs';
import path from 'path';
import url  from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SRC  = path.join(__dirname, 'src');
const DEST = path.join(__dirname, 'public', 'src');
const DEFAULT_VERTEX_LOCATION = 'asia-south1';
const STRICT_ENV_CHECK = String(process.env.STRICT_ENV_CHECK || '').toLowerCase() === 'true';

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

console.log('\n🔨 EventFlow V2 — Build\n');

if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true });
  console.log('  🗑  Cleaned public/src/');
}

copyDir(SRC, DEST);
console.log('  ✅ Copied src/ → public/src/');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const parsed = {};
  const env = fs.readFileSync(filePath, 'utf8');
  env.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [k, ...v] = trimmed.split('=');
    if (k && v.length) parsed[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  });
  return parsed;
}

// Inject Keys
function injectKeys() {
  const envPath = path.join(__dirname, '.env');
  const envFileKeys = parseEnvFile(envPath);
  const keys = { ...envFileKeys, ...process.env };
  const diagnostics = [];

  if (!fs.existsSync(envPath)) {
    diagnostics.push('Missing .env file; using process environment variables only.');
  }

  const replaceInFile = (file, target, replacement, keyName) => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) return;
    const originalContent = fs.readFileSync(fullPath, 'utf8');
    if (!originalContent.includes(target)) return;
    if (replacement) {
      let content = originalContent;
      content = content.replace(target, replacement);
      fs.writeFileSync(fullPath, content);
      console.log(`  🔑 Injected keys into ${file}`);
      return;
    }
    diagnostics.push(`Missing value for ${keyName}; placeholder may remain in ${file}`);
  };

  replaceInFile('public/src/firebase.js', 'YOUR_API_KEY', keys.FIREBASE_API_KEY, 'FIREBASE_API_KEY');
  replaceInFile('public/src/gemini.js', 'YOUR_GEMINI_KEY_HERE', keys.GEMINI_API_KEY, 'GEMINI_API_KEY');
  replaceInFile('public/src/gemini.js', 'YOUR_VERTEX_PROJECT_ID', keys.VERTEX_PROJECT_ID, 'VERTEX_PROJECT_ID');
  replaceInFile('public/src/gemini.js', 'YOUR_VERTEX_LOCATION', keys.VERTEX_LOCATION || DEFAULT_VERTEX_LOCATION, 'VERTEX_LOCATION');
  replaceInFile('public/index.html', 'YOUR_MAPS_KEY_HERE', keys.GOOGLE_MAPS_API_KEY, 'GOOGLE_MAPS_API_KEY');
  replaceInFile('public/attendee-navigation.html', 'YOUR_MAPS_KEY_HERE', keys.GOOGLE_MAPS_API_KEY, 'GOOGLE_MAPS_API_KEY');

  const placeholderChecks = [
    { file: 'public/src/gemini.js', placeholder: 'YOUR_GEMINI_KEY_HERE' },
    { file: 'public/src/gemini.js', placeholder: 'YOUR_VERTEX_PROJECT_ID' },
    { file: 'public/src/gemini.js', placeholder: 'YOUR_VERTEX_LOCATION' },
    { file: 'public/index.html', placeholder: 'YOUR_MAPS_KEY_HERE' },
    { file: 'public/attendee-navigation.html', placeholder: 'YOUR_MAPS_KEY_HERE' }
  ];

  for (const check of placeholderChecks) {
    const fullPath = path.join(__dirname, check.file);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(check.placeholder)) {
      diagnostics.push(`Placeholder ${check.placeholder} still present in ${check.file}`);
    }
  }

  if (diagnostics.length > 0) {
    console.warn('\n  ⚠️ Build configuration diagnostics:');
    diagnostics.forEach((d) => console.warn(`   - ${d}`));
    console.warn('  ℹ️ Set env vars in .env or process env before deploy to avoid runtime fallback/errors.\n');
    if (STRICT_ENV_CHECK) {
      throw new Error('Build failed due to STRICT_ENV_CHECK=true with unresolved configuration placeholders.');
    }
  }
}

injectKeys();

const keyFiles = [
  'firebase.js', 'auth.js', 'gemini.js', 'simulation.js', 'router.js',
  'panels/landing.js',
  'panels/attendee/index.js',
  'panels/attendee/aiChat.js',
  'panels/staff/login.js',
  'panels/staff/dashboard.js',
  'panels/control/login.js',
  'panels/control/dashboard.js',
];

let allGood = true;
keyFiles.forEach(f => {
  const exists = fs.existsSync(path.join(DEST, f));
  console.log(`  ${exists ? '✅' : '❌'} public/src/${f}`);
  if (!exists) allGood = false;
});

console.log('\n' + (allGood
  ? '✨ Build complete! Run: firebase deploy'
  : '⚠️  Some files missing — check errors above') + '\n');

process.exit(allGood ? 0 : 1);

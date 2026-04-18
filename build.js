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

// Inject Keys
function injectKeys() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  
  const env = fs.readFileSync(envPath, 'utf8');
  const keys = {};
  env.split('\n').forEach(l => { 
    const [k, ...v] = l.split('='); 
    if (k && v.length) keys[k.trim()] = v.join('=').trim().replace(/['"]/g, ''); 
  });
  
  const replaceInFile = (file, target, replacement) => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath) && replacement) {
      let content = fs.readFileSync(fullPath, 'utf8');
      content = content.replace(target, replacement);
      fs.writeFileSync(fullPath, content);
      console.log(`  🔑 Injected keys into ${file}`);
    }
  };

  replaceInFile('public/src/firebase.js', 'YOUR_API_KEY', keys.FIREBASE_API_KEY);
  replaceInFile('public/src/gemini.js', 'YOUR_GEMINI_KEY_HERE', keys.GEMINI_API_KEY);
  replaceInFile('public/src/gemini.js', 'YOUR_VERTEX_PROJECT_ID', keys.VERTEX_PROJECT_ID);
  replaceInFile('public/src/gemini.js', 'YOUR_VERTEX_LOCATION', keys.VERTEX_LOCATION || DEFAULT_VERTEX_LOCATION);
  replaceInFile('public/index.html', 'YOUR_MAPS_KEY_HERE', keys.GOOGLE_MAPS_API_KEY);
  replaceInFile('public/attendee-navigation.html', 'YOUR_MAPS_KEY_HERE', keys.GOOGLE_MAPS_API_KEY);
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

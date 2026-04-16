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

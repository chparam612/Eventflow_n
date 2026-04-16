/**
 * EventFlow V2 — Local Development Server (ESM)
 * Serves project root so /src/ and /public/index.html both work
 * Usage: node server.js [port]
 */
import http from 'http';
import fs   from 'fs';
import path from 'path';
import url  from 'url';

const PORT = parseInt(process.argv[2]) || 3000;
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff2':'font/woff2',
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let reqPath = decodeURIComponent(parsed.pathname);

  // CORS for ES modules
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Route resolution
  if (reqPath === '/') {
    reqPath = '/public/index.html';
  } else if (reqPath === '/manifest.json' || reqPath.startsWith('/icons/')) {
    reqPath = '/public' + reqPath;
  } else if (!path.extname(reqPath) && !reqPath.startsWith('/src/')) {
    // SPA routes (no extension, not a src file) → serve index.html
    reqPath = '/public/index.html';
  }

  const filePath = path.join(ROOT, reqPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback
        fs.readFile(path.join(ROOT, 'public', 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(404); res.end('Not found'); return; }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(d2);
        });
      } else {
        res.writeHead(500);
        res.end('Server error: ' + err.message);
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n⚡ EventFlow V2 Dev Server`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → http://localhost:${PORT}/attendee`);
  console.log(`   → http://localhost:${PORT}/staff-login`);
  console.log(`   → http://localhost:${PORT}/control-login\n`);
  console.log(`   Press Ctrl+C to stop\n`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} in use. Try: node server.js ${PORT + 1}\n`);
  } else { throw e; }
});

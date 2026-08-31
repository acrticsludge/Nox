import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { attachNet } from './net.js';
import { attachRooms } from './rooms.js';
import { startMatch, attachMatchRouting } from './match.js';

// Serves the Astro build output (frontend/dist). Run `npm run build` at the
// repo root (or `npm --prefix frontend run build`) before starting.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'dist');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

// Project files that must never be served to browsers.
const DENY_EXACT = new Set([
  '/server.js',
  '/package.json',
  '/package-lock.json',
  '/render.yaml',
  '/CLAUDE.md',
  '/README.md',
  '/.gitignore',
  '/.env',
]);
const DENY_PREFIX = ['/docs/', '/test/', '/.git/', '/.env', '/node_modules/'];

/**
 * Map a request path to an absolute file path inside ROOT, or null when the
 * path is unsafe or not public. Guards: URL decoding, traversal (both
 * separators), dotfiles, and a denylist of sensitive project files.
 */
function resolvePublicFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null; // malformed percent-encoding
  }
  if (decoded.includes('\0')) return null;

  const clean = decoded.split('?')[0].split('#')[0];
  if (!clean.startsWith('/')) return null;

  for (const prefix of DENY_PREFIX) {
    if (clean.startsWith(prefix)) return null;
  }
  if (DENY_EXACT.has(clean)) return null;

  // Reject any path segment that is a dotfile (".git", ".env", ".gitignore").
  const segments = clean.split('/').filter(Boolean);
  for (const seg of segments) {
    if (seg.startsWith('.')) return null;
  }

  const rel = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  const file = path.normalize(path.join(ROOT, rel));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return null; // escaped root
  return file;
}

export function createServer() {
  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const urlPath = (req.url || '/').split('?')[0];
    const log = (status) =>
      console.log(`${req.method} ${urlPath} ${status} ${Date.now() - started}ms`);

    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method Not Allowed');
        log(405);
        return;
      }

      if (urlPath === '/health') {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify({ ok: true, service: 'nox' }));
        log(200);
        return;
      }

      const file = resolvePublicFile(urlPath);
      if (!file) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        log(404);
        return;
      }

      let served = file;
      let data;
      try {
        data = await readFile(served);
      } catch {
        // Static-build URL fallbacks: a directory route serves its index
        // (/play → play/index.html), and an extensionless URL can hit a
        // flat file (/play → play.html) — mirroring Astro/Vercel output.
        const candidates = [path.join(served, 'index.html'), served + '.html'];
        let ok = false;
        for (const c of candidates) {
          try {
            served = c;
            data = await readFile(c);
            ok = true;
            break;
          } catch {
            /* try next */
          }
        }
        if (!ok) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
          log(404);
          return;
        }
      }

      const ext = path.extname(served).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': data.length,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
      log(200);
    } catch (err) {
      // Fail safely: never leak internals to the client.
      console.error(`ERROR ${req.method} ${urlPath}`, err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('Internal Server Error');
    }
  });
  // T4/T5: WebSocket layer (guest sessions + rooms).
  const net = attachNet(server);
  server.noxNet = net;
  const roomsApi = attachRooms(server, net, {
    onRoomFull: room => startMatch(room, net),
  });
  net.noxRooms = roomsApi.rooms;
  attachMatchRouting(net);
  return server;
}

// Auto-start only when run directly (`npm start` / `npm run dev`).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync(path.join(ROOT, 'index.html'))) {
    console.warn('No frontend build found at frontend/dist — run `npm run build` at the repo root first.');
  }
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Nox backend listening on http://0.0.0.0:${PORT}`);
  });
}

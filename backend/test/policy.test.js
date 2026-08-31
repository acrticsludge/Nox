// Task 9: production secret policy, dev-only localhost origins, /ws path requirement.
import test from 'node:test';
import http from 'node:http';
import net from 'node:net';
import assert from 'node:assert/strict';
import { attachNet } from '../net.js';

const PORT = 3111;

function rawUpgrade(port, path, origin) {
  return new Promise((resolve, reject) => {
    const s = net.connect(port, '127.0.0.1');
    const to = setTimeout(() => { s.destroy(); reject(new Error('timeout')); }, 3000);
    let buf = '';
    s.on('data', (d) => {
      buf += d.toString();
      if (buf.includes('\r\n\r\n')) { clearTimeout(to); s.destroy(); resolve(buf.split('\r\n')[0]); }
    });
    s.on('error', (e) => { clearTimeout(to); reject(e); });
    s.on('connect', () => {
      s.write(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nOrigin: ${origin}\r\n\r\n`);
    });
  });
}

function startServer(env) {
  const server = http.createServer();
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  const a = attachNet(server, { secret: env.WS_SECRET || 'test-secret' });
  return new Promise((res) => { server.listen(PORT, '127.0.0.1', () => res({ server, a })); });
}

async function stop(server, prev) {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  for (const k of Object.keys(prev)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; }
}

test('upgrade on non-/ws path is rejected with 404', async () => {
  const prev = { NODE_ENV: process.env.NODE_ENV };
  const { server } = await startServer({ NODE_ENV: 'production', WS_SECRET: 's' });
  try {
    const status = await rawUpgrade(PORT, '/other', `http://127.0.0.1:${PORT}`);
    assert.match(status, /404/);
  } finally { await stop(server, prev); }
});

test('production origin policy: localhost denied, allowlisted extra accepted', async () => {
  const prev = { NODE_ENV: process.env.NODE_ENV, WS_EXTRA_ORIGINS: process.env.WS_EXTRA_ORIGINS };
  const { server } = await startServer({ NODE_ENV: 'production', WS_SECRET: 's', WS_EXTRA_ORIGINS: 'https://nox.example' });
  try {
    const denied = await rawUpgrade(PORT, '/ws', 'http://localhost:4321');
    assert.match(denied, /403/);
    const allowed = await rawUpgrade(PORT, '/ws', 'https://nox.example');
    assert.match(allowed, /101/);
  } finally { await stop(server, prev); }
});

test('development keeps the localhost allowance', async () => {
  const prev = { NODE_ENV: process.env.NODE_ENV };
  const { server } = await startServer({ NODE_ENV: 'development' });
  try {
    const status = await rawUpgrade(PORT, '/ws', 'http://localhost:4321');
    assert.match(status, /101/);
  } finally { await stop(server, prev); }
});

test('production without WS_SECRET fails fast at attachNet', () => {
  const prev = { NODE_ENV: process.env.NODE_ENV, WS_SECRET: process.env.WS_SECRET };
  delete process.env.WS_SECRET;
  process.env.NODE_ENV = 'production';
  try {
    const server = http.createServer();
    assert.throws(() => attachNet(server), /WS_SECRET/);
  } finally {
    if (prev.WS_SECRET === undefined) delete process.env.WS_SECRET; else process.env.WS_SECRET = prev.WS_SECRET;
    process.env.NODE_ENV = prev.NODE_ENV;
  }
});

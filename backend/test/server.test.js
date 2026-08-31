// O6: backend is a game server only — /health + WS protocol. No site serving.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { createServer } from '../server.js';

async function start() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return { baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

test('GET /health returns ok JSON', async () => {
  const { baseUrl, close } = await start();
  try {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, 'nox');
  } finally {
    await close();
  }
});

test('GET /health?x=1 still works (query ignored)', async () => {
  const { baseUrl, close } = await start();
  try {
    const res = await fetch(`${baseUrl}/health?cache=0`);
    assert.equal(res.status, 200);
  } finally {
    await close();
  }
});

test('no site serving: all other HTTP paths return 404 (game lives on WS only)', async () => {
  const { baseUrl, close } = await start();
  try {
    for (const p of ['/', '/index.html', '/play', '/play/online', '/assets/game.js', '/nope.html']) {
      const res = await fetch(`${baseUrl}${p}`);
      assert.equal(res.status, 404, `expected 404 for ${p}`);
    }
  } finally {
    await close();
  }
});

test('no file leaks: project/sensitive paths are 404', async () => {
  const { baseUrl, close } = await start();
  try {
    for (const p of ['/package.json', '/server.js', '/.env', '/.git/config', '/../package.json', '/%2e%2e%2fpackage.json']) {
      const res = await fetch(`${baseUrl}${p}`);
      assert.equal(res.status, 404, `expected 404 for ${p}`);
      const body = await res.text();
      assert.ok(!body.includes('"name"'), `leaked file via ${p}`);
    }
  } finally {
    await close();
  }
});

test('non-GET/HEAD methods return 405', async () => {
  const { baseUrl, close } = await start();
  try {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const res = await fetch(`${baseUrl}/health`, { method });
      assert.equal(res.status, 405, `expected 405 for ${method}`);
    }
  } finally {
    await close();
  }
});

test('WS upgrade still works on the game-only server', async () => {
  const { WebSocket } = await import('ws');
  const { baseUrl, close } = await start();
  try {
    const ws = new WebSocket(baseUrl.replace('http', 'ws') + '/ws', { origin: baseUrl });
    const opened = new Promise((r) => ws.on('open', r));
    await opened;
    ws.send(JSON.stringify({ type: 'hello', nick: 'IsoTest', guestId: 'guest-isolated1' }));
    const session = await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('no session')), 2000);
      ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.type === 'session') { clearTimeout(to); resolve(m); } });
    });
    assert.ok(session.token);
    ws.close();
  } finally {
    await close();
  }
});

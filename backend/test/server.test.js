import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { createServer } from '../server.js';

/** Start the app on an ephemeral port and return { baseUrl, close }. */
async function start() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return { baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

/** Like start(), but exposes the raw http.Server for verbatim-path requests. */
async function startWithServer() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server };
}

/** Send a GET with the exact path string (no URL normalization). */
function rawGet(server, path) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: async () => data }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('GET / serves the game HTML', async () => {
  const { baseUrl, close } = await start();
  try {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    const body = await res.text();
    assert.match(body, /NEON VOID/);
    assert.match(body, /gameSvg/);
  } finally {
    await close();
  }
});

test('GET /index.html serves the same game HTML', async () => {
  const { baseUrl, close } = await start();
  try {
    const res = await fetch(`${baseUrl}/index.html`);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /NEON VOID/);
  } finally {
    await close();
  }
});

test('HEAD / returns headers without a body', async () => {
  const { baseUrl, close } = await start();
  try {
    const res = await fetch(`${baseUrl}/`, { method: 'HEAD' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    assert.equal((await res.text()).length, 0);
  } finally {
    await close();
  }
});

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

test('unknown paths return 404', async () => {
  const { baseUrl, close } = await start();
  try {
    for (const p of ['/nope.html', '/missing', '/assets/game.js']) {
      const res = await fetch(`${baseUrl}${p}`);
      assert.equal(res.status, 404, `expected 404 for ${p}`);
    }
  } finally {
    await close();
  }
});

test('non-GET/HEAD methods return 405', async () => {
  const { baseUrl, close } = await start();
  try {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const res = await fetch(`${baseUrl}/`, { method });
      assert.equal(res.status, 405, `expected 405 for ${method}`);
    }
  } finally {
    await close();
  }
});

test('path traversal is blocked and never leaks files', async () => {
  const { baseUrl, close } = await start();
  try {
    const attempts = [
      '/../package.json',        // literal parent traversal (URL-normalized)
      '/%2e%2e%2fpackage.json',  // encoded ../ 
      '/..%2f..%2fpackage.json', // double encoded traversal
      '/..%5cpackage.json',      // encoded backslash traversal
      '/%2e%2e/package.json',    // mixed
      '/..%2fserver.js',
      '/..%2f..%2f..%2fetc%2fpasswd',
    ];
    for (const p of attempts) {
      const res = await fetch(`${baseUrl}${p}`);
      assert.ok(res.status === 404 || res.status === 400, `expected 4xx for ${p}, got ${res.status}`);
      const body = await res.text();
      assert.ok(!body.includes('"name": "nox"'), `leaked package.json via ${p}`);
    }
  } finally {
    await close();
  }
});

test('raw-path internal traversal (/index.html/../server.js) is blocked', async () => {
  // http.request sends the path verbatim, unlike fetch which URL-normalizes.
  const { server } = await startWithServer();
  try {
    const res = await rawGet(server, '/index.html/../server.js');
    assert.equal(res.status, 404, 'internal .. traversal must not serve server.js');
    const body = await res.body();
    assert.ok(!body.includes('import http from'), 'leaked server.js source');
    // Same shape for the encoded variant.
    const res2 = await rawGet(server, '/index.html/..%2fserver.js');
    assert.ok(res2.status === 404 || res2.status === 400, `got ${res2.status}`);
  } finally {
    await server.close();
  }
});

test('sensitive/project files are not served', async () => {
  const { baseUrl, close } = await start();
  try {
    for (const p of [
      '/package.json',
      '/package-lock.json',
      '/server.js',
      '/render.yaml',
      '/CLAUDE.md',
      '/README.md',
      '/docs/reasonix/plans/nox-render-deploy.md',
      '/test/server.test.js',
    ]) {
      const res = await fetch(`${baseUrl}${p}`);
      assert.equal(res.status, 404, `expected 404 for ${p}, got ${res.status}`);
    }
  } finally {
    await close();
  }
});

test('dotfiles are not served', async () => {
  const { baseUrl, close } = await start();
  try {
    for (const p of ['/.gitignore', '/.env', '/.git/config']) {
      const res = await fetch(`${baseUrl}${p}`);
      assert.equal(res.status, 404, `expected 404 for ${p}, got ${res.status}`);
    }
  } finally {
    await close();
  }
});

test('malformed percent-encoding returns 4xx without crashing', async () => {
  const { baseUrl, close } = await start();
  try {
    const res = await fetch(`${baseUrl}/%zz`);
    assert.ok(res.status === 400 || res.status === 404);
  } finally {
    await close();
  }
});

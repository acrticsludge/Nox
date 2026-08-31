// T4 integration tests: guest sessions, origin check, rate limits.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import WebSocket from 'ws';
import { createServer } from '../server.js';
import { signToken, verifyToken, sanitizeNick } from '../net.js';

const PORT = 3104;
let server;

const hello = (guestId = 'guest-abcd1234', nick = 'PlayerOne') =>
  JSON.stringify({ type: 'hello', guestId, nick });

function connect(origin = `http://localhost:${PORT}`) {
  return new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin });
}
function once(ws, type) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('timeout: ' + type)), 3000);
    ws.on('message', function h(d) {
      const m = JSON.parse(d.toString());
      if (m.type === type) { clearTimeout(to); ws.off('message', h); resolve(m); }
    });
    ws.on('close', code => { clearTimeout(to); reject(new Error('closed ' + code + ' waiting ' + type)); });
  });
}
function closed(ws) {
  return new Promise(resolve => ws.on('close', code => resolve(code)));
}

before(async () => {
  server = createServer();
  await new Promise(r => server.listen(PORT, r));
});
after(async () => { await new Promise(r => server.close(r)); });

test('sanitizer strips control chars and enforces length', () => {
  assert.equal(sanitizeNick('du\x00de'), 'dude');
  assert.equal(sanitizeNick('  spaced  '), 'spaced');
  assert.equal(sanitizeNick('a'), null);
  assert.equal(sanitizeNick('x'.repeat(30)), 'x'.repeat(16));
});

test('hello issues HMAC session token that verifies', async () => {
  const ws = connect();
  await new Promise(r => ws.on('open', r));
  ws.send(hello());
  const sess = await once(ws, 'session');
  assert.equal(sess.nick, 'PlayerOne');
  const payload = verifyToken(sess.token, server.noxNet.secret);
  assert.equal(payload.guestId, 'guest-abcd1234');
  ws.close();
});

test('non-hello first message is rejected', async () => {
  const ws = connect();
  await new Promise(r => ws.on('open', r));
  ws.send(JSON.stringify({ type: 'input', m: 0 }));
  const code = await closed(ws);
  assert.equal(code, 1008);
});

test('bad nick rejected', async () => {
  const ws = connect();
  await new Promise(r => ws.on('open', r));
  ws.send(JSON.stringify({ type: 'hello', guestId: 'guest-abcd1234', nick: 'x' }));
  const code = await closed(ws);
  assert.equal(code, 1008);
});

test('bad origin rejected at upgrade', async () => {
  const ws = connect('https://evil.example.com');
  const err = await new Promise(resolve => {
    ws.on('error', e => resolve(e));
    ws.on('open', () => resolve(null));
  });
  assert.ok(err, 'upgrade must fail for foreign origin');
});

test('flood > 60 msg/s gets kicked', async () => {
  const ws = connect();
  await new Promise(r => ws.on('open', r));
  ws.send(hello());
  await once(ws, 'session');
  for (let i = 0; i < 80; i++) {
    ws.send(JSON.stringify({ type: 'ping', t: i }));
    if (ws.readyState !== WebSocket.OPEN) break;
  }
  const code = await closed(ws);
  assert.equal(code, 1008);
});

test('oversized frame gets 1009', async () => {
  const ws = connect();
  await new Promise(r => ws.on('open', r));
  ws.send(hello());
  await once(ws, 'session');
  ws.send('x'.repeat(2048));
  const code = await closed(ws);
  assert.equal(code, 1009);
});

test('token round-trip: sign + verify + expiry', () => {
  const secret = 's3cret';
  const t = signToken({ guestId: 'g1', exp: Date.now() + 1000 }, secret);
  assert.equal(verifyToken(t, secret).guestId, 'g1');
  assert.equal(verifyToken(t, 'wrong'), null);
  assert.equal(verifyToken(signToken({ guestId: 'g1', exp: Date.now() - 1 }, secret), secret), null);
});

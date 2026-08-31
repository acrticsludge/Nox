// Server visual-event batch tests: ordered monotonic ids/ticks inside the
// snapshot stream (spec: docs/reasonix/specs/visual-parity-sync.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { startMatch } from '../match.js';

function fakeSeat() {
  const ws = {
    readyState: 1,
    sent: [],
    send(obj) { this.sent.push(JSON.parse(obj)); },
  };
  return ws;
}

test('snapshots carry ordered visual event batches with monotonic ids and ticks', async () => {
  const s0 = fakeSeat(), s1 = fakeSeat();
  const room = { code: 'EVT01', seed: 424242, state: 'playing', seats: [s0, s1], match: null };
  const match = startMatch(room, {}, { onEnd() {} });

  // both seats ready -> 3-2-1-GO countdown -> 60Hz server ticking
  match.onMessage(s0, { type: 'ready' });
  match.onMessage(s1, { type: 'ready' });

  // fire from both seats for a while so muzzle/wallHit events accumulate
  let seq0 = 0, seq1 = 0;
  const fireTimer = setInterval(() => {
    try {
      match.onMessage(s0, { type: 'input', seq: ++seq0, m: 32 });
      match.onMessage(s1, { type: 'input', seq: ++seq1, m: 32 });
    } catch {}
  }, 50);

  await new Promise(r => setTimeout(r, 5200));
  clearInterval(fireTimer);
  match.stop();

  const snaps = s0.sent.filter(m => m.type === 'snapshot');
  assert.ok(snaps.length > 20, `expected a snapshot stream, got ${snaps.length}`);
  assert.ok(snaps.every(s => typeof s.sr === 'number'), 'safeRadius must be part of every snapshot');
  assert.ok(snaps.every(s => Array.isArray(s.hz)), 'hazards must be part of every snapshot');
  for (const s of snaps) {
    for (const b of s.b) assert.ok(b.length >= 8 && Number.isInteger(b[6]), 'bullets need a stable id at index 6');
  }

  // event stream: strictly increasing ids, sorted batches, ticks <= snapshot tick
  const evs = [];
  for (const s of snaps) {
    assert.ok(Array.isArray(s.ev), 'ev batch present');
    for (let i = 1; i < s.ev.length; i++) {
      assert.ok(s.ev[i].id > s.ev[i - 1].id, 'events within a batch must be id-ordered');
    }
    for (const ev of s.ev) {
      assert.ok(typeof ev.tick === 'number' && ev.tick <= s.tick, 'event tick must not exceed its snapshot tick');
      assert.ok(typeof ev.seed === 'number', 'event carries a deterministic seed');
    }
    evs.push(...s.ev);
  }
  assert.ok(evs.length > 20, `expected generated events (muzzles/wall hits), got ${evs.length}`);
  for (let i = 1; i < evs.length; i++) {
    assert.ok(evs[i].id > evs[i - 1].id, 'ids across the whole stream must be monotonic');
  }
  assert.ok(evs.some(e => e.kind === 'muzzle'), 'shooting must produce muzzle events');
});

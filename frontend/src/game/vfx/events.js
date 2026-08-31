// Shared visual-event contract (spec: docs/reasonix/specs/visual-parity-sync.md).
// Pure + isomorphic: the authoritative simulation emits these at the exact
// branch where a gameplay effect occurs; clients convert them to cosmetics
// through vfx/recipes.js. Events NEVER alter gameplay state.

export function makeVfxState(seedRng) {
  return { vfx: [], _vfxSeq: 0, _seedRng: seedRng };
}

// Emit one visual event into a match/sink (m.tick, m.vfx, m._vfxSeq, m.fxRng).
// seed comes from the cosmetic fxRng stream (never the gameplay rng), so the
// same seed + inputs reproduce identical VFX on every client.
export function emitVfx(m, kind, x, y, opts = {}) {
  if (!m.vfx) m.vfx = [];
  if (m._vfxSeq == null) m._vfxSeq = 0;
  const seed = opts.seed != null
    ? opts.seed >>> 0
    : (m.fxRng ? (m.fxRng() * 0xffffffff) >>> 0 : 0);
  m.vfx.push({
    id: ++m._vfxSeq,
    tick: m.tick | 0,
    kind,
    x,
    y,
    actor: opts.actor,
    target: opts.target,
    tx: opts.tx,
    ty: opts.ty,
    bulletType: opts.bulletType,
    amount: opts.amount,
    pickup: opts.pickup,
    meta: opts.meta,
    seed,
  });
  return m.vfx[m.vfx.length - 1];
}

// Drain queued events (sim view layer + server snapshot batching).
export function drainVfx(m) {
  const out = m.vfx || [];
  m.vfx = [];
  return out;
}

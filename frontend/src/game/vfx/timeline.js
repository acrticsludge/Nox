// Display-only EffectTimeline (spec: docs/reasonix/specs/visual-parity-sync.md).
// Converts visual events into particles through the shared recipes and ages
// them independently of gameplay ticks — it advances at frame rate even when
// no new snapshot arrives, and snapshot application can never clear or replace
// active effects. Gameplay state is never read or written here.

import { spawnForEvent } from './recipes.js';

export class EffectTimeline {
  constructor(limit = 600) {
    this.parts = [];          // aging display particles
    this.limit = limit;
    this._seen = new Set();   // dedupe by event id (ordered stream guarantee)
    this._seenQueue = [];
  }

  // Ingest one event; returns false if it was a duplicate (already shown).
  ingest(ev) {
    if (!ev || ev.kind == null) return false;
    if (ev.id != null) {
      if (this._seen.has(ev.id)) return false;
      this._seen.add(ev.id);
      this._seenQueue.push(ev.id);
      if (this._seenQueue.length > 512) this._seen.delete(this._seenQueue.shift());
    }
    const spawned = spawnForEvent(ev);
    for (const p of spawned) {
      if (this._holdFrames > 0) p._hold = this._holdFrames;
      this.parts.push(p);
    }
    if (this.parts.length > this.limit) this.parts.splice(0, this.parts.length - this.limit);
    return true;
  }

  // Display scheduling: particles ingested while a hold is set stay invisible
  // (and unaged) for N frames — used by the online client to align effect
  // display with the interpolated state window.
  hold(frames) {
    this._holdFrames = Math.max(0, frames | 0);
    return this;
  }

  // Ambient, locally-generated particles (no event contract) — e.g. hazard
  // relocation poofs. Display-only, same aging rules.
  pushLocal(particles) {
    for (const p of particles) this.parts.push(p);
    if (this.parts.length > this.limit) this.parts.splice(0, this.parts.length - this.limit);
  }

  step(dt = 1) {
    const parts = this.parts;
    for (const p of parts) {
      if (p._hold > 0) { p._hold -= dt; continue; }
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= dt;
    }
    let w = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.life > 0) parts[w++] = p;
    }
    parts.length = w;
  }

  // Render source: only particles that are past their hold window.
  visible() {
    return this.parts.filter(p => !(p._hold > 0));
  }

  clear() {
    this.parts.length = 0;
  }
}

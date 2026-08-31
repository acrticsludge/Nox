# Spec: Cross-Mode Visual and Animation Parity

**Status:** Implemented (2026-08-31, branch `feat/visual-parity`)  
**Baseline:** Local Same-PC 1v1 is the reference for player model, shield/shell damage, bullet impacts, dash, pickup, hazard, death, and round-transition presentation.  
**Applies to:** local 1v1, Trials, and online 1v1.

## Problem

Online currently receives 30 Hz state snapshots and attempts to reconstruct effects by comparing bullet-array length, HP, and pickup positions in `applyNetSnapshot()`. That cannot recover the cause, tick, actor, or exact hit location of an event. It uses nondeterministic `Math.random()`, loses bullet identity when arrays shrink/reorder, never detects shield damage/break, dash, bounce, muzzle, hazard, or exact death effects, and does not advance the local `simMatch.fx` timeline between snapshots. `mirrorSimToLegacy()` also replaces the particle array wholesale.

Trials uses a separate legacy update path with its own effect helpers. It therefore drifts from local 1v1 in both the effect recipe and when an animation begins.

## Non-negotiable design

**Gameplay state and visual effects are separate streams.**

```text
authoritative simulation tick
  ├─ state snapshot (30 Hz): positions, hp, shield state, bullets, pickups, score
  └─ ordered visual event stream: exact things that happened on an exact tick
        -> client effect timeline (60 fps render, independently aged)
```

Do not send raw particles every frame. Do not infer authoritative effects from snapshots. Do not let VFX alter gameplay state.

## Shared effect event contract

```ts
type VfxKind =
  | 'muzzle' | 'dash' | 'hit' | 'needleBlock' | 'needleCrit'
  | 'cannonHit' | 'trickBounce' | 'trickHit'
  | 'shieldHit' | 'shieldBreak' | 'pickup' | 'heal'
  | 'lavaHit' | 'voidHit' | 'death' | 'roundEnd';

type VfxEvent = {
  id: number;          // monotonic per match; dedupe key
  tick: number;        // authoritative simulation tick
  kind: VfxKind;
  x: number;
  y: number;
  actor?: 0 | 1 | 'bot';
  target?: 0 | 1 | 'bot';
  bulletType?: 'standard' | 'needle' | 'cannon' | 'trick';
  amount?: number;     // damage/heal/shield damage/bounce count where relevant
  seed: number;        // deterministic cosmetic recipe seed
};
```

The simulation emits these events **at the same branch where it applies the state change**. A shared pure effect-recipe module converts each event into particles, shell/shield state, text, and short camera/player impact animation. The same recipe is used by local 1v1, Trials, and online.

## Visual timing rules

- Local 1v1 and Trials enqueue an event immediately at their local authoritative tick.
- Online server includes all events since the previous snapshot in its next snapshot, ordered by `id`. WebSocket ordering is retained; client deduplicates by id.
- Online client schedules event display against server tick plus the same interpolation delay used for remote state (start with 100 ms; measure and tune). It must not add an arbitrary extra frame delay.
- The client keeps a separate `EffectTimeline`; it advances on each `requestAnimationFrame`, even if no new snapshot arrives. Snapshot application must never clear or replace active effects.
- Use event seed, not `Math.random()`, for online VFX. Local mode may generate the same seed at event creation so screenshots/replays can be reproducible.
- State correction may reposition actors/bullets, but cannot replay a consumed event or erase a currently aging effect.

## Actor and shell/shield parity

Use one visual actor recipe for P1, P2, and Trials bot. Inputs differ only through a visual profile:

```ts
type ActorVisualProfile = {
  id: 0 | 1 | 'bot';
  bodyColor: string;
  glow: 'cyan' | 'pink' | 'amber';
  shape: 'player' | 'bot';
};
```

- Shield/shell damage event updates a short-lived shell-impact state with exact remaining shield HP.
- Shield-break event emits the same shard recipe in every mode.
- Hit, block, critical, cannon, trick bounce, lava, void, death, dash, muzzle, and pickup must map to one canonical recipe per event kind.
- Trials can have an amber bot profile and 2x arena scale, but not a distinct effect behavior unless explicitly declared as a Trials-only rule.

## Snapshot interpolation

Keep a small bounded snapshot buffer. Render remote actor/bullet state at `now - interpolationDelay`, interpolating between adjacent snapshots. Apply own-player prediction/reconciliation only after the event timeline is independent; do not make VFX depend on prediction.

Each bullet needs a stable `bulletId` if it remains represented in snapshots. This is useful for rendering/interpolation, but **not** a replacement for event messages.

## Implementation sequence

1. Add pure event types, seeded PRNG/effect recipes, and a display-only `EffectTimeline` with unit tests.
2. Convert local 1v1 sim effect creation to event emission + shared recipe. Screenshot-test or fixture-test each event kind.
3. Convert Trials hit/pickup/hazard/dash/death branches to emit the same events. Preserve its deliberate bot profile only.
4. Extend server snapshots with event batches and stable bullet identifiers; add event id/tick tests.
5. Replace online snapshot-diff FX reconstruction and particle-array mirroring with event ingestion plus snapshot interpolation.
6. Run three-mode parity matrix, compare shell/shield, bullet, dash, pickup, hazard, death, and round animations side-by-side.

## Acceptance criteria

- [ ] Online no longer uses HP/bullet/pickup snapshot diffs to synthesize effects.
- [ ] Effects animate at 60 fps between 30 Hz online snapshots and are neither frozen nor cleared by snapshot application.
- [ ] A shield hit/break, each bullet type, dash, pickup, lava, void, death, and round end trigger the same canonical recipe in all applicable modes.
- [ ] Each online event displays once under duplicate/out-of-order defensive handling.
- [ ] Network delay changes display time only; it does not change effect type, amount, source, or target.
- [ ] Local 1v1 gameplay behavior and server authority remain unchanged.

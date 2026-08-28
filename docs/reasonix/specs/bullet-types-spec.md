# Bullet Types — Spec (NEON VOID 1V1)

Status: Proposed
Date: 2026-08-29
Scope: `frontend/src/game/game-logic.js`, `frontend/src/components/GameShell.tsx`, `frontend/src/styles/global.css`, `frontend/src/pages/mockup.astro` (NOT `/play` until approved)
Owner: guest-only arena, no persistence, no ELO

## 1. Problem
- Single bullet (speed 7.2, radius 5, 1 dmg, cd 11) makes every duel identical; no risk/reward or positional play.
- `MAX_HP=5` is too coarse for varied damage (e.g. heavy 3 dmg = 60% HP in one hit, 2 hits = kill, feels binary).
- Emerging request: 4 archetypes — normal, rear-crit shell, slow heavy, ricochet with decay — needs crisp definition before code so health, UI, pickups, and physics don't drift.

## 2. Goals
- Add 4 balanced bullet types guest-playable on same keyboard without login.
- Keep TTK readable (normal ~5-6 hits, heavy ~3, rear 2 perfect flanks, ricochet rewards geometry).
- No ranking/ELO — only local session scores.
- Mockup-first: vectors + animations verifiable at `/mockup` before touching live `/play` / `/play/1v1`.

## 3. Non-Goals
- No ELO/MMR, no server storage, no matchmaking.
- No permanent loadout / shop; no pay-to-win.
- No new map geometry (reuse walls/hazards).

## 4. Users & Flow
Guest duo on one keyboard. Duel → grab ammo orb → next N shots are typed → flank/bounce/bomb decisions. On death ammo resets with `resetRound`. On heal/void still consistent.

## 5. Bullet Archetypes (balanced set)

### 5.1 Global invariants
- `PLAYER_R=16`, `BULLET_R` per type, `life` caps travel, `trail` 4 steps, `inv` after hit 28 (heavy 34), shield absorbs full typed damage before HP.
- Ammo orbs grant `p.ammoType + p.ammo` (count) or timed 7s; default `standard` infinite.

### 5.2 Types
| id | name (code) | visual | speed | radius | dmg | cooldown | life | ammo per orb | fantasy |
|---|---|---|---|---|---|---|---|---|
| `standard` | STANDARD (default, infinite) | white core `58d8ff`/`ff5ca8` glow, 4-step trail `0.35→0.07` | 7.2 | 5 | **see HP table** | 11 (183ms) | 90 | ∞ | honest duelist |
| `needle` | SHELL // NEEDLE (backstab) | violet `#a78bfa` needle `rx2`, 8.5 fast, thin `3.5`, 2-step | 8.5 | 3.5 | **front 0** (graze spark, no dmg, `inv 6`), **rear 6** if `HP=12` (see §6) | 14 (233ms) | 90 | 5 shots | flanker |
| `cannon` | HEAVY // CANNON | amber `#ffb23e` brick `14×8 rx2`, blocky slug `7`, ember | 3.8 | 7 | 4 | 32 (533ms) | 120 | 3 shots | tank |
| `trick` | RICOCHET // TRICK | cyan `58d8ff` diamond `r4` + bounce pips `·` | 6.2 | 4 | **decay per bounce**: `2.5 → 2.0 → 1.6 → 1.2 → 0.8` (HP=12) | 16 (267ms) | 180 | 6 shots | geometry |

Rear-crit rule (§5.2.1), ricochet decay formula (§5.2.2).

### 5.2.1 NEEDLE rear-hit math
Let `f = (cos p.angle, sin p.angle)` victim forward, `d = normalize(b.vx,b.vy)` bullet travel. `dot = f·d`. Rear if `dot > 0.5` (≈120° cone behind = victim running away from bullet). Side/front (`dot ≤ 0.5`) → 0 dmg + `hit spark violet` + `inv 6` + `text BLOCK`. Rear → 6 dmg + `crit star #a78bfa` + `+6` healText. Threshold tunable `0.5 → 0.35` if too strict.

### 5.2.2 RICOCHET decay & bounces
`bouncesMax 5`, wall `rectCircleCollide` → reflect: compute closest wall normal (pick smallest penetration axis: dl/dr/dt/db → normal). `reflect = v - 2*(v·n)*n`, damp `*0.96` per bounce, reposition `+ n*2` out of wall, spawn `spark`. `dmg(n) = floor(2.5 * 0.82^n * 2)/2` to keep 0.5 steps or integer table `5→4→3→2→1` if HP=10 variant. Lifetime extended to survive 5 bounces.

## 6. Health-Bar Rework (required)

### Why 5 fails
`5 HP, 1 dmg standard = STK 5`. Heavy 2.5 needs half-hearts (5 hearts = 10 halves, float rounding, heart sprite clipping). Rear 3 = 60% in one hit. Ricochet decay `2.5→0.8` can't resolve without floats. Shields `3` vs 5 mismatch.

### Recommended: MAX_HP 12 (integer, no halves)
- All damages integer, no rounding bugs, 12 divisible by 2/3/4/6.
- TTK: standard `2×6=12` → 6 hits`, heavy `4×3=12` → 3 hits, needle rear `6×2=12` → 2 perfect flanks, trick `~2.5 avg` → 5 hits median.
- Shield scaled `SHIELD_MAX_HP 5` (was 3), `HEAL 2` (was 1).
- HUD bar `width = hp/MAX_HP*100` unchanged formula; add 11 tick dividers (`repeating-linear-gradient 10%`) + `hp-text "6 / 12"`.
- In-arena `♥.repeat` replaced by 12 pips or segmented ticks to avoid 12 hearts overflow.
- Alternative options documented in plan §2 (keep 5 with halves, or 10 pips, or 100 internal).

### Alternatives (for decision)
- A: Keep 5 + halves (10 half-units internal, `hp=10` internally, display 5 hearts fractional). Minimal change but float UI.
- B: **12 integer (recommended)**.
- C: 10 integer (5 hearts ×2) — cleaner than 12 but heavy 3×4=12 not divisible nicely.
- D: 100 internal cyber (flexible, heavy 25 etc., bar 0-100) — best polish, most HUD work.

## 7. Functional Requirements
- FR1: Default shot is `standard` without pickup.
- FR2: Pickups `ammo_needle / ammo_cannon / ammo_trick` spawn like orbs (reuse `isValidPickupPos`, avoid hazards/walls/spawn).
- FR3: On pickup: `p.ammoType = kind; p.ammo = BULLET_TYPES[kind].ammo` (or timer 420). HUD chip shows type + count.
- FR4: `shoot(p)` reads `BULLET_TYPES[p.ammoType||'standard']`, pushes bullet with `{owner,type,dmg,speed,r,bounces,life,trial}`. Ammo--, when 0 → revert.
- FR5: `update` bullet loop: `move → wall check → if trick reflect else die → player hit → shield/hp → inv → kill`.
- FR6: HUD: `heartsP1/2` shows new MAX, damage shake, healed glow unchanged. Ammo chip near avatar/dash bar.
- FR7: Render: bullets per-type visuals (standard glow, needle violet, cannon amber block, trick diamond with `bounces` dots).
- FR8: `resetRound` clears `ammoType/ammo/bounces` and refills HP to MAX.
- FR9: Mockup: `/mockup` section 08 with 4 cards animated (muzzle + trail + hit) before live wiring.

## 8. Acceptance Criteria
- AC1 `/mockup` builds with 4 bullet cards looping, no `/play` change.
- AC2 Firing without orb = standard forever.
- AC3 Needle front = 0 hp change + block FX; rear within ~60° cone = 6 dmg.
- AC4 Cannon: visibly slower (~53% speed), big radius, 4 dmg, cd 32, shields broken in 2.
- AC5 Trick: bounces 5 times off walls, each bounce reduces dmg per table, spark per bounce.
- AC6 HP bar shows `X / 12` correctly at all hits; width matches; low pulse at ≤2.
- AC7 Ammo orb → next N shots typed → auto-revert; HUD counter decrements.
- AC8 No ELO code introduced; `localStorage` only `nv_speedGlobal` remains.
- AC9 Build `pnpm build` + manual duel shows TTK ~4-7s, no wall-stuck bullets.

## 9. Constraints
- 60fps fixed step (`SIM_STEP 1000/60`), `update(1)` must stay < 2ms.
- No `any`, strict TS, cyber theme ( `clip-path` chamfer, `c9ff2f/58d8ff/ff5ca8/ffb23e` only).
- Guest: `localStorage` only for speed; no auth.
- Walls are grid `40px`; precise `REQUIRED_WALL_GAP 34` untouched.

## 10. API / Interfaces
- `BULLET_TYPES: Record<BulletId,{speed,r,dmg,cd,life,bouncesMax,ammo,color,icon}>`
- `Player { ammoType?:BulletId, ammo:number, lastHitType?:BulletId }`
- `Bullet { type:BulletId, dmg:number, bounces:number, bouncesMax:number, life:number, trail:{x,y}[] }`
- `shoot(p:Player)` overload unchanged signature, internal switch per type.
- `updateHUD()` reads `window.NOX_GAME.MAX_HP` for display.

## 11. Data
- Constants `MAX_HP 12, SHIELD_MAX_HP 5, HEAL_AMOUNT 2`.
- Bullets `life` 90/90/120/180.
- Pickups `kind ∈ POWER_TYPES ∪ AMMO_TYPES`, `life 480` shared.

## 12. Observability / QA
- Count `shots_fired{type}`, `hits{type,rear}`, `bounces`, `ttk_round`.
- Debug overlay `?debug=bullets` shows `type dmg bounces`.

## 13. Rollout
- Branch `feat/bullet-types`.
- Step1 mockup PR, Step2 constants+shoot, Step3 wall bounce + rear math, Step4 HUD/render, Step5 balancing playtest, Step6 docs `how-modal`.
- Rollback: revert `MAX_HP 5` + delete `BULLET_TYPES` branch, or flag `ENABLE_TYPED_BULLETS=false`.

## 14. Open Questions
- Needle front 0 vs 0.5 graze? (spec says 0, recommend 0 + FX)
- Cannon audio/shake scope?
- Ammo: count vs timer — spec uses count (recommended) but timer works for trick.


# Bullet Types — Plan (balanced 4-way + HP rework)

Refer spec: `docs/reasonix/specs/bullet-types-spec.md`
No ELO. Guest only. Mockup-first.

## 1. Decision — HP rework
| Option | MAX | Dmg set (std/needleRear/cannon/trick0) | STK std/heavy | Pros | Cons | Verdict |
|---|---|---|---|---|---|---|
| A keep 5 + halves | 5 (10 halves internal) | 1 / 3 / 2.5 / 2.0→… | 5 / 2 | zero HUD rework, `hp 4.5/5` display | float rounding, heart half-clip work, decay akward | keep as fallback |
| **B 12 integer ← RECOMMENDED** | **12** | **2 / 6 / 4 / 2.5→2→1.5→1→0.5** | **6 / 3** | integer only, 12 divides 2/3/4/6, shield 5 heal 2 clean, bar 12 ticks, SVG hearts → pips easy | HUD + render touch, TTK +1 hit | **ship** |
| C 10 integer | 10 | 1 / 3 / 2 / 2→1.5→1 | 10 / 5 | decimal tidy, 10 ticks | heavy 3 vs std 1 is 3× feels spiky, shield 3→4 awkward | alt if 12 rejected |
| D 100 cyber | 100 | 18 / 45 / 34 / 22→… | 6 / 3 | most granular, matches `hp-fill` 0-100, future-proof | hearts gone, numbers shift, more QA | follow-on |

→ Implement **B 12**. Keep `A` codepath comment for revert (`MAX_HP_5_LEGACY=5`). `C`/`D` achievable by changing one constant + table.

## 2. Balancing Math (MAX_HP 12)
```
TTK (perfect accuracy, no whiff):
standard: 2*6 =12 → 6 hits ×183ms ≈1.10s + travel
needle  : 6*2 =12 → 2 perfect rears; front 0 (miss) punishes aim, needs flank → ~2-3s real
cannon  : 4*3 =12 → 3 hits ×533ms ≈1.60s but speed 3.8 makes 30% misses → ~2.5s, trades window vs dmg
trick   : 2.5+2.0+1.6+1.2+0.8 =8.1 mid ≈5 hits median → ~1.33s + bounces, rewards angle mastery
Invuln: standard 28, heavy 34, needle rear 30 (front keeps 6), trick 26
Shield 5: standard 3 to break, heavy 2 (4+4>5 but 4+1 would keep 1? tune), trick 3
```
Tune knobs without touching MAX: `speed, r, cd, dmg table, bouncesMax, dot threshold`.

## 3. Architecture
```
game-logic.js
  const BULLET_TYPES = {standard:{…}, needle:{front:0,rear:6,dot:0.5}, cannon:{…}, trick:{decay 0.82}}
  Player { ammoType?, ammo, lastShot }
  Bullet { type, dmg, bounces, bouncesMax, vx,vy }
  shoot(p) → switch type → push Bullet + muzzle typed + ammo--
  update: bullets[i] { move; wall = hitWall? trick? reflect: die; player: dot>0.5? dmgRear: dmgFront }
  spawnPickupSoon: weighted {over:20 shield:18 blink:22 heal:10 needle:10 cannon:10 trick:10}
  updateHUD: hearts → 12 ticks, ammo chip
  render: branch on b.type for fill/stroke/trail/bounces pips
  resetRound: clear ammo, hp=12
GameShell.tsx
  PlayerHUD: hearts "X / 12" + ammo chip (icon + ×N) + type glow
  CenterHUD unchanged
global.css
  .ammo-chip.{needle|cyan|…} + hp ticks 12 (repeating-linear 8.33%) + bullet glows
mockup.astro
  §08 four cards animated per type (muzzle/trail/hit/bounce) with damage labels
```
No new deps, `requestAnimationFrame` fixed-step safe.

## 4. Task Breakdown (vertical slices, verify each)

### T0 Mockup-only (no game change)
- Files: `frontend/src/pages/mockup.astro`
- Add `§08 // BULLET LAB` grid 2×2: Standard (cyan 4-step trail), Needle (violet needle + BLOCK vs CRIT rear flip), Cannon (amber brick 14×8, slow ember trail, big hit), Trick (cyan diamond 5 bounces with pips dimming). Each 320×100 loop.
- Verify: `pnpm build` 4 pages 700ms, `/mockup` anims smooth.

### T1 Constants + types + shoot
- Files: `game-logic.js:1-42`
- Add `BULLET_TYPES`, bump `MAX_HP 12, SHIELD_MAX_HP 5, HEAL_AMOUNT 2`, new pickup kinds `ammo_needle/cannon/trick`. Extend `players[].ammoType/ammo`.
- Rewrite `shoot` per type: speed/r/cd/dmg/life/bounces, `p.ammo--` revert.
- Verify: `node -c` + build, manual `NOX_GAME.BULLET_TYPES` logged.

### T2 Needle rear logic + invuln
- Files: `game-logic.js:750-795`
- In player-hit branch: if `b.type===needle` compute `dot`, if `dot<=0.5` → `inv=6` spark violet 0 dmg, else `hp-=6 inv=30`. Emit healText `BLOCK/CRIT +6`.
- Verify: unit test `dot 1 → rear`, `dot 0 → front`, duel: front 0, rear 6.

### T3 Ricochet wall bounce
- Files: `game-logic.js:750-795`
- Helper `reflectBullet(b, wall)` → normal from min penetration (dl/dr/dt/db), `vx = vx -2*dot*nx`, `vy = vy-2*dot*ny`, `*0.97`, `bounces++`, `dmg = table[bounces]`, reposition 2px. On `hitWall` if `type===trick && bounces<5 → reflect` else die. Life 180.
- Add trail array per type length 4/2/6/5.
- Verify: shoot trick at wall → 5 bounces visible, dmg 5→4→3, corner not stuck, speed damp.

### T4 HP bar rework (12)
- Files: `game-logic.js:1329-1393`, `GameShell.tsx:210-272`, `global.css:623-702`
- `updateHUD` pct `hp/12*100`, `hp-text "6 / 12"`, `low` at `hp<=2`, `hearts.damage/healed` unchanged. `heal` caps 12, `shieldHp` 5.
- In `render` `hpArc` replace `♥.repeat` with 12 pips `|` small rect or `■` with dim, or keep but allow 12.
- CSS `.hearts::after` 12 ticks `repeating-linear 8.33%`, `.ammo-chip` styles.
- GameShell HUD: ammo chip under `status-row` reading `NOX_GAME.players[0].ammoType`.
- Verify: hearts bar 12 ticks aligns, damage 2→strip 16.6%, heavy 4→33%, heal +2.

### T5 Pickup weighting + HUD ammo + render per-type
- Files: `game-logic.js:429-462, 694-727, 1068-1092`
- Add `AMMO_TYPES` to `pickRandomPowerKind` weights, `spawnPickupSoon` lab avoid. `pickup` branch for ammo sets `ammoType/ammo`. HUD `PowerChip` 4th slot or new `AmmoChip`. Render bullets switch fill/stroke: needle `#a78bfa` radius 3.5, cannon `#ffb23e` brick `w12 h6`, trick diamond `r4` + trailing pips `bounces`.
- Verify: orbs spawn violet/amber/cyan, pickup gives count, HUD decrements, render distinct.

### T6 How-to + balancing polish
- Files: `GameShell.tsx:519-629` modal §04 Bullets table, `global.css` how-orb new variants.
- Playtest TTK, tune `dot 0.5→0.35` if rear too hard, `cannon speed 3.8→4.2` if too whiffy.
- Verify: `how-modal` shows 4 bullets with icons + dmg, build, manual 5-min duel feels 5-7s TTK.

## 5. Dependencies
T0 alone → T1 → T2+T3 parallel → T4 (needs T1) → T5 (needs T1+T4) → T6.
No DB migration, no API.

## 6. Verification
- `pnpm build` (frontend).
- Manual: 1) standard 6 to kill, 2) needle front 0 rear 6, 3) cannon 3 to kill slow, 4) trick 5 bounces dmg popups 5→1.
- Edge: shield absorbs typed dmg correctly, void/hazard unchanged, `MAX_HP` change doesn't break `prevHp` or `endRound HP advantage`.
- Snapshot: `/mockup` bullets vs `/play/1v1` parity.

## 7. Rollback
- Flag `ENABLE_TYPED_BULLETS = false` → shoot ignores type.
- Revert commit: `MAX_HP 5` + delete `BULLET_TYPES` + restore old `shoot` 10 lines.

## 8. Docs to update after ship
- `frontend/src/styles/global.css` header comment bullet types
- `docs/design/DESIGN.md` tokens if new colors (needle violet)
- This plan + spec retained under `docs/reasonix/`


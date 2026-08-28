# NOX 1V1 — Engagement Deep Dive + Plan

**Date:** 2026-08-28
**Scope:** How to make 1V1 (same-keyboard duel, 60s, first-to-5) stay engaging past 5 duels. Not yet live — mockup at `/mockup` only.
**Method:** Play audit of `frontend/src/game/game-logic.js` + `GameShell.tsx` + online research on TowerFall / Samurai Gunn / Nidhogg / Duck Game / Stick Fight / Lethal League / Brawlhalla / arena shooter design.

---

## 1. What NOX Has Today (Audit)

**Core loop:** `move/dash/shoot → grab orb (over/shield/blink/heal) → survive lava/slime/void → first-to-5` `frontend/src/game/game-logic.js:16-25` `frontend/src/components/GameShell.tsx:526`

**What’s good:**
- 60fps SVG, no canvas, crisp cyber HUD (`global.css:1167` cyber badges/timer)
- Relocating hazards `8-12s` `game-logic.js:30` + wall-gap `34px` fix
- Forfeit winner flow `1.8s` round win → `PLAYER X WINS BY FORFEIT!`

**Why it dies after 3-5 duels (observed):**
- **No novelty after map learning:** 4 hazards, 4 orbs, 1 arena seed per round — once you learn void at 45s, every duel is same.
- **No evolution / skill ceiling visible:** Dash is only tech; no parry, wall-bounce, weapon drop, or ranking → no reason to get better.
- **No creativity / agency:** Orbs random, walls random, but player can’t shape them. No mutators, no store, no choice at round end.
- **Low “tension arc”:** Round is flat 60s → void at 45s → spike, then reset. No overtime, no comeback orbs.
- **Weak feedback:** Emoji orbs `GameShell.tsx:569` `⚡ ❄ ✦ ✚` + soft glows — not crisp, hit feels blunt (fixed in mockup, not shipped).

---

## 2. How The Best Do It (Research Synthesis)

### TowerFall (4P archery, 1-hit, 3 arrows) — The Gold Standard for Couch 1V1
*Source: Wikipedia TowerFall + Steam discussions*
- **One-hit, limited ammo, arrow retrieval = tension.** You have 3 shots, then you must dash to reclaim. Samurai Gunn discussion: “TowerFall default has more depth due to different pick-ups like Smash Bros.” — variety without imbalance.
- **Arrows warp screen edges + jump pads + crowns.** Level is a toy, not a box. “Levelest playing field, no scrambling for power-ups that unbalance” — Samurai Gunn praised for *no* RNG power-ups, TowerFall praised for *balanced* pick-ups. Lesson: if you add orbs, make them trade-offs, not win-buttons.
- **Novelty via kits:** Treasure chests drop lasers, bombs, drilling arrows — but you *choose* to pick them up. Miss and it stays. Lesson for NOX: make orbs *opt-in* risk (e.g., standing on lava-adjacent tile to grab).

### Samurai Gunn (3 verbs: jump/shoot/sword, one-hit, parry)
*Source: Steam Shamurai Gunn vs Nidhogg threads*
- **3 verbs, infinite depth:** “You can run upside down, spikes you can form, deformable terrain that grows back, water jams gun, crushing platforms reversible by hitting, play dead in bodies.” Depth comes from *level verbs*, not character stats.
- **4-10s round, no health bar.** Tension is instant. “Gets incredibly tense” in 1v1 because one mistake = death. NOX has 5 HP → 3-4 hits to kill → lower tension. Consider `1-2 HP` variant.
- **Criticism:** “Gets boring after 20min if no more modes.” Lesson: even perfect 1v1 needs map/mutator rotation.

### Nidhogg (High/Mid/Low thrust + parry/disarms + Y-axis)
*Source: Wikipedia Nidhogg + design article*
- **Depth via Yomi:** high/mid/low guards, disarm, sword throw, divekick, sweep, throw → “tug-of-war closer to NFL than Street Fighter.” Same 2-button look, 7-way read.
- **Variants keep it alive:** Low gravity, boomerang swords, spine swords, no divekick, baby crawl. “Most mutators pointless except boomerang” — lesson: 2-3 killer mutators > 8 filler.
- **Environment % is depth:** Tall grass hides, tunnels block jump/throw. NOX maps are flat — add 2-3 interactives.

### Duck Game / Stick Fight (Physics + Weapon Lottery)
*Source: GameRant + etail.market*
- **Weapon lottery = novelty each 10s.** Next weapon spawns random; you must adapt. Duck Game has 50+ weapons, 1-hit, level hazards.
- **Physics = creativity:** Stick Fight’s “over-the-top noisy brawls, crazy physical movements” → emergent stories. NOX is deterministic; add one physics toy (e.g., knockback into lava).

### Lethal League Blaze (Ball = shared health)
- **Ball speeds up + hit angle matters.** One object both players fight over → natural focus. NOX orb is *you* get it, *you* win. Consider **one central orb** both chase (king-of-hill) vs 4 random.

### Brawlhalla (Platform fighter, 80M players, F2P)
*Source: Wikipedia Brawlhalla 2022 + wiki.gg*
- **Evolution pillar:** 68 legends, ranked 1v1 Strikeout (pick 3 chars, 1 stock each), Experimental queue weekly rotation, Clan XP, battle pass. Retention is *ladder*, not content.
- **Simple controls, one-button special.** Low floor, infinite ceiling. “Simple controls and one-button special moves” → anyone can play, mastery is spacing.
- **Weekly featured mode rotation** → novelty without building new maps.

### Arena Shooter Design (MakeUseOf, PCGamesN, Arc Raiders 2026)
- **Key:** Spawn loadout + map-contained upgrades. Fast strafe, rocket jump, portals/jump pads. Maps `Time-to-contact 3-8s` micro, `10-20s` small. NOX TtC is `~2s` (140px spawn gap) — good. But no portals/pads → no vertical escape.
- **Failure:** AAA arena shooters died when they ignored tone + onboarding. Indies win on *juice* and *spectacle*.

### Replayability Theory (YSR Studio 2025)
- **Novelty:** New content each run (branching, chars, procgen). **Creativity:** Player canvas (level editor, loadout choice). **Evolution:** Mastery depth (rank, tech). Anti-patterns: **Staleness** (see same orb), **Inhibition** (no tools), **Stagnation** (no rank).

---

## 3. Gap Analysis → NOX

| Pillar | Best-in-class | NOX now | Missing |
|---|---|---|---|
| **Novelty** | TowerFall chests, Duck weapon lottery, Brawlhalla weekly mode | 4 orbs random, 4 hazards relocate, 1 void pattern | No map kits, no weapon lottery, no weekly mutator, no biome |
| **Creativity** | Samurai Gunn deformable bamboo, Nidhogg grass tunnels, Stick physics | Hazards relocate but player can’t shape | No wall break, no pad, no orb deny, no loadout pick |
| **Evolution** | Nidhogg Yomi, Brawlhalla Strikeout rank, Slay the Spire macro | First-to-5, no rank, no tech, 5 HP mutes tension | No streak, no ELO, no tech skill, no crown |

---

## 4. Plan — Prioritized for 1V1 Same-Keyboard

### P0 — Ship with `/mockup` vectors (1-2 days, unblock feel)
- **Why:** Emojis `⚡` blur → `GameShell.tsx:569` mockup `A/B/C` is crisp. Players judged “blurry” before feeling loop.
- **What:** Ship **A // RAZOR** (hairline 1.6px, star muzzle 6pt, 4-step trail alpha 0.9→0.25, 5px slug) for players/bullets/hits. Keep B/C for later. Replace `render()` `frontend/src/game/game-logic.js:950` bullet/particle paths. Add `hitstop 60ms` + `screenshake 3px` on `hp--`.
- **Success:** Hit feels crisp, not floaty.

### P1 — Tension + Skill Ceiling (2-3 days, stops boredom at 20min)
1. **Parry on dash (Samurai Gunn):** If `dash >0` and bullet within `8px`, deflect → `vx*=-1` + `+1s overcharge`. Code: `bullets` loop `p.dash>0 && len2 < 14 → parry`. High Yomi, low code.
2. **1-hit sudden death option (mutator):** Mode variant `HP=1` (toggle in hub). Samurai/Nidhogg proof: one-hit = instant tension. Keep `5 HP` as default, add `// SUDDEN DEATH` card at hub `accent amber`.
3. **Wall bounce bullet (TowerFall):** Add `wallBounce` orb (new `POWER_TYPES` `ricochet: 2 bounces, 1.5x trail`). Cheap novelty, players learn angles.

### P2 — Novelty Loop (3-5 days, stops staleness)
4. **Central contested orb (Lethal League):** Instead of 4 random, spawn **1 CYAN core at 480,280** every `12s` → both race. First touch gets `+1s` buff, but standing in core ticks `+1 score` per `3s` (KOTH). Forces centre fight, counters camping.
5. **Map kits (TowerFall chests):** At `round 2/4` drop a kit crate `“GRAPPLE” | “BOMB WALL” | “ICE TIP”` — pick to gain one-round mod (grapple `+dash to wall`, bomb `shoot to break 1 wall`, ice `slime freezes lava 5s`). Lasts 1 round, then gone. Novelty without permanent imbalance.
6. **Daily seed + 2 biomes:** Keep one `NOIR` (current) + add `FORGE` (brutalist 0-radius walls from mockup C) + `PLASMA` (rounded). Seed = date string, shareable in footer `SEED 2026-08-28`. 3 lines in `generateRandomWalls()` `if (biome==="forge") wallGrad = ... rx=0`.

### P3 — Evolution / Retention (1 week, stops stagnation)
7. **Streak + Crown + Rank (Brawlhalla):** `localStorage` `nox_streak` `nox_elo` (simple `1200 ± 24*(W/L - expected)`). Show `CROWN` on winner `hud-topline` + `STREAK x3 🔥` in `CenterHUD`. Rank badge `CYBER-BADGE --lime` `SILVER I 1140`. No backend needed.
8. **Rematch wager (Nidhogg tournament):** After `0-2` etc., offer `“WAGER: double or nothing? First to 2 from 0-0”` button in `GameOverOverlay`. Creates comeback narrative, not just `REMATCH`.
9. **Ghost / Input replay (Arc Raiders telemetry):** Record `players` positions per tick to `localStorage` `nox_ghost_<mode>` (last winning run, 60*60 ints). Add `“BEAT GHOST”` card at hub — you race your own best.

### Not now (avoid)
- Online netcode, DM, monetization, level editor — inhibit pure local feel. Do after P0-P3 validate.

---

## 5. What To Show Next (Mockup → Play)

Already shipped mockup at `/mockup` — keep it **not live**. To validate plan:
1. Ship **P0 RAZOR** vectors to `/play/1v1` (1 day).
2. Add `SUDDEN DEATH` mutator card at hub `/play` (1 line in `modes[]` + `if (mode==="sudden") MAX_HP=1`).
3. Playtest 10 duels with 2 friends: measure `duels per session` before/after. Target `duels 4 → 9`, `rematch rate 30% → 65%`.

---

## 6. Risks + Mitigations
- **Too much RNG (Stick Fight) → “lost to dice”:** Keep `void` + wall gap deterministic `34px` `wallGap()`, only orb/kit random.
- **Blurry re-adds:** Enforce `1.6px` hairline, no `feGaussianBlur >3` on players.
- **Scope creep:** Hub is `/play` → each mode `src/pages/play/<slug>.astro` already scalable. Add modes by pushing to `modes[]`, not refactoring hub (user asked to remove scalable wording — keep hub copy user-facing, code stays scalable).

---

## 7. Open Question for You
Pick **ONE** P1 + **ONE** P2 to ship next week:
- **A) Parry + Central Orb** (skill + tension)
- **B) Sudden Death + Map Kits** (novelty + variety)
- **C) Crown/Streak + Ghost** (retention)

Tell me `A/B/C` or `ship RAZOR now` and I’ll implement without touching `/play` hub copy.

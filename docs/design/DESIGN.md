# Nox — Design System

**Status:** Implemented (canonical)
**Date:** 2026-08-28
**Applies to:** `frontend/` — landing page (`/`, Astro + Astryx) and game page (`/play`)

This document is the single source of truth for Nox's visual design. Any new
UI must use these tokens — **not** ad-hoc hex values.

## Principles

- **Dark editorial neon.** Near-black canvas, one electric lime primary, three
  accent hues, monospace-first typography. Confident, a little dangerous —
  not corporate, not toy-like.
- **Restrained.** Max 3 accents + 1 primary per surface. Flat/glassy surfaces,
  hairline borders, square radius (`0`). No purple-on-black gradient washes,
  no heavy glassmorphism, no rainbow.
- **Functional colors are semantic, not brand.** Heal green, lava orange/red,
  slime green, danger red are *status/hazard* colors — they stay even though
  they are outside the accent set.

## Palette (design tokens)

| Token | Hex | Usage |
|---|---|---|
| `--nox-bg` | `#07090b` | page / arena background |
| `--nox-surface` | `#0c1012` | panels, stage |
| `--nox-card` | `#0a0e10` | cards |
| `--nox-border` | `#1b2427` | hairline borders |
| `--nox-fg` | `#f1f4f3` | primary text |
| `--nox-muted` | `#879397` | secondary text |
| `--nox-lime` | `#c9ff2f` | **primary accent** — CTA, brand mark, blink |
| `--nox-cyan` | `#58d8ff` | **Player 1**, dash, shield |
| `--nox-pink` | `#ff5ca8` | **Player 2** |
| `--nox-amber` | `#ffb23e` | overcharge, the Void, hazard warnings |
| `--success` | `#22c55e` | heal (functional) |
| `--lava` | `#fb923c` `#f97316` `#dc2626` | lava hazard (functional) |
| `--slime` | `#10b981` `#6ee7b7` | slime hazard (functional) |
| `--danger` | `#ef4444` | dash-cooldown / damage (functional) |

Shade variants used in the game: cyan light `#a9e9ff`, cyan dark `#3ec5f2`;
pink light `#ff9ec9`, pink dark `#f43f5e`; amber light `#ffd9a6`, amber dark
`#ff9d2e`; lime light `#d9ff7a`.

## Astryx token mapping

The landing themes Astryx through the documented CSS-variable bridge. Tokens
are overridden in `frontend/src/styles/global.css` (`:root`):

| Astryx token | Value |
|---|---|
| `--color-accent` / `--color-on-accent` | `#c9ff2f` / `#07090b` |
| `--color-background-body/surface/card` | `#07090b` / `#0c1012` / `#0a0e10` |
| `--color-background-cyan/pink/orange` | `rgba(88,216,255,.07)` / `rgba(255,92,168,.07)` / `rgba(255,178,62,.07)` |
| `--color-border` (+ cyan/pink/orange) | `#1b2427` (+ 45% tinted) |
| `--color-text-primary/secondary` | `#f1f4f3` / `#879397` |
| `--font-family-body/heading/code` | Courier New mono stack (`--nox-mono`) |
| `--radius-container/element/page/inner` | `0` / `2px` / `0` / `0` |

## Typography

- **Mono-first:** `'Courier New', ui-monospace, monospace` everywhere
  (`--nox-mono`, wired to Astryx `--font-family-*`).
- **Display:** hero title `clamp(76px, 13vw, 172px)`, line-height `.78`,
  tracking `-.085em`, weight 800; the second line uses a transparent fill with
  a 1px `-webkit-text-stroke` outline. Section titles
  `clamp(48px, 7vw, 82px)`.
- **Labels:** 10–12px mono, uppercase, `letter-spacing .08em–.2em`
  (eyebrows, kickers, keycaps, status).

## Components (landing — Astryx only)

- Page composed **only** of Astryx: `Section`, `Card`, `Button`, `Badge`,
  `Link`, `Heading`, `Text`, `HStack`/`VStack`/`Grid`.
- **How-to-play cards:** `Card` `variant="cyan|pink|orange"` + a 2px
  `card-accent-*` top border. Card accents map to the orb glyphs: dash=cyan,
  shield=pink, gravity=amber, split=lime.
- **CTA:** `Button variant="primary"` (accent-filled, square radius).
- **Status:** `Badge variant="cyan"` with a glowing lime dot.

## Game page (`/play`) color mapping (old → new)

The game was re-themed from the legacy palette to the design tokens:

| Legacy | New | Role |
|---|---|---|
| `#070a12` `rgba(7,10,18,*)` | `#07090b` `rgba(7,9,11,*)` | background |
| `#38bdf8` `rgba(56,189,248,*)` | `#58d8ff` `rgba(88,216,255,*)` | Player 1 |
| `#0ea5e9` | `#3ec5f2` | P1 dark |
| `#7dd3fc` / `#bae6fd` | `#a9e9ff` | P1 light / shield crack |
| `#60a5fa` / `#3b82f6` | `#58d8ff` | P1 text / avatar |
| `#fb7185` `rgba(251,113,133,*)` | `#ff5ca8` `rgba(255,92,168,*)` | Player 2 |
| `#ec4899` / `#e11d48` | `#f43f5e` | P2 dark / ship |
| `#fda4af` | `#ff9ec9` | P2 light |
| `#8b5cf6` `#a78bfa` `rgba(139,92,246,*)` `rgba(167,139,250,*)` | `#c9ff2f` `rgba(201,255,47,*)` | violet → lime (blink, Void ring) |
| `#c4b5fd` | `#d9ff7a` | light lime (Void text) |
| `#06b6d4` `rgba(6,182,212,*)` | `#58d8ff` | old cyan accent |
| `#fbbf24` `rgba(251,191,36,*)` | `#ffb23e` `rgba(255,178,62,*)` | overcharge → amber |
| `#f59e0b` | `#ff9d2e` | amber dark |
| `#fed7aa` / `#fde68a` | `#ffd9a6` / `#ffe9a8` | light amber |
| `#1e1b4b` `rgba(30,27,75,*)` | `#0f1218` | arena gradient (de-indigo) |
| `rgba(99,102,241,*)` | `rgba(23,32,36,*)` | grid lines (de-indigo) |
| `rgba(10,14,26,.85)` | `rgba(12,16,18,.85)` | stage |
| keep | — | neutrals (`#fff` `#111` `#334155` `#0f172a` `#020617`) and functional colors (heal/lava/slime/danger) |

> Note: the SVG glow filters (`feColorMatrix` in `glowCyan`/`glowPink`) remain
> approximate glows tuned loosely to the new hues — acceptable as-is.

## Where tokens live

- Design tokens + Astryx overrides: `frontend/src/styles/global.css` (`:root`).
- The game page keeps its styles in-page; colors there now match this table.
- **Rule:** no new UI may introduce a color outside this palette. When in
  doubt, extend this document first.

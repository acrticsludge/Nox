# Nox — Landing Page Mockup Prompts (Google Stitch)

**Status:** Proposed (for mockup generation — build follows once a mockup is chosen)
**Date:** 2026-08-28
**Branch:** `feat/astro-vercel-frontend`

## Purpose

Generate 2–3 mockup candidates for the **minimal landing page** that only
explains how the game works. The chosen mockup will be rebuilt 1:1 with
**Astryx (`@astryxdesign/core`)** components inside the Astro frontend, so
every mockup region below maps to a real Astryx component (see mapping table).

## Game identity (keep this consistent across all prompts)

- **Name:** NOX (in-game title: NEON VOID)
- **Genre:** 2-player same-keyboard arena duel, 60 s rounds, first to 5 wins
- **Palette:** near-black background `#070A12`; cyan `#38bdf8` (Player 1);
  magenta `#fb7185` (Player 2); violet accent `#8b5cf6`; subtle grid backdrop
- **Aesthetic:** dark, glassy, restrained neon — clean cards with soft
  1px borders, rounded corners, one accent glow per section (no cyberpunk
  clutter, no heavy gradients, no skeuomorphism)

## Required landing content (the only things the page may say)

1. Title **NOX** + one-line pitch: *"A fast 2-player arena duel — one
   keyboard, first to 5 wins."*
2. **How to play** (the core of the page — 3 or 4 compact blocks):
   - **Move & Dash** — P1: `WASD` + `Shift` + `Space` · P2: arrows + `/` + `Enter`
   - **Grab Orbs** — ⚡ triple shot · ❄ shield (3 HP) · ✦ dash reset · ✚ heal
   - **Survive** — lava burns, slime slows, the Void crushes after 45 s
3. One call-to-action: **Play** (primary button)
4. Minimal footer (© Nox, one line)

---

## Prompt A — Centered hero + 3 "how to play" cards (recommended default)

> Dark, minimal video-game landing page, desktop 16:9. Near-black background
> `#070A12` with a faint blue-violet grid. Centered composition.
> Top: small monogram logo mark (a violet diamond ◈) with the word "NOX" to
> its left. Below it, one line of large bold white text: "A fast 2-player
> arena duel — one keyboard, first to 5 wins." Under it, one violet primary
> button labeled "Play".
> Middle of the page: a horizontal row of 3 equal cards with soft 1px borders
> and rounded corners. Card 1 (cyan accent) titled "Move & Dash" with two
> small keyboard-key glyphs. Card 2 (violet accent) titled "Grab Orbs" with
> four tiny icons: lightning, snowflake, sparkle, cross. Card 3 (magenta
> accent) titled "Survive the Void" with a small flame icon and a shrinking
> circle icon.
> Bottom: single thin line of small gray footer text.
> Style: glassy dark UI, restrained neon glow on the accents only, flat
> minimal cards, generous whitespace, no clutter, no gradients across the
> whole page. Only the text shown above — no other words or numbers anywhere.

## Prompt B — Split hero with arena preview + 3-step "how to play"

> Dark, minimal video-game landing page, desktop 16:9. Background near-black
> `#070A12` with a faint grid. Two-column hero: left column has the word "NOX"
> in large bold white type, a short violet secondary line "One keyboard. Two
> fighters. First to 5.", and a violet "Play" button. Right column shows a
> small stylized dark arena square with a glowing cyan triangle ship facing a
> glowing magenta triangle ship and a few dashed rings (no UI, no text inside).
> Below the hero: a full-width row of 3 numbered steps — "1 MOVE & DASH",
> "2 GRAB ORBS", "3 SURVIVE THE VOID" — each a small card with one icon and
> two lines of tiny gray supporting text.
> Bottom: thin centered gray footer line.
> Style: glassy dark minimal UI, one accent color per card (cyan, violet,
> magenta), soft 1px borders, rounded corners, restrained glow, whitespace,
> no gradients, no other text anywhere.

## Prompt C — App-style one-pager with top nav

> Dark, minimal video-game landing page, desktop 16:9. Near-black background
> `#070A12`. Slim top navigation bar: left is a violet diamond monogram +
> "NOX"; right has two small ghost buttons "How to play" and a filled violet
> "Play".
> Hero: large white title "NEON VOID", one line of gray sub-text
> "2-player arena duel — first to 5 wins", violet primary "Play" button.
> Below: a 2x2 grid of compact cards: "CONTROLS" (cyan, showing W A S D and
> four arrow keys as tiny keycaps), "POWER ORBS" (violet, four tiny icons:
> lightning, snowflake, sparkle, cross), "HAZARDS" (orange, small flame and
> blob icons), "THE VOID" (magenta, a shrinking circle). Each card has 1–2
> lines of small gray text.
> Bottom: thin gray footer.
> Style: glassy dark app UI, soft borders, rounded corners, restrained neon
> accents only on icons, whitespace, no gradients, no other text.

---

## Usage tips (Google Stitch)

- **Aspect ratio:** 16:9 desktop for all prompts; ask Stitch for a
  `landscape` / `16:9` canvas. A mobile 9:16 variant can be generated later
  by appending: *"same design, single-column mobile layout, 9:16 portrait."*
- **Text:** image models garble long text — prompts intentionally keep
  on-screen words to the short list above. Expect minor glyph errors; treat
  the mockup as layout + aesthetic reference, not pixel-perfect typography.
- **Iteration levers** (append one at a time): *"more whitespace"* ·
  *"smaller accent glow"* · *"higher contrast text"* · *"reduce card borders
  to hairline"* · *"move the Play button above the fold"*.
- **Dark/light:** append *"light mode version, white background"* if a light
  variant is wanted for comparison.

## Astryx component mapping (for the chosen mockup → build)

| Mockup region | Astryx component |
|---|---|
| Page shell / top nav | `AppShell` (top-nav slot) or `Layout` + `LayoutHeader` |
| Hero / sections | `Section` (variant `muted` / `transparent`) |
| How-to-play blocks | `Card` (variant `cyan` / `purple` / `pink` / `orange`), `Stack`+`Grid` from `Layout` |
| Icons / keycap glyphs | `NavIcon`, inline SVG via `Stack` (no image assets) |
| CTA / ghost buttons | `Button` (`primary`, `ghost`, sizes `sm`/`lg`) |
| Power-orb tags / status | `Badge` (`cyan`, `purple`, `pink`, `green`, `yellow`) |
| Optional FAQ | `CollapsibleGroup` + `Collapsible` |
| Footer links | `Link` |
| Theme | `Theme` + `defineTheme` tokens (`--color-accent`, `--color-background-surface`, `--radius-container`, `--spacing-1..6`) — dark `mode: 'dark'` |

> Note: Astryx is a React component library (`@astryxdesign/core`), so the
> Astro build will render these via the `@astrojs/react` integration (static
> server render + minimal client islands). The game arena itself stays
> framework-free vanilla JS modules.

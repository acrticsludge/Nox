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
- **Color direction (generator owns the hues):** dark base (near-black),
  neon glow accents, subtle grid backdrop. Up to **three accent hues chosen
  by the generator**: one cool + one warm player accent that clearly oppose
  each other, plus one action accent for the CTA. **No hex values or specific
  color names are prescribed anywhere in these prompts** — the generator
  decides the actual colors.
- **Aesthetic:** dark, glassy, restrained neon — clean cards with soft
  1px borders, rounded corners, one accent glow per section (no cyberpunk
  clutter, no heavy gradients, no skeuomorphism)

## Anti-slop guardrails (apply to every prompt)

The generator picks the colors; these rules stop it from falling back to
generic AI defaults:

- No default purple-on-black / blue-neon cliché gradient washes.
- No rainbow — maximum 3 accent hues total (2 player + 1 action).
- No heavy glassmorphism or blur overload — glassy but restrained.
- Text stays high-contrast on the dark base (readable, ~WCAG AA).
- No text beyond the short whitelist below; no fake UI chrome, no decorative
  floating particles.
- Tone: minimal, confident, a little dangerous — not corporate, not toy-like.

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
> with a faint subtle grid. Centered composition.
> Top: small monogram logo mark (a diamond ◈) in an accent color of your
> choosing, with the word "NOX" to its left. Below it, one line of large bold
> white text: "A fast 2-player arena duel — one keyboard, first to 5 wins."
> Under it, one primary button in the action accent color of your choosing,
> labeled "Play".
> Middle of the page: a horizontal row of 3 equal cards with soft 1px borders
> and rounded corners. Card 1 (a cool accent hue of your choosing) titled
> "Move & Dash" with two small keyboard-key glyphs. Card 2 (a second accent
> hue of your choosing, clearly distinct from card 1) titled "Grab Orbs" with
> four tiny icons: lightning, snowflake, sparkle, cross. Card 3 (a third
> accent hue of your choosing, clearly distinct from the other two) titled
> "Survive the Void" with a small flame icon and a shrinking circle icon.
> Bottom: single thin line of small gray footer text.
> Style: glassy dark UI, restrained neon glow on the accents only, flat
> minimal cards, generous whitespace, no clutter, no gradients across the
> whole page. Choose the accent hues yourself — do not fall back to the
> default blue/purple/pink AI palette. Only the text shown above — no other
> words or numbers anywhere.

## Prompt B — Split hero with arena preview + 3-step "how to play"

> Dark, minimal video-game landing page, desktop 16:9. Background near-black
> with a faint grid. Two-column hero: left column has the word "NOX" in large
> bold white type, a short secondary line in an accent color of your choosing
> — "One keyboard. Two fighters. First to 5." — and a "Play" button in the
> action accent color of your choosing. Right column shows a small stylized
> dark arena square with one glowing triangle ship in a cool accent hue facing
> one glowing triangle ship in a warm accent hue (your choice), and a few
> dashed rings (no UI, no text inside).
> Below the hero: a full-width row of 3 numbered steps — "1 MOVE & DASH",
> "2 GRAB ORBS", "3 SURVIVE THE VOID" — each a small card with one icon and
> two lines of tiny gray supporting text, each card in a distinct accent hue
> of your choosing.
> Bottom: thin centered gray footer line.
> Style: glassy dark minimal UI, soft 1px borders, rounded corners,
> restrained glow, whitespace, no gradients. Choose the accent hues yourself —
> do not fall back to the default blue/purple/pink AI palette. No other text
> anywhere.

## Prompt C — App-style one-pager with top nav

> Dark, minimal video-game landing page, desktop 16:9. Near-black background
> with a faint grid. Slim top navigation bar: left is a diamond monogram in an
> accent color of your choosing + "NOX"; right has two small ghost buttons
> "How to play" and a filled "Play" button in the action accent of your
> choosing.
> Hero: large white title "NEON VOID", one line of gray sub-text
> "2-player arena duel — first to 5 wins", primary "Play" button in the action
> accent of your choosing.
> Below: a 2x2 grid of compact cards, each in a distinct accent hue of your
> choosing: "CONTROLS" (showing W A S D and four arrow keys as tiny keycaps),
> "POWER ORBS" (four tiny icons: lightning, snowflake, sparkle, cross),
> "HAZARDS" (small flame and blob icons), "THE VOID" (a shrinking circle).
> Each card has 1–2 lines of small gray text.
> Bottom: thin gray footer.
> Style: glassy dark app UI, soft borders, rounded corners, restrained neon
> accents only on icons, whitespace, no gradients. Choose the accent hues
> yourself — do not fall back to the default blue/purple/pink AI palette. No
> other text anywhere.

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
- **Color iteration** (steer without naming hexes): *"warmer overall tone"* ·
  *"cooler player accents"* · *"make the two player colors more opposed"* ·
  *"swap the action accent for a higher-energy hue"*.
- **Dark/light:** append *"light mode version, white background"* if a light
  variant is wanted for comparison.
- **Palette → build:** once a mockup is chosen, its exact hues are extracted
  and encoded into the Astryx theme tokens (`defineTheme`: `--color-accent`,
  `--color-background-surface`, `--radius-container`, …) so the generator's
  colors are preserved in the real UI. The in-game arena ships (currently
  cyan/magenta) get re-themed to the chosen palette during the build.

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

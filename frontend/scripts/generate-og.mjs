/**
 * Generates NOX OG image 1200x630 from the real gamebox SVG.
 * Background is the actual arena: grid, walls, pickups, players, bullets, void.
 * No external native deps required for SVG output.
 * If sharp is available, rasterizes to PNG. Otherwise writes SVG and copies as PNG fallback.
 * No em dashes.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, "..", "public")
const OUT_SVG = path.join(OUT_DIR, "og.svg")
const OUT_PNG = path.join(OUT_DIR, "og.png")

const W = 1200
const H = 630

// Tokens must match global.css
const BG = "#07090b"
const ARENA_BG = "#020617"
const GRID = "#172024"
const GRID_DOT = "#2a3438"
const WALL = "#0f172a"
const WALL_LINE = "rgba(255,255,255,0.09)"
const LIME = "#c9ff2f"
const CYAN = "#58d8ff"
const PINK = "#ff5ca8"
const AMBER = "#ffb23e"
const FG = "#f1f4f3"
const MUTED = "#879397"

// Arena geometry is 960x560. In OG we render it centered and scaled slightly
// so it fills the background behind the title. We draw arena at 1000x583 scaled
// to fit with margins.

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Fixed cool arena layout for OG - same as hero preview but frozen frame
// Walls: 3 blocks that look good at 1.2x scale
const walls = [
  { x: 280, y: 140, w: 14, h: 110 },
  { x: 260, y: 340, w: 110, h: 14 },
  { x: 640, y: 300, w: 14, h: 130 },
  { x: 520, y: 170, w: 140, h: 14 },
]

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
<title id="title">NOX // NEON VOID - Two players one void</title>
<desc id="desc">Cyber arena snapshot with grid, walls, two players, bullets and pickups in NOX neon theme</desc>
<defs>
  <linearGradient id="arenaGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${ARENA_BG}"/>
    <stop offset="100%" stop-color="#0f1218"/>
  </linearGradient>
  <linearGradient id="titleGrad" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${LIME}"/>
    <stop offset="55%" stop-color="${CYAN}"/>
    <stop offset="100%" stop-color="${PINK}"/>
  </linearGradient>
  <pattern id="gridPat" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 H 0 V 40" fill="none" stroke="#213035" stroke-width="0.85" stroke-opacity="0.9"/>
  </pattern>
  <filter id="glowCyan" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="3" result="b"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.345  0 0 0 0 0.847  0 0 0 0 1  0 0 0 0.55 0"/>
  </filter>
  <filter id="glowPink" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="3" result="b"/>
    <feColorMatrix type="matrix" values="1 0 0 0 0.18  0 0 0 0 0.05  0 0 0 0 0.36  0 0 0 0.55 0"/>
  </filter>
  <filter id="glowLime" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="2.5" result="b"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.788  0 0 0 0 1  0 0 0 0 0.184  0 0 0 0.5 0"/>
  </filter>
  <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="5"/>
  </filter>
  <linearGradient id="wallGrad" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/>
    <stop offset="22%" stop-color="rgba(255,255,255,0)"/>
  </linearGradient>
</defs>

<!-- base -->
<rect width="${W}" height="${H}" fill="${BG}"/>

<!-- subtle grid + vignette -->
<rect width="${W}" height="${H}" fill="url(#gridPat)" opacity="0.9"/>
<rect width="${W}" height="${H}" fill="none" stroke="${GRID}" stroke-width="1" opacity="0.5"/>
<circle cx="620" cy="315" r="420" fill="none" stroke="rgba(201,255,47,0.06)" stroke-width="1" stroke-dasharray="6 10" opacity="0.9"/>
<circle cx="620" cy="315" r="520" fill="none" stroke="rgba(88,216,255,0.05)" stroke-width="1" stroke-dasharray="2 14" opacity="0.7"/>

<!-- arena frame centered at 120, 58 - sized 960x514 scaled to fit 1200x630 with top space for title -->
<!-- We draw arena background clipped -->
<g transform="translate(120, 78)">
  <g clip-path="url(#arenaClip)">
  </g>
  <defs>
    <clipPath id="arenaClip">
      <path d="M 8 0 H 960 V 506 H 952 V 514 H 0 V 8 H 8 Z" />
    </clipPath>
  </defs>
  <!-- arena bg -->
  <path d="M 8 0 H 960 V 506 H 952 V 514 H 0 V 8 H 8 Z" fill="url(#arenaGrad)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <rect x="0" y="0" width="960" height="514" fill="url(#gridPat)" opacity="0.55"/>
  <!-- inner grid dots -->
  <g opacity="0.10">
    <circle cx="80" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="120" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="160" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="200" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="240" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="280" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="320" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="360" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="400" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="440" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="480" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="520" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="560" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="600" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="640" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="680" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="720" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="760" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="800" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="840" cy="80" r="0.9" fill="${GRID_DOT}"/><circle cx="880" cy="80" r="0.9" fill="${GRID_DOT}"/>
  </g>

  <!-- void rings faded in corners -->
  <g opacity="0.32" fill="none" stroke="${LIME}" stroke-width="1.2">
    <path d="M 120 0 V 40 H 80" stroke-dasharray="4 7"/>
    <path d="M 840 0 V 40 H 880" stroke-dasharray="4 7"/>
    <path d="M 120 514 V 474 H 80" stroke-dasharray="4 7"/>
    <path d="M 840 514 V 474 H 880" stroke-dasharray="4 7"/>
  </g>

  <!-- walls - true 1:1 block rendering with highlight -->
  ${walls
    .map(
      (w) => `
  <g>
    <rect x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" rx="1.8" fill="${WALL}" stroke="rgba(255,255,255,0.07)" stroke-width="0.9"/>
    <rect x="${w.x}" y="${w.y}" width="${w.w}" height="${Math.min(2.2, w.h)}" rx="1" fill="url(#wallGrad)"/>
  </g>`
    )
    .join("")}

  <!-- slime puddle -->
  <g opacity="0.95">
    <path d="M 340 380 Q 360 320 420 320 Q 490 320 520 380 Q 500 400 420 400 Q 350 400 340 380 Z" fill="#065f46" stroke="#10b981" stroke-width="1.15"/>
    <ellipse cx="372" cy="346" rx="13" ry="5" fill="rgba(255,255,255,0.18)"/>
    <ellipse cx="452" cy="362" rx="22" ry="8" fill="rgba(16,185,129,0.2)"/>
  </g>

  <!-- lava vent warning + lava core -->
  <g>
    <circle cx="700" cy="152" r="18" fill="none" stroke="${AMBER}" stroke-width="1.1" stroke-dasharray="4 3" opacity="0.85"/>
    <circle cx="700" cy="152" r="11" fill="none" stroke="rgba(251,146,60,0.35)" stroke-width="0.7"/>
    <circle cx="700" cy="152" r="7.5" fill="#7c2d12" stroke="${AMBER}" stroke-width="0.9"/>
    <path d="M 695 150 Q 698 147 702 150 T 706 152" stroke="#fb923c" stroke-width="1" fill="none" opacity="0.95"/>
  </g>

  <!-- pickups - three orb types with orbiting dots -->
  <g>
    <!-- needle - violet -->
    <circle cx="500" cy="122" r="18" fill="rgba(167,139,250,0.18)" filter="url(#softGlow)"/>
    <circle cx="500" cy="122" r="13" fill="#7c3aed" stroke="#fff" stroke-opacity="0.18" stroke-width="0.8"/>
    <circle cx="500" cy="122" r="13" fill="none" stroke="rgba(167,139,250,0.55)" stroke-width="0.9"/>
    <text x="500" y="128" text-anchor="middle" font-family="monospace" font-size="11" font-weight="800" fill="#fff">N</text>
    <g fill="rgba(167,139,250,0.9)">
      <circle cx="500" cy="104" r="1.6"/><circle cx="515" cy="122" r="1.6"/><circle cx="500" cy="140" r="1.6"/>
    </g>
  </g>
  <g>
    <!-- cannon - amber -->
    <circle cx="340" cy="208" r="18" fill="rgba(255,178,62,0.16)" filter="url(#softGlow)"/>
    <circle cx="340" cy="208" r="13" fill="#ff9d2e" stroke="rgba(0,0,0,0.35)" stroke-width="0.7"/>
    <text x="340" y="214" text-anchor="middle" font-family="monospace" font-size="11" font-weight="800" fill="#0f1a1e">C</text>
    <g fill="rgba(255,178,62,0.95)">
      <circle cx="340" cy="190" r="1.6"/><circle cx="355" cy="208" r="1.6"/><circle cx="340" cy="226" r="1.6"/>
    </g>
  </g>
  <g>
    <!-- trick - cyan -->
    <circle cx="620" cy="402" r="18" fill="rgba(88,216,255,0.16)" filter="url(#softGlow)"/>
    <circle cx="620" cy="402" r="13" fill="#22c5e0" stroke="rgba(0,0,0,0.25)" stroke-width="0.7"/>
    <text x="620" y="408" text-anchor="middle" font-family="monospace" font-size="11" font-weight="800" fill="#0f1a1e">T</text>
    <g fill="rgba(88,216,255,0.95)">
      <circle cx="620" cy="384" r="1.6"/><circle cx="635" cy="402" r="1.6"/><circle cx="620" cy="420" r="1.6"/>
    </g>
  </g>

  <!-- power orb - overcharge center -->
  <g>
    <circle cx="480" cy="267" r="18" fill="rgba(255,178,62,0.16)" filter="url(#softGlow)"/>
    <circle cx="480" cy="267" r="13" fill="#ff9d2e" stroke="#fff" stroke-width="1.2"/>
    <path d="M 474 258 L 471 267 L 477 267 L 474 276 L 486 263 L 478 263 L 484 258 Z" fill="#fff"/>
  </g>

  <!-- bullets - frozen mid flight with trails -->
  <!-- P1 cyan needle shot + trick bounce -->
  <g opacity="0.95">
    <circle cx="242" cy="258" r="5" fill="#fff" stroke="${CYAN}" stroke-width="1.2"/>
    <circle cx="232" cy="258" r="2.2" fill="#a9e9ff" opacity="0.65"/>
    <circle cx="224" cy="258" r="1.4" fill="#a9e9ff" opacity="0.32"/>
  </g>
  <g opacity="0.95">
    <polygon points="318,242 324,258 318,274 302,258" fill="#fff" stroke="${LIME}" stroke-width="0.9"/>
    <circle cx="310" cy="258" r="1.2" fill="${LIME}"/>
    <circle cx="298" cy="258" r="1.6" fill="#a9e9ff" opacity="0.5"/>
  </g>
  <!-- P2 pink cannon and standard -->
  <g opacity="0.95">
    <circle cx="720" cy="268" r="7" fill="#fff" stroke="${PINK}" stroke-width="1.4"/>
    <circle cx="720" cy="268" r="2.3" fill="${PINK}"/>
    <circle cx="710" cy="268" r="3" fill="${PINK}" opacity="0.35"/>
  </g>
  <g opacity="0.95">
    <circle cx="680" cy="382" r="5" fill="#fff" stroke="${PINK}" stroke-width="1.2"/>
    <circle cx="690" cy="382" r="1.8" fill="#ff9ec9" opacity="0.6"/>
  </g>

  <!-- hit sparks near walls -->
  <g transform="translate(294, 164)" opacity="0.95">
    <circle cx="0" cy="0" r="1.2" fill="#fff"/>
    <g stroke="${CYAN}" stroke-width="0.9"><line x1="0" y1="-7" x2="0" y2="-11"/><line x1="5" y1="-5" x2="7.8" y2="-7.8"/><line x1="7" y1="0" x2="11" y2="0"/></g>
    <circle cx="0" cy="0" r="6.5" fill="none" stroke="#fff" stroke-width="0.55" opacity="0.28"/>
  </g>

  <!-- players - razor dart 18 -11 -8 -12 11 with white cockpit -->
  <!-- P1 cyan - at 210 258 facing 12 deg -->
  <g transform="translate(210, 258) rotate(14)">
    <ellipse cx="0" cy="13" rx="14" ry="4.5" fill="rgba(0,0,0,0.35)"/>
    <path d="M 18 0 L -12 -11 L -8 0 L -12 11 Z" fill="#3ec5f2" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="0" cy="0" r="5" fill="#fff"/>
    <circle cx="1.4" cy="-0.7" r="1.8" fill="${CYAN}"/>
    <!-- shield crack hint -->
    <circle cx="0" cy="0" r="13" fill="none" stroke="${CYAN}" stroke-width="0.9" stroke-dasharray="3 3" opacity="0.85"/>
  </g>
  <!-- P2 pink - at 740 268 facing -168 deg -->
  <g transform="translate(740, 268) rotate(-168)">
    <ellipse cx="0" cy="13" rx="14" ry="4.5" fill="rgba(0,0,0,0.35)"/>
    <path d="M 18 0 L -12 -11 L -8 0 L -12 11 Z" fill="#f43f5e" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="0" cy="0" r="5" fill="#fff"/>
    <circle cx="1.4" cy="-0.7" r="1.8" fill="${PINK}"/>
    <path d="M -10 0 L -20 -5 L -22 0 L -20 5 Z" fill="#ff9ec9" opacity="0.95"/>
  </g>

  <!-- arena border highlight -->
  <path d="M 8 0 H 960 V 8 H 8 Z" fill="rgba(255,255,255,0.08)"/>
</g>

<!-- top scrim for title legibility -->
<rect x="0" y="0" width="${W}" height="118" fill="url(#topScrim)" opacity="1"/>
<defs>
  <linearGradient id="topScrim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${BG}" stop-opacity="0.96"/>
    <stop offset="55%" stop-color="${BG}" stop-opacity="0.88"/>
    <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
  </linearGradient>
</defs>

<!-- bottom scrim -->
<rect x="0" y="470" width="${W}" height="160" fill="url(#botScrim)"/>
<defs>
  <linearGradient id="botScrim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${BG}" stop-opacity="0"/>
    <stop offset="45%" stop-color="${BG}" stop-opacity="0.92"/>
    <stop offset="100%" stop-color="${BG}" stop-opacity="1"/>
  </linearGradient>
</defs>

<!-- title lockup centered -->
<g transform="translate(600, 54)">
  <!-- tiny eyebrow -->
  <g transform="translate(-600, 0)">
    <rect x="24" y="18" width="32" height="1" fill="${LIME}" opacity="0.95"/>
    <text x="64" y="22" font-family="Courier New, monospace" font-size="10" letter-spacing="3.2" fill="${LIME}" font-weight="700">TWO PLAYERS. ONE VOID.</text>
    <!-- status on right -->
    <g transform="translate(1080, 12)">
      <rect x="0" y="0" width="96" height="18" rx="0" fill="rgba(88,216,255,0.08)" stroke="rgba(88,216,255,0.28)"/>
      <rect x="8" y="7" width="6" height="6" fill="${LIME}" transform="rotate(45 11 10)"/>
      <text x="20" y="12" font-family="Courier New, monospace" font-size="7" letter-spacing="1.2" fill="${CYAN}" font-weight="800">ONLINE // 60S</text>
    </g>
  </g>
  <!-- NOX -->
  <text text-anchor="middle" font-family="Courier New, monospace" font-size="84" font-weight="800" letter-spacing="-6" fill="url(#titleGrad)" style="paint-order: stroke; stroke: rgba(255,255,255,0.08); stroke-width: 0.6px;">NOX</text>
  <text x="88" y="-14" font-family="Courier New, monospace" font-size="11" letter-spacing="3.5" fill="rgba(241,244,243,0.75)" font-weight="700">//</text>
  <text text-anchor="middle" y="38" font-family="Courier New, monospace" font-size="30" font-weight="800" letter-spacing="9" fill="${FG}">NEON VOID</text>
  <text text-anchor="middle" y="56" font-family="Courier New, monospace" font-size="9.5" letter-spacing="2.8" fill="${MUTED}">SAME KEYBOARD • FIRST TO 5 • 60S ROUNDS</text>
</g>

<!-- bottom meta bar -->
<g transform="translate(24, 590)">
  <g opacity="0.9">
    <rect width="14" height="14" fill="none" stroke="${LIME}" stroke-width="0.9" transform="rotate(45 7 7)"/>
    <rect x="4.2" y="4.2" width="5.6" height="5.6" fill="${LIME}"/>
  </g>
  <text x="22" y="11" font-family="Courier New, monospace" font-size="10" letter-spacing="2.6" fill="${FG}" font-weight="700">NOX</text>
  <text x="52" y="11" font-family="Courier New, monospace" font-size="9" letter-spacing="1.2" fill="rgba(135,147,151,0.7)">// NEON VOID</text>
  <text x="600" y="11" text-anchor="middle" font-family="Courier New, monospace" font-size="8.5" letter-spacing="1.6" fill="rgba(135,147,151,0.85)">BUILT WITH SVG • NO CANVAS • 60FPS</text>
  <text x="1176" y="11" text-anchor="end" font-family="Courier New, monospace" font-size="8" letter-spacing="1.4" fill="${MUTED}">34° 12' 08" N  118° 14' 37" W</text>
</g>

<!-- lime top hairline -->
<rect x="0" y="0" width="${W}" height="1.5" fill="${LIME}" opacity="0.95"/>
</svg>`

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(OUT_SVG, svg, "utf8")
console.log(`[og] wrote ${OUT_SVG} (${Buffer.byteLength(svg)} bytes)`)

// try to rasterize with sharp if available
let didPng = false
try {
  const sharp = (await import("sharp")).default
  const buf = Buffer.from(svg)
  await sharp(buf).resize(W, H, { fit: "cover" }).png({ compressionLevel: 9 }).toFile(OUT_PNG)
  console.log(`[og] rasterized PNG via sharp -> ${OUT_PNG}`)
  didPng = true
} catch (e) {
  console.log(`[og] sharp not available, will copy SVG to PNG fallback. Install sharp for true PNG. Error: ${e.message}`)
}

if (!didPng) {
  // Write SVG content as og.png fallback is not valid PNG but crawlers may still show svg.
  // Instead we copy svg and also create a placeholder png by writing svg bytes to png path.
  // Better: just copy svg to png so at least something exists and build does not 404.
  // Real PNG will be generated on Vercel if sharp is added.
  try {
    fs.copyFileSync(OUT_SVG, OUT_PNG)
    console.log(`[og] fallback: copied svg to ${OUT_PNG} (install sharp for real PNG)`)
  } catch {}
}

console.log(`[og] done. Ensure site.webmanifest and favicon point to og.png`)

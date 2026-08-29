/**
 * Generates NOX OG image 1200x630 using the real arena screenshot as background.
 * User supplied bg is the source of truth. This script composites the cyber title
 * lockup over it with scrims so the arena shows through but text stays legible.
 * No em dashes.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, "..", "public")
const OUT_SVG = path.join(OUT_DIR, "og.svg")
const OUT_PNG = path.join(OUT_DIR, "og.png")
const BG_CANDIDATES = [
  path.join(OUT_DIR, "og-bg-clipboard.png"),
  path.join(OUT_DIR, "og-bg.png"),
  path.join(OUT_DIR, "og-bg.jpg"),
]

const W = 1200
const H = 630

const BG = "#07090b"
const LIME = "#c9ff2f"
const CYAN = "#58d8ff"
const PINK = "#ff5ca8"
const FG = "#f1f4f3"
const MUTED = "#879397"

function findBg() {
  for (const p of BG_CANDIDATES) if (fs.existsSync(p)) return p
  return null
}

const overlaySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="titleGrad" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${LIME}"/>
    <stop offset="55%" stop-color="${CYAN}"/>
    <stop offset="100%" stop-color="${PINK}"/>
  </linearGradient>
  <linearGradient id="topScrim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${BG}" stop-opacity="0.96"/>
    <stop offset="55%" stop-color="${BG}" stop-opacity="0.86"/>
    <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="botScrim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${BG}" stop-opacity="0"/>
    <stop offset="40%" stop-color="${BG}" stop-opacity="0.88"/>
    <stop offset="100%" stop-color="${BG}" stop-opacity="1"/>
  </linearGradient>
  <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="3"/>
  </filter>
</defs>

<!-- top scrim for title -->
<rect x="0" y="0" width="${W}" height="160" fill="url(#topScrim)"/>
<!-- bottom scrim -->
<rect x="0" y="470" width="${W}" height="160" fill="url(#botScrim)"/>
<!-- subtle vignette -->
<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

<!-- title lockup -->
<g transform="translate(600, 62)">
  <g transform="translate(-600, 0)">
    <rect x="24" y="18" width="32" height="1" fill="${LIME}" opacity="0.95"/>
    <text x="64" y="22" font-family="Courier New, monospace" font-size="10" letter-spacing="3.2" fill="${LIME}" font-weight="700">TWO PLAYERS. ONE VOID.</text>
    <g transform="translate(1080, 12)">
      <rect x="0" y="0" width="96" height="18" fill="rgba(88,216,255,0.09)" stroke="rgba(88,216,255,0.28)"/>
      <rect x="8" y="7" width="6" height="6" fill="${LIME}" transform="rotate(45 11 10)"/>
      <text x="20" y="12" font-family="Courier New, monospace" font-size="7" letter-spacing="1.2" fill="${CYAN}" font-weight="800">ONLINE // 60S</text>
    </g>
  </g>
  <text text-anchor="middle" font-family="Courier New, monospace" font-size="86" font-weight="800" letter-spacing="-6" fill="url(#titleGrad)" style="paint-order: stroke; stroke: rgba(255,255,255,0.10); stroke-width: 0.7px; filter: drop-shadow(0 2px 10px rgba(0,0,0,0.55));">NOX</text>
  <text x="88" y="-14" font-family="Courier New, monospace" font-size="11" letter-spacing="3.5" fill="rgba(241,244,243,0.78)" font-weight="700">//</text>
  <text text-anchor="middle" y="38" font-family="Courier New, monospace" font-size="30" font-weight="800" letter-spacing="9" fill="${FG}" style="filter: drop-shadow(0 2px 10px rgba(0,0,0,0.68));">NEON VOID</text>
  <text text-anchor="middle" y="56" font-family="Courier New, monospace" font-size="9.5" letter-spacing="2.8" fill="rgba(241,244,243,0.74)">SAME KEYBOARD • FIRST TO 5 • 60S ROUNDS</text>
</g>

<!-- bottom meta bar - brighter for legibility over real screenshot -->
<g transform="translate(24, 590)">
  <g opacity="0.96">
    <rect width="14" height="14" fill="none" stroke="${LIME}" stroke-width="0.9" transform="rotate(45 7 7)"/>
    <rect x="4.2" y="4.2" width="5.6" height="5.6" fill="${LIME}"/>
  </g>
  <text x="22" y="11" font-family="Courier New, monospace" font-size="10" letter-spacing="2.6" fill="${FG}" font-weight="700">NOX</text>
  <text x="52" y="11" font-family="Courier New, monospace" font-size="9" letter-spacing="1.2" fill="rgba(241,244,243,0.78)">// NEON VOID</text>
  <text x="600" y="11" text-anchor="middle" font-family="Courier New, monospace" font-size="8.5" letter-spacing="1.6" fill="rgba(241,244,243,0.82)">BUILT WITH SVG • NO CANVAS • 60FPS</text>
  <text x="1176" y="11" text-anchor="end" font-family="Courier New, monospace" font-size="8" letter-spacing="1.4" fill="rgba(241,244,243,0.68)">34° 12' 08&#34; N  118° 14' 37&#34; W</text>
</g>

<!-- top lime hairline -->
<rect x="0" y="0" width="${W}" height="1.6" fill="${LIME}" opacity="0.96"/>
<!-- bottom hairline subtle -->
<rect x="0" y="${H - 1}" width="${W}" height="1" fill="rgba(255,255,255,0.06)"/>
</svg>`

async function main() {
  const bgPath = findBg()
  if (!bgPath) {
    console.error("[og] no bg found, looked for", BG_CANDIDATES.join(", "))
    console.error("[og] falling back to old synthetic - please add og-bg-clipboard.png")
    process.exit(1)
  }
  console.log(`[og] using bg ${bgPath}`)
  // keep a copy as og-bg.png for traceability
  const permBg = path.join(OUT_DIR, "og-bg.png")
  if (bgPath !== permBg && !fs.existsSync(permBg)) {
    try { fs.copyFileSync(bgPath, permBg); console.log(`[og] copied bg to ${permBg}`) } catch {}
  }

  // also write overlay svg for inspection
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(OUT_SVG, overlaySvg, "utf8")
  console.log(`[og] wrote overlay svg ${OUT_SVG} (${Buffer.byteLength(overlaySvg)} bytes)`)

  let didPng = false
  try {
    const sharp = (await import("sharp")).default
    // 1. create base: bg resized to cover 1200x630, with a slight dark boost
    const base = await sharp(bgPath)
      .resize(W, H, { fit: "cover", position: "center" })
      .modulate({ brightness: 1.08, saturation: 1.05 })
      .toBuffer()

    // 2. composite overlay
    await sharp(base)
      .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
      .png({ compressionLevel: 9, palette: false })
      .toFile(OUT_PNG)

    console.log(`[og] composited PNG -> ${OUT_PNG} (bg cover + overlay)`)
    didPng = true
  } catch (e) {
    console.log(`[og] sharp failed: ${e.message}`)
    console.log(e.stack)
  }

  if (!didPng) {
    // fallback: just write a dark bg with overlay text as svg copied to png path
    try {
      fs.copyFileSync(path.join(OUT_DIR, "og-bg-clipboard.png"), OUT_PNG)
      console.log(`[og] fallback: copied bg to ${OUT_PNG}`)
    } catch {}
  }

  // verify output exists and report size
  try {
    const st = fs.statSync(OUT_PNG)
    console.log(`[og] done. ${OUT_PNG} ${st.size} bytes, ${W}x${H}`)
  } catch {}
}

await main()

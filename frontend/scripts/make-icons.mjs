import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pub = path.join(__dirname, "..", "public")
const svg = fs.readFileSync(path.join(pub, "favicon.svg"))
await sharp(svg).resize(180, 180).png().toFile(path.join(pub, "apple-touch-icon.png"))
console.log("apple ok")
await sharp(svg).resize(32, 32).png().toFile(path.join(pub, "favicon-32.png"))
console.log("favicon 32 ok")
await sharp(svg).resize(32, 32).png().toFile(path.join(pub, "favicon.ico"))
console.log("ico ok")

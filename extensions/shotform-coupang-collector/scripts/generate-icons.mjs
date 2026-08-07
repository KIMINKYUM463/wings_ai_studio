import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import sharp from "sharp"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(__dirname, "..", "icons")
fs.mkdirSync(dir, { recursive: true })

async function make(size, name) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="100%" height="100%" rx="${Math.round(size * 0.2)}" fill="#f97316"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial,sans-serif" font-size="${Math.round(size * 0.42)}" font-weight="700" fill="#fff">W</text>
</svg>`
  await sharp(Buffer.from(svg)).png().toFile(path.join(dir, name))
}

await Promise.all([make(16, "icon16.png"), make(48, "icon48.png"), make(128, "icon128.png")])
console.log("icons ok →", dir)

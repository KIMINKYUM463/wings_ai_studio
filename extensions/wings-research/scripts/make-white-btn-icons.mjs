import sharp from "sharp"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const logo = path.join(root, "assets", "wings-logo.png")

async function makeWhiteCirclePng(outPath, size) {
  const mark = await sharp(logo)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toBuffer()

  const circleSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/>` +
      `</svg>`
  )

  await sharp(circleSvg)
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(outPath)
  console.log("wrote", path.relative(root, outPath))
}

const outs = [
  ["icons/wings-btn-16.png", 16],
  ["icons/wings-btn-32.png", 32],
  ["icons/wings-btn-48.png", 48],
  ["icons/wings-btn-64.png", 64],
  ["icons/wings-btn-128.png", 128],
  ["assets/wings-mark-white.png", 128],
]

for (const [rel, size] of outs) {
  await makeWhiteCirclePng(path.join(root, rel), size)
}

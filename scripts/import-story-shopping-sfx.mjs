import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sourceDir = path.resolve(
  process.argv[2] || "C:\\Users\\a\\Downloads\\효과음_모음집"
)
const targetDir = path.join(root, "public", "story-shopping-sfx")
const catalogFile = path.join(root, "lib", "story-shopping-sfx-catalog.ts")
const supportedExtensions = new Set([".mp3", ".wav", ".m4a", ".mp4"])
const collator = new Intl.Collator(["ko", "en"], {
  numeric: true,
  sensitivity: "base",
})

function cleanLabel(filename) {
  const extension = path.extname(filename)
  let label = path.basename(filename, extension)
  try {
    label = decodeURIComponent(label)
  } catch {
    // 잘못된 퍼센트 인코딩은 원문을 유지합니다.
  }
  return label
    .normalize("NFKC")
    .replace(/^\s*\d{1,3}(?:[\s._-]+|(?=[^\d]))/, "")
    .replace(/\s+by\s+.+?\s+Id-\d+\s*$/i, "")
    .replace(/\s*\(Download MP3\)\s*$/i, "")
    .replace(/\s*-\s*Sound Effect(?:\s*\(HD\))?\s*$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.-]+|[\s.-]+$/g, "")
    .trim()
}

if (!fs.existsSync(sourceDir)) {
  throw new Error(`효과음 폴더를 찾을 수 없습니다: ${sourceDir}`)
}

const files = fs
  .readdirSync(sourceDir, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() &&
      supportedExtensions.has(path.extname(entry.name).toLowerCase())
  )
  .map((entry) => entry.name)
  .sort((left, right) => collator.compare(left, right))

fs.mkdirSync(targetDir, { recursive: true })
for (const existing of fs.readdirSync(targetDir)) {
  if (/^sfx-\d{3}\.(?:mp3|wav|m4a|mp4)$/i.test(existing)) {
    fs.rmSync(path.join(targetDir, existing))
  }
}

const items = files.map((filename, index) => {
  const number = index + 1
  const id = String(number).padStart(3, "0")
  const extension = path.extname(filename).toLowerCase()
  const targetName = `sfx-${id}${extension}`
  fs.copyFileSync(path.join(sourceDir, filename), path.join(targetDir, targetName))
  return {
    id,
    number,
    label: cleanLabel(filename) || `효과음 ${number}`,
    src: `/story-shopping-sfx/${targetName}`,
  }
})

const source = `/** 자동 생성 파일 — scripts/import-story-shopping-sfx.mjs */\n\n` +
  `export type StoryShoppingSfxCatalogItem = {\n` +
  `  id: string\n  number: number\n  label: string\n  src: string\n}\n\n` +
  `export const STORY_SHOPPING_SFX_CATALOG: readonly StoryShoppingSfxCatalogItem[] = ${JSON.stringify(items, null, 2)} as const\n`

fs.writeFileSync(catalogFile, source, "utf8")
console.log(`효과음 ${items.length}개를 가져왔습니다.`)
console.log(targetDir)
console.log(catalogFile)

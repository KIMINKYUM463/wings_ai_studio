import fs from "fs"

const src =
  "C:/Users/a/.cursor/projects/c-Users-a-Downloads-duplicate-of/agent-tools/747e9049-0680-44b2-b587-dcb1eac87083.txt"
const text = fs.readFileSync(src, "utf8")
const lines = text
  .split(/\r?\n/)
  .filter(
    (l) =>
      /^\s*\|\s*[^|]+\s*\|\s*[^|]+\s*\|\s*/.test(l) &&
      !l.includes("---") &&
      !l.includes("영어")
  )

const map = {}
for (const line of lines) {
  const cells = line
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean)
  for (let i = 0; i + 1 < cells.length; i += 2) {
    const en = cells[i]
    const ko = cells[i + 1]
    if (en && ko && en !== "영어") map[en] = ko
  }
}

// 공식 문서에 없는 흔한 스펠링 보정 (API voice_name 변형)
const aliases = {
  // API 표기와 공식 문서 스펠링이 다른 경우 (콘솔 UI 한국어 기준)
  Sanghyun: "상현",
  Seohyeon: "서현",
  Juwan: "주완",
  Jungsook: "정숙",
  Silas: "실라스",
  Eoguri: "억울이",
  Eogwool: "억울이",
  Mongsil: "몽실",
  Booqoo: "부쿠",
  Uwonni: "우니",
  Woony: "우니",
}
for (const [en, ko] of Object.entries(aliases)) {
  if (!map[en]) map[en] = ko
}

const body = `/** Auto-generated Typecast EN→KO voice names (from Typecast docs). */
export const TYPECAST_VOICE_NAME_KO: Record<string, string> = ${JSON.stringify(map, null, 2)}

export function typecastKoreanName(englishName: string): string {
  const key = englishName.trim()
  if (!key) return key
  if (TYPECAST_VOICE_NAME_KO[key]) return TYPECAST_VOICE_NAME_KO[key]
  const lower = key.toLowerCase()
  for (const [en, ko] of Object.entries(TYPECAST_VOICE_NAME_KO)) {
    if (en.toLowerCase() === lower) return ko
  }
  return key
}
`

const out = "C:/Users/a/Downloads/duplicate-of/lib/typecast-voice-names.ts"
fs.writeFileSync(out, body, "utf8")
console.log("entries", Object.keys(map).length, "→", out)

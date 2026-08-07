/** SEO 텍스트 정제 — 과장·금칙 표현 완화, 길이·해시태그 정규화 */

const BANNED_PHRASES = [
  /100%\s*효과/gi,
  /무조건\s*효과/gi,
  /완치/gi,
  /기적/gi,
  /의사\s*추천(?!\s*아님)/gi,
  /FDA\s*승인(?!\s*아님)/gi,
  /부작용\s*없음/gi,
  /즉시\s*살\s*빠/gi,
  /하루\s*만에\s*\d+/gi,
]

const HYPE_SOFTEN: Array<[RegExp, string]> = [
  [/인생템/gi, "추천템"],
  [/대박/gi, "좋았어요"],
  [/레전드/gi, "인상적이었어요"],
  [/미쳤다/gi, "기대 이상이었어요"],
  [/핵추천/gi, "추천해요"],
  [/강추!!!+/gi, "추천해요"],
  [/강추!+/gi, "추천해요"],
]

export function sanitizeSeoText(raw: string, maxLen?: number): string {
  let s = String(raw ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  for (const re of BANNED_PHRASES) {
    s = s.replace(re, "")
  }
  for (const [re, rep] of HYPE_SOFTEN) {
    s = s.replace(re, rep)
  }

  s = s.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim()
  if (typeof maxLen === "number" && maxLen > 0 && s.length > maxLen) {
    s = s.slice(0, maxLen).trim()
  }
  return s
}

export function normalizeHashtagList(raw: unknown, max = 12): string[] {
  const arr: string[] = []
  if (Array.isArray(raw)) {
    for (const h of raw) arr.push(String(h))
  } else if (typeof raw === "string") {
    arr.push(
      ...raw
        .split(/[\s,，、]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    )
  }

  const out: string[] = []
  const seen = new Set<string>()
  for (const item of arr) {
    const core = sanitizeSeoText(item).replace(/^#+/, "").replace(/\s+/g, "")
    if (!core) continue
    const key = core.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(`#${core}`)
    if (out.length >= max) break
  }
  return out
}

export function normalizeTagList(raw: unknown, max = 20, fallback: string[] = []): string[] {
  let arr: string[] = []
  if (Array.isArray(raw)) {
    arr = raw.map((t) => String(t))
  } else if (typeof raw === "string") {
    arr = raw.split(/[,，、]/)
  }

  const out: string[] = []
  const seen = new Set<string>()
  for (const item of arr) {
    const t = sanitizeSeoText(item).replace(/^#+/, "").trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
    if (out.length >= max) break
  }
  if (out.length === 0 && fallback.length > 0) {
    return fallback.slice(0, max)
  }
  return out
}

export function clampTitle(raw: string, max = 100): string {
  return sanitizeSeoText(raw, max)
}

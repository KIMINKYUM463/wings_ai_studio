/** WingsStudio generateTitles 파서 축약판 */

export type TitleItem = { title: string; description: string }

function stripMarkdownFence(text: string): string {
  let t = text.trim()
  if (t.startsWith("```")) {
    t = t.replace(/^```[\w]*\n?/, "").replace(/\n?```\s*$/m, "").trim()
  }
  return t
}

function insertNewlinesBeforeListNumbers(text: string): string {
  const t = text.replace(/\r\n/g, "\n").trim()
  if (!t) return t
  return t.replace(/\s+(?=(?:10|[1-9])(?:\.|\))(?:\s|$))/g, "\n")
}

function stripPreambleBeforeNumberedList(text: string): string {
  const lines = text.split(/\r?\n/)
  const idx = lines.findIndex((raw) => /^\d{1,2}[\).\s]/.test(raw.trim()))
  if (idx >= 0) return lines.slice(idx).join("\n")
  return text
}

function isValidTitleItem(title: string, description: string): boolean {
  const t = title.trim()
  const d = description.trim()
  if (t.length < 8 || t.length > 78) return false
  if (d.length < 5 || d.length > 52) return false
  const bad =
    /제안\s*드립니다|^다음은\s|^다음과\s|^아래는\s|^총\s*\d+\s*가지|^유튜브\s*콘텐츠\s*전략가|^콘텐츠\s*전략가로서|가지입니다\s*\.?\s*$/i
  if (bad.test(t)) return false
  return true
}

function pushParsedLine(rest: string, out: TitleItem[], max: number): void {
  if (!rest || out.length >= max) return
  if (!rest.includes("|")) return
  const [tRaw, dRaw] = rest.split("|", 2).map((s) => s.trim())
  const title = tRaw.replace(/^\d+[\).\s]+/, "").trim()
  let description = (dRaw ?? "")
    .replace(/\s*#[^\s#|]+(\s*#[^\s#|]+)*\s*$/g, "")
    .trim()
    .slice(0, 50)
  if (!isValidTitleItem(title, description)) return
  out.push({ title, description })
}

export function parseTitleItems(text: string, max: number): TitleItem[] {
  let raw = stripMarkdownFence(text)
  raw = stripPreambleBeforeNumberedList(raw)
  const normalized = insertNewlinesBeforeListNumbers(raw)
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const out: TitleItem[] = []
  for (const line of lines) {
    if (!/^\d{1,2}[\).\s]/.test(line)) continue
    const rest = line.replace(/^\d{1,2}[\).\s]+/, "").trim()
    pushParsedLine(rest, out, max)
    if (out.length >= max) break
  }
  return out.filter((it) => isValidTitleItem(it.title, it.description)).slice(0, max)
}

export function dedupeTitleItems(items: TitleItem[]): TitleItem[] {
  const seen = new Set<string>()
  const out: TitleItem[] = []
  for (const it of items) {
    const k = it.title.trim()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(it)
  }
  return out
}

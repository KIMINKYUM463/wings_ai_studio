/**
 * MVP·벤치마크 — 검색 키워드와 제목/작성자 텍스트 관련도
 */

export function scoreTextKeywordRelevance(text: string, keyword: string): number {
  const hay = text.trim().toLowerCase()
  const needle = keyword.trim().toLowerCase()
  if (!needle || !hay) return 0
  if (hay.includes(needle)) return 100 + Math.min(needle.length, 40)

  const tokens = keywordTokens(needle)
  let score = 0
  for (const t of tokens) {
    if (t.length >= 2 && hay.includes(t)) {
      score += t.length >= 4 ? 18 : t.length >= 3 ? 12 : 8
    }
  }
  return score
}

function keywordTokens(keyword: string): string[] {
  const out = new Set<string>()
  const parts = keyword.split(/[\s,，、/|+]+/).map((x) => x.trim()).filter((x) => x.length >= 2)
  for (const p of parts) out.add(p)

  if (!parts.length || parts.join("") === keyword.replace(/\s+/g, "")) {
    const compact = keyword.replace(/\s+/g, "")
    if (compact.length >= 2) out.add(compact)
    for (let i = 0; i < compact.length - 1; i++) {
      const bg = compact.slice(i, i + 2)
      if (bg.length === 2) out.add(bg)
    }
    if (compact.length >= 3) out.add(compact.slice(0, Math.min(4, compact.length)))
  }
  return [...out]
}

export function isRelevantToKeyword(text: string, keyword: string, minScore = 8): boolean {
  if (!keyword.trim()) return true
  return scoreTextKeywordRelevance(text, keyword) >= minScore
}

export function rowRelevanceText(row: { title?: string; author?: string }): string {
  return `${row.title || ""} ${row.author || ""}`.trim()
}

export function filterRowsByAnyKeyword<T extends { title?: string; author?: string }>(
  rows: T[],
  keywords: string[],
  minScore = 8
): T[] {
  const kws = keywords.map((k) => k.trim()).filter(Boolean)
  if (!kws.length || rows.length === 0) return rows

  const scored = rows.map((r) => {
    const text = rowRelevanceText(r)
    const best = Math.max(0, ...kws.map((k) => scoreTextKeywordRelevance(text, k)))
    return { r, s: best }
  })
  const passed = scored.filter((x) => x.s >= minScore).map((x) => x.r)
  if (passed.length > 0) return passed

  const partial = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s)
  if (partial.length === 0) return []
  const keep = Math.max(2, Math.ceil(rows.length * 0.35))
  return partial.slice(0, keep).map((x) => x.r)
}

export function filterRowsByKeyword<T extends { title?: string; author?: string }>(
  rows: T[],
  keyword: string,
  minScore = 8
): T[] {
  return filterRowsByAnyKeyword(rows, [keyword], minScore)
}

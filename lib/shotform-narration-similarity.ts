export function normalizeNarrationForCompare(text: string): string {
  return text
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase()
}

function bigrams(s: string): string[] {
  const out: string[] = []
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2))
  return out
}

/** 이전 컷들과 중복·유사한 대본인지 */
export function narrationLineIsDuplicateOfPrior(
  text: string,
  prior: readonly string[],
  threshold = 0.55
): boolean {
  if (!text.trim()) return false
  return prior.some((p) => narrationBlockSimilarity(p, text) >= threshold)
}

/** 컷 단위 대본 유사도 (0~1) */
export function narrationBlockSimilarity(a: string, b: string): number {
  const na = normalizeNarrationForCompare(a)
  const nb = normalizeNarrationForCompare(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.92

  const ba = bigrams(na)
  const bb = new Set(bigrams(nb))
  if (!ba.length) return 0
  let hit = 0
  for (const g of ba) if (bb.has(g)) hit++
  return hit / Math.max(ba.length, bb.size, 1)
}

export function hasExcessiveScriptRepetition(lines: readonly string[]): boolean {
  if (lines.length < 2) return false
  let similarAdjacent = 0
  for (let i = 1; i < lines.length; i++) {
    if (narrationBlockSimilarity(lines[i - 1]!, lines[i]!) >= 0.68) similarAdjacent++
  }
  if (similarAdjacent >= Math.max(2, Math.ceil(lines.length * 0.3))) return true

  const unique = new Set(lines.map((l) => normalizeNarrationForCompare(l)))
  if (lines.length >= 4 && unique.size <= Math.ceil(lines.length * 0.45)) return true
  return false
}

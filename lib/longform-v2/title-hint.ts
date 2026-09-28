/** WingsStudio buildDetailModeTitleHint 대응 */

export function buildDetailModeTitleHint(script: string): string {
  const trimmed = script.trim()
  if (!trimmed) return ""
  const compact = trimmed.replace(/\s+/g, " ")
  const snippet = compact.length > 480 ? `${compact.slice(0, 480)}…` : compact
  return `유튜브 롱폼 · 빠른 모드 대본 발췌: ${snippet}`
}

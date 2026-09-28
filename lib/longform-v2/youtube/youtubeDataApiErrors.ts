export function formatYoutubeDataApiErrorMessage(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim()
  if (!s) return "YouTube Data API 요청에 실패했습니다."
  if (/quota|exceeded/i.test(s)) return "YouTube API 할당량을 초과했습니다. 잠시 후 다시 시도하세요."
  if (/key|invalid|403/i.test(s)) return "YouTube Data API 키가 없거나 유효하지 않습니다."
  return s
}

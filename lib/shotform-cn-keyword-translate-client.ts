/** 抖音·小红书 공통 — 한국어 키워드 입력 → 간체 中文 검색어 (클라이언트) */

export type CnKeywordPlatform = "xiaohongshu" | "douyin"

export type KoZhKeywordPair = { ko: string; zh: string }

export const PRESET_KEYWORDS_KO = ["차량용 청소기", "무선 차량 청소기", "주방 필수템", "휴대용 블렌더"]
export const MASS_KEYWORD_KO = "차량용 청소기"
export const KEYWORD_TRANSLATE_DEBOUNCE_MS = 650

export function parseKoKeywordInputs(
  massMode: boolean,
  massKeywordKo: string,
  keywordsText: string
): string[] {
  if (massMode) return [massKeywordKo.trim()].filter(Boolean)
  return keywordsText
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter(Boolean)
}

export async function fetchCnKeywordTranslation(args: {
  keywords: string[]
  openaiApiKey: string | null
  platform: CnKeywordPlatform
}): Promise<{ pairs: KoZhKeywordPair[]; searchQueries: string[] }> {
  const res = await fetch("/api/shotform/cn-keyword-translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keywords: args.keywords,
      platform: args.platform,
      openaiApiKey: args.openaiApiKey || undefined,
    }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    pairs?: KoZhKeywordPair[]
    searchQueries?: string[]
    error?: string
  }
  if (!res.ok) throw new Error(json.error || "키워드 변환 실패")
  const searchQueries = json.searchQueries?.length ? json.searchQueries : json.pairs?.map((p) => p.zh) || []
  if (!searchQueries.length) throw new Error("중국어 검색어를 만들지 못했습니다.")
  return { pairs: json.pairs || [], searchQueries }
}

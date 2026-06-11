/**
 * 抖音·小红书 검색 — 한국어 입력 → 간체 중국어 검색어
 */

export type CnSearchPlatform = "xiaohongshu" | "douyin"

export type KoZhKeywordPair = { ko: string; zh: string }

/** @deprecated KoZhKeywordPair 사용 */
export type XhsKoZhKeywordPair = KoZhKeywordPair

export function containsHangul(text: string): boolean {
  return /[\uac00-\ud7a3]/.test(text)
}

export function containsCjkChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}

function dedupeQueries(queries: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const q of queries) {
    const t = q.trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

/** 한 줄이 이미 중국어 검색어이면 그대로 사용 */
function passthroughPair(line: string): KoZhKeywordPair {
  const t = line.trim()
  return { ko: t, zh: t }
}

function platformAppName(platform: CnSearchPlatform): string {
  return platform === "douyin" ? "抖音" : "小红书"
}

function buildTranslateSystemPrompt(platform: CnSearchPlatform): string {
  const app = platformAppName(platform)
  return `你是${app}购物/带货视频搜索关键词专家。将用户给的韩文(或英文)购物/产品关键词翻译成**简体中文**搜索词。
规则:
- zh 必须是中国人会在${app}搜索的简中词，不要繁体
- 保留产品品类+特征，不要只翻译品牌音译
- 每条输入对应一条输出
仅输出 JSON: {"keywords":[{"ko":"原输入","zh":"简中搜索词"}]}`
}

/** GPT — 한국어(또는 혼합) 키워드 → 抖音/小红书 간체 검색어 */
export async function translateKoreanKeywordsToChineseSearch(args: {
  keywords: string[]
  apiKey: string
  platform?: CnSearchPlatform
}): Promise<{ pairs: KoZhKeywordPair[]; searchQueries: string[] }> {
  const platform = args.platform ?? "xiaohongshu"
  const rawInputs = args.keywords.map((k) => k.trim()).filter(Boolean)
  if (!rawInputs.length) {
    return { pairs: [], searchQueries: [] }
  }

  const pairs: KoZhKeywordPair[] = []
  const toTranslate: string[] = []

  for (const line of rawInputs) {
    if (containsHangul(line)) {
      toTranslate.push(line)
    } else if (containsCjkChinese(line)) {
      pairs.push(passthroughPair(line))
    } else {
      toTranslate.push(line)
    }
  }

  if (toTranslate.length > 0) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" as const },
        messages: [
          {
            role: "system" as const,
            content: buildTranslateSystemPrompt(platform),
          },
          {
            role: "user" as const,
            content: `输入关键词(每行一个):\n${toTranslate.map((k, i) => `${i + 1}. ${k}`).join("\n")}\n\nJSON:`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    })

    if (!res.ok) {
      const t = await res.text().catch(() => "")
      throw new Error(`한→中 키워드 변환 실패 (${res.status}): ${t.slice(0, 180)}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error("AI 응답이 비어 있습니다.")

    const p = JSON.parse(content) as Record<string, unknown>
    const fromAi = Array.isArray(p.keywords)
      ? p.keywords
          .map((x) => {
            if (!x || typeof x !== "object") return null
            const o = x as Record<string, unknown>
            const ko = String(o.ko || "").trim()
            const zh = String(o.zh || "").trim()
            if (!zh) return null
            return { ko: ko || zh, zh } satisfies KoZhKeywordPair
          })
          .filter(Boolean) as KoZhKeywordPair[]
      : []

    const byKo = new Map(fromAi.map((x) => [x.ko.toLowerCase(), x]))
    for (const line of toTranslate) {
      const hit = byKo.get(line.toLowerCase())
      if (hit) {
        pairs.push({ ko: line, zh: hit.zh })
      } else {
        const fallback = fromAi.find((x) => !pairs.some((p) => p.zh === x.zh))
        if (fallback) pairs.push({ ko: line, zh: fallback.zh })
        else pairs.push({ ko: line, zh: line })
      }
    }
  }

  const searchQueries = dedupeQueries(pairs.map((p) => p.zh))
  return { pairs, searchQueries }
}

/** 입력 → Apify에 넣을 간체 검색어 (한국어이면 변환) */
export async function resolveCnSearchKeywords(args: {
  inputs: string[]
  apiKey: string | null
  platform?: CnSearchPlatform
}): Promise<{ pairs: KoZhKeywordPair[]; searchQueries: string[] }> {
  const platform = args.platform ?? "xiaohongshu"
  const lines = args.inputs.map((k) => k.trim()).filter(Boolean)
  if (!lines.length) return { pairs: [], searchQueries: [] }

  const needsGpt = lines.some((l) => containsHangul(l) || (!containsCjkChinese(l) && !containsHangul(l)))
  if (!needsGpt) {
    const pairs = lines.map(passthroughPair)
    return { pairs, searchQueries: dedupeQueries(lines) }
  }

  if (!args.apiKey?.trim()) {
    throw new Error("한국어 키워드 변환에 OpenAI API 키(shotform_openai_api_key)가 필요합니다.")
  }

  return translateKoreanKeywordsToChineseSearch({
    keywords: lines,
    apiKey: args.apiKey.trim(),
    platform,
  })
}

/** @deprecated resolveCnSearchKeywords 사용 */
export async function resolveXhsSearchKeywords(args: {
  inputs: string[]
  apiKey: string | null
}): Promise<{ pairs: KoZhKeywordPair[]; searchQueries: string[] }> {
  return resolveCnSearchKeywords({ ...args, platform: "xiaohongshu" })
}

/** @deprecated translateKoreanKeywordsToChineseSearch 사용 */
export async function translateKoreanKeywordsToXhsChinese(args: {
  keywords: string[]
  apiKey: string
}): Promise<{ pairs: KoZhKeywordPair[]; searchQueries: string[] }> {
  return translateKoreanKeywordsToChineseSearch({ ...args, platform: "xiaohongshu" })
}

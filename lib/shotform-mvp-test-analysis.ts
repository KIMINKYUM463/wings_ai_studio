/** MVP 테스트 — 쇼핑숏폼 레퍼런스 분석 (중국어 키워드·후킹·구조) */

export type MvpExtendedAnalysis = {
  productName: string
  category: string
  hookPhrases: string[]
  toneStyle: string
  shoppingStructure: string[]
  editTempo: string
  chineseKeywords: Array<{ ko: string; zh: string }>
  targetKeywords: string[]
  summary: string
}

export async function runMvpExtendedAnalysis(args: {
  url: string
  platform: string
  title: string
  author: string
  transcript: string
  productName: string
  category: string
  apiKey: string
}): Promise<MvpExtendedAnalysis> {
  const { url, platform, title, author, transcript, productName, category, apiKey } = args

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 900,
      response_format: { type: "json_object" as const },
      messages: [
        {
          role: "system" as const,
          content: `쇼핑 숏폼 벤치마킹 분석가. JSON만 출력.
chineseKeywords: 한국어→간체 중국어 검색어 4~6쌍 (도우인/小红书용).
hookPhrases: 후킹·오프닝 문구 3~5개.
shoppingStructure: 영상 구조 단계 (예: 문제제기→제품소개→데모→CTA).
editTempo: 편집 템포 한 줄 (빠름/보통/슬로우 + 컷 길이).
toneStyle: 말투·톤 한 줄.`,
        },
        {
          role: "user" as const,
          content: `URL: ${url}
플랫폼: ${platform}
제목: ${title || "(없음)"}
작성자: ${author || "(없음)"}
추론 상품명: ${productName}
카테고리: ${category}
자막/음성 텍스트:
${(transcript || "(없음)").slice(0, 2000)}

JSON:
{"productName":"","category":"","hookPhrases":[],"toneStyle":"","shoppingStructure":[],"editTempo":"","chineseKeywords":[{"ko":"","zh":""}],"targetKeywords":[],"summary":""}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(50_000),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`MVP 분석 실패 (${res.status}): ${t.slice(0, 180)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("MVP AI 응답이 비어 있습니다.")

  const p = JSON.parse(content) as Record<string, unknown>
  const chineseKeywords = Array.isArray(p.chineseKeywords)
    ? p.chineseKeywords
        .map((x) => {
          if (!x || typeof x !== "object") return null
          const o = x as Record<string, unknown>
          const ko = String(o.ko || "").trim()
          const zh = String(o.zh || "").trim()
          return ko && zh ? { ko, zh } : null
        })
        .filter(Boolean) as Array<{ ko: string; zh: string }>
    : []

  return {
    productName: String(p.productName || productName).trim(),
    category: String(p.category || category).trim(),
    hookPhrases: Array.isArray(p.hookPhrases) ? p.hookPhrases.map(String).slice(0, 6) : [],
    toneStyle: String(p.toneStyle || "").trim(),
    shoppingStructure: Array.isArray(p.shoppingStructure) ? p.shoppingStructure.map(String).slice(0, 8) : [],
    editTempo: String(p.editTempo || "").trim(),
    chineseKeywords,
    targetKeywords: Array.isArray(p.targetKeywords) ? p.targetKeywords.map(String).slice(0, 10) : [],
    summary: String(p.summary || "").trim(),
  }
}

export function extractHashtags(text: string): string[] {
  const tags = text.match(/#[\w\uAC00-\uD7A3\u4e00-\u9fff]+/g) || []
  return [...new Set(tags.map((t) => t.slice(1)))].slice(0, 12)
}

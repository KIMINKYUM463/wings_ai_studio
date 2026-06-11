/**
 * MVP 테스트 — 제품 URL → 중국어 키워드 → Apify 小红书 영상 검색
 */

import { searchXiaohongshuOnApify } from "@/lib/apify-product-search"
import {
  rowRelevanceText,
  scoreTextKeywordRelevance,
} from "@/lib/shotform-mvp-keyword-relevance"
import type { SerpVideoRow } from "@/lib/serpapi-product-search"

export type XhsChineseKeyword = { ko: string; zh: string }

export type XhsKeywordExtraction = {
  productName: string
  category: string
  chineseKeywords: XhsChineseKeyword[]
  /** Apify 검색에 실제 사용할 간체 중국어 검색어 */
  xhsSearchQueries: string[]
  summary: string
}

export type XhsTestResult = {
  extraction: XhsKeywordExtraction
  similarVideos: SerpVideoRow[]
  apifyHttpCalls: number
  apifyActor: string
  keywordsUsed: string[]
  notice: string
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/** 쇼핑몰·제품 URL에서 og:title / title 추출 */
export async function fetchProductPageMeta(url: string): Promise<{ title: string; description: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(14_000),
      redirect: "follow",
    })
    if (!res.ok) return { title: "", description: "" }
    const html = (await res.text()).slice(0, 150_000)
    const ogTitle =
      html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1]
    const ogDesc =
      html.match(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      html.match(/content=["']([^"']+)["'][^>]*property=["']og:description["']/i)?.[1]
    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    return {
      title: decodeHtmlEntities(ogTitle || titleTag || ""),
      description: decodeHtmlEntities(ogDesc || ""),
    }
  } catch {
    return { title: "", description: "" }
  }
}

/** URL·페이지 메타에서 小红书 Apify 검색용 중국어 키워드 추출 */
export async function extractChineseKeywordsForXhs(args: {
  url: string
  title: string
  description: string
  apiKey: string
}): Promise<XhsKeywordExtraction> {
  const { url, title, description, apiKey } = args

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.25,
      max_tokens: 700,
      response_format: { type: "json_object" as const },
      messages: [
        {
          role: "system" as const,
          content: `쇼핑 제품 분석가. 입력 URL·제품 정보에서 小红书(샤오홍슈) 영상 검색용 키워드를 추출. JSON만 출력.
chineseKeywords: 한국어→간체 중국어 4~6쌍. zh는 실제 중국 쇼핑·리뷰 검색에 쓸 간체어.
xhsSearchQueries: Apify 검색에 바로 넣을 간체 중국어 2~3개(중복·한글 금지). 특징+제품군 형태, 상품명만 단독 금지.`,
        },
        {
          role: "user" as const,
          content: `URL: ${url}
페이지 제목: ${title || "(없음)"}
설명: ${(description || "(없음)").slice(0, 800)}

JSON:
{"productName":"","category":"","chineseKeywords":[{"ko":"","zh":""}],"xhsSearchQueries":["",""],"summary":""}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(50_000),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`중국어 키워드 추출 실패 (${res.status}): ${t.slice(0, 180)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("AI 응답이 비어 있습니다.")

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
        .filter(Boolean) as XhsChineseKeyword[]
    : []

  const fromAi = Array.isArray(p.xhsSearchQueries)
    ? p.xhsSearchQueries.map((x) => String(x).trim()).filter(Boolean)
    : []
  const fromPairs = chineseKeywords.map((c) => c.zh.trim()).filter(Boolean)
  const seen = new Set<string>()
  const xhsSearchQueries: string[] = []
  for (const q of [...fromAi, ...fromPairs]) {
    const k = q.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    xhsSearchQueries.push(q)
    if (xhsSearchQueries.length >= 3) break
  }

  const productName = String(p.productName || title || "제품").trim()
  if (xhsSearchQueries.length === 0 && productName) {
    xhsSearchQueries.push(`${productName} 测评`.slice(0, 40))
  }

  return {
    productName,
    category: String(p.category || "").trim() || "쇼핑",
    chineseKeywords,
    xhsSearchQueries,
    summary: String(p.summary || "").trim(),
  }
}

function relevanceScore(row: SerpVideoRow, extraction: XhsKeywordExtraction): number {
  const text = rowRelevanceText(row)
  let s = 0
  for (const q of extraction.xhsSearchQueries) {
    s = Math.max(s, scoreTextKeywordRelevance(text, q))
  }
  for (const c of extraction.chineseKeywords) {
    s = Math.max(s, scoreTextKeywordRelevance(text, c.zh))
    if (c.ko.length >= 2) s = Math.max(s, scoreTextKeywordRelevance(text, c.ko) * 0.5)
  }
  if (extraction.productName.length >= 2) {
    s = Math.max(s, scoreTextKeywordRelevance(text, extraction.productName) * 0.6)
  }
  return Math.round(s)
}

const XHS_RELEVANCE_MIN = 8

export async function runMvpXhsTest(args: {
  url: string
  pageTitle: string
  pageDescription: string
  openaiApiKey: string
  apifyToken: string
}): Promise<XhsTestResult> {
  const extraction = await extractChineseKeywordsForXhs({
    url: args.url,
    title: args.pageTitle,
    description: args.pageDescription,
    apiKey: args.openaiApiKey,
  })

  const apify = await searchXiaohongshuOnApify(args.apifyToken, extraction.xhsSearchQueries)

  const scored = apify.rows
    .map((r) => ({ ...r, relevanceScore: relevanceScore(r, extraction) }))
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))

  let similarVideos = scored.filter((r) => (r.relevanceScore ?? 0) >= XHS_RELEVANCE_MIN)
  let relevanceNote = ""
  if (similarVideos.length === 0 && scored.length > 0) {
    similarVideos = scored.slice(0, Math.min(5, scored.length))
    relevanceNote = " · 검색어와 제목 매칭이 약한 결과만 있어 상위 5건만 표시"
  } else if (scored.length > similarVideos.length) {
    relevanceNote = ` · 관련도 필터로 ${scored.length - similarVideos.length}건 제외`
  }

  let notice = ""
  if (similarVideos.length === 0) {
    notice =
      "영상(playUrl) 결과 0건 — socialdatax/socialdatax-xhs-data-api Actor·APIFY_XHS_ACTOR 설정을 확인하세요."
  } else {
    const actorNote =
      apify.actorsUsed.length > 0
        ? apify.actorsUsed.map((a) => a.split("/")[1] || a).join(" + ")
        : apify.actor
    notice = `Apify ${apify.httpCalls}회 · ${actorNote} · 영상 ${similarVideos.length}건 · ${apify.keywordsUsed.join(" · ")}${relevanceNote}`
  }

  return {
    extraction,
    similarVideos,
    apifyHttpCalls: apify.httpCalls,
    apifyActor: apify.actor,
    keywordsUsed: apify.keywordsUsed,
    notice,
  }
}

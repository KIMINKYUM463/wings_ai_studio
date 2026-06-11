import { type NextRequest, NextResponse } from "next/server"
import {
  MVP_XHS_PLATFORM_RETRY_MAX,
  runMvpKeywordPlatformSearch,
  runMvpKeywordSourceSearch,
  type MvpKeywordPlatform,
} from "@/lib/shotform-mvp-keyword-source"
import { resolveCnSearchKeywords, type KoZhKeywordPair } from "@/lib/shotform-xhs-ko-zh-keywords"

export const maxDuration = 800

function apifyTokenFromBody(body: Record<string, unknown>): string {
  return (
    (typeof body.apifyApiKey === "string" && body.apifyApiKey.trim()) ||
    process.env.APIFY_TOKEN ||
    ""
  )
}

function openaiKeyFromBody(body: Record<string, unknown>): string {
  return (
    (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) ||
    process.env.OPENAI_API_KEY ||
    ""
  )
}

function parseKeywordInputs(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.keywords)) {
    return body.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean)
  }
  if (typeof body.keyword === "string" && body.keyword.trim()) {
    return body.keyword
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean)
  }
  return []
}

/** POST — 한국어 키워드 → 中文 변환 → 抖音·小红书 Apify 동시 검색 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const apifyToken = apifyTokenFromBody(body)
    const openaiApiKey = openaiKeyFromBody(body)

    const koInputs = parseKeywordInputs(body)
    if (!koInputs.length) {
      return NextResponse.json({ error: "키워드를 입력해 주세요." }, { status: 400 })
    }
    if (!apifyToken) {
      return NextResponse.json(
        {
          error:
            "소스 검색 토큰이 필요합니다. ShotForm 설정에 소스 검색 토큰을 저장하거나 서버 환경 변수를 설정하세요.",
        },
        { status: 400 }
      )
    }

    let keywordPairs: KoZhKeywordPair[] = []
    let searchQueries: string[] = []

    if (Array.isArray(body.searchQueries) && body.searchQueries.every((k) => typeof k === "string")) {
      searchQueries = (body.searchQueries as string[]).map((k) => k.trim()).filter(Boolean)
      keywordPairs = Array.isArray(body.keywordPairs)
        ? (body.keywordPairs as KoZhKeywordPair[])
        : koInputs.map((ko) => ({ ko, zh: searchQueries[0] || ko }))
    } else {
      const resolved = await resolveCnSearchKeywords({
        inputs: koInputs,
        apiKey: openaiApiKey || null,
        platform: "xiaohongshu",
      })
      keywordPairs = resolved.pairs
      searchQueries = resolved.searchQueries
    }

    if (!searchQueries.length) {
      return NextResponse.json({ error: "중국어 검색어를 만들지 못했습니다." }, { status: 400 })
    }

    const platformRaw = typeof body.platform === "string" ? body.platform.trim().toLowerCase() : ""
    const platform: MvpKeywordPlatform | null =
      platformRaw === "douyin" || platformRaw === "抖音" ? "douyin" : platformRaw === "xiaohongshu" || platformRaw === "xhs" || platformRaw === "小红书" ? "xiaohongshu" : null

    if (platform) {
      const maxAttemptsRaw = body.maxAttempts
      const maxAttempts =
        platform === "xiaohongshu" && typeof maxAttemptsRaw === "number" && Number.isFinite(maxAttemptsRaw)
          ? Math.max(1, Math.min(Math.floor(maxAttemptsRaw), MVP_XHS_PLATFORM_RETRY_MAX))
          : platform === "xiaohongshu"
            ? MVP_XHS_PLATFORM_RETRY_MAX
            : 1

      const result = await runMvpKeywordPlatformSearch({
        platform,
        searchQueries,
        apifyToken,
        maxAttempts,
      })
      return NextResponse.json({
        platform,
        searchQueries,
        keywordPairs,
        result,
        maxAttempts: platform === "xiaohongshu" ? maxAttempts : 1,
      })
    }

    const result = await runMvpKeywordSourceSearch({
      searchQueries,
      keywordPairs,
      apifyToken,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error("[mvp-keyword-source]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "소스 찾기 실패" }, { status: 500 })
  }
}

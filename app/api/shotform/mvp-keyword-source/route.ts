import { type NextRequest, NextResponse } from "next/server"
import {
  MVP_XHS_PLATFORM_RETRY_MAX,
  runMvpKeywordPlatformSearch,
  runMvpKeywordSourceSearch,
  type MvpKeywordPlatform,
} from "@/lib/shotform-mvp-keyword-source"
import { resolveCnSearchKeywords, type KoZhKeywordPair } from "@/lib/shotform-xhs-ko-zh-keywords"
import { resolveTikhubKey } from "@/lib/tikhub"

export const maxDuration = 800

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

const PLATFORM_ALIASES: Record<string, MvpKeywordPlatform> = {
  douyin: "douyin",
  抖音: "douyin",
  xiaohongshu: "xiaohongshu",
  xhs: "xiaohongshu",
  小红书: "xiaohongshu",
  tiktok: "tiktok",
  youtube: "youtube",
}

function parsePlatform(raw: unknown): MvpKeywordPlatform | null {
  return typeof raw === "string" ? (PLATFORM_ALIASES[raw.trim().toLowerCase()] ?? null) : null
}

/** POST — 한국어 키워드 → 中文 변환 → 抖音·小红书(中文)·TikTok·YouTube(한국어) TikHub 동시 검색 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const tikhubKey = resolveTikhubKey(body.tikhubApiKey)
    const openaiApiKey = openaiKeyFromBody(body)

    const koInputs = parseKeywordInputs(body)
    if (!koInputs.length) {
      return NextResponse.json({ error: "키워드를 입력해 주세요." }, { status: 400 })
    }
    if (!tikhubKey) {
      return NextResponse.json(
        { error: "TikHub API 키가 필요합니다. ShotForm 설정에 TikHub API 키를 저장해 주세요." },
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

    const platform = parsePlatform(body.platform)

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
        keywordPairs,
        tikhubKey,
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
      tikhubKey,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error("[mvp-keyword-source]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "소스 찾기 실패" }, { status: 500 })
  }
}

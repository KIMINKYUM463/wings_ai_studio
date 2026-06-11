import { type NextRequest, NextResponse } from "next/server"
import { resolveCnSearchKeywords, type CnSearchPlatform } from "@/lib/shotform-xhs-ko-zh-keywords"

export const maxDuration = 60

function openaiKeyFromBody(body: Record<string, unknown>): string {
  return (
    (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) ||
    process.env.OPENAI_API_KEY ||
    ""
  )
}

function parsePlatform(body: Record<string, unknown>): CnSearchPlatform {
  const raw = typeof body.platform === "string" ? body.platform.trim().toLowerCase() : ""
  if (raw === "douyin" || raw === "抖音") return "douyin"
  return "xiaohongshu"
}

/** POST — 한국어 키워드 → 抖音/小红书 간체 검색어 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const openaiApiKey = openaiKeyFromBody(body)
    const platform = parsePlatform(body)

    const keywords = Array.isArray(body.keywords)
      ? body.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean)
      : typeof body.keyword === "string"
        ? [body.keyword.trim()].filter(Boolean)
        : []

    if (!keywords.length) {
      return NextResponse.json({ error: "keywords 배열 또는 keyword 문자열이 필요합니다." }, { status: 400 })
    }

    const { pairs, searchQueries } = await resolveCnSearchKeywords({
      inputs: keywords,
      apiKey: openaiApiKey || null,
      platform,
    })

    const appLabel = platform === "douyin" ? "抖音" : "小红书"

    return NextResponse.json({
      platform,
      pairs,
      searchQueries,
      notice: `한국어 입력 → 간체 중국어로 ${appLabel} 소스 검색에 사용합니다.`,
    })
  } catch (e) {
    console.error("[cn-keyword-translate]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "변환 오류" }, { status: 500 })
  }
}

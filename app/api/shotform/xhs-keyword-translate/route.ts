import { type NextRequest, NextResponse } from "next/server"
import { resolveCnSearchKeywords } from "@/lib/shotform-xhs-ko-zh-keywords"

export const maxDuration = 60

function openaiKeyFromBody(body: Record<string, unknown>): string {
  return (
    (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) ||
    process.env.OPENAI_API_KEY ||
    ""
  )
}

/** POST — 한국어 키워드 → 小红书 간체 검색어 (cn-keyword-translate xiaohongshu 와 동일) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const openaiApiKey = openaiKeyFromBody(body as Record<string, unknown>)

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
      platform: "xiaohongshu",
    })

    return NextResponse.json({
      pairs,
      searchQueries,
      notice: "한국어 입력 → 간체 중국어로 小红书 소스 검색에 사용합니다.",
    })
  } catch (e) {
    console.error("[xhs-keyword-translate]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "변환 오류" }, { status: 500 })
  }
}

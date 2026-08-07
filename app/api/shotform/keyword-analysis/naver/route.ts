import { NextResponse, type NextRequest } from "next/server"
import { fetchNaverKeywordRanks } from "@/lib/server/naver-searchad-keywords"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query")?.trim() || ""
    if (!query) {
      return NextResponse.json({ error: "분석할 키워드가 필요합니다." }, { status: 400 })
    }
    const keywords = await fetchNaverKeywordRanks(query, 10)
    return NextResponse.json({
      success: true,
      query,
      keywords,
      collectedAt: new Date().toISOString(),
      source: "naver_searchad",
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "네이버 키워드 조회 실패" },
      { status: 502 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getVideoCategories } from "@/lib/youtube-api"

export const dynamic = 'force-dynamic'

/**
 * YouTube Data API를 사용하여 한국 지역의 동영상 카테고리 목록을 가져옵니다.
 * GET /api/youmaker/video-categories
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const apiKey = searchParams.get("apiKey")

    if (!apiKey) {
      return NextResponse.json(
        { error: "YouTube Data API Key가 필요합니다." },
        { status: 400 }
      )
    }

    // getVideoCategories 함수를 사용하여 카테고리 목록 가져오기
    const categories = await getVideoCategories(apiKey)

    return NextResponse.json({
      success: true,
      categories,
    })
  } catch (error) {
    console.error("[Video Categories] 오류:", error)
    return NextResponse.json(
      {
        error: `서버 오류: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}


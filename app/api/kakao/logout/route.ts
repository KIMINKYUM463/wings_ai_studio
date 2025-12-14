import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export const dynamic = 'force-dynamic'

/**
 * 카카오 로그아웃 API
 * 
 * 세션 쿠키를 삭제하여 로그아웃합니다.
 * 
 * POST /api/kakao/logout
 */

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    
    // 카카오 사용자 쿠키 삭제
    cookieStore.delete("kakao_user")

    return NextResponse.json({
      success: true,
      message: "로그아웃되었습니다.",
    })
  } catch (error) {
    console.error("[Kakao Logout] 로그아웃 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: `로그아웃 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}


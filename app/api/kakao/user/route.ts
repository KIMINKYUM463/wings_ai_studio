import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export const dynamic = 'force-dynamic'

/**
 * 현재 로그인한 사용자 정보 조회 API
 * 
 * GET /api/kakao/user
 */

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const kakaoUserCookie = cookieStore.get("kakao_user")

    if (!kakaoUserCookie) {
      return NextResponse.json(
        { loggedIn: false },
        { status: 401 }
      )
    }

    const userData = JSON.parse(kakaoUserCookie.value)

    // 민감한 정보 제외하고 반환
    const { accessToken, ...safeUserData } = userData

    return NextResponse.json({
      loggedIn: true,
      user: safeUserData,
    })
  } catch (error) {
    console.error("[Kakao User] 사용자 정보 조회 오류:", error)
    return NextResponse.json(
      {
        loggedIn: false,
        error: `사용자 정보 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}


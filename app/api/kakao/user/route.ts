import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export const dynamic = 'force-dynamic'

/**
 * 현재 로그인한 사용자 정보 조회 API
 * 
 * GET /api/kakao/user
 */

function parseKakaoUserCookie(raw: string): Record<string, unknown> | null {
  const attempts = [raw, (() => {
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  })()]
  for (const value of attempts) {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>
      if (parsed && (parsed.id != null || parsed.email)) return parsed
    } catch {
      // 다음 시도
    }
  }
  return null
}

export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const kakaoUserCookie = cookieStore.get("kakao_user")

    if (!kakaoUserCookie?.value) {
      return NextResponse.json({ loggedIn: false }, { status: 200 })
    }

    const userData = parseKakaoUserCookie(kakaoUserCookie.value)
    if (!userData) {
      return NextResponse.json(
        { loggedIn: false, error: "로그인 쿠키를 읽지 못했습니다. 다시 로그인해주세요." },
        { status: 200 }
      )
    }

    // 민감한 정보 제외하고 반환
    const { accessToken: _accessToken, ...safeUserData } = userData

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
      { status: 200 }
    )
  }
}


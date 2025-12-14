import { type NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

/**
 * 카카오 로그인 인증 시작 API
 * 
 * 카카오 인증 페이지로 리다이렉트합니다.
 * 
 * 환경 변수:
 * - KAKAO_REST_API_KEY: 카카오 REST API 키
 * - KAKAO_REDIRECT_URI: 카카오 리다이렉트 URI (예: https://wingsaistudio.com/api/kakao/callback)
 * 
 * GET /api/kakao/auth
 */

export async function GET(request: NextRequest) {
  try {
    const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY
    const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || 
      `${request.nextUrl.origin}/api/kakao/callback`

    if (!KAKAO_REST_API_KEY) {
      return NextResponse.json(
        { error: "KAKAO_REST_API_KEY 환경 변수가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    // 카카오 인증 URL 생성
    // scope: account_email (이메일, 필수 동의), profile_nickname (닉네임), profile_image (프로필 이미지)
    const scope = "account_email,profile_nickname,profile_image"
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scope)}`

    console.log("[Kakao Auth] 인증 URL:", kakaoAuthUrl)
    console.log("[Kakao Auth] REST API Key:", KAKAO_REST_API_KEY?.substring(0, 10) + "...")

    // 카카오 인증 페이지로 리다이렉트
    return NextResponse.redirect(kakaoAuthUrl)
  } catch (error) {
    console.error("[Kakao Auth] 오류:", error)
    return NextResponse.json(
      { error: `인증 시작 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}


import { NextResponse } from "next/server"
import { google } from "googleapis"

/**
 * YouTube OAuth 인증 시작 API
 * GET /api/youtube/auth
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    // 쿼리 파라미터에서 Client ID와 Secret 가져오기 (로컬스토리지에서 클라이언트가 전달)
    const clientId = searchParams.get("clientId")
    const clientSecret = searchParams.get("clientSecret")
    
    // 환경 변수는 fallback (선택사항)
    const finalClientId = clientId || process.env.YOUTUBE_CLIENT_ID
    const finalClientSecret = clientSecret || process.env.YOUTUBE_CLIENT_SECRET
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/youtube/callback`

    if (!finalClientId || !finalClientSecret) {
      return NextResponse.json(
        { error: "YouTube API 설정이 필요합니다. 설정에서 Client ID와 Secret을 입력하고 저장해주세요." },
        { status: 500 }
      )
    }

    // Client ID와 Secret을 세션에 임시 저장 (callback에서 사용하기 위해)
    // 쿠키에 저장 (httpOnly로 보안)
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    cookieStore.set("youtube_temp_client_id", finalClientId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5, // 5분 (OAuth 인증 완료까지)
    })
    cookieStore.set("youtube_temp_client_secret", finalClientSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5, // 5분
    })

    const oauth2Client = new google.auth.OAuth2(finalClientId, finalClientSecret, redirectUri)

    // YouTube Data API v3 스코프
    const scopes = [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ]

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // refresh token 받기 위해 필요
      scope: scopes,
      prompt: "consent", // 항상 refresh token 받기 위해 필요
    })

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error("[YouTube] 인증 시작 오류:", error)
    return NextResponse.json(
      { error: "인증 시작에 실패했습니다." },
      { status: 500 }
    )
  }
}


import { NextResponse } from "next/server"
import { google } from "googleapis"
import { createClient } from "@supabase/supabase-js"

// Supabase 클라이언트 생성 (환경 변수 확인)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    return null
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

/**
 * YouTube OAuth 콜백 처리 API
 * GET /api/youtube/callback?code=...
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const error = searchParams.get("error")

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/WingsAIStudio?youtube_error=${error}`
      )
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/WingsAIStudio?youtube_error=no_code`
      )
    }

    // 세션 쿠키에서 Client ID와 Secret 가져오기 (auth에서 임시 저장한 값)
    let clientId = process.env.YOUTUBE_CLIENT_ID
    let clientSecret = process.env.YOUTUBE_CLIENT_SECRET
    
    try {
      const { cookies } = await import("next/headers")
      const cookieStore = await cookies()
      const tempClientId = cookieStore.get("youtube_temp_client_id")?.value
      const tempClientSecret = cookieStore.get("youtube_temp_client_secret")?.value
      
      // 임시 쿠키에 값이 있으면 사용 (로컬스토리지에서 온 값)
      if (tempClientId) clientId = tempClientId
      if (tempClientSecret) clientSecret = tempClientSecret
      
      // 사용 후 쿠키 삭제
      if (tempClientId) {
        cookieStore.delete("youtube_temp_client_id")
        cookieStore.delete("youtube_temp_client_secret")
      }
    } catch (e) {
      // 쿠키 읽기 실패 시 환경 변수 사용
    }
    
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/youtube/callback`

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/WingsAIStudio?youtube_error=config`
      )
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

    // 토큰 교환
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/WingsAIStudio?youtube_error=no_tokens`
      )
    }

    // 토큰 만료 시간 계산 (기본 1시간)
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000)

    // 토큰을 쿼리 파라미터로 전달하여 클라이언트에서 로컬스토리지에 저장하도록 함
    // 보안: 실제로는 암호화하거나 더 안전한 방법 사용 권장
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt.toISOString(),
    }
    
    // URL에 토큰 정보를 포함하여 리다이렉트 (클라이언트에서 로컬스토리지에 저장)
    const tokenParams = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt.toISOString(),
    })

    // 성공 시 메인 페이지로 리다이렉트 (토큰 정보 포함)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/WingsAIStudio?youtube_connected=true&${tokenParams.toString()}`
    )
  } catch (error) {
    console.error("[YouTube] 콜백 처리 오류:", error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/WingsAIStudio?youtube_error=callback_failed`
    )
  }
}


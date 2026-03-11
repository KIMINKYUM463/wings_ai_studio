import { NextResponse } from "next/server"
import { google } from "googleapis"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

// Supabase 클라이언트 생성 (환경 변수 확인)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    return null
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

/** 배포 URL 기준: 요청 origin 사용 (localhost 방지) */
function getBaseUrlFromRequest(request: Request): string {
  try {
    const url = new URL(request.url)
    if (url.origin && url.origin !== "null") return url.origin.replace(/\/$/, "")
  } catch (_) {}
  return process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
}

/**
 * YouTube OAuth 콜백 처리 API
 * GET /api/youtube/callback?code=...
 */
export async function GET(request: Request) {
  try {
    const baseUrl = getBaseUrlFromRequest(request)
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const error = searchParams.get("error")
    const state = searchParams.get("state") // shopping_factory 이면 쇼핑 공장 자동화로 리다이렉트

    const shoppingFactoryPath = "/WingsAIStudioShotForm/shopping"
    const defaultRedirect = `${baseUrl}/WingsAIStudio`

    if (error) {
      const dest = state === "shopping_factory" ? `${baseUrl}${shoppingFactoryPath}?youtube_error=${error}` : `${defaultRedirect}?youtube_error=${error}`
      return NextResponse.redirect(dest)
    }

    if (!code) {
      const dest = state === "shopping_factory" ? `${baseUrl}${shoppingFactoryPath}?youtube_error=no_code` : `${defaultRedirect}?youtube_error=no_code`
      return NextResponse.redirect(dest)
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
    
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${baseUrl}/api/youtube/callback`

    if (!clientId || !clientSecret) {
      const dest = state === "shopping_factory" ? `${baseUrl}${shoppingFactoryPath}?youtube_error=config` : `${defaultRedirect}?youtube_error=config`
      return NextResponse.redirect(dest)
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

    // 토큰 교환
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      const dest = state === "shopping_factory" ? `${baseUrl}${shoppingFactoryPath}?youtube_error=no_tokens` : `${defaultRedirect}?youtube_error=no_tokens`
      return NextResponse.redirect(dest)
    }

    // 토큰 만료 시간 계산 (기본 1시간)
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000)

    // 예약 공장 연동 시: 토큰 쿠키 저장 + 채널명 조회 후 쇼핑 페이지로 리다이렉트 (이후 유튜브 예약 업로드 시 사용)
    if (state === "shopping_factory") {
      try {
        const { cookies } = await import("next/headers")
        const cookieStore = await cookies()
        cookieStore.set("youtube_tokens", JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt.toISOString(),
        }), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365, // 1년
        })

        oauth2Client.setCredentials({ access_token: tokens.access_token })
        const youtube = google.youtube({ version: "v3", auth: oauth2Client })
        const { data } = await youtube.channels.list({ part: ["snippet"], mine: true })
        const channelTitle = data.items?.[0]?.snippet?.title
        const channelParam = channelTitle ? encodeURIComponent(channelTitle) : ""
        const redirectUrl = channelParam
          ? `${baseUrl}${shoppingFactoryPath}?youtube_channel=${channelParam}`
          : `${baseUrl}${shoppingFactoryPath}?youtube_connected=1`
        return NextResponse.redirect(redirectUrl)
      } catch (e) {
        console.error("[YouTube] 채널 정보 조회 오류:", e)
        return NextResponse.redirect(`${baseUrl}${shoppingFactoryPath}?youtube_connected=1`)
      }
    }

    // 기존: WingsAIStudio로 토큰 포함 리다이렉트
    const tokenParams = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt.toISOString(),
    })
    return NextResponse.redirect(
      `${defaultRedirect}?youtube_connected=true&${tokenParams.toString()}`
    )
  } catch (error) {
    console.error("[YouTube] 콜백 처리 오류:", error)
    const baseUrl = getBaseUrlFromRequest(request)
    const state = new URL(request.url).searchParams.get("state")
    const dest = state === "shopping_factory"
      ? `${baseUrl}/WingsAIStudioShotForm/shopping?youtube_error=callback_failed`
      : `${baseUrl}/WingsAIStudio?youtube_error=callback_failed`
    return NextResponse.redirect(dest)
  }
}


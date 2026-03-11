import { NextResponse } from "next/server"
import { google } from "googleapis"

export const dynamic = 'force-dynamic'

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
]

function buildAuthUrl(finalClientId: string, finalClientSecret: string, state?: string | null) {
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/youtube/callback`
  const oauth2Client = new google.auth.OAuth2(finalClientId, finalClientSecret, redirectUri)
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state: state || undefined,
  })
}

/**
 * YouTube OAuth 인증 시작 API
 * POST: body { clientId, clientSecret, state } → 쿠키 설정 후 JSON { url } 반환 (설정에서 넣은 값 사용 시)
 * GET: 쿼리 또는 env에서 Client ID/Secret 사용 → Google로 리다이렉트
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const clientId = body.clientId as string | undefined
    const clientSecret = body.clientSecret as string | undefined
    const state = body.state as string | undefined

    const finalClientId = (clientId?.trim() || "") || process.env.YOUTUBE_CLIENT_ID
    const finalClientSecret = clientSecret || process.env.YOUTUBE_CLIENT_SECRET

    if (!finalClientId || !finalClientSecret) {
      return NextResponse.json(
        { error: "YouTube API 설정이 필요합니다. 설정에서 Client ID와 Secret을 입력해주세요." },
        { status: 400 }
      )
    }

    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    cookieStore.set("youtube_temp_client_id", finalClientId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5,
    })
    cookieStore.set("youtube_temp_client_secret", finalClientSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5,
    })

    const authUrl = buildAuthUrl(finalClientId, finalClientSecret, state)
    return NextResponse.json({ url: authUrl })
  } catch (error) {
    console.error("[YouTube] 인증 시작 오류:", error)
    return NextResponse.json(
      { error: "인증 시작에 실패했습니다." },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId")
    const clientSecret = searchParams.get("clientSecret")
    const finalClientId = clientId || process.env.YOUTUBE_CLIENT_ID
    const finalClientSecret = clientSecret || process.env.YOUTUBE_CLIENT_SECRET
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/youtube/callback`

    if (!finalClientId || !finalClientSecret) {
      return NextResponse.json(
        { error: "YouTube API 설정이 필요합니다. 설정에서 Client ID와 Secret을 입력하고 저장해주세요." },
        { status: 500 }
      )
    }

    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    cookieStore.set("youtube_temp_client_id", finalClientId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5,
    })
    cookieStore.set("youtube_temp_client_secret", finalClientSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5,
    })

    const state = searchParams.get("state") || undefined
    const authUrl = buildAuthUrl(finalClientId, finalClientSecret, state)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error("[YouTube] 인증 시작 오류:", error)
    return NextResponse.json(
      { error: "인증 시작에 실패했습니다." },
      { status: 500 }
    )
  }
}


import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

/**
 * 카카오 로그인 콜백 처리 API
 * 
 * 카카오에서 인증 후 리다이렉트된 콜백을 처리합니다.
 * 
 * 1. 인증 코드로 액세스 토큰 받기
 * 2. 액세스 토큰으로 사용자 정보 가져오기
 * 3. 세션에 사용자 정보 저장
 * 
 * GET /api/kakao/callback?code=...
 */

interface KakaoTokenResponse {
  access_token: string
  token_type: string
  refresh_token?: string
  expires_in: number
  refresh_token_expires_in?: number
  scope?: string
}

interface KakaoUserInfo {
  id: number
  kakao_account?: {
    email_needs_agreement?: boolean
    is_email_valid?: boolean
    is_email_verified?: boolean
    email?: string
    profile_nickname_needs_agreement?: boolean
    profile_image_needs_agreement?: boolean
    profile?: {
      nickname?: string
      thumbnail_image_url?: string
      profile_image_url?: string
      is_default_image?: boolean
    }
    phone_number_needs_agreement?: boolean
    phone_number?: string
    is_phone_number_verified?: boolean
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get("code")
    const error = searchParams.get("error")

    // 에러 처리
    if (error) {
      console.error("[Kakao Callback] 카카오 인증 오류:", error)
      return NextResponse.redirect(
        new URL(`/?kakao_error=${error}`, request.url)
      )
    }

    if (!code) {
      console.error("[Kakao Callback] 인증 코드가 없습니다.")
      return NextResponse.redirect(
        new URL("/?kakao_error=no_code", request.url)
      )
    }

    const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY
    const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET // 클라이언트 시크릿 (선택사항)
    const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || 
      `${request.nextUrl.origin}/api/kakao/callback`

    if (!KAKAO_REST_API_KEY) {
      console.error("[Kakao Callback] KAKAO_REST_API_KEY가 설정되지 않았습니다.")
      return NextResponse.redirect(
        new URL("/?kakao_error=config", request.url)
      )
    }

    // 1. 인증 코드로 액세스 토큰 받기
    const tokenParams: Record<string, string> = {
      grant_type: "authorization_code",
      client_id: KAKAO_REST_API_KEY,
      redirect_uri: KAKAO_REDIRECT_URI,
      code: code,
    }

    // 클라이언트 시크릿이 설정되어 있으면 추가
    if (KAKAO_CLIENT_SECRET) {
      tokenParams.client_secret = KAKAO_CLIENT_SECRET
    }

    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(tokenParams),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error("[Kakao Callback] 토큰 요청 실패:", errorText)
      console.error("[Kakao Callback] 사용된 파라미터:", {
        grant_type: "authorization_code",
        client_id: KAKAO_REST_API_KEY?.substring(0, 10) + "...",
        redirect_uri: KAKAO_REDIRECT_URI,
        has_client_secret: !!KAKAO_CLIENT_SECRET,
      })
      return NextResponse.redirect(
        new URL("/?kakao_error=token_failed", request.url)
      )
    }

    const tokenData: KakaoTokenResponse = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // 2. 액세스 토큰으로 사용자 정보 가져오기
    // property_keys에 email을 추가하여 이메일 정보 요청
    const userInfoResponse = await fetch("https://kapi.kakao.com/v2/user/me?property_keys=[\"kakao_account.email\",\"kakao_account.phone_number\"]", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
    })

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text()
      console.error("[Kakao Callback] 사용자 정보 요청 실패:", errorText)
      return NextResponse.redirect(
        new URL("/?kakao_error=user_info_failed", request.url)
      )
    }

    const userInfo: KakaoUserInfo = await userInfoResponse.json()

    // 3. Supabase에 사용자 정보 저장/업데이트
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    console.log("[Kakao Callback] Supabase 저장 시도:", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      kakaoId: userInfo.id,
      email: userInfo.kakao_account?.email,
    })
    
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        
        // 사용자 정보 Upsert (있으면 업데이트, 없으면 생성)
        // instructor는 기본값 NULL (미지정)으로 설정
        const userData = {
          kakao_id: userInfo.id,
          email: userInfo.kakao_account?.email || null,
          nickname: userInfo.kakao_account?.profile?.nickname || null,
          profile_image_url: userInfo.kakao_account?.profile?.profile_image_url || null,
          thumbnail_image_url: userInfo.kakao_account?.profile?.thumbnail_image_url || null,
          phone_number: userInfo.kakao_account?.phone_number || null,
          instructor: null, // 기본값: 미지정
          login_provider: "kakao",
          last_login_at: new Date().toISOString(),
        }
        
        console.log("[Kakao Callback] 저장할 사용자 데이터:", userData)
        
        const { data: dbUser, error: dbError } = await supabase
          .from("users")
          .upsert(
            userData,
            {
              onConflict: "kakao_id",
              ignoreDuplicates: false,
            }
          )
          .select()
          .single()

        if (dbError) {
          console.error("[Kakao Callback] Supabase 저장 실패:", {
            error: dbError.message,
            code: dbError.code,
            details: dbError.details,
            hint: dbError.hint,
          })
          // Supabase 저장 실패해도 로그인은 계속 진행 (쿠키는 저장)
        } else {
          console.log("[Kakao Callback] Supabase 저장 성공:", {
            userId: dbUser?.id,
            kakaoId: dbUser?.kakao_id,
            email: dbUser?.email,
            instructor: dbUser?.instructor,
          })
        }
      } catch (supabaseError) {
        console.error("[Kakao Callback] Supabase 클라이언트 오류:", supabaseError)
        // Supabase 오류는 무시하고 로그인 계속 진행
      }
    } else {
      console.warn("[Kakao Callback] Supabase 환경 변수가 설정되지 않아 사용자 정보를 저장하지 않습니다.", {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
      })
    }

    // 4. 세션에 사용자 정보 저장 (쿠키 사용)
    const cookieStore = await cookies()
    const userData = {
      id: userInfo.id,
      email: userInfo.kakao_account?.email || "",
      nickname: userInfo.kakao_account?.profile?.nickname || "",
      phoneNumber: userInfo.kakao_account?.phone_number || "",
      profileImage: userInfo.kakao_account?.profile?.profile_image_url || "",
      thumbnailImage: userInfo.kakao_account?.profile?.thumbnail_image_url || "",
      accessToken: accessToken,
      loginTime: new Date().toISOString(),
    }

    // 쿠키에 사용자 정보 저장 (30일 유효)
    cookieStore.set("kakao_user", JSON.stringify(userData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30일
      path: "/",
    })

    console.log("[Kakao Callback] 로그인 성공:", userInfo.id)

    // 메인 페이지로 리다이렉트
    return NextResponse.redirect(new URL("/?kakao_login=success", request.url))
  } catch (error) {
    console.error("[Kakao Callback] 콜백 처리 오류:", error)
    return NextResponse.redirect(
      new URL(`/?kakao_error=callback_failed`, request.url)
    )
  }
}


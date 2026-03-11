import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { Readable } from "stream"

/**
 * YouTube 영상 업로드 API
 * POST /api/youtube/upload
 * 
 * 요청 본문:
 * {
 *   videoUrl: string,  // 렌더링된 영상 URL
 *   title: string,
 *   description: string,
 *   thumbnailUrl?: string,
 *   scheduledTime?: string,  // ISO 8601 형식 (선택사항, 없으면 즉시 업로드)
 *   tags?: string[],
 *   categoryId?: string,
 *   privacyStatus?: "private" | "unlisted" | "public"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      videoUrl,
      title,
      description,
      thumbnailUrl,
      scheduledTime,
      tags = [],
      categoryId = "22", // People & Blogs
      privacyStatus = "private",
      tokens: tokensFromBody, // 클라이언트에서 전달한 토큰
    } = body

    // 필수 필드 검증 (description은 선택, 유튜브 API 허용)
    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "제목(title)이 필요합니다." },
        { status: 400 }
      )
    }
    const hasVideo = videoUrl && typeof videoUrl === "string" && (videoUrl.startsWith("blob:") ? body.videoBase64 : true)
    if (!hasVideo) {
      return NextResponse.json(
        { error: "영상 URL 또는 videoBase64가 필요합니다." },
        { status: 400 }
      )
    }
    const descriptionStr = description != null ? String(description) : ""

    // YouTube 토큰 확인 (요청 본문에서 받거나 쿠키에서 받기)
    let tokens = tokensFromBody
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    
    // 요청 본문에 토큰이 없으면 쿠키에서 가져오기
    if (!tokens) {
      const tokensStr = cookieStore.get("youtube_tokens")?.value
      
      if (!tokensStr) {
        return NextResponse.json(
          { error: "YouTube 계정이 연결되지 않았습니다. 설정에서 연결해주세요." },
          { status: 401 }
        )
      }
      
      try {
        tokens = JSON.parse(tokensStr)
      } catch (e) {
        return NextResponse.json(
          { error: "YouTube 토큰을 읽을 수 없습니다. 설정에서 다시 연결해주세요." },
          { status: 401 }
        )
      }
    }

    // 토큰 만료 확인
    const expiresAt = new Date(tokens.expires_at)
    const now = new Date()
    const isTokenExpired = expiresAt < now

    // OAuth2 클라이언트 생성
    // Client ID와 Secret은 요청 본문에서 받거나 환경 변수에서 가져오기
    const clientId = body.clientId || process.env.YOUTUBE_CLIENT_ID
    const clientSecret = body.clientSecret || process.env.YOUTUBE_CLIENT_SECRET
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/youtube/callback`

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "YouTube API 설정이 필요합니다. Client ID와 Secret을 설정해주세요." },
        { status: 500 }
      )
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    )

    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: new Date(tokens.expires_at).getTime(),
    })

    // 토큰이 만료되었으면 갱신
    if (isTokenExpired) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken()
        oauth2Client.setCredentials(credentials)
        
        // 갱신된 토큰 저장 (클라이언트에서 처리하도록 반환)
        const newTokens = {
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || tokens.refresh_token,
          expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : tokens.expires_at,
        }
        
        // 쿠키에 저장 (선택사항, 클라이언트에서도 업데이트 필요)
        cookieStore.set("youtube_tokens", JSON.stringify(newTokens), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365, // 1년
        })
        
        // tokens 변수도 업데이트
        tokens = newTokens
      } catch (refreshError) {
        console.error("[YouTube] 토큰 갱신 실패:", refreshError)
        return NextResponse.json(
          { error: "YouTube 토큰 갱신에 실패했습니다. 설정에서 다시 연결해주세요." },
          { status: 401 }
        )
      }
    }

    // YouTube Data API 클라이언트 생성
    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    })

    // 영상 다운로드
    console.log("[YouTube] 영상 다운로드 시작:", videoUrl)
    
    let videoBuffer: Buffer
    
    // videoUrl 유효성 검증
    if (!videoUrl || typeof videoUrl !== "string") {
      throw new Error("유효하지 않은 영상 URL입니다.")
    }
    
    // blob URL인 경우 base64 데이터로 받기
    if (videoUrl.startsWith("blob:")) {
      // 클라이언트에서 base64로 변환해서 전달해야 함
      const videoBase64 = body.videoBase64
      if (!videoBase64) {
        throw new Error("blob URL은 서버에서 접근할 수 없습니다. 클라이언트에서 base64 데이터를 전달해주세요.")
      }
      videoBuffer = Buffer.from(videoBase64, "base64")
      console.log("[YouTube] Base64 영상 데이터 사용:", videoBuffer.length, "bytes")
    } else if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
      // HTTP/HTTPS URL인 경우 다운로드
      const videoResponse = await fetch(videoUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      })
      
      if (!videoResponse.ok) {
        throw new Error(`영상 다운로드 실패: ${videoResponse.status} ${videoResponse.statusText}`)
      }
      
      videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
      console.log("[YouTube] 영상 다운로드 완료:", videoBuffer.length, "bytes")
    } else {
      throw new Error(`유효하지 않은 영상 URL 형식입니다: ${videoUrl}`)
    }

    // 예약 시간 설정
    let publishAt: string | undefined
    if (scheduledTime) {
      const scheduledDate = new Date(scheduledTime)
      const now = new Date()
      if (scheduledDate > now) {
        publishAt = scheduledDate.toISOString()
        console.log("[YouTube] 예약 업로드:", publishAt)
      } else {
        console.log("[YouTube] 예약 시간이 과거이므로 즉시 업로드")
      }
    }

    // YouTube 업로드
    console.log("[YouTube] YouTube 업로드 시작...")
    const uploadResponse = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title,
          description: descriptionStr,
          tags: tags.length > 0 ? tags : undefined,
          categoryId,
        },
        status: {
          privacyStatus: publishAt ? "private" : privacyStatus, // 예약 업로드는 private로 시작
          publishAt, // 예약 시간 설정
        },
      },
      media: {
        body: Readable.from(videoBuffer),
        mimeType: "video/mp4",
      },
    })

    const videoId = uploadResponse.data.id
    console.log("[YouTube] 업로드 완료, Video ID:", videoId)

    // 썸네일 업로드 (있는 경우)
    if (thumbnailUrl && videoId) {
      try {
        console.log("[YouTube] 썸네일 다운로드 시작:", thumbnailUrl)
        
        // thumbnailUrl 유효성 검증
        if (typeof thumbnailUrl === "string" && (thumbnailUrl.startsWith("http://") || thumbnailUrl.startsWith("https://"))) {
          const thumbnailResponse = await fetch(thumbnailUrl, {
            method: "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          })
          
          if (thumbnailResponse.ok) {
            const thumbnailBuffer = Buffer.from(await thumbnailResponse.arrayBuffer())
            console.log("[YouTube] 썸네일 업로드 시작...")
            await youtube.thumbnails.set({
              videoId: videoId,
              media: {
                body: Readable.from(thumbnailBuffer),
                mimeType: "image/jpeg",
              },
            })
            console.log("[YouTube] 썸네일 업로드 완료")
          }
        } else {
          console.warn("[YouTube] 유효하지 않은 썸네일 URL:", thumbnailUrl)
        }
      } catch (thumbnailError) {
        console.error("[YouTube] 썸네일 업로드 실패 (무시):", thumbnailError)
        // 썸네일 업로드 실패해도 영상 업로드는 성공한 것으로 처리
      }
    }

    return NextResponse.json({
      success: true,
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      scheduledTime: publishAt,
      message: publishAt 
        ? `YouTube 업로드가 예약되었습니다! (예약 시간: ${new Date(publishAt).toLocaleString("ko-KR")})`
        : "YouTube 업로드가 완료되었습니다!",
    })
  } catch (error) {
    console.error("[YouTube] 업로드 오류:", error)
    return NextResponse.json(
      { 
        error: "YouTube 업로드 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "알 수 없는 오류"
      },
      { status: 500 }
    )
  }
}


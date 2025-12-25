import { type NextRequest, NextResponse } from "next/server"

// 긴 렌더링 작업을 위해 타임아웃 설정 (Vercel Pro 플랜 최대값: 800초)
export const maxDuration = 800 // 800초 (약 13분) - Vercel Pro 플랜 최대값
export const runtime = 'nodejs' // Node.js 런타임 사용

/**
 * Cloud Run을 통한 영상 렌더링 API
 * 
 * 환경 변수 설정:
 * 1. CLOUD_RUN_RENDER_URL: Cloud Run 서비스 URL (예: https://video-renderer-xxxxx.run.app)
 * 2. CLOUD_RUN_AUTH_TOKEN (선택사항): Cloud Run 인증 토큰 (인증이 필요한 경우)
 * 
 * 환경 변수 설정 방법:
 * - 로컬 개발: .env.local 파일에 추가
 *   CLOUD_RUN_RENDER_URL=https://your-service.run.app
 *   CLOUD_RUN_AUTH_TOKEN=your-auth-token (선택사항)
 * 
 * - Vercel 배포: Vercel 대시보드 > Settings > Environment Variables에서 추가
 * 
 * 요청 데이터:
 * - audioBase64: 오디오 파일 (base64 인코딩)
 * - subtitles: 자막 배열 [{id, start, end, text}]
 * - characterImage: 배경 인물 이미지 URL
 * - autoImages: 자동 이미지 배열 [{id, url, startTime, endTime, keyword, motion?}]
 * - duration: 영상 길이 (초)
 * - config: 렌더링 설정 {width, height, fps}
 * 
 * Cloud Run 서비스 요구사항:
 * - POST /render 엔드포인트 제공
 * - 요청 본문: 위의 요청 데이터 형식
 * - 응답 형식: { success: boolean, videoUrl: string, downloadUrl?: string, projectId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    // 요청 크기 확인 (Vercel 제한: 4.5MB)
    const contentLength = request.headers.get("content-length")
    if (contentLength) {
      const sizeMB = parseInt(contentLength) / 1024 / 1024
      if (sizeMB > 4.5) {
        return NextResponse.json(
          { 
            error: "요청 크기가 너무 큽니다. Cloud Storage를 사용하여 오디오를 업로드해주세요.",
            details: `요청 크기: ${sizeMB.toFixed(2)}MB, Vercel 제한: 4.5MB`
          },
          { status: 413 }
        )
      }
    }

    const {
      audioBase64,
      audioGcsUrl,
      subtitles,
      characterImage,
      characterImageGcsUrl,
      characterImageUrl,
      autoImages,
      duration,
      config = { width: 1920, height: 1080, fps: 30 },
    } = await request.json()

    if ((!audioBase64 && !audioGcsUrl) || !subtitles || (!characterImage && !characterImageGcsUrl && !characterImageUrl)) {
      return NextResponse.json(
        { error: "audioBase64 또는 audioGcsUrl, subtitles, characterImage, characterImageGcsUrl 또는 characterImageUrl이 필요합니다." },
        { status: 400 }
      )
    }

    // 긴 영상(15분 이상)인 경우 경고 메시지 반환
    const durationMinutes = duration / 60
    if (duration > 900) { // 15분 이상
      return NextResponse.json(
        { 
          error: `긴 영상(${durationMinutes.toFixed(1)}분)은 Vercel API Route를 통해 렌더링할 수 없습니다. 타임아웃이 발생합니다.\n\n` +
            `해결 방법:\n` +
            `1. 프론트엔드에서 Cloud Run에 직접 요청하도록 설정하세요.\n` +
            `2. Vercel 환경 변수에 NEXT_PUBLIC_CLOUD_RUN_RENDER_URL을 설정하세요.\n` +
            `3. 또는 영상 길이를 15분 미만으로 줄여주세요.`,
          details: `영상 길이: ${durationMinutes.toFixed(1)}분, Vercel API Route 타임아웃: 800초(약 13분)`
        },
        { status: 400 }
      )
    }

    console.log("[v0] Cloud Run 렌더링 API 호출 시작", { duration, durationMinutes: durationMinutes.toFixed(1) })

    // Cloud Run 서비스 URL (환경 변수에서 가져오기)
    const CLOUD_RUN_URL = process.env.CLOUD_RUN_RENDER_URL

    if (!CLOUD_RUN_URL) {
      return NextResponse.json(
        { error: "CLOUD_RUN_RENDER_URL 환경 변수가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    // Cloud Run 서비스에 렌더링 요청 전송
    // 긴 렌더링 작업을 위해 타임아웃을 800초(약 13분)로 설정 (Vercel Pro 플랜 최대값)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 800 * 1000) // 800초
    
    let renderResponse
    try {
      // 긴 렌더링 작업을 위해 커스텀 fetch 옵션 사용
      // Next.js의 기본 fetch는 undici를 사용하므로, 커스텀 dispatcher로 타임아웃 설정
      const fetchOptions: any = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Cloud Run 인증이 필요한 경우 Authorization 헤더 추가
          ...(process.env.CLOUD_RUN_AUTH_TOKEN && {
            Authorization: `Bearer ${process.env.CLOUD_RUN_AUTH_TOKEN}`,
          }),
        },
        body: JSON.stringify({
          ...(audioGcsUrl ? { audioGcsUrl } : { audioBase64 }),
          subtitles,
          ...(characterImageGcsUrl 
            ? { characterImageGcsUrl } 
            : characterImageUrl 
              ? { characterImageUrl } 
              : { characterImage }),
          autoImages: autoImages || [],
          duration,
          config,
        }),
        signal: controller.signal,
      }
      
      // Node.js 환경에서 긴 타임아웃을 위해 커스텀 dispatcher 사용
      // undici 패키지가 설치되어 있으므로 사용 가능
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        try {
          // undici를 동적으로 import (webpack external 설정으로 번들링 방지)
          const undici = await import('undici')
          const { Agent } = undici
          fetchOptions.dispatcher = new Agent({
            connectTimeout: 60000, // 60초
            headersTimeout: 800 * 1000, // 800초 (약 13분) - Vercel Pro 플랜 최대값
            bodyTimeout: 800 * 1000, // 800초
          })
          console.log("[v0] 커스텀 dispatcher로 타임아웃 설정: 800초")
        } catch (undiciError: any) {
          // undici를 사용할 수 없는 경우, 기본 fetch 사용
          console.warn("[v0] undici Agent를 사용할 수 없습니다. 기본 fetch 사용 (타임아웃: 약 5분):", undiciError.message || undiciError)
          // Next.js의 기본 fetch는 약 5분 타임아웃이 있으므로,
          // 긴 렌더링 작업의 경우 Cloud Run이 스트리밍 응답을 보내도록 수정 필요
        }
      }
      
      renderResponse = await fetch(`${CLOUD_RUN_URL}/render`, fetchOptions)
      
      clearTimeout(timeoutId)
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      // 타임아웃 오류 처리
      if (fetchError.name === 'AbortError' || fetchError.code === 'UND_ERR_HEADERS_TIMEOUT') {
        console.error("[v0] Cloud Run 렌더링 타임아웃 (800초 초과)")
        return NextResponse.json(
          { 
            error: "렌더링 시간이 너무 오래 걸립니다. 영상 길이를 줄이거나 잠시 후 다시 시도해주세요.",
            details: "타임아웃: 800초 (약 13분)"
          },
          { status: 504 }
        )
      }
      
      throw fetchError
    }

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text()
      console.error("[v0] Cloud Run 렌더링 실패:", errorText)
      
      // HTML 응답인 경우 (엔드포인트가 없는 경우)
      if (errorText.trim().startsWith("<!") || errorText.includes("<!doctype")) {
        return NextResponse.json(
          { 
            error: `Cloud Run 서비스에 /render 엔드포인트가 구현되지 않았습니다. Cloud Run 서비스에 POST /render 엔드포인트를 구현해주세요.`,
            details: `응답 상태: ${renderResponse.status}, URL: ${CLOUD_RUN_URL}/render`
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: `Cloud Run 렌더링 실패: ${renderResponse.status}`, details: errorText.substring(0, 200) },
        { status: renderResponse.status }
      )
    }

    // Cloud Run에서 반환된 영상 데이터 받기
    const contentType = renderResponse.headers.get("content-type") || ""
    const responseText = await renderResponse.text()

    // HTML 응답인 경우 (엔드포인트가 없는 경우)
    if (responseText.trim().startsWith("<!") || responseText.includes("<!doctype")) {
      return NextResponse.json(
        { 
          error: `Cloud Run 서비스가 HTML을 반환했습니다. /render 엔드포인트가 구현되지 않은 것 같습니다.`,
          details: `URL: ${CLOUD_RUN_URL}/render`
        },
        { status: 500 }
      )
    }

    // 방법 1: Cloud Run이 직접 영상 바이너리를 반환하는 경우
    if (contentType.startsWith("video/") || contentType.startsWith("application/octet-stream")) {
      const videoBuffer = Buffer.from(responseText, "base64")
      const videoBase64 = videoBuffer.toString("base64")

      console.log("[v0] Cloud Run 렌더링 완료 (바이너리 반환)")

      return NextResponse.json({
        success: true,
        videoBase64, // base64 인코딩된 영상 데이터
        videoUrl: null,
        downloadUrl: null,
        projectId: `project_${Date.now()}`,
      })
    }

    // 방법 2: Cloud Run이 JSON으로 URL을 반환하는 경우
    let renderResult
    try {
      renderResult = JSON.parse(responseText)
    } catch (parseError) {
      console.error("[v0] JSON 파싱 실패:", parseError)
      return NextResponse.json(
        { 
          error: `Cloud Run 서비스가 유효하지 않은 JSON을 반환했습니다.`,
          details: `응답 내용: ${responseText.substring(0, 200)}...`
        },
        { status: 500 }
      )
    }

    console.log("[v0] Cloud Run 렌더링 완료 (URL 반환)")

    return NextResponse.json({
      success: true,
      videoUrl: renderResult.videoUrl, // Cloud Run에서 반환한 영상 URL
      downloadUrl: renderResult.downloadUrl, // 다운로드 URL (선택사항)
      videoBase64: renderResult.videoBase64, // 또는 base64 데이터 (선택사항)
      projectId: renderResult.projectId || `project_${Date.now()}`,
    })
  } catch (error) {
    console.error("[v0] Render API error:", error)
    return NextResponse.json(
      { error: `Video rendering failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}

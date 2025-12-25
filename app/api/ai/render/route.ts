import { type NextRequest, NextResponse } from "next/server"

// 긴 렌더링 작업을 위해 타임아웃 설정 (Vercel Pro 플랜 최대값: 800초)
// 주의: 실제 타임아웃은 영상 길이에 따라 동적으로 계산되지만, 
// Vercel의 maxDuration은 함수 실행 시간 제한이므로 최대값으로 설정
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
      asyncMode = true, // 기본값: 비동기 모드 (타임아웃 방지)
    } = await request.json()

    if ((!audioBase64 && !audioGcsUrl) || !subtitles || (!characterImage && !characterImageGcsUrl && !characterImageUrl)) {
      return NextResponse.json(
        { error: "audioBase64 또는 audioGcsUrl, subtitles, characterImage, characterImageGcsUrl 또는 characterImageUrl이 필요합니다." },
        { status: 400 }
      )
    }

    console.log("[v0] Cloud Run 렌더링 API 호출 시작", { asyncMode, duration })

    // Cloud Run 서비스 URL (환경 변수에서 가져오기)
    const CLOUD_RUN_URL = process.env.CLOUD_RUN_RENDER_URL

    if (!CLOUD_RUN_URL) {
      return NextResponse.json(
        { error: "CLOUD_RUN_RENDER_URL 환경 변수가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    // 비동기 모드: 작업 시작 후 jobId 반환 (타임아웃 없음)
    if (asyncMode) {
      console.log("[v0] 비동기 모드: 작업 시작 요청 (타임아웃 없음)")
      
      const fetchOptions: any = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
          asyncMode: true, // Cloud Run에 비동기 모드 알림
        }),
      }
      
      // 작업 시작 요청 (짧은 타임아웃: 30초)
      const startResponse = await fetch(`${CLOUD_RUN_URL}/render`, {
        ...fetchOptions,
        signal: AbortSignal.timeout(30000), // 30초 타임아웃 (작업 시작만 확인)
      })
      
      if (!startResponse.ok) {
        const errorText = await startResponse.text()
        console.error("[v0] 작업 시작 실패:", errorText)
        return NextResponse.json(
          { error: `작업 시작 실패: ${startResponse.status}`, details: errorText.substring(0, 200) },
          { status: startResponse.status }
        )
      }
      
      const startResult = await startResponse.json()
      
      // jobId가 반환되면 비동기 작업 시작 성공
      if (startResult.jobId) {
        console.log("[v0] 비동기 작업 시작 성공:", startResult.jobId)
        return NextResponse.json({
          success: true,
          jobId: startResult.jobId,
          status: "processing",
          message: "렌더링 작업이 시작되었습니다. 상태를 확인해주세요.",
          statusUrl: `${CLOUD_RUN_URL}/status/${startResult.jobId}`,
        })
      } else {
        // jobId가 없으면 동기 모드로 처리 (기존 방식)
        console.log("[v0] jobId가 없음, 동기 모드로 처리")
        // 아래 동기 모드 코드로 계속 진행
      }
    }

    // 동기 모드: 기존 방식 (짧은 영상용)
    console.log("[v0] 동기 모드: 렌더링 완료까지 대기")
    
    // 영상 길이에 따라 타임아웃을 동적으로 계산
    // 렌더링 시간 = 영상 길이 * 0.5 (초) + 여유 시간 60초
    // 최대값: Vercel Pro 플랜 제한인 800초 (약 13분)
    // 최소값: 300초 (5분)
    const calculatedTimeout = Math.max(
      300, // 최소 5분
      Math.min(
        800, // 최대 13분 (Vercel Pro 플랜 제한)
        Math.ceil((duration || 0) * 0.5) + 60 // 영상 길이 * 0.5 + 여유 60초
      )
    )
    
    const timeoutSeconds = calculatedTimeout
    const timeoutMs = timeoutSeconds * 1000
    
    console.log(`[v0] 타임아웃 계산: 영상 길이 ${duration?.toFixed(1)}초 → 타임아웃 ${timeoutSeconds}초 (${(timeoutSeconds / 60).toFixed(1)}분)`)
    
    // 타임아웃 경고 (26분 영상은 약 1560초가 필요하지만 800초 제한)
    if (duration && duration > 26 * 60) {
      console.warn(`[v0] 경고: 영상 길이가 ${(duration / 60).toFixed(1)}분으로 매우 깁니다. 타임아웃 제한(${timeoutSeconds}초) 내에 완료되지 않을 수 있습니다.`)
    }

    // Cloud Run 서비스에 렌더링 요청 전송
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    
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
            headersTimeout: timeoutMs, // 동적으로 계산된 타임아웃
            bodyTimeout: timeoutMs, // 동적으로 계산된 타임아웃
          })
          console.log(`[v0] 커스텀 dispatcher로 타임아웃 설정: ${timeoutSeconds}초 (${(timeoutSeconds / 60).toFixed(1)}분)`)
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
        console.error(`[v0] Cloud Run 렌더링 타임아웃 (${timeoutSeconds}초 초과)`)
        const durationMinutes = duration ? (duration / 60).toFixed(1) : "알 수 없음"
        return NextResponse.json(
          { 
            error: "렌더링 시간이 너무 오래 걸립니다. 영상 길이를 줄이거나 잠시 후 다시 시도해주세요.",
            details: `타임아웃: ${timeoutSeconds}초 (약 ${(timeoutSeconds / 60).toFixed(1)}분), 영상 길이: ${durationMinutes}분`,
            timeoutSeconds,
            videoDuration: duration,
            suggestion: duration && duration > 26 * 60 
              ? "26분 이상의 긴 영상은 여러 개의 짧은 영상으로 나누어 렌더링하는 것을 권장합니다."
              : "영상 길이를 줄이거나 Cloud Run 서버의 리소스를 늘려보세요."
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

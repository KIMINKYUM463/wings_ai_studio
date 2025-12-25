import { type NextRequest, NextResponse } from "next/server"

/**
 * Cloud Run 렌더링 작업 상태 확인 API
 * 
 * GET /api/ai/render/status?jobId={jobId}
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get("jobId")

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId 파라미터가 필요합니다." },
        { status: 400 }
      )
    }

    const CLOUD_RUN_URL = process.env.CLOUD_RUN_RENDER_URL

    if (!CLOUD_RUN_URL) {
      return NextResponse.json(
        { error: "CLOUD_RUN_RENDER_URL 환경 변수가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    console.log(`[v0] 작업 상태 확인 요청: ${jobId}`)

    // Cloud Run에서 작업 상태 확인
    const statusResponse = await fetch(`${CLOUD_RUN_URL}/status/${jobId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CLOUD_RUN_AUTH_TOKEN && {
          Authorization: `Bearer ${process.env.CLOUD_RUN_AUTH_TOKEN}`,
        }),
      },
      signal: AbortSignal.timeout(10000), // 10초 타임아웃
    })

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text()
      console.error(`[v0] 상태 확인 실패 (${statusResponse.status}):`, errorText)
      return NextResponse.json(
        { error: `상태 확인 실패: ${statusResponse.status}`, details: errorText.substring(0, 200) },
        { status: statusResponse.status }
      )
    }

    const statusResult = await statusResponse.json()
    console.log(`[v0] 작업 상태: ${statusResult.status}`, { jobId, progress: statusResult.progress })

    return NextResponse.json({
      success: true,
      jobId,
      status: statusResult.status, // "processing", "completed", "failed"
      progress: statusResult.progress, // 0-100
      videoUrl: statusResult.videoUrl,
      downloadUrl: statusResult.downloadUrl,
      videoBase64: statusResult.videoBase64,
      error: statusResult.error,
      message: statusResult.message,
    })
  } catch (error) {
    console.error("[v0] Status API error:", error)
    return NextResponse.json(
      { error: `상태 확인 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}


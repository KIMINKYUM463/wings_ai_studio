import { NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

/**
 * 인트로 영상 생성 API
 * POST /api/generate-intro-video
 * 
 * Replicate Sora-2 모델을 사용하여 인트로 영상 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, replicateApiKey } = body

    if (!prompt) {
      return NextResponse.json(
        { error: "프롬프트가 필요합니다." },
        { status: 400 }
      )
    }

    if (!replicateApiKey) {
      return NextResponse.json(
        { error: "Replicate API 키가 필요합니다." },
        { status: 400 }
      )
    }

    console.log("[인트로 영상 생성 API] 시작...")
    console.log("[인트로 영상 생성 API] 프롬프트:", prompt.substring(0, 100) + "...")

    // Replicate openai/sora-2 모델로 영상 생성
    const response = await fetch("https://api.replicate.com/v1/models/openai/sora-2/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          seconds: 12, // 12초
          aspect_ratio: "landscape",
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[인트로 영상 생성 API] API 호출 실패:", errorText)
      return NextResponse.json(
        { error: `Replicate API 호출 실패: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log("[인트로 영상 생성 API] 예측 생성됨:", data.id)

    // 폴링으로 결과 확인
    let predictionId = data.id
    let status = data.status
    let videoUrl = null

    while (status === "starting" || status === "processing") {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2초 대기
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          Authorization: `Bearer ${replicateApiKey}`,
        },
      })
      
      if (!statusResponse.ok) {
        return NextResponse.json(
          { error: `상태 확인 실패: ${statusResponse.status}` },
          { status: statusResponse.status }
        )
      }
      
      const statusData = await statusResponse.json()
      status = statusData.status
      
      if (status === "succeeded" && statusData.output) {
        videoUrl = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output
        console.log("[인트로 영상 생성 API] 영상 생성 완료:", videoUrl)
        break
      } else if (status === "failed" || status === "canceled") {
        return NextResponse.json(
          { error: `영상 생성 실패: ${status}` },
          { status: 500 }
        )
      }
      
      console.log(`[인트로 영상 생성 API] 진행 중... (${status})`)
    }
    
    if (videoUrl) {
      return NextResponse.json({
        success: true,
        videoUrl: videoUrl,
      })
    } else {
      return NextResponse.json(
        { error: "영상 URL을 가져올 수 없습니다." },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[인트로 영상 생성 API] 실패:", error)
    return NextResponse.json(
      {
        error: `영상 생성 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      },
      { status: 500 }
    )
  }
}


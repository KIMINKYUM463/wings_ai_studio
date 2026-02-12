import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "프롬프트가 필요합니다." },
        { status: 400 }
      )
    }

    // Replicate API 키 (하드코딩 - moneytaker ai에서만)
    const REPLICATE_API_KEY = "r8_baQDZUG5bjR24N1qKO8kBk3CcyLCe8b25sgGx"
    const model = "google/imagen-4"

    console.log("[MoneyTaker API] 이미지 생성 시작:", prompt.substring(0, 50) + "...")

    const imageResponse = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
        body: JSON.stringify({
          input: {
            prompt: `MANDATORY: PHOTOREALISTIC, REALISTIC PHOTOGRAPHY, professional photography, high-quality photo, lifelike, cinematic photo, NOT illustration, NOT cartoon, NOT drawing, NOT painting, NOT AI-generated look, NOT artificial appearance, Korean people only, Korean appearance, Korean ethnicity, Korean facial features, Korean person, all people must be Korean, Korean style, Korean atmosphere, Korean setting, Korean environment, Korean culture, Korean lifestyle, absolutely no Western people, no Caucasian, no European, no American, no foreigners, no Japanese, no Chinese, no other Asian ethnicity, no foreign languages, no English text, no foreign signs, no foreign architecture, no foreign style, no foreign elements, ONLY Korean people, Korean features, Korean skin tone, Korean hair, Korean eyes, Korean traditional or modern Korean setting, Korean office, Korean consultation room, Korean business environment, ${prompt}, natural, realistic, candid, lifestyle photography, authentic moments, real Korean people only, natural expressions, everyday Korean life, unposed, genuine, high quality, professional photography style, photorealistic, no text, no watermark, no foreign elements`,
            aspect_ratio: "16:9",
            output_format: "png",
            safety_filter_level: "block_medium_and_above",
          },
        }),
    })

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text()
      console.error("[MoneyTaker API] Replicate API 오류:", imageResponse.status, errorText)
      return NextResponse.json(
        { error: `이미지 생성 실패: ${imageResponse.status}` },
        { status: imageResponse.status }
      )
    }

    const imageData = await imageResponse.json()
    console.log("[MoneyTaker API] Replicate 이미지 생성 응답:", imageData.status)

    if (imageData.status === "succeeded" && imageData.output) {
      const imageUrl = Array.isArray(imageData.output) ? imageData.output[0] : imageData.output
      console.log("[MoneyTaker API] 이미지 생성 성공:", imageUrl)
      return NextResponse.json({ success: true, imageUrl })
    } else if (imageData.status === "processing" || imageData.status === "starting") {
      // 폴링 방식으로 결과 확인
      const predictionId = imageData.id
      console.log("[MoneyTaker API] 이미지 생성 중, 폴링 시작:", predictionId)
      let attempts = 0
      const maxAttempts = 30

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000)) // 2초 대기

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            Authorization: `Token ${REPLICATE_API_KEY}`,
          },
        })

        if (!statusResponse.ok) {
          return NextResponse.json(
            { error: `상태 확인 실패: ${statusResponse.status}` },
            { status: statusResponse.status }
          )
        }

        const statusData = await statusResponse.json()
        console.log("[MoneyTaker API] 폴링 상태:", statusData.status)

        if (statusData.status === "succeeded" && statusData.output) {
          const imageUrl = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output
          console.log("[MoneyTaker API] 이미지 생성 성공 (폴링):", imageUrl)
          return NextResponse.json({ success: true, imageUrl })
        } else if (statusData.status === "failed") {
          console.error("[MoneyTaker API] 이미지 생성 실패:", statusData.error)
          return NextResponse.json(
            { error: `이미지 생성 실패: ${statusData.error || "알 수 없는 오류"}` },
            { status: 500 }
          )
        }

        attempts++
      }

      console.warn("[MoneyTaker API] 이미지 생성 타임아웃")
      return NextResponse.json(
        { error: "이미지 생성 시간 초과" },
        { status: 504 }
      )
    } else {
      console.error("[MoneyTaker API] 이미지 생성 실패 상태:", imageData.status, imageData)
      return NextResponse.json(
        { error: `이미지 생성 실패: ${imageData.error || "알 수 없는 오류"}` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[MoneyTaker API] 이미지 생성 중 오류:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "이미지 생성에 실패했습니다.",
      },
      { status: 500 }
    )
  }
}


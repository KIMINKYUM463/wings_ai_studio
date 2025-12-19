import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export const dynamic = 'force-dynamic'

/**
 * 썸네일 생성 API
 * POST /api/youmaker/generate-thumbnail
 * 
 * Gemini 2.5 Flash Image 모델로 직접 이미지 생성
 * 실패 시 나노바나나 모델로 fallback
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      title, 
      thumbnailText, 
      geminiApiKey,
      replicateApiKey // fallback용 (선택사항)
    } = body

    if (!title && !thumbnailText) {
      return NextResponse.json(
        { error: "제목 또는 썸네일 문구가 필요합니다." },
        { status: 400 }
      )
    }

    // 나노바나나를 직접 사용 (Replicate API 키 필수)
    if (!replicateApiKey) {
      return NextResponse.json(
        { error: "Replicate API Key가 필요합니다. 나노바나나 모델을 사용하기 위해 설정 페이지에서 API 키를 입력해주세요." },
        { status: 400 }
      )
    }

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API Key가 필요합니다. 프롬프트 생성을 위해 설정 페이지에서 API 키를 입력해주세요." },
        { status: 400 }
      )
    }

    // 나노바나나로 직접 생성
    console.log("[Thumbnail Generation] 나노바나나 모델로 이미지 생성 시작")
    return await generateWithNanobanana(title, thumbnailText, replicateApiKey, geminiApiKey)
  } catch (error) {
    console.error("[Thumbnail Generation] 오류:", error)
    return NextResponse.json(
      {
        error: `썸네일 생성 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

/**
 * 나노바나나 모델로 이미지 생성 (fallback)
 */
async function generateWithNanobanana(
  title: string,
  thumbnailText: string,
  replicateApiKey: string,
  geminiApiKey: string
): Promise<NextResponse> {
  try {
    // Gemini로 프롬프트 생성
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })
    
    const promptGenerationPrompt = `Create a YouTube thumbnail image (16:9 aspect ratio) based on the following information:

Title: ${title || "N/A"}
Thumbnail Text (Korean): ${thumbnailText || "N/A"}

Create an English prompt for generating a YouTube thumbnail image that includes the Korean text "${thumbnailText || ""}" clearly visible in the image.

Requirements:
- Write the prompt in English only
- YouTube thumbnail style (high click-through rate design)
- 16:9 aspect ratio
- Bright and vibrant colors
- The Korean text "${thumbnailText || ""}" must be clearly visible and readable in the thumbnail
- Make sure the Korean text is prominently displayed and easy to read
- Visually impactful composition
- Professional and high quality
- The Korean text should be the main focal point or clearly visible

Write only the prompt without any additional explanation.`

    const promptResult = await model.generateContent(promptGenerationPrompt)
    let imagePrompt = promptResult.response.text().trim()

    // 한국어 텍스트가 프롬프트에 포함되도록 보장
    if (thumbnailText && !imagePrompt.includes(thumbnailText)) {
      imagePrompt = `${imagePrompt}, with Korean text "${thumbnailText}" clearly visible and readable in the thumbnail`
    }

    console.log("[Thumbnail Generation] 나노바나나 프롬프트:", imagePrompt)

    // 나노바나나 모델로 이미지 생성
    // 한국어 텍스트를 직접 프롬프트에 포함
    const finalPrompt = thumbnailText 
      ? `${imagePrompt}. The Korean text "${thumbnailText}" must be prominently displayed in the image.`
      : imagePrompt

    const response = await fetch("https://api.replicate.com/v1/models/google/nano-banana-pro/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${replicateApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: finalPrompt,
          aspect_ratio: "16:9",
          output_format: "png",
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`나노바나나 API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // 폴링
    const predictionId = data.id
    let attempts = 0
    const maxAttempts = 120

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Token ${replicateApiKey}`,
          },
        }
      )

      if (!statusResponse.ok) {
        throw new Error(`상태 확인 실패: ${statusResponse.status}`)
      }

      const statusData = await statusResponse.json()

      if (statusData.status === "succeeded" && statusData.output) {
        let imageUrl: string
        if (typeof statusData.output === "string") {
          imageUrl = statusData.output
        } else if (Array.isArray(statusData.output) && statusData.output.length > 0) {
          imageUrl = statusData.output[0]
        } else if (statusData.output.url) {
          imageUrl = statusData.output.url
        } else {
          imageUrl = String(statusData.output)
        }
        
        console.log("[Thumbnail Generation] 나노바나나 이미지 생성 완료:", imageUrl)
        return NextResponse.json({
          success: true,
          imageUrl,
          prompt: finalPrompt,
        })
      } else if (statusData.status === "failed") {
        throw new Error(`이미지 생성 실패: ${statusData.error || "알 수 없는 오류"}`)
      }

      attempts++
    }

    throw new Error("이미지 생성 시간 초과")
  } catch (error) {
    console.error("[Thumbnail Generation] 나노바나나 실패:", error)
    throw error
  }
}

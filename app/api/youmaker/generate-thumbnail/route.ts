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

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API Key가 필요합니다." },
        { status: 400 }
      )
    }

    // Gemini AI 초기화 (이미지 생성 모델)
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    
    try {
      // Gemini 2.5 Flash Image 모델로 직접 이미지 생성 시도
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" })

      console.log("[Thumbnail Generation] Gemini 2.5 Flash Image 이미지 생성 시작")
      const imagePrompt = `앞에 주제에 대한 유튜브 썸네일 16:9로 만들려고 해. 썸네일 만들어줘

제목: ${title || "없음"}
썸네일 문구: ${thumbnailText || "없음"}

위 정보를 바탕으로 유튜브 썸네일 이미지를 생성해주세요.

요구사항:
- 유튜브 썸네일 스타일 (클릭률 높은 디자인)
- 16:9 비율
- 밝고 강렬한 색상
- 텍스트 영역 고려 (썸네일 문구가 들어갈 공간)
- 시각적으로 임팩트 있는 구도
- 전문적이고 고품질`

      const result = await model.generateContent(imagePrompt)
      const response = await result.response

      // 이미지 URL 추출
      let imageUrl: string | null = null
      
      try {
        const text = response.text()
        console.log("[Thumbnail Generation] Gemini 응답:", text.substring(0, 200))
        
        // JSON 형식으로 응답이 올 수 있음
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          imageUrl = parsed.imageUrl || parsed.url || parsed.image || parsed.output
        }
        
        // URL 패턴으로 직접 찾기
        if (!imageUrl) {
          const urlMatch = text.match(/https?:\/\/[^\s"']+/)
          if (urlMatch) {
            imageUrl = urlMatch[0]
          }
        }
        
        // 응답 객체에서 직접 이미지 데이터 확인
        if (!imageUrl && response.candidates && response.candidates[0]) {
          const candidate = response.candidates[0]
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData && part.inlineData.data) {
                // Base64 이미지 데이터인 경우
                const base64Data = part.inlineData.data
                const mimeType = part.inlineData.mimeType || "image/png"
                imageUrl = `data:${mimeType};base64,${base64Data}`
                break
              } else if (part.url) {
                imageUrl = part.url
                break
              }
            }
          }
        }
      } catch (error) {
        console.error("[Thumbnail Generation] 이미지 URL 추출 오류:", error)
      }

      if (imageUrl) {
        console.log("[Thumbnail Generation] Gemini 이미지 생성 완료:", imageUrl.substring(0, 100))
        return NextResponse.json({
          success: true,
          imageUrl,
          prompt: imagePrompt,
        })
      }
    } catch (geminiError) {
      console.error("[Thumbnail Generation] Gemini 이미지 생성 실패:", geminiError)
      
      // Gemini 실패 시 나노바나나로 fallback (Replicate API 키가 있는 경우)
      if (replicateApiKey) {
        console.log("[Thumbnail Generation] 나노바나나 모델로 fallback 시도")
        return await generateWithNanobanana(title, thumbnailText, replicateApiKey, geminiApiKey)
      }
      
      throw geminiError
    }

    // Gemini로 이미지 생성 실패하고 Replicate API 키도 없는 경우
    throw new Error("이미지 생성에 실패했습니다. Replicate API 키를 제공하면 나노바나나 모델로 재시도합니다.")
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
    
    const promptGenerationPrompt = `앞에 주제에 대한 유튜브 썸네일 16:9로 만들려고 해. 썸네일 만들어줘

제목: ${title || "없음"}
썸네일 문구: ${thumbnailText || "없음"}

위 정보를 바탕으로 유튜브 썸네일 이미지 생성을 위한 영어 프롬프트를 작성해주세요.

요구사항:
- 영어로만 작성
- 유튜브 썸네일 스타일 (클릭률 높은 디자인)
- 16:9 비율
- 밝고 강렬한 색상
- 텍스트 영역 고려 (썸네일 문구가 들어갈 공간)
- 시각적으로 임팩트 있는 구도
- 전문적이고 고품질

프롬프트만 작성하고 설명은 추가하지 마세요.`

    const promptResult = await model.generateContent(promptGenerationPrompt)
    const imagePrompt = promptResult.response.text().trim()

    console.log("[Thumbnail Generation] 나노바나나 프롬프트:", imagePrompt)

    // 나노바나나 모델로 이미지 생성
    const response = await fetch("https://api.replicate.com/v1/models/google/nano-banana-pro/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${replicateApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: imagePrompt,
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
          prompt: imagePrompt,
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

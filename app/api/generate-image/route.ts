import { type NextRequest, NextResponse } from "next/server"
import { generateImagePrompt, generateImageWithReplicate } from "@/app/longform/actions"

export async function POST(request: NextRequest) {
  try {
    const { scriptText, openaiApiKey, replicateApiKey, category, historyStyle, customPrompt } = await request.json()

    if (!scriptText) {
      return NextResponse.json({ error: "scriptText가 필요합니다." }, { status: 400 })
    }

    if (!openaiApiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 400 })
    }

    if (!replicateApiKey) {
      return NextResponse.json({ error: "Replicate API 키가 필요합니다." }, { status: 400 })
    }

    console.log("[v0] 이미지 생성 API 호출 시작, 카테고리:", category || "health", "역사 스타일:", historyStyle || "없음")

    // 1. 프롬프트 생성 (카테고리 및 역사 스타일 포함)
    // customPrompt가 있으면 직접 사용, 없으면 생성
    let prompt = customPrompt
    if (!prompt) {
      prompt = await generateImagePrompt(scriptText, openaiApiKey, category || "health", historyStyle)
    }
    // 16:9 비율 강제 추가
    if (!prompt.includes("16:9") && !prompt.includes("aspect ratio")) {
      prompt = `${prompt}, 16:9 aspect ratio, cinematic composition`
    }
    console.log("[v0] 프롬프트 생성 완료")

    // 2. 이미지 생성 (aspectRatio 파라미터 추가 가능)
    const aspectRatio = prompt.includes("9:16") ? "9:16" : "16:9"
    const imageUrl = await generateImageWithReplicate(prompt, replicateApiKey, aspectRatio as "16:9" | "9:16")
    console.log("[v0] 이미지 생성 완료")

    return NextResponse.json({
      success: true,
      imageUrl,
      prompt,
    })
  } catch (error) {
    console.error("[v0] 이미지 생성 API 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "이미지 생성에 실패했습니다.",
      },
      { status: 500 }
    )
  }
}



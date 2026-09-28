import { type NextRequest, NextResponse } from "next/server"
import { generateImagePrompt, generateImageWithReplicate } from "@/app/WingsAIStudio/longform/actions"
import {
  isNsfwImageError,
  softenImagePromptForSafety,
} from "@/lib/longform-v2/image-prompt-safety"

export async function POST(request: NextRequest) {
  try {
    const { scriptText, openaiApiKey, replicateApiKey, category, historyStyle, customPrompt, commonStylePrompt, topic, characterAnchor, backgroundStyle, renderingStyle } = await request.json()

    if (!scriptText) {
      return NextResponse.json({ error: "scriptText가 필요합니다." }, { status: 400 })
    }

    if (!replicateApiKey) {
      return NextResponse.json({ error: "Replicate API 키가 필요합니다." }, { status: 400 })
    }

    console.log("[v0] 이미지 생성 API 호출 시작, 카테고리:", category || "health", "역사 스타일:", historyStyle || "없음", "공통 스타일:", commonStylePrompt ? "있음" : "없음", "캐릭터 앵커:", characterAnchor ? "있음" : "없음", "배경 스타일:", backgroundStyle ? "있음" : "없음", "그림체 스타일:", renderingStyle ? "있음" : "없음")

    // 1. 프롬프트 생성 (카테고리, 역사 스타일, 공통 스타일, 캐릭터 앵커 포함)
    // customPrompt가 있으면 직접 사용, 없으면 OpenAI로 생성
    let prompt = customPrompt
    if (!prompt) {
      if (!openaiApiKey) {
        return NextResponse.json(
          { error: "customPrompt가 없을 때는 OpenAI API 키가 필요합니다." },
          { status: 400 }
        )
      }
      prompt = await generateImagePrompt(scriptText, openaiApiKey, category || "health", historyStyle, commonStylePrompt, topic, characterAnchor, backgroundStyle, renderingStyle)
    } else if (commonStylePrompt || characterAnchor) {
      // customPrompt가 있어도 공통 스타일이나 캐릭터 앵커가 있으면 추가
      if (commonStylePrompt) {
        prompt = `${prompt}, ${commonStylePrompt}`
      }
      if (characterAnchor) {
        prompt = `${characterAnchor}, ${prompt}`
      }
    }
    // 16:9 비율 강제 추가
    if (!prompt.includes("16:9") && !prompt.includes("aspect ratio")) {
      prompt = `${prompt}, 16:9 aspect ratio, cinematic composition`
    }
    console.log("[v0] 프롬프트 생성 완료")

    // 2. 이미지 생성 — NSFW 차단 시 완화 프롬프트로 1회 재시도
    const aspectRatio = prompt.includes("9:16") ? "9:16" : "16:9"
    let usedPrompt = prompt
    let imageUrl: string
    try {
      imageUrl = await generateImageWithReplicate(prompt, replicateApiKey, aspectRatio as "16:9" | "9:16")
    } catch (firstErr) {
      if (!isNsfwImageError(firstErr)) throw firstErr
      usedPrompt = softenImagePromptForSafety(prompt)
      console.warn("[v0] NSFW 차단 → 완화 프롬프트로 재시도")
      imageUrl = await generateImageWithReplicate(
        usedPrompt,
        replicateApiKey,
        aspectRatio as "16:9" | "9:16",
      )
    }
    console.log("[v0] 이미지 생성 완료")

    return NextResponse.json({
      success: true,
      imageUrl,
      prompt: usedPrompt,
      nsfwRetried: usedPrompt !== prompt,
    })
  } catch (error) {
    console.error("[v0] 이미지 생성 API 오류:", error)
    const raw = error instanceof Error ? error.message : "이미지 생성에 실패했습니다."
    const friendly = /nsfw|content.?detect/i.test(raw)
      ? "이미지 안전 필터(NSFW)에 걸렸습니다. 전쟁·시체 등 자극 묘사를 줄인 뒤 다시 시도해 주세요."
      : raw
    return NextResponse.json(
      {
        success: false,
        error: friendly,
      },
      { status: 500 }
    )
  }
}



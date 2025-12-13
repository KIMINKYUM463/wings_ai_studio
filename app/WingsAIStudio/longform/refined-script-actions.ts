"use server"

import Anthropic from "@anthropic-ai/sdk"

/**
 * 정교한 대본 생성 함수 (Anthropic Opus 4.5 사용)
 * 초안을 바탕으로 매우 정교하고 완성도 높은 최종 대본을 생성합니다.
 * Anthropic SDK를 사용하여 Claude Opus 4.5 모델로 생성합니다.
 */
export async function generateRefinedScript(
  scriptDraft: string,
  topic: string,
  duration?: number,
  targetChars?: number
): Promise<string> {
  const ANTHROPIC_API_KEY = "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"

  if (!ANTHROPIC_API_KEY) {
    throw new Error("Anthropic API 키가 설정되지 않았습니다.")
  }

  try {
    const anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    })

    const durationText = duration ? `${duration}분 분량` : "적절한 분량"
    const charsText = targetChars ? `(약 ${targetChars}자)` : ""

    const systemPrompt = `당신은 롱폼 비디오 대본 완성 전문가입니다. 초안을 바탕으로 매우 정교하고 완성도 높은 최종 대본을 완성해주세요.

요구사항:
- ${durationText} ${charsText}
- 자연스럽고 매력적인 대화체
- 매우 높은 완성도와 깊이 있는 내용
- 섹션 헤더나 제목 없이 순수한 대본 내용만 작성
- 문장이 자연스럽게 흐르도록 구성
- 시청자의 관심을 끝까지 유지하는 흐름`

    const userPrompt = `주제: ${topic}

대본 초안:
${scriptDraft}

위 초안을 바탕으로 매우 정교하고 완성도 높은 최종 대본을 완성해주세요. 문장이 자연스럽게 연결되도록 작성하고, 시청자의 관심을 끝까지 유지할 수 있도록 구성해주세요.`

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 20000,
      temperature: 1,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    })

    const content = msg.content[0]?.type === "text" ? msg.content[0].text : null

    if (!content) {
      throw new Error("정교한 대본을 생성할 수 없습니다.")
    }

    return content.trim()
  } catch (error) {
    console.error("정교한 대본 생성 실패:", error)
    throw error
  }
}



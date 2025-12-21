import { NextRequest, NextResponse } from "next/server"

// 내부적으로 사용할 OpenAI API 키 (사용자 입력 무시)
const INTERNAL_OPENAI_API_KEY = "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"

export async function POST(request: NextRequest) {
  try {
    const { script, duration, openaiApiKey } = await request.json()

    if (!script || script.trim().length === 0) {
      return NextResponse.json({ error: "대본이 없습니다." }, { status: 400 })
    }

    // 내부적으로 항상 제공된 API 키 사용 (사용자 입력 무시)
    const GPT_API_KEY = INTERNAL_OPENAI_API_KEY

    const durationText = duration === 1 ? "1분" : duration === 2 ? "2분" : "3분"
    const targetWordCount = duration === 1 ? 150 : duration === 2 ? 300 : 450 // 분당 약 150단어 기준

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `당신은 쇼츠 콘텐츠 전문가입니다. 주어진 롱폼 대본을 ${durationText} 길이의 쇼츠에 맞게 요약해주세요.

요구사항:
- 핵심 내용만 간결하게 요약
- 시청자의 관심을 끄는 흥미로운 내용 우선
- 자연스러운 문장으로 연결
- 약 ${targetWordCount}단어 내외
- 문단 구분 없이 연속된 텍스트로 작성
- 각 문장은 10-20자 내외로 짧게 작성`,
          },
          {
            role: "user",
            content: `다음 롱폼 대본을 ${durationText} 길이의 쇼츠 대본으로 요약해주세요:\n\n${script}`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: `API 호출 실패: ${response.status} ${JSON.stringify(errorData)}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const summarizedScript = data.choices[0]?.message?.content?.trim()

    if (!summarizedScript) {
      return NextResponse.json({ error: "요약된 대본을 생성할 수 없습니다." }, { status: 500 })
    }

    return NextResponse.json({ summarizedScript })
  } catch (error) {
    console.error("[API] 대본 요약 실패:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}




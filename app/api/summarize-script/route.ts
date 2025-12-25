import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { script, duration, openaiApiKey } = await request.json()

    if (!script || script.trim().length === 0) {
      return NextResponse.json({ error: "대본이 없습니다." }, { status: 400 })
    }

    // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
    const GPT_API_KEY = openaiApiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

    if (!GPT_API_KEY) {
      return NextResponse.json({ error: "OpenAI API 키가 설정되지 않았습니다." }, { status: 400 })
    }

    const durationText = duration === 1 ? "1분" : duration === 2 ? "2분" : "3분"
    // 한글 TTS 기준: 분당 약 300자 (초당 약 5자)
    const targetCharCount = duration === 1 ? 300 : duration === 2 ? 600 : 900
    // 한글은 1자당 약 2-3토큰이 필요하므로, 목표 글자수에 충분한 토큰 할당 (여유있게 4배)
    const maxTokens = Math.ceil(targetCharCount * 4) // 1분: 1200, 2분: 2400, 3분: 3600
    // gpt-4o-mini의 max_completion_tokens는 최대 16384이므로, 이를 초과하지 않도록 제한
    const finalMaxTokens = Math.min(16384, Math.max(maxTokens, 2000))

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

⚠️⚠️⚠️ 매우 중요한 요구사항:
- 정확히 ${durationText} 분량의 쇼츠 대본을 작성하세요
- 목표 글자 수: 정확히 ${targetCharCount}자 내외 (±10% 허용)
- 최소 글자 수: ${Math.floor(targetCharCount * 0.9)}자 이상
- 최대 글자 수: ${Math.ceil(targetCharCount * 1.1)}자 이하
- 절대로 ${Math.floor(targetCharCount * 0.9)}자 미만으로 작성하지 마세요
- 절대로 ${Math.ceil(targetCharCount * 1.1)}자 초과로 작성하지 마세요

요구사항:
- 핵심 내용만 간결하게 요약
- 시청자의 관심을 끄는 흥미로운 내용 우선
- 자연스러운 문장으로 연결
- 문단 구분 없이 연속된 텍스트로 작성
- 각 문장은 10-20자 내외로 짧게 작성
- 작성 후 반드시 글자 수를 확인하여 목표 범위 내인지 확인하세요`,
          },
          {
            role: "user",
            content: `다음 롱폼 대본을 정확히 ${durationText} 길이(${targetCharCount}자 내외)의 쇼츠 대본으로 요약해주세요:\n\n${script}`,
          },
        ],
        max_tokens: finalMaxTokens,
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




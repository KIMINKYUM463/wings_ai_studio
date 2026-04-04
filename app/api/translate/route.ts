import { type NextRequest, NextResponse } from "next/server"

/**
 * 번역 API
 * OpenAI GPT를 사용하여 텍스트를 번역합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage = "en", sourceLanguage = "ko", apiKey } = await request.json()
    
    // API 키 확인
    const OPENAI_API_KEY = apiKey || process.env.OPENAI_API_KEY || process.env.GPT_API_KEY
    
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API 키가 필요합니다. 설정에서 API 키를 입력해주세요." },
        { status: 400 }
      )
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "번역할 텍스트가 필요합니다." },
        { status: 400 }
      )
    }

    // 언어 코드 매핑
    const languageNames: Record<string, string> = {
      "ko": "한국어",
      "en": "영어",
      "ja": "일본어",
      "zh": "중국어",
      "es": "스페인어",
      "fr": "프랑스어",
      "de": "독일어",
      "pt": "포르투갈어",
      "ru": "러시아어",
      "ar": "아랍어",
      "it": "이탈리아어",
      "vi": "베트남어",
      "th": "태국어",
      "id": "인도네시아어",
      "ms": "말레이어",
      "tr": "터키어",
    }

    const sourceLangName = languageNames[sourceLanguage] || sourceLanguage
    const targetLangName = languageNames[targetLanguage] || targetLanguage

    // 한국어인 경우 번역하지 않고 원본 반환
    if (targetLanguage === "ko") {
      return NextResponse.json({
        translatedText: text,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage,
      })
    }

    // OpenAI GPT를 사용한 번역
    const systemPrompt = `당신은 전문 번역가입니다. 주어진 텍스트를 ${sourceLangName}에서 ${targetLangName}로 정확하고 자연스럽게 번역해주세요.

번역 규칙:
1. 원문의 의미와 톤을 정확히 유지하세요
2. 자연스러운 ${targetLangName} 표현을 사용하세요
3. 전문 용어나 고유명사는 적절히 번역하세요
4. 문맥을 고려하여 번역하세요
5. 번역된 텍스트만 출력하세요 (설명이나 주석 없이)`

    const userPrompt = `다음 텍스트를 ${sourceLangName}에서 ${targetLangName}로 번역해주세요:\n\n${text}`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.3,
        max_tokens: Math.ceil(text.length * 2), // 원문 길이의 2배 정도 할당
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[번역 API] OpenAI API 오류:", errorText)
      return NextResponse.json(
        { error: `번역 실패: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const translatedText = data.choices?.[0]?.message?.content?.trim()

    if (!translatedText) {
      return NextResponse.json(
        { error: "번역 결과를 생성할 수 없습니다." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      translatedText: translatedText,
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
    })
  } catch (error) {
    console.error("[번역 API] 오류:", error)
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}



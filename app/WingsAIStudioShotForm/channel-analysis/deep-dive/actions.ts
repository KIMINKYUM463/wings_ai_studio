"use server"

/**
 * 영상 제목과 설명에서 AI를 활용하여 핵심 키워드 하나만 추출
 */
export async function extractKeywordFromVideo(
  title: string,
  description: string,
  apiKey?: string
): Promise<string | null> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GPT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `당신은 유튜브 영상 콘텐츠 분석 전문가입니다. 영상의 제목과 설명을 분석하여 이 영상에서 다루는 핵심 제품이나 키워드를 하나만 추출해주세요.

규칙:
1. 제목과 설명을 종합적으로 분석하여 가장 중요한 핵심 키워드 하나만 추출
2. 제품명, 브랜드명, 서비스명, 콘텐츠 주제 등이 될 수 있음
3. 2-15자 이내의 간결한 키워드로 추출
4. 일반적인 단어(영상, 채널, 구독, 리뷰, 추천 등)는 제외
5. 쿠팡에서 검색 가능한 제품명이나 키워드 우선
6. 키워드만 반환하고 설명이나 추가 텍스트는 포함하지 마세요

예시:
- "아이폰 15 프로 맥스 리뷰" → "아이폰 15 프로 맥스"
- "삼성 갤럭시 S24 언박싱" → "갤럭시 S24"
- "에어팟 프로 2 사용 후기" → "에어팟 프로 2"
- "쿠팡에서 산 노트북 추천" → "노트북"
- "건강식품 비타민 추천" → "비타민"

키워드를 찾을 수 없으면 "null"을 반환하세요.`,
          },
          {
            role: "user",
            content: `다음 영상 정보를 분석하여 핵심 키워드 하나만 추출해주세요:

제목: ${title}

설명: ${description || "(설명 없음)"}

핵심 키워드 하나만 추출해주세요:`,
          },
        ],
        max_tokens: 50,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const keyword = data.choices?.[0]?.message?.content?.trim()

    if (!keyword || keyword.toLowerCase() === "null" || keyword.toLowerCase() === "없음") {
      return null
    }

    // 키워드 정리 (따옴표 제거, 설명 제거)
    const cleanKeyword = keyword
      .replace(/^["'「」『』【】]|["'「」『』【】]$/g, "")
      .replace(/^키워드[:\s]*/i, "")
      .replace(/^핵심[:\s]*/i, "")
      .replace(/^제품[:\s]*/i, "")
      .replace(/^추출[:\s]*/i, "")
      .trim()
      .split("\n")[0] // 첫 줄만 사용
      .split(":")[0] // 콜론 이후 제거
      .trim()

    if (cleanKeyword.length < 2 || cleanKeyword.length > 20) {
      return null
    }

    return cleanKeyword
  } catch (error) {
    console.error("[Channel Analysis] 키워드 추출 실패:", error)
    return null
  }
}



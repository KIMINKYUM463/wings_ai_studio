"use server"

interface Message {
  role: "user" | "assistant"
  content: string
}

export async function sendChatMessage(userMessage: string, previousMessages: Message[], apiKey?: string) {
  // 전달받은 API 키 우선 사용, 없으면 환경 변수
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.")
  }

  const systemPrompt = `당신은 유튜브 전문가 AI 어시스턴트 '윙스AI'입니다. 
  
당신의 역할:
- 유튜브 채널 성장 전략 제공
- 콘텐츠 기획 및 아이디어 제안
- 영상 편집 및 제작 팁 공유
- 유튜브 알고리즘 이해 및 최적화 방법 설명
- 썸네일, 제목, 태그 최적화 조언
- 시청자 참여도 향상 방법 제시
- 수익화 전략 및 광고 수익 극대화 방법
- 쇼츠와 롱폼 콘텐츠 전략
- 트렌드 분석 및 바이럴 콘텐츠 제작 방법

답변 스타일:
- 친근하고 전문적인 톤
- 구체적이고 실행 가능한 조언 제공
- 필요시 예시와 함께 설명
- 한국 유튜브 시장에 특화된 정보 제공
- 최신 트렌드와 알고리즘 변화 반영

항상 사용자의 질문에 정확하고 도움이 되는 답변을 제공하세요.`

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
          { role: "system", content: systemPrompt },
          ...previousMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  } catch (error) {
    console.error("챗봇 응답 생성 실패:", error)
    throw new Error("챗봇 응답 생성에 실패했습니다.")
  }
}

"use server"

// 내부적으로 사용할 OpenAI API 키 (사용자 입력 무시)
const INTERNAL_OPENAI_API_KEY = "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"

export async function generateShortsTopics(category: "wisdom" | "health" | "self_improvement" | "society" | "history" | "space" | "fortune", apiKey?: string) {
  // 내부적으로 항상 제공된 API 키 사용 (사용자 입력 무시)
  const GPT_API_KEY = INTERNAL_OPENAI_API_KEY

  const categoryPrompts = {
    wisdom: "인생 명언, 지혜, 철학, 삶의 교훈과 관련된 쇼츠 주제",
    health: "건강, 웰빙, 생활 꿀팁과 관련된 쇼츠 주제",
    self_improvement: "자기계발, 성장, 목표 달성과 관련된 쇼츠 주제",
    society: "사회 트렌드, 최신 이슈와 관련된 쇼츠 주제",
    history: "역사 이야기, 역사적 사실과 관련된 쇼츠 주제",
    space: "우주, 천문학, 우주 탐사, 별과 행성, 우주 미스터리와 관련된 쇼츠 주제",
    fortune: "사주, 운세, 타로, 점성술, 사주팔자와 관련된 쇼츠 주제",
  }

  try {
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
            content:
              "당신은 쇼츠 콘텐츠 전문가입니다. 주어진 카테고리를 바탕으로 1-3분 길이의 쇼츠에 적합한 주제 10개를 생성해주세요. 각 주제는 시청자의 관심을 끌고 바이럴 가능성이 높아야 합니다.\n\n중요: 각 주제는 핵심 주제만 한 줄로 작성하세요. 제목과 내용을 나누지 말고, 주제 자체만 간결하게 작성하세요.\n\n출력 형식:\n1. 주제1\n2. 주제2\n3. 주제3\n...\n10. 주제10\n\n각 주제는 10-20자 내외의 간결한 핵심 주제만 작성하세요.",
          },
          {
            role: "user",
            content: `카테고리: ${categoryPrompts[category]}\n\n위 카테고리를 바탕으로 쇼츠에 적합한 핵심 주제 10개만 생성해주세요.\n\n요구사항:\n- 각 주제는 핵심 주제만 한 줄로 작성 (10-20자 내외)\n- 제목과 내용을 나누지 말고 주제 자체만 작성\n- 번호와 함께 간결하게 작성\n- 예시: "3초만에 알아보는 다이어트 꿀팁" (이런 식으로 한 줄로만)\n\n출력 형식:\n1. 주제1\n2. 주제2\n3. 주제3\n...\n10. 주제10`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("API 응답에서 내용을 찾을 수 없습니다.")
    }

    // 응답을 배열로 파싱 (핵심 주제만 추출)
    const lines = content.split("\n").filter((line: string) => line.trim())
    
    const topics: string[] = []
    for (const line of lines) {
      // 번호로 시작하는 줄만 추출 (1. 2. 3. 등)
      const match = line.match(/^\d+\.\s*(.+)$/)
      if (match && match[1]) {
        const topic = match[1].trim()
        // 제목과 내용이 나뉘어 있는 경우 제목만 추출 (한 칸 이전까지만)
        const cleanTopic = topic.split(/\s+/).slice(0, 5).join(" ").trim() // 최대 5단어까지만
        if (cleanTopic && cleanTopic.length > 0) {
          topics.push(cleanTopic)
        }
      }
      // 10개가 모이면 중단
      if (topics.length >= 10) break
    }
    
    // 10개가 안 모이면 추가 파싱 시도
    if (topics.length < 10) {
      const fallbackTopics = content
        .split("\n")
        .filter((line: string) => {
          const trimmed = line.trim()
          return trimmed && 
                 trimmed.length > 5 && 
                 trimmed.length < 50 && 
                 (trimmed.match(/^\d+\./) || trimmed.match(/^[-•]/))
        })
        .map((line: string) => {
          let topic = line
            .replace(/^\d+\.\s*/, "")
            .replace(/^[-•]\s*/, "")
            .trim()
          // 제목과 내용 분리 제거 (한 칸 이전까지만)
          const parts = topic.split(/\s+/)
          if (parts.length > 5) {
            topic = parts.slice(0, 5).join(" ")
          }
          return topic
        })
        .filter((topic: string) => topic && topic.length > 0)
        .slice(0, 10)
      
      // 중복 제거하면서 추가
      for (const topic of fallbackTopics) {
        if (!topics.includes(topic) && topics.length < 10) {
          topics.push(topic)
        }
      }
    }

    return topics.length > 0
      ? topics
      : [
          "3초만에 알아보는 다이어트 꿀팁",
          "운동 없이 살 빼는 비밀",
          "아침에 하면 안 되는 것 3가지",
          "물만 마셔도 살이 빠지는 방법",
          "의사가 절대 말하지 않는 건강 비밀",
        ]
  } catch (error) {
    console.error("주제 생성 실패:", error)

    return [
      "3초만에 알아보는 다이어트 꿀팁",
      "운동 없이 살 빼는 비밀",
      "아침에 하면 안 되는 것 3가지",
      "물만 마셔도 살이 빠지는 방법",
      "의사가 절대 말하지 않는 건강 비밀",
      "잠들기 전 5분 루틴",
      "스마트폰으로 건강 체크하는 법",
      "집에서 할 수 있는 간단 운동",
      "스트레스 해소 3초 테크닉",
      "하루 1분 명상의 놀라운 효과",
    ]
  }
}

export async function generateShortsScriptPlan(topic: string) {
  // 내부적으로 항상 제공된 API 키 사용 (사용자 입력 무시)
  const GPT_API_KEY = INTERNAL_OPENAI_API_KEY

  try {
    const systemPrompt = `당신은 쇼츠 대본 기획 전문가입니다. 15-20초 길이의 쇼츠에 최적화된 대본 기획안을 작성해주세요.

구조:
[훅] 첫 3초 안에 시청자를 사로잡는 강력한 훅
[본론] 핵심 내용을 간결하고 임팩트 있게 전달 (10-15초)
[마무리] 강력한 CTA와 기억에 남는 마무리 (2-5초)

특징:
- 시각적 요소와 텍스트 오버레이 활용
- 빠른 템포와 리듬감
- 바이럴 요소 포함
- 명확한 메시지 전달
- 15-20초 내에 완결되는 구성

총 300자 내외의 기획안으로 작성해주세요.`

    const userPrompt = `주제: ${topic}\n\n위 주제로 쇼츠에 최적화된 대본 기획안을 생성해주세요.`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
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
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("대본 기획을 생성할 수 없습니다.")
    }

    return content
  } catch (error) {
    console.error("대본 기획 생성 실패:", error)

    return `【쇼츠 대본 기획안】

[훅 - 0~3초]
• 충격적인 사실이나 질문으로 시작
• "${topic}"에 대한 놀라운 진실 공개
• 시청자의 호기심을 즉시 자극

[본론 - 3~15초]
• 핵심 정보를 3-5개 포인트로 압축
• 시각적 요소와 텍스트 오버레이 활용
• 빠른 템포로 정보 전달
• 실용적이고 즉시 적용 가능한 팁

[마무리 - 15~20초]
• 핵심 메시지 한 줄 요약
• 강력한 CTA (좋아요, 팔로우, 댓글)
• 다음 영상 예고로 연결

[시각적 요소]
• 텍스트 오버레이로 핵심 키워드 강조
• 빠른 컷 편집으로 리듬감 조성
• 트렌디한 음악과 효과음 활용

이 기획안을 바탕으로 상세한 대본을 작성하시면 됩니다.`
  }
}

export async function generateShortsScript(topic: string, duration: 1 | 2 | 3 = 1, apiKey?: string) {
  // 내부적으로 항상 제공된 API 키 사용 (사용자 입력 무시)
  const GPT_API_KEY = INTERNAL_OPENAI_API_KEY

  // 시간별 예상 문자 수 (초당 6.9자 기준)
  const charCounts = {
    1: 414, // 1분 = 60초 * 6.9
    2: 828, // 2분 = 120초 * 6.9
    3: 1242, // 3분 = 180초 * 6.9
  }

  const targetChars = charCounts[duration]

  try {
    const systemPrompt = `당신은 유튜브 쇼츠 대본 전문가입니다. ${duration}분 길이의 쇼츠에 최적화된 대본을 작성해주세요.

요구사항:
• ${duration}분 분량 (한국어 기준 약 ${targetChars}자)
• 자연스러운 대화체로 작성
• 초반 5초 안에 강력한 훅 포함
• 실용적이고 즉시 적용 가능한 내용
• 마지막에 "구독과 좋아요 부탁드립니다" CTA 포함
• 섹션 헤더나 제목 없이 순수한 대본 내용만 작성
• 표정이나 행동 묘사 절대 금지

구조:
1. 훅 (0-5초): 호기심 유발하는 강력한 시작
2. 본론 (5초-${duration * 60 - 5}초): 핵심 내용을 간결하게 전달
3. 마무리 (${duration * 60 - 5}초-${duration * 60}초): CTA와 함께 마무리

순수한 텍스트로만 자연스럽게 말하듯 작성해주세요.`

    const userPrompt = `주제: ${topic}

위 주제로 ${duration}분 분량의 쇼츠 대본을 생성해주세요. 
섹션 헤더나 제목 없이 순수한 대본 내용만 작성해주세요.
반드시 마지막에 "구독과 좋아요 부탁드립니다"를 포함해주세요.`

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
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("대본을 생성할 수 없습니다.")
    }

    // 섹션 헤더가 포함되어 있다면 제거
    const cleanScript = content
      .replace(/【썸네일 제목】[\s\S]*?【스크립트】/g, "")
      .replace(/\[썸네일 제목\][\s\S]*?\[스크립트\]/g, "")
      .replace(/【썸네일 제목】.*?\n/g, "")
      .replace(/【스크립트】.*?\n/g, "")
      .replace(/\[썸네일 제목\].*?\n/g, "")
      .replace(/\[스크립트\].*?\n/g, "")
      .trim()

    return cleanScript
  } catch (error) {
    console.error("대본 생성 실패:", error)

    return `이거 몰라서 큰일 날 뻔했어요. ${topic}에 대해서 말인데요, 저도 처음엔 몰랐거든요. 그런데 이렇게 해보니까 완전 달라지더라고요. 진짜 간단한 방법인데 효과는 대박이에요. 주변 사람들도 다 놀라면서 어떻게 했냐고 물어보더라고요. 이 방법 써보시고 도움이 되셨다면 영상 속 링크를 클릭해보세요.`
  }
}

export async function improveShortsScript(currentScript: string, improvementRequest: string) {
  // 내부적으로 항상 제공된 API 키 사용 (사용자 입력 무시)
  const GPT_API_KEY = INTERNAL_OPENAI_API_KEY

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "당신은 쇼츠 대본 편집 전문가입니다. 사용자의 요청에 따라 쇼츠 대본을 개선해주세요. 15-20초 길이에 최적화된 형태를 유지하면서 더 나은 내용으로 수정해주세요. 한국어 기준 150-250자 내외로 작성하여 정확한 길이를 맞춰주세요.",
          },
          {
            role: "user",
            content: `현재 대본:\n${currentScript}\n\n개선 요청: ${improvementRequest}\n\n위 요청에 따라 대본을 개선해주세요. 15-20초 분량을 유지해주세요.`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const improvedScript = data.choices?.[0]?.message?.content

    if (!improvedScript) {
      throw new Error("개선된 대본을 생성할 수 없습니다.")
    }

    return improvedScript
  } catch (error) {
    console.error("대본 개선 실패:", error)
    throw new Error("대본 개선에 실패했습니다. 다시 시도해주세요.")
  }
}

// 쇼츠용 후킹 제목 생성 (위 4~5줄, 아래 4~5줄로 생성)
export async function generateShortsHookingTitle(topic: string, script: string, apiKey?: string) {
  // 내부적으로 항상 제공된 API 키 사용 (사용자 입력 무시)
  const GPT_API_KEY = INTERNAL_OPENAI_API_KEY

  try {
    const titlePrompt = `당신은 바이럴 쇼츠 제목 전문가입니다. 사람들이 반드시 클릭하고 싶게 만드는 강력한 후킹 제목을 생성해주세요.

🎯 핵심 목표: 
1. 첫 1초 안에 시선을 사로잡고, 3초 안에 클릭하고 싶게 만드는 제목
2. line1과 line2가 논리적으로 연결되어야 함
3. line1: 꾸며주는 말 (후킹 문구)
4. line2: 핵심 내용 (주제와 관련된 실제 내용)

📝 작성 규칙 (매우 중요):
- 각 줄은 5-7자 내외 (매우 짧고 임팩트 있게)
- ⚠️ line1: 꾸며주는 말 (후킹 문구만, 주제 키워드 없음)
  - 예: "99%가 모르는", "충격적인", "숨겨진", "금지된", "아무도 모르는", "지금 공개", "절대 하지마"
  - 후킹 문구만 사용 (주제 키워드 포함 금지)
  
- ⚠️ line2: 핵심 내용 (주제 키워드 + 실제 내용)
  - 예: "건강 비밀", "명언의 진실", "투자 꿀팁", "다이어트 비법"
  - 주제의 핵심 키워드를 반드시 포함해야 함
  - 대본의 핵심 내용을 암시하는 문구

- ⚠️ line1과 line2는 논리적으로 연결되어야 함
  - line1이 "99%가 모르는"이면 line2는 "건강 비밀", "명언의 진실" 등
  - line1이 "충격적인"이면 line2는 "건강의 진실", "명언의 비밀" 등
  - line1이 "숨겨진"이면 line2는 "건강 비법", "투자 꿀팁" 등

- ⚠️ 필수: 제목만 봐도 어떤 주제/내용인지 알 수 있어야 함 (line2에 주제 키워드 포함)
- 스포일러 절대 금지 - 구체적인 답이나 방법을 직접 언급하지 말 것
- 평범한 표현 절대 금지 - "좋은", "유용한", "중요한" 같은 일반적 표현 절대 사용 금지
- 강렬하고 임팩트 있는 단어만 사용

🔥 line1 후킹 문구 예시 (꾸며주는 말):
- "99%가 모르는"
- "충격적인"
- "숨겨진"
- "금지된"
- "아무도 모르는"
- "지금 공개"
- "절대 하지마"
- "1분만에"
- "0원으로"
- "쇼킹한"

💡 좋은 예시 (주제: 건강) - line1(꾸며주는 말) + line2(핵심 내용):
- "99%가 모르는" / "건강 비밀"
- "충격적인" / "건강의 진실"
- "숨겨진" / "건강 비법"
- "금지된" / "건강 정보"
- "1분만에" / "건강 변화"
- "0원으로" / "건강 해결"

💡 좋은 예시 (주제: 명언) - line1(꾸며주는 말) + line2(핵심 내용):
- "99%가 모르는" / "명언의 진실"
- "충격적인" / "명언의 비밀"
- "숨겨진" / "명언의 의미"
- "아무도 모르는" / "명언의 힘"

⚠️ 매우 중요: 
- line1은 꾸며주는 말(후킹 문구)만, 주제 키워드 포함 금지
- line2는 핵심 내용(주제 키워드 + 실제 내용)
- line1과 line2는 논리적으로 연결되어야 함

반드시 JSON 형식으로만 응답하고, line1과 line2에 각각 5-7자 내외의 문자열을 포함해야 합니다:
{
  "line1": "첫 줄 (5-7자, 꾸며주는 말/후킹 문구만, 예: '99%가 모르는', '충격적인', '숨겨진')",
  "line2": "둘째 줄 (5-7자, 핵심 내용/주제 키워드 포함, 예: '건강 비밀', '명언의 진실')"
}`

    const userPrompt = `주제: ${topic}

대본 내용 (핵심만):
${script.substring(0, 1500)}...

위 주제와 대본의 핵심 내용을 분석하여, 사람들이 반드시 클릭하고 싶게 만드는 강력한 후킹 제목을 생성해주세요.

⚠️ 매우 중요한 필수 요구사항:
1. line1: 꾸며주는 말 (후킹 문구만, 주제 키워드 포함 금지)
   - 예: "99%가 모르는", "충격적인", "숨겨진", "금지된", "아무도 모르는", "지금 공개", "절대 하지마", "1분만에", "0원으로"
   - 주제 키워드(예: "건강", "명언" 등)를 포함하지 말 것
   - 후킹 문구만 사용

2. line2: 핵심 내용 (주제 키워드 + 실제 내용)
   - 주제의 핵심 키워드를 반드시 포함해야 함 (예: "건강", "명언", "투자" 등)
   - 대본의 핵심 내용을 암시하는 문구
   - 예: 주제가 "건강"이면 "건강 비밀", "건강의 진실", "건강 비법", "건강 정보" 등
   - 예: 주제가 "명언"이면 "명언의 진실", "명언의 비밀", "명언의 의미", "명언의 힘" 등

3. line1과 line2는 논리적으로 연결되어야 함
   - line1이 "99%가 모르는"이면 line2는 "건강 비밀", "명언의 진실" 등
   - line1이 "충격적인"이면 line2는 "건강의 진실", "명언의 비밀" 등
   - line1이 "숨겨진"이면 line2는 "건강 비법", "투자 꿀팁" 등
   - 두 줄이 자연스럽게 연결되어야 함

4. 제목만 봐도 어떤 주제/내용인지 알 수 있어야 함 (line2에 주제 키워드 포함)
5. 평범한 표현 절대 금지 - "좋은", "유용한", "중요한" 같은 일반적 표현 절대 사용 금지
6. 강렬하고 임팩트 있는 단어만 사용
7. 대본의 가장 충격적이고 흥미로운 부분을 찾아서 line2에 반영

대본의 가장 충격적이고 흥미로운 부분을 찾아서, 주제 키워드와 함께 그것을 암시하되 직접적으로 말하지 않는 방식으로 line2를 작성해주세요.

주제 "${topic}"의 핵심 키워드를 line2에 반드시 포함시켜야 합니다.
line1은 꾸며주는 말(후킹 문구)만, line2는 핵심 내용(주제 키워드 + 실제 내용)으로 작성해야 합니다.`

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
            content: titlePrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 500,
        temperature: 1.2, // 더 창의적이고 강렬한 제목 생성 (다양성 증가)
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("제목을 생성할 수 없습니다.")
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      
      // line1과 line2 추출 (5-6자)
      let line1 = parsed.line1 || ""
      let line2 = parsed.line2 || ""
      
      // 5-6자로 제한
      if (line1.length > 6) {
        line1 = line1.substring(0, 6)
      }
      if (line2.length > 6) {
        line2 = line2.substring(0, 6)
      }
      
      // 빈 값이면 fallback 사용 (더 후킹되게)
      if (!line1 || !line2) {
        const words = topic.split(" ")
        const firstWord = words[0] || "이것"
        // 더 강렬한 후킹 문구 사용
        line1 = line1 || `${firstWord}의 충격`.substring(0, 6) || "99%가 모르는".substring(0, 6)
        line2 = line2 || "비밀 공개".substring(0, 6) || "지금 확인".substring(0, 6)
      }
      
      console.log("[Shorts] 제목 생성 완료:", { line1, line2 })
      
      return {
        line1: line1.substring(0, 6), // 최대 6자
        line2: line2.substring(0, 6), // 최대 6자
      }
    }

    // JSON 파싱 실패 시 fallback (더 후킹되게)
    const words = topic.split(" ")
    const firstWord = words[0] || "이것"
    return {
      line1: `${firstWord}의 충격`.substring(0, 6) || "99%가 모르는".substring(0, 6),
      line2: "비밀 공개".substring(0, 6) || "지금 확인".substring(0, 6),
    }
  } catch (error) {
    console.error("제목 생성 실패:", error)
    const words = topic.split(" ")
    const firstWord = words[0] || "이것"
    return {
      line1: `${firstWord}의 충격`.substring(0, 6) || "99%가 모르는".substring(0, 6),
      line2: "비밀 공개".substring(0, 6) || "지금 확인".substring(0, 6),
    }
  }
}

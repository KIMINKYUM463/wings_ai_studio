"use server"

import Anthropic from "@anthropic-ai/sdk"

/**
 * 이미지 스타일 이름을 한국어로 변환하는 함수
 */
function getImageStyleName(style: string): string {
  const styleMap: Record<string, string> = {
    "stickman-animation": "스틱맨 애니메이션",
    "flat-2d-illustration": "플랫 2D 일러스트",
    "animation2": "애니메이션2",
    "animation3": "유럽풍 그래픽 노블",
    "semi-realistic-animation": "세미 리얼리스틱 애니메이션",
    "cinematic-realistic": "시네마틱 리얼리스틱",
    "documentary-photo": "다큐멘터리 사진 스타일",
    "vintage-illustration": "빈티지 일러스트",
    "dark-fantasy-concept": "다크 판타지 컨셉 아트",
    // 호환성을 위한 기존 스타일
    "animation": "애니메이션",
    "realistic": "실사",
  }
  return styleMap[style] || style
}

/**
 * 카테고리별 프롬프트 커스터마이징
 */
type CategoryType = 
  | "wisdom" | "religion" | "health" | "domestic_story" | "international_story"
  | "romance_of_three_kingdoms" | "folktale" | "science" | "history" | "horror"
  | "society" | "northkorea" | "space" | "self_improvement" | "economy"
  | "war" | "affair" | "ancient" | "biology" | "greek_roman_mythology"
  | "death" | "ai" | "alien" | "palmistry" | "physiognomy"
  | "fortune_telling" | "urban_legend" | "serial_crime" | "unsolved_case"
  | "reserve_army" | "elementary_school" | "psychology"

interface CategoryPrompts {
  plan?: string // 대본 기획 추가 지시사항
  draft?: string // 대본 초안 추가 지시사항
  final?: string // 최종 대본 추가 지시사항
}

const categoryPromptCustomizations: Record<string, CategoryPrompts> = {
  // 기본값 (모든 카테고리에 공통 적용)
  default: {
    plan: "",
    draft: "",
    final: ""
  },
  // 카테고리별 커스터마이징 예시
  health: {
    plan: "건강 관련 주제이므로 의학적 정확성과 실용성을 중시하세요.",
    draft: "건강 정보는 정확하고 검증된 내용으로 작성하되, 시니어층이 이해하기 쉽게 설명하세요.",
    final: "건강 관련 용어는 정확하게 사용하고, 의학적 근거를 언급하되 전문 용어는 쉽게 풀어서 설명하세요."
  },
  history: {
    plan: "역사적 사실과 배경을 정확하게 반영하고, 시니어층이 기억하는 역사적 사건과 연결하세요.",
    draft: "역사적 인물과 사건을 생생하게 묘사하되, 시니어층의 경험과 공감대를 형성하세요.",
    final: "역사적 사실을 정확하게 전달하되, 과거와 현재를 연결하는 통찰을 제공하세요."
  },
  wisdom: {
    plan: "인생의 지혜와 교훈을 시니어층의 경험과 연결하여 공감대를 형성하세요.",
    draft: "명언과 지혜를 일상 경험과 연결하여 실용적인 조언으로 전달하세요.",
    final: "인생의 깨달음을 따뜻하고 공감되는 톤으로 전달하세요."
  }
  // 다른 카테고리도 필요시 추가 가능
}

/**
 * 이미지 프롬프트 생성 함수
 * OpenAI API를 사용하여 대본 텍스트를 이미지 생성용 영어 프롬프트로 변환합니다.
 * 
 * @param scriptText - 이미지로 변환할 대본 텍스트 (한글 가능)
 * @param openaiApiKey - OpenAI API 키
 * @param category - 이미지 카테고리 (health, history, wisdom 등)
 * @param historyStyle - 역사 카테고리일 경우 스타일 (optional)
 * @returns 영어 이미지 프롬프트
 */
/**
 * 첫 번째 이미지에서 배경 스타일과 그림체 정보를 추출하는 함수
 * 실사화 스타일에서 배경과 렌더링 스타일의 일관성을 유지하기 위한 정보를 추출합니다.
 */
export async function extractBackgroundAndRenderingStyle(
  imageUrl: string,
  openaiApiKey: string
): Promise<{ backgroundStyle: string | null; renderingStyle: string | null }> {
  if (!openaiApiKey) {
    return { backgroundStyle: null, renderingStyle: null }
  }

  try {
    // 이미지 URL을 가져와서 base64로 변환
    let imageBase64: string | null = null
    try {
      const imageResponse = await fetch(imageUrl)
      if (imageResponse.ok) {
        const imageBlob = await imageResponse.blob()
        const arrayBuffer = await imageBlob.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        imageBase64 = buffer.toString('base64')
      }
    } catch (error) {
      console.warn("[Longform] 이미지 다운로드 실패:", error)
      return { backgroundStyle: null, renderingStyle: null }
    }

    if (!imageBase64) {
      return { backgroundStyle: null, renderingStyle: null }
    }

    const analysisPrompt = `다음 이미지를 분석하여 배경 스타일과 그림체(렌더링 스타일) 정보를 추출해주세요.

다음 형식으로만 응답하세요:
BACKGROUND_STYLE: [배경의 색상, 분위기, 조명, 스타일 등을 상세히 영어로 묘사]
RENDERING_STYLE: [그림체, 렌더링 기법, 시각적 스타일 등을 상세히 영어로 묘사]

중요:
- BACKGROUND_STYLE: 배경의 색상 팔레트, 조명 스타일, 분위기, 텍스처, 깊이감 등을 정확히 묘사
- RENDERING_STYLE: 렌더링 기법(실사, 세미리얼, 페인팅 등), 색감 처리, 선명도, 그림자 스타일, 질감 표현 등을 정확히 묘사
- 이 정보는 이후 모든 이미지에서 동일한 배경 스타일과 그림체를 유지하기 위해 사용됩니다

예시:
BACKGROUND_STYLE: cinematic background with warm golden hour lighting, soft natural light, atmospheric depth, muted color palette with warm browns and grays, shallow depth of field, cinematic composition
RENDERING_STYLE: hyperrealistic photorealistic rendering, 8K ultra-detailed, sharp focus, professional DSLR camera quality, natural skin texture, realistic material rendering, cinematic lighting`

    const messages: any[] = [
      {
        role: "system",
        content: "You analyze images to extract background style and rendering style information for maintaining visual consistency. Respond only in the specified format.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: analysisPrompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ],
      },
    ]

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 400,
        temperature: 0.3,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      
      if (data && data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
        const text = data.choices[0]?.message?.content || ""
        const backgroundMatch = text.match(/BACKGROUND_STYLE:\s*([\s\S]+?)(?=RENDERING_STYLE|$)/i)
        const renderingMatch = text.match(/RENDERING_STYLE:\s*([\s\S]+)/i)
        
        return {
          backgroundStyle: backgroundMatch ? backgroundMatch[1].trim() : null,
          renderingStyle: renderingMatch ? renderingMatch[1].trim() : null,
        }
      }
    }
  } catch (error) {
    console.warn("[Longform] 배경/그림체 스타일 추출 실패:", error)
  }
  
  return { backgroundStyle: null, renderingStyle: null }
}

/**
 * 첫 번째 이미지에서 캐릭터 정보를 추출하는 함수
 * 옷, 색상, 체형, 외모 등 캐릭터의 일관성을 유지하기 위한 정보를 추출합니다.
 */
export async function extractCharacterAnchor(
  imageUrl: string,
  scriptText: string,
  openaiApiKey: string,
  topic?: string
): Promise<string | null> {
  if (!openaiApiKey) {
    return null
  }

  try {
    // 이미지 URL을 가져와서 base64로 변환
    let imageBase64: string | null = null
    try {
      const imageResponse = await fetch(imageUrl)
      if (imageResponse.ok) {
        const imageBlob = await imageResponse.blob()
        const arrayBuffer = await imageBlob.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        imageBase64 = buffer.toString('base64')
      }
    } catch (error) {
      console.warn("[Longform] 이미지 다운로드 실패, 텍스트 기반 추출 시도:", error)
    }

    const analysisPrompt = imageBase64
      ? `다음 이미지를 분석하여 주인공 캐릭터의 상세 정보를 추출해주세요.

대본 텍스트: ${scriptText}
${topic ? `주제: ${topic}` : ""}

다음 형식으로만 응답하세요:
CHARACTER_ANCHOR: [캐릭터의 옷, 색상, 체형, 외모, 특징 등을 상세히 영어로 묘사]

⚠️ 매우 중요 - 실사화 스타일 일관성 유지:
- 이미지에서 실제로 보이는 모든 시각적 특징을 정확히 묘사해야 합니다
- 얼굴 특징: 얼굴형, 눈 모양과 색상, 코 모양, 입 모양, 턱선, 이마, 눈썹 등
- 헤어스타일: 머리 길이, 스타일, 색상, 가르마 위치 등
- 체형: 키, 체격, 어깨 폭, 팔 길이, 다리 길이 등
- 옷: 색상, 스타일, 디자인, 패턴, 소재 등 모든 세부사항
- 피부색과 톤
- 액세서리, 무기, 소지품 등 모든 소지품
- 특징적인 자세나 습관
- 이 정보는 이후 모든 이미지에서 정확히 동일한 캐릭터를 유지하기 위해 사용됩니다
- 인물이 없거나 풍경/사물만 있는 경우 "CHARACTER_ANCHOR: none"으로 응답

예시:
CHARACTER_ANCHOR: Korean warrior wearing dark blue traditional armor with gold trim, medium build, tall stature, black hair tied in a topknot, strong jawline, brown eyes, carrying a curved sword with a red tassel, wearing black boots with silver buckles

인물이 없으면 "CHARACTER_ANCHOR: none"으로 응답하세요.`
      : `다음 대본 텍스트를 분석하여 주인공 캐릭터의 상세 정보를 추출해주세요:

대본 텍스트: ${scriptText}
${topic ? `주제: ${topic}` : ""}

다음 형식으로만 응답하세요:
CHARACTER_ANCHOR: [캐릭터의 옷, 색상, 체형, 외모, 특징 등을 상세히 영어로 묘사]

중요:
- 대본에서 언급된 옷의 색상, 스타일, 디자인을 정확히 묘사
- 체형, 키, 체격 등을 묘사
- 얼굴 특징, 헤어스타일, 피부색 등을 묘사
- 액세서리, 무기, 소지품 등이 있으면 포함
- 이 정보는 이후 모든 이미지에서 동일한 캐릭터를 유지하기 위해 사용됩니다
- 인물이 없거나 풍경/사물만 있는 경우 "CHARACTER_ANCHOR: none"으로 응답

예시:
CHARACTER_ANCHOR: Korean warrior wearing dark blue traditional armor with gold trim, medium build, tall stature, black hair tied in a topknot, strong jawline, brown eyes, carrying a curved sword with a red tassel, wearing black boots with silver buckles

인물이 없으면 "CHARACTER_ANCHOR: none"으로 응답하세요.`

    const messages: any[] = [
      {
        role: "system",
        content: "You analyze images and text to extract detailed character information for maintaining visual consistency. Respond only in the specified format.",
      },
      {
        role: "user",
        content: imageBase64
          ? [
              { type: "text", text: analysisPrompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ]
          : analysisPrompt,
      },
    ]

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: imageBase64 ? "gpt-4o-mini" : "gpt-4o-mini", // Vision API는 gpt-4o 또는 gpt-4o-mini 사용 가능
        messages,
        max_tokens: 300,
        temperature: 0.3,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      
      if (data && data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
        const text = data.choices[0]?.message?.content || ""
        const match = text.match(/CHARACTER_ANCHOR:\s*(.+)/i)
        
        if (match) {
          const anchor = match[1].trim()
          if (anchor.toLowerCase() === "none") {
            return null
          }
          return anchor
        }
      }
    }
  } catch (error) {
    console.warn("[Longform] 캐릭터 앵커 추출 실패:", error)
  }
  
  return null
}

export async function generateImagePrompt(
  scriptText: string,
  openaiApiKey: string,
  category: string = "health",
  historyStyle?: string,
  commonStylePrompt?: string, // 전체 대본의 공통 스타일 프롬프트
  topic?: string, // 주제 (시대적 배경 파악용)
  characterAnchor?: string, // 캐릭터 앵커 (옷, 색상, 체형, 외모 등 일관성 유지용)
  backgroundStyle?: string, // 배경 스타일 (실사화 일관성 유지용)
  renderingStyle?: string // 그림체/렌더링 스타일 (실사화 일관성 유지용)
): Promise<string> {
  if (!openaiApiKey) {
    throw new Error("OpenAI API 키가 필요합니다.")
  }

  try {
    // 인물 정보 추출 함수 (한국인/외국인/인물 없음)
    const extractCharacterInfo = async (text: string, topicText?: string): Promise<{ type: "korean" | "foreign" | "none", description: string | null }> => {
      const analysisText = topicText ? `${topicText}\n\n${text}` : text
      
      const characterPrompt = `다음 주제나 대본 텍스트를 분석하여 인물 정보를 파악해주세요:

${analysisText}

다음 형식으로만 응답하세요:
CHARACTER_TYPE: [korean | foreign | none]
CHARACTER_DESCRIPTION: [인물에 대한 상세 설명 (인물이 없으면 "none")]

인물 판단 기준:
- 한국인: 한국 역사, 한국 문화, 한국인 인물, 한국 배경 등이 명확히 언급된 경우
- 외국인: 서양인, 유럽인, 미국인 등이 명확히 언급되거나 한국이 아닌 다른 국가/문화가 언급된 경우
- 인물 없음: 인물이 등장하지 않고 풍경, 사물, 개념만 다루는 경우

예시:
- "고구려 장수" → CHARACTER_TYPE: korean, CHARACTER_DESCRIPTION: Korean historical warrior from Goguryeo period
- "로마 군인" → CHARACTER_TYPE: foreign, CHARACTER_DESCRIPTION: Roman soldier from ancient Rome
- "산 풍경" → CHARACTER_TYPE: none, CHARACTER_DESCRIPTION: none

인물 정보를 파악할 수 없으면 "CHARACTER_TYPE: none, CHARACTER_DESCRIPTION: none"로 응답하세요.`

      try {
        const characterResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You analyze text to identify character information. Respond only in the specified format.",
              },
              {
                role: "user",
                content: characterPrompt,
              },
            ],
            max_tokens: 150,
            temperature: 0.3,
          }),
        })

        if (characterResponse.ok) {
          const characterData = await characterResponse.json()
          
          // API 응답 검증
          if (characterData && characterData.choices && Array.isArray(characterData.choices) && characterData.choices.length > 0) {
            const characterText = characterData.choices[0]?.message?.content || ""
            const typeMatch = characterText.match(/CHARACTER_TYPE:\s*(korean|foreign|none)/i)
            const descMatch = characterText.match(/CHARACTER_DESCRIPTION:\s*(.+)/i)
            
            if (typeMatch) {
              const type = typeMatch[1].toLowerCase() as "korean" | "foreign" | "none"
              const description = descMatch ? descMatch[1].trim() : null
              return { type, description }
            }
          }
        }
      } catch (error) {
        console.warn("[Longform] 인물 정보 추출 실패:", error)
      }
      
      return { type: "none", description: null }
    }

    // 시대적 배경 추출 함수 (주제나 대본에서 시대 파악) - 모든 카테고리에서 필요시 수행
    const extractHistoricalPeriod = async (text: string, topicText?: string): Promise<string | null> => {
      const analysisText = topicText ? `${topicText}\n\n${text}` : text
      
      const periodPrompt = `다음 주제나 대본 텍스트를 분석하여 시대적 배경을 파악해주세요:

${analysisText}

다음 형식으로만 응답하세요:
PERIOD: [시대적 배경을 영어로 표현]

예시:
- 고려시대 → PERIOD: Goryeo Dynasty (918-1392), Korean medieval period
- 조선시대 → PERIOD: Joseon Dynasty (1392-1897), Korean Joseon era
- 삼국시대 → PERIOD: Three Kingdoms Period (57 BC-668 AD), ancient Korea
- 고구려 → PERIOD: Goguryeo Kingdom (37 BC-668 AD), ancient Korean kingdom
- 현대 → PERIOD: modern era, contemporary period
- 고대 그리스 → PERIOD: ancient Greece, classical Greek period
- 중세 유럽 → PERIOD: medieval Europe, Middle Ages
- 중국 당나라 → PERIOD: Tang Dynasty (618-907), ancient China

중요:
- 한국 역사인 경우 반드시 "Korean"을 포함하여 명확히 구분하세요 (예: "Korean Goryeo Dynasty", "Korean Joseon era")
- 중국이나 다른 국가의 역사인 경우도 명확히 구분하세요 (예: "Chinese Tang Dynasty", "Roman Empire")
- 시대를 파악할 수 없으면 "PERIOD: unspecified period"로 응답하세요.`

      try {
        const periodResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You analyze text to identify historical periods. Respond only in the specified format. Always distinguish between Korean and other countries' history clearly.",
              },
              {
                role: "user",
                content: periodPrompt,
              },
            ],
            max_tokens: 150,
            temperature: 0.3,
          }),
        })

        if (periodResponse.ok) {
          const periodData = await periodResponse.json()
          
          // API 응답 검증
          if (periodData && periodData.choices && Array.isArray(periodData.choices) && periodData.choices.length > 0) {
            const periodText = periodData.choices[0]?.message?.content || ""
            const periodMatch = periodText.match(/PERIOD:\s*(.+)/i)
            
            if (periodMatch) {
              const period = periodMatch[1].trim()
              // "unspecified period"는 null로 반환
              if (period.toLowerCase().includes("unspecified")) {
                return null
              }
              return period
            }
          }
        }
      } catch (error) {
        console.warn("[Longform] 시대적 배경 추출 실패:", error)
      }
      
      return null
    }

    // 1단계: 인물 정보 추출
    const characterInfo = await extractCharacterInfo(scriptText, topic)
    
    // 2단계: 시대적 배경 추출
    const historicalPeriod = await extractHistoricalPeriod(scriptText, topic)

    // 실사화 스타일 여부 확인 (함수 전체에서 사용)
    const isRealistic = historyStyle === "realistic" || historyStyle === "realistic2"

    // 카테고리별 프롬프트 가이드
    const categoryGuides: Record<string, string> = {
      health: "건강, 웰빙, 생활 꿀팁과 관련된 이미지. 밝고 깔끔한 스타일, 전문적이고 신뢰감 있는 느낌.",
      history: historyStyle 
        ? `역사적 이미지, ${historyStyle} 스타일. 역사적 사실과 배경을 정확하게 반영.${historicalPeriod ? ` 시대적 배경: ${historicalPeriod}` : ""}`
        : `역사적 이미지. 역사적 사실과 배경을 정확하게 반영. 고전적이고 장엄한 스타일.${historicalPeriod ? ` 시대적 배경: ${historicalPeriod}` : ""}`,
      wisdom: "명언, 지혜, 철학과 관련된 이미지. 고요하고 깊이 있는 느낌, 영감을 주는 분위기.",
      self_improvement: "자기계발, 성장과 관련된 이미지. 동기부여되고 긍정적인 에너지.",
      society: "사회 트렌드, 최신 이슈와 관련된 이미지. 현대적이고 트렌디한 스타일.",
      space: "우주, 천문학과 관련된 이미지. 신비롭고 장엄한 우주의 느낌.",
      fortune: "사주, 운세와 관련된 이미지. 신비롭고 미스터리한 분위기.",
    }

    const categoryGuide = categoryGuides[category] || categoryGuides.health

    // 인물 정보에 따른 프롬프트 가이드 생성
    let characterGuidance = ""
    if (characterInfo.type === "korean") {
      characterGuidance = `⚠️ 매우 중요: 모든 인물은 반드시 한국인(Korean)으로 묘사되어야 합니다. 프롬프트에 'Korean', 'Korean person', 'Korean character', 'Korean features', 'Asian features', 'Korean ethnicity' 등을 반드시 포함하세요. 중국인, 일본인, 또는 다른 아시아인으로 오해될 수 있는 표현은 절대 사용하지 마세요.`
    } else if (characterInfo.type === "foreign") {
      characterGuidance = `⚠️ 매우 중요: 모든 인물은 외국인(Western/Caucasian)으로 묘사되어야 합니다. 프롬프트에 'Western', 'Caucasian', 'European', 'American' 등을 반드시 포함하세요.`
    } else {
      characterGuidance = "- 인물이 포함되지 않는 풍경, 사물, 개념 중심"
    }

    // 캐릭터 앵커가 있으면 일관성 유지 가이드 추가
    let characterConsistencyGuidance = ""
    if (characterAnchor) {
      // 실사화 스타일일 때 더 강력한 일관성 지시
      characterConsistencyGuidance = `\n⚠️ 매우 중요 - 캐릭터 일관성 유지${isRealistic ? " (실사화 스타일 - 절대 필수)" : ""}:
이전 이미지에서 추출된 캐릭터 정보를 정확히 유지해야 합니다:
${characterAnchor}

다음 요소들을 반드시 동일하게 유지하세요:
- 옷의 색상, 스타일, 디자인, 패턴, 소재
- 체형, 키, 체격, 어깨 폭, 팔/다리 길이
- 얼굴 특징: 얼굴형, 눈 모양과 색상, 코 모양, 입 모양, 턱선, 이마, 눈썹
- 헤어스타일: 머리 길이, 스타일, 색상, 가르마 위치
- 피부색과 톤
- 액세서리, 무기, 소지품
- 전체적인 외모와 특징
${isRealistic ? "- 실사화 스타일이므로 얼굴, 체형, 옷 등 모든 세부사항이 정확히 동일해야 합니다\n- 다른 사람이나 다른 얼굴이 생성되면 안 됩니다\n- 얼굴 특징, 체형, 옷의 모든 세부사항을 정확히 동일하게 유지하세요" : ""}

이 캐릭터 정보를 프롬프트의 맨 앞부분에 반드시 포함하고, 동일한 캐릭터가 계속 등장하도록 하세요.${isRealistic ? " 실사화 스타일에서는 캐릭터 일관성이 가장 중요합니다." : ""}`
    }

    // 배경 스타일과 그림체 일관성 가이드 추가 (실사화 스타일)
    let backgroundRenderingGuidance = ""
    if (isRealistic && (backgroundStyle || renderingStyle)) {
      backgroundRenderingGuidance = `\n⚠️ 매우 중요 - 배경 스타일 및 그림체 일관성 유지 (실사화 스타일 - 절대 필수):
이전 이미지에서 추출된 배경 스타일과 그림체 정보를 정확히 유지해야 합니다:
${backgroundStyle ? `배경 스타일: ${backgroundStyle}` : ""}
${renderingStyle ? `그림체/렌더링 스타일: ${renderingStyle}` : ""}

다음 요소들을 반드시 동일하게 유지하세요:
${backgroundStyle ? "- 배경의 색상 팔레트, 조명 스타일, 분위기, 텍스처, 깊이감을 정확히 동일하게 유지\n" : ""}
${renderingStyle ? "- 렌더링 기법, 색감 처리, 선명도, 그림자 스타일, 질감 표현을 정확히 동일하게 유지\n" : ""}
- 모든 이미지가 동일한 시각적 스타일과 분위기를 가져야 합니다
- 배경과 그림체가 각기 다르게 생성되면 안 됩니다
- 첫 번째 이미지와 정확히 동일한 배경 스타일과 그림체를 유지하세요

이 배경 스타일과 그림체 정보를 프롬프트에 반드시 포함하고, 모든 이미지에서 일관되게 적용하세요.`
    }

    const systemPrompt = `당신은 이미지 생성 프롬프트 전문가입니다. 주어진 텍스트를 바탕으로 고품질 이미지를 생성할 수 있는 영어 프롬프트를 작성해주세요.

요구사항:
- 영어로만 작성
- 구체적이고 시각적으로 묘사
- 고품질, 전문적, 아름다운 이미지
- ${categoryGuide}
${historicalPeriod ? `- 시대적 배경: ${historicalPeriod} (이 시대적 배경을 프롬프트에 반드시 포함하고, 해당 시대의 건축, 의상, 무기, 생활 양식 등을 정확하게 반영하세요. 한국 역사인 경우 "Korean"을 명확히 포함하여 중국이나 다른 국가와 구분하세요)` : ""}
${commonStylePrompt ? `- 전체 대본의 공통 스타일: ${commonStylePrompt} (이 스타일을 반드시 유지하세요)` : ""}
${characterGuidance}${characterConsistencyGuidance}${backgroundRenderingGuidance}
- 16:9 비율에 최적화된 시네마틱한 구도
- 텍스트, 글씨, 영어, 한글, 숫자, 로고, 워터마크 등 모든 텍스트 요소 절대 금지
- 배경에 영어나 다른 언어 텍스트가 보이지 않도록 주의
${historyStyle === "realistic" || historyStyle === "realistic2" ? "- ⚠️ 실사화 스타일: 자막, 캡션, 텍스트 오버레이, 배경 텍스트 등 모든 텍스트 요소가 절대적으로 금지됩니다. 순수한 시각적 이미지만 생성하세요." : ""}
${commonStylePrompt ? "- 모든 이미지가 동일한 스타일, 색감, 분위기를 유지하도록 작성하세요" : ""}
${characterAnchor ? "- 캐릭터의 옷, 색상, 체형, 외모를 이전 이미지와 정확히 동일하게 유지하세요" : ""}

프롬프트 형식:
- 명사와 형용사를 사용한 구체적 묘사
- 스타일과 분위기 명시
- 색상과 조명 묘사
- 카메라 각도와 구도
${historicalPeriod ? `- 시대적 배경 요소를 포함: ${historicalPeriod} 시대의 건축, 의상, 무기, 생활 양식 등` : ""}
${characterInfo.type !== "none" && characterInfo.description ? `- 인물 묘사: ${characterInfo.description}` : ""}
${commonStylePrompt ? `- 공통 스타일 요소를 포함: ${commonStylePrompt}` : ""}
- NEGATIVE 프롬프트에 반드시 포함: text, letters, words, typography, English text, Korean text, Chinese text, numbers, logos, watermarks, signs, labels`

    const userPrompt = `다음 텍스트를 바탕으로 이미지 생성용 영어 프롬프트를 작성해주세요:

텍스트: ${scriptText}

카테고리: ${category}
${historyStyle ? `이미지 스타일: ${getImageStyleName(historyStyle)}` : ""}
${historicalPeriod ? `시대적 배경: ${historicalPeriod} (이 시대적 배경을 프롬프트에 반드시 포함하세요. 한국 역사인 경우 "Korean"을 명확히 포함하여 중국이나 다른 국가와 구분하세요)` : ""}
${characterInfo.type !== "none" ? `인물 정보: ${characterInfo.type === "korean" ? "한국인 (Korean person, Korean character, Korean features 필수 포함)" : "외국인 (Western/Caucasian person 필수 포함)"}` : "인물 없음 (풍경, 사물, 개념 중심)"}
${characterInfo.description && characterInfo.type !== "none" ? `인물 상세: ${characterInfo.description}` : ""}
${characterAnchor ? `\n⚠️ 매우 중요 - 캐릭터 일관성${historyStyle === "realistic" || historyStyle === "realistic2" ? " (실사화 스타일 - 절대 필수)" : ""}: 이전 이미지에서 추출된 캐릭터 정보를 정확히 유지하세요:\n${characterAnchor}\n이 캐릭터 정보를 프롬프트의 맨 앞부분에 반드시 포함하고, 옷, 색상, 체형, 외모, 얼굴 특징, 헤어스타일 등 모든 세부사항을 정확히 동일하게 유지하세요.${historyStyle === "realistic" || historyStyle === "realistic2" ? " 실사화 스타일에서는 다른 사람이나 다른 얼굴이 생성되면 안 됩니다. 정확히 동일한 캐릭터여야 합니다." : ""}` : ""}
${backgroundStyle || renderingStyle ? `\n⚠️ 매우 중요 - 배경 스타일 및 그림체 일관성${historyStyle === "realistic" || historyStyle === "realistic2" ? " (실사화 스타일 - 절대 필수)" : ""}: 이전 이미지에서 추출된 배경 스타일과 그림체 정보를 정확히 유지하세요:\n${backgroundStyle ? `배경 스타일: ${backgroundStyle}\n` : ""}${renderingStyle ? `그림체/렌더링 스타일: ${renderingStyle}\n` : ""}이 배경 스타일과 그림체 정보를 프롬프트에 반드시 포함하고, 모든 이미지에서 정확히 동일한 배경 스타일과 그림체를 유지하세요. 배경과 그림체가 각기 다르게 생성되면 안 됩니다.` : ""}
${commonStylePrompt ? `\n중요: 전체 대본의 공통 스타일을 유지하세요: ${commonStylePrompt}` : ""}

위 텍스트의 핵심 내용을 시각적으로 표현할 수 있는 영어 프롬프트를 작성해주세요.
${historicalPeriod ? `프롬프트에 "${historicalPeriod}" 시대적 배경을 반드시 포함하세요.` : ""}
${characterInfo.type === "korean" ? "프롬프트에 'Korean', 'Korean person', 'Korean character', 'Korean features', 'Asian features' 등을 반드시 포함하여 한국인임을 명확히 하세요. 중국인이나 다른 아시아인으로 오해될 수 있는 표현은 절대 사용하지 마세요." : ""}
${characterInfo.type === "foreign" ? "프롬프트에 'Western', 'Caucasian', 'European', 'American' 등을 반드시 포함하여 외국인임을 명확히 하세요." : ""}
프롬프트에 NEGATIVE로 "text, letters, words, typography, English text, Korean text, Chinese text, numbers, logos, watermarks, signs, labels${historyStyle === "realistic" || historyStyle === "realistic2" ? ", subtitles, captions, text overlay, floating text, text in background, written text, text elements, lettering, inscription, calligraphy, text box, text area, text banner, text label, text sign, text poster, text display, text graphics, text design, text illustration, any form of text" : ""}"를 반드시 포함하여 텍스트가 보이지 않도록 하세요.
${historyStyle === "realistic" || historyStyle === "realistic2" ? "\n⚠️ 실사화 스타일 특별 지시: 이미지에 자막, 캡션, 텍스트 오버레이, 배경 텍스트 등 어떤 형태의 텍스트도 절대 포함하지 마세요. 순수한 시각적 이미지만 생성하세요." : ""}
프롬프트만 작성하고 설명은 추가하지 마세요.`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
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
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    // API 응답 검증
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error("[Longform] API 응답 오류:", data)
      throw new Error("프롬프트 생성에 실패했습니다: API 응답 형식이 올바르지 않습니다.")
    }
    
    let prompt = data.choices[0]?.message?.content

    if (!prompt || typeof prompt !== 'string') {
      console.error("[Longform] 프롬프트 없음:", data.choices[0])
      throw new Error("프롬프트 생성에 실패했습니다: 응답 내용이 없습니다.")
    }

    // 프롬프트 정리 (불필요한 설명 제거)
    let cleanPrompt = prompt
      .trim()
      .replace(/^프롬프트[:\s]*/i, "")
      .replace(/^Prompt[:\s]*/i, "")
      .replace(/^Here is.*?:/i, "")
      .replace(/^Here's.*?:/i, "")
      .replace(/^The prompt.*?:/i, "")
      .trim()

    // NEGATIVE 프롬프트 강화 (텍스트 제거)
    const negativeKeywords = [
      "text", "letters", "words", "typography", 
      "English text", "Korean text", "Chinese text", 
      "numbers", "logos", "watermarks", "signs", "labels",
      "written text", "text overlay", "caption", "subtitle"
    ]
    
    // 기존 NEGATIVE 프롬프트 확인
    const hasNegative = /NEGATIVE|negative/i.test(cleanPrompt)
    
    if (!hasNegative) {
      // NEGATIVE 프롬프트가 없으면 추가
      cleanPrompt = `${cleanPrompt}, NEGATIVE: ${negativeKeywords.join(", ")}`
    } else {
      // 기존 NEGATIVE 프롬프트에 텍스트 관련 키워드 추가
      const negativeMatch = cleanPrompt.match(/(NEGATIVE|negative):\s*([^,]+(?:,\s*[^,]+)*)/i)
      if (negativeMatch) {
        const existingNegative = negativeMatch[2]
        const additionalKeywords = negativeKeywords.filter(kw => 
          !existingNegative.toLowerCase().includes(kw.toLowerCase())
        )
        if (additionalKeywords.length > 0) {
          cleanPrompt = cleanPrompt.replace(
            /(NEGATIVE|negative):\s*([^,]+(?:,\s*[^,]+)*)/i,
            `$1: $2, ${additionalKeywords.join(", ")}`
          )
        }
      } else {
        // NEGATIVE가 있지만 형식이 다르면 끝에 추가
        cleanPrompt = `${cleanPrompt}, ${negativeKeywords.join(", ")}`
      }
    }
    
    // 캐릭터 앵커가 있으면 프롬프트에 추가 (일관성 유지)
    if (characterAnchor) {
      // 실사화 스타일일 때는 더 강력하게 적용
      // 애니메이션 스타일(유럽풍 그래픽 노블 포함)에서도 강력하게 적용
      const isAnimation = historyStyle === "stickman-animation" || historyStyle === "animation2" || historyStyle === "animation3" || historyStyle === "semi-realistic-animation"
      
      // 캐릭터 앵커가 프롬프트에 포함되어 있는지 확인
      const promptLower = cleanPrompt.toLowerCase()
      const anchorKeywords = characterAnchor.toLowerCase().split(/\s+/).slice(0, 5) // 처음 5개 키워드만 확인
      const hasAnchorKeywords = anchorKeywords.some(kw => kw.length > 3 && promptLower.includes(kw))
      
      if (!hasAnchorKeywords || isRealistic || isAnimation) {
        // 실사화 스타일, 애니메이션 스타일이거나 포함되지 않은 경우 프롬프트 맨 앞에 강조해서 추가
        if (isRealistic) {
          // 실사화 스타일: "THE SAME CHARACTER: [캐릭터 앵커]" 형식으로 강조
          cleanPrompt = `THE SAME CHARACTER (MUST BE IDENTICAL): ${characterAnchor}, ${cleanPrompt}`
        } else if (isAnimation) {
          // 애니메이션 스타일(유럽풍 그래픽 노블 포함): 캐릭터 일관성 강조
          cleanPrompt = `THE SAME CHARACTER (CONSISTENT DESIGN): ${characterAnchor}, ${cleanPrompt}`
        } else {
          // 일반 스타일: 캐릭터 앵커를 앞부분에 추가
          cleanPrompt = `${characterAnchor}, ${cleanPrompt}`
        }
      } else {
        // 이미 포함되어 있으면 NEGATIVE 부분 앞에 추가
        const negativeIndex = cleanPrompt.search(/NEGATIVE|negative/i)
        if (negativeIndex > 0) {
          cleanPrompt = cleanPrompt.slice(0, negativeIndex) + `, ${characterAnchor}` + cleanPrompt.slice(negativeIndex)
        } else {
          cleanPrompt = `${cleanPrompt}, ${characterAnchor}`
        }
      }
    }

    // 배경 스타일과 그림체 정보 추가 (실사화 스타일 및 애니메이션 스타일)
    const isAnimation = historyStyle === "stickman-animation" || historyStyle === "animation2" || historyStyle === "animation3" || historyStyle === "semi-realistic-animation"
    
    if (isRealistic && (backgroundStyle || renderingStyle)) {
      let styleInfo = ""
      if (backgroundStyle && renderingStyle) {
        styleInfo = `THE SAME BACKGROUND STYLE AND RENDERING STYLE (MUST BE IDENTICAL): Background: ${backgroundStyle}, Rendering: ${renderingStyle}`
      } else if (backgroundStyle) {
        styleInfo = `THE SAME BACKGROUND STYLE (MUST BE IDENTICAL): ${backgroundStyle}`
      } else if (renderingStyle) {
        styleInfo = `THE SAME RENDERING STYLE (MUST BE IDENTICAL): ${renderingStyle}`
      }
      
      if (styleInfo) {
        // 프롬프트 앞부분에 배경 스타일과 그림체 정보 추가
        cleanPrompt = `${styleInfo}, ${cleanPrompt}`
      }
    } else if (isAnimation && renderingStyle) {
      // 애니메이션 스타일(유럽풍 그래픽 노블 포함)에서도 그림체 일관성 유지
      // 스틱맨 애니메이션의 경우 더 강력하게 적용
      if (historyStyle === "stickman-animation") {
        const styleInfo = `THE SAME ART STYLE (MUST BE IDENTICAL): ${renderingStyle}`
        cleanPrompt = `${styleInfo}, ${cleanPrompt}`
      } else {
        const styleInfo = `THE SAME ART STYLE (CONSISTENT RENDERING): ${renderingStyle}`
        cleanPrompt = `${styleInfo}, ${cleanPrompt}`
      }
    }

    // 한국인 인물인 경우 키워드 강화
    if (characterInfo.type === "korean") {
      const promptLower = cleanPrompt.toLowerCase()
      const koreanKeywords = ["korean", "korean person", "korean character", "korean features", "asian features"]
      const hasKoreanKeyword = koreanKeywords.some(kw => promptLower.includes(kw))
      
      if (!hasKoreanKeyword) {
        // 한국인 키워드가 없으면 추가
        cleanPrompt = `${cleanPrompt}, Korean person, Korean character, Korean features, Asian features`
      }
      
      // 중국인 관련 키워드 제거 (오해 방지)
      cleanPrompt = cleanPrompt
        .replace(/\bChinese\b/gi, "Korean")
        .replace(/\bJapan\w*\b/gi, "")
        .replace(/\bJapanese\b/gi, "")
    }
    
    // 외국인 인물인 경우 키워드 강화
    if (characterInfo.type === "foreign") {
      const promptLower = cleanPrompt.toLowerCase()
      const foreignKeywords = ["western", "caucasian", "european", "american"]
      const hasForeignKeyword = foreignKeywords.some(kw => promptLower.includes(kw))
      
      if (!hasForeignKeyword) {
        // 외국인 키워드가 없으면 추가
        cleanPrompt = `${cleanPrompt}, Western person, Caucasian features`
      }
    }
    
    cleanPrompt = cleanPrompt.trim()

    // 특정 스타일인 경우 특별한 프롬프트 템플릿 적용 (모든 카테고리)
    // 기존 animation 스타일은 호환성을 위해 유지
    if (historyStyle === "animation" || historyStyle === "stickman-animation" || historyStyle === "animation2" || historyStyle === "animation3" || historyStyle === "flat-2d-illustration" || historyStyle === "semi-realistic-animation" || historyStyle === "vintage-illustration" || historyStyle === "dark-fantasy-concept") {
      // 대본 텍스트에서 주체, 배경, 행동 추출
      // 간단한 추출: 주체는 명사, 배경은 장소/환경, 행동은 동사
      const extractElements = async (text: string) => {
        const extractionPrompt = `다음 텍스트에서 이미지 생성에 필요한 요소를 추출해주세요:
        
텍스트: ${text}
카테고리: ${category}
${historicalPeriod ? `시대적 배경: ${historicalPeriod} (한국 역사인 경우 "Korean"을 명확히 포함)` : ""}
${characterInfo.type !== "none" ? `인물 정보: ${characterInfo.type === "korean" ? "한국인 (Korean person, Korean character, Korean features 필수)" : "외국인 (Western/Caucasian person 필수)"}` : "인물 없음"}

다음 형식으로만 응답하세요 (한 줄씩):
SUBJECT: [주체/인물/대상 - ${characterInfo.type === "korean" ? "Korean person, Korean character" : characterInfo.type === "foreign" ? "Western/Caucasian person" : "main subject"}]
SETTING: [배경/장소/환경 - ${historicalPeriod ? historicalPeriod + " 시대의" : ""} ${category} 카테고리에 맞는 배경]
ACTION: [행동/동작/상황]

중요:
${characterInfo.type === "korean" ? "- SUBJECT에 반드시 'Korean person', 'Korean character', 'Korean features' 등을 포함하세요. 중국인이나 다른 아시아인으로 오해될 수 있는 표현은 절대 사용하지 마세요." : ""}
${characterInfo.type === "foreign" ? "- SUBJECT에 반드시 'Western person', 'Caucasian person' 등을 포함하세요." : ""}
${historicalPeriod ? `- SETTING에 "${historicalPeriod}" 시대적 배경을 반드시 포함하세요. 한국 역사인 경우 "Korean"을 명확히 포함하여 중국이나 다른 국가와 구분하세요.` : ""}

예시:
SUBJECT: ${characterInfo.type === "korean" ? "Korean warrior, Korean person, Korean character, Korean features" : characterInfo.type === "foreign" ? "Western soldier, Caucasian person" : category === "health" ? "healthy person" : category === "wisdom" ? "wise figure" : "main character"}
SETTING: ${historicalPeriod ? `${historicalPeriod} ` : ""}${category === "health" ? "wellness environment" : category === "wisdom" ? "philosophical setting" : "relevant setting"}
ACTION: ${category === "health" ? "practicing wellness" : category === "wisdom" ? "contemplating" : "in action"}`

        try {
          const extractionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: "You extract key elements from text for image generation. Respond only in the specified format.",
                },
                {
                  role: "user",
                  content: extractionPrompt,
                },
              ],
              max_tokens: 100,
              temperature: 0.3,
            }),
          })

          if (extractionResponse.ok) {
            const extractionData = await extractionResponse.json()
            
            // API 응답 검증
            if (extractionData && extractionData.choices && Array.isArray(extractionData.choices) && extractionData.choices.length > 0) {
              const extractionText = extractionData.choices[0]?.message?.content || ""
              
              const subjectMatch = extractionText.match(/SUBJECT:\s*(.+)/i)
              const settingMatch = extractionText.match(/SETTING:\s*(.+)/i)
              const actionMatch = extractionText.match(/ACTION:\s*(.+)/i)
              
              return {
                subject: subjectMatch ? subjectMatch[1].trim() : "historical figure",
                setting: settingMatch ? settingMatch[1].trim() : "ancient battlefield",
                action: actionMatch ? actionMatch[1].trim() : "in dramatic pose",
              }
            }
          }
        } catch (error) {
          console.warn("[Longform] 요소 추출 실패, 기본값 사용:", error)
        }
        
        // 기본값
        return {
          subject: "historical figure",
          setting: "ancient battlefield",
          action: "in dramatic pose",
        }
      }

      const elements = await extractElements(scriptText)
      
      // 스타일별 프롬프트 템플릿 적용
      const periodContext = historicalPeriod ? `, ${historicalPeriod} historical setting` : ""
      const categoryContext = category !== "history" ? `, ${category} theme` : ""
      const characterContext = characterInfo.type === "korean" 
        ? ", Korean person, Korean character, Korean features, Asian features" 
        : characterInfo.type === "foreign" 
        ? ", Western person, Caucasian features" 
        : ""
      
      let stylePrompt = ""
      
      switch (historyStyle) {
        case "stickman-animation":
          // 간결한 스틱맨 프롬프트 구조 (제공된 구조 사용)
          const stickmanBase = (
            "a vibrant 2D cartoon, fully rendered illustration featuring a stickman with a white circular face, " +
            "simple black outline, dot eyes, curved mouth, thin black limbs, expressive pose"
          )
          const stickmanStylePhrase = (
            "Consistent stick-figure illustration style, clean bold lines, solid colors, explainer video aesthetic, simplified background"
          )
          const stickmanExtra = "colorful detailed drawing, rich environment, dynamic lighting, no realistic human anatomy, no blank background"
          
          // 필수 요구사항: 팔 두 개, 전체 몸 표시
          const stickmanMandatoryRequirements = (
            "MANDATORY REQUIREMENTS: The stickman character MUST have exactly two arms visible, both arms must be clearly shown. " +
            "The stickman character MUST show the full body including both head and torso, not just torso alone. " +
            "Full body visible: head, torso, and limbs all must be visible in the image. " +
            "No partial body, no torso-only, no head-only. Complete stickman figure required."
          )
          
          stylePrompt = `A stickman character ${elements.action} in ${elements.setting}${periodContext}${categoryContext}. ${stickmanBase}, ${stickmanStylePhrase}, ${stickmanExtra}, ${stickmanMandatoryRequirements}. No text, no captions, no speech bubbles, no logos, no watermark.${characterInfo.type === "korean" ? " Character must be Korean person with Korean features. Do not confuse with Chinese or Japanese." : characterInfo.type === "foreign" ? " Character must be Western/Caucasian person." : ""}`
          break
          
        case "flat-2d-illustration":
        case "animation2":
          // 애니메이션2 프롬프트 구조 (제공된 구조 사용)
          // 주의: animation2는 스틱맨이 아닌 일반 카툰 캐릭터를 사용
          const animation2BaseStyle = (
            "Flat 2D vector illustration, minimal vector art, stylized cartoon character with simple circular head, " +
            "minimalist black dot eyes, thick bold black outlines, unshaded, flat solid colors, cel-shaded, " +
            "simple line art, comic book inking style, completely flat, no shadows, no gradients, no depth."
          )
          const animation2CharacterDetails = (
            "The character is in an expressive, dynamic pose appropriate for the scene. " +
            "The character can be wearing stylized cartoon clothing, costumes, or accessories that fit the theme of the environment. " +
            "Any clothing must match the simple, bold-line cartoon aesthetic, avoiding overly complex or realistic textures."
          )
          const animation2EnvironmentLighting = (
            "The background is a rich, detailed, and colorful stylized cartoon environment " +
            "(e.g., a bustling futuristic market, a pirate ship deck, a magical forest) filled with relevant objects. " +
            "The entire frame is filled, with NO blank or simple background regions. " +
            "The scene features dynamic, dramatic lighting with strong highlights and shadows that enhance the 2D cartoon feel."
          )
          const animation2Constraints = (
            "Base Character Consistency: The underlying character form (head shape, eyes, body type) must match the reference style. " +
            "No Realistic Anatomy: Do not add realistic human features, muscles, or photorealistic clothing textures. " +
            "Stick to the simple cartoon style."
          )
          
          stylePrompt = `A ${elements.subject}${characterContext} ${elements.action} in ${elements.setting}${periodContext}${categoryContext}. ${animation2BaseStyle}, ${animation2CharacterDetails}, ${animation2EnvironmentLighting}, ${animation2Constraints}. No text, no letters, no words, no writing, no labels, no signs, no watermark${characterInfo.type === "korean" ? ", Chinese person, Japanese person, wrong ethnicity" : ""}.`
          break
          
        case "animation3":
          // 유럽풍 그래픽 노블 스타일
          stylePrompt = `A ${elements.subject}${characterContext} in a ${elements.setting}${periodContext}${categoryContext}, ${elements.action}. European graphic novel style, Franco-Belgian comics aesthetic, ligne claire (clear line) art style, Tintin-inspired illustration, Hergé-style drawing, bold black outlines, flat colors with minimal shading, clean geometric shapes, precise line work, consistent character design, uniform art style throughout, cinematic panel composition, 16:9 aspect ratio. NEGATIVE: 3D rendering, realistic textures, excessive shading, gradients, photorealistic, detailed rendering, stickman, stick figure, anime style, manga style, text, letters, words, typography, English text, Korean text, Chinese text, numbers, logos, watermarks, signs, labels${characterInfo.type === "korean" ? ", Chinese person, Japanese person, wrong ethnicity" : ""}.`
          break
          
        case "semi-realistic-animation":
          stylePrompt = `A ${elements.subject}${characterContext} in a ${elements.setting}${periodContext}${categoryContext}, ${elements.action}. semi-realistic animation style, 2D animation with 3D depth, stylized realism, smooth shading, vibrant colors, cinematic lighting, dynamic composition, high-quality animation art, 16:9 aspect ratio. NEGATIVE: photorealistic, documentary photo, flat illustration, stickman, overly realistic textures, text, letters, words, typography, English text, Korean text, Chinese text, numbers, logos, watermarks, signs, labels${characterInfo.type === "korean" ? ", Chinese person, Japanese person, wrong ethnicity" : ""}.`
          break
          
        case "vintage-illustration":
          stylePrompt = `A ${elements.subject}${characterContext} in a ${elements.setting}${periodContext}${categoryContext}, ${elements.action}. vintage illustration style, retro aesthetic, classic illustration, aged paper texture, muted color palette, nostalgic feel, traditional illustration techniques, 16:9 aspect ratio. NEGATIVE: modern digital art, bright colors, contemporary style, 3D render, photorealistic, text, letters, words, typography, English text, Korean text, Chinese text, numbers, logos, watermarks, signs, labels${characterInfo.type === "korean" ? ", Chinese person, Japanese person, wrong ethnicity" : ""}.`
          break
          
        case "dark-fantasy-concept":
          stylePrompt = `A ${elements.subject}${characterContext} in a ${elements.setting}${periodContext}${categoryContext}, ${elements.action}. dark fantasy concept art style, cinematic fantasy art, high-detail painterly rendering, movie-poster quality lighting with strong contrast, dramatic rim light and sharp highlights, realistic metal/leather/fabric texture rendering, warm brown + muted gray color grading, epic mood, atmospheric fog/haze/dust, floating embers/particles, shallow depth of field, atmospheric perspective, dynamic cinematic composition, high-end concept art for film/AAA game${periodContext ? `, ${historicalPeriod} period accurate details` : ""}, 16:9, high resolution. NEGATIVE: different face, different person, altered identity, face morph, wrong ethnicity, age change, weight change, asymmetrical eyes, deformed hands, extra fingers, missing fingers, bad anatomy, duplicated limbs, distorted weapon, blurry main subject, low detail, flat lighting, low contrast, oversaturated, cartoon, anime, flat illustration, vector art, line art, cel shading, 3D render, plastic skin, photoreal snapshot, documentary photo, watermark, logo, text, letters, words, typography, English text, Korean text, Chinese text, numbers, signs, labels${characterInfo.type === "korean" ? ", Chinese person, Japanese person" : ""}.`
          break
          
        case "animation":
        default:
          // 기존 애니메이션 스타일 (호환성)
          stylePrompt = `A ${elements.subject}${characterContext} in a ${elements.setting}${periodContext}${categoryContext}, ${elements.action}. cinematic fantasy concept art style, semi-realistic digital painting, high-detail painterly rendering, movie-poster quality lighting with strong contrast, dramatic rim light and sharp highlights, realistic metal/leather/fabric texture rendering, warm brown + muted gray color grading, epic battlefield mood, atmospheric fog/haze/dust, floating embers/particles, shallow depth of field, atmospheric perspective, background soldiers/flags softly blurred, main subject razor sharp, dynamic cinematic composition, high-end concept art for film/AAA game${periodContext ? `, ${historicalPeriod} period accurate details` : ""}, 16:9, high resolution. NEGATIVE: different face, different person, altered identity, face morph, wrong ethnicity, age change, weight change, asymmetrical eyes, deformed hands, extra fingers, missing fingers, bad anatomy, duplicated limbs, distorted weapon, blurry main subject, low detail, flat lighting, low contrast, oversaturated, cartoon, anime, flat illustration, vector art, line art, cel shading, 3D render, plastic skin, photoreal snapshot, documentary photo, watermark, logo, text, letters, words, typography, English text, Korean text, Chinese text, numbers, signs, labels${characterInfo.type === "korean" ? ", Chinese person, Japanese person" : ""}.`
          break
      }

      cleanPrompt = stylePrompt
    }

    return cleanPrompt
  } catch (error) {
    console.error("[Longform] 이미지 프롬프트 생성 실패:", error)
    throw error
  }
}

/**
 * 전체 대본의 공통 스타일 프롬프트 생성 함수
 * 주제와 카테고리를 바탕으로 모든 이미지에 일관되게 적용될 스타일을 생성합니다.
 */
export async function generateCommonStylePrompt(
  topic: string,
  category: string,
  openaiApiKey: string,
  historyStyle?: string
): Promise<string> {
  if (!openaiApiKey) {
    throw new Error("OpenAI API 키가 필요합니다.")
  }

  try {
    const categoryGuides: Record<string, string> = {
      health: "건강, 웰빙, 생활 꿀팁",
      history: historyStyle 
        ? `역사적 이미지, ${historyStyle} 스타일`
        : "역사적 이미지, 고전적이고 장엄한 스타일",
      wisdom: "명언, 지혜, 철학",
      self_improvement: "자기계발, 성장",
      society: "사회 트렌드, 최신 이슈",
      space: "우주, 천문학",
      fortune: "사주, 운세",
    }

    const categoryGuide = categoryGuides[category] || categoryGuides.health

    const systemPrompt = `당신은 이미지 스타일 전문가입니다. 주어진 주제와 카테고리를 바탕으로 모든 이미지에 일관되게 적용될 공통 스타일 프롬프트를 작성해주세요.

요구사항:
- 영어로만 작성
- 색감, 조명, 분위기, 스타일을 구체적으로 명시
- 모든 이미지가 동일한 느낌을 갖도록 통일된 스타일 제시
- 16:9 비율에 최적화된 시네마틱한 구도
- 카테고리: ${categoryGuide}

출력 형식:
- 색상 팔레트 (예: warm tones, cool blues, earthy colors)
- 조명 스타일 (예: soft natural light, dramatic lighting, golden hour)
- 분위기 (예: serene, energetic, mysterious)
- 시각적 스타일 (예: cinematic, documentary, artistic)
- 카메라 스타일 (예: wide angle, close-up, aerial view)`

    const userPrompt = `주제: ${topic}
카테고리: ${category}
${historyStyle ? `역사 스타일: ${historyStyle}` : ""}

위 주제와 카테고리를 바탕으로 모든 이미지에 일관되게 적용될 공통 스타일 프롬프트를 작성해주세요. 
예: "cinematic composition, warm color palette with golden hour lighting, serene atmosphere, soft natural light, documentary style, 16:9 aspect ratio"

프롬프트만 작성하고 설명은 추가하지 마세요.`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
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
        max_tokens: 200,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const stylePrompt = data.choices?.[0]?.message?.content?.trim()

    if (!stylePrompt) {
      throw new Error("공통 스타일 프롬프트 생성에 실패했습니다.")
    }

    // 프롬프트 정리
    const cleanStylePrompt = stylePrompt
      .trim()
      .replace(/^스타일[:\s]*/i, "")
      .replace(/^Style[:\s]*/i, "")
      .replace(/^Here is.*?:/i, "")
      .trim()

    return cleanStylePrompt
  } catch (error) {
    console.error("[Longform] 공통 스타일 프롬프트 생성 실패:", error)
    throw error
  }
}

/**
 * 커스텀 프롬프트를 영어로 변환하는 함수
 * 
 * @param customPrompt - 한글 커스텀 프롬프트
 * @param openaiApiKey - OpenAI API 키
 * @returns 영어 프롬프트
 */
export async function generateCustomPrompt(
  customPrompt: string,
  openaiApiKey: string
): Promise<string> {
  if (!openaiApiKey) {
    throw new Error("OpenAI API 키가 필요합니다.")
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "당신은 이미지 생성 프롬프트 번역 전문가입니다. 주어진 한글 설명을 이미지 생성에 적합한 영어 프롬프트로 변환해주세요. 프롬프트만 작성하고 설명은 추가하지 마세요.",
          },
          {
            role: "user",
            content: `다음 한글 설명을 이미지 생성용 영어 프롬프트로 변환해주세요:\n\n${customPrompt}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const prompt = data.choices?.[0]?.message?.content

    if (!prompt) {
      throw new Error("프롬프트 변환에 실패했습니다.")
    }

    return prompt.trim()
  } catch (error) {
    console.error("[Longform] 커스텀 프롬프트 변환 실패:", error)
    throw error
  }
}

/**
 * 영어 이미지 프롬프트를 한글로 번역하는 함수
 */
export async function translatePromptToKorean(
  englishPrompt: string,
  openaiApiKey: string
): Promise<string> {
  if (!openaiApiKey) {
    throw new Error("OpenAI API 키가 필요합니다.")
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "당신은 이미지 프롬프트 번역 전문가입니다. 주어진 영어 이미지 생성 프롬프트를 자연스러운 한글로 번역해주세요. 이미지 생성에 필요한 시각적 묘사를 그대로 유지하면서 한글로 표현해주세요. 프롬프트만 번역하고 설명은 추가하지 마세요.",
          },
          {
            role: "user",
            content: `다음 영어 이미지 프롬프트를 한글로 번역해주세요:\n\n${englishPrompt}`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const koreanPrompt = data.choices?.[0]?.message?.content

    if (!koreanPrompt) {
      throw new Error("프롬프트 번역에 실패했습니다.")
    }

    return koreanPrompt.trim()
  } catch (error) {
    console.error("[Longform] 프롬프트 한글 번역 실패:", error)
    throw error
  }
}

/**
 * 한글 프롬프트를 이미지 스타일에 맞는 영어 프롬프트로 변환하는 함수
 * 이미지 스타일과 커스텀 스타일 프롬프트를 반영합니다.
 */
export async function generateCustomImagePromptFromKorean(
  koreanPrompt: string,
  openaiApiKey: string,
  imageStyle?: string,
  customStylePrompt?: string,
  historicalContext?: string | null,
  realisticCharacterType?: "korean" | "foreign" | null
): Promise<string> {
  if (!openaiApiKey) {
    throw new Error("OpenAI API 키가 필요합니다.")
  }

  try {
    // 이미지 스타일별 가이드 생성
    let styleGuidance = ""
    if (customStylePrompt) {
      styleGuidance = `⚠️ 매우 중요 - 커스텀 스타일:
${customStylePrompt}

위 커스텀 스타일을 반드시 프롬프트에 포함하고, 한글 설명과 자연스럽게 결합하세요.`
    } else if (imageStyle === "stickman-animation") {
      styleGuidance = "스틱맨 애니메이션 스타일: stickman character, 2D vector cartoon, white circular face, simple black outline, dot eyes, curved mouth, thin black limbs, vibrant colors, flat cel shading, thick bold outlines, solid color fills"
    } else if (imageStyle === "realistic" || imageStyle === "realistic2") {
      styleGuidance = "실사화 스타일: hyperrealistic, photorealistic masterpiece, 8K, ultra-detailed, sharp focus, cinematic lighting, shot on a professional DSLR camera with a 50mm lens"
      if (realisticCharacterType === "korean") {
        styleGuidance += ", Korean person, Korean character, Korean features, Asian features"
      } else if (realisticCharacterType === "foreign") {
        styleGuidance += ", Western, Caucasian, European, American"
      }
    } else if (imageStyle === "animation2") {
      styleGuidance = "애니메이션2 스타일: flat 2D vector illustration, minimal vector art, stylized cartoon character, thick bold black outlines, unshaded, flat solid colors, cel-shaded, simple line art, comic book inking style, completely flat, no shadows, no gradients, no depth"
    } else if (imageStyle === "animation3") {
      styleGuidance = "유럽풍 그래픽 노블 스타일: European graphic novel style, bande dessinée aesthetic, highly detailed traditional illustration, hand-drawn ink lines with cross-hatching shadows, sophisticated and muted color palette, atmospheric, cinematic frame"
    }

    // 한국 배경 구분 가이드 (실사화 스타일일 때)
    let koreanBackgroundGuidance = ""
    if ((imageStyle === "realistic" || imageStyle === "realistic2") && realisticCharacterType === "korean") {
      koreanBackgroundGuidance = `
⚠️ 매우 중요 - 한국 배경 구분:
- 배경이 한국인 경우 반드시 "Korean", "Korean architecture", "Korean setting", "Korea" 등을 명시적으로 포함하세요.
- 중국풍과 구분하기 위해 "NOT Chinese", "NOT Chinese style", "Korean setting, NOT Chinese" 등을 포함하세요.
- 한국 전통 건축: "Korean hanok", "Korean traditional architecture", "Korean palace (Gyeongbokgung style)", "Korean temple" 등 구체적으로 명시하세요.
- 절대 사용하지 말 것: "Chinese architecture", "Chinese style", "Chinese traditional", "China", "Beijing", "Shanghai", "Forbidden City"`
    }

    const systemPrompt = `당신은 이미지 생성 프롬프트 전문가입니다. 주어진 한글 설명을 이미지 생성에 적합한 영어 프롬프트로 변환해주세요.

요구사항:
- 영어로만 작성
- 구체적이고 시각적으로 묘사
- 고품질, 전문적, 아름다운 이미지
- 16:9 비율에 최적화된 시네마틱한 구도
- 텍스트, 글씨, 영어, 한글, 숫자, 로고, 워터마크 등 모든 텍스트 요소 절대 금지
- 반드시 "no text", "no letters", "no words", "no writing", "no labels", "no signs", "no watermark"를 포함하세요
${styleGuidance ? `\n${styleGuidance}` : ""}
${koreanBackgroundGuidance}
${historicalContext ? `\n시대적 배경: ${historicalContext} (이 시대적 배경을 프롬프트에 반드시 포함하세요)` : ""}

프롬프트 형식:
- 명사와 형용사를 사용한 구체적 묘사
- 스타일과 분위기 명시
- 색상과 조명 묘사
- 카메라 각도와 구도
- 위에서 제시한 스타일 가이드를 반드시 포함하세요

프롬프트만 작성하고 설명은 추가하지 마세요.`

    const userPrompt = `다음 한글 설명을 이미지 생성용 영어 프롬프트로 변환해주세요:

${koreanPrompt}`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
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
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const prompt = data.choices?.[0]?.message?.content

    if (!prompt) {
      throw new Error("프롬프트 변환에 실패했습니다.")
    }

    let finalPrompt = prompt.trim()

    // "no text" 등이 없으면 추가
    if (!finalPrompt.toLowerCase().includes("no text") && !finalPrompt.toLowerCase().includes("no letters")) {
      finalPrompt = `${finalPrompt}, no text, no letters, no words, no writing, no labels, no signs, no watermark`
    }

    return finalPrompt
  } catch (error) {
    console.error("[Longform] 커스텀 이미지 프롬프트 변환 실패:", error)
    throw error
  }
}

/**
 * 스틱맨 프롬프트 강화 함수
 * prunaai/hidream-l1-fast 모델용 프롬프트 생성
 * 샘플 형식: "stickman character A detective looking at evidence, a vibrant 2D cartoon, ..."
 */
function enforceStickmanPrompt(prompt: string, sceneDescription?: string): string {
  // 1. 장면 정보 추출 (프롬프트에서 장면 관련 부분 찾기)
  let scenePart = ""
  if (sceneDescription && sceneDescription.trim()) {
    // 장면 설명이 제공되면 사용
    scenePart = sceneDescription.trim()
  } else {
    // 프롬프트에서 장면 관련 부분 추출 시도 (예: "A detective looking at evidence" 같은 패턴)
    const sceneMatch = prompt.match(/(?:a|an|the)\s+[^,]+(?:looking|standing|sitting|walking|doing|working|holding|examining|investigating|analyzing)/i)
    if (sceneMatch) {
      scenePart = sceneMatch[0].trim()
    }
  }

  // 2. stickman character로 시작하는 프롬프트 구성
  let finalPrompt = ""
  if (scenePart) {
    // 장면 정보가 있으면: "stickman character [장면], [원본 프롬프트]"
    finalPrompt = `stickman character ${scenePart}, ${prompt}`.replace(/,\s*,/g, ",").trim()
  } else if (!prompt.toLowerCase().includes("stickman")) {
    // stickman이 없으면 추가
    finalPrompt = `stickman character ${prompt}`
  } else {
    finalPrompt = prompt
  }

  // 3. base (기본 캐릭터 묘사) - 샘플 형식과 동일
  const base = "a vibrant 2D cartoon, fully rendered illustration featuring a stickman with a white circular face, simple black outline, dot eyes, curved mouth, thin black limbs, expressive pose"

  // 4. style_phrase (스타일 묘사) - 샘플 형식과 동일
  const stylePhrase = "Consistent stick-figure illustration style, clean bold lines, solid colors, explainer video aesthetic, simplified background"

  // 5. extra (추가 요소) - 샘플 형식과 동일
  const extra = "colorful detailed drawing, rich environment, dynamic lighting, no realistic human anatomy, no blank background"

  // 6. 필수 요구사항: 팔 두 개, 전체 몸 표시
  const mandatoryRequirements = (
    "MANDATORY REQUIREMENTS: The stickman character MUST have exactly two arms visible, both arms must be clearly shown. " +
    "The stickman character MUST show the full body including both head and torso, not just torso alone. " +
    "Full body visible: head, torso, and limbs all must be visible in the image. " +
    "No partial body, no torso-only, no head-only. Complete stickman figure required."
  )

  // 7. 스틱맨 강화 규칙 추가
  const stickmanRules = "EVERY person is a stickman, no exceptions. Bride is a stickman. Groom is a stickman. All guests and guards are stickmen. stickman style rules: white circular face, dot eyes, curved mouth only, no hair, no ears, no nose, no blush, no eyelashes, black thin outline body, ultra-thin limbs, uniform stroke width, no body volume, mitten hands, no fingers. 2D vector cartoon, flat cel shading, thick bold outlines, solid color fills, crisp edges, minimal texture. wide shot / medium-wide shot, full bodies visible, at least 8–15 stickman people visible, palace hall background, wedding ceremony handshake scene, background crowd also stickmen, consistent stickman design for every character"

  // 8. 모든 요소 결합 (샘플 형식과 동일한 순서)
  return `${finalPrompt}, ${base}, ${stylePhrase}, ${extra}, ${mandatoryRequirements}, ${stickmanRules}`
}

/**
 * Replicate API를 사용하여 이미지 생성
 * 
 * @param prompt - 이미지 생성 프롬프트 (영어)
 * @param replicateApiKey - Replicate API 키
 * @param aspectRatio - 이미지 비율 ("16:9", "9:16", "1:1")
 * @param imageStyle - 이미지 스타일 (예: "stickman-animation")
 * @param sceneDescription - 장면 설명 (스틱맨 스타일일 때 사용)
 * @param selectedModel - 사용자가 선택한 모델 (선택사항)
 * @returns 생성된 이미지 URL
 */
export async function generateImageWithReplicate(
  prompt: string,
  replicateApiKey: string,
  aspectRatio: "16:9" | "9:16" | "1:1" = "16:9",
  imageStyle?: string,
  sceneDescription?: string,
  selectedModel?: "prunaai/hidream-l1-fast" | "black-forest-labs/flux-schnell" | "black-forest-labs/flux-pro"
): Promise<string> {
  if (!replicateApiKey) {
    throw new Error("Replicate API 키가 필요합니다.")
  }

  try {
    console.log(`[Longform] Replicate 이미지 생성 시작, 비율: ${aspectRatio}, 스타일: ${imageStyle || "기본"}`)

    // 이미지 스타일에 따라 모델 선택 (사용자가 선택한 모델이 있으면 우선 사용)
    let model = "black-forest-labs/flux-pro"
    if (selectedModel) {
      model = selectedModel
    } else if (imageStyle === "stickman-animation") {
      model = "prunaai/hidream-l1-fast"
    }

    // aspect ratio를 Replicate 형식으로 변환
    const aspectRatioMap: Record<string, string> = {
      "16:9": "16:9",
      "9:16": "9:16",
      "1:1": "1:1",
    }

    const replicateAspectRatio = aspectRatioMap[aspectRatio] || "16:9"

    // 프롬프트 그대로 사용 (이미지 프롬프트 생성에서 완성된 프롬프트 사용)
    let finalPrompt = prompt
    
    // 애니메이션2 스타일인 경우 스틱맨 관련 키워드 제거
    if (imageStyle === "animation2") {
      // 스틱맨 관련 키워드 제거
      finalPrompt = finalPrompt
        .replace(/stickman/gi, "")
        .replace(/stick figure/gi, "")
        .replace(/stick-man/gi, "")
        .replace(/stick-figure/gi, "")
        .replace(/\s+/g, " ")
        .trim()
    }
    
    // 실사화 스타일인 경우 텍스트 관련 키워드 강력 제거
    if (imageStyle === "realistic" || imageStyle === "realistic2") {
      // 텍스트 관련 키워드 제거 (자막, 캡션, 텍스트 등)
      finalPrompt = finalPrompt
        .replace(/subtitle/gi, "")
        .replace(/caption/gi, "")
        .replace(/text overlay/gi, "")
        .replace(/text on image/gi, "")
        .replace(/floating text/gi, "")
        .replace(/text in background/gi, "")
        .replace(/written text/gi, "")
        .replace(/text element/gi, "")
        .replace(/text content/gi, "")
        .replace(/text graphics/gi, "")
        .replace(/text design/gi, "")
        .replace(/text illustration/gi, "")
        .replace(/lettering/gi, "")
        .replace(/inscription/gi, "")
        .replace(/calligraphy/gi, "")
        .replace(/text box/gi, "")
        .replace(/text area/gi, "")
        .replace(/text banner/gi, "")
        .replace(/text label/gi, "")
        .replace(/text sign/gi, "")
        .replace(/text poster/gi, "")
        .replace(/text display/gi, "")
        .replace(/\s+/g, " ")
        .trim()
    }
    
    // 텍스트 제외 지시가 없으면 추가 (모든 모델에 적용)
    const textExclusionTerms = ["no text", "no letters", "no words", "no writing", "no labels", "no signs", "no watermark"]
    const hasTextExclusion = textExclusionTerms.some(term => finalPrompt.toLowerCase().includes(term))
    if (!hasTextExclusion) {
      // 실사화 스타일일 때는 더 강력한 텍스트 제거 지시 추가
      if (imageStyle === "realistic" || imageStyle === "realistic2") {
        finalPrompt = `${finalPrompt}, absolutely no text, no letters, no words, no writing, no labels, no signs, no watermark, no subtitles, no captions, no text overlay, no floating text, no text in background, no written content, no text elements, no typography, no lettering, no inscription, no calligraphy, no text box, no text area, no text banner, no text label, no text sign, no text poster, no text display, no text graphics, no text design, no text illustration, completely text-free image`
      } else {
        finalPrompt = `${finalPrompt}, no text, no letters, no words, no writing, no labels, no signs, no watermark`
      }
    }
    
    console.log(`[Longform] 프롬프트 사용: ${finalPrompt.substring(0, 100)}...`)

    // 모델별 입력 형식 설정
    let inputBody: any = {}
    if (model === "prunaai/hidream-l1-fast") {
      // hidream-l1-fast 모델용 입력 형식 (스틱맨 애니메이션)
      inputBody = {
        prompt: finalPrompt,
        width: 1360, // 스틱맨 애니메이션 전용 해상도
        height: 768,
        negative_prompt: "realistic human, detailed human skin, photograph, 3d render, blank white background, line-art only, text, letters, words, writing, labels, signs, watermark, typography, font, caption, subtitle, non-stickman, mixed style, detailed cartoon human, prince, princess, disney, pixar, anime, chibi, kawaii, big head, human body, human skin, realistic, 3d render, semi-realistic, detailed face, eyelashes, blush, nose, lips, hair, ears, detailed clothing folds, portrait, close-up, single character focus, bokeh, depth of field, watercolor, painterly, airbrush, soft shading",
        num_inference_steps: 16,
        image_format: "png",
      }
    } else {
      // flux-pro 모델용 입력 형식 (1360x768로 통일)
      // 실사화 스타일일 때는 negative prompt 추가
      const negativePrompt = (imageStyle === "realistic" || imageStyle === "realistic2")
        ? "text, letters, words, typography, English text, Korean text, Chinese text, Japanese text, numbers, logos, watermarks, signs, labels, captions, subtitles, written text, text overlay, any text elements, any written content, any letters, any numbers, any symbols that form text, text on image, text in background, floating text, alphabet, characters, fonts, typeface, lettering, inscription, writing, script, calligraphy, text box, text area, text banner, text label, text sign, text poster, text display, text graphics, text design, text art, text illustration, any form of text, any form of writing, any form of letters, any form of numbers, any readable text, any visible text, any text content, different person, different face, face morph, altered identity, wrong person, different character, different appearance, inconsistent character, changed appearance, different facial features, different body type, different clothing style"
        : undefined
      
      inputBody = {
        prompt: finalPrompt,
        width: 1360,
        height: 768,
        output_format: "png",
        output_quality: 90,
        ...(negativePrompt && { negative_prompt: negativePrompt }),
      }
    }

    // API 호출
    const requestBody = {
      input: inputBody,
    }
    
    console.log(`[Longform] Replicate API 요청 body:`, JSON.stringify(requestBody, null, 2))
    
    const response = await fetch("https://api.replicate.com/v1/models/" + model + "/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${replicateApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Longform] Replicate API 오류:", errorText)
      
      // flux-pro가 실패하면 stable-diffusion-xl 시도
      if (response.status === 404 || response.status === 422) {
        console.log("[Longform] flux-pro 실패, stable-diffusion-xl 시도")
        return await generateImageWithStableDiffusion(prompt, replicateApiKey, aspectRatio)
      }
      
      throw new Error(`Replicate API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // 폴링 방식으로 결과 확인
    if (data.status === "processing" || data.status === "starting" || data.status === "succeeded") {
      const predictionId = data.id
      let attempts = 0
      const maxAttempts = 120 // 최대 2분 대기

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000)) // 2초 대기

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
            imageUrl = typeof statusData.output[0] === "string" 
              ? statusData.output[0] 
              : statusData.output[0].url || String(statusData.output[0])
          } else if (statusData.output.url) {
            imageUrl = statusData.output.url
          } else {
            imageUrl = String(statusData.output)
          }
          
          console.log("[Longform] 이미지 생성 완료:", imageUrl)
          return imageUrl
        } else if (statusData.status === "failed") {
          throw new Error(`이미지 생성 실패: ${statusData.error || "알 수 없는 오류"}`)
        }

        attempts++
      }

      throw new Error("이미지 생성 시간 초과")
    } else if (data.status === "succeeded" && data.output) {
      // 즉시 완료된 경우
      let imageUrl: string
      if (typeof data.output === "string") {
        imageUrl = data.output
      } else if (Array.isArray(data.output) && data.output.length > 0) {
        imageUrl = typeof data.output[0] === "string" 
          ? data.output[0] 
          : data.output[0].url || String(data.output[0])
      } else {
        imageUrl = String(data.output)
      }
      
      console.log("[Longform] 이미지 생성 완료 (즉시):", imageUrl)
      return imageUrl
    } else {
      throw new Error(`이미지 생성 실패: ${data.error || "알 수 없는 오류"}`)
    }
  } catch (error) {
    console.error("[Longform] Replicate 이미지 생성 실패:", error)
    throw error
  }
}

/**
 * Stable Diffusion XL을 사용한 이미지 생성 (fallback)
 */
async function generateImageWithStableDiffusion(
  prompt: string,
  replicateApiKey: string,
  aspectRatio: "16:9" | "9:16" | "1:1"
): Promise<string> {
  try {
    const model = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"

    // aspect ratio를 width/height로 변환
    const dimensions: Record<string, { width: number; height: number }> = {
      "16:9": { width: 1024, height: 576 },
      "9:16": { width: 576, height: 1024 },
      "1:1": { width: 1024, height: 1024 },
    }

    const dims = dimensions[aspectRatio] || dimensions["16:9"]

    const response = await fetch("https://api.replicate.com/v1/models/" + model + "/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${replicateApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          width: dims.width,
          height: dims.height,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Stable Diffusion API 호출 실패: ${response.status} - ${errorText}`)
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
        const imageUrl = Array.isArray(statusData.output) 
          ? statusData.output[0] 
          : statusData.output
        console.log("[Longform] Stable Diffusion 이미지 생성 완료:", imageUrl)
        return imageUrl
      } else if (statusData.status === "failed") {
        throw new Error(`이미지 생성 실패: ${statusData.error || "알 수 없는 오류"}`)
      }

      attempts++
    }

    throw new Error("이미지 생성 시간 초과")
  } catch (error) {
    console.error("[Longform] Stable Diffusion 이미지 생성 실패:", error)
    throw error
  }
}

/**
 * 직접입력 주제로 관련 주제 15개 생성 (카테고리 무시)
 */
export async function generateTopicsFromCustomTopic(customTopic: string, apiKey: string): Promise<string[]> {
  console.log("[generateTopicsFromCustomTopic] 시작, 주제:", customTopic)
  
  const finalPrompt = `🚫🚫🚫 절대 금지: 다른 주제나 카테고리로 벗어나지 마세요. 오직 "${customTopic}"와 직접적으로 관련된 주제만 생성하세요. 🚫🚫🚫

다음 주제를 바탕으로 **오직 해당 주제와 직접적으로 관련된** 다양한 스타일의 롱폼 비디오 주제 15개를 생성해주세요:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 핵심 주제: "${customTopic}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️⚠️⚠️ 절대적 필수 사항 (반드시 준수하세요) ⚠️⚠️⚠️:
1. 모든 주제는 반드시 "${customTopic}"와 직접적으로 관련되어야 합니다.
2. "${customTopic}"와 관련 없는 주제는 절대 생성하지 마세요.
3. 건강, 인생 교훈, 가족 이야기 등 다른 카테고리 주제는 절대 생성하지 마세요.
4. 오직 "${customTopic}"에 대한 주제만 생성하세요.

예시:
- 주제가 "테슬라"라면: 테슬라 전기차, 테슬라 자율주행, 테슬라 배터리, 테슬라 주식 등 테슬라 관련 주제만 생성
- 주제가 "여자친구 데이트"라면: 데이트 장소, 데이트 아이디어, 데이트 팁 등 데이트 관련 주제만 생성
- 건강, 인생 교훈, 가족 이야기 등은 절대 생성하지 마세요.

요구사항:
- 주제 15개를 반드시 생성해주세요
- 모든 주제는 "${customTopic}"와 직접적으로 관련되어야 합니다
- 다양한 스타일을 골고루 섞어서 생성하세요 (호기심 유발형, 실용 팁형, 스토리형, 트렌드 분석형, 비교형, 과학 설명형 등)
- 각 주제는 한 줄로 간결하게 작성
- 번호 형식: 1. 주제명
- 사과 메시지나 설명 없이 주제만 작성

주제 목록:`
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `당신은 유튜브 롱폼 콘텐츠 기획 전문가입니다. 사용자가 입력한 주제와 **오직 직접적으로 관련된** 주제만 생성해야 합니다.

🚫🚫🚫 절대 금지 사항 🚫🚫🚫:
1. 사용자가 입력한 주제와 관련 없는 주제는 절대 생성하지 마세요.
2. 건강, 인생 교훈, 가족 이야기 등 다른 카테고리 주제는 절대 생성하지 마세요.
3. 주제가 "테슬라"라면 테슬라 관련 주제만 생성하고, 건강이나 다른 주제는 절대 생성하지 마세요.
4. 주제가 "여자친구 데이트"라면 데이트 관련 주제만 생성하고, 다른 주제는 절대 생성하지 마세요.

✅ 필수 사항:
- 사용자가 입력한 주제와 직접적으로 관련된 주제만 생성하세요.
- 모든 주제는 입력한 주제의 핵심 키워드를 포함해야 합니다.

주제 스타일 다양화 (입력한 주제와 관련된 범위 내에서):
   - 호기심 유발형: 미스터리, 궁금증, 비밀, 숨겨진 이야기 (2-3개)
   - 실용 팁형: How-to, 실생활 적용, 꿀팁, 방법론 (2-3개)
   - 스토리/인물형: 인물 중심, 사건 중심, 경험담 (2-3개)
   - 트렌드 분석형: 최신 이슈, 트렌드, 변화 (1-2개)
   - 비교/대조형: A vs B, 차이점, 선택 가이드 (1-2개)
   - 과학/지식 설명형: 원리, 메커니즘, 배경 지식 (1-2개)
   - 감동/공감형: 인간적 이야기, 공감대 형성 (1-2개)

기타:
- 각 주제는 시청자의 호기심을 자극하고 클릭하고 싶게 만들어야 합니다.
- 주제만 생성하고, 사과 메시지나 설명은 절대 포함하지 마세요.
- 각 주제는 번호를 붙여서 작성해주세요 (예: 1. 주제명).`,
        },
        {
          role: "user",
          content: finalPrompt,
        },
      ],
      max_tokens: 1500,
      temperature: 0.9,
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

  console.log("[generateTopicsFromCustomTopic] GPT API 응답:", content.substring(0, 200))

  const lines = content.split("\n").filter((line: string) => line.trim())
  const topics: string[] = []
  
  for (const line of lines) {
    // 다양한 번호 형식 지원: "1.", "1)", "1. ", "- 1." 등
    const match = line.match(/^[\d\-]+[\.\)]\s*(.+)$/) || line.match(/^[\-\*]\s*(.+)$/)
    if (match && match[1]) {
      const topic = match[1].trim()
      // 오류 메시지가 아닌 실제 주제인지 확인
      if (topic && 
          topic.length > 0 && 
          !topic.includes("카테고리가") && 
          !topic.includes("죄송하지만") &&
          !topic.includes("제공해")) {
        topics.push(topic)
      }
    }
    if (topics.length >= 15) break
  }

  if (topics.length === 0) {
    console.error("[generateTopicsFromCustomTopic] 주제를 파싱할 수 없습니다. 원본 응답:", content)
    throw new Error(`주제를 생성할 수 없습니다. GPT API 응답: ${content.substring(0, 200)}`)
  }

  console.log("[generateTopicsFromCustomTopic] 생성 완료, 주제 수:", topics.length)
  return topics
}

/**
 * 롱폼 비디오 주제 생성 함수
 */
export async function generateTopics(
  category: string | undefined,
  keywords?: string,
  trendingData?: any,
  apiKey?: string,
  customTopic?: string
): Promise<string[]> {
  console.log("[generateTopics] 함수 호출됨 - category:", category, "customTopic:", customTopic, "keywords:", keywords)
  
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.")
  }

  // ⚠️ 매우 중요: 직접입력 주제가 있으면 무조건 주제만으로 생성 (가장 먼저 체크)
  // customTopic이 있고, 빈 문자열이 아니면 직접입력 모드
  if (customTopic && typeof customTopic === 'string' && customTopic.trim().length > 0) {
    const trimmedTopic = customTopic.trim()
    console.log("[generateTopics] ⚠️⚠️⚠️ 직접입력 주제 모드 감지!")
    console.log("[generateTopics] - 주제:", trimmedTopic)
    console.log("[generateTopics] - 카테고리 무시:", category)
    console.log("[generateTopics] - generateTopicsFromCustomTopic 함수 호출 시작")
    const result = await generateTopicsFromCustomTopic(trimmedTopic, GPT_API_KEY)
    console.log("[generateTopics] - generateTopicsFromCustomTopic 함수 완료, 결과:", result.length, "개")
    return result
  }
  
  console.log("[generateTopics] 직접입력 주제 없음 - customTopic:", customTopic, "타입:", typeof customTopic)
  
  console.log("[generateTopics] 카테고리 기반 모드로 진행 - category:", category)
  
  // category가 없거나 빈 문자열인 경우 체크
  if (!category || category.trim() === "") {
    throw new Error("카테고리가 지정되지 않았습니다.")
  }
  
  const categoryPrompts: Record<string, string> = {
    health: "건강, 웰빙, 생활 꿀팁과 관련된 롱폼 비디오 주제",
    history: "역사 이야기, 역사적 사실과 관련된 롱폼 비디오 주제",
    wisdom: "인생 명언, 지혜, 철학과 관련된 롱폼 비디오 주제",
    self_improvement: "자기계발, 성장과 관련된 롱폼 비디오 주제",
    society: "사회 트렌드, 최신 이슈와 관련된 롱폼 비디오 주제",
    space: "우주, 천문학과 관련된 롱폼 비디오 주제",
    fortune: "사주, 운세와 관련된 롱폼 비디오 주제",
    psychology: "심리학, 인간 심리, 행동 심리, 관계 심리, 감정 관리와 관련된 롱폼 비디오 주제",
    reserve_army: "예비군 이야기, 예비군 경험과 관련된 롱폼 비디오 주제",
    elementary_school: "국민학교 시절, 추억과 관련된 롱폼 비디오 주제",
    custom: keywords ? `${keywords}와 관련된 롱폼 비디오 주제` : "다양한 롱폼 비디오 주제",
  }

  try {
    // 카테고리 기반 생성 (직접입력 주제는 이미 함수 시작 부분에서 처리됨)
    // category가 없거나 빈 문자열인 경우 체크
    if (!category || category.trim() === "") {
      throw new Error("카테고리가 지정되지 않았습니다.")
    }

    // 디버깅: category 값 확인
    console.log("[generateTopics] category:", category)
    
    const categoryPrompt = categoryPrompts[category]
    
    // categoryPrompt가 없으면 오류
    if (!categoryPrompt) {
      console.error("[generateTopics] categoryPrompt not found for category:", category)
      console.error("[generateTopics] available categories:", Object.keys(categoryPrompts))
      throw new Error(`지원하지 않는 카테고리입니다: ${category}`)
    }

    console.log("[generateTopics] categoryPrompt:", categoryPrompt)

    const keywordsText = keywords ? `\n키워드: ${keywords}` : ""
    const customTopicText = customTopic ? `\n직접 입력한 주제: ${customTopic}` : ""
    const finalPrompt = `다음 카테고리에 해당하는 다양한 스타일의 롱폼 비디오 주제 15개를 생성해주세요:\n\n카테고리 설명: ${categoryPrompt}${keywordsText}${customTopicText}\n\n요구사항:\n- 주제 15개를 반드시 생성해주세요\n- 다양한 스타일을 골고루 섞어서 생성하세요:\n  * 교훈형 (인생의 교훈, 깨달음) - 2-3개\n  * 호기심 유발형 (미스터리, 비밀, 숨겨진 이야기) - 2-3개\n  * 실용 팁형 (How-to, 꿀팁, 방법론) - 2-3개\n  * 스토리/인물형 (인물 중심, 사건 중심) - 2-3개\n  * 트렌드 분석형 (최신 이슈, 변화) - 1-2개\n  * 비교/대조형 (A vs B, 차이점) - 1-2개\n  * 과학/지식 설명형 (원리, 배경 지식) - 1-2개\n  * 감동/공감형 (인간적 이야기) - 1-2개\n- 교훈형에만 치우치지 말고 위 스타일들을 다양하게 섞어서 생성하세요\n- 각 주제는 한 줄로 간결하게 작성\n- 번호 형식: 1. 주제명\n- 사과 메시지나 설명 없이 주제만 작성\n\n주제 목록:`

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
            content: `당신은 유튜브 롱폼 콘텐츠 기획 전문가입니다. 다양한 스타일의 주제를 생성해야 합니다.

⚠️ 매우 중요한 지시사항:
1. 주제 스타일 다양화 필수:
   - 교훈형: 인생의 교훈, 깨달음, 지혜 (2-3개)
   - 호기심 유발형: 미스터리, 궁금증, 비밀, 숨겨진 이야기 (2-3개)
   - 실용 팁형: How-to, 실생활 적용, 꿀팁, 방법론 (2-3개)
   - 스토리/인물형: 인물 중심, 사건 중심, 경험담 (2-3개)
   - 트렌드 분석형: 최신 이슈, 트렌드, 변화 (1-2개)
   - 비교/대조형: A vs B, 차이점, 선택 가이드 (1-2개)
   - 과학/지식 설명형: 원리, 메커니즘, 배경 지식 (1-2개)
   - 감동/공감형: 인간적 이야기, 공감대 형성 (1-2개)

2. 교훈형에만 치우치지 말고 위 스타일들을 골고루 섞어서 생성하세요.
3. 각 주제는 시청자의 호기심을 자극하고 클릭하고 싶게 만들어야 합니다.
4. 주제만 생성하고, 사과 메시지나 설명은 절대 포함하지 마세요.
5. 각 주제는 번호를 붙여서 작성해주세요 (예: 1. 주제명).`,
          },
          {
            role: "user",
            content: finalPrompt,
          },
        ],
        max_tokens: 1500,
        temperature: 0.9,
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

    // GPT가 오류 메시지를 반환한 경우 체크
    if (content.includes("카테고리가 정의되지 않았") || 
        content.includes("카테고리가 지정되지 않았") ||
        content.includes("죄송하지만") ||
        content.includes("카테고리를 제공해")) {
      console.error("[generateTopics] GPT API가 오류 메시지를 반환했습니다:", content)
      console.error("[generateTopics] category:", category)
      console.error("[generateTopics] categoryPrompt:", categoryPrompt)
      throw new Error(`주제 생성에 실패했습니다. 카테고리: ${category}, 프롬프트: ${categoryPrompt}`)
    }

    console.log("[generateTopics] GPT API 응답:", content.substring(0, 200))

    const lines = content.split("\n").filter((line: string) => line.trim())
    const topics: string[] = []
    
    for (const line of lines) {
      // 다양한 번호 형식 지원: "1.", "1)", "1. ", "- 1." 등
      const match = line.match(/^[\d\-]+[\.\)]\s*(.+)$/) || line.match(/^[\-\*]\s*(.+)$/)
      if (match && match[1]) {
        const topic = match[1].trim()
        // 오류 메시지가 아닌 실제 주제인지 확인
        if (topic && 
            topic.length > 0 && 
            !topic.includes("카테고리가") && 
            !topic.includes("죄송하지만") &&
            !topic.includes("제공해")) {
          topics.push(topic)
        }
      }
      if (topics.length >= 15) break
    }

    if (topics.length === 0) {
      console.error("[generateTopics] 주제를 파싱할 수 없습니다. 원본 응답:", content)
      throw new Error(`주제를 생성할 수 없습니다. GPT API 응답: ${content.substring(0, 200)}`)
    }

    return topics
  } catch (error) {
    console.error("주제 생성 실패:", error)
    throw error
  }
}

/**
 * 트렌딩 주제 생성 함수
 */
export async function generateTrendingTopics(
  category: string,
  apiKey?: string
): Promise<string[]> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
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
            content: "당신은 트렌딩 콘텐츠 분석 전문가입니다. 현재 인기 있는 주제들을 생성해주세요.",
          },
          {
            role: "user",
            content: `카테고리: ${category}\n\n위 카테고리의 최근 트렌딩 주제 10개를 생성해주세요.`,
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

    const lines = content.split("\n").filter((line: string) => line.trim())
    const topics: string[] = []
    
    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)$/)
      if (match && match[1]) {
        topics.push(match[1].trim())
      }
      if (topics.length >= 10) break
    }

    return topics.length > 0 ? topics : ["최근 인기 건강 정보", "화제의 역사 이야기"]
  } catch (error) {
    console.error("트렌딩 주제 생성 실패:", error)
    throw error
  }
}

/**
 * 주제를 분석하여 적합한 콘텐츠 타입 추천
 */
export async function recommendContentType(
  topic: string,
  category: string,
  apiKey?: string
): Promise<"A" | "B" | "C" | "D"> {
  const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.")
  }

  try {
    const systemPrompt = `당신은 유튜브 콘텐츠 기획 전문가입니다.

주어진 주제를 분석하여, 가장 적합한 콘텐츠 구조 타입을 추천해야 합니다.

[콘텐츠 타입 설명]
- Type A. 단일 서사 심층형: 하나의 사건, 인물, 역사적 이야기를 깊이 있게 다루는 구조. 기승전결 + 감정 곡선 중심.
- Type B. 컴필레이션 / 목록형: 하나의 대주제 아래 3~5개의 사례를 나열하는 구조. 각 사례는 미니 스토리 구조.
- Type C. 다각도 탐구형: 하나의 대상을 여러 관점으로 분석하는 구조. 논리적 흐름 + 점층적 몰입 중심.
- Type D. 이야기형 (옛날이야기/민담): "옛날 옛날에..." 형식의 재미있는 이야기 구조. 등장인물 중심, 에세이 형식 절대 금지.

[출력 형식]
반드시 다음 중 하나만 출력하세요:
- Type A
- Type B
- Type C
- Type D

추가 설명이나 다른 텍스트는 절대 포함하지 마세요. 오직 "Type A", "Type B", "Type C" 중 하나만 출력하세요.`

    const userPrompt = `[주제]: ${topic}
[카테고리]: ${category}

위 주제에 가장 적합한 콘텐츠 타입을 추천해주세요.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                { text: userPrompt },
              ],
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API 오류: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

    if (!content) {
      throw new Error("AI 응답이 비어있습니다.")
    }

    // 응답에서 타입 추출
    const trimmedContent = content.trim()
    if (trimmedContent.includes("Type A")) {
      return "A"
    } else if (trimmedContent.includes("Type B")) {
      return "B"
    } else if (trimmedContent.includes("Type C")) {
      return "C"
    } else if (trimmedContent.includes("Type D")) {
      return "D"
    } else {
      // 기본값으로 Type A 반환
      console.warn("[콘텐츠 타입 추천] 응답을 파싱할 수 없어 기본값 Type A 반환:", trimmedContent)
      return "A"
    }
  } catch (error) {
    console.error("[콘텐츠 타입 추천] 오류:", error)
    // 오류 시 기본값으로 Type A 반환
    return "A"
  }
}

/**
 * 대본 기획안 생성 함수
 */
export async function generateScriptPlan(
  topic: string,
  category: string,
  keywords?: string,
  apiKey?: string,
  videoDurationMinutes?: number, // 영상 길이 (분)
  referenceScript?: string, // 레퍼런스 대본
  contentType?: "A" | "B" | "C" | "D" | "custom" | null, // 사용자가 선택한 콘텐츠 타입
  customContentTypeDescription?: string // 커스텀 타입 선택 시 사용자 입력 설명
): Promise<string> {
  // ⚠️ 중요: 이 함수는 서버 사이드에서 실행되므로 로그는 서버 콘솔(터미널)에 찍힙니다!
  console.log("=".repeat(80))
  console.log("[generateScriptPlan] 🚀 함수 호출됨!")
  console.log("[generateScriptPlan] 전달된 파라미터:")
  console.log("  - topic:", topic)
  console.log("  - category:", category)
  console.log("  - keywords:", keywords)
  console.log("  - contentType:", contentType, "(타입:", typeof contentType, ")")
  console.log("  - customContentTypeDescription:", customContentTypeDescription)
  console.log("=".repeat(80))
  
  const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    console.error("[generateScriptPlan] ❌ Gemini API 키가 없습니다!")
    throw new Error("Gemini API 키가 설정되지 않았습니다.")
  }

  // 타입 선택이 필수입니다. 타입을 선택하지 않으면 기획안을 생성할 수 없습니다.
  if (!contentType) {
    console.error("[generateScriptPlan] ❌ contentType이 null/undefined입니다!")
    throw new Error("콘텐츠 타입을 선택해주세요. 기획안을 생성하려면 Type A, B, C, D 또는 커스텀 타입 중 하나를 선택해야 합니다.")
  }

  // 커스텀 타입 선택 시 설명이 필수입니다.
  if (contentType === "custom" && (!customContentTypeDescription || !customContentTypeDescription.trim())) {
    console.error("[generateScriptPlan] ❌ 커스텀 타입인데 설명이 없습니다!")
    throw new Error("커스텀 타입을 선택하셨습니다. 원하는 대본 구조를 입력해주세요.")
  }

  const duration = videoDurationMinutes || 5 // 기본값 5분
  console.log("[generateScriptPlan] ✅ 검증 통과 - duration:", duration)

  // 공통 System Prompt (타입별로 추가 지시사항이 붙음)
  const baseSystemPrompt = `당신은 '지식 스토리텔링 전문 기획자'입니다.

당신의 임무는 사용자가 이미 선택한 콘텐츠 타입 구조에 맞게,
본격적인 대본 작성을 위한 '대본 기획안(스토리 설계도)'을 만드는 것입니다.

⚠️⚠️⚠️ 매우 중요: 콘텐츠 타입은 이미 결정되어 있습니다.
⚠️ 주제를 분석하거나 타입을 선택하지 마세요. 타입은 변경할 수 없습니다.
⚠️ 주제는 단순히 기획안을 작성할 때 사용하는 정보일 뿐입니다. 주제를 보고 타입을 판단하지 마세요.

이 단계에서는 완성된 대본을 쓰지 않습니다.
대신, 이후 단계에서 대본 생성 AI가 흔들리지 않도록
이야기의 구조, 감정 흐름, 핵심 포인트를 명확히 설계해야 합니다.

────────────────────────
[채널 및 콘텐츠 정체성]
────────────────────────
${category === "folktale" ? `⚠️ 매우 중요: 이 채널은 "옛날이야기(민담)" 채널입니다.

- 채널 성격: 옛날이야기, 민담, 전래동화를 재미있게 들려주는 이야기 채널
- 타깃: 한국인 성인 시청자
- 톤: 옛날 할머니/할아버지가 손자에게 들려주는 듯한 따뜻하고 재미있는 이야기꾼 톤
- 목표: 에세이 형식이 아닌, 재미있는 이야기 형식으로 전달
- 필수: 반드시 이야기 형식(스토리텔링)으로 작성해야 합니다. 에세이, 설명문, 논설문 형식은 절대 금지입니다.
- 이야기 요소: 등장인물, 사건, 갈등, 해결, 교훈이 자연스럽게 흐르는 이야기 구조
- 레퍼런스 대본이 있으면, 그 형식(이야기 형식)을 정확히 따르세요.` : `- 채널 성격: 역사·사회·경제·미스터리·전쟁사 기반의 지식 스토리텔링
- 타깃: 한국인 성인 시청자
- 톤: 친근하지만 가볍지 않음, 이야기꾼의 구어체, 몰입감 최우선
- 목표: 정보 전달이 아니라 '끝까지 보게 만드는 흐름' 설계`}

────────────────────────
[기획 핵심 원칙]
────────────────────────
1) 이탈 방지 최우선
- 초반 30초 안에 반드시 '강력한 궁금증'을 유발해야 함
- 중간중간 "이 다음을 보지 않으면 안 될 이유"를 설계

2) 사실 기반 + 신뢰도 최우선 (중요)
${category === "folktale" ? `- ⚠️ 민담/옛날이야기 채널 특성: 전래동화, 민담, 옛날이야기 형식으로 작성해야 합니다.
- 이야기 형식 필수: "옛날 옛날에...", "한 옛날에...", "예전에..." 같은 이야기 시작 구문 사용
- 등장인물 중심: 주인공, 조연, 악역 등 명확한 등장인물 설정
- 사건 전개: 시작 → 사건 발생 → 갈등/시련 → 해결 → 교훈/결말 구조
- 재미 요소: 이야기의 흥미진진함, 반전, 교훈이 자연스럽게 녹아있는 구조
- 에세이 형식 절대 금지: 설명문, 논설문, 분석문 형식은 사용하지 마세요.
- 레퍼런스 대본이 있으면, 그 이야기 형식을 정확히 따르세요.` : `- 허구의 주인공/가상 인물/드라마적 운명 교차/로맨스/과장된 배신극을 절대 사용하지 마십시오.
- 역사·외교·전쟁 주제는 "실존 국가/실존 인물(필요 시)/결정 구조/외교 흐름/기록에 근거한 사건" 중심으로 기획하십시오.
- 확실하지 않은 정보는 단정하지 말고, "~로 알려져 있다/기록에 따르면/해석이 갈린다"처럼 표현하십시오.`}

3) 장면화 가능성 고려
- 이후 이 기획안은 '장면 단위 이미지 생성'으로 확장됨
- 추상적인 설명만 나열하지 말고, 장면·상황·사람이 떠오르도록 구성

4) 과도한 정보 나열 금지
- 사실은 이야기 속에 녹여서 배치
- "설명"보다 "상황 → 의미" 구조를 우선

────────────────────────
[기획 산출물 형식]
────────────────────────
아래 형식을 반드시 지켜서 출력하십시오.

1) 콘텐츠 타입
- [타입이 여기에 들어갑니다]

2) 전체 이야기 한 줄 요약
- 이 영상이 "결국 어떤 이야기를 하려는지"를 한 문장으로

3) 오프닝 기획
- 초반 훅의 핵심 질문 또는 충격 포인트
- 시청자가 왜 이 영상을 계속 봐야 하는지

4) 본론 구성 설계
- 파트별 흐름을 번호로 정리
- 각 파트마다:
  · 다루는 핵심 내용
  · 감정 방향 (불안 / 긴장 / 충격 / 공감 / 희망 등)
  · 장면화 가능한 포인트 (사람, 상황, 공간, 상징 오브젝트)

5) 클라이맥스 / 핵심 메시지
- 이야기의 정점
- 시청자의 감정이 가장 크게 움직여야 하는 지점

6) 아웃트로 설계
- 오늘 이야기가 '지금 우리에게 왜 중요한지'
- 여운을 남기는 마무리 방향
- 다음 영상으로 자연스럽게 이어지는 문장(기획 관점)

────────────────────────
[출력 제한]
────────────────────────
- 아직 '대본 문장'을 쓰지 마십시오.
- 실제 내레이션 문장, 대사, TTS용 문구는 절대 포함하지 마십시오.
- 설명은 기획자의 시점에서 서술하십시오.
- 제작자 노트, 체크리스트, 파트 구분, 글자수 등은 절대 포함하지 마십시오.
- 오직 기획안만 출력하십시오. 추가 설명이나 메타 정보는 포함하지 마십시오.`

  try {
    // 타입별 if문 분기: 선택한 타입에 맞는 프롬프트 생성 및 AI 호출
    console.log("[generateScriptPlan] ========== 타입 분기 시작 ==========")
    console.log("[generateScriptPlan] contentType 값:", contentType)
    console.log("[generateScriptPlan] contentType 타입:", typeof contentType)
    console.log("[generateScriptPlan] contentType === 'A':", contentType === "A")
    console.log("[generateScriptPlan] contentType === 'B':", contentType === "B")
    console.log("[generateScriptPlan] contentType === 'C':", contentType === "C")
    console.log("[generateScriptPlan] contentType === 'D':", contentType === "D")
    console.log("[generateScriptPlan] contentType === 'custom':", contentType === "custom")
    
    let systemPrompt = ""
    let userPrompt = ""

    if (contentType === "A") {
      // Type A 선택됨 → Type A 전용 프롬프트 생성
      console.log("[generateScriptPlan] ✅ Type A 분기 진입 - Type A 전용 프롬프트 생성")
      
      systemPrompt = `${baseSystemPrompt}

────────────────────────
[Type A. 단일 서사 심층형 - 필수 구조]
────────────────────────
⚠️ 매우 중요: 이 기획안은 반드시 Type A (단일 서사 심층형) 구조로 작성해야 합니다.

Type A의 핵심 원칙:
1. 하나의 사건, 인물, 또는 역사적 이야기를 깊이 있게 다룹니다
2. 기승전결 구조를 중심으로 구성합니다
   - 기(起): 이야기의 시작, 배경 설정
   - 승(承): 사건의 전개, 갈등의 시작
   - 전(轉): 절정, 갈등의 정점
   - 결(結): 해결, 교훈 또는 여운
3. 감정 곡선을 명확히 설계합니다
   - 초반: 호기심 유발
   - 중반: 긴장감 증가
   - 후반: 감동 또는 깨달음
4. 단일 서사 구조로 일관되게 전개합니다
   - 여러 사례를 나열하지 않습니다
   - 하나의 이야기에 집중합니다
   - 시간순 또는 사건 순서대로 구성
   - 인물의 심리 변화와 행동을 중심으로

❌ Type A에서 하지 말아야 할 것:
- Type B처럼 여러 사례를 나열하는 것
- Type C처럼 여러 관점으로 분석하는 것
- 목록형 구조를 사용하는 것

기획안의 "1) 콘텐츠 타입" 부분에는 반드시 "- Type A"라고만 작성하세요.`

      userPrompt = `⚠️ 필수 확인사항:
1. 콘텐츠 타입은 이미 Type A로 결정되어 있습니다. 이것은 변경할 수 없습니다.
2. 주제를 분석하거나 타입을 선택하지 마세요. 타입은 이미 Type A로 결정되어 있습니다.
3. "1) 콘텐츠 타입" 부분에는 반드시 "- Type A"라고만 작성하세요.

[기획할 주제]: ${topic}

Type A (단일 서사 심층형)의 구조와 특징에 맞게 기획안을 작성하세요.
주제는 기획안을 작성할 때 사용하는 정보일 뿐입니다. 주제를 분석하거나 타입을 선택하지 마세요.

Type A 작성 방법:
- 하나의 사건, 인물, 또는 역사적 이야기를 깊이 있게 다루세요
- 기승전결 구조로 구성하세요 (기 → 승 → 전 → 결)
- 감정 곡선을 설계하세요 (호기심 → 긴장 → 감동/깨달음)
- 여러 사례를 나열하지 말고 하나의 이야기에 집중하세요
- Type B처럼 여러 사례를 나열하지 마세요
- Type C처럼 여러 관점으로 분석하지 마세요`

    } else if (contentType === "B") {
      // Type B 선택됨 → Type B 전용 프롬프트 생성
      console.log("[generateScriptPlan] ✅ Type B 분기 진입 - Type B 전용 프롬프트 생성")
      
      systemPrompt = `${baseSystemPrompt}

────────────────────────
[Type B. 컴필레이션 / 목록형 - 필수 구조]
────────────────────────
⚠️ 매우 중요: 이 기획안은 반드시 Type B (컴필레이션 / 목록형) 구조로 작성해야 합니다.

Type B의 핵심 원칙:
1. 하나의 대주제 아래 3~5개의 사례를 나열합니다
2. 각 사례는 '미니 스토리' 구조를 가집니다
   - 각 사례마다 작은 기승전결이 있음
   - 각 사례가 독립적이면서도 전체 주제와 연결됨
3. 목록형 구조로 체계적으로 전개합니다
   - "첫 번째 사례", "두 번째 사례" 등으로 구분
   - 각 사례의 공통점과 차이점을 명확히
4. 본론 구성 설계 시:
   - 대주제 소개
   - 사례 1 (미니 스토리)
   - 사례 2 (미니 스토리)
   - 사례 3 (미니 스토리)
   - 사례 4-5 (필요시)
   - 전체 사례를 통한 통찰 또는 교훈

❌ Type B에서 하지 말아야 할 것:
- Type A처럼 하나의 이야기에 집중하는 것
- Type C처럼 여러 관점으로 분석하는 것
- 단일 서사 구조를 사용하는 것

기획안의 "1) 콘텐츠 타입" 부분에는 반드시 "- Type B"라고만 작성하세요.`

      userPrompt = `⚠️ 필수 확인사항:
1. 콘텐츠 타입은 이미 Type B로 결정되어 있습니다. 이것은 변경할 수 없습니다.
2. 주제를 분석하거나 타입을 선택하지 마세요. 타입은 이미 Type B로 결정되어 있습니다.
3. "1) 콘텐츠 타입" 부분에는 반드시 "- Type B"라고만 작성하세요.

[기획할 주제]: ${topic}

Type B (컴필레이션 / 목록형)의 구조와 특징에 맞게 기획안을 작성하세요.
주제는 기획안을 작성할 때 사용하는 정보일 뿐입니다. 주제를 분석하거나 타입을 선택하지 마세요.

Type B 작성 방법:
- 하나의 대주제 아래 3~5개의 사례를 나열하세요
- 각 사례는 미니 스토리 구조로 작성하세요
- 목록형 구조로 체계적으로 전개하세요
- 대주제 소개 → 사례 1 → 사례 2 → 사례 3 → 통찰/교훈 순서로 구성하세요
- Type A처럼 하나의 이야기에 집중하지 마세요
- Type C처럼 여러 관점으로 분석하지 마세요`

    } else if (contentType === "C") {
      // Type C 선택됨 → Type C 전용 프롬프트 생성
      console.log("[generateScriptPlan] ✅ Type C 분기 진입 - Type C 전용 프롬프트 생성")
      
      systemPrompt = `${baseSystemPrompt}

────────────────────────
[Type C. 다각도 탐구형 - 필수 구조]
────────────────────────
⚠️ 매우 중요: 이 기획안은 반드시 Type C (다각도 탐구형) 구조로 작성해야 합니다.

Type C의 핵심 원칙:
1. 하나의 대상을 여러 관점으로 분석합니다
   - 역사적 관점
   - 사회적 관점
   - 경제적 관점
   - 문화적 관점
   - 심리적 관점 등
2. 논리적 흐름을 중심으로 구성합니다
   - 각 관점이 논리적으로 연결됨
   - 점층적으로 깊이를 더해감
3. 점층적 몰입 구조를 설계합니다
   - 표면적 이해 → 깊은 통찰
   - 단순한 사실 → 복합적 의미
4. 본론 구성 설계 시:
   - 대상 소개
   - 관점 1: [예: 역사적 배경]
   - 관점 2: [예: 사회적 영향]
   - 관점 3: [예: 경제적 측면]
   - 관점 4: [예: 문화적 의미]
   - 종합적 통찰

❌ Type C에서 하지 말아야 할 것:
- Type A처럼 하나의 이야기에 집중하는 것
- Type B처럼 여러 사례를 나열하는 것
- 단일 서사나 목록형 구조를 사용하는 것

기획안의 "1) 콘텐츠 타입" 부분에는 반드시 "- Type C"라고만 작성하세요.`

      userPrompt = `⚠️ 필수 확인사항:
1. 콘텐츠 타입은 이미 Type C로 결정되어 있습니다. 이것은 변경할 수 없습니다.
2. 주제를 분석하거나 타입을 선택하지 마세요. 타입은 이미 Type C로 결정되어 있습니다.
3. "1) 콘텐츠 타입" 부분에는 반드시 "- Type C"라고만 작성하세요.

[기획할 주제]: ${topic}

Type C (다각도 탐구형)의 구조와 특징에 맞게 기획안을 작성하세요.
주제는 기획안을 작성할 때 사용하는 정보일 뿐입니다. 주제를 분석하거나 타입을 선택하지 마세요.

Type C 작성 방법:
- 하나의 대상을 여러 관점으로 분석하세요 (역사적, 사회적, 경제적, 문화적 등)
- 논리적 흐름을 중심으로 구성하세요
- 점층적 몰입 구조로 설계하세요 (표면적 이해 → 깊은 통찰)
- 대상 소개 → 관점 1 → 관점 2 → 관점 3 → 종합적 통찰 순서로 구성하세요
- Type A처럼 하나의 이야기에 집중하지 마세요
- Type B처럼 여러 사례를 나열하지 마세요`

    } else if (contentType === "D") {
      // Type D 선택됨 → Type D 전용 프롬프트 생성
      console.log("[generateScriptPlan] ✅ Type D 분기 진입 - Type D 전용 프롬프트 생성")
      
      systemPrompt = `${baseSystemPrompt}

═══════════════════════════════════════════════════════════════
🚨🚨🚨 절대 필수: Type D (이야기형) 구조로만 작성하세요 🚨🚨🚨
═══════════════════════════════════════════════════════════════

⚠️⚠️⚠️ 매우 중요: 이 기획안은 반드시 Type D (이야기형) 구조로 작성해야 합니다.
⚠️ 주제가 역사적 인물이든, 사건이든, 무엇이든 상관없이 Type D 구조로 작성하세요.
⚠️ 주제를 분석해서 타입을 선택하지 마세요. 타입은 이미 Type D로 결정되어 있습니다.
⚠️ Type A (단일 서사 심층형)는 절대 사용하지 마세요. Type D만 사용하세요.

────────────────────────
[Type D. 이야기형 (옛날이야기/민담) - 필수 구조]
────────────────────────

Type D의 핵심 원칙 (반드시 준수):
1. "옛날 옛날에...", "한 옛날에...", "예전에..." 같은 전래동화/민담 형식으로 기획합니다
   - 반드시 이야기 형식으로 시작해야 합니다
   - 설명문이나 분석문 형식은 절대 사용하지 마세요
2. 등장인물 중심으로 구성합니다
   - 주인공: 명확한 성격과 목표를 가진 인물
   - 조연: 주인공을 돕는 인물들
   - 악역 또는 시련: 갈등의 원인
3. 사건 전개 구조를 따릅니다
   - 시작: 주인공과 배경 소개 ("옛날 옛날에...")
   - 사건 발생: 문제나 시련의 시작
   - 갈등/시련: 주인공이 겪는 어려움
   - 해결: 문제 해결 과정
   - 교훈/결말: 이야기의 의미와 교훈
4. 재미 요소를 포함합니다
   - 흥미진진한 전개
   - 반전 요소
   - 자연스러운 교훈
5. 옛날 할머니/할아버지가 손자에게 들려주는 듯한 따뜻하고 재미있는 이야기꾼 톤

❌❌❌ Type D에서 절대 하지 말아야 할 것:
- Type A (단일 서사 심층형) 구조 사용 - 절대 금지
- Type B (목록형) 구조 사용 - 절대 금지
- Type C (다각도 탐구형) 구조 사용 - 절대 금지
- 에세이 형식 (설명문, 논설문, 분석문 형식 절대 금지)
- 역사적 사실을 그대로 나열하는 형식 - 절대 금지
- "세종대왕은..." 같은 설명문 형식 - 절대 금지

✅✅✅ 반드시 해야 할 것:
- "옛날 옛날에 세종대왕이라는 왕이 살았습니다..." 같은 이야기 형식으로 시작
- 등장인물(세종대왕, 조선의 신하들 등)을 중심으로 이야기 구성
- 사건 전개 구조 (시작 → 사건 → 갈등 → 해결 → 교훈)
- 기획안의 "1) 콘텐츠 타입" 부분에는 반드시 "- Type D"라고만 작성하세요.`

      userPrompt = `🚨🚨🚨 절대 필수 확인사항 🚨🚨🚨
1. 콘텐츠 타입은 이미 Type D로 결정되어 있습니다. 이것은 변경할 수 없습니다.
2. 주제를 분석하거나 타입을 선택하지 마세요. 타입은 이미 Type D로 결정되어 있습니다.
3. "1) 콘텐츠 타입" 부분에는 반드시 "- Type D"라고만 작성하세요.
4. Type A, B, C는 절대 사용하지 마세요.

[기획할 주제]: ${topic}

Type D (이야기형)의 구조와 특징에 맞게 기획안을 작성하세요.
주제는 기획안을 작성할 때 사용하는 정보일 뿐입니다. 주제를 분석하거나 타입을 선택하지 마세요.

Type D 작성 방법:
- "옛날 옛날에...", "한 옛날에..." 같은 전래동화/민담 형식으로 시작하세요
- 등장인물 중심으로 구성하세요 (주인공, 조연, 악역 등)
- 사건 전개 구조를 따르세요: 시작 → 사건 발생 → 갈등/시련 → 해결 → 교훈/결말
- 재미 요소를 포함하세요 (흥미진진함, 반전, 교훈)
- 옛날 할머니/할아버지가 손자에게 들려주는 듯한 따뜻하고 재미있는 이야기꾼 톤으로 작성하세요
- 에세이 형식은 절대 사용하지 마세요 (설명문, 논설문, 분석문 형식 금지)
- Type A처럼 역사적 사실을 나열하는 형식은 절대 사용하지 마세요
- Type B처럼 여러 사례를 나열하는 형식은 절대 사용하지 마세요
- Type C처럼 여러 관점으로 분석하는 형식은 절대 사용하지 마세요

예시:
❌ 잘못된 형식: "세종대왕은 조선의 제4대 왕으로, 한글을 창제한 위대한 성군이었습니다..."
✅ 올바른 형식: "옛날 옛날에, 조선이라는 나라에 세종대왕이라는 지혜로운 왕이 살았습니다. 그 왕은 백성들을 사랑하는 마음이 깊었는데..."`

    } else if (contentType === "custom" && customContentTypeDescription) {
      // 커스텀 타입 선택됨 → 커스텀 타입 전용 프롬프트 생성
      console.log("[generateScriptPlan] ✅ 커스텀 타입 분기 진입 - 커스텀 타입 전용 프롬프트 생성")
      
      // 커스텀 타입은 baseSystemPrompt의 형식 제약을 완화하고 사용자 구조를 최우선으로 반영
      const customBaseSystemPrompt = `당신은 '지식 스토리텔링 전문 기획자'입니다.

당신의 임무는 사용자가 지정한 커스텀 구조에 정확히 맞게,
본격적인 대본 작성을 위한 '대본 기획안(스토리 설계도)'을 만드는 것입니다.

⚠️⚠️⚠️ 매우 중요: 
- 사용자가 지정한 커스텀 구조를 최우선으로 반영하세요.
- 다른 타입(A, B, C, D)의 구조나 형식을 사용하지 마세요.
- 사용자가 지정한 구조의 형식, 단계, 흐름을 그대로 따르세요.

이 단계에서는 완성된 대본을 쓰지 않습니다.
대신, 이후 단계에서 대본 생성 AI가 흔들리지 않도록
이야기의 구조, 감정 흐름, 핵심 포인트를 명확히 설계해야 합니다.

────────────────────────
[채널 및 콘텐츠 정체성]
────────────────────────
- 채널 성격: 역사·사회·경제·미스터리·전쟁사 기반의 지식 스토리텔링
- 타깃: 한국인 성인 시청자
- 톤: 친근하지만 가볍지 않음, 이야기꾼의 구어체, 몰입감 최우선
- 목표: 정보 전달이 아니라 '끝까지 보게 만드는 흐름' 설계

────────────────────────
[기획 핵심 원칙]
────────────────────────
1) 이탈 방지 최우선
- 초반 30초 안에 반드시 '강력한 궁금증'을 유발해야 함
- 중간중간 "이 다음을 보지 않으면 안 될 이유"를 설계

2) 사실 기반 + 신뢰도 최우선 (중요)
- 허구의 주인공/가상 인물/드라마적 운명 교차/로맨스/과장된 배신극을 절대 사용하지 마십시오.
- 역사·외교·전쟁 주제는 "실존 국가/실존 인물(필요 시)/결정 구조/외교 흐름/기록에 근거한 사건" 중심으로 기획하십시오.
- 확실하지 않은 정보는 단정하지 말고, "~로 알려져 있다/기록에 따르면/해석이 갈린다"처럼 표현하십시오.

3) 장면화 가능성 고려
- 이후 이 기획안은 '장면 단위 이미지 생성'으로 확장됨
- 추상적인 설명만 나열하지 말고, 장면·상황·사람이 떠오르도록 구성

4) 과도한 정보 나열 금지
- 사실은 이야기 속에 녹여서 배치
- "설명"보다 "상황 → 의미" 구조를 우선

────────────────────────
[커스텀 타입 - 필수 구조]
────────────────────────
⚠️⚠️⚠️ 절대 필수: 사용자가 지정한 커스텀 구조를 정확히 따르세요.

[사용자가 지정한 커스텀 구조]:
${customContentTypeDescription}

이 구조에 따라 기획안을 작성하세요:
- 사용자가 명시한 전개 방식, 핵심 포인트, 구조를 정확히 반영
- 사용자가 지정한 단계, 흐름, 형식을 그대로 따르세요
- 사용자가 요청하지 않은 요소는 추가하지 않음
- 다른 타입(A, B, C, D)의 구조를 사용하지 마세요
- 사용자가 지정한 구조의 형식에 맞춰 기획안을 작성하세요

────────────────────────
[기획 산출물 형식]
────────────────────────
⚠️ 중요: 사용자가 지정한 커스텀 구조에 형식이 명시되어 있다면, 그 형식을 우선적으로 따르세요.
형식이 명시되지 않았다면, 아래 기본 형식을 사용하되 커스텀 구조의 내용을 반영하세요.

1) 콘텐츠 타입
- 커스텀 타입

2) 전체 이야기 한 줄 요약
- 이 영상이 "결국 어떤 이야기를 하려는지"를 한 문장으로

3) 오프닝 기획
- 초반 훅의 핵심 질문 또는 충격 포인트
- 시청자가 왜 이 영상을 계속 봐야 하는지

4) 본론 구성 설계
- 사용자가 지정한 커스텀 구조의 단계별 흐름을 반영
- 각 단계마다:
  · 다루는 핵심 내용
  · 감정 방향 (불안 / 긴장 / 충격 / 공감 / 희망 등)
  · 장면화 가능한 포인트 (사람, 상황, 공간, 상징 오브젝트)

5) 클라이맥스 / 핵심 메시지
- 이야기의 정점
- 시청자의 감정이 가장 크게 움직여야 하는 지점

6) 아웃트로 설계
- 오늘 이야기가 '지금 우리에게 왜 중요한지'
- 여운을 남기는 마무리 방향
- 다음 영상으로 자연스럽게 이어지는 문장(기획 관점)

────────────────────────
[출력 제한]
────────────────────────
- 아직 '대본 문장'을 쓰지 마십시오.
- 실제 내레이션 문장, 대사, TTS용 문구는 절대 포함하지 마십시오.
- 설명은 기획자의 시점에서 서술하십시오.
- 제작자 노트, 체크리스트, 파트 구분, 글자수 등은 절대 포함하지 마십시오.
- 오직 기획안만 출력하십시오. 추가 설명이나 메타 정보는 포함하지 마십시오.`

      userPrompt = `⚠️⚠️⚠️ 절대 필수 확인사항:
1. 콘텐츠 타입은 이미 커스텀 타입으로 결정되어 있습니다. 이것은 변경할 수 없습니다.
2. 주제를 분석하거나 타입을 선택하지 마세요. 타입은 이미 커스텀 타입으로 결정되어 있습니다.
3. 사용자가 지정한 커스텀 구조를 정확히 따르세요. 다른 타입(A, B, C, D)의 구조를 사용하지 마세요.
4. 사용자가 지정한 구조의 형식, 단계, 흐름을 그대로 반영하세요.

[기획할 주제]: ${topic}

[사용자가 지정한 커스텀 구조]:
${customContentTypeDescription}

⚠️⚠️⚠️ 매우 중요:
- 위에 명시된 커스텀 구조를 정확히 따르세요.
- 커스텀 구조에 명시된 단계, 흐름, 형식을 그대로 반영하세요.
- 커스텀 구조에 "초반 15초 구조", "중반 전개 구조", "후반 마무리 구조" 등이 명시되어 있다면, 그 구조를 정확히 따르세요.
- 커스텀 구조에 "시청자의 ○○ 감정을 자극하며 ○○을 제기하는 구조" 같은 형식이 있다면, 그 형식을 그대로 사용하세요.
- 다른 타입(A, B, C, D)의 구조나 형식을 사용하지 마세요.
- 주제는 기획안을 작성할 때 사용하는 정보일 뿐입니다. 주제를 분석하거나 타입을 선택하지 마세요.`

    } else {
      // 타입이 선택되지 않았거나 잘못된 경우
      console.error("[generateScriptPlan] ❌ 타입 분기 실패!")
      console.error("[generateScriptPlan] contentType:", contentType)
      console.error("[generateScriptPlan] customContentTypeDescription:", customContentTypeDescription)
      throw new Error(`콘텐츠 타입이 올바르게 선택되지 않았습니다. contentType: ${contentType}`)
    }
    
    console.log("[generateScriptPlan] ========== 타입 분기 완료 ==========")
    console.log("[generateScriptPlan] systemPrompt 길이:", systemPrompt.length)
    console.log("[generateScriptPlan] userPrompt 길이:", userPrompt.length)

    // 카테고리별 추가 지시사항
    if (category === "folktale") {
      userPrompt += `

⚠️⚠️⚠️ 매우 중요: 이 주제는 "옛날이야기(민담)" 카테고리입니다.

반드시 다음을 준수하세요:
1. 에세이 형식 절대 금지 - 설명문, 논설문, 분석문 형식은 사용하지 마세요.
2. 이야기 형식 필수 - "옛날 옛날에...", "한 옛날에..." 같은 전래동화/민담 형식으로 기획하세요.
3. 등장인물 중심 - 주인공, 조연 등 명확한 등장인물을 설정하고 그들의 이야기를 중심으로 구성하세요.
4. 사건 전개 구조 - 시작 → 사건 발생 → 갈등/시련 → 해결 → 교훈/결말의 이야기 구조를 따르세요.
5. 재미 요소 - 이야기의 흥미진진함, 반전, 교훈이 자연스럽게 녹아있어야 합니다.
6. 레퍼런스 대본 준수 - 레퍼런스 대본이 제공되면, 그 이야기 형식을 정확히 따르세요.

이 기획안은 반드시 "재미있는 이야기" 형식으로 작성되어야 하며, 에세이 형식으로 작성되면 안 됩니다.`
    }

    // 레퍼런스 대본 추가
    if (referenceScript) {
      userPrompt += `

[레퍼런스 대본]:
${referenceScript}

${category === "folktale" ? `⚠️ 레퍼런스 대본의 이야기 형식, 톤, 구조를 정확히 따르세요. 레퍼런스 대본이 이야기 형식이면, 기획안도 반드시 이야기 형식으로 작성하세요.` : "위 레퍼런스 대본을 참고하여 기획안을 작성하세요."}`
    }

    // 재시도 로직 (최대 3번, exponential backoff)
    let lastError: Error | null = null
    const maxRetries = 3
    const baseDelay = 1000 // 1초

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = baseDelay * Math.pow(2, attempt - 1) // 1초, 2초, 4초
          console.log(`[대본 기획] 재시도 ${attempt}/${maxRetries - 1} - ${delay}ms 후 재시도...`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }

        // 디버깅: 프롬프트 확인
        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`
        if (contentType) {
          console.log(`[generateScriptPlan] Type ${contentType} 선택됨 - 프롬프트 확인:`)
          console.log(`  - systemPrompt에 "Type ${contentType}" 포함: ${systemPrompt.includes(`Type ${contentType}`)}`)
          console.log(`  - userPrompt에 "Type ${contentType}" 포함: ${userPrompt.includes(`Type ${contentType}`)}`)
          // 프롬프트의 처음 2000자 출력
          console.log(`  - systemPrompt 처음 2000자:`, systemPrompt.substring(0, 2000))
          console.log(`  - userPrompt 처음 2000자:`, userPrompt.substring(0, 2000))
        }

        // Gemini API 호출
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: fullPrompt,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: contentType ? 0.1 : 0.7, // 사용자가 타입을 선택한 경우 매우 낮은 temperature로 결정적인 출력 보장
                topK: 20, // 더 결정적인 출력을 위해 topK 낮춤
                topP: 0.9, // 더 결정적인 출력을 위해 topP 낮춤
                maxOutputTokens: 8000,
              },
            }),
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          
          // 503 에러이고 재시도 가능한 경우
          if (response.status === 503 && attempt < maxRetries - 1) {
            try {
              const errorData = JSON.parse(errorText)
              if (errorData.error?.message?.includes("overloaded") || errorData.error?.status === "UNAVAILABLE") {
                lastError = new Error(`Gemini API 서버가 과부하 상태입니다. 재시도 중... (${attempt + 1}/${maxRetries})`)
                continue // 재시도
              }
            } catch (parseError) {
              // JSON 파싱 실패 시에도 503이면 재시도
              lastError = new Error(`Gemini API 서버가 과부하 상태입니다. 재시도 중... (${attempt + 1}/${maxRetries})`)
              continue
            }
          }
          
          throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorText}`)
        }

        // 성공한 경우
        const data = await response.json()
        const candidate = data.candidates?.[0]
        
        if (!candidate) {
          throw new Error("대본 기획을 생성할 수 없습니다. 응답 후보가 없습니다.")
        }

        const content = candidate.content?.parts?.[0]?.text
        const finishReason = candidate.finishReason

        if (!content) {
          throw new Error("대본 기획을 생성할 수 없습니다. 응답 내용이 없습니다.")
        }

        // 응답이 토큰 제한으로 잘렸는지 확인
        if (finishReason === "MAX_TOKENS") {
          console.warn("[대본 기획] ⚠️ 응답이 토큰 제한으로 잘렸을 수 있습니다. maxOutputTokens를 늘려주세요.")
        }

        // 사용자가 타입을 선택한 경우, 생성된 기획안에서 타입을 검증
        if (contentType && contentType !== "custom") {
          const expectedType = `Type ${contentType}`
          const expectedTypeLetter = contentType
          
          // 여러 패턴으로 타입 찾기 시도 (더 정확한 패턴 사용)
          const typePatterns = [
            // "1) 선택한 콘텐츠 타입" 다음 줄에 "Type A. 단일 서사 심층형" 형식
            /1\)\s*선택한\s*콘텐츠\s*타입[^\n]*\n[^\n]*Type\s+([ABCD])\./i,
            // "1) 콘텐츠 타입" 다음 줄에 "- Type X" 형식
            /1\)\s*콘텐츠\s*타입[^\n]*\n[^\n]*[-–—]\s*Type\s+([ABCD])/i,
            // "1) 콘텐츠 타입" 다음 줄에 "Type X" 형식
            /1\)\s*콘텐츠\s*타입[^\n]*\n[^\n]*Type\s+([ABCD])/i,
            // "콘텐츠 타입" 다음에 "Type X" 형식
            /콘텐츠\s*타입[^\n]*Type\s+([ABCD])/i,
            // "Type X. 설명" 형식 (선택한 콘텐츠 타입 섹션에서)
            /선택한\s*콘텐츠\s*타입[^\n]*\n[^\n]*Type\s+([ABCD])\./i,
            // 단순히 "Type X" 형식 (하지만 다른 타입 설명이 아닌 실제 타입 선언 부분)
            /(?:^|\n)\s*[-–—]?\s*Type\s+([ABCD])(?:\s*\(|$)/i
          ]
          
          let foundType: string | null = null
          let foundTypeLetter: string | null = null
          
          for (const pattern of typePatterns) {
            const match = content.match(pattern)
            if (match && match[1]) {
              foundTypeLetter = match[1].toUpperCase()
              foundType = `Type ${foundTypeLetter}`
              console.log(`[대본 기획] 타입 발견: ${foundType} (패턴 매칭 성공)`)
              break
            }
          }
          
          // 타입을 찾지 못한 경우, 더 넓은 범위로 검색
          if (!foundType) {
            const broadPattern = /Type\s+([ABCD])/gi
            const matches = [...content.matchAll(broadPattern)]
            if (matches.length > 0) {
              // 첫 번째 매칭을 사용 (보통 "1) 콘텐츠 타입" 섹션에 있음)
              foundTypeLetter = matches[0][1].toUpperCase()
              foundType = `Type ${foundTypeLetter}`
              console.log(`[대본 기획] 타입 발견 (넓은 검색): ${foundType}`)
            }
          }
          
          if (foundType && foundTypeLetter) {
            if (foundTypeLetter !== expectedTypeLetter) {
              console.error(`[대본 기획] ⚠️ 타입 불일치: 사용자가 ${expectedType}를 선택했지만, 생성된 기획안에는 ${foundType}가 포함되어 있습니다.`)
              console.error(`[대본 기획] 생성된 기획안의 처음 1000자:`, content.substring(0, 1000))
              
              // 타입이 잘못된 경우, 기획안을 강제로 수정
              console.error(`[대본 기획] ⚠️ 타입 불일치 감지. 기획안을 강제로 수정합니다.`)
              
              // "1) 콘텐츠 타입" 섹션을 정확히 찾아서 수정
              let correctedContent = content
              
              // 모든 패턴으로 수정 시도
              const correctionPatterns = [
                // 패턴 1: "1) 선택한 콘텐츠 타입\nType A. 단일 서사 심층형" 형식
                /(1\)\s*선택한\s*콘텐츠\s*타입[^\n]*\n[^\n]*)Type\s+[ABCD]\.[^\n]*/i,
                // 패턴 2: "1) 콘텐츠 타입\n- Type X" 형식
                /(1\)\s*콘텐츠\s*타입[^\n]*\n[^\n]*[-–—]\s*)Type\s+[ABCD]/i,
                // 패턴 3: "1) 콘텐츠 타입\nType X" 형식
                /(1\)\s*콘텐츠\s*타입[^\n]*\n[^\n]*)Type\s+[ABCD]/i,
                // 패턴 4: "선택한 콘텐츠 타입" 같은 변형
                /(선택한\s*콘텐츠\s*타입[^\n]*\n[^\n]*[-–—]?\s*)Type\s+[ABCD]\.[^\n]*/i,
                // 패턴 5: "콘텐츠 타입" 다음에 바로 Type X
                /(콘텐츠\s*타입[^\n]*\n[^\n]*[-–—]?\s*)Type\s+[ABCD]/i,
              ]
              
              for (const pattern of correctionPatterns) {
                correctedContent = correctedContent.replace(
                  pattern,
                  `$1Type ${contentType}`
                )
              }
              
              // 최종 검증: 여전히 잘못된 타입이 있으면 강제로 교체
              const finalCheck = /(1\)\s*[선택한\s]*콘텐츠\s*타입[^\n]*\n[^\n]*[-–—]?\s*)(Type\s+)([ABCD])(\.|$)/i
              if (finalCheck.test(correctedContent)) {
                correctedContent = correctedContent.replace(
                  finalCheck,
                  (match: string, p1: string, p2: string, p3: string, p4: string) => {
                    if (p3 !== contentType) {
                      console.log(`[대본 기획] 타입 ${p3}를 ${contentType}로 교체합니다.`)
                      return `${p1}${p2}${contentType}`
                    }
                    return match
                  }
                )
              }
              
              console.log(`[대본 기획] 기획안 타입을 ${expectedType}로 강제 수정했습니다.`)
              console.log(`[대본 기획] 수정된 기획안의 처음 500자:`, correctedContent.substring(0, 500))
              
              // 재시도하지 않고 바로 수정된 내용 반환
              return correctedContent
            } else {
              console.log(`[대본 기획] ✅ 타입 검증 성공: ${expectedType}`)
            }
          } else {
            console.warn(`[대본 기획] ⚠️ 기획안에서 타입을 찾을 수 없습니다. 사용자가 선택한 타입: ${expectedType}`)
            // 타입이 명시되지 않은 경우, 기획안에 타입을 강제로 추가
            console.log(`[대본 기획] 기획안에 타입을 강제로 추가합니다: ${expectedType}`)
            
            // "1) 콘텐츠 타입" 섹션을 찾아서 수정
            const typeSectionPattern = /(1\)\s*콘텐츠\s*타입[^\n]*\n)([^\n]*)/i
            if (typeSectionPattern.test(content)) {
              // 기존 섹션이 있으면 타입만 수정
              const correctedContent = content.replace(
                typeSectionPattern,
                `$1- Type ${contentType}\n`
              )
              return correctedContent
            } else {
              // 섹션이 없으면 맨 앞에 추가
              const correctedContent = `1) 콘텐츠 타입\n- Type ${contentType}\n\n${content}`
              return correctedContent
            }
          }
        }

        return content
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // 마지막 시도가 아니고 503 에러인 경우에만 재시도
        if (attempt < maxRetries - 1 && lastError.message.includes("503")) {
          continue
        }
        
        // 재시도 불가능한 경우 에러 throw
        throw lastError
      }
    }

    // 모든 재시도 실패
    throw lastError || new Error("대본 기획 생성에 실패했습니다.")
  } catch (error) {
    console.error("대본 기획 생성 실패:", error)
    throw error
  }
}

/**
 * 대본 초안 생성 함수
 */
export async function generateScriptDraft(
  scriptPlan: string,
  topic: string,
  apiKey?: string,
  category?: string,
  isStoryMode: boolean = false, // 스토리 형태 모드 (기본값: false = 교훈형)
  contentType?: "A" | "B" | "C" | "D" | "custom" | null // 사용자가 선택한 콘텐츠 타입
): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }

  try {
    let systemPrompt: string
    let userPrompt: string

    // folktale 카테고리 또는 Type D 선택 시 강제로 스토리 모드로 설정
    const shouldUseStoryMode = isStoryMode || category === "folktale" || contentType === "D"
    
    if (shouldUseStoryMode) {
      // 스토리형 프롬프트
      systemPrompt = `*(2) 대본 작성
${category === "folktale" || contentType === "D" ? `
⚠️⚠️⚠️ 매우 중요: ${category === "folktale" ? '이 대본은 "옛날이야기(민담)" 카테고리입니다.' : contentType === "D" ? '사용자가 Type D (이야기형)를 선택했습니다. 이 대본은 "옛날이야기(민담)" 형식으로 작성되어야 합니다.' : ''}

반드시 다음을 준수하세요:
1. 에세이 형식 절대 금지 - 설명문, 논설문, 분석문 형식은 사용하지 마세요.
2. 이야기 형식 필수 - "옛날 옛날에...", "한 옛날에...", "예전에..." 같은 전래동화/민담 형식으로 작성하세요.
3. 등장인물 중심 - 주인공, 조연, 악역 등 명확한 등장인물을 설정하고 그들의 이야기를 중심으로 구성하세요.
4. 사건 전개 구조 - 시작 → 사건 발생 → 갈등/시련 → 해결 → 교훈/결말의 이야기 구조를 따르세요.
5. 재미 요소 - 이야기의 흥미진진함, 반전, 교훈이 자연스럽게 녹아있어야 합니다.
6. 옛날 할머니/할아버지가 손자에게 들려주는 듯한 따뜻하고 재미있는 이야기꾼 톤을 유지하세요.

이 대본은 반드시 "재미있는 이야기" 형식으로 작성되어야 하며, 에세이 형식으로 작성되면 안 됩니다.` : ""}

너는 지금부터 (유튜브 대본 전문가)야 사람들의 공감을 불러일으켜야 하고 사람들이 너의 이야기를 듣고 싶도록 설명을 해야해.

내 채널은 사연, 이야기를 다루는 채널이니 위 개요를 기반으로 유튜브 대본을 작성해줘.

아래 사항들을 모두 만족시켜야 하고 내가 말한 아래 사항들을 어디에 어떻게 적용했는지 대본과 별도로 제일 밑 "제작자 노트" 공간을 따로 만들어서 체크리스트로 보여줘

#1.컨셉 (Concept)

1.1 시청 타겟은 50~70대 남녀 모두로 사람들의 공감 혹은 궁금함을 불러 일으키는 이야기로 만들어줘, "나에게도 일어날 수 있는/나 혹은 주변 지인에게 필요한 것"이라는 느낌을 줘야한다.

1.2 이야기를 설명하는 화자와 등장인물이 있는데 등장인물의 대사는 큰 따옴표를 이용해 넣어주고 대사의 마지막 부분에 괄호치고 누구의 대사인지, 남자인지 여자인지도 적어줘. 이렇게 하는 이유는 TTS를 사용할 때 등장인물을 구분하기 위해서니 더 좋은 방법이 있다면 그걸로 구분해줘

1.3 톤앤매너, 듣는 사람이 계속 궁금하도록 화자가 화두를 던지고 등장 인물들이 풀어가는 과정을 나타내야한다.

1.4 문장 종결 표현 다양화 (매우 중요)
- 모든 문장이 "~니다"로 끝나지 않도록 다양한 종결 표현을 사용하세요.
- 논리적으로 연결 가능한 문장들은 "~는데", "~했고", "~면서", "~거든요", "~죠", "~거죠", "~겁니다" 등의 연결어로 자연스럽게 이어주세요.
- 호흡이 너무 길어지거나 주제가 전환되는 지점에서는 과감하게 문장을 끊으세요.
- 문장 종결 표현 예시: "~니다", "~네요", "~거든요", "~죠", "~거죠", "~는데", "~했고", "~면서", "~겁니다", "~어요", "~아요" 등을 다양하게 사용하세요.

#2.필수사항 (Mandatory)

2.1 도입부에는 이 이야기의 주제를 기반으로 듣는 시청자들이 뒤의 내용이 궁금해할만한 등장인물의 대사가 등장해야한다. 갈등을 압축한 말이나 행동이 드러나서 궁금증을 사야한다.

2.2 위 개요를 모두 만족시켜야 하고 개요를 기반으로 이야기를 흥미롭게 이어가야 한다.

2.3 분량은 한글 핵심 내용으로 작성해야하며 물음표, 느낌표를 제외한 특수문자나 영어 원문을 그대로 사용하지 않는다.

2.4 등장인물의 심리상태, 감정선이 잘 드러나도록 해줘. 화자는 이것들을 전부 다 짚어내지 말고 시청자가 추측하도록 전개해줘

#3. 커스터마이징 (Customizing)

3.1 대본의 제일 밑 "제작자 노트"에서 발단, 전개, 위기, 절정, 결말, 교훈 파트 구분을 하고 각 파트별 글자수를 적어줘`

      userPrompt = `주제: ${topic}

개요:
${scriptPlan}

위 개요를 기반으로 유튜브 대본을 작성해주세요. 대본 분량은 핵심으로 작성하고, 대본 작성 후 "제작자 노트" 섹션을 별도로 만들어서 위 요구사항들을 어디에 어떻게 적용했는지 체크리스트로 보여줘.`
    } else {
      // 교훈형 프롬프트 (기존)
      systemPrompt = `*(2) 대본 작성

너는 지금부터 (유튜브 대본 전문가)야 사람들의 공감을 불러일으켜야 하고 친절하며 사람들이 너의 이야기를 듣고 싶도록 설명을 해야해.

위 개요를 기반으로 유튜브 대본을 작성해줘.

아래 사항들을 모두 만족시켜야 하고 내가 말한 아래 사항들을 어디에 어떻게 적용했는지 대본과 별도로 제일 밑 "제작자 노트" 공간을 따로 만들어서 체크리스트로 보여줘

#1.컨셉 (Concept)

1.1 시청 타겟은 50~70대 남녀 모두로 사람들의 공감을 불러 일으키는 익숙한 사례와 예시를 넣어 "나에게도 일어날 수 있는/나 혹은 주변 지인에게 필요한 것"이라는 느낌을 줘야한다.

1.2 어려운 표현이 있다면 최대한 이해하기 쉽고 타겟 시청자들이 듣기 불편하지 않도록 해야해. 영어 같은 표현을 써도 좋지만 이게 무슨 의미인지 친절하게 설명해줘야 해.

1.3 등장인물 없이 1인칭으로 설명하기 때문에 듣는 시청자들이 지루하지 않도록 중간에 질문과 답을 통해 혼자서라도 대화하듯이 설명을 이어간다. 

1.4 톤앤매너, 듣는 사람에게 훈계하거나 내가 더 뛰어난 사람으로서 내 말을 들으라는게 아니라 같은 처지인 사람들끼리 좋은 정보를 공유한다는 정중하면서 공감되는 말투를 사용해야한다.

1.5 문장 종결 표현 다양화 (매우 중요)
- 모든 문장이 "~니다"로 끝나지 않도록 다양한 종결 표현을 사용하세요.
- 논리적으로 연결 가능한 문장들은 "~는데", "~했고", "~면서", "~거든요", "~죠", "~거죠", "~겁니다" 등의 연결어로 자연스럽게 이어주세요.
- 호흡이 너무 길어지거나 주제가 전환되는 지점에서는 과감하게 문장을 끊으세요.
- 문장 종결 표현 예시: "~니다", "~네요", "~거든요", "~죠", "~거죠", "~는데", "~했고", "~면서", "~겁니다", "~어요", "~아요" 등을 다양하게 사용하세요.

#2.필수사항 (Mandatory)

2.1 도입부에는 이 유튜브 주제를 기반으로 이 내용을 몰랐을 시 발생하게 되는 문제와 그 문제와 관련된 사례나 경험들에 대해서 언급하고 그런 이유로 이 이야기를 들어야 한다는 것을 설명해야해

2.2 위 개요를 모두 만족시켜야 하고 개요를 기반으로 이야기를 흥미롭게 이어가야 한다.

2.3 분량은 한글 핵심 내용으로 작성해야하며 물음표, 느낌표를 제외한 괄호 혹은 특수문자나 영어 원문을 그대로 사용하지 않는다.

2.4 마지막 마무리는 영상을 요약해서 집중하다 놓친 시청자들이라도 영상에 대해 이해하고 무엇을 알아야하는지, 해야하는지 즉각적으로 기억하기 쉽도록 간략 명료하게 다시 설명해주는 파트를 넣는다.`

      userPrompt = `주제: ${topic}

개요:
${scriptPlan}

위 개요를 기반으로 유튜브 대본을 작성해주세요. 대본 분량은 핵심으로 작성하고, 대본 작성 후 "제작자 노트" 섹션을 별도로 만들어서 위 요구사항들을 어디에 어떻게 적용했는지 체크리스트로 보여줘.`
    }

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
        max_tokens: 4000,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("대본 초안을 생성할 수 없습니다.")
    }

    return content.trim()
  } catch (error) {
    console.error("대본 초안 생성 실패:", error)
    throw error
  }
}

/**
 * 최종 대본 생성 함수 (기본 - GPT-4.1 mini 사용)
 */
/**
 * 대본 부분이 끊어졌는지 확인하는 함수
 */
function checkIfScriptIsTruncated(content: string): { isTruncated: boolean; lastCompleteSentenceEnd: number } {
  if (!content || content.trim().length === 0) {
    return { isTruncated: true, lastCompleteSentenceEnd: -1 }
  }
  
  // 마지막 문장이 완전한 문장으로 끝나는지 확인
  const lastSentenceEnd = Math.max(
    content.lastIndexOf("."),
    content.lastIndexOf("?"),
    content.lastIndexOf("!"),
    content.lastIndexOf("。"),
    content.lastIndexOf("？"),
    content.lastIndexOf("！")
  )
  
  // 마지막 부분 추출 (마지막 100자)
  const lastPart = content.substring(Math.max(0, content.length - 100))
  
  // 마지막 부분에서 문장 부호로 끝나는지 확인
  const endsWithPunctuation = /[.!?。！？]\s*$/.test(lastPart.trim())
  
  // 마지막 부분이 불완전한 단어로 끝나는지 확인 (예: "문제 해", "재조명하" 등)
  const lastWords = lastPart.trim().split(/\s+/)
  const lastWord = lastWords[lastWords.length - 1] || ""
  const secondLastWord = lastWords[lastWords.length - 2] || ""
  const lastTwoWords = lastWords.slice(-2).join(" ")
  
  // 불완전한 단어 패턴 (문장이 중간에 끊긴 경우)
  const incompleteWordPatterns = [
    /^[가-힣]*[하해]$/, // "재조명하", "문제해" 등
    /^[가-힣]*[을를]$/, // "이것을", "그것을" 등
    /^[가-힣]*[이]$/, // "그것이" 등
    /^[가-힣]*[에]$/, // "그곳에" 등
    /^[가-힣]*[와과]$/, // "그것과" 등
    /^[가-힣]*[로]$/, // "그곳으로" 등
    /^[가-힣]*[의]$/, // "그것의" 등
  ]
  
  // 불완전한 구문 패턴 (예: "문제 해", "재조명 하" 등)
  const incompletePhrasePatterns = [
    /문제\s*해$/, // "문제 해"
    /재조명\s*하$/, // "재조명 하"
    /해결\s*하$/, // "해결 하"
    /설명\s*하$/, // "설명 하"
    /이야기\s*하$/, // "이야기 하"
  ]
  
  // 마지막 단어가 불완전한 패턴인지 확인
  const hasIncompleteWord = incompleteWordPatterns.some(pattern => pattern.test(lastWord))
  
  // 마지막 두 단어가 불완전한 구문인지 확인
  const hasIncompletePhrase = incompletePhrasePatterns.some(pattern => pattern.test(lastTwoWords))
  
  // 마지막 단어가 매우 짧고(1-2자) 문장 부호가 없으면 불완전한 것으로 간주
  const hasVeryShortIncompleteWord = lastWord.length > 0 && lastWord.length <= 2 && !/[.!?。！？]$/.test(lastWord) && !endsWithPunctuation
  
  // 마지막 50자 내에 문장 부호가 없거나, 불완전한 단어/구로 끝나면 잘린 것으로 간주
  const isTruncated = !endsWithPunctuation || hasIncompleteWord || hasIncompletePhrase || hasVeryShortIncompleteWord || lastSentenceEnd < content.length - 50
  
  return {
    isTruncated,
    lastCompleteSentenceEnd: lastSentenceEnd > 0 ? lastSentenceEnd + 1 : -1
  }
}

/**
 * 끊어진 부분을 이어서 작성하는 함수
 */
async function continueTruncatedPart(
  partName: string,
  truncatedContent: string,
  scriptDraft: string,
  topic: string,
  previousParts: string,
  partTargetChars: number,
  GPT_API_KEY: string,
  systemPrompt: string,
  isStoryMode: boolean
): Promise<string> {
  const { lastCompleteSentenceEnd } = checkIfScriptIsTruncated(truncatedContent)
  
  // 끊어진 부분 추출 (마지막 완전한 문장 이후)
  const truncatedPart = lastCompleteSentenceEnd > 0 
    ? truncatedContent.substring(lastCompleteSentenceEnd).trim()
    : truncatedContent.trim()
  
  // 마지막 완전한 문장까지의 내용
  const completePart = lastCompleteSentenceEnd > 0 
    ? truncatedContent.substring(0, lastCompleteSentenceEnd).trim()
    : ""
  
  // 끊어진 문장의 시작 부분 (마지막 50자)
  const truncatedSentenceStart = truncatedPart.length > 0 
    ? truncatedPart.substring(0, Math.min(50, truncatedPart.length))
    : ""
  
  console.log(`[v0] ⚠️ ${partName}의 끊어진 부분을 이어서 작성 중... (끊어진 부분: "${truncatedSentenceStart}...")`)
  
  const userPrompt = `주제: ${topic}

대본 초안:
${scriptDraft}

${previousParts ? `이미 작성된 부분:\n${previousParts}\n\n` : ""}
${completePart ? `현재 ${partName}의 완성된 부분:\n${completePart.substring(Math.max(0, completePart.length - 200))}\n\n` : ""}
${truncatedSentenceStart ? `끊어진 문장의 시작:\n"${truncatedSentenceStart}"\n\n` : ""}

위 내용을 이어서 끊어진 문장을 완성하고, ${partName}를 완전히 작성해주세요.

🚨 매우 중요한 요구사항:
1. 끊어진 문장을 먼저 완성해야 합니다. 예를 들어 "이순신 장군이 어떻게 자기 자신을 재조명하"가 끊어졌다면, "이순신 장군이 어떻게 자기 자신을 재조명했는지"처럼 완전한 문장으로 완성해주세요.
2. 이전 내용과 자연스럽게 연결되어야 합니다.
3. 반드시 완전한 문장으로 끝나야 합니다. 문장이 중간에 끊기면 절대 안 됩니다.
4. 마지막 문장은 문장 부호(마침표, 물음표, 느낌표)로 끝나야 합니다.
5. 목표 글자수(약 ${partTargetChars}자)는 참고용이며, 목표보다 조금 넘어가도 상관없습니다. 완전한 문장으로 끝나는 것이 가장 중요합니다.
6. 절대로 글자수를 맞추기 위해 문장을 중간에 끊지 마세요.`

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GPT_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
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
      max_tokens: Math.min(Math.ceil(partTargetChars * 1.5), 16384),
      temperature: 0.8,
    }),
  })

  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status}`)
  }

  const data = await response.json()
  const continuedContent = data.choices?.[0]?.message?.content?.trim()

  if (!continuedContent) {
    return truncatedContent // 재생성 실패 시 원본 반환
  }

  // 완성된 부분 + 이어서 작성된 부분
  const finalContent = completePart 
    ? completePart + " " + continuedContent
    : continuedContent
  
  return finalContent.trim()
}

/**
 * 대본 부분을 생성하고 점검하는 함수
 */
async function generateAndValidateScriptPart(
  partName: string,
  partTargetChars: number,
  scriptDraft: string,
  topic: string,
  previousParts: string,
  GPT_API_KEY: string,
  systemPrompt: string,
  userPromptBase: string,
  isStoryMode: boolean,
  maxRetries: number = 2
): Promise<string> {
  let content = ""
  let attempts = 0
  
  while (attempts < maxRetries) {
    attempts++
    
    const userPrompt = partName === "도입부" 
      ? `${userPromptBase}\n\n이제 ${partName}를 작성해주세요. 

🚨 매우 중요한 지시사항:
- 목표 글자수는 약 ${partTargetChars}자이지만, 이것은 참고용입니다.
- 목표 글자수보다 조금 넘어가도 상관없습니다. 완전한 문장으로 끝나는 것이 훨씬 더 중요합니다.
- 절대로 글자수를 맞추기 위해 문장을 중간에 끊지 마세요. 반드시 완전한 문장으로 끝나야 합니다.
- 도입부는 인사 없이 시작하고, 처음부터 위기감을 강하게 줍니다.`
      : `${userPromptBase}\n\n${previousParts ? `이미 작성된 부분:\n${previousParts.substring(Math.max(0, previousParts.length - 500))}\n\n` : ""}이제 ${partName}를 작성해주세요.

🚨 매우 중요한 지시사항:
- 목표 글자수는 약 ${partTargetChars}자이지만, 이것은 참고용입니다.
- 목표 글자수보다 조금 넘어가도 상관없습니다. 완전한 문장으로 끝나는 것이 훨씬 더 중요합니다.
- 절대로 글자수를 맞추기 위해 문장을 중간에 끊지 마세요. 반드시 완전한 문장으로 끝나야 합니다.
- 이전 내용과 자연스럽게 연결되어야 합니다.`
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
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
        max_tokens: Math.min(Math.ceil(partTargetChars * 1.5), 16384),
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    content = data.choices?.[0]?.message?.content?.trim() || ""

    if (!content) {
      throw new Error(`${partName} 생성에 실패했습니다.`)
    }

    // 끊어진 부분 확인
    const { isTruncated } = checkIfScriptIsTruncated(content)
    
    if (!isTruncated) {
      console.log(`[v0] ✅ ${partName} 생성 완료: ${content.length.toLocaleString()}자 (완전한 문장으로 끝남)`)
      return content
    }
    
    console.log(`[v0] ⚠️ ${partName}가 끊어진 것으로 보입니다. 이어서 작성 시도 ${attempts}/${maxRetries}...`)
    
    // 끊어진 부분을 이어서 작성
    if (attempts < maxRetries) {
      content = await continueTruncatedPart(
        partName,
        content,
        scriptDraft,
        topic,
        previousParts,
        partTargetChars,
        GPT_API_KEY,
        systemPrompt,
        isStoryMode
      )
      
      // 이어서 작성 후 다시 확인
      const recheck = checkIfScriptIsTruncated(content)
      if (!recheck.isTruncated) {
        console.log(`[v0] ✅ ${partName} 이어서 작성 완료: ${content.length.toLocaleString()}자`)
        return content
      }
    }
  }
  
  // 최대 재시도 후에도 끊어지면 마지막 완전한 문장까지만 사용
  const { lastCompleteSentenceEnd } = checkIfScriptIsTruncated(content)
  if (lastCompleteSentenceEnd > 0) {
    console.warn(`[v0] ⚠️ ${partName}가 여전히 끊어져 있습니다. 마지막 완전한 문장까지만 사용합니다.`)
    return content.substring(0, lastCompleteSentenceEnd)
  }
  
  return content
}

export async function generateFinalScript(
  scriptDraft: string,
  topic: string,
  apiKey?: string,
  duration?: number,
  targetChars?: number,
  category?: string,
  isStoryMode: boolean = false // 스토리 형태 모드 (기본값: false = 교훈형)
): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }

  try {
    const durationText = duration ? `${duration}분` : "적절한 분량"
    const charsText = targetChars ? `${targetChars}자` : "적절한 분량"

    // folktale 카테고리는 강제로 스토리 모드로 설정
    const shouldUseStoryMode = isStoryMode || category === "folktale"
    
    let systemPrompt: string

    if (shouldUseStoryMode) {
      // 스토리형 프롬프트
      systemPrompt = `*(3) 글의 재구성, 검수
${category === "folktale" ? `
⚠️⚠️⚠️ 매우 중요: 이 대본은 "옛날이야기(민담)" 카테고리입니다.

반드시 다음을 준수하세요:
1. 에세이 형식 절대 금지 - 설명문, 논설문, 분석문 형식은 사용하지 마세요.
2. 이야기 형식 필수 - "옛날 옛날에...", "한 옛날에...", "예전에..." 같은 전래동화/민담 형식으로 작성하세요.
3. 등장인물 중심 - 주인공, 조연, 악역 등 명확한 등장인물을 설정하고 그들의 이야기를 중심으로 구성하세요.
4. 사건 전개 구조 - 시작 → 사건 발생 → 갈등/시련 → 해결 → 교훈/결말의 이야기 구조를 따르세요.
5. 재미 요소 - 이야기의 흥미진진함, 반전, 교훈이 자연스럽게 녹아있어야 합니다.
6. 옛날 할머니/할아버지가 손자에게 들려주는 듯한 따뜻하고 재미있는 이야기꾼 톤을 유지하세요.

이 대본은 반드시 "재미있는 이야기" 형식으로 작성되어야 하며, 에세이 형식으로 작성되면 안 됩니다.` : ""}

위 유튜브 대본을 가지고 아래 글쓰기 포맷으로 재구성해줘. 

이야기의 특성상 주의, 관심, 문제, 친근감 단계는 너무 길고 장황해서는 안되고 핵심을 담은 내용으로 간결하게 해줘.

#1.글쓰기 포맷 (Format)

A(Attention, 주의) : 영상의 내용을 통찰하는 시청자의 흥미를 이끄는 한 두 문장의 후킹멘트, 예를 들면 등장인물의 충격적인 대사

I(Interest, 관심) : 시청자들이 이 이야기를 왜 들어야하는지를 함축하는 대사, 이걸 몰랐다면 어떤 일이 일어 났을 것이라는 손해, 기회비용을 자극하는 멘트

P(Problem, 문제) : 이 이야기를 하는 나뿐만 아니라 듣는 당신, 시청자 겪게 될지도 모르고 혹은 겪고 있을 문제 

A(Affinity, 친근감) : 등장인물이 겪을 갈등과 문제를 이야기하고 이게 시청자들에게 어떻게 연결되는지에 대한 감정적 공감멘트

B(Body, 본론) : 이전 작성된 대본의 본론, 전개, 위기, 절정, 결말 등 모두를 포함한 부분

A(Action, 행동촉구) :  이야기에 대한 요약과 교훈에 대한 이야기, 내가 앞으로 할 이야기의 가치를 언급하며 직접적인 구독 요청보다는 다음에도 영상에서 만나자는 이야기

#2.검수사항 (Inspection)

2.1 완성된 대본은 내가 요청한 글자수 ${charsText} 정도 써주고 영상길이는 ${durationText} 이상이여야해

2.2 작성된 대본을 가지고 그대로 TTS를 이용할 것이기 때문에 특수문자는 사용하지 말고, 영상을 만들기 위한 순수한 대본만 출력합니다. 제작자 노트나 설명은 절대 포함하지 마세요.

[추가 규정]

- 출력은 반드시 '스크립트 본문만' 제공합니다. (대제목/소제목/해설/코드/타입설명/머리말/꼬리말 전부 금지)

- 전체 분량은 사용자가 선택한만큼 필수이며, 절대 짧아지면 안 됩니다.

- 도입부는 인사 없이 시작하고, 처음부터 위기감을 강하게 줍니다.

- 도입부는 3~5줄로 작성하며, 도입부 각 줄은 100~150자입니다. (도입부 총 300자 이상)

- 도입부가 끝난 뒤 4~6줄 안쪽에서 "이제 이야기해보겠습니다/본론으로 들어가보죠" 같은 전환 문장을 자연스럽게 1회 넣고 본론으로 진행합니다.

- 도입부 이후 모든 줄(문단)은 150~200자 범위로 작성합니다. 한 줄 200자 초과 금지, 100자 미만 금지(특히 50자 이하 절대 금지).

- 전체 줄바꿈(개행)은 100~150개 이내로 제한합니다. (150개 초과 금지)

- 말투는 전부 존댓말이며, ~죠 / ~습니다 / ~일까요? 를 적절히 섞어 리듬을 만듭니다.

- 문장 연결 및 리듬 조절:
  · 논리적으로 연결 가능한 문장들은 "~는데", "~했고", "~면서", "~거든요", "~죠", "~거죠", "~겁니다" 등의 연결어로 자연스럽게 이어주되, 호흡이 너무 길어지거나 주제가 전환되는 지점에서는 과감하게 문장을 끊습니다.
  · 한 문장 안에 2~3개의 정보를 자연스럽게 담되, 청자가 숨을 쉴 타이밍(강조점, 반전, 새로운 주제 시작)에서는 짧은 문장으로 리듬을 바꿔줍니다.
  · 모든 문장이 "~입니다."로 끝나지 않도록 다양한 종결어미를 사용합니다. (~죠, ~거든요, ~는데, ~했고, ~면서, ~거죠, ~겁니다, ~일까요? 등)

- 원본의 문장/표현/어순을 그대로 복사 금지. 같은 사실도 예시·비유·설명방식·전개순서를 바꿔 원본과 30% 이상 겹치지 않게 작성합니다.

- 사실은 유지하되 사례/통계/관점/시간축/구성 순서를 재배치하고, 새로운 각도의 세부 주제를 추가해 원본 대비 최소 50% 차별화합니다.

- 모든 '수치'는 3~5% 범위로 변동해 표기합니다. (단, 역사적 '연도'는 유지)

- 쉬운 단어 위주로 작성합니다. "~이 들어가는" 같은 표현은 항상 "~에서" 형태로 바꿉니다. (예: 38도~40도 → 38도에서 40도)

- 같은 접속어 과다 반복 금지: 

  · "그런데"→ 문제는/놀랍게도/한편/이때/그 순간/그때

  · "하지만"→ 그럼에도/오히려/반면/다만/그렇지만/그러나

  · "거든요"→ ~니까요/~기 때문이죠/~였기에(또는 생략)

  · "~겁니다/거예요"→ ~점이죠/~사실이죠/~라는 점입니다

- '첫째, 둘째' 같은 번호 나열식 구성은 금지하고, 자연스럽게 이어지는 서사로 작성합니다.

- 질문을 던지는 문장에는 반드시 물음표를 사용합니다. "~있을까요."가 아니라 "~있을까요?"로 작성합니다. "~일까요?", "~일까요.", "~있을까요?", "~있을까요." 등 모든 질문 문장은 물음표로 끝나야 합니다.

- 대본은 반드시 요청한 글자수(${charsText})와 영상 길이(${durationText})에 맞춰 완전히 마무리되어야 합니다. 중간에 끊기거나 미완성 상태로 끝나면 안 됩니다. 마지막 문장은 반드시 완전한 문장으로 끝나야 하며, 문장 부호(마침표, 물음표, 느낌표)로 마무리해야 합니다. 대본의 마지막 부분은 시청자에게 자연스럽고 완결된 느낌을 주어야 합니다.

- 대본의 모든 문장은 반드시 완전한 문장으로 끝나야 합니다. 문장이 중간에 끊기거나 미완성 상태로 끝나면 절대 안 됩니다. 예를 들어 "이순신 장군이 어떻게 자기 자신을 재조명하"처럼 문장이 중간에 끊기면 안 됩니다. 반드시 "이순신 장군이 어떻게 자기 자신을 재조명했는지"처럼 완전한 문장으로 끝나야 합니다. 글자수를 맞추기 위해 문장을 중간에 끊는 것은 절대 금지입니다.`
    } else {
      // 교훈형 프롬프트 (기존)
      systemPrompt = `*(3) 글의 재구성, 검수

위 유튜브 대본을 가지고 아래 글쓰기 포맷으로 재구성해줘. 

주의, 관심, 문제, 친근감 단계는 너무 길고 장황해서는 안되고 핵심을 담은 내용으로 간결하게 해줘.

#1.글쓰기 포맷 (Format)

A(Attention, 주의) : 영상의 내용을 통찰하는 시청자의 흥미를 이끄는 한 두 문장의 후킹멘트

I(Interest, 관심) : 내가 이걸 몰랐어서, 이걸 안했다면 어떤 일이 일어 났을 것이라는 손해, 기회비용을 자극하는 이야기

P(Problem, 문제) : 이 이야기를 하는 나뿐만 아니라 듣는 당신, 시청자 겪게 될지도 모르고 혹은 겪고 있을 문제 

A(Affinity, 친근감) : 시청자가 겪게 될, 겪고 있을 문제에 대한 감정적인 공감과 힘듦을 이해하는 멘트들 그리고 문제를 해결하지 않으면 생길 일에 대해 언급, 마지막은 '이 영상에 답/교훈이 있다 절대 손해보지마라'는 이야기, 같은 문제를 겪는 사람이라는 친근함을 기반으로 구독요청

S(Solution, 해결책) : 시청자가 고통을 해결하고 욕구를 해소할 수 있는 해결책/영상의 본론 작성

O(Offer, 제안) : 해결책에 대한 구체적인 제안 혹은 정보 요약

A(Action, 행동촉구) :  지금 내가 말한 이 해결책, 제안을 당장 시작해야하는 이유를 환기, 행동을 촉구하면서 왜 다음에도 이 영상을 봐야하는지 언급하며 직접적인 구독 요청보다는 다음에도 영상에서 만나자는 이야기

#2.검수사항 (Inspection)

2.1 완성된 대본은 내가 요청한 글자수 ${charsText} 정도 써주고 영상길이는 ${durationText} 이상이여야해

2.2 작성된 대본을 가지고 그대로 TTS를 이용할 것이기 때문에 괄호나 대괄호를 사용하지 말고, 영상을 만들기 위한 순수한 대본만 출력합니다. 제작자 노트나 설명은 절대 포함하지 마세요.

주의사항

- 숫자를 읽을때 '1번' -> 한번 으로 변경해줘. 그리고 단위같은것도 한국어로 바로 읽을수있게 해줘 - 년도는 숫자로 해줘. 예를들어 1930년 이렇게. - 나이는 한글로읽는게 아니라 숫자로 이야기해줘. 예를들어 68세.. - 밀리그램 앞에 숫자는 한글이 아니라 숫자로 해줘. 예를들어 400밀리그램.. - 시간을 말할때는 한국어로 말해줘 10시 -> 열시 이렇게말이야.

[추가 규정]

- 출력은 반드시 '스크립트 본문만' 제공합니다. (대제목/소제목/해설/코드/타입설명/머리말/꼬리말 전부 금지)

- 전체 분량은 사용자가 선택한만큼 필수이며, 절대 짧아지면 안 됩니다.

- 도입부는 인사 없이 시작하고, 처음부터 위기감을 강하게 줍니다.

- 도입부는 3~5줄로 작성하며, 도입부 각 줄은 100~150자입니다. (도입부 총 300자 이상)

- 도입부가 끝난 뒤 4~6줄 안쪽에서 "이제 이야기해보겠습니다/본론으로 들어가보죠" 같은 전환 문장을 자연스럽게 1회 넣고 본론으로 진행합니다.

- 도입부 이후 모든 줄(문단)은 150~200자 범위로 작성합니다. 한 줄 200자 초과 금지, 100자 미만 금지(특히 50자 이하 절대 금지).

- 전체 줄바꿈(개행)은 100~150개 이내로 제한합니다. (150개 초과 금지)

- 말투는 전부 존댓말이며, ~죠 / ~습니다 / ~일까요? 를 적절히 섞어 리듬을 만듭니다.

- 문장 연결 및 리듬 조절:
  · 논리적으로 연결 가능한 문장들은 "~는데", "~했고", "~면서", "~거든요", "~죠", "~거죠", "~겁니다" 등의 연결어로 자연스럽게 이어주되, 호흡이 너무 길어지거나 주제가 전환되는 지점에서는 과감하게 문장을 끊습니다.
  · 한 문장 안에 2~3개의 정보를 자연스럽게 담되, 청자가 숨을 쉴 타이밍(강조점, 반전, 새로운 주제 시작)에서는 짧은 문장으로 리듬을 바꿔줍니다.
  · 모든 문장이 "~입니다."로 끝나지 않도록 다양한 종결어미를 사용합니다. (~죠, ~거든요, ~는데, ~했고, ~면서, ~거죠, ~겁니다, ~일까요? 등)

- 원본의 문장/표현/어순을 그대로 복사 금지. 같은 사실도 예시·비유·설명방식·전개순서를 바꿔 원본과 30% 이상 겹치지 않게 작성합니다.

- 사실은 유지하되 사례/통계/관점/시간축/구성 순서를 재배치하고, 새로운 각도의 세부 주제를 추가해 원본 대비 최소 50% 차별화합니다.

- 모든 '수치'는 3~5% 범위로 변동해 표기합니다. (단, 역사적 '연도'는 유지)

- 쉬운 단어 위주로 작성합니다. "~이 들어가는" 같은 표현은 항상 "~에서" 형태로 바꿉니다. (예: 38도~40도 → 38도에서 40도)

- 같은 접속어 과다 반복 금지: 

  · "그런데"→ 문제는/놀랍게도/한편/이때/그 순간/그때

  · "하지만"→ 그럼에도/오히려/반면/다만/그렇지만/그러나

  · "거든요"→ ~니까요/~기 때문이죠/~였기에(또는 생략)

  · "~겁니다/거예요"→ ~점이죠/~사실이죠/~라는 점입니다

- '첫째, 둘째' 같은 번호 나열식 구성은 금지하고, 자연스럽게 이어지는 서사로 작성합니다.

- 질문을 던지는 문장에는 반드시 물음표를 사용합니다. "~있을까요."가 아니라 "~있을까요?"로 작성합니다. "~일까요?", "~일까요.", "~있을까요?", "~있을까요." 등 모든 질문 문장은 물음표로 끝나야 합니다.

- 대본은 반드시 요청한 글자수(${charsText})와 영상 길이(${durationText})에 맞춰 완전히 마무리되어야 합니다. 중간에 끊기거나 미완성 상태로 끝나면 안 됩니다. 마지막 문장은 반드시 완전한 문장으로 끝나야 하며, 문장 부호(마침표, 물음표, 느낌표)로 마무리해야 합니다. 대본의 마지막 부분은 시청자에게 자연스럽고 완결된 느낌을 주어야 합니다.

- 대본의 모든 문장은 반드시 완전한 문장으로 끝나야 합니다. 문장이 중간에 끊기거나 미완성 상태로 끝나면 절대 안 됩니다. 예를 들어 "이순신 장군이 어떻게 자기 자신을 재조명하"처럼 문장이 중간에 끊기면 안 됩니다. 반드시 "이순신 장군이 어떻게 자기 자신을 재조명했는지"처럼 완전한 문장으로 끝나야 합니다. 글자수를 맞추기 위해 문장을 중간에 끊는 것은 절대 금지입니다.`
    }

    // 카테고리별 추가 지시사항 가져오기
    const categoryCustom = category ? (categoryPromptCustomizations[category] || categoryPromptCustomizations.default) : categoryPromptCustomizations.default
    const categoryFinalNote = categoryCustom.final ? `\n\n[카테고리별 추가 지시사항]\n${categoryCustom.final}` : ""

    const userPromptBase = `주제: ${topic}

대본 초안:
${scriptDraft}

위 대본 초안을 ${isStoryMode ? 'AIPABA' : 'AIPASOA'} 포맷으로 재구성해주세요. 

🚨 매우 중요한 요구사항:
1. 글자수는 정확히 요청한 분량으로 작성해주세요. (절대 짧게 끝나면 안 됩니다)
2. 영상 길이는 ${durationText} 이상이어야 합니다.
3. 대본의 모든 문장은 반드시 완전한 문장으로 끝나야 합니다. 문장이 중간에 끊기거나 미완성 상태로 끝나면 절대 안 됩니다. 예를 들어 "이순신 장군이 어떻게 자기 자신을 재조명하"처럼 문장이 중간에 끊기면 안 됩니다. 반드시 "이순신 장군이 어떻게 자기 자신을 재조명했는지"처럼 완전한 문장으로 끝나야 합니다.
4. 대본은 반드시 완전한 문장으로 마무리되어야 합니다. 중간에 끊기거나 미완성 상태로 끝나면 안 됩니다.
5. 마지막 문장은 문장 부호(마침표, 물음표, 느낌표)로 끝나야 하며, 시청자에게 자연스럽고 완결된 느낌을 주어야 합니다.
6. 요청한 분량에 맞춰 대본을 완전히 작성하고, 마지막까지 자연스럽게 마무리해주세요. 모든 문장이 완전한 문장으로 끝나야 합니다.${categoryFinalNote}`

    // 각 부분의 목표 글자 수 계산
    // 도입부: 10%, 본론 5개: 각 14% (총 70%), 결론: 20%
    const introChars = Math.floor((targetChars || 8280) * 0.1) // 10% - 도입부
    const bodyCharsPerChapter = Math.floor(((targetChars || 8280) * 0.7) / 5) // 70%를 5개로 나눔 (각 14%)
    const conclusionChars = (targetChars || 8280) - introChars - (bodyCharsPerChapter * 5) // 나머지 모두 결론에 할당

    console.log("=".repeat(80))
    console.log("[v0] 최종 대본 생성 시작 (단계별 생성 및 점검)")
    console.log(`[v0] 📊 목표 정보:`)
    console.log(`[v0]    - 목표 길이: ${(targetChars || 8280).toLocaleString()}자`)
    console.log(`[v0]    - 영상 시간: ${durationText}`)
    console.log(`[v0] 📋 단계별 목표 글자 수:`)
    console.log(`[v0]    - 도입부: ${introChars.toLocaleString()}자`)
    console.log(`[v0]    - 본론 1~5: 각 ${bodyCharsPerChapter.toLocaleString()}자`)
    console.log(`[v0]    - 결론: ${conclusionChars.toLocaleString()}자`)
    console.log("=".repeat(80))

    const parts: string[] = []
    let previousParts = ""

    // 1. 도입부 생성 및 점검
    console.log("\n[1/7] 도입부 생성 중...")
    const intro = await generateAndValidateScriptPart(
      "도입부",
      introChars,
      scriptDraft,
      topic,
      previousParts,
      GPT_API_KEY,
      systemPrompt,
      userPromptBase,
      isStoryMode,
      2
    )
    parts.push(intro)
    previousParts += intro + "\n\n"
    console.log(`[v0] ✅ 도입부 완료: ${intro.length.toLocaleString()}자\n`)

    // 2. 본론 부분들 생성 및 점검 (5개)
    for (let i = 1; i <= 5; i++) {
      console.log(`\n[${i + 1}/7] 본론 ${i} 생성 중...`)
      const chapter = await generateAndValidateScriptPart(
        `본론 ${i}`,
        bodyCharsPerChapter,
        scriptDraft,
        topic,
        previousParts,
        GPT_API_KEY,
        systemPrompt,
        userPromptBase,
        isStoryMode,
        2
      )
      parts.push(chapter)
      previousParts += chapter + "\n\n"
      console.log(`[v0] ✅ 본론 ${i} 완료: ${chapter.length.toLocaleString()}자\n`)
    }

    // 3. 결론 생성 및 점검
    console.log("\n[7/7] 결론 생성 중...")
    const conclusion = await generateAndValidateScriptPart(
      "결론",
      conclusionChars,
      scriptDraft,
      topic,
      previousParts,
      GPT_API_KEY,
      systemPrompt,
      userPromptBase,
      isStoryMode,
      2
    )
    parts.push(conclusion)
    console.log(`[v0] ✅ 결론 완료: ${conclusion.length.toLocaleString()}자\n`)

    // 모든 부분 합치기
    const finalScript = parts.join("\n\n").trim()
    
    console.log("=".repeat(80))
    console.log(`[v0] ✅ 최종 대본 생성 완료`)
    console.log(`[v0]    - 총 글자 수: ${finalScript.length.toLocaleString()}자`)
    console.log(`[v0]    - 목표 글자 수: ${(targetChars || 8280).toLocaleString()}자`)
    console.log("=".repeat(80))

    return finalScript
  } catch (error) {
    console.error("최종 대본 생성 실패:", error)
    throw error
  }
}

/**
 * 대본 기획안 개선 함수
 */
export async function improveScriptPlan(
  scriptPlan: string,
  improvementRequest: string
): Promise<string> {
  const GPT_API_KEY = process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
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
            content: "당신은 대본 기획안 개선 전문가입니다. 사용자의 요청에 따라 대본 기획안을 개선해주세요.",
          },
          {
            role: "user",
            content: `현재 기획안:\n${scriptPlan}\n\n개선 요청: ${improvementRequest}\n\n위 요청에 따라 기획안을 개선해주세요.`,
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
    const improvedPlan = data.choices?.[0]?.message?.content

    if (!improvedPlan) {
      throw new Error("개선된 기획안을 생성할 수 없습니다.")
    }

    return improvedPlan
  } catch (error) {
    console.error("대본 기획안 개선 실패:", error)
    throw error
  }
}

/**
 * 대본 기획안 분석 함수
 */
export async function analyzeScriptPlan(
  scriptPlan: string,
  apiKey?: string
): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
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
            content: "당신은 대본 기획안 분석 전문가입니다. 주어진 기획안을 분석하여 강점, 약점, 개선점을 제시해주세요.",
          },
          {
            role: "user",
            content: `다음 대본 기획안을 분석해주세요:\n\n${scriptPlan}`,
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
    const analysis = data.choices?.[0]?.message?.content

    if (!analysis) {
      throw new Error("분석 결과를 생성할 수 없습니다.")
    }

    return analysis
  } catch (error) {
    console.error("대본 기획안 분석 실패:", error)
    throw error
  }
}

/**
 * Gemini API를 사용한 전체 대본 생성 함수
 * duration에 따라 다른 프롬프트 사용
 */
export async function generateFullScript(
  scriptPlan: string,
  topic: string,
  category: string,
  apiKey?: string,
  videoDurationMinutes?: number // 영상 길이 (분)
): Promise<string> {
  const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.")
  }

  const duration = videoDurationMinutes || 5 // 기본값 5분
  const totalCharacters = duration * 300 // 1분당 약 300자 (TTS 기준)

  try {
    let systemPrompt = ""
    let userPrompt = ""

    // duration에 따라 다른 프롬프트 사용
    if (duration === 5) {
      // 5분 선택 시 제공된 프롬프트 사용
      systemPrompt = `당신은 '대본 기획안을 정확히 구현하는 전문 내레이션 작가'입니다.

당신의 역할은 아래에 제공되는 '대본 기획안'을
의미, 구조, 순서, 감정 흐름, 장면 설계를 절대 변경하지 않고
오직 TTS 전용 내레이션 스크립트로 변환하는 것입니다.

당신은 창작자가 아니라 구현자입니다.
기획안을 해석하거나 재구성하지 말고,
설계도를 가장 자연스럽고 몰입도 높은 말로 풀어내십시오.

────────────────────────
[절대 준수 원칙]
────────────────────────
1) 기획안의 구조, 전개 순서, 핵심 메시지는 절대 변경하지 마십시오.
2) 기획안에 없는 관점, 주장, 결론을 추가하지 마십시오.
3) 주제의 성격은 이미 기획안에 반영되어 있으므로
   주제를 분석하거나 판단하지 마십시오.
4) 모든 문장은 존댓말로 작성하십시오.
5) 설명, 해설, 제목, 소제목 없이 오직 스크립트만 출력하십시오.

────────────────────────
[분량 및 형식 강제 규칙 – 5분]
────────────────────────
- 전체 분량은 반드시 2,070자 이상 2,300자 이내여야 합니다.
- 줄바꿈 개수는 18줄 이상 22줄 이내로 제한합니다.
- 한 줄당 글자 수는 반드시 130자 이상 220자 이내여야 합니다.
- 위 조건 중 하나라도 어기면 실패입니다.

────────────────────────
[문체 및 말투 규칙]
────────────────────────
- "~죠", "~습니다", "~일까요?", "문제는", "놀랍게도", "그 순간"
  같은 구어적 존댓말 어투를 자연스럽게 섞어 사용하십시오.
- 말투는 친근하지만 가볍지 않아야 하며,
  설명하는 사람이 아닌 이야기꾼의 흐름을 유지하십시오.
- 질문형 문장은 초반과 전환부에서만 제한적으로 사용하십시오.

────────────────────────
[원본 차단 및 재구성 규칙]
────────────────────────
- 원본의 문장 구조, 어순, 표현을 그대로 사용하지 마십시오.
- 동일한 내용을 다루더라도
  예시, 비유, 설명 방식은 완전히 다르게 구성하십시오.
- 원본 문장과의 표현 유사도는 30%를 초과해서는 안 됩니다.
- 팩트는 유지하되, 전달 순서와 이야기 흐름은 재배치하십시오.
  (예: 결론→근거 구조를 근거→결론 구조로 변경)

────────────────────────
[스토리 전개 규칙]
────────────────────────
- 전체 이야기를 파악한 뒤,
  초반에는 자극적이되 대중적인 넓은 화두로 시작하십시오.
- 본격적인 이야기 시작을 알리는 문장은
  전체 초반 4~6줄 사이에 자연스럽게 삽입하십시오.
- 이후 본론으로 부드럽게 진입하십시오.

────────────────────────
[문장 리듬 및 호흡]
────────────────────────
- 평균 문장 길이는 원본과 다르게 가져가십시오.
- 원본이 짧은 문장이 많다면 상대적으로 긴 문장을 사용하고,
  원본이 나열식이라면 설명형 문장 위주로 재구성하십시오.
- 같은 호흡의 문장이 연속되지 않도록 조절하십시오.

────────────────────────
[표현 다양화 강제 규칙]
────────────────────────
- "거든요"는 과다 사용하지 말고
  "~니까요", "~기 때문이죠", "~였기에" 등으로 분산하십시오.
- "그런데"는 반복하지 말고
  "문제는", "놀랍게도", "한편", "이때", "그 순간" 등으로 대체하십시오.
- "하지만"은
  "그럼에도", "반면", "다만", "오히려", "그러나" 등으로 분산하십시오.
- "~겁니다 / ~거예요"는
  "~점이죠", "~사실이죠", "~라는 점입니다" 등으로 다양화하십시오.

────────────────────────
[개념 설명 및 수치 처리 규칙]
────────────────────────
- 핵심 개념 설명 시,
  원본과 완전히 다른 비유와 이미지로 설명하십시오.
- 모든 수치는 3~5% 범위 내에서 조정하여 사용하십시오.
- 명확한 역사적 연도는 유지하십시오.
- 한자어·고유명사는 가능한 한 풀어쓰거나 동의어로 대체하십시오.

────────────────────────
[출력 제한]
────────────────────────
- 괄호, 대괄호, 따옴표 사용 금지
- 목록형 문장, 번호 매기기 금지
- 메타 설명, 제작자 코멘트, 지시문 금지
- 이모지, 특수기호, 해시태그 사용 금지

────────────────────────
[시간 구간 지시 – 5분]
────────────────────────
아래 기획안을 바탕으로
전체 영상 중 0분부터 5분 구간에 해당하는
대본만 작성하십시오.

────────────────────────
[최종 지시]
────────────────────────
기획안은 이미 완성된 설계도입니다.
당신은 이를 기반으로
중간에 멈출 수 없는 흐름의
완성된 내레이션 스크립트를 작성하십시오.

조건을 지키는 것보다
자연스럽게 지키는 것이 더 중요합니다.
그러나 조건을 어기지는 마십시오.`

      userPrompt = `주제: ${topic}
카테고리: ${category}

기획안:
${scriptPlan}

위 기획안을 바탕으로 정확히 5분 분량(2,070자 이상 2,300자 이내)의 완성도 높은 대본을 작성해주세요. 대본만 작성하고 다른 설명은 하지 마세요.`
    } else {
      // 다른 duration의 경우 기존 프롬프트 사용 (추후 확장 가능)
      systemPrompt = `당신은 롱폼 비디오 대본 작성 전문가입니다. 기획안을 바탕으로 완성도 높은 대본을 작성해주세요.

요구사항:
- 자연스럽고 매력적인 대화체
- 기획안의 구조를 따르되 유연하게 작성
- 시청자의 관심을 유지하는 흐름
- 섹션 헤더나 제목 없이 순수한 대본 내용만 작성
- 총 영상 길이: 정확히 ${duration}분 (약 ${totalCharacters}자)
- 대본 전체 분량: ${totalCharacters}자 내외로 작성

문장 종결 표현 다양화 (매우 중요):
- 모든 문장이 "~니다"로 끝나지 않도록 다양한 종결 표현을 사용하세요.
- 논리적으로 연결 가능한 문장들은 "~는데", "~했고", "~면서", "~거든요", "~죠", "~거죠", "~겁니다" 등의 연결어로 자연스럽게 이어주세요.
- 호흡이 너무 길어지거나 주제가 전환되는 지점에서는 과감하게 문장을 끊으세요.
- 문장 종결 표현 예시: "~니다", "~네요", "~거든요", "~죠", "~거죠", "~는데", "~했고", "~면서", "~겁니다", "~어요", "~아요" 등을 다양하게 사용하세요.`

      userPrompt = `주제: ${topic}
카테고리: ${category}
영상 길이: ${duration}분 (약 ${totalCharacters}자)

기획안:
${scriptPlan}

위 기획안을 바탕으로 정확히 ${duration}분 분량(약 ${totalCharacters}자)의 완성도 높은 대본을 작성해주세요. 대본만 작성하고 다른 설명은 하지 마세요.`
    }

    // Gemini API 호출
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\n${userPrompt}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]
    
    if (!candidate) {
      throw new Error("대본 생성에 실패했습니다. 응답 후보가 없습니다.")
    }

    const content = candidate.content?.parts?.[0]?.text

    if (!content) {
      throw new Error("대본을 생성할 수 없습니다.")
    }

    return content.trim()
  } catch (error) {
    console.error("대본 생성 실패:", error)
    throw error
  }
}

/**
 * 유튜브 제목 생성 함수
 */
export async function generateYouTubeTitles(
  script: string,
  category: string,
  apiKey?: string
): Promise<string[]> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
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
            content: "당신은 유튜브 제목 생성 전문가입니다. 대본을 분석하여 클릭률이 높은 제목 10개를 생성해주세요.",
          },
          {
            role: "user",
            content: `카테고리: ${category}\n\n대본:\n${script.substring(0, 2000)}\n\n위 대본을 분석하여 유튜브 제목 10개를 생성해주세요. 각 제목은 한 줄로 작성해주세요.`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.9,
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

    const lines = content.split("\n").filter((line: string) => line.trim())
    const titles: string[] = []
    
    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)$/)
      if (match && match[1]) {
        titles.push(match[1].trim())
      }
      if (titles.length >= 10) break
    }

    return titles.length > 0 ? titles : ["매력적인 제목 1", "매력적인 제목 2"]
  } catch (error) {
    console.error("제목 생성 실패:", error)
    throw error
  }
}

/**
 * 썸네일 텍스트 생성 함수
 */
export async function generateThumbnailText(
  script: string,
  title?: string,
  apiKey?: string
): Promise<{ line1: string; line2: string }> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
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
            content: "당신은 썸네일 텍스트 생성 전문가입니다. 대본을 분석하여 썸네일에 적합한 짧고 임팩트 있는 텍스트 2줄을 생성해주세요.",
          },
          {
            role: "user",
            content: `대본:\n${script.substring(0, 2000)}\n${title ? `제목: ${title}` : ""}\n\n위 대본을 분석하여 썸네일용 텍스트 2줄을 생성해주세요. 각 줄은 5-10자 내외로 작성해주세요. JSON 형식으로 {"line1": "첫 줄", "line2": "둘째 줄"}로 응답해주세요.`,
          },
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("썸네일 텍스트를 생성할 수 없습니다.")
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        line1: parsed.line1 || "첫 줄",
        line2: parsed.line2 || "둘째 줄",
      }
    }

    return { line1: "첫 줄", line2: "둘째 줄" }
  } catch (error) {
    console.error("썸네일 텍스트 생성 실패:", error)
    return { line1: "첫 줄", line2: "둘째 줄" }
  }
}

/**
 * 대본에서 키워드 추출 함수
 */
export async function extractKeywordsFromScript(script: string): Promise<Array<{ keyword: string; weight: number }>> {
  try {
    // 간단한 키워드 추출 로직 (실제로는 더 정교한 NLP 처리가 필요할 수 있음)
    const words = script.split(/\s+/).filter((word) => word.length > 2)
    const wordCount: Record<string, number> = {}
    
    words.forEach((word) => {
      const cleanWord = word.replace(/[.,!?;:()]/g, "").toLowerCase()
      if (cleanWord.length > 2) {
        wordCount[cleanWord] = (wordCount[cleanWord] || 0) + 1
      }
    })

    const keywords = Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([keyword, count]) => ({
        keyword,
        weight: count,
      }))

    return keywords
  } catch (error) {
    console.error("키워드 추출 실패:", error)
    return []
  }
}

/**
 * 의사 이미지 생성 함수
 */
export async function generateDoctorImage(
  doctorType: string,
  customDescription?: string
): Promise<{ imageUrl: string; prompt: string; koreanDescription: string }> {
  // 실제 구현은 이미지 생성 API를 사용해야 함
  // 여기서는 예시로 기본값 반환
  console.log(`[Longform] 의사 이미지 생성 요청: ${doctorType}, ${customDescription}`)
  return {
    imageUrl: "/placeholder.svg",
    prompt: "",
    koreanDescription: customDescription || doctorType,
  }
}

/**
 * 유튜브 설명 생성 함수
 */
export async function generateYouTubeDescription(
  script: string,
  category: string,
  title: string,
  apiKey?: string,
  videoDurationMinutes?: number // 영상 길이 (분)
): Promise<{ description: string; pinnedComment: string; hashtags: string; uploadTags: string[] }> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
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
            content: "당신은 유튜브 설명 작성 전문가입니다. 대본을 분석하여 SEO에 최적화된 유튜브 설명을 작성해주세요. JSON 형식으로 {\"description\": \"설명\", \"pinnedComment\": \"고정 댓글\", \"hashtags\": \"해시태그\", \"uploadTags\": [\"태그1\", \"태그2\"]}로 응답해주세요.",
          },
          {
            role: "user",
            content: `제목: ${title}\n카테고리: ${category}\n\n대본:\n${script.substring(0, 3000)}\n\n위 대본을 분석하여 유튜브 설명을 작성해주세요.`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("설명을 생성할 수 없습니다.")
    }

    // JSON 파싱 시도
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          description: parsed.description || content.trim(),
          pinnedComment: parsed.pinnedComment || "",
          hashtags: parsed.hashtags || "",
          uploadTags: Array.isArray(parsed.uploadTags) ? parsed.uploadTags : [],
        }
      } catch {
        // JSON 파싱 실패 시 기본값 반환
      }
    }

    // JSON 형식이 아니면 기본 구조로 반환
    return {
      description: content.trim(),
      pinnedComment: "",
      hashtags: "",
      uploadTags: [],
    }
  } catch (error) {
    console.error("설명 생성 실패:", error)
    throw error
  }
}

/**
 * Replicate를 사용하여 AI 썸네일 생성
 * @param topic - 선택한 주제
 * @param replicateApiKey - Replicate API 키
 * @returns 생성된 썸네일 이미지 URL
 */
/**
 * 대본을 쇼츠 길이에 맞게 요약하는 함수
 * @param script - 원본 대본 텍스트
 * @param duration - 쇼츠 길이 (1, 2, 3분)
 * @param openaiApiKey - OpenAI API 키
 * @returns 요약된 대본 텍스트
 */
export async function summarizeScriptForShorts(
  script: string,
  duration: 0.5 | 1 | 2 | 3,
  openaiApiKey?: string
): Promise<string> {
  // 내부적으로 항상 제공된 API 키 사용 (사용자 입력 무시)
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GPT_API_KEY = openaiApiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  if (!script || script.trim().length === 0) {
    throw new Error("대본이 없습니다.")
  }

  try {
    const durationText = duration === 0.5 ? "30초" : duration === 1 ? "1분" : duration === 2 ? "2분" : "3분"
    // 한글 TTS 기준: 분당 약 300자 (초당 약 5자)
    const targetCharCount = duration === 0.5 ? 150 : duration === 1 ? 300 : duration === 2 ? 600 : 900
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
- 대본 끝에 글자수나 메타 정보를 추가하지 마세요
- 오직 대본 내용만 작성하세요`,
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
      throw new Error(`API 호출 실패: ${response.status} ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    let summarizedScript = data.choices[0]?.message?.content?.trim()

    if (!summarizedScript) {
      throw new Error("요약된 대본을 생성할 수 없습니다.")
    }

    // 괄호 안의 글자수 제거 (예: "(150자)", "(300자)", "(글자수: 150자)" 등)
    summarizedScript = summarizedScript.replace(/\([^)]*글자[^)]*\)/gi, "")
    summarizedScript = summarizedScript.replace(/\([^)]*\d+자[^)]*\)/gi, "")
    summarizedScript = summarizedScript.replace(/\[[^\]]*글자[^\]]*\]/gi, "")
    summarizedScript = summarizedScript.replace(/\[[^\]]*\d+자[^\]]*\]/gi, "")
    // 공백 정리
    summarizedScript = summarizedScript.replace(/\s+/g, " ").trim()

    return summarizedScript
  } catch (error) {
    console.error("[Longform] 대본 요약 실패:", error)
    throw error
  }
}

/**
 * 벤치마킹 썸네일 이미지를 분석하여 스타일 정보 추출
 */
async function analyzeThumbnailStyle(
  thumbnailImageUrl: string,
  openaiApiKey: string
): Promise<string> {
  try {
    // 이미지를 base64로 변환
    const response = await fetch(thumbnailImageUrl)
    const blob = await response.blob()
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        // data:image/jpeg;base64, 부분 제거
        const base64Data = base64String.split(',')[1]
        resolve(base64Data)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    const imageType = blob.type || 'image/jpeg'
    const mimeType = imageType.split('/')[1] || 'jpeg'

    const analysisResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `이 유튜브 썸네일 이미지를 정밀하게 분석하여 다음 정보를 추출해주세요:

⚠️ 매우 중요: 텍스트 위치와 레이아웃을 정확히 분석해야 합니다.

1. 텍스트 위치 및 레이아웃 (가장 중요)
   - 텍스트가 썸네일의 어느 위치에 있는지 (상단, 중앙, 하단, 좌측, 우측 등)
   - 텍스트 정렬 방식 (중앙 정렬, 좌측 정렬, 우측 정렬)
   - 텍스트가 몇 줄인지, 각 줄의 위치
   - 텍스트와 이미지의 비율 (텍스트가 차지하는 영역)
   - 텍스트 주변 여백과 간격

2. 텍스트 디자인 및 효과
   - 텍스트 색상 (주요 색상, 대비 색상)
   - 텍스트 효과 (그림자, 외곽선, 배경 박스, 그라데이션 등)
   - 폰트 스타일 (굵기, 크기, 폰트 종류 추정)
   - 텍스트의 가독성을 위한 배경 처리 (반투명 박스, 블러 효과 등)

3. 색상 스타일
   - 주요 색상 팔레트
   - 배경 색상
   - 강조 색상
   - 전체적인 색상 톤 (밝은, 어두운, 따뜻한, 차가운 등)

4. 레이아웃 구성
   - 이미지와 텍스트의 배치 비율
   - 주요 시각적 요소의 위치
   - 전체적인 구성 (대칭, 비대칭, 균형 등)

5. 시각적 스타일
   - 이미지/일러스트레이션 스타일
   - 전체적인 분위기와 톤

분석 결과를 영어로 작성하고, 특히 텍스트 위치와 레이아웃을 정확하게 설명해주세요. 
예시 형식:
- "Text layout: Two lines of text positioned at the top center, bold white text with black outline, text takes up top 30% of thumbnail, centered alignment, semi-transparent dark background box behind text for readability. Color scheme: Bright yellow and red accents on dark background. Typography: Bold sans-serif font, large text size, text shadow effect. Overall style: Energetic, high contrast, professional YouTube thumbnail design."

이 정보를 사용하여 정확히 같은 레이아웃과 텍스트 위치로 썸네일을 생성할 수 있도록 매우 구체적이고 상세하게 작성해주세요.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.2,
      }),
    })

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text()
      console.error("[Thumbnail Analysis] OpenAI API 오류:", errorText)
      throw new Error(`썸네일 분석 실패: ${analysisResponse.status}`)
    }

    const analysisData = await analysisResponse.json()
    const styleDescription = analysisData.choices?.[0]?.message?.content

    if (!styleDescription) {
      throw new Error("썸네일 스타일 분석 결과를 받을 수 없습니다.")
    }

    console.log("[Thumbnail Analysis] 분석된 스타일:", styleDescription)
    return styleDescription.trim()
  } catch (error) {
    console.error("[Thumbnail Analysis] 썸네일 분석 실패:", error)
    throw error
  }
}

export async function generateAIThumbnail(
  topic: string,
  replicateApiKey: string,
  imageStyle?: string,
  customText?: string,
  customStylePrompt?: string,
  characterDescription?: string,
  withoutText?: boolean,
  benchmarkThumbnailUrl?: string,
  openaiApiKey?: string
): Promise<string> {
  if (!replicateApiKey) {
    throw new Error("Replicate API 키가 필요합니다.")
  }

  try {
    console.log(`[Longform] AI 썸네일 생성 시작, 주제: ${topic}, 이미지 스타일: ${imageStyle || "기본"}, 문구 없이: ${withoutText}`)

    // 벤치마킹 썸네일이 있으면 스타일 분석
    let benchmarkStylePrompt = ""
    if (benchmarkThumbnailUrl && openaiApiKey) {
      try {
        console.log("[Longform] 벤치마킹 썸네일 분석 시작...")
        benchmarkStylePrompt = await analyzeThumbnailStyle(benchmarkThumbnailUrl, openaiApiKey)
        console.log("[Longform] 벤치마킹 썸네일 스타일 분석 완료:", benchmarkStylePrompt.substring(0, 100) + "...")
      } catch (error) {
        console.warn("[Longform] 벤치마킹 썸네일 분석 실패, 계속 진행:", error)
        // 분석 실패해도 계속 진행
      }
    }

    // 이미지 스타일에 맞는 스타일 프롬프트 생성
    let stylePrompt = ""
    if (imageStyle === "stickman-animation") {
      stylePrompt = "stickman animation style, 2D vector cartoon, white circular face, simple black outline, dot eyes, curved mouth, thin black limbs, vibrant colors, flat cel shading, thick bold outlines, solid color fills"
    } else if (imageStyle === "realistic" || imageStyle === "realistic2") {
      stylePrompt = "hyperrealistic, photorealistic masterpiece, 8K, ultra-detailed, sharp focus, cinematic lighting, shot on a professional DSLR camera with a 50mm lens"
    } else if (imageStyle === "animation2") {
      stylePrompt = "flat 2D vector illustration, minimal vector art, stylized cartoon character, thick bold black outlines, unshaded, flat solid colors, cel-shaded, simple line art, comic book inking style, completely flat, no shadows, no gradients, no depth"
    } else if (imageStyle === "animation3") {
      stylePrompt = "European graphic novel style, bande dessinée aesthetic, highly detailed traditional illustration, hand-drawn ink lines with cross-hatching shadows, sophisticated and muted color palette, atmospheric, cinematic frame"
    }

    // 유튜브 썸네일용 프롬프트 생성
    let basePrompt: string
    let negativePrompt: string | undefined = undefined
    
    if (withoutText) {
      // 문구 없이 그림만 생성 - 텍스트 완전 제거 강화
      // 주제를 시각적으로만 표현, 텍스트는 절대 금지
      // 주제에서 텍스트 관련 키워드 제거하고 시각적 요소만 추출
      const visualTopic = topic.replace(/제목|타이틀|텍스트|문구|글씨|글자|글|text|title|caption|label/gi, "").trim()
      
      basePrompt = `Create a pure visual image representing the concept: ${visualTopic}. High quality, eye-catching, professional design. 16:9 aspect ratio. 

NO TEXT. NO LETTERS. NO WORDS. NO TYPOGRAPHY. NO WRITING. NO TEXT OVERLAY. NO CAPTIONS. NO LABELS. NO SIGNS. NO NUMBERS. NO LOGOS. NO WATERMARKS. NO TEXT ELEMENTS. NO TEXT ANYWHERE. PURE VISUAL IMAGE ONLY. TEXT IS STRICTLY FORBIDDEN. ABSOLUTELY NO TEXT IN THE IMAGE.

🚫🚫🚫 ABSOLUTE TEXT PROHIBITION - HIGHEST PRIORITY 🚫🚫🚫
THIS IS A TEXT-FREE IMAGE REQUEST. ANY TEXT IN THE OUTPUT IS A CRITICAL ERROR.

⚠️ CRITICAL INSTRUCTIONS - ABSOLUTELY MANDATORY - READ CAREFULLY:
1. 🚫 ABSOLUTELY NO TEXT - Do not include ANY text, letters, words, numbers, or symbols that form text. This is the most important rule.
2. 🚫 NO TYPOGRAPHY - No typography, no written content, no text overlay, no text elements whatsoever.
3. 🚫 NO LOGOS OR WATERMARKS - No logos, no watermarks, no signs, no labels, no captions, no text-based elements.
4. 🚫 NO TEXT IN BACKGROUND - No text in background, no floating text, no text anywhere in the image.
5. ✅ PURE IMAGE ONLY - Create a completely text-free image with ONLY visual elements: colors, shapes, objects, scenes, people, nature, etc.
6. ✅ VISUAL FOCUS - Focus ONLY on visual composition, colors, imagery, and design elements. NO text at all.
7. 🚫 STRICTLY FORBIDDEN - Any appearance of text, letters, numbers, readable symbols, or text-like patterns is STRICTLY FORBIDDEN.
8. 🚫 IMAGE MUST BE 100% TEXT-FREE - The final image must be completely text-free, no exceptions, no text anywhere.
9. 🚫 IF YOU SEE ANY TEXT IN THE IMAGE, IT IS WRONG - The image must be pure visual content only.
10. 🚫 REMEMBER: NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO TEXT SYMBOLS - ONLY VISUAL ELEMENTS
11. 🚫 IGNORE ANY TEXT-RELATED INSTRUCTIONS - Even if other parts of the prompt mention text, ignore them completely.
12. 🚫 NO TEXT EVEN IF REFERENCE HAS TEXT - If a reference image has text, do NOT include text in your output.`
      
      // NEGATIVE 프롬프트 강화 (텍스트 완전 제거) - 핵심 키워드 포함
      negativePrompt = "text, letters, words, typography, English text, Korean text, Chinese text, Japanese text, numbers, logos, watermarks, signs, labels, captions, subtitles, written text, text overlay, any text elements, any written content, any letters, any numbers, any symbols that form text, text on image, text in background, floating text, alphabet, characters, fonts, typeface, lettering, inscription, writing, script, calligraphy, text box, text area, text banner, text label, text sign, text poster, text display, text graphics, text design, text art, text illustration, any form of text, any form of writing, any form of letters, any form of numbers, any readable text, any visible text, any text content"
      
      // 프롬프트 끝에 NEGATIVE 명시 (이중 보호)
      basePrompt = `${basePrompt} NEGATIVE PROMPT: text, letters, words, typography, numbers, logos, watermarks, signs, labels, captions, subtitles, written text, text overlay, any text elements, any written content, any letters, any numbers, any symbols that form text, text on image, text in background, floating text, alphabet, characters, fonts, typeface, lettering, inscription, writing, script, calligraphy, text box, text area, text banner, text label, text sign, text poster, text display, text graphics, text design, text art, text illustration, any form of text, any form of writing, any form of letters, any form of numbers, any readable text, any visible text, any text content`
    } else {
      // 기본 프롬프트 (텍스트 영역 포함)
      basePrompt = `YouTube thumbnail for video about: ${topic}. High quality, eye-catching, professional thumbnail design. Bright colors, clear text area, engaging composition. 16:9 aspect ratio.`
      
      // 커스텀 문구가 있으면 프롬프트에 추가 (withoutText가 false일 때만)
      if (customText && customText.trim()) {
        basePrompt = `${basePrompt} Include text or visual elements related to: "${customText.trim()}".`
      }
    }
    
    // 벤치마킹 스타일이 있으면 프롬프트에 추가
    if (benchmarkStylePrompt) {
      if (withoutText) {
        // 문구 없이 그림만 생성 모드: 벤치마킹 스타일에서 텍스트 관련 부분 제거하고 시각적 스타일만 적용
        // 벤치마킹 스타일에서 텍스트 관련 키워드 제거
        const visualOnlyStyle = benchmarkStylePrompt
          .replace(/text|typography|letter|word|font|caption|label|writing|inscription/gi, "")
          .replace(/\s+/g, " ")
          .trim()
        
        basePrompt = `${basePrompt}

⚠️ CRITICAL: Match the following thumbnail VISUAL STYLE ONLY (NO TEXT):
${visualOnlyStyle}

MANDATORY REQUIREMENTS (VISUAL ONLY, NO TEXT):
- Use the same color palette and visual style
- Match the image composition and layout (excluding text)
- Replicate the same visual effects and atmosphere
- Maintain the same overall visual balance
- ⚠️ ABSOLUTELY NO TEXT - Ignore any text-related instructions from the reference
- Focus ONLY on visual elements: colors, composition, imagery, style`
      } else {
        // 일반 모드: 텍스트 위치와 레이아웃 포함
        basePrompt = `${basePrompt}

⚠️ CRITICAL: Match the following thumbnail design EXACTLY:
${benchmarkStylePrompt}

MANDATORY REQUIREMENTS:
- Use the EXACT same text position and layout as described above
- Match the text alignment, spacing, and positioning precisely
- Replicate the same text effects (shadows, outlines, backgrounds) exactly
- Use the same color palette and visual style
- Maintain the same overall composition and balance
- The text location, size, and design must be identical to the reference thumbnail`
      }
    }
    
    let finalPrompt = stylePrompt ? `${basePrompt} ${stylePrompt}` : basePrompt
    
    // withoutText가 true이면 프롬프트 맨 앞에 텍스트 금지 키워드를 명확하게 추가 (가장 중요!)
    if (withoutText) {
      finalPrompt = `NO TEXT. NO LETTERS. NO WORDS. NO TYPOGRAPHY. NO WRITING. NO TEXT OVERLAY. NO CAPTIONS. NO LABELS. NO SIGNS. NO NUMBERS. NO LOGOS. NO WATERMARKS. NO TEXT ELEMENTS. NO TEXT ANYWHERE. PURE VISUAL IMAGE ONLY. TEXT IS STRICTLY FORBIDDEN. ABSOLUTELY NO TEXT IN THE IMAGE. ${finalPrompt}`
    }
    
    const prompt = finalPrompt

    // withoutText가 true인 경우 로그 출력
    if (withoutText) {
      console.log("[Longform] 썸네일 생성 - 문구 없이 그림만 생성 모드")
      console.log("[Longform] 프롬프트 (일부):", prompt.substring(0, 300) + "...")
      console.log("[Longform] NEGATIVE 프롬프트 (일부):", negativePrompt?.substring(0, 200) + "...")
    }

    // Replicate API 요청 본문 구성
    const requestBody: any = {
      input: {
        prompt: prompt,
        aspect_ratio: "16:9",
        output_format: "png",
      },
    }
    
    // negative_prompt가 있으면 추가 (모델이 지원하는 경우)
    if (negativePrompt) {
      requestBody.input.negative_prompt = negativePrompt
      console.log("[Longform] negative_prompt 추가됨")
    }

    const response = await fetch("https://api.replicate.com/v1/models/google/nano-banana-pro/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${replicateApiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Longform] Replicate API 오류:", errorText)
      throw new Error(`Replicate API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const predictionId = data.id

    console.log(`[Longform] Replicate 예측 생성됨, ID: ${predictionId}`)

    // 폴링하여 결과 대기
    let imageUrl: string | null = null
    let attempts = 0
    const maxAttempts = 60 // 최대 5분 대기 (5초 간격)

    while (!imageUrl && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)) // 5초 대기

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

      if (statusData.status === "succeeded") {
        // nano-banana-pro 모델의 출력 형식에 맞게 처리
        if (statusData.output && typeof statusData.output === "string") {
          imageUrl = statusData.output
        } else if (statusData.output && Array.isArray(statusData.output) && statusData.output.length > 0) {
          imageUrl = statusData.output[0]
        } else if (statusData.output?.url) {
          imageUrl = statusData.output.url
        }
        console.log("[Longform] AI 썸네일 생성 완료:", imageUrl)
        break
      } else if (statusData.status === "failed") {
        throw new Error(`이미지 생성 실패: ${statusData.error || "알 수 없는 오류"}`)
      }

      attempts++
    }

    if (!imageUrl) {
      throw new Error("이미지 생성 시간 초과")
    }

    return imageUrl
  } catch (error) {
    console.error("[Longform] AI 썸네일 생성 실패:", error)
    throw error
  }
}

export async function generateHookingVideoPrompt(
  topic: string,
  script?: string,
  geminiApiKey?: string
): Promise<string> {
  const GEMINI_API_KEY = geminiApiKey || process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 필요합니다.")
  }

  try {
    const systemPrompt = `당신은 소라2(Sora 2)용 15초 영상 프롬프트 전문가입니다. 주제와 대본을 바탕으로 시각적으로 매력적인 15초 영상 프롬프트를 영어로 작성해주세요.

요구사항:
- 15초 영상에 최적화
- 주제를 시각적으로 표현
- 카메라 움직임, 조명, 구도 상세히 기술
- 영어로 작성
- 프롬프트 2개를 번호 없이 줄바꿈으로 구분하여 출력
- 설명 없이 프롬프트만 출력`

    const userPrompt = script
      ? `주제: ${topic}\n\n대본:\n${script}\n\n위 주제와 대본을 바탕으로 소라2용 15초 영상 프롬프트를 2개 작성해주세요.`
      : `주제: ${topic}\n\n위 주제를 바탕으로 소라2용 15초 영상 프롬프트를 2개 작성해주세요.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\n${userPrompt}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const prompt = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!prompt) {
      throw new Error("프롬프트 생성에 실패했습니다.")
    }

    return prompt.trim()
  } catch (error) {
    console.error("[Hooking Video] 프롬프트 생성 실패:", error)
    throw error
  }
}

export async function convertImageToVideo(
  imageUrl: string,
  replicateApiKey: string,
  prompt?: string
): Promise<string> {
  if (!replicateApiKey) {
    throw new Error("Replicate API 키가 필요합니다.")
  }

  try {
    console.log("[Longform] 이미지를 영상으로 변환 시작:", imageUrl)
    
    // wan-video/wan-2.2-i2v-fast 모델 사용
    const response = await fetch("https://api.replicate.com/v1/models/wan-video/wan-2.2-i2v-fast/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateApiKey}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          image: imageUrl,
          prompt: prompt || "cinematic slow motion, smooth camera movement, gentle zoom in effect",
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("[Longform] Replicate API 오류:", response.status, errorData)
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    
    // 결과가 바로 나오면 반환
    if (data.output) {
      // wan-2.2-i2v-fast는 output이 URL 문자열 또는 객체일 수 있음
      let videoUrl: string
      if (typeof data.output === "string") {
        videoUrl = data.output
      } else if (data.output.url) {
        videoUrl = data.output.url
      } else if (Array.isArray(data.output) && data.output.length > 0) {
        videoUrl = typeof data.output[0] === "string" ? data.output[0] : data.output[0].url || String(data.output[0])
      } else {
        videoUrl = String(data.output)
      }
      console.log("[Longform] 영상 변환 완료:", videoUrl)
      return videoUrl
    }

    // 결과가 나올 때까지 폴링
    const predictionId = data.id
    let attempts = 0
    const maxAttempts = 120 // 최대 2분 대기

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000)) // 2초 대기

      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          Authorization: `Bearer ${replicateApiKey}`,
        },
      })

      if (!statusResponse.ok) {
        throw new Error(`상태 확인 실패: ${statusResponse.status}`)
      }

      const statusData = await statusResponse.json()

      if (statusData.status === "succeeded" && statusData.output) {
        // wan-2.2-i2v-fast는 output이 URL 문자열 또는 객체일 수 있음
        let videoUrl: string
        if (typeof statusData.output === "string") {
          videoUrl = statusData.output
        } else if (statusData.output.url) {
          videoUrl = statusData.output.url
        } else if (Array.isArray(statusData.output) && statusData.output.length > 0) {
          videoUrl = typeof statusData.output[0] === "string" ? statusData.output[0] : statusData.output[0].url || String(statusData.output[0])
        } else {
          videoUrl = String(statusData.output)
        }
        console.log("[Longform] 영상 변환 완료:", videoUrl)
        return videoUrl
      }

      if (statusData.status === "failed" || statusData.status === "canceled") {
        throw new Error(`영상 변환 실패: ${statusData.error || "알 수 없는 오류"}`)
      }

      attempts++
    }

    throw new Error("영상 변환 시간 초과")
  } catch (error) {
    console.error("[Longform] 영상 변환 실패:", error)
    throw error
  }
}

/**
 * 대본에서 주제를 추출하는 함수
 */
export async function extractTopicFromScript(script: string, apiKey?: string): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  try {
    console.log("[v0] 대본에서 주제 추출 시작")

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
            content: `당신은 영상 콘텐츠 분석 전문가입니다. 주어진 대본을 분석하여 이 영상의 핵심 주제를 한 문장으로 요약해주세요.

규칙:
- 대본의 핵심 내용을 파악하여 간결하고 명확한 주제로 요약
- 20자 이내로 간결하게 작성
- 예: "60대 건강 관리 방법", "삼국지 관우 이야기", "치매 예방 운동법" 등`,
          },
          {
            role: "user",
            content: `다음 대본의 핵심 주제를 한 문장으로 요약해주세요:\n\n${script.substring(0, 2000)}`, // 대본이 너무 길면 앞부분만 사용
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || "주제 추출에 실패했습니다.")
    }

    const data = await response.json()
    const topic = data.choices[0]?.message?.content?.trim()

    if (!topic) {
      throw new Error("주제 추출 결과가 비어있습니다.")
    }

    console.log("[v0] 추출된 주제:", topic)
    return topic
  } catch (error) {
    console.error("[v0] 대본에서 주제 추출 실패:", error)
    throw error
  }
}

/**
 * 기존 대본을 기반으로 각색하여 재생성하는 함수
 */
export async function regenerateScript(
  existingScript: string,
  topic: string,
  apiKey?: string,
  category: CategoryType = "health"
): Promise<string> {
  const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.")
  }

  try {
    console.log("[v0] 대본 재생성 시작 (구조 기반 각색, Gemini 2.5 Pro)")

    // 프롬프트가 너무 길면 existingScript를 여러 부분으로 나눠서 처리 (Gemini 토큰 제한 고려)
    // 대략 30,000자씩 나눠서 처리 (안전 마진 고려)
    const MAX_SCRIPT_LENGTH = 30000
    let scriptToUse = existingScript
    
    if (existingScript.length > MAX_SCRIPT_LENGTH) {
      console.log(`[v0] 대본이 길어서 여러 부분으로 나눠서 처리합니다. (전체: ${existingScript.length}자)`)
      
      // 대본을 여러 부분으로 나누기 (문장 단위로 나눠서 자연스럽게)
      const parts: string[] = []
      const sentences = existingScript.split(/([.!?。！？]\s+)/)
      let currentPart = ""
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i]
        if ((currentPart + sentence).length > MAX_SCRIPT_LENGTH && currentPart.length > 0) {
          parts.push(currentPart.trim())
          currentPart = sentence
        } else {
          currentPart += sentence
        }
      }
      
      if (currentPart.trim().length > 0) {
        parts.push(currentPart.trim())
      }
      
      console.log(`[v0] 대본을 ${parts.length}개 부분으로 나눴습니다.`)
      
      // 각 부분의 앞부분과 뒷부분을 포함하여 전체 구조 파악
      // 첫 부분 전체 + 중간 부분들의 앞뒤 + 마지막 부분 전체
      if (parts.length === 1) {
        scriptToUse = parts[0].substring(0, MAX_SCRIPT_LENGTH)
      } else if (parts.length === 2) {
        // 2개 부분: 첫 부분 전체 + 두 번째 부분 앞부분
        scriptToUse = parts[0] + "\n\n[중간 생략...]\n\n" + parts[1].substring(0, Math.min(10000, parts[1].length))
      } else {
        // 3개 이상: 첫 부분 + 중간 부분들의 요약 + 마지막 부분
        const firstPart = parts[0].substring(0, Math.min(15000, parts[0].length))
        const lastPart = parts[parts.length - 1].substring(0, Math.min(15000, parts[parts.length - 1].length))
        const middleSummary = parts.length > 2 
          ? `\n\n[중간 ${parts.length - 2}개 부분 생략 - 전체 구조를 파악하여 작성하세요]\n\n`
          : "\n\n[중간 생략...]\n\n"
        scriptToUse = firstPart + middleSummary + lastPart
      }
      
      scriptToUse += "\n\n[참고: 원본 대본이 길어서 주요 부분만 제공되었습니다. 전체 구조와 감정 흐름을 파악하여 작성하세요.]"
    }

    const fullPrompt = `당신은 대본 구조 분석 및 재작성 전문가입니다.

⚠️⚠️⚠️ 절대적 필수 원칙 ⚠️⚠️⚠️
- 원본 대본의 문장을 절대 그대로 사용하지 마십시오
- 원본 대본의 단어, 어구, 표현을 절대 그대로 복사하지 마십시오
- 원본과 동일하거나 유사한 문장이 발견되면 즉시 폐기하고 완전히 새로 작성하십시오
- 원본의 문장 구조, 어순, 표현 방식을 절대 모방하지 마십시오
- 원본의 내용, 주제, 사례, 비유, 문장은 절대 언급하지 마십시오
- 오직 '전개 구조'와 '감정 흐름'만 추출하고 활용하십시오
- 원본 예시, 산업, 사건, 비유를 절대 사용하지 마십시오
- 원본과 유사한 문장 리듬, 어투, 질문을 절대 사용하지 마십시오
- 표절이나 유사성이 의심되면 그 문장은 폐기하고 완전히 새로 작성하십시오
- 괄호나 대괄호를 사용하지 않습니다 (TTS를 이용할 것이기 때문)
- "개요", "서론", "본론", "챕터", "1부", "2부", "3부", "4부", "5부", "결론" 같은 구조적 단어를 절대 사용하지 않습니다
- 오로지 대본 내용만 작성합니다
- 기존 대본의 길이와 비슷하게 유지합니다

[작성 방식]
1단계: 벤치마킹용 대본을 분석하여 '전개 구조'와 '감정 흐름'만 추출
2단계: 새로운 주제를 기준으로 추출한 구조를 그대로 사용하여 완전히 새로운 대본 작성
- 모든 문장은 원본과 완전히 다른 표현으로 작성하십시오
- 같은 의미라도 완전히 다른 단어, 다른 문장 구조, 다른 표현으로 작성하십시오

────────────────────────
[벤치마킹용 대본]
────────────────────────
${scriptToUse}

────────────────────────
[1단계: 구조 및 감정 흐름 추출]
────────────────────────
⚠️⚠️⚠️ 절대 금지 ⚠️⚠️⚠️
- 내용·주제·사례·비유·문장은 절대 언급하지 말 것
- 원본의 단어, 어구, 표현을 절대 사용하지 말 것
- 오직 '전개 구조'와 '감정 흐름'만 추출할 것

────────────────────────
[2단계: 새로운 대본 작성]
────────────────────────
다음 주제를 기준으로,
위 구조를 그대로 사용하되
완전히 새로운 대본을 작성하라.

[새 주제]
- 핵심 질문: ${topic}
- 전달하고 싶은 한 문장 메시지: ${topic}에 대한 핵심 메시지를 전달하세요.

────────────────────────
[강제 규칙 - 절대 준수]
────────────────────────
🚫 원본 예시, 산업, 사건, 비유 사용 금지
🚫 원본과 유사한 문장 리듬, 어투, 질문 금지
🚫 원본의 단어, 어구, 표현을 그대로 사용 금지
🚫 원본의 문장 구조, 어순을 모방 금지
🚫 표절·유사성 의심이 들면 그 문장은 폐기하고 다시 작성
🚫 원본과 동일하거나 유사한 문장이 발견되면 즉시 폐기
✅ 모든 문장은 원본과 완전히 다른 표현으로 작성
✅ 같은 의미라도 완전히 다른 단어, 다른 문장 구조로 작성
✅ 대본 내용만 작성하세요. 제목이나 구조적 단어는 사용하지 마세요.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: fullPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 1.2, // 창의적인 각색을 위해 temperature를 매우 높게 설정 (원본과 다른 표현 강제)
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 32768, // Gemini 2.5 Pro는 최대 32768 토큰
          },
        }),
      }
    )

    if (!response.ok) {
      let errorText = ""
      try {
        const errorData = await response.json()
        errorText = errorData.error?.message || JSON.stringify(errorData)
      } catch {
        errorText = await response.text()
      }
      console.error(`[v0] 대본 재생성 API 오류: ${response.status}`, errorText)
      throw new Error(`대본 재생성 실패 (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    
    // Gemini 응답 구조 확인
    if (!data.candidates || data.candidates.length === 0) {
      console.error(`[v0] 대본 재생성 실패: candidates 배열이 비어있습니다.`, JSON.stringify(data, null, 2))
      throw new Error("재생성된 대본을 생성할 수 없습니다. API 응답에 candidates가 없습니다.")
    }
    
    const candidate = data.candidates[0]
    const finishReason = candidate.finishReason
    
    if (finishReason === "SAFETY" || finishReason === "RECITATION" || finishReason === "OTHER") {
      console.error(`[v0] 대본 재생성 실패: ${finishReason}`, JSON.stringify(candidate, null, 2))
      throw new Error(`대본 재생성에 실패했습니다. (finishReason: ${finishReason})`)
    }
    
    let regeneratedScript = candidate.content?.parts?.[0]?.text

    if (!regeneratedScript) {
      console.error(`[v0] 대본 재생성 실패: 응답 내용이 없습니다.`, JSON.stringify({
        finishReason,
        hasContent: !!candidate.content,
        hasParts: !!candidate.content?.parts,
        partsLength: candidate.content?.parts?.length,
        fullCandidate: candidate
      }, null, 2))
      throw new Error(`재생성된 대본을 생성할 수 없습니다. 응답 내용이 없습니다. (finishReason: ${finishReason || "N/A"})`)
    }
    
    regeneratedScript = regeneratedScript.trim()

    // 구조적 단어 제거
    const structuralWords = [
      "개요", "서론", "본론", "챕터", "1부", "2부", "3부", "4부", "5부", "결론",
      "Chapter", "Part", "Introduction", "Body", "Conclusion"
    ]
    
    let cleanedScript = regeneratedScript
    for (const word of structuralWords) {
      const regex = new RegExp(`\\s*${word}\\s*:?\\s*`, "gi")
      cleanedScript = cleanedScript.replace(regex, "")
    }

    // 원본과의 유사도 체크 (단어 기반)
    const calculateSimilarity = (text1: string, text2: string): number => {
      const normalizeText = (text: string): Set<string> => {
        return new Set(
          text
            .toLowerCase()
            .replace(/[^\w\s가-힣]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 0)
        )
      }

      const words1 = normalizeText(text1)
      const words2 = normalizeText(text2)

      let commonWords = 0
      for (const word of words1) {
        if (words2.has(word)) {
          commonWords++
        }
      }

      const totalUniqueWords = words1.size + words2.size - commonWords
      if (totalUniqueWords === 0) {
        return 1
      }

      return commonWords / totalUniqueWords
    }

    // 원본과 재생성된 대본의 유사도 체크
    const similarity = calculateSimilarity(existingScript, cleanedScript)
    console.log(`[v0] 원본과 재생성 대본 유사도: ${(similarity * 100).toFixed(1)}%`)

    // 유사도가 40% 이상이면 재생성 (너무 유사함)
    if (similarity > 0.4) {
      console.warn(`[v0] ⚠️ 원본과 유사도가 너무 높습니다 (${(similarity * 100).toFixed(1)}%). 재생성 시도...`)
      
      // 재생성 시도 (최대 2회)
      for (let retry = 0; retry < 2; retry++) {
        try {
          const retryPrompt = `${fullPrompt}

⚠️⚠️⚠️ 중요: 이전 생성 결과가 원본과 너무 유사했습니다 (유사도: ${(similarity * 100).toFixed(1)}%).
반드시 원본과 완전히 다른 표현으로 다시 작성하세요.
- 원본의 단어, 어구, 표현을 절대 사용하지 마세요
- 원본의 문장 구조, 어순을 절대 모방하지 마세요
- 모든 문장을 완전히 새로운 표현으로 작성하세요`

          const retryResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: retryPrompt,
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 1.3, // 재생성 시 더 높은 temperature
                  topK: 40,
                  topP: 0.95,
                  maxOutputTokens: 32768,
                },
              }),
            }
          )

          if (!retryResponse.ok) {
            break // 재생성 실패 시 원래 결과 사용
          }

          const retryData = await retryResponse.json()
          
          if (!retryData.candidates || retryData.candidates.length === 0) {
            break
          }
          
          const retryCandidate = retryData.candidates[0]
          const retryScript = retryCandidate.content?.parts?.[0]?.text?.trim()
          
          if (retryScript) {
            let retryCleaned = retryScript
            for (const word of structuralWords) {
              const regex = new RegExp(`\\s*${word}\\s*:?\\s*`, "gi")
              retryCleaned = retryCleaned.replace(regex, "")
            }
            
            const retrySimilarity = calculateSimilarity(existingScript, retryCleaned)
            console.log(`[v0] 재생성 ${retry + 1}회차 유사도: ${(retrySimilarity * 100).toFixed(1)}%`)
            
            if (retrySimilarity < 0.4) {
              cleanedScript = retryCleaned
              console.log(`[v0] ✅ 재생성 성공: 유사도 ${(retrySimilarity * 100).toFixed(1)}%`)
              break
            }
          }
        } catch (retryError) {
          console.error(`[v0] 재생성 ${retry + 1}회차 실패:`, retryError)
        }
      }
    }

    console.log("[v0] 대본 재생성 완료")
    return cleanedScript.trim()
  } catch (error) {
    console.error("[v0] 대본 재생성 실패:", error)
    throw error
  }
}

/**
 * 벤치마킹 대본 구조 분석
 */
export async function analyzeBenchmarkScript(script: string, apiKey?: string): Promise<string> {
  console.log("[analyzeBenchmarkScript] 시작, 대본 길이:", script.length)

  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.")
  }

  if (!script || !script.trim()) {
    throw new Error("분석할 대본을 입력해주세요.")
  }

  const systemPrompt = `너는 유튜브 롱폼 대본을 분석해
'내용을 제거한 순수 구조'만 추출하는 스크립트 설계자다.

아래 대본에서
주제, 사례, 숫자, 주장, 결론 같은 '내용'은 전부 제거하고
오직 "구조와 진행 방식"만 추상화해서 정리해라.

목표는
이 구조를 그대로 커스텀 타입 입력란에 넣어
다른 주제로도 재사용할 수 있게 만드는 것이다.

다음 기준을 반드시 지켜라.

1. 대본 전체를 단계별 구조로 분해
- 초반 / 중반 / 후반 흐름을 명확히 구분
- 각 단계가 수행하는 역할을 설명

2. 초반 15초는 반드시 별도로 분리
- 어떤 방식으로 시작하는지
- 질문형인지, 단정형인지, 위기 제시형인지
- 시청 지속을 유도하는 장치가 무엇인지

3. 구조 설명은 반드시 '형식 문장'으로 작성
- "○○을 설명한다" ❌
- "시청자의 ○○ 감정을 자극하며 ○○을 제기하는 구조" ⭕️

4. 내용 고유명사, 수치, 사례, 주제 단어 사용 금지
- 이 구조를 다른 모든 주제에 적용할 수 있어야 한다

5. 결과물은 '설명서 문장'처럼 작성
- AI가 이 구조를 그대로 따라 대본을 다시 만들 수 있어야 한다

출력 형식은 아래를 따르라.

[이 대본의 전체 구조 요약]
- …

[초반 15초 구조]
- …

[중반 전개 구조]
- …

[후반 마무리 구조]
- …

[이 구조의 핵심 특징]
- …`

  const userPrompt = `이제 아래 대본의 구조만 추출해라.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
대본:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${script}`

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
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`API 호출 실패: ${response.status} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("API 응답에서 내용을 찾을 수 없습니다.")
    }

    console.log("[analyzeBenchmarkScript] 분석 완료")
    return content.trim()
  } catch (error) {
    console.error("[analyzeBenchmarkScript] 분석 실패:", error)
    throw error
  }
}

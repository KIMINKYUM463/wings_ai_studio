"use server"

import Anthropic from "@anthropic-ai/sdk"

/**
 * 이미지 스타일 이름을 한국어로 변환하는 함수
 */
function getImageStyleName(style: string): string {
  const styleMap: Record<string, string> = {
    "stickman-animation": "스틱맨 애니메이션",
    "flat-2d-illustration": "플랫 2D 일러스트",
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
  | "reserve_army" | "elementary_school"

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
export async function generateImagePrompt(
  scriptText: string,
  openaiApiKey: string,
  category: string = "health",
  historyStyle?: string,
  commonStylePrompt?: string, // 전체 대본의 공통 스타일 프롬프트
  topic?: string // 주제 (시대적 배경 파악용)
): Promise<string> {
  if (!openaiApiKey) {
    throw new Error("OpenAI API 키가 필요합니다.")
  }

  try {
    // 시대적 배경 추출 함수 (주제나 대본에서 시대 파악)
    const extractHistoricalPeriod = async (text: string, topicText?: string): Promise<string | null> => {
      if (category !== "history") {
        return null // 역사 카테고리가 아니면 시대 추출 불필요
      }

      const analysisText = topicText ? `${topicText}\n\n${text}` : text
      
      const periodPrompt = `다음 주제나 대본 텍스트를 분석하여 시대적 배경을 파악해주세요:

${analysisText}

다음 형식으로만 응답하세요:
PERIOD: [시대적 배경을 영어로 표현]

예시:
- 고려시대 → PERIOD: Goryeo Dynasty (918-1392), Korean medieval period
- 조선시대 → PERIOD: Joseon Dynasty (1392-1897), Korean Joseon era
- 삼국시대 → PERIOD: Three Kingdoms Period (57 BC-668 AD), ancient Korea
- 현대 → PERIOD: modern era, contemporary period
- 고대 그리스 → PERIOD: ancient Greece, classical Greek period
- 중세 유럽 → PERIOD: medieval Europe, Middle Ages
- 중국 당나라 → PERIOD: Tang Dynasty (618-907), ancient China

시대를 파악할 수 없으면 "PERIOD: historical period"로 응답하세요.`

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
                content: "You analyze text to identify historical periods. Respond only in the specified format.",
              },
              {
                role: "user",
                content: periodPrompt,
              },
            ],
            max_tokens: 100,
            temperature: 0.3,
          }),
        })

        if (periodResponse.ok) {
          const periodData = await periodResponse.json()
          const periodText = periodData.choices?.[0]?.message?.content || ""
          const periodMatch = periodText.match(/PERIOD:\s*(.+)/i)
          
          if (periodMatch) {
            return periodMatch[1].trim()
          }
        }
      } catch (error) {
        console.warn("[Longform] 시대적 배경 추출 실패:", error)
      }
      
      return null
    }

    // 시대적 배경 추출
    const historicalPeriod = await extractHistoricalPeriod(scriptText, topic)

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

    const systemPrompt = `당신은 이미지 생성 프롬프트 전문가입니다. 주어진 텍스트를 바탕으로 고품질 이미지를 생성할 수 있는 영어 프롬프트를 작성해주세요.

요구사항:
- 영어로만 작성
- 구체적이고 시각적으로 묘사
- 고품질, 전문적, 아름다운 이미지
- ${categoryGuide}
${historicalPeriod ? `- 시대적 배경: ${historicalPeriod} (이 시대적 배경을 프롬프트에 반드시 포함하고, 해당 시대의 건축, 의상, 무기, 생활 양식 등을 정확하게 반영하세요)` : ""}
${commonStylePrompt ? `- 전체 대본의 공통 스타일: ${commonStylePrompt} (이 스타일을 반드시 유지하세요)` : ""}
- 인물이 포함되지 않는 풍경, 사물, 개념 중심
- 16:9 비율에 최적화된 시네마틱한 구도
- 텍스트나 글씨 없음
${commonStylePrompt ? "- 모든 이미지가 동일한 스타일, 색감, 분위기를 유지하도록 작성하세요" : ""}

프롬프트 형식:
- 명사와 형용사를 사용한 구체적 묘사
- 스타일과 분위기 명시
- 색상과 조명 묘사
- 카메라 각도와 구도
${historicalPeriod ? `- 시대적 배경 요소를 포함: ${historicalPeriod} 시대의 건축, 의상, 무기, 생활 양식 등` : ""}
${commonStylePrompt ? `- 공통 스타일 요소를 포함: ${commonStylePrompt}` : ""}`

    const userPrompt = `다음 텍스트를 바탕으로 이미지 생성용 영어 프롬프트를 작성해주세요:

텍스트: ${scriptText}

카테고리: ${category}
${historyStyle ? `이미지 스타일: ${getImageStyleName(historyStyle)}` : ""}
${historicalPeriod ? `시대적 배경: ${historicalPeriod} (이 시대적 배경을 프롬프트에 반드시 포함하세요)` : ""}
${commonStylePrompt ? `\n중요: 전체 대본의 공통 스타일을 유지하세요: ${commonStylePrompt}` : ""}

위 텍스트의 핵심 내용을 시각적으로 표현할 수 있는 영어 프롬프트를 작성해주세요.${historicalPeriod ? ` 프롬프트에 "${historicalPeriod}" 시대적 배경을 반드시 포함하세요.` : ""} 프롬프트만 작성하고 설명은 추가하지 마세요.`

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
    let prompt = data.choices?.[0]?.message?.content

    if (!prompt) {
      throw new Error("프롬프트 생성에 실패했습니다.")
    }

    // 프롬프트 정리 (불필요한 설명 제거)
    let cleanPrompt = prompt
      .trim()
      .replace(/^프롬프트[:\s]*/i, "")
      .replace(/^Prompt[:\s]*/i, "")
      .replace(/^Here is.*?:/i, "")
      .trim()

    // 특정 스타일인 경우 특별한 프롬프트 템플릿 적용 (모든 카테고리)
    // 기존 animation 스타일은 호환성을 위해 유지
    if (historyStyle === "animation" || historyStyle === "stickman-animation" || historyStyle === "flat-2d-illustration" || historyStyle === "semi-realistic-animation" || historyStyle === "vintage-illustration" || historyStyle === "dark-fantasy-concept") {
      // 대본 텍스트에서 주체, 배경, 행동 추출
      // 간단한 추출: 주체는 명사, 배경은 장소/환경, 행동은 동사
      const extractElements = async (text: string) => {
        const extractionPrompt = `다음 텍스트에서 이미지 생성에 필요한 요소를 추출해주세요:
        
텍스트: ${text}
카테고리: ${category}
${historicalPeriod ? `시대적 배경: ${historicalPeriod}` : ""}

다음 형식으로만 응답하세요 (한 줄씩):
SUBJECT: [주체/인물/대상 - 카테고리에 맞는 주체]
SETTING: [배경/장소/환경 - ${historicalPeriod ? historicalPeriod + " 시대의" : ""} ${category} 카테고리에 맞는 배경]
ACTION: [행동/동작/상황]

예시:
SUBJECT: ${category === "health" ? "healthy person" : category === "wisdom" ? "wise figure" : "main character"}
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
            const extractionText = extractionData.choices?.[0]?.message?.content || ""
            
            const subjectMatch = extractionText.match(/SUBJECT:\s*(.+)/i)
            const settingMatch = extractionText.match(/SETTING:\s*(.+)/i)
            const actionMatch = extractionText.match(/ACTION:\s*(.+)/i)
            
            return {
              subject: subjectMatch ? subjectMatch[1].trim() : "historical figure",
              setting: settingMatch ? settingMatch[1].trim() : "ancient battlefield",
              action: actionMatch ? actionMatch[1].trim() : "in dramatic pose",
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
      
      let stylePrompt = ""
      
      switch (historyStyle) {
        case "stickman-animation":
          stylePrompt = `STICKMAN ANIMATION STYLE — clean 2D vector line art, bold black outline, pure white stickman body, round head, thick limbs, full-body visible, centered composition, high contrast, minimal shading, flat colors only, simple geometry, no gradients.

CHARACTER ANCHOR (MUST BE IDENTICAL IN EVERY IMAGE):
Same head size and shape, same facial feature placement, same outline thickness, same body proportions, same limb thickness, same posture style, same signature accessory: red scarf (must appear clearly in every image). Keep the stickman design extremely consistent across scenes. Do not change the character's style, proportions, or accessory.

SCENE SETUP:
Time period: ${historicalPeriod || "relevant historical period"}.
Location: ${elements.setting}${periodContext}${categoryContext}.
Mood: appropriate to the scene context.
Background: plain, uncluttered, minimal props only (1–3 simple props). Keep background simple and readable.

ACTION (CLEAR & READABLE):
Main action: ${elements.action}. Pose must be easy to understand at a glance. Avoid complex motion blur or extreme foreshortening.

CAMERA & FRAMING (YOUTUBE SAFE):
Wide shot, eye-level camera, subject centered. Leave generous safe margins on all sides for 16:9 cropping (no limbs cut off). Keep the character fully inside frame, full body visible, feet visible.

QUALITY & OUTPUT RULES:
Crisp vector edges, clean lines, consistent stroke weight. No text, no captions, no speech bubbles, no logos, no watermark, no photorealism. No extra characters unless explicitly specified.`
          break
          
        case "flat-2d-illustration":
          stylePrompt = `A ${elements.subject} in a ${elements.setting}${periodContext}${categoryContext}, ${elements.action}. flat 2D illustration style, vector art, bold colors, clean shapes, no gradients, minimal shadows, graphic design aesthetic, modern flat design, vibrant color palette, 16:9 aspect ratio. NEGATIVE: 3D rendering, realistic textures, depth, shadows, gradients, photorealistic, detailed rendering.`
          break
          
        case "semi-realistic-animation":
          stylePrompt = `A ${elements.subject} in a ${elements.setting}${periodContext}${categoryContext}, ${elements.action}. semi-realistic animation style, 2D animation with 3D depth, stylized realism, smooth shading, vibrant colors, cinematic lighting, dynamic composition, high-quality animation art, 16:9 aspect ratio. NEGATIVE: photorealistic, documentary photo, flat illustration, stickman, overly realistic textures.`
          break
          
        case "vintage-illustration":
          stylePrompt = `A ${elements.subject} in a ${elements.setting}${periodContext}${categoryContext}, ${elements.action}. vintage illustration style, retro aesthetic, classic illustration, aged paper texture, muted color palette, nostalgic feel, traditional illustration techniques, 16:9 aspect ratio. NEGATIVE: modern digital art, bright colors, contemporary style, 3D render, photorealistic.`
          break
          
        case "dark-fantasy-concept":
          stylePrompt = `A ${elements.subject} in a ${elements.setting}${periodContext}${categoryContext}, ${elements.action}. dark fantasy concept art style, cinematic fantasy art, high-detail painterly rendering, movie-poster quality lighting with strong contrast, dramatic rim light and sharp highlights, realistic metal/leather/fabric texture rendering, warm brown + muted gray color grading, epic mood, atmospheric fog/haze/dust, floating embers/particles, shallow depth of field, atmospheric perspective, dynamic cinematic composition, high-end concept art for film/AAA game${periodContext ? `, ${historicalPeriod} period accurate details` : ""}, 16:9, high resolution. NEGATIVE: different face, different person, altered identity, face morph, wrong ethnicity, age change, weight change, asymmetrical eyes, deformed hands, extra fingers, missing fingers, bad anatomy, duplicated limbs, distorted weapon, blurry main subject, low detail, flat lighting, low contrast, oversaturated, cartoon, anime, flat illustration, vector art, line art, cel shading, 3D render, plastic skin, photoreal snapshot, documentary photo, watermark, logo, text.`
          break
          
        case "animation":
        default:
          // 기존 애니메이션 스타일 (호환성)
          stylePrompt = `A ${elements.subject} in a ${elements.setting}${periodContext}${categoryContext}, ${elements.action}. cinematic fantasy concept art style, semi-realistic digital painting, high-detail painterly rendering, movie-poster quality lighting with strong contrast, dramatic rim light and sharp highlights, realistic metal/leather/fabric texture rendering, warm brown + muted gray color grading, epic battlefield mood, atmospheric fog/haze/dust, floating embers/particles, shallow depth of field, atmospheric perspective, background soldiers/flags softly blurred, main subject razor sharp, dynamic cinematic composition, high-end concept art for film/AAA game${periodContext ? `, ${historicalPeriod} period accurate details` : ""}, 16:9, high resolution. NEGATIVE: different face, different person, altered identity, face morph, wrong ethnicity, age change, weight change, asymmetrical eyes, deformed hands, extra fingers, missing fingers, bad anatomy, duplicated limbs, distorted weapon, blurry main subject, low detail, flat lighting, low contrast, oversaturated, cartoon, anime, flat illustration, vector art, line art, cel shading, 3D render, plastic skin, photoreal snapshot, documentary photo, watermark, logo, text.`
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

  // 6. 스틱맨 강화 규칙 추가
  const stickmanRules = "EVERY person is a stickman, no exceptions. Bride is a stickman. Groom is a stickman. All guests and guards are stickmen. stickman style rules: white circular face, dot eyes, curved mouth only, no hair, no ears, no nose, no blush, no eyelashes, black thin outline body, ultra-thin limbs, uniform stroke width, no body volume, mitten hands, no fingers. 2D vector cartoon, flat cel shading, thick bold outlines, solid color fills, crisp edges, minimal texture. wide shot / medium-wide shot, full bodies visible, at least 8–15 stickman people visible, palace hall background, wedding ceremony handshake scene, background crowd also stickmen, consistent stickman design for every character"

  // 7. 모든 요소 결합 (샘플 형식과 동일한 순서)
  return `${finalPrompt}, ${base}, ${stylePhrase}, ${extra}, ${stickmanRules}`
}

/**
 * Replicate API를 사용하여 이미지 생성
 * 
 * @param prompt - 이미지 생성 프롬프트 (영어)
 * @param replicateApiKey - Replicate API 키
 * @param aspectRatio - 이미지 비율 ("16:9", "9:16", "1:1")
 * @param imageStyle - 이미지 스타일 (예: "stickman-animation")
 * @param sceneDescription - 장면 설명 (스틱맨 스타일일 때 사용)
 * @returns 생성된 이미지 URL
 */
export async function generateImageWithReplicate(
  prompt: string,
  replicateApiKey: string,
  aspectRatio: "16:9" | "9:16" | "1:1" = "16:9",
  imageStyle?: string,
  sceneDescription?: string
): Promise<string> {
  if (!replicateApiKey) {
    throw new Error("Replicate API 키가 필요합니다.")
  }

  try {
    console.log(`[Longform] Replicate 이미지 생성 시작, 비율: ${aspectRatio}, 스타일: ${imageStyle || "기본"}`)

    // 이미지 스타일에 따라 모델 선택
    let model = "black-forest-labs/flux-pro"
    if (imageStyle === "stickman-animation") {
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
    console.log(`[Longform] 프롬프트 사용: ${finalPrompt.substring(0, 100)}...`)

    // 모델별 입력 형식 설정
    let inputBody: any = {}
    if (model === "prunaai/hidream-l1-fast") {
      // hidream-l1-fast 모델용 입력 형식 (스틱맨 애니메이션)
      inputBody = {
        prompt: finalPrompt,
        width: 1360, // 스틱맨 애니메이션 전용 해상도
        height: 768,
        negative_prompt: "realistic human, detailed human skin, photograph, 3d render, blank white background, line-art only, text, watermark, non-stickman, mixed style, detailed cartoon human, prince, princess, disney, pixar, anime, chibi, kawaii, big head, human body, human skin, realistic, 3d render, semi-realistic, detailed face, eyelashes, blush, nose, lips, hair, ears, detailed clothing folds, portrait, close-up, single character focus, bokeh, depth of field, watercolor, painterly, airbrush, soft shading",
        num_inference_steps: 16,
        image_format: "png",
      }
    } else {
      // flux-pro 모델용 입력 형식 (1360x768로 통일)
      inputBody = {
        prompt: finalPrompt,
        width: 1360,
        height: 768,
        output_format: "png",
        output_quality: 90,
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
 * 롱폼 비디오 주제 생성 함수
 */
export async function generateTopics(
  category: string,
  keywords?: string,
  trendingData?: any,
  apiKey?: string
): Promise<string[]> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.")
  }

  const categoryPrompts: Record<string, string> = {
    health: "건강, 웰빙, 생활 꿀팁과 관련된 롱폼 비디오 주제",
    history: "역사 이야기, 역사적 사실과 관련된 롱폼 비디오 주제",
    wisdom: "인생 명언, 지혜, 철학과 관련된 롱폼 비디오 주제",
    self_improvement: "자기계발, 성장과 관련된 롱폼 비디오 주제",
    society: "사회 트렌드, 최신 이슈와 관련된 롱폼 비디오 주제",
    space: "우주, 천문학과 관련된 롱폼 비디오 주제",
    fortune: "사주, 운세와 관련된 롱폼 비디오 주제",
    reserve_army: "예비군 이야기, 예비군 경험과 관련된 롱폼 비디오 주제",
    elementary_school: "국민학교 시절, 추억과 관련된 롱폼 비디오 주제",
  }

  try {
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
            content: "당신은 롱폼 비디오 콘텐츠 전문가입니다. 사용자가 제공하는 카테고리 설명을 바탕으로 해당 카테고리에 맞는 주제 15개를 반드시 생성해주세요. 주제만 생성하고, 사과 메시지나 설명은 절대 포함하지 마세요. 각 주제는 번호를 붙여서 작성해주세요 (예: 1. 주제명).",
          },
          {
            role: "user",
            content: `다음 카테고리에 해당하는 롱폼 비디오 주제 15개를 생성해주세요:\n\n카테고리 설명: ${categoryPrompt}${keywordsText}\n\n요구사항:\n- 주제 15개를 반드시 생성해주세요\n- 각 주제는 한 줄로 간결하게 작성\n- 번호 형식: 1. 주제명\n- 사과 메시지나 설명 없이 주제만 작성\n\n주제 목록:`,
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
 * 대본 기획안 생성 함수
 */
export async function generateScriptPlan(
  topic: string,
  category: string,
  keywords?: string,
  apiKey?: string,
  videoDurationMinutes?: number, // 영상 길이 (분)
  referenceScript?: string // 레퍼런스 대본
): Promise<string> {
  const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.")
  }

  const duration = videoDurationMinutes || 5 // 기본값 5분

  try {
    const systemPrompt = `당신은 '지식 스토리텔링 전문 기획자'입니다.

당신의 임무는 사용자가 이미 선택한 [주제]를 바탕으로,
본격적인 대본 작성을 위한 '대본 기획안(스토리 설계도)'을 만드는 것입니다.

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
[콘텐츠 구조 선택]
────────────────────────
아래 3가지 중, 주제에 가장 적합한 구조를 **하나만 선택**하여 기획하시오.

● Type A. 단일 서사 심층형
- 하나의 사건, 인물, 역사적 이야기
- 기승전결 + 감정 곡선 중심

● Type B. 컴필레이션 / 목록형
- 하나의 대주제 아래 3~5개의 사례
- 각 사례는 '미니 스토리' 구조

● Type C. 다각도 탐구형
- 하나의 대상을 여러 관점으로 분해
- 논리적 흐름 + 점층적 몰입

선택한 타입을 명확히 밝히고 기획을 진행할 것.

────────────────────────
[기획 산출물 형식]
────────────────────────
아래 형식을 반드시 지켜서 출력하십시오.

1) 선택한 콘텐츠 타입
- Type A / B / C 중 하나

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
- 오직 기획안만 출력하십시오. 추가 설명이나 메타 정보는 포함하지 마십시오.

────────────────────────
[프롬프트 실행]
────────────────────────
아래 [주제]를 바탕으로 위 모든 조건을 충족하는
'대본 기획안'을 작성하십시오.

⚠️ 중요: 출력은 반드시 기획안만 포함해야 합니다.
- 제작자 노트, 체크리스트, 파트 구분, 글자수, 메타 정보는 절대 포함하지 마십시오.
- 대본 문장, 내레이션, 대사는 절대 포함하지 마십시오.
- 오직 1)~6) 기획 산출물 형식만 출력하십시오.`

    const userPrompt = `[주제]: ${topic}`

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
  isStoryMode: boolean = false // 스토리 형태 모드 (기본값: false = 교훈형)
): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }

  try {
    let systemPrompt: string
    let userPrompt: string

    if (isStoryMode) {
      // 스토리형 프롬프트
      systemPrompt = `*(2) 대본 작성

너는 지금부터 (유튜브 대본 전문가)야 사람들의 공감을 불러일으켜야 하고 사람들이 너의 이야기를 듣고 싶도록 설명을 해야해.

내 채널은 사연, 이야기를 다루는 채널이니 위 개요를 기반으로 유튜브 대본을 작성해줘.

아래 사항들을 모두 만족시켜야 하고 내가 말한 아래 사항들을 어디에 어떻게 적용했는지 대본과 별도로 제일 밑 "제작자 노트" 공간을 따로 만들어서 체크리스트로 보여줘

#1.컨셉 (Concept)

1.1 시청 타겟은 50~70대 남녀 모두로 사람들의 공감 혹은 궁금함을 불러 일으키는 이야기로 만들어줘, "나에게도 일어날 수 있는/나 혹은 주변 지인에게 필요한 것"이라는 느낌을 줘야한다.

1.2 이야기를 설명하는 화자와 등장인물이 있는데 등장인물의 대사는 큰 따옴표를 이용해 넣어주고 대사의 마지막 부분에 괄호치고 누구의 대사인지, 남자인지 여자인지도 적어줘. 이렇게 하는 이유는 TTS를 사용할 때 등장인물을 구분하기 위해서니 더 좋은 방법이 있다면 그걸로 구분해줘

1.3 톤앤매너, 듣는 사람이 계속 궁금하도록 화자가 화두를 던지고 등장 인물들이 풀어가는 과정을 나타내야한다.

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

    let systemPrompt: string

    if (isStoryMode) {
      // 스토리형 프롬프트
      systemPrompt = `*(3) 글의 재구성, 검수

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
 */
export async function generateFullScript(
  scriptPlan: string,
  topic: string,
  category: string,
  apiKey?: string,
  videoDurationMinutes?: number // 영상 길이 (분)
): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }

  const duration = videoDurationMinutes || 5 // 기본값 5분
  const totalCharacters = duration * 300 // 1분당 약 300자 (TTS 기준)

  try {
    const systemPrompt = `당신은 롱폼 비디오 대본 작성 전문가입니다. 기획안을 바탕으로 완성도 높은 대본을 작성해주세요.

요구사항:
- 자연스럽고 매력적인 대화체
- 기획안의 구조를 따르되 유연하게 작성
- 시청자의 관심을 유지하는 흐름
- 섹션 헤더나 제목 없이 순수한 대본 내용만 작성
- 총 영상 길이: 정확히 ${duration}분 (약 ${totalCharacters}자)
- 대본 전체 분량: ${totalCharacters}자 내외로 작성`

    const userPrompt = `주제: ${topic}
카테고리: ${category}
영상 길이: ${duration}분 (약 ${totalCharacters}자)

기획안:
${scriptPlan}

위 기획안을 바탕으로 정확히 ${duration}분 분량(약 ${totalCharacters}자)의 완성도 높은 대본을 작성해주세요. 대본만 작성하고 다른 설명은 하지 마세요.`

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
  apiKey?: string
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
  duration: 1 | 2 | 3,
  openaiApiKey?: string
): Promise<string> {
  // 서버 액션: 대본을 쇼츠 길이에 맞게 요약
  const GPT_API_KEY = openaiApiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.")
  }

  if (!script || script.trim().length === 0) {
    throw new Error("대본이 없습니다.")
  }

  try {
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
      throw new Error(`API 호출 실패: ${response.status} ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    const summarizedScript = data.choices[0]?.message?.content?.trim()

    if (!summarizedScript) {
      throw new Error("요약된 대본을 생성할 수 없습니다.")
    }

    return summarizedScript
  } catch (error) {
    console.error("[Longform] 대본 요약 실패:", error)
    throw error
  }
}

export async function generateAIThumbnail(
  topic: string,
  replicateApiKey: string,
  imageStyle?: string,
  customText?: string
): Promise<string> {
  if (!replicateApiKey) {
    throw new Error("Replicate API 키가 필요합니다.")
  }

  try {
    console.log(`[Longform] AI 썸네일 생성 시작, 주제: ${topic}, 이미지 스타일: ${imageStyle || "기본"}`)

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
    let basePrompt = `YouTube thumbnail for video about: ${topic}. High quality, eye-catching, professional thumbnail design. Bright colors, clear text area, engaging composition. 16:9 aspect ratio.`
    
    // 커스텀 문구가 있으면 프롬프트에 추가
    if (customText && customText.trim()) {
      basePrompt = `${basePrompt} Include text or visual elements related to: "${customText.trim()}".`
    }
    
    const prompt = stylePrompt ? `${basePrompt} ${stylePrompt}` : basePrompt

    const response = await fetch("https://api.replicate.com/v1/models/google/nano-banana-pro/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${replicateApiKey}`,
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          aspect_ratio: "16:9",
          output_format: "png",
        },
      }),
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

/**
 * 이미지를 영상으로 변환하는 함수
 * Replicate의 wan-video/wan-2.2-i2v-fast 모델 사용
 */
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
 * 후킹 영상 프롬프트 생성 함수 (소라2용 30초 후킹 영상)
 * Gemini API를 사용하여 30초 후킹 영상 프롬프트를 생성합니다.
 * 
 * @param topic - 영상 주제
 * @param script - 대본 내용 (선택사항)
 * @param geminiApiKey - Gemini API 키
 * @returns 후킹 영상 프롬프트
 */
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
    const systemInstruction = `You are an expert video prompt engineer specializing in creating 30-second hooking video prompts for Sora 2 (text-to-video AI model).

Your task is to create a detailed, cinematic video prompt that:
1. Captures attention in the first 3 seconds with a strong visual hook
2. Maintains engagement throughout the 30-second duration
3. Is optimized for Sora 2's text-to-video generation capabilities
4. Includes specific visual details, camera movements, lighting, and composition
5. Creates a compelling narrative arc within 30 seconds

The prompt should be:
- Written in English
- Highly detailed with visual descriptions
- Include camera movements (zoom, pan, dolly, etc.)
- Specify lighting and atmosphere
- Describe composition and framing
- Include any relevant visual effects or transitions
- Be optimized for 30-second video generation

Output only the video prompt, no explanations or additional text.`

    const userPrompt = script
      ? `Topic: ${topic}

Script content:
${script}

Create a detailed 30-second hooking video prompt for Sora 2 based on the above topic and script. The prompt should create a visually compelling video that hooks viewers from the first 3 seconds.`
      : `Topic: ${topic}

Create a detailed 30-second hooking video prompt for Sora 2 based on the above topic. The prompt should create a visually compelling video that hooks viewers from the first 3 seconds.`

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
                  text: `${systemInstruction}\n\n${userPrompt}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("[Hooking Video] Gemini API 오류:", response.status, errorData)
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("API 응답 형식이 올바르지 않습니다.")
    }

    const prompt = data.candidates[0].content.parts[0].text.trim()

    if (!prompt) {
      throw new Error("생성된 프롬프트가 비어있습니다.")
    }

    console.log("[Hooking Video] 프롬프트 생성 완료")
    return prompt
  } catch (error) {
    console.error("[Hooking Video] 프롬프트 생성 실패:", error)
    throw error
  }
}
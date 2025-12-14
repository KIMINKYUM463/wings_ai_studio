"use server"

import Anthropic from "@anthropic-ai/sdk"

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
  historyStyle?: string
): Promise<string> {
  if (!openaiApiKey) {
    throw new Error("OpenAI API 키가 필요합니다.")
  }

  try {
    // 카테고리별 프롬프트 가이드
    const categoryGuides: Record<string, string> = {
      health: "건강, 웰빙, 생활 꿀팁과 관련된 이미지. 밝고 깔끔한 스타일, 전문적이고 신뢰감 있는 느낌.",
      history: historyStyle 
        ? `역사적 이미지, ${historyStyle} 스타일. 역사적 사실과 배경을 정확하게 반영.`
        : "역사적 이미지. 역사적 사실과 배경을 정확하게 반영. 고전적이고 장엄한 스타일.",
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
- 인물이 포함되지 않는 풍경, 사물, 개념 중심
- 16:9 비율에 최적화된 시네마틱한 구도
- 텍스트나 글씨 없음

프롬프트 형식:
- 명사와 형용사를 사용한 구체적 묘사
- 스타일과 분위기 명시
- 색상과 조명 묘사
- 카메라 각도와 구도`

    const userPrompt = `다음 텍스트를 바탕으로 이미지 생성용 영어 프롬프트를 작성해주세요:

텍스트: ${scriptText}

카테고리: ${category}
${historyStyle ? `역사 스타일: ${historyStyle}` : ""}

위 텍스트의 핵심 내용을 시각적으로 표현할 수 있는 영어 프롬프트를 작성해주세요. 프롬프트만 작성하고 설명은 추가하지 마세요.`

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
    const prompt = data.choices?.[0]?.message?.content

    if (!prompt) {
      throw new Error("프롬프트 생성에 실패했습니다.")
    }

    // 프롬프트 정리 (불필요한 설명 제거)
    const cleanPrompt = prompt
      .trim()
      .replace(/^프롬프트[:\s]*/i, "")
      .replace(/^Prompt[:\s]*/i, "")
      .replace(/^Here is.*?:/i, "")
      .trim()

    return cleanPrompt
  } catch (error) {
    console.error("[Longform] 이미지 프롬프트 생성 실패:", error)
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
 * Replicate API를 사용하여 이미지 생성
 * 
 * @param prompt - 이미지 생성 프롬프트 (영어)
 * @param replicateApiKey - Replicate API 키
 * @param aspectRatio - 이미지 비율 ("16:9", "9:16", "1:1")
 * @returns 생성된 이미지 URL
 */
export async function generateImageWithReplicate(
  prompt: string,
  replicateApiKey: string,
  aspectRatio: "16:9" | "9:16" | "1:1" = "16:9"
): Promise<string> {
  if (!replicateApiKey) {
    throw new Error("Replicate API 키가 필요합니다.")
  }

  try {
    console.log(`[Longform] Replicate 이미지 생성 시작, 비율: ${aspectRatio}`)

    // Replicate에서 사용 가능한 이미지 생성 모델
    // flux-pro 또는 stable-diffusion-xl 사용
    const model = "black-forest-labs/flux-pro"

    // aspect ratio를 Replicate 형식으로 변환
    const aspectRatioMap: Record<string, string> = {
      "16:9": "16:9",
      "9:16": "9:16",
      "1:1": "1:1",
    }

    const replicateAspectRatio = aspectRatioMap[aspectRatio] || "16:9"

    // API 호출
    const response = await fetch("https://api.replicate.com/v1/models/" + model + "/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${replicateApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          aspect_ratio: replicateAspectRatio,
          output_format: "webp",
          output_quality: 90,
        },
      }),
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
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }

  const duration = videoDurationMinutes || 5 // 기본값 5분

  try {
    const systemPrompt = `*(1) 주제, 개요작성

위 글은 타인의 유튜브 대본이야.

혹시나 성적으로 노골적인 표현과 유튜브 정책을 위반하는 부분이 있다면 제거해줘

나는 이걸 기반으로 유튜브 대본을 작성할거고 그 전에 이 주제에 대해 새로운 전개방식을 창작해줘

그래서 이제부터 너는 유튜브 기획자고 본격적으로 대본을 작성하기 전에 아래 내용들을 충족시키는 새로운 유튜브 대본 개요를 작성해줘



#1.시청 대상타겟 (Main Target)

나는 50~70대 시니어들을 대상으로 유튜브 채널을 운영하는 사람이야.

따라서 해당 연령대 분들에게 필요한 내용으로 기획해야한다.



#2. 세부목표 (Goal)

같은 주제로 이번 프로젝트를 통해 색다른 관점과 표현으로 새로운 개요 작성(저작권 침해 목적이 아니다.)

일반적인 정보나 팁을 새로운 방식으로 재구성해서 사람들의 관심을 얻는다.

주제와 관련되어 공개된 사실이나 공신력 있는 데이터를 인용하며 활용하여 내용을 더욱 흥미롭게 만든다.

사람들의 공감을 불러 일으키는 익숙한 사례와 예시를 넣어 "나에게도 일어날 수 있는/나 혹은 주변 지인에게 필요한 것"이라는 느낌을 줘야한다.



#3. 주의할 점 (Warning)

저작권으로 인정되는 것들을 *절대로* 위배하지 않는다.

원본의 독특한 구성이나 스토리텔링 방식을 그대로 베끼지 않기

특정 문장이나 표현을 직접 복사하지 않기

영상의 창작적 요소(예: 독특한 비유, 캐릭터, 등장 인물 등)를 가져오지 않기



#4. 커스터마이징 (Customizing)

영상 기획시 시,분,초에 해당하는 내용은 필요하지 않고 전체적인 흐름만 나타나게 해줘

기존 영상과 달리 새로 창작해서 추가된 차별화된 포인트를 요약해줘`

    // 카테고리별 추가 지시사항 가져오기
    const categoryCustom = categoryPromptCustomizations[category] || categoryPromptCustomizations.default
    const categoryPlanNote = categoryCustom.plan ? `\n\n[카테고리별 추가 지시사항]\n${categoryCustom.plan}` : ""

    const userPrompt = `주제: ${topic}
카테고리: ${category}
${keywords ? `키워드: ${keywords}` : ""}
영상 길이: ${duration}분
${referenceScript ? `\n레퍼런스 대본:\n${referenceScript}` : ""}

위 주제로 새로운 유튜브 대본 개요를 작성해주세요.${referenceScript ? " 레퍼런스 대본을 참고하되, 저작권을 침해하지 않도록 새로운 관점과 표현으로 재구성해주세요." : ""}${categoryPlanNote}`

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
  category?: string
): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }

  try {
    const systemPrompt = `*(2) 대본 작성

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

    const userPrompt = `주제: ${topic}

개요:
${scriptPlan}

위 개요를 기반으로 유튜브 대본을 작성해주세요. 대본 분량은 핵심으로 작성하고, 대본 작성 후 "제작자 노트" 섹션을 별도로 만들어서 위 요구사항들을 어디에 어떻게 적용했는지 체크리스트로 보여줘.`

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
export async function generateFinalScript(
  scriptDraft: string,
  topic: string,
  apiKey?: string,
  duration?: number,
  targetChars?: number,
  category?: string
): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }

  try {
    const durationText = duration ? `${duration}분` : "적절한 분량"
    const charsText = targetChars ? `${targetChars}자` : "적절한 분량"

    const systemPrompt = `*(3) 글의 재구성, 검수

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

2.2 글쓰기 포맷을 적용한 최종 대본은 내가 알려준 포맷별로 파트가 드러날 필요는 없고 별도로 너가 재구성한 글이 내가 요청한 A,I,P,A,S,O,A를  만족시키는지 각 파트별로 A(Attention, 주의)가 어느부분에 해당하는지 표시한 제작자 노트용 대본을 밑에 별도로 하나 더 만들어 줘 

2.3 작성된 대본을 가지고 그대로 TTS를 이용할 것이기 때문에 괄호나 대괄호를 사용하지마

주의사항

- 숫자를 읽을때 '1번' -> 한번 으로 변경해줘. 그리고 단위같은것도 한국어로 바로 읽을수있게 해줘 - 년도는 숫자로 해줘. 예를들어 1930년 이렇게. - 나이는 한글로읽는게 아니라 숫자로 이야기해줘. 예를들어 68세.. - 밀리그램 앞에 숫자는 한글이 아니라 숫자로 해줘. 예를들어 400밀리그램.. - 시간을 말할때는 한국어로 말해줘 10시 -> 열시 이렇게말이야.`

    // 카테고리별 추가 지시사항 가져오기
    const categoryCustom = category ? (categoryPromptCustomizations[category] || categoryPromptCustomizations.default) : categoryPromptCustomizations.default
    const categoryFinalNote = categoryCustom.final ? `\n\n[카테고리별 추가 지시사항]\n${categoryCustom.final}` : ""

    const userPrompt = `주제: ${topic}

대본 초안:
${scriptDraft}

위 대본 초안을 AIPASOA 포맷으로 재구성해주세요. 글자수는 ${charsText} 정도, 영상 길이는 ${durationText} 이상으로 작성해주세요.${categoryFinalNote}`

    // targetChars에 맞춰 max_tokens 계산 (1자당 약 1.3토큰, 여유를 위해 1.5배)
    const calculatedMaxTokens = targetChars ? Math.ceil(targetChars * 1.5) : 16000
    // GPT-4.1-mini의 최대 토큰 제한 고려 (일반적으로 16384 또는 8192)
    const maxTokens = Math.min(calculatedMaxTokens, 16384)

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
        max_tokens: maxTokens,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("최종 대본을 생성할 수 없습니다.")
    }

    return content.trim()
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
  replicateApiKey: string
): Promise<string> {
  if (!replicateApiKey) {
    throw new Error("Replicate API 키가 필요합니다.")
  }

  try {
    console.log(`[Longform] AI 썸네일 생성 시작, 주제: ${topic}`)

    // 유튜브 썸네일용 프롬프트 생성
    const prompt = `YouTube thumbnail for video about: ${topic}. High quality, eye-catching, professional thumbnail design. Bright colors, clear text area, engaging composition. 16:9 aspect ratio.`

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
 * Replicate의 minimax/hailuo-2.3-fast 모델 사용
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
    
    // minimax/hailuo-2.3-fast 모델 사용
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateApiKey}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version: "51f1ef5aa8a942ea1771f89df9e6c2e8e19a3ef9f306bf13e8d48b58a9c3d7ca",
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
      const videoUrl = typeof data.output === "string" ? data.output : data.output[0] || data.output.video
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

      if (statusData.status === "succeeded") {
        const videoUrl = typeof statusData.output === "string" 
          ? statusData.output 
          : statusData.output?.[0] || statusData.output?.video
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
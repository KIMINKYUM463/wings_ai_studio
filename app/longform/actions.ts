"use server"

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
  }

  try {
    const categoryPrompt = categoryPrompts[category] || categoryPrompts.health
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
            content: "당신은 롱폼 비디오 콘텐츠 전문가입니다. 주어진 카테고리를 바탕으로 5-15분 길이의 롱폼 비디오에 적합한 주제 10개를 생성해주세요.",
          },
          {
            role: "user",
            content: `카테고리: ${categoryPrompt}${keywordsText}\n\n위 카테고리를 바탕으로 롱폼 비디오에 적합한 주제 10개를 생성해주세요. 각 주제는 한 줄로 간결하게 작성해주세요.`,
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
        const topic = match[1].trim()
        if (topic && topic.length > 0) {
          topics.push(topic)
        }
      }
      if (topics.length >= 10) break
    }

    return topics.length > 0 ? topics : ["건강한 생활 습관", "역사의 숨겨진 이야기", "인생의 지혜"]
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
  videoDurationMinutes?: number // 영상 길이 (분)
): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }

  const duration = videoDurationMinutes || 5 // 기본값 5분

  try {
    const systemPrompt = `당신은 롱폼 비디오 대본 기획 전문가입니다. 정확히 ${duration}분 길이의 롱폼 비디오에 최적화된 대본 기획안을 작성해주세요.

구조:
[도입부] 첫 30초 안에 시청자를 사로잡는 강력한 훅 (약 30초)
[본론] 핵심 내용을 체계적으로 전달 (약 ${duration - 1}분)
[마무리] 핵심 요약과 CTA (약 30초)

특징:
- 깊이 있는 내용 전달
- 시각적 요소 활용
- 명확한 메시지 전달
- 완결성 있는 구성
- 총 영상 길이: 정확히 ${duration}분

총 500-1000자 내외의 기획안으로 작성해주세요.`

    const userPrompt = `주제: ${topic}
카테고리: ${category}
${keywords ? `키워드: ${keywords}` : ""}
영상 길이: ${duration}분

위 주제로 ${duration}분 길이의 롱폼 비디오에 최적화된 대본 기획안을 생성해주세요.`

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
  apiKey?: string
): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }

  try {
    const systemPrompt = `당신은 롱폼 비디오 대본 작성 전문가입니다. 기획안을 바탕으로 자연스럽고 매력적인 대본 초안을 작성해주세요.

요구사항:
- 자연스러운 대화체
- 기획안의 구조를 따르되 유연하게 작성
- 시청자의 관심을 유지하는 흐름
- 섹션 헤더나 제목 없이 순수한 대본 내용만 작성`

    const userPrompt = `주제: ${topic}

기획안:
${scriptPlan}

위 기획안을 바탕으로 대본 초안을 작성해주세요.`

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
 * 최종 대본 생성 함수
 */
export async function generateFinalScript(
  scriptDraft: string,
  topic: string,
  apiKey?: string,
  duration?: number,
  targetChars?: number
): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }

  try {
    const durationText = duration ? `${duration}분 분량` : "적절한 분량"
    const charsText = targetChars ? `(약 ${targetChars}자)` : ""

    const systemPrompt = `당신은 롱폼 비디오 대본 완성 전문가입니다. 초안을 바탕으로 최종 대본을 완성해주세요.

요구사항:
- ${durationText} ${charsText}
- 자연스럽고 매력적인 대화체
- 완성도 높은 내용
- 섹션 헤더나 제목 없이 순수한 대본 내용만 작성`

    const userPrompt = `주제: ${topic}

대본 초안:
${scriptDraft}

위 초안을 바탕으로 최종 대본을 완성해주세요.`

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
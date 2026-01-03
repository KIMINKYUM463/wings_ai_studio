"use server"

import { getEnvApiKey } from "@/lib/api-keys"

/**
 * Gemini API를 통해 이미지 프롬프트 생성
 */
async function generatePromptsWithGemini(
  systemPrompt: string,
  userPrompt: string,
  geminiApiKey: string
): Promise<string> {
  try {
    const response = await fetch("/api/gemini/generate-content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash", // Gemini 2.5 Flash 사용 (사용 불가 시 gemini-2.0-flash-exp로 변경 가능)
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\n${userPrompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        },
        apiKey: geminiApiKey,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // Gemini 응답 형식 파싱
    if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
      console.error("[Gemini] API 응답 오류:", data)
      throw new Error("Gemini API 응답 형식이 올바르지 않습니다.")
    }

    const content = data.candidates[0]?.content?.parts?.[0]?.text

    if (!content || typeof content !== "string") {
      console.error("[Gemini] 콘텐츠 없음:", data.candidates[0])
      throw new Error("Gemini 응답 내용이 없습니다.")
    }

    return content
  } catch (error) {
    console.error("[Gemini] 프롬프트 생성 실패:", error)
    throw error
  }
}

/**
 * 장면을 영어 이미지 프롬프트로 변환하는 함수
 * Scene별로 그룹화된 장면들을 영어 프롬프트로 변환
 */
/**
 * 주제나 대본에서 시대적 배경을 추출하는 함수
 */
export async function extractHistoricalContext(
  topic: string | undefined,
  script: string | undefined,
  openaiApiKey: string
): Promise<string | null> {
  if (!topic && !script) {
    return null
  }

  try {
    const contextText = script || topic || ""
    if (!contextText || contextText.trim().length === 0) {
      return null
    }

    // 사용자가 제공한 API 키 필수 사용
    if (!openaiApiKey || openaiApiKey.trim().length === 0) {
      throw new Error("OpenAI API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
    }
    const actualApiKey = openaiApiKey

    const prompt = `다음 주제나 대본에서 시대적 배경(시대, 시간대, 역사적 배경)을 추출해주세요.

${contextText.substring(0, 2000)}

위 텍스트에서 시대적 배경을 영어로 간단히 요약해주세요. 예를 들어:
- "Joseon Dynasty (1392-1897), traditional Korean historical period"
- "Modern era, 21st century"
- "Ancient China, Han Dynasty"
- "Medieval Europe, 14th century"

시대적 배경이 명확하지 않으면 "contemporary" 또는 "modern era"로 표시하세요.
영어로만 답변하고, 다른 설명은 하지 마세요.`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${actualApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a historical context analyzer. Extract the historical period or era from the given text and return it in English.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      console.warn("[시대적 배경 추출] API 호출 실패, 시대적 배경 없이 진행")
      return null
    }

    const data = await response.json()
    const historicalContext = data.choices?.[0]?.message?.content?.trim()

    if (historicalContext && historicalContext.length > 0) {
      console.log("[시대적 배경 추출] 추출된 배경:", historicalContext)
      return historicalContext
    }

    return null
  } catch (error) {
    console.warn("[시대적 배경 추출] 오류 발생, 시대적 배경 없이 진행:", error)
    return null
  }
}

/**
 * 단일 씬의 이미지 프롬프트를 생성하는 함수
 * @param sceneBlock - 씬 블록 텍스트
 * @param sceneNumber - 씬 번호
 * @param imageStyle - 이미지 스타일
 * @param customStylePrompt - 커스텀 스타일 프롬프트
 * @param historicalContext - 시대적 배경
 * @param stickmanCharacterDescription - 스틱맨 캐릭터 설명 (스틱맨 애니메이션용)
 * @param openaiApiKey - API 키 (설정에서 입력한 키 필수 사용)
 * @returns 씬의 이미지 프롬프트 배열
 */
export async function generateSingleSceneImagePrompts(
  sceneBlock: string,
  sceneNumber: number,
  imageStyle: string,
  customStylePrompt?: string,
  historicalContext?: string | null,
  stickmanCharacterDescription?: string | null,
  openaiApiKey?: string,
  realisticCharacterType?: "korean" | "foreign" | null
): Promise<Array<{ imageNumber: number; prompt: string; sceneText: string; visualInstruction?: string }>> {
  // 사용자가 제공한 API 키 필수 사용
  // 사용자가 제공한 API 키 필수 사용
  if (!openaiApiKey || openaiApiKey.trim().length === 0) {
    throw new Error("OpenAI API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
  }
  const actualApiKey = openaiApiKey

  if (!sceneBlock || sceneBlock.trim().length === 0) {
    throw new Error(`씬 ${sceneNumber} 블록이 비어있습니다.`)
  }

  // Scene 블록 내에서 모든 [장면 N] 패턴 찾기
  const imageRegex = /\[장면\s+(\d+)\]\s*\n([\s\S]*?)(?=\[장면\s+\d+\]|씬\s+\d+|$)/g
  const sceneImages: Array<{ imageNumber: number; text: string }> = []
  let imageMatch
  
  while ((imageMatch = imageRegex.exec(sceneBlock)) !== null) {
    const imageNum = parseInt(imageMatch[1])
    let imageText = imageMatch[2].trim()
    
    if (imageText && imageText.length > 0) {
      sceneImages.push({
        imageNumber: imageNum,
        text: imageText,
      })
    }
  }
  
  // 정규식으로 찾지 못한 경우 대체 방법 시도
  if (sceneImages.length === 0) {
    const flexibleRegex = /\[장면\s*(\d+)\][\s\n]*([\s\S]*?)(?=\[장면|\b씬|\s*$)/g
    let flexMatch
    while ((flexMatch = flexibleRegex.exec(sceneBlock)) !== null) {
      const imageNum = parseInt(flexMatch[1])
      let imageText = flexMatch[2].trim()
      if (imageText && imageText.length > 0) {
        sceneImages.push({
          imageNumber: imageNum,
          text: imageText,
        })
      }
    }
  }
  
  if (sceneImages.length === 0) {
    console.warn(`[프롬프트 생성] Scene ${sceneNumber}에서 장면을 찾을 수 없습니다.`)
    return []
  }

  // 시스템 프롬프트 생성 (기존 로직과 동일)
  const systemPrompt = `너는 장면 기반 이미지 프롬프트 생성기다.

입력은 이미 장면(Scene) 단위로 분리된 한국어 텍스트이며,
너의 작업은 다음 순서를 반드시 따른다. 먼저 이미지 스타일에 따라
인물을 부여하고 그 인물은 각 장면에 일관성있게 무조건 유지되어야한다.
인물이 많으면 그 인물들도 다 일관성있게 유지되어야 한다.

**⚠️ 필수 규칙 (모든 스타일 공통):**
1. 이미지에 텍스트, 글씨, 문자, 단어, 라벨, 표지판, 워터마크가 절대 포함되면 안 됩니다.
2. 프롬프트에 반드시 "no text", "no letters", "no words", "no writing", "no labels", "no signs", "no watermark"를 포함해야 합니다.
3. 이미지에 어떤 종류의 텍스트도 나타나면 안 됩니다.

**애니메이션2 스타일의 경우:**
- ⚠️ 스틱맨(stickman)이 절대 나오면 안 됩니다. 이것은 최우선 규칙입니다.
- 프롬프트에 "stickman", "stick figure", "stick man", "stick-man", "stick-figure" 등의 단어를 절대 사용하지 마세요.
- "of the stickman", "aesthetic of the stickman", "cartoon aesthetic of the stickman" 같은 표현도 절대 사용하지 마세요.
- 일반적인 스타일화된 카툰 캐릭터를 사용하세요. 완전한 몸체 비율을 가진 스타일화된 카툰 캐릭터여야 합니다.
- negative_prompt에 "stickman"이 포함되어 있으므로, 프롬프트에서도 스틱맨을 언급하지 마세요.
- 만약 프롬프트에 스틱맨 관련 단어가 포함되면, 즉시 "stylized cartoon character"로 교체하세요.

**스틱맨 애니메이션 스타일의 경우:**
- 첫 번째 장면에서 주인공 스틱맨 캐릭터를 정의하고, 모든 장면에서 동일한 스틱맨 캐릭터를 사용해야 합니다.
- 각 장면의 프롬프트에 "the same stickman character", "the main stickman character" 등을 명시적으로 포함하여 동일한 캐릭터임을 보장하세요.
- 새로운 사람이나 다른 캐릭터가 등장하면 안 됩니다. 모든 장면은 동일한 스틱맨 주인공을 중심으로 진행됩니다.

[STEP 1] 장면 해석 (요약 금지)
- 각 장면에서 다음 요소를 추출한다.
  - 시대/시간대
  - 장소
  - 주요 인물(역할 중심)
  - 핵심 행동(1개)
  - 분위기/감정

[STEP 2] 영어 프롬프트 생성
- 각 장면을 하나의 이미지로 표현할 수 있는 영어 프롬프트를 작성한다.
- 프롬프트는 구체적이고 시각적으로 명확해야 한다.
- 인물, 배경, 행동, 분위기를 모두 포함한다.
- 이미지 스타일에 맞는 표현을 사용한다.
- ⚠️ 반드시 "no text", "no letters", "no words", "no writing", "no labels", "no signs", "no watermark"를 포함하세요.
- ⚠️ 애니메이션2 스타일인 경우 "stickman", "stick figure", "stick man", "of the stickman", "aesthetic of the stickman" 등을 절대 사용하지 마세요. 대신 "stylized cartoon character"를 사용하세요.
- ⚠️ 실사화/실사화2 스타일이고 배경이 한국인 경우:
  * 반드시 "Korean", "Korean architecture", "Korean setting" 등을 포함하세요.
  * "NOT Chinese", "NOT Chinese style" 등을 포함하여 중국풍과 명확히 구분하세요.
  * 한국 전통 건축, 한국 풍경, 한국적 색감 등을 구체적으로 묘사하세요.

[STEP 3] 출력 형식
각 장면마다 다음 형식으로 출력한다:
장면 1: [시각화 지시문(한국어)]
[영어 프롬프트]

장면 2: [시각화 지시문(한국어)]
[영어 프롬프트]

...`

  const sceneTexts = sceneImages.map(img => `[장면 ${img.imageNumber}]\n${img.text}`).join("\n\n")
  const userPrompt = `다음은 씬 ${sceneNumber}의 장면들입니다. 각 장면에 대한 이미지 프롬프트를 생성해주세요.

${sceneTexts}

이미지 스타일: ${imageStyle}
${historicalContext ? `시대적 배경: ${historicalContext}` : ""}
${customStylePrompt ? `커스텀 스타일: ${customStylePrompt}` : ""}
${imageStyle === "realistic" || imageStyle === "realistic2" ? "Inference Steps는 4입니다." : imageStyle === "animation2" || imageStyle === "animation3" || imageStyle === "stickman-animation" ? "Inference Steps는 16입니다." : ""}
${(imageStyle === "realistic" || imageStyle === "realistic2") && realisticCharacterType === "korean" ? `
⚠️ 매우 중요 - 한국 배경 구분:
- 배경이 한국인 경우 반드시 "Korean", "Korean architecture", "Korean setting", "Korea" 등을 명시적으로 포함하세요.
- 중국풍과 구분하기 위해 "NOT Chinese", "NOT Chinese style", "Korean setting, NOT Chinese" 등을 포함하세요.
- 한국 전통 건축: "Korean hanok", "Korean traditional architecture", "Korean palace (Gyeongbokgung style)", "Korean temple" 등 구체적으로 명시하세요.
- 한국 풍경: "Korean landscape", "Korean countryside", "Korean mountains", "Korean rivers" 등 구체적으로 명시하세요.
- 절대 사용하지 말 것: "Chinese architecture", "Chinese style", "Chinese traditional", "China", "Beijing", "Shanghai", "Forbidden City", "Chinese palace", "Chinese temple"
- 프롬프트에 한국임을 명확히 구분하는 키워드를 반드시 포함하세요.` : ""}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000) // 60초 타임아웃

  let content: string

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${actualApiKey}`,
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
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      let errorData: any = null
      
      try {
        errorData = JSON.parse(errorText)
      } catch {
        // JSON 파싱 실패 시 무시
      }

      // Rate Limit 오류 감지 (429 또는 rate_limit_exceeded)
      const isRateLimitError = 
        response.status === 429 || 
        errorData?.error?.code === "rate_limit_exceeded" ||
        errorText.includes("Rate limit") ||
        errorText.includes("rate_limit")

      if (isRateLimitError) {
        console.warn(`[Scene ${sceneNumber}] OpenAI Rate Limit 초과, Gemini로 전환 시도`)
        
        // Gemini API 키 가져오기
        const geminiApiKey = getEnvApiKey("gemini")
        
        if (!geminiApiKey) {
          throw new Error(`OpenAI Rate Limit 초과 및 Gemini API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.`)
        }

        // Gemini API로 fallback
        try {
          content = await generatePromptsWithGemini(systemPrompt, userPrompt, geminiApiKey)
          console.log(`[Scene ${sceneNumber}] Gemini API로 프롬프트 생성 성공`)
        } catch (geminiError) {
          throw new Error(`OpenAI Rate Limit 초과 및 Gemini API 호출 실패: ${geminiError instanceof Error ? geminiError.message : "알 수 없는 오류"}`)
        }
      } else {
        throw new Error(`OpenAI API 호출 실패: ${response.status} - ${errorText}`)
    }
    } else {
    const data = await response.json()
    
    // API 응답 검증
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error(`[Scene ${sceneNumber}] API 응답 오류:`, data)
      throw new Error(`Scene ${sceneNumber} 프롬프트 생성에 실패했습니다: API 응답 형식이 올바르지 않습니다.`)
    }
    
      content = data.choices[0]?.message?.content

    if (!content || typeof content !== 'string') {
      console.error(`[Scene ${sceneNumber}] 콘텐츠 없음:`, data.choices[0])
      throw new Error(`Scene ${sceneNumber} 프롬프트 생성에 실패했습니다: 응답 내용이 없습니다.`)
      }
    }

    // 텍스트에서 각 장면의 프롬프트 추출
    const sceneImageResults: Array<{ imageNumber: number; prompt: string; sceneText: string; visualInstruction?: string }> = []
    
    // "장면 N: [시각화 지시문(한국어)]\n[영어 프롬프트]" 패턴으로 파싱
    const promptRegex = /장면\s+(\d+):\s*([^\n]+)\n([\s\S]+?)(?=\n장면\s+\d+:|$)/g
    const prompts: Map<number, { visualInstruction: string; prompt: string }> = new Map()
    
    let match
    while ((match = promptRegex.exec(content)) !== null) {
      const imageNum = parseInt(match[1])
      const visualInstruction = match[2].trim()
      const prompt = match[3].trim()
      if (prompt) {
        prompts.set(imageNum, { visualInstruction, prompt })
      }
    }
    
    // 새로운 형식으로 파싱되지 않은 경우 기존 형식으로 시도
    if (prompts.size === 0) {
      const fallbackRegex = /장면\s+(\d+):\s*([\s\S]+?)(?=\n장면\s+\d+:|$)/g
      let fallbackMatch
      while ((fallbackMatch = fallbackRegex.exec(content)) !== null) {
        const imageNum = parseInt(fallbackMatch[1])
        const prompt = fallbackMatch[2].trim()
        if (prompt) {
          prompts.set(imageNum, { visualInstruction: "", prompt })
        }
      }
    }

    // 각 장면에 대해 프롬프트 매칭
    sceneImages.forEach((img) => {
      if (!img || typeof img.imageNumber !== 'number') {
        console.warn(`[Scene ${sceneNumber}] 유효하지 않은 이미지 데이터:`, img)
        return
      }
      
      const promptData = prompts.get(img.imageNumber)
      let prompt = (promptData?.prompt || img?.text || "").trim()
      const visualInstruction = (promptData?.visualInstruction || "").trim()
      
      if (!prompt) {
        console.warn(`[Scene ${sceneNumber}] Image ${img.imageNumber} 프롬프트가 비어있습니다.`)
        prompt = img?.text || "image"
      }
      
      // 시대적 배경이 있으면 프롬프트에 명시적으로 포함
      if (historicalContext) {
        const contextLower = historicalContext.toLowerCase()
        const promptLower = prompt.toLowerCase()
        const contextKeywords = (typeof historicalContext === 'string' ? historicalContext.split(/[,\s]+/) : []).filter((k: string) => k && k.length > 3)
        const hasContext = contextKeywords.some(keyword => 
          promptLower.includes(keyword.toLowerCase())
        )
        
        if (!hasContext) {
          prompt = `${historicalContext}, ${prompt}`
        }
      }

      // 스틱맨 애니메이션: 모든 Scene에서 스틱맨 키워드 강제 추가
      if (imageStyle === "stickman-animation") {
        if (sceneNumber > 1 && stickmanCharacterDescription) {
          // 첫 번째 Scene 이후: 동일한 스틱맨 캐릭터 참조
          if (!prompt.toLowerCase().includes("the same stickman character") && 
              !prompt.toLowerCase().includes("the main stickman character") &&
              !prompt.toLowerCase().includes("the protagonist stickman")) {
            prompt = `The same stickman character from Scene 1 (${stickmanCharacterDescription}), ${prompt}`
          }
        } else {
          // 첫 번째 Scene: 스틱맨 키워드 강제 추가
          if (!prompt.toLowerCase().includes("stickman") && !prompt.toLowerCase().includes("stick-figure")) {
            prompt = `stickman character, ${prompt}`
          }
        }
      }
      
      // 커스텀 스타일 프롬프트가 있으면 추가
      if (customStylePrompt && typeof customStylePrompt === 'string' && customStylePrompt.trim().length > 0) {
        const customStyleLower = customStylePrompt.toLowerCase()
        const promptLower = prompt.toLowerCase()
        const customStylePrefix = customStyleLower.substring(0, Math.min(50, customStyleLower.length))
        if (!promptLower.includes(customStylePrefix)) {
          prompt = `${prompt}, ${customStylePrompt}`
        }
      }

      // 텍스트 제외 지시 추가 (없으면 추가)
      const textExclusionTerms = ["no text", "no letters", "no words", "no writing", "no labels", "no signs", "no watermark"]
      const hasTextExclusion = textExclusionTerms.some(term => prompt.toLowerCase().includes(term))
      if (!hasTextExclusion) {
        prompt = `${prompt}, no text, no letters, no words, no writing, no labels, no signs, no watermark`
      }

      // 한국어 제거: 프롬프트에서 한국어 문자 제거
      const koreanRegex = /[가-힣]+/g
      prompt = prompt.replace(koreanRegex, '').replace(/\s+/g, ' ').trim()
      
      // 스타일 일관성 강화: 스타일별 불일치 키워드 제거 및 일관성 키워드 추가
      if (imageStyle === "stickman-animation") {
        // 스틱맨 애니메이션: 다른 스타일 키워드 제거 (3D, 실사, 말풍선, 다중 팔/손 등)
        const nonStickmanTerms = ["realistic", "photorealistic", "hyperrealistic", "photograph", "photo", "real people", "human", "man", "woman", "semi-realistic", "cinematic", "movie still", "3d", "3d render", "pixar", "disney", "blender", "unreal engine", "plastic", "glossy", "smooth shading", "real room", "real office", "real furniture", "lighting effects", "depth of field", "shadows", "character design", "mascot", "robot", "android", "3D CGI", "rendered", "animation style", "cartoon style", "illustration style", "vector art", "flat design", "cel-shaded", "stylized character", "non-stickman", "animated character", "cartoon character", "saying", "explaining", "talking", "comic", "explaining with both hands", "animated gestures", "expressive movement", "dynamic action"]
        let cleanedPrompt = prompt
        nonStickmanTerms.forEach(term => {
          const regex = new RegExp(term, 'gi')
          cleanedPrompt = cleanedPrompt.replace(regex, '')
        })
        prompt = cleanedPrompt.replace(/\s+/g, ' ').trim()
        
        // ABSOLUTE STICKMAN-ONLY ILLUSTRATION 강화
        const promptLower = prompt.toLowerCase()
        const stickmanMainPrompt = "ABSOLUTE STICKMAN-ONLY ILLUSTRATION. This image must contain ONLY 2D stickman figures. Stickman is a symbolic drawing, NOT a human, NOT a character, NOT a person."
        const stickmanBasePrompt = "Stickman rules (must follow): Perfectly round white head, dot eyes and simple curved smile ONLY, no nose, no ears, no hair, no facial details, ultra-thin black line limbs with uniform stroke width, no body volume, no torso shape, no muscles, simple mitten hands, no fingers, flat 2D vector drawing ONLY"
        const stickmanAnatomyRules = "STRICT ANATOMY RULES FOR STICKMAN: Exactly TWO arms only, Exactly TWO hands only, Exactly TWO legs only, No extra arms, no extra hands, no duplicated limbs, Each arm is drawn once, clearly connected to the body, One head, one body, two arms, two hands, two legs, No duplicates, no extra parts. Stickman body constraints: One head, One body, Two arms only, Two hands only, Two legs only, No duplicates, no extra parts. If any extra limbs appear, the result is incorrect."
        const stickmanBodyVisibility = "MANDATORY BODY VISIBILITY: The stickman character MUST show the full body including both head and torso, not just torso alone. Full body visible: head, torso, and limbs all must be visible in the image. No partial body, no torso-only, no head-only. Complete stickman figure required. Both arms must be clearly visible and shown."
        const stickmanStylePhrase = "Scene is illustrated in a simple cartoon style: flat colors, bold black outlines, minimal details, no depth, no lighting effects, no textures. Background must be fully illustrated (cartoon), simple shapes only, no realistic environment. Educational explainer illustration style. Use calm pose, simple gesture, neutral stance, minimal movement instead of animated gestures or dynamic action"
        const stickmanNoText = "NO TEXT ALLOWED IN IMAGE. Do NOT include speech bubbles, captions, labels, words, letters, logos, symbols, numbers, or any readable text. This is NOT a comic, NOT a poster, NOT an advertisement. Pure visual illustration only."
        const stickmanFinalCheck = "If the result looks realistic, 3D, or human-like, it is WRONG. If the image contains text, speech bubbles, or readable symbols, the result is incorrect. If any extra limbs appear, the result is incorrect."
        
        if (!promptLower.includes("absolute stickman-only") || !promptLower.includes("only 2d stickman") || !promptLower.includes("symbolic drawing")) {
          prompt = `${stickmanMainPrompt} ${prompt}`
        }
        if (!promptLower.includes("perfectly round white head") || !promptLower.includes("dot eyes") || !promptLower.includes("ultra-thin black line limbs")) {
          prompt = `${prompt}, ${stickmanBasePrompt}`
        }
        if (!promptLower.includes("exactly two arms") || !promptLower.includes("exactly two hands") || !promptLower.includes("no extra arms") || !promptLower.includes("no extra hands")) {
          prompt = `${prompt}, ${stickmanAnatomyRules}`
        }
        if (!promptLower.includes("full body visible") || !promptLower.includes("head and torso") || !promptLower.includes("complete stickman figure")) {
          prompt = `${prompt}, ${stickmanBodyVisibility}`
        }
        if (!promptLower.includes("flat 2d vector drawing") || !promptLower.includes("simple cartoon style") || !promptLower.includes("educational explainer")) {
          prompt = `${prompt}, ${stickmanStylePhrase}`
        }
        if (!promptLower.includes("no text allowed") || !promptLower.includes("no speech bubbles")) {
          prompt = `${prompt}, ${stickmanNoText}`
        }
        if (!promptLower.includes("no hair") || !promptLower.includes("no ears") || !promptLower.includes("no nose")) {
          prompt = `${prompt}, no hair, no ears, no nose, no cheeks, no detailed facial features, no realistic human anatomy, no person, no man, no woman, only stickman, no saying, no explaining, no talking, use gesturing or pointing instead, no explaining with both hands, no animated gestures, no expressive movement, no dynamic action, use calm pose, simple gesture, neutral stance, minimal movement instead`
        }
        // 최종 확인 문구 추가
        if (!promptLower.includes("if the result looks realistic") && !promptLower.includes("it is wrong")) {
          prompt = `${prompt}. ${stickmanFinalCheck}`
        }
      } else if (imageStyle === "realistic" || imageStyle === "realistic2") {
        // 실사화: 애니메이션/카툰 키워드 제거
        const nonRealisticTerms = ["stickman", "stick figure", "stick man", "animation style", "animated", "cel-shaded", "vector art", "flat design", "stylized character", "cartoon character", "illustrated", "graphic novel", "comic book", "hand-drawn", "digital art", "2D animation", "animated character", "cartoon style"]
        let cleanedPrompt = prompt
        nonRealisticTerms.forEach(term => {
          const regex = new RegExp(term, 'gi')
          cleanedPrompt = cleanedPrompt.replace(regex, '')
        })
        prompt = cleanedPrompt.replace(/\s+/g, ' ').trim()
        
        // 실사 스타일 BASE_PROMPT 강제 추가 (모든 씬에 일관되게)
        const realisticBasePrompt = "A hyperrealistic, photorealistic masterpiece, 8K, ultra-detailed, sharp focus, cinematic lighting, shot on a professional DSLR camera with a 50mm lens"
        const promptLower = prompt.toLowerCase()
        if (!promptLower.includes("hyperrealistic") || !promptLower.includes("photorealistic") || !promptLower.includes("8k") || !promptLower.includes("dslr")) {
          prompt = `${prompt}, ${realisticBasePrompt}`
        }
        
        // 한국인/외국인 키워드 강제 추가
        if (realisticCharacterType === "korean") {
          if (!promptLower.includes("korean") && !promptLower.includes("korean person") && !promptLower.includes("korean character") && !promptLower.includes("asian features")) {
            prompt = `${prompt}, Korean person, Korean character, Asian features`
          }
        } else if (realisticCharacterType === "foreign") {
          if (!promptLower.includes("western") && !promptLower.includes("caucasian") && !promptLower.includes("european") && !promptLower.includes("american")) {
            prompt = `${prompt}, Western person, Caucasian, European features`
          }
        }
        
        if (!promptLower.includes("no animation") && !promptLower.includes("no cartoon")) {
          prompt = `${prompt}, no animation style, no cartoon style, no illustration style, photorealistic only`
        }
      } else if (imageStyle === "animation2") {
        // 애니메이션2: 스틱맨 및 실사 키워드 강력하게 제거
        const nonAnimation2Terms = [
          "stickman", "stick figure", "stick man", "stick-man", "stick-figure",
          "photorealistic", "hyperrealistic", "realistic photography", 
          "3D CGI", "rendered", "photography style", "DSLR camera", 
          "professional photography", "line drawing", "simple line art character"
        ]
        let cleanedPrompt = prompt
        nonAnimation2Terms.forEach(term => {
          const regex = new RegExp(term, 'gi')
          cleanedPrompt = cleanedPrompt.replace(regex, '')
        })
        // 추가: 스틱맨 관련 패턴 제거 (예: "stick man", "stick-man character" 등)
        cleanedPrompt = cleanedPrompt.replace(/\bstick\s*[-]?\s*man\b/gi, 'stylized cartoon character')
        cleanedPrompt = cleanedPrompt.replace(/\bstick\s*[-]?\s*figure\b/gi, 'stylized cartoon character')
        // "of the stickman", "aesthetic of the stickman" 등 패턴 제거
        cleanedPrompt = cleanedPrompt.replace(/of\s+the\s+stickman/gi, 'of the stylized cartoon character')
        cleanedPrompt = cleanedPrompt.replace(/aesthetic\s+of\s+the\s+stickman/gi, 'aesthetic of the stylized cartoon character')
        cleanedPrompt = cleanedPrompt.replace(/cartoon\s+aesthetic\s+of\s+the\s+stickman/gi, 'cartoon aesthetic')
        prompt = cleanedPrompt.replace(/\s+/g, ' ').trim()
        
        // 스틱맨이 여전히 남아있는지 확인하고 강제로 교체
        if (prompt.toLowerCase().includes('stick')) {
          prompt = prompt.replace(/\bstick[^\s]*/gi, 'stylized cartoon character')
          // "of the stickman" 패턴도 다시 확인
          prompt = prompt.replace(/of\s+the\s+stylized\s+cartoon\s+character/gi, 'of the stylized cartoon character')
          prompt = prompt.replace(/aesthetic\s+of\s+the\s+stylized\s+cartoon\s+character/gi, 'aesthetic')
        }
        
        // 애니메이션2 프롬프트 구조 (제공된 구조 사용 - 간결한 버전)
        // 주의: animation2는 스틱맨이 아닌 일반 카툰 캐릭터를 사용하므로 "stylized cartoon character"로 변경
        const baseStyle = (
          "Flat 2D vector illustration, minimal vector art, stylized cartoon character with simple circular head, " +
          "minimalist black dot eyes, thick bold black outlines, unshaded, flat solid colors, cel-shaded, " +
          "simple line art, comic book inking style, completely flat, no shadows, no gradients, no depth."
        )
        
        const characterDetails = (
          "The character is in an expressive, dynamic pose appropriate for the scene. " +
          "The character can be wearing stylized cartoon clothing, costumes, or accessories that fit the theme of the environment. " +
          "Any clothing must match the simple, bold-line cartoon aesthetic, avoiding overly complex or realistic textures. " +
          "IMPORTANT: Use a stylized cartoon character, NOT a stickman or stick figure. The character should have a full body with proper proportions, not just lines."
        )
        
        const environmentLighting = (
          "The background is a rich, detailed, and colorful stylized cartoon environment " +
          "(e.g., a bustling futuristic market, a pirate ship deck, a magical forest) filled with relevant objects. " +
          "The entire frame is filled, with NO blank or simple background regions. " +
          "The scene features dynamic, dramatic lighting with strong highlights and shadows that enhance the 2D cartoon feel."
        )
        
        const constraints = (
          "Base Character Consistency: The underlying character form (head shape, eyes, body type) must match the reference style. " +
          "No Realistic Anatomy: Do not add realistic human features, muscles, or photorealistic clothing textures. " +
          "Stick to the simple cartoon style."
        )
        
        // 최종 프롬프트 조합
        prompt = `${prompt}, ${baseStyle}, ${characterDetails}, ${environmentLighting}, ${constraints}`
      } else if (imageStyle === "animation3") {
        // 애니메이션3 스타일 BASE_PROMPT 강제 추가 (모든 씬에 일관되게)
        const animation3BasePrompt = "European graphic novel style, bande dessinée aesthetic, highly detailed traditional illustration, hand-drawn ink lines with cross-hatching shadows, sophisticated and muted color palette, atmospheric, cinematic frame"
        const promptLower = prompt.toLowerCase()
        if (!promptLower.includes("european graphic novel") || !promptLower.includes("bande dessinée") || !promptLower.includes("hand-drawn ink lines") || !promptLower.includes("cross-hatching")) {
          prompt = `${prompt}, ${animation3BasePrompt}`
        }
      }

      sceneImageResults.push({
        imageNumber: img.imageNumber,
        prompt: prompt,
        sceneText: img.text,
        visualInstruction: visualInstruction || undefined,
      })
    })

    return sceneImageResults
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`씬 ${sceneNumber} 프롬프트 생성 타임아웃 (60초 초과)`)
    }
    throw error
  }
}

export async function generateSceneImagePrompts(
  decomposedScenes: string,
  imageStyle: string,
  openaiApiKey: string,
  customStylePrompt?: string,
  topic?: string,
  script?: string,
  realisticCharacterType?: "korean" | "foreign" | null
): Promise<Array<{ sceneNumber: number; images: Array<{ imageNumber: number; prompt: string; sceneText: string; visualInstruction?: string; imageUrl?: string }> }>> {
  // 사용자가 제공한 API 키 필수 사용
  if (!openaiApiKey || openaiApiKey.trim().length === 0) {
    throw new Error("OpenAI API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
  }
  const actualApiKey = openaiApiKey

  if (!decomposedScenes || decomposedScenes.trim().length === 0) {
    throw new Error("장면 분해 결과가 없습니다.")
  }

  // 재시도 함수
  const tryGenerate = async (apiKey: string, isRetry: boolean = false): Promise<Array<{ sceneNumber: number; images: Array<{ imageNumber: number; prompt: string; sceneText: string; visualInstruction?: string; imageUrl?: string }> }>> => {
    try {
    // 시대적 배경 추출
    console.log(`[프롬프트 생성] 시대적 배경 추출 시작... (재시도: ${isRetry ? "예" : "아니오"})`)
    const historicalContext = await extractHistoricalContext(topic, script, actualApiKey)
    if (historicalContext) {
      console.log("[프롬프트 생성] 추출된 시대적 배경:", historicalContext)
    } else {
      console.log("[프롬프트 생성] 시대적 배경을 추출하지 못했습니다. 기본값으로 진행합니다.")
    }

    // Scene별로 분리
    const sceneBlocks = decomposedScenes.split(/(?=씬\s+\d+)/).filter(block => block.trim().length > 0)
    console.log(`[프롬프트 생성] Scene 블록 개수: ${sceneBlocks.length}`)
    
    const results: Array<{ sceneNumber: number; images: Array<{ imageNumber: number; prompt: string; sceneText: string }> }> = []
    
    // 스틱맨 애니메이션의 경우 첫 번째 Scene에서 정의한 캐릭터 정보 저장
    let stickmanCharacterDescription: string | null = null

    for (const sceneBlock of sceneBlocks) {
      // Scene 번호 추출
      const sceneNumMatch = sceneBlock.match(/씬\s+(\d+)/)
      if (!sceneNumMatch) continue
      
      const sceneNum = parseInt(sceneNumMatch[1])
      
      // Scene 블록 내에서 모든 [장면 N] 패턴 찾기
      const imageRegex = /\[장면\s+(\d+)\]\s*\n([\s\S]*?)(?=\[장면\s+\d+\]|씬\s+\d+|$)/g
      const sceneImages: Array<{ imageNumber: number; text: string }> = []
      let imageMatch
      
      while ((imageMatch = imageRegex.exec(sceneBlock)) !== null) {
        const imageNum = parseInt(imageMatch[1])
        let imageText = imageMatch[2].trim()
        
        if (imageText && imageText.length > 0) {
          sceneImages.push({
            imageNumber: imageNum,
            text: imageText,
          })
        }
      }
      
      // 정규식으로 찾지 못한 경우 대체 방법 시도
      if (sceneImages.length === 0) {
        const flexibleRegex = /\[장면\s*(\d+)\][\s\n]*([\s\S]*?)(?=\[장면|\b씬|\s*$)/g
        let flexMatch
        while ((flexMatch = flexibleRegex.exec(sceneBlock)) !== null) {
          const imageNum = parseInt(flexMatch[1])
          let imageText = flexMatch[2].trim()
          if (imageText && imageText.length > 0) {
            sceneImages.push({
              imageNumber: imageNum,
              text: imageText,
            })
          }
        }
      }
      
      if (sceneImages.length === 0) {
        console.warn(`[프롬프트 생성] Scene ${sceneNum}에서 장면을 찾을 수 없습니다.`)
        continue
      }

      // 새로운 프롬프트 구조 사용
      // 커스텀 스타일이 있으면 기존 스타일 규칙을 제거
      const systemPrompt = customStylePrompt 
        ? `너는 장면 기반 이미지 프롬프트 생성기다.

입력은 이미 장면(Scene) 단위로 분리된 한국어 텍스트이며,
너의 작업은 다음 순서를 반드시 따른다. 먼저 이미지 스타일에 따라
인물을 부여하고 그 인물은 각 장면에 일관성있게 무조건 유지되어야한다.
인물이 많으면 그 인물들도 다 일관성있게 유지되어야 한다.

**⚠️ 필수 규칙 (모든 스타일 공통):**
1. 이미지에 텍스트, 글씨, 문자, 단어, 라벨, 표지판, 워터마크가 절대 포함되면 안 됩니다.
2. 프롬프트에 반드시 "no text", "no letters", "no words", "no writing", "no labels", "no signs", "no watermark"를 포함해야 합니다.
3. 이미지에 어떤 종류의 텍스트도 나타나면 안 됩니다.

**⚠️ 중요: 커스텀 스타일 사용**
- 기존 스타일(스틱맨, 애니메이션, 실사화 등)은 절대 사용하지 마세요.
- 오직 제공된 커스텀 스타일 프롬프트만 사용하세요.
- 각 장면의 내용과 커스텀 스타일을 자연스럽게 결합하세요.

[STEP 1] 장면 해석 (요약 금지)
- 각 장면에서 다음 요소를 추출한다.
  - 시대/시간대
  - 장소
  - 주요 인물(역할 중심)
  - 핵심 행동(1개)
  - 상징적 소품 또는 배경 요소
  - 감정/분위기

[STEP 2] 시각화 지시문 생성 (한국어)
- STEP 1에서 추출한 정보를 바탕으로
  "그림을 그릴 수 있는 지시문" 형태의 한국어 문장을 만든다.
- 대본 문장은 절대 바꾸지 않으며, 묘사만 시각화한다.
- 장면 간 시대·장소·인물은 최대한 일관되게 유지한다.

[STEP 3] 이미지 모델·스타일 적용
- 커스텀 스타일 프롬프트를 **반드시 그대로 사용**하고,
  STEP 2의 시각화 지시문을 커스텀 스타일에 맞는 영어 프롬프트로 변환한다.
- 단순 번역 금지. "그릴 수 있는 이미지 묘사"로 재구성한다.
- ⚠️ 반드시 "no text", "no letters", "no words", "no writing", "no labels", "no signs", "no watermark"를 포함하세요.
- ⚠️ 기존 스타일 키워드(스틱맨, 애니메이션 등)는 절대 사용하지 마세요.

[출력 규칙]
- 씬 단위 유지
- 각 씬 안에서 장면 수만큼 이미지 프롬프트 생성
- 설명, 해설, 말투 금지
- 시각화 지시문과 커스텀 스타일을 융합(모두 영어로 나와야됨)해 이미지 생성을 하기위한 영어 프롬프트 추출.
- 각 장면마다 다음 형식으로 출력:
  "장면 N: [시각화 지시문(한국어)]\n[영어 프롬프트]"
- 예시:
장면 1: 탐정이 증거를 살펴보는 모습, 사무실 배경, 진지한 표정
A detective looking at evidence, {커스텀 스타일 프롬프트}, no text, no letters, no words, no writing, no labels, no signs, no watermark
장면 2: 탐정이 단서를 발견하는 장면, 책상 위 문서들, 놀란 표정
The detective finds a clue, {커스텀 스타일 프롬프트}, no text, no letters, no words, no writing, no labels, no signs, no watermark`
        : `너는 장면 기반 이미지 프롬프트 생성기다.

입력은 이미 장면(Scene) 단위로 분리된 한국어 텍스트이며,
너의 작업은 다음 순서를 반드시 따른다. 먼저 이미지 스타일에 따라
인물을 부여하고 그 인물은 각 장면에 일관성있게 무조건 유지되어야한다.
인물이 많으면 그 인물들도 다 일관성있게 유지되어야 한다.

**⚠️ 필수 규칙 (모든 스타일 공통):**
1. 이미지에 텍스트, 글씨, 문자, 단어, 라벨, 표지판, 워터마크가 절대 포함되면 안 됩니다.
2. 프롬프트에 반드시 "no text", "no letters", "no words", "no writing", "no labels", "no signs", "no watermark"를 포함해야 합니다.
3. 이미지에 어떤 종류의 텍스트도 나타나면 안 됩니다.

**애니메이션2 스타일의 경우:**
- ⚠️ 스틱맨(stickman)이 절대 나오면 안 됩니다. 이것은 최우선 규칙입니다.
- 프롬프트에 "stickman", "stick figure", "stick man", "stick-man", "stick-figure" 등의 단어를 절대 사용하지 마세요.
- "of the stickman", "aesthetic of the stickman", "cartoon aesthetic of the stickman" 같은 표현도 절대 사용하지 마세요.
- 일반적인 스타일화된 카툰 캐릭터를 사용하세요. 완전한 몸체 비율을 가진 스타일화된 카툰 캐릭터여야 합니다.
- negative_prompt에 "stickman"이 포함되어 있으므로, 프롬프트에서도 스틱맨을 언급하지 마세요.
- 만약 프롬프트에 스틱맨 관련 단어가 포함되면, 즉시 "stylized cartoon character"로 교체하세요.

**스틱맨 애니메이션 스타일의 경우:**
- 첫 번째 장면에서 주인공 스틱맨 캐릭터를 정의하고, 모든 장면에서 동일한 스틱맨 캐릭터를 사용해야 합니다.
- 각 장면의 프롬프트에 "the same stickman character", "the main stickman character" 등을 명시적으로 포함하여 동일한 캐릭터임을 보장하세요.
- 새로운 사람이나 다른 캐릭터가 등장하면 안 됩니다. 모든 장면은 동일한 스틱맨 주인공을 중심으로 진행됩니다.

[STEP 1] 장면 해석 (요약 금지)
- 각 장면에서 다음 요소를 추출한다.
  - 시대/시간대
  - 장소
  - 주요 인물(역할 중심)
  - 핵심 행동(1개)
  - 상징적 소품 또는 배경 요소
  - 감정/분위기

[STEP 2] 시각화 지시문 생성 (한국어)
- STEP 1에서 추출한 정보를 바탕으로
  "그림을 그릴 수 있는 지시문" 형태의 한국어 문장을 만든다.
- 대본 문장은 절대 바꾸지 않으며, 묘사만 시각화한다.
- 장면 간 시대·장소·인물은 최대한 일관되게 유지한다.

[STEP 3] 이미지 모델·스타일 적용
- 이미지 스타일과 모델 정보는 위에서 정한 이미지 스타일에서 주어진다.
- 선택된 모델 프리셋을 **반드시 그대로 사용**하고,
  STEP 2의 시각화 지시문을 해당 스타일에 맞는 영어 프롬프트로 변환한다.
- 단순 번역 금지. "그릴 수 있는 이미지 묘사"로 재구성한다.
- ⚠️ 반드시 "no text", "no letters", "no words", "no writing", "no labels", "no signs", "no watermark"를 포함하세요.
- ⚠️ 애니메이션2 스타일인 경우 "stickman", "stick figure", "stick man", "of the stickman", "aesthetic of the stickman" 등을 절대 사용하지 마세요. 대신 "stylized cartoon character"를 사용하세요.

[출력 규칙]
- 씬 단위 유지
- 각 씬 안에서 장면 수만큼 이미지 프롬프트 생성
- 설명, 해설, 말투 금지
- 시각화 지시문과 이미지 스타일을 융합(모두 영어로 나와야됨)해 이미지 생성을 하기위한 영어 프롬프트 추출.
- 각 장면마다 다음 형식으로 출력:
  "장면 N: [시각화 지시문(한국어)]\n[영어 프롬프트]"
- 예시:
장면 1: 탐정이 증거를 살펴보는 모습, 사무실 배경, 진지한 표정
A detective looking at evidence, a vibrant 2D cartoon..., no text, no letters, no words, no writing, no labels, no signs, no watermark
장면 2: 탐정이 단서를 발견하는 장면, 책상 위 문서들, 놀란 표정
The detective finds a clue, a vibrant 2D cartoon..., no text, no letters, no words, no writing, no labels, no signs, no watermark`

      const styleName = getImageStyleName(imageStyle)
      
      // 커스텀 스타일이 있으면 기존 스타일 처리를 건너뛰고 커스텀 스타일만 사용
      let styleInfo = ""
      let templateInfo = ""
      
      if (customStylePrompt) {
        // 커스텀 스타일만 사용
        styleInfo = `스타일: 커스텀 스타일
모델: black-forest-labs/flux-pro
해상도: 16:9

**중요: 커스텀 스타일 프롬프트**
다음 커스텀 스타일 프롬프트를 반드시 각 장면의 영어 프롬프트에 포함하세요:
${customStylePrompt}

각 장면의 프롬프트는 장면 내용과 이 커스텀 스타일 프롬프트를 결합하여 생성하세요.
기존 스타일(스틱맨, 애니메이션 등)은 사용하지 마세요. 오직 이 커스텀 스타일만 사용하세요.`
        
        templateInfo = `
[커스텀 스타일 프롬프트 템플릿]
STEP 3에서 영어 프롬프트를 생성할 때, 다음 형식을 사용하세요:

{장면 내용}, ${customStylePrompt}, no text, no letters, no words, no writing, no labels, no signs, no watermark

⚠️ 중요: 
- 기존 스타일 키워드(스틱맨, 애니메이션, 실사화 등)는 절대 사용하지 마세요.
- 오직 제공된 커스텀 스타일 프롬프트만 사용하세요.
- 각 장면의 내용과 커스텀 스타일을 자연스럽게 결합하세요.
`
      } else if (imageStyle === "stickman-animation") {
        styleInfo = `스타일: 스틱맨 애니메이션
모델: prunaai/hidream-l1-fast
해상도: 1360x768
negative_prompt: realistic, photo, photograph, real people, human, man, woman, semi-realistic, cinematic, movie still, 3d, 3d render, pixar, disney, blender, unreal engine, plastic, glossy, smooth shading, real room, real office, real furniture, lighting effects, depth of field, shadows, character design, mascot, robot, android, detailed face, skin, fingers, joints, body proportions, realistic human, human anatomy, person, cartoon human, anime, manga, portrait, nose, lips, teeth, eyelashes, hair, ears, skin texture, wrinkles, hands with fingers, body volume, torso muscles, render, photorealistic, painterly, digital painting, gradients, soft shading, detailed clothing folds, realistic proportions, close-up face, high detail character design, blank white background, line-art only, text, watermark, speech bubble, thought bubble, text bubble, caption, subtitle, label, signage, words, letters, typography, font, comic panel, comic strip, meme, poster, advertisement, slogan, headline, logo, non-stickman, mixed style, detailed cartoon human, prince, princess, chibi, kawaii, big head, human body, human skin, 3d render, detailed face, blush, portrait, close-up, single character focus, bokeh, depth of field, watercolor, airbrush, extra arms, extra hands, multiple arms, multiple hands, duplicated limbs, cloned arms, ghost limbs, motion trails, overlapping arms, sketch artifacts, three hands, four hands, three arms, four arms, extra limbs, deformed hands, malformed hands, wrong number of fingers, too many fingers, missing hands, missing arms, anatomical errors, body part errors, realistic photography, hyperrealistic, 3D CGI, rendered, animation style, cartoon style, illustration style, vector art, flat design, cel-shaded, stylized character, non-stickman character, human character, detailed character, realistic character, any non-stickman style`
        
        templateInfo = `
[스틱맨 프롬프트 템플릿]
STEP 3에서 영어 프롬프트를 생성할 때, 다음 형식을 사용하세요:

ABSOLUTE STICKMAN-ONLY ILLUSTRATION.

This image must contain ONLY 2D stickman figures.
Stickman is a symbolic drawing, NOT a human, NOT a character, NOT a person.

NO TEXT ALLOWED IN IMAGE.
Do NOT include speech bubbles, captions, labels, words, letters, logos, symbols, numbers, or any readable text.
This is NOT a comic, NOT a poster, NOT an advertisement.
Pure visual illustration only.

{사용자 프롬프트}

Stickman rules (must follow):
- Perfectly round white head
- Dot eyes and simple curved smile ONLY
- No nose, no ears, no hair, no facial details
- Ultra-thin black line limbs, uniform stroke width
- No body volume, no torso shape, no muscles
- Simple mitten hands, no fingers
- Flat 2D vector drawing ONLY

STRICT ANATOMY RULES FOR STICKMAN:
- Exactly TWO arms only
- Exactly TWO hands only
- Exactly TWO legs only
- No extra arms, no extra hands, no duplicated limbs
- Each arm is drawn once, clearly connected to the body
- One head, one body, two arms, two hands, two legs
- No duplicates, no extra parts

Stickman body constraints:
- One head
- One body
- Two arms only
- Two hands only
- Two legs only
- No duplicates, no extra parts

If any extra limbs appear, the result is incorrect.

Scene is illustrated in a simple cartoon style:
flat colors, bold black outlines, minimal details,
no depth, no lighting effects, no textures.

Background must be fully illustrated (cartoon),
simple shapes only, no realistic environment.

Educational explainer illustration style.

**중요: 인물 일관성 규칙**
- 첫 번째 장면에서 등장하는 주인공 스틱맨 캐릭터를 정의하세요.
- 모든 장면에서 "the same stickman character", "the main stickman character", 또는 "the same stickman protagonist"를 사용하여 동일한 캐릭터임을 명시하세요.
- 예: "A detective looking at evidence" → "The same stickman character (a detective) looking at evidence"
- 예: "The detective finds a clue" → "The same stickman character (the detective) finds a clue"
- 모든 장면에서 동일한 스틱맨 캐릭터가 등장해야 합니다. 다른 사람이나 새로운 캐릭터가 나오면 안 됩니다.

**스틱맨 신체 구조 규칙 (필수):**
- 정확히 2개의 팔 (exactly two arms)
- 정확히 2개의 손 (exactly two hands)
- 손은 미튼 형태이며 손가락 없음 (mitten hands, no fingers)
- 자연스러운 자세와 비율 (natural pose, proper proportions)
- 신체 구조 오류 없음 (no anatomical errors, correct anatomy)

**절대 금지 사항:**
- "saying", "explaining", "talking" 같은 단어 사용 금지 → 대신 "gesturing", "pointing", "presenting visually" 사용
- "comic"이라는 단어 절대 사용 금지 → "explainer illustration" 또는 "diagram style"만 사용
- "explaining with both hands", "animated gestures", "expressive movement", "dynamic action" 같은 표현 금지 → 대신 "calm pose", "simple gesture", "neutral stance", "minimal movement" 사용
- 말풍선, 텍스트, 실사 배경, 3D 렌더링, 인간 같은 특징 절대 금지
- 추가 팔, 추가 손, 중복된 사지 절대 금지

⚠️ 최종 확인: If the result looks realistic, 3D, or human-like, it is WRONG.
If the image contains text, speech bubbles, or readable symbols, the result is incorrect.

예시:
사용자 프롬프트가 "A detective looking at evidence"라면,
최종 프롬프트는:
"ABSOLUTE STICKMAN-ONLY ILLUSTRATION. NO TEXT ALLOWED IN IMAGE. The same stickman character (a detective) gesturing at evidence, flat 2D vector illustration, perfectly round white head, dot eyes, simple curved smile, ultra-thin black line limbs, uniform stroke width, simple mitten hands, no fingers, no body volume, bold clean outline, solid color fills, minimal cel shading, playful explainer-video aesthetic, simple background with clean shapes, no realistic textures, no painterly rendering, educational explainer illustration style, exactly two arms, exactly two hands, anatomically correct stickman, proper body proportions. If the result looks realistic, 3D, or human-like, it is WRONG."
`
      } else if (imageStyle === "realistic" || imageStyle === "realistic2") {
        styleInfo = `스타일: ${styleName}
모델: google/imagen-4-fast
해상도: 16:9
Inference Steps: 4

BASE_PROMPT:
A hyperrealistic, photorealistic masterpiece, 8K, ultra-detailed, sharp focus, cinematic lighting, shot on a professional DSLR camera with a 50mm lens

NEGATIVE_PROMPT:
painting, drawing, illustration, cartoon, anime, 3d, cgi, render, sketch, watercolor, text, watermark, signature, blurry, out of focus, stickman, stick figure, stick man, animation style, animated, cel-shaded, vector art, flat design, stylized character, cartoon character, illustrated, graphic novel style, comic book style, non-photorealistic, non-realistic, artistic style, hand-drawn, digital art, illustration, 2D animation, animated character, cartoon style, any non-photorealistic style

${imageStyle === "realistic2" ? "차이점: 스타일 키워드 중복 방지 로직 포함" : ""}

[실사화 프롬프트 템플릿]
STEP 3에서 영어 프롬프트를 생성할 때, BASE_PROMPT를 반드시 포함하고, 사용자 프롬프트와 결합하세요.
예시: "{사용자 프롬프트}, A hyperrealistic, photorealistic masterpiece, 8K, ultra-detailed, sharp focus, cinematic lighting, shot on a professional DSLR camera with a 50mm lens"
`
      } else if (imageStyle === "animation2") {
        styleInfo = `스타일: ${styleName}
모델: prunaai/hidream-l1-fast
해상도: 16:9
Inference Steps: 16

BASE_PROMPT (모든 장면에 반드시 포함):
Flat 2D vector illustration, minimal vector art, stylized cartoon character, thick bold black outlines, unshaded, flat solid colors, cel-shaded, simple line art, comic book inking style, completely flat, no shadows, no gradients, no depth, consistent cartoon style, bold clean lines, vibrant colors, simplified shapes, graphic design aesthetic

추가 구성 (모든 장면에 일관되게 적용):
- Character Details: The character is in an expressive, dynamic pose appropriate for the scene. The character can be wearing stylized cartoon clothing, costumes, or accessories that fit the theme of the environment. Any clothing must match the simple, bold-line cartoon aesthetic, avoiding overly complex or realistic textures. Character design must be consistent across all scenes. IMPORTANT: Use a stylized cartoon character with full body proportions, NOT a stickman or stick figure. The character must have proper body structure, not just lines.
- Environment & Lighting: The background is a rich, detailed, and colorful stylized cartoon environment (e.g., a bustling futuristic market, a pirate ship deck, a magical forest) filled with relevant objects. The entire frame is filled, with NO blank or simple background regions. The scene features dynamic, dramatic lighting with strong highlights and shadows that enhance the 2D cartoon feel.
- Style Consistency: All characters, objects, and backgrounds must maintain the same flat 2D vector illustration style throughout. Use consistent line weights, color palette, and shading style. No mixing of different art styles.

NEGATIVE_PROMPT:
realistic human, detailed human skin, photograph, 3d render, blank white background, line-art only, text, watermark, stickman, stick figure, stick man, stick-man, stick-figure, simple line art character, line drawing character, photorealistic, realistic photography, hyperrealistic, 3D CGI, rendered, photography style, DSLR camera, professional photography, cinematic photography, any realistic or photorealistic style, mixed art styles, inconsistent style, different art styles, minimalist stick figure, basic stick character, stick character design

[애니메이션2 프롬프트 템플릿]
STEP 3에서 영어 프롬프트를 생성할 때, BASE_PROMPT와 추가 구성을 반드시 포함하고, 사용자 프롬프트와 결합하세요.
⚠️ 중요: 
- 모든 장면에 동일한 BASE_PROMPT를 반드시 포함해야 합니다.
- 스틱맨(stickman)이 나오면 안 됩니다. 일반적인 스타일화된 카툰 캐릭터를 사용하세요.
- 모든 장면에서 일관된 그림체를 유지해야 합니다. 같은 선 굵기, 색상 팔레트, 스타일을 사용하세요.
`
      } else if (imageStyle === "animation3") {
        styleInfo = `스타일: ${styleName}
모델: prunaai/hidream-l1-fast
해상도: 16:9
Inference Steps: 16

BASE_PROMPT:
European graphic novel style, bande dessinée aesthetic, highly detailed traditional illustration, hand-drawn ink lines with cross-hatching shadows, sophisticated and muted color palette, atmospheric, cinematic frame

추가 구성:
- Character Details: Character rendered with realistic proportions and expressive, mature features. Deep shadows on the face to create mystery (chiaroscuro effect). Clothing folds are detailed with heavy ink work. Serious and grounded character design, NOT cartoony or anime-like.
- Environment: Background is intricate and heavily detailed with ink lines and watercolor washes. Dramatic, moody lighting with strong contrast between light and dark. Rich textures on furniture, walls, and objects. Feels historical and mysterious.
- Constraints: NO anime style, NO Studio Ghibli look, NO manga big eyes, NO cute aesthetic. Avoid purely sleek digital painting look. Must feel like traditional media.

NEGATIVE_PROMPT:
anime style, Studio Ghibli look, manga big eyes, cute aesthetic, purely sleek digital painting look

[유럽풍 그래픽 노블 프롬프트 템플릿]
STEP 3에서 영어 프롬프트를 생성할 때, BASE_PROMPT와 추가 구성을 반드시 포함하고, 사용자 프롬프트와 결합하세요.
`
      } else {
        styleInfo = `스타일: ${styleName}
모델: black-forest-labs/flux-pro`
      }

      // 스틱맨 애니메이션의 경우 첫 번째 Scene에서 캐릭터 설명 추가 (커스텀 스타일이 없을 때만)
      let characterContext = ""
      if (!customStylePrompt && imageStyle === "stickman-animation") {
        if (sceneNum === 1) {
          characterContext = `
**중요: 이것은 첫 번째 Scene입니다.**
- 이 Scene에서 등장하는 주인공 스틱맨 캐릭터의 상세한 특징을 정의하세요.
- 캐릭터의 역할, 외형 특징, 자세 등을 명확히 묘사하세요.
- 이후 모든 Scene에서 이 캐릭터와 동일한 스틱맨을 사용해야 합니다.
- 프롬프트에 "the main stickman character" 또는 "the protagonist stickman"을 사용하여 이 캐릭터를 명확히 식별할 수 있도록 하세요.
`
        } else if (stickmanCharacterDescription) {
          characterContext = `
**중요: 이것은 Scene ${sceneNum}입니다.**
- Scene 1에서 정의한 동일한 스틱맨 캐릭터를 사용해야 합니다.
- Scene 1의 캐릭터 설명: "${stickmanCharacterDescription}"
- 모든 장면에서 "the same stickman character from Scene 1", "the main stickman character", 또는 "the protagonist stickman"을 사용하여 동일한 캐릭터임을 명시하세요.
- 새로운 캐릭터나 다른 스틱맨이 등장하면 안 됩니다.
- 캐릭터의 외형, 역할, 특징은 Scene 1과 완전히 동일해야 합니다.
`
        } else {
          characterContext = `
**중요: 이것은 Scene ${sceneNum}입니다.**
- Scene 1에서 정의한 동일한 스틱맨 캐릭터를 사용해야 합니다.
- 모든 장면에서 "the same stickman character from Scene 1", "the main stickman character", 또는 "the protagonist stickman"을 사용하여 동일한 캐릭터임을 명시하세요.
- 새로운 캐릭터나 다른 스틱맨이 등장하면 안 됩니다.
`
        }
      }

      // 커스텀 스타일 프롬프트가 있으면 추가 (이미 styleInfo에 포함되어 있으므로 빈 문자열)
      const customStyleInfo = ""

      // sceneImages 안전성 확인
      if (!sceneImages || !Array.isArray(sceneImages) || sceneImages.length === 0) {
        console.warn(`[프롬프트 생성] Scene ${sceneNum}에서 sceneImages가 유효하지 않습니다.`)
        continue
      }

      const characterTypeInfo = (imageStyle === "realistic" || imageStyle === "realistic2") && realisticCharacterType
        ? realisticCharacterType === "korean"
          ? `\n⚠️ 중요: 모든 인물은 한국인(Korean)으로 묘사되어야 합니다. 프롬프트에 'Korean', 'Korean person', 'Korean character', 'Asian features' 등을 반드시 포함하세요.\n`
          : `\n⚠️ 중요: 모든 인물은 외국인(Western/Caucasian)으로 묘사되어야 합니다. 프롬프트에 'Western', 'Caucasian', 'European', 'American' 등을 반드시 포함하세요.\n`
        : ""
      
      const userPrompt = `${
        historicalContext 
          ? `\n⚠️ 중요: 전체 대본의 시대적 배경은 "${historicalContext}"입니다. 모든 장면의 프롬프트에 이 시대적 배경을 반드시 포함하세요.\n`
          : ""
      }${characterTypeInfo}
Scene ${sceneNum}에는 ${sceneImages.length}개의 장면이 있습니다.

${styleInfo}${templateInfo}${characterContext}${customStyleInfo}

각 장면의 한국어 텍스트:
${sceneImages.map((img, idx) => `장면 ${img.imageNumber}:\n${img.text}`).join("\n\n")}

위 규칙에 따라 각 장면마다 다음 형식으로 출력하세요:
"장면 N: [시각화 지시문(한국어)]\n[영어 프롬프트]"

시각화 지시문은 그림이나 사진을 설명하는 한국어 문장으로 작성하세요.
${customStylePrompt ? "각 장면의 영어 프롬프트에는 반드시 위의 커스텀 스타일 프롬프트를 포함하세요." : ""}
장면 번호는 ${sceneImages.map(img => img.imageNumber).join(", ")}입니다.
${imageStyle === "realistic" || imageStyle === "realistic2" ? "Inference Steps는 4입니다." : imageStyle === "animation2" || imageStyle === "animation3" || imageStyle === "stickman-animation" ? "Inference Steps는 16입니다." : ""}`

      let content: string

      try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${actualApiKey}`,
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
        const errorText = await response.text()
          let errorData: any = null
          
          try {
            errorData = JSON.parse(errorText)
          } catch {
            // JSON 파싱 실패 시 무시
          }

          // Rate Limit 오류 감지 (429 또는 rate_limit_exceeded)
          const isRateLimitError = 
            response.status === 429 || 
            errorData?.error?.code === "rate_limit_exceeded" ||
            errorText.includes("Rate limit") ||
            errorText.includes("rate_limit")

          if (isRateLimitError) {
            console.warn(`[Scene ${sceneNum}] OpenAI Rate Limit 초과, Gemini로 전환 시도`)
            
            // Gemini API 키 가져오기
            const geminiApiKey = getEnvApiKey("gemini")
            
            if (!geminiApiKey) {
              throw new Error(`OpenAI Rate Limit 초과 및 Gemini API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.`)
            }

            // Gemini API로 fallback
            try {
              content = await generatePromptsWithGemini(systemPrompt, userPrompt, geminiApiKey)
              console.log(`[Scene ${sceneNum}] Gemini API로 프롬프트 생성 성공`)
            } catch (geminiError) {
              throw new Error(`OpenAI Rate Limit 초과 및 Gemini API 호출 실패: ${geminiError instanceof Error ? geminiError.message : "알 수 없는 오류"}`)
            }
          } else {
            throw new Error(`OpenAI API 호출 실패: ${response.status} - ${errorText}`)
      }
        } else {
      const data = await response.json()
      
      // API 응답 검증
      if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error(`[Scene ${sceneNum}] API 응답 오류:`, data)
        throw new Error(`Scene ${sceneNum} 프롬프트 생성에 실패했습니다: API 응답 형식이 올바르지 않습니다.`)
      }
      
          content = data.choices[0]?.message?.content

      if (!content || typeof content !== 'string') {
        console.error(`[Scene ${sceneNum}] 콘텐츠 없음:`, data.choices[0])
        throw new Error(`Scene ${sceneNum} 프롬프트 생성에 실패했습니다: 응답 내용이 없습니다.`)
          }
        }
      } catch (error) {
        // 이미 처리된 오류는 그대로 throw
        if (error instanceof Error && error.message.includes("Rate Limit")) {
          throw error
        }
        // 기타 오류도 Gemini로 fallback 시도
        console.warn(`[Scene ${sceneNum}] OpenAI API 오류, Gemini로 fallback 시도:`, error)
        
        const geminiApiKey = getEnvApiKey("gemini")
        if (geminiApiKey) {
          try {
            content = await generatePromptsWithGemini(systemPrompt, userPrompt, geminiApiKey)
            console.log(`[Scene ${sceneNum}] Gemini API로 프롬프트 생성 성공 (fallback)`)
          } catch (geminiError) {
            throw new Error(`OpenAI API 실패 및 Gemini API 호출 실패: ${geminiError instanceof Error ? geminiError.message : "알 수 없는 오류"}`)
          }
        } else {
          throw error
        }
      }

      console.log(`[Scene ${sceneNum}] API 응답 내용:`, content.substring(0, 500))

      // 텍스트에서 각 장면의 프롬프트 추출
      const sceneImageResults: Array<{ imageNumber: number; prompt: string; sceneText: string; visualInstruction?: string }> = []
      
      // "장면 N: [시각화 지시문(한국어)]\n[영어 프롬프트]" 패턴으로 파싱
      const promptRegex = /장면\s+(\d+):\s*([^\n]+)\n([\s\S]+?)(?=\n장면\s+\d+:|$)/g
      const prompts: Map<number, { visualInstruction: string; prompt: string }> = new Map()
      
      let match
      while ((match = promptRegex.exec(content)) !== null) {
        const imageNum = parseInt(match[1])
        const visualInstruction = match[2].trim()
        const prompt = match[3].trim()
        if (prompt) {
          prompts.set(imageNum, { visualInstruction, prompt })
        }
      }
      
      // 새로운 형식으로 파싱되지 않은 경우 기존 형식으로 시도
      if (prompts.size === 0) {
        const fallbackRegex = /장면\s+(\d+):\s*([\s\S]+?)(?=\n장면\s+\d+:|$)/g
        let fallbackMatch
        while ((fallbackMatch = fallbackRegex.exec(content)) !== null) {
          const imageNum = parseInt(fallbackMatch[1])
          const prompt = fallbackMatch[2].trim()
          if (prompt) {
            prompts.set(imageNum, { visualInstruction: "", prompt })
          }
        }
      }
      
      // 스틱맨 애니메이션의 경우 첫 번째 Scene에서 캐릭터 설명 추출
      if (imageStyle === "stickman-animation" && sceneNum === 1 && prompts.size > 0) {
        // 첫 번째 장면의 프롬프트에서 캐릭터 설명 추출 시도
        const firstPromptData = Array.from(prompts.values())[0]
        const firstPrompt = firstPromptData?.prompt || ""
        // 프롬프트에서 캐릭터 역할이나 특징을 추출 (예: "a detective", "the main stickman character" 등)
        const characterMatch = firstPrompt.match(/(?:the same stickman character|the main stickman character|the protagonist stickman|a stickman character)\s*\(([^)]+)\)/i)
        if (characterMatch) {
          stickmanCharacterDescription = characterMatch[1]
        } else {
          // 역할을 찾지 못한 경우 첫 번째 장면의 텍스트에서 역할 추출
          const firstSceneText = sceneImages[0]?.text || ""
          const roleMatch = firstSceneText.match(/(?:탐정|의사|선생님|학생|경찰|요리사|운동선수|가수|배우|기자|변호사|간호사|엔지니어|프로그래머|디자이너|예술가|작가|음악가)/)
          if (roleMatch) {
            stickmanCharacterDescription = roleMatch[0]
          } else {
            stickmanCharacterDescription = "the main protagonist"
          }
        }
        console.log(`[Scene 1] 스틱맨 캐릭터 설명 저장: ${stickmanCharacterDescription}`)
      }
      
      // 각 장면에 대해 프롬프트 매칭 (안전성 확인)
      if (!sceneImages || !Array.isArray(sceneImages)) {
        console.error(`[Scene ${sceneNum}] sceneImages가 유효하지 않습니다.`)
        // sceneImages가 유효하지 않으면 빈 결과 추가하고 다음 Scene으로
        results.push({
          sceneNumber: sceneNum,
          images: []
        })
        continue
      }
      
      sceneImages.forEach((img) => {
        if (!img || typeof img.imageNumber !== 'number') {
          console.warn(`[Scene ${sceneNum}] 유효하지 않은 이미지 데이터:`, img)
          return
        }
        
        const promptData = prompts.get(img.imageNumber)
        let prompt = (promptData?.prompt || img?.text || "").trim()
        const visualInstruction = (promptData?.visualInstruction || "").trim()
        
        if (!prompt) {
          console.warn(`[Scene ${sceneNum}] Image ${img.imageNumber} 프롬프트가 비어있습니다.`)
          prompt = img?.text || "image"
        }
        
        // 시대적 배경이 있으면 프롬프트에 명시적으로 포함 (확실히 하기 위해)
        if (historicalContext) {
          // 프롬프트에 시대적 배경이 포함되어 있는지 확인
          const contextLower = historicalContext.toLowerCase()
          const promptLower = prompt.toLowerCase()
          
          // 시대적 배경의 주요 키워드가 프롬프트에 없으면 추가
          const contextKeywords = (typeof historicalContext === 'string' ? historicalContext.split(/[,\s]+/) : []).filter((k: string) => k && k.length > 3)
          const hasContext = contextKeywords.some(keyword => 
            promptLower.includes(keyword.toLowerCase())
          )
          
          if (!hasContext) {
            // 프롬프트 앞부분에 시대적 배경 추가
            prompt = `${historicalContext}, ${prompt}`
            console.log(`[Scene ${sceneNum}] Image ${img.imageNumber}에 시대적 배경 추가: ${historicalContext}`)
          }
        }

        // 스틱맨 애니메이션: 모든 Scene에서 스틱맨 키워드 강제 추가
        if (imageStyle === "stickman-animation") {
          if (sceneNum > 1 && stickmanCharacterDescription) {
            // 첫 번째 Scene 이후: 동일한 스틱맨 캐릭터 참조
            if (!prompt.toLowerCase().includes("the same stickman character") && 
                !prompt.toLowerCase().includes("the main stickman character") &&
                !prompt.toLowerCase().includes("the protagonist stickman")) {
              prompt = `The same stickman character from Scene 1 (${stickmanCharacterDescription}), ${prompt}`
            }
          } else {
            // 첫 번째 Scene: 스틱맨 키워드 강제 추가
            if (!prompt.toLowerCase().includes("stickman") && !prompt.toLowerCase().includes("stick-figure")) {
              prompt = `stickman character, ${prompt}`
            }
          }
        }
        
        // 한국어 제거: 프롬프트에서 한국어 문자 제거
        const koreanRegex = /[가-힣]+/g
        prompt = prompt.replace(koreanRegex, '').replace(/\s+/g, ' ').trim()
        
        // 커스텀 스타일 프롬프트가 있으면 추가 (이미 LLM이 포함했을 수도 있지만, 확실히 하기 위해 추가)
        if (customStylePrompt && typeof customStylePrompt === 'string' && customStylePrompt.trim().length > 0) {
          const customStyleLower = customStylePrompt.toLowerCase()
          const promptLower = prompt.toLowerCase()
          const customStylePrefix = customStyleLower.substring(0, Math.min(50, customStyleLower.length))
          if (!promptLower.includes(customStylePrefix)) {
            prompt = `${prompt}, ${customStylePrompt}`
          }
        }

        // 텍스트 제외 지시 추가 (없으면 추가)
        const textExclusionTerms = ["no text", "no letters", "no words", "no writing", "no labels", "no signs", "no watermark"]
        const hasTextExclusion = textExclusionTerms.some(term => prompt.toLowerCase().includes(term))
        if (!hasTextExclusion) {
          prompt = `${prompt}, no text, no letters, no words, no writing, no labels, no signs, no watermark`
        }

        // 스타일 일관성 강화: 스타일별 불일치 키워드 제거 및 일관성 키워드 추가
        if (imageStyle === "stickman-animation") {
          // 스틱맨 애니메이션: 다른 스타일 키워드 제거
          const nonStickmanTerms = ["realistic", "photorealistic", "hyperrealistic", "photograph", "3D CGI", "rendered", "animation style", "cartoon style", "illustration style", "vector art", "flat design", "cel-shaded", "stylized character", "non-stickman", "animated character", "cartoon character"]
          let cleanedPrompt = prompt
          nonStickmanTerms.forEach(term => {
            const regex = new RegExp(term, 'gi')
            cleanedPrompt = cleanedPrompt.replace(regex, '')
          })
          prompt = cleanedPrompt.replace(/\s+/g, ' ').trim()
          
          // 스틱맨 애니메이션 BASE_PROMPT 강제 추가 (모든 씬에 일관되게) - STRICT STICKMAN STYLE
          const stickmanBasePrompt = "STRICT STICKMAN STYLE. A single stickman character (round white face only). Pure stickman anatomy: round white head, dot eyes + simple curved smile only. No hair, no ears, no nose, no cheeks, no detailed facial features. Ultra-thin black limbs with uniform stroke width, simple mitten hands, no fingers, no body volume, no muscles, no realistic proportions"
          const stickmanStylePhrase = "Flat 2D vector illustration, bold clean outline, solid color fills, minimal cel shading, playful explainer-video aesthetic"
          const stickmanExtra = "Simple background with clean shapes and a few colorful details (buildings/windows/signs), no realistic textures, no painterly rendering. Keep the stickman centered, full body visible, clear readable silhouette, bright and friendly mood"
          const stickmanBodyVisibility = "MANDATORY BODY VISIBILITY: The stickman character MUST show the full body including both head and torso, not just torso alone. Full body visible: head, torso, and limbs all must be visible in the image. No partial body, no torso-only, no head-only. Complete stickman figure required. The stickman character MUST have exactly two arms visible, both arms must be clearly shown."
          const promptLower = prompt.toLowerCase()
          if (!promptLower.includes("strict stickman style") || !promptLower.includes("round white head") || !promptLower.includes("dot eyes") || !promptLower.includes("ultra-thin black limbs")) {
            prompt = `${prompt}, ${stickmanBasePrompt}, ${stickmanStylePhrase}, ${stickmanExtra}, ${stickmanBodyVisibility}`
          }
          if (!promptLower.includes("no hair") || !promptLower.includes("no ears") || !promptLower.includes("no nose")) {
            prompt = `${prompt}, no hair, no ears, no nose, no cheeks, no detailed facial features, no realistic human anatomy, no person, no man, no woman, only stickman`
          }
          if (!promptLower.includes("full body visible") || !promptLower.includes("head and torso") || !promptLower.includes("exactly two arms")) {
            prompt = `${prompt}, ${stickmanBodyVisibility}`
          }
        } else if (imageStyle === "realistic" || imageStyle === "realistic2") {
          // 실사화: 애니메이션/카툰 키워드 제거
          const nonRealisticTerms = ["stickman", "stick figure", "stick man", "animation style", "animated", "cel-shaded", "vector art", "flat design", "stylized character", "cartoon character", "illustrated", "graphic novel", "comic book", "hand-drawn", "digital art", "2D animation", "animated character", "cartoon style"]
          let cleanedPrompt = prompt
          nonRealisticTerms.forEach(term => {
            const regex = new RegExp(term, 'gi')
            cleanedPrompt = cleanedPrompt.replace(regex, '')
          })
          prompt = cleanedPrompt.replace(/\s+/g, ' ').trim()
          
        // 실사 스타일 BASE_PROMPT 강제 추가 (모든 씬에 일관되게)
        const realisticBasePrompt = "A hyperrealistic, photorealistic masterpiece, 8K, ultra-detailed, sharp focus, cinematic lighting, shot on a professional DSLR camera with a 50mm lens"
        const promptLower = prompt.toLowerCase()
        if (!promptLower.includes("hyperrealistic") || !promptLower.includes("photorealistic") || !promptLower.includes("8k") || !promptLower.includes("dslr")) {
          prompt = `${prompt}, ${realisticBasePrompt}`
        }
        
        // 한국인/외국인 키워드 강제 추가
        if (realisticCharacterType === "korean") {
          if (!promptLower.includes("korean") && !promptLower.includes("korean person") && !promptLower.includes("korean character") && !promptLower.includes("asian features")) {
            prompt = `${prompt}, Korean person, Korean character, Asian features`
          }
        } else if (realisticCharacterType === "foreign") {
          if (!promptLower.includes("western") && !promptLower.includes("caucasian") && !promptLower.includes("european") && !promptLower.includes("american")) {
            prompt = `${prompt}, Western person, Caucasian, European features`
          }
        }
        
        if (!promptLower.includes("no animation") && !promptLower.includes("no cartoon")) {
          prompt = `${prompt}, no animation style, no cartoon style, no illustration style, photorealistic only`
        }
        } else if (imageStyle === "animation2") {
          // 애니메이션2: 스틱맨 및 실사 키워드 강력하게 제거
          const nonAnimation2Terms = [
            "stickman", "stick figure", "stick man", "stick-man", "stick-figure",
            "photorealistic", "hyperrealistic", "realistic photography", 
            "3D CGI", "rendered", "photography style", "DSLR camera", 
            "professional photography", "line drawing", "simple line art character"
          ]
          let cleanedPrompt = prompt
          nonAnimation2Terms.forEach(term => {
            const regex = new RegExp(term, 'gi')
            cleanedPrompt = cleanedPrompt.replace(regex, '')
          })
          // 추가: 스틱맨 관련 패턴 제거 (예: "stick man", "stick-man character" 등)
          cleanedPrompt = cleanedPrompt.replace(/\bstick\s*[-]?\s*man\b/gi, 'stylized cartoon character')
          cleanedPrompt = cleanedPrompt.replace(/\bstick\s*[-]?\s*figure\b/gi, 'stylized cartoon character')
          // "of the stickman", "aesthetic of the stickman" 등 패턴 제거
          cleanedPrompt = cleanedPrompt.replace(/of\s+the\s+stickman/gi, 'of the stylized cartoon character')
          cleanedPrompt = cleanedPrompt.replace(/aesthetic\s+of\s+the\s+stickman/gi, 'aesthetic of the stylized cartoon character')
          cleanedPrompt = cleanedPrompt.replace(/cartoon\s+aesthetic\s+of\s+the\s+stickman/gi, 'cartoon aesthetic')
          prompt = cleanedPrompt.replace(/\s+/g, ' ').trim()
          
          // 스틱맨이 여전히 남아있는지 확인하고 강제로 교체
          if (prompt.toLowerCase().includes('stick')) {
            prompt = prompt.replace(/\bstick[^\s]*/gi, 'stylized cartoon character')
            // "of the stickman" 패턴도 다시 확인
            prompt = prompt.replace(/of\s+the\s+stylized\s+cartoon\s+character/gi, 'of the stylized cartoon character')
            prompt = prompt.replace(/aesthetic\s+of\s+the\s+stylized\s+cartoon\s+character/gi, 'aesthetic')
          }
          
          // 애니메이션2 스타일 BASE_PROMPT 강제 추가 (모든 씬에 일관되게) - 고도화된 일관성
          const animation2BasePrompt = "Flat 2D vector illustration, minimal vector art, stylized cartoon character, thick bold black outlines, unshaded, flat solid colors, cel-shaded, simple line art, comic book inking style, completely flat, no shadows, no gradients, no depth, consistent cartoon style, bold clean lines, vibrant colors, simplified shapes, graphic design aesthetic"
          const animation2CharacterDetails = "expressive dynamic pose, stylized cartoon clothing, simple bold-line cartoon aesthetic, consistent character design"
          const animation2Environment = "rich detailed colorful stylized cartoon environment, filled frame, no blank background, dynamic dramatic lighting, 2D cartoon feel"
          const promptLower = prompt.toLowerCase()
          if (!promptLower.includes("flat 2d vector") || !promptLower.includes("stylized cartoon character") || !promptLower.includes("thick bold black outlines") || !promptLower.includes("cel-shaded") || !promptLower.includes("consistent cartoon style")) {
            prompt = `${prompt}, ${animation2BasePrompt}`
          }
          if (!promptLower.includes("consistent character design") || !promptLower.includes("bold clean lines")) {
            prompt = `${prompt}, ${animation2CharacterDetails}, ${animation2Environment}`
          }
          if (!promptLower.includes("no stickman")) {
            prompt = `${prompt}, no stickman, no stick figure, no realistic photography, no mixed art styles, no inconsistent style`
          }
        } else if (imageStyle === "animation3") {
          // 애니메이션3 스타일 BASE_PROMPT 강제 추가 (모든 씬에 일관되게)
          const animation3BasePrompt = "European graphic novel style, bande dessinée aesthetic, highly detailed traditional illustration, hand-drawn ink lines with cross-hatching shadows, sophisticated and muted color palette, atmospheric, cinematic frame"
          const promptLower = prompt.toLowerCase()
          if (!promptLower.includes("european graphic novel") || !promptLower.includes("bande dessinée") || !promptLower.includes("hand-drawn ink lines") || !promptLower.includes("cross-hatching")) {
            prompt = `${prompt}, ${animation3BasePrompt}`
          }
        }

        console.log(`[Scene ${sceneNum}] Image ${img.imageNumber} 프롬프트:`, prompt ? prompt.substring(0, 100) : "(없음)")
        console.log(`[Scene ${sceneNum}] Image ${img.imageNumber} 시각화 지시문:`, visualInstruction || "(없음)")

        sceneImageResults.push({
          imageNumber: img.imageNumber,
          prompt: prompt,
          sceneText: img.text,
          visualInstruction: visualInstruction || undefined,
        })
      })

      results.push({
        sceneNumber: sceneNum,
        images: sceneImageResults,
      })
    }

    return results
    } catch (error) {
      console.error(`[프롬프트 생성] 실패 (재시도: ${isRetry ? "예" : "아니오"}):`, error)
      throw error
    }
  }

  // 내부 API 키로 생성 시도
  return await tryGenerate(actualApiKey, false)
}

/**
 * 이미지 스타일 이름을 한국어로 변환하는 함수
 */
function getImageStyleName(style: string): string {
  const styleMap: Record<string, string> = {
    "stickman-animation": "스틱맨 애니메이션",
    "realistic": "실사화",
    "realistic2": "실사화2",
    "animation2": "애니메이션2",
    "animation3": "유럽풍 그래픽 노블",
  }
  return styleMap[style] || style
}

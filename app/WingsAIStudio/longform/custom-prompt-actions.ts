"use server"

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
  realisticCharacterType?: "korean" | "foreign" | "none" | null
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
    
    // 한국 역사인 경우 배경 및 건축 키워드 강화 (historicalContext 확인)
    if (historicalContext) {
      const contextLower = historicalContext.toLowerCase()
      const isKoreanHistory = contextLower.includes("조선") || 
                              contextLower.includes("joseon") || 
                              contextLower.includes("고려") || 
                              contextLower.includes("goryeo") || 
                              contextLower.includes("고구려") || 
                              contextLower.includes("goguryeo") ||
                              contextLower.includes("한국") ||
                              contextLower.includes("korean")
      
      if (isKoreanHistory) {
        const promptLower = finalPrompt.toLowerCase()
        
        // 한국 키워드 확인
        const hasKorean = promptLower.includes("korean") || promptLower.includes("joseon") || promptLower.includes("goryeo")
        const hasChineseExclusion = promptLower.includes("not chinese") || promptLower.includes("not chinese style")
        
        // 한국 키워드가 없으면 추가
        if (!hasKorean) {
          let periodKeyword = ""
          if (contextLower.includes("조선") || contextLower.includes("joseon")) {
            periodKeyword = "Joseon Dynasty, Korean Joseon era"
          } else if (contextLower.includes("고려") || contextLower.includes("goryeo")) {
            periodKeyword = "Goryeo Dynasty, Korean Goryeo period"
          } else if (contextLower.includes("고구려") || contextLower.includes("goguryeo")) {
            periodKeyword = "Goguryeo Kingdom, ancient Korean kingdom"
          } else {
            periodKeyword = "Korean historical period"
          }
          
          finalPrompt = `${finalPrompt}, ${periodKeyword}, Korean setting, Korean architecture`
        }
        
        // 중국 제외 키워드가 없으면 추가
        if (!hasChineseExclusion) {
          finalPrompt = `${finalPrompt}, NOT Chinese, NOT Chinese style, NOT Chinese architecture, Korean setting NOT Chinese`
        }
        
        // 배경/건축 관련 키워드 강화
        const hasKoreanArchitecture = promptLower.includes("korean architecture") || 
                                     promptLower.includes("korean hanok") || 
                                     promptLower.includes("korean palace") ||
                                     promptLower.includes("korean temple")
        
        if (!hasKoreanArchitecture) {
          // 배경 관련 키워드가 있으면 한국 건축으로 명시
          if (promptLower.includes("palace") || promptLower.includes("temple") || promptLower.includes("building") || promptLower.includes("architecture")) {
            finalPrompt = finalPrompt
              .replace(/\bpalace\b/gi, "Korean palace (Gyeongbokgung style)")
              .replace(/\btemple\b/gi, "Korean temple")
              .replace(/\bbuilding\b/gi, "Korean building")
              .replace(/\barchitecture\b/gi, "Korean architecture")
          } else {
            // 배경 관련 키워드가 없으면 한국 배경 추가
            finalPrompt = `${finalPrompt}, Korean traditional architecture, Korean hanok, Korean setting`
          }
        }
        
        // 중국 관련 키워드 제거 및 대체
        finalPrompt = finalPrompt
          .replace(/\bChinese architecture\b/gi, "Korean architecture")
          .replace(/\bChinese style\b/gi, "Korean style")
          .replace(/\bChinese traditional\b/gi, "Korean traditional")
          .replace(/\bChina\b/gi, "Korea")
          .replace(/\bBeijing\b/gi, "Seoul")
          .replace(/\bShanghai\b/gi, "Korean city")
          .replace(/\bForbidden City\b/gi, "Korean palace")
      }
    }

    return finalPrompt
  } catch (error) {
    console.error("[Longform] 커스텀 이미지 프롬프트 변환 실패:", error)
    throw error
  }
}


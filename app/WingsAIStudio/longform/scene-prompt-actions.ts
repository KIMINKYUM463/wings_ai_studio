"use server"

/**
 * 장면을 영어 이미지 프롬프트로 변환하는 함수
 * Scene별로 그룹화된 장면들을 영어 프롬프트로 변환
 */
export async function generateSceneImagePrompts(
  decomposedScenes: string,
  imageStyle: string,
  openaiApiKey: string,
  customStylePrompt?: string
): Promise<Array<{ sceneNumber: number; images: Array<{ imageNumber: number; prompt: string; sceneText: string; visualInstruction?: string; imageUrl?: string }> }>> {
  if (!openaiApiKey) {
    throw new Error("OpenAI API 키가 필요합니다.")
  }

  if (!decomposedScenes || decomposedScenes.trim().length === 0) {
    throw new Error("장면 분해 결과가 없습니다.")
  }

  try {
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
      const systemPrompt = `너는 장면 기반 이미지 프롬프트 생성기다.

입력은 이미 장면(Scene) 단위로 분리된 한국어 텍스트이며,
너의 작업은 다음 순서를 반드시 따른다. 먼저 이미지 스타일에 따라
인물을 부여하고 그 인물은 각 장면에 일관성있게 무조건 유지되어야한다.
인물이 많으면 그 인물들도 다 일관성있게 유지되어야 한다.

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

[출력 규칙]
- 씬 단위 유지
- 각 씬 안에서 장면 수만큼 이미지 프롬프트 생성
- 설명, 해설, 말투 금지
- 시각화 지시문과 이미지 스타일을 융합(모두 영어로 나와야됨)해 이미지 생성을 하기위한 영어 프롬프트 추출.
- 각 장면마다 다음 형식으로 출력:
  "장면 N: [시각화 지시문(한국어)]\n[영어 프롬프트]"
- 예시:
장면 1: 탐정이 증거를 살펴보는 모습, 사무실 배경, 진지한 표정
A detective looking at evidence, a vibrant 2D cartoon...
장면 2: 탐정이 단서를 발견하는 장면, 책상 위 문서들, 놀란 표정
The detective finds a clue, a vibrant 2D cartoon...`

      const styleName = getImageStyleName(imageStyle)
      
      // 스틱맨 스타일인 경우 템플릿 정보 추가
      let styleInfo = ""
      let templateInfo = ""
      
      if (imageStyle === "stickman-animation") {
        styleInfo = `스타일: 스틱맨 애니메이션
모델: prunaai/hidream-l1-fast
해상도: 1360x768
negative_prompt: realistic human, detailed human skin, photograph, 3d render, blank white background, line-art only, text, watermark, non-stickman, mixed style, detailed cartoon human, prince, princess, disney, pixar, anime, chibi, kawaii, big head, human body, human skin, realistic, 3d render, semi-realistic, detailed face, eyelashes, blush, nose, lips, hair, ears, detailed clothing folds, portrait, close-up, single character focus, bokeh, depth of field, watercolor, painterly, airbrush, soft shading, extra hands, multiple hands, three hands, four hands, extra arms, multiple arms, three arms, four arms, extra limbs, deformed hands, malformed hands, wrong number of fingers, too many fingers, missing hands, missing arms, anatomical errors, body part errors`
        
        templateInfo = `
[스틱맨 프롬프트 템플릿]
STEP 3에서 영어 프롬프트를 생성할 때, 다음 형식을 사용하세요:
{사용자 프롬프트}, {base}, {style_phrase}, {extra}

여기서:
- base: "a vibrant 2D cartoon, fully rendered illustration featuring a stickman with a white circular face, simple black outline, dot eyes, curved mouth, thin black limbs, exactly two arms, exactly two hands (mitten hands with no fingers), expressive pose, correct anatomy, natural pose"
- style_phrase: "Consistent stick-figure illustration style, clean bold lines, solid colors, explainer video aesthetic, simplified background"
- extra: "colorful detailed drawing, rich environment, dynamic lighting, no realistic human anatomy, no blank background, anatomically correct stickman, proper body proportions"

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

예시:
사용자 프롬프트가 "A detective looking at evidence"라면,
최종 프롬프트는:
"The same stickman character (a detective) looking at evidence, a vibrant 2D cartoon, fully rendered illustration featuring a stickman with a white circular face, simple black outline, dot eyes, curved mouth, thin black limbs, exactly two arms, exactly two hands (mitten hands with no fingers), expressive pose, correct anatomy, natural pose, Consistent stick-figure illustration style, clean bold lines, solid colors, explainer video aesthetic, simplified background, colorful detailed drawing, rich environment, dynamic lighting, no realistic human anatomy, no blank background, anatomically correct stickman, proper body proportions"
`
      } else if (imageStyle === "realistic" || imageStyle === "realistic2") {
        styleInfo = `스타일: ${styleName}
모델: google/imagen-4-fast
해상도: 16:9
Inference Steps: 4

BASE_PROMPT:
A hyperrealistic, photorealistic masterpiece, 8K, ultra-detailed, sharp focus, cinematic lighting, shot on a professional DSLR camera with a 50mm lens

NEGATIVE_PROMPT:
painting, drawing, illustration, cartoon, anime, 3d, cgi, render, sketch, watercolor, text, watermark, signature, blurry, out of focus

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

BASE_PROMPT:
Flat 2D vector illustration, minimal vector art, stylized cartoon character, thick bold black outlines, unshaded, flat solid colors, cel-shaded, simple line art, comic book inking style, completely flat, no shadows, no gradients, no depth

추가 구성:
- Character Details: The character is in an expressive, dynamic pose appropriate for the scene. The character can be wearing stylized cartoon clothing, costumes, or accessories that fit the theme of the environment. Any clothing must match the simple, bold-line cartoon aesthetic, avoiding overly complex or realistic textures.
- Environment & Lighting: The background is a rich, detailed, and colorful stylized cartoon environment (e.g., a bustling futuristic market, a pirate ship deck, a magical forest) filled with relevant objects. The entire frame is filled, with NO blank or simple background regions. The scene features dynamic, dramatic lighting with strong highlights and shadows that enhance the 2D cartoon feel.
- Constraints: Base Character Consistency: Maintain consistent character design throughout. No Realistic Anatomy: Do not add realistic human features, muscles, or photorealistic clothing textures. Stick to the simple cartoon style.

NEGATIVE_PROMPT:
realistic human, detailed human skin, photograph, 3d render, blank white background, line-art only, text, watermark, stickman

[애니메이션2 프롬프트 템플릿]
STEP 3에서 영어 프롬프트를 생성할 때, BASE_PROMPT와 추가 구성을 반드시 포함하고, 사용자 프롬프트와 결합하세요.
중요: 스틱맨(stickman)이 나오면 안 됩니다. 일반적인 스타일화된 카툰 캐릭터를 사용하세요.
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

      // 스틱맨 애니메이션의 경우 첫 번째 Scene에서 캐릭터 설명 추가
      let characterContext = ""
      if (imageStyle === "stickman-animation") {
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

      // 커스텀 스타일 프롬프트가 있으면 추가
      const customStyleInfo = customStylePrompt 
        ? `\n\n**중요: 커스텀 스타일 프롬프트**\n다음 커스텀 스타일 프롬프트를 반드시 각 장면의 영어 프롬프트에 포함하세요:\n${customStylePrompt}\n\n각 장면의 프롬프트는 장면 내용과 이 커스텀 스타일 프롬프트를 결합하여 생성하세요.`
        : ""

      const userPrompt = `Scene ${sceneNum}에는 ${sceneImages.length}개의 장면이 있습니다.

${styleInfo}${templateInfo}${characterContext}${customStyleInfo}

각 장면의 한국어 텍스트:
${sceneImages.map((img, idx) => `장면 ${img.imageNumber}:\n${img.text}`).join("\n\n")}

위 규칙에 따라 각 장면마다 다음 형식으로 출력하세요:
"장면 N: [시각화 지시문(한국어)]\n[영어 프롬프트]"

시각화 지시문은 그림이나 사진을 설명하는 한국어 문장으로 작성하세요.
${customStylePrompt ? "각 장면의 영어 프롬프트에는 반드시 위의 커스텀 스타일 프롬프트를 포함하세요." : ""}
장면 번호는 ${sceneImages.map(img => img.imageNumber).join(", ")}입니다.
${imageStyle === "realistic" || imageStyle === "realistic2" ? "Inference Steps는 4입니다." : imageStyle === "animation2" || imageStyle === "animation3" || imageStyle === "stickman-animation" ? "Inference Steps는 16입니다." : ""}`

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
          max_tokens: 4000,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI API 호출 실패: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        throw new Error(`Scene ${sceneNum} 프롬프트 생성에 실패했습니다.`)
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
      
      // 각 장면에 대해 프롬프트 매칭
      sceneImages.forEach((img) => {
        const promptData = prompts.get(img.imageNumber)
        let prompt = promptData?.prompt || img.text
        const visualInstruction = promptData?.visualInstruction || ""
        
        // 스틱맨 애니메이션이고 첫 번째 Scene이 아닌 경우, 캐릭터 일관성 보장
        if (imageStyle === "stickman-animation" && sceneNum > 1 && stickmanCharacterDescription) {
          // 프롬프트에 "the same stickman character"가 없으면 추가
          if (!prompt.toLowerCase().includes("the same stickman character") && 
              !prompt.toLowerCase().includes("the main stickman character") &&
              !prompt.toLowerCase().includes("the protagonist stickman")) {
            // 프롬프트 시작 부분에 캐릭터 참조 추가
            prompt = `The same stickman character from Scene 1 (${stickmanCharacterDescription}), ${prompt}`
          }
        }
        
        // 커스텀 스타일 프롬프트가 있으면 추가 (이미 LLM이 포함했을 수도 있지만, 확실히 하기 위해 추가)
        if (customStylePrompt && !prompt.toLowerCase().includes(customStylePrompt.toLowerCase().substring(0, 50))) {
          prompt = `${prompt}, ${customStylePrompt}`
        }

        console.log(`[Scene ${sceneNum}] Image ${img.imageNumber} 프롬프트:`, prompt.substring(0, 100))
        console.log(`[Scene ${sceneNum}] Image ${img.imageNumber} 시각화 지시문:`, visualInstruction)

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
    console.error("장면 프롬프트 생성 실패:", error)
    throw error
  }
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

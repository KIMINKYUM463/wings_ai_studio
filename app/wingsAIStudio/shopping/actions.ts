"use server"

// 대본을 3개 장면으로 나누는 함수
export async function splitScriptIntoScenes(script: string): Promise<string[]> {
  // 대본을 3개 섹션으로 나누기
  // 각 섹션은 대본의 내용에 맞게 균등하게 분할
  
  // 먼저 문장 부호로 나누기
  const sentences = script
    .split(/[.!?。！？]\s*/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0)
  
  if (sentences.length === 0) {
    // 문장이 없으면 전체를 3등분
    const sectionLength = Math.ceil(script.length / 3)
    return [
      script.substring(0, sectionLength),
      script.substring(sectionLength, sectionLength * 2),
      script.substring(sectionLength * 2)
    ].filter(s => s.trim().length > 0)
  }
  
  // 3개 섹션으로 나누기 (대본의 내용에 맞게 균등 분할)
  const sections: string[] = []
  const totalLength = script.length
  const sectionLength = Math.ceil(totalLength / 3)
  
  // 문장 단위로 섹션 나누기 (의미 단위 유지)
  let currentSection = ""
  let currentSectionLength = 0
  
  for (const sentence of sentences) {
    const sentenceLength = sentence.length + 1 // 공백 포함
    
    // 현재 섹션이 비어있거나, 섹션 길이가 목표 길이보다 작으면 추가
    if (sections.length === 0 || currentSectionLength + sentenceLength <= sectionLength) {
      // 현재 섹션에 추가
      currentSection += (currentSection ? " " : "") + sentence
      currentSectionLength += sentenceLength
    } else {
      // 현재 섹션 완료, 새 섹션 시작
      if (currentSection.trim()) {
        sections.push(currentSection.trim())
      }
      currentSection = sentence
      currentSectionLength = sentenceLength
    }
  }
  
  // 마지막 섹션 추가
  if (currentSection.trim()) {
    sections.push(currentSection.trim())
  }
  
  // 정확히 3개 섹션이 되도록 조정
  while (sections.length < 3 && sections.length > 0) {
    sections.push(sections[sections.length - 1])
  }
  
  // 정확히 3개만 반환
  const finalSections = sections.slice(0, 3)
  
  if (finalSections.length !== 3) {
    throw new Error(`섹션은 정확히 3개여야 합니다. 현재: ${finalSections.length}개`)
  }
  
  console.log("[Shopping] 대본 3분할 완료:")
  finalSections.forEach((section, index) => {
    console.log(`  섹션 ${index + 1} (${section.length}자): ${section.substring(0, 50)}...`)
  })
  
  return finalSections
}

// 나노바나나를 사용한 이미지 생성 (제품 이미지 참고)
export async function generateImageWithNanobanana(
  sceneScript: string,
  productName: string,
  productImageBase64: string | undefined,
  replicateApiKey?: string,
  sceneIndex?: number // 섹션 인덱스 (0, 1, 2) - 배경 스타일 결정용
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다.")
  }

  try {
    // 이미지 생성 프롬프트 생성
    // 중요: 텍스트나 글씨가 전혀 없는 순수한 시각적 연출샷만 생성
    // 실제 제품을 사용하는 느낌의 사진이어야 함
    // 각 섹션마다 다른 배경이 나와야 함
    
    // 섹션 인덱스에 따라 완전히 다른 배경 스타일, 제품 각도, 카메라 앵글, 구도 적용
    const sceneConfigs = [
      {
        background: "밝고 깔끔한 실내 배경, 흰색 벽, 자연광이 들어오는 창문, 미니멀한 인테리어, 깨끗한 공간",
        angle: "제품을 위에서 본 각도, top view, bird's eye view, 제품의 상단면이 명확하게 보이는 각도, 공중에서 내려다보는 시점",
        camera: "wide shot, 전체적인 구도, 제품과 배경이 모두 보이는 넓은 화면",
        lighting: "부드러운 자연광, 창문에서 들어오는 햇빛, 밝고 깨끗한 조명",
        composition: "중앙 배치, 대칭적 구도, 미니멀한 구성"
      },
      {
        background: "현대적인 주방이나 거실 배경, 나무 테이블, 따뜻한 조명, 세련된 인테리어, 아늑한 분위기, 생활감 있는 공간",
        angle: "제품을 정면에서 본 각도, front view, 제품의 정면이 명확하게 보이는 각도, 눈높이 시점",
        camera: "medium shot, 제품에 집중된 구도, 배경이 살짝 보이는 중간 거리",
        lighting: "따뜻한 실내 조명, 테이블 램프, 부드러운 그림자",
        composition: "우측 또는 좌측 배치, 비대칭적 구도, 자연스러운 배치"
      },
      {
        background: "야외나 밝은 실외 배경, 파란 하늘, 자연스러운 햇빛, 깔끔한 환경, 신선한 느낌, 공원이나 테라스",
        angle: "제품을 측면에서 본 각도, side view, 45도 각도, 제품의 측면과 정면이 모두 보이는 각도, 약간 위에서 내려다보는 시점",
        camera: "close-up shot, 제품에 매우 집중된 구도, 배경이 흐릿하게 보이는 근접 촬영",
        lighting: "자연스러운 햇빛, 밝은 낮, 선명한 그림자",
        composition: "대각선 구도, 역동적인 배치, 시선을 끄는 구성"
      }
    ]
    
    const currentSceneIndex = sceneIndex !== undefined ? sceneIndex : 0
    const config = sceneConfigs[currentSceneIndex] || sceneConfigs[0]
    
    // 각 장면마다 완전히 다른 프롬프트 구조로 생성
    // 제품 전체가 명확하게 보이고, 손으로 사용하는 장면
    let imagePrompt = `${productName} 제품 사용 장면 사진.

핵심 요소 (반드시 포함):
- 제품 전체가 화면에 완전히 보여야 함 (full product visible, entire product in frame)
- 사람의 손이 제품을 들거나 사용하는 모습 (hands holding or using the product)
- 제품의 모든 디테일과 형태가 명확하게 보임

스타일:
- ${config.angle}
- ${config.camera}
- ${config.lighting}
- ${config.composition}
- ${config.background}

금지 사항:
- 사람 얼굴 없음 (no face, no head visible)
- 텍스트나 글씨 없음 (no text, no letters)

품질: 고품질, 전문적인 제품 촬영, 매력적인 구도, 9:16 세로 비율, vertical composition.`
    
    if (productImageBase64) {
      imagePrompt = `${imagePrompt}

중요: 첨부된 제품 이미지를 참고하여 제품의 실제 모습을 정확하게 보여주세요.
- 제품의 색상, 형태, 디자인을 일관성있게 유지
- 제품 전체가 화면에 완전히 보이도록 구성
- 손이 제품을 자연스럽게 들고 있거나 사용하는 모습`
    }

    console.log("[Shopping] 나노바나나 이미지 생성 시작, 장면:", sceneScript.substring(0, 50) + "...")
    
    // 제품 이미지를 공개 URL로 변환
    // 참고: nano-banana는 image_input으로 URL 배열을 받음
    // base64를 data URL로 사용하거나, 공개 URL로 업로드 필요
    let imageInput: string[] | undefined = undefined
    
    if (productImageBase64) {
      // base64가 data URL 형식인지 확인 (data:image/... 형식)
      if (productImageBase64.startsWith("data:image/")) {
        // data URL을 그대로 사용 (Replicate가 지원하는 경우)
        imageInput = [productImageBase64]
      } else {
        // base64 문자열인 경우 data URL 형식으로 변환
        // MIME 타입 추정 (일반적으로 jpeg 또는 png)
        const mimeType = productImageBase64.includes("/9j/") ? "image/jpeg" : "image/png"
        imageInput = [`data:${mimeType};base64,${productImageBase64}`]
      }
    }
    
    // google/nano-banana 모델 사용
    // 9:16 비율로 이미지 생성
    // 재시도 로직 추가 (502, 503, 504 같은 서버 오류 처리)
    let response: Response | null = null
    let lastError: Error | null = null
    const maxRetries = 3
    const retryDelay = 2000 // 2초
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[Shopping] 이미지 생성 재시도 ${attempt}/${maxRetries - 1}...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
        }
        
        response = await fetch("https://api.replicate.com/v1/models/google/nano-banana/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: imagePrompt,
              aspect_ratio: "9:16", // 9:16 비율로 이미지 생성
          // image_input은 URL 배열 (샘플 코드 참고)
          ...(imageInput && {
            image_input: imageInput,
          }),
        },
      }),
    })

        // 성공한 경우 루프 종료
        if (response.ok) {
          break
        }

        // 502, 503, 504 같은 서버 오류는 재시도
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          const errorText = await response.text()
          console.warn(`[Shopping] 서버 오류 (${response.status}), 재시도 예정:`, errorText.substring(0, 100))
          lastError = new Error(`이미지 생성 실패: ${response.status} - ${errorText.substring(0, 200)}`)
          
          // 마지막 시도가 아니면 계속
          if (attempt < maxRetries - 1) {
            continue
          }
        }

        // 다른 오류는 즉시 throw
      const errorText = await response.text()
      console.error("[Shopping] 이미지 생성 오류:", errorText)
        throw new Error(`이미지 생성 실패: ${response.status} - ${errorText.substring(0, 200)}`)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // 네트워크 오류나 타임아웃도 재시도
        if (attempt < maxRetries - 1 && (error instanceof TypeError || error instanceof Error)) {
          console.warn(`[Shopping] 네트워크 오류, 재시도 예정:`, error)
          continue
        }
        
        throw error
      }
    }

    // 모든 재시도 실패
    if (!response || !response.ok) {
      throw lastError || new Error("이미지 생성 실패: 모든 재시도 실패")
    }

    const data = await response.json()

    if (data.status === "succeeded" && data.output) {
      let imageUrl: string
      if (Array.isArray(data.output) && data.output.length > 0) {
        imageUrl = typeof data.output[0] === "string" ? data.output[0] : data.output[0].url || String(data.output[0])
      } else if (typeof data.output === "string") {
        imageUrl = data.output
      } else if (data.output && typeof data.output === "object" && (data.output as any).url) {
        imageUrl = (data.output as any).url
      } else {
        imageUrl = String(data.output)
      }
      
      // 이미지 URL이 문자열이 아닌 경우 처리
      if (typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
        console.error("[Shopping] 유효하지 않은 이미지 URL:", imageUrl)
        throw new Error("이미지 URL이 유효하지 않습니다.")
      }
      
      console.log("[Shopping] 나노바나나 이미지 생성 완료:", imageUrl)
      return imageUrl
    } else if (data.status === "processing" || data.status === "starting") {
      // 폴링 방식으로 결과 확인
      const predictionId = data.id
      let attempts = 0
      const maxAttempts = 120 // 최대 2분 대기

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000)) // 2초 대기

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          },
        })

        if (!statusResponse.ok) {
          throw new Error(`상태 확인 실패: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()

        if (statusData.status === "succeeded" && statusData.output) {
          // nano-banana 출력 형식 확인
          let imageUrl: string
          if (typeof statusData.output === "string") {
            imageUrl = statusData.output
          } else if (Array.isArray(statusData.output) && statusData.output.length > 0) {
            imageUrl = typeof statusData.output[0] === "string" ? statusData.output[0] : statusData.output[0].url || statusData.output[0]
          } else if (statusData.output.url) {
            imageUrl = statusData.output.url
          } else {
            imageUrl = String(statusData.output)
          }
          
          // 이미지 URL이 문자열이 아닌 경우 처리
          if (typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
            console.error("[Shopping] 유효하지 않은 이미지 URL:", imageUrl)
            throw new Error("이미지 URL이 유효하지 않습니다.")
          }
          
          console.log("[Shopping] 나노바나나 이미지 생성 완료 (폴링):", imageUrl)
          return imageUrl
        } else if (statusData.status === "failed") {
          throw new Error(`이미지 생성 실패: ${statusData.error || "알 수 없는 오류"}`)
        }

        attempts++
      }

      throw new Error("이미지 생성 시간 초과")
    } else {
      throw new Error(`이미지 생성 실패: ${data.error || "알 수 없는 오류"}`)
    }
  } catch (error) {
    console.error("[Shopping] 나노바나나 이미지 생성 실패:", error)
    throw error
  }
}

// 이미지를 영상으로 변환 (wan-video/wan-2.2-i2v-fast 모델 사용)
export async function convertImageToVideoWithWan(
  imageUrl: string,
  prompt: string, // 프롬프트 (필수)
  audioUrl?: string, // 오디오 URL (선택, wan-2.2-i2v-fast는 오디오 불필요)
  replicateApiKey?: string
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다.")
  }

  try {
    console.log(`[Shopping] wan-video/wan-2.2-i2v-fast 모델로 이미지를 영상으로 변환 시작:`, imageUrl)
    console.log(`[Shopping] 프롬프트:`, prompt)
    
    // 이미지 URL 유효성 확인
    let validImageUrl = imageUrl
    
    // 이미지 URL이 유효한지 확인 (404 방지)
    try {
      const imageCheckResponse = await fetch(imageUrl, { method: "HEAD" })
      if (!imageCheckResponse.ok) {
        console.warn(`[Shopping] 이미지 URL 접근 실패 (${imageCheckResponse.status}), URL 재확인:`, imageUrl)
        // URL이 유효하지 않으면 그대로 진행 (Replicate가 직접 확인할 수 있음)
      } else {
        console.log(`[Shopping] 이미지 URL 유효성 확인 완료`)
      }
    } catch (checkError) {
      console.warn(`[Shopping] 이미지 URL 확인 중 오류 (계속 진행):`, checkError)
      // 확인 실패해도 계속 진행 (Replicate가 직접 확인할 수 있음)
    }
    
    // Replicate API 경로: wan-video/wan-2.2-i2v-fast 모델 사용
    const apiUrl = "https://api.replicate.com/v1/models/wan-video/wan-2.2-i2v-fast/predictions"
    
    // wan-2.2-i2v-fast 모델 입력: 이미지, 프롬프트
    // 모델은 입력 이미지의 비율을 그대로 유지하므로, 이미지 생성 시 9:16으로 생성하면 됨
    const modelInput = {
      image: validImageUrl, // 이미지 URL (공개 접근 가능해야 함, 9:16 비율)
      prompt: prompt, // 프롬프트 (필수)
    }
    
    console.log(`[Shopping] Replicate API URL:`, apiUrl)
    console.log(`[Shopping] Input:`, JSON.stringify(modelInput, null, 2))
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: modelInput,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Shopping] 영상 변환 오류 응답:", {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
        apiUrl: apiUrl,
        requestBody: JSON.stringify({ input: modelInput }, null, 2)
      })
      
      // 404 오류인 경우 모델 경로 문제일 수 있음
      if (response.status === 404) {
        throw new Error(`모델을 찾을 수 없습니다 (404). 모델 이름이나 버전을 확인해주세요. API URL: ${apiUrl}`)
      }
      
      throw new Error(`영상 변환 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("[Shopping] 영상 변환 응답:", JSON.stringify(data, null, 2))

    if (data.status === "succeeded" && data.output) {
      // wan-2.2-i2v-fast는 output.url() 메서드를 가진 객체로 반환됨
      let videoUrl: string
      if (typeof data.output === "string") {
        videoUrl = data.output
      } else if (data.output && typeof data.output === "object") {
        // .url() 메서드가 있으면 호출, 없으면 직접 사용
        videoUrl = (data.output as any).url?.() || (data.output as any).url || data.output
      } else {
        videoUrl = String(data.output)
      }
      console.log(`[Shopping] 영상 생성 완료:`, videoUrl)
      return videoUrl
    } else if (data.status === "processing" || data.status === "starting") {
      // 폴링 방식으로 결과 확인
      const predictionId = data.id
      let attempts = 0
      const maxAttempts = 300 // 최대 10분 대기

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000)) // 2초 대기

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          },
        })

        if (!statusResponse.ok) {
          throw new Error(`상태 확인 실패: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()

        if (statusData.status === "succeeded" && statusData.output) {
          // wan-2.2-i2v-fast는 output.url() 메서드를 가진 객체로 반환됨
          let videoUrl: string
          if (typeof statusData.output === "string") {
            videoUrl = statusData.output
          } else if (statusData.output && typeof statusData.output === "object") {
            // .url() 메서드가 있으면 호출, 없으면 직접 사용
            videoUrl = (statusData.output as any).url?.() || (statusData.output as any).url || statusData.output
          } else {
            videoUrl = String(statusData.output)
          }
          console.log(`[Shopping] 영상 생성 완료 (폴링):`, videoUrl)
          return videoUrl
        } else if (statusData.status === "failed") {
          // 에러 메시지에 이미지 URL 관련 정보가 있으면 더 자세한 에러 메시지 제공
          const errorMessage = statusData.error || "알 수 없는 오류"
          if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
            throw new Error(`영상 변환 실패: 이미지 URL에 접근할 수 없습니다 (404). 이미지 URL: ${imageUrl}. 원인: 이미지가 만료되었거나 삭제되었을 수 있습니다. 이미지를 다시 생성해주세요.`)
          }
          throw new Error(`영상 변환 실패: ${errorMessage}`)
        }

        attempts++
      }

      throw new Error("영상 변환 시간 초과")
    } else {
      throw new Error(`영상 변환 실패: ${data.error || "알 수 없는 오류"}`)
    }
  } catch (error) {
    console.error("[Shopping] 영상 변환 실패:", error)
    throw error
  }
}

// 3개의 5초 영상을 하나로 합치기 (서버에서 처리)
export async function mergeVideos(videoUrls: string[]): Promise<string> {
  // 참고: 실제로는 서버에서 FFmpeg 등을 사용하여 영상을 합쳐야 합니다
  // 여기서는 클라이언트 측에서 처리하도록 URL 배열을 반환
  // 실제 구현 시 서버 API 엔드포인트를 만들어서 FFmpeg로 합치는 것이 좋습니다
  
  // 임시로 첫 번째 영상 URL 반환 (실제로는 합쳐진 영상 URL 반환)
  if (videoUrls.length === 0) {
    throw new Error("합칠 영상이 없습니다.")
  }
  
  // TODO: 실제 영상 합치기 로직 구현 필요
  // 예: /api/merge-videos 엔드포인트 생성 후 FFmpeg 사용
  console.log("[Shopping] 영상 합치기 요청:", videoUrls)
  
  // 임시로 첫 번째 영상 반환
  return videoUrls[0]
}

export async function generateShoppingScript(productName: string, productDescription: string, apiKey?: string) {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.")
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
            content: `당신은 쇼핑 영상 대본 작성 전문가입니다. 제품을 홍보하는 12초 길이의 쇼츠 영상 대본을 작성해주세요.

🟣 대본 작성 규칙:

1. 강력한 후킹 (필수):
   - 시청자의 관심을 즉시 끄는 강력한 시작
   - 호기심을 유발하는 문구로 시작
   - 예시: "이거 몰라서 업체 부를뻔했어요", "이거 하나면 끝!", "이거 진짜 신기해요" 등

2. 자연스러운 대화체:
   - 친근하고 자연스러운 말투 사용
   - 어른분들도 쉽게 이해할 수 있는 명확하고 간단한 표현
   - 전문 용어나 복잡한 표현은 피하고, 일상적인 쉬운 말로 작성

3. 끊기지 않는 자연스러운 연결:
   - 모든 문장을 자연스럽게 연결
   - 마침표(.)를 최소화하고, 가능하면 쉼표(,)나 연결어로 문장을 이어가기
   - 문장 사이에 자연스러운 연결어 사용: "그리고", "또한", "게다가", "특히" 등

4. 길이 제한 (매우 중요):
   - 공백 포함 정확히 80자로 작성 (12초 길이에 맞춤)
   - 대본 작성 후 반드시 글자 수를 세어서 정확히 80자인지 확인
   - 80자가 아니면 다시 작성하여 정확히 80자가 되도록 조정

출력 형식:
- 번호나 제목 없이 순수한 대본 텍스트만 작성
- 자연스러운 대화체로 작성
- 모든 문장이 자연스럽게 연결되도록 작성
- 어른분들도 쉽게 이해할 수 있는 명확하고 간단한 표현 사용`,
          },
          {
            role: "user",
            content: `제품명: ${productName}
제품 설명: ${productDescription}

위 제품을 홍보하는 12초 쇼츠 영상 대본을 작성해주세요.

반드시 다음 규칙을 지켜주세요:
1. 강력한 후킹으로 시작 (시청자의 관심을 즉시 끄는 문구)
2. 자연스러운 대화체 사용 - 어른분들도 쉽게 이해할 수 있는 명확하고 간단한 표현
3. 끊기지 않고 자연스럽게 연결
   - 문장 사이에 긴 텀을 두지 말고, 자연스러운 연결어로 이어가기
   - 마침표(.)를 최소화하고, 가능하면 쉼표(,)나 연결어로 문장을 이어가기
4. 전문 용어나 복잡한 표현은 피하고, 일상적인 쉬운 말로 작성
5. 전체 길이 공백 포함 정확히 80자로 작성 (12초 길이에 맞춤, 필수)
   - 대본 작성 후 반드시 글자 수를 세어서 정확히 80자인지 확인
   - 80자가 아니면 다시 작성하여 정확히 80자가 되도록 조정
6. 대본은 반드시 끝까지 완성되어야 하며, 마지막에 끊기면 안 됨`,
          },
        ],
        max_tokens: 200, // 짧은 대본 생성을 위해 토큰 수 제한
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("대본 생성에 실패했습니다.")
    }

    // 대본 정리 (번호, 제목 등 제거, 하지만 CTA는 유지)
    let cleanedScript = content
      .replace(/^\d+[\.\)]\s*/gm, "") // 번호 제거
      .replace(/^\[.*?\]\s*/gm, "") // 대괄호 제거
      .replace(/^제목:.*$/gm, "") // 제목 제거
      .replace(/^대본:.*$/gm, "") // "대본:" 제거
      .trim()

    // CTA가 포함되어 있는지 확인 (이전 버전 호환성을 위해 유지하되, 새 버전에서는 사용하지 않음)
    const hasCTA = cleanedScript.includes("제가 후기 좋은 제품으로 링크 찾아왔는데") || 
                   cleanedScript.includes("영상 속 사진을 클릭해보세요")
    
    // CTA가 있으면 제거 (새 버전에서는 제품 장점과 마무리 멘트로 대체)
    if (hasCTA) {
      cleanedScript = cleanedScript
        .replace(/제가 후기 좋은 제품으로 링크 찾아왔는데.*?클릭해보세요[^.]*/g, "")
        .trim()
    }
    
    // 대본 길이 로그만 출력 (자동 조정 없음)
    console.log(`[Shopping] 생성된 대본 길이: ${cleanedScript.length}자`)

    return cleanedScript
  } catch (error) {
    console.error("[Shopping] 대본 생성 실패:", error)
    throw error
  }
}

// 이미지 1개만 생성
export async function generateImage(
  productName: string,
  replicateApiKey?: string,
  productImageBase64?: string
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.")
  }

  try {
    console.log("[Shopping] 이미지 생성 시작")
    
    // 이미지 생성 (나노바나나) - 제품명 기반
    const imageUrl = await generateImageWithNanobanana(
      `${productName} 제품을 홍보하는 쇼핑 영상 이미지`,
      productName,
      productImageBase64,
      REPLICATE_API_TOKEN,
      0 // 첫 번째 장면 스타일
    )
    console.log(`[Shopping] 이미지 생성 완료:`, imageUrl)
    
    return imageUrl
  } catch (error) {
    console.error("[Shopping] 이미지 생성 실패:", error)
    throw error
  }
}

// 썸네일 후킹 문구 생성
export async function generateThumbnailHookingText(
  productName: string,
  apiKey?: string
): Promise<{ line1: string; line2: string }> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    // API 키가 없으면 자극적인 기본 문구 중 랜덤 선택
    const defaultHooks = [
      { line1: "99%가 모르는", line2: "충격 가격" },
      { line1: "3초만에 완판", line2: "이유 공개" },
      { line1: "500만명이 찾는", line2: "꿀템 정체" },
      { line1: "품절 임박", line2: "마지막 기회" },
      { line1: "1위 제품의", line2: "숨겨진 비밀" },
      { line1: "10배 더 싸게", line2: "사는 방법" },
      { line1: "역대급 할인", line2: "지금 아니면" },
      { line1: "충격 실화", line2: "이 가격 맞아?" }
    ]
    return defaultHooks[Math.floor(Math.random() * defaultHooks.length)]
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
            content: `당신은 유튜브 쇼츠 썸네일 후킹 문구 작성 전문가입니다.

중요: 제품명을 분석하여 해당 제품의 핵심 특징/효과/장점을 파악하고, 그에 맞는 맞춤형 후킹 문구를 작성하세요.

제품 분석 방법:
- 청소기 -> 청소 효율, 흡입력, 편리함
- 화장품/세럼 -> 피부 효과, 동안, 탄력
- 건강식품 -> 건강 효과, 에너지, 다이어트
- 주방용품 -> 요리 시간 단축, 맛, 편리함
- 전자기기 -> 성능, 가성비, 혁신

핵심 규칙:
1. 반드시 숫자를 포함 (99%, 3초, 1위, 500만, 10배, 50% 등)
2. 첫 번째 줄: 제품 특징 + 숫자 + 충격 (5~10자)
3. 두 번째 줄: 제품 효과/결과 + 긴박감 (5~10자)
4. 제품과 직접 연관된 문구여야 함!

제품별 예시:
- 무선청소기: "99%가 모르는" / "청소 꿀팁"
- 비타민C세럼: "피부과 의사도 놀란" / "동안 비결"  
- 에어프라이어: "3분 요리의" / "충격 비밀"
- 다이어트 식품: "2주만에 -5kg" / "실화입니다"
- 무선이어폰: "애플도 인정한" / "갓성비 정체"
- 마사지기: "만성피로 3일만에" / "해결 비법"

JSON 형식으로만 응답:
{"line1": "첫번째줄", "line2": "두번째줄"}`
          },
          {
            role: "user",
            content: `제품명: ${productName}

위 제품의 핵심 특징과 장점을 분석하고, 이 제품에 딱 맞는 자극적인 후킹 문구 2줄을 작성해주세요.
반드시 숫자를 포함하고, 제품과 직접 연관된 문구여야 합니다!`
          }
        ],
        max_tokens: 100,
        temperature: 1.0,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("후킹 문구 생성에 실패했습니다.")
    }

    // JSON 파싱
    const parsed = JSON.parse(content)
    return {
      line1: parsed.line1 || "이거 안 쓰면",
      line2: parsed.line2 || "손해봅니다"
    }
  } catch (error) {
    console.error("[Shopping] 후킹 문구 생성 실패:", error)
    // 실패 시 기본 문구 반환
    return {
      line1: "이거 안 쓰면",
      line2: "손해봅니다"
    }
  }
}

// 유튜브 쇼츠 썸네일 생성
export async function generateShortsThumbnail(
  productName: string,
  replicateApiKey?: string,
  productImageBase64?: string
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.")
  }

  try {
    console.log("[Shopping] 쇼츠 썸네일 생성 시작")
    
    // 썸네일 프롬프트: 자극적인 유튜브 쇼츠 썸네일
    const thumbnailPrompt = `${productName} 쇼츠 영상으로 만드는데 유튜브 쇼츠 썸네일 만들어줘. 문구는 자극적으로 써줘. 클릭할수있게끔. 
    
유튜브 쇼츠 썸네일 스타일:
- 제품이 크게 중앙에 배치
- 밝고 눈에 띄는 색상 (노란색, 빨간색 강조)
- 자극적인 느낌의 연출
- 클릭을 유도하는 구도
- 깔끔하고 임팩트 있는 배경
- 고품질, 전문적인 쇼핑 썸네일
- 9:16 세로 비율 (쇼츠용)
- 텍스트 없음, 글씨 없음 (텍스트는 별도로 추가)
- 사람 얼굴 없음, no face`

    // 제품 이미지를 공개 URL로 변환
    let imageInput: string[] | undefined = undefined
    
    if (productImageBase64) {
      if (productImageBase64.startsWith("data:image/")) {
        imageInput = [productImageBase64]
      } else {
        const mimeType = productImageBase64.includes("/9j/") ? "image/jpeg" : "image/png"
        imageInput = [`data:${mimeType};base64,${productImageBase64}`]
      }
    }
    
    // google/nano-banana 모델 사용
    const response = await fetch("https://api.replicate.com/v1/models/google/nano-banana/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: thumbnailPrompt,
          aspect_ratio: "9:16",
          ...(imageInput && {
            image_input: imageInput,
          }),
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Shopping] 썸네일 생성 오류:", errorText)
      throw new Error(`썸네일 생성 실패: ${response.status} - ${errorText.substring(0, 200)}`)
    }

    const data = await response.json()

    if (data.status === "succeeded" && data.output) {
      let imageUrl: string
      if (Array.isArray(data.output) && data.output.length > 0) {
        imageUrl = typeof data.output[0] === "string" ? data.output[0] : data.output[0].url || String(data.output[0])
      } else if (typeof data.output === "string") {
        imageUrl = data.output
      } else if (data.output && typeof data.output === "object" && (data.output as any).url) {
        imageUrl = (data.output as any).url
      } else {
        imageUrl = String(data.output)
      }
      
      console.log("[Shopping] 썸네일 생성 완료:", imageUrl)
      return imageUrl
    } else if (data.status === "processing" || data.status === "starting") {
      // 폴링 방식으로 결과 확인
      const predictionId = data.id
      let attempts = 0
      const maxAttempts = 120

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000))

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          },
        })

        if (!statusResponse.ok) {
          throw new Error(`상태 확인 실패: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()

        if (statusData.status === "succeeded" && statusData.output) {
          let imageUrl: string
          if (typeof statusData.output === "string") {
            imageUrl = statusData.output
          } else if (Array.isArray(statusData.output) && statusData.output.length > 0) {
            imageUrl = typeof statusData.output[0] === "string" ? statusData.output[0] : statusData.output[0].url || statusData.output[0]
          } else if (statusData.output.url) {
            imageUrl = statusData.output.url
          } else {
            imageUrl = String(statusData.output)
          }
          
          console.log("[Shopping] 썸네일 생성 완료 (폴링):", imageUrl)
          return imageUrl
        } else if (statusData.status === "failed") {
          throw new Error(`썸네일 생성 실패: ${statusData.error || "알 수 없는 오류"}`)
        }

        attempts++
      }

      throw new Error("썸네일 생성 시간 초과")
    } else {
      throw new Error(`썸네일 생성 실패: ${data.error || "알 수 없는 오류"}`)
    }
  } catch (error) {
    console.error("[Shopping] 썸네일 생성 실패:", error)
    throw error
  }
}

// 새로운 방식: 대본을 3개 장면으로 나누고 각각 이미지 생성만 수행 (레거시 - 사용 안 함)
export async function generateImagesWith3Scenes(
  script: string,
  productName: string,
  replicateApiKey?: string,
  productImageBase64?: string
): Promise<string[]> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.")
  }

  try {
    console.log("[Shopping] 3개 장면으로 이미지 생성 시작")
    
    // 1. 대본을 3개 장면으로 나누기
    const scenes = await splitScriptIntoScenes(script)
    console.log("[Shopping] 장면 분할 완료:", scenes.length, "개 장면")
    
    // 2. 각 장면에 대해 이미지 생성만 수행 (정확히 3개만)
    const imageUrls: string[] = []
    const maxScenes = 3 // 정확히 3개 장면만
    
    // scenes가 3개보다 많으면 처음 3개만 사용
    const scenesToProcess = scenes.slice(0, maxScenes)
    
    for (let i = 0; i < scenesToProcess.length; i++) {
      console.log(`[Shopping] 장면 ${i + 1}/${maxScenes} 이미지 생성 중...`)
      
      // 이미지 생성 (나노바나나) - 섹션 인덱스 전달하여 각기 다른 배경 적용
      const imageUrl = await generateImageWithNanobanana(
        scenesToProcess[i],
        productName,
        productImageBase64,
        REPLICATE_API_TOKEN,
        i // 섹션 인덱스 (0, 1, 2) 전달
      )
      console.log(`[Shopping] 장면 ${i + 1} 이미지 생성 완료:`, imageUrl)
      
      imageUrls.push(imageUrl)
    }
    
    // 정확히 3개가 아니면 에러
    if (imageUrls.length !== 3) {
      throw new Error(`이미지는 정확히 3개만 생성되어야 합니다. 현재: ${imageUrls.length}개`)
    }
    
    console.log("[Shopping] 3개 장면 이미지 생성 완료:", imageUrls.length, "개")
    return imageUrls
  } catch (error) {
    console.error("[Shopping] 3개 장면 이미지 생성 실패:", error)
    throw error
  }
}

export async function generateVideoWithSora2(
  script: string,
  productName: string,
  replicateApiKey?: string,
  productImageBase64?: string
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.")
  }

  try {
    // Sora2 모델을 사용한 비디오 생성
    // Replicate에서 Sora2 모델이 정확히 무엇인지 확인 필요
    // 일반적으로 "stability-ai/sora" 또는 유사한 모델 사용
    // 여기서는 예시로 "anotherjesse/zeroscope-v2-xl" 또는 실제 Sora2 모델 사용
    
    console.log("[Shopping] Sora2 비디오 생성 시작")
    console.log("[Shopping] 대본:", script.substring(0, 100) + "...")
    console.log("[Shopping] 제품명:", productName)
    console.log("[Shopping] 제품 이미지:", productImageBase64 ? "있음" : "없음")

    // 비디오 생성 프롬프트 생성 (대본 기반)
    let videoPrompt = `${script}. ${productName} 제품을 홍보하는 쇼핑 영상. 고품질, 전문적, 매력적.`
    
    // 이미지가 있으면 프롬프트에 추가
    if (productImageBase64) {
      videoPrompt = `${videoPrompt} 제품 이미지를 참고하여 제품의 실제 모습을 정확하게 보여주세요.`
    }
    
    // Sora2 모델이 아직 공개되지 않았을 수 있으므로, 대체 모델 사용
    // 실제로는 Replicate에서 사용 가능한 비디오 생성 모델 확인 필요
    // 예: "stability-ai/sora", "anotherjesse/zeroscope-v2-xl" 등

    // Replicate API 호출
    // 참고: 실제 Sora2 모델명은 Replicate 문서를 확인해야 함
    // 예시: "stability-ai/sora" 또는 다른 비디오 생성 모델
    const response = await fetch("https://api.replicate.com/v1/models/stability-ai/sora/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          prompt: videoPrompt,
          duration: 15, // 15초
          aspect_ratio: "9:16", // 쇼츠 비율
          // 이미지가 있으면 이미지 입력 추가 (Sora2가 이미지 입력을 지원하는 경우)
          ...(productImageBase64 && {
            image: productImageBase64, // base64 이미지 또는 URL
          }),
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Shopping] Replicate API 오류:", errorText)
      
      // Sora2가 아직 공개되지 않았을 수 있으므로, 대체 모델 사용
      // 예: "anotherjesse/zeroscope-v2-xl" 또는 다른 비디오 생성 모델
      throw new Error(`Replicate API 호출 실패: ${response.status}. Sora2 모델이 아직 사용 불가능할 수 있습니다.`)
    }

    const data = await response.json()

    if (data.status === "succeeded" && data.output) {
      const videoUrl = Array.isArray(data.output) ? data.output[0] : data.output
      console.log("[Shopping] Sora2 비디오 생성 완료:", videoUrl)
      return videoUrl
    } else if (data.status === "processing" || data.status === "starting") {
      // 폴링 방식으로 결과 확인
      const predictionId = data.id
      let attempts = 0
      const maxAttempts = 300 // 최대 5분 대기 (비디오 생성은 시간이 오래 걸림)

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000)) // 2초 대기

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          },
        })

        if (!statusResponse.ok) {
          throw new Error(`상태 확인 실패: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()

        if (statusData.status === "succeeded" && statusData.output) {
          const videoUrl = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output
          console.log("[Shopping] Sora2 비디오 생성 완료 (폴링):", videoUrl)
          return videoUrl
        } else if (statusData.status === "failed") {
          throw new Error(`비디오 생성 실패: ${statusData.error || "알 수 없는 오류"}`)
        }

        attempts++
      }

      throw new Error("비디오 생성 시간 초과")
    } else {
      throw new Error(`비디오 생성 실패: ${data.error || "알 수 없는 오류"}`)
    }
  } catch (error) {
    console.error("[Shopping] Sora2 비디오 생성 실패:", error)
    
    // Sora2가 사용 불가능한 경우, 대체 모델 시도
    // 예: "anotherjesse/zeroscope-v2-xl" 사용
    console.log("[Shopping] 대체 비디오 생성 모델 시도...")
    
    // 비디오 생성 프롬프트 생성 (대본 기반)
    const videoPrompt = `${script}. ${productName} 제품을 홍보하는 쇼핑 영상. 고품질, 전문적, 매력적.`
    
    try {
      const fallbackResponse = await fetch("https://api.replicate.com/v1/models/anotherjesse/zeroscope-v2-xl/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          input: {
            prompt: videoPrompt,
            num_frames: 30, // 약 1초 (30fps 기준)
            num_inference_steps: 50,
          },
        }),
      })

      if (!fallbackResponse.ok) {
        throw new Error("대체 모델도 사용 불가능합니다.")
      }

      const fallbackData = await fallbackResponse.json()
      
      if (fallbackData.status === "succeeded" && fallbackData.output) {
        const videoUrl = Array.isArray(fallbackData.output) ? fallbackData.output[0] : fallbackData.output
        console.log("[Shopping] 대체 모델 비디오 생성 완료:", videoUrl)
        return videoUrl
      }
    } catch (fallbackError) {
      console.error("[Shopping] 대체 모델도 실패:", fallbackError)
    }
    
    throw error
  }
}

// bytedance/seedance-1-pro-fast 모델로 영상 생성
export async function generateVideoWithSeedance(
  imageUrl: string,
  productName: string,
  replicateApiKey?: string
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다.")
  }

  try {
    console.log(`[Shopping] bytedance/seedance-1-pro-fast 모델로 영상 생성 시작:`, imageUrl)
    console.log(`[Shopping] 제품명:`, productName)
    
    // 프롬프트 생성: 제품명 + 4초 간격으로 3장면
    // 1장면: 사용법 (제품을 손으로 사용하는 모습)
    // 2장면: 1장면의 제품을 확대해서 보여줌 (디테일샷)
    // 3장면: 아예 다른 배경에서 보여줌
    // 사람 얼굴만 안 보이면 됨, 손이나 몸 일부는 OK, 제품은 일관성있게
    const prompt = `${productName} 제품 홍보 영상. 4초 간격으로 3장면으로 구성: 
첫 장면(0-4초)은 제품 사용법을 보여줌 - 손으로 제품을 사용하는 모습, 
두번째 장면(4-8초)은 제품을 확대해서 디테일하게 보여줌 - 클로즈업 샷, 
세번째 장면(8-12초)은 완전히 다른 배경에서 제품을 보여줌 - 새로운 환경.
사람 얼굴은 절대 보이면 안됨, no face, no head visible.
손이나 몸 일부는 보여도 됨, hands and body parts are okay.
제품은 일관성있게 유지, same product throughout.
각 장면마다 구도와 배경은 다르게, different composition and background for each scene.`
    
    console.log(`[Shopping] 프롬프트:`, prompt)
    
    // 이미지 URL 유효성 확인
    let validImageUrl = imageUrl
    
    // 이미지 URL이 유효한지 확인
    try {
      const imageCheckResponse = await fetch(imageUrl, { method: "HEAD" })
      if (!imageCheckResponse.ok) {
        console.warn(`[Shopping] 이미지 URL 접근 실패 (${imageCheckResponse.status}), URL 재확인:`, imageUrl)
      } else {
        console.log(`[Shopping] 이미지 URL 유효성 확인 완료`)
      }
    } catch (checkError) {
      console.warn(`[Shopping] 이미지 URL 확인 중 오류 (계속 진행):`, checkError)
    }
    
    // Replicate API 경로: bytedance/seedance-1-pro-fast 모델 사용
    const apiUrl = "https://api.replicate.com/v1/models/bytedance/seedance-1-pro-fast/predictions"
    
    // seedance-1-pro-fast 모델 입력
    const modelInput = {
      image: validImageUrl, // 이미지 URL
      prompt: prompt, // 프롬프트
      duration: 12, // 12초
      resolution: "480p", // 480p 해상도
      aspect_ratio: "9:16", // 9:16 비율
      camera_fixed: false, // 카메라 고정 해제
    }
    
    console.log(`[Shopping] Replicate API URL:`, apiUrl)
    console.log(`[Shopping] Input:`, JSON.stringify(modelInput, null, 2))
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: modelInput,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Shopping] 영상 생성 오류 응답:", {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
        apiUrl: apiUrl,
        requestBody: JSON.stringify({ input: modelInput }, null, 2)
      })
      
      // 404 오류인 경우 모델 경로 문제일 수 있음
      if (response.status === 404) {
        throw new Error(`모델을 찾을 수 없습니다 (404). 모델 이름이나 버전을 확인해주세요. API URL: ${apiUrl}`)
      }
      
      throw new Error(`영상 생성 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("[Shopping] 영상 생성 응답:", JSON.stringify(data, null, 2))

    if (data.status === "succeeded" && data.output) {
      let videoUrl: string
      if (typeof data.output === "string") {
        videoUrl = data.output
      } else if (data.output && typeof data.output === "object") {
        videoUrl = (data.output as any).url?.() || (data.output as any).url || data.output
      } else {
        videoUrl = String(data.output)
      }
      console.log(`[Shopping] 영상 생성 완료:`, videoUrl)
      return videoUrl
    } else if (data.status === "processing" || data.status === "starting") {
      // 폴링 방식으로 결과 확인
      const predictionId = data.id
      let attempts = 0
      const maxAttempts = 300 // 최대 10분 대기

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000)) // 2초 대기

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          },
        })

        if (!statusResponse.ok) {
          throw new Error(`상태 확인 실패: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()

        if (statusData.status === "succeeded" && statusData.output) {
          let videoUrl: string
          if (typeof statusData.output === "string") {
            videoUrl = statusData.output
          } else if (statusData.output && typeof statusData.output === "object") {
            videoUrl = (statusData.output as any).url?.() || (statusData.output as any).url || statusData.output
          } else {
            videoUrl = String(statusData.output)
          }
          console.log(`[Shopping] 영상 생성 완료 (폴링):`, videoUrl)
          return videoUrl
        } else if (statusData.status === "failed") {
          const errorMessage = statusData.error || "알 수 없는 오류"
          throw new Error(`영상 생성 실패: ${errorMessage}`)
        }

        attempts++
      }

      throw new Error("영상 생성 시간 초과")
    } else {
      throw new Error(`영상 생성 실패: ${data.error || "알 수 없는 오류"}`)
    }
  } catch (error) {
    console.error("[Shopping] 영상 생성 실패:", error)
    throw error
  }
}

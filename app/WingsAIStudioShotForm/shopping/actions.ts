"use server"

// 네이버 데이터랩 API를 사용하여 인기 키워드 가져오기
export async function getNaverTrendingKeywords(category: string = "쇼핑"): Promise<string[]> {
  try {
    const clientId = "P0uKp6RB5FQr04CFcrNs"
    const clientSecret = "4ZVXsb7kco"

    // 최근 7일간의 데이터 조회
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)

    // 날짜 형식: YYYY-MM-DD
    const formatDate = (date: Date): string => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const requestBody = {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      timeUnit: "date",
      keywordGroups: [
        {
          groupName: category,
          keywords: [
            "난로", "패딩", "코트", "목도리", "장갑",
            "부츠", "히트텍", "내복", "담요", "전기장판",
            "온수매트", "핫팩", "보온병", "후드티", "맨투맨",
            "스웨터", "니트", "기모바지", "방한화", "우비"
          ]
        }
      ]
    }

    const response = await fetch("https://openapi.naver.com/v1/datalab/search", {
      method: "POST",
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("네이버 데이터랩 API 오류:", errorText)
      // API 실패 시 기본 겨울 템 키워드 반환
      return [
        "난로",
        "패딩",
        "코트",
        "목도리",
        "장갑",
        "부츠",
        "히트텍",
        "내복",
        "담요",
        "전기장판"
      ]
    }

    const data = await response.json()
    console.log("[Naver Datalab] API 응답:", JSON.stringify(data, null, 2))
    
    // 응답 데이터에서 키워드 추출
    // 네이버 데이터랩 API 응답 구조:
    // {
    //   "results": [
    //     {
    //       "title": "그룹명",
    //       "keywords": [
    //         {
    //           "keyword": "키워드명",
    //           "data": [
    //             { "period": "날짜", "ratio": 검색량 }
    //           ]
    //         }
    //       ]
    //     }
    //   ]
    // }
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0]
      const keywords = result.keywords || []
      
      console.log("[Naver Datalab] 키워드 개수:", keywords.length)
      console.log("[Naver Datalab] 키워드 데이터:", keywords)
      
      if (keywords.length > 0) {
        // 검색량이 높은 순으로 정렬하여 상위 10개 반환
        const keywordData = keywords.map((item: any) => {
          // 각 키워드의 총 검색량 계산 (모든 날짜의 ratio 합계)
          const total = Array.isArray(item.data) 
            ? item.data.reduce((sum: number, dataItem: any) => sum + (Number(dataItem.ratio) || 0), 0)
            : 0
          
          return {
            keyword: item.keyword || item.name || String(item),
            total: total
          }
        })
        
        // 검색량이 높은 순으로 정렬
        keywordData.sort((a: any, b: any) => b.total - a.total)
        
        // 상위 10개만 추출
        const sortedKeywords = keywordData
          .slice(0, 10)
          .map((item: any) => item.keyword)
          .filter((keyword: string) => keyword && keyword.trim().length > 0)
        
        console.log("[Naver Datalab] 정렬된 키워드:", sortedKeywords)
        
        if (sortedKeywords.length > 0) {
          return sortedKeywords
        }
      }
    }
    
    console.log("[Naver Datalab] 키워드를 찾을 수 없어 기본 키워드 반환")

    // 기본 겨울 템 키워드 반환
    return [
      "난로",
      "패딩",
      "코트",
      "목도리",
      "장갑",
      "부츠",
      "히트텍",
      "내복",
      "담요",
      "전기장판"
    ]
  } catch (error) {
    console.error("네이버 데이터랩 API 호출 실패:", error)
    // 오류 발생 시 기본 겨울 템 키워드 반환
    return [
      "난로",
      "패딩",
      "코트",
      "목도리",
      "장갑",
      "부츠",
      "히트텍",
      "내복",
      "담요",
      "전기장판"
    ]
  }
}

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

// 제품 유형에 따라 적절한 배경과 구도를 반환하는 함수
function getProductSceneConfigs(productName: string, productDescription?: string): Array<{
  background: string
  angle: string
  camera: string
  lighting: string
  composition: string
}> {
  const name = productName.toLowerCase()
  const description = (productDescription || "").toLowerCase()
  const combined = `${name} ${description}`
  
  // 청소기, 바닥 청소용품
  if (combined.includes("청소기") || combined.includes("청소") || combined.includes("vacuum") || combined.includes("cleaner")) {
    return [
      {
        background: "실내 바닥 배경, 깨끗한 바닥 타일이나 나무 바닥, 카펫이나 매트, 현대적인 거실이나 복도, 생활감 있는 공간",
        angle: "바닥에서 제품을 사용하는 각도, floor level view, 제품이 바닥에 닿아있는 모습, 손으로 제품을 잡고 있는 시점",
        camera: "medium shot, 제품과 바닥이 모두 보이는 구도, 바닥에서 약간 위로 올려다보는 각도",
        lighting: "실내 조명, 창문에서 들어오는 자연광, 밝고 깨끗한 조명",
        composition: "바닥 중심 배치, 제품이 바닥에서 사용되는 자연스러운 구도"
      },
      {
        background: "거실 바닥 배경, 카펫이나 러그, 소파와 가구가 보이는 생활 공간, 따뜻한 인테리어",
        angle: "제품을 측면에서 본 각도, side view, 바닥에서 제품을 사용하는 모습, 손으로 잡고 있는 자세",
        camera: "wide shot, 제품과 주변 환경이 모두 보이는 넓은 화면",
        lighting: "따뜻한 실내 조명, 자연광과 인공 조명의 조화",
        composition: "바닥에서 사용되는 자연스러운 구도, 생활감 있는 배치"
      },
      {
        background: "주방이나 복도 바닥 배경, 깨끗한 타일 바닥, 현대적인 인테리어, 밝은 공간",
        angle: "제품을 위에서 약간 내려다보는 각도, top-down view, 바닥에서 제품을 사용하는 모습",
        camera: "close-up shot, 제품과 손이 명확하게 보이는 근접 촬영",
        lighting: "밝은 실내 조명, 선명한 그림자",
        composition: "바닥 중심, 제품 사용 맥락이 명확한 구도"
      }
    ]
  }
  
  // 주방용품 (믹서, 블렌더, 에어프라이어 등)
  if (combined.includes("믹서") || combined.includes("블렌더") || combined.includes("에어프라이어") || 
      combined.includes("전기밥솥") || combined.includes("전기주전자") || combined.includes("커피머신") ||
      combined.includes("mixer") || combined.includes("blender") || combined.includes("air fryer") ||
      combined.includes("주방") || combined.includes("kitchen")) {
    return [
      {
        background: "현대적인 주방 배경, 조리대 위, 주방 가구와 싱크대, 깨끗한 주방 인테리어",
        angle: "조리대 위에서 제품을 사용하는 각도, counter level view, 제품이 조리대 위에 있는 모습",
        camera: "medium shot, 제품과 주방 배경이 모두 보이는 구도",
        lighting: "밝은 주방 조명, 자연광이 들어오는 창문, 깨끗한 조명",
        composition: "조리대 위 중앙 배치, 주방 환경이 보이는 자연스러운 구도"
      },
      {
        background: "주방 테이블 배경, 나무 테이블이나 대리석 테이블, 주방 식탁, 따뜻한 분위기",
        angle: "테이블 위에서 제품을 사용하는 각도, table level view, 제품이 테이블 위에 있는 모습",
        camera: "wide shot, 제품과 테이블, 주방 환경이 모두 보이는 넓은 화면",
        lighting: "따뜻한 주방 조명, 테이블 램프, 부드러운 그림자",
        composition: "테이블 위 배치, 생활감 있는 주방 구도"
      },
      {
        background: "주방 조리대 배경, 현대적인 주방 인테리어, 싱크대와 가스레인지, 깨끗한 공간",
        angle: "제품을 위에서 내려다보는 각도, top view, 조리대 위 제품의 상단면이 보이는 각도",
        camera: "close-up shot, 제품에 집중된 구도, 주방 배경이 살짝 보임",
        lighting: "밝은 주방 조명, 선명한 그림자",
        composition: "조리대 위 중심 배치, 제품이 명확하게 보이는 구도"
      }
    ]
  }
  
  // 화장품, 스킨케어
  if (combined.includes("화장품") || combined.includes("세럼") || combined.includes("크림") || 
      combined.includes("로션") || combined.includes("에센스") || combined.includes("토너") ||
      combined.includes("cosmetic") || combined.includes("serum") || combined.includes("cream")) {
    return [
      {
        background: "화장대 배경, 거울과 화장품 정리함, 깨끗한 욕실이나 화장실, 미니멀한 인테리어",
        angle: "화장대 위에서 제품을 보는 각도, vanity level view, 제품이 화장대 위에 있는 모습",
        camera: "medium shot, 제품과 화장대 배경이 모두 보이는 구도",
        lighting: "밝은 화장대 조명, 거울 반사광, 깨끗한 조명",
        composition: "화장대 위 중앙 배치, 미니멀하고 세련된 구도"
      },
      {
        background: "욕실 배경, 현대적인 욕실 인테리어, 깨끗한 타일, 미니멀한 공간",
        angle: "제품을 정면에서 본 각도, front view, 화장대나 선반 위에 있는 모습",
        camera: "wide shot, 제품과 욕실 환경이 모두 보이는 넓은 화면",
        lighting: "밝은 욕실 조명, 자연광과 인공 조명",
        composition: "욕실 공간 내 자연스러운 배치"
      },
      {
        background: "밝고 깨끗한 배경, 흰색이나 밝은 색상의 미니멀한 배경, 세련된 공간",
        angle: "제품을 위에서 내려다보는 각도, top view, 제품의 상단면이 명확하게 보이는 각도",
        camera: "close-up shot, 제품에 집중된 구도, 배경이 흐릿하게 보임",
        lighting: "부드러운 자연광, 밝고 깨끗한 조명",
        composition: "중앙 배치, 미니멀하고 세련된 구도"
      }
    ]
  }
  
  // 전자기기 (스마트폰, 태블릿, 노트북 등)
  if (combined.includes("스마트폰") || combined.includes("태블릿") || combined.includes("노트북") ||
      combined.includes("키보드") || combined.includes("마우스") || combined.includes("이어폰") ||
      combined.includes("smartphone") || combined.includes("tablet") || combined.includes("laptop")) {
    return [
      {
        background: "책상이나 테이블 위 배경, 깨끗한 작업 공간, 현대적인 오피스 인테리어",
        angle: "테이블 위에서 제품을 보는 각도, desk level view, 제품이 테이블 위에 있는 모습",
        camera: "medium shot, 제품과 책상 배경이 모두 보이는 구도",
        lighting: "밝은 작업 조명, 자연광이 들어오는 창문, 깨끗한 조명",
        composition: "테이블 위 중앙 배치, 작업 공간이 보이는 자연스러운 구도"
      },
      {
        background: "현대적인 사무실 배경, 깨끗한 책상, 모던한 인테리어, 미니멀한 공간",
        angle: "제품을 정면에서 본 각도, front view, 테이블 위에 있는 모습",
        camera: "wide shot, 제품과 사무실 환경이 모두 보이는 넓은 화면",
        lighting: "밝은 사무실 조명, 자연광과 인공 조명의 조화",
        composition: "책상 위 배치, 전문적이고 세련된 구도"
      },
      {
        background: "밝고 깨끗한 배경, 흰색이나 밝은 색상의 미니멀한 배경, 세련된 공간",
        angle: "제품을 위에서 내려다보는 각도, top view, 제품의 상단면이 명확하게 보이는 각도",
        camera: "close-up shot, 제품에 집중된 구도, 배경이 흐릿하게 보임",
        lighting: "부드러운 자연광, 밝고 깨끗한 조명",
        composition: "중앙 배치, 미니멀하고 세련된 구도"
      }
    ]
  }
  
  // 기본 설정 (범용 제품)
  return [
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
}

// 제품 유형에 따라 손이 필요한지 판단하는 함수
function needsHandsInImage(productName: string, productDescription?: string): boolean {
  const name = productName.toLowerCase()
  const description = (productDescription || "").toLowerCase()
  const combined = `${name} ${description}`
  
  // 손이 필요한 제품 키워드
  const handsRequiredKeywords = [
    "청소기", "청소", "로봇청소기", "무선청소기", "진공청소기",
    "드라이기", "헤어드라이기", "고데기", "다리미",
    "믹서", "블렌더", "제빵기", "에어프라이어", "전기밥솥",
    "전기주전자", "커피머신", "그라인더",
    "전동드릴", "전동공구", "전동톱", "전동드라이버",
    "마사지기", "안마기", "지압기",
    "스마트폰", "태블릿", "노트북", "키보드", "마우스",
    "게임패드", "조이스틱",
    "운동기구", "덤벨", "바벨", "요가매트",
    "공구", "망치", "드라이버", "렌치",
    "가위", "칼", "도구",
    "vacuum", "cleaner", "blender", "mixer", "drill", "tool", "appliance"
  ]
  
  // 손이 필요하지 않은 제품 키워드
  const handsNotRequiredKeywords = [
    "화장품", "세럼", "크림", "로션", "에센스", "토너",
    "마스크팩", "팩", "스킨케어",
    "의류", "옷", "상의", "하의", "바지", "치마", "원피스",
    "신발", "운동화", "구두", "부츠",
    "가방", "백", "지갑", "벨트",
    "침구", "이불", "베개", "담요",
    "cosmetic", "clothing", "apparel", "bag", "shoes"
  ]
  
  // 손이 필요하지 않은 제품이면 false
  if (handsNotRequiredKeywords.some(keyword => combined.includes(keyword))) {
    return false
  }
  
  // 손이 필요한 제품이면 true
  if (handsRequiredKeywords.some(keyword => combined.includes(keyword))) {
    return true
  }
  
  // 기본값: 제품 설명이나 대본에 "사용", "사용법", "사용하기" 같은 단어가 있으면 손 필요
  const usageKeywords = ["사용", "사용법", "사용하기", "조작", "사용하는", "use", "using"]
  if (usageKeywords.some(keyword => combined.includes(keyword))) {
    return true
  }
  
  // 기본값: 손 없이 제품만 (보수적 접근)
  return false
}

// 나노바나나를 사용한 이미지 생성 (제품 이미지 참고)
export async function generateImageWithNanobanana(
  sceneScript: string,
  productName: string,
  productImageBase64: string | undefined,
  replicateApiKey?: string,
  sceneIndex?: number, // 섹션 인덱스 (0, 1, 2) - 배경 스타일 결정용
  productDescription?: string, // 제품 설명 (손 필요 여부 판단용)
  aspectRatio?: string // 원본 이미지 비율 (예: "1:1", "9:16", "16:9")
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
    
    // AI를 활용하여 손이 필요한지 판단 (이미지 생성용)
    let needsHands = false
    try {
      // OpenAI API 키 확인
      const openaiApiKey = process.env.OPENAI_API_KEY
      if (openaiApiKey) {
        // AI를 통해 손 필요 여부 판단 (간단한 판단만 수행)
        const productActions = await generateProductActionPromptWithAI(
          productName,
          productDescription,
          sceneIndex !== undefined ? sceneIndex : 0,
          openaiApiKey
        )
        needsHands = productActions.needsHands
        console.log(`[Shopping] AI가 판단한 손 필요 여부: ${needsHands} (제품: ${productName})`)
      } else {
        // API 키가 없으면 기본 함수 사용
        needsHands = needsHandsInImage(productName, productDescription)
        console.log(`[Shopping] OpenAI API 키 없음, 기본 함수로 손 필요 여부 판단: ${needsHands}`)
      }
    } catch (error) {
      console.warn("[Shopping] AI 손 필요 여부 판단 실패, 기본 함수 사용:", error)
      // AI 판단 실패 시 기본 함수 사용
      needsHands = needsHandsInImage(productName, productDescription)
    }
    
    // sceneScript가 제공되면 그것을 사용 (재생성 시 추가 프롬프트 포함)
    let imagePrompt: string
    
    if (sceneScript && sceneScript.trim() && sceneScript.length > 50) {
      // sceneScript가 제공된 경우 (재생성 시 추가 프롬프트 포함된 프롬프트)
      imagePrompt = sceneScript
      console.log("[Shopping] 제공된 프롬프트 사용 (추가 프롬프트 포함 가능):", sceneScript.substring(0, 100) + "...")
    } else {
      // 기존 로직: 제품 유형에 따라 적절한 배경과 구도 설정
      const sceneConfigs = getProductSceneConfigs(productName, productDescription)
      
      const currentSceneIndex = sceneIndex !== undefined ? sceneIndex : 0
      const config = sceneConfigs[currentSceneIndex] || sceneConfigs[0]
      
      // 각 장면마다 완전히 다른 프롬프트 구조로 생성
      imagePrompt = `${productName} 제품 사진.

핵심 요소 (반드시 포함):
- 제품 전체가 화면에 완전히 보여야 함 (full product visible, entire product in frame, entire product fills the frame)
- 제품 전체가 화면에 가득 차야 함 (제품의 일부만 보이는 것이 아닌, 전체 제품이 화면에 가득 차야 함)
- 제품의 모든 디테일과 형태가 명확하게 보임
- 제품 중심의 사진 (product-focused photography)${needsHands ? `
- 손으로 제품을 사용하거나 잡고 있는 모습 (hands using or holding the product, natural hand position, hands visible but face not visible)` : ""}

스타일:
- ${config.angle}
- ${config.camera}
- ${config.lighting}
- ${config.composition}
- ${config.background}

${needsHands ? `포함 사항:
- 손으로 제품을 사용하는 모습 (hands using the product, natural hand grip, product in use)
- 손이 자연스럽게 제품을 잡고 있거나 사용하는 자세 (hands naturally holding or operating the product)
- 제품 사용 맥락을 보여주는 실용적인 구도 (practical composition showing product in use)` : `금지 사항:
- 손이나 사람 없음 (no hands, no people, product only)`}

금지 사항:
- 사람 얼굴 없음 (no face, no head visible)
- 텍스트나 글씨 없음 (no text, no letters)

품질: 고품질, 전문적인 제품 촬영, 매력적인 구도, 9:16 세로 비율, vertical composition.`
    }
    
    // 제품 이미지가 있으면 참고 문구 추가 (기존 프롬프트든 새 프롬프트든)
    if (productImageBase64) {
      imagePrompt = `${imagePrompt}

중요: 첨부된 제품 이미지를 참고하여 제품의 실제 모습을 정확하게 보여주세요.
- 제품의 색상, 형태, 디자인을 일관성있게 유지 (product preservation, exact product shape and features maintained)
- 제품 전체가 화면에 완전히 보이도록 구성
- 원본 제품 이미지에 있는 기능, 버튼, 스위치, 조절 장치만 그대로 유지 (maintain exact original product features, buttons, switches, controls from reference image)
- 원본 제품에 없는 새로운 기능, 버튼, 스위치, 조절 장치를 절대 추가하지 않음 (no additional features, no extra buttons, no new switches, no new controls, no modifications to original design)
- 제품의 원본 디자인과 구조를 정확하게 보존 (exact product design preservation, maintain original product structure, do not add or remove any elements)
- 참고 이미지의 제품과 동일한 모델이어야 함 (same product model as reference image, identical product design)
- 배경은 참고 이미지와 다르게 생성해야 함 (background must be different from the reference image, create a new background that is different from the original image's background, different background setting, different background colors, different background style, do not copy the reference image's background)${needsHands ? `
- 손으로 제품을 자연스럽게 사용하거나 잡고 있는 모습 포함 (hands naturally using or holding the product)` : `
- 제품만 보여주고 손이나 사람은 포함하지 않음 (product only, no hands, no people)`}`
    }

    console.log("[Shopping] 나노바나나 이미지 생성 시작, 장면:", sceneScript.substring(0, 50) + "...")
    
    // 원본 이미지 비율 사용 (없으면 기본값 9:16)
    const imageAspectRatio = aspectRatio || "9:16"
    console.log(`[Shopping] 이미지 생성 비율: ${imageAspectRatio}`)
    
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
          aspect_ratio: imageAspectRatio, // 원본 이미지 비율에 맞게 생성
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

// 대본 기반으로 영상 생성 프롬프트 생성
export async function generateVideoPromptFromScript(
  sceneScript: string,
  productName: string,
  duration: number, // 초 단위
  productDescription?: string
): Promise<string> {
  // 대본 내용을 기반으로 자연스러운 영상 움직임 프롬프트 생성
  // 제품이 사용되는 맥락에 맞는 미묘한 움직임
  const needsHands = needsHandsInImage(productName, productDescription)
  
  let prompt = `${productName} product in use. `
  
  if (needsHands) {
    prompt += `Hands naturally using or holding the product. `
  }
  
  // 대본 내용에 맞는 움직임 설명 추가
  if (sceneScript.includes("사용") || sceneScript.includes("사용법") || sceneScript.includes("사용하기")) {
    prompt += `Product being used naturally, subtle movement, realistic usage. `
  } else if (sceneScript.includes("보기") || sceneScript.includes("보여") || sceneScript.includes("확인")) {
    prompt += `Product being shown, gentle camera movement, smooth reveal. `
  } else if (sceneScript.includes("효과") || sceneScript.includes("결과") || sceneScript.includes("만족")) {
    prompt += `Product showing results, satisfying moment, subtle animation. `
  } else {
    prompt += `Product showcase, smooth camera movement, professional presentation. `
  }
  
  prompt += `Duration: ${duration} seconds. `
  prompt += `Smooth motion, natural movement, no sudden changes. `
  prompt += `High quality, professional video, 9:16 vertical format. `
  prompt += `No text, no letters, no face visible.`
  
  return prompt
}

// AI를 활용하여 제품에 맞는 구체적인 행동 프롬프트 생성
async function generateProductActionPromptWithAI(
  productName: string,
  productDescription: string | undefined,
  imageIndex: 0 | 1 | 2,
  apiKey?: string
): Promise<{ allowedActions: string; forbiddenActions: string; needsHands: boolean }> {
  const GPT_API_KEY = apiKey || process.env.OPENAI_API_KEY
  
  if (!GPT_API_KEY) {
    // API 키가 없으면 기본 함수 사용
    return getProductSpecificActions(productName, productDescription)
  }

  try {
    const sceneDescriptions = [
      "제품을 실제로 사용하는 장면 (전체 샷)",
      "제품의 디테일을 강조하는 장면 (디테일 샷, 슬로우모션)",
      "다른 배경과 구도로 제품을 사용하는 장면"
    ]

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
            content: `당신은 제품 영상 제작 전문가입니다. 주어진 제품 정보를 분석하여 해당 제품에만 해당하는 구체적이고 정확한 행동 프롬프트를 생성해주세요.

중요 규칙 (절대 준수):
1. 제품의 핵심 기능(CORE FUNCTION) 하나만 지속적으로 보여줘야 합니다
2. 영상 전체에 걸쳐 동일한 핵심 행동이 계속되어야 합니다 (행동이 바뀌거나 중단되면 안 됨)
3. 제품의 실제 사용 행동만 포함해야 합니다 - 제품이 작동하거나 사용되는 모습만 보여주세요
4. 제품과 관련 없는 행동은 절대 포함하지 마세요

절대 금지 행동 (매우 중요):
- 제품 분리, 조립, 해체 행동 (예: 난로 부품 분리, 제품을 분해하는 모습)
- 제품 점화, 켜기, 시작하는 행동 (예: 난로에 불 붙이기, 제품 전원 켜는 모습)
- 제품 점검, 검사, 확인 행동 (예: 부품 확인, 상태 점검)
- 제품 교체, 정비, 수리 행동 (예: 필터 교체, 부품 교체)
- 제품 보관, 정리, 저장 행동 (예: 제품을 보관함에 넣기, 정리하기)
- 제품을 사용하지 않고 들고 있는 모습
- 제품의 부가 기능이나 보조 기능
- 제품과 관련 없는 행동
- 제품 위에 다른 제품이나 물건을 올리는 행동 (예: 제품 위에 다른 제품을 얹기, 제품 위에 물건 올리기) - 절대 금지

손(hands) 관련 규칙 (매우 중요):
- 제품이 손으로 사용되는 제품인지 판단하세요 (청소기, 믹서, 전기기기, 주방용품, 공구 등)
- 손이 필요한 제품의 경우: "hands operating the product continuously throughout the entire video from start to finish. If hands appear at the beginning, hands must remain visible throughout the entire video until the end. DO NOT show hands disappearing or product operating without hands mid-video."
- 손이 필요하지 않은 제품의 경우: "no hands, product only"

예시 (올바른 행동):
- 청소기: "바닥 청소하는 행동만 지속적으로, 손이 나오면 영상 끝까지 손이 계속 나와야 함" (청소기가 바닥에서 움직이며 청소하는 모습만)
- 믹서: "재료를 갈거나 섞는 행동만 지속적으로, 손이 나오면 영상 끝까지 손이 계속 나와야 함" (믹서가 작동하며 재료를 섞는 모습만)
- 에어프라이어: "음식을 조리하는 행동만 지속적으로" (에어프라이어가 작동하며 음식을 조리하는 모습만)
- 난로: "난로가 작동하며 열을 내뿜는 모습만 지속적으로" (난로가 작동 중인 모습만, 불 붙이기나 분리 행동 금지)
- 화장품: "손 없이 제품만" (손 필요 없음)

예시 (금지 행동):
- 난로: "난로 부품 분리", "난로에 불 붙이기", "난로 점검" 등은 절대 금지
- 청소기: "필터 교체", "부품 점검", "보관" 등은 절대 금지
- 믹서: "부품 교체", "점검", "정리" 등은 절대 금지

응답 형식 (JSON):
{
  "allowedActions": "이 장면에서 보여줄 수 있는 구체적인 핵심 행동 하나만 (예: '청소기를 바닥에서 앞뒤로 움직이며 먼지를 흡입하는 모습을 영상 전체에 걸쳐 지속적으로, 손이 나오면 영상 끝까지 손이 계속 나와야 함', '믹서에 재료를 넣고 작동시키는 모습을 영상 전체에 걸쳐 지속적으로, 손이 나오면 영상 끝까지 손이 계속 나와야 함', '난로가 작동하며 열을 내뿜는 모습을 영상 전체에 걸쳐 지속적으로'). 핵심 기능 하나만 계속 보여주세요. 손이 필요한 제품은 손이 영상 전체에 걸쳐 계속 나와야 합니다.",
  "forbiddenActions": "절대 보여주면 안 되는 행동들 (예: '제품 분리', '제품 조립', '제품 점화', '제품 켜기', '제품 점검', '제품 교체', '제품 정비', '제품 보관', '제품을 공중에 들고 있는 모습', '제품을 사용하지 않고 보관하는 모습', '필터 교체', '부품 점검', '정비', '보관', '제품과 관련 없는 행동', '핵심 기능이 아닌 부가 행동', '손이 나오다가 중간에 사라지는 모습', '손 없이 제품이 혼자 작동하는 모습(손이 필요한 제품의 경우)', '난로 부품 분리', '난로에 불 붙이기', '난로 점검' 등). 핵심 기능 외의 모든 행동을 금지합니다.",
  "needsHands": true 또는 false - 이 제품이 손으로 사용되는 제품인지 판단하세요. 손이 필요한 제품(청소기, 믹서, 전기기기, 주방용품, 공구 등)은 true, 손이 필요하지 않은 제품(화장품, 의류, 액세서리 등)은 false입니다.
}`
          },
          {
            role: "user",
            content: `제품명: ${productName}
${productDescription ? `제품 설명: ${productDescription}` : ''}
장면 유형: ${sceneDescriptions[imageIndex]}

이 제품에 맞는 구체적인 행동 프롬프트를 생성해주세요. 제품의 실제 사용 방법을 정확히 반영하고, 제품과 관련 없는 행동은 절대 포함하지 마세요.

매우 중요:
1. 제품의 실제 사용 행동만 포함하세요 (제품이 작동하거나 사용되는 모습만)
2. 제품 분리, 조립, 점화, 켜기, 점검, 교체, 정비, 보관 등은 절대 포함하지 마세요
3. 예를 들어 난로인 경우: "난로가 작동하며 열을 내뿜는 모습"만 보여주고, "난로 부품 분리"나 "난로에 불 붙이기"는 절대 금지입니다
4. 제품의 핵심 기능 하나만 지속적으로 보여주세요

손 관련: 이 제품이 손으로 사용되는 제품인지 판단하세요. 손이 필요한 제품(청소기, 믹서, 전기기기, 주방용품, 공구 등)의 경우, 손이 나오면 영상 전체에 걸쳐 끝까지 손이 계속 나와야 합니다. 손이 나오다가 중간에 사라지면 안 됩니다.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const content = JSON.parse(data.choices[0].message.content)
    
    // needsHands는 AI가 판단한 값이 있으면 사용하고, 없으면 기본 함수로 판단
    const aiNeedsHands = content.needsHands !== undefined ? content.needsHands : null
    
    return {
      allowedActions: content.allowedActions || "ONLY actions directly related to using the product",
      forbiddenActions: content.forbiddenActions || "DO NOT show any actions unrelated to the product",
      needsHands: aiNeedsHands !== null ? aiNeedsHands : needsHandsInImage(productName, productDescription) // AI가 판단하지 못하면 기본 함수 사용
    }
  } catch (error) {
    console.error("[Shopping] AI 행동 프롬프트 생성 실패, 기본 함수 사용:", error)
    // 실패 시 기본 함수 사용
    const defaultActions = getProductSpecificActions(productName, productDescription)
    return {
      ...defaultActions,
      needsHands: needsHandsInImage(productName, productDescription)
    }
  }
}

// 각 이미지를 영상으로 변환하기 위한 프롬프트 생성 (새로운 규칙 적용)
// 제품 유형에 따라 적절한 행동만 반환하는 함수 (기본값/폴백용)
function getProductSpecificActions(productName: string, productDescription?: string): {
  allowedActions: string
  forbiddenActions: string
} {
  const name = productName.toLowerCase()
  const description = (productDescription || "").toLowerCase()
  const combined = `${name} ${description}`
  
  // 청소기, 청소용품
  if (combined.includes("청소기") || combined.includes("청소") || combined.includes("vacuum") || combined.includes("cleaner") || combined.includes("스위퍼")) {
    return {
      allowedActions: "ONLY the core cleaning action continuously throughout the entire video: vacuuming the floor, moving the vacuum cleaner across the floor surface, cleaning carpets or tiles. The product must be actively cleaning the floor from start to finish. Show ONLY the main cleaning function - the vacuum cleaner moving on the floor and cleaning continuously. CRITICAL: If hands are shown operating the vacuum cleaner, hands must remain visible throughout the entire video from start to finish. Hands must NOT disappear mid-video.",
      forbiddenActions: "ABSOLUTELY FORBIDDEN: filter replacement, filter inspection, filter cleaning, maintenance, checking parts, examining the product, product being held in the air, product not touching the floor, product being stored, product being carried, product not in use, any action unrelated to the core cleaning function. DO NOT show any secondary actions like maintenance, inspection, or replacement - ONLY show continuous cleaning action. DO NOT show hands appearing and then disappearing - if hands appear, they must stay until the end."
    }
  }
  
  // 주방용품 (믹서, 블렌더, 에어프라이어 등)
  if (combined.includes("믹서") || combined.includes("블렌더") || combined.includes("mixer") || combined.includes("blender")) {
    return {
      allowedActions: "ONLY the core blending/mixing action continuously throughout the entire video: blending ingredients, mixing food, operating the blender/mixer with ingredients inside continuously from start to finish. The product must be actively blending/mixing continuously. Show ONLY the main blending function - the blender/mixer operating with ingredients inside continuously. CRITICAL: If hands are shown operating the blender/mixer, hands must remain visible throughout the entire video from start to finish. Hands must NOT disappear mid-video.",
      forbiddenActions: "ABSOLUTELY FORBIDDEN: cleaning the blender, removing parts, inspecting parts, maintenance, product being held without use, product empty and not operating, product being stored, any action unrelated to the core blending/mixing function. DO NOT show any secondary actions like cleaning or maintenance - ONLY show continuous blending action. DO NOT show hands appearing and then disappearing - if hands appear, they must stay until the end."
    }
  }
  
  if (combined.includes("에어프라이어") || combined.includes("air fryer") || combined.includes("프라이어")) {
    return {
      allowedActions: "ONLY the core cooking action continuously throughout the entire video: food cooking inside the air fryer, the air fryer operating with food inside continuously from start to finish. Show ONLY the main cooking function - food being cooked inside continuously.",
      forbiddenActions: "ABSOLUTELY FORBIDDEN: placing food in (only show if it's the very beginning), removing cooked food (only at the very end if necessary), cleaning, filter replacement, maintenance, inspection, product empty and not cooking, product being stored, product being carried, any action unrelated to the core cooking function. DO NOT show food placement or removal - ONLY show continuous cooking action."
    }
  }
  
  // 난로, 히터, 전기히터
  if (combined.includes("난로") || combined.includes("히터") || combined.includes("heater") || combined.includes("stove") || combined.includes("전기히터")) {
    return {
      allowedActions: "ONLY the core heating action continuously throughout the entire video: the heater/stove operating and emitting heat continuously from start to finish. Show ONLY the main heating function - the product operating and providing heat continuously. The product must be actively heating throughout the entire video.",
      forbiddenActions: "ABSOLUTELY FORBIDDEN: lighting the heater/stove, turning on the heater/stove, disassembling the heater/stove, separating parts, inspecting parts, maintenance, checking the product, product being turned off, product not operating, product being stored, product being carried, any action unrelated to the core heating function. DO NOT show ignition, disassembly, inspection, or maintenance - ONLY show continuous heating operation."
    }
  }
  
  // 전기기기 (전기밥솥, 전자레인지, 토스터 등)
  if (combined.includes("전기밥솥") || combined.includes("전자레인지") || combined.includes("토스터") || 
      combined.includes("rice cooker") || combined.includes("microwave") || combined.includes("toaster")) {
    return {
      allowedActions: "ONLY the core operating action continuously throughout the entire video: the product operating and performing its main function continuously from start to finish. Show ONLY the main function - the product actively operating continuously.",
      forbiddenActions: "ABSOLUTELY FORBIDDEN: turning on the product, starting the product, disassembling the product, separating parts, inspecting parts, maintenance, checking the product, product being turned off, product not operating, product being stored, product being carried, any action unrelated to the core operating function. DO NOT show turning on, disassembly, inspection, or maintenance - ONLY show continuous operation."
    }
  }
  
  // 화장품, 스킨케어
  if (combined.includes("세럼") || combined.includes("크림") || combined.includes("로션") || combined.includes("에센스") || 
      combined.includes("serum") || combined.includes("cream") || combined.includes("lotion") || combined.includes("essence") ||
      combined.includes("화장품") || combined.includes("스킨케어") || combined.includes("cosmetic") || combined.includes("skincare")) {
    return {
      allowedActions: "ONLY skincare application actions: applying the product to skin, hands applying cream/serum, product being dispensed and applied, gentle application motion",
      forbiddenActions: "DO NOT show: product being held without application, product not in contact with skin, product being stored, any action unrelated to applying skincare products"
    }
  }
  
  // 전자기기 (이어폰, 스피커, 충전기 등)
  if (combined.includes("이어폰") || combined.includes("스피커") || combined.includes("충전기") || 
      combined.includes("earphone") || combined.includes("earbud") || combined.includes("speaker") || combined.includes("charger")) {
    return {
      allowedActions: "ONLY usage actions: wearing earbuds, placing earbuds in ears, connecting charger, using the device, hands operating controls, device in active use",
      forbiddenActions: "DO NOT show: product being held without use, product not connected or not in use, product being stored, any action unrelated to using the electronic device"
    }
  }
  
  // 의류, 패션 아이템
  if (combined.includes("옷") || combined.includes("의류") || combined.includes("패딩") || combined.includes("코트") ||
      combined.includes("clothing") || combined.includes("jacket") || combined.includes("coat") || combined.includes("패션")) {
    return {
      allowedActions: "ONLY wearing/displaying actions: product being worn, product displayed on hanger, product being tried on, hands adjusting the clothing",
      forbiddenActions: "DO NOT show: product being folded, product being stored in closet, product not being worn or displayed, any action unrelated to wearing or displaying clothing"
    }
  }
  
  // 기본값: 제품 사용 행동만
  // 손이 필요한 제품인지 판단
  const needsHands = needsHandsInImage(productName, productDescription)
  return {
    allowedActions: `ONLY the core/main function of ${productName} continuously throughout the entire video: demonstrate the product's main function continuously from start to finish, show the product being actively used for its intended purpose without interruption${needsHands ? ", hands operating the product naturally. CRITICAL: If hands are shown operating the product, hands must remain visible throughout the entire video from start to finish. Hands must NOT disappear mid-video." : ", no hands, product only"}. Show ONLY the primary core action - the same action must continue throughout the video.`,
    forbiddenActions: `ABSOLUTELY FORBIDDEN: disassembling the product, separating parts, assembling the product, lighting the product, turning on the product, starting the product, maintenance, inspection, replacement, checking parts, examining the product, product being held without use, product being stored, product not in active use, any action unrelated to the product's core/main function. DO NOT show disassembly, ignition, turning on, inspection, or maintenance - ONLY show the continuous core function.${needsHands ? " DO NOT show hands appearing and then disappearing - if hands appear, they must stay until the end." : ""}`
  }
}

export async function generateVideoPromptForImage(
  imageIndex: 0 | 1 | 2, // 첫 번째, 두 번째, 세 번째 이미지
  productName: string,
  productDescription?: string,
  duration?: number, // 영상 길이 (초)
  apiKey?: string // OpenAI API 키 (AI 행동 프롬프트 생성용)
): Promise<string> {
  // duration 검증 및 로깅
  if (!duration || duration <= 0) {
    console.warn(`[Shopping] ⚠️ generateVideoPromptForImage: duration이 유효하지 않음 (${duration}), 기본값 4초 사용`)
    duration = 4
  } else {
    console.log(`[Shopping] ✅ generateVideoPromptForImage: duration=${duration}초 (이미지 ${imageIndex + 1})`)
  }
  
  // AI를 활용하여 제품에 맞는 구체적인 행동 프롬프트 생성
  const productActions = await generateProductActionPromptWithAI(
    productName,
    productDescription,
    imageIndex,
    apiKey
  )
  
  // 손이 필요한 제품인지 판단
  const needsHands = needsHandsInImage(productName, productDescription)
  
  // 공통 규칙
  const commonRules = `GLOBAL RULES (MUST FOLLOW - ABSOLUTELY CRITICAL):
- ABSOLUTELY CRITICAL - VIDEO DURATION (HIGHEST PRIORITY): This video MUST be exactly ${duration} seconds long. NOT ${duration * 3} seconds, NOT the full TTS duration (${duration * 3} seconds), but EXACTLY ${duration} seconds. This is 1/3 of the total TTS duration. The video MUST end at exactly ${duration} seconds. DO NOT make it longer than ${duration} seconds. DO NOT make it the full TTS duration. The video duration is ${duration} seconds, NOT ${duration * 3} seconds.
- PRODUCT PRESERVATION (HIGHEST PRIORITY): The product's physical shape, size, proportions, dimensions, design, colors, textures, and all visual features MUST remain EXACTLY the same as shown in the input image throughout the entire video
- The product must be IDENTICAL to the reference image - same exact shape, same exact size, same exact proportions, same exact design, same exact colors
- DO NOT deform, distort, stretch, shrink, resize, modify, abstract, stylize, or redesign the product in ANY way
- DO NOT change the product's form, structure, appearance, or colors - it must look EXACTLY like the input image
- The product's outline, edges, curves, angles, and all geometric features must remain unchanged
- The product's colors, color scheme, and color palette must remain EXACTLY the same as the input image - DO NOT change any colors
- If the product has buttons, handles, screens, or any components, they must remain in the exact same position, size, and color
- The product's materials, textures, and surface details must remain consistent
- BACKGROUND PRESERVATION (CRITICAL): The background shown in the input image MUST be preserved and maintained throughout the entire video. The background's colors, style, setting, and overall appearance must remain EXACTLY the same as the input image. DO NOT change the background to a different setting, color, or style. The background must be IDENTICAL to the input image.
- ONLY horizontal camera movement is allowed - the product itself must remain COMPLETELY STATIC and UNTOUCHED. DO NOT move, rotate, touch, or manipulate the product. Only the camera can move horizontally - smooth horizontal camera movement, slow horizontal rotation (left-right), gentle horizontal panning (left-right), or subtle horizontal angle changes. DO NOT move the camera vertically (up or down). DO NOT tilt the camera up or down. Keep the camera at the same height level. The product must stay in the exact same position and state as shown in the input image. The background must be IDENTICALLY preserved
- No human faces or heads visible (no face, no head)
- Hands, arms, or partial body parts are allowed
- No text, subtitles, or watermarks
- Realistic lighting and natural movement
- Vertical format (9:16 aspect ratio)
- ABSOLUTELY FORBIDDEN - NO OBJECTS ON PRODUCT: DO NOT place any other products, objects, items, or things on top of or above the product. The product must remain clear and unobstructed. DO NOT show anything being placed on the product, stacked on the product, or positioned above the product. The product surface must remain empty and clear throughout the entire video.
- CRITICAL: ${productActions.allowedActions}
- CRITICAL: ${productActions.forbiddenActions}`

  let prompt = ""

  if (imageIndex === 0) {
    // 첫 번째 이미지: 전체 샷 - 제품을 정적 상태로 유지하고 카메라만 움직임
    prompt = `${productName} product full shot video. `
    prompt += `ABSOLUTELY CRITICAL - VIDEO DURATION: This video MUST be exactly ${duration} seconds long. NOT ${duration * 3} seconds, NOT the full TTS duration, but EXACTLY ${duration} seconds. The total TTS duration is ${duration * 3} seconds, and this is only 1/3 of it. This video segment must be exactly ${duration} seconds. DO NOT make it longer than ${duration} seconds. DO NOT make it the full TTS duration. `
    prompt += `ABSOLUTELY CRITICAL - FULL SHOT (NOT DETAIL SHOT): This is a FULL SHOT showing the entire product. The complete product must be visible in the frame throughout the entire video. This is NOT a close-up or detail shot. Show the entire product from a medium distance, with the whole product clearly visible. `
    prompt += `ABSOLUTELY CRITICAL - PRODUCT PRESERVATION: The product shown in the input image must appear EXACTLY as it is - same shape, same size, same proportions, same design, same colors, same textures. DO NOT modify, deform, distort, or change the product in any way. The product must be IDENTICAL to the input image. `
    prompt += `ABSOLUTELY CRITICAL - BACKGROUND PRESERVATION: The background shown in the input image MUST be preserved and maintained throughout the entire video. The background's colors, style, setting, and overall appearance must remain EXACTLY the same as the input image. DO NOT change the background. `
    prompt += `ABSOLUTELY CRITICAL - STATIC PRODUCT, CAMERA MOVEMENT ONLY: The product must remain COMPLETELY STATIC and UNTOUCHED throughout the entire video. DO NOT show the product being used, operated, touched, moved, or manipulated in any way. DO NOT show hands touching or operating the product. The product must stay in the exact same position and state as shown in the input image. ONLY the camera should move - smooth, horizontal camera movement only. `
    prompt += `ABSOLUTELY CRITICAL - HORIZONTAL CAMERA MOVEMENT ONLY: Camera movement must be HORIZONTAL ONLY - slow horizontal rotation around the product (left-right), gentle horizontal panning (left-right), or subtle horizontal angle changes. DO NOT move the camera up or down. DO NOT use vertical camera movement. DO NOT tilt the camera up or down. Keep the camera at the same height level throughout the entire video. Only horizontal (left-right) camera movement is allowed. `
    prompt += `ABSOLUTELY FORBIDDEN - NO OBJECTS ON PRODUCT: DO NOT place any other products, objects, items, or things on top of or above the product. The product must remain clear and unobstructed. DO NOT show anything being placed on the product, stacked on the product, or positioned above the product. The product surface must remain empty and clear throughout the entire video. `
    prompt += `Show the product in a static state with smooth, horizontal-only camera movement around it. The entire product must be visible in the frame. `
    prompt += `Smooth, natural, horizontal-only camera movement - slow horizontal rotation around the product (left-right), gentle horizontal panning (left-right), or subtle horizontal angle changes. The camera height must remain constant - no vertical movement. The product must remain completely still. `
    prompt += `NO hands, NO human interaction, NO product usage, NO product operation - product only, static product with camera movement. `
    prompt += `${commonRules}`
  } else if (imageIndex === 1) {
    // 두 번째 이미지: 디테일 샷 - 제품의 디테일을 강조하는 클로즈업 (전체샷과 완전히 다른 스타일)
    prompt = `${productName} product detail shot video. `
    prompt += `ABSOLUTELY CRITICAL - VIDEO DURATION: This video MUST be exactly ${duration} seconds long. NOT ${duration * 3} seconds, NOT the full TTS duration, but EXACTLY ${duration} seconds. The total TTS duration is ${duration * 3} seconds, and this is only 1/3 of it. This video segment must be exactly ${duration} seconds. DO NOT make it longer than ${duration} seconds. DO NOT make it the full TTS duration. `
    prompt += `ABSOLUTELY CRITICAL - DETAIL SHOT (NOT FULL SHOT): This is a DETAIL SHOT/CLOSE-UP showing product details. This is COMPLETELY DIFFERENT from the full shot. Focus on product details, textures, features, and close-up views. The product may be shown partially or in close-up, emphasizing specific details, buttons, textures, materials, or design elements. `
    prompt += `ABSOLUTELY CRITICAL - PRODUCT PRESERVATION: The product shown in the input image must appear EXACTLY as it is - same shape, same size, same proportions, same design, same colors, same textures. DO NOT modify, deform, distort, or change the product in any way. The product must be IDENTICAL to the input image. `
    prompt += `ABSOLUTELY CRITICAL - BACKGROUND PRESERVATION: The background shown in the input image MUST be preserved and maintained throughout the entire video. The background's colors, style, setting, and overall appearance must remain EXACTLY the same as the input image. DO NOT change the background. `
    prompt += `ABSOLUTELY CRITICAL - NO PRODUCT USAGE: This is a detail shot, NOT a usage shot. DO NOT show the product being used or operated. Show the product in a static or nearly static state, focusing on details. The product should appear still or with very minimal movement, emphasizing details rather than function. `
    prompt += `ABSOLUTELY FORBIDDEN - NO OBJECTS ON PRODUCT: DO NOT place any other products, objects, items, or things on top of or above the product. The product must remain clear and unobstructed. DO NOT show anything being placed on the product, stacked on the product, or positioned above the product. The product surface must remain empty and clear throughout the entire video. `
    prompt += `Emphasize product details, textures, materials, buttons, screens, design elements, or specific features. `
    prompt += `Product may be shown partially or in close-up - this is different from the full shot which shows the entire product. `
    prompt += `NO hands, NO human interaction, NO product usage - product only, isolated product detail shot. `
    prompt += `CRITICAL: Slow motion effect - very slow, smooth, cinematic camera movement around the product. `
    prompt += `ABSOLUTELY CRITICAL - HORIZONTAL CAMERA MOVEMENT ONLY: Camera movement must be HORIZONTAL ONLY - slow horizontal rotation around the product (left-right), gentle horizontal panning (left-right), or subtle horizontal angle changes. DO NOT move the camera up or down. DO NOT use vertical camera movement. DO NOT tilt the camera up or down. Keep the camera at the same height level throughout the entire video. Only horizontal (left-right) camera movement is allowed. `
    prompt += `Slow-motion detail reveal - camera slowly moves horizontally around the product (left-right only), very slow horizontal panning motion, slow horizontal rotation. DO NOT move camera vertically. `
    prompt += `The movement must be extremely slow and smooth, like cinematic slow-motion footage, but HORIZONTAL ONLY. `
    prompt += `Slow horizontal camera rotation (left-right only) to showcase product details in slow motion. DO NOT use vertical camera movement. `
    prompt += `The product itself should be relatively still - only the camera moves slowly in horizontal direction. `
    prompt += `DO NOT show the product being used or operated - this is a detail showcase, not a usage demonstration. `
    prompt += `${commonRules}`
  } else {
    // 세 번째 이미지: 다른 각도로 제품을 정적 상태로 유지하고 카메라만 움직임
    prompt = `${productName} product from different angle video. `
    prompt += `ABSOLUTELY CRITICAL - VIDEO DURATION: This video MUST be exactly ${duration} seconds long. NOT ${duration * 3} seconds, NOT the full TTS duration, but EXACTLY ${duration} seconds. The total TTS duration is ${duration * 3} seconds, and this is only 1/3 of it. This video segment must be exactly ${duration} seconds. DO NOT make it longer than ${duration} seconds. DO NOT make it the full TTS duration. `
    prompt += `ABSOLUTELY CRITICAL - PRODUCT PRESERVATION: The product shown in the input image must appear EXACTLY as it is - same shape, same size, same proportions, same design, same colors, same textures. DO NOT modify, deform, distort, or change the product in any way. The product must be IDENTICAL to the input image. `
    prompt += `ABSOLUTELY CRITICAL - BACKGROUND PRESERVATION: The background shown in the input image MUST be preserved and maintained throughout the entire video. The background's colors, style, setting, and overall appearance must remain EXACTLY the same as the input image. DO NOT change the background. `
    prompt += `ABSOLUTELY CRITICAL - STATIC PRODUCT, CAMERA MOVEMENT ONLY: The product must remain COMPLETELY STATIC and UNTOUCHED throughout the entire video. DO NOT show the product being used, operated, touched, moved, or manipulated in any way. DO NOT show hands touching or operating the product. The product must stay in the exact same position and state as shown in the input image. ONLY the camera should move - smooth, horizontal camera movement only. `
    prompt += `ABSOLUTELY CRITICAL - HORIZONTAL CAMERA MOVEMENT ONLY: Camera movement must be HORIZONTAL ONLY - slow horizontal rotation around the product from a different angle (left-right), gentle horizontal panning (left-right), or subtle horizontal angle changes. DO NOT move the camera up or down. DO NOT use vertical camera movement. DO NOT tilt the camera up or down. Keep the camera at the same height level throughout the entire video. Only horizontal (left-right) camera movement is allowed. `
    prompt += `ABSOLUTELY FORBIDDEN - NO OBJECTS ON PRODUCT: DO NOT place any other products, objects, items, or things on top of or above the product. The product must remain clear and unobstructed. DO NOT show anything being placed on the product, stacked on the product, or positioned above the product. The product surface must remain empty and clear throughout the entire video. `
    prompt += `Show the product in a static state with smooth, horizontal-only camera movement from a different angle. The product must remain completely still while the camera moves horizontally. `
    prompt += `Smooth, natural, horizontal-only camera movement from different angles - slow horizontal rotation around the product (left-right), gentle horizontal panning (left-right), or subtle horizontal angle changes. The camera height must remain constant - no vertical movement. The product must remain completely still. `
    prompt += `NO hands, NO human interaction, NO product usage, NO product operation - product only, static product with camera movement from different angles. `
    prompt += `${commonRules}`
  }

  return prompt
}

// 레거시 함수 (호환성 유지)
export async function generateVideoPromptFor3Scenes(
  sceneType: "product" | "closeup" | "angle",
  productName: string,
  productDescription?: string,
  script?: string,
  apiKey?: string
): Promise<string> {
  // 새로운 함수로 변환
  const imageIndex = sceneType === "product" ? 0 : sceneType === "closeup" ? 1 : 2
  return generateVideoPromptForImage(imageIndex, productName, productDescription)
}

// 기본 프롬프트 생성 함수 (폴백용 - 레거시)
function generateBasicVideoPrompt(
  sceneType: "product" | "closeup" | "angle",
  productName: string,
  productDescription?: string
): string {
  const needsHands = needsHandsInImage(productName, productDescription)
  const name = productName.toLowerCase()
  const description = (productDescription || "").toLowerCase()
  const combined = `${name} ${description}`
  
  let prompt = ""
  
  if (sceneType === "product") {
    prompt = `${productName} product showcase. `
    if (needsHands) {
      prompt += `Hands naturally using or holding the product. `
    }
    if (combined.includes("청소기") || combined.includes("vacuum")) {
      prompt += `Product being used on the floor, smooth horizontal movement, natural cleaning motion, camera follows the product. `
    } else if (combined.includes("믹서") || combined.includes("blender") || combined.includes("주방")) {
      prompt += `Product being used on kitchen counter, gentle rotation or operation, natural kitchen usage. `
    } else if (combined.includes("화장품") || combined.includes("cosmetic")) {
      prompt += `Product on vanity, gentle reveal, smooth camera movement around the product. `
    } else {
      prompt += `Product being shown naturally, smooth camera movement, professional presentation. `
    }
    prompt += `Full product visible, medium shot, duration: 4-5 seconds, natural pacing. `
  } else if (sceneType === "closeup") {
    prompt = `${productName} product close-up detail shot. `
    if (needsHands) {
      prompt += `Hands holding the product, showing product details. `
    }
    if (combined.includes("청소기") || combined.includes("vacuum")) {
      prompt += `Close-up of product head or nozzle, smooth zoom in, showing product mechanism or features. `
    } else if (combined.includes("믹서") || combined.includes("blender")) {
      prompt += `Close-up of product blades or container, smooth zoom in, showing product quality. `
    } else if (combined.includes("화장품") || combined.includes("cosmetic")) {
      prompt += `Close-up of product texture or packaging, smooth zoom in, showing product details. `
    } else {
      prompt += `Close-up of product key features, smooth zoom in, showing product details. `
    }
    prompt += `Extreme close-up, detail shot, duration: 4-5 seconds, natural pacing. `
  } else {
    prompt = `${productName} product from different angle. `
    if (needsHands) {
      prompt += `Hands using the product from different perspective. `
    }
    if (combined.includes("청소기") || combined.includes("vacuum")) {
      prompt += `Product viewed from side or top angle, smooth camera rotation, showing product from different perspective. `
    } else if (combined.includes("믹서") || combined.includes("blender")) {
      prompt += `Product viewed from above or side, smooth camera movement, showing product design. `
    } else if (combined.includes("화장품") || combined.includes("cosmetic")) {
      prompt += `Product viewed from different angle, smooth camera rotation, showing product elegance. `
    } else {
      prompt += `Product viewed from different angle, smooth camera rotation, showing product design. `
    }
    prompt += `Different camera angle, smooth rotation, duration: 4-5 seconds, natural pacing. `
  }
  
  prompt += `Smooth motion, natural movement, no sudden changes. `
  prompt += `High quality, professional video, 9:16 vertical format. `
  prompt += `No text, no letters, no face visible.`
  
  return prompt
}

// 이미지를 영상으로 변환 (wan-video/wan-2.2-i2v-fast 모델 사용)
// sample_shift 파라미터 추가 (TTS 길이에 맞게 설정)
export async function convertImageToVideoWithWan(
  imageUrl: string,
  prompt: string, // 프롬프트 (필수)
  audioUrl?: string, // 오디오 URL (선택, wan-2.2-i2v-fast는 오디오 불필요)
  replicateApiKey?: string,
  duration?: number, // 영상 길이 (초 단위, 선택) - 레거시 호환성
  sampleShift?: number // sample_shift 값 (TTS 길이에 맞게 설정, 선택)
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
    
    // wan-2.2-i2v-fast 모델 입력: 이미지, 프롬프트, sample_shift
    // sample_shift는 TTS 길이에 맞게 설정되어야 함
    const modelInput: any = {
      image: validImageUrl, // 이미지 URL (공개 접근 가능해야 함, 9:16 비율)
      prompt: prompt, // 프롬프트 (필수)
    }
    
    // sample_shift가 제공되면 추가 (TTS 길이에 맞게 설정)
    if (sampleShift !== undefined && sampleShift > 0) {
      modelInput.sample_shift = sampleShift
      console.log(`[Shopping] ✅ sample_shift 설정: ${sampleShift} (TTS 길이 기반)`)
    } else {
      // sample_shift가 없으면 기본값 12 사용
      modelInput.sample_shift = 12
      console.log(`[Shopping] ⚠️ sample_shift가 제공되지 않아 기본값 12 사용`)
    }
    
    // duration은 레거시 호환성을 위해 로그만 남김 (실제로는 sample_shift 사용)
    if (duration !== undefined && duration > 0) {
      console.log(`[Shopping] 📝 duration 파라미터: ${duration}초 (참고용, 실제로는 sample_shift 사용)`)
    }
    
    console.log(`[Shopping] Replicate API URL:`, apiUrl)
    console.log(`[Shopping] Input (duration 포함):`, JSON.stringify(modelInput, null, 2))
    
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

// 대본 길이에 맞춰 3개 이미지를 영상으로 변환
// scriptLines: TTS 오디오의 실제 시간 정보 (각 장면의 정확한 duration 계산용)
export async function convertImagesToVideosWithScript(
  imageUrls: string[],
  script: string,
  productName: string,
  replicateApiKey?: string,
  productDescription?: string,
  scriptLines?: Array<{ startTime: number; endTime: number; text: string }> // TTS 시간 정보 (선택)
): Promise<Array<{ index: number; videoUrl: string; duration: number; sceneScript: string }>> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다.")
  }

  if (imageUrls.length !== 3) {
    throw new Error("이미지는 정확히 3개여야 합니다.")
  }

  try {
    console.log("[Shopping] 대본 기반 3개 이미지 영상 변환 시작")
    console.log("[Shopping] 대본 전체 길이:", script.length, "자")
    
    // 1. 대본을 3개 장면으로 나누기
    const scenes = await splitScriptIntoScenes(script)
    console.log("[Shopping] 대본 3분할 완료, 각 장면 길이:")
    scenes.forEach((scene, index) => {
      console.log(`  장면 ${index + 1}: ${scene.length}자 - "${scene.substring(0, 50)}..."`)
    })
    
    // 2. 각 장면의 길이 계산
    // scriptLines가 있으면 실제 TTS 오디오 시간을 사용, 없으면 글자 수 기반 계산
    let sceneDurations: number[]
    
    if (scriptLines && scriptLines.length > 0) {
      // TTS 오디오의 실제 시간 정보 사용
      console.log("[Shopping] TTS 오디오 시간 정보 사용하여 duration 계산")
      const linesPerScene = Math.ceil(scriptLines.length / scenes.length)
      sceneDurations = []
      
      for (let i = 0; i < scenes.length; i++) {
        const startLineIndex = i * linesPerScene
        const endLineIndex = Math.min((i + 1) * linesPerScene, scriptLines.length)
        
        if (startLineIndex < scriptLines.length) {
          const startTime = scriptLines[startLineIndex].startTime / 1000 // 초 단위
          const endTime = endLineIndex < scriptLines.length
            ? scriptLines[endLineIndex - 1].endTime / 1000
            : scriptLines[scriptLines.length - 1].endTime / 1000
          const duration = Math.max(3, Math.ceil(endTime - startTime)) // 최소 3초
          sceneDurations.push(duration)
          console.log(`[Shopping] 장면 ${i + 1} 길이: ${scenes[i].length}자 → ${duration}초 (TTS 오디오 시간 기반)`)
        } else {
          // 폴백: 글자 수 기반
          const charactersPerSecond = 6.7
          const duration = Math.max(3, Math.ceil(scenes[i].length / charactersPerSecond))
          sceneDurations.push(duration)
          console.log(`[Shopping] 장면 ${i + 1} 길이: ${scenes[i].length}자 → ${duration}초 (글자 수 기반, 폴백)`)
        }
      }
    } else {
      // 글자 수 기반 계산 (폴백)
      console.log("[Shopping] 글자 수 기반으로 duration 계산 (TTS 시간 정보 없음)")
      const charactersPerSecond = 6.7
      sceneDurations = scenes.map((scene, index) => {
        const duration = Math.max(3, Math.ceil(scene.length / charactersPerSecond)) // 최소 3초
        console.log(`[Shopping] 장면 ${index + 1} 길이: ${scene.length}자 → ${duration}초 (글자 수 기반)`)
        return duration
      })
    }
    
    const totalDuration = sceneDurations.reduce((sum, dur) => sum + dur, 0)
    console.log(`[Shopping] 전체 영상 길이: ${totalDuration}초 (대본: ${script.length}자)`)
    console.log(`[Shopping] 각 장면 duration:`, sceneDurations.map((d, i) => `장면${i + 1}=${d}초`).join(", "))
    
    // 3. 각 이미지를 해당 장면 길이에 맞게 영상으로 변환
    const videoResults: Array<{ index: number; videoUrl: string; duration: number; sceneScript: string }> = []
    
    for (let i = 0; i < 3; i++) {
      const imageUrl = imageUrls[i]
      const sceneScript = scenes[i]
      const duration = sceneDurations[i]
      
      console.log(`[Shopping] 장면 ${i + 1}/3 영상 변환 시작 (길이: ${duration}초)`)
      console.log(`[Shopping] 장면 대본: "${sceneScript.substring(0, 50)}..."`)
      
      // 대본 기반으로 영상 생성 프롬프트 생성
      const videoPrompt = await generateVideoPromptFromScript(sceneScript, productName, duration, productDescription)
      console.log(`[Shopping] 영상 프롬프트: ${videoPrompt}`)
      
      // 이미지를 영상으로 변환
      const videoUrl = await convertImageToVideoWithWan(
        imageUrl,
        videoPrompt,
        undefined, // audioUrl
        REPLICATE_API_TOKEN,
        duration // duration 전달
      )
      
      console.log(`[Shopping] ✅ 장면 ${i + 1} 영상 변환 완료:`, videoUrl)
      console.log(`[Shopping] 📊 장면 ${i + 1} 정보: duration=${duration}초, URL=${videoUrl.substring(0, 50)}...`)
      
      videoResults.push({
        index: i,
        videoUrl,
        duration,
        sceneScript
      })
    }
    
    console.log(`[Shopping] 대본 기반 3개 영상 변환 완료 (총 ${totalDuration}초)`)
    return videoResults
  } catch (error) {
    console.error("[Shopping] 이미지 영상 변환 실패:", error)
    throw error
  }
}

// 3개의 영상을 하나로 합치기 (클라이언트 측에서 처리)
// MediaRecorder API를 사용하여 각 영상을 순차적으로 녹화하여 합칩니다.
// 각 영상의 duration 정보를 받아서 해당 길이만큼 반복 재생합니다.
export async function mergeVideos(
  videoUrls: string[],
  durations?: number[] // 각 영상의 목표 duration (초 단위)
): Promise<string> {
  if (videoUrls.length === 0) {
    throw new Error("합칠 영상이 없습니다.")
  }
  
  if (videoUrls.length === 1) {
    return videoUrls[0]
  }
  
  console.log(`[Shopping] ${videoUrls.length}개 영상 합치기 시작`)
  
  // 각 영상을 비디오 엘리먼트로 로드
  const videoPromises = videoUrls.map((url, index) => {
    return new Promise<HTMLVideoElement>((resolve, reject) => {
      const video = document.createElement("video")
      video.crossOrigin = "anonymous"
      video.preload = "auto"
      video.muted = true // 음소거하여 자동 재생 가능하게
      video.playsInline = true
      video.src = url
      
      video.onloadedmetadata = () => {
        console.log(`[Shopping] 영상 ${index + 1} 로드 완료: ${video.duration.toFixed(2)}초 (${video.videoWidth}x${video.videoHeight})`)
        resolve(video)
      }
      
      video.onerror = (error) => {
        console.error(`[Shopping] 영상 ${index + 1} 로드 실패:`, error)
        reject(new Error(`영상 ${index + 1} 로드 실패: ${url}`))
      }
    })
  })
  
  const videos = await Promise.all(videoPromises)
  
  // 전체 길이 계산
  const totalDuration = videos.reduce((sum, video) => sum + video.duration, 0)
  console.log(`[Shopping] 전체 영상 길이: ${totalDuration.toFixed(2)}초`)
  
  // 첫 번째 영상의 해상도 사용
  const width = videos[0].videoWidth || 540
  const height = videos[0].videoHeight || 960
  
  // Canvas 생성
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  
  if (!ctx) {
    throw new Error("Canvas 컨텍스트를 가져올 수 없습니다.")
  }
  
  // MediaRecorder 설정
  const stream = canvas.captureStream(30) // 30fps
  let mimeType = 'video/webm;codecs=vp9'
  
  // 지원되는 MIME 타입 확인
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm'
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/mp4'
    }
  }
  
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: mimeType,
    videoBitsPerSecond: 2500000 // 2.5Mbps
  })
  
  const chunks: Blob[] = []
  
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data)
      console.log(`[Shopping] 데이터 청크 수신: ${(event.data.size / 1024).toFixed(2)}KB`)
    }
  }
  
  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const mergedBlob = new Blob(chunks, { type: mimeType })
      const mergedUrl = URL.createObjectURL(mergedBlob)
      console.log(`[Shopping] 영상 합치기 완료: ${(mergedBlob.size / 1024 / 1024).toFixed(2)}MB`)
      // 스트림 정리
      stream.getTracks().forEach(track => track.stop())
      resolve(mergedUrl)
    }
    
    mediaRecorder.onerror = (event) => {
      console.error("[Shopping] MediaRecorder 오류:", event)
      stream.getTracks().forEach(track => track.stop())
      reject(new Error("영상 녹화 중 오류가 발생했습니다."))
    }
    
    // 녹화 시작
    mediaRecorder.start(100) // 100ms마다 데이터 수집
    console.log("[Shopping] 영상 녹화 시작...")
    
    // 각 영상을 순차적으로 재생하면서 Canvas에 그리기
    let currentVideoIndex = 0
    let animationFrameId: number | null = null
    
    // 각 영상의 목표 duration (초 단위)
    const targetDurations = durations || videos.map(v => v.duration) // duration이 없으면 실제 영상 길이 사용
    
    const playNextVideo = async () => {
      if (currentVideoIndex >= videos.length) {
        // 모든 영상 재생 완료
        console.log("[Shopping] 모든 영상 재생 완료, 녹화 종료 중...")
        setTimeout(() => {
          if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId)
          }
          mediaRecorder.stop()
        }, 500) // 마지막 프레임을 위해 약간 대기
        return
      }
      
      const video = videos[currentVideoIndex]
      const targetDuration = targetDurations[currentVideoIndex] || video.duration
      const videoActualDuration = video.duration
      
      console.log(`[Shopping] 영상 ${currentVideoIndex + 1} 재생 시작: 실제 길이 ${videoActualDuration.toFixed(2)}초, 목표 길이 ${targetDuration.toFixed(2)}초`)
      
      video.currentTime = 0
      
      // 목표 duration까지 재생할 시간 추적
      let elapsedTime = 0
      const startTime = Date.now()
      let videoLoopCount = 0 // 영상 반복 횟수
      
      // 영상 재생 완료 이벤트 리스너 (반복 재생용)
      const onVideoEnded = () => {
        // 목표 duration에 도달했는지 확인
        elapsedTime = (Date.now() - startTime) / 1000
        
        if (elapsedTime >= targetDuration) {
          // 목표 duration 도달, 다음 영상으로
          video.removeEventListener('ended', onVideoEnded)
          if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId)
          }
          currentVideoIndex++
          playNextVideo()
        } else {
          // 목표 duration에 도달하지 않았으면 영상 반복 재생
          videoLoopCount++
          video.currentTime = 0
          video.play().catch((error) => {
            console.error(`[Shopping] 영상 반복 재생 실패:`, error)
            // 재생 실패해도 다음 영상으로 진행
            video.removeEventListener('ended', onVideoEnded)
            if (animationFrameId !== null) {
              cancelAnimationFrame(animationFrameId)
            }
            currentVideoIndex++
            playNextVideo()
          })
        }
      }
      
      video.addEventListener('ended', onVideoEnded)
      
      const drawFrame = () => {
        elapsedTime = (Date.now() - startTime) / 1000
        
        // 목표 duration에 도달했는지 확인
        if (elapsedTime >= targetDuration) {
          // 목표 duration 도달, 다음 영상으로
          video.pause()
          video.removeEventListener('ended', onVideoEnded)
          if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId)
          }
          currentVideoIndex++
          playNextVideo()
          return
        }
        
        // 목표 duration이 실제 영상 길이보다 짧은 경우, 특정 시간에 도달하면 중지
        if (targetDuration < videoActualDuration && video.currentTime >= targetDuration) {
          video.pause()
          video.removeEventListener('ended', onVideoEnded)
          if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId)
          }
          currentVideoIndex++
          playNextVideo()
          return
        }
        
        if (video.ended || video.paused) {
          return
        }
        
        try {
          // Canvas에 현재 프레임 그리기
          ctx.drawImage(video, 0, 0, width, height)
          
          // 다음 프레임 요청
          animationFrameId = requestAnimationFrame(drawFrame)
        } catch (error) {
          console.error(`[Shopping] 프레임 그리기 오류:`, error)
          // 오류가 발생해도 계속 진행
          animationFrameId = requestAnimationFrame(drawFrame)
        }
      }
      
      // 영상 재생 시작
      try {
        await video.play()
        drawFrame()
      } catch (error) {
        console.error(`[Shopping] 영상 ${currentVideoIndex + 1} 재생 실패:`, error)
        // 재생 실패해도 다음 영상으로 진행
        video.removeEventListener('ended', onVideoEnded)
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
        }
        currentVideoIndex++
        playNextVideo()
      }
    }
    
    // 첫 번째 영상 재생 시작
    playNextVideo()
  })
}

export async function generateShoppingScript(
  productName: string, 
  productDescription: string, 
  apiKey?: string,
  duration: 12 | 15 | 20 | 30 = 12
) {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.")
  }

  // 영상 길이에 따른 대본 길이 계산 (초당 약 6.7자 기준)
  const targetLength = Math.round(duration * 6.7)

  // 재시도 로직 (최대 3번)
  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
              content: `당신은 쇼핑 영상 대본 작성 전문가입니다. 제품을 홍보하는 ${duration}초 길이의 쇼츠 영상 대본을 작성해주세요.

🟣 대본 작성 규칙:

1. 강력한 후킹 - 궁금증 유발 (최우선 필수):
   - 시청자의 관심을 즉시 끄는 강력한 시작으로 반드시 시작
   - 호기심과 궁금증을 유발하는 문구 필수 사용
   - 질문으로 시작하거나, 반전이나 놀라운 사실을 제시
   - 예시: "이거 몰라서 업체 부를뻔했어요", "이거 하나면 끝!", "이거 진짜 신기해요", "이거 하나로 모든 게 해결됐어요", "이거 안 쓰면 손해예요", "이거 진짜 꿀템이에요", "이거 하나로 고민 끝!", "이거 진짜 대박이에요", "이거 몰랐으면 큰일날뻔했어요" 등
   - 문제 상황을 제시하고 제품이 해결책임을 암시하는 구조 권장
   - "이거 하나면", "이거 하나로", "이거 안 쓰면" 같은 강력한 표현 활용

2. 자연스러운 대화체:
   - 친근하고 자연스러운 말투 사용
   - 어른분들도 쉽게 이해할 수 있는 명확하고 간단한 표현
   - 전문 용어나 복잡한 표현은 피하고, 일상적인 쉬운 말로 작성

3. 끊기지 않는 자연스러운 연결:
   - 모든 문장을 자연스럽게 연결
   - 마침표(.)를 최소화하고, 가능하면 쉼표(,)나 연결어로 문장을 이어가기
   - 문장 사이에 자연스러운 연결어 사용: "그리고", "또한", "게다가", "특히" 등

4. 길이 제한 (매우 중요):
   - 공백 포함 정확히 ${targetLength}자로 작성 (${duration}초 길이에 맞춤)
   - 대본 작성 후 반드시 글자 수를 세어서 정확히 ${targetLength}자인지 확인
   - ${targetLength}자가 아니면 다시 작성하여 정확히 ${targetLength}자가 되도록 조정

5. 절대 금지 사항 (매우 중요):
   - 문장 2개 이상 금지: 마침표(.)로 문장을 나누지 말고, 하나의 긴 문장으로 자연스럽게 연결 (예: "~했답니다. 꿀템이에요" 같은 형식 금지)
   - 평범한 단어 금지: "가성비 너무 좋아요", "정말 좋아요", "완전 추천해요" 같은 평범하고 흔한 표현 절대 사용 금지
   - 광고 티나는 문장 금지: "지금 당장 구매하세요!", "구매하러 가세요", "지금 바로 주문하세요" 같은 직접적인 구매 유도 문구 절대 사용 금지
   - 대본은 자연스럽고 진솔한 추천 느낌으로 작성하되, 광고처럼 보이지 않아야 함

출력 형식:
- 번호나 제목 없이 순수한 대본 텍스트만 작성
- 자연스러운 대화체로 작성
- 모든 문장이 자연스럽게 연결되도록 작성
- 어른분들도 쉽게 이해할 수 있는 명확하고 간단한 표현 사용
- 반드시 궁금증을 유발하는 강력한 후킹으로 시작`,
            },
            {
              role: "user",
              content: `제품명: ${productName}
제품 설명: ${productDescription}

위 제품을 홍보하는 ${duration}초 쇼츠 영상 대본을 작성해주세요.

반드시 다음 규칙을 지켜주세요:
1. 강력한 후킹으로 시작 - 궁금증 유발 필수 (최우선):
   - 시청자의 관심을 즉시 끄는 강력한 문구로 반드시 시작
   - 호기심과 궁금증을 유발하는 표현 필수 사용
   - 질문으로 시작하거나, 반전이나 놀라운 사실을 제시
   - 예시: "이거 몰라서 업체 부를뻔했어요", "이거 하나면 끝!", "이거 진짜 신기해요", "이거 하나로 모든 게 해결됐어요", "이거 안 쓰면 손해예요", "이거 진짜 꿀템이에요", "이거 하나로 고민 끝!", "이거 진짜 대박이에요" 등
   - 문제 상황을 제시하고 제품이 해결책임을 암시하는 구조 권장
   - "이거 하나면", "이거 하나로", "이거 안 쓰면" 같은 강력한 표현 활용
2. 자연스러운 대화체 사용 - 어른분들도 쉽게 이해할 수 있는 명확하고 간단한 표현
3. 끊기지 않고 자연스럽게 연결
   - 문장 사이에 긴 텀을 두지 말고, 자연스러운 연결어로 이어가기
   - 마침표(.)를 최소화하고, 가능하면 쉼표(,)나 연결어로 문장을 이어가기
4. 전문 용어나 복잡한 표현은 피하고, 일상적인 쉬운 말로 작성
5. 전체 길이 공백 포함 정확히 ${targetLength}자로 작성 (${duration}초 길이에 맞춤, 필수)
   - 대본 작성 후 반드시 글자 수를 세어서 정확히 ${targetLength}자인지 확인
   - ${targetLength}자가 아니면 다시 작성하여 정확히 ${targetLength}자가 되도록 조정
6. 대본은 반드시 끝까지 완성되어야 하며, 마지막에 끊기면 안 됨
7. 반드시 궁금증을 유발하는 강력한 후킹으로 시작해야 함

절대 금지 사항 (매우 중요):
- 문장 2개 이상 금지: 마침표(.)로 문장을 나누지 말고, 하나의 긴 문장으로 자연스럽게 연결 (예: "~했답니다. 꿀템이에요" 같은 형식 절대 금지)
- 평범한 단어 금지: "가성비 너무 좋아요", "정말 좋아요", "완전 추천해요", "가성비 최고예요" 같은 평범하고 흔한 표현 절대 사용 금지
- 광고 티나는 문장 금지: "지금 당장 구매하세요!", "구매하러 가세요", "지금 바로 주문하세요", "구매 링크는 설명란에" 같은 직접적인 구매 유도 문구 절대 사용 금지
- 대본은 자연스럽고 진솔한 추천 느낌으로 작성하되, 광고처럼 보이지 않아야 함`,
            },
          ],
          max_tokens: duration <= 15 ? 200 : duration <= 20 ? 250 : 300,
          temperature: 0.8,
        }),
      })

      if (!response.ok) {
        // 에러 응답 본문 읽기
        let errorMessage = `API 호출 실패: ${response.status}`
        try {
          const errorData = await response.text()
          if (errorData) {
            const errorJson = JSON.parse(errorData)
            errorMessage = errorJson.error?.message || errorData || errorMessage
          }
        } catch (e) {
          // 에러 응답 파싱 실패 시 무시
        }
        
        // 502, 503, 504, 429 에러는 재시도 가능
        if ((response.status === 502 || response.status === 503 || response.status === 504 || response.status === 429) && attempt < maxRetries) {
          const delay = attempt * 1000 // 1초, 2초, 3초 대기
          console.log(`[Shopping Script] 재시도 ${attempt}/${maxRetries} - ${delay}ms 후 재시도...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          lastError = new Error(errorMessage)
          continue
        }
        
        // 재시도 불가능한 에러 또는 마지막 시도
        if (response.status === 401) {
          throw new Error("OpenAI API 키가 유효하지 않습니다. 설정에서 API 키를 확인해주세요.")
        } else if (response.status === 429) {
          throw new Error("OpenAI API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.")
        } else if (response.status === 502 || response.status === 503 || response.status === 504) {
          throw new Error(`OpenAI 서버 일시적 오류 (${response.status}). 잠시 후 다시 시도해주세요.`)
        } else {
          throw new Error(errorMessage)
        }
      }

      // 성공 시 데이터 처리
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
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // 네트워크 오류나 타임아웃도 재시도
      if (attempt < maxRetries && (error instanceof TypeError || (error instanceof Error && error.message.includes("fetch")))) {
        const delay = attempt * 1000
        console.log(`[Shopping Script] 네트워크 오류, 재시도 ${attempt}/${maxRetries} - ${delay}ms 후 재시도...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // 마지막 시도 실패 시 에러 throw
      if (attempt === maxRetries) {
        throw lastError || error
      }
    }
  }

  // 모든 재시도 실패
  throw lastError || new Error("대본 생성에 실패했습니다. 여러 번 시도했지만 실패했습니다.")
}

// 대본을 파트별로 분석하는 함수
export async function analyzeScriptParts(
  script: string,
  apiKey?: string
): Promise<Array<{ part: string; text: string; startIndex: number; endIndex: number }>> {
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
            content: `당신은 쇼핑 영상 대본 분석 전문가입니다. 주어진 대본을 다음 파트로 분석해주세요:

1. 인트로/후킹: 시청자의 관심을 끄는 시작 부분
2. 제품 소개: 제품에 대한 기본 정보
3. 제품 장점: 제품의 특징과 장점
4. 마무리: 마무리 멘트

각 파트의 시작 위치와 끝 위치를 정확히 찾아서 JSON 형식으로 반환해주세요.

JSON 형식:
{
  "parts": [
    {
      "part": "인트로/후킹",
      "text": "해당 파트의 텍스트",
      "startIndex": 시작_인덱스,
      "endIndex": 끝_인덱스
    },
    ...
  ]
}`,
          },
          {
            role: "user",
            content: `다음 대본을 분석해주세요:\n\n${script}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("응답 내용이 없습니다.")
    }

    const parsed = JSON.parse(content)
    return parsed.parts || []
  } catch (error) {
    console.error("대본 분석 실패:", error)
    // 분석 실패 시 기본 분할 반환
    const parts = []
    const sentences = script.split(/[.!?。！？]\s*/).filter(s => s.trim().length > 0)
    const totalSentences = sentences.length
    
    if (totalSentences > 0) {
      const introEnd = Math.ceil(totalSentences * 0.25)
      const introEndIndex = script.indexOf(sentences[Math.min(introEnd - 1, sentences.length - 1)]) + sentences[Math.min(introEnd - 1, sentences.length - 1)].length
      
      const productEnd = Math.ceil(totalSentences * 0.5)
      const productEndIndex = script.indexOf(sentences[Math.min(productEnd - 1, sentences.length - 1)]) + sentences[Math.min(productEnd - 1, sentences.length - 1)].length
      
      const advantageEnd = Math.ceil(totalSentences * 0.75)
      const advantageEndIndex = script.indexOf(sentences[Math.min(advantageEnd - 1, sentences.length - 1)]) + sentences[Math.min(advantageEnd - 1, sentences.length - 1)].length
      
      parts.push(
        { part: "인트로/후킹", text: script.substring(0, introEndIndex), startIndex: 0, endIndex: introEndIndex },
        { part: "제품 소개", text: script.substring(introEndIndex, productEndIndex), startIndex: introEndIndex, endIndex: productEndIndex },
        { part: "제품 장점", text: script.substring(productEndIndex, advantageEndIndex), startIndex: productEndIndex, endIndex: advantageEndIndex },
        { part: "마무리", text: script.substring(advantageEndIndex), startIndex: advantageEndIndex, endIndex: script.length }
      )
    }
    
    return parts.filter(p => p.text.trim().length > 0)
  }
}

// 추가 프롬프트를 반영하여 이미지 프롬프트를 AI로 재작성
export async function refineImagePromptWithCustomInput(
  originalPrompt: string,
  customPrompt: string,
  productName: string,
  productDescription?: string,
  apiKey?: string
): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    // API 키가 없으면 단순히 연결
    return `${originalPrompt}, ${customPrompt}`
  }

  try {
    console.log("[Shopping] AI를 사용하여 프롬프트 재작성 시작")
    console.log("[Shopping] 원본 프롬프트:", originalPrompt.substring(0, 100))
    console.log("[Shopping] 추가 프롬프트:", customPrompt)

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
            content: `당신은 이미지 생성 프롬프트 전문가입니다. 사용자가 제공한 기존 프롬프트와 추가 요구사항을 바탕으로, Replicate의 nano-banana 모델에 최적화된 영어 프롬프트를 작성해주세요.

중요 규칙:
- 기존 프롬프트의 핵심 내용은 유지하되, 추가 요구사항을 자연스럽게 통합
- 제품의 실제 모습을 정확하게 보여주는 것이 중요
- 영어로 작성하되, 한국어 요구사항의 의미를 정확히 반영
- 구체적이고 시각적으로 묘사할 수 있는 표현 사용
- 프롬프트는 명확하고 간결하게 작성
- 제품 이미지가 참고 이미지로 제공된 경우, 원본 제품의 기능, 버튼, 스위치, 조절 장치를 정확하게 유지해야 함
- 원본 제품에 없는 새로운 기능, 버튼, 스위치, 조절 장치를 절대 추가하지 않음 (no additional features, no extra buttons, no new switches, no new controls)
- 제품의 원본 디자인과 구조를 정확하게 보존 (exact product design preservation, maintain original product structure)`,
          },
          {
            role: "user",
            content: `기존 프롬프트:
${originalPrompt}

추가 요구사항 (한국어):
${customPrompt}

제품명: ${productName}
${productDescription ? `제품 설명: ${productDescription}` : ''}

위 정보를 바탕으로 개선된 이미지 생성 프롬프트를 작성해주세요. 기존 프롬프트의 핵심은 유지하되, 추가 요구사항을 자연스럽게 통합한 영어 프롬프트를 작성해주세요.`,
          },
        ],
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Shopping] 프롬프트 재작성 API 오류:", errorText)
      // API 오류 시 단순히 연결
      return `${originalPrompt}, ${customPrompt}`
    }

    const data = await response.json()
    const refinedPrompt = data.choices[0]?.message?.content?.trim()

    if (!refinedPrompt) {
      console.warn("[Shopping] 프롬프트 재작성 응답이 비어있음, 기본 연결 사용")
      return `${originalPrompt}, ${customPrompt}`
    }

    console.log("[Shopping] ✅ AI가 재작성한 프롬프트:", refinedPrompt.substring(0, 150))
    return refinedPrompt
  } catch (error) {
    console.error("[Shopping] 프롬프트 재작성 실패:", error)
    // 오류 시 단순히 연결
    return `${originalPrompt}, ${customPrompt}`
  }
}

// 대본에 맞는 이미지 프롬프트 생성 (대본 전체를 분석하여 3개의 프롬프트 생성)
export async function generateImagePromptsFromScript(
  script: string,
  productName: string,
  productDescription: string,
  productImageBase64: string | undefined,
  apiKey?: string
): Promise<Array<{ type: string; prompt: string; description: string; scriptText: string }>> {
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
            content: `당신은 쇼핑 영상 이미지 생성 전문가입니다. 주어진 대본 전체를 분석하여 숏폼 영상 제작을 위한 3장의 이미지 프롬프트를 생성해주세요.

제품 정보:
- 제품명: ${productName}
${productDescription ? `- 제품 설명: ${productDescription}` : ''}

중요 규칙:
- 대본 전체를 읽고 분석하여, 대본의 흐름에 맞게 3장의 이미지를 위한 프롬프트를 생성해야 합니다
- 대본을 단순히 3등분하는 것이 아니라, 대본의 내용과 흐름을 분석하여 적절한 3개의 장면으로 나눠야 합니다
- 제품은 반드시 보존되어야 하며, 제품의 모양과 특징이 정확하게 유지되어야 함
- 제품 이미지가 제공된 경우, 원본 제품 이미지에 있는 기능, 버튼, 디자인 요소만 그대로 유지해야 함
- 원본 제품에 없는 새로운 기능, 버튼, 스위치, 조절 장치 등을 절대 추가하면 안 됨 (no additional features, no extra buttons, no new controls, maintain exact original product design)
- 제품의 원본 디자인과 구조를 정확하게 보존 (exact product design preservation, maintain original product structure)
- 제품 유형에 따라 손이 필요한지 판단:
  * 청소기, 전기기기, 주방용품, 공구 등 사용하는 제품: 손으로 제품을 사용하거나 잡고 있는 모습 포함 (hands using or holding the product)
  * 화장품, 의류, 액세서리 등: 손 없이 제품만 보여주기 (product only, no hands)
- 제품 유형에 따라 적절한 배경과 구도 설정 (매우 중요):
  * 청소기: 바닥 배경, 카펫이나 타일 바닥, 바닥에서 사용하는 각도 (floor level, on the floor, carpet or tile floor)
  * 주방용품: 주방 배경, 조리대 위나 테이블 위, 주방 환경 (kitchen counter, kitchen table, kitchen setting)
  * 화장품: 화장대 배경, 욕실 배경, 화장대 위 (vanity, bathroom, on the vanity)
  * 전자기기: 책상 위나 테이블 위, 사무실 배경 (desk, table, office setting)
  * 의류: 옷걸이, 침대 위, 의자 위 (hanger, on bed, on chair)
- 각 이미지는 대본의 특정 부분과 연결되어야 하며, 해당 부분의 내용을 잘 표현해야 함
- 배경은 제품의 실제 사용 환경에 맞게 설정 (청소기는 바닥, 주방용품은 주방 등)
- 매우 중요: 제품 이미지가 제공된 경우, 제품은 정확하게 보존하되 배경은 참고 이미지와 다르게 생성해야 함 (product must be preserved exactly, but background must be different from the reference image, create a new background that is different from the original image's background, different background setting, different background colors, different background style, do not copy the reference image's background)
- 숏폼 영상 제작용이므로 제품이 명확하게 보여야 함
- 사람 얼굴은 절대 나오면 안 됨 (no face, no head visible)

생성할 이미지 유형:
1. 첫 번째 이미지: 전체 샷 (Full Shot) - 제품 전체가 화면에 완전히 보이는 전체 사진
   - 제품 이미지가 제공된 경우, 원본 제품의 모든 기능, 버튼, 디자인 요소를 정확하게 유지해야 함
   - 원본에 없는 새로운 기능이나 버튼을 절대 추가하지 않음
   - 제품 전체가 화면에 가득 차야 함 (full product visible, entire product fills the frame)
2. 두 번째 이미지: 디테일 샷 (Detail Shot) - 제품 전체가 화면에 가득 차면서 디테일이 강조된 사진 (full product visible, entire product fills the frame, product details emphasized, NOT extreme close-up, NOT macro shot, NOT partial product, entire product must be visible and fill the screen, no hands, no human hands, product only)
   - 제품 전체가 화면에 가득 차야 함 (전체 제품이 보여야 함, 특정 부분만 보이는 것이 아님)
   - 제품의 특징과 디테일을 강조하되, 제품 전체가 화면에 완전히 보여야 함
   - 원본 제품 이미지에 있는 버튼, 스위치, 조절 장치만 그대로 보여줌
   - 원본에 없는 새로운 요소를 절대 추가하지 않음
   - 클로즈업이나 매크로 샷이 아닌, 제품 전체가 화면에 가득 찬 사진
3. 세 번째 이미지: 각도와 배경 다르게 하는 샷 (Different Angle & Background) - 제품은 동일하지만 완전히 다른 각도와 배경의 사진
   - 제품의 원본 디자인과 기능은 그대로 유지하면서 각도와 배경만 변경
   - 원본 제품에 없는 새로운 기능이나 버튼을 절대 추가하지 않음
   - 제품 전체가 화면에 가득 차야 함 (full product visible, entire product fills the frame)

JSON 형식으로 응답:
{
  "images": [
    {
      "type": "전체 샷",
      "prompt": "이미지 생성 프롬프트 (영어) - 제품 전체가 화면에 완전히 보이는 전체 사진, 원본 제품 이미지의 기능과 버튼을 정확하게 유지, 새로운 기능이나 버튼 추가 금지 (maintain exact original product features and buttons, no additional features or buttons)",
      "description": "제품 전체가 화면에 완전히 보이는 전체 사진",
      "scriptText": "이 이미지에 해당하는 대본 부분"
    },
    {
      "type": "디테일 샷",
      "prompt": "이미지 생성 프롬프트 (영어) - 제품 전체가 화면에 가득 차면서 디테일이 강조된 사진 (full product visible, entire product fills the frame, product details emphasized, NOT extreme close-up, NOT macro shot, NOT partial product, entire product must be visible and fill the screen, product texture, materials, buttons, details clearly visible, no hands, no human hands, product only, isolated product, maintain exact original product buttons and features from reference image, no additional buttons or features)",
      "description": "제품 전체가 화면에 가득 차면서 디테일이 강조된 사진 (손 없음, 제품 전체가 보임)",
      "scriptText": "이 이미지에 해당하는 대본 부분"
    },
    {
      "type": "각도와 배경 다르게",
      "prompt": "이미지 생성 프롬프트 (영어) - 제품은 동일하지만 완전히 다른 각도와 배경의 사진, 원본 제품의 기능과 버튼은 그대로 유지 (same product with different angle and background, maintain exact original product features and buttons, no additional features or buttons)",
      "description": "제품은 동일하지만 완전히 다른 각도와 배경의 사진",
      "scriptText": "이 이미지에 해당하는 대본 부분"
    }
  ]
}`,
          },
          {
            role: "user",
            content: `다음 대본 전체를 분석하여 3장의 이미지 프롬프트를 생성해주세요:

${script}

대본의 흐름을 분석하여, 시작 부분, 중간 부분, 마무리 부분에 각각 어울리는 이미지 프롬프트를 생성해주세요. 각 프롬프트는 해당 대본 부분의 내용을 잘 표현해야 합니다.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("응답 내용이 없습니다.")
    }

    const parsed = JSON.parse(content)
    const images = parsed.images || []
    
    // 3개의 프롬프트가 생성되었는지 확인
    if (images.length !== 3) {
      console.warn(`프롬프트가 3개가 아닙니다: ${images.length}개`)
      // 부족한 경우 기본 프롬프트로 채우기
      while (images.length < 3) {
        const index = images.length
        const scriptLength = script.length
        const startIndex = Math.floor((scriptLength / 3) * index)
        const endIndex = index < 2 ? Math.floor((scriptLength / 3) * (index + 1)) : scriptLength
        const scriptPart = script.substring(startIndex, endIndex)
        
        images.push({
          type: index === 0 ? "전체 샷" : index === 1 ? "디테일 샷" : "각도와 배경 다르게",
          prompt: index === 0 
            ? `${productName} product, full shot, entire product visible, maintain exact original product features and buttons from reference image, no additional features or buttons, professional product photography, high quality, 9:16 aspect ratio`
            : index === 1
            ? `${productName} product, extreme close-up macro shot, very zoomed in detail shot, highlighting product features and details, product texture and material visible, only part of product visible in frame, no hands, no human hands, product only, isolated product, maintain exact original product buttons and features from reference image, no additional buttons or features, professional product photography, high quality, 9:16 aspect ratio`
            : `${productName} product, different angle and background, same product from different perspective, maintain exact original product features and buttons, no additional features or buttons, professional product photography, high quality, 9:16 aspect ratio`,
          description: index === 0 ? "제품 전체가 화면에 완전히 보이는 전체 사진" : index === 1 ? "제품의 특징과 디테일이 강조된 클로즈업 사진" : "제품은 동일하지만 완전히 다른 각도와 배경의 사진",
          scriptText: scriptPart
        })
      }
    }
    
    return images.slice(0, 3) // 최대 3개만 반환
  } catch (error) {
    console.error("대본 기반 이미지 프롬프트 생성 실패:", error)
    // 기본 프롬프트 반환 (대본을 3등분)
    const scriptLength = script.length
    return [
      {
        type: "전체 샷",
        prompt: `${productName} product, full shot, entire product visible, professional product photography, high quality, 9:16 aspect ratio, maintain exact original product features and buttons from reference image, no additional features or buttons`,
        description: "제품 전체가 화면에 완전히 보이는 전체 사진",
        scriptText: script.substring(0, Math.floor(scriptLength / 3))
      },
      {
        type: "디테일 샷",
        prompt: `${productName} product, extreme close-up macro shot, very zoomed in detail shot, highlighting product features and details, product texture and material visible, only part of product visible in frame, no hands, no human hands, product only, isolated product, maintain exact original product buttons and features from reference image, no additional buttons or features, professional product photography, high quality, 9:16 aspect ratio`,
        description: "제품의 특징과 디테일이 강조된 매우 확대된 클로즈업 사진 (손 없음)",
        scriptText: script.substring(Math.floor(scriptLength / 3), Math.floor(scriptLength * 2 / 3))
      },
      {
        type: "각도와 배경 다르게",
        prompt: `${productName} product, different angle and background, same product from different perspective, maintain exact original product features and buttons, no additional features or buttons, professional product photography, high quality, 9:16 aspect ratio`,
        description: "제품은 동일하지만 완전히 다른 각도와 배경의 사진",
        scriptText: script.substring(Math.floor(scriptLength * 2 / 3))
      }
    ]
  }
}

// 제품 분석 및 이미지 생성 프롬프트 생성 (레거시 - 사용 안 함)
async function analyzeProductAndGeneratePrompts(
  productName: string,
  productDescription: string,
  productImageBase64: string | undefined,
  apiKey?: string
): Promise<Array<{ type: string; prompt: string; description: string }>> {
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
            content: `당신은 제품 이미지 생성 전문가입니다. 주어진 제품 정보를 분석하여 숏폼 영상 제작용 3장의 이미지를 위한 프롬프트를 생성해주세요.

제품 카테고리 예시: 주방용품, 욕실용품, 청소템, 정리수납, 살림템, 생활용품 등

생성할 이미지 유형:
1. 연출샷: 제품 전체가 잘 보이는 연출 사진 (제품의 전체적인 모습과 사용 맥락을 보여주는 샷, 제품 전체가 화면에 가득 차야 함)
2. 배경 변경: 제품은 동일하지만 완전히 다른 배경의 사진 (제품의 활용 공간을 다양하게 보여주는 샷, 제품 전체가 화면에 가득 차야 함)
3. 디테일샷: 제품 전체가 화면에 가득 차면서 디테일이 강조된 사진 (제품 전체가 보이면서 품질과 특징을 자세히 보여주는 샷, 클로즈업이나 매크로 샷이 아닌 제품 전체가 화면에 가득 찬 사진)

중요 규칙:
- 제품은 반드시 보존되어야 하며, 제품의 모양과 특징이 정확하게 유지되어야 함
- 손이나 사람이 나오지 않아도 됨 (제품 중심)
- 각 이미지는 제품 소개에 최적화되어야 함
- 배경은 제품 카테고리에 맞게 설정
- 숏폼 영상 제작용이므로 제품이 명확하게 보여야 함

JSON 형식으로 응답:
{
  "images": [
    {
      "type": "연출샷",
      "prompt": "이미지 생성 프롬프트 (영어)",
      "description": "이 이미지의 설명"
    },
    {
      "type": "배경 변경",
      "prompt": "이미지 생성 프롬프트 (영어)",
      "description": "이 이미지의 설명"
    },
    {
      "type": "디테일샷",
      "prompt": "이미지 생성 프롬프트 (영어)",
      "description": "이 이미지의 설명"
    }
  ]
}`,
          },
          {
            role: "user",
            content: `제품명: ${productName}
${productDescription ? `제품 설명: ${productDescription}` : ''}
${productImageBase64 ? '제품 이미지가 참고 이미지로 제공됩니다.' : ''}

위 제품을 분석하여 숏폼 영상 제작용 3장의 이미지 프롬프트를 생성해주세요.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("응답 내용이 없습니다.")
    }

    const parsed = JSON.parse(content)
    return parsed.images || []
  } catch (error) {
    console.error("제품 분석 실패:", error)
    // 기본 프롬프트 반환
    return [
      {
        type: "연출샷",
        prompt: `${productName} product, full product shot, clean background, professional product photography, high quality, 9:16 aspect ratio`,
        description: "제품 전체 연출샷"
      },
      {
        type: "배경 변경",
        prompt: `${productName} product, different background, lifestyle setting, professional product photography, high quality, 9:16 aspect ratio`,
        description: "다른 배경의 제품 사진"
      },
      {
        type: "디테일샷",
        prompt: `${productName} product, full product visible, entire product fills the frame, product details emphasized, highlighting product features, NOT close-up, NOT macro shot, entire product must be visible, professional product photography, high quality, 9:16 aspect ratio`,
        description: "제품 전체가 화면에 가득 차면서 디테일이 강조된 사진"
      }
    ]
  }
}

// 대본에 맞는 3장의 이미지 생성 (전체 샷, 디테일 샷, 각도와 배경 다르게)
export async function generateImage(
  script: string,
  productName: string,
  replicateApiKey?: string,
  productImageBase64?: string,
  productDescription?: string,
  apiKey?: string,
  imagePrompts?: Array<{ type: string; prompt: string; description: string; scriptText: string }>,
  aspectRatio?: string // 원본 이미지 비율
): Promise<string[]> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.")
  }

  if (!imagePrompts || imagePrompts.length !== 3) {
    throw new Error("이미지 프롬프트가 3개 필요합니다. 먼저 프롬프트를 생성해주세요.")
  }

  try {
    console.log("[Shopping] 대본 기반 3장의 이미지 생성 시작 (전체 샷, 디테일 샷, 각도와 배경 다르게)")
    
    const imageUrls: string[] = []
    
    // 3개 이미지 생성
    for (let i = 0; i < 3; i++) {
      const prompt = imagePrompts[i]
      console.log(`[Shopping] 이미지 ${i + 1}/3 생성 중... (타입: ${prompt.type})`)
      
      const imageUrl = await generateImageWithNanobanana(
        prompt.prompt,
        productName,
        productImageBase64,
        REPLICATE_API_TOKEN,
        i, // sceneIndex
        productDescription,
        aspectRatio // 원본 이미지 비율 전달
      )
      
      imageUrls.push(imageUrl)
      console.log(`[Shopping] 이미지 ${i + 1}/3 생성 완료:`, imageUrl)
    }
    
    console.log(`[Shopping] 3장의 이미지 생성 완료`)
    return imageUrls
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

절대적 규칙 (무조건 준수):
1. 반드시 두 줄로 작성해야 합니다 (한 줄로 작성하면 안 됨)
2. line1과 line2 모두 반드시 포함되어야 합니다
3. 각 줄은 완전한 문구여야 하며, 빈 문자열이면 안 됩니다
4. 두 줄은 서로 다른 내용이어야 합니다

중요: 제품명을 분석하여 해당 제품의 핵심 특징/효과/장점을 파악하고, 그에 맞는 맞춤형 후킹 문구를 작성하세요.

제품 분석 방법:
- 청소기 -> 청소 효율, 흡입력, 편리함
- 화장품/세럼 -> 피부 효과, 동안, 탄력
- 건강식품 -> 건강 효과, 에너지, 다이어트
- 주방용품 -> 요리 시간 단축, 맛, 편리함
- 전자기기 -> 성능, 가성비, 혁신

핵심 규칙:
1. 반드시 숫자를 포함 (99%, 3초, 1위, 500만, 10배, 50% 등)
2. 첫 번째 줄 (line1): 제품 특징 + 숫자 + 충격 (5~10자) - 반드시 작성
3. 두 번째 줄 (line2): 제품 효과/결과 + 긴박감 (5~10자) - 반드시 작성
4. 제품과 직접 연관된 문구여야 함!
5. 두 줄 모두 반드시 존재해야 하며, 각각 의미 있는 내용이어야 함

제품별 예시 (모두 두 줄):
- 무선청소기: line1: "99%가 모르는", line2: "청소 꿀팁"
- 비타민C세럼: line1: "피부과 의사도 놀란", line2: "동안 비결"  
- 에어프라이어: line1: "3분 요리의", line2: "충격 비밀"
- 다이어트 식품: line1: "2주만에 -5kg", line2: "실화입니다"
- 무선이어폰: line1: "애플도 인정한", line2: "갓성비 정체"
- 마사지기: line1: "만성피로 3일만에", line2: "해결 비법"

응답 형식 (절대 준수):
반드시 다음 JSON 형식으로만 응답하세요. line1과 line2 모두 반드시 포함되어야 합니다:
{"line1": "첫번째줄", "line2": "두번째줄"}

절대 한 줄로만 작성하지 마세요. 반드시 두 줄(line1, line2) 모두 작성해야 합니다.`
          },
          {
            role: "user",
            content: `제품명: ${productName}

위 제품의 핵심 특징과 장점을 분석하고, 이 제품에 딱 맞는 자극적인 후킹 문구를 작성해주세요.

중요 요구사항:
1. 반드시 두 줄(line1, line2)로 작성해야 합니다
2. 한 줄로만 작성하면 안 됩니다
3. line1과 line2 모두 반드시 포함되어야 합니다
4. 각 줄은 완전한 문구여야 하며, 빈 문자열이면 안 됩니다
5. 반드시 숫자를 포함하고, 제품과 직접 연관된 문구여야 합니다

응답 형식:
{"line1": "첫번째줄", "line2": "두번째줄"}`
          }
        ],
        response_format: { type: "json_object" },
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

    // JSON 파싱 (response_format이 json_object이므로 직접 파싱)
    let parsed: { line1?: string; line2?: string }
    try {
      parsed = typeof content === 'string' ? JSON.parse(content) : content
    } catch (e) {
      // JSON 파싱 실패 시 기본값 반환
      console.error("[Shopping] JSON 파싱 실패:", e)
      return {
        line1: "이거 안 쓰면",
        line2: "손해봅니다"
      }
    }

    // line1과 line2가 모두 존재하는지 확인
    if (!parsed.line1 || !parsed.line2) {
      console.warn("[Shopping] line1 또는 line2가 없음:", parsed)
      return {
        line1: parsed.line1 || "이거 안 쓰면",
        line2: parsed.line2 || "손해봅니다"
      }
    }

    return {
      line1: parsed.line1.trim(),
      line2: parsed.line2.trim()
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
  productImageBase64?: string,
  hookingText?: { line1: string; line2: string }
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.")
  }

  try {
    console.log("[Shopping] 쇼츠 썸네일 생성 시작")
    
    // 썸네일 프롬프트: YouTube shopping shorts thumbnail with text style
    const textLines = hookingText 
      ? `${hookingText.line1}\n${hookingText.line2}`
      : `${productName} 쇼츠 영상`
    
    const thumbnailPrompt = `YouTube shopping shorts thumbnail with text style.

Product: ${productName}

CRITICAL PRODUCT PRESERVATION RULES (MUST FOLLOW - ABSOLUTELY MANDATORY):
- The product's physical shape, proportions, dimensions, and design must be preserved EXACTLY as shown in the reference image
- Product must NOT be deformed, abstracted, redesigned, or modified in any way
- Product must remain recognizable and maintain its original form, structure, and appearance
- Do NOT alter the product's structure, size, shape, proportions, or appearance
- The product in the image must match the reference product image EXACTLY
- Maintain exact original product features, buttons, switches, controls, and design elements from reference image
- Do NOT add new features, buttons, switches, or controls that are not present in the original product
- Do NOT remove or modify any existing features, buttons, or design elements from the original product
- Product's original design and structure must be preserved accurately (exact product design preservation, maintain original product structure)
- The product's actual appearance must be accurately reflected (product preservation, exact product shape and features maintained)
- Only maintain original product features, buttons, and design elements from the reference image
- Never add new features, buttons, or switches not present in the original
- Exact original product design and structure must be preserved

Background: Show the product being actively used in a real-world scenario. The product's main function must be clearly demonstrated. Hands operating or using the product are allowed. Realistic product usage scene, natural lighting, authentic environment. Photo-realistic style, not illustration.

Text to display (CRITICAL - MUST FOLLOW EXACTLY - ABSOLUTELY MANDATORY):
- Display EXACTLY two lines of text (NOT one line, NOT three lines, EXACTLY two lines)
- Line 1 (top line): "${hookingText ? hookingText.line1 : productName}"
- Line 2 (bottom line): "${hookingText ? hookingText.line2 : '쇼츠 영상'}"
- BOTH lines MUST be displayed - Line 1 AND Line 2 are REQUIRED
- DO NOT combine the two lines into one
- DO NOT display only one line
- DO NOT skip either line
- ABSOLUTELY NO duplicate words between the two lines
- Each line must have completely different words
- If any word appears in Line 1, it must NOT appear in Line 2
- If any word appears in Line 2, it must NOT appear in Line 1
- The two lines must be distinct and non-repetitive
- Display exactly as provided above, no variations, no duplicates
- Line 1 must be on top, Line 2 must be on bottom
- Both lines must be clearly visible and readable

Text style requirements:
- Very bold Korean typography
- Huge text, high contrast
- EXACTLY two lines of text displayed prominently (no more, no less)
- First line (top): white text only (no stroke, no outline)
- Second line (bottom): neon mint / turquoise text only (bright mint green or turquoise color, no stroke, no outline)
- Flat design, no heavy shadow
- Optimized for mobile readability
- Text should look like it's overlaid on a photo
- Photo-realistic text rendering

Image requirements:
- Product usage scene as background (photo-realistic)
- Product being actively used (product shape, structure, features, buttons, and design MUST be preserved exactly as in reference image)
- Product must maintain exact original form, features, buttons, and design elements from reference image
- Do NOT add new features, buttons, or controls not present in the original product
- Hands operating the product are visible
- Natural, realistic environment
- High quality, professional photography style
- 9:16 vertical aspect ratio
- No human faces, no face visible
- Realistic lighting and shadows
- Product must be the exact same product from the reference image (exact product design preservation, maintain original product structure, exact product shape and features maintained)

Product highlighting elements:
- Add a bright red arrow or red circle to highlight and point to the product
- Red arrow should point directly at the product
- Red circle should surround or highlight the product area
- Use vibrant red color (#FF0000 or similar) for high visibility
- Arrow or circle should be bold and eye-catching
- These elements should draw attention to the product
- Professional YouTube thumbnail style highlighting`

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
    
    // google/nano-banana-pro 모델 사용
    const response = await fetch("https://api.replicate.com/v1/models/google/nano-banana-pro/predictions", {
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
  prompt: string, // 프롬프트 (필수)
  duration: number, // 영상 길이 (초 단위)
  replicateApiKey?: string
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다.")
  }

  try {
    console.log(`[Shopping] bytedance/seedance-1-pro-fast 모델로 영상 생성 시작:`, imageUrl)
    console.log(`[Shopping] 프롬프트:`, prompt)
    console.log(`[Shopping] duration:`, duration, "초")
    
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
    // duration은 초 단위로 전달 (모델이 지원하는 경우)
    const modelInput: any = {
      image: validImageUrl, // 이미지 URL
      prompt: prompt, // 프롬프트 (영상 길이 명시 포함)
      resolution: "480p", // 480p 해상도
      aspect_ratio: "9:16", // 9:16 비율
      camera_fixed: false, // 카메라 고정 해제
    }
    
    // duration 파라미터 추가 (모델이 지원하는 경우)
    // CRITICAL: duration은 반드시 TTS/3으로 계산된 값이어야 함
    if (duration && duration > 0) {
      modelInput.duration = duration
      console.log(`[Shopping] ✅ duration 파라미터 추가: ${duration}초 (각 영상 길이, TTS/3)`)
      console.log(`[Shopping] ⚠️ CRITICAL: 이 영상은 반드시 ${duration}초로 생성되어야 합니다. TTS 전체 길이(${duration * 3}초)가 아닙니다!`)
      console.log(`[Shopping] ⚠️ CRITICAL: 이 영상은 TTS 길이의 1/3인 ${duration}초입니다. 절대 ${duration * 3}초로 생성하면 안 됩니다!`)
    } else {
      console.error(`[Shopping] ❌ CRITICAL ERROR: duration이 유효하지 않음: ${duration}`)
      throw new Error(`영상 길이 파라미터가 유효하지 않습니다: ${duration}초`)
    }
    
    // 프롬프트 맨 앞에 duration 강조 추가
    const enhancedPrompt = `CRITICAL VIDEO DURATION REQUIREMENT: This video MUST be exactly ${duration} seconds long. NOT ${duration * 3} seconds. The total TTS duration is ${duration * 3} seconds, but this video segment is only ${duration} seconds (1/3 of total). The video MUST end at exactly ${duration} seconds. DO NOT make it longer. ${prompt}`
    
    modelInput.prompt = enhancedPrompt
    
    console.log(`[Shopping] Replicate API URL:`, apiUrl)
    console.log(`[Shopping] Input:`, JSON.stringify(modelInput, null, 2))
    console.log(`[Shopping] 🔍 duration 파라미터 확인:`, modelInput.duration, "초 (각 영상 길이, TTS/3)")
    console.log(`[Shopping] 🔍 프롬프트에 duration 포함 여부:`, enhancedPrompt.includes(`${duration} seconds`) ? "✅ 포함됨" : "❌ 포함 안 됨")
    console.log(`[Shopping] ⚠️ CRITICAL: 각 영상은 반드시 ${duration}초로 생성되어야 합니다. TTS 전체 길이(${duration * 3}초)가 아닙니다!`)
    
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

    // output 추출 헬퍼 함수
    const extractVideoUrl = (output: any): string | null => {
      if (!output) return null
      
      // 배열인 경우
      if (Array.isArray(output)) {
        if (output.length > 0) {
          const first = output[0]
          if (typeof first === "string") {
            return first
          } else if (first && typeof first === "object") {
            return (first as any).url?.() || (first as any).url || String(first)
          }
        }
        return null
      }
      
      // 문자열인 경우
      if (typeof output === "string") {
        return output
      }
      
      // 객체인 경우
      if (output && typeof output === "object") {
        // url() 메서드가 있는 경우
        if (typeof (output as any).url === "function") {
          return (output as any).url()
        }
        // url 속성이 있는 경우
        if ((output as any).url) {
          return (output as any).url
        }
        // 그 외 객체는 문자열로 변환
        return String(output)
      }
      
      return String(output)
    }

    if (data.status === "succeeded" && data.output) {
      const videoUrl = extractVideoUrl(data.output)
      if (!videoUrl) {
        throw new Error("영상 URL을 추출할 수 없습니다.")
      }
      console.log(`[Shopping] ✅ 영상 생성 완료 (즉시):`, videoUrl)
      return videoUrl
    } else if (data.status === "processing" || data.status === "starting" || data.status === "queued") {
      // 폴링 방식으로 결과 확인
      const predictionId = data.id
      let attempts = 0
      const maxAttempts = 300 // 최대 10분 대기

      console.log(`[Shopping] 🔄 폴링 시작 (predictionId: ${predictionId}, 최대 ${maxAttempts}회 시도)`)

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000)) // 2초 대기
        attempts++

        console.log(`[Shopping] 🔄 폴링 시도 ${attempts}/${maxAttempts}...`)

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          },
        })

        if (!statusResponse.ok) {
          console.error(`[Shopping] ❌ 상태 확인 실패: ${statusResponse.status}`)
          throw new Error(`상태 확인 실패: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()
        console.log(`[Shopping] 📊 폴링 응답 (시도 ${attempts}): status=${statusData.status}`)

        if (statusData.status === "succeeded" && statusData.output) {
          const videoUrl = extractVideoUrl(statusData.output)
          if (!videoUrl) {
            throw new Error("영상 URL을 추출할 수 없습니다.")
          }
          console.log(`[Shopping] ✅ 영상 생성 완료 (폴링, 시도 ${attempts}회):`, videoUrl)
          return videoUrl
        } else if (statusData.status === "failed") {
          const errorMessage = statusData.error || "알 수 없는 오류"
          console.error(`[Shopping] ❌ 영상 생성 실패: ${errorMessage}`)
          throw new Error(`영상 생성 실패: ${errorMessage}`)
        } else if (statusData.status === "canceled") {
          console.error(`[Shopping] ❌ 영상 생성 취소됨`)
          throw new Error("영상 생성이 취소되었습니다.")
        }

        // processing, starting, queued 상태면 계속 폴링
      }

      console.error(`[Shopping] ❌ 영상 생성 시간 초과 (${maxAttempts}회 시도 후)`)
      throw new Error(`영상 생성 시간 초과 (최대 ${maxAttempts * 2}초 대기 후 실패)`)
    } else {
      const errorMsg = data.error || "알 수 없는 오류"
      console.error(`[Shopping] ❌ 영상 생성 실패: status=${data.status}, error=${errorMsg}`)
      throw new Error(`영상 생성 실패: ${errorMsg}`)
    }
  } catch (error) {
    console.error("[Shopping] 영상 생성 실패:", error)
    throw error
  }
}

// 유튜브 제목, 설명, 태그 자동 생성
export async function generateYouTubeMetadata(
  productName: string,
  productDescription: string,
  script: string,
  apiKey?: string
): Promise<{ title: string; description: string; tags: string[] }> {
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
            content: `당신은 유튜브 쇼츠 영상 메타데이터 작성 전문가입니다. 제품 홍보 영상에 최적화된 제목, 설명, 태그를 생성해주세요.

규칙:
1. 제목: 50자 이내, 클릭을 유도하는 강력한 후킹 문구, 이모지 사용 가능
2. 설명: 500자 이내, 제품 특징과 장점을 간결하게, 관련 링크 공간 확보
3. 태그: 10-15개, 제품명, 카테고리, 키워드 포함, 쉼표로 구분

JSON 형식으로 응답:
{
  "title": "제목",
  "description": "설명",
  "tags": ["태그1", "태그2", ...]
}`,
          },
          {
            role: "user",
            content: `제품명: ${productName}
제품 설명: ${productDescription}
영상 대본: ${script}

위 정보를 바탕으로 유튜브 쇼츠 영상용 제목, 설명, 태그를 생성해주세요.`,
          },
        ],
        max_tokens: 500,
        temperature: 0.8,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("메타데이터 생성에 실패했습니다.")
    }

    const parsed = JSON.parse(content)
    
    return {
      title: parsed.title || `${productName} 추천!`,
      description: parsed.description || `${productDescription}\n\n${script}`,
      tags: Array.isArray(parsed.tags) ? parsed.tags : (parsed.tags ? parsed.tags.split(",").map((t: string) => t.trim()) : [productName]),
    }
  } catch (error) {
    console.error("[Shopping] 메타데이터 생성 실패:", error)
    // 실패 시 기본값 반환
    return {
      title: `${productName} 추천!`,
      description: `${productDescription}\n\n${script}`,
      tags: [productName, "쇼핑", "추천", "리뷰"],
    }
  }
}

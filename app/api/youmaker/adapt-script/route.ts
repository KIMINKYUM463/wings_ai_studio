import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export const dynamic = 'force-dynamic'

/**
 * 대본 각색 API
 * POST /api/youmaker/adapt-script
 * 
 * 5단계 프로세스:
 * 1. 원본 대본 정리 및 교정 (Cleaning)
 * 2. 핵심 내용 요약 (Structural Analysis)
 * 3. 새로운 대본 재창조 (Creative Writing)
 * 4. 클릭 유도형 제목 생성 (High-CTR Titles)
 * 5. 썸네일 문구 제작 (Thumbnail Copy)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { script, geminiApiKey, commentAnalysis } = body

    if (!script || !script.trim()) {
      return NextResponse.json(
        { error: "대본이 필요합니다." },
        { status: 400 }
      )
    }

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API Key가 필요합니다." },
        { status: 400 }
      )
    }

    // Gemini AI 초기화
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

    // Step 1: 원본 대본 정리 및 교정
    console.log("[Script Adaptation] Step 1: 원본 대본 정리 및 교정 시작")
    const cleaningPrompt = `너는 전문 에디터다. 타임스탬프와 추임새를 제거하고, 문법을 교정하여 가독성 높은 산문으로 변환하라.

원본 대본:
${script}

정제된 대본만 반환해주세요. 설명이나 추가 텍스트는 포함하지 마세요.`

    const cleaningResult = await model.generateContent(cleaningPrompt)
    const cleanedScript = cleaningResult.response.text().trim()

    // Step 2: 핵심 내용 요약
    console.log("[Script Adaptation] Step 2: 핵심 내용 요약 시작")
    const summaryPrompt = `이 영상의 성공 공식을 역설계하라. 시청자를 붙잡아두는 '논리적 구조(Structure)'와 '핵심 메시지'만 추출하라.

정제된 대본:
${cleanedScript}

다음 JSON 형식으로 응답해주세요:
{
  "title": "핵심 제목",
  "coreMessage": "핵심 메시지 (1-2문장)",
  "structure": ["논리적 구조 포인트 1", "논리적 구조 포인트 2", "논리적 구조 포인트 3", "논리적 구조 포인트 4", "논리적 구조 포인트 5"],
  "summaryPoints": ["요약 포인트 1", "요약 포인트 2", "요약 포인트 3", "요약 포인트 4", "요약 포인트 5"]
}

반드시 유효한 JSON 형식으로만 응답해주세요.`

    const summaryResult = await model.generateContent(summaryPrompt)
    const summaryText = summaryResult.response.text().trim()
    
    // JSON 추출
    let summaryData
    try {
      const jsonMatch = summaryText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        summaryData = JSON.parse(jsonMatch[0])
      } else {
        summaryData = JSON.parse(summaryText)
      }
    } catch (parseError) {
      console.error("[Script Adaptation] 요약 파싱 오류:", parseError)
      throw new Error("구조 분해 및 요약 단계에서 오류가 발생했습니다.")
    }

    // Step 3: 새로운 대본 재창조
    console.log("[Script Adaptation] Step 3: 새로운 대본 재창조 시작")
    
    // 댓글 분석 결과를 활용한 추가 컨텍스트 구성
    let commentContext = ""
    if (commentAnalysis) {
      commentContext = `
댓글 민심 분석 결과:
- 감정 분포: 긍정 ${commentAnalysis.sentiment?.positive || 0}%, 부정 ${commentAnalysis.sentiment?.negative || 0}%, 중립 ${commentAnalysis.sentiment?.neutral || 0}%
- 주요 키워드: ${commentAnalysis.bestKeywords?.join(", ") || "없음"}
- 댓글 요약: ${commentAnalysis.summary || "없음"}
- 장점 (Pros): ${commentAnalysis.pros?.join(", ") || "없음"}
- 단점 (Cons): ${commentAnalysis.cons?.join(", ") || "없음"}

위 댓글 분석 결과를 참고하여 시청자들이 관심 있어 하는 부분을 강조하고, 부정적인 피드백을 해소할 수 있는 내용을 포함하여 대본을 작성하세요.`
    }
    
    const reconstructionPrompt = `1억 뷰 유튜버의 페르소나로 빙의하라. 추출한 구조를 바탕으로 완전히 새로운 대본을 써라. 원본을 베끼지 말고, 몰입도를 극대화할 수 있는 시각적 연출(Visual Cue)을 포함하라.

요약 정보:
- 제목: ${summaryData.title}
- 핵심 메시지: ${summaryData.coreMessage}
- 논리적 구조: ${JSON.stringify(summaryData.structure)}
- 요약 포인트: ${JSON.stringify(summaryData.summaryPoints)}
${commentContext}

다음 JSON 형식으로 응답해주세요:
{
  "opening": {
    "narration": "오프닝 대사 (시청자의 관심을 끄는 도입부)",
    "visual_cue": "오프닝 화면 연출 가이드 (시각적으로 상상할 수 있게 구체적으로)"
  },
  "main_points": [
    {
      "narration": "본문 대사 1",
      "visual_cue": "화면 연출 가이드 1 (시각적으로 상상할 수 있게 구체적으로)"
    },
    {
      "narration": "본문 대사 2",
      "visual_cue": "화면 연출 가이드 2 (시각적으로 상상할 수 있게 구체적으로)"
    },
    {
      "narration": "본문 대사 3",
      "visual_cue": "화면 연출 가이드 3 (시각적으로 상상할 수 있게 구체적으로)"
    },
    {
      "narration": "본문 대사 4",
      "visual_cue": "화면 연출 가이드 4 (시각적으로 상상할 수 있게 구체적으로)"
    },
    {
      "narration": "본문 대사 5",
      "visual_cue": "화면 연출 가이드 5 (시각적으로 상상할 수 있게 구체적으로)"
    }
  ],
  "closing": {
    "narration": "결말 대사 (마무리 및 행동 촉구)",
    "visual_cue": "결말 화면 연출 가이드 (시각적으로 상상할 수 있게 구체적으로)"
  }
}

반드시 유효한 JSON 형식으로만 응답해주세요.`

    const reconstructionResult = await model.generateContent(reconstructionPrompt)
    const reconstructionText = reconstructionResult.response.text().trim()
    
    // JSON 추출
    let scriptStructure
    try {
      const jsonMatch = reconstructionText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        scriptStructure = JSON.parse(jsonMatch[0])
      } else {
        scriptStructure = JSON.parse(reconstructionText)
      }
    } catch (parseError) {
      console.error("[Script Adaptation] 재작성 파싱 오류:", parseError)
      throw new Error("창조적 재작성 단계에서 오류가 발생했습니다.")
    }

    // 각색된 대본을 텍스트로 변환
    const adaptedScript = `[오프닝]
${scriptStructure.opening.narration}

[화면 연출] ${scriptStructure.opening.visual_cue}

---

[본문]

${scriptStructure.main_points.map((point: any, index: number) => 
  `${index + 1}. ${point.narration}\n   [화면 연출] ${point.visual_cue}`
).join('\n\n')}

---

[결말]
${scriptStructure.closing.narration}

[화면 연출] ${scriptStructure.closing.visual_cue}`

    // Step 4: 클릭 유도형 제목 생성
    console.log("[Script Adaptation] Step 4: 클릭 유도형 제목 생성 시작")
    const titlePrompt = `클릭을 부르는 제목 10개를 생성하라. 5개는 '호기심 자극형', 5개는 '이득 제시형'으로 나눠라.

핵심 메시지: ${summaryData.coreMessage}
제목: ${summaryData.title}

다음 JSON 형식으로 응답해주세요:
{
  "fresh": ["호기심 자극형 제목 1", "호기심 자극형 제목 2", "호기심 자극형 제목 3", "호기심 자극형 제목 4", "호기심 자극형 제목 5"],
  "stable": ["이득 제시형 제목 1", "이득 제시형 제목 2", "이득 제시형 제목 3", "이득 제시형 제목 4", "이득 제시형 제목 5"]
}

반드시 유효한 JSON 형식으로만 응답해주세요.`

    const titleResult = await model.generateContent(titlePrompt)
    const titleText = titleResult.response.text().trim()
    
    let titles
    try {
      const jsonMatch = titleText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        titles = JSON.parse(jsonMatch[0])
      } else {
        titles = JSON.parse(titleText)
      }
    } catch (parseError) {
      console.error("[Script Adaptation] 제목 파싱 오류:", parseError)
      // 기본값 사용
      titles = {
        fresh: ["이걸 아직도 모른다고?", "충격적인 진실", "이것 때문에 실패했다", "99%가 모르는 비밀", "이제서야 알았다"],
        stable: ["월 100만 원 더 버는 법 TOP 3", "초보자를 위한 완벽 가이드", "5분만에 배우는 핵심 노하우", "실전 활용법 완벽 정리", "단계별 상세 가이드"]
      }
    }

    // Step 5: 썸네일 문구 제작
    console.log("[Script Adaptation] Step 5: 썸네일 문구 제작 시작")
    const thumbnailPrompt = `썸네일 이미지에 들어갈 텍스트를 작성하라. 3단어 이내로 짧고 강렬하게, 시각적으로 상상할 수 있게 작성하라.

핵심 메시지: ${summaryData.coreMessage}

다음 세 가지 스타일로 각각 5개씩 문구를 생성해주세요 (각 문구는 3단어 이내):
1. Emotional (감정): 감정을 자극하는 짧고 강렬한 문구
2. Informational (정보): 정보나 숫자를 강조하는 짧고 강렬한 문구
3. Visual (시각적): 시각적 임팩트를 주는 짧고 강렬한 문구

다음 JSON 형식으로 응답해주세요:
{
  "emotional": ["3단어 이내 문구1", "3단어 이내 문구2", "3단어 이내 문구3", "3단어 이내 문구4", "3단어 이내 문구5"],
  "informational": ["3단어 이내 문구1", "3단어 이내 문구2", "3단어 이내 문구3", "3단어 이내 문구4", "3단어 이내 문구5"],
  "visual": ["3단어 이내 문구1", "3단어 이내 문구2", "3단어 이내 문구3", "3단어 이내 문구4", "3단어 이내 문구5"]
}

반드시 유효한 JSON 형식으로만 응답해주세요.`

    const thumbnailResult = await model.generateContent(thumbnailPrompt)
    const thumbnailText = thumbnailResult.response.text().trim()
    
    let thumbnailTexts
    try {
      const jsonMatch = thumbnailText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        thumbnailTexts = JSON.parse(jsonMatch[0])
      } else {
        thumbnailTexts = JSON.parse(thumbnailText)
      }
    } catch (parseError) {
      console.error("[Script Adaptation] 썸네일 문구 파싱 오류:", parseError)
      // 기본값 사용
      thumbnailTexts = {
        emotional: ["충격", "결국 터졌다", "믿을 수 없어", "눈물", "감동"],
        informational: ["수익 3배 증가", "5분 완성", "100% 성공", "확실한 방법", "검증됨"],
        visual: ["이미지만으로 충분히 전달", "강렬한 색상", "대비 효과", "시각적 임팩트", "눈에 띄는 디자인"]
      }
    }

    console.log("[Script Adaptation] 완료")

    return NextResponse.json({
      success: true,
      // Step 1 결과
      cleanedScript,
      // Step 2 결과
      summary: summaryData,
      // Step 3 결과
      adaptedScript,
      // Step 4 결과
      titles,
      // Step 5 결과
      thumbnailTexts,
    })
  } catch (error) {
    console.error("[Script Adaptation] 오류:", error)
    return NextResponse.json(
      {
        error: `대본 각색 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}


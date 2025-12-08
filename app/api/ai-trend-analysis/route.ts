import { type NextRequest, NextResponse } from "next/server"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function callOpenAIWithRetry(requestBody: any, apiKey?: string, maxRetries = 2) {
  // 전달받은 API 키 우선 사용, 없으면 환경 변수
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY
  
  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GPT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      if (response.status === 429) {
        if (attempt === maxRetries) {
          throw new Error("Rate limit exceeded after all retries")
        }
        const waitTime = Math.pow(3, attempt) * 2000 // 6초, 18초 대기
        console.log(`Rate limit hit, waiting ${waitTime}ms before retry ${attempt + 1}`)
        await delay(waitTime)
        continue
      }

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }
      await delay(2000 * attempt)
    }
  }
}

export async function POST(request: NextRequest) {
  let videos: any[] = []
  let searchQuery = ""
  let period = "3"

  try {
    const requestData = await request.json()
    videos = requestData.videos || []
    searchQuery = requestData.searchQuery || ""
    period = requestData.period || "3"
    const apiKey = requestData.apiKey // 클라이언트에서 전달받은 API 키

    const videoAnalysisData = videos.slice(0, 10).map((video: any) => ({
      title: video.title,
      channelTitle: video.channelTitle,
      viewCount: Number.parseInt(video.viewCount),
      publishedAt: video.publishedAt,
    }))

    const requestBody = {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "당신은 YouTube 트렌드 분석 전문가입니다. 제공된 영상 데이터를 분석하여 실용적인 인사이트를 제공하세요.",
        },
        {
          role: "user",
          content: `다음 YouTube 영상 데이터를 분석해주세요:

검색 키워드: "${searchQuery}"
분석 기간: ${period}개월

영상 데이터:
${videoAnalysisData.map((v, i) => `${i + 1}. 제목: "${v.title}" | 조회수: ${v.viewCount.toLocaleString()}회 | 채널: ${v.channelTitle}`).join("\n")}

다음 형식으로 분석해주세요:

🔍 **제목 트렌드 분석**
- 상위 조회수 영상들의 제목 패턴 분석
- 효과적인 키워드와 표현 방식

📈 **조회수 분석** 
- 평균/최고/최저 조회수 현황
- 성과 차이의 주요 원인

💡 **추천 제목 전략**
- 이 분야에서 효과적인 제목 작성법
- 피해야 할 요소들

🎯 **예상 조회수 예측**
- 새 영상의 예상 조회수 범위 (보수적/평균적/낙관적)
- 예측 근거

⚡ **핵심 인사이트**
- 이 분야의 현재 트렌드 요약
- 성공을 위한 핵심 전략`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }

    const aiResponse = await callOpenAIWithRetry(requestBody, apiKey)
    const analysis = aiResponse.choices[0]?.message?.content || "분석 결과를 가져올 수 없습니다."

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error("AI 분석 오류:", error)

    const averageViews =
      videos.length > 0
        ? Math.floor(
            videos.reduce((sum: number, v: any) => sum + Number.parseInt(v.viewCount || "0"), 0) / videos.length,
          )
        : 0

    return NextResponse.json(
      {
        analysis: `🔍 **기본 트렌드 분석**
"${searchQuery}" 키워드 분석 결과

📈 **조회수 현황**
• 평균 조회수: ${averageViews.toLocaleString()}회
• 분석된 영상 수: ${videos.length}개

💡 **추천 전략**
• 명확하고 구체적인 제목 작성
• 타겟 키워드 자연스럽게 포함
• 시청자의 관심을 끄는 요소 추가

🎯 **예상 성과**
새 영상 예상 조회수: ${Math.floor(averageViews * 0.5).toLocaleString()} - ${Math.floor(averageViews * 2).toLocaleString()}회

※ AI 분석 서비스가 일시적으로 제한되어 기본 분석을 제공합니다.`,
      },
      { status: 200 },
    )
  }
}

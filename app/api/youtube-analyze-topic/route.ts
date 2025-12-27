import { type NextRequest, NextResponse } from "next/server"

/**
 * YouTube URL에서 video ID 추출
 */
function extractVideoId(url: string): string | null {
  // 다양한 YouTube URL 형식 지원
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // 직접 video ID만 입력한 경우
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, youtubeApiKey, openaiApiKey } = body

    if (!url) {
      return NextResponse.json({ error: "YouTube URL이 필요합니다." }, { status: 400 })
    }

    // Video ID 추출
    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json({ error: "유효한 YouTube URL이 아닙니다." }, { status: 400 })
    }

    // YouTube API 키 확인
    const YOUTUBE_API_KEY = youtubeApiKey || process.env.YOUTUBE_API_KEY
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        { error: "YouTube Data API Key가 필요합니다." },
        { status: 400 }
      )
    }

    // OpenAI API 키 확인
    const OPENAI_API_KEY = openaiApiKey || process.env.OPENAI_API_KEY || process.env.GPT_API_KEY || process.env.CHATGPT_API_KEY
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API Key가 필요합니다." },
        { status: 400 }
      )
    }

    // YouTube API로 영상 정보 가져오기
    const youtubeResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`
    )

    if (!youtubeResponse.ok) {
      const errorData = await youtubeResponse.json().catch(() => ({}))
      console.error("YouTube API 오류:", youtubeResponse.status, errorData)
      
      if (youtubeResponse.status === 403) {
        return NextResponse.json(
          { error: "YouTube API 키가 유효하지 않거나 할당량을 초과했습니다." },
          { status: 403 }
        )
      } else if (youtubeResponse.status === 404) {
        return NextResponse.json(
          { error: "해당 영상을 찾을 수 없습니다." },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: `YouTube API 오류: ${errorData.error?.message || youtubeResponse.statusText}` },
        { status: youtubeResponse.status }
      )
    }

    const youtubeData = await youtubeResponse.json()
    
    if (!youtubeData.items || youtubeData.items.length === 0) {
      return NextResponse.json(
        { error: "영상 정보를 가져올 수 없습니다." },
        { status: 404 }
      )
    }

    const video = youtubeData.items[0]
    const title = video.snippet.title
    const description = video.snippet.description || ""
    const viewCount = video.statistics.viewCount || "0"
    const likeCount = video.statistics.likeCount || "0"
    const tags = video.snippet.tags || []

    // OpenAI API로 주제 분석 및 추천 주제 생성
    const analysisPrompt = `다음은 유튜브 영상의 정보입니다:

제목: ${title}
설명: ${description.substring(0, 2000)}${description.length > 2000 ? '...' : ''}
조회수: ${viewCount}
좋아요: ${likeCount}
태그: ${tags.join(', ')}

이 영상의 핵심 주제를 간결하게 정리해주세요. 그리고 이 주제에서 파생될 수 있고, 앞으로 조회수가 잘 나올 것 같은 유사 주제를 5개 추천해주세요.

응답 형식은 반드시 다음 JSON 형식으로만 작성해주세요:
{
  "mainTopic": "핵심 주제 (한 문장으로 간결하게)",
  "recommendedTopics": [
    "추천 주제 1",
    "추천 주제 2",
    "추천 주제 3",
    "추천 주제 4",
    "추천 주제 5"
  ]
}

추천 주제는:
- 원본 주제와 유사하지만 다른 각도로 접근
- 조회수 증가 가능성이 높은 주제
- 구체적이고 실용적인 주제
- 한국어로 작성

JSON 형식 외의 다른 설명이나 텍스트는 포함하지 마세요.`

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "당신은 유튜브 콘텐츠 분석 전문가입니다. 영상 정보를 분석하여 핵심 주제를 정리하고, 조회수 증가 가능성이 높은 유사 주제를 추천합니다. 반드시 JSON 형식으로만 응답하세요.",
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}))
      console.error("OpenAI API 오류:", openaiResponse.status, errorData)
      
      return NextResponse.json(
        { error: `OpenAI API 오류: ${errorData.error?.message || openaiResponse.statusText}` },
        { status: openaiResponse.status }
      )
    }

    const openaiData = await openaiResponse.json()
    const content = openaiData.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: "주제 분석 결과를 생성할 수 없습니다." },
        { status: 500 }
      )
    }

    // JSON 파싱 시도
    let analysisResult
    try {
      // JSON 코드 블록 제거
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0])
      } else {
        analysisResult = JSON.parse(content)
      }
    } catch (parseError) {
      console.error("JSON 파싱 오류:", parseError)
      console.error("원본 응답:", content)
      
      // 파싱 실패 시 기본값 반환
      analysisResult = {
        mainTopic: title,
        recommendedTopics: [
          "관련 주제 1",
          "관련 주제 2",
          "관련 주제 3",
          "관련 주제 4",
          "관련 주제 5"
        ]
      }
    }

    return NextResponse.json({
      success: true,
      videoInfo: {
        title,
        description: description.substring(0, 500), // 처음 500자만
        viewCount,
        likeCount,
        videoId,
        thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || "",
      },
      analysis: analysisResult,
    })
  } catch (error) {
    console.error("YouTube 주제 분석 오류:", error)
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
    return NextResponse.json(
      { error: `주제 분석에 실패했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}


import { type NextRequest, NextResponse } from "next/server"

type Category =
  | "wisdom"
  | "religion"
  | "health"
  | "northkorea"
  | "economy"
  | "history"
  | "society"
  | "domestic_story"
  | "international_story"
  | "space"

// 카테고리별 유튜브 검색 키워드 매핑
const categorySearchKeywords: Record<Category, string[]> = {
  wisdom: ["명언", "인생", "지혜", "삶의 교훈", "인생 조언", "시니어 명언"],
  religion: ["종교", "기독교", "불교", "신앙", "기도", "종교 이야기"],
  health: ["건강", "시니어 건강", "노인 건강", "건강 정보", "건강 관리"],
  northkorea: ["북한", "탈북", "북한 이야기", "탈북자", "북한 실상"],
  economy: ["경제", "재테크", "노후", "연금", "부동산", "투자"],
  history: ["역사", "한국사", "역사 이야기", "한국 역사"],
  society: ["사회", "트렌드", "사회 이슈", "최신 트렌드"],
  domestic_story: ["감동", "실화", "사연", "감동 이야기", "국내 사연"],
  international_story: ["해외", "감동", "실화", "해외 사연", "국제 미담"],
  space: ["우주", "천문학", "우주 탐사", "별", "행성", "블랙홀", "우주 미스터리"],
}

export async function POST(request: NextRequest) {
  try {
    const { category } = await request.json()

    if (!category) {
      return NextResponse.json({ error: "카테고리가 필요합니다" }, { status: 400 })
    }

    const apiKey = process.env.YOUTUBE_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "YouTube API 키가 설정되지 않았습니다" }, { status: 500 })
    }

    // 최근 일주일 계산
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const publishedAfter = oneWeekAgo.toISOString()

    // 카테고리별 검색 키워드 가져오기
    const keywords = categorySearchKeywords[category as Category] || [category]

    // 모든 키워드로 검색한 결과를 합치기
    const allVideos: Array<{
      title: string
      viewCount: number
      videoId: string
    }> = []

    for (const keyword of keywords.slice(0, 3)) {
      // 각 키워드로 최근 일주일간 영상 검색
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(keyword)}&type=video&videoDuration=long&regionCode=KR&relevanceLanguage=ko&order=viewCount&publishedAfter=${publishedAfter}&key=${apiKey}`,
      )

      if (!searchResponse.ok) {
        console.error(`YouTube 검색 실패 (키워드: ${keyword}):`, searchResponse.status)
        continue
      }

      const searchData = await searchResponse.json()

      if (!searchData.items || searchData.items.length === 0) {
        continue
      }

      // 비디오 ID 추출
      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(",")

      // 비디오 통계 정보 가져오기
      const statsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`,
      )

      if (!statsResponse.ok) {
        continue
      }

      const statsData = await statsResponse.json()

      // 제목과 조회수 정보 수집
      searchData.items.forEach((item: any, index: number) => {
        const videoStats = statsData.items[index]
        if (videoStats) {
          allVideos.push({
            title: item.snippet.title,
            viewCount: Number.parseInt(videoStats.statistics?.viewCount || "0"),
            videoId: item.id.videoId,
          })
        }
      })

      // API 할당량 고려하여 약간의 딜레이
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // 조회수 기준으로 정렬
    allVideos.sort((a, b) => b.viewCount - a.viewCount)

    // 중복 제목 제거 (제목이 유사한 것도 제거)
    const uniqueTitles: string[] = []
    const seenTitles = new Set<string>()

    for (const video of allVideos) {
      // 제목 정규화 (공백 제거, 소문자 변환)
      const normalizedTitle = video.title
        .replace(/\s+/g, "")
        .toLowerCase()
        .substring(0, 30) // 앞 30자만 비교

      if (!seenTitles.has(normalizedTitle)) {
        seenTitles.add(normalizedTitle)
        uniqueTitles.push(video.title)

        // 최대 10개까지만
        if (uniqueTitles.length >= 10) {
          break
        }
      }
    }

    return NextResponse.json({ topics: uniqueTitles })
  } catch (error) {
    console.error("YouTube 인기 주제 조회 실패:", error)
    return NextResponse.json(
      { error: "인기 주제를 가져오는 중 오류가 발생했습니다", topics: [] },
      { status: 500 },
    )
  }
}


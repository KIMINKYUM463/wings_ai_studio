import { NextRequest, NextResponse } from "next/server"

/**
 * 네이버 뉴스 검색 API
 * 
 * API 엔드포인트: https://openapi.naver.com/v1/search/news.json
 * 무료 할당량: 하루 25,000건
 * 
 * 파라미터:
 * - query: 검색어 (필수, UTF-8 인코딩)
 * - display: 한 번에 표시할 검색 결과 개수 (선택, 기본값: 10, 최대: 100)
 * - start: 검색 시작 위치 (선택, 기본값: 1, 최대: 1000)
 * - sort: 정렬 방법 (선택, sim: 정확도순, date: 날짜순)
 */

export async function POST(request: NextRequest) {
  try {
    const { keyword } = await request.json()

    if (!keyword) {
      return NextResponse.json({ error: "키워드가 필요합니다" }, { status: 400 })
    }

    console.log("[News] 네이버 뉴스 검색 API 호출, 키워드:", keyword)

    // 네이버 API 키 (환경 변수 우선, 없으면 제공된 키 사용)
    const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "6kB_OaGlrFRnTxS1gGVw"
    const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "RsRHEjRQXq"

    // 네이버 뉴스 검색 API 호출
    const apiUrl = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=10&sort=date`
    
    const response = await fetch(apiUrl, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[News] 네이버 API 오류:", response.status, errorText)
      
      // 오류 응답 파싱 시도
      let errorMessage = `네이버 API 오류: ${response.status}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.errorMessage || errorMessage
      } catch {
        // JSON 파싱 실패 시 원본 텍스트 사용
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // API 응답 데이터 변환
    const newsItems = (data.items || []).map((item: any) => ({
      title: item.title.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'), // HTML 태그 및 엔티티 제거
      link: item.link,
      description: item.description.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'), // HTML 태그 및 엔티티 제거
      pubDate: item.pubDate,
      originallink: item.originallink, // 원문 링크
    }))

    console.log("[News] 네이버 API 뉴스 검색 완료:", newsItems.length, "개 (전체:", data.total, "개)")

    return NextResponse.json({ 
      success: true, 
      news: newsItems,
      count: newsItems.length,
      total: data.total || 0,
      source: "naver_api"
    })
  } catch (error) {
    console.error("[News] 뉴스 검색 API 오류:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "뉴스 검색에 실패했습니다." },
      { status: 500 }
    )
  }
}


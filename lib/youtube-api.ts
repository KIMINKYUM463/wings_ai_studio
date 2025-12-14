/**
 * YouTube Data API 헬퍼 함수
 */

interface YouTubeApiParams {
  [key: string]: string | number | undefined
}

/**
 * YouTube Data API를 호출하는 범용 함수
 * @param endpoint - API 엔드포인트 (예: 'search', 'videos', 'videoCategories')
 * @param params - API 파라미터 객체
 * @param apiKey - YouTube Data API 키
 * @returns API 응답 데이터
 */
export async function fetchYouTube(
  endpoint: string,
  params: YouTubeApiParams,
  apiKey: string
): Promise<any> {
  // 기본 URL 구성
  const baseUrl = "https://www.googleapis.com/youtube/v3"
  
  // 파라미터를 URL 쿼리 문자열로 변환
  const queryParams = new URLSearchParams()
  
  // apiKey 추가
  queryParams.append("key", apiKey)
  
  // 나머지 파라미터 추가
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value))
    }
  })
  
  // 최종 URL 구성
  const url = `${baseUrl}/${endpoint}?${queryParams.toString()}`
  
  // API 호출
  const response = await fetch(url)
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `YouTube API 오류: ${errorData.error?.message || response.statusText}`
    )
  }
  
  return await response.json()
}

/**
 * 한국 지역의 동영상 카테고리 목록을 가져옵니다.
 * @param apiKey - YouTube Data API 키
 * @returns 카테고리 목록 (id, title)
 */
export async function getVideoCategories(apiKey: string) {
  // 유튜브 API에 '한국(KR)' 지역의 동영상 카테고리 목록을 요청합니다.
  const data = await fetchYouTube(
    "videoCategories",
    { part: "snippet", regionCode: "KR" },
    apiKey
  )

  // 받아온 데이터에서 ID와 제목(예: 엔터테인먼트, 스포츠 등)만 추출하여 반환합니다.
  return data.items.map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
  }))
}



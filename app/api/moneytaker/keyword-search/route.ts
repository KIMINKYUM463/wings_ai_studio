import { NextRequest, NextResponse } from "next/server"

/**
 * 네이버 검색광고 키워드 도구 API
 * 
 * 네이버 검색광고 키워드 도구 API를 사용하여 키워드의 월 검색량을 조회하고,
 * 연관 키워드도 함께 반환합니다.
 */

interface KeywordSearchResult {
  keyword: string
  pc: number
  mobile: number
  total: number
}

export async function POST(request: NextRequest) {
  try {
    const { keywords } = await request.json()

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: "키워드가 필요합니다." },
        { status: 400 }
      )
    }

    // 네이버 검색광고 API 키
    const NAVER_SEARCHAD_ACCESS_LICENSE = process.env.NAVER_SEARCHAD_ACCESS_LICENSE || "01000000003c379e5dbdf33c01c85d8d8973c0201747d30cb57fbaf26855778d6f054a12aa"
    const NAVER_SEARCHAD_SECRET_KEY = process.env.NAVER_SEARCHAD_SECRET_KEY || "AQAAAAA8N55dvfM8AchdjYlzwCAXDxekkH3pDCJ2pfJiR1u3Dg=="
    const NAVER_SEARCHAD_CUSTOMER_ID = process.env.NAVER_SEARCHAD_CUSTOMER_ID || "2036952"

    console.log("[MoneyTaker] 키워드 검색 시작 (검색광고 API 사용):", keywords)

    // 네이버 검색광고 키워드 도구 API로 모든 키워드 조회
    // 검색 결과와 연관 키워드 모두 검색광고 API 사용
    const results: KeywordSearchResult[] = []
    const relatedKeywords: KeywordSearchResult[] = []

    // 서명 생성 함수 (샘플 코드 기반)
    const crypto = await import('crypto')
    function generateSignature(timestamp: string, method: string, uri: string): string {
      const message = `${timestamp}.${method}.${uri}`
      // 비밀키는 base64 디코딩 없이 원본 문자열로 사용 (샘플 코드 기준)
      return crypto
        .createHmac('sha256', NAVER_SEARCHAD_SECRET_KEY)
        .update(message)
        .digest('base64')
    }

    // 검색량 값을 숫자로 변환하는 함수 ("< 10" 같은 문자열 처리)
    function parseSearchCount(value: any): number {
      if (typeof value === 'number') {
        return value
      }
      if (typeof value === 'string') {
        // "< 10" 같은 형식 처리
        const match = value.match(/<[\s]*(\d+)/)
        if (match) {
          return parseInt(match[1], 10) - 1 // "< 10"이면 9로 처리
        }
        // 숫자 문자열인 경우
        const num = parseInt(value.replace(/[^0-9]/g, ''), 10)
        if (!isNaN(num)) {
          return num
        }
      }
      return 0
    }

    console.log("[MoneyTaker] 네이버 검색광고 키워드 도구 API 호출 시작")

    // 각 키워드에 대해 네이버 검색광고 키워드 도구 API로 조회
    for (const keyword of keywords) {
      try {
        // 네이버 검색광고 키워드 도구 API 호출 (GET 방식, 샘플 코드 기반)
        const uri = "/keywordstool"
        const method = "GET"
        const timestamp = Date.now().toString()
        
        // 서명 생성 (샘플 코드 형식: timestamp.method.uri)
        const signature = generateSignature(timestamp, method, uri)
        
        // 쿼리 파라미터로 키워드 전달
        const keywordToolUrl = `https://api.searchad.naver.com${uri}?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`
        
        const authHeaders: Record<string, string> = {
          'X-Timestamp': timestamp,
          'X-API-KEY': NAVER_SEARCHAD_ACCESS_LICENSE,
          'X-Customer': NAVER_SEARCHAD_CUSTOMER_ID,
          'X-Signature': signature,
        }

        console.log(`[MoneyTaker] 검색광고 키워드 도구 API 호출: ${keyword}`)
        console.log(`[MoneyTaker] 서명 정보:`, {
          timestamp,
          method,
          uri,
          signature,
        })
        
        const keywordToolResponse = await fetch(keywordToolUrl, {
          method: "GET",
          headers: authHeaders,
        })

        if (!keywordToolResponse.ok) {
          const errorText = await keywordToolResponse.text()
          console.error(`[MoneyTaker] 검색광고 API 오류 (${keyword}):`, keywordToolResponse.status, errorText)
          continue // 해당 키워드 스킵
        }

        const keywordToolData = await keywordToolResponse.json()
        console.log(`[MoneyTaker] 검색광고 API 응답 (${keyword}):`, JSON.stringify(keywordToolData, null, 2))
        
        // 네이버 검색광고 키워드 도구 API 응답 처리
        // 샘플 코드 응답 형식: 배열로 relKeyword, monthlyPcQcCnt, monthlyMobileQcCnt 등 포함
        if (Array.isArray(keywordToolData)) {
          // 응답이 배열인 경우 (샘플 코드 형식)
          for (const item of keywordToolData) {
            const monthlyPcQcCnt = parseSearchCount(item.monthlyPcQcCnt)
            const monthlyMobileQcCnt = parseSearchCount(item.monthlyMobileQcCnt)
            const monthlyQcCnt = parseSearchCount(item.monthlyQcCnt) || (monthlyPcQcCnt + monthlyMobileQcCnt)

            // 검색량이 0이어도 데이터가 있으면 추가
            const keywordData: KeywordSearchResult = {
              keyword: item.relKeyword || item.keyword || keyword,
              pc: monthlyPcQcCnt,
              mobile: monthlyMobileQcCnt,
              total: monthlyQcCnt,
            }

            // 메인 키워드와 일치하면 검색 결과에 추가
            if (item.relKeyword === keyword || item.keyword === keyword) {
              results.push(keywordData)
            } else {
              // 연관 키워드는 연관 키워드 배열에 추가
              relatedKeywords.push(keywordData)
            }
          }
        } else if (keywordToolData.keywordList && Array.isArray(keywordToolData.keywordList)) {
          // 응답이 객체이고 keywordList 배열이 있는 경우
          for (const item of keywordToolData.keywordList) {
            const monthlyPcQcCnt = parseSearchCount(item.monthlyPcQcCnt)
            const monthlyMobileQcCnt = parseSearchCount(item.monthlyMobileQcCnt)
            const monthlyQcCnt = parseSearchCount(item.monthlyQcCnt) || (monthlyPcQcCnt + monthlyMobileQcCnt)

            const keywordData: KeywordSearchResult = {
              keyword: item.relKeyword || item.keyword || keyword,
              pc: monthlyPcQcCnt,
              mobile: monthlyMobileQcCnt,
              total: monthlyQcCnt,
            }

            if (item.relKeyword === keyword || item.keyword === keyword) {
              results.push(keywordData)
            } else {
              relatedKeywords.push(keywordData)
            }
          }
        } else if (keywordToolData.keywords && Array.isArray(keywordToolData.keywords)) {
          // 다른 응답 구조 지원
          for (const item of keywordToolData.keywords) {
            const monthlyPcQcCnt = parseSearchCount(item.monthlyPcQcCnt || item.pcQcCnt)
            const monthlyMobileQcCnt = parseSearchCount(item.monthlyMobileQcCnt || item.mobileQcCnt)
            const monthlyQcCnt = parseSearchCount(item.monthlyQcCnt || item.qcCnt) || (monthlyPcQcCnt + monthlyMobileQcCnt)

            const keywordData: KeywordSearchResult = {
              keyword: item.keyword || item.relKeyword || keyword,
              pc: monthlyPcQcCnt,
              mobile: monthlyMobileQcCnt,
              total: monthlyQcCnt,
            }

            if (item.keyword === keyword || item.relKeyword === keyword) {
              results.push(keywordData)
            } else {
              relatedKeywords.push(keywordData)
            }
          }
        } else if (keywordToolData.data && Array.isArray(keywordToolData.data)) {
          // 또 다른 응답 구조
          for (const item of keywordToolData.data) {
            const monthlyPcQcCnt = parseSearchCount(item.monthlyPcQcCnt || item.pcQcCnt)
            const monthlyMobileQcCnt = parseSearchCount(item.monthlyMobileQcCnt || item.mobileQcCnt)
            const monthlyQcCnt = parseSearchCount(item.monthlyQcCnt || item.qcCnt) || (monthlyPcQcCnt + monthlyMobileQcCnt)

            const keywordData: KeywordSearchResult = {
              keyword: item.relKeyword || item.keyword || keyword,
              pc: monthlyPcQcCnt,
              mobile: monthlyMobileQcCnt,
              total: monthlyQcCnt,
            }

            if (item.relKeyword === keyword || item.keyword === keyword) {
              results.push(keywordData)
            } else {
              relatedKeywords.push(keywordData)
            }
          }
        }

        // 메인 키워드가 결과에 없으면 추가 (검색량이 0일 수도 있음)
        const mainKeywordFound = results.some(r => r.keyword === keyword)
        if (!mainKeywordFound) {
          // API 응답에서 메인 키워드를 찾지 못한 경우, 연관 키워드에서 찾기
          const foundIndex = relatedKeywords.findIndex(r => r.keyword === keyword)
          if (foundIndex !== -1) {
            results.push(relatedKeywords[foundIndex])
            relatedKeywords.splice(foundIndex, 1) // 연관 키워드 배열에서 제거
          }
        }
      } catch (error) {
        console.error(`[MoneyTaker] 키워드 조회 오류 (${keyword}):`, error)
      }
    }

    // 모든 키워드 조회 실패 시 에러 반환
    if (results.length === 0 && relatedKeywords.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: "키워드 조회에 실패했습니다. 네이버 검색광고 API를 확인해주세요.",
          results: [],
          relatedKeywords: [],
        },
        { status: 500 }
      )
    }


    console.log("[MoneyTaker] 키워드 검색 완료:", {
      resultsCount: results.length,
      relatedCount: relatedKeywords.length,
    })

    return NextResponse.json({
      success: true,
      results,
      relatedKeywords,
      source: "naver_searchad",
    })
  } catch (error) {
    console.error("[MoneyTaker] 키워드 검색 오류:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "키워드 검색에 실패했습니다.",
      },
      { status: 500 }
    )
  }
}


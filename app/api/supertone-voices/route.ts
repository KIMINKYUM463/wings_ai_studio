import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const apiKey = searchParams.get("apiKey")

    if (!apiKey) {
      return NextResponse.json({ error: "수퍼톤 API 키가 필요합니다." }, { status: 400 })
    }

    console.log("[Superton] 음성 목록 가져오기 시작")
    console.log("[Superton] API 키 길이:", apiKey?.length || 0)

    // 수퍼톤 API 호출 - GET /v1/voices
    // 실제 베이스 URL: https://supertoneapi.com
    // 인증 헤더: x-sup-api-key (Bearer가 아님)
    const apiUrl = "https://supertoneapi.com/v1/voices"
    console.log("[Superton] API URL:", apiUrl)
    
    // 타임아웃 설정 (30초)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    let response: Response
    try {
      response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-sup-api-key": apiKey, // Bearer가 아닌 커스텀 헤더 사용
          "User-Agent": "WingsAIStudio/1.0",
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      console.error("[Superton] fetch 오류 상세:", {
        message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        name: fetchError instanceof Error ? fetchError.name : "Unknown",
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
        cause: fetchError instanceof Error ? (fetchError as any).cause : undefined,
      })
      
      // AbortError는 타임아웃
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json(
          {
            success: false,
            error: "수퍼톤 API 연결 타임아웃 (30초 초과)\n\n가능한 원인:\n1. 네트워크 연결이 느림\n2. API 서버 응답 지연\n3. 방화벽 또는 프록시 설정 문제",
          },
          { status: 504 }
        )
      }
      
      // fetch failed는 일반적으로 네트워크 문제이거나 잘못된 URL
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError)
      return NextResponse.json(
        {
          success: false,
          error: `수퍼톤 API 연결 실패: ${errorMessage}\n\n가능한 원인:\n1. 네트워크 연결 문제\n2. API 엔드포인트 URL이 올바르지 않음 (현재: ${apiUrl})\n3. SSL/TLS 인증서 문제\n4. API 키가 올바르지 않음\n\n수퍼톤 API 문서를 확인하여 올바른 엔드포인트 URL을 확인해주세요.`,
        },
        { status: 500 }
      )
    }

    console.log("[Superton] 응답 상태:", response.status, response.statusText)
    console.log("[Superton] 응답 헤더:", Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      let errorText = ""
      try {
        errorText = await response.text()
        console.log("[Superton] 에러 응답 본문:", errorText)
        try {
          const errorJson = JSON.parse(errorText)
          errorText = errorJson.detail?.message || errorJson.message || errorJson.error || errorText
        } catch {
          // JSON이 아니면 그대로 사용
        }
      } catch (e) {
        errorText = `응답 읽기 실패: ${e instanceof Error ? e.message : String(e)}`
      }
      
      console.error("[Superton] API 오류:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      
      return NextResponse.json(
        {
          success: false,
          error: `수퍼톤 API 호출 실패 (${response.status}): ${errorText}`,
        },
        { status: response.status }
      )
    }

    // 응답 본문 읽기
    let data: any
    try {
      const responseText = await response.text()
      console.log("[Superton] 응답 본문 (처음 500자):", responseText.substring(0, 500))
      
      if (!responseText || responseText.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "수퍼톤 API 응답이 비어있습니다." },
          { status: 500 }
        )
      }

      try {
        data = JSON.parse(responseText)
        console.log("[Superton] 파싱된 데이터 타입:", Array.isArray(data) ? "배열" : typeof data)
      } catch (parseError) {
        console.error("[Superton] JSON 파싱 실패:", parseError)
        return NextResponse.json(
          { success: false, error: `수퍼톤 API 응답 파싱 실패: ${parseError instanceof Error ? parseError.message : String(parseError)}` },
          { status: 500 }
        )
      }
    } catch (readError) {
      console.error("[Superton] 응답 읽기 실패:", readError)
      return NextResponse.json(
        { success: false, error: `응답 읽기 실패: ${readError instanceof Error ? readError.message : String(readError)}` },
        { status: 500 }
      )
    }
    
    // 응답 형식에 따라 조정
    // 실제 응답 형식: {"items": [...]}
    let voices = []
    if (Array.isArray(data)) {
      voices = data
      console.log("[Superton] 배열 형식 응답, 음성 수:", voices.length)
    } else if (data.items && Array.isArray(data.items)) {
      voices = data.items
      console.log("[Superton] items 필드 형식 응답, 음성 수:", voices.length)
    } else if (data.voices && Array.isArray(data.voices)) {
      voices = data.voices
      console.log("[Superton] voices 필드 형식 응답, 음성 수:", voices.length)
    } else if (data.data && Array.isArray(data.data)) {
      voices = data.data
      console.log("[Superton] data 필드 형식 응답, 음성 수:", voices.length)
    } else {
      console.error("[Superton] 알 수 없는 응답 형식:", JSON.stringify(data).substring(0, 200))
      return NextResponse.json(
        { success: false, error: `수퍼톤 API 응답 형식이 올바르지 않습니다. 응답: ${JSON.stringify(data).substring(0, 200)}` },
        { status: 500 }
      )
    }

    console.log(`[Superton] 음성 목록 가져오기 완료: ${voices.length}개`)

    return NextResponse.json({
      success: true,
      voices: voices,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    console.error("[Superton] 음성 목록 가져오기 오류:", {
      error: errorMessage,
    })
    
    return NextResponse.json(
      {
        success: false,
        error: `음성 목록 가져오기 실패: ${errorMessage}`,
      },
      { status: 500 }
    )
  }
}


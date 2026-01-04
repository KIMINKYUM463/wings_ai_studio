import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const apiKey = searchParams.get("apiKey")

    if (!apiKey) {
      return NextResponse.json({ error: "ElevenLabs API 키가 필요합니다." }, { status: 400 })
    }

    console.log("[ElevenLabs] 음성 목록 가져오기 시작")
    console.log("[ElevenLabs] API 키 길이:", apiKey?.length || 0)

    // ElevenLabs API 호출 - GET /v1/voices
    const apiUrl = "https://api.elevenlabs.io/v1/voices"
    console.log("[ElevenLabs] API URL:", apiUrl)
    
    // 타임아웃 설정 (30초)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    let response: Response
    try {
      response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "xi-api-key": apiKey,
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      console.error("[ElevenLabs] fetch 오류 상세:", {
        message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        name: fetchError instanceof Error ? fetchError.name : "Unknown",
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
      })
      
      // AbortError는 타임아웃
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json(
          {
            success: false,
            error: "ElevenLabs API 연결 타임아웃 (30초 초과)\n\n가능한 원인:\n1. 네트워크 연결이 느림\n2. API 서버 응답 지연\n3. 방화벽 또는 프록시 설정 문제",
          },
          { status: 504 }
        )
      }
      
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError)
      return NextResponse.json(
        {
          success: false,
          error: `ElevenLabs API 연결 실패: ${errorMessage}\n\n가능한 원인:\n1. 네트워크 연결 문제\n2. API 엔드포인트 URL이 올바르지 않음 (현재: ${apiUrl})\n3. SSL/TLS 인증서 문제\n4. API 키가 올바르지 않음`,
        },
        { status: 500 }
      )
    }

    console.log("[ElevenLabs] 응답 상태:", response.status, response.statusText)

    if (!response.ok) {
      let errorText = ""
      try {
        errorText = await response.text()
        console.log("[ElevenLabs] 에러 응답 본문:", errorText)
        try {
          const errorJson = JSON.parse(errorText)
          errorText = errorJson.detail?.message || errorJson.message || errorJson.error || errorText
        } catch {
          // JSON이 아니면 그대로 사용
        }
      } catch (e) {
        errorText = `응답 읽기 실패: ${e instanceof Error ? e.message : String(e)}`
      }
      
      console.error("[ElevenLabs] API 오류:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      
      // 401 오류인 경우 권한 문제 안내
      if (response.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: `ElevenLabs API 키 권한이 없습니다.\n\n오류: ${errorText}\n\n해결 방법:\n1. ElevenLabs 대시보드에서 API 키의 권한을 확인하세요\n2. 'voices_read' 권한이 있는 API 키를 사용하세요\n3. 또는 기본 목소리 ID를 직접 사용할 수 있습니다\n\n기본 목소리 ID:\n- Rachel: jB1Cifc2UQbq1gR3wnb0\n- Voice 2: 8jHHF8rMqMlg8if2mOUe\n- Voice 3: uyVNoMrnUku1dZyVEXwD`,
          },
          { status: response.status }
        )
      }
      
      return NextResponse.json(
        {
          success: false,
          error: `ElevenLabs API 호출 실패 (${response.status}): ${errorText}`,
        },
        { status: response.status }
      )
    }

    // 응답 본문 읽기
    let data: any
    try {
      const responseText = await response.text()
      console.log("[ElevenLabs] 응답 본문 (처음 500자):", responseText.substring(0, 500))
      
      if (!responseText || responseText.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "ElevenLabs API 응답이 비어있습니다." },
          { status: 500 }
        )
      }

      try {
        data = JSON.parse(responseText)
        console.log("[ElevenLabs] 파싱된 데이터 타입:", Array.isArray(data) ? "배열" : typeof data)
      } catch (parseError) {
        console.error("[ElevenLabs] JSON 파싱 실패:", parseError)
        return NextResponse.json(
          { success: false, error: `ElevenLabs API 응답 파싱 실패: ${parseError instanceof Error ? parseError.message : String(parseError)}` },
          { status: 500 }
        )
      }
    } catch (readError) {
      console.error("[ElevenLabs] 응답 읽기 실패:", readError)
      return NextResponse.json(
        { success: false, error: `응답 읽기 실패: ${readError instanceof Error ? readError.message : String(readError)}` },
        { status: 500 }
      )
    }
    
    // ElevenLabs API 응답 형식: {"voices": [...]}
    let voices = []
    if (Array.isArray(data)) {
      voices = data
      console.log("[ElevenLabs] 배열 형식 응답, 음성 수:", voices.length)
    } else if (data.voices && Array.isArray(data.voices)) {
      voices = data.voices
      console.log("[ElevenLabs] voices 필드 형식 응답, 음성 수:", voices.length)
    } else if (data.items && Array.isArray(data.items)) {
      voices = data.items
      console.log("[ElevenLabs] items 필드 형식 응답, 음성 수:", voices.length)
    } else if (data.data && Array.isArray(data.data)) {
      voices = data.data
      console.log("[ElevenLabs] data 필드 형식 응답, 음성 수:", voices.length)
    } else {
      console.error("[ElevenLabs] 알 수 없는 응답 형식:", JSON.stringify(data).substring(0, 200))
      return NextResponse.json(
        { success: false, error: `ElevenLabs API 응답 형식이 올바르지 않습니다. 응답: ${JSON.stringify(data).substring(0, 200)}` },
        { status: 500 }
      )
    }

    // ElevenLabs 응답 형식 변환: {voice_id, name, ...} -> {id, name, ...}
    const formattedVoices = voices.map((voice: any) => ({
      id: voice.voice_id || voice.id,
      name: voice.name || "Unknown",
      description: voice.description || "",
      category: voice.category || "",
      preview_url: voice.preview_url || "",
      settings: voice.settings || {},
    }))

    console.log(`[ElevenLabs] 음성 목록 가져오기 완료: ${formattedVoices.length}개`)

    return NextResponse.json({
      success: true,
      voices: formattedVoices,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    console.error("[ElevenLabs] 음성 목록 가져오기 오류:", {
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


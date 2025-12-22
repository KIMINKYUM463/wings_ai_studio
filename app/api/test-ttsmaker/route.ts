import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey } = body

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "API 키가 제공되지 않았습니다." },
        { status: 400 }
      )
    }

    // TTSMaker API로 간단한 테스트 요청 (짧은 텍스트로 테스트)
    const endpoint = "https://api.ttsmaker.com/v2/create-tts-order"
    
    const requestBody = {
      api_key: apiKey,
      text: "테스트", // 최소한의 텍스트로 테스트
      voice_id: 503, // 실제 사용 중인 음성 ID (여성1)
      audio_format: "mp3",
      audio_speed: 1,
      audio_volume: 1,
      audio_pitch: 1,
      audio_high_quality: 0,
      text_paragraph_pause_time: 0,
      emotion_style_key: "",
      emotion_intensity: 1,
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    // TTSMaker API 응답 파싱 (HTTP 상태 코드와 관계없이 응답 본문 확인)
    let data: any
    try {
      const responseText = await response.text()
      console.log("[Test TTSMaker] API 응답:", responseText)
      data = JSON.parse(responseText)
    } catch (parseError) {
      // 응답이 JSON이 아닌 경우
      return NextResponse.json(
        {
          success: false,
          message: `연결 실패: API 응답을 파싱할 수 없습니다. (HTTP ${response.status})`,
        },
        { status: response.status || 500 }
      )
    }

    // TTSMaker API는 HTTP 200으로 응답하지만 error_code로 오류를 표시할 수 있음
    // error_code가 0이 아니면 오류
    if (data.error_code !== undefined && data.error_code !== 0) {
      const errorMessage = 
        data.error_summary || 
        data.msg || 
        data.message || 
        data.error || 
        `오류 코드: ${data.error_code}` ||
        "알 수 없는 오류"
      
      console.error("[Test TTSMaker] API 오류:", {
        error_code: data.error_code,
        error_summary: data.error_summary,
        msg: data.msg,
        message: data.message,
        error: data.error,
        fullResponse: data,
      })
      
      return NextResponse.json(
        {
          success: false,
          message: `연결 실패: ${errorMessage}`,
        },
        { status: 400 }
      )
    }

    // HTTP 상태 코드가 200이 아니면 오류
    if (!response.ok) {
      const errorMessage = 
        data.error_summary || 
        data.msg || 
        data.message || 
        data.error || 
        `HTTP ${response.status}: ${response.statusText}`
      
      return NextResponse.json(
        {
          success: false,
          message: `연결 실패: ${errorMessage}`,
        },
        { status: response.status }
      )
    }

    // 성공 조건: error_code가 0이거나 audio_download_url이 있으면 성공
    if (data.error_code === 0 || data.audio_download_url || data.audio_download_backup_url) {
      return NextResponse.json({
        success: true,
        message: "연결 성공!",
      })
    } else {
      // 예상치 못한 응답 구조
      return NextResponse.json(
        {
          success: false,
          message: `연결 실패: ${data.error_summary || data.msg || data.message || "알 수 없는 오류"}`,
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error("[Test TTSMaker] 오류:", error)
    return NextResponse.json(
      {
        success: false,
        message: `연결 실패: ${error.message || "알 수 없는 오류"}`,
      },
      { status: 500 }
    )
  }
}


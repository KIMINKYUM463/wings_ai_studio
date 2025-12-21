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

    if (!response.ok) {
      let errorMessage = "Unknown error"
      try {
        const errorText = await response.clone().text()
        try {
          const errorDetails = JSON.parse(errorText)
          errorMessage = errorDetails.error_summary || errorDetails.msg || errorDetails.error || errorText
        } catch (parseError) {
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }
      return NextResponse.json(
        {
          success: false,
          message: `연결 실패: ${errorMessage}`,
        },
        { status: response.status }
      )
    }

    // TTSMaker API 응답 파싱
    const data = await response.json()
    
    // 실제 API 응답 구조에 맞게 확인: error_code가 0이면 성공
    if (data.error_code === 0 || data.audio_download_url || data.audio_download_backup_url) {
      return NextResponse.json({
        success: true,
        message: "연결 성공!",
      })
    } else {
      // 에러 응답 처리
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


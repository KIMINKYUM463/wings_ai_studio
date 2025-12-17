import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId, apiKey } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "텍스트가 필요합니다." }, { status: 400 })
    }

    if (!voiceId) {
      return NextResponse.json({ error: "목소리 ID가 필요합니다." }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({ error: "ElevenLabs API 키가 필요합니다." }, { status: 400 })
    }

    console.log("[v0] ElevenLabs TTS 생성 시작, voiceId:", voiceId)
    console.log("[v0] 텍스트 길이:", text.length, "자")
    console.log("[v0] 텍스트 전체 내용:", text)

    // 텍스트가 너무 길면 ElevenLabs API 제한에 걸릴 수 있음 (일반적으로 5000자 제한)
    // 하지만 100-150자 대본이므로 문제없어야 함
    if (text.length > 5000) {
      return NextResponse.json(
        { success: false, error: "텍스트가 너무 깁니다. 최대 5000자까지 지원됩니다." },
        { status: 400 }
      )
    }

    // 대본을 그대로 사용 (절대 수정하거나 자르지 않음)
    const ttsText = text.trim()
    console.log("[v0] TTS API에 전달할 텍스트 길이:", ttsText.length, "자")
    console.log("[v0] TTS API에 전달할 텍스트 전체:", ttsText)

    // /with-timestamps 엔드포인트 사용하여 alignment 데이터 받아오기
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: ttsText, // 원본 대본 그대로 사용 (절대 수정하지 않음)
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    })

    if (!response.ok) {
      let errorText = ""
      try {
        errorText = await response.text()
        // JSON 응답인 경우 파싱 시도
        try {
          const errorJson = JSON.parse(errorText)
          errorText = errorJson.detail?.message || errorJson.message || errorJson.error || errorText
        } catch {
          // JSON이 아니면 그대로 사용
        }
      } catch (e) {
        errorText = `응답 읽기 실패: ${e instanceof Error ? e.message : String(e)}`
      }
      
      console.error("[v0] ElevenLabs API 오류:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        textLength: text.length,
        voiceId: voiceId,
      })
      
      return NextResponse.json(
        {
          success: false,
          error: `ElevenLabs API 호출 실패 (${response.status}): ${errorText}`,
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // /with-timestamps 응답 구조: { audio_base64, alignment }
    const audioBase64 = data.audio_base64 || data.audioBase64
    const alignment = data.alignment || null
    
    if (!audioBase64) {
      return NextResponse.json(
        {
          success: false,
          error: "오디오 데이터가 응답에 없습니다.",
        },
        { status: 500 }
      )
    }

    console.log("[v0] ElevenLabs TTS 생성 완료, 오디오 크기:", audioBase64.length, "문자 (base64)")
    
    if (alignment) {
      console.log("[v0] Alignment 데이터 수신:", {
        characters: alignment.characters?.length || 0,
        hasStartTimes: !!alignment.character_start_times_seconds,
        hasEndTimes: !!alignment.character_end_times_seconds,
      })
    } else {
      console.warn("[v0] 경고: Alignment 데이터가 없습니다. Fallback 방식 사용됩니다.")
    }

    return NextResponse.json({
      success: true,
      audioBase64,
      audioUrl: `data:audio/mpeg;base64,${audioBase64}`,
      alignment: alignment, // alignment 데이터 전달
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error("[v0] ElevenLabs TTS 생성 오류:", {
      error: errorMessage,
      stack: errorStack,
      textLength: text?.length,
      voiceId: voiceId,
    })
    
    return NextResponse.json(
      {
        success: false,
        error: `TTS 생성 실패: ${errorMessage}`,
      },
      { status: 500 }
    )
  }
}


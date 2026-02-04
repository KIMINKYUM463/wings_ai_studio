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
          stability: 0.7, // 0.65에서 0.7로 증가 (더 안정적이고 자연스러운 음성, 기계음 감소)
          similarity_boost: 0.75, // 0.8에서 0.75로 조정 (너무 높으면 기계음이 나올 수 있음)
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
      
      // 404 오류인 경우 커스텀 목소리 권한 문제 안내
      if (response.status === 404) {
        return NextResponse.json(
          {
            success: false,
            error: `ElevenLabs 커스텀 목소리를 찾을 수 없습니다.\n\n오류: ${errorText}\n\n가능한 원인:\n1. 목소리 ID가 올바르지 않습니다\n2. API 키가 해당 목소리를 생성한 계정의 키가 아닙니다\n3. 목소리가 삭제되었거나 비공개 상태입니다\n\n해결 방법:\n1. 목소리 ID를 다시 확인하세요\n2. 목소리를 생성한 계정의 API 키를 사용하세요\n3. ElevenLabs 대시보드에서 목소리가 존재하는지 확인하세요`,
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

    const data = await response.json()
    
    // alignment 데이터 추출
    const alignment = data.alignment || null
    let audioBase64 = ""
    let audioUrl = ""
    
    // audio 데이터 처리 (base64 또는 URL)
    if (data.audio) {
      if (typeof data.audio === 'string') {
        // base64 문자열인 경우
        audioBase64 = data.audio.replace(/^data:audio\/[^;]+;base64,/, '')
        audioUrl = data.audio
      } else if (data.audio instanceof ArrayBuffer) {
        // ArrayBuffer인 경우
        audioBase64 = Buffer.from(data.audio).toString("base64")
        audioUrl = `data:audio/mpeg;base64,${audioBase64}`
      }
    } else if (data.audio_base64) {
      // audio_base64 필드가 있는 경우
      audioBase64 = data.audio_base64
      audioUrl = `data:audio/mpeg;base64,${audioBase64}`
    } else {
      // audio가 없으면 일반 엔드포인트로 fallback
      console.warn("[v0] /with-timestamps 응답에 audio가 없습니다. 일반 엔드포인트로 fallback")
      const fallbackResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: ttsText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.7, // 0.65에서 0.7로 증가 (더 안정적이고 자연스러운 음성, 기계음 감소)
            similarity_boost: 0.75, // 0.8에서 0.75로 조정 (너무 높으면 기계음이 나올 수 있음)
          },
        }),
      })
      
      if (!fallbackResponse.ok) {
        throw new Error(`Fallback API 호출 실패: ${fallbackResponse.status}`)
      }
      
      const audioBuffer = await fallbackResponse.arrayBuffer()
      audioBase64 = Buffer.from(audioBuffer).toString("base64")
      audioUrl = `data:audio/mpeg;base64,${audioBase64}`
    }

    console.log("[v0] ElevenLabs TTS 생성 완료")
    console.log("[v0] alignment 데이터:", alignment ? "있음" : "없음")
    if (alignment) {
      console.log("[v0] alignment characters 개수:", alignment.characters?.length || 0)
    }
    
    // 오디오가 너무 짧으면 문제가 있을 수 있음 (최소 1KB 이상이어야 함)
    if (audioBase64.length < 1024) {
      console.warn("[v0] 경고: 생성된 오디오가 매우 짧습니다. 텍스트가 제대로 처리되지 않았을 수 있습니다.")
      console.warn("[v0] 원본 텍스트 길이:", ttsText.length, "자")
      console.warn("[v0] 원본 텍스트 내용:", ttsText)
    } else {
      console.log("[v0] 오디오 생성 성공 - 대본 전체가 포함되었는지 확인 필요")
    }

    return NextResponse.json({
      success: true,
      audioBase64,
      audioUrl,
      alignment: alignment || null, // alignment 데이터 포함
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


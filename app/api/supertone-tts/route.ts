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
      return NextResponse.json({ error: "수퍼톤 API 키가 필요합니다." }, { status: 400 })
    }

    console.log("[Superton] TTS 생성 시작, voiceId:", voiceId)
    console.log("[Superton] 텍스트 길이:", text.length, "자")

    // 수퍼톤 API 호출
    // 수퍼톤 API 문서에 따라 엔드포인트와 요청 형식 조정 필요
    // 일반적인 TTS API 구조를 기반으로 구현
    const response = await fetch("https://api.supertone.ai/v1/text-to-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text: text.trim(),
        voice_id: voiceId,
        format: "mp3",
        speed: 1.0,
      }),
    })

    if (!response.ok) {
      let errorText = ""
      try {
        errorText = await response.text()
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

    // 수퍼톤 API 응답 형식에 따라 조정 필요
    // 일반적으로 base64 오디오 데이터 또는 URL을 반환
    const data = await response.json()
    
    let audioBase64 = ""
    let audioUrl = ""
    
    if (data.audio) {
      if (typeof data.audio === 'string') {
        audioBase64 = data.audio.replace(/^data:audio\/[^;]+;base64,/, '')
        audioUrl = data.audio
      } else if (data.audio instanceof ArrayBuffer) {
        audioBase64 = Buffer.from(data.audio).toString("base64")
        audioUrl = `data:audio/mpeg;base64,${audioBase64}`
      }
    } else if (data.audio_base64) {
      audioBase64 = data.audio_base64
      audioUrl = `data:audio/mpeg;base64,${audioBase64}`
    } else if (data.audio_url) {
      // URL이 제공되는 경우
      audioUrl = data.audio_url
      // URL에서 오디오 다운로드하여 base64 변환
      try {
        const audioResponse = await fetch(audioUrl)
        const audioBuffer = await audioResponse.arrayBuffer()
        audioBase64 = Buffer.from(audioBuffer).toString("base64")
        audioUrl = `data:audio/mpeg;base64,${audioBase64}`
      } catch (e) {
        console.warn("[Superton] 오디오 URL 다운로드 실패, URL 그대로 사용:", e)
      }
    } else {
      return NextResponse.json(
        { success: false, error: "수퍼톤 API 응답에 오디오 데이터가 없습니다." },
        { status: 500 }
      )
    }

    console.log("[Superton] TTS 생성 완료")

    return NextResponse.json({
      success: true,
      audioBase64,
      audioUrl,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    console.error("[Superton] TTS 생성 오류:", {
      error: errorMessage,
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


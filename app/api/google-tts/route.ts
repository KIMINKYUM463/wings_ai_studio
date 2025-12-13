import { type NextRequest, NextResponse } from "next/server"

const GOOGLE_TTS_API_KEY = "AIzaSyDbmmJAT7rMFrWb3dShTtlmw1mYdPAtonc"

export async function POST(request: NextRequest) {
  try {
    const { text, voice = "ko-KR-Standard-A", speed = 1.0 } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "텍스트가 필요합니다." }, { status: 400 })
    }

    // 텍스트를 그대로 사용 (추출 로직 제거)
    const speechText = text.trim()

    if (!speechText) {
      return NextResponse.json({ error: "텍스트가 비어있습니다." }, { status: 400 })
    }

    console.log("[v0] Google TTS API 호출:", {
      textLength: speechText.length,
      voice,
      speed,
    })

    // voice에 따라 성별 결정
    // ko-KR-Neural2-A = 여성, ko-KR-Neural2-C = 남성
    const ssmlGender = voice === "ko-KR-Neural2-C" ? "MALE" : "FEMALE"

    // Google Text-to-Speech API 호출
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text: speechText }, // 추출된 스크립트만 사용
        voice: {
          languageCode: "ko-KR",
          name: voice,
          ssmlGender: ssmlGender,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: speed,
          pitch: 0,
          volumeGainDb: 0,
        },
      }),
    })

    if (!response.ok) {
      let errorMessage = "Unknown error"
      try {
        const errorData = await response.json()
        console.error("[v0] Google TTS API 오류:", errorData)
        errorMessage = errorData.error?.message || errorData.error || "Unknown error"
      } catch (e) {
        // JSON 파싱 실패 시 텍스트로 읽기 시도
        try {
          const errorText = await response.text()
          errorMessage = errorText || "Unknown error"
        } catch (textError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
      }
      throw new Error(`Google TTS API 오류: ${response.status} - ${errorMessage}`)
    }

    const data = await response.json()

    if (!data.audioContent) {
      throw new Error("오디오 콘텐츠를 받을 수 없습니다.")
    }

    // Base64 오디오 데이터
    const audioBase64 = data.audioContent
    const audioDataUrl = `data:audio/mp3;base64,${audioBase64}`

    console.log("[v0] Google TTS 생성 완료:", {
      textLength: speechText.length,
      audioSize: audioBase64.length,
    })

    // ElevenLabs와 동일한 형식으로 반환
    return NextResponse.json({
      success: true,
      audioBase64,
      audioUrl: audioDataUrl,
    })
  } catch (error) {
    console.error("[v0] Google TTS API 오류:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "TTS 생성에 실패했습니다.",
      },
      { status: 500 },
    )
  }
}

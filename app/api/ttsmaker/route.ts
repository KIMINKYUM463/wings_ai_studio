import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { text, voice = "ko-KR-Standard-A", speed = 1.0, pitch = 1.0, apiKey } = await request.json()
    
    // API 키 확인 (요청 본문에서 받거나 환경 변수에서 가져오기)
    const TTSMAKER_API_KEY = apiKey || process.env.TTSMAKER_API_KEY
    
    if (!TTSMAKER_API_KEY) {
      return NextResponse.json(
        { error: "TTSMaker API 키가 필요합니다. 설정에서 API 키를 입력해주세요." },
        { status: 400 }
      )
    }

    if (!text) {
      return NextResponse.json({ error: "텍스트가 필요합니다." }, { status: 400 })
    }

    const speechText = text.trim()

    if (!speechText) {
      return NextResponse.json({ error: "텍스트가 비어있습니다." }, { status: 400 })
    }

    // voice 파라미터를 voice_id로 변환
    // TTSMaker는 voice_id를 숫자로 사용
    // 제공된 음성 이름과 ID 매핑
    const voiceIdMap: Record<string, number> = {
      "여성1": 503,
      "여성2": 509,
      "여성6": 5802,
      "남성1": 5501,
      "남성4": 5888,
      "남성5": 5888, // 남성4와 동일한 voice_id, pitch만 다름
    }
    
    // pitch 매핑 (기본값 1.0, 남성5는 0.9)
    const pitchMap: Record<string, number> = {
      "남성5": 0.9, // -10%
    }

    console.log("[TTSMaker] 받은 voice 파라미터:", voice, "타입:", typeof voice)

    let voiceId: number
    
    // voice가 이미 숫자인 경우 그대로 사용
    if (typeof voice === "number") {
      voiceId = voice
      console.log(`[TTSMaker] 숫자 voice 사용: ${voiceId}`)
    } else if (!isNaN(Number(voice))) {
      voiceId = Number(voice)
      console.log(`[TTSMaker] 문자열 숫자 변환: ${voice} -> ${voiceId}`)
    } else {
      // voice 이름으로 매핑에서 찾기
      const trimmedVoice = String(voice).trim()
      voiceId = voiceIdMap[trimmedVoice]
      
      if (voiceId === undefined) {
        console.error(`[TTSMaker] 매핑 실패! voice="${trimmedVoice}"가 매핑에 없습니다.`)
        console.error(`[TTSMaker] 사용 가능한 voice 목록:`, Object.keys(voiceIdMap))
        // 매핑 실패 시 에러 발생
        throw new Error(`지원하지 않는 voice입니다: "${trimmedVoice}". 사용 가능한 voice: ${Object.keys(voiceIdMap).join(", ")}`)
      }
      
      console.log(`[TTSMaker] 음성 매핑 성공: "${trimmedVoice}" -> voice_id ${voiceId}`)
    }

    // pitch 결정 (voice에 따라 자동 설정되거나 전달된 값 사용)
    const finalPitch = pitchMap[String(voice).trim()] || pitch
    
    console.log("[TTSMaker] API 호출:", {
      textLength: speechText.length,
      voice,
      voiceId,
      speed,
      pitch: finalPitch,
    })

    // TTSMaker Pro API 호출
    // API 문서: https://pro.ttsmaker.com/api-platform/api-docs-v2
    // 엔드포인트: https://api.ttsmaker.com/v2/create-tts-order
    const endpoint = "https://api.ttsmaker.com/v2/create-tts-order"
    
    const requestBody = {
      api_key: TTSMAKER_API_KEY,
      text: speechText,
      voice_id: voiceId,
      audio_format: "mp3",
      audio_speed: speed,
      audio_volume: 1,
      audio_pitch: finalPitch,
      audio_high_quality: 0,
      text_paragraph_pause_time: 0,
      emotion_style_key: "",
      emotion_intensity: 1,
    }

    console.log(`[TTSMaker] 엔드포인트 호출: ${endpoint}`)
    
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
      let errorDetails: any = null
      try {
        const errorText = await response.clone().text()
        console.error("[TTSMaker] API 오류 응답 (텍스트):", errorText)
        try {
          errorDetails = JSON.parse(errorText)
          console.error("[TTSMaker] API 오류 응답 (JSON):", errorDetails)
          errorMessage = errorDetails.error_summary || errorDetails.msg || errorDetails.error || errorText
        } catch (parseError) {
          errorMessage = errorText || "Unknown error"
        }
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }
      console.error("[TTSMaker] 전체 오류 정보:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        errorMessage,
        errorDetails,
      })
      throw new Error(`TTSMaker API 오류: ${response.status} - ${errorMessage}`)
    }

    // TTSMaker API 응답 파싱
    const data = await response.json()
    
    if (data.error_code !== 0) {
      throw new Error(`TTSMaker API 오류: ${data.error_summary || data.msg || "Unknown error"}`)
    }

    // audio_download_url에서 오디오 파일 다운로드
    const audioDownloadUrl = data.audio_download_url || data.audio_download_backup_url
    
    if (!audioDownloadUrl) {
      throw new Error("TTSMaker API 응답에 오디오 URL이 없습니다.")
    }

    console.log("[TTSMaker] 오디오 다운로드 URL:", audioDownloadUrl)

    // 오디오 파일 다운로드
    const audioResponse = await fetch(audioDownloadUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    })

    if (!audioResponse.ok) {
      throw new Error(`오디오 파일 다운로드 실패: ${audioResponse.status}`)
    }

    const audioBuffer = await audioResponse.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString("base64")
    const audioDataUrl = `data:audio/mp3;base64,${audioBase64}`

    console.log("[TTSMaker] 생성 완료:", {
      textLength: speechText.length,
      audioSize: audioBase64.length,
    })

    return NextResponse.json({
      success: true,
      audioBase64,
      audioUrl: audioDataUrl,
    })
  } catch (error) {
    console.error("[TTSMaker] 오류:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "TTS 생성에 실패했습니다.",
      },
      { status: 500 },
    )
  }
}


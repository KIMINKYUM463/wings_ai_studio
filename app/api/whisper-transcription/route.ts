import { type NextRequest, NextResponse } from "next/server"

/**
 * Whisper API를 사용한 전체 텍스트 추출
 * OpenAI Whisper API를 사용하여 오디오에서 전체 텍스트와 세그먼트 타이밍을 추출합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File

    if (!audioFile) {
      return NextResponse.json({ error: "오디오 파일이 필요합니다." }, { status: 400 })
    }

    // OpenAI API 키 확인 (환경 변수 또는 요청에서)
    const openaiApiKey = process.env.OPENAI_API_KEY || process.env.GPT_API_KEY || process.env.CHATGPT_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 설정되지 않았습니다." }, { status: 500 })
    }

    console.log("[Whisper Transcription] 오디오 파일 분석 시작...")

    // 오디오 파일을 FormData로 준비
    const audioBlob = await audioFile.arrayBuffer()
    const audioBuffer = Buffer.from(audioBlob)

    // OpenAI Whisper API 호출 (verbose_json 형식으로 segments 포함)
    const formDataForOpenAI = new FormData()
    const audioBlobForOpenAI = new Blob([audioBuffer], { type: audioFile.type || "audio/wav" })
    formDataForOpenAI.append("file", audioBlobForOpenAI, audioFile.name || "audio.wav")
    formDataForOpenAI.append("model", "whisper-1")
    formDataForOpenAI.append("language", "ko") // 한국어
    formDataForOpenAI.append("response_format", "verbose_json") // 상세한 JSON 형식 (segments 포함)

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: formDataForOpenAI,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Whisper Transcription] OpenAI API 오류:", errorText)
      
      // API 키 오류 감지
      if (response.status === 401) {
        return NextResponse.json(
          { error: "OpenAI API 키가 올바르지 않거나 만료되었습니다." },
          { status: 401 }
        )
      }
      
      throw new Error(`OpenAI Whisper API 오류: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    console.log("[Whisper Transcription] OpenAI 응답 받음")

    // 결과에서 전체 텍스트와 세그먼트 타이밍 추출
    const text = data.text || ""
    const segments: Array<{ start: number; end: number; text: string }> = []

    // segments 배열에서 타이밍 정보 추출
    if (data.segments && Array.isArray(data.segments)) {
      for (const segment of data.segments) {
        if (typeof segment.start === "number" && typeof segment.end === "number" && segment.text) {
          segments.push({
            start: Number.parseFloat(segment.start.toFixed(5)),
            end: Number.parseFloat(segment.end.toFixed(5)),
            text: segment.text.trim(),
          })
        }
      }
    }

    console.log(`[Whisper Transcription] 텍스트 추출 완료: ${text.length}자, ${segments.length}개 세그먼트`)

    return NextResponse.json({
      text,
      segments,
    })
  } catch (error) {
    console.error("[Whisper Transcription] 오류:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 }
    )
  }
}













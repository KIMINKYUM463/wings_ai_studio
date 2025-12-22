import { type NextRequest, NextResponse } from "next/server"

/**
 * Whisper API를 사용한 단어별 타이밍 생성
 * OpenAI Whisper API를 사용하여 오디오에서 단어별 정확한 타이밍을 추출합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File
    const text = formData.get("text") as string

    if (!audioFile) {
      return NextResponse.json({ error: "오디오 파일이 필요합니다." }, { status: 400 })
    }

    if (!text) {
      return NextResponse.json({ error: "텍스트가 필요합니다." }, { status: 400 })
    }

    // OpenAI API 키 확인 (환경 변수 또는 요청에서)
    const openaiApiKey = process.env.OPENAI_API_KEY || process.env.GPT_API_KEY || process.env.CHATGPT_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 설정되지 않았습니다." }, { status: 500 })
    }

    console.log("[Whisper] 오디오 파일 분석 시작...")
    console.log("[Whisper] 텍스트:", text.substring(0, 100) + "...")

    // 오디오 파일을 FormData로 준비
    const audioBlob = await audioFile.arrayBuffer()
    const audioBuffer = Buffer.from(audioBlob)

    // OpenAI Whisper API 호출 (verbose_json 형식으로 segments 정보 받기)
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
      console.error("[Whisper] OpenAI API 오류:", errorText)
      
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
    console.log("[Whisper] OpenAI 응답 받음")

    // 결과에서 단어별 타이밍 추출
    const wordTimings: Array<{ word: string; start: number; end: number; confidence?: number }> = []

    // OpenAI Whisper API의 verbose_json 형식은 words 배열을 포함합니다
    if (data.words && Array.isArray(data.words)) {
      // words 배열 형식: [{ word: "단어", start: 0.0, end: 0.5 }]
      for (const wordData of data.words) {
        if (wordData.word && typeof wordData.start === "number" && typeof wordData.end === "number") {
          wordTimings.push({
            word: wordData.word.trim(),
            start: wordData.start,
            end: wordData.end,
            confidence: wordData.probability || 0.9, // OpenAI는 probability를 제공할 수 있음
          })
        }
      }
    } else if (data.segments && Array.isArray(data.segments)) {
      // segments 형식 (fallback): [{ start: 0.0, end: 1.5, text: "단어", words: [...] }]
      for (const segment of data.segments) {
        if (segment.words && Array.isArray(segment.words)) {
          // words 배열이 있으면 직접 사용
          for (const wordData of segment.words) {
            if (wordData.word && typeof wordData.start === "number" && typeof wordData.end === "number") {
              wordTimings.push({
                word: wordData.word.trim(),
                start: wordData.start,
                end: wordData.end,
                confidence: wordData.probability || segment.confidence || 0.9,
              })
            }
          }
        } else if (segment.text) {
          // words가 없으면 텍스트를 단어로 분리하고 시간 분배
          const words = segment.text.split(/\s+/).filter((w: string) => w.trim().length > 0)
          if (words.length > 0 && typeof segment.start === "number" && typeof segment.end === "number") {
            const duration = segment.end - segment.start
            const timePerWord = duration / words.length
            
            words.forEach((word: string, index: number) => {
              wordTimings.push({
                word: word.trim(),
                start: segment.start + (index * timePerWord),
                end: segment.start + ((index + 1) * timePerWord),
                confidence: segment.confidence || 0.9,
              })
            })
          }
        }
      }
    } else if (data.text) {
      // text만 있는 경우 (fallback) - 원본 텍스트와 비교하여 정렬
      console.warn("[Whisper] word-level timestamps 없음, 텍스트 기반 정렬 시도")
      const transcribedWords = data.text.split(/\s+/).filter((w: string) => w.trim().length > 0)
      const originalWords = text.split(/\s+/).filter((w: string) => w.trim().length > 0)
      
      // 원본 텍스트와 전사된 텍스트를 매칭
      // 간단한 매칭: 원본 텍스트의 단어 순서를 기준으로 시간 분배
      const totalDuration = data.duration || 10 // 기본값 10초
      const timePerWord = totalDuration / Math.max(originalWords.length, transcribedWords.length)
      
      originalWords.forEach((word: string, index: number) => {
        wordTimings.push({
          word: word.trim(),
          start: index * timePerWord,
          end: (index + 1) * timePerWord,
          confidence: 0.7,
        })
      })
    } else {
      // 결과 형식이 예상과 다를 경우 fallback
      console.warn("[Whisper] 예상하지 못한 결과 형식, 텍스트 기반 분배 사용")
      const words = text.split(/\s+/).filter((w: string) => w.trim().length > 0)
      const totalDuration = data.duration || 10 // 기본값 10초
      const timePerWord = totalDuration / words.length
      
      words.forEach((word: string, index: number) => {
        wordTimings.push({
          word: word.trim(),
          start: index * timePerWord,
          end: (index + 1) * timePerWord,
          confidence: 0.7,
        })
      })
    }

    console.log(`[Whisper] ${wordTimings.length}개 단어 타이밍 추출 완료`)

    // 원본 텍스트와 매칭하여 정확도 향상
    // Whisper가 인식한 단어와 원본 텍스트의 단어를 최대한 매칭
    const originalWords = text.split(/\s+/).filter((w: string) => w.trim().length > 0)
    const matchedWordTimings: Array<{ word: string; start: number; end: number; confidence?: number }> = []

    if (wordTimings.length > 0 && originalWords.length > 0) {
      // 단순 매칭: Whisper 결과와 원본 텍스트를 순서대로 매칭
      let whisperIndex = 0
      for (let i = 0; i < originalWords.length; i++) {
        const originalWord = originalWords[i].trim().toLowerCase()
        
        // Whisper 결과에서 가장 가까운 단어 찾기
        if (whisperIndex < wordTimings.length) {
          const whisperWord = wordTimings[whisperIndex].word.trim().toLowerCase()
          
          // 단어가 일치하거나 유사하면 사용
          if (originalWord === whisperWord || 
              originalWord.includes(whisperWord) || 
              whisperWord.includes(originalWord)) {
            matchedWordTimings.push({
              word: originalWords[i].trim(), // 원본 단어 사용
              start: wordTimings[whisperIndex].start,
              end: wordTimings[whisperIndex].end,
              confidence: wordTimings[whisperIndex].confidence,
            })
            whisperIndex++
          } else {
            // 일치하지 않으면 이전 단어의 시간을 기반으로 추정
            const prevEnd = matchedWordTimings.length > 0 
              ? matchedWordTimings[matchedWordTimings.length - 1].end 
              : (whisperIndex > 0 ? wordTimings[whisperIndex - 1].end : 0)
            const estimatedDuration = whisperIndex < wordTimings.length 
              ? (wordTimings[whisperIndex].start - prevEnd) 
              : 0.3 // 기본값 0.3초
            
            matchedWordTimings.push({
              word: originalWords[i].trim(),
              start: prevEnd,
              end: prevEnd + estimatedDuration,
              confidence: 0.6,
            })
          }
        } else {
          // Whisper 결과가 부족하면 이전 단어의 시간을 기반으로 추정
          const prevEnd = matchedWordTimings.length > 0 
            ? matchedWordTimings[matchedWordTimings.length - 1].end 
            : 0
          const estimatedDuration = 0.3 // 기본값 0.3초
          
          matchedWordTimings.push({
            word: originalWords[i].trim(),
            start: prevEnd,
            end: prevEnd + estimatedDuration,
            confidence: 0.5,
          })
        }
      }
    } else {
      // 매칭 실패 시 원본 wordTimings 사용
      matchedWordTimings.push(...wordTimings)
    }

    return NextResponse.json({
      wordTimings: matchedWordTimings.map((wt) => ({
        word: wt.word,
        start: Number.parseFloat(wt.start.toFixed(6)), // 소수점 6자리까지 정확하게
        end: Number.parseFloat(wt.end.toFixed(6)),
        confidence: wt.confidence || 0.9,
      })),
    })
  } catch (error) {
    console.error("[Whisper] 오류:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Whisper 분석 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}


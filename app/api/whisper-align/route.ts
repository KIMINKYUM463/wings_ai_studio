import { type NextRequest, NextResponse } from "next/server"

/**
 * 단어 유사도 계산 함수 (간단한 편집 거리 기반)
 * Forced Alignment에서 정답 대본과 Whisper 전사 결과를 매칭할 때 사용
 */
function calculateWordSimilarity(word1: string, word2: string): number {
  if (word1 === word2) return 1.0
  if (word1.includes(word2) || word2.includes(word1)) return 0.8
  
  // 간단한 편집 거리 계산
  const len1 = word1.length
  const len2 = word2.length
  const maxLen = Math.max(len1, len2)
  if (maxLen === 0) return 1.0
  
  let matches = 0
  const minLen = Math.min(len1, len2)
  for (let i = 0; i < minLen; i++) {
    if (word1[i] === word2[i]) matches++
  }
  
  return matches / maxLen
}

/**
 * Whisper API를 사용한 단어별 타이밍 생성
 * OpenAI Whisper API를 사용하여 오디오에서 단어별 정확한 타이밍을 추출합니다.
 * Forced Alignment: 정답 대본(text)을 음성에 강제로 정렬하여 더 정확한 타이밍 추출
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

    // OpenAI API 키 확인 (요청에서 우선, 없으면 환경 변수)
    const apiKeyFromRequest = formData.get("apiKey") as string
    const openaiApiKey = apiKeyFromRequest?.trim() || process.env.OPENAI_API_KEY || process.env.GPT_API_KEY || process.env.CHATGPT_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 설정되지 않았습니다." }, { status: 500 })
    }

    console.log("[Whisper] 오디오 파일 분석 시작...")
    console.log("[Whisper] 텍스트:", text.substring(0, 100) + "...")

    // 오디오 파일을 FormData로 준비
    const audioBlob = await audioFile.arrayBuffer()
    const audioBuffer = Buffer.from(audioBlob)

    // OpenAI Whisper API 호출 (verbose_json 형식으로 word-level timestamps 받기)
    // Forced Alignment: 정답 대본(text)을 음성에 강제로 정렬하여 더 정확한 타이밍 추출
    const formDataForOpenAI = new FormData()
    const audioBlobForOpenAI = new Blob([audioBuffer], { type: audioFile.type || "audio/wav" })
    formDataForOpenAI.append("file", audioBlobForOpenAI, audioFile.name || "audio.wav")
    formDataForOpenAI.append("model", "whisper-1")
    formDataForOpenAI.append("language", "ko") // 한국어
    formDataForOpenAI.append("response_format", "verbose_json") // 상세한 JSON 형식 (segments 포함)
    formDataForOpenAI.append("timestamp_granularities[]", "word") // word-level timestamps 요청
    formDataForOpenAI.append("timestamp_granularities[]", "segment") // segment-level timestamps도 함께 요청

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
    // 소수점 10자리 정밀도로 타이밍 저장
    if (data.words && Array.isArray(data.words)) {
      // words 배열 형식: [{ word: "단어", start: 0.0, end: 0.5 }]
      for (const wordData of data.words) {
        if (wordData.word && typeof wordData.start === "number" && typeof wordData.end === "number") {
          wordTimings.push({
            word: wordData.word.trim(),
            start: Number.parseFloat(wordData.start.toFixed(10)), // 소수점 10자리 정밀도
            end: Number.parseFloat(wordData.end.toFixed(10)), // 소수점 10자리 정밀도
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
                start: Number.parseFloat(wordData.start.toFixed(10)), // 소수점 10자리 정밀도
                end: Number.parseFloat(wordData.end.toFixed(10)), // 소수점 10자리 정밀도
                confidence: wordData.probability || segment.confidence || 0.9,
              })
            }
          }
        } else if (segment.text) {
          // words가 없으면 텍스트를 단어로 분리하고 시간 분배 (소수점 10자리 정밀도)
          const words = segment.text.split(/\s+/).filter((w: string) => w.trim().length > 0)
          if (words.length > 0 && typeof segment.start === "number" && typeof segment.end === "number") {
            const segmentStart = Number.parseFloat(segment.start.toFixed(10))
            const segmentEnd = Number.parseFloat(segment.end.toFixed(10))
            const duration = Number.parseFloat((segmentEnd - segmentStart).toFixed(10))
            const timePerWord = Number.parseFloat((duration / words.length).toFixed(10))
            
            words.forEach((word: string, index: number) => {
              const wordStart = Number.parseFloat((segmentStart + (index * timePerWord)).toFixed(10))
              const wordEnd = Number.parseFloat((segmentStart + ((index + 1) * timePerWord)).toFixed(10))
              wordTimings.push({
                word: word.trim(),
                start: wordStart,
                end: wordEnd,
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

    console.log(`[Whisper] ${wordTimings.length}개 단어 타이밍 추출 완료 (word-level timestamps 사용)`)

    // Forced Alignment: 정답 대본(text)을 음성에 강제로 정렬
    // TTS로 만든 음성은 이미 정답 대본이 있으므로, Whisper 전사 결과가 아닌 정답 대본을 기준으로 정렬
    // 단어 분리 방식을 개선: 공백과 문장부호를 모두 포함하되, 빈 문자열은 제거
    const originalWords = text.split(/(\s+|[,，.。!！?？;；:：])/).filter((w: string) => w.trim().length > 0)
    // Whisper가 인식하기 어려운 문장부호만 있는 단어는 제거하고 인접 단어와 결합
    const cleanedOriginalWords: string[] = []
    for (let i = 0; i < originalWords.length; i++) {
      const word = originalWords[i].trim()
      if (word.length === 0) continue
      // 문장부호만 있는 경우 이전 단어와 결합
      if (/^[,，.。!！?？;；:：]+$/.test(word) && cleanedOriginalWords.length > 0) {
        cleanedOriginalWords[cleanedOriginalWords.length - 1] += word
      } else {
        cleanedOriginalWords.push(word)
      }
    }
    const finalOriginalWords = cleanedOriginalWords.length > 0 ? cleanedOriginalWords : originalWords
    const matchedWordTimings: Array<{ word: string; start: number; end: number; confidence?: number }> = []

    if (wordTimings.length > 0 && finalOriginalWords.length > 0) {
      // 개선된 매칭: 정답 대본의 단어 순서를 기준으로 Whisper 결과를 정렬
      // 1. Whisper 결과를 시간 순으로 정렬
      const sortedWhisperTimings = [...wordTimings].sort((a, b) => a.start - b.start)
      
      // 2. 정답 대본의 각 단어에 대해 가장 가까운 Whisper 결과를 찾아 매칭
      let whisperIndex = 0
      let lastMatchedEnd = 0
      
      for (let i = 0; i < finalOriginalWords.length; i++) {
        const originalWord = finalOriginalWords[i].trim()
        if (originalWord.length === 0) continue
        
        const originalWordLower = originalWord.toLowerCase()
        
        // 현재 위치 이후의 Whisper 결과에서 매칭되는 단어 찾기
        let bestMatch: { word: string; start: number; end: number; confidence?: number } | null = null
        let bestMatchIndex = -1
        let bestScore = Infinity
        
        // 최대 5개 단어 앞까지 탐색 (너무 멀리 가면 안 됨)
        for (let j = whisperIndex; j < Math.min(whisperIndex + 5, sortedWhisperTimings.length); j++) {
          const whisperWord = sortedWhisperTimings[j].word.trim().toLowerCase()
          
          // 정확히 일치하는 경우 (최우선)
          if (originalWordLower === whisperWord) {
            bestMatch = sortedWhisperTimings[j]
            bestMatchIndex = j
            bestScore = 0
            break
          }
          
          // 부분 일치 점수 계산
          const similarity = calculateWordSimilarity(originalWordLower, whisperWord)
          if (similarity > 0.7 && similarity < bestScore) {
            bestScore = similarity
            bestMatch = sortedWhisperTimings[j]
            bestMatchIndex = j
          }
        }
        
        if (bestMatch && bestMatchIndex >= 0) {
          // 매칭 성공: 정답 대본의 단어를 사용하되, Whisper의 정확한 타이밍 사용
          matchedWordTimings.push({
            word: originalWord, // 정답 대본의 원본 단어 사용 (TTS 원문)
            start: Number.parseFloat(bestMatch.start.toFixed(10)), // 소수점 10자리 정밀도
            end: Number.parseFloat(bestMatch.end.toFixed(10)),
            confidence: bestMatch.confidence || 0.9,
          })
          whisperIndex = bestMatchIndex + 1
          lastMatchedEnd = bestMatch.end
        } else {
          // 매칭 실패: 이전 단어의 시간을 기반으로 추정 (정답 대본 유지)
          const estimatedDuration = 0.3 // 기본값 0.3초
          matchedWordTimings.push({
            word: originalWord, // 정답 대본의 원본 단어 사용
            start: Number.parseFloat(lastMatchedEnd.toFixed(10)),
            end: Number.parseFloat((lastMatchedEnd + estimatedDuration).toFixed(10)),
            confidence: 0.6,
          })
          lastMatchedEnd += estimatedDuration
        }
      }
    } else {
      // 매칭 실패 시 원본 wordTimings 사용
      matchedWordTimings.push(...wordTimings)
    }

    return NextResponse.json({
      wordTimings: matchedWordTimings.map((wt) => ({
        word: wt.word,
        start: Number.parseFloat(wt.start.toFixed(10)), // 소수점 10자리 정밀도 (Forced Alignment)
        end: Number.parseFloat(wt.end.toFixed(10)),
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


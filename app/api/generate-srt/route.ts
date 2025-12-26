import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

interface WordTiming {
  word: string
  start: number
  end: number
}

interface SubtitleSegment {
  text: string
  start: number
  end: number
  lineCount: number
}

interface DebugData {
  audioDuration: number
  wordTimings: WordTiming[]
  rawSegments: any[]
  subtitleSegments: SubtitleSegment[]
  driftCorrection: {
    applied: boolean
    originalEnd: number
    correctedEnd: number
    scaleFactor: number
  }
}

/**
 * 한글 문자 수 계산 (영문은 0.5자로 계산)
 */
function getCharCount(text: string): number {
  let count = 0
  for (const char of text) {
    if (/[가-힣]/.test(char)) {
      count += 1
    } else if (/[a-zA-Z0-9]/.test(char)) {
      count += 0.5
    } else {
      count += 1
    }
  }
  return count
}

/**
 * 문장부호 확인
 */
function isPunctuation(char: string): boolean {
  return /[.,!?…。，！？]/.test(char)
}

/**
 * SRT 시간 형식으로 변환 (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
}

/**
 * 자막 라인 분할 (16자 기준, 최대 2줄)
 */
function splitIntoLines(words: WordTiming[], maxCharsPerLine: number): string[] {
  const lines: string[] = []
  let currentLine = ""
  
  for (const word of words) {
    const testLine = currentLine ? currentLine + " " + word.word : word.word
    const testCharCount = getCharCount(testLine)
    
    if (testCharCount > maxCharsPerLine && currentLine) {
      // 현재 라인 저장하고 새 라인 시작
      lines.push(currentLine)
      currentLine = word.word
    } else {
      currentLine = testLine
    }
    
    // 최대 2줄까지만
    if (lines.length >= 2) {
      break
    }
  }
  
  if (currentLine && lines.length < 2) {
    lines.push(currentLine)
  }
  
  return lines
}

/**
 * 자막 생성 로직
 */
function generateSubtitles(
  wordTimings: WordTiming[],
  audioDuration: number
): { subtitles: SubtitleSegment[]; debugData: Partial<DebugData> } {
  const MAX_CHARS_PER_LINE = 16
  const MIN_DURATION = 0.8
  const MAX_DURATION = 2.5
  const SILENCE_THRESHOLD = 0.35
  
  const subtitles: SubtitleSegment[] = []
  let currentSubtitle: {
    words: WordTiming[]
    start: number
  } | null = null
  
  for (let i = 0; i < wordTimings.length; i++) {
    const word = wordTimings[i]
    const nextWord = i < wordTimings.length - 1 ? wordTimings[i + 1] : null
    
    // 현재 자막에 단어 추가
    if (!currentSubtitle) {
      currentSubtitle = {
        words: [word],
        start: word.start,
      }
    } else {
      currentSubtitle.words.push(word)
    }
    
    // 현재 자막의 상태 계산
    const currentText = currentSubtitle.words.map(w => w.word).join(" ")
    const currentCharCount = getCharCount(currentText)
    const currentDuration = word.end - currentSubtitle.start
    
    // 단어 간 공백 계산 (다음 단어까지의 간격)
    const gap = nextWord ? nextWord.start - word.end : Infinity
    
    // 문장부호 확인 (현재 단어 끝에 문장부호가 있는지)
    const hasPunctuation = isPunctuation(word.word[word.word.length - 1])
    
    // 자막 분리 결정
    let shouldSplit = false
    let splitReason = ""
    
    // 1. 문장부호 우선 처리 (최소 길이 이상이면 분리)
    if (hasPunctuation && currentDuration >= MIN_DURATION) {
      shouldSplit = true
      splitReason = "punctuation"
    }
    // 2. 공백이 0.35초 이상 (문장부호가 없어도)
    else if (gap >= SILENCE_THRESHOLD && currentDuration >= MIN_DURATION) {
      shouldSplit = true
      splitReason = "silence"
    }
    // 3. 길이 초과 (2.5초)
    else if (currentDuration > MAX_DURATION) {
      shouldSplit = true
      splitReason = "duration"
    }
    // 4. 문자 수 초과 (16자 * 2줄 = 32자, 하지만 실제로는 라인 분할 필요)
    else if (currentCharCount > MAX_CHARS_PER_LINE * 2) {
      shouldSplit = true
      splitReason = "chars"
    }
    
    // 자막 저장 및 분리
    if (shouldSplit && currentSubtitle.words.length > 0) {
      // 자막 라인 분할 (16자 기준, 최대 2줄)
      const lines = splitIntoLines(currentSubtitle.words, MAX_CHARS_PER_LINE)
      
      // 최대 2줄까지만
      if (lines.length > 2) {
        lines.splice(2)
      }
      
      subtitles.push({
        text: lines.join("\n"),
        start: currentSubtitle.start,
        end: word.end,
        lineCount: lines.length,
      })
      
      // 새 자막 시작
      currentSubtitle = null
    }
  }
  
  // 마지막 자막 저장
  if (currentSubtitle && currentSubtitle.words.length > 0) {
    const lastWord = currentSubtitle.words[currentSubtitle.words.length - 1]
    const duration = lastWord.end - currentSubtitle.start
    
    // 최소 길이 확인
    if (duration >= MIN_DURATION) {
      const lines = splitIntoLines(currentSubtitle.words, MAX_CHARS_PER_LINE)
      
      if (lines.length > 2) {
        lines.splice(2)
      }
      
      subtitles.push({
        text: lines.join("\n"),
        start: currentSubtitle.start,
        end: lastWord.end,
        lineCount: lines.length,
      })
    }
  }
  
  // 드리프트 보정
  let driftCorrection = {
    applied: false,
    originalEnd: 0,
    correctedEnd: 0,
    scaleFactor: 1.0,
  }
  
  if (subtitles.length > 0) {
    const lastSubtitleEnd = subtitles[subtitles.length - 1].end
    const drift = Math.abs(audioDuration - lastSubtitleEnd)
    
    if (drift >= 0.2) {
      // 200ms 이상 차이면 스케일링
      const scaleFactor = audioDuration / lastSubtitleEnd
      
      driftCorrection = {
        applied: true,
        originalEnd: lastSubtitleEnd,
        correctedEnd: audioDuration,
        scaleFactor,
      }
      
      // 모든 자막 타이밍 스케일링
      for (const subtitle of subtitles) {
        subtitle.start = subtitle.start * scaleFactor
        subtitle.end = subtitle.end * scaleFactor
      }
    }
  }
  
  return {
    subtitles,
    debugData: {
      driftCorrection,
    },
  }
}

/**
 * SRT 파일 생성
 */
function generateSRT(subtitles: SubtitleSegment[]): string {
  let srt = ""
  
  for (let i = 0; i < subtitles.length; i++) {
    const subtitle = subtitles[i]
    srt += `${i + 1}\n`
    srt += `${formatSRTTime(subtitle.start)} --> ${formatSRTTime(subtitle.end)}\n`
    srt += `${subtitle.text}\n\n`
  }
  
  return srt
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File
    const apiKey = formData.get("apiKey") as string || "CYm46zmVT9RVNxVTWVefTVfFEF4nWUuZ"
    const language = (formData.get("language") as string) || "korean"
    const outputDir = (formData.get("outputDir") as string) || "./output"
    
    if (!audioFile) {
      return NextResponse.json({ error: "오디오 파일이 필요합니다." }, { status: 400 })
    }
    
    console.log("[Generate SRT] STT 시작...")
    
    // 1. LEMONFOX.AI STT API 호출
    const lemonfoxFormData = new FormData()
    lemonfoxFormData.append("file", audioFile)
    lemonfoxFormData.append("language", language)
    lemonfoxFormData.append("response_format", "verbose_json")
    lemonfoxFormData.append("timestamp_granularities[]", "word")
    
    const sttResponse = await fetch("https://api.lemonfox.ai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: lemonfoxFormData,
    })
    
    if (!sttResponse.ok) {
      const errorText = await sttResponse.text()
      console.error("[Generate SRT] STT API 오류:", errorText)
      return NextResponse.json(
        { error: `STT API 호출 실패: ${errorText}` },
        { status: sttResponse.status }
      )
    }
    
    const sttData = await sttResponse.json()
    console.log("[Generate SRT] STT 완료")
    
    // 2. Word timings 추출
    const wordTimings: WordTiming[] = []
    
    if (sttData.segments && Array.isArray(sttData.segments)) {
      for (const segment of sttData.segments) {
        if (segment.words && Array.isArray(segment.words)) {
          for (const word of segment.words) {
            const wordText = word.word || word.text || word.token || ""
            const startTime = typeof word.start === "number" ? word.start : (word.start_time || 0)
            const endTime = typeof word.end === "number" ? word.end : (word.end_time || 0)
            
            if (wordText && (startTime > 0 || endTime > 0)) {
              wordTimings.push({
                word: wordText.trim(),
                start: startTime,
                end: endTime,
              })
            }
          }
        }
      }
    }
    
    // words 배열이 직접 있는 경우
    if (wordTimings.length === 0 && sttData.words && Array.isArray(sttData.words)) {
      for (const word of sttData.words) {
        const wordText = word.word || word.text || word.token || ""
        const startTime = typeof word.start === "number" ? word.start : (word.start_time || 0)
        const endTime = typeof word.end === "number" ? word.end : (word.end_time || 0)
        
        if (wordText && (startTime > 0 || endTime > 0)) {
          wordTimings.push({
            word: wordText.trim(),
            start: startTime,
            end: endTime,
          })
        }
      }
    }
    
    if (wordTimings.length === 0) {
      return NextResponse.json(
        { error: "단어 타이밍을 추출할 수 없습니다." },
        { status: 400 }
      )
    }
    
    // 오디오 길이 추정 (마지막 단어의 end 시간 또는 segments의 마지막 end)
    let audioDuration = wordTimings[wordTimings.length - 1].end
    if (sttData.segments && sttData.segments.length > 0) {
      const lastSegment = sttData.segments[sttData.segments.length - 1]
      if (lastSegment.end && lastSegment.end > audioDuration) {
        audioDuration = lastSegment.end
      }
    }
    
    console.log(`[Generate SRT] ${wordTimings.length}개 단어, 오디오 길이: ${audioDuration.toFixed(2)}초`)
    
    // 3. 자막 생성
    const { subtitles, debugData } = generateSubtitles(wordTimings, audioDuration)
    console.log(`[Generate SRT] ${subtitles.length}개 자막 생성 완료`)
    
    // 4. SRT 생성
    const srtContent = generateSRT(subtitles)
    
    // 5. 디버그 데이터 생성
    const debugContent: DebugData = {
      audioDuration,
      wordTimings,
      rawSegments: sttData.segments || [],
      subtitleSegments: subtitles,
      driftCorrection: debugData.driftCorrection || {
        applied: false,
        originalEnd: 0,
        correctedEnd: 0,
        scaleFactor: 1.0,
      },
    }
    
    // 6. 파일 저장 (Node.js 환경)
    try {
      // outputDir 생성
      await mkdir(outputDir, { recursive: true })
      
      // SRT 파일 저장
      const srtPath = join(outputDir, "captions.srt")
      await writeFile(srtPath, srtContent, "utf-8")
      console.log(`[Generate SRT] SRT 파일 저장: ${srtPath}`)
      
      // 디버그 JSON 저장
      const debugPath = join(outputDir, "captions.debug.json")
      await writeFile(debugPath, JSON.stringify(debugContent, null, 2), "utf-8")
      console.log(`[Generate SRT] 디버그 JSON 저장: ${debugPath}`)
    } catch (fileError) {
      console.warn("[Generate SRT] 파일 저장 실패 (서버 환경이 아닐 수 있음):", fileError)
    }
    
    // 7. 응답 반환
    return NextResponse.json({
      success: true,
      srt: srtContent,
      debug: debugContent,
      subtitleCount: subtitles.length,
      audioDuration,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[Generate SRT] 오류:", errorMessage)
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}


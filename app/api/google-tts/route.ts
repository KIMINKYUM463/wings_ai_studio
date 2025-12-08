import { type NextRequest, NextResponse } from "next/server"

const GOOGLE_TTS_API_KEY = "AIzaSyDbmmJAT7rMFrWb3dShTtlmw1mYdPAtonc"

export async function POST(request: NextRequest) {
  try {
    const { text, voice = "ko-KR-Standard-A", speed = 1.0 } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "텍스트가 필요합니다." }, { status: 400 })
    }

    const extractScriptSection = (text: string): string => {
      console.log("[v0] 원본 텍스트:", text)

      // [스크립트] 섹션 찾기 (대소문자 구분 없이)
      const scriptRegex = /\[스크립트\]([\s\S]*?)(?=\n\[|$)/i
      const scriptMatch = text.match(scriptRegex)

      if (scriptMatch && scriptMatch[1]) {
        const scriptContent = scriptMatch[1].trim()
        console.log("[v0] [스크립트] 섹션 발견:", scriptContent.substring(0, 100) + "...")
        return scriptContent
      }

      // [스크립트] 섹션이 없으면 "스크립트:" 형태 찾기
      const scriptColonRegex = /스크립트\s*:\s*([\s\S]*?)(?=\n\[|썸네일|$)/i
      const scriptColonMatch = text.match(scriptColonRegex)

      if (scriptColonMatch && scriptColonMatch[1]) {
        const scriptContent = scriptColonMatch[1].trim()
        console.log("[v0] 스크립트: 섹션 발견:", scriptContent.substring(0, 100) + "...")
        return scriptContent
      }

      // 둘 다 없으면 [썸네일 제목] 부분만 제거하고 나머지 사용
      let cleanText = text
      cleanText = cleanText.replace(/\[썸네일.*?\][\s\S]*?(?=\n|$)/gi, "")
      cleanText = cleanText.replace(/썸네일.*?:[\s\S]*?(?=\n|$)/gi, "")
      cleanText = cleanText.trim()

      console.log("[v0] 썸네일 제거 후 텍스트:", cleanText.substring(0, 100) + "...")
      return cleanText
    }

    const speechText = extractScriptSection(text)

    if (!speechText.trim()) {
      return NextResponse.json({ error: "[스크립트] 섹션을 찾을 수 없습니다." }, { status: 400 })
    }

    console.log("[v0] Google TTS API 호출:", {
      originalText: text.substring(0, 50) + "...",
      extractedScript: speechText.substring(0, 50) + "...",
      voice,
      speed,
    })

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
          ssmlGender: "FEMALE",
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
      const errorData = await response.json()
      console.error("[v0] Google TTS API 오류:", errorData)
      throw new Error(`Google TTS API 오류: ${response.status} - ${errorData.error?.message || "Unknown error"}`)
    }

    const data = await response.json()

    if (!data.audioContent) {
      throw new Error("오디오 콘텐츠를 받을 수 없습니다.")
    }

    // Base64 오디오 데이터를 데이터 URL로 변환
    const audioDataUrl = `data:audio/mp3;base64,${data.audioContent}`

    const sentences = speechText
      .split(/[.!?。！？]+/)
      .filter((s: string) => s.trim().length > 0)
      .flatMap((sentence: string) => {
        // 긴 문장은 쉼표나 접속사로 추가 분할
        if (sentence.length > 35) {
          return sentence
            .split(/[,，、]|그리고|하지만|그런데|또한|그래서|그러나|따라서/)
            .filter((s) => s.trim().length > 0)
        }
        return [sentence]
      })
      .map((s) => s.trim())
      .filter((s) => s.length > 2) // 너무 짧은 문장 제거

    const subtitleColors = [
      "#ffffff", // 흰색
      "#ffeb3b", // 노란색
      "#4caf50", // 초록색
      "#2196f3", // 파란색
      "#ff9800", // 주황색
      "#e91e63", // 분홍색
      "#9c27b0", // 보라색
      "#00bcd4", // 청록색
    ]

    const subtitles = sentences.map((sentence: string, index: number) => {
      // 한국어 특성을 고려한 읽기 속도 계산 (속도 조정 반영)
      const koreanCharsPerSecond = 4.5 / speed // 기본 4.5자/초, 속도에 따른 조정
      const duration = Math.max(1.5, sentence.length / koreanCharsPerSecond) // 최소 1.5초

      // 이전 자막들의 총 시간 계산
      const startTime = sentences.slice(0, index).reduce((total, prevSentence) => {
        const prevDuration = Math.max(1.5, prevSentence.length / koreanCharsPerSecond)
        return total + prevDuration
      }, 0)

      return {
        id: `subtitle_${index}`,
        text: sentence,
        startTime: Math.round(startTime * 10) / 10, // 소수점 첫째자리까지
        endTime: Math.round((startTime + duration) * 10) / 10,
        x: 50, // 중앙 정렬
        y: 85, // 하단 위치
        fontSize: 32, // 더 큰 폰트 크기
        color: subtitleColors[index % subtitleColors.length], // 순환하는 색상
        style: "modern",
      }
    })

    const totalDuration =
      subtitles.length > 0 ? subtitles[subtitles.length - 1].endTime : speechText.length / (4.5 / speed)

    console.log("[v0] TTS 및 자막 생성 완료:", {
      originalTextLength: text.length,
      scriptTextLength: speechText.length,
      audioSize: data.audioContent.length,
      subtitleCount: subtitles.length,
      totalDuration: totalDuration,
      sentences: sentences.map((s) => s.substring(0, 20) + "..."), // 디버깅용
    })

    return NextResponse.json({
      audioUrl: audioDataUrl,
      subtitles,
      duration: totalDuration,
      totalSegments: subtitles.length,
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

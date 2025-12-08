import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { text, audioUrl, style, fontSize, color, position } = await request.json()

    if (!text || !audioUrl) {
      return NextResponse.json({ error: "Text and audioUrl are required" }, { status: 400 })
    }

    console.log("[v0] 자막 생성 API 호출:", { text: text.substring(0, 50) + "...", style, fontSize, color, position })

    const subtitles = await generateSubtitles({
      text,
      audioUrl,
      style: style || "modern",
      fontSize: fontSize || 24,
      color: color || "#ffffff",
      position: position || "bottom",
    })

    console.log("[v0] 자막 생성 완료:", { totalSegments: subtitles.length })

    return NextResponse.json({
      subtitles,
      totalSegments: subtitles.length,
    })
  } catch (error) {
    console.error("[v0] Subtitles API error:", error)
    return NextResponse.json({ error: "Subtitle generation failed" }, { status: 500 })
  }
}

// 자막 생성 함수 (실제로는 AI 음성 인식 및 타이밍 분석 사용)
async function generateSubtitles(config: any) {
  const { text, style, fontSize, color, position } = config

  // 텍스트를 문장 단위로 분할
  const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0)

  const subtitles = sentences.map((sentence: string, index: number) => {
    const wordsPerSecond = 3 // 평균 말하기 속도
    const duration = Math.max(2, sentence.trim().split(" ").length / wordsPerSecond)
    const startTime = index * duration

    return {
      id: `subtitle_${index}`,
      text: sentence.trim(),
      startTime,
      endTime: startTime + duration,
      x: 50, // 중앙 정렬
      y: position === "top" ? 10 : position === "center" ? 50 : 85,
      fontSize,
      color,
      style,
    }
  })

  return subtitles
}

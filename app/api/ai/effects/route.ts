import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { videoId, autoTransitions, backgroundMusic, visualEffects } = await request.json()

    if (!videoId) {
      return NextResponse.json({ error: "VideoId is required" }, { status: 400 })
    }

    console.log("[v0] 효과 적용 API 호출:", { videoId, autoTransitions, backgroundMusic, visualEffects })

    await new Promise((resolve) => setTimeout(resolve, 1500)) // 1.5초 대기

    console.log("[v0] 효과 적용 완료")

    return NextResponse.json({
      success: true,
      effectsApplied: {
        autoTransitions,
        backgroundMusic,
        visualEffects,
      },
    })
  } catch (error) {
    console.error("[v0] Effects API error:", error)
    return NextResponse.json({ error: "Effects application failed" }, { status: 500 })
  }
}

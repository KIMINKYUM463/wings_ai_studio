import { type NextRequest, NextResponse } from "next/server"
import { generateRefinedScriptPart } from "@/app/WingsAIStudio/longform/refined-script-actions"

// 각 분할은 짧으므로 60초면 충분
export const maxDuration = 60 // 60초
export const runtime = 'nodejs' // Node.js 런타임 사용

/**
 * 정교한 대본 분할 생성 API Route
 * 각 분할을 별도로 생성하여 타임아웃을 피함
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      scriptPlan, 
      topic, 
      duration, 
      partNumber, 
      totalParts,
      targetChars, 
      previousParts, 
      isStoryMode, 
      apiKey 
    } = body

    if (!scriptPlan) {
      return NextResponse.json(
        { error: "scriptPlan이 필요합니다." },
        { status: 400 }
      )
    }

    if (!topic) {
      return NextResponse.json(
        { error: "topic이 필요합니다." },
        { status: 400 }
      )
    }

    if (partNumber === undefined || totalParts === undefined) {
      return NextResponse.json(
        { error: "partNumber와 totalParts가 필요합니다." },
        { status: 400 }
      )
    }

    if (!duration) {
      return NextResponse.json(
        { error: "duration이 필요합니다." },
        { status: 400 }
      )
    }

    console.log("[v0] 정교한 대본 분할 생성 API 호출:", {
      topic,
      duration,
      partNumber,
      totalParts,
      targetChars,
      hasPreviousParts: !!previousParts,
      isStoryMode,
      hasApiKey: !!apiKey
    })

    // generateRefinedScriptPart 함수 호출
    const partScript = await generateRefinedScriptPart(
      scriptPlan,
      topic,
      duration,
      partNumber,
      totalParts,
      targetChars,
      previousParts || "",
      isStoryMode || false,
      apiKey
    )

    console.log("[v0] 정교한 대본 분할 생성 완료:", {
      partNumber,
      totalParts,
      scriptLength: partScript.length
    })

    return NextResponse.json({
      success: true,
      script: partScript,
      length: partScript.length,
      partNumber,
      totalParts
    })

  } catch (error) {
    console.error("[v0] 정교한 대본 분할 생성 API 오류:", error)
    
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."

    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error && error.stack ? error.stack.substring(0, 500) : undefined
      },
      { status: 500 }
    )
  }
}


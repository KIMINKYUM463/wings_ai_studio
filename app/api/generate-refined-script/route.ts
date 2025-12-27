import { type NextRequest, NextResponse } from "next/server"
import { generateRefinedScript } from "@/app/WingsAIStudio/longform/refined-script-actions"

// Vercel Pro 플랜 최대 타임아웃: 300초 (5분)
// 하지만 정교한 대본 생성은 더 오래 걸릴 수 있으므로 최대값 설정
export const maxDuration = 300 // 300초 (5분) - Vercel Pro 플랜 최대값
export const runtime = 'nodejs' // Node.js 런타임 사용

/**
 * 정교한 대본 생성 API Route
 * Server Actions의 60초 타임아웃 제한을 우회하기 위해 API Route로 래핑
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scriptPlan, topic, duration, targetChars, isStoryMode, apiKey } = body

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

    console.log("[v0] 정교한 대본 생성 API 호출 시작:", {
      topic,
      duration,
      targetChars,
      isStoryMode,
      hasApiKey: !!apiKey
    })

    // generateRefinedScript 함수 호출
    const fullScript = await generateRefinedScript(
      scriptPlan,
      topic,
      duration,
      targetChars,
      isStoryMode || false,
      apiKey
    )

    console.log("[v0] 정교한 대본 생성 완료:", {
      scriptLength: fullScript.length
    })

    return NextResponse.json({
      success: true,
      script: fullScript,
      length: fullScript.length
    })

  } catch (error) {
    console.error("[v0] 정교한 대본 생성 API 오류:", error)
    
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
    
    // 타임아웃 오류인 경우 특별 처리
    if (errorMessage.includes("timeout") || 
        errorMessage.includes("타임아웃") || 
        errorMessage.includes("Server Components render") ||
        errorMessage.includes("504") ||
        errorMessage.includes("Function execution exceeded")) {
      return NextResponse.json(
        { 
          error: "대본 생성 시간이 너무 오래 걸립니다. Vercel의 타임아웃 제한(5분)을 초과했습니다.",
          details: "더 긴 대본은 분할 생성하거나 Cloud Run 같은 외부 서비스를 사용하세요.",
          timeout: true
        },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error && error.stack ? error.stack.substring(0, 500) : undefined
      },
      { status: 500 }
    )
  }
}


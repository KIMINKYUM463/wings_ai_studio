import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const LONGFORM_PROGRAM = {
  id: "wingsaistudio",
  program_name: "WingsAIStudio",
  program_path: "/WingsAIStudio",
  program_description: "AI 기반 영상 자동 제작 플랫폼",
}

const SHORTFORM_PROGRAM = {
  id: "wingsaistudioshortform",
  program_name: "WingsAIStudioShortForm",
  program_path: "/WingsAIStudioShotForm",
  program_description: "AI 기반 숏폼 영상 제작 플랫폼",
}

/**
 * 승인된 사용자만 롱폼/숏폼 프로그램 목록 반환
 * GET /api/user/programs
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const kakaoUserCookie = cookieStore.get("kakao_user")

    if (!kakaoUserCookie) {
      return NextResponse.json({
        success: true,
        programs: [],
        approved: false,
      })
    }

    const userData = JSON.parse(kakaoUserCookie.value)
    const kakaoId = userData.id

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        success: true,
        programs: [],
        approved: false,
        message: "Supabase 설정이 없어 프로그램을 확인할 수 없습니다.",
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("approved")
      .eq("kakao_id", kakaoId)
      .maybeSingle()

    if (userError) {
      console.error("[User Programs] 사용자 조회 실패:", userError)
      return NextResponse.json({
        success: true,
        programs: [],
        approved: false,
      })
    }

    const approved = Boolean(user?.approved)

    if (!approved) {
      return NextResponse.json({
        success: true,
        programs: [],
        approved: false,
        message: "관리자 승인 후 프로그램을 이용할 수 있습니다.",
      })
    }

    return NextResponse.json({
      success: true,
      programs: [LONGFORM_PROGRAM, SHORTFORM_PROGRAM],
      approved: true,
    })
  } catch (error) {
    console.error("[User Programs] 오류:", error)
    return NextResponse.json(
      {
        error: `서버 오류: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

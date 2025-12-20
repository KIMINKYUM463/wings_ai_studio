import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

/**
 * 현재 로그인한 사용자의 강사별 프로그램 목록 조회 API
 * 
 * GET /api/user/programs
 */

export async function GET(request: NextRequest) {
  try {
    // 쿠키에서 사용자 정보 가져오기
    const cookieStore = await cookies()
    const kakaoUserCookie = cookieStore.get("kakao_user")

    if (!kakaoUserCookie) {
      return NextResponse.json({
        success: true,
        programs: [],
      })
    }

    const userData = JSON.parse(kakaoUserCookie.value)
    const kakaoId = userData.id

    // WingsAIStudio를 기본 프로그램으로 추가 (모든 로그인 사용자에게 제공)
    const wingsAIStudioProgram = {
      id: "wingsaistudio",
      program_name: "WingsAIStudio",
      program_path: "/WingsAIStudio",
      program_description: "AI 기반 영상 자동 제작 플랫폼"
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      // Supabase가 없어도 WingsAIStudio는 반환
      return NextResponse.json({
        success: true,
        programs: [wingsAIStudioProgram],
        hasInstructor: false,
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 사용자의 강사 정보 조회
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("instructor")
      .eq("kakao_id", kakaoId)
      .single()

    if (userError || !user || !user.instructor) {
      // 강사가 지정되지 않은 경우 WingsAIStudio만 반환
      return NextResponse.json({
        success: true,
        programs: [wingsAIStudioProgram],
        hasInstructor: false,
      })
    }

    // 강사별 프로그램 조회
    const { data: programs, error: programsError } = await supabase
      .from("instructors_programs")
      .select("id, program_name, program_path, program_description")
      .eq("instructor", user.instructor)
      .order("program_name", { ascending: true })

    if (programsError) {
      console.error("[User Programs] 프로그램 목록 조회 실패:", programsError)
      // 조회 실패해도 WingsAIStudio는 반환
      return NextResponse.json({
        success: true,
        programs: [wingsAIStudioProgram],
        hasInstructor: true,
      })
    }

    // WingsAIStudio가 이미 목록에 있는지 확인
    const hasWingsAIStudio = programs?.some((p: any) => p.id === "wingsaistudio" || p.program_path === "/WingsAIStudio")
    
    // WingsAIStudio가 없으면 맨 앞에 추가
    const allPrograms = hasWingsAIStudio 
      ? programs || []
      : [wingsAIStudioProgram, ...(programs || [])]

    return NextResponse.json({
      success: true,
      programs: allPrograms,
      hasInstructor: true,
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


import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase 환경 변수가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 사용자의 강사 정보 조회
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("instructor")
      .eq("kakao_id", kakaoId)
      .single()

    if (userError || !user || !user.instructor) {
      // 강사가 지정되지 않은 경우 빈 배열과 함께 hasInstructor: false 반환
      return NextResponse.json({
        success: true,
        programs: [],
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
      return NextResponse.json(
        { error: `프로그램 목록 조회 실패: ${programsError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      programs: programs || [],
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


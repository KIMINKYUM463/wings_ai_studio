import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * 관리자 페이지 - 강사별 프로그램 목록 조회 API
 * 
 * GET /api/admin/programs
 */

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase 환경 변수가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 모든 프로그램 조회
    const { data: programs, error } = await supabase
      .from("instructors_programs")
      .select("id, instructor, program_name, program_path, program_description")
      .order("instructor", { ascending: true })
      .order("program_name", { ascending: true })

    if (error) {
      console.error("[Admin Programs] 프로그램 목록 조회 실패:", error)
      return NextResponse.json(
        { error: `프로그램 목록 조회 실패: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      programs: programs || [],
    })
  } catch (error) {
    console.error("[Admin Programs] 오류:", error)
    return NextResponse.json(
      {
        error: `서버 오류: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}


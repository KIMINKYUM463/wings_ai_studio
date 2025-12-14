import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * 관리자 페이지 - 사용자 강사 설정 API
 * 
 * POST /api/admin/users/instructor
 * Body: { userId: string, instructor: 'wings' | 'onback' | null }
 */

export async function POST(request: NextRequest) {
  try {
    const { userId, instructor } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: "userId가 필요합니다." },
        { status: 400 }
      )
    }

    if (instructor !== null && instructor !== 'wings' && instructor !== 'onback') {
      return NextResponse.json(
        { error: "instructor는 'wings', 'onback', 또는 null이어야 합니다." },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase 환경 변수가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log("[Admin Instructor] 강사 설정 시도:", { userId, instructor })

    // 사용자의 강사 정보 업데이트
    const { data, error } = await supabase
      .from("users")
      .update({ instructor: instructor })
      .eq("id", userId)
      .select("id, email, nickname, profile_image_url, instructor, created_at")
      .single()

    if (error) {
      console.error("[Admin Instructor] 강사 설정 실패:", {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json(
        { 
          error: `강사 설정 실패: ${error.message}`,
          details: error.details,
          hint: error.hint,
        },
        { status: 500 }
      )
    }

    console.log("[Admin Instructor] 강사 설정 성공:", {
      userId: data?.id,
      instructor: data?.instructor,
      email: data?.email,
    })

    // instructor 값이 제대로 저장되었는지 확인
    if (!data || data.instructor !== instructor) {
      console.error("[Admin Instructor] 강사 값 불일치:", {
        expected: instructor,
        actual: data?.instructor,
      })
      return NextResponse.json(
        { 
          error: `강사 설정이 제대로 저장되지 않았습니다. (예상: ${instructor}, 실제: ${data?.instructor})`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: data,
    })
  } catch (error) {
    console.error("[Admin Instructor] 오류:", error)
    return NextResponse.json(
      {
        error: `서버 오류: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}


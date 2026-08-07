import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * 관리자 페이지 - 사용자 목록 조회 API
 * 
 * GET /api/admin/users
 */

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      const missing = [
        !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
        !supabaseServiceKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
      ].filter(Boolean)
      return NextResponse.json(
        {
          error: `Supabase 환경 변수가 설정되지 않았습니다. (.env.local에 ${missing.join(", ")} 추가 후 서버를 재시작하세요)`,
          missing,
        },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log("[Admin Users] Supabase 연결 시도:", {
      url: supabaseUrl?.substring(0, 30) + "...",
      hasServiceKey: !!supabaseServiceKey,
    })

    // 모든 사용자 조회 (이메일, 닉네임, 프로필 이미지, 강사 정보 포함)
    // limit을 명시적으로 제거하여 모든 사용자 조회
    const { data: users, error, count } = await supabase
      .from("users")
      .select("id, email, nickname, profile_image_url, approved, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(1000)

    console.log("[Admin Users] 조회된 사용자 수:", users?.length || 0, "명 (총:", count, "명)")

    if (count && count > (users?.length || 0)) {
      console.warn(`[Admin Users] 경고: 총 ${count}명이 있지만 ${users?.length || 0}명만 조회되었습니다.`)
    }

    if (error) {
      console.error("[Admin Users] 사용자 목록 조회 실패:", {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json(
        {
          error: `사용자 목록 조회 실패: ${error.message}`,
          details: error.details,
          hint: error.hint,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      users: users || [],
    })
  } catch (error) {
    console.error("[Admin Users] 오류:", error)
    return NextResponse.json(
      {
        error: `서버 오류: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}


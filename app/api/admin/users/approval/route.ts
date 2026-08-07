import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * 관리자 - 사용자 승인/비승인
 * POST /api/admin/users/approval
 * Body: { userId: string, approved: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, approved } = await request.json()

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 })
    }
    if (typeof approved !== "boolean") {
      return NextResponse.json({ error: "approved는 boolean이어야 합니다." }, { status: 400 })
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

    const { data, error } = await supabase
      .from("users")
      .update({ approved })
      .eq("id", userId)
      .select("id, email, nickname, profile_image_url, approved, created_at")
      .single()

    if (error) {
      console.error("[Admin Approval] 업데이트 실패:", error)
      return NextResponse.json({ error: `승인 상태 변경 실패: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: data })
  } catch (error) {
    console.error("[Admin Approval] 오류:", error)
    return NextResponse.json(
      { error: `서버 오류: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}

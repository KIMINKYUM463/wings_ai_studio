import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const revalidate = 0

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await supabase
      .from("users")
      .update({ approved })
      .eq("id", userId)
      .select("id, email, nickname, profile_image_url, approved, created_at")
      .maybeSingle()

    if (error) {
      console.error("[Admin Approval] 업데이트 실패:", error)
      return NextResponse.json(
        { error: `승인 상태 변경 실패: ${error.message}` },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      )
    }

    if (!data) {
      console.error("[Admin Approval] 대상 사용자 없음:", { userId, approved })
      return NextResponse.json(
        { error: "해당 사용자를 찾을 수 없어 승인 상태가 저장되지 않았습니다." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      )
    }

    // 저장 직후 재조회로 실제 반영 여부 확인 (캐시/부분 실패 방지)
    const { data: verified, error: verifyError } = await supabase
      .from("users")
      .select("id, email, nickname, profile_image_url, approved, created_at")
      .eq("id", userId)
      .maybeSingle()

    if (verifyError) {
      console.error("[Admin Approval] 저장 검증 조회 실패:", verifyError)
      return NextResponse.json(
        { error: `승인 저장 검증 실패: ${verifyError.message}` },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      )
    }

    const savedApproved = Boolean(verified?.approved)
    if (!verified || savedApproved !== approved) {
      console.error("[Admin Approval] 저장 불일치:", {
        userId,
        expected: approved,
        actual: verified?.approved,
      })
      return NextResponse.json(
        {
          error: `승인 상태가 DB에 반영되지 않았습니다. (요청: ${approved}, 실제: ${verified?.approved})`,
        },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      )
    }

    console.log("[Admin Approval] 저장 확인:", {
      userId: verified.id,
      email: verified.email,
      approved: savedApproved,
    })

    return NextResponse.json(
      { success: true, user: { ...verified, approved: savedApproved } },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("[Admin Approval] 오류:", error)
    return NextResponse.json(
      {
        error: `서버 오류: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}

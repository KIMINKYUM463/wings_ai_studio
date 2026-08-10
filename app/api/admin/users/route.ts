import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * 관리자 페이지 - 사용자 목록 조회 API
 *
 * GET /api/admin/users
 * Supabase 기본 max rows(보통 1000)를 넘기 위해 range 페이지네이션으로 전량 조회합니다.
 */

const PAGE_SIZE = 1000
const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

type AdminUserRow = {
  id: string
  email: string | null
  nickname: string | null
  profile_image_url: string | null
  approved: boolean | null
  created_at: string
}

export async function GET(_request: NextRequest) {
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
        { status: 500, headers: NO_STORE }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const users: AdminUserRow[] = []
    let from = 0
    let totalCount: number | null = null

    while (true) {
      const to = from + PAGE_SIZE - 1
      const { data, error, count } = await supabase
        .from("users")
        .select("id, email, nickname, profile_image_url, approved, created_at", {
          count: totalCount == null ? "exact" : undefined,
        })
        .order("created_at", { ascending: false })
        .range(from, to)

      if (error) {
        console.error("[Admin Users] 사용자 목록 조회 실패:", {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          from,
          to,
        })
        return NextResponse.json(
          {
            error: `사용자 목록 조회 실패: ${error.message}`,
            details: error.details,
            hint: error.hint,
          },
          { status: 500, headers: NO_STORE }
        )
      }

      if (typeof count === "number") {
        totalCount = count
      }

      const batch = (data || []) as AdminUserRow[]
      users.push(...batch)

      // 마지막 페이지이거나 빈 페이지면 종료
      if (batch.length < PAGE_SIZE) break
      from += PAGE_SIZE

      // 안전장치: 비정상 루프 방지 (100만 명 상한)
      if (from >= 1_000_000) break
    }

    console.log(
      "[Admin Users] 조회된 사용자 수:",
      users.length,
      "명 (DB count:",
      totalCount ?? "n/a",
      ")"
    )

    return NextResponse.json(
      {
        success: true,
        users,
        totalCount: totalCount ?? users.length,
      },
      { headers: NO_STORE }
    )
  } catch (error) {
    console.error("[Admin Users] 오류:", error)
    return NextResponse.json(
      {
        error: `서버 오류: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500, headers: NO_STORE }
    )
  }
}

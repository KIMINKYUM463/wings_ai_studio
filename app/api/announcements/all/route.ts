import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * 모든 활성화된 업데이트 사항 조회 API
 * GET /api/announcements/all
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 활성화된 모든 업데이트 사항 조회 (최신순)
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10) // 최대 10개만
    
    if (error) {
      console.error("[Announcements] 조회 실패:", error)
      return NextResponse.json(
        { error: "업데이트 사항을 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ announcements: data || [] })
  } catch (error) {
    console.error("[Announcements] 조회 중 오류:", error)
    return NextResponse.json(
      { error: "업데이트 사항을 불러오는데 실패했습니다." },
      { status: 500 }
    )
  }
}


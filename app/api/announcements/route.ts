import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * 업데이트 내용 조회 API
 * GET /api/announcements
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 활성화된 최신 업데이트 내용 조회
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    
    if (error) {
      // 테이블이 없거나 데이터가 없는 경우
      if (error.code === "PGRST116") {
        return NextResponse.json({ announcement: null })
      }
      console.error("[Announcements] 조회 실패:", error)
      return NextResponse.json(
        { error: "업데이트 내용을 불러오는데 실패했습니다." },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ announcement: data })
  } catch (error) {
    console.error("[Announcements] 조회 중 오류:", error)
    return NextResponse.json(
      { error: "업데이트 내용을 불러오는데 실패했습니다." },
      { status: 500 }
    )
  }
}

/**
 * 업데이트 내용 생성/수정 API (관리자용)
 * POST /api/announcements
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, is_active } = body
    
    // 관리자 권한 확인 (간단한 비밀번호 체크 또는 세션 확인)
    const adminPassword = request.headers.get("x-admin-password")
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 401 }
      )
    }
    
    if (!title || !content) {
      return NextResponse.json(
        { error: "제목과 내용은 필수입니다." },
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    
    // 기존 활성화된 업데이트가 있으면 비활성화
    if (is_active) {
      await supabase
        .from("announcements")
        .update({ is_active: false })
        .eq("is_active", true)
    }
    
    // 새 업데이트 내용 생성
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title,
        content,
        is_active: is_active ?? true,
      })
      .select()
      .single()
    
    if (error) {
      console.error("[Announcements] 생성 실패:", error)
      return NextResponse.json(
        { error: "업데이트 내용을 저장하는데 실패했습니다." },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ announcement: data })
  } catch (error) {
    console.error("[Announcements] 생성 중 오류:", error)
    return NextResponse.json(
      { error: "업데이트 내용을 저장하는데 실패했습니다." },
      { status: 500 }
    )
  }
}


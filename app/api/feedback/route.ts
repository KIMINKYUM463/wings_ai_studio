import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * 개선사항 저장 API
 * POST /api/feedback
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, userId } = body
    
    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "개선사항 내용을 입력해주세요." },
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    
    // 개선사항 저장
    const { data, error } = await supabase
      .from("feedback")
      .insert({
        user_id: userId || null,
        content: content.trim(),
        status: "pending",
      })
      .select()
      .single()
    
    if (error) {
      console.error("[Feedback] 저장 실패:", error)
      return NextResponse.json(
        { error: "개선사항 저장에 실패했습니다." },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      success: true,
      feedback: data 
    })
  } catch (error) {
    console.error("[Feedback] 저장 중 오류:", error)
    return NextResponse.json(
      { error: "개선사항 저장 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

/**
 * 개선사항 조회 API (관리자용)
 * GET /api/feedback
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 관리자 권한 확인 (간단한 비밀번호 체크)
    const adminPassword = request.headers.get("x-admin-password")
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "pending"
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error("[Feedback] 조회 실패:", error)
      return NextResponse.json(
        { error: "개선사항 조회에 실패했습니다." },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ feedbacks: data || [] })
  } catch (error) {
    console.error("[Feedback] 조회 중 오류:", error)
    return NextResponse.json(
      { error: "개선사항 조회 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}



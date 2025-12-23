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
    
    console.log("[Feedback] 개선사항 제출 요청:", { 
      contentLength: content.trim().length, 
      userId: userId || "없음" 
    })
    
    const supabase = await createClient()
    
    // Supabase 연결 확인
    if (!supabase) {
      console.error("[Feedback] Supabase 클라이언트 생성 실패")
      return NextResponse.json(
        { error: "데이터베이스 연결에 실패했습니다." },
        { status: 500 }
      )
    }
    
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
      console.error("[Feedback] Supabase 저장 실패:", error)
      console.error("[Feedback] 에러 상세:", JSON.stringify(error, null, 2))
      
      // 테이블이 없는 경우 명확한 에러 메시지
      if (error.message?.includes("relation") && error.message?.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "데이터베이스 테이블이 없습니다. Supabase에 feedback 테이블을 생성해주세요.",
            details: "scripts/create_feedback_table.sql 파일의 SQL을 Supabase SQL Editor에서 실행해주세요.",
            sqlFile: "scripts/create_feedback_table.sql"
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { 
          error: "개선사항 저장에 실패했습니다.",
          details: error.message || "알 수 없는 오류"
        },
        { status: 500 }
      )
    }
    
    console.log("[Feedback] 개선사항 저장 성공:", { 
      id: data?.id, 
      userId: data?.user_id,
      status: data?.status 
    })
    
    return NextResponse.json({ 
      success: true,
      feedback: data 
    })
  } catch (error) {
    console.error("[Feedback] 저장 중 오류:", error)
    console.error("[Feedback] 에러 스택:", error instanceof Error ? error.stack : "스택 없음")
    return NextResponse.json(
      { 
        error: "개선사항 저장 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "알 수 없는 오류"
      },
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



"use server"

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * 업데이트 내용 수정 API (관리자용)
 * PUT /api/announcements/update
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, content, is_active } = body
    
    // 관리자 권한 확인
    const adminPassword = request.headers.get("x-admin-password")
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 401 }
      )
    }
    
    if (!id) {
      return NextResponse.json(
        { error: "업데이트 ID가 필요합니다." },
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (is_active !== undefined) {
      updateData.is_active = is_active
      // 활성화하는 경우 다른 활성화된 업데이트 비활성화
      if (is_active) {
        await supabase
          .from("announcements")
          .update({ is_active: false })
          .neq("id", id)
          .eq("is_active", true)
      }
    }
    
    const { data, error } = await supabase
      .from("announcements")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()
    
    if (error) {
      console.error("[Announcements] 수정 실패:", error)
      return NextResponse.json(
        { error: "업데이트 내용을 수정하는데 실패했습니다." },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ announcement: data })
  } catch (error) {
    console.error("[Announcements] 수정 중 오류:", error)
    return NextResponse.json(
      { error: "업데이트 내용을 수정하는데 실패했습니다." },
      { status: 500 }
    )
  }
}


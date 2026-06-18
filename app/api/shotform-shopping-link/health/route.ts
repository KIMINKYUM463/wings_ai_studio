import { NextResponse } from "next/server"
import { createMvpProjectsClient, createServiceClient } from "@/lib/supabase/mvp-projects"

export const dynamic = "force-dynamic"

/** My 링크 Supabase 연결 상태 (키 값은 노출하지 않음) */
export async function GET() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
  let tableOk = false
  let tableError: string | null = null

  if (hasUrl) {
    try {
      const supabase = hasServiceRole ? createServiceClient() : await createMvpProjectsClient()
      const { error } = await supabase.from("shotform_shopping_link_pages").select("slug").limit(1)
      tableOk = !error
      if (error) tableError = error.message
    } catch (e) {
      tableError = e instanceof Error ? e.message : String(e)
    }
  }

  return NextResponse.json({
    supabaseUrl: hasUrl,
    serviceRoleKey: hasServiceRole,
    tableOk,
    tableError,
    canWrite: hasUrl && hasServiceRole,
    hint: !hasServiceRole
      ? "Vercel에 SUPABASE_SERVICE_ROLE_KEY를 추가하세요. (Supabase > Settings > API > service_role)"
      : !tableOk
        ? "scripts/create_shotform_shopping_link_pages_table.sql 을 Supabase SQL Editor에서 실행하세요."
        : null,
  })
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"

/** MVP·관리 API — RLS 우회 (user_id는 앱에서 검증) */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다."
    )
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** service role 없으면 anon SSR 클라이언트 (RLS 비활성화 테이블용) */
export async function createMvpProjectsClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key) {
    return createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return createServerClient()
}

export function formatSupabaseError(error: unknown): string {
  if (!error || typeof error !== "object") return "알 수 없는 오류"
  const e = error as { message?: string; code?: string; hint?: string }
  const parts = [e.message, e.code ? `(${e.code})` : "", e.hint].filter(Boolean)
  return parts.join(" ") || "Supabase 오류"
}

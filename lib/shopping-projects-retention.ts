import { createMvpProjectsClient } from "@/lib/supabase/mvp-projects"

/** shopping_projects 보존 기간 (생성일 기준) */
export const SHOPPING_PROJECT_RETENTION_DAYS = 7

const PURGE_THROTTLE_MS = 30 * 60 * 1000
let lastPurgeAt = 0

export function shoppingProjectRetentionCutoffIso(now = new Date()): string {
  const cutoff = new Date(now.getTime())
  cutoff.setUTCDate(cutoff.getUTCDate() - SHOPPING_PROJECT_RETENTION_DAYS)
  return cutoff.toISOString()
}

export function isWithinShoppingProjectRetention(
  createdAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (!createdAt) return false
  const createdMs = new Date(createdAt).getTime()
  if (!Number.isFinite(createdMs)) return false
  return createdMs >= now - SHOPPING_PROJECT_RETENTION_DAYS * 24 * 60 * 60 * 1000
}

/**
 * 생성일(created_at)이 7일을 지난 shopping_projects 행을 삭제합니다.
 * 목록 조회 등에서 자주 호출되므로 인스턴스당 30분 스로틀합니다.
 */
export async function purgeExpiredShoppingProjects(opts?: {
  force?: boolean
}): Promise<{ skipped: boolean; deleted: number; error?: string }> {
  const now = Date.now()
  if (!opts?.force && now - lastPurgeAt < PURGE_THROTTLE_MS) {
    return { skipped: true, deleted: 0 }
  }
  lastPurgeAt = now

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return {
        skipped: false,
        deleted: 0,
        error: "NEXT_PUBLIC_SUPABASE_URL이 없습니다.",
      }
    }
    const supabase = await createMvpProjectsClient()
    const cutoff = shoppingProjectRetentionCutoffIso(new Date(now))
    const { data, error, count } = await supabase
      .from("shopping_projects")
      .delete({ count: "exact" })
      .lt("created_at", cutoff)
      .select("id")

    if (error) {
      console.warn("[ShoppingProjectsRetention] 만료 삭제 실패:", error.message)
      return { skipped: false, deleted: 0, error: error.message }
    }

    const deleted = typeof count === "number" ? count : data?.length || 0
    if (deleted > 0) {
      console.log(
        `[ShoppingProjectsRetention] 생성 ${SHOPPING_PROJECT_RETENTION_DAYS}일 경과 프로젝트 ${deleted}개 삭제 (cutoff=${cutoff})`
      )
    }
    return { skipped: false, deleted }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn("[ShoppingProjectsRetention] 만료 삭제 중 오류:", message)
    return { skipped: false, deleted: 0, error: message }
  }
}

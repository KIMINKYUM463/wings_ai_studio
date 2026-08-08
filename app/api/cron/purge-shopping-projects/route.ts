import { NextResponse } from "next/server"
import {
  purgeExpiredShoppingProjects,
  SHOPPING_PROJECT_RETENTION_DAYS,
} from "@/lib/shopping-projects-retention"

export const runtime = "nodejs"
export const maxDuration = 60

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const auth = request.headers.get("authorization") || ""
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  // Vercel Cron은 이 헤더를 붙입니다 (프로젝트에 Cron이 설정된 경우)
  if (request.headers.get("x-vercel-cron") === "1") return true
  // 로컬/비상: CRON_SECRET 미설정 시에만 개발 허용
  if (!cronSecret && process.env.NODE_ENV !== "production") return true
  return false
}

/** 매일 호출: 생성 후 7일 지난 shopping_projects 삭제 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await purgeExpiredShoppingProjects({ force: true })
  return NextResponse.json({
    ok: !result.error,
    retentionDays: SHOPPING_PROJECT_RETENTION_DAYS,
    deleted: result.deleted,
    error: result.error || null,
  })
}

export async function POST(request: Request) {
  return GET(request)
}

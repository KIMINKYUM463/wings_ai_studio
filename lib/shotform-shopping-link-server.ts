import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import type { ShoppingLinkPageData } from "@/lib/shotform-shopping-link-types"
import { sanitizeShoppingLinkSlug } from "@/lib/shotform-shopping-link-types"
import { createMvpProjectsClient, formatSupabaseError } from "@/lib/supabase/mvp-projects"

const DATA_DIR = path.join(process.cwd(), "data", "shotform-shopping-links")
const TABLE = "shotform_shopping_link_pages"

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
}

function shouldUseSupabase(): boolean {
  if (process.env.VERCEL) return supabaseConfigured()
  return supabaseConfigured()
}

function deploymentStorageError(): Error {
  if (!supabaseConfigured()) {
    return new Error(
      "배포 환경에 Supabase가 설정되지 않았습니다. Vercel 환경 변수(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)를 확인해 주세요."
    )
  }
  return new Error(
    "서버 저장소를 사용할 수 없습니다. scripts/create_shotform_shopping_link_pages_table.sql 을 Supabase SQL Editor에서 실행해 주세요."
  )
}

function wrapDbError(error: unknown, action: string): never {
  const detail = formatSupabaseError(error)
  console.error(`[shotform-shopping-link] ${action} 실패:`, error)
  if (detail.includes("PGRST205") || detail.toLowerCase().includes("does not exist")) {
    throw new Error(
      "shotform_shopping_link_pages 테이블이 없습니다. scripts/create_shotform_shopping_link_pages_table.sql 을 Supabase SQL Editor에서 실행해 주세요."
    )
  }
  if (detail.includes("42501") || detail.toLowerCase().includes("permission")) {
    throw new Error("Supabase 권한 오류입니다. 테이블 RLS 비활성화 및 GRANT 설정을 확인해 주세요.")
  }
  throw new Error(`${action} 실패: ${detail}`)
}

function slugFilePath(slug: string): string {
  const safe = sanitizeShoppingLinkSlug(slug)
  if (!safe) throw new Error("INVALID_SLUG")
  return path.join(DATA_DIR, `${safe}.json`)
}

async function readFromFilesystem(slug: string): Promise<ShoppingLinkPageData | null> {
  try {
    const raw = await readFile(slugFilePath(slug), "utf-8")
    return JSON.parse(raw) as ShoppingLinkPageData
  } catch {
    return null
  }
}

async function writeToFilesystem(slug: string, data: ShoppingLinkPageData): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  const safe = sanitizeShoppingLinkSlug(slug)
  if (!safe) throw new Error("INVALID_SLUG")
  await writeFile(
    slugFilePath(safe),
    JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8"
  )
}

async function readFromSupabase(slug: string): Promise<ShoppingLinkPageData | null> {
  const supabase = await createMvpProjectsClient()
  const { data, error } = await supabase.from(TABLE).select("data").eq("slug", slug).maybeSingle()
  if (error) wrapDbError(error, "페이지 조회")
  if (!data?.data || typeof data.data !== "object") return null
  return data.data as ShoppingLinkPageData
}

async function writeToSupabase(slug: string, data: ShoppingLinkPageData): Promise<void> {
  const supabase = await createMvpProjectsClient()
  const payload = { ...data, updatedAt: new Date().toISOString() }
  const { error } = await supabase.from(TABLE).upsert({
    slug,
    data: payload,
    updated_at: new Date().toISOString(),
  })
  if (error) wrapDbError(error, "페이지 저장")
}

export async function readShoppingLinkPage(slug: string): Promise<ShoppingLinkPageData | null> {
  if (shouldUseSupabase()) {
    try {
      return await readFromSupabase(slug)
    } catch (e) {
      console.error("[shotform-shopping-link] Supabase read failed:", e)
      if (process.env.VERCEL) return null
    }
  }
  if (process.env.VERCEL) return null
  return readFromFilesystem(slug)
}

export async function writeShoppingLinkPage(slug: string, data: ShoppingLinkPageData): Promise<void> {
  if (shouldUseSupabase()) {
    try {
      await writeToSupabase(slug, data)
      return
    } catch (e) {
      console.error("[shotform-shopping-link] Supabase write failed:", e)
      if (process.env.VERCEL) throw e instanceof Error ? e : deploymentStorageError()
    }
  }
  if (process.env.VERCEL) throw deploymentStorageError()
  await writeToFilesystem(slug, data)
}

export async function shoppingLinkSlugExists(slug: string, exceptSlug?: string): Promise<boolean> {
  const page = await readShoppingLinkPage(slug)
  if (!page) return false
  if (exceptSlug && sanitizeShoppingLinkSlug(exceptSlug) === sanitizeShoppingLinkSlug(slug)) return false
  return true
}

import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import type { ShoppingLinkPageData } from "@/lib/shotform-shopping-link-types"
import { sanitizeShoppingLinkSlug } from "@/lib/shotform-shopping-link-types"
import { normalizeShoppingLinkPageData } from "@/lib/shotform-shopping-link-store"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createMvpProjectsClient, createServiceClient, formatSupabaseError } from "@/lib/supabase/mvp-projects"

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
  if (process.env.VERCEL && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Error(
      "Vercel에 SUPABASE_SERVICE_ROLE_KEY가 없습니다. Supabase Service Role 키를 환경 변수에 추가한 뒤 재배포해 주세요."
    )
  }
  return new Error(
    "서버 저장소를 사용할 수 없습니다. scripts/create_shotform_shopping_link_pages_table.sql 을 Supabase SQL Editor에서 실행해 주세요."
  )
}

/** 배포 환경에서는 service role 필수 — anon 클라이언트로는 UPDATE가 막힐 수 있음 */
function createShoppingLinkDbClient(): SupabaseClient {
  return createServiceClient()
}

function canWriteToSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
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

async function readFromSupabase(slug: string, supabase?: SupabaseClient): Promise<ShoppingLinkPageData | null> {
  const client =
    supabase ??
    (process.env.SUPABASE_SERVICE_ROLE_KEY ? createShoppingLinkDbClient() : await createMvpProjectsClient())
  const { data, error } = await client.from(TABLE).select("data, updated_at").eq("slug", slug).maybeSingle()
  if (error) wrapDbError(error, "페이지 조회")
  if (!data?.data || typeof data.data !== "object") return null
  return data.data as ShoppingLinkPageData
}

async function writeToSupabase(slug: string, data: ShoppingLinkPageData): Promise<ShoppingLinkPageData> {
  const supabase = createShoppingLinkDbClient()
  const payload = normalizeShoppingLinkPageData({
    ...data,
    profile: { ...data.profile, slug },
    updatedAt: new Date().toISOString(),
  })
  const now = new Date().toISOString()
  const row = { slug, data: payload, updated_at: now }

  const { data: existing, error: existsError } = await supabase
    .from(TABLE)
    .select("slug")
    .eq("slug", slug)
    .maybeSingle()
  if (existsError) wrapDbError(existsError, "페이지 존재 확인")

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from(TABLE)
      .update(row)
      .eq("slug", slug)
      .select("data")
      .single()
    if (updateError) wrapDbError(updateError, "페이지 수정")
    if (!updated?.data || typeof updated.data !== "object") {
      throw new Error("프로필 저장에 실패했습니다. Supabase UPDATE 권한을 확인해 주세요.")
    }
  } else {
    const { error: insertError } = await supabase.from(TABLE).insert(row)
    if (insertError) wrapDbError(insertError, "페이지 생성")
  }

  const reread = await readFromSupabase(slug, supabase)
  if (!reread) {
    throw new Error("저장 후 DB 재조회에 실패했습니다. Supabase 테이블·권한을 확인해 주세요.")
  }
  const saved = normalizeShoppingLinkPageData(reread)
  if (payload.blocks.length > 0 && saved.blocks.length === 0) {
    throw new Error(
      "블록이 DB에 저장되지 않았습니다. Vercel SUPABASE_SERVICE_ROLE_KEY와 shotform_shopping_link_pages 테이블 RLS 설정을 확인해 주세요."
    )
  }
  if (
    payload.profile.displayName.trim() &&
    saved.profile.displayName.trim() !== payload.profile.displayName.trim()
  ) {
    throw new Error(
      "프로필(제목·내용)이 DB에 저장되지 않았습니다. Vercel SUPABASE_SERVICE_ROLE_KEY를 확인해 주세요."
    )
  }
  return saved
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

export async function writeShoppingLinkPage(
  slug: string,
  data: ShoppingLinkPageData
): Promise<ShoppingLinkPageData> {
  if (canWriteToSupabase()) {
    try {
      return await writeToSupabase(slug, data)
    } catch (e) {
      console.error("[shotform-shopping-link] Supabase write failed:", e)
      if (process.env.VERCEL) throw e instanceof Error ? e : deploymentStorageError()
    }
  }
  if (process.env.VERCEL) throw deploymentStorageError()
  await writeToFilesystem(slug, data)
  const saved = await readFromFilesystem(slug)
  if (!saved) throw new Error("저장 후 데이터를 확인하지 못했습니다.")
  return normalizeShoppingLinkPageData(saved)
}

export async function shoppingLinkSlugExists(slug: string, exceptSlug?: string): Promise<boolean> {
  const page = await readShoppingLinkPage(slug)
  if (!page) return false
  if (exceptSlug && sanitizeShoppingLinkSlug(exceptSlug) === sanitizeShoppingLinkSlug(slug)) return false
  return true
}

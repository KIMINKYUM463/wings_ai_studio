import fs from "fs/promises"
import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import { createMvpProjectsClient, formatSupabaseError } from "@/lib/supabase/mvp-projects"

const TABLE = "shotform_auto_edit_jobs"
const STORAGE_BUCKET = "video-sources"
const STORAGE_PREFIX = "shotform-auto-edit"

export function autoEditJobStoreEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
}

function wrapDbError(error: unknown, action: string): never {
  const detail = formatSupabaseError(error)
  console.error(`[shotform-auto-edit-job-store] ${action} 실패:`, error)
  if (detail.includes("PGRST205") || detail.toLowerCase().includes("does not exist")) {
    throw new Error(
      "shotform_auto_edit_jobs 테이블이 없습니다. scripts/create_shotform_auto_edit_jobs_table.sql 을 Supabase SQL Editor에서 실행해 주세요."
    )
  }
  throw new Error(`${action} 실패: ${detail}`)
}

function clientJobPayload(job: AutoEditJobResult): AutoEditJobResult {
  const { jobId, step, ...rest } = job
  return { jobId, step, ...rest }
}

export async function persistAutoEditJobToSupabase(args: {
  job: AutoEditJobResult
  createdAt: number
  outputStoragePath?: string | null
}): Promise<void> {
  if (!autoEditJobStoreEnabled()) return
  const supabase = await createMvpProjectsClient()
  const { error } = await supabase.from(TABLE).upsert({
    job_id: args.job.jobId,
    step: args.job.step,
    data: clientJobPayload(args.job),
    output_storage_path: args.outputStoragePath ?? null,
    created_at: args.createdAt,
    updated_at: new Date().toISOString(),
  })
  if (error) wrapDbError(error, "작업 저장")
}

export async function loadAutoEditJobFromSupabase(
  jobId: string,
  ttlMs: number
): Promise<(AutoEditJobResult & { createdAt: number; outputStoragePath?: string | null }) | null> {
  if (!autoEditJobStoreEnabled()) return null
  const supabase = await createMvpProjectsClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select("step, data, output_storage_path, created_at")
    .eq("job_id", jobId)
    .maybeSingle()
  if (error) {
    console.error("[shotform-auto-edit-job-store] load failed:", error)
    return null
  }
  if (!data) return null
  const createdAt = Number(data.created_at)
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > ttlMs) return null
  const payload = (data.data || {}) as AutoEditJobResult
  return {
    ...payload,
    jobId,
    step: (data.step as AutoEditJobResult["step"]) || payload.step || "error",
    createdAt,
    outputStoragePath: data.output_storage_path,
  }
}

export function autoEditOutputStoragePath(jobId: string): string {
  return `${STORAGE_PREFIX}/${jobId}/output.mp4`
}

export function autoEditSourceStoragePath(jobId: string, videoId: string): string {
  return `${STORAGE_PREFIX}/${jobId}/source_${videoId}.mp4`
}

/** Cloud Run 렌더용 — 소스 MP4 업로드 후 signed URL 반환 */
export async function uploadAutoEditSourceToSupabase(
  jobId: string,
  videoId: string,
  localPath: string
): Promise<string | null> {
  if (!autoEditJobStoreEnabled()) return null
  try {
    const buf = await fs.readFile(localPath)
    if (buf.length < 20_000) return null
    const storagePath = autoEditSourceStoragePath(jobId, videoId)
    const supabase = await createMvpProjectsClient()
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, buf, {
      contentType: "video/mp4",
      upsert: true,
    })
    if (error) {
      console.error("[shotform-auto-edit-job-store] source upload failed:", error)
      return null
    }
    const { data, error: signErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600)
    if (signErr || !data?.signedUrl) {
      console.error("[shotform-auto-edit-job-store] source signed url failed:", signErr)
      return null
    }
    return data.signedUrl
  } catch (e) {
    console.error("[shotform-auto-edit-job-store] source upload error:", e)
    return null
  }
}

export async function uploadAutoEditOutputToSupabase(
  jobId: string,
  localOutputPath: string
): Promise<string | null> {
  if (!autoEditJobStoreEnabled()) return null
  try {
    const buf = await fs.readFile(localOutputPath)
    if (buf.length < 20_000) return null
    const storagePath = autoEditOutputStoragePath(jobId)
    const supabase = await createMvpProjectsClient()
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, buf, {
      contentType: "video/mp4",
      upsert: true,
    })
    if (error) {
      console.error("[shotform-auto-edit-job-store] storage upload failed:", error)
      return null
    }
    return storagePath
  } catch (e) {
    console.error("[shotform-auto-edit-job-store] storage upload error:", e)
    return null
  }
}

export async function downloadAutoEditOutputFromSupabase(
  storagePath: string
): Promise<Buffer | null> {
  if (!autoEditJobStoreEnabled()) return null
  try {
    const supabase = await createMvpProjectsClient()
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath)
    if (error || !data) {
      console.error("[shotform-auto-edit-job-store] storage download failed:", error)
      return null
    }
    const buf = Buffer.from(await data.arrayBuffer())
    return buf.length >= 20_000 ? buf : null
  } catch (e) {
    console.error("[shotform-auto-edit-job-store] storage download error:", e)
    return null
  }
}

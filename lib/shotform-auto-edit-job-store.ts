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

export function autoEditPrecisionMetaStoragePath(jobId: string, videoId: string): string {
  return `${STORAGE_PREFIX}/${jobId}/meta_${videoId}.json`
}

/** 정밀 모드 — 브라우저 키프레임 메타 (요청 본문 크기 초과 방지) */
export async function uploadAutoEditPrecisionMetaToSupabase(
  jobId: string,
  videoId: string,
  meta: { duration: number; precisionKeyframes: Array<{ timeSec: number; keyframeDataUrl: string }> }
): Promise<boolean> {
  if (!autoEditJobStoreEnabled()) return false
  if (!meta.precisionKeyframes?.length) return false
  try {
    const storagePath = autoEditPrecisionMetaStoragePath(jobId, videoId)
    const supabase = await createMvpProjectsClient()
    const body = JSON.stringify(meta)
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, body, {
      contentType: "application/json",
      upsert: true,
    })
    if (error) {
      console.error("[shotform-auto-edit-job-store] precision meta upload failed:", error)
      return false
    }
    return true
  } catch (e) {
    console.error("[shotform-auto-edit-job-store] precision meta upload error:", e)
    return false
  }
}

export async function downloadAutoEditPrecisionMetaFromSupabase(
  jobId: string,
  videoId: string
): Promise<{
  duration: number
  precisionKeyframes?: Array<{ timeSec: number; keyframeDataUrl: string }>
  keyframeDataUrl?: string
  timeSec?: number
} | null> {
  const buf = await downloadAutoEditOutputFromSupabase(autoEditPrecisionMetaStoragePath(jobId, videoId), 200)
  if (!buf?.length) return null
  try {
    const parsed = JSON.parse(buf.toString("utf8")) as {
      duration?: number
      precisionKeyframes?: Array<{ timeSec: number; keyframeDataUrl: string }>
    }
    const duration = Number(parsed.duration)
    const precisionKeyframes = Array.isArray(parsed.precisionKeyframes)
      ? parsed.precisionKeyframes.filter(
          (f) =>
            f &&
            Number.isFinite(f.timeSec) &&
            typeof f.keyframeDataUrl === "string" &&
            f.keyframeDataUrl.startsWith("data:image/")
        )
      : []
    if (!Number.isFinite(duration) || duration <= 0 || precisionKeyframes.length < 6) return null
    return {
      duration,
      precisionKeyframes,
      keyframeDataUrl: precisionKeyframes[0]?.keyframeDataUrl,
      timeSec: precisionKeyframes[0]?.timeSec,
    }
  } catch {
    return null
  }
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
    if (!signErr && data?.signedUrl) return data.signedUrl
    if (signErr) {
      console.error("[shotform-auto-edit-job-store] source signed url failed:", signErr)
    }
    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
    return pub?.publicUrl || null
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

export async function createAutoEditSourceUploadUrl(
  jobId: string,
  videoId: string
): Promise<{ signedUrl: string; token: string; path: string } | null> {
  if (!autoEditJobStoreEnabled()) return null
  try {
    const storagePath = autoEditSourceStoragePath(jobId, videoId)
    const supabase = await createMvpProjectsClient()
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: true })
    if (error || !data?.signedUrl) {
      console.error("[shotform-auto-edit-job-store] signed upload url failed:", error)
      return null
    }
    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
    }
  } catch (e) {
    console.error("[shotform-auto-edit-job-store] signed upload url error:", e)
    return null
  }
}

export async function createAutoEditPrecisionMetaUploadUrl(
  jobId: string,
  videoId: string
): Promise<{ signedUrl: string; token: string; path: string } | null> {
  if (!autoEditJobStoreEnabled()) return null
  try {
    const storagePath = autoEditPrecisionMetaStoragePath(jobId, videoId)
    const supabase = await createMvpProjectsClient()
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: true })
    if (error || !data?.signedUrl) {
      console.error("[shotform-auto-edit-job-store] precision meta signed url failed:", error)
      return null
    }
    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
    }
  } catch (e) {
    console.error("[shotform-auto-edit-job-store] precision meta signed url error:", e)
    return null
  }
}

export async function downloadAutoEditSourceFromSupabase(
  jobId: string,
  videoId: string
): Promise<Buffer | null> {
  return downloadAutoEditOutputFromSupabase(autoEditSourceStoragePath(jobId, videoId))
}

export async function autoEditSourceExistsInSupabase(
  jobId: string,
  videoId: string
): Promise<boolean> {
  if (!autoEditJobStoreEnabled()) return false
  try {
    const buf = await downloadAutoEditSourceFromSupabase(jobId, videoId)
    return Boolean(buf && buf.length >= 50_000)
  } catch {
    return false
  }
}

export async function downloadAutoEditOutputFromSupabase(
  storagePath: string,
  minBytes = 20_000
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
    return buf.length >= minBytes ? buf : null
  } catch (e) {
    console.error("[shotform-auto-edit-job-store] storage download error:", e)
    return null
  }
}

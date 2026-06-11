import {
  autoEditJobStoreEnabled,
  autoEditOutputStoragePath,
} from "@/lib/shotform-auto-edit-job-store"
import { getAutoEditJobAsync, readAutoEditOutput } from "@/lib/shotform-auto-edit-jobs"
import { createMvpProjectsClient } from "@/lib/supabase/mvp-projects"
import { autoEditDownloadUrl } from "@/lib/shotform-auto-edit-download"

const STORAGE_BUCKET = "video-sources"
/** Vercel serverless 응답 본문 제한(~4.5MB) — 이보다 크면 Storage signed URL 사용 */
const VERCEL_PROXY_MAX_BYTES = 4_000_000

export type AutoEditPlayableUrl = {
  url: string
  kind: "supabase" | "api"
}

async function signedOrPublicStorageUrl(storagePath: string): Promise<string | null> {
  if (!autoEditJobStoreEnabled()) return null
  try {
    const supabase = await createMvpProjectsClient()
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600)
    if (!error && data?.signedUrl) return data.signedUrl
    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
    return pub?.publicUrl || null
  } catch (e) {
    console.error("[shotform-auto-edit-playable-url] storage url failed:", e)
    return null
  }
}

/** 브라우저 `<video>` 재생용 URL (대용량 MP4는 Supabase 직접 재생) */
export async function resolveAutoEditOutputPlayableUrl(
  jobId: string
): Promise<AutoEditPlayableUrl | null> {
  const job = await getAutoEditJobAsync(jobId)
  if (!job) return null

  const storageCandidates = [
    job.outputStoragePath,
    autoEditOutputStoragePath(jobId),
  ].filter((p, i, arr): p is string => Boolean(p) && arr.indexOf(p) === i)

  for (const storagePath of storageCandidates) {
    const url = await signedOrPublicStorageUrl(storagePath)
    if (url) return { url, kind: "supabase" }
  }

  const file = await readAutoEditOutput(jobId)
  if (!file) return null

  if (process.env.VERCEL && file.buffer.length > VERCEL_PROXY_MAX_BYTES) {
    return null
  }

  return { url: autoEditDownloadUrl(jobId, { inline: true }), kind: "api" }
}

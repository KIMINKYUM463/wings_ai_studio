import { autoEditDownloadUrl } from "@/lib/shotform-auto-edit-download"
import { fetchMvpVideoBlob } from "@/lib/mvp-capcut-export"
import { assertPreviewMp4Blob } from "@/lib/mvp-mp4-preview"
import { loadMvpEditMp4 } from "@/lib/mvp-local-media-cache"

const MIN_STUDIO_VIDEO_BYTES = 20_000

async function fetchJobMp4Blob(jobId: string): Promise<Blob | null> {
  try {
    const res = await fetch(autoEditDownloadUrl(jobId), { cache: "no-store" })
    if (!res.ok) return null
    const blob = await res.blob()
    if (blob.size < MIN_STUDIO_VIDEO_BYTES) return null
    try {
      await assertPreviewMp4Blob(blob)
    } catch {
      return null
    }
    return blob
  } catch {
    return null
  }
}

/** 편집 스튜디오 — CapCut·Vmake 등 blob이 필요할 때 (Supabase CORS·blob URL 폴백) */
export async function resolveMvpStudioVideoBlob(args: {
  videoUrl: string | null
  downloadUrl?: string | null
  jobId?: string
  projectId?: string
}): Promise<Blob | null> {
  const { videoUrl, downloadUrl, jobId, projectId } = args

  if (projectId && jobId) {
    const cached = await loadMvpEditMp4(projectId, jobId)
    if (cached && cached.size >= MIN_STUDIO_VIDEO_BYTES) return cached
  }

  if (jobId) {
    const fromApi = await fetchJobMp4Blob(jobId)
    if (fromApi) return fromApi
  }

  const fromUrls = await fetchMvpVideoBlob(videoUrl, downloadUrl || (jobId ? autoEditDownloadUrl(jobId) : null))
  if (fromUrls && fromUrls.size >= 4096) return fromUrls

  if (jobId) {
    try {
      const metaRes = await fetch(autoEditDownloadUrl(jobId, { mode: "url" }), { cache: "no-store" })
      const meta = (await metaRes.json().catch(() => ({}))) as {
        url?: string
        kind?: "supabase" | "api"
      }
      if (metaRes.ok && meta.url && meta.kind === "api") {
        const res = await fetch(meta.url, { cache: "no-store" })
        if (res.ok) {
          const blob = await res.blob()
          if (blob.size >= MIN_STUDIO_VIDEO_BYTES) return blob
        }
      }
    } catch {
      /* ignore */
    }
  }

  return null
}

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

async function fetchBlobFromPlayableMeta(jobId: string): Promise<Blob | null> {
  try {
    const metaRes = await fetch(autoEditDownloadUrl(jobId, { mode: "url" }), { cache: "no-store" })
    const meta = (await metaRes.json().catch(() => ({}))) as {
      url?: string
      kind?: "supabase" | "api"
    }
    if (!metaRes.ok || !meta.url) return null

    const res = await fetch(meta.url, { cache: "no-store" })
    if (!res.ok) return null
    const blob = await res.blob()
    if (blob.size < MIN_STUDIO_VIDEO_BYTES) return null
    try {
      await assertPreviewMp4Blob(blob)
      return blob
    } catch {
      return null
    }
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
  /** true면 IndexedDB 캐시 생략 (자막 제거 등 최신 Storage 파일 필요 시) */
  skipLocalCache?: boolean
}): Promise<Blob | null> {
  const { videoUrl, downloadUrl, jobId, projectId, skipLocalCache } = args

  if (!skipLocalCache && projectId && jobId) {
    const cached = await loadMvpEditMp4(projectId, jobId)
    if (cached && cached.size >= MIN_STUDIO_VIDEO_BYTES) {
      try {
        await assertPreviewMp4Blob(cached)
        return cached
      } catch {
        /* stale cache */
      }
    }
  }

  /** 배포 미리보기와 동일 — Supabase signed URL 우선 (Vercel 4.5MB 프록시 제한 우회) */
  if (jobId) {
    const fromPlayable = await fetchBlobFromPlayableMeta(jobId)
    if (fromPlayable) return fromPlayable
  }

  if (jobId) {
    const fromApi = await fetchJobMp4Blob(jobId)
    if (fromApi) return fromApi
  }

  const fromUrls = await fetchMvpVideoBlob(videoUrl, downloadUrl || (jobId ? autoEditDownloadUrl(jobId) : null))
  if (fromUrls && fromUrls.size >= MIN_STUDIO_VIDEO_BYTES) {
    try {
      await assertPreviewMp4Blob(fromUrls)
      return fromUrls
    } catch {
      /* try next */
    }
  }

  return null
}

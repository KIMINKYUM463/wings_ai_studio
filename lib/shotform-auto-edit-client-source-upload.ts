/** 브라우저에서 Supabase Storage에 소스 MP4·정밀 키프레임 메타 업로드 (Vercel CDN 다운로드·요청 본문 한도 우회) */

import type { AutoEditPick, ClientVideoMetaEntry } from "@/lib/shotform-auto-edit-types"
import { fetchMvpPickVideoBlob } from "@/lib/shotform-mvp-pick-video-download"

async function uploadOneAutoEditSource(
  jobId: string,
  pick: AutoEditPick,
  blob: Blob,
  index: number,
  total: number,
  onProgress?: (message: string) => void
): Promise<void> {
  const label = pick.title || pick.video_id
  onProgress?.(`영상 ${index + 1}/${total} 서버 업로드 중… (${label})`)

  const urlRes = await fetch("/api/shotform/auto-edit/source-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, videoId: pick.video_id }),
  })
  const urlJson = (await urlRes.json().catch(() => ({}))) as {
    signedUrl?: string
    token?: string
    error?: string
  }
  if (!urlRes.ok || !urlJson.signedUrl) {
    throw new Error(urlJson.error || `영상 업로드 URL 발급 실패 (${urlRes.status})`)
  }

  const uploadRes = await fetch(urlJson.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      ...(urlJson.token ? { "x-upsert": "true" } : {}),
    },
    body: blob,
  })
  if (!uploadRes.ok) {
    throw new Error(`영상 Storage 업로드 실패 (${uploadRes.status}): ${label}`)
  }
}

async function uploadPrecisionMeta(
  jobId: string,
  pick: AutoEditPick,
  meta: ClientVideoMetaEntry,
  onProgress?: (message: string) => void
): Promise<void> {
  if ((meta.precisionKeyframes?.length ?? 0) < 6) return
  onProgress?.(`정밀 키프레임 메타 업로드… (${pick.title || pick.video_id})`)
  const urlRes = await fetch("/api/shotform/auto-edit/precision-meta-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, videoId: pick.video_id }),
  })
  const urlJson = (await urlRes.json().catch(() => ({}))) as {
    signedUrl?: string
    token?: string
    error?: string
  }
  if (!urlRes.ok || !urlJson.signedUrl) {
    throw new Error(urlJson.error || "정밀 키프레임 메타 업로드 URL 발급 실패")
  }
  const payload = JSON.stringify({
    duration: meta.duration,
    precisionKeyframes: meta.precisionKeyframes,
  })
  const uploadRes = await fetch(urlJson.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(urlJson.token ? { "x-upsert": "true" } : {}),
    },
    body: payload,
  })
  if (!uploadRes.ok) {
    throw new Error(`정밀 키프레임 메타 Storage 업로드 실패 (${uploadRes.status})`)
  }
}

export async function uploadAutoEditSourcesFromBrowser(
  jobId: string,
  picks: AutoEditPick[],
  onProgress?: (message: string) => void,
  prefetchedBlobs?: Record<string, Blob>,
  clientVideoMeta?: Record<string, ClientVideoMetaEntry>
): Promise<void> {
  const total = picks.length
  onProgress?.(`영상 ${total}개 서버 업로드 준비…`)

  const blobs = await Promise.all(
    picks.map(async (pick, i) => {
      const cached = prefetchedBlobs?.[pick.video_id]
      if (cached?.size) return cached

      const label = pick.title || pick.video_id
      onProgress?.(`영상 ${i + 1}/${total} 다운로드 중… (${label})`)
      const { blob } = await fetchMvpPickVideoBlob(pick, (hint) => onProgress?.(hint))
      return blob
    })
  )

  await Promise.all(
    picks.map(async (pick, i) => {
      await uploadOneAutoEditSource(jobId, pick, blobs[i]!, i, total, onProgress)
      const meta = clientVideoMeta?.[pick.video_id]
      if (meta) {
        await uploadPrecisionMeta(jobId, pick, meta, onProgress).catch(() => undefined)
      }
    })
  )
}

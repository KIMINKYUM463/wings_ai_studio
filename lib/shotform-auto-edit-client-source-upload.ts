/** 브라우저 → Supabase Storage 소스 업로드 (Vercel CDN 다운로드 우회) */

import type { AutoEditPick } from "@/lib/shotform-auto-edit-types"
import { fetchMvpPickVideoBlob } from "@/lib/shotform-mvp-pick-video-download"

export async function uploadAutoEditSourcesFromBrowser(
  jobId: string,
  picks: AutoEditPick[],
  onProgress?: (message: string) => void
): Promise<void> {
  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i]!
    const label = pick.title || pick.video_id
    onProgress?.(`영상 ${i + 1}/${picks.length} 다운로드 중… (${label})`)

    const { blob } = await fetchMvpPickVideoBlob(pick, (hint) => onProgress?.(hint))

    onProgress?.(`영상 ${i + 1}/${picks.length} 서버 업로드 중…`)
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
}

/** 브라우저에서 영상 길이·키프레임 추출 — 서버 ffmpeg 부하·지연 감소 */

import type { AutoEditPick } from "@/lib/shotform-auto-edit-types"
import { isAllowedVideoHost } from "@/lib/video-upstream-fetch"

export type ClientVideoMetaEntry = {
  duration: number
  keyframeDataUrl: string
  timeSec: number
}

function toPlayableUrl(videoUrl: string): string {
  const url = videoUrl.trim()
  if (!url.startsWith("http")) return url
  try {
    const host = new URL(url).hostname
    if (isAllowedVideoHost(host) || host.includes("tiktokcdn")) {
      return `/api/proxy-video?url=${encodeURIComponent(url)}`
    }
  } catch {
    /* ignore */
  }
  return url
}

/** 단일 영상 — loadedmetadata + seek 후 canvas 캡처 */
export function extractClientVideoMeta(
  videoUrl: string,
  timeRatio = 0.12,
  timeoutMs = 50_000
): Promise<ClientVideoMetaEntry | null> {
  if (typeof document === "undefined") return Promise.resolve(null)

  return new Promise((resolve) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.muted = true
    video.playsInline = true
    video.preload = "auto"

    let settled = false
    const finish = (value: ClientVideoMetaEntry | null) => {
      if (settled) return
      settled = true
      video.removeAttribute("src")
      video.load()
      resolve(value)
    }

    const timer = window.setTimeout(() => finish(null), timeoutMs)

    video.addEventListener("error", () => {
      window.clearTimeout(timer)
      finish(null)
    })

    video.addEventListener("loadedmetadata", () => {
      const duration = Number(video.duration)
      if (!Number.isFinite(duration) || duration <= 0.2) {
        window.clearTimeout(timer)
        finish(null)
        return
      }
      const timeSec = Math.max(0.05, Math.min(duration * timeRatio, duration - 0.08))
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked)
        try {
          const w = Math.min(480, video.videoWidth || 360)
          const h = Math.max(1, Math.round((w * (video.videoHeight || 640)) / Math.max(1, video.videoWidth || 360)))
          const canvas = document.createElement("canvas")
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            window.clearTimeout(timer)
            finish(null)
            return
          }
          ctx.drawImage(video, 0, 0, w, h)
          const keyframeDataUrl = canvas.toDataURL("image/jpeg", 0.62)
          window.clearTimeout(timer)
          finish({ duration, keyframeDataUrl, timeSec })
        } catch {
          window.clearTimeout(timer)
          finish(null)
        }
      }
      video.addEventListener("seeked", onSeeked)
      video.currentTime = timeSec
    })

    video.src = toPlayableUrl(videoUrl)
    video.load()
  })
}

async function extractClientVideoMetaFromBlob(
  blob: Blob,
  timeRatio = 0.12
): Promise<ClientVideoMetaEntry | null> {
  const objectUrl = URL.createObjectURL(blob)
  try {
    return await extractClientVideoMeta(objectUrl, timeRatio)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** 선택 영상 병렬 — 브라우저에서 키프레임·길이 미리 추출 */
export async function extractClientVideoMetaForPicks(
  picks: AutoEditPick[],
  onProgress?: (message: string) => void
): Promise<Record<string, ClientVideoMetaEntry>> {
  const out: Record<string, ClientVideoMetaEntry> = {}
  const { fetchMvpPickVideoBlob } = await import("@/lib/shotform-mvp-pick-video-download")

  await Promise.all(
    picks.map(async (pick, i) => {
      onProgress?.(`브라우저 미리 분석 ${i + 1}/${picks.length}…`)
      let meta = await extractClientVideoMeta(pick.videoUrl)
      if (!meta) {
        try {
          onProgress?.(`브라우저 미리 분석 ${i + 1}/${picks.length} — MP4 재시도…`)
          const { blob } = await fetchMvpPickVideoBlob(
            {
              videoUrl: pick.videoUrl,
              noteUrl: pick.noteUrl,
              title: pick.title,
              platform: pick.platform,
              video_id: pick.video_id,
            },
            (hint) => onProgress?.(hint)
          )
          meta = await extractClientVideoMetaFromBlob(blob)
        } catch {
          /* 개별 영상 실패는 서버 업로드 경로로 폴백 */
        }
      }
      if (meta) out[pick.video_id] = meta
    })
  )
  return out
}

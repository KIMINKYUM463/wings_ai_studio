/** 브라우저에서 영상 길이·키프레임 추출 — 서버 ffmpeg 부하·지연 감소 */

import type { AutoEditPick, ClientVideoMetaEntry } from "@/lib/shotform-auto-edit-types"
import { isAllowedVideoHost } from "@/lib/video-upstream-fetch"

export type { ClientVideoMetaEntry }

function precisionKeyframeTimes(duration: number, count = 16): number[] {
  const span = Math.min(Math.max(0.5, duration), 120)
  const start = 0.35
  const end = Math.max(start + 0.2, span - 0.15)
  const n = Math.max(8, Math.min(count, 20))
  if (n === 1) return [Math.round(((start + end) / 2) * 10) / 10]
  const range = end - start
  return Array.from({ length: n }, (_, i) =>
    Math.round((start + (range * i) / (n - 1)) * 10) / 10
  )
}

function captureVideoFrameDataUrl(video: HTMLVideoElement, timeSec: number): Promise<string | null> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked)
      try {
        const w = Math.min(320, video.videoWidth || 360)
        const h = Math.max(1, Math.round((w * (video.videoHeight || 640)) / Math.max(1, video.videoWidth || 360)))
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(video, 0, 0, w, h)
        resolve(canvas.toDataURL("image/jpeg", 0.42))
      } catch {
        resolve(null)
      }
    }
    video.addEventListener("seeked", onSeeked)
    video.currentTime = Math.max(0.05, Math.min(timeSec, Math.max(0.1, video.duration - 0.08)))
  })
}

/** 정밀 분석 — 브라우저에서 2분 구간 다중 키프레임 캡처 */
export async function extractPrecisionKeyframesFromVideo(
  videoSrc: string,
  timeoutMs = 90_000
): Promise<{ duration: number; frames: Array<{ timeSec: number; keyframeDataUrl: string }> } | null> {
  if (typeof document === "undefined") return null

  return new Promise((resolve) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.muted = true
    video.playsInline = true
    video.preload = "auto"

    let settled = false
    const finish = (value: { duration: number; frames: Array<{ timeSec: number; keyframeDataUrl: string }> } | null) => {
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
      void (async () => {
        const duration = Number(video.duration)
        if (!Number.isFinite(duration) || duration <= 0.2) {
          window.clearTimeout(timer)
          finish(null)
          return
        }
        const times = precisionKeyframeTimes(duration, 16)
        const frames: Array<{ timeSec: number; keyframeDataUrl: string }> = []
        for (const timeSec of times) {
          const keyframeDataUrl = await captureVideoFrameDataUrl(video, timeSec)
          if (keyframeDataUrl) frames.push({ timeSec, keyframeDataUrl })
        }
        window.clearTimeout(timer)
        finish(frames.length >= 6 ? { duration, frames } : null)
      })()
    })

    video.src = toPlayableUrl(videoSrc)
    video.load()
  })
}

async function extractPrecisionKeyframesFromBlob(blob: Blob): Promise<{
  duration: number
  frames: Array<{ timeSec: number; keyframeDataUrl: string }>
} | null> {
  const objectUrl = URL.createObjectURL(blob)
  try {
    return await extractPrecisionKeyframesFromVideo(objectUrl)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function toPlayableUrl(videoUrl: string): string {
  const url = videoUrl.trim()
  if (!url.startsWith("http")) return url
  try {
    const host = new URL(url).hostname
    if (isAllowedVideoHost(host) || host.includes("tiktokcdn") || host.includes("googlevideo.com")) {
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

/** 키프레임 없이 길이만 — 고속 모드 서버 ffmpeg 생략용 */
export function extractClientVideoDurationOnly(
  videoUrl: string,
  timeoutMs = 18_000
): Promise<ClientVideoMetaEntry | null> {
  if (typeof document === "undefined") return Promise.resolve(null)

  return new Promise((resolve) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.muted = true
    video.playsInline = true
    video.preload = "metadata"

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
      window.clearTimeout(timer)
      const duration = Number(video.duration)
      if (!Number.isFinite(duration) || duration <= 0.2) {
        finish(null)
        return
      }
      finish({ duration })
    })
    video.src = toPlayableUrl(videoUrl)
    video.load()
  })
}

async function extractDurationFromBlob(blob: Blob): Promise<ClientVideoMetaEntry | null> {
  const objectUrl = URL.createObjectURL(blob)
  try {
    return await extractClientVideoDurationOnly(objectUrl)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export type ClientVideoMetaExtraction = {
  meta: Record<string, ClientVideoMetaEntry>
  /** 미리 분석 중 받은 MP4 — 업로드 시 재다운로드 생략 */
  blobs: Record<string, Blob>
}

/** 선택 영상 병렬 — 브라우저에서 키프레임·길이 미리 추출 (URL 스트리밍 우선, 실패 시 MP4 blob) */
export async function extractClientVideoMetaForPicks(
  picks: AutoEditPick[],
  onProgress?: (message: string) => void,
  opts?: { precision?: boolean; localWorkDir?: string; companionUrl?: string }
): Promise<ClientVideoMetaExtraction> {
  const meta: Record<string, ClientVideoMetaEntry> = {}
  const blobs: Record<string, Blob> = {}
  const { fetchMvpPickVideoBlob } = await import("@/lib/shotform-mvp-pick-video-download")
  const precision = opts?.precision === true
  const fetchOpts = {
    localWorkDir: opts?.localWorkDir,
    companionUrl: opts?.companionUrl,
  }

  await Promise.all(
    picks.map(async (pick, i) => {
      onProgress?.(`브라우저 미리 분석 ${i + 1}/${picks.length}…`)
      let entry: ClientVideoMetaEntry | null = null
      let blob: Blob | undefined

      if (precision) {
        onProgress?.(`정밀 분석 ${i + 1}/${picks.length} — 영상 다운로드…`)
        try {
          const fetched = await fetchMvpPickVideoBlob(pick, (hint) => onProgress?.(hint), fetchOpts)
          blob = fetched.blob
          blobs[pick.video_id] = blob
          onProgress?.(`정밀 분석 ${i + 1}/${picks.length} — 키프레임 ${16}장 캡처…`)
          const precisionCap = await extractPrecisionKeyframesFromBlob(blob)
          if (precisionCap) {
            entry = {
              duration: precisionCap.duration,
              precisionKeyframes: precisionCap.frames,
              keyframeDataUrl: precisionCap.frames[0]?.keyframeDataUrl,
              timeSec: precisionCap.frames[0]?.timeSec,
            }
          }
        } catch {
          /* blob 폴백 */
        }
      }

      if (!entry?.precisionKeyframes?.length) {
        onProgress?.(`브라우저 미리 분석 ${i + 1}/${picks.length} — 스트리밍…`)
        entry = await extractClientVideoMeta(pick.videoUrl, 0.12, 22_000)
        if (!entry?.keyframeDataUrl) {
          const durOnly = await extractClientVideoDurationOnly(pick.videoUrl, 14_000)
          if (durOnly) entry = { ...durOnly, ...entry, duration: durOnly.duration }
        }
      }

      if (!entry?.duration || entry.duration <= 0 || (precision && !entry.precisionKeyframes?.length)) {
        try {
          if (!blob) {
            onProgress?.(`브라우저 미리 분석 ${i + 1}/${picks.length} — MP4…`)
            const fetched = await fetchMvpPickVideoBlob(pick, (hint) => onProgress?.(hint), fetchOpts)
            blob = fetched.blob
          }
          if (blob) {
            blobs[pick.video_id] = blob
            if (precision) {
              onProgress?.(`정밀 분석 ${i + 1}/${picks.length} — MP4 키프레임 캡처…`)
              const precisionCap = await extractPrecisionKeyframesFromBlob(blob)
              if (precisionCap) {
                entry = {
                  duration: precisionCap.duration,
                  precisionKeyframes: precisionCap.frames,
                  keyframeDataUrl: precisionCap.frames[0]?.keyframeDataUrl,
                  timeSec: precisionCap.frames[0]?.timeSec,
                }
              }
            } else {
              entry = await extractClientVideoMetaFromBlob(blob)
              if (!entry?.keyframeDataUrl) {
                const dur = await extractDurationFromBlob(blob)
                if (dur) entry = { ...dur, ...entry, duration: dur.duration }
              }
            }
          }
        } catch {
          /* 메타 없음 — 서버 폴백 */
        }
      }

      if (entry?.duration && entry.duration > 0) meta[pick.video_id] = entry
    })
  )
  return { meta, blobs }
}

/** 짜집기 MP4·blob URL에서 참조 프레임 캡처 (썸네일 Replicate 입력용) */

import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"

const DEFAULT_MAX_WIDTH = 1080
export const MAX_THUMBNAIL_VIDEO_FRAMES = 16
const MIN_FRAME_GAP_SEC = 0.35

export type CapturedVideoFrame = {
  id: string
  timeSec: number
  dataUrl: string
  /** 예: 0:03.2 · 컷 2 */
  label: string
  segmentIndex?: number
}

function resizeDataUrl(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("캔버스를 사용할 수 없습니다."))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL("image/jpeg", 0.85))
    }
    img.onerror = () => reject(new Error("참조 이미지 리사이즈 실패"))
    img.src = dataUrl
  })
}

/** API 전송용 — 업로드·캡처 이미지를 Replicate 입력 크기로 압축 */
export async function compressReferenceImageDataUrl(dataUrl: string, maxWidth = DEFAULT_MAX_WIDTH): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl
  return resizeDataUrl(dataUrl, maxWidth)
}

/** 원격·data URL 이미지를 data URL로 영구 저장 (AI 배경 기록용) */
export async function persistImageUrlAsDataUrl(url: string, maxWidth = DEFAULT_MAX_WIDTH): Promise<string> {
  const trimmed = url.trim()
  if (!trimmed) throw new Error("이미지 URL이 비어 있습니다.")
  if (trimmed.startsWith("data:image/")) {
    return resizeDataUrl(trimmed, maxWidth)
  }
  const fetchUrl = /^https:\/\//i.test(trimmed)
    ? `/api/shotform/image-proxy?url=${encodeURIComponent(trimmed)}`
    : trimmed
  const res = await fetch(fetchUrl)
  if (!res.ok) throw new Error("이미지를 불러올 수 없습니다.")
  const blob = await res.blob()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("이미지 변환 실패"))
    reader.readAsDataURL(blob)
  })
  return resizeDataUrl(dataUrl, maxWidth)
}

function formatCaptureTimeLabel(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toFixed(1).padStart(m > 0 ? 4 : 3, "0")}`
}

function clampSeekTime(video: HTMLVideoElement, timeSec: number): number {
  const dur = Number.isFinite(video.duration) ? video.duration : timeSec
  return Math.min(Math.max(0.05, timeSec), Math.max(0.1, dur - 0.05))
}

async function drawVideoFrameToDataUrl(video: HTMLVideoElement, maxWidth: number): Promise<string> {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) throw new Error("영상 크기를 읽을 수 없습니다.")
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("캔버스를 사용할 수 없습니다.")
  ctx.drawImage(video, 0, 0, w, h)
  const raw = canvas.toDataURL("image/jpeg", 0.88)
  return resizeDataUrl(raw, maxWidth)
}

function loadVideoElement(videoSrc: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.muted = true
    video.playsInline = true
    video.preload = "auto"
    video.onloadedmetadata = () => resolve(video)
    video.onerror = () => reject(new Error("영상을 불러올 수 없습니다."))
    video.src = videoSrc
  })
}

function releaseVideoElement(video: HTMLVideoElement) {
  video.removeAttribute("src")
  video.load()
}

function captureFrameAtTime(video: HTMLVideoElement, timeSec: number, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked)
      void drawVideoFrameToDataUrl(video, maxWidth).then(resolve).catch(reject)
    }
    video.addEventListener("seeked", onSeeked)
    video.currentTime = clampSeekTime(video, timeSec)
  })
}

/** 짜집기 영상에서 캡처할 시각 목록 — 컷(세그먼트) 중심 + 전체 균등 샘플 */
export function buildThumbnailCaptureTimes(
  durationSec: number,
  segments?: readonly NarrationSegment[],
  maxFrames = MAX_THUMBNAIL_VIDEO_FRAMES
): Array<{ timeSec: number; segmentIndex?: number }> {
  const safeDur = Math.max(0.5, durationSec)
  const raw: Array<{ timeSec: number; segmentIndex?: number }> = []

  if (segments?.length) {
    segments.forEach((seg, i) => {
      const len = seg.end - seg.start
      if (len < 0.12) return
      for (const ratio of [0.22, 0.5, 0.78]) {
        raw.push({ timeSec: seg.start + len * ratio, segmentIndex: i + 1 })
      }
    })
  }

  const clampTime = (t: number) =>
    Math.round(Math.min(Math.max(0.05, t), safeDur - 0.05) * 100) / 100

  const segmentSlots = raw
    .map((x) => ({ ...x, timeSec: clampTime(x.timeSec) }))
    .sort((a, b) => a.timeSec - b.timeSec)

  const picked: Array<{ timeSec: number; segmentIndex?: number }> = []
  const tryPush = (item: { timeSec: number; segmentIndex?: number }) => {
    if (picked.length >= maxFrames) return
    const last = picked[picked.length - 1]
    if (!last || item.timeSec - last.timeSec >= MIN_FRAME_GAP_SEC) picked.push(item)
  }

  for (const item of segmentSlots) tryPush(item)

  const fillCount = Math.max(maxFrames, maxFrames - picked.length + 4)
  for (let i = 0; i < fillCount; i++) {
    if (picked.length >= maxFrames) break
    const t = clampTime(0.12 + (safeDur - 0.24) * (fillCount <= 1 ? 0 : i / (fillCount - 1)))
    tryPush({ timeSec: t })
  }

  return picked.sort((a, b) => a.timeSec - b.timeSec)
}

export async function captureVideoFrameDataUrl(
  videoSrc: string,
  timeSec = 1,
  maxWidth = DEFAULT_MAX_WIDTH
): Promise<string> {
  const video = await loadVideoElement(videoSrc)
  try {
    return await captureFrameAtTime(video, timeSec, maxWidth)
  } finally {
    releaseVideoElement(video)
  }
}

/** 짜집기 MP4에서 제품 후보 프레임을 최대 N장 캡처 */
export async function captureVideoFramesFromEdit(
  videoSrc: string,
  segments?: readonly NarrationSegment[],
  options?: {
    maxFrames?: number
    maxWidth?: number
    onProgress?: (done: number, total: number) => void
  }
): Promise<CapturedVideoFrame[]> {
  const maxFrames = options?.maxFrames ?? MAX_THUMBNAIL_VIDEO_FRAMES
  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH
  const video = await loadVideoElement(videoSrc)
  try {
    const slots = buildThumbnailCaptureTimes(video.duration, segments, maxFrames)
    const results: CapturedVideoFrame[] = []
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!
      const dataUrl = await captureFrameAtTime(video, slot.timeSec, maxWidth)
      const timeLabel = formatCaptureTimeLabel(slot.timeSec)
      results.push({
        id: `vf_${i}_${Math.round(slot.timeSec * 1000)}`,
        timeSec: slot.timeSec,
        dataUrl,
        label: slot.segmentIndex ? `${timeLabel} · 컷 ${slot.segmentIndex}` : timeLabel,
        segmentIndex: slot.segmentIndex,
      })
      options?.onProgress?.(i + 1, slots.length)
    }
    return results
  } finally {
    releaseVideoElement(video)
  }
}

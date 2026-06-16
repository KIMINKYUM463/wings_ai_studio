/** AI 모자이크 스캔용 — 짜집기 영상에서 균등 샘플 프레임 캡처 */

const DEFAULT_INTERVAL_SEC = 0.5
const DEFAULT_MAX_FRAMES = 24
const DEFAULT_MAX_WIDTH = 384

export type MosaicScanFrame = {
  timeSec: number
  /** data:image/jpeg;base64,... prefix 제외 */
  imageBase64: string
}

function clampSeekTime(video: HTMLVideoElement, timeSec: number): number {
  const dur = Number.isFinite(video.duration) ? video.duration : timeSec
  return Math.min(Math.max(0.05, timeSec), Math.max(0.1, dur - 0.05))
}

function stripDataUrlPrefix(dataUrl: string): string {
  const i = dataUrl.indexOf(",")
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl
}

async function resizeJpegBase64(dataUrl: string, maxWidth: number): Promise<string> {
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
      resolve(stripDataUrlPrefix(canvas.toDataURL("image/jpeg", 0.72)))
    }
    img.onerror = () => reject(new Error("프레임 리사이즈 실패"))
    img.src = dataUrl
  })
}

function captureFrameAtTime(video: HTMLVideoElement, timeSec: number, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked)
      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) {
        reject(new Error("영상 크기를 읽을 수 없습니다."))
        return
      }
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("캔버스를 사용할 수 없습니다."))
        return
      }
      ctx.drawImage(video, 0, 0, w, h)
      void resizeJpegBase64(canvas.toDataURL("image/jpeg", 0.78), maxWidth).then(resolve).catch(reject)
    }
    video.addEventListener("seeked", onSeeked)
    video.currentTime = clampSeekTime(video, timeSec)
  })
}

export function buildMosaicScanTimes(
  durationSec: number,
  options?: { intervalSec?: number; maxFrames?: number }
): number[] {
  const interval = options?.intervalSec ?? DEFAULT_INTERVAL_SEC
  const maxFrames = options?.maxFrames ?? DEFAULT_MAX_FRAMES
  const safeDur = Math.max(0.5, durationSec)
  const times: number[] = []
  for (let t = 0.08; t < safeDur - 0.05 && times.length < maxFrames; t += interval) {
    times.push(Math.round(t * 100) / 100)
  }
  if (!times.length) times.push(0.1)
  const last = times[times.length - 1]!
  if (safeDur - last > interval * 0.6 && times.length < maxFrames) {
    times.push(Math.round((safeDur - 0.08) * 100) / 100)
  }
  return times
}

/** 편집 중인 video 엘리먼트에서 프레임 추출 — 재생 위치 복원 */
export async function captureMosaicScanFramesFromVideo(
  video: HTMLVideoElement,
  durationSec: number,
  options?: {
    intervalSec?: number
    maxFrames?: number
    maxWidth?: number
    onProgress?: (done: number, total: number) => void
  }
): Promise<MosaicScanFrame[]> {
  const times = buildMosaicScanTimes(durationSec, options)
  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH
  const savedTime = video.currentTime
  const wasPaused = video.paused

  const out: MosaicScanFrame[] = []
  try {
    video.pause()
    for (let i = 0; i < times.length; i++) {
      const timeSec = times[i]!
      const imageBase64 = await captureFrameAtTime(video, timeSec, maxWidth)
      out.push({ timeSec, imageBase64 })
      options?.onProgress?.(i + 1, times.length)
    }
  } finally {
    video.currentTime = savedTime
    if (!wasPaused) {
      void video.play().catch(() => {})
    }
  }
  return out
}

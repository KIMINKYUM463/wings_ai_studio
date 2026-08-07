/** AI 영상 없이 장면 이미지 → Ken Burns 줌인 클립(WebM) 생성 */

import { mvpHoldEndZoomScale } from "@/lib/shotform-mvp-preview-sync"

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("이 브라우저는 MediaRecorder를 지원하지 않습니다.")
  }
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ]
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ""
}

function resolveDrawableImageUrl(url: string): string {
  const trimmed = url.trim()
  if (
    !trimmed ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("/")
  ) {
    return trimmed
  }
  // 원격 CDN은 CORS로 canvas가 오염될 수 있어 프록시 경유
  return `/api/shotform/image-proxy?url=${encodeURIComponent(trimmed)}`
}

async function loadImageElement(url: string): Promise<HTMLImageElement> {
  const candidates = [url]
  const proxied = resolveDrawableImageUrl(url)
  if (proxied !== url) candidates.push(proxied)

  let lastError: Error | null = null
  for (const src of candidates) {
    try {
      const img = new Image()
      if (!src.startsWith("blob:") && !src.startsWith("data:")) {
        img.crossOrigin = "anonymous"
      }
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."))
        img.src = src
      })
      return img
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }
  throw lastError || new Error("이미지를 불러오지 못했습니다.")
}

function drawCoverZoom(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  scale: number
) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return

  const canvasAspect = canvasW / canvasH
  const imgAspect = iw / ih
  let baseW: number
  let baseH: number
  if (imgAspect > canvasAspect) {
    baseH = canvasH
    baseW = canvasH * imgAspect
  } else {
    baseW = canvasW
    baseH = canvasW / imgAspect
  }

  const w = baseW * scale
  const h = baseH * scale
  const x = (canvasW - w) / 2
  const y = (canvasH - h) / 2

  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, canvasW, canvasH)
  ctx.drawImage(img, x, y, w, h)
}

export type ImageZoomClipOptions = {
  imageUrl: string
  /** 초 단위 (TTS 장면 길이에 맞춤) */
  durationSec: number
  width?: number
  height?: number
  fps?: number
  /** 최종 확대 배율 (기본 1.12) */
  maxScale?: number
}

/**
 * 정지 이미지에 부드러운 줌인(Ken Burns)을 적용한 짧은 영상 Blob을 만듭니다.
 * 오디오는 포함하지 않습니다 (나중에 TTS와 합성).
 */
export async function renderImageZoomClip(opts: ImageZoomClipOptions): Promise<Blob> {
  const durationSec = Math.max(1.2, Math.min(30, opts.durationSec || 3))
  const width = opts.width ?? 1080
  const height = opts.height ?? 1920
  const fps = opts.fps ?? 30
  const maxScale = opts.maxScale ?? 1.12

  const img = await loadImageElement(opts.imageUrl)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("캔버스를 사용할 수 없습니다.")

  const mimeType = pickRecorderMime()
  const stream = canvas.captureStream(fps)
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
    : new MediaRecorder(stream, { videoBitsPerSecond: 6_000_000 })

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data)
  }

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("줌인 클립 녹화에 실패했습니다."))
    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || "video/webm"
      resolve(new Blob(chunks, { type }))
    }
  })

  recorder.start(100)

  const totalFrames = Math.max(1, Math.round(durationSec * fps))
  const frameDelayMs = 1000 / fps

  for (let frame = 0; frame < totalFrames; frame++) {
    const progress = totalFrames <= 1 ? 1 : frame / (totalFrames - 1)
    const scale = mvpHoldEndZoomScale(progress, maxScale)
    drawCoverZoom(ctx, img, width, height, scale)
    await new Promise((r) => setTimeout(r, frameDelayMs))
  }

  // 마지막 프레임이 스트림에 반영되도록 한 틱 대기
  await new Promise((r) => setTimeout(r, frameDelayMs))
  recorder.stop()
  for (const track of stream.getTracks()) track.stop()

  const blob = await stopped
  if (!blob.size) throw new Error("줌인 클립이 비어 있습니다.")
  return blob
}

export async function renderImageZoomClipObjectUrl(
  opts: ImageZoomClipOptions
): Promise<string> {
  const blob = await renderImageZoomClip(opts)
  return URL.createObjectURL(blob)
}

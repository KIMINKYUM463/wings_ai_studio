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

type SourceRect = { sx: number; sy: number; sw: number; sh: number }

/**
 * AI 이미지가 정사각 레퍼런스를 9:16에 붙여 위·아래(또는 좌·우)에 검은 띠를 남기는 경우가 있어
 * 거의 단색 검정인 가장자리 줄을 잘라낸 영역을 돌려줍니다. 판단이 어려우면 원본 전체를 씁니다.
 */
function detectContentRect(img: HTMLImageElement): SourceRect {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const full = { sx: 0, sy: 0, sw: iw, sh: ih }
  try {
    const sampleW = 72
    const sampleH = Math.max(1, Math.round((ih / iw) * sampleW))
    const probe = document.createElement("canvas")
    probe.width = sampleW
    probe.height = sampleH
    const pctx = probe.getContext("2d", { willReadFrequently: true })
    if (!pctx) return full
    pctx.drawImage(img, 0, 0, sampleW, sampleH)
    const { data } = pctx.getImageData(0, 0, sampleW, sampleH)
    const isDark = (x: number, y: number) => {
      const i = (y * sampleW + x) * 4
      return data[i]! + data[i + 1]! + data[i + 2]! < 3 * 22
    }
    const darkRow = (y: number) => {
      let dark = 0
      for (let x = 0; x < sampleW; x++) if (isDark(x, y)) dark++
      return dark / sampleW > 0.97
    }
    const darkCol = (x: number) => {
      let dark = 0
      for (let y = 0; y < sampleH; y++) if (isDark(x, y)) dark++
      return dark / sampleH > 0.97
    }
    let top = 0
    while (top < sampleH / 2 && darkRow(top)) top++
    let bottom = sampleH - 1
    while (bottom > sampleH / 2 && darkRow(bottom)) bottom--
    let left = 0
    while (left < sampleW / 2 && darkCol(left)) left++
    let right = sampleW - 1
    while (right > sampleW / 2 && darkCol(right)) right--

    const trimV = top + (sampleH - 1 - bottom)
    const trimH = left + (sampleW - 1 - right)
    // 가장자리 몇 줄 어두운 정도는 원래 사진일 수 있으므로 띠가 뚜렷할 때만 자름
    if (trimV < sampleH * 0.06 && trimH < sampleW * 0.06) return full
    const sx = (left / sampleW) * iw
    const sy = (top / sampleH) * ih
    return {
      sx,
      sy,
      sw: ((right + 1) / sampleW) * iw - sx,
      sh: ((bottom + 1) / sampleH) * ih - sy,
    }
  } catch {
    // 캔버스가 CORS로 오염되면 픽셀을 못 읽음
    return full
  }
}

function drawCoverZoom(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  src: SourceRect,
  canvasW: number,
  canvasH: number,
  scale: number,
  /** -1(왼쪽 끝) ~ 1(오른쪽 끝): 확대로 생긴 여유 폭 안에서 가로 이동 */
  panX: number = 0
) {
  const { sx, sy, sw, sh } = src
  if (!sw || !sh) return

  const canvasAspect = canvasW / canvasH
  const imgAspect = sw / sh
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
  const x = (canvasW - w) / 2 + (panX * (w - canvasW)) / 2
  const y = (canvasH - h) / 2

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, canvasW, canvasH)
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

/**
 * 방금 그린 장이 화면에 반영된 뒤에 반환합니다.
 * rAF 콜백은 페인트보다 먼저 실행되므로, 한 번만 기다리면 다음 그리기가
 * 같은 페인트에 합쳐져 줌 단계가 통째로 빠집니다. 두 번 기다려야 이전 장이 남습니다.
 * 그 다음 목표 시각까지 더 기다려 30fps 간격을 맞춥니다.
 */
function waitUntilNextPaint(targetMs: number): Promise<void> {
  const nextFrame = () =>
    new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === "function" && !document.hidden) {
        requestAnimationFrame(() => resolve())
      } else {
        setTimeout(resolve, 16)
      }
    })

  return nextFrame().then(() => nextFrame()).then(async () => {
    while (performance.now() < targetMs) {
      await nextFrame()
    }
  })
}

export type ImageZoomClipMotion = "zoom-in" | "zoom-out" | "pan-left" | "pan-right"

function motionFrame(
  motion: ImageZoomClipMotion,
  progress: number,
  maxScale: number
): { scale: number; panX: number } {
  const zoom = mvpHoldEndZoomScale(progress, maxScale)
  switch (motion) {
    case "zoom-out":
      return { scale: maxScale + 1 - zoom, panX: 0 }
    case "pan-left":
    case "pan-right": {
      // 줌 진행도(0~1)를 가로 이동 진행도로 재사용해 같은 이징을 씀
      const eased = (zoom - 1) / Math.max(0.0001, maxScale - 1)
      const dir = motion === "pan-left" ? -1 : 1
      return { scale: maxScale, panX: dir * (eased * 2 - 1) }
    }
    default:
      return { scale: zoom, panX: 0 }
  }
}

export type ImageZoomClipOptions = {
  imageUrl: string
  /** 초 단위 (TTS 장면 길이에 맞춤) */
  durationSec: number
  width?: number
  height?: number
  fps?: number
  /** 최종 확대 배율 (기본 1.06, 실제 카메라처럼 작은 이동) */
  maxScale?: number
  /** 카메라 움직임 (기본 zoom-in) — 씬마다 바꾸면 정지 이미지가 덜 지루함 */
  motion?: ImageZoomClipMotion
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
  const maxScale = opts.maxScale ?? 1.06

  const motion = opts.motion ?? "zoom-in"

  const img = await loadImageElement(opts.imageUrl)
  const src = detectContentRect(img)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("캔버스를 사용할 수 없습니다.")

  const mimeType = pickRecorderMime()
  // fps를 넘기면 브라우저가 캔버스를 자기 시계로 샘플링해서, 우리가 그린 장과 어긋납니다.
  // 0으로 두고 그린 직후에만 한 장씩 넣습니다.
  const stream = canvas.captureStream(0)
  const [videoTrack] = stream.getVideoTracks()
  const requestFrame =
    videoTrack && "requestFrame" in videoTrack
      ? (videoTrack as CanvasCaptureMediaStreamTrack).requestFrame.bind(videoTrack)
      : null
  if (!requestFrame) {
    throw new Error("이 브라우저는 프레임 단위 캔버스 녹화를 지원하지 않습니다. Chrome에서 다시 시도해 주세요.")
  }
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
    : new MediaRecorder(stream, { videoBitsPerSecond: 8_000_000 })

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data)
  }

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("줌인 클립 녹화에 실패했습니다."))
    recorder.onstop = () => {
      for (const track of stream.getTracks()) track.stop()
      const type = recorder.mimeType || mimeType || "video/webm"
      resolve(new Blob(chunks, { type }))
    }
  })

  recorder.start()

  const totalFrames = Math.max(2, Math.round(durationSec * fps))
  const frameDelayMs = 1000 / fps
  const origin = performance.now()

  for (let frame = 0; frame < totalFrames; frame++) {
    const progress = frame / (totalFrames - 1)
    const { scale, panX } = motionFrame(motion, progress, maxScale)
    drawCoverZoom(ctx, img, src, width, height, scale, panX)
    requestFrame()
    await waitUntilNextPaint(origin + (frame + 1) * frameDelayMs)
  }

  // 마지막 장이 스트림에 들어간 뒤에 녹화를 닫습니다.
  await waitUntilNextPaint(performance.now() + frameDelayMs)
  if (recorder.state !== "inactive") recorder.stop()

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

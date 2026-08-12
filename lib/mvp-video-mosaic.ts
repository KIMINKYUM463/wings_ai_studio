/** 짜집기 미리보기(9:16 contain) 위에 영상 픽셀 모자이크 패치를 그림 */

import {
  defaultMvpVideoSourceTransform,
  drawVideoContainWithSourceTransform,
  isDefaultMvpVideoSourceTransform,
  type MvpVideoSourceTransform,
} from "@/lib/mvp-video-source-transform"

export type VideoContainRect = {
  drawX: number
  drawY: number
  drawW: number
  drawH: number
}

export function videoContainRect(
  stageW: number,
  stageH: number,
  videoW: number,
  videoH: number
): VideoContainRect {
  if (!videoW || !videoH) {
    return { drawX: 0, drawY: 0, drawW: stageW, drawH: stageH }
  }
  const va = videoW / videoH
  const sa = stageW / stageH
  let drawW = stageW
  let drawH = stageH
  let drawX = 0
  let drawY = 0
  if (va > sa) {
    drawH = stageW / va
    drawY = (stageH - drawH) / 2
  } else {
    drawW = stageH * va
    drawX = (stageW - drawW) / 2
  }
  return { drawX, drawY, drawW, drawH }
}

export function videoObjectFitRect(
  stageW: number,
  stageH: number,
  videoW: number,
  videoH: number,
  fit: "cover" | "contain" = "contain"
): VideoContainRect {
  if (fit === "contain") return videoContainRect(stageW, stageH, videoW, videoH)
  if (!videoW || !videoH) {
    return { drawX: 0, drawY: 0, drawW: stageW, drawH: stageH }
  }
  const scale = Math.max(stageW / videoW, stageH / videoH)
  const drawW = videoW * scale
  const drawH = videoH * scale
  return {
    drawX: (stageW - drawW) / 2,
    drawY: (stageH - drawH) / 2,
    drawW,
    drawH,
  }
}

export type VideoMosaicPatchOptions = {
  stageW: number
  stageH: number
  /** 패치 중심 — 스테이지 기준 % (0–100) */
  centerXPct: number
  centerYPct: number
  patchW: number
  patchH: number
  blockPx: number
  circle?: boolean
  fit?: "cover" | "contain"
  /** 가장자리를 배경과 블렌딩 (px) */
  featherPx?: number
  /** 미리보기와 동일한 컷 확대·반전 */
  sourceTransform?: MvpVideoSourceTransform
}

function applySoftEdgeMask(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  featherPx: number,
  circle?: boolean
): void {
  if (featherPx <= 0) return
  const mask = document.createElement("canvas")
  mask.width = w
  mask.height = h
  const m = mask.getContext("2d")
  if (!m) return

  m.clearRect(0, 0, w, h)
  m.fillStyle = "#fff"
  if (circle) {
    m.beginPath()
    m.arc(w / 2, h / 2, Math.max(1, Math.min(w, h) / 2 - featherPx), 0, Math.PI * 2)
    m.fill()
  } else {
    const inset = Math.min(featherPx, w / 4, h / 4)
    if (typeof m.roundRect === "function") {
      m.roundRect(inset, inset, w - inset * 2, h - inset * 2, Math.min(6, inset))
    } else {
      m.fillRect(inset, inset, w - inset * 2, h - inset * 2)
    }
    m.fill()
  }

  const blurred = document.createElement("canvas")
  blurred.width = w
  blurred.height = h
  const b = blurred.getContext("2d")
  if (!b) return
  b.filter = `blur(${Math.max(1, featherPx)}px)`
  b.drawImage(mask, 0, 0)

  ctx.save()
  ctx.globalCompositeOperation = "destination-in"
  ctx.drawImage(blurred, 0, 0)
  ctx.restore()
}

/** 소스 사각형을 이미지 크기 안으로 클램프 (영역 밖 → 투명/흰색 구멍 방지) */
function clampSourceRect(
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  srcW: number,
  srcH: number
): { sx: number; sy: number; sw: number; sh: number } | null {
  if (srcW <= 0 || srcH <= 0 || sw <= 0 || sh <= 0) return null
  let x0 = sx
  let y0 = sy
  let x1 = sx + sw
  let y1 = sy + sh
  x0 = Math.max(0, Math.min(srcW, x0))
  y0 = Math.max(0, Math.min(srcH, y0))
  x1 = Math.max(0, Math.min(srcW, x1))
  y1 = Math.max(0, Math.min(srcH, y1))
  const nw = x1 - x0
  const nh = y1 - y0
  if (nw < 1 || nh < 1) return null
  return { sx: x0, sy: y0, sw: nw, sh: nh }
}

/**
 * 블록 평균 모자이크 — 단순 축소 확대보다 글자(흰 획)가 덜 찢어짐.
 * 투명 픽셀은 건너뛰어 구멍(흰색 깨짐)을 막습니다.
 */
function drawMosaicFromSourceRect(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  patchW: number,
  patchH: number,
  blockPx: number,
  circle?: boolean,
  featherPx = 0,
  srcW?: number,
  srcH?: number
): void {
  const patchWInt = Math.max(8, Math.round(patchW))
  const patchHInt = Math.max(8, Math.round(patchH))
  const block = Math.max(4, Math.min(28, Math.round(blockPx)))

  const srcBoundW =
    srcW ??
    (typeof (source as HTMLVideoElement).videoWidth === "number"
      ? (source as HTMLVideoElement).videoWidth
      : (source as HTMLCanvasElement).width)
  const srcBoundH =
    srcH ??
    (typeof (source as HTMLVideoElement).videoHeight === "number"
      ? (source as HTMLVideoElement).videoHeight
      : (source as HTMLCanvasElement).height)

  const clamped = clampSourceRect(sx, sy, sw, sh, srcBoundW || 0, srcBoundH || 0)
  if (!clamped) {
    ctx.clearRect(0, 0, patchWInt, patchHInt)
    return
  }

  // 1) 패치 영역을 원본 해상도로 확보
  const raw = document.createElement("canvas")
  raw.width = patchWInt
  raw.height = patchHInt
  const rctx = raw.getContext("2d", { willReadFrequently: true })
  if (!rctx) return
  rctx.imageSmoothingEnabled = true
  rctx.imageSmoothingQuality = "high"
  rctx.drawImage(
    source,
    clamped.sx,
    clamped.sy,
    clamped.sw,
    clamped.sh,
    0,
    0,
    patchWInt,
    patchHInt
  )

  // 2) 블록 평균 색으로 칠하기
  const img = rctx.getImageData(0, 0, patchWInt, patchHInt)
  const data = img.data
  const out = document.createElement("canvas")
  out.width = patchWInt
  out.height = patchHInt
  const octx = out.getContext("2d")
  if (!octx) return

  if (circle) {
    octx.beginPath()
    octx.arc(patchWInt / 2, patchHInt / 2, Math.min(patchWInt, patchHInt) / 2, 0, Math.PI * 2)
    octx.clip()
  }

  for (let y = 0; y < patchHInt; y += block) {
    for (let x = 0; x < patchWInt; x += block) {
      const bw = Math.min(block, patchWInt - x)
      const bh = Math.min(block, patchHInt - y)
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let py = 0; py < bh; py++) {
        for (let px = 0; px < bw; px++) {
          const i = ((y + py) * patchWInt + (x + px)) * 4
          const a = data[i + 3]!
          if (a < 8) continue
          r += data[i]!
          g += data[i + 1]!
          b += data[i + 2]!
          n++
        }
      }
      if (n === 0) continue
      octx.fillStyle = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`
      octx.fillRect(x, y, bw, bh)
    }
  }

  ctx.clearRect(0, 0, patchWInt, patchHInt)
  ctx.drawImage(out, 0, 0)

  if (featherPx > 0) applySoftEdgeMask(ctx, patchWInt, patchHInt, featherPx, circle)
}

/** 미리보기와 동일하게 그린 스테이지 프레임 (contain + 컷 transform) */
function buildStageFrameCanvas(
  video: HTMLVideoElement,
  stageW: number,
  stageH: number,
  fit: "cover" | "contain",
  sourceTransform?: MvpVideoSourceTransform
): HTMLCanvasElement | null {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return null

  const stage = document.createElement("canvas")
  stage.width = Math.max(1, Math.round(stageW))
  stage.height = Math.max(1, Math.round(stageH))
  const ctx = stage.getContext("2d")
  if (!ctx) return null

  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, stage.width, stage.height)

  const transform = sourceTransform ?? defaultMvpVideoSourceTransform()
  if (fit === "contain" && !isDefaultMvpVideoSourceTransform(transform)) {
    drawVideoContainWithSourceTransform(ctx, video, stage.width, stage.height, transform)
    return stage
  }

  if (fit === "contain" && isDefaultMvpVideoSourceTransform(transform)) {
    // 기본 contain — transform 없이 (미리보기 CSS 기본과 동일)
    drawVideoContainWithSourceTransform(ctx, video, stage.width, stage.height, transform)
    return stage
  }

  const { drawX, drawY, drawW, drawH } = videoObjectFitRect(
    stage.width,
    stage.height,
    vw,
    vh,
    fit
  )
  ctx.drawImage(video, drawX, drawY, drawW, drawH)
  return stage
}

/** HTMLVideoElement 프레임에서 모자이크 패치 캔버스 생성 */
export function renderVideoMosaicPatchToCanvas(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  opts: VideoMosaicPatchOptions
): void {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh || video.readyState < 2) return

  const {
    stageW,
    stageH,
    centerXPct,
    centerYPct,
    patchW,
    patchH,
    blockPx,
    circle,
    featherPx,
    fit = "contain",
    sourceTransform,
  } = opts
  const patchWInt = Math.max(8, Math.round(patchW))
  const patchHInt = Math.max(8, Math.round(patchH))
  canvas.width = patchWInt
  canvas.height = patchHInt

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const stageFrame = buildStageFrameCanvas(video, stageW, stageH, fit, sourceTransform)
  if (!stageFrame) return

  const patchCx = (centerXPct / 100) * stageFrame.width
  const patchCy = (centerYPct / 100) * stageFrame.height
  const patchX = patchCx - patchWInt / 2
  const patchY = patchCy - patchHInt / 2

  const feather = featherPx ?? Math.max(2, Math.min(6, Math.round(patchWInt / 48)))

  drawMosaicFromSourceRect(
    ctx,
    stageFrame,
    patchX,
    patchY,
    patchWInt,
    patchHInt,
    patchWInt,
    patchHInt,
    blockPx,
    circle,
    feather,
    stageFrame.width,
    stageFrame.height
  )
}

/** Canvas export 경로 — 이미 그려진 영상 프레임 위에 모자이크 */
export function drawVideoMosaicOnCanvas(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvasW: number,
  canvasH: number,
  opts: {
    previewW: number
    centerXPct: number
    centerYPct: number
    patchW: number
    patchH: number
    blockPx: number
    circle?: boolean
    rotation?: number
    sourceTransform?: MvpVideoSourceTransform
  }
): void {
  const scale = canvasW / opts.previewW
  const stageW = canvasW
  const stageH = canvasH
  const patchW = opts.patchW * scale
  const patchH = opts.patchH * scale

  const patchCanvas = document.createElement("canvas")
  renderVideoMosaicPatchToCanvas(patchCanvas, video, {
    stageW,
    stageH,
    centerXPct: opts.centerXPct,
    centerYPct: opts.centerYPct,
    patchW,
    patchH,
    blockPx: Math.max(4, Math.round(opts.blockPx * scale)),
    circle: opts.circle,
    featherPx: Math.max(2, Math.round(4 * scale)),
    sourceTransform: opts.sourceTransform,
  })

  const cx = (opts.centerXPct / 100) * canvasW
  const cy = (opts.centerYPct / 100) * canvasH

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(((opts.rotation ?? 0) * Math.PI) / 180)
  ctx.drawImage(patchCanvas, -patchCanvas.width / 2, -patchCanvas.height / 2)
  ctx.restore()
}

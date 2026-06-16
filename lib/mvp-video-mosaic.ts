/** 짜집기 미리보기(9:16 contain) 위에 영상 픽셀 모자이크 패치를 그림 */

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
}

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
  circle?: boolean
): void {
  const patchWInt = Math.max(8, Math.round(patchW))
  const patchHInt = Math.max(8, Math.round(patchH))
  const block = Math.max(4, Math.min(24, blockPx))
  const smallW = Math.max(1, Math.floor(patchWInt / block))
  const smallH = Math.max(1, Math.floor(patchHInt / block))

  const tmp = document.createElement("canvas")
  tmp.width = smallW
  tmp.height = smallH
  const tctx = tmp.getContext("2d")
  if (!tctx) return

  tctx.drawImage(source, sx, sy, sw, sh, 0, 0, smallW, smallH)

  ctx.clearRect(0, 0, patchWInt, patchHInt)
  if (circle) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(patchWInt / 2, patchHInt / 2, Math.min(patchWInt, patchHInt) / 2, 0, Math.PI * 2)
    ctx.clip()
  }
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, 0, 0, smallW, smallH, 0, 0, patchWInt, patchHInt)
  if (circle) ctx.restore()
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

  const { stageW, stageH, centerXPct, centerYPct, patchW, patchH, blockPx, circle } = opts
  const patchWInt = Math.max(8, Math.round(patchW))
  const patchHInt = Math.max(8, Math.round(patchH))
  canvas.width = patchWInt
  canvas.height = patchHInt

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const { drawX, drawY, drawW, drawH } = videoContainRect(stageW, stageH, vw, vh)
  const patchCx = (centerXPct / 100) * stageW
  const patchCy = (centerYPct / 100) * stageH
  const patchX = patchCx - patchWInt / 2
  const patchY = patchCy - patchHInt / 2

  const sx = ((patchX - drawX) / drawW) * vw
  const sy = ((patchY - drawY) / drawH) * vh
  const sw = (patchWInt / drawW) * vw
  const sh = (patchHInt / drawH) * vh

  drawMosaicFromSourceRect(ctx, video, sx, sy, sw, sh, patchWInt, patchHInt, blockPx, circle)
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
    blockPx: opts.blockPx,
    circle: opts.circle,
  })

  const cx = (opts.centerXPct / 100) * canvasW
  const cy = (opts.centerYPct / 100) * canvasH

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(((opts.rotation ?? 0) * Math.PI) / 180)
  ctx.drawImage(patchCanvas, -patchCanvas.width / 2, -patchCanvas.height / 2)
  ctx.restore()
}

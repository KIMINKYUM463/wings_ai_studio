import type { CanvasTextAlign } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'

export type LayerBounds = { x: number; y: number; width: number; height: number }

export type CornerHandleId = 'nw' | 'ne' | 'sw' | 'se'
export type EdgeHandleId = 'n' | 's' | 'e' | 'w'
export type ResizeHandleId = CornerHandleId | EdgeHandleId

export const CORNER_RESIZE_HANDLES: readonly CornerHandleId[] = ['nw', 'ne', 'sw', 'se']
export const EDGE_RESIZE_HANDLES: readonly EdgeHandleId[] = ['n', 's', 'e', 'w']
export const ALL_RESIZE_HANDLES: readonly ResizeHandleId[] = [
  ...CORNER_RESIZE_HANDLES,
  ...EDGE_RESIZE_HANDLES,
]

export function isCornerResizeHandle(handle: ResizeHandleId): handle is CornerHandleId {
  return handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se'
}

const HANDLE_SIZE = 14
const EDGE_HANDLE_ALONG = 22

export function computeCoverLayout(
  imgW: number,
  imgH: number,
  canvasW = STUDIO_CANVAS_W,
  canvasH = STUDIO_CANVAS_H,
): LayerBounds {
  if (!imgW || !imgH) {
    return { x: 0, y: 0, width: canvasW, height: canvasH }
  }
  const scale = Math.max(canvasW / imgW, canvasH / imgH)
  const width = imgW * scale
  const height = imgH * scale
  return {
    x: (canvasW - width) / 2,
    y: (canvasH - height) / 2,
    width,
    height,
  }
}

/** data URL·URL 이미지 크기 측정 — 배경 cover 기본값용 */
export function measureImageSourceSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const width = img.naturalWidth || img.width
      const height = img.naturalHeight || img.height
      if (!width || !height) {
        reject(new Error('이미지 크기를 읽을 수 없습니다.'))
        return
      }
      resolve({ width, height })
    }
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'))
    img.src = src
  })
}

export function coverLayoutForImageSource(
  src: string,
  canvasW = STUDIO_CANVAS_W,
  canvasH = STUDIO_CANVAS_H,
): Promise<LayerBounds> {
  return measureImageSourceSize(src).then(({ width, height }) =>
    computeCoverLayout(width, height, canvasW, canvasH),
  )
}

/** 캔버스 면적 대비 layout이 차지하는 비율(0~1) */
export function layoutVisibleCanvasFraction(
  layout: LayerBounds,
  canvasW = STUDIO_CANVAS_W,
  canvasH = STUDIO_CANVAS_H,
): number {
  const visibleW = Math.max(0, Math.min(layout.x + layout.width, canvasW) - Math.max(0, layout.x))
  const visibleH = Math.max(0, Math.min(layout.y + layout.height, canvasH) - Math.max(0, layout.y))
  return (visibleW * visibleH) / (canvasW * canvasH)
}

/** 배경이 캔버스(흰 테두리 안)를 덮지 못하는 contain·레거시 layout 인지 */
export function shouldAutoCoverBackgroundLayout(
  layout: LayerBounds | null | undefined,
  customized?: boolean,
): boolean {
  if (customized) return false
  if (!layout?.width || !layout?.height) return true
  return layoutVisibleCanvasFraction(layout) < 0.985
}

export function ensureBackgroundCoverLayout(
  layout: LayerBounds | null | undefined,
  imgW: number,
  imgH: number,
  customized?: boolean,
): LayerBounds {
  if (!shouldAutoCoverBackgroundLayout(layout, customized)) {
    return layout as LayerBounds
  }
  return computeCoverLayout(imgW, imgH)
}

/** 저장 layout 없으면 cover — 그리기·선택·히트테스트 공통 */
export function resolveStudioBackgroundLayout(
  layout: LayerBounds | null | undefined,
  bgImg: { complete?: boolean; naturalWidth?: number; width?: number; naturalHeight?: number; height?: number } | null,
  options?: { layoutCustomized?: boolean },
): LayerBounds | null {
  const imgW = bgImg?.naturalWidth || bgImg?.width || 0
  const imgH = bgImg?.naturalHeight || bgImg?.height || 0
  if (bgImg?.complete && imgW && imgH) {
    return ensureBackgroundCoverLayout(layout, imgW, imgH, options?.layoutCustomized)
  }
  if (layout?.width && layout?.height) return layout
  return null
}

function midPoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function orientedHandlesFromCorners(corners: Record<CornerHandleId, { x: number; y: number }>): Record<
  ResizeHandleId,
  { x: number; y: number }
> {
  return {
    ...corners,
    n: midPoint(corners.nw, corners.ne),
    s: midPoint(corners.sw, corners.se),
    e: midPoint(corners.ne, corners.se),
    w: midPoint(corners.nw, corners.sw),
  }
}

export function getResizeHandlePositions(bounds: LayerBounds): Record<ResizeHandleId, { x: number; y: number }> {
  const { x, y, width, height } = bounds
  return orientedHandlesFromCorners({
    nw: { x, y },
    ne: { x: x + width, y },
    sw: { x, y: y + height },
    se: { x: x + width, y: y + height },
  })
}

function hitTestCornerHandle(
  positions: Record<ResizeHandleId, { x: number; y: number }>,
  px: number,
  py: number,
): CornerHandleId | null {
  const half = HANDLE_SIZE
  for (const id of CORNER_RESIZE_HANDLES) {
    const p = positions[id]
    if (Math.abs(px - p.x) <= half && Math.abs(py - p.y) <= half) return id
  }
  return null
}

function hitTestEdgeHandle(
  positions: Record<ResizeHandleId, { x: number; y: number }>,
  px: number,
  py: number,
): EdgeHandleId | null {
  const half = HANDLE_SIZE
  const along = EDGE_HANDLE_ALONG
  for (const id of EDGE_RESIZE_HANDLES) {
    const p = positions[id]
    if (id === 'n' || id === 's') {
      if (Math.abs(px - p.x) <= along && Math.abs(py - p.y) <= half) return id
    } else if (Math.abs(px - p.x) <= half && Math.abs(py - p.y) <= along) {
      return id
    }
  }
  return null
}

export function hitTestResizeHandle(
  bounds: LayerBounds,
  px: number,
  py: number,
): ResizeHandleId | null {
  const positions = getResizeHandlePositions(bounds)
  return hitTestCornerHandle(positions, px, py) ?? hitTestEdgeHandle(positions, px, py)
}

export function hitTestHandlePositions(
  positions: Record<ResizeHandleId, { x: number; y: number }>,
  px: number,
  py: number,
): ResizeHandleId | null {
  return hitTestCornerHandle(positions, px, py) ?? hitTestEdgeHandle(positions, px, py)
}

export function hitTestBounds(bounds: LayerBounds, px: number, py: number): boolean {
  return (
    px >= bounds.x &&
    px <= bounds.x + bounds.width &&
    py >= bounds.y &&
    py <= bounds.y + bounds.height
  )
}

/** 드래그로 리사이즈 — 코너·변 모두 (최소 크기 유지) */
export function resizeBoundsWithHandle(
  _bounds: LayerBounds,
  handle: ResizeHandleId,
  pointerX: number,
  pointerY: number,
  anchor: LayerBounds,
  min = 48,
): LayerBounds {
  let { x, y, width, height } = anchor

  if (handle === 'se') {
    width = Math.max(min, pointerX - x)
    height = Math.max(min, pointerY - y)
  } else if (handle === 'sw') {
    const right = x + width
    x = Math.min(pointerX, right - min)
    width = right - x
    height = Math.max(min, pointerY - y)
  } else if (handle === 'ne') {
    const bottom = y + height
    width = Math.max(min, pointerX - x)
    y = Math.min(pointerY, bottom - min)
    height = bottom - y
  } else if (handle === 'nw') {
    const right = x + width
    const bottom = y + height
    x = Math.min(pointerX, right - min)
    y = Math.min(pointerY, bottom - min)
    width = right - x
    height = bottom - y
  } else if (handle === 'e') {
    width = Math.max(min, pointerX - x)
  } else if (handle === 'w') {
    const right = x + width
    x = Math.min(pointerX, right - min)
    width = right - x
  } else if (handle === 's') {
    height = Math.max(min, pointerY - y)
  } else if (handle === 'n') {
    const bottom = y + height
    y = Math.min(pointerY, bottom - min)
    height = bottom - y
  }

  return { x, y, width, height }
}

/** 코너 드래그 — 가로세로 비율 유지 (이미지·배경용) */
export function resizeBoundsProportional(
  anchor: LayerBounds,
  handle: ResizeHandleId,
  pointerX: number,
  pointerY: number,
  min = 48,
): LayerBounds {
  const { x: ax, y: ay, width: aw, height: ah } = anchor
  if (!aw || !ah) return anchor

  let scale = 1
  if (handle === 'se') {
    scale = Math.max((pointerX - ax) / aw, (pointerY - ay) / ah)
  } else if (handle === 'nw') {
    scale = Math.max((ax + aw - pointerX) / aw, (ay + ah - pointerY) / ah)
  } else if (handle === 'ne') {
    scale = Math.max((pointerX - ax) / aw, (ay + ah - pointerY) / ah)
  } else {
    scale = Math.max((ax + aw - pointerX) / aw, (pointerY - ay) / ah)
  }

  scale = Math.max(scale, min / aw, min / ah)

  const width = aw * scale
  const height = ah * scale

  if (handle === 'se') {
    return { x: ax, y: ay, width, height }
  }
  if (handle === 'nw') {
    return { x: ax + aw - width, y: ay + ah - height, width, height }
  }
  if (handle === 'ne') {
    return { x: ax, y: ay + ah - height, width, height }
  }
  return { x: ax + aw - width, y: ay, width, height }
}

/** 너비·높이 입력 시 비율 유지 */
export function patchBoundsSizeProportional(
  bounds: LayerBounds,
  patch: { width?: number; height?: number },
  min = 48,
): Partial<LayerBounds> {
  const ratio = bounds.width / bounds.height || 1
  if (patch.width != null) {
    const width = Math.max(min, patch.width)
    const height = Math.max(min, Math.round(width / ratio))
    return { width, height }
  }
  if (patch.height != null) {
    const height = Math.max(min, patch.height)
    const width = Math.max(min, Math.round(height * ratio))
    return { width, height }
  }
  return patch
}

const TEXT_BOUNDS_PAD = 6

/** 선택 박스 → 텍스트 앵커 (x, y) */
export function boundsToTextAnchor(
  bounds: LayerBounds,
  textAlign: CanvasTextAlign,
): { x: number; y: number } {
  const y = bounds.y + bounds.height / 2
  if (textAlign === 'left') return { x: bounds.x + TEXT_BOUNDS_PAD, y }
  if (textAlign === 'right') return { x: bounds.x + bounds.width - TEXT_BOUNDS_PAD, y }
  return { x: bounds.x + bounds.width / 2, y }
}

export type TextResizeAnchor = {
  bounds: LayerBounds
  fontSize: number
  textAlign: CanvasTextAlign
}

/** 텍스트 레이어 드래그 — fontSize·위치 갱신 (코너·변) */
export function resizeTextLayerWithHandle(
  anchor: TextResizeAnchor,
  handle: ResizeHandleId,
  pointerX: number,
  pointerY: number,
): { fontSize: number; x: number; y: number } {
  const minBox = 28
  const anchorBounds = anchor.bounds
  const newBounds = resizeBoundsWithHandle(anchorBounds, handle, pointerX, pointerY, anchorBounds, minBox)
  let scale: number
  if (handle === 'e' || handle === 'w') {
    scale = Math.max(0.15, newBounds.width / anchorBounds.width)
  } else if (handle === 'n' || handle === 's') {
    scale = Math.max(0.15, newBounds.height / anchorBounds.height)
  } else {
    scale = Math.max(0.15, newBounds.height / anchorBounds.height)
  }
  const fontSize = Math.min(200, Math.max(14, Math.round(anchor.fontSize * scale)))
  return { ...boundsToTextAnchor(newBounds, anchor.textAlign), fontSize }
}

export function drawResizeHandles(ctx: CanvasRenderingContext2D, bounds: LayerBounds): void {
  drawResizeHandlesAtPositions(ctx, getResizeHandlePositions(bounds))
}

/** @deprecated drawResizeHandlesAtPositions 사용 */
export function drawResizeHandlesAtCorners(
  ctx: CanvasRenderingContext2D,
  positions: Record<ResizeHandleId, { x: number; y: number }>,
): void {
  drawResizeHandlesAtPositions(ctx, positions)
}

export function drawResizeHandlesAtPositions(
  ctx: CanvasRenderingContext2D,
  positions: Record<ResizeHandleId, { x: number; y: number }>,
): void {
  ctx.save()
  ctx.fillStyle = '#fafaf9'
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)'
  ctx.lineWidth = 2
  for (const id of CORNER_RESIZE_HANDLES) {
    const p = positions[id]
    ctx.beginPath()
    ctx.rect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
    ctx.fill()
    ctx.stroke()
  }
  for (const id of EDGE_RESIZE_HANDLES) {
    const p = positions[id]
    const w = id === 'n' || id === 's' ? EDGE_HANDLE_ALONG : HANDLE_SIZE
    const h = id === 'e' || id === 'w' ? EDGE_HANDLE_ALONG : HANDLE_SIZE
    ctx.beginPath()
    ctx.rect(p.x - w / 2, p.y - h / 2, w, h)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

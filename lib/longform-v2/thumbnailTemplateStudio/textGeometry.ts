import type { CanvasTextAlign, TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import { canvasFontString } from '@/lib/longform-v2/thumbnail-bridge/bundledFonts'
import type { LayerBounds, CornerHandleId, ResizeHandleId } from './studioTransform'
import { hitTestHandlePositions, orientedHandlesFromCorners } from './studioTransform'
import {
  measureStudioTextBlock,
  resolveTextTypography,
  textHasVisibleContent,
  normalizeTextContent,
} from './textTypography'

const PAD = 6

/** 선택·인라인 편집 — stroke·text-shadow 가 잘리지 않도록 */
function selectionEdgePad(strokeWidth: number): number {
  const strokePad = Math.ceil(strokeWidth / 2)
  const strokeSlop = strokeWidth > 0 ? Math.ceil(strokeWidth * 0.45) : 0
  return PAD + strokePad + strokeSlop
}

/** textBaseline:middle — 라인 y 기준 글리프 상·하 (로컬 좌표) */
function middleBaselineLineVerticalExtents(
  ctx: CanvasRenderingContext2D,
  lineText: string,
  lineY: number,
  fontSize: number,
): { top: number; bottom: number } {
  const sample = lineText.trim() ? lineText : 'Hg'
  const m = ctx.measureText(sample)
  const ascent = m.actualBoundingBoxAscent ?? fontSize * 0.82
  const descent = m.actualBoundingBoxDescent ?? fontSize * 0.28
  const half = (ascent + descent) / 2
  return { top: lineY - half, bottom: lineY + half }
}

export type TextMetrics = {
  display: string
  width: number
  /** 정렬 앵커 (it.x, it.y) */
  pivotX: number
  pivotY: number
  /** 글자 박스 중앙 — 회전 축 */
  centerX: number
  centerY: number
  /** 앵커 기준 로컬 좌표(회전 전) */
  localLeft: number
  localTop: number
  localRight: number
  localBottom: number
}

/** drawTextItem 과 동일한 로컬 박스 */
export function measureTextMetrics(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
): TextMetrics | null {
  const display = normalizeTextContent(it.text)
  if (!textHasVisibleContent(display)) return null
  const block = measureStudioTextBlock(ctx, it)
  if (!block) return null

  const padX = it.boxBackground ? (it.boxPaddingX ?? 16) : 0
  const padY = it.boxBackground ? (it.boxPaddingY ?? 10) : 0
  const fixedW = it.boxBackground && it.boxWidthPx && it.boxWidthPx > 0 ? it.boxWidthPx : 0
  const bw = fixedW > 0 ? fixedW : block.blockWidth + padX * 2
  const bh = block.blockHeight + (it.boxBackground ? padY * 2 : 0)
  const edgePad = selectionEdgePad(it.strokeWidth ?? 0)
  const typo = resolveTextTypography(it)

  ctx.save()
  ctx.font = canvasFontString(it.fontSize, it.fontFamily)
  ctx.letterSpacing = `${typo.letterSpacing}px`
  ctx.restore()

  let tx = 0
  if (it.textAlign === 'center') tx = -block.blockWidth / 2
  else if (it.textAlign === 'right') tx = -block.blockWidth

  let localLeft: number
  let localRight: number
  let localTop: number
  let localBottom: number

  if (it.boxBackground) {
    const boxX = fixedW > 0 ? tx - (bw - block.blockWidth) / 2 : tx - padX
    localLeft = boxX - edgePad
    localRight = boxX + bw + edgePad
    localTop = -bh / 2 - edgePad
    localBottom = bh / 2 + edgePad
  } else {
    ctx.save()
    ctx.font = canvasFontString(it.fontSize, it.fontFamily)
    ctx.letterSpacing = `${typo.letterSpacing}px`
    let top = Infinity
    let bottom = -Infinity
    for (const line of block.lines) {
      const ext = middleBaselineLineVerticalExtents(ctx, line.text, line.y, it.fontSize)
      top = Math.min(top, ext.top)
      bottom = Math.max(bottom, ext.bottom)
    }
    ctx.restore()
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
      top = -it.fontSize / 2
      bottom = it.fontSize / 2
    }
    localLeft = tx - edgePad
    localRight = tx + block.blockWidth + edgePad
    localTop = top - edgePad
    localBottom = bottom + edgePad
  }

  const geomCenterX = it.x + (localLeft + localRight) / 2
  const geomCenterY = it.y + (localTop + localBottom) / 2

  return {
    display,
    width: block.blockWidth,
    pivotX: it.x,
    pivotY: it.y,
    centerX: geomCenterX,
    centerY: geomCenterY,
    localLeft,
    localTop,
    localRight,
    localBottom,
  }
}

/** 정렬만 바꿀 때 선택 테두리(바운딩 박스) 위치는 유지하고 x·y 피벗만 보정 */
export function patchTextAlignPreservingBounds(
  ctx: CanvasRenderingContext2D,
  layer: TextItem,
  newAlign: CanvasTextAlign,
): Partial<TextItem> {
  if (layer.textAlign === newAlign) return { textAlign: newAlign }

  const before = measureTextMetrics(ctx, layer)
  if (!before) return { textAlign: newAlign }

  const anchorX = before.centerX
  const anchorY = before.centerY

  const trial = measureTextMetrics(ctx, { ...layer, textAlign: newAlign, x: 0, y: 0 })
  if (!trial) return { textAlign: newAlign }

  const halfW = (trial.localLeft + trial.localRight) / 2
  const halfH = (trial.localTop + trial.localBottom) / 2

  return {
    textAlign: newAlign,
    x: anchorX - halfW,
    y: anchorY - halfH,
  }
}

function localCornerToCanvas(
  met: TextMetrics,
  lx: number,
  ly: number,
  rotationDeg: number,
): { x: number; y: number } {
  const wx = met.pivotX + lx
  const wy = met.pivotY + ly
  const rad = (rotationDeg * Math.PI) / 180
  if (!rad) return { x: wx, y: wy }
  return rotatePoint(wx, wy, met.centerX, met.centerY, rad)
}

function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  rad: number,
): { x: number; y: number } {
  const dx = px - cx
  const dy = py - cy
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
}

/** 회전 전 로컬 박스 (리사이즈·앵커용) */
export function getTextLocalBounds(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
): LayerBounds | null {
  const met = measureTextMetrics(ctx, it)
  if (!met) return null
  const { pivotX, pivotY, localLeft, localTop, localRight, localBottom } = met
  return {
    x: pivotX + localLeft,
    y: pivotY + localTop,
    width: localRight - localLeft,
    height: localBottom - localTop,
  }
}

/** 회전된 선택 박스 네 모서리 (캔버스 좌표) */
export function getTextOrientedCorners(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
): Record<CornerHandleId, { x: number; y: number }> | null {
  const met = measureTextMetrics(ctx, it)
  if (!met) return null
  const deg = it.rotation ?? 0
  const { localLeft, localTop, localRight, localBottom } = met
  return {
    nw: localCornerToCanvas(met, localLeft, localTop, deg),
    ne: localCornerToCanvas(met, localRight, localTop, deg),
    sw: localCornerToCanvas(met, localLeft, localBottom, deg),
    se: localCornerToCanvas(met, localRight, localBottom, deg),
  }
}

/** 회전된 선택 박스 8방향 핸들 (캔버스 좌표) */
export function getTextOrientedHandlePositions(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
): Record<ResizeHandleId, { x: number; y: number }> | null {
  const corners = getTextOrientedCorners(ctx, it)
  if (!corners) return null
  return orientedHandlesFromCorners(corners)
}

export function pointerToTextLocal(
  px: number,
  py: number,
  cx: number,
  cy: number,
  rotationDeg: number,
): { x: number; y: number } {
  const rad = (-rotationDeg * Math.PI) / 180
  return rotatePoint(px, py, cx, cy, rad)
}

function pointInQuad(
  px: number,
  py: number,
  corners: Record<CornerHandleId, { x: number; y: number }>,
): boolean {
  const pts = [corners.nw, corners.ne, corners.se, corners.sw]
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % 4]
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x)
    if (cross === 0) continue
    const s = cross > 0 ? 1 : -1
    if (sign === 0) sign = s
    else if (sign !== s) return false
  }
  return sign !== 0
}

export function hitTestTextOrientedBody(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
  px: number,
  py: number,
): boolean {
  const corners = getTextOrientedCorners(ctx, it)
  if (!corners) return false
  return pointInQuad(px, py, corners)
}

export function hitTestTextOrientedResizeHandle(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
  px: number,
  py: number,
): ResizeHandleId | null {
  const positions = getTextOrientedHandlePositions(ctx, it)
  if (!positions) return null
  return hitTestHandlePositions(positions, px, py)
}

/** 히트·가이드용 축 정렬 외접 사각형 */
export function measureTextOuterBox(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
): { left: number; top: number; right: number; bottom: number } {
  const corners = getTextOrientedCorners(ctx, it)
  if (!corners) return { left: it.x, right: it.x, top: it.y, bottom: it.y }
  const pts = [corners.nw, corners.ne, corners.se, corners.sw]
  let left = pts[0].x
  let right = pts[0].x
  let top = pts[0].y
  let bottom = pts[0].y
  for (const p of pts) {
    left = Math.min(left, p.x)
    right = Math.max(right, p.x)
    top = Math.min(top, p.y)
    bottom = Math.max(bottom, p.y)
  }
  return { left, top, right, bottom }
}

export function getTextRotateHandlePosition(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
): { x: number; y: number; pivotX: number; pivotY: number } | null {
  const met = measureTextMetrics(ctx, it)
  if (!met) return null
  const midX = (met.localLeft + met.localRight) / 2
  const deg = it.rotation ?? 0
  const top = localCornerToCanvas(met, midX, met.localTop, deg)
  const rad = (deg * Math.PI) / 180 - Math.PI / 2
  const dist = 30
  return {
    pivotX: met.centerX,
    pivotY: met.centerY,
    x: top.x + dist * Math.cos(rad),
    y: top.y + dist * Math.sin(rad),
  }
}

export function hitTestTextRotateHandle(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
  px: number,
  py: number,
  handleSize = 14,
): boolean {
  const h = getTextRotateHandlePosition(ctx, it)
  if (!h) return false
  const half = handleSize
  return Math.abs(px - h.x) <= half && Math.abs(py - h.y) <= half
}

export function rotationFromPointerDrag(
  pivotX: number,
  pivotY: number,
  pointerX: number,
  pointerY: number,
  startPointerX: number,
  startPointerY: number,
  startRotationDeg: number,
): number {
  const a0 = Math.atan2(startPointerY - pivotY, startPointerX - pivotX)
  const a1 = Math.atan2(pointerY - pivotY, pointerX - pivotX)
  const delta = ((a1 - a0) * 180) / Math.PI
  let next = startRotationDeg + delta
  while (next > 180) next -= 360
  while (next < -180) next += 360
  return Math.round(next * 10) / 10
}

/** 캔버스 좌표 → 글자 인덱스 (드래그로 부분 색 선택) */
export function charIndexFromPointer(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
  px: number,
  py: number,
): number | null {
  const met = measureTextMetrics(ctx, it)
  if (!met) return null
  const local = pointerToTextLocal(px, py, met.centerX, met.centerY, it.rotation ?? 0)
  const lx = local.x - met.pivotX

  ctx.save()
  ctx.font = canvasFontString(it.fontSize, it.fontFamily)
  const display = met.display
  const totalW = ctx.measureText(display).width
  let tx = 0
  if (it.textAlign === 'center') tx = -totalW / 2
  else if (it.textAlign === 'right') tx = -totalW

  const relX = lx - tx
  if (relX <= 0) {
    ctx.restore()
    return 0
  }
  if (relX >= totalW) {
    ctx.restore()
    return display.length
  }

  let idx = 0
  for (let i = 1; i <= display.length; i++) {
    const w = ctx.measureText(display.slice(0, i)).width
    if (w >= relX) {
      const prevW = i > 1 ? ctx.measureText(display.slice(0, i - 1)).width : 0
      idx = relX - prevW < w - relX ? i - 1 : i
      break
    }
    idx = i
  }
  ctx.restore()
  return Math.max(0, Math.min(display.length, idx))
}

/** 선택 구간 하이라이트 (캔버스) */
export function drawTextFillRangeHighlight(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
  start: number,
  end: number,
): void {
  const met = measureTextMetrics(ctx, it)
  if (!met) return
  const a = Math.max(0, Math.min(start, end))
  const b = Math.min(met.display.length, Math.max(start, end))
  if (b <= a) return

  const deg = it.rotation ?? 0
  const rad = (deg * Math.PI) / 180
  const { centerX, centerY, pivotX, pivotY } = met

  ctx.save()
  ctx.font = canvasFontString(it.fontSize, it.fontFamily)
  ctx.translate(centerX, centerY)
  if (rad) ctx.rotate(rad)
  ctx.translate(pivotX - centerX, pivotY - centerY)
  ctx.textBaseline = 'middle'

  const display = met.display
  const totalW = ctx.measureText(display).width
  let tx = 0
  if (it.textAlign === 'center') tx = -totalW / 2
  else if (it.textAlign === 'right') tx = -totalW

  const x0 = tx + ctx.measureText(display.slice(0, a)).width
  const x1 = tx + ctx.measureText(display.slice(0, b)).width
  const lineH = it.fontSize * 1.1
  const padY = it.boxBackground ? (it.boxPaddingY ?? 10) : 0
  const h = lineH + (it.boxBackground ? padY : 4)

  ctx.fillStyle = 'rgba(56, 189, 248, 0.38)'
  ctx.fillRect(x0 - 2, -h / 2, Math.max(2, x1 - x0 + 4), h)
  ctx.restore()
}

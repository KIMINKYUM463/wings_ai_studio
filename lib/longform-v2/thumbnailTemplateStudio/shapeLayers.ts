import {
  getLayerRotateHandlePosition,
  hitTestImageLayer,
  hitTestLayerRotateHandle,
  layerOrientedCorners,
  layerPivot,
  pointerToLocal,
} from './layerRotation'
import type { LayerBounds, ResizeHandleId } from './studioTransform'
import { hitTestBounds, hitTestResizeHandle } from './studioTransform'
import type { ElementPresetDef } from './elementPresets'
import { getElementPreset } from './elementPresets'
import type { ThumbnailStudioDocument } from './types'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'

export type StudioShapeKind = 'arrow' | 'line' | 'rect' | 'ellipse' | 'path'

type StudioShapeBase = {
  id: string
  zIndex: number
  color: string
  lineWidth: number
  opacity: number
  visible?: boolean
  /** 요소 프리셋 ID (라벨·재편집용) */
  presetId?: string
  /** 도(°), 중심 기준 반시계 */
  rotation?: number
}

export type StudioArrowShape = StudioShapeBase & {
  kind: 'arrow'
  x1: number
  y1: number
  x2: number
  y2: number
}

export type StudioLineShape = StudioShapeBase & {
  kind: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
}

export type StudioRectShape = StudioShapeBase & {
  kind: 'rect'
  x: number
  y: number
  width: number
  height: number
  fill: string | null
}

export type StudioEllipseShape = StudioShapeBase & {
  kind: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
  fill: string | null
}

export type StudioPathShape = StudioShapeBase & {
  kind: 'path'
  pathD: string
  viewBoxW: number
  viewBoxH: number
  x: number
  y: number
  width: number
  height: number
  fill: string | null
  strokeOnly?: boolean
}

export type StudioShapeLayer =
  | StudioArrowShape
  | StudioLineShape
  | StudioRectShape
  | StudioEllipseShape
  | StudioPathShape

export type ShapeHitPart = 'start' | 'end' | 'move' | 'body'

export type ShapeHitResult = {
  id: string
  part: ShapeHitPart
  resizeHandle?: ResizeHandleId
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `shp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function studioMaxZIndex(doc: ThumbnailStudioDocument): number {
  const zs = [
    ...doc.textLayers.map((t) => t.zIndex),
    ...doc.imageLayers.map((i) => i.zIndex),
    ...(doc.shapeLayers ?? []).map((s) => s.zIndex),
    ...(doc.overlayLayers ?? []).map((o) => o.zIndex),
  ]
  return zs.length ? Math.max(...zs) : 0
}

export function createDefaultShape(kind: StudioShapeKind, zIndex: number): StudioShapeLayer {
  const base = { id: newId(), zIndex, lineWidth: 8, opacity: 1 }
  switch (kind) {
    case 'arrow':
      return {
        ...base,
        kind: 'arrow',
        color: '#ef4444',
        x1: STUDIO_CANVAS_W * 0.72,
        y1: STUDIO_CANVAS_H * 0.28,
        x2: STUDIO_CANVAS_W * 0.42,
        y2: STUDIO_CANVAS_H * 0.48,
        lineWidth: 10,
      }
    case 'line':
      return {
        ...base,
        kind: 'line',
        color: '#fbbf24',
        x1: STUDIO_CANVAS_W * 0.2,
        y1: STUDIO_CANVAS_H * 0.55,
        x2: STUDIO_CANVAS_W * 0.55,
        y2: STUDIO_CANVAS_H * 0.55,
        lineWidth: 6,
      }
    case 'rect':
      return {
        ...base,
        kind: 'rect',
        color: '#ffffff',
        x: STUDIO_CANVAS_W * 0.58,
        y: STUDIO_CANVAS_H * 0.18,
        width: 220,
        height: 120,
        fill: null,
        lineWidth: 5,
      }
    case 'ellipse':
      return {
        ...base,
        kind: 'ellipse',
        color: '#22d3ee',
        cx: STUDIO_CANVAS_W * 0.7,
        cy: STUDIO_CANVAS_H * 0.55,
        rx: 100,
        ry: 70,
        fill: 'rgba(34, 211, 238, 0.25)',
        lineWidth: 5,
      }
    default:
      return {
        ...base,
        kind: 'line',
        color: '#fbbf24',
        x1: STUDIO_CANVAS_W * 0.2,
        y1: STUDIO_CANVAS_H * 0.5,
        x2: STUDIO_CANVAS_W * 0.8,
        y2: STUDIO_CANVAS_H * 0.5,
        lineWidth: 6,
      }
  }
}

export function createShapeFromPreset(preset: ElementPresetDef, zIndex: number): StudioPathShape {
  const w = Math.round(STUDIO_CANVAS_W * preset.defaultWidthRatio)
  const h = Math.round(STUDIO_CANVAS_H * preset.defaultHeightRatio)
  return {
    id: newId(),
    presetId: preset.id,
    zIndex,
    kind: 'path',
    pathD: preset.pathD,
    viewBoxW: preset.viewBoxW,
    viewBoxH: preset.viewBoxH,
    x: Math.round(STUDIO_CANVAS_W * 0.5 - w / 2),
    y: Math.round(STUDIO_CANVAS_H * 0.5 - h / 2),
    width: Math.max(24, w),
    height: Math.max(24, h),
    color: preset.defaultColor,
    fill: preset.defaultFill ?? null,
    lineWidth: preset.defaultLineWidth,
    opacity: 1,
    strokeOnly: preset.strokeOnly,
    rotation: preset.defaultRotation ?? 0,
  }
}

export function createShapeFromPresetId(presetId: string, zIndex: number): StudioPathShape {
  const preset = getElementPreset(presetId)
  if (!preset) throw new Error('요소 프리셋을 찾을 수 없습니다.')
  return createShapeFromPreset(preset, zIndex)
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

function distPointToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const lx = x2 - x1
  const ly = y2 - y1
  const lenSq = lx * lx + ly * ly
  if (lenSq < 1e-6) return Math.sqrt(distSq(px, py, x1, y1))
  let t = ((px - x1) * lx + (py - y1) * ly) / lenSq
  t = Math.max(0, Math.min(1, t))
  const nx = x1 + t * lx
  const ny = y1 + t * ly
  return Math.sqrt(distSq(px, py, nx, ny))
}

const ARROW_HEAD_SPREAD = 0.85

function arrowHeadLength(lineW: number, shaftLen: number): number {
  const ideal = 18 + lineW * 2
  return Math.min(ideal, Math.max(10, shaftLen * 0.38))
}

/** 몸통+화살촉을 하나의 채움 경로로 그림 — 선/삼각형 분리로 생기는 틈 제거 */
function drawUnifiedArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineW: number,
): void {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const ang = Math.atan2(dy, dx)
  const headLen = arrowHeadLength(lineW, len)
  const hw = lineW / 2
  const px = -Math.sin(ang) * hw
  const py = Math.cos(ang) * hw

  const xl = x2 + Math.cos(ang + Math.PI - ARROW_HEAD_SPREAD) * headLen
  const yl = y2 + Math.sin(ang + Math.PI - ARROW_HEAD_SPREAD) * headLen
  const xr = x2 + Math.cos(ang + Math.PI + ARROW_HEAD_SPREAD) * headLen
  const yr = y2 + Math.sin(ang + Math.PI + ARROW_HEAD_SPREAD) * headLen

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x1 + px, y1 + py)
  ctx.lineTo(xl, yl)
  ctx.lineTo(x2, y2)
  ctx.lineTo(xr, yr)
  ctx.lineTo(x1 - px, y1 - py)
  ctx.arc(x1, y1, hw, ang + Math.PI / 2, ang - Math.PI / 2, true)
  ctx.closePath()
  ctx.fill()
}

function applyShapeRotationTransform(
  ctx: CanvasRenderingContext2D,
  shape: StudioShapeLayer,
): { x: number; y: number } | null {
  const b = shapeUnrotatedBounds(shape)
  if (!b) return null
  const rot = shape.rotation ?? 0
  if (!rot) return null
  const pivot = layerPivot(b)
  ctx.translate(pivot.x, pivot.y)
  ctx.rotate((rot * Math.PI) / 180)
  ctx.translate(-pivot.x, -pivot.y)
  return pivot
}

export function getShapePivot(shape: StudioShapeLayer): { x: number; y: number } {
  const b = shapeUnrotatedBounds(shape)
  if (!b) return { x: 0, y: 0 }
  return layerPivot(b)
}

export function getShapeRotateHandlePosition(
  shape: StudioShapeLayer,
): { x: number; y: number; pivotX: number; pivotY: number } | null {
  const b = shapeUnrotatedBounds(shape)
  if (!b) return null
  return getLayerRotateHandlePosition(b, shape.rotation ?? 0)
}

export function hitTestShapeRotateHandle(
  shape: StudioShapeLayer,
  px: number,
  py: number,
  handleSize = 14,
): boolean {
  const b = shapeUnrotatedBounds(shape)
  if (!b) return false
  return hitTestLayerRotateHandle(b, shape.rotation ?? 0, px, py, handleSize)
}

export function shapeUnrotatedBounds(shape: StudioShapeLayer): LayerBounds | null {
  if (shape.kind === 'rect' || shape.kind === 'path') {
    return { x: shape.x, y: shape.y, width: shape.width, height: shape.height }
  }
  if (shape.kind === 'ellipse') {
    return {
      x: shape.cx - shape.rx,
      y: shape.cy - shape.ry,
      width: shape.rx * 2,
      height: shape.ry * 2,
    }
  }
  const pad = 12
  const x1 = shape.x1
  const y1 = shape.y1
  const x2 = shape.x2
  const y2 = shape.y2
  return {
    x: Math.min(x1, x2) - pad,
    y: Math.min(y1, y2) - pad,
    width: Math.abs(x2 - x1) + pad * 2,
    height: Math.abs(y2 - y1) + pad * 2,
  }
}

let _pathHitCanvas: HTMLCanvasElement | null = null

function pathHitCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!_pathHitCanvas) _pathHitCanvas = document.createElement('canvas')
  return _pathHitCanvas.getContext('2d')
}

function pathContainsLocalPoint(shape: StudioPathShape, lx: number, ly: number): boolean {
  const ctx = pathHitCtx()
  if (!ctx) return false
  /**
   * Path2D + isPointInPath 는 경로·포인트를 동일(변환 없는) 좌표계로 비교합니다.
   * 예전에 setTransform(sx,sy)를 켠 채 viewBox 좌표를 넘기면, 일부 브라우저가
   * 테스트 포인트에 CTM을 한 번 더 적용해 히트가 어긋납니다.
   * → 스케일 변환 없이 viewBox 좌표로만 검사합니다.
   */
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const sx = shape.width / Math.max(1e-6, shape.viewBoxW)
  const sy = shape.height / Math.max(1e-6, shape.viewBoxH)
  const p = new Path2D(shape.pathD)
  const px = (lx - shape.x) / sx
  const py = (ly - shape.y) / sy
  if (shape.fill && !shape.strokeOnly) {
    if (ctx.isPointInPath(p, px, py)) return true
    // 얇은 외곽선도 선택 가능하게
    const strokeW = Math.max(2, shape.lineWidth / Math.max(sx, sy))
    ctx.lineWidth = strokeW
    if (typeof ctx.isPointInStroke === 'function' && ctx.isPointInStroke(p, px, py)) return true
    return false
  }
  ctx.lineWidth = Math.max(4, (shape.lineWidth + 8) / Math.max(sx, sy))
  if (typeof ctx.isPointInStroke === 'function') {
    return ctx.isPointInStroke(p, px, py) || ctx.isPointInPath(p, px, py)
  }
  return ctx.isPointInPath(p, px, py)
}

function drawPathShape(ctx: CanvasRenderingContext2D, shape: StudioPathShape): void {
  ctx.save()
  ctx.globalAlpha = shape.opacity
  applyShapeRotationTransform(ctx, shape)
  const sx = shape.width / shape.viewBoxW
  const sy = shape.height / shape.viewBoxH
  ctx.translate(shape.x, shape.y)
  ctx.scale(sx, sy)
  const p = new Path2D(shape.pathD)
  if (shape.fill && !shape.strokeOnly) {
    ctx.fillStyle = shape.fill
    ctx.fill(p)
  }
  if (shape.strokeOnly || shape.lineWidth > 0) {
    ctx.strokeStyle = shape.color
    ctx.lineWidth = shape.lineWidth / Math.max(sx, sy)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke(p)
  }
  ctx.restore()
}

export function drawShapeLayer(ctx: CanvasRenderingContext2D, shape: StudioShapeLayer): void {
  if (shape.kind === 'path') {
    drawPathShape(ctx, shape)
    return
  }

  ctx.save()
  ctx.globalAlpha = shape.opacity
  ctx.strokeStyle = shape.color
  ctx.fillStyle = shape.color
  ctx.lineWidth = shape.lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  applyShapeRotationTransform(ctx, shape)

  if (shape.kind === 'arrow' || shape.kind === 'line') {
    if (shape.kind === 'arrow') {
      drawUnifiedArrow(
        ctx,
        shape.x1,
        shape.y1,
        shape.x2,
        shape.y2,
        shape.color,
        shape.lineWidth,
      )
    } else {
      ctx.beginPath()
      ctx.moveTo(shape.x1, shape.y1)
      ctx.lineTo(shape.x2, shape.y2)
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  if (shape.kind === 'rect') {
    if (shape.fill) {
      ctx.fillStyle = shape.fill
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
    }
    ctx.strokeStyle = shape.color
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
    ctx.restore()
    return
  }

  if (shape.kind === 'ellipse') {
    ctx.beginPath()
    ctx.ellipse(shape.cx, shape.cy, Math.max(4, shape.rx), Math.max(4, shape.ry), 0, 0, Math.PI * 2)
    if (shape.fill) {
      ctx.fillStyle = shape.fill
      ctx.fill()
    }
    ctx.strokeStyle = shape.color
    ctx.stroke()
  }
  ctx.restore()
}

export function shapeToBounds(shape: StudioShapeLayer): LayerBounds | null {
  const b = shapeUnrotatedBounds(shape)
  if (!b) return null
  const rot = shape.rotation ?? 0
  if (!rot) return b
  const c = layerOrientedCorners(b, rot)
  const pts = [c.nw, c.ne, c.se, c.sw]
  let x0 = pts[0].x
  let y0 = pts[0].y
  let x1 = x0
  let y1 = y0
  for (const p of pts) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

function hitTestLineShape(
  shape: StudioArrowShape | StudioLineShape,
  px: number,
  py: number,
): ShapeHitResult | null {
  const b = shapeUnrotatedBounds(shape)
  if (!b) return null
  const pivot = layerPivot(b)
  const local = pointerToLocal(px, py, pivot.x, pivot.y, shape.rotation ?? 0)
  const endR = 22
  const thresh = 14
  const d1 = Math.sqrt(distSq(local.x, local.y, shape.x1, shape.y1))
  const d2 = Math.sqrt(distSq(local.x, local.y, shape.x2, shape.y2))
  if (d2 <= endR) return { id: shape.id, part: 'end' }
  if (d1 <= endR) return { id: shape.id, part: 'start' }
  if (
    distPointToSeg(local.x, local.y, shape.x1, shape.y1, shape.x2, shape.y2) <=
    thresh + shape.lineWidth * 0.5
  ) {
    return { id: shape.id, part: 'move' }
  }
  return null
}

export function hitTestShapeLayer(shape: StudioShapeLayer, px: number, py: number): ShapeHitResult | null {
  if (shape.kind === 'arrow' || shape.kind === 'line') return hitTestLineShape(shape, px, py)
  const bounds = shapeUnrotatedBounds(shape)
  if (!bounds) return null
  const pivot = layerPivot(bounds)
  const local = pointerToLocal(px, py, pivot.x, pivot.y, shape.rotation ?? 0)
  const handle = hitTestResizeHandle(bounds, local.x, local.y)
  if (handle) return { id: shape.id, part: 'body', resizeHandle: handle }
  if (shape.kind === 'path') {
    if (pathContainsLocalPoint(shape, local.x, local.y)) return { id: shape.id, part: 'move' }
    return null
  }
  if (hitTestBounds(bounds, local.x, local.y)) return { id: shape.id, part: 'move' }
  return null
}

export function hitTestShapeLayers(
  shapes: readonly StudioShapeLayer[],
  px: number,
  py: number,
): ShapeHitResult | null {
  const sorted = [...shapes].sort((a, b) => b.zIndex - a.zIndex)
  for (const s of sorted) {
    const hit = hitTestShapeLayer(s, px, py)
    if (hit) return hit
  }
  return null
}

export function shapeLayerLabel(shape: StudioShapeLayer): string {
  if (shape.presetId) {
    const preset = getElementPreset(shape.presetId)
    if (preset) return preset.label
  }
  switch (shape.kind) {
    case 'path':
      return '요소'
    case 'arrow':
      return '화살표'
    case 'line':
      return '직선'
    case 'rect':
      return '사각형'
    case 'ellipse':
      return '타원'
  }
}

export function applyShapeDragMove(
  shape: StudioShapeLayer,
  part: ShapeHitPart,
  px: number,
  py: number,
  startPx: number,
  startPy: number,
  origin: StudioShapeLayer,
): StudioShapeLayer {
  if (shape.kind === 'arrow' || shape.kind === 'line') {
    const o = origin as StudioArrowShape | StudioLineShape
    if (part === 'start') return { ...shape, x1: px, y1: py }
    if (part === 'end') return { ...shape, x2: px, y2: py }
    const dx = px - startPx
    const dy = py - startPy
    return { ...shape, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy }
  }
  if (shape.kind === 'rect') {
    const o = origin as StudioRectShape
    const dx = px - startPx
    const dy = py - startPy
    return { ...shape, x: o.x + dx, y: o.y + dy }
  }
  if (shape.kind === 'path') {
    const o = origin as StudioPathShape
    const dx = px - startPx
    const dy = py - startPy
    return { ...shape, x: o.x + dx, y: o.y + dy }
  }
  const o = origin as StudioEllipseShape
  const dx = px - startPx
  const dy = py - startPy
  return { ...shape, cx: o.cx + dx, cy: o.cy + dy }
}

export type StudioOverlayHit =
  | { kind: 'text'; id: string; zIndex: number }
  | { kind: 'image'; id: string; zIndex: number }
  | { kind: 'shape'; id: string; zIndex: number; shapeHit: ShapeHitResult }

/** 텍스트·이미지·도형 중 최상위(z) 히트 */
export function hitTestTopOverlayLayer(
  doc: ThumbnailStudioDocument,
  px: number,
  py: number,
  textHit: (px: number, py: number) => { id: string; zIndex: number } | null,
): StudioOverlayHit | null {
  let best: StudioOverlayHit | null = null
  const consider = (hit: StudioOverlayHit) => {
    if (!best || hit.zIndex >= best.zIndex) best = hit
  }

  const t = textHit(px, py)
  if (t) consider({ kind: 'text', id: t.id, zIndex: t.zIndex })

  for (const img of doc.imageLayers) {
    if (!img.visible) continue
    if (hitTestImageLayer(img, px, py)) {
      consider({ kind: 'image', id: img.id, zIndex: img.zIndex })
    }
  }

  const shapeHit = hitTestShapeLayers(doc.shapeLayers ?? [], px, py)
  if (shapeHit) {
    const shape = doc.shapeLayers.find((s) => s.id === shapeHit.id)
    if (shape) consider({ kind: 'shape', id: shape.id, zIndex: shape.zIndex, shapeHit })
  }

  return best
}

export function applyShapeBoundsResize(
  shape: StudioShapeLayer,
  bounds: LayerBounds,
): StudioShapeLayer {
  if (shape.kind === 'rect' || shape.kind === 'path') {
    return { ...shape, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
  }
  if (shape.kind === 'ellipse') {
    return {
      ...shape,
      cx: bounds.x + bounds.width / 2,
      cy: bounds.y + bounds.height / 2,
      rx: Math.max(8, bounds.width / 2),
      ry: Math.max(8, bounds.height / 2),
    }
  }
  return shape
}

import type { StudioImageLayer } from './types'
import type { LayerBounds, CornerHandleId, ResizeHandleId } from './studioTransform'
import { hitTestBounds, orientedHandlesFromCorners } from './studioTransform'

export function rotatePointAbout(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rotationDeg: number,
): { x: number; y: number } {
  if (!rotationDeg) return { x, y }
  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = x - cx
  const dy = y - cy
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
}

export function pointerToLocal(
  px: number,
  py: number,
  pivotX: number,
  pivotY: number,
  rotationDeg: number,
): { x: number; y: number } {
  return rotatePointAbout(px, py, pivotX, pivotY, -rotationDeg)
}

export function layerPivot(bounds: LayerBounds): { x: number; y: number } {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

export function boundsAxisAlignedBox(
  corners: readonly { x: number; y: number }[],
): LayerBounds {
  let x0 = corners[0].x
  let y0 = corners[0].y
  let x1 = x0
  let y1 = y0
  for (const p of corners) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

export function layerOrientedCorners(
  bounds: LayerBounds,
  rotationDeg: number,
): Record<CornerHandleId, { x: number; y: number }> {
  const { x, y, width, height } = bounds
  const pivot = layerPivot(bounds)
  const nw = rotatePointAbout(x, y, pivot.x, pivot.y, rotationDeg)
  const ne = rotatePointAbout(x + width, y, pivot.x, pivot.y, rotationDeg)
  const se = rotatePointAbout(x + width, y + height, pivot.x, pivot.y, rotationDeg)
  const sw = rotatePointAbout(x, y + height, pivot.x, pivot.y, rotationDeg)
  return { nw, ne, se, sw }
}

export function layerOrientedHandlePositions(
  bounds: LayerBounds,
  rotationDeg: number,
): Record<ResizeHandleId, { x: number; y: number }> {
  return orientedHandlesFromCorners(layerOrientedCorners(bounds, rotationDeg))
}

export function getLayerRotateHandlePosition(
  bounds: LayerBounds,
  rotationDeg: number,
): { x: number; y: number; pivotX: number; pivotY: number } {
  const pivot = layerPivot(bounds)
  const topMid = rotatePointAbout(bounds.x + bounds.width / 2, bounds.y, pivot.x, pivot.y, rotationDeg)
  const rad = (rotationDeg * Math.PI) / 180 - Math.PI / 2
  const dist = 30
  return {
    pivotX: pivot.x,
    pivotY: pivot.y,
    x: topMid.x + dist * Math.cos(rad),
    y: topMid.y + dist * Math.sin(rad),
  }
}

export function hitTestLayerRotateHandle(
  bounds: LayerBounds,
  rotationDeg: number,
  px: number,
  py: number,
  handleSize = 14,
): boolean {
  const h = getLayerRotateHandlePosition(bounds, rotationDeg)
  const half = handleSize
  return Math.abs(px - h.x) <= half && Math.abs(py - h.y) <= half
}

export function imageLayerBounds(layer: StudioImageLayer): LayerBounds {
  return { x: layer.x, y: layer.y, width: layer.width, height: layer.height }
}

export function hitTestImageLayer(layer: StudioImageLayer, px: number, py: number): boolean {
  const bounds = imageLayerBounds(layer)
  const pivot = layerPivot(bounds)
  const local = pointerToLocal(px, py, pivot.x, pivot.y, layer.rotation ?? 0)
  return hitTestBounds(bounds, local.x, local.y)
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

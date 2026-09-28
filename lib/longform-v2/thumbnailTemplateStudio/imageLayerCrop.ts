import type { ResizeHandleId } from './studioTransform'
import {
  isCornerResizeHandle,
  resizeBoundsProportional,
  resizeBoundsWithHandle,
  type LayerBounds,
} from './studioTransform'
import type { StudioImageLayer } from './types'

export type StudioImageCrop = {
  x: number
  y: number
  width: number
  height: number
}

export function resolveImageLayerCrop(
  layer: Pick<StudioImageLayer, 'crop' | 'width' | 'height'>,
  imgW: number,
  imgH: number,
): StudioImageCrop {
  const iw = Math.max(1, Math.round(imgW))
  const ih = Math.max(1, Math.round(imgH))
  const c = layer.crop
  if (!c?.width || !c?.height) {
    return { x: 0, y: 0, width: iw, height: ih }
  }
  const width = Math.max(1, Math.min(Math.round(c.width), iw))
  const height = Math.max(1, Math.min(Math.round(c.height), ih))
  const x = Math.max(0, Math.min(Math.round(c.x), iw - width))
  const y = Math.max(0, Math.min(Math.round(c.y), ih - height))
  return { x, y, width, height }
}

export function fullImageCrop(imgW: number, imgH: number): StudioImageCrop {
  const iw = Math.max(1, Math.round(imgW))
  const ih = Math.max(1, Math.round(imgH))
  return { x: 0, y: 0, width: iw, height: ih }
}

export function clampSourceCrop(crop: StudioImageCrop, imgW: number, imgH: number): StudioImageCrop {
  const iw = Math.max(1, Math.round(imgW))
  const ih = Math.max(1, Math.round(imgH))
  const width = Math.max(8, Math.min(Math.round(crop.width), iw))
  const height = Math.max(8, Math.min(Math.round(crop.height), ih))
  const x = Math.max(0, Math.min(Math.round(crop.x), iw - width))
  const y = Math.max(0, Math.min(Math.round(crop.y), ih - height))
  return { x, y, width, height }
}

/** 원본 전체가 차지하는 캔버스 영역 (현재 표시·crop 기준) */
export function fullImageCanvasBounds(
  layer: Pick<StudioImageLayer, 'x' | 'y' | 'width' | 'height'>,
  crop: StudioImageCrop,
  imgW: number,
  imgH: number,
): LayerBounds {
  const c = crop
  const scaleX = layer.width / Math.max(1, c.width)
  const scaleY = layer.height / Math.max(1, c.height)
  const iw = Math.max(1, imgW)
  const ih = Math.max(1, imgH)
  return {
    x: layer.x - c.x * scaleX,
    y: layer.y - c.y * scaleY,
    width: iw * scaleX,
    height: ih * scaleY,
  }
}

export function cropToCanvasBounds(
  fullCanvas: LayerBounds,
  crop: StudioImageCrop,
  imgW: number,
  imgH: number,
): LayerBounds {
  const iw = Math.max(1, imgW)
  const ih = Math.max(1, imgH)
  return {
    x: fullCanvas.x + (crop.x / iw) * fullCanvas.width,
    y: fullCanvas.y + (crop.y / ih) * fullCanvas.height,
    width: (crop.width / iw) * fullCanvas.width,
    height: (crop.height / ih) * fullCanvas.height,
  }
}

export function canvasCropBoundsToSourceCrop(
  fullCanvas: LayerBounds,
  cropCanvas: LayerBounds,
  imgW: number,
  imgH: number,
): StudioImageCrop {
  const iw = Math.max(1, imgW)
  const ih = Math.max(1, imgH)
  if (!fullCanvas.width || !fullCanvas.height) return fullImageCrop(iw, ih)
  const x = ((cropCanvas.x - fullCanvas.x) / fullCanvas.width) * iw
  const y = ((cropCanvas.y - fullCanvas.y) / fullCanvas.height) * ih
  const width = (cropCanvas.width / fullCanvas.width) * iw
  const height = (cropCanvas.height / fullCanvas.height) * ih
  return clampSourceCrop({ x, y, width, height }, iw, ih)
}

function clampCropCanvasToFull(cropCanvas: LayerBounds, fullCanvas: LayerBounds): LayerBounds {
  const width = Math.max(20, Math.min(cropCanvas.width, fullCanvas.width))
  const height = Math.max(20, Math.min(cropCanvas.height, fullCanvas.height))
  const x = Math.max(
    fullCanvas.x,
    Math.min(cropCanvas.x, fullCanvas.x + fullCanvas.width - width),
  )
  const y = Math.max(
    fullCanvas.y,
    Math.min(cropCanvas.y, fullCanvas.y + fullCanvas.height - height),
  )
  return { x, y, width, height }
}

/** 자르기 모드 — 캔버스 핸들로 원본 crop 영역 조절 */
export function resizeSourceCropOnCanvas(
  anchorCropCanvas: LayerBounds,
  fullCanvas: LayerBounds,
  handle: ResizeHandleId,
  pointerX: number,
  pointerY: number,
  imgW: number,
  imgH: number,
): StudioImageCrop {
  const resized = isCornerResizeHandle(handle)
    ? resizeBoundsProportional(anchorCropCanvas, handle, pointerX, pointerY)
    : resizeBoundsWithHandle(anchorCropCanvas, handle, pointerX, pointerY, anchorCropCanvas, 20)
  const clamped = clampCropCanvasToFull(resized, fullCanvas)
  return canvasCropBoundsToSourceCrop(fullCanvas, clamped, imgW, imgH)
}

export function moveSourceCropOnCanvas(
  anchorCropCanvas: LayerBounds,
  fullCanvas: LayerBounds,
  deltaX: number,
  deltaY: number,
  imgW: number,
  imgH: number,
): StudioImageCrop {
  const moved = clampCropCanvasToFull(
    {
      x: anchorCropCanvas.x + deltaX,
      y: anchorCropCanvas.y + deltaY,
      width: anchorCropCanvas.width,
      height: anchorCropCanvas.height,
    },
    fullCanvas,
  )
  return canvasCropBoundsToSourceCrop(fullCanvas, moved, imgW, imgH)
}

/** 자르기 적용 — 남길 영역만 표시되도록 bounds·crop 갱신 */
export function applyCommittedImageCrop(
  layer: StudioImageLayer,
  oldCrop: StudioImageCrop,
  newCrop: StudioImageCrop,
  imgW: number,
  imgH: number,
): Partial<StudioImageLayer> {
  const scaleX = layer.width / Math.max(1, oldCrop.width)
  const scaleY = layer.height / Math.max(1, oldCrop.height)
  const crop = clampSourceCrop(newCrop, imgW, imgH)
  return {
    crop,
    x: layer.x + (crop.x - oldCrop.x) * scaleX,
    y: layer.y + (crop.y - oldCrop.y) * scaleY,
    width: crop.width * scaleX,
    height: crop.height * scaleY,
  }
}

export function isFullImageCrop(crop: StudioImageCrop, imgW: number, imgH: number): boolean {
  const full = fullImageCrop(imgW, imgH)
  return (
    crop.x <= 0 &&
    crop.y <= 0 &&
    Math.abs(crop.width - full.width) < 2 &&
    Math.abs(crop.height - full.height) < 2
  )
}

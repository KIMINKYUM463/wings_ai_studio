import { measureTextMetrics } from './textGeometry'
import type { ThumbnailStudioDocument } from './types'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'

/** 배경 밝기에 맞춰 모든 문구 색·테두리 자동 조정 (Canva 텍스트 가독성 보정) */
export async function applySmartTextContrast(
  doc: ThumbnailStudioDocument,
  canvasCtx: CanvasRenderingContext2D,
): Promise<ThumbnailStudioDocument> {
  const bgUrl = doc.background.imageDataUrl?.trim()
  if (!bgUrl || !doc.textLayers.some((t) => t.text.trim())) return doc

  const bgCanvas = document.createElement('canvas')
  bgCanvas.width = STUDIO_CANVAS_W
  bgCanvas.height = STUDIO_CANVAS_H
  const bgCtx = bgCanvas.getContext('2d')
  if (!bgCtx) return doc

  const img = await loadImage(bgUrl)
  const layout = doc.background.layout
  if (layout) {
    bgCtx.drawImage(img, layout.x, layout.y, layout.width, layout.height)
  } else {
    const scale = Math.max(STUDIO_CANVAS_W / img.width, STUDIO_CANVAS_H / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    bgCtx.drawImage(img, (STUDIO_CANVAS_W - dw) / 2, (STUDIO_CANVAS_H - dh) / 2, dw, dh)
  }

  const textLayers = doc.textLayers.map((layer) => {
    if (!layer.text.trim()) return layer
    const met = measureTextMetrics(canvasCtx, layer)
    if (!met) return layer

    const rot = ((layer.rotation ?? 0) * Math.PI) / 180
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    const corners = [
      { x: met.localLeft, y: met.localTop },
      { x: met.localRight, y: met.localTop },
      { x: met.localRight, y: met.localBottom },
      { x: met.localLeft, y: met.localBottom },
    ].map(({ x, y }) => ({
      x: met.pivotX + x * cos - y * sin,
      y: met.pivotY + x * sin + y * cos,
    }))

    const xs = corners.map((c) => c.x)
    const ys = corners.map((c) => c.y)
    const x0 = Math.max(0, Math.floor(Math.min(...xs)))
    const y0 = Math.max(0, Math.floor(Math.min(...ys)))
    const x1 = Math.min(STUDIO_CANVAS_W, Math.ceil(Math.max(...xs)))
    const y1 = Math.min(STUDIO_CANVAS_H, Math.ceil(Math.max(...ys)))
    if (x1 <= x0 || y1 <= y0) return layer

    const sample = bgCtx.getImageData(x0, y0, x1 - x0, y1 - y0).data
    let lumSum = 0
    let n = 0
    for (let i = 0; i < sample.length; i += 16) {
      const r = sample[i]
      const g = sample[i + 1]
      const b = sample[i + 2]
      lumSum += (0.299 * r + 0.587 * g + 0.114 * b) / 255
      n += 1
    }
    const avgLum = n ? lumSum / n : 0.5
    const style =
      avgLum > 0.52
        ? { fill: '#111111', stroke: '#ffffff', strokeWidth: Math.max(4, layer.strokeWidth ?? 4) }
        : { fill: '#ffffff', stroke: '#111111', strokeWidth: Math.max(4, layer.strokeWidth ?? 4) }

    return { ...layer, ...style }
  })

  return { ...doc, textLayers }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('배경 이미지를 불러올 수 없습니다.'))
    img.src = src
  })
}

/** 팔레트 색을 텍스트 레이어에 순환 적용 */
export function applyPaletteToTextLayers(
  doc: ThumbnailStudioDocument,
  palette: string[],
  scope: 'selected' | 'all',
  selectedId?: string,
): ThumbnailStudioDocument {
  if (!palette.length) return doc
  const textLayers = doc.textLayers.map((layer, i) => {
    if (scope === 'selected' && layer.id !== selectedId) return layer
    if (scope === 'all' && !layer.text.trim()) return layer
    const hex = palette[i % palette.length]
    return {
      ...layer,
      fill: hex,
      stroke: isLight(hex) ? '#111111' : '#ffffff',
      strokeWidth: Math.max(3, layer.strokeWidth ?? 3),
    }
  })
  return { ...doc, textLayers }
}

function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
}

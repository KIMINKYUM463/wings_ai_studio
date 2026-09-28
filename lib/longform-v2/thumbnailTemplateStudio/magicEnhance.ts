import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'

/** Canva Magic Edit 스타일 — 배경 밝기·대비·채도 자동 보정 */
export async function enhanceBackgroundImage(imageDataUrl: string): Promise<string> {
  const img = await loadImage(imageDataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = STUDIO_CANVAS_W
  canvas.height = STUDIO_CANVAS_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 만들 수 없습니다.')

  const scale = Math.max(STUDIO_CANVAS_W / img.width, STUDIO_CANVAS_H / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, (STUDIO_CANVAS_W - dw) / 2, (STUDIO_CANVAS_H - dh) / 2, dw, dh)

  const imageData = ctx.getImageData(0, 0, STUDIO_CANVAS_W, STUDIO_CANVAS_H)
  const d = imageData.data
  const brightness = 1.06
  const contrast = 1.12
  const sat = 1.14

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]
    let g = d[i + 1]
    let b = d[i + 2]
    r = clamp((r - 128) * contrast + 128) * brightness
    g = clamp((g - 128) * contrast + 128) * brightness
    b = clamp((b - 128) * contrast + 128) * brightness
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    r = clamp(gray + (r - gray) * sat)
    g = clamp(gray + (g - gray) * sat)
    b = clamp(gray + (b - gray) * sat)
    d[i] = r
    d[i + 1] = g
    d[i + 2] = b
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'))
    img.src = src
  })
}

import type { StudioImageLayer } from './types'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'

/** 누끼(투명) PNG — `public/thumbnail-studio/arrow-red.png` */
export const STUDIO_ARROW_STICKER_URL = '/thumbnail-studio/arrow-red.png'

/** `prepare-studio-arrow-sticker.mjs` 출력 기준 (503×429) */
export const STUDIO_ARROW_STICKER_ASPECT = 503 / 429

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export async function fetchStudioArrowStickerDataUrl(): Promise<string> {
  const res = await fetch(STUDIO_ARROW_STICKER_URL, { cache: 'force-cache' })
  if (!res.ok) throw new Error(`화살표 스티커 로드 실패 (${res.status})`)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('화살표 스티커 읽기 실패'))
    reader.readAsDataURL(blob)
  })
}

export function buildArrowStickerImageLayer(
  imageDataUrl: string,
  zIndex: number,
): StudioImageLayer {
  let width = Math.round(STUDIO_CANVAS_W * 0.34)
  let height = Math.round(width / STUDIO_ARROW_STICKER_ASPECT)
  if (height > STUDIO_CANVAS_H * 0.42) {
    height = Math.round(STUDIO_CANVAS_H * 0.42)
    width = Math.round(height * STUDIO_ARROW_STICKER_ASPECT)
  }
  return {
    id: newId(),
    kind: 'image',
    name: '화살표',
    imageDataUrl,
    x: Math.round(STUDIO_CANVAS_W * 0.52),
    y: Math.round(STUDIO_CANVAS_H * 0.28),
    width,
    height,
    opacity: 1,
    zIndex,
    visible: true,
  }
}

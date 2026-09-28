import { API_BASE } from '@/lib/longform-v2/thumbnail-bridge/apiBase'
import { postGenerateElementSticker } from '@/lib/longform-v2/thumbnail-bridge/thumbnailAiApi'
import type { ElementPresetDef } from './elementPresets'
import type { StudioImageLayer } from './types'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** SPA 폴백(HEAD 200)과 구분 — 서버 파일시스템 기준 캐시 여부 */
export async function fetchElementStickerCached(presetId: string): Promise<boolean> {
  try {
    const r = await fetch(
      `${API_BASE}/api/thumbnail-studio/element-sticker/${encodeURIComponent(presetId)}/status`,
    )
    if (!r.ok) return false
    const j = (await r.json()) as { cached?: boolean }
    return Boolean(j.cached)
  } catch {
    return false
  }
}

function elementStickerServeUrl(presetId: string): string {
  return `${API_BASE}/api/thumbnail-studio/element-sticker/${encodeURIComponent(presetId)}`
}

/** 캐시된 PNG URL 또는 AI 생성 후 URL */
export async function resolveElementStickerUrl(
  preset: ElementPresetDef,
  stickerSubject: string,
): Promise<{ imageUrl: string; width: number; height: number }> {
  if (await fetchElementStickerCached(preset.id)) {
    return { imageUrl: elementStickerServeUrl(preset.id), width: 512, height: 512 }
  }

  const gen = await postGenerateElementSticker({
    presetId: preset.id,
    stickerSubject,
  })
  return {
    imageUrl: gen.imageUrl.startsWith('http') ? gen.imageUrl : `${API_BASE}${gen.imageUrl}`,
    width: gen.width,
    height: gen.height,
  }
}

export async function fetchElementStickerDataUrl(
  preset: ElementPresetDef,
  stickerSubject: string,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const { imageUrl, width, height } = await resolveElementStickerUrl(preset, stickerSubject)
  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`스티커 이미지 로드 실패 (${res.status})`)
  const blob = await res.blob()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('스티커 읽기 실패'))
    reader.readAsDataURL(blob)
  })
  return { dataUrl, width, height }
}

export function buildElementStickerImageLayer(
  preset: ElementPresetDef,
  imageDataUrl: string,
  zIndex: number,
  assetAspect = 1,
): StudioImageLayer {
  let width = Math.round(STUDIO_CANVAS_W * preset.defaultWidthRatio)
  let height = Math.round(width / assetAspect)
  if (height > STUDIO_CANVAS_H * preset.defaultHeightRatio * 1.5) {
    height = Math.round(STUDIO_CANVAS_H * preset.defaultHeightRatio)
    width = Math.round(height * assetAspect)
  }
  width = Math.max(48, width)
  height = Math.max(48, height)

  return {
    id: newId(),
    kind: 'image',
    name: preset.label,
    imageDataUrl,
    x: Math.round(STUDIO_CANVAS_W * 0.5 - width / 2),
    y: Math.round(STUDIO_CANVAS_H * 0.5 - height / 2),
    width,
    height,
    opacity: 1,
    zIndex,
    visible: true,
    rotation: preset.defaultRotation ?? 0,
  }
}

export function elementStickerPreviewUrl(presetId: string): string {
  return elementStickerServeUrl(presetId)
}

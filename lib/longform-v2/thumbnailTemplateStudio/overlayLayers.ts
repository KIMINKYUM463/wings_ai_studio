import type { ThumbnailStudioDocument } from './types'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'

export type StudioOverlayPresetId =
  | 'bottom-dark'
  | 'top-dark'
  | 'left-dark'
  | 'right-dark'
  | 'vignette'
  | 'warm-tint'
  | 'cool-tint'
  | 'cinematic'

export type StudioOverlayLayer = {
  id: string
  kind: 'overlay'
  name: string
  preset: StudioOverlayPresetId
  /** 0.1~0.95 — 프리셋 강도 */
  opacity: number
  /** 0.15~1 — 그라데이션 프리셋 적용 범위 */
  extent?: number
  /** 0.05~1 — 그라데이션 페이드 부드러움 */
  feather?: number
  zIndex: number
  visible: boolean
}

export const OVERLAY_PRESETS: ReadonlyArray<{
  id: StudioOverlayPresetId
  label: string
  previewClass: string
  defaultOpacity: number
}> = [
  { id: 'bottom-dark', label: '하단 어둡게', previewClass: 'thumb-overlay-preset--bottom-dark', defaultOpacity: 0.6 },
  { id: 'top-dark', label: '상단 어둡게', previewClass: 'thumb-overlay-preset--top-dark', defaultOpacity: 0.55 },
  { id: 'left-dark', label: '좌측 어둡게', previewClass: 'thumb-overlay-preset--left-dark', defaultOpacity: 0.58 },
  { id: 'right-dark', label: '우측 어둡게', previewClass: 'thumb-overlay-preset--right-dark', defaultOpacity: 0.58 },
  { id: 'vignette', label: '비네팅', previewClass: 'thumb-overlay-preset--vignette', defaultOpacity: 0.65 },
  { id: 'warm-tint', label: '따뜻한 틴트', previewClass: 'thumb-overlay-preset--warm-tint', defaultOpacity: 0.42 },
  { id: 'cool-tint', label: '차가운 틴트', previewClass: 'thumb-overlay-preset--cool-tint', defaultOpacity: 0.4 },
  { id: 'cinematic', label: '시네마틱', previewClass: 'thumb-overlay-preset--cinematic', defaultOpacity: 0.52 },
]

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `ovl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function normalizeOverlayOpacity(raw?: number): number {
  return clamp(typeof raw === 'number' ? raw : Number(raw) || 0.55, 0.1, 0.95)
}

export function overlayPresetLabel(preset: StudioOverlayPresetId): string {
  return OVERLAY_PRESETS.find((p) => p.id === preset)?.label ?? preset
}

/** 새 오버레이는 글자·스티커 아래에 깔리도록 z-index 배치 */
export function defaultOverlayZIndex(doc: ThumbnailStudioDocument): number {
  const textZs = doc.textLayers.map((t) => t.zIndex)
  const imageZs = doc.imageLayers.map((i) => i.zIndex)
  const shapeZs = (doc.shapeLayers ?? []).map((s) => s.zIndex)
  const contentMin = [...textZs, ...imageZs, ...shapeZs].filter((z) => z > 0)
  if (contentMin.length) return Math.max(4, Math.min(...contentMin) - 1)
  return 8
}

export function createOverlayFromPreset(
  preset: StudioOverlayPresetId,
  zIndex: number,
): StudioOverlayLayer {
  const meta = OVERLAY_PRESETS.find((p) => p.id === preset)
  return {
    id: newId(),
    kind: 'overlay',
    name: meta?.label ?? preset,
    preset,
    opacity: meta?.defaultOpacity ?? 0.55,
    extent: 1,
    feather: 1,
    zIndex,
    visible: true,
  }
}

export function normalizeOverlayLayer(raw: Partial<StudioOverlayLayer> & { id: string }): StudioOverlayLayer {
  const preset =
    OVERLAY_PRESETS.some((p) => p.id === raw.preset) ? (raw.preset as StudioOverlayPresetId) : 'bottom-dark'
  return {
    id: raw.id,
    kind: 'overlay',
    name: raw.name?.trim() || overlayPresetLabel(preset),
    preset,
    opacity: normalizeOverlayOpacity(raw.opacity),
    extent: clamp(typeof raw.extent === 'number' ? raw.extent : Number(raw.extent) || 1, 0.15, 1),
    feather: clamp(typeof raw.feather === 'number' ? raw.feather : Number(raw.feather) || 1, 0.05, 1),
    zIndex: clamp(typeof raw.zIndex === 'number' ? raw.zIndex : 8, 1, 99),
    visible: raw.visible !== false,
  }
}

export function isGradientOverlayPreset(preset: StudioOverlayPresetId): boolean {
  return preset !== 'warm-tint' && preset !== 'cool-tint'
}

function applyOverlayGradientStops(
  g: CanvasGradient,
  dark: string,
  clear: string,
  feather: number,
): void {
  const fadeEnd = clamp(feather, 0.08, 1)
  g.addColorStop(0, dark)
  if (fadeEnd < 1) g.addColorStop(fadeEnd, clear)
  g.addColorStop(1, clear)
}

export function drawOverlayLayer(
  ctx: CanvasRenderingContext2D,
  layer: StudioOverlayLayer,
  w = STUDIO_CANVAS_W,
  h = STUDIO_CANVAS_H,
): void {
  if (!layer.visible) return
  const normalized = normalizeOverlayLayer(layer)
  const alpha = normalized.opacity
  const extent = normalized.extent ?? 1
  const feather = normalized.feather ?? 1
  const dark = (a: number) => `rgba(0,0,0,${a})`
  const clear = 'rgba(0,0,0,0)'

  ctx.save()
  switch (normalized.preset) {
    case 'bottom-dark': {
      const g = ctx.createLinearGradient(0, h, 0, h - extent * h)
      applyOverlayGradientStops(g, dark(alpha), clear, feather)
      ctx.fillStyle = g
      break
    }
    case 'top-dark': {
      const g = ctx.createLinearGradient(0, 0, 0, extent * h)
      applyOverlayGradientStops(g, dark(alpha), clear, feather)
      ctx.fillStyle = g
      break
    }
    case 'left-dark': {
      const g = ctx.createLinearGradient(0, 0, extent * w, 0)
      applyOverlayGradientStops(g, dark(alpha), clear, feather)
      ctx.fillStyle = g
      break
    }
    case 'right-dark': {
      const g = ctx.createLinearGradient(w, 0, w - extent * w, 0)
      applyOverlayGradientStops(g, dark(alpha), clear, feather)
      ctx.fillStyle = g
      break
    }
    case 'vignette': {
      const innerR = h * 0.08 * (1.5 - extent * 0.5)
      const outerR = h * (0.55 + extent * 0.4)
      const g = ctx.createRadialGradient(w / 2, h / 2, innerR, w / 2, h / 2, outerR)
      g.addColorStop(0, clear)
      g.addColorStop(clamp(1 - feather, 0.2, 0.95), clear)
      g.addColorStop(1, dark(alpha))
      ctx.fillStyle = g
      break
    }
    case 'warm-tint':
      ctx.fillStyle = `rgba(234, 88, 12, ${alpha * 0.55})`
      break
    case 'cool-tint':
      ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.5})`
      break
    case 'cinematic': {
      const g = ctx.createLinearGradient(0, h, extent * w, h - extent * h)
      g.addColorStop(0, dark(alpha * 0.95))
      g.addColorStop(clamp(0.35 + (1 - feather) * 0.25, 0.2, 0.75), dark(alpha * 0.35))
      g.addColorStop(1, clear)
      ctx.fillStyle = g
      break
    }
    default:
      ctx.restore()
      return
  }
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

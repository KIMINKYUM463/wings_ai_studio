import type { TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import { DEFAULT_THUMBNAIL_FONT_STACK } from '@/lib/longform-v2/thumbnail-bridge/bundledFonts'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'

export type WatermarkPresetId = 'new' | 'live' | 'hot' | 'ep' | 'subscribe' | 'channel'

export type WatermarkPresetDef = {
  id: WatermarkPresetId
  label: string
  /** 기본 문구 — EP 등은 사용자 입력 가능 */
  defaultText: string
  editable?: boolean
}

export const WATERMARK_PRESETS: readonly WatermarkPresetDef[] = [
  { id: 'new', label: 'NEW', defaultText: 'NEW' },
  { id: 'live', label: 'LIVE', defaultText: 'LIVE' },
  { id: 'hot', label: 'HOT', defaultText: 'HOT' },
  { id: 'ep', label: 'EP.01', defaultText: 'EP.01', editable: true },
  { id: 'subscribe', label: '구독', defaultText: '구독' },
  { id: 'channel', label: '채널명', defaultText: '채널명', editable: true },
]

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `wm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

type WatermarkTextInput = Partial<
  Pick<TextItem, 'textAlign' | 'fontFamily' | 'stroke' | 'strokeWidth' | 'visible'>
> &
  Omit<TextItem, 'id' | 'kind' | 'textAlign' | 'fontFamily' | 'stroke' | 'strokeWidth' | 'visible'>

function baseTextItem(partial: WatermarkTextInput): TextItem {
  return {
    id: newId(),
    kind: 'text',
    visible: true,
    fontFamily: DEFAULT_THUMBNAIL_FONT_STACK,
    stroke: '#000000',
    strokeWidth: 4,
    textAlign: 'center',
    ...partial,
  }
}

/** CTA·워터마크 프리셋 → 텍스트 레이어 1개 */
export function createWatermarkTextLayer(
  presetId: WatermarkPresetId,
  zIndex: number,
  customText?: string,
): TextItem {
  const preset = WATERMARK_PRESETS.find((p) => p.id === presetId)
  const text = (customText?.trim() || preset?.defaultText || 'NEW').slice(0, 24)

  switch (presetId) {
    case 'new':
      return baseTextItem({
        text,
        x: 72,
        y: 52,
        fontSize: 52,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 5,
        boxBackground: true,
        boxBackgroundColor: 'rgba(220, 38, 38, 0.92)',
        boxPaddingX: 18,
        boxPaddingY: 8,
        boxRadius: 6,
        zIndex,
      })
    case 'live':
      return baseTextItem({
        text,
        x: STUDIO_CANVAS_W - 72,
        y: 48,
        fontSize: 44,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 4,
        boxBackground: true,
        boxBackgroundColor: 'rgba(220, 38, 38, 0.95)',
        boxPaddingX: 16,
        boxPaddingY: 6,
        boxRadius: 8,
        zIndex,
      })
    case 'hot':
      return baseTextItem({
        text,
        x: STUDIO_CANVAS_W - 68,
        y: STUDIO_CANVAS_H - 48,
        fontSize: 40,
        fill: '#fef08a',
        stroke: '#000000',
        strokeWidth: 5,
        boxBackground: true,
        boxBackgroundColor: 'rgba(234, 88, 12, 0.9)',
        boxPaddingX: 14,
        boxPaddingY: 6,
        boxRadius: 6,
        zIndex,
      })
    case 'ep':
      return baseTextItem({
        text,
        x: 64,
        y: STUDIO_CANVAS_H - 44,
        fontSize: 34,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 3,
        boxBackground: true,
        boxBackgroundColor: 'rgba(15, 23, 42, 0.78)',
        boxPaddingX: 12,
        boxPaddingY: 4,
        boxRadius: 4,
        zIndex,
      })
    case 'subscribe':
      return baseTextItem({
        text,
        x: STUDIO_CANVAS_W / 2,
        y: STUDIO_CANVAS_H - 36,
        fontSize: 28,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 3,
        boxBackground: true,
        boxBackgroundColor: 'rgba(234, 88, 12, 0.88)',
        boxPaddingX: 20,
        boxPaddingY: 6,
        boxRadius: 999,
        zIndex,
      })
    case 'channel':
      return baseTextItem({
        text,
        x: 88,
        y: 36,
        fontSize: 26,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 3,
        textAlign: 'left',
        boxBackground: true,
        boxBackgroundColor: 'rgba(0, 0, 0, 0.55)',
        boxPaddingX: 10,
        boxPaddingY: 4,
        boxRadius: 4,
        zIndex,
      })
    default:
      return baseTextItem({
        text,
        x: STUDIO_CANVAS_W / 2,
        y: 48,
        fontSize: 40,
        fill: '#ffffff',
        zIndex,
      })
  }
}

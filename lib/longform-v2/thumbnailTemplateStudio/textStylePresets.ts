import type { TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'

export type TextStylePreset = {
  id: string
  label: string
  /** 미리보기 칩 스타일 */
  previewClass: string
  patch: Partial<
    Pick<
      TextItem,
      | 'fill'
      | 'stroke'
      | 'strokeWidth'
      | 'boxBackground'
      | 'boxBackgroundColor'
      | 'boxPaddingX'
      | 'boxPaddingY'
      | 'boxRadius'
    >
  >
}

/** 자막 스타일 탭 — 썸네일 문구 프리셋 (정적) */
export const THUMBNAIL_TEXT_STYLE_PRESETS: readonly TextStylePreset[] = [
  {
    id: 'none',
    label: '효과 없음',
    previewClass: 'thumb-preset-chip--none',
    patch: { boxBackground: false, strokeWidth: 0, fill: '#ffffff', stroke: '#000000' },
  },
  {
    id: 'box_line',
    label: '박스 라인',
    previewClass: 'thumb-preset-chip--box-line',
    patch: {
      boxBackground: true,
      boxBackgroundColor: 'rgba(0,0,0,0.88)',
      boxPaddingX: 14,
      boxPaddingY: 8,
      boxRadius: 4,
      fill: '#ffffff',
      strokeWidth: 0,
    },
  },
  {
    id: 'box_highlight',
    label: '박스 하이라이트',
    previewClass: 'thumb-preset-chip--box-hi',
    patch: {
      boxBackground: true,
      boxBackgroundColor: '#fde047',
      boxPaddingX: 12,
      boxPaddingY: 6,
      fill: '#0c0a09',
      strokeWidth: 0,
    },
  },
  {
    id: 'outline',
    label: '외곽선',
    previewClass: 'thumb-preset-chip--outline',
    patch: {
      boxBackground: false,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 10,
    },
  },
  {
    id: 'yellow_pop',
    label: '노란 강조',
    previewClass: 'thumb-preset-chip--yellow',
    patch: {
      boxBackground: false,
      fill: '#fde047',
      stroke: '#000000',
      strokeWidth: 7,
    },
  },
  {
    id: 'red_hook',
    label: '레드 훅',
    previewClass: 'thumb-preset-chip--red',
    patch: {
      boxBackground: false,
      fill: '#ef4444',
      stroke: '#000000',
      strokeWidth: 8,
    },
  },
  {
    id: 'neon',
    label: '네온',
    previewClass: 'thumb-preset-chip--neon',
    patch: {
      boxBackground: false,
      fill: '#ffffff',
      stroke: '#a855f7',
      strokeWidth: 6,
    },
  },
  {
    id: 'karaoke',
    label: '하이라이트',
    previewClass: 'thumb-preset-chip--karaoke',
    patch: {
      boxBackground: true,
      boxBackgroundColor: 'rgba(255, 45, 120, 0.85)',
      fill: '#ffffff',
      strokeWidth: 0,
    },
  },
  {
    id: 'elevate',
    label: '엘리베이트',
    previewClass: 'thumb-preset-chip--elevate',
    patch: {
      boxBackground: false,
      fill: '#fecaca',
      stroke: '#18181b',
      strokeWidth: 6,
    },
  },
] as const

/** 텍스트 탭 — 빠른 스타일 4종 */
export const THUMBNAIL_QUICK_TEXT_STYLES: readonly TextStylePreset[] = [
  THUMBNAIL_TEXT_STYLE_PRESETS[0],
  THUMBNAIL_TEXT_STYLE_PRESETS[1],
  THUMBNAIL_TEXT_STYLE_PRESETS[3],
  THUMBNAIL_TEXT_STYLE_PRESETS[6],
]

export function applyTextStylePresetToItem(item: TextItem, presetId: string): TextItem {
  const p = THUMBNAIL_TEXT_STYLE_PRESETS.find((x) => x.id === presetId)
  if (!p) return item
  return { ...item, ...p.patch }
}

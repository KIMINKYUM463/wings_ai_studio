import type { TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import type { TemplateTextSlotDef } from './types'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'

const SLOT_KEY_CYCLE = [
  'hook',
  'highlight',
  'sub',
  'main_title',
  'accent',
  'line1',
  'line2',
  'line3',
  'line4',
  'line5',
  'line6',
  'line7',
  'line8',
] as const

function slotKeyForIndex(index: number): string {
  return SLOT_KEY_CYCLE[index] ?? `line${index + 1}`
}

/** 캔버스 TextItem → 템플릿 슬롯 (저장·커스텀 템플릿 생성용) */
export function textItemToSlot(item: TextItem, index: number): TemplateTextSlotDef {
  const sample = item.text.trim() || `문구${index + 1}`
  return {
    slotKey: slotKeyForIndex(index),
    label: `문구 ${index + 1}`,
    samplePreviewText: sample,
    maxCharacters: Math.max(10, Math.min(24, sample.length + 2)),
    xn: item.x / STUDIO_CANVAS_W,
    yn: item.y / STUDIO_CANVAS_H,
    xnAnchor:
      item.textAlign === 'center' ? 'center' : item.textAlign === 'right' ? 'right-edge' : 'top-left',
    ynAnchor: 'center',
    fontSize: item.fontSize,
    fill: item.fill,
    stroke: item.stroke,
    strokeWidth: item.strokeWidth,
    textAlign: item.textAlign,
    fontFamily: item.fontFamily,
    zIndex: item.zIndex,
    boxBackground: item.boxBackground,
    boxBackgroundColor: item.boxBackgroundColor,
    boxPaddingX: item.boxPaddingX,
    boxPaddingY: item.boxPaddingY,
    boxRadius: item.boxRadius,
    boxWidthPx: item.boxWidthPx,
    rotationDeg: item.rotation ?? 0,
  }
}

/** 문구 레이어 배열 → 템플릿 슬롯 (zIndex 내림차순 = 위 레이어 먼저) */
export function textLayersToSlots(layers: TextItem[]): TemplateTextSlotDef[] {
  const sorted = [...layers].sort((a, b) => b.zIndex - a.zIndex || a.y - b.y)
  return sorted.map((item, i) => textItemToSlot(item, i))
}

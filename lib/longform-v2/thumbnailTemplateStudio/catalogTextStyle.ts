import type { AnalyzedTextBlock, CatalogTextSlotRef } from '@/lib/longform-v2/youtube/templateStyleAnalysis'
import type { TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import { catalogVisualTextSlotsForDocument } from './templateTextSlots'
import type { TemplateTextSlotDef, ThumbnailStudioDocument } from './types'

/** 카탈로그 fontSize 대비 strokeWidth 비율 유지 */
export function scaledCatalogStrokeWidth(
  catalogFontSize: number,
  catalogStrokeWidth: number,
  fontSize: number,
): number {
  if (catalogStrokeWidth <= 0) return 0
  const ratio = fontSize / Math.max(catalogFontSize, 1)
  return Math.max(1, Math.round(catalogStrokeWidth * ratio))
}

type CatalogSlotLike = Pick<
  TemplateTextSlotDef,
  | 'fill'
  | 'stroke'
  | 'strokeWidth'
  | 'fontSize'
  | 'fontFamily'
  | 'textAlign'
  | 'boxBackground'
  | 'boxBackgroundColor'
  | 'boxPaddingX'
  | 'boxPaddingY'
  | 'boxRadius'
  | 'boxWidthPx'
  | 'rotationDeg'
  | 'zIndex'
  | 'fillSpans'
>

/** AI·이전 레이어 색을 덮어쓰지 않고 카탈로그 시각 스타일 고정 (위치·fontSize는 layer 유지) */
export function applyCatalogVisualStyleToTextItem(
  layer: TextItem,
  slot: CatalogSlotLike,
  fontSize = layer.fontSize > 0 ? layer.fontSize : slot.fontSize,
): TextItem {
  return {
    ...layer,
    fontSize,
    fontFamily: slot.fontFamily ?? layer.fontFamily,
    fill: slot.fill,
    stroke: slot.stroke,
    strokeWidth: scaledCatalogStrokeWidth(slot.fontSize, slot.strokeWidth, fontSize),
    textAlign: slot.textAlign,
    zIndex: slot.zIndex ?? layer.zIndex,
    boxBackground: slot.boxBackground ?? false,
    boxBackgroundColor: slot.boxBackgroundColor,
    boxPaddingX: slot.boxPaddingX,
    boxPaddingY: slot.boxPaddingY,
    boxRadius: slot.boxRadius,
    boxWidthPx: slot.boxWidthPx,
    rotation: slot.rotationDeg ?? layer.rotation ?? 0,
    fillSpans: slot.fillSpans,
  }
}

/** 배경·미리보기 비전 병합 — 좌표·크기만 AI, 색·테두리·박스는 카탈로그 */
export function mergeBlockLayoutWithCatalogVisuals(
  block: AnalyzedTextBlock,
  cat: CatalogTextSlotRef,
  fontSize: number,
): AnalyzedTextBlock {
  const strokeScale = fontSize / Math.max(cat.fontSize, 1)
  return {
    ...block,
    role: cat.slotKey,
    fill: cat.fill,
    stroke: cat.stroke,
    strokeWidth:
      cat.strokeWidth > 0 ? Math.max(1, Math.round(cat.strokeWidth * strokeScale)) : 0,
    boxBackground: cat.boxBackground ?? block.boxBackground,
    boxBackgroundColor: cat.boxBackgroundColor ?? block.boxBackgroundColor,
    boxPaddingX: cat.boxPaddingX ?? block.boxPaddingX,
    boxPaddingY: cat.boxPaddingY ?? block.boxPaddingY,
    boxRadius: cat.boxRadius ?? block.boxRadius,
    boxWidthPx: cat.boxWidthPx ?? block.boxWidthPx,
    maxCharacters: cat.maxCharacters ?? block.maxCharacters,
    zIndex: cat.zIndex ?? block.zIndex,
    fontSize,
  }
}

/** 슬롯 maxCharacters — AI 문구가 너무 길지 않게 */
export function clampThumbnailSlotCopy(text: string, maxCharacters: number): string {
  const t = text.trim()
  const max = Math.max(1, Math.floor(maxCharacters))
  if (t.length <= max) return t
  if (max <= 1) return t.slice(0, max)
  return `${t.slice(0, max - 1).trimEnd()}…`
}

/** 레이아웃·크기 조정 후에도 카탈로그 글자 색·테두리·박스 유지 */
export function reapplyCatalogTextStyles(
  doc: ThumbnailStudioDocument,
  opts?: { preserveStrokeWidth?: boolean },
): ThumbnailStudioDocument {
  const slots = catalogVisualTextSlotsForDocument(doc)
  if (!slots.length) return doc
  const textLayers = doc.textLayers.map((layer, i) => {
    const slot = slots[i]
    if (!slot) return layer
    const fontSize = layer.fontSize > 0 ? layer.fontSize : slot.fontSize
    const styled = applyCatalogVisualStyleToTextItem(layer, slot, fontSize)
    if (opts?.preserveStrokeWidth) {
      return { ...styled, strokeWidth: layer.strokeWidth }
    }
    return styled
  })
  return { ...doc, textLayers }
}

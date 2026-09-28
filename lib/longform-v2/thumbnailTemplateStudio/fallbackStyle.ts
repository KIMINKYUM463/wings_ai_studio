import type { AnalyzedTemplateStyleSpec, CatalogTextSlotRef } from '@/lib/longform-v2/youtube/templateStyleAnalysis'
import { getProTemplate } from './catalog'

export function catalogSlotsToAnalyzedBlocks(
  slots: readonly CatalogTextSlotRef[],
): AnalyzedTemplateStyleSpec['textBlocks'] {
  return slots.map((slot) => ({
    role: slot.slotKey,
    sampleText: slot.samplePreviewText?.trim() || undefined,
    xn: slot.xn,
    yn: slot.yn,
    fontSize: slot.fontSize,
    fill: slot.fill,
    stroke: slot.stroke,
    strokeWidth: slot.strokeWidth,
    textAlign: slot.textAlign,
    zIndex: slot.zIndex,
    boxBackground: slot.boxBackground,
    boxBackgroundColor: slot.boxBackgroundColor,
    boxPaddingX: slot.boxPaddingX,
    boxPaddingY: slot.boxPaddingY,
    boxRadius: slot.boxRadius,
    boxWidthPx: slot.boxWidthPx,
    maxCharacters: slot.maxCharacters,
    rotationDeg: slot.rotationDeg,
  }))
}

/** 비전 분석 실패 시 카탈로그 기본값 */
export function buildFallbackTemplateStyleSpec(templateId: string): AnalyzedTemplateStyleSpec | null {
  const tpl = getProTemplate(templateId)
  if (!tpl) return null
  return {
    templateId: tpl.id,
    layoutSummary: tpl.description,
    backgroundPromptEn:
      'Topic-driven YouTube thumbnail background. Do not copy template preview subjects or scenes.',
    subjectZone: 'right',
    textBlocks: catalogSlotsToAnalyzedBlocks(tpl.textSlots),
    layoutFromTemplatePreview: true,
    layoutFromGeneratedBackground: false,
    analyzedAt: Date.now(),
  }
}

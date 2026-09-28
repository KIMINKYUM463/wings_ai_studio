import type {
  AnalyzedTemplateStyleSpec,
} from '@/lib/longform-v2/youtube/templateStyleAnalysis'
import { mergeBlocksWithCatalog } from '@/lib/longform-v2/youtube/templateStyleAnalysis'
import { getProTemplate } from './catalog'
import { catalogSlotsToAnalyzedBlocks } from './fallbackStyle'
import { buildLandscapeTripleCenterTextSlots } from './landscapeTripleCenterLayout'
import { buildDiplomaticDualBottomCenterTextSlots } from './diplomaticDualBottomCenterLayout'
import { buildClassicalRedFrameLeftTextSlots } from './classicalRedFrameLeftLayout'
import { buildCartoonDualTopLeftTextSlots } from './cartoonDualTopLeftLayout'
import { buildPlanetItalicDualLeftTextSlots } from './planetItalicDualLeftLayout'
import { buildAstronautSparksRightTextSlots } from './astronautSparksRightLayout'
import { buildHistoricalHookRightTextSlots } from './historicalHookRightLayout'
import { buildJoseonHookDualLeftTextSlots } from './joseonHookDualLeftLayout'
import type { TemplateTextSlotDef } from './types'
import type { ThumbnailStudioDocument } from './types'

/**
 * 템플릿 미리보기 AI — OCR(sampleText)만 반영.
 * 위치·크기·회전·정렬 앵커는 카탈로그(미리보기 PNG 기준) 고정.
 */
export function mergeTemplatePreviewStyleWithCatalog(
  vision: AnalyzedTemplateStyleSpec,
  catalogSlots: readonly TemplateTextSlotDef[],
): AnalyzedTemplateStyleSpec['textBlocks'] {
  const catalogBlocks = catalogSlotsToAnalyzedBlocks(catalogSlots)
  if (!vision.textBlocks?.length) return catalogBlocks

  const paired = mergeBlocksWithCatalog(vision.textBlocks, catalogSlots)
  return catalogBlocks.map((base, i) => {
    const det = paired[i]
    if (!det) return base
    return {
      ...base,
      sampleText: det.sampleText?.trim() || base.sampleText,
    }
  })
}

function blockToSlot(
  cat: TemplateTextSlotDef,
  block: AnalyzedTemplateStyleSpec['textBlocks'][number],
): TemplateTextSlotDef {
  const fontSize = block.fontSize
  const strokeScale = fontSize / Math.max(cat.fontSize, 1)
  return {
    ...cat,
    xn: block.xn,
    yn: block.yn,
    xnAnchor: cat.xnAnchor,
    ynAnchor: cat.ynAnchor,
    fontSize,
    textAlign: cat.textAlign,
    zIndex: cat.zIndex ?? block.zIndex,
    strokeWidth:
      cat.strokeWidth > 0 ? Math.max(1, Math.round(cat.strokeWidth * strokeScale)) : 0,
    rotationDeg: cat.rotationDeg ?? 0,
  }
}

/** 미리보기 PNG·카탈로그 기준 레이아웃 슬롯 (생성 배경 AI 재배치와 무관) */
export function catalogVisualTextSlotsForDocument(
  doc: Pick<ThumbnailStudioDocument, 'templateId'>,
): TemplateTextSlotDef[] {
  const tpl = getProTemplate(doc.templateId)
  if (!tpl) return []

  if (doc.templateId === 'historical_hook_right') {
    return buildHistoricalHookRightTextSlots(tpl.textSlots)
  }
  if (doc.templateId === 'astronaut_sparks_right') {
    return buildAstronautSparksRightTextSlots(tpl.textSlots)
  }
  if (doc.templateId === 'joseon_hook_dual_left') {
    return buildJoseonHookDualLeftTextSlots(tpl.textSlots)
  }
  if (doc.templateId === 'planet_italic_dual_left') {
    return buildPlanetItalicDualLeftTextSlots(tpl.textSlots)
  }
  if (doc.templateId === 'cartoon_dual_top_left') {
    return buildCartoonDualTopLeftTextSlots(tpl.textSlots)
  }
  if (doc.templateId === 'classical_red_frame_left') {
    return buildClassicalRedFrameLeftTextSlots(tpl.textSlots)
  }
  if (doc.templateId === 'diplomatic_dual_bottom_center') {
    return buildDiplomaticDualBottomCenterTextSlots(tpl.textSlots)
  }
  if (doc.templateId === 'landscape_triple_center') {
    return buildLandscapeTripleCenterTextSlots(tpl.textSlots)
  }
  return [...tpl.textSlots]
}

/** templateStyle → 적용 슬롯 (생성 배경 분석 시만 AI 좌표·크기, 아니면 카탈로그) */
export function resolveTemplateTextSlots(
  templateId: string,
  styleSpec?: AnalyzedTemplateStyleSpec | null,
): TemplateTextSlotDef[] {
  const tpl = getProTemplate(templateId)
  if (!tpl) return []

  if (styleSpec?.layoutFromGeneratedBackground && styleSpec.textBlocks?.length) {
    const blocks = styleSpec.textBlocks
    return tpl.textSlots.map((cat, i) => {
      const block = blocks.find((b) => b.role === cat.slotKey) ?? blocks[i]
      if (!block) return { ...cat }
      return {
        ...blockToSlot(cat, block),
        xnAnchor: 'top-left' as const,
        ynAnchor: 'top-left' as const,
      }
    })
  }

  return catalogVisualTextSlotsForDocument({ templateId })
}

/** 배경 AI 재배치 전 — 카탈로그(미리보기 PNG) 좌표·스타일 그대로 */
export function usesCatalogTextLayout(doc: Pick<ThumbnailStudioDocument, 'templateStyle'>): boolean {
  return doc.templateStyle?.layoutFromGeneratedBackground !== true
}

export function catalogTextSlotsForDocument(
  doc: Pick<ThumbnailStudioDocument, 'templateId' | 'templateStyle'>,
): TemplateTextSlotDef[] {
  if (usesCatalogTextLayout(doc)) {
    return catalogVisualTextSlotsForDocument(doc)
  }
  return resolveTemplateTextSlots(doc.templateId, doc.templateStyle)
}

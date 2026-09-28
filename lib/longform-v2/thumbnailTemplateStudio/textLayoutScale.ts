import { measureTextLineWidth } from './textCanvasAnchor'
import { getProTemplate } from './catalog'
import { resolveTemplateTextSlots } from './templateTextSlots'
import { measureTextOuterBox } from './textGeometry'
import { STUDIO_CANVAS_W } from './types'
import { resolveTextLayersNoOverlap } from './textLayoutResolve'
import { reapplyCatalogTextStyles } from './catalogTextStyle'
import type { ThumbnailStudioDocument, TemplateTextSlotDef } from './types'
import type { TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'

const SIDE_MARGIN = 20
/** 썸네일에서 문구가 잘리지 않도록 허용하는 최소 글자 크기 */
export const THUMBNAIL_TEXT_MIN_FONT_PX = 22
/** 템플릿 AI 생성 시 기본 외곽선 두께 */
export const THUMBNAIL_GENERATED_STROKE_PX = 30
/** 가로 overflow 시에만 추가로 줄일 수 있는 하한 */
const THUMBNAIL_TEXT_ABS_MIN_FONT_PX = 16

export type ThumbnailTextLayoutOpts = {
  /** 템플릿 기반 썸네일 생성 — 큰 글씨 + 30px 외곽선 */
  generatedBoldStyle?: boolean
}

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(STUDIO_CANVAS_W, 720)
    return c.getContext('2d') as CanvasRenderingContext2D | null
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = STUDIO_CANVAS_W
    c.height = 720
    return c.getContext('2d')
  }
  return null
}

function slotSizeBoost(
  templateId: string,
  slotKey: string,
): { floorRatio: number; ceilingRatio: number; maxPx: number } {
  if (templateId === 'cosmic_dual_bottom') {
    switch (slotKey) {
      case 'main_title':
        return { floorRatio: 1.02, ceilingRatio: 1.2, maxPx: 148 }
      case 'hook':
        return { floorRatio: 1, ceilingRatio: 1.16, maxPx: 132 }
      default:
        return { floorRatio: 1, ceilingRatio: 1.15, maxPx: 130 }
    }
  }
  switch (slotKey) {
    case 'main_title':
      return { floorRatio: 1, ceilingRatio: 1.38, maxPx: 140 }
    case 'highlight':
      return { floorRatio: 1, ceilingRatio: 1.32, maxPx: 130 }
    case 'hook':
      return { floorRatio: 0.98, ceilingRatio: 1.28, maxPx: 120 }
    default:
      return { floorRatio: 0.98, ceilingRatio: 1.3, maxPx: 128 }
  }
}

/** 템플릿 미리보기 분석 레이아웃 유지 시에도 허용할 최대 글자 배율 */
function strictCatalogCeilingRatio(templateId: string): number {
  if (templateId === 'cosmic_dual_bottom') return 1.12
  return 1
}

/** 피사체 위치·정렬 기준으로 한 줄 텍스트가 쓸 수 있는 가로 폭(px) */
export function estimateAvailableTextWidthPx(
  slot: Pick<TemplateTextSlotDef, 'xn' | 'textAlign' | 'boxWidthPx'>,
  subjectZone: 'left' | 'right' | 'center' | 'full' | undefined,
  canvasW = STUDIO_CANVAS_W,
): number {
  if (slot.boxWidthPx && slot.boxWidthPx > 40) {
    return slot.boxWidthPx - SIDE_MARGIN
  }

  const xPx = slot.xn * canvasW
  const zone = subjectZone ?? 'right'

  if (slot.textAlign === 'center') {
    const half = Math.min(xPx - SIDE_MARGIN, canvasW - SIDE_MARGIN - xPx)
    return Math.max(120, half * 2 - SIDE_MARGIN)
  }
  if (slot.textAlign === 'right') {
    const leftBound = zone === 'left' ? canvasW * 0.38 : SIDE_MARGIN
    return Math.max(120, xPx - leftBound - SIDE_MARGIN)
  }

  let rightBound = canvasW - SIDE_MARGIN
  if (zone === 'right') rightBound = Math.min(rightBound, canvasW * 0.74)
  else if (zone === 'left') rightBound = canvasW - SIDE_MARGIN
  else if (zone === 'center') rightBound = canvasW * 0.94

  const physical = canvasW - SIDE_MARGIN - xPx
  const zoneLimited = rightBound - xPx - SIDE_MARGIN
  return Math.max(120, Math.min(physical, zoneLimited))
}

function textInkWidthWithStroke(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  fontFamily: string | undefined,
  catalogFontSize: number,
  catalogStrokeWidth: number,
): number {
  const ink = measureTextLineWidth(ctx, text, fontSize, fontFamily)
  const strokeRatio = fontSize / Math.max(catalogFontSize, 1)
  const stroke = Math.max(1, Math.round(catalogStrokeWidth * strokeRatio))
  return ink + stroke * 2 + 8
}

function fitFontSizeToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string | undefined,
  catalogFontSize: number,
  catalogStrokeWidth: number,
  floor: number,
  ceiling: number,
  maxW: number,
): number {
  let lo = Math.max(THUMBNAIL_TEXT_ABS_MIN_FONT_PX, floor)
  let hi = Math.max(ceiling, lo)
  let best = lo

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const totalW = textInkWidthWithStroke(
      ctx,
      text,
      mid,
      fontFamily,
      catalogFontSize,
      catalogStrokeWidth,
    )
    if (totalW <= maxW) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return best
}

/**
 * 템플릿 카탈로그 크기를 기본값으로, 공간이 허용하면 최대한 키움.
 */
export function maximizeTextLayersForThumbnail(
  doc: ThumbnailStudioDocument,
  layoutOpts?: ThumbnailTextLayoutOpts,
): TextItem[] {
  const ctx = getMeasureContext()
  const tpl = getProTemplate(doc.templateId)
  if (!ctx || !tpl) return doc.textLayers

  const generatedBold = layoutOpts?.generatedBoldStyle === true
  const slots = resolveTemplateTextSlots(doc.templateId, doc.templateStyle)
  const subjectZone = doc.templateStyle?.subjectZone

  return doc.textLayers.map((layer, i) => {
    const text = layer.text.trim()
    if (!text) return layer

    const slot = slots[i]
    const catalog = tpl.textSlots[i]
    if (!slot || !catalog) return layer

    const boost = slotSizeBoost(doc.templateId, catalog.slotKey)
    const maxW = estimateAvailableTextWidthPx(slot, subjectZone)
    const strictCatalog =
      !generatedBold &&
      doc.templateStyle?.layoutFromTemplatePreview === true &&
      doc.templateStyle?.layoutFromGeneratedBackground !== true
    const floor = strictCatalog
      ? THUMBNAIL_TEXT_MIN_FONT_PX
      : Math.max(THUMBNAIL_TEXT_MIN_FONT_PX, Math.round(catalog.fontSize * boost.floorRatio))
    const ceiling = strictCatalog
      ? Math.min(
          boost.maxPx,
          Math.round(catalog.fontSize * strictCatalogCeilingRatio(doc.templateId)),
        )
      : Math.min(boost.maxPx, Math.round(catalog.fontSize * boost.ceilingRatio))

    const fontSize = fitFontSizeToWidth(
      ctx,
      text,
      layer.fontFamily ?? slot.fontFamily,
      catalog.fontSize,
      generatedBold ? THUMBNAIL_GENERATED_STROKE_PX : catalog.strokeWidth,
      floor,
      ceiling,
      maxW,
    )

    const strokeRatio = fontSize / Math.max(catalog.fontSize, 1)
    const catalogStroke = generatedBold
      ? THUMBNAIL_GENERATED_STROKE_PX
      : Math.round(catalog.strokeWidth * strokeRatio)
    const useGeneratedStroke =
      generatedBold && !(catalog.boxBackground && catalog.strokeWidth === 0)

    return {
      ...layer,
      fontSize: generatedBold
        ? Math.max(fontSize, Math.round(catalog.fontSize * boost.floorRatio))
        : fontSize,
      strokeWidth: useGeneratedStroke
        ? THUMBNAIL_GENERATED_STROKE_PX
        : Math.max(layer.strokeWidth, catalogStroke),
    }
  })
}

function shouldUseGeneratedStrokeForSlot(
  catalog: TemplateTextSlotDef | undefined,
): boolean {
  if (!catalog) return true
  if (catalog.boxBackground && catalog.strokeWidth === 0) return false
  return true
}

/** 템플릿 생성 직후 — 카탈로그급 큰 글씨 + 30px 외곽선 */
export function applyGeneratedThumbnailTextBoldStyle(
  doc: ThumbnailStudioDocument,
): ThumbnailStudioDocument {
  const tpl = getProTemplate(doc.templateId)
  if (!tpl) return doc

  const textLayers = doc.textLayers.map((layer, i) => {
    if (!layer.text.trim()) return layer

    const catalog = tpl.textSlots[i]
    if (!catalog) {
      return {
        ...layer,
        fontSize: Math.max(layer.fontSize, 72),
        stroke: layer.stroke || '#000000',
        strokeWidth: THUMBNAIL_GENERATED_STROKE_PX,
      }
    }

    const boost = slotSizeBoost(doc.templateId, catalog.slotKey)
    const targetFont = Math.min(
      boost.maxPx,
      Math.max(layer.fontSize, Math.round(catalog.fontSize * boost.floorRatio)),
    )

    return {
      ...layer,
      fontSize: targetFont,
      stroke: layer.stroke || catalog.stroke || '#000000',
      strokeWidth: shouldUseGeneratedStrokeForSlot(catalog)
        ? THUMBNAIL_GENERATED_STROKE_PX
        : 0,
    }
  })

  return { ...doc, textLayers }
}

function minShrinkFontPxForLayer(
  catalog: TemplateTextSlotDef | undefined,
  templateId: string,
  generatedBold: boolean,
): number {
  if (!generatedBold || !catalog) return THUMBNAIL_TEXT_ABS_MIN_FONT_PX
  const boost = slotSizeBoost(templateId, catalog.slotKey)
  return Math.max(
    THUMBNAIL_TEXT_ABS_MIN_FONT_PX,
    Math.round(catalog.fontSize * boost.floorRatio * 0.88),
  )
}

/** 문구 길이·배경 구도에 맞춘 fontSize를 templateStyle·textLayers 양쪽에 반영 */
export function applyThumbnailTextSizing(
  doc: ThumbnailStudioDocument,
  layoutOpts?: ThumbnailTextLayoutOpts,
): ThumbnailStudioDocument {
  const boosted = maximizeTextLayersForThumbnail(doc, layoutOpts)
  const hasText = boosted.some((l) => l.text.trim())
  if (!hasText) return doc

  const tpl = getProTemplate(doc.templateId)
  let templateStyle = doc.templateStyle

  if (templateStyle?.textBlocks?.length) {
    templateStyle = {
      ...templateStyle,
      textBlocks: templateStyle.textBlocks.map((block, i) => {
        const layer = boosted[i]
        if (!layer?.text.trim()) return block
        return {
          ...block,
          fontSize: layer.fontSize,
          strokeWidth: layer.strokeWidth,
        }
      }),
    }
  } else if (tpl) {
    templateStyle = {
      templateId: doc.templateId,
      layoutSummary: templateStyle?.layoutSummary ?? '',
      backgroundPromptEn: templateStyle?.backgroundPromptEn ?? '',
      subjectZone: templateStyle?.subjectZone,
      colorPalette: templateStyle?.colorPalette,
      textBlocks: tpl.textSlots.map((cat, i) => {
        const layer = boosted[i]
        return {
          role: cat.slotKey,
          xn: cat.xn,
          yn: cat.yn,
          fontSize: layer?.fontSize ?? cat.fontSize,
          fill: cat.fill,
          stroke: cat.stroke,
          strokeWidth: layer?.strokeWidth ?? cat.strokeWidth,
          textAlign: cat.textAlign,
          zIndex: cat.zIndex,
          maxCharacters: cat.maxCharacters,
        }
      }),
      analyzedAt: Date.now(),
      layoutFromGeneratedBackground: templateStyle?.layoutFromGeneratedBackground,
    }
  }

  return { ...doc, templateStyle, textLayers: boosted }
}

function horizontalOverflowPx(
  ctx: CanvasRenderingContext2D,
  item: TextItem,
): { left: number; right: number } {
  const box = measureTextOuterBox(ctx, item)
  return {
    left: SIDE_MARGIN - box.left,
    right: box.right - (STUDIO_CANVAS_W - SIDE_MARGIN),
  }
}

/** stroke·배경 AI 좌표 오차로 잘린 가로 문구를 캔버스 안으로 맞춤 */
export function fitTextLayersHorizontallyInCanvas(
  doc: ThumbnailStudioDocument,
  layoutOpts?: ThumbnailTextLayoutOpts,
): ThumbnailStudioDocument {
  const ctx = getMeasureContext()
  if (!ctx) return doc

  const generatedBold = layoutOpts?.generatedBoldStyle === true
  const tpl = getProTemplate(doc.templateId)
  const items = [...doc.textLayers]

  for (let i = 0; i < items.length; i++) {
    const layer = items[i]
    if (!layer.text.trim()) continue

    let current = { ...layer }
    const catalog = tpl?.textSlots[i]
    const absMin = minShrinkFontPxForLayer(catalog, doc.templateId, generatedBold)

    for (let pass = 0; pass < 28; pass++) {
      let { left, right } = horizontalOverflowPx(ctx, current)
      if (left <= 0.5 && right <= 0.5) break

      let dx = 0
      if (right > 0) dx -= right
      if (left > 0) dx += left
      if (Math.abs(dx) > 0.5) {
        current = { ...current, x: current.x + dx }
        ;({ left, right } = horizontalOverflowPx(ctx, current))
        if (left <= 0.5 && right <= 0.5) break
      }

      if (current.fontSize <= absMin) break
      const nextSize = Math.max(absMin, current.fontSize - 2)
      const ratio = nextSize / Math.max(current.fontSize, 1)
      current = {
        ...current,
        fontSize: nextSize,
        strokeWidth: generatedBold
          ? shouldUseGeneratedStrokeForSlot(catalog)
            ? THUMBNAIL_GENERATED_STROKE_PX
            : 0
          : Math.max(1, Math.round(current.strokeWidth * ratio)),
      }
    }

    if (catalog) {
      const maxW = estimateAvailableTextWidthPx(
        resolveTemplateTextSlots(doc.templateId, doc.templateStyle)[i] ?? catalog,
        doc.templateStyle?.subjectZone,
      )
      const strokeForMeasure = generatedBold
        ? THUMBNAIL_GENERATED_STROKE_PX
        : catalog.strokeWidth
      if (
        textInkWidthWithStroke(
          ctx,
          current.text,
          current.fontSize,
          current.fontFamily,
          catalog.fontSize,
          strokeForMeasure,
        ) > maxW &&
        current.fontSize > absMin
      ) {
        const shrunk = fitFontSizeToWidth(
          ctx,
          current.text,
          current.fontFamily,
          catalog.fontSize,
          strokeForMeasure,
          absMin,
          current.fontSize,
          maxW,
        )
        if (shrunk < current.fontSize) {
          current = {
            ...current,
            fontSize: shrunk,
            strokeWidth: generatedBold
              ? shouldUseGeneratedStrokeForSlot(catalog)
                ? THUMBNAIL_GENERATED_STROKE_PX
                : 0
              : Math.max(1, Math.round(current.strokeWidth * (shrunk / Math.max(current.fontSize, 1)))),
          }
        }
      }
    }

    const { left, right } = horizontalOverflowPx(ctx, current)
    let dx = 0
    if (right > 0) dx -= right
    if (left > 0) dx += left
    if (Math.abs(dx) > 0.5) current = { ...current, x: current.x + dx }

    items[i] = current
  }

  return { ...doc, textLayers: items }
}

/** AI 문구 적용·내보내기 직전 — 가로·세로 모두 캔버스 안에 전체 문구가 들어가도록 */
export function ensureThumbnailCopyFullyVisible(
  doc: ThumbnailStudioDocument,
  layoutOpts?: ThumbnailTextLayoutOpts,
): ThumbnailStudioDocument {
  const generatedBold = layoutOpts?.generatedBoldStyle === true
  let out = applyThumbnailTextSizing(doc, layoutOpts)
  if (generatedBold) {
    out = applyGeneratedThumbnailTextBoldStyle(out)
  }
  out = resolveTextLayersNoOverlap(out)
  out = fitTextLayersHorizontallyInCanvas(out, layoutOpts)
  if (generatedBold) {
    out = applyGeneratedThumbnailTextBoldStyle(out)
  }
  return reapplyCatalogTextStyles(out, { preserveStrokeWidth: generatedBold })
}

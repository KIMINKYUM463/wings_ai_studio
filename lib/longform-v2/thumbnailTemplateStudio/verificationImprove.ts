import type { ThumbnailVerificationReport } from '@/lib/longform-v2/youtube/thumbnailVerification'
import type { ThumbnailVerifyImproveResult } from '@/lib/longform-v2/youtube/thumbnailVerificationImprove'
import { postThumbnailVerifyImprove } from '@/lib/longform-v2/thumbnail-bridge/thumbnailAiApi'
import { measureTextLineWidth, resolveSlotCanvasPivot } from './textCanvasAnchor'
import { applyTextStylePresetToItem } from './textStylePresets'
import {
  applySlotReplacementsToDocument,
  syncTextLayersFromTemplateStyle,
} from './document'
import { fitStudioTextLayoutToBackground } from './backgroundTextLayout'
import { getProTemplate } from './catalog'
import { resolveTemplateTextSlots } from './templateTextSlots'
import type { ThumbnailStudioDocument } from './types'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'

export function buildVerifyImproveSlotsFromDocument(doc: ThumbnailStudioDocument) {
  const tpl = getProTemplate(doc.templateId)
  if (!tpl) return []
  const slots = resolveTemplateTextSlots(doc.templateId, doc.templateStyle)
  return slots.map((slot, i) => ({
    slotKey: slot.slotKey,
    label: slot.label,
    currentText: (doc.textLayers[i]?.text ?? '').trim(),
    maxCharacters: slot.maxCharacters ?? 24,
    yn: slot.yn,
    fontSize: doc.textLayers[i]?.fontSize ?? slot.fontSize,
  }))
}

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(STUDIO_CANVAS_W, STUDIO_CANVAS_H)
    return c.getContext('2d') as CanvasRenderingContext2D | null
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = STUDIO_CANVAS_W
    c.height = STUDIO_CANVAS_H
    return c.getContext('2d')
  }
  return null
}

/** 검증 개선안을 문서에 반영 (문구 → 슬롯 좌표·스타일 → 배경 맞춤 배치) */
export function applyVerificationImproveToDocument(
  doc: ThumbnailStudioDocument,
  improve: ThumbnailVerifyImproveResult,
): ThumbnailStudioDocument {
  const tpl = getProTemplate(doc.templateId)
  if (!tpl) return doc

  let next = applySlotReplacementsToDocument(doc, improve.replacements)

  if (improve.slotAdjustments.length > 0 && doc.templateStyle?.textBlocks?.length) {
    const blocks = doc.templateStyle.textBlocks.map((b) => {
      const adj = improve.slotAdjustments.find((a) => a.slotKey === b.role)
      if (!adj) return b
      return {
        ...b,
        ...(adj.yn !== undefined ? { yn: adj.yn } : {}),
        ...(adj.fontSize !== undefined ? { fontSize: adj.fontSize } : {}),
      }
    })
    next = {
      ...next,
      templateStyle: { ...doc.templateStyle, textBlocks: blocks },
    }
  }

  next = syncTextLayersFromTemplateStyle(next)

  const measureCtx = getMeasureContext()
  const slotDefs = resolveTemplateTextSlots(next.templateId, next.templateStyle)
  next = {
    ...next,
    textLayers: next.textLayers.map((layer, i) => {
      const adj = improve.slotAdjustments.find((a) => a.slotKey === tpl.textSlots[i]?.slotKey)
      if (!adj) return layer
      let item = layer
      if (adj.stylePresetId) item = applyTextStylePresetToItem(item, adj.stylePresetId)
      const slot = slotDefs[i]
      if (!slot) return item
      const slotGeom = {
        ...slot,
        ...(adj.yn !== undefined ? { yn: adj.yn } : {}),
        ...(adj.fontSize !== undefined ? { fontSize: adj.fontSize } : {}),
      }
      const textWidthPx =
        measureCtx && item.text.trim()
          ? measureTextLineWidth(
              measureCtx,
              item.text,
              slotGeom.fontSize,
              slotGeom.fontFamily ?? item.fontFamily,
            )
          : undefined
      const { x, y } = resolveSlotCanvasPivot(slotGeom, { textWidthPx })
      return {
        ...item,
        x,
        y,
        fontSize: slotGeom.fontSize,
      }
    }),
  }

  return next
}

export async function improveStudioFromVerificationReport(opts: {
  document: ThumbnailStudioDocument
  report: ThumbnailVerificationReport
  topic: string
  script: string
  titleHint?: string
  outputLanguage?: string
}): Promise<{
  document: ThumbnailStudioDocument
  improve: ThumbnailVerifyImproveResult
  layoutNote?: string
}> {
  const slots = buildVerifyImproveSlotsFromDocument(opts.document)
  if (!slots.length) throw new Error('템플릿 슬롯을 찾을 수 없습니다.')

  const scriptBody = opts.script.trim() || opts.topic.trim()
  const improve = await postThumbnailVerifyImprove({
    templateId: opts.document.templateId,
    topic: opts.topic.trim() || opts.titleHint?.trim() || 'YouTube',
    scriptExcerpt: scriptBody,
    videoTitle: opts.titleHint?.trim() || undefined,
    outputLanguage: opts.outputLanguage ?? 'ko',
    report: opts.report,
    slots,
  })

  let doc = applyVerificationImproveToDocument(opts.document, improve)

  let layoutNote: string | undefined
  if (doc.background.imageDataUrl?.startsWith('data:')) {
    const fitted = await fitStudioTextLayoutToBackground(doc)
    doc = fitted.document
    layoutNote = fitted.note
  }

  return { document: doc, improve, layoutNote }
}

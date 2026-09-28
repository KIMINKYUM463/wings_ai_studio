import { postThumbnailTextRewrite } from '@/lib/longform-v2/thumbnail-bridge/thumbnailAiApi'
import type { ThumbnailTextRewritePresetId } from '@/lib/longform-v2/youtube/thumbnailTextRewrite'
import { getProTemplate } from './catalog'
import { getLinkedCopyPartner } from './copyLinkGroups'
import { syncTextLayersFromTemplateStyle } from './document'
import { tabOutputLanguageLabel } from './studioTabOutputLanguage'
import { catalogTextSlotsForDocument } from './templateTextSlots'
import { textHasVisibleContent } from './textTypography'
import type { TemplateTextSlotDef, ThumbnailStudioDocument } from './types'

function resolveTextSlotForLayer(
  doc: ThumbnailStudioDocument,
  layerIndex: number,
): TemplateTextSlotDef | undefined {
  const slots = catalogTextSlotsForDocument(doc)
  return slots[layerIndex] ?? getProTemplate(doc.templateId)?.textSlots[layerIndex]
}

export async function rewriteThumbnailTextLayer(opts: {
  document: ThumbnailStudioDocument
  textLayerId: string
  presetId: ThumbnailTextRewritePresetId
  customInstruction?: string
  topic?: string
  script?: string
  titleHint?: string
  outputLanguage?: string
}): Promise<ThumbnailStudioDocument> {
  const tpl = getProTemplate(opts.document.templateId)
  if (!tpl) throw new Error('템플릿을 찾을 수 없습니다.')

  const layerIndex = opts.document.textLayers.findIndex((t) => t.id === opts.textLayerId)
  if (layerIndex < 0) throw new Error('텍스트 레이어를 찾을 수 없습니다.')

  const layer = opts.document.textLayers[layerIndex]
  const slot = resolveTextSlotForLayer(opts.document, layerIndex)
  if (!slot) throw new Error('템플릿 슬롯을 찾을 수 없습니다.')

  const partner = getLinkedCopyPartner(opts.document.templateId, slot.slotKey, layerIndex)
  let linkedSlot: {
    slotKey: string
    slotLabel: string
    currentText: string
    maxCharacters: number
  } | undefined

  if (partner) {
    const partnerLayer = opts.document.textLayers[partner.slotIndex]
    const partnerDef = resolveTextSlotForLayer(opts.document, partner.slotIndex)
    if (partnerLayer && partnerDef) {
      linkedSlot = {
        slotKey: partnerDef.slotKey,
        slotLabel: partnerDef.label,
        currentText: partnerLayer.text,
        maxCharacters: partnerDef.maxCharacters,
      }
    }
  }

  const { text, linkedText } = await postThumbnailTextRewrite({
    slotKey: slot.slotKey,
    slotLabel: slot.label,
    currentText: layer.text,
    maxCharacters: slot.maxCharacters,
    presetId: opts.presetId,
    customInstruction: opts.customInstruction,
    topic: opts.topic,
    scriptExcerpt: opts.script,
    videoTitle: opts.titleHint,
    outputLanguage: opts.outputLanguage,
    linkedSlot,
  })

  const nextText = text.trim() || layer.text
  let textLayers = [...opts.document.textLayers]
  textLayers[layerIndex] = { ...textLayers[layerIndex], text: nextText }

  if (linkedText && partner) {
    const partnerLayer = textLayers[partner.slotIndex]
    if (partnerLayer) {
      textLayers[partner.slotIndex] = {
        ...partnerLayer,
        text: linkedText.trim() || partnerLayer.text,
      }
    }
  }

  return syncTextLayersFromTemplateStyle({ ...opts.document, textLayers })
}

function buildTranslateInstruction(outputLanguage: string): string {
  const lang = (outputLanguage || 'ko').trim() || 'ko'
  const langLabel = tabOutputLanguageLabel(lang)
  if (lang === 'ko') {
    return '현재 썸네일 문구를 한국어로 자연스럽게 다듬되, 의미·후킹·길이는 유지하세요.'
  }
  return [
    `현재 썸네일 문구를 ${langLabel}로 번역하세요.`,
    `반드시 ${langLabel}(${lang})로만 출력하세요.`,
    '한국어 원문을 그대로 두거나 한국어로 출력하면 안 됩니다.',
    '유튜브 썸네일 CTR 후킹·임팩트·대략적인 길이는 유지하세요.',
  ].join(' ')
}

/** 캔버스에 있는 문구를 선택 언어로 번역 (언어 적용 버튼) */
export async function translateStudioTextLayersToLanguage(opts: {
  document: ThumbnailStudioDocument
  outputLanguage: string
  topic?: string
  script?: string
  titleHint?: string
}): Promise<ThumbnailStudioDocument> {
  const lang = (opts.outputLanguage || 'ko').trim() || 'ko'
  const translateInstruction = buildTranslateInstruction(lang)
  const processed = new Set<string>()
  const textLayers = opts.document.textLayers.map((layer) => ({ ...layer }))
  let attempted = 0
  let succeeded = 0
  let lastError: unknown

  for (let i = 0; i < textLayers.length; i++) {
    const layer = textLayers[i]!
    if (!textHasVisibleContent(layer.text) || processed.has(layer.id)) continue

    const slot = resolveTextSlotForLayer(opts.document, i)
    const partner = slot ? getLinkedCopyPartner(opts.document.templateId, slot.slotKey, i) : undefined

    let linkedSlot:
      | {
          slotKey: string
          slotLabel: string
          currentText: string
          maxCharacters: number
        }
      | undefined

    if (partner && slot) {
      const partnerLayer = textLayers[partner.slotIndex]
      const partnerDef = resolveTextSlotForLayer(opts.document, partner.slotIndex)
      if (partnerLayer && partnerDef && textHasVisibleContent(partnerLayer.text)) {
        linkedSlot = {
          slotKey: partnerDef.slotKey,
          slotLabel: partnerDef.label,
          currentText: partnerLayer.text,
          maxCharacters: partnerDef.maxCharacters,
        }
      }
    }

    const originalText = layer.text
    attempted++
    try {
      const { text, linkedText } = await postThumbnailTextRewrite({
        slotKey: slot?.slotKey ?? `text_${i}`,
        slotLabel: slot?.label ?? `텍스트 ${i + 1}`,
        currentText: originalText,
        maxCharacters:
          slot?.maxCharacters ?? Math.max(Math.ceil(originalText.length * 1.4), 24),
        presetId: 'translate',
        customInstruction: translateInstruction,
        topic: opts.topic,
        scriptExcerpt: opts.script,
        videoTitle: opts.titleHint,
        outputLanguage: lang,
        linkedSlot,
      })

      const nextText = text.trim() || originalText
      textLayers[i] = { ...textLayers[i]!, text: nextText }
      if (text.trim()) succeeded++

      if (linkedText?.trim() && partner) {
        const partnerLayer = textLayers[partner.slotIndex]
        if (partnerLayer) {
          textLayers[partner.slotIndex] = {
            ...partnerLayer,
            text: linkedText.trim() || partnerLayer.text,
          }
          processed.add(partnerLayer.id)
        }
      }
    } catch (e) {
      lastError = e
      textLayers[i] = { ...textLayers[i]!, text: originalText }
    }

    processed.add(layer.id)
  }

  if (attempted > 0 && succeeded === 0) {
    throw lastError instanceof Error
      ? lastError
      : new Error('썸네일 문구 번역에 실패했습니다.')
  }

  return { ...opts.document, textLayers }
}

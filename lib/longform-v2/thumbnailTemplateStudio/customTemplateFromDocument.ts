import type { ThumbnailStudioDocument } from './types'
import { getProTemplate } from './catalog'
import {
  buildCustomTemplateFromParts,
  compressTemplatePreviewDataUrl,
  type StoredCustomThumbnailTemplate,
} from './customTemplateStorage'
import { resolveExportFrame } from './exportFrame'
import { textLayersToSlots } from './textItemToSlot'

export async function buildCustomTemplateFromDocument(opts: {
  doc: ThumbnailStudioDocument
  label: string
  description?: string
  tags?: string[]
  previewDataUrl?: string
  existingId?: string
}): Promise<StoredCustomThumbnailTemplate> {
  const baseTpl = getProTemplate(opts.doc.templateId)
  const slots = textLayersToSlots(opts.doc.textLayers)
  if (!slots.length) {
    throw new Error('저장할 문구 레이어가 없습니다. 텍스트를 추가한 뒤 다시 시도해 보세요.')
  }

  let previewImageUrl = opts.previewDataUrl
  if (previewImageUrl) {
    previewImageUrl = await compressTemplatePreviewDataUrl(previewImageUrl)
  }

  const exportFrame = resolveExportFrame(opts.doc) ?? baseTpl?.exportFrame

  return buildCustomTemplateFromParts({
    id: opts.existingId,
    label: opts.label,
    description: opts.description,
    tags: opts.tags ?? ['커스텀'],
    textSlots: slots,
    previewImageUrl,
    previewCss: baseTpl?.previewCss,
    exportFrame: exportFrame ?? undefined,
    basedOnTemplateId: baseTpl?.isCustom ? baseTpl.basedOnTemplateId : opts.doc.templateId,
    backgroundPromptTemplate: baseTpl?.backgroundPromptTemplate,
  })
}

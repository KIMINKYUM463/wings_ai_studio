import type { ThumbnailStudioDocument } from './types'

export const V2_TEMPLATE_GENERATED_NOTE =
  '대본 기반 장면 이미지와 템플릿 문구를 생성했습니다. 문구는 편집기에서 수정할 수 있습니다.'

/** v2 — AI가 채운 템플릿 문구를 캔버스에 표시합니다. */
export function applyV2TemplateDocument(
  doc: ThumbnailStudioDocument,
): ThumbnailStudioDocument {
  return {
    ...doc,
    textLayers: doc.textLayers.map((t) => ({
      ...t,
      visible: t.text.trim().length > 0,
    })),
  }
}

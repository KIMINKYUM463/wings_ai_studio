import { syncTextLayersFromTemplateStyle } from './document'
import { resolveTextLayersNoOverlap } from './textLayoutResolve'
import { ensureThumbnailCopyFullyVisible } from './textLayoutScale'
import { analyzeGeneratedBackgroundLayout } from './templateStyleAnalyze'
import type { ThumbnailStudioDocument } from './types'

/** 현재 배경 이미지(AI·업로드)를 비전 분석해 문구 위치·크기·색을 맞춤 */
export async function fitStudioTextLayoutToBackground(
  doc: ThumbnailStudioDocument,
): Promise<{ document: ThumbnailStudioDocument; note: string }> {
  const dataUrl = doc.background.imageDataUrl?.trim()
  if (!dataUrl) {
    return { document: doc, note: '배경 이미지가 없어 문구 배치를 분석할 수 없습니다.' }
  }

  const bgLayout = await analyzeGeneratedBackgroundLayout(doc.templateId, dataUrl)
  if (!bgLayout) {
    return {
      document: doc,
      note: '배경 분석에 실패했습니다. API 키·네트워크를 확인한 뒤 다시 시도해 주세요.',
    }
  }

  let next: ThumbnailStudioDocument = { ...doc, templateStyle: bgLayout }
  next = syncTextLayersFromTemplateStyle(next)
  next = resolveTextLayersNoOverlap(next)
  next = ensureThumbnailCopyFullyVisible(next)

  const summary = bgLayout.layoutSummary?.trim()
  return {
    document: next,
    note: summary
      ? `배경에 맞춰 AI가 문구 위치·크기를 배치했습니다. ${summary}`
      : '배경에 맞춰 AI가 문구 위치·크기를 배치했습니다.',
  }
}

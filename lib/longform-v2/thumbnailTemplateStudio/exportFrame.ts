import { getProTemplate } from './catalog'
import type { ThumbnailExportFrame, ThumbnailStudioDocument } from './types'

export function cloneExportFrameFromTemplate(templateId: string): ThumbnailExportFrame | undefined {
  const frame = getProTemplate(templateId)?.exportFrame
  return frame ? { ...frame } : undefined
}

/** 문서 오버라이드 → 없으면 카탈로그 기본 */
export function resolveExportFrame(doc: ThumbnailStudioDocument): ThumbnailExportFrame | null {
  if (doc.exportFrame) return doc.exportFrame
  return getProTemplate(doc.templateId)?.exportFrame ?? null
}

export function templateSupportsExportFrame(templateId: string): boolean {
  return !!getProTemplate(templateId)?.exportFrame
}

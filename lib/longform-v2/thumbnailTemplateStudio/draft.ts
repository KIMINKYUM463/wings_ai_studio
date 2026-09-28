import type { ThumbnailStudioDocument } from './types'
import { compressTemplatePreviewDataUrl } from './customTemplateStorage'

export type ThumbnailStudioDraftV1 = {
  v: 1
  document: ThumbnailStudioDocument
  updatedAt?: number
}

const KEY_PREFIX = 'wingsThumbnailStudioDraft:v1:'

function key(projectId: string): string {
  return `${KEY_PREFIX}${projectId}`
}

async function compressDocumentImages(doc: ThumbnailStudioDocument): Promise<ThumbnailStudioDocument> {
  let next = doc
  const bg = doc.background.imageDataUrl
  if (bg?.startsWith('data:')) {
    const compressed = await compressTemplatePreviewDataUrl(bg, 1280, 0.78)
    if (compressed !== bg) {
      next = { ...next, background: { ...next.background, imageDataUrl: compressed } }
    }
  }
  if (doc.imageLayers.length) {
    const layers = await Promise.all(
      doc.imageLayers.map(async (layer) => {
        if (!layer.imageDataUrl?.startsWith('data:')) return layer
        const compressed = await compressTemplatePreviewDataUrl(layer.imageDataUrl, 1280, 0.78)
        return compressed === layer.imageDataUrl ? layer : { ...layer, imageDataUrl: compressed }
      }),
    )
    next = { ...next, imageLayers: layers }
  }
  return next
}

export function loadThumbnailStudioDraft(projectId: string): ThumbnailStudioDraftV1 | null {
  try {
    const pid = projectId.trim()
    if (!pid) return null
    const raw = localStorage.getItem(key(pid))
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<ThumbnailStudioDraftV1>
    if (j.v !== 1 || !j.document || j.document.version !== 1) return null
    return { v: 1, document: j.document as ThumbnailStudioDocument, updatedAt: j.updatedAt }
  } catch {
    return null
  }
}

export async function saveThumbnailStudioDraft(
  projectId: string,
  draft: ThumbnailStudioDraftV1,
): Promise<void> {
  const pid = projectId.trim()
  if (!pid) return
  const payload: ThumbnailStudioDraftV1 = {
    v: 1,
    document: await compressDocumentImages(draft.document),
    updatedAt: draft.updatedAt ?? Date.now(),
  }
  try {
    localStorage.setItem(key(pid), JSON.stringify(payload))
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      try {
        const slim: ThumbnailStudioDraftV1 = {
          v: 1,
          updatedAt: payload.updatedAt,
          document: {
            ...payload.document,
            background: { ...payload.document.background, imageDataUrl: null },
            imageLayers: payload.document.imageLayers.map((l) => ({
              ...l,
              imageDataUrl: l.imageDataUrl?.startsWith('data:') ? '' : l.imageDataUrl,
            })),
          },
        }
        localStorage.setItem(key(pid), JSON.stringify(slim))
      } catch {
        /* localStorage 실패 — 서버 저장에 의존 */
      }
    }
  }
}

export function readLocalDraftUpdatedAt(projectId: string): number {
  const d = loadThumbnailStudioDraft(projectId)
  return d?.updatedAt ?? 0
}

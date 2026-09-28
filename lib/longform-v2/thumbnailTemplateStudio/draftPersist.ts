import { saveThumbnailStudioDraftRemote } from '@/lib/longform-v2/thumbnail-bridge/thumbnailStudioDraftApi'
import { saveThumbnailStudioDraft } from './draft'
import type { ThumbnailStudioDocument } from './types'

let remoteSaveChain: Promise<void> = Promise.resolve()

/** localStorage + 서버에 편집 초안 저장 (서버는 직렬화) */
export function persistStudioDocument(projectId: string, document: ThumbnailStudioDocument): void {
  const updatedAt = Date.now()
  const draft = { v: 1 as const, document, updatedAt }

  void saveThumbnailStudioDraft(projectId, draft)

  remoteSaveChain = remoteSaveChain.then(async () => {
    try {
      const saved = await saveThumbnailStudioDraftRemote(projectId, document)
      await saveThumbnailStudioDraft(projectId, {
        v: 1,
        document: saved.document,
        updatedAt: saved.updatedAt,
      })
    } catch {
      /* 오프라인·서버 미기동 — localStorage만 유지 */
    }
  })
}

export async function flushStudioDocumentPersist(projectId: string, document: ThumbnailStudioDocument): Promise<void> {
  const updatedAt = Date.now()
  await saveThumbnailStudioDraft(projectId, { v: 1, document, updatedAt })
  const saved = await saveThumbnailStudioDraftRemote(projectId, document)
  await saveThumbnailStudioDraft(projectId, {
    v: 1,
    document: saved.document,
    updatedAt: saved.updatedAt,
  })
}

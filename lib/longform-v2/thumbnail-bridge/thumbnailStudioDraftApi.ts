import type { ThumbnailStudioDocument } from "@/lib/longform-v2/thumbnailTemplateStudio/types"

export type ThumbnailStudioDraftPayload = {
  v: 1
  document: ThumbnailStudioDocument
  updatedAt: number
}

const KEY = (pid: string) => `lfv2:thumb-studio-draft:v1:${pid}`

export async function fetchThumbnailStudioDraft(
  projectId: string,
): Promise<ThumbnailStudioDraftPayload | null> {
  const pid = projectId.trim()
  if (!pid || typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(KEY(pid))
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<ThumbnailStudioDraftPayload>
    if (j.v !== 1 || !j.document || (j.document as { version?: number }).version !== 1) return null
    return {
      v: 1,
      document: j.document as ThumbnailStudioDocument,
      updatedAt: typeof j.updatedAt === "number" ? j.updatedAt : 0,
    }
  } catch {
    return null
  }
}

export async function saveThumbnailStudioDraftRemote(
  projectId: string,
  document: ThumbnailStudioDocument,
): Promise<ThumbnailStudioDraftPayload> {
  const pid = projectId.trim()
  if (!pid) throw new Error("projectId가 필요합니다.")
  const payload: ThumbnailStudioDraftPayload = {
    v: 1,
    document,
    updatedAt: Date.now(),
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(KEY(pid), JSON.stringify(payload))
  }
  return payload
}

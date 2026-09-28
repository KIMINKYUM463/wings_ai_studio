import type { ThumbnailStudioDocument } from "@/lib/longform-v2/thumbnailTemplateStudio/types"

export type ThumbnailStudioSavedWorkSource = "factory" | "manual" | "export"

export type ThumbnailStudioSavedWorkMeta = {
  id: string
  label: string
  templateId: string
  previewUrl: string
  createdAt: number
  source: ThumbnailStudioSavedWorkSource
}

type StoredWork = {
  meta: ThumbnailStudioSavedWorkMeta
  document: ThumbnailStudioDocument
}

const LIST_KEY = (pid: string) => `lfv2:thumb-studio-saved:v1:${pid}`

function readAll(pid: string): StoredWork[] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(LIST_KEY(pid))
    if (!raw) return []
    const j = JSON.parse(raw) as { works?: StoredWork[] }
    return Array.isArray(j.works) ? j.works : []
  } catch {
    return []
  }
}

function writeAll(pid: string, works: StoredWork[]) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(LIST_KEY(pid), JSON.stringify({ works }))
}

export async function fetchThumbnailStudioSavedWorks(
  projectId: string,
): Promise<ThumbnailStudioSavedWorkMeta[]> {
  const pid = projectId.trim()
  if (!pid) return []
  return readAll(pid).map((w) => w.meta)
}

export async function fetchThumbnailStudioSavedWorkDocument(
  projectId: string,
  workId: string,
): Promise<{ meta: ThumbnailStudioSavedWorkMeta; document: ThumbnailStudioDocument }> {
  const pid = projectId.trim()
  const wid = workId.trim()
  if (!pid || !wid) throw new Error("projectId·workId가 필요합니다.")
  const hit = readAll(pid).find((w) => w.meta.id === wid)
  if (!hit || (hit.document as { version?: number }).version !== 1) {
    throw new Error("저장된 작업 형식이 올바르지 않습니다.")
  }
  return { meta: hit.meta, document: hit.document }
}

export async function saveThumbnailStudioSavedWork(
  projectId: string,
  body: {
    label?: string
    templateId?: string
    source?: ThumbnailStudioSavedWorkSource
    document: ThumbnailStudioDocument
    previewBase64?: string
  },
): Promise<ThumbnailStudioSavedWorkMeta> {
  const pid = projectId.trim()
  if (!pid) throw new Error("projectId가 필요합니다.")
  const id = `sw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const previewUrl = body.previewBase64
    ? body.previewBase64.startsWith("data:")
      ? body.previewBase64
      : `data:image/jpeg;base64,${body.previewBase64}`
    : ""
  const meta: ThumbnailStudioSavedWorkMeta = {
    id,
    label: body.label?.trim() || "저장본",
    templateId: body.templateId || "custom",
    previewUrl,
    createdAt: Date.now(),
    source: body.source || "manual",
  }
  const works = readAll(pid)
  works.unshift({ meta, document: body.document })
  writeAll(pid, works.slice(0, 40))
  return meta
}

export async function deleteThumbnailStudioSavedWork(projectId: string, workId: string): Promise<void> {
  const pid = projectId.trim()
  const wid = workId.trim()
  if (!pid || !wid) throw new Error("projectId·workId가 필요합니다.")
  writeAll(
    pid,
    readAll(pid).filter((w) => w.meta.id !== wid),
  )
}

export function savedWorkSourceLabel(source: ThumbnailStudioSavedWorkSource): string {
  switch (source) {
    case "factory":
      return "자동화"
    case "export":
      return "프로젝트 저장"
    default:
      return "수동 저장"
  }
}

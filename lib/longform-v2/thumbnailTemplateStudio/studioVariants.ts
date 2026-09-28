import type { ThumbnailStudioDocument } from './types'

export type ThumbnailStudioVariant = {
  id: string
  label: string
  previewDataUrl: string
  document: ThumbnailStudioDocument
  createdAt: number
}

export const MAX_STUDIO_VARIANTS = 5

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `var-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function pushStudioVariant(
  list: ThumbnailStudioVariant[],
  entry: Omit<ThumbnailStudioVariant, 'id' | 'createdAt'> & { id?: string; createdAt?: number },
): ThumbnailStudioVariant[] {
  const next: ThumbnailStudioVariant = {
    id: entry.id ?? newId(),
    label: entry.label,
    previewDataUrl: entry.previewDataUrl,
    document: entry.document,
    createdAt: entry.createdAt ?? Date.now(),
  }
  const merged = [...list, next]
  if (merged.length <= MAX_STUDIO_VARIANTS) return merged
  return merged.slice(merged.length - MAX_STUDIO_VARIANTS)
}

export function nextVariantLabel(list: ThumbnailStudioVariant[]): string {
  return `후보 ${String.fromCharCode(65 + list.length)}`
}

import type { MvpThumbnailHookingText, MvpThumbnailVariant } from "@/lib/mvp-studio-types"

export function newThumbnailVariantId(): string {
  return `thumb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function selectedThumbnailVariant(
  gallery: readonly MvpThumbnailVariant[],
  selectedId: string | null | undefined
): MvpThumbnailVariant | null {
  if (!gallery.length) return null
  if (selectedId) {
    const hit = gallery.find((v) => v.id === selectedId)
    if (hit) return hit
  }
  return gallery[gallery.length - 1] ?? null
}

export function migrateThumbnailGallery(persist?: {
  thumbnailUrl?: string
  thumbnailHookingText?: MvpThumbnailHookingText
  thumbnailGallery?: MvpThumbnailVariant[]
  selectedThumbnailId?: string
}): { gallery: MvpThumbnailVariant[]; selectedId: string | null } {
  if (persist?.thumbnailGallery?.length) {
    const active = selectedThumbnailVariant(persist.thumbnailGallery, persist.selectedThumbnailId)
    return {
      gallery: [...persist.thumbnailGallery],
      selectedId: active?.id ?? persist.thumbnailGallery[0]!.id,
    }
  }
  if (persist?.thumbnailUrl?.trim()) {
    const id = newThumbnailVariantId()
    return {
      gallery: [
        {
          id,
          url: persist.thumbnailUrl.trim(),
          source: "ai",
          hookingText: persist.thumbnailHookingText,
          createdAt: Date.now(),
        },
      ],
      selectedId: id,
    }
  }
  return { gallery: [], selectedId: null }
}

export function appendThumbnailVariant(
  gallery: readonly MvpThumbnailVariant[],
  entry: {
    url: string
    source: MvpThumbnailVariant["source"]
    hookingText?: MvpThumbnailHookingText
    studioDesign?: MvpThumbnailVariant["studioDesign"]
  },
  maxItems = 24
): { gallery: MvpThumbnailVariant[]; selectedId: string } {
  const id = newThumbnailVariantId()
  const variant: MvpThumbnailVariant = {
    id,
    url: entry.url.trim(),
    source: entry.source,
    hookingText: entry.hookingText,
    studioDesign: entry.studioDesign,
    createdAt: Date.now(),
  }
  const next = [...gallery, variant]
  const trimmed = next.length > maxItems ? next.slice(-maxItems) : next
  return { gallery: trimmed, selectedId: id }
}

export function removeThumbnailVariant(
  gallery: readonly MvpThumbnailVariant[],
  id: string,
  selectedId: string | null
): { gallery: MvpThumbnailVariant[]; selectedId: string | null } {
  const next = gallery.filter((v) => v.id !== id)
  if (selectedId !== id) return { gallery: next, selectedId }
  return { gallery: next, selectedId: next[next.length - 1]?.id ?? null }
}

export function labelThumbnailSource(source: MvpThumbnailVariant["source"]): string {
  return source === "studio" ? "스튜디오" : "AI"
}

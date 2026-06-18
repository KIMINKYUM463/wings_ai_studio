import type { MvpStudioPersistData, MvpThumbnailHookingText, MvpThumbnailVariant } from "@/lib/mvp-studio-types"
import type { MvpThumbnailDesign } from "@/lib/mvp-thumbnail-design"

/** JSON.stringify 실패(대용량 data URL 등) 시 앱 크래시 방지 */
export function safeJsonKey(value: unknown): string | null {
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

export function normalizeMvpHookingText(
  hooking?: Partial<MvpThumbnailHookingText> | null
): MvpThumbnailHookingText {
  return {
    line1: hooking?.line1?.trim() ?? "",
    line2: hooking?.line2?.trim() ?? "",
  }
}

const MAX_PERSIST_URL_LEN = 280_000

function slimPersistUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  if (trimmed.length <= MAX_PERSIST_URL_LEN) return trimmed
  return ""
}

export function slimStudioDesignForPersist(design: MvpThumbnailDesign): MvpThumbnailDesign {
  return {
    ...design,
    backgroundUrl: slimPersistUrl(design.backgroundUrl),
    aiBackgroundHistory: undefined,
  }
}

export function slimThumbnailVariantForPersist(variant: MvpThumbnailVariant): MvpThumbnailVariant {
  const url = slimPersistUrl(variant.url)
  const studioDesign = variant.studioDesign
    ? slimStudioDesignForPersist(variant.studioDesign)
    : undefined
  return {
    ...variant,
    url,
    hookingText: variant.hookingText ? normalizeMvpHookingText(variant.hookingText) : undefined,
    studioDesign,
  }
}

export function slimThumbnailGalleryForPersist(
  gallery: readonly MvpThumbnailVariant[] | undefined
): MvpThumbnailVariant[] | undefined {
  if (!gallery?.length) return undefined
  const slimmed = gallery
    .map(slimThumbnailVariantForPersist)
    .filter((v) => v.url.startsWith("http") || v.url.startsWith("data:image/"))
  return slimmed.length ? slimmed : undefined
}

/** Supabase·로컬 persist — data URL·AI 배경 기록 제거 */
export function slimStudioPersistForSave(data: MvpStudioPersistData): MvpStudioPersistData {
  const gallery = slimThumbnailGalleryForPersist(data.thumbnailGallery)
  const active = gallery?.find((v) => v.id === data.selectedThumbnailId) ?? gallery?.[gallery.length - 1]
  const thumbnailUrl = active?.url || slimPersistUrl(data.thumbnailUrl ?? "")

  return {
    ...data,
    thumbnailHookingText: data.thumbnailHookingText
      ? normalizeMvpHookingText(data.thumbnailHookingText)
      : undefined,
    thumbnailGallery: gallery,
    thumbnailUrl: thumbnailUrl || undefined,
    selectedThumbnailId: active?.id ?? data.selectedThumbnailId,
  }
}

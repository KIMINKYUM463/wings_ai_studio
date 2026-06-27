import type { MvpStudioPersistData, MvpThumbnailHookingText, MvpThumbnailVariant } from "@/lib/mvp-studio-types"
import type { MvpThumbnailDesign } from "@/lib/mvp-thumbnail-design"
import {
  loadMvpThumbnail,
  saveMvpThumbnail,
} from "@/lib/mvp-local-media-cache"

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

/** Supabase JSONB에는 넣지 않고 IndexedDB 키만 저장 */
export const MVP_THUMBNAIL_IDB_PREFIX = "mvp-idb://"

export function mvpThumbnailIdbRef(variantId: string): string {
  return `${MVP_THUMBNAIL_IDB_PREFIX}${variantId}`
}

export function parseMvpThumbnailIdbRef(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed.startsWith(MVP_THUMBNAIL_IDB_PREFIX)) return null
  const id = trimmed.slice(MVP_THUMBNAIL_IDB_PREFIX.length).trim()
  return id || null
}

function shouldPersistThumbnailInIdb(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return true
  if (trimmed.startsWith(MVP_THUMBNAIL_IDB_PREFIX)) return false
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return false
  return (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.length > MAX_PERSIST_URL_LEN
  )
}

async function urlToThumbnailBlob(url: string): Promise<Blob | null> {
  const trimmed = url.trim()
  if (!trimmed || trimmed.startsWith(MVP_THUMBNAIL_IDB_PREFIX)) return null
  try {
    const res = await fetch(trimmed)
    const blob = await res.blob()
    return blob.size >= 512 ? blob : null
  } catch {
    return null
  }
}

/** 프로젝트 저장 전 — 썸네일 PNG를 IndexedDB에 기록 (실패해도 Supabase 저장은 계속) */
export async function cacheMvpThumbnailGalleryForSave(
  projectId: string,
  gallery: readonly MvpThumbnailVariant[] | undefined
): Promise<void> {
  if (!projectId || !gallery?.length) return
  await Promise.all(
    gallery.map(async (variant) => {
      const url = variant.url.trim()
      if (!shouldPersistThumbnailInIdb(url)) return
      try {
        const blob = await urlToThumbnailBlob(url)
        if (!blob) return
        await saveMvpThumbnail(projectId, variant.id, blob)
      } catch (e) {
        console.warn("[mvp-thumbnail-persist] cache thumbnail failed:", variant.id, e)
      }
    })
  )
}

/** 프로젝트 재오픈 — IndexedDB 썸네일을 blob URL로 복원 */
export async function hydrateMvpThumbnailGallery(
  projectId: string,
  gallery: readonly MvpThumbnailVariant[]
): Promise<MvpThumbnailVariant[]> {
  if (!projectId || !gallery.length) return [...gallery]

  const out: MvpThumbnailVariant[] = []
  for (const variant of gallery) {
    const url = variant.url.trim()
    const idbVariantId = parseMvpThumbnailIdbRef(url) ?? (shouldPersistThumbnailInIdb(url) ? variant.id : null)

    if (idbVariantId) {
      const blob = await loadMvpThumbnail(projectId, idbVariantId)
      if (blob) {
        out.push({ ...variant, url: URL.createObjectURL(blob) })
        continue
      }
    }

    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
      out.push(variant)
      continue
    }

    out.push(variant)
  }
  return out
}

function slimPersistUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  if (trimmed.startsWith(MVP_THUMBNAIL_IDB_PREFIX)) return trimmed
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
  const url = variant.url.trim()
  let persistUrl = url

  if (shouldPersistThumbnailInIdb(url)) {
    persistUrl = mvpThumbnailIdbRef(variant.id)
  } else {
    persistUrl = slimPersistUrl(url)
    if (!persistUrl && url) {
      persistUrl = mvpThumbnailIdbRef(variant.id)
    }
  }

  const studioDesign = variant.studioDesign
    ? slimStudioDesignForPersist(variant.studioDesign)
    : undefined
  return {
    ...variant,
    url: persistUrl,
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
    .filter(
      (v) =>
        v.url.startsWith("http") ||
        v.url.startsWith(MVP_THUMBNAIL_IDB_PREFIX) ||
        v.url.startsWith("data:image/")
    )
  return slimmed.length ? slimmed : undefined
}

/** Supabase·로컬 persist — 대용량 PNG는 IndexedDB 참조(mvp-idb://)만 저장 */
export function slimStudioPersistForSave(data: MvpStudioPersistData): MvpStudioPersistData {
  const gallery = slimThumbnailGalleryForPersist(data.thumbnailGallery)
  const active = gallery?.find((v) => v.id === data.selectedThumbnailId) ?? gallery?.[gallery.length - 1]
  const thumbnailUrl = active?.url || slimPersistUrl(data.thumbnailUrl ?? "")
  const resolvedThumbUrl =
    thumbnailUrl || (active?.id ? mvpThumbnailIdbRef(active.id) : undefined)

  return {
    ...data,
    thumbnailHookingText: data.thumbnailHookingText
      ? normalizeMvpHookingText(data.thumbnailHookingText)
      : undefined,
    thumbnailGallery: gallery,
    thumbnailUrl: resolvedThumbUrl || undefined,
    selectedThumbnailId: active?.id ?? data.selectedThumbnailId,
  }
}

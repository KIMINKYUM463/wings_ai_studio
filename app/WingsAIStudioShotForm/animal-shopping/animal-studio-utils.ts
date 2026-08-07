import type { AnimalCoupangProduct, AnimalShoppingBrief } from "./animal-studio-types"
import {
  cloneAnimalBrief,
  DEFAULT_ANIMAL_SUBTITLE_STYLE,
  joinSceneNarrations,
} from "./animal-studio-types"
import {
  createDefaultAnimalCharacter,
  type AnimalCharacter,
} from "./animal-character"
import type { ShoppingProjectData } from "./project-actions"

/** 정보/AI 쇼핑과 동일: 10~60초, 5초 단위 */
export function clampAnimalDuration(sec: number | undefined | null): number {
  const n = typeof sec === "number" && Number.isFinite(sec) ? sec : 30
  const stepped = Math.round(n / 5) * 5
  return Math.max(10, Math.min(60, stepped))
}

/** 쿠팡 CDN → 프록시 → data URL (nanobanana 레퍼런스용) */
export async function fetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null
  if (imageUrl.startsWith("data:image/")) return imageUrl
  try {
    const proxy = imageUrl.startsWith("http")
      ? `/api/shotform/image-proxy?url=${encodeURIComponent(imageUrl)}`
      : imageUrl
    const res = await fetch(proxy)
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith("image/")) return null
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("이미지 변환 실패"))
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export function buildProductDescriptionFromCoupang(
  product: AnimalCoupangProduct,
  characterName: string
): string {
  return [
    product.categoryName ? `쿠팡 카테고리: ${product.categoryName}` : "",
    product.isRocket ? "로켓배송 상품" : "",
    `${product.productPrice.toLocaleString("ko-KR")}원`,
    `${characterName}이(가) 쿠팡에서 고른 이 제품을 매장에서 실제로 활용·시연하는 숏폼`,
  ]
    .filter(Boolean)
    .join("\n")
}

export function productDisplayUrl(url?: string) {
  if (!url) return ""
  if (url.startsWith("data:")) return url
  if (url.startsWith("http")) {
    return `/api/shotform/image-proxy?url=${encodeURIComponent(url)}`
  }
  return url
}

/** 플랫 레거시 프로젝트 데이터 → brief */
export function briefFromProjectData(data?: ShoppingProjectData | null): AnimalShoppingBrief {
  const empty = cloneAnimalBrief()
  if (!data) return empty

  if (data.animalBrief) {
    const scenes = data.animalBrief.scenes || []
    return {
      ...empty,
      ...data.animalBrief,
      character: data.animalBrief.character || empty.character,
      videoDuration: clampAnimalDuration(data.animalBrief.videoDuration),
      products: data.animalBrief.products || [],
      scenes,
      script: data.animalBrief.script || joinSceneNarrations(scenes),
      imagePrompts: data.animalBrief.imagePrompts || [],
      imageUrls: data.animalBrief.imageUrls || [],
      videoUrls: data.animalBrief.videoUrls || [],
      showSubtitles: false,
      subtitleStyle: {
        ...DEFAULT_ANIMAL_SUBTITLE_STYLE,
        ...(data.animalBrief.subtitleStyle || {}),
      },
    }
  }

  const character: AnimalCharacter = data.animalCharacter || createDefaultAnimalCharacter()
  return {
    ...empty,
    character,
    videoDuration: clampAnimalDuration(data.videoDuration),
    searchQuery: data.coupangSearchQuery || "",
    selectedProduct: data.selectedCoupangProduct
      ? {
          productId: data.selectedCoupangProduct.productId,
          productName: data.selectedCoupangProduct.productName,
          productPrice: data.selectedCoupangProduct.productPrice,
          productImage: data.selectedCoupangProduct.productImage,
          productUrl: data.selectedCoupangProduct.productUrl,
          categoryName: data.selectedCoupangProduct.categoryName,
          isRocket: data.selectedCoupangProduct.isRocket,
        }
      : undefined,
    productName: data.productName || "",
    productDescription: data.productDescription || "",
    productImage: data.productImage,
    coupangUrl: data.coupangUrl,
    scenes: [],
    script: data.editedScript || data.script || "",
    selectedVoiceId: data.selectedVoiceId || empty.selectedVoiceId,
    selectedStyle: data.selectedSupertoneStyle || "neutral",
    ttsSpeed: data.ttsSpeed ?? 1,
    ttsAudioUrl: data.ttsAudioUrl || "",
    imagePrompts: data.imagePrompts || [],
    imageUrls: data.imageUrls || [],
    videoUrls: data.convertedVideoUrls || [],
    mergedVideoUrl: data.videoUrl,
    showSubtitles: false,
    subtitleStyle: {
      ...DEFAULT_ANIMAL_SUBTITLE_STYLE,
      ...(data.subtitleStyle
        ? {
            fontSize: data.subtitleStyle.fontSize,
            fontFamily: data.subtitleStyle.fontFamily,
            color: data.subtitleStyle.color,
            backgroundColor: data.subtitleStyle.backgroundColor,
            position: data.subtitleStyle.position,
            positionOffset: data.subtitleStyle.positionOffset ?? 0,
            textAlign: data.subtitleStyle.textAlign,
            fontWeight: data.subtitleStyle.fontWeight,
            textShadow: data.subtitleStyle.textShadow,
          }
        : {}),
    },
  }
}

export function flatFieldsFromBrief(brief: AnimalShoppingBrief): Partial<ShoppingProjectData> {
  return {
    animalCharacter: brief.character,
    productName: brief.productName,
    productDescription: brief.productDescription,
    productImage: brief.productImage,
    coupangUrl: brief.coupangUrl || brief.selectedProduct?.productUrl,
    selectedCoupangProduct: brief.selectedProduct
      ? {
          productId: brief.selectedProduct.productId,
          productName: brief.selectedProduct.productName,
          productPrice: brief.selectedProduct.productPrice,
          productImage: brief.selectedProduct.productImage,
          productUrl: brief.selectedProduct.productUrl,
          categoryName: brief.selectedProduct.categoryName,
          isRocket: brief.selectedProduct.isRocket,
        }
      : undefined,
    coupangSearchQuery: brief.searchQuery,
    videoDuration: clampAnimalDuration(brief.videoDuration),
    script: brief.script,
    editedScript: brief.script,
    selectedVoiceId: brief.selectedVoiceId,
    selectedSupertoneStyle: brief.selectedStyle,
    ttsAudioUrl: brief.ttsAudioUrl,
    ttsSpeed: brief.ttsSpeed,
    imageUrls: brief.imageUrls,
    imagePrompts: brief.imagePrompts,
    convertedVideoUrls: brief.videoUrls,
    videoUrl: brief.mergedVideoUrl,
    subtitleStyle: brief.subtitleStyle,
  }
}

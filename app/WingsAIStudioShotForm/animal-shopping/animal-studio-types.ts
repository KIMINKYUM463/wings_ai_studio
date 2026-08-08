import {
  createDefaultAnimalCharacter,
  resolveAnimalCharacter,
  type AnimalCharacter,
} from "./animal-character"

/** 목표 숏폼 길이(초) — 정보/AI 쇼핑과 같이 10~60 슬라이더 */
export type AnimalVideoDuration = number

/** 스토리 씬 타입 — 길이에 따라 travel/compare/delight 등이 추가됨 */
export type AnimalSceneType =
  | "problem"
  | "travel"
  | "store"
  | "compare"
  | "detail"
  | "buy"
  | "home"
  | "use"
  | "delight"

export type AnimalScene = {
  id: string
  order: number
  type: AnimalSceneType
  /** 짧은 씬 제목 (예: 문제 발생) */
  title: string
  /** 이 씬의 나레이션 대본 */
  narration: string
  imagePrompt?: string
  imageUrl?: string
  ttsAudioUrl?: string
  ttsDurationSec?: number
  videoUrl?: string
}

export const ANIMAL_SCENE_LABELS: Record<AnimalSceneType, string> = {
  problem: "문제·공감",
  travel: "이동·도착",
  store: "마트·발견",
  compare: "고민·비교",
  detail: "제품 확대",
  buy: "구매·결제",
  home: "귀가·준비",
  use: "활용·해결",
  delight: "만족·여운",
}

/** 영상 길이(초) → 씬 개수 (많을수록 컷이 많아 후킹에 유리, 3~8) */
export function suggestAnimalSceneCount(durationSec: number): number {
  const d = Math.max(10, Math.min(60, Math.round(durationSec) || 30))
  if (d <= 15) return 3
  if (d <= 25) return 4
  if (d <= 35) return 5
  if (d <= 45) return 6
  if (d <= 55) return 7
  return 8
}

/** 씬 개수별 스토리 아크 (항상 문제로 시작, 활용으로 끝, 중간에 제품 확대 1컷) */
export function getAnimalStoryArc(sceneCount: number): AnimalSceneType[] {
  const n = Math.max(3, Math.min(8, Math.round(sceneCount) || 3))
  const arcs: Record<number, AnimalSceneType[]> = {
    3: ["problem", "store", "use"],
    4: ["problem", "store", "detail", "use"],
    5: ["problem", "travel", "store", "detail", "use"],
    6: ["problem", "travel", "store", "detail", "buy", "use"],
    7: ["problem", "travel", "store", "compare", "detail", "buy", "use"],
    8: ["problem", "travel", "store", "compare", "detail", "buy", "home", "use"],
  }
  return arcs[n] || arcs[3]
}

/** 제품 확대샷으로 쓸 씬 인덱스 (detail 우선) */
export function pickAnimalProductCloseupIndex(
  scenes: Array<{ type: string }>
): number {
  const preferred = ["detail", "compare", "buy", "store"]
  for (const type of preferred) {
    const index = scenes.findIndex((scene) => scene.type === type)
    if (index >= 0) return index
  }
  return Math.min(1, Math.max(0, scenes.length - 1))
}

export type AnimalImagePrompt = {
  type: string
  prompt: string
  description: string
  scriptText: string
  /** 이미지 생성 시 비트 강제 (problem/travel은 마트·제품 금지) */
  sceneBeat?: AnimalSceneType | string
}

/** 제품 확대(클로즈업) 이미지 프롬프트 — 서버 액션 파일이 아닌 일반 유틸 */
export function buildProductCloseupImagePrompt(
  productName: string,
  character?: AnimalCharacter | null,
  hasProductRef?: boolean
): AnimalImagePrompt {
  const c = resolveAnimalCharacter(character)
  const refHint = hasProductRef
    ? "exact silhouette, colors, packaging and materials matching the product reference photo"
    : "clearly recognizable product shape and packaging"
  return {
    type: ANIMAL_SCENE_LABELS.detail,
    description: "제품 확대샷",
    scriptText: "",
    prompt: [
      `Product hero close-up of "${productName}" filling most of the vertical 9:16 frame.`,
      `Sharp focus on the product, ${refHint}.`,
      `Soft retail lighting, shallow depth of field, clean background blur.`,
      `Optional: only a tiny glimpse of ${c.visualPromptEn} paws at the very edge gently supporting the product — or product alone.`,
      `Photorealistic still photo. Exactly two paws if shown. No humans.`,
      `Absolutely no text, no subtitles, no captions, no Hangul, no letters, no lower-thirds, no speech bubbles.`,
    ].join(" "),
  }
}

export type AnimalCoupangProduct = {
  productId: string
  productName: string
  productPrice: number
  productImage: string
  productUrl: string
  categoryName?: string
  isRocket?: boolean
  rank?: number
}

export type AnimalSubtitleStyleBrief = {
  fontSize: number
  fontFamily: string
  color: string
  backgroundColor: string
  position: "top" | "center" | "bottom"
  positionOffset: number
  textAlign: "left" | "center" | "right"
  fontWeight: "normal" | "bold"
  textShadow: boolean
}

export type AnimalShoppingBrief = {
  character: AnimalCharacter
  videoDuration: AnimalVideoDuration
  searchQuery: string
  products: AnimalCoupangProduct[]
  selectedProduct?: AnimalCoupangProduct
  productName: string
  productDescription: string
  /** 제품 레퍼런스 — data URL 권장 */
  productImage?: string
  coupangUrl?: string
  /** 씬별 스토리 대본 (문제→마트→활용) */
  scenes: AnimalScene[]
  /** 전체 나레이션 합본 (호환·표시용) */
  script: string
  selectedVoiceId: string
  selectedStyle: string
  ttsSpeed: number
  /** 씬 TTS를 이어 붙인 전체 오디오 */
  ttsAudioUrl: string
  ttsDurationSec?: number
  imagePrompts: AnimalImagePrompt[]
  imageUrls: string[]
  videoUrls: Array<{ index: number; videoUrl: string }>
  mergedVideoUrl?: string
  /**
   * 영상 단계 클립 방식
   * - ai: Seedance 이미지→영상
   * - zoom: 정지 이미지 Ken Burns 줌인 (API 키·비용 없음)
   */
  videoClipMode?: "ai" | "zoom"
  /** 동물 숏폼은 자막 미사용 — 필드만 호환 유지 */
  subtitleStyle: AnimalSubtitleStyleBrief
  showSubtitles?: boolean
}

export const DEFAULT_ANIMAL_SUBTITLE_STYLE: AnimalSubtitleStyleBrief = {
  fontSize: 42,
  fontFamily: "Pretendard",
  color: "#FFFFFF",
  backgroundColor: "transparent",
  position: "bottom",
  positionOffset: 0,
  textAlign: "center",
  fontWeight: "bold",
  textShadow: true,
}

export const EMPTY_ANIMAL_BRIEF: AnimalShoppingBrief = {
  character: createDefaultAnimalCharacter(),
  videoDuration: 30,
  searchQuery: "",
  products: [],
  productName: "",
  productDescription: "",
  scenes: [],
  script: "",
  selectedVoiceId: "elevenlabs-jB1Cifc2UQbq1gR3wnb0",
  selectedStyle: "neutral",
  ttsSpeed: 1,
  ttsAudioUrl: "",
  imagePrompts: [],
  imageUrls: [],
  videoUrls: [],
  videoClipMode: "ai",
  subtitleStyle: { ...DEFAULT_ANIMAL_SUBTITLE_STYLE },
  showSubtitles: false,
}

export function cloneAnimalBrief(): AnimalShoppingBrief {
  const base = EMPTY_ANIMAL_BRIEF
  return {
    ...base,
    character: { ...createDefaultAnimalCharacter() },
    products: [],
    scenes: [],
    imagePrompts: [],
    imageUrls: [],
    videoUrls: [],
    videoClipMode: "ai",
    subtitleStyle: { ...DEFAULT_ANIMAL_SUBTITLE_STYLE },
    showSubtitles: false,
  }
}

export function joinSceneNarrations(scenes: AnimalScene[]): string {
  return scenes
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => s.narration.trim())
    .filter(Boolean)
    .join(" ")
}

export type ShoppingLinkLayout = "basic" | "cover-text" | "cover-profile" | "cover-emphasis"
export type ShoppingLinkAlign = "left" | "center"
export type ShoppingLinkFontSize = "small" | "medium" | "large"
export type ShoppingLinkCardStyle = "default" | "rounded" | "outline" | "fill"
export type ShoppingLinkTheme =
  | "clean-light"
  | "soft-rose"
  | "sky-pop"
  | "dark-chic"
  | "violet"
  | "image-type"

export type ShoppingLinkProfile = {
  slug: string
  displayName: string
  bio: string
  profileImageUrl: string | null
  coverImageUrl: string | null
  layout: ShoppingLinkLayout
  alignment: ShoppingLinkAlign
  profileFontSize: ShoppingLinkFontSize
  snsYoutube: string
  snsInstagram: string
  snsTiktok: string
  coupangPartnerId: string
}

export type ShoppingLinkBlock = {
  id: string
  type: "link" | "text"
  title: string
  url: string
  thumbnailUrl: string
  pinned: boolean
  enabled: boolean
  order: number
}

export type ShoppingLinkDesign = {
  theme: ShoppingLinkTheme
  backgroundType: "color" | "image"
  backgroundColor: string
  backgroundImageUrl: string | null
  fontFamily: string
  cardStyle: ShoppingLinkCardStyle
  autoTextColor: boolean
  textColor: string
  searchBarEnabled: boolean
  textSize: ShoppingLinkFontSize
  /** 폰 프레임(테두리 베젤) 표시 여부 */
  phoneFrameEnabled: boolean
  phoneBorderColor: string
  bannerImageUrl: string | null
  businessEmail: string
  topNoticeEnabled: boolean
  topNoticeText: string
  /** 상단 한줄 배경색 */
  topNoticeBackgroundColor: string
}

export type ShoppingLinkPageData = {
  profile: ShoppingLinkProfile
  blocks: ShoppingLinkBlock[]
  design: ShoppingLinkDesign
  updatedAt: string
}

export const SHOPPING_LINK_THEMES: Record<
  ShoppingLinkTheme,
  { label: string; bg: string; card: string; text: string; accent: string }
> = {
  "clean-light": { label: "Clean Light", bg: "#ffffff", card: "#f8fafc", text: "#0f172a", accent: "#f472b6" },
  "soft-rose": { label: "Soft Rose", bg: "#fff1f2", card: "#ffe4e6", text: "#881337", accent: "#fb7185" },
  "sky-pop": { label: "Sky Pop", bg: "#eff6ff", card: "#dbeafe", text: "#1e3a8a", accent: "#38bdf8" },
  "dark-chic": { label: "Dark Chic", bg: "#0f172a", card: "#1e293b", text: "#f8fafc", accent: "#94a3b8" },
  violet: { label: "Violet", bg: "#f5f3ff", card: "#ede9fe", text: "#4c1d95", accent: "#a78bfa" },
  "image-type": { label: "Image Type", bg: "#fafafa", card: "#ffffff", text: "#171717", accent: "#737373" },
}

export const SHOPPING_LINK_TOP_NOTICE_BG_SWATCHES = [
  "#38bdf8",
  "#0ea5e9",
  "#0284c7",
  "#0369a1",
  "#7dd3fc",
  "#1e3a8a",
  "#334155",
  "#f472b6",
]

/** 상단 한줄 기본 문구 (쿠팡 파트너스 고지) */
export const SHOPPING_LINK_DEFAULT_TOP_NOTICE =
  "쿠팡 파트너스 활동의 일환으로 이에 따른 일정액의 수수료를 제공받습니다."

export const SHOPPING_LINK_BG_SWATCHES = [
  "#ffffff",
  "#fff1f2",
  "#fef3c7",
  "#ecfccb",
  "#dbeafe",
  "#ede9fe",
  "#fce7f3",
  "#0f172a",
  "#18181b",
  "#f472b6",
]

/** 본문·제목 등 링크 페이지 글씨 색 (autoTextColor 꺼질 때 사용) */
export const SHOPPING_LINK_TEXT_COLOR_SWATCHES = [
  "#0f172a",
  "#171717",
  "#1e3a8a",
  "#4c1d95",
  "#881337",
  "#64748b",
  "#ffffff",
  "#f8fafc",
]

export function defaultShoppingLinkProfile(): ShoppingLinkProfile {
  return {
    slug: "",
    displayName: "",
    bio: "",
    profileImageUrl: null,
    coverImageUrl: null,
    layout: "basic",
    alignment: "center",
    profileFontSize: "medium",
    snsYoutube: "",
    snsInstagram: "",
    snsTiktok: "",
    coupangPartnerId: "",
  }
}

export function defaultShoppingLinkDesign(): ShoppingLinkDesign {
  return {
    theme: "clean-light",
    backgroundType: "color",
    backgroundColor: "#ffffff",
    backgroundImageUrl: null,
    fontFamily: "Pretendard",
    cardStyle: "default",
    autoTextColor: true,
    textColor: "#0f172a",
    searchBarEnabled: false,
    textSize: "medium",
    phoneFrameEnabled: true,
    phoneBorderColor: "#ffffff",
    bannerImageUrl: null,
    businessEmail: "",
    topNoticeEnabled: true,
    topNoticeText: SHOPPING_LINK_DEFAULT_TOP_NOTICE,
    topNoticeBackgroundColor: "#38bdf8",
  }
}

export function sanitizeShoppingLinkSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32)
}

export function shoppingLinkPublicPath(slug: string): string {
  return `/WingsAIStudioShotForm/shoppingshotform/shopping/${encodeURIComponent(slug)}`
}

export function shoppingLinkPublicUrl(slug: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "")
  return `${base}${shoppingLinkPublicPath(slug)}`
}

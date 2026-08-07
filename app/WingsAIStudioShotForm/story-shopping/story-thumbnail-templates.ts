import {
  createThumbnailDesign,
  type MvpThumbnailDesign,
  type ThumbnailTextLayer,
  type ThumbnailTemplate,
} from "@/lib/mvp-thumbnail-design"
import type { MvpThumbnailHookingText } from "@/lib/mvp-studio-types"

export const STORY_THUMBNAIL_TEMPLATE_IDS = [
  "story-dark-yellow",
  "story-black-impact",
  "story-full-cyan",
  "story-invention-news",
  "story-glass-search",
  "story-black-green",
  "story-blur-poster",
] as const

export type StoryThumbnailTemplateId =
  (typeof STORY_THUMBNAIL_TEMPLATE_IDS)[number]

const STORY_TEMPLATE_ID_SET = new Set<string>(STORY_THUMBNAIL_TEMPLATE_IDS)

export type StoryThumbnailChrome = {
  headerHeightPct: number
  headerBackground: string
  subtitleTopPct: number
  subtitleHeightPct: number
  subtitleBackground: string
  subtitleInsetPct?: number
  subtitleRadius?: number
  footerHeightPct?: number
  footerBackground?: string
  dividerColor?: string
  searchDecoration?: boolean
  backgroundMode?: "standard" | "blurred-poster"
  foregroundTopPct?: number
}

export const STORY_THUMBNAIL_CHROME: Record<
  StoryThumbnailTemplateId,
  StoryThumbnailChrome
> = {
  "story-dark-yellow": {
    headerHeightPct: 23,
    headerBackground:
      "linear-gradient(180deg,rgba(46,45,39,.98),rgba(54,52,46,.98))",
    subtitleTopPct: 23,
    subtitleHeightPct: 7,
    subtitleBackground: "rgba(255,255,255,.98)",
    footerHeightPct: 7,
    footerBackground: "#3f3f3f",
    dividerColor: "#f59e0b",
  },
  "story-black-impact": {
    headerHeightPct: 24,
    headerBackground:
      "linear-gradient(180deg,rgba(23,20,16,.98),rgba(47,39,29,.98))",
    subtitleTopPct: 24,
    subtitleHeightPct: 7,
    subtitleBackground: "rgba(245,245,244,.98)",
    footerHeightPct: 6,
    footerBackground: "#292524",
    dividerColor: "#fbbf24",
  },
  "story-full-cyan": {
    headerHeightPct: 21,
    headerBackground:
      "linear-gradient(180deg,rgba(13,31,58,.99),rgba(17,45,76,.98))",
    subtitleTopPct: 22.5,
    subtitleHeightPct: 6.5,
    subtitleBackground: "rgba(255,255,255,.96)",
    subtitleInsetPct: 5,
    subtitleRadius: 5,
    footerHeightPct: 3,
    footerBackground: "#0f172a",
    dividerColor: "#38bdf8",
  },
  "story-invention-news": {
    headerHeightPct: 21,
    headerBackground:
      "linear-gradient(180deg,rgba(5,5,5,.99),rgba(18,18,18,.99))",
    subtitleTopPct: 21,
    subtitleHeightPct: 7,
    subtitleBackground: "rgba(255,255,255,.98)",
    footerHeightPct: 5,
    footerBackground: "#111827",
    dividerColor: "#22d3ee",
  },
  "story-glass-search": {
    headerHeightPct: 23,
    headerBackground:
      "linear-gradient(135deg,rgba(43,91,87,.98),rgba(30,64,75,.98))",
    subtitleTopPct: 23,
    subtitleHeightPct: 7,
    subtitleBackground: "rgba(255,255,255,.95)",
    footerHeightPct: 4,
    footerBackground: "#163a3c",
    dividerColor: "#5eead4",
    searchDecoration: true,
  },
  "story-black-green": {
    headerHeightPct: 20,
    headerBackground:
      "linear-gradient(180deg,rgba(2,2,2,.99),rgba(12,12,12,.99))",
    subtitleTopPct: 20,
    subtitleHeightPct: 7,
    subtitleBackground: "rgba(250,250,249,.98)",
    footerHeightPct: 5,
    footerBackground: "#171717",
    dividerColor: "#a3e635",
  },
  "story-blur-poster": {
    headerHeightPct: 23,
    headerBackground:
      "linear-gradient(180deg,rgba(17,24,39,.34),rgba(39,39,42,.18))",
    subtitleTopPct: 24.5,
    subtitleHeightPct: 7,
    subtitleBackground: "rgba(255,255,255,.96)",
    subtitleInsetPct: 8,
    subtitleRadius: 0,
    dividerColor: "rgba(24,24,27,.58)",
    backgroundMode: "blurred-poster",
    foregroundTopPct: 31,
  },
}

export const STORY_THUMBNAIL_TEMPLATES: ThumbnailTemplate[] = [
  {
    id: "story-dark-yellow",
    label: "푸드 바이럴형",
    description: "푸드·트렌드 레퍼런스 · 진회색 제목판 · 주황 강조",
    preview: "linear-gradient(180deg,#35342f 0%,#35342f 23%,#fff 23%,#fff 30%,#b45309 30%,#78350f 93%,#3f3f46 93%)",
    sampleHook1: "뻘짓 했다는",
    sampleHook2: "한국 프랜차이즈?",
    filter: { gradientTop: false, contrast: 110, saturate: 108 },
    texts: [
      { role: "hook1", x: 50, y: 7.5, fontSize: 29, fontWeight: 900, color: "#ffffff", align: "center", widthPct: 92, bgOn: false, strokeOn: true, strokeColor: "#171717", strokeWidth: 2, shadow: true },
      { role: "hook2", x: 50, y: 16, fontSize: 31, fontWeight: 900, color: "#facc15", align: "center", widthPct: 92, bgOn: false, strokeOn: true, strokeColor: "#171717", strokeWidth: 2, shadow: true },
      { role: "badge", text: "알고 나면 놀라는 핵심 이유", x: 50, y: 26.5, fontSize: 15, fontWeight: 800, color: "#1c1917", align: "center", widthPct: 92, bgOn: false, strokeOn: false, shadow: false },
    ],
    elements: [],
  },
  {
    id: "story-black-impact",
    label: "골드 호기심형",
    description: "기계·호기심 레퍼런스 · 웜블랙 제목판 · 노랑 핵심어",
    preview: "linear-gradient(180deg,#1c1917 0%,#292117 24%,#f5f5f4 24%,#f5f5f4 31%,#92400e 31%,#292524 94%)",
    sampleHook1: "400개월이 환장하는",
    sampleHook2: "도시락 통",
    filter: { gradientTop: false, brightness: 96, contrast: 112, saturate: 104 },
    texts: [
      { role: "hook1", x: 50, y: 8, fontSize: 29, fontWeight: 900, color: "#ffffff", align: "center", widthPct: 92, bgOn: false, strokeOn: true, strokeColor: "#000000", strokeWidth: 2, shadow: true },
      { role: "hook2", x: 50, y: 17, fontSize: 31, fontWeight: 900, color: "#fde047", align: "center", widthPct: 92, bgOn: false, strokeOn: true, strokeColor: "#000000", strokeWidth: 2, shadow: true },
      { role: "badge", text: "끝까지 보면 이유를 알게 됩니다", x: 50, y: 27.5, fontSize: 15, fontWeight: 800, color: "#292524", align: "center", widthPct: 92, bgOn: false, strokeOn: false, shadow: false },
    ],
    elements: [],
  },
  {
    id: "story-full-cyan",
    label: "네이비 카드형",
    description: "간식 채널 레퍼런스 · 네이비 제목판 · 플로팅 설명 카드",
    preview: "linear-gradient(180deg,#0d1f3a 0%,#112d4c 21%,#64748b 21%,#64748b 22.5%,#fff 22.5%,#fff 29%,#475569 29%,#0f172a 97%)",
    sampleHook1: "할아버지를 구한",
    sampleHook2: "소녀의 반전 발명품",
    filter: { gradientTop: false, contrast: 112, saturate: 108 },
    texts: [
      { role: "hook1", x: 50, y: 6.8, fontSize: 28, fontWeight: 900, color: "#ffffff", align: "center", widthPct: 92, bgOn: false, strokeOn: true, strokeColor: "#020617", strokeWidth: 2, shadow: true },
      { role: "hook2", x: 50, y: 15, fontSize: 30, fontWeight: 900, color: "#38bdf8", align: "center", widthPct: 92, bgOn: false, strokeOn: true, strokeColor: "#020617", strokeWidth: 2, shadow: true },
      { role: "badge", text: "이렇게 쓰는 사람은 처음입니다", x: 50, y: 25.75, fontSize: 15, fontWeight: 800, color: "#0f172a", align: "center", widthPct: 84, bgOn: false, strokeOn: false, shadow: false },
    ],
    elements: [],
  },
  {
    id: "story-invention-news",
    label: "발명품 뉴스형",
    description: "발명품 채널 레퍼런스 · 블랙 뉴스판 · 청록 핵심어",
    preview: "linear-gradient(180deg,#050505 0%,#121212 21%,#fff 21%,#fff 28%,#94a3b8 28%,#111827 95%)",
    sampleHook1: "구조 하나로 떼돈 번",
    sampleHook2: "일본 천재의 발명품",
    filter: { gradientTop: false, contrast: 114, saturate: 105 },
    texts: [
      { role: "hook1", x: 50, y: 6.7, fontSize: 28, fontWeight: 900, color: "#ffffff", align: "center", widthPct: 94, bgOn: false, strokeOn: true, strokeColor: "#000000", strokeWidth: 2, shadow: true },
      { role: "hook2", x: 50, y: 15, fontSize: 30, fontWeight: 900, color: "#22d3ee", align: "center", widthPct: 94, bgOn: false, strokeOn: true, strokeColor: "#000000", strokeWidth: 2, shadow: true },
      { role: "badge", text: "사소한 아이디어가 세상을 바꾼 이유", x: 50, y: 24.5, fontSize: 15, fontWeight: 800, color: "#111827", align: "center", widthPct: 94, bgOn: false, strokeOn: false, shadow: false },
    ],
    elements: [],
  },
  {
    id: "story-glass-search",
    label: "글래스 검색형",
    description: "정보형 확장 · 틸 글래스 제목판 · 민트 강조 · 검색 장식",
    preview: "linear-gradient(180deg,#2b5b57 0%,#1e404b 23%,#fff 23%,#fff 30%,#64748b 30%,#163a3c 96%)",
    sampleHook1: "부모들 지갑 여는",
    sampleHook2: "뜻밖의 장난감?",
    filter: { gradientTop: false, brightness: 96, contrast: 110, saturate: 92 },
    texts: [
      { role: "hook1", x: 50, y: 7.5, fontSize: 28, fontWeight: 900, color: "#ffffff", align: "center", widthPct: 84, bgOn: false, strokeOn: true, strokeColor: "#163a3c", strokeWidth: 2, shadow: true },
      { role: "hook2", x: 50, y: 16, fontSize: 30, fontWeight: 900, color: "#5eead4", align: "center", widthPct: 88, bgOn: false, strokeOn: true, strokeColor: "#163a3c", strokeWidth: 2, shadow: true },
      { role: "badge", text: "오늘의 호기심 검색", x: 50, y: 26.5, fontSize: 15, fontWeight: 800, color: "#134e4a", align: "center", widthPct: 88, bgOn: false, strokeOn: false, shadow: false },
    ],
    elements: [],
  },
  {
    id: "story-black-green",
    label: "블랙 라임형",
    description: "블랙·형광 레퍼런스 · 짧은 제목판 · 큰 이미지",
    preview: "linear-gradient(180deg,#020202 0%,#0c0c0c 20%,#fafaf9 20%,#fafaf9 27%,#78716c 27%,#171717 95%)",
    sampleHook1: "참전용사가 만든",
    sampleHook2: "뜻밖의 치즈젤리",
    filter: { gradientTop: false, contrast: 112, saturate: 106 },
    texts: [
      { role: "hook1", x: 50, y: 6.2, fontSize: 28, fontWeight: 900, color: "#ffffff", align: "center", widthPct: 94, bgOn: false, strokeOn: true, strokeColor: "#000000", strokeWidth: 2, shadow: true },
      { role: "hook2", x: 50, y: 14.2, fontSize: 30, fontWeight: 900, color: "#a3e635", align: "center", widthPct: 94, bgOn: false, strokeOn: true, strokeColor: "#000000", strokeWidth: 2, shadow: true },
      { role: "badge", text: "고정관념을 뒤집은 진짜 이유", x: 50, y: 23.5, fontSize: 15, fontWeight: 800, color: "#171717", align: "center", widthPct: 94, bgOn: false, strokeOn: false, shadow: false },
    ],
    elements: [],
  },
  {
    id: "story-blur-poster",
    label: "블러 포스터형",
    description: "사진을 흐린 전체 배경으로 깔고 선명한 제품을 전경에 배치",
    preview: "linear-gradient(180deg,#1e3a5f 0%,#9ca3af 4%,#a1a1aa 24%,#fff 24%,#fff 31%,#737373 31%,#a3a3a3 100%)",
    sampleHook1: "인디언밥의",
    sampleHook2: "소름 돋는 근황",
    filter: {
      gradientTop: false,
      brightness: 82,
      contrast: 92,
      saturate: 72,
      blur: 7,
    },
    texts: [
      { role: "hook1", x: 50, y: 7, fontSize: 28, fontWeight: 900, color: "#ffffff", align: "center", widthPct: 90, bgOn: false, strokeOn: true, strokeColor: "#09090b", strokeWidth: 3, shadow: true },
      { role: "hook2", x: 50, y: 15, fontSize: 30, fontWeight: 900, color: "#22d3ee", align: "center", widthPct: 92, bgOn: false, strokeOn: true, strokeColor: "#09090b", strokeWidth: 3, shadow: true },
      { role: "badge", text: "알고 보면 더 놀라운 진짜 이유", x: 50, y: 28, fontSize: 15, fontWeight: 800, color: "#18181b", align: "center", widthPct: 80, bgOn: false, strokeOn: false, shadow: false },
    ],
    elements: [],
  },
]

export function isStoryThumbnailTemplateId(
  value: string
): value is StoryThumbnailTemplateId {
  return STORY_TEMPLATE_ID_SET.has(value)
}

function compactThumbnailText(value: string, maxLength: number): string {
  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/[!?。！？]+$/g, "")
    .trim()
  if (normalized.length <= maxLength) return normalized

  const words = normalized.split(" ")
  let result = ""
  for (const word of words) {
    const next = result ? `${result} ${word}` : word
    if (next.length > maxLength) break
    result = next
  }
  return result || normalized.slice(0, maxLength).trim()
}

export function fitStoryHeadlineFontSize(text: string): number {
  const visualLength = Array.from(text).reduce(
    (total, character) => total + (character === " " ? 0.5 : 1),
    0
  )
  if (visualLength <= 0) return 44
  return Math.max(30, Math.min(44, Math.floor(390 / visualLength)))
}

export function createStoryThumbnailDesign({
  templateId,
  backgroundUrl,
  hookingText,
  subheadline,
}: {
  templateId: StoryThumbnailTemplateId
  backgroundUrl: string
  hookingText: MvpThumbnailHookingText
  subheadline: string
}): MvpThumbnailDesign {
  const template =
    STORY_THUMBNAIL_TEMPLATES.find((item) => item.id === templateId) ||
    STORY_THUMBNAIL_TEMPLATES[0]!
  const base = createThumbnailDesign(backgroundUrl, hookingText)
  const sourceByRole = new Map(
    base.texts.map((text) => [text.role, text] as const)
  )
  const fallback = base.texts[0]!
  const texts = template.texts.map((spec, index) => {
    const source = sourceByRole.get(spec.role) || fallback
    const text =
      spec.role === "hook1"
        ? compactThumbnailText(hookingText.line1, 14)
        : spec.role === "hook2"
          ? compactThumbnailText(hookingText.line2, 14)
          : compactThumbnailText(subheadline.trim() || spec.text || "", 24)
    return {
      ...source,
      ...spec,
      id: `story_tpl_${templateId}_${index}`,
      role: spec.role,
      text,
      fontSize:
        spec.role === "hook1" || spec.role === "hook2"
          ? fitStoryHeadlineFontSize(text)
          : spec.fontSize,
      strokeWidth:
        spec.role === "hook1" || spec.role === "hook2"
          ? 18
          : spec.strokeWidth,
    } as ThumbnailTextLayer
  })

  return {
    ...base,
    templateId,
    filter: { ...base.filter, ...template.filter, brightness: 66 },
    texts,
    elements: [],
  }
}

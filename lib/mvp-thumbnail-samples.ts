import type { MvpThumbnailHookingText } from "@/lib/mvp-studio-types"
import {
  applyThumbnailTemplate,
  createThumbnailDesign,
  setThumbnailBackground,
  type MvpThumbnailDesign,
} from "@/lib/mvp-thumbnail-design"

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function sampleSceneSvg(opts: {
  top: string
  bottom: string
  accent: string
  product: string
  label?: string
}): string {
  const { top, bottom, accent, product, label = "" } = opts
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 640" width="360" height="640">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="${top}"/>
      <stop offset="100%" stop-color="${bottom}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="72%" r="45%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="360" height="640" fill="url(#bg)"/>
  <rect width="360" height="200" fill="#000" opacity="0.25"/>
  <ellipse cx="180" cy="430" rx="130" ry="90" fill="url(#glow)"/>
  <rect x="95" y="340" width="170" height="200" rx="24" fill="${product}" opacity="0.92"/>
  <rect x="115" y="365" width="130" height="18" rx="9" fill="#fff" opacity="0.25"/>
  <rect x="115" y="395" width="90" height="12" rx="6" fill="#fff" opacity="0.18"/>
  <circle cx="180" cy="455" r="36" fill="#fff" opacity="0.12"/>
  ${label ? `<text x="180" y="580" text-anchor="middle" fill="#fff" opacity="0.35" font-size="11" font-family="system-ui,sans-serif">${label}</text>` : ""}
</svg>`
}

export type ThumbnailSampleBackground = {
  id: string
  label: string
  description: string
  url: string
}

export const THUMBNAIL_SAMPLE_BACKGROUNDS: ThumbnailSampleBackground[] = [
  {
    id: "kitchen-warm",
    label: "주방 웜톤",
    description: "주방·생활용품 쇼츠",
    url: svgDataUrl(
      sampleSceneSvg({
        top: "#3d2c1e",
        bottom: "#1a120c",
        accent: "#f59e0b",
        product: "#78716c",
        label: "SAMPLE · KITCHEN",
      })
    ),
  },
  {
    id: "beauty-rose",
    label: "뷰티 로즈",
    description: "화장품·뷰티 제품",
    url: svgDataUrl(
      sampleSceneSvg({
        top: "#4a1942",
        bottom: "#1a0a18",
        accent: "#f472b6",
        product: "#9d174d",
        label: "SAMPLE · BEAUTY",
      })
    ),
  },
  {
    id: "tech-cyan",
    label: "테크 시안",
    description: "가전·디지털 기기",
    url: svgDataUrl(
      sampleSceneSvg({
        top: "#0c4a6e",
        bottom: "#082f49",
        accent: "#22d3ee",
        product: "#334155",
        label: "SAMPLE · TECH",
      })
    ),
  },
  {
    id: "outdoor-green",
    label: "아웃도어",
    description: "캠핑·야외용품",
    url: svgDataUrl(
      sampleSceneSvg({
        top: "#14532d",
        bottom: "#052e16",
        accent: "#4ade80",
        product: "#365314",
        label: "SAMPLE · OUTDOOR",
      })
    ),
  },
  {
    id: "clean-white",
    label: "클린 화이트",
    description: "미니멀·밝은 톤",
    url: svgDataUrl(
      sampleSceneSvg({
        top: "#e2e8f0",
        bottom: "#94a3b8",
        accent: "#ffffff",
        product: "#cbd5e1",
        label: "SAMPLE · CLEAN",
      })
    ),
  },
  {
    id: "night-luxury",
    label: "나이트 럭셔리",
    description: "프리미엄·고가 제품",
    url: svgDataUrl(
      sampleSceneSvg({
        top: "#1e1b4b",
        bottom: "#0f0a1a",
        accent: "#a78bfa",
        product: "#312e81",
        label: "SAMPLE · LUXURY",
      })
    ),
  },
]

export type ThumbnailSampleDesign = {
  id: string
  label: string
  description: string
  templateId: string
  backgroundId?: string
  hooking: MvpThumbnailHookingText
}

export const THUMBNAIL_SAMPLE_DESIGNS: ThumbnailSampleDesign[] = [
  {
    id: "classic-shock",
    label: "템플릿1",
    description: "핑크+흰 · 중앙 상단",
    templateId: "user-fail-without",
    backgroundId: "kitchen-warm",
    hooking: { line1: "이거 없으면", line2: "망하는 이유" },
  },
  {
    id: "flash-today",
    label: "템플릿2",
    description: "시안+흰 · 중앙 하단",
    templateId: "user-slipper-power",
    backgroundId: "beauty-rose",
    hooking: { line1: "10년 연구 끝", line2: "욕실화 위력" },
  },
  {
    id: "minimal-review",
    label: "템플릿3",
    description: "흰+노랑 · 상단 기울임",
    templateId: "user-rice-health",
    backgroundId: "night-luxury",
    hooking: { line1: "혈당 걱정 끝", line2: "밥 짓는 법" },
  },
  {
    id: "neon-viral",
    label: "템플릿4",
    description: "흰색 · 상단 기울임",
    templateId: "user-must-use",
    backgroundId: "tech-cyan",
    hooking: { line1: "안 쓰면 손해", line2: "이거 꿀템" },
  },
]

export function sampleBackgroundById(id: string): ThumbnailSampleBackground | undefined {
  return THUMBNAIL_SAMPLE_BACKGROUNDS.find((b) => b.id === id)
}

export function applyThumbnailSampleDesign(
  design: MvpThumbnailDesign,
  sample: ThumbnailSampleDesign
): MvpThumbnailDesign {
  const bg = sample.backgroundId ? sampleBackgroundById(sample.backgroundId) : undefined
  let next = bg ? setThumbnailBackground(design, bg.url) : design
  next = applyThumbnailTemplate(next, sample.templateId, sample.hooking, { textStyleOnly: true })
  return { ...next, aiBaked: false, bakedHooking: undefined }
}

export function createDesignFromSample(
  sample: ThumbnailSampleDesign,
  fallbackBackground: string
): MvpThumbnailDesign {
  const bg = sample.backgroundId ? sampleBackgroundById(sample.backgroundId) : undefined
  const base = createThumbnailDesign(bg?.url ?? fallbackBackground, sample.hooking, sample.templateId)
  return applyThumbnailSampleDesign(base, sample)
}

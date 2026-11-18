import type { MvpThumbnailHookingText } from "@/lib/mvp-studio-types"
import { isMosaicOverlay, studioOverlayById, type PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import { clampOverlayPct } from "@/lib/mvp-overlay-utils"

export const THUMBNAIL_EXPORT_W = 1080
export const THUMBNAIL_EXPORT_H = 1920

export type ThumbnailTextLayer = {
  id: string
  role?: "hook1" | "hook2" | "badge" | "custom"
  text: string
  x: number
  y: number
  fontSize: number
  fontWeight: 400 | 700 | 800 | 900
  color: string
  strokeOn: boolean
  strokeColor: string
  strokeWidth: number
  /** @deprecated 레거시 — 글자 테두리만 사용 (박스 패딩 미사용) */
  strokePadH: number
  shadow: boolean
  letterSpacing: number
  rotation: number
  align: "left" | "center" | "right"
  bgOn: boolean
  bgColor: string
  bgOpacity: number
  widthPct: number
  /** true면 박스가 글자 폭이 아닌 레이어 폭(widthPct) 전체를 채움 — 띠(band) */
  bgFill?: boolean
  /** 박스 모서리 (기본 8, 999=알약) */
  bgRadius?: number
  /** 박스 안쪽 여백 (기본 12 / 6) */
  bgPadX?: number
  bgPadY?: number
}

/** 캔버스 위·아래를 덮는 단색 띠 (레터박스) */
export type ThumbnailLetterbox = {
  color: string
  topPct: number
  bottomPct: number
}

export type ThumbnailFilterState = {
  blur: number
  brightness: number
  contrast: number
  saturate: number
  vignette: number
  gradientTop: boolean
  gradientColor: string
  gradientOpacity: number
}

export type ThumbnailBackgroundTransform = {
  /** 100 = 기본(캔버스 채움) */
  scale: number
  /** 앵커 X (%) */
  x: number
  /** 앵커 Y (%) */
  y: number
}

export const THUMBNAIL_BACKGROUND_LAYER_ID = "__thumbnail_bg__"

export type MvpThumbnailDesign = {
  version: 1
  templateId: string
  backgroundUrl: string
  backgroundTransform?: ThumbnailBackgroundTransform
  /** true면 캔버스에서 배경 이동·확대 조절 불가 */
  backgroundLocked?: boolean
  texts: ThumbnailTextLayer[]
  elements: PlacedStudioOverlay[]
  filter: ThumbnailFilterState
  /** 쇼핑숏폼 Replicate 전체 썸네일 — 후킹·화살표가 이미지에 합성됨 */
  aiBaked?: boolean
  bakedHooking?: MvpThumbnailHookingText
  /** AI 이미지만 생성 기록 — 다른 배경 선택 시에도 복원 가능 */
  aiBackgroundHistory?: string[]
  /** 템플릿 상·하단 단색 띠 */
  letterbox?: ThumbnailLetterbox
}

export const MAX_AI_BACKGROUND_HISTORY = 8

export type ThumbnailTemplateCategory = "hook" | "review" | "price" | "info" | "minimal"

export const THUMBNAIL_TEMPLATE_CATEGORIES: Array<{ id: ThumbnailTemplateCategory; label: string }> = [
  { id: "hook", label: "충격·후킹" },
  { id: "review", label: "리뷰·추천" },
  { id: "price", label: "가격·할인" },
  { id: "info", label: "정보·꿀팁" },
  { id: "minimal", label: "미니멀" },
]

export type ThumbnailTemplate = {
  id: string
  label: string
  category?: ThumbnailTemplateCategory
  letterbox?: ThumbnailLetterbox
  description: string
  preview: string
  /** 템플릿 카드 미리보기용 샘플 문구 */
  sampleHook1?: string
  sampleHook2?: string
  sampleHook1Color?: string
  sampleHook2Color?: string
  /** true면 후킹 글씨 위치·색상만 적용 (배경·요소·필터 유지) */
  textStyleOnly?: boolean
  filter: Partial<ThumbnailFilterState>
  texts: Array<Partial<ThumbnailTextLayer> & { role: ThumbnailTextLayer["role"] }>
  elements: Array<Omit<PlacedStudioOverlay, "id">>
}

/** 텍스트 정렬에 맞는 CSS transform — x,y는 앵커 기준(좌/중앙/우) */
export function thumbnailTextAnchorTransform(
  align: ThumbnailTextLayer["align"] = "center",
  rotation = 0
): string {
  const xShift = align === "right" ? "-100%" : align === "left" ? "0%" : "-50%"
  return `translate(${xShift}, -50%) rotate(${rotation}deg)`
}

/** 템플릿 후킹 텍스트 기본 효과 — 그림자 + 글자 테두리(WebkitTextStroke) */
const TEMPLATE_HOOK_TEXT_EFFECTS: Pick<
  ThumbnailTextLayer,
  "shadow" | "strokeOn" | "strokeColor" | "strokeWidth"
> = {
  shadow: true,
  strokeOn: true,
  strokeColor: "#000000",
  strokeWidth: 8,
}

export const THUMBNAIL_DEFAULT_STROKE_WIDTH = 8

/** 템플릿 적용 시 이전 템플릿의 스타일이 남지 않도록 먼저 초기화하는 값 */
const TEMPLATE_TEXT_STYLE_RESET: Partial<ThumbnailTextLayer> = {
  ...TEMPLATE_HOOK_TEXT_EFFECTS,
  fontWeight: 900,
  letterSpacing: -0.5,
  rotation: 0,
  align: "center",
  widthPct: 88,
  bgOn: false,
  bgColor: "#000000",
  bgOpacity: 70,
  bgFill: undefined,
  bgRadius: undefined,
  bgPadX: undefined,
  bgPadY: undefined,
}

/** 템플릿이 추가한 뱃지 텍스트 — 다른 템플릿 적용 시 교체 */
const TEMPLATE_TEXT_ID_PREFIX = "tpl_"

function templateStylePatch(
  spec: Partial<ThumbnailTextLayer>
): Partial<ThumbnailTextLayer> {
  const { role: _role, text: _text, id: _id, ...style } = spec
  return { ...TEMPLATE_TEXT_STYLE_RESET, ...style }
}

export const THUMBNAIL_TEXT_FONT = '"Noto Sans KR","Pretendard",system-ui,sans-serif'

/** 후킹 1·2줄은 한 줄로, 나머지는 줄바꿈 기준 — 편집기·PNG 동일 */
export function thumbnailTextLines(layer: Pick<ThumbnailTextLayer, "role" | "text">): string[] {
  if (layer.role === "hook1" || layer.role === "hook2") {
    return [layer.text.replace(/\s+/g, " ").trim()]
  }
  const lines = layer.text.split("\n")
  return lines.length ? lines : [""]
}

let measureCtx: CanvasRenderingContext2D | null | undefined

function measureLineWidth(line: string, fontSize: number, weight: number, letterSpacing: number): number {
  if (measureCtx === undefined) {
    measureCtx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d")
  }
  const chars = [...line].length
  const spacing = letterSpacing * Math.max(0, chars - 1)
  // shortcut: SSR엔 캔버스가 없어 한글 평균 폭으로 추정, 브라우저에선 실측
  if (!measureCtx) return chars * fontSize * 0.92 + spacing
  measureCtx.font = `${weight} ${fontSize}px ${THUMBNAIL_TEXT_FONT}`
  return measureCtx.measureText(line).width + spacing
}

const THUMBNAIL_SAFE_MARGIN_PCT = 5

/** 9:16 안전 여백(좌우 5%) 안에 들어오도록 줄인 글자 크기 (기준 폭 360) */
export function fittedThumbnailFontSize(layer: ThumbnailTextLayer): number {
  const m = THUMBNAIL_SAFE_MARGIN_PCT
  const anchorPct =
    layer.align === "left"
      ? 100 - m - layer.x
      : layer.align === "right"
        ? layer.x - m
        : 2 * Math.min(layer.x - m, 100 - m - layer.x)
  // 사용자가 가장자리로 끌어다 놓은 경우 과도하게 작아지지 않도록 최소 폭 보장
  const availPct = Math.min(layer.widthPct, Math.max(30, anchorPct))
  const padX = layer.bgOn ? (layer.bgPadX ?? 12) : 0
  const stroke = layer.strokeOn ? layer.strokeWidth : 0
  const availPx = (availPct / 100) * 360 - 2 * padX - stroke
  const widest = Math.max(
    0,
    ...thumbnailTextLines(layer).map((l) =>
      measureLineWidth(l, layer.fontSize, layer.fontWeight, layer.letterSpacing)
    )
  )
  if (availPx <= 0 || widest <= availPx) return layer.fontSize
  return Math.max(12, Math.floor(((layer.fontSize * availPx) / widest) * 10) / 10)
}

/** hex + 불투명도(0~100) → rgba() */
export function thumbnailRgba(hex: string, opacityPct = 100): string {
  const h = normalizeThumbnailHexColor(hex, "#000000").slice(1)
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${opacityPct / 100})`
}

const THUMBNAIL_STAGE_BASE_H = (THUMBNAIL_EXPORT_H / THUMBNAIL_EXPORT_W) * 360

function estimateTextBlockHeightPx(t: ThumbnailTextLayer): number {
  const lineCount = Math.max(1, t.text.split("\n").filter((s) => s.trim()).length || 1)
  const lines = t.role === "hook1" || t.role === "hook2" ? 1 : lineCount
  const lineHeight = fittedThumbnailFontSize(t) * 1.05
  const boxPad = t.bgOn ? 2 * (t.bgPadY ?? 6) : 0
  const stroke = t.strokeOn ? t.strokeWidth * 2 : 0
  return lines * (lineHeight + boxPad) + stroke + 2
}

/** 후킹 1·2줄 — 겹치지 않는 최소 간격으로 맞춤 (넓게 벌어진 경우도 좁힘) */
function ensureHookLineSpacing(texts: ThumbnailTextLayer[]): ThumbnailTextLayer[] {
  const hook1Idx = texts.findIndex((t) => t.role === "hook1")
  const hook2Idx = texts.findIndex((t) => t.role === "hook2")
  if (hook1Idx < 0 || hook2Idx < 0) return texts

  const hook1 = texts[hook1Idx]!
  const hook2 = texts[hook2Idx]!
  // 같은 색 띠 두 줄은 이어 붙여 하나의 띠처럼
  const joinedBand =
    hook1.bgOn && hook2.bgOn && hook1.bgFill && hook2.bgFill && hook1.bgColor === hook2.bgColor
  const bufferPx = joinedBand ? -2 : 4
  const tightGap =
    ((estimateTextBlockHeightPx(hook1) / 2 + estimateTextBlockHeightPx(hook2) / 2 + bufferPx) /
      THUMBNAIL_STAGE_BASE_H) *
    100

  let hook1Y = hook1.y
  let hook2Y = clampOverlayPct(hook1Y + tightGap)
  if (hook2Y > 90) {
    const overflow = hook2Y - 88
    hook1Y = clampOverlayPct(hook1Y - overflow)
    hook2Y = clampOverlayPct(hook1Y + tightGap)
  }

  return texts.map((t) => {
    if (t.role === "hook1") return { ...t, y: hook1Y }
    if (t.role === "hook2") return { ...t, y: hook2Y }
    return t
  })
}

export const THUMBNAIL_TEXT_COLOR_PRESETS = [
  "#ffffff",
  "#ffb6c1",
  "#ffff00",
  "#5eead4",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#22d3ee",
  "#000000",
] as const

export function normalizeThumbnailHexColor(raw: string, fallback = "#ffffff"): string {
  const t = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t.toLowerCase()}`
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const h = t.slice(1)
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase()
  }
  return fallback
}

type TemplateTextSpec = ThumbnailTemplate["texts"][number]

const Y = "#ffe500"
const CY = "#7eebff"
const LIME = "#5cff5c"
const RED = "#ff3333"

const noStroke: Partial<ThumbnailTextLayer> = { strokeOn: false, shadow: false }

function boxStyle(bgColor: string, extra: Partial<ThumbnailTextLayer> = {}): Partial<ThumbnailTextLayer> {
  return { bgOn: true, bgColor, bgOpacity: 100, bgRadius: 6, bgPadX: 12, bgPadY: 6, ...noStroke, ...extra }
}

function bandStyle(bgColor: string, extra: Partial<ThumbnailTextLayer> = {}): Partial<ThumbnailTextLayer> {
  return boxStyle(bgColor, { bgFill: true, bgRadius: 0, bgPadY: 8, widthPct: 100, ...extra })
}

function hook(
  role: "hook1" | "hook2",
  y: number,
  color: string,
  extra: Partial<ThumbnailTextLayer> = {}
): TemplateTextSpec {
  return { role, x: 50, y, fontSize: 46, fontWeight: 900, color, align: "center", ...extra }
}

function badge(
  text: string,
  x: number,
  y: number,
  extra: Partial<ThumbnailTextLayer> = {}
): TemplateTextSpec {
  return {
    role: "badge",
    text,
    x,
    y,
    fontSize: 17,
    fontWeight: 900,
    color: "#ffffff",
    align: "center",
    widthPct: 80,
    letterSpacing: 0,
    ...boxStyle("#e11d2a", { bgRadius: 999, bgPadX: 12, bgPadY: 5 }),
    ...extra,
  }
}

function tpl(
  id: string,
  label: string,
  category: ThumbnailTemplateCategory,
  description: string,
  texts: TemplateTextSpec[],
  extra: Partial<ThumbnailTemplate> = {}
): ThumbnailTemplate {
  return { id, label, category, description, preview: "", textStyleOnly: true, filter: {}, texts, elements: [], ...extra }
}

const blackTop = (topPct = 22): ThumbnailLetterbox => ({ color: "#0a0a0a", topPct, bottomPct: 0 })
const whiteTop = (topPct = 22): ThumbnailLetterbox => ({ color: "#ffffff", topPct, bottomPct: 0 })

/**
 * 고조회수 한국 쇼핑·살림·꿀팁 "쇼츠" 표지만 벤치마크 (후보 697개 중 직접 디자인된 표지 150개 선별).
 * 자동 선택 프레임(작은 자막)·롱폼 썸네일은 제외. 주석의 [ ]는 영감을 준 표지 문구.
 * 후킹 1·2줄 문구는 사용자 것을 그대로 쓰고 스타일만 바꿈.
 */
export const THUMBNAIL_TEMPLATES: ThumbnailTemplate[] = [
  // ── 충격·후킹 ──
  // [99%가 모르는 배달 용기 뜯는 법] [냉장고 뒤 벽에 바짝 붙여도 될까?] [가성비 키보드]
  tpl("hook-black-top-yellow", "검정 띠 · 노랑 강조", "hook", "상단 검정 띠 + 흰/노랑 2줄 (가장 흔한 표지)", [
    hook("hook1", 8, "#ffffff", { fontSize: 32, ...noStroke }),
    hook("hook2", 15, Y, { fontSize: 36, ...noStroke }),
  ], { letterbox: blackTop() }),
  // [아이스크림 안 사주는 이유] [피부 노화 20년 막는 제품!] [12만원 갓성비 성능 미쳤다]
  tpl("hook-black-top-red", "검정 띠 · 빨강 강조", "hook", "상단 검정 띠 + 둘째 줄 빨강", [
    hook("hook1", 8, "#ffffff", { fontSize: 32, ...noStroke }),
    hook("hook2", 15, RED, { fontSize: 36, ...noStroke }),
  ], { letterbox: blackTop() }),
  // [창문이 더러우면? 이렇게 하라고?!] [이걸 왜 이제 알았을까] [남편한테 뭔가 시키면 생기는 일]
  tpl("hook-black-top-white", "검정 띠 · 흰 2줄", "hook", "상단 검정 띠 + 흰 글씨 2줄", [
    hook("hook1", 8, "#ffffff", { fontSize: 32, ...noStroke }),
    hook("hook2", 15, "#ffffff", { fontSize: 36, ...noStroke }),
  ], { letterbox: blackTop() }),
  // [알리 가방 후기] [테무 치마 후기] [알리에서 산 자라 짭 가방?]
  tpl("hook-black-top-big-yellow", "검정 띠 · 대형 노랑", "hook", "검정 띠에 크고 굵은 노랑 2줄", [
    hook("hook1", 8, Y, { fontSize: 40, ...noStroke }),
    hook("hook2", 16, Y, { fontSize: 40, ...noStroke }),
  ], { letterbox: blackTop(24) }),
  // [권은비 피셜 붓기템] [벌레 나오는 집 이렇게 거르세요] [삶의 질 1000% 상승템]
  tpl("user-slipper-power", "검정 띠 · 시안 강조", "hook", "상단 검정 띠 + 둘째 줄 시안", [
    hook("hook1", 8, "#ffffff", { fontSize: 32, ...noStroke }),
    hook("hook2", 15, CY, { fontSize: 36, ...noStroke }),
  ], { letterbox: blackTop() }),
  // ["이러니까 저렴하지"] ["이거 알리에서 사면.."] [몰려오는 알리·테무 "이러다 다 죽어"]
  tpl("hook-navy-quote", "네이비 띠 인용문", "hook", "남색 상단 띠 + 흰/시안 인용 문구", [
    hook("hook1", 8, "#ffffff", { fontSize: 30, ...noStroke }),
    hook("hook2", 15, CY, { fontSize: 36, ...noStroke }),
  ], { letterbox: { color: "#0f1d4a", topPct: 22, bottomPct: 0 } }),
  // [변기에 소금을 넣었더니..] [헐..이렇게 하는 거였어?] [아니 진짜 꿀템이네ㅋㅋ]
  tpl("hook-mint-band", "민트 띠 문장형", "hook", "전체 폭 민트 띠 + 흰 외곽선 줄", [
    hook("hook1", 10, "#ffffff", { fontSize: 30, ...bandStyle("#14b8a6") }),
    hook("hook2", 19, "#ffffff", { fontSize: 42 }),
  ]),
  // [보고도 믿기지 않는 가격]
  tpl("hook-cyan-red", "시안·빨강 투톤", "hook", "시안 + 빨강 외곽선 2줄", [
    hook("hook1", 13, CY, { fontSize: 46 }),
    hook("hook2", 24, RED, { fontSize: 46 }),
  ]),
  // [흡수력 좋은 건조매트]
  tpl("hook-red-white-outline", "빨강 흰테두리", "hook", "빨간 글씨 + 흰 외곽선 제목", [
    hook("hook1", 14, RED, { fontSize: 46, strokeColor: "#ffffff", strokeWidth: 9 }),
    hook("hook2", 24, "#ffffff", { fontSize: 40 }),
  ]),
  // [바닥 밀림 방지 고무] [외출 대참사 방지!] [포터블모니터 사용한다면?]
  tpl("hook-giant-center", "큰 외곽선 제목", "hook", "굵은 검정 외곽선 흰 제목 + 작은 둘째 줄", [
    hook("hook1", 18, "#ffffff", { fontSize: 50, strokeWidth: 10 }),
    hook("hook2", 28, "#ffffff", { fontSize: 30, strokeWidth: 7 }),
  ]),
  // [아빠들 환장하는 육아 아이템 수준] [역대급 신박한 아이디어 템 랭킹 모음집]
  tpl("user-rice-health", "노랑 외곽선 대형", "hook", "노랑 글씨 + 두꺼운 검정 외곽선 2줄", [
    hook("hook1", 9, Y, { fontSize: 46, strokeWidth: 9 }),
    hook("hook2", 19, Y, { fontSize: 46, strokeWidth: 9 }),
  ]),
  // [치킨 + 피자 조합이 만원대?!] [가성비 단백질]
  tpl("hook-yellow-two-line", "노랑 강조 2줄", "hook", "흰 + 노랑 외곽선 2줄 (질문·감탄형)", [
    hook("hook1", 13, "#ffffff", { fontSize: 46 }),
    hook("hook2", 24, Y, { fontSize: 46 }),
  ]),

  // ── 리뷰·추천 ──
  // [다이어트 쿠팡 추천템] [다이어트 D+40] [집사 겨울 꿀템]
  tpl("review-pill-label", "알약 라벨 + 제목", "review", "작은 보라 라벨 위에 흰/노랑 제목", [
    badge("쿠팡 추천템", 50, 7, { bgColor: "#7c3aed", fontSize: 15 }),
    hook("hook1", 14, "#ffffff", { fontSize: 44 }),
    hook("hook2", 24, Y, { fontSize: 44 }),
  ]),
  // [다이소가면 꼭 사세요!] [코스트코 닥터브로너스 캐스틸솝] [JMW BLDC Hair Dryer]
  tpl("review-brand-label", "검정 띠 + 상단 태그", "review", "검정 띠 위 노랑 태그 + 흰/빨강 제목", [
    badge("다이소", 50, 4.5, { bgColor: Y, color: "#111111", bgRadius: 3, fontSize: 15, bgPadY: 4 }),
    hook("hook1", 11, "#ffffff", { fontSize: 30, ...noStroke }),
    hook("hook2", 18, RED, { fontSize: 34, ...noStroke }),
  ], { letterbox: blackTop(25) }),
  // [3가지 육아템 (흰 박스)] [이건 진짜 잘 샀다 주방추천템 (노랑 박스)]
  tpl("review-white-box", "흰 박스 + 노랑 박스", "review", "흰 박스 검정 글씨 + 노랑 박스", [
    hook("hook1", 12, "#111111", { fontSize: 32, ...boxStyle("#ffffff") }),
    hook("hook2", 20, "#111111", { fontSize: 32, ...boxStyle(Y) }),
  ]),
  // [벌레 전문가가 추천하는 벌레 퇴치템 Best 3!] [BEST 2]
  tpl("review-best-pick", "BEST 추천", "review", "검정 띠 상단 + 노랑 Best 스티커", [
    hook("hook1", 8, "#ffffff", { fontSize: 30, ...noStroke }),
    hook("hook2", 15, "#ffffff", { fontSize: 40, ...noStroke }),
    badge("Best 3!", 84, 19, { rotation: -12, bgOn: false, color: "#ffffff", fontSize: 22, strokeOn: true, strokeColor: "#000000", strokeWidth: 5 }),
  ], { letterbox: blackTop() }),
  // [TOP4 중국 상하이 + "화려한 야경의 도시" 말풍선]
  tpl("review-speech", "말풍선 스티커", "review", "외곽선 2줄 + 흰 말풍선 한마디", [
    hook("hook1", 13, "#ffffff", { fontSize: 44 }),
    hook("hook2", 24, Y, { fontSize: 44 }),
    badge("이건 꼭 사세요!", 72, 36, { bgColor: "#ffffff", color: "#111111", rotation: -6, fontSize: 16, bgPadX: 14, bgPadY: 8 }),
  ]),
  // [버블 잘 해주는 아이돌!! (내돈내산)] [여행 필수템이라고? 내돈내산 검증해봄]
  tpl("review-honest-stamp", "초록 외곽선 내돈내산", "review", "흰 글씨 초록 외곽선 + (내돈내산)", [
    hook("hook1", 9, "#ffffff", { fontSize: 40, strokeColor: "#15803d", strokeWidth: 8 }),
    hook("hook2", 18, "#ffffff", { fontSize: 40, strokeColor: "#15803d", strokeWidth: 8 }),
    badge("(내돈내산)", 50, 27, { bgOn: false, color: Y, fontSize: 20, strokeOn: true, strokeColor: "#000000", strokeWidth: 4 }),
  ]),
  // [자취방 룩: 수납공간 1도 없음!]
  tpl("user-must-use", "검정 띠 · 초록 강조", "review", "상단 검정 띠 + 둘째 줄 형광 초록", [
    hook("hook1", 8, "#ffffff", { fontSize: 32, ...noStroke }),
    hook("hook2", 15, LIME, { fontSize: 36, ...noStroke }),
  ], { letterbox: blackTop() }),
  // [뿌리볼륨 종결템?! #TOP 3] [셀프 네일 꿀팁! #시험네일]
  tpl("review-hashtag", "흰 띠 + 해시태그", "review", "흰 상단 띠 검정 제목 + 회색 해시태그", [
    hook("hook1", 7, "#111111", { fontSize: 30, ...noStroke }),
    hook("hook2", 13.5, "#111111", { fontSize: 36, ...noStroke }),
    badge("#추천템 #꿀템", 50, 19, { bgOn: false, color: "#64748b", fontSize: 15, fontWeight: 800 }),
  ], { letterbox: whiteTop(23) }),
  // [EP57 헤어 망가지는게 싫다면] [EP08 집들이하면 꼭 선물하는 살림템] [EP63 엄마들 사이의 필수템!]
  tpl("review-mint-card", "민트 카드 시리즈", "review", "민트 종이 띠 + EP 번호 + 검정 제목", [
    badge("EP.01", 50, 5, { bgOn: false, color: "#475569", fontSize: 13, fontWeight: 800 }),
    hook("hook1", 11.5, "#111111", { fontSize: 30, ...noStroke }),
    hook("hook2", 18, "#111111", { fontSize: 30, ...noStroke }),
  ], { letterbox: { color: "#cdeee4", topPct: 25, bottomPct: 0 } }),
  // [10배 넓어지는 세탁실 꿀템!]
  tpl("review-cream-card", "크림 카드 제목", "review", "크림색 띠 + 검정/초록 제목", [
    hook("hook1", 8, "#1f2937", { fontSize: 30, ...noStroke }),
    hook("hook2", 15, "#2f6b3a", { fontSize: 40, ...noStroke }),
  ], { letterbox: { color: "#f3eedf", topPct: 23, bottomPct: 0 } }),
  // [품절대란 화장품 (다이소 리들샷)!] [아마존에서 이거 꼭 사야해..] [미친 서비스의 삼촌카세]
  tpl("review-white-top-band", "흰 띠 · 빨강 강조", "review", "흰 상단 띠 + 검정/빨강 글씨", [
    hook("hook1", 8, "#111111", { fontSize: 32, ...noStroke }),
    hook("hook2", 15, "#e11d2a", { fontSize: 36, ...noStroke }),
  ], { letterbox: whiteTop() }),

  // ── 가격·할인 ──
  // [VOAR 이지 전기포트 49,900원]
  tpl("price-sticker", "상품명 + 빨간 가격", "price", "흰 상품명 2줄 + 빨간 가격", [
    hook("hook1", 8, "#ffffff", { fontSize: 40, fontWeight: 800, strokeOn: false }),
    hook("hook2", 15, "#ffffff", { fontSize: 24, fontWeight: 800, strokeOn: false }),
    badge("49,900원", 50, 21, { bgOn: false, color: RED, fontSize: 24, shadow: true }),
  ]),
  // [2. 차량용 휠브러쉬 1,000원]
  tpl("price-big-number", "번호 + 가격 강조", "price", "노랑 상품명 + 크고 빨간 가격", [
    hook("hook1", 32, Y, { fontSize: 34 }),
    hook("hook2", 41, RED, { fontSize: 46, strokeColor: "#ffffff", strokeWidth: 8 }),
  ]),
  // [10만원대 가성비 중고폰 TOP 5 — 하단 "놓치면 손해! 47만원 30만원" 바]
  tpl("price-bottom-twist", "하단 가격 바", "price", "하단 흰 띠 + 검정/빨강 가격 문구", [
    hook("hook1", 84, "#111111", { fontSize: 28, ...noStroke }),
    hook("hook2", 90.5, "#e11d2a", { fontSize: 32, ...noStroke }),
  ], { letterbox: { color: "#ffffff", topPct: 0, bottomPct: 19 } }),
  // [삶의 질 높여줄 스마트 휴지통]
  tpl("price-black-top-redbox", "검정 띠 + 빨간 박스", "price", "검정 띠 흰 줄 + 빨간 박스 강조", [
    hook("hook1", 8, "#ffffff", { fontSize: 30, ...noStroke }),
    hook("hook2", 15.5, "#ffffff", { fontSize: 32, ...boxStyle("#e11d2a", { bgRadius: 2 }) }),
  ], { letterbox: blackTop(23) }),
  // [싼 맛에 산 청소기] [다이소 가성비 꿀템] [에어컨 실외기 청소 레전드]
  tpl("price-yellow-band", "노랑 박스 제목", "price", "노랑 박스 검정 글씨 2줄", [
    hook("hook1", 12, "#111111", { fontSize: 34, ...boxStyle(Y, { bgRadius: 2 }) }),
    hook("hook2", 20, "#111111", { fontSize: 34, ...boxStyle(Y, { bgRadius: 2 }) }),
  ]),
  // [마운자로보다 강하다는 신박한 아이템] [댕댕이들 환장하는 역대급 반응 폭팔 아이템]
  tpl("price-yellow-top", "노랑 띠 상단", "price", "노랑 상단 띠 + 검정/빨강 글씨", [
    hook("hook1", 8, "#111111", { fontSize: 32, ...noStroke }),
    hook("hook2", 15, "#e11d2a", { fontSize: 36, ...noStroke }),
  ], { letterbox: { color: Y, topPct: 22, bottomPct: 0 } }),

  // ── 정보·꿀팁 ──
  // [진꿀 진짜 꿀팁!! 변기에 소금을 넣으면] [의외로 잘 모르는 꿀팁!] [바세린 이렇게 발라주면]
  tpl("info-real-tip", "진짜 꿀팁 태그", "info", "검정 띠 · 빨강 태그 + 노랑 박스 제목", [
    badge("진짜 꿀팁!!", 50, 5, { bgRadius: 3, fontSize: 15, bgPadY: 4 }),
    hook("hook1", 12.5, "#111111", { fontSize: 30, ...boxStyle(Y, { bgRadius: 2 }) }),
    hook("hook2", 21, "#ffffff", { fontSize: 36 }),
  ], { letterbox: blackTop(18) }),
  // [초스피드 [직장생활 꿀팁] 딱, 30개만!]
  tpl("info-tip-header", "꿀팁 헤더 띠", "info", "검정 띠 · 빨강 머리말 + 노랑/흰", [
    badge("초스피드", 50, 5, { bgOn: false, color: RED, fontSize: 18 }),
    hook("hook1", 11.5, Y, { fontSize: 32, ...noStroke }),
    hook("hook2", 18, "#ffffff", { fontSize: 38, ...noStroke }),
  ], { letterbox: blackTop(26) }),
  // [일상 속 주방 꿀팁으로 삶의 질 높이기] [주부들의 경악할 비밀 생활 꿀팁]
  tpl("info-orange-top", "검정 띠 · 노랑/주황", "info", "검정 띠 + 노랑/주황 2줄", [
    hook("hook1", 8, Y, { fontSize: 32, ...noStroke }),
    hook("hook2", 15, "#ff8a00", { fontSize: 36, ...noStroke }),
  ], { letterbox: blackTop() }),
  // [최고의 황금무기 TOP5] [신기한 미술재료 TOP 3]
  tpl("info-top-rank", "검정 띠 + TOP 숫자", "info", "검정 띠 흰 제목 + 노랑 TOP 숫자", [
    hook("hook1", 7, "#ffffff", { fontSize: 30, ...noStroke }),
    hook("hook2", 13.5, "#ffffff", { fontSize: 30, ...noStroke }),
    badge("TOP 5", 50, 19.5, { bgOn: false, color: Y, fontSize: 28, rotation: -4 }),
  ], { letterbox: blackTop(24) }),
  // [6. 걸이형 물기제거기(2개)] [4. 스케이터락] [5. 아기 침대]
  tpl("info-numbered-label", "번호 라벨", "info", "왼쪽 빨간 번호 라벨 + 흰 외곽선 줄", [
    hook("hook1", 12, "#ffffff", { x: 7, align: "left", fontSize: 28, ...boxStyle("#e11d2a", { bgRadius: 3 }) }),
    hook("hook2", 20, "#ffffff", { x: 7, align: "left", fontSize: 40 }),
  ]),
  // [이거 써 보세요 (TIP 카드)] [바늘에 우레탄실을 끼워 한 바퀴!]
  tpl("info-tip-card", "TIP 카드", "info", "TIP 알약 + 노랑 박스/흰 박스 제목", [
    badge("TIP", 50, 7, { bgColor: Y, color: "#111111", fontSize: 15 }),
    hook("hook1", 14, "#111111", { fontSize: 30, ...boxStyle(Y, { bgRadius: 2 }) }),
    hook("hook2", 22, "#111111", { fontSize: 26, ...boxStyle("#ffffff", { bgRadius: 2 }) }),
  ]),
  // [다이소 미친 절대후회하지않아요!!]
  tpl("info-green-band", "초록 띠 문장형", "info", "전체 폭 초록 띠 + 흰 외곽선 줄", [
    hook("hook1", 10, "#ffffff", { fontSize: 32, ...bandStyle("#16a34a") }),
    hook("hook2", 19, "#ffffff", { fontSize: 36 }),
  ]),

  // ── 미니멀 ──
  // [삶은 계란, 이제 펭귄에게 맡기세요] [좁은 주방 넓게 쓰는 소소한 방법] [부모님의 실수]
  tpl("minimal-black-type", "흰 띠 · 검정 글씨", "minimal", "흰 상단 띠 + 검정 글씨 2줄", [
    hook("hook1", 8, "#111111", { fontSize: 32, ...noStroke }),
    hook("hook2", 15, "#111111", { fontSize: 36, ...noStroke }),
  ], { letterbox: whiteTop() }),
  // [다이소 오픈런 신화 화제의 청소템] [샤워 시간 단축시켜줘서 진짜 너무 편함]
  tpl("user-fail-without", "흰 띠 · 핑크 강조", "minimal", "흰 상단 띠 + 검정/핑크 글씨", [
    hook("hook1", 8, "#111111", { fontSize: 32, ...noStroke }),
    hook("hook2", 15, "#ec4899", { fontSize: 36, ...noStroke }),
  ], { letterbox: whiteTop() }),
  // [둘째맘 신생아 추천템 3]
  tpl("minimal-glass", "반투명 박스", "minimal", "반투명 흰 박스 2줄", [
    hook("hook1", 12, "#111111", { fontSize: 28, ...boxStyle("#ffffff", { bgOpacity: 75, bgRadius: 4 }) }),
    hook("hook2", 20, "#111111", { fontSize: 28, ...boxStyle("#ffffff", { bgOpacity: 75, bgRadius: 4 }) }),
  ]),
  // [Archon M1 PRO TKL]
  tpl("minimal-clean-white", "상품명 왼쪽", "minimal", "왼쪽 정렬 작은 브랜드 + 큰 상품명", [
    hook("hook1", 8, "#ffffff", { x: 7, align: "left", fontSize: 22, fontWeight: 700, strokeOn: false }),
    hook("hook2", 14, "#ffffff", { x: 7, align: "left", fontSize: 40, strokeOn: false }),
  ]),
]

function newTextId(): string {
  return `txt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function newElementId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function defaultBackgroundTransform(): ThumbnailBackgroundTransform {
  return { scale: 100, x: 50, y: 50 }
}

export function resolveBackgroundTransform(design: MvpThumbnailDesign): ThumbnailBackgroundTransform {
  return design.backgroundTransform ?? defaultBackgroundTransform()
}

export function thumbnailBackgroundImageStyle(
  transform: ThumbnailBackgroundTransform,
  filterCss?: { filter?: string }
): Record<string, string | number | undefined> {
  return {
    position: "absolute",
    left: `${transform.x}%`,
    top: `${transform.y}%`,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `translate(-50%, -50%) scale(${transform.scale / 100})`,
    transformOrigin: "center center",
    filter: filterCss?.filter,
  }
}

export function defaultThumbnailFilter(): ThumbnailFilterState {
  return {
    blur: 0,
    brightness: 100,
    contrast: 100,
    saturate: 100,
    vignette: 20,
    gradientTop: true,
    gradientColor: "#000000",
    gradientOpacity: 40,
  }
}

function baseTextLayer(partial: Partial<ThumbnailTextLayer> & { role?: ThumbnailTextLayer["role"]; text: string }): ThumbnailTextLayer {
  return {
    id: newTextId(),
    role: partial.role ?? "custom",
    text: partial.text,
    x: partial.x ?? 50,
    y: partial.y ?? 15,
    fontSize: partial.fontSize ?? 48,
    fontWeight: partial.fontWeight ?? 900,
    color: partial.color ?? "#ffffff",
    strokeOn: partial.strokeOn ?? true,
    strokeColor: partial.strokeColor ?? "#000000",
    strokeWidth: partial.strokeWidth ?? (partial.strokeOn === false ? 2 : THUMBNAIL_DEFAULT_STROKE_WIDTH),
    strokePadH: partial.strokePadH ?? 0,
    shadow: partial.shadow ?? true,
    letterSpacing: partial.letterSpacing ?? -0.5,
    rotation: partial.rotation ?? 0,
    align: partial.align ?? "center",
    bgOn: partial.bgOn ?? false,
    bgColor: partial.bgColor ?? "#000000",
    bgOpacity: partial.bgOpacity ?? 70,
    widthPct: partial.widthPct ?? 88,
    bgFill: partial.bgFill,
    bgRadius: partial.bgRadius,
    bgPadX: partial.bgPadX,
    bgPadY: partial.bgPadY,
  }
}

export function defaultThumbnailTexts(hooking: MvpThumbnailHookingText): ThumbnailTextLayer[] {
  const line1 = hooking.line1.trim() || "99%가 모르는"
  const line2 = hooking.line2.trim() || "충격 가격"
  return [
    baseTextLayer({ role: "hook1", text: line1, y: 11, color: "#ffffff", ...TEMPLATE_HOOK_TEXT_EFFECTS }),
    baseTextLayer({ role: "hook2", text: line2, y: 17, color: "#5eead4", ...TEMPLATE_HOOK_TEXT_EFFECTS }),
  ]
}

export function createThumbnailDesign(
  backgroundUrl: string,
  hooking: MvpThumbnailHookingText,
  templateId = "user-fail-without"
): MvpThumbnailDesign {
  const design: MvpThumbnailDesign = {
    version: 1,
    templateId,
    backgroundUrl,
    backgroundTransform: defaultBackgroundTransform(),
    texts: defaultThumbnailTexts(hooking),
    elements: [],
    filter: defaultThumbnailFilter(),
  }
  return applyThumbnailTemplate(design, templateId, hooking, { withElements: false })
}

export function applyThumbnailTemplate(
  design: MvpThumbnailDesign,
  templateId: string,
  hooking: MvpThumbnailHookingText,
  options?: { withElements?: boolean; textStyleOnly?: boolean }
): MvpThumbnailDesign {
  const resolvedTemplateId = templateId === "user-fast-charge" ? "user-fail-without" : templateId
  const tpl = THUMBNAIL_TEMPLATES.find((t) => t.id === resolvedTemplateId)
  if (!tpl) return { ...design, templateId: resolvedTemplateId }

  const textStyleOnly = options?.textStyleOnly ?? tpl.textStyleOnly ?? false
  const withElements = options?.withElements ?? !textStyleOnly

  const line1 =
    hooking.line1.trim() ||
    design.texts.find((t) => t.role === "hook1")?.text ||
    tpl.sampleHook1 ||
    "이거 없으면"
  const line2 =
    hooking.line2.trim() ||
    design.texts.find((t) => t.role === "hook2")?.text ||
    tpl.sampleHook2 ||
    "망하는 이유"

  const templateBadge = (spec: ThumbnailTemplate["texts"][number]): ThumbnailTextLayer => {
    const layer = baseTextLayer({ ...templateStylePatch(spec), role: "badge", text: spec.text ?? "" })
    return { ...layer, id: `${TEMPLATE_TEXT_ID_PREFIX}${layer.id}` }
  }

  if (textStyleOnly) {
    const texts = design.texts.filter((t) => !t.id.startsWith(TEMPLATE_TEXT_ID_PREFIX))

    for (const spec of tpl.texts) {
      if (spec.role !== "hook1" && spec.role !== "hook2") continue
      const style = templateStylePatch(spec)
      const text = spec.role === "hook1" ? line1 : line2
      const idx = texts.findIndex((t) => t.role === spec.role)
      if (idx >= 0) {
        texts[idx] = {
          ...texts[idx]!,
          ...style,
          text: texts[idx]!.text.trim() || text,
        }
      } else {
        texts.push(baseTextLayer({ role: spec.role, text, ...style }))
      }
    }
    for (const spec of tpl.texts) {
      if (spec.role === "badge" && spec.text?.trim()) texts.push(templateBadge(spec))
    }

    return {
      ...design,
      templateId: resolvedTemplateId,
      letterbox: tpl.letterbox,
      texts: ensureHookLineSpacing(texts),
    }
  }

  const texts: ThumbnailTextLayer[] = []
  for (const spec of tpl.texts) {
    if (spec.role === "badge") {
      if (spec.text?.trim()) texts.push(templateBadge(spec))
      continue
    }
    let text = spec.text ?? ""
    if (spec.role === "hook1") text = line1
    if (spec.role === "hook2") text = line2
    if (!text.trim()) continue
    texts.push(baseTextLayer({ ...templateStylePatch(spec), text, role: spec.role }))
  }
  if (!texts.length) texts.push(...defaultThumbnailTexts(hooking))

  return {
    ...design,
    templateId: resolvedTemplateId,
    letterbox: tpl.letterbox,
    filter: { ...design.filter, ...tpl.filter },
    texts: ensureHookLineSpacing(texts),
    elements: withElements
      ? tpl.elements.map((el) => ({
          ...el,
          id: newElementId(),
          x: clampOverlayPct(el.x),
          y: clampOverlayPct(el.y),
        }))
      : design.elements,
  }
}

export function hookingFromThumbnailDesign(design: MvpThumbnailDesign): MvpThumbnailHookingText {
  if (design.bakedHooking) {
    return {
      line1: design.bakedHooking.line1.trim(),
      line2: design.bakedHooking.line2.trim(),
    }
  }
  const line1 = design.texts.find((t) => t.role === "hook1")?.text?.trim() ?? ""
  const line2 = design.texts.find((t) => t.role === "hook2")?.text?.trim() ?? ""
  return { line1, line2 }
}

/** 쇼핑숏폼 Replicate 전체 썸네일 결과 적용 (텍스트·요소는 이미지에 합성됨) */
export function applyFullAiThumbnail(
  design: MvpThumbnailDesign,
  thumbnailUrl: string,
  hooking: MvpThumbnailHookingText
): MvpThumbnailDesign {
  return {
    ...design,
    backgroundUrl: thumbnailUrl.trim(),
    backgroundTransform: defaultBackgroundTransform(),
    texts: [],
    elements: [],
    filter: defaultThumbnailFilter(),
    aiBaked: true,
    bakedHooking: {
      line1: hooking.line1.trim(),
      line2: hooking.line2.trim(),
    },
  }
}

export function exitAiBakedEditMode(
  design: MvpThumbnailDesign,
  hooking?: MvpThumbnailHookingText
): MvpThumbnailDesign {
  const h = hooking ?? hookingFromThumbnailDesign(design)
  const next = applyThumbnailTemplate(
    {
      ...design,
      aiBaked: false,
      bakedHooking: undefined,
    },
    design.templateId,
    h,
    { withElements: false }
  )
  return next
}

export function updateThumbnailText(
  design: MvpThumbnailDesign,
  id: string,
  patch: Partial<ThumbnailTextLayer>
): MvpThumbnailDesign {
  return {
    ...design,
    texts: design.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }
}

export function addThumbnailElement(design: MvpThumbnailDesign, catalogId: string): MvpThumbnailDesign {
  const entry = studioOverlayById(catalogId)
  const mosaic = isMosaicOverlay(catalogId)
  return {
    ...design,
    elements: [
      ...design.elements,
      {
        id: newElementId(),
        catalogId,
        x: 50,
        y: 50,
        size: mosaic ? 120 : 56,
        color: "#ef4444",
        rotation: 0,
        ...(mosaic
          ? {
              mosaicW: entry?.kind === "mosaic-circle" ? 100 : 140,
              mosaicH: entry?.kind === "mosaic-circle" ? 100 : 88,
              mosaicBlock: 10,
            }
          : {}),
      },
    ],
  }
}

export function updateThumbnailElement(
  design: MvpThumbnailDesign,
  id: string,
  patch: Partial<PlacedStudioOverlay>
): MvpThumbnailDesign {
  return {
    ...design,
    elements: design.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
  }
}

export function removeThumbnailLayer(design: MvpThumbnailDesign, id: string): MvpThumbnailDesign {
  return {
    ...design,
    texts: design.texts.filter((t) => t.id !== id),
    elements: design.elements.filter((el) => el.id !== id),
  }
}

export function duplicateThumbnailText(design: MvpThumbnailDesign, id: string): MvpThumbnailDesign {
  const src = design.texts.find((t) => t.id === id)
  if (!src) return design
  const copy: ThumbnailTextLayer = {
    ...src,
    id: newTextId(),
    role: "custom",
    x: clampOverlayPct(src.x + 3),
    y: clampOverlayPct(src.y + 2),
  }
  return { ...design, texts: [...design.texts, copy] }
}

export function duplicateThumbnailElement(design: MvpThumbnailDesign, id: string): MvpThumbnailDesign {
  const src = design.elements.find((el) => el.id === id)
  if (!src) return design
  const copy = {
    ...src,
    id: newElementId(),
    x: clampOverlayPct(src.x + 3),
    y: clampOverlayPct(src.y + 2),
  }
  return { ...design, elements: [...design.elements, copy] }
}

function reorderById<T extends { id: string }>(items: T[], id: string, dir: "up" | "down"): T[] {
  const i = items.findIndex((x) => x.id === id)
  if (i < 0) return items
  const j = dir === "up" ? i + 1 : i - 1
  if (j < 0 || j >= items.length) return items
  const next = [...items]
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  return next
}

export function moveThumbnailTextLayer(
  design: MvpThumbnailDesign,
  id: string,
  dir: "up" | "down"
): MvpThumbnailDesign {
  return { ...design, texts: reorderById(design.texts, id, dir) }
}

export function moveThumbnailElementLayer(
  design: MvpThumbnailDesign,
  id: string,
  dir: "up" | "down"
): MvpThumbnailDesign {
  return { ...design, elements: reorderById(design.elements, id, dir) }
}

export function setThumbnailBackground(design: MvpThumbnailDesign, url: string): MvpThumbnailDesign {
  const nextUrl = url.trim()
  const urlChanged = nextUrl !== design.backgroundUrl.trim()
  return {
    ...design,
    backgroundUrl: nextUrl,
    ...(urlChanged ? { backgroundTransform: defaultBackgroundTransform() } : {}),
    aiBaked: false,
    bakedHooking: undefined,
  }
}

export function updateThumbnailBackgroundTransform(
  design: MvpThumbnailDesign,
  patch: Partial<ThumbnailBackgroundTransform>
): MvpThumbnailDesign {
  const cur = resolveBackgroundTransform(design)
  const scale = Math.round(Math.min(400, Math.max(50, patch.scale ?? cur.scale)))
  return {
    ...design,
    backgroundTransform: {
      scale,
      x: clampOverlayPct(patch.x ?? cur.x),
      y: clampOverlayPct(patch.y ?? cur.y),
    },
  }
}

export function resetThumbnailBackgroundTransform(design: MvpThumbnailDesign): MvpThumbnailDesign {
  return { ...design, backgroundTransform: defaultBackgroundTransform() }
}

export function setThumbnailBackgroundLocked(
  design: MvpThumbnailDesign,
  locked: boolean
): MvpThumbnailDesign {
  return { ...design, backgroundLocked: locked }
}

/** AI 배경 생성 결과 적용 + 기록 보관 */
export function applyAiGeneratedBackground(
  design: MvpThumbnailDesign,
  backgroundUrl: string
): MvpThumbnailDesign {
  const url = backgroundUrl.trim()
  if (!url) return design
  const urlChanged = url !== design.backgroundUrl.trim()
  const prev = design.aiBackgroundHistory ?? []
  const history = [url, ...prev.filter((u) => u !== url)].slice(0, MAX_AI_BACKGROUND_HISTORY)
  return {
    ...design,
    backgroundUrl: url,
    ...(urlChanged ? { backgroundTransform: defaultBackgroundTransform() } : {}),
    aiBackgroundHistory: history,
    aiBaked: false,
    bakedHooking: undefined,
    filter: { ...design.filter, gradientTop: false },
  }
}

export const THUMBNAIL_STAGE_BASE_W = 360

/** 스튜디오 PNG(1080×1920)를 렌더·저장용으로 정규화 — JPEG 압축 없음 */
export async function normalizeThumbnailExportPng(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = THUMBNAIL_EXPORT_W
      canvas.height = THUMBNAIL_EXPORT_H
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("썸네일 캔버스를 사용할 수 없습니다."))
        return
      }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.fillStyle = "#000000"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL("image/png"))
    }
    img.onerror = () => reject(new Error("썸네일 이미지를 불러올 수 없습니다."))
    img.src = dataUrl
  })
}

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
}

export const MAX_AI_BACKGROUND_HISTORY = 8

export type ThumbnailTemplate = {
  id: string
  label: string
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

const TEXT_STYLE_KEYS = [
  "x",
  "y",
  "color",
  "align",
  "rotation",
  "fontSize",
  "fontWeight",
  "widthPct",
] as const satisfies readonly (keyof ThumbnailTextLayer)[]

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

function pickTextStyleFromSpec(
  spec: Partial<ThumbnailTextLayer>
): Partial<ThumbnailTextLayer> {
  const patch: Partial<ThumbnailTextLayer> = {}
  for (const key of TEXT_STYLE_KEYS) {
    if (spec[key] !== undefined) patch[key] = spec[key] as never
  }
  return patch
}

const THUMBNAIL_STAGE_BASE_H = (THUMBNAIL_EXPORT_H / THUMBNAIL_EXPORT_W) * 360

function estimateTextBlockHeightPx(
  t: Pick<ThumbnailTextLayer, "fontSize" | "text" | "strokeOn" | "strokeWidth" | "bgOn">,
  tight = false
): number {
  const lineCount = Math.max(1, t.text.split("\n").filter((s) => s.trim()).length || 1)
  const lineHeight = t.fontSize * (tight ? 1.05 : 1.2)
  const boxPad = tight ? 0 : t.bgOn ? 12 : 0
  const stroke = t.strokeOn ? t.strokeWidth * 2 : 0
  return lineCount * lineHeight + boxPad + stroke + (tight ? 2 : 6)
}

function minHookCenterGapPct(
  hook1: Pick<ThumbnailTextLayer, "fontSize" | "text" | "strokeOn" | "strokeWidth" | "bgOn">,
  hook2: Pick<ThumbnailTextLayer, "fontSize" | "text" | "strokeOn" | "strokeWidth" | "bgOn">,
  bufferPx = 4
): number {
  const gapPx =
    estimateTextBlockHeightPx(hook1, true) / 2 +
    estimateTextBlockHeightPx(hook2, true) / 2 +
    bufferPx
  return (gapPx / THUMBNAIL_STAGE_BASE_H) * 100
}

/** 후킹 1·2줄 — 겹치지 않는 최소 간격으로 맞춤 (넓게 벌어진 경우도 좁힘) */
function ensureHookLineSpacing(texts: ThumbnailTextLayer[]): ThumbnailTextLayer[] {
  const hook1Idx = texts.findIndex((t) => t.role === "hook1")
  const hook2Idx = texts.findIndex((t) => t.role === "hook2")
  if (hook1Idx < 0 || hook2Idx < 0) return texts

  const hook1 = texts[hook1Idx]!
  const hook2 = texts[hook2Idx]!
  const tightGap = minHookCenterGapPct(hook1, hook2)

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

/** 실제 쇼츠 썸네일 레퍼런스 — 후킹 2줄 위치·색상만 정의 */
export const THUMBNAIL_TEMPLATES: ThumbnailTemplate[] = [
  {
    id: "user-fail-without",
    label: "템플릿1",
    description: "중앙 상단 · 핑크+흰",
    preview: "linear-gradient(180deg,#f5f0e8 0%,#d4ccc0 100%)",
    sampleHook1: "이거 없으면",
    sampleHook2: "망하는 이유",
    sampleHook1Color: "#ffb6c1",
    sampleHook2Color: "#ffffff",
    textStyleOnly: true,
    filter: {},
    texts: [
      { role: "hook1", x: 50, y: 36, fontSize: 52, fontWeight: 900, color: "#ffb6c1", align: "center" },
      { role: "hook2", x: 50, y: 47, fontSize: 52, fontWeight: 900, color: "#ffffff", align: "center" },
    ],
    elements: [],
  },
  {
    id: "user-slipper-power",
    label: "템플릿2",
    description: "중앙 하단 · 시안+흰",
    preview: "linear-gradient(160deg,#374151 0%,#1f2937 100%)",
    sampleHook1: "10년 연구 끝",
    sampleHook2: "욕실화 위력",
    sampleHook1Color: "#22d3ee",
    sampleHook2Color: "#ffffff",
    textStyleOnly: true,
    filter: {},
    texts: [
      { role: "hook1", x: 50, y: 50, fontSize: 48, fontWeight: 900, color: "#22d3ee", align: "center" },
      { role: "hook2", x: 50, y: 61, fontSize: 48, fontWeight: 900, color: "#ffffff", align: "center" },
    ],
    elements: [],
  },
  {
    id: "user-rice-health",
    label: "템플릿3",
    description: "상단 중앙 · 흰+노랑 · 기울임",
    preview: "linear-gradient(160deg,#78716c 0%,#44403c 100%)",
    sampleHook1: "혈당 걱정 끝",
    sampleHook2: "밥 짓는 법",
    sampleHook1Color: "#ffffff",
    sampleHook2Color: "#ffff00",
    textStyleOnly: true,
    filter: {},
    texts: [
      { role: "hook1", x: 50, y: 22, fontSize: 50, fontWeight: 900, color: "#ffffff", align: "center", rotation: -6 },
      { role: "hook2", x: 50, y: 33, fontSize: 50, fontWeight: 900, color: "#ffff00", align: "center", rotation: -6 },
    ],
    elements: [],
  },
  {
    id: "user-must-use",
    label: "템플릿4",
    description: "상단 중앙 · 흰색 · 기울임",
    preview: "linear-gradient(160deg,#94a3b8 0%,#64748b 100%)",
    sampleHook1: "안 쓰면 손해",
    sampleHook2: "이거 꿀템",
    sampleHook1Color: "#ffffff",
    sampleHook2Color: "#ffffff",
    textStyleOnly: true,
    filter: {},
    texts: [
      { role: "hook1", x: 50, y: 18, fontSize: 48, fontWeight: 900, color: "#ffffff", align: "center", rotation: -8 },
      { role: "hook2", x: 50, y: 29, fontSize: 48, fontWeight: 900, color: "#ffffff", align: "center", rotation: -8 },
    ],
    elements: [],
  },
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

  if (textStyleOnly) {
    const hookSpecs = tpl.texts.filter((s) => s.role === "hook1" || s.role === "hook2")
    let texts = [...design.texts]

    for (const spec of hookSpecs) {
      const style = pickTextStyleFromSpec(spec)
      const text = spec.role === "hook1" ? line1 : line2
      const idx = texts.findIndex((t) => t.role === spec.role)
      if (idx >= 0) {
        texts[idx] = {
          ...texts[idx]!,
          ...TEMPLATE_HOOK_TEXT_EFFECTS,
          ...style,
          text: texts[idx]!.text.trim() || text,
        }
      } else {
        texts.push(
          baseTextLayer({
            role: spec.role,
            text,
            widthPct: 88,
            ...TEMPLATE_HOOK_TEXT_EFFECTS,
            ...style,
          })
        )
      }
    }

    return { ...design, templateId: resolvedTemplateId, texts: ensureHookLineSpacing(texts) }
  }

  const texts: ThumbnailTextLayer[] = []
  for (const spec of tpl.texts) {
    let text = spec.text ?? ""
    if (spec.role === "hook1") text = line1
    if (spec.role === "hook2") text = line2
    if (!text.trim()) continue
    texts.push(
      baseTextLayer({
        ...TEMPLATE_HOOK_TEXT_EFFECTS,
        ...spec,
        text,
        role: spec.role,
      })
    )
  }
  if (!texts.length) texts.push(...defaultThumbnailTexts(hooking))

  return {
    ...design,
    templateId: resolvedTemplateId,
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

export async function exportThumbnailStageToDataUrl(stageEl: HTMLElement): Promise<string> {
  const { default: html2canvas } = await import("html2canvas-pro")
  const rect = stageEl.getBoundingClientRect()
  const scale = rect.width > 0 ? THUMBNAIL_EXPORT_W / rect.width : 2
  const canvas = await html2canvas(stageEl, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#000000",
    logging: false,
  })
  return canvas.toDataURL("image/png", 0.92)
}

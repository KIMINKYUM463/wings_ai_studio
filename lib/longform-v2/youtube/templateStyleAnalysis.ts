/** DOM CanvasTextAlign 과 호환 (shared 번들에 dom lib 없음) */
export type TextAlignKind = 'left' | 'center' | 'right' | 'start' | 'end'

/** 카탈로그 슬롯 — 분석 결과 병합용 */
export type CatalogTextSlotRef = {
  slotKey: string
  label: string
  /** 카탈로그 미리보기에 보이는 기본 문구 (비전 OCR 폴백) */
  samplePreviewText?: string
  maxCharacters: number
  zIndex: number
  xn: number
  yn: number
  fontSize: number
  fill: string
  stroke: string
  strokeWidth: number
  textAlign: TextAlignKind
  boxBackground?: boolean
  boxBackgroundColor?: string
  boxPaddingX?: number
  boxPaddingY?: number
  boxRadius?: number
  boxWidthPx?: number
  /** 미리보기 문구 기울기(도). 반시계(-) / 시계(+) */
  rotationDeg?: number
}

/** 템플릿 미리보기 비전 분석 결과 */
export type AnalyzedTextBlock = {
  role: string
  xn: number
  yn: number
  fontSize: number
  fill: string
  stroke: string
  strokeWidth: number
  textAlign: TextAlignKind
  zIndex: number
  boxBackground?: boolean
  boxBackgroundColor?: string
  boxPaddingX?: number
  boxPaddingY?: number
  boxRadius?: number
  boxWidthPx?: number
  maxCharacters?: number
  /** 미리보기에서 읽은 문구 (편집용) */
  sampleText?: string
  rotationDeg?: number
}

export type AnalyzedTemplateStyleSpec = {
  templateId: string
  layoutSummary: string
  backgroundPromptEn: string
  subjectZone?: 'left' | 'right' | 'center' | 'full'
  colorPalette?: string[]
  textBlocks: AnalyzedTextBlock[]
  analyzedAt: number
  /** 생성된 배경 비전으로 문구 xn·yn·fontSize 등을 쓸 때 true */
  layoutFromGeneratedBackground?: boolean
  /** 템플릿 미리보기 비전으로 문구 xn·yn·fontSize·rotation 등을 쓸 때 true */
  layoutFromTemplatePreview?: boolean
}

export const TEMPLATE_LAYOUT_VISION_PROMPT = `You are a YouTube thumbnail layout analyst.

Analyze the reference thumbnail image (16:9). Extract layout, typography, colors, AND the readable text on each line.

Output ONE valid JSON object (no markdown, no commentary) with this shape:
{
  "layoutSummary": "one sentence in Korean describing layout",
  "backgroundPromptEn": "English prompt to generate a NEW background image in the SAME style: composition, lighting, colors, where the person/subject sits, where text zones are empty. MUST end with: 16:9, no text, no letters, no watermark.",
  "subjectZone": "left" | "right" | "center" | "full",
  "colorPalette": ["#hex", ...],
  "textBlocks": [
    {
      "role": "hook | highlight | main_title | sub | extra",
      "sampleText": "exact visible text for this line (Korean/English as shown)",
      "xn": 0.0-1.0,
      "yn": 0.0-1.0,
      "fontSize": 24-120,
      "fill": "#hex",
      "stroke": "#hex",
      "strokeWidth": 0-16,
      "textAlign": "left" | "center" | "right",
      "zIndex": 10-30,
      "boxBackground": true/false,
      "boxBackgroundColor": "rgba or #hex optional",
      "boxPaddingX": number optional,
      "boxPaddingY": number optional,
      "boxRadius": number optional,
      "maxCharacters": 6-18,
      "rotationDeg": number optional
    }
  ]
}

Rules:
- List textBlocks top-to-bottom by yn (ascending).
- xn, yn: top-left corner of each text line's bounding box (including background box), normalized 0-1 relative to 1280×720.
- xn for left-aligned text is the left edge of the box.
- fontSize: approximate canvas px height of the text line (largest line often 90-110).
- sampleText: OCR the visible characters; if unreadable use "".
- Match roles to catalog when obvious: top small box = hook, middle accent color = highlight, bottom largest = main_title.
- rotationDeg: estimate each line's tilt in degrees (counter-clockwise negative, e.g. -8). If all lines share the same tilt, use the same value.
- backgroundPromptEn: photo/background ONLY (blur, room, person side, mood) — no typography.
- If fewer than 3 text regions, still output what you see; if more than 4, keep the 4 most prominent.`

/** AI로 만든 배경(썸네일에 글자 없음) — 빈 영역·피사체 위치에 맞춰 문구 슬롯 배치 */
export function buildGeneratedBackgroundLayoutPrompt(
  templateId: string,
  catalogSlots: readonly CatalogTextSlotRef[],
): string {
  const slotLines = catalogSlots
    .map(
      (s, i) =>
        `${i + 1}. role="${s.slotKey}" label="${s.label}" maxChars=${s.maxCharacters} catalogFontSizePx=${s.fontSize} catalogHint xn=${s.xn} yn=${s.yn}`,
    )
    .join('\n')

  return `You are a YouTube thumbnail layout designer.

Analyze this 16:9 BACKGROUND IMAGE only. The image has NO text overlays yet (no letters on the image).

Template id: ${templateId}
You must output exactly ${catalogSlots.length} textBlocks (one per slot below), ordered top-to-bottom by yn.

Catalog slots (match role to slotKey; use empty/dark areas on the image for text, avoid covering the main subject face):
${slotLines}

Output ONE valid JSON object (no markdown):
{
  "layoutSummary": "one Korean sentence: where subject is and where text should go",
  "subjectZone": "left" | "right" | "center" | "full",
  "colorPalette": ["#hex", ...] optional,
  "textBlocks": [
    {
      "role": "must match slotKey from catalog",
      "sampleText": "",
      "xn": 0.02-0.92,
      "yn": 0.05-0.92,
      "fontSize": 24-120,
      "fill": "#hex readable on background",
      "stroke": "#hex",
      "strokeWidth": 0-16,
      "textAlign": "left" | "center" | "right",
      "zIndex": 10-30,
      "boxBackground": true/false,
      "boxBackgroundColor": "optional if low contrast",
      "maxCharacters": from catalog,
      "rotationDeg": optional
    }
  ]
}

Rules:
- Place text in NEGATIVE SPACE (darker/simpler areas), not on the subject.
- If subject is on the right, prefer text on the left (and vice versa).
- fontSize: YouTube thumbnail canvas px (1280×720). **Think like a top CTR template:** text must dominate the frame.
- Use catalogFontSizePx as the TARGET minimum for each slot — never go below catalogFontSizePx×0.95.
- main_title / largest line: 84–112px. highlight: 64–88px. hook / small top line: 42–58px.
- If negative space is wide, prefer LARGER fontSize (up to 120) over tiny safe text.
- xn, yn: top-left of each text box normalized 0-1 for 1280×720 (for center-aligned slots the app converts to horizontal center using measured text width). Match catalogHint when that zone is empty on the image; otherwise shift into visible negative space.
- Choose fill/stroke colors with strong contrast against the local background.
- backgroundPromptEn: omit or empty string.
- Do NOT invent text content; sampleText must be "".`
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function normHex(c: unknown, fallback: string): string {
  if (typeof c !== 'string') return fallback
  const t = c.trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return t
  if (/^rgba?\(/i.test(t)) return t
  return fallback
}

function normAlign(v: unknown): TextAlignKind {
  if (v === 'center' || v === 'right' || v === 'left') return v
  return 'left'
}

function normBlock(raw: unknown, index: number): AnalyzedTextBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const yn = typeof o.yn === 'number' ? o.yn : Number(o.yn)
  const xn = typeof o.xn === 'number' ? o.xn : Number(o.xn)
  if (!Number.isFinite(yn) || !Number.isFinite(xn)) return null
  const fontSize = typeof o.fontSize === 'number' ? o.fontSize : Number(o.fontSize) || 48
  return {
    role: typeof o.role === 'string' ? o.role.trim() : `slot_${index}`,
    xn: clamp(xn, 0.02, 0.92),
    yn: clamp(yn, 0.05, 0.95),
    fontSize: clamp(fontSize, 20, 120),
    fill: normHex(o.fill, '#ffffff'),
    stroke: normHex(o.stroke, '#000000'),
    strokeWidth: clamp(typeof o.strokeWidth === 'number' ? o.strokeWidth : Number(o.strokeWidth) || 0, 0, 20),
    textAlign: normAlign(o.textAlign),
    zIndex: clamp(typeof o.zIndex === 'number' ? o.zIndex : 20 - index, 10, 30),
    boxBackground: o.boxBackground === true,
    boxBackgroundColor:
      typeof o.boxBackgroundColor === 'string' ? o.boxBackgroundColor : undefined,
    boxPaddingX: typeof o.boxPaddingX === 'number' ? o.boxPaddingX : undefined,
    boxPaddingY: typeof o.boxPaddingY === 'number' ? o.boxPaddingY : undefined,
    boxRadius: typeof o.boxRadius === 'number' ? o.boxRadius : undefined,
    maxCharacters:
      typeof o.maxCharacters === 'number'
        ? clamp(o.maxCharacters, 4, 24)
        : undefined,
    sampleText:
      typeof o.sampleText === 'string'
        ? o.sampleText.trim()
        : typeof o.text === 'string'
          ? o.text.trim()
          : undefined,
    rotationDeg:
      typeof o.rotationDeg === 'number' && Number.isFinite(o.rotationDeg)
        ? clamp(o.rotationDeg, -45, 45)
        : typeof o.rotation === 'number' && Number.isFinite(o.rotation)
          ? clamp(o.rotation, -45, 45)
          : undefined,
  }
}

function extractJsonObjectText(raw: string): string {
  const t = raw.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) return fence[1].trim()
  const brace = t.match(/\{[\s\S]*\}/)
  return brace ? brace[0] : t
}

function readBackgroundPrompt(parsed: Record<string, unknown>): string {
  for (const key of [
    'backgroundPromptEn',
    'backgroundPrompt',
    'background_prompt',
    'background',
  ]) {
    const v = parsed[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function catalogSlotsToBlocks(catalogSlots: readonly CatalogTextSlotRef[]): AnalyzedTextBlock[] {
  return catalogSlots.map((slot) => ({
    role: slot.slotKey,
    sampleText: slot.samplePreviewText?.trim() || undefined,
    xn: slot.xn,
    yn: slot.yn,
    fontSize: slot.fontSize,
    fill: slot.fill,
    stroke: slot.stroke,
    strokeWidth: slot.strokeWidth,
    textAlign: slot.textAlign,
    zIndex: slot.zIndex,
    boxBackground: slot.boxBackground,
    boxBackgroundColor: slot.boxBackgroundColor,
    boxPaddingX: slot.boxPaddingX,
    boxPaddingY: slot.boxPaddingY,
    boxRadius: slot.boxRadius,
    maxCharacters: slot.maxCharacters,
  }))
}

export function parseTemplateStyleAnalysisJson(
  raw: string,
  templateId: string,
  catalogSlots: readonly CatalogTextSlotRef[],
): AnalyzedTemplateStyleSpec | null {
  const jsonText = extractJsonObjectText(raw)
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    return null
  }

  const blocksRaw = Array.isArray(parsed.textBlocks)
    ? parsed.textBlocks
    : Array.isArray(parsed.text_layers)
      ? parsed.text_layers
      : Array.isArray(parsed.layers)
        ? parsed.layers
        : []
  let blocks = blocksRaw
    .map((b, i) => normBlock(b, i))
    .filter((b): b is AnalyzedTextBlock => b != null)
    .sort((a, b) => a.yn - b.yn)

  if (blocks.length === 0 && catalogSlots.length > 0) {
    blocks = catalogSlotsToBlocks(catalogSlots)
  }

  let bg = readBackgroundPrompt(parsed)
  if (!bg && blocks.length > 0) {
    bg =
      'YouTube thumbnail background matching reference layout, 16:9, no text, no letters, no watermark.'
  }

  if (!bg && blocks.length === 0) return null

  const mergedBlocks =
    blocks.length > 0 ? mergeBlocksWithCatalog(blocks, catalogSlots) : catalogSlotsToBlocks(catalogSlots)

  return {
    templateId,
    layoutSummary:
      typeof parsed.layoutSummary === 'string' ? parsed.layoutSummary.trim() : '',
    backgroundPromptEn: bg,
    subjectZone:
      parsed.subjectZone === 'left' ||
      parsed.subjectZone === 'right' ||
      parsed.subjectZone === 'center' ||
      parsed.subjectZone === 'full'
        ? parsed.subjectZone
        : undefined,
    colorPalette: Array.isArray(parsed.colorPalette)
      ? parsed.colorPalette.filter((c): c is string => typeof c === 'string').slice(0, 8)
      : undefined,
    textBlocks: mergedBlocks,
    analyzedAt: Date.now(),
  }
}

const SLOT_ROLE_ALIASES: Record<string, readonly string[]> = {
  hook: ['hook', 'top', 'extra'],
  highlight: ['highlight', 'accent', 'middle', 'mid'],
  sub: ['sub', 'line3', 'third', 'body', 'middle2'],
  main_title: ['main_title', 'title', 'main', 'bottom', 'headline', 'line4', 'fourth'],
}

function pickBlockForCatalogSlot(
  analyzed: AnalyzedTextBlock[],
  sorted: AnalyzedTextBlock[],
  cat: CatalogTextSlotRef,
  index: number,
  used: Set<AnalyzedTextBlock>,
): AnalyzedTextBlock | undefined {
  const aliases = SLOT_ROLE_ALIASES[cat.slotKey] ?? [cat.slotKey]
  const byRole = analyzed.find((b) => {
    if (used.has(b)) return false
    const r = b.role.toLowerCase().replace(/[\s-]/g, '_')
    return aliases.some((a) => r === a || r.includes(a))
  })
  if (byRole) return byRole
  const byKey = analyzed.find((b) => !used.has(b) && b.role === cat.slotKey)
  if (byKey) return byKey
  return sorted[index] ?? sorted[sorted.length - 1]
}

/** 카탈로그 슬롯 키·maxCharacters 유지, 좌표·색은 분석값 우선 */
export function mergeBlocksWithCatalog(
  analyzed: AnalyzedTextBlock[],
  catalogSlots: readonly CatalogTextSlotRef[],
): AnalyzedTextBlock[] {
  const n = catalogSlots.length
  if (n === 0) return analyzed

  const sorted = [...analyzed].sort((a, b) => a.yn - b.yn)
  const out: AnalyzedTextBlock[] = []
  const used = new Set<AnalyzedTextBlock>()

  for (let i = 0; i < n; i++) {
    const cat = catalogSlots[i]
    const det = pickBlockForCatalogSlot(analyzed, sorted, cat, i, used)
    if (!det) break
    used.add(det)
    const sampleText =
      det.sampleText?.trim() ||
      cat.samplePreviewText?.trim() ||
      undefined
    out.push({
      ...det,
      role: cat.slotKey,
      sampleText,
      maxCharacters: cat.maxCharacters ?? det.maxCharacters ?? 12,
      zIndex: cat.zIndex ?? det.zIndex,
    })
  }
  return out
}

function catalogFontSizeFloor(slotKey: string, catalogFontSize: number): number {
  const ratio =
    slotKey === 'main_title' ? 1 : slotKey === 'hook' ? 0.96 : slotKey === 'highlight' ? 0.98 : 0.98
  return Math.round(catalogFontSize * ratio)
}

/** AI 분석 색·테두리·박스를 덮지 않고 카탈로그 시각 스타일 고정 (fontSize에 맞춰 strokeWidth만 비율 조정) */
export function applyCatalogVisualsToBlock(
  block: AnalyzedTextBlock,
  cat: CatalogTextSlotRef,
  fontSize: number,
): Pick<
  AnalyzedTextBlock,
  | 'fill'
  | 'stroke'
  | 'strokeWidth'
  | 'boxBackground'
  | 'boxBackgroundColor'
  | 'boxPaddingX'
  | 'boxPaddingY'
  | 'boxRadius'
  | 'boxWidthPx'
> {
  const strokeScale = fontSize / Math.max(cat.fontSize, 1)
  return {
    fill: cat.fill,
    stroke: cat.stroke,
    strokeWidth:
      cat.strokeWidth > 0 ? Math.max(1, Math.round(cat.strokeWidth * strokeScale)) : 0,
    boxBackground: cat.boxBackground ?? block.boxBackground,
    boxBackgroundColor: cat.boxBackgroundColor ?? block.boxBackgroundColor,
    boxPaddingX: cat.boxPaddingX ?? block.boxPaddingX,
    boxPaddingY: cat.boxPaddingY ?? block.boxPaddingY,
    boxRadius: cat.boxRadius ?? block.boxRadius,
    boxWidthPx: cat.boxWidthPx ?? block.boxWidthPx,
  }
}

/**
 * 생성·업로드 배경 비전 — AI 좌표·색 + 카탈로그 fontSize를 기본 목표로 큰 글씨 유지
 */
export function mergeBlocksWithCatalogForBackground(
  analyzed: AnalyzedTextBlock[],
  catalogSlots: readonly CatalogTextSlotRef[],
): AnalyzedTextBlock[] {
  const merged = mergeBlocksWithCatalog(analyzed, catalogSlots)
  return merged.map((block, i) => {
    const cat = catalogSlots[i]
    if (!cat) return block
    const floor = catalogFontSizeFloor(cat.slotKey, cat.fontSize)
    const target =
      cat.slotKey === 'main_title'
        ? Math.round(cat.fontSize * 1.08)
        : cat.slotKey === 'highlight'
          ? Math.round(cat.fontSize * 1.04)
          : cat.fontSize
    const fontSize = clamp(Math.max(block.fontSize, floor, target), floor, 140)
    const preserveCenterLayout =
      cat.textAlign === 'center' && Math.abs(cat.xn - 0.5) < 0.12
    return {
      ...block,
      ...applyCatalogVisualsToBlock(block, cat, fontSize),
      xn: preserveCenterLayout ? cat.xn : block.xn,
      textAlign: preserveCenterLayout ? cat.textAlign : block.textAlign,
      fontSize,
      rotationDeg: block.rotationDeg ?? cat.rotationDeg,
    }
  })
}

/**
 * 템플릿 미리보기 비전 — AI가 읽은 위치·크기·회전·색 + 카탈로그 슬롯 키·fontSize 하한
 */
export function mergeBlocksWithCatalogForTemplatePreview(
  analyzed: AnalyzedTextBlock[],
  catalogSlots: readonly CatalogTextSlotRef[],
): AnalyzedTextBlock[] {
  const merged = mergeBlocksWithCatalog(analyzed, catalogSlots)
  return merged.map((block, i) => {
    const cat = catalogSlots[i]
    if (!cat) return block
    const floor = catalogFontSizeFloor(cat.slotKey, cat.fontSize)
    const target =
      cat.slotKey === 'main_title'
        ? Math.round(cat.fontSize * 1.05)
        : cat.slotKey === 'highlight'
          ? Math.round(cat.fontSize * 1.02)
          : cat.fontSize
    const fontSize = clamp(Math.max(block.fontSize, floor, target), floor, 140)
    return {
      ...block,
      ...applyCatalogVisualsToBlock(block, cat, fontSize),
      role: cat.slotKey,
      xn: block.xn,
      yn: block.yn,
      fontSize,
      textAlign: block.textAlign || cat.textAlign,
      rotationDeg: block.rotationDeg ?? cat.rotationDeg,
      maxCharacters: cat.maxCharacters ?? block.maxCharacters,
      zIndex: cat.zIndex ?? block.zIndex,
      sampleText:
        block.sampleText?.trim() || cat.samplePreviewText?.trim() || undefined,
    }
  })
}

/** 비전 yn(박스 상단) → 캔버스 textBaseline:middle 기준 y */
export function analyzedBlockToCanvasPosition(
  block: Pick<
    AnalyzedTextBlock,
    'xn' | 'yn' | 'fontSize' | 'textAlign' | 'boxBackground' | 'boxPaddingY'
  >,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const padY = block.boxPaddingY ?? 10
  const lineH = block.fontSize * 1.1
  const boxH = block.boxBackground ? lineH + padY * 2 : lineH
  const y = block.yn * canvasH + boxH / 2
  const x =
    block.textAlign === 'right'
      ? block.xn * canvasW
      : block.textAlign === 'center'
        ? block.xn * canvasW
        : block.xn * canvasW
  return { x, y }
}

export function analyzedBlocksToSlotDefs(blocks: AnalyzedTextBlock[]): CatalogTextSlotRef[] {
  return blocks.map((b) => ({
    slotKey: b.role,
    label: b.role,
    maxCharacters: b.maxCharacters ?? 12,
    xn: b.xn,
    yn: b.yn,
    fontSize: b.fontSize,
    fill: b.fill,
    stroke: b.stroke,
    strokeWidth: b.strokeWidth,
    textAlign: b.textAlign,
    zIndex: b.zIndex,
    boxBackground: b.boxBackground,
    boxBackgroundColor: b.boxBackgroundColor,
    boxPaddingX: b.boxPaddingX,
    boxPaddingY: b.boxPaddingY,
    boxRadius: b.boxRadius,
    rotationDeg: b.rotationDeg,
  }))
}

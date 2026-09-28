/** 앱에 포함된 웹폰트 — public/fonts (Vite·설치형 빌드 공통) */
import { resolveTemplatePreviewAssetUrl } from '@/lib/longform-v2/thumbnailTemplateStudio/templatePreviewUrl'

export type BundledFontFace = {
  /** CSS font-family (캔버스·UI 공통) */
  family: string
  label: string
  url: string
  weight: number
}

export const BUNDLED_FONT_FACES: readonly BundledFontFace[] = [
  { family: 'Gmarket Sans Bold', label: 'G마켓 산스 Bold', url: '/fonts/gmarket-sans-bold.ttf', weight: 700 },
  { family: 'Gmarket Sans Medium', label: 'G마켓 산스 Medium', url: '/fonts/gmarket-sans-medium.ttf', weight: 500 },
  { family: 'Gmarket Sans Light', label: 'G마켓 산스 Light', url: '/fonts/gmarket-sans-light.ttf', weight: 300 },
  { family: 'Nanum Barun Gothic Bold', label: '나눔바른고딕 Bold', url: '/fonts/nanum-barun-gothic-bold.ttf', weight: 700 },
  { family: 'Nanum Barun Gothic', label: '나눔바른고딕', url: '/fonts/nanum-barun-gothic.ttf', weight: 400 },
  { family: 'Nanum Barun Gothic Light', label: '나눔바른고딕 Light', url: '/fonts/nanum-barun-gothic-light.ttf', weight: 300 },
  {
    family: 'Nanum Barun Gothic UltraLight',
    label: '나눔바른고딕 UltraLight',
    url: '/fonts/nanum-barun-gothic-ultralight.ttf',
    weight: 200,
  },
  {
    family: 'Gangwon Education Modu Bold',
    label: '강원교육 모두 Bold',
    url: '/fonts/gangwon-modu-bold.ttf',
    weight: 700,
  },
  {
    family: 'Gangwon Education Modu Light',
    label: '강원교육 모두 Light',
    url: '/fonts/gangwon-modu-light.ttf',
    weight: 300,
  },
  { family: 'Gangwon Education Saeeum', label: '강원교육 새음', url: '/fonts/gangwon-saeeum.ttf', weight: 400 },
  { family: 'Gangwon Education Tuntun', label: '강원교육 튼튼', url: '/fonts/gangwon-tuntun.ttf', weight: 400 },
  {
    family: 'Gangwon Education Hyeonok',
    label: '강원교육 현옥샘',
    url: '/fonts/gangwon-hyeonok.ttf',
    weight: 400,
  },
  {
    family: 'Nanum Handwriting Galmaetgeul',
    label: '나눔손글씨 갈맷글',
    url: '/fonts/nanum-handwriting-galmaetgeul.ttf',
    weight: 400,
  },
  {
    family: 'Nanum Handwriting Garam Yeonkot',
    label: '나눔손글씨 가람연꽃',
    url: '/fonts/nanum-handwriting-garamyeonkot.ttf',
    weight: 400,
  },
  {
    family: 'Nanum Handwriting Gang Bujangnim',
    label: '나눔손글씨 강부장님체',
    url: '/fonts/nanum-handwriting-gangbujang.ttf',
    weight: 400,
  },
  {
    family: 'Cafe24 PRO Slim Max',
    label: 'Cafe24 PRO Slim Max',
    url: '/fonts/cafe24-pro-slim-max.ttf',
    weight: 400,
  },
  { family: 'SB Aggro Light', label: 'SB 어그로 Light', url: '/fonts/sb-aggro-light.ttf', weight: 300 },
  { family: 'SB Aggro Medium', label: 'SB 어그로 Medium', url: '/fonts/sb-aggro-medium.ttf', weight: 500 },
  { family: 'SB Aggro Bold', label: 'SB 어그로 Bold', url: '/fonts/sb-aggro-bold.ttf', weight: 700 },
  {
    family: 'HS Santokki',
    label: 'HS 산토끼',
    url: '/fonts/hs-santokki-regular.ttf',
    weight: 400,
  },
  {
    family: 'TMON Monsori Black',
    label: 'TMON몬소리 Black',
    url: '/fonts/tmon-monsori-black.ttf',
    weight: 900,
  },
] as const

const FALLBACK_STACK = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif'

/** font-family CSS 값 (따옴표 포함) */
export function bundledFontStack(family: string): string {
  return `"${family}", ${FALLBACK_STACK}`
}

/** 썸네일·캔버스 기본 */
export const DEFAULT_THUMBNAIL_FONT_STACK = bundledFontStack('Gmarket Sans Bold')

export type ThumbnailFontWeightOption = {
  id: string
  label: string
  faceFamily: string
  weight: number
  stack: string
}

export type ThumbnailFontFamilyOption = {
  id: string
  label: string
  kind: 'bundled' | 'system'
  /** 2개 이상일 때만 굵기 선택 UI 표시 */
  weights?: readonly ThumbnailFontWeightOption[]
  /** 단일 굵기·시스템 폰트 */
  stack?: string
}

function w(
  id: string,
  label: string,
  faceFamily: string,
  weight: number,
): ThumbnailFontWeightOption {
  return { id, label, faceFamily, weight, stack: bundledFontStack(faceFamily) }
}

/** 썸네일 편집기 — 패밀리 + (선택) 굵기 */
export const THUMBNAIL_FONT_FAMILIES: readonly ThumbnailFontFamilyOption[] = [
  {
    id: 'gmarket-sans',
    label: 'G마켓 산스',
    kind: 'bundled',
    weights: [
      w('light', 'Light', 'Gmarket Sans Light', 300),
      w('medium', 'Medium', 'Gmarket Sans Medium', 500),
      w('bold', 'Bold', 'Gmarket Sans Bold', 700),
    ],
  },
  {
    id: 'nanum-barun',
    label: '나눔바른고딕',
    kind: 'bundled',
    weights: [
      w('ultralight', 'UltraLight', 'Nanum Barun Gothic UltraLight', 200),
      w('light', 'Light', 'Nanum Barun Gothic Light', 300),
      w('regular', '보통', 'Nanum Barun Gothic', 400),
      w('bold', 'Bold', 'Nanum Barun Gothic Bold', 700),
    ],
  },
  {
    id: 'gangwon-modu',
    label: '강원교육 모두',
    kind: 'bundled',
    weights: [
      w('light', 'Light', 'Gangwon Education Modu Light', 300),
      w('bold', 'Bold', 'Gangwon Education Modu Bold', 700),
    ],
  },
  {
    id: 'gangwon-saeeum',
    label: '강원교육 새음',
    kind: 'bundled',
    stack: bundledFontStack('Gangwon Education Saeeum'),
  },
  {
    id: 'gangwon-tuntun',
    label: '강원교육 튼튼',
    kind: 'bundled',
    stack: bundledFontStack('Gangwon Education Tuntun'),
  },
  {
    id: 'gangwon-hyeonok',
    label: '강원교육 현옥샘',
    kind: 'bundled',
    stack: bundledFontStack('Gangwon Education Hyeonok'),
  },
  {
    id: 'nanum-galmaetgeul',
    label: '나눔손글씨 갈맷글',
    kind: 'bundled',
    stack: bundledFontStack('Nanum Handwriting Galmaetgeul'),
  },
  {
    id: 'nanum-garamyeonkot',
    label: '나눔손글씨 가람연꽃',
    kind: 'bundled',
    stack: bundledFontStack('Nanum Handwriting Garam Yeonkot'),
  },
  {
    id: 'nanum-gangbujang',
    label: '나눔손글씨 강부장님체',
    kind: 'bundled',
    stack: bundledFontStack('Nanum Handwriting Gang Bujangnim'),
  },
  {
    id: 'cafe24-pro-slim-max',
    label: 'Cafe24 PRO Slim Max',
    kind: 'bundled',
    stack: bundledFontStack('Cafe24 PRO Slim Max'),
  },
  {
    id: 'sb-aggro',
    label: 'SB 어그로',
    kind: 'bundled',
    weights: [
      w('light', 'Light', 'SB Aggro Light', 300),
      w('medium', 'Medium', 'SB Aggro Medium', 500),
      w('bold', 'Bold', 'SB Aggro Bold', 700),
    ],
  },
  {
    id: 'hs-santokki',
    label: 'HS 산토끼',
    kind: 'bundled',
    stack: bundledFontStack('HS Santokki'),
  },
  {
    id: 'tmon-monsori-black',
    label: 'TMON몬소리 Black',
    kind: 'bundled',
    stack: bundledFontStack('TMON Monsori Black'),
  },
  {
    id: 'system-ui',
    label: '고딕 (시스템)',
    kind: 'system',
    stack: 'system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
  },
  {
    id: 'black-han-sans',
    label: '블랙 한산 (웹)',
    kind: 'system',
    stack: '"Black Han Sans", "Malgun Gothic", sans-serif',
  },
  {
    id: 'noto-sans-kr',
    label: 'Noto Sans KR (웹)',
    kind: 'system',
    stack: '"Noto Sans KR", sans-serif',
  },
  {
    id: 'impact',
    label: 'Impact',
    kind: 'system',
    stack: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
  },
]

export type FontFamilySelection = {
  familyId: string
  weightId: string | null
}

export function getFontFamilyOption(id: string): ThumbnailFontFamilyOption | undefined {
  return THUMBNAIL_FONT_FAMILIES.find((f) => f.id === id)
}

export function defaultWeightForFamily(family: ThumbnailFontFamilyOption): ThumbnailFontWeightOption | null {
  const weights = family.weights
  if (!weights?.length) return null
  return (
    weights.find((x) => x.id === 'bold') ??
    weights.find((x) => x.id === 'medium') ??
    weights.find((x) => x.id === 'regular') ??
    weights[weights.length - 1]
  )
}

export function stackForFontSelection(sel: FontFamilySelection): string {
  const family = getFontFamilyOption(sel.familyId)
  if (!family) return DEFAULT_THUMBNAIL_FONT_STACK
  if (family.stack) return family.stack
  const weights = family.weights ?? []
  if (!weights.length) return DEFAULT_THUMBNAIL_FONT_STACK
  const pick =
    weights.find((x) => x.id === sel.weightId) ?? defaultWeightForFamily(family) ?? weights[0]
  return pick.stack
}

/** 현재 fontFamily CSS → 패밀리·굵기 id */
export function resolveFontFamilySelection(fontFamily: string): FontFamilySelection {
  const norm = fontFamily.trim()
  for (const family of THUMBNAIL_FONT_FAMILIES) {
    if (family.stack && family.stack === norm) {
      return { familyId: family.id, weightId: null }
    }
    for (const weight of family.weights ?? []) {
      if (weight.stack === norm) {
        return { familyId: family.id, weightId: weight.id }
      }
    }
  }
  const primary = primaryFamilyFromCss(norm)
  if (primary) {
    for (const family of THUMBNAIL_FONT_FAMILIES) {
      for (const weight of family.weights ?? []) {
        if (weight.faceFamily === primary) {
          return { familyId: family.id, weightId: weight.id }
        }
      }
      if (family.stack && primaryFamilyFromCss(family.stack) === primary) {
        return { familyId: family.id, weightId: null }
      }
    }
  }
  return { familyId: 'gmarket-sans', weightId: 'bold' }
}

export function familyHasWeightPicker(familyId: string): boolean {
  const family = getFontFamilyOption(familyId)
  return (family?.weights?.length ?? 0) > 1
}

/** @deprecated 자막 등 플랫 목록 — 썸네일 UI는 THUMBNAIL_FONT_FAMILIES 사용 */
export const THUMBNAIL_BUNDLED_FONT_OPTIONS: readonly { label: string; value: string }[] =
  BUNDLED_FONT_FACES.map((f) => ({
    label: f.label,
    value: bundledFontStack(f.family),
  }))

/** @deprecated 플랫 목록 */
export const THUMBNAIL_FONT_OPTIONS: readonly { label: string; value: string }[] = [
  ...THUMBNAIL_FONT_FAMILIES.flatMap((f) => {
    if (f.stack) return [{ label: f.label, value: f.stack }]
    return (f.weights ?? []).map((w) => ({ label: `${f.label} ${w.label}`, value: w.stack }))
  }),
]

function primaryFamilyFromCss(fontFamily: string): string | null {
  const m = fontFamily.match(/"([^"]+)"/)
  return m?.[1] ?? null
}

export function canvasFontWeightForFamily(fontFamily: string): number {
  const primary = primaryFamilyFromCss(fontFamily)
  if (!primary) return 800
  const face = BUNDLED_FONT_FACES.find((f) => f.family === primary)
  return face?.weight ?? 800
}

/** Canvas 2D ctx.font — 번들 폰트 weight 자동 매칭 */
export function canvasFontString(fontSize: number, fontFamily: string): string {
  const w = canvasFontWeightForFamily(fontFamily)
  return `${w} ${fontSize}px ${fontFamily}`
}

const BUNDLED_FONT_STYLE_ID = 'wings-bundled-thumbnail-fonts'
/** FontFace API로 등록에 성공한 키 (family::weight) — check() 오탐 방지 */
const registeredFaceKeys = new Set<string>()
const inFlightFaceLoads = new Map<string, Promise<void>>()
let fontsLoadPromise: Promise<void> | null = null
/** 일부 실패 시 다음 ensure에서 재시도 */
let fontsLoadHadFailure = false

function faceKey(def: BundledFontFace): string {
  return `${def.family}::${def.weight}`
}

function resolveBundledFontUrl(path: string): string {
  return resolveTemplatePreviewAssetUrl(path)
}

/** CSS @font-face 주입 — FontFace API 실패·UI 미리보기 공통 폴백 */
function injectBundledFontFaceStylesheet(): void {
  if (typeof document === 'undefined') return
  const existing = document.getElementById(BUNDLED_FONT_STYLE_ID)
  if (existing) return

  const css = BUNDLED_FONT_FACES.map((def) => {
    const url = resolveBundledFontUrl(def.url).replace(/'/g, "\\'")
    return (
      `@font-face{font-family:'${def.family}';` +
      `src:url('${url}') format('truetype');` +
      `font-weight:${def.weight};font-style:normal;font-display:swap;}`
    )
  }).join('\n')

  const style = document.createElement('style')
  style.id = BUNDLED_FONT_STYLE_ID
  style.textContent = css
  document.head.appendChild(style)
}

async function loadOneBundledFace(def: BundledFontFace): Promise<void> {
  const key = faceKey(def)
  if (registeredFaceKeys.has(key)) return

  const pending = inFlightFaceLoads.get(key)
  if (pending) {
    await pending
    return
  }

  const run = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return

    const url = resolveBundledFontUrl(def.url)
    try {
      const face = new FontFace(def.family, `url("${url}")`, {
        weight: String(def.weight),
        style: 'normal',
        display: 'swap',
      })
      await face.load()
      document.fonts.add(face)
      registeredFaceKeys.add(key)
      return
    } catch {
      /* 이미 등록됐거나 FontFace 실패 → CSS @font-face / fonts.load 폴백 */
    }

    try {
      await document.fonts.load(`${def.weight} 16px "${def.family}"`)
      if (document.fonts.check(`${def.weight} 16px "${def.family}"`)) {
        registeredFaceKeys.add(key)
      } else {
        fontsLoadHadFailure = true
      }
    } catch {
      fontsLoadHadFailure = true
    }
  })()

  inFlightFaceLoads.set(key, run)
  try {
    await run
  } finally {
    inFlightFaceLoads.delete(key)
  }
}

function facesMatchingCssFamily(fontFamilyCss: string): BundledFontFace[] {
  const primary = primaryFamilyFromCss(fontFamilyCss.trim())
  if (!primary) return []
  return BUNDLED_FONT_FACES.filter((f) => f.family === primary)
}

/**
 * 선택한 CSS font-family(스택)에 해당하는 번들 폰트만 우선 로드.
 * PC에 해당 폰트가 없어도 public/fonts 에서 자동 등록.
 */
export function ensureBundledFontForCssFamily(fontFamilyCss: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) {
    return Promise.resolve()
  }
  injectBundledFontFaceStylesheet()
  const faces = facesMatchingCssFamily(fontFamilyCss)
  if (!faces.length) return Promise.resolve()
  return Promise.all(faces.map((f) => loadOneBundledFace(f))).then(() => undefined)
}

/** 캔버스 렌더 전 호출 — FontFace + @font-face 로 번들 폰트 등록 (PC 미설치 OK) */
export function ensureBundledFontsLoaded(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) {
    return Promise.resolve()
  }
  if (fontsLoadPromise && !fontsLoadHadFailure) return fontsLoadPromise

  fontsLoadHadFailure = false
  fontsLoadPromise = (async () => {
    injectBundledFontFaceStylesheet()
    await Promise.all(BUNDLED_FONT_FACES.map((def) => loadOneBundledFace(def)))
    try {
      await document.fonts.ready
    } catch {
      /* ignore */
    }
    // 전부 실패했으면 다음 호출에서 재시도 가능하도록
    if (fontsLoadHadFailure) {
      fontsLoadPromise = null
    }
  })()

  return fontsLoadPromise
}

import {
  SCENE_STYLE_CATALOG,
  sceneStyleCategoryLabel,
  type SceneStyleCategory,
  type SceneStyleItem,
} from '@/lib/longform-v2/image-styles'
import { resolveEffectiveCustomStylePrompt } from '@/lib/longform-v2/youtube/artStylePresets'
import {
  imageLocaleModeLabel,
  resolveImageLocaleMode,
  type ImageLocaleMode,
} from '@/lib/longform-v2/youtube/imageLocaleMode'
import { SCENE_IMAGE_MODEL_OPTIONS, sceneImageModelLabel, type SceneImageModelId } from '@/lib/longform-v2/thumbnail-bridge/sceneImageModelOptions'

export type ThumbnailGenSettings = {
  imageModel: SceneImageModelId
  styleCategory: SceneStyleCategory
  styleTemplateId: string
  /** 배경 인물·배경 문화권 — 한국풍 / 외국풍 / AI 판단 */
  imagesLocaleMode: ImageLocaleMode
}

const STORAGE_KEY = 'wingsThumbGenSettings:v1'

const THUMB_STYLE_CATEGORIES: SceneStyleCategory[] = [
  '실사',
  '애니메이션',
  '일러스트',
  '정보성 캐릭터',
  '전통화',
  'NEW',
]

export function thumbnailStyleCategoriesForModel(model: string): SceneStyleCategory[] {
  const base = [...THUMB_STYLE_CATEGORIES]
  if (model === 'nano2') return [...base, 'ppt-korean-explain']
  return base
}

export const DEFAULT_THUMBNAIL_GEN_SETTINGS: ThumbnailGenSettings = {
  imageModel: 'nano2',
  styleCategory: '실사',
  styleTemplateId: SCENE_STYLE_CATALOG.실사[0]!.id,
  imagesLocaleMode: 'korean',
}

function findStyleItem(category: SceneStyleCategory, templateId: string): SceneStyleItem {
  const list = SCENE_STYLE_CATALOG[category] ?? SCENE_STYLE_CATALOG.실사
  return list.find((s) => s.id === templateId) ?? list[0]!
}

export function normalizeThumbnailGenSettings(
  partial: Partial<ThumbnailGenSettings>,
  fallback: ThumbnailGenSettings = DEFAULT_THUMBNAIL_GEN_SETTINGS,
): ThumbnailGenSettings {
  const imageModel = (partial.imageModel ?? fallback.imageModel) as SceneImageModelId
  let styleCategory = (partial.styleCategory ?? fallback.styleCategory) as SceneStyleCategory
  const cats = thumbnailStyleCategoriesForModel(imageModel)
  if (styleCategory === '커스텀' || !cats.includes(styleCategory)) {
    styleCategory = cats[0] ?? '실사'
  }
  const styles = SCENE_STYLE_CATALOG[styleCategory] ?? SCENE_STYLE_CATALOG.실사
  let styleTemplateId = (partial.styleTemplateId ?? fallback.styleTemplateId)?.trim() ?? ''
  if (styleTemplateId && !styles.some((s) => s.id === styleTemplateId)) {
    /** 카테고리·템플릿 id 불일치(예: NEW/hq-stickman + 실사) → id 기준으로 카테고리 복구 */
    for (const cat of cats) {
      const list = SCENE_STYLE_CATALOG[cat] ?? []
      if (list.some((s) => s.id === styleTemplateId)) {
        styleCategory = cat
        break
      }
    }
  }
  const resolvedStyles = SCENE_STYLE_CATALOG[styleCategory] ?? SCENE_STYLE_CATALOG.실사
  styleTemplateId =
    resolvedStyles.find((s) => s.id === styleTemplateId)?.id ?? resolvedStyles[0]!.id
  const imagesLocaleMode = resolveImageLocaleMode({
    mode: partial.imagesLocaleMode ?? fallback.imagesLocaleMode,
  })
  return { imageModel, styleCategory, styleTemplateId, imagesLocaleMode }
}

export function hasSavedThumbnailGenSettings(projectId: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_KEY}:${projectId.trim()}`) != null
  } catch {
    return false
  }
}

/** AI 이미지(씬) 저장 payload → 썸네일 생성 기본 설정 */
export function resolveThumbnailGenSettingsFromScenePayload(
  payload: Record<string, unknown>,
): ThumbnailGenSettings | null {
  const st = payload.settings
  if (!st || typeof st !== 'object' || Array.isArray(st)) return null
  const s = st as Record<string, unknown>
  const ts = payload.templateSettings
  const t =
    ts && typeof ts === 'object' && !Array.isArray(ts) ? (ts as Record<string, unknown>) : null

  const rawModel = typeof s.model === 'string' ? s.model.trim() : ''
  const imageModel = (
    SCENE_IMAGE_MODEL_OPTIONS.some((o) => o.id === rawModel) ? rawModel : DEFAULT_THUMBNAIL_GEN_SETTINGS.imageModel
  ) as SceneImageModelId

  let styleCategory = (
    typeof s.styleCategory === 'string' && s.styleCategory in SCENE_STYLE_CATALOG
      ? s.styleCategory
      : typeof t?.category === 'string' && t.category in SCENE_STYLE_CATALOG
        ? t.category
        : DEFAULT_THUMBNAIL_GEN_SETTINGS.styleCategory
  ) as SceneStyleCategory

  const tplRaw =
    (typeof s.styleTemplateId === 'string' && s.styleTemplateId.trim()) ||
    (typeof t?.templateId === 'string' && t.templateId.trim()) ||
    ''

  const localeRaw =
    (typeof s.sceneImagesLocaleMode === 'string' && s.sceneImagesLocaleMode.trim()) ||
    (typeof s.scene_images_locale_mode === 'string' && s.scene_images_locale_mode.trim()) ||
    ''

  return normalizeThumbnailGenSettings(
    {
      imageModel,
      styleCategory,
      styleTemplateId: tplRaw || undefined,
      imagesLocaleMode: localeRaw ? resolveImageLocaleMode({ mode: localeRaw }) : undefined,
    },
    DEFAULT_THUMBNAIL_GEN_SETTINGS,
  )
}

/** 씬 `settings.customStylePrompt` — 커스텀·NEW 프리셋 스타일 */
export function resolveSceneCustomStylePromptFromPayload(payload: Record<string, unknown>): string {
  const st = payload.settings
  if (!st || typeof st !== 'object' || Array.isArray(st)) return ''
  const settings = st as Record<string, unknown>
  const templateSettings = payload.templateSettings
  const tpl =
    templateSettings && typeof templateSettings === 'object' && !Array.isArray(templateSettings)
      ? (templateSettings as Record<string, unknown>)
      : {}
  const raw = settings.customStylePrompt ?? settings.custom_style_prompt
  const stored = typeof raw === 'string' ? raw.trim() : ''
  const category = String(settings.styleCategory ?? tpl.category ?? '').trim()
  const templateId = String(settings.styleTemplateId ?? tpl.templateId ?? '').trim()
  return resolveEffectiveCustomStylePrompt(category, templateId, stored)
}

export function loadThumbnailGenSettings(
  projectId: string,
  sceneDefault?: ThumbnailGenSettings | null,
): ThumbnailGenSettings {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${projectId.trim()}`)
    if (!raw) {
      return sceneDefault
        ? normalizeThumbnailGenSettings(sceneDefault)
        : { ...DEFAULT_THUMBNAIL_GEN_SETTINGS }
    }
    const j = JSON.parse(raw) as Partial<ThumbnailGenSettings>
    return normalizeThumbnailGenSettings(j)
  } catch {
    return sceneDefault
      ? normalizeThumbnailGenSettings(sceneDefault)
      : { ...DEFAULT_THUMBNAIL_GEN_SETTINGS }
  }
}

export function saveThumbnailGenSettings(projectId: string, settings: ThumbnailGenSettings): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${projectId.trim()}`, JSON.stringify(settings))
  } catch {
    /* quota */
  }
}

export function resolveThumbnailCustomStylePrompt(settings: ThumbnailGenSettings): string {
  return resolveEffectiveCustomStylePrompt(
    settings.styleCategory,
    settings.styleTemplateId,
    '',
  )
}

/** API `thumbnailStyle` — 실사/애니 계열 */
export function thumbnailStyleFromGenSettings(
  settings: ThumbnailGenSettings,
): 'realism' | 'animation' | null {
  const c = settings.styleCategory
  if (c === '실사') return 'realism'
  if (c === '애니메이션' || c === '일러스트' || c === '정보성 캐릭터' || c === 'ppt-korean-explain' || c === 'NEW') {
    return 'animation'
  }
  return null
}

export function thumbnailImageStyleHint(
  settings: ThumbnailGenSettings,
  sceneStyleLabel?: string,
): string {
  const label = sceneStyleLabel?.trim()
  if (label) {
    return `YouTube thumbnail, match scene image style: ${label}. Bold composition, high contrast, readable at small size.`
  }
  const item = findStyleItem(settings.styleCategory, settings.styleTemplateId)
  return `YouTube thumbnail, ${sceneStyleCategoryLabel(settings.styleCategory)} style: ${item.label}. Bold composition, high contrast, readable at small size.`
}

export function thumbnailGenSettingsSummary(settings: ThumbnailGenSettings): string {
  const item = findStyleItem(settings.styleCategory, settings.styleTemplateId)
  return `${item.label} (${sceneStyleCategoryLabel(settings.styleCategory)})`
}

export function thumbnailGenSettingsFullSummary(settings: ThumbnailGenSettings): string {
  const item = findStyleItem(settings.styleCategory, settings.styleTemplateId)
  return `${sceneImageModelLabel(settings.imageModel)} · ${item.label} · ${sceneStyleCategoryLabel(settings.styleCategory)} · ${imageLocaleModeLabel(settings.imagesLocaleMode)}`
}

export function thumbnailGenSelectedStyleItem(settings: ThumbnailGenSettings): SceneStyleItem {
  return findStyleItem(settings.styleCategory, settings.styleTemplateId)
}

/** 썸네일 이미지 API — 수동 스튜디오·AI 공장 공통 */
export function thumbnailStyleApiPayload(settings: ThumbnailGenSettings): {
  imageModel: SceneImageModelId
  imageStyle: string
  thumbnailStyle: 'realism' | 'animation' | null
  styleCategory: SceneStyleCategory
  styleTemplateId: string
  imagesLocaleMode: ImageLocaleMode
  customStylePrompt: string
} {
  return {
    imageModel: settings.imageModel,
    imageStyle: thumbnailImageStyleHint(settings),
    thumbnailStyle: thumbnailStyleFromGenSettings(settings),
    styleCategory: settings.styleCategory,
    styleTemplateId: settings.styleTemplateId,
    imagesLocaleMode: settings.imagesLocaleMode,
    customStylePrompt: resolveThumbnailCustomStylePrompt(settings),
  }
}

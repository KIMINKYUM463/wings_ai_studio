import type { ThumbnailProTemplate, TemplateTextSlotDef, ThumbnailExportFrame } from './types'

const STORAGE_KEY = 'wingsstudio.thumbnailCustomTemplates.v1'
export const CUSTOM_TEMPLATE_ID_PREFIX = 'custom_'

export type StoredCustomThumbnailTemplate = ThumbnailProTemplate & {
  isCustom: true
  createdAt: number
  updatedAt: number
  basedOnTemplateId?: string
}

type StoragePayload = {
  version: 1
  templates: StoredCustomThumbnailTemplate[]
}

export const CUSTOM_TEMPLATES_CHANGED_EVENT = 'wings-custom-templates-changed'

const DEFAULT_BG_PROMPT =
  'YouTube thumbnail background illustrating VIDEO TOPIC only (not template sample photo). Cinematic 16:9, no text, no letters. Topic: {topic}. Script mood: {scriptExcerpt}'

function notifyChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CUSTOM_TEMPLATES_CHANGED_EVENT))
}

function readPayload(): StoragePayload {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: 1, templates: [] }
    const parsed = JSON.parse(raw) as StoragePayload
    if (parsed?.version !== 1 || !Array.isArray(parsed.templates)) {
      return { version: 1, templates: [] }
    }
    return {
      version: 1,
      templates: parsed.templates.filter(
        (t) => t && typeof t.id === 'string' && t.id.startsWith(CUSTOM_TEMPLATE_ID_PREFIX),
      ),
    }
  } catch {
    return { version: 1, templates: [] }
  }
}

function writePayload(payload: StoragePayload): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    notifyChanged()
  } catch {
    throw new Error('커스텀 템플릿 저장에 실패했습니다. 미리보기 이미지가 너무 크면 제거 후 다시 시도해 보세요.')
  }
}

export function isCustomTemplateId(id: string): boolean {
  return id.startsWith(CUSTOM_TEMPLATE_ID_PREFIX)
}

export function loadCustomTemplates(): StoredCustomThumbnailTemplate[] {
  return readPayload().templates
}

export function getCustomTemplate(id: string): StoredCustomThumbnailTemplate | undefined {
  return loadCustomTemplates().find((t) => t.id === id)
}

export function subscribeCustomTemplates(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CUSTOM_TEMPLATES_CHANGED_EVENT, onChange)
  return () => window.removeEventListener(CUSTOM_TEMPLATES_CHANGED_EVENT, onChange)
}

export function newCustomTemplateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${CUSTOM_TEMPLATE_ID_PREFIX}${crypto.randomUUID()}`
  }
  return `${CUSTOM_TEMPLATE_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createBlankCustomTemplate(partial?: {
  label?: string
  description?: string
  textSlots?: TemplateTextSlotDef[]
}): StoredCustomThumbnailTemplate {
  const now = Date.now()
  return {
    id: newCustomTemplateId(),
    isCustom: true,
    label: partial?.label?.trim() || '내 템플릿',
    description:
      partial?.description?.trim() ||
      '커스텀 레이아웃입니다. 캔버스에서 문구 위치·스타일을 수정한 뒤 다시 저장할 수 있습니다.',
    tags: ['커스텀'],
    previewCss: 'linear-gradient(135deg, #0f172a 0%, #334155 50%, #64748b 100%)',
    backgroundPromptTemplate: DEFAULT_BG_PROMPT,
    textSlots: partial?.textSlots ?? defaultBlankSlots(),
    createdAt: now,
    updatedAt: now,
  }
}

function defaultBlankSlots(): TemplateTextSlotDef[] {
  return [
    {
      slotKey: 'hook',
      label: '첫번째 문구',
      samplePreviewText: '첫번째 문구',
      maxCharacters: 14,
      xn: 0.06,
      yn: 0.68,
      fontSize: 58,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 10,
      textAlign: 'left',
      zIndex: 22,
    },
    {
      slotKey: 'main_title',
      label: '두번째 문구',
      samplePreviewText: '두번째 문구',
      maxCharacters: 14,
      xn: 0.06,
      yn: 0.82,
      fontSize: 68,
      fill: '#4ade80',
      stroke: '#000000',
      strokeWidth: 12,
      textAlign: 'left',
      zIndex: 21,
    },
  ]
}

export function cloneBuiltinAsCustom(
  source: ThumbnailProTemplate,
  overrides?: Partial<Pick<StoredCustomThumbnailTemplate, 'label' | 'description' | 'tags' | 'previewImageUrl'>>,
): StoredCustomThumbnailTemplate {
  const now = Date.now()
  return {
    ...source,
    id: newCustomTemplateId(),
    isCustom: true,
    label: overrides?.label?.trim() || `${source.label} (복제)`,
    description: overrides?.description?.trim() || source.description,
    tags: [...(overrides?.tags ?? source.tags), '커스텀'],
    previewImageUrl: overrides?.previewImageUrl ?? source.previewImageUrl,
    textSlots: source.textSlots.map((s) => ({ ...s })),
    exportFrame: source.exportFrame ? { ...source.exportFrame } : undefined,
    basedOnTemplateId: source.id,
    createdAt: now,
    updatedAt: now,
  }
}

export function upsertCustomTemplate(template: StoredCustomThumbnailTemplate): StoredCustomThumbnailTemplate {
  const payload = readPayload()
  const idx = payload.templates.findIndex((t) => t.id === template.id)
  const next: StoredCustomThumbnailTemplate = {
    ...template,
    isCustom: true,
    updatedAt: Date.now(),
    createdAt: template.createdAt || Date.now(),
  }
  if (idx >= 0) payload.templates[idx] = next
  else payload.templates.push(next)
  writePayload(payload)
  return next
}

export function deleteCustomTemplate(id: string): boolean {
  if (!isCustomTemplateId(id)) return false
  const payload = readPayload()
  const before = payload.templates.length
  payload.templates = payload.templates.filter((t) => t.id !== id)
  if (payload.templates.length === before) return false
  writePayload(payload)
  return true
}

/** 미리보기 data URL을 JPEG로 축소·압축 (localStorage 용량 절약) */
export async function compressTemplatePreviewDataUrl(
  dataUrl: string,
  maxWidth = 640,
  quality = 0.72,
): Promise<string> {
  if (!dataUrl.startsWith('data:')) return dataUrl
  if (typeof document === 'undefined') return dataUrl

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / Math.max(1, img.width))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      try {
        resolve(c.toDataURL('image/jpeg', quality))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export function buildCustomTemplateFromParts(opts: {
  id?: string
  label: string
  description?: string
  tags?: string[]
  textSlots: TemplateTextSlotDef[]
  previewImageUrl?: string
  previewCss?: string
  exportFrame?: ThumbnailExportFrame
  basedOnTemplateId?: string
  backgroundPromptTemplate?: string
}): StoredCustomThumbnailTemplate {
  const now = Date.now()
  return {
    id: opts.id && isCustomTemplateId(opts.id) ? opts.id : newCustomTemplateId(),
    isCustom: true,
    label: opts.label.trim() || '내 템플릿',
    description:
      opts.description?.trim() ||
      '커스텀 레이아웃입니다. 캔버스에서 문구 위치·스타일을 수정한 뒤 다시 저장할 수 있습니다.',
    tags: opts.tags?.length ? opts.tags : ['커스텀'],
    previewCss: opts.previewCss ?? 'linear-gradient(135deg, #0f172a 0%, #334155 50%, #64748b 100%)',
    previewImageUrl: opts.previewImageUrl,
    backgroundPromptTemplate: opts.backgroundPromptTemplate ?? DEFAULT_BG_PROMPT,
    textSlots: opts.textSlots,
    exportFrame: opts.exportFrame,
    basedOnTemplateId: opts.basedOnTemplateId,
    createdAt: now,
    updatedAt: now,
  }
}

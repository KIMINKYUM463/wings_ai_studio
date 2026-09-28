import { postThumbnailTemplateAnalyze } from '@/lib/longform-v2/thumbnail-bridge/thumbnailAiApi'
import type { AnalyzedTemplateStyleSpec } from '@/lib/longform-v2/youtube/templateStyleAnalysis'
import { getProTemplate } from './catalog'
import { isCustomTemplateId } from './customTemplateStorage'
import { buildFallbackTemplateStyleSpec } from './fallbackStyle'
import { canonicalTemplateStyleSpec, canonicalTemplateStyleSpecFromBackground } from './templateLayout'

const CACHE_PREFIX = 'wings-thumb-tpl-style-v9:'

function cacheKey(templateId: string, previewUrl: string): string {
  return `${CACHE_PREFIX}${templateId}:${previewUrl}`
}

export function getCachedTemplateStyle(
  templateId: string,
  previewUrl: string,
): AnalyzedTemplateStyleSpec | null {
  try {
    const raw = localStorage.getItem(cacheKey(templateId, previewUrl))
    if (!raw) return null
    const parsed = JSON.parse(raw) as AnalyzedTemplateStyleSpec
    if (parsed?.templateId !== templateId || !parsed.textBlocks?.length) return null
    return parsed
  } catch {
    return null
  }
}

export function setCachedTemplateStyle(
  templateId: string,
  previewUrl: string,
  spec: AnalyzedTemplateStyleSpec,
): void {
  try {
    localStorage.setItem(cacheKey(templateId, previewUrl), JSON.stringify(spec))
  } catch {
    /* quota */
  }
}

/** 미리보기를 캔버스 배경용 data URL로 */
export async function fetchTemplatePreviewDataUrl(previewUrl: string): Promise<string> {
  const { imageBase64, mimeType } = await fetchTemplatePreviewBase64(previewUrl)
  return `data:${mimeType};base64,${imageBase64}`
}

export async function fetchTemplatePreviewBase64(
  previewUrl: string,
): Promise<{ imageBase64: string; mimeType: string }> {
  const dataMatch = previewUrl.match(/^data:([^;]+);base64,(.+)$/i)
  if (dataMatch?.[2]) {
    return { imageBase64: dataMatch[2], mimeType: dataMatch[1] || 'image/png' }
  }

  const url = previewUrl.startsWith('http')
    ? previewUrl
    : `${window.location.origin}${previewUrl.startsWith('/') ? '' : '/'}${previewUrl}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('템플릿 미리보기 이미지를 불러오지 못했습니다.')
  const blob = await res.blob()
  const mimeType = blob.type || 'image/png'
  const buf = await res.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return { imageBase64: btoa(binary), mimeType }
}

/** 미리보기 비전 분석 — 캐시 우선 */
export async function analyzeTemplatePreviewStyle(
  templateId: string,
  opts?: { force?: boolean },
): Promise<AnalyzedTemplateStyleSpec | null> {
  const tpl = getProTemplate(templateId)
  if (!tpl?.previewImageUrl) return null
  if (isCustomTemplateId(templateId)) {
    return buildFallbackTemplateStyleSpec(templateId)
  }

  const previewUrl = tpl.previewImageUrl
  if (!opts?.force) {
    const cached = getCachedTemplateStyle(templateId, previewUrl)
    if (cached) return cached
  }

  try {
    const { imageBase64, mimeType } = await fetchTemplatePreviewBase64(previewUrl)
    const { spec } = await postThumbnailTemplateAnalyze({
      templateId,
      catalogSlots: [...tpl.textSlots],
      imageBase64,
      mimeType,
      visionMode: 'template-preview',
    })
    if (spec?.textBlocks?.length) {
      const canonical = canonicalTemplateStyleSpec(templateId, spec) ?? spec
      setCachedTemplateStyle(templateId, previewUrl, canonical)
      return canonical
    }
  } catch {
    /* API·파싱 실패 → 카탈로그 폴백 */
  }

  const fallback = buildFallbackTemplateStyleSpec(templateId)
  if (fallback) setCachedTemplateStyle(templateId, previewUrl, fallback)
  return fallback
}

/** 배경 이미지 URL(data:, /data/, http) → 비전 API용 base64 */
export async function resolveBackgroundImageForVision(
  imageRef: string,
): Promise<{ imageBase64: string; mimeType: string } | null> {
  const trimmed = imageRef.trim()
  if (!trimmed) return null
  try {
    return await fetchTemplatePreviewBase64(trimmed)
  } catch {
    return null
  }
}

/** 생성된 배경 이미지 비전 — 빈 영역·피사체에 맞춰 문구 위치·크기·색 제안 */
export async function analyzeGeneratedBackgroundLayout(
  templateId: string,
  imageRef: string,
): Promise<AnalyzedTemplateStyleSpec | null> {
  const tpl = getProTemplate(templateId)
  if (!tpl?.textSlots.length) return null

  const image = await resolveBackgroundImageForVision(imageRef)
  if (!image?.imageBase64) return null

  try {
    const { spec } = await postThumbnailTemplateAnalyze({
      templateId,
      catalogSlots: [...tpl.textSlots],
      imageBase64: image.imageBase64,
      mimeType: image.mimeType || 'image/png',
      visionMode: 'generated-background',
    })
    if (!spec?.textBlocks?.length) return null
    return canonicalTemplateStyleSpecFromBackground(templateId, spec)
  } catch {
    const fallback = buildFallbackTemplateStyleSpec(templateId)
    return fallback ? { ...fallback, layoutFromGeneratedBackground: true } : null
  }
}

import { isArtStylePresetCategory } from './artStylePresets'

/** NEW 탭 중 실사·시네마 실사 계열 */
const NEW_PHOTOREAL_PRESET_IDS = new Set(['cinematic-realistic-photo', 'korean-realistic-portrait'])

const NON_PHOTOREAL_CATEGORIES = new Set([
  '애니메이션',
  'animation',
  '일러스트',
  'illustration',
  '정보성 캐릭터',
  'informational',
  '전통화',
  'ppt-korean-explain',
  '커스텀',
])

/** 썸네일 배경 프롬프트·서버 후처리에 실사 톤을 강제할지 */
export function isThumbnailPhotorealisticStyle(
  styleCategory?: string,
  styleTemplateId?: string,
): boolean {
  const cat = (styleCategory ?? '').trim()
  const tid = (styleTemplateId ?? '').trim()

  if (!cat || cat === '실사') return true
  if (cat === 'NEW') return NEW_PHOTOREAL_PRESET_IDS.has(tid)
  if (isArtStylePresetCategory(cat)) return NEW_PHOTOREAL_PRESET_IDS.has(tid)
  if (NON_PHOTOREAL_CATEGORIES.has(cat)) return false
  return false
}

export function isThumbnailStickmanStyle(
  styleCategory?: string,
  styleTemplateId?: string,
): boolean {
  const cat = (styleCategory ?? '').trim()
  const tid = (styleTemplateId ?? '').trim()
  if (tid === 'hq-stickman') return true
  const informational = cat === 'informational' || cat === '정보성 캐릭터'
  return informational && tid === 'stickman'
}

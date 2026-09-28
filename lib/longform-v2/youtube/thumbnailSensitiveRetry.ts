/** Replicate Imagen / nano-banana 등 — 민감 콘텐츠 안전 필터(E005) */

export const THUMBNAIL_SENSITIVE_RETRY_MAX = 3 as const

export function isThumbnailSensitiveContentError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('flagged as sensitive') ||
    m.includes('e005') ||
    m.includes('sensitive content') ||
    m.includes('safety filter') ||
    m.includes('content policy') ||
    (m.includes('blocked') && m.includes('safety'))
  )
}

/** Replicate negative_prompt 보강 — 폭력·무기 등 완화 */
export const THUMBNAIL_SENSITIVE_NEGATIVE_EXTRA =
  'gore, blood, explicit violence, weapons, gun, rifle, explosion, corpse, injury, war crime, graphic combat'

export const THUMBNAIL_SAFETY_SOFTEN_BLOCK = [
  'EDITORIAL / EDUCATIONAL YouTube thumbnail only.',
  'Non-graphic: no gore, no blood, no explicit violence, no weapons in close-up.',
  'Symbolic storytelling (maps, archives, silhouettes, landscapes, museum atmosphere).',
  'Family-friendly, platform-safe visual.',
].join(' ')

/**
 * Replicate 썸네일 이미지 — 한도·과부하(E003)는 기다려서 재시도.
 * 자동화 모드는 썸네일을 건너뛰지 않는다.
 */

export const THUMBNAIL_FACTORY_CAPACITY_RETRY_MAX = 18 as const

export const THUMBNAIL_SERVER_CAPACITY_RETRY_MAX = 12 as const

export function isThumbnailCapacityRateLimitError(message: string): boolean {
  const m = (message || '').toLowerCase()
  if (!m.trim()) return false
  if (m.includes('modelratelimiterror')) return true
  if (/\be003\b/.test(m)) return true
  if (m.includes('high demand')) return true
  if (m.includes('rate limit') || m.includes('ratelimit')) return true
  if (m.includes('too many requests')) return true
  if (m.includes('resource_exhausted')) return true
  if (m.includes('overloaded') || m.includes('no capacity')) return true
  if (/\b(http\s*)?429\b/.test(m)) return true
  if (/\b(http\s*)?503\b/.test(m) && (m.includes('unavail') || m.includes('demand') || m.includes('capacity'))) {
    return true
  }
  if (m.includes('currently unavailable') || m.includes('service is currently unavailable')) return true
  if (m.includes('prediction failed') && (m.includes('unavailable') || m.includes('demand'))) return true
  return false
}

/** 실패 직후 대기(ms). 8초부터 시작해 최대 90초. */
export function thumbnailCapacityBackoffMs(failedAttemptIndex: number): number {
  const i = Math.max(0, failedAttemptIndex)
  return Math.min(90_000, Math.round(8000 * 1.45 ** i))
}

import { resolveDataAssetUrl } from '@/lib/longform-v2/thumbnail-bridge/resolveDataAssetUrl'

/** data URL · /data/... · http — 캔버스 Image.src 용 */
export function resolveStudioAssetUrl(src: string | null | undefined): string | null {
  return resolveDataAssetUrl(src)
}

/** HTTP `/data/...` 자산 — 갱신 시각으로 브라우저 캐시 무효화 */
export function resolveStudioAssetUrlWithCache(
  src: string | null | undefined,
  cacheKey?: string | null,
): string | null {
  const resolved = resolveStudioAssetUrl(src)
  if (!resolved) return null
  if (resolved.startsWith('data:') || resolved.startsWith('blob:')) return resolved
  const v = cacheKey?.trim()
  if (!v) return resolved
  const sep = resolved.includes('?') ? '&' : '?'
  return `${resolved}${sep}v=${encodeURIComponent(v)}`
}

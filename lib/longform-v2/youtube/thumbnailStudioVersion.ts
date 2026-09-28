/** 썸네일 템플릿 스튜디오 — v1 / v2 분리 */

export type ThumbnailStudioVersion = 'v1' | 'v2'

export const THUMBNAIL_STUDIO_VERSION_V2: ThumbnailStudioVersion = 'v2'

export function isThumbnailStudioV2(version?: ThumbnailStudioVersion | null): boolean {
  return version === 'v2'
}

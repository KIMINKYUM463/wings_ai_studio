import type { ThumbnailStudioTabsSession } from './studioTabsTypes'

/** 편집기 활성 탭 미리보기 URL — 있으면 프로젝트 썸네일 파일보다 우선 */
export function resolveStudioActiveTabPreviewUrl(
  session: ThumbnailStudioTabsSession | null | undefined,
): string | null {
  if (!session?.tabs?.length || !session.activeTabId) return null
  const active = session.tabs.find((t) => t.id === session.activeTabId) ?? session.tabs[session.tabs.length - 1]
  const preview = active?.previewUrl?.trim()
  return preview || null
}

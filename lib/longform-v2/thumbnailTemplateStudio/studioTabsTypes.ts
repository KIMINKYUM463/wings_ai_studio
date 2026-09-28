import type { ThumbnailStudioDocument } from './types'

export type ThumbnailStudioTab = {
  id: string
  label: string
  document: ThumbnailStudioDocument
  /** 탭 미리보기 (data URL 또는 /data/...) */
  previewUrl?: string
  savedWorkId?: string
  /** AI 문구 생성·재생성에 쓰는 출력 언어 (`ko`, `English`, `日本語` 등) */
  outputLanguage?: string
}

export type ThumbnailStudioTabsSession = {
  v: 1
  activeTabId: string
  tabs: ThumbnailStudioTab[]
  updatedAt: number
}

export const MAX_STUDIO_TABS = 12

export function newStudioTabId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function defaultStudioTabLabel(index: number): string {
  return `썸네일 ${index}`
}

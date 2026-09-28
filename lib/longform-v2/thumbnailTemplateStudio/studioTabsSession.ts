import type { ThumbnailStudioTab, ThumbnailStudioTabsSession } from './studioTabsTypes'
import { defaultStudioTabLabel, newStudioTabId } from './studioTabsTypes'
import { normalizeTabOutputLanguage } from './studioTabOutputLanguage'
import { DEFAULT_PRO_TEMPLATE_ID } from './catalog'
import { createEmptyStudioDocument } from './document'
import { cloneStudioDocumentForTabDuplicate } from './documentOps'
import type { ThumbnailStudioDocument } from './types'

const KEY_PREFIX = 'wingsThumbnailStudioTabs:v1:'

export function loadStudioTabsSessionLocal(projectId: string): ThumbnailStudioTabsSession | null {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${projectId.trim()}`)
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<ThumbnailStudioTabsSession>
    if (j.v !== 1 || !Array.isArray(j.tabs) || !j.tabs.length || !j.activeTabId) return null
    return {
      v: 1,
      activeTabId: j.activeTabId,
      tabs: j.tabs as ThumbnailStudioTab[],
      updatedAt: typeof j.updatedAt === 'number' ? j.updatedAt : 0,
    }
  } catch {
    return null
  }
}

export function saveStudioTabsSessionLocal(projectId: string, session: ThumbnailStudioTabsSession): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${projectId.trim()}`, JSON.stringify(session))
  } catch {
    /* quota */
  }
}

export function createStudioTab(
  document?: ThumbnailStudioDocument,
  label?: string,
  outputLanguage?: string,
): ThumbnailStudioTab {
  return {
    id: newStudioTabId(),
    label: label ?? defaultStudioTabLabel(1),
    document: document ?? createEmptyStudioDocument(DEFAULT_PRO_TEMPLATE_ID),
    outputLanguage: normalizeTabOutputLanguage(outputLanguage),
  }
}

export function normalizeStudioTab(
  tab: ThumbnailStudioTab,
  index: number,
  defaultOutputLanguage = 'ko',
): ThumbnailStudioTab {
  return {
    ...tab,
    label: tab.label?.trim() || defaultStudioTabLabel(index + 1),
    outputLanguage: normalizeTabOutputLanguage(tab.outputLanguage, defaultOutputLanguage),
  }
}

export function tabLabelForDocument(document: ThumbnailStudioDocument, fallbackIndex: number): string {
  const fromTpl = document.templateId?.trim()
  if (!fromTpl) return defaultStudioTabLabel(fallbackIndex)
  return fromTpl.length > 18 ? `${fromTpl.slice(0, 16)}…` : fromTpl
}

export function duplicateStudioTabLabel(sourceLabel: string, existingLabels: readonly string[]): string {
  const base = sourceLabel.trim() || '썸네일'
  let candidate = `${base} 복사`
  let n = 2
  while (existingLabels.includes(candidate)) {
    candidate = `${base} 복사 ${n}`
    n += 1
  }
  return candidate
}

/** 언어 번역용 탭 복제 — 「썸네일 1 · 일본어」 형식 */
export function duplicateStudioTabLabelForLanguage(
  sourceLabel: string,
  languageLabel: string,
  existingLabels: readonly string[],
): string {
  const base = sourceLabel.trim() || '썸네일'
  const lang = languageLabel.trim() || '번역'
  let candidate = `${base} · ${lang}`
  let n = 2
  while (existingLabels.includes(candidate)) {
    candidate = `${base} · ${lang} ${n}`
    n += 1
  }
  return candidate
}

/** 기존 탭 문구·레이아웃·스타일을 그대로 복제한 새 탭 */
export function duplicateStudioTab(source: ThumbnailStudioTab, existingLabels: readonly string[]): ThumbnailStudioTab {
  return {
    id: newStudioTabId(),
    label: duplicateStudioTabLabel(source.label, existingLabels),
    document: cloneStudioDocumentForTabDuplicate(source.document),
    previewUrl: source.previewUrl,
    outputLanguage: source.outputLanguage,
  }
}

/** 여러 탭이 공유하던 단일 draft 배경 경로 */
export function isSharedThumbnailStudioBackgroundUrl(url: string | null | undefined): boolean {
  const u = url?.trim() ?? ''
  if (!u || u.startsWith('data:')) return false
  return (
    /\/thumbnail-studio\/background\.jpg/i.test(u) &&
    !/\/thumbnail-studio\/tabs\//i.test(u) &&
    !/\/thumbnail-studio\/saved\//i.test(u)
  )
}

/** 탭 PUT 응답의 탭별 배경·레이어 URL을 로컬 탭 상태에 반영 (공유 background.jpg 제거) */
export function mergeTabScopedAssetsFromServer(
  localTabs: ThumbnailStudioTab[],
  serverTabs: ThumbnailStudioTab[],
): ThumbnailStudioTab[] {
  return localTabs.map((local) => {
    const srv = serverTabs.find((s) => s.id === local.id)
    if (!srv) return local

    let document = local.document
    const srvBg = srv.document.background.imageDataUrl?.trim()
    const localBg = local.document.background.imageDataUrl?.trim()
    if (
      srvBg &&
      srvBg !== localBg &&
      !localBg?.startsWith('data:') &&
      (isSharedThumbnailStudioBackgroundUrl(localBg) ||
        (srvBg.includes('/tabs/bg-') && localBg !== srvBg))
    ) {
      document = {
        ...document,
        background: { ...document.background, imageDataUrl: srvBg },
      }
    }

    const imageLayers = document.imageLayers.map((layer) => {
      const srvLayer = srv.document.imageLayers.find((l) => l.id === layer.id)
      const srvUrl = srvLayer?.imageDataUrl?.trim()
      const localUrl = layer.imageDataUrl?.trim()
      if (!srvUrl || srvUrl === localUrl || localUrl?.startsWith('data:')) return layer
      if (srvUrl.includes('/tabs/layer-') && localUrl !== srvUrl) {
        return { ...layer, imageDataUrl: srvUrl }
      }
      return layer
    })

    return {
      ...local,
      previewUrl: srv.previewUrl?.trim() ? srv.previewUrl : local.previewUrl,
      document: { ...document, imageLayers },
    }
  })
}

/**
 * 방금 보낸 PUT 응답 — 인라인 data URL을 서버 `/tabs/...` 경로로 승격.
 * (자동 동기화·저장 직후에만 사용. 오래된 GET/응답과 섞지 말 것)
 */
export function applyExternalizedAssetsFromSaveResponse(
  localTabs: ThumbnailStudioTab[],
  serverTabs: ThumbnailStudioTab[],
): ThumbnailStudioTab[] {
  return localTabs.map((local) => {
    const srv = serverTabs.find((s) => s.id === local.id)
    if (!srv) return local

    let document = local.document
    const localBg = local.document.background.imageDataUrl?.trim()
    const srvBg = srv.document.background.imageDataUrl?.trim()

    if (localBg?.startsWith('data:') && srvBg && !srvBg.startsWith('data:')) {
      document = {
        ...document,
        background: { ...document.background, imageDataUrl: srvBg },
      }
    } else if (
      srvBg &&
      srvBg !== localBg &&
      isSharedThumbnailStudioBackgroundUrl(localBg)
    ) {
      document = {
        ...document,
        background: { ...document.background, imageDataUrl: srvBg },
      }
    }
    // localBg 없음 + srvBg 있음 → 로컬에서 배경 삭제된 상태. 서버 URL로 되살리지 않음.

    const imageLayers = document.imageLayers.map((layer) => {
      const srvLayer = srv.document.imageLayers.find((l) => l.id === layer.id)
      const srvUrl = srvLayer?.imageDataUrl?.trim()
      const localUrl = layer.imageDataUrl?.trim()
      if (localUrl?.startsWith('data:') && srvUrl && !srvUrl.startsWith('data:')) {
        return { ...layer, imageDataUrl: srvUrl }
      }
      return layer
    })

    return {
      ...local,
      previewUrl: srv.previewUrl?.trim() ? srv.previewUrl : local.previewUrl,
      document: { ...document, imageLayers },
    }
  })
}

/**
 * PUT 저장 응답의 외부화 URL만 현재 편집 문서에 반영.
 * 전체 문서 덮어쓰기·삭제된 배경 복원은 하지 않음.
 */
export function promoteSaveResponseIntoDocument(
  live: ThumbnailStudioDocument,
  savedTabDocument: ThumbnailStudioDocument,
): ThumbnailStudioDocument {
  let next = live
  const localBg = live.background.imageDataUrl?.trim()
  const srvBg = savedTabDocument.background.imageDataUrl?.trim()

  if (localBg?.startsWith('data:') && srvBg && !srvBg.startsWith('data:')) {
    next = {
      ...next,
      background: {
        ...next.background,
        imageDataUrl: srvBg,
        imageUpdatedAt:
          savedTabDocument.background.imageUpdatedAt ?? next.background.imageUpdatedAt,
      },
    }
  } else if (srvBg && srvBg !== localBg && isSharedThumbnailStudioBackgroundUrl(localBg)) {
    next = {
      ...next,
      background: { ...next.background, imageDataUrl: srvBg },
    }
  }

  const imageLayers = next.imageLayers.map((layer) => {
    const srvLayer = savedTabDocument.imageLayers.find((l) => l.id === layer.id)
    const srvUrl = srvLayer?.imageDataUrl?.trim()
    const localUrl = layer.imageDataUrl?.trim()
    if (localUrl?.startsWith('data:') && srvUrl && !srvUrl.startsWith('data:')) {
      return { ...layer, imageDataUrl: srvUrl }
    }
    return layer
  })

  return { ...next, imageLayers }
}

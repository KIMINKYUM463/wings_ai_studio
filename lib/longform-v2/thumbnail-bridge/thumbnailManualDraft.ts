export type ThumbnailManualDraftV1 = {
  v: 1
  templateId: string
  textItems: unknown
  arrows: unknown
  /** data:image/...;base64,... 또는 null */
  userBgDataUrl: string | null
}

const KEY_PREFIX = 'wingsThumbnailManualDraft:v1:'

function key(projectId: string): string {
  return `${KEY_PREFIX}${projectId}`
}

export function loadThumbnailManualDraft(projectId: string): ThumbnailManualDraftV1 | null {
  try {
    const pid = projectId.trim()
    if (!pid) return null
    const raw = localStorage.getItem(key(pid))
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<ThumbnailManualDraftV1>
    if (j.v !== 1 || !Array.isArray(j.textItems)) return null
    return {
      v: 1,
      templateId: typeof j.templateId === 'string' ? j.templateId : 'ember',
      textItems: j.textItems,
      arrows: Array.isArray(j.arrows) ? j.arrows : [],
      userBgDataUrl: typeof j.userBgDataUrl === 'string' ? j.userBgDataUrl : null,
    }
  } catch {
    return null
  }
}

export function saveThumbnailManualDraft(projectId: string, draft: ThumbnailManualDraftV1): void {
  const pid = projectId.trim()
  if (!pid) return
  try {
    localStorage.setItem(key(pid), JSON.stringify(draft))
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      try {
        const slim: ThumbnailManualDraftV1 = { ...draft, userBgDataUrl: null }
        localStorage.setItem(key(pid), JSON.stringify(slim))
      } catch {
        /* ignore */
      }
    }
  }
}

export function clearThumbnailManualDraft(projectId: string): void {
  try {
    localStorage.removeItem(key(projectId.trim()))
  } catch {
    /* ignore */
  }
}

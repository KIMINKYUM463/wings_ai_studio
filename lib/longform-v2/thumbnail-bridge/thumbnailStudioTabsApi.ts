import type {
  ThumbnailStudioTab,
  ThumbnailStudioTabsSession,
} from "@/lib/longform-v2/thumbnailTemplateStudio/studioTabsTypes"

const KEY = (pid: string) => `lfv2:thumb-studio-tabs:v1:${pid}`

async function readLocal(pid: string): Promise<ThumbnailStudioTabsSession | null> {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(KEY(pid))
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<ThumbnailStudioTabsSession>
    if (j.v !== 1 || !Array.isArray(j.tabs) || !j.tabs.length || !j.activeTabId) return null
    return {
      v: 1,
      activeTabId: j.activeTabId,
      tabs: j.tabs as ThumbnailStudioTab[],
      updatedAt: typeof j.updatedAt === "number" ? j.updatedAt : 0,
    }
  } catch {
    return null
  }
}

export async function fetchThumbnailStudioTabs(
  projectId: string,
): Promise<ThumbnailStudioTabsSession | null> {
  const pid = projectId.trim()
  if (!pid) return null
  return readLocal(pid)
}

export type SaveThumbnailStudioTabsBody = {
  activeTabId: string
  tabs: Array<ThumbnailStudioTab & { previewBase64?: string }>
}

export async function saveThumbnailStudioTabs(
  projectId: string,
  body: SaveThumbnailStudioTabsBody,
): Promise<ThumbnailStudioTabsSession> {
  const pid = projectId.trim()
  if (!pid) throw new Error("projectId가 필요합니다.")
  const session: ThumbnailStudioTabsSession = {
    v: 1,
    activeTabId: body.activeTabId,
    tabs: body.tabs.map(({ previewBase64: _p, ...tab }) => tab),
    updatedAt: Date.now(),
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(KEY(pid), JSON.stringify(session))
  }
  return session
}

/** 서버 저장 실패 시 localStorage 폴백까지 포함한 best-effort 저장 */
export async function saveThumbnailStudioTabsBestEffort(
  projectId: string,
  body: SaveThumbnailStudioTabsBody,
  saveLocal: (session: ThumbnailStudioTabsSession) => void,
): Promise<{ session: ThumbnailStudioTabsSession | null; warning?: string }> {
  try {
    const session = await saveThumbnailStudioTabs(projectId, body)
    saveLocal(session)
    return { session }
  } catch (e) {
    const warning = e instanceof Error ? e.message : "탭 세션 저장 실패"
    const localSession: ThumbnailStudioTabsSession = {
      v: 1,
      activeTabId: body.activeTabId,
      tabs: body.tabs.map(({ previewBase64: _previewBase64, ...tab }) => tab),
      updatedAt: Date.now(),
    }
    saveLocal(localSession)
    return { session: null, warning }
  }
}

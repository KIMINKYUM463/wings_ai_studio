/** 장면 이미지·TTS data URL — localStorage 대신 IndexedDB */

const DB_NAME = "wings_longform_v2_media"
const DB_VERSION = 1
const STORE = "sceneMedia"

export type SceneMediaKind = "image" | "audio" | "video"

type MediaRecord = {
  key: string
  projectId: string
  sceneIndex: number
  kind: SceneMediaKind
  dataUrl: string
  updatedAt: string
}

function mediaKey(projectId: string, sceneIndex: number, kind: SceneMediaKind) {
  return `${projectId}:${sceneIndex}:${kind}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" })
        store.createIndex("projectId", "projectId", { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"))
  })
}

export function isHeavyMediaUrl(url: string | undefined | null): boolean {
  if (!url) return false
  const u = url.trim()
  if (!u) return false
  if (u.startsWith("data:")) return true
  // blob:은 새로고침 후 무효 — 저장해도 복구 불가하므로 heavy로 취급하지 않고 버림
  if (u.startsWith("blob:")) return false
  return false
}

export function shouldPersistMediaUrl(url: string | undefined | null): boolean {
  if (!url) return false
  const u = url.trim()
  return u.startsWith("data:")
}

export async function putSceneMedia(
  projectId: string,
  sceneIndex: number,
  kind: SceneMediaKind,
  dataUrl: string
): Promise<void> {
  if (!shouldPersistMediaUrl(dataUrl)) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error("putSceneMedia failed"))
    tx.objectStore(STORE).put({
      key: mediaKey(projectId, sceneIndex, kind),
      projectId,
      sceneIndex,
      kind,
      dataUrl,
      updatedAt: new Date().toISOString(),
    } satisfies MediaRecord)
  })
  db.close()
}

export async function putAllSceneMedia(
  projectId: string,
  scenes: Array<{ index: number; imageUrl?: string; audioUrl?: string; videoUrl?: string }>
): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    const store = tx.objectStore(STORE)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error("putAllSceneMedia failed"))
    const now = new Date().toISOString()
    for (const s of scenes) {
      if (shouldPersistMediaUrl(s.imageUrl)) {
        store.put({
          key: mediaKey(projectId, s.index, "image"),
          projectId,
          sceneIndex: s.index,
          kind: "image",
          dataUrl: s.imageUrl!,
          updatedAt: now,
        } satisfies MediaRecord)
      }
      if (shouldPersistMediaUrl(s.audioUrl)) {
        store.put({
          key: mediaKey(projectId, s.index, "audio"),
          projectId,
          sceneIndex: s.index,
          kind: "audio",
          dataUrl: s.audioUrl!,
          updatedAt: now,
        } satisfies MediaRecord)
      }
      if (shouldPersistMediaUrl(s.videoUrl)) {
        store.put({
          key: mediaKey(projectId, s.index, "video"),
          projectId,
          sceneIndex: s.index,
          kind: "video",
          dataUrl: s.videoUrl!,
          updatedAt: now,
        } satisfies MediaRecord)
      }
    }
  })
  db.close()
}

export async function loadProjectMediaMap(
  projectId: string
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly")
      const idx = tx.objectStore(STORE).index("projectId")
      const req = idx.getAll(projectId)
      req.onsuccess = () => {
        const rows = (req.result || []) as MediaRecord[]
        for (const row of rows) {
          out.set(`${row.sceneIndex}:${row.kind}`, row.dataUrl)
        }
        resolve()
      }
      req.onerror = () => reject(req.error || new Error("loadProjectMediaMap failed"))
    })
    db.close()
  } catch {
    /* ignore */
  }
  return out
}

export async function deleteProjectMedia(projectId: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      const store = tx.objectStore(STORE)
      const idx = store.index("projectId")
      const req = idx.getAllKeys(projectId)
      req.onsuccess = () => {
        const keys = (req.result || []) as IDBValidKey[]
        for (const k of keys) store.delete(k)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error || new Error("deleteProjectMedia failed"))
    })
    db.close()
  } catch {
    /* ignore */
  }
}

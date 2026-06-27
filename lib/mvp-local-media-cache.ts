/** MVP 짜집기 MP4·TTS·썸네일 — 브라우저 IndexedDB 로컬 캐시 (프로젝트 재오픈 시 재생) */

const DB_NAME = "shotform-mvp-local-media"
const MP4_STORE = "edit-mp4"
const TTS_STORE = "tts-wav"
const THUMB_STORE = "edit-thumbnails"
/** v3에서 store 없이 열린 DB(HMR) 복구 — v4에서 edit-thumbnails 생성 */
const DB_VERSION = 4

const ALL_STORES = [MP4_STORE, TTS_STORE, THUMB_STORE] as const

type MediaCacheRecord = {
  id: string
  projectId: string
  jobId: string
  blob: Blob
  savedAt: number
}

function mp4CacheKey(projectId: string, jobId: string): string {
  return `${projectId}:${jobId}`
}

function ttsCacheKey(projectId: string, jobId: string): string {
  return `tts:${projectId}:${jobId}`
}

export function mvpThumbnailCacheKey(projectId: string, variantId: string): string {
  return `thumb:${projectId}:${variantId}`
}

function missingStores(db: IDBDatabase): string[] {
  return ALL_STORES.filter((name) => !db.objectStoreNames.contains(name))
}

function ensureStores(db: IDBDatabase): void {
  for (const name of ALL_STORES) {
    if (!db.objectStoreNames.contains(name)) {
      db.createObjectStore(name, { keyPath: "id" })
    }
  }
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const del = indexedDB.deleteDatabase(DB_NAME)
    del.onsuccess = () => resolve()
    del.onerror = () => reject(del.error ?? new Error("IndexedDB delete failed"))
    del.onblocked = () => {
      reject(new Error("IndexedDB schema repair blocked — other tabs may be open"))
    }
  })
}

function openDb(allowRepair = true): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onblocked = () => {
      console.warn("[mvp-local-media-cache] IndexedDB upgrade blocked — close other tabs")
    }
    req.onupgradeneeded = () => {
      ensureStores(req.result)
    }
    req.onsuccess = () => {
      const db = req.result
      const missing = missingStores(db)
      if (missing.length === 0) {
        resolve(db)
        return
      }
      db.close()
      if (!allowRepair) {
        reject(new Error(`IndexedDB missing stores: ${missing.join(", ")}`))
        return
      }
      void deleteDatabase()
        .then(() => openDb(false))
        .then(resolve)
        .catch(reject)
    }
  })
}

async function putBlob(storeName: string, record: MediaCacheRecord, minBytes: number): Promise<void> {
  if (!record.projectId || !record.jobId || record.blob.size < minBytes) return
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite")
      tx.objectStore(storeName).put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

async function getBlob(storeName: string, id: string, minBytes: number): Promise<Blob | null> {
  try {
    const db = await openDb()
    try {
      return await new Promise<Blob | null>((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly")
        const req = tx.objectStore(storeName).get(id)
        req.onsuccess = () => {
          const row = req.result as MediaCacheRecord | undefined
          resolve(row?.blob && row.blob.size >= minBytes ? row.blob : null)
        }
        req.onerror = () => reject(req.error)
      })
    } finally {
      db.close()
    }
  } catch {
    return null
  }
}

export async function saveMvpEditMp4(projectId: string, jobId: string, blob: Blob): Promise<void> {
  await putBlob(
    MP4_STORE,
    { id: mp4CacheKey(projectId, jobId), projectId, jobId, blob, savedAt: Date.now() },
    20_000
  )
}

export async function loadMvpEditMp4(projectId: string, jobId: string): Promise<Blob | null> {
  if (!projectId || !jobId) return null
  return getBlob(MP4_STORE, mp4CacheKey(projectId, jobId), 20_000)
}

export async function saveMvpTtsAudio(projectId: string, jobId: string, blob: Blob): Promise<void> {
  await putBlob(
    TTS_STORE,
    { id: ttsCacheKey(projectId, jobId), projectId, jobId, blob, savedAt: Date.now() },
    512
  )
}

export async function loadMvpTtsAudio(projectId: string, jobId: string): Promise<Blob | null> {
  if (!projectId || !jobId) return null
  return getBlob(TTS_STORE, ttsCacheKey(projectId, jobId), 512)
}

export async function saveMvpThumbnail(
  projectId: string,
  variantId: string,
  blob: Blob
): Promise<void> {
  if (!projectId || !variantId) return
  try {
    await putBlob(
      THUMB_STORE,
      {
        id: mvpThumbnailCacheKey(projectId, variantId),
        projectId,
        jobId: variantId,
        blob,
        savedAt: Date.now(),
      },
      512
    )
  } catch (e) {
    console.warn("[mvp-local-media-cache] saveMvpThumbnail failed:", e)
  }
}

export async function loadMvpThumbnail(
  projectId: string,
  variantId: string
): Promise<Blob | null> {
  if (!projectId || !variantId) return null
  return getBlob(THUMB_STORE, mvpThumbnailCacheKey(projectId, variantId), 512)
}

export async function deleteMvpThumbnail(projectId: string, variantId: string): Promise<void> {
  if (!projectId || !variantId || typeof indexedDB === "undefined") return
  try {
    const db = await openDb()
    try {
      if (!db.objectStoreNames.contains(THUMB_STORE)) return
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(THUMB_STORE, "readwrite")
        tx.objectStore(THUMB_STORE).delete(mvpThumbnailCacheKey(projectId, variantId))
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
  } catch {
    /* ignore */
  }
}

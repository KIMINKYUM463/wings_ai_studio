/** MVP 짜집기 MP4·TTS — 브라우저 IndexedDB 로컬 캐시 (프로젝트 재오픈 시 재생) */

const DB_NAME = "shotform-mvp-local-media"
const MP4_STORE = "edit-mp4"
const TTS_STORE = "tts-wav"
const DB_VERSION = 2

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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(MP4_STORE)) {
        db.createObjectStore(MP4_STORE, { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains(TTS_STORE)) {
        db.createObjectStore(TTS_STORE, { keyPath: "id" })
      }
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

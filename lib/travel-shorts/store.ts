/** 여행쇼핑숏폼 프로젝트 — 사진·음성 Blob까지 브라우저 IndexedDB에 통째로 저장 */

import type { TravelProject } from "@/lib/travel-shorts/types"

const DB_NAME = "wings-travel-shorts"
const STORE = "projects"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("이 브라우저는 로컬 저장소(IndexedDB)를 지원하지 않습니다."))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("IndexedDB 열기 실패"))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = run(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error ?? req.error ?? new Error("IndexedDB 작업 실패"))
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB 작업 취소"))
    })
  } finally {
    db.close()
  }
}

export async function listTravelProjects(): Promise<TravelProject[]> {
  const all = await withStore<TravelProject[]>("readonly", (s) => s.getAll() as IDBRequest<TravelProject[]>)
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadTravelProject(id: string): Promise<TravelProject | null> {
  const found = await withStore<TravelProject | undefined>(
    "readonly",
    (s) => s.get(id) as IDBRequest<TravelProject | undefined>
  )
  return found ?? null
}

export async function saveTravelProject(project: TravelProject): Promise<void> {
  await withStore("readwrite", (s) => s.put(project))
}

export async function deleteTravelProject(id: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(id))
}

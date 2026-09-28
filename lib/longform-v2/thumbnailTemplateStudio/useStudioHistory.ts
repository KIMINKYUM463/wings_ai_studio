import { useCallback, useRef, useState } from 'react'
import { cloneStudioDocument } from './documentOps'
import type { ThumbnailStudioDocument } from './types'

const MAX_HISTORY = 40

export function useStudioHistory(initial: ThumbnailStudioDocument) {
  const [doc, setDocState] = useState(initial)
  const pastRef = useRef<ThumbnailStudioDocument[]>([])
  const futureRef = useRef<ThumbnailStudioDocument[]>([])
  const [stackDepth, setStackDepth] = useState({ undo: 0, redo: 0 })

  const syncStacks = useCallback(() => {
    setStackDepth({ undo: pastRef.current.length, redo: futureRef.current.length })
  }, [])

  const setDoc = useCallback(
    (updater: ThumbnailStudioDocument | ((prev: ThumbnailStudioDocument) => ThumbnailStudioDocument)) => {
      setDocState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (next === prev) return prev
        pastRef.current.push(cloneStudioDocument(prev))
        if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift()
        futureRef.current = []
        syncStacks()
        return next
      })
    },
    [syncStacks],
  )

  const replaceDocWithoutHistory = useCallback(
    (next: ThumbnailStudioDocument) => {
      setDocState(next)
      syncStacks()
    },
    [syncStacks],
  )

  const undo = useCallback(() => {
    if (!pastRef.current.length) return
    setDocState((current) => {
      const prev = pastRef.current.pop()!
      futureRef.current.push(cloneStudioDocument(current))
      syncStacks()
      return prev
    })
  }, [syncStacks])

  const redo = useCallback(() => {
    if (!futureRef.current.length) return
    setDocState((current) => {
      const next = futureRef.current.pop()!
      pastRef.current.push(cloneStudioDocument(current))
      syncStacks()
      return next
    })
  }, [syncStacks])

  const resetHistory = useCallback(
    (next: ThumbnailStudioDocument) => {
      pastRef.current = []
      futureRef.current = []
      setDocState(next)
      syncStacks()
    },
    [syncStacks],
  )

  return {
    doc,
    setDoc,
    replaceDocWithoutHistory,
    resetHistory,
    undo,
    redo,
    canUndo: stackDepth.undo > 0,
    canRedo: stackDepth.redo > 0,
  }
}

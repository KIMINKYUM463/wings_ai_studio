"use client"

import { useCallback, useRef, useState, type SetStateAction } from "react"
import type { MvpThumbnailDesign } from "@/lib/mvp-thumbnail-design"

const MAX_HISTORY = 50

function cloneDesign(d: MvpThumbnailDesign): MvpThumbnailDesign {
  return JSON.parse(JSON.stringify(d)) as MvpThumbnailDesign
}

export function useThumbnailDesignHistory(initial: MvpThumbnailDesign) {
  const [design, setDesignState] = useState(initial)
  const pastRef = useRef<MvpThumbnailDesign[]>([])
  const designRef = useRef(initial)
  designRef.current = design
  const [canUndo, setCanUndo] = useState(false)

  const syncCanUndo = useCallback(() => {
    setCanUndo(pastRef.current.length > 0)
  }, [])

  const resetDesign = useCallback(
    (next: MvpThumbnailDesign) => {
      pastRef.current = []
      designRef.current = next
      setDesignState(next)
      syncCanUndo()
    },
    [syncCanUndo]
  )

  const pushHistory = useCallback(() => {
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), cloneDesign(designRef.current)]
    syncCanUndo()
  }, [syncCanUndo])

  const patchDesign = useCallback((updater: SetStateAction<MvpThumbnailDesign>) => {
    setDesignState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      designRef.current = next
      return next
    })
  }, [])

  const commitDesign = useCallback(
    (updater: SetStateAction<MvpThumbnailDesign>) => {
      pushHistory()
      patchDesign(updater)
    },
    [pushHistory, patchDesign]
  )

  const undo = useCallback((): MvpThumbnailDesign | null => {
    const past = pastRef.current
    if (!past.length) return null
    const prev = past[past.length - 1]!
    pastRef.current = past.slice(0, -1)
    designRef.current = prev
    setDesignState(prev)
    syncCanUndo()
    return prev
  }, [syncCanUndo])

  return {
    design,
    canUndo,
    resetDesign,
    pushHistory,
    patchDesign,
    commitDesign,
    undo,
  }
}

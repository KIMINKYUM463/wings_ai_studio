"use client"

import { useEffect, useState } from "react"
import { isTypecastApi403Guide } from "@/lib/typecast-api-error"
import {
  TYPECAST_API_GUIDE_EVENT,
  TypecastApiGuideCard,
} from "@/components/TypecastApiGuideCard"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * 타입캐스트 403이 alert/배너로 뜨면 안내 모달을 엽니다.
 */
export function TypecastApiGuideHost() {
  const [open, setOpen] = useState(false)
  const [rawMessage, setRawMessage] = useState("")

  useEffect(() => {
    const onGuide = (e: Event) => {
      const detail = (e as CustomEvent<{ rawMessage?: string }>).detail
      setRawMessage(detail?.rawMessage || "")
      setOpen(true)
    }
    window.addEventListener(TYPECAST_API_GUIDE_EVENT, onGuide)

    const nativeAlert = window.alert.bind(window)
    window.alert = (message?: unknown) => {
      const text = String(message ?? "")
      if (isTypecastApi403Guide(text)) {
        setRawMessage(text)
        setOpen(true)
        return
      }
      nativeAlert(text)
    }

    return () => {
      window.removeEventListener(TYPECAST_API_GUIDE_EVENT, onGuide)
      window.alert = nativeAlert
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg border-amber-500/30 bg-zinc-950 text-zinc-50">
        <DialogHeader>
          <DialogTitle>타입캐스트 TTS 안내</DialogTitle>
          <DialogDescription className="text-zinc-400">
            미리듣기·TTS가 막혔을 때 확인할 내용입니다.
          </DialogDescription>
        </DialogHeader>
        <TypecastApiGuideCard rawMessage={rawMessage} />
      </DialogContent>
    </Dialog>
  )
}

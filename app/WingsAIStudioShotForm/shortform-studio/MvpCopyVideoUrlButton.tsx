"use client"

import { useCallback, useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  noteUrl?: string | null
  videoUrl?: string | null
  className?: string
}

function pickCopyUrl(noteUrl?: string | null, videoUrl?: string | null): string {
  const note = noteUrl?.trim() ?? ""
  const video = videoUrl?.trim() ?? ""
  if (note.startsWith("http")) return note
  if (video.startsWith("http")) return video
  return note || video
}

export function MvpCopyVideoUrlButton({ noteUrl, videoUrl, className }: Props) {
  const [copied, setCopied] = useState(false)
  const copyTarget = pickCopyUrl(noteUrl, videoUrl)

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!copyTarget) return
      try {
        await navigator.clipboard.writeText(copyTarget)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      } catch {
        window.prompt("URL 복사:", copyTarget)
      }
    },
    [copyTarget]
  )

  if (!copyTarget) return null

  return (
    <button
      type="button"
      onClick={(e) => void handleCopy(e)}
      title={copyTarget}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-400 transition hover:border-white/20 hover:text-white",
        className
      )}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "복사됨" : "URL 복사"}
    </button>
  )
}

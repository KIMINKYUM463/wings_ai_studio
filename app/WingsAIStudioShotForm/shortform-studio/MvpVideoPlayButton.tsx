"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { xhsVideoProxy } from "./MvpXhsMediaPreview"

export function MvpVideoPlayButton({
  videoUrl,
  title,
  className,
  disabled,
}: {
  videoUrl?: string
  title?: string
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const hasVideo = Boolean(videoUrl?.trim().startsWith("http"))
  const modalVideoSrc = open && videoUrl ? xhsVideoProxy(videoUrl) : ""

  if (!hasVideo) return null

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(
          "h-7 gap-1 border-white/15 bg-black/40 px-2 text-[11px] text-slate-200 hover:bg-white/10",
          className
        )}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <Play className="h-3 w-3 fill-current" />
        재생
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md overflow-hidden border-white/10 bg-slate-950 p-0">
          <DialogTitle className="sr-only">{title || "小红书 영상"}</DialogTitle>
          <div className="relative aspect-[3/4] w-full bg-black">
            {modalVideoSrc ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                key={modalVideoSrc}
                src={modalVideoSrc}
                className="h-full w-full object-contain"
                controls
                playsInline
                autoPlay
                preload="auto"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">영상 URL 없음</div>
            )}
          </div>
          {title ? (
            <p className="line-clamp-2 border-t border-white/10 px-4 py-3 text-sm text-slate-200">{title}</p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

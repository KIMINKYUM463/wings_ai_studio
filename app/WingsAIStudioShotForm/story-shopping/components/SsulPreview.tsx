"use client"

import { useEffect, useRef, useState } from "react"
import {
  drawSsulFrame,
  loadImageElement,
  type SsulTemplate,
  SSUL_WIDTH,
  SSUL_HEIGHT,
} from "../lib/ssul-frame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const TEMPLATES: Array<{ id: SsulTemplate; label: string }> = [
  { id: "ssul-white", label: "흰 상단 (기본)" },
  { id: "ssul-banner", label: "배너 훅" },
  { id: "ssul-split", label: "스플릿" },
]

export function SsulPreview({
  template,
  onTemplateChange,
  hookTitle,
  onHookTitleChange,
  channelLabel,
  onChannelLabelChange,
  postTime,
  onPostTimeChange,
  narration,
  mediaUrl,
  className,
}: {
  template: SsulTemplate
  onTemplateChange?: (t: SsulTemplate) => void
  hookTitle: string
  onHookTitleChange?: (v: string) => void
  channelLabel: string
  onChannelLabelChange?: (v: string) => void
  postTime: string
  onPostTimeChange?: (v: string) => void
  narration: string
  mediaUrl?: string | null
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      setBusy(true)
      let mediaImage: HTMLImageElement | null = null
      if (mediaUrl) {
        try {
          mediaImage = await loadImageElement(mediaUrl)
        } catch {
          mediaImage = null
        }
      }
      if (cancelled) return
      drawSsulFrame(
        ctx,
        {
          template,
          hookTitle,
          channelLabel,
          postTime,
          narration,
          mediaImage,
        },
        SSUL_WIDTH,
        SSUL_HEIGHT
      )
      setBusy(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [template, hookTitle, channelLabel, postTime, narration, mediaUrl])

  return (
    <div className={className}>
      {onTemplateChange && (
        <div className="mb-3 flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant={template === t.id ? "default" : "outline"}
              onClick={() => onTemplateChange(t.id)}
              className={
                template === t.id
                  ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white"
                  : "border-white/15 bg-white/5 text-zinc-300"
              }
            >
              {t.label}
            </Button>
          ))}
        </div>
      )}

      {(onHookTitleChange || onChannelLabelChange) && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {onHookTitleChange && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-zinc-400">훅 제목</Label>
              <Input
                value={hookTitle}
                onChange={(e) => onHookTitleChange(e.target.value)}
                className="border-white/10 bg-black/40 text-zinc-100"
              />
            </div>
          )}
          {onChannelLabelChange && (
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">채널명</Label>
              <Input
                value={channelLabel}
                onChange={(e) => onChannelLabelChange(e.target.value)}
                className="border-white/10 bg-black/40 text-zinc-100"
              />
            </div>
          )}
          {onPostTimeChange && (
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">시간</Label>
              <Input
                value={postTime}
                onChange={(e) => onPostTimeChange(e.target.value)}
                className="border-white/10 bg-black/40 text-zinc-100"
              />
            </div>
          )}
        </div>
      )}

      <div className="relative mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
        <canvas
          ref={canvasRef}
          width={SSUL_WIDTH}
          height={SSUL_HEIGHT}
          className="h-auto w-full"
        />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-zinc-300">
            렌더 중…
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-zinc-500">
        썰 채널형 프레임 프리뷰 (9:16)
      </p>
    </div>
  )
}

/** 나레이션만 편집할 때 쓰는 얇은 래퍼 */
export function SsulNarrationEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-zinc-400">이 장면 나레이션</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="border-white/10 bg-black/40 text-sm text-zinc-100"
      />
    </div>
  )
}

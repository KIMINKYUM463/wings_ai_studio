"use client"

import { Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CapturedVideoFrame } from "@/lib/mvp-thumbnail-capture"

type Props = {
  frames: CapturedVideoFrame[]
  selectedId: string | null
  loading?: boolean
  progress?: { done: number; total: number } | null
  compact?: boolean
  onSelect: (frame: CapturedVideoFrame) => void
}

export function MvpThumbnailFramePicker({
  frames,
  selectedId,
  loading,
  progress,
  compact,
  onSelect,
}: Props) {
  if (loading) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-black/30 py-6 text-slate-400",
          compact ? "py-4" : ""
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
        <p className={cn("font-medium", compact ? "text-[10px]" : "text-xs")}>
          리믹스 영상에서 프레임 캡처 중…
        </p>
        {progress ? (
          <p className="text-[10px] text-slate-500">
            {progress.done}/{progress.total}
          </p>
        ) : null}
      </div>
    )
  }

  if (!frames.length) {
    return (
      <p className={cn("text-slate-500", compact ? "text-[9px]" : "text-[10px]")}>
        영상이 준비되면 제품 장면 후보 프레임을 자동으로 캡처합니다.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className={cn("text-slate-400", compact ? "text-[9px]" : "text-[10px]")}>
        리믹스 영상에서 뽑은 후보 {frames.length}장 — AI 참조로 쓸 장면을 고르세요.
      </p>
      <div
        className={cn(
          "grid gap-2",
          compact ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-4"
        )}
      >
        {frames.map((frame) => {
          const selected = frame.id === selectedId
          return (
            <button
              key={frame.id}
              type="button"
              title={frame.label}
              onClick={() => onSelect(frame)}
              className={cn(
                "group relative overflow-hidden rounded-lg border-2 text-left transition",
                compact ? "aspect-[9/16]" : "aspect-[9/16]",
                selected
                  ? "border-cyan-400 ring-2 ring-cyan-400/35"
                  : "border-white/15 opacity-90 hover:border-white/35 hover:opacity-100"
              )}
            >
              <img src={frame.dataUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1 pb-1 pt-4">
                <span className={cn("block truncate font-medium text-white", compact ? "text-[7px]" : "text-[8px]")}>
                  {frame.label}
                </span>
              </span>
              {selected ? (
                <span className="absolute right-0.5 top-0.5 rounded-full bg-cyan-500 p-0.5 text-black shadow">
                  <Check className={compact ? "h-2 w-2" : "h-2.5 w-2.5"} />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

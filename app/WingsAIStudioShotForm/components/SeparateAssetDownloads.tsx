"use client"

import type { ReactNode } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SeparateAssetItem = {
  id: string
  label: string
  hint: string
  disabled?: boolean
  missingReason?: string
}

type Props = {
  tone?: "dark" | "light"
  title?: string
  description?: string
  busyId?: string | null
  items: SeparateAssetItem[]
  onDownload: (id: string) => void
  className?: string
  footer?: ReactNode
}

export function SeparateAssetDownloads({
  tone = "dark",
  title = "개별 파일 받기",
  description = "자막 · 썸네일 · 영상 · TTS를 각각 따로 저장합니다.",
  busyId = null,
  items,
  onDownload,
  className,
  footer,
}: Props) {
  const dark = tone === "dark"
  return (
    <div
      className={cn(
        "rounded-2xl border p-3 space-y-2",
        dark ? "border-white/10 bg-black/30" : "border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      <div>
        <p className={cn("text-sm font-semibold", dark ? "text-zinc-100" : "text-slate-900")}>
          {title}
        </p>
        <p className={cn("text-[11px] mt-0.5", dark ? "text-zinc-500" : "text-slate-500")}>
          {description}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const busy = busyId === item.id
          const disabled = Boolean(item.disabled) || busyId != null
          return (
            <Button
              key={item.id}
              type="button"
              variant="outline"
              disabled={disabled}
              title={item.disabled ? item.missingReason : item.hint}
              onClick={() => onDownload(item.id)}
              className={cn(
                "h-auto min-h-11 flex-col items-start gap-0.5 px-3 py-2 text-left whitespace-normal",
                dark
                  ? "border-white/15 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
                  : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 disabled:opacity-40"
              )}
            >
              <span className="flex w-full items-center gap-2 text-xs font-semibold">
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
                )}
                {item.label}
              </span>
              <span
                className={cn(
                  "pl-5 text-[10px] font-normal leading-snug",
                  dark ? "text-zinc-500" : "text-slate-500"
                )}
              >
                {item.disabled ? item.missingReason || item.hint : item.hint}
              </span>
            </Button>
          )
        })}
      </div>
      {footer}
    </div>
  )
}

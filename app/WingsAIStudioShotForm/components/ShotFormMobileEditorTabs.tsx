"use client"

import { Clapperboard, PanelsTopLeft, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

export type ShotFormMobileEditorPane = "preview" | "timeline" | "edit"

const TABS: Array<{
  id: ShotFormMobileEditorPane
  label: string
  Icon: typeof Clapperboard
}> = [
  { id: "preview", label: "미리보기", Icon: Clapperboard },
  { id: "timeline", label: "타임라인", Icon: PanelsTopLeft },
  { id: "edit", label: "편집", Icon: SlidersHorizontal },
]

type Props = {
  value: ShotFormMobileEditorPane
  onChange: (pane: ShotFormMobileEditorPane) => void
  light?: boolean
  className?: string
}

/**
 * 폰 편집용 하단 탭 — 미리보기 / 타임라인 / 편집 패널 전환.
 */
export function ShotFormMobileEditorTabs({
  value,
  onChange,
  light = true,
  className,
}: Props) {
  return (
    <nav
      className={cn(
        "z-40 flex shrink-0 border-t pb-[env(safe-area-inset-bottom,0px)]",
        light
          ? "border-slate-200 bg-white/95 backdrop-blur"
          : "border-white/10 bg-[#101012]/95 backdrop-blur",
        className
      )}
      aria-label="모바일 편집 모드"
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            className={cn(
              "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold transition",
              active
                ? light
                  ? "text-violet-700"
                  : "text-violet-300"
                : light
                  ? "text-slate-500"
                  : "text-slate-400"
            )}
            onClick={() => onChange(id)}
          >
            <Icon className={cn("h-5 w-5", active && "stroke-[2.25]")} />
            {label}
          </button>
        )
      })}
    </nav>
  )
}

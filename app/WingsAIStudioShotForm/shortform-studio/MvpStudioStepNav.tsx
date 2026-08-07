"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  MVP_STUDIO_PHASES,
  normalizeStudioPhase,
  type MvpStudioPhase,
} from "@/lib/mvp-studio-types"

type Props = {
  phase: MvpStudioPhase
  onPhaseChange: (p: MvpStudioPhase) => void
  ttsReady: boolean
}

/** 상단 탭 — 자막·대본·썸네일은 편집기 인스펙터로, 제목·태그는 내보내기에서 작성 */
const MVP_STUDIO_NAV_PHASES = MVP_STUDIO_PHASES.filter(
  (step) => step.id === "edit" || step.id === "export"
)

export function MvpStudioStepNav({ phase, onPhaseChange, ttsReady }: Props) {
  const current = normalizeStudioPhase(phase)

  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
      {MVP_STUDIO_NAV_PHASES.map((step) => {
        const active = current === step.id
        const done =
          step.id === "edit"
            ? ttsReady
            : step.id === "script-style"
              ? current === "thumbnail" || current === "export"
              : step.id === "thumbnail"
                ? current === "export"
                : false
        return (
          <button
            key={step.id}
            type="button"
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition",
              active
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
            onClick={() => onPhaseChange(step.id)}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                active
                  ? "bg-white/20 text-white"
                  : done
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
              )}
            >
              {done && !active ? <Check className="h-3 w-3" /> : step.n}
            </span>
            {step.label}
          </button>
        )
      })}
    </div>
  )
}

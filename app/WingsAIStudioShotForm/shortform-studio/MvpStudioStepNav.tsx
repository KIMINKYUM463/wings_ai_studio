"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { studio } from "../components/ShotFormStudioUI"
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

/** 상단 탭 — 자막·대본·썸네일은 편집기 인스펙터·7단계 흐름으로만 진입 */
const MVP_STUDIO_NAV_PHASES = MVP_STUDIO_PHASES.filter(
  (step) => step.id === "edit" || step.id === "export"
)

export function MvpStudioStepNav({ phase, onPhaseChange, ttsReady }: Props) {
  const current = normalizeStudioPhase(phase)

  return (
    <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/40 p-2">
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
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition",
              active
                ? cn(studio.btnSegmentActive, "rounded-lg")
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            )}
            onClick={() => onPhaseChange(step.id)}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                done ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-500"
              )}
            >
              {done ? <Check className="h-3 w-3" /> : step.n}
            </span>
            {step.label}
          </button>
        )
      })}
    </div>
  )
}

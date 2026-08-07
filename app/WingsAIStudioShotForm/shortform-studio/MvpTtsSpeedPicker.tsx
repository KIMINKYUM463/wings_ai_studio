"use client"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { TTS_SPEED_OPTIONS } from "@/lib/shotform-tts-speed"
import { studio } from "../components/ShotFormStudioUI"

export function MvpTtsSpeedPicker({
  value,
  onChange,
  disabled,
  compact,
  tone = "dark",
  sceneFitHint = false,
}: {
  value: number
  onChange: (speed: number) => void
  disabled?: boolean
  compact?: boolean
  tone?: "dark" | "light"
  /** 장면 맞춤 ON일 때 — 전역 배속은 기준값으로 쓰임 */
  sceneFitHint?: boolean
}) {
  const light = tone === "light"
  return (
    <div>
      <Label
        className={cn(
          compact ? "text-[10px]" : "text-xs",
          light ? "font-medium text-slate-500" : "text-slate-400"
        )}
      >
        {sceneFitHint ? "기준 나레이션 속도" : "나레이션 속도"}
      </Label>
      <div className={cn("flex flex-wrap gap-1.5", compact ? "mt-1.5" : "mt-2")}>
        {TTS_SPEED_OPTIONS.map((sp) => (
          <button
            key={sp}
            type="button"
            disabled={disabled}
            onClick={() => onChange(sp)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 font-medium tabular-nums transition",
              compact ? "text-[10px]" : "text-xs",
              value === sp
                ? light
                  ? "border-slate-800 bg-slate-900 text-white shadow-sm"
                  : studio.btnSegmentActive
                : light
                  ? "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  : "border-white/10 bg-black/30 text-slate-400 hover:border-white/20 hover:text-slate-200",
              disabled && "pointer-events-none opacity-50"
            )}
          >
            {sp}x
          </button>
        ))}
      </div>
      <p
        className={cn(
          "mt-1.5 leading-relaxed",
          compact ? "text-[9px]" : "text-[10px]",
          light ? "text-slate-500" : "text-slate-500"
        )}
      >
        {sceneFitHint
          ? "장면 맞춤 ON: 컷이 짧으면 이보다 빠르게, 길면 이 속도를 유지합니다. 영상은 항상 1배속이며 TTS 후 음성 길이에 맞춰 컷을 자릅니다."
          : "배속은 TTS(목소리)에만 적용됩니다. 영상은 항상 1배속입니다. 변경 후 「TTS 다시 생성」이 필요합니다."}
      </p>
    </div>
  )
}

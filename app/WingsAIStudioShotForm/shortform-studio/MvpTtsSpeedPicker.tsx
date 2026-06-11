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
}: {
  value: number
  onChange: (speed: number) => void
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <div>
      <Label className={cn("text-slate-400", compact ? "text-[10px]" : "text-xs")}>
        나레이션 속도
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
                ? studio.btnSegmentActive
                : "border-white/10 bg-black/30 text-slate-400 hover:border-white/20 hover:text-slate-200",
              disabled && "pointer-events-none opacity-50"
            )}
          >
            {sp}x
          </button>
        ))}
      </div>
      <p className={cn("mt-1.5 leading-relaxed text-slate-500", compact ? "text-[9px]" : "text-[10px]")}>
        속도는 TTS API에서 자연스럽게 합성됩니다. 변경 후 「TTS 다시 생성」이 필요하며, 영상만 음성 길이에 맞춰 자동 배속됩니다.
      </p>
    </div>
  )
}

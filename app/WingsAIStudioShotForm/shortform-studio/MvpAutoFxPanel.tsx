"use client"

import { Wand2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { mvpBgmPickerItems } from "@/lib/mvp-studio-audio-catalog"
import { buildMvpAutoBgmClip, isAutoBgmClip, type MvpAutoFxSettings } from "@/lib/mvp-auto-fx"
import type { MvpBgmClip } from "@/lib/mvp-studio-types"
import { cn } from "@/lib/utils"

type Props = {
  settings: MvpAutoFxSettings
  onChange: (next: MvpAutoFxSettings) => void
  bgmClips: MvpBgmClip[]
  onBgmClipsChange: (next: MvpBgmClip[]) => void
}

const TOGGLES: { key: keyof MvpAutoFxSettings; label: string; hint: string }[] = [
  { key: "transitions", label: "컷 전환 효과", hint: "줌 펀치 · 좌우 휙 · 플래시 · 흔들림" },
  { key: "motion", label: "카메라 모션", hint: "장면마다 천천히 확대·축소·좌우 이동" },
  { key: "transitionSfx", label: "전환 효과음", hint: "컷이 바뀌는 순간 휙 소리" },
  { key: "bgm", label: "배경음악", hint: "영상 길이에 맞춰 자동으로 깔기" },
]

export function MvpAutoFxPanel({ settings, onChange, bgmClips, onBgmClipsChange }: Props) {
  const bgm = bgmClips[0]
  const autoBgm = bgm && isAutoBgmClip(bgm) ? bgm : null

  const pickTrack = (trackId: string) => {
    if (!autoBgm) return
    const clip = buildMvpAutoBgmClip(trackId, autoBgm.endSec, autoBgm.volumePct)
    if (clip) onBgmClipsChange([clip])
  }

  return (
    <div className="rounded-xl border border-sky-300 bg-sky-50 p-3">
      <div className="flex items-center gap-1.5">
        <Wand2 className="h-3.5 w-3.5 text-sky-600" />
        <p className="text-xs font-bold text-slate-900">자동 연출</p>
      </div>
      <p className="mt-0.5 text-[10px] text-slate-600">
        음성이 준비되면 컷 경계에 맞춰 자동으로 들어가고, 최종 렌더에도 그대로 반영됩니다.
      </p>

      <div className="mt-2 space-y-1.5">
        {TOGGLES.map(({ key, label, hint }) => (
          <label key={key} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5">
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold text-slate-900">{label}</span>
              <span className="block truncate text-[10px] text-slate-500">{hint}</span>
            </span>
            <Switch
              checked={settings[key]}
              onCheckedChange={(checked) => onChange({ ...settings, [key]: checked })}
            />
          </label>
        ))}
      </div>

      {settings.bgm && bgm ? (
        <div className="mt-2 space-y-2 rounded-lg bg-white p-2">
          {autoBgm ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {mvpBgmPickerItems().map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => pickTrack(item.id)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[10px]",
                      autoBgm.catalogId === item.id
                        ? "border-sky-500 bg-sky-500 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-sky-300"
                    )}
                  >
                    {item.shortLabel}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-slate-600">직접 넣은 배경음 사용 중 · {bgm.label}</p>
          )}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[10px] text-slate-600">볼륨 {bgm.volumePct}</span>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[bgm.volumePct]}
              onValueChange={(value) =>
                onBgmClipsChange(bgmClips.map((c, i) => (i === 0 ? { ...c, volumePct: value[0] ?? c.volumePct } : c)))
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

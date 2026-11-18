"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { MvpScriptStyleState, MvpVideoTextLayers } from "@/lib/mvp-studio-types"
import { normalizeVideoTextLayers } from "@/lib/mvp-video-text-layers"
import { studio } from "../components/ShotFormStudioUI"
import { insp } from "./mvpInspectorUi"

type Props = {
  scriptStyle: MvpScriptStyleState
  onChange: (patch: Partial<MvpScriptStyleState>) => void
  tone?: "dark" | "light"
}

export function MvpVideoTextLayersPanel({ scriptStyle, onChange, tone = "dark" }: Props) {
  const layers = normalizeVideoTextLayers(scriptStyle.videoText)
  const light = tone === "light"
  const labelCls = light ? insp.label : "text-[10px] text-slate-400"
  const rowText = light ? "text-xs text-slate-700" : "text-xs text-slate-300"
  const inputCls = light ? cn("h-8 text-xs", insp.input) : "h-8 border-white/10 bg-black/50 text-xs"
  const segActive = light ? insp.segmentActive : cn(studio.btnSegmentActive, "rounded-md")
  const segIdle = light
    ? insp.segmentIdle
    : "border-white/10 bg-black/30 text-slate-400 hover:border-white/20"
  const colorBorder = light ? "border-slate-200" : "border-white/10"

  const patchLayers = (patch: Partial<MvpVideoTextLayers>) =>
    onChange({ videoText: { ...layers, ...patch } })

  const editLine = (lineIndex: number, text: string) => {
    const headcopies = scriptStyle.headcopies.map((row) => [...row])
    while (headcopies.length <= layers.headcopyIndex) headcopies.push(["", ""])
    const row = headcopies[layers.headcopyIndex]!
    while (row.length < 2) row.push("")
    row[lineIndex] = text
    onChange({ headcopies })
  }
  const currentRow = scriptStyle.headcopies[layers.headcopyIndex] ?? ["", ""]

  const colorField = (label: string, value: string, key: "headcopyColor" | "headcopyAccentColor") => (
    <div className="flex-1">
      <Label className={labelCls}>{label}</Label>
      <input
        type="color"
        value={value}
        className={cn("mt-1.5 h-8 w-full cursor-pointer rounded border bg-transparent", colorBorder)}
        onChange={(e) => patchLayers({ [key]: e.target.value })}
      />
    </div>
  )

  return (
    <div className="space-y-4">
      <label className={cn("flex items-center justify-between gap-2", rowText)}>
        <span>헤드카피 영상에 표시</span>
        <Switch checked={layers.headcopyOn} onCheckedChange={(v) => patchLayers({ headcopyOn: v })} />
      </label>

      {layers.headcopyOn ? (
        <>
          {scriptStyle.headcopies.length > 1 ? (
            <div className="grid grid-cols-5 gap-1.5">
              {scriptStyle.headcopies.map((row, index) => (
                <button
                  key={index}
                  type="button"
                  title={row.join(" / ")}
                  className={cn(insp.segment, layers.headcopyIndex === index ? segActive : segIdle)}
                  onClick={() => patchLayers({ headcopyIndex: index })}
                >
                  #{index + 1}
                </button>
              ))}
            </div>
          ) : null}
          {[0, 1].map((lineIndex) => (
            <div key={lineIndex}>
              <Label className={labelCls}>{lineIndex === 0 ? "첫 줄" : "둘째 줄 (강조색)"}</Label>
              <Input
                value={currentRow[lineIndex] ?? ""}
                maxLength={20}
                className={cn("mt-1.5", inputCls)}
                onChange={(e) => editLine(lineIndex, e.target.value)}
              />
            </div>
          ))}
          <div className="flex gap-2">
            {colorField("첫 줄 색", layers.headcopyColor, "headcopyColor")}
            {colorField("둘째 줄 색", layers.headcopyAccentColor, "headcopyAccentColor")}
          </div>
          <div>
            <Label className={labelCls}>크기 {layers.headcopySizePx}px</Label>
            <Slider
              className="mt-2"
              min={14}
              max={36}
              step={1}
              value={[layers.headcopySizePx]}
              onValueChange={(v) => patchLayers({ headcopySizePx: v[0] ?? 22 })}
            />
          </div>
          <div>
            <Label className={labelCls}>세로 위치 ({Math.round(layers.headcopyY)}%)</Label>
            <Slider
              className="mt-2"
              min={4}
              max={40}
              step={1}
              value={[layers.headcopyY]}
              onValueChange={(v) => patchLayers({ headcopyY: v[0] ?? 13 })}
            />
          </div>
        </>
      ) : null}

      <div>
        <Label className={labelCls}>워터마크 닉네임 (비우면 표시 안 함)</Label>
        <Input
          value={layers.watermarkText}
          maxLength={30}
          placeholder="@내채널"
          className={cn("mt-1.5", inputCls)}
          onChange={(e) => patchLayers({ watermarkText: e.target.value })}
        />
      </div>

      <label className={cn("flex items-center justify-between gap-2", rowText)}>
        <span>
          [광고] 표시
          <span className={cn("block text-[10px]", light ? "text-slate-400" : "text-slate-500")}>
            제휴 링크 영상은 광고 표시가 필요합니다
          </span>
        </span>
        <Switch checked={layers.adLabelOn} onCheckedChange={(v) => patchLayers({ adLabelOn: v })} />
      </label>
    </div>
  )
}

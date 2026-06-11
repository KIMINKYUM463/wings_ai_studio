"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { MVP_SUBTITLE_FONT_OPTIONS } from "@/lib/mvp-subtitle-style"
import type { MvpSubtitleStyle } from "@/lib/mvp-studio-types"
import { normalizeSubtitleStyle } from "@/lib/mvp-studio-types"
import { studio } from "../components/ShotFormStudioUI"

type Props = {
  value: MvpSubtitleStyle
  onChange: (patch: Partial<MvpSubtitleStyle>) => void
  className?: string
}

export function MvpSubtitleStylePanel({ value, onChange, className }: Props) {
  const s = normalizeSubtitleStyle(value)

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <Label className="text-[10px] text-slate-400">글꼴</Label>
        <Select value={s.fontId} onValueChange={(v) => onChange({ fontId: v })}>
          <SelectTrigger className="mt-1.5 h-8 border-white/10 bg-black/50 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MVP_SUBTITLE_FONT_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-[10px] text-slate-400">굵기</Label>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {(
            [
              ["normal", "보통"],
              ["bold", "볼드"],
              ["extrabold", "엑스트라"],
            ] as const
          ).map(([w, label]) => (
            <button
              key={w}
              type="button"
              className={cn(
                "rounded-md border py-1.5 text-[10px] transition",
                s.fontWeight === w
                  ? cn(studio.btnSegmentActive, "rounded-md")
                  : "border-white/10 bg-black/30 text-slate-400 hover:border-white/20"
              )}
              onClick={() => onChange({ fontWeight: w })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-[10px] text-slate-400">정렬</Label>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {(
            [
              ["left", "왼쪽"],
              ["center", "가운데"],
              ["right", "오른쪽"],
            ] as const
          ).map(([align, label]) => (
            <button
              key={align}
              type="button"
              className={cn(
                "rounded-md border py-1.5 text-[10px] transition",
                s.textAlign === align
                  ? cn(studio.btnSegmentActive, "rounded-md")
                  : "border-white/10 bg-black/30 text-slate-400 hover:border-white/20"
              )}
              onClick={() => onChange({ textAlign: align })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-[10px] text-slate-400">크기 {s.sizePx}px</Label>
        <Slider
          className="mt-2"
          min={14}
          max={40}
          step={1}
          value={[s.sizePx]}
          onValueChange={(v) => onChange({ sizePx: v[0] ?? 22 })}
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[10px] text-slate-400">세로 위치 ({Math.round(s.y)}%)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] text-slate-400 hover:text-violet-200"
            onClick={() => onChange({ y: 50 })}
          >
            중앙
          </Button>
        </div>
        <p className="mt-0.5 text-[10px] text-slate-600">위(15%) ↔ 아래(85%) · 50%=화면 중앙</p>
        <Slider
          className="mt-2"
          min={15}
          max={85}
          step={1}
          value={[s.y]}
          onValueChange={(v) => onChange({ y: v[0] ?? 50 })}
        />
      </div>

      <div>
        <Label className="text-[10px] text-slate-400">가로 위치 ({Math.round(s.x ?? 50)}%)</Label>
        <Slider
          className="mt-2"
          min={15}
          max={85}
          step={1}
          value={[s.x ?? 50]}
          onValueChange={(v) => onChange({ x: v[0] ?? 50 })}
        />
      </div>

      <div>
        <Label className="text-[10px] text-slate-400">글자 색</Label>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            value={s.color}
            className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
            onChange={(e) => onChange({ color: e.target.value })}
          />
          <Input
            value={s.color}
            className="h-8 flex-1 border-white/10 bg-black/50 font-mono text-xs"
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-3">
        <p className="text-[10px] font-medium text-slate-300">외곽선</p>
        <label className="flex items-center justify-between gap-2 text-xs text-slate-300">
          <span>테두리 사용</span>
          <Switch checked={s.outlineOn} onCheckedChange={(v) => onChange({ outlineOn: v })} />
        </label>
        {s.outlineOn ? (
          <>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={s.outlineColor}
                className="h-8 w-10 cursor-pointer rounded border border-white/10"
                onChange={(e) => onChange({ outlineColor: e.target.value })}
              />
              <Input
                value={s.outlineColor}
                className="h-8 flex-1 border-white/10 bg-black/50 font-mono text-xs"
                onChange={(e) => onChange({ outlineColor: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">두께 {s.outlineWidthPx}px</Label>
              <Slider
                className="mt-1.5"
                min={1}
                max={6}
                step={1}
                value={[s.outlineWidthPx ?? 2]}
                onValueChange={(v) => onChange({ outlineWidthPx: v[0] ?? 2 })}
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-3">
        <p className="text-[10px] font-medium text-slate-300">배경</p>
        <label className="flex items-center justify-between gap-2 text-xs text-slate-300">
          <span>배경 박스</span>
          <Switch checked={s.bgOn} onCheckedChange={(v) => onChange({ bgOn: v })} />
        </label>
        {s.bgOn ? (
          <>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={s.bgColor}
                className="h-8 w-10 cursor-pointer rounded border border-white/10"
                onChange={(e) => onChange({ bgColor: e.target.value })}
              />
              <Input
                value={s.bgColor}
                className="h-8 flex-1 border-white/10 bg-black/50 font-mono text-xs"
                onChange={(e) => onChange({ bgColor: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">불투명도 {s.bgOpacity}%</Label>
              <Slider
                className="mt-1.5"
                min={10}
                max={100}
                step={5}
                value={[s.bgOpacity ?? 55]}
                onValueChange={(v) => onChange({ bgOpacity: v[0] ?? 55 })}
              />
            </div>
          </>
        ) : null}
      </div>

      <label className="flex items-center justify-between gap-2 text-xs text-slate-300">
        <span>글자 그림자</span>
        <Switch checked={s.textShadow} onCheckedChange={(v) => onChange({ textShadow: v })} />
      </label>
    </div>
  )
}

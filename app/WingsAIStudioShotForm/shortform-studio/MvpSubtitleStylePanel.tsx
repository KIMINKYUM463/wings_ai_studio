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
import { insp } from "./mvpInspectorUi"

type Props = {
  value: MvpSubtitleStyle
  onChange: (patch: Partial<MvpSubtitleStyle>) => void
  className?: string
  /** 팝업 편집기 우측 패널용 라이트 톤 */
  tone?: "dark" | "light"
}

export function MvpSubtitleStylePanel({ value, onChange, className, tone = "dark" }: Props) {
  const s = normalizeSubtitleStyle(value)
  const light = tone === "light"

  const labelCls = light ? insp.label : "text-[10px] text-slate-400"
  const selectCls = light
    ? cn("mt-1.5 h-8 text-xs", insp.input)
    : "mt-1.5 h-8 border-white/10 bg-black/50 text-xs"
  const segActive = light ? insp.segmentActive : cn(studio.btnSegmentActive, "rounded-md")
  const segIdle = light
    ? insp.segmentIdle
    : "border-white/10 bg-black/30 text-slate-400 hover:border-white/20"
  const inputCls = light
    ? cn("h-8 flex-1 font-mono text-xs", insp.input)
    : "h-8 flex-1 border-white/10 bg-black/50 font-mono text-xs"
  const nestCard = light
    ? "rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-3"
    : "rounded-lg border border-white/10 bg-black/30 p-3 space-y-3"
  const nestTitle = light ? "text-[10px] font-semibold text-slate-700" : "text-[10px] font-medium text-slate-300"
  const rowText = light ? "text-xs text-slate-700" : "text-xs text-slate-300"
  const colorBorder = light ? "border-slate-200" : "border-white/10"

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <Label className={labelCls}>글꼴</Label>
        <Select value={s.fontId} onValueChange={(v) => onChange({ fontId: v })}>
          <SelectTrigger className={selectCls}>
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
        <Label className={labelCls}>굵기</Label>
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
              className={cn(insp.segment, s.fontWeight === w ? segActive : segIdle)}
              onClick={() => onChange({ fontWeight: w })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className={labelCls}>정렬</Label>
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
              className={cn(insp.segment, s.textAlign === align ? segActive : segIdle)}
              onClick={() => onChange({ textAlign: align })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className={labelCls}>크기 {s.sizePx}px</Label>
        <Slider
          className="mt-2"
          min={16}
          max={56}
          step={1}
          value={[s.sizePx]}
          onValueChange={(v) => onChange({ sizePx: v[0] ?? 26 })}
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <Label className={labelCls}>세로 위치 ({Math.round(s.y)}%)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-[10px]",
              light ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-violet-200"
            )}
            onClick={() => onChange({ y: 50 })}
          >
            중앙
          </Button>
        </div>
        <p className={cn("mt-0.5 text-[10px]", light ? "text-slate-400" : "text-slate-600")}>
          위(15%) ↔ 아래(85%) · 50%=화면 중앙
        </p>
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
        <Label className={labelCls}>가로 위치 ({Math.round(s.x ?? 50)}%)</Label>
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
        <Label className={labelCls}>글자 색</Label>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            value={s.color}
            className={cn("h-8 w-10 cursor-pointer rounded bg-transparent", colorBorder, "border")}
            onChange={(e) => onChange({ color: e.target.value })}
          />
          <Input
            value={s.color}
            className={inputCls}
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </div>
      </div>

      <div className={nestCard}>
        <p className={nestTitle}>외곽선</p>
        <label className={cn("flex items-center justify-between gap-2", rowText)}>
          <span>테두리 사용</span>
          <Switch checked={s.outlineOn} onCheckedChange={(v) => onChange({ outlineOn: v })} />
        </label>
        {s.outlineOn ? (
          <>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={s.outlineColor}
                className={cn("h-8 w-10 cursor-pointer rounded border", colorBorder)}
                onChange={(e) => onChange({ outlineColor: e.target.value })}
              />
              <Input
                value={s.outlineColor}
                className={inputCls}
                onChange={(e) => onChange({ outlineColor: e.target.value })}
              />
            </div>
            <div>
              <Label className={labelCls}>두께 {s.outlineWidthPx}px</Label>
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

      <div className={nestCard}>
        <p className={nestTitle}>배경</p>
        <label className={cn("flex items-center justify-between gap-2", rowText)}>
          <span>배경 박스</span>
          <Switch checked={s.bgOn} onCheckedChange={(v) => onChange({ bgOn: v })} />
        </label>
        {s.bgOn ? (
          <>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={s.bgColor}
                className={cn("h-8 w-10 cursor-pointer rounded border", colorBorder)}
                onChange={(e) => onChange({ bgColor: e.target.value })}
              />
              <Input
                value={s.bgColor}
                className={inputCls}
                onChange={(e) => onChange({ bgColor: e.target.value })}
              />
            </div>
            <div>
              <Label className={labelCls}>불투명도 {s.bgOpacity}%</Label>
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

      <label className={cn("flex items-center justify-between gap-2", rowText)}>
        <span>글자 그림자</span>
        <Switch checked={s.textShadow} onCheckedChange={(v) => onChange({ textShadow: v })} />
      </label>
    </div>
  )
}

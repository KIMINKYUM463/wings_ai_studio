"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Play,
  Pause,
  Film,
  Loader2,
  Download,
  Scissors,
  Undo2,
  Redo2,
  Music2,
  Type,
  PawPrint,
} from "lucide-react"

export type AnimalSubtitleStyle = {
  fontSize: number
  fontFamily: string
  color: string
  backgroundColor: string
  position: "top" | "center" | "bottom"
  positionOffset: number
  textAlign: "left" | "center" | "right"
  fontWeight: "normal" | "bold"
  textShadow: boolean
  outlineEnabled?: boolean
  outlineWidth?: number
  outlineColor?: string
  shadowEnabled?: boolean
  shadowColor?: string
  shadowDistance?: number
  shadowAngle?: number
  horizontalPercent?: number
  verticalPercent?: number
}

const COLOR_PRESETS = [
  "#FFFFFF",
  "#FFFF00",
  "#FFD700",
  "#FF6B00",
  "#FF8FAB",
  "#7DD3A8",
  "#9B59B6",
  "#3498DB",
  "#2ECC71",
  "#000000",
  "#95A5A6",
  "#E74C3C",
]

const CLIP_COLORS = [
  { track: "bg-[#7dd3a8]/70 border-[#7dd3a8]/50", text: "text-[#0d1a14]", accent: "bg-[#fff6ee]" },
  { track: "bg-[#ff8fab]/70 border-[#ff8fab]/50", text: "text-white", accent: "bg-[#fff6ee]" },
  { track: "bg-amber-500/70 border-amber-300/50", text: "text-white", accent: "bg-amber-100" },
  { track: "bg-sky-500/70 border-sky-300/50", text: "text-white", accent: "bg-sky-100" },
] as const

function formatTime(sec: number) {
  const s = Math.max(0, sec || 0)
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
}

function randomColor() {
  return COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)] || "#FFFFFF"
}

function shadowCss(style: AnimalSubtitleStyle) {
  if (style.shadowEnabled === false && !style.textShadow) return "none"
  if (style.shadowEnabled === false) return "none"
  const dist = style.shadowDistance ?? 4
  const angle = ((style.shadowAngle ?? -45) * Math.PI) / 180
  const x = Math.cos(angle) * dist
  const y = Math.sin(angle) * dist
  const color = style.shadowColor || "#000000"
  return `${x.toFixed(1)}px ${y.toFixed(1)}px 4px ${color}`
}

type Props = {
  characterName?: string
  previewMedia: ReactNode
  previewGenerated: boolean
  hasVideos: boolean
  currentSubtitle: string
  subtitleStyle: AnimalSubtitleStyle
  onSubtitleStyleChange: (next: AnimalSubtitleStyle) => void
  isPlaying: boolean
  onTogglePlay: () => void
  currentTime: number
  duration: number
  onSeekRatio: (ratio: number) => void
  scriptLineCount: number
  sceneCount: number
  sceneDurations?: number[]
  bgmUrl?: string
  bgmStartTime?: number
  bgmEndTime?: number
  sfxUrl?: string
  sfxStartTime?: number
  sfxEndTime?: number
  isGeneratingPreview: boolean
  onGeneratePreview: () => void
  exportActions: ReactNode
  audioPanel?: ReactNode
  metaPanel?: ReactNode
  inspectorTab: "subtitle" | "audio" | "meta"
  onInspectorTabChange: (tab: "subtitle" | "audio" | "meta") => void
}

export function AnimalCapCutEditWorkspace({
  characterName = "캐릭??,
  previewMedia,
  previewGenerated,
  hasVideos,
  currentSubtitle,
  subtitleStyle,
  onSubtitleStyleChange,
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  onSeekRatio,
  scriptLineCount,
  sceneCount,
  sceneDurations = [],
  bgmUrl,
  bgmStartTime = 0,
  bgmEndTime = 0,
  sfxUrl,
  sfxStartTime = 0,
  sfxEndTime = 0,
  isGeneratingPreview,
  onGeneratePreview,
  exportActions,
  audioPanel,
  metaPanel,
  inspectorTab,
  onInspectorTabChange,
}: Props) {
  const patch = (p: Partial<AnimalSubtitleStyle>) =>
    onSubtitleStyleChange({ ...subtitleStyle, ...p })

  const verticalPercent =
    subtitleStyle.verticalPercent ??
    (subtitleStyle.position === "top" ? 15 : subtitleStyle.position === "center" ? 50 : 88)
  const horizontalPercent = subtitleStyle.horizontalPercent ?? 50
  const playheadPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const safeDuration = Math.max(duration || 15, 0.001)

  const ticks = Array.from({ length: Math.max(1, Math.ceil(safeDuration / 3) + 1) }, (_, i) => i * 3).filter(
    (t) => t <= Math.max(safeDuration, 15)
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgba(125,211,168,0.25)] bg-gradient-to-r from-[#122018] to-[#1a1520] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ff8fab]/30 bg-[#ff8fab]/15">
            <PawPrint className="h-5 w-5 text-[#ff8fab]" />
          </div>
          <div>
            <p className="animal-bubble-chip inline-flex px-2 py-0.5 text-[10px]">?�️ CAPCUT EDIT</p>
            <h3 className="animal-display mt-1 text-lg font-bold text-[#fff6ee]">
              {characterName} ?�폼 ?�집
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9aa89c]">
          <Scissors className="h-3.5 w-3.5 opacity-50" />
          <Undo2 className="h-3.5 w-3.5 opacity-40" />
          <Redo2 className="h-3.5 w-3.5 opacity-40" />
          <span className="font-mono text-[#7dd3a8]">
            {formatTime(currentTime)} / {formatTime(duration || 15)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 xl:items-start">
        {/* Preview phone */}
        <div className="space-y-3 rounded-2xl border border-[rgba(255,246,238,0.1)] bg-[#121a16] p-4 xl:col-span-4 xl:row-span-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#6b7a6e]">
            <span>Preview</span>
            <span className="font-mono text-[#9aa89c]">9:16</span>
          </div>

          <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-xl border border-[#7dd3a8]/35 bg-black shadow-[0_0_0_1px_rgba(125,211,168,0.12)]">
            {previewGenerated && hasVideos ? (
              <>
                {previewMedia}
                {currentSubtitle && currentTime >= 0.01 ? (
                  <div className="pointer-events-none absolute inset-0 z-10">
                    <div
                      className="absolute max-w-[88%] whitespace-nowrap rounded px-2 py-1"
                      style={{
                        left: `${horizontalPercent}%`,
                        top: `${verticalPercent}%`,
                        transform: "translate(-50%, -50%)",
                        fontFamily: `'${subtitleStyle.fontFamily}', sans-serif`,
                        fontSize: `${Math.max(
                          12,
                          Math.min(
                            subtitleStyle.fontSize * 0.45,
                            220 / Math.max(1, currentSubtitle.replace(/\s/g, "").length)
                          )
                        )}px`,
                        fontWeight: subtitleStyle.fontWeight,
                        textAlign: subtitleStyle.textAlign,
                        color: subtitleStyle.color,
                        backgroundColor:
                          subtitleStyle.backgroundColor === "transparent"
                            ? "transparent"
                            : subtitleStyle.backgroundColor,
                        lineHeight: 1.25,
                        textShadow: shadowCss(subtitleStyle),
                        WebkitTextStroke:
                          subtitleStyle.outlineEnabled !== false
                            ? `${(subtitleStyle.outlineWidth ?? 4) * 0.35}px ${subtitleStyle.outlineColor || "#000"}`
                            : undefined,
                        paintOrder: "stroke fill",
                      }}
                    >
                      {currentSubtitle}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-[#6b7a6e]">
                <Film className="h-10 w-10 opacity-40" />
                <p className="text-xs">미리보기�??�성?�주?�요</p>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-3 xl:contents">
          {/* Timeline */}
          <div className="order-2 space-y-3 rounded-2xl border border-[rgba(255,246,238,0.1)] bg-[#121a16] p-3 xl:col-span-12">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-xs text-[#9aa89c]">
                <Button
                  type="button"
                  size="sm"
                  onClick={onTogglePlay}
                  disabled={!previewGenerated}
                  className="animal-mint-btn h-8 rounded-full px-4"
                >
                  {isPlaying ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                  {isPlaying ? "?�시?��?" : "?�생"}
                </Button>
                <span className="font-mono text-[#ff8fab]">{formatTime(currentTime)}</span>
              </div>
              <p className="text-[10px] text-[#6b7a6e]">?�립 · TTS · BGM · SFX · ?�막 ?�랙</p>
            </div>

            <div className="relative h-5 border-b border-[rgba(255,246,238,0.08)]">
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute top-0 -translate-x-1/2 text-[9px] text-[#6b7a6e]"
                  style={{ left: `${(t / safeDuration) * 100}%` }}
                >
                  {formatTime(t)}
                </span>
              ))}
            </div>

            <div className="space-y-2">
              {/* Clips */}
              <div className="flex items-stretch gap-2">
                <div className="flex w-14 shrink-0 items-center text-[10px] text-[#6b7a6e]">?�립</div>
                <div className="relative flex h-12 min-w-0 flex-1 gap-1 overflow-hidden rounded-lg">
                  {Array.from({ length: Math.max(1, sceneCount) }, (_, index) => {
                    const color = CLIP_COLORS[index % CLIP_COLORS.length]!
                    const hasExact = sceneDurations.length === sceneCount
                    const clipDuration = hasExact
                      ? Math.max(0.001, sceneDurations[index] || 0)
                      : safeDuration / Math.max(1, sceneCount)
                    const clipStart = hasExact
                      ? sceneDurations.slice(0, index).reduce((sum, v) => sum + v, 0)
                      : clipDuration * index
                    const clipEnd = clipStart + clipDuration
                    return (
                      <button
                        key={index}
                        type="button"
                        className={`group relative min-w-0 overflow-hidden rounded-md border px-2 text-left transition hover:brightness-110 ${color.track}`}
                        style={{ flexGrow: clipDuration, flexBasis: 0 }}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const localRatio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
                          onSeekRatio((clipStart + localRatio * clipDuration) / safeDuration)
                        }}
                        title={`?�상 ${index + 1}`}
                      >
                        <span className={`absolute inset-x-0 top-0 h-0.5 opacity-80 ${color.accent}`} />
                        <div className={`truncate text-[11px] font-semibold ${color.text}`}>?�상 {index + 1}</div>
                        <div className={`truncate text-[9px] opacity-80 ${color.text}`}>
                          {formatTime(clipStart)}??formatTime(clipEnd)}
                        </div>
                      </button>
                    )
                  })}
                  <div
                    className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
                    style={{ left: `${playheadPct}%` }}
                  />
                </div>
              </div>

              {/* TTS */}
              <TrackRow
                label="TTS"
                className="bg-[#ff8fab]/25 border-[#ff8fab]/35"
                playheadPct={playheadPct}
                onSeekRatio={onSeekRatio}
                active={scriptLineCount > 0}
              />

              {/* BGM */}
              <div className="flex items-stretch gap-2">
                <div className="flex w-14 shrink-0 items-center gap-1 text-[10px] text-[#6b7a6e]">
                  <Music2 className="h-3 w-3" /> BGM
                </div>
                <div
                  className="relative h-9 flex-1 cursor-pointer overflow-hidden rounded-lg border border-violet-500/30 bg-violet-900/30"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    onSeekRatio(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
                  }}
                >
                  {bgmUrl ? (
                    <div
                      className="absolute inset-y-1 rounded bg-violet-500/55"
                      style={{
                        left: `${(Math.min(bgmStartTime, safeDuration) / safeDuration) * 100}%`,
                        width: `${(Math.max(0, (bgmEndTime || safeDuration) - bgmStartTime) / safeDuration) * 100}%`,
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] text-[#6b7a6e]">
                      BGM ?�음 · ?�디????��??추�?
                    </div>
                  )}
                  <div
                    className="absolute inset-y-0 w-0.5 bg-white"
                    style={{ left: `${playheadPct}%` }}
                  />
                </div>
              </div>

              {/* SFX */}
              <div className="flex items-stretch gap-2">
                <div className="flex w-14 shrink-0 items-center text-[10px] text-[#6b7a6e]">SFX</div>
                <div
                  className="relative h-9 flex-1 cursor-pointer overflow-hidden rounded-lg border border-amber-500/30 bg-amber-900/25"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    onSeekRatio(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
                  }}
                >
                  {sfxUrl ? (
                    <div
                      className="absolute inset-y-1 rounded bg-amber-500/55"
                      style={{
                        left: `${(Math.min(sfxStartTime, safeDuration) / safeDuration) * 100}%`,
                        width: `${(Math.max(0, (sfxEndTime || sfxStartTime + 1) - sfxStartTime) / safeDuration) * 100}%`,
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] text-[#6b7a6e]">
                      ?�과???�음
                    </div>
                  )}
                  <div
                    className="absolute inset-y-0 w-0.5 bg-white"
                    style={{ left: `${playheadPct}%` }}
                  />
                </div>
              </div>

              {/* Subtitles */}
              <TrackRow
                label="?�막"
                className="bg-[#7dd3a8]/30 border-[#7dd3a8]/40"
                playheadPct={playheadPct}
                onSeekRatio={onSeekRatio}
                active={scriptLineCount > 0}
              />
            </div>
          </div>

          {/* Inspector */}
          <div className="order-1 grid grid-cols-1 gap-3 xl:col-span-8 xl:col-start-5 xl:row-start-1">
            <div className="space-y-3 rounded-2xl border border-[rgba(255,246,238,0.1)] bg-[#121a16] p-4">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["subtitle", "?�막", Type],
                    ["audio", "?�디??, Music2],
                    ["meta", "?�튜�?, Film],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onInspectorTabChange(id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      inspectorTab === id
                        ? "border-[#ff8fab]/50 bg-[#ff8fab]/20 text-[#fff6ee]"
                        : "border-[rgba(255,246,238,0.1)] bg-black/25 text-[#9aa89c] hover:border-[#7dd3a8]/40"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {inspectorTab === "subtitle" ? (
                <div className="max-h-[480px] space-y-4 overflow-y-auto pr-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Select value="default" disabled>
                      <SelectTrigger className="h-8 w-[200px] border-[rgba(243,235,224,0.12)] bg-black/40 text-xs text-[#f3ebe0]">
                        <SelectValue placeholder="기본 ?�막" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">?�?�라???�막</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="ml-auto text-[10px] text-[#ff8fab]">
                      {subtitleStyle.position === "top"
                        ? "?�단"
                        : subtitleStyle.position === "center"
                          ? "중단"
                          : "?�단"}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-[#9aa89c]">?�스???�기 {subtitleStyle.fontSize}px</Label>
                    <Slider
                      min={32}
                      max={82}
                      step={1}
                      value={[subtitleStyle.fontSize]}
                      onValueChange={([v]) => patch({ fontSize: v ?? 54 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] text-[#9aa89c]">?�트 ?�상</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={subtitleStyle.color}
                        onChange={(e) => patch({ color: e.target.value })}
                        className="h-8 border-[rgba(243,235,224,0.12)] bg-black/40 font-mono text-xs text-[#f3ebe0]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-[rgba(255,246,238,0.14)] text-xs text-[#d7e0d8]"
                        onClick={() => patch({ color: randomColor() })}
                      >
                        ?�덤
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`h-6 w-6 rounded-md border ${
                            subtitleStyle.color.toLowerCase() === c.toLowerCase()
                              ? "border-[#7dd3a8] ring-1 ring-[#7dd3a8]"
                              : "border-white/20"
                          }`}
                          style={{ backgroundColor: c }}
                          onClick={() => patch({ color: c })}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border border-[rgba(255,246,238,0.08)] p-2.5">
                    <label className="flex items-center gap-2 text-xs text-[#d7e0d8]">
                      <Checkbox
                        checked={subtitleStyle.outlineEnabled !== false}
                        onCheckedChange={(c) => patch({ outlineEnabled: c === true })}
                      />
                      ?�곽??
                    </label>
                    {subtitleStyle.outlineEnabled !== false ? (
                      <>
                        <Label className="text-[11px] text-[#9aa89c]">
                          ???�께 {subtitleStyle.outlineWidth ?? 8}px
                        </Label>
                        <Slider
                          min={0}
                          max={16}
                          step={1}
                          value={[subtitleStyle.outlineWidth ?? 8]}
                          onValueChange={([v]) => patch({ outlineWidth: v ?? 8 })}
                        />
                        <Input
                          value={subtitleStyle.outlineColor || "#000000"}
                          onChange={(e) => patch({ outlineColor: e.target.value })}
                          className="h-8 border-[rgba(243,235,224,0.12)] bg-black/40 font-mono text-xs text-[#f3ebe0]"
                        />
                      </>
                    ) : null}
                  </div>

                  <div className="space-y-2 rounded-lg border border-[rgba(255,246,238,0.08)] p-2.5">
                    <label className="flex items-center gap-2 text-xs text-[#d7e0d8]">
                      <Checkbox
                        checked={subtitleStyle.shadowEnabled !== false && subtitleStyle.textShadow}
                        onCheckedChange={(c) =>
                          patch({ shadowEnabled: c === true, textShadow: c === true })
                        }
                      />
                      그림??
                    </label>
                    {subtitleStyle.shadowEnabled !== false && subtitleStyle.textShadow ? (
                      <>
                        <Input
                          value={subtitleStyle.shadowColor || "#000000"}
                          onChange={(e) => patch({ shadowColor: e.target.value })}
                          className="h-8 border-[rgba(243,235,224,0.12)] bg-black/40 font-mono text-xs text-[#f3ebe0]"
                        />
                        <Label className="text-[11px] text-[#9aa89c]">
                          거리 {subtitleStyle.shadowDistance ?? 12}
                        </Label>
                        <Slider
                          min={0}
                          max={24}
                          step={1}
                          value={[subtitleStyle.shadowDistance ?? 12]}
                          onValueChange={([v]) => patch({ shadowDistance: v ?? 12 })}
                        />
                      </>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] text-[#9aa89c]">?�이???�치</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          ["top", "?�단", 15],
                          ["center", "중단", 50],
                          ["bottom", "?�단", 88],
                        ] as const
                      ).map(([pos, label, y]) => (
                        <button
                          key={pos}
                          type="button"
                          className={`h-8 rounded-md border text-xs ${
                            subtitleStyle.position === pos
                              ? "border-[#ff8fab]/50 bg-[#ff8fab]/20 text-[#fff6ee]"
                              : "border-[rgba(255,246,238,0.1)] text-[#9aa89c]"
                          }`}
                          onClick={() => patch({ position: pos, verticalPercent: y, positionOffset: 0 })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <Label className="text-[11px] text-[#9aa89c]">가�?{horizontalPercent}%</Label>
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={[horizontalPercent]}
                      onValueChange={([v]) => patch({ horizontalPercent: v ?? 50 })}
                    />
                    <Label className="text-[11px] text-[#9aa89c]">?�로 {verticalPercent}%</Label>
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={[verticalPercent]}
                      onValueChange={([v]) => {
                        const y = v ?? 88
                        const position: AnimalSubtitleStyle["position"] =
                          y < 33 ? "top" : y < 66 ? "center" : "bottom"
                        patch({ verticalPercent: y, position, positionOffset: 0 })
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-[#9aa89c]">배경 ?�명??/Label>
                    <Slider
                      value={[
                        parseFloat(subtitleStyle.backgroundColor.split(",")[3]?.replace(")", "") || "0.5"),
                      ]}
                      onValueChange={([value]) =>
                        patch({ backgroundColor: `rgba(0, 0, 0, ${value ?? 0.5})` })
                      }
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>
                </div>
              ) : null}

              {inspectorTab === "audio" ? (
                <div className="max-h-[480px] overflow-y-auto pr-1">{audioPanel}</div>
              ) : null}

              {inspectorTab === "meta" ? (
                <div className="max-h-[480px] overflow-y-auto pr-1">{metaPanel}</div>
              ) : null}
            </div>
          </div>

          {/* Export */}
          <div className="order-1 space-y-3 rounded-2xl border border-[rgba(255,246,238,0.1)] bg-[#121a16] p-3 xl:col-span-8 xl:col-start-5">
            <Button
              type="button"
              onClick={onGeneratePreview}
              disabled={isGeneratingPreview || !hasVideos}
              className="animal-cta-cute h-11 w-full rounded-full font-semibold"
            >
              {isGeneratingPreview ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  미리보기 ?�성 중�?
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  미리보기 ?�성
                </>
              )}
            </Button>
            {exportActions}
            {!previewGenerated ? (
              <p className="text-center text-xs text-[#6b7a6e]">먼�? 미리보기�??�성?�주?�요</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function TrackRow({
  label,
  className,
  playheadPct,
  onSeekRatio,
  active,
}: {
  label: string
  className: string
  playheadPct: number
  onSeekRatio: (ratio: number) => void
  active: boolean
}) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex w-14 shrink-0 items-center text-[10px] text-[#6b7a6e]">{label}</div>
      <div
        className={`relative h-9 flex-1 cursor-pointer rounded-lg border ${className}`}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          onSeekRatio(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
        }}
      >
        <div
          className="absolute inset-y-1 left-1 right-1 rounded bg-white/20"
          style={{ opacity: active ? 1 : 0.25 }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-white"
          style={{ left: `${playheadPct}%` }}
        />
      </div>
    </div>
  )
}

export function AnimalExportPrimaryButton(props: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  label: string
}) {
  return (
    <Button
      onClick={props.onClick}
      disabled={props.disabled}
      className="bg-[#ff8fab] text-white hover:bg-[#ff7a9a]"
      size="lg"
    >
      {props.loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {props.label}
    </Button>
  )
}

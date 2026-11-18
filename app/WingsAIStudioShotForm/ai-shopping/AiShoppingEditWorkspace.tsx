"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type ReactNode,
} from "react"
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
import { Volume2, RotateCcw, ZoomIn, Film, Loader2, Download, Music2 } from "lucide-react"
import { VOICE_PREVIEW_BGM_OPTIONS } from "@/lib/shotform-factory-voice-preview-bgm"
import { PhoneShell } from "@/components/wings-shopping-v2/StudioBits"

export type ShoppingSubtitleStyle = {
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
  showAd?: boolean
}

/** 하단 자막 세로 위치(%) — 쇼츠 하단 UI(채널명·설명)에 가리지 않는 높이 */
export const SHOPPING_SUBTITLE_BOTTOM_PERCENT = 72

/** AI 영상 편집 자막 스타일 기본값 */
export const DEFAULT_SHOPPING_SUBTITLE_STYLE: ShoppingSubtitleStyle = {
  fontSize: 54,
  fontFamily: "Pretendard",
  color: "#FFFFFF",
  backgroundColor: "transparent",
  position: "bottom",
  positionOffset: 0,
  textAlign: "center",
  fontWeight: "bold",
  textShadow: true,
  outlineEnabled: true,
  outlineWidth: 8,
  outlineColor: "#000000",
  shadowEnabled: true,
  shadowColor: "#000000",
  shadowDistance: 3,
  shadowAngle: -46,
  horizontalPercent: 50,
  verticalPercent: SHOPPING_SUBTITLE_BOTTOM_PERCENT,
  showAd: false,
}

/** 저장된 스타일을 기본값과 합치고, 예전 디폴트(거리 12 / 각도 -45)는 새 디폴트로 치환한다. */
export function normalizeShoppingSubtitleStyle(
  style?: Partial<ShoppingSubtitleStyle> | null
): ShoppingSubtitleStyle {
  const merged: ShoppingSubtitleStyle = {
    ...DEFAULT_SHOPPING_SUBTITLE_STYLE,
    ...(style || {}),
    positionOffset: style?.positionOffset ?? DEFAULT_SHOPPING_SUBTITLE_STYLE.positionOffset,
  }
  // 예전 제품 기본값이면 새 기본값으로 교체 (프로젝트에 12/-45로 저장된 경우 포함)
  if (merged.shadowDistance === 12) {
    merged.shadowDistance = DEFAULT_SHOPPING_SUBTITLE_STYLE.shadowDistance
  }
  if (merged.shadowAngle === -45) {
    merged.shadowAngle = DEFAULT_SHOPPING_SUBTITLE_STYLE.shadowAngle
  }
  // 88%는 쇼츠 하단 UI(설명·버튼)에 가려지는 예전 기본값
  if (merged.verticalPercent === 88) {
    merged.verticalPercent = SHOPPING_SUBTITLE_BOTTOM_PERCENT
  }
  return merged
}

const COLOR_PRESETS = [
  "#FFFFFF",
  "#FFFF00",
  "#FFD700",
  "#FF6B00",
  "#FF0000",
  "#FF69B4",
  "#9B59B6",
  "#3498DB",
  "#2ECC71",
  "#1ABC9C",
  "#000000",
  "#95A5A6",
  "#E74C3C",
  "#F1C40F",
]

// 이 라우트는 html.light-remap 이 팔레트 유틸(bg-white, zinc 등)을 뒤집으므로 light-keep 안에서 hex 임의값만 쓴다.
const SHADOW = "shadow-[0_1px_2px_rgba(14,16,22,0.04),0_30px_60px_-36px_rgba(47,59,235,0.28)]"
const CARD = `rounded-[24px] border border-[#e3e6ec] bg-[#ffffff] ${SHADOW}`
const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#2f3beb] focus-visible:ring-offset-2 focus-visible:ring-offset-[#ffffff]"
const GHOST_BTN = "h-9 rounded-[10px] border-[#e3e6ec] bg-[#ffffff] px-3 text-[13px] text-[#0e1016] hover:bg-[#f5f6fa] hover:text-[#0e1016]"
const HEX_INPUT =
  "h-9 rounded-[10px] border-[#e3e6ec] bg-[#ffffff] font-mono text-[13px] !text-[#0e1016] caret-[#0e1016] focus-visible:border-[#2f3beb] focus-visible:ring-[#2f3beb]/20"
const NUM_INPUT =
  "h-8 w-20 rounded-[10px] border-[#e3e6ec] bg-[#ffffff] text-right font-mono text-[12px] !text-[#0e1016]"
const SECTION_TITLE = "text-[13px] font-bold text-[#0e1016]"
const FIELD_LABEL = "text-[12px] font-medium text-[#5c6170]"
const VALUE_TEXT = "font-mono text-[12px] tabular-nums text-[#0e1016]"

const TABS = [
  ["subtitle", "자막"],
  ["screen", "화면"],
  ["bgm", "배경음악"],
  ["thumbnail", "썸네일"],
  ["export", "내보내기"],
] as const
type Tab = (typeof TABS)[number][0]

function formatTime(sec: number) {
  const s = Math.max(0, sec || 0)
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
}

function randomColor() {
  return COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)] || "#FFFFFF"
}

function shadowCss(style: ShoppingSubtitleStyle) {
  if (style.shadowEnabled === false && !style.textShadow) return "none"
  if (style.shadowEnabled === false) return "none"
  const dist = style.shadowDistance ?? 3
  const angle = ((style.shadowAngle ?? -46) * Math.PI) / 180
  const x = Math.cos(angle) * dist
  const y = Math.sin(angle) * dist
  const color = style.shadowColor || "#000000"
  return `${x.toFixed(1)}px ${y.toFixed(1)}px 4px ${color}`
}

export type CaptionCue = { text: string; start: number; end: number }

type Props = {
  previewVideoHostRef: RefObject<HTMLDivElement | null>
  previewGenerated: boolean
  hasVideos: boolean
  currentSubtitle: string
  subtitleStyle: ShoppingSubtitleStyle
  onSubtitleStyleChange: (next: ShoppingSubtitleStyle) => void
  isPlaying: boolean
  onTogglePlay: () => void
  currentTime: number
  duration: number
  onSeekRatio: (ratio: number) => void
  videoZoom: number
  videoOffsetX: number
  videoOffsetY: number
  onVideoZoomChange: (v: number) => void
  onVideoOffsetXChange: (v: number) => void
  onVideoOffsetYChange: (v: number) => void
  onResetTransform: () => void
  originalClipSound: boolean
  onOriginalClipSoundChange: (v: boolean) => void
  /** VOICE_PREVIEW_BGM_OPTIONS id · "" = 없음 · "custom" = 업로드한 파일 */
  bgmTrackId: string
  onBgmTrackChange: (id: string) => void
  bgmVolume: number
  onBgmVolumeChange: (v: number) => void
  previewThumbnailSrc?: string | null
  videoTransitionOpacity: number
  scriptLineCount: number
  sceneCount: number
  sceneDurations?: number[]
  workspaceTab: "subtitle" | "autoedit"
  onWorkspaceTabChange: (t: "subtitle" | "autoedit") => void
  settingsTab: "settings" | "templates"
  onSettingsTabChange: (t: "settings" | "templates") => void
  isGeneratingPreview: boolean
  onGeneratePreview: () => void
  /** 내보내기 탭 내용 (기존 방식 다운로드 · 따로 받기) */
  exportActions: ReactNode
  extras?: ReactNode
  /** 상단 큰 제목 */
  projectTitle?: string
  /** 자막 트랙 (초 단위) */
  captionCues?: CaptionCue[]
  /** 썸네일 탭 요약 */
  selectedThumbnail?: { url: string; index: number } | null
  onGoThumbnail?: () => void
  /** 상단 ② 고품질 렌더링 */
  onProRender?: () => void
  proRenderStatus?: "idle" | "uploading" | "rendering"
  proRenderDisabled?: boolean
}

export function AiShoppingEditWorkspace({
  previewVideoHostRef,
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
  videoZoom,
  videoOffsetX,
  videoOffsetY,
  onVideoZoomChange,
  onVideoOffsetXChange,
  onVideoOffsetYChange,
  onResetTransform,
  originalClipSound,
  onOriginalClipSoundChange,
  bgmTrackId,
  onBgmTrackChange,
  bgmVolume,
  onBgmVolumeChange,
  previewThumbnailSrc,
  videoTransitionOpacity,
  scriptLineCount,
  sceneCount,
  sceneDurations = [],
  isGeneratingPreview,
  onGeneratePreview,
  exportActions,
  extras,
  projectTitle,
  captionCues = [],
  selectedThumbnail,
  onGoThumbnail,
  onProRender,
  proRenderStatus = "idle",
  proRenderDisabled,
}: Props) {
  const patch = (p: Partial<ShoppingSubtitleStyle>) =>
    onSubtitleStyleChange({ ...subtitleStyle, ...p })

  const verticalPercent =
    subtitleStyle.verticalPercent ??
    (subtitleStyle.position === "top" ? 15 : subtitleStyle.position === "center" ? 50 : SHOPPING_SUBTITLE_BOTTOM_PERCENT)
  const horizontalPercent = subtitleStyle.horizontalPercent ?? 50
  const previewFrameRef = useRef<HTMLDivElement | null>(null)
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState(false)
  const [tab, setTab] = useState<Tab>("subtitle")
  const [big, setBig] = useState(false)

  useEffect(() => {
    if (!big) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBig(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [big])

  const applyPositionFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const frame = previewFrameRef.current
      if (!frame) return
      const rect = frame.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const x = ((clientX - rect.left) / rect.width) * 100
      const y = ((clientY - rect.top) / rect.height) * 100
      const nextX = Math.max(8, Math.min(92, x))
      const nextY = Math.max(8, Math.min(92, y))
      const position: ShoppingSubtitleStyle["position"] =
        nextY < 33 ? "top" : nextY < 66 ? "center" : "bottom"
      patch({
        horizontalPercent: Math.round(nextX),
        verticalPercent: Math.round(nextY),
        position,
        positionOffset: 0,
      })
    },
    // patch는 subtitleStyle 클로저에 의존 — 최신 스타일 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subtitleStyle, onSubtitleStyleChange]
  )

  const onSubtitlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDraggingSubtitle(true)
    applyPositionFromClient(event.clientX, event.clientY)
  }

  const onSubtitlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingSubtitle) return
    applyPositionFromClient(event.clientX, event.clientY)
  }

  const onSubtitlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingSubtitle) return
    setIsDraggingSubtitle(false)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }

  // 실제 자막만 표시. 안내 문구는 미리보기/다운로드 중에도 노출하지 않는다.
  const displaySubtitle = currentSubtitle.trim()

  const positionLabel =
    subtitleStyle.position === "top" ? "상단" : subtitleStyle.position === "center" ? "중단" : "하단"

  // 장면 클립 위치 (정확한 길이가 없으면 균등 분할)
  const hasExactDurations = sceneDurations.length === sceneCount && sceneCount > 0
  const sceneTotal = hasExactDurations ? sceneDurations.reduce((a, b) => a + b, 0) : 0
  const total = duration || sceneTotal || 15
  const clips = Array.from({ length: Math.max(1, sceneCount) }, (_, index) => {
    const len = hasExactDurations ? Math.max(0.001, sceneDurations[index] || 0) : total / Math.max(1, sceneCount)
    const start = hasExactDurations ? sceneDurations.slice(0, index).reduce((s, v) => s + v, 0) : len * index
    return { start, len }
  })
  const seekSec = (sec: number) => onSeekRatio(Math.min(1, Math.max(0, sec / Math.max(0.001, total))))

  const proBusy = proRenderStatus !== "idle"
  const statusLines: { text: string; tone?: "warn" | "accent" }[] = []
  if (!hasVideos) statusLines.push({ text: "모든 장면 영상이 있어야 미리보기를 만들 수 있어요. 영상 단계에서 먼저 채워 주세요.", tone: "warn" })
  else if (!previewGenerated && !isGeneratingPreview) statusLines.push({ text: "먼저 ① 미리보기 생성을 눌러 주세요. 미리보기에서 자막을 드래그해 위치를 옮길 수 있어요." })
  if (isGeneratingPreview) statusLines.push({ text: "미리보기를 만드는 중이에요…", tone: "accent" })
  if (proBusy)
    statusLines.push({
      text: proRenderStatus === "uploading" ? "고품질 렌더링 · 소재 올리는 중..." : "고품질 렌더링 중... (1~3분)",
      tone: "accent",
    })
  if (previewGenerated && !proBusy)
    statusLines.push({ text: "자막·화면·배경음악을 고른 뒤 ② 고품질 렌더링으로 완성 영상을 만드세요. 배경음은 미리보기를 다시 생성하면 들립니다." })

  const tabBody: Record<Tab, ReactNode> = {
    subtitle: (
      <div className="divide-y divide-[#eef0f4]">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
          <p className="text-[12px] leading-snug text-[#5c6170]">
            미리보기에서 자막을 드래그하거나 아래에서 위치를 조절하세요.
          </p>
          <span className="rounded-full bg-[#f1f3f7] px-2.5 py-1 text-[12px] tabular-nums text-[#5c6170]">
            {positionLabel} · X {horizontalPercent}% · Y {verticalPercent}%
          </span>
        </div>

        {/* 텍스트 */}
        <section className="space-y-4 py-4">
          <p className={SECTION_TITLE}>텍스트</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className={FIELD_LABEL}>프리셋</span>
            <Select value="default" disabled>
              <SelectTrigger className="h-9 w-[220px] rounded-[10px] border-[#e3e6ec] bg-[#ffffff] text-[13px] text-[#0e1016]">
                <SelectValue placeholder="기본 자막" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">기본 자막 - 타임라인 자막</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className={FIELD_LABEL}>크기</Label>
              <span className={VALUE_TEXT}>{subtitleStyle.fontSize}px</span>
            </div>
            <Slider
              min={32}
              max={82}
              step={1}
              value={[subtitleStyle.fontSize]}
              onValueChange={([v]) => patch({ fontSize: v ?? 54 })}
              aria-label="텍스트 크기"
            />
          </div>
          <div className="space-y-2.5">
            <Label className={FIELD_LABEL}>색상</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => {
                const selected = subtitleStyle.color.toLowerCase() === c.toLowerCase()
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={`색상 ${c}`}
                    aria-pressed={selected}
                    className={`h-8 w-8 rounded-full border border-[#0e1016]/10 motion-safe:transition-shadow ${FOCUS} ${
                      selected ? "ring-2 ring-[#2f3beb] ring-offset-2 ring-offset-[#ffffff]" : "hover:ring-2 hover:ring-[#c9cdd6] hover:ring-offset-1"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => patch({ color: c })}
                  />
                )
              })}
            </div>
            <div className="flex items-center gap-2">
              <ColorChip color={subtitleStyle.color} />
              <Input
                value={subtitleStyle.color}
                onChange={(e) => patch({ color: e.target.value })}
                aria-label="폰트 색상 코드"
                className={HEX_INPUT}
              />
              <Button type="button" size="sm" variant="outline" className={GHOST_BTN} onClick={() => patch({ color: randomColor() })}>
                랜덤
              </Button>
            </div>
          </div>
        </section>

        {/* 위치 */}
        <section className="space-y-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <p className={SECTION_TITLE}>위치</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={GHOST_BTN}
              onClick={() =>
                patch({
                  position: "bottom",
                  horizontalPercent: 50,
                  verticalPercent: SHOPPING_SUBTITLE_BOTTOM_PERCENT,
                  positionOffset: 0,
                })
              }
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              기본(하단 중앙)
            </Button>
          </div>
          <div role="group" aria-label="자막 위치" className="grid grid-cols-3 gap-1 rounded-[12px] bg-[#f1f3f7] p-1">
            {(
              [
                ["top", "상단", 15],
                ["center", "중단", 50],
                ["bottom", "하단", SHOPPING_SUBTITLE_BOTTOM_PERCENT],
              ] as const
            ).map(([pos, label, y]) => {
              const selected = subtitleStyle.position === pos
              return (
                <button
                  key={pos}
                  type="button"
                  aria-pressed={selected}
                  className={`h-9 rounded-[9px] text-[13px] font-semibold motion-safe:transition-colors ${FOCUS} ${
                    selected
                      ? "bg-[#ffffff] text-[#0e1016] shadow-[0_1px_2px_rgba(14,16,22,0.08),0_1px_6px_rgba(14,16,22,0.06)]"
                      : "text-[#5c6170] hover:text-[#0e1016]"
                  }`}
                  onClick={() =>
                    patch({
                      position: pos,
                      verticalPercent: y,
                      horizontalPercent: 50,
                      positionOffset: 0,
                    })
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className={FIELD_LABEL}>가로</Label>
                <span className={VALUE_TEXT}>{horizontalPercent}%</span>
              </div>
              <Slider
                min={8}
                max={92}
                step={1}
                value={[horizontalPercent]}
                onValueChange={([v]) => patch({ horizontalPercent: v ?? 50 })}
                aria-label="가로 위치"
              />
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className={FIELD_LABEL}>세로</Label>
                <span className={VALUE_TEXT}>{verticalPercent}%</span>
              </div>
              <Slider
                min={8}
                max={92}
                step={1}
                value={[verticalPercent]}
                onValueChange={([v]) => {
                  const y = v ?? SHOPPING_SUBTITLE_BOTTOM_PERCENT
                  const position: ShoppingSubtitleStyle["position"] =
                    y < 33 ? "top" : y < 66 ? "center" : "bottom"
                  patch({ verticalPercent: y, position, positionOffset: 0 })
                }}
                aria-label="세로 위치"
              />
            </div>
          </div>
        </section>

        {/* 외곽선 */}
        <section className="space-y-4 py-4">
          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span className={SECTION_TITLE}>외곽선</span>
            <Checkbox
              checked={subtitleStyle.outlineEnabled !== false}
              onCheckedChange={(c) => patch({ outlineEnabled: c === true })}
              className="h-5 w-5"
            />
          </label>
          {subtitleStyle.outlineEnabled !== false ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className={FIELD_LABEL}>두께</Label>
                  <span className={VALUE_TEXT}>{subtitleStyle.outlineWidth ?? 8}px</span>
                </div>
                <Slider
                  min={0}
                  max={16}
                  step={1}
                  value={[subtitleStyle.outlineWidth ?? 8]}
                  onValueChange={([v]) => patch({ outlineWidth: v ?? 8 })}
                  aria-label="외곽선 두께"
                />
              </div>
              <div className="flex items-center gap-2 self-end">
                <ColorChip color={subtitleStyle.outlineColor || "#000000"} />
                <Input
                  value={subtitleStyle.outlineColor || "#000000"}
                  onChange={(e) => patch({ outlineColor: e.target.value })}
                  aria-label="외곽선 색상 코드"
                  className={HEX_INPUT}
                />
                <Button type="button" size="sm" variant="outline" className={GHOST_BTN} onClick={() => patch({ outlineColor: randomColor() })}>
                  랜덤
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        {/* 그림자 */}
        <section className="space-y-4 pt-4">
          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span className={SECTION_TITLE}>그림자</span>
            <Checkbox
              checked={subtitleStyle.shadowEnabled !== false && subtitleStyle.textShadow}
              onCheckedChange={(c) => patch({ shadowEnabled: c === true, textShadow: c === true })}
              className="h-5 w-5"
            />
          </label>
          {subtitleStyle.shadowEnabled !== false && subtitleStyle.textShadow ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ColorChip color={subtitleStyle.shadowColor || "#000000"} />
                <Input
                  value={subtitleStyle.shadowColor || "#000000"}
                  onChange={(e) => patch({ shadowColor: e.target.value })}
                  aria-label="그림자 색상 코드"
                  className={HEX_INPUT}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className={FIELD_LABEL}>거리</Label>
                    <span className={VALUE_TEXT}>{subtitleStyle.shadowDistance ?? 3}</span>
                  </div>
                  <Slider
                    min={0}
                    max={24}
                    step={1}
                    value={[subtitleStyle.shadowDistance ?? 3]}
                    onValueChange={([v]) => patch({ shadowDistance: v ?? 3 })}
                    aria-label="그림자 거리"
                  />
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className={FIELD_LABEL}>각도</Label>
                    <span className={VALUE_TEXT}>{subtitleStyle.shadowAngle ?? -46}°</span>
                  </div>
                  <Slider
                    min={-180}
                    max={180}
                    step={1}
                    value={[subtitleStyle.shadowAngle ?? -46]}
                    onValueChange={([v]) => patch({ shadowAngle: v ?? -46 })}
                    aria-label="그림자 각도"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    ),

    screen: (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className={SECTION_TITLE}>화면 조정</p>
            <p className="mt-1 text-[12px] text-[#5c6170]">영상을 확대하거나 위치를 옮겨 프레임을 맞춥니다.</p>
          </div>
          <Button type="button" size="sm" variant="outline" className={GHOST_BTN} onClick={onResetTransform}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            초기화
          </Button>
        </div>
        {(
          [
            ["확대", videoZoom, 50, 200, 100, onVideoZoomChange],
            ["가로", videoOffsetX, -50, 50, 0, onVideoOffsetXChange],
            ["세로", videoOffsetY, -50, 50, 0, onVideoOffsetYChange],
          ] as const
        ).map(([label, value, min, max, fallback, onChange]) => (
          <div key={label} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className={`${FIELD_LABEL} inline-flex items-center gap-1`}>
                {label === "확대" ? <ZoomIn className="h-3.5 w-3.5" /> : null}
                {label}
              </Label>
              <Input
                type="number"
                value={value}
                onChange={(e) => onChange(Number(e.target.value) || fallback)}
                aria-label={`${label} 값`}
                className={NUM_INPUT}
              />
            </div>
            <Slider
              value={[value]}
              min={min}
              max={max}
              step={1}
              onValueChange={([v]) => onChange(v ?? fallback)}
              aria-label={label}
            />
          </div>
        ))}
      </div>
    ),

    bgm: (
      <div className="space-y-4">
        <div className="space-y-3 rounded-[16px] border border-[#e8eaf0] bg-[#fafbfc] p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#eef0ff] text-[#2f3beb]">
              <Music2 className="h-4 w-4" />
            </span>
            <span className="text-[13px] font-semibold text-[#0e1016]">배경음</span>
            <Select value={bgmTrackId || "none"} onValueChange={(v) => onBgmTrackChange(v === "none" ? "" : v)}>
              <SelectTrigger aria-label="배경음 선택" className="ml-auto h-9 w-[160px] rounded-[10px] border-[#e3e6ec] bg-[#ffffff] text-[13px] text-[#0e1016]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">없음</SelectItem>
                {VOICE_PREVIEW_BGM_OPTIONS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
                {bgmTrackId === "custom" && <SelectItem value="custom">업로드한 음악</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          {bgmTrackId && (
            <div className="flex items-center gap-3">
              <span className={`w-10 ${FIELD_LABEL}`}>볼륨</span>
              <Slider
                value={[Math.round(bgmVolume * 100)]}
                min={5}
                max={60}
                step={1}
                onValueChange={([v]) => onBgmVolumeChange(v / 100)}
                className="flex-1"
                aria-label="배경음 볼륨"
              />
              <span className={`w-8 text-right ${VALUE_TEXT}`}>{Math.round(bgmVolume * 100)}</span>
            </div>
          )}
          {bgmTrackId && previewGenerated && (
            <p className="text-[12px] leading-snug text-[#5c6170]">바꾼 배경음은 미리보기를 다시 생성하면 들립니다.</p>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-[16px] border border-[#e8eaf0] bg-[#fafbfc] p-4 text-[13px] font-semibold text-[#0e1016]">
          <Checkbox checked={originalClipSound} onCheckedChange={(c) => onOriginalClipSoundChange(c === true)} />
          <Volume2 className="h-4 w-4 text-[#5c6170]" />
          원본 클립 소리
          <span className="ml-auto text-[12px] font-normal text-[#9aa0ad]">장면 영상에 들어 있는 소리</span>
        </label>
      </div>
    ),

    thumbnail: selectedThumbnail ? (
      <div className="flex items-start gap-4">
        <img
          src={selectedThumbnail.url}
          alt="선택 썸네일"
          className="aspect-[9/16] w-[96px] shrink-0 rounded-[12px] border border-[#e3e6ec] object-cover"
        />
        <div className="min-w-0 space-y-2">
          <p className="text-[14px] font-bold text-[#0e1016]">선택된 썸네일 · {selectedThumbnail.index + 1}번</p>
          <p className="text-[12px] text-[#5c6170]">영상 맨 앞 프레임으로 들어갑니다. 썸네일 단계에서 교체할 수 있어요.</p>
          {onGoThumbnail ? (
            <Button type="button" size="sm" variant="outline" className={GHOST_BTN} onClick={onGoThumbnail}>
              썸네일 단계로
            </Button>
          ) : null}
        </div>
      </div>
    ) : (
      <div className="space-y-3">
        <p className="text-[13px] text-[#5c6170]">선택된 썸네일이 없어요.</p>
        {onGoThumbnail ? (
          <Button type="button" size="sm" variant="outline" className={GHOST_BTN} onClick={onGoThumbnail}>
            썸네일 단계로
          </Button>
        ) : null}
      </div>
    ),

    export: (
      <div className="space-y-4">
        <Button
          type="button"
          onClick={onGeneratePreview}
          disabled={isGeneratingPreview || !hasVideos}
          variant="outline"
          className={`h-11 w-full rounded-[12px] border-[#e3e6ec] bg-[#ffffff] text-[14px] font-semibold text-[#0e1016] hover:bg-[#f5f6fa] hover:text-[#0e1016]`}
        >
          {isGeneratingPreview ? (
            <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
          ) : (
            <Film className="mr-2 h-4 w-4" />
          )}
          {isGeneratingPreview ? "미리보기 생성 중…" : previewGenerated ? "미리보기 다시 생성" : "미리보기 생성"}
        </Button>
        {exportActions}
        {!previewGenerated ? (
          <p className="text-center text-[12px] text-[#9aa0ad]">먼저 미리보기를 생성해주세요</p>
        ) : null}
        {extras}
      </div>
    ),
  }

  return (
    <div className="light-keep flex min-w-0 flex-col gap-4 text-[#0e1016]">
      {/* 상단 바 */}
      <header className={`${CARD} flex flex-wrap items-center gap-4 px-6 py-5`}>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-[#5c6170]">완성 영상 편집</p>
          <h2 className="truncate text-[24px] font-extrabold tracking-[-0.02em] text-[#0e1016]" title={projectTitle}>
            {projectTitle || "AI 쇼핑 숏폼"}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-[16px] bg-[#f1f3f7] p-1.5">
          <button
            type="button"
            className={`inline-flex items-center rounded-[12px] bg-[#ffffff] px-4 py-2.5 text-[14px] font-bold shadow-sm motion-safe:transition disabled:cursor-default disabled:opacity-50 ${FOCUS} ${
              previewGenerated ? "text-[#0d9467]" : "text-[#0e1016] hover:text-[#2f3beb]"
            }`}
            disabled={isGeneratingPreview || !hasVideos}
            onClick={onGeneratePreview}
            title={previewGenerated ? "미리보기 다시 생성" : "미리보기 생성"}
          >
            {isGeneratingPreview ? <Loader2 className="mr-1.5 h-4 w-4 motion-safe:animate-spin" /> : null}
            {isGeneratingPreview ? "미리보기 만드는 중..." : previewGenerated ? "✓ 미리보기 (다시 생성)" : "① 미리보기 생성"}
          </button>
          {onProRender ? (
            <>
              <span aria-hidden className="text-[#9aa0ad]">
                ›
              </span>
              <button
                type="button"
                className={`inline-flex items-center rounded-[12px] bg-[#2f3beb] px-5 py-2.5 text-[14px] font-bold text-[#ffffff] shadow-[0_8px_20px_-8px_#2f3beb] motion-safe:transition hover:bg-[#4350ff] disabled:cursor-default disabled:opacity-50 ${FOCUS}`}
                disabled={proBusy || proRenderDisabled}
                onClick={onProRender}
              >
                {proBusy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 motion-safe:animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-4 w-4" />
                )}
                {proBusy ? (proRenderStatus === "uploading" ? "소재 올리는 중..." : "렌더링 중...") : "② 고품질 렌더링"}
              </button>
            </>
          ) : null}
        </div>
        {statusLines.length ? (
          <div className="w-full space-y-1 border-t border-[#eef0f4] pt-3" aria-live="polite">
            {statusLines.map((s) => (
              <p
                key={s.text}
                className={`text-[13px] ${s.tone === "warn" ? "text-[#c2410c]" : s.tone === "accent" ? "text-[#2f3beb]" : "text-[#5c6170]"}`}
              >
                {s.text}
              </p>
            ))}
          </div>
        ) : null}
      </header>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* 플레이어 */}
        <section
          className={`flex flex-col items-center gap-3 rounded-[24px] bg-[radial-gradient(120%_70%_at_50%_0%,#e4e7ff_0%,#f1f2fb_55%,#f7f8fc_100%)] p-5 ring-1 ring-[#2f3beb]/10 ${SHADOW}`}
        >
          {/* 크게 보기: 같은 DOM을 fixed 로 띄워 영상 요소(previewVideoHostRef)를 다시 붙이지 않는다 */}
          <div
            className={big ? "fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 bg-[#000000]/85 p-4" : "w-full"}
            onClick={big ? (e) => { if (e.target === e.currentTarget) setBig(false) } : undefined}
            role={big ? "dialog" : undefined}
            aria-modal={big ? true : undefined}
            aria-label={big ? "크게 보기" : undefined}
          >
            <PhoneShell
              className={big ? "!max-w-none" : "max-w-[260px]"}
              style={big ? { width: "min(calc((100vh - 150px) * 9 / 16 + 20px), 92vw)" } : undefined}
            >
              <div
                ref={previewFrameRef}
                className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.6rem] bg-[#000000] [container-type:inline-size]"
              >
                {previewGenerated && hasVideos ? (
                  <>
                    <div
                      ref={previewVideoHostRef as RefObject<HTMLDivElement>}
                      className="absolute inset-0 [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
                      style={{
                        opacity: videoTransitionOpacity,
                        transform: `translate(${videoOffsetX}%, ${videoOffsetY}%) scale(${videoZoom / 100})`,
                        transformOrigin: "center center",
                      }}
                    />
                    {previewThumbnailSrc && currentTime < 0.01 ? (
                      <img src={previewThumbnailSrc} alt="썸네일" className="absolute inset-0 h-full w-full object-cover" />
                    ) : null}
                    {displaySubtitle ? (
                      <div className="absolute inset-0 z-10">
                        <div
                          className={`absolute max-w-[88%] cursor-grab touch-none select-none whitespace-nowrap rounded px-2 py-1 ${
                            isDraggingSubtitle ? "cursor-grabbing ring-2 ring-[#4350ff]" : "hover:ring-1 hover:ring-[#ffffff]/60"
                          }`}
                          style={{
                            left: `${horizontalPercent}%`,
                            top: `${verticalPercent}%`,
                            transform: "translate(-50%, -50%)",
                            fontFamily: `'${subtitleStyle.fontFamily}', sans-serif`,
                            // 화면 폭 기준(cqw)이라 크게 보기에서도 비율이 같다 (예전 280px 화면에서 fontSize*0.45px)
                            fontSize: `max(12px, min(${(subtitleStyle.fontSize * 0.16).toFixed(2)}cqw, ${(
                              78 / Math.max(1, displaySubtitle.replace(/\s/g, "").length)
                            ).toFixed(2)}cqw))`,
                            fontWeight: subtitleStyle.fontWeight,
                            textAlign: subtitleStyle.textAlign,
                            color: subtitleStyle.color,
                            backgroundColor:
                              subtitleStyle.backgroundColor === "transparent" ? "transparent" : subtitleStyle.backgroundColor,
                            lineHeight: 1.25,
                            textShadow: shadowCss(subtitleStyle),
                            WebkitTextStroke:
                              subtitleStyle.outlineEnabled !== false
                                ? `${(subtitleStyle.outlineWidth ?? 4) * 0.35}px ${subtitleStyle.outlineColor || "#000"}`
                                : undefined,
                            paintOrder: "stroke fill",
                          }}
                          onPointerDown={onSubtitlePointerDown}
                          onPointerMove={onSubtitlePointerMove}
                          onPointerUp={onSubtitlePointerUp}
                          onPointerCancel={onSubtitlePointerUp}
                          title="드래그하여 자막 위치 이동"
                        >
                          {displaySubtitle}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center text-[#9aa0ad]">
                    {isGeneratingPreview ? (
                      <Loader2 className="h-9 w-9 opacity-70 motion-safe:animate-spin" />
                    ) : (
                      <Film className="h-9 w-9 opacity-60" />
                    )}
                    <p className="text-[13px] leading-snug">
                      {isGeneratingPreview ? "미리보기를 만드는 중이에요" : "미리보기를 생성해주세요"}
                    </p>
                  </div>
                )}
              </div>
            </PhoneShell>
            {big && (
              <div className="flex items-center gap-3 rounded-full bg-[#ffffff]/10 px-4 py-2 text-[#ffffff]">
                <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-[#ffffff]/30 hover:bg-[#ffffff]/10" onClick={() => onSeekRatio(0)} aria-label="맨 앞으로" title="맨 앞으로">
                  ⏮
                </button>
                <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-[#2f3beb] text-[#ffffff] disabled:opacity-40" onClick={onTogglePlay} disabled={!previewGenerated} aria-label={isPlaying ? "일시정지" : "재생"}>
                  {isPlaying ? "❚❚" : "▶"}
                </button>
                <span className="text-[14px] tabular-nums">
                  {formatTime(currentTime)} / {formatTime(total)}
                </span>
                <button type="button" className="rounded-full border border-[#ffffff]/30 px-4 py-1.5 text-[14px] font-semibold hover:bg-[#ffffff]/10" onClick={() => setBig(false)}>
                  닫기
                </button>
              </div>
            )}
          </div>
          <div className="flex w-full max-w-[260px] items-center gap-1.5 rounded-full bg-[#ffffff] p-1.5 shadow-sm ring-1 ring-[#e3e6ec]">
            <button
              type="button"
              className={`grid h-9 w-9 place-items-center rounded-full text-[#5c6170] motion-safe:transition hover:bg-[#f1f3f7] hover:text-[#0e1016] disabled:opacity-40 ${FOCUS}`}
              onClick={() => onSeekRatio(0)}
              disabled={!previewGenerated || currentTime === 0}
              aria-label="맨 앞으로"
              title="맨 앞으로"
            >
              ⏮
            </button>
            <button
              type="button"
              className={`grid h-10 w-10 place-items-center rounded-full bg-[#2f3beb] text-[#ffffff] shadow-[0_8px_20px_-8px_#2f3beb] motion-safe:transition hover:brightness-110 disabled:opacity-40 ${FOCUS}`}
              onClick={onTogglePlay}
              disabled={!previewGenerated}
              aria-label={isPlaying ? "일시정지" : "재생"}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>
            <span className="flex-1 text-center text-[12px] tabular-nums text-[#5c6170]">
              {formatTime(currentTime)} / {formatTime(total)}
            </span>
            <button
              type="button"
              className={`rounded-full px-3 py-2 text-[12px] font-semibold text-[#5c6170] motion-safe:transition hover:bg-[#f1f3f7] hover:text-[#0e1016] ${FOCUS}`}
              onClick={() => setBig(true)}
            >
              ⤢ 크게
            </button>
          </div>
          <p className="text-center text-[11px] text-[#5c6170]">
            {previewGenerated ? "미리보기 재생 중 · 자막을 드래그해 위치를 옮기세요" : "미리보기 전 · 내보내기 전에 먼저 생성하세요"}
          </p>
        </section>

        {/* 오른쪽 탭 */}
        <section className={`${CARD} min-w-0 lg:relative lg:min-h-[560px]`}>
          <div className="flex min-h-0 flex-col lg:absolute lg:inset-0">
            <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#e3e6ec] px-4 py-3" role="tablist" aria-label="편집 설정">
              {TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-[14px] font-semibold motion-safe:transition ${FOCUS} ${
                    tab === id ? "bg-[#0e1016] text-[#ffffff] shadow-sm" : "text-[#5c6170] hover:bg-[#f1f3f7] hover:text-[#0e1016]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div role="tabpanel" className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
              {tabBody[tab]}
            </div>
          </div>
        </section>
      </div>

      <Timeline
        clips={clips}
        cues={captionCues}
        total={total}
        t={currentTime}
        onSeek={seekSec}
        hasBgm={!!bgmTrackId}
        hasNarration={scriptLineCount > 0 || previewGenerated}
      />
    </div>
  )
}

function Timeline({
  clips,
  cues,
  total,
  t,
  onSeek,
  hasBgm,
  hasNarration,
}: {
  clips: { start: number; len: number }[]
  cues: CaptionCue[]
  total: number
  t: number
  onSeek: (sec: number) => void
  hasBgm: boolean
  hasNarration: boolean
}) {
  const [pps, setPps] = useState(48) // 1초당 픽셀
  const width = Math.max(1, total) * pps + 40
  const step = pps >= 60 ? 1 : pps >= 30 ? 2 : 5
  const ticks = Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step)
  const area = useRef<HTMLDivElement>(null)
  const active = clips.findIndex((c) => t >= c.start && t < c.start + c.len)
  const tracks: { label: string; h: string }[] = [
    { label: "자막", h: "h-8" },
    { label: "영상", h: "h-12" },
    { label: "소리", h: "h-9" },
    { label: "배경음", h: "h-7" },
  ]
  const zoomBtn = `grid h-8 w-8 place-items-center rounded-[10px] border border-[#e3e6ec] bg-[#ffffff] text-[14px] text-[#0e1016] hover:bg-[#f5f6fa] ${FOCUS}`

  return (
    <section className={`${CARD} min-w-0 overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-[#e3e6ec] px-5 py-3">
        <h3 className="text-[14px] font-bold text-[#0e1016]">타임라인</h3>
        <span className="text-[12px] tabular-nums text-[#5c6170]">
          {clips.length}개 장면 · {total.toFixed(1)}초
        </span>
        <span className="flex-1" />
        <button type="button" className={zoomBtn} onClick={() => setPps((p) => Math.max(12, p / 1.5))} aria-label="축소">
          −
        </button>
        <span className="w-10 text-center text-[12px] tabular-nums text-[#5c6170]">{Math.round((pps / 48) * 100)}%</span>
        <button type="button" className={zoomBtn} onClick={() => setPps((p) => Math.min(240, p * 1.5))} aria-label="확대">
          +
        </button>
      </div>
      <div className="flex">
        <div className="w-16 shrink-0 border-r border-[#e3e6ec] bg-[#f7f8fb] text-[11px] font-semibold text-[#5c6170]">
          <div className="h-6" />
          {tracks.map((x) => (
            <div key={x.label} className={`${x.h} mb-1.5 flex items-center justify-center`}>
              {x.label}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div
            ref={area}
            className="relative cursor-pointer select-none pb-1.5"
            style={{ width }}
            onClick={(e) => onSeek((e.clientX - area.current!.getBoundingClientRect().left - 8) / pps)}
          >
            {/* 눈금 */}
            <div className="relative h-6 border-b border-[#e3e6ec]">
              {ticks.map((s) => (
                <span
                  key={s}
                  className="absolute top-0 h-full border-l border-[#e3e6ec] pl-1 text-[10px] tabular-nums text-[#9aa0ad]"
                  style={{ left: 8 + s * pps }}
                >
                  {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
                </span>
              ))}
            </div>
            <div className="relative mt-1.5 flex flex-col gap-1.5">
              {/* 자막 */}
              <div className="relative h-8">
                {cues.map((c, i) => {
                  const on = t >= c.start && t < c.end
                  return (
                    <div
                      key={i}
                      className={`absolute inset-y-0 truncate rounded-[8px] border px-2 text-[11px] font-medium leading-8 ${
                        on ? "border-[#2f3beb] bg-[#2f3beb] text-[#ffffff]" : "border-[#2f3beb]/25 bg-[#2f3beb]/[0.07] text-[#0e1016]/80"
                      }`}
                      style={{ left: 8 + c.start * pps, width: Math.max(4, (c.end - c.start) * pps - 2) }}
                      title={c.text}
                    >
                      {c.text}
                    </div>
                  )
                })}
              </div>
              {/* 영상 */}
              <div className="relative h-12">
                {clips.map((c, i) => (
                  <div
                    key={i}
                    className={`absolute inset-y-0 overflow-hidden rounded-[8px] border-2 px-2 text-[11px] font-semibold leading-[2.6rem] ${
                      i === active ? "border-[#2f3beb] bg-[#eef0ff] text-[#2f3beb]" : "border-transparent bg-[#eef0f4] text-[#5c6170]"
                    }`}
                    style={{ left: 8 + c.start * pps, width: Math.max(4, c.len * pps - 2) }}
                    title={`영상 ${i + 1} · ${formatTime(c.start)} – ${formatTime(c.start + c.len)}`}
                  >
                    <span className="truncate">영상 {i + 1}</span>
                  </div>
                ))}
              </div>
              {/* 소리 (나레이션) */}
              <div className="relative h-9">
                {hasNarration ? (
                  <div
                    className="absolute inset-y-0 flex items-center rounded-[8px] border border-[#c7cdfb] bg-[#eef0ff]/70 px-2 text-[11px] font-medium text-[#2f3beb]"
                    style={{ left: 8, width: Math.max(4, total * pps - 2) }}
                  >
                    나레이션
                  </div>
                ) : null}
              </div>
              {/* 배경음 */}
              <div className="relative h-7">
                {hasBgm ? (
                  <div
                    className="absolute inset-y-0 flex items-center rounded-[8px] border border-[#d9dce4] bg-[#f5f6fa] px-2 text-[11px] font-medium text-[#5c6170]"
                    style={{ left: 8, width: Math.max(4, total * pps - 2) }}
                  >
                    배경음악
                  </div>
                ) : null}
              </div>
            </div>
            {/* 재생 헤드 */}
            <div className="pointer-events-none absolute bottom-0 top-0 w-[2px] bg-[#2f3beb]" style={{ left: 8 + t * pps }}>
              <span className="absolute -left-[5px] top-0 h-3 w-3 rounded-full border-2 border-[#ffffff] bg-[#2f3beb] shadow" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ColorChip({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="h-9 w-9 shrink-0 rounded-[10px] border border-[#e3e6ec] shadow-[inset_0_0_0_2px_#ffffff]"
      style={{ backgroundColor: color }}
    />
  )
}

export function ExportActionGrid(props: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{props.children}</div>
}

export function ExportPrimaryButton(props: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  label: string
}) {
  return (
    <Button
      onClick={props.onClick}
      disabled={props.disabled}
      className="bg-[#2f3beb] hover:bg-[#4350ff] text-[#ffffff]"
      size="lg"
    >
      {props.loading ? (
        <Loader2 className="w-4 h-4 mr-2 motion-safe:animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-2" />
      )}
      {props.label}
    </Button>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import type { VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import type { LineSubtitleCue } from "@/lib/shotform-mvp-edit-script"
import { formatNarrationClock } from "@/lib/shotform-factory-narration-script"
import { videoRangeFromVoiceCue } from "@/lib/shotform-mvp-preview-sync"
import { MVP_BGM_CLIP_MIN_SEC, type MvpBgmClip } from "@/lib/mvp-studio-types"
import {
  isMosaicOverlay,
  patchMosaicOverlayTime,
} from "@/lib/mvp-mosaic-overlay-utils"
import type { PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import { cn } from "@/lib/utils"
import { isMvpThumbnailIntroTime } from "@/lib/mvp-thumbnail-intro"

type Props = {
  result: AutoEditJobResult
  segments: readonly NarrationSegment[]
  durationSec: number
  playhead: number
  previewTimelineSec?: number
  thumbnailUrl?: string
  voiceLineCues: VoiceLineCue[] | null
  draftSubtitleCues?: LineSubtitleCue[]
  audioDurationSec: number
  hasAudio: boolean
  selectedCueIndex: number
  onSelectCue: (index: number) => void
  onSeek: (t: number) => void
  bgmClips?: MvpBgmClip[]
  selectedBgmClipId?: string | null
  onSelectBgmClipId?: (id: string | null) => void
  onBgmClipsChange?: (next: MvpBgmClip[]) => void
  onPlaceBgmAt?: (startSec: number) => void
  placedOverlays?: PlacedStudioOverlay[]
  selectedOverlayId?: string | null
  onSelectOverlayId?: (id: string | null) => void
  onPlacedOverlaysChange?: (next: PlacedStudioOverlay[]) => void
}

type DragState = {
  clipId: string
  mode: "start" | "end" | "move"
  trackEl: HTMLElement
  originStart: number
  originEnd: number
  pointerX0: number
}

type MosaicDragState = {
  overlayId: string
  mode: "start" | "end" | "move"
  trackEl: HTMLElement
  originStart: number
  originEnd: number
  pointerX0: number
}

const TRACK_LABEL_W = 56
const HANDLE_W = 8

export function MvpCapCutTimeline({
  result,
  segments,
  durationSec,
  playhead,
  previewTimelineSec,
  thumbnailUrl,
  voiceLineCues,
  draftSubtitleCues = [],
  audioDurationSec,
  hasAudio,
  selectedCueIndex,
  onSelectCue,
  onSeek,
  bgmClips = [],
  selectedBgmClipId = null,
  onSelectBgmClipId,
  onBgmClipsChange,
  onPlaceBgmAt,
  placedOverlays = [],
  selectedOverlayId = null,
  onSelectOverlayId,
  onPlacedOverlaysChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const mosaicDragRef = useRef<MosaicDragState | null>(null)
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null)
  const [draggingMosaicId, setDraggingMosaicId] = useState<string | null>(null)

  const duration = Math.max(0.5, durationSec)
  const plan = result.editPlan?.edit_plan ?? []
  const cues = voiceLineCues ?? []
  const draftMode = cues.length === 0 && draftSubtitleCues.length > 0
  const subtitleBlocks = draftMode
    ? draftSubtitleCues.map((c, i) => ({
        key: `d-${i}`,
        text: c.text,
        startSec: c.start,
        endSec: c.end,
        draft: true as const,
      }))
    : cues.map((c, i) => {
        const range = videoRangeFromVoiceCue(c, segments, cues)
        return {
          key: `c-${i}`,
          text: c.text,
          startSec: range.startSec,
          endSec: range.endSec,
          draft: false as const,
        }
      })

  const ttsBlocks = cues.map((c, i) => {
    const range = videoRangeFromVoiceCue(c, segments, cues)
    return { key: `tts-${i}`, ...range }
  })

  const activeCueIdx = useMemo(() => {
    for (let i = 0; i < subtitleBlocks.length; i++) {
      const c = subtitleBlocks[i]!
      if (playhead >= c.startSec - 0.02 && playhead < c.endSec - 0.01) return i
    }
    return -1
  }, [subtitleBlocks, playhead])

  const pxPerSec = 48
  const timelineWidth = Math.max(640, duration * pxPerSec)
  const headSec = previewTimelineSec ?? playhead
  const atThumbnailIntro = Boolean(thumbnailUrl) && isMvpThumbnailIntroTime(headSec)

  const mosaicClips = useMemo(
    () =>
      placedOverlays
        .filter((o) => isMosaicOverlay(o.catalogId))
        .map((ov) => ({
          id: ov.id,
          label: ov.label?.trim() || (ov.source === "ai" ? "AI 中文" : "모자이크"),
          startSec: ov.startSec ?? 0,
          endSec: ov.endSec ?? duration,
        })),
    [placedOverlays, duration]
  )

  const activeMosaicIdx = useMemo(() => {
    for (let i = 0; i < mosaicClips.length; i++) {
      const c = mosaicClips[i]!
      if (playhead >= c.startSec - 0.02 && playhead <= c.endSec + 0.02) return i
    }
    return -1
  }, [mosaicClips, playhead])

  const pct = useCallback((t: number) => `${Math.min(100, Math.max(0, (t / duration) * 100))}%`, [duration])

  const rulerMarks = useMemo(() => {
    const step = duration <= 20 ? 2 : duration <= 45 ? 5 : 10
    const marks: number[] = []
    for (let t = 0; t <= duration + 0.01; t += step) marks.push(t)
    return marks
  }, [duration])

  const timeFromClientX = useCallback(
    (clientX: number, target: HTMLElement) => {
      const rect = target.getBoundingClientRect()
      const x = clientX - rect.left
      return Math.max(0, Math.min(duration, (x / rect.width) * duration))
    },
    [duration]
  )

  const seekFromClientX = useCallback(
    (clientX: number, target: HTMLElement) => {
      onSeek(timeFromClientX(clientX, target))
    },
    [onSeek, timeFromClientX]
  )

  const patchClip = useCallback(
    (clipId: string, patch: Partial<Pick<MvpBgmClip, "startSec" | "endSec">>) => {
      if (!onBgmClipsChange) return
      onBgmClipsChange(
        bgmClips.map((c) => {
          if (c.id !== clipId) return c
          let startSec = patch.startSec ?? c.startSec
          let endSec = patch.endSec ?? c.endSec
          startSec = Math.max(0, Math.min(duration - MVP_BGM_CLIP_MIN_SEC, startSec))
          endSec = Math.min(duration, Math.max(startSec + MVP_BGM_CLIP_MIN_SEC, endSec))
          return { ...c, startSec, endSec }
        })
      )
    },
    [bgmClips, onBgmClipsChange, duration]
  )

  const patchMosaicClip = useCallback(
    (overlayId: string, patch: { startSec?: number; endSec?: number }) => {
      if (!onPlacedOverlaysChange) return
      onPlacedOverlaysChange(patchMosaicOverlayTime(placedOverlays, overlayId, patch, duration))
    },
    [onPlacedOverlaysChange, placedOverlays, duration]
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (drag && onBgmClipsChange) {
        const rect = drag.trackEl.getBoundingClientRect()
        const dt = ((e.clientX - drag.pointerX0) / Math.max(1, rect.width)) * duration

        if (drag.mode === "start") {
          patchClip(drag.clipId, { startSec: drag.originStart + dt })
        } else if (drag.mode === "end") {
          patchClip(drag.clipId, { endSec: drag.originEnd + dt })
        } else {
          const span = drag.originEnd - drag.originStart
          let start = drag.originStart + dt
          start = Math.max(0, Math.min(duration - span, start))
          patchClip(drag.clipId, { startSec: start, endSec: start + span })
        }
      }

      const mDrag = mosaicDragRef.current
      if (mDrag && onPlacedOverlaysChange) {
        const rect = mDrag.trackEl.getBoundingClientRect()
        const dt = ((e.clientX - mDrag.pointerX0) / Math.max(1, rect.width)) * duration

        if (mDrag.mode === "start") {
          patchMosaicClip(mDrag.overlayId, { startSec: mDrag.originStart + dt })
        } else if (mDrag.mode === "end") {
          patchMosaicClip(mDrag.overlayId, { endSec: mDrag.originEnd + dt })
        } else {
          const span = mDrag.originEnd - mDrag.originStart
          let start = mDrag.originStart + dt
          start = Math.max(0, Math.min(duration - span, start))
          patchMosaicClip(mDrag.overlayId, { startSec: start, endSec: start + span })
        }
      }
    }
    const onUp = () => {
      dragRef.current = null
      mosaicDragRef.current = null
      setDraggingClipId(null)
      setDraggingMosaicId(null)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [onBgmClipsChange, onPlacedOverlaysChange, patchClip, patchMosaicClip, duration])

  const beginDrag = (
    e: React.PointerEvent,
    clip: MvpBgmClip,
    mode: DragState["mode"],
    trackEl: HTMLElement
  ) => {
    e.stopPropagation()
    e.preventDefault()
    onSelectBgmClipId?.(clip.id)
    dragRef.current = {
      clipId: clip.id,
      mode,
      trackEl,
      originStart: clip.startSec,
      originEnd: clip.endSec,
      pointerX0: e.clientX,
    }
    setDraggingClipId(clip.id)
  }

  const beginMosaicDrag = (
    e: React.PointerEvent,
    clip: { id: string; startSec: number; endSec: number },
    mode: MosaicDragState["mode"],
    trackEl: HTMLElement
  ) => {
    e.stopPropagation()
    e.preventDefault()
    onSelectOverlayId?.(clip.id)
    mosaicDragRef.current = {
      overlayId: clip.id,
      mode,
      trackEl,
      originStart: clip.startSec,
      originEnd: clip.endSec,
      pointerX0: e.clientX,
    }
    setDraggingMosaicId(clip.id)
  }

  const playheadMarker = (
    <div
      className="pointer-events-none absolute top-0 z-20 h-full w-0.5 bg-red-400/80"
      style={{ left: pct(headSec) }}
    />
  )

  return (
    <div className="rounded-lg border border-white/10 bg-[#141414]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <p className="text-[11px] font-medium text-slate-300">타임라인</p>
        <span className="font-mono text-[10px] text-slate-500">
          {formatNarrationClock(headSec)}
          {atThumbnailIntro ? " · 썸네일" : ""} / {formatNarrationClock(duration)}
        </span>
      </div>

      <div ref={scrollRef} className="max-h-[300px] overflow-x-auto overflow-y-auto">
        <div style={{ width: timelineWidth + TRACK_LABEL_W + 24, minWidth: "100%" }}>
          <div className="relative flex border-b border-white/10" style={{ height: 28, marginLeft: TRACK_LABEL_W }}>
            <div
              className="relative h-full flex-1 cursor-pointer"
              onClick={(e) => seekFromClientX(e.clientX, e.currentTarget)}
              role="presentation"
            >
              {rulerMarks.map((t) => (
                <span
                  key={t}
                  className="absolute top-0 flex h-full -translate-x-1/2 flex-col items-center text-[9px] text-slate-500"
                  style={{ left: `${(t / duration) * 100}%` }}
                >
                  <span className="mt-1">{formatNarrationClock(t)}</span>
                  <span className="mt-auto h-2 w-px bg-white/20" />
                </span>
              ))}
              <div
                className="absolute top-0 z-30 h-full w-0.5 bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]"
                style={{ left: pct(headSec) }}
              />
            </div>
          </div>

          <div className="flex border-b border-white/5" style={{ height: 44 }}>
            <div
              className="flex shrink-0 items-center border-r border-white/10 bg-[#0f0f0f] px-2 text-[9px] text-emerald-400/90"
              style={{ width: TRACK_LABEL_W }}
            >
              영상
            </div>
            <div
              className="relative flex-1 cursor-pointer bg-[#1a1a1a]"
              onClick={(e) => seekFromClientX(e.clientX, e.currentTarget)}
              role="presentation"
            >
              {thumbnailUrl ? (
                <button
                  type="button"
                  title="쇼츠 첫 프레임 썸네일 (0초)"
                  className="absolute top-1.5 z-10 h-8 w-1.5 min-w-[6px] rounded-sm border border-amber-500/70 bg-gradient-to-b from-amber-500/80 to-amber-700/60 hover:from-amber-400/90"
                  style={{ left: 0 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSeek(0)
                  }}
                />
              ) : null}
              {plan.map((seg, i) => (
                <button
                  key={`v-${i}`}
                  type="button"
                  title={seg.reason}
                  className="absolute top-1.5 h-8 rounded border border-emerald-600/50 bg-gradient-to-b from-emerald-600/60 to-emerald-800/50 hover:from-emerald-500/70"
                  style={{
                    left: pct(seg.output_start),
                    width: `max(3px, calc(${pct(seg.output_end - seg.output_start)} - 2px))`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSeek(seg.output_start)
                  }}
                />
              ))}
              {playheadMarker}
            </div>
          </div>

          <div className="flex border-b border-white/5" style={{ height: 36 }}>
            <div
              className="flex shrink-0 items-center border-r border-white/10 bg-[#0f0f0f] px-2 text-[9px] text-violet-400/90"
              style={{ width: TRACK_LABEL_W }}
            >
              TTS
            </div>
            <div
              className="relative flex-1 cursor-pointer bg-[#1a1a1a]"
              onClick={(e) => seekFromClientX(e.clientX, e.currentTarget)}
              role="presentation"
            >
              {hasAudio && ttsBlocks.length ? (
                ttsBlocks.map((b) => (
                  <div
                    key={b.key}
                    className="absolute top-2 h-5 rounded border border-violet-500/40 bg-gradient-to-r from-violet-700/50 via-violet-600/40 to-violet-700/50"
                    style={{
                      left: pct(b.startSec),
                      width: `max(3px, calc(${pct(b.endSec - b.startSec)} - 2px))`,
                    }}
                    title={`TTS · 영상 ${formatNarrationClock(b.startSec)}–${formatNarrationClock(b.endSec)}`}
                  />
                ))
              ) : hasAudio ? (
                <div
                  className="absolute top-2 h-5 rounded border border-violet-500/40 bg-gradient-to-r from-violet-700/50 via-violet-600/40 to-violet-700/50"
                  style={{
                    left: "0%",
                    width: pct(Math.min(duration, audioDurationSec || duration)),
                  }}
                  title={`TTS ${Math.round((audioDurationSec || 0) * 10) / 10}초`}
                />
              ) : (
                <span className="absolute inset-0 flex items-center px-2 text-[10px] text-slate-600">
                  TTS 생성 후 오디오 트랙 표시
                </span>
              )}
              {playheadMarker}
            </div>
          </div>

          <div className="flex border-b border-white/5" style={{ height: 44 }}>
            <div
              className="flex shrink-0 items-center border-r border-white/10 bg-[#0f0f0f] px-2 text-[9px] text-sky-400/90"
              style={{ width: TRACK_LABEL_W }}
            >
              배경음
            </div>
            <div
              data-bgm-track
              className="relative flex-1 cursor-crosshair bg-[#1a1a1a]"
              onClick={(e) => {
                if (draggingClipId) return
                const t = timeFromClientX(e.clientX, e.currentTarget)
                if (onPlaceBgmAt && bgmClips.length === 0) onPlaceBgmAt(t)
                else onSeek(t)
              }}
              role="presentation"
            >
              {bgmClips.length ? (
                bgmClips.map((clip) => {
                  const selected = selectedBgmClipId === clip.id
                  const span = clip.endSec - clip.startSec
                  return (
                    <div
                      key={clip.id}
                      className={cn(
                        "absolute top-2 flex h-7 overflow-hidden rounded border text-[8px] leading-tight",
                        selected
                          ? "z-10 border-sky-300 bg-sky-500/70 text-white ring-1 ring-sky-200/40"
                          : "border-sky-600/40 bg-sky-700/50 text-sky-50 hover:bg-sky-600/60"
                      )}
                      style={{
                        left: pct(clip.startSec),
                        width: `max(12px, calc(${pct(span)} - 2px))`,
                      }}
                      title={`${clip.label} · ${formatNarrationClock(clip.startSec)}–${formatNarrationClock(clip.endSec)}`}
                    >
                      <div
                        className="z-20 w-2 shrink-0 cursor-ew-resize bg-white/25 hover:bg-white/45"
                        style={{ width: HANDLE_W }}
                        onPointerDown={(e) => {
                          const track = (e.currentTarget as HTMLElement).closest("[data-bgm-track]")
                          if (track) beginDrag(e, clip, "start", track as HTMLElement)
                        }}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 cursor-grab truncate px-0.5 text-left active:cursor-grabbing"
                        onPointerDown={(e) => {
                          const track = (e.currentTarget as HTMLElement).closest("[data-bgm-track]")
                          if (track) beginDrag(e, clip, "move", track as HTMLElement)
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectBgmClipId?.(clip.id)
                          onSeek(clip.startSec)
                        }}
                      >
                        {clip.label}
                      </button>
                      <div
                        className="z-20 w-2 shrink-0 cursor-ew-resize bg-white/25 hover:bg-white/45"
                        style={{ width: HANDLE_W }}
                        onPointerDown={(e) => {
                          const track = (e.currentTarget as HTMLElement).closest("[data-bgm-track]")
                          if (track) beginDrag(e, clip, "end", track as HTMLElement)
                        }}
                      />
                    </div>
                  )
                })
              ) : (
                <span className="absolute inset-0 flex items-center px-2 text-[10px] text-slate-600">
                  음원 선택 후 이 트랙 클릭 · 핸들로 구간 조절 · Delete 삭제
                </span>
              )}
              {playheadMarker}
            </div>
          </div>

          <div className="flex border-b border-white/5" style={{ height: 44 }}>
            <div
              className="flex shrink-0 items-center border-r border-white/10 bg-[#0f0f0f] px-2 text-[9px] font-semibold text-cyan-300"
              style={{ width: TRACK_LABEL_W }}
            >
              모자이크
            </div>
            <div
              data-mosaic-track
              className="relative flex-1 cursor-pointer bg-[#1a1a1a]"
              onClick={(e) => {
                if (draggingMosaicId) return
                seekFromClientX(e.clientX, e.currentTarget)
              }}
              role="presentation"
            >
              {mosaicClips.length ? (
                mosaicClips.map((clip, i) => {
                  const selected = selectedOverlayId === clip.id
                  const active = activeMosaicIdx === i
                  const span = clip.endSec - clip.startSec
                  return (
                    <div
                      key={clip.id}
                      className={cn(
                        "absolute top-2 flex h-7 overflow-hidden rounded border text-[8px] leading-tight",
                        selected || active
                          ? "z-10 border-cyan-300 bg-cyan-500/75 text-white ring-1 ring-cyan-200/40"
                          : "border-cyan-600/40 bg-cyan-900/55 text-cyan-50 hover:bg-cyan-700/60"
                      )}
                      style={{
                        left: pct(clip.startSec),
                        width: `max(12px, calc(${pct(span)} - 2px))`,
                      }}
                      title={`${clip.label} · ${formatNarrationClock(clip.startSec)}–${formatNarrationClock(clip.endSec)}`}
                    >
                      <div
                        className="z-20 shrink-0 cursor-ew-resize bg-white/25 hover:bg-white/45"
                        style={{ width: HANDLE_W }}
                        onPointerDown={(e) => {
                          const track = (e.currentTarget as HTMLElement).closest("[data-mosaic-track]")
                          if (track) beginMosaicDrag(e, clip, "start", track as HTMLElement)
                        }}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 cursor-grab truncate px-0.5 text-left active:cursor-grabbing"
                        onPointerDown={(e) => {
                          const track = (e.currentTarget as HTMLElement).closest("[data-mosaic-track]")
                          if (track) beginMosaicDrag(e, clip, "move", track as HTMLElement)
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectOverlayId?.(clip.id)
                          onSeek(clip.startSec)
                        }}
                      >
                        {clip.label}
                      </button>
                      <div
                        className="z-20 shrink-0 cursor-ew-resize bg-white/25 hover:bg-white/45"
                        style={{ width: HANDLE_W }}
                        onPointerDown={(e) => {
                          const track = (e.currentTarget as HTMLElement).closest("[data-mosaic-track]")
                          if (track) beginMosaicDrag(e, clip, "end", track as HTMLElement)
                        }}
                      />
                    </div>
                  )
                })
              ) : (
                <span className="absolute inset-0 flex items-center px-2 text-[10px] text-slate-600">
                  AI·수동 모자이크 추가 시 구간 클립 표시 · 핸들로 시간 조절
                </span>
              )}
              {playheadMarker}
            </div>
          </div>

          <div className="flex" style={{ height: 52 }}>
            <div
              className="flex shrink-0 items-center border-r border-white/10 bg-[#0f0f0f] px-2 text-[9px] text-amber-400/90"
              style={{ width: TRACK_LABEL_W }}
            >
              자막
            </div>
            <div
              className="relative flex-1 cursor-pointer bg-[#1a1a1a]"
              onClick={(e) => seekFromClientX(e.clientX, e.currentTarget)}
              role="presentation"
            >
              {subtitleBlocks.length ? (
                subtitleBlocks.map((c, i) => {
                  const selected = selectedCueIndex === i || (selectedCueIndex < 0 && activeCueIdx === i)
                  return (
                    <button
                      key={c.key}
                      type="button"
                      title={c.text}
                      className={cn(
                        "absolute top-2 h-8 overflow-hidden rounded border px-1 text-left text-[9px] leading-tight transition",
                        c.draft
                          ? selected
                            ? "z-10 border-slate-300/50 bg-slate-600/55 text-slate-100 ring-1 ring-slate-300/30"
                            : "border-slate-500/35 bg-slate-700/40 text-slate-200 hover:bg-slate-600/50"
                          : selected
                            ? "z-10 border-amber-300 bg-amber-500/80 text-white ring-1 ring-amber-200/50"
                            : "border-amber-600/30 bg-amber-700/45 text-amber-50 hover:bg-amber-600/55"
                      )}
                      style={{
                        left: pct(c.startSec),
                        width: `max(6px, calc(${pct(c.endSec - c.startSec)} - 2px))`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectCue(i)
                        onSeek(c.startSec)
                      }}
                    >
                      <span className="block truncate">{c.text}</span>
                    </button>
                  )
                })
              ) : (
                <span className="absolute inset-0 flex items-center px-2 text-[10px] text-slate-600">
                  TTS 생성 후 자막 클립이 표시됩니다 · 클릭하여 편집
                </span>
              )}
              {playheadMarker}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

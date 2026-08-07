"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import type { VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import type { LineSubtitleCue } from "@/lib/shotform-mvp-edit-script"
import { formatNarrationClock } from "@/lib/shotform-factory-narration-script"
import {
  audioRangeForSceneIndex,
  audioTimeFromVideoSync,
  timelineUsesAudioAxis,
  videoTimeFromAudioCueSync,
  videoRangeFromVoiceCue,
} from "@/lib/shotform-mvp-preview-sync"
import {
  MVP_BGM_CLIP_MIN_SEC,
  type MvpBgmClip,
  type MvpEffectClip,
} from "@/lib/mvp-studio-types"
import {
  isMosaicOverlay,
  type PlacedStudioOverlay,
} from "@/lib/shotform-studio-overlay-catalog"
import { patchMosaicOverlayTime } from "@/lib/mvp-mosaic-overlay-utils"
import { cn } from "@/lib/utils"
import { isMvpThumbnailIntroTime } from "@/lib/mvp-thumbnail-intro"
import { videoSourceLabel } from "@/lib/mvp-video-source-transform"
import { StorySfxWaveform } from "../story-shopping/StorySfxWaveform"

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
  effectClips?: MvpEffectClip[]
  selectedEffectClipId?: string | null
  onSelectEffectClipId?: (id: string | null) => void
  onEffectClipsChange?: (next: MvpEffectClip[]) => void
  placedOverlays?: PlacedStudioOverlay[]
  selectedOverlayId?: string | null
  onSelectOverlayId?: (id: string | null) => void
  onPlacedOverlaysChange?: (next: PlacedStudioOverlay[]) => void
  selectedEditPlanIndex?: number | null
  onSelectEditPlanIndex?: (index: number | null) => void
  /** 팝업 편집기처럼 부모 높이를 가득 채울 때 */
  fillHeight?: boolean
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

type EffectDragState = {
  clipId: string
  mode: "start" | "end" | "move"
  trackEl: HTMLElement
  originStart: number
  originEnd: number
  pointerX0: number
}

const TRACK_LABEL_W = 56
const HANDLE_W = 8
const EFFECT_CLIP_MIN_SEC = 0.08
/** 빨간바 스냅 — 장면 경계에 이 픽셀 이내로 가면 달라붙음 (캡컷 자석) */
const PLAYHEAD_SNAP_PX = 12

function snapTimeToPoints(t: number, points: readonly number[], thresholdSec: number, maxSec: number): number {
  const clamped = Math.max(0, Math.min(maxSec, t))
  if (!points.length || thresholdSec <= 0) return clamped
  let best = clamped
  let bestDist = thresholdSec
  for (const p of points) {
    const d = Math.abs(clamped - p)
    if (d <= bestDist) {
      bestDist = d
      best = p
    }
  }
  return Math.max(0, Math.min(maxSec, best))
}

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
  effectClips = [],
  selectedEffectClipId = null,
  onSelectEffectClipId,
  onEffectClipsChange,
  placedOverlays = [],
  selectedOverlayId = null,
  onSelectOverlayId,
  onPlacedOverlaysChange,
  selectedEditPlanIndex = null,
  onSelectEditPlanIndex,
  fillHeight = false,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const timelinePanelRef = useRef<HTMLDivElement>(null)
  const timelineContentRef = useRef<HTMLDivElement>(null)
  const playheadDraggingRef = useRef(false)
  const dragRef = useRef<DragState | null>(null)
  const mosaicDragRef = useRef<MosaicDragState | null>(null)
  const effectDragRef = useRef<EffectDragState | null>(null)
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null)
  const [draggingMosaicId, setDraggingMosaicId] = useState<string | null>(null)
  const [draggingEffectId, setDraggingEffectId] = useState<string | null>(null)
  const [pxPerSec, setPxPerSec] = useState(72)
  const pxPerSecRef = useRef(pxPerSec)
  pxPerSecRef.current = pxPerSec

  const duration = Math.max(0.5, durationSec)
  const plan = result.editPlan?.edit_plan ?? []
  const cues = voiceLineCues ?? []
  const useAudioAxis = timelineUsesAudioAxis(cues, audioDurationSec)
  const videoContentSec = Math.max(
    0.5,
    segments.at(-1)?.end ?? plan.at(-1)?.output_end ?? duration
  )
  const draftMode = cues.length === 0 && draftSubtitleCues.length > 0
  const subtitleBlocks = useMemo(
    () =>
      draftMode
        ? draftSubtitleCues.map((c, i) => ({
            key: `d-${i}`,
            text: c.text,
            startSec: c.start,
            endSec: c.end,
            draft: true as const,
          }))
        : cues.map((c, i) => {
            // TTS 후 타임라인은 음성 시간축 — 큐 시각 그대로 표시
            if (useAudioAxis) {
              return {
                key: `c-${i}`,
                text: c.text,
                startSec: c.startSec,
                endSec: c.endSec,
                draft: false as const,
              }
            }
            const range = videoRangeFromVoiceCue(c, segments, cues)
            return {
              key: `c-${i}`,
              text: c.text,
              startSec: range.startSec,
              endSec: range.endSec,
              draft: false as const,
            }
          }),
    [draftMode, draftSubtitleCues, cues, segments, useAudioAxis]
  )

  const ttsBlocks = useMemo(
    () =>
      cues.map((c, i) => {
        if (useAudioAxis) {
          return { key: `tts-${i}`, startSec: c.startSec, endSec: c.endSec }
        }
        const range = videoRangeFromVoiceCue(c, segments, cues)
        return { key: `tts-${i}`, ...range }
      }),
    [cues, segments, useAudioAxis]
  )

  /** 영상 트랙 클립 — TTS 있으면 컷별 음성 길이로 표시(배속 시 짧아짐) */
  const videoTrackClips = useMemo(() => {
    return plan.map((seg, i) => {
      if (useAudioAxis) {
        const audioRange = audioRangeForSceneIndex(i, cues)
        if (audioRange) {
          return {
            index: i,
            seg,
            startSec: audioRange.startSec,
            endSec: audioRange.endSec,
          }
        }
        // 해당 컷 TTS 없으면 영상 비율로 축소 배치
        const scale = audioDurationSec / videoContentSec
        return {
          index: i,
          seg,
          startSec: seg.output_start * scale,
          endSec: seg.output_end * scale,
        }
      }
      return {
        index: i,
        seg,
        startSec: seg.output_start,
        endSec: seg.output_end,
      }
    })
  }, [plan, useAudioAxis, cues, audioDurationSec, videoContentSec])

  const toVideoSec = useCallback(
    (timelineSec: number) => {
      if (!useAudioAxis) return timelineSec
      return videoTimeFromAudioCueSync(
        timelineSec,
        cues,
        segments,
        videoContentSec,
        audioDurationSec
      )
    },
    [useAudioAxis, cues, segments, videoContentSec, audioDurationSec]
  )

  const activeCueIdx = useMemo(() => {
    for (let i = 0; i < subtitleBlocks.length; i++) {
      const c = subtitleBlocks[i]!
      if (playhead >= c.startSec - 0.02 && playhead < c.endSec - 0.01) return i
    }
    return -1
  }, [subtitleBlocks, playhead])

  const timelineWidth = Math.max(1, duration * pxPerSec)
  const headSec = previewTimelineSec ?? playhead
  const atThumbnailIntro = Boolean(thumbnailUrl) && isMvpThumbnailIntroTime(headSec)

  /** 장면(컷) 앞·뒤 + 타임라인 끝 — 빨간바 스냅 지점 */
  const playheadSnapPointsSec = useMemo(() => {
    const pts = new Set<number>([0, duration])
    for (const clip of videoTrackClips) {
      if (Number.isFinite(clip.startSec)) pts.add(clip.startSec)
      if (Number.isFinite(clip.endSec)) pts.add(clip.endSec)
    }
    for (const b of ttsBlocks) {
      if (Number.isFinite(b.startSec)) pts.add(b.startSec)
      if (Number.isFinite(b.endSec)) pts.add(b.endSec)
    }
    return [...pts]
      .filter((t) => t >= -0.001 && t <= duration + 0.001)
      .map((t) => Math.max(0, Math.min(duration, t)))
      .sort((a, b) => a - b)
  }, [videoTrackClips, ttsBlocks, duration])

  const snapPlayheadSec = useCallback(
    (t: number) => {
      const thresholdSec = PLAYHEAD_SNAP_PX / Math.max(24, pxPerSecRef.current)
      return snapTimeToPoints(t, playheadSnapPointsSec, thresholdSec, duration)
    },
    [playheadSnapPointsSec, duration]
  )

  const mosaicClips = useMemo(
    () =>
      placedOverlays
        .filter((o) => isMosaicOverlay(o.catalogId))
        .map((ov) => {
          const videoStart = ov.startSec ?? 0
          const videoEnd = ov.endSec ?? videoContentSec
          if (!useAudioAxis) {
            return {
              id: ov.id,
              label: ov.label?.trim() || (ov.source === "ai" ? "AI 중국어" : "모자이크"),
              startSec: videoStart,
              endSec: videoEnd,
            }
          }
          return {
            id: ov.id,
            label: ov.label?.trim() || (ov.source === "ai" ? "AI 중국어" : "모자이크"),
            startSec: audioTimeFromVideoSync(
              videoStart,
              cues,
              segments,
              videoContentSec,
              audioDurationSec
            ),
            endSec: audioTimeFromVideoSync(
              videoEnd,
              cues,
              segments,
              videoContentSec,
              audioDurationSec
            ),
          }
        }),
    [placedOverlays, videoContentSec, useAudioAxis, cues, segments, audioDurationSec]
  )

  // TTS 축일 때 효과음 startSec는 이미 음성 시간(자동배치·수동추가 동일)
  const effectTrackClips = useMemo(
    () =>
      effectClips.map((clip) => ({
        clip,
        startSec: clip.startSec,
        durationSec: clip.durationSec,
      })),
    [effectClips]
  )

  const handleTimelineWheel = useCallback((event: WheelEvent) => {
    const scroller = scrollRef.current
    const panel = timelinePanelRef.current
    if (!scroller || !panel) return
    // 타임라인 영역 밖에서 발생한 휠은 무시합니다.
    if (!panel.contains(event.target as Node)) return

    const zoomModifier = event.ctrlKey || event.metaKey
    if (zoomModifier) {
      // 브라우저 페이지 줌을 막고 타임라인만 확대·축소합니다.
      event.preventDefault()
      event.stopPropagation()
      const px = pxPerSecRef.current
      const rect = scroller.getBoundingClientRect()
      const pointerX = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
      const timelinePointerX = Math.max(0, pointerX - TRACK_LABEL_W)
      const pointedSecond = Math.max(0, (scroller.scrollLeft + timelinePointerX) / Math.max(px, 1))
      // 트랙패드/휠 감도에 맞춰 단계 조절
      const steps = Math.max(1, Math.min(4, Math.round(Math.abs(event.deltaY) / 40)))
      const factor = event.deltaY < 0 ? 1.12 ** steps : (1 / 1.12) ** steps
      const nextPxPerSec = Math.min(240, Math.max(16, px * factor))
      if (Math.abs(nextPxPerSec - px) < 0.05) return

      setPxPerSec(nextPxPerSec)
      requestAnimationFrame(() => {
        scroller.scrollLeft = Math.max(0, pointedSecond * nextPxPerSec - timelinePointerX)
      })
      return
    }

    if (event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      const amount = Math.max(24, Math.abs(event.deltaY || event.deltaX)) * 1.1
      // 휠 아래 = 왼쪽, 휠 위 = 오른쪽 (스토리 편집기와 동일)
      scroller.scrollLeft += event.deltaY > 0 || event.deltaX > 0 ? -amount : amount
    }
  }, [])

  useEffect(() => {
    const panel = timelinePanelRef.current
    if (!panel) return
    // capture + passive:false — Ctrl+휠이 브라우저 줌으로 가기 전에 가로챕니다.
    panel.addEventListener("wheel", handleTimelineWheel, { passive: false, capture: true })
    return () => panel.removeEventListener("wheel", handleTimelineWheel, { capture: true })
  }, [handleTimelineWheel])

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
      const raw = Math.max(0, Math.min(duration, (x / rect.width) * duration))
      return snapPlayheadSec(raw)
    },
    [duration, snapPlayheadSec]
  )

  const seekFromClientX = useCallback(
    (clientX: number, target: HTMLElement) => {
      onSeek(timeFromClientX(clientX, target))
    },
    [onSeek, timeFromClientX]
  )

  const seekFromTimelineContentX = useCallback(
    (clientX: number) => {
      const content = timelineContentRef.current
      if (!content) return
      const rect = content.getBoundingClientRect()
      const trackWidth = Math.max(1, rect.width - TRACK_LABEL_W)
      const x = clientX - rect.left - TRACK_LABEL_W
      const raw = Math.max(0, Math.min(duration, (x / trackWidth) * duration))
      onSeek(snapPlayheadSec(raw))
    },
    [duration, onSeek, snapPlayheadSec]
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
      // 타임라인이 오디오 축이면 드래그 값을 영상 시각으로 되돌려 저장
      const videoPatch = useAudioAxis
        ? {
            startSec:
              patch.startSec != null ? toVideoSec(patch.startSec) : undefined,
            endSec: patch.endSec != null ? toVideoSec(patch.endSec) : undefined,
          }
        : patch
      onPlacedOverlaysChange(
        patchMosaicOverlayTime(placedOverlays, overlayId, videoPatch, videoContentSec)
      )
    },
    [onPlacedOverlaysChange, placedOverlays, useAudioAxis, toVideoSec, videoContentSec]
  )

  /** 타임라인 표시 시각 = 효과음 저장 시각(TTS면 음성 축, 없으면 영상 축) */
  const patchEffectClip = useCallback(
    (clipId: string, patch: { startSec?: number; endSec?: number }) => {
      if (!onEffectClipsChange) return
      onEffectClipsChange(
        effectClips.map((c) => {
          if (c.id !== clipId) return c
          const display = effectTrackClips.find((row) => row.clip.id === clipId)
          const curStart = display?.startSec ?? c.startSec
          const curEnd = display ? display.startSec + display.durationSec : c.startSec + c.durationSec
          let tStart = patch.startSec ?? curStart
          let tEnd = patch.endSec ?? curEnd
          tStart = Math.max(0, Math.min(duration - EFFECT_CLIP_MIN_SEC, tStart))
          tEnd = Math.min(duration, Math.max(tStart + EFFECT_CLIP_MIN_SEC, tEnd))

          let startSec = Math.max(0, tStart)
          let durationSec = Math.max(EFFECT_CLIP_MIN_SEC, tEnd - tStart)
          const axisMax = useAudioAxis ? duration : videoContentSec
          const maxDur = Math.max(EFFECT_CLIP_MIN_SEC, axisMax - startSec)
          durationSec = Math.min(durationSec, maxDur, c.sourceDurationSec || durationSec)
          startSec = Math.min(startSec, Math.max(0, axisMax - durationSec))

          // 앞쪽 핸들로 줄이면 소스 오프셋도 맞춤
          let sourceOffsetSec = c.sourceOffsetSec
          if (patch.startSec != null && patch.endSec == null) {
            const shrink = Math.max(0, (display?.durationSec ?? c.durationSec) - durationSec)
            if (shrink > 0.001) {
              sourceOffsetSec = Math.min(
                Math.max(0, c.sourceDurationSec - durationSec),
                c.sourceOffsetSec + shrink
              )
            }
          }

          return { ...c, startSec, durationSec, sourceOffsetSec }
        })
      )
    },
    [
      onEffectClipsChange,
      effectClips,
      effectTrackClips,
      duration,
      useAudioAxis,
      videoContentSec,
    ]
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

      const eDrag = effectDragRef.current
      if (eDrag && onEffectClipsChange) {
        const rect = eDrag.trackEl.getBoundingClientRect()
        const dt = ((e.clientX - eDrag.pointerX0) / Math.max(1, rect.width)) * duration

        if (eDrag.mode === "start") {
          patchEffectClip(eDrag.clipId, { startSec: eDrag.originStart + dt })
        } else if (eDrag.mode === "end") {
          patchEffectClip(eDrag.clipId, { endSec: eDrag.originEnd + dt })
        } else {
          const span = eDrag.originEnd - eDrag.originStart
          let start = eDrag.originStart + dt
          start = Math.max(0, Math.min(duration - span, start))
          patchEffectClip(eDrag.clipId, { startSec: start, endSec: start + span })
        }
      }
    }
    const onUp = () => {
      dragRef.current = null
      mosaicDragRef.current = null
      effectDragRef.current = null
      setDraggingClipId(null)
      setDraggingMosaicId(null)
      setDraggingEffectId(null)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [
    onBgmClipsChange,
    onPlacedOverlaysChange,
    onEffectClipsChange,
    patchClip,
    patchMosaicClip,
    patchEffectClip,
    duration,
  ])

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

  const beginEffectDrag = (
    e: React.PointerEvent,
    clipId: string,
    startSec: number,
    endSec: number,
    mode: EffectDragState["mode"],
    trackEl: HTMLElement
  ) => {
    e.stopPropagation()
    e.preventDefault()
    onSelectEffectClipId?.(clipId)
    effectDragRef.current = {
      clipId,
      mode,
      trackEl,
      originStart: startSec,
      originEnd: endSec,
      pointerX0: e.clientX,
    }
    setDraggingEffectId(clipId)
  }

  const playheadRatio = Math.min(duration, Math.max(0, headSec)) / duration
  const playheadLeft = `calc(${TRACK_LABEL_W * (1 - playheadRatio)}px + ${
    playheadRatio * 100
  }%)`
  // sticky left — 확대·축소·좌우 스크롤해도 트랙 이름(영상/TTS/…)은 왼쪽에 고정
  const trackLabelCls = fillHeight
    ? "sticky left-0 z-30 flex shrink-0 items-center border-r border-slate-200 bg-slate-100 px-2 text-[9px] shadow-[2px_0_6px_rgba(15,23,42,0.06)]"
    : "sticky left-0 z-30 flex shrink-0 items-center border-r border-white/10 bg-[#0f0f0f] px-2 text-[9px] shadow-[2px_0_6px_rgba(0,0,0,0.35)]"
  const trackBodyCls = fillHeight
    ? "relative flex-1 cursor-pointer bg-slate-100"
    : "relative flex-1 cursor-pointer bg-[#1a1a1a]"
  const trackRowBorder = fillHeight ? "border-b border-slate-200" : "border-b border-white/5"
  const rulerGutterCls = fillHeight
    ? "sticky left-0 z-30 shrink-0 border-r border-slate-200 bg-slate-100 shadow-[2px_0_6px_rgba(15,23,42,0.06)]"
    : "sticky left-0 z-30 shrink-0 border-r border-white/10 bg-[#0f0f0f] shadow-[2px_0_6px_rgba(0,0,0,0.35)]"

  return (
    <div
      ref={timelinePanelRef}
      className={cn(
        "rounded-lg border",
        fillHeight
          ? "flex h-full min-h-0 flex-col border-slate-200 bg-white"
          : "border-white/10 bg-[#141414]"
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between border-b px-3 py-2",
          fillHeight ? "border-slate-200" : "border-white/10"
        )}
      >
        <div>
          <p
            className={cn(
              "text-[11px] font-medium",
              fillHeight ? "text-slate-800" : "text-slate-300"
            )}
          >
            타임라인
          </p>
          <p className={cn("text-[9px]", fillHeight ? "text-slate-500" : "text-slate-500")}>
            Ctrl+휠 확대·축소 · Shift+휠 좌우 이동
          </p>
        </div>
        <span
          className={cn(
            "font-mono text-[10px]",
            fillHeight ? "text-slate-500" : "text-slate-500"
          )}
        >
          {formatNarrationClock(headSec)}
          {atThumbnailIntro ? " · 썸네일" : ""} / {formatNarrationClock(duration)}
        </span>
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "overflow-x-auto overflow-y-auto overscroll-contain",
          fillHeight ? "min-h-0 flex-1 bg-slate-50" : "max-h-[300px]"
        )}
      >
        <div
          ref={timelineContentRef}
          className="relative"
          style={{ width: timelineWidth + TRACK_LABEL_W + 24 }}
        >
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-40 w-[2px] bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.65)]"
            style={{ left: playheadLeft }}
          >
            <button
              type="button"
              aria-label="재생 위치 이동"
              className="pointer-events-auto absolute -left-[7px] top-0 h-4 w-4 cursor-ew-resize rounded-b-md bg-red-500 p-0 shadow-md ring-1 ring-red-700/40"
              onPointerDown={(event) => {
                event.preventDefault()
                playheadDraggingRef.current = true
                event.currentTarget.setPointerCapture(event.pointerId)
                seekFromTimelineContentX(event.clientX)
              }}
              onPointerMove={(event) => {
                if (playheadDraggingRef.current) {
                  seekFromTimelineContentX(event.clientX)
                }
              }}
              onPointerUp={(event) => {
                playheadDraggingRef.current = false
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId)
                }
              }}
              onPointerCancel={() => {
                playheadDraggingRef.current = false
              }}
            />
          </div>
          <div
            className={cn(
              "relative flex",
              fillHeight ? "border-b border-slate-200" : "border-b border-white/10"
            )}
            style={{ height: 28 }}
          >
            <div className={rulerGutterCls} style={{ width: TRACK_LABEL_W }} aria-hidden />
            <div
              className="relative h-full flex-1 cursor-pointer"
              onClick={(e) => seekFromClientX(e.clientX, e.currentTarget)}
              role="presentation"
            >
              {rulerMarks.map((t) => (
                <span
                  key={t}
                  className={cn(
                    "absolute top-0 flex h-full -translate-x-1/2 flex-col items-center text-[9px]",
                    fillHeight ? "text-slate-500" : "text-slate-500"
                  )}
                  style={{ left: `${(t / duration) * 100}%` }}
                >
                  <span className="mt-1">{formatNarrationClock(t)}</span>
                  <span
                    className={cn(
                      "mt-auto h-2 w-px",
                      fillHeight ? "bg-slate-300" : "bg-white/20"
                    )}
                  />
                </span>
              ))}
            </div>
          </div>

          <div className={cn("flex", trackRowBorder)} style={{ height: 44 }}>
            <div
              className={cn(trackLabelCls, fillHeight ? "text-emerald-700" : "text-emerald-400/90")}
              style={{ width: TRACK_LABEL_W }}
            >
              영상
            </div>
            <div
              data-video-track
              className={trackBodyCls}
              onClick={(e) => seekFromClientX(e.clientX, e.currentTarget)}
              role="presentation"
            >
              {thumbnailUrl ? (
                <button
                  type="button"
                  title="쇼츠 첫 프레임 썸네일 (0~0.01초)"
                  className="absolute top-1.5 z-10 h-8 w-1.5 min-w-[6px] rounded-sm border border-amber-500/70 bg-gradient-to-b from-amber-500/80 to-amber-700/60 hover:from-amber-400/90"
                  style={{ left: 0 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSeek(0)
                  }}
                />
              ) : null}
              {videoTrackClips.map(({ index: i, seg, startSec, endSec }) => {
                const selected = selectedEditPlanIndex === i
                const label = videoSourceLabel(result, seg.video_id)
                return (
                  <button
                    key={`v-${i}`}
                    type="button"
                    title={`컷 ${i + 1} · ${label} · ${seg.reason}`}
                    className={cn(
                      "absolute top-1.5 h-8 overflow-hidden border border-r-0 px-0.5 text-left text-[8px] leading-tight transition",
                      i === 0 ? "rounded-l" : "",
                      i === videoTrackClips.length - 1 ? "rounded-r border-r" : "",
                      selected
                        ? "z-10 border-emerald-300 bg-gradient-to-b from-emerald-500/85 to-emerald-700/70 text-white ring-1 ring-emerald-200/50"
                        : "border-emerald-600/50 bg-gradient-to-b from-emerald-600/60 to-emerald-800/50 text-emerald-50 hover:from-emerald-500/70"
                    )}
                    style={{
                      left: pct(startSec),
                      // 서브픽셀 틈 방지용 0.5px 겹침
                      width: `calc(${pct(Math.max(0.01, endSec - startSec))} + 0.5px)`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectEditPlanIndex?.(i)
                      onSeek(startSec)
                    }}
                  >
                    <span className="block truncate px-0.5 pt-0.5 font-semibold text-[7px] text-emerald-100/90">
                      {i + 1}
                    </span>
                    <span className="block truncate px-0.5">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className={cn("flex", trackRowBorder)} style={{ height: 36 }}>
            <div
              className={cn(trackLabelCls, fillHeight ? "text-violet-700" : "text-violet-400/90")}
              style={{ width: TRACK_LABEL_W }}
            >
              TTS
            </div>
            <div
              className={trackBodyCls}
              onClick={(e) => seekFromClientX(e.clientX, e.currentTarget)}
              role="presentation"
            >
              {hasAudio && ttsBlocks.length ? (
                ttsBlocks.map((b, bi) => (
                  <div
                    key={b.key}
                    className={cn(
                      "absolute top-2 h-5 border border-r-0 border-violet-500/40 bg-gradient-to-r from-violet-700/50 via-violet-600/40 to-violet-700/50",
                      bi === 0 ? "rounded-l" : "",
                      bi === ttsBlocks.length - 1 ? "rounded-r border-r" : ""
                    )}
                    style={{
                      left: pct(b.startSec),
                      width: `calc(${pct(Math.max(0.01, b.endSec - b.startSec))} + 0.5px)`,
                    }}
                    title={`TTS · ${formatNarrationClock(b.startSec)}–${formatNarrationClock(b.endSec)}`}
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
            </div>
          </div>

          <div className={cn("flex", trackRowBorder)} style={{ height: 44 }}>
            <div
              className={cn(trackLabelCls, "font-semibold", fillHeight ? "text-orange-700" : "text-orange-600")}
              style={{ width: TRACK_LABEL_W }}
            >
              효과음
            </div>
            <div
              data-effect-track
              className={trackBodyCls}
              onClick={(event) => {
                if (draggingEffectId) return
                seekFromClientX(event.clientX, event.currentTarget)
              }}
              role="presentation"
            >
              {effectTrackClips.length ? (
                effectTrackClips.map(({ clip, startSec, durationSec: clipDur }) => {
                  const selected = selectedEffectClipId === clip.id
                  const endSec = startSec + clipDur
                  return (
                    <div
                      key={clip.id}
                      className={cn(
                        "absolute top-1.5 flex h-8 min-w-[10px] overflow-hidden rounded-md border text-left text-[8px]",
                        selected
                          ? "z-10 border-orange-500 bg-orange-400 text-orange-950 ring-2 ring-orange-300/50"
                          : "border-orange-400 bg-orange-200 text-orange-900 hover:bg-orange-300",
                        draggingEffectId === clip.id && "opacity-95"
                      )}
                      style={{
                        left: pct(startSec),
                        width: `max(10px, calc(${pct(clipDur)} - 2px))`,
                      }}
                      title={`${clip.label} · ${formatNarrationClock(startSec)}–${formatNarrationClock(endSec)} · 드래그로 이동`}
                    >
                      <div
                        className="z-20 w-2 shrink-0 cursor-ew-resize bg-black/15 hover:bg-black/30"
                        style={{ width: HANDLE_W }}
                        onPointerDown={(e) => {
                          const track = (e.currentTarget as HTMLElement).closest("[data-effect-track]")
                          if (track) {
                            beginEffectDrag(e, clip.id, startSec, endSec, "start", track as HTMLElement)
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="relative min-w-0 flex-1 cursor-grab overflow-hidden text-left active:cursor-grabbing"
                        onPointerDown={(e) => {
                          const track = (e.currentTarget as HTMLElement).closest("[data-effect-track]")
                          if (track) {
                            beginEffectDrag(e, clip.id, startSec, endSec, "move", track as HTMLElement)
                          }
                        }}
                        onClick={(event) => {
                          event.stopPropagation()
                          onSelectEffectClipId?.(clip.id)
                          onSeek(startSec)
                        }}
                      >
                        <StorySfxWaveform
                          audioUrl={clip.src}
                          sourceOffsetSec={clip.sourceOffsetSec}
                          durationSec={clip.durationSec}
                          width={Math.max(20, clipDur * pxPerSec)}
                          selected={selected}
                        />
                        <span className="relative z-10 block truncate px-1 font-semibold">
                          {clip.label}
                        </span>
                      </button>
                      <div
                        className="z-20 w-2 shrink-0 cursor-ew-resize bg-black/15 hover:bg-black/30"
                        style={{ width: HANDLE_W }}
                        onPointerDown={(e) => {
                          const track = (e.currentTarget as HTMLElement).closest("[data-effect-track]")
                          if (track) {
                            beginEffectDrag(e, clip.id, startSec, endSec, "end", track as HTMLElement)
                          }
                        }}
                      />
                    </div>
                  )
                })
              ) : (
                <span className="absolute inset-0 flex items-center px-2 text-[10px] text-slate-600">
                  오디오 탭에서 스토리 효과음을 추가하거나 AI 자동배치를 실행하세요
                </span>
              )}
            </div>
          </div>

          <div className={cn("flex", trackRowBorder)} style={{ height: 44 }}>
            <div
              className={cn(trackLabelCls, fillHeight ? "text-sky-700" : "text-sky-400/90")}
              style={{ width: TRACK_LABEL_W }}
            >
              배경음
            </div>
            <div
              data-bgm-track
              className={trackBodyCls}
              onClick={(e) => {
                if (draggingClipId) return
                onSeek(timeFromClientX(e.clientX, e.currentTarget))
              }}
              role="presentation"
            >
              {bgmClips.length ? (
                bgmClips.map((clip) => {
                  const selected = selectedBgmClipId === clip.id
                  const span = Math.max(0.05, clip.endSec - clip.startSec)
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
                <span className="absolute inset-0 flex items-center px-2 text-[10px] text-slate-500">
                  배경음악 없음 (TTS·효과음만 사용)
                </span>
              )}
            </div>
          </div>

          <div className={cn("flex", trackRowBorder)} style={{ height: 44 }}>
            <div
              className={cn(trackLabelCls, "font-semibold", fillHeight ? "text-cyan-700" : "text-cyan-300")}
              style={{ width: TRACK_LABEL_W }}
            >
              모자이크
            </div>
            <div
              data-mosaic-track
              className={trackBodyCls}
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
                  const span = Math.max(0.05, clip.endSec - clip.startSec)
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
                  AI·수동 모자이크 추가 시 구간 클립 표시 · 핸들로 시간 조절 · Delete 삭제
                </span>
              )}
            </div>
          </div>

          <div className="flex" style={{ height: 52 }}>
            <div
              className={cn(trackLabelCls, fillHeight ? "text-amber-700" : "text-amber-400/90")}
              style={{ width: TRACK_LABEL_W }}
            >
              자막
            </div>
            <div
              className={trackBodyCls}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

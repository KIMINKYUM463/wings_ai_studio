"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { Magnet, Scissors, Square, Undo2, ZoomIn, ZoomOut } from "lucide-react"
import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import { isEditPlanBlank } from "@/lib/mvp-edit-plan-split"
import { isMvpInsertClipDragEvent } from "@/lib/mvp-insert-clip-drag"
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
  /** 선택 영상 컷을 빨간바 위치에서 자르기 */
  onSplitSelectedVideoClip?: () => void
  /** 선택 컷 → 공백 */
  onBlankSelectedVideoClip?: () => void
  /** 선택 컷 → 삭제 */
  onDeleteSelectedVideoClip?: () => void
  /** 영상 컷 순서 변경 (드래그 이동). TTS는 유지 */
  onReorderEditPlanClip?: (fromIndex: number, toIndex: number) => void
  /**
   * 추가 영상 팝업에서 드래그 드롭.
   * replaceCutIndex: 공백 채우기 / afterCutIndex: 그 컷 뒤에 삽입 (-1=맨 앞)
   */
  onInsertClipDrop?: (args: {
    afterCutIndex: number
    replaceCutIndex?: number | null
  }) => void
  insertClipDropEnabled?: boolean
  /** 팝업 편집기처럼 부모 높이를 가득 채울 때 */
  fillHeight?: boolean
  /** 타임라인 가로 줌 초기값 (모바일은 더 작게) */
  initialPxPerSec?: number
  /** 각 컷의 대표 썸네일 (영상 트랙 필름스트립 표시용) */
  clipThumbnails?: Record<number, string>
  /** 나레이션 오디오 URL (소리 트랙 파형 표시용) */
  audioUrl?: string | null
  /** 상단 고정 문구 요약 (문구 트랙 표시용) */
  headcopySummary?: string
  /** 마지막 CTA 유도 문구 요약 */
  ctaSummary?: string
  /** 되돌리기 (Ctrl+Z) */
  onTimelineUndo?: () => void
  /** 문구 트랙 클릭 시 상단 글자 추가 탭으로 이동 */
  onClickCopyTrack?: () => void
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

type VideoReorderDragState = {
  fromIndex: number
  trackEl: HTMLElement
  originStart: number
  originEnd: number
  pointerX0: number
  moved: boolean
  targetIndex: number
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
  onSplitSelectedVideoClip,
  onBlankSelectedVideoClip,
  onDeleteSelectedVideoClip,
  onReorderEditPlanClip,
  onInsertClipDrop,
  insertClipDropEnabled = false,
  fillHeight = false,
  initialPxPerSec = 72,
  clipThumbnails = {},
  headcopySummary = "",
  ctaSummary = "",
  onTimelineUndo,
  onClickCopyTrack,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const timelinePanelRef = useRef<HTMLDivElement>(null)
  const timelineContentRef = useRef<HTMLDivElement>(null)
  const playheadDraggingRef = useRef(false)
  const dragRef = useRef<DragState | null>(null)
  const mosaicDragRef = useRef<MosaicDragState | null>(null)
  const effectDragRef = useRef<EffectDragState | null>(null)
  const videoReorderDragRef = useRef<VideoReorderDragState | null>(null)
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null)
  const [draggingMosaicId, setDraggingMosaicId] = useState<string | null>(null)
  const [draggingEffectId, setDraggingEffectId] = useState<string | null>(null)
  const [videoDragPreview, setVideoDragPreview] = useState<{
    fromIndex: number
    leftSec: number
    widthSec: number
    targetIndex: number
  } | null>(null)
  const [insertDropMarkerSec, setInsertDropMarkerSec] = useState<number | null>(null)
  const [insertDropBlankIndex, setInsertDropBlankIndex] = useState<number | null>(null)
  const [pxPerSec, setPxPerSec] = useState(initialPxPerSec)
  const pxPerSecRef = useRef(pxPerSec)
  pxPerSecRef.current = pxPerSec

  useEffect(() => {
    setPxPerSec(initialPxPerSec)
  }, [initialPxPerSec])

  // Ctrl+B — 선택 영상 컷 자르기
  useEffect(() => {
    if (!onSplitSelectedVideoClip) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "b") return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return
      }
      if (selectedEditPlanIndex == null) return
      e.preventDefault()
      onSplitSelectedVideoClip()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onSplitSelectedVideoClip, selectedEditPlanIndex])

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

  /**
   * 영상 트랙
   * - TTS 전: 영상 출력 시간 그대로
   * - TTS 후: 컷별 TTS 구간에 맞춰 배치·길이 표시 (음성이 짧으면 잘린 것처럼 보임)
   * - TTS 없는 컷(자르기 뒤쪽 등): 직전 끝 뒤에 이어 붙임
   */
  const videoTrackClips = useMemo(() => {
    if (!useAudioAxis || !cues.length) {
      return plan.map((seg, i) => ({
        index: i,
        seg,
        startSec: seg.output_start,
        endSec: seg.output_end,
      }))
    }

    let cursor = 0
    return plan.map((seg, i) => {
      const ar = audioRangeForSceneIndex(i, cues)
      if (ar && ar.endSec > ar.startSec + 0.02) {
        cursor = Math.max(cursor, ar.endSec)
        return {
          index: i,
          seg,
          startSec: ar.startSec,
          endSec: ar.endSec,
        }
      }
      // TTS 없는 컷 — 타임라인을 늘리지 않고 최소 폭만 (본편은 TTS에 맞춤)
      const startSec = cursor
      const endSec = startSec + 0.05
      cursor = endSec
      return { index: i, seg, startSec, endSec }
    })
  }, [plan, useAudioAxis, cues])

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

  /** 드롭 시각 → 삽입 위치(컷 뒤) 또는 공백 채우기 */
  const resolveInsertDropAtTime = useCallback(
    (t: number): { afterCutIndex: number; replaceCutIndex?: number | null; markerSec: number } => {
      if (!videoTrackClips.length) {
        return { afterCutIndex: -1, markerSec: 0 }
      }
      for (const clip of videoTrackClips) {
        if (t < clip.startSec - 0.001) {
          return {
            afterCutIndex: clip.index - 1,
            markerSec: clip.startSec,
          }
        }
        if (t >= clip.startSec && t < clip.endSec - 0.001) {
          if (isEditPlanBlank(clip.seg)) {
            return {
              afterCutIndex: clip.index - 1,
              replaceCutIndex: clip.index,
              markerSec: clip.startSec,
            }
          }
          const mid = (clip.startSec + clip.endSec) / 2
          if (t < mid) {
            return { afterCutIndex: clip.index - 1, markerSec: clip.startSec }
          }
          return { afterCutIndex: clip.index, markerSec: clip.endSec }
        }
      }
      const last = videoTrackClips[videoTrackClips.length - 1]!
      return { afterCutIndex: last.index, markerSec: last.endSec }
    },
    [videoTrackClips]
  )

  const clearInsertDropUi = useCallback(() => {
    setInsertDropMarkerSec(null)
    setInsertDropBlankIndex(null)
  }, [])

  const handleVideoTrackDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!insertClipDropEnabled || !onInsertClipDrop) return
      if (!isMvpInsertClipDragEvent(e.dataTransfer)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
      const t = timeFromClientX(e.clientX, e.currentTarget)
      const resolved = resolveInsertDropAtTime(t)
      setInsertDropMarkerSec(resolved.markerSec)
      setInsertDropBlankIndex(
        resolved.replaceCutIndex != null ? resolved.replaceCutIndex : null
      )
    },
    [
      insertClipDropEnabled,
      onInsertClipDrop,
      timeFromClientX,
      resolveInsertDropAtTime,
    ]
  )

  const handleVideoTrackDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!insertClipDropEnabled || !onInsertClipDrop) return
      if (!isMvpInsertClipDragEvent(e.dataTransfer)) return
      e.preventDefault()
      e.stopPropagation()
      const t = timeFromClientX(e.clientX, e.currentTarget)
      const resolved = resolveInsertDropAtTime(t)
      clearInsertDropUi()
      onInsertClipDrop({
        afterCutIndex: resolved.afterCutIndex,
        replaceCutIndex: resolved.replaceCutIndex ?? null,
      })
    },
    [
      insertClipDropEnabled,
      onInsertClipDrop,
      timeFromClientX,
      resolveInsertDropAtTime,
      clearInsertDropUi,
    ]
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
    const resolveVideoReorderTarget = (
      fromIndex: number,
      floatingCenterSec: number
    ): number => {
      const others = videoTrackClips.filter((c) => c.index !== fromIndex)
      let target = 0
      for (const c of others) {
        const mid = (c.startSec + c.endSec) / 2
        if (floatingCenterSec > mid) target += 1
        else break
      }
      return Math.max(0, Math.min(Math.max(0, videoTrackClips.length - 1), target))
    }

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

      const vDrag = videoReorderDragRef.current
      if (vDrag && onReorderEditPlanClip) {
        const rect = vDrag.trackEl.getBoundingClientRect()
        const dt = ((e.clientX - vDrag.pointerX0) / Math.max(1, rect.width)) * duration
        if (Math.abs(e.clientX - vDrag.pointerX0) > 4) vDrag.moved = true
        const span = Math.max(0.05, vDrag.originEnd - vDrag.originStart)
        let left = vDrag.originStart + dt
        left = Math.max(0, Math.min(duration - span, left))
        const center = left + span / 2
        const targetIndex = resolveVideoReorderTarget(vDrag.fromIndex, center)
        vDrag.targetIndex = targetIndex
        setVideoDragPreview({
          fromIndex: vDrag.fromIndex,
          leftSec: left,
          widthSec: span,
          targetIndex,
        })
      }
    }
    const onUp = () => {
      const vDrag = videoReorderDragRef.current
      if (vDrag && onReorderEditPlanClip && vDrag.moved) {
        if (vDrag.targetIndex !== vDrag.fromIndex) {
          onReorderEditPlanClip(vDrag.fromIndex, vDrag.targetIndex)
        }
      }
      dragRef.current = null
      mosaicDragRef.current = null
      effectDragRef.current = null
      videoReorderDragRef.current = null
      setDraggingClipId(null)
      setDraggingMosaicId(null)
      setDraggingEffectId(null)
      setVideoDragPreview(null)
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
    onReorderEditPlanClip,
    patchClip,
    patchMosaicClip,
    patchEffectClip,
    duration,
    videoTrackClips,
  ])

  const beginVideoReorderDrag = (
    e: React.PointerEvent,
    fromIndex: number,
    startSec: number,
    endSec: number,
    trackEl: HTMLElement
  ) => {
    if (!onReorderEditPlanClip) return
    e.preventDefault()
    e.stopPropagation()
    onSelectEditPlanIndex?.(fromIndex)
    videoReorderDragRef.current = {
      fromIndex,
      trackEl,
      originStart: startSec,
      originEnd: endSec,
      pointerX0: e.clientX,
      moved: false,
      targetIndex: fromIndex,
    }
    setVideoDragPreview({
      fromIndex,
      leftSec: startSec,
      widthSec: Math.max(0.05, endSec - startSec),
      targetIndex: fromIndex,
    })
  }

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

  const nudgeSelectedCue = (edge: "start" | "end", delta: number) => {
    if (selectedCueIndex < 0 || !cues[selectedCueIndex]) {
      onSeek(Math.max(0, Math.min(duration, headSec + delta)))
      return
    }
    const cur = cues[selectedCueIndex]!
    onSeek(Math.max(0, Math.min(duration, (edge === "start" ? cur.startSec : cur.endSec) + delta)))
  }

  // sticky left — 확대·축소·좌우 스크롤해도 트랙 이름은 왼쪽에 고정
  const trackLabelCls =
    "sticky left-0 z-30 flex shrink-0 items-center justify-center border-r border-slate-200/80 bg-[#f8f9fc] px-1.5 text-[10px] font-semibold text-slate-500"
  const trackBodyCls = "relative flex-1 cursor-pointer bg-white"
  const trackRowBorder = "border-b border-slate-100"
  const rulerGutterCls =
    "sticky left-0 z-30 shrink-0 border-r border-slate-200/80 bg-[#f8f9fc]"

  return (
    <div
      ref={timelinePanelRef}
      className={cn(
        "rounded-xl border border-slate-200/90 bg-white shadow-[0_-1px_4px_rgba(15,23,42,0.03)]",
        fillHeight ? "flex h-full min-h-0 flex-col" : ""
      )}
    >
      {/* 타임라인 상단 툴바 */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={!onTimelineUndo}
            onClick={() => onTimelineUndo?.()}
            title="되돌리기 (Ctrl+Z)"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-35"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>

          <span
            title="장면 경계 자동 자석 스냅 켜짐"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#7c3aed] text-white shadow-sm"
          >
            <Magnet className="h-3.5 w-3.5" />
          </span>

          {onSplitSelectedVideoClip ? (
            <button
              type="button"
              disabled={selectedEditPlanIndex == null}
              title="선택한 영상 컷을 재생바 위치에서 자르기 (Ctrl+B)"
              onClick={() => onSplitSelectedVideoClip()}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Scissors className="h-3.5 w-3.5" />
            </button>
          ) : null}

          {onDeleteSelectedVideoClip || onBlankSelectedVideoClip ? (
            <button
              type="button"
              disabled={selectedEditPlanIndex == null}
              title="선택한 컷을 공백으로 비우기 (Delete)"
              onClick={() => {
                if (onDeleteSelectedVideoClip) onDeleteSelectedVideoClip()
                else onBlankSelectedVideoClip?.()
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : null}

          <div className="mx-1 h-4 w-px bg-slate-200" />

          <button
            type="button"
            title="타임라인 축소"
            onClick={() => setPxPerSec((p) => Math.max(28, Math.round(p * 0.8)))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="타임라인 확대"
            onClick={() => setPxPerSec((p) => Math.min(220, Math.round(p * 1.25)))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>

          <p className="ml-2 hidden text-[11px] text-slate-500 xl:block">
            주황 = 상단·CTA 문구, 보라 = 자막·목소리 ·{" "}
            <strong className="font-semibold text-slate-700">구간 끝을 마우스로 끌면</strong> 늘리거나 줄일 수 있어요.
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => nudgeSelectedCue("start", -0.1)}
            className="hidden h-7 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-100 sm:inline-flex"
          >
            ◀ 시작
          </button>
          <button
            type="button"
            onClick={() => nudgeSelectedCue("start", 0.1)}
            className="hidden h-7 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-100 sm:inline-flex"
          >
            시작 ▶
          </button>
          <button
            type="button"
            onClick={() => nudgeSelectedCue("end", -0.1)}
            className="hidden h-7 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-100 md:inline-flex"
          >
            ◀ 끝
          </button>
          <button
            type="button"
            onClick={() => nudgeSelectedCue("end", 0.1)}
            className="hidden h-7 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-100 md:inline-flex"
          >
            끝 ▶
          </button>
          {onDeleteSelectedVideoClip ? (
            <button
              type="button"
              disabled={selectedEditPlanIndex == null}
              onClick={() => onDeleteSelectedVideoClip()}
              className="inline-flex h-7 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
            >
              빼기
            </button>
          ) : null}
          <span className="ml-1.5 font-mono text-[11px] font-medium tabular-nums text-slate-500">
            {formatNarrationClock(headSec)} / {formatNarrationClock(duration)}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "overflow-x-auto overflow-y-auto overscroll-contain bg-white",
          fillHeight ? "min-h-0 flex-1" : "max-h-[320px]"
        )}
      >
        <div
          ref={timelineContentRef}
          className="relative"
          style={{ width: timelineWidth + TRACK_LABEL_W + 24 }}
        >
          {/* 세로 재생 헤드 (진한 네이비/보라 바) */}
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-40 w-[2px] bg-[#1e1b4b] shadow-[0_0_6px_rgba(109,40,217,0.45)]"
            style={{ left: playheadLeft }}
          >
            <button
              type="button"
              aria-label="재생 위치 이동"
              className="pointer-events-auto absolute -left-[6px] top-0 h-3.5 w-3.5 cursor-ew-resize rounded-full border-2 border-white bg-[#6d28d9] p-0 shadow-md"
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

          {/* 시간 눈금자 */}
          <div className="relative flex border-b border-slate-200/80 bg-[#fbfcfe]" style={{ height: 26 }}>
            <div className={rulerGutterCls} style={{ width: TRACK_LABEL_W }} aria-hidden />
            <div
              className="relative h-full flex-1 cursor-pointer"
              onClick={(e) => seekFromClientX(e.clientX, e.currentTarget)}
              role="presentation"
            >
              {rulerMarks.map((t) => (
                <span
                  key={t}
                  className="absolute top-0 flex h-full -translate-x-1/2 flex-col items-center text-[9px] font-medium tabular-nums text-slate-400"
                  style={{ left: `${(t / duration) * 100}%` }}
                >
                  <span className="mt-1">{formatNarrationClock(t)}</span>
                  <span className="mt-auto h-1.5 w-px bg-slate-200" />
                </span>
              ))}
            </div>
          </div>

          {/* 1. 그래픽 (모자이크 · 오버레이) */}
          <div className={cn("flex", trackRowBorder)} style={{ height: 32 }}>
            <div className={trackLabelCls} style={{ width: TRACK_LABEL_W }}>
              그래픽
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
                        "absolute top-1 flex h-6 overflow-hidden rounded-md border text-[9px] font-semibold leading-tight",
                        selected || active
                          ? "z-10 border-cyan-500 bg-cyan-500 text-white ring-2 ring-cyan-300/50"
                          : "border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                      )}
                      style={{
                        left: pct(clip.startSec),
                        width: `max(12px, calc(${pct(span)} - 2px))`,
                      }}
                      title={`${clip.label} · ${formatNarrationClock(clip.startSec)}–${formatNarrationClock(clip.endSec)}`}
                    >
                      <div
                        className="z-20 shrink-0 cursor-ew-resize bg-black/10 hover:bg-black/25"
                        style={{ width: HANDLE_W }}
                        onPointerDown={(e) => {
                          const track = (e.currentTarget as HTMLElement).closest("[data-mosaic-track]")
                          if (track) beginMosaicDrag(e, clip, "start", track as HTMLElement)
                        }}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 cursor-grab truncate px-1 text-left active:cursor-grabbing"
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
                        className="z-20 shrink-0 cursor-ew-resize bg-black/10 hover:bg-black/25"
                        style={{ width: HANDLE_W }}
                        onPointerDown={(e) => {
                          const track = (e.currentTarget as HTMLElement).closest("[data-mosaic-track]")
                          if (track) beginMosaicDrag(e, clip, "end", track as HTMLElement)
                        }}
                      />
                    </div>
                  )
                })
              ) : null}
            </div>
          </div>

          {/* 2. 자막 (T 보라색 블록) */}
          <div className={cn("flex", trackRowBorder)} style={{ height: 36 }}>
            <div className={trackLabelCls} style={{ width: TRACK_LABEL_W }}>
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
                        "absolute top-1.5 flex h-6 items-center gap-1 overflow-hidden rounded-md border px-1.5 text-left text-[10px] font-semibold leading-none transition",
                        c.draft
                          ? selected
                            ? "z-10 border-violet-500 bg-violet-500 text-white"
                            : "border-violet-200 bg-violet-100 text-violet-800 hover:bg-violet-200"
                          : selected
                            ? "z-10 border-[#5b21b6] bg-[#5b21b6] text-white ring-2 ring-violet-300"
                            : "border-[#6d28d9] bg-[#6d28d9] text-white hover:bg-[#5b21b6]"
                      )}
                      style={{
                        left: pct(c.startSec),
                        width: `max(14px, calc(${pct(c.endSec - c.startSec)} - 2px))`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectCue(i)
                        onSeek(c.startSec)
                      }}
                    >
                      <span className="shrink-0 font-bold opacity-80">T</span>
                      <span className="truncate">{c.text.replace(/\s+/g, " ")}</span>
                    </button>
                  )
                })
              ) : (
                <span className="absolute inset-0 flex items-center px-2 text-[10px] text-slate-400">
                  자막 구간 표시
                </span>
              )}
            </div>
          </div>

          {/* 3. 영상 (연속 썸네일 필름스트립 + 원형 번호 배지) */}
          <div className={cn("flex", trackRowBorder)} style={{ height: 54 }}>
            <div className={trackLabelCls} style={{ width: TRACK_LABEL_W }}>
              영상
            </div>
            <div
              data-video-track
              className={cn(
                trackBodyCls,
                insertClipDropEnabled &&
                  insertDropMarkerSec != null &&
                  "ring-1 ring-inset ring-violet-400/80"
              )}
              onClick={(e) => seekFromClientX(e.clientX, e.currentTarget)}
              onDragOver={handleVideoTrackDragOver}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  clearInsertDropUi()
                }
              }}
              onDrop={handleVideoTrackDrop}
              role="presentation"
            >
              {thumbnailUrl ? (
                <button
                  type="button"
                  title="쇼츠 첫 프레임 썸네일 (0~0.3초)"
                  className="absolute top-1.5 z-20 h-10 w-2 min-w-[6px] rounded-sm border border-amber-500 bg-amber-400 hover:bg-amber-300"
                  style={{ left: 0 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSeek(0)
                  }}
                />
              ) : null}
              {videoTrackClips.map(({ index: i, seg, startSec, endSec }) => {
                const selected = selectedEditPlanIndex === i
                const blank = isEditPlanBlank(seg)
                const label = blank ? "공백" : videoSourceLabel(result, seg.video_id)
                const dropTarget = insertDropBlankIndex === i
                const isDragging = videoDragPreview?.fromIndex === i
                const insertBefore =
                  videoDragPreview != null &&
                  videoDragPreview.fromIndex !== i &&
                  videoDragPreview.targetIndex === i
                const thumb = clipThumbnails[i]
                const clipPxW = Math.max(24, (endSec - startSec) * pxPerSec)
                const tileCount = Math.max(1, Math.min(12, Math.ceil(clipPxW / 38)))

                return (
                  <button
                    key={`v-${i}`}
                    type="button"
                    title={
                      blank
                        ? `장면 ${i + 1} · 공백 · 드래그로 이동`
                        : `장면 ${i + 1} · ${label} · 드래그로 좌우 이동`
                    }
                    className={cn(
                      "absolute top-1.5 h-10 overflow-hidden rounded-md border text-left transition",
                      onReorderEditPlanClip ? "cursor-grab active:cursor-grabbing" : "",
                      isDragging && "opacity-35",
                      insertBefore && "ring-2 ring-amber-400",
                      dropTarget
                        ? "z-20 border-violet-500 bg-violet-100 ring-2 ring-violet-400"
                        : blank
                          ? selected
                            ? "z-10 border-slate-500 bg-slate-200 ring-2 ring-slate-400/50"
                            : "border-slate-300 bg-slate-100 hover:bg-slate-200/80"
                          : selected
                            ? "z-10 border-[#7c3aed] ring-2 ring-[#7c3aed]/45"
                            : "border-slate-300/90 hover:border-violet-400"
                    )}
                    style={{
                      left: pct(startSec),
                      width: `calc(${pct(Math.max(0.01, endSec - startSec))} - 2px)`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (videoReorderDragRef.current?.moved) return
                      onSelectEditPlanIndex?.(i)
                      seekFromTimelineContentX(e.clientX)
                    }}
                    onPointerDown={(e) => {
                      if (!onReorderEditPlanClip || e.button !== 0) return
                      const track = e.currentTarget.parentElement
                      if (!track) return
                      beginVideoReorderDrag(e, i, startSec, endSec, track)
                    }}
                  >
                    {!blank && thumb ? (
                      <div
                        className="grid h-full w-full bg-slate-900"
                        style={{ gridTemplateColumns: `repeat(${tileCount}, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: tileCount }).map((_, ti) => (
                          <img
                            key={ti}
                            src={thumb}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center bg-slate-100 px-6 text-[10px] font-medium text-slate-500">
                        <span className="truncate">{label}</span>
                      </div>
                    )}

                    <span
                      className={cn(
                        "absolute left-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white shadow",
                        selected ? "bg-[#6d28d9]" : "bg-slate-900/80"
                      )}
                    >
                      {i + 1}
                    </span>
                  </button>
                )
              })}
              {videoDragPreview ? (
                <div
                  className="pointer-events-none absolute top-1.5 z-30 h-10 rounded-md border-2 border-dashed border-violet-500 bg-violet-400/25"
                  style={{
                    left: pct(videoDragPreview.leftSec),
                    width: pct(Math.max(0.01, videoDragPreview.widthSec)),
                  }}
                />
              ) : null}
              {insertDropMarkerSec != null && insertDropBlankIndex == null ? (
                <div
                  className="pointer-events-none absolute top-0 z-30 h-full w-0.5 bg-violet-500"
                  style={{ left: pct(insertDropMarkerSec) }}
                  title="여기에 삽입"
                />
              ) : null}
            </div>
          </div>

          {/* 4. 소리 (보라색 나레이션 파형) */}
          <div className={cn("flex", trackRowBorder)} style={{ height: 38 }}>
            <div className={trackLabelCls} style={{ width: TRACK_LABEL_W }}>
              소리
            </div>
            <div
              className={trackBodyCls}
              onClick={(e) => seekFromClientX(e.clientX, e.currentTarget)}
              role="presentation"
            >
              {hasAudio && ttsBlocks.length ? (
                ttsBlocks.map((b, bi) => {
                  const span = Math.max(0.05, b.endSec - b.startSec)
                  const barCount = Math.max(6, Math.min(48, Math.round(span * pxPerSec * 0.28)))
                  return (
                    <div
                      key={b.key}
                      className="absolute inset-y-1 flex items-center justify-between gap-[1.5px] overflow-hidden rounded bg-violet-50/70 px-1"
                      style={{
                        left: pct(b.startSec),
                        width: `calc(${pct(span)} - 2px)`,
                      }}
                      title={`목소리 ${bi + 1} · ${formatNarrationClock(b.startSec)}–${formatNarrationClock(b.endSec)}`}
                    >
                      {Array.from({ length: barCount }).map((_, k) => {
                        // 문장 내 자연스러운 발화 엔벨로프 파형
                        const phase = ((bi + 1) * 13 + k * 7) % 19
                        const edgeFade =
                          k === 0 || k === barCount - 1 ? 0.35 : k === 1 || k === barCount - 2 ? 0.65 : 1
                        const hPct = Math.round((28 + (phase / 18) * 66) * edgeFade)
                        return (
                          <span
                            key={k}
                            className="w-[2px] shrink-0 rounded-full bg-[#7c3aed]/80"
                            style={{ height: `${Math.max(18, hPct)}%` }}
                          />
                        )
                      })}
                    </div>
                  )
                })
              ) : hasAudio ? (
                <div
                  className="absolute inset-y-1.5 rounded bg-violet-100"
                  style={{
                    left: "0%",
                    width: pct(Math.min(duration, audioDurationSec || duration)),
                  }}
                />
              ) : (
                <span className="absolute inset-0 flex items-center px-2 text-[10px] text-slate-400">
                  목소리 파형 표시
                </span>
              )}
            </div>
          </div>

          {/* 5. 효과음 · 배경음 */}
          <div className={cn("flex", trackRowBorder)} style={{ height: 36 }}>
            <div className={trackLabelCls} style={{ width: TRACK_LABEL_W }}>
              효과음
            </div>
            <div
              data-effect-track
              data-bgm-track
              className={trackBodyCls}
              onClick={(event) => {
                if (draggingEffectId || draggingClipId) return
                seekFromClientX(event.clientX, event.currentTarget)
              }}
              role="presentation"
            >
              {bgmClips.map((clip) => {
                const selected = selectedBgmClipId === clip.id
                const span = Math.max(0.05, clip.endSec - clip.startSec)
                return (
                  <div
                    key={clip.id}
                    className={cn(
                      "absolute bottom-1 flex h-4 overflow-hidden rounded border text-[8px] leading-none",
                      selected
                        ? "z-10 border-sky-500 bg-sky-500/85 text-white"
                        : "border-sky-200 bg-sky-50/90 text-sky-700 hover:bg-sky-100"
                    )}
                    style={{
                      left: pct(clip.startSec),
                      width: `max(12px, calc(${pct(span)} - 2px))`,
                    }}
                    title={`배경음: ${clip.label}`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 cursor-grab truncate px-1 text-left active:cursor-grabbing"
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
                      ♪ {clip.label}
                    </button>
                  </div>
                )
              })}

              {effectTrackClips.map(({ clip, startSec, durationSec: clipDur }) => {
                const selected = selectedEffectClipId === clip.id
                const endSec = startSec + clipDur
                return (
                  <div
                    key={clip.id}
                    className={cn(
                      "absolute top-1 flex h-6 min-w-[10px] overflow-hidden rounded-md border text-left text-[8px]",
                      selected
                        ? "z-20 border-violet-500 bg-violet-500 text-white ring-1 ring-violet-300"
                        : "border-violet-300 bg-violet-100 text-violet-900 hover:bg-violet-200",
                      draggingEffectId === clip.id && "opacity-95"
                    )}
                    style={{
                      left: pct(startSec),
                      width: `max(12px, calc(${pct(clipDur)} - 2px))`,
                    }}
                    title={`${clip.label} · ${formatNarrationClock(startSec)}–${formatNarrationClock(endSec)}`}
                  >
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
                  </div>
                )
              })}
            </div>
          </div>

          {/* 6. 문구 (주황색 상단 고정 문구 + 우측 끝 CTA 유도 바) */}
          <div className="flex" style={{ height: 34 }}>
            <div className={trackLabelCls} style={{ width: TRACK_LABEL_W }}>
              문구
            </div>
            <div
              className={trackBodyCls}
              onClick={() => onClickCopyTrack?.()}
              role="presentation"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClickCopyTrack?.()
                }}
                title="클릭하여 상단 문구 수정"
                className="absolute top-1.5 flex h-6 items-center gap-1.5 overflow-hidden rounded-l-md bg-[#ea580c] px-2.5 text-left text-[10px] font-bold text-white shadow-sm transition hover:bg-[#c2410c]"
                style={{
                  left: "0%",
                  width: duration > 4 ? pct(Math.max(1, duration - 3.2)) : "78%",
                }}
              >
                <span className="inline-block h-2 w-2 shrink-0 rounded-xs bg-white/90" />
                <span className="truncate">
                  상단 · {headcopySummary.trim() || "상단 고정 제목 문구 (클릭해 편집)"}
                </span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClickCopyTrack?.()
                }}
                title="클릭하여 마무리 CTA 문구 확인"
                className="absolute top-1.5 flex h-6 items-center gap-1 overflow-hidden rounded-r-md bg-[#b45309] px-2 text-left text-[10px] font-bold text-amber-50 shadow-sm transition hover:bg-[#92400e]"
                style={{
                  left: duration > 4 ? pct(Math.max(1, duration - 3.15)) : "78.5%",
                  width: duration > 4 ? `calc(${pct(Math.min(duration, 3.15))} - 2px)` : "21%",
                }}
              >
                <span className="truncate">
                  CTA · {ctaSummary.trim() || "댓글·구매 유도"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

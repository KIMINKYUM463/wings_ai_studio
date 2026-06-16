"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Loader2, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { createOverlayFromCatalog, MVP_OVERLAY_COLOR_PRESETS } from "@/lib/mvp-overlay-utils"
import {
  isMosaicOverlay,
  mosaicOverlayBlockSize,
  mosaicOverlayDimensions,
  STUDIO_OVERLAY_CATALOG,
  STUDIO_OVERLAY_CATEGORIES,
  type PlacedStudioOverlay,
  type StudioOverlayCategory,
} from "@/lib/shotform-studio-overlay-catalog"
import { mosaicOverlaySummary } from "@/lib/mvp-mosaic-overlay-utils"
import {
  buildMosaicBoundaryTimes,
  buildMosaicRefineTimes,
  captureMosaicFramesAtTimes,
  captureMosaicScanFramesFromVideo,
  effectiveMosaicCaptureDuration,
  MOSAIC_BOUNDARY_CAPTURE_WIDTH,
} from "@/lib/mvp-mosaic-frame-capture"
import {
  buildMosaicTracks,
  mergeMosaicRowsToOverlays,
  tracksToWindows,
  type MosaicFrameDetectRow,
} from "@/lib/mvp-mosaic-merge"
import { readFetchJson } from "@/lib/mvp-fetch-json"
import { formatNarrationClock } from "@/lib/shotform-factory-narration-script"
import { studio } from "../components/ShotFormStudioUI"
import { StudioOverlayCatalogThumb, StudioOverlayGraphic } from "../shoppingshotform/StudioOverlayGraphic"

function shotformOpenAIKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_openai_api_key") || "").trim()
}

type Props = {
  overlays: PlacedStudioOverlay[]
  selectedId: string | null
  onOverlaysChange: (next: PlacedStudioOverlay[]) => void
  onSelectId: (id: string | null) => void
  videoRef?: React.RefObject<HTMLVideoElement | null>
  videoDurationSec?: number
  playheadSec?: number
  onSeek?: (sec: number) => void
}

export function MvpOverlayElementsPanel({
  overlays,
  selectedId,
  onOverlaysChange,
  onSelectId,
  videoRef,
  videoDurationSec = 0,
  playheadSec = 0,
  onSeek,
}: Props) {
  const [overlayCategory, setOverlayCategory] = useState<StudioOverlayCategory>("effects")
  const [overlayPickColor, setOverlayPickColor] = useState("#ffffff")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState("")
  const [aiErr, setAiErr] = useState<string | null>(null)
  const overlayIdRef = useRef(0)

  const filteredCatalog = useMemo(
    () => STUDIO_OVERLAY_CATALOG.filter((e) => e.category === overlayCategory),
    [overlayCategory]
  )

  const selectedOverlay = useMemo(
    () => overlays.find((o) => o.id === selectedId) ?? null,
    [overlays, selectedId]
  )

  const mosaicOverlays = useMemo(() => overlays.filter((o) => isMosaicOverlay(o.catalogId)), [overlays])

  const updateOverlayById = useCallback(
    (id: string, patch: Partial<PlacedStudioOverlay>) => {
      onOverlaysChange(overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)))
    },
    [onOverlaysChange, overlays]
  )

  const updateSelectedOverlay = useCallback(
    (patch: Partial<PlacedStudioOverlay>) => {
      if (!selectedId) return
      updateOverlayById(selectedId, patch)
    },
    [selectedId, updateOverlayById]
  )

  const addOverlayFromCatalog = useCallback(
    (catalogId: string) => {
      const next = createOverlayFromCatalog(catalogId, overlays, overlayPickColor, overlayIdRef)
      const withTime = isMosaicOverlay(catalogId)
        ? {
            ...next,
            source: "manual" as const,
            startSec: Math.max(0, playheadSec),
            endSec: Math.min(videoDurationSec || playheadSec + 2.5, Math.max(playheadSec + 0.35, playheadSec + 2.5)),
          }
        : { ...next, source: "manual" as const }
      onOverlaysChange([...overlays, withTime])
      onSelectId(next.id)
    },
    [overlayPickColor, onOverlaysChange, onSelectId, overlays, playheadSec, videoDurationSec]
  )

  const removeSelectedOverlay = useCallback(() => {
    if (!selectedId) return
    onOverlaysChange(overlays.filter((o) => o.id !== selectedId))
    onSelectId(null)
  }, [onOverlaysChange, onSelectId, overlays, selectedId])

  const setPlayheadAsStart = useCallback(() => {
    if (!selectedId) return
    updateSelectedOverlay({ startSec: Math.max(0, playheadSec) })
  }, [playheadSec, selectedId, updateSelectedOverlay])

  const setPlayheadAsEnd = useCallback(() => {
    if (!selectedId) return
    updateSelectedOverlay({ endSec: Math.max(0, playheadSec) })
  }, [playheadSec, selectedId, updateSelectedOverlay])

  const runAiMosaic = useCallback(async () => {
    const openai = shotformOpenAIKey()
    if (!openai) {
      setAiErr("ShotForm 설정에 OpenAI API 키(shotform_openai_api_key)를 저장해 주세요.")
      return
    }
    const video = videoRef?.current
    if (!video || !videoDurationSec) {
      setAiErr("짜집기 영상이 준비된 뒤 다시 시도해 주세요.")
      return
    }
    const captureDurationSec = effectiveMosaicCaptureDuration(video, videoDurationSec)
    if (captureDurationSec < 0.2) {
      setAiErr("영상 길이를 읽을 수 없습니다. 영상이 로드된 뒤 다시 시도해 주세요.")
      return
    }

    setAiLoading(true)
    setAiErr(null)
    setAiStatus("1차 스캔 · 프레임 캡처 중…")

    try {
      const mergeRows = (rows: MosaicFrameDetectRow[]) => {
        const byTime = new Map<number, MosaicFrameDetectRow>()
        for (const r of rows) byTime.set(Math.round(r.timeSec * 1000) / 1000, r)
        return [...byTime.values()].sort((a, b) => a.timeSec - b.timeSec)
      }

      const detectBatch = async (frames: { timeSec: number; imageBase64: string }[], label: string) => {
        const batchSize = 2
        const rows: MosaicFrameDetectRow[] = []
        for (let i = 0; i < frames.length; i += batchSize) {
          const batch = frames.slice(i, i + batchSize)
          const done = Math.min(i + batch.length, frames.length)
          setAiStatus(`${label} AI 분석 ${done}/${frames.length}장…`)

          const res = await fetch("/api/shotform/detect-chinese-mosaic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              openaiApiKey: openai,
              frames: batch,
              rowsOnly: true,
              highDetail: true,
            }),
          })
          const data = await readFetchJson<{ rows?: MosaicFrameDetectRow[]; error?: string }>(res)
          if (!res.ok) throw new Error(data.error || "AI 모자이크 감지 실패")
          if (data.rows?.length) rows.push(...data.rows)
        }
        return rows
      }

      const coarseFrames = await captureMosaicScanFramesFromVideo(video, captureDurationSec, {
        maxWidth: 640,
        onProgress: (done, total) => setAiStatus(`1차 캡처 ${done}/${total}…`),
      })

      const coarseRows = await detectBatch(coarseFrames, "1차")
      let allRows = mergeRows(coarseRows)
      const scannedTimes = allRows.map((r) => r.timeSec)

      const refineTimes = buildMosaicRefineTimes(allRows, captureDurationSec, {
        existingTimes: scannedTimes,
      })
      if (refineTimes.length) {
        setAiStatus(`2차 정밀 캡처 0/${refineTimes.length}…`)
        const refineFrames = await captureMosaicFramesAtTimes(video, refineTimes, {
          maxWidth: 768,
          onProgress: (done, total) => setAiStatus(`2차 정밀 캡처 ${done}/${total}…`),
        })
        const refineRows = await detectBatch(refineFrames, "2차")
        allRows = mergeRows([...allRows, ...refineRows])
      }

      const preliminaryTracks = buildMosaicTracks(allRows)
      if (preliminaryTracks.length) {
        const boundaryTimes = buildMosaicBoundaryTimes(
          tracksToWindows(preliminaryTracks),
          captureDurationSec,
          { existingTimes: allRows.map((r) => r.timeSec) }
        )
        if (boundaryTimes.length) {
          setAiStatus(`3차 경계 스캔 0/${boundaryTimes.length}…`)
          const boundaryFrames = await captureMosaicFramesAtTimes(video, boundaryTimes, {
            maxWidth: MOSAIC_BOUNDARY_CAPTURE_WIDTH,
            onProgress: (done, total) => setAiStatus(`3차 경계 스캔 ${done}/${total}…`),
          })
          const boundaryRows = await detectBatch(boundaryFrames, "3차")
          allRows = mergeRows([...allRows, ...boundaryRows])
        }
      }

      const detected = mergeMosaicRowsToOverlays(allRows, captureDurationSec).filter(
        (ov) =>
          Number.isFinite(ov.x) &&
          Number.isFinite(ov.y) &&
          Number.isFinite(ov.mosaicW) &&
          Number.isFinite(ov.mosaicH)
      )
      if (!detected.length) {
        setAiStatus("감지된 중국어 오버레이가 없습니다. 수동 모자이크를 추가해 보세요.")
        return
      }

      const nonMosaic = overlays.filter((o) => !isMosaicOverlay(o.catalogId))
      onOverlaysChange([...nonMosaic, ...detected])
      onSelectId(detected[0]?.id ?? null)
      setAiStatus(`AI 모자이크 ${detected.length}구간 적용됨. 위치·시간은 미리보기에서 조정할 수 있습니다.`)
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "AI 모자이크 실패")
      setAiStatus("")
    } finally {
      setAiLoading(false)
    }
  }, [onOverlaysChange, onSelectId, overlays, videoDurationSec, videoRef])

  const selectedMosaic = selectedOverlay && isMosaicOverlay(selectedOverlay.catalogId)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/25 to-transparent p-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-cyan-100">AI 중국어 모자이크</p>
            <p className="mt-1 text-[10px] leading-relaxed text-cyan-100/75">
              1차 전체 스캔 → 2차 위치 정밀 → 3차 등장·퇴장 경계 분석. 글자 크기·위치에 맞춘 타이트
              모자이크가 타임라인에 표시됩니다.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-3 h-9 w-full gap-2 border border-cyan-500/30 bg-cyan-500/10 text-xs text-cyan-100 hover:bg-cyan-500/20"
          disabled={aiLoading || !videoDurationSec}
          onClick={() => void runAiMosaic()}
        >
          {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {aiLoading ? "AI 분석 중…" : "AI 자동 모자이크"}
        </Button>
        {aiStatus ? <p className="mt-2 text-[10px] leading-relaxed text-cyan-100/90">{aiStatus}</p> : null}
        {aiErr ? <p className="mt-2 text-[10px] leading-relaxed text-red-300">{aiErr}</p> : null}
      </div>

      <div>
        <p className="text-xs font-medium text-white">수동 모자이크 · 도형</p>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
          「효과」에서 모자이크를 추가한 뒤 드래그·핸들로 크기를 맞추세요. 재생 헤드로 구간 시작·끝을 지정할 수
          있습니다.
        </p>
      </div>

      {mosaicOverlays.length > 0 ? (
        <div className="max-h-[140px] space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/25 p-2">
          {mosaicOverlays.map((ov) => (
            <button
              key={ov.id}
              type="button"
              className={cn(
                "w-full rounded border px-2 py-1.5 text-left text-[10px] transition",
                selectedId === ov.id
                  ? "border-violet-500/40 bg-violet-950/25 text-violet-100"
                  : "border-white/5 text-slate-400 hover:bg-white/5"
              )}
              onClick={() => {
                onSelectId(ov.id)
                if (ov.startSec != null) onSeek?.(ov.startSec)
              }}
            >
              <span className="font-mono text-cyan-400/80">
                {formatNarrationClock(ov.startSec ?? 0)}–{formatNarrationClock(ov.endSec ?? videoDurationSec)}
              </span>{" "}
              {ov.source === "ai" ? "AI" : "수동"} · {mosaicOverlaySummary(ov)}
              {ov.label ? ` · ${ov.label}` : ""}
            </button>
          ))}
        </div>
      ) : null}

      <div>
        <Label className="text-[10px] text-slate-400">추가할 색상 (도형·화살표)</Label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {MVP_OVERLAY_COLOR_PRESETS.map((c) => (
            <button
              key={`ov-${c}`}
              type="button"
              title={c}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform",
                overlayPickColor.toLowerCase() === c.toLowerCase() ? "scale-110 border-white" : "border-white/20"
              )}
              style={{ backgroundColor: c }}
              onClick={() => setOverlayPickColor(c)}
            />
          ))}
          <input
            type="color"
            value={overlayPickColor}
            onChange={(e) => setOverlayPickColor(e.target.value)}
            className="h-7 w-9 cursor-pointer rounded border border-white/10 bg-black/50"
            title="색 직접 선택"
          />
        </div>
      </div>

      <div>
        <Label className="text-[10px] text-slate-400">요소 모음</Label>
        <div className="mt-2 flex flex-wrap gap-1">
          {STUDIO_OVERLAY_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setOverlayCategory(cat.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors",
                overlayCategory === cat.id
                  ? cn(studio.btnSegmentActive, "rounded-md")
                  : "border-white/10 text-slate-400 hover:border-white/20"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {filteredCatalog.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={entry.label}
              onClick={() => addOverlayFromCatalog(entry.id)}
              className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-1 py-2 transition-colors hover:border-cyan-400/35 hover:bg-cyan-500/10"
            >
              <StudioOverlayCatalogThumb entry={entry} color={overlayPickColor} />
              <span className="max-w-full truncate px-0.5 text-[9px] text-slate-500">{entry.label}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedOverlay ? (
        <div className="space-y-3 rounded-lg border border-violet-500/35 bg-violet-950/15 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-violet-100">선택한 요소</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
              onClick={removeSelectedOverlay}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              삭제
            </Button>
          </div>
          {!selectedMosaic ? (
            <div className="flex justify-center py-1">
              <StudioOverlayGraphic
                catalogId={selectedOverlay.catalogId}
                color={selectedOverlay.color}
                size={Math.min(56, selectedOverlay.size)}
                filled={selectedOverlay.filled}
              />
            </div>
          ) : null}

          {selectedMosaic ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-slate-400">
                    가로 · {mosaicOverlayDimensions(selectedOverlay).w}px
                  </Label>
                  <Slider
                    className="mt-2"
                    min={24}
                    max={280}
                    step={2}
                    value={[mosaicOverlayDimensions(selectedOverlay).w]}
                    onValueChange={(v) =>
                      updateSelectedOverlay({ mosaicW: v[0] ?? mosaicOverlayDimensions(selectedOverlay).w })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-400">
                    세로 · {mosaicOverlayDimensions(selectedOverlay).h}px
                  </Label>
                  <Slider
                    className="mt-2"
                    min={24}
                    max={200}
                    step={2}
                    value={[mosaicOverlayDimensions(selectedOverlay).h]}
                    onValueChange={(v) =>
                      updateSelectedOverlay({ mosaicH: v[0] ?? mosaicOverlayDimensions(selectedOverlay).h })
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-slate-400">
                  모자이크 강도 · {mosaicOverlayBlockSize(selectedOverlay)} (작을수록 더 촘촘·자연스러움)
                </Label>
                <Slider
                  className="mt-2"
                  min={4}
                  max={18}
                  step={1}
                  value={[mosaicOverlayBlockSize(selectedOverlay)]}
                  onValueChange={(v) =>
                    updateSelectedOverlay({ mosaicBlock: v[0] ?? mosaicOverlayBlockSize(selectedOverlay) })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-slate-400">시작(초)</Label>
                  <Input
                    type="number"
                    step={0.05}
                    className="mt-0.5 h-7 border-white/10 bg-black/40 text-xs"
                    value={Math.round((selectedOverlay.startSec ?? 0) * 100) / 100}
                    onChange={(e) =>
                      updateSelectedOverlay({ startSec: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-400">끝(초)</Label>
                  <Input
                    type="number"
                    step={0.05}
                    className="mt-0.5 h-7 border-white/10 bg-black/40 text-xs"
                    value={
                      Math.round((selectedOverlay.endSec ?? videoDurationSec ?? 999) * 100) / 100
                    }
                    onChange={(e) =>
                      updateSelectedOverlay({
                        endSec: Math.max(0, Number(e.target.value) || videoDurationSec),
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 border-white/15 text-[10px]"
                  onClick={setPlayheadAsStart}
                >
                  현재 시각 → 시작
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 border-white/15 text-[10px]"
                  onClick={setPlayheadAsEnd}
                >
                  현재 시각 → 끝
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label className="text-[10px] text-slate-400">색상</Label>
                <input
                  type="color"
                  value={selectedOverlay.color}
                  onChange={(e) => updateSelectedOverlay({ color: e.target.value })}
                  className="mt-1.5 h-8 w-full cursor-pointer rounded border border-white/10 bg-black/50"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400">크기 {selectedOverlay.size}px</Label>
                <Slider
                  className="mt-2"
                  min={20}
                  max={120}
                  step={2}
                  value={[selectedOverlay.size]}
                  onValueChange={(v) => updateSelectedOverlay({ size: v[0] ?? 48 })}
                />
              </div>
            </>
          )}

          <div>
            <Label className="text-[10px] text-slate-400">회전 {selectedOverlay.rotation}°</Label>
            <Slider
              className="mt-2"
              min={-180}
              max={180}
              step={5}
              value={[selectedOverlay.rotation]}
              onValueChange={(v) => updateSelectedOverlay({ rotation: v[0] ?? 0 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-slate-400">가로 {Math.round(selectedOverlay.x)}%</Label>
              <Slider
                className="mt-2"
                min={5}
                max={95}
                step={1}
                value={[selectedOverlay.x]}
                onValueChange={(v) => updateSelectedOverlay({ x: v[0] ?? 50 })}
              />
            </div>
            <div>
              <Label className="text-[10px] text-slate-400">세로 {Math.round(selectedOverlay.y)}%</Label>
              <Slider
                className="mt-2"
                min={5}
                max={95}
                step={1}
                value={[selectedOverlay.y]}
                onValueChange={(v) => updateSelectedOverlay({ y: v[0] ?? 50 })}
              />
            </div>
          </div>
        </div>
      ) : overlays.length > 0 ? (
        <p className="text-[10px] text-slate-500">미리보기의 요소를 눌러 편집하거나, 위 모음에서 추가하세요.</p>
      ) : null}
    </div>
  )
}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Film, GripVertical, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import type { AutoEditPick } from "@/lib/shotform-auto-edit-types"
import {
  MVP_INSERT_CLIP_MIME,
  armMvpInsertClipDrag,
  clearMvpInsertClipDrag,
} from "@/lib/mvp-insert-clip-drag"
import { xhsVideoProxy } from "./MvpXhsMediaPreview"

export type InsertClipChoice = {
  blob: Blob
  label: string
  durationSec: number
  /** 원본에서 잘라 쓸 시작 시각(초) */
  trimStartSec: number
  afterCutIndex: number
  /** 공백 컷을 이 클립으로 채움 (지정 시 afterCutIndex 대신 사용) */
  replaceCutIndex?: number | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cutCount: number
  activeCutIndex: number
  picks?: AutoEditPick[]
  busy?: boolean
  onConfirm: (choice: InsertClipChoice) => void
}

type SourceTab = "picks" | "upload"

const DURATION_PRESETS = [1, 1.5, 2, 2.5, 3, 4, 5] as const

async function probeVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video")
    v.preload = "metadata"
    v.onloadedmetadata = () => {
      const d = Number.isFinite(v.duration) ? v.duration : 0
      resolve(d > 0.05 ? d : 0)
      v.removeAttribute("src")
      v.load()
    }
    v.onerror = () => resolve(0)
    v.src = url
  })
}

function platformLabel(platform: string): string {
  const p = platform.toLowerCase()
  if (p.includes("xhs") || p.includes("xiaohongshu") || p.includes("red")) return "샤오홍슈"
  if (p.includes("douyin") || p.includes("tiktok")) return "도우인"
  if (p.includes("youtube")) return "유튜브"
  return platform || "픽"
}

export function MvpInsertClipDialog({
  open,
  onOpenChange,
  cutCount,
  activeCutIndex,
  picks = [],
  busy = false,
  onConfirm,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const [sourceTab, setSourceTab] = useState<SourceTab>("picks")
  const [afterCutIndex, setAfterCutIndex] = useState(
    Math.max(-1, Math.min(cutCount - 1, activeCutIndex))
  )
  const [durationSec, setDurationSec] = useState(2)
  const [trimStartSec, setTrimStartSec] = useState(0)
  const [sourceDurationSec, setSourceDurationSec] = useState(0)
  const [selectedPickKey, setSelectedPickKey] = useState<string | null>(null)
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [err, setErr] = useState("")
  const [loadingPick, setLoadingPick] = useState(false)
  const [probing, setProbing] = useState(false)

  const pickOptions = useMemo(
    () => picks.filter((p) => Boolean(p.videoUrl?.trim())),
    [picks]
  )

  const selectedPick = pickOptions.find((p) => p.key === selectedPickKey) ?? null

  const previewSrc = useMemo(() => {
    if (sourceTab === "upload" && localPreviewUrl) return localPreviewUrl
    if (sourceTab === "picks" && selectedPick?.videoUrl) {
      return xhsVideoProxy(selectedPick.videoUrl)
    }
    return null
  }, [sourceTab, localPreviewUrl, selectedPick])

  const maxTrimStart = Math.max(0, sourceDurationSec - 0.4)
  const maxDuration = Math.max(
    0.4,
    sourceDurationSec > 0.4 ? sourceDurationSec - trimStartSec : 8
  )
  const effectiveDuration = Math.min(durationSec, maxDuration)

  const resetLocal = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
    setLocalFile(null)
    setLocalPreviewUrl(null)
  }

  const resetTrim = () => {
    setTrimStartSec(0)
    setDurationSec(2)
    setSourceDurationSec(0)
  }

  useEffect(() => {
    if (!open) return
    setAfterCutIndex(Math.max(-1, Math.min(cutCount - 1, activeCutIndex)))
    setErr("")
    setSourceTab(pickOptions.length > 0 ? "picks" : "upload")
  }, [open, cutCount, activeCutIndex, pickOptions.length])

  useEffect(() => {
    if (!open || !previewSrc) {
      setSourceDurationSec(0)
      return
    }
    let cancelled = false
    setProbing(true)
    void probeVideoDuration(previewSrc).then((d) => {
      if (cancelled) return
      setSourceDurationSec(d)
      setProbing(false)
      if (d > 0.4) {
        setTrimStartSec((prev) => Math.min(prev, Math.max(0, d - 0.4)))
        setDurationSec((prev) => Math.min(prev, d))
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, previewSrc])

  useEffect(() => {
    const v = previewRef.current
    if (!v || !previewSrc) return
    const seek = () => {
      try {
        if (Number.isFinite(v.duration) && v.duration > 0) {
          v.currentTime = Math.min(Math.max(0, trimStartSec), Math.max(0, v.duration - 0.05))
        }
      } catch {
        /* ignore */
      }
    }
    if (v.readyState >= 1) seek()
    else v.addEventListener("loadedmetadata", seek, { once: true })
  }, [trimStartSec, previewSrc])

  const handleFile = (file: File | null) => {
    setErr("")
    setSelectedPickKey(null)
    resetLocal()
    resetTrim()
    if (!file) return
    if (!file.type.startsWith("video/")) {
      setErr("영상 파일(MP4 등)만 선택할 수 있습니다.")
      return
    }
    setLocalFile(file)
    setLocalPreviewUrl(URL.createObjectURL(file))
    setSourceTab("upload")
  }

  const selectPick = (key: string) => {
    setErr("")
    resetLocal()
    resetTrim()
    setSelectedPickKey(key)
    setSourceTab("picks")
  }

  const buildChoiceBlob = async (): Promise<{ blob: Blob; label: string }> => {
    if (sourceTab === "picks") {
      if (!selectedPick?.videoUrl) throw new Error("영상 소스를 선택해 주세요.")
      const fetchUrl = xhsVideoProxy(selectedPick.videoUrl)
      const res = await fetch(fetchUrl)
      if (!res.ok) throw new Error(`영상 소스를 불러오지 못했습니다 (${res.status})`)
      const blob = await res.blob()
      const label =
        selectedPick.title ||
        `${platformLabel(selectedPick.platform)} · ${selectedPick.video_id}`
      return { blob, label }
    }
    if (!localFile) throw new Error("추가할 영상을 선택하거나 업로드해 주세요.")
    return { blob: localFile, label: localFile.name || "추가 클립" }
  }

  const handleConfirm = async () => {
    setErr("")
    try {
      setLoadingPick(true)
      const { blob, label } = await buildChoiceBlob()
      if (!blob || blob.size < 1000) {
        throw new Error("추가할 영상을 선택하거나 업로드해 주세요.")
      }
      const start = Math.max(0, Math.min(maxTrimStart, trimStartSec))
      const dur = Math.max(0.4, Math.min(8, effectiveDuration))
      onConfirm({
        blob,
        label,
        durationSec: dur,
        trimStartSec: start,
        afterCutIndex,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : "선택 실패")
    } finally {
      setLoadingPick(false)
    }
  }

  const armDragForPick = (pick: AutoEditPick, useCurrentTrim: boolean) => {
    const start = useCurrentTrim ? Math.max(0, Math.min(maxTrimStart, trimStartSec)) : 0
    const dur = useCurrentTrim
      ? Math.max(0.4, Math.min(8, effectiveDuration))
      : 2
    const label =
      pick.title || `${platformLabel(pick.platform)} · ${pick.video_id}`
    armMvpInsertClipDrag({
      label,
      trimStartSec: start,
      durationSec: dur,
      resolveBlob: async () => {
        const res = await fetch(xhsVideoProxy(pick.videoUrl))
        if (!res.ok) throw new Error(`영상 소스를 불러오지 못했습니다 (${res.status})`)
        const blob = await res.blob()
        if (blob.size < 1000) throw new Error("영상 파일이 비어 있습니다.")
        return blob
      },
    })
  }

  const armDragForCurrentSource = () => {
    if (sourceTab === "picks" && selectedPick) {
      armDragForPick(selectedPick, true)
      return
    }
    if (sourceTab === "upload" && localFile) {
      const file = localFile
      armMvpInsertClipDrag({
        label: file.name || "추가 클립",
        trimStartSec: Math.max(0, Math.min(maxTrimStart, trimStartSec)),
        durationSec: Math.max(0.4, Math.min(8, effectiveDuration)),
        resolveBlob: async () => file,
      })
    }
  }

  const hasSource =
    (sourceTab === "upload" && Boolean(localFile)) ||
    (sourceTab === "picks" && Boolean(selectedPickKey))

  return (
    <Dialog
      modal={false}
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        if (!next) {
          clearMvpInsertClipDrag()
          resetLocal()
          setSelectedPickKey(null)
          resetTrim()
          setErr("")
        }
        onOpenChange(next)
      }}
    >
      <DialogContent
        className={cn(
          "z-[220] max-h-[min(88vh,860px)] w-[min(100%-1.5rem,26rem)] overflow-y-auto bg-white text-slate-900",
          "!left-auto !right-3 !top-[6%] !translate-x-0 !translate-y-0 sm:max-w-md"
        )}
        overlayClassName="z-[210] pointer-events-none bg-transparent"
        onPointerDownOutside={(e) => {
          // 타임라인 드롭을 위해 바깥 클릭으로 닫지 않음 — 취소 버튼만
          e.preventDefault()
        }}
        onInteractOutside={(e) => {
          e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Film className="h-5 w-5 text-violet-600" />
            추가 영상 가져오기
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            소스를 고른 뒤 <strong className="font-semibold text-slate-700">타임라인 영상 트랙</strong>
            으로 드래그하세요. <strong className="font-semibold text-slate-700">공백</strong> 위에
            놓으면 공백 길이에 맞춰 구간을 고르는 편집기가 열립니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-[11px] leading-relaxed text-violet-900">
            패널을 옆에 둔 채, 아래 소스를 <strong>드래그</strong>해 하단 타임라인 「영상」 트랙에
            놓으세요. 버튼으로도 넣을 수 있습니다.
          </div>

          <div className="flex rounded-lg border border-slate-200 p-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => setSourceTab("picks")}
              className={cn(
                "flex-1 rounded-md py-2 text-xs font-semibold transition",
                sourceTab === "picks"
                  ? "bg-violet-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              가져온 영상 소스 ({pickOptions.length})
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setSourceTab("upload")}
              className={cn(
                "flex-1 rounded-md py-2 text-xs font-semibold transition",
                sourceTab === "upload"
                  ? "bg-violet-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              직접 업로드
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">삽입 위치 (버튼 넣기용)</Label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
              value={afterCutIndex}
              onChange={(e) => setAfterCutIndex(Number(e.target.value))}
              disabled={busy}
            >
              <option value={-1}>맨 앞</option>
              {Array.from({ length: cutCount }, (_, i) => (
                <option key={i} value={i}>
                  장면 {i + 1} 뒤
                  {i === activeCutIndex ? " (현재 선택)" : ""}
                </option>
              ))}
            </select>
          </div>

          {sourceTab === "picks" ? (
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">드래그해서 타임라인에 넣기</Label>
              {pickOptions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-500">
                  가져온 영상 소스가 없습니다. 「직접 업로드」로 PC 영상을 넣어 주세요.
                </p>
              ) : (
                <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-3">
                  {pickOptions.map((pick) => {
                    const active = selectedPickKey === pick.key
                    const thumbSrc = xhsVideoProxy(pick.videoUrl)
                    return (
                      <button
                        key={pick.key}
                        type="button"
                        disabled={busy}
                        draggable={!busy}
                        onClick={() => selectPick(pick.key)}
                        onDragStart={(e) => {
                          const useTrim = selectedPickKey === pick.key
                          if (!useTrim) selectPick(pick.key)
                          armDragForPick(pick, useTrim)
                          e.dataTransfer.setData(MVP_INSERT_CLIP_MIME, pick.key)
                          e.dataTransfer.effectAllowed = "copy"
                        }}
                        onDragEnd={() => clearMvpInsertClipDrag()}
                        className={cn(
                          "cursor-grab overflow-hidden rounded-lg border text-left transition active:cursor-grabbing",
                          active
                            ? "border-violet-500 ring-2 ring-violet-300"
                            : "border-slate-200 hover:border-violet-300"
                        )}
                        title="타임라인으로 드래그"
                      >
                        <div className="relative aspect-[9/12] bg-slate-900">
                          <video
                            src={thumbSrc}
                            muted
                            playsInline
                            preload="metadata"
                            draggable={false}
                            className="pointer-events-none h-full w-full object-cover"
                            onLoadedData={(e) => {
                              try {
                                e.currentTarget.currentTime = 0.2
                              } catch {
                                /* ignore */
                              }
                            }}
                          />
                          <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-semibold text-white">
                            {platformLabel(pick.platform)}
                          </span>
                          <span className="absolute bottom-1 right-1 rounded bg-violet-600/90 px-1 py-0.5 text-[9px] font-semibold text-white">
                            드래그
                          </span>
                        </div>
                        <p className="line-clamp-2 px-1.5 py-1 text-[10px] font-medium text-slate-800">
                          {pick.title || pick.video_id}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">PC에서 영상 업로드</Label>
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/webm,video/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full border-slate-200"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {localFile ? localFile.name : "내 PC에서 영상 선택"}
              </Button>
            </div>
          )}

          {previewSrc ? (
            <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
              <Label className="text-xs font-semibold text-violet-900">구간 자르기 (커스텀)</Label>
              <video
                ref={previewRef}
                src={previewSrc}
                className="max-h-40 w-full rounded-lg border border-slate-200 bg-black object-contain"
                controls
                muted
                playsInline
                preload="metadata"
              />
              {probing ? (
                <p className="text-[11px] text-slate-500">영상 길이 확인 중…</p>
              ) : sourceDurationSec > 0 ? (
                <p className="text-[11px] text-slate-600">
                  원본 길이 {sourceDurationSec.toFixed(1)}초 · 사용{" "}
                  <strong>
                    {trimStartSec.toFixed(1)}s ~ {(trimStartSec + effectiveDuration).toFixed(1)}s
                  </strong>{" "}
                  ({effectiveDuration.toFixed(1)}초)
                </p>
              ) : null}

              <div
                draggable={hasSource && !busy}
                onDragStart={(e) => {
                  if (!hasSource || busy) {
                    e.preventDefault()
                    return
                  }
                  armDragForCurrentSource()
                  e.dataTransfer.setData(MVP_INSERT_CLIP_MIME, "current")
                  e.dataTransfer.effectAllowed = "copy"
                }}
                onDragEnd={() => clearMvpInsertClipDrag()}
                className={cn(
                  "flex cursor-grab items-center justify-center gap-2 rounded-lg border border-dashed border-violet-400 bg-white px-3 py-2.5 text-xs font-semibold text-violet-800 transition active:cursor-grabbing",
                  (!hasSource || busy) && "cursor-not-allowed opacity-50"
                )}
                title="이 구간을 타임라인으로 드래그"
              >
                <GripVertical className="h-4 w-4" />
                이 구간을 타임라인으로 드래그
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[11px] text-slate-600">시작 위치 (초)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={maxTrimStart || 0}
                    step={0.1}
                    value={Number(trimStartSec.toFixed(1))}
                    disabled={busy || maxTrimStart <= 0}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      if (!Number.isFinite(n)) return
                      setTrimStartSec(Math.max(0, Math.min(maxTrimStart, n)))
                    }}
                    className="h-8 w-20 border-slate-200 text-xs"
                  />
                </div>
                <Slider
                  min={0}
                  max={Math.max(0.1, maxTrimStart)}
                  step={0.1}
                  value={[Math.min(trimStartSec, maxTrimStart)]}
                  disabled={busy || maxTrimStart <= 0}
                  onValueChange={(v) => setTrimStartSec(v[0] ?? 0)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[11px] text-slate-600">쓸 길이 (초)</Label>
                  <Input
                    type="number"
                    min={0.4}
                    max={Math.min(8, maxDuration)}
                    step={0.1}
                    value={Number(effectiveDuration.toFixed(1))}
                    disabled={busy}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      if (!Number.isFinite(n)) return
                      setDurationSec(Math.max(0.4, Math.min(8, Math.min(maxDuration, n))))
                    }}
                    className="h-8 w-20 border-slate-200 text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DURATION_PRESETS.map((sec) => (
                    <Button
                      key={sec}
                      type="button"
                      size="sm"
                      variant={Math.abs(durationSec - sec) < 0.05 ? "default" : "outline"}
                      className={cn(
                        "h-7 px-2 text-[11px]",
                        Math.abs(durationSec - sec) < 0.05
                          ? "bg-violet-600 text-white hover:bg-violet-500"
                          : "border-slate-200"
                      )}
                      disabled={busy || (sourceDurationSec > 0 && sec > maxDuration + 0.05)}
                      onClick={() => setDurationSec(sec)}
                    >
                      {sec}초
                    </Button>
                  ))}
                </div>
                <Slider
                  min={0.4}
                  max={Math.min(8, Math.max(0.5, maxDuration))}
                  step={0.1}
                  value={[effectiveDuration]}
                  disabled={busy}
                  onValueChange={(v) => setDurationSec(v[0] ?? 2)}
                />
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-[11px] text-slate-500">
              위에서 소스를 고르거나 영상을 업로드하면, 여기서 시작점·길이를 맞춰 자를 수 있습니다.
            </p>
          )}

          {err ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {err}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full bg-violet-600 text-white hover:bg-violet-500"
            disabled={busy || loadingPick || !hasSource}
            onClick={() => void handleConfirm()}
          >
            {busy || loadingPick ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                넣는 중…
              </>
            ) : (
              `${effectiveDuration.toFixed(1)}초 · 선택 위치에 넣기`
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

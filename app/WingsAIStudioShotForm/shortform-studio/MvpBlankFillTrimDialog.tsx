"use client"

import { useEffect, useRef, useState } from "react"
import { Film, Loader2, Scissors } from "lucide-react"
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

export type BlankFillTrimResult = {
  blob: Blob
  label: string
  trimStartSec: number
  /** 공백 길이와 동일 — 늘리지 않음 */
  durationSec: number
  replaceCutIndex: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 드롭한 소스 미리보기 URL (blob:) */
  previewUrl: string | null
  blob: Blob | null
  label: string
  blankIndex: number
  /** 공백 컷 길이(초) — 넣을 길이는 이 값으로 고정 */
  blankDurationSec: number
  busy?: boolean
  onConfirm: (result: BlankFillTrimResult) => void
}

/**
 * 공백에 드롭한 뒤 — 공백과 같은 길이만 소스에서 골라 넣는 트림 편집기.
 */
export function MvpBlankFillTrimDialog({
  open,
  onOpenChange,
  previewUrl,
  blob,
  label,
  blankIndex,
  blankDurationSec,
  busy = false,
  onConfirm,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [sourceDurationSec, setSourceDurationSec] = useState(0)
  const [trimStartSec, setTrimStartSec] = useState(0)
  const [probing, setProbing] = useState(false)
  const [err, setErr] = useState("")

  const blankDur = Math.max(0.4, blankDurationSec)
  const maxTrimStart = Math.max(0, sourceDurationSec - blankDur)
  const effectiveDuration = blankDur

  useEffect(() => {
    if (!open) return
    setErr("")
    setTrimStartSec(0)
  }, [open, blankDur, previewUrl])

  useEffect(() => {
    if (!open || !previewUrl) {
      setSourceDurationSec(0)
      return
    }
    let cancelled = false
    setProbing(true)
    const v = document.createElement("video")
    v.preload = "metadata"
    v.onloadedmetadata = () => {
      if (cancelled) return
      const d = Number.isFinite(v.duration) ? v.duration : 0
      setSourceDurationSec(d > 0.05 ? d : 0)
      setProbing(false)
      v.removeAttribute("src")
      v.load()
    }
    v.onerror = () => {
      if (cancelled) return
      setSourceDurationSec(0)
      setProbing(false)
    }
    v.src = previewUrl
    return () => {
      cancelled = true
    }
  }, [open, previewUrl])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !previewUrl) return
    const seek = () => {
      try {
        if (Number.isFinite(v.duration) && v.duration > 0) {
          v.currentTime = Math.min(
            Math.max(0, trimStartSec),
            Math.max(0, v.duration - 0.05)
          )
        }
      } catch {
        /* ignore */
      }
    }
    if (v.readyState >= 1) seek()
    else v.addEventListener("loadedmetadata", seek, { once: true })
  }, [trimStartSec, previewUrl])

  // 선택 구간만 살짝 루프 미리보기
  useEffect(() => {
    const v = videoRef.current
    if (!v || !open) return
    const onTime = () => {
      const end = trimStartSec + effectiveDuration
      if (v.currentTime >= end - 0.04) {
        try {
          v.currentTime = trimStartSec
        } catch {
          /* ignore */
        }
      }
    }
    v.addEventListener("timeupdate", onTime)
    return () => v.removeEventListener("timeupdate", onTime)
  }, [open, trimStartSec, effectiveDuration])

  const handleConfirm = () => {
    setErr("")
    if (!blob || blob.size < 1000) {
      setErr("영상 파일이 없습니다. 다시 드래그해 주세요.")
      return
    }
    if (sourceDurationSec > 0 && sourceDurationSec + 0.05 < blankDur) {
      setErr(
        `소스 영상(${sourceDurationSec.toFixed(1)}초)이 공백(${blankDur.toFixed(1)}초)보다 짧습니다.`
      )
      return
    }
    const start = Math.max(0, Math.min(maxTrimStart, trimStartSec))
    onConfirm({
      blob,
      label,
      trimStartSec: start,
      durationSec: blankDur,
      replaceCutIndex: blankIndex,
    })
  }

  const canConfirm =
    Boolean(blob) &&
    !busy &&
    !probing &&
    (sourceDurationSec <= 0 || sourceDurationSec + 0.05 >= blankDur)

  return (
    <Dialog
      modal={false}
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        className={cn(
          "z-[230] max-h-[min(90vh,900px)] w-[min(100%-1rem,32rem)] overflow-y-auto bg-white text-slate-900 sm:max-w-lg",
          "max-sm:!left-1/2 max-sm:!right-auto max-sm:!top-auto max-sm:!bottom-3 max-sm:!-translate-x-1/2 max-sm:!translate-y-0",
          "sm:!left-auto sm:!right-3 sm:!top-[5%] sm:!translate-x-0 sm:!translate-y-0"
        )}
        overlayClassName="z-[225] pointer-events-none bg-transparent"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Scissors className="h-5 w-5 text-violet-600" />
            공백 채우기 · 구간 짜집기
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            공백{" "}
            <strong className="font-semibold text-slate-700">
              장면 {blankIndex + 1}
            </strong>
            의 길이는{" "}
            <strong className="font-semibold text-violet-700">
              {blankDur.toFixed(1)}초
            </strong>
            입니다. 소스에서 <strong className="font-semibold text-slate-700">정확히 이 길이</strong>만
            골라 넣습니다. (공백은 늘어나지 않음)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-[11px] leading-relaxed text-violet-900">
            <Film className="mr-1 inline h-3.5 w-3.5" />
            {label || "추가 영상"} · 넣을 길이 고정{" "}
            <strong>{blankDur.toFixed(1)}초</strong> (공백과 동일)
          </div>

          {previewUrl ? (
            <video
              ref={videoRef}
              src={previewUrl}
              className="max-h-56 w-full rounded-lg border border-slate-200 bg-black object-contain"
              controls
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-slate-500">
              미리보기를 불러오는 중…
            </p>
          )}

          {probing ? (
            <p className="text-[11px] text-slate-500">원본 길이 확인 중…</p>
          ) : sourceDurationSec > 0 ? (
            <p className="text-[11px] text-slate-600">
              원본 {sourceDurationSec.toFixed(1)}초 · 선택{" "}
              <strong>
                {trimStartSec.toFixed(1)}s ~{" "}
                {(trimStartSec + effectiveDuration).toFixed(1)}s
              </strong>{" "}
              ({effectiveDuration.toFixed(1)}초)
            </p>
          ) : null}

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

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
            쓸 길이: <strong className="text-violet-700">{blankDur.toFixed(1)}초</strong> (공백
            길이와 동일 · 변경 불가) · 시작 위치만 옮겨 원하는 장면을 고르세요.
          </div>

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
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                넣는 중…
              </>
            ) : (
              `${effectiveDuration.toFixed(1)}초 구간으로 공백 채우기`
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

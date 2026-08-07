"use client"

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react"
import { Eraser, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  fetchStudioVideoBlob,
  friendlySubtitleRemovalError,
  requestChineseSubtitleRemoval,
  shotformVmakeApiKey,
  shotformVmakeSecretAccessKey,
  VMAKE_SUBTITLE_REMOVAL_SLOW_HINT,
} from "@/lib/shotform-vmake-subtitle-removal"

const SUCCESS_TOAST_MS = 3_000

type Props = {
  videoUrl: string | null
  videoLoading?: boolean
  jobId?: string
  projectId?: string
  downloadUrl?: string | null
  videoBlobRef?: MutableRefObject<Blob | null>
  onVideoReplaced: (blob: Blob) => void | Promise<void>
  className?: string
  /** panel: 설명 카드 · toolbar: 미리보기 옆 컴팩트 버튼 */
  variant?: "panel" | "toolbar"
}

export function MvpChineseSubtitleRemovalPanel({
  videoUrl,
  videoLoading = false,
  jobId,
  projectId,
  downloadUrl,
  videoBlobRef,
  onVideoReplaced,
  className,
  variant = "panel",
}: Props) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const successToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasVmakeKeys = Boolean(shotformVmakeApiKey() && shotformVmakeSecretAccessKey())

  const clearSuccessToastTimer = useCallback(() => {
    if (successToastTimerRef.current != null) {
      clearTimeout(successToastTimerRef.current)
      successToastTimerRef.current = null
    }
  }, [])

  useEffect(() => () => clearSuccessToastTimer(), [clearSuccessToastTimer])

  const run = useCallback(async () => {
    const vmakeApiKey = shotformVmakeApiKey()
    const vmakeSecretAccessKey = shotformVmakeSecretAccessKey()
    if (!vmakeApiKey || !vmakeSecretAccessKey) {
      setErr("자막 제거 API 키가 없습니다. 상단 설정에서 API Key / Secret Access Key를 입력해 주세요.")
      return
    }
    if (!videoUrl && !jobId && !videoBlobRef?.current) {
      setErr("리믹스 영상이 아직 준비되지 않았습니다.")
      return
    }

    clearSuccessToastTimer()
    setLoading(true)
    setErr(null)
    setDone(false)
    setStatus("리믹스 영상 준비 중…")

    try {
      let videoBlob: Blob | null = null
      if (!jobId?.trim()) {
        videoBlob = videoBlobRef?.current ?? null
        if (!videoBlob || videoBlob.size < 20_000) {
          videoBlob = await fetchStudioVideoBlob(videoUrl, {
            jobId,
            projectId,
            downloadUrl,
          })
        }
        if (!videoBlob) {
          throw new Error(
            "리믹스 영상을 불러오지 못했습니다. 편집 탭에서 미리보기가 재생되는지 확인한 뒤, 새로고침 후 다시 시도해 주세요."
          )
        }
      }

      setStatus(
        jobId?.trim()
          ? "서버에서 리믹스 영상을 불러와 중국어 자막 제거 중… (수 분 소요)"
          : `중국어 자막 제거 중… ${VMAKE_SUBTITLE_REMOVAL_SLOW_HINT}`
      )

      const cleaned = await requestChineseSubtitleRemoval({
        vmakeApiKey,
        vmakeSecretAccessKey,
        videoBlob,
        jobId,
      })

      setStatus("처리된 영상을 불러와 미리보기에 반영 중…")
      await onVideoReplaced(cleaned)
      setDone(true)
      setErr(null)
      setStatus("중국어 자막 제거가 완료되었습니다. 미리보기·보내기에 반영됩니다.")
      // 완료 토스트는 3초 후 자동 숨김 (버튼의「다시」라벨은 done으로 유지)
      clearSuccessToastTimer()
      successToastTimerRef.current = setTimeout(() => {
        setStatus("")
        successToastTimerRef.current = null
      }, SUCCESS_TOAST_MS)
    } catch (e) {
      clearSuccessToastTimer()
      setErr(
        friendlySubtitleRemovalError(e instanceof Error ? e.message : null) ||
          "중국어 자막 제거 실패"
      )
      setStatus("")
    } finally {
      setLoading(false)
    }
  }, [videoUrl, jobId, projectId, downloadUrl, videoBlobRef, onVideoReplaced, clearSuccessToastTimer])

  if (variant === "toolbar") {
    const title = !hasVmakeKeys
      ? "자막 제거 API 키가 필요합니다"
      : err || status || VMAKE_SUBTITLE_REMOVAL_SLOW_HINT

    return (
      <div className={cn("relative", className)}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          title={title}
          className="h-8 border-amber-400/70 bg-amber-500 text-xs font-semibold text-white hover:bg-amber-400 hover:text-white"
          disabled={loading || videoLoading || !videoUrl || !hasVmakeKeys}
          onClick={() => void run()}
        >
          {loading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eraser className="mr-1.5 h-3.5 w-3.5" />
          )}
          {loading ? "자막 제거 중…" : done ? "자막 제거 다시" : "중국어 자막 제거"}
        </Button>
        {err || (loading && status) || (done && status) ? (
          <p
            className={cn(
              "absolute right-0 top-[calc(100%+6px)] z-40 w-[min(360px,85vw)] rounded-lg border px-2.5 py-1.5 text-[10px] leading-relaxed shadow-lg",
              err
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-amber-200 bg-amber-50 text-amber-900"
            )}
          >
            {err || status}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-950/20 to-transparent p-3",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <Eraser className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-amber-100">중국어 자막 제거</p>
          <p className="mt-1 text-[10px] leading-relaxed text-amber-100/75">
            리믹스를 자막 제거 없이 완료한 뒤, 여기서 합성 영상에만 다시 적용할 수 있습니다.
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-amber-200/80">{VMAKE_SUBTITLE_REMOVAL_SLOW_HINT}</p>
        </div>
      </div>

      {!hasVmakeKeys ? (
        <p className="mt-2 rounded-lg border border-amber-500/20 bg-black/25 px-2.5 py-2 text-[10px] text-amber-200/90">
          자막 제거 API 키가 설정되지 않았습니다. 상단 API 키 설정에서 입력해 주세요.
        </p>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        className="mt-3 h-9 w-full gap-2 border border-amber-500/30 bg-amber-500/10 text-xs text-amber-100 hover:bg-amber-500/20"
        disabled={loading || videoLoading || !videoUrl}
        onClick={() => void run()}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eraser className="h-3.5 w-3.5" />}
        {loading ? "자막 제거 진행 중…" : done ? "다시 자막 제거" : "중국어 자막 제거 실행"}
      </Button>

      {status ? <p className="mt-2 text-[10px] leading-relaxed text-amber-100/90">{status}</p> : null}
      {err ? <p className="mt-2 text-[10px] leading-relaxed text-red-300">{err}</p> : null}
    </div>
  )
}

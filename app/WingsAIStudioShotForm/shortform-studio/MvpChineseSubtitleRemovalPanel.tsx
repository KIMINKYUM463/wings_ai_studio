"use client"

import { useCallback, useState, type MutableRefObject } from "react"
import { Eraser, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  fetchStudioVideoBlob,
  requestChineseSubtitleRemoval,
  shotformVmakeApiKey,
  shotformVmakeSecretAccessKey,
  VMAKE_SUBTITLE_REMOVAL_SLOW_HINT,
} from "@/lib/shotform-vmake-subtitle-removal"

type Props = {
  videoUrl: string | null
  videoLoading?: boolean
  jobId?: string
  projectId?: string
  downloadUrl?: string | null
  videoBlobRef?: MutableRefObject<Blob | null>
  onVideoReplaced: (blob: Blob) => void | Promise<void>
  className?: string
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
}: Props) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const hasVmakeKeys = Boolean(shotformVmakeApiKey() && shotformVmakeSecretAccessKey())

  const run = useCallback(async () => {
    const vmakeApiKey = shotformVmakeApiKey()
    const vmakeSecretAccessKey = shotformVmakeSecretAccessKey()
    if (!vmakeApiKey || !vmakeSecretAccessKey) {
      setErr("Vmake API 키가 없습니다. 상단 설정에서 API Key / Secret Access Key를 입력해 주세요.")
      return
    }
    if (!videoUrl && !jobId && !videoBlobRef?.current) {
      setErr("짜집기 영상이 아직 준비되지 않았습니다.")
      return
    }

    setLoading(true)
    setErr(null)
    setDone(false)
    setStatus("짜집기 영상 준비 중…")

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
            "짜집기 영상을 불러오지 못했습니다. 편집 탭에서 미리보기가 재생되는지 확인한 뒤, 새로고침 후 다시 시도해 주세요."
          )
        }
      }

      setStatus(
        jobId?.trim()
          ? "서버에서 짜집기 영상을 불러와 Vmake AI 자막 제거 중… (수 분 소요)"
          : "Vmake AI로 중국어 자막 제거 중… (수 분 소요될 수 있습니다)"
      )
      const cleaned = await requestChineseSubtitleRemoval({
        videoBlob,
        jobId,
        vmakeApiKey,
        vmakeSecretAccessKey,
      })

      setStatus("처리된 영상을 불러와 미리보기에 반영 중…")
      await onVideoReplaced(cleaned)
      setDone(true)
      setStatus("중국어 자막 제거가 완료되었습니다. 미리보기·보내기에 반영됩니다.")
    } catch (e) {
      setErr(e instanceof Error ? e.message : "중국어 자막 제거 실패")
      setStatus("")
    } finally {
      setLoading(false)
    }
  }, [videoUrl, jobId, projectId, downloadUrl, videoBlobRef, onVideoReplaced])

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
          <p className="text-xs font-semibold text-amber-100">Vmake AI 중국어 자막 제거</p>
          <p className="mt-1 text-[10px] leading-relaxed text-amber-100/75">
            짜집기를 자막 제거 없이 완료한 뒤, 여기서 합성 영상에만 다시 적용할 수 있습니다.
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-amber-200/80">{VMAKE_SUBTITLE_REMOVAL_SLOW_HINT}</p>
        </div>
      </div>

      {!hasVmakeKeys ? (
        <p className="mt-2 rounded-lg border border-amber-500/20 bg-black/25 px-2.5 py-2 text-[10px] text-amber-200/90">
          Vmake API 키가 설정되지 않았습니다. 상단 API 키 설정에서 입력해 주세요.
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

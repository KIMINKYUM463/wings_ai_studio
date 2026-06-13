"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Download, Loader2, Scissors, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { studio } from "../components/ShotFormStudioUI"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type {
  AutoEditAnalysisMode,
  AutoEditJobResult,
  AutoEditPick,
  AutoEditTargetDuration,
} from "@/lib/shotform-auto-edit-types"
import {
  AUTO_EDIT_ANALYSIS_MODE_DEFAULT,
  AUTO_EDIT_ANALYSIS_MODE_OPTIONS,
} from "@/lib/shotform-auto-edit-types"
import { toAutoEditVideoInputs } from "@/lib/shotform-auto-edit-types"
import { editPlanTotalOutputSeconds } from "@/lib/shotform-auto-edit-plan-finalize"
import {
  formatBenchmarkSceneCard,
  stripShotLabelFromDescription,
} from "@/lib/shotform-visual-scene-match"
import { autoEditDownloadUrl } from "@/lib/shotform-auto-edit-download"
import { assertPreviewMp4Blob } from "@/lib/mvp-mp4-preview"
import { saveMvpEditMp4 } from "@/lib/mvp-local-media-cache"
import {
  formatShotformFetchError,
  refreshExpiredMvpEditPicks,
} from "@/lib/shotform-mvp-pick-video-download"
import { extractClientVideoMetaForPicks } from "@/lib/shotform-client-video-meta"
import { uploadAutoEditSourcesFromBrowser } from "@/lib/shotform-auto-edit-client-source-upload"
import { isAutoEditNoUsableVideoError } from "@/lib/shotform-auto-edit-mix"
import {
  VMAKE_SUBTITLE_REMOVAL_SLOW_HINT,
  VMAKE_SUBTITLE_REMOVAL_STALL_HINT,
} from "@/lib/shotform-vmake-subtitle-removal"

const DURATIONS: AutoEditTargetDuration[] = [20, 30, 45, 60]
/** 「쓸수있는 영상 없음」 간헐 오류 — 자동 재시도 횟수 (총 1+2=3회 시도) */
const AUTO_EDIT_USABLE_VIDEO_MAX_RETRIES = 2

const STEPS: Array<{ key: AutoEditJobResult["step"]; label: string }> = [
  { key: "download", label: "영상 다운로드" },
  { key: "analyze", label: "제품·장면 분석" },
  { key: "mix", label: "영상 mix (picks)" },
  { key: "edit_plan", label: "짜집기 타임라인" },
  { key: "render", label: "ffmpeg 렌더" },
  { key: "subtitle_removal", label: "Vmake 중국어 자막 제거" },
  { key: "script", label: "장면맞춤 나레이션" },
  { key: "done", label: "완료" },
]

function stepIndex(step: AutoEditJobResult["step"]): number {
  if (step === "error") return -1
  const i = STEPS.findIndex((s) => s.key === step)
  return i >= 0 ? i : STEPS.length - 1
}

const ANALYZE_STEP_HINTS: Record<AutoEditAnalysisMode, string> = {
  fast: "Vision 분석 중… (고속: 보통 15~45초, 2분 넘으면 자동 안내)",
  balanced: "키프레임 추출·Vision·장면 분석 중… (중간: 약 1~3분, 4분 넘으면 자동 안내)",
  precision: "영상별 심층 분석·mix 생성 중… (정밀: 약 3~8분, 10분 넘으면 자동 안내)",
}

function stepHintsForMode(
  mode: AutoEditAnalysisMode,
  withSubtitleRemoval = false
): Partial<Record<AutoEditJobResult["step"], string>> {
  return {
    download: "서버에서 원본 영상 준비 중… (브라우저 업로드 완료 시 곧 분석 단계로 넘어갑니다)",
    subtitle_removal: withSubtitleRemoval
      ? `Vmake AI 중국어 자막 제거 중… (${VMAKE_SUBTITLE_REMOVAL_SLOW_HINT})`
      : "짜집기 완료 영상에서 중국어 자막 제거 중…",
    analyze: ANALYZE_STEP_HINTS[mode],
    mix: "영상 mix (picks) 생성 중…",
    edit_plan: mode === "precision" ? "짜집기 타임라인·컷별 Vision 캡션 중…" : "짜집기 타임라인 구성 중…",
    render: "ffmpeg 렌더 중…",
    script: "장면맞춤 나레이션 생성 중… (2분 이상 지연 시 기본 대본으로 자동 완료)",
    done: "완료",
  }
}

const SCRIPT_STEP_STALL_MS = 120_000
const DOWNLOAD_STEP_STALL_MS = 180_000
const SUBTITLE_REMOVAL_STALL_MS = 660_000

function analyzeStallMsForMode(mode: AutoEditAnalysisMode): number {
  switch (mode) {
    case "fast":
      return 120_000
    case "balanced":
      return 240_000
    case "precision":
      return 600_000
    default:
      return 180_000
  }
}

function analyzeStallMessage(mode: AutoEditAnalysisMode): string {
  const waitLabel =
    mode === "fast" ? "2분" : mode === "balanced" ? "4분" : "10분"
  return (
    `제품·장면 분석이 ${waitLabel} 이상 지연되고 있습니다.\n\n` +
    "① 페이지 새로고침 후 「편집 실행」을 다시 눌러 주세요.\n" +
    "② ShotForm 설정의 OpenAI API 키(shotform_openai_api_key)와 잔액을 확인해 주세요.\n" +
    "③ 영상 CDN 링크가 만료됐을 수 있으니 소스 검색에서 영상을 다시 추가해 주세요.\n" +
    "④ 로컬 npm run dev에서는 dev 서버를 재시작한 뒤, 가능하면 배포 사이트에서 다시 시도해 주세요."
  )
}

async function recoverStalledSubtitleRemoval(jobId: string): Promise<AutoEditJobResult | null> {
  try {
    const res = await fetch("/api/shotform/auto-edit/skip-subtitle-removal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    })
    const json = (await res.json().catch(() => ({}))) as AutoEditJobResult & { error?: string }
    if (!res.ok) return null
    return json
  } catch {
    return null
  }
}

async function recoverStalledScriptStep(jobId: string): Promise<AutoEditJobResult | null> {
  try {
    const res = await fetch("/api/shotform/auto-edit/finish-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    })
    const json = (await res.json().catch(() => ({}))) as AutoEditJobResult & { error?: string }
    if (!res.ok) return null
    return json
  } catch {
    return null
  }
}

async function pollAutoEditJob(
  jobId: string,
  onProgress?: (partial: AutoEditJobResult) => void,
  opts?: { analysisMode?: AutoEditAnalysisMode }
): Promise<AutoEditJobResult> {
  const analysisMode = opts?.analysisMode ?? "fast"
  const analyzeStallMs = analyzeStallMsForMode(analysisMode)
  let scriptStepSince: number | null = null
  let scriptRecoveryAttempted = false
  let downloadStepSince: number | null = null
  let analyzeStepSince: number | null = null
  let subtitleStepSince: number | null = null
  let subtitleRecoveryAttempted = false

  for (;;) {
    const res = await fetch(`/api/shotform/auto-edit?jobId=${encodeURIComponent(jobId)}`)
    const json = (await res.json().catch(() => ({}))) as AutoEditJobResult & { error?: string }
    if (!res.ok) {
      throw new Error(json.error || `작업 상태 조회 실패 (${res.status})`)
    }
    onProgress?.(json)
    if (json.step === "done" || json.step === "error") return json

    if (json.step === "download") {
      if (!downloadStepSince) downloadStepSince = Date.now()
      if (Date.now() - downloadStepSince >= DOWNLOAD_STEP_STALL_MS) {
        throw new Error(
          "서버 영상 다운로드가 3분 이상 지연되고 있습니다.\n\n" +
            "배포 환경에서는 브라우저 업로드 경로를 사용합니다. 페이지를 새로고침한 뒤 「편집 실행」을 다시 눌러 주세요. " +
            "반복되면 영상 CDN 링크가 만료됐을 수 있으니 소스 검색에서 영상을 다시 추가해 주세요."
        )
      }
    } else {
      downloadStepSince = null
    }

    if (json.step === "analyze") {
      if (!analyzeStepSince) analyzeStepSince = Date.now()
      if (Date.now() - analyzeStepSince >= analyzeStallMs) {
        throw new Error(analyzeStallMessage(analysisMode))
      }
    } else {
      analyzeStepSince = null
    }

    if (json.step === "subtitle_removal") {
      if (!subtitleStepSince) subtitleStepSince = Date.now()
      if (
        !subtitleRecoveryAttempted &&
        Date.now() - subtitleStepSince >= SUBTITLE_REMOVAL_STALL_MS
      ) {
        subtitleRecoveryAttempted = true
        const recovered = await recoverStalledSubtitleRemoval(jobId)
        if (recovered?.step === "done") {
          onProgress?.(recovered)
          return recovered
        }
        throw new Error(
          "Vmake 자막 제거가 11분 이상 지연되고 있습니다.\n\n" +
            "배포 서버 시간 제한으로 처리가 끊겼을 수 있습니다. " +
            "자막 제거를 OFF로 두고 짜집기를 다시 실행한 뒤, 편집 스튜디오 정보 탭에서 자막 제거를 시도해 주세요."
        )
      }
    } else {
      subtitleStepSince = null
      subtitleRecoveryAttempted = false
    }

    if (json.step === "script") {
      if (!scriptStepSince) scriptStepSince = Date.now()
      if (
        !scriptRecoveryAttempted &&
        Date.now() - scriptStepSince >= SCRIPT_STEP_STALL_MS
      ) {
        scriptRecoveryAttempted = true
        const recovered = await recoverStalledScriptStep(jobId)
        if (recovered?.step === "done") {
          onProgress?.(recovered)
          return recovered
        }
      }
    } else {
      scriptStepSince = null
      scriptRecoveryAttempted = false
    }

    await new Promise((r) => setTimeout(r, 2000))
  }
}

function shotformOpenAIKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_openai_api_key") || "").trim()
}

function shotformVmakeKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_vmake_api_key") || "").trim()
}

function shotformVmakeSecretKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_vmake_secret_access_key") || "").trim()
}

export function MvpAutoEditDialog({
  open,
  onOpenChange,
  picks,
  projectId,
  projectName,
  sourceKeywords = [],
  onPipelineComplete,
  onPicksUpdated,
  onStudioReady,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  picks: AutoEditPick[]
  projectId: string
  projectName?: string
  /** 1단계 사용자 입력 키워드 */
  sourceKeywords?: string[]
  onPicksUpdated?: (picks: AutoEditPick[]) => void
  onPipelineComplete?: (args: { targetDuration: AutoEditTargetDuration }) => void
  /** 짜집기 완료 → MVP 내 TTS·자막 스튜디오 */
  onStudioReady?: (args: {
    result: AutoEditJobResult
    videoBlobUrl: string | null
    videoBlob: Blob | null
  }) => void
}) {
  const [targetDuration, setTargetDuration] = useState<AutoEditTargetDuration>(30)
  const [analysisMode, setAnalysisMode] = useState<AutoEditAnalysisMode>(AUTO_EDIT_ANALYSIS_MODE_DEFAULT)
  const [removeChineseSubtitles, setRemoveChineseSubtitles] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AutoEditJobResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [downloadHint, setDownloadHint] = useState("")
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const previewBlobRef = useRef<string | null>(null)
  const picksKey = picks.map((p) => p.key).join("|")

  const revokePreviewBlob = useCallback(() => {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current)
      previewBlobRef.current = null
    }
    setPreviewBlobUrl(null)
  }, [])

  useEffect(() => () => revokePreviewBlob(), [revokePreviewBlob])

  const fetchResultMp4 = useCallback(
    async (_downloadUrl: string, jobId: string) => {
      const metaUrl = autoEditDownloadUrl(jobId, { mode: "url" })
      let lastErr: Error | null = null

      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt))
        try {
          const metaRes = await fetch(metaUrl, { cache: "no-store" })
          const meta = (await metaRes.json().catch(() => ({}))) as {
            url?: string
            kind?: "supabase" | "api"
            error?: string
          }
          if (!metaRes.ok || !meta.url) {
            const msg = meta.error || `재생 URL 조회 실패 (${metaRes.status})`
            if (metaRes.status === 404 && attempt < 3) {
              lastErr = new Error(msg)
              continue
            }
            throw new Error(msg)
          }

          if (meta.kind === "api") {
            const res = await fetch(meta.url, { cache: "no-store" })
            if (!res.ok) throw new Error(`결과 MP4 조회 실패 (${res.status})`)
            const blob = await res.blob()
            await assertPreviewMp4Blob(blob)
            if (projectId && jobId) await saveMvpEditMp4(projectId, jobId, blob)
            revokePreviewBlob()
            const objectUrl = URL.createObjectURL(blob)
            previewBlobRef.current = objectUrl
            setPreviewBlobUrl(objectUrl)
            return { url: objectUrl, blob }
          }

          revokePreviewBlob()
          previewBlobRef.current = meta.url
          setPreviewBlobUrl(meta.url)

          let blob: Blob | null = null
          try {
            const res = await fetch(meta.url, { cache: "no-store" })
            if (res.ok) {
              const cached = await res.blob()
              if (cached.size >= 50_000) {
                await assertPreviewMp4Blob(cached)
                blob = cached
                if (projectId && jobId) await saveMvpEditMp4(projectId, jobId, cached)
              }
            }
          } catch {
            /* Storage CORS — video src 직접 재생으로 충분 */
          }

          return { url: meta.url, blob }
        } catch (e) {
          lastErr = e instanceof Error ? e : new Error(String(e))
          if (attempt < 3 && /failed to fetch|network|load/i.test(lastErr.message)) continue
          throw lastErr
        }
      }
      throw lastErr ?? new Error("결과 MP4 조회 실패")
    },
    [revokePreviewBlob, projectId]
  )

  const run = useCallback(async () => {
    const openaiApiKey = shotformOpenAIKey()
    if (!openaiApiKey) {
      setErr("OpenAI API 키(shotform_openai_api_key)를 설정해 주세요.")
      return
    }
    const vmakeApiKey = shotformVmakeKey()
    const vmakeSecretAccessKey = shotformVmakeSecretKey()
    const doRemoveChineseSubtitles =
      removeChineseSubtitles && Boolean(vmakeApiKey && vmakeSecretAccessKey)
    if (!picks.length) {
      setErr("선택된 영상이 없습니다.")
      return
    }
    setLoading(true)
    setErr(null)
    setDownloadHint("")
    revokePreviewBlob()

    let completed = false
    try {
      for (let usableRetry = 0; usableRetry <= AUTO_EDIT_USABLE_VIDEO_MAX_RETRIES; usableRetry++) {
        if (usableRetry > 0) {
          setErr(null)
          setDownloadHint(
            `쓸 수 있는 영상을 찾지 못했습니다. 자동 재시도 ${usableRetry}/${AUTO_EDIT_USABLE_VIDEO_MAX_RETRIES}…`
          )
          setResult({ jobId: "", step: "download", videoCount: picks.length })
          await new Promise((r) => setTimeout(r, 1200 * usableRetry))
        } else {
          setResult({ jobId: "", step: "download", videoCount: picks.length })
        }

        try {
          setDownloadHint(
            usableRetry > 0
              ? `영상 URL 다시 확인 중… (재시도 ${usableRetry}/${AUTO_EDIT_USABLE_VIDEO_MAX_RETRIES})`
              : "선택 영상 URL 확인·갱신 중…"
          )
          const { picks: nextPicks, errors: refreshErrors } = await refreshExpiredMvpEditPicks(
            picks,
            (msg) => setDownloadHint(msg)
          )

          if (refreshErrors.length === picks.length) {
            throw new Error(refreshErrors.join("\n\n"))
          }

          if (onPicksUpdated && nextPicks.some((p, i) => p.videoUrl !== picks[i]?.videoUrl)) {
            onPicksUpdated(nextPicks)
          }

          const videos = toAutoEditVideoInputs(nextPicks)
          const preJobId = crypto.randomUUID()
          let clientVideoMeta: Record<
            string,
            { duration: number; keyframeDataUrl?: string; timeSec?: number }
          > | undefined
          let prefetchedBlobs: Record<string, Blob> | undefined
          if (analysisMode !== "precision") {
            setDownloadHint("브라우저에서 키프레임·길이 미리 추출 중…")
            const extracted = await extractClientVideoMetaForPicks(nextPicks, (msg) =>
              setDownloadHint(msg)
            )
            if (Object.keys(extracted.meta).length > 0) clientVideoMeta = extracted.meta
            if (Object.keys(extracted.blobs).length > 0) prefetchedBlobs = extracted.blobs
          }

          const allMetaReady =
            analysisMode !== "precision" &&
            clientVideoMeta &&
            nextPicks.every((p) => clientVideoMeta![p.video_id]?.keyframeDataUrl)

          const allHaveDuration =
            analysisMode === "fast" &&
            clientVideoMeta &&
            nextPicks.every((p) => (clientVideoMeta![p.video_id]?.duration ?? 0) > 0)

          const skipBrowserUploadForFastAnalyze = Boolean(allHaveDuration)

          let sourcesPreUploaded = false
          if (!allMetaReady && !skipBrowserUploadForFastAnalyze) {
            setDownloadHint("브라우저에서 영상을 받아 서버에 전달 중… (CDN 우회)")
            await uploadAutoEditSourcesFromBrowser(
              preJobId,
              nextPicks,
              (msg) => setDownloadHint(msg),
              prefetchedBlobs
            )
            sourcesPreUploaded = true
          }

          setDownloadHint("짜집기 작업 시작 중…")
          const res = await fetch("/api/shotform/auto-edit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videos,
              targetDuration,
              openaiApiKey,
              vmakeApiKey: vmakeApiKey || undefined,
              vmakeSecretAccessKey: vmakeSecretAccessKey || undefined,
              removeChineseSubtitles: doRemoveChineseSubtitles,
              scriptTopic: projectName?.trim() || undefined,
              sourceKeywords: sourceKeywords.filter(Boolean),
              analysisMode,
              clientVideoMeta,
              clientJobId: preJobId,
              sourcesPreUploaded,
            }),
          })
          const started = (await res.json().catch(() => ({}))) as AutoEditJobResult & {
            error?: string
          }
          if (!res.ok || !started.jobId) {
            const startErr = started.error || "자동 편집 시작 실패"
            if (
              isAutoEditNoUsableVideoError(startErr) &&
              usableRetry < AUTO_EDIT_USABLE_VIDEO_MAX_RETRIES
            ) {
              continue
            }
            setErr(startErr)
            setResult(started.step ? started : { jobId: "", step: "error", error: started.error })
            break
          }

          const hints = stepHintsForMode(analysisMode, doRemoveChineseSubtitles)
          const json = await pollAutoEditJob(
            started.jobId,
            (partial) => {
              setResult(partial)
              setDownloadHint(hints[partial.step] || "짜집기 진행 중…")
            },
            { analysisMode }
          )
          setResult(json)
          if (json.step === "error") {
            const failMsg = json.error || "자동 편집 실패"
            if (
              isAutoEditNoUsableVideoError(failMsg) &&
              usableRetry < AUTO_EDIT_USABLE_VIDEO_MAX_RETRIES
            ) {
              continue
            }
            setErr(failMsg)
            break
          }
          if (json.script || json.editPlan || json.step === "done" || json.downloadUrl) {
            onPipelineComplete?.({ targetDuration })
          }

          const hasScript = Boolean(json.script || json.editPlan)
          const canOpenStudio = json.step === "done" || hasScript

          if (json.renderSkipped) {
            setErr(json.renderSkipReason || "짜집기 MP4 렌더가 완료되지 않았습니다. 다시 실행해 주세요.")
            break
          }

          let videoBlobUrl: string | null = null
          let videoBlob: Blob | null = null
          const mp4DownloadUrl =
            json.downloadUrl || (json.jobId ? autoEditDownloadUrl(json.jobId) : "")
          if (mp4DownloadUrl && json.jobId) {
            setDownloadHint("결과 MP4 불러오는 중…")
            try {
              const mp4 = await fetchResultMp4(mp4DownloadUrl, json.jobId)
              videoBlobUrl = mp4.url
              videoBlob = mp4.blob
            } catch (mp4Err) {
              const detail = mp4Err instanceof Error ? mp4Err.message : ""
              setErr(
                "짜집기·대본은 완료됐지만 결과 MP4를 불러오지 못했습니다.\n\n" +
                  (detail ? `${detail}\n\n` : "") +
                  "편집기에서 다시 불러오거나 「편집 실행」을 한 번 더 눌러 주세요."
              )
            }
          } else if (canOpenStudio) {
            setErr("짜집기 MP4가 없습니다. 짜집기를 다시 실행해 주세요.")
            break
          }

          if (onStudioReady && canOpenStudio) {
            onStudioReady({
              result: { ...json, downloadUrl: mp4DownloadUrl || json.downloadUrl },
              videoBlobUrl: videoBlobUrl || null,
              videoBlob: videoBlob || null,
            })
          }
          completed = true
          break
        } catch (attemptErr) {
          const msg = formatShotformFetchError(attemptErr)
          if (
            isAutoEditNoUsableVideoError(msg) &&
            usableRetry < AUTO_EDIT_USABLE_VIDEO_MAX_RETRIES
          ) {
            continue
          }
          setErr(msg)
          break
        }
      }
    } finally {
      setLoading(false)
      if (completed) setDownloadHint("")
    }
  }, [
    picks,
    targetDuration,
    analysisMode,
    removeChineseSubtitles,
    revokePreviewBlob,
    fetchResultMp4,
    projectId,
    projectName,
    sourceKeywords,
    onPipelineComplete,
    onPicksUpdated,
    onStudioReady,
  ])

  useEffect(() => {
    revokePreviewBlob()
    setResult(null)
    setErr(null)
  }, [picksKey, targetDuration, analysisMode, revokePreviewBlob])

  const activeStep = result?.step ?? (loading ? "download" : "download")
  const doneIdx = stepIndex(activeStep)
  const analyses = result?.analyses?.length ? result.analyses : result?.analysis ? [result.analysis] : []
  const planTotal =
    result?.editPlan ? editPlanTotalOutputSeconds(result.editPlan) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-white/10 bg-slate-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Scissors className="h-4 w-4 text-violet-400" />
            AI 짜집기 자동 편집
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {picks.length}개 영상 선택됨 · 목표 {targetDuration}초 쇼츠
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-1 rounded-lg border border-white/10 bg-black/30 p-2 text-[11px] text-slate-400">
          {picks.map((p) => (
            <li key={p.key} className="line-clamp-1">
              <span className="text-violet-300">{p.video_id}</span> · {p.title}
            </li>
          ))}
        </ul>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">분석 모드</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {AUTO_EDIT_ANALYSIS_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={loading}
                  onClick={() => setAnalysisMode(opt.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition",
                    analysisMode === opt.id
                      ? "border-violet-500/60 bg-violet-500/15 ring-1 ring-violet-500/40"
                      : "border-white/10 bg-black/30 hover:border-white/20"
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      analysisMode === opt.id ? "text-violet-200" : "text-slate-200"
                    )}
                  >
                    {opt.label}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{opt.hint}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">목표 쇼츠 길이</p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={targetDuration === d ? "default" : "outline"}
                  className={cn(
                    "h-8 min-w-[3rem]",
                    targetDuration === d
                      ? studio.btnSegmentActive
                      : "border-white/15 bg-black/40 text-slate-300"
                  )}
                  disabled={loading}
                  onClick={() => setTargetDuration(d)}
                >
                  {d}초
                </Button>
              ))}
            </div>
          </div>

          <div
            className={cn(
              "rounded-lg border px-3 py-2.5",
              removeChineseSubtitles
                ? "border-amber-500/30 bg-amber-950/15"
                : "border-white/10 bg-black/30"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="mvp-remove-cn-subtitles" className="cursor-pointer text-xs text-slate-200">
                  Vmake AI 중국어 자막 제거
                </Label>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  짜집기(ffmpeg 렌더)가 끝난 합성 영상 1개에만 적용됩니다.
                </p>
              </div>
              <Switch
                id="mvp-remove-cn-subtitles"
                checked={removeChineseSubtitles}
                onCheckedChange={setRemoveChineseSubtitles}
                disabled={loading}
              />
            </div>
            {removeChineseSubtitles ? (
              <div className="mt-2 space-y-1 border-t border-amber-500/20 pt-2 text-[10px] leading-relaxed text-amber-100/90">
                <p className="font-medium text-amber-200">⏱ 처리 시간 안내</p>
                <p>{VMAKE_SUBTITLE_REMOVAL_SLOW_HINT}</p>
                <p className="text-amber-200/70">{VMAKE_SUBTITLE_REMOVAL_STALL_HINT}</p>
                <p className="text-amber-200/70">
                  배포 환경에서는 짜집기 후 <strong className="text-amber-100">정보 탭</strong>에서 자막 제거하는
                  것을 권장합니다.
                </p>
                {!shotformVmakeKey() || !shotformVmakeSecretKey() ? (
                  <p className="text-amber-300/80">
                    Vmake API 키가 설정되지 않아 실행 시 이 단계는 자동으로 건너뜁니다.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-[10px] text-slate-500">Vmake 키가 없으면 건너뜁니다.</p>
            )}
          </div>

          {!loading && !result?.editPlan ? (
            <p className="text-xs text-slate-500">
              선택한 {picks.length}개 영상에서 장면을 골라 <strong className="text-slate-300">짧은 컷으로 이어 붙입니다</strong>
              (ffmpeg). 같은 키워드 영상끼리는 화면이 비슷할 수 있어,{" "}
              <strong className="text-violet-200">서로 다른 영상·다른 장면</strong>을 고르면 믹스 차이가 큽니다.
            </p>
          ) : null}

          {downloadHint ? (
            <p
              className={cn(
                "text-xs leading-relaxed",
                result?.step === "subtitle_removal" ? "text-amber-200/90" : "text-violet-300"
              )}
            >
              {downloadHint}
            </p>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            className={cn(studio.btnPrimary, "w-full gap-2")}
            disabled={loading || !picks.length}
            onClick={() => void run()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "편집 진행 중…" : "편집 실행"}
          </Button>

          {err ? <p className="text-sm text-red-300">{err}</p> : null}

          {(loading || result) && (
            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <p className="mb-2 text-xs font-medium text-slate-400">진행 단계</p>
              <ul className="space-y-1.5">
                {STEPS.map((s, i) => {
                  const isError = result?.step === "error"
                  const isFullyDone = result?.step === "done"
                  const isActive = loading && i === doneIdx && !isFullyDone && !isError
                  const isCompleted =
                    !isError && (isFullyDone ? i <= doneIdx : i < doneIdx)
                  return (
                    <li
                      key={s.key}
                      className={cn(
                        "flex items-center gap-2 text-xs",
                        isCompleted
                          ? "text-emerald-300"
                          : isActive
                            ? "text-violet-300"
                            : "text-slate-600"
                      )}
                    >
                      {isActive ? (
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                      ) : isCompleted ? (
                        <Check className="h-3 w-3 shrink-0 stroke-[2.5]" aria-hidden />
                      ) : (
                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                      )}
                      {s.label}
                    </li>
                  )
                })}
              </ul>
              {loading && result?.step === "subtitle_removal" && removeChineseSubtitles ? (
                <p className="mt-2 border-t border-amber-500/20 pt-2 text-[10px] leading-relaxed text-amber-100/80">
                  {VMAKE_SUBTITLE_REMOVAL_SLOW_HINT}
                </p>
              ) : null}
            </div>
          )}

          {result?.subtitleRemovalSkipped && result.subtitleRemovalWarning ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2 text-xs text-amber-100/90">
              <p className="font-medium text-amber-200">Vmake 자막 제거 건너뜀</p>
              <p className="mt-1 text-[10px] leading-relaxed">{result.subtitleRemovalWarning}</p>
            </div>
          ) : null}

          {result?.excludedVideos?.length ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2 text-xs">
              <p className="font-medium text-amber-200">
                제외된 영상 ({result.excludedVideos.length}개) — 편집용 장면 없음
              </p>
              <ul className="mt-1 space-y-0.5 text-[10px] text-amber-100/80">
                {result.excludedVideos.map((x) => (
                  <li key={x.video_id} className="line-clamp-2">
                    {x.title}: {x.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result?.productAnalysis ? (
            <div className="rounded-lg border border-blue-500/20 bg-blue-950/10 p-2 text-xs">
              <p className="font-medium text-blue-200">{result.productAnalysis.productName}</p>
              <p className="mt-0.5 text-[10px] text-blue-100/70">
                {result.productAnalysis.category} ·{" "}
                {(result.mixInfo?.actualDuration ?? result.productAnalysis.videoDuration).toFixed(1)}s
              </p>
              <p className="mt-1 line-clamp-4 text-[10px] leading-relaxed text-slate-400">
                {result.productAnalysis.summary}
              </p>
              {result.productAnalysis.targetKeywords?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {result.productAnalysis.targetKeywords.slice(0, 5).map((kw) => (
                    <span
                      key={kw}
                      className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-500"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {result?.productAnalysis?.scenes?.length ? (
            <details open className="rounded-lg border border-violet-500/20 bg-violet-950/10 p-2 text-xs">
              <summary className="cursor-pointer font-medium text-violet-200">
                짜집기 장면 ({result.productAnalysis.scenes.length}구간)
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {result.productAnalysis.scenes.map((sc, i) => (
                  <li key={i} className="text-[10px] leading-relaxed text-slate-500">
                    {formatBenchmarkSceneCard(sc)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {result?.mixInfo?.picks?.length ? (
            <details open className="rounded-lg border border-orange-500/20 bg-orange-950/10 p-2 text-xs">
              <summary className="cursor-pointer text-orange-200">
                mix picks ({result.mixInfo.picks.length}컷 · {result.mixInfo.actualDuration}s)
              </summary>
              <ul className="mt-2 space-y-1">
                {result.mixInfo.picks.map((p, i) => (
                  <li key={i} className="text-[10px] text-slate-400">
                    <span className="text-orange-300">src{p.srcIndex}</span> {p.start}–{p.end}s · {p.reason}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {result?.editPlan ? (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/15 p-2 text-xs">
              <p className="mb-1 font-medium text-emerald-200">
                실제 편집 컷 {result.editPlan.edit_plan.length}개 · 소스{" "}
                {[...new Set(result.editPlan.edit_plan.map((s) => s.video_id))].length}개 영상 · 합계{" "}
                {planTotal != null ? `${Math.round(planTotal * 10) / 10}초` : "—"} / 목표{" "}
                {result.editPlan.target_duration}초
              </p>
              <p className="mb-1 text-[10px] text-slate-500">
                아래 구간마다 원본에서 잘라 이어 붙인 결과입니다. 한 소스만 쓰이면 비슷해 보일 수 있습니다.
              </p>
              <ul className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                {result.editPlan.edit_plan.map((seg, i) => (
                  <li key={i} className="line-clamp-1">
                    <span className="text-violet-400">{seg.video_id}</span>{" "}
                    {seg.source_start.toFixed(1)}–{seg.source_end.toFixed(1)}s →{" "}
                    {seg.output_start.toFixed(1)}–{seg.output_end.toFixed(1)}s · {seg.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {analyses.length > 0 ? (
            <details open className="rounded-lg border border-violet-500/20 bg-violet-950/10 p-2 text-xs">
              <summary className="cursor-pointer font-medium text-violet-200">
                장면 분석 ({analyses.length}개 영상) — 벤치마크 구간
              </summary>
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {analyses.map((a) => (
                  <li key={a.video_id}>
                    <p className="text-[10px] font-medium text-slate-400">{a.video_id}</p>
                    <ul className="mt-1 space-y-1">
                      {(a.visual_scenes ?? a.scenes).map((sc, i) => (
                        <li key={i} className="text-[10px] leading-relaxed text-slate-500">
                          <span className="text-violet-300">
                            {sc.start}–{sc.end}s
                          </span>{" "}
                          {stripShotLabelFromDescription(sc.description)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {result?.editPlan ? (
            <details className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
              <summary className="cursor-pointer text-slate-300">대본 순서 편집 지시서 JSON</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] text-slate-500">
                {JSON.stringify(result.editPlan, null, 2)}
              </pre>
            </details>
          ) : null}

          {result?.script?.bundle ? (
            <details open className="rounded-lg border border-violet-500/20 bg-violet-950/10 p-2 text-xs">
              <summary className="cursor-pointer text-violet-200">
                스크립트 · #{result.script.bundle.commentKeyword}
              </summary>
              <div className="mt-2 space-y-3">
                <div>
                  <p className="text-[10px] font-medium text-violet-300">conversion</p>
                  <pre className="mt-1 whitespace-pre-wrap text-[10px] text-slate-300">
                    {result.script.bundle.scripts.conversion}
                  </pre>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400">headcopies</p>
                  <ul className="mt-1 space-y-1">
                    {result.script.bundle.headcopies.map((hc, i) => (
                      <li key={i} className="text-[10px] text-slate-400">
                        {hc.join(" · ")}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400">sceneSubtitles (conversion)</p>
                  <ul className="mt-1 space-y-2">
                    {result.script.bundle.sceneSubtitles.conversion.map((block, i) => (
                      <li key={i} className="text-[10px] text-slate-400">
                        <span className="text-violet-400">
                          {block.start}–{block.end}s
                        </span>
                        <pre className="mt-0.5 whitespace-pre-wrap text-slate-300">{block.text}</pre>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          ) : null}

          {result?.script && !result.script.bundle ? (
            <details open className="rounded-lg border border-violet-500/20 bg-violet-950/10 p-2 text-xs">
              <summary className="cursor-pointer text-violet-200">장면맞춤 나레이션 (Scene Match)</summary>
              <ul className="mt-2 space-y-2">
                {result.script.script.map((line, i) => (
                  <li key={i} className="text-slate-300">
                    <span className="text-slate-500">
                      {line.start}–{line.end}s
                      {line.video_id ? ` · ${line.video_id}` : ""}
                    </span>{" "}
                    {line.text}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {result?.script?.bundle ? (
            <details className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
              <summary className="cursor-pointer text-slate-300">스크립트 JSON (벤치마크 형식)</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] text-slate-500">
                {JSON.stringify(
                  {
                    scripts: result.script.bundle.scripts,
                    headcopies: result.script.bundle.headcopies,
                    commentKeyword: result.script.bundle.commentKeyword,
                    sceneSubtitles: result.script.bundle.sceneSubtitles,
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          ) : null}

          {result?.renderSkipped ? (
            <p className="text-xs text-amber-300">{result.renderSkipReason}</p>
          ) : null}

          {result?.downloadUrl ? (
            <>
              {result.outputDuration ? (
                <p className="text-xs text-emerald-300">
                  렌더 완료 · 약 {Math.round(result.outputDuration * 10) / 10}초
                  {result.editPlan && result.outputDuration < result.editPlan.target_duration - 0.5
                    ? ` (목표 ${result.editPlan.target_duration}초)`
                    : ""}
                  {previewBlobUrl ? " · 미리보기 준비됨" : " · MP4 로딩 중…"}
                </p>
              ) : null}
              <Button
                type="button"
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500"
                disabled={!previewBlobUrl}
                onClick={() => {
                  if (!previewBlobUrl) return
                  const a = document.createElement("a")
                  a.href = previewBlobUrl
                  a.download = `shotform-mix_${result.jobId.slice(0, 8)}.mp4`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                }}
              >
                <Download className="h-4 w-4" />
                짜집기 MP4 다운로드
              </Button>
              <div className="overflow-hidden rounded-lg border border-white/10 bg-black">
                {previewBlobUrl ? (
                  <video
                    key={previewBlobUrl}
                    src={previewBlobUrl}
                    className="aspect-[9/16] w-full object-contain"
                    controls
                    playsInline
                    preload="auto"
                    onError={() => setErr("미리보기 재생 실패 — MP4를 다시 불러와 주세요.")}
                  />
                ) : (
                  <div className="flex aspect-[9/16] w-full items-center justify-center text-xs text-slate-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    MP4 불러오는 중…
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

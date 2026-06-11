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
import { saveMvpEditMp4 } from "@/lib/mvp-local-media-cache"
import {
  formatShotformFetchError,
  refreshExpiredMvpEditPicks,
} from "@/lib/shotform-mvp-pick-video-download"
import { extractClientVideoMetaForPicks } from "@/lib/shotform-client-video-meta"

const DURATIONS: AutoEditTargetDuration[] = [20, 30, 45, 60]

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
  fast: "Vision 분석 중… (고속: 브라우저 미리 분석·약 10~40초)",
  balanced: "키프레임 추출·Vision·장면 분석 중… (중간: 영상당 3~4장·약 1~3분)",
  precision: "영상별 심층 분석·mix 생성 중… (정밀: 영상당 8장·약 3~8분)",
}

function stepHintsForMode(mode: AutoEditAnalysisMode): Partial<Record<AutoEditJobResult["step"], string>> {
  return {
    download: "서버에서 원본 영상 다운로드 중…",
    subtitle_removal: "짜집기 완료 영상에서 중국어 자막 제거 중…",
    analyze: ANALYZE_STEP_HINTS[mode],
    mix: "영상 mix (picks) 생성 중…",
    edit_plan: mode === "precision" ? "짜집기 타임라인·컷별 Vision 캡션 중…" : "짜집기 타임라인 구성 중…",
    render: "ffmpeg 렌더 중…",
    script: "장면맞춤 나레이션 생성 중…",
    done: "완료",
  }
}

async function pollAutoEditJob(
  jobId: string,
  onProgress?: (partial: AutoEditJobResult) => void
): Promise<AutoEditJobResult> {
  for (;;) {
    const res = await fetch(`/api/shotform/auto-edit?jobId=${encodeURIComponent(jobId)}`)
    const json = (await res.json().catch(() => ({}))) as AutoEditJobResult & { error?: string }
    if (!res.ok) {
      throw new Error(json.error || `작업 상태 조회 실패 (${res.status})`)
    }
    onProgress?.(json)
    if (json.step === "done" || json.step === "error") return json
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
  onPipelineComplete,
  onPicksUpdated,
  onStudioReady,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  picks: AutoEditPick[]
  projectId: string
  projectName?: string
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
    async (downloadUrl: string, jobId: string) => {
      const res = await fetch(downloadUrl)
      if (!res.ok) {
        throw new Error(`결과 MP4 조회 실패 (${res.status}). 개발 서버 재시작 후 다시 시도해 주세요.`)
      }
      const blob = await res.blob()
      if (blob.size < 20_000) {
        throw new Error("결과 MP4 파일이 비어 있습니다.")
      }
      if (projectId && jobId) {
        await saveMvpEditMp4(projectId, jobId, blob)
      }
      revokePreviewBlob()
      const url = URL.createObjectURL(blob)
      previewBlobRef.current = url
      setPreviewBlobUrl(url)
      return { url, blob }
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
    setResult({ jobId: "", step: "download", videoCount: picks.length })

    try {
      setDownloadHint("선택 영상 URL 확인·갱신 중…")
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
      let clientVideoMeta: Record<
        string,
        { duration: number; keyframeDataUrl: string; timeSec: number }
      > | undefined
      if (analysisMode !== "precision") {
        setDownloadHint("브라우저에서 키프레임·길이 미리 추출 중…")
        const meta = await extractClientVideoMetaForPicks(nextPicks, (msg) => setDownloadHint(msg))
        if (Object.keys(meta).length > 0) clientVideoMeta = meta
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
          analysisMode,
          clientVideoMeta,
        }),
      })
      const started = (await res.json().catch(() => ({}))) as AutoEditJobResult & { error?: string }
      if (!res.ok || !started.jobId) {
        setErr(started.error || "자동 편집 시작 실패")
        setResult(started.step ? started : { jobId: "", step: "error", error: started.error })
        return
      }

      const hints = stepHintsForMode(analysisMode)
      const json = await pollAutoEditJob(started.jobId, (partial) => {
        setResult(partial)
        setDownloadHint(hints[partial.step] || "짜집기 진행 중…")
      })
      setResult(json)
      if (json.step === "error") {
        setErr(json.error || "자동 편집 실패")
        return
      }
      if (json.script || json.editPlan || json.step === "done" || json.downloadUrl) {
        onPipelineComplete?.({ targetDuration })
      }

      const hasScript = Boolean(json.script || json.editPlan)
      const canOpenStudio = json.step === "done" || hasScript

      let videoBlobUrl: string | null = null
      let videoBlob: Blob | null = null
      if (json.downloadUrl && json.jobId) {
        setDownloadHint("결과 MP4 불러오는 중…")
        try {
          const mp4 = await fetchResultMp4(json.downloadUrl, json.jobId)
          videoBlobUrl = mp4.url
          videoBlob = mp4.blob
        } catch (mp4Err) {
          const detail = mp4Err instanceof Error ? mp4Err.message : ""
          setErr(
            "짜집기·대본은 완료됐지만 결과 MP4를 불러오지 못했습니다.\n\n" +
              (detail ? `${detail}\n\n` : "") +
              "「편집 실행」을 한 번 더 누르거나, 편집기가 열렸다면 TTS·자막 단계를 이어가 주세요."
          )
          if (onStudioReady && canOpenStudio) {
            onStudioReady({ result: json, videoBlobUrl: null, videoBlob: null })
          }
          return
        }
      }

      if (onStudioReady && canOpenStudio) {
        onStudioReady({ result: json, videoBlobUrl, videoBlob })
      }
    } catch (e) {
      setErr(formatShotformFetchError(e))
    } finally {
      setLoading(false)
      setDownloadHint("")
    }
  }, [
    picks,
    targetDuration,
    analysisMode,
    removeChineseSubtitles,
    revokePreviewBlob,
    fetchResultMp4,
    projectId,
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

          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
            <div>
              <Label htmlFor="mvp-remove-cn-subtitles" className="cursor-pointer text-xs text-slate-200">
                Vmake AI 중국어 자막 제거
              </Label>
              <p className="mt-0.5 text-[10px] text-slate-500">
                짜집기(ffmpeg 렌더)가 끝난 합성 영상 1개에만 적용됩니다. Vmake 키가 없으면 건너뜁니다.
              </p>
            </div>
            <Switch
              id="mvp-remove-cn-subtitles"
              checked={removeChineseSubtitles}
              onCheckedChange={setRemoveChineseSubtitles}
              disabled={loading}
            />
          </div>

          {!loading && !result?.editPlan ? (
            <p className="text-xs text-slate-500">
              선택한 {picks.length}개 영상에서 장면을 골라 <strong className="text-slate-300">짧은 컷으로 이어 붙입니다</strong>
              (ffmpeg). 같은 키워드 영상끼리는 화면이 비슷할 수 있어,{" "}
              <strong className="text-violet-200">서로 다른 영상·다른 장면</strong>을 고르면 믹스 차이가 큽니다.
            </p>
          ) : null}

          {downloadHint ? <p className="text-xs text-violet-300">{downloadHint}</p> : null}

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

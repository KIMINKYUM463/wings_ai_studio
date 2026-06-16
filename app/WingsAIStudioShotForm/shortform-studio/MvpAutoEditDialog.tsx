"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { Input } from "@/components/ui/input"
import type {
  AutoEditAnalysisMode,
  AutoEditJobResult,
  AutoEditPick,
  AutoEditTargetDuration,
  ClientVideoMetaEntry,
} from "@/lib/shotform-auto-edit-types"
import {
  AUTO_EDIT_ANALYSIS_MODE_DEFAULT,
  AUTO_EDIT_ANALYSIS_MODE_OPTIONS,
  AUTO_EDIT_DURATION_OPTIONS,
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
import { uploadAutoEditSourcesToLocalDir } from "@/lib/shotform-auto-edit-client-local-source-upload"
import {
  DEFAULT_LOCAL_COMPANION_URL,
  ensureLocalCompanionRunning,
  LOCAL_COMPANION_URL_STORAGE_KEY,
  probeLocalCompanion,
  resolveLocalCompanionMp4,
  resolveLocalCompanionUrl,
  uploadAutoEditSourcesToCompanion,
} from "@/lib/shotform-local-companion-client"
import type { AutoEditRenderMode } from "@/lib/shotform-local-render-dir"
import { isAutoEditNoUsableVideoError } from "@/lib/shotform-auto-edit-errors"
import {
  VMAKE_SUBTITLE_REMOVAL_SLOW_HINT,
  VMAKE_SUBTITLE_REMOVAL_STALL_HINT,
} from "@/lib/shotform-vmake-subtitle-removal"
import { estimateAutoEditAnalyzeSeconds } from "@/lib/shotform-scene-understanding"


/** 목표 쇼츠 길이 — 5초 단위 슬라이더 인덱스 */
function durationSliderIndex(duration: AutoEditTargetDuration): number {
  const idx = AUTO_EDIT_DURATION_OPTIONS.indexOf(duration)
  return idx >= 0 ? idx : AUTO_EDIT_DURATION_OPTIONS.indexOf(30)
}

/** 「쓸수있는 영상 없음」 간헐 오류 — 자동 재시도 횟수 (총 1+2=3회 시도) */
const AUTO_EDIT_USABLE_VIDEO_MAX_RETRIES = 2
const LOCAL_WORK_DIR_STORAGE_KEY = "shotform_local_work_dir"

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
  fast: "행동 기반 Vision 분석 중… (URL 1개·CDN: 보통 60~120초)",
  precision: "최대 2분 구간 심층 행동 분석 중… (약 3~10분)",
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
    render: "ffmpeg 렌더 중… (14분 이상 지연 시 MP4 없이 나레이션까지 자동 완료)",
    script:
      mode === "precision"
        ? "정밀 대본 — 구조 분석·후킹·구매 전환 검증 중… (약 1~2분)"
        : "장면맞춤 나레이션 생성 중… (2분 이상 지연 시 기본 대본으로 자동 완료)",
    done: "완료",
  }
}

const SCRIPT_STEP_STALL_MS = 120_000
const SCRIPT_STEP_STALL_PRECISION_MS = 150_000
const DOWNLOAD_STEP_STALL_MS = 180_000
const RENDER_STEP_STALL_MS = 840_000
const SUBTITLE_REMOVAL_STALL_MS = 660_000

function analyzeStallMsForMode(mode: AutoEditAnalysisMode): number {
  switch (mode) {
    case "fast":
      return 120_000
    case "precision":
      return 600_000
    default:
      return 180_000
  }
}

function analyzeStallMessage(mode: AutoEditAnalysisMode): string {
  const waitLabel = mode === "fast" ? "2분" : "10분"
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

async function recoverStalledRenderStep(
  jobId: string,
  opts?: { openaiApiKey?: string; analysisMode?: AutoEditAnalysisMode; scriptTopic?: string }
): Promise<AutoEditJobResult | null> {
  try {
    const res = await fetch("/api/shotform/auto-edit/skip-render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        openaiApiKey: opts?.openaiApiKey || undefined,
        analysisMode: opts?.analysisMode,
        scriptTopic: opts?.scriptTopic,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as AutoEditJobResult & { error?: string }
    if (!res.ok) return null
    return json
  } catch {
    return null
  }
}

function scriptStallMsForMode(mode: AutoEditAnalysisMode): number {
  return mode === "precision" ? SCRIPT_STEP_STALL_PRECISION_MS : SCRIPT_STEP_STALL_MS
}

async function pollAutoEditJob(
  jobId: string,
  onProgress?: (partial: AutoEditJobResult) => void,
  opts?: {
    analysisMode?: AutoEditAnalysisMode
    openaiApiKey?: string
    scriptTopic?: string
  }
): Promise<AutoEditJobResult> {
  const analysisMode = opts?.analysisMode ?? "fast"
  const analyzeStallMs = analyzeStallMsForMode(analysisMode)
  const scriptStallMs = scriptStallMsForMode(analysisMode)
  let scriptStepSince: number | null = null
  let scriptRecoveryAttempted = false
  let downloadStepSince: number | null = null
  let analyzeStepSince: number | null = null
  let renderStepSince: number | null = null
  let renderRecoveryAttempted = false
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

    if (json.step === "render") {
      if (!renderStepSince) renderStepSince = Date.now()
      if (!renderRecoveryAttempted && Date.now() - renderStepSince >= RENDER_STEP_STALL_MS) {
        renderRecoveryAttempted = true
        const recovered = await recoverStalledRenderStep(jobId, {
          openaiApiKey: opts?.openaiApiKey,
          analysisMode,
          scriptTopic: opts?.scriptTopic,
        })
        if (recovered?.step === "done") {
          onProgress?.(recovered)
          return recovered
        }
        throw new Error(
          "ffmpeg 렌더가 14분 이상 지연되고 있습니다.\n\n" +
            "배포 서버 시간 제한으로 렌더가 끊겼을 수 있습니다. " +
            "페이지를 새로고침한 뒤 「편집 실행」을 다시 눌러 주세요. " +
            "반복되면 영상 CDN 링크가 만료됐을 수 있으니 소스 검색에서 영상을 다시 추가해 주세요."
        )
      }
    } else {
      renderStepSince = null
      renderRecoveryAttempted = false
    }

    if (json.step === "script") {
      if (!scriptStepSince) scriptStepSince = Date.now()
      if (
        !scriptRecoveryAttempted &&
        Date.now() - scriptStepSince >= scriptStallMs
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
  const [renderMode, setRenderMode] = useState<AutoEditRenderMode>("server")
  const [localWorkDir, setLocalWorkDir] = useState("")
  const [localRenderCap, setLocalRenderCap] = useState<{
    available: boolean
    defaultWorkDir?: string
    reason?: string
    layout?: Record<string, string>
    companionRecommended?: boolean
    defaultCompanionUrl?: string
  } | null>(null)
  const [companionOnline, setCompanionOnline] = useState(false)
  const [companionUrl, setCompanionUrl] = useState(DEFAULT_LOCAL_COMPANION_URL)
  const [companionHint, setCompanionHint] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AutoEditJobResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [downloadHint, setDownloadHint] = useState("")
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const previewBlobRef = useRef<string | null>(null)
  const picksKey = picks.map((p) => p.key).join("|")

  const analyzeEta = useMemo(
    () =>
      estimateAutoEditAnalyzeSeconds({
        pickCount: Math.max(1, picks.length),
        maxSourceDurationSec: 90,
        mode: analysisMode,
        hasClientKeyframe: false,
        skipServerDownload: false,
      }),
    [picks.length, analysisMode]
  )

  const revokePreviewBlob = useCallback(() => {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current)
      previewBlobRef.current = null
    }
    setPreviewBlobUrl(null)
  }, [])

  useEffect(() => () => revokePreviewBlob(), [revokePreviewBlob])

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_WORK_DIR_STORAGE_KEY)
    if (saved) setLocalWorkDir(saved)
    const savedCompanion = localStorage.getItem(LOCAL_COMPANION_URL_STORAGE_KEY)
    if (savedCompanion) setCompanionUrl(savedCompanion)
  }, [])

  useEffect(() => {
    if (!open) return
    const host = window.location.hostname
    const isLocalHost = host === "localhost" || host === "127.0.0.1"

    void (async () => {
      const companion = await probeLocalCompanion(companionUrl)
      if (companion.ok && companion.ffmpeg) {
        setCompanionOnline(true)
        setCompanionHint(null)
        if (companion.defaultWorkDir) {
          setLocalWorkDir((prev) => prev.trim() || companion.defaultWorkDir || "")
        }
      } else {
        setCompanionOnline(false)
        const ensured = await ensureLocalCompanionRunning({
          companionUrl,
          onProgress: (msg) => setCompanionHint(msg),
        })
        if (ensured.ok && ensured.ffmpeg) {
          setCompanionOnline(true)
          setCompanionHint(null)
          if (ensured.defaultWorkDir) {
            setLocalWorkDir((prev) => prev.trim() || ensured.defaultWorkDir || "")
          }
        } else {
          setCompanionHint(ensured.error || companion.error || null)
        }
      }

      if (isLocalHost) {
        try {
          const r = await fetch("/api/shotform/auto-edit/local-capabilities")
          const json = (await r.json()) as {
            available?: boolean
            defaultWorkDir?: string
            reason?: string
            layout?: Record<string, string>
            companionRecommended?: boolean
            defaultCompanionUrl?: string
          }
          setLocalRenderCap({
            available: Boolean(json.available),
            defaultWorkDir: json.defaultWorkDir,
            reason: json.reason,
            layout: json.layout,
            companionRecommended: json.companionRecommended,
            defaultCompanionUrl: json.defaultCompanionUrl,
          })
          if (json.defaultWorkDir) {
            setLocalWorkDir((prev) => prev.trim() || json.defaultWorkDir || "")
          }
        } catch {
          setLocalRenderCap({ available: false, reason: "로컬 렌더 상태를 확인하지 못했습니다." })
        }
      } else {
        setLocalRenderCap({
          available: false,
          companionRecommended: true,
          defaultCompanionUrl: DEFAULT_LOCAL_COMPANION_URL,
          reason: "배포 사이트 — PC에서 npm run shotform:local-agent 실행 후 로컬 렌더 선택",
        })
      }
    })()
  }, [open, companionUrl])

  const localDevFfmpegAvailable = Boolean(localRenderCap?.available)
  const localRenderAvailable = companionOnline || localDevFfmpegAvailable

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
          let clientVideoMeta: Record<string, ClientVideoMetaEntry> | undefined
          let prefetchedBlobs: Record<string, Blob> | undefined

          if (renderMode === "local") {
            const workDir = localWorkDir.trim()
            if (!workDir) {
              throw new Error("로컬 작업 폴더 경로를 입력해 주세요.")
            }
            setDownloadHint("로컬 에이전트 연결·시작 중…")
            const ensured = await ensureLocalCompanionRunning({
              companionUrl,
              onProgress: (msg) => setDownloadHint(msg),
            })
            if (!ensured.ok || !ensured.ffmpeg) {
              throw new Error(
                ensured.error ||
                  "로컬 에이전트를 시작하지 못했습니다.\n\n" +
                    "프로젝트 폴더에서 한 번만 실행: npm run shotform:install-agent\n" +
                    "(Windows 시작 프로그램 등록 + 자동 기동)"
              )
            }
            setCompanionOnline(true)
            localStorage.setItem(LOCAL_WORK_DIR_STORAGE_KEY, workDir)
            setDownloadHint("로컬 작업 폴더 소스 영상 확인·저장 중…")
            await uploadAutoEditSourcesToCompanion(
              companionUrl,
              workDir,
              nextPicks,
              (msg) => setDownloadHint(msg),
              prefetchedBlobs
            )
          }

          setDownloadHint(
            analysisMode === "precision"
              ? "정밀 분석용 — 브라우저에서 영상·키프레임 준비 중…"
              : "브라우저에서 키프레임·길이 미리 추출 중…"
          )
          const extracted = await extractClientVideoMetaForPicks(
            nextPicks,
            (msg) => setDownloadHint(msg),
            analysisMode === "precision"
              ? { precision: true, localWorkDir: renderMode === "local" ? localWorkDir.trim() : undefined, companionUrl }
              : renderMode === "local"
                ? { localWorkDir: localWorkDir.trim(), companionUrl }
                : undefined
          )
          if (Object.keys(extracted.meta).length > 0) clientVideoMeta = extracted.meta
          if (Object.keys(extracted.blobs).length > 0) prefetchedBlobs = extracted.blobs

          if (analysisMode === "precision") {
            const missingPrecision = nextPicks.filter(
              (p) => (clientVideoMeta?.[p.video_id]?.precisionKeyframes?.length ?? 0) < 6
            )
            if (missingPrecision.length > 0) {
              throw new Error(
                [
                  "정밀 분석용 브라우저 키프레임 캡처에 실패했습니다.",
                  ...missingPrecision.map(
                    (p) =>
                      `· ${p.title || p.video_id}: 영상 링크가 만료됐거나 재생이 차단됐을 수 있습니다.`
                  ),
                  "소스를 다시 추가한 뒤 정밀 모드로 실행해 주세요.",
                ].join("\n")
              )
            }
          }

          if (analysisMode === "fast" && renderMode === "local") {
            const missingMeta = nextPicks.filter(
              (p) => (clientVideoMeta?.[p.video_id]?.duration ?? 0) <= 0
            )
            if (missingMeta.length > 0) {
              throw new Error(
                [
                  "로컬 렌더 — 브라우저에서 영상 길이를 읽지 못했습니다.",
                  ...missingMeta.map(
                    (p) => `· ${p.title || p.video_id}: 작업 폴더 sources/ 또는 CDN 확인`
                  ),
                  "로컬 에이전트가 실행 중인지, 작업 폴더 경로가 맞는지 확인해 주세요.",
                ].join("\n")
              )
            }
          }

          const allMetaReady =
            analysisMode === "fast" &&
            clientVideoMeta &&
            nextPicks.every((p) => clientVideoMeta![p.video_id]?.keyframeDataUrl)

          const allHaveDuration =
            analysisMode === "fast" &&
            clientVideoMeta &&
            nextPicks.every((p) => (clientVideoMeta![p.video_id]?.duration ?? 0) > 0)

          const skipBrowserUploadForFastAnalyze = Boolean(allHaveDuration)
          const hasPrefetchedBlobs = Object.keys(prefetchedBlobs ?? {}).length > 0
          // 고속: 브라우저 메타만으로 분석하면 서버 CDN 다운로드를 생략함 → 렌더(Cloud Run)는
          // 프록시 없이 CDN 직접 접근이라 만료·차단에 취약. 저장 프로젝트 재실행도 Supabase 업로드 필수.
          const requireBrowserUploadForRender =
            renderMode === "server" ||
            (analysisMode === "fast" && Boolean(allHaveDuration))

          let sourcesPreUploaded = false
          const requireBrowserUpload =
            analysisMode === "precision" ||
            hasPrefetchedBlobs ||
            requireBrowserUploadForRender ||
            (!allMetaReady && !skipBrowserUploadForFastAnalyze)

          if (renderMode === "local") {
            /* 소스는 위에서 companion/sources 에 먼저 저장됨 */
          } else if (requireBrowserUpload) {
            setDownloadHint(
              analysisMode === "precision"
                ? "정밀 분석 — 브라우저에서 영상을 서버에 전달 중…"
                : requireBrowserUploadForRender
                  ? "렌더용 — 브라우저에서 영상을 서버에 전달 중… (CDN 만료·저장 프로젝트 재실행 대비)"
                  : "브라우저에서 영상을 받아 서버에 전달 중… (CDN 우회)"
            )
            await uploadAutoEditSourcesFromBrowser(
              preJobId,
              nextPicks,
              (msg) => setDownloadHint(msg),
              prefetchedBlobs,
              clientVideoMeta
            )
            sourcesPreUploaded = true
          }

          const clientVideoMetaForApi =
            analysisMode === "precision" && sourcesPreUploaded && clientVideoMeta
              ? Object.fromEntries(
                  Object.entries(clientVideoMeta).map(([id, meta]) => [
                    id,
                    { duration: meta.duration, timeSec: meta.timeSec },
                  ])
                )
              : clientVideoMeta

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
              clientVideoMeta: clientVideoMetaForApi,
              clientJobId: preJobId,
              sourcesPreUploaded,
              renderMode,
              localWorkDir: renderMode === "local" ? localWorkDir.trim() : undefined,
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
          let json = await pollAutoEditJob(
            started.jobId,
            (partial) => {
              setResult(partial)
              setDownloadHint(hints[partial.step] || "짜집기 진행 중…")
            },
            {
              analysisMode,
              openaiApiKey,
              scriptTopic: projectName?.trim() || undefined,
            }
          )
          let companionVideoBlob: Blob | null = null
          let companionVideoUrl: string | null = null
          const workDirForLocal = (
            localWorkDir.trim() ||
            json.localWorkDir ||
            (typeof window !== "undefined"
              ? localStorage.getItem(LOCAL_WORK_DIR_STORAGE_KEY)?.trim()
              : "") ||
            ""
          ).trim()
          const shouldTryLocalMp4 =
            renderMode === "local" &&
            Boolean(json.editPlan?.edit_plan?.length) &&
            Boolean(workDirForLocal && json.jobId) &&
            (json.localRenderPending || !json.downloadUrl || json.renderSkipped)

          if (shouldTryLocalMp4 && !companionVideoBlob) {
            setDownloadHint(
              json.renderSkipped ? "서버 렌더 실패 — 로컬 에이전트에서 재렌더 중…" : "로컬 MP4 렌더 중…"
            )
            try {
              const { blob, localOutputPath: localOut } = await resolveLocalCompanionMp4({
                localWorkDir: workDirForLocal,
                jobId: json.jobId,
                editPlan: json.editPlan,
                localRenderPending: json.localRenderPending ?? json.renderSkipped,
                companionUrl,
                onProgress: (msg) => setDownloadHint(msg),
              })
              await assertPreviewMp4Blob(blob)
              if (projectId && json.jobId) await saveMvpEditMp4(projectId, json.jobId, blob)
              revokePreviewBlob()
              const objectUrl = URL.createObjectURL(blob)
              previewBlobRef.current = objectUrl
              setPreviewBlobUrl(objectUrl)
              companionVideoBlob = blob
              companionVideoUrl = objectUrl
              json = {
                ...json,
                localRenderPending: false,
                renderSkipped: false,
                renderSkipReason: undefined,
                renderMode: "local",
                localWorkDir: workDirForLocal,
                localOutputPath: localOut,
              }
            } catch (localRenderErr) {
              if (!json.renderSkipped) {
                const detail = localRenderErr instanceof Error ? localRenderErr.message : ""
                throw new Error(
                  detail ||
                    "로컬 에이전트 렌더가 완료되지 않았습니다. npm run shotform:install-agent 후 다시 시도해 주세요."
                )
              }
            }
          } else if (json.localRenderPending && renderMode === "local" && !companionVideoBlob) {
            throw new Error(
              "로컬 에이전트 렌더가 완료되지 않았습니다. npm run shotform:install-agent 후 다시 시도해 주세요."
            )
          }
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

          if (json.renderSkipped && !companionVideoBlob) {
            const skipMsg =
              json.renderSkipReason ||
              "짜집기 MP4 렌더가 완료되지 않았습니다. 타임라인·나레이션은 사용할 수 있습니다."
            if (canOpenStudio && onStudioReady) {
              onStudioReady({
                result: json,
                videoBlobUrl: null,
                videoBlob: null,
              })
              setErr(skipMsg)
              completed = true
              break
            }
            setErr(skipMsg)
            break
          }

          let videoBlobUrl: string | null = companionVideoUrl
          let videoBlob: Blob | null = companionVideoBlob
          const mp4DownloadUrl =
            json.downloadUrl || (json.jobId ? autoEditDownloadUrl(json.jobId) : "")
          if (!videoBlob && mp4DownloadUrl && json.jobId) {
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
          } else if (canOpenStudio && !videoBlob) {
            if (renderMode === "local" && workDirForLocal && json.jobId) {
              setDownloadHint("로컬 MP4 재시도 중…")
              try {
                const { blob, localOutputPath: localOut } = await resolveLocalCompanionMp4({
                  localWorkDir: workDirForLocal,
                  jobId: json.jobId,
                  editPlan: json.editPlan,
                  companionUrl,
                  onProgress: (msg) => setDownloadHint(msg),
                })
                await assertPreviewMp4Blob(blob)
                if (projectId) await saveMvpEditMp4(projectId, json.jobId, blob)
                const objectUrl = URL.createObjectURL(blob)
                previewBlobRef.current = objectUrl
                setPreviewBlobUrl(objectUrl)
                videoBlobUrl = objectUrl
                videoBlob = blob
                json = { ...json, localOutputPath: localOut, renderMode: "local", localWorkDir: workDirForLocal }
              } catch (localErr) {
                const detail = localErr instanceof Error ? localErr.message : ""
                if (onStudioReady) {
                  onStudioReady({
                    result: {
                      ...json,
                      renderMode: "local",
                      localWorkDir: workDirForLocal,
                    },
                    videoBlobUrl: null,
                    videoBlob: null,
                  })
                }
                setErr(
                  "로컬 폴더에는 영상이 저장됐지만 앱으로 가져오지 못했습니다.\n\n" +
                    (detail ? `${detail}\n\n` : "") +
                    `파일 위치: ${workDirForLocal}\\jobs\\${json.jobId}\\output.mp4`
                )
                completed = true
                break
              }
            } else {
              setErr("짜집기 MP4가 없습니다. 짜집기를 다시 실행해 주세요.")
              break
            }
          }

          if (onStudioReady && canOpenStudio) {
            onStudioReady({
              result: {
                ...json,
                downloadUrl: mp4DownloadUrl || json.downloadUrl,
                renderMode: renderMode === "local" ? "local" : json.renderMode,
                localWorkDir: workDirForLocal || json.localWorkDir,
              },
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
    renderMode,
    localWorkDir,
    companionOnline,
    companionUrl,
    localDevFfmpegAvailable,
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
            <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
              분석 예상 약 {analyzeEta.min}~{analyzeEta.max}초 · 소스 영상 길이(예: 2분)와 목표 쇼츠 길이는
              별개입니다
            </span>
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
            <div className="grid gap-2 sm:grid-cols-2">
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-400">목표 쇼츠 길이</p>
              <p className="text-sm font-semibold tabular-nums text-violet-200">{targetDuration}초</p>
            </div>
            <input
              type="range"
              min={0}
              max={AUTO_EDIT_DURATION_OPTIONS.length - 1}
              step={1}
              value={durationSliderIndex(targetDuration)}
              disabled={loading}
              onChange={(e) => {
                const idx = Number(e.target.value)
                const next = AUTO_EDIT_DURATION_OPTIONS[idx]
                if (next != null) setTargetDuration(next)
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-500 disabled:opacity-50"
              aria-label="목표 쇼츠 길이"
            />
            <div className="mt-1.5 flex justify-between px-0.5 text-[9px] tabular-nums text-slate-600">
              {AUTO_EDIT_DURATION_OPTIONS.map((d) => (
                <span
                  key={d}
                  className={cn(
                    "w-4 text-center",
                    targetDuration === d ? "font-semibold text-violet-300" : ""
                  )}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/10 px-3 py-2.5">
              <p className="mb-2 text-xs font-medium text-emerald-200/90">ffmpeg 렌더 방식</p>
              {companionOnline ? (
                <p className="mb-2 text-[10px] text-emerald-400">로컬 에이전트 연결됨 · 배포 사이트에서도 PC 폴더 렌더 가능</p>
              ) : localRenderCap?.companionRecommended ? (
                <p className="mb-2 text-[10px] text-amber-300/90">
                  최초 1회: 프로젝트 폴더에서{" "}
                  <span className="font-mono">npm run shotform:install-agent</span> 실행 → 이후 자동 연결
                </p>
              ) : null}
              {companionHint && !companionOnline ? (
                <p className="mb-2 text-[10px] text-amber-300/80">{companionHint}</p>
              ) : null}
              {!companionOnline && renderMode === "local" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mb-2 h-8 w-full border-emerald-500/40 text-[11px] text-emerald-200"
                  disabled={loading}
                  onClick={() => {
                    void ensureLocalCompanionRunning({
                      companionUrl,
                      onProgress: (msg) => setCompanionHint(msg),
                    }).then((h) => {
                      setCompanionOnline(Boolean(h.ok && h.ffmpeg))
                      setCompanionHint(h.ok ? null : h.error || null)
                    })
                  }}
                >
                  에이전트 지금 시작 시도
                </Button>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setRenderMode("server")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition",
                    renderMode === "server"
                      ? "border-violet-500/60 bg-violet-500/15 ring-1 ring-violet-500/40"
                      : "border-white/10 bg-black/30 hover:border-white/20"
                  )}
                >
                  <p className="text-xs font-semibold text-slate-200">서버 (Cloud Run)</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">배포와 동일 · Vercel 경유</p>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setRenderMode("local")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition",
                    renderMode === "local"
                      ? "border-emerald-500/60 bg-emerald-500/15 ring-1 ring-emerald-500/40"
                      : "border-white/10 bg-black/30 hover:border-white/20"
                  )}
                >
                  <p className="text-xs font-semibold text-emerald-200">로컬 (ffmpeg)</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">지정 폴더 · CDN 만료 우회</p>
                </button>
              </div>
              {renderMode === "local" ? (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="shotform-local-work-dir" className="text-[10px] text-slate-400">
                    작업 폴더 (sources · jobs 하위 생성)
                  </Label>
                  <Input
                    id="shotform-local-work-dir"
                    value={localWorkDir}
                    disabled={loading}
                    onChange={(e) => setLocalWorkDir(e.target.value)}
                    placeholder={localRenderCap?.defaultWorkDir || "C:\\Users\\이름\\ShotForm\\auto-edit"}
                    className="border-white/10 bg-black/40 text-xs text-slate-200"
                  />
                  <p className="text-[10px] leading-snug text-slate-500">
                    소스: sources/video_001.mp4 · 결과: jobs/&#123;jobId&#125;/output.mp4
                  </p>
                </div>
              ) : null}
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

          {result?.localOutputPath ? (
            <p className="break-all text-xs text-emerald-300/90">
              로컬 저장: {result.localOutputPath}
            </p>
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

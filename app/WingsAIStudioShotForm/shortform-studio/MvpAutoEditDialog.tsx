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
import {
  REMIX_MOSAIC_STORAGE_KEY,
  toAutoEditVideoInputs,
  type AutoEditAnalysisMode,
  type AutoEditJobResult,
  type AutoEditPick,
  type AutoEditTargetDuration,
  type RemixMosaicMode,
} from "@/lib/shotform-auto-edit-types"
import {
  MvpRemixVoiceField,
  readSavedRemixVoice,
  REMIX_VOICE_STORAGE_KEY,
  type RemixVoiceSelection,
} from "./MvpRemixVoiceField"
import { shotformTtsApiKey, ttsProviderFromVoiceId } from "@/lib/shotform-tts-providers"
import {
  DEFAULT_REMIX_SCRIPT_TEMPLATE_ID,
  REMIX_SCRIPT_TEMPLATES,
  REMIX_SCRIPT_TEMPLATE_STORAGE_KEY,
  remixScriptTemplate,
} from "@/lib/shotform-remix-script-templates"
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
/** 「쓸수있는 영상 없음」 간헐 오류 — 자동 재시도 횟수 (총 1+2=3회 시도) */
const AUTO_EDIT_USABLE_VIDEO_MAX_RETRIES = 2
const LOCAL_WORK_DIR_STORAGE_KEY = "shotform_local_work_dir"

const STEPS: Array<{ key: AutoEditJobResult["step"]; label: string }> = [
  { key: "download", label: "영상 다운로드" },
  { key: "analyze", label: "제품·장면 분석" },
  { key: "mix", label: "영상 mix (picks)" },
  { key: "edit_plan", label: "리믹스 타임라인" },
  { key: "render", label: "ffmpeg 렌더" },
  { key: "script", label: "장면맞춤 나레이션" },
  { key: "done", label: "완료" },
]

function stepIndex(step: AutoEditJobResult["step"]): number {
  if (step === "error") return -1
  if (step === "subtitle_removal") {
    const renderIdx = STEPS.findIndex((s) => s.key === "render")
    return renderIdx >= 0 ? renderIdx : STEPS.length - 1
  }
  const i = STEPS.findIndex((s) => s.key === step)
  return i >= 0 ? i : STEPS.length - 1
}

const ANALYZE_STEP_HINTS: Record<AutoEditAnalysisMode, string> = {
  fast: "행동 기반 Vision 분석 중… (URL 1개·CDN: 보통 60~120초)",
  precision: "최대 2분 구간 심층 행동 분석 중… (약 3~10분)",
}

function stepHintsForMode(
  mode: AutoEditAnalysisMode
): Partial<Record<AutoEditJobResult["step"], string>> {
  return {
    download: "서버에서 원본 영상 준비 중… (브라우저 업로드 완료 시 곧 분석 단계로 넘어갑니다)",
    analyze: ANALYZE_STEP_HINTS[mode],
    mix: "영상 mix (picks) 생성 중…",
    edit_plan: mode === "precision" ? "리믹스 타임라인·컷별 Vision 캡션 중…" : "리믹스 타임라인 구성 중…",
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

export function MvpAutoEditDialog({
  open,
  onOpenChange,
  picks,
  projectId,
  projectName,
  sourceKeywords = [],
  initialPrefetchedBlobs,
  onPipelineComplete,
  onPicksUpdated,
  onStudioReady,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  picks: AutoEditPick[]
  projectId?: string
  projectName?: string
  /** 1단계 사용자 입력 키워드 */
  sourceKeywords?: string[]
  /** 재가공 YouTube — URL 해석 직후 브라우저에서 미리 받은 MP4 */
  initialPrefetchedBlobs?: Record<string, Blob>
  onPicksUpdated?: (picks: AutoEditPick[]) => void
  onPipelineComplete?: (args: { targetDuration: AutoEditTargetDuration }) => void
  /** 리믹스 완료 → MVP 내 TTS·자막 스튜디오 */
  onStudioReady?: (args: {
    result: AutoEditJobResult
    videoBlobUrl: string | null
    videoBlob: Blob | null
  }) => void
}) {
  const targetDuration = 30 as AutoEditTargetDuration
  const analysisMode = "fast" as const
  const renderMode = "server" as "server" | "local"
  const [voice, setVoice] = useState<RemixVoiceSelection>({ voiceId: "", style: "", speed: 1.1 })
  const [scriptTemplateId, setScriptTemplateId] = useState(DEFAULT_REMIX_SCRIPT_TEMPLATE_ID)
  const [mosaicMode, setMosaicMode] = useState<RemixMosaicMode>("paid")
  useEffect(() => {
    setVoice(readSavedRemixVoice())
    try {
      const saved = localStorage.getItem(REMIX_SCRIPT_TEMPLATE_STORAGE_KEY)
      if (saved && REMIX_SCRIPT_TEMPLATES.some((template) => template.id === saved)) {
        setScriptTemplateId(saved)
      }
      if (localStorage.getItem(REMIX_MOSAIC_STORAGE_KEY) === "free") setMosaicMode("free")
    } catch {
      /* 저장된 값이 없으면 기본 구조와 유료 모자이크를 씁니다. */
    }
  }, [])
  const chooseScriptTemplate = useCallback((id: string) => {
    const next = remixScriptTemplate(id).id
    setScriptTemplateId(next)
    try {
      localStorage.setItem(REMIX_SCRIPT_TEMPLATE_STORAGE_KEY, next)
    } catch {
      /* 저장에 실패해도 이번 실행에는 고른 구조를 씁니다. */
    }
  }, [])
  const chooseMosaicMode = useCallback((mode: RemixMosaicMode) => {
    setMosaicMode(mode)
    try {
      localStorage.setItem(REMIX_MOSAIC_STORAGE_KEY, mode)
    } catch {
      /* 저장에 실패해도 이번 실행에는 고른 모자이크를 씁니다. */
    }
  }, [])
  const chooseVoice = useCallback((next: RemixVoiceSelection) => {
    setVoice(next)
    try {
      localStorage.setItem(REMIX_VOICE_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* 저장 실패해도 이번 실행에는 고른 목소리를 씁니다. */
    }
  }, [])
  const [localWorkDir, setLocalWorkDir] = useState("")
  const [, setLocalRenderCap] = useState<{
    available: boolean
    defaultWorkDir?: string
    reason?: string
    layout?: Record<string, string>
    companionRecommended?: boolean
    defaultCompanionUrl?: string
  } | null>(null)
  const [companionOnline, setCompanionOnline] = useState(false)
  const [companionUrl, setCompanionUrl] = useState(DEFAULT_LOCAL_COMPANION_URL)
  const [, setCompanionHint] = useState<string | null>(null)
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
    if (!picks.length) {
      setErr("선택된 영상이 없습니다.")
      return
    }
    if (!ttsProviderFromVoiceId(voice.voiceId)) {
      setErr("모델을 고르고 목소리를 선택해 주세요.")
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

          const hasInitialBlobs =
            Boolean(initialPrefetchedBlobs) &&
            picks.every((p) => (initialPrefetchedBlobs![p.video_id]?.size ?? 0) > 0)

          if (refreshErrors.length === picks.length && !hasInitialBlobs) {
            throw new Error(refreshErrors.join("\n\n"))
          }

          if (onPicksUpdated && nextPicks.some((p, i) => p.videoUrl !== picks[i]?.videoUrl)) {
            onPicksUpdated(nextPicks)
          }

          const videos = toAutoEditVideoInputs(nextPicks)
          const preJobId = crypto.randomUUID()
          let prefetchedBlobs: Record<string, Blob> | undefined =
            initialPrefetchedBlobs && Object.keys(initialPrefetchedBlobs).length > 0
              ? { ...initialPrefetchedBlobs }
              : undefined

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

          let sourcesPreUploaded = false
          if (renderMode !== "local") {
            setDownloadHint("고른 영상을 서버로 보내는 중…")
            await uploadAutoEditSourcesFromBrowser(
              preJobId,
              nextPicks,
              (msg) => setDownloadHint(msg),
              prefetchedBlobs
            )
            sourcesPreUploaded = true
          }

          setDownloadHint("리믹스 작업 시작 중…")
          const res = await fetch("/api/shotform/auto-edit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videos,
              targetDuration,
              openaiApiKey,
              removeChineseSubtitles: false,
              scriptTopic: projectName?.trim() || undefined,
              sourceKeywords: sourceKeywords.filter(Boolean),
              clientJobId: preJobId,
              sourcesPreUploaded,
              renderMode,
              localWorkDir: renderMode === "local" ? localWorkDir.trim() : undefined,
              scriptTemplateId,
              mosaicMode,
              ttsVoiceId: voice.voiceId,
              ttsVoiceStyle: voice.style,
              ttsSpeed: voice.speed,
              ...(ttsProviderFromVoiceId(voice.voiceId) === "typecast"
                ? { typecastApiKey: shotformTtsApiKey("typecast") }
                : {}),
              ...(ttsProviderFromVoiceId(voice.voiceId) === "elevenlabs"
                ? { elevenlabsApiKey: shotformTtsApiKey("elevenlabs") }
                : {}),
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

          const hints = stepHintsForMode(analysisMode)
          let json = await pollAutoEditJob(
            started.jobId,
            (partial) => {
              setResult(partial)
              setDownloadHint(hints[partial.step] || "리믹스 진행 중…")
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
              "리믹스 MP4 렌더가 완료되지 않았습니다. 타임라인·나레이션은 사용할 수 있습니다."
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
                "리믹스·대본은 완료됐지만 결과 MP4를 불러오지 못했습니다.\n\n" +
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
              setErr("리믹스 MP4가 없습니다. 리믹스를 다시 실행해 주세요.")
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
    renderMode,
    localWorkDir,
    companionOnline,
    companionUrl,
    scriptTemplateId,
    mosaicMode,
    revokePreviewBlob,
    fetchResultMp4,
    projectId,
    projectName,
    sourceKeywords,
    voice,
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
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-white/10 bg-slate-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Scissors className="h-4 w-4 text-violet-400" />
            AI 리믹스 자동 편집
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {picks.length}개 영상을 골랐습니다. 대본 구조, 목소리, 모자이크를 고르면 장면, 대본, 음성이 만들어지고 편집기가 열립니다.
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
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-400">대본 구조</p>
            <div className="grid grid-cols-2 gap-1.5">
              {REMIX_SCRIPT_TEMPLATES.map((template) => {
                const selected = template.id === scriptTemplateId
                return (
                  <button
                    key={template.id}
                    type="button"
                    disabled={loading}
                    onClick={() => chooseScriptTemplate(template.id)}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-left text-xs font-semibold leading-snug transition",
                      selected
                        ? "border-violet-500/70 bg-violet-500/15 text-violet-100 ring-1 ring-violet-500/40"
                        : "border-white/10 bg-black/30 text-slate-200 hover:border-white/20"
                    )}
                  >
                    {template.name}
                  </button>
                )
              })}
            </div>
            <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 px-3 py-2.5">
              <p className="text-[11px] font-medium text-violet-200">
                {remixScriptTemplate(scriptTemplateId).name} 샘플 대본
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
                {remixScriptTemplate(scriptTemplateId).oneLiner}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                이 순서로 말합니다. 문장 내용은 고른 영상에 맞게 다시 씁니다.
              </p>
              <ol className="mt-2 space-y-1.5">
                {remixScriptTemplate(scriptTemplateId).steps.map((step, index) => (
                  <li key={`${step.role}-${index}`} className="flex gap-2 text-xs leading-snug text-slate-200">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/30 text-[10px] font-semibold text-violet-100">
                      {index + 1}
                    </span>
                    <span>
                      <span className="text-[10px] text-violet-300/80">{step.purpose}</span>
                      <span className="mt-0.5 block">{step.example}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <MvpRemixVoiceField disabled={loading} value={voice} onChange={chooseVoice} />

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-400">모자이크</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  {
                    id: "paid" as const,
                    name: "유료 모자이크",
                    detail: "Gemini가 글자·로고 위치를 찾아 영상에 바로 넣습니다. 버전2와 같습니다.",
                  },
                  {
                    id: "free" as const,
                    name: "무료 모자이크",
                    detail: "편집기가 열린 뒤 PaddleOCR이 중국어를 찾습니다. 비용은 없습니다.",
                  },
                ]
              ).map((option) => {
                const selected = mosaicMode === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={loading}
                    onClick={() => chooseMosaicMode(option.id)}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-left transition",
                      selected
                        ? "border-violet-500/70 bg-violet-500/15 ring-1 ring-violet-500/40"
                        : "border-white/10 bg-black/30 hover:border-white/20"
                    )}
                  >
                    <p className={cn("text-xs font-semibold", selected ? "text-violet-100" : "text-slate-200")}>
                      {option.name}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{option.detail}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {!loading && !result?.editPlan ? (
            <p className="text-xs text-slate-500">
              고른 영상을 장면으로 나누고, 대본과 선택한 목소리로 음성을 만든 뒤 편집기가 열립니다.
              유료 모자이크는 그 영상에 들어가고, 무료 모자이크는 편집기에서 찾습니다.
            </p>
          ) : null}

          {downloadHint ? (
            <p className="text-xs leading-relaxed text-violet-300">{downloadHint}</p>
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
            </div>
          )}

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
                리믹스 장면 ({result.productAnalysis.scenes.length}구간)
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
                리믹스 MP4 다운로드
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

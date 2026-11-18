"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Black_Han_Sans, IBM_Plex_Sans_KR } from "next/font/google"
import { Loader2, Sparkles } from "lucide-react"
import { ShotFormEditorDialogShell } from "../components/ShotFormEditorDialogShell"
import "../wings-shopping-v2/wings-shopping-v2.css"
import FxPanel from "@/components/wings-shopping-v2/FxPanel"
import LocalizePanel from "@/components/wings-shopping-v2/LocalizePanel"
import PublishPanel from "@/components/wings-shopping-v2/PublishPanel"
import { UploadButton } from "@/components/wings-shopping-v2/SourcesStep"
import { ROLE_LABEL, templatePreviewUrl } from "@/components/wings-shopping-v2/SsulPanel"
import ThumbnailPanel from "@/components/wings-shopping-v2/ThumbnailPanel"
import { JobLine, Panel, PlatformTag } from "@/components/wings-shopping-v2/ui"
import {
  DEFAULT_REMIX_TEMPLATE_ID,
  REMIX_TEMPLATES,
  getRemixTemplate,
} from "@/lib/wings-shopping-v2/templates/catalog"
import {
  normalizeRemixPaidMosaicMode,
  REMIX_MOSAIC_STORAGE_KEY,
  type AutoEditPick,
  type RemixPaidMosaicMode,
} from "@/lib/shotform-auto-edit-types"
import {
  DEFAULT_REMIX_SCRIPT_TEMPLATE_ID,
  REMIX_SCRIPT_TEMPLATES,
  REMIX_SCRIPT_TEMPLATE_STORAGE_KEY,
  remixScriptTemplate,
} from "@/lib/shotform-remix-script-templates"
import { shotformTtsApiKey, ttsProviderFromVoiceId } from "@/lib/shotform-tts-providers"
import {
  shotformVmakeApiKey,
  shotformVmakeSecretAccessKey,
} from "@/lib/shotform-vmake-subtitle-removal"
import { api, frameUrl, mediaUrl, patchProject, startStage, useBufferedVideoUrl } from "@/lib/wings-shopping-v2/client"
import type { Beat, Clip, Project, Source } from "@/lib/wings-shopping-v2/types"
import { cn } from "@/lib/utils"
import {
  MvpRemixVoiceField,
  readSavedRemixVoice,
  REMIX_VOICE_STORAGE_KEY,
  type RemixVoiceSelection,
} from "./MvpRemixVoiceField"

const displayFont = Black_Han_Sans({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  preload: false,
})

const bodyFont = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  preload: false,
})

const V2_STEPS = [
  "장면 나누기 · 모자이크",
  "대본 · 컷 지정 · 음성",
  "내보내기",
] as const

type DraftBeat = {
  id?: string
  text: string
  clipId: string | null
  tts?: Beat["tts"]
  role?: string
  item?: string
}

type HookCandidate = { text: string; type: string; why: string }

const PAID_MOSAIC_OPTIONS: Array<{
  id: RemixPaidMosaicMode
  name: string
  detail: string
}> = [
  {
    id: "v2",
    name: "유료 · 버전2 모자이크",
    detail: "Gemini가 자막·워터마크·로고 위치를 찾아 버전2 방식으로 모자이크를 입힙니다.",
  },
  {
    id: "vmake",
    name: "유료 · Vmake 자막 제거",
    detail: "픽셀 모자이크 대신 Vmake AI로 중국어 하드 자막을 흔적 없이 제거합니다.",
  },
]

async function syncBrowserApiKeys(): Promise<void> {
  if (typeof window === "undefined") return
  const tasks: Promise<unknown>[] = []
  const gemini = localStorage.getItem("shotform_gemini_api_key")?.trim()
  if (gemini) {
    tasks.push(
      fetch("/api/shotform/gemini-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: gemini }),
      }).catch(() => undefined),
    )
  }
  const tikhub = localStorage.getItem("shotform_tikhub_api_key")?.trim()
  if (tikhub) {
    tasks.push(
      fetch("/api/shotform/tikhub-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: tikhub }),
      }).catch(() => undefined),
    )
  }
  const youtube = localStorage.getItem("shotform_youtube_data_api_key")?.trim()
  if (youtube) {
    tasks.push(
      fetch("/api/shotform/youtube-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: youtube }),
      }).catch(() => undefined),
    )
  }
  await Promise.all(tasks)
}

export function MvpV2RemixWorkspace({
  open,
  onOpenChange,
  picks,
  projectName,
  sourceKeywords = [],
  v2ProjectId,
  onV2ProjectIdChange,
  onV2OutputStateChange,
  initialPrefetchedBlobs,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  picks: AutoEditPick[]
  projectId: string
  projectName?: string
  sourceKeywords?: string[]
  v2ProjectId?: string | null
  onV2ProjectIdChange?: (v2Id: string) => void
  onV2OutputStateChange?: (hasOutput: boolean) => void
  initialPrefetchedBlobs?: Record<string, Blob>
}) {
  const [detailMode, setDetailMode] = useState(false)
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [project, setProject] = useState<Project | null>(null)
  const [booting, setBooting] = useState(false)
  const [bootErr, setBootErr] = useState<string | null>(null)
  const [renderErr, setRenderErr] = useState<string | null>(null)

  const [voice, setVoice] = useState<RemixVoiceSelection>({ voiceId: "", style: "", speed: 1.1 })
  const [scriptTemplateId, setScriptTemplateId] = useState(DEFAULT_REMIX_SCRIPT_TEMPLATE_ID)
  const [mosaicMode, setMosaicMode] = useState<RemixPaidMosaicMode>("v2")

  useEffect(() => {
    setVoice(readSavedRemixVoice())
    try {
      const savedTpl = localStorage.getItem(REMIX_SCRIPT_TEMPLATE_STORAGE_KEY)
      if (savedTpl && REMIX_SCRIPT_TEMPLATES.some((t) => t.id === savedTpl)) {
        setScriptTemplateId(savedTpl)
      }
      const savedMosaic = localStorage.getItem(REMIX_MOSAIC_STORAGE_KEY)
      setMosaicMode(normalizeRemixPaidMosaicMode(savedMosaic))
    } catch {
      /* 기본값 사용 */
    }
  }, [])

  const activeId = project?.id ?? v2ProjectId ?? null

  const refresh = useCallback(async (targetId?: string | null) => {
    const id = targetId ?? activeId
    if (!id) return null
    try {
      const next = await api<Project>(`/api/wings-shopping-v2/projects/${id}`)
      setProject((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
      return next
    } catch (e) {
      setBootErr(e instanceof Error ? e.message : String(e))
      return null
    }
  }, [activeId])

  const picksSignature = useMemo(
    () => picks.map((p) => `${p.key}|${p.videoUrl}`).join("::"),
    [picks],
  )

  // 모달이 열릴 때 고른 영상 목록을 버전2 프로젝트에 동기화하고 장면 나누기를 준비한다
  useEffect(() => {
    if (!open || !picks.length) return
    let cancelled = false
    setBooting(true)
    setBootErr(null)
    setRenderErr(null)

    void (async () => {
      try {
        await syncBrowserApiKeys()
        const savedVoice = readSavedRemixVoice()
        const savedMosaic = normalizeRemixPaidMosaicMode(
          typeof window !== "undefined" ? localStorage.getItem(REMIX_MOSAIC_STORAGE_KEY) : "v2",
        )
        const savedTpl =
          (typeof window !== "undefined" && localStorage.getItem(REMIX_SCRIPT_TEMPLATE_STORAGE_KEY)) ||
          DEFAULT_REMIX_SCRIPT_TEMPLATE_ID

        let synced = await api<Project>("/api/wings-shopping-v2/projects/from-remix", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId: v2ProjectId || undefined,
            projectName,
            keywords: sourceKeywords,
            mosaicMode: savedMosaic,
            scriptTemplateId: savedTpl,
            customVoice: savedVoice.voiceId ? savedVoice : undefined,
            picks: picks.map((p) => ({
              videoId: p.video_id,
              url: p.noteUrl || p.videoUrl,
              videoUrl: p.videoUrl,
              title: p.title,
              platform: p.platform,
            })),
          }),
        })
        if (cancelled) return

        // 재가공 모드 등에서 브라우저가 이미 받은 MP4 Blob이 있으면 즉시 업로드해 지연을 줄인다
        if (initialPrefetchedBlobs && Object.keys(initialPrefetchedBlobs).length > 0) {
          let uploadedAny = false
          for (const pick of picks) {
            const blob = initialPrefetchedBlobs[pick.video_id]
            if (!blob || blob.size < 10_000) continue
            const targetSrc = synced.sources.find(
              (s) => s.directUrl === pick.videoUrl || s.url === (pick.noteUrl || pick.videoUrl),
            )
            if (!targetSrc || targetSrc.status === "ready" || targetSrc.file) continue
            const fd = new FormData()
            fd.append("file", new File([blob], `${targetSrc.id}.mp4`, { type: "video/mp4" }))
            fd.append("sourceId", targetSrc.id)
            const upRes = await fetch(`/api/wings-shopping-v2/projects/${synced.id}/upload`, {
              method: "POST",
              body: fd,
            })
            if (upRes.ok) uploadedAny = true
          }
          if (uploadedAny) {
            await startStage(synced.id, "sources").catch(() => undefined)
            synced = (await api<Project>(`/api/wings-shopping-v2/projects/${synced.id}`).catch(() => synced))
          }
        }

        if (cancelled) return
        setProject(synced)
        // 리믹스 작업실은 v2·vmake 만 고를 수 있다 (STTN 은 썰쇼핑숏폼 전용)
        if (synced.mosaicMode === "v2" || synced.mosaicMode === "vmake") setMosaicMode(synced.mosaicMode)
        if (synced.scriptTemplateId) setScriptTemplateId(remixScriptTemplate(synced.scriptTemplateId).id)
        if (synced.customVoice?.voiceId) setVoice(synced.customVoice)
        onV2ProjectIdChange?.(synced.id)
        onV2OutputStateChange?.(Boolean(synced.output?.file === "output.mp4"))

        // 완성본이 이미 있거나 모든 문장 음성이 있으면 3단계(내보내기), 대본이 있으면 2단계, 아니면 1단계로 연다
        const allBeatsVoiced =
          Boolean(synced.script?.beats.length) && synced.script!.beats.every((b) => Boolean(b.tts))
        if ((synced.output?.file === "output.mp4" || allBeatsVoiced) && synced.script?.beats.length) {
          setStep(2)
        } else if (synced.script?.beats.length && synced.clips.some((c) => !c.excluded)) {
          setStep(1)
        } else {
          setStep(0)
        }
      } catch (e) {
        if (!cancelled) setBootErr(e instanceof Error ? e.message : "버전2 워크스페이스를 준비하지 못했습니다.")
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 오픈 및 선택 영상 변경 시 동기화
  }, [open, picksSignature])

  // 실행 중인 작업이 있을 때 1초 간격으로 상태를 갱신한다
  useEffect(() => {
    if (!open || !project?.id) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      const latest = await refresh(project.id)
      if (!alive) return
      const running = latest && Object.values(latest.jobs).some((j) => j?.state === "running")
      timer = setTimeout(poll, running ? 1000 : 3500)
    }
    timer = setTimeout(poll, 1000)

    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [open, project?.id, refresh])

  const chooseMosaicMode = useCallback(
    async (mode: RemixPaidMosaicMode) => {
      setMosaicMode(mode)
      setRenderErr(null)
      try {
        localStorage.setItem(REMIX_MOSAIC_STORAGE_KEY, mode)
      } catch {
        /* ignore */
      }
      if (project?.id) {
        try {
          const updated = await patchProject(project.id, { mosaicMode: mode, mosaic: mode === "v2" })
          setProject(updated)
        } catch (e) {
          setRenderErr(e instanceof Error ? e.message : String(e))
        }
      }
    },
    [project?.id],
  )

  const chooseScriptTemplate = useCallback(
    async (id: string) => {
      const normalized = remixScriptTemplate(id).id
      setScriptTemplateId(normalized)
      try {
        localStorage.setItem(REMIX_SCRIPT_TEMPLATE_STORAGE_KEY, normalized)
      } catch {
        /* ignore */
      }
      if (project?.id) {
        const updated = await patchProject(project.id, { scriptTemplateId: normalized }).catch(() => null)
        if (updated) setProject(updated)
      }
    },
    [project?.id],
  )

  const chooseVoice = useCallback(
    async (next: RemixVoiceSelection) => {
      setVoice(next)
      try {
        localStorage.setItem(REMIX_VOICE_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      if (project?.id && next.voiceId) {
        const updated = await patchProject(project.id, { customVoice: next }).catch(() => null)
        if (updated) setProject(updated)
      }
    },
    [project?.id],
  )

  useEffect(() => {
    onV2OutputStateChange?.(Boolean(project?.output?.file === "output.mp4"))
  }, [project?.output?.file, project?.output?.at, onV2OutputStateChange])

  const startV2Render = useCallback(async (forceVmake = false) => {
    if (!project) return
    setRenderErr(null)

    const hasSavedVmake = Boolean(project.vmakeCleanedAt) && !forceVmake
    const vmakeApiKey = shotformVmakeApiKey()
    const vmakeSecretAccessKey = shotformVmakeSecretAccessKey()
    if (mosaicMode === "vmake" && !hasSavedVmake && (!vmakeApiKey || !vmakeSecretAccessKey)) {
      setRenderErr(
        "유료 · Vmake 자막 제거를 처음 실행하려면 ShotForm 홈 설정에서 Vmake AI API Key와 Secret Access Key를 먼저 입력해 주세요.",
      )
      return
    }

    try {
      await syncBrowserApiKeys()
      setStep(2)
      await api(`/api/wings-shopping-v2/projects/${project.id}/render`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mosaicMode,
          forceVmake,
          ...(mosaicMode === "vmake" && vmakeApiKey && vmakeSecretAccessKey
            ? { vmakeApiKey, vmakeSecretAccessKey }
            : {}),
        }),
      })
      await refresh(project.id)
    } catch (e) {
      setRenderErr(e instanceof Error ? e.message : "영상 만들기를 시작하지 못했습니다.")
    }
  }, [mosaicMode, project, refresh])

  const usableClipsCount = project?.clips.filter((c) => !c.excluded).length ?? 0
  const canOpenScriptStep = usableClipsCount > 0
  const canOpenRenderStep = Boolean(project?.script?.beats.length)

  return (
    <ShotFormEditorDialogShell
      open={open}
      title="버전2 리믹스 (장면 나누기 · 대본 · 음성 · 내보내기)"
      backLabel="영상 다시 고르기"
      closeLabel="버전2 리믹스 닫기"
      onClose={() => onOpenChange(false)}
      detailMode={detailMode}
      onDetailModeChange={setDetailMode}
      theme="light"
    >
      <div
        className={cn(
          displayFont.variable,
          bodyFont.variable,
          "wings-shopping-v2 h-full overflow-y-auto antialiased",
        )}
      >
        <div className="mx-auto max-w-6xl min-w-0 px-4 py-6 md:px-8">
          <header className="mb-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="rounded-md bg-panel-2 px-2 py-0.5 text-xs text-muted">
                  버전2 리믹스 · 렌더링 및 내보내기까지 일체형
                </span>
                <h1 className="mt-1.5 line-clamp-1 font-display text-2xl leading-tight md:text-3xl">
                  {projectName || project?.name || "AI 리믹스 쇼핑숏폼"}
                </h1>
              </div>
            </div>

            <ol className="flex flex-wrap gap-2" aria-label="버전2 리믹스 진행 단계">
              {V2_STEPS.map((label, idx) => {
                const enabled =
                  idx === 0 ? true : idx === 1 ? canOpenScriptStep : canOpenRenderStep
                const active = step === idx
                return (
                  <li key={label}>
                    <button
                      type="button"
                      disabled={!enabled}
                      onClick={() => setStep(idx as 0 | 1 | 2)}
                      aria-current={active ? "step" : undefined}
                      className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors disabled:opacity-35 ${
                        active
                          ? "border-amber bg-amber font-semibold text-amber-ink"
                          : "border-line bg-white text-muted hover:text-text"
                      }`}
                    >
                      <span className="font-display">{idx + 1}</span>
                      {label}
                    </button>
                  </li>
                )
              })}
            </ol>
          </header>

          {bootErr ? (
            <div className="mb-5 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
              {bootErr}
            </div>
          ) : null}

          {booting && !project ? (
            <Panel title="선택한 영상 불러오는 중">
              <div className="flex items-center gap-2.5 py-6 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin text-amber" />
                고른 영상을 버전2 작업 공간으로 연결하고 장면을 나누는 중입니다...
              </div>
            </Panel>
          ) : project ? (
            <>
              {step === 0 && (
                <V2SourcesStepView
                  project={project}
                  setProject={setProject}
                  refresh={() => void refresh(project.id)}
                  mosaicMode={mosaicMode}
                  onMosaicModeChange={(m) => void chooseMosaicMode(m)}
                  onGoScript={() => setStep(1)}
                />
              )}

              {step === 1 && (
                <V2ScriptStepView
                  project={project}
                  setProject={setProject}
                  refresh={() => void refresh(project.id)}
                  scriptTemplateId={scriptTemplateId}
                  onScriptTemplateChange={(id) => void chooseScriptTemplate(id)}
                  voice={voice}
                  onVoiceChange={(v) => void chooseVoice(v)}
                  onGoExportStep={() => setStep(2)}
                  onStartV2Render={() => void startV2Render()}
                />
              )}

              {step === 2 && (
                <V2NativeExportStepView
                  project={project}
                  setProject={setProject}
                  mosaicMode={mosaicMode}
                  onMosaicModeChange={(m) => void chooseMosaicMode(m)}
                  renderErr={renderErr}
                  onStartRender={(forceVmake) => void startV2Render(forceVmake)}
                />
              )}
            </>
          ) : null}
        </div>
      </div>
    </ShotFormEditorDialogShell>
  )
}

function PaidMosaicSelector({
  value,
  disabled,
  vmakeSaved = false,
  onChange,
}: {
  value: RemixPaidMosaicMode
  disabled?: boolean
  vmakeSaved?: boolean
  onChange: (mode: RemixPaidMosaicMode) => void
}) {
  const hasVmakeKeys =
    typeof window !== "undefined" &&
    Boolean(shotformVmakeApiKey() && shotformVmakeSecretAccessKey())

  return (
    <div className="rounded-xl border border-line bg-panel-2/45 p-3.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text">유료 모자이크 방식 선택</span>
        <span className="text-[11px] text-muted">
          {vmakeSaved && value === "vmake"
            ? "이미 Vmake 자막 제거가 완료된 영상을 보관 중입니다 · 템플릿을 바꿔도 다시 결제되지 않습니다"
            : "선택한 방식으로 버전2 렌더링 시 원본 자막·워터마크를 처리합니다"}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {PAID_MOSAIC_OPTIONS.map((opt) => {
          const selected = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={cn(
                "rounded-xl border-2 px-3.5 py-2.5 text-left transition-colors",
                selected
                  ? "border-amber bg-white shadow-sm"
                  : "border-line bg-white/70 hover:border-muted",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-text">{opt.name}</span>
                <div className="flex items-center gap-1.5">
                  {opt.id === "vmake" && vmakeSaved ? (
                    <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-bold text-ok">
                      ✓ 제거본 보관됨 · 재과금 없음
                    </span>
                  ) : null}
                  {selected ? (
                    <span className="rounded-full bg-amber px-2 py-0.5 text-[11px] font-semibold text-amber-ink">
                      선택됨
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-xs leading-snug text-muted">
                {opt.id === "vmake" && vmakeSaved
                  ? "한 번 제거한 깨끗한 원본이 저장되어 있습니다. 템플릿·자막·배경음을 몇 번을 바꿔도 추가 비용 없이 바로 적용됩니다."
                  : opt.detail}
              </p>
            </button>
          )
        })}
      </div>
      {value === "vmake" && !vmakeSaved && !hasVmakeKeys ? (
        <p className="mt-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger">
          Vmake AI API Key / Secret Access Key가 아직 입력되지 않았습니다. ShotForm 홈 우측 상단 API 설정에서 키를 입력하거나 「유료 · 버전2 모자이크」를 선택해 주세요.
        </p>
      ) : null}
    </div>
  )
}

function V2SourcesStepView({
  project,
  setProject,
  refresh,
  mosaicMode,
  onMosaicModeChange,
  onGoScript,
}: {
  project: Project
  setProject: (p: Project) => void
  refresh: () => void
  mosaicMode: RemixPaidMosaicMode
  onMosaicModeChange: (mode: RemixPaidMosaicMode) => void
  onGoScript: () => void
}) {
  const job = project.jobs.sources
  const running = job?.state === "running"
  const pendingCount = project.sources.filter(
    (s) => s.status !== "ready" || !project.clips.some((c) => c.sourceId === s.id),
  ).length
  const usable = project.clips.filter((c) => !c.excluded).length
  const showV2MosaicBoxes = mosaicMode === "v2"

  async function toggleClip(c: Clip) {
    setProject(
      await patchProject(project.id, {
        clipExcluded: { clipId: c.id, excluded: !c.excluded },
      }),
    )
  }

  return (
    <Panel
      title="영상 선택 · 장면 나누기"
      actions={
        <>
          <UploadButton projectId={project.id} onDone={refresh} label="영상 파일 추가" />
          <button
            type="button"
            className="btn btn-ghost"
            disabled={running}
            onClick={async () => {
              await startStage(project.id, "sources").catch(() => undefined)
              refresh()
            }}
          >
            {project.clips.length ? "바뀐 영상 처리" : "영상 내려받고 장면 나누기"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!usable || running}
            onClick={onGoScript}
          >
            장면 {usable}개로 대본 쓰기
          </button>
        </>
      }
    >
      <JobLine
        job={job}
        idleText={
          pendingCount
            ? `처리할 영상이 ${pendingCount}개 있습니다. 영상 내려받고 장면 나누기를 누르세요.`
            : undefined
        }
      />

      <div className="mt-3">
        <PaidMosaicSelector
          value={mosaicMode}
          disabled={running}
          vmakeSaved={Boolean(project.vmakeCleanedAt)}
          onChange={onMosaicModeChange}
        />
      </div>

      <p className="mt-4 text-sm text-muted">
        쓰고 싶지 않은 장면은 눌러서 빼세요. 마우스를 올리면 해당 장면이 바로 재생됩니다.
      </p>

      <div className="mt-4 flex flex-col gap-6">
        {project.sources.map((s) => (
          <V2SourceBlock
            key={s.id}
            source={s}
            projectId={project.id}
            showMosaicBoxes={showV2MosaicBoxes}
            clips={project.clips.filter((c) => c.sourceId === s.id)}
            onToggle={toggleClip}
            onUploaded={refresh}
          />
        ))}
      </div>
    </Panel>
  )
}

function V2SourceBlock({
  source,
  projectId,
  showMosaicBoxes,
  clips,
  onToggle,
  onUploaded,
}: {
  source: Source
  projectId: string
  showMosaicBoxes: boolean
  clips: Clip[]
  onToggle: (c: Clip) => void
  onUploaded: () => void
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <PlatformTag platform={source.platform} />
        <h3 className="min-w-0 flex-1 truncate font-semibold">
          {source.title || source.url || "업로드한 영상"}
        </h3>
        {source.status === "ready" && (
          <span className="text-xs text-ok">장면 {clips.length}개</span>
        )}
        {source.status === "pending" && <span className="text-xs text-muted">처리 중...</span>}
      </div>
      {(source.status === "needsUpload" || source.status === "error") && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          <span className="flex-1">
            {source.error ?? "처리하지 못했습니다"} — 원본을 직접 받아 파일로 올려 주세요.
          </span>
          {source.url && (
            <a href={source.url} target="_blank" rel="noreferrer" className="underline">
              원본 열기
            </a>
          )}
          <UploadButton
            projectId={projectId}
            sourceId={source.id}
            onDone={onUploaded}
            label="파일 올리기"
          />
        </div>
      )}
      {clips.length > 0 && source.file && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {clips.map((c) => (
            <V2ClipCard
              key={c.id}
              clip={c}
              projectId={projectId}
              showMosaicBoxes={showMosaicBoxes}
              file={source.file!}
              onToggle={() => onToggle(c)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function V2ClipCard({
  clip,
  projectId,
  showMosaicBoxes,
  file,
  onToggle,
}: {
  clip: Clip
  projectId: string
  showMosaicBoxes: boolean
  file: string
  onToggle: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-pressed={!clip.excluded}
        title={clip.description}
        className={`relative block aspect-[9/16] w-full overflow-hidden rounded-lg bg-panel-2 ${
          clip.excluded ? "opacity-30 grayscale" : ""
        }`}
      >
        {hover ? (
          <video
            src={`${mediaUrl(projectId, file)}#t=${clip.start},${clip.end}`}
            autoPlay
            muted
            playsInline
            onTimeUpdate={(e) => {
              if (e.currentTarget.currentTime >= clip.end) {
                e.currentTarget.currentTime = clip.start
              }
            }}
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={frameUrl(projectId, clip.id)}
            alt={clip.description}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[11px] text-white tabular-nums">
          {(clip.end - clip.start).toFixed(1)}s
        </span>
        {showMosaicBoxes &&
          !hover &&
          (clip.textBoxes ?? []).map(([y0, x0, y1, x1], k) => (
            <span
              key={k}
              aria-hidden
              className="absolute border border-amber/80 bg-[repeating-conic-gradient(#0008_0_25%,#fff3_0_50%)] bg-[length:8px_8px]"
              style={{
                top: `${y0 / 10}%`,
                left: `${x0 / 10}%`,
                height: `${(y1 - y0) / 10}%`,
                width: `${(x1 - x0) / 10}%`,
              }}
            />
          ))}
        {(clip.textBoxes?.length ?? 0) > 0 && (
          <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-[11px] text-white">
            {showMosaicBoxes ? "모자이크" : "Vmake 제거"}
          </span>
        )}
        {clip.excluded && (
          <span className="absolute inset-0 grid place-items-center bg-black/40 text-xs font-semibold text-white">
            뺌
          </span>
        )}
      </button>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted">{clip.description}</p>
    </li>
  )
}

function ScriptStructureTemplatePicker({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled?: boolean
  onChange: (id: string) => void
}) {
  const activeTemplate = remixScriptTemplate(value)
  return (
    <Panel title="대본 구조 템플릿">
      <p className="mb-3 text-sm text-muted">
        원하는 대본 흐름을 고른 뒤 「대본 만들기」 또는 「대본 새로 쓰기」를 누르면 해당 순서대로 문장과 장면을 맞춥니다.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {REMIX_SCRIPT_TEMPLATES.map((tpl) => {
          const selected = tpl.id === activeTemplate.id
          return (
            <button
              key={tpl.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(tpl.id)}
              className={cn(
                "rounded-xl border-2 px-3 py-2.5 text-left transition-colors",
                selected
                  ? "border-amber bg-panel-2/60"
                  : "border-line bg-white hover:border-muted",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-text">{tpl.name}</span>
                <span className="text-[11px] text-muted">{tpl.steps.length}단계</span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted">{tpl.oneLiner}</p>
            </button>
          )
        })}
      </div>

      <div className="mt-3 rounded-xl border border-line bg-panel-2/50 px-4 py-3">
        <p className="text-xs font-bold text-text">
          {activeTemplate.name} 샘플 흐름 (예시 문구는 참고용이며 실제 제품·장면에 맞춰 새로 작성됩니다)
        </p>
        <ol className="mt-2 space-y-1.5">
          {activeTemplate.steps.map((s, idx) => (
            <li key={`${s.role}-${idx}`} className="flex gap-2.5 text-xs leading-snug text-text">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber text-[10px] font-bold text-amber-ink">
                {idx + 1}
              </span>
              <span>
                <span className="font-semibold text-amber">{s.purpose}</span>
                <span className="ml-1.5 text-muted">{s.example}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  )
}

function V2ScriptStepView({
  project,
  setProject,
  refresh,
  scriptTemplateId,
  onScriptTemplateChange,
  voice,
  onVoiceChange,
  onGoExportStep,
  onStartV2Render,
}: {
  project: Project
  setProject: (p: Project) => void
  refresh: () => void
  scriptTemplateId: string
  onScriptTemplateChange: (id: string) => void
  voice: RemixVoiceSelection
  onVoiceChange: (v: RemixVoiceSelection) => void
  onGoExportStep: () => void
  onStartV2Render: () => void
}) {
  const script = project.script
  const [head, setHead] = useState<[string, string]>(script?.headcopy ?? ["", ""])
  const [beats, setBeats] = useState<DraftBeat[]>(script?.beats ?? [])
  const [dirty, setDirty] = useState(false)
  const [active, setActive] = useState(0)
  const [voiceErr, setVoiceErr] = useState<string | null>(null)

  useEffect(() => {
    if (!dirty && script) {
      setHead(script.headcopy)
      setBeats(script.beats)
    }
  }, [script, dirty])

  const clips = useMemo(() => project.clips.filter((c) => !c.excluded), [project.clips])
  const clipById = useMemo(() => new Map(project.clips.map((c) => [c.id, c])), [project.clips])
  const scriptJob = project.jobs.script
  const ttsJob = project.jobs.tts
  const renderJob = project.jobs.render
  const busy =
    scriptJob?.state === "running" ||
    ttsJob?.state === "running" ||
    renderJob?.state === "running"

  const totalSec = (script?.beats ?? []).reduce((a, b) => a + (b.tts?.duration ?? 0), 0)
  const allVoiced = Boolean(script?.beats.length) && script!.beats.every((b) => Boolean(b.tts)) && !dirty
  const allHaveClips = beats.length > 0 && beats.every((b) => Boolean(b.clipId && clipById.has(b.clipId)))

  function edit(i: number, patch: Partial<DraftBeat>) {
    setBeats((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)))
    setDirty(true)
  }

  function move(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= beats.length) return
    const next = [...beats]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    setBeats(next)
    setActive(j)
    setDirty(true)
  }

  async function save() {
    const updated = await patchProject(project.id, {
      headcopy: head,
      beats: beats.map(({ id, text, clipId, role, item }) => ({
        id,
        text,
        clipId,
        role,
        item: item ?? "",
      })),
    })
    setProject(updated)
    setDirty(false)
    return updated
  }

  async function generateVoice() {
    setVoiceErr(null)
    const provider = ttsProviderFromVoiceId(voice.voiceId)
    if (!provider) {
      setVoiceErr("먼저 목소리 버튼을 눌러 모델과 목소리를 선택해 주세요.")
      return
    }
    try {
      await syncBrowserApiKeys()
      if (dirty) await save()
      await api(`/api/wings-shopping-v2/projects/${project.id}/tts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customVoice: voice,
          ...(provider === "typecast" ? { typecastApiKey: shotformTtsApiKey("typecast") } : {}),
          ...(provider === "elevenlabs"
            ? { elevenlabsApiKey: shotformTtsApiKey("elevenlabs") }
            : {}),
        }),
      })
      refresh()
    } catch (e) {
      setVoiceErr(e instanceof Error ? e.message : "음성 생성을 시작하지 못했습니다.")
    }
  }

  if (!script) {
    return (
      <div className="flex flex-col gap-6">
        <ScriptStructureTemplatePicker
          value={scriptTemplateId}
          disabled={busy}
          onChange={onScriptTemplateChange}
        />
        <Panel
          title="대본·음성"
          actions={
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                await startStage(project.id, "script").catch(() => undefined)
                refresh()
              }}
            >
              대본 만들기
            </button>
          }
        >
          <JobLine
            job={scriptJob}
            idleText={`장면 ${clips.length}개를 보고 AI가 선택한 구조대로 대본을 쓰고, 문장마다 어울리는 장면을 고릅니다.`}
          />
        </Panel>
      </div>
    )
  }

  const cur = beats[active]
  const curClip = cur?.clipId ? clipById.get(cur.clipId) : undefined

  return (
    <div className="flex flex-col gap-6">
      <ScriptStructureTemplatePicker
        value={scriptTemplateId}
        disabled={busy}
        onChange={onScriptTemplateChange}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] [&>*]:min-w-0">
        <Panel
          title="대본 · 문장별 컷 지정 · 음성"
          actions={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={async () => {
                  setDirty(false)
                  await startStage(project.id, "script").catch(() => undefined)
                  refresh()
                }}
              >
                대본 새로 쓰기
              </button>
              {dirty && (
                <button type="button" className="btn btn-ghost" onClick={() => void save()}>
                  변경 저장
                </button>
              )}
            </>
          }
        >
          <JobLine job={scriptJob} />

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-muted">상단 문구 1줄</span>
              <input
                className="field mt-1"
                value={head[0]}
                onChange={(e) => {
                  setHead([e.target.value, head[1]])
                  setDirty(true)
                }}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted">상단 문구 2줄</span>
              <input
                className="field mt-1"
                value={head[1]}
                onChange={(e) => {
                  setHead([head[0], e.target.value])
                  setDirty(true)
                }}
              />
            </label>
          </div>

          <ol className="mt-5 flex flex-col gap-2">
            {beats.map((b, i) => {
              const clip = b.clipId ? clipById.get(b.clipId) : undefined
              return (
                <li
                  key={b.id ?? `new-${i}`}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  className={`grid grid-cols-[28px_64px_1fr] gap-3 rounded-xl border p-2.5 ${
                    i === active ? "border-amber/70 bg-panel-2/60" : "border-line"
                  }`}
                >
                  <span className="flex flex-col items-center gap-1 pt-1">
                    <span className="font-display text-lg text-muted">{i + 1}</span>
                    {b.role && (
                      <span className="rounded bg-amber/15 px-1 text-[10px] leading-4 text-amber">
                        {ROLE_LABEL[b.role] ?? b.role}
                      </span>
                    )}
                  </span>

                  <V2ClipPicker
                    clips={clips}
                    value={clip}
                    projectId={project.id}
                    onChange={(id) => edit(i, { clipId: id })}
                  />

                  <div className="min-w-0">
                    <textarea
                      className="field min-h-[4.5rem] resize-y leading-relaxed"
                      value={b.text}
                      rows={Math.max(2, b.text.split("\n").length)}
                      onChange={(e) => edit(i, { text: e.target.value })}
                      aria-label={`${i + 1}번 문장`}
                    />
                    {i === 0 && (
                      <V2HookPicker projectId={project.id} onPick={(text) => edit(0, { text })} />
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      {!clip && <span className="text-danger">장면을 골라 주세요</span>}
                      {b.tts && !dirty ? (
                        <>
                          <span className="tabular-nums">{b.tts.duration.toFixed(1)}초</span>
                          <audio
                            src={`${mediaUrl(project.id, b.tts.file)}?h=${b.tts.textHash}`}
                            controls
                            className="h-7 max-w-[220px]"
                          />
                        </>
                      ) : (
                        <span>음성 없음</span>
                      )}
                      <span className="flex-1" />
                      <button
                        type="button"
                        className="hover:text-text"
                        onClick={() => move(i, -1)}
                        aria-label="위로"
                      >
                        위로
                      </button>
                      <button
                        type="button"
                        className="hover:text-text"
                        onClick={() => move(i, 1)}
                        aria-label="아래로"
                      >
                        아래로
                      </button>
                      <button
                        type="button"
                        className="hover:text-danger"
                        onClick={() => {
                          setBeats(beats.filter((_, j) => j !== i))
                          setDirty(true)
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>

          <button
            type="button"
            className="btn btn-ghost mt-3"
            onClick={() => {
              setBeats([...beats, { text: "", clipId: clips[0]?.id ?? null }])
              setActive(beats.length)
              setDirty(true)
            }}
          >
            문장 추가
          </button>

          <div className="mt-8 border-t border-line pt-5">
            <h3 className="mb-3 font-display text-xl">음성 · 버전2 렌더</h3>
            <MvpRemixVoiceField
              tone="light"
              disabled={busy}
              value={voice}
              onChange={onVoiceChange}
            />

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || beats.some((b) => !b.text.trim())}
                onClick={() => void generateVoice()}
              >
                {script.beats.some((b) => b.tts) ? "바뀐 문장 음성 만들기" : "음성 만들기"}
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !allVoiced || !allHaveClips}
                onClick={onStartV2Render}
              >
                <Sparkles className="h-4 w-4" />
                바로 영상 만들기 ({totalSec.toFixed(1)}초)
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || !allVoiced || !allHaveClips}
                onClick={onGoExportStep}
              >
                내보내기 설정으로 ({totalSec.toFixed(1)}초)
              </button>
            </div>

            {voiceErr && <p className="mt-2 text-sm text-danger">{voiceErr}</p>}
            <div className="mt-3">
              <JobLine job={ttsJob} />
            </div>
          </div>
        </Panel>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <V2PhonePreview
            projectId={project.id}
            clip={curClip}
            head={head}
            text={cur?.text ?? ""}
            index={active}
            total={beats.length}
          />
        </aside>
      </div>
    </div>
  )
}

function V2HookPicker({
  projectId,
  onPick,
}: {
  projectId: string
  onPick: (text: string) => void
}) {
  const [hooks, setHooks] = useState<HookCandidate[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setBusy(true)
    setError(null)
    try {
      await syncBrowserApiKeys()
      const res = await api<{ hooks: HookCandidate[] }>(
        `/api/wings-shopping-v2/projects/${projectId}/hooks`,
        { method: "POST" },
      )
      setHooks(res.hooks)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        className="text-xs text-amber hover:underline disabled:opacity-50"
        disabled={busy}
        onClick={() => void load()}
      >
        {busy
          ? "후킹 문장 쓰는 중..."
          : hooks
            ? "후킹 후보 다시 받기"
            : "후킹 첫 문장 후보 5개 받기 (A/B 테스트용)"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {hooks && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {hooks.map((h) => (
            <li key={h.text}>
              <button
                type="button"
                className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-left text-sm hover:border-amber/70"
                onClick={() => onPick(h.text)}
                title={h.why}
              >
                <span className="mr-2 rounded bg-panel-2 px-1 text-[10px] text-muted">
                  {h.type}
                </span>
                {h.text.replace(/\n/g, " ")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function V2ClipPicker({
  clips,
  value,
  projectId,
  onChange,
}: {
  clips: Clip[]
  value?: Clip
  projectId: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="block aspect-[9/16] w-16 overflow-hidden rounded-md bg-panel-2"
        aria-label="장면 바꾸기"
        aria-expanded={open}
      >
        {value ? (
          <img src={frameUrl(projectId, value.id)} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted">장면 선택</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 grid max-h-80 w-[19rem] grid-cols-4 gap-1.5 overflow-y-auto rounded-xl border border-line bg-panel p-2 shadow-2xl">
          {clips.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.description}
              onClick={() => {
                onChange(c.id)
                setOpen(false)
              }}
              className={`aspect-[9/16] overflow-hidden rounded ${
                value?.id === c.id ? "ring-2 ring-amber" : ""
              }`}
            >
              <img
                src={frameUrl(projectId, c.id)}
                alt={c.description}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function V2PhonePreview({
  projectId,
  clip,
  head,
  text,
  index,
  total,
}: {
  projectId: string
  clip?: Clip
  head: [string, string]
  text: string
  index: number
  total: number
}) {
  const lines = text.split("\n").filter(Boolean)
  return (
    <figure>
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-[28px] border-[6px] border-panel-2 bg-black text-white shadow-2xl">
        {clip && (
          <img
            src={frameUrl(projectId, clip.id)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-x-0 top-[9%] px-3 text-center font-display text-[22px] leading-tight [text-shadow:0_0_4px_#000,0_0_4px_#000,0_2px_0_#000]">
          <p>{head[0]}</p>
          <p className="text-[#ffe500]">{head[1]}</p>
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-[17px] font-bold leading-snug [text-shadow:0_0_4px_#000,0_0_4px_#000,0_2px_0_#000]">
          <span>{lines[0] ?? ""}</span>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted">
        {total
          ? `${index + 1}/${total}번 문장 미리보기 · 자막은 줄마다 바뀝니다`
          : "문장을 추가하세요"}
      </figcaption>
    </figure>
  )
}

function RemixVideoTemplateSelector({
  project,
  disabled,
  onSelect,
}: {
  project: Project
  disabled?: boolean
  onSelect: (templateId: string) => void
}) {
  const activeTpl = getRemixTemplate(project.remixTemplateId ?? DEFAULT_REMIX_TEMPLATE_ID)

  return (
    <div className="rounded-xl border border-line bg-panel-2/45 p-3.5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs font-semibold text-text">영상 템플릿 선택 (자막 정중앙 배치)</span>
          <span className="ml-2 rounded-full bg-amber/20 px-2 py-0.5 text-[11px] font-semibold text-amber">
            현재: {activeTpl.name}
          </span>
        </div>
        <span className="text-[11px] text-muted">
          템플릿을 바꾼 뒤 「다시 만들기」를 누르면 Vmake 재호출 없이 새 디자인으로 바로 합쳐집니다
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
        {REMIX_TEMPLATES.map((tpl) => {
          const selected = tpl.id === activeTpl.id
          return (
            <li key={tpl.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(tpl.id)}
                aria-pressed={selected}
                title={tpl.description}
                className={cn(
                  "group block w-full overflow-hidden rounded-xl border-2 bg-white text-left transition-all",
                  selected
                    ? "border-amber shadow-md ring-2 ring-amber/30"
                    : "border-line hover:border-muted",
                )}
              >
                <div className="relative aspect-[9/16] w-full overflow-hidden bg-black">
                  <img
                    src={templatePreviewUrl(project, tpl.id)}
                    alt={`${tpl.name} 템플릿 미리보기`}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                  />
                  {selected ? (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-amber px-2 py-0.5 text-[10px] font-bold text-amber-ink shadow">
                      선택됨
                    </span>
                  ) : null}
                </div>
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-bold text-text">{tpl.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-muted">{tpl.description}</p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function V2NativeExportStepView({
  project,
  setProject,
  mosaicMode,
  onMosaicModeChange,
  renderErr,
  onStartRender,
}: {
  project: Project
  setProject: (p: Project) => void
  mosaicMode: RemixPaidMosaicMode
  onMosaicModeChange: (mode: RemixPaidMosaicMode) => void
  renderErr: string | null
  onStartRender: (forceVmake?: boolean) => void
}) {
  const job = project.jobs.render
  const running = job?.state === "running"
  const out = project.output
  const hasPureV2 = Boolean(out?.file === "output.mp4")
  const vmakeSaved = Boolean(project.vmakeCleanedAt)
  const missingIdx = (project.script?.beats ?? []).findIndex((b) => !b.clipId || !b.tts)
  const rawVideoUrl =
    hasPureV2 && out && !running
      ? `${mediaUrl(project.id, "output.mp4")}?v=${out.at ?? 0}`
      : null
  const playableVideoUrl = useBufferedVideoUrl(rawVideoUrl)

  const handleSelectRemixTemplate = async (templateId: string) => {
    const updated = await patchProject(project.id, { remixTemplateId: templateId }).catch(() => null)
    if (updated) setProject(updated)
  }

  const primaryButtonLabel = running
    ? "영상 만드는 중..."
    : mosaicMode === "vmake" && vmakeSaved
      ? "보관된 영상에 템플릿·자막 적용 (무료)"
      : hasPureV2
        ? "다시 만들기"
        : "영상 만들기"

  return (
    <div className="flex flex-col gap-6">
      <FxPanel project={project} setProject={setProject} />

      <Panel
        title="내보내기"
        actions={
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={running || missingIdx >= 0}
              onClick={() => onStartRender(false)}
            >
              {primaryButtonLabel}
            </button>
            {hasPureV2 && !running ? (
              <a
                className="btn btn-ghost"
                href={`${mediaUrl(project.id, "output.mp4")}?download`}
              >
                mp4 내려받기
              </a>
            ) : null}
            {mosaicMode === "vmake" && vmakeSaved && !running ? (
              <button
                type="button"
                className="btn btn-ghost !text-xs"
                disabled={missingIdx >= 0}
                title="원본 영상을 새로 바꿨을 때만 Vmake 유료 자막 제거를 다시 실행합니다"
                onClick={() => {
                  if (window.confirm("원본 영상이 바뀌었나요? Vmake 유료 자막 제거를 새로 실행하면 크레딧이 차감됩니다. 계속할까요?")) {
                    onStartRender(true)
                  }
                }}
              >
                원본 변경 시 Vmake 새로 실행
              </button>
            ) : null}
          </>
        }
      >
        <div className="mb-4 space-y-3">
          <PaidMosaicSelector
            value={mosaicMode}
            disabled={running}
            vmakeSaved={vmakeSaved}
            onChange={onMosaicModeChange}
          />
          <RemixVideoTemplateSelector
            project={project}
            disabled={running}
            onSelect={(tid) => void handleSelectRemixTemplate(tid)}
          />
        </div>

        {missingIdx >= 0 && (
          <p className="mb-3 text-sm text-danger">
            {missingIdx + 1}번 문장에 장면이나 음성이 없습니다. 「2 대본 · 컷 지정 · 음성」 단계에서 채워 주세요.
          </p>
        )}

        <JobLine
          job={job}
          idleText={
            hasPureV2
              ? undefined
              : "1080×1920 영상으로 장면을 잇고, 선택한 유료 모자이크와 음성·자막·배경음·효과음을 한 번에 입힙니다."
          }
        />

        {renderErr && <p className="mt-3 text-sm text-danger">{renderErr}</p>}

        {out?.notes?.map((n) => (
          <p key={n} className="mt-2 text-sm text-amber">
            {n}
          </p>
        ))}

        {out?.stale && !running && hasPureV2 && (
          <p className="mt-2 text-sm text-ok">
            {mosaicMode === "vmake" && vmakeSaved
              ? "템플릿·자막·오디오 설정이 바뀌었습니다. 위 「보관된 영상에 템플릿·자막 적용 (무료)」 버튼을 누르면 Vmake 추가 과금 없이 보관된 영상 위에 바로 입혀집니다."
              : "앞 단계나 설정이 바뀌었습니다. 「다시 만들기」를 눌러 반영하세요."}
          </p>
        )}

        {hasPureV2 && out && !running && playableVideoUrl && (
          <video
            key={out.at}
            src={playableVideoUrl}
            controls
            preload="auto"
            playsInline
            className="mx-auto mt-5 aspect-[9/16] w-full max-w-[360px] rounded-2xl bg-black shadow-lg"
          />
        )}
      </Panel>

      {project.script?.beats.length ? (
        <ThumbnailPanel project={project} setProject={setProject} />
      ) : null}
      {project.script?.beats.length ? (
        <PublishPanel project={project} setProject={setProject} />
      ) : null}
      {project.script?.beats.length ? <LocalizePanel project={project} /> : null}
    </div>
  )
}

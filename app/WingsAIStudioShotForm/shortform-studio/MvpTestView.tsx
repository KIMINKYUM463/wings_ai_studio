"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, CheckSquare, ExternalLink, Loader2, RefreshCw, Search, Square, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  fetchCnKeywordTranslation,
  KEYWORD_TRANSLATE_DEBOUNCE_MS,
  parseKoKeywordInputs,
  type KoZhKeywordPair,
} from "@/lib/shotform-cn-keyword-translate-client"
import {
  MVP_XHS_PLATFORM_RETRY_MAX,
  type MvpKeywordPlatform,
  type MvpKeywordSourceResult,
  type MvpKeywordVideo,
  type MvpPlatformSourceResult,
} from "@/lib/shotform-mvp-keyword-source"
import {
  MAX_AUTO_EDIT_VIDEOS,
  type AutoEditJobResult,
  type AutoEditPick,
  videoPickKey,
} from "@/lib/shotform-auto-edit-types"
import { isLikelyPresenterTitle } from "@/lib/shotform-auto-edit-product-filter"
import { StudioPageCard, StudioPageHeader, studio } from "../components/ShotFormStudioUI"
import { updateMvpTestProject } from "./project-actions"
import type { MvpSourceMode, MvpTestProject, MvpTestProjectData } from "./project-types"
import { MvpDirectUrlPickPanel } from "./MvpDirectUrlPickPanel"
import { MvpReprocessUrlPanel } from "./MvpReprocessUrlPanel"
import type { MvpResolvedUrlItem } from "@/lib/shotform-mvp-resolve-urls"
import type { MvpReprocessResolvedItem } from "@/lib/shotform-mvp-reprocess-url-shared"
import type { MvpStudioPersistData } from "@/lib/mvp-studio-types"
import { normalizeStudioPhase } from "@/lib/mvp-studio-types"
import { prepareMvpProjectDataForSave } from "@/lib/mvp-project-persist"
import { safeJsonKey, slimStudioPersistForSave, cacheMvpThumbnailGalleryForSave } from "@/lib/mvp-thumbnail-persist"
import { MvpAutoEditDialog } from "./MvpAutoEditDialog"
import { MvpEditPicksBar } from "./MvpEditPicksBar"
import { MvpPostEditStudio } from "./MvpPostEditStudio"
import { MvpProjectToolbar } from "./MvpProjectToolbar"
import { normalizeMvpPickUrls, refreshExpiredMvpEditPicks } from "@/lib/shotform-mvp-pick-video-download"
import { MvpCopyVideoUrlButton } from "./MvpCopyVideoUrlButton"
import { MvpVideoSaveButton } from "./MvpVideoSaveButton"
import { MvpVideoUrlKeywordPanel } from "./MvpVideoUrlKeywordPanel"
import { MvpXhsInlineVideoPreview } from "./MvpXhsMediaPreview"
import { formatMediaDurationLabel } from "@/lib/serpapi-product-search"
import { formatSearchRetryNotice, formatVideoPickLabel, MVP_LABELS as L, MVP_REPROCESS_SOURCE_ENABLED } from "./mvp-test-view-labels"

function shotformOpenAIKey(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_openai_api_key") || "").trim() || null
}

function shotformApifyToken(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_apify_token") || "").trim() || null
}

function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "?"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString("ko-KR")
}

function StepBadge({ done, n, label }: { done?: boolean; n: number; label: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", done ? "text-emerald-300" : "text-slate-500")}>
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          done ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40" : "bg-slate-800 text-slate-400"
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      {label}
    </div>
  )
}

function SourceVideoCard({
  video,
  platform,
  index,
  selected = false,
  onToggleSelect,
  selectDisabled = false,
}: {
  video: MvpKeywordVideo
  platform: "douyin" | "xiaohongshu"
  index: number
  selected?: boolean
  onToggleSelect?: () => void
  selectDisabled?: boolean
}) {
  const isDouyin = platform === "douyin"
  const canSelect = Boolean(video.videoUrl?.trim().startsWith("http"))
  const presenterLikely = isLikelyPresenterTitle(video.title)
  const selectBlocked = presenterLikely || (selectDisabled && !selected)
  const durationLabel = formatMediaDurationLabel(video.durationSec)

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-black/20 transition",
        selected ? "border-violet-500 ring-1 ring-violet-500/50" : isDouyin ? "border-amber-500/15" : "border-rose-500/15"
      )}
    >
      <div className="relative">
        {canSelect && onToggleSelect ? (
          <button
            type="button"
            className={cn(
              "absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md border shadow-lg transition",
              selected
                ? studio.btnSegmentActive
                : "border-white/20 bg-black/70 text-slate-300 hover:border-violet-400/60",
              selectBlocked && !selected ? "cursor-not-allowed opacity-40" : ""
            )}
            disabled={selectBlocked && !selected}
            title={
              presenterLikely
                ? L.videoCard.presenterTitle
                : selected
                  ? L.videoCard.deselect
                  : L.videoCard.add
            }
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleSelect()
            }}
          >
            {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </button>
        ) : null}
        <MvpXhsInlineVideoPreview
          videoUrl={video.videoUrl}
          thumbnail={video.thumbnail}
          title={video.title}
          aspectClass="aspect-[9/16]"
          loadPriority={index < 6 ? "eager" : "lazy"}
        />
        <span
          className={cn(
            "absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px]",
            isDouyin ? "bg-amber-950/80 text-amber-200" : "bg-rose-950/80 text-rose-200"
          )}
        >
          {isDouyin ? L.videoCard.douyin : L.videoCard.xhs}
        </span>
        {presenterLikely ? (
          <span className="pointer-events-none absolute left-2 top-8 rounded bg-amber-950/90 px-1 py-0.5 text-[9px] text-amber-200">
            {L.videoCard.presenterBadge}
          </span>
        ) : null}
        {durationLabel !== "?" ? (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
            {durationLabel}
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-medium text-white">{video.title}</p>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>{L.videoCard.length} {durationLabel}</span>
          <span>{L.videoCard.views} {formatCount(video.viewCount)}</span>
          <span>{L.videoCard.likes} {formatCount(video.likeCount)}</span>
          {video.relevanceScore != null ? (
            <span className={isDouyin ? "text-amber-300/80" : "text-rose-300/80"}>
              {L.videoCard.relevance} {video.relevanceScore}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MvpVideoSaveButton
            noteUrl={video.url}
            videoUrl={video.videoUrl}
            title={video.title}
            platform={platform}
          />
          <MvpCopyVideoUrlButton noteUrl={video.url} videoUrl={video.videoUrl} />
        </div>
      </div>
      {video.url ? (
        <div className="flex items-stretch border-t border-white/[0.06]">
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center gap-1 px-3 py-2 text-xs text-slate-400 hover:text-violet-300"
          >
            <ExternalLink className="h-3 w-3" />
            {L.videoCard.openOriginal}
          </a>
        </div>
      ) : (
        <div className="border-t border-white/[0.06] px-3 py-2">
          <MvpCopyVideoUrlButton noteUrl={video.url} videoUrl={video.videoUrl} />
        </div>
      )}
    </div>
  )
}

function PlatformResultSection({
  platform,
  result,
  retrying,
  retryError,
  onRetry,
  editPickKeys,
  onToggleVideoPick,
}: {
  platform: MvpKeywordPlatform
  result: MvpPlatformSourceResult
  retrying: boolean
  retryError: string | null
  onRetry: () => void
  editPickKeys: Set<string>
  onToggleVideoPick: (video: MvpKeywordVideo, platform: MvpKeywordPlatform) => void
}) {
  const isDouyin = platform === "douyin"
  const empty = result.videos.length === 0

  return (
    <StudioPageCard className={isDouyin ? "border-amber-500/15" : "border-rose-500/15"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className={studio.label}>
          {isDouyin ? L.platform.douyinTitle : L.platform.xhsTitle} ? {L.platform.videoCount}{" "}
          {result.videos.length}
          {L.platform.countUnit}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(studio.btnGhost, "shrink-0 text-xs")}
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              {isDouyin
                ? L.platform.retrying
                : `${L.platform.retrying} (?? ${MVP_XHS_PLATFORM_RETRY_MAX}?)`}
            </>
          ) : (
            <>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {isDouyin
                ? L.platform.retry
                : `${L.platform.retry} (${MVP_XHS_PLATFORM_RETRY_MAX}?)`}
            </>
          )}
        </Button>
      </div>
      {result.notice ? (
        <p className={cn("mt-1 text-xs", isDouyin ? "text-amber-200/70" : "text-rose-200/70")}>
          {result.notice}
        </p>
      ) : null}
      {retryError ? <p className="mt-2 text-xs text-red-300">{retryError}</p> : null}
      {retrying && empty ? (
        <div className="flex min-h-[120px] items-center justify-center gap-2 py-8 text-sm text-slate-400">
          <Loader2 className={cn("h-5 w-5 animate-spin", isDouyin ? "text-amber-400" : "text-rose-400")} />
          {isDouyin
            ? L.platform.retryingEmpty
            : `${L.platform.retryingEmpty} (?? ${MVP_XHS_PLATFORM_RETRY_MAX}? ??)`}
        </div>
      ) : empty ? (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-500">{L.platform.empty}</p>
          <p className="mt-1 text-xs text-slate-600">
            {isDouyin
              ? L.platform.emptyDouyin
              : L.platform.emptyXhs.replace("{max}", String(MVP_XHS_PLATFORM_RETRY_MAX))}
          </p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {result.videos.map((v, i) => {
            const key = videoPickKey(v.url, v.videoUrl)
            const selected = editPickKeys.has(key)
            return (
              <SourceVideoCard
                key={`${v.url}:${v.videoUrl}`}
                video={v}
                platform={platform}
                index={i}
                selected={selected}
                onToggleSelect={() => onToggleVideoPick(v, platform)}
                selectDisabled={!selected && editPickKeys.size >= MAX_AUTO_EDIT_VIDEOS}
              />
            )
          })}
        </div>
      )}
    </StudioPageCard>
  )
}

function inferMvpSourceMode(d: MvpTestProjectData): MvpSourceMode {
  if (MVP_REPROCESS_SOURCE_ENABLED) {
    if (d.sourceMode === "reprocess" || d.reprocessUrlText) return "reprocess"
    if (d.editPicks?.length && !d.sourceResult) {
      const platform = d.editPicks[0]?.platform
      if (platform === "youtube" || platform === "tiktok") return "reprocess"
    }
  }
  if (d.sourceMode === "direct_url" || d.directUrlText) return "direct_url"
  if (d.editPicks?.length && !d.sourceResult) return "direct_url"
  return "keyword"
}

function buildProjectData(args: {
  sourceMode: MvpSourceMode
  directUrlText: string
  reprocessUrlText: string
  keywordText: string
  multiKeyword: boolean
  keywordPairs: KoZhKeywordPair[]
  data: MvpKeywordSourceResult | null
  editPicks: AutoEditPick[]
  analyzedVideoUrl: string | null
  postEditStudio: { result: AutoEditJobResult; videoBlobUrl: string | null } | null
  postEditScriptOverrides: Record<string, string>
  postEditStudioData: MvpStudioPersistData
}): MvpTestProjectData {
  return {
    sourceMode: args.sourceMode,
    directUrlText: args.directUrlText || undefined,
    reprocessUrlText: args.reprocessUrlText || undefined,
    keywordText: args.keywordText,
    multiKeyword: args.multiKeyword,
    keywordPairs: args.keywordPairs,
    sourceResult: args.data,
    editPicks: args.editPicks,
    analyzedVideoUrl: args.analyzedVideoUrl,
    postEditResult: args.postEditStudio?.result ?? null,
    postEditScriptOverrides: args.postEditScriptOverrides,
    postEditStudioData: args.postEditStudioData,
  }
}

function projectDataSnapshot(args: Parameters<typeof buildProjectData>[0]): string {
  return safeJsonKey(prepareMvpProjectDataForSave(buildProjectData(args))) ?? ""
}

function formatSaveError(e: unknown): string {
  if (e instanceof Error) return e.message
  return L.errors.saveFailed
}

export type MvpTestViewProps = {
  project: MvpTestProject
  userId: string
  onBackToProjects: () => void
  onProjectUpdated: (project: MvpTestProject) => void
}

export function MvpTestView({ project, userId, onBackToProjects, onProjectUpdated }: MvpTestViewProps) {
  const studioRef = useRef<HTMLDivElement>(null)
  /** ??? ?? ? editPicks ?? ? studio ???? */
  const studioPicksKeyRef = useRef<string | null>(null)
  const skipTranslateOnceRef = useRef(false)
  const skipSaveRef = useRef(true)
  const lastSavedKeyRef = useRef<string | null>(null)
  const onProjectUpdatedRef = useRef(onProjectUpdated)
  onProjectUpdatedRef.current = onProjectUpdated
  const workspaceRef = useRef<{
    sourceMode: MvpSourceMode
    directUrlText: string
    reprocessUrlText: string
    keywordText: string
    multiKeyword: boolean
    keywordPairs: KoZhKeywordPair[]
    data: MvpKeywordSourceResult | null
    editPicks: AutoEditPick[]
    analyzedVideoUrl: string | null
    postEditStudio: { result: AutoEditJobResult; videoBlobUrl: string | null; videoBlob: Blob | null } | null
    postEditScriptOverrides: Record<string, string>
    postEditStudioData: MvpStudioPersistData
  } | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState(project.name)
  const projectNameRef = useRef(project.name)
  projectNameRef.current = projectName
  const [sourceMode, setSourceMode] = useState<MvpSourceMode>("keyword")
  const [directUrlText, setDirectUrlText] = useState("")
  const [reprocessUrlText, setReprocessUrlText] = useState("")
  const [directUrlResolved, setDirectUrlResolved] = useState<MvpResolvedUrlItem[]>([])
  const [reprocessPrefetchedBlobs, setReprocessPrefetchedBlobs] = useState<Record<string, Blob>>({})
  const [reprocessResolved, setReprocessResolved] = useState<MvpReprocessResolvedItem | null>(null)
  const [keywordText, setKeywordText] = useState("")
  const [multiKeyword, setMultiKeyword] = useState(false)
  const [keywordPairs, setKeywordPairs] = useState<KoZhKeywordPair[]>([])
  const [translateLoading, setTranslateLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [retryingDouyin, setRetryingDouyin] = useState(false)
  const [retryingXhs, setRetryingXhs] = useState(false)
  const [retryErrDouyin, setRetryErrDouyin] = useState<string | null>(null)
  const [retryErrXhs, setRetryErrXhs] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<MvpKeywordSourceResult | null>(null)
  const [editPicks, setEditPicks] = useState<AutoEditPick[]>([])
  const [autoEditOpen, setAutoEditOpen] = useState(false)
  const [pickHint, setPickHint] = useState<string | null>(null)
  const [pickUrlRefreshing, setPickUrlRefreshing] = useState(false)
  const [pickUrlRefreshMsg, setPickUrlRefreshMsg] = useState("")
  const pickUrlRefreshForProjectRef = useRef<string | null>(null)
  const editPicksRef = useRef(editPicks)
  editPicksRef.current = editPicks
  const [analyzedVideoUrl, setAnalyzedVideoUrl] = useState<string | null>(null)
  const [postEditStudio, setPostEditStudio] = useState<{
    result: AutoEditJobResult
    videoBlobUrl: string | null
    videoBlob: Blob | null
  } | null>(null)
  const [postEditScriptOverrides, setPostEditScriptOverrides] = useState<Record<string, string>>({})
  const [postEditStudioData, setPostEditStudioData] = useState<MvpStudioPersistData>({})

  workspaceRef.current = {
    sourceMode,
    directUrlText,
    reprocessUrlText,
    keywordText,
    multiKeyword,
    keywordPairs,
    data,
    editPicks,
    analyzedVideoUrl,
    postEditStudio,
    postEditScriptOverrides,
    postEditStudioData,
  }

  useEffect(() => {
    setProjectName(project.name)
  }, [project.id, project.name])

  useEffect(() => {
    return () => {
      const w = workspaceRef.current
      if (!w || !userId) return
      const trimmedName = projectNameRef.current.trim() || project.name
      void updateMvpTestProject(project.id, {
        name: trimmedName !== project.name ? trimmedName : undefined,
        data: prepareMvpProjectDataForSave(buildProjectData(w)),
      })
    }
  }, [project.id, project.name, userId])

  const editPickKeys = useMemo(() => new Set(editPicks.map((p) => p.key)), [editPicks])
  const editPicksKey = useMemo(() => editPicks.map((p) => p.key).join("|"), [editPicks])

  useEffect(() => {
    const d = project.data || {}
    studioPicksKeyRef.current = null
    skipTranslateOnceRef.current = Boolean(d.sourceResult || d.keywordPairs?.length)
    skipSaveRef.current = true
    setSourceMode(inferMvpSourceMode(d))
    setDirectUrlText(d.directUrlText ?? "")
    setReprocessUrlText(d.reprocessUrlText ?? "")
    setDirectUrlResolved([])
    setReprocessResolved(null)
    setKeywordText(d.keywordText ?? "")
    setMultiKeyword(Boolean(d.multiKeyword))
    setKeywordPairs(d.keywordPairs ?? [])
    setData(d.sourceResult ?? null)
    setEditPicks(
      (d.editPicks ?? []).map((p) => {
        const urls = normalizeMvpPickUrls({ url: p.noteUrl, videoUrl: p.videoUrl })
        if (urls.noteUrl === p.noteUrl && urls.videoUrl === p.videoUrl) return p
        return { ...p, noteUrl: urls.noteUrl, videoUrl: urls.videoUrl }
      })
    )
    setAnalyzedVideoUrl(d.analyzedVideoUrl ?? null)
    setErr(null)
    if (d.postEditResult) {
      setPostEditStudio({ result: d.postEditResult, videoBlobUrl: null, videoBlob: null })
      setPostEditScriptOverrides(d.postEditScriptOverrides ?? d.postEditStudioData?.scriptOverrides ?? {})
      setPostEditStudioData(d.postEditStudioData ?? {})
    } else {
      studioPicksKeyRef.current = null
      setPostEditStudio(null)
      setPostEditScriptOverrides({})
      setPostEditStudioData({})
    }
    lastSavedKeyRef.current = projectDataSnapshot({
      sourceMode: inferMvpSourceMode(d),
      directUrlText: d.directUrlText ?? "",
      reprocessUrlText: d.reprocessUrlText ?? "",
      keywordText: d.keywordText ?? "",
      multiKeyword: Boolean(d.multiKeyword),
      keywordPairs: d.keywordPairs ?? [],
      data: d.sourceResult ?? null,
      editPicks: d.editPicks ?? [],
      analyzedVideoUrl: d.analyzedVideoUrl ?? null,
      postEditStudio: d.postEditResult
        ? { result: d.postEditResult, videoBlobUrl: null }
        : null,
      postEditScriptOverrides: d.postEditScriptOverrides ?? d.postEditStudioData?.scriptOverrides ?? {},
      postEditStudioData: d.postEditStudioData ?? {},
    })
  }, [project.id])

  const handleStudioPersistChange = useCallback((data: MvpStudioPersistData) => {
    const slimmed = slimStudioPersistForSave(data)
    setPostEditStudioData((prev) => {
      const key = safeJsonKey(slimmed)
      const prevKey = safeJsonKey(prev)
      if (key && prevKey && prevKey === key) return prev
      return slimmed
    })
    if (slimmed.scriptOverrides && Object.keys(slimmed.scriptOverrides).length) {
      setPostEditScriptOverrides((prev) => {
        const key = safeJsonKey(slimmed.scriptOverrides)
        const prevKey = safeJsonKey(prev)
        if (key && prevKey && prevKey === key) return prev
        return slimmed.scriptOverrides!
      })
    }
    if (workspaceRef.current) {
      workspaceRef.current = {
        ...workspaceRef.current,
        postEditStudioData: slimmed,
        postEditScriptOverrides: slimmed.scriptOverrides ?? workspaceRef.current.postEditScriptOverrides,
      }
    }
  }, [])

  const commitProjectName = useCallback(async () => {
    const trimmed = projectNameRef.current.trim()
    if (!trimmed) {
      setProjectName(project.name)
      return true
    }
    if (trimmed === project.name) return true

    setSaveState("saving")
    setSaveError(null)
    try {
      const updated = await updateMvpTestProject(project.id, { name: trimmed })
      onProjectUpdatedRef.current(updated)
      setProjectName(updated.name)
      setSaveState("saved")
      window.setTimeout(() => setSaveState("idle"), 2000)
      return true
    } catch (e) {
      setSaveState("error")
      setSaveError(formatSaveError(e))
      setProjectName(project.name)
      return false
    }
  }, [project.id, project.name])

  const commitProjectNameRef = useRef(commitProjectName)
  commitProjectNameRef.current = commitProjectName

  const persistProject = useCallback(async (opts?: { force?: boolean }) => {
    if (!userId) {
      setSaveError(L.errors.noUserId)
      setSaveState("error")
      return false
    }
    const w = workspaceRef.current
    if (!w) return false

    const payload = prepareMvpProjectDataForSave(buildProjectData(w))
    const key = safeJsonKey(payload)
    if (!key) {
      setSaveState("error")
      setSaveError("프로젝트 데이터가 너무 커서 저장할 수 없습니다. 썸네일을 다시 생성해 주세요.")
      return false
    }
    if (!opts?.force && lastSavedKeyRef.current === key) {
      setSaveState("saved")
      window.setTimeout(() => setSaveState("idle"), 2000)
      return true
    }

    setSaveState("saving")
    setSaveError(null)
    try {
      try {
        await cacheMvpThumbnailGalleryForSave(project.id, w.postEditStudioData?.thumbnailGallery)
      } catch (e) {
        console.warn("[MvpTestView] thumbnail IDB cache failed:", e)
      }
      const updated = await updateMvpTestProject(project.id, { data: payload })
      lastSavedKeyRef.current = key
      onProjectUpdatedRef.current(updated)
      setSaveState("saved")
      window.setTimeout(() => setSaveState("idle"), 2000)
      return true
    } catch (e) {
      setSaveState("error")
      setSaveError(formatSaveError(e))
      return false
    }
  }, [userId, project.id])

  const persistProjectRef = useRef(persistProject)
  persistProjectRef.current = persistProject

  /** ??????(data) ?? ? ?? ?? (???? ? ? ? ?? ??) */
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false
      return
    }
    const timer = window.setTimeout(() => {
      void persistProjectRef.current()
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [
    sourceMode,
    directUrlText,
    reprocessUrlText,
    keywordText,
    multiKeyword,
    keywordPairs,
    editPicks,
    analyzedVideoUrl,
    postEditStudio,
    postEditScriptOverrides,
    postEditStudioData,
  ])

  useEffect(() => {
    if (postEditStudio) {
      if (studioPicksKeyRef.current === null) {
        studioPicksKeyRef.current = editPicksKey
      }
    } else {
      studioPicksKeyRef.current = null
    }
  }, [postEditStudio, editPicksKey])

  useEffect(() => {
    if (!postEditStudio) return
    const locked = studioPicksKeyRef.current
    if (locked === null || editPicksKey === locked) return
    setPostEditStudio(null)
    setPostEditScriptOverrides({})
    studioPicksKeyRef.current = null
    if (workspaceRef.current) {
      workspaceRef.current = {
        ...workspaceRef.current,
        postEditStudio: null,
        postEditScriptOverrides: {},
      }
    }
    void persistProjectRef.current({ force: true })
  }, [editPicksKey, postEditStudio])

  const toggleVideoPick = useCallback((video: MvpKeywordVideo, platform: MvpKeywordPlatform) => {
    if (!video.videoUrl?.trim().startsWith("http")) return
    if (isLikelyPresenterTitle(video.title)) {
      setPickHint(L.errors.presenterPick)
      window.setTimeout(() => setPickHint(null), 3500)
      return
    }
    const key = videoPickKey(video.url, video.videoUrl)
    setEditPicks((prev) => {
      const exists = prev.find((p) => p.key === key)
      if (exists) {
        return prev
          .filter((p) => p.key !== key)
          .map((p, i) => ({ ...p, video_id: `video_${String(i + 1).padStart(3, "0")}` }))
      }
      if (prev.length >= MAX_AUTO_EDIT_VIDEOS) {
        setPickHint(L.errors.maxEdit.replace("{max}", String(MAX_AUTO_EDIT_VIDEOS)))
        window.setTimeout(() => setPickHint(null), 3500)
        return prev
      }
      const urls = normalizeMvpPickUrls({ url: video.url, videoUrl: video.videoUrl })
      return [
        ...prev,
        {
          key,
          video_id: `video_${String(prev.length + 1).padStart(3, "0")}`,
          videoUrl: urls.videoUrl,
          title: video.title,
          noteUrl: urls.noteUrl,
          platform,
        },
      ]
    })
  }, [])

  const clearEditPicks = useCallback(() => {
    setEditPicks([])
    setAutoEditOpen(false)
    setPostEditStudio(null)
    setPostEditScriptOverrides({})
    studioPicksKeyRef.current = null
  }, [])

  const refreshSelectedPickUrls = useCallback(async () => {
    const current = editPicksRef.current
    if (!current.length) return current

    setPickUrlRefreshing(true)
    setPickUrlRefreshMsg("")
    try {
      const result = await refreshExpiredMvpEditPicks(current, setPickUrlRefreshMsg)
      if (result.refreshedCount > 0) {
        setEditPicks(result.picks)
        setPickHint(L.errors.urlRefreshed.replace("{count}", String(result.refreshedCount)))
        window.setTimeout(() => setPickHint(null), 4000)
      }
      if (result.errors.length) {
        const summary =
          result.errors.length === 1
            ? result.errors[0]!
            : L.errors.urlRefreshFail.replace("{first}", result.errors[0]).replace("{rest}", String(result.errors.length - 1))
        setPickHint(summary)
        window.setTimeout(() => setPickHint(null), 6000)
      }
      return result.picks
    } finally {
      setPickUrlRefreshing(false)
      setPickUrlRefreshMsg("")
    }
  }, [])

  useEffect(() => {
    if (pickUrlRefreshForProjectRef.current === project.id) return
    const saved = project.data?.editPicks ?? []
    pickUrlRefreshForProjectRef.current = project.id
    if (!saved.length) return

    void (async () => {
      setPickUrlRefreshing(true)
      try {
        const result = await refreshExpiredMvpEditPicks(saved, setPickUrlRefreshMsg)
        if (result.refreshedCount > 0) {
          setEditPicks(result.picks)
        }
        if (result.refreshedCount > 0 || result.errors.length) {
          const parts: string[] = []
          if (result.refreshedCount > 0) parts.push(L.errors.urlRefreshDone.replace("{count}", String(result.refreshedCount)))
          if (result.errors.length) parts.push(L.errors.urlRefreshErrors.replace("{count}", String(result.errors.length)))
          setPickHint(parts.join(" | "))
          window.setTimeout(() => setPickHint(null), 5000)
        }
      } finally {
        setPickUrlRefreshing(false)
        setPickUrlRefreshMsg("")
      }
    })()
  }, [project.id])

  const handleOpenAutoEdit = useCallback(async () => {
    await refreshSelectedPickUrls()
    setAutoEditOpen(true)
  }, [refreshSelectedPickUrls])

  const handleDirectUrlPicksReady = useCallback(
    (picks: AutoEditPick[], resolved: MvpResolvedUrlItem[]) => {
      setDirectUrlResolved(resolved)
      setEditPicks(picks)
      setPostEditStudio(null)
      setPostEditScriptOverrides({})
      studioPicksKeyRef.current = null
      setErr(null)
      skipSaveRef.current = true
    },
    []
  )

  const handleReprocessPicksReady = useCallback(
    (
      picks: AutoEditPick[],
      resolved: MvpReprocessResolvedItem,
      opts?: { prefetchedBlobs?: Record<string, Blob> }
    ) => {
      setReprocessResolved(resolved)
      setReprocessPrefetchedBlobs(opts?.prefetchedBlobs ?? {})
      setEditPicks(picks)
      setPostEditStudio(null)
      setPostEditScriptOverrides({})
      studioPicksKeyRef.current = null
      setErr(null)
      skipSaveRef.current = true
      setAutoEditOpen(true)
    },
    []
  )

  const switchSourceMode = useCallback((mode: MvpSourceMode) => {
    if (mode === "reprocess" && !MVP_REPROCESS_SOURCE_ENABLED) return
    if (mode === sourceMode) return
    setSourceMode(mode)
    setErr(null)
  }, [sourceMode])

  const applyKeywordsFromVideo = useCallback((keywords: string[]) => {
    const cleaned = keywords.map((k) => k.trim()).filter(Boolean)
    if (!cleaned.length) return
    if (cleaned.length === 1) {
      setMultiKeyword(false)
      setKeywordText(cleaned[0]!)
    } else {
      setMultiKeyword(true)
      setKeywordText(cleaned.join("\n"))
    }
    setKeywordPairs([])
    setData(null)
    clearEditPicks()
    setErr(null)
  }, [clearEditPicks])

  const koInputs = useMemo(
    () =>
      multiKeyword
        ? parseKoKeywordInputs(false, "", keywordText)
        : [keywordText.trim()].filter(Boolean),
    [keywordText, multiKeyword]
  )

  useEffect(() => {
    if (skipTranslateOnceRef.current) {
      skipTranslateOnceRef.current = false
      return
    }
    if (!koInputs.length) {
      setKeywordPairs([])
      return
    }
    const openai = shotformOpenAIKey()
    if (!openai) {
      setKeywordPairs([])
      return
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setTranslateLoading(true)
        try {
          const json = await fetchCnKeywordTranslation({
            keywords: koInputs,
            openaiApiKey: openai,
            platform: "xiaohongshu",
          }).catch(() => null)
          if (json?.pairs?.length) setKeywordPairs(json.pairs)
        } finally {
          setTranslateLoading(false)
        }
      })()
    }, KEYWORD_TRANSLATE_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [koInputs])

  const runSourceSearch = useCallback(async () => {
    setErr(null)
    setData(null)
    clearEditPicks()

    if (!koInputs.length) {
      setErr(L.errors.keywordRequired)
      return
    }

    const openai = shotformOpenAIKey()
    if (!openai) {
      setErr(L.errors.openaiKey)
      return
    }

    const apify = shotformApifyToken()
    if (!apify) {
      setErr(L.errors.apifyToken)
      return
    }

    setLoading(true)
    try {
      let pairs = keywordPairs
      let searchQueries = pairs.map((p) => p.zh)

      if (!searchQueries.length) {
        const resolved = await fetchCnKeywordTranslation({
          keywords: koInputs,
          openaiApiKey: openai,
          platform: "xiaohongshu",
        })
        pairs = resolved.pairs
        searchQueries = resolved.searchQueries
        setKeywordPairs(pairs)
      }

      const res = await fetch("/api/shotform/mvp-keyword-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: koInputs,
          keywordPairs: pairs,
          searchQueries,
          openaiApiKey: openai,
          apifyApiKey: apify,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as MvpKeywordSourceResult & { error?: string }
      if (!res.ok) {
        setErr(json.error || `${L.errors.sourceFail} (${res.status})`)
        return
      }
      setData(json)
      if (json.keywordPairs?.length) setKeywordPairs(json.keywordPairs)
      skipSaveRef.current = true
    } catch (e) {
      setErr(e instanceof Error ? e.message : L.errors.network)
    } finally {
      setLoading(false)
    }
  }, [koInputs, keywordPairs, clearEditPicks])

  const retryPlatform = useCallback(
    async (platform: MvpKeywordPlatform) => {
      if (!data?.searchQueries?.length) {
        setErr(L.errors.searchFirst)
        return
      }

      const apify = shotformApifyToken()
      if (!apify) {
        const msg = L.errors.apifyRequired
        if (platform === "douyin") setRetryErrDouyin(msg)
        else setRetryErrXhs(msg)
        return
      }

      if (platform === "douyin") {
        setRetryErrDouyin(null)
        setRetryingDouyin(true)
      } else {
        setRetryErrXhs(null)
        setRetryingXhs(true)
      }

      try {
        const res = await fetch("/api/shotform/mvp-keyword-source", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keywords: koInputs.length ? koInputs : data.searchQueries,
            keywordPairs: data.keywordPairs,
            searchQueries: data.searchQueries,
            apifyApiKey: apify,
            platform,
            ...(platform === "xiaohongshu" ? { maxAttempts: MVP_XHS_PLATFORM_RETRY_MAX } : {}),
          }),
        })
        const json = (await res.json().catch(() => ({}))) as {
          platform?: MvpKeywordPlatform
          result?: MvpPlatformSourceResult
          error?: string
        }
        if (!res.ok || !json.result) {
          throw new Error(json.error || `${L.errors.retryFail} (${res.status})`)
        }

        setData((prev) => {
          if (!prev) return prev
          const next =
            platform === "douyin"
              ? { ...prev, douyin: json.result! }
              : { ...prev, xhs: json.result! }
          return {
            ...next,
            notice: formatSearchRetryNotice(prev.searchQueries, next.douyin.videos.length, next.xhs.videos.length),
          }
        })
        skipSaveRef.current = true
      } catch (e) {
        const msg = e instanceof Error ? e.message : L.errors.retryFail
        if (platform === "douyin") setRetryErrDouyin(msg)
        else setRetryErrXhs(msg)
      } finally {
        if (platform === "douyin") setRetryingDouyin(false)
        else setRetryingXhs(false)
      }
    },
    [data, koInputs]
  )

  const ttsDone = Boolean(postEditStudioData.voiceLineCues?.length)

  const studioPhase = normalizeStudioPhase(postEditStudioData.phase)

  const stepsDone = useMemo(() => {
    const isDirect = sourceMode === "direct_url"
    const isReprocess = sourceMode === "reprocess"
    return {
      s1: isReprocess
        ? reprocessUrlText.trim().length > 0
        : isDirect
          ? directUrlText.trim().length > 0
          : koInputs.length > 0,
      s2: isReprocess
        ? Boolean(reprocessResolved?.videoUrl.startsWith("http"))
        : isDirect
          ? directUrlResolved.some((i) => i.videoUrl.startsWith("http"))
          : keywordPairs.length > 0 || Boolean(data?.searchQueries.length),
      s3: isReprocess || isDirect
        ? editPicks.length > 0
        : Boolean(data && (data.douyin.videos.length > 0 || data.xhs.videos.length > 0)),
      s4: editPicks.length > 0,
      s5: postEditStudio != null && ttsDone,
      s6: postEditStudio != null && (studioPhase === "script-style" || studioPhase === "thumbnail" || studioPhase === "export"),
      s7: postEditStudio != null && (studioPhase === "thumbnail" || studioPhase === "export"),
      s8: postEditStudio != null && studioPhase === "export",
    }
  }, [
    sourceMode,
    directUrlText,
    reprocessUrlText,
    directUrlResolved,
    reprocessResolved,
    koInputs.length,
    keywordPairs.length,
    data,
    editPicks.length,
    postEditStudio,
    ttsDone,
    studioPhase,
  ])

  const handleStudioReady = useCallback(
    (args: { result: AutoEditJobResult; videoBlobUrl: string | null; videoBlob: Blob | null }) => {
      const studioData: MvpStudioPersistData = {
        phase: "edit",
        editMp4CachedJobId: args.result.jobId || undefined,
      }
      setPostEditScriptOverrides({})
      setPostEditStudioData(studioData)
      setPostEditStudio(args)
      if (workspaceRef.current) {
        workspaceRef.current = {
          ...workspaceRef.current,
          postEditStudio: args,
          postEditScriptOverrides: {},
          postEditStudioData: studioData,
        }
      }
      setAutoEditOpen(false)
      void persistProjectRef.current({ force: true })
      window.requestAnimationFrame(() => {
        studioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    },
    [editPicks]
  )

  const handleBackToProjects = useCallback(async () => {
    await commitProjectNameRef.current()
    await persistProjectRef.current({ force: true })
    onBackToProjects()
  }, [onBackToProjects])

  return (
    <div className="space-y-6 pb-16">
      <MvpProjectToolbar
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onProjectNameCommit={() => void commitProjectName()}
        saveState={saveState}
        saveError={saveError}
        onSave={() => void (async () => {
          await commitProjectName()
          await persistProject({ force: true })
        })()}
        onBackToProjects={() => void handleBackToProjects()}
      />

      <StudioPageHeader
        icon={Zap}
        title={projectName}
        editableTitle={{
          value: projectName,
          onChange: setProjectName,
          onCommit: () => void commitProjectName(),
        }}
      />

      <StudioPageCard>
        <p className={studio.label}>{L.sourceFind}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => switchSourceMode("keyword")}
            disabled={loading}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition",
              sourceMode === "keyword" ? studio.btnTabActive : studio.btnTabIdle
            )}
          >
            {L.tabKeyword}
          </button>
          <button
            type="button"
            onClick={() => switchSourceMode("direct_url")}
            disabled={loading}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition",
              sourceMode === "direct_url" ? studio.btnTabActive : studio.btnTabIdle
            )}
          >
            {L.tabDirectUrl}
          </button>
          {MVP_REPROCESS_SOURCE_ENABLED ? (
            <button
              type="button"
              onClick={() => switchSourceMode("reprocess")}
              disabled={loading}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm transition",
                sourceMode === "reprocess" ? studio.btnTabActive : studio.btnTabIdle
              )}
            >
              {L.tabReprocess}
            </button>
          ) : null}
        </div>

        {sourceMode === "keyword" ? (
          <>
            <MvpVideoUrlKeywordPanel
              disabled={loading}
              onApplyKeywords={applyKeywordsFromVideo}
              onAnalyzedUrl={setAnalyzedVideoUrl}
            />

            <p className="mt-4 text-xs text-slate-500">{L.keywordHint}</p>

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={multiKeyword}
                onChange={(e) => setMultiKeyword(e.target.checked)}
                disabled={loading}
              />
              <span>{L.multiKeyword}</span>
            </label>

            {multiKeyword ? (
              <textarea
                value={keywordText}
                onChange={(e) => setKeywordText(e.target.value)}
                rows={3}
                disabled={loading}
                placeholder={L.multiKeywordPlaceholder}
                className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            ) : (
              <input
                type="text"
                value={keywordText}
                onChange={(e) => setKeywordText(e.target.value)}
                disabled={loading}
                placeholder={L.keywordPlaceholder}
                className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) void runSourceSearch()
                }}
              />
            )}

            {translateLoading ? (
              <p className="mt-2 text-xs text-slate-500">{L.translating}</p>
            ) : keywordPairs.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {keywordPairs.map((p) => (
                  <span
                    key={`${p.ko}:${p.zh}`}
                    className="rounded-lg border border-violet-500/25 bg-violet-950/20 px-2 py-1 text-xs text-violet-100"
                  >
                    {p.ko} ? <span className="font-medium text-amber-200">{p.zh}</span>
                  </span>
                ))}
              </div>
            ) : !shotformOpenAIKey() ? (
              <p className="mt-2 text-xs text-amber-400/90">{L.openaiKeyHint}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={loading || !koInputs.length}
                onClick={() => void runSourceSearch()}
                className={cn(
                  studio.btnPrimary,
                  "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {L.searching}
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    {L.searchBtn}
                  </>
                )}
              </button>
            </div>
          </>
        ) : sourceMode === "direct_url" ? (
          <>
            <p className="mt-3 text-xs text-slate-500">{L.directUrlHint}</p>
            <MvpDirectUrlPickPanel
              disabled={loading}
              urlText={directUrlText}
              onUrlTextChange={setDirectUrlText}
              resolved={directUrlResolved}
              onResolvedChange={setDirectUrlResolved}
              onPicksReady={handleDirectUrlPicksReady}
              onPicksClear={() => {
                setEditPicks([])
                setAutoEditOpen(false)
              }}
              onError={setErr}
            />
          </>
        ) : MVP_REPROCESS_SOURCE_ENABLED && sourceMode === "reprocess" ? (
          <>
            <p className="mt-3 text-xs text-slate-500">{L.reprocessHint}</p>
            <MvpReprocessUrlPanel
              disabled={loading}
              urlText={reprocessUrlText}
              onUrlTextChange={setReprocessUrlText}
              resolved={reprocessResolved}
              onResolvedChange={setReprocessResolved}
              onPicksReady={handleReprocessPicksReady}
              onPicksClear={() => {
                setEditPicks([])
                setAutoEditOpen(false)
              }}
              onError={setErr}
            />
          </>
        ) : null}

        {err ? <p className="mt-3 text-sm text-red-300">{err}</p> : null}
        {sourceMode === "keyword" && data?.notice ? (
          <p className="mt-3 text-xs text-violet-200/80">{data.notice}</p>
        ) : null}
      </StudioPageCard>

      {sourceMode === "keyword" && loading ? (
        <StudioPageCard className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          <span>{L.apifyLoading}</span>
        </StudioPageCard>
      ) : null}

      {sourceMode === "direct_url" && editPicks.length > 0 ? (
        <StudioPageCard className="bg-white/[0.02]">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <StepBadge done={stepsDone.s1} n={1} label={L.steps.urlInput} />
            <StepBadge done={stepsDone.s2} n={2} label={L.steps.urlResolve} />
            <StepBadge done={stepsDone.s3} n={3} label={formatVideoPickLabel(editPicks.length, MAX_AUTO_EDIT_VIDEOS)} />
            <StepBadge done={stepsDone.s4} n={4} label={L.steps.aiEdit} />
            <StepBadge done={stepsDone.s5} n={5} label={L.steps.videoEdit} />
            <StepBadge done={stepsDone.s6} n={6} label={L.steps.scriptSubtitle} />
            <StepBadge done={stepsDone.s7} n={7} label={L.steps.thumbnail} />
            <StepBadge done={stepsDone.s8} n={8} label={L.steps.export} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {L.footer.direct.replace("{count}", String(editPicks.length))}
          </p>
        </StudioPageCard>
      ) : null}

      {MVP_REPROCESS_SOURCE_ENABLED && sourceMode === "reprocess" && editPicks.length > 0 ? (
        <StudioPageCard className="bg-white/[0.02]">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <StepBadge done={stepsDone.s1} n={1} label={L.steps.urlInput} />
            <StepBadge done={stepsDone.s2} n={2} label={L.steps.urlResolve} />
            <StepBadge done={stepsDone.s3} n={3} label={formatVideoPickLabel(editPicks.length, MAX_AUTO_EDIT_VIDEOS)} />
            <StepBadge done={stepsDone.s4} n={4} label={L.steps.aiEdit} />
            <StepBadge done={stepsDone.s5} n={5} label={L.steps.videoEdit} />
            <StepBadge done={stepsDone.s6} n={6} label={L.steps.scriptSubtitle} />
            <StepBadge done={stepsDone.s7} n={7} label={L.steps.thumbnail} />
            <StepBadge done={stepsDone.s8} n={8} label={L.steps.export} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{L.footer.reprocess}</p>
        </StudioPageCard>
      ) : null}

      {sourceMode === "keyword" && data ? (
        <>
          <StudioPageCard className="bg-white/[0.02]">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <StepBadge done={stepsDone.s1} n={1} label={L.steps.keywordInput} />
              <StepBadge done={stepsDone.s2} n={2} label={L.steps.zhConvert} />
              <StepBadge done={stepsDone.s3} n={3} label={L.steps.sourceSearch} />
              <StepBadge done={stepsDone.s4} n={4} label={formatVideoPickLabel(editPicks.length, MAX_AUTO_EDIT_VIDEOS)} />
              <StepBadge done={stepsDone.s5} n={5} label={L.steps.aiEdit} />
              <StepBadge done={stepsDone.s6} n={6} label={L.steps.videoEdit} />
              <StepBadge done={stepsDone.s7} n={7} label={L.steps.scriptSubtitle} />
              <StepBadge done={stepsDone.s8} n={8} label={L.steps.export} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {L.footer.keyword.replace("{max}", String(MAX_AUTO_EDIT_VIDEOS))}
            </p>
          </StudioPageCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <PlatformResultSection
              platform="douyin"
              result={data.douyin}
              retrying={retryingDouyin}
              retryError={retryErrDouyin}
              onRetry={() => void retryPlatform("douyin")}
              editPickKeys={editPickKeys}
              onToggleVideoPick={toggleVideoPick}
            />
            <PlatformResultSection
              platform="xiaohongshu"
              result={data.xhs}
              retrying={retryingXhs}
              retryError={retryErrXhs}
              onRetry={() => void retryPlatform("xiaohongshu")}
              editPickKeys={editPickKeys}
              onToggleVideoPick={toggleVideoPick}
            />
          </div>
        </>
      ) : null}

      {pickHint ? (
        <p className="fixed bottom-24 left-1/2 z-30 max-w-md -translate-x-1/2 rounded-lg border border-amber-500/40 bg-amber-950/95 px-3 py-2 text-center text-xs text-amber-100 shadow-lg">
          {pickHint}
        </p>
      ) : null}

      {postEditStudio ? (
        <div ref={studioRef}>
          <MvpPostEditStudio
            projectId={project.id}
            projectName={projectName}
            sourceKeywords={koInputs}
            result={postEditStudio.result}
            videoBlobUrl={postEditStudio.videoBlobUrl}
            videoBlob={postEditStudio.videoBlob}
            scriptOverrides={postEditScriptOverrides}
            onScriptOverridesChange={setPostEditScriptOverrides}
            studioPersist={postEditStudioData}
            onStudioPersistChange={handleStudioPersistChange}
            onClose={() => {
              setPostEditStudio(null)
              setPostEditScriptOverrides({})
              setPostEditStudioData({})
            }}
          />
        </div>
      ) : null}

      {(editPicks.length > 0 || postEditStudio) ? (
        <MvpEditPicksBar
          picks={editPicks}
          editComplete={postEditStudio != null}
          urlRefreshing={pickUrlRefreshing}
          urlRefreshMsg={pickUrlRefreshMsg}
          onClearPicks={clearEditPicks}
          onRefreshUrls={() => void refreshSelectedPickUrls()}
          onOpenAutoEdit={() => void handleOpenAutoEdit()}
        />
      ) : null}

      <MvpAutoEditDialog
        projectName={projectName}
        sourceKeywords={koInputs}
        open={autoEditOpen && editPicks.length > 0}
        onOpenChange={(open) => {
          setAutoEditOpen(open)
          if (!open) setReprocessPrefetchedBlobs({})
        }}
        picks={editPicks}
        projectId={project.id}
        onPicksUpdated={setEditPicks}
        onStudioReady={handleStudioReady}
        initialPrefetchedBlobs={reprocessPrefetchedBlobs}
      />
    </div>
  )
}

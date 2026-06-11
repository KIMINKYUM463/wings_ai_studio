"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckSquare, ExternalLink, FlaskConical, Loader2, RefreshCw, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { XHS_VIDEO_APIFY_ACTORS } from "@/lib/apify-xhs-video-actors"
import { MvpVideoSaveButton } from "./MvpVideoSaveButton"
import { MvpAutoEditDialog } from "./MvpAutoEditDialog"
import { MvpXhsInlineVideoPreview, xhsThumbProxy } from "./MvpXhsMediaPreview"
import { StudioPageCard, studio } from "../components/ShotFormStudioUI"
import {
  MAX_AUTO_EDIT_VIDEOS,
  type AutoEditPick,
  videoPickKey,
} from "@/lib/shotform-auto-edit-types"
import { isLikelyPresenterTitle } from "@/lib/shotform-auto-edit-product-filter"
import {
  fetchCnKeywordTranslation,
  KEYWORD_TRANSLATE_DEBOUNCE_MS,
  MASS_KEYWORD_KO,
  parseKoKeywordInputs,
  PRESET_KEYWORDS_KO,
  type KoZhKeywordPair,
} from "@/lib/shotform-cn-keyword-translate-client"

type StoreActor = {
  id: string
  slug: string
  label: string
  role: string
  searchable?: boolean
  storeRole?: string
  description?: string
  storeUrl?: string
  stats?: {
    totalRuns: number
    totalUsers: number
    successRate30dPct: number | null
  }
}

type VideoItem = {
  title: string
  thumbnail: string
  noteUrl: string
  videoUrl: string
  likeCount: number | null
  viewCount: number | null
  author: string | null
  actorLabel?: string
}

type BenchmarkReport = {
  keywords: string[]
  keywordPairs?: KoZhKeywordPair[]
  summary: Array<{
    actorId: string
    actorSlug: string
    actorLabel: string
    role: string
    totalRaw: number
    totalMapped: number
    avgDurationSec: number
    avgVideoRatioPct: number
    likeCoveragePct: number
    thumbCoveragePct: number
    downloadCoveragePct: number
    score: number
    totalVideoItems?: number
  }>
  results: Array<{
    actorId: string
    actorLabel: string
    actorSlug: string
    keyword: string
    durationSec: number
    error: string | null
    metrics: {
      rawCount: number
      mappedCount: number
      withLikeCount: number
      withThumbnail: number
      withVideoUrl: number
      videoRatioPct: number
      videoItemCount?: number
    }
    videoItems?: VideoItem[]
    samples: Array<{
      noteUrl: string | null
      title: string | null
      thumbnail?: string | null
      likeCount: number | null
      videoUrl: string | null
      hasVideo: boolean
      mapped?: { thumbnail?: string; title?: string; url?: string } | null
    }>
  }>
  notice?: string
  batch?: { offset: number; batchSize: number; totalActors: number; hasMore: boolean }
}

const DEFAULT_BATCH = 3
/** socialdatax 간헐 0건 — 영상 나올 때까지 자동 재시도 */
const MAX_BENCHMARK_ATTEMPTS = 10
const BENCHMARK_RETRY_DELAY_MS = 2500
/** 첫 N개 카드는 스크롤 대기 없이 즉시 영상 로드 */
const EAGER_INLINE_VIDEO_COUNT = 12

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function countBenchmarkVideos(results: BenchmarkReport["results"]): number {
  let n = 0
  for (const r of results) {
    n += getRunVideoItems(r).length
  }
  return n
}

function shotformApifyToken(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_apify_token") || "").trim() || null
}

function shotformOpenAIKey(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_openai_api_key") || "").trim() || null
}

function mergeSummaries(a: BenchmarkReport["summary"], b: BenchmarkReport["summary"]): BenchmarkReport["summary"] {
  const map = new Map<string, BenchmarkReport["summary"][0]>()
  for (const row of [...a, ...b]) {
    const prev = map.get(row.actorId)
    if (!prev) {
      map.set(row.actorId, { ...row })
      continue
    }
    map.set(row.actorId, {
      ...prev,
      totalRaw: prev.totalRaw + row.totalRaw,
      totalMapped: prev.totalMapped + row.totalMapped,
      totalVideoItems: (prev.totalVideoItems ?? 0) + (row.totalVideoItems ?? 0),
      avgDurationSec: Math.round((prev.avgDurationSec + row.avgDurationSec) / 2),
      avgVideoRatioPct: Math.round((prev.avgVideoRatioPct + row.avgVideoRatioPct) / 2),
      likeCoveragePct: Math.round((prev.likeCoveragePct + row.likeCoveragePct) / 2),
      thumbCoveragePct: Math.round((prev.thumbCoveragePct + row.thumbCoveragePct) / 2),
      downloadCoveragePct: Math.round((prev.downloadCoveragePct + row.downloadCoveragePct) / 2),
      score: Math.round((prev.score + row.score) * 10) / 20,
    })
  }
  return [...map.values()].sort((x, y) => (y.totalVideoItems ?? 0) - (x.totalVideoItems ?? 0) || y.score - x.score)
}

function getRunVideoItems(r: BenchmarkReport["results"][0]): VideoItem[] {
  if (r.videoItems?.length) return r.videoItems
  return (r.samples || [])
    .filter((s) => s.hasVideo || s.videoUrl || s.thumbnail)
    .map((s) => ({
      title: s.title || s.mapped?.title || "(제목 없음)",
      thumbnail: s.thumbnail || s.mapped?.thumbnail || "",
      noteUrl: s.noteUrl || s.mapped?.url || "",
      videoUrl: s.videoUrl || "",
      likeCount: s.likeCount,
      viewCount: null,
      author: null,
    }))
}

function proxyThumb(url: string): string {
  return xhsThumbProxy(url)
}

function VideoThumbCard({
  item,
  keyword,
  actorLabel,
  loadPriority = "lazy",
  selected = false,
  onToggleSelect,
  selectDisabled = false,
}: {
  item: VideoItem
  keyword: string
  actorLabel?: string
  loadPriority?: "eager" | "lazy"
  selected?: boolean
  onToggleSelect?: () => void
  selectDisabled?: boolean
}) {
  const badge = actorLabel || item.actorLabel
  const canSelect = Boolean(item.videoUrl?.trim().startsWith("http"))
  const presenterLikely = isLikelyPresenterTitle(item.title)
  const selectBlocked = presenterLikely || (selectDisabled && !selected)
  return (
    <div
      className={cn(
        "group overflow-hidden rounded-xl border bg-black/30 transition",
        selected ? "border-violet-500 ring-1 ring-violet-500/50" : "border-white/10 hover:border-rose-500/40"
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
                ? "인물 소개형 — 짜집기 불가 (제품/사용 장면만)"
                : selected
                  ? "선택 해제"
                  : "짜집기 편집에 추가"
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
          videoUrl={item.videoUrl}
          thumbnail={item.thumbnail}
          title={item.title}
          aspectClass="aspect-[3/4]"
          loadPriority={loadPriority}
        />
        <span className="pointer-events-none absolute left-1.5 top-1.5 z-[1] rounded bg-black/75 px-1 py-0.5 text-[9px] text-rose-200">
          {item.videoUrl ? "▶ 영상" : "📷 노트"}
        </span>
        {badge ? (
          <span className="pointer-events-none absolute left-1.5 right-9 top-8 z-[1] truncate rounded bg-black/80 px-1 py-0.5 text-[9px] text-violet-200">
            {badge}
          </span>
        ) : null}
        {presenterLikely ? (
          <span className="pointer-events-none absolute left-1.5 top-[3.25rem] z-[1] rounded bg-amber-950/90 px-1 py-0.5 text-[9px] text-amber-200">
            인물소개
          </span>
        ) : null}
        </div>
      <div className="p-2">
        <p className="line-clamp-2 text-xs font-medium text-white">{item.title}</p>
        <p className="mt-1 text-[10px] text-amber-200/80">키워드: {keyword}</p>
        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
          {item.likeCount != null ? <span>♥ {item.likeCount.toLocaleString()}</span> : null}
          {item.viewCount != null ? <span>▶ {item.viewCount.toLocaleString()}</span> : null}
          {item.author ? <span className="truncate">{item.author}</span> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MvpVideoSaveButton
            noteUrl={item.noteUrl}
            videoUrl={item.videoUrl}
            title={item.title}
            platform="xiaohongshu"
          />
        </div>
      </div>
    </div>
  )
}

export function XhsActorBenchmarkPanel() {
  const [storeActors, setStoreActors] = useState<StoreActor[]>([])
  const [discoverLoading, setDiscoverLoading] = useState(false)

  const [keywordsText, setKeywordsText] = useState(PRESET_KEYWORDS_KO.join("\n"))
  const [massKeywordKo, setMassKeywordKo] = useState(MASS_KEYWORD_KO)
  const [keywordPairs, setKeywordPairs] = useState<KoZhKeywordPair[]>([])
  const [translateLoading, setTranslateLoading] = useState(false)
  const [massMode, setMassMode] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<BenchmarkReport | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [showAllActors, setShowAllActors] = useState(false)
  const [editPicks, setEditPicks] = useState<AutoEditPick[]>([])
  const [autoEditOpen, setAutoEditOpen] = useState(false)
  const [pickHint, setPickHint] = useState<string | null>(null)

  const editPickKeys = useMemo(() => new Set(editPicks.map((p) => p.key)), [editPicks])

  const toggleVideoPick = useCallback((item: VideoItem) => {
    if (!item.videoUrl?.trim().startsWith("http")) return
    if (isLikelyPresenterTitle(item.title)) {
      setPickHint("인물 소개형 영상은 짜집기에 사용할 수 없습니다. 제품/사용 장면만 선택해 주세요.")
      window.setTimeout(() => setPickHint(null), 3500)
      return
    }
    const key = videoPickKey(item.noteUrl, item.videoUrl)
    setEditPicks((prev) => {
      const exists = prev.find((p) => p.key === key)
      if (exists) {
        return prev
          .filter((p) => p.key !== key)
          .map((p, i) => ({ ...p, video_id: `video_${String(i + 1).padStart(3, "0")}` }))
      }
      if (prev.length >= MAX_AUTO_EDIT_VIDEOS) return prev
      return [
        ...prev,
        {
          key,
          video_id: `video_${String(prev.length + 1).padStart(3, "0")}`,
          videoUrl: item.videoUrl,
          title: item.title,
          noteUrl: item.noteUrl,
          platform: "xiaohongshu",
        },
      ]
    })
  }, [])

  const clearEditPicks = useCallback(() => {
    setEditPicks([])
    setAutoEditOpen(false)
  }, [])

  const loadStore = useCallback(async () => {
    setDiscoverLoading(true)
    setErr(null)
    try {
      const res = await fetch("/api/shotform/xhs-actor-benchmark?discover=1")
      const json = (await res.json()) as {
        actors?: StoreActor[]
        discoveredCount?: number
        searchableCount?: number
        error?: string
      }
      if (!res.ok) {
        setErr(json.error || "Store 목록 로드 실패")
        return
      }
      setStoreActors(json.actors || [])
      setSelected(new Set((json.actors || []).map((a) => a.slug)))
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Store 로드 오류")
    } finally {
      setDiscoverLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStore()
  }, [loadStore])

  const koInputsForPreview = useMemo(
    () => parseKoKeywordInputs(massMode, massKeywordKo, keywordsText),
    [massMode, massKeywordKo, keywordsText]
  )

  useEffect(() => {
    const inputs = koInputsForPreview
    if (!inputs.length) {
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
            keywords: inputs,
            openaiApiKey: openai,
            platform: "xiaohongshu",
          }).catch(() => null)
          if (json?.pairs?.length) setKeywordPairs(json.pairs)
        } catch {
          /* preview only */
        } finally {
          setTranslateLoading(false)
        }
      })()
    }, KEYWORD_TRANSLATE_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [koInputsForPreview])

  const resolveSearchKeywords = useCallback(async (koInputs: string[]) => {
    const openai = shotformOpenAIKey()
    return fetchCnKeywordTranslation({
      keywords: koInputs,
      openaiApiKey: openai,
      platform: "xiaohongshu",
    })
  }, [])

  const toggle = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(storeActors.map((a) => a.slug)))
  const clearSelected = () => setSelected(new Set())

  const runBenchmark = useCallback(async () => {
    setErr(null)
    setData(null)
    setRetryAttempt(0)
    const apify = shotformApifyToken()
    if (!apify) {
      setErr("소스 검색 토큰을 저장해주세요.")
      return
    }

    const slugs = [...selected]
    if (!slugs.length) {
      setErr("비교할 Actor를 1개 이상 선택해주세요.")
      return
    }

    const koInputs = parseKoKeywordInputs(massMode, massKeywordKo, keywordsText)
    if (!koInputs.length) {
      setErr("키워드를 입력해주세요.")
      return
    }

    setLoading(true)
    let keywordPairsResolved: Array<{ ko: string; zh: string }> = []
    let keywords: string[] = []

    try {
      setProgress({ done: 0, total: 1, label: "한국어 → 中文 변환…" })
      const resolved = await resolveSearchKeywords(koInputs)
      keywordPairsResolved = resolved.pairs
      keywords = resolved.searchQueries
      setKeywordPairs(resolved.pairs)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "키워드 변환 오류")
      setLoading(false)
      return
    }

    const batchSize = DEFAULT_BATCH
    const totalBatches = Math.ceil(slugs.length / batchSize)

    const runOnce = async (): Promise<{
      summary: BenchmarkReport["summary"]
      results: BenchmarkReport["results"]
      notice: string
      fatalError: string | null
    }> => {
      let mergedSummary: BenchmarkReport["summary"] = []
      let mergedResults: BenchmarkReport["results"] = []
      let lastNotice = ""
      let fatalError: string | null = null

      for (let b = 0; b < totalBatches; b++) {
        const batchSlugs = slugs.slice(b * batchSize, b * batchSize + batchSize)
        setProgress({
          done: b,
          total: totalBatches,
          label: batchSlugs.map((s) => s.split("/")[1]).join(", "),
        })

        const res = await fetch("/api/shotform/xhs-actor-benchmark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apifyApiKey: apify,
            actorSlugs: batchSlugs,
            keywords,
            searchableOnly: true,
            batchOffset: 0,
            batchSize: batchSlugs.length,
          }),
        })
        const json = (await res.json().catch(() => ({}))) as BenchmarkReport & { error?: string }
        if (!res.ok) {
          const msg = json.error || `배치 ${b + 1} 실패 (${res.status})`
          if (res.status === 400 || res.status === 401 || res.status === 403) {
            fatalError = msg
            break
          }
          lastNotice = msg
          continue
        }
        mergedSummary = mergeSummaries(mergedSummary, json.summary || [])
        mergedResults = [...mergedResults, ...(json.results || [])]
        lastNotice = json.notice || lastNotice
      }

      return { summary: mergedSummary, results: mergedResults, notice: lastNotice, fatalError }
    }

    try {
      let lastPayload: Awaited<ReturnType<typeof runOnce>> | null = null

      for (let attempt = 1; attempt <= MAX_BENCHMARK_ATTEMPTS; attempt++) {
        setRetryAttempt(attempt)
        if (attempt > 1) {
          setProgress({
            done: 0,
            total: totalBatches,
            label: `영상 0건 · ${attempt}/${MAX_BENCHMARK_ATTEMPTS}회 재시도 대기…`,
          })
          await sleep(BENCHMARK_RETRY_DELAY_MS)
        }

        const payload = await runOnce()
        lastPayload = payload

        if (payload.fatalError) {
          setErr(payload.fatalError)
          break
        }

        const videoCount = countBenchmarkVideos(payload.results)
        if (videoCount > 0) {
          setProgress({ done: totalBatches, total: totalBatches, label: "완료" })
          setData({
            keywords,
            keywordPairs: keywordPairsResolved,
            summary: payload.summary,
            results: payload.results,
            notice:
              (attempt > 1
                ? `${attempt}회 시도 후 영상 ${videoCount}건 수집 · `
                : "") +
              `검색어 ${keywords.join(" · ")} · ${payload.results.length}회 API 호출`,
          })
          setRetryAttempt(0)
          return
        }

        if (attempt < MAX_BENCHMARK_ATTEMPTS) {
          setProgress({
            done: 0,
            total: totalBatches,
            label: `영상 0건 · ${attempt + 1}/${MAX_BENCHMARK_ATTEMPTS}회 재시도 예정…`,
          })
        }
      }

      if (lastPayload && !lastPayload.fatalError) {
        setData({
          keywords,
          keywordPairs: keywordPairsResolved,
          summary: lastPayload.summary,
          results: lastPayload.results,
          notice: `${MAX_BENCHMARK_ATTEMPTS}회 자동 재시도 후에도 영상 0건 · 검색어 ${keywords.join(" · ")} · ${lastPayload.results.length}회 API 호출`,
        })
        setErr(
          `${MAX_BENCHMARK_ATTEMPTS}회 시도 후에도 영상을 가져오지 못했습니다. 토큰·Actor 상태를 확인해주세요.`
        )
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "네트워크 오류")
    } finally {
      setLoading(false)
      setRetryAttempt(0)
      setTimeout(() => setProgress(null), 2000)
    }
  }, [selected, massMode, keywordsText, massKeywordKo, resolveSearchKeywords])

  const estimatedCalls = selected.size * (massMode ? 1 : keywordsText.split(/[\n,]+/).filter((k) => k.trim()).length)

  const videoActorResults = useMemo(() => {
    if (!data) return []
    return data.results
      .map((r) => ({ ...r, videoItems: getRunVideoItems(r) }))
      .filter((r) => r.videoItems.length > 0 || r.metrics.withThumbnail > 0)
      .sort((a, b) => b.videoItems.length - a.videoItems.length)
  }, [data])

  const allMergedVideos = useMemo(() => {
    if (!data) return [] as VideoItem[]
    const out: VideoItem[] = []
    const seen = new Set<string>()
    for (const r of videoActorResults) {
      for (const item of r.videoItems ?? []) {
        const key = (item.noteUrl || `${item.title}:${item.thumbnail}`).toLowerCase()
        if (!key || key === ":" || seen.has(key)) continue
        seen.add(key)
        out.push({ ...item, actorLabel: r.actorLabel })
      }
    }
    return out
  }, [data, videoActorResults])

  const videoSummary = useMemo(() => {
    if (!data) return []
    return data.summary
      .filter((s) => (s.totalVideoItems ?? 0) > 0 || s.avgVideoRatioPct > 0)
      .sort((a, b) => (b.totalVideoItems ?? 0) - (a.totalVideoItems ?? 0))
  }, [data])

  const failedVideoCount = data ? data.summary.length - videoSummary.length : 0

  return (
    <div className="space-y-6">
      <StudioPageCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={studio.label}>Actor 벤치마크</p>
            <p className="mt-1 text-xs text-rose-300/80">平台 · 小红书 · 선정 Actor {XHS_VIDEO_APIFY_ACTORS.length}개</p>
            <p className="mt-1 text-xs text-slate-500">socialdatax/socialdatax-xhs-data-api — 서비스·벤치마크 동일</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={studio.btnGhost}
            disabled={discoverLoading}
            onClick={() => void loadStore()}
          >
            {discoverLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            목록 새로고침
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className={studio.btnGhost} onClick={selectAll}>
            전체 선택 ({storeActors.length})
          </Button>
          <Button type="button" size="sm" variant="outline" className={studio.btnGhost} onClick={clearSelected}>
            선택 해제
          </Button>
          <span className="self-center text-xs text-slate-500">선택 {selected.size} / {storeActors.length}개</span>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/95 text-slate-500">
              <tr>
                <th className="p-2 w-8" />
                <th className="p-2">Actor</th>
                <th className="p-2">설명</th>
              </tr>
            </thead>
            <tbody>
              {storeActors.map((a) => {
                const on = selected.has(a.slug)
                return (
                  <tr key={a.slug} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="p-2">
                      <button type="button" onClick={() => toggle(a.slug)} className="text-slate-400">
                        {on ? <CheckSquare className="h-4 w-4 text-violet-400" /> : <Square className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="p-2">
                      <p className="font-medium text-slate-200">{a.label}</p>
                      <a
                        href={a.storeUrl || `https://apify.com/${a.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-slate-500 hover:text-rose-300"
                      >
                        {a.slug}
                      </a>
                    </td>
                    <td className="p-2 text-slate-400">{a.description || "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </StudioPageCard>

      <StudioPageCard>
        <p className={studio.label}>벤치마크 실행</p>
        <p className="mt-1 text-xs text-slate-500">
          한국어 키워드 입력 → GPT가 간체 中文로 변환 → socialdatax 소스 검색 (OpenAI + 소스 검색 토큰 필요)
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={massMode} onChange={(e) => setMassMode(e.target.checked)} disabled={loading} />
          <span>
            <strong>빠른 모드</strong> — 키워드 1개만 · Actor마다 1회
          </span>
        </label>

        {massMode ? (
          <input
            type="text"
            value={massKeywordKo}
            onChange={(e) => setMassKeywordKo(e.target.value)}
            disabled={loading}
            placeholder="예: 차량용 청소기"
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
        ) : (
          <textarea
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            rows={3}
            disabled={loading}
            placeholder={"한국어 키워드 (줄바꿈으로 여러 개)\n예: 차량용 청소기\n무선 차량 청소기"}
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
        )}

        {translateLoading ? (
          <p className="mt-2 text-xs text-slate-500">中文 변환 중…</p>
        ) : keywordPairs.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {keywordPairs.map((p) => (
              <span
                key={`${p.ko}:${p.zh}`}
                className="rounded-lg border border-rose-500/25 bg-rose-950/20 px-2 py-1 text-xs text-rose-100"
              >
                {p.ko} → <span className="font-medium text-amber-200">{p.zh}</span>
              </span>
            ))}
          </div>
        ) : !shotformOpenAIKey() ? (
          <p className="mt-2 text-xs text-amber-400/90">OpenAI 키(shotform_openai_api_key) 저장 시 변환 미리보기가 표시됩니다.</p>
        ) : null}

        <p className="mt-2 text-xs text-amber-400/90">
          예상 API 호출: <strong>{estimatedCalls}회</strong> · 선정 Actor만 비교
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" className={studio.btnPrimary} disabled={loading || selected.size === 0} onClick={() => void runBenchmark()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
            {loading
              ? retryAttempt > 1
                ? `재시도 ${retryAttempt}/${MAX_BENCHMARK_ATTEMPTS}…`
                : "비교 중…"
              : `선택 ${selected.size}개 Actor 비교`}
          </Button>
        </div>

        {progress ? (
          <p className="mt-3 text-xs text-violet-300">
            배치 {progress.done + 1}/{progress.total} — {progress.label}
          </p>
        ) : null}
        {err ? <p className="mt-3 text-sm text-red-300">{err}</p> : null}
        {data?.notice ? <p className="mt-3 text-xs text-violet-200/80">{data.notice}</p> : null}
      </StudioPageCard>

      {loading && !data ? (
        <StudioPageCard className="flex min-h-[120px] flex-col items-center justify-center gap-2 text-slate-400">
          <div className="flex items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            {retryAttempt > 1 ? (
              <span>영상 수집 재시도 중 ({retryAttempt}/{MAX_BENCHMARK_ATTEMPTS})…</span>
            ) : (
              <span>Actor별 API 호출 중…</span>
            )}
          </div>
          {retryAttempt > 1 ? (
            <p className="text-xs text-slate-500">socialdatax가 0건이면 자동으로 다시 호출합니다</p>
          ) : null}
        </StudioPageCard>
      ) : null}

      {data ? (
        <>
          <StudioPageCard className="border-rose-500/20 bg-rose-950/10">
            <p className={studio.label}>영상 수집 성공 Actor ({videoSummary.length}개)</p>
            <p className="mt-1 text-xs text-slate-400">
              {failedVideoCount}개 Actor는 영상 0건 · 검색어「{data.keywords.join(" · ")}」
              {data.keywordPairs?.length ? (
                <span className="block mt-1 text-slate-500">
                  입력: {data.keywordPairs.map((p) => `${p.ko}→${p.zh}`).join(" · ")}
                </span>
              ) : null}
            </p>

            {videoSummary.length === 0 ? (
              <p className="mt-4 py-6 text-center text-sm text-slate-500">
                {err || `${MAX_BENCHMARK_ATTEMPTS}회 자동 재시도 후에도 영상 0건입니다. 소스 검색 토큰·socialdatax Actor 상태를 확인해주세요.`}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                      <th className="pb-2 pr-2">#</th>
                      <th className="pb-2 pr-2">Actor</th>
                      <th className="pb-2 pr-2">영상 수</th>
                      <th className="pb-2 pr-2">MP4 URL</th>
                      <th className="pb-2 pr-2">영상%</th>
                      <th className="pb-2">속도</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videoSummary.map((row, idx) => {
                      const run = videoActorResults.find((r) => r.actorId === row.actorId)
                      const mp4 = run?.videoItems?.filter((v) => v.videoUrl).length ?? 0
                      return (
                        <tr key={row.actorId} className="border-b border-white/[0.04]">
                          <td className="py-2 pr-2 text-slate-500">{idx + 1}</td>
                          <td className="py-2 pr-2">
                            <p className="font-medium text-white">{row.actorLabel}</p>
                            <p className="text-[10px] text-slate-500">{row.actorSlug}</p>
                          </td>
                          <td className="py-2 pr-2 font-semibold text-rose-200">{row.totalVideoItems ?? "—"}</td>
                          <td className="py-2 pr-2 text-emerald-300">{mp4}</td>
                          <td className="py-2 pr-2 text-rose-200/90">{row.avgVideoRatioPct}%</td>
                          <td className="py-2 text-slate-400">{row.avgDurationSec}s</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </StudioPageCard>

          {allMergedVideos.length > 0 ? (
            <StudioPageCard className="border-violet-500/25 bg-violet-950/10">
              <p className={studio.label}>수집 영상 ({allMergedVideos.length}개)</p>
              <p className="mt-1 text-xs text-slate-400">
                socialdatax · 키워드「{data.keywords.join(" · ")}」
              </p>
              <p className="mt-2 text-xs text-violet-300/90">
                ☑ 최대 {MAX_AUTO_EDIT_VIDEOS}개 선택 → AI가 자동으로 짜집기 편집 (후킹·문제·데모·결과 컷)
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {allMergedVideos.map((item, i) => {
                  const key = videoPickKey(item.noteUrl, item.videoUrl)
                  return (
                    <VideoThumbCard
                      key={`merged-${item.noteUrl || item.title}-${i}`}
                      item={item}
                      keyword={data.keywords[0] || ""}
                      actorLabel={item.actorLabel}
                      loadPriority={i < EAGER_INLINE_VIDEO_COUNT ? "eager" : "lazy"}
                      selected={editPickKeys.has(key)}
                      onToggleSelect={() => toggleVideoPick(item)}
                      selectDisabled={!editPickKeys.has(key) && editPicks.length >= MAX_AUTO_EDIT_VIDEOS}
                    />
                  )
                })}
              </div>
            </StudioPageCard>
          ) : null}

          {videoActorResults.map((r) => {
            const items = r.videoItems ?? []
            if (!items.length) return null
            return (
              <StudioPageCard key={`${r.actorId}:${r.keyword}`}>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className={studio.label}>{r.actorLabel}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {r.actorSlug} · 키워드 <span className="text-amber-200">{r.keyword}</span> · 영상 {items.length}개 ·{" "}
                      {r.durationSec}s
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {items.map((item, i) => {
                    const key = videoPickKey(item.noteUrl, item.videoUrl)
                    return (
                      <VideoThumbCard
                        key={`${item.noteUrl || item.title}-${i}`}
                        item={item}
                        keyword={r.keyword}
                        loadPriority={i < EAGER_INLINE_VIDEO_COUNT ? "eager" : "lazy"}
                        selected={editPickKeys.has(key)}
                        onToggleSelect={() => toggleVideoPick(item)}
                        selectDisabled={!editPickKeys.has(key) && editPicks.length >= MAX_AUTO_EDIT_VIDEOS}
                      />
                    )
                  })}
                </div>
              </StudioPageCard>
            )
          })}

          <StudioPageCard>
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setShowAllActors((v) => !v)}
            >
              <p className={studio.label}>전체 Actor 순위 ({data.summary.length}개)</p>
              <span className="text-xs text-slate-500">{showAllActors ? "접기" : "펼치기"}</span>
            </button>
            {showAllActors ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                      <th className="pb-2 pr-2">#</th>
                      <th className="pb-2 pr-2">Actor</th>
                      <th className="pb-2 pr-2">slug</th>
                      <th className="pb-2 pr-2">결과</th>
                      <th className="pb-2 pr-2">영상</th>
                      <th className="pb-2 pr-2">영상%</th>
                      <th className="pb-2 pr-2">속도</th>
                      <th className="pb-2">점수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.map((row, idx) => (
                      <tr
                        key={row.actorId}
                        className={cn(
                          "border-b border-white/[0.04]",
                          (row.totalVideoItems ?? 0) === 0 && "opacity-50"
                        )}
                      >
                        <td className="py-2 pr-2 text-slate-500">{idx + 1}</td>
                        <td className="py-2 pr-2 text-white">{row.actorLabel}</td>
                        <td className="py-2 pr-2 text-[10px] text-slate-500">{row.actorSlug}</td>
                        <td className="py-2 pr-2">
                          {row.totalRaw} / {row.totalMapped}
                        </td>
                        <td className="py-2 pr-2 text-rose-200">{row.totalVideoItems ?? 0}</td>
                        <td className="py-2 pr-2 text-rose-200/90">{row.avgVideoRatioPct}%</td>
                        <td className="py-2 pr-2 text-slate-400">{row.avgDurationSec}s</td>
                        <td className="py-2 font-semibold text-violet-300">{row.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </StudioPageCard>

          <StudioPageCard>
            <p className={studio.label}>런별 상세 ({data.results.length})</p>
            <div className="mt-3 space-y-2 max-h-[480px] overflow-y-auto">
              {data.results.map((r) => {
                const key = `${r.actorId}:${r.keyword}`
                const open = expandedKey === key
                return (
                  <div key={key} className="rounded-xl border border-white/10 bg-black/20">
                    <button
                      type="button"
                      className="w-full p-3 text-left"
                      onClick={() => setExpandedKey(open ? null : key)}
                    >
                      <p className="text-sm text-white">
                        {r.actorLabel}{" "}
                        <span className="text-amber-200/80">{r.keyword}</span>
                        <span className="ml-2 text-xs text-slate-500">{r.durationSec}s</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        raw {r.metrics.rawCount} · mapped {r.metrics.mappedCount}
                        {r.error ? ` · ⚠ ${r.error.slice(0, 100)}` : ""}
                      </p>
                    </button>
                    {open ? (
                      <div className="border-t border-white/[0.06] p-3 text-xs">
                        <p className="text-slate-500 mb-2">{r.actorSlug}</p>
                        {getRunVideoItems(r).length > 0 ? (
                          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                            {getRunVideoItems(r).slice(0, 12).map((item, i) => {
                              const thumb = proxyThumb(item.thumbnail)
                              return (
                                <a
                                  key={`${item.noteUrl}-${i}`}
                                  href={item.noteUrl || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="overflow-hidden rounded-lg border border-white/10 bg-black/40"
                                >
                                  <div className="aspect-[3/4] bg-slate-900">
                                    {thumb ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                                    ) : (
                                      <div className="flex h-full items-center justify-center p-1 text-[9px] text-slate-600">
                                        {item.title.slice(0, 20)}
                                      </div>
                                    )}
                                  </div>
                                </a>
                              )
                            })}
                          </div>
                        ) : null}
                        {r.samples.map((s, i) => (
                          <div key={i} className="mb-2 flex gap-2 rounded bg-white/[0.03] p-2">
                            {s.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={proxyThumb(s.thumbnail)}
                                alt=""
                                className="h-16 w-12 shrink-0 rounded object-cover bg-slate-900"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-slate-900 text-[9px] text-slate-600">
                                —
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-slate-200">{s.title || "(제목 없음)"}</p>
                              <p className="text-slate-500">
                                ♥ {s.likeCount ?? "—"} · {s.hasVideo ? "영상" : s.thumbnail ? "썸네일" : "?"}
                              </p>
                              {s.noteUrl ? (
                                <a href={s.noteUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400">
                                  <ExternalLink className="inline h-3 w-3" /> note
                                </a>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </StudioPageCard>
        </>
      ) : null}

      {pickHint ? (
        <p className="fixed bottom-24 left-1/2 z-30 max-w-md -translate-x-1/2 rounded-lg border border-amber-500/40 bg-amber-950/95 px-3 py-2 text-center text-xs text-amber-100 shadow-lg">
          {pickHint}
        </p>
      ) : null}

      {editPicks.length > 0 ? (
        <div className="sticky bottom-4 z-20 mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/40 bg-violet-950/95 px-4 py-3 shadow-xl backdrop-blur">
          <div>
            <p className="text-sm font-medium text-white">
              {editPicks.length}/{MAX_AUTO_EDIT_VIDEOS}개 선택됨
            </p>
            <p className="text-[11px] text-violet-200/80">제품·사용 장면만 · 편집 보기 → 편집 실행</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" className="border-white/20" onClick={clearEditPicks}>
              선택 해제
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={studio.btnPrimary}
              onClick={() => setAutoEditOpen(true)}
            >
              편집 보기
            </Button>
          </div>
        </div>
      ) : null}

      <MvpAutoEditDialog
        open={autoEditOpen && editPicks.length > 0}
        onOpenChange={setAutoEditOpen}
        picks={editPicks}
      />
    </div>
  )
}

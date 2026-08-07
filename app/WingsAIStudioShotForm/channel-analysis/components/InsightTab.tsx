"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Loader2,
  RefreshCw,
  Target,
  Flame,
  Crown,
  Medal,
  Plus,
  Globe,
  Check,
  Star,
} from "lucide-react"
import type { GroupChannel, RisingCreator, TrendingVideo } from "../lib/types"
import { formatCount, getGeminiApiKey, getYoutubeApiKey } from "../lib/types"
import {
  addChannelToGroupId,
  loadChannelGroups,
  saveChannelGroups,
} from "../lib/groups-storage"
import { FavoritePickerModal } from "./FavoritePickerModal"

type Sensitivity = 15 | 10 | 5
type Region = "KR" | "GLOBAL"
type SubRangeId =
  | "all"
  | "lt1"
  | "1to5"
  | "5to10"
  | "10to50"
  | "50to100"
  | "100to200"
  | "200plus"

type InsightCreator = RisingCreator & {
  subscriberCount?: number
  thumbnailUrl?: string
}

const SUB_RANGES: Array<{ id: SubRangeId; label: string; min: number; max: number }> = [
  { id: "all", label: "전체", min: 0, max: Number.POSITIVE_INFINITY },
  { id: "lt1", label: "1만 미만", min: 0, max: 10_000 },
  { id: "1to5", label: "1~5만", min: 10_000, max: 50_000 },
  { id: "5to10", label: "5~10만", min: 50_000, max: 100_000 },
  { id: "10to50", label: "10~50만", min: 100_000, max: 500_000 },
  { id: "50to100", label: "50~100만", min: 500_000, max: 1_000_000 },
  { id: "100to200", label: "100~200만", min: 1_000_000, max: 2_000_000 },
  { id: "200plus", label: "200만+", min: 2_000_000, max: Number.POSITIVE_INFINITY },
]

function inSubRange(count: number, range: (typeof SUB_RANGES)[number]) {
  if (range.id === "all") return true
  if (range.id === "200plus") return count >= range.min
  if (range.id === "lt1") return count < range.max
  return count >= range.min && count < range.max
}

function localInsightRanking(videos: TrendingVideo[], limit: number): RisingCreator[] {
  const map = new Map<string, RisingCreator & { _views: number[] }>()
  for (const v of videos) {
    const id = v.channelId || v.channelTitle
    const cur = map.get(id)
    if (!cur) {
      map.set(id, {
        channelId: v.channelId || id,
        channelTitle: v.channelTitle,
        videoCount: 1,
        totalViews: v.viewCount,
        averageViews: v.viewCount,
        highlight: "급상승 진입",
        videos: [{ title: v.title, viewCount: v.viewCount }],
        _views: [v.viewCount],
      })
    } else {
      cur.videoCount += 1
      cur.totalViews += v.viewCount
      cur._views.push(v.viewCount)
      cur.videos.push({ title: v.title, viewCount: v.viewCount })
      cur.averageViews = Math.round(cur.totalViews / cur.videoCount)
    }
  }

  return Array.from(map.values())
    .map((c) => {
      const stability =
        c._views.length <= 1
          ? 70
          : 100 -
            Math.min(
              60,
              Math.round(
                ((Math.max(...c._views) - Math.min(...c._views)) / Math.max(1, c.averageViews)) * 40
              )
            )
      const score =
        Math.round((Math.log10(c.averageViews + 10) * 18 + c.videoCount * 8 + stability * 0.35) * 10) /
        10
      return {
        channelTitle: c.channelTitle,
        channelId: c.channelId,
        videoCount: c.videoCount,
        totalViews: c.totalViews,
        averageViews: c.averageViews,
        highlight: `${Math.min(99.9, score)}%`,
        videos: c.videos.slice(0, 3),
      }
    })
    .sort((a, b) => parseFloat(b.highlight) - parseFloat(a.highlight))
    .slice(0, limit)
}

function Chip({
  active,
  onClick,
  children,
  tone = "teal",
  showCheck,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  tone?: "teal" | "sky"
  showCheck?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        active
          ? tone === "sky"
            ? "bg-sky-500 text-sky-950"
            : "bg-teal-500 text-teal-950"
          : "bg-white/[0.06] text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
      }`}
    >
      {showCheck && active ? <Check className="h-3 w-3" /> : null}
      {children}
    </button>
  )
}

export function InsightTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creators, setCreators] = useState<InsightCreator[]>([])
  const [sensitivity, setSensitivity] = useState<Sensitivity>(15)
  const [region, setRegion] = useState<Region>("KR")
  const [subRange, setSubRange] = useState<SubRangeId>("all")
  const [minMan, setMinMan] = useState("")
  const [maxMan, setMaxMan] = useState("")
  const [appliedMin, setAppliedMin] = useState<number | null>(null)
  const [appliedMax, setAppliedMax] = useState<number | null>(null)
  const [favOpen, setFavOpen] = useState(false)
  const [favSaving, setFavSaving] = useState(false)
  const [pending, setPending] = useState<InsightCreator | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const youtubeApiKey = getYoutubeApiKey()
      if (!youtubeApiKey) {
        throw new Error("YouTube Data API 키가 없습니다. ShotForm 설정에서 입력해주세요.")
      }

      const cacheKey = "wings_bench_insight_v2"
      const cacheTsKey = "wings_bench_insight_v2_ts"
      if (!force) {
        const cached = localStorage.getItem(cacheKey)
        const ts = parseInt(localStorage.getItem(cacheTsKey) || "0", 10)
        if (cached && Date.now() - ts < 60 * 60 * 1000) {
          setCreators(JSON.parse(cached))
          setLoading(false)
          return
        }
      }

      const videosRes = await fetch(
        `/api/youmaker/trending-videos?apiKey=${encodeURIComponent(youtubeApiKey)}`
      )
      const videosData = await videosRes.json()
      if (!videosRes.ok) throw new Error(videosData.error || "급상승 데이터를 불러오지 못했습니다.")
      const videos: TrendingVideo[] = videosData.videos || []

      const geminiApiKey = getGeminiApiKey()
      let list: InsightCreator[] = []

      if (geminiApiKey) {
        try {
          const creatorsRes = await fetch("/api/youmaker/rising-creators", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videos, geminiApiKey }),
          })
          const creatorsData = await creatorsRes.json()
          if (creatorsRes.ok && Array.isArray(creatorsData.creators)) {
            list = creatorsData.creators.map((c: RisingCreator) => ({
              ...c,
              highlight: c.highlight?.includes("%") ? c.highlight : c.highlight || "안정 고조회",
            }))
          }
        } catch {
          // fallback
        }
      }

      if (list.length === 0) {
        list = localInsightRanking(videos, 40)
      }

      // enrich subscriber counts
      const ids = list.map((c) => c.channelId).filter((id) => id?.startsWith("UC"))
      if (ids.length > 0) {
        try {
          const statsRes = await fetch("/api/youmaker/channel-stats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: youtubeApiKey, channelIds: ids }),
          })
          const statsData = await statsRes.json()
          if (statsRes.ok && statsData.channels) {
            list = list.map((c) => {
              const meta = statsData.channels[c.channelId]
              if (!meta) return c
              return {
                ...c,
                channelTitle: meta.title || c.channelTitle,
                subscriberCount: meta.subscriberCount,
                thumbnailUrl: meta.thumbnailUrl,
              }
            })
          }
        } catch {
          // ignore
        }
      }

      setCreators(list)
      localStorage.setItem(cacheKey, JSON.stringify(list))
      localStorage.setItem(cacheTsKey, String(Date.now()))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    let list = creators

    if (subRange !== "all") {
      const range = SUB_RANGES.find((r) => r.id === subRange)!
      list = list.filter((c) => {
        if (c.subscriberCount == null) return true
        return inSubRange(c.subscriberCount, range)
      })
    }

    if (appliedMin !== null || appliedMax !== null) {
      list = list.filter((c) => {
        if (c.subscriberCount == null) return true
        if (appliedMin !== null && c.subscriberCount < appliedMin) return false
        if (appliedMax !== null && c.subscriberCount > appliedMax) return false
        return true
      })
    }

    return list
  }, [creators, subRange, appliedMin, appliedMax])

  const visible = useMemo(() => filtered.slice(0, sensitivity), [filtered, sensitivity])

  const applyManual = () => {
    const min = minMan.trim() === "" ? null : Number(minMan) * 10_000
    const max = maxMan.trim() === "" ? null : Number(maxMan) * 10_000
    if (min !== null && Number.isNaN(min)) return
    if (max !== null && Number.isNaN(max)) return
    setAppliedMin(min)
    setAppliedMax(max)
  }

  const openFav = (c: InsightCreator) => {
    setPending(c)
    setFavOpen(true)
  }

  const handleFavPick = async (groupId: string) => {
    if (!pending) return
    setFavSaving(true)
    try {
      const c = pending
      let payload: GroupChannel = {
        channelId: c.channelId,
        channelTitle: c.channelTitle,
        thumbnailUrl: c.thumbnailUrl,
        subscriberCount: c.subscriberCount != null ? String(c.subscriberCount) : undefined,
        videos: (c.videos || []).slice(0, 10).map((v, i) => ({
          videoId: `insight_${c.channelId}_${i}`,
          title: v.title,
          thumbnailUrl: c.thumbnailUrl || "",
          viewCount: v.viewCount,
          likeCount: 0,
          publishedAt: new Date().toISOString(),
        })),
      }
      const apiKey = getYoutubeApiKey()
      if (apiKey && /^UC[\w-]{20,}$/.test(c.channelId)) {
        try {
          const res = await fetch("/api/youmaker/analyze-channel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId: c.channelId, youtubeApiKey: apiKey }),
          })
          const data = await res.json()
          if (res.ok) {
            const info = data.result?.channelInfo
            const vids = data.result?.videos || []
            payload = {
              channelId: c.channelId,
              channelTitle: info?.title || c.channelTitle,
              thumbnailUrl: info?.thumbnailUrl || c.thumbnailUrl,
              subscriberCount: info?.subscriberCount,
              viewCount: info?.viewCount,
              videoCount: info?.videoCount,
              videos: vids.slice(0, 40).map((v: {
                videoId: string
                title: string
                thumbnailUrl: string
                viewCount: number
                likeCount: number
                publishedAt: string
              }) => ({
                videoId: v.videoId,
                title: v.title,
                thumbnailUrl: v.thumbnailUrl,
                viewCount: v.viewCount,
                likeCount: v.likeCount,
                publishedAt: v.publishedAt,
              })),
            }
          }
        } catch {
          /* keep snapshot */
        }
      }
      saveChannelGroups(addChannelToGroupId(groupId, payload, loadChannelGroups()))
      setToast(`「${c.channelTitle}」을 관심 채널에 저장했어요`)
      window.setTimeout(() => setToast(null), 2200)
    } finally {
      setFavSaving(false)
      setPending(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50 md:text-3xl">
            <Target className="h-7 w-7 text-sky-300" />
            성과 리포트
          </h2>
          <p className="mt-1 text-sm text-zinc-400">조회가 안정적으로 나오는 채널을 골라보세요</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">
            총 <span className="font-semibold text-zinc-200">{filtered.length.toLocaleString()}</span>개
            채널
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void load(true)}
            className="rounded-full border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/10"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* Filter card — reference layout */}
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-200">필터</h3>
          <Button
            className="h-9 rounded-lg bg-teal-500 px-3 text-teal-950 hover:bg-teal-400"
            onClick={() => {
              if (visible[0]) openFav(visible[0])
            }}
            title="목록 상단 채널을 즐겨찾기 (각 행의 ★ 사용 권장)"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            채널 즐겨찾기
          </Button>
        </div>

        <div className="space-y-4">
          {/* Region */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-14 shrink-0 text-xs text-zinc-500">지역</span>
            <Chip active={region === "KR"} onClick={() => setRegion("KR")} tone="sky">
              국내
            </Chip>
            <Chip active={region === "GLOBAL"} onClick={() => setRegion("GLOBAL")} tone="sky">
              <Globe className="mr-0.5 h-3 w-3" />
              해외
            </Chip>
            {region === "GLOBAL" && (
              <span className="text-[11px] text-zinc-500">현재 데이터는 KR 인기 차트 기준입니다</span>
            )}
          </div>

          {/* Sensitivity */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-14 shrink-0 text-xs text-zinc-500">민감도</span>
            {(
              [
                { id: 15 as Sensitivity, label: "15개 (안정적)" },
                { id: 10 as Sensitivity, label: "10개 (중간)" },
                { id: 5 as Sensitivity, label: "5개 (민감)" },
              ]
            ).map((s) => (
              <Chip
                key={s.id}
                active={sensitivity === s.id}
                onClick={() => setSensitivity(s.id)}
              >
                {s.label}
              </Chip>
            ))}
          </div>

          {/* Subscribers */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-14 shrink-0 text-xs text-zinc-500 sm:w-auto">구독자 수</span>
            {SUB_RANGES.map((r) => (
              <Chip
                key={r.id}
                active={subRange === r.id}
                onClick={() => setSubRange(r.id)}
                tone="sky"
                showCheck={r.id === "all"}
              >
                {r.label}
              </Chip>
            ))}
          </div>

          {/* Manual input */}
          <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-[3.5rem]">
            <span className="text-xs text-zinc-500">직접 입력:</span>
            <Input
              value={minMan}
              onChange={(e) => setMinMan(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="최소"
              className="h-9 w-20 rounded-lg border-white/10 bg-black/30 text-center text-sm text-zinc-100"
            />
            <span className="text-xs text-zinc-500">~</span>
            <Input
              value={maxMan}
              onChange={(e) => setMaxMan(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="최대"
              className="h-9 w-20 rounded-lg border-white/10 bg-black/30 text-center text-sm text-zinc-100"
            />
            <span className="text-xs text-zinc-500">만명</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={applyManual}
              className="h-9 rounded-lg border border-white/10 bg-white/[0.05] text-zinc-300 hover:bg-white/10"
            >
              적용
            </Button>
            {(appliedMin !== null || appliedMax !== null) && (
              <button
                type="button"
                className="text-[11px] text-zinc-500 underline hover:text-zinc-300"
                onClick={() => {
                  setAppliedMin(null)
                  setAppliedMax(null)
                  setMinMan("")
                  setMaxMan("")
                }}
              >
                초기화
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            성과 리포트 분석 중...
          </div>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-sm text-red-200">
          {error}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-zinc-500">
          조건에 맞는 채널이 없습니다. 필터를 완화해 보세요.
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((c, i) => {
            const RankIcon = i === 0 ? Crown : i < 3 ? Medal : null
            const pct = c.highlight.includes("%") ? c.highlight : null
            return (
              <div
                key={`${c.channelId}-${i}`}
                className="scout-row flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#121316]/90 px-3 py-3 md:gap-4 md:px-4"
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                  {RankIcon ? (
                    <RankIcon
                      className={`h-6 w-6 ${
                        i === 0 ? "text-amber-300" : i === 1 ? "text-zinc-300" : "text-orange-300"
                      }`}
                    />
                  ) : (
                    <span className="text-sm font-bold text-zinc-500">{i + 1}</span>
                  )}
                </div>

                {c.thumbnailUrl ? (
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-zinc-50">{c.channelTitle}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {c.subscriberCount != null ? `구독 ${formatCount(c.subscriberCount)} · ` : ""}
                    영상 {c.videoCount} · 평균 {formatCount(c.averageViews)} · 합산{" "}
                    {formatCount(c.totalViews)}
                  </p>
                  {!pct && <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">{c.highlight}</p>}
                </div>
                <div
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    i < 3
                      ? "bg-orange-500/20 text-orange-200 ring-1 ring-orange-400/30"
                      : "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30"
                  }`}
                >
                  <Flame className="h-3 w-3" />
                  {pct || "HOT"}
                </div>
                <button
                  type="button"
                  title="관심 채널에 즐겨찾기"
                  onClick={() => openFav(c)}
                  className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-amber-300 transition hover:border-amber-400/40 hover:bg-amber-500/15"
                >
                  <Star className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <FavoritePickerModal
        open={favOpen}
        kind="channel"
        itemLabel={pending?.channelTitle}
        saving={favSaving}
        onClose={() => {
          if (favSaving) return
          setFavOpen(false)
          setPending(null)
        }}
        onPick={handleFavPick}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-teal-400/30 bg-[#16171c] px-4 py-2 text-sm text-teal-100 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}

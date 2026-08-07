"use client"

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Loader2,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Tv,
  Video,
  Crown,
  Medal,
  Flame,
  Eye,
  ThumbsUp,
  Plus,
  TrendingUp,
  Pencil,
  Star,
  FolderPlus,
} from "lucide-react"
import type { ChannelBucket, GroupChannel, TrendingVideo } from "../lib/types"
import { formatCount, getYoutubeApiKey, timeAgo } from "../lib/types"
import {
  addChannelToGroupId,
  addVideoToGroupId,
  loadChannelGroups,
  loadVideoGroups,
  saveChannelGroups,
  saveVideoGroups,
  trendingToGroupVideo,
} from "../lib/groups-storage"
import { ChannelDetailModal } from "./ChannelDetailModal"
import { FavoritePickerModal } from "./FavoritePickerModal"

type ViewMode = "shopping" | "channel" | "video"
type SortKey = "daily" | "weekly" | "monthly" | "viewGrowth" | "subscribers" | "views" | "likes" | "count"
type Region = "KR" | "OVERSEAS"
type RisingFilter = "all" | "weekly" | "monthly"

type SubRangeId =
  | "all"
  | "lt1"
  | "1to5"
  | "5to10"
  | "10to50"
  | "50to100"
  | "100to200"
  | "200plus"

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

function buildChannelBuckets(videos: TrendingVideo[]): ChannelBucket[] {
  const map = new Map<string, ChannelBucket>()
  for (const v of videos) {
    const id = v.channelId || v.channelTitle
    const cur = map.get(id)
    if (!cur) {
      map.set(id, {
        channelId: v.channelId || id,
        channelTitle: v.channelTitle,
        videoCount: 1,
        totalViews: v.viewCount,
        totalLikes: v.likeCount,
        videos: [v],
        score: v.viewCount,
      })
    } else {
      cur.videoCount += 1
      cur.totalViews += v.viewCount
      cur.totalLikes += v.likeCount
      cur.videos.push(v)
      cur.score = cur.totalViews * (1 + Math.log10(cur.videoCount + 1))
    }
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score)
}

function inSubRange(count: number, range: (typeof SUB_RANGES)[number]) {
  if (range.id === "all") return true
  if (range.id === "200plus") return count >= range.min
  if (range.id === "lt1") return count < range.max
  return count >= range.min && count < range.max
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-lg shadow-amber-500/30">
        <Crown className="h-5 w-5" />
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-200 to-zinc-400 text-zinc-800">
        <Medal className="h-5 w-5" />
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950">
        <Medal className="h-5 w-5" />
      </div>
    )
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-sm font-bold text-zinc-400 ring-1 ring-white/10">
      {rank}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
  tone = "teal",
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  tone?: "teal" | "sky" | "zinc"
}) {
  const activeClass =
    tone === "sky"
      ? "bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/40"
      : tone === "zinc"
        ? "bg-zinc-600 text-white"
        : "bg-teal-500 text-teal-950"
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        active ? activeClass : "bg-white/[0.05] text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  )
}

export function TrendingTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [videos, setVideos] = useState<TrendingVideo[]>([])
  const [channelMeta, setChannelMeta] = useState<
    Record<
      string,
      {
        title: string
        thumbnailUrl: string
        customUrl: string
        subscriberCount: number
        viewCount: number
        videoCount: number
      }
    >
  >({})
  const [viewMode, setViewMode] = useState<ViewMode>("channel")
  const [sortKey, setSortKey] = useState<SortKey>("daily")
  const [region, setRegion] = useState<Region>("KR")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<ChannelBucket | null>(null)
  const [selectedRank, setSelectedRank] = useState<number | undefined>()
  const [favOpen, setFavOpen] = useState(false)
  const [favKind, setFavKind] = useState<"channel" | "video">("channel")
  const [favLabel, setFavLabel] = useState("")
  const [favSaving, setFavSaving] = useState(false)
  const [pendingChannel, setPendingChannel] = useState<ChannelBucket | null>(null)
  const [pendingVideo, setPendingVideo] = useState<TrendingVideo | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [videoSearchMode, setVideoSearchMode] = useState<"title" | "channel" | "all">("title")

  // channel filters (reference UI)
  const [subRanges, setSubRanges] = useState<SubRangeId[]>(["all"])
  const [minMan, setMinMan] = useState("")
  const [maxMan, setMaxMan] = useState("")
  const [appliedMin, setAppliedMin] = useState<number | null>(null)
  const [appliedMax, setAppliedMax] = useState<number | null>(null)
  const [extraOpen, setExtraOpen] = useState(true)
  const [risingFilter, setRisingFilter] = useState<RisingFilter>("all")

  const load = async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const apiKey = getYoutubeApiKey()
      if (!apiKey) {
        throw new Error("YouTube Data API 키가 없습니다. ShotForm 설정에서 입력해주세요.")
      }

      const cacheKey = "wings_bench_trending_v3"
      const cacheTsKey = "wings_bench_trending_v3_ts"
      const metaKey = "wings_bench_trending_meta_v3"
      if (!force && typeof window !== "undefined") {
        const cached = localStorage.getItem(cacheKey)
        const metaCached = localStorage.getItem(metaKey)
        const ts = parseInt(localStorage.getItem(cacheTsKey) || "0", 10)
        if (cached && Date.now() - ts < 60 * 60 * 1000) {
          setVideos(JSON.parse(cached))
          if (metaCached) setChannelMeta(JSON.parse(metaCached))
          setLoading(false)
          return
        }
      }

      const res = await fetch(`/api/youmaker/trending-videos?apiKey=${encodeURIComponent(apiKey)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "급상승 영상을 불러오지 못했습니다.")
      const list: TrendingVideo[] = data.videos || []
      setVideos(list)
      localStorage.setItem(cacheKey, JSON.stringify(list))
      localStorage.setItem(cacheTsKey, String(Date.now()))

      const ids = Array.from(new Set(list.map((v) => v.channelId).filter(Boolean)))
      if (ids.length > 0) {
        const statsRes = await fetch("/api/youmaker/channel-stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, channelIds: ids }),
        })
        const statsData = await statsRes.json()
        if (statsRes.ok && statsData.channels) {
          setChannelMeta(statsData.channels)
          localStorage.setItem(metaKey, JSON.stringify(statsData.channels))
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const channels = useMemo(() => {
    const buckets = buildChannelBuckets(videos)
    return buckets.map((c) => {
      const meta = channelMeta[c.channelId]
      if (!meta) return c
      return {
        ...c,
        channelTitle: meta.title || c.channelTitle,
        subscriberCount: meta.subscriberCount,
        channelViewCount: meta.viewCount,
        thumbnailUrl: meta.thumbnailUrl,
        customUrl: meta.customUrl,
      }
    })
  }, [videos, channelMeta])

  const toggleSubRange = (id: SubRangeId) => {
    if (id === "all") {
      setSubRanges(["all"])
      return
    }
    setSubRanges((prev) => {
      const withoutAll = prev.filter((x) => x !== "all")
      const next = withoutAll.includes(id)
        ? withoutAll.filter((x) => x !== id)
        : [...withoutAll, id]
      return next.length === 0 ? ["all"] : next
    })
  }

  const applyManualRange = () => {
    const min = minMan.trim() === "" ? null : Number(minMan) * 10_000
    const max = maxMan.trim() === "" ? null : Number(maxMan) * 10_000
    if (min !== null && Number.isNaN(min)) return
    if (max !== null && Number.isNaN(max)) return
    setAppliedMin(min)
    setAppliedMax(max)
    if (min !== null || max !== null) {
      setSubRanges((prev) => prev.filter((x) => x !== "all"))
    }
  }

  const filteredChannels = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = channels

    if (q) {
      list = list.filter(
        (c) =>
          c.channelTitle.toLowerCase().includes(q) ||
          c.channelId.toLowerCase().includes(q) ||
          (c.customUrl || "").toLowerCase().includes(q)
      )
    }

    // subscriber multi-select
    if (!(subRanges.length === 1 && subRanges[0] === "all")) {
      const ranges = SUB_RANGES.filter((r) => subRanges.includes(r.id) && r.id !== "all")
      list = list.filter((c) => {
        const subs = c.subscriberCount ?? -1
        if (subs < 0) return true // unknown: keep
        return ranges.some((r) => inSubRange(subs, r))
      })
    }

    // manual range (만 단위)
    if (appliedMin !== null || appliedMax !== null) {
      list = list.filter((c) => {
        const subs = c.subscriberCount
        if (subs == null) return true
        if (appliedMin !== null && subs < appliedMin) return false
        if (appliedMax !== null && subs > appliedMax) return false
        return true
      })
    }

    // rising filter — approximate by trending video count / score
    if (risingFilter === "weekly") {
      list = list.filter((c) => c.videoCount >= 2 || c.score > list[0]?.score * 0.3)
    } else if (risingFilter === "monthly") {
      list = list.filter((c) => c.totalViews > 100_000)
    }

    return [...list].sort((a, b) => {
      if (sortKey === "subscribers") {
        return (b.subscriberCount || 0) - (a.subscriberCount || 0)
      }
      if (sortKey === "viewGrowth" || sortKey === "views") return b.totalViews - a.totalViews
      if (sortKey === "likes") return b.totalLikes - a.totalLikes
      if (sortKey === "count") return b.videoCount - a.videoCount
      // daily / weekly / monthly — use score as proxy rank
      return b.score - a.score
    })
  }, [channels, query, subRanges, appliedMin, appliedMax, risingFilter, sortKey])

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = videos
    if (q) {
      list = list.filter((v) => {
        if (videoSearchMode === "channel") return v.channelTitle.toLowerCase().includes(q)
        if (videoSearchMode === "title") return v.title.toLowerCase().includes(q)
        return v.title.toLowerCase().includes(q) || v.channelTitle.toLowerCase().includes(q)
      })
    }
    return [...list].sort((a, b) => {
      if (sortKey === "likes") return b.likeCount - a.likeCount
      return b.viewCount - a.viewCount
    })
  }, [videos, query, sortKey, videoSearchMode])

  const openChannel = (c: ChannelBucket, rank: number) => {
    setSelected(c)
    setSelectedRank(rank)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const openChannelFav = (c: ChannelBucket, e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setPendingChannel(c)
    setPendingVideo(null)
    setFavKind("channel")
    setFavLabel(c.channelTitle)
    setFavOpen(true)
  }

  const openVideoFav = (v: TrendingVideo, e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setPendingVideo(v)
    setPendingChannel(null)
    setFavKind("video")
    setFavLabel(v.title)
    setFavOpen(true)
  }

  const handleFavPick = async (groupId: string) => {
    setFavSaving(true)
    try {
      if (favKind === "channel" && pendingChannel) {
        const c = pendingChannel
        let payload: GroupChannel = {
          channelId: c.channelId,
          channelTitle: c.channelTitle,
          thumbnailUrl: c.thumbnailUrl || c.videos[0]?.thumbnail,
          subscriberCount:
            c.subscriberCount != null ? String(c.subscriberCount) : undefined,
          videos: c.videos.slice(0, 40).map((v) => ({
            videoId: v.id,
            title: v.title,
            thumbnailUrl: v.thumbnail,
            viewCount: v.viewCount,
            likeCount: v.likeCount,
            publishedAt: v.publishedAt,
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
                ...payload,
                thumbnailUrl: info?.thumbnailUrl || payload.thumbnailUrl,
                subscriberCount: info?.subscriberCount || payload.subscriberCount,
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
            /* keep trending snapshot */
          }
        }
        const next = addChannelToGroupId(groupId, payload, loadChannelGroups())
        saveChannelGroups(next)
        showToast(`「${c.channelTitle}」을 관심 채널에 저장했어요`)
      } else if (favKind === "video" && pendingVideo) {
        const v = pendingVideo
        const next = addVideoToGroupId(
          groupId,
          trendingToGroupVideo(v),
          loadVideoGroups()
        )
        saveVideoGroups(next)
        showToast(`영상을 관심 영상에 저장했어요`)
      }
    } finally {
      setFavSaving(false)
      setPendingChannel(null)
      setPendingVideo(null)
    }
  }

  const channelSortOptions: Array<{ id: SortKey; label: string }> = [
    { id: "daily", label: "오늘 TOP" },
    { id: "weekly", label: "이번 주 TOP" },
    { id: "monthly", label: "이번 달 TOP" },
    { id: "viewGrowth", label: "조회 증가폭" },
    { id: "subscribers", label: "구독자 순" },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50 md:text-3xl">
            <TrendingUp className="h-7 w-7 text-teal-400" />
            급상승
          </h2>
          <p className="mt-1 text-sm text-zinc-400">지금 뜨는 채널·영상을 모아보세요</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "shopping", label: "쇼핑", icon: ShoppingBag },
              { id: "channel", label: "채널", icon: Tv },
              { id: "video", label: "영상", icon: Video },
            ] as const
          ).map((m) => (
            <Button
              key={m.id}
              size="sm"
              variant="ghost"
              onClick={() => setViewMode(m.id)}
              className={`rounded-lg border ${
                viewMode === m.id
                  ? "border-teal-400/50 bg-teal-500 text-teal-950 hover:bg-teal-500"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <m.icon className="mr-1.5 h-3.5 w-3.5" />
              {m.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void load(true)}
            className="rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/10"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 필터 패널 */}
      <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm md:p-5">
        {/* Region + search + add */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex shrink-0 flex-wrap gap-2">
            <FilterChip active={region === "KR"} onClick={() => setRegion("KR")} tone="sky">
              국내
            </FilterChip>
            <FilterChip active={region === "OVERSEAS"} onClick={() => setRegion("OVERSEAS")} tone="sky">
              해외
            </FilterChip>
          </div>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                viewMode === "video" ? "영상 제목으로 검색..." : "채널·핸들 검색"
              }
              className="h-11 rounded-lg border-white/10 bg-black/30 pl-9 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
          {viewMode !== "video" && (
            <Button className="h-11 shrink-0 rounded-lg bg-teal-500 px-4 text-teal-950 hover:bg-teal-400">
              <Plus className="mr-1.5 h-4 w-4" />
              채널 등록
            </Button>
          )}
        </div>

        {region === "OVERSEAS" && (
          <p className="text-[11px] text-zinc-500">현재 데이터 소스는 KR 인기 차트입니다. 해외는 UI 프리셋입니다.</p>
        )}

        {viewMode === "video" && (
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "title", label: "제목" },
                { id: "channel", label: "채널" },
                { id: "all", label: "전체" },
              ] as const
            ).map((m) => (
              <FilterChip
                key={m.id}
                active={videoSearchMode === m.id}
                onClick={() => setVideoSearchMode(m.id)}
              >
                {m.label}
              </FilterChip>
            ))}
          </div>
        )}

        {/* Sort */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-10 shrink-0 text-xs text-zinc-500">정렬</span>
          {(viewMode === "video"
            ? ([
                { id: "views", label: "조회수순" },
                { id: "likes", label: "좋아요순" },
              ] as const)
            : channelSortOptions
          ).map((s) => (
            <FilterChip key={s.id} active={sortKey === s.id} onClick={() => setSortKey(s.id)}>
              {s.label}
            </FilterChip>
          ))}
        </div>

        {/* Subscriber ranges — channel/shopping */}
        {viewMode !== "video" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 text-xs text-zinc-500">구독자 (중복 선택 가능)</span>
              {SUB_RANGES.map((r) => (
                <FilterChip
                  key={r.id}
                  active={subRanges.includes(r.id)}
                  onClick={() => toggleSubRange(r.id)}
                  tone="sky"
                >
                  {r.label}
                </FilterChip>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                <Pencil className="h-3 w-3" />
                직접 입력:
              </span>
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
              <span className="text-xs text-zinc-500">만</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={applyManualRange}
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

            {/* Extra filters accordion */}
            <div className="rounded-2xl border border-white/[0.06] bg-black/20">
              <button
                type="button"
                onClick={() => setExtraOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-zinc-300"
              >
                <span>더보기 필터 (급상승·카테고리)</span>
                {extraOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {extraOpen && (
                <div className="space-y-3 border-t border-white/[0.06] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-zinc-500">급상승 구간</span>
                    {(
                      [
                        { id: "all", label: "전체" },
                        { id: "weekly", label: "주간 급등" },
                        { id: "monthly", label: "월간 급등" },
                      ] as const
                    ).map((r) => (
                      <FilterChip
                        key={r.id}
                        active={risingFilter === r.id}
                        onClick={() => setRisingFilter(r.id)}
                        tone="zinc"
                      >
                        {r.label}
                      </FilterChip>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    카테고리(쇼핑·엔터 등)는 세분 데이터가 준비되면 열립니다.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
            급상승 데이터를 불러오는 중...
          </div>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-sm text-red-200">
          {error}
        </div>
      ) : viewMode === "video" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filteredVideos.map((v, i) => {
            const hot = v.viewCount > 1_000_000
            return (
              <div
                key={v.id}
                className={`scout-row group relative overflow-hidden rounded-2xl border bg-[#121316] transition hover:-translate-y-0.5 hover:border-teal-400/40 ${
                  i === 0 ? "border-amber-400/50 ring-1 ring-amber-400/30" : "border-white/[0.06]"
                }`}
                style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
              >
                <button
                  type="button"
                  title="관심 영상에 저장"
                  onClick={(e) => openVideoFav(v, e)}
                  className="absolute right-2 top-2 z-10 rounded-lg bg-black/70 p-1.5 text-teal-200 opacity-100 transition hover:bg-teal-500/80 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
                <a
                  href={`https://www.youtube.com/watch?v=${v.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <div className="relative aspect-video bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.thumbnail} alt="" className="h-full w-full object-cover" />
                    <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    {hot && (
                      <span className="absolute left-2 top-8 inline-flex items-center gap-0.5 rounded-md bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        <Flame className="h-3 w-3" />
                        HOT
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 p-2.5">
                    <p className="line-clamp-2 text-xs font-semibold leading-snug text-zinc-100 md:text-sm">
                      {v.title}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">{v.channelTitle}</p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
                      <span className="inline-flex items-center gap-0.5">
                        <Eye className="h-3 w-3" />
                        {formatCount(v.viewCount)}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <ThumbsUp className="h-3 w-3" />
                        {formatCount(v.likeCount)}
                      </span>
                      <span>{timeAgo(v.publishedAt)}</span>
                    </p>
                  </div>
                </a>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredChannels.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-zinc-500">
              조건에 맞는 채널이 없습니다. 필터를 완화해 보세요.
            </div>
          ) : (
            filteredChannels.map((c, i) => {
              const rank = i + 1
              const avatar = c.thumbnailUrl || c.videos[0]?.thumbnail
              const handle = c.customUrl
                ? c.customUrl.startsWith("@")
                  ? c.customUrl
                  : `@${c.customUrl}`
                : c.channelId.startsWith("UC")
                  ? `@${c.channelTitle.replace(/\s+/g, "").slice(0, 14)}`
                  : c.channelId.slice(0, 18)
              return (
                <button
                  key={c.channelId}
                  type="button"
                  onClick={() => openChannel(c, rank)}
                  className="scout-row group flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#121316]/95 px-3 py-3 text-left transition hover:border-teal-400/35 hover:bg-white/[0.04] md:gap-4 md:px-4"
                  style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                >
                  <RankBadge rank={rank} />

                  <div className="flex min-w-0 flex-1 items-center gap-2.5 md:max-w-[220px] md:flex-none">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatar} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-zinc-50">{c.channelTitle}</p>
                      <p className="truncate text-xs text-zinc-500">{handle}</p>
                    </div>
                  </div>

                  <div className="ml-auto hidden items-center gap-1.5 sm:flex md:ml-0 md:flex-1 md:justify-center">
                    {c.videos.slice(0, 3).map((v) => (
                      <div
                        key={v.id}
                        className="h-16 w-11 overflow-hidden rounded-lg border border-white/10 bg-black/50 md:h-[72px] md:w-12"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={v.thumbnail} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>

                  <div className="hidden shrink-0 text-right md:block md:min-w-[100px]">
                    <p className="text-[11px] text-zinc-500">구독자</p>
                    <p className="text-sm font-semibold text-zinc-100">
                      {c.subscriberCount != null ? formatCount(c.subscriberCount) : "—"}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right lg:block lg:min-w-[100px]">
                    <p className="text-[11px] text-zinc-500">일일 증가</p>
                    <p className="text-sm font-semibold text-emerald-400">+{formatCount(c.totalViews)}</p>
                  </div>

                  <button
                    type="button"
                    title="관심 채널에 즐겨찾기"
                    onClick={(e) => openChannelFav(c, e)}
                    className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-amber-300 transition hover:border-amber-400/40 hover:bg-amber-500/15"
                  >
                    <Star className="h-4 w-4" />
                  </button>

                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-teal-300" />
                </button>
              )
            })
          )}
        </div>
      )}

      <ChannelDetailModal
        channel={selected}
        rank={selectedRank}
        onClose={() => {
          setSelected(null)
          setSelectedRank(undefined)
        }}
      />

      <FavoritePickerModal
        open={favOpen}
        kind={favKind}
        itemLabel={favLabel}
        saving={favSaving}
        onClose={() => {
          if (favSaving) return
          setFavOpen(false)
          setPendingChannel(null)
          setPendingVideo(null)
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

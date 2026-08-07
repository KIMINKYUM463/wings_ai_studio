"use client"

import { useEffect, useMemo, useState } from "react"
import {
  X,
  Eye,
  ExternalLink,
  ThumbsUp,
  Loader2,
  FolderPlus,
  Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
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
import { FavoritePickerModal } from "./FavoritePickerModal"

type RangeTab = "all" | "month"
type VideoSort = "latest" | "views"

type DailyPoint = {
  date: string
  sortKey: number
  views: number
  uploads: number
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatAxisDate(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 업로드일 기준으로 일간 조회수·업로드 수 시계열 생성 */
function buildDailyGrowth(videos: TrendingVideo[], daySpan: number): DailyPoint[] {
  const byDay = new Map<string, { views: number; uploads: number; date: Date }>()
  for (const v of videos) {
    const d = new Date(v.publishedAt)
    if (Number.isNaN(d.getTime())) continue
    const key = dayKey(d)
    const cur = byDay.get(key) || { views: 0, uploads: 0, date: new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
    cur.views += v.viewCount || 0
    cur.uploads += 1
    byDay.set(key, cur)
  }

  if (byDay.size === 0) {
    const base = videos[0]?.viewCount || 10000
    return Array.from({ length: Math.min(daySpan, 14) }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (Math.min(daySpan, 14) - 1 - i))
      return {
        date: formatAxisDate(d),
        sortKey: d.getTime(),
        views: Math.round(base * (0.35 + ((i * 17) % 50) / 100)),
        uploads: (i % 3) + 1,
      }
    })
  }

  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - (daySpan - 1))

  // 데이터가 더 오래된 구간만 있으면 그 구간을 사용
  const sortedKeys = Array.from(byDay.keys()).sort()
  const firstData = byDay.get(sortedKeys[0])!.date
  const lastData = byDay.get(sortedKeys[sortedKeys.length - 1])!.date
  const rangeStart = firstData < start ? start : firstData
  const rangeEnd = lastData > end ? lastData : end

  const points: DailyPoint[] = []
  const cursor = new Date(rangeStart)
  while (cursor <= rangeEnd) {
    const key = dayKey(cursor)
    const hit = byDay.get(key)
    points.push({
      date: formatAxisDate(cursor),
      sortKey: cursor.getTime(),
      views: hit?.views || 0,
      uploads: hit?.uploads || 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  // 너무 길면 최근 daySpan만
  return points.slice(-daySpan)
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: DailyPoint }>
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-white/10 bg-[#16171c]/95 px-3.5 py-2.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.7)] backdrop-blur-md">
      <p className="mb-1.5 text-xs font-medium text-zinc-400">{p.date}</p>
      <p className="text-sm font-semibold text-teal-400">
        일간 조회수: {formatCount(p.views)}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-emerald-400">
        일일 업로드: {p.uploads}개
      </p>
    </div>
  )
}

export function ChannelDetailModal({
  channel,
  rank,
  onClose,
}: {
  channel: ChannelBucket | null
  rank?: number
  onClose: () => void
}) {
  const [range, setRange] = useState<RangeTab>("all")
  const [videoSort, setVideoSort] = useState<VideoSort>("latest")
  const [loadingExtra, setLoadingExtra] = useState(false)
  const [favOpen, setFavOpen] = useState(false)
  const [favKind, setFavKind] = useState<"channel" | "video">("channel")
  const [favLabel, setFavLabel] = useState("")
  const [favSaving, setFavSaving] = useState(false)
  const [pendingVideo, setPendingVideo] = useState<TrendingVideo | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [extra, setExtra] = useState<{
    subscriberCount?: string
    viewCount?: string
    videoCount?: string
    thumbnailUrl?: string
    videos?: TrendingVideo[]
  } | null>(null)

  useEffect(() => {
    if (!channel) {
      setExtra(null)
      return
    }
    let cancelled = false
    const run = async () => {
      const apiKey = getYoutubeApiKey()
      if (!apiKey || !/^UC[\w-]{20,}$/.test(channel.channelId)) return
      setLoadingExtra(true)
      try {
        const res = await fetch("/api/youmaker/analyze-channel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: channel.channelId, youtubeApiKey: apiKey }),
        })
        const data = await res.json()
        if (!res.ok || cancelled) return
        const info = data.result?.channelInfo
        const vids = (data.result?.videos || []) as Array<{
          videoId: string
          title: string
          thumbnailUrl: string
          viewCount: number
          likeCount: number
          publishedAt: string
        }>
        setExtra({
          subscriberCount: info?.subscriberCount,
          viewCount: info?.viewCount,
          videoCount: info?.videoCount,
          thumbnailUrl: info?.thumbnailUrl,
          videos: vids.map((v) => ({
            id: v.videoId,
            title: v.title,
            channelTitle: channel.channelTitle,
            channelId: channel.channelId,
            thumbnail: v.thumbnailUrl,
            viewCount: v.viewCount,
            likeCount: v.likeCount,
            publishedAt: v.publishedAt,
          })),
        })
      } catch {
        // keep trending-only data
      } finally {
        if (!cancelled) setLoadingExtra(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [channel])

  const videos = useMemo(() => {
    const list = extra?.videos?.length ? extra.videos : channel?.videos || []
    const sorted = [...list]
    if (videoSort === "views") sorted.sort((a, b) => b.viewCount - a.viewCount)
    else sorted.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    if (range === "month") {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
      return sorted.filter((v) => new Date(v.publishedAt).getTime() >= cutoff)
    }
    return sorted
  }, [channel, extra, videoSort, range])

  const chartData = useMemo(
    () => buildDailyGrowth(videos, range === "month" ? 30 : 90),
    [videos, range]
  )
  const chartTitle =
    range === "month" ? "일간 조회수 증가량 (30일)" : "일간 조회수 증가량 (최근)"

  // X축 라벨이 너무 빽빽하지 않게 간격 조절
  const xTickInterval = Math.max(0, Math.ceil(chartData.length / 8) - 1)

  if (!channel) return null

  const avatar = extra?.thumbnailUrl || channel.videos[0]?.thumbnail
  const handle = channel.channelId.startsWith("UC")
    ? `@${channel.channelTitle.replace(/\s+/g, "").slice(0, 16)}`
    : channel.channelId
  const avgViews = channel.videoCount > 0 ? Math.round(channel.totalViews / channel.videoCount) : 0

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const handleFavPick = async (groupId: string) => {
    setFavSaving(true)
    try {
      if (favKind === "channel") {
        let payload: GroupChannel = {
          channelId: channel.channelId,
          channelTitle: channel.channelTitle,
          thumbnailUrl: avatar,
          subscriberCount: extra?.subscriberCount,
          viewCount: extra?.viewCount,
          videoCount: extra?.videoCount,
          videos: videos.slice(0, 40).map((v) => ({
            videoId: v.id,
            title: v.title,
            thumbnailUrl: v.thumbnail,
            viewCount: v.viewCount,
            likeCount: v.likeCount,
            publishedAt: v.publishedAt,
          })),
        }
        const apiKey = getYoutubeApiKey()
        if (apiKey && /^UC[\w-]{20,}$/.test(channel.channelId) && !extra?.videos?.length) {
          try {
            const res = await fetch("/api/youmaker/analyze-channel", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channelId: channel.channelId, youtubeApiKey: apiKey }),
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
            /* keep */
          }
        }
        saveChannelGroups(addChannelToGroupId(groupId, payload, loadChannelGroups()))
        showToast("관심 채널에 저장했어요")
      } else if (pendingVideo) {
        saveVideoGroups(
          addVideoToGroupId(
            groupId,
            trendingToGroupVideo({
              ...pendingVideo,
              channelThumb: avatar,
            }),
            loadVideoGroups()
          )
        )
        showToast("관심 영상에 저장했어요")
      }
    } finally {
      setFavSaving(false)
      setPendingVideo(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0f1014] shadow-[0_0_80px_-16px_rgba(236,72,153,0.4)] bench-modal-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-teal-400/30 bg-white/10">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-zinc-50 md:text-xl">{channel.channelTitle}</h2>
              <p className="truncate text-sm text-zinc-500">{handle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              title="관심 채널에 즐겨찾기"
              className="rounded-xl text-amber-300 hover:bg-amber-500/15 hover:text-amber-200"
              onClick={() => {
                setFavKind("channel")
                setFavLabel(channel.channelTitle)
                setPendingVideo(null)
                setFavOpen(true)
              }}
            >
              <Star className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 md:px-6 md:py-5">
          <div className="mb-4 flex gap-2">
            {(
              [
                { id: "all", label: "전체" },
                { id: "month", label: "월간 (30일)" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setRange(t.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                  range === t.id
                    ? "bg-teal-500 text-white"
                    : "bg-white/[0.06] text-zinc-400 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}
            {loadingExtra && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                채널 상세 불러오는 중
              </span>
            )}
          </div>

          {/* KPI */}
          <div className="mb-5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {[
              {
                label: "구독자",
                value: extra?.subscriberCount ? formatCount(extra.subscriberCount) : "—",
                sub: `급상승 ${channel.videoCount}개`,
                tone: "bg-teal-500/10 border-teal-400/20",
              },
              {
                label: "총 조회수",
                value: extra?.viewCount ? formatCount(extra.viewCount) : formatCount(channel.totalViews),
                sub: `+${formatCount(channel.totalViews)}`,
                subClass: "text-emerald-400",
                tone: "bg-cyan-500/10 border-cyan-400/20",
              },
              {
                label: "총 영상 수",
                value: extra?.videoCount ? formatCount(extra.videoCount) : `${channel.videoCount}`,
                sub: `평균 ${formatCount(avgViews)}`,
                tone: "bg-emerald-500/10 border-emerald-400/20",
              },
              {
                label: "오늘 TOP",
                value: rank ? `${rank}위` : "—",
                sub: rank && rank <= 3 ? "TOP" : "급상승",
                tone: "bg-amber-500/10 border-amber-400/20",
              },
            ].map((m) => (
              <div key={m.label} className={`rounded-2xl border p-3 ${m.tone}`}>
                <p className="text-[11px] text-zinc-400">{m.label}</p>
                <p className="mt-1 text-xl font-bold text-zinc-50">{m.value}</p>
                <p className={`mt-0.5 text-[11px] ${m.subClass || "text-zinc-500"}`}>{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="mb-5 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-4 md:p-5">
            <h3 className="mb-4 text-sm font-semibold tracking-tight text-zinc-100">{chartTitle}</h3>
            <div className="h-56 w-full sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="viewsAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity={0.35} />
                      <stop offset="55%" stopColor="#ec4899" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                    <filter id="pinkGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 6"
                    stroke="rgba(255,255,255,0.06)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                    interval={xTickInterval}
                    minTickGap={28}
                    dy={6}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCount(v)}
                    width={52}
                    dx={-4}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{
                      stroke: "rgba(161,161,170,0.45)",
                      strokeWidth: 1,
                      strokeDasharray: "3 3",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#ec4899"
                    strokeWidth={2.5}
                    fill="url(#viewsAreaFill)"
                    filter="url(#pinkGlow)"
                    dot={false}
                    activeDot={{
                      r: 6,
                      fill: "#ec4899",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                    animationDuration={700}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent videos — 세로 스크롤 그리드 */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">
              최근 영상 ({videos.length}개)
            </h3>
            <div className="flex items-center gap-2">
              {(
                [
                  { id: "latest", label: "최신순" },
                  { id: "views", label: "조회수순" },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setVideoSort(s.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    videoSort === s.id
                      ? "bg-teal-500 text-white"
                      : "bg-white/[0.06] text-zinc-400"
                  }`}
                >
                  {s.label}
                </button>
              ))}
              <a
                href={
                  channel.channelId.startsWith("UC")
                    ? `https://www.youtube.com/channel/${channel.channelId}`
                    : `https://www.youtube.com/results?search_query=${encodeURIComponent(channel.channelTitle)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 inline-flex items-center gap-1 text-xs text-teal-300 hover:text-teal-200"
              >
                채널 열기 <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {videos.map((v) => (
              <div
                key={v.id}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] transition hover:border-teal-400/40"
              >
                <button
                  type="button"
                  title="관심 영상에 저장"
                  onClick={() => {
                    setPendingVideo(v)
                    setFavKind("video")
                    setFavLabel(v.title)
                    setFavOpen(true)
                  }}
                  className="absolute right-2 top-2 z-10 rounded-lg bg-black/70 p-1.5 text-teal-200 opacity-100 transition hover:bg-teal-500/80 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
                <a
                  href={`https://www.youtube.com/watch?v=${v.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.thumbnail}
                      alt=""
                      className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-md"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.thumbnail}
                      alt=""
                      className="relative z-[1] mx-auto h-full w-auto max-w-full object-contain"
                    />
                  </div>
                  <div className="space-y-1 p-2.5">
                    <p className="line-clamp-1 text-xs font-medium text-zinc-100">{v.title}</p>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-zinc-500">
                      <span className="inline-flex items-center gap-0.5">
                        <Eye className="h-2.5 w-2.5" />
                        {formatCount(v.viewCount)}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <ThumbsUp className="h-2.5 w-2.5" />
                        {formatCount(v.likeCount)}
                      </span>
                      <span>{timeAgo(v.publishedAt)}</span>
                    </p>
                  </div>
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FavoritePickerModal
        open={favOpen}
        kind={favKind}
        itemLabel={favLabel}
        saving={favSaving}
        onClose={() => {
          if (favSaving) return
          setFavOpen(false)
          setPendingVideo(null)
        }}
        onPick={handleFavPick}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-teal-400/30 bg-[#16171c] px-4 py-2 text-sm text-teal-100 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}

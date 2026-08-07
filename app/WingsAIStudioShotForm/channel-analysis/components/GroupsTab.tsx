"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Plus,
  Users,
  Loader2,
  Trash2,
  Folder,
  FolderPlus,
  Eye,
  ThumbsUp,
  RefreshCw,
  ChevronDown,
  Flame,
} from "lucide-react"
import type { ChannelGroup, GroupChannel } from "../lib/types"
import { formatCount, getYoutubeApiKey, timeAgo } from "../lib/types"
import {
  createChannelGroup,
  loadChannelGroups,
  saveChannelGroups,
  upsertGroupChannel,
} from "../lib/groups-storage"

type SortKey = "latest" | "views" | "likes"

const VIEW_PRESETS = [
  { id: "all", label: "전체", min: 0, max: Infinity },
  { id: "50m", label: "50만+", min: 500_000, max: Infinity },
  { id: "10m", label: "10만+", min: 100_000, max: Infinity },
  { id: "5to10", label: "5~10만", min: 50_000, max: 100_000 },
  { id: "1to5", label: "1~5만", min: 10_000, max: 50_000 },
  { id: "1kto1m", label: "1천~1만", min: 1_000, max: 10_000 },
  { id: "lt1k", label: "1천 미만", min: 0, max: 1_000 },
] as const

const MUTATION_PRESETS = [
  { id: "all", label: "전체", min: 0 },
  { id: "2x", label: "2x+", min: 2 },
  { id: "3x", label: "3x+", min: 3 },
  { id: "5x", label: "5x+", min: 5 },
  { id: "10x", label: "10x+", min: 10 },
] as const

async function analyzeToGroupChannel(
  channelIdOrUrl: string,
  youtubeApiKey: string
): Promise<GroupChannel> {
  const res = await fetch("/api/youmaker/analyze-channel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channelId: channelIdOrUrl, youtubeApiKey }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "채널 분석에 실패했습니다.")
  const result = data.result || data
  const channelInfo = result.channelInfo
  const videos = result.videos || []
  if (!channelInfo) throw new Error("채널 정보가 비어 있습니다.")
  const resolvedId =
    result.channelId ||
    (/^UC[\w-]{20,}$/.test(channelIdOrUrl.trim())
      ? channelIdOrUrl.trim()
      : `name:${channelInfo.title}`)
  return {
    channelId: resolvedId,
    channelTitle: channelInfo.title,
    thumbnailUrl: channelInfo.thumbnailUrl,
    subscriberCount: channelInfo.subscriberCount,
    viewCount: channelInfo.viewCount,
    videoCount: channelInfo.videoCount,
    videos: videos.slice(0, 40).map((v: {
      videoId: string
      title: string
      thumbnailUrl: string
      viewCount: number
      likeCount: number
      commentCount?: number
      publishedAt: string
      description?: string
      durationSeconds?: number
      mutationX?: number
      baselineViewCount?: number
    }) => ({
      videoId: v.videoId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      commentCount: v.commentCount,
      publishedAt: v.publishedAt,
      description: v.description,
      durationSeconds: v.durationSeconds,
      mutationX: v.mutationX,
      baselineViewCount: v.baselineViewCount,
    })),
  }
}

export function GroupsTab() {
  const [groups, setGroups] = useState<ChannelGroup[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newGroupName, setNewGroupName] = useState("")
  const [channelInput, setChannelInput] = useState("")
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [channelsOpen, setChannelsOpen] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>("latest")
  const [channelFilter, setChannelFilter] = useState<string>("all")
  const [viewPreset, setViewPreset] = useState<(typeof VIEW_PRESETS)[number]["id"]>("all")
  const [mutPreset, setMutPreset] = useState<(typeof MUTATION_PRESETS)[number]["id"]>("all")
  const [viewMin, setViewMin] = useState("")
  const [viewMax, setViewMax] = useState("")
  const [appliedView, setAppliedView] = useState<{ min: number | null; max: number | null }>({
    min: null,
    max: null,
  })
  const [lengthFilter, setLengthFilter] = useState<"all" | "short" | "long">("all")

  useEffect(() => {
    const loaded = loadChannelGroups()
    setGroups(loaded)
    if (loaded[0]) setActiveId(loaded[0].id)
  }, [])

  const persist = (next: ChannelGroup[]) => {
    setGroups(next)
    saveChannelGroups(next)
  }

  const active = useMemo(
    () => groups.find((g) => g.id === activeId) || null,
    [groups, activeId]
  )

  const medianViews = useMemo(() => {
    if (!active) return 1
    const all = active.channels.flatMap((c) => (c.videos || []).map((v) => v.viewCount))
    if (!all.length) return 1
    const sorted = [...all].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)] || 1
  }, [active])

  const allVideos = useMemo(() => {
    if (!active) return []
    let list = active.channels.flatMap((c) =>
      (c.videos || []).map((v) => ({
        ...v,
        channelTitle: c.channelTitle,
        channelThumb: c.thumbnailUrl,
        channelId: c.channelId,
      }))
    )

    if (channelFilter !== "all") {
      list = list.filter((v) => v.channelId === channelFilter)
    }

    const vp = VIEW_PRESETS.find((p) => p.id === viewPreset)!
    if (appliedView.min != null || appliedView.max != null) {
      list = list.filter((v) => {
        if (appliedView.min != null && v.viewCount < appliedView.min) return false
        if (appliedView.max != null && v.viewCount > appliedView.max) return false
        return true
      })
    } else if (viewPreset !== "all") {
      list = list.filter((v) => v.viewCount >= vp.min && v.viewCount < vp.max)
    }

    const mp = MUTATION_PRESETS.find((p) => p.id === mutPreset)!
    if (mutPreset !== "all") {
      list = list.filter((v) => v.viewCount / medianViews >= mp.min)
    }

    if (lengthFilter !== "all") {
      list = list.filter((video) => {
        const duration = video.durationSeconds || 0
        if (!duration) return false
        return lengthFilter === "short" ? duration <= 60 : duration > 60
      })
    }

    return [...list].sort((a, b) => {
      if (sortKey === "views") return b.viewCount - a.viewCount
      if (sortKey === "likes") return b.likeCount - a.likeCount
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })
  }, [active, sortKey, lengthFilter, channelFilter, viewPreset, mutPreset, appliedView, medianViews])

  const handleCreateGroup = () => {
    const g = createChannelGroup(newGroupName)
    const next = [g, ...groups]
    persist(next)
    setActiveId(g.id)
    setNewGroupName("")
  }

  const handleDeleteGroup = (id: string) => {
    const next = groups.filter((g) => g.id !== id)
    persist(next)
    setActiveId(next[0]?.id || null)
  }

  const handleAddChannel = async () => {
    if (!active || !channelInput.trim()) return
    setAdding(true)
    setError(null)
    try {
      const apiKey = getYoutubeApiKey()
      if (!apiKey) throw new Error("YouTube Data API 키가 필요합니다.")
      const payload = await analyzeToGroupChannel(channelInput.trim(), apiKey)
      const updated = upsertGroupChannel(active, payload)
      persist(groups.map((g) => (g.id === active.id ? updated : g)))
      setChannelInput("")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAdding(false)
    }
  }

  const refreshChannels = async () => {
    if (!active?.channels.length) return
    setRefreshing(true)
    setError(null)
    try {
      const apiKey = getYoutubeApiKey()
      if (!apiKey) throw new Error("YouTube Data API 키가 필요합니다.")
      let updated = active
      for (const ch of active.channels) {
        try {
          const payload = await analyzeToGroupChannel(ch.channelId, apiKey)
          updated = upsertGroupChannel(updated, payload)
        } catch {
          /* skip failed channel */
        }
      }
      persist(groups.map((g) => (g.id === active.id ? updated : g)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRefreshing(false)
    }
  }

  const removeChannel = (channelId: string) => {
    if (!active) return
    const updated: ChannelGroup = {
      ...active,
      channels: active.channels.filter((c) => c.channelId !== channelId),
      updatedAt: new Date().toISOString(),
    }
    persist(groups.map((g) => (g.id === active.id ? updated : g)))
    if (channelFilter === channelId) setChannelFilter("all")
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <aside className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">관심 채널</h3>
          <FolderPlus className="h-4 w-4 text-teal-300" />
        </div>
        <div className="mb-3 flex gap-2">
          <Input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="그룹 이름"
            className="h-9 rounded-xl border-white/10 bg-black/30 text-sm text-zinc-100"
            onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
          />
          <Button
            size="icon"
            onClick={handleCreateGroup}
            className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1.5">
          {groups.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-zinc-500">
              그룹을 만들고 급상승·성과 리포트에서 채널을 즐겨찾기하세요
            </p>
          )}
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveId(g.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                activeId === g.id
                  ? "bg-gradient-to-r from-teal-500 to-sky-600 text-white shadow-lg shadow-teal-900/30"
                  : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Folder className="h-4 w-4 shrink-0 opacity-90" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{g.name}</span>
                  <span className="text-[11px] opacity-80">{g.channels.length}개 채널</span>
                </span>
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteGroup(g.id)
                }}
                onKeyDown={(e) => e.key === "Enter" && handleDeleteGroup(g.id)}
                className="rounded-lg p-1 text-white/60 hover:bg-black/20 hover:text-red-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-4">
        {!active ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-zinc-500">
            왼쪽에서 그룹을 선택하거나 새로 만드세요
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4 md:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-bold text-zinc-50">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-600">
                      <Users className="h-4 w-4 text-white" />
                    </span>
                    {active.name}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {active.channels.length}개 채널 · {allVideos.length}개 영상
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void refreshChannels()}
                  disabled={refreshing || !active.channels.length}
                  className="rounded-xl border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                  title="채널 영상 새로고침"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>

              <div className="mb-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20">
                <button
                  type="button"
                  onClick={() => setChannelsOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                >
                  <span className="text-xs font-semibold text-zinc-300">
                    등록된 채널 ({active.channels.length})
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-zinc-500 transition ${channelsOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {channelsOpen && (
                  <div className="space-y-2 border-t border-white/[0.06] px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {active.channels.map((c) => (
                        <div
                          key={c.channelId}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-2"
                        >
                          {c.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.thumbnailUrl}
                              alt=""
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px]">
                              CH
                            </span>
                          )}
                          <span className="max-w-[140px] truncate text-xs text-zinc-200">
                            {c.channelTitle}
                            {c.subscriberCount ? ` · 구독 ${formatCount(c.subscriberCount)}` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeChannel(c.channelId)}
                            className="text-zinc-500 hover:text-red-300"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                      <Input
                        value={channelInput}
                        onChange={(e) => setChannelInput(e.target.value)}
                        placeholder="채널 ID / URL / 채널명"
                        className="h-10 rounded-xl border-dashed border-white/15 bg-black/30 text-zinc-100"
                        onKeyDown={(e) => e.key === "Enter" && void handleAddChannel()}
                      />
                      <Button
                        onClick={() => void handleAddChannel()}
                        disabled={adding || !channelInput.trim()}
                        variant="outline"
                        className="h-10 rounded-xl border-dashed border-teal-400/40 bg-transparent text-teal-200 hover:bg-teal-500/10"
                      >
                        {adding ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        채널 추가
                      </Button>
                    </div>
                    {error && <p className="text-xs text-red-300">{error}</p>}
                    <p className="text-[11px] text-zinc-500">
                      급상승·성과 리포트에서 ★로 즐겨찾기하면 해당 채널 영상이 여기에 모입니다.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4 md:p-5">
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-12 shrink-0 text-xs text-zinc-500">정렬</span>
                  {(
                    [
                      { id: "latest", label: "최신순" },
                      { id: "views", label: "조회수순" },
                      { id: "likes", label: "좋아요순" },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSortKey(s.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        sortKey === s.id
                          ? "bg-teal-500 text-white"
                          : "bg-white/[0.05] text-zinc-400"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                  <span className="ml-2 text-xs text-zinc-500">채널</span>
                  <select
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value)}
                    className="h-8 rounded-full border border-white/10 bg-black/40 px-3 text-xs text-zinc-200"
                  >
                    <option value="all">전체 채널 ({active.channels.length})</option>
                    {active.channels.map((c) => (
                      <option key={c.channelId} value={c.channelId}>
                        {c.channelTitle}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-12 shrink-0 text-xs text-zinc-500">조회수</span>
                  {VIEW_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setViewPreset(p.id)
                        setAppliedView({ min: null, max: null })
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        viewPreset === p.id && appliedView.min == null && appliedView.max == null
                          ? "bg-blue-500 text-white"
                          : "bg-white/[0.05] text-zinc-400"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <Input
                    value={viewMin}
                    onChange={(e) => setViewMin(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="최소"
                    className="h-8 w-16 rounded-lg border-white/10 bg-black/30 text-center text-xs"
                  />
                  <span className="text-[11px] text-zinc-500">~</span>
                  <Input
                    value={viewMax}
                    onChange={(e) => setViewMax(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="최대"
                    className="h-8 w-16 rounded-lg border-white/10 bg-black/30 text-center text-xs"
                  />
                  <span className="text-[11px] text-zinc-500">만</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedView({
                        min: viewMin ? Number(viewMin) * 10_000 : null,
                        max: viewMax ? Number(viewMax) * 10_000 : null,
                      })
                      setViewPreset("all")
                    }}
                    className="rounded-lg bg-blue-500 px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                    적용
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex w-12 shrink-0 items-center gap-0.5 text-xs text-zinc-500">
                    <Flame className="h-3 w-3 text-orange-400" />
                    배수
                  </span>
                  {MUTATION_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setMutPreset(p.id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        mutPreset === p.id
                          ? "bg-amber-500 text-white"
                          : "bg-white/[0.05] text-zinc-400"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-12 shrink-0 text-xs text-zinc-500">길이</span>
                  {(
                    [
                      { id: "all", label: "전체" },
                      { id: "short", label: "숏폼 (60초↓)" },
                      { id: "long", label: "롱폼 (60초↑)" },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setLengthFilter(s.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        lengthFilter === s.id
                          ? "bg-violet-500 text-white"
                          : "bg-white/[0.05] text-zinc-400"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {allVideos.length === 0 ? (
                <div className="py-16 text-center text-sm text-zinc-500">
                  채널을 즐겨찾기하면 올린 영상들이 여기에 표시됩니다
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {allVideos.map((v) => (
                    <a
                      key={`${v.videoId}-${v.channelId}`}
                      href={`https://www.youtube.com/watch?v=${v.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="scout-row group overflow-hidden rounded-2xl border border-white/[0.06] bg-[#121316] transition hover:border-teal-400/30"
                    >
                      <div className="relative aspect-video bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="space-y-1.5 p-2.5">
                        <p className="line-clamp-2 text-xs font-medium text-zinc-100">{v.title}</p>
                        <p className="flex items-center gap-1.5 truncate text-[11px] text-zinc-500">
                          {v.channelThumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.channelThumb} alt="" className="h-4 w-4 rounded-full" />
                          ) : null}
                          {v.channelTitle}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                          <span className="inline-flex items-center gap-0.5">
                            <Eye className="h-3 w-3" />
                            {formatCount(v.viewCount)}
                          </span>
                          <span className="inline-flex items-center gap-0.5">
                            <ThumbsUp className="h-3 w-3" />
                            {formatCount(v.likeCount)}
                          </span>
                          <span>{timeAgo(v.publishedAt)}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

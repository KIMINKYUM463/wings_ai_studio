"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Plus,
  Trash2,
  Folder,
  FolderPlus,
  Eye,
  ThumbsUp,
  Search,
  Flame,
  Loader2,
} from "lucide-react"
import type { GroupVideo, VideoGroup } from "../lib/types"
import { formatCount, getYoutubeApiKey, timeAgo } from "../lib/types"
import {
  createVideoGroup,
  loadVideoGroups,
  saveVideoGroups,
  upsertGroupVideo,
} from "../lib/groups-storage"

type SortKey = "saved" | "views" | "likes" | "latest"

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

function extractVideoId(input: string): string | null {
  const t = input.trim()
  if (/^[\w-]{11}$/.test(t)) return t
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`)
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).slice(0, 11) || null
    const v = u.searchParams.get("v")
    if (v) return v
    const shorts = u.pathname.match(/\/shorts\/([\w-]{11})/)
    if (shorts) return shorts[1]
  } catch {
    /* ignore */
  }
  return null
}

export function VideoGroupsTab() {
  const [groups, setGroups] = useState<VideoGroup[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newGroupName, setNewGroupName] = useState("")
  const [videoInput, setVideoInput] = useState("")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("saved")
  const [query, setQuery] = useState("")
  const [viewPreset, setViewPreset] = useState<(typeof VIEW_PRESETS)[number]["id"]>("all")
  const [mutPreset, setMutPreset] = useState<(typeof MUTATION_PRESETS)[number]["id"]>("all")
  const [viewMin, setViewMin] = useState("")
  const [viewMax, setViewMax] = useState("")
  const [appliedView, setAppliedView] = useState<{ min: number | null; max: number | null }>({
    min: null,
    max: null,
  })
  const [mutMin, setMutMin] = useState("")
  const [mutMax, setMutMax] = useState("")
  const [appliedMut, setAppliedMut] = useState<{ min: number | null; max: number | null }>({
    min: null,
    max: null,
  })
  const [lengthFilter, setLengthFilter] = useState<"all" | "short" | "long">("all")

  useEffect(() => {
    const loaded = loadVideoGroups()
    setGroups(loaded)
    if (loaded[0]) setActiveId(loaded[0].id)
  }, [])

  const persist = (next: VideoGroup[]) => {
    setGroups(next)
    saveVideoGroups(next)
  }

  const active = useMemo(
    () => groups.find((g) => g.id === activeId) || null,
    [groups, activeId]
  )

  const medianViews = useMemo(() => {
    if (!active?.videos.length) return 1
    const sorted = [...active.videos].map((v) => v.viewCount).sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)] || 1
  }, [active])

  const filteredVideos = useMemo(() => {
    if (!active) return []
    let list = [...active.videos]

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((v) => v.title.toLowerCase().includes(q))
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
    if (appliedMut.min != null || appliedMut.max != null) {
      list = list.filter((v) => {
        const ratio = v.viewCount / medianViews
        if (appliedMut.min != null && ratio < appliedMut.min) return false
        if (appliedMut.max != null && ratio > appliedMut.max) return false
        return true
      })
    } else if (mutPreset !== "all") {
      list = list.filter((v) => v.viewCount / medianViews >= mp.min)
    }

    // duration optional — short/long만 durationSeconds 있을 때 적용
    if (lengthFilter !== "all") {
      list = list.filter((v) => {
        if (v.durationSeconds == null) return true
        return lengthFilter === "short" ? v.durationSeconds <= 60 : v.durationSeconds > 60
      })
    }

    return list.sort((a, b) => {
      if (sortKey === "views") return b.viewCount - a.viewCount
      if (sortKey === "likes") return b.likeCount - a.likeCount
      if (sortKey === "latest")
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    })
  }, [
    active,
    query,
    viewPreset,
    mutPreset,
    appliedView,
    appliedMut,
    lengthFilter,
    sortKey,
    medianViews,
  ])

  const handleCreateGroup = () => {
    const g = createVideoGroup(newGroupName)
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

  const removeVideo = (videoId: string) => {
    if (!active) return
    const updated: VideoGroup = {
      ...active,
      videos: active.videos.filter((v) => v.videoId !== videoId),
      updatedAt: new Date().toISOString(),
    }
    persist(groups.map((g) => (g.id === active.id ? updated : g)))
  }

  const handleAddVideo = async () => {
    if (!active || !videoInput.trim()) return
    setAdding(true)
    setError(null)
    try {
      const apiKey = getYoutubeApiKey()
      if (!apiKey) throw new Error("YouTube Data API 키가 필요합니다.")
      const videoId = extractVideoId(videoInput)
      if (!videoId) throw new Error("유효한 YouTube 영상 URL 또는 ID를 입력하세요.")

      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${apiKey}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || "영상 조회 실패")
      const item = data.items?.[0]
      if (!item) throw new Error("영상을 찾을 수 없습니다.")

      const parseIsoDuration = (iso?: string) => {
        if (!iso) return undefined
        const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
        if (!m) return undefined
        return (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) || 0
      }

      const payload: GroupVideo = {
        videoId,
        title: item.snippet?.title || "제목 없음",
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          "",
        viewCount: Number(item.statistics?.viewCount || 0),
        likeCount: Number(item.statistics?.likeCount || 0),
        publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
        channelId: item.snippet?.channelId || "",
        channelTitle: item.snippet?.channelTitle || "",
        durationSeconds: parseIsoDuration(item.contentDetails?.duration),
        savedAt: new Date().toISOString(),
      }

      const updated = upsertGroupVideo(active, payload)
      persist(groups.map((g) => (g.id === active.id ? updated : g)))
      setVideoInput("")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAdding(false)
    }
  }

  const applyViewRange = () => {
    const min = viewMin ? Number(viewMin) * 10_000 : null
    const max = viewMax ? Number(viewMax) * 10_000 : null
    setAppliedView({ min, max })
    setViewPreset("all")
  }

  const applyMutRange = () => {
    const min = mutMin ? Number(mutMin) : null
    const max = mutMax ? Number(mutMax) : null
    setAppliedMut({ min, max })
    setMutPreset("all")
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <aside className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">관심 영상</h3>
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
              그룹을 만들고 급상승에서 영상을 즐겨찾기하세요
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
                  <span className="text-[11px] opacity-80">{g.videos.length}개 영상</span>
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
              <div className="mb-4">
                <h2 className="flex items-center gap-2 text-xl font-bold text-zinc-50">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-600">
                    <Folder className="h-4 w-4 text-white" />
                  </span>
                  {active.name}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">{active.videos.length}개 영상</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={videoInput}
                  onChange={(e) => setVideoInput(e.target.value)}
                  placeholder="영상 URL / ID로 직접 추가"
                  className="h-10 rounded-xl border-white/10 bg-black/30 text-zinc-100"
                  onKeyDown={(e) => e.key === "Enter" && void handleAddVideo()}
                />
                <Button
                  onClick={() => void handleAddVideo()}
                  disabled={adding || !videoInput.trim()}
                  className="h-10 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600"
                >
                  {adding ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  영상 추가
                </Button>
              </div>
              {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
              <p className="mt-2 text-[11px] text-zinc-500">
                급상승·채널 상세에서 폴더 아이콘으로도 저장할 수 있습니다.
              </p>
            </div>

            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4 md:p-5">
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-12 shrink-0 text-xs text-zinc-500">정렬</span>
                  {(
                    [
                      { id: "saved", label: "저장순" },
                      { id: "views", label: "조회수순" },
                      { id: "likes", label: "좋아요순" },
                      { id: "latest", label: "업로드순" },
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
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="영상 제목으로 검색"
                    className="h-10 rounded-xl border-white/10 bg-black/30 pl-9 text-sm text-zinc-100"
                  />
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
                    onClick={applyViewRange}
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
                      onClick={() => {
                        setMutPreset(p.id)
                        setAppliedMut({ min: null, max: null })
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        mutPreset === p.id && appliedMut.min == null && appliedMut.max == null
                          ? "bg-amber-500 text-white"
                          : "bg-white/[0.05] text-zinc-400"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <Input
                    value={mutMin}
                    onChange={(e) => setMutMin(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="Min"
                    className="h-8 w-14 rounded-lg border-white/10 bg-black/30 text-center text-xs"
                  />
                  <span className="text-[11px] text-zinc-500">~</span>
                  <Input
                    value={mutMax}
                    onChange={(e) => setMutMax(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="Max"
                    className="h-8 w-14 rounded-lg border-white/10 bg-black/30 text-center text-xs"
                  />
                  <button
                    type="button"
                    onClick={applyMutRange}
                    className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                    적용
                  </button>
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
            </div>

            {filteredVideos.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center text-sm text-zinc-500">
                {active.videos.length === 0
                  ? "급상승에서 영상을 즐겨찾기하거나 위에서 URL로 추가하세요"
                  : "필터 조건에 맞는 영상이 없습니다"}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {filteredVideos.map((v) => (
                  <div
                    key={v.videoId}
                    className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#121316] transition hover:border-teal-400/30"
                  >
                    <a
                      href={`https://www.youtube.com/watch?v=${v.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <div className="relative aspect-video bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        {v.durationSeconds != null && (
                          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            {Math.floor(v.durationSeconds / 60)}:
                            {String(v.durationSeconds % 60).padStart(2, "0")}
                          </span>
                        )}
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
                    <button
                      type="button"
                      title="그룹에서 제거"
                      onClick={() => removeVideo(v.videoId)}
                      className="absolute right-2 top-2 rounded-lg bg-black/70 p-1.5 text-zinc-300 opacity-0 transition hover:text-red-300 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

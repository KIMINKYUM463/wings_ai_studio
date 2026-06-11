"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Eye, Heart, Loader2, Search, Star } from "lucide-react"
import { ShotFormTrendResearchShell } from "@/app/WingsAIStudioShotForm/components/ShotFormTrendResearchShell"
import { StudioPageHeader, studio } from "@/app/WingsAIStudioShotForm/components/ShotFormStudioUI"
import { PickedVideoDetailModal } from "./PickedVideoDetailModal"
import type { PickedVideoItem, PickedVideosResponse } from "@/lib/shotform-picked-videos-types"
import { formatViewCount } from "@/lib/shotform-picked-videos-utils"
import { cn } from "@/lib/utils"

const FAVORITES_KEY = "shotform-picked-favorites"

type TabId = "all" | "popular" | "liked"

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "전체보기" },
  { id: "popular", label: "인기순" },
  { id: "liked", label: "찜한 영상" },
]

function loadFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveFavorites(ids: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]))
}

function PickedVideoCard({
  video,
  liked,
  onToggleLike,
  onOpen,
}: {
  video: PickedVideoItem
  liked: boolean
  onToggleLike: () => void
  onOpen: () => void
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.22 }}
      className="group cursor-pointer"
      onClick={onOpen}
    >
      <motion.div className="rounded-xl border border-slate-800/90 bg-slate-900/80 p-4 transition group-hover:border-cyan-500/35 group-hover:bg-slate-900">
        <div className="flex items-start justify-between gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-sm font-bold tabular-nums text-cyan-300 ring-1 ring-cyan-500/25">
            {video.index}
          </span>
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleLike()
            }}
            whileTap={{ scale: 0.85 }}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition",
              liked ? "bg-red-500/90 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
            )}
            aria-label={liked ? "찜 해제" : "찜하기"}
          >
            <Heart className={cn("h-4 w-4", liked && "fill-current")} />
          </motion.button>
        </div>
        {video.isFree ? (
          <span className="mt-2 inline-block rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
            무료
          </span>
        ) : null}
        <p className="mt-2 line-clamp-3 text-sm font-bold leading-snug text-white">{video.productName}</p>
        <div className="mt-3 flex justify-end border-t border-slate-800/80 pt-3 text-xs text-slate-500">
          <span className="flex shrink-0 items-center gap-0.5 tabular-nums">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {formatViewCount(video.viewCount)}
          </span>
        </div>
      </motion.div>
    </motion.article>
  )
}

export function PickedVideosView() {
  const [videos, setVideos] = useState<PickedVideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>("all")
  const [query, setQuery] = useState("")
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set())
  const [selected, setSelected] = useState<PickedVideoItem | null>(null)

  useEffect(() => {
    setFavorites(loadFavorites())
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/shotform-picked-videos")
      if (!res.ok) throw new Error("목록을 불러오지 못했습니다.")
      const json = (await res.json()) as PickedVideosResponse
      setVideos(json.videos ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleLike = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveFavorites(next)
      return next
    })
  }, [])

  const filtered = useMemo(() => {
    let list = [...videos]
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((v) => v.productName.toLowerCase().includes(q))
    if (tab === "popular") list.sort((a, b) => b.viewCount - a.viewCount)
    if (tab === "liked") list = list.filter((v) => favorites.has(v.id))
    return list
  }, [videos, tab, query, favorites])

  return (
    <ShotFormTrendResearchShell activeRoute="picked">
      <div className="relative min-h-[60vh]">
        <motion.div
          className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl"
          animate={{ opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 5, repeat: Infinity }}
          aria-hidden
        />

        <StudioPageHeader
          icon={Star}
          title="추천영상"
          description="쇼핑 숏폼 레퍼런스 영상을 모아보고 찜할 수 있습니다."
          className="relative mb-6"
        />

        <motion.header
          className="relative mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-4"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
            {TABS.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative px-3 py-2 text-sm font-medium transition",
                    active ? "text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {t.label}
                  {active ? (
                    <motion.span
                      layoutId="picked-tab-underline"
                      className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-emerald-500"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  ) : null}
                </button>
              )
            })}
          </nav>
          <label className={cn("flex items-center gap-2 px-3 py-2", studio.surfaceMuted)}>
            <Search className="h-4 w-4 text-slate-500" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="상품명 검색"
              className="w-36 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600 sm:w-44"
            />
          </label>
        </motion.header>

        {loading ? (
          <motion.div className="flex min-h-[320px] items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
            영상 불러오는 중…
          </motion.div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-8 text-center text-sm text-red-200">
            {error}
            <button type="button" onClick={() => void load()} className="mt-2 text-cyan-300 underline">
              다시 시도
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-slate-500">
            {tab === "liked" ? "찜한 영상이 없습니다." : "검색 결과가 없습니다."}
          </p>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.03 } },
            }}
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((video) => (
                <PickedVideoCard
                  key={video.id}
                  video={video}
                  liked={favorites.has(video.id)}
                  onToggleLike={() => toggleLike(video.id)}
                  onOpen={() => setSelected(video)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        <p className="mt-6 text-center text-xs text-slate-600">
          총 {filtered.length}개
        </p>
      </div>

      <PickedVideoDetailModal video={selected} onClose={() => setSelected(null)} />
    </ShotFormTrendResearchShell>
  )
}

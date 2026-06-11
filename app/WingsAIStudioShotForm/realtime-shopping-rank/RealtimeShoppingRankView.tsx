"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, TrendingUp } from "lucide-react"
import { ShotFormTrendResearchShell } from "@/app/WingsAIStudioShotForm/components/ShotFormTrendResearchShell"
import { StudioEmptyState, StudioPageHeader } from "@/app/WingsAIStudioShotForm/components/ShotFormStudioUI"
import type { ShoppingRankApiResponse } from "@/lib/shotform-shopping-rank-types"
import { formatShoppingRankDateLabel, groupRankingsByDate } from "@/lib/shotform-shopping-rank-utils"
import { cn } from "@/lib/utils"

const easeOut = [0.22, 1, 0.36, 1] as const

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35, ease: easeOut },
}

const chipContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.08 },
  },
}

const chipItem = {
  initial: { opacity: 0, y: 10, scale: 0.92 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: easeOut },
  },
}

const columnContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

const columnCard = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: easeOut },
  },
}

const rowContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.035, delayChildren: 0.12 } },
}

const rowItem = {
  initial: { opacity: 0, x: -12 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: easeOut },
  },
}

function rankAccent(order: number): string {
  if (order === 1) return "text-amber-400"
  if (order === 2) return "text-slate-300"
  if (order === 3) return "text-amber-700/90"
  return "text-slate-500"
}

export function RealtimeShoppingRankView() {
  const [data, setData] = useState<ShoppingRankApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>("")

  const categories = useMemo(() => {
    if (!data?.rankings.length) return [] as string[]
    return [...new Set(data.rankings.map((r) => r.category_name))].sort((a, b) => a.localeCompare(b, "ko"))
  }, [data])

  useEffect(() => {
    if (!categories.length) {
      setCategory("")
      return
    }
    setCategory((prev) => (prev && categories.includes(prev) ? prev : categories[0]!))
  }, [categories])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/shotform-shopping-rank", { cache: "no-store" })
      const json = (await res.json()) as ShoppingRankApiResponse
      if (!res.ok) {
        throw new Error(json.error || "순위 데이터를 불러오지 못했습니다.")
      }
      if (json.error && !json.rankings.length) {
        throw new Error(json.error)
      }
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const columns = useMemo(
    () => (data ? groupRankingsByDate(data.rankings, category) : []),
    [data, category]
  )

  return (
    <ShotFormTrendResearchShell activeRoute="realtime-rank">
      <div className="relative overflow-hidden">
        <motion.div
          className="pointer-events-none absolute -left-32 top-0 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"
          animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-violet-500/8 blur-3xl"
          animate={{ opacity: [0.3, 0.55, 0.3], scale: [1.05, 1, 1.05] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          aria-hidden
        />

        <StudioPageHeader
          icon={TrendingUp}
          title="실시간 쇼핑순위"
          description="카테고리별 인기 쇼핑 키워드와 순위 변동을 확인하세요."
          className="relative mb-8"
        />

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              className="flex min-h-[320px] flex-col items-center justify-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" aria-hidden />
              <motion.p
                className="text-sm text-slate-400"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                순위 불러오는 중…
              </motion.p>
              <motion.div
                className="flex gap-2"
                initial="initial"
                animate="animate"
                variants={{
                  initial: { opacity: 0 },
                  animate: { transition: { staggerChildren: 0.15 } },
                }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-2 w-2 rounded-full bg-cyan-500/60"
                    variants={{
                      initial: { opacity: 0.3, y: 0 },
                      animate: {
                        opacity: [0.3, 1, 0.3],
                        y: [0, -6, 0],
                        transition: { duration: 0.8, repeat: Infinity, delay: i * 0.12 },
                      },
                    }}
                  />
                ))}
              </motion.div>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-6 text-center text-sm text-red-200"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              {error}
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 block w-full text-cyan-300 underline-offset-2 hover:underline"
              >
                다시 시도
              </button>
            </motion.div>
          ) : !categories.length ? (
            <StudioEmptyState
              title="아직 순위 데이터가 없습니다"
              description="네이버 데이터랩 등 실데이터 연동 후 이 화면에 표시됩니다."
            />
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="mb-8 flex flex-wrap gap-2"
                variants={chipContainer}
                initial="initial"
                animate="animate"
              >
                {categories.map((name) => {
                  const active = category === name
                  return (
                    <motion.button
                      key={name}
                      type="button"
                      variants={chipItem}
                      onClick={() => setCategory(name)}
                      layout
                      whileHover={{ scale: 1.04, y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      className={cn(
                        "relative overflow-hidden rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                        active
                          ? "border-cyan-400 bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                          : "border-cyan-500/40 bg-transparent text-slate-200 hover:border-cyan-400/70 hover:bg-cyan-500/10"
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="rank-category-pill"
                          className="absolute inset-0 rounded-full bg-cyan-500"
                          transition={{ type: "spring", stiffness: 380, damping: 28 }}
                        />
                      ) : null}
                      <span className="relative z-[1]">{name}</span>
                    </motion.button>
                  )
                })}
              </motion.div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={category}
                  className="mb-6"
                  {...fadeUp}
                >
                  <motion.h2
                    className="text-2xl font-bold text-white"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05, duration: 0.35, ease: easeOut }}
                  >
                    {category}
                  </motion.h2>
                  <motion.p
                    className="mt-1 text-sm text-slate-500"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.12 }}
                  >
                    최근 3일 랭킹
                  </motion.p>
                </motion.div>
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`grid-${category}`}
                  className="grid gap-4 lg:grid-cols-3"
                  variants={columnContainer}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {columns.map((col, colIndex) => (
                    <motion.section
                      key={col.date}
                      variants={columnCard}
                      className="overflow-hidden rounded-xl border border-slate-700/80 bg-[#0f1419]/95 backdrop-blur-sm"
                      whileHover={{
                        borderColor: "rgba(34, 211, 238, 0.35)",
                        boxShadow: "0 8px 32px rgba(6, 182, 212, 0.08)",
                      }}
                      transition={{ duration: 0.25 }}
                    >
                      <header className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
                        <motion.span
                          className="text-sm font-semibold text-slate-200"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.15 + colIndex * 0.08 }}
                        >
                          {formatShoppingRankDateLabel(col.date)}
                        </motion.span>
                        <motion.span
                          className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 22,
                            delay: 0.2 + colIndex * 0.08,
                          }}
                        >
                          TOP 10
                        </motion.span>
                      </header>
                      <motion.ol
                        className="space-y-1.5 p-3"
                        variants={rowContainer}
                        initial="initial"
                        animate="animate"
                      >
                        {col.items.map((item) => (
                          <motion.li
                            key={item.id}
                            variants={rowItem}
                            whileHover={{ x: 4, backgroundColor: "rgba(30, 41, 59, 0.85)" }}
                            className={cn(
                              "flex items-center gap-3 rounded-lg bg-slate-800/50 px-3 py-2.5",
                              item.rank_order <= 3 && "ring-1 ring-inset ring-white/5"
                            )}
                          >
                            <motion.span
                              className={cn(
                                "w-6 shrink-0 text-center text-sm font-bold tabular-nums",
                                rankAccent(item.rank_order)
                              )}
                              initial={item.rank_order <= 3 ? { scale: 0 } : false}
                              animate={{ scale: 1 }}
                              transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 18,
                                delay: 0.05 * item.rank_order,
                              }}
                            >
                              {item.rank_order}
                            </motion.span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">
                              {item.keyword}
                            </span>
                          </motion.li>
                        ))}
                      </motion.ol>
                    </motion.section>
                  ))}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ShotFormTrendResearchShell>
  )
}

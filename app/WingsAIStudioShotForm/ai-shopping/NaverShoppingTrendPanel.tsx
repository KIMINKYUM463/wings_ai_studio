"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Activity, ArrowDown, ArrowUp, BarChart3, ExternalLink, Flame, Loader2, RefreshCw, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ShoppingRankApiResponse } from "@/lib/shotform-shopping-rank-types"
import { formatShoppingRankDateLabel, groupRankingsByDate } from "@/lib/shotform-shopping-rank-utils"

type Props = {
  onKeywordSelect: (keyword: string) => void
}

export function NaverShoppingTrendPanel({ onKeywordSelect }: Props) {
  const [data, setData] = useState<ShoppingRankApiResponse | null>(null)
  const [categoryCode, setCategoryCode] = useState("50000000")
  const [highlight, setHighlight] = useState<"today" | "rising" | "steady">("today")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async (code: string, force = false) => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(
        `/api/shotform-shopping-rank?categoryCode=${encodeURIComponent(code)}${force ? `&t=${Date.now()}` : ""}`,
        { cache: "no-store" }
      )
      const json = (await response.json()) as ShoppingRankApiResponse
      if (!response.ok || json.error) throw new Error(json.error || "쇼핑 순위 조회 실패")
      setData(json)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "쇼핑 순위 조회 실패")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(categoryCode)
  }, [categoryCode, load])

  const selectedCategory =
    data?.categories?.find((category) => category.code === categoryCode)?.name || "패션의류"
  const columns = useMemo(
    () => (data ? groupRankingsByDate(data.rankings, selectedCategory).slice(0, 3) : []),
    [data, selectedCategory]
  )
  const highlights = data?.recommendations[highlight] || []
  const spotlightItem = data?.recommendations.today[0]
  const risingItem = data?.recommendations.rising[0]
  const steadyItem = data?.recommendations.steady[0]
  const trendRows = useMemo(
    () =>
      (data?.officialTrends || [])
        .filter((row) => row.category_code === categoryCode)
        .sort((a, b) => a.target_date.localeCompare(b.target_date))
        .slice(-14),
    [data, categoryCode]
  )
  const chart = useMemo(() => {
    if (!trendRows.length) return { line: "", area: "", points: [] as Array<{ x: number; y: number; ratio: number; date: string }> }
    const width = 720
    const height = 190
    const paddingX = 18
    const paddingY = 20
    const ratios = trendRows.map((row) => row.ratio)
    const min = Math.min(...ratios)
    const max = Math.max(...ratios)
    const range = Math.max(1, max - min)
    const points = trendRows.map((row, index) => ({
      x: paddingX + (index / Math.max(1, trendRows.length - 1)) * (width - paddingX * 2),
      y: paddingY + ((max - row.ratio) / range) * (height - paddingY * 2),
      ratio: row.ratio,
      date: row.target_date,
    }))
    const line = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ")
    const area = `${line} L ${points.at(-1)!.x} ${height} L ${points[0]!.x} ${height} Z`
    return { line, area, points }
  }, [trendRows])
  const latestTrend = trendRows.at(-1)?.ratio || 0
  const previousTrend = trendRows.at(-2)?.ratio || latestTrend
  const trendDelta = previousTrend > 0 ? ((latestTrend - previousTrend) / previousTrend) * 100 : 0
  const momentumScore = Math.max(0, Math.min(100, Math.round(60 + trendDelta * 2)))
  const latestItems = columns[0]?.items || []
  const totalMonthlySearches = latestItems.reduce((sum, item) => sum + (item.monthly_searches || 0), 0)

  return (
    <Card className="relative overflow-hidden border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,#0b2835_0%,#0d1422_38%,#090d17_100%)] shadow-[0_28px_90px_rgba(6,182,212,0.08)]">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl"
        animate={{ scale: [1, 1.25, 1], opacity: [0.25, 0.5, 0.25], x: [0, 35, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-36 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl"
        animate={{ scale: [1.15, 0.95, 1.15], opacity: [0.2, 0.45, 0.2], y: [0, -28, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent"
        animate={{ x: ["-100%", "100%"], opacity: [0, 1, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
      />
      <CardHeader className="relative z-10 space-y-5 border-b border-cyan-300/10 backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-3 text-xl text-white">
              <span className="relative grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
                <BarChart3 className="h-5 w-5" />
                <motion.span
                  className="absolute inset-0 rounded-2xl border border-cyan-300/40"
                  animate={{ scale: [1, 1.22, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
              </span>
              <span>
                네이버 쇼핑 인텔리전스
                <span className="ml-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 align-middle text-[9px] font-bold tracking-[0.18em] text-cyan-200">
                  LIVE
                </span>
              </span>
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              {data?.methodology || "네이버 공식 데이터를 기반으로 카테고리 순위를 분석합니다."}
            </p>
            <p className="mt-2 flex items-center gap-2 text-[10px] text-cyan-300/70">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              네이버 검색량·쇼핑 클릭 데이터 수집 연결됨
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void load(categoryCode, true)}
            disabled={loading}
            className="border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
          >
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            새로고침
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(data?.categories || [{ code: "50000000", name: "패션의류" }]).map((category) => (
            <motion.button
              key={category.code}
              type="button"
              onClick={() => setCategoryCode(category.code)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              className={`relative shrink-0 overflow-hidden rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition ${
                categoryCode === category.code
                  ? "border-cyan-300/40 text-white shadow-[0_8px_28px_rgba(6,182,212,0.16)]"
                  : "border-white/10 bg-black/20 text-zinc-400 hover:border-cyan-400/30 hover:text-zinc-200"
              }`}
            >
              {categoryCode === category.code ? (
                <motion.span
                  layoutId="naver-category-active"
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500/80 to-blue-500/60"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              ) : null}
              <span className="relative z-10">{category.name}</span>
            </motion.button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-5 py-6">
        {!loading && !error && trendRows.length ? (
          <div className="grid gap-4 lg:grid-cols-5">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border border-cyan-300/15 bg-black/25 p-4 backdrop-blur-xl lg:col-span-3"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold text-white">
                    <Activity className="h-4 w-4 text-cyan-300" />
                    14일 쇼핑 클릭 모멘텀
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-500">네이버 쇼핑인사이트 상대 클릭 지수</p>
                </div>
                <div className="text-right">
                  <motion.p
                    key={latestTrend}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-xl font-black text-cyan-200"
                  >
                    {latestTrend.toFixed(1)}
                  </motion.p>
                  <p className={`text-[10px] font-bold ${trendDelta >= 0 ? "text-rose-300" : "text-sky-300"}`}>
                    {trendDelta >= 0 ? "▲" : "▼"} {Math.abs(trendDelta).toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="relative h-48">
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-5">
                  {[0, 1, 2, 3].map((line) => (
                    <span key={line} className="block border-t border-dashed border-white/[0.06]" />
                  ))}
                </div>
                <svg viewBox="0 0 720 190" className="relative h-full w-full overflow-visible" role="img" aria-label={`${selectedCategory} 클릭 추이 그래프`}>
                  <defs>
                    <linearGradient id="naver-trend-line" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="55%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                    <linearGradient id="naver-trend-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                    </linearGradient>
                    <filter id="naver-trend-glow">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <motion.path
                    key={`area-${categoryCode}`}
                    d={chart.area}
                    fill="url(#naver-trend-area)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1 }}
                  />
                  <motion.path
                    key={`line-${categoryCode}`}
                    d={chart.line}
                    fill="none"
                    stroke="url(#naver-trend-line)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#naver-trend-glow)"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                  {chart.points.map((point, index) => (
                    <motion.circle
                      key={point.date}
                      cx={point.x}
                      cy={point.y}
                      r={index === chart.points.length - 1 ? 5 : 3}
                      fill={index === chart.points.length - 1 ? "#a78bfa" : "#67e8f9"}
                      stroke="#07111d"
                      strokeWidth="3"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.55 + index * 0.06, type: "spring" }}
                    />
                  ))}
                </svg>
              </div>
              <div className="flex justify-between text-[9px] text-zinc-600">
                <span>{formatShoppingRankDateLabel(trendRows[0]?.target_date || "")}</span>
                <span>{formatShoppingRankDateLabel(trendRows.at(-1)?.target_date || "")}</span>
              </div>
            </motion.section>

            <div className="grid grid-cols-2 gap-3 lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="col-span-2 flex items-center gap-5 rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-500/10 to-cyan-500/[0.04] p-4"
              >
                <div
                  className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full"
                  style={{ background: `conic-gradient(#22d3ee 0 ${momentumScore}%, rgba(255,255,255,.06) ${momentumScore}% 100%)` }}
                >
                  <div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-[#0c1421]">
                    <div className="text-center">
                      <motion.p
                        key={momentumScore}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-2xl font-black text-white"
                      >
                        {momentumScore}
                      </motion.p>
                      <p className="text-[8px] text-cyan-300">MOMENTUM</p>
                    </div>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-violet-200">
                    <Zap className="h-3.5 w-3.5" />
                    시장 활력 지수
                  </p>
                  <p className="mt-2 text-sm font-black text-white">
                    {momentumScore >= 75 ? "강한 상승 흐름" : momentumScore >= 55 ? "안정적 관심 유지" : "탐색 수요 관찰"}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                    클릭 변화량과 최신 추이를 결합한 분석 점수입니다.
                  </p>
                </div>
              </motion.div>
              <MetricCard
                label="월간 검색 수요"
                value={totalMonthlySearches ? totalMonthlySearches.toLocaleString() : "—"}
                detail="TOP 10 합산"
                delay={0.18}
              />
              <MetricCard
                label="현재 선두 키워드"
                value={latestItems[0]?.keyword || "—"}
                detail={latestItems[0]?.monthly_searches ? `월 ${latestItems[0].monthly_searches.toLocaleString()}회` : "분석 대기"}
                delay={0.25}
              />
            </div>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2 backdrop-blur-xl">
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_1.25fr]">
            <motion.button
              type="button"
              onClick={() => setHighlight("today")}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className={`order-3 relative min-h-32 overflow-hidden rounded-xl border p-4 text-left ${
                highlight === "today"
                  ? "border-cyan-300/40 bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-violet-500/10"
                  : "border-transparent bg-white/[0.025]"
              }`}
            >
              <motion.div
                className="absolute -right-8 -top-8 h-28 w-28 rounded-full border border-cyan-300/20"
                animate={{ rotate: 360, scale: [1, 1.12, 1] }}
                transition={{ rotate: { duration: 12, repeat: Infinity, ease: "linear" }, scale: { duration: 3, repeat: Infinity } }}
              >
                <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_14px_#67e8f9]" />
              </motion.div>
              <span className="flex items-center gap-1.5 text-[9px] font-black tracking-[0.18em] text-cyan-300">
                <Flame className="h-3.5 w-3.5" />
                WEEKLY SPOTLIGHT
              </span>
              <p className="mt-4 truncate text-xl font-black text-white">
                {spotlightItem?.category_name || (loading ? "분석 중…" : "데이터 없음")}
              </p>
              <p className="mt-1 max-w-[80%] truncate text-[10px] text-zinc-400">
                {spotlightItem?.reason || "이번 주 가장 주목할 쇼핑 카테고리"}
              </p>
              <span className="mt-3 inline-flex rounded-full bg-cyan-400/10 px-2 py-1 text-[9px] font-bold text-cyan-200">
                AI 주목도 {Math.round(spotlightItem?.score || 0)}
              </span>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => setHighlight("rising")}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className={`order-2 relative min-h-32 overflow-hidden rounded-xl border p-4 text-left ${
                highlight === "rising"
                  ? "border-rose-300/30 bg-gradient-to-br from-rose-500/15 to-orange-500/[0.05]"
                  : "border-transparent bg-white/[0.025]"
              }`}
            >
              <span className="flex items-center gap-1.5 text-[9px] font-black tracking-[0.18em] text-rose-300">
                <ArrowUp className="h-3.5 w-3.5" />
                RISING SIGNAL
              </span>
              <p className="mt-4 truncate text-lg font-black text-white">
                {risingItem?.keyword || (loading ? "분석 중…" : "데이터 없음")}
              </p>
              <p className="mt-1 truncate text-[10px] text-zinc-500">
                {risingItem?.reason || "순위가 빠르게 상승하는 키워드"}
              </p>
              <div className="absolute bottom-3 right-3 flex h-10 items-end gap-1">
                {[35, 52, 70, 94].map((height, index) => (
                  <motion.span
                    key={height}
                    className="w-2 rounded-t bg-gradient-to-t from-rose-500/30 to-rose-300"
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: 0.15 + index * 0.1, duration: 0.55 }}
                  />
                ))}
              </div>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => setHighlight("steady")}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className={`order-1 relative min-h-32 overflow-hidden rounded-xl border p-4 text-left ${
                highlight === "steady"
                  ? "border-violet-300/30 bg-gradient-to-br from-violet-500/15 to-indigo-500/[0.05]"
                  : "border-transparent bg-white/[0.025]"
              }`}
            >
              <span className="flex items-center gap-1.5 text-[9px] font-black tracking-[0.18em] text-violet-300">
                <Sparkles className="h-3.5 w-3.5" />
                STEADY POWER
              </span>
              <p className="mt-4 truncate text-lg font-black text-white">
                {steadyItem?.keyword || (loading ? "분석 중…" : "데이터 없음")}
              </p>
              <p className="mt-1 truncate text-[10px] text-zinc-500">
                {steadyItem?.reason || "상위권을 꾸준히 지키는 키워드"}
              </p>
              <div className="absolute bottom-4 right-4 grid h-9 w-9 place-items-center">
                {[1, 2, 3].map((ring) => (
                  <motion.span
                    key={ring}
                    className="absolute rounded-full border border-violet-300/40"
                    animate={{ width: [8, 38], height: [8, 38], opacity: [0.8, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: ring * 0.45 }}
                  />
                ))}
                <span className="h-2 w-2 rounded-full bg-violet-300 shadow-[0_0_12px_#c4b5fd]" />
              </div>
            </motion.button>
          </div>
        </section>

        {highlights.length ? (
          <div className="flex flex-wrap gap-2">
            {highlights.map((item, index) => (
              <button
                key={`${item.category_code}-${item.keyword || item.category_name}-${index}`}
                type="button"
                onClick={() => {
                  if (item.keyword) onKeywordSelect(item.keyword)
                  else setCategoryCode(item.category_code)
                }}
                className="rounded-full border border-cyan-400/20 bg-cyan-500/[0.06] px-3 py-1.5 text-xs text-zinc-200 hover:border-cyan-400/50"
              >
                {item.keyword || item.category_name}
                {item.change_ratio ? (
                  <span className={item.change_ratio > 0 ? "ml-1.5 text-rose-300" : "ml-1.5 text-sky-300"}>
                    {item.change_ratio > 0 ? "▲" : "▼"}
                    {Math.abs(item.change_ratio)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-500/[0.06] px-4 py-10 text-center text-xs text-red-200">
            {error}
          </div>
        ) : loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
            카테고리 쇼핑 순위를 분석하고 있습니다.
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-3">
            {columns.map((column, columnIndex) => (
              <motion.section
                key={column.date}
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: columnIndex * 0.12, duration: 0.45 }}
                whileHover={{ y: -3, borderColor: "rgba(34,211,238,.28)" }}
                className={`overflow-hidden rounded-2xl border bg-black/25 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl ${
                  columnIndex === 0
                    ? "border-cyan-300/60 ring-1 ring-cyan-300/25 shadow-[0_18px_55px_rgba(6,182,212,0.13)]"
                    : "border-white/10"
                }`}
              >
                <header className="flex items-center justify-between border-b border-white/8 px-3 py-2.5">
                  <span className="text-xs font-bold text-zinc-200">
                    {columnIndex === 0 ? "최근 제공 데이터 · " : ""}
                    {formatShoppingRankDateLabel(column.date)}
                  </span>
                  <span className="text-[9px] text-zinc-600">TOP 10</span>
                </header>
                <ol className="space-y-1 p-2">
                  {column.items.map((item, itemIndex) => (
                    <motion.li
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: columnIndex * 0.1 + itemIndex * 0.035 }}
                    >
                      <button
                        type="button"
                        onClick={() => onKeywordSelect(item.keyword)}
                        className="group grid w-full grid-cols-[28px_1fr_auto] items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-gradient-to-r hover:from-cyan-500/[0.08] hover:to-transparent"
                      >
                        <span className={`grid h-6 w-6 place-items-center rounded-lg text-[10px] font-black ${
                          item.rank_order <= 3
                            ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-300/20"
                            : "text-zinc-600"
                        }`}>
                          {item.rank_order}
                        </span>
                        <span className="truncate text-xs font-medium text-zinc-200 transition group-hover:text-white">{item.keyword}</span>
                        <span className="flex items-center gap-1 text-[9px]">
                          {(item.rank_change || 0) > 0 ? (
                            <><ArrowUp className="h-3 w-3 text-rose-300" /><span className="text-rose-300">{item.rank_change}</span></>
                          ) : (item.rank_change || 0) < 0 ? (
                            <><ArrowDown className="h-3 w-3 text-sky-300" /><span className="text-sky-300">{Math.abs(item.rank_change || 0)}</span></>
                          ) : (
                            <span className="text-zinc-700">―</span>
                          )}
                        </span>
                      </button>
                    </motion.li>
                  ))}
                </ol>
              </motion.section>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-white/8 pt-3 text-[10px] text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span>공식 인기순위가 아닌 검색량·쇼핑 클릭 추이 기반 자체 분석 결과입니다.</span>
          <a
            href={`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(selectedCategory)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
          >
            네이버 쇼핑에서 보기 <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricCard({
  label,
  value,
  detail,
  delay,
}: {
  label: string
  value: string
  detail: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -3, borderColor: "rgba(103,232,249,.3)" }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-3.5"
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 truncate text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-[9px] text-cyan-300/70">{detail}</p>
    </motion.div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Bot, CheckCircle2, Database, Loader2, RefreshCw, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type BestItem = {
  rank: number
  keyword: string
  score: number
  reason: string
  naverSignal: string
  coupangSignal: string
}

type Props = {
  onKeywordSelect: (keyword: string) => void
}

export function WeeklyKeywordBestPanel({ onKeywordSelect }: Props) {
  const [items, setItems] = useState<BestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [analyzedAt, setAnalyzedAt] = useState("")

  const analyze = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const apiKey =
        typeof window !== "undefined"
          ? localStorage.getItem("shotform_openai_api_key") || ""
          : ""
      const response = await fetch("/api/shotform/keyword-analysis/weekly-best", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "주간 키워드 분석 실패")
      setItems(data.items || [])
      setAnalyzedAt(data.analyzedAt || new Date().toISOString())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "주간 키워드 분석 실패")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void analyze()
  }, [analyze])

  return (
    <Card className="relative overflow-hidden border-violet-400/25 bg-gradient-to-br from-[#121426] via-[#101827] to-[#0c1720]">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-40 bg-gradient-to-r from-transparent via-cyan-300/[0.07] to-transparent"
        animate={{ x: ["-160px", "1200px"] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
      />
      <CardHeader className="relative border-b border-white/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
                <Bot className="h-5 w-5" />
                <motion.span
                  className="absolute inset-0 rounded-xl border border-violet-300/50"
                  animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </span>
              AI 주간 키워드 BEST 3
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              네이버 검색·쇼핑 클릭 추이와 쿠팡 카테고리 베스트를 교차 분석합니다.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void analyze()}
            disabled={loading}
            className="bg-violet-500 font-semibold text-white hover:bg-violet-400"
          >
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            AI 다시 분석
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative py-5">
        {loading ? (
          <div className="space-y-5">
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
              <CollectorNode icon={Search} label="네이버 수집" delay={0} />
              <FlowDots delay={0} />
              <CollectorNode icon={Database} label="쿠팡 수집" delay={0.35} />
              <FlowDots delay={0.45} />
              <CollectorNode icon={Bot} label="AI 교차 분석" delay={0.7} />
            </div>
            <div className="space-y-2">
              {[0, 1, 2].map((index) => (
                <motion.div
                  key={index}
                  className="h-14 overflow-hidden rounded-xl border border-white/8 bg-white/[0.025]"
                  initial={{ opacity: 0.25 }}
                  animate={{ opacity: [0.25, 0.7, 0.25] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: index * 0.2 }}
                >
                  <motion.div
                    className="h-full w-1/3 bg-gradient-to-r from-transparent via-violet-300/10 to-transparent"
                    animate={{ x: ["-100%", "400%"] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.18 }}
                  />
                </motion.div>
              ))}
            </div>
            <p className="text-center text-xs text-violet-200/70">
              여러 카테고리의 최근 데이터를 수집하고 공통 수요를 찾고 있습니다…
            </p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-500/[0.06] px-4 py-10 text-center">
            <p className="text-xs text-red-200">{error}</p>
            <button type="button" onClick={() => void analyze()} className="mt-3 text-xs text-violet-300 hover:underline">
              다시 시도
            </button>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {items.map((item, index) => (
              <motion.button
                key={`${item.rank}-${item.keyword}`}
                type="button"
                onClick={() => onKeywordSelect(item.keyword)}
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.12, duration: 0.4 }}
                whileHover={{ y: -3, scale: 1.01 }}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/20 p-4 text-left hover:border-violet-400/40"
              >
                <div className="flex items-start gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black ${
                    item.rank === 1
                      ? "bg-amber-500 text-zinc-950"
                      : item.rank === 2
                        ? "bg-zinc-300 text-zinc-900"
                        : "bg-amber-800 text-amber-100"
                  }`}>
                    {item.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-base font-black text-white">{item.keyword}</p>
                      <span className="shrink-0 text-xs font-bold text-violet-300">{item.score}점</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${item.score}%` }}
                        transition={{ delay: 0.2 + index * 0.12, duration: 0.8 }}
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-300">{item.reason}</p>
                <div className="mt-3 space-y-1 rounded-lg bg-white/[0.025] p-2.5 text-[10px] text-zinc-500">
                  <p><span className="text-emerald-300">N</span> {item.naverSignal}</p>
                  <p><span className="text-amber-300">C</span> {item.coupangSignal}</p>
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-violet-300">
                  <Sparkles className="h-3 w-3" />
                  이 키워드로 상품 검색
                </span>
              </motion.button>
            ))}
          </div>
        )}

        {analyzedAt && !loading ? (
          <p className="mt-4 flex items-center justify-end gap-1 text-[10px] text-zinc-600">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            {new Date(analyzedAt).toLocaleString("ko-KR")} 분석 완료 · 30분 캐시
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function CollectorNode({
  icon: Icon,
  label,
  delay,
}: {
  icon: typeof Search
  label: string
  delay: number
}) {
  return (
    <motion.div
      className="flex min-w-0 flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2 py-3"
      animate={{ borderColor: ["rgba(255,255,255,.1)", "rgba(167,139,250,.55)", "rgba(255,255,255,.1)"] }}
      transition={{ duration: 1.8, repeat: Infinity, delay }}
    >
      <Icon className="h-4 w-4 text-violet-300" />
      <span className="truncate text-[10px] text-zinc-400">{label}</span>
    </motion.div>
  )
}

function FlowDots({ delay }: { delay: number }) {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-cyan-400"
          animate={{ opacity: [0.15, 1, 0.15], x: [0, 3, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: delay + index * 0.16 }}
        />
      ))}
    </div>
  )
}

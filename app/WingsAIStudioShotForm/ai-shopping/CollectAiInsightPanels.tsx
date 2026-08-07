"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Sparkles,
  ShieldCheck,
  Target,
  Layers,
  Users,
  AlertTriangle,
  Quote,
  Mic2,
  BadgeCheck,
  Scale,
} from "lucide-react"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import type { CoupangReviewInsightsData } from "./project-actions"
import type { CoupangDetailInsights } from "@/lib/shotform-coupang-detail-insights"
import {
  FACT_CHECK_DIMS,
  factCheckGrade,
  mergeFactCheck,
} from "@/lib/shotform-fact-check"
import type { CoupangFactCheck } from "@/lib/shotform-coupang-reviews"

const ANALYSIS_PHASES = [
  "제품 이미지를 살펴보는 중",
  "상세 카피를 읽는 중",
  "리뷰에서 구매 포인트를 고르는 중",
  "사실 근거를 점검하는 중",
  "대본에 쓸 핵심만 추리는 중",
] as const

/** 제품 분석용 고급 로딩 */
function PremiumAnalysisLoading({ detailDisabled }: { detailDisabled?: boolean }) {
  const [phase, setPhase] = useState(0)
  const phases = detailDisabled
    ? (["리뷰를 읽는 중", "만족·사용 상황을 정리하는 중", "사실 근거를 점검하는 중", "대본 포인트를 만드는 중"] as const)
    : ANALYSIS_PHASES

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase((p) => (p + 1) % phases.length)
    }, 2200)
    return () => window.clearInterval(id)
  }, [phases.length])

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-400/20 bg-[#0a101c] px-4 py-10 sm:py-12">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="pa-glow-a absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pa-glow-b absolute left-[35%] top-[40%] h-32 w-32 rounded-full bg-orange-400/10 blur-2xl" />
        <div className="pa-shimmer absolute inset-0" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="pa-particle absolute h-1 w-1 rounded-full bg-amber-200/70"
            style={{
              left: `${18 + i * 12}%`,
              top: `${28 + ((i * 17) % 40)}%`,
              animationDelay: `${i * 0.35}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="relative mb-5 h-[88px] w-[88px]">
          <div className="pa-ring-outer absolute inset-0 rounded-full" />
          <div className="pa-ring-inner absolute inset-[10px] rounded-full" />
          <div className="pa-ring-core absolute inset-[22px] rounded-full bg-gradient-to-b from-amber-400/25 to-amber-600/5 shadow-[0_0_28px_rgba(251,191,36,0.25)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="pa-icon h-6 w-6 text-amber-200" strokeWidth={1.75} />
          </div>
        </div>

        <p className="text-[15px] font-semibold tracking-tight text-amber-50">제품 분석 중</p>
        <p
          key={phase}
          className="pa-phase mt-2 text-xs text-zinc-400 min-h-[1.25rem]"
        >
          {phases[phase]}
        </p>

        <div className="mt-5 flex w-full max-w-[220px] items-center gap-1.5">
          {phases.map((_, i) => (
            <div
              key={i}
              className={`h-[3px] flex-1 rounded-full transition-all duration-500 ${
                i <= phase ? "bg-gradient-to-r from-amber-400 to-orange-400" : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>

      <style>{`
        .pa-shimmer {
          background: linear-gradient(
            105deg,
            transparent 40%,
            rgba(251, 191, 36, 0.07) 50%,
            transparent 60%
          );
          background-size: 220% 100%;
          animation: pa-shimmer 2.8s ease-in-out infinite;
        }
        .pa-glow-a {
          animation: pa-pulse-center 3.2s ease-in-out infinite;
        }
        .pa-glow-b {
          animation: pa-pulse-free 4s ease-in-out infinite reverse;
        }
        .pa-ring-outer {
          border: 1.5px solid transparent;
          background:
            linear-gradient(#0a101c, #0a101c) padding-box,
            conic-gradient(from 0deg, transparent 0%, #fbbf24 28%, #fb923c 42%, transparent 55%)
              border-box;
          animation: pa-spin 2.4s linear infinite;
        }
        .pa-ring-inner {
          border: 1px solid transparent;
          background:
            linear-gradient(#0a101c, #0a101c) padding-box,
            conic-gradient(from 180deg, transparent 10%, rgba(251, 191, 36, 0.55) 35%, transparent 60%)
              border-box;
          animation: pa-spin-rev 3.6s linear infinite;
        }
        .pa-icon {
          animation: pa-icon 2.2s ease-in-out infinite;
        }
        .pa-phase {
          animation: pa-fade 0.45s ease;
        }
        .pa-particle {
          animation: pa-float 3.5s ease-in-out infinite;
        }
        @keyframes pa-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pa-spin-rev {
          to { transform: rotate(-360deg); }
        }
        @keyframes pa-pulse-center {
          0%, 100% { opacity: 0.35; transform: translate(-50%, -50%) scale(0.92); }
          50% { opacity: 0.9; transform: translate(-50%, -50%) scale(1.1); }
        }
        @keyframes pa-pulse-free {
          0%, 100% { opacity: 0.25; transform: scale(0.9); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }
        @keyframes pa-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        @keyframes pa-icon {
          0%, 100% { opacity: 0.75; transform: scale(0.96); filter: drop-shadow(0 0 4px rgba(251,191,36,0.2)); }
          50% { opacity: 1; transform: scale(1.08); filter: drop-shadow(0 0 12px rgba(251,191,36,0.55)); }
        }
        @keyframes pa-fade {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pa-float {
          0%, 100% { opacity: 0.12; transform: translateY(0); }
          50% { opacity: 0.85; transform: translateY(-12px); }
        }
      `}</style>
    </div>
  )
}

function getOpenAiKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_openai_api_key") || "").trim()
}

function uniqLines(items: string[], max = 8): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of items) {
    const s = String(raw || "")
      .replace(/\s+/g, " ")
      .trim()
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
    if (out.length >= max) break
  }
  return out
}

function SectionCard({
  title,
  icon,
  children,
  className = "",
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-xl border border-white/[0.07] bg-gradient-to-b from-[#141c2c] to-[#0f1624] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
    >
      <div className="mb-2.5 flex items-center gap-2">
        {icon ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-500/10 text-amber-200">
            {icon}
          </span>
        ) : null}
        <p className="text-[12px] font-semibold tracking-tight text-amber-100/95">{title}</p>
      </div>
      {children}
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) {
    return <p className="text-xs text-zinc-600">없음</p>
  }
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="text-[12.5px] text-zinc-200 leading-relaxed flex gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400/70" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function ScoreRing({ value }: { value: number }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setReady(true))
    return () => window.cancelAnimationFrame(id)
  }, [value])

  const r = 42
  const c = 2 * Math.PI * r
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c
  const grade = factCheckGrade(value)
  const stroke =
    grade.tone === "high" ? "#fbbf24" : grade.tone === "mid" ? "#f59e0b" : "#fb923c"

  return (
    <div className="relative h-[118px] w-[118px] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={ready ? offset : c}
          style={{
            filter: `drop-shadow(0 0 8px ${stroke}55)`,
            transition: "stroke-dashoffset 1.1s ease-out",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-semibold tabular-nums tracking-tight text-amber-50 leading-none">
          {value}
        </span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">/ 100</span>
      </div>
    </div>
  )
}

function FactCheckPanel({ factCheck }: { factCheck: CoupangFactCheck }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(id)
  }, [factCheck.overall])

  const grade = factCheckGrade(factCheck.overall)
  const radarData = FACT_CHECK_DIMS.map((d) => ({
    dim: d.short,
    full: d.label,
    score: factCheck[d.key],
    fullMark: 100,
  }))

  const toneClass =
    grade.tone === "high"
      ? "text-emerald-300/90 border-emerald-400/25 bg-emerald-500/10"
      : grade.tone === "mid"
        ? "text-amber-200 border-amber-400/25 bg-amber-500/10"
        : "text-orange-300 border-orange-400/25 bg-orange-500/10"

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-400/20 bg-gradient-to-br from-[#121a2a] via-[#0e1524] to-[#0a101c] px-4 py-4 sm:px-5">
      <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-orange-500/5 blur-2xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/25 bg-amber-500/15 text-amber-200">
            <Scale className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/70">
              Fact Integrity
            </p>
            <p className="text-[13px] font-semibold text-zinc-50 mt-0.5">사실 기반 신뢰도</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}
        >
          <BadgeCheck className="h-3.5 w-3.5" />
          {grade.label}
        </span>
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr] gap-5 items-center">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4 lg:flex-col lg:items-center">
          <ScoreRing value={factCheck.overall} />
          {factCheck.note ? (
            <p className="max-w-[200px] text-center text-[11px] leading-relaxed text-zinc-400 sm:text-left lg:text-center">
              {factCheck.note}
            </p>
          ) : null}
        </div>

        <div className="h-[200px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis
                dataKey="dim"
                tick={{ fill: "rgba(228,228,231,0.7)", fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(251,191,36,0.25)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#fafafa",
                }}
                labelFormatter={(label) => {
                  const hit = radarData.find((d) => d.dim === label)
                  return hit?.full || String(label)
                }}
                formatter={(value) => [`${value}점`, "점수"]}
              />
              <defs>
                <linearGradient id="fcRadarFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.12} />
                </linearGradient>
              </defs>
              <Radar
                name="사실성"
                dataKey="score"
                stroke="#fbbf24"
                fill="url(#fcRadarFill)"
                fillOpacity={0.45}
                strokeWidth={2}
                isAnimationActive
                animationDuration={900}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2.5 w-full min-w-0">
          {FACT_CHECK_DIMS.map((d, i) => {
            const score = factCheck[d.key]
            return (
              <div key={d.key}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-zinc-400">{d.label}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-amber-100/90">
                    {score}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-1000 ease-out"
                    style={{
                      width: mounted ? `${score}%` : "0%",
                      transitionDelay: `${i * 80}ms`,
                      boxShadow: "0 0 12px rgba(251,191,36,0.25)",
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * 상세페이지 + 리뷰 → 「제품 분석 결과」 (버튼으로 실행)
 */
export function CollectBriefingPanel({
  productName,
  detailImages,
  productImage,
  reviews,
  detailDisabled = false,
  detailInsights,
  reviewInsights,
  onDetailInsights,
  onReviewInsights,
}: {
  productName: string
  detailImages: string[]
  productImage: string | null
  reviews: Array<{ content: string }>
  detailDisabled?: boolean
  detailInsights: CoupangDetailInsights | null
  reviewInsights: CoupangReviewInsightsData | null
  onDetailInsights: (v: CoupangDetailInsights | null) => void
  onReviewInsights: (v: CoupangReviewInsightsData | null) => void
}) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  const httpDetails = detailImages.filter((u) => u.startsWith("http"))
  const canDetail =
    !detailDisabled &&
    (httpDetails.length > 0 || Boolean(productImage?.startsWith("http")))

  const usableReviews = reviews
    .map((r) => r.content.trim())
    .filter((c) => c.length >= 4)

  const canAnalyze =
    Boolean(productName.trim()) && (canDetail || usableReviews.length > 0)

  const runAnalyze = async () => {
    setErr("")
    const key = getOpenAiKey()
    if (!key) {
      setErr("설정(톱니바퀴)에서 OpenAI API 키를 입력해 주세요.")
      return
    }
    if (!canAnalyze) {
      setErr("제품명과 상세페이지(또는 리뷰)를 먼저 준비해 주세요.")
      return
    }

    setLoading(true)
    onDetailInsights(null)
    onReviewInsights(null)

    const errors: string[] = []
    let nextDetail: CoupangDetailInsights | null = null
    let nextReview: CoupangReviewInsightsData | null = null

    try {
      const tasks: Promise<void>[] = []

      if (canDetail) {
        tasks.push(
          (async () => {
            const res = await fetch("/api/shotform/coupang/detail-insights", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                openaiApiKey: key,
                productName,
                detailImageUrls: httpDetails.slice(0, 8),
                productImageUrl: productImage?.startsWith("http")
                  ? productImage
                  : undefined,
              }),
            })
            const json = (await res.json().catch(() => ({}))) as {
              insights?: CoupangDetailInsights
              error?: string
            }
            if (!res.ok || !json.insights) {
              errors.push(json.error || "상세페이지 분석 실패")
              return
            }
            nextDetail = json.insights
          })()
        )
      }

      if (usableReviews.length > 0) {
        tasks.push(
          (async () => {
            const res = await fetch("/api/shotform/coupang/review-insights", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                openaiApiKey: key,
                productName,
                reviews: usableReviews.slice(0, 40).map((content) => ({ content })),
              }),
            })
            const json = (await res.json().catch(() => ({}))) as {
              insights?: CoupangReviewInsightsData
              error?: string
            }
            if (!res.ok || !json.insights) {
              errors.push(json.error || "리뷰 분석 실패")
              return
            }
            nextReview = json.insights
          })()
        )
      }

      await Promise.all(tasks)

      const fact = mergeFactCheck({
        ai: nextReview?.factCheck,
        reviewCount: usableReviews.length,
        reviewInsights: nextReview,
        detailInsights: nextDetail,
        detailDisabled,
      })

      onDetailInsights(nextDetail)
      onReviewInsights(
        nextReview
          ? { ...nextReview, factCheck: fact }
          : usableReviews.length === 0 && nextDetail
            ? {
                strengths: [],
                useCases: [],
                concerns: [],
                quotes: [],
                factCheck: fact,
              }
            : null
      )

      if (errors.length) setErr(errors.join(" · "))
    } catch (e) {
      setErr(e instanceof Error ? e.message : "제품 분석에 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const briefing = useMemo(() => {
    const d = detailInsights
    const r = reviewInsights
    const summary =
      d?.summary?.trim() ||
      (r?.strengths?.length
        ? `리뷰 기준 핵심: ${r.strengths.slice(0, 2).join(" · ")}`
        : "")

    return {
      summary,
      selling: uniqLines(
        [...(d?.sellingPoints || []), ...(r?.strengths || [])],
        6
      ),
      features: uniqLines(d?.features || [], 6),
      situations: uniqLines(
        [...(d?.targetAudience || []), ...(r?.useCases || [])],
        6
      ),
      cautions: uniqLines([...(d?.caveats || []), ...(r?.concerns || [])], 5),
      quotes: uniqLines(r?.quotes || [], 6),
      scriptLines: uniqLines(
        [...(d?.hookLines || []).slice(0, 2), ...(d?.scriptLines || [])],
        6
      ),
    }
  }, [detailInsights, reviewInsights])

  const hasAny =
    Boolean(briefing.summary) ||
    briefing.selling.length > 0 ||
    briefing.features.length > 0 ||
    briefing.situations.length > 0 ||
    briefing.cautions.length > 0 ||
    briefing.quotes.length > 0 ||
    briefing.scriptLines.length > 0

  const factCheck = useMemo(() => {
    if (!hasAny) return null
    return mergeFactCheck({
      ai: reviewInsights?.factCheck,
      reviewCount: usableReviews.length,
      reviewInsights,
      detailInsights,
      detailDisabled,
    })
  }, [
    hasAny,
    reviewInsights,
    detailInsights,
    detailDisabled,
    usableReviews.length,
  ])

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0b1220] overflow-hidden shadow-[0_20px_50px_-28px_rgba(0,0,0,0.65)]">
      <div className="relative px-4 sm:px-5 py-4 border-b border-white/[0.06] flex flex-wrap items-start justify-between gap-3 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-500/[0.06] via-transparent to-transparent" />
        <div className="relative min-w-0 flex-1 flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-gradient-to-b from-amber-400/20 to-amber-600/5 text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.12)]">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/75">
              Product Analysis
            </p>
            <p className="text-[15px] font-semibold text-zinc-50 mt-1">제품 분석 결과</p>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              상세·리뷰를 합쳐 사실 근거와 대본 포인트를 정리합니다.
              {detailDisabled ? " (직접 입력 · 리뷰 중심)" : ""}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={loading || !canAnalyze}
          onClick={() => void runAnalyze()}
          className="relative shrink-0 bg-amber-500 hover:bg-amber-400 text-[#0b1220] font-semibold shadow-[0_8px_24px_-10px_rgba(245,158,11,0.8)]"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          )}
          제품 분석하기
        </Button>
      </div>

      <div className="px-4 sm:px-5 py-4 space-y-3">
        {err ? <p className="text-xs text-red-400">{err}</p> : null}

        {!hasAny && !loading ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-500">
              <Sparkles className="h-5 w-5" />
            </span>
            <p className="text-sm text-zinc-400">아직 분석 결과가 없습니다</p>
            <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
              {!productName.trim()
                ? "제품명을 입력한 뒤 「제품 분석하기」를 눌러 주세요."
                : !canAnalyze
                  ? "상세페이지 또는 리뷰를 준비한 뒤 분석해 주세요."
                  : "「제품 분석하기」를 누르면 사실성 그래프와 함께 결과가 표시됩니다."}
            </p>
          </div>
        ) : null}

        {loading ? <PremiumAnalysisLoading detailDisabled={detailDisabled} /> : null}

        {hasAny && !loading ? (
          <div className="space-y-3">
            {factCheck ? <FactCheckPanel factCheck={factCheck} /> : null}

            {briefing.summary ? (
              <SectionCard
                title="한눈에 요약"
                icon={<ShieldCheck className="h-3.5 w-3.5" />}
                className="border-amber-400/20 from-amber-500/[0.08] to-[#0f1624]"
              >
                <p className="text-[13px] text-zinc-100 leading-[1.7]">{briefing.summary}</p>
              </SectionCard>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {briefing.selling.length ? (
                <SectionCard title="왜 사는지 (장점)" icon={<Target className="h-3.5 w-3.5" />}>
                  <BulletList items={briefing.selling} />
                </SectionCard>
              ) : null}
              {briefing.features.length ? (
                <SectionCard title="제품 특징" icon={<Layers className="h-3.5 w-3.5" />}>
                  <BulletList items={briefing.features} />
                </SectionCard>
              ) : null}
              {briefing.situations.length ? (
                <SectionCard title="이런 분께 추천" icon={<Users className="h-3.5 w-3.5" />}>
                  <BulletList items={briefing.situations} />
                </SectionCard>
              ) : null}
              {briefing.cautions.length ? (
                <SectionCard title="주의 · 확인" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                  <BulletList items={briefing.cautions} />
                </SectionCard>
              ) : null}
            </div>

            {briefing.quotes.length ? (
              <SectionCard title="실제 고객 표현" icon={<Quote className="h-3.5 w-3.5" />}>
                <div className="flex flex-wrap gap-2">
                  {briefing.quotes.map((q, i) => (
                    <span
                      key={i}
                      className="inline-flex max-w-full rounded-lg border border-amber-400/15 bg-black/35 px-2.5 py-1.5 text-[12px] text-zinc-200 leading-snug shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      “{q}”
                    </span>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {briefing.scriptLines.length ? (
              <SectionCard title="대본에 쓸 멘트" icon={<Mic2 className="h-3.5 w-3.5" />}>
                <ol className="space-y-2">
                  {briefing.scriptLines.map((line, i) => (
                    <li
                      key={i}
                      className="text-[12.5px] text-zinc-100 leading-relaxed flex gap-2.5"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-[11px] font-semibold text-amber-200 tabular-nums">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{line}</span>
                    </li>
                  ))}
                </ol>
              </SectionCard>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

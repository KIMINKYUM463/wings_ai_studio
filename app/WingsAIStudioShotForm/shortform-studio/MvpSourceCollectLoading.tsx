"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_LINES = [
  "도우인에서 쇼핑 영상을 수집하는 중…",
  "샤오홍슈에서 리뷰·시연 영상을 수집하는 중…",
  "AI가 제품과 관련된 장면만 골라내는 중…",
  "두 플랫폼 결과를 모아서 정리하는 중…",
] as const

/** 도우인(왼쪽)·샤오홍슈(오른쪽) → AI 중심으로 카드가 흘러 들어오는 수집 로딩 */
export function MvpSourceCollectLoading({
  className,
  caption = "도우인 · 샤오홍슈 검색 중… (최대 수 분)",
}: {
  className?: string
  caption?: string
}) {
  const [statusIdx, setStatusIdx] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setStatusIdx((i) => (i + 1) % STATUS_LINES.length)
    }, 2600)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      className={cn(
        "relative flex min-h-[240px] flex-col items-center justify-center overflow-hidden px-4 py-8",
        className
      )}
    >
      {/* 배경 그리드·은은한 빛 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.12),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
      />

      <div className="relative z-[1] flex w-full max-w-lg items-center justify-between gap-2 sm:gap-6">
        {/* 도우인 — 박스 안은 중국어, 아래 라벨은 한글 */}
        <PlatformNode
          mark="抖音"
          label="도우인"
          accent="amber"
          side="left"
        />

        {/* 중앙 AI */}
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center sm:h-32 sm:w-32">
          <motion.div
            aria-hidden
            className="absolute inset-2 rounded-full border border-violet-400/30"
            animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute inset-5 rounded-full border border-cyan-400/25"
            animate={{ scale: [1.05, 0.95, 1.05], opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          />
          <motion.div
            className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/40 bg-violet-500/15 shadow-[0_0_28px_rgba(139,92,246,0.25)] sm:h-20 sm:w-20"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-7 w-7 text-violet-200 sm:h-8 sm:w-8" />
            <span className="absolute -bottom-5 text-[10px] font-bold tracking-wide text-violet-200/90">
              AI 수집
            </span>
          </motion.div>

          {/* 좌→중앙 카드 스트림 */}
          <CollectStream side="left" />
          {/* 우→중앙 카드 스트림 */}
          <CollectStream side="right" />
        </div>

        {/* 샤오홍슈 — 박스 안은 중국어, 아래 라벨은 한글 */}
        <PlatformNode
          mark="小红书"
          label="샤오홍슈"
          accent="rose"
          side="right"
        />
      </div>

      <div className="relative z-[1] mt-10 flex min-h-[3.25rem] flex-col items-center gap-1.5 text-center">
        <p className="text-sm font-medium text-slate-200">{caption}</p>
        <motion.p
          key={statusIdx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="text-xs text-violet-200/80"
        >
          {STATUS_LINES[statusIdx]}
        </motion.p>
      </div>
    </div>
  )
}

function PlatformNode({
  mark,
  label,
  accent,
  side,
}: {
  /** 박스 안 표시 (중국어) */
  mark: string
  /** 아래 한글 라벨 */
  label: string
  accent: "amber" | "rose"
  side: "left" | "right"
}) {
  const isAmber = accent === "amber"
  return (
    <motion.div
      className={cn(
        "relative flex w-[4.5rem] flex-col items-center gap-2 sm:w-24",
        side === "left" ? "items-start" : "items-end"
      )}
      animate={{ opacity: [0.75, 1, 0.75] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: side === "right" ? 0.4 : 0 }}
    >
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-2xl border sm:h-16 sm:w-16",
          isAmber
            ? "border-amber-400/35 bg-amber-500/10 text-amber-100"
            : "border-rose-400/35 bg-rose-500/10 text-rose-100"
        )}
      >
        <span className="text-[13px] font-black tracking-tight sm:text-sm">{mark}</span>
      </div>
      <span
        className={cn(
          "w-full text-center text-[10px] font-semibold sm:text-[11px]",
          isAmber ? "text-amber-200/90" : "text-rose-200/90"
        )}
      >
        {label}
      </span>
      {/* 플랫폼 펄 펄 */}
      <span
        aria-hidden
        className={cn(
          "absolute top-2 h-2 w-2 rounded-full",
          side === "left" ? "right-0" : "left-0",
          isAmber ? "bg-amber-400" : "bg-rose-400"
        )}
      >
        <motion.span
          className={cn(
            "absolute inset-0 rounded-full",
            isAmber ? "bg-amber-400" : "bg-rose-400"
          )}
          animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
      </span>
    </motion.div>
  )
}

function CollectStream({ side }: { side: "left" | "right" }) {
  const fromLeft = side === "left"
  const cards = [0, 1, 2]

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1/2 h-10 w-[42%] -translate-y-1/2 overflow-visible",
        fromLeft ? "right-1/2 origin-right" : "left-1/2 origin-left"
      )}
    >
      {cards.map((i) => (
        <motion.div
          key={`${side}-${i}`}
          className={cn(
            "absolute top-1/2 h-7 w-10 -translate-y-1/2 rounded-md border shadow-lg",
            fromLeft
              ? "border-amber-400/40 bg-gradient-to-br from-amber-500/30 to-amber-900/40"
              : "border-rose-400/40 bg-gradient-to-br from-rose-500/30 to-rose-900/40"
          )}
          initial={{
            x: fromLeft ? -8 : 8,
            opacity: 0,
            scale: 0.7,
          }}
          animate={{
            x: fromLeft ? [ -4, 72 ] : [ 4, -72 ],
            opacity: [0, 1, 1, 0],
            scale: [0.75, 1, 0.85],
            y: [0, i % 2 === 0 ? -6 : 6, 0],
          }}
          transition={{
            duration: 2.1,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.7,
            times: [0, 0.15, 0.75, 1],
          }}
          style={{
            left: fromLeft ? 0 : undefined,
            right: fromLeft ? undefined : 0,
          }}
        >
          <div className="m-1 h-2 w-6 rounded-sm bg-white/25" />
          <div className="mx-1 h-1.5 w-4 rounded-sm bg-white/15" />
        </motion.div>
      ))}
    </div>
  )
}

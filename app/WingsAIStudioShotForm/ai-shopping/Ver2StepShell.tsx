"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const ACCENT: Record<
  string,
  { glow: string; iconWrap: string; icon: string }
> = {
  orange: {
    glow: "from-orange-500/10 to-transparent",
    iconWrap: "from-orange-500/20 to-amber-500/10 border-orange-400/25",
    icon: "text-orange-300",
  },
  sky: {
    glow: "from-sky-500/10 to-transparent",
    iconWrap: "from-sky-500/20 to-blue-500/10 border-sky-400/25",
    icon: "text-sky-300",
  },
  emerald: {
    glow: "from-emerald-500/10 to-transparent",
    iconWrap: "from-emerald-500/20 to-teal-500/10 border-emerald-400/25",
    icon: "text-emerald-300",
  },
  amber: {
    glow: "from-amber-500/10 to-transparent",
    iconWrap: "from-amber-500/20 to-orange-500/10 border-amber-400/25",
    icon: "text-amber-300",
  },
  violet: {
    glow: "from-violet-500/10 to-transparent",
    iconWrap: "from-violet-500/20 to-fuchsia-500/10 border-violet-400/25",
    icon: "text-violet-300",
  },
}

/** 대본 생성과 동일한 단계 셸 (어두운 카드 + 그라데이션) */
export function Ver2StepShell({
  stepLabel,
  title,
  description,
  icon: Icon,
  accent = "orange",
  headerRight,
  children,
  className,
}: {
  stepLabel?: string
  title: string
  description?: string
  icon: LucideIcon
  accent?: keyof typeof ACCENT
  headerRight?: ReactNode
  children: ReactNode
  className?: string
}) {
  const a = ACCENT[accent] || ACCENT.orange
  return (
    <div className={cn("space-y-6", className)}>
      <Card className="border border-white/10 rounded-2xl shadow-2xl bg-[#121316] overflow-hidden relative">
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br pointer-events-none",
            a.glow
          )}
        />
        <CardHeader className="pb-4 relative z-10 border-b border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  "p-2 rounded-xl bg-gradient-to-br border shadow-sm shrink-0",
                  a.iconWrap
                )}
              >
                <Icon className={cn("w-5 h-5", a.icon)} />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xl font-bold text-zinc-100">
                  {stepLabel ? (
                    <>
                      {stepLabel}
                      <span className="text-zinc-500 font-semibold"> · </span>
                    </>
                  ) : null}
                  {title}
                </CardTitle>
                {description ? (
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
            {headerRight ? (
              <div className="relative z-10 flex flex-wrap gap-2 shrink-0">
                {headerRight}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="relative z-10 py-5 space-y-5">{children}</CardContent>
      </Card>
    </div>
  )
}

/** 단계 안쪽 서브 패널 (대본의 Visual Focus / Templates 블록과 동일 톤) */
export function Ver2StepPanel({
  eyebrow,
  title,
  description,
  right,
  children,
  className,
  bodyClassName,
  noPad,
}: {
  eyebrow?: string
  title?: string
  description?: string
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  noPad?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-[#0b1220] overflow-hidden",
        className
      )}
    >
      {(eyebrow || title || right) && (
        <div className="px-3.5 py-3 border-b border-white/[0.06] flex items-start justify-between gap-2">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300/70">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <p
                className={cn(
                  "text-sm font-semibold text-zinc-100",
                  eyebrow ? "mt-0.5" : ""
                )}
              >
                {title}
                {description ? (
                  <span className="ml-1.5 text-xs font-normal text-zinc-500">
                    {description}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      )}
      <div className={cn(noPad ? "" : "p-3.5", bodyClassName)}>{children}</div>
    </div>
  )
}

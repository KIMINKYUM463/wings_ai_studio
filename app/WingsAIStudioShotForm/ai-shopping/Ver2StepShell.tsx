"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** 단계마다 아이콘 칩 색만 살짝 다르게 (나머지는 같은 흰 카드) */
const ACCENT: Record<string, { chip: string }> = {
  orange: { chip: "bg-[#fff1ea] text-[#e8561f]" },
  sky: { chip: "bg-[#eaf4ff] text-[#1f6fe0]" },
  emerald: { chip: "bg-[#e7f8f1] text-[#0d9467]" },
  amber: { chip: "bg-[#fff6e0] text-[#b7790a]" },
  violet: { chip: "bg-[#f1edff] text-[#6c47e8]" },
}

/**
 * 단계 카드: 위쪽(제목·설명·오른쪽 버튼)은 앱 색 반전(light-remap)을 받지 않게 light-keep 으로 직접 색을 정하고,
 * 안쪽 내용은 기존 단계 컴포넌트가 기대하는 대로 그대로 둔다.
 */
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
    <div className={cn("mx-auto max-w-[1280px] space-y-6", className)}>
      <section className="overflow-hidden rounded-[24px] border border-[#e3e6ec] bg-[#ffffff] shadow-[0_1px_2px_rgba(14,16,22,0.04),0_24px_50px_-34px_rgba(14,16,22,0.25)]">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eef0f4] px-6 py-5 md:px-7">
          <div className="light-keep flex min-w-0 items-start gap-3.5 text-[#0e1016]">
            <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-[14px]", a.chip)}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              {stepLabel ? <p className="text-[11px] font-semibold text-[#9aa0ad]">{stepLabel}</p> : null}
              <h3 className="text-[20px] font-black leading-tight tracking-[-0.02em]">{title}</h3>
              {description ? <p className="mt-1 max-w-[680px] text-[13px] leading-relaxed text-[#5c6170]">{description}</p> : null}
            </div>
          </div>
          {headerRight ? <div className="flex shrink-0 flex-wrap gap-2">{headerRight}</div> : null}
        </header>
        <div className="space-y-5 px-5 py-6 md:px-7">{children}</div>
      </section>
    </div>
  )
}

/** 단계 안쪽 서브 패널 */
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
    <div className={cn("overflow-hidden rounded-2xl border border-[#e8eaf0] bg-[#fafbfc]", className)}>
      {(eyebrow || title || right) && (
        <div className="flex items-start justify-between gap-2 border-b border-[#eef0f4] px-4 py-3.5">
          <div className="light-keep min-w-0 text-[#0e1016]">
            {eyebrow ? <p className="text-[11px] font-bold text-[#2f3beb]">{eyebrow}</p> : null}
            {title ? (
              <p className={cn("text-[14px] font-bold", eyebrow ? "mt-0.5" : "")}>
                {title}
                {description ? <span className="ml-1.5 text-xs font-normal text-[#5c6170]">{description}</span> : null}
              </p>
            ) : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      )}
      <div className={cn(noPad ? "" : "p-4", bodyClassName)}>{children}</div>
    </div>
  )
}

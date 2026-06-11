"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Wings AI Studio 다크 UI 토큰 (Tailwind class 조합) */
export const studio = {
  page: "min-h-screen bg-[#060912] text-slate-100",
  sidebar: "border-r border-white/[0.06] bg-[#0a0f1a]/95 backdrop-blur-xl",
  header: "border-b border-white/[0.06] bg-[#060912]/80 backdrop-blur-md",
  surface: "rounded-2xl border border-white/[0.08] bg-[#0d1322]/90 shadow-[0_8px_32px_rgba(0,0,0,0.35)]",
  surfaceMuted: "rounded-xl border border-white/[0.06] bg-[#0a0f1a]/70",
  input:
    "h-12 rounded-xl border-white/10 bg-[#0a0f1a] text-white shadow-inner placeholder:text-slate-500 focus-visible:border-violet-500/50 focus-visible:ring-violet-500/25",
  btnPrimary:
    "rounded-xl border border-cyan-400/35 bg-cyan-500/10 font-semibold text-cyan-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition hover:border-cyan-300/50 hover:bg-cyan-500/20 hover:text-white disabled:opacity-50",
  btnSecondary:
    "rounded-xl border border-white/12 bg-white/[0.04] font-medium text-slate-100 shadow-sm transition hover:border-white/22 hover:bg-white/[0.08] hover:text-white disabled:opacity-50",
  btnDanger:
    "rounded-xl border border-white/8 bg-transparent text-slate-500 transition hover:border-rose-500/25 hover:bg-rose-950/35 hover:text-rose-300",
  btnOutline:
    "rounded-xl border border-cyan-400/25 bg-transparent font-medium text-cyan-100/90 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-50",
  btnSegmentActive:
    "border-cyan-400/40 bg-cyan-500/15 text-cyan-50 ring-1 ring-cyan-400/30",
  btnTabActive:
    "border-violet-400/50 bg-violet-500/20 font-medium text-violet-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] ring-1 ring-violet-400/20",
  btnTabIdle:
    "border-white/10 bg-[#0a0f1a]/50 text-slate-400 hover:border-violet-400/30 hover:bg-violet-500/10 hover:text-slate-200",
  badgeAccent: "border border-cyan-400/30 bg-cyan-500/15 text-cyan-100",
  btnGhost: "rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06] hover:text-white",
  navActive:
    "bg-cyan-500/12 font-medium text-cyan-50 ring-1 ring-cyan-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
  navIdle: "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
  label: "text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500",
} as const

type PageHeaderProps = {
  icon: LucideIcon
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
  editableTitle?: {
    value: string
    onChange: (value: string) => void
    onCommit: () => void
  }
}

export function StudioPageHeader({ icon: Icon, title, description, actions, className, editableTitle }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 flex-1">
        <h1 className="flex min-w-0 items-center gap-2.5 text-xl font-bold tracking-tight text-white sm:text-2xl">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-400/25">
            <Icon className="h-5 w-5 text-violet-300" aria-hidden />
          </span>
          {editableTitle ? (
            <input
              type="text"
              value={editableTitle.value}
              onChange={(e) => editableTitle.onChange(e.target.value)}
              onBlur={() => editableTitle.onCommit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur()
              }}
              maxLength={120}
              aria-label="프로젝트 이름"
              className="min-w-0 flex-1 truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-bold tracking-tight text-white outline-none transition hover:border-white/15 focus:border-violet-400/40 focus:bg-white/5 sm:text-2xl"
            />
          ) : (
            title
          )}
        </h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

type PageCardProps = {
  children: React.ReactNode
  className?: string
  /** 헤더 아래 본문만 감쌀 때 padding 조절 */
  padded?: boolean
}

export function StudioPageCard({ children, className, padded = true }: PageCardProps) {
  return (
    <div className={cn(studio.surface, padded && "p-5 sm:p-6", className)}>
      {children}
    </div>
  )
}

type SearchFieldProps = {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  submitLabel?: string
  loadingLabel?: string
  icon?: LucideIcon
  className?: string
}

export function StudioSearchField({
  value,
  onChange,
  onSubmit,
  placeholder = "URL을 입력하세요",
  disabled,
  loading,
  submitLabel = "분석",
  loadingLabel = "분석 중",
  icon: Icon,
  className,
}: SearchFieldProps) {
  return (
    <div className={cn("relative mx-auto max-w-3xl", className)}>
      {Icon ? (
        <Icon className="pointer-events-none absolute left-4 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
      ) : null}
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || loading}
        className={cn(
          studio.input,
          "h-14 w-full pr-[8.5rem] text-base",
          Icon && "pl-11"
        )}
        onKeyDown={(e) => e.key === "Enter" && !loading && !disabled && onSubmit()}
      />
      <div className="absolute right-2 top-1/2 z-[1] -translate-y-1/2">
        <button
          type="button"
          disabled={disabled || loading}
          className={cn(studio.btnPrimary, "h-10 px-5 text-sm disabled:opacity-60")}
          onClick={onSubmit}
        >
          {loading ? loadingLabel : submitLabel}
        </button>
      </div>
    </div>
  )
}

export function StudioEmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      <p className="text-base font-medium text-slate-200">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}

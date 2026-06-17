"use client"

import { CheckCircle2, Loader2, RefreshCw, Scissors, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { studio } from "../components/ShotFormStudioUI"
import { MAX_AUTO_EDIT_VIDEOS, type AutoEditPick } from "@/lib/shotform-auto-edit-types"

type Props = {
  picks: AutoEditPick[]
  editComplete?: boolean
  urlRefreshing?: boolean
  urlRefreshMsg?: string
  onClearPicks: () => void
  onRefreshUrls?: () => void
  onOpenAutoEdit: () => void
}

function PlatformChip({ label, count }: { label: string; count: number }) {
  if (count <= 0) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-slate-300">
      <span className="font-medium text-slate-100">{label}</span>
      <span className="font-mono text-violet-300">{count}</span>
    </span>
  )
}

/** MVP 테스트 하단 — 영상 선택 · AI 짜집기 진입 */
export function MvpEditPicksBar({
  picks,
  editComplete,
  urlRefreshing,
  urlRefreshMsg,
  onClearPicks,
  onRefreshUrls,
  onOpenAutoEdit,
}: Props) {
  if (picks.length === 0 && !editComplete) return null

  const douyinCount = picks.filter((p) => p.platform === "douyin").length
  const xhsCount = picks.filter((p) => p.platform === "xiaohongshu").length

  if (picks.length === 0 && editComplete) {
    return (
      <div className="sticky bottom-4 z-20 mx-auto max-w-3xl px-2">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-[#0a1210]/95 px-4 py-3.5 shadow-2xl backdrop-blur-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">영상 짜집기 완료</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-100/75">
              위 영상 편집기에서 「TTS 생성」으로 나레이션·자막을 만드세요. 다시 짜집기하려면 영상을 선택하세요.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sticky bottom-4 z-20 mx-auto max-w-3xl px-2">
      <div
        className={cn(
          "flex flex-col gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between",
          editComplete
            ? "border-emerald-400/25 bg-[#0a1218]/95"
            : "border-violet-400/25 bg-[#0c0f18]/95"
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
              editComplete
                ? "bg-emerald-500/12 ring-emerald-400/25"
                : "bg-violet-500/12 ring-violet-400/25"
            )}
          >
            <Scissors className={cn("h-4 w-4", editComplete ? "text-emerald-300" : "text-violet-300")} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              <span className={editComplete ? "text-emerald-300" : "text-violet-300"}>{picks.length}</span>
              <span className="text-slate-500"> / {MAX_AUTO_EDIT_VIDEOS}</span>
              <span className="text-slate-300"> 선택</span>
              <span className="text-slate-500"> · </span>
              <span>AI 짜집기</span>
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <PlatformChip label="抖音" count={douyinCount} />
              <PlatformChip label="小红书" count={xhsCount} />
              {editComplete ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
                  <CheckCircle2 className="h-3 w-3" />
                  짜집기 완료 · TTS·자막
                </span>
              ) : null}
            </div>
            {urlRefreshing && urlRefreshMsg ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] text-cyan-200/90">
                <Loader2 className="h-3 w-3 animate-spin" />
                {urlRefreshMsg}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {onRefreshUrls ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(studio.btnOutline, "h-8 gap-1.5 px-3 text-xs")}
              disabled={urlRefreshing}
              onClick={onRefreshUrls}
            >
              {urlRefreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              URL 갱신
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 rounded-lg border border-rose-400/40 bg-rose-950/40 px-3 text-xs font-medium text-rose-100 shadow-sm hover:border-rose-400/60 hover:bg-rose-900/50 hover:text-white"
            onClick={onClearPicks}
          >
            <X className="h-3.5 w-3.5" />
            선택 해제
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-8 gap-1.5 px-3 text-xs font-semibold",
              editComplete
                ? cn(studio.btnOutline, "font-medium")
                : "rounded-lg border border-emerald-400/50 bg-emerald-600 text-white shadow-sm hover:border-emerald-300/60 hover:bg-emerald-500"
            )}
            disabled={urlRefreshing}
            onClick={onOpenAutoEdit}
          >
            <Scissors className="h-3.5 w-3.5" />
            {editComplete ? "짜집기 다시" : "AI 짜집기"}
          </Button>
        </div>
      </div>
    </div>
  )
}

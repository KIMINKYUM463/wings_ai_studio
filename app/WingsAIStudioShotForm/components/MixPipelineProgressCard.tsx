"use client"

type Props = {
  title: string
  percent: number
  elapsedSec: number
  totalEstimateSec: number
}

export function MixPipelineProgressCard({ title, percent, elapsedSec, totalEstimateSec }: Props) {
  const pct = Math.min(100, Math.max(0, percent))
  const rem = Math.max(0, Math.round(totalEstimateSec - elapsedSec))

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c101c]/90 p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2 text-slate-200">
          <span className="h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-violet-500 to-pink-500" aria-hidden />
          <span className="truncate font-medium">{title}</span>
        </div>
        <span className="shrink-0 tabular-nums text-xs text-slate-500">
          {Math.floor(elapsedSec)}s / 약 {totalEstimateSec}s
        </span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 transition-[width] duration-150 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{Math.round(pct)}% 진행</span>
        <span>남은 시간 ~{rem}s</span>
      </div>
    </div>
  )
}

"use client"

import { cn } from "@/lib/utils"
import type { AutoEditJobResult, VideoAnalysis, VisualScene } from "@/lib/shotform-auto-edit-types"
import {
  formatBenchmarkSceneCard,
  visualTimelineForAnalysis,
} from "@/lib/shotform-visual-scene-match"

type Props = {
  analyses: VideoAnalysis[]
  outputScenes?: VisualScene[]
  activeOutputStart?: number
  className?: string
}

export function MvpVisualSceneList({
  analyses,
  outputScenes,
  activeOutputStart,
  className,
}: Props) {
  const playhead = activeOutputStart ?? -1

  const renderSceneList = (scenes: VisualScene[], label: string) => (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2">
      <p className="text-[11px] font-medium text-slate-300">{label}</p>
      <ul className="mt-2 max-h-[min(36vh,280px)] space-y-1.5 overflow-y-auto">
        {scenes.map((sc, i) => {
          const active = playhead >= sc.start - 0.05 && playhead < sc.end - 0.02
          return (
            <li
              key={`${sc.start}-${i}`}
              className={cn(
                "rounded-md border px-2 py-1.5 text-[10px] leading-relaxed",
                active
                  ? "border-emerald-500/40 bg-emerald-950/25 text-emerald-100"
                  : "border-white/5 bg-black/20 text-slate-400"
              )}
            >
              {formatBenchmarkSceneCard(sc)}
            </li>
          )
        })}
      </ul>
    </div>
  )

  if (!analyses.length && !outputScenes?.length) return null

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs font-medium text-violet-300">영상 장면 분석</p>
      <p className="text-[10px] leading-relaxed text-slate-500">
        구간별 화면 설명을 기준으로 짜집기·대본을 맞춥니다.
      </p>

      {outputScenes?.length
        ? renderSceneList(outputScenes, `짜집기 결과 타임라인 (${outputScenes.length}구간)`)
        : null}

      {analyses.map((a) => {
        const scenes = visualTimelineForAnalysis(a)
        if (!scenes.length) return null
        return (
          <div key={a.video_id}>
            {renderSceneList(scenes, `소스 ${a.video_id} · ${a.title?.slice(0, 36) || "영상"}`)}
          </div>
        )
      })}
    </div>
  )
}

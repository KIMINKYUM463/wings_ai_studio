"use client"

import { Clock, Sparkles, Tag } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import { formatBenchmarkSceneCard } from "@/lib/shotform-visual-scene-match"

type Props = {
  result: AutoEditJobResult
  videoUrl?: string | null
  playhead?: number
  className?: string
}

export function MvpAutoEditProductIntro({ result, videoUrl, playhead = 0, className }: Props) {
  const pa = result.productAnalysis
  if (!pa) return null

  const duration =
    result.mixInfo?.actualDuration ?? result.outputDuration ?? pa.videoDuration ?? 0
  const outputScenes = pa.scenes ?? []
  const vs = pa.videoStructure
  const hasStructure = Boolean(vs?.hook?.trim() || vs?.body?.trim() || vs?.cta?.trim())

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#12141a] to-[#0a0b0f]">
        <div className="grid gap-0 sm:grid-cols-[minmax(0,120px)_1fr]">
          {videoUrl ? (
            <div className="relative aspect-[9/16] max-h-[200px] w-full bg-black sm:max-h-none sm:w-auto">
              <video
                src={videoUrl}
                className="h-full w-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2.5 p-3">
            <div className="flex flex-wrap gap-1.5">
              {duration > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-200">
                  <Clock className="h-3 w-3" />
                  {duration.toFixed(1)}초
                </span>
              ) : null}
              {pa.category ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-200">
                  <Tag className="h-3 w-3" />
                  {pa.category}
                </span>
              ) : null}
              {result.mixInfo?.picks?.length ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-200">
                  <Sparkles className="h-3 w-3" />
                  {result.mixInfo.picks.length}컷 리믹스
                </span>
              ) : null}
            </div>

            <div>
              <p className="text-sm font-bold leading-snug text-white">{pa.productName}</p>
              {pa.summary ? (
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{pa.summary}</p>
              ) : null}
            </div>

            {pa.targetKeywords?.length ? (
              <div className="flex flex-wrap gap-1">
                {pa.targetKeywords.slice(0, 6).map((kw) => (
                  <span
                    key={kw}
                    className="rounded-md border border-white/8 bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-400"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {hasStructure ? (
        <details className="rounded-lg border border-white/8 bg-black/30 px-3 py-2">
          <summary className="cursor-pointer text-[10px] font-medium text-violet-300">
            영상 구조 (hook · body · cta)
          </summary>
          <div className="mt-2 space-y-2 text-[10px] leading-relaxed text-slate-500">
            {vs?.hook ? (
              <p>
                <span className="font-semibold text-rose-300/90">Hook</span> {vs.hook}
              </p>
            ) : null}
            {vs?.body ? (
              <p>
                <span className="font-semibold text-amber-300/90">Body</span> {vs.body}
              </p>
            ) : null}
            {vs?.cta ? (
              <p>
                <span className="font-semibold text-emerald-300/90">CTA</span> {vs.cta}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      {outputScenes.length > 0 ? (
        <div className="rounded-lg border border-violet-500/20 bg-violet-950/15 p-2.5">
          <p className="text-[10px] font-semibold text-violet-200">
            리믹스 장면 분석 ({outputScenes.length}구간)
          </p>
          <p className="mt-0.5 text-[9px] text-slate-500">
            출력 타임라인 구간별 화면 설명 — 대본 sceneSubtitles와 맞춥니다.
          </p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {outputScenes.map((sc, i) => {
              const active = playhead >= sc.start - 0.05 && playhead < sc.end - 0.02
              return (
                <li
                  key={`${sc.start}-${i}`}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[10px] leading-relaxed",
                    active
                      ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
                      : "border-white/5 bg-black/20 text-slate-400"
                  )}
                >
                  {formatBenchmarkSceneCard(sc)}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {result.mixInfo?.picks?.length ? (
        <details className="rounded-lg border border-orange-500/20 bg-orange-950/10 px-3 py-2">
          <summary className="cursor-pointer text-[10px] font-medium text-orange-200">
            mix picks ({result.mixInfo.picks.length}개)
          </summary>
          <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
            {result.mixInfo.picks.map((p, i) => (
              <li key={i} className="text-[10px] leading-relaxed text-slate-500">
                <span className="text-orange-300">소스{p.srcIndex}</span> {p.start}–{p.end}s
                <br />
                <span className="text-slate-400">{p.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {result.script?.bundle?.sceneSubtitles?.conversion?.length ? (
        <details className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 px-3 py-2">
          <summary className="cursor-pointer text-[10px] font-medium text-emerald-200">
            장면맞춤 대본 ({result.script.bundle.sceneSubtitles.conversion.length}블록)
          </summary>
          <ul className="mt-2 space-y-2">
            {result.script.bundle.sceneSubtitles.conversion.map((block, i) => (
              <li key={i} className="text-[10px] text-slate-400">
                <span className="font-mono text-violet-300">
                  {block.start}–{block.end}s
                </span>
                <pre className="mt-0.5 whitespace-pre-wrap text-slate-300">{block.text}</pre>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

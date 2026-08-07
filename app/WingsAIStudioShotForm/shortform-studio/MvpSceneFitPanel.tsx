"use client"

import { Loader2, Scissors, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatNarrationClock } from "@/lib/shotform-factory-narration-script"
import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import type { VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import { labelTtsSpeed } from "@/lib/shotform-tts-speed"
import { buildSceneFitRows, type SceneFitRow } from "@/lib/shotform-scene-fit-tts"
import { insp } from "./mvpInspectorUi"

type Props = {
  segments: NarrationSegment[]
  /** 원본(자르기 전) 컷 — 표시용 영상 길이 */
  baseSegments?: NarrationSegment[]
  voiceLineCues: VoiceLineCue[] | null
  sceneSpeeds: number[] | null
  baseSpeed: number
  sceneFitEnabled: boolean
  onSceneFitEnabledChange: (on: boolean) => void
  onTrimSceneToAudio: (sceneIndex: number) => void
  onTrimAllToAudio: () => void
  onPlayScene?: (sceneIndex: number) => void
  ttsLoading?: boolean
  light?: boolean
}

function statusLabel(row: SceneFitRow): string {
  if (row.status === "overflow") return "음성 초과"
  if (row.status === "trim") return "자동 자르기 가능"
  return "맞춤"
}

/**
 * 벤치마크 「장면별 편집」— 컷별 영상/음성/배속 + 음성에 맞춰 자르기
 */
export function MvpSceneFitPanel({
  segments,
  baseSegments,
  voiceLineCues,
  sceneSpeeds,
  baseSpeed,
  sceneFitEnabled,
  onSceneFitEnabledChange,
  onTrimSceneToAudio,
  onTrimAllToAudio,
  onPlayScene,
  ttsLoading,
  light = true,
}: Props) {
  const displaySegs = baseSegments?.length ? baseSegments : segments
  // 상태·영상 길이는 이미 맞춰 자른 playback segments 기준 (자동 자르기 반영)
  const rows = buildSceneFitRows(segments, voiceLineCues, sceneSpeeds, baseSpeed)
  const hasAudio = Boolean(voiceLineCues?.length)
  const canTrimAny = rows.some((r) => r.canTrimToAudio)

  return (
    <div className="space-y-3">
      <div
        className={cn(
          light ? insp.card : "rounded-xl border border-white/10 bg-black/30 p-3",
          "space-y-2.5"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className={cn(light ? insp.title : "text-xs font-medium text-white")}>장면 맞춤</p>
            <p
              className={cn(
                "mt-0.5 leading-relaxed",
                light ? "text-[10px] text-slate-500" : "text-[10px] text-slate-400"
              )}
            >
              컷 길이에 TTS 배속을 맞춥니다. 말이 길면 배속 대신 영상 끝 홀드로 문장 전체를 유지하고, 음성이 짧으면 영상을 자릅니다.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={sceneFitEnabled}
            onClick={() => onSceneFitEnabledChange(!sceneFitEnabled)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition",
              sceneFitEnabled
                ? "bg-emerald-500"
                : light
                  ? "bg-slate-200"
                  : "bg-white/15"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition",
                sceneFitEnabled ? "left-5" : "left-0.5"
              )}
            />
          </button>
        </div>
        {sceneFitEnabled ? (
          <p
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-[10px] leading-relaxed",
              light ? "bg-emerald-50 text-emerald-800" : "bg-emerald-950/40 text-emerald-200/90"
            )}
          >
            ON — TTS 시 장면마다 배속 자동 · 음성이 짧으면 영상을 음성 길이에 맞춰 자동 자르기
          </p>
        ) : (
          <p
            className={cn(
              "text-[10px] leading-relaxed",
              light ? "text-slate-500" : "text-slate-500"
            )}
          >
            OFF — 전역 배속({labelTtsSpeed(baseSpeed)})만 사용 · 영상은 자르지 않음
          </p>
        )}
      </div>

      {!hasAudio ? (
        <p
          className={cn(
            "rounded-lg border px-3 py-2.5 text-[11px] leading-relaxed",
            light
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-amber-500/30 bg-amber-950/20 text-amber-100/90"
          )}
        >
          TTS를 생성하면 장면별 영상·음성 길이와 배속이 여기에 표시됩니다.
        </p>
      ) : (
        <>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canTrimAny || ttsLoading}
              onClick={onTrimAllToAudio}
              className={cn(
                "h-8 gap-1.5 text-[11px] font-semibold",
                light
                  ? "border-violet-200 text-violet-800 hover:bg-violet-50"
                  : "border-violet-400/40 text-violet-100 hover:bg-violet-950/40"
              )}
            >
              <Scissors className="h-3.5 w-3.5" />
              전체 다시 자르기
            </Button>
          </div>

          <ul className="space-y-2.5">
            {rows.map((row) => {
              const seg = displaySegs[row.sceneIndex]
              const cue = voiceLineCues?.find((c) => c.sceneIndex === row.sceneIndex)
              // 실제 TTS에 넣은 문장 우선 (대본만 바뀐 경우 화면과 음성 불일치 방지)
              const text = (cue?.text || segments[row.sceneIndex]?.text || "").trim()
              const preview = text.replace(/\n/g, " ").slice(0, 72)
              return (
                <li
                  key={row.sceneIndex}
                  className={cn(
                    light
                      ? cn(insp.card, "space-y-2 overflow-hidden p-3")
                      : "space-y-2 rounded-xl border border-white/10 bg-black/25 p-3"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p
                        className={cn(
                          "text-[11px] font-bold",
                          light ? "text-slate-900" : "text-white"
                        )}
                      >
                        {row.sceneIndex + 1}
                        {seg ? (
                          <span
                            className={cn(
                              "ml-2 font-medium tabular-nums",
                              light ? "text-slate-500" : "text-slate-400"
                            )}
                          >
                            {formatNarrationClock(seg.start)}~
                            {formatNarrationClock(seg.end)}
                          </span>
                        ) : null}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                            light ? "bg-slate-100 text-slate-700" : "bg-white/10 text-slate-200"
                          )}
                        >
                          영상 {row.videoDurSec.toFixed(1)}초
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                            light ? "bg-slate-100 text-slate-700" : "bg-white/10 text-slate-200"
                          )}
                        >
                          음성 {row.audioDurSec.toFixed(1)}초
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                            row.speed >= 1.3
                              ? "bg-amber-100 text-amber-900"
                              : "bg-emerald-100 text-emerald-800"
                          )}
                        >
                          {labelTtsSpeed(row.speed)}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium",
                            row.status === "overflow"
                              ? "bg-rose-100 text-rose-800"
                              : row.status === "trim"
                                ? "bg-violet-100 text-violet-800"
                                : "bg-emerald-50 text-emerald-700"
                          )}
                        >
                          {statusLabel(row)}
                        </span>
                      </div>
                    </div>
                    {onPlayScene ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 gap-1 px-2 text-[10px]"
                        onClick={() => onPlayScene(row.sceneIndex)}
                      >
                        <Volume2 className="h-3 w-3" />
                        재생
                      </Button>
                    ) : null}
                  </div>

                  {preview ? (
                    <p
                      className={cn(
                        "line-clamp-2 text-[11px] leading-relaxed",
                        light ? "text-slate-600" : "text-slate-300"
                      )}
                    >
                      {preview}
                      {text.length > 72 ? "…" : ""}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    size="sm"
                    disabled={!row.canTrimToAudio || ttsLoading}
                    onClick={() => onTrimSceneToAudio(row.sceneIndex)}
                    className={cn(
                      "h-8 w-full gap-1.5 text-[11px] font-semibold",
                      light
                        ? "bg-violet-600 text-white hover:bg-violet-500"
                        : "bg-violet-600 text-white hover:bg-violet-500"
                    )}
                  >
                    {ttsLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Scissors className="h-3.5 w-3.5" />
                    )}
                    음성에 맞춰 자르기
                  </Button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

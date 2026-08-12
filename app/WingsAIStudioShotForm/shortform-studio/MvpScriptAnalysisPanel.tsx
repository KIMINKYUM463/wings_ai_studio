"use client"

import { useEffect, useState } from "react"
import { Eye, FilePenLine, Film, Loader2, RotateCcw, Sparkles, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatNarrationClock, narrationSegmentDuration } from "@/lib/shotform-factory-narration-script"
import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import { narrationFitForScene } from "@/lib/shotform-narration-timing"
import { insp } from "./mvpInspectorUi"

type Props = {
  baseSegments: NarrationSegment[]
  segments: NarrationSegment[]
  segmentVisualHints: string[]
  activeScene: number
  scriptRevision?: number
  scriptNeedsAi: boolean
  scriptGenerating: boolean
  onGenerateScript: () => void
  onRewriteScript: () => void
  onRestoreScript?: () => void
  canRestoreScript?: boolean
  scriptDirtyFromBaseline?: boolean
  onScriptOverride: (sceneId: number, text: string) => void
  onScriptOverrideBlur: (sceneId: number, text: string, sceneDur: number) => void
  onPlaySceneOnly: (index: number) => void
  /** 해당 씬만 TTS 재생성 */
  onRunTtsForScene?: (sceneIndex: number) => void
  sceneTtsLoadingIndex?: number | null
  onOpenInsertClip?: () => void
  insertClipBusy?: boolean
  /** false면 TTS 미생성 — 추가 영상 비활성 */
  insertClipAllowed?: boolean
  light?: boolean
}

/**
 * 대본 탭 — AI가 읽은 장면 설명 + 매칭 나레이션만 보여 주고 편집합니다.
 */
export function MvpScriptAnalysisPanel({
  baseSegments,
  segments,
  segmentVisualHints,
  activeScene,
  scriptRevision = 0,
  scriptNeedsAi,
  scriptGenerating,
  onGenerateScript,
  onRewriteScript,
  onRestoreScript,
  canRestoreScript = false,
  scriptDirtyFromBaseline = false,
  onScriptOverride,
  onScriptOverrideBlur,
  onPlaySceneOnly,
  onRunTtsForScene,
  sceneTtsLoadingIndex = null,
  onOpenInsertClip,
  insertClipBusy = false,
  insertClipAllowed = true,
  light = true,
}: Props) {
  const [visualEdits, setVisualEdits] = useState<Record<number, string>>({})

  useEffect(() => {
    setVisualEdits({})
  }, [scriptRevision, segmentVisualHints.join("\u0001")])

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="sm"
          disabled={scriptGenerating}
          onClick={scriptNeedsAi ? onGenerateScript : onRewriteScript}
          className={cn(
            "h-10 w-full gap-1.5 text-[12px] font-semibold text-white shadow-sm",
            scriptNeedsAi
              ? "bg-amber-500 hover:bg-amber-400"
              : "bg-orange-500 hover:bg-orange-400"
          )}
        >
          {scriptGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : scriptNeedsAi ? (
            <Sparkles className="h-3.5 w-3.5" />
          ) : (
            <FilePenLine className="h-3.5 w-3.5" />
          )}
          {scriptNeedsAi ? "AI 대본 생성" : "대본 다시쓰기"}
        </Button>
        {onOpenInsertClip ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={scriptGenerating || insertClipBusy || !insertClipAllowed}
            onClick={onOpenInsertClip}
            title={
              insertClipAllowed
                ? "TTS 생성 후 공백에 넣을 영상을 가져옵니다"
                : "TTS를 먼저 생성한 뒤 공백에 영상을 넣을 수 있습니다"
            }
            className={cn(
              "h-9 w-full gap-1.5 text-[11px] font-semibold",
              light
                ? "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
                : "border-violet-400/40 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
            )}
          >
            {insertClipBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Film className="h-3.5 w-3.5" />
            )}
            {insertClipAllowed ? "추가 영상 가져오기" : "추가 영상 (TTS 먼저)"}
          </Button>
        ) : null}
        {canRestoreScript && scriptDirtyFromBaseline && onRestoreScript ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={scriptGenerating}
            onClick={onRestoreScript}
            className="h-9 w-full gap-1.5 border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            title="AI 대본 생성 직후 상태로 되돌립니다 (TTS 생성 전만)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            원상복구 (TTS 생성 전)
          </Button>
        ) : null}
      </div>

      <ul className="space-y-2.5">
        {baseSegments.map((seg, i) => {
          const sceneId = i + 1
          const text = segments[i]?.text ?? seg.text
          const sceneDur = Math.max(0.1, seg.end - seg.start)
          const sceneDurationLabel = narrationSegmentDuration(seg)
          const fit = narrationFitForScene(text, sceneDur)
          const visualBase = segmentVisualHints[i]?.trim() || ""
          const visualDesc = visualEdits[i] ?? visualBase
          const active = activeScene === i
          const sceneLabel = String(sceneId).padStart(2, "0")

          return (
            <li
              key={`${seg.start}-${i}-${scriptRevision}`}
              className={cn(
                light
                  ? cn(
                      insp.card,
                      "space-y-0 overflow-hidden p-0",
                      active && "ring-2 ring-slate-900/15"
                    )
                  : cn(
                      "overflow-hidden rounded-xl border",
                      active ? "border-emerald-500/40 bg-emerald-950/25" : "border-white/10 bg-black/30"
                    )
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-between gap-2 border-b px-3 py-2",
                  light ? "border-slate-100 bg-slate-50/90" : "border-white/5 bg-white/[0.03]"
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider",
                      light ? "bg-slate-900 text-white" : "bg-violet-500/30 text-violet-100"
                    )}
                  >
                    SCENE {sceneLabel}
                  </span>
                  <span className={cn("font-mono text-[9px]", light ? "text-slate-500" : "text-slate-400")}>
                    {formatNarrationClock(seg.start)}–{formatNarrationClock(seg.end)} · {sceneDurationLabel}초
                  </span>
                </div>
                <button
                  type="button"
                  className={cn(
                    "text-[9px] font-medium underline-offset-2 hover:underline",
                    light ? "text-slate-500" : "text-slate-400"
                  )}
                  onClick={() => onPlaySceneOnly(i)}
                >
                  이 장면 미리보기
                </button>
              </div>

              <div className="space-y-3 p-3">
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Eye className={cn("h-3 w-3", light ? "text-slate-500" : "text-slate-400")} />
                    <p className={light ? insp.label : "text-[9px] font-medium text-slate-400"}>
                      장면 설명 · AI 분석
                    </p>
                  </div>
                  <textarea
                    value={visualDesc}
                    rows={2}
                    placeholder="이 컷에서 보이는 화면을 적어 주세요"
                    disabled={scriptGenerating}
                    className={cn(
                      "w-full resize-y rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed",
                      light
                        ? "border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400"
                        : "border-white/10 bg-black/40 text-slate-200 placeholder:text-slate-600"
                    )}
                    onChange={(e) =>
                      setVisualEdits((prev) => ({ ...prev, [i]: e.target.value }))
                    }
                  />
                </div>

                <div
                  className={cn(
                    "rounded-lg border p-2.5",
                    light
                      ? "border-amber-200/80 bg-amber-50/60"
                      : "border-amber-400/25 bg-amber-500/[0.07]"
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className={cn("h-3 w-3", light ? "text-amber-600" : "text-amber-300")} />
                      <p
                        className={cn(
                          "text-[9px] font-semibold tracking-wide",
                          light ? "text-amber-800" : "text-amber-200"
                        )}
                      >
                        나레이션 대본 · TTS·자막
                      </p>
                    </div>
                    {onRunTtsForScene ? (
                      <button
                        type="button"
                        disabled={
                          scriptGenerating ||
                          sceneTtsLoadingIndex != null ||
                          !text.trim()
                        }
                        title="이 장면 대본만 TTS 다시 생성 (짧으면 영상 자름 · 길면 영상 반복)"
                        className={cn(
                          "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold transition",
                          light
                            ? "bg-amber-500 text-white hover:bg-amber-400 disabled:opacity-40"
                            : "bg-amber-500/90 text-zinc-900 hover:bg-amber-400 disabled:opacity-40"
                        )}
                        onClick={() => onRunTtsForScene(i)}
                      >
                        {sceneTtsLoadingIndex === i ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Volume2 className="h-3 w-3" />
                        )}
                        음성
                      </button>
                    ) : null}
                  </div>
                  <textarea
                    value={text}
                    rows={3}
                    placeholder="이 장면에 맞춰 말할 대본을 적어 주세요"
                    disabled={scriptGenerating || sceneTtsLoadingIndex === i}
                    className={cn(
                      "w-full resize-y rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed",
                      light
                        ? "border-amber-200 bg-white text-slate-900 placeholder:text-amber-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                        : "border-amber-400/30 bg-black/50 text-slate-100 placeholder:text-amber-200/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
                    )}
                    onChange={(e) => onScriptOverride(sceneId, e.target.value)}
                    onBlur={(e) => onScriptOverrideBlur(sceneId, e.target.value, sceneDur)}
                  />
                  <p
                    className={cn(
                      "mt-1.5 text-[9px]",
                      light ? "text-amber-800/70" : "text-amber-200/70"
                    )}
                  >
                    {fit.charCount}자 · 예상 {fit.estimatedSec}초
                    {fit.status === "ok" ? " · 길이 적절" : ""}
                    {" · "}
                    장면 {sceneDurationLabel}초
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

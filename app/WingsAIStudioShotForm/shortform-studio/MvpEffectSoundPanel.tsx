"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Loader2,
  Play,
  Scissors,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import {
  STORY_SHOPPING_SFX_CATALOG,
  type StoryShoppingSfxCatalogItem,
} from "@/lib/story-shopping-sfx-catalog"
import {
  normalizeMvpEffectClips,
  type MvpEffectClip,
} from "@/lib/mvp-studio-types"
import { probeAudioDurationSec } from "@/lib/mvp-preview-audio-mix"
import {
  applyAudibleRangeToEffectTiming,
  detectAudibleAudioRange,
} from "@/lib/mvp-sfx-audible-range"
import type { VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import { cn } from "@/lib/utils"

const FAVORITES_KEY = "story-shopping-sfx-favorites"

/** 자동배치용 — API·클라이언트 공통으로 자주 쓰는 짧은 효과음 */
const AUTO_PLACE_CATALOG_IDS = [
  "004", "005", "006", "008", "009", "019", "029", "034", "036", "037",
  "045", "051", "060", "067", "083", "084", "086", "095", "103", "110",
  "122", "126", "135", "143", "163", "168", "174", "211", "213", "214",
  "215", "216", "217",
] as const

type Segment = { start: number; end: number; text: string }

type Props = {
  clips: MvpEffectClip[]
  onChange: (clips: MvpEffectClip[]) => void
  /** 영상 타임라인 기준 재생 위치 (효과음 저장 축과 동일) */
  playhead: number
  /** 타임라인 표시 길이(TTS 있으면 음성 길이) — UI 슬라이더용 */
  durationSec: number
  /** 효과음 저장·클램프용 영상 축 길이 */
  videoDurationSec?: number
  segments: Segment[]
  voiceLineCues?: VoiceLineCue[] | null
  selectedId: string | null
  onSelectedIdChange: (id: string | null) => void
  /** 팝업 인스펙터 톤 (이미 라이트 UI — 호환용) */
  tone?: "dark" | "light"
}

type AutoPlan = {
  sceneId: string
  lineIndex?: number
  catalogId: string
  offsetSec?: number
  volumePct?: number
  maxDurationSec?: number
  reason?: string
}

function initialFavorites(): string[] {
  if (typeof window === "undefined") return []
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]")
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []
  } catch {
    return []
  }
}

function pickLocalCatalogId(index: number, avoidId?: string): string {
  const list = AUTO_PLACE_CATALOG_IDS.filter((id) => id !== avoidId)
  const pool = list.length ? list : [...AUTO_PLACE_CATALOG_IDS]
  return pool[index % pool.length]!
}

/** API가 빈약해도 장면당 시작+중반 슬롯을 채움 */
function ensureDensePlans(
  plans: AutoPlan[],
  sceneCount: number
): AutoPlan[] {
  const byKey = new Map(
    plans.map((p) => [`${p.sceneId}:${Math.max(0, Number(p.lineIndex) || 0)}`, p] as const)
  )
  const out: AutoPlan[] = []
  let rotate = 0
  let lastId: string | undefined
  for (let scene = 0; scene < sceneCount; scene++) {
    const sceneId = String(scene + 1)
    for (const lineIndex of [0, 1]) {
      const key = `${sceneId}:${lineIndex}`
      const existing = byKey.get(key)
      if (existing) {
        out.push(existing)
        lastId = existing.catalogId
        continue
      }
      const catalogId = pickLocalCatalogId(rotate++, lastId)
      lastId = catalogId
      out.push({
        sceneId,
        lineIndex,
        catalogId,
        offsetSec: lineIndex >= 1 ? 0.4 : 0.08,
        volumePct: 58,
        maxDurationSec: 1.4,
        reason: lineIndex >= 1 ? "장면 중반 리듬 강조" : "장면 시작 전환",
      })
    }
  }
  return out
}

export function MvpEffectSoundPanel({
  clips,
  onChange,
  playhead,
  durationSec,
  videoDurationSec,
  segments,
  voiceLineCues = null,
  selectedId,
  onSelectedIdChange,
  tone: _tone = "light",
}: Props) {
  const [query, setQuery] = useState("")
  const [favorites, setFavorites] = useState<string[]>(initialFavorites)
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [autoPlacing, setAutoPlacing] = useState(false)
  const [message, setMessage] = useState("")
  const previewRef = useRef<HTMLAudioElement | null>(null)

  /**
   * TTS가 있으면 타임라인=음성 축에 저장(홀드 구간에도 중반음이 퍼짐).
   * TTS 없으면 영상 축.
   */
  const useAudioTimeline = Boolean(voiceLineCues?.length)
  const effectAxisDuration = useAudioTimeline
    ? Math.max(0.1, durationSec)
    : Math.max(
        0.1,
        videoDurationSec || 0,
        ...segments.map((s) => s.end),
        durationSec
      )

  useEffect(
    () => () => {
      previewRef.current?.pause()
      previewRef.current = null
    },
    []
  )

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return STORY_SHOPPING_SFX_CATALOG.filter(
      (item) =>
        !keyword ||
        item.label.toLowerCase().includes(keyword) ||
        item.id.includes(keyword) ||
        String(item.number).includes(keyword)
    ).sort(
      (a, b) =>
        Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) ||
        a.number - b.number
    )
  }, [favorites, query])

  const selected = clips.find((clip) => clip.id === selectedId) ?? null
  const selectedEnd = selected
    ? selected.startSec + selected.durationSec
    : 0
  const canSplitSelected = Boolean(
    selected &&
      playhead > selected.startSec + 0.08 &&
      playhead < selectedEnd - 0.08
  )

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id]
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
      return next
    })
  }

  const preview = (item: StoryShoppingSfxCatalogItem) => {
    previewRef.current?.pause()
    if (previewingId === item.id) {
      setPreviewingId(null)
      return
    }
    const audio = new Audio(item.src)
    previewRef.current = audio
    setPreviewingId(item.id)
    audio.onended = () => setPreviewingId(null)
    audio.onerror = () => setPreviewingId(null)
    void audio.play().catch(() => setPreviewingId(null))
  }

  const addItem = async (item: StoryShoppingSfxCatalogItem) => {
    const audible = await detectAudibleAudioRange(item.src).catch(async () => {
      const durationSec = await probeAudioDurationSec(item.src)
      return { durationSec, startSec: 0, endSec: durationSec }
    })
    const timing = applyAudibleRangeToEffectTiming({
      audible,
      maxDurationSec: 8,
      timelineRemainSec: effectAxisDuration - playhead,
    })
    const clip: MvpEffectClip = {
      id: `effect_${item.id}_${Date.now()}`,
      catalogId: item.id,
      label: `${item.number}. ${item.label}`,
      src: item.src,
      startSec: Math.max(0, Math.min(effectAxisDuration - 0.05, playhead)),
      durationSec: timing.durationSec,
      sourceOffsetSec: timing.sourceOffsetSec,
      sourceDurationSec: timing.sourceDurationSec,
      volumePct: 65,
    }
    onChange(normalizeMvpEffectClips([...clips, clip], effectAxisDuration))
    onSelectedIdChange(clip.id)
  }

  /** 타임라인에 바로 올리는 시작 시각(TTS 있으면 음성 초, 없으면 영상 초) */
  const resolveTimelineStartSec = (
    segmentIndex: number,
    lineIndex: number,
    planOffsetSec: number
  ): number => {
    const segment = segments[segmentIndex]
    if (!segment) return 0
    const cue = voiceLineCues?.find((c) => c.sceneIndex === segmentIndex)

    if (useAudioTimeline && cue) {
      const cueDur = Math.max(0.12, cue.endSec - cue.startSec)
      const offset =
        lineIndex >= 1
          ? Math.max(planOffsetSec || 0, cueDur * 0.45)
          : Math.max(0, planOffsetSec || cueDur * 0.06)
      return cue.startSec + Math.min(cueDur * 0.85, offset)
    }

    const segDur = Math.max(0.1, segment.end - segment.start)
    const baseOffset =
      lineIndex >= 1
        ? Math.max(planOffsetSec || 0, segDur * 0.42)
        : Math.max(0, planOffsetSec || segDur * 0.06)
    return segment.start + baseOffset
  }

  const runAutoPlacement = async () => {
    if (autoPlacing || !segments.length) return
    setAutoPlacing(true)
    setMessage("AI가 대본과 장면을 분석하고 있어요…")
    try {
      // 장면당 시작+중반 슬롯 → 효과음이 타임라인 전체에 들어가게
      const slots = segments.flatMap((segment, index) => {
        const cue = voiceLineCues?.find((c) => c.sceneIndex === index)
        const text =
          segment.text.trim() ||
          cue?.text?.trim() ||
          `장면 ${index + 1}`
        const dur = Math.max(
          0.1,
          cue ? cue.endSec - cue.startSec : segment.end - segment.start
        )
        const startSec = cue?.startSec ?? segment.start
        return [
          {
            sceneId: String(index + 1),
            lineIndex: 0,
            text,
            startSec,
            durationSec: dur,
          },
          {
            sceneId: String(index + 1),
            lineIndex: 1,
            text: `${text} (장면 중반 포인트)`,
            startSec,
            durationSec: dur,
          },
        ]
      })

      const response = await fetch("/api/shotform/story-shopping/asset-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "sfx_plan",
          productName: "",
          density: "high",
          openaiApiKey: localStorage.getItem("shotform_openai_api_key") || undefined,
          slots,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        plans?: AutoPlan[]
      }
      if (!response.ok) throw new Error(payload.error || "AI 효과음 배치에 실패했습니다.")

      const densePlans = ensureDensePlans(payload.plans || [], segments.length)
      const next: MvpEffectClip[] = []
      for (const [index, plan] of densePlans.entries()) {
        const segmentIndex = Math.max(0, Number(plan.sceneId) - 1)
        const segment = segments[segmentIndex]
        const catalogId = String(plan.catalogId || "").padStart(3, "0")
        const item = STORY_SHOPPING_SFX_CATALOG.find(
          (candidate) => candidate.id === catalogId
        )
        if (!segment || !item) continue
        const lineIndex = Math.max(0, Number(plan.lineIndex) || 0)
        const startSec = Math.min(
          effectAxisDuration - 0.05,
          Math.max(
            0,
            resolveTimelineStartSec(
              segmentIndex,
              lineIndex,
              Number(plan.offsetSec) || 0
            )
          )
        )

        const audible = await detectAudibleAudioRange(item.src).catch(async () => {
          const probed = await probeAudioDurationSec(item.src)
          return { durationSec: probed, startSec: 0, endSec: probed }
        })
        const timing = applyAudibleRangeToEffectTiming({
          audible,
          maxDurationSec: Math.max(0.4, Number(plan.maxDurationSec) || 1.5),
          timelineRemainSec: effectAxisDuration - startSec,
        })

        next.push({
          id: `effect_auto_${item.id}_${Date.now()}_${index}`,
          catalogId: item.id,
          label: `AI · ${item.number}. ${item.label}`,
          src: item.src,
          startSec,
          durationSec: timing.durationSec,
          sourceOffsetSec: timing.sourceOffsetSec,
          sourceDurationSec: timing.sourceDurationSec,
          volumePct: Math.min(85, Math.max(45, Number(plan.volumePct) || 60)),
          autoPlaced: true,
          autoReason: plan.reason,
        })
      }
      onChange(
        normalizeMvpEffectClips(
          [...clips.filter((clip) => !clip.autoPlaced), ...next],
          effectAxisDuration
        )
      )
      setMessage(
        `${next.length}개 효과음 자동 배치 완료 · 장면마다 시작+중반에 골고루 배치했어요`
      )
      onSelectedIdChange(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 효과음 배치에 실패했습니다.")
    } finally {
      setAutoPlacing(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-slate-900">스토리 효과음 217종</p>
            <p className="mt-0.5 text-[10px] text-slate-600">
              재생바 위치에 추가하거나 AI로 자동 배치합니다. 앞 무음은 건너뛰고, 끝은 페이드아웃됩니다.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={autoPlacing}
            onClick={() => void runAutoPlacement()}
            className="h-8 bg-amber-500 text-[10px] text-white hover:bg-amber-400"
          >
            {autoPlacing ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-3 w-3" />
            )}
            AI 자동배치
          </Button>
        </div>
        {message ? <p className="mt-2 text-[10px] text-amber-800">{message}</p> : null}
      </div>

      {selected ? (
        <div className="rounded-xl border border-violet-300 bg-violet-50 p-3">
          <div className="flex items-center justify-between">
            <p className="truncate text-xs font-semibold text-slate-900">{selected.label}</p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-rose-600"
              onClick={() => {
                onChange(clips.filter((clip) => clip.id !== selected.id))
                onSelectedIdChange(null)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-slate-600">음량</span>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[selected.volumePct]}
              onValueChange={(value) =>
                onChange(
                  clips.map((clip) =>
                    clip.id === selected.id
                      ? { ...clip, volumePct: value[0] ?? clip.volumePct }
                      : clip
                  )
                )
              }
            />
            <span className="w-8 text-right text-[10px] text-slate-600">
              {selected.volumePct}%
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] text-slate-600">시작 위치</span>
            <Slider
              min={0}
              max={Math.max(0.1, effectAxisDuration - selected.durationSec)}
              step={0.05}
              value={[selected.startSec]}
              onValueChange={(value) =>
                onChange(
                  normalizeMvpEffectClips(
                    clips.map((clip) =>
                      clip.id === selected.id
                        ? { ...clip, startSec: value[0] ?? clip.startSec }
                        : clip
                    ),
                    effectAxisDuration
                  )
                )
              }
            />
            <span className="w-10 text-right font-mono text-[9px] text-slate-600">
              {selected.startSec.toFixed(1)}s
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canSplitSelected}
            className="mt-3 h-8 w-full border-violet-300 bg-white text-[10px] text-violet-700"
            onClick={() => {
              if (!selected || !canSplitSelected) return
              const leftDuration = playhead - selected.startSec
              const rightDuration = selected.durationSec - leftDuration
              const splitClips = clips.flatMap((clip) =>
                clip.id !== selected.id
                  ? [clip]
                  : [
                      { ...clip, durationSec: leftDuration },
                      {
                        ...clip,
                        id: `${clip.id}_split_${Date.now()}`,
                        startSec: playhead,
                        durationSec: rightDuration,
                        sourceOffsetSec: clip.sourceOffsetSec + leftDuration,
                      },
                    ]
              )
              onChange(normalizeMvpEffectClips(splitClips, effectAxisDuration))
              onSelectedIdChange(null)
            }}
          >
            <Scissors className="mr-1.5 h-3.5 w-3.5" />
            재생바 위치에서 효과음 분할
          </Button>
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="효과음 이름 또는 번호 검색"
          className="h-9 border-slate-300 bg-white pl-8 text-xs text-slate-900"
        />
      </div>

      <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5"
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-[10px] text-slate-700"
              onDoubleClick={() => void addItem(item)}
            >
              <span className="font-mono text-violet-600">{item.id}</span> · {item.label}
            </button>
            <button
              type="button"
              aria-label="미리듣기"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md border",
                previewingId === item.id
                  ? "border-amber-400 bg-amber-100 text-amber-700"
                  : "border-slate-200 text-slate-500"
              )}
              onClick={() => preview(item)}
            >
              <Play className="h-3 w-3" />
            </button>
            <button
              type="button"
              aria-label="즐겨찾기"
              className="flex h-7 w-7 items-center justify-center text-amber-500"
              onClick={() => toggleFavorite(item.id)}
            >
              <Star
                className={cn("h-3.5 w-3.5", favorites.includes(item.id) && "fill-current")}
              />
            </button>
            <Button
              type="button"
              size="sm"
              className="h-7 bg-violet-600 px-2 text-[9px] text-white hover:bg-violet-500"
              onClick={() => void addItem(item)}
            >
              추가
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

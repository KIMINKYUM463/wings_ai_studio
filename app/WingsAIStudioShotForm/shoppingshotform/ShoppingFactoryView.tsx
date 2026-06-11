"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Star,
  Volume2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { MixPipelineProgressCard } from "../components/MixPipelineProgressCard"
import { studio } from "../components/ShotFormStudioUI"
import { VoicePreviewStudioDialog } from "./VoicePreviewStudioDialog"
import {
  MIX_FACTORY_URL_MAX,
  MIX_FACTORY_URL_MIN,
  readMixPipelineResult,
  readMixSourcesFromSession,
  SHOTFORM_SESSION_RESTORED_EVENT,
  writeMixPipelineResult,
} from "@/lib/shotform-mix-source"
import {
  formatNarrationClock,
  narrationSceneIndexFromPlayheadIn,
  narrationScriptPlainTextFrom,
  narrationSegmentDuration,
  narrationSubLineAtPlayhead,
  splitNarrationOverlay,
} from "@/lib/shotform-factory-narration-script"
import { useFactoryContentBundle } from "./useFactoryContentBundle"
import {
  filterSupertoneKoreanVoices,
  shotformSupertoneKey,
  SUPERTONE_VOICE_PREVIEW_TEXT,
} from "@/lib/shotform-factory-tts"
import {
  buildVoiceLineCues,
  collectNarrationSubtitleLines,
  mergeAudioUrlsToWavBlobUrl,
  mixTtsWithBgmWavBlobUrl,
  voiceSceneIndexAtLineCues,
  voiceSubtitleAtLineCues,
  type VoiceLineCue,
} from "@/lib/shotform-factory-line-tts"
import { voicePreviewAudioTimeFromVideoTime } from "@/lib/shotform-factory-voice-preview-sync"
import { VOICE_PREVIEW_BGM_OPTIONS, voicePreviewBgmSrc } from "@/lib/shotform-factory-voice-preview-bgm"
import {
  buildFactorySeoScript,
  collectFactoryReferenceTitles,
  defaultFactorySeoDurationSec,
  inferFactoryProductName,
  shotformOpenAiKey,
} from "@/lib/shotform-factory-seo"
import {
  buildCapCutExportZip,
  capcutDirectoryPickerSupported,
  downloadBlob,
  fetchBlobForCapCut,
  resolveCapCutFetchUrl,
  writeCapCutExportToDirectory,
  type FactoryCapCutExportInput,
} from "@/lib/shotform-factory-capcut-export"
import { synthesizeTtsLine } from "@/lib/shotform-tts-providers"
import { DEFAULT_TTS_SPEED, TTS_SPEED_OPTIONS } from "@/lib/shotform-tts-speed"

const STEPS = [
  "영상 소스 추가",
  "AI자막제거",
  "대본 생성",
  "자막 설정",
  "음성 생성",
  "제목,설명,태그 생성",
  "다운로드",
] as const

/** 단계 하단 「다음」 CTA — AI자막제거 단계와 동일 스타일 */
const FACTORY_FLOW_NEXT_BTN_CLASS =
  "bg-gradient-to-r from-emerald-600 to-teal-600 px-8 font-semibold text-white shadow-md shadow-emerald-950/30 hover:brightness-110"

type FactoryStep = 1 | 2 | 3 | 4 | 5 | 6 | 7

const JOB_TOTAL_SEC = 360
const PHASE_LABELS = ["소스 영상 다운로드 중...", "장면 분석 중...", "영상 합성 중..."] as const
const PHASE_REAL_MS = [14_000, 16_000, 18_000] as const

type FactoryVoiceOption = {
  id: string
  name: string
  desc: string
  provider: "Supertone"
}

type FactorySupertoneVoiceRow = {
  voice_id: string
  name: string
  styles?: string[]
  language?: string[]
}

const FONT_OPTIONS = [
  { value: "pretendard-bold", label: "프리텐다드 Bold" },
  { value: "pretendard", label: "프리텐다드 Regular" },
  { value: "noto-kr", label: "Noto Sans KR" },
] as const

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim())
  if (!m) return { r: 0, g: 0, b: 0 }
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

const VOICE_PREVIEW_SCENES = [
  { id: 1, v: 5.5, a: 5.3, tag: "적정" as const, speed: "1.1x", text: "무타공 압축봉 하나로 주방·욕실 수납이 달라져요." },
  { id: 2, v: 4.2, a: 4.4, tag: "적정", speed: "1.0x", text: "설치 30초! 드릴 없이 끼우기만 하면 끝." },
  { id: 3, v: 3.8, a: 3.5, tag: "적정", speed: "1.05x", text: "커튼봉·수건걸이·정리선반까지 다양하게 활용." },
  { id: 4, v: 4.0, a: 3.2, tag: "조정", speed: "0.95x", text: "튼튼한 지지력으로 무거운 옷도 OK." },
  { id: 5, v: 3.5, a: 3.4, tag: "적정", speed: "1.1x", text: "리뷰 고객들이 가장 많이 쓰는 꿀조합 공개." },
  { id: 6, v: 4.8, a: 3.6, tag: "적정", speed: "1.0x", text: "지금 영상에서 보이는 구성 그대로 장바구니에 담아보세요." },
  { id: 7, v: 3.5, a: 3.4, tag: "적정", speed: "1.0x", text: "다음 장면에서 실제 설치 전후를 비교합니다." },
] as const

const VOICE_PREVIEW_AUDIO_TOTAL = VOICE_PREVIEW_SCENES.reduce((acc, s) => acc + s.a, 0)
const VOICE_PREVIEW_VIDEO_TOTAL = VOICE_PREVIEW_SCENES.reduce((acc, s) => acc + s.v, 0)

/** 동기 프리뷰: 영상 누적 시간(초)으로 장면 인덱스 (0-based) */
function voicePreviewSceneIndexAtVideoTime(videoTimeSec: number): number {
  let acc = 0
  const t = Math.max(0, videoTimeSec)
  for (let i = 0; i < VOICE_PREVIEW_SCENES.length; i++) {
    const sc = VOICE_PREVIEW_SCENES[i]!
    if (t < acc + sc.v - 1e-9) return i
    acc += sc.v
  }
  return VOICE_PREVIEW_SCENES.length - 1
}

function formatMmSs(totalSec: number) {
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

const SEO_TITLE_MAX = 100

function titleForUrl(url: string): string {
  const items = readMixSourcesFromSession()
  const hit = items.find((i) => i.url.trim() === url.trim())
  return hit?.title || "레퍼런스 영상"
}

async function runJobPhase(
  phaseIndex: 0 | 1 | 2,
  onUpdate: (elapsedJobSec: number, pct: number) => void
): Promise<void> {
  const phaseStartSec = phaseIndex * 120
  const dur = PHASE_REAL_MS[phaseIndex]
  const start = Date.now()
  await new Promise<void>((resolve) => {
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / dur)
      const elapsedInPhase = t * 120
      const elapsedJob = phaseStartSec + elapsedInPhase
      const pct = (elapsedJob / JOB_TOTAL_SEC) * 100
      onUpdate(elapsedJob, pct)
      if (t >= 1) {
        clearInterval(id)
        onUpdate(phaseStartSec + 120, ((phaseStartSec + 120) / JOB_TOTAL_SEC) * 100)
        resolve()
      }
    }, 90)
  })
}

function StepperPill({
  label,
  stepNum,
  currentStep,
  className,
  onSelect,
}: {
  label: string
  stepNum: number
  currentStep: FactoryStep
  className?: string
  onSelect: (step: FactoryStep) => void
}) {
  const done = currentStep > stepNum
  const active = currentStep === stepNum
  const step = stepNum as FactoryStep
  return (
    <button
      type="button"
      onClick={() => onSelect(step)}
      aria-current={active ? "step" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors",
        "cursor-pointer hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c101c]",
        active
          ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.22)]"
          : done
            ? "border-emerald-600/50 bg-emerald-950/35 text-emerald-100 hover:border-emerald-500/70"
            : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-600 hover:bg-slate-900/80 hover:text-slate-300",
        className
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px]",
          done && "bg-emerald-500 text-white",
          active && !done && "bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.55)]",
          !done && !active && "bg-slate-800 text-slate-400"
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : stepNum}
      </span>
      <span className="min-w-0 flex-1 text-left leading-snug">{label}</span>
    </button>
  )
}

export function ShoppingFactoryView() {
  const {
    factoryNarSegments,
    factoryNarTotal,
    factoryPreviewVideoSrc,
  } = useFactoryContentBundle()

  const [currentStep, setCurrentStep] = useState<FactoryStep>(1)
  const [urls, setUrls] = useState<string[]>(["", ""])
  const [targetSeconds, setTargetSeconds] = useState(30)
  const [aiSubtitleRemoval, setAiSubtitleRemoval] = useState(false)
  const [pipeline, setPipeline] = useState<{
    active: boolean
    label: string
    pct: number
    elapsed: number
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ urls: string[]; titles: string[] } | null>(null)

  /** 3단계 진입 직후 대본 생성 로딩 */
  const [scriptVoiceLoading, setScriptVoiceLoading] = useState(false)
  const [voiceSearch, setVoiceSearch] = useState("")
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("")
  const [speechSpeed, setSpeechSpeed] = useState<number>(DEFAULT_TTS_SPEED)
  const [sceneIndex, setSceneIndex] = useState(1)
  const narrationSceneCount = factoryNarSegments.length
  const [narrationPlayheadSec, setNarrationPlayheadSec] = useState(0)
  const [narrationPlaying, setNarrationPlaying] = useState(false)
  const [factorySupertoneVoices, setFactorySupertoneVoices] = useState<FactorySupertoneVoiceRow[]>([])
  const [factorySupertoneLoading, setFactorySupertoneLoading] = useState(false)
  const [factorySupertoneStyle, setFactorySupertoneStyle] = useState("neutral")
  const [factoryVoicePreviewingId, setFactoryVoicePreviewingId] = useState<string | null>(null)
  const factoryVoicePreviewAudioRef = useRef<HTMLAudioElement | null>(null)

  /** 4단계: 자막 설정 */
  const [subFont, setSubFont] = useState("pretendard-bold")
  const [subColor, setSubColor] = useState("#ffffff")
  const [subSizePx, setSubSizePx] = useState(21)
  const [subWeight, setSubWeight] = useState<"normal" | "bold" | "extrabold">("bold")
  const [subY, setSubY] = useState(150)
  const [subX, setSubX] = useState(540)
  const [subOutlineOn, setSubOutlineOn] = useState(true)
  const [subOutlineColor, setSubOutlineColor] = useState("#000000")
  const [subOutlineW, setSubOutlineW] = useState(1)
  const [subBgOn, setSubBgOn] = useState(true)
  const [subBgColor, setSubBgColor] = useState("#000000")
  const [subBgOpacity, setSubBgOpacity] = useState(60)

  /** 5단계: 음성 생성 — TTS 생성 시뮬레이션 */
  const [voicePreviewLoading, setVoicePreviewLoading] = useState(false)
  /** `voicePreviewLoading`이 이미 true일 때도 TTS effect를 다시 돌리기 위한 토큰(「음성 다시 생성」) */
  const [voiceTtsRunNonce, setVoiceTtsRunNonce] = useState(0)
  const [voiceGenProgress, setVoiceGenProgress] = useState(0)
  const [voiceSyncVideoTime, setVoiceSyncVideoTime] = useState(0)
  /** TTS가 있을 때 자막은 실제 `audio.currentTime`과 동일한 축을 사용 */
  const [voiceSyncAudioPlayhead, setVoiceSyncAudioPlayhead] = useState(0)
  const [voicePreviewVideoDuration, setVoicePreviewVideoDuration] = useState(VOICE_PREVIEW_VIDEO_TOTAL)
  const [voicePreviewAudioUrl, setVoicePreviewAudioUrl] = useState<string | null>(null)
  const [voicePreviewAudioKey, setVoicePreviewAudioKey] = useState(0)
  const [voicePreviewAudioPlaying, setVoicePreviewAudioPlaying] = useState(false)
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null)
  const voiceSyncVideoRef = useRef<HTMLVideoElement | null>(null)
  /** 3단계: 나레이션 데모 타임라인과 동기되는 미리보기 영상 */
  const scriptNarrationVideoRef = useRef<HTMLVideoElement | null>(null)
  /** 4단계 스타일 프리뷰 — AI자막제거 단계 샘플 MP4만 표시 */
  const stylePreviewVideoRef = useRef<HTMLVideoElement | null>(null)
  /** 직전 AI 쇼핑 숏폼 단계 — 5단계 재진입 시 이전 TTS를 버리고 새로 합성 */
  const factoryPrevStepRef = useRef<FactoryStep | null>(null)
  /** 5단계: 장면별 대본 덮어쓰기(편집 디테일) — 키 없으면 대본 생성 단계 나레이션 스크립트 구간과 동일 */
  const [voiceSceneScriptOverrides, setVoiceSceneScriptOverrides] = useState<Record<number, string>>({})
  const [voicePreviewAudioDuration, setVoicePreviewAudioDuration] = useState(0)
  /** 줄별 TTS 길이로 만든 자막 큐 — 재생 시각과 1:1 매칭 */
  const [voiceLineCues, setVoiceLineCues] = useState<VoiceLineCue[] | null>(null)
  const voicePreviewMergedBlobRef = useRef<string | null>(null)
  /** TTS+BGM 오프라인 믹스 결과 (재생용 blob, raw TTS와 별도) */
  const voicePreviewBgmMixedBlobRef = useRef<string | null>(null)
  /** CapCut 보내기: blob URL 재-fetch 없이 붙일 WAV (merge=순TTS, 믹스 성공 시 TTS+BGM) */
  const voicePreviewMergedWavBlobRef = useRef<Blob | null>(null)
  const voicePreviewTtsExportBlobRef = useRef<Blob | null>(null)
  const voicePreviewExportIncludesBgmRef = useRef(false)
  /** 줄별 TTS 합성 완료 시 증가 → BGM 믹스 effect 트리거 */
  const [voicePreviewRawTtsKey, setVoicePreviewRawTtsKey] = useState(0)
  const [voicePreviewTtsReady, setVoicePreviewTtsReady] = useState(false)
  /** 배경음: `off` 또는 `"1"`…`"5"` — TTS 생성 후 오프라인으로 위에 얹음 */
  const [voiceBgmTrackId, setVoiceBgmTrackId] = useState<string>("off")
  const [voiceBgmVolume, setVoiceBgmVolume] = useState(22)
  const [voiceBgmVolumeDebounced, setVoiceBgmVolumeDebounced] = useState(22)
  const [voiceBgmMixing, setVoiceBgmMixing] = useState(false)
  const [voiceEditDetailOpen, setVoiceEditDetailOpen] = useState(false)
  const [voiceEditDetailSceneId, setVoiceEditDetailSceneId] = useState(1)

  /** 6단계: 제목·설명·태그 생성(유튜브 메타 등) */
  const [seoVideoTitle, setSeoVideoTitle] = useState("")
  const [seoRecommendedTitles, setSeoRecommendedTitles] = useState<string[]>([])
  const [seoVideoDesc, setSeoVideoDesc] = useState("")
  const [seoTags, setSeoTags] = useState<string[]>([])
  const [seoHashtags, setSeoHashtags] = useState<string[]>([])
  const [seoGenerating, setSeoGenerating] = useState(false)
  const [capcutExporting, setCapcutExporting] = useState(false)
  const [capcutExportZipOnly, setCapcutExportZipOnly] = useState(false)
  const [capcutLastFolder, setCapcutLastFolder] = useState<string | null>(null)
  const capcutForceFolderPickRef = useRef(true)
  const seoAutoGenerateRef = useRef(false)
  const factoryPreviewMp4BlobRef = useRef<Blob | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !factoryPreviewVideoSrc) return
    let cancelled = false
    void (async () => {
      const href = resolveCapCutFetchUrl(factoryPreviewVideoSrc)
      const b = await fetchBlobForCapCut(href)
      if (!cancelled && b && b.size >= 4096) {
        factoryPreviewMp4BlobRef.current = b
      }
    })()
    return () => {
      cancelled = true
    }
  }, [factoryPreviewVideoSrc])

  const getVoiceSceneText = useCallback(
    (id: number) =>
      voiceSceneScriptOverrides[id] ??
      factoryNarSegments[id - 1]?.text.replace(/\n/g, " ").trim() ??
      "",
    [voiceSceneScriptOverrides, factoryNarSegments]
  )
  const getVoiceSceneTextByIndex = useCallback(
    (i: number) => {
      const sc = VOICE_PREVIEW_SCENES[i]
      if (!sc) return ""
      return getVoiceSceneText(sc.id)
    },
    [getVoiceSceneText]
  )
  /** `\n` 자막 줄 유지 — 줄별 TTS·큐 생성용 */
  const getNarrationSceneTextByIndex = useCallback(
    (i: number) => voiceSceneScriptOverrides[i + 1] ?? factoryNarSegments[i]?.text ?? "",
    [voiceSceneScriptOverrides, factoryNarSegments]
  )

  useEffect(() => {
    const t = window.setTimeout(() => setVoiceBgmVolumeDebounced(voiceBgmVolume), 400)
    return () => window.clearTimeout(t)
  }, [voiceBgmVolume])

  /** TTS WAV 위에 BGM을 오프라인 합성 → `<audio>` 하나만 재생 (이중 출력·주기 seek 제거) */
  useEffect(() => {
    if (currentStep !== 5 || voicePreviewRawTtsKey === 0) return
    const rawUrl = voicePreviewMergedBlobRef.current
    if (!rawUrl) return

    if (voiceBgmTrackId === "off") {
      if (voicePreviewBgmMixedBlobRef.current) {
        URL.revokeObjectURL(voicePreviewBgmMixedBlobRef.current)
        voicePreviewBgmMixedBlobRef.current = null
      }
      voicePreviewTtsExportBlobRef.current = voicePreviewMergedWavBlobRef.current
      voicePreviewExportIncludesBgmRef.current = false
      setVoicePreviewAudioUrl(rawUrl)
      setVoicePreviewAudioKey((k) => k + 1)
      return
    }

    const bgmSrc = voicePreviewBgmSrc(voiceBgmTrackId)
    if (!bgmSrc) return

    let cancelled = false
    setVoiceBgmMixing(true)

    void (async () => {
      try {
        const { blobUrl, totalDurationSec, wavBlob } = await mixTtsWithBgmWavBlobUrl(
          rawUrl,
          bgmSrc,
          voiceBgmVolumeDebounced
        )
        if (cancelled) {
          URL.revokeObjectURL(blobUrl)
          return
        }
        if (voicePreviewBgmMixedBlobRef.current) {
          URL.revokeObjectURL(voicePreviewBgmMixedBlobRef.current)
        }
        voicePreviewBgmMixedBlobRef.current = blobUrl
        voicePreviewTtsExportBlobRef.current = wavBlob
        voicePreviewExportIncludesBgmRef.current = true
        setVoicePreviewAudioUrl(blobUrl)
        setVoicePreviewAudioDuration(totalDurationSec)
        setVoicePreviewAudioKey((k) => k + 1)
      } catch {
        if (!cancelled) {
          setToast("배경음 합치기에 실패했습니다. public/shotform-factory-bgm/bgm1~5.mp3 를 확인하세요.")
          voicePreviewTtsExportBlobRef.current = voicePreviewMergedWavBlobRef.current
          voicePreviewExportIncludesBgmRef.current = false
          setVoicePreviewAudioUrl(rawUrl)
          setVoicePreviewAudioKey((k) => k + 1)
        }
      } finally {
        if (!cancelled) setVoiceBgmMixing(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentStep, voicePreviewRawTtsKey, voiceBgmTrackId, voiceBgmVolumeDebounced])

  const minUrls = MIX_FACTORY_URL_MIN

  /** 3·4·5단계: AI자막제거 단계 샘플 MP4만 나레이션 타임라인에 맞춰 시킹 */
  const syncFactoryPreviewVideoToPlayhead = useCallback(
    (video: HTMLVideoElement | null, playheadSec: number) => {
      if (!video) return
      const vDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
      if (vDur <= 0) return
      const r = factoryNarTotal > 0 ? playheadSec / factoryNarTotal : 0
      const target = Math.min(vDur - 0.05, Math.max(0, r * vDur))
      if (Math.abs(video.currentTime - target) > 0.15) video.currentTime = target
    },
    [factoryNarTotal]
  )

  const syncScriptNarrationVideoToPlayhead = useCallback(
    (playheadSec: number) => {
      syncFactoryPreviewVideoToPlayhead(scriptNarrationVideoRef.current, playheadSec)
    },
    [syncFactoryPreviewVideoToPlayhead]
  )

  const copyPlain = useCallback(async (doneMsg: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setToast(doneMsg)
    } catch {
      setToast("복사에 실패했습니다. 브라우저 권한을 확인해 주세요.")
    }
  }, [])

  const applySeoAiGenerate = useCallback(async () => {
    const apiKey = shotformOpenAiKey()
    if (!apiKey) {
      setToast("ShotForm 설정에서 OpenAI API 키(shotform_openai_api_key)를 먼저 저장하세요.")
      return
    }

    const script = buildFactorySeoScript(voiceSceneScriptOverrides)
    if (!script.trim()) {
      setToast("나레이션 대본이 없습니다. 「대본 생성」 단계 스크립트를 확인해 주세요.")
      return
    }

    const mixItems = readMixSourcesFromSession()
    const pipeline = readMixPipelineResult()
    const referenceTitles = collectFactoryReferenceTitles(
      mixItems.map((m) => m.title),
      pipeline?.titles,
      summary?.titles
    )
    const productName = inferFactoryProductName(referenceTitles)

    setSeoGenerating(true)
    try {
      const res = await fetch("/api/shotform-factory-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          productName,
          referenceTitles,
          script,
          videoDurationSec: defaultFactorySeoDurationSec(voicePreviewAudioDuration),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        title?: string
        recommendedTitles?: string[]
        description?: string
        tags?: string[]
        hashtags?: string[]
      }
      if (!res.ok) {
        setToast(typeof data.error === "string" ? data.error : "제목·설명·태그 생성에 실패했습니다.")
        return
      }

      if (typeof data.title === "string") setSeoVideoTitle(data.title)
      if (Array.isArray(data.recommendedTitles)) setSeoRecommendedTitles(data.recommendedTitles)
      if (typeof data.description === "string") setSeoVideoDesc(data.description)
      if (Array.isArray(data.tags)) setSeoTags(data.tags)
      if (Array.isArray(data.hashtags)) setSeoHashtags(data.hashtags)
      setToast("제품·대본에 맞춰 제목·설명·태그를 AI로 생성했습니다.")
    } catch (e) {
      setToast(e instanceof Error ? e.message : "제목·설명·태그 생성 요청에 실패했습니다.")
    } finally {
      setSeoGenerating(false)
    }
  }, [voiceSceneScriptOverrides, voicePreviewAudioDuration, summary?.titles])

  useEffect(() => {
    if (currentStep !== 6) {
      seoAutoGenerateRef.current = false
      return
    }
    if (seoAutoGenerateRef.current || seoGenerating) return
    seoAutoGenerateRef.current = true
    void applySeoAiGenerate()
  }, [currentStep, applySeoAiGenerate, seoGenerating])

  const buildCapCutExportInput = useCallback((): FactoryCapCutExportInput => {
    const mixItems = readMixSourcesFromSession()
    const pipeline = readMixPipelineResult()
    const referenceTitles = collectFactoryReferenceTitles(
      mixItems.map((m) => m.title),
      pipeline?.titles,
      summary?.titles
    )
    const mixed = voicePreviewBgmMixedBlobRef.current
    const merged = voicePreviewMergedBlobRef.current
    const ttsCandidateUrls = [mixed, merged, voicePreviewAudioUrl].filter(Boolean) as string[]
    return {
      sceneText: getNarrationSceneTextByIndex,
      voiceLineCues,
      previewVideoBlob: factoryPreviewMp4BlobRef.current,
      ttsCandidateUrls,
      capCutMixedBlobUrl: mixed,
      bgmPublicSrc: voiceBgmTrackId !== "off" ? voicePreviewBgmSrc(voiceBgmTrackId) : null,
      ttsAudioUrl: mixed ?? merged ?? voicePreviewAudioUrl,
      ttsFallbackBlob: voicePreviewTtsExportBlobRef.current,
      ttsExportIncludesBgm: voicePreviewExportIncludesBgmRef.current,
      capCutSyncVideoDurationSec:
        voicePreviewVideoDuration > 0.1 ? voicePreviewVideoDuration : undefined,
      capCutSyncAudioDurationSec: voicePreviewAudioDuration > 0.1 ? voicePreviewAudioDuration : undefined,
      voiceId: selectedVoiceId,
      voiceStyle: factorySupertoneStyle,
      seo:
        seoVideoTitle.trim() || seoVideoDesc.trim()
          ? {
              title: seoVideoTitle,
              description: seoVideoDesc,
              tags: seoTags,
              hashtags: seoHashtags,
              hookShort: "",
            }
          : undefined,
      projectLabel: inferFactoryProductName(referenceTitles),
    }
  }, [
    getNarrationSceneTextByIndex,
    voiceLineCues,
    voicePreviewAudioUrl,
    voiceBgmTrackId,
    voicePreviewVideoDuration,
    voicePreviewAudioDuration,
    selectedVoiceId,
    factorySupertoneStyle,
    seoVideoTitle,
    seoVideoDesc,
    seoTags,
    seoHashtags,
    summary?.titles,
  ])

  const handleCapCutExport = useCallback(
    async (opts?: { zipOnly?: boolean }) => {
      setCapcutExportZipOnly(Boolean(opts?.zipOnly))
      setCapcutExporting(true)
      try {
        const input = buildCapCutExportInput()
        const tryFolder =
          !opts?.zipOnly &&
          capcutDirectoryPickerSupported() &&
          (capcutForceFolderPickRef.current || capcutLastFolder !== null)

        if (tryFolder) {
          try {
            const dir = await (
              window as Window & {
                showDirectoryPicker: (opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>
              }
            ).showDirectoryPicker({ mode: "readwrite" })
            const folderName = await writeCapCutExportToDirectory(dir, input)
            capcutForceFolderPickRef.current = false
            setCapcutLastFolder(dir.name)
            setToast(
              `CapCut 프로젝트 「${folderName}」을 drafts 폴더에 저장했습니다. CapCut을 재시작하면 홈 목록에 표시됩니다.`
            )
            return
        } catch {
          /* 폴더 선택 취소·미지원 → ZIP으로 폴백 */
        }
      }

      const blob = await buildCapCutExportZip(input)
      downloadBlob(blob, `capcut_ai_shopping_short_${Date.now()}.zip`)
      setToast(
        "CapCut 프로젝트 ZIP을 다운로드했습니다. drafts 폴더에 풀고 CapCut을 재시작하세요. (Chrome/Edge는 폴더 직접 저장 권장)"
      )
    } catch (e) {
      setToast(e instanceof Error ? e.message : "CapCut 내보내기에 실패했습니다.")
    } finally {
      setCapcutExporting(false)
      setCapcutExportZipOnly(false)
    }
    },
    [buildCapCutExportInput, capcutLastFolder]
  )

  const handleDownloadPreviewVideo = useCallback(async () => {
    if (!factoryPreviewVideoSrc) {
      setToast("등록된 미리보기 영상이 없습니다.")
      return
    }
    try {
      const res = await fetch(factoryPreviewVideoSrc)
      if (!res.ok) throw new Error("영상을 불러오지 못했습니다.")
      downloadBlob(await res.blob(), `preview_video_${Date.now()}.mp4`)
      setToast("미리보기 영상(음성·자막 반영 합성본)을 다운로드했습니다.")
    } catch (e) {
      setToast(e instanceof Error ? e.message : "영상 다운로드에 실패했습니다.")
    }
  }, [factoryPreviewVideoSrc])

  const removeSeoHashtag = useCallback((tag: string) => {
    setSeoHashtags((prev) => prev.filter((x) => x !== tag))
  }, [])

  useEffect(() => {
    const syncUrlsFromSession = () => {
      const picked = readMixSourcesFromSession()
      if (picked.length > 0) {
        const u = picked.map((p) => p.url).slice(0, MIX_FACTORY_URL_MAX)
        while (u.length < 2) u.push("")
        setUrls(u.slice(0, MIX_FACTORY_URL_MAX))
      }
    }
    syncUrlsFromSession()
    window.addEventListener(SHOTFORM_SESSION_RESTORED_EVENT, syncUrlsFromSession)
    return () => window.removeEventListener(SHOTFORM_SESSION_RESTORED_EVENT, syncUrlsFromSession)
  }, [])

  /** MVP 짜집기 완료 후 넘어온 경우 — 1단계 믹스 건너뛰고 대본(3단계)부터 */
  useEffect(() => {
    const pipeline = readMixPipelineResult()
    if (!pipeline?.urls?.length) return
    setSummary({ urls: pipeline.urls, titles: pipeline.titles })
    setTargetSeconds(pipeline.targetSeconds)
    setCurrentStep(3)
    setToast("MVP 짜집기 완료 — 대본·TTS·자막 단계부터 이어서 진행합니다.")
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (currentStep === 4) {
      scriptNarrationVideoRef.current?.pause()
    }
    if (currentStep === 3) {
      stylePreviewVideoRef.current?.pause()
    }
    if (currentStep !== 3 && currentStep !== 4) {
      setNarrationPlaying(false)
      scriptNarrationVideoRef.current?.pause()
      stylePreviewVideoRef.current?.pause()
    }
  }, [currentStep])

  /** 나레이션 playhead(초) ↔ 샘플 영상 타임라인 비례 동기 */
  useEffect(() => {
    if (currentStep !== 3 || scriptVoiceLoading) return
    syncScriptNarrationVideoToPlayhead(narrationPlayheadSec)
  }, [currentStep, scriptVoiceLoading, narrationPlayheadSec, syncScriptNarrationVideoToPlayhead])

  useEffect(() => {
    if (currentStep !== 4) return
    syncFactoryPreviewVideoToPlayhead(stylePreviewVideoRef.current, narrationPlayheadSec)
  }, [currentStep, narrationPlayheadSec, syncFactoryPreviewVideoToPlayhead])

  useEffect(() => {
    if (!narrationPlaying) {
      scriptNarrationVideoRef.current?.pause()
      stylePreviewVideoRef.current?.pause()
    }
  }, [narrationPlaying])

  useEffect(() => {
    if (!narrationPlaying || (currentStep !== 3 && currentStep !== 4) || (currentStep === 3 && scriptVoiceLoading)) return
    const id = setInterval(() => {
      setNarrationPlayheadSec((t) => Math.min(factoryNarTotal, t + 0.1))
    }, 100)
    return () => clearInterval(id)
  }, [narrationPlaying, currentStep, scriptVoiceLoading, factoryNarTotal])

  useEffect(() => {
    if ((currentStep !== 3 && currentStep !== 4) || (currentStep === 3 && scriptVoiceLoading)) return
    setSceneIndex(narrationSceneIndexFromPlayheadIn(factoryNarSegments, narrationPlayheadSec))
    if (narrationPlaying && narrationPlayheadSec >= factoryNarTotal - 0.05) {
      setNarrationPlaying(false)
      scriptNarrationVideoRef.current?.pause()
      stylePreviewVideoRef.current?.pause()
    }
  }, [currentStep, scriptVoiceLoading, narrationPlayheadSec, narrationPlaying, factoryNarSegments])

  useEffect(() => {
    if (currentStep !== 3 || !scriptVoiceLoading) return
    const t = setTimeout(() => setScriptVoiceLoading(false), 0)
    return () => clearTimeout(t)
  }, [currentStep, scriptVoiceLoading])

  useEffect(() => {
    if (currentStep !== 5 || !voicePreviewLoading) return
    let cancelled = false
    const ac = new AbortController()
    const timeoutId = window.setTimeout(() => ac.abort(), 180_000)

    setVoiceGenProgress(2)
    setVoicePreviewAudioUrl(null)
    setVoiceLineCues(null)
    voicePreviewMergedWavBlobRef.current = null
    voicePreviewTtsExportBlobRef.current = null
    voicePreviewExportIncludesBgmRef.current = false

    const run = async () => {
      try {
        const apiKey = shotformSupertoneKey()
        if (!apiKey) {
          setToast("수퍼톤 API 키가 없습니다. ShotForm 메인 설정에서 저장하세요.")
          setVoiceGenProgress(0)
          return
        }
        if (!selectedVoiceId.startsWith("supertone-")) {
          setVoiceGenProgress(0)
          return
        }
        const voiceId = selectedVoiceId.replace(/^supertone-/, "")
        const lines = collectNarrationSubtitleLines(factoryNarSegments, getNarrationSceneTextByIndex)
        if (lines.length === 0) {
          setToast("나레이션 자막 줄이 없습니다.")
          setVoiceGenProgress(0)
          return
        }

        const audioUrls: string[] = []
        const measured: Array<{
          text: string
          sceneIndex: number
          durationSec: number
          displayLines?: string[]
        }> = []

        for (let i = 0; i < lines.length; i++) {
          if (cancelled) return
          const { text, sceneIndex } = lines[i]!
          setVoiceGenProgress(Math.min(92, Math.round(4 + ((i + 0.2) / lines.length) * 88)))

          const url = await synthesizeTtsLine({
            fullVoiceId: selectedVoiceId,
            text,
            style: factorySupertoneStyle,
            speed: speechSpeed,
          })
          if (cancelled) return
          audioUrls.push(url)
          setVoiceGenProgress(Math.min(95, Math.round(4 + ((i + 1) / lines.length) * 88)))
        }

        const { blobUrl, totalDurationSec, wavBlob, lineDurationsSec } = await mergeAudioUrlsToWavBlobUrl(
          audioUrls,
          { trimSilence: true }
        )
        if (cancelled) {
          URL.revokeObjectURL(blobUrl)
          return
        }

        lines.forEach(({ text, sceneIndex, displayLines }, i) => {
          measured.push({
            text,
            sceneIndex,
            durationSec: lineDurationsSec[i] ?? 0.5,
            displayLines,
          })
        })
        const cues = buildVoiceLineCues(measured)
        if (cancelled) {
          URL.revokeObjectURL(blobUrl)
          return
        }

        if (voicePreviewMergedBlobRef.current) {
          URL.revokeObjectURL(voicePreviewMergedBlobRef.current)
        }
        voicePreviewMergedBlobRef.current = blobUrl
        voicePreviewMergedWavBlobRef.current = wavBlob
        voicePreviewTtsExportBlobRef.current = wavBlob
        voicePreviewExportIncludesBgmRef.current = false

        setVoiceLineCues(cues)
        setVoicePreviewAudioDuration(totalDurationSec)
        setVoicePreviewTtsReady(true)
        setVoicePreviewRawTtsKey((k) => k + 1)
        setVoiceGenProgress(100)
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.name === "AbortError") {
          setToast("TTS 요청이 시간 초과되었거나 취소되었습니다.")
        } else {
          setToast(e instanceof Error ? e.message : "TTS 요청에 실패했습니다.")
        }
        setVoiceGenProgress(0)
      } finally {
        clearTimeout(timeoutId)
        setVoicePreviewLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
      ac.abort()
      clearTimeout(timeoutId)
    }
  }, [
    currentStep,
    voicePreviewLoading,
    voiceTtsRunNonce,
    selectedVoiceId,
    factorySupertoneStyle,
    speechSpeed,
    getNarrationSceneTextByIndex,
  ])

  useEffect(() => {
    /* 5~7단계: 음성·CapCut 보내기에 필요한 blob/ref 유지 (6·7에서 CapCut 시 TTS 소실 방지) */
    if (currentStep === 5 || currentStep === 6 || currentStep === 7) return
    setVoicePreviewLoading(false)
    setVoiceGenProgress(0)
    setVoicePreviewAudioUrl(null)
    setVoiceLineCues(null)
    setVoicePreviewTtsReady(false)
    setVoicePreviewRawTtsKey(0)
    setVoiceBgmMixing(false)
    if (voicePreviewMergedBlobRef.current) {
      URL.revokeObjectURL(voicePreviewMergedBlobRef.current)
      voicePreviewMergedBlobRef.current = null
    }
    if (voicePreviewBgmMixedBlobRef.current) {
      URL.revokeObjectURL(voicePreviewBgmMixedBlobRef.current)
      voicePreviewBgmMixedBlobRef.current = null
    }
    voicePreviewMergedWavBlobRef.current = null
    voicePreviewTtsExportBlobRef.current = null
    voicePreviewExportIncludesBgmRef.current = false
    setVoicePreviewAudioPlaying(false)
    voicePreviewAudioRef.current?.pause()
    voiceSyncVideoRef.current?.pause()
    if (voiceSyncVideoRef.current) {
      voiceSyncVideoRef.current.currentTime = 0
      voiceSyncVideoRef.current.playbackRate = 1
    }
    setVoiceSyncVideoTime(0)
    setVoiceSyncAudioPlayhead(0)
  }, [currentStep])

  useEffect(() => {
    if (currentStep !== 5 || !voicePreviewAudioUrl) return
    const vid = voiceSyncVideoRef.current
    vid?.pause()
    setVoicePreviewAudioPlaying(false)
    if (vid) {
      vid.currentTime = 0
      setVoiceSyncVideoTime(0)
    }
    const a = voicePreviewAudioRef.current
    if (a) a.currentTime = 0
    setVoiceSyncAudioPlayhead(0)
  }, [currentStep, voicePreviewAudioKey, voicePreviewAudioUrl])

  useEffect(() => {
    const prev = factoryPrevStepRef.current
    if (currentStep === 5) {
      factoryPrevStepRef.current = 5
      if (prev !== 5 && prev !== null) {
        setVoicePreviewAudioUrl(null)
        setVoiceLineCues(null)
        setVoicePreviewTtsReady(false)
        setVoicePreviewRawTtsKey(0)
        setVoiceBgmMixing(false)
        if (voicePreviewMergedBlobRef.current) {
          URL.revokeObjectURL(voicePreviewMergedBlobRef.current)
          voicePreviewMergedBlobRef.current = null
        }
        if (voicePreviewBgmMixedBlobRef.current) {
          URL.revokeObjectURL(voicePreviewBgmMixedBlobRef.current)
          voicePreviewBgmMixedBlobRef.current = null
        }
        voicePreviewMergedWavBlobRef.current = null
        voicePreviewTtsExportBlobRef.current = null
        voicePreviewExportIncludesBgmRef.current = false
        setVoicePreviewAudioPlaying(false)
        setVoiceGenProgress(0)
        setVoicePreviewAudioDuration(0)
        voicePreviewAudioRef.current?.pause()
        voiceSyncVideoRef.current?.pause()
        if (voiceSyncVideoRef.current) voiceSyncVideoRef.current.currentTime = 0
        setVoiceSyncVideoTime(0)
        setVoiceSyncAudioPlayhead(0)
        setVoicePreviewAudioKey((k) => k + 1)
        setVoiceTtsRunNonce((n) => n + 1)
        setVoicePreviewLoading(true)
      }
    } else {
      factoryPrevStepRef.current = currentStep
    }
  }, [currentStep])

  useEffect(() => {
    setVoicePreviewAudioDuration(0)
  }, [voicePreviewAudioKey, voicePreviewAudioUrl])

  const filledUrls = useMemo(() => urls.map((u) => u.trim()).filter(Boolean), [urls])
  const canStart = filledUrls.length >= minUrls && filledUrls.length <= MIX_FACTORY_URL_MAX && !busy

  const setUrl = (i: number, v: string) => {
    setUrls((prev) => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  const addRow = () => {
    if (urls.length >= MIX_FACTORY_URL_MAX) return
    setUrls((prev) => [...prev, ""])
  }

  const removeRow = (i: number) => {
    if (urls.length <= minUrls) return
    setUrls((prev) => prev.filter((_, idx) => idx !== i))
  }

  const runPipeline = useCallback(async () => {
    setBusy(true)
    setPipeline({ active: true, label: PHASE_LABELS[0], pct: 0, elapsed: 0 })
    try {
      try {
        const res = await fetch("/api/shotform/mix-validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: filledUrls }),
        })
        await res.json().catch(() => ({}))
      } catch {
        /* 데모: 검증 API 실패 시에도 파이프라인 계속 */
      }

      const titles = filledUrls.map((u) => titleForUrl(u))

      for (let p = 0; p < 3; p++) {
        const label = PHASE_LABELS[p as 0 | 1 | 2]
        setPipeline({ active: true, label, pct: 0, elapsed: p * 120 })
        await runJobPhase(p as 0 | 1 | 2, (elapsed, pct) => {
          setPipeline({ active: true, label, pct, elapsed })
        })
      }

      writeMixPipelineResult({
        urls: filledUrls,
        titles,
        targetSeconds,
        finishedAt: new Date().toISOString(),
      })
      setSummary({ urls: filledUrls, titles })
      setPipeline(null)
      setCurrentStep(2)
      setToast("믹스·분석 단계가 완료되었습니다. (실제 다운로드·합성은 워커 연동 시 수행됩니다.)")
    } catch {
      setToast("처리 중 오류가 발생했습니다.")
      setPipeline(null)
    } finally {
      setBusy(false)
    }
  }, [filledUrls, targetSeconds])

  const onStartMix = () => {
    if (!canStart) {
      setToast(`URL을 ${minUrls}개 이상 ${MIX_FACTORY_URL_MAX}개 이하로 입력해 주세요.`)
      return
    }
    void runPipeline()
  }

  const goToScriptVoice = () => {
    if (aiSubtitleRemoval) {
      const vmakeKey =
        typeof window !== "undefined" ? (localStorage.getItem("shotform_vmake_api_key") || "").trim() : ""
      const vmakeSecret =
        typeof window !== "undefined"
          ? (localStorage.getItem("shotform_vmake_secret_access_key") || "").trim()
          : ""
      if (!vmakeKey || !vmakeSecret) {
        setToast(
          "AI 자막 제거에 Vmake AI API Key와 Secret Access Key를 ShotForm 설정에 저장하세요."
        )
        return
      }
    }
    setCurrentStep(3)
    setScriptVoiceLoading(true)
  }

  useEffect(() => {
    setNarrationPlaying(false)
  }, [selectedVoiceId, factorySupertoneStyle])

  const fetchSupertoneVoicesForFactory = useCallback(async () => {
    const key = shotformSupertoneKey()
    if (!key) {
      setToast("수퍼톤 API 키가 없습니다. ShotForm 메인 설정에서 저장하세요.")
      return
    }
    setFactorySupertoneLoading(true)
    try {
      const res = await fetch(`/api/supertone-voices?apiKey=${encodeURIComponent(key)}`)
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; voices?: unknown[]; error?: string }
      if (!res.ok || data.success === false) {
        setToast(typeof data.error === "string" ? data.error : "수퍼톤 목록을 불러오지 못했습니다.")
        return
      }
      const raw = Array.isArray(data.voices) ? data.voices : []
      const allRows: FactorySupertoneVoiceRow[] = raw.map((x: unknown) => {
        const o = x as Record<string, unknown>
        const vid = String(o.voice_id ?? o.id ?? "")
        return {
          voice_id: vid,
          name: String(o.name ?? vid),
          styles: Array.isArray(o.styles) ? (o.styles as string[]) : ["neutral"],
          language: Array.isArray(o.language) ? (o.language as string[]) : undefined,
        }
      })
      const rows = filterSupertoneKoreanVoices(allRows)
      setFactorySupertoneVoices(rows)
      if (rows.length > 0) {
        setToast(`한국어 수퍼톤 음성 ${rows.length}개를 불러왔습니다.`)
        setSelectedVoiceId((prev) => {
          if (prev.startsWith("supertone-") && rows.some((r) => `supertone-${r.voice_id}` === prev)) return prev
          return `supertone-${rows[0]!.voice_id}`
        })
      } else {
        setToast(
          allRows.length > 0
            ? "한국어를 지원하는 수퍼톤 음성이 없습니다. (다른 언어 전용 목소리는 표시하지 않습니다.)"
            : "수퍼톤에서 사용 가능한 음성이 없습니다."
        )
      }
    } catch {
      setToast("수퍼톤 목록 요청에 실패했습니다.")
    } finally {
      setFactorySupertoneLoading(false)
    }
  }, [])

  const stopFactoryVoicePreview = useCallback(() => {
    const a = factoryVoicePreviewAudioRef.current
    if (a) {
      a.pause()
      a.currentTime = 0
      if (a.src.startsWith("blob:")) URL.revokeObjectURL(a.src)
      a.src = ""
    }
    setFactoryVoicePreviewingId(null)
  }, [])

  useEffect(() => () => stopFactoryVoicePreview(), [stopFactoryVoicePreview])

  const handleFactorySupertonePreview = useCallback(
    async (voiceOptionId: string) => {
      stopFactoryVoicePreview()
      const key = shotformSupertoneKey()
      if (!key) {
        setToast("수퍼톤 API 키가 없습니다. ShotForm 메인 설정에서 저장하세요.")
        return
      }
      const supertoneVoiceId = voiceOptionId.replace(/^supertone-/, "")
      const row = factorySupertoneVoices.find((v) => v.voice_id === supertoneVoiceId)
      const styles = row?.styles?.length ? row.styles : ["neutral"]
      const style = styles.includes(factorySupertoneStyle)
        ? factorySupertoneStyle
        : styles.includes("neutral")
          ? "neutral"
          : styles[0]!

      setFactoryVoicePreviewingId(voiceOptionId)
      try {
        const res = await fetch("/api/supertone-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: SUPERTONE_VOICE_PREVIEW_TEXT,
            voiceId: supertoneVoiceId,
            apiKey: key,
            style,
            language: "ko",
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean
          audioUrl?: string
          audioBase64?: string
          error?: string
        }
        if (!res.ok || data.success === false) {
          setToast(typeof data.error === "string" ? data.error : "미리듣기에 실패했습니다.")
          setFactoryVoicePreviewingId(null)
          return
        }
        let url = typeof data.audioUrl === "string" ? data.audioUrl : ""
        if (!url && typeof data.audioBase64 === "string") {
          url = `data:audio/wav;base64,${data.audioBase64}`
        }
        if (!url) {
          setToast("미리듣기 오디오 응답이 없습니다.")
          setFactoryVoicePreviewingId(null)
          return
        }
        const audio = new Audio(url)
        factoryVoicePreviewAudioRef.current = audio
        audio.onended = () => setFactoryVoicePreviewingId(null)
        audio.onerror = () => {
          setToast("미리듣기 재생에 실패했습니다.")
          setFactoryVoicePreviewingId(null)
        }
        await audio.play()
      } catch {
        setToast("미리듣기 요청에 실패했습니다.")
        setFactoryVoicePreviewingId(null)
      }
    },
    [factorySupertoneVoices, factorySupertoneStyle, stopFactoryVoicePreview]
  )

  useEffect(() => {
    if (!selectedVoiceId.startsWith("supertone-")) return
    const vid = selectedVoiceId.replace(/^supertone-/, "")
    const row = factorySupertoneVoices.find((v) => v.voice_id === vid)
    if (!row?.styles?.length) return
    const st = row.styles
    setFactorySupertoneStyle((cur) => (st.includes(cur) ? cur : st.includes("neutral") ? "neutral" : st[0]!))
  }, [selectedVoiceId, factorySupertoneVoices])

  const firstTitle = summary?.titles[0] || titleForUrl(filledUrls[0] || "") || "다용도 무타공 압축봉"

  const handleNarrationPlayToggle = () => {
    const v = currentStep === 4 ? stylePreviewVideoRef.current : scriptNarrationVideoRef.current
    if (narrationPlaying) {
      setNarrationPlaying(false)
      v?.pause()
      return
    }
    if (narrationPlayheadSec >= factoryNarTotal - 0.05) {
      setNarrationPlayheadSec(0)
      setSceneIndex(1)
      syncFactoryPreviewVideoToPlayhead(stylePreviewVideoRef.current, 0)
      syncScriptNarrationVideoToPlayhead(0)
    }
    setNarrationPlaying(true)
    void v?.play().catch(() => setToast("미리보기 영상 재생을 시작할 수 없습니다."))
  }

  const supertoneVoiceOptions: FactoryVoiceOption[] = useMemo(
    () =>
      factorySupertoneVoices.map((v) => ({
        id: `supertone-${v.voice_id}`,
        name: v.name || v.voice_id,
        desc: "한국어 · Supertone",
        provider: "Supertone" as const,
      })),
    [factorySupertoneVoices]
  )

  const filteredVoices = useMemo(() => {
    const all = supertoneVoiceOptions
    const q = voiceSearch.trim().toLowerCase()
    if (!q) return all
    return all.filter((v) => v.name.toLowerCase().includes(q) || v.desc.toLowerCase().includes(q))
  }, [voiceSearch, supertoneVoiceOptions])

  const activeNarrationSeg = useMemo(() => {
    if (!factoryNarSegments.length) return undefined
    let i: number
    if ((currentStep === 3 && !scriptVoiceLoading) || currentStep === 4) {
      i = narrationSceneIndexFromPlayheadIn(factoryNarSegments, narrationPlayheadSec) - 1
    } else {
      i = sceneIndex - 1
    }
    const clamped = Math.max(0, Math.min(factoryNarSegments.length - 1, i))
    return factoryNarSegments[clamped]
  }, [
    currentStep,
    scriptVoiceLoading,
    narrationPlayheadSec,
    sceneIndex,
    factoryNarSegments,
  ])
  /** 프리뷰에는 구간 첫 줄만 표시(둘째 줄은 별도 하단 자막으로 중복되지 않게) */
  const subtitleTop = useMemo(
    () => (activeNarrationSeg ? splitNarrationOverlay(activeNarrationSeg.text).top : ""),
    [activeNarrationSeg]
  )
  const scriptVoicePreviewSubLine = useMemo(
    () =>
      activeNarrationSeg ? narrationSubLineAtPlayhead(activeNarrationSeg, narrationPlayheadSec) : "",
    [activeNarrationSeg, narrationPlayheadSec]
  )

  const voiceSyncSceneIdx = useMemo(() => {
    if (voiceLineCues && voiceLineCues.length > 0 && voicePreviewAudioUrl) {
      return voiceSceneIndexAtLineCues(voiceLineCues, voiceSyncAudioPlayhead)
    }
    return voicePreviewSceneIndexAtVideoTime(voiceSyncVideoTime)
  }, [voiceLineCues, voicePreviewAudioUrl, voiceSyncAudioPlayhead, voiceSyncVideoTime])
  const voiceSyncVideoDurationUi =
    voicePreviewVideoDuration > 0.1 ? voicePreviewVideoDuration : VOICE_PREVIEW_VIDEO_TOTAL
  const voiceSyncSubtitleLine = useMemo(() => {
    if (voiceLineCues && voiceLineCues.length > 0 && voicePreviewAudioUrl) {
      return voiceSubtitleAtLineCues(voiceLineCues, voiceSyncAudioPlayhead)
    }
    const vDur = voiceSyncVideoDurationUi > 0 ? voiceSyncVideoDurationUi : VOICE_PREVIEW_VIDEO_TOTAL
    const aDur = voicePreviewAudioDuration > 0 ? voicePreviewAudioDuration : VOICE_PREVIEW_AUDIO_TOTAL
    const audioT = voicePreviewAudioTimeFromVideoTime(voiceSyncVideoTime, vDur, aDur)
    const ratio = aDur > 0 ? Math.min(1, Math.max(0, audioT / aDur)) : 0
    const idx = Math.min(
      factoryNarSegments.length - 1,
      Math.floor(ratio * factoryNarSegments.length)
    )
    return getNarrationSceneTextByIndex(idx).split("\n")[0]?.trim() ?? ""
  }, [
    voiceLineCues,
    voicePreviewAudioUrl,
    voiceSyncAudioPlayhead,
    voiceSyncVideoTime,
    voiceSyncVideoDurationUi,
    voicePreviewAudioDuration,
    getNarrationSceneTextByIndex,
  ])

  const getVoiceSyncDurations = useCallback(() => {
    const vid = voiceSyncVideoRef.current
    const aud = voicePreviewAudioRef.current
    const vDur =
      vid && Number.isFinite(vid.duration) && vid.duration > 0.05
        ? vid.duration
        : voiceSyncVideoDurationUi > 0
          ? voiceSyncVideoDurationUi
          : VOICE_PREVIEW_VIDEO_TOTAL
    const aDurFromEl = aud && Number.isFinite(aud.duration) && aud.duration > 0.05 ? aud.duration : 0
    const aDur =
      aDurFromEl > 0 ? aDurFromEl : voicePreviewAudioDuration > 0 ? voicePreviewAudioDuration : VOICE_PREVIEW_AUDIO_TOTAL
    return { vDur, aDur }
  }, [voiceSyncVideoDurationUi, voicePreviewAudioDuration])

  const resetVoicePreviewVideoRate = useCallback(() => {
    const vid = voiceSyncVideoRef.current
    if (vid) vid.playbackRate = 1
  }, [])

  const syncVoicePreviewFromStudioPlayhead = useCallback(
    (audioSec: number) => {
      const aud = voicePreviewAudioRef.current
      const vid = voiceSyncVideoRef.current
      const aDur =
        aud && Number.isFinite(aud.duration) && aud.duration > 0.05
          ? aud.duration
          : voicePreviewAudioDuration > 0
            ? voicePreviewAudioDuration
            : VOICE_PREVIEW_AUDIO_TOTAL
      const vDur =
        vid && Number.isFinite(vid.duration) && vid.duration > 0.05
          ? vid.duration
          : voiceSyncVideoDurationUi > 0
            ? voiceSyncVideoDurationUi
            : VOICE_PREVIEW_VIDEO_TOTAL
      if (aud && voicePreviewAudioUrl && aDur > 0) {
        aud.currentTime = Math.min(aDur - 0.01, Math.max(0, audioSec))
        setVoiceSyncAudioPlayhead(aud.currentTime)
      } else {
        setVoiceSyncAudioPlayhead(Math.max(0, audioSec))
      }
      if (vid && aDur > 0 && vDur > 0) {
        const at = aud && Number.isFinite(aud.currentTime) ? aud.currentTime : audioSec
        vid.currentTime = Math.min(vDur - 0.02, Math.max(0, (at / aDur) * vDur))
        setVoiceSyncVideoTime(vid.currentTime)
        if (voicePreviewAudioUrl && aud) {
          vid.playbackRate = Math.min(4, Math.max(0.25, vDur / aDur))
        } else {
          vid.playbackRate = 1
        }
      }
    },
    [voicePreviewAudioUrl, voicePreviewAudioDuration, voiceSyncVideoDurationUi]
  )

  useEffect(() => {
    if (!voiceEditDetailOpen) return
    setVoicePreviewAudioPlaying(false)
    voicePreviewAudioRef.current?.pause()
    voiceSyncVideoRef.current?.pause()
    resetVoicePreviewVideoRate()
  }, [voiceEditDetailOpen, resetVoicePreviewVideoRate])

  /** TTS 있을 때: 시작·스크럽 시 한 번만 위치 맞춤, 재생 중에는 `playbackRate`로 동기 (매 프레임 seek 금지) */
  const applyVoicePreviewAvSync = useCallback(() => {
    const vid = voiceSyncVideoRef.current
    const aud = voicePreviewAudioRef.current
    if (!vid || !aud || !voicePreviewAudioUrl) return
    const { vDur, aDur } = getVoiceSyncDurations()
    if (vDur <= 0 || aDur <= 0) return
    vid.currentTime = Math.min(vDur - 0.02, Math.max(0, (aud.currentTime / aDur) * vDur))
    vid.playbackRate = Math.min(4, Math.max(0.25, vDur / aDur))
  }, [voicePreviewAudioUrl, getVoiceSyncDurations])

  const handleVoicePreviewAudioTimeUpdate = useCallback(
    (at: number) => {
      setVoiceSyncAudioPlayhead(at)
      const { vDur, aDur } = getVoiceSyncDurations()
      if (aDur > 0 && vDur > 0) {
        setVoiceSyncVideoTime(Math.min(vDur, Math.max(0, (at / aDur) * vDur)))
      }
    },
    [getVoiceSyncDurations]
  )

  const toggleVoiceSyncPlayback = useCallback(() => {
    const vid = voiceSyncVideoRef.current
    const aud = voicePreviewAudioRef.current
    if (!vid) return
    if (!vid.paused) {
      vid.pause()
      aud?.pause()
      resetVoicePreviewVideoRate()
      if (aud && voicePreviewAudioUrl && Number.isFinite(aud.currentTime)) {
        setVoiceSyncAudioPlayhead(aud.currentTime)
      }
      return
    }
    if (aud && voicePreviewAudioUrl) {
      const { vDur, aDur } = getVoiceSyncDurations()
      if (vDur > 0 && aDur > 0) {
        aud.currentTime = Math.min(aDur - 0.01, Math.max(0, (vid.currentTime / vDur) * aDur))
        setVoiceSyncAudioPlayhead(aud.currentTime)
        applyVoicePreviewAvSync()
      }
      void aud.play().catch((err) => {
        setToast(
          err instanceof Error
            ? `음성 재생을 시작하지 못했습니다: ${err.message}`
            : "음성 재생을 시작하지 못했습니다. 브라우저 자동 재생 정책 또는 탭 음소거를 확인해 주세요."
        )
      })
    }
    void vid.play().catch(() => setToast("영상 재생을 시작할 수 없습니다."))
  }, [
    voicePreviewAudioUrl,
    getVoiceSyncDurations,
    applyVoicePreviewAvSync,
    resetVoicePreviewVideoRate,
  ])

  const stepSubtitle =
    currentStep <= 3
      ? ""
      : currentStep === 4
          ? "왼쪽 미리보기와 오른쪽 자막 패널을 5:5로 배치합니다. 자막은 기본으로 화면 정중앙에 둡니다."
          : currentStep === 5
            ? "샘플 영상과 장면별 자막, 수퍼톤 TTS를 한 화면에서 동기 재생해 확인합니다."
            : currentStep === 6
              ? "제목·설명·태그·해시태그를 정리합니다."
              : currentStep === 7
                ? ""
                : "다음 단계를 이어갑니다."

  const subFontWeight = subWeight === "extrabold" ? 800 : subWeight === "bold" ? 700 : 400
  const subFontCss =
    subFont === "pretendard-bold" || subFont === "pretendard"
      ? '"Pretendard","Noto Sans KR",system-ui,sans-serif'
      : '"Noto Sans KR",sans-serif'

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0c101c]/80 text-slate-100 shadow-xl"
      )}
    >
      {toast ? (
        <div className="absolute right-4 top-4 z-20 max-w-sm rounded-lg border border-violet-800 bg-violet-950/95 px-3 py-2 text-xs text-violet-100 shadow-lg">
          {toast}
        </div>
      ) : null}

      <div className="flex min-h-[min(70vh,720px)] flex-col lg:min-h-0 lg:flex-row">
        <aside className="shrink-0 border-b border-slate-800 bg-slate-950/40 px-4 py-4 sm:px-5 lg:w-[13.5rem] lg:border-b-0 lg:border-r lg:px-3 lg:py-6">
          <p className="mb-3 hidden text-[10px] font-semibold uppercase tracking-wider text-slate-500 lg:block">
            단계
          </p>
          <nav className="flex flex-col gap-2" aria-label="AI 쇼핑 숏폼 진행 단계">
            {STEPS.map((label, idx) => (
              <StepperPill
                key={label}
                label={label}
                stepNum={idx + 1}
                currentStep={currentStep}
                className="w-full rounded-xl px-2.5 py-2 sm:px-3"
                onSelect={setCurrentStep}
              />
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="border-b border-slate-800 px-5 pb-5 pt-6 sm:px-8">
            <h1 className="bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 bg-clip-text text-2xl font-bold text-transparent">
              AI 쇼핑 숏폼
            </h1>
            {stepSubtitle ? <p className="mt-1 text-sm text-slate-400">{stepSubtitle}</p> : null}
          </div>

          <div className="space-y-6 px-5 py-6 sm:px-8">
        {currentStep === 1 && (
          <>
            <h2 className="text-lg font-semibold text-white">영상 소스 추가</h2>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm text-slate-300">영상 길이</Label>
                <span className="text-sm font-semibold text-sky-200">{targetSeconds}초</span>
              </div>
              <Slider
                className="mt-4"
                min={15}
                max={60}
                step={5}
                value={[targetSeconds]}
                onValueChange={(v) => setTargetSeconds(v[0] ?? 30)}
                disabled={busy}
              />
            </div>

            <div className="space-y-2">
              {urls.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={u}
                    onChange={(e) => setUrl(i, e.target.value)}
                    placeholder="https://..."
                    className="h-11 border-slate-700 bg-slate-900/80 text-white placeholder:text-slate-600"
                    disabled={busy}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-slate-400 hover:text-white"
                    disabled={urls.length <= minUrls || busy}
                    onClick={() => removeRow(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-sky-500/45 bg-slate-900/90 text-sky-100 hover:border-sky-400/70 hover:bg-slate-900 hover:text-white"
                disabled={urls.length >= MIX_FACTORY_URL_MAX || busy}
                onClick={addRow}
              >
                <Plus className="mr-1 h-4 w-4" />영상 소스 추가
              </Button>
            </div>

            {pipeline?.active ? (
              <MixPipelineProgressCard
                title={pipeline.label}
                percent={pipeline.pct}
                elapsedSec={pipeline.elapsed}
                totalEstimateSec={JOB_TOTAL_SEC}
              />
            ) : null}

            <Button
              type="button"
              disabled={!canStart}
              onClick={onStartMix}
              className="h-12 w-full bg-gradient-to-r from-sky-600 to-indigo-600 text-base font-semibold text-white shadow-lg shadow-sky-950/40 hover:brightness-110 disabled:opacity-40"
            >
              영상 결합
            </Button>
          </>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">AI자막제거</h2>
            <div className="grid gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
              <div className="space-y-2">
                <div className="overflow-hidden rounded-xl border border-slate-700 bg-black">
                  {summary?.urls[0] ? (
                    factoryPreviewVideoSrc ? (
                      <div className="aspect-[9/16] w-full bg-black">
                        <video
                          className="h-full w-full object-cover"
                          controls
                          playsInline
                          muted
                          autoPlay
                          preload="metadata"
                          src={factoryPreviewVideoSrc}
                          title="데모 미리보기 샘플"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-[9/16] w-full items-center justify-center bg-slate-950 p-4 text-center text-sm text-slate-500">
                        이 제품 URL에는 등록된 합성 미리보기가 없습니다. 레퍼런스 URL 목록만 반영됩니다.
                      </div>
                    )
                  ) : null}
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-lg font-semibold text-white">{firstTitle}</p>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <Label htmlFor="ai-subtitle-removal" className="cursor-pointer text-sm font-medium text-slate-100">
                    Vmake AI 중국어 자막 제거
                  </Label>
                  <Switch
                    id="ai-subtitle-removal"
                    checked={aiSubtitleRemoval}
                    onCheckedChange={setAiSubtitleRemoval}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    className={FACTORY_FLOW_NEXT_BTN_CLASS}
                    onClick={goToScriptVoice}
                  >
                    다음
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && scriptVoiceLoading && (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-14 w-14 animate-spin text-violet-500" aria-hidden />
            <p className="text-base font-medium text-slate-200">대본 생성중...</p>
          </div>
        )}

        {currentStep === 3 && !scriptVoiceLoading && factoryNarSegments.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-6 py-14 text-center">
            <p className="text-base font-medium text-slate-200">등록된 스크립트가 없습니다</p>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
              제품 URL 검색에 등록된 번들이 없습니다. URL별 관련 영상·스크립트·미리보기 데이터를 등록한 뒤 이용할 수
              있습니다.
            </p>
          </div>
        )}

        {currentStep === 3 && !scriptVoiceLoading && factoryNarSegments.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">대본 생성</h2>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr] lg:items-start">
              <div className="mx-auto flex w-full max-w-[360px] flex-col gap-3">
                <div className="overflow-hidden rounded-xl border border-slate-700 bg-black shadow-xl">
                  <div className="relative aspect-[9/16]">
                    {factoryPreviewVideoSrc ? (
                      <video
                        ref={scriptNarrationVideoRef}
                        className="h-full w-full object-cover"
                        src={factoryPreviewVideoSrc}
                        muted
                        playsInline
                        preload="auto"
                        onLoadedMetadata={() => syncScriptNarrationVideoToPlayhead(narrationPlayheadSec)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-950 p-4 text-center text-xs text-slate-500">
                        미리보기 영상 없음
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-3">
                      <div className="max-w-[92%] text-center">
                        {scriptVoicePreviewSubLine ? (
                          <span className="inline-block max-w-full whitespace-pre-wrap rounded-lg bg-black/80 px-4 py-2.5 text-base font-semibold leading-snug text-white shadow-lg sm:text-[17px]">
                            {scriptVoicePreviewSubLine}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-3 shadow-inner">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0 text-slate-200 hover:bg-slate-800 hover:text-white"
                      title={narrationPlaying ? "일시정지" : "재생"}
                      onClick={handleNarrationPlayToggle}
                    >
                      {narrationPlaying ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="ml-0.5 h-4 w-4" aria-hidden />}
                    </Button>
                    <Slider
                      className="min-w-0 flex-1 py-1"
                      min={0}
                      max={Math.max(0.01, factoryNarTotal)}
                      step={0.05}
                      value={[Math.min(narrationPlayheadSec, factoryNarTotal)]}
                      onValueChange={(v) => {
                        const t = Math.min(factoryNarTotal, Math.max(0, v[0] ?? 0))
                        setNarrationPlaying(false)
                        setNarrationPlayheadSec(t)
                        setSceneIndex(narrationSceneIndexFromPlayheadIn(factoryNarSegments, t))
                        syncScriptNarrationVideoToPlayhead(t)
                      }}
                      disabled={!factoryNarSegments.length}
                    />
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500 sm:text-xs">
                      {formatNarrationClock(narrationPlayheadSec)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2 border-t border-slate-800/80 pt-3">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-400 hover:text-white"
                      onClick={() => {
                        setNarrationPlaying(false)
                        const hi = narrationSceneIndexFromPlayheadIn(factoryNarSegments, narrationPlayheadSec)
                        if (hi <= 1) return
                        const prevStart = factoryNarSegments[hi - 2]!.start
                        setNarrationPlayheadSec(prevStart)
                        setSceneIndex(hi - 1)
                        syncScriptNarrationVideoToPlayhead(prevStart)
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[4rem] text-center text-xs tabular-nums text-slate-400">
                      장면 {narrationSceneIndexFromPlayheadIn(factoryNarSegments, narrationPlayheadSec)}/
                      {narrationSceneCount}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-400 hover:text-white"
                      onClick={() => {
                        setNarrationPlaying(false)
                        const hi = narrationSceneIndexFromPlayheadIn(factoryNarSegments, narrationPlayheadSec)
                        if (hi >= narrationSceneCount) return
                        const nextStart = factoryNarSegments[hi]!.start
                        setNarrationPlayheadSec(nextStart)
                        setSceneIndex(hi + 1)
                        syncScriptNarrationVideoToPlayhead(nextStart)
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="min-w-0 space-y-5">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">스크립트</h3>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-slate-400">
                      {formatNarrationClock(narrationPlayheadSec)} / {formatNarrationClock(factoryNarTotal)}
                    </span>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {factoryNarSegments.map((_, i) => {
                      const n = i + 1
                      const hi = narrationSceneIndexFromPlayheadIn(factoryNarSegments, narrationPlayheadSec)
                      const on = hi === n
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            setNarrationPlaying(false)
                            setSceneIndex(n)
                            const start = factoryNarSegments[n - 1]!.start
                            setNarrationPlayheadSec(start)
                            syncScriptNarrationVideoToPlayhead(start)
                          }}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-colors",
                            on
                              ? "bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.45)]"
                              : "border border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                          )}
                        >
                          {n}
                        </button>
                      )
                    })}
                  </div>
                  <div className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto pr-1">
                    {factoryNarSegments.map((seg, i) => {
                      const n = i + 1
                      const hi = narrationSceneIndexFromPlayheadIn(factoryNarSegments, narrationPlayheadSec)
                      const on = hi === n
                      return (
                        <button
                          key={`nar-${n}`}
                          type="button"
                          onClick={() => {
                            setNarrationPlaying(false)
                            setSceneIndex(n)
                            setNarrationPlayheadSec(seg.start)
                            syncScriptNarrationVideoToPlayhead(seg.start)
                          }}
                          className={cn(
                            "w-full rounded-lg border p-3 text-center text-xs transition-colors",
                            on
                              ? "border-emerald-600/50 bg-emerald-950/25 ring-1 ring-emerald-500/30"
                              : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                          )}
                        >
                          <div className="text-center leading-relaxed">
                            <span className="font-mono text-violet-300">
                              {formatNarrationClock(seg.start)}–{formatNarrationClock(seg.end)}
                            </span>
                            <span className="text-slate-500"> ({narrationSegmentDuration(seg)}초)</span>{" "}
                            <span className="text-slate-600">[나레이션]</span>
                          </div>
                          <p className="mt-1.5 whitespace-pre-wrap text-center text-[13px] leading-snug text-slate-200">
                            {seg.text}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>

              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-slate-600 text-slate-200"
                onClick={() => setCurrentStep(2)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                이전
              </Button>
              <Button
                type="button"
                className={FACTORY_FLOW_NEXT_BTN_CLASS}
                onClick={() => setCurrentStep(4)}
              >
                다음
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">자막 설정</h2>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
                <div className="min-w-0 space-y-4 lg:flex lg:flex-col lg:items-center">
                  <p className="w-full text-sm font-medium text-slate-300 lg:max-w-[min(100%,360px)]">미리보기</p>
                  <div className="mx-auto flex w-full max-w-[min(100%,360px)] flex-col gap-3">
                    <div className="overflow-hidden rounded-xl border border-slate-700 bg-black shadow-xl">
                      <div className="relative aspect-[9/16] overflow-hidden">
                        {factoryPreviewVideoSrc ? (
                          <video
                            ref={stylePreviewVideoRef}
                            className="h-full w-full object-cover"
                            src={factoryPreviewVideoSrc}
                            muted
                            playsInline
                            preload="auto"
                            onLoadedMetadata={() => {
                              syncFactoryPreviewVideoToPlayhead(
                                stylePreviewVideoRef.current,
                                narrationPlayheadSec
                              )
                            }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-slate-900 text-sm text-slate-500">
                            AI자막제거 단계 미리보기 없음
                          </div>
                        )}
                        {subtitleTop ? (
                          <div
                            className="pointer-events-none absolute z-[3] max-w-[min(96%,20rem)] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap px-2 text-center transition-all duration-300"
                            style={{
                              left: `${50 + (subX - 540) / 35}%`,
                              top: `${50 + (150 - subY) / 25}%`,
                              transform: "translate(-50%, -50%)",
                              fontFamily: subFontCss,
                              fontSize: subSizePx,
                              fontWeight: subFontWeight,
                              color: subColor,
                              WebkitTextStroke: subOutlineOn ? `${subOutlineW}px ${subOutlineColor}` : undefined,
                              paintOrder: subOutlineOn ? "stroke fill" : undefined,
                              backgroundColor: subBgOn
                                ? (() => {
                                    const { r, g, b } = hexToRgb(subBgColor)
                                    return `rgba(${r},${g},${b},${subBgOpacity / 100})`
                                  })()
                                : undefined,
                              borderRadius: subBgOn ? 6 : undefined,
                              padding: subBgOn ? "6px 10px" : undefined,
                            }}
                          >
                            {subtitleTop}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-3 shadow-inner">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 shrink-0 text-slate-200 hover:bg-slate-800 hover:text-white"
                          title={narrationPlaying ? "일시정지" : "재생"}
                          onClick={handleNarrationPlayToggle}
                        >
                          {narrationPlaying ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="ml-0.5 h-4 w-4" aria-hidden />}
                        </Button>
                        <Slider
                          className="min-w-0 flex-1 py-1"
                          min={0}
                          max={Math.max(0.01, factoryNarTotal)}
                          step={0.05}
                          value={[Math.min(narrationPlayheadSec, factoryNarTotal)]}
                          onValueChange={(v) => {
                            const t = Math.min(factoryNarTotal, Math.max(0, v[0] ?? 0))
                            setNarrationPlaying(false)
                            setNarrationPlayheadSec(t)
                            setSceneIndex(narrationSceneIndexFromPlayheadIn(factoryNarSegments, t))
                            syncFactoryPreviewVideoToPlayhead(stylePreviewVideoRef.current, t)
                          }}
                          disabled={!factoryNarSegments.length}
                        />
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500 sm:text-xs">
                          {formatNarrationClock(narrationPlayheadSec)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-2 border-t border-slate-800/80 pt-3">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          onClick={() => {
                            setNarrationPlaying(false)
                            const hi = narrationSceneIndexFromPlayheadIn(factoryNarSegments, narrationPlayheadSec)
                            if (hi <= 1) return
                            const prevStart = factoryNarSegments[hi - 2]!.start
                            setNarrationPlayheadSec(prevStart)
                            setSceneIndex(hi - 1)
                            syncFactoryPreviewVideoToPlayhead(stylePreviewVideoRef.current, prevStart)
                          }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="min-w-[4rem] text-center text-xs tabular-nums text-slate-400">
                          장면 {narrationSceneIndexFromPlayheadIn(factoryNarSegments, narrationPlayheadSec)}/
                          {narrationSceneCount}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          onClick={() => {
                            setNarrationPlaying(false)
                            const hi = narrationSceneIndexFromPlayheadIn(factoryNarSegments, narrationPlayheadSec)
                            if (hi >= narrationSceneCount) return
                            const nextStart = factoryNarSegments[hi]!.start
                            setNarrationPlayheadSec(nextStart)
                            setSceneIndex(hi + 1)
                            syncFactoryPreviewVideoToPlayhead(stylePreviewVideoRef.current, nextStart)
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

              <div className="min-w-0 space-y-6">
                <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-950/70 to-slate-900/35 p-5 shadow-inner">
                  <div className="mb-5 border-b border-slate-800/80 pb-4">
                    <h3 className="text-sm font-semibold text-white">자막 스타일</h3>
                    <p className="mt-1 text-[11px] text-slate-500">왼쪽 미리보기에 즉시 반영됩니다.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">텍스트</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs text-slate-400">폰트</Label>
                          <Select value={subFont} onValueChange={setSubFont}>
                            <SelectTrigger className="mt-1.5 border-slate-700 bg-slate-900 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FONT_OPTIONS.map((f) => (
                                <SelectItem key={`s-${f.value}`} value={f.value}>
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">굵기</Label>
                          <div className="mt-1.5 grid grid-cols-3 gap-2">
                            {(["normal", "bold", "extrabold"] as const).map((w) => (
                              <button
                                key={`sw-${w}`}
                                type="button"
                                onClick={() => setSubWeight(w)}
                                className={cn(
                                  "rounded-lg border py-2 text-xs font-medium transition-colors",
                                  subWeight === w
                                    ? "border-cyan-500/60 bg-cyan-950/50 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.12)]"
                                    : "border-slate-700 bg-slate-900/80 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                                )}
                              >
                                {w === "normal" ? "보통" : w === "bold" ? "볼드" : "엑스트라 볼드"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400">색상</Label>
                        <div className="mt-1.5 flex gap-2">
                          <input
                            type="color"
                            value={subColor}
                            onChange={(e) => setSubColor(e.target.value)}
                            className="h-9 w-12 shrink-0 cursor-pointer rounded border border-slate-700"
                          />
                          <Input
                            value={subColor}
                            onChange={(e) => setSubColor(e.target.value)}
                            className="h-9 min-w-0 flex-1 border-slate-700 bg-slate-900 font-mono text-xs text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>크기</span>
                          <span className="tabular-nums text-cyan-200/90">{subSizePx}px</span>
                        </div>
                        <Slider
                          className="mt-2"
                          min={10}
                          max={32}
                          step={1}
                          value={[subSizePx]}
                          onValueChange={(v) => setSubSizePx(v[0] ?? 21)}
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-800/80 pt-5 space-y-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">외곽선·배경</p>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-200">외곽선</span>
                          <Switch checked={subOutlineOn} onCheckedChange={setSubOutlineOn} />
                        </div>
                        {subOutlineOn ? (
                          <div className="mt-3 space-y-3 border-t border-slate-800/60 pt-3">
                            <div className="flex flex-wrap gap-2">
                              <input
                                type="color"
                                value={subOutlineColor}
                                onChange={(e) => setSubOutlineColor(e.target.value)}
                                className="h-9 w-12 shrink-0 cursor-pointer rounded border border-slate-700"
                              />
                              <Input
                                value={subOutlineColor}
                                onChange={(e) => setSubOutlineColor(e.target.value)}
                                className="h-9 min-w-[8rem] flex-1 border-slate-700 bg-slate-900 font-mono text-xs text-white"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between text-xs text-slate-400">
                                <span>두께</span>
                                <span className="tabular-nums text-slate-300">{subOutlineW}px</span>
                              </div>
                              <Slider
                                className="mt-2"
                                min={0}
                                max={6}
                                step={1}
                                value={[subOutlineW]}
                                onValueChange={(v) => setSubOutlineW(v[0] ?? 1)}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-200">배경</span>
                          <Switch checked={subBgOn} onCheckedChange={setSubBgOn} />
                        </div>
                        {subBgOn ? (
                          <div className="mt-3 space-y-3 border-t border-slate-800/60 pt-3">
                            <div className="flex flex-wrap gap-2">
                              <input
                                type="color"
                                value={subBgColor}
                                onChange={(e) => setSubBgColor(e.target.value)}
                                className="h-9 w-12 shrink-0 cursor-pointer rounded border border-slate-700"
                              />
                              <Input
                                value={subBgColor}
                                onChange={(e) => setSubBgColor(e.target.value)}
                                className="h-9 min-w-[8rem] flex-1 border-slate-700 bg-slate-900 font-mono text-xs text-white"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between text-xs text-slate-400">
                                <span>불투명도</span>
                                <span className="tabular-nums text-slate-300">{subBgOpacity}%</span>
                              </div>
                              <Slider
                                className="mt-2"
                                min={0}
                                max={100}
                                step={5}
                                value={[subBgOpacity]}
                                onValueChange={(v) => setSubBgOpacity(v[0] ?? 60)}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="border-t border-slate-800/80 pt-5">
                      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">위치</p>
                        <span className="text-[10px] text-slate-600">값은 9:16 기준 좌표입니다.</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-800/80 bg-slate-900/35 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs text-slate-300">세로 (Y)</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[10px] text-slate-400 hover:text-cyan-200"
                              onClick={() => setSubY(150)}
                            >
                              중앙
                            </Button>
                          </div>
                          <p className="mb-2 mt-0.5 text-[10px] text-slate-600">150 = 화면 세로 중앙</p>
                          <Slider min={80} max={220} step={2} value={[subY]} onValueChange={(v) => setSubY(v[0] ?? 150)} />
                        </div>
                        <div className="rounded-lg border border-slate-800/80 bg-slate-900/35 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs text-slate-300">가로 (X)</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[10px] text-slate-400 hover:text-cyan-200"
                              onClick={() => setSubX(540)}
                            >
                              중앙
                            </Button>
                          </div>
                          <p className="mb-2 mt-0.5 text-[10px] text-slate-600">540 = 화면 가로 중앙</p>
                          <Slider min={420} max={660} step={5} value={[subX]} onValueChange={(v) => setSubX(v[0] ?? 540)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
              <Button type="button" variant="outline" className="border-slate-600 text-slate-200" onClick={() => setCurrentStep(3)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                이전
              </Button>
              <Button
                type="button"
                className={FACTORY_FLOW_NEXT_BTN_CLASS}
                onClick={() => {
                  setCurrentStep(5)
                  setVoicePreviewLoading(true)
                }}
              >
                다음
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">음성 생성</h2>

            <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <div>
                  <Label className="text-sm text-slate-300">음성 선택</Label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-cyan-600/60 bg-cyan-950/45 text-cyan-100 shadow-sm shadow-cyan-950/20 hover:border-cyan-500/75 hover:bg-cyan-900/55 hover:text-cyan-50"
                      disabled={factorySupertoneLoading}
                      onClick={() => void fetchSupertoneVoicesForFactory()}
                    >
                      {factorySupertoneLoading ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : null}
                      수퍼톤 목소리 불러오기
                    </Button>
                  </div>
                  <Input
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                    placeholder="음성 이름 검색..."
                    className="mt-2 h-10 border-slate-700 bg-slate-900/80 text-white placeholder:text-slate-600"
                  />
                </div>

                <div className="max-h-[280px] space-y-1 overflow-y-auto rounded-xl border border-slate-800 p-1">
                  {filteredVoices.length === 0 ? (
                    <p className="px-3 py-8 text-center text-xs text-slate-500">
                      「수퍼톤 목소리 불러오기」를 눌러 목록을 가져온 뒤 음성을 선택하세요.
                    </p>
                  ) : (
                    filteredVoices.map((v) => {
                      const sel = selectedVoiceId === v.id
                      const previewing = factoryVoicePreviewingId === v.id
                      return (
                        <div
                          key={v.id}
                          className={cn(
                            "rounded-lg border border-transparent p-1 transition-colors",
                            sel ? cn(studio.btnSegmentActive, "border-transparent") : "hover:bg-slate-800/50"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              stopFactoryVoicePreview()
                              setSelectedVoiceId(v.id)
                              const row = factorySupertoneVoices.find((x) => `supertone-${x.voice_id}` === v.id)
                              const styles = row?.styles?.length ? row.styles : ["neutral"]
                              setFactorySupertoneStyle(styles.includes("neutral") ? "neutral" : (styles[0] ?? "neutral"))
                            }}
                            className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left"
                          >
                            <Star
                              className={cn("mt-0.5 h-4 w-4 shrink-0", sel ? "text-amber-400" : "text-slate-600")}
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-white">{v.name}</span>
                                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                  {v.provider}
                                </span>
                                {sel ? <Check className="h-4 w-4 shrink-0 text-violet-400" aria-label="선택됨" /> : null}
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">{v.desc}</p>
                            </div>
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mx-2 mb-2 h-8 w-[calc(100%-1rem)] border-slate-600 bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 hover:text-white [&_svg]:shrink-0 [&_svg]:text-cyan-200"
                            disabled={previewing}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleFactorySupertonePreview(v.id)
                            }}
                          >
                            {previewing ? (
                              <>
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                                재생 중…
                              </>
                            ) : (
                              <>
                                <Volume2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                미리듣기
                              </>
                            )}
                          </Button>
                        </div>
                      )
                    })
                  )}
                </div>

                {selectedVoiceId.startsWith("supertone-") ? (
                  <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                    <Label className="text-sm text-slate-300">수퍼톤 스타일</Label>
                    <Select value={factorySupertoneStyle} onValueChange={setFactorySupertoneStyle}>
                      <SelectTrigger className="border-slate-700 bg-slate-900 text-white">
                        <SelectValue placeholder="스타일" />
                      </SelectTrigger>
                      <SelectContent>
                        {(factorySupertoneVoices.find((v) => `supertone-${v.voice_id}` === selectedVoiceId)?.styles ?? [
                          "neutral",
                        ]).map((st) => (
                          <SelectItem key={st} value={st}>
                            {st}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div>
                  <Label className="text-sm text-slate-300">속도</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {TTS_SPEED_OPTIONS.map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => setSpeechSpeed(sp)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-xs font-medium tabular-nums",
                          speechSpeed === sp
                            ? studio.btnSegmentActive
                            : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                        )}
                      >
                        {sp}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
              <div className="space-y-5">
                {voicePreviewLoading ? (
                  <div className="rounded-xl border border-violet-500/30 bg-violet-950/25 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-violet-100">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      음성 생성 중...
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 transition-[width] duration-150 ease-out"
                        style={{ width: `${voiceGenProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800"
                      disabled={voicePreviewLoading}
                      onClick={() => {
                        const sid = VOICE_PREVIEW_SCENES[voiceSyncSceneIdx]?.id ?? 1
                        setVoiceEditDetailSceneId(sid)
                        setVoiceEditDetailOpen(true)
                      }}
                    >
                      <Pencil className="mr-1.5 h-4 w-4" />
                      편집 디테일
                    </Button>
                    <Button
                      type="button"
                      className="bg-gradient-to-r from-pink-600 to-fuchsia-600 font-semibold text-white"
                      onClick={() => {
                        setVoiceGenProgress(0)
                        setVoiceTtsRunNonce((n) => n + 1)
                        setVoicePreviewLoading(true)
                      }}
                    >
                      음성 다시 생성
                    </Button>
                    {voicePreviewTtsReady ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/40 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-200">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        생성 완료
                      </span>
                    ) : null}
                  </div>
                )}

                {!voicePreviewLoading ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-3">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-10 w-10 shrink-0 bg-slate-800 text-white"
                        title={voicePreviewAudioPlaying ? "일시정지" : "동기 재생"}
                        onClick={toggleVoiceSyncPlayback}
                      >
                        {voicePreviewAudioPlaying ? (
                          <Pause className="h-4 w-4" aria-hidden />
                        ) : (
                          <Play className="ml-0.5 h-4 w-4" aria-hidden />
                        )}
                      </Button>
                      <span className="text-xs tabular-nums text-slate-400">
                        {formatMmSs(voiceSyncVideoTime)} / {formatMmSs(voiceSyncVideoDurationUi)}
                      </span>
                      <Slider
                        className="min-w-[160px] flex-1"
                        min={0}
                        max={Math.round(voiceSyncVideoDurationUi * 10) / 10}
                        step={0.1}
                        value={[Math.min(voiceSyncVideoTime, voiceSyncVideoDurationUi)]}
                        onValueChange={(v) => {
                          const t = Math.min(v[0] ?? 0, voiceSyncVideoDurationUi)
                          setVoiceSyncVideoTime(t)
                          const vid = voiceSyncVideoRef.current
                          const aud = voicePreviewAudioRef.current
                          if (vid) {
                            vid.currentTime = t
                            const vDur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : voiceSyncVideoDurationUi
                            if (aud && voicePreviewAudioUrl && vDur > 0) {
                              const aDur =
                                Number.isFinite(aud.duration) && aud.duration > 0
                                  ? aud.duration
                                  : voicePreviewAudioDuration > 0
                                    ? voicePreviewAudioDuration
                                    : 0
                              if (aDur > 0) {
                                aud.currentTime = Math.min(aDur - 0.01, Math.max(0, (t / vDur) * aDur))
                                setVoiceSyncAudioPlayhead(aud.currentTime)
                              }
                            }
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-3">
                      <span className="shrink-0 text-xs text-slate-400">배경음</span>
                      <Select
                        value={voiceBgmTrackId}
                        onValueChange={setVoiceBgmTrackId}
                        disabled={!voicePreviewTtsReady || voiceBgmMixing}
                      >
                        <SelectTrigger className="h-9 w-[min(100%,9rem)] border-slate-700 bg-slate-900 text-xs text-slate-100">
                          <SelectValue placeholder="BGM" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="off">끄기</SelectItem>
                          {VOICE_PREVIEW_BGM_OPTIONS.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex min-w-[140px] flex-1 items-center gap-2">
                        <Volume2 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                        <Slider
                          className="flex-1"
                          min={0}
                          max={100}
                          step={1}
                          disabled={!voicePreviewTtsReady || voiceBgmTrackId === "off" || voiceBgmMixing}
                          value={[voiceBgmVolume]}
                          onValueChange={(nv) => setVoiceBgmVolume(Math.round(nv[0] ?? 0))}
                        />
                        <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-slate-500">
                          {voiceBgmVolume}%
                        </span>
                      </div>
                      {voiceBgmMixing ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-violet-300">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          합치는 중…
                        </span>
                      ) : !voicePreviewTtsReady ? (
                        <span className="text-[11px] text-slate-500">TTS 생성 후 선택</span>
                      ) : voiceBgmTrackId !== "off" ? (
                        <span className="text-[11px] text-slate-500">음성 위에 합성됨</span>
                      ) : null}
                    </div>
                    {voicePreviewAudioUrl ? (
                      <audio
                        ref={voicePreviewAudioRef}
                        key={voicePreviewAudioKey}
                        src={voicePreviewAudioUrl}
                        className="hidden"
                        preload="auto"
                        playsInline
                        muted={false}
                        onLoadedMetadata={(e) => {
                          const d = e.currentTarget.duration
                          if (Number.isFinite(d) && d > 0.1) setVoicePreviewAudioDuration(d)
                        }}
                        onTimeUpdate={(e) => handleVoicePreviewAudioTimeUpdate(e.currentTarget.currentTime)}
                        onPause={resetVoicePreviewVideoRate}
                        onEnded={() => {
                          const vid = voiceSyncVideoRef.current
                          const aud = voicePreviewAudioRef.current
                          vid?.pause()
                          resetVoicePreviewVideoRate()
                          setVoicePreviewAudioPlaying(false)
                          if (aud && Number.isFinite(aud.duration) && aud.duration > 0) {
                            handleVoicePreviewAudioTimeUpdate(Math.max(0, aud.duration - 0.02))
                          }
                        }}
                      />
                    ) : null}
                  </>
                ) : null}

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-sm font-semibold text-white">자막 전체 보기</p>
                  <ul className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                    {VOICE_PREVIEW_SCENES.map((sc, i) => (
                      <li
                        key={sc.id}
                        className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs leading-relaxed text-slate-300"
                      >
                        <span className="mr-2 font-mono text-[10px] text-pink-400/90">{i + 1}</span>
                        {getVoiceSceneText(sc.id)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-medium text-slate-300">동기 프리뷰</p>
                <div className="relative mx-auto w-full max-w-[280px] overflow-hidden rounded-xl border border-slate-700 bg-black shadow-xl">
                  <div className={cn("relative aspect-[9/16] overflow-hidden bg-black", voicePreviewLoading && "opacity-60")}>
                    {factoryPreviewVideoSrc ? (
                    <video
                      ref={voiceSyncVideoRef}
                      className="relative z-0 h-full w-full object-cover"
                      src={factoryPreviewVideoSrc}
                      playsInline
                      muted
                      preload="auto"
                      onLoadedMetadata={(e) => {
                        const d = e.currentTarget.duration
                        if (Number.isFinite(d) && d > 0.1) setVoicePreviewVideoDuration(d)
                      }}
                      onTimeUpdate={(e) => {
                        if (voicePreviewAudioUrl) return
                        setVoiceSyncVideoTime(e.currentTarget.currentTime)
                      }}
                      onPlay={() => {
                        setVoicePreviewAudioPlaying(true)
                        const v = voiceSyncVideoRef.current
                        const a = voicePreviewAudioRef.current
                        if (voicePreviewAudioUrl && a && v) {
                          applyVoicePreviewAvSync()
                          if (a.paused) {
                            void a.play().catch(() => {})
                          }
                        }
                      }}
                      onPause={() => {
                        voicePreviewAudioRef.current?.pause()
                        resetVoicePreviewVideoRate()
                        setVoicePreviewAudioPlaying(false)
                        const a = voicePreviewAudioRef.current
                        if (a && voicePreviewAudioUrl && Number.isFinite(a.currentTime)) {
                          setVoiceSyncAudioPlayhead(a.currentTime)
                        }
                      }}
                      onEnded={() => {
                        voicePreviewAudioRef.current?.pause()
                        setVoicePreviewAudioPlaying(false)
                      }}
                    />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                        미리보기 영상 없음
                      </div>
                    )}
                    {voiceSyncSubtitleLine ? (
                      <div
                        key={voiceSyncSubtitleLine}
                        className="pointer-events-none absolute z-[3] max-w-[min(96%,20rem)] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap px-2 text-center leading-snug"
                        style={{
                          left: `${50 + (subX - 540) / 35}%`,
                          top: `${50 + (150 - subY) / 25}%`,
                          transform: "translate(-50%, -50%)",
                          fontFamily: subFontCss,
                          fontSize: subSizePx,
                          fontWeight: subFontWeight,
                          color: subColor,
                          WebkitTextStroke: subOutlineOn ? `${subOutlineW}px ${subOutlineColor}` : undefined,
                          paintOrder: subOutlineOn ? "stroke fill" : undefined,
                          backgroundColor: subBgOn
                            ? (() => {
                                const { r, g, b } = hexToRgb(subBgColor)
                                return `rgba(${r},${g},${b},${subBgOpacity / 100})`
                              })()
                            : undefined,
                          borderRadius: subBgOn ? 6 : undefined,
                          padding: subBgOn ? "6px 10px" : undefined,
                        }}
                      >
                        {voiceSyncSubtitleLine}
                      </div>
                    ) : null}
                  </div>
                </div>

              </div>
            </div>

            <VoicePreviewStudioDialog
              open={voiceEditDetailOpen}
              onOpenChange={setVoiceEditDetailOpen}
              onToast={setToast}
              onCloseSync={syncVoicePreviewFromStudioPlayhead}
              videoSrc={factoryPreviewVideoSrc ?? ""}
              videoPoster={undefined}
              audioSrc={voicePreviewAudioUrl}
              audioKey={voicePreviewAudioKey}
              videoDurationSec={voiceSyncVideoDurationUi}
              audioDurationSec={
                voicePreviewAudioDuration > 0 ? voicePreviewAudioDuration : VOICE_PREVIEW_AUDIO_TOTAL
              }
              initialAudioPlayheadSec={voiceSyncAudioPlayhead}
              voiceLineCues={voiceLineCues}
              fallbackSubtitleLine={voiceSyncSubtitleLine}
              scenes={VOICE_PREVIEW_SCENES}
              voiceEditSceneId={voiceEditDetailSceneId}
              onVoiceEditSceneId={setVoiceEditDetailSceneId}
              getVoiceSceneText={getVoiceSceneText}
              onVoiceSceneText={(id, text) =>
                setVoiceSceneScriptOverrides((prev) => ({ ...prev, [id]: text }))
              }
              subFont={subFont}
              onSubFont={setSubFont}
              subSizePx={subSizePx}
              onSubSizePx={setSubSizePx}
              subColor={subColor}
              onSubColor={setSubColor}
              subWeight={subWeight}
              onSubWeight={setSubWeight}
              subY={subY}
              onSubY={setSubY}
              subX={subX}
              onSubX={setSubX}
              subOutlineOn={subOutlineOn}
              onSubOutlineOn={setSubOutlineOn}
              subOutlineColor={subOutlineColor}
              onSubOutlineColor={setSubOutlineColor}
              subOutlineW={subOutlineW}
              onSubOutlineW={setSubOutlineW}
              subBgOn={subBgOn}
              onSubBgOn={setSubBgOn}
              subBgColor={subBgColor}
              onSubBgColor={setSubBgColor}
              subBgOpacity={subBgOpacity}
              onSubBgOpacity={setSubBgOpacity}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
              <Button type="button" variant="outline" className="border-slate-600 text-slate-200" onClick={() => setCurrentStep(4)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                이전
              </Button>
              <Button
                type="button"
                className={FACTORY_FLOW_NEXT_BTN_CLASS}
                onClick={() => setCurrentStep(6)}
              >
                다음
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">제목,설명,태그 생성</h2>
                <p className="mt-1 text-sm text-slate-400">해시태그까지 한곳에서 정리합니다.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className={studio.btnPrimary}
                  disabled={seoGenerating}
                  onClick={() => void applySeoAiGenerate()}
                >
                  {seoGenerating ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="mr-1.5 h-4 w-4" aria-hidden />
                  )}
                  {seoGenerating ? "AI 생성 중…" : "AI로 전체 생성"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">영상 제목</span>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="tabular-nums">
                    {seoVideoTitle.length}/{SEO_TITLE_MAX}
                  </span>
                  <button
                    type="button"
                    className="text-violet-300 hover:text-violet-200"
                    onClick={() => void copyPlain("제목을 복사했습니다.", seoVideoTitle)}
                  >
                    복사
                  </button>
                </div>
              </div>
              <Input
                value={seoVideoTitle}
                maxLength={SEO_TITLE_MAX}
                onChange={(e) => setSeoVideoTitle(e.target.value)}
                className="border-slate-700 bg-slate-900 text-white"
              />
              <p className="mt-3 text-xs font-medium text-slate-400">추천 제목</p>
              {seoGenerating && seoRecommendedTitles.length === 0 ? (
                <p className="mt-2 flex items-center gap-2 text-xs text-violet-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  제품·대본 분석 중…
                </p>
              ) : seoRecommendedTitles.length > 0 ? (
                <ol className="mt-2 space-y-2">
                  {seoRecommendedTitles.slice(0, 3).map((t, i) => (
                    <li key={`${i}-${t}`}>
                      <button
                        type="button"
                        onClick={() => setSeoVideoTitle(t)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-left text-xs leading-relaxed text-slate-300 transition-colors hover:border-violet-500/50 hover:bg-violet-950/20"
                      >
                        <span className="mr-2 font-mono text-[10px] text-pink-400/90">{i + 1}</span>
                        {t}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-xs text-slate-500">「AI로 전체 생성」을 누르면 제품에 맞는 추천 제목이 표시됩니다.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">영상 설명</span>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="tabular-nums">{seoVideoDesc.length}자</span>
                  <button
                    type="button"
                    className="text-violet-300 hover:text-violet-200"
                    onClick={() => void copyPlain("설명을 복사했습니다.", seoVideoDesc)}
                  >
                    복사
                  </button>
                </div>
              </div>
              <Textarea
                value={seoVideoDesc}
                onChange={(e) => setSeoVideoDesc(e.target.value)}
                rows={8}
                className="resize-y border-slate-700 bg-slate-900 text-sm text-white"
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">해시태그</span>
                <button
                  type="button"
                  className="text-xs text-violet-300 hover:text-violet-200"
                  onClick={() => void copyPlain("해시태그를 복사했습니다.", seoHashtags.join(" "))}
                >
                  전체 복사
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {seoHashtags.map((h) => (
                  <span
                    key={h}
                    className="inline-flex items-center gap-1 rounded-full border border-violet-500/50 bg-violet-950/30 px-2.5 py-1 text-[11px] text-violet-100"
                  >
                    {h}
                    <button
                      type="button"
                      className="rounded p-0.5 text-rose-400 hover:bg-rose-500/15"
                      aria-label={`${h} 제거`}
                      onClick={() => removeSeoHashtag(h)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs leading-relaxed text-slate-400">
                {seoHashtags.length > 0 ? seoHashtags.join(" ") : "「AI로 전체 생성」 후 해시태그가 여기에 모여 표시됩니다."}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
              <Button type="button" variant="outline" className="border-slate-600 text-slate-200" onClick={() => setCurrentStep(5)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                이전
              </Button>
              <Button
                type="button"
                className={FACTORY_FLOW_NEXT_BTN_CLASS}
                onClick={() => setCurrentStep(7)}
              >
                다음
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 7 && (
          <div className="mx-auto max-w-4xl space-y-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                <Download className="h-7 w-7 text-emerald-400" strokeWidth={2} />
              </div>
              <h2 className="mt-4 text-2xl font-bold text-white">다운로드</h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-center sm:gap-4">
              <Button
                type="button"
                variant="outline"
                disabled={!factoryPreviewVideoSrc}
                className="min-h-[3.25rem] flex-1 border-slate-600 bg-slate-900/90 font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-40"
                onClick={() => void handleDownloadPreviewVideo()}
              >
                영상 다운로드
              </Button>
              <Button
                type="button"
                disabled={capcutExporting}
                className="min-h-[3.25rem] flex-1 gap-2 bg-emerald-600 font-semibold text-white shadow-[0_0_24px_rgba(16,185,129,0.3)] hover:bg-emerald-500 disabled:opacity-70"
                onClick={() => void handleCapCutExport()}
              >
                {capcutExporting && !capcutExportZipOnly ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                ) : null}
                CapCut 보내기
              </Button>
              <Button
                type="button"
                disabled={capcutExporting}
                variant="ghost"
                className={cn(studio.btnPrimary, "min-h-[3.25rem] flex-1 gap-2 disabled:opacity-70")}
                onClick={() => void handleCapCutExport({ zipOnly: true })}
              >
                {capcutExporting && capcutExportZipOnly ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                ) : null}
                요소 다운로드
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
              <Button type="button" variant="outline" className="border-slate-600 text-slate-200" onClick={() => setCurrentStep(6)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                이전
              </Button>
              <Button type="button" asChild variant="secondary" className="bg-slate-800 text-slate-100">
                <Link href="/WingsAIStudioShotForm/shopping">쇼핑 숏폼으로</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  )
}

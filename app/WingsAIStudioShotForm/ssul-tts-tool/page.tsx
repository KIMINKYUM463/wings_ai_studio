"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileAudio,
  FileText,
  Hash,
  Home,
  ImagePlus,
  Loader2,
  Menu,
  MessageSquareText,
  Mic2,
  Pause,
  Play,
  Search,
  TrendingUp,
  UserRound,
  Volume2,
  X,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MvpVoicePickerDialog } from "../shortform-studio/MvpVoicePickerDialog"
import { StoryWinningContentPanel } from "../story-shopping/StoryWinningContentPanel"
import type { StoryWinningContent } from "../story-shopping/story-types"
import { formatCount } from "../channel-analysis/lib/types"
import {
  assetFilename,
  buildSrtFromTimedCues,
  downloadTextFile,
  downloadTtsUrl,
} from "@/lib/shotform-separate-assets"
import { decodeAudioDurationSec } from "@/lib/shotform-factory-line-tts"
import {
  filterSupertoneKoreanVoices,
  normalizeSupertoneVoiceRow,
  voiceAvatarFallbackColor,
} from "@/lib/shotform-factory-tts"
import {
  DEFAULT_TTS_SPEED,
  TTS_SPEED_OPTIONS,
  clampTtsSpeed,
  labelTtsSpeed,
} from "@/lib/shotform-tts-speed"
import {
  TTS_PROVIDER_META,
  buildTtsVoiceKey,
  customTtsVoiceLabel,
  defaultStyleForTtsVoice,
  elevenlabsSampleVoiceCatalog,
  enrichTypecastVoice,
  formatVoiceLoadError,
  isCatalogVoice,
  isElevenlabsVoicesReadError,
  labelTtsStyle,
  mergeElevenlabsVoiceCatalog,
  normalizeElevenlabsVoiceRow,
  normalizeTypecastVoiceRow,
  parseBareVoiceId,
  providerLabelFromVoiceId,
  resolveTtsVoiceDisplay,
  shouldAutoLoadVoiceCatalog,
  shotformTtsApiKey,
  stylesForTtsVoice,
  supertonicBuiltinVoiceCatalog,
  synthesizeTtsLine,
  synthesizeTtsPreview,
  ttsApiKeyMissingMessage,
  ttsProviderFromVoiceId,
  type ShotformTtsVoice,
  type TtsProviderId,
} from "@/lib/shotform-tts-providers"
import { fetchSupertonicVoices } from "@/lib/supertonic-runtime-client"
import {
  buildSsulTimedCuesFromDuration,
  ssulTtsTextFromScript,
  type SsulTimedCue,
} from "@/lib/shotform-ssul-tts-srt"
import { narrationPlainCharCount } from "@/lib/shotform-narration-timing"

type CatalogMap = Record<TtsProviderId, ShotformTtsVoice[]>
type LoadingMap = Record<TtsProviderId, boolean>
type ErrorMap = Record<TtsProviderId, string | null>
type SsulToolStep = "content" | "voice" | "script" | "export" | "keywords"

type LangKeyword = { keyword: string; ko: string }
type KeywordBundle = { en: LangKeyword[]; zh: LangKeyword[]; ja: LangKeyword[] }
type ProductKeywordsResult = { broad: KeywordBundle; exact: KeywordBundle }

const SSUL_TOOL_STEPS: Array<{
  id: SsulToolStep
  label: string
  description: string
  icon: typeof TrendingUp
}> = [
  {
    id: "content",
    label: "콘텐츠 발굴",
    description: "잘 되는 썰·쇼핑 영상",
    icon: TrendingUp,
  },
  {
    id: "voice",
    label: "TTS 목소리",
    description: "모델·캐릭터·배속",
    icon: Mic2,
  },
  {
    id: "script",
    label: "대본",
    description: "나레이션 편집",
    icon: FileText,
  },
  {
    id: "export",
    label: "생성·다운로드",
    description: "목소리 + SRT",
    icon: Download,
  },
  {
    id: "keywords",
    label: "검색 키워드",
    description: "이미지·제품명 → 다국어",
    icon: Search,
  },
]

const EMPTY_CATALOG: CatalogMap = {
  supertone: [],
  supertonic: supertonicBuiltinVoiceCatalog(),
  elevenlabs: elevenlabsSampleVoiceCatalog(),
  typecast: [],
}

function normalizeTranscriptForScript(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function KeywordLangBlock({
  title,
  items,
  onCopy,
}: {
  title: string
  items: LangKeyword[]
  onCopy: (text: string) => void
}) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-white/8 bg-black/25 p-3">
        <p className="text-xs font-semibold text-zinc-300">{title}</p>
        <p className="mt-2 text-[11px] text-zinc-500">결과 없음</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-white/8 bg-black/25 p-3">
      <p className="text-xs font-semibold text-zinc-200">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, index) => (
          <li key={`${title}-${index}-${item.keyword}`}>
            <button
              type="button"
              onClick={() => onCopy(item.keyword)}
              className="flex w-full items-start justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition hover:border-amber-400/25 hover:bg-amber-500/10"
              title="클릭해서 키워드 복사"
            >
              <span className="min-w-0">
                <span className="block text-sm text-zinc-100">{item.keyword}</span>
                <span className="block text-[11px] text-zinc-500">{item.ko}</span>
              </span>
              <span className="shrink-0 text-[10px] text-zinc-600">복사</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const PLATFORM_SEARCH_GUIDES = [
  {
    id: "youtube",
    name: "유튜브",
    hint: "영어 검색",
    langs: ["en"] as const,
    href: (q: string) =>
      `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    downloaderLabel: "유플레이어",
    downloaderUrl: "https://youplayer.co.kr/",
    icon: (
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff0000] shadow-lg shadow-red-900/30">
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" aria-hidden>
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.8 15.5v-7l6.3 3.5-6.3 3.5z" />
        </svg>
      </span>
    ),
  },
  {
    id: "tiktok",
    name: "틱톡",
    hint: "영어·중국어 검색",
    langs: ["en", "zh"] as const,
    href: (q: string) => `https://www.tiktok.com/search?q=${encodeURIComponent(q)}`,
    downloaderLabel: "SnapTik",
    downloaderUrl: "https://snaptik.app/ko3",
    icon: (
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black ring-1 ring-white/20 shadow-lg">
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" aria-hidden>
          <path d="M19.6 8.2a6.6 6.6 0 0 1-3.8-1.2v7.1a5.7 5.7 0 1 1-4.9-5.6v2.9a2.8 2.8 0 1 0 2 2.7V2.8h2.9a6.6 6.6 0 0 0 3.8 5.4v0z" />
        </svg>
      </span>
    ),
  },
  {
    id: "instagram",
    name: "인스타그램",
    hint: "영어·일본어 검색",
    langs: ["en", "ja"] as const,
    href: (q: string) =>
      `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(q)}`,
    downloaderLabel: "sssInstagram",
    downloaderUrl: "https://sssinstagram.com/en1",
    icon: (
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#515bd4] shadow-lg shadow-fuchsia-900/30">
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" aria-hidden>
          <path d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2zm6.1-8.2a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM12 3.4c-2.3 0-2.6 0-3.5.1-.9 0-1.5.2-2 .4a4 4 0 0 0-1.5 1 4 4 0 0 0-1 1.5c-.2.5-.3 1.1-.4 2C3.4 9.4 3.4 9.7 3.4 12s0 2.6.1 3.5c0 .9.2 1.5.4 2a4 4 0 0 0 1 1.5 4 4 0 0 0 1.5 1c.5.2 1.1.3 2 .4.9.1 1.2.1 3.5.1s2.6 0 3.5-.1c.9 0 1.5-.2 2-.4a4 4 0 0 0 1.5-1 4 4 0 0 0 1-1.5c.2-.5.3-1.1.4-2 .1-.9.1-1.2.1-3.5s0-2.6-.1-3.5c0-.9-.2-1.5-.4-2a4 4 0 0 0-1-1.5 4 4 0 0 0-1.5-1c-.5-.2-1.1-.3-2-.4-.9-.1-1.2-.1-3.5-.1zm0 1.6c2.3 0 2.5 0 3.4.1.8 0 1.2.2 1.5.3.4.1.6.3.9.6.3.3.5.5.6.9.1.3.3.7.3 1.5.1.9.1 1.1.1 3.4s0 2.5-.1 3.4c0 .8-.2 1.2-.3 1.5-.1.4-.3.6-.6.9-.3.3-.5.5-.9.6-.3.1-.7.3-1.5.3-.9.1-1.1.1-3.4.1s-2.5 0-3.4-.1c-.8 0-1.2-.2-1.5-.3a2.4 2.4 0 0 1-.9-.6 2.4 2.4 0 0 1-.6-.9c-.1-.3-.3-.7-.3-1.5-.1-.9-.1-1.1-.1-3.4s0-2.5.1-3.4c0-.8.2-1.2.3-1.5.1-.4.3-.6.6-.9.3-.3.5-.5.9-.6.3-.1.7-.3 1.5-.3.9-.1 1.1-.1 3.4-.1z" />
        </svg>
      </span>
    ),
  },
  {
    id: "xhs",
    name: "샤오홍슈",
    hint: "중국어 검색",
    langs: ["zh"] as const,
    href: (q: string) =>
      `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}`,
    downloaderLabel: "DLBunny",
    downloaderUrl: "https://dlbunny.com/ko/xhs",
    icon: (
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff2442] shadow-lg shadow-rose-900/30">
        <span className="text-lg font-black leading-none text-white">红</span>
      </span>
    ),
  },
  {
    id: "douyin",
    name: "도우인",
    hint: "중국어 검색",
    langs: ["zh"] as const,
    href: (q: string) => `https://www.douyin.com/search/${encodeURIComponent(q)}`,
    downloaderLabel: "TikVideo",
    downloaderUrl: "https://tikvideo.app/ko/download-douyin-video",
    icon: (
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black ring-1 ring-[#fe2c55]/50 shadow-lg">
        <span className="text-[11px] font-black tracking-tight text-white">抖音</span>
      </span>
    ),
  },
] as const

function VideoPickCriteriaGuide() {
  const items = [
    {
      n: "1",
      title: "주인공이 또렷함",
      desc: "제품이 화면 중앙에서 바로 읽혀야 해요.",
      tone: "border-emerald-400/30 bg-emerald-500/[0.08]",
      badge: "bg-emerald-500 text-white",
      ok: true,
      tag: "골라요",
    },
    {
      n: "2",
      title: "해상도가 충분함",
      desc: "줌·크롭해도 가장자리가 뭉개지지 않아야 해요.",
      tone: "border-sky-400/30 bg-sky-500/[0.08]",
      badge: "bg-sky-500 text-white",
      ok: true,
      tag: "골라요",
    },
    {
      n: "3",
      title: "글자가 박혀 있지 않음",
      desc: "원본에 자막·배너가 깔린 영상은 제외하세요.",
      tone: "border-rose-400/30 bg-rose-500/[0.08]",
      badge: "bg-rose-500 text-white",
      ok: false,
      tag: "피해요",
    },
  ] as const

  return (
    <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-b from-amber-500/10 to-[#0c0e14] p-4 sm:p-5">
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">
          소스 영상 체크리스트
        </p>
        <h4 className="mt-1 text-sm font-semibold text-zinc-50">쓸 만한 원본만 골라 담으세요</h4>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
          플랫폼에서 찾을 때 아래 조건을 먼저 확인하면, 이후 TTS·자막·편집 단계에서 다시 고르는
          일이 줄어듭니다.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0b0f]">
        <img
          src="/shotform/ssul-video-source-checklist.png"
          alt="소스 영상 체크리스트: 주인공이 또렷함, 해상도가 충분함, 글자가 박혀 있지 않음"
          className="h-auto w-full"
        />
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.n}
            className={`relative rounded-xl border px-3.5 py-3.5 ${item.tone}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${item.badge}`}
              >
                {item.n}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  item.ok
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-rose-500/20 text-rose-200"
                }`}
              >
                {item.tag}
              </span>
            </div>
            <p className="mt-2.5 text-sm font-semibold text-zinc-50">{item.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlatformSearchGuide({
  keywords,
}: {
  keywords?: ProductKeywordsResult | null
}) {
  const pickQuery = (langs: readonly ("en" | "zh" | "ja")[]) => {
    if (!keywords) return ""
    for (const lang of langs) {
      const exact = keywords.exact[lang]?.[0]?.keyword
      if (exact) return exact
      const broad = keywords.broad[lang]?.[0]?.keyword
      if (broad) return broad
    }
    return ""
  }

  return (
    <div className="space-y-3">
      <VideoPickCriteriaGuide />

      <div className="rounded-2xl border border-white/10 bg-white px-3 py-5 text-zinc-900 shadow-sm sm:px-5">
        <p className="mb-4 text-center text-xs font-semibold text-zinc-500">
          플랫폼별 검색 안내
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-2">
          {PLATFORM_SEARCH_GUIDES.map((platform) => {
            const query = pickQuery(platform.langs)
            const openable = Boolean(query)
            const body = (
              <>
                {platform.icon}
                <span className="mt-2.5 text-sm font-bold text-zinc-900">{platform.name}</span>
                <span className="mt-0.5 text-[11px] text-zinc-500">{platform.hint}</span>
              </>
            )
            return (
              <div
                key={platform.id}
                className="flex flex-col items-center rounded-xl px-2 py-2 text-center"
              >
                {openable ? (
                  <a
                    href={platform.href(query)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full flex-col items-center rounded-xl px-1 py-1 transition hover:bg-zinc-50"
                    title={`${platform.name}에서 "${query}" 검색`}
                  >
                    {body}
                  </a>
                ) : (
                  body
                )}
                <a
                  href={platform.downloaderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-semibold text-zinc-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                  title={`${platform.name} 영상 다운로더 열기`}
                >
                  다운 · {platform.downloaderLabel}
                </a>
              </div>
            )
          })}
        </div>
        {keywords ? (
          <p className="mt-4 text-center text-[11px] text-zinc-500">
            위 체크리스트에 맞는 원본만 고른 뒤 · 아이콘=검색 · 다운 버튼=다운로더
          </p>
        ) : (
          <p className="mt-4 text-center text-[11px] text-zinc-500">
            키워드 생성 후 검색하고, 주인공 또렷·해상도 충분·글자 없는 원본만 다운로드하세요.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0c0e14]/90 p-4 sm:p-5">
        <p className="text-xs font-semibold text-zinc-200">영상 다운로더 바로가기</p>
        <p className="mt-1 text-[11px] text-zinc-500">
          찾은 영상 링크를 복사한 뒤, 아래 사이트에서 다운로드하세요.
        </p>
        <ul className="mt-3 space-y-2">
          {PLATFORM_SEARCH_GUIDES.map((platform) => (
            <li key={`dl-${platform.id}`}>
              <a
                href={platform.downloaderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 transition hover:border-amber-400/30 hover:bg-amber-500/10"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-100">
                    {platform.name}
                  </span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {platform.downloaderLabel} · {platform.downloaderUrl.replace(/^https?:\/\//, "")}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-amber-300">열기</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function SsulTtsToolPage() {
  const [userId, setUserId] = useState("")
  const [provider, setProvider] = useState<TtsProviderId>("supertone")
  const [voiceCatalog, setVoiceCatalog] = useState<CatalogMap>(EMPTY_CATALOG)
  const [voicesLoading, setVoicesLoading] = useState<LoadingMap>({
    supertone: false,
    supertonic: false,
    elevenlabs: false,
    typecast: false,
  })
  const [voiceLoadErrors, setVoiceLoadErrors] = useState<ErrorMap>({
    supertone: null,
    supertonic: null,
    elevenlabs: null,
    typecast: null,
  })
  const [selectedVoiceId, setSelectedVoiceId] = useState("")
  const [voiceStyle, setVoiceStyle] = useState("neutral")
  const [speed, setSpeed] = useState(DEFAULT_TTS_SPEED)
  const [voicePickerOpen, setVoicePickerOpen] = useState(false)
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const [script, setScript] = useState("")
  const [selectedContent, setSelectedContent] = useState<StoryWinningContent | null>(null)
  const [isPullingScript, setIsPullingScript] = useState(false)
  const [scriptSource, setScriptSource] = useState<"manual" | "transcript" | "description" | "title" | null>(
    null
  )
  const [activeStep, setActiveStep] = useState<SsulToolStep>("content")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [srtText, setSrtText] = useState("")
  const [cues, setCues] = useState<SsulTimedCue[]>([])
  const [durationSec, setDurationSec] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [productName, setProductName] = useState("")
  const [productImageDataUrl, setProductImageDataUrl] = useState<string | null>(null)
  const [productImageName, setProductImageName] = useState("")
  const [keywordResult, setKeywordResult] = useState<ProductKeywordsResult | null>(null)
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false)
  const [keywordError, setKeywordError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const productImageInputRef = useRef<HTMLInputElement | null>(null)

  const activeProvider = ttsProviderFromVoiceId(selectedVoiceId) ?? provider
  const displayVoice = selectedVoiceId
    ? resolveTtsVoiceDisplay(selectedVoiceId, voiceCatalog)
    : null
  const isCustomVoice = Boolean(
    selectedVoiceId &&
      !isCatalogVoice(selectedVoiceId, voiceCatalog[activeProvider] ?? [], activeProvider)
  )
  const styleOptions = stylesForTtsVoice(
    activeProvider,
    displayVoice && !isCustomVoice
      ? displayVoice
      : isCustomVoice
        ? customTtsVoiceLabel(activeProvider, selectedVoiceId)
        : null
  )
  const providerMeta = TTS_PROVIDER_META[activeProvider]
  const charCount = useMemo(() => narrationPlainCharCount(script), [script])

  const revokeAudio = useCallback(() => {
    if (audioUrlRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(audioUrlRef.current)
    }
    audioUrlRef.current = null
  }, [])

  useEffect(
    () => () => {
      revokeAudio()
      previewAudioRef.current?.pause()
      previewAudioRef.current = null
    },
    [revokeAudio]
  )

  useEffect(() => {
    const resolveUser = async () => {
      try {
        const response = await fetch("/api/kakao/user")
        const data = await response.json()
        const id =
          data.loggedIn && data.user
            ? data.user.email || `kakao_${data.user.id}`
            : localStorage.getItem("user_id") ||
              localStorage.getItem("user_email") ||
              "anonymous"
        setUserId(id)
      } catch {
        setUserId(
          localStorage.getItem("user_id") ||
            localStorage.getItem("user_email") ||
            "anonymous"
        )
      }
    }
    void resolveUser()
  }, [])

  const loadVoices = useCallback(async (p: TtsProviderId) => {
    if (p === "supertonic") {
      setVoicesLoading((prev) => ({ ...prev, supertonic: true }))
      setVoiceLoadErrors((prev) => ({ ...prev, supertonic: null }))
      try {
        const res = await fetchSupertonicVoices()
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean
          voices?: Array<{ voice_id?: string; name?: string; gender?: string }>
          error?: string
        }
        const list =
          Array.isArray(data.voices) && data.voices.length
            ? data.voices
                .map((v) => ({
                  voice_id: String(v.voice_id || "").trim(),
                  name: String(v.name || v.voice_id || "Voice"),
                  gender: v.gender,
                }))
                .filter((v) => v.voice_id)
            : supertonicBuiltinVoiceCatalog()
        setVoiceCatalog((prev) => ({ ...prev, supertonic: list }))
      } catch (e) {
        setVoiceCatalog((prev) => ({
          ...prev,
          supertonic: prev.supertonic.length ? prev.supertonic : supertonicBuiltinVoiceCatalog(),
        }))
        setVoiceLoadErrors((prev) => ({
          ...prev,
          supertonic: formatVoiceLoadError(
            "supertonic",
            e instanceof Error ? e.message : "수퍼토닉3 목록 실패"
          ),
        }))
      } finally {
        setVoicesLoading((prev) => ({ ...prev, supertonic: false }))
      }
      return
    }

    if (p === "elevenlabs") {
      const key = shotformTtsApiKey("elevenlabs")
      if (!key) {
        setVoiceCatalog((prev) => ({ ...prev, elevenlabs: elevenlabsSampleVoiceCatalog() }))
        return
      }
      setVoicesLoading((prev) => ({ ...prev, elevenlabs: true }))
      setVoiceLoadErrors((prev) => ({ ...prev, elevenlabs: null }))
      try {
        const res = await fetch(`/api/elevenlabs-voices?apiKey=${encodeURIComponent(key)}`)
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean
          voices?: unknown[]
          error?: string
          code?: string
        }
        if (!res.ok || data.success === false) {
          const errText = data.error || `목록 실패 (${res.status})`
          if (isElevenlabsVoicesReadError(errText, data.code)) {
            setVoiceCatalog((prev) => ({ ...prev, elevenlabs: elevenlabsSampleVoiceCatalog() }))
            return
          }
          throw new Error(errText)
        }
        const apiList = (Array.isArray(data.voices) ? data.voices : [])
          .map((v) => normalizeElevenlabsVoiceRow(v as Record<string, unknown>))
          .filter((v) => v.voice_id)
        setVoiceCatalog((prev) => ({
          ...prev,
          elevenlabs: mergeElevenlabsVoiceCatalog(apiList),
        }))
      } catch (e) {
        const raw = e instanceof Error ? e.message : "ElevenLabs 목록 실패"
        setVoiceCatalog((prev) => ({ ...prev, elevenlabs: elevenlabsSampleVoiceCatalog() }))
        if (!isElevenlabsVoicesReadError(raw)) {
          setVoiceLoadErrors((prev) => ({
            ...prev,
            elevenlabs: formatVoiceLoadError("elevenlabs", raw),
          }))
        }
      } finally {
        setVoicesLoading((prev) => ({ ...prev, elevenlabs: false }))
      }
      return
    }

    const key = shotformTtsApiKey(p)
    if (!key) {
      setVoiceLoadErrors((prev) => ({ ...prev, [p]: ttsApiKeyMissingMessage(p) }))
      return
    }
    setVoicesLoading((prev) => ({ ...prev, [p]: true }))
    setVoiceLoadErrors((prev) => ({ ...prev, [p]: null }))
    try {
      const endpoint =
        p === "supertone"
          ? `/api/supertone-voices?apiKey=${encodeURIComponent(key)}`
          : `/api/typecast-voices?apiKey=${encodeURIComponent(key)}`
      const res = await fetch(endpoint)
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        voices?: unknown[]
        error?: string
      }
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `목소리 목록 실패 (${res.status})`)
      }
      const raw = Array.isArray(data.voices) ? data.voices : []
      let list: ShotformTtsVoice[] = []
      if (p === "supertone") {
        list = filterSupertoneKoreanVoices(
          raw.map((v) => normalizeSupertoneVoiceRow(v as Record<string, unknown>))
        )
      } else {
        list = raw
          .map((v) => normalizeTypecastVoiceRow(v as Record<string, unknown>))
          .filter((v): v is ShotformTtsVoice => Boolean(v))
          .map(enrichTypecastVoice)
      }
      setVoiceCatalog((prev) => ({ ...prev, [p]: list }))
    } catch (e) {
      setVoiceLoadErrors((prev) => ({
        ...prev,
        [p]: formatVoiceLoadError(
          p,
          e instanceof Error ? e.message : `${p} 목소리 목록 실패`
        ),
      }))
    } finally {
      setVoicesLoading((prev) => ({ ...prev, [p]: false }))
    }
  }, [])

  useEffect(() => {
    const list = voiceCatalog[provider] ?? []
    if (shouldAutoLoadVoiceCatalog(provider, list) && !voicesLoading[provider]) {
      void loadVoices(provider)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  useEffect(() => {
    if (voicePickerOpen) {
      const p = ttsProviderFromVoiceId(selectedVoiceId) ?? provider
      const list = voiceCatalog[p] ?? []
      if (shouldAutoLoadVoiceCatalog(p, list) && !voicesLoading[p]) {
        void loadVoices(p)
      }
    }
  }, [voicePickerOpen, selectedVoiceId, provider, voiceCatalog, voicesLoading, loadVoices])

  useEffect(() => {
    const p = ttsProviderFromVoiceId(selectedVoiceId)
    if (p) setProvider(p)
  }, [selectedVoiceId])

  const handleVoiceIdChange = useCallback(
    (id: string) => {
      setSelectedVoiceId(id)
      const p = ttsProviderFromVoiceId(id)
      if (p) {
        setProvider(p)
        const bare = parseBareVoiceId(id)?.bareId ?? ""
        const voice =
          (voiceCatalog[p] ?? []).find((v) => v.voice_id === bare) ??
          (voiceCatalog[p] ?? []).find((v) => buildTtsVoiceKey(p, v.voice_id) === id) ??
          null
        setVoiceStyle(defaultStyleForTtsVoice(p, voice))
      }
    },
    [voiceCatalog]
  )

  const previewVoice = useCallback(
    async (voiceId: string, style: string) => {
      previewAudioRef.current?.pause()
      previewAudioRef.current = null
      setPreviewingVoiceId(voiceId)
      setError(null)
      try {
        const url = await synthesizeTtsPreview(voiceId, style, clampTtsSpeed(speed))
        const audio = new Audio(url)
        previewAudioRef.current = audio
        audio.onended = () => setPreviewingVoiceId(null)
        await audio.play()
      } catch (e) {
        setError(e instanceof Error ? e.message : "미리듣기에 실패했습니다.")
        setPreviewingVoiceId(null)
      }
    },
    [speed]
  )

  const selectWinningContent = useCallback(async (content: StoryWinningContent) => {
    setSelectedContent(content)
    setIsPullingScript(true)
    setError(null)
    setActiveStep("script")
    setMobileNavOpen(false)
    try {
      const transcriptResponse = await fetch("/api/youmaker/get-video-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: content.videoId }),
      })
      const transcriptData = (await transcriptResponse.json().catch(() => ({}))) as {
        success?: boolean
        transcript?: string
        message?: string
      }
      const transcript = normalizeTranscriptForScript(String(transcriptData.transcript || ""))
      if (transcript.length >= 2) {
        setScript(transcript)
        setScriptSource("transcript")
        return
      }

      const description = normalizeTranscriptForScript(content.description || "")
      if (description.length >= 2) {
        setScript(description)
        setScriptSource("description")
        setError("자막을 가져오지 못해 영상 설명으로 채웠습니다. 대본을 다듬어 주세요.")
        return
      }

      setScript(content.title.trim())
      setScriptSource("title")
      setError("자막·설명이 없어 제목만 넣었습니다. 대본을 직접 작성해 주세요.")
    } catch (e) {
      const description = normalizeTranscriptForScript(content.description || "")
      if (description.length >= 2) {
        setScript(description)
        setScriptSource("description")
      } else {
        setScript(content.title.trim())
        setScriptSource("title")
      }
      setError(e instanceof Error ? e.message : "자막을 가져오지 못했습니다.")
    } finally {
      setIsPullingScript(false)
    }
  }, [])

  const clearSelectedContent = () => {
    setSelectedContent(null)
    setScriptSource(null)
  }

  const stopPlayback = () => {
    const a = audioRef.current
    if (a) {
      a.pause()
      a.currentTime = 0
    }
    setIsPlaying(false)
  }

  const togglePlay = async () => {
    if (!audioUrl) return
    previewAudioRef.current?.pause()
    setPreviewingVoiceId(null)
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
      audioRef.current.onended = () => setIsPlaying(false)
    }
    const a = audioRef.current
    if (isPlaying) {
      a.pause()
      setIsPlaying(false)
      return
    }
    try {
      await a.play()
      setIsPlaying(true)
    } catch {
      setError("재생에 실패했습니다.")
    }
  }

  const handleGenerate = async () => {
    setError(null)
    stopPlayback()
    audioRef.current = null
    previewAudioRef.current?.pause()
    setPreviewingVoiceId(null)

    const ttsText = ssulTtsTextFromScript(script)
    if (!ttsText || narrationPlainCharCount(ttsText) < 2) {
      setError("대본을 2자 이상 입력해 주세요.")
      setActiveStep("script")
      return
    }
    if (!selectedVoiceId) {
      setError("TTS 목소리를 선택해 주세요.")
      setActiveStep("voice")
      setVoicePickerOpen(true)
      return
    }

    setIsGenerating(true)
    setProgress("TTS 생성 중…")
    try {
      const url = await synthesizeTtsLine({
        fullVoiceId: selectedVoiceId,
        text: ttsText,
        style: voiceStyle || undefined,
        speed: clampTtsSpeed(speed),
      })
      setProgress("자막 타이밍 계산 중…")
      const dur = await decodeAudioDurationSec(url)
      const timed = buildSsulTimedCuesFromDuration(script, dur)
      const srt = buildSrtFromTimedCues(timed)
      if (!srt) throw new Error("SRT를 만들지 못했습니다.")

      revokeAudio()
      audioUrlRef.current = url
      setAudioUrl(url)
      setDurationSec(dur)
      setCues(timed)
      setSrtText(srt)
      setProgress("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "TTS 생성에 실패했습니다.")
      setProgress("")
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadVoice = async () => {
    if (!audioUrl) return
    try {
      await downloadTtsUrl(audioUrl, "ai_ssul_shopping")
    } catch (e) {
      setError(e instanceof Error ? e.message : "음성 다운로드 실패")
    }
  }

  const downloadSrt = () => {
    if (!srtText) return
    downloadTextFile(
      srtText,
      assetFilename("ai_ssul_shopping", "subtitles", "srt"),
      "application/x-subrip"
    )
  }

  const downloadBoth = async () => {
    await downloadVoice()
    await new Promise((r) => setTimeout(r, 350))
    downloadSrt()
  }

  const handleProductImageFile = (file?: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setKeywordError("이미지 파일만 업로드할 수 있습니다.")
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setKeywordError("이미지는 8MB 이하로 올려 주세요.")
      return
    }
    setKeywordError(null)
    setKeywordResult(null)
    const reader = new FileReader()
    reader.onload = () => {
      setProductImageDataUrl(String(reader.result || ""))
      setProductImageName(file.name)
    }
    reader.onerror = () => setKeywordError("이미지를 읽지 못했습니다.")
    reader.readAsDataURL(file)
  }

  const clearProductImage = () => {
    setProductImageDataUrl(null)
    setProductImageName("")
    setKeywordResult(null)
    if (productImageInputRef.current) productImageInputRef.current.value = ""
  }

  const generateProductKeywords = async () => {
    setKeywordError(null)
    if (!productImageDataUrl) {
      setKeywordError("제품 이미지를 업로드해 주세요.")
      return
    }
    if (!productName.trim()) {
      setKeywordError("쿠팡 제품명을 입력해 주세요.")
      return
    }
    const apiKey =
      typeof window !== "undefined"
        ? (
            localStorage.getItem("shotform_openai_api_key") ||
            localStorage.getItem("openai_api_key") ||
            ""
          ).trim()
        : ""
    if (!apiKey) {
      setKeywordError("ShotForm 설정에 OpenAI API 키를 저장해 주세요.")
      return
    }

    setIsGeneratingKeywords(true)
    try {
      const res = await fetch("/api/shotform/ssul-tts-tool/product-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: productName.trim(),
          imageBase64: productImageDataUrl,
          apiKey,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        keywords?: ProductKeywordsResult
      }
      if (!res.ok || !data.success || !data.keywords) {
        throw new Error(data.error || "검색 키워드 생성에 실패했습니다.")
      }
      setKeywordResult(data.keywords)
    } catch (e) {
      setKeywordResult(null)
      setKeywordError(e instanceof Error ? e.message : "검색 키워드 생성에 실패했습니다.")
    } finally {
      setIsGeneratingKeywords(false)
    }
  }

  const copyKeywordText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setKeywordError("클립보드 복사에 실패했습니다.")
    }
  }

  const stepDone: Record<SsulToolStep, boolean> = {
    content: Boolean(selectedContent),
    voice: Boolean(selectedVoiceId),
    script: charCount >= 2,
    export: Boolean(audioUrl && srtText),
    keywords: Boolean(keywordResult),
  }
  const activeIndex = SSUL_TOOL_STEPS.findIndex((s) => s.id === activeStep)
  const activeMeta = SSUL_TOOL_STEPS[activeIndex] || SSUL_TOOL_STEPS[0]!

  const goStep = (id: SsulToolStep) => {
    setActiveStep(id)
    setMobileNavOpen(false)
  }

  const sidebar = (
    <>
      <div className="border-b border-white/10 px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link
            href="/WingsAIStudioShotForm"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            ShotForm 홈
          </Link>
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setMobileNavOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100 md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">
          <MessageSquareText className="h-3 w-3" />
          AI썰쇼핑숏폼 도구
        </div>
        <p className="mt-2 text-sm font-semibold text-zinc-100">대본 → TTS → SRT</p>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          왼쪽 메뉴에서 기능을 골라 들어가세요.
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {SSUL_TOOL_STEPS.map((item, index) => {
          const Icon = item.icon
          const isActive = activeStep === item.id
          const done = stepDone[item.id]
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => goStep(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                isActive
                  ? "bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/40"
                  : done
                    ? "text-emerald-300 hover:bg-white/[0.04]"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  isActive
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/40"
                    : done
                      ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                      : "border border-white/10 bg-white/[0.03] text-zinc-500"
                }`}
              >
                {done && !isActive ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wider text-zinc-600">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="block truncate text-sm font-medium">{item.label}</span>
                <span className="block truncate text-[10px] text-zinc-600">{item.description}</span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="space-y-2 border-t border-white/10 p-3">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[10px] leading-relaxed text-zinc-500">
          {selectedContent ? (
            <p className="truncate text-zinc-300">영상 · {selectedContent.title}</p>
          ) : (
            <p>콘텐츠 미선택</p>
          )}
          <p className="mt-0.5 truncate">
            {displayVoice?.name
              ? `목소리 · ${displayVoice.name}`
              : "목소리 미선택"}
            {charCount ? ` · 대본 ${charCount}자` : ""}
          </p>
        </div>
        <Link href="/WingsAIStudioShotForm" className="block">
          <Button
            variant="outline"
            className="w-full rounded-xl border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/10"
          >
            <Home className="mr-2 h-4 w-4" />
            ShotForm 홈
          </Button>
        </Link>
      </div>
    </>
  )

  return (
    <div className="fixed inset-0 z-20 flex bg-[#07080c] text-zinc-100">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="메뉴 닫기"
          className="fixed inset-0 z-30 bg-black/55 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-[min(280px,86vw)] shrink-0 flex-col border-r border-white/10 bg-[#0c0d10] transition-transform duration-200 ease-out md:static md:z-auto md:w-[240px] md:translate-x-0 ${
          mobileNavOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#0a0b0f]/90 px-3 py-3 backdrop-blur-md sm:gap-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="메뉴 열기"
              onClick={() => setMobileNavOpen(true)}
              className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-zinc-200 hover:bg-white/10 md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {String(activeIndex + 1).padStart(2, "0")} / {String(SSUL_TOOL_STEPS.length).padStart(2, "0")}
              </p>
              <h2 className="truncate text-base font-semibold text-zinc-50 sm:text-lg">
                {activeMeta.label}
              </h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={activeIndex <= 0}
              onClick={() => goStep(SSUL_TOOL_STEPS[activeIndex - 1]!.id)}
              className="rounded-lg border-white/10 bg-white/[0.03] px-2.5 text-zinc-300 sm:px-3"
            >
              이전
            </Button>
            <Button
              size="sm"
              disabled={activeIndex >= SSUL_TOOL_STEPS.length - 1}
              onClick={() => goStep(SSUL_TOOL_STEPS[activeIndex + 1]!.id)}
              className="rounded-lg bg-amber-500 px-2.5 text-zinc-950 hover:bg-amber-400 sm:px-3"
            >
              다음
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#07080c] p-3 sm:p-5 md:p-6">
          {activeStep === "content" ? (
            <section className="mx-auto max-w-6xl space-y-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                  <TrendingUp className="h-4 w-4 text-amber-300" />
                  잘 되는 썰·쇼핑 영상 고르기
                </h3>
                <p className="mt-1 text-[11px] text-zinc-500">
                  AI 스토리 쇼핑과 같은 채널 그룹입니다. 영상을 고르면 자막을 대본 메뉴로
                  넘깁니다.
                </p>
              </div>

              {selectedContent ? (
                <div className="flex gap-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
                  <img
                    src={selectedContent.thumbnailUrl}
                    alt=""
                    className="h-16 w-28 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-amber-50">
                      {selectedContent.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-amber-100/70">
                      {selectedContent.channelTitle} · 조회{" "}
                      {formatCount(selectedContent.viewCount)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        href={`https://www.youtube.com/watch?v=${selectedContent.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-amber-200 hover:text-white"
                      >
                        <ExternalLink className="h-3 w-3" />
                        원본 보기
                      </a>
                      <button
                        type="button"
                        onClick={clearSelectedContent}
                        className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                      >
                        <X className="h-3 w-3" />
                        선택 해제
                      </button>
                      <button
                        type="button"
                        onClick={() => goStep("script")}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-200 hover:text-white"
                      >
                        대본으로 이동
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {userId ? (
                <div className="overflow-hidden rounded-xl border border-white/8 bg-black/20">
                  <StoryWinningContentPanel
                    userId={userId}
                    selected={selectedContent || undefined}
                    onSelect={(content) => void selectWinningContent(content)}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-8 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  사용자 정보 확인 중…
                </div>
              )}
            </section>
          ) : null}

          {activeStep === "voice" ? (
            <section className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#0c0e14]/90 p-4 sm:p-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-zinc-100">목소리 선택</h3>
                <p className="mt-1 text-[11px] text-zinc-500">
                  카드를 누르면 나레이션 캐릭터 팝업이 열립니다.
                </p>
              </div>

              {voiceLoadErrors[activeProvider] ? (
                <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  {voiceLoadErrors[activeProvider]}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => setVoicePickerOpen(true)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/35 p-3 text-left transition hover:border-amber-400/35 hover:bg-black/50"
              >
                {isCustomVoice ? (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-500/20 ring-2 ring-violet-400/25">
                    <Hash className="h-5 w-5 text-violet-300" />
                  </span>
                ) : displayVoice?.thumbnail_image_url ? (
                  <img
                    src={displayVoice.thumbnail_image_url}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white/10"
                  />
                ) : (
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-white/10"
                    style={{
                      background: voiceAvatarFallbackColor(displayVoice?.name ?? "목소리"),
                    }}
                  >
                    {displayVoice?.name?.slice(0, 1) ?? <UserRound className="h-5 w-5" />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {voicesLoading[activeProvider] && !displayVoice
                      ? "불러오는 중…"
                      : displayVoice?.name ?? "나레이션 캐릭터 선택"}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {selectedVoiceId
                      ? isCustomVoice
                        ? `${providerLabelFromVoiceId(selectedVoiceId)} · ID ${parseBareVoiceId(selectedVoiceId)?.bareId ?? ""}`
                        : voiceStyle
                          ? `${providerMeta.label} · ${labelTtsStyle(activeProvider, voiceStyle)}`
                          : providerMeta.subtitle
                      : "수퍼톤 · Supertonic 3 · ElevenLabs · 타입캐스트"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
              </button>

              {styleOptions.length > 0 && selectedVoiceId ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {styleOptions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setVoiceStyle(s)}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                        voiceStyle === s
                          ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                          : "border-white/10 bg-black/30 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                      }`}
                    >
                      {labelTtsStyle(activeProvider, s)}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 space-y-1.5">
                <Label className="text-xs text-zinc-400">배속</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TTS_SPEED_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSpeed(opt)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        speed === opt
                          ? "bg-amber-500 text-zinc-950"
                          : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200"
                      }`}
                    >
                      {labelTtsSpeed(opt)}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                className="mt-5 w-full rounded-xl bg-amber-500 font-semibold text-zinc-950 hover:bg-amber-400"
                onClick={() => goStep("script")}
              >
                대본으로
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </section>
          ) : null}

          {activeStep === "script" ? (
            <section className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#0c0e14]/90 p-4 sm:p-5">
              <div className="mb-3 flex items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">
                    {selectedContent ? "발굴 영상 대본 다듬기" : "썰 나레이션 붙여넣기"}
                  </h3>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {scriptSource === "transcript"
                      ? "자막에서 가져옴"
                      : scriptSource === "description"
                        ? "영상 설명으로 채움"
                        : scriptSource === "title"
                          ? "제목으로 채움"
                          : "직접 입력 또는 콘텐츠 발굴에서 가져오기"}
                  </p>
                </div>
                <span className="text-[11px] text-zinc-500">{charCount.toLocaleString()}자</span>
              </div>

              {selectedContent ? (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/8 bg-black/30 px-2.5 py-2 text-[11px] text-zinc-400">
                  <img
                    src={selectedContent.thumbnailUrl}
                    alt=""
                    className="h-8 w-14 rounded object-cover"
                  />
                  <span className="min-w-0 truncate">{selectedContent.title}</span>
                </div>
              ) : null}

              {isPullingScript ? (
                <div className="mb-3 flex items-center gap-2 text-xs text-amber-200">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  자막 불러오는 중…
                </div>
              ) : null}

              <Textarea
                value={script}
                onChange={(e) => {
                  setScript(e.target.value)
                  setScriptSource("manual")
                }}
                disabled={isPullingScript}
                placeholder={`예)\n오늘 소개할 제품은 이거예요.\n진짜 솔직하게 말해볼게요.\n단점이 거의 없어서 계속 쓰게 되더라고요.`}
                className="min-h-[min(52vh,420px)] resize-y rounded-xl border-white/10 bg-[#0a0b0f] text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500/30 disabled:opacity-60"
              />

              {error && activeStep === "script" ? (
                <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {error}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => goStep("content")}
                  className="border-white/10 bg-white/[0.03] text-zinc-300"
                >
                  콘텐츠 발굴
                </Button>
                <Button
                  type="button"
                  className="flex-1 rounded-xl bg-amber-500 font-semibold text-zinc-950 hover:bg-amber-400"
                  onClick={() => goStep("export")}
                >
                  생성·다운로드로
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </section>
          ) : null}

          {activeStep === "export" ? (
            <section className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#0c0e14]/90 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-zinc-100">목소리 + SRT 만들기</h3>
              <p className="mt-1 text-[11px] text-zinc-500">
                선택한 TTS로 대본을 읽고, 자막 타이밍 SRT까지 만듭니다.
              </p>

              <div className="mt-3 grid gap-2 rounded-xl border border-white/8 bg-black/30 p-3 text-[11px] text-zinc-400 sm:grid-cols-3">
                <p>
                  목소리 ·{" "}
                  <span className="text-zinc-200">{displayVoice?.name || "미선택"}</span>
                </p>
                <p>
                  대본 · <span className="text-zinc-200">{charCount.toLocaleString()}자</span>
                </p>
                <p>
                  배속 · <span className="text-zinc-200">{labelTtsSpeed(speed)}</span>
                </p>
              </div>

              <Button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating}
                className="mt-4 h-11 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 font-semibold text-zinc-950 hover:from-amber-400 hover:to-orange-400"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {progress || "생성 중…"}
                  </>
                ) : (
                  <>
                    <Volume2 className="mr-2 h-4 w-4" />
                    목소리 + SRT 만들기
                  </>
                )}
              </Button>

              {error && activeStep === "export" ? (
                <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {error}
                </p>
              ) : null}

              {audioUrl && srtText ? (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-100">
                    <FileAudio className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      생성 완료 · 음성 {durationSec.toFixed(1)}초 · 자막 {cues.length}줄
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void togglePlay()}
                      className="border-white/10 bg-white/[0.03] text-zinc-200"
                    >
                      {isPlaying ? (
                        <Pause className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {isPlaying ? "정지" : "미리듣기"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void downloadVoice()}
                      className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      목소리 다운로드
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={downloadSrt}
                      className="bg-orange-500 text-zinc-950 hover:bg-orange-400"
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      SRT 다운로드
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void downloadBoth()}
                      className="border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      둘 다 받기
                    </Button>
                  </div>

                  <details className="rounded-xl border border-white/8 bg-black/30 p-3">
                    <summary className="cursor-pointer text-xs font-medium text-zinc-400">
                      SRT 미리보기
                    </summary>
                    <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-400">
                      {srtText}
                    </pre>
                  </details>
                </div>
              ) : null}

              <Button
                type="button"
                className="mt-4 w-full rounded-xl bg-amber-500 font-semibold text-zinc-950 hover:bg-amber-400"
                onClick={() => goStep("keywords")}
              >
                다음 · 검색 키워드
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </section>
          ) : null}

          {activeStep === "keywords" ? (
            <section className="mx-auto max-w-3xl space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#0c0e14]/90 p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-zinc-100">제품 이미지 · 쿠팡 제품명</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                  이미지를 보고 영상 플랫폼 검색용 키워드를 영어·중국어·일본어로 만듭니다. 각
                  키워드 옆에 한국어 번역이 함께 표시됩니다.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">제품 이미지</Label>
                    <input
                      ref={productImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleProductImageFile(e.target.files?.[0])}
                    />
                    {productImageDataUrl ? (
                      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
                        <img
                          src={productImageDataUrl}
                          alt="제품"
                          className="mx-auto max-h-56 w-full object-contain"
                        />
                        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
                          <p className="min-w-0 truncate text-[11px] text-zinc-400">
                            {productImageName || "uploaded"}
                          </p>
                          <div className="flex shrink-0 gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 border-white/10 bg-white/[0.03] px-2 text-[11px] text-zinc-300"
                              onClick={() => productImageInputRef.current?.click()}
                            >
                              교체
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 border-white/10 bg-white/[0.03] px-2 text-[11px] text-zinc-300"
                              onClick={clearProductImage}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => productImageInputRef.current?.click()}
                        className="flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/30 px-4 text-zinc-400 transition hover:border-amber-400/40 hover:bg-amber-500/5 hover:text-amber-100"
                      >
                        <ImagePlus className="h-7 w-7" />
                        <span className="text-xs font-medium">이미지 업로드</span>
                        <span className="text-[10px] text-zinc-600">JPG · PNG · WEBP · 최대 8MB</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">쿠팡 제품명</Label>
                    <Input
                      value={productName}
                      onChange={(e) => {
                        setProductName(e.target.value)
                        setKeywordResult(null)
                      }}
                      placeholder="예: 무선 미니 핸디 청소기"
                      className="h-11 border-white/10 bg-[#0a0b0f] text-sm text-zinc-100 placeholder:text-zinc-600"
                    />
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                      쿠팡에 등록된 상품명 그대로 넣으면, 이미지와 맞춰 일반 키워드 /
                      정확한 제품명 키워드를 나눕니다.
                    </p>
                    <Button
                      type="button"
                      onClick={() => void generateProductKeywords()}
                      disabled={isGeneratingKeywords}
                      className="mt-2 h-11 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 font-semibold text-zinc-950 hover:from-amber-400 hover:to-orange-400"
                    >
                      {isGeneratingKeywords ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          키워드 생성 중…
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          검색 키워드 만들기
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {keywordError ? (
                  <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                    {keywordError}
                  </p>
                ) : null}
              </div>

              <PlatformSearchGuide keywords={keywordResult} />

              {keywordResult ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
                    키워드 생성 완료 · 키워드 클릭=복사 · 아이콘=검색 · 다운 버튼=다운로더
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#0c0e14]/90 p-4 sm:p-5">
                    <h4 className="text-sm font-semibold text-zinc-100">광범위한 일반 키워드</h4>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      카테고리·용도·형태처럼 넓게 검색할 때
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <KeywordLangBlock
                        title="영어"
                        items={keywordResult.broad.en}
                        onCopy={(text) => void copyKeywordText(text)}
                      />
                      <KeywordLangBlock
                        title="중국어"
                        items={keywordResult.broad.zh}
                        onCopy={(text) => void copyKeywordText(text)}
                      />
                      <KeywordLangBlock
                        title="일본어"
                        items={keywordResult.broad.ja}
                        onCopy={(text) => void copyKeywordText(text)}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#0c0e14]/90 p-4 sm:p-5">
                    <h4 className="text-sm font-semibold text-zinc-100">정확한 제품명 키워드</h4>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      제품명·특징에 가깝게 좁혀 검색할 때
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <KeywordLangBlock
                        title="영어"
                        items={keywordResult.exact.en}
                        onCopy={(text) => void copyKeywordText(text)}
                      />
                      <KeywordLangBlock
                        title="중국어"
                        items={keywordResult.exact.zh}
                        onCopy={(text) => void copyKeywordText(text)}
                      />
                      <KeywordLangBlock
                        title="일본어"
                        items={keywordResult.exact.ja}
                        onCopy={(text) => void copyKeywordText(text)}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </main>
      </div>

      <MvpVoicePickerDialog
        open={voicePickerOpen}
        onOpenChange={setVoicePickerOpen}
        initialProvider={activeProvider}
        voiceCatalog={voiceCatalog}
        voicesLoading={voicesLoading}
        voiceLoadErrors={voiceLoadErrors}
        selectedVoiceId={selectedVoiceId}
        voiceStyle={voiceStyle}
        onVoiceIdChange={handleVoiceIdChange}
        onStyleChange={setVoiceStyle}
        onReloadVoices={(p) => void loadVoices(p)}
        onPreviewVoice={(id, style) => void previewVoice(id, style)}
        previewingVoiceId={previewingVoiceId}
      />
    </div>
  )
}

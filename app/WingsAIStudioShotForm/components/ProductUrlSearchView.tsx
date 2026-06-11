"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Link2,
  ExternalLink,
  Copy,
  PackageSearch,
  Film,
  ArrowLeft,
  Plus,
  X,
  ArrowRight,
  Play,
  Sparkles,
  ImagePlus,
} from "lucide-react"
import { DouyinCardPlayer } from "@/app/WingsAIStudioShotForm/components/DouyinCardPlayer"
import { KeyframeSearchGrid } from "@/app/WingsAIStudioShotForm/components/KeyframeSearchGrid"
import {
  StudioPageHeader,
  StudioSearchField,
  studio,
} from "@/app/WingsAIStudioShotForm/components/ShotFormStudioUI"
import { extractDouyinVideoId, isDouyinDirectStreamUrl } from "@/lib/douyin-embed"
import { isXhsNotePageUrl, xhsVideoPlaybackSrc } from "@/lib/xhs-video"
import {
  proxyYoutubeThumbnailIfNeeded,
  youtubeThumbnailCandidates,
} from "@/lib/youtube-thumbnail"
import { cn } from "@/lib/utils"
import { googleWebSearchUrl, platformLabelKo, platformSearchUrl } from "@/lib/product-search-links"
import {
  MIX_SOURCE_MAX,
  normalizeMixSourceUrl,
  readMixSourcesFromSession,
  SHOTFORM_SESSION_RESTORED_EVENT,
  type MixSourceItem,
  writeMixSourcesToSession,
  writeProductInputUrlToSession,
  clearProductInputUrlFromSession,
} from "@/lib/shotform-mix-source"

type VideoSimilarity = {
  sameProductType: boolean
  shoppingVideo: boolean
  keywordSimilarity: number
  visualSimilarity: number | null
  finalScore: number
  rationale?: string
}

type VideoResult = {
  platform: string
  title: string
  thumbnail: string
  videoUrl: string
  url: string
  author: string
  contentLength?: "short" | "long" | "unknown"
  relevanceScore?: number
  similarity?: VideoSimilarity
}

type KeyframeItem = { index: number; imageUrl: string; label?: string }

type ProductSearchResponse = {
  input: {
    url: string
    platform: string
    title: string
    thumbnail: string
    author: string
    youtubeVideoId?: string | null
  }
  analysis: {
    productName: string
    category: string
    categoryTags?: string[]
    targetKeywords: string[]
    searchQueries: Record<string, string[]>
    serpPriorityQueries?: Record<string, string[]>
    productTraits?: string[]
    searchFeatures?: string[]
    usageScene?: string
    productForm?: string
    shoppingKeywords?: string[]
    adCopyLines?: string[]
    targetCustomer?: string
  }
  results: VideoResult[]
  keyframes?: KeyframeItem[]
  /** youtube_storyboard_plus_static | youtube_frame_thumbnails | platform_oembed_thumbnail_only | serpapi_google_images_no_video_thumb | single_thumb_only | none */
  keyframesSource?: string
  pipeline?: { done: string[]; planned: string[] }
  signals?: {
    transcriptLength: number
    ocrLength: number
    transcriptPreview: string
    ocrPreview: string
    serpEngineCalls?: number
    serpEngineCallCap?: number
    apifyHttpCalls?: number
  }
  mvp?: boolean
  notice?: string
  /** API가 LLM 유사도 재평가를 적용했는지 */
  flags?: { llmSimilarityRerank?: boolean; keyframesVisionCurated?: boolean; skipVideoCandidateChecks?: boolean; liteMode?: boolean }
  error?: string
}

const RESULT_PLATFORM_ORDER = ["youtube", "tiktok", "xiaohongshu", "douyin"] as const
const PLATFORM_ORDER = ["youtube", "tiktok", "xiaohongshu", "douyin"] as const

function shotformOpenAIKey(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_openai_api_key") || "").trim() || null
}

function shotformYoutubeDataKey(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_youtube_data_api_key") || "").trim() || null
}

function shotformSerpApiKey(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_serpapi_key") || "").trim() || null
}

function shotformApifyToken(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_apify_token") || "").trim() || null
}

const MAX_PRODUCT_IMAGE_BYTES = 3 * 1024 * 1024

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."))
    reader.readAsDataURL(file)
  })
}

function platformDotClass(platform: string): string {
  const m: Record<string, string> = {
    youtube: "bg-red-600",
    tiktok: "bg-black ring-1 ring-white/30",
    instagram: "bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400",
    xiaohongshu: "bg-red-500",
    douyin: "bg-slate-900 ring-1 ring-cyan-400/50",
    baidu: "bg-blue-600",
  }
  return m[platform] || "bg-slate-500"
}

function videoResultToMixItem(item: VideoResult): MixSourceItem {
  return {
    url: item.url,
    title: item.title,
    platform: item.platform,
    thumbnail: item.thumbnail,
    videoUrl: item.videoUrl,
    author: item.author,
  }
}

/**
 * 인페이지 iframe 재생용 URL.
 * 샤오홍슈는 공식 embed가 없고 노트 URL을 iframe에 넣으면 X-Frame-Options 등으로 재생되지 않는 경우가 대부분이라 null — 대신 Apify가 준 직접 MP4(videoUrl)는 SearchResultCardMedia에서 <video>로 재생.
 */
function resolveInlineEmbedSrc(item: VideoResult): string | null {
  if (item.platform === "youtube") {
    if (item.videoUrl.includes("youtube.com/embed")) return item.videoUrl
    const m = item.url.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/)
    return m ? `https://www.youtube.com/embed/${m[1]}` : null
  }
  if (item.platform === "tiktok" && item.url) {
    try {
      const u = new URL(item.url)
      const host = u.hostname.replace(/^www\./, "")
      if (host !== "tiktok.com") return null
      const videoMatch = u.pathname.match(/\/video\/(\d+)/)
      return videoMatch ? `https://www.tiktok.com/embed/v2/${videoMatch[1]}` : null
    } catch {
      return null
    }
  }
  if (item.platform === "instagram" && item.url) {
    try {
      const u = new URL(item.url)
      if (!u.hostname.replace(/^www\./, "").includes("instagram.com")) return null
      const m = u.pathname.match(/\/(p|reel|tv)\/([^/?#]+)/)
      return m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed` : null
    } catch {
      return null
    }
  }
  if (item.platform === "douyin") return null
  if (item.platform === "xiaohongshu") return null
  return null
}

/** 샤오홍슈 CDN URL의 `|` 등이 img src에서 깨지지 않게 정규화 */
function normalizeThumbnailUrl(url: string): string {
  if (!url) return url
  return url.replace(/\|/g, "%7C")
}

function cardThumbnailSrc(item: VideoResult, candidateIndex = 0): string {
  if (item.platform === "youtube") {
    const candidates = youtubeThumbnailCandidates(item)
    const pick = candidates[candidateIndex] || candidates[0] || ""
    return pick ? proxyYoutubeThumbnailIfNeeded(pick) : ""
  }
  const raw = normalizeThumbnailUrl(item.thumbnail?.trim() || "")
  if (!raw.startsWith("http")) return raw
  try {
    const host = new URL(raw).hostname
    if (host.endsWith(".douyinpic.com") || host.endsWith(".xhscdn.com")) {
      return `/api/proxy-image?url=${encodeURIComponent(raw)}`
    }
  } catch {
    /* ignore */
  }
  return raw
}

function withYoutubeAutoplay(embedSrc: string): string {
  try {
    const u = new URL(embedSrc)
    if (!u.hostname.includes("youtube.com")) return embedSrc
    u.searchParams.set("autoplay", "1")
    u.searchParams.set("mute", "1")
    u.searchParams.set("playsinline", "1")
    return u.toString()
  } catch {
    return embedSrc
  }
}

function withDouyinEmbedParams(embedSrc: string): string {
  try {
    const u = new URL(embedSrc)
    if (!u.hostname.includes("douyin.com")) return embedSrc
    u.searchParams.set("autoplay", "1")
    return u.toString()
  } catch {
    return embedSrc
  }
}

/** 카드 미디어 영역 — 썸네일·재생 모두 동일 크기 유지 */
function mediaFrameClass(): string {
  return "relative mx-auto aspect-[9/16] w-full max-w-[min(280px,92vw)] overflow-hidden rounded-lg bg-black max-h-[min(520px,72vh)]"
}

/** 16:9 YouTube embed를 9:16 카드에 꽉 채우기(좌우 크롭) */
const YOUTUBE_IFRAME_COVER_CLASS =
  "absolute top-1/2 left-1/2 h-full w-[calc(100%*256/81)] max-w-none -translate-x-1/2 -translate-y-1/2 border-0"

function iframeReferrerPolicy(platform: string): React.IframeHTMLAttributes<HTMLIFrameElement>["referrerPolicy"] {
  if (platform === "douyin") return "unsafe-url"
  if (platform === "xiaohongshu") return "no-referrer"
  return "strict-origin-when-cross-origin"
}

type InlinePlayer =
  | { mode: "iframe"; src: string }
  | { mode: "video"; src: string }
  | { mode: "douyin" }

type InlineVideoPlayerProps = {
  src: string
  title: string
  frameClass: string
  showPoster: boolean
  posterUrl?: string
  onClose: () => void
  onPlayError?: (msg: string) => void
}

/** 인라인 `<video>` — 브라우저 자동재생 정책에 맞춰 기본 음소거 후 재생 시도 */
function InlineVideoPlayer({ src, title, frameClass, showPoster, posterUrl, onClose, onPlayError }: InlineVideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    const tryPlay = () => {
      void v.play().catch(() => {
        onPlayError?.("자동 재생이 막혔습니다. 하단 재생 버튼을 눌러 주세요.")
      })
    }
    if (v.readyState >= 2) tryPlay()
    else {
      v.addEventListener("loadeddata", tryPlay, { once: true })
      v.addEventListener("canplay", tryPlay, { once: true })
    }
    return () => {
      v.removeEventListener("loadeddata", tryPlay)
      v.removeEventListener("canplay", tryPlay)
    }
  }, [src, onPlayError])

  return (
    <div className={frameClass}>
      <video
        ref={ref}
        className="h-full min-h-[200px] w-full object-cover"
        controls
        playsInline
        muted
        autoPlay
        preload="auto"
        poster={showPoster ? posterUrl : undefined}
        title={title}
        onError={() => onPlayError?.("영상 파일을 불러오지 못했습니다.")}
      >
        <source src={src} type="video/mp4" />
      </video>
      <button
        type="button"
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-white shadow hover:bg-black/90"
        aria-label="미리보기 닫기"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function SearchResultCardMedia({
  item,
  onPlayError,
}: {
  item: VideoResult
  onPlayError?: (msg: string) => void
}) {
  const [player, setPlayer] = useState<InlinePlayer | null>(null)
  const [thumbBroken, setThumbBroken] = useState(false)
  const [thumbIdx, setThumbIdx] = useState(0)
  const [xhsBusy, setXhsBusy] = useState(false)
  const youtubeThumbCandidates = useMemo(
    () => (item.platform === "youtube" ? youtubeThumbnailCandidates(item) : []),
    [item]
  )
  const thumbSrc = useMemo(() => cardThumbnailSrc(item, thumbIdx), [item, thumbIdx])
  const preferredEmbed = useMemo(() => resolveInlineEmbedSrc(item), [item])
  const xhsDirect =
    item.platform === "xiaohongshu" && typeof item.videoUrl === "string" && item.videoUrl.trim().startsWith("http")
      ? item.videoUrl.trim()
      : null

  useEffect(() => {
    setPlayer(null)
    setThumbBroken(false)
    setThumbIdx(0)
    setXhsBusy(false)
  }, [item.url])

  const iframeSrcForDisplay = (src: string) => {
    if (item.platform === "youtube") return withYoutubeAutoplay(src)
    if (item.platform === "douyin") return withDouyinEmbedParams(src)
    return src
  }

  const startPlay = async () => {
    if (item.platform === "douyin" && extractDouyinVideoId(item.url)) {
      setPlayer({ mode: "douyin" })
      return
    }
    if (item.platform === "xiaohongshu") {
      if (xhsDirect) {
        setPlayer({ mode: "video", src: xhsVideoPlaybackSrc(xhsDirect) })
        return
      }
      if (!isXhsNotePageUrl(item.url)) return
      setXhsBusy(true)
      try {
        const res = await fetch(`/api/xhs-note-video?url=${encodeURIComponent(item.url)}`)
        const json = (await res.json().catch(() => ({}))) as { videoUrl?: string; error?: string }
        if (res.ok && json.videoUrl) {
          setPlayer({ mode: "video", src: xhsVideoPlaybackSrc(json.videoUrl) })
        } else {
          onPlayError?.(json.error || "샤오홍슈 영상 주소를 가져오지 못했습니다. 「열기」로 앱/웹에서 재생해 주세요.")
        }
      } catch {
        onPlayError?.("네트워크 오류로 샤오홍슈 미리보기를 열지 못했습니다.")
      } finally {
        setXhsBusy(false)
      }
      return
    }
    const embed = preferredEmbed
    if (embed) {
      setPlayer({ mode: "iframe", src: embed })
      return
    }
    if (item.url.startsWith("http")) {
      setPlayer({ mode: "iframe", src: item.url })
    }
  }

  const canPlay = Boolean(
    (item.platform === "douyin" &&
      (extractDouyinVideoId(item.url) || isDouyinDirectStreamUrl(item.videoUrl || ""))) ||
      (item.platform === "xiaohongshu" && (xhsDirect || isXhsNotePageUrl(item.url))) ||
      preferredEmbed ||
      (item.platform !== "xiaohongshu" && item.platform !== "douyin" && item.url.startsWith("http"))
  )

  const frameClass = mediaFrameClass()

  if (player) {
    if (player.mode === "douyin") {
      return (
        <DouyinCardPlayer
          pageUrl={item.url}
          videoUrl={item.videoUrl}
          title={item.title}
          poster={item.thumbnail || undefined}
          frameClass={frameClass}
          onClose={() => setPlayer(null)}
        />
      )
    }
    if (player.mode === "video") {
      return (
        <InlineVideoPlayer
          key={player.src}
          src={player.src}
          title={item.title}
          frameClass={frameClass}
          showPoster={item.platform !== "xiaohongshu"}
          posterUrl={item.platform !== "xiaohongshu" ? cardThumbnailSrc(item) || undefined : undefined}
          onClose={() => setPlayer(null)}
          onPlayError={onPlayError}
        />
      )
    }
    return (
      <div className={frameClass}>
        <iframe
          title={item.title}
          src={iframeSrcForDisplay(player.src)}
          className={item.platform === "youtube" ? YOUTUBE_IFRAME_COVER_CLASS : "absolute inset-0 h-full w-full border-0"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy={iframeReferrerPolicy(item.platform)}
        />
        <button
          type="button"
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-white shadow hover:bg-black/90"
          aria-label="미리보기 닫기"
          onClick={() => setPlayer(null)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className={cn("group", frameClass)}>
      {thumbSrc && !thumbBroken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={thumbSrc}
          src={thumbSrc}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => {
            if (item.platform === "youtube" && thumbIdx + 1 < youtubeThumbCandidates.length) {
              setThumbIdx((i) => i + 1)
              return
            }
            setThumbBroken(true)
          }}
        />
      ) : (
        <div className="flex h-full min-h-[200px] w-full items-center justify-center p-3 text-center text-xs text-slate-500">
          {item.title}
        </div>
      )}
      <span
        className={cn(
          "pointer-events-none absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full shadow-md",
          platformDotClass(item.platform)
        )}
        title={item.platform}
      />
      {item.similarity != null && item.author !== "검색 링크 (MVP)" ? (
        <Badge
          className={cn(
            "pointer-events-none absolute right-2 top-2 border bg-black/85 text-[10px]",
            item.similarity.finalScore >= 90
              ? "border-emerald-600/60 text-emerald-200"
              : item.similarity.finalScore >= 70
                ? "border-cyan-700/50 text-cyan-200"
                : "border-amber-700/50 text-amber-100"
          )}
          title={item.similarity.rationale || undefined}
        >
          유사 {item.similarity.finalScore}
        </Badge>
      ) : item.relevanceScore != null && item.author !== "검색 링크 (MVP)" && item.relevanceScore >= 4 ? (
        <Badge className="pointer-events-none absolute right-2 top-2 border-cyan-700/50 bg-black/80 text-[10px] text-cyan-200">
          관련 {item.relevanceScore}
        </Badge>
      ) : null}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/50 via-black/10 to-transparent transition-opacity duration-200",
          "opacity-100 max-md:from-black/35 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        )}
      >
        <button
          type="button"
          disabled={!canPlay || xhsBusy}
          title={
            item.platform === "douyin"
              ? "더우인 공식 플레이어를 카드 안에서 엽니다 (open.douyin.com)"
              : item.platform === "xiaohongshu"
                ? "노트에서 영상 URL을 가져와 카드 안에서 재생합니다"
                : !canPlay
                  ? "재생할 수 있는 링크가 없습니다"
                  : undefined
          }
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/95 text-black shadow-lg ring-2 ring-white/30 transition hover:scale-105 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={canPlay ? "이 자리에서 재생" : "재생할 수 있는 링크가 없습니다"}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void startPlay()
          }}
        >
          {xhsBusy ? (
            <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          ) : (
            <Play className="ml-0.5 h-7 w-7 fill-current" aria-hidden />
          )}
        </button>
      </div>
    </div>
  )
}

const ANALYSIS_LOADING_STEPS = [
  "영상 메타·썸네일을 불러오는 중…",
  "자막·화면 텍스트를 읽는 중…",
  "AI가 제품명·키워드를 추론하는 중…",
  "플랫폼별 검색어를 정리하는 중…",
  "관련 쇼핑·숏폼 후보를 넓게 모으는 중…",
  "AI가 후보 영상 유사도를 재평가하는 중…",
] as const

function ProductSearchAnalyzingOverlay({ stepIndex }: { stepIndex: number }) {
  const label = ANALYSIS_LOADING_STEPS[stepIndex % ANALYSIS_LOADING_STEPS.length]
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-8 rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#0c1525]/95 via-[#080d18]/98 to-[#060a12]/95 px-6 py-16 text-center shadow-[0_0_60px_rgba(34,211,238,0.08)] backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex h-32 w-32 items-center justify-center">
        <div className="absolute inset-0 animate-[spin_2.8s_linear_infinite] rounded-full border-2 border-dashed border-cyan-400/35" />
        <div className="absolute inset-3 animate-[spin_2s_linear_infinite] rounded-full border border-violet-400/25 [animation-direction:reverse]" />
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/15 via-transparent to-violet-500/20 blur-xl" />
        <Sparkles className="relative h-11 w-11 animate-pulse text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
      </div>
      <div className="space-y-3">
        <p className="text-base font-semibold tracking-tight text-white">AI가 영상을 분석하고 있어요</p>
        <p className="mx-auto max-w-sm text-sm text-slate-400 transition-all duration-500">{label}</p>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {ANALYSIS_LOADING_STEPS.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 rounded-full transition-all duration-500",
              i === stepIndex % ANALYSIS_LOADING_STEPS.length ? "w-8 bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.45)]" : "w-2 bg-slate-600/80"
            )}
          />
        ))}
      </div>
    </div>
  )
}

export type ProductUrlSearchViewProps = {
  backHref?: string
  backLabel?: string
  /** 트렌드 리서치 셸 안에 넣을 때 외곽 카드 스타일을 맞춤 */
  embedded?: boolean
}

export function ProductUrlSearchView({ backHref, backLabel = "프로젝트로", embedded }: ProductUrlSearchViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawCandidatesMode = searchParams.get("rawCandidates") === "1"

  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<ProductSearchResponse | null>(null)
  const [resultTab, setResultTab] = useState<string>("all")
  /** 이미지로 영상 찾기 vs 유사 영상 — 기능 동일, 표시만 탭 전환 */
  const [discoverTab, setDiscoverTab] = useState<"lens" | "similar">("lens")
  const [toast, setToast] = useState<string | null>(null)
  const [mixPicks, setMixPicks] = useState<MixSourceItem[]>([])
  const [productImageDataUrl, setProductImageDataUrl] = useState<string | null>(null)
  const [productImageName, setProductImageName] = useState<string | null>(null)

  useEffect(() => {
    setUrl("")
    setErr(null)
    setData(null)
    setResultTab("all")
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0)
      return
    }
    const id = window.setInterval(() => {
      setLoadingStep((s) => (s + 1) % ANALYSIS_LOADING_STEPS.length)
    }, 2100)
    return () => window.clearInterval(id)
  }, [loading])

  useEffect(() => {
    const sync = () => setMixPicks(readMixSourcesFromSession())
    sync()
    window.addEventListener(SHOTFORM_SESSION_RESTORED_EVENT, sync)
    return () => window.removeEventListener(SHOTFORM_SESSION_RESTORED_EVENT, sync)
  }, [])

  const visibleResults = useMemo(() => data?.results || [], [data?.results])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: visibleResults.length }
    for (const x of visibleResults) {
      c[x.platform] = (c[x.platform] || 0) + 1
    }
    return c
  }, [visibleResults])

  const filtered = useMemo(() => {
    let r = visibleResults
    if (resultTab !== "all") r = r.filter((x) => x.platform === resultTab)
    return r
  }, [visibleResults, resultTab])

  useEffect(() => {
    if (!data?.input?.url) return
    setDiscoverTab(data.keyframes && data.keyframes.length > 0 ? "lens" : "similar")
  }, [data?.input?.url])

  const mixPickKeySet = useMemo(() => new Set(mixPicks.map((p) => normalizeMixSourceUrl(p.url))), [mixPicks])

  const addToMix = useCallback((item: VideoResult) => {
    setMixPicks((prev) => {
      const key = normalizeMixSourceUrl(item.url)
      if (prev.some((p) => normalizeMixSourceUrl(p.url) === key)) {
        requestAnimationFrame(() => setToast("이미 선택된 영상입니다."))
        return prev
      }
      if (prev.length >= MIX_SOURCE_MAX) {
        requestAnimationFrame(() => setToast(`최대 ${MIX_SOURCE_MAX}개까지 선택할 수 있습니다.`))
        return prev
      }
      requestAnimationFrame(() => setToast("선택했습니다."))
      return [...prev, videoResultToMixItem(item)]
    })
  }, [])

  const removeMixPick = useCallback((url: string) => {
    const key = normalizeMixSourceUrl(url)
    setMixPicks((prev) => prev.filter((p) => normalizeMixSourceUrl(p.url) !== key))
  }, [])

  const clearMixPicks = useCallback(() => setMixPicks([]), [])

  const goShoppingFactoryStep = useCallback(() => {
    if (mixPicks.length === 0) return
    writeMixSourcesToSession(mixPicks)
    router.push("/WingsAIStudioShotForm/shoppingshotform")
  }, [mixPicks, router])

  const handleProductImagePick = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setErr("이미지 파일만 업로드할 수 있습니다.")
      return
    }
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      setErr("이미지는 3MB 이하로 업로드해 주세요.")
      return
    }
    try {
      const dataUrl = await readImageFileAsDataUrl(file)
      if (!dataUrl.startsWith("data:image/")) {
        setErr("이미지 형식을 인식하지 못했습니다.")
        return
      }
      setProductImageDataUrl(dataUrl)
      setProductImageName(file.name)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "이미지 업로드 실패")
    }
  }

  const analyze = async () => {
    setErr(null)
    setData(null)
    const trimmed = url.trim()
    if (!trimmed && !productImageDataUrl) {
      setErr("제품 URL을 입력하거나, 못 찾을 때는 제품 사진을 업로드해 주세요.")
      return
    }
    const openai = shotformOpenAIKey()
    if (!openai) {
      setErr("ShotForm 설정에서 OpenAI API 키(shotform_openai_api_key)를 먼저 저장해주세요.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/product-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmed || undefined,
          openaiApiKey: openai,
          youtubeDataApiKey: shotformYoutubeDataKey() || undefined,
          serpApiKey: shotformSerpApiKey() || undefined,
          apifyApiKey: shotformApifyToken() || undefined,
          ...(productImageDataUrl ? { productImageDataUrl } : {}),
          ...(rawCandidatesMode ? { skipVideoCandidateChecks: true as const } : {}),
        }),
      })
      const json = (await res.json().catch(() => ({}))) as ProductSearchResponse & { error?: string }
      if (!res.ok) {
        setErr(json.error || `요청 실패 (${res.status})`)
        return
      }
      setData(json)
      if (trimmed) writeProductInputUrlToSession(trimmed)
      setResultTab("all")
      if (!json.results?.length && json.analysis?.productName) {
        setToast("키워드는 추출됐지만 유사 영상을 찾지 못했습니다.")
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "네트워크 오류")
    } finally {
      setLoading(false)
    }
  }

  const ytId = data?.input.youtubeVideoId || null

  return (
    <div
      className={cn(
        "relative overflow-hidden text-slate-100",
        embedded ? studio.surface : "rounded-xl border border-slate-700 bg-slate-950 shadow-2xl"
      )}
    >
      {toast ? (
        <div className="absolute right-4 top-4 z-[35] max-w-sm rounded-lg border border-violet-800/60 bg-violet-950/95 px-3 py-2 text-xs text-violet-100 shadow-lg">
          {toast}
        </div>
      ) : null}

      <div className="border-b border-white/[0.06] px-4 pb-5 pt-5 sm:px-6 sm:pt-6">
        <StudioPageHeader
          icon={PackageSearch}
          title="제품 검색"
          description="쇼핑·제품 URL에서 키워드를 뽑고 TikTok·抖音·小红书·YouTube 유사 영상을 찾습니다. URL에서 못 찾으면 제품 사진으로 키워드를 추출합니다."
          actions={
            backHref ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className={studio.btnGhost}
              >
                <Link href={backHref}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {backLabel}
                </Link>
              </Button>
            ) : null
          }
        />

        <div className="mt-6 space-y-3">
          <StudioSearchField
            value={url}
            onChange={setUrl}
            onSubmit={() => void analyze()}
            placeholder="쿠팡 · 네이버 스마트스토어 · YouTube URL"
            disabled={loading}
            loading={loading}
            icon={Link2}
          />

          <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-3">
            <p className="text-xs text-slate-400">URL에서 못 찾을 때 — 제품 사진으로 키워드 추출</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label
                className={cn(
                  studio.btnOutline,
                  "inline-flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs",
                  loading && "pointer-events-none opacity-50"
                )}
              >
                <ImagePlus className="h-3.5 w-3.5" />
                사진 선택
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={loading}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    void handleProductImagePick(file)
                    e.target.value = ""
                  }}
                />
              </label>
              {productImageDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productImageDataUrl}
                    alt={productImageName || "제품 사진"}
                    className="h-12 w-12 rounded-md border border-white/10 object-cover"
                  />
                  <span className="max-w-[200px] truncate text-[10px] text-slate-500">{productImageName}</span>
                  <button
                    type="button"
                    className="rounded-md border border-white/10 p-1 text-slate-400 hover:text-white"
                    disabled={loading}
                    onClick={() => {
                      setProductImageDataUrl(null)
                      setProductImageName(null)
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-slate-600">JPG·PNG · 3MB 이하 · URL과 함께 또는 사진만으로 검색 가능</span>
              )}
            </div>
          </div>
        </div>

        {rawCandidatesMode ? (
          <p className="mx-auto mt-2 max-w-3xl text-xs text-amber-300/95">
            URL에 <code className="rounded bg-slate-800 px-1">rawCandidates=1</code> — 제품 관련도 필터·LLM 유사도 재평가 없이 수집 결과만 정렬해 표시합니다.
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          "relative px-4 pb-6 pt-4 sm:px-6",
          mixPicks.length > 0 && "pb-28",
          loading && "min-h-[min(58vh,560px)]"
        )}
      >
        {loading ? <ProductSearchAnalyzingOverlay stepIndex={loadingStep} /> : null}

        <div className="space-y-6">

                {err && (
                  <div className="rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-200">{err}</div>
                )}

                {data?.notice && <p className="text-xs text-violet-200/90">{data.notice}</p>}
        {data?.flags?.liteMode ? (
          <p className="text-xs text-emerald-300/90">경량 Lite 모드 — 회당 OpenAI 1회 + DuckDuckGo site 검색</p>
        ) : null}

                {data?.input && (
                  <>
                    <div className="grid gap-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4 md:grid-cols-2 md:gap-6">
                      <div>
                        {data.input.platform === "youtube" && ytId ? (
                          <div className={cn(mediaFrameClass(), "rounded-xl border border-slate-700")}>
                            <iframe
                              title="영상 미리보기"
                              src={`https://www.youtube.com/embed/${ytId}`}
                              className="absolute inset-0 h-full w-full border-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ) : data.input.thumbnail ? (
                          <div className={cn(mediaFrameClass(), "rounded-xl border border-slate-700")}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={data.input.thumbnail} alt="" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div
                            className={cn(
                              mediaFrameClass(),
                              "flex items-center justify-center rounded-xl border border-slate-700 text-slate-500"
                            )}
                          >
                            썸네일 없음
                          </div>
                        )}
                        <a
                          href={data.input.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 block truncate text-xs text-cyan-400/90 underline-offset-2 hover:underline"
                        >
                          {data.input.url}
                        </a>
                      </div>

                      <div className="space-y-4">
                        <p className="text-2xl font-bold leading-tight text-white">{data.analysis.productName}</p>

                        <div>
                          <p className="mb-2 text-xs text-slate-500">키워드</p>
                          <div className="flex flex-wrap gap-2">
                            {(data.analysis.targetKeywords || []).map((k) => (
                              <span
                                key={k}
                                className="inline-flex items-center gap-1 rounded-full border border-cyan-700/50 bg-slate-900/80 px-2.5 py-1 text-xs text-cyan-50"
                              >
                                {k}
                                <button
                                  type="button"
                                  className="rounded p-0.5 text-yellow-300 hover:bg-yellow-950/60 hover:text-yellow-200"
                                  title="웹 검색"
                                  onClick={() => window.open(googleWebSearchUrl(k), "_blank", "noopener,noreferrer")}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-0.5 text-yellow-300 hover:bg-yellow-950/60 hover:text-yellow-200"
                                  title="복사"
                                  onClick={() => void navigator.clipboard.writeText(k)}
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>

                        {(data.analysis.productTraits?.length ||
                          data.analysis.searchFeatures?.length ||
                          data.analysis.usageScene ||
                          data.analysis.shoppingKeywords?.length ||
                          data.analysis.adCopyLines?.length ||
                          data.analysis.targetCustomer) && (
                          <details open className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-300">
                            <summary className="cursor-pointer select-none font-medium text-slate-200">
                              상세 분석 (명세: 상품 특징·장면·형태·광고·타겟)
                            </summary>
                            <div className="mt-3 space-y-2 text-xs leading-relaxed">
                              {data.analysis.usageScene ? (
                                <p>
                                  <span className="text-slate-500">사용 장면:</span> {data.analysis.usageScene}
                                </p>
                              ) : null}
                              {data.analysis.productForm ? (
                                <p>
                                  <span className="text-slate-500">제품 형태:</span> {data.analysis.productForm}
                                </p>
                              ) : null}
                              {data.analysis.targetCustomer ? (
                                <p>
                                  <span className="text-slate-500">타겟:</span> {data.analysis.targetCustomer}
                                </p>
                              ) : null}
                              {data.analysis.searchFeatures && data.analysis.searchFeatures.length > 0 ? (
                                <div>
                                  <span className="text-slate-500">검색 특징 태그 (영상→검색어 중간층):</span>
                                  <ul className="mt-1 list-inside list-disc text-slate-400">
                                    {data.analysis.searchFeatures.map((t) => (
                                      <li key={t}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {data.analysis.productTraits && data.analysis.productTraits.length > 0 ? (
                                <div>
                                  <span className="text-slate-500">제품 특징:</span>
                                  <ul className="mt-1 list-inside list-disc text-slate-400">
                                    {data.analysis.productTraits.map((t) => (
                                      <li key={t}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {data.analysis.shoppingKeywords && data.analysis.shoppingKeywords.length > 0 ? (
                                <p>
                                  <span className="text-slate-500">쇼핑 키워드:</span>{" "}
                                  {data.analysis.shoppingKeywords.join(" · ")}
                                </p>
                              ) : null}
                              {data.analysis.adCopyLines && data.analysis.adCopyLines.length > 0 ? (
                                <div>
                                  <span className="text-slate-500">광고 문구 후보:</span>
                                  <ul className="mt-1 list-inside list-disc text-slate-400">
                                    {data.analysis.adCopyLines.map((t) => (
                                      <li key={t}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          </details>
                        )}

                        <div>
                          {PLATFORM_ORDER.some(
                            (pl) => (data.analysis.searchQueries?.[pl] || []).filter(Boolean).length > 0
                          ) ? (
                          <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-950/25">
                            <div className="min-w-0 p-3 text-xs">
                              <p className="mb-3 font-medium text-slate-400">추천 검색어 (각 8개)</p>
                              <div className="flex flex-row gap-3 pb-0.5">
                                {PLATFORM_ORDER.map((pl) => {
                                  const qs = (data.analysis.searchQueries?.[pl] || []).filter(Boolean)
                                  if (!qs.length) return null
                                  return (
                                    <div
                                      key={pl}
                                      className="flex min-w-[168px] max-w-[220px] shrink-0 flex-col rounded-lg border border-slate-700/90 bg-slate-900/50"
                                    >
                                      <div className="border-b border-slate-700 bg-slate-900/90 px-2 py-2 text-center font-medium text-slate-200">
                                        {platformLabelKo(pl)}
                                      </div>
                                      <div className="flex flex-col gap-1.5 p-2">
                                        {qs.map((term) => (
                                          <span
                                            key={`${pl}-${term}`}
                                            className="inline-flex min-w-0 items-center gap-0.5 rounded-md border border-slate-600 bg-slate-950/80 px-1.5 py-1 text-[11px] text-slate-200"
                                            title={term}
                                          >
                                            <button
                                              type="button"
                                              className="min-w-0 flex-1 truncate text-left hover:text-cyan-300"
                                              onClick={() =>
                                                window.open(platformSearchUrl(pl, term), "_blank", "noopener,noreferrer")
                                              }
                                            >
                                              {term}
                                            </button>
                                            <button
                                              type="button"
                                              className="shrink-0 p-0.5 text-slate-500 hover:text-cyan-300"
                                              title="플랫폼 검색 열기"
                                              onClick={() =>
                                                window.open(platformSearchUrl(pl, term), "_blank", "noopener,noreferrer")
                                              }
                                            >
                                              <ExternalLink className="h-3 w-3" />
                                            </button>
                                            <button
                                              type="button"
                                              className="shrink-0 p-0.5 text-slate-500 hover:text-cyan-300"
                                              title="검색어 복사"
                                              onClick={() => void navigator.clipboard.writeText(term)}
                                            >
                                              <Copy className="h-3 w-3" />
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                  </>
                )}

                {data &&
                  !loading &&
                  !!(
                    (data.keyframes && data.keyframes.length > 0) ||
                    (data.results && data.results.length > 0)
                  ) && (
                  <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/40">
                    <div className="flex flex-wrap gap-0 border-b border-slate-800">
                      <button
                        type="button"
                        className={cn(
                          "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                          discoverTab === "lens"
                            ? "border-cyan-500 text-cyan-400"
                            : "border-transparent text-slate-500 hover:text-slate-300"
                        )}
                        onClick={() => setDiscoverTab("lens")}
                      >
                        이미지로 영상 찾기
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                          discoverTab === "similar"
                            ? "border-cyan-500 text-cyan-400"
                            : "border-transparent text-slate-500 hover:text-slate-300"
                        )}
                        onClick={() => setDiscoverTab("similar")}
                      >
                        비슷한 영상 찾기
                      </button>
                    </div>

                    <div className="p-4">
                      <div className={discoverTab === "lens" ? "block" : "hidden"}>
                        {data.keyframes && data.keyframes.length > 0 ? (
                          <KeyframeSearchGrid
                            keyframes={data.keyframes}
                            serpApiKey={shotformSerpApiKey() || undefined}
                            onError={setErr}
                            onToast={setToast}
                          />
                        ) : (
                          <p className="py-10 text-center text-sm text-slate-500">
                            이미지 검색용 키프레임이 없습니다.
                          </p>
                        )}
                      </div>

                      <div className={discoverTab === "similar" ? "block" : "hidden"}>
                        {data.results && data.results.length > 0 ? (
                          <div className="space-y-4">
                              <div className="flex flex-wrap gap-0 border-b border-slate-800">
                                <button
                                  type="button"
                                  className={cn(
                                    "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                                    resultTab === "all"
                                      ? "border-cyan-500 text-cyan-400"
                                      : "border-transparent text-slate-500 hover:text-slate-300"
                                  )}
                                  onClick={() => setResultTab("all")}
                                >
                                  전체({counts.all ?? 0})
                                </button>
                                {RESULT_PLATFORM_ORDER.map((p) => (
                                  <button
                                    key={p}
                                    type="button"
                                    className={cn(
                                      "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                                      resultTab === p
                                        ? "border-cyan-500 text-cyan-400"
                                        : "border-transparent text-slate-500 hover:text-slate-300"
                                    )}
                                    onClick={() => setResultTab(p)}
                                  >
                                    {platformLabelKo(p)} ({counts[p] ?? 0})
                                  </button>
                                ))}
                              </div>

                              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                {filtered.map((item, idx) => {
                                  const mixKey = normalizeMixSourceUrl(item.url)
                                  const alreadyInMix = mixPickKeySet.has(mixKey)
                                  const mixFull = mixPicks.length >= MIX_SOURCE_MAX
                                  const addDisabled = alreadyInMix || (!alreadyInMix && mixFull)
                                  return (
                                    <div
                                      key={`${item.platform}-${idx}-${item.url}`}
                                      className="flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900/90"
                                    >
                                      <SearchResultCardMedia item={item} onPlayError={(msg) => setToast(msg)} />
                                      <div className="flex flex-1 flex-col gap-2 p-3">
                                        <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
                                        {item.author ? <p className="text-xs text-slate-500">{item.author}</p> : null}
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="mt-1 w-full border border-emerald-500/40 bg-emerald-700 font-medium text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50"
                                          disabled={addDisabled}
                                          onClick={() => addToMix(item)}
                                        >
                                          <Plus className="mr-1 h-4 w-4" />
                                          {alreadyInMix ? "선택됨" : "선택"}
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="h-9 w-full border border-sky-500/50 bg-sky-950/80 px-2 text-xs font-medium text-sky-100 hover:bg-sky-900/90"
                                          onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                                        >
                                          영상으로 이동
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-500">
                              <Film className="h-10 w-10 opacity-40" />
                              <p className="text-sm text-center">
                                결과가 없습니다. YouTube Data API 키가 있으면 쇼츠 검색 결과가 채워집니다.
                              </p>
                            </div>
                          )}
                          {data.results && data.results.length > 0 && filtered.length === 0 ? (
                            <p className="py-6 text-center text-sm text-slate-500">
                              이 플랫폼에는 표시할 영상이 없습니다. 다른 탭을 눌러 보세요.
                            </p>
                          ) : null}
                      </div>
                    </div>
                  </div>
                )}

                {data &&
                  (!data.results || data.results.length === 0) &&
                  !(data.keyframes && data.keyframes.length > 0) &&
                  !loading && (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 py-10 text-slate-500">
                      <Film className="h-10 w-10 opacity-40" />
                      <p className="text-sm">결과가 없습니다. YouTube Data API 키가 있으면 쇼츠 검색 결과가 채워집니다.</p>
                    </div>
                  )}
        </div>
      </div>

      {mixPicks.length > 0 ? (
        <div
          className={cn(
            "fixed bottom-0 right-0 z-[45] border-t border-slate-800 bg-[#070b14]/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.45)] backdrop-blur-md sm:px-6",
            embedded ? "left-[268px]" : "left-0"
          )}
        >
          <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="shrink-0 text-sm font-medium text-slate-300">
                추가 영상 {mixPicks.length}/{MIX_SOURCE_MAX}
              </span>
              <div className="flex min-w-0 flex-wrap gap-2">
                {mixPicks.map((p, idx) => (
                  <span
                    key={normalizeMixSourceUrl(p.url)}
                    className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-950/70 px-2.5 py-1 text-xs text-violet-100"
                  >
                    <span className="truncate">
                      {idx + 1}. {p.title}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded-full p-0.5 text-violet-300 hover:bg-violet-900/80 hover:text-white"
                      aria-label="추가 목록에서 제거"
                      onClick={() => removeMixPick(p.url)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white"
                onClick={clearMixPicks}
              >
                초기화
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(studio.btnPrimary, "px-4")}
                onClick={goShoppingFactoryStep}
              >
                다음 단계
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

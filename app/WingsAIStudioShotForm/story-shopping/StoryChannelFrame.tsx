"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"
import {
  ArrowLeft,
  Bell,
  Bookmark,
  Briefcase,
  EllipsisVertical,
  Flame,
  Heart,
  Home,
  Menu,
  MessageCircle,
  Newspaper,
  PenLine,
  Search,
  Send,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  Users,
  Video,
  Zap,
} from "lucide-react"
import type {
  StoryFrameSettings,
  StoryFrameTemplateId,
  StorySceneAsset,
  StoryScriptScene,
} from "./story-types"
import { StoryVideoMosaicLayer } from "./StoryVideoMosaicLayer"

function preloadStoryImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (!url) {
      resolve()
      return
    }
    const img = new Image()
    img.decoding = "async"
    const done = () => resolve()
    img.onload = done
    img.onerror = done
    img.src = url
    if (img.complete) done()
  })
}

function preloadStoryVideo(url: string, startSec = 0): Promise<void> {
  return new Promise((resolve) => {
    if (!url || typeof document === "undefined") {
      resolve()
      return
    }
    const video = document.createElement("video")
    video.muted = true
    video.playsInline = true
    video.preload = "auto"
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      video.removeAttribute("src")
      try {
        video.load()
      } catch {
        /* ignore */
      }
      resolve()
    }
    const timer = window.setTimeout(finish, 4000)
    video.onerror = () => {
      window.clearTimeout(timer)
      finish()
    }
    video.onloadeddata = () => {
      const target = Math.max(0, startSec)
      if (target > 0.04) {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked)
          window.clearTimeout(timer)
          finish()
        }
        video.addEventListener("seeked", onSeeked)
        try {
          video.currentTime = target
        } catch {
          window.clearTimeout(timer)
          finish()
        }
      } else {
        window.clearTimeout(timer)
        finish()
      }
    }
    video.src = url
  })
}

export function prefetchStoryMediaUrls(
  items: Array<{
    url: string
    mediaType?: "image" | "video"
    trimStartSec?: number
  }>
) {
  for (const item of items) {
    if (!item.url) continue
    if (item.mediaType === "video") {
      void preloadStoryVideo(item.url, item.trimStartSec || 0)
    } else {
      void preloadStoryImage(item.url)
    }
  }
}

export const DEFAULT_STORY_FRAME_SETTINGS: StoryFrameSettings = {
  templateId: "channel-search",
  channelName: "이야기 상점",
  videoTitle: "알고 나면 계속 생각나는 이야기",
  authorLabel: "익명",
  viewCountLabel: "177만",
  likeCountLabel: "938개",
  commentCountLabel: "199",
}

type StoryFrameVariant =
  | "search"
  | "pill"
  | "minimal"
  | "star"
  | "community"
  | "knowledge"
  | "dark"
  | "story"
  | "magazine"
  | "profile"
  | "emotion"
  | "cinema"
  | "heart"
  | "essay"
  | "impact"
  | "review"
  | "board"
  | "hot"
  | "best-comment"
  | "chat"
  | "office"
  | "breaking"
  | "webtoon"
  | "diary"

export const STORY_FRAME_TEMPLATES: Array<{
  id: StoryFrameTemplateId
  name: string
  description: string
  color: string
  foreground?: string
  variant: StoryFrameVariant
}> = [
  { id: "channel-search", name: "검색 바형", description: "뒤로가기·검색·메뉴", color: "#f7cf68", variant: "search" },
  { id: "channel-pill", name: "중앙 검색형", description: "강한 노란색 채널 헤더", color: "#ffc400", variant: "pill" },
  { id: "channel-minimal", name: "미니멀형", description: "차분한 크림색 헤더", color: "#f6e8bf", variant: "minimal" },
  { id: "channel-star", name: "즐겨찾기형", description: "파란색 헤더와 별 아이콘", color: "#8bc8ef", variant: "star" },
  { id: "channel-red", name: "커뮤니티형", description: "댓글을 강조한 빨간 헤더", color: "#d83e3e", foreground: "#ffffff", variant: "community" },
  { id: "channel-green", name: "지식 채널형", description: "연두색 정보형 헤더", color: "#add484", variant: "knowledge" },
  { id: "channel-dark", name: "다크 다큐형", description: "사건·미스터리에 맞는 검정 헤더", color: "#20242b", foreground: "#ffffff", variant: "dark" },
  { id: "channel-purple", name: "퍼플 스토리형", description: "반전·사연을 위한 보라색 헤더", color: "#7656d6", foreground: "#ffffff", variant: "story" },
  { id: "channel-orange", name: "오렌지 매거진형", description: "정보와 제품을 강조하는 매거진", color: "#f28b38", foreground: "#ffffff", variant: "magazine" },
  { id: "channel-mint", name: "민트 라이프형", description: "생활·건강에 어울리는 산뜻한 헤더", color: "#79d7c4", variant: "profile" },
  { id: "channel-lavender", name: "라벤더 감성형", description: "공감·힐링 이야기를 위한 감성형", color: "#c7b7ef", variant: "emotion" },
  { id: "channel-navy", name: "네이비 시네마형", description: "몰입도 높은 영상·다큐 스타일", color: "#243b64", foreground: "#ffffff", variant: "cinema" },
  { id: "channel-pink", name: "핑크 공감형", description: "관계·후기 중심의 따뜻한 헤더", color: "#f3a6b8", variant: "heart" },
  { id: "channel-paper", name: "페이퍼 에세이형", description: "차분한 기록과 에세이 분위기", color: "#e8dfcf", variant: "essay" },
  { id: "channel-neon", name: "네온 임팩트형", description: "첫 3초 훅을 강하게 보이는 헤더", color: "#c9f43b", variant: "impact" },
  { id: "channel-review", name: "리뷰 인증형", description: "실사용 후기와 신뢰를 강조하는 헤더", color: "#0f9f7a", foreground: "#ffffff", variant: "review" },
  { id: "channel-board", name: "익명 게시판형", description: "인기 사연 게시판의 익숙한 구성", color: "#23a6a8", foreground: "#ffffff", variant: "board" },
  { id: "channel-hot", name: "포텐 커뮤니티형", description: "반전·논란 썰에 강한 실시간 인기글", color: "#2563a8", foreground: "#ffffff", variant: "hot" },
  { id: "channel-best-comment", name: "댓글 베스트형", description: "댓글 반응과 공감 수치를 강조", color: "#f05a47", foreground: "#ffffff", variant: "best-comment" },
  { id: "channel-chat", name: "메신저 대화형", description: "연애·친구 대화 썰에 맞는 채팅형", color: "#f7dc48", variant: "chat" },
  { id: "channel-office", name: "직장인 익명형", description: "회사·상사·퇴사 사연용 익명 피드", color: "#ef6c35", foreground: "#ffffff", variant: "office" },
  { id: "channel-breaking", name: "속보 이슈형", description: "충격 사건과 긴급 반전을 즉시 강조", color: "#c9252d", foreground: "#ffffff", variant: "breaking" },
  { id: "channel-webtoon", name: "웹툰 말풍선형", description: "가볍고 빠른 전개의 캐릭터 사연", color: "#8b5cf6", foreground: "#ffffff", variant: "webtoon" },
  { id: "channel-diary", name: "1인칭 일기형", description: "감동·후회·고백에 어울리는 기록형", color: "#d9c7a5", variant: "diary" },
]

/** 이 글자 수 이상이면 3줄까지 허용 (짧으면 기본 2줄) */
const STORY_LONG_NARRATION_CHARS = 22
/** 한 줄 최대 글자 수 — 넘으면 더 잘게 나눔 (화면에 ... 잘림 방지) */
const STORY_MAX_CHARS_PER_LINE = 12
/** 한 줄이 너무 짧으면 앞 줄에 합침 */
const STORY_MIN_PHRASE_CHARS = 5
const STORY_MAX_LINES = 3

/**
 * 스토리 쇼핑 자막 — 의미 단위로 기본 2줄, 길면 최대 3줄.
 * 각 줄은 짧게 유지하고, TTS·미리보기는 이 순서(1→2→3)로 한 줄씩 재생합니다.
 */
export function splitNarrationIntoMeaningLines(narration: string): string[] {
  const text = narration.replace(/\s+/g, " ").trim()
  if (!text) return ["대본을 입력해주세요."]

  const phrases = splitIntoMeaningPhrases(text)
  const plainLen = text.replace(/\s/g, "").length
  const targetLines =
    plainLen >= STORY_LONG_NARRATION_CHARS || phrases.length >= 3
      ? STORY_MAX_LINES
      : 2

  let lines: string[]
  if (phrases.length >= 2) {
    lines = packPhrasesIntoLines(
      phrases,
      Math.min(targetLines, Math.max(2, Math.min(phrases.length, STORY_MAX_LINES)))
    )
  } else {
    const words = text.split(/\s+/).filter(Boolean)
    lines =
      words.length >= 2
        ? packPhrasesIntoLines(words, Math.min(targetLines, Math.min(words.length, STORY_MAX_LINES)))
        : splitDenseKorean(text, targetLines)
  }

  // 한 줄이 너무 길면 다시 쪼개고, 전체는 최대 3줄로 맞춤
  return finalizeMeaningLines(lines)
}

/** 너무 긴 줄을 추가 분할한 뒤 최대 3줄로 정리 */
function finalizeMeaningLines(lines: string[]): string[] {
  const expanded: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.replace(/\s/g, "").length <= STORY_MAX_CHARS_PER_LINE) {
      expanded.push(trimmed)
      continue
    }
    expanded.push(...splitDenseKorean(trimmed, trimmed.replace(/\s/g, "").length > 20 ? 3 : 2))
  }
  const merged = mergeTinyPhrases(expanded).filter(Boolean)
  if (merged.length <= STORY_MAX_LINES) return merged

  // 4줄 이상이면 뒤쪽을 합쳐 3줄로
  const head = merged.slice(0, STORY_MAX_LINES - 1)
  const tail = merged.slice(STORY_MAX_LINES - 1).join(" ").trim()
  return [...head, tail]
}

/** @deprecated → splitNarrationIntoMeaningLines 사용 */
export function splitNarrationIntoTwoLines(narration: string): [string, string] {
  const lines = splitNarrationIntoMeaningLines(narration)
  return [lines[0] || "", lines[1] || ""]
}

function splitIntoMeaningPhrases(text: string): string[] {
  const normalized = text
    .replace(/…+/g, "…")
    .replace(/\.{2,}/g, "…")

  const raw = normalized
    // 문장·쉼표·말줄임 단위 (구두점은 앞 구에 붙임). … 로 정규화한 뒤라 . 는 마침표만 남음
    .replace(/([.!?。！？,，、]|…)/g, "$1\u0001")
    // 한국어 연결 어미 뒤에서만 끊기
    .replace(
      /(는데|지만|면서|해서|니까|라도|거나|으며|하며|이고|하고|다가)\s+/g,
      "$1\u0001"
    )
    .split("\u0001")
    .map((part) => part.replace(/…/g, "").trim()) // 말줄임표는 화면·TTS에 넣지 않음
    .filter(Boolean)

  return mergeTinyPhrases(raw)
}

function mergeTinyPhrases(parts: string[]): string[] {
  const out: string[] = []
  for (const part of parts) {
    const plain = part.replace(/\s/g, "")
    if (!plain) continue
    if (plain.length < STORY_MIN_PHRASE_CHARS && out.length) {
      out[out.length - 1] = `${out[out.length - 1]} ${part}`.trim()
      continue
    }
    out.push(part)
  }
  return out
}

/** 의미 구를 N줄로 길이가 비슷하게 묶음 */
function packPhrasesIntoLines(phrases: string[], lineCount: number): string[] {
  const n = Math.max(1, Math.min(STORY_MAX_LINES, lineCount))
  if (phrases.length <= n) {
    // 구가 부족하면 가장 긴 줄을 다시 나눠 목표 줄 수에 맞춤
    if (phrases.length === 1 && n >= 2) {
      return splitDenseKorean(phrases[0], n)
    }
    if (phrases.length === 2 && n === 3) {
      const longest = phrases[0].length >= phrases[1].length ? 0 : 1
      const split = splitDenseKorean(phrases[longest], 2)
      return longest === 0
        ? [...split, phrases[1]].slice(0, 3)
        : [phrases[0], ...split].slice(0, 3)
    }
    return phrases
  }

  const totalLen = phrases.reduce((sum, p) => sum + p.replace(/\s/g, "").length, 0)
  const target = totalLen / n
  const lines: string[] = []
  let current = ""
  let currentLen = 0

  for (let i = 0; i < phrases.length; i += 1) {
    const phrase = phrases[i]
    const phraseLen = phrase.replace(/\s/g, "").length
    const remainingPhrases = phrases.length - i
    const linesLeft = n - lines.length

    const wouldExceed = currentLen > 0 && currentLen + phraseLen > target * 1.15
    const mustSaveForLater = remainingPhrases < linesLeft
    const shouldBreak =
      currentLen > 0 &&
      lines.length < n - 1 &&
      !mustSaveForLater &&
      (wouldExceed || remainingPhrases === linesLeft)

    if (shouldBreak) {
      lines.push(current.trim())
      current = phrase
      currentLen = phraseLen
    } else {
      current = current ? `${current} ${phrase}` : phrase
      currentLen += phraseLen
    }
  }
  if (current.trim()) lines.push(current.trim())

  // 초과 줄은 마지막에 합침, 부족하면 그대로
  while (lines.length > n) {
    const last = lines.pop()!
    lines[lines.length - 1] = `${lines[lines.length - 1]} ${last}`.trim()
  }
  return lines.filter(Boolean)
}

function splitDenseKorean(text: string, lineCount: number): string[] {
  const plain = text.replace(/\s+/g, " ").trim()
  if (!plain) return []
  const n = Math.max(1, Math.min(STORY_MAX_LINES, lineCount))
  if (n === 1 || plain.length <= STORY_MIN_PHRASE_CHARS * 2) return [plain]

  const cuts: number[] = []
  for (let line = 1; line < n; line += 1) {
    const ideal = Math.round((plain.length * line) / n)
    cuts.push(findBestCutIndex(plain, ideal))
  }
  const uniqueCuts = [...new Set(cuts)].sort((a, b) => a - b)
  const lines: string[] = []
  let start = 0
  for (const cut of uniqueCuts) {
    if (cut <= start || cut >= plain.length) continue
    lines.push(plain.slice(start, cut).trim())
    start = cut
  }
  lines.push(plain.slice(start).trim())
  return mergeTinyPhrases(lines.filter(Boolean)).slice(0, STORY_MAX_LINES)
}

function findBestCutIndex(text: string, ideal: number): number {
  const min = Math.max(STORY_MIN_PHRASE_CHARS, Math.floor(ideal - 6))
  const max = Math.min(text.length - STORY_MIN_PHRASE_CHARS, Math.ceil(ideal + 6))
  let best = ideal
  let bestScore = Infinity
  for (let i = min; i <= max; i += 1) {
    const ch = text[i - 1] || ""
    const score =
      Math.abs(i - ideal) +
      (/\s/.test(ch) ? -3 : 0) +
      (/[은는이가을를의에과와로도만]/.test(ch) ? -2 : 0) +
      (/[요죠네다]/.test(ch) ? -1 : 0)
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  }
  // 공백이면 공백 다음부터 다음 줄
  if (/\s/.test(text[best] || "")) return best + 1
  return best
}

export function StoryChannelFrame({
  settings,
  scene,
  asset,
  fallbackMediaUrl,
  isPlaying = false,
  textColor = "#000000",
  textScale = 1,
  textFontFamily = "Pretendard, Noto Sans KR, sans-serif",
  textFontWeight = 700,
  textBackgroundColor = "transparent",
  textOutlineWidth = 0,
  textOutlineColor = "#ffffff",
  subtitlePosition = "bottom",
  mediaBackgroundColor = "#c6c6c6",
  motionDurationSec,
  mediaEditable = false,
  onMediaTransformCommit,
  activeNarrationLine,
  narrationDisplayLines,
  prefetchMedia,
  className = "",
}: {
  settings: StoryFrameSettings
  scene: StoryScriptScene
  asset?: StorySceneAsset
  fallbackMediaUrl?: string
  isPlaying?: boolean
  textColor?: string
  textScale?: number
  textFontFamily?: string
  textFontWeight?: 400 | 600 | 700 | 900
  textBackgroundColor?: string
  textOutlineWidth?: number
  textOutlineColor?: string
  /** 자막 위치 — bottom=템플릿 밴드, top/center=미디어 위 오버레이 */
  subtitlePosition?: "top" | "center" | "bottom"
  mediaBackgroundColor?: string
  motionDurationSec?: number
  mediaEditable?: boolean
  onMediaTransformCommit?: (patch: {
    mediaScale: number
    mediaOffsetX: number
    mediaOffsetY: number
  }) => void
  /** TTS 줄 인덱스 — 설정 시 해당 줄만 표시 (한 줄씩 싱크) */
  activeNarrationLine?: number
  /** 자막 표시용 의미 단위 줄 (장면 통 TTS와 분리) */
  narrationDisplayLines?: string[]
  /** 다음 클립 미디어를 미리 로드해 전환 시 검정 화면을 막음 */
  prefetchMedia?: Array<{
    url: string
    mediaType?: "image" | "video"
    trimStartSec?: number
  }>
  className?: string
}) {
  const mediaUrl = asset?.mediaUrl || fallbackMediaUrl || ""
  const [isMediaSelected, setIsMediaSelected] = useState(false)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const [videoTimeSec, setVideoTimeSec] = useState(0)
  const [mediaStageSize, setMediaStageSize] = useState({ width: 280, height: 498 })
  // 다음 미디어가 준비될 때까지 이전 프레임을 유지 (클립 전환 검정 화면 방지)
  const [paintAsset, setPaintAsset] = useState<StorySceneAsset | undefined>(asset)
  const [paintUrl, setPaintUrl] = useState(mediaUrl)
  const paintUrlRef = useRef(mediaUrl)
  const paintMetaRef = useRef({
    mediaType: (asset?.mediaType === "video" ? "video" : "image") as
      | "image"
      | "video",
    fit: (asset?.mediaFit || "cover") as "cover" | "contain",
  })
  const [paintReady, setPaintReady] = useState(Boolean(mediaUrl))
  const [mediaTransform, setMediaTransform] = useState({
    mediaScale: asset?.mediaScale ?? 1,
    mediaOffsetX: asset?.mediaOffsetX ?? 0,
    mediaOffsetY: asset?.mediaOffsetY ?? 0,
  })
  const mediaTransformRef = useRef(mediaTransform)
  const mediaStageRef = useRef<HTMLElement | null>(null)
  const wheelCommitTimerRef = useRef<number | null>(null)
  mediaTransformRef.current = mediaTransform
  paintUrlRef.current = paintUrl
  paintMetaRef.current = {
    mediaType: paintAsset?.mediaType === "video" ? "video" : "image",
    fit: paintAsset?.mediaFit || "cover",
  }

  useEffect(() => {
    const next = {
      mediaScale: asset?.mediaScale ?? 1,
      mediaOffsetX: asset?.mediaOffsetX ?? 0,
      mediaOffsetY: asset?.mediaOffsetY ?? 0,
    }
    setMediaTransform(next)
    mediaTransformRef.current = next
  }, [
    paintUrl,
    asset?.mediaScale,
    asset?.mediaOffsetX,
    asset?.mediaOffsetY,
  ])

  useEffect(() => {
    setIsMediaSelected(false)
    setVideoElement(null)
    setVideoTimeSec(paintAsset?.trimStartSec || 0)
  }, [paintUrl, paintAsset?.trimStartSec])

  useEffect(() => {
    if (!mediaUrl) {
      setPaintAsset(asset)
      setPaintUrl("")
      setPaintReady(false)
      return
    }
    // 같은 소스면 메타만 즉시 반영
    if (mediaUrl === paintUrlRef.current) {
      setPaintAsset(asset)
      setPaintUrl(mediaUrl)
      setPaintReady(true)
      return
    }

    let cancelled = false
    const warm = async () => {
      if (asset?.mediaType === "video") {
        await preloadStoryVideo(mediaUrl, asset.trimStartSec || 0)
      } else {
        await preloadStoryImage(mediaUrl)
      }
      if (cancelled) return
      // preload 끝난 뒤에만 교체 → 검정 플래시·앞뒤 이미지 겹침 방지
      setPaintAsset(asset)
      setPaintUrl(mediaUrl)
      setPaintReady(true)
    }
    void warm()
    return () => {
      cancelled = true
    }
  }, [
    mediaUrl,
    asset,
    asset?.mediaType,
    asset?.trimStartSec,
    asset?.trimEndSec,
    asset?.motionEffect,
    asset?.mediaFit,
  ])

  useEffect(() => {
    if (!prefetchMedia?.length) return
    prefetchStoryMediaUrls(prefetchMedia)
  }, [prefetchMedia])

  useEffect(() => {
    if (!paintUrl || paintAsset?.mediaType === "video") return
    // 캐시된 이미지는 onLoad가 안 올 수 있어 즉시 ready 처리
    const probe = new Image()
    probe.src = paintUrl
    if (probe.complete && probe.naturalWidth > 0) {
      setPaintReady(true)
    }
  }, [paintUrl, paintAsset?.mediaType])

  useEffect(() => {
    const stage = mediaStageRef.current
    if (!stage) return
    const update = () => {
      const rect = stage.getBoundingClientRect()
      setMediaStageSize({ width: rect.width, height: rect.height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isMediaSelected) return

    const clearSelectionOutsideMedia = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !mediaStageRef.current?.contains(target)) {
        setIsMediaSelected(false)
      }
    }

    document.addEventListener("pointerdown", clearSelectionOutsideMedia)
    return () => {
      document.removeEventListener("pointerdown", clearSelectionOutsideMedia)
    }
  }, [isMediaSelected])

  useEffect(() => {
    return () => {
      if (wheelCommitTimerRef.current) {
        window.clearTimeout(wheelCommitTimerRef.current)
      }
    }
  }, [])

  const beginMediaDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!mediaEditable || !asset?.mediaUrl || !onMediaTransformCommit) return
    event.preventDefault()
    event.stopPropagation()
    setIsMediaSelected(true)
    const rect = event.currentTarget.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const initial = mediaTransformRef.current
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = "move"
    document.body.style.userSelect = "none"

    const onPointerMove = (moveEvent: PointerEvent) => {
      const next = {
        ...initial,
        mediaOffsetX: Math.max(
          -100,
          Math.min(100, initial.mediaOffsetX + ((moveEvent.clientX - startX) / rect.width) * 100)
        ),
        mediaOffsetY: Math.max(
          -100,
          Math.min(100, initial.mediaOffsetY + ((moveEvent.clientY - startY) / rect.height) * 100)
        ),
      }
      mediaTransformRef.current = next
      setMediaTransform(next)
    }
    const stopDrag = () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", stopDrag)
      window.removeEventListener("pointercancel", stopDrag)
      onMediaTransformCommit(mediaTransformRef.current)
    }
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", stopDrag)
    window.addEventListener("pointercancel", stopDrag)
  }

  const beginMediaResize = (
    event: ReactPointerEvent<HTMLSpanElement>,
    corner: "nw" | "ne" | "sw" | "se"
  ) => {
    if (!mediaEditable || !asset?.mediaUrl || !onMediaTransformCommit) return
    event.preventDefault()
    event.stopPropagation()
    setIsMediaSelected(true)
    const stage = event.currentTarget.closest<HTMLElement>(
      "[data-story-media-stage='true']"
    )
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const startDistance = Math.max(
      1,
      Math.hypot(event.clientX - centerX, event.clientY - centerY)
    )
    const initial = mediaTransformRef.current
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    const cursor = corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize"
    document.body.style.cursor = cursor
    document.body.style.userSelect = "none"

    const onPointerMove = (moveEvent: PointerEvent) => {
      const currentDistance = Math.max(
        1,
        Math.hypot(moveEvent.clientX - centerX, moveEvent.clientY - centerY)
      )
      const next = {
        ...initial,
        mediaScale: Math.max(
          0.5,
          Math.min(3, initial.mediaScale * (currentDistance / startDistance))
        ),
      }
      mediaTransformRef.current = next
      setMediaTransform(next)
    }
    const stopResize = () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", stopResize)
      window.removeEventListener("pointercancel", stopResize)
      onMediaTransformCommit(mediaTransformRef.current)
    }
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", stopResize)
    window.addEventListener("pointercancel", stopResize)
  }

  const zoomMedia = (event: ReactWheelEvent<HTMLElement>) => {
    if (!mediaEditable || !asset?.mediaUrl || !onMediaTransformCommit) return
    event.preventDefault()
    event.stopPropagation()
    setIsMediaSelected(true)
    const current = mediaTransformRef.current
    const next = {
      ...current,
      mediaScale: Math.max(
        0.5,
        Math.min(3, current.mediaScale * (event.deltaY < 0 ? 1.06 : 1 / 1.06))
      ),
    }
    mediaTransformRef.current = next
    setMediaTransform(next)
    if (wheelCommitTimerRef.current) window.clearTimeout(wheelCommitTimerRef.current)
    wheelCommitTimerRef.current = window.setTimeout(() => {
      onMediaTransformCommit(mediaTransformRef.current)
    }, 180)
  }

  const narrationLines = (
    narrationDisplayLines?.length
      ? narrationDisplayLines
      : splitNarrationIntoMeaningLines(scene.narration)
  )
    .map((line) => line.replace(/\.{2,}|…+/g, "").trim())
    .filter(Boolean)
  // 이쁜쇼핑형: 항상 한 줄만 표시 (TTS 줄 인덱스 순서대로 교체)
  const lineIndex = Math.min(
    narrationLines.length - 1,
    Math.max(0, activeNarrationLine ?? 0)
  )
  const visibleLine = narrationLines[lineIndex] || narrationLines[0] || ""
  const frameVariant =
    STORY_FRAME_TEMPLATES.find((template) => template.id === settings.templateId)
      ?.variant || "search"
  const primaryEffect =
    paintAsset?.motionEffect && paintAsset.motionEffect !== "none"
      ? paintAsset.motionEffect
      : ""
  const accentEffect =
    paintAsset?.motionAccentEffect && paintAsset.motionAccentEffect !== "none"
      ? paintAsset.motionAccentEffect
      : ""
  const mediaEffectClass = primaryEffect ? `story-media-${primaryEffect}` : ""
  const mediaAccentClass = accentEffect ? `story-media-${accentEffect}` : ""
  const effectDurationFor = (effect: string) =>
    effect === "shake"
      ? 0.5
      : effect === "pulse"
        ? 1
        : effect === "flash"
          ? 0.7
          : effect === "blur-in"
            ? 0.85
            : Math.max(0.8, motionDurationSec || scene.durationSec)
  const mediaEffectDurationSec = effectDurationFor(primaryEffect)
  const mediaAccentDurationSec = effectDurationFor(accentEffect)
  const captionOverlay = subtitlePosition === "top" || subtitlePosition === "center"
  const captionPanel = (
    <StoryCaptionPanel
      variant={frameVariant}
      text={visibleLine}
      textScale={textScale}
      color={captionOverlay ? "#ffffff" : textColor}
      fontFamily={textFontFamily}
      fontWeight={textFontWeight}
      backgroundColor={captionOverlay ? "transparent" : textBackgroundColor}
      outlineWidth={captionOverlay ? Math.max(textOutlineWidth || 0, 2) : textOutlineWidth}
      outlineColor={captionOverlay ? "#000000" : textOutlineColor}
      overlay={captionOverlay}
    />
  )

  return (
    <div
      className={`relative flex aspect-[9/16] flex-col overflow-hidden bg-white text-black shadow-2xl ${className}`}
      style={{ containerType: "inline-size" }}
    >
      <FrameHeader settings={settings} />

      <StoryPostPanel settings={settings} variant={frameVariant} />

      {/* 기본(하단): 템플릿 자막 밴드 · top/center는 미디어 위 오버레이 */}
      {!captionOverlay ? captionPanel : null}

      <section
        ref={mediaStageRef}
        data-story-media-stage="true"
        data-story-subtitle-position={subtitlePosition}
        className={`relative min-h-0 flex-1 overflow-hidden ${
          mediaEditable && asset?.mediaUrl ? "cursor-move touch-none" : ""
        }`}
        style={{ backgroundColor: mediaBackgroundColor }}
        onPointerDown={beginMediaDrag}
        onWheel={zoomMedia}
      >
        {paintUrl ? (
          <div
            className="relative h-full w-full"
            style={{
              transform: `translate(${mediaTransform.mediaOffsetX}%, ${mediaTransform.mediaOffsetY}%) scale(${mediaTransform.mediaScale})`,
              transformOrigin: "center",
            }}
          >
            <div
              key={`${paintUrl}-${primaryEffect || "none"}-${accentEffect || "none"}`}
              className={`relative z-10 h-full w-full ${mediaEffectClass}`}
              style={{
                animationDuration: `${mediaEffectDurationSec}s`,
                animationPlayState: isPlaying ? "running" : "paused",
              }}
            >
              <div
                className={`relative h-full w-full ${mediaAccentClass}`}
                style={
                  mediaAccentClass
                    ? {
                        animationDuration: `${mediaAccentDurationSec}s`,
                        animationPlayState: isPlaying ? "running" : "paused",
                      }
                    : undefined
                }
              >
              {paintAsset?.mediaType === "video" ? (
                <FrameVideo
                  key={`${paintUrl}-${paintAsset.trimStartSec ?? 0}-${paintAsset.trimEndSec ?? "end"}`}
                  src={paintUrl}
                  playing={isPlaying && paintUrl === mediaUrl && paintReady}
                  startSec={paintAsset.trimStartSec}
                  endSec={paintAsset.trimEndSec}
                  fit={paintAsset.mediaFit}
                  onElementChange={setVideoElement}
                  onTimeChange={setVideoTimeSec}
                  onReady={() => {
                    setPaintReady(true)
                  }}
                />
              ) : (
                <img
                  src={paintUrl}
                  alt=""
                  className="h-full w-full"
                  draggable={false}
                  style={{
                    objectFit: paintAsset?.mediaFit || "cover",
                  }}
                  onLoad={() => {
                    setPaintReady(true)
                  }}
                />
              )}
              {paintAsset?.mediaType === "video"
                ? (paintAsset.videoMosaics || [])
                    .filter((mosaic) => {
                      const localTime = Math.max(
                        0,
                        videoTimeSec - (paintAsset.trimStartSec || 0)
                      )
                      return localTime >= mosaic.startSec && localTime <= mosaic.endSec
                    })
                    .map((mosaic) => (
                      <StoryVideoMosaicLayer
                        key={mosaic.id}
                        video={videoElement}
                        mosaic={mosaic}
                        stageWidth={mediaStageSize.width}
                        stageHeight={mediaStageSize.height}
                        fit={paintAsset.mediaFit || "cover"}
                        playing={isPlaying && paintUrl === mediaUrl && paintReady}
                        videoTimeSec={videoTimeSec}
                      />
                    ))
                : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center bg-[#c6c6c6]">
            <span className="flex h-[38cqw] w-[38cqw] items-center justify-center rounded-full bg-[#444] text-white shadow-lg">
              <Video
                style={{
                  width: "22cqw",
                  height: "22cqw",
                  fill: "currentColor",
                  strokeWidth: 1.8,
                }}
              />
            </span>
          </div>
        )}
        {captionOverlay ? (
          <div
            data-story-caption-overlay="true"
            className={`pointer-events-none absolute inset-x-0 z-30 px-[4%] ${
              subtitlePosition === "top"
                ? "top-[3%]"
                : "top-1/2 -translate-y-1/2"
            }`}
          >
            <div className="rounded-[1.2cqw] bg-black/35 px-[3%] py-[2.5%] backdrop-blur-[1px]">
              {captionPanel}
            </div>
          </div>
        ) : null}
        {isMediaSelected && mediaEditable && asset?.mediaUrl ? (
          <div className="pointer-events-none absolute inset-1 z-20 border-[0.7cqw] border-blue-500 shadow-[0_0_0_0.45cqw_rgba(255,255,255,.85)]">
            {(
              [
                ["nw", "left-[-1.5cqw] top-[-1.5cqw] cursor-nwse-resize"],
                ["ne", "right-[-1.5cqw] top-[-1.5cqw] cursor-nesw-resize"],
                ["sw", "bottom-[-1.5cqw] left-[-1.5cqw] cursor-nesw-resize"],
                ["se", "bottom-[-1.5cqw] right-[-1.5cqw] cursor-nwse-resize"],
              ] as const
            ).map(([corner, position]) => (
              <span
                key={corner}
                onPointerDown={(event) => beginMediaResize(event, corner)}
                className={`pointer-events-auto absolute h-[3cqw] w-[3cqw] touch-none rounded-sm border-[0.45cqw] border-blue-600 bg-white ${position}`}
              />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}

function StoryPostPanel({
  settings,
  variant,
}: {
  settings: StoryFrameSettings
  variant: StoryFrameVariant
}) {
  const stats = (
    <>
      <span>조회 {settings.viewCountLabel}</span>
      <span>추천 {settings.likeCountLabel}</span>
      <span>댓글 {settings.commentCountLabel}</span>
    </>
  )

  if (variant === "board") {
    return (
      <section className="shrink-0 border-b-[0.35cqw] border-[#c9dfe0] bg-white px-[7%] py-[3.5%]">
        <div className="mb-[2cqw] flex items-center justify-between text-[#168487]" style={{ fontSize: "2.3cqw" }}>
          <strong>오늘의 익명 사연</strong>
          <span>일상 · 인기</span>
        </div>
        <AutoFitTitle text={settings.videoTitle} />
        <div className="mt-[2.5cqw] flex items-center gap-[2cqw] text-[#7c8b8c]" style={{ fontSize: "2.3cqw" }}>
          <strong className="text-[#354748]">{settings.authorLabel}</strong>
          <span className="ml-auto">조회 {settings.viewCountLabel}</span>
          <span>공감 {settings.likeCountLabel}</span>
        </div>
      </section>
    )
  }

  if (variant === "hot") {
    return (
      <section className="shrink-0 border-b-[0.5cqw] border-[#f59e0b] bg-[#171a1f] px-[7%] py-[3.5%] text-white">
        <div className="mb-[2cqw] flex items-center gap-[1.5cqw]" style={{ fontSize: "2.4cqw" }}>
          <span className="rounded-[0.8cqw] bg-[#f59e0b] px-[1.5cqw] py-[0.6cqw] font-black text-black">POTEN</span>
          <span className="text-[#aab2c0]">실시간 화제</span>
        </div>
        <AutoFitTitle text={settings.videoTitle} />
        <div className="mt-[2.5cqw] flex gap-[2.5cqw] font-bold text-[#8f9bad]" style={{ fontSize: "2.3cqw" }}>
          {stats}
        </div>
      </section>
    )
  }

  if (variant === "best-comment") {
    return (
      <section className="shrink-0 bg-[#fff8f6] px-[7%] py-[3.5%]">
        <div className="mb-[2cqw] flex items-center justify-between">
          <span className="rounded-full bg-[#f05a47] px-[2cqw] py-[0.7cqw] font-black text-white" style={{ fontSize: "2.3cqw" }}>
            댓글이 난리 난 글
          </span>
          <span className="text-[#a06860]" style={{ fontSize: "2.2cqw" }}>BEST</span>
        </div>
        <AutoFitTitle text={settings.videoTitle} />
        <div className="mt-[2.5cqw] flex items-center gap-[2cqw] border-t-[0.3cqw] border-[#f0d8d2] pt-[2cqw] text-[#a06d65]" style={{ fontSize: "2.3cqw" }}>
          <span>공감 ♥ {settings.likeCountLabel}</span>
          <span className="ml-auto">댓글 {settings.commentCountLabel}</span>
        </div>
      </section>
    )
  }

  if (variant === "chat") {
    return (
      <section className="shrink-0 bg-[#b8cad8] px-[7%] py-[3.5%] text-center">
        <span className="inline-block rounded-full bg-black/15 px-[2.5cqw] py-[0.8cqw] text-white" style={{ fontSize: "2.2cqw" }}>
          오늘
        </span>
        <div className="mt-[2cqw] rounded-[2cqw] bg-white/85 px-[4cqw] py-[2.5cqw] text-left shadow-sm">
          <div className="mb-[1.5cqw] flex items-center gap-[1.5cqw] text-[#63717b]" style={{ fontSize: "2.2cqw" }}>
            <span className="h-[4cqw] w-[4cqw] rounded-full bg-[#f7dc48]" />
            <strong>{settings.authorLabel}</strong>
            <span className="ml-auto">방금</span>
          </div>
          <AutoFitTitle text={settings.videoTitle} />
        </div>
      </section>
    )
  }

  if (variant === "office") {
    return (
      <section className="shrink-0 bg-[#f2f3f5] px-[6%] py-[3.5%]">
        <div className="rounded-[1.5cqw] bg-white px-[4cqw] py-[3cqw] shadow-[0_0.5cqw_2cqw_rgba(0,0,0,.08)]">
          <div className="mb-[2cqw] flex items-center gap-[1.5cqw]" style={{ fontSize: "2.3cqw" }}>
            <span className="flex h-[5cqw] w-[5cqw] items-center justify-center rounded-full bg-[#ef6c35] font-black text-white">B</span>
            <span>
              <strong className="block">회사원 · 익명</strong>
              <span className="text-[#9a9da3]">방금 전</span>
            </span>
          </div>
          <AutoFitTitle text={settings.videoTitle} />
          <div className="mt-[2.5cqw] flex gap-[2.5cqw] text-[#858990]" style={{ fontSize: "2.2cqw" }}>{stats}</div>
        </div>
      </section>
    )
  }

  if (variant === "breaking") {
    return (
      <section className="shrink-0 border-b-[1cqw] border-[#c9252d] bg-white px-[6%] py-[3.5%]">
        <div className="mb-[2cqw] flex items-center gap-[2cqw]">
          <span className="bg-[#c9252d] px-[2cqw] py-[0.8cqw] font-black text-white" style={{ fontSize: "2.5cqw" }}>단독</span>
          <span className="font-bold text-[#777]" style={{ fontSize: "2.3cqw" }}>지금 가장 뜨거운 이야기</span>
        </div>
        <AutoFitTitle text={settings.videoTitle} />
        <div className="mt-[2.5cqw] flex justify-between text-[#888]" style={{ fontSize: "2.2cqw" }}>
          <span>{settings.authorLabel} 제보</span>
          <span>조회 {settings.viewCountLabel}</span>
        </div>
      </section>
    )
  }

  if (variant === "webtoon") {
    return (
      <section
        className="shrink-0 border-b-[0.7cqw] border-black px-[6%] py-[3.5%]"
        style={{ backgroundColor: "#fffdf3", backgroundImage: "radial-gradient(#d5cce8 0.8cqw, transparent 0.8cqw)", backgroundSize: "4cqw 4cqw" }}
      >
        <div className="rotate-[-0.5deg] border-[0.7cqw] border-black bg-white px-[4cqw] py-[3cqw] shadow-[1.5cqw_1.5cqw_0_#f5c842]">
          <div className="mb-[1.5cqw] font-black text-[#8b5cf6]" style={{ fontSize: "2.4cqw" }}>EP. 오늘의 황당한 썰</div>
          <AutoFitTitle text={settings.videoTitle} />
        </div>
      </section>
    )
  }

  if (variant === "diary") {
    return (
      <section
        className="shrink-0 border-b-[0.35cqw] border-[#b9a98d] px-[8%] py-[4%]"
        style={{ backgroundColor: "#f8f0df", backgroundImage: "repeating-linear-gradient(transparent, transparent 5.5cqw, rgba(126,105,72,.12) 5.8cqw)" }}
      >
        <div className="mb-[2cqw] flex justify-between font-bold text-[#8a7659]" style={{ fontFamily: "'Noto Serif KR', serif", fontSize: "2.3cqw" }}>
          <span>{settings.authorLabel}의 기록</span>
          <span>오늘, 맑음</span>
        </div>
        <div style={{ fontFamily: "'Noto Serif KR', serif" }}>
          <AutoFitTitle text={settings.videoTitle} />
        </div>
        <div className="mt-[2.5cqw] text-right text-[#9b8768]" style={{ fontSize: "2.2cqw" }}>조회 {settings.viewCountLabel}</div>
      </section>
    )
  }

  return (
    <section className="shrink-0 border-b-[0.4cqw] border-black bg-white px-[8%] py-[3%]">
      <AutoFitTitle text={settings.videoTitle} />
      <div className="mt-[3%] flex items-center gap-[1.2cqw] truncate font-bold text-[#999]" style={{ fontSize: "2.4cqw" }}>
        {settings.templateId === "channel-red" ? (
          <>
            <span>조회수 {settings.viewCountLabel}</span>
            <span>| 좋아요 {settings.likeCountLabel}</span>
            <span className="ml-auto border border-[#bbb] px-[1.5cqw] py-[0.5cqw] text-[#c64343]">댓글 {settings.commentCountLabel}</span>
          </>
        ) : (
          <>
            {settings.templateId === "channel-pill" || settings.templateId === "channel-minimal" ? <span>{settings.authorLabel} |</span> : null}
            <span>조회수 {settings.viewCountLabel}</span>
            {settings.templateId !== "channel-minimal" ? <span>| 좋아요 {settings.likeCountLabel}</span> : null}
          </>
        )}
      </div>
    </section>
  )
}

function StoryCaptionPanel({
  variant,
  text,
  textScale,
  color,
  fontFamily,
  fontWeight,
  backgroundColor,
  outlineWidth,
  outlineColor,
  overlay = false,
}: {
  variant: StoryFrameVariant
  text: string
  textScale: number
  color: string
  fontFamily: string
  fontWeight: 400 | 600 | 700 | 900
  backgroundColor: string
  outlineWidth: number
  outlineColor: string
  /** 미디어 위 오버레이 — 템플릿 밴드 스타일 없이 텍스트만 */
  overlay?: boolean
}) {
  const darkBackground = variant === "hot" || variant === "breaking"
  const effectiveColor = darkBackground && color === "#000000" ? "#ffffff" : color
  const caption = (
    <AutoFitCaption
      text={text}
      textScale={textScale}
      color={effectiveColor}
      fontFamily={variant === "diary" ? "'Noto Serif KR', serif" : fontFamily}
      fontWeight={fontWeight}
      backgroundColor={backgroundColor}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor}
    />
  )

  if (overlay) {
    return <div className="w-full">{caption}</div>
  }

  if (variant === "board") {
    return <section className="flex shrink-0 items-center border-l-[2cqw] border-[#23a6a8] bg-[#eefafa] px-[6%] py-[4%]">{caption}</section>
  }
  if (variant === "hot") {
    return <section className="flex shrink-0 items-center border-b-[0.35cqw] border-[#333944] bg-[#20242b] px-[7%] py-[4%]">{caption}</section>
  }
  if (variant === "best-comment") {
    return (
      <section className="shrink-0 bg-[#fff1ed] px-[6%] py-[3.5%]">
        <div className="rounded-[2cqw] border-[0.35cqw] border-[#f5b8aa] bg-white px-[3cqw] py-[2.5cqw] shadow-sm">
          <div className="mb-[1cqw] font-black text-[#f05a47]" style={{ fontSize: "2.2cqw" }}>베스트 댓글</div>
          {caption}
        </div>
      </section>
    )
  }
  if (variant === "chat") {
    return (
      <section className="flex shrink-0 items-start gap-[2cqw] bg-[#b8cad8] px-[6%] py-[3.5%]">
        <span className="flex h-[7cqw] w-[7cqw] shrink-0 items-center justify-center rounded-full bg-white font-black" style={{ fontSize: "3cqw" }}>나</span>
        <div className="relative min-w-0 flex-1 rounded-[1.8cqw] bg-white px-[2cqw] py-[2.5cqw] shadow-sm">
          {caption}
          <span className="absolute -left-[1.2cqw] top-[2cqw] h-0 w-0 border-y-[1.2cqw] border-r-[1.8cqw] border-y-transparent border-r-white" />
        </div>
      </section>
    )
  }
  if (variant === "office") {
    return (
      <section className="shrink-0 bg-[#f2f3f5] px-[6%] py-[3.5%]">
        <div className="rounded-[1.5cqw] border-l-[1.2cqw] border-[#ef6c35] bg-white px-[3cqw] py-[2.5cqw] shadow-sm">{caption}</div>
      </section>
    )
  }
  if (variant === "breaking") {
    return (
      <section className="flex shrink-0 items-center bg-[#c9252d] px-[5%] py-[3.5%]">
        <span className="mr-[2cqw] shrink-0 border-r border-white/40 pr-[2cqw] font-black text-white" style={{ fontSize: "2.5cqw" }}>핵심</span>
        {caption}
      </section>
    )
  }
  if (variant === "webtoon") {
    return (
      <section className="shrink-0 bg-[#fffdf3] px-[6%] py-[3.5%]">
        <div className="rounded-[45%] border-[0.7cqw] border-black bg-white px-[5cqw] py-[3cqw] shadow-[1cqw_1cqw_0_#8b5cf6]">{caption}</div>
      </section>
    )
  }
  if (variant === "diary") {
    return (
      <section className="shrink-0 bg-[#f8f0df] px-[7%] py-[4%]">
        <div className="border-y-[0.3cqw] border-[#c9b998] py-[2.5cqw]">{caption}</div>
      </section>
    )
  }
  return <section className="flex shrink-0 items-center justify-center bg-white px-[7%] py-[3.5%]">{caption}</section>
}

function AutoFitTitle({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [fontCqw, setFontCqw] = useState(5.0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const fit = () => {
      const max = 5.0
      const min = 2.4
      let size = max
      el.style.fontSize = `${size}cqw`
      el.style.whiteSpace = "nowrap"

      // 컨테이너 너비에 맞을 때까지 글자 크기를 줄입니다.
      let guard = 0
      while (el.scrollWidth > el.clientWidth + 1 && size > min && guard < 80) {
        size = Math.max(min, size - 0.12)
        el.style.fontSize = `${size}cqw`
        guard += 1
      }
      setFontCqw(Number(size.toFixed(2)))
    }

    fit()
    const parent = el.parentElement
    if (!parent) return
    const observer = new ResizeObserver(() => fit())
    observer.observe(parent)
    return () => observer.disconnect()
  }, [text])

  return (
    <p
      ref={ref}
      className="w-full overflow-hidden whitespace-nowrap font-black leading-none"
      style={{ fontSize: `${fontCqw}cqw` }}
      title={text}
    >
      {text}
    </p>
  )
}

/** 자막 한 줄 — truncate(...) 없이 글자 크기만 줄여 전체가 보이게 */
function AutoFitCaption({
  text,
  textScale = 1,
  color,
  fontFamily,
  fontWeight,
  backgroundColor,
  outlineWidth,
  outlineColor,
}: {
  text: string
  textScale?: number
  color: string
  fontFamily: string
  fontWeight: 400 | 600 | 700 | 900
  backgroundColor: string
  outlineWidth: number
  outlineColor: string
}) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [fontCqw, setFontCqw] = useState(5.2 * textScale)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const fit = () => {
      const max = 5.2 * textScale
      const min = 2.8 * Math.min(1, textScale)
      let size = max
      el.style.fontSize = `${size}cqw`
      el.style.whiteSpace = "nowrap"

      if (el.scrollWidth > el.clientWidth + 1) {
        let low = min
        let high = max
        // 선형 반복 대신 이진 탐색으로 레이아웃 측정 횟수를 줄입니다.
        for (let index = 0; index < 7; index += 1) {
          const middle = (low + high) / 2
          el.style.fontSize = `${middle}cqw`
          if (el.scrollWidth <= el.clientWidth + 1) low = middle
          else high = middle
        }
        size = low
        el.style.fontSize = `${size}cqw`
      }
      setFontCqw(Number(size.toFixed(2)))
    }

    fit()
    const parent = el.parentElement
    if (!parent) return
    const observer = new ResizeObserver(() => fit())
    observer.observe(parent)
    return () => observer.disconnect()
  }, [text, textScale])

  return (
    <p
      ref={ref}
      key={text}
      className="w-full overflow-hidden whitespace-nowrap text-center leading-none tracking-tight"
      style={{ fontSize: `${fontCqw}cqw`, color, fontFamily, fontWeight }}
      title={text}
    >
      <span
        className="inline-block rounded-[1.2cqw] px-[1.5cqw] py-[0.8cqw]"
        style={{
          backgroundColor,
          WebkitTextStroke:
            outlineWidth > 0 ? `${outlineWidth * 0.12}cqw ${outlineColor}` : undefined,
          paintOrder: "stroke fill",
        }}
      >
        {text}
      </span>
    </p>
  )
}

function FrameVideo({
  src,
  playing,
  startSec = 0,
  endSec,
  fit = "cover",
  onElementChange,
  onTimeChange,
  onReady,
}: {
  src: string
  playing: boolean
  startSec?: number
  endSec?: number
  fit?: "cover" | "contain"
  onElementChange?: (video: HTMLVideoElement | null) => void
  onTimeChange?: (timeSec: number) => void
  onReady?: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(true)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    // 이전 프레임이 유지된 상태에서 교체되므로, 로드 전에도 숨기지 않음
    setReady(true)
    onElementChange?.(ref.current)
    return () => onElementChange?.(null)
  }, [onElementChange, src])

  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (playing && ready) void video.play().catch(() => undefined)
    else video.pause()
  }, [playing, src, startSec, endSec, ready])

  const markReady = () => {
    setReady(true)
    onReadyRef.current?.()
  }

  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="auto"
      className="h-full w-full"
      style={{ objectFit: fit, opacity: 1 }}
      onLoadedData={(event) => {
        const video = event.currentTarget
        const target = Math.max(0, startSec)
        if (target > 0.04 && Math.abs(video.currentTime - target) > 0.08) {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked)
            markReady()
            onTimeChange?.(video.currentTime)
            if (playing) void video.play().catch(() => undefined)
          }
          video.addEventListener("seeked", onSeeked)
          video.currentTime = target
        } else {
          markReady()
          onTimeChange?.(video.currentTime || target)
          if (playing) void video.play().catch(() => undefined)
        }
      }}
      onLoadedMetadata={(event) => {
        event.currentTarget.currentTime = Math.max(0, startSec)
        onTimeChange?.(Math.max(0, startSec))
      }}
      onTimeUpdate={(event) => {
        if (endSec != null && event.currentTarget.currentTime >= endSec) {
          event.currentTarget.currentTime = Math.max(0, startSec)
          onTimeChange?.(Math.max(0, startSec))
          if (playing) void event.currentTarget.play().catch(() => undefined)
          else event.currentTarget.pause()
          return
        }
        onTimeChange?.(event.currentTarget.currentTime)
      }}
      onEnded={(event) => {
        event.currentTarget.currentTime = Math.max(0, startSec)
        onTimeChange?.(Math.max(0, startSec))
        if (playing) void event.currentTarget.play().catch(() => undefined)
      }}
    />
  )
}

function FrameHeader({ settings }: { settings: StoryFrameSettings }) {
  const commonIconStyle = { width: "6.5cqw", height: "6.5cqw", strokeWidth: 3 }
  const template = STORY_FRAME_TEMPLATES.find((item) => item.id === settings.templateId)
  const background = template?.color || "#f7cf68"
  const foreground = template?.foreground || "#000000"
  const variant = template?.variant || "search"
  const channelName = (
    <strong className="truncate px-[3%]" style={{ fontSize: "6.5cqw" }}>
      {settings.channelName}
    </strong>
  )

  return (
    <header
      className="flex shrink-0 items-center justify-between px-[5%] py-[3.5%]"
      style={{ backgroundColor: background, color: foreground }}
    >
      {variant === "search" ? (
        <>
          <ArrowLeft style={commonIconStyle} />
          <ChannelPill name={settings.channelName} />
          <Menu style={commonIconStyle} />
        </>
      ) : variant === "pill" ? (
        <>
          <span className="w-[8cqw]" />
          <ChannelPill name={settings.channelName} />
          <span className="w-[8cqw]" />
        </>
      ) : variant === "minimal" ? (
        <>
          <ArrowLeft style={commonIconStyle} />
          {channelName}
          <EllipsisVertical style={commonIconStyle} />
        </>
      ) : variant === "star" ? (
        <>
          <Menu style={commonIconStyle} />
          {channelName}
          <Star style={{ ...commonIconStyle, fill: "currentColor" }} />
        </>
      ) : variant === "community" ? (
        <>
          <UserRound style={commonIconStyle} />
          {channelName}
          <Menu style={commonIconStyle} />
        </>
      ) : variant === "knowledge" ? (
        <>
          <Search style={{ ...commonIconStyle, color: "#777" }} />
          {channelName}
          <Menu style={{ ...commonIconStyle, color: "#777" }} />
        </>
      ) : variant === "dark" ? (
        <>
          <Menu style={commonIconStyle} />
          <span className="flex min-w-0 items-center gap-[2cqw]">
            <span className="h-[2cqw] w-[2cqw] rounded-full bg-red-500" />
            {channelName}
          </span>
          <Search style={commonIconStyle} />
        </>
      ) : variant === "story" ? (
        <>
          <Sparkles style={commonIconStyle} />
          <ChannelPill name={settings.channelName} />
          <Bell style={commonIconStyle} />
        </>
      ) : variant === "magazine" ? (
        <>
          <strong
            className="rounded-[1.2cqw] border-[0.45cqw] border-current px-[1.5cqw] py-[0.7cqw]"
            style={{ fontSize: "3.4cqw" }}
          >
            STORY
          </strong>
          {channelName}
          <Menu style={commonIconStyle} />
        </>
      ) : variant === "profile" ? (
        <>
          <span className="flex h-[8cqw] w-[8cqw] items-center justify-center rounded-full bg-white/70">
            <UserRound style={{ width: "5cqw", height: "5cqw", strokeWidth: 2.7 }} />
          </span>
          {channelName}
          <Bell style={commonIconStyle} />
        </>
      ) : variant === "emotion" ? (
        <>
          <Sparkles style={commonIconStyle} />
          {channelName}
          <Heart style={{ ...commonIconStyle, fill: "currentColor" }} />
        </>
      ) : variant === "cinema" ? (
        <>
          <Home style={commonIconStyle} />
          <span className="truncate px-[3%] font-black tracking-[0.08em]" style={{ fontSize: "5.5cqw" }}>
            {settings.channelName}
          </span>
          <Bookmark style={{ ...commonIconStyle, fill: "currentColor" }} />
        </>
      ) : variant === "heart" ? (
        <>
          <Heart style={{ ...commonIconStyle, fill: "currentColor" }} />
          {channelName}
          <MessageCircle style={commonIconStyle} />
        </>
      ) : variant === "essay" ? (
        <>
          <ArrowLeft style={commonIconStyle} />
          <span
            className="truncate px-[3%] font-bold"
            style={{ fontFamily: "'Noto Serif KR', serif", fontSize: "6.2cqw" }}
          >
            {settings.channelName}
          </span>
          <EllipsisVertical style={commonIconStyle} />
        </>
      ) : variant === "review" ? (
        <>
          <MessageCircle style={{ ...commonIconStyle, fill: "rgba(255,255,255,.18)" }} />
          {channelName}
          <Star style={{ ...commonIconStyle, fill: "currentColor" }} />
        </>
      ) : variant === "board" ? (
        <>
          <Users style={commonIconStyle} />
          <span className="truncate px-[3%] font-black" style={{ fontSize: "6cqw" }}>
            {settings.channelName}
          </span>
          <Menu style={commonIconStyle} />
        </>
      ) : variant === "hot" ? (
        <>
          <Flame style={{ ...commonIconStyle, fill: "#ffb020", color: "#ffb020" }} />
          <span className="flex min-w-0 flex-col px-[2%] leading-none">
            <strong className="truncate" style={{ fontSize: "5.5cqw" }}>
              {settings.channelName}
            </strong>
            <span className="mt-[1cqw] font-bold text-blue-100" style={{ fontSize: "2.3cqw" }}>
              실시간 인기글
            </span>
          </span>
          <Search style={commonIconStyle} />
        </>
      ) : variant === "best-comment" ? (
        <>
          <Trophy style={{ ...commonIconStyle, fill: "rgba(255,255,255,.22)" }} />
          <span className="truncate px-[3%] font-black" style={{ fontSize: "5.8cqw" }}>
            베스트 · {settings.channelName}
          </span>
          <MessageCircle style={commonIconStyle} />
        </>
      ) : variant === "chat" ? (
        <>
          <ArrowLeft style={commonIconStyle} />
          <span className="flex min-w-0 flex-col items-center leading-none">
            <strong className="truncate" style={{ fontSize: "5.8cqw" }}>
              {settings.channelName}
            </strong>
            <span className="mt-[1cqw] text-[#796b13]" style={{ fontSize: "2.2cqw" }}>
              대화 중
            </span>
          </span>
          <Send style={commonIconStyle} />
        </>
      ) : variant === "office" ? (
        <>
          <Briefcase style={{ ...commonIconStyle, fill: "rgba(255,255,255,.2)" }} />
          <span className="flex min-w-0 items-center gap-[2cqw]">
            {channelName}
            <span
              className="shrink-0 rounded-full border border-white/60 px-[1.3cqw] py-[0.5cqw] font-black"
              style={{ fontSize: "2.2cqw" }}
            >
              익명
            </span>
          </span>
          <Bell style={commonIconStyle} />
        </>
      ) : variant === "breaking" ? (
        <>
          <Newspaper style={commonIconStyle} />
          <span className="flex min-w-0 items-center gap-[2cqw]">
            <span
              className="shrink-0 bg-white px-[1.4cqw] py-[0.6cqw] font-black text-[#c9252d]"
              style={{ fontSize: "2.5cqw" }}
            >
              속보
            </span>
            <strong className="truncate" style={{ fontSize: "5.3cqw" }}>
              {settings.channelName}
            </strong>
          </span>
          <Menu style={commonIconStyle} />
        </>
      ) : variant === "webtoon" ? (
        <>
          <MessageCircle style={{ ...commonIconStyle, fill: "white", color: "white" }} />
          <strong
            className="-rotate-1 truncate rounded-[1.5cqw] border-[0.5cqw] border-white bg-black/15 px-[3cqw] py-[1.2cqw]"
            style={{ fontSize: "5.5cqw" }}
          >
            {settings.channelName}
          </strong>
          <Sparkles style={commonIconStyle} />
        </>
      ) : variant === "diary" ? (
        <>
          <PenLine style={commonIconStyle} />
          <span
            className="truncate px-[3%] font-bold"
            style={{ fontFamily: "'Noto Serif KR', serif", fontSize: "5.8cqw" }}
          >
            오늘의 기록 · {settings.channelName}
          </span>
          <Bookmark style={commonIconStyle} />
        </>
      ) : (
        <>
          <Zap style={{ ...commonIconStyle, fill: "currentColor" }} />
          <span className="-skew-x-6 truncate px-[3%] font-black" style={{ fontSize: "6.5cqw" }}>
            {settings.channelName}
          </span>
          <Search style={commonIconStyle} />
        </>
      )}
    </header>
  )
}

function ChannelPill({ name }: { name: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-[3%] rounded-full border-[0.7cqw] border-black bg-white px-[6%] py-[2.5%]">
      <strong className="truncate" style={{ fontSize: "6cqw" }}>
        {name}
      </strong>
      <Search className="shrink-0" style={{ width: "6cqw", height: "6cqw", strokeWidth: 3 }} />
    </div>
  )
}

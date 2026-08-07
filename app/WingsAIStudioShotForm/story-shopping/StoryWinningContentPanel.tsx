"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ExternalLink,
  FolderOpen,
  Info,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type {
  ChannelGroup,
  GroupChannel,
} from "../channel-analysis/lib/types"
import {
  createChannelGroup,
  loadChannelGroups,
  saveChannelGroups,
  upsertGroupChannel,
} from "../channel-analysis/lib/groups-storage"
import { formatCount, getYoutubeApiKey } from "../channel-analysis/lib/types"
import type { StoryWinningContent } from "./story-types"
import {
  listUserChannelGroups,
  upsertUserChannelGroup,
  deleteUserChannelGroup,
  saveUserStoryChannelsForGroup,
  type FixedStoryGroupKey,
  type UserStoryChannelsMap,
} from "./user-channels-actions"

const FIXED_GROUPS = [
  { key: "shopping", name: "쇼핑형", description: "제품 시연·리뷰·문제 해결" },
  { key: "story-shopping", name: "이야기 쇼핑형", description: "사연·반전·상품 연결" },
  { key: "instagram", name: "인스타형", description: "감각적 연출·짧은 리액션" },
] as const
const LEGACY_FIXED_GROUP_NAMES = new Set(["썰쇼핑형"])
const isFixedGroupName = (name: string) =>
  FIXED_GROUPS.some((group) => group.name === name.trim()) ||
  LEGACY_FIXED_GROUP_NAMES.has(name.trim())

const DEFAULT_SHOPPING_CHANNELS = [
  "https://www.youtube.com/@%EC%9E%90%EC%B7%A8%EC%82%B4%EB%A6%BC%EB%B0%B1%EC%84%9C",
  "https://www.youtube.com/@dailyhoneyitem",
  "https://www.youtube.com/@%EC%82%B4%EB%A6%BC%EB%82%A8",
  "https://www.youtube.com/@%EC%82%B4%EB%A6%BC%ED%85%9C%ED%94%8C%EB%9F%AC%EC%8A%A4",
  "https://www.youtube.com/@%ED%99%88%EC%9E%87Y",
  "https://www.youtube.com/@Homestory_official",
  "https://www.youtube.com/@%EB%B0%A9%EA%B5%AC%EC%84%9D%EC%82%B4%EB%A6%BC",
  "https://www.youtube.com/@%ED%99%88%ED%8C%81_hometip",
  "https://www.youtube.com/@sallimplus",
  "https://www.youtube.com/@Salim_Factory",
  "https://www.youtube.com/@good_use_zip",
  "https://www.youtube.com/@eoohome",
  "https://www.youtube.com/@jamjam_sallim",
  "https://www.youtube.com/@%EC%82%B4%EB%A6%BC%EB%B0%95%EC%8A%A4",
  "https://www.youtube.com/@gamsung_salim",
  "https://www.youtube.com/@%EC%82%B4%EB%A6%BC%ED%95%B4%EC%BB%A4",
  "https://www.youtube.com/@%EB%AF%B8%EC%86%8C%EC%A3%BC%EB%B6%80",
  "https://www.youtube.com/@bnana513",
  "https://www.youtube.com/@%EC%82%B4%EB%A6%BC%EC%97%90%EC%A7%84%EC%8B%AC",
  "https://www.youtube.com/@%EC%82%B4%EB%A6%BC%EB%A9%94%EB%AA%A8",
  "https://www.youtube.com/@%EC%82%B4%EB%A6%BC_Saving",
  "https://www.youtube.com/@tidymarket",
  "https://www.youtube.com/@yoons_market",
  "https://www.youtube.com/@natashablue",
  "https://www.youtube.com/@widsunshine",
  "https://www.youtube.com/@haedalhome",
  "https://www.youtube.com/@%EC%9A%B0%EB%8B%88%EC%96%B8%EB%8B%88",
  "https://www.youtube.com/@hejdoo",
  "https://www.youtube.com/@Momstable",
  "https://www.youtube.com/@ho_house",
  "https://www.youtube.com/@sallim_gajang",
  "https://www.youtube.com/@%EC%95%BC%EB%AC%B4%EC%A7%84",
  "https://www.youtube.com/@5bok_house",
  "https://www.youtube.com/@mokri_house",
  "https://www.youtube.com/@sallim_after_work",
  "https://www.youtube.com/@dada_salrim",
  "https://www.youtube.com/@%EA%BD%81%EC%A3%BC%EB%B6%80",
  "https://www.youtube.com/@choi_her",
  "https://www.youtube.com/@sallimcorner",
  "https://www.youtube.com/@NiNii_Homes",
  "https://www.youtube.com/@Salrimharia",
  "https://www.youtube.com/@%EC%82%B4%EB%A6%BC%ED%94%BD79",
  "https://www.youtube.com/@%EB%AF%B8%EC%8A%A4%ED%84%B0%EC%82%B4%EB%A6%BC%EC%99%95",
  "https://www.youtube.com/@%EC%82%B4%EB%A6%BC%EA%B5%AC%EC%A1%B0%EB%8C%80",
  "https://www.youtube.com/@%EC%82%B4%EB%A6%BC%ED%8C%81_%ED%81%B4%EB%A6%AD",
  "https://www.youtube.com/@leelee_home",
] as const

const DEFAULT_INSTAGRAM_CHANNELS = [
  "https://www.youtube.com/@%EB%A1%9C%EC%BC%93up",
  "https://www.youtube.com/@deersoboro",
  "https://www.youtube.com/@%EB%A0%88%EC%A0%9C%EC%8A%A4%ED%86%A0%EC%BB%A4",
  "https://www.youtube.com/@%EA%B3%A0%EC%9D%B8%EB%AC%BC%EB%9E%AD%ED%82%B9",
  "https://www.youtube.com/@%ED%8B%88%EC%83%88%EC%A7%80%EC%8B%9D-h8j",
  "https://www.youtube.com/@%EB%B9%A8%EA%B0%84%EB%84%A4%EB%AA%A81",
  "https://www.youtube.com/@%EC%B0%BD%EB%B0%96%EC%84%B8%EC%83%81",
  "https://www.youtube.com/@Pro_Restorer",
  "https://www.youtube.com/@Gwangky",
  "https://www.youtube.com/@%EC%BD%94%EB%A7%89%ED%9E%8C%EC%BD%94%EB%BF%94%EC%86%8C",
  "https://www.youtube.com/@%EC%A7%80%EC%8B%9D%EB%A1%9D",
  "https://www.youtube.com/@%EC%85%80%EC%B9%B4%EB%A9%8D",
  "https://www.youtube.com/@iamenternews",
  "https://www.youtube.com/@%EC%95%A0%EB%8B%88%EB%A9%80%EB%A1%9C%EA%B7%B8-g2i",
  "https://www.youtube.com/@%ED%81%B4%EB%A6%AD%ED%81%AC",
  "https://www.youtube.com/@%EA%BC%AC%EB%93%B1%EC%96%B4",
  "https://www.youtube.com/@%EC%A2%8B%EC%95%84%EC%9A%94%ED%96%89%EC%9A%B4%EA%B0%80%EB%93%9D",
  "https://www.youtube.com/@%EB%B6%88%EC%95%88%ED%95%9C%ED%95%91%ED%95%91%EC%9D%B4",
  "https://www.youtube.com/@yaru_world",
  "https://www.youtube.com/@%EB%87%8C_%ED%9C%B4%EA%B2%8C%EC%86%8C",
  "https://www.youtube.com/@%EC%99%9C%EC%9B%83%EC%A7%80",
  "https://www.youtube.com/@%ED%8C%8C%EC%9D%B4%ED%84%B0%EC%A6%88-o1f",
  "https://www.youtube.com/@%EC%A7%84%EC%A7%9C%EC%9D%B4%EC%9E%A5%EB%A9%B43",
] as const

const DEFAULT_STORY_SHOPPING_CHANNELS = [
  "https://www.youtube.com/@salim_king_official",
  "https://www.youtube.com/@salimkwz",
  "https://www.youtube.com/@%EC%88%98%EC%83%81%ED%95%9C%EC%83%81%EC%A0%9088",
  "https://www.youtube.com/@%EB%95%A1%EC%8A%A4%ED%85%9C",
  "https://www.youtube.com/@o%EC%8B%A0%EC%82%AC%EB%93%A4o",
  "https://www.youtube.com/@yummyknow-x1x",
  "https://www.youtube.com/@ssul_pizza",
  "https://www.youtube.com/@%EC%84%A0%EB%AC%BC%EA%B0%80%EA%B2%8C0",
  "https://www.youtube.com/@%ED%96%84%EC%88%8F1",
  "https://www.youtube.com/@%EC%9D%B4%EB%B8%90%EC%87%BC%ED%95%91",
  "https://www.youtube.com/@%EC%A2%8B%EC%95%84%EC%9A%94%EB%88%84%EB%A5%B4%EB%A9%B4%EC%B0%A8%EC%9D%80%EC%9A%B0",
  "https://www.youtube.com/@eaten_review",
  "https://www.youtube.com/@%ED%8C%9D%EC%BD%98%EC%88%8F-i7",
  "https://www.youtube.com/@%EB%AF%B8%EC%8B%9D%ED%8C%90%EB%8B%A4.%EB%A7%9B%EB%91%A5%EC%9D%B4",
  "https://www.youtube.com/@%ED%8E%80Box",
  "https://www.youtube.com/@humorshowshow",
  "https://www.youtube.com/@%EC%8A%A4%EB%82%B5%ED%8F%AC%EC%BC%93",
  "https://www.youtube.com/@%ED%97%88%EB%8B%88%EB%A6%AC%EB%B7%B00",
  "https://www.youtube.com/@%EA%B5%AC%EB%8F%85%ED%95%98%EB%A9%B4%EB%8F%88%EB%B3%B5%ED%84%B0%EC%A7%90",
  "https://www.youtube.com/@%EB%AA%A9%EC%9E%91%EC%86%8C",
  "https://www.youtube.com/@%EC%A0%95%EB%B3%B4%EB%B9%94",
  "https://www.youtube.com/@%EC%88%8F%ED%8C%8C%EC%9D%BC%EB%9F%BFv",
  "https://www.youtube.com/@%EC%9B%83%EA%B8%B0%EA%B3%B0-f6x",
  "https://www.youtube.com/@%EC%8D%B0%ED%92%80%EB%8B%A4",
] as const

const EXCLUDED_INSTAGRAM_CHANNEL_TITLES = new Set(["타미TV", "배복치"])
const DEFAULT_CHANNEL_COLLECTIONS = [
  {
    groupName: "쇼핑형",
    channels: DEFAULT_SHOPPING_CHANNELS,
    storageKey: "story_shopping_default_channels_v2",
    excludedTitles: new Set<string>(),
    priorityChannels: [] as readonly string[],
  },
  {
    groupName: "인스타형",
    channels: DEFAULT_INSTAGRAM_CHANNELS,
    storageKey: "story_instagram_default_channels_v1",
    excludedTitles: EXCLUDED_INSTAGRAM_CHANNEL_TITLES,
    priorityChannels: [] as readonly string[],
  },
  {
    groupName: "이야기 쇼핑형",
    channels: DEFAULT_STORY_SHOPPING_CHANNELS,
    storageKey: "story_story_shopping_default_channels_v4",
    excludedTitles: new Set<string>(),
    priorityChannels: DEFAULT_STORY_SHOPPING_CHANNELS.slice(0, 5),
  },
] as const

const GROUP_NAME_TO_KEY: Record<string, FixedStoryGroupKey> = {
  쇼핑형: "shopping",
  "이야기 쇼핑형": "story-shopping",
  인스타형: "instagram",
}

function groupKeyFromName(name: string): FixedStoryGroupKey | null {
  return GROUP_NAME_TO_KEY[name.trim()] || null
}

function isCustomGroup(group: ChannelGroup): boolean {
  return group.id.startsWith("custom_") || !isFixedGroupName(group.name)
}

type StoryPanelGroup = ChannelGroup & { description?: string }

function normalizeChannelUrl(value: string): string {
  try {
    return decodeURIComponent(value.trim())
  } catch {
    return value.trim()
  }
}

/** 코드에 넣은 공용 디폴트 채널인지 판별 */
function isDefaultChannel(groupName: string, channel: GroupChannel): boolean {
  const collection = DEFAULT_CHANNEL_COLLECTIONS.find(
    (item) => item.groupName === groupName
  )
  if (!collection) return false
  const source = normalizeChannelUrl(channel.sourceInput || "")
  if (!source) return false
  return collection.channels.some(
    (url) => normalizeChannelUrl(url) === source
  )
}

function splitGroupChannels(group: ChannelGroup): {
  defaults: GroupChannel[]
  personal: GroupChannel[]
} {
  const defaults: GroupChannel[] = []
  const personal: GroupChannel[] = []
  for (const channel of group.channels) {
    if (isDefaultChannel(group.name, channel)) defaults.push(channel)
    else personal.push(channel)
  }
  return { defaults, personal }
}

function mergePersonalIntoGroups(
  fixedGroups: ChannelGroup[],
  personalMap: UserStoryChannelsMap
): ChannelGroup[] {
  return fixedGroups.map((group) => {
    const key = groupKeyFromName(group.name)
    const { defaults } = splitGroupChannels(group)
    const personal = key ? personalMap[key] || [] : []
    const defaultIds = new Set(defaults.map((channel) => channel.channelId))
    const mergedPersonal = personal.filter(
      (channel) => !defaultIds.has(channel.channelId)
    )
    return {
      ...group,
      channels: [...defaults, ...mergedPersonal],
      updatedAt: new Date().toISOString(),
    }
  })
}

/** localStorage 고정 그룹에는 공용 디폴트만 남긴다 */
function saveSharedDefaultGroups(allGroups: ChannelGroup[]) {
  const fixedGroups = allGroups.filter((group) => isFixedGroupName(group.name))
  const defaultsOnly = fixedGroups.map((group) => {
    const { defaults } = splitGroupChannels(group)
    return { ...group, channels: defaults, updatedAt: new Date().toISOString() }
  })
  const allStored = loadChannelGroups()
  saveChannelGroups([
    ...defaultsOnly,
    ...allStored.filter((group) => !isFixedGroupName(group.name)),
  ])
}

const VIEW_FILTERS = [
  { id: "all", label: "전체", min: 0, max: Infinity },
  { id: "1k", label: "1천~1만", min: 1_000, max: 10_000 },
  { id: "10k", label: "1~5만", min: 10_000, max: 50_000 },
  { id: "50k", label: "5~10만", min: 50_000, max: 100_000 },
  { id: "100k", label: "10~20만", min: 100_000, max: 200_000 },
  { id: "200k", label: "20~30만", min: 200_000, max: 300_000 },
  { id: "200k-400k", label: "20~40만", min: 200_000, max: 400_000 },
  { id: "500k", label: "50만+", min: 500_000, max: Infinity },
] as const

const OUTLIER_FILTERS = [
  { id: "all", label: "전체", min: 0 },
  { id: "1x", label: "1x+", min: 1 },
  { id: "2x", label: "2x+", min: 2 },
  { id: "3x", label: "3x+", min: 3 },
  { id: "5x", label: "5x+", min: 5 },
  { id: "10x", label: "10x+", min: 10 },
] as const

/** 한 번에 그릴 영상 카드 수 — 전체 렌더는 2000장 단위로 버벅임 */
const VIDEO_PAGE_SIZE = 24

type SortKey = "latest" | "views"

type GroupVideo = {
  videoId: string
  title: string
  thumbnailUrl: string
  viewCount: number
  likeCount: number
  commentCount: number
  publishedAt: string
  description: string
  durationSeconds: number
  channelId: string
  channelTitle: string
  channelThumbnailUrl: string
  channelBaselineViews: number
  outlierRatio: number
  viewsPerDay: number
  engagementRate: number
  winningScore: number
}

type ShoppingTagStatus = "idle" | "loading" | "tagged" | "none" | "error"

const shoppingTagStatusCache = new Map<
  string,
  Exclude<ShoppingTagStatus, "idle" | "loading">
>()
const shoppingTagRequests = new Map<
  string,
  Promise<Exclude<ShoppingTagStatus, "idle" | "loading">>
>()

async function detectVideoShoppingTag(
  videoId: string
): Promise<Exclude<ShoppingTagStatus, "idle" | "loading">> {
  const cached = shoppingTagStatusCache.get(videoId)
  if (cached) return cached
  const pending = shoppingTagRequests.get(videoId)
  if (pending) return pending
  const request = fetch(
    `/api/shotform/story-shopping/youtube-shopping-tags?videoId=${encodeURIComponent(videoId)}`
  )
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.error) return "error" as const
      return payload.detected === true ||
        (Array.isArray(payload.products) && payload.products.length > 0)
        ? ("tagged" as const)
        : ("none" as const)
    })
    .catch(() => "error" as const)
    .then((status) => {
      shoppingTagStatusCache.set(videoId, status)
      shoppingTagRequests.delete(videoId)
      return status
    })
  shoppingTagRequests.set(videoId, request)
  return request
}

function ShoppingTagBadge({ videoId }: { videoId: string }) {
  const badgeRef = useRef<HTMLSpanElement>(null)
  const [status, setStatus] = useState<ShoppingTagStatus>(
    () => shoppingTagStatusCache.get(videoId) || "idle"
  )

  useEffect(() => {
    setStatus(shoppingTagStatusCache.get(videoId) || "idle")
    const element = badgeRef.current
    if (!element || shoppingTagStatusCache.has(videoId)) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        setStatus("loading")
        void detectVideoShoppingTag(videoId).then(setStatus)
      },
      { rootMargin: "80px" }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [videoId])

  const label =
    status === "tagged"
      ? "쇼핑태그 있음"
      : status === "none"
        ? "쇼핑태그 없음"
        : status === "error"
          ? "태그 확인 불가"
          : "태그 확인 중"
  return (
    <span
      ref={badgeRef}
      title={label}
      className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-[8px] font-black shadow-lg backdrop-blur ${
        status === "tagged"
          ? "border-amber-200/50 bg-amber-500/90 text-white"
          : status === "none"
            ? "border-white/15 bg-black/65 text-zinc-300"
            : status === "error"
              ? "border-red-300/30 bg-red-950/75 text-red-200"
              : "border-white/15 bg-black/65 text-zinc-300"
      }`}
    >
      {status === "loading" || status === "idle" ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      ) : (
        <ShoppingBag className="h-2.5 w-2.5" />
      )}
      {label}
    </span>
  )
}

const getTakeoffGrade = (ratio: number) => {
  if (ratio >= 10)
    return { icon: "👑", label: "초대박(바이럴)", className: "bg-fuchsia-500/90" }
  if (ratio >= 5) return { icon: "⭐", label: "대박 영상", className: "bg-amber-500/90" }
  if (ratio >= 3) return { icon: "🚀", label: "강한 떡상", className: "bg-cyan-500/90" }
  if (ratio >= 2) return { icon: "🔥", label: "떡상", className: "bg-orange-500/90" }
  if (ratio >= 1)
    return { icon: "↗️", label: "평균 이상 영상", className: "bg-emerald-500/90" }
  return { icon: "－", label: "평균 이하 영상", className: "bg-zinc-700/90" }
}

const formatPublishedDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "날짜 정보 없음"
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/\s/g, "")
}

const ensureFixedGroups = () => {
  const loaded = loadChannelGroups()
  let changed = false
  const fixed = FIXED_GROUPS.map((definition) => {
    const existing = loaded.find(
      (group) =>
        group.name.trim() === definition.name ||
        (definition.key === "story-shopping" && group.name.trim() === "썰쇼핑형")
    )
    if (existing) {
      const normalizedExisting =
        existing.name === definition.name
          ? existing
          : { ...existing, name: definition.name, updatedAt: new Date().toISOString() }
      if (normalizedExisting !== existing) changed = true
      if (definition.name === "인스타형") {
        const channels = normalizedExisting.channels.filter(
          (channel) => !EXCLUDED_INSTAGRAM_CHANNEL_TITLES.has(channel.channelTitle.trim())
        )
        if (channels.length !== normalizedExisting.channels.length) {
          changed = true
          return { ...normalizedExisting, channels, updatedAt: new Date().toISOString() }
        }
      }
      return normalizedExisting
    }
    changed = true
    return {
      ...createChannelGroup(definition.name),
      id: `story_fixed_${definition.key}`,
    }
  })
  if (changed) {
    saveChannelGroups([
      ...fixed,
      ...loaded.filter((group) => !isFixedGroupName(group.name)),
    ])
  }
  return fixed
}

async function analyzeChannel(channelInput: string): Promise<GroupChannel> {
  const youtubeApiKey = getYoutubeApiKey()
  if (!youtubeApiKey) throw new Error("설정에서 YouTube Data API 키를 먼저 저장해주세요.")
  const response = await fetch("/api/youmaker/analyze-channel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channelId: channelInput, youtubeApiKey }),
  })
  const data = await response.json()
  if (!response.ok || !data.success) {
    throw new Error(data.error || "채널을 분석하지 못했습니다.")
  }
  const result = data.result
  return {
    channelId: result.channelId,
    sourceInput: channelInput,
    channelTitle: result.channelInfo.title,
    thumbnailUrl: result.channelInfo.thumbnailUrl,
    subscriberCount: result.channelInfo.subscriberCount,
    viewCount: result.channelInfo.viewCount,
    videoCount: result.channelInfo.videoCount,
    videos: (result.videos || []).slice(0, 50).map(
      (video: {
        videoId: string
        title: string
        thumbnailUrl: string
        viewCount: number
        likeCount: number
        commentCount?: number
        publishedAt: string
        description?: string
        durationSeconds?: number
        mutationX?: number
        baselineViewCount?: number
      }) => ({
        videoId: video.videoId,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount || 0,
        publishedAt: video.publishedAt,
        description: video.description || "",
        durationSeconds: video.durationSeconds || 0,
        mutationX: video.mutationX,
        baselineViewCount: video.baselineViewCount,
      })
    ),
  }
}

export function StoryWinningContentPanel({
  userId,
  selected,
  onSelect,
}: {
  userId: string
  selected?: StoryWinningContent
  onSelect: (content: StoryWinningContent) => void
}) {
  const [groups, setGroups] = useState<StoryPanelGroup[]>([])
  const [activeId, setActiveId] = useState("")
  const [channelInput, setChannelInput] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [previewVideo, setPreviewVideo] = useState<GroupVideo | null>(null)
  const [channelsOpen, setChannelsOpen] = useState(true)
  const [showAllChannels, setShowAllChannels] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("latest")
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set())
  const [viewFilter, setViewFilter] =
    useState<(typeof VIEW_FILTERS)[number]["id"]>("all")
  const [outlierFilter, setOutlierFilter] =
    useState<(typeof OUTLIER_FILTERS)[number]["id"]>("all")
  const [customMin, setCustomMin] = useState("")
  const [customMax, setCustomMax] = useState("")
  const [defaultChannelProgress, setDefaultChannelProgress] = useState<{
    groupName: string
    current: number
    total: number
  } | null>(null)
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDescription, setNewGroupDescription] = useState("")
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [videoVisibleCount, setVideoVisibleCount] = useState(VIDEO_PAGE_SIZE)
  const defaultsStartedRef = useRef(false)
  const personalMigratedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const fixed = ensureFixedGroups()
      let personalMap: UserStoryChannelsMap = {
        shopping: [],
        "story-shopping": [],
        instagram: [],
      }
      let customGroups: StoryPanelGroup[] = []

      if (userId && userId !== "anonymous") {
        const userRows = await listUserChannelGroups(userId)
        for (const row of userRows) {
          if (
            row.groupKey === "shopping" ||
            row.groupKey === "story-shopping" ||
            row.groupKey === "instagram"
          ) {
            personalMap[row.groupKey] = row.channels
          } else if (row.groupKey.startsWith("custom_")) {
            customGroups.push({
              id: row.groupKey,
              name: row.groupName || "내 그룹",
              description: row.description || "",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              channels: row.channels,
            })
          }
        }

        // 브라우저 localStorage에만 있던 개인 채널 → Supabase로 이전(병합)
        if (!personalMigratedRef.current) {
          personalMigratedRef.current = true
          let hadLocalPersonal = false
          for (const group of fixed) {
            const key = groupKeyFromName(group.name)
            if (!key) continue
            const { personal } = splitGroupChannels(group)
            if (!personal.length) continue
            hadLocalPersonal = true
            const byId = new Map(
              (personalMap[key] || []).map((channel) => [channel.channelId, channel])
            )
            for (const channel of personal) {
              byId.set(channel.channelId, channel)
            }
            const mergedPersonal = Array.from(byId.values())
            personalMap[key] = mergedPersonal
            await saveUserStoryChannelsForGroup(userId, key, mergedPersonal)
          }
          if (hadLocalPersonal) {
            saveSharedDefaultGroups(fixed)
          }
        }
      }

      const mergedFixed = mergePersonalIntoGroups(ensureFixedGroups(), personalMap)
      const merged: StoryPanelGroup[] = [
        ...mergedFixed.map((group) => ({
          ...group,
          description:
            FIXED_GROUPS.find((item) => item.name === group.name)?.description || "",
        })),
        ...customGroups,
      ]
      if (cancelled) return
      setGroups(merged)
      setActiveId((prev) => prev || merged[0]?.id || "")

      if (defaultsStartedRef.current) return
      defaultsStartedRef.current = true

      const collectDefaultChannels = async () => {
        let nextFixed = mergedFixed
        for (const collection of DEFAULT_CHANNEL_COLLECTIONS) {
          if (localStorage.getItem(collection.storageKey) === "completed") continue

          let failedCount = 0
          let processedCount = 0
          setDefaultChannelProgress({
            groupName: collection.groupName,
            current: 0,
            total: collection.channels.length,
          })

          for (const channelUrl of collection.channels) {
            const targetGroup = nextFixed.find(
              (group) => group.name === collection.groupName
            )
            const alreadyCollected = targetGroup?.channels.some(
              (channel) =>
                normalizeChannelUrl(channel.sourceInput || "") ===
                normalizeChannelUrl(channelUrl)
            )

            if (!alreadyCollected && targetGroup) {
              try {
                const analyzedChannel = await analyzeChannel(channelUrl)
                if (
                  !collection.excludedTitles.has(analyzedChannel.channelTitle.trim())
                ) {
                  const withSource = {
                    ...analyzedChannel,
                    sourceInput: channelUrl,
                  }
                  const updatedGroup = upsertGroupChannel(targetGroup, withSource)
                  nextFixed = nextFixed.map((group) =>
                    group.id === updatedGroup.id ? updatedGroup : group
                  )
                  saveSharedDefaultGroups(nextFixed)
                  if (!cancelled) {
                    setGroups((prev) => {
                      const personalMapNext: UserStoryChannelsMap = {
                        shopping: [],
                        "story-shopping": [],
                        instagram: [],
                      }
                      const customs: StoryPanelGroup[] = []
                      for (const group of prev) {
                        if (isCustomGroup(group)) {
                          customs.push(group)
                          continue
                        }
                        const key = groupKeyFromName(group.name)
                        if (!key) continue
                        personalMapNext[key] = splitGroupChannels(group).personal
                      }
                      return [
                        ...mergePersonalIntoGroups(nextFixed, personalMapNext).map(
                          (group) => ({
                            ...group,
                            description:
                              FIXED_GROUPS.find((item) => item.name === group.name)
                                ?.description || "",
                          })
                        ),
                        ...customs,
                      ]
                    })
                  }
                }
              } catch (reason) {
                failedCount += 1
                if (
                  reason instanceof Error &&
                  reason.message.includes("YouTube Data API 키")
                ) {
                  setError(reason.message)
                  setDefaultChannelProgress(null)
                  return
                }
              }
            }

            processedCount += 1
            setDefaultChannelProgress({
              groupName: collection.groupName,
              current: processedCount,
              total: collection.channels.length,
            })
          }

          if (collection.priorityChannels.length) {
            const targetGroup = nextFixed.find(
              (group) => group.name === collection.groupName
            )
            if (targetGroup) {
              const priorityChannels = collection.priorityChannels
                .map((url) =>
                  targetGroup.channels.find(
                    (channel) =>
                      normalizeChannelUrl(channel.sourceInput || "") ===
                      normalizeChannelUrl(url)
                  )
                )
                .filter((channel): channel is GroupChannel => Boolean(channel))
              const priorityIds = new Set(
                priorityChannels.map((channel) => channel.channelId)
              )
              const reorderedGroup = {
                ...targetGroup,
                channels: [
                  ...priorityChannels,
                  ...targetGroup.channels.filter(
                    (channel) => !priorityIds.has(channel.channelId)
                  ),
                ],
                updatedAt: new Date().toISOString(),
              }
              nextFixed = nextFixed.map((group) =>
                group.id === reorderedGroup.id ? reorderedGroup : group
              )
              saveSharedDefaultGroups(nextFixed)
              if (!cancelled) {
                setGroups((prev) => {
                  const personalMapNext: UserStoryChannelsMap = {
                    shopping: [],
                    "story-shopping": [],
                    instagram: [],
                  }
                  const customs: StoryPanelGroup[] = []
                  for (const group of prev) {
                    if (isCustomGroup(group)) {
                      customs.push(group)
                      continue
                    }
                    const key = groupKeyFromName(group.name)
                    if (!key) continue
                    personalMapNext[key] = splitGroupChannels(group).personal
                  }
                  return [
                    ...mergePersonalIntoGroups(nextFixed, personalMapNext).map(
                      (group) => ({
                        ...group,
                        description:
                          FIXED_GROUPS.find((item) => item.name === group.name)
                            ?.description || "",
                      })
                    ),
                    ...customs,
                  ]
                })
              }
            }
          }

          if (failedCount === 0) {
            localStorage.setItem(collection.storageKey, "completed")
          }
        }
        setDefaultChannelProgress(null)
      }

      void collectDefaultChannels()
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [userId])

  const activeGroup = groups.find((group) => group.id === activeId) || groups[0] || null

  useEffect(() => {
    setShowAllChannels(false)
    setSelectedChannelIds(
      new Set((activeGroup?.channels || []).map((channel) => channel.channelId))
    )
    setVideoVisibleCount(VIDEO_PAGE_SIZE)
  }, [activeGroup?.id, activeGroup?.channels])

  useEffect(() => {
    setVideoVisibleCount(VIDEO_PAGE_SIZE)
  }, [sortKey, viewFilter, outlierFilter, customMin, customMax, selectedChannelIds])

  /** 공용 디폴트는 localStorage, 개인 채널/커스텀 그룹은 Supabase */
  const persist = async (nextGroups: StoryPanelGroup[]) => {
    setGroups(nextGroups)
    saveSharedDefaultGroups(nextGroups)
    if (!userId || userId === "anonymous") return
    for (const group of nextGroups) {
      if (isCustomGroup(group)) {
        const result = await upsertUserChannelGroup(userId, {
          groupKey: group.id,
          groupName: group.name,
          description: group.description || "",
          channels: group.channels,
        })
        if (!result.success) {
          setError(result.error || "커스텀 그룹 저장에 실패했습니다.")
        }
        continue
      }
      const key = groupKeyFromName(group.name)
      if (!key) continue
      const { personal } = splitGroupChannels(group)
      const result = await saveUserStoryChannelsForGroup(
        userId,
        key,
        personal,
        group.name
      )
      if (!result.success) {
        setError(result.error || "개인 채널 저장에 실패했습니다.")
      }
    }
  }

  const handleCreateGroup = async () => {
    const name = newGroupName.trim()
    if (!name) {
      setError("그룹 이름을 입력해주세요.")
      return
    }
    if (!userId || userId === "anonymous") {
      setError("그룹을 만들려면 로그인이 필요합니다.")
      return
    }
    if (isFixedGroupName(name) || groups.some((group) => group.name.trim() === name)) {
      setError("같은 이름의 그룹이 이미 있습니다.")
      return
    }
    setIsCreatingGroup(true)
    setError("")
    try {
      const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const description = newGroupDescription.trim()
      const created: StoryPanelGroup = {
        ...createChannelGroup(name),
        id,
        description,
      }
      const result = await upsertUserChannelGroup(userId, {
        groupKey: id,
        groupName: name,
        description,
        channels: [],
      })
      if (!result.success) {
        setError(result.error || "그룹 생성에 실패했습니다.")
        return
      }
      setGroups((prev) => [...prev, created])
      setActiveId(id)
      setShowCreateGroupDialog(false)
      setNewGroupName("")
      setNewGroupDescription("")
    } finally {
      setIsCreatingGroup(false)
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    const target = groups.find((group) => group.id === groupId)
    if (!target || !isCustomGroup(target)) {
      setError("공용 그룹은 삭제할 수 없습니다.")
      return
    }
    if (!userId || userId === "anonymous") {
      setError("로그인이 필요합니다.")
      return
    }
    if (!confirm(`「${target.name}」 그룹을 삭제할까요?`)) return
    const result = await deleteUserChannelGroup(userId, groupId)
    if (!result.success) {
      setError(result.error || "그룹 삭제에 실패했습니다.")
      return
    }
    const next = groups.filter((group) => group.id !== groupId)
    setGroups(next)
    if (activeId === groupId) {
      setActiveId(next[0]?.id || "")
    }
  }

  const allVideos = useMemo<GroupVideo[]>(() => {
    if (!activeGroup) return []
    return activeGroup.channels.flatMap((channel) => {
      const videos = channel.videos || []
      return videos.map((video) => {
        const ageDays = Math.max(
          1,
          (Date.now() - new Date(video.publishedAt).getTime()) / 86_400_000
        )
        // 떡상 지수는 API 서버가 최근 30개 평균을 기준으로 계산한 값만 사용합니다.
        const outlierRatio = video.mutationX ?? 0
        const viewsPerDay = video.viewCount / ageDays
        const commentCount = video.commentCount || 0
        const engagementRate =
          video.viewCount > 0
            ? ((video.likeCount + commentCount) / video.viewCount) * 100
            : 0
        const winningScore = Math.min(
          100,
          Math.round(
            Math.min(45, outlierRatio * 13) +
              Math.min(35, Math.log10(viewsPerDay + 1) * 8) +
              Math.min(20, engagementRate * 4)
          )
        )
        return {
          videoId: video.videoId,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          commentCount,
          publishedAt: video.publishedAt,
          description: video.description || "",
          durationSeconds: video.durationSeconds || 0,
          channelId: channel.channelId,
          channelTitle: channel.channelTitle,
          channelThumbnailUrl: channel.thumbnailUrl || "",
          channelBaselineViews: video.baselineViewCount || 0,
          outlierRatio,
          viewsPerDay,
          engagementRate,
          winningScore,
        }
      })
    })
  }, [activeGroup])

  const filteredVideos = useMemo(() => {
    const viewPreset = VIEW_FILTERS.find((filter) => filter.id === viewFilter)!
    const outlierPreset = OUTLIER_FILTERS.find((filter) => filter.id === outlierFilter)!
    const minimumTakeoff = customMin === "" ? outlierPreset.min : Number(customMin)
    const maximumTakeoff = customMax === "" ? Infinity : Number(customMax)
    return allVideos
      .filter((video) => selectedChannelIds.has(video.channelId))
      .filter((video) => video.durationSeconds > 0 && video.durationSeconds <= 60)
      .filter(
        (video) => video.viewCount >= viewPreset.min && video.viewCount < viewPreset.max
      )
      .filter(
        (video) =>
          video.outlierRatio >= (Number.isFinite(minimumTakeoff) ? minimumTakeoff : 0) &&
          video.outlierRatio <= (Number.isFinite(maximumTakeoff) ? maximumTakeoff : Infinity)
      )
      .sort((a, b) => {
        if (sortKey === "views") return b.viewCount - a.viewCount
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      })
  }, [
    allVideos,
    customMax,
    customMin,
    outlierFilter,
    selectedChannelIds,
    sortKey,
    viewFilter,
  ])

  const visibleVideos = useMemo(
    () => filteredVideos.slice(0, videoVisibleCount),
    [filteredVideos, videoVisibleCount]
  )
  const hasMoreVideos = visibleVideos.length < filteredVideos.length

  const handleAddChannel = async () => {
    if (!activeGroup || !channelInput.trim()) return
    if (!userId || userId === "anonymous") {
      setError("개인 채널을 저장하려면 로그인이 필요합니다.")
      return
    }
    setIsAdding(true)
    setError("")
    try {
      const channel = await analyzeChannel(channelInput.trim())
      const withSource: GroupChannel = {
        ...channel,
        sourceInput: channelInput.trim(),
      }
      if (
        isFixedGroupName(activeGroup.name) &&
        isDefaultChannel(activeGroup.name, withSource)
      ) {
        setError("이미 공용 디폴트에 포함된 채널입니다.")
        return
      }
      const updated = upsertGroupChannel(activeGroup, withSource)
      await persist(groups.map((group) => (group.id === updated.id ? updated : group)))
      setChannelInput("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "채널 추가에 실패했습니다.")
    } finally {
      setIsAdding(false)
    }
  }

  const refreshChannels = async () => {
    if (!activeGroup?.channels.length) return
    setIsRefreshing(true)
    setError("")
    try {
      let updated = activeGroup
      for (const channel of activeGroup.channels) {
        try {
          const refreshed = await analyzeChannel(channel.channelId)
          updated = upsertGroupChannel(updated, {
            ...refreshed,
            sourceInput: channel.sourceInput || refreshed.sourceInput,
          })
        } catch {
          // 실패한 채널은 기존 데이터를 유지합니다.
        }
      }
      await persist(groups.map((group) => (group.id === updated.id ? updated : group)))
    } finally {
      setIsRefreshing(false)
    }
  }

  const removeChannel = (channelId: string) => {
    if (!activeGroup) return
    const target = activeGroup.channels.find((channel) => channel.channelId === channelId)
    if (
      target &&
      isFixedGroupName(activeGroup.name) &&
      isDefaultChannel(activeGroup.name, target)
    ) {
      setError("공용 디폴트 채널은 삭제할 수 없습니다. 개인이 추가한 채널만 삭제됩니다.")
      return
    }
    const updated = {
      ...activeGroup,
      channels: activeGroup.channels.filter((channel) => channel.channelId !== channelId),
      updatedAt: new Date().toISOString(),
    }
    void persist(groups.map((group) => (group.id === updated.id ? updated : group)))
  }

  const selectVideo = (video: GroupVideo) => {
    onSelect({
      videoId: video.videoId,
      channelId: video.channelId,
      channelTitle: video.channelTitle,
      channelThumbnailUrl: video.channelThumbnailUrl,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      popularityScore: video.winningScore,
      channelBaselineViews: video.channelBaselineViews,
      outlierRatio: video.outlierRatio,
      viewsPerDay: video.viewsPerDay,
      engagementRate: video.engagementRate,
      winningScore: video.winningScore,
      source: "channel-analysis",
    })
  }

  const totalChannels = groups.reduce((sum, group) => sum + group.channels.length, 0)
  const needsTakeoffRefresh = Boolean(
    activeGroup?.channels.some((channel) =>
      channel.videos?.some((video) => video.mutationX === undefined)
    )
  )
  const activeChannelIds = (activeGroup?.channels || []).map((channel) => channel.channelId)
  const allChannelsSelected =
    activeChannelIds.length > 0 &&
    activeChannelIds.every((channelId) => selectedChannelIds.has(channelId))
  const someChannelsSelected =
    !allChannelsSelected &&
    activeChannelIds.some((channelId) => selectedChannelIds.has(channelId))

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#11100e]/95 shadow-2xl shadow-black/30">
      <div className="grid min-h-[620px] lg:grid-cols-[230px_1fr]">
        <aside className="border-b border-white/[0.07] bg-black/20 p-3 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between px-2 py-1">
            <div>
              <p className="text-[9px] font-black tracking-[0.15em] text-zinc-300">
                CHANNEL GROUP
              </p>
              <p className="mt-1 text-xs text-zinc-300">
                {groups.length}개 그룹 · {totalChannels}개 채널
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-orange-300 hover:bg-orange-500/15 hover:text-orange-200"
              title="그룹 추가"
              onClick={() => {
                if (!userId || userId === "anonymous") {
                  setError("그룹을 만들려면 로그인이 필요합니다.")
                  return
                }
                setShowCreateGroupDialog(true)
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {groups.map((group) => {
              const definition = FIXED_GROUPS.find((item) => item.name === group.name)
              const active = activeGroup?.id === group.id
              const custom = isCustomGroup(group)
              const videoCount = group.channels.reduce(
                (sum, channel) => sum + (channel.videos?.length || 0),
                0
              )
              return (
                <div
                  key={group.id}
                  className={`group/item relative w-full rounded-xl border transition ${
                    active
                      ? "border-orange-400/35 bg-gradient-to-r from-orange-500/15 to-rose-500/10 shadow-lg shadow-orange-950/20"
                      : "border-white/[0.05] bg-white/[0.02] hover:border-white/15"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(group.id)
                    }}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-center gap-2 pr-6">
                      <FolderOpen
                        className={`h-4 w-4 ${active ? "text-orange-400" : "text-zinc-400"}`}
                      />
                      <p className={`text-sm font-black ${active ? "text-white" : "text-zinc-400"}`}>
                        {group.name}
                      </p>
                    </div>
                    <p className="mt-1.5 pl-6 text-[9px] text-zinc-400">
                      {definition?.description || group.description || (custom ? "내가 만든 그룹" : "")}
                    </p>
                    <p className="mt-2 pl-6 text-[9px] font-bold text-zinc-300">
                      {group.channels.length}개 채널 · {videoCount}개 영상
                    </p>
                  </button>
                  {custom ? (
                    <button
                      type="button"
                      title="그룹 삭제"
                      className="absolute right-2 top-2 rounded-md p-1 text-zinc-500 opacity-70 hover:bg-rose-500/20 hover:text-rose-300"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDeleteGroup(group.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="border-b border-white/[0.07] p-4 md:p-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={channelInput}
                onChange={(event) => setChannelInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleAddChannel()
                }}
                placeholder={`${activeGroup?.name || "그룹"}에 추가할 채널 URL, @핸들 또는 채널명`}
                className="h-11 flex-1 border-white/10 bg-black/30 text-zinc-100"
              />
              <Button
                type="button"
                onClick={() => void handleAddChannel()}
                disabled={isAdding || !channelInput.trim()}
                className="h-11 bg-orange-500 font-black text-white hover:bg-orange-400"
              >
                {isAdding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                채널 추가
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void refreshChannels()}
                disabled={isRefreshing || !activeGroup?.channels.length}
                className="h-11 border-white/10 bg-white/[0.03] text-zinc-400"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                전체 갱신
              </Button>
            </div>
            {defaultChannelProgress ? (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-orange-400/20 bg-orange-500/10 p-2 text-xs font-bold text-orange-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {defaultChannelProgress.groupName} 기본 채널 수집 중 ·{" "}
                {defaultChannelProgress.current}/
                {defaultChannelProgress.total}
              </div>
            ) : null}
            {error ? (
              <p className="mt-2 rounded-lg border border-red-400/20 bg-red-500/10 p-2 text-xs text-red-200">
                {error}
              </p>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.07] bg-black/15">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setChannelsOpen((open) => !open)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <Users className="h-4 w-4 text-orange-400" />
                  <span className="text-xs font-black text-zinc-200">
                    수집 채널 ({activeGroup?.channels.length || 0})
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-zinc-300 transition ${channelsOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {activeChannelIds.length ? (
                  <label className="flex cursor-pointer items-center gap-2 text-[10px] font-bold text-zinc-300">
                    <Checkbox
                      checked={
                        allChannelsSelected
                          ? true
                          : someChannelsSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(checked) =>
                        setSelectedChannelIds(
                          checked === true ? new Set(activeChannelIds) : new Set()
                        )
                      }
                    />
                    전체 선택
                  </label>
                ) : null}
              </div>
              {channelsOpen ? (
                <div className="grid gap-2 border-t border-white/[0.06] p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(showAllChannels
                    ? activeGroup?.channels
                    : activeGroup?.channels.slice(0, 3)
                  )?.map((channel) => (
                    <div
                      key={channel.channelId}
                      className={`group flex items-center gap-2 rounded-xl border p-2.5 transition ${
                        selectedChannelIds.has(channel.channelId)
                          ? "border-orange-400/25 bg-orange-500/[0.06]"
                          : "border-white/[0.07] bg-white/[0.025] opacity-55"
                      }`}
                    >
                      <Checkbox
                        checked={selectedChannelIds.has(channel.channelId)}
                        onCheckedChange={(checked) =>
                          setSelectedChannelIds((previous) => {
                            const next = new Set(previous)
                            if (checked === true) next.add(channel.channelId)
                            else next.delete(channel.channelId)
                            return next
                          })
                        }
                      />
                      <a
                        href={`https://www.youtube.com/channel/${encodeURIComponent(channel.channelId)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${channel.channelTitle} YouTube 채널 열기`}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg outline-none transition hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-orange-400/70"
                      >
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/5">
                          {channel.thumbnailUrl ? (
                            <img
                              src={channel.thumbnailUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1 truncate text-xs font-bold text-zinc-200">
                            <span className="truncate">{channel.channelTitle}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 text-zinc-500 transition group-hover:text-orange-300" />
                          </p>
                          <p className="mt-0.5 text-[9px] text-zinc-400">
                            구독자 {formatCount(channel.subscriberCount || 0)}
                          </p>
                        </div>
                      </a>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault()
                          removeChannel(channel.channelId)
                        }}
                        className="rounded-md p-1 text-zinc-400 opacity-0 transition hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
                        title="채널 제거"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {(activeGroup?.channels.length || 0) > 3 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllChannels((visible) => !visible)}
                      className="col-span-full flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] text-[10px] font-bold text-zinc-300 transition hover:border-orange-400/30 hover:bg-orange-500/[0.06] hover:text-white"
                    >
                      {showAllChannels
                        ? "접기"
                        : `더보기 (${(activeGroup?.channels.length || 0) - 3}개)`}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition ${
                          showAllChannels ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  ) : null}
                  {!activeGroup?.channels.length ? (
                    <p className="col-span-full py-5 text-center text-xs text-zinc-400">
                      이 그룹에 벤치마킹 채널을 추가해주세요.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-b border-white/[0.07] bg-[#0d0c0b] p-4">
            <div className="grid gap-3 text-[10px] md:grid-cols-[72px_1fr]">
              <span className="pt-1.5 font-black text-zinc-300">정렬</span>
              <FilterButtons
                items={[
                  { id: "latest", label: "최신순" },
                  { id: "views", label: "조회순" },
                ]}
                value={sortKey}
                onChange={(value) => setSortKey(value as SortKey)}
                activeClass="bg-pink-500 text-white"
              />

              <span className="pt-1.5 font-black text-zinc-300">조회수</span>
              <FilterButtons
                items={VIEW_FILTERS}
                value={viewFilter}
                onChange={(value) =>
                  setViewFilter(value as (typeof VIEW_FILTERS)[number]["id"])
                }
                activeClass="bg-blue-500 text-white"
              />

              <span className="flex items-center gap-1 pt-1.5 font-black text-zinc-300">
                떡상 지수
                <span
                  className="cursor-help"
                  title="떡상 지수는 채널 평균 대비 몇 배 높은 성과를 기록했는지를 나타내는 상대 성과 지표입니다."
                >
                  <Info className="h-3.5 w-3.5 text-zinc-300" aria-label="떡상 지수 설명" />
                </span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <FilterButtons
                  items={OUTLIER_FILTERS}
                  value={customMin || customMax ? "" : outlierFilter}
                  onChange={(value) => {
                    setOutlierFilter(value as (typeof OUTLIER_FILTERS)[number]["id"])
                    setCustomMin("")
                    setCustomMax("")
                  }}
                  activeClass="bg-orange-500 text-white"
                />
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={customMin}
                    onChange={(event) => setCustomMin(event.target.value)}
                    placeholder="최소"
                    aria-label="최소 떡상 지수"
                    className="h-8 w-[72px] border-white/10 bg-black/30 px-2 text-xs text-white"
                  />
                  <span className="text-zinc-300">x ~</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={customMax}
                    onChange={(event) => setCustomMax(event.target.value)}
                    placeholder="최대"
                    aria-label="최대 떡상 지수"
                    className="h-8 w-[72px] border-white/10 bg-black/30 px-2 text-xs text-white"
                  />
                  <span className="text-zinc-300">x</span>
                </div>
              </div>

            </div>
          </div>

          <div className="p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-zinc-200">
                  {activeGroup?.name} 성과 영상
                </p>
                <p className="mt-1 text-[9px] text-zinc-400">
                  {activeGroup?.channels.length || 0}개 채널 · {filteredVideos.length}개 영상 ·
                  지금 {visibleVideos.length}개 표시 · 60초 이하만 분석
                </p>
                {needsTakeoffRefresh ? (
                  <p className="mt-1 text-[9px] font-bold text-amber-400">
                    기존 채널은 새 떡상 지수 계산을 위해 채널 새로고침이 필요합니다.
                  </p>
                ) : null}
              </div>
              <TrendingUp className="h-4 w-4 text-orange-400" />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleVideos.map((video) => {
                const selectedVideo = selected?.videoId === video.videoId
                const takeoffGrade = getTakeoffGrade(video.outlierRatio)
                return (
                  <article
                    key={video.videoId}
                    className={`overflow-hidden rounded-2xl border transition ${
                      selectedVideo
                        ? "border-orange-400/55 bg-orange-500/10"
                        : "border-white/[0.07] bg-black/20 hover:border-orange-400/25"
                    }`}
                  >
                    <div className="relative aspect-video overflow-hidden bg-black">
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <span
                        className={`absolute left-2 top-2 rounded-lg border border-white/15 px-2 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur ${takeoffGrade.className}`}
                        title={`${takeoffGrade.label} · 최근 30개 영상 평균 조회수 ${formatCount(video.channelBaselineViews)} 대비`}
                      >
                        {takeoffGrade.icon} {video.outlierRatio.toFixed(1)}x
                      </span>
                      <div className="absolute right-2 top-2">
                        <ShoppingTagBadge videoId={video.videoId} />
                      </div>
                      <div className="absolute bottom-2 left-2 flex items-center gap-2">
                        <span className="rounded-md border border-cyan-200/40 bg-cyan-500/90 px-2.5 py-1 text-[10px] font-black text-white shadow-lg shadow-cyan-950/40 backdrop-blur">
                          조회 {formatCount(video.viewCount)}
                        </span>
                        {video.durationSeconds ? (
                          <span className="rounded bg-black/70 px-2 py-1 text-[9px] text-zinc-300">
                            {Math.floor(video.durationSeconds / 60)}:
                            {String(video.durationSeconds % 60).padStart(2, "0")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 min-h-10 text-xs font-black leading-5 text-zinc-100">
                        {video.title}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-5 w-5 overflow-hidden rounded-full bg-white/5">
                          {video.channelThumbnailUrl ? (
                            <img
                              src={video.channelThumbnailUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <p className="min-w-0 flex-1 truncate text-[9px] text-zinc-400">
                          {video.channelTitle}
                        </p>
                        <p className="text-[9px] font-bold text-emerald-400">
                          {takeoffGrade.label}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-[9px] font-medium text-zinc-400">
                        <CalendarDays className="h-3 w-3 text-orange-400" />
                        업로드 {formatPublishedDate(video.publishedAt)}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPreviewVideo(video)}
                          className="h-9 border-white/15 bg-white/[0.04] px-3 text-[10px] font-black text-zinc-200 hover:bg-white/[0.09] hover:text-white"
                        >
                          <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                          영상 보기
                        </Button>
                        <Button
                          type="button"
                          onClick={() => selectVideo(video)}
                          className={`h-9 flex-1 text-xs font-black ${
                            selectedVideo
                              ? "bg-emerald-600 text-white hover:bg-emerald-500"
                              : "bg-orange-500 text-white hover:bg-orange-400"
                          }`}
                        >
                          {selectedVideo ? (
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                          ) : null}
                          {selectedVideo ? "선택됨" : "이 소재 선택"}
                        </Button>
                      </div>
                    </div>
                  </article>
                )
              })}
              {!filteredVideos.length ? (
                <div className="col-span-full rounded-2xl border border-dashed border-white/[0.08] py-16 text-center">
                  <Users className="mx-auto h-7 w-7 text-zinc-500" />
                  <p className="mt-3 text-sm font-bold text-zinc-300">
                    조건에 맞는 영상이 없습니다.
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-400">
                    채널을 추가하거나 필터 조건을 완화해주세요.
                  </p>
                </div>
              ) : null}
            </div>
            {hasMoreVideos ? (
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setVideoVisibleCount((count) => count + VIDEO_PAGE_SIZE)
                  }
                  className="h-10 border-white/15 bg-white/[0.04] px-5 text-xs font-black text-zinc-200 hover:bg-white/[0.09] hover:text-white"
                >
                  영상 더보기 ({visibleVideos.length}/{filteredVideos.length})
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {selected ? (
        <div className="flex flex-col gap-2 border-t border-orange-400/20 bg-orange-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[9px] font-black tracking-[0.14em] text-orange-400">
              SELECTED WINNER · 떡상 지수 {selected.outlierRatio.toFixed(1)}X
            </p>
            <p className="mt-1 truncate text-xs font-bold text-zinc-200">{selected.title}</p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-black text-orange-300">
            다음 단계에서 영상을 분석하고 상품을 검색합니다
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      ) : null}

      <Dialog
        open={Boolean(previewVideo)}
        onOpenChange={(open) => {
          if (!open) setPreviewVideo(null)
        }}
      >
        <DialogContent className="max-w-lg border-white/15 bg-[#11100e] p-4 text-white">
          <DialogTitle className="line-clamp-2 pr-8 text-sm font-black">
            {previewVideo?.title}
          </DialogTitle>
          <div className="mx-auto aspect-[9/16] h-[72vh] max-h-[760px] overflow-hidden rounded-2xl bg-black">
            {previewVideo ? (
              <iframe
                src={`https://www.youtube.com/embed/${previewVideo.videoId}?autoplay=1&rel=0`}
                title={previewVideo.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog}>
        <DialogContent className="border-white/10 bg-[#12151c] text-zinc-100 sm:max-w-md">
          <DialogTitle>새 채널 그룹</DialogTitle>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-zinc-400">그룹 이름</p>
              <Input
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="예: 뷰티 특화, 육아템"
                className="border-white/10 bg-black/30 text-zinc-100"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleCreateGroup()
                }}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-zinc-400">설명 (선택)</p>
              <Input
                value={newGroupDescription}
                onChange={(event) => setNewGroupDescription(event.target.value)}
                placeholder="이 그룹에 모을 채널 성격"
                className="border-white/10 bg-black/30 text-zinc-100"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateGroupDialog(false)}
                className="border-white/20 bg-transparent text-zinc-200 hover:bg-white/10 hover:text-white"
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={() => void handleCreateGroup()}
                disabled={isCreatingGroup || !newGroupName.trim()}
                className="bg-orange-500 text-white hover:bg-orange-400"
              >
                {isCreatingGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                그룹 만들기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function FilterButtons({
  items,
  value,
  onChange,
  activeClass,
}: {
  items: ReadonlyArray<{ id: string; label: string }>
  value: string
  onChange: (value: string) => void
  activeClass: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-lg border px-3 py-1.5 font-bold transition ${
            value === item.id
              ? `${activeClass} border-transparent`
              : "border-white/[0.14] bg-white/[0.05] text-zinc-300 hover:bg-white/[0.09] hover:text-white"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

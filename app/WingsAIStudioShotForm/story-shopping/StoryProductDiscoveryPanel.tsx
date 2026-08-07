"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Check,
  ExternalLink,
  Flame,
  Globe2,
  Loader2,
  Play,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { StoryReferenceVideo, StoryShoppingBrief } from "./story-types"

type WeeklyBestItem = {
  rank: number
  keyword: string
  score: number
  reason: string
  naverSignal: string
  coupangSignal: string
}

type TrendingProduct = {
  rank: number
  productId: string
  productName: string
  productPrice: number
  productImage: string
  productUrl: string
  categoryName: string
  isRocket: boolean
}

const CATEGORIES = [
  { id: "1014", label: "생활" },
  { id: "1013", label: "주방" },
  { id: "1010", label: "뷰티" },
  { id: "1016", label: "가전" },
  { id: "1029", label: "반려동물" },
] as const

const compactNumber = (value: number) =>
  new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(value)

export function StoryProductDiscoveryPanel({
  brief,
  onChange,
}: {
  brief: StoryShoppingBrief
  onChange: (brief: StoryShoppingBrief) => void
}) {
  const [weeklyBest, setWeeklyBest] = useState<WeeklyBestItem[]>([])
  const [products, setProducts] = useState<TrendingProduct[]>([])
  const [categoryId, setCategoryId] = useState("1014")
  const [isLoadingTrends, setIsLoadingTrends] = useState(false)
  const [trendError, setTrendError] = useState("")
  const [videoQuery, setVideoQuery] = useState(brief.productName)
  const [videos, setVideos] = useState<StoryReferenceVideo[]>(brief.referenceVideos)
  const [isLoadingVideos, setIsLoadingVideos] = useState(false)
  const [videoError, setVideoError] = useState("")
  const [globalQuery, setGlobalQuery] = useState("")

  const loadTrends = useCallback(async (nextCategoryId = categoryId) => {
    setIsLoadingTrends(true)
    setTrendError("")
    try {
      const openAiKey =
        typeof window !== "undefined"
          ? (localStorage.getItem("shotform_openai_api_key") || "").trim()
          : ""
      const [weeklyResponse, productResponse] = await Promise.all([
        fetch("/api/shotform/keyword-analysis/weekly-best", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: openAiKey || undefined }),
        }),
        fetch(
          `/api/shotform/keyword-analysis/coupang?mode=best&categoryId=${encodeURIComponent(nextCategoryId)}`
        ),
      ])
      const weeklyData = await weeklyResponse.json()
      const productData = await productResponse.json()
      if (!weeklyResponse.ok) throw new Error(weeklyData.error || "주간 트렌드를 불러오지 못했습니다.")
      if (!productResponse.ok) {
        throw new Error(productData.error || "인기 상품을 불러오지 못했습니다.")
      }
      setWeeklyBest(Array.isArray(weeklyData.items) ? weeklyData.items : [])
      setProducts(Array.isArray(productData.products) ? productData.products.slice(0, 8) : [])
    } catch (reason) {
      setTrendError(reason instanceof Error ? reason.message : "트렌드 조회에 실패했습니다.")
    } finally {
      setIsLoadingTrends(false)
    }
  }, [categoryId])

  useEffect(() => {
    void loadTrends(categoryId)
  }, [categoryId, loadTrends])

  const searchVideos = async (query = videoQuery) => {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return
    setVideoQuery(normalizedQuery)
    setIsLoadingVideos(true)
    setVideoError("")
    try {
      const youtubeApiKey =
        (typeof window !== "undefined" &&
          (localStorage.getItem("shotform_youtube_data_api_key") || "").trim()) ||
        ""
      if (!youtubeApiKey) {
        throw new Error("설정에서 YouTube Data API Key를 저장한 뒤 다시 시도해주세요.")
      }
      const response = await fetch(
        `/api/shotform/story-shopping/youtube-references?q=${encodeURIComponent(
          normalizedQuery
        )}&apiKey=${encodeURIComponent(youtubeApiKey)}`
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "해외 관련 영상을 찾지 못했습니다.")
      const nextVideos = Array.isArray(data.items) ? data.items : []
      setVideos(nextVideos)
      setGlobalQuery(String(data.searchQuery || ""))
    } catch (reason) {
      setVideoError(reason instanceof Error ? reason.message : "영상 검색에 실패했습니다.")
    } finally {
      setIsLoadingVideos(false)
    }
  }

  const selectKeyword = (item: WeeklyBestItem) => {
    const next = {
      ...brief,
      productName: item.keyword,
      trendSource: `AI 주간 BEST ${item.rank}위 · ${item.reason}`,
    }
    onChange(next)
    setVideoQuery(item.keyword)
    void searchVideos(item.keyword)
  }

  const selectProduct = (product: TrendingProduct) => {
    const selectedCategory =
      CATEGORIES.find((category) => category.id === categoryId)?.label || product.categoryName
    const next = {
      ...brief,
      productName: product.productName,
      productDescription: [
        brief.productDescription,
        `${product.categoryName || selectedCategory} 인기 상품`,
        product.isRocket ? "로켓배송 상품" : "",
      ]
        .filter(Boolean)
        .join("\n"),
      productImage: product.productImage,
      productUrl: product.productUrl,
      priceBenefit: `${product.productPrice.toLocaleString("ko-KR")}원`,
      trendSource: `쿠팡 ${selectedCategory} 베스트 ${product.rank}위`,
    }
    onChange(next)
    setVideoQuery(product.productName)
    void searchVideos(product.productName)
  }

  const toggleVideo = (video: StoryReferenceVideo) => {
    const exists = brief.referenceVideos.some((item) => item.id === video.id)
    const selected = exists
      ? brief.referenceVideos.filter((item) => item.id !== video.id)
      : [...brief.referenceVideos, video].slice(-5)
    onChange({ ...brief, referenceVideos: selected })
  }

  return (
    <section className="mb-6 overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#11100e]/95 shadow-2xl shadow-black/25">
      <div className="grid border-b border-white/[0.07] lg:grid-cols-[1fr_360px]">
        <div className="p-6 md:p-7">
          <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.2em] text-orange-400">
            <Flame className="h-3.5 w-3.5" />
            LIVE PRODUCT DISCOVERY
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white md:text-3xl">
            지금 수요가 확인된 제품에서 시작하세요.
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-zinc-500">
            네이버 관심도와 쿠팡 베스트 신호를 확인하고, 선택한 제품의 해외 YouTube 영상을
            자동으로 수집합니다.
          </p>
        </div>
        <div className="grid grid-cols-2 border-t border-white/[0.07] bg-black/20 lg:border-l lg:border-t-0">
          <div className="flex flex-col items-center justify-center border-r border-white/[0.07] p-5">
            <TrendingUp className="h-4 w-4 text-orange-400" />
            <p className="mt-2 text-[9px] font-bold tracking-[0.12em] text-zinc-600">TREND</p>
            <p className="mt-1 text-xs font-black text-zinc-200">실시간 수요</p>
          </div>
          <div className="flex flex-col items-center justify-center p-5">
            <Globe2 className="h-4 w-4 text-sky-400" />
            <p className="mt-2 text-[9px] font-bold tracking-[0.12em] text-zinc-600">SOURCE</p>
            <p className="mt-1 text-xs font-black text-zinc-200">GLOBAL VIDEO</p>
          </div>
        </div>
      </div>

      {brief.winningContent ? (
        <div className="flex flex-col gap-3 border-b border-orange-400/15 bg-orange-500/[0.05] p-4 sm:flex-row sm:items-center">
          <div className="h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-black">
            <img
              src={brief.winningContent.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black tracking-[0.14em] text-orange-400">
              SELECTED WINNING CONTENT · {brief.winningContent.outlierRatio.toFixed(1)}X
            </p>
            <p className="mt-1 truncate text-sm font-black text-zinc-100">
              {brief.winningContent.title}
            </p>
            <p className="mt-1 text-[10px] text-zinc-600">
              이 영상의 문제·행동·반전과 자연스럽게 연결되는 상품을 선택하세요.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-2">
        <div className="border-b border-white/[0.07] p-5 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black tracking-[0.16em] text-orange-400">
                WEEKLY SIGNAL
              </p>
              <p className="mt-1 text-sm font-black text-white">AI 이번 주 BEST 3</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void loadTrends(categoryId)}
              disabled={isLoadingTrends}
              className="text-zinc-500 hover:bg-white/5 hover:text-white"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoadingTrends ? "animate-spin" : ""}`} />
              새로고침
            </Button>
          </div>
          <div className="space-y-2">
            {weeklyBest.map((item) => (
              <button
                key={item.keyword}
                type="button"
                onClick={() => selectKeyword(item)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                  brief.productName === item.keyword
                    ? "border-orange-400/40 bg-orange-500/10"
                    : "border-white/[0.07] bg-black/20 hover:border-orange-400/25"
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 font-mono text-xs font-black text-orange-300">
                  {item.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-black text-zinc-100">{item.keyword}</p>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                      {item.score}점
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[10px] text-zinc-600">{item.reason}</p>
                </div>
                {brief.productName === item.keyword ? (
                  <Check className="h-4 w-4 text-orange-400" />
                ) : null}
              </button>
            ))}
            {isLoadingTrends && !weeklyBest.length ? (
              <div className="flex min-h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
              </div>
            ) : null}
          </div>

          <div className="mb-3 mt-6 flex items-center justify-between">
            <p className="text-sm font-black text-white">쿠팡 카테고리 베스트</p>
            <ShoppingBag className="h-4 w-4 text-orange-400" />
          </div>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${
                  categoryId === category.id
                    ? "border-orange-400 bg-orange-500 text-white"
                    : "border-white/[0.08] bg-white/[0.03] text-zinc-500"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
          {trendError ? (
            <p className="rounded-lg border border-red-400/20 bg-red-500/10 p-2 text-[10px] text-red-200">
              {trendError}
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {products.map((product) => (
              <button
                key={product.productId}
                type="button"
                onClick={() => selectProduct(product)}
                className={`group overflow-hidden rounded-xl border text-left transition ${
                  brief.productName === product.productName
                    ? "border-orange-400/50 bg-orange-500/10"
                    : "border-white/[0.07] bg-black/20 hover:border-orange-400/25"
                }`}
              >
                <div className="flex gap-3 p-2.5">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white">
                    {product.productImage ? (
                      <img
                        src={product.productImage}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-black text-white">
                      {product.rank}
                    </span>
                  </div>
                  <div className="min-w-0 py-0.5">
                    <p className="line-clamp-2 text-[11px] font-bold leading-4 text-zinc-200">
                      {product.productName}
                    </p>
                    <p className="mt-1 text-xs font-black text-orange-300">
                      {product.productPrice.toLocaleString("ko-KR")}원
                    </p>
                    {product.isRocket ? (
                      <p className="mt-0.5 text-[9px] font-bold text-sky-300">로켓배송</p>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          <div className="mb-4">
            <p className="text-[9px] font-black tracking-[0.16em] text-sky-400">
              GLOBAL YOUTUBE REFERENCES
            </p>
            <p className="mt-1 text-sm font-black text-white">해외 관련 영상 수집</p>
            <p className="mt-1 text-[10px] leading-5 text-zinc-600">
              영상은 그대로 복제하지 않고 후킹·구도·제품 시연 방식만 분석합니다.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <Input
                value={videoQuery}
                onChange={(event) => setVideoQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void searchVideos()
                }}
                placeholder="상품명으로 해외 영상 검색"
                className="h-10 border-white/10 bg-black/30 pl-9 text-zinc-100"
              />
            </div>
            <Button
              type="button"
              onClick={() => void searchVideos()}
              disabled={isLoadingVideos || !videoQuery.trim()}
              className="bg-sky-600 text-white hover:bg-sky-500"
            >
              {isLoadingVideos ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe2 className="h-4 w-4" />
              )}
            </Button>
          </div>
          {globalQuery ? (
            <p className="mt-2 truncate font-mono text-[9px] text-zinc-700">
              GLOBAL QUERY · {globalQuery}
            </p>
          ) : null}
          {videoError ? (
            <p className="mt-3 rounded-lg border border-red-400/20 bg-red-500/10 p-2 text-[10px] text-red-200">
              {videoError}
            </p>
          ) : null}

          <div className="mt-4 grid max-h-[620px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {videos.map((video) => {
              const selected = brief.referenceVideos.some((item) => item.id === video.id)
              return (
                <div
                  key={video.id}
                  className={`overflow-hidden rounded-xl border transition ${
                    selected
                      ? "border-sky-400/50 bg-sky-500/10"
                      : "border-white/[0.07] bg-black/20"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleVideo(video)}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-video overflow-hidden bg-black">
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 hover:scale-105"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur">
                          {selected ? <Check className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="line-clamp-2 text-[11px] font-bold leading-4 text-zinc-200">
                        {video.title}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[9px] text-zinc-600">
                        <span className="truncate">{video.channelTitle}</span>
                        <span>{compactNumber(video.viewCount)} views</span>
                      </div>
                    </div>
                  </button>
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1 border-t border-white/[0.06] py-1.5 text-[9px] text-zinc-600 hover:text-sky-300"
                  >
                    YouTube에서 확인
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )
            })}
            {!videos.length && !isLoadingVideos ? (
              <div className="col-span-full flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] text-center">
                <Sparkles className="h-6 w-6 text-zinc-700" />
                <p className="mt-2 text-xs font-bold text-zinc-500">제품을 선택하면 자동 검색됩니다.</p>
                <p className="mt-1 text-[10px] text-zinc-700">최대 5개 영상을 참고 자료로 선택할 수 있습니다.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

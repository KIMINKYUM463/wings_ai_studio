"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Bot,
  Check,
  Crown,
  ExternalLink,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
  Sparkles,
  ZoomIn,
} from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type {
  StoryCoupangProduct,
  StoryProductAnalysis,
  StoryShoppingBrief,
  StoryWinningContent,
} from "./story-types"
import { StoryProductCollectorPanel } from "./StoryProductCollectorPanel"

export function StoryProductSearchPanel({
  brief,
  onChange,
}: {
  brief: StoryShoppingBrief
  onChange: (brief: StoryShoppingBrief) => void
}) {
  const storedAnalysis =
    brief.productAnalysis?.videoId === brief.winningContent?.videoId
      ? brief.productAnalysis ?? null
      : null
  const storedSearch =
    brief.productSearch?.videoId === brief.winningContent?.videoId
      ? brief.productSearch ?? null
      : null
  const [analysis, setAnalysis] = useState<StoryProductAnalysis | null>(storedAnalysis)
  const [query, setQuery] = useState(
    storedSearch?.query || storedAnalysis?.searchKeyword || brief.productName
  )
  const [products, setProducts] = useState<StoryCoupangProduct[]>(
    storedSearch?.products || []
  )
  const [analysisStage, setAnalysisStage] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState("")
  const [previewImage, setPreviewImage] = useState<{ title: string; url: string } | null>(null)
  const analyzedVideoIdRef = useRef("")
  const activeVideoIdRef = useRef(brief.winningContent?.videoId || "")

  const searchCoupang = useCallback(async (keyword: string, alternatives: string[] = []) => {
    const normalized = keyword.trim()
    if (!normalized) return
    const videoId = activeVideoIdRef.current
    setQuery(normalized)
    setIsSearching(true)
    setError("")
    try {
      const candidates = Array.from(
        new Set([normalized, ...alternatives.map((item) => item.trim())].filter(Boolean))
      )
      let nextProducts: StoryCoupangProduct[] = []
      let matchedQuery = normalized
      for (const candidate of candidates) {
        const response = await fetch(
          `/api/shotform/keyword-analysis/coupang?mode=search&query=${encodeURIComponent(candidate)}`
        )
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "쿠팡 상품을 검색하지 못했습니다.")
        nextProducts = Array.isArray(data.products) ? data.products : []
        matchedQuery = candidate
        if (nextProducts.length > 0) break
      }
      if (activeVideoIdRef.current !== videoId) return
      setQuery(matchedQuery)
      setProducts(nextProducts)
      if (!nextProducts.length) {
        setError("일치하는 쿠팡 상품을 찾지 못했습니다. 검색어를 짧게 수정해보세요.")
      }
      onChange({
        ...brief,
        productSearch: {
          videoId,
          query: matchedQuery,
          products: nextProducts,
        },
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "쿠팡 상품 검색에 실패했습니다.")
    } finally {
      setIsSearching(false)
    }
  }, [brief, onChange])

  const analyzeVideo = useCallback(
    async (video: StoryWinningContent) => {
      setIsAnalyzing(true)
      setError("")
      setProducts([])
      setAnalysis(null)
      try {
        setAnalysisStage("YouTube 쇼핑 태그 확인 중")
        try {
          const tagResponse = await fetch(
            `/api/shotform/story-shopping/youtube-shopping-tags?videoId=${encodeURIComponent(video.videoId)}`
          )
          const tagData = await tagResponse.json()
          const shoppingTags = Array.isArray(tagData.products) ? tagData.products : []
          if (tagResponse.ok && shoppingTags.length > 0) {
            const primaryTag = shoppingTags[0]
            const nextAnalysis: StoryProductAnalysis = {
              videoId: video.videoId,
              source: "youtube-shopping-tag",
              productName: String(primaryTag.title || "").trim(),
              searchKeyword: String(primaryTag.title || "").trim(),
              productDescription: [
                "영상에 등록된 YouTube 쇼핑 태그에서 확인된 상품입니다.",
                primaryTag.price ? `표시 가격: ${primaryTag.price}` : "",
              ]
                .filter(Boolean)
                .join("\n"),
              confidence: 100,
              evidence: ["YouTube 공개 쇼핑 태그에서 직접 확인"],
              analysisSummary: `영상에 연결된 쇼핑 태그 ${shoppingTags.length}개를 확인했습니다.`,
              hasTranscript: false,
              shoppingTags,
            }
            setAnalysis(nextAnalysis)
            onChange({
              ...brief,
              productName: nextAnalysis.productName,
              productDescription: nextAnalysis.productDescription,
              trendSource: "YouTube 쇼핑 태그 직접 확인",
              productAnalysis: nextAnalysis,
              productSearch: undefined,
              selectedShoppingTag: undefined,
              selectedProductVideoId: undefined,
              selectedProductSource: undefined,
              collectorData: undefined,
              storyTemplateRecommendation: undefined,
              generatedStory: undefined,
              voiceData: undefined,
              sceneAssets: undefined,
            })
            setQuery("")
            return
          }
        } catch {
          // 공개 쇼핑 태그를 확인할 수 없으면 AI 영상 분석으로 전환합니다.
        }

        setAnalysisStage("영상 자막과 메타데이터 수집 중")
        let transcript = ""
        try {
          const transcriptResponse = await fetch("/api/youmaker/get-video-transcript", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId: video.videoId }),
          })
          const transcriptData = await transcriptResponse.json()
          transcript = String(transcriptData.transcript || "")
        } catch {
          // 자막이 없어도 제목·설명·썸네일로 계속 분석합니다.
        }

        setAnalysisStage("AI가 영상 속 제품을 식별하는 중")
        const apiKey =
          typeof window !== "undefined"
            ? (localStorage.getItem("shotform_openai_api_key") || "").trim()
            : ""
        const response = await fetch("/api/shotform/story-shopping/analyze-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: video.title,
            description: video.description,
            thumbnailUrl: video.thumbnailUrl,
            transcript,
            apiKey: apiKey || undefined,
          }),
        })
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || "영상 속 제품을 분석하지 못했습니다.")
        }

        const nextAnalysis: StoryProductAnalysis = {
          ...(data.analysis as Omit<StoryProductAnalysis, "videoId">),
          videoId: video.videoId,
          source: "ai-analysis",
        }
        setAnalysis(nextAnalysis)
        onChange({
          ...brief,
          productName: nextAnalysis.productName,
          productDescription: nextAnalysis.productDescription,
          trendSource: `선택 영상 AI 분석 · 신뢰도 ${nextAnalysis.confidence}%`,
          productAnalysis: nextAnalysis,
          productSearch: undefined,
          selectedShoppingTag: undefined,
          selectedProductVideoId: undefined,
          selectedProductSource: undefined,
          collectorData: undefined,
          storyTemplateRecommendation: undefined,
          generatedStory: undefined,
          voiceData: undefined,
          sceneAssets: undefined,
        })
        setQuery(nextAnalysis.searchKeyword)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "영상 분석에 실패했습니다.")
      } finally {
        setAnalysisStage("")
        setIsAnalyzing(false)
      }
    },
    [brief, onChange]
  )

  useEffect(() => {
    const videoId = brief.winningContent?.videoId || ""
    activeVideoIdRef.current = videoId
    if (brief.productSearch?.videoId === videoId) {
      setQuery(brief.productSearch.query)
      setProducts(brief.productSearch.products)
      return
    }
    setProducts([])
    setQuery(
      brief.productAnalysis?.videoId === videoId
        ? brief.productAnalysis.source === "youtube-shopping-tag"
          ? ""
          : brief.productAnalysis.searchKeyword
        : ""
    )
  }, [brief.productAnalysis, brief.productSearch, brief.winningContent?.videoId])

  useEffect(() => {
    const video = brief.winningContent
    if (!video) return
    if (brief.productAnalysis?.videoId === video.videoId) {
      const hasStaleShoppingLinks =
        brief.productAnalysis.source === "youtube-shopping-tag" &&
        brief.productAnalysis.shoppingTags?.some(
          (tag) => !tag.url || !/coupang\.com/i.test(tag.url)
        )
      if (!hasStaleShoppingLinks) {
        analyzedVideoIdRef.current = video.videoId
        setAnalysis(brief.productAnalysis)
        setQuery(
          brief.productAnalysis.source === "youtube-shopping-tag"
            ? ""
            : brief.productAnalysis.searchKeyword
        )
        return
      }
    }
    if (analyzedVideoIdRef.current === video.videoId) return
    analyzedVideoIdRef.current = video.videoId
    void analyzeVideo(video)
  }, [analyzeVideo, brief.productAnalysis, brief.winningContent])

  const selectProduct = (product: StoryCoupangProduct) => {
    onChange({
      ...brief,
      productName: product.productName,
      productDescription: [
        analysis?.productDescription,
        product.categoryName ? `쿠팡 카테고리: ${product.categoryName}` : "",
        product.isRocket ? "로켓배송 상품" : "",
      ]
        .filter(Boolean)
        .join("\n"),
      productImage: product.productImage,
      productUrl: product.productUrl,
      priceBenefit: `${product.productPrice.toLocaleString("ko-KR")}원`,
      trendSource: `선택 영상 분석 후 쿠팡 검색 · ${query}`,
      selectedShoppingTag: undefined,
      selectedProductVideoId: brief.winningContent?.videoId,
      selectedProductSource: "coupang-search",
      collectorData: undefined,
      storyTemplateRecommendation: undefined,
      generatedStory: undefined,
      voiceData: undefined,
      sceneAssets: undefined,
    })
  }

  const selectShoppingTag = (
    tag: NonNullable<StoryProductAnalysis["shoppingTags"]>[number]
  ) => {
    const videoId = brief.winningContent?.videoId
    if (!videoId) return
    onChange({
      ...brief,
      productName: tag.title,
      productDescription: [
        "영상에 등록된 YouTube 쇼핑 태그 상품입니다.",
        tag.price ? `표시 가격: ${tag.price}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      productImage: tag.imageUrl,
      productUrl: tag.url,
      priceBenefit: tag.price,
      trendSource: "YouTube 쇼핑 태그 상품 선택",
      selectedShoppingTag: { videoId, ...tag },
      selectedProductVideoId: videoId,
      selectedProductSource: "youtube-shopping-tag",
      collectorData: undefined,
      storyTemplateRecommendation: undefined,
      generatedStory: undefined,
      voiceData: undefined,
      sceneAssets: undefined,
    })
  }

  const selectedVideo = brief.winningContent

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-orange-400/15 bg-[linear-gradient(145deg,#15130f_0%,#0d0d0c_48%,#12100e_100%)] shadow-[0_28px_90px_rgba(0,0,0,0.45)]">
      <div className="pointer-events-none absolute -right-32 -top-40 h-80 w-80 rounded-full bg-orange-500/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute -left-32 top-64 h-72 w-72 rounded-full bg-cyan-500/[0.04] blur-3xl" />
      <div className="relative grid gap-6 border-b border-white/[0.08] p-6 md:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/[0.08] px-3 py-1.5 text-[9px] font-black tracking-[0.2em] text-orange-300">
            <PackageSearch className="h-3.5 w-3.5" />
            VIDEO TO COUPANG
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-[-0.035em] text-white md:text-3xl">
            영상 속 제품을 분석하고 쿠팡에서 찾습니다.
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-zinc-300">
            공개 쇼핑 태그를 먼저 확인하고, 태그가 없으면 제목·설명·자막·썸네일 AI
            분석으로 구매 가능한 상품 후보를 연결합니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.06] px-4 py-3">
            <p className="text-[9px] font-black tracking-[0.12em] text-emerald-400">STEP 01</p>
            <p className="mt-1 text-xs font-black text-white">영상 제품 분석</p>
          </div>
          <div className="rounded-2xl border border-orange-400/15 bg-orange-500/[0.06] px-4 py-3">
            <p className="text-[9px] font-black tracking-[0.12em] text-orange-400">STEP 02</p>
            <p className="mt-1 text-xs font-black text-white">쿠팡 상품 매칭</p>
          </div>
        </div>
      </div>

      {selectedVideo ? (
        <div className="relative grid gap-4 border-b border-white/[0.08] p-5 md:p-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 shadow-xl">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
              <img
                src={selectedVideo.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <span className="absolute bottom-2 left-2 rounded-md border border-white/15 bg-black/65 px-2 py-1 text-[9px] font-black text-white backdrop-blur">
                분석 원본 영상
              </span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm font-black text-white">
              {selectedVideo.title}
            </p>
            <p className="mt-1 text-[10px] text-zinc-400">{selectedVideo.channelTitle}</p>
          </div>

          <div className="flex min-h-52 flex-col justify-center rounded-2xl border border-orange-400/15 bg-[linear-gradient(135deg,rgba(249,115,22,0.08),rgba(255,255,255,0.025))] p-5 shadow-xl md:p-7">
            {isAnalyzing ? (
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
                </span>
                <div>
                  <p className="font-black text-white">{analysisStage}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    제품명과 특징을 근거 기반으로 확인하고 있습니다.
                  </p>
                </div>
              </div>
            ) : analysis ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-black ${
                      analysis.source === "youtube-shopping-tag"
                        ? "border-amber-300/30 bg-amber-500/15 text-amber-200"
                        : "border-emerald-400/20 bg-emerald-500/15 text-emerald-300"
                    }`}
                  >
                    {analysis.source === "youtube-shopping-tag"
                      ? "공개 쇼핑 태그 확인"
                      : `AI 분석 신뢰도 ${analysis.confidence}%`}
                  </span>
                  <span className="rounded-full border border-sky-400/20 bg-sky-500/15 px-3 py-1 text-[10px] font-bold text-sky-300">
                    {analysis.source === "youtube-shopping-tag"
                      ? `태그 ${analysis.shoppingTags?.length || 1}개`
                      : analysis.hasTranscript
                        ? "자막 포함 분석"
                        : "영상 정보 기반 분석"}
                  </span>
                </div>
                <p className="mt-4 text-[10px] font-black text-orange-400">
                  {analysis.source === "youtube-shopping-tag"
                    ? "쇼핑 태그 대표 상품"
                    : "AI가 영상에서 찾은 제품"}
                </p>
                <p className="mt-1 bg-gradient-to-r from-white to-orange-200 bg-clip-text text-2xl font-black text-transparent">
                  {analysis.productName}
                </p>
                <p className="mt-2 text-xs leading-6 text-zinc-300">
                  {analysis.analysisSummary || analysis.productDescription}
                </p>
                {analysis.evidence.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {analysis.evidence.map((evidence) => (
                      <span
                        key={evidence}
                        className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-[9px] text-zinc-300"
                      >
                        {evidence}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-center">
                <Bot className="mx-auto h-8 w-8 text-zinc-500" />
                <p className="mt-3 text-sm font-bold text-zinc-300">
                  선택 영상을 분석할 준비가 되었습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {analysis?.source === "youtube-shopping-tag" && analysis.shoppingTags?.length ? (
        <div className="relative border-b border-amber-300/10 bg-amber-500/[0.025] p-5 md:p-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[9px] font-black tracking-[0.17em] text-amber-400">
                YOUTUBE SHOPPING TAGS
              </p>
              <p className="mt-1 text-base font-black text-white">
                영상에 등록된 상품{" "}
                <span className="text-amber-300">{analysis.shoppingTags.length}</span>개
              </p>
            </div>
            <p className="text-[10px] text-zinc-400">
              상품 하나를 선택한 뒤 다음 단계로 진행하세요.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {analysis.shoppingTags.map((tag, index) => {
              const selectedShoppingTag = brief.selectedShoppingTag
              const selectedTag =
                selectedShoppingTag?.videoId === brief.winningContent?.videoId &&
                selectedShoppingTag?.url === tag.url &&
                selectedShoppingTag?.title === tag.title
              return (
                <motion.article
                key={`${tag.title}-${tag.price}-${index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.2) }}
                className={`overflow-hidden rounded-2xl border bg-gradient-to-br shadow-xl ${
                  selectedTag
                    ? "border-emerald-400/55 from-emerald-500/15 to-black/30 shadow-emerald-950/30"
                    : "border-amber-300/15 from-amber-500/[0.08] to-black/30"
                }`}
              >
                <div className="flex min-h-24 gap-3 p-3">
                  {tag.imageUrl ? (
                    <button
                      type="button"
                      onClick={() => setPreviewImage({ title: tag.title, url: tag.imageUrl })}
                      className="group/tag-image relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white"
                      title="쇼핑 태그 이미지 확대"
                    >
                      <img
                        src={tag.imageUrl}
                        alt={tag.title}
                        className="h-full w-full object-cover transition duration-300 group-hover/tag-image:scale-105"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover/tag-image:bg-black/35 group-hover/tag-image:opacity-100">
                        <ZoomIn className="h-5 w-5 text-white" />
                      </span>
                    </button>
                  ) : (
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
                      <PackageSearch className="h-6 w-6 text-amber-300" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-black text-amber-400">TAG {index + 1}</span>
                    <p className="mt-1 line-clamp-3 text-xs font-bold leading-5 text-zinc-100">
                      {tag.title}
                    </p>
                    {tag.price ? (
                      <p className="mt-1 text-xs font-black text-amber-300">{tag.price}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2 border-t border-white/10 bg-black/20 p-2">
                  {tag.url && /coupang\.com/i.test(tag.url) ? (
                    <a
                      href={tag.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-300/20 bg-amber-500/10 text-amber-200 transition hover:bg-amber-500 hover:text-white"
                      title="쿠팡 상품 바로가기"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  <Button
                    type="button"
                    onClick={() => selectShoppingTag(tag)}
                    className={`h-9 flex-1 text-[11px] font-black ${
                      selectedTag
                        ? "bg-emerald-600 text-white hover:bg-emerald-500"
                        : "bg-amber-500/15 text-amber-100 hover:bg-amber-500 hover:text-white"
                    }`}
                  >
                    {selectedTag ? <Check className="mr-1.5 h-3.5 w-3.5" /> : null}
                    {selectedTag ? "선택됨" : "이 상품 선택"}
                  </Button>
                </div>
              </motion.article>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="relative bg-black/[0.12] p-5 md:p-7">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-2 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void searchCoupang(query)
              }}
              placeholder="영상 속 제품명 또는 쿠팡 검색어"
              className="h-11 border-transparent bg-transparent pl-9 text-white shadow-none focus-visible:ring-orange-400/40"
            />
          </div>
          <Button
            type="button"
            onClick={() => void searchCoupang(query)}
            disabled={isSearching || !query.trim()}
            className="h-11 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 font-black text-white shadow-lg shadow-orange-950/40 hover:from-orange-400 hover:to-amber-400"
          >
            {isSearching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            쿠팡 검색
          </Button>
          {selectedVideo ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void analyzeVideo(selectedVideo)}
              disabled={isAnalyzing}
              className="h-11 rounded-xl border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isAnalyzing ? "animate-spin" : ""}`} />
              영상 재분석
            </Button>
          ) : null}
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </p>
        ) : null}

        {products.length ? (
          <div className="mb-3 mt-6 flex items-end justify-between">
            <div>
              <p className="text-[9px] font-black tracking-[0.16em] text-orange-400">
                COUPANG MATCHING RESULT
              </p>
              <p className="mt-1 text-base font-black text-white">
                검색 결과 <span className="text-orange-300">{products.length}</span>개
              </p>
            </div>
            <p className="text-[10px] text-zinc-400">이미지를 누르면 크게 볼 수 있습니다</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product, index) => {
            const selected = brief.productUrl === product.productUrl
            return (
              <motion.article
                key={product.productId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: Math.min(index * 0.035, 0.25) }}
                whileHover={{ y: -3 }}
                className={`overflow-hidden rounded-2xl border shadow-xl transition-colors ${
                  selected
                    ? "border-emerald-400/45 bg-gradient-to-br from-emerald-500/10 to-black/30 shadow-emerald-950/25"
                    : "border-white/10 bg-gradient-to-br from-white/[0.045] to-black/25 hover:border-orange-400/30"
                }`}
              >
                <div className="flex gap-3 p-3">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewImage({
                        title: product.productName,
                        url: product.productImage,
                      })
                    }
                    className="group/image relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white"
                    title="상품 이미지 확대"
                  >
                    <img
                      src={product.productImage}
                      alt={product.productName}
                      className="h-full w-full object-cover transition duration-300 group-hover/image:scale-105"
                    />
                    <span className="absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-md border border-white/20 bg-black/70 px-1.5 text-[9px] font-black text-white backdrop-blur">
                      {index < 3 ? <Crown className="mr-0.5 h-3 w-3 text-amber-300" /> : null}
                      {product.rank || index + 1}
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover/image:bg-black/35 group-hover/image:opacity-100">
                      <ZoomIn className="h-6 w-6 text-white" />
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-3 text-xs font-bold leading-5 text-zinc-100">
                      {product.productName}
                    </p>
                    <p className="mt-2 text-sm font-black text-orange-300">
                      {product.productPrice.toLocaleString("ko-KR")}원
                    </p>
                    {product.isRocket ? (
                      <p className="mt-1 text-[9px] font-bold text-sky-300">로켓배송</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2 border-t border-white/[0.08] bg-black/20 p-2">
                  <a
                    href={product.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-zinc-300 transition hover:border-orange-400/30 hover:text-white"
                    title="쿠팡에서 보기"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <Button
                    type="button"
                    onClick={() => selectProduct(product)}
                    className={`h-9 flex-1 font-black ${
                      selected
                        ? "bg-emerald-600 text-white hover:bg-emerald-500"
                        : "border border-orange-400/25 bg-orange-500/10 text-orange-200 hover:bg-orange-500 hover:text-white"
                    }`}
                  >
                    {selected ? <Check className="mr-1.5 h-4 w-4" /> : null}
                    {selected ? "선택됨" : "이 상품 선택"}
                  </Button>
                </div>
              </motion.article>
            )
          })}
        </div>

        {!products.length && !isSearching && !isAnalyzing ? (
          <div className="mt-5 flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
            <Sparkles className="h-7 w-7 text-zinc-500" />
            <p className="mt-3 text-sm font-bold text-zinc-300">
              분석된 검색어를 확인하고 쿠팡 검색 버튼을 눌러주세요.
            </p>
          </div>
        ) : null}
      </div>

      {brief.selectedProductVideoId === brief.winningContent?.videoId ? (
        <div className="border-t border-white/10 p-4 md:p-5">
          <StoryProductCollectorPanel brief={brief} onChange={onChange} />
        </div>
      ) : null}

      <Dialog
        open={Boolean(previewImage)}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null)
        }}
      >
        <DialogContent className="max-w-3xl border-white/15 bg-[#11100e] p-4 text-white">
          <DialogTitle className="pr-8 text-base font-black">
            {previewImage?.title}
          </DialogTitle>
          <div className="flex max-h-[75vh] items-center justify-center overflow-hidden rounded-2xl bg-white p-3">
            {previewImage ? (
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[70vh] max-w-full object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { BarChart3, Bot, Check, Copy, ExternalLink, Film, Loader2, RefreshCw, Rocket, ShoppingBag, Sparkles, Tag, Trophy, WalletCards } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CoupangRankedProduct } from "@/lib/shotform-keyword-analysis-types"

const COUPANG_RANK_CATEGORIES = [
  { id: "1015", label: "홈인테리어" },
  { id: "1012", label: "식품" },
  { id: "1014", label: "생활용품" },
  { id: "1024", label: "헬스/건강식품" },
  { id: "1010", label: "뷰티" },
  { id: "1016", label: "가전디지털" },
  { id: "1013", label: "주방용품" },
  { id: "1011", label: "출산/유아동" },
  { id: "1001", label: "여성패션" },
  { id: "1002", label: "남성패션" },
  { id: "1017", label: "스포츠/레저" },
  { id: "1018", label: "자동차용품" },
  { id: "1029", label: "반려동물용품" },
  { id: "1020", label: "완구/취미" },
  { id: "1021", label: "문구/오피스" },
] as const

type ProductInsight = {
  productId: string
  popularityReason: string
  videoHook: string
  videoConcept: string
}

export function CoupangShoppingRankPanel() {
  const [categoryId, setCategoryId] = useState("1012")
  const [products, setProducts] = useState<CoupangRankedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [copiedProductId, setCopiedProductId] = useState("")
  const [insights, setInsights] = useState<ProductInsight[]>([])
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightError, setInsightError] = useState("")

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError("")
    setInsights([])
    setInsightError("")
    try {
      const params = new URLSearchParams({ mode: "best", categoryId: id })
      const response = await fetch(`/api/shotform/keyword-analysis/coupang?${params.toString()}`, {
        cache: "no-store",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "쿠팡 카테고리 순위 조회 실패")
      setProducts(data.products || [])
    } catch (reason) {
      setProducts([])
      setError(reason instanceof Error ? reason.message : "쿠팡 카테고리 순위 조회 실패")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(categoryId)
  }, [categoryId, load])

  const categoryName =
    COUPANG_RANK_CATEGORIES.find((category) => category.id === categoryId)?.label || "식품"
  const prices = products.map((product) => product.productPrice).filter((price) => price > 0)
  const averagePrice = prices.length
    ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length)
    : 0
  const sortedPrices = [...prices].sort((a, b) => a - b)
  const medianPrice = sortedPrices.length ? sortedPrices[Math.floor(sortedPrices.length / 2)]! : 0
  const lowestPrice = sortedPrices[0] || 0
  const maxPrice = Math.max(1, ...prices)
  const rocketRatio = products.length
    ? Math.round((products.filter((product) => product.isRocket).length / products.length) * 100)
    : 0

  const analyzeTop3 = useCallback(async (topProducts: CoupangRankedProduct[], currentCategory: string) => {
    if (topProducts.length < 3) return
    setInsightLoading(true)
    setInsightError("")
    try {
      const apiKey =
        typeof window !== "undefined"
          ? localStorage.getItem("shotform_openai_api_key") || ""
          : ""
      const response = await fetch("/api/shotform/keyword-analysis/coupang-top3-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          categoryName: currentCategory,
          products: topProducts.slice(0, 3).map((product) => ({
            productId: product.productId,
            productName: product.productName,
            productPrice: product.productPrice,
            rank: product.rank,
            isRocket: product.isRocket,
          })),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "TOP 3 AI 분석 실패")
      setInsights(data.insights || [])
    } catch (reason) {
      setInsightError(reason instanceof Error ? reason.message : "TOP 3 AI 분석 실패")
    } finally {
      setInsightLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!loading && products.length >= 3) {
      void analyzeTop3(products.slice(0, 3), categoryName)
    }
  }, [loading, products, categoryName, analyzeTop3])

  const copyCoupasLink = async (product: CoupangRankedProduct) => {
    await navigator.clipboard.writeText(product.productUrl)
    setCopiedProductId(product.productId)
    window.setTimeout(() => setCopiedProductId(""), 1600)
  }

  return (
    <Card className="relative overflow-hidden border-amber-400/20 bg-[radial-gradient(circle_at_top_right,#31200d_0%,#15131a_34%,#0c1019_100%)] shadow-[0_28px_90px_rgba(245,158,11,0.08)]">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl"
        animate={{ scale: [1, 1.24, 1], opacity: [0.25, 0.5, 0.25], x: [0, -35, 0] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-48 h-64 w-64 rounded-full bg-rose-500/[0.07] blur-3xl"
        animate={{ scale: [1.15, 0.95, 1.15], opacity: [0.18, 0.38, 0.18], y: [0, -25, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent"
        animate={{ x: ["-100%", "100%"], opacity: [0, 1, 0] }}
        transition={{ duration: 3.1, repeat: Infinity, ease: "linear" }}
      />
      <CardHeader className="relative z-10 space-y-5 border-b border-amber-300/10 backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-3 text-xl text-white">
              <span className="relative grid h-11 w-11 place-items-center rounded-2xl border border-amber-300/20 bg-amber-500/10 text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                <Trophy className="h-5 w-5" />
                <motion.span
                  className="absolute inset-0 rounded-2xl border border-amber-300/40"
                  animate={{ scale: [1, 1.22, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
              </span>
              <span>
                쿠팡 커머스 레이더
                <span className="ml-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 align-middle text-[9px] font-bold tracking-[0.18em] text-amber-200">
                  LIVE
                </span>
              </span>
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              쿠팡 파트너스 카테고리 베스트 · {categoryName} TOP 10 · 쿠파스 링크 즉시 복사
            </p>
            <p className="mt-2 flex items-center gap-2 text-[10px] text-amber-300/70">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              쿠팡 카테고리 상품 랭킹 수집 연결됨
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void load(categoryId)}
            disabled={loading}
            className="border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
          >
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            새로고침
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {COUPANG_RANK_CATEGORIES.map((category) => (
            <motion.button
              key={category.id}
              type="button"
              onClick={() => setCategoryId(category.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              className={`relative shrink-0 overflow-hidden rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition ${
                categoryId === category.id
                  ? "border-amber-300/40 text-zinc-950 shadow-[0_8px_28px_rgba(245,158,11,0.18)]"
                  : "border-white/10 bg-black/20 text-zinc-400 hover:border-amber-400/30 hover:text-zinc-200"
              }`}
            >
              {categoryId === category.id ? (
                <motion.span
                  layoutId="coupang-category-active"
                  className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              ) : null}
              <span className="relative z-10">{category.label}</span>
            </motion.button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-5 py-6">
        {!loading && !error && products.length ? (
          <div className="grid gap-4 lg:grid-cols-5">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border border-amber-300/15 bg-black/25 p-4 backdrop-blur-xl lg:col-span-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold text-white">
                    <BarChart3 className="h-4 w-4 text-amber-300" />
                    TOP 10 가격 스펙트럼
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-500">현재 카테고리 베스트 상품 가격 분포</p>
                </div>
                <div className="rounded-xl border border-amber-300/15 bg-amber-400/[0.06] px-3 py-2 text-right">
                  <p className="text-[9px] text-zinc-500">평균 판매가</p>
                  <motion.p
                    key={averagePrice}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-base font-black text-amber-200"
                  >
                    {averagePrice.toLocaleString()}원
                  </motion.p>
                </div>
              </div>

              <div className="relative mt-5 h-44">
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-7">
                  {[0, 1, 2, 3].map((line) => (
                    <span key={line} className="block border-t border-dashed border-white/[0.06]" />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-end gap-2 pb-7">
                  {products.map((product, index) => {
                    const height = Math.max(8, (product.productPrice / maxPrice) * 100)
                    return (
                      <div key={product.productId} className="group relative flex h-full min-w-0 flex-1 items-end">
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: `${height}%`, opacity: 1 }}
                          transition={{ delay: index * 0.07, duration: 0.7, ease: "easeOut" }}
                          className={`relative w-full min-w-2 overflow-hidden rounded-t-lg ${
                            index < 3
                              ? "bg-gradient-to-t from-orange-600/50 to-amber-300"
                              : "bg-gradient-to-t from-amber-700/25 to-amber-400/60"
                          }`}
                          title={`${product.productName}: ${product.productPrice.toLocaleString()}원`}
                        >
                          <motion.span
                            className="absolute inset-x-0 h-8 bg-gradient-to-b from-white/25 to-transparent"
                            animate={{ y: ["-32px", "180px"] }}
                            transition={{ duration: 2.5, repeat: Infinity, delay: index * 0.13, ease: "linear" }}
                          />
                        </motion.div>
                        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-zinc-600">
                          {index + 1}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-600">
                <span>순위별 가격 비교</span>
                <span>최고 {maxPrice.toLocaleString()}원</span>
              </div>
            </motion.section>

            <div className="grid grid-cols-2 gap-3 lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                className="col-span-2 flex items-center gap-5 rounded-2xl border border-sky-300/15 bg-gradient-to-br from-sky-500/10 to-amber-500/[0.04] p-4"
              >
                <div
                  className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full"
                  style={{ background: `conic-gradient(#38bdf8 0 ${rocketRatio}%, rgba(255,255,255,.06) ${rocketRatio}% 100%)` }}
                >
                  <div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-[#10141c]">
                    <div className="text-center">
                      <Rocket className="mx-auto h-4 w-4 text-sky-300" />
                      <p className="mt-1 text-xl font-black text-white">{rocketRatio}%</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-sky-200">로켓배송 커버리지</p>
                  <p className="mt-2 text-sm font-black text-white">
                    {rocketRatio >= 80 ? "배송 경쟁력 매우 높음" : rocketRatio >= 50 ? "배송 경쟁력 양호" : "일반배송 비중 높음"}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">TOP 10 중 로켓배송 상품 비율입니다.</p>
                </div>
              </motion.div>
              <CommerceMetric icon={WalletCards} label="중앙 가격대" value={`${medianPrice.toLocaleString()}원`} delay={0.12} />
              <CommerceMetric icon={Tag} label="최저 진입가" value={`${lowestPrice.toLocaleString()}원`} delay={0.2} />
            </div>
          </div>
        ) : null}

        {!loading && !error && products.length >= 3 ? (
          <section className="relative overflow-hidden rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-500/[0.08] via-black/25 to-amber-500/[0.05] p-4 backdrop-blur-xl">
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-40 bg-gradient-to-r from-transparent via-violet-200/[0.06] to-transparent"
              animate={{ x: ["-180px", "1300px"] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: "linear" }}
            />
            <div className="relative mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-black text-white">
                  <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
                    <Bot className="h-4 w-4" />
                    <motion.span
                      className="absolute inset-0 rounded-xl border border-violet-300/40"
                      animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2.2, repeat: Infinity }}
                    />
                  </span>
                  AI TOP 3 콘텐츠 랩
                </p>
                <p className="mt-1 text-[10px] text-zinc-500">
                  인기 가능성의 근거와 상품별 숏폼 제작 방향을 AI가 분석합니다.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => void analyzeTop3(products.slice(0, 3), categoryName)}
                disabled={insightLoading}
                className="border border-violet-300/20 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20"
              >
                {insightLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                AI 다시 기획
              </Button>
            </div>

            {insightLoading ? (
              <div className="relative grid gap-3 lg:grid-cols-3">
                {[0, 1, 2].map((index) => (
                  <motion.div
                    key={index}
                    className="h-52 overflow-hidden rounded-2xl border border-white/8 bg-black/25"
                    animate={{ opacity: [0.35, 0.8, 0.35] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: index * 0.18 }}
                  >
                    <motion.div
                      className="h-full w-1/3 bg-gradient-to-r from-transparent via-violet-300/[0.08] to-transparent"
                      animate={{ x: ["-100%", "400%"] }}
                      transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.15 }}
                    />
                  </motion.div>
                ))}
              </div>
            ) : insightError ? (
              <div className="relative rounded-xl border border-red-400/20 bg-red-500/[0.05] px-4 py-6 text-center text-xs text-red-200">
                {insightError}
              </div>
            ) : (
              <div className="relative grid gap-3 lg:grid-cols-3">
                {insights.map((insight, index) => {
                  const product = products.find((item) => item.productId === insight.productId) || products[index]
                  if (!product) return null
                  return (
                    <motion.article
                      key={insight.productId}
                      initial={{ opacity: 0, y: 20, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: index * 0.13, duration: 0.45 }}
                      whileHover={{ y: -4, borderColor: "rgba(196,181,253,.35)" }}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">
                          {product.productImage ? (
                            <img src={product.productImage} alt="" className="h-full w-full object-contain" />
                          ) : null}
                          <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-md bg-amber-500 text-[9px] font-black text-zinc-950">
                            {product.rank}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-xs font-bold leading-relaxed text-white">{product.productName}</p>
                          <p className="mt-1 text-[10px] font-bold text-amber-300">{product.productPrice.toLocaleString()}원</p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div>
                          <p className="text-[9px] font-black tracking-[0.14em] text-cyan-300">WHY IT WINS</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">{insight.popularityReason}</p>
                        </div>
                        <div className="rounded-xl border border-rose-300/15 bg-rose-500/[0.06] p-3">
                          <p className="text-[9px] font-black tracking-[0.14em] text-rose-300">3초 훅</p>
                          <p className="mt-1 text-xs font-bold leading-relaxed text-white">“{insight.videoHook}”</p>
                        </div>
                        <div className="rounded-xl border border-violet-300/15 bg-violet-500/[0.05] p-3">
                          <p className="flex items-center gap-1 text-[9px] font-black tracking-[0.14em] text-violet-300">
                            <Film className="h-3 w-3" />
                            VIDEO BLUEPRINT
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">{insight.videoConcept}</p>
                        </div>
                      </div>
                    </motion.article>
                  )
                })}
              </div>
            )}
          </section>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-500/[0.06] px-4 py-12 text-center text-xs text-red-200">
            {error}
          </div>
        ) : loading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin text-amber-300" />
            쿠팡 카테고리 베스트를 불러오고 있습니다.
          </div>
        ) : products.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {products.map((product, index) => {
              const copied = copiedProductId === product.productId
              return (
                <motion.article
                  key={`${categoryId}-${product.productId}-${product.rank}`}
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.06, duration: 0.4 }}
                  whileHover={{ y: -6, scale: 1.012 }}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-black/25 shadow-[0_16px_45px_rgba(0,0,0,0.16)] transition hover:border-amber-400/35 hover:shadow-[0_20px_55px_rgba(245,158,11,0.09)]"
                >
                  <div className="relative aspect-square overflow-hidden bg-white">
                    {product.productImage ? (
                      <img
                        src={product.productImage}
                        alt={product.productName}
                        className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <ShoppingBag className="absolute inset-0 m-auto h-8 w-8 text-zinc-300" />
                    )}
                    <span className={`absolute left-2 top-2 grid h-7 min-w-7 place-items-center rounded-lg px-1 text-xs font-black ${
                      product.rank <= 3 ? "bg-amber-500 text-zinc-950" : "bg-zinc-800 text-white"
                    }`}>
                      {product.rank}
                    </span>
                    {product.isRocket ? (
                      <span className="absolute right-2 top-2 rounded bg-sky-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                        로켓
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-3 p-3">
                    <p className="line-clamp-2 min-h-10 text-xs font-semibold leading-relaxed text-zinc-100">
                      {product.productName}
                    </p>
                    <p className="text-sm font-black text-amber-300">
                      {product.productPrice.toLocaleString()}원
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void copyCoupasLink(product)}
                        className="h-8 bg-amber-500 text-[10px] font-bold text-zinc-950 hover:bg-amber-400"
                      >
                        {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                        {copied ? "복사됨" : "쿠파스 링크"}
                      </Button>
                      <a
                        href={product.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-white/10 bg-white/5 text-[10px] font-semibold text-zinc-300 hover:bg-white/10"
                      >
                        상품 보기 <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </div>
        ) : (
          <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-600">
            이 카테고리의 상품 순위가 없습니다.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CommerceMetric({
  icon: Icon,
  label,
  value,
  delay,
}: {
  icon: typeof Tag
  label: string
  value: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -3, borderColor: "rgba(252,211,77,.3)" }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-3.5"
    >
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-400/10 text-amber-300">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-white">{value}</p>
    </motion.div>
  )
}

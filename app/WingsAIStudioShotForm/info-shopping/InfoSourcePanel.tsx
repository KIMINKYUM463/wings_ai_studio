"use client"

import { useState } from "react"
import {
  Check,
  ExternalLink,
  Link2,
  Loader2,
  PackageSearch,
  Search,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import {
  INFO_THEMES,
  type InfoCoupangProduct,
  type InfoShoppingBrief,
} from "./info-types"
import { InfoThemePreview } from "./InfoThemePreview"

function extractYoutubeId(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "").trim() || null
    }
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v")
      if (v) return v
      const shorts = url.pathname.match(/\/shorts\/([^/?]+)/)
      if (shorts?.[1]) return shorts[1]
    }
  } catch {
    // ignore
  }
  return null
}

export function InfoSourcePanel({
  brief,
  onChange,
  onContinue,
}: {
  brief: InfoShoppingBrief
  onChange: (brief: InfoShoppingBrief) => void
  onContinue: () => void
}) {
  const [stage, setStage] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState("")

  const analyzeAndSearch = async () => {
    const url = brief.sourceUrl.trim()
    if (!url) {
      setError("벤치마크 URL을 입력해주세요.")
      return
    }
    setIsAnalyzing(true)
    setError("")
    setStage("소스 분석 중…")
    try {
      const videoId = extractYoutubeId(url)
      let analysis = brief.analysis
      let sourceMeta = brief.sourceMeta
      let searchKeyword = brief.searchQuery

      // YouTube 쇼핑 태그 우선
      if (videoId) {
        setStage("YouTube 쇼핑 태그 확인 중…")
        try {
          const tagResponse = await fetch(
            `/api/shotform/story-shopping/youtube-shopping-tags?videoId=${encodeURIComponent(videoId)}`
          )
          const tagData = await tagResponse.json()
          const tags = Array.isArray(tagData.products) ? tagData.products : []
          if (tagResponse.ok && tags[0]?.title) {
            const title = String(tags[0].title).trim()
            analysis = {
              productName: title,
              searchKeyword: title,
              productDescription: tags[0].price
                ? `YouTube 쇼핑 태그 · ${tags[0].price}`
                : "YouTube 쇼핑 태그",
              confidence: 100,
              evidence: ["YouTube 공개 쇼핑 태그"],
              analysisSummary: `쇼핑 태그 ${tags.length}개 확인`,
              tipAngle: "영상에 연결된 제품을 리뷰·꿀팁으로 소개",
            }
            sourceMeta = {
              url,
              sourceType: "youtube",
              title: title,
              description: analysis.productDescription,
              videoId,
              thumbnailUrl: tags[0].imageUrl || undefined,
            }
            searchKeyword = title
          }
        } catch {
          // AI 분석으로 전환
        }
      }

      if (!analysis?.searchKeyword) {
        setStage("AI가 URL에서 상품 키워드 추출 중…")
        const apiKey = (localStorage.getItem("shotform_openai_api_key") || "").trim()
        const response = await fetch("/api/shotform/info-shopping/analyze-source", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, apiKey: apiKey || undefined }),
        })
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || "소스 분석에 실패했습니다.")
        }
        sourceMeta = data.sourceMeta
        analysis = data.analysis
        searchKeyword = String(data.analysis?.searchKeyword || "").trim()
      }

      onChange({
        ...brief,
        sourceMeta,
        analysis,
        searchQuery: searchKeyword,
        products: [],
        selectedProduct: undefined,
        generatedCards: undefined,
        voiceData: undefined,
      })

      await searchCoupang(searchKeyword, {
        ...brief,
        sourceMeta,
        analysis,
        searchQuery: searchKeyword,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "분석에 실패했습니다.")
    } finally {
      setIsAnalyzing(false)
      setStage("")
    }
  }

  const searchCoupang = async (keyword: string, baseBrief = brief) => {
    const query = keyword.trim()
    if (!query) return
    setIsSearching(true)
    setError("")
    setStage("쿠팡에서 상품 검색 중…")
    try {
      const response = await fetch(
        `/api/shotform/keyword-analysis/coupang?mode=search&query=${encodeURIComponent(query)}`
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "쿠팡 검색 실패")
      const products = (Array.isArray(data.products) ? data.products : []) as InfoCoupangProduct[]
      onChange({
        ...baseBrief,
        searchQuery: query,
        products,
        selectedProduct: undefined,
        generatedCards: undefined,
        voiceData: undefined,
      })
      if (!products.length) {
        setError("검색 결과가 없습니다. 검색어를 짧게 바꿔보세요.")
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "쿠팡 검색 실패")
    } finally {
      setIsSearching(false)
      setStage("")
    }
  }

  const selectProduct = (product: InfoCoupangProduct) => {
    onChange({
      ...brief,
      selectedProduct: product,
      generatedCards: undefined,
      voiceData: undefined,
    })
  }

  const busy = isAnalyzing || isSearching

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-white/[0.08] bg-[#11100e]/95 p-6 md:p-8">
        <p className="text-[10px] font-black tracking-[0.2em] text-sky-400">STEP 01 · SOURCE & PRODUCT</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-white">
          딱 두개만 있으면 끝!
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          벤치마크 URL을 넣으면 관련 쿠팡 제품을 찾고, 꿀팁·리뷰형 카드뉴스 숏폼으로 이어집니다.
        </p>

        <div className="mt-6 grid gap-4">
          <div>
            <Label className="text-zinc-300">벤치마크 URL (유튜브 · 웹)</Label>
            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={brief.sourceUrl}
                  onChange={(e) => onChange({ ...brief, sourceUrl: e.target.value })}
                  placeholder="https://youtu.be/... 또는 https://blog.naver.com/..."
                  className="border-white/10 bg-black/40 pl-9 text-white"
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-zinc-300">템플릿 선택</Label>
            <div className="grid gap-4 lg:grid-cols-[1fr_200px]">
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
                {INFO_THEMES.map((theme) => {
                  const selected = brief.themeId === theme.id
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => onChange({ ...brief, themeId: theme.id })}
                      className={`group flex flex-col gap-1.5 rounded-xl border p-1.5 text-left transition ${
                        selected
                          ? "border-sky-400 bg-sky-500/10 ring-1 ring-sky-400/40"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25"
                      }`}
                    >
                      <InfoThemePreview themeId={theme.id} compact />
                      <span
                        className={`px-0.5 text-center text-[10px] leading-tight ${
                          selected ? "font-semibold text-sky-200" : "text-zinc-400"
                        }`}
                      >
                        {theme.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="hidden rounded-2xl border border-white/10 bg-black/20 p-3 lg:block">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  미리보기
                </p>
                <InfoThemePreview themeId={brief.themeId} />
                <p className="mt-2 text-center text-xs font-medium text-zinc-300">
                  {INFO_THEMES.find((theme) => theme.id === brief.themeId)?.label}
                </p>
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <Checkbox
              checked={brief.useAiImages}
              onCheckedChange={(checked) =>
                onChange({ ...brief, useAiImages: Boolean(checked) })
              }
            />
            AI이미지 자동 생성
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-zinc-300">영상 길이</Label>
              <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold text-sky-300">
                {brief.targetDurationSec}초
              </span>
            </div>
            <Slider
              value={[brief.targetDurationSec]}
              min={10}
              max={60}
              step={5}
              onValueChange={(value) =>
                onChange({ ...brief, targetDurationSec: value[0] || 30 })
              }
              className="w-full"
            />
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>10초</span>
              <span>60초</span>
            </div>
          </div>

          <Button
            type="button"
            disabled={busy}
            onClick={() => void analyzeAndSearch()}
            className="h-12 w-full bg-sky-500 text-base font-bold text-white hover:bg-sky-400"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {stage || "처리 중…"}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                제품 찾고 시작하기
              </>
            )}
          </Button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </div>

      {brief.analysis ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex items-start gap-3">
            <PackageSearch className="mt-0.5 h-5 w-5 text-sky-400" />
            <div>
              <p className="text-sm font-semibold text-white">{brief.analysis.productName}</p>
              <p className="mt-1 text-xs text-zinc-400">
                검색어 · {brief.analysis.searchKeyword} · 신뢰도 {brief.analysis.confidence}%
              </p>
              {brief.analysis.tipAngle ? (
                <p className="mt-2 text-sm text-zinc-300">{brief.analysis.tipAngle}</p>
              ) : null}
              {brief.sourceMeta?.title ? (
                <p className="mt-2 text-xs text-zinc-500">소스: {brief.sourceMeta.title}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Input
              value={brief.searchQuery}
              onChange={(e) => onChange({ ...brief, searchQuery: e.target.value })}
              className="border-white/10 bg-black/40 text-white"
              placeholder="쿠팡 검색어"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void searchCoupang(brief.searchQuery)}
            >
              <Search className="mr-1.5 h-4 w-4" />
              재검색
            </Button>
          </div>
        </div>
      ) : null}

      {brief.products.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200">
            쿠팡 상품 선택 <span className="text-zinc-500">(필수)</span>
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {brief.products.slice(0, 12).map((product) => {
              const selected = brief.selectedProduct?.productId === product.productId
              return (
                <button
                  key={product.productId}
                  type="button"
                  onClick={() => selectProduct(product)}
                  className={`overflow-hidden rounded-2xl border text-left transition ${
                    selected
                      ? "border-sky-400 bg-sky-500/10 ring-1 ring-sky-400/40"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  <div className="relative aspect-square bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.productImage}
                      alt=""
                      className="h-full w-full object-contain p-3"
                    />
                    {selected ? (
                      <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-white">
                        <Check className="h-4 w-4" />
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-2 text-xs font-medium text-zinc-200">
                      {product.productName}
                    </p>
                    <p className="text-sm font-bold text-sky-300">
                      {product.productPrice.toLocaleString()}원
                    </p>
                    <a
                      href={product.productUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
                    >
                      쿠팡에서 보기 <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </button>
              )
            })}
          </div>

          <Button
            type="button"
            disabled={!brief.selectedProduct}
            onClick={onContinue}
            className="h-11 w-full bg-white font-bold text-zinc-900 hover:bg-zinc-100"
          >
            선택한 제품으로 카드뉴스 만들기
          </Button>
        </div>
      ) : null}
    </section>
  )
}

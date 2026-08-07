"use client"

import { useMemo, useRef, useState } from "react"
import {
  Check,
  Copy,
  Download,
  ImagePlus,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  generatePixabayKeywordSuggestions,
  searchPixabayImages,
  type PixabayImageHit,
} from "../ai-shopping/actions"
import { generateImageWithNanobanana } from "../story-shopping/actions"
import { InfoCardFrame } from "./InfoCardFrame"
import {
  INFO_SLIDE_LABELS,
  type InfoShoppingBrief,
  type InfoSlide,
  type InfoSlideType,
} from "./info-types"

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("파일 읽기 실패"))
    reader.readAsDataURL(file)
  })
}

/** 쿠팡 등 원격 제품 이미지를 nano-banana 참조용 data URL로 */
async function urlToDataUrl(url: string): Promise<string | undefined> {
  const trimmed = url.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith("data:image/")) return trimmed
  try {
    const proxy = `/api/shotform/image-proxy?url=${encodeURIComponent(trimmed)}`
    const res = await fetch(proxy)
    if (!res.ok) return undefined
    const blob = await res.blob()
    if (!blob.type.startsWith("image/")) return undefined
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || "") || undefined)
      reader.onerror = () => reject(new Error("이미지 변환 실패"))
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

function buildInfoImagePrompt(
  slidePrompt: string | undefined,
  productName: string,
  productDescription?: string,
  slideType?: string
): string {
  const isProblem = slideType === "cover" || slideType === "pain"
  const base =
    slidePrompt?.trim() ||
    (isProblem
      ? "everyday home problem lifestyle photography, vertical 9:16 composition, no product"
      : `${productName} commercial lifestyle product photography, vertical 9:16 composition`)
  const sceneHint =
    isProblem
      ? "problem-before lifestyle scene ONLY, no product visible, messy or cramped space, soft frustration mood, documentary feel"
      : slideType === "tip" || slideType === "review"
        ? "solution-after scene, hands naturally using the product, bright practical demo"
        : slideType === "cta" || slideType === "product"
          ? "clean hero product shot, premium packaging, soft studio light"
          : "aspirational lifestyle moment with the product in focus"
  const detail = isProblem ? "" : (productDescription || "").slice(0, 180)
  return [
    base,
    sceneHint,
    detail ? `product context: ${detail}` : "",
    isProblem
      ? "do not show any product, packaging, brand, or shopping item"
      : "exact product design preserved, no invented buttons or features",
    "sharp focus, natural lighting, high detail, commercial quality",
    "no text, no logos, no watermarks, no UI overlays",
  ]
    .filter(Boolean)
    .join(", ")
}

function fallbackStockQuery(
  slide: InfoSlide,
  productName: string,
  slideIndex = 0
): string {
  const byType: Record<InfoSlideType, string[]> = {
    cover: [
      "tired morning kitchen lifestyle",
      "person yawning home morning",
      "dull breakfast table lonely",
    ],
    pain: [
      "bland drink disappointment mug",
      "messy kitchen counter frustration",
      "cold tea cup unfinished",
    ],
    tip: [
      "pouring hot tea kettle steam",
      "hands preparing healthy drink",
      "warm beverage cooking process",
    ],
    review: [
      "happy drinking warm mug smile",
      "cozy evening tea lifestyle",
      "relaxed person enjoying drink",
    ],
    product: [
      "grain tea packaging natural",
      "herbal tea ingredients flatlay",
      "premium tea bag product shot",
    ],
    cta: [
      "clean product hero soft light",
      "shopping product display shelf",
      "minimal studio product photo",
    ],
  }
  const variants = byType[slide.type] || ["lifestyle product photography"]
  const base = variants[slideIndex % variants.length]!
  // 제품명은 검색을 너무 좁히므로 빼고, 장면별 분위기 위주
  const hint = (slide.title || "").replace(/[^\w\s가-힣]/g, "").slice(0, 20)
  return `${base} ${hint}`.trim().slice(0, 80)
}

function stockImageUrl(hit: PixabayImageHit): string {
  return (hit.largeImageURL || hit.webformatURL || "").trim()
}

/** 장면 간 중복 방지 — URL 정규화 */
function normalizeImageKey(url: string): string {
  return url.trim().split("?")[0] || url.trim()
}

function collectUsedImageUrls(
  slides: readonly InfoSlide[],
  excludeIndex?: number
): Set<string> {
  const used = new Set<string>()
  slides.forEach((slide, index) => {
    if (excludeIndex != null && index === excludeIndex) return
    const url = slide.imageUrl?.trim()
    if (url) used.add(normalizeImageKey(url))
  })
  return used
}

function pickUnusedHit(
  hits: readonly PixabayImageHit[],
  used: ReadonlySet<string>
): PixabayImageHit | null {
  for (const hit of hits) {
    const url = stockImageUrl(hit)
    if (!url) continue
    if (!used.has(normalizeImageKey(url))) return hit
  }
  return null
}

async function downloadRemoteImage(url: string, filename: string) {
  const trimmed = url.trim()
  if (!trimmed) throw new Error("다운로드할 이미지가 없습니다.")
  const href = trimmed.startsWith("data:image/")
    ? trimmed
    : `/api/shotform/image-proxy?url=${encodeURIComponent(trimmed)}`
  const res = await fetch(href)
  if (!res.ok) throw new Error("이미지 다운로드에 실패했습니다.")
  const blob = await res.blob()
  const ext =
    blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg"
  const name = filename.includes(".") ? filename : `${filename}.${ext}`
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

function sourceLabel(source?: InfoSlide["imageSource"]) {
  if (source === "stock") return "무료이미지"
  if (source === "ai") return "AI"
  if (source === "upload") return "업로드"
  if (source === "product") return "제품컷"
  return "미지정"
}

export function InfoImagesPanel({
  brief,
  onChange,
  onContinue,
}: {
  brief: InfoShoppingBrief
  onChange: (brief: InfoShoppingBrief) => void
  onContinue: () => void
}) {
  const [busyIndex, setBusyIndex] = useState<number | null>(null)
  const [isBatch, setIsBatch] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [stockOpen, setStockOpen] = useState(false)
  const [stockSlideIndex, setStockSlideIndex] = useState(0)
  const [stockQuery, setStockQuery] = useState("")
  const [stockHits, setStockHits] = useState<PixabayImageHit[]>([])
  const [stockSearching, setStockSearching] = useState(false)
  const [stockSuggestions, setStockSuggestions] = useState<
    Array<{ labelKo: string; queryEn: string }>
  >([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const briefRef = useRef(brief)
  briefRef.current = brief

  const slides = brief.generatedCards?.slides || []
  const productImage = brief.selectedProduct?.productImage || ""
  const productName = brief.selectedProduct?.productName || brief.analysis?.productName || "product"

  const stockSlide = useMemo(
    () => slides[stockSlideIndex],
    [slides, stockSlideIndex]
  )

  const patchSlideImage = (
    index: number,
    imageUrl: string,
    imageSource: NonNullable<InfoSlide["imageSource"]>
  ) => {
    const current = briefRef.current
    if (!current.generatedCards) return
    const nextSlides = current.generatedCards.slides.map((slide, i) =>
      i === index ? { ...slide, imageUrl, imageSource } : slide
    )
    const nextBrief = {
      ...current,
      generatedCards: { ...current.generatedCards, slides: nextSlides },
    }
    briefRef.current = nextBrief
    onChange(nextBrief)
  }

  /** 한 장면 이미지만 비움 */
  const clearSlideImage = (index: number) => {
    const current = briefRef.current
    if (!current.generatedCards) return
    const nextSlides = current.generatedCards.slides.map((slide, i) => {
      if (i !== index) return slide
      const { imageUrl: _u, imageSource: _s, ...rest } = slide
      return rest
    })
    const nextBrief = {
      ...current,
      generatedCards: { ...current.generatedCards, slides: nextSlides },
    }
    briefRef.current = nextBrief
    onChange(nextBrief)
    setError("")
  }

  /** 모든 장면 이미지 초기화 */
  const clearAllImages = () => {
    const current = briefRef.current
    if (!current.generatedCards) return
    const hasAny = current.generatedCards.slides.some((slide) => slide.imageUrl)
    if (!hasAny) return
    if (!window.confirm("모든 카드 이미지를 삭제할까요?")) return
    const nextSlides = current.generatedCards.slides.map((slide) => {
      const { imageUrl: _u, imageSource: _s, ...rest } = slide
      return rest
    })
    const nextBrief = {
      ...current,
      generatedCards: { ...current.generatedCards, slides: nextSlides },
    }
    briefRef.current = nextBrief
    onChange(nextBrief)
    setError("")
  }

  const hasAnyImage = slides.some((slide) => Boolean(slide.imageUrl))

  const searchStockImages = async (query: string) => {
    const q = query.trim()
    if (!q) throw new Error("검색어를 입력해주세요.")
    const pixabayKey = (localStorage.getItem("shotform_pixabay_api_key") || "").trim()
    const result = await searchPixabayImages(q, pixabayKey || undefined, {
      perPage: 24,
      orientation: "vertical",
    })
    setStockHits(result.hits)
    if (!result.hits.length) {
      throw new Error("검색 결과가 없습니다. 다른 키워드로 시도해보세요.")
    }
  }

  const openStockPicker = async (index: number) => {
    const slide = briefRef.current.generatedCards?.slides[index]
    if (!slide) return
    setStockSlideIndex(index)
    setStockOpen(true)
    setStockHits([])
    setStockSuggestions([])
    setError("")
    setStockSearching(true)
    try {
      const openAiKey = (localStorage.getItem("shotform_openai_api_key") || "").trim()
      let query = fallbackStockQuery(slide, productName, index)
      if (openAiKey) {
        try {
          const suggestions = await generatePixabayKeywordSuggestions(
            `${slide.title}\n${slide.narration}`,
            productName,
            openAiKey
          )
          setStockSuggestions(suggestions)
          if (suggestions[0]?.queryEn) query = suggestions[0].queryEn
        } catch {
          /* 키워드 추천 실패 시 폴백 검색어 사용 */
        }
      }
      setStockQuery(query)
      await searchStockImages(query)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "무료 이미지 검색 실패")
    } finally {
      setStockSearching(false)
    }
  }

  /**
   * 한 장면에 무료 이미지 1장 배치.
   * usedUrls에 이미 들어간 URL은 건너뛰고, 부족하면 다른 키워드·다음 페이지를 탐색.
   */
  const fillStockForSlide = async (index: number, usedUrls: Set<string>) => {
    const current = briefRef.current
    const slide = current.generatedCards?.slides[index]
    if (!slide) return
    const pixabayKey = (localStorage.getItem("shotform_pixabay_api_key") || "").trim()
    const openAiKey = (localStorage.getItem("shotform_openai_api_key") || "").trim()

    const queries: string[] = [fallbackStockQuery(slide, productName, index)]
    if (openAiKey) {
      try {
        const suggestions = await generatePixabayKeywordSuggestions(
          `${slide.title}\n${slide.narration}`,
          productName,
          openAiKey
        )
        for (const item of suggestions) {
          if (item.queryEn && !queries.includes(item.queryEn)) {
            queries.push(item.queryEn)
          }
        }
      } catch {
        /* keep fallback */
      }
    }
    // 장면 인덱스로 시작 쿼리를 돌려 비슷한 검색어여도 결과가 겹치지 않게
    const rotated = [
      ...queries.slice(index % queries.length),
      ...queries.slice(0, index % queries.length),
    ]

    let picked: PixabayImageHit | null = null
    for (const query of rotated) {
      for (const page of [1, 2, 3]) {
        const result = await searchPixabayImages(query, pixabayKey || undefined, {
          perPage: 24,
          page,
          orientation: "vertical",
        })
        picked = pickUnusedHit(result.hits, usedUrls)
        if (picked) break
      }
      if (picked) break
    }

    if (!picked) {
      throw new Error(
        `장면 ${index + 1}: 아직 쓰지 않은 무료 이미지를 찾지 못했습니다. 다른 검색어로 직접 골라주세요.`
      )
    }
    const url = stockImageUrl(picked)
    usedUrls.add(normalizeImageKey(url))
    patchSlideImage(index, url, "stock")
  }

  /** 비어 있는 카드에 Pixabay 무료 이미지 자동 배치 (장면마다 다른 사진) */
  const applyStockToEmpty = async () => {
    if (!brief.generatedCards) return
    setIsBatch(true)
    setError("")
    try {
      const slidesNow = briefRef.current.generatedCards?.slides || []
      const usedUrls = collectUsedImageUrls(slidesNow)
      const total = slidesNow.length
      for (let index = 0; index < total; index += 1) {
        const slide = briefRef.current.generatedCards?.slides[index]
        if (!slide || slide.imageUrl) continue
        setProgress(`무료 이미지 ${index + 1}/${total}`)
        setBusyIndex(index)
        await fillStockForSlide(index, usedUrls)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "무료 이미지 자동 채우기 실패")
    } finally {
      setBusyIndex(null)
      setIsBatch(false)
      setProgress("")
    }
  }

  const generateAiForSlide = async (index: number) => {
    const current = briefRef.current
    const slide = current.generatedCards?.slides[index]
    if (!slide || !current.selectedProduct) return
    setBusyIndex(index)
    setError("")
    try {
      const replicateKey = (localStorage.getItem("shotform_replicate_api_key") || "").trim()
      if (!replicateKey) {
        throw new Error("Replicate API 키가 필요합니다. 설정에서 등록해주세요.")
      }
      const prompt = buildInfoImagePrompt(
        slide.imagePrompt,
        current.selectedProduct.productName,
        current.analysis?.productDescription,
        slide.type
      )
      const isProblem = slide.type === "cover" || slide.type === "pain"
      const productRef = isProblem
        ? undefined
        : (await urlToDataUrl(current.selectedProduct.productImage || "")) || undefined
      const url = await generateImageWithNanobanana(
        prompt,
        isProblem ? "everyday lifestyle scene" : current.selectedProduct.productName,
        productRef,
        replicateKey,
        index,
        isProblem ? undefined : current.analysis?.productDescription,
        "9:16",
        true // nano-banana-pro
      )
      patchSlideImage(index, url, "ai")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 이미지 생성 실패")
    } finally {
      setBusyIndex(null)
    }
  }

  const generateAiBatch = async () => {
    if (!brief.useAiImages) {
      await applyStockToEmpty()
      return
    }
    setIsBatch(true)
    setError("")
    try {
      const total = briefRef.current.generatedCards?.slides.length || 0
      for (let index = 0; index < total; index += 1) {
        const slide = briefRef.current.generatedCards?.slides[index]
        if (!slide) continue
        if (slide.imageSource === "ai" && slide.imageUrl) continue
        setProgress(`AI 이미지 ${index + 1}/${total}`)
        await generateAiForSlide(index)
      }
    } finally {
      setIsBatch(false)
      setProgress("")
    }
  }

  const uploadForSlide = async (index: number, file: File | null) => {
    if (!file) return
    try {
      const dataUrl = await fileToDataUrl(file)
      patchSlideImage(index, dataUrl, "upload")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "업로드 실패")
    }
  }

  const slidePromptText = (slide: InfoSlide) =>
    buildInfoImagePrompt(
      slide.imagePrompt,
      productName,
      brief.analysis?.productDescription,
      slide.type
    )

  const copySlidePrompt = async (index: number) => {
    const slide = briefRef.current.generatedCards?.slides[index]
    if (!slide) return
    try {
      await navigator.clipboard.writeText(slidePromptText(slide))
      setCopiedIndex(index)
      window.setTimeout(() => {
        setCopiedIndex((current) => (current === index ? null : current))
      }, 1600)
    } catch {
      setError("프롬프트 복사에 실패했습니다. 브라우저 권한을 확인해주세요.")
    }
  }

  const downloadProductRef = async (index: number) => {
    if (!productImage) {
      setError("선택된 제품 이미지가 없습니다. 소스 단계에서 제품을 골라주세요.")
      return
    }
    try {
      await downloadRemoteImage(
        productImage,
        `card-${String(index + 1).padStart(2, "0")}-product-ref`
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "제품 이미지 다운로드 실패")
    }
  }

  if (!brief.generatedCards || !slides.length) {
    return (
      <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        먼저 카드 대본을 생성해주세요.
      </p>
    )
  }

  const selected = slides[selectedIndex]

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-white/[0.08] bg-[#11100e]/95 p-6 md:p-8">
        <p className="text-[10px] font-black tracking-[0.2em] text-sky-400">STEP 03 · IMAGES</p>
        <h2 className="mt-2 text-3xl font-black text-white">카드 이미지</h2>
        <p className="mt-2 text-sm text-zinc-400">
          카드는 비어 있습니다. 장면마다{" "}
          <span className="text-zinc-200">무료 이미지 검색</span>·AI·업로드로 채우세요. 각 장면
          아래에서 <span className="text-zinc-200">프롬프트 복사</span>·
          <span className="text-zinc-200">원본 제품 이미지 다운로드</span>도 할 수 있습니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={isBatch}
            onClick={() => void applyStockToEmpty()}
          >
            {isBatch && progress.startsWith("무료") ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {progress}
              </>
            ) : (
              <>
                <ImagePlus className="mr-2 h-4 w-4" />
                빈 카드 무료 이미지 채우기
              </>
            )}
          </Button>
          <Button
            type="button"
            disabled={isBatch}
            onClick={() => void generateAiBatch()}
            className="bg-sky-500 font-bold text-white hover:bg-sky-400"
          >
            {isBatch && progress.startsWith("AI") ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {progress || "생성 중…"}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                AI 이미지 자동 채우기
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!hasAnyImage || isBatch}
            onClick={clearAllImages}
            className="border-rose-500/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            이미지 초기화
          </Button>
          <Button type="button" onClick={onContinue} className="font-semibold">
            음성 단계로
          </Button>
        </div>
        {error ? (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {slides.map((slide, index) => {
            const prompt = slidePromptText(slide)
            return (
              <div
                key={slide.id}
                className={`space-y-2 rounded-2xl border p-3 ${
                  selectedIndex === index
                    ? "border-sky-400/50 bg-sky-500/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative h-16 w-16 shrink-0">
                    <button
                      type="button"
                      className="h-16 w-16 overflow-hidden rounded-xl bg-zinc-800"
                      onClick={() => setSelectedIndex(index)}
                    >
                      {slide.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[10px] text-zinc-500">
                          없음
                        </span>
                      )}
                    </button>
                    {slide.imageUrl ? (
                      <button
                        type="button"
                        title="이 장면 이미지 삭제"
                        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-rose-400/50 bg-rose-600 text-white shadow hover:bg-rose-500"
                        onClick={() => clearSlideImage(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {String(index + 1).padStart(2, "0")} · {INFO_SLIDE_LABELS[slide.type]}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {sourceLabel(slide.imageSource)} · {slide.title}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busyIndex === index || stockSearching}
                      onClick={() => void openStockPicker(index)}
                      className="bg-amber-500/90 text-zinc-950 hover:bg-amber-400"
                    >
                      <Search className="mr-1 h-3.5 w-3.5" />
                      무료 이미지
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyIndex === index}
                      onClick={() => void generateAiForSlide(index)}
                    >
                      {busyIndex === index ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "AI"
                      )}
                    </Button>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10">
                      <Upload className="h-3.5 w-3.5" />
                      업로드
                      <Input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          void uploadForSlide(index, e.target.files?.[0] || null)
                        }
                      />
                    </label>
                    {slide.imageUrl ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-rose-500/40 bg-transparent text-rose-200 hover:bg-rose-500/15"
                        onClick={() => clearSlideImage(index)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        삭제
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      프롬프트
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 border-white/15 bg-transparent px-2 text-[11px] text-zinc-200"
                        onClick={() => void copySlidePrompt(index)}
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="mr-1 h-3 w-3 text-emerald-400" />
                            복사됨
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-3 w-3" />
                            프롬프트 복사
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 border-white/15 bg-transparent px-2 text-[11px] text-zinc-200"
                        disabled={!productImage}
                        onClick={() => void downloadProductRef(index)}
                      >
                        <Download className="mr-1 h-3 w-3" />
                        원본 이미지
                      </Button>
                    </div>
                  </div>
                  <p className="line-clamp-3 text-[11px] leading-relaxed text-zinc-400">
                    {prompt}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <InfoCardFrame
          slide={selected}
          themeId={brief.themeId}
          slideIndex={selectedIndex}
          slideCount={slides.length}
          revealLineCount={null}
        />
      </div>

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-zinc-800 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>
              무료 이미지 검색
              {stockSlide
                ? ` · ${String(stockSlideIndex + 1).padStart(2, "0")} ${INFO_SLIDE_LABELS[stockSlide.type]}`
                : ""}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Pixabay 무료 사진을 골라 이 카드에 넣습니다. (설정에 Pixabay API 키 필요)
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Input
              value={stockQuery}
              onChange={(e) => setStockQuery(e.target.value)}
              placeholder="영어 검색어 (예: warm barley tea kitchen)"
              className="min-w-[200px] flex-1 border-zinc-700 bg-zinc-900"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  setStockSearching(true)
                  setError("")
                  void searchStockImages(stockQuery)
                    .catch((reason) =>
                      setError(reason instanceof Error ? reason.message : "검색 실패")
                    )
                    .finally(() => setStockSearching(false))
                }
              }}
            />
            <Button
              type="button"
              disabled={stockSearching || !stockQuery.trim()}
              onClick={() => {
                setStockSearching(true)
                setError("")
                void searchStockImages(stockQuery)
                  .catch((reason) =>
                    setError(reason instanceof Error ? reason.message : "검색 실패")
                  )
                  .finally(() => setStockSearching(false))
              }}
            >
              {stockSearching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              검색
            </Button>
          </div>

          {stockSuggestions.length ? (
            <div className="flex flex-wrap gap-2">
              {stockSuggestions.map((item) => (
                <button
                  key={`${item.labelKo}-${item.queryEn}`}
                  type="button"
                  className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:border-sky-500/50 hover:text-white"
                  onClick={() => {
                    setStockQuery(item.queryEn)
                    setStockSearching(true)
                    setError("")
                    void searchStockImages(item.queryEn)
                      .catch((reason) =>
                        setError(reason instanceof Error ? reason.message : "검색 실패")
                      )
                      .finally(() => setStockSearching(false))
                  }}
                >
                  {item.labelKo}
                </button>
              ))}
            </div>
          ) : null}

          {stockSearching ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              검색 중…
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(() => {
                const usedElsewhere = collectUsedImageUrls(slides, stockSlideIndex)
                return stockHits.map((hit) => {
                  const url = stockImageUrl(hit)
                  const alreadyUsed = usedElsewhere.has(normalizeImageKey(url))
                  return (
                    <button
                      key={hit.id}
                      type="button"
                      disabled={alreadyUsed}
                      className={`group relative aspect-[3/4] overflow-hidden rounded-xl border bg-zinc-900 ${
                        alreadyUsed
                          ? "cursor-not-allowed border-zinc-800 opacity-40"
                          : "border-zinc-800 hover:border-sky-400"
                      }`}
                      onClick={() => {
                        if (alreadyUsed) return
                        patchSlideImage(stockSlideIndex, url, "stock")
                        setStockOpen(false)
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={hit.previewURL || hit.webformatURL}
                        alt={hit.tags}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[9px] text-zinc-200">
                        {alreadyUsed ? "다른 장면에 사용 중" : "클릭하여 적용"}
                      </span>
                    </button>
                  )
                })
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

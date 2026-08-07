"use client"

import { useState } from "react"
import {
  ArrowRight,
  Loader2,
  Maximize2,
  PawPrint,
  Sparkles,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ANIMAL_CHARACTER_PRESETS,
  buildCustomVisualPromptEn,
  createCharacterFromPreset,
  type AnimalCharacterPreset,
  type AnimalSpecies,
} from "./animal-character"
import { generateCharacterReferenceImage as generateCharRef } from "./actions"
import { AnimalCoupangSearchPanel } from "./AnimalCoupangSearchPanel"
import type { AnimalCoupangProduct, AnimalShoppingBrief } from "./animal-studio-types"
import {
  buildProductDescriptionFromCoupang,
  clampAnimalDuration,
  fetchImageAsDataUrl,
  productDisplayUrl,
} from "./animal-studio-utils"
import type { CoupangRankedProduct } from "@/lib/shotform-keyword-analysis-types"


export function AnimalProductPanel({
  brief,
  onChange,
  onContinue,
}: {
  brief: AnimalShoppingBrief
  onChange: (brief: AnimalShoppingBrief) => void
  onContinue: () => void
}) {
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [isGeneratingRef, setIsGeneratingRef] = useState(false)
  const [error, setError] = useState("")
  const [previewPreset, setPreviewPreset] = useState<AnimalCharacterPreset | null>(null)

  const character = brief.character
  const canContinue = Boolean(brief.productName.trim() && character.name.trim())

  const searchCoupang = async (query: string) => {
    setIsSearching(true)
    setSearchError("")
    try {
      const response = await fetch(
        `/api/shotform/keyword-analysis/coupang?mode=search&query=${encodeURIComponent(query)}`
      )
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "쿠팡 검색에 실패했습니다.")
      }
      const products = (data.products || []) as CoupangRankedProduct[]
      onChange({
        ...brief,
        searchQuery: query,
        products: products.map((p) => ({
          productId: p.productId,
          productName: p.productName,
          productPrice: p.productPrice,
          productImage: p.productImage,
          productUrl: p.productUrl,
          categoryName: p.categoryName,
          isRocket: p.isRocket,
          rank: p.rank,
        })),
      })
    } catch (reason) {
      setSearchError(reason instanceof Error ? reason.message : "검색 실패")
    } finally {
      setIsSearching(false)
    }
  }

  const selectProduct = (product: CoupangRankedProduct) => {
    const mapped: AnimalCoupangProduct = {
      productId: product.productId,
      productName: product.productName,
      productPrice: product.productPrice,
      productImage: product.productImage,
      productUrl: product.productUrl,
      categoryName: product.categoryName,
      isRocket: product.isRocket,
      rank: product.rank,
    }
    onChange({
      ...brief,
      selectedProduct: mapped,
      productName: mapped.productName,
      productDescription: buildProductDescriptionFromCoupang(mapped, character.name),
      coupangUrl: mapped.productUrl,
      productImage: mapped.productImage,
      script: "",
      scenes: [],
      ttsAudioUrl: "",
      ttsDurationSec: undefined,
      imagePrompts: [],
      imageUrls: [],
      videoUrls: [],
      mergedVideoUrl: undefined,
    })

    void (async () => {
      const dataUrl = await fetchImageAsDataUrl(mapped.productImage)
      if (!dataUrl) return
      onChange({
        ...brief,
        selectedProduct: mapped,
        productName: mapped.productName,
        productDescription: buildProductDescriptionFromCoupang(mapped, character.name),
        coupangUrl: mapped.productUrl,
        productImage: dataUrl,
      })
    })()
  }

  const pickPreset = (presetId: string) => {
    const next = createCharacterFromPreset(presetId)
    onChange({
      ...brief,
      character: next,
      imageUrls: [],
      videoUrls: [],
      mergedVideoUrl: undefined,
    })
  }

  const updateCharacter = (patch: Partial<typeof character>) => {
    const next = { ...character, ...patch }
    if (patch.breedOrLook !== undefined || patch.species !== undefined) {
      next.visualPromptEn = buildCustomVisualPromptEn(
        next.breedOrLook,
        next.species
      )
      next.presetId = "custom"
    }
    onChange({ ...brief, character: next })
  }

  const generateReference = async () => {
    setIsGeneratingRef(true)
    setError("")
    try {
      const replicateKey = (localStorage.getItem("shotform_replicate_api_key") || "").trim()
      const url = await generateCharRef(character, replicateKey || undefined)
      onChange({
        ...brief,
        character: { ...character, referenceImage: url },
        imageUrls: [],
        videoUrls: [],
        mergedVideoUrl: undefined,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "캐릭터 레퍼런스 생성 실패")
    } finally {
      setIsGeneratingRef(false)
    }
  }

  const onUploadReference = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || "")
      if (!result.startsWith("data:image/")) return
      onChange({
        ...brief,
        character: { ...character, referenceImage: result },
        imageUrls: [],
        videoUrls: [],
        mergedVideoUrl: undefined,
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-[#7dd3a8]/30 bg-[#7dd3a8]/15 p-2.5">
            <PawPrint className="h-5 w-5 text-[#7dd3a8]" />
          </div>
          <div>
            <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">🐾 CHARACTER</p>
            <h2 className="animal-display mt-2 text-xl font-bold text-[#fff6ee]">
              동물 쇼퍼 고르기
            </h2>
            <p className="mt-1 text-sm text-[#9aa89c]">
              캐릭터가 쿠팡 제품을 매장에서 직접 쓰고 시연하는 숏폼의 주인공이에요. 확대 버튼으로
              외형을 크게 확인할 수 있어요.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ANIMAL_CHARACTER_PRESETS.map((preset) => {
            const active = character.presetId === preset.id
            const previewSrc =
              preset.sampleImage ||
              (preset.id === "custom" && character.presetId === "custom"
                ? character.referenceImage
                : undefined)
            return (
              <div
                key={preset.id}
                className={`relative overflow-hidden rounded-2xl border text-left transition ${
                  active
                    ? "border-[#7dd3a8]/70 bg-[#7dd3a8]/15 ring-2 ring-[#7dd3a8]/40"
                    : "border-[rgba(255,246,238,0.12)] bg-black/25 hover:border-[#7dd3a8]/35"
                }`}
              >
                <button
                  type="button"
                  onClick={() => pickPreset(preset.id)}
                  className="block w-full text-left"
                >
                  <div className="aspect-[4/3] bg-black/40">
                    {previewSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewSrc}
                        alt={preset.label}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl">
                        {preset.emoji}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-[#fff6ee]">
                      {preset.emoji} {preset.label}
                    </p>
                    <p className="mt-0.5 text-xs text-[#9aa89c]">{preset.character.name}</p>
                  </div>
                </button>
                {previewSrc ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPreviewPreset(preset)
                    }}
                    className="absolute right-2.5 top-2.5 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/60 text-[#fff6ee] shadow-lg backdrop-blur-sm transition hover:border-[#7dd3a8]/50 hover:bg-black/80"
                    title="이미지 확대 보기"
                    aria-label={`${preset.label} 이미지 확대`}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>

        <Dialog
          open={Boolean(previewPreset)}
          onOpenChange={(open) => {
            if (!open) setPreviewPreset(null)
          }}
        >
          <DialogContent className="max-w-3xl border-[rgba(255,246,238,0.14)] bg-[#121612] p-0 text-[#fff6ee] sm:rounded-2xl">
            {previewPreset ? (
              <>
                <DialogHeader className="space-y-1 border-b border-white/10 px-5 py-4 text-left">
                  <DialogTitle className="animal-display text-lg font-bold">
                    {previewPreset.emoji} {previewPreset.label}
                  </DialogTitle>
                  <DialogDescription className="text-[#9aa89c]">
                    {previewPreset.character.name} ·{" "}
                    {previewPreset.character.breedOrLook ||
                      previewPreset.character.personality}
                  </DialogDescription>
                </DialogHeader>
                <div className="bg-black px-3 py-3 sm:px-5 sm:py-5">
                  <div className="mx-auto flex max-h-[min(72vh,820px)] items-center justify-center overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        previewPreset.sampleImage ||
                        (previewPreset.id === "custom"
                          ? character.referenceImage
                          : undefined) ||
                        ""
                      }
                      alt={`${previewPreset.label} 확대`}
                      className="max-h-[min(72vh,820px)] w-full object-contain"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-3">
                  <p className="text-xs text-[#6b7a6e]">
                    이미지를 확대해 외형·무늬를 확인하세요.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-full"
                      onClick={() => setPreviewPreset(null)}
                    >
                      <X className="mr-1.5 h-4 w-4" />
                      닫기
                    </Button>
                    <Button
                      type="button"
                      className="animal-mint-btn rounded-full font-semibold"
                      onClick={() => {
                        pickPreset(previewPreset.id)
                        setPreviewPreset(null)
                      }}
                    >
                      이 캐릭터 선택
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <div className="grid gap-4 rounded-2xl border border-[rgba(255,246,238,0.12)] bg-black/25 p-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <Label className="text-[#d7e0d8]">이름</Label>
              <Input
                value={character.name}
                onChange={(e) => updateCharacter({ name: e.target.value })}
                className="mt-1 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]"
              />
            </div>
            <div>
              <Label className="text-[#d7e0d8]">외모</Label>
              <Input
                value={character.breedOrLook}
                onChange={(e) => updateCharacter({ breedOrLook: e.target.value })}
                placeholder="예: 주황색 줄무나고양이"
                className="mt-1 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]"
              />
            </div>
            <div>
              <Label className="text-[#d7e0d8]">성격</Label>
              <Input
                value={character.personality}
                onChange={(e) => updateCharacter({ personality: e.target.value })}
                className="mt-1 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]"
              />
            </div>
            {character.presetId === "custom" ? (
              <div>
                <Label className="text-[#d7e0d8]">종류</Label>
                <select
                  value={character.species}
                  onChange={(e) =>
                    updateCharacter({ species: e.target.value as AnimalSpecies })
                  }
                  className="mt-1 h-10 w-full rounded-xl border border-[rgba(243,235,224,0.12)] bg-black/35 px-3 text-[#f3ebe0]"
                >
                  <option value="cat">고양이</option>
                  <option value="dog">강아지</option>
                  <option value="rabbit">토끼</option>
                  <option value="bear">곰</option>
                  <option value="panda">판다</option>
                  <option value="custom">기타</option>
                </select>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <Label className="text-[#d7e0d8]">캐릭터 레퍼런스 (얼굴 고정)</Label>
            <div className="aspect-[9/16] max-h-64 overflow-hidden rounded-xl border border-[rgba(255,246,238,0.12)] bg-black/40">
              {character.referenceImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={productDisplayUrl(character.referenceImage)}
                  alt={character.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[#6b7a6e]">
                  레퍼런스 없음
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void generateReference()}
                disabled={isGeneratingRef}
                className="animal-mint-btn rounded-full"
              >
                {isGeneratingRef ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                AI로 만들기
              </Button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[rgba(255,246,238,0.2)] px-4 py-2 text-sm text-[#fff6ee] hover:bg-white/5">
                <Upload className="h-4 w-4" />
                업로드
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onUploadReference(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <AnimalCoupangSearchPanel
          characterName={character.name}
          searchQuery={brief.searchQuery}
          products={brief.products as CoupangRankedProduct[]}
          selectedProductId={brief.selectedProduct?.productId ?? null}
          isSearching={isSearching}
          searchError={searchError}
          onSearchQueryChange={(q) => onChange({ ...brief, searchQuery: q })}
          onSearch={(q) => void searchCoupang(q)}
          onSelectProduct={selectProduct}
        />

        <div className="grid gap-4 rounded-2xl border border-[rgba(255,246,238,0.12)] bg-black/25 p-4 md:grid-cols-[120px_1fr]">
          <div className="aspect-square overflow-hidden rounded-xl bg-black/40">
            {brief.productImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={productDisplayUrl(brief.productImage)}
                alt={brief.productName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[#6b7a6e]">
                제품 이미지
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-[#d7e0d8]">
                제품명<span className="text-[#ff8fab]">*</span>
              </Label>
              <Input
                value={brief.productName}
                onChange={(e) => onChange({ ...brief, productName: e.target.value })}
                placeholder="제품명을 입력하거나 쿠팡에서 고르세요"
                className="mt-1 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]"
              />
            </div>
            <div>
              <Label className="text-[#d7e0d8]">제품 설명</Label>
              <Textarea
                value={brief.productDescription}
                onChange={(e) => onChange({ ...brief, productDescription: e.target.value })}
                rows={3}
                className="mt-1 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-[#d7e0d8]">영상 길이</Label>
                <span className="rounded-full bg-[#ff8fab]/20 px-2.5 py-0.5 text-xs font-bold text-[#ff8fab]">
                  {brief.videoDuration}초
                </span>
              </div>
              <Slider
                value={[brief.videoDuration]}
                min={10}
                max={60}
                step={5}
                onValueChange={(value) =>
                  onChange({
                    ...brief,
                    videoDuration: clampAnimalDuration(value[0] || 30),
                  })
                }
                className="w-full"
              />
              <div className="flex justify-between text-[11px] text-[#6b7a6e]">
                <span>10초</span>
                <span>60초</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="animal-cta-cute rounded-full px-6 font-bold"
        >
          대본 만들기로
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

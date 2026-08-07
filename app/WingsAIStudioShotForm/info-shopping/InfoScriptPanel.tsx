"use client"

import { useState } from "react"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { buildInfoSlideNarration, InfoCardFrame, stripInfoLineNumber } from "./InfoCardFrame"
import { INFO_SLIDE_LABELS, type InfoShoppingBrief, type InfoSlide } from "./info-types"

export function InfoScriptPanel({
  brief,
  onChange,
  onContinue,
}: {
  brief: InfoShoppingBrief
  onChange: (brief: InfoShoppingBrief) => void
  onContinue: () => void
}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)

  const slides = brief.generatedCards?.slides || []
  const selected = slides[selectedIndex]

  const generate = async () => {
    if (!brief.selectedProduct) {
      setError("먼저 쿠팡 제품을 선택해주세요.")
      return
    }
    setIsGenerating(true)
    setError("")
    try {
      const apiKey = (localStorage.getItem("shotform_openai_api_key") || "").trim()
      const response = await fetch("/api/shotform/info-shopping/generate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          productName: brief.selectedProduct.productName,
          productDescription:
            brief.analysis?.productDescription || brief.selectedProduct.categoryName,
          productPrice: brief.selectedProduct.productPrice,
          productImage: brief.selectedProduct.productImage,
          sourceTitle: brief.sourceMeta?.title,
          sourceSummary: [
            brief.sourceMeta?.description,
            brief.analysis?.analysisSummary,
            brief.analysis?.tipAngle,
          ]
            .filter(Boolean)
            .join("\n"),
          tipAngle: brief.analysis?.tipAngle,
          channelHandle: brief.channelHandle,
          themeId: brief.themeId,
          targetDurationSec: brief.targetDurationSec,
          useAiImages: brief.useAiImages,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "카드 생성에 실패했습니다.")
      }
      const cards = data.cards
      const previousSlides = brief.generatedCards?.slides || []
      const mergedSlides = (cards.slides || []).map((slide: InfoSlide, index: number) => {
        const prev =
          previousSlides[index] ||
          previousSlides.find((item) => item.type === slide.type)
        // 대본만 교체 — 기존 이미지(URL·출처)는 유지
        if (prev?.imageUrl) {
          return {
            ...slide,
            imageUrl: prev.imageUrl,
            imageSource: prev.imageSource,
          }
        }
        return {
          ...slide,
          imageUrl: undefined,
          imageSource: undefined,
        }
      })
      onChange({
        ...brief,
        generatedCards: {
          ...cards,
          slides: mergedSlides,
        },
        // 대본이 바뀌면 TTS는 다시 맞춰야 함
        voiceData: undefined,
      })
      setSelectedIndex(0)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "카드 생성 실패")
    } finally {
      setIsGenerating(false)
    }
  }

  const updateSlide = (index: number, patch: Partial<InfoSlide>) => {
    if (!brief.generatedCards) return
    const nextSlides = brief.generatedCards.slides.map((slide, i) =>
      i === index ? { ...slide, ...patch } : slide
    )
    onChange({
      ...brief,
      generatedCards: { ...brief.generatedCards, slides: nextSlides },
      voiceData: undefined,
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-white/[0.08] bg-[#11100e]/95 p-6 md:p-8">
        <p className="text-[10px] font-black tracking-[0.2em] text-sky-400">STEP 02 · CARD SCRIPT</p>
        <h2 className="mt-2 text-3xl font-black text-white">꿀팁·리뷰 카드 대본</h2>
        <p className="mt-2 text-sm text-zinc-400">
          전개: 문제제기 → 공감 → 해결(제품) → 후기 → CTA. 처음부터 제품을 들이밀지 않고, 불편을
          먼저 말한 뒤 해결책으로 이어집니다.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={isGenerating || !brief.selectedProduct}
            onClick={() => void generate()}
            className="bg-sky-500 font-bold text-white hover:bg-sky-400"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                생성 중…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {slides.length ? "대본만 다시 생성" : "카드뉴스 생성하기"}
              </>
            )}
          </Button>
          {slides.length ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onContinue}
              className="font-semibold"
            >
              이미지 단계로
            </Button>
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {brief.generatedCards ? (
          <p className="mt-4 text-sm text-zinc-300">
            <span className="font-semibold text-white">{brief.generatedCards.title}</span>
            <span className="mx-2 text-zinc-600">·</span>
            {brief.generatedCards.hook}
          </p>
        ) : null}
      </div>

      {slides.length > 0 && selected ? (
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_360px]">
          <div className="space-y-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm ${
                  selectedIndex === index
                    ? "border-sky-400 bg-sky-500/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20"
                }`}
              >
                <span className="font-mono text-xs text-zinc-500">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="truncate">{INFO_SLIDE_LABELS[slide.type]}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                슬라이드 편집
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-zinc-400"
                onClick={() => void generate()}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                대본만 다시 생성
              </Button>
            </div>
            <p className="text-[11px] text-zinc-500">문구만 바뀌고, 슬라이드 이미지는 유지됩니다.</p>
            <Input
              value={selected.hook || ""}
              onChange={(e) => {
                const hook = e.target.value
                updateSlide(selectedIndex, {
                  hook,
                  narration: buildInfoSlideNarration({
                    hook,
                    title: selected.title,
                    lines: selected.lines,
                  }),
                })
              }}
              placeholder="훅 (예: 정리의 혁신!)"
              className="border-white/10 bg-black/40 text-white"
            />
            <Input
              value={selected.title}
              onChange={(e) => {
                const title = e.target.value
                updateSlide(selectedIndex, {
                  title,
                  narration: buildInfoSlideNarration({
                    hook: selected.hook,
                    title,
                    lines: selected.lines,
                  }),
                })
              }}
              placeholder="카드 큰 제목"
              className="border-white/10 bg-black/40 text-white"
            />
            <Textarea
              value={selected.lines.map((line) => stripInfoLineNumber(line.text)).join("\n")}
              onChange={(e) => {
                const nextLines = e.target.value
                  .split("\n")
                  .map((text) => stripInfoLineNumber(text))
                  .filter(Boolean)
                  .slice(0, 5)
                  .map((text) => ({ text, highlights: [] as string[] }))
                updateSlide(selectedIndex, {
                  lines: nextLines,
                  narration: buildInfoSlideNarration({
                    hook: selected.hook,
                    title: selected.title,
                    lines: nextLines,
                  }),
                })
              }}
              placeholder={
                "본문 (앞에 숫자 쓰지 마세요 · 원형 뱃지가 번호)\n예: 정리한다고 해도 어질러지는데\n수납공간이 부족하고\n물건이 자꾸 떨어지고\n청소하기 힘들어요"
              }
              rows={5}
              className="border-white/10 bg-black/40 text-white"
            />
            <p className="text-[11px] leading-5 text-zinc-500">
              중간 줄은 ~는데/~고 로 이어 쓰고, 마지막만 ~요로 맺으면 TTS가 더 자연스럽게 붙습니다.
              화면 숫자는 자동이라 텍스트에 1. 2. 를 넣지 마세요. 줄 등장 시 뽁 효과음이 납니다.
            </p>
          </div>

          <InfoCardFrame
            slide={selected}
            themeId={brief.themeId}
            slideIndex={selectedIndex}
            slideCount={slides.length}
            revealLineCount={null}
          />
        </div>
      ) : null}
    </section>
  )
}

"use client"

import { useEffect, useState, type RefObject } from "react"
import { ArrowLeft, ArrowRight, Download, Image as ImageIcon, Loader2, Palette, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Ver2StepShell } from "./Ver2StepShell"
import { MvpThumbnailAdvancedEditor } from "../shortform-studio/MvpThumbnailAdvancedEditor"
import type { MvpThumbnailDesign } from "@/lib/mvp-thumbnail-design"

type HookingText = { line1: string; line2: string }

type Props = {
  productName: string
  productImage: string | null
  imageUrls: string[]
  hookingText: HookingText
  onHookingTextChange: (hookingText: HookingText) => void
  isGeneratingThumbnail: boolean
  onGenerateThumbnail: () => void
  thumbnailUrl: string
  thumbnailCanvasRef: RefObject<HTMLCanvasElement | null>
  onDownloadThumbnail: () => void
  customThumbnailImage: string | null
  studioDesign: MvpThumbnailDesign | null
  onStudioApply: (dataUrl: string, hookingText: HookingText, design: MvpThumbnailDesign) => void
  error?: string
  onBack: () => void
  onNext: () => void
}

export function AiShoppingThumbnailStep({
  productName,
  productImage,
  imageUrls,
  hookingText,
  onHookingTextChange,
  isGeneratingThumbnail,
  onGenerateThumbnail,
  thumbnailUrl,
  thumbnailCanvasRef,
  onDownloadThumbnail,
  customThumbnailImage,
  studioDesign,
  onStudioApply,
  error,
  onBack,
  onNext,
}: Props) {
  const [studioOpen, setStudioOpen] = useState(false)
  const [isPreparingStudio, setIsPreparingStudio] = useState(false)
  const [isGeneratingText, setIsGeneratingText] = useState(false)
  const [studioHookingText, setStudioHookingText] = useState(hookingText)

  // 썸네일 스튜디오 기본 배경: AI이미지 단계에서 만든 장면을 최우선
  const aiSceneImage =
    imageUrls.find((url) => typeof url === "string" && url.trim().length > 0)?.trim() || ""
  const studioBackground =
    aiSceneImage ||
    (typeof productImage === "string" && productImage.trim()) ||
    (typeof customThumbnailImage === "string" && customThumbnailImage.trim()) ||
    (typeof thumbnailUrl === "string" && thumbnailUrl.trim()) ||
    ""

  useEffect(() => {
    setStudioHookingText(hookingText)
  }, [hookingText])

  const requestHookingText = async (): Promise<HookingText> => {
    try {
      const openaiApiKey =
        typeof window !== "undefined"
          ? localStorage.getItem("shotform_openai_api_key") || undefined
          : undefined
      const response = await fetch("/api/shotform/mvp-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey,
          productName,
          hookingInput: { productName },
          generateHookingOnly: true,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "썸네일 문구 생성 실패")
      const generated = data.hookingText as HookingText | undefined
      return (
        generated?.line1 && generated?.line2
          ? generated
          : {
              line1: `${productName || "이 제품"}, 왜 인기일까?`,
              line2: "핵심만 빠르게 확인",
            }
      )
    } catch (reason) {
      console.warn("[Thumbnail Studio] 문구 자동 생성 실패:", reason)
      return {
        line1: `${productName || "이 제품"}, 왜 인기일까?`,
        line2: "핵심만 빠르게 확인",
      }
    }
  }

  const applyHookingText = (next: HookingText) => {
    setStudioHookingText(next)
    onHookingTextChange(next)
  }

  const generateStudioText = async () => {
    setIsGeneratingText(true)
    try {
      applyHookingText(await requestHookingText())
    } finally {
      setIsGeneratingText(false)
    }
  }

  const openStudio = async () => {
    if (!studioBackground) {
      alert(
        "배경으로 쓸 이미지가 없습니다. AI이미지 단계에서 장면 이미지를 먼저 생성해 주세요."
      )
      return
    }
    if (studioHookingText.line1.trim() && studioHookingText.line2.trim()) {
      setStudioOpen(true)
      return
    }
    setIsPreparingStudio(true)
    try {
      applyHookingText(await requestHookingText())
      setStudioOpen(true)
    } finally {
      setIsPreparingStudio(false)
    }
  }

  return (
    <Ver2StepShell
      stepLabel="7단계"
      title="썸네일"
      description="AI로 생성하고 썸네일 스튜디오에서 자유롭게 편집합니다."
      icon={ImageIcon}
      accent="violet"
      headerRight={
        <>
          <Button
            variant="outline"
            onClick={onBack}
            className="border-white/15 bg-[#151b28] text-zinc-200 hover:bg-white/10"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            이전
          </Button>
          <Button
            onClick={onNext}
            className="bg-violet-600 font-semibold text-white hover:bg-violet-500"
          >
            다음 · AI영상편집
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </>
      }
    >
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="rounded-2xl border border-white/10 bg-[#121316] shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-zinc-100">
              <ImageIcon className="h-4 w-4 text-violet-400" />
              썸네일 미리보기
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-xl border border-violet-400/40 bg-black shadow-[0_0_35px_rgba(139,92,246,0.08)]">
              {thumbnailUrl ? (
                <canvas
                  ref={thumbnailCanvasRef}
                  className="h-full w-full object-cover"
                  style={{ aspectRatio: "9/16" }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-zinc-500">
                  <ImageIcon className="h-10 w-10 opacity-40" />
                  <p className="text-xs">AI 썸네일을 생성하세요</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={onGenerateThumbnail}
                disabled={isGeneratingThumbnail || !productImage}
                className="flex-1 bg-violet-600 text-white hover:bg-violet-500"
              >
                {isGeneratingThumbnail ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {isGeneratingThumbnail ? "생성 중…" : "AI 썸네일 생성"}
              </Button>
              {thumbnailUrl ? (
                <Button type="button" variant="outline" size="icon" onClick={onDownloadThumbnail}>
                  <Download className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void openStudio()}
              disabled={!studioBackground || isPreparingStudio}
              className="w-full border-violet-400/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
            >
              {isPreparingStudio ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Palette className="mr-2 h-4 w-4" />
              )}
              {isPreparingStudio ? "핵심 이미지·문구 준비 중…" : "썸네일 스튜디오 열기"}
            </Button>

            {aiSceneImage ? (
              <p className="text-center text-[11px] text-emerald-300/90">
                스튜디오 기본 배경: AI이미지 장면 1을 사용합니다.
              </p>
            ) : !productImage ? (
              <p className="text-center text-[11px] text-amber-300/90">
                AI이미지 장면이 없습니다. AI이미지 단계에서 이미지를 만든 뒤 스튜디오를 열어주세요.
              </p>
            ) : (
              <p className="text-center text-[11px] text-zinc-500">
                AI이미지 장면이 없어 제품 소싱 사진을 배경으로 씁니다.
              </p>
            )}
            {error ? <p className="whitespace-pre-wrap text-sm text-red-400">{error}</p> : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-violet-400/20 bg-[#121316] shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-zinc-100">
              <Sparkles className="h-4 w-4 text-fuchsia-400" />
              썸네일 문구 생성
            </CardTitle>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              제품에 어울리는 2줄 후킹 문구를 AI가 만들며, 아래 문구가 썸네일 스튜디오에 자동으로 들어갑니다.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              onClick={() => void generateStudioText()}
              disabled={isGeneratingText || !productName}
              className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 font-semibold text-white hover:from-fuchsia-500 hover:to-violet-500"
            >
              {isGeneratingText ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {isGeneratingText ? "AI 문구 생성 중…" : "AI 썸네일 문구 생성"}
            </Button>

            <div className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-400">첫 번째 줄</label>
                <Input
                  value={studioHookingText.line1}
                  onChange={(event) =>
                    applyHookingText({ ...studioHookingText, line1: event.target.value })
                  }
                  placeholder="예: 매일 쓰는데 몰랐어요"
                  className="border-white/15 bg-black/40 text-zinc-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-400">두 번째 줄</label>
                <Input
                  value={studioHookingText.line2}
                  onChange={(event) =>
                    applyHookingText({ ...studioHookingText, line2: event.target.value })
                  }
                  placeholder="예: 이 기능이 핵심입니다"
                  className="border-white/15 bg-black/40 text-zinc-100"
                />
              </div>
            </div>

            <div className="rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">
                Studio Preview Text
              </p>
              <p className="mt-3 text-xl font-black leading-tight text-white">
                {studioHookingText.line1 || "첫 번째 문구"}
              </p>
              <p className="mt-1 text-xl font-black leading-tight text-fuchsia-300">
                {studioHookingText.line2 || "두 번째 문구"}
              </p>
            </div>

          </CardContent>
        </Card>
      </div>

      <MvpThumbnailAdvancedEditor
        open={studioOpen}
        onOpenChange={setStudioOpen}
        backgroundUrl={studioBackground}
        referenceImageUrl={aiSceneImage || productImage || undefined}
        hookingText={studioHookingText}
        productName={productName}
        hookingInput={{ productName }}
        // 저장된 디자인이 깨진 배경 URL을 들고 있어도, 열 때마다 AI이미지 배경으로 덮어씀
        initialDesign={
          studioDesign
            ? { ...studioDesign, backgroundUrl: studioBackground || studioDesign.backgroundUrl }
            : null
        }
        onApply={(dataUrl, nextHookingText, design) => {
          onStudioApply(dataUrl, nextHookingText, design)
          setStudioOpen(false)
        }}
      />
    </Ver2StepShell>
  )
}

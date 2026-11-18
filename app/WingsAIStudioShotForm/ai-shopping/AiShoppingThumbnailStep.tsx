"use client"

import { useEffect, useState, type RefObject } from "react"
import { ArrowLeft, ArrowRight, Download, Image as ImageIcon, Loader2, Palette, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Ver2StepShell } from "./Ver2StepShell"
import { PhoneFrame } from "./premium-ui"
import { MvpThumbnailAdvancedEditor } from "../shortform-studio/MvpThumbnailAdvancedEditor"
import type { MvpThumbnailDesign } from "@/lib/mvp-thumbnail-design"

// light-remap 이 팔레트 유틸을 뒤집는 라우트라 hex 임의값만 사용
const T_CARD =
  "overflow-hidden rounded-[20px] border border-[#e3e6ec] bg-[#ffffff] shadow-[0_1px_2px_rgba(14,16,22,0.04),0_18px_40px_-32px_rgba(14,16,22,0.22)]"
const T_FOCUS = "focus-visible:ring-2 focus-visible:ring-[#2f3beb] focus-visible:ring-offset-2"
const T_INPUT =
  "h-10 rounded-[10px] border-[#e3e6ec] bg-[#ffffff] text-[14px] !text-[#0e1016] placeholder:text-[#9aa0ad] focus-visible:border-[#2f3beb] focus-visible:ring-[#2f3beb]/20"

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
  thumbnailCanvasRef: RefObject<HTMLCanvasElement>
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

  // 새로고침 뒤 죽은 blob: 등 로드 실패한 URL — 다음 후보로 넘어가기 위해 기록
  const [deadUrls, setDeadUrls] = useState<Set<string>>(() => new Set())
  const markDead = (url: string) =>
    setDeadUrls((prev) => (prev.has(url) ? prev : new Set(prev).add(url)))
  const alive = (url: unknown): string =>
    typeof url === "string" && url.trim() && !deadUrls.has(url.trim()) ? url.trim() : ""

  // 썸네일 스튜디오 기본 배경: AI이미지 단계에서 만든 장면을 최우선
  const aiSceneImage = imageUrls.map(alive).find(Boolean) || ""
  const studioBackground =
    aiSceneImage || alive(productImage) || alive(customThumbnailImage) || alive(thumbnailUrl) || ""
  const finishedThumbnail = alive(thumbnailUrl)

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
            className={`h-10 rounded-full border-[#e3e6ec] bg-[#ffffff] px-4 text-[#0e1016] hover:bg-[#f5f6fa] hover:text-[#0e1016] ${T_FOCUS}`}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            이전
          </Button>
          <Button
            onClick={onNext}
            className={`h-10 rounded-full bg-[#0e1016] px-5 font-semibold text-[#ffffff] hover:bg-[#262a36] ${T_FOCUS}`}
          >
            다음 · AI영상편집
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </>
      }
    >
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className={T_CARD}>
          <div className="flex items-center gap-2 border-b border-[#eef0f4] px-5 py-4 text-[14px] font-bold text-[#0e1016]">
            <ImageIcon className="h-4 w-4 text-[#2f3beb]" />
            썸네일 미리보기
          </div>
          <div className="space-y-3 p-5">
            <div className="rounded-[16px] bg-[#eef0f5] px-3 py-6">
              <PhoneFrame>
                {/* 다운로드·재그리기용 캔버스는 유지하고, 화면에는 <img> 로 바로 보여줌 */}
                {thumbnailUrl ? (
                  <canvas
                    ref={thumbnailCanvasRef}
                    aria-hidden
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ aspectRatio: "9/16" }}
                  />
                ) : null}
                {finishedThumbnail ? (
                  <img
                    key={finishedThumbnail}
                    src={finishedThumbnail}
                    alt="선택된 썸네일"
                    onError={() => markDead(finishedThumbnail)}
                    className="absolute inset-0 z-10 h-full w-full object-cover"
                  />
                ) : studioBackground ? (
                  <div className="absolute inset-0 z-10">
                    <img
                      key={studioBackground}
                      src={studioBackground}
                      alt="썸네일 배경 미리보기"
                      onError={() => markDead(studioBackground)}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#000000]/45 to-transparent" />
                    <div className="absolute inset-x-3 top-[16%] text-center font-black leading-[1.15] tracking-[-0.02em]">
                      {[studioHookingText.line1 || "첫 번째 문구", studioHookingText.line2 || "두 번째 문구"].map(
                        (line, i) => (
                          <p
                            key={i}
                            className={`break-keep text-[22px] ${i === 0 ? "text-[#ffffff]" : "mt-1 text-[#ffd23f]"}`}
                            style={{ WebkitTextStroke: "5px #000000", paintOrder: "stroke fill" }}
                          >
                            {line}
                          </p>
                        )
                      )}
                    </div>
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#000000]/60 px-2.5 py-1 text-[12px] text-[#e3e6ec]">
                      미리보기 · 아직 저장 전
                    </span>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center text-[#9aa0ad]">
                    <ImageIcon className="h-9 w-9 opacity-60" />
                    <p className="text-[13px]">AI 썸네일을 생성하세요</p>
                  </div>
                )}
              </PhoneFrame>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={onGenerateThumbnail}
                disabled={isGeneratingThumbnail || !productImage}
                className={`h-11 flex-1 rounded-[12px] bg-[#0e1016] font-semibold text-[#ffffff] hover:bg-[#262a36] disabled:bg-[#c9cdd6] disabled:opacity-100 ${T_FOCUS}`}
              >
                {isGeneratingThumbnail ? (
                  <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {isGeneratingThumbnail ? "생성 중…" : "AI 썸네일 생성"}
              </Button>
              {thumbnailUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onDownloadThumbnail}
                  aria-label="썸네일 다운로드"
                  title="썸네일 다운로드"
                  className={`h-11 w-11 rounded-[12px] border-[#e3e6ec] bg-[#ffffff] text-[#0e1016] hover:bg-[#f5f6fa] hover:text-[#0e1016] ${T_FOCUS}`}
                >
                  <Download className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void openStudio()}
              disabled={!studioBackground || isPreparingStudio}
              className={`h-11 w-full rounded-[12px] border-[#d9dcfb] bg-[#eef0ff] font-semibold text-[#2f3beb] hover:bg-[#e3e6ff] hover:text-[#2f3beb] ${T_FOCUS}`}
            >
              {isPreparingStudio ? (
                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <Palette className="mr-2 h-4 w-4" />
              )}
              {isPreparingStudio ? "핵심 이미지·문구 준비 중…" : "썸네일 스튜디오 열기"}
            </Button>

            {aiSceneImage ? (
              <p className="text-center text-[12px] text-[#0d9467]">
                스튜디오 기본 배경: AI이미지 장면 1을 사용합니다.
              </p>
            ) : !productImage ? (
              <p className="text-center text-[12px] text-[#b7790a]">
                AI이미지 장면이 없습니다. AI이미지 단계에서 이미지를 만든 뒤 스튜디오를 열어주세요.
              </p>
            ) : (
              <p className="text-center text-[12px] text-[#5c6170]">
                AI이미지 장면이 없어 제품 소싱 사진을 배경으로 씁니다.
              </p>
            )}
            {error ? (
              <p role="alert" className="whitespace-pre-wrap rounded-[12px] border border-[#f6d0d0] bg-[#fff4f4] px-3 py-2 text-[13px] text-[#c62828]">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <div className={T_CARD}>
          <div className="border-b border-[#eef0f4] px-5 py-4">
            <p className="flex items-center gap-2 text-[14px] font-bold text-[#0e1016]">
              <Sparkles className="h-4 w-4 text-[#2f3beb]" />
              썸네일 문구 생성
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#5c6170]">
              제품에 어울리는 2줄 후킹 문구를 AI가 만들며, 아래 문구가 썸네일 스튜디오에 자동으로 들어갑니다.
            </p>
          </div>
          <div className="space-y-4 p-5">
            <Button
              type="button"
              onClick={() => void generateStudioText()}
              disabled={isGeneratingText || !productName}
              className={`h-11 w-full rounded-[12px] bg-[#2f3beb] font-semibold text-[#ffffff] hover:bg-[#4350ff] disabled:bg-[#c9cdd6] disabled:opacity-100 ${T_FOCUS}`}
            >
              {isGeneratingText ? (
                <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {isGeneratingText ? "AI 문구 생성 중…" : "AI 썸네일 문구 생성"}
            </Button>

            <div className="space-y-3 rounded-[16px] border border-[#e8eaf0] bg-[#fafbfc] p-4">
              <div className="space-y-1.5">
                <label htmlFor="ai-thumb-line1" className="text-[12px] font-medium text-[#5c6170]">첫 번째 줄</label>
                <Input
                  id="ai-thumb-line1"
                  value={studioHookingText.line1}
                  onChange={(event) =>
                    applyHookingText({ ...studioHookingText, line1: event.target.value })
                  }
                  placeholder="예: 매일 쓰는데 몰랐어요"
                  className={T_INPUT}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ai-thumb-line2" className="text-[12px] font-medium text-[#5c6170]">두 번째 줄</label>
                <Input
                  id="ai-thumb-line2"
                  value={studioHookingText.line2}
                  onChange={(event) =>
                    applyHookingText({ ...studioHookingText, line2: event.target.value })
                  }
                  placeholder="예: 이 기능이 핵심입니다"
                  className={T_INPUT}
                />
              </div>
            </div>

            <div className="rounded-[16px] bg-[#0e1016] p-5">
              <p className="text-[11px] font-semibold text-[#9aa0ad]">스튜디오 문구 미리보기</p>
              <p className="mt-3 text-xl font-black leading-tight text-[#ffffff]">
                {studioHookingText.line1 || "첫 번째 문구"}
              </p>
              <p className="mt-1 text-xl font-black leading-tight text-[#ffd23f]">
                {studioHookingText.line2 || "두 번째 문구"}
              </p>
            </div>
          </div>
        </div>
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

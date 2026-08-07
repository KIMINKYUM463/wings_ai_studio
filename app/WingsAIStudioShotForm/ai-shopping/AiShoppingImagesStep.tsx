"use client"

import { useRef, useState, type Dispatch, type SetStateAction } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { StoryboardScene } from "./project-actions"
import type { PixabayImageHit, PixabayKeywordSuggestion } from "./actions"
import { BilingualPromptPanel } from "./BilingualPromptPanel"
import { Ver2StepShell } from "./Ver2StepShell"

export type ImagePromptItem = {
  type: string
  prompt: string
  description: string
  scriptText: string
  pixabayKeyword?: string
}

export type ScenePixabayState = {
  keyword: string
  hits: PixabayImageHit[]
  total: number
  loading: boolean
  error?: string
}

export type ImageModelId = "nano-banana" | "qwen-image"

type Props = {
  scenes: StoryboardScene[]
  imageUrls: string[]
  imagePrompts: ImagePromptItem[]
  customImagePrompts: Map<number, string>
  setCustomImagePrompt: (index: number, value: string) => void
  selectedSceneIndex: number
  setSelectedSceneIndex: (index: number) => void
  selectedSlots: Set<number>
  setSelectedSlots: Dispatch<SetStateAction<Set<number>>>
  imageModel: ImageModelId
  setImageModel: (model: ImageModelId) => void
  scenePixabay: Record<string, ScenePixabayState>
  isGeneratingAll: boolean
  bulkGeneratingIndex: number | null
  isGeneratingPrompts: boolean
  regeneratingMap: Map<number, boolean>
  error: string
  productImage?: string | null
  productImages?: string[]
  onBack: () => void
  onNext: () => void
  onGenerateAll: () => void | Promise<void>
  onGenerateMissing: () => void | Promise<void>
  onRegenerateOne: (index: number) => void | Promise<void>
  onUploadFile: (index: number, file: File | null) => void
  onClearSlot: (index: number) => void
  onRestoreAiImage: (index: number) => void
  onClearAll: () => void
  onSavePrompt: (index: number, prompt: string) => void
  onGetKeywordSuggestions: (index: number) => Promise<PixabayKeywordSuggestion[]>
  onSearchPixabay: (index: number, keyword: string) => void | Promise<void>
  onSelectPixabay: (index: number, hit: PixabayImageHit) => void
}

export function AiShoppingImagesStep({
  scenes,
  imageUrls,
  imagePrompts,
  customImagePrompts,
  setCustomImagePrompt,
  selectedSceneIndex,
  setSelectedSceneIndex,
  selectedSlots,
  setSelectedSlots,
  imageModel,
  setImageModel,
  scenePixabay,
  isGeneratingAll,
  bulkGeneratingIndex,
  isGeneratingPrompts,
  regeneratingMap,
  error,
  productImage,
  productImages = [],
  onBack,
  onNext,
  onGenerateAll,
  onGenerateMissing,
  onRegenerateOne,
  onUploadFile,
  onClearSlot,
  onRestoreAiImage,
  onClearAll,
  onSavePrompt,
  onGetKeywordSuggestions,
  onSearchPixabay,
  onSelectPixabay,
}: Props) {
  const sceneIndex = Math.min(Math.max(0, selectedSceneIndex), Math.max(0, scenes.length - 1))
  const scene = scenes[sceneIndex]
  const currentUrl = imageUrls[sceneIndex] || scene?.imageUrl || ""
  const currentPrompt = imagePrompts[sceneIndex]?.prompt || scene?.imagePrompt || ""
  const pixabay = scene ? scenePixabay[scene.id] : undefined
  const isBusyScene = Boolean(regeneratingMap.get(sceneIndex))
  const isBusyAny =
    isGeneratingAll || isGeneratingPrompts || Array.from(regeneratingMap.values()).some(Boolean)
  const missingCount = scenes.filter((_, index) => !imageUrls[index] && !scenes[index]?.imageUrl).length
  const filledCount = scenes.length - missingCount

  const [editingPrompt, setEditingPrompt] = useState("")
  const [showPromptEditor, setShowPromptEditor] = useState(false)
  const [showFreeImageDialog, setShowFreeImageDialog] = useState(false)
  const [keywordSuggestions, setKeywordSuggestions] = useState<PixabayKeywordSuggestion[]>([])
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false)
  const [keywordError, setKeywordError] = useState("")
  const [pixabayKeyword, setPixabayKeyword] = useState("")
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null)
  const [imageZoom, setImageZoom] = useState(1)
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 })
  const [isImagePanning, setIsImagePanning] = useState(false)
  const uploadRef = useRef<HTMLInputElement | null>(null)
  const zoomViewportRef = useRef<HTMLDivElement | null>(null)
  const panStartRef = useRef({ clientX: 0, clientY: 0, x: 0, y: 0 })

  const sceneIndices = scenes.map((_, index) => index)

  const selectScene = (index: number) => {
    setSelectedSceneIndex(index)
    const target = scenes[index]
    const state = target ? scenePixabay[target.id] : undefined
    setPixabayKeyword(state?.keyword || target?.pixabayKeyword || "")
  }

  const resetImageZoom = () => {
    setImageZoom(1)
    setImagePan({ x: 0, y: 0 })
    setIsImagePanning(false)
  }

  const changeImageZoom = (nextZoom: number) => {
    const clamped = Math.min(6, Math.max(1, nextZoom))
    setImageZoom(clamped)
    if (clamped === 1) setImagePan({ x: 0, y: 0 })
  }

  const handleImageWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const viewport = zoomViewportRef.current
    if (!viewport) return

    const rect = viewport.getBoundingClientRect()
    const pointerX = event.clientX - rect.left - rect.width / 2
    const pointerY = event.clientY - rect.top - rect.height / 2
    const direction = event.deltaY < 0 ? 1 : -1
    const nextZoom = Math.min(6, Math.max(1, imageZoom + direction * 0.1))
    if (nextZoom === imageZoom) return

    if (nextZoom === 1) {
      setImagePan({ x: 0, y: 0 })
    } else {
      const ratio = nextZoom / imageZoom
      setImagePan((current) => ({
        x: pointerX - (pointerX - current.x) * ratio,
        y: pointerY - (pointerY - current.y) * ratio,
      }))
    }
    setImageZoom(nextZoom)
  }

  const downloadSelected = async () => {
    const indices = Array.from(selectedSlots).filter((index) => imageUrls[index])
    for (const index of indices) {
      const url = imageUrls[index]
      try {
        const response = await fetch(url)
        const blob = await response.blob()
        const anchor = document.createElement("a")
        anchor.href = URL.createObjectURL(blob)
        anchor.download = `scene-M${index + 1}.webp`
        anchor.click()
        URL.revokeObjectURL(anchor.href)
      } catch {
        window.open(url, "_blank")
      }
    }
  }

  if (!scene) {
    return (
      <Ver2StepShell
        stepLabel="5단계"
        title="AI이미지"
        description="대본 장면이 없습니다."
        icon={ImageIcon}
        accent="emerald"
      >
        <div className="rounded-xl border border-dashed border-white/15 p-12 text-center text-zinc-500">
          대본 생성 단계에서 장면을 먼저 만들어주세요.
        </div>
      </Ver2StepShell>
    )
  }

  return (
    <Ver2StepShell
      stepLabel="5단계"
      title="AI이미지"
      description={`대본에서 만든 ${scenes.length}개 장면 · Replicate AI 모델 · 무료 이미지 선택`}
      icon={ImageIcon}
      accent="emerald"
      headerRight={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="border-white/15 bg-[#151b28] text-zinc-200 hover:bg-white/10"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            이전
          </Button>
          <Button
            size="sm"
            disabled={filledCount === 0}
            onClick={onNext}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            다음 · AI영상
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </>
      }
    >
      <div className="grid min-h-[70vh] grid-cols-1 gap-3 xl:grid-cols-12">
        <aside className="flex overflow-hidden rounded-2xl border border-white/10 bg-[#121316] xl:col-span-12">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
              <h3 className="text-sm font-semibold text-zinc-100">
                장면 <span className="text-emerald-300">({scenes.length}샷)</span>
              </h3>
              <span className="text-[10px] text-zinc-500">
                {bulkGeneratingIndex !== null
                  ? `${bulkGeneratingIndex + 1}번 장면 생성 중…`
                  : `${filledCount}/${scenes.length} 생성`}
              </span>
            </div>
            <div className="flex flex-1 gap-2 overflow-x-auto p-2">
              {sceneIndices.map((index) => {
                const item = scenes[index]
                const url = imageUrls[index] || item.imageUrl
                const active = index === sceneIndex
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectScene(index)}
                    className={`flex min-h-[142px] w-[270px] shrink-0 items-center gap-3 overflow-hidden rounded-xl border p-2 text-left transition ${
                      active
                        ? "border-emerald-400/55 bg-emerald-500/10"
                        : "border-white/10 bg-black/20 hover:border-white/25"
                    }`}
                  >
                    <div className="relative aspect-[9/16] h-[126px] shrink-0 overflow-hidden rounded-lg bg-black">
                      {url ? (
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ImageIcon className="h-7 w-7 text-zinc-700" />
                        </div>
                      )}
                      {regeneratingMap.get(index) ? (
                        <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-black/65 text-emerald-200">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span className="text-[9px] font-semibold">{index + 1}번 생성 중</span>
                        </span>
                      ) : null}
                      <span className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-black shadow">
                        {index + 1}
                      </span>
                      {selectedSlots.has(index) ? (
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-sky-500 p-0.5 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 pr-1">
                      <p className="line-clamp-3 text-[10px] leading-relaxed text-zinc-500">
                        {item.narration || "장면 대사가 없습니다."}
                      </p>
                      <p className={`mt-2 text-[10px] ${url ? "text-emerald-400" : "text-zinc-600"}`}>
                        {url ? "9:16 이미지 생성됨" : "9:16 이미지 미생성"}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-2.5">
              <Button
                className="h-10 bg-amber-500 font-bold text-black hover:bg-amber-400"
                disabled={isBusyAny}
                onClick={() => void onGenerateAll()}
              >
                {isGeneratingAll ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    {bulkGeneratingIndex !== null
                      ? `${bulkGeneratingIndex + 1}/${scenes.length} 생성 중`
                      : "준비 중"}
                  </>
                ) : (
                  "전체 AI 생성"
                )}
              </Button>
              <Button
                className="h-10 bg-violet-600 text-white hover:bg-violet-500"
                disabled={isBusyAny || missingCount === 0}
                onClick={() => void onGenerateMissing()}
              >
                미생성 ({missingCount})
              </Button>
            </div>
          </div>
        </aside>

        <section className="flex flex-col space-y-3 rounded-2xl border border-white/10 bg-[#121316] p-4 xl:col-span-7">
          <h3 className="truncate text-sm font-semibold text-zinc-100">
            <span className="text-emerald-300">M{sceneIndex + 1}</span>{" "}
            <span className="font-normal text-zinc-400">
              {(scene.narration || scene.title || "").slice(0, 42)}
            </span>
          </h3>

          <div
            className="relative mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-xl border border-white/15 bg-black"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              onUploadFile(sceneIndex, event.dataTransfer.files?.[0] || null)
            }}
          >
            {isBusyScene ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/65">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
                <p className="text-xs text-emerald-200">
                  {imageModel === "qwen-image" ? "Qwen Image" : "Nano Banana"} 생성 중…
                </p>
              </div>
            ) : null}
            {currentUrl ? (
              <button
                type="button"
                onClick={() => {
                  resetImageZoom()
                  setZoomedImageUrl(currentUrl)
                }}
                className="group h-full w-full cursor-zoom-in"
                title="이미지 확대"
              >
                <img src={currentUrl} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100">
                  <ZoomIn className="h-4 w-4" />
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500 hover:bg-white/[0.03]"
              >
                <ImageIcon className="h-10 w-10 opacity-40" />
                <span className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
                  이미지 추가
                </span>
                <span className="text-xs">클릭하거나 드래그해 업로드</span>
              </button>
            )}
            <div className="pointer-events-none absolute left-2 right-2 top-2 flex justify-between">
              <Button
                type="button"
                size="sm"
                className="pointer-events-auto h-8 bg-emerald-600 text-xs text-white"
                onClick={() => uploadRef.current?.click()}
              >
                <Upload className="mr-1 h-3.5 w-3.5" />
                추가
              </Button>
              {currentUrl ? (
                <Button
                  type="button"
                  size="sm"
                  className="pointer-events-auto h-8 bg-rose-700 text-xs text-white"
                  onClick={() => onClearSlot(sceneIndex)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  삭제
                </Button>
              ) : null}
            </div>
            {scene.aiImageUrl && currentUrl !== scene.aiImageUrl ? (
              <Button
                type="button"
                size="sm"
                className="absolute bottom-2 left-2 z-10 h-8 bg-amber-500 text-xs font-semibold text-black hover:bg-amber-400"
                onClick={() => onRestoreAiImage(sceneIndex)}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                AI 원본으로 복원
              </Button>
            ) : null}
            <input
              ref={uploadRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                onUploadFile(sceneIndex, event.target.files?.[0] || null)
                event.target.value = ""
              }}
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="mb-1 text-[11px] font-semibold text-zinc-500">이 구간 대사</p>
            <p className="min-h-10 whitespace-pre-wrap text-sm text-zinc-200">{scene.narration}</p>
          </div>

        </section>

        <aside className="space-y-3 rounded-2xl border border-white/10 bg-[#121316] p-4 xl:col-span-5">
          <h3 className="text-sm font-semibold text-zinc-100">
            컨트롤 <span className="text-emerald-300">M{sceneIndex + 1}</span>
          </h3>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">이미지 모델</Label>
            <Select value={imageModel} onValueChange={(value) => setImageModel(value as ImageModelId)}>
              <SelectTrigger className="border-white/15 bg-black/40 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nano-banana">Nano Banana</SelectItem>
                <SelectItem value="qwen-image">Qwen Image</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-zinc-600">
              {imageModel === "qwen-image" ? "qwen/qwen-image" : "google/nano-banana"} · 제품
              참고 이미지 지원 · 9:16
            </p>
          </div>

          <Button
            className="h-11 w-full bg-gradient-to-r from-emerald-500 to-teal-500 font-bold text-white"
            disabled={isBusyAny || !currentPrompt}
            onClick={() => void onRegenerateOne(sceneIndex)}
          >
            {isBusyScene ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            이 장면 AI이미지 생성
          </Button>

          <div className="space-y-2">
            <BilingualPromptPanel
              prompt={currentPrompt}
              title="생성 프롬프트"
              emptyText="대본 단계에서 이미지 프롬프트를 생성해주세요."
            />
            <Input
              value={customImagePrompts.get(sceneIndex) || ""}
              onChange={(event) => setCustomImagePrompt(sceneIndex, event.target.value)}
              placeholder="추가 요구사항 (예: brighter lighting)"
              className="h-8 border-white/10 bg-black/40 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-white/15 bg-[#17191e] text-zinc-200 hover:bg-white/10 hover:text-white"
              onClick={() => {
                setEditingPrompt(currentPrompt)
                setShowPromptEditor(true)
              }}
            >
              <FileText className="mr-1 h-3.5 w-3.5" />
              프롬프트 보기/수정
            </Button>
          </div>

          <Button
            type="button"
            className="h-11 w-full bg-teal-600 font-semibold text-white hover:bg-teal-500"
            onClick={async () => {
              setShowFreeImageDialog(true)
              setKeywordSuggestions([])
              setKeywordError("")
              setPixabayKeyword("")
              setIsLoadingKeywords(true)
              try {
                const suggestions = await onGetKeywordSuggestions(sceneIndex)
                setKeywordSuggestions(suggestions)
                if (suggestions.length === 0) {
                  setKeywordError("추천 키워드를 만들지 못했습니다. 다시 시도해주세요.")
                }
              } catch (suggestionError) {
                setKeywordError(
                  suggestionError instanceof Error
                    ? suggestionError.message
                    : "키워드 추천에 실패했습니다."
                )
              } finally {
                setIsLoadingKeywords(false)
              }
            }}
          >
            <Search className="mr-2 h-4 w-4" />
            무료 이미지 등록
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 hover:text-sky-100 disabled:bg-[#17191e] disabled:text-zinc-500"
              disabled={filledCount === 0}
              onClick={() =>
                setSelectedSlots(
                  new Set(scenes.map((_, index) => index).filter((index) => Boolean(imageUrls[index])))
                )
              }
            >
              전체 선택
            </Button>
            <Button
              variant="outline"
              className="border-white/15 bg-[#17191e] text-zinc-300 hover:bg-white/10 hover:text-white"
              onClick={() => setSelectedSlots(new Set())}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              선택 해제
            </Button>
            <Button
              className="col-span-2 bg-indigo-600 text-white hover:bg-indigo-500"
              disabled={selectedSlots.size === 0}
              onClick={() => void downloadSelected()}
            >
              <Download className="mr-1 h-4 w-4" />
              선택 이미지 다운로드 ({selectedSlots.size})
            </Button>
            <Button
              className="col-span-2 bg-rose-800 text-white hover:bg-rose-700"
              disabled={filledCount === 0}
              onClick={onClearAll}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              이미지 일괄 삭제
            </Button>
          </div>

          {productImage || productImages[0] ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-2">
              <img
                src={productImage || productImages[0]}
                alt="제품 참고"
                className="h-12 w-8 rounded object-cover ring-1 ring-emerald-400/40"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-emerald-200">
                  제품 소싱 원본 참고
                  {productImages.length > 1 ? ` · ${productImages.length}장` : ""}
                </p>
                <p className="text-[10px] text-zinc-500 leading-snug">
                  이 상품(색·로고·프린트)이 그대로 나와야 합니다
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
              제품 참고 이미지가 없습니다. 제품 소싱에서 원본 사진을 먼저 수집하세요.
            </p>
          )}
          {error ? <p className="whitespace-pre-wrap text-xs text-red-400">{error}</p> : null}
        </aside>
      </div>

      <Dialog
        open={Boolean(zoomedImageUrl)}
        onOpenChange={(open) => {
          if (!open) {
            setZoomedImageUrl(null)
            resetImageZoom()
          }
        }}
      >
        <DialogContent className="max-w-6xl overflow-hidden border-white/15 bg-black/95 p-3 text-zinc-100">
          <DialogHeader className="sr-only">
            <DialogTitle>이미지 확대 보기</DialogTitle>
            <DialogDescription>
              마우스 휠로 확대하거나 축소하고 드래그해 이동합니다.
            </DialogDescription>
          </DialogHeader>
          {zoomedImageUrl ? (
            <>
              <div className="absolute left-5 top-4 z-20 flex items-center gap-1 rounded-lg bg-black/75 p-1 shadow-lg">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white hover:bg-white/15"
                  onClick={() => changeImageZoom(imageZoom - 0.2)}
                  title="축소"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center text-xs font-semibold text-white">
                  {Math.round(imageZoom * 100)}%
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white hover:bg-white/15"
                  onClick={() => changeImageZoom(imageZoom + 0.2)}
                  title="확대"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white hover:bg-white/15"
                  onClick={resetImageZoom}
                  title="원래 크기"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-[11px] text-zinc-300">
                휠 위: 확대 · 휠 아래: 축소 · 드래그: 이동
              </div>
              <div
                ref={zoomViewportRef}
                className={`flex h-[86vh] w-full touch-none select-none items-center justify-center overflow-hidden rounded-lg bg-black ${
                  imageZoom > 1
                    ? isImagePanning
                      ? "cursor-grabbing"
                      : "cursor-grab"
                    : "cursor-zoom-in"
                }`}
                onWheel={handleImageWheel}
                onDoubleClick={() => changeImageZoom(imageZoom > 1 ? 1 : 2)}
                onPointerDown={(event) => {
                  if (imageZoom <= 1) return
                  event.currentTarget.setPointerCapture(event.pointerId)
                  panStartRef.current = {
                    clientX: event.clientX,
                    clientY: event.clientY,
                    x: imagePan.x,
                    y: imagePan.y,
                  }
                  setIsImagePanning(true)
                }}
                onPointerMove={(event) => {
                  if (!isImagePanning) return
                  setImagePan({
                    x: panStartRef.current.x + event.clientX - panStartRef.current.clientX,
                    y: panStartRef.current.y + event.clientY - panStartRef.current.clientY,
                  })
                }}
                onPointerUp={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId)
                  }
                  setIsImagePanning(false)
                }}
                onPointerCancel={() => setIsImagePanning(false)}
              >
                <img
                  src={zoomedImageUrl}
                  alt="확대된 장면 이미지"
                  draggable={false}
                  className="max-h-full max-w-full rounded-lg object-contain will-change-transform"
                  style={{
                    transform: `translate3d(${imagePan.x}px, ${imagePan.y}px, 0) scale(${imageZoom})`,
                    transformOrigin: "center center",
                  }}
                />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showFreeImageDialog} onOpenChange={setShowFreeImageDialog}>
        <DialogContent className="max-w-3xl border-white/15 bg-[#121316] text-zinc-100">
          <DialogHeader>
            <DialogTitle>무료 이미지 등록 · M{sceneIndex + 1}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              장면 대사에 어울리는 한국어 키워드를 선택하면 영어로 변환해 Pixabay를 검색합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <p className="mb-1 text-[10px] font-semibold text-zinc-500">장면 대사</p>
            <p className="text-sm text-zinc-200">{scene.narration}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-300">추천 키워드</p>
            {isLoadingKeywords ? (
              <div className="flex items-center gap-2 py-5 text-sm text-teal-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                대본을 분석해 키워드를 만드는 중…
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {keywordSuggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.labelKo}-${suggestion.queryEn}`}
                    type="button"
                    onClick={() => {
                      setPixabayKeyword(suggestion.queryEn)
                      void onSearchPixabay(sceneIndex, suggestion.queryEn)
                    }}
                    className={`rounded-full border px-3 py-2 text-left text-xs transition ${
                      pixabayKeyword === suggestion.queryEn
                        ? "border-teal-400 bg-teal-500/20 text-teal-100"
                        : "border-white/15 bg-black/30 text-zinc-300 hover:border-teal-400/50"
                    }`}
                  >
                    <span className="font-semibold">{suggestion.labelKo}</span>
                    <span className="ml-1.5 text-[10px] text-zinc-500">→ {suggestion.queryEn}</span>
                  </button>
                ))}
              </div>
            )}
            {keywordError ? <p className="text-xs text-red-400">{keywordError}</p> : null}
          </div>

          {pixabayKeyword ? (
            <div className="flex items-center gap-2 rounded-lg border border-teal-400/20 bg-teal-500/[0.06] p-2">
              <span className="shrink-0 text-[10px] text-teal-300">영어 검색어</span>
              <Input
                value={pixabayKeyword}
                onChange={(event) => setPixabayKeyword(event.target.value)}
                className="h-8 border-white/10 bg-black/40 text-xs"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void onSearchPixabay(sceneIndex, pixabayKeyword)
                  }
                }}
              />
              <Button
                size="sm"
                className="h-8 bg-teal-600 text-white hover:bg-teal-500"
                disabled={pixabay?.loading}
                onClick={() => void onSearchPixabay(sceneIndex, pixabayKeyword)}
              >
                {pixabay?.loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ) : null}

          {pixabay?.error ? <p className="text-xs text-red-400">{pixabay.error}</p> : null}
          <div className="grid max-h-[45vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-6">
            {(pixabay?.hits || []).map((hit) => (
              <button
                key={hit.id}
                type="button"
                onClick={() => {
                  onSelectPixabay(sceneIndex, hit)
                  setShowFreeImageDialog(false)
                }}
                className="group relative aspect-[9/16] overflow-hidden rounded-lg border border-white/10 hover:border-teal-400/70"
                title={hit.tags}
              >
                <img
                  src={hit.webformatURL || hit.previewURL}
                  alt={hit.tags}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </button>
            ))}
          </div>
          {!pixabay?.loading && pixabayKeyword && (pixabay?.hits.length || 0) === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-600">
              검색 결과가 없습니다. 다른 키워드를 선택해주세요.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showPromptEditor} onOpenChange={setShowPromptEditor}>
        <DialogContent className="max-w-lg border-white/15 bg-[#121316] text-zinc-100">
          <DialogHeader>
            <DialogTitle>이미지 프롬프트 · M{sceneIndex + 1}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              이 장면의 이미지 생성 프롬프트입니다.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editingPrompt}
            onChange={(event) => setEditingPrompt(event.target.value)}
            className="min-h-52 border-white/15 bg-black/40 font-mono text-xs"
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="border-white/15 bg-[#17191e] text-zinc-200 hover:bg-white/10 hover:text-white"
              onClick={() => setShowPromptEditor(false)}
            >
              취소
            </Button>
            <Button
              className="bg-emerald-500 text-black hover:bg-emerald-400"
              onClick={() => {
                onSavePrompt(sceneIndex, editingPrompt.trim())
                setShowPromptEditor(false)
              }}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ver2StepShell>
  )
}

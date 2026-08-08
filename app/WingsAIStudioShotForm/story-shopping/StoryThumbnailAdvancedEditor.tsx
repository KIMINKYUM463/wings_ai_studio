"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Download,
  ImageIcon,
  Layers,
  Loader2,
  Palette,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  addThumbnailElement,
  applyAiGeneratedBackground,
  applyFullAiThumbnail,
  createThumbnailDesign,
  defaultBackgroundTransform,
  hookingFromThumbnailDesign,
  removeThumbnailLayer,
  resolveBackgroundTransform,
  setThumbnailBackground,
  thumbnailBackgroundImageStyle,
  thumbnailTextAnchorTransform,
  updateThumbnailBackgroundTransform,
  updateThumbnailElement,
  updateThumbnailText,
  type MvpThumbnailDesign,
  type ThumbnailTextLayer,
} from "@/lib/mvp-thumbnail-design"
import { exportThumbnailDesignToDataUrl } from "@/lib/mvp-thumbnail-export-canvas"
import { persistImageUrlAsDataUrl } from "@/lib/mvp-thumbnail-capture"
import type { MvpThumbnailHookingText } from "@/lib/mvp-studio-types"
import type { ThumbnailHookingInput } from "@/lib/shotform-mvp-thumbnail"
import { STUDIO_OVERLAY_CATALOG } from "@/lib/shotform-studio-overlay-catalog"
import { StudioOverlayGraphic } from "../shoppingshotform/StudioOverlayGraphic"
import { useThumbnailDesignHistory } from "../shortform-studio/useThumbnailDesignHistory"
import {
  STORY_THUMBNAIL_CHROME,
  STORY_THUMBNAIL_TEMPLATES,
  createStoryThumbnailDesign,
  fitStoryHeadlineFontSize,
  isStoryThumbnailTemplateId,
} from "./story-thumbnail-templates"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  backgroundUrl: string
  backgroundCandidates?: string[]
  productReferenceImageUrl?: string
  hookingText: MvpThumbnailHookingText
  productName: string
  hookingInput?: ThumbnailHookingInput
  initialDesign?: MvpThumbnailDesign | null
  onApply: (
    thumbnailDataUrl: string,
    hooking: MvpThumbnailHookingText,
    design: MvpThumbnailDesign
  ) => void
}

type SideTab = "template" | "text" | "elements" | "background" | "filter" | "ai"

function filterCss(design: MvpThumbnailDesign): string {
  const f = design.filter
  return `blur(${f.blur}px) brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%)`
}

function addTextLayer(design: MvpThumbnailDesign): MvpThumbnailDesign {
  const id = `story_txt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  return {
    ...design,
    texts: [
      ...design.texts,
      {
        id,
        role: "custom",
        text: "새 텍스트",
        x: 50,
        y: 50,
        fontSize: 38,
        fontWeight: 900,
        color: "#ffffff",
        strokeOn: true,
        strokeColor: "#000000",
        strokeWidth: 6,
        strokePadH: 0,
        shadow: true,
        letterSpacing: 0,
        rotation: 0,
        align: "center",
        bgOn: false,
        bgColor: "#000000",
        bgOpacity: 70,
        widthPct: 82,
      },
    ],
  }
}

export function StoryThumbnailAdvancedEditor({
  open,
  onOpenChange,
  backgroundUrl,
  backgroundCandidates = [],
  productReferenceImageUrl,
  hookingText,
  productName,
  hookingInput,
  initialDesign = null,
  onApply,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const sessionReadyRef = useRef(false)
  const {
    design,
    canUndo,
    resetDesign,
    patchDesign,
    commitDesign,
    undo,
  } = useThumbnailDesignHistory(
    createThumbnailDesign(backgroundUrl, hookingText, "story-dark-yellow")
  )
  const [sideTab, setSideTab] = useState<SideTab>("template")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [generatingCopy, setGeneratingCopy] = useState(false)
  const [aiGenerating, setAiGenerating] = useState<"background" | "full" | null>(null)
  const [error, setError] = useState("")
  /** 수집 사진을 data URL로 바꾼 뒤에도 '선택됨' 표시용 */
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!open) {
      sessionReadyRef.current = false
      return
    }
    if (sessionReadyRef.current) return
    sessionReadyRef.current = true
    const initialTemplateId = initialDesign?.templateId || ""
    const storyTemplateId = isStoryThumbnailTemplateId(initialTemplateId)
      ? initialTemplateId
      : null
    const shouldUpgradeLegacyTemplate =
      initialDesign &&
      storyTemplateId &&
      initialDesign.texts.some(
        (text) =>
          text.fontSize > 50 ||
          text.bgOn ||
          ((text.role === "hook1" || text.role === "hook2") &&
            (text.fontSize < 36 || text.strokeWidth < 18))
      )
    const restored =
      initialDesign && !shouldUpgradeLegacyTemplate
        ? {
            ...initialDesign,
            backgroundUrl: initialDesign.backgroundUrl || backgroundUrl,
          }
        : createStoryThumbnailDesign({
            templateId: storyTemplateId || "story-dark-yellow",
            backgroundUrl: initialDesign?.backgroundUrl || backgroundUrl,
            hookingText: initialDesign
              ? hookingFromThumbnailDesign(initialDesign)
              : hookingText,
            subheadline:
              initialDesign?.texts.find((text) => text.role === "badge")?.text ||
              `${productName || "오늘의 제품"} 핵심 이야기`,
          })
    resetDesign(restored)
    setSelectedId(null)
    setError("")
    const matchIndex = backgroundCandidates.findIndex(
      (url) => url === (restored.backgroundUrl || backgroundUrl)
    )
    setSelectedCandidateIndex(matchIndex >= 0 ? matchIndex : null)
  }, [
    backgroundCandidates,
    backgroundUrl,
    hookingText,
    initialDesign,
    open,
    productName,
    resetDesign,
  ])

  const selectedText = design.texts.find((text) => text.id === selectedId)
  const selectedElement = design.elements.find((element) => element.id === selectedId)
  const backgroundTransform = resolveBackgroundTransform(design)

  const startLayerDrag = (
    event: ReactPointerEvent,
    kind: "text" | "element",
    id: string,
    startX: number,
    startY: number
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(id)
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const pointerX = event.clientX
    const pointerY = event.clientY
    const move = (nextEvent: PointerEvent) => {
      const x = Math.max(0, Math.min(100, startX + ((nextEvent.clientX - pointerX) / rect.width) * 100))
      const y = Math.max(0, Math.min(100, startY + ((nextEvent.clientY - pointerY) / rect.height) * 100))
      patchDesign((current) =>
        kind === "text"
          ? updateThumbnailText(current, id, { x, y })
          : updateThumbnailElement(current, id, { x, y })
      )
    }
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
  }

  const startElementResize = (
    event: ReactPointerEvent,
    element: MvpThumbnailDesign["elements"][number]
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(element.id)
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const centerX = rect.left + (element.x / 100) * rect.width
    const centerY = rect.top + (element.y / 100) * rect.height
    const startDistance =
      Math.hypot(event.clientX - centerX, event.clientY - centerY) || 1
    const startSize = element.size
    const move = (nextEvent: PointerEvent) => {
      const distance =
        Math.hypot(nextEvent.clientX - centerX, nextEvent.clientY - centerY) ||
        1
      const size = Math.round(
        Math.max(18, Math.min(220, startSize * (distance / startDistance)))
      )
      patchDesign((current) =>
        updateThumbnailElement(current, element.id, { size })
      )
    }
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
  }

  const startElementRotate = (
    event: ReactPointerEvent,
    element: MvpThumbnailDesign["elements"][number]
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(element.id)
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const centerX = rect.left + (element.x / 100) * rect.width
    const centerY = rect.top + (element.y / 100) * rect.height
    const startAngle =
      (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) /
      Math.PI
    const startRotation = element.rotation
    const move = (nextEvent: PointerEvent) => {
      const angle =
        (Math.atan2(
          nextEvent.clientY - centerY,
          nextEvent.clientX - centerX
        ) *
          180) /
        Math.PI
      let rotation = startRotation + angle - startAngle
      while (rotation > 180) rotation -= 360
      while (rotation < -180) rotation += 360
      patchDesign((current) =>
        updateThumbnailElement(current, element.id, {
          rotation: Math.round(rotation),
        })
      )
    }
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
  }

  const applyTemplate = (templateId: string) => {
    const template = STORY_THUMBNAIL_TEMPLATES.find((item) => item.id === templateId)
    if (!template || !isStoryThumbnailTemplateId(template.id)) return
    const storyTemplateId = template.id
    commitDesign((current) => {
      const badge =
        current.texts.find((text) => text.role === "badge")?.text ||
        template.description
      const next = createStoryThumbnailDesign({
        templateId: storyTemplateId,
        backgroundUrl: current.backgroundUrl,
        hookingText: hookingFromThumbnailDesign(current),
        subheadline: badge,
      })
      return {
        ...next,
        backgroundTransform: current.backgroundTransform,
        elements: current.elements,
      }
    })
    setSelectedId(null)
  }

  const uploadBackground = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || "")
      commitDesign((current) => setThumbnailBackground(current, url))
    }
    reader.onerror = () => setError("배경 이미지를 읽지 못했습니다.")
    reader.readAsDataURL(file)
  }

  const rewriteSelectedText = async () => {
    if (!selectedText) return
    setRewriting(true)
    setError("")
    try {
      const response = await fetch("/api/shotform/mvp-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey:
            typeof window !== "undefined"
              ? localStorage.getItem("shotform_openai_api_key") || undefined
              : undefined,
          productName,
          hookingInput: hookingInput || { productName },
          copyStyle: "story-reference",
          rewriteTextOnly: true,
          currentText: selectedText.text,
          textRole: selectedText.role,
          otherLines: design.texts
            .filter((text) => text.id !== selectedText.id)
            .map((text) => text.text),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "AI 문구 변환 실패")
      if (payload.text) {
        const nextText = String(payload.text).trim()
        commitDesign((current) =>
          updateThumbnailText(current, selectedText.id, {
            text: nextText,
            ...((selectedText.role === "hook1" ||
              selectedText.role === "hook2")
              ? { fontSize: fitStoryHeadlineFontSize(nextText) }
              : {}),
          })
        )
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 문구 변환 실패")
    } finally {
      setRewriting(false)
    }
  }

  const generateStoryHookingCopy = async () => {
    setGeneratingCopy(true)
    setError("")
    try {
      const response = await fetch("/api/shotform/mvp-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey:
            typeof window !== "undefined"
              ? localStorage.getItem("shotform_openai_api_key") || undefined
              : undefined,
          productName,
          hookingInput: hookingInput || { productName },
          copyStyle: "story-reference",
          generateHookingOnly: true,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "AI 후킹 문구 생성 실패")
      const copy = payload.hookingText as {
        line1?: string
        line2?: string
        subheadline?: string
      }
      if (!copy?.line1 || !copy.line2) {
        throw new Error("AI가 유효한 후킹 문구를 만들지 못했습니다.")
      }
      commitDesign((current) => ({
        ...current,
        texts: current.texts.map((text) => {
          if (text.role === "hook1") {
            const nextText = copy.line1!.trim()
            return {
              ...text,
              text: nextText,
              fontSize: fitStoryHeadlineFontSize(nextText),
            }
          }
          if (text.role === "hook2") {
            const nextText = copy.line2!.trim()
            return {
              ...text,
              text: nextText,
              fontSize: fitStoryHeadlineFontSize(nextText),
            }
          }
          if (text.role === "badge" && copy.subheadline) {
            return { ...text, text: copy.subheadline.trim() }
          }
          return text
        }),
      }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 후킹 문구 생성 실패")
    } finally {
      setGeneratingCopy(false)
    }
  }

  const generateAiAsset = async (mode: "background" | "full") => {
    const replicateApiKey =
      typeof window !== "undefined"
        ? localStorage.getItem("shotform_replicate_api_key") || ""
        : ""
    if (!replicateApiKey) {
      setError("Replicate API 키를 ShotForm 설정에 저장해주세요.")
      return
    }
    const productReference = productReferenceImageUrl?.trim()
    if (!productReference) {
      setError("상품 원본 사진이 없어 AI 생성할 수 없습니다. 먼저 상품을 선택해주세요.")
      return
    }
    setAiGenerating(mode)
    setError("")
    try {
      const productImageBase64 = await persistImageUrlAsDataUrl(productReference)
      const currentHooking = hookingFromThumbnailDesign(design)
      const response = await fetch("/api/shotform/mvp-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey:
            typeof window !== "undefined"
              ? localStorage.getItem("shotform_openai_api_key") || undefined
              : undefined,
          replicateApiKey,
          productName,
          hookingInput: hookingInput || { productName },
          copyStyle: "story-reference",
          productImageBase64,
          hookingText: currentHooking,
          generateBackgroundOnly: mode === "background",
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || "AI 썸네일 생성 실패")
      }
      if (mode === "background") {
        if (!payload.backgroundUrl) throw new Error("AI 배경 URL을 받지 못했습니다.")
        const persisted = await persistImageUrlAsDataUrl(payload.backgroundUrl)
        commitDesign((current) =>
          applyAiGeneratedBackground(current, persisted)
        )
      } else {
        if (!payload.thumbnailUrl) throw new Error("AI 썸네일 URL을 받지 못했습니다.")
        commitDesign((current) =>
          applyFullAiThumbnail(
            current,
            payload.thumbnailUrl,
            payload.hookingText || currentHooking
          )
        )
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 썸네일 생성 실패")
    } finally {
      setAiGenerating(null)
    }
  }

  const ensureExportableBackground = async (
    current: MvpThumbnailDesign
  ): Promise<MvpThumbnailDesign> => {
    const bg = current.backgroundUrl.trim()
    if (!bg || !/^https?:\/\//i.test(bg)) return current
    const persisted = await persistImageUrlAsDataUrl(bg)
    const next = setThumbnailBackground(current, persisted)
    commitDesign(() => next)
    return next
  }

  const exportAndApply = async () => {
    if (!stageRef.current) return
    setExporting(true)
    setError("")
    try {
      const exportDesign = await ensureExportableBackground(design)
      const dataUrl = await exportThumbnailDesignToDataUrl(
        exportDesign,
        stageRef.current
      )
      onApply(dataUrl, hookingFromThumbnailDesign(exportDesign), exportDesign)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "PNG 생성 실패")
    } finally {
      setExporting(false)
    }
  }

  const downloadPreview = async () => {
    if (!stageRef.current) return
    setExporting(true)
    try {
      const exportDesign = await ensureExportableBackground(design)
      const dataUrl = await exportThumbnailDesignToDataUrl(
        exportDesign,
        stageRef.current
      )
      const anchor = document.createElement("a")
      anchor.href = dataUrl
      anchor.download = `${productName || "story"}-thumbnail.png`
      anchor.click()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "PNG 다운로드 실패")
    } finally {
      setExporting(false)
    }
  }

  const tabs = [
    ["template", "템플릿", Palette],
    ["text", "텍스트", Type],
    ["elements", "요소", Layers],
    ["background", "배경", ImageIcon],
    ["filter", "필터", Sparkles],
    ["ai", "AI", Sparkles],
  ] as const

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="z-[320] h-[96vh] w-[98vw] max-w-[1500px] overflow-hidden border-slate-700 bg-[#111318] p-0 text-white sm:max-w-[min(98vw,1500px)]"
        overlayClassName="z-[310] bg-black/80"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>스토리 전용 썸네일 스튜디오</DialogTitle>
          <DialogDescription>스토리 쇼핑 전용 썸네일 편집기</DialogDescription>
        </DialogHeader>

        <div className="grid h-full grid-rows-[52px_minmax(0,1fr)]">
          <header className="flex items-center justify-between border-b border-white/10 px-4">
            <div>
              <p className="text-sm font-black">스토리 전용 썸네일 스튜디오</p>
              <p className="text-[9px] text-white/40">리믹스 쇼핑숏폼과 분리된 전용 편집기 · 1080×1920</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" disabled={!canUndo} onClick={() => undo()} className="text-white/70 hover:bg-white/10 hover:text-white">
                <Undo2 className="mr-1.5 h-4 w-4" />실행 취소
              </Button>
              <Button type="button" variant="outline" onClick={() => void downloadPreview()} disabled={exporting} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Download className="mr-1.5 h-4 w-4" />PNG
              </Button>
              <Button type="button" onClick={() => void exportAndApply()} disabled={exporting} className="bg-violet-600 text-white hover:bg-violet-500">
                {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                적용하기
              </Button>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-white/60 hover:bg-white/10 hover:text-white">닫기</Button>
            </div>
          </header>

          <div className="grid min-h-0 grid-cols-[280px_minmax(0,1fr)_300px]">
            <aside className="min-h-0 overflow-y-auto border-r border-white/10 bg-[#151820]">
              <div className="grid grid-cols-6 border-b border-white/10">
                {tabs.map(([id, label, Icon]) => (
                  <button key={id} type="button" onClick={() => setSideTab(id)} className={`flex flex-col items-center gap-1 px-1 py-2 text-[9px] ${sideTab === id ? "bg-violet-500/15 text-violet-300" : "text-white/45 hover:bg-white/5"}`}>
                    <Icon className="h-4 w-4" />{label}
                  </button>
                ))}
              </div>

              <div className="space-y-4 p-4">
                {sideTab === "template" ? (
                  <div className="grid grid-cols-2 gap-2">
                    {STORY_THUMBNAIL_TEMPLATES.map((template) => (
                      <button key={template.id} type="button" onClick={() => applyTemplate(template.id)} className={`overflow-hidden rounded-lg border text-left ${design.templateId === template.id ? "border-violet-400 ring-1 ring-violet-400" : "border-white/10"}`}>
                        <span className="relative block h-20 overflow-hidden" style={{ background: template.preview }}>
                          <span className="absolute inset-x-1 top-2 text-center text-[8px] font-black leading-tight text-white [text-shadow:0_1px_2px_#000]">
                            {template.sampleHook1}
                          </span>
                          <span className="absolute inset-x-1 top-6 text-center text-[9px] font-black leading-tight text-yellow-300 [text-shadow:0_1px_2px_#000]">
                            {template.sampleHook2}
                          </span>
                        </span>
                        <span className="block px-2 py-2 text-[9px] font-bold">{template.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {sideTab === "text" ? (
                  <>
                    <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-3">
                      <p className="text-[10px] font-black text-amber-200">레퍼런스 후킹 공식</p>
                      <p className="mt-1 text-[9px] leading-4 text-white/45">
                        익숙한 대상 + 예상 밖의 사건·결과를 2줄로 만들고, 정답은 숨겨 클릭할 이유를 만듭니다.
                      </p>
                      <Button
                        type="button"
                        onClick={() => void generateStoryHookingCopy()}
                        disabled={generatingCopy}
                        className="mt-2 w-full bg-amber-500 text-slate-950 hover:bg-amber-400"
                      >
                        {generatingCopy ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1.5 h-4 w-4" />
                        )}
                        후킹 문구 3줄 자동 생성
                      </Button>
                    </div>
                    <Button type="button" onClick={() => commitDesign(addTextLayer)} className="w-full bg-violet-600 text-white hover:bg-violet-500"><Plus className="mr-1.5 h-4 w-4" />텍스트 추가</Button>
                    <div className="space-y-2">
                      {design.texts.map((text) => (
                        <button key={text.id} type="button" onClick={() => setSelectedId(text.id)} className={`w-full rounded-lg border p-2 text-left text-[10px] ${selectedId === text.id ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-white/[0.03]"}`}>
                          <span className="block truncate font-bold">{text.text}</span>
                          <span className="text-white/35">{text.role || "custom"} · {text.fontSize}px</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {sideTab === "elements" ? (
                  <div className="grid grid-cols-3 gap-2">
                    {STUDIO_OVERLAY_CATALOG.filter((item) => item.category !== "effects").map((item) => (
                      <button key={item.id} type="button" onClick={() => commitDesign((current) => addThumbnailElement(current, item.id))} className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[9px] text-white/65 hover:border-violet-400">
                        <StudioOverlayGraphic catalogId={item.id} color="#f43f5e" size={28} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {sideTab === "background" ? (
                  <>
                    {backgroundCandidates.length ? (
                      <div>
                        <p className="mb-2 text-[10px] font-black text-white/70">
                          수집된 사진 선택
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {backgroundCandidates.map((candidate, index) => {
                            const thumbSrc = /^https?:\/\//i.test(candidate)
                              ? `/api/shotform/image-proxy?url=${encodeURIComponent(candidate)}`
                              : candidate
                            const isSelected =
                              design.backgroundUrl === candidate ||
                              selectedCandidateIndex === index
                            return (
                              <button
                                key={`${candidate}_${index}`}
                                type="button"
                                onClick={() => {
                                  void (async () => {
                                    setError("")
                                    setSelectedCandidateIndex(index)
                                    try {
                                      // 원격 CDN은 PNG보내기 시 CORS로 실패 → data URL로 고정
                                      const url = /^https?:\/\//i.test(candidate)
                                        ? await persistImageUrlAsDataUrl(candidate)
                                        : candidate
                                      commitDesign((current) =>
                                        setThumbnailBackground(current, url)
                                      )
                                    } catch (reason) {
                                      setSelectedCandidateIndex(null)
                                      setError(
                                        reason instanceof Error
                                          ? reason.message
                                          : "배경 이미지를 불러올 수 없습니다."
                                      )
                                    }
                                  })()
                                }}
                                className={`relative aspect-square overflow-hidden rounded-lg border ${
                                  isSelected
                                    ? "border-violet-400 ring-2 ring-violet-400/40"
                                    : "border-white/10 hover:border-white/35"
                                }`}
                                title={`사진 ${index + 1} 선택`}
                              >
                                <img
                                  src={thumbSrc}
                                  alt={`썸네일 배경 후보 ${index + 1}`}
                                  className="h-full w-full object-cover"
                                />
                                {isSelected ? (
                                  <span className="absolute inset-x-0 bottom-0 bg-violet-600/90 py-0.5 text-[8px] font-bold text-white">
                                    선택됨
                                  </span>
                                ) : null}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                    <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/20 p-4 text-xs text-white/60 hover:bg-white/5">
                      <Upload className="mr-2 h-4 w-4" />배경 업로드
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadBackground(event.target.files?.[0])} />
                    </label>
                    <RangeControl label="확대" value={backgroundTransform.scale} min={50} max={300} onChange={(value) => patchDesign((current) => updateThumbnailBackgroundTransform(current, { scale: value }))} />
                    <RangeControl label="가로 위치" value={backgroundTransform.x} min={0} max={100} onChange={(value) => patchDesign((current) => updateThumbnailBackgroundTransform(current, { x: value }))} />
                    <RangeControl label="세로 위치" value={backgroundTransform.y} min={0} max={100} onChange={(value) => patchDesign((current) => updateThumbnailBackgroundTransform(current, { y: value }))} />
                    <Button type="button" variant="outline" onClick={() => commitDesign((current) => ({ ...current, backgroundTransform: defaultBackgroundTransform() }))} className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"><RotateCcw className="mr-1.5 h-4 w-4" />위치 초기화</Button>
                  </>
                ) : null}

                {sideTab === "filter" ? (
                  <>
                    <div>
                      <p className="mb-2 text-[10px] font-black text-white/70">
                        사진 밝기 프리셋
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          ["기본", 66],
                          ["조금 밝게", 82],
                          ["원본", 100],
                        ].map(([label, brightness]) => (
                          <button
                            key={String(label)}
                            type="button"
                            onClick={() =>
                              commitDesign((current) => ({
                                ...current,
                                filter: {
                                  ...current.filter,
                                  brightness: Number(brightness),
                                },
                              }))
                            }
                            className={`rounded-lg border px-1 py-2 text-[9px] font-bold ${
                              design.filter.brightness === Number(brightness)
                                ? "border-violet-400 bg-violet-500/15 text-violet-200"
                                : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/30"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <RangeControl label="밝기" value={design.filter.brightness} min={40} max={160} onChange={(value) => patchDesign((current) => ({ ...current, filter: { ...current.filter, brightness: value } }))} />
                    <RangeControl label="대비" value={design.filter.contrast} min={40} max={180} onChange={(value) => patchDesign((current) => ({ ...current, filter: { ...current.filter, contrast: value } }))} />
                    <RangeControl label="채도" value={design.filter.saturate} min={0} max={200} onChange={(value) => patchDesign((current) => ({ ...current, filter: { ...current.filter, saturate: value } }))} />
                    <RangeControl label="블러" value={design.filter.blur} min={0} max={20} onChange={(value) => patchDesign((current) => ({ ...current, filter: { ...current.filter, blur: value } }))} />
                    <RangeControl label="상단 스크림" value={design.filter.gradientOpacity} min={0} max={100} onChange={(value) => patchDesign((current) => ({ ...current, filter: { ...current.filter, gradientTop: value > 0, gradientOpacity: value } }))} />
                  </>
                ) : null}

                {sideTab === "ai" ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/[0.08] p-3">
                      <p className="text-xs font-black text-fuchsia-200">스토리 전용 AI 제작</p>
                      <p className="mt-1 text-[9px] leading-4 text-white/45">현재 제품과 스토리 문맥을 분석해 배경 또는 전체 썸네일을 생성합니다.</p>
                    </div>
                    <Button type="button" onClick={() => void generateAiAsset("background")} disabled={aiGenerating !== null} className="w-full bg-cyan-600 text-white hover:bg-cyan-500">
                      {aiGenerating === "background" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-1.5 h-4 w-4" />}
                      AI 배경만 생성
                    </Button>
                    <Button type="button" onClick={() => void generateAiAsset("full")} disabled={aiGenerating !== null} className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white">
                      {aiGenerating === "full" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                      AI 전체 썸네일 생성
                    </Button>
                  </div>
                ) : null}
              </div>
            </aside>

            <main className="flex min-h-0 items-center justify-center overflow-auto bg-[#090b0f] p-6">
              <div ref={stageRef} onPointerDown={() => setSelectedId(null)} className="relative aspect-[9/16] h-[min(78vh,780px)] w-auto overflow-hidden bg-black shadow-[0_24px_80px_rgba(0,0,0,.65)]">
                {design.backgroundUrl ? (
                  <img
                    data-thumb-bg
                    src={
                      /^https?:\/\//i.test(design.backgroundUrl)
                        ? `/api/shotform/image-proxy?url=${encodeURIComponent(design.backgroundUrl)}`
                        : design.backgroundUrl
                    }
                    alt=""
                    className="absolute h-full w-full max-w-none object-cover"
                    style={{
                      ...thumbnailBackgroundImageStyle(backgroundTransform),
                      filter: filterCss(design),
                    }}
                  />
                ) : null}
                {design.filter.gradientTop ? <div data-thumb-filter className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{ background: `linear-gradient(to bottom, ${design.filter.gradientColor}${Math.round(design.filter.gradientOpacity * 2.55).toString(16).padStart(2, "0")}, transparent)` }} /> : null}
                <StoryThumbnailTemplateChrome
                  templateId={design.templateId}
                  backgroundUrl={design.backgroundUrl}
                  foregroundFilter={`brightness(${design.filter.brightness}%) contrast(${design.filter.contrast}%) saturate(${design.filter.saturate}%)`}
                />
                {design.texts.map((text) => (
                  <div
                    key={text.id}
                    data-thumb-text-layer
                    onPointerDown={(event) => startLayerDrag(event, "text", text.id, text.x, text.y)}
                    className={`absolute cursor-move whitespace-pre-line leading-[1.05] ${selectedId === text.id ? "ring-2 ring-violet-400" : ""}`}
                    style={{
                      left: `${text.x}%`,
                      top: `${text.y}%`,
                      width: `${text.widthPct}%`,
                      transform: thumbnailTextAnchorTransform(text.align, text.rotation),
                      textAlign: text.align,
                      fontSize: text.fontSize,
                      fontWeight: text.fontWeight,
                      color: text.color,
                      letterSpacing: text.letterSpacing,
                      WebkitTextStroke: text.strokeOn ? `${text.strokeWidth / 2}px ${text.strokeColor}` : undefined,
                      paintOrder: "stroke fill",
                      textShadow: text.shadow ? "0 3px 8px rgba(0,0,0,.75)" : undefined,
                      backgroundColor: text.bgOn ? `${text.bgColor}${Math.round(text.bgOpacity * 2.55).toString(16).padStart(2, "0")}` : undefined,
                      padding: text.bgOn ? "6px 10px" : undefined,
                      whiteSpace:
                        text.role === "hook1" || text.role === "hook2"
                          ? "nowrap"
                          : "pre-line",
                    }}
                  >
                    {text.text}
                  </div>
                ))}
                {design.elements.map((element) => {
                  const selected = selectedId === element.id
                  return (
                    <div
                      key={element.id}
                      onPointerDown={(event) =>
                        startLayerDrag(
                          event,
                          "element",
                          element.id,
                          element.x,
                          element.y
                        )
                      }
                      className={`absolute cursor-move ${
                        selected ? "ring-2 ring-cyan-400" : ""
                      }`}
                      style={{
                        left: `${element.x}%`,
                        top: `${element.y}%`,
                        transform: `translate(-50%,-50%) rotate(${element.rotation}deg)`,
                      }}
                    >
                      <StudioOverlayGraphic
                        catalogId={element.catalogId}
                        color={element.color}
                        size={element.size}
                        filled={element.filled}
                      />
                      {selected ? (
                        <div data-thumb-export-skip>
                          {[
                            "-left-2 -top-2 cursor-nwse-resize",
                            "-right-2 -top-2 cursor-nesw-resize",
                            "-bottom-2 -left-2 cursor-nesw-resize",
                            "-bottom-2 -right-2 cursor-nwse-resize",
                          ].map((position) => (
                            <button
                              key={position}
                              type="button"
                              title="드래그하여 크기 조절"
                              aria-label="요소 크기 조절"
                              onPointerDown={(event) =>
                                startElementResize(event, element)
                              }
                              className={`absolute z-30 h-4 w-4 rounded-sm border-2 border-cyan-500 bg-white shadow ${position}`}
                            />
                          ))}
                          <div className="absolute left-1/2 top-full z-30 mt-3 flex -translate-x-1/2 flex-col items-center">
                            <span className="h-3 w-px bg-cyan-400" />
                            <button
                              type="button"
                              title="드래그하여 회전"
                              aria-label="요소 회전"
                              onPointerDown={(event) =>
                                startElementRotate(event, element)
                              }
                              className="flex h-7 w-7 cursor-grab items-center justify-center rounded-full border-2 border-cyan-500 bg-white text-sm font-black text-cyan-600 shadow active:cursor-grabbing"
                            >
                              ↻
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </main>

            <aside className="min-h-0 overflow-y-auto border-l border-white/10 bg-[#151820] p-4">
              <p className="text-xs font-black">선택 레이어 속성</p>
              <p className="mt-1 text-[9px] text-white/35">캔버스의 텍스트와 요소를 드래그해 이동할 수 있습니다.</p>
              {selectedText ? (
                <TextInspector
                  text={selectedText}
                  onChange={(patch) => patchDesign((current) => updateThumbnailText(current, selectedText.id, patch))}
                  onCommit={(patch) => commitDesign((current) => updateThumbnailText(current, selectedText.id, patch))}
                  onRewrite={() => void rewriteSelectedText()}
                  rewriting={rewriting}
                  onDelete={() => {
                    commitDesign((current) => removeThumbnailLayer(current, selectedText.id))
                    setSelectedId(null)
                  }}
                />
              ) : selectedElement ? (
                <div className="mt-5 space-y-4">
                  <RangeControl label="크기" value={selectedElement.size} min={18} max={220} onChange={(value) => patchDesign((current) => updateThumbnailElement(current, selectedElement.id, { size: value }))} />
                  <RangeControl label="회전" value={selectedElement.rotation} min={-180} max={180} onChange={(value) => patchDesign((current) => updateThumbnailElement(current, selectedElement.id, { rotation: value }))} />
                  <ColorControl label="요소 색상" value={selectedElement.color} onChange={(color) => patchDesign((current) => updateThumbnailElement(current, selectedElement.id, { color }))} />
                  <Button type="button" variant="destructive" onClick={() => { commitDesign((current) => removeThumbnailLayer(current, selectedElement.id)); setSelectedId(null) }} className="w-full"><Trash2 className="mr-1.5 h-4 w-4" />요소 삭제</Button>
                </div>
              ) : (
                <div className="mt-8 rounded-xl border border-dashed border-white/10 p-5 text-center text-[10px] text-white/35">편집할 레이어를 선택하세요.</div>
              )}
              {error ? <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-[10px] text-red-300">{error}</p> : null}
            </aside>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StoryThumbnailTemplateChrome({
  templateId,
  backgroundUrl,
  foregroundFilter,
}: {
  templateId?: string
  backgroundUrl?: string
  foregroundFilter?: string
}) {
  if (!templateId || !isStoryThumbnailTemplateId(templateId)) return null
  const chrome = STORY_THUMBNAIL_CHROME[templateId]
  const inset = chrome.subtitleInsetPct || 0

  return (
    <div
      data-thumb-template-chrome
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      {chrome.backgroundMode === "blurred-poster" && backgroundUrl ? (
        <img
          data-thumb-template-foreground
          src={
            /^https?:\/\//i.test(backgroundUrl)
              ? `/api/shotform/image-proxy?url=${encodeURIComponent(backgroundUrl)}`
              : backgroundUrl
          }
          alt=""
          crossOrigin="anonymous"
          className="absolute inset-x-0 bottom-0 h-auto w-full max-w-none object-contain object-bottom"
          style={{
            top: `${chrome.foregroundTopPct || 31}%`,
            height: `${100 - (chrome.foregroundTopPct || 31)}%`,
            filter: foregroundFilter,
          }}
        />
      ) : null}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: `${chrome.headerHeightPct}%`,
          background: chrome.headerBackground,
        }}
      />
      {chrome.backgroundMode === "blurred-poster" ? (
        <div className="absolute inset-x-0 top-0 h-[10px] bg-[#0f2a50]" />
      ) : null}
      <div
        className="absolute h-[3px]"
        style={{
          left: `${Math.max(0, inset)}%`,
          right: `${Math.max(0, inset)}%`,
          top: `calc(${chrome.headerHeightPct}% - 3px)`,
          background: chrome.dividerColor,
        }}
      />
      <div
        className="absolute shadow-[0_2px_8px_rgba(0,0,0,.16)]"
        style={{
          left: `${inset}%`,
          right: `${inset}%`,
          top: `${chrome.subtitleTopPct}%`,
          height: `${chrome.subtitleHeightPct}%`,
          background: chrome.subtitleBackground,
          borderRadius: chrome.subtitleRadius,
        }}
      />
      {chrome.searchDecoration ? (
        <>
          <div className="absolute left-[4%] top-[3%] h-5 w-5 rounded-full border-2 border-emerald-100/70" />
          <div className="absolute right-[4%] top-[3.2%] h-4 w-4 rounded-full border-2 border-emerald-100/70 after:absolute after:-bottom-1 after:-right-1 after:h-1.5 after:w-0.5 after:-rotate-45 after:bg-emerald-100/70" />
        </>
      ) : null}
      {chrome.footerHeightPct ? (
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: `${chrome.footerHeightPct}%`,
            background: chrome.footerBackground,
          }}
        />
      ) : null}
    </div>
  )
}

function RangeControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-[10px] text-white/55"><span>{label}</span><span>{Math.round(value)}</span></div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(next) => onChange(next[0] ?? value)} />
    </div>
  )
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex items-center justify-between text-[10px] text-white/55"><span>{label}</span><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-12 rounded border-0 bg-transparent" /></label>
}

function TextInspector({
  text,
  onChange,
  onCommit,
  onRewrite,
  rewriting,
  onDelete,
}: {
  text: ThumbnailTextLayer
  onChange: (patch: Partial<ThumbnailTextLayer>) => void
  onCommit: (patch: Partial<ThumbnailTextLayer>) => void
  onRewrite: () => void
  rewriting: boolean
  onDelete: () => void
}) {
  return (
    <div className="mt-5 space-y-4">
      <div>
        <Label className="text-[10px] text-white/55">문구</Label>
        <Input value={text.text} onChange={(event) => onChange({ text: event.target.value })} className="mt-2 border-white/10 bg-black/25 text-white" />
      </div>
      <Button type="button" onClick={onRewrite} disabled={rewriting} className="w-full bg-fuchsia-600 text-white hover:bg-fuchsia-500">{rewriting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}AI 문구 재작성</Button>
      <RangeControl label="글자 크기" value={text.fontSize} min={16} max={100} onChange={(value) => onChange({ fontSize: value })} />
      <RangeControl label="너비" value={text.widthPct} min={20} max={100} onChange={(value) => onChange({ widthPct: value })} />
      <RangeControl label="회전" value={text.rotation} min={-30} max={30} onChange={(value) => onChange({ rotation: value })} />
      <RangeControl label="외곽선" value={text.strokeWidth} min={0} max={18} onChange={(value) => onChange({ strokeWidth: value, strokeOn: value > 0 })} />
      <ColorControl label="글자색" value={text.color} onChange={(color) => onChange({ color })} />
      <ColorControl label="외곽선색" value={text.strokeColor} onChange={(strokeColor) => onChange({ strokeColor })} />
      <div className="grid grid-cols-3 gap-2">
        {(["left", "center", "right"] as const).map((align) => {
          const Icon = align === "left" ? AlignLeft : align === "right" ? AlignRight : AlignCenter
          return <button key={align} type="button" onClick={() => onCommit({ align })} className={`flex h-8 items-center justify-center rounded border ${text.align === align ? "border-violet-400 bg-violet-500/15" : "border-white/10"}`}><Icon className="h-4 w-4" /></button>
        })}
      </div>
      <Button type="button" variant="destructive" onClick={onDelete} className="w-full"><Trash2 className="mr-1.5 h-4 w-4" />텍스트 삭제</Button>
    </div>
  )
}

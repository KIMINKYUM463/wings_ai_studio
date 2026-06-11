"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Download, ImageIcon, Loader2, Palette, RefreshCw, Sparkles, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  captureVideoFramesFromEdit,
  compressReferenceImageDataUrl,
  type CapturedVideoFrame,
} from "@/lib/mvp-thumbnail-capture"
import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import type {
  MvpScriptStyleState,
  MvpThumbnailHookingText,
  MvpThumbnailVariant,
} from "@/lib/mvp-studio-types"
import { labelThumbnailSource, selectedThumbnailVariant } from "@/lib/mvp-thumbnail-gallery"
import type { MvpThumbnailDesign } from "@/lib/mvp-thumbnail-design"
import { THUMBNAIL_SAMPLE_BACKGROUNDS } from "@/lib/mvp-thumbnail-samples"
import { studio } from "../components/ShotFormStudioUI"
import { MvpThumbnailAdvancedEditor } from "./MvpThumbnailAdvancedEditor"
import { MvpThumbnailFramePicker } from "./MvpThumbnailFramePicker"

type Props = {
  productName: string
  videoUrl: string | null
  /** 짜집기 컷 — 컷별 프레임 후보 캡처에 사용 */
  segments?: readonly NarrationSegment[]
  scriptStyle?: MvpScriptStyleState
  thumbnailUrl: string
  thumbnailGallery: MvpThumbnailVariant[]
  selectedThumbnailId: string | null
  thumbnailIntroOn: boolean
  hookingText: MvpThumbnailHookingText
  onAddThumbnail: (entry: {
    url: string
    source: MvpThumbnailVariant["source"]
    hookingText?: MvpThumbnailHookingText
    studioDesign?: MvpThumbnailDesign
  }) => void
  onSelectThumbnail: (id: string) => void
  onRemoveThumbnail: (id: string) => void
  onThumbnailIntroOnChange: (on: boolean) => void
  onHookingTextChange: (text: MvpThumbnailHookingText) => void
  /** 인스펙터(영상 편집) vs 7단계 전체 화면 */
  layout?: "compact" | "page"
  className?: string
}

function shotformOpenAIKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_openai_api_key") || "").trim()
}

function shotformReplicateKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_replicate_api_key") || "").trim()
}

export function MvpThumbnailPanel({
  productName,
  videoUrl,
  segments,
  scriptStyle,
  thumbnailUrl,
  thumbnailGallery,
  selectedThumbnailId,
  thumbnailIntroOn,
  hookingText,
  onAddThumbnail,
  onSelectThumbnail,
  onRemoveThumbnail,
  onThumbnailIntroOnChange,
  onHookingTextChange,
  layout = "compact",
  className,
}: Props) {
  const compact = layout === "compact"

  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string>("")
  const [referenceBase64, setReferenceBase64] = useState<string>("")
  const [videoFrames, setVideoFrames] = useState<CapturedVideoFrame[]>([])
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const [framesLoading, setFramesLoading] = useState(false)
  const [framesProgress, setFramesProgress] = useState<{ done: number; total: number } | null>(null)
  const capturedKeyRef = useRef<string | null>(null)

  const captureKey = useMemo(() => {
    if (!videoUrl) return ""
    const segKey =
      segments?.map((s) => `${s.start.toFixed(2)}-${s.end.toFixed(2)}`).join("|") ?? ""
    return `${videoUrl}::${segKey}`
  }, [videoUrl, segments])
  const [generating, setGenerating] = useState(false)
  const [imageOnlyGenerating, setImageOnlyGenerating] = useState(false)
  const [hookingLoading, setHookingLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const hasHooking = Boolean(hookingText.line1.trim() && hookingText.line2.trim())

  const activeThumbnail = useMemo(
    () => selectedThumbnailVariant(thumbnailGallery, selectedThumbnailId),
    [thumbnailGallery, selectedThumbnailId]
  )

  /** 스튜디오 편집 캔버스 — 텍스트가 합성된 썸네일 PNG가 아닌 원본 프레임 사용 */
  const editorBackgroundUrl = useMemo(() => {
    if (referencePreviewUrl) return referencePreviewUrl
    const savedBg = activeThumbnail?.studioDesign?.backgroundUrl?.trim()
    if (savedBg && savedBg !== activeThumbnail?.url.trim()) return savedBg
    if (activeThumbnail?.source !== "studio" && thumbnailUrl) return thumbnailUrl
    return THUMBNAIL_SAMPLE_BACKGROUNDS[0]?.url || ""
  }, [referencePreviewUrl, activeThumbnail, thumbnailUrl])

  const studioInitialDesign = useMemo((): MvpThumbnailDesign | null => {
    if (activeThumbnail?.source !== "studio" || !activeThumbnail.studioDesign) return null
    const bakedUrl = activeThumbnail.url.trim()
    const rawBg = editorBackgroundUrl.trim()
    const savedBg = activeThumbnail.studioDesign.backgroundUrl.trim()
    const backgroundUrl =
      rawBg && (!savedBg || savedBg === bakedUrl) ? rawBg : savedBg || rawBg
    return { ...activeThumbnail.studioDesign, backgroundUrl }
  }, [activeThumbnail, editorBackgroundUrl])

  const selectVideoFrame = useCallback((frame: CapturedVideoFrame) => {
    setSelectedFrameId(frame.id)
    setReferencePreviewUrl(frame.dataUrl)
    setReferenceBase64(frame.dataUrl)
    setErr(null)
  }, [])

  const loadVideoFrames = useCallback(async () => {
    if (!videoUrl) {
      setErr("짜집기 MP4가 없습니다. 영상을 먼저 불러오세요.")
      return
    }
    setFramesLoading(true)
    setFramesProgress(null)
    setErr(null)
    try {
      const frames = await captureVideoFramesFromEdit(videoUrl, segments, {
        onProgress: (done, total) => setFramesProgress({ done, total }),
      })
      setVideoFrames(frames)
      capturedKeyRef.current = captureKey
      if (frames.length) {
        const keep = selectedFrameId ? frames.find((f) => f.id === selectedFrameId) : null
        selectVideoFrame(keep ?? frames[0]!)
      } else {
        setReferencePreviewUrl("")
        setReferenceBase64("")
        setSelectedFrameId(null)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "영상 프레임 캡처 실패")
    } finally {
      setFramesLoading(false)
      setFramesProgress(null)
    }
  }, [videoUrl, segments, selectedFrameId, selectVideoFrame, captureKey])

  useEffect(() => {
    if (!videoUrl) {
      setVideoFrames([])
      setSelectedFrameId(null)
      setReferencePreviewUrl("")
      setReferenceBase64("")
      capturedKeyRef.current = null
      return
    }
    if (capturedKeyRef.current === captureKey && videoFrames.length) return
    void loadVideoFrames()
  }, [videoUrl, captureKey, loadVideoFrames, videoFrames.length])

  const generateHookingText = useCallback(async () => {
    setHookingLoading(true)
    setErr(null)
    try {
      const res = await fetch("/api/shotform/mvp-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: shotformOpenAIKey() || undefined,
          productName,
          generateHookingOnly: true,
        }),
      })
      const data = (await res.json()) as { hookingText?: MvpThumbnailHookingText; error?: string }
      if (!res.ok) throw new Error(data.error || "후킹 문구 생성 실패")
      if (data.hookingText) onHookingTextChange(data.hookingText)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "후킹 문구 생성 실패")
    } finally {
      setHookingLoading(false)
    }
  }, [productName, onHookingTextChange])

  const handleGenerateThumbnail = useCallback(async () => {
    const replicateKey = shotformReplicateKey()
    if (!replicateKey) {
      setErr("Replicate API 키(shotform_replicate_api_key)를 ShotForm 설정에 저장해 주세요.")
      return
    }
    if (!referenceBase64) {
      setErr("참조 이미지가 없습니다. 영상 프레임을 불러오거나 이미지를 업로드하세요.")
      return
    }

    setGenerating(true)
    setErr(null)
    try {
      let text = hookingText
      if (!text.line1.trim() || !text.line2.trim()) {
        const hookRes = await fetch("/api/shotform/mvp-thumbnail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            openaiApiKey: shotformOpenAIKey() || undefined,
            productName,
            generateHookingOnly: true,
          }),
        })
        const hookData = (await hookRes.json()) as { hookingText?: MvpThumbnailHookingText; error?: string }
        if (!hookRes.ok) throw new Error(hookData.error || "후킹 문구 생성 실패")
        if (hookData.hookingText) {
          text = hookData.hookingText
          onHookingTextChange(text)
        }
      }

      const res = await fetch("/api/shotform/mvp-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: shotformOpenAIKey() || undefined,
          replicateApiKey: replicateKey,
          productName,
          productImageBase64: referenceBase64,
          hookingText: text,
        }),
      })
      const data = (await res.json()) as {
        thumbnailUrl?: string
        hookingText?: MvpThumbnailHookingText
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "썸네일 생성 실패")
      if (data.hookingText) onHookingTextChange(data.hookingText)
      if (data.thumbnailUrl) {
        onAddThumbnail({
          url: data.thumbnailUrl,
          source: "ai",
          hookingText: data.hookingText ?? text,
        })
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "썸네일 생성 실패")
    } finally {
      setGenerating(false)
    }
  }, [referenceBase64, hookingText, productName, onHookingTextChange, onAddThumbnail])

  const handleGenerateImageOnly = useCallback(async () => {
    const replicateKey = shotformReplicateKey()
    if (!replicateKey) {
      setErr("Replicate API 키(shotform_replicate_api_key)를 ShotForm 설정에 저장해 주세요.")
      return
    }
    if (!referenceBase64) {
      setErr("참조 이미지가 없습니다. 영상 프레임을 불러오거나 이미지를 업로드하세요.")
      return
    }

    setImageOnlyGenerating(true)
    setErr(null)
    try {
      const res = await fetch("/api/shotform/mvp-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replicateApiKey: replicateKey,
          productName,
          productImageBase64: referenceBase64,
          generateBackgroundOnly: true,
        }),
      })
      const data = (await res.json()) as { backgroundUrl?: string; error?: string }
      if (!res.ok) throw new Error(data.error || "AI 이미지 생성 실패")
      if (!data.backgroundUrl?.trim()) throw new Error("AI 이미지 URL을 받지 못했습니다.")

      const url = data.backgroundUrl.trim()
      setReferencePreviewUrl(url)
      setReferenceBase64(url)
      onAddThumbnail({ url, source: "ai" })
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI 이미지 생성 실패")
    } finally {
      setImageOnlyGenerating(false)
    }
  }, [referenceBase64, productName, onAddThumbnail])

  const handleUploadReference = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file?.type.startsWith("image/")) {
      setErr("이미지 파일만 업로드할 수 있습니다.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      void (async () => {
        try {
          const url = reader.result as string
          const compressed = await compressReferenceImageDataUrl(url)
          setReferencePreviewUrl(compressed)
          setReferenceBase64(compressed)
          setErr(null)
        } catch (e) {
          setErr(e instanceof Error ? e.message : "이미지 처리 실패")
        }
      })()
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }, [])

  const downloadThumbnail = useCallback(async () => {
    if (!thumbnailUrl) return
    try {
      const res = await fetch(thumbnailUrl)
      const blob = await res.blob()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `mvp_thumbnail_${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(thumbnailUrl, "_blank")
    }
  }, [thumbnailUrl])

  const previewHint = useMemo(() => {
    if (thumbnailUrl && thumbnailIntroOn) return "선택한 썸네일 · 0초(맨 앞) 미리보기 ON"
    if (thumbnailUrl) return "선택한 썸네일 · 맨 앞 표시 OFF"
    if (referencePreviewUrl) return "생성 후 「맨 앞 썸네일」을 켜면 0초에 표시됩니다"
    return "참조 이미지 로딩 중…"
  }, [thumbnailUrl, thumbnailIntroOn, referencePreviewUrl])

  const galleryPicker = thumbnailGallery.length > 0 ? (
    <div className="space-y-1.5">
      <Label className={cn(compact ? "text-[10px] text-slate-400" : "text-xs text-slate-300")}>
        만든 썸네일 선택 ({thumbnailGallery.length})
      </Label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {thumbnailGallery.map((variant) => {
          const selected = variant.id === selectedThumbnailId
          return (
            <button
              key={variant.id}
              type="button"
              title={`${labelThumbnailSource(variant.source)} 썸네일`}
              onClick={() => onSelectThumbnail(variant.id)}
              className={cn(
                "relative shrink-0 overflow-hidden rounded-lg border-2 transition",
                compact ? "h-[72px] w-[40px]" : "h-[88px] w-[50px]",
                selected
                  ? "border-amber-400 ring-2 ring-amber-400/40"
                  : "border-white/15 opacity-80 hover:border-white/30 hover:opacity-100"
              )}
            >
              <img src={variant.url} alt="" className="h-full w-full object-cover" />
              <span
                className={cn(
                  "absolute bottom-0 left-0 right-0 bg-black/75 px-0.5 py-0.5 text-center font-medium text-white",
                  compact ? "text-[7px]" : "text-[8px]"
                )}
              >
                {labelThumbnailSource(variant.source)}
              </span>
              {selected ? (
                <span className="absolute right-0.5 top-0.5 rounded-full bg-amber-500 p-0.5 text-black">
                  <Check className="h-2.5 w-2.5" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <p className={cn("leading-relaxed text-slate-500", compact ? "text-[9px]" : "text-[10px]")}>
        AI 생성·스튜디오 결과가 목록에 쌓입니다. 새로 만들어도 이전 항목은 유지됩니다.
      </p>
    </div>
  ) : null

  const previewBox = (
    <div className={cn("space-y-2", compact ? "" : "space-y-3")}>
      <p className={cn("font-medium text-white", compact ? "text-[10px] text-slate-400" : "text-xs")}>{previewHint}</p>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-white/15 bg-black shadow-lg",
          compact ? "mx-auto aspect-[9/16] w-full max-w-[160px]" : "mx-auto aspect-[9/16] w-full max-w-[300px] shadow-2xl"
        )}
      >
        {referencePreviewUrl ? (
          <img
            src={referencePreviewUrl}
            alt="참조 프레임"
            className="absolute inset-0 h-full w-full object-cover opacity-90"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-slate-500">
            {framesLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                프레임…
              </span>
            ) : (
              "참조 없음"
            )}
          </div>
        )}

        {!thumbnailUrl && referencePreviewUrl && hasHooking ? (
          <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-start px-2 pt-[10%]">
            <p className="w-full text-center text-[clamp(8px,3vw,14px)] font-extrabold leading-tight text-white">
              {hookingText.line1}
            </p>
            <p className="mt-1 w-full text-center text-[clamp(8px,3vw,14px)] font-extrabold leading-tight text-teal-300">
              {hookingText.line2}
            </p>
          </div>
        ) : null}

        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="생성된 썸네일" className="absolute inset-0 z-[2] h-full w-full object-cover" />
        ) : null}
      </div>

      <div
        className={cn(
          "rounded-xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/5 p-3",
          compact ? "space-y-2" : "space-y-2.5"
        )}
      >
        <div>
          <p className={cn("font-semibold text-cyan-100", compact ? "text-[11px]" : "text-xs")}>썸네일 스튜디오</p>
          <p className={cn("mt-0.5 leading-relaxed text-slate-400", compact ? "text-[9px]" : "text-[10px]")}>
            별도 팝업에서 썸네일만 집중해서 편집합니다. 템플릿·텍스트·요소·필터를 미리캔버스처럼 다듬은 뒤 적용하세요.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className={cn(
            "w-full bg-cyan-600 text-white hover:bg-cyan-500",
            compact ? "h-8 text-[10px]" : "h-9 text-xs"
          )}
          onClick={() => setAdvancedOpen(true)}
        >
          <Palette className="mr-1.5 h-3.5 w-3.5" />
          썸네일 스튜디오 열기
        </Button>
      </div>

      <div className={cn("flex flex-wrap gap-2", compact ? "justify-center" : "justify-center")}>
        {thumbnailUrl ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(studio.btnOutline, "h-7 gap-1 text-[10px]")}
              onClick={() => void downloadThumbnail()}
            >
              <Download className="h-3 w-3" />
              PNG
            </Button>
            {selectedThumbnailId ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(studio.btnGhost, "h-7 gap-1 text-[10px] text-red-300 hover:text-red-200")}
                onClick={() => onRemoveThumbnail(selectedThumbnailId)}
              >
                <Trash2 className="h-3 w-3" />
                목록에서 삭제
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )

  const introToggle = (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border p-3",
        thumbnailIntroOn ? "border-amber-500/35 bg-amber-500/10" : "border-white/10 bg-black/40"
      )}
    >
      <div className="min-w-0">
        <Label className={cn(compact ? "text-[10px]" : "text-xs", "text-slate-200")}>
          영상 맨 앞 썸네일 (0초)
        </Label>
        <p className={cn("mt-0.5 leading-relaxed text-slate-500", compact ? "text-[9px]" : "text-[10px]")}>
          ON이면 미리보기·타임라인 0초에 썸네일이 나옵니다.
        </p>
      </div>
      <Switch
        checked={thumbnailIntroOn}
        disabled={!thumbnailUrl}
        onCheckedChange={onThumbnailIntroOnChange}
        aria-label="영상 맨 앞 썸네일"
      />
    </div>
  )

  const controls = (
    <div className="space-y-3">
      {galleryPicker}
      {introToggle}
      <div className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className={cn(compact ? "text-[10px] text-slate-400" : "text-xs text-slate-300")}>
            후킹 문구 (2줄)
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              studio.btnOutline,
              "h-7 gap-1 text-[10px] border-amber-500/35 text-amber-100 hover:bg-amber-500/10 hover:text-amber-50"
            )}
            disabled={hookingLoading}
            onClick={() => void generateHookingText()}
          >
            {hookingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            AI
          </Button>
        </div>
        <Input
          className="h-8 border-white/10 bg-black/50 text-xs"
          placeholder="첫 줄 (흰색)"
          value={hookingText.line1}
          onChange={(e) => onHookingTextChange({ ...hookingText, line1: e.target.value })}
        />
        <Input
          className="h-8 border-white/10 bg-black/50 text-xs"
          placeholder="둘째 줄 (민트)"
          value={hookingText.line2}
          onChange={(e) => onHookingTextChange({ ...hookingText, line2: e.target.value })}
        />
        {!compact ? (
          <p className="text-[10px] text-slate-500">
            headcopies·6단계 대본이 있으면 자동 채워집니다. 쇼핑숏폼과 동일 프롬프트로 합성됩니다.
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className={cn(compact ? "text-[10px] text-slate-400" : "text-xs text-slate-300")}>
            짜집기 영상 프레임
          </Label>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(studio.btnOutline, "h-7 gap-1 text-[10px]")}
              disabled={framesLoading || !videoUrl}
              onClick={() => void loadVideoFrames()}
            >
              {framesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              다시 캡처
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/5">
              <Upload className="h-3 w-3" />
              업로드
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadReference} />
            </label>
          </div>
        </div>
        <MvpThumbnailFramePicker
          frames={videoFrames}
          selectedId={selectedFrameId}
          loading={framesLoading}
          progress={framesProgress}
          compact={compact}
          onSelect={selectVideoFrame}
        />
      </div>

      <Button
        type="button"
        className={cn("w-full bg-amber-600 hover:bg-amber-500", compact ? "h-9 text-xs" : "")}
        disabled={generating || imageOnlyGenerating || !referenceBase64}
        onClick={() => void handleGenerateThumbnail()}
      >
        {generating ? (
          <>
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            생성 중… (1~2분)
          </>
        ) : (
          <>
            <ImageIcon className="mr-2 h-3.5 w-3.5" />
            AI 썸네일 전체 생성
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        className={cn(
          studio.btnOutline,
          "w-full border-cyan-500/35 text-cyan-100 hover:bg-cyan-500/10",
          compact ? "h-9 text-xs" : ""
        )}
        disabled={generating || imageOnlyGenerating || !referenceBase64}
        onClick={() => void handleGenerateImageOnly()}
      >
        {imageOnlyGenerating ? (
          <>
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            이미지 생성 중… (1~2분)
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            AI 이미지만 생성
          </>
        )}
      </Button>
      <p className={cn("leading-relaxed text-slate-500", compact ? "text-[9px]" : "text-[10px]")}>
        참조 = 위에서 고른 짜집기 영상 프레임 또는 업로드 사진 ·{" "}
        <span className="text-cyan-200/90">이미지만</span>은 이 참조로 제품 형태를 유지한 사용 장면만 생성 ·{" "}
        <span className="text-amber-200/90">전체 생성</span>은 후킹·화살표까지 한 번에 합성
      </p>
    </div>
  )

  return (
    <div className={cn("space-y-3", className)}>
      {!compact ? (
        <p className="text-xs text-slate-400">
          쇼핑숏폼과 동일한 프롬프트 · <span className="text-amber-200/90">{productName}</span>
        </p>
      ) : (
        <p className="text-[10px] leading-relaxed text-slate-500">
          유튜브 쇼츠 썸네일 · 후킹 2줄 + 제품 장면 · <span className="text-amber-200/80">{productName}</span>
        </p>
      )}

      {err ? <p className="text-xs text-red-300">{err}</p> : null}

      {compact ? (
        <>
          {previewBox}
          {controls}
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {previewBox}
          {controls}
        </div>
      )}

      <MvpThumbnailAdvancedEditor
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        backgroundUrl={editorBackgroundUrl}
        referenceImageUrl={referencePreviewUrl || undefined}
        videoFrames={videoFrames}
        selectedVideoFrameId={selectedFrameId}
        onSelectVideoFrame={selectVideoFrame}
        hookingText={hookingText}
        productName={productName}
        initialDesign={studioInitialDesign}
        onApply={(dataUrl, hooking, design) => {
          const studioDesign: MvpThumbnailDesign = {
            ...design,
            backgroundUrl: editorBackgroundUrl || design.backgroundUrl,
          }
          onAddThumbnail({
            url: dataUrl,
            source: "studio",
            hookingText: hooking,
            studioDesign,
          })
          onHookingTextChange(hooking)
        }}
      />
    </div>
  )
}

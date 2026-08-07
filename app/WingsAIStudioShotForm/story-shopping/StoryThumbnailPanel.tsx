"use client"

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { ImageIcon, Loader2, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { StoryThumbnailAdvancedEditor } from "./StoryThumbnailAdvancedEditor"
import {
  appendThumbnailVariant,
  selectedThumbnailVariant,
} from "@/lib/mvp-thumbnail-gallery"
import {
  cacheMvpThumbnailGalleryForSave,
  hydrateMvpThumbnailGallery,
  mvpThumbnailIdbRef,
  parseMvpThumbnailIdbRef,
  slimThumbnailGalleryForPersist,
} from "@/lib/mvp-thumbnail-persist"
import {
  loadMvpThumbnail,
  saveMvpThumbnail,
} from "@/lib/mvp-local-media-cache"
import type { MvpThumbnailDesign } from "@/lib/mvp-thumbnail-design"
import type { MvpThumbnailHookingText, MvpThumbnailVariant } from "@/lib/mvp-studio-types"
import type { StorySceneAsset, StoryShoppingBrief } from "./story-types"
import {
  createStoryThumbnailDesign,
} from "./story-thumbnail-templates"

type Props = {
  brief: StoryShoppingBrief
  onChange: Dispatch<SetStateAction<StoryShoppingBrief>>
  projectId: string
  selectedAsset?: StorySceneAsset
  onIntroPreviewChange?: (url: string | null, enabled: boolean) => void
}

function initialHooking(brief: StoryShoppingBrief): MvpThumbnailHookingText {
  const title = brief.generatedStory?.title?.trim() || brief.productName.trim()
  const hook = brief.generatedStory?.hook?.trim() || "끝까지 보면 이유를 알게 됩니다"
  return {
    line1: title || "아무도 몰랐던 이야기",
    line2: hook,
  }
}

async function cacheDesignBackground(
  projectId: string,
  variantId: string,
  design: MvpThumbnailDesign
): Promise<MvpThumbnailDesign> {
  const backgroundUrl = design.backgroundUrl.trim()
  if (
    !backgroundUrl ||
    backgroundUrl.startsWith("http://") ||
    backgroundUrl.startsWith("https://") ||
    backgroundUrl.startsWith("mvp-idb://")
  ) {
    return design
  }
  try {
    const response = await fetch(backgroundUrl)
    const blob = await response.blob()
    if (blob.size < 512) return design
    const cacheId = `${variantId}_background`
    await saveMvpThumbnail(projectId, cacheId, blob)
    return { ...design, backgroundUrl: mvpThumbnailIdbRef(cacheId) }
  } catch {
    return design
  }
}

async function hydrateDesignBackgrounds(
  projectId: string,
  gallery: MvpThumbnailVariant[]
): Promise<MvpThumbnailVariant[]> {
  return Promise.all(
    gallery.map(async (variant) => {
      const design = variant.studioDesign
      const cacheId = design
        ? parseMvpThumbnailIdbRef(design.backgroundUrl)
        : null
      if (!design || !cacheId) return variant
      const blob = await loadMvpThumbnail(projectId, cacheId)
      return blob
        ? {
            ...variant,
            studioDesign: {
              ...design,
              backgroundUrl: URL.createObjectURL(blob),
            },
          }
        : variant
    })
  )
}

export function StoryThumbnailPanel({
  brief,
  onChange,
  projectId,
  selectedAsset,
  onIntroPreviewChange,
}: Props) {
  const defaultHooking = useMemo(() => initialHooking(brief), [brief.generatedStory?.hook, brief.generatedStory?.title, brief.productName])
  const [gallery, setGallery] = useState<MvpThumbnailVariant[]>(
    brief.thumbnailState?.gallery || []
  )
  const [selectedId, setSelectedId] = useState<string | null>(
    brief.thumbnailState?.selectedId || null
  )
  const templateId = "story-dark-yellow" as const
  const [hookingText, setHookingText] = useState(defaultHooking)
  const [subheadline, setSubheadline] = useState(
    brief.productName ? `${brief.productName}에 숨겨진 진짜 이유` : "알고 나면 놀라는 핵심 이유"
  )
  const [backgroundUrl, setBackgroundUrl] = useState("")
  const [studioOpen, setStudioOpen] = useState(false)
  const [isHydrating, setIsHydrating] = useState(false)
  const hydratedProjectRef = useRef("")

  const backgroundCandidates = useMemo(
    () =>
      Array.from(
        new Set(
          [
            selectedAsset?.mediaType === "image" ? selectedAsset.mediaUrl : "",
            ...(brief.collectorData?.reviewImages || []),
            ...(brief.collectorData?.detailImages || []),
            ...(brief.collectorData?.productImages || []),
            brief.productImage,
            brief.winningContent?.thumbnailUrl || "",
          ].filter(Boolean)
        )
      ).slice(0, 12),
    [
      brief.collectorData?.detailImages,
      brief.collectorData?.productImages,
      brief.collectorData?.reviewImages,
      brief.productImage,
      brief.winningContent?.thumbnailUrl,
      selectedAsset?.mediaType,
      selectedAsset?.mediaUrl,
    ]
  )
  const productReferenceImageUrl =
    brief.productImage?.trim() ||
    brief.selectedShoppingTag?.imageUrl?.trim() ||
    brief.collectorData?.productImages?.find((url) => Boolean(url?.trim()))?.trim() ||
    ""

  useEffect(() => {
    if (!backgroundUrl && backgroundCandidates[0]) {
      setBackgroundUrl(backgroundCandidates[0])
    }
  }, [backgroundCandidates, backgroundUrl])

  useEffect(() => {
    if (!projectId || hydratedProjectRef.current === projectId) return
    hydratedProjectRef.current = projectId
    const persisted = brief.thumbnailState?.gallery || []
    setSelectedId(brief.thumbnailState?.selectedId || null)
    if (!persisted.length) {
      setGallery([])
      return
    }
    setIsHydrating(true)
    void hydrateMvpThumbnailGallery(projectId, persisted)
      .then((hydrated) => hydrateDesignBackgrounds(projectId, hydrated))
      .then(setGallery)
      .catch((reason) => {
        console.warn("[StoryThumbnail] hydrate failed:", reason)
        setGallery(persisted)
      })
      .finally(() => setIsHydrating(false))
  }, [brief.thumbnailState?.gallery, brief.thumbnailState?.selectedId, projectId])

  const selectedVariant = selectedThumbnailVariant(gallery, selectedId)
  const introOn = brief.thumbnailState?.introOn ?? true
  const selectedThumbnailUrl = selectedVariant?.url || null

  useEffect(() => {
    onIntroPreviewChange?.(
      selectedThumbnailUrl,
      introOn && Boolean(selectedThumbnailUrl)
    )
  }, [introOn, onIntroPreviewChange, selectedThumbnailUrl])

  const draftDesign = useMemo(
    () =>
      createStoryThumbnailDesign({
        templateId,
        backgroundUrl,
        hookingText,
        subheadline,
      }),
    [backgroundUrl, hookingText, subheadline, templateId]
  )
  const activeDesign: MvpThumbnailDesign =
    selectedVariant?.studioDesign || draftDesign

  const updatePersistedState = (
    nextGallery: MvpThumbnailVariant[],
    nextSelectedId: string | null
  ) => {
    const slimGallery = slimThumbnailGalleryForPersist(nextGallery) || []
    onChange((current) => ({
      ...current,
      thumbnailState: {
        gallery: slimGallery,
        selectedId: nextSelectedId,
        introOn: current.thumbnailState?.introOn ?? true,
      },
    }))
  }

  const applyStudioResult = async (
    dataUrl: string,
    nextHooking: MvpThumbnailHookingText,
    design: MvpThumbnailDesign
  ) => {
    const appended = appendThumbnailVariant(gallery, {
      url: dataUrl,
      source: "studio",
      hookingText: nextHooking,
      studioDesign: design,
    })
    setGallery(appended.gallery)
    setSelectedId(appended.selectedId)
    setHookingText(nextHooking)
    await cacheMvpThumbnailGalleryForSave(projectId, appended.gallery)
    const persistedDesign = await cacheDesignBackground(
      projectId,
      appended.selectedId,
      design
    )
    const persistedGallery = appended.gallery.map((variant) =>
      variant.id === appended.selectedId
        ? { ...variant, studioDesign: persistedDesign }
        : variant
    )
    setGallery(persistedGallery)
    updatePersistedState(persistedGallery, appended.selectedId)
    setStudioOpen(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-black text-slate-900">썸네일 스튜디오</p>
        <p className="mt-1 text-[10px] leading-4 text-slate-500">
          9:16 템플릿을 고른 뒤 상세 스튜디오에서 모든 레이어를 편집합니다.
        </p>
      </div>

      <div className="mx-auto aspect-[9/16] w-full max-w-[190px] overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-lg">
        {selectedVariant?.url ? (
          <img src={selectedVariant.url} alt="선택 썸네일" className="h-full w-full object-cover" />
        ) : backgroundUrl ? (
          <div className="relative h-full w-full">
            <img src={backgroundUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-black/95 to-black/65" />
            <div className="absolute inset-x-2 top-[7%] text-center font-black leading-tight text-white" style={{ fontSize: 17 }}>
              <p>{hookingText.line1}</p>
              <p className="mt-1 text-yellow-300">{hookingText.line2}</p>
            </div>
            <div className="absolute inset-x-2 top-[30%] bg-white/95 px-2 py-1 text-center text-[8px] font-bold text-slate-900">
              {subheadline}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-slate-500">
            <ImageIcon className="h-8 w-8" />
            <span className="mt-2 text-[10px]">배경 이미지를 선택하세요</span>
          </div>
        )}
      </div>

      <div
        className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
          introOn && selectedThumbnailUrl
            ? "border-amber-300 bg-amber-50"
            : "border-slate-200 bg-slate-50"
        }`}
      >
        <div>
          <p className="text-[11px] font-black text-slate-800">
            영상 맨 앞 썸네일
          </p>
          <p className="mt-0.5 text-[9px] leading-4 text-slate-500">
            ON이면 0~0.01초에만 표시됩니다.
          </p>
        </div>
        <Switch
          checked={introOn && Boolean(selectedThumbnailUrl)}
          disabled={!selectedThumbnailUrl}
          onCheckedChange={(enabled) =>
            onChange((current) => ({
              ...current,
              thumbnailState: {
                gallery: current.thumbnailState?.gallery || [],
                selectedId: current.thumbnailState?.selectedId || null,
                introOn: enabled,
              },
            }))
          }
          aria-label="영상 맨 앞 썸네일 표시"
        />
      </div>

      <Button type="button" onClick={() => setStudioOpen(true)} className="w-full bg-violet-600 text-white hover:bg-violet-500">
        <Palette className="mr-2 h-4 w-4" />
        상세 썸네일 스튜디오 열기
      </Button>

      {isHydrating ? (
        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          저장된 썸네일 불러오는 중…
        </div>
      ) : null}

      <StoryThumbnailAdvancedEditor
        open={studioOpen}
        onOpenChange={setStudioOpen}
        backgroundUrl={backgroundUrl}
        backgroundCandidates={backgroundCandidates}
        productReferenceImageUrl={productReferenceImageUrl}
        hookingText={hookingText}
        productName={brief.productName}
        hookingInput={{
          productName: brief.productName,
          productFeatures: brief.generatedStory?.title,
          videoScript: brief.generatedStory?.script,
        }}
        initialDesign={activeDesign}
        onApply={(dataUrl, nextHooking, design) => {
          void applyStudioResult(dataUrl, nextHooking, design)
        }}
      />
    </div>
  )
}

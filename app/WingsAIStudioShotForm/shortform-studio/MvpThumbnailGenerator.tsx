"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import type {
  MvpScriptStyleState,
  MvpThumbnailHookingText,
  MvpThumbnailVariant,
} from "@/lib/mvp-studio-types"
import { buildThumbnailHookingInput } from "@/lib/shotform-mvp-thumbnail"
import { StudioPageCard, studio } from "../components/ShotFormStudioUI"
import { MvpThumbnailPanel } from "./MvpThumbnailPanel"

type Props = {
  result: AutoEditJobResult
  videoUrl: string | null
  segments?: readonly NarrationSegment[]
  scriptStyle: MvpScriptStyleState
  thumbnailUrl: string
  thumbnailGallery: MvpThumbnailVariant[]
  selectedThumbnailId: string | null
  thumbnailIntroOn: boolean
  hookingText: MvpThumbnailHookingText
  onAddThumbnail: (entry: {
    url: string
    source: MvpThumbnailVariant["source"]
    hookingText?: MvpThumbnailHookingText
    studioDesign?: MvpThumbnailVariant["studioDesign"]
  }) => void
  onSelectThumbnail: (id: string) => void
  onRemoveThumbnail: (id: string) => void
  onThumbnailIntroOnChange: (on: boolean) => void
  onHookingTextChange: (text: MvpThumbnailHookingText) => void
  onBack: () => void
  onNext: () => void
}

export function MvpThumbnailGenerator({
  result,
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
  onBack,
  onNext,
}: Props) {
  const productName = result.productAnalysis?.productName || scriptStyle.commentKeyword || "제품"

  const hookingInput = useMemo(
    () =>
      buildThumbnailHookingInput({
        productName,
        productAnalysis: result.productAnalysis,
        scriptStyle,
        segments,
      }),
    [productName, result.productAnalysis, scriptStyle, segments]
  )

  return (
    <StudioPageCard className="border-amber-500/25 bg-amber-950/10">
      <p className={studio.label}>7. 썸네일 생성</p>
      <h3 className="mt-1 text-lg font-semibold text-white">유튜브 쇼츠 썸네일 · {productName}</h3>
      <p className="mt-1 text-xs text-slate-400">
        영상 편집(5단계) 「썸네일」 탭과 동일합니다. 쇼핑숏폼 프롬프트로 생성합니다.
      </p>

      <div className="mt-6">
        <MvpThumbnailPanel
          layout="page"
          productName={productName}
          hookingInput={hookingInput}
          videoUrl={videoUrl}
          segments={segments}
          scriptStyle={scriptStyle}
          thumbnailUrl={thumbnailUrl}
          thumbnailGallery={thumbnailGallery}
          selectedThumbnailId={selectedThumbnailId}
          thumbnailIntroOn={thumbnailIntroOn}
          hookingText={hookingText}
          onAddThumbnail={onAddThumbnail}
          onSelectThumbnail={onSelectThumbnail}
          onRemoveThumbnail={onRemoveThumbnail}
          onThumbnailIntroOnChange={onThumbnailIntroOnChange}
          onHookingTextChange={onHookingTextChange}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="border-white/15" onClick={onBack}>
          ← 자막·대본
        </Button>
        <Button type="button" variant="ghost" className={studio.btnPrimary} onClick={onNext}>
          보내기 →
        </Button>
      </div>
    </StudioPageCard>
  )
}

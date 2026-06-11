import type { SerpVideoRow } from "@/lib/serpapi-product-search"
import { EMPTY_FACTORY_NARRATION_SEGMENTS, type NarrationSegment } from "@/lib/shotform-factory-narration-script"

/** URL별 AI 쇼핑 숏폼·믹스용 콘텐츠 (실데이터 연동 시 이 맵에 항목 추가) */
export type ShotformUrlContentBundle = {
  relatedVideos: SerpVideoRow[]
  narrationSegments: readonly NarrationSegment[]
  factoryPreviewVideoSrc: string | null
}

const EMPTY_BUNDLE: ShotformUrlContentBundle = {
  relatedVideos: [],
  narrationSegments: EMPTY_FACTORY_NARRATION_SEGMENTS,
  factoryPreviewVideoSrc: null,
}

export function resolveShotformUrlContentBundle(_productInputUrl: string | null | undefined): ShotformUrlContentBundle {
  return EMPTY_BUNDLE
}

export function hasShotformUrlContentBundle(_productInputUrl: string | null | undefined): boolean {
  return false
}

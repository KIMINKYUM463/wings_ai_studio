import type { AnalyzedTemplateStyleSpec } from '@/lib/longform-v2/youtube/templateStyleAnalysis'
import type { StudioImageGradientMask } from './imageGradientMask'
import type { StudioImageCrop } from './imageLayerCrop'
import type { XnAnchorKind, YnAnchorKind } from './textCanvasAnchor'
import type {
  CanvasTextAlign,
  TextItem,
} from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import { shapeLayerLabel, type StudioShapeLayer } from './shapeLayers'
import { overlayPresetLabel, type StudioOverlayLayer } from './overlayLayers'
export type { StudioShapeKind, StudioShapeLayer } from './shapeLayers'
export type { StudioImageGradientMask, ImageGradientMaskType, ImageGradientMaskDirection } from './imageGradientMask'
export type { StudioImageCrop } from './imageLayerCrop'
export type { StudioOverlayLayer, StudioOverlayPresetId } from './overlayLayers'

export const STUDIO_CANVAS_W = 1280
export const STUDIO_CANVAS_H = 720
/** 편집기 — 썸네일 프레임 밖으로 사진·핸들이 보이도록 여백(px) */
export const STUDIO_EDIT_BLEED = 200
export const STUDIO_EDIT_CANVAS_W = STUDIO_CANVAS_W + STUDIO_EDIT_BLEED * 2
export const STUDIO_EDIT_CANVAS_H = STUDIO_CANVAS_H + STUDIO_EDIT_BLEED * 2

/** 새 텍스트·외곽선 켤 때 기본 두께(px) */
export const DEFAULT_THUMBNAIL_TEXT_STROKE_WIDTH = 22

/** 프로 템플릿 슬롯 — 추후 JSON/이미지 에셋으로 교체 */
export type TemplateTextSlotDef = {
  slotKey: string
  label: string
  /** 미리보기 PNG에 보이는 기본 문구 (비전 OCR 폴백) */
  samplePreviewText?: string
  /** AI 카피 replacement 상한 (글자 수) */
  maxCharacters: number
  /** 0~1 정규화 좌표 (xnAnchor에 따라 의미가 달라짐) */
  xn: number
  yn: number
  /** 실측 피벗(px) — 있으면 xn/yn 계산 대신 캔버스에 그대로 배치 (템플릿1 등) */
  pivotXPx?: number
  pivotYPx?: number
  /** center 정렬 슬롯은 xn=가로 중앙. 템플릿3는 yn=세로 중앙 */
  xnAnchor?: XnAnchorKind
  ynAnchor?: YnAnchorKind
  fontSize: number
  fill: string
  stroke: string
  strokeWidth: number
  textAlign: CanvasTextAlign
  fontFamily?: string
  zIndex: number
  boxBackground?: boolean
  boxBackgroundColor?: string
  boxPaddingX?: number
  boxPaddingY?: number
  boxRadius?: number
  /** 박스 배경 고정 너비(px). textAlign center일 때 xn=가로 중앙 */
  boxWidthPx?: number
  /** 미리보기와 동일한 기울기(도). 반시계(-) */
  rotationDeg?: number
  /** 글자 구간별 색 (그라데이션·다색) */
  fillSpans?: { start: number; end: number; fill: string }[]
}

/** 저장·합성 시 캔버스 외곽 테두리 (radius 0 = 직각 꼭짓점) */
export type ThumbnailExportFrame = {
  color: string
  width: number
  /** 0이면 라운드 없음(직각), 0 초과 시 둥근 모서리 */
  radius: number
}

export type ThumbnailProTemplate = {
  id: string
  label: string
  description: string
  tags: string[]
  /** 템플릿 선택 카드용 CSS 그라데이션(에셋 미제공 시) */
  previewCss: string
  /** 추후: /public/thumbnail-templates/{id}/preview.jpg */
  previewImageUrl?: string
  /**
   * 추후 제공 — AI 배경 전용 프롬프트.
   * 플레이스홀더: `{topic}`, `{scriptExcerpt}`, `{layoutId}`
   */
  backgroundPromptTemplate: string
  textSlots: readonly TemplateTextSlotDef[]
  /** 합성 시 고정 테두리 (미리보기 PNG와 동일) */
  exportFrame?: ThumbnailExportFrame
  /** 사용자 localStorage 커스텀 템플릿 */
  isCustom?: boolean
  createdAt?: number
  updatedAt?: number
  basedOnTemplateId?: string
}

export type StudioBackgroundLayout = {
  x: number
  y: number
  width: number
  height: number
}

/** 배경 사진 위·글자·스티커 아래 그라데이션 딤 */
export type StudioBackgroundScrimDirection =
  | 'bottom-up'
  | 'top-down'
  | 'left-dark'
  | 'right-dark'
  | 'diagonal-bl'
  | 'diagonal-tr'
  | 'vignette'
  | 'center-dark'

export type StudioBackgroundScrim = {
  enabled: boolean
  /** bottom-up: 아래 어두움 → 위 투명 / top-down: 위 어두움 → 아래 투명 등 */
  direction: StudioBackgroundScrimDirection
  /** 어두운 쪽 불투명도 (0.05~0.95) */
  opacity: number
  /** 캔버스 높이(또는 방향 축) 대비 그라데이션이 차지하는 비율 (0.15~1) */
  extent: number
  /** 0~1 — 작을수록 어두운 쪽에 그림자가 몰리고, 클수록 부드럽게 퍼짐 */
  feather: number
  /** 0~1 — 어두운 영역이 그라데이션 축을 따라 차지하는 비율 (전환 시작점) */
  midpoint: number
  /** 어두운 쪽 색 (#RRGGBB, 기본 검정) */
  color: string
}

export type StudioImageLayer = {
  id: string
  kind: 'image'
  name: string
  imageDataUrl: string
  x: number
  y: number
  width: number
  height: number
  opacity: number
  zIndex: number
  visible: boolean
  /** true면 캔버스에서 이동·크기·회전 불가 */
  locked?: boolean
  /** 도(°), 레이어 중심 기준 */
  rotation?: number
  /** 가장자리 그라데이션 페이드(투명) */
  gradientMask?: StudioImageGradientMask
  /** 좌우 반전 */
  flipX?: boolean
  /** 원본 이미지에서 보여줄 영역(픽셀) — 리사이즈 시 조절 */
  crop?: StudioImageCrop
}

export type ThumbnailStudioDocument = {
  version: 1
  templateId: string
  /** 템플릿 미리보기 비전 분석 — 배경·문구 위치·색상 */
  templateStyle?: AnalyzedTemplateStyleSpec
  background: {
    source: 'gradient' | 'ai' | 'upload'
    imageDataUrl: string | null
    /** 배경 파일 갱신 시각 — 동일 `/data/...` URL 캐시 무효화용 */
    imageUpdatedAt?: string | null
    /** 배경 이미지 위치·크기 (없으면 cover 자동) */
    layout?: StudioBackgroundLayout | null
    /** 사용자가 드래그·리사이즈로 layout을 바꿨으면 true — 자동 cover 덮어쓰기 방지 */
    layoutCustomized?: boolean
    scrim?: StudioBackgroundScrim
    /** true면 캔버스에서 이동·크기 조절 불가 */
    locked?: boolean
    /** 배경 사진 가장자리 그라데이션 마스크 */
    gradientMask?: StudioImageGradientMask
    /** 배경 사진 좌우 반전 */
    flipX?: boolean
  }
  textLayers: TextItem[]
  imageLayers: StudioImageLayer[]
  /** 화살표·직선·도형 오버레이 */
  shapeLayers: StudioShapeLayer[]
  /** 그라데이션·틴트 오버레이 (배경 위, 글자·스티커와 z-index로 겹침) */
  overlayLayers?: StudioOverlayLayer[]
  /** 템플릿 테두리(템플릿6 등) — 색·두께 사용자 편집 */
  exportFrame?: ThumbnailExportFrame
}

export type StudioLayerRef =
  | { kind: 'background' }
  | { kind: 'text'; id: string }
  | { kind: 'image'; id: string }
  | { kind: 'shape'; id: string }
  | { kind: 'overlay'; id: string }

export function studioLayerLabel(
  doc: ThumbnailStudioDocument,
  ref: StudioLayerRef,
): string {
  if (ref.kind === 'background') {
    if (doc.background.imageDataUrl) {
      return doc.background.source === 'ai' ? '배경 (AI)' : '배경 (사진)'
    }
    return '배경 (비어 있음)'
  }
  if (ref.kind === 'text') {
    const t = doc.textLayers.find((x) => x.id === ref.id)
    const head = (t?.text ?? '').trim().slice(0, 24)
    return head ? `문구: ${head}` : '문구 레이어'
  }
  const img = doc.imageLayers.find((x) => x.id === ref.id)
  if (img) return img.name?.trim() || '이미지 레이어'
  const shp = (doc.shapeLayers ?? []).find((x) => x.id === ref.id)
  if (shp) return shapeLayerLabel(shp)
  const ovl = (doc.overlayLayers ?? []).find((x) => x.id === ref.id)
  if (ovl) return `오버레이: ${ovl.name?.trim() || overlayPresetLabel(ovl.preset)}`
  return '레이어'
}

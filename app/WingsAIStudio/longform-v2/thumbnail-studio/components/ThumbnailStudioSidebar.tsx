import { useCallback, useRef } from 'react'
import type { TextItem } from '../YoutubeThumbnailManualEditor'
import {
  THUMBNAIL_QUICK_TEXT_STYLES,
  THUMBNAIL_TEXT_STYLE_PRESETS,
} from '@/lib/longform-v2/thumbnailTemplateStudio/textStylePresets'
import {
  remapFillSpansOnTextChange,
} from '@/lib/longform-v2/thumbnailTemplateStudio/textFillSpans'
import {
  patchTextFillColor,
  readTextareaSelection,
  resolveTextFillSelectionRange,
  type TextFillSelectionRange,
} from '@/lib/longform-v2/thumbnailTemplateStudio/textFillSelection'
import { TextFillColorField } from './TextFillColorField'
import type { StudioShapeLayer } from '@/lib/longform-v2/thumbnailTemplateStudio/shapeLayers'
import type {
  StudioBackgroundLayout,
  StudioBackgroundScrim,
  StudioImageLayer,
  StudioOverlayLayer,
  StudioOverlayPresetId,
  ThumbnailExportFrame,
} from '@/lib/longform-v2/thumbnailTemplateStudio/types'
import type { StudioShapeKind } from '@/lib/longform-v2/thumbnailTemplateStudio/types'
import { STUDIO_CANVAS_H } from '@/lib/longform-v2/thumbnailTemplateStudio/types'
import type { StudioLayerReorderOp } from '@/lib/longform-v2/thumbnailTemplateStudio/layerOrder'
import { ThumbnailTabLanguagePicker } from './ThumbnailTabLanguagePicker'
import { OVERLAY_PRESETS, isGradientOverlayPreset } from '@/lib/longform-v2/thumbnailTemplateStudio/overlayLayers'
import {
  DEFAULT_BACKGROUND_SCRIM,
  buildScrimPreviewCss,
  SCRIM_DIRECTION_OPTIONS,
} from '@/lib/longform-v2/thumbnailTemplateStudio/backgroundScrim'
import { ImageGradientMaskControls } from './ImageGradientMaskControls'
import type { StudioImageGradientMask } from '@/lib/longform-v2/thumbnailTemplateStudio/types'
import { normalizeImageGradientMask } from '@/lib/longform-v2/thumbnailTemplateStudio/imageGradientMask'
import { TextStrokeControls } from './TextStrokeControls'
import { TextTypographyControls } from './TextTypographyControls'
import { TextAlignControls } from './TextAlignControls'
import { StudioNumericInput } from './StudioNumericInput'
import { ThumbnailFontFamilyPicker } from './ThumbnailFontFamilyPicker'
import { LayerOrderControls } from './LayerOrderControls'
import { StudioLayerPanel } from './StudioLayerPanel'
import { ThumbnailVariantTray } from './ThumbnailVariantTray'
import { ThumbnailSavedWorksPanel } from './ThumbnailSavedWorksPanel'
import { StudioElementPicker } from './StudioElementPicker'
import { WATERMARK_PRESETS } from '@/lib/longform-v2/thumbnailTemplateStudio/watermarkPresets'
import type { WatermarkPresetId } from '@/lib/longform-v2/thumbnailTemplateStudio/watermarkPresets'
import type { ThumbnailStudioVariant } from '@/lib/longform-v2/thumbnailTemplateStudio/studioVariants'
import type { ThumbnailStudioSavedWorkMeta } from '@/lib/longform-v2/thumbnail-bridge/thumbnailStudioSavedWorksApi'
import type { StudioLayerRef, ThumbnailStudioDocument } from '@/lib/longform-v2/thumbnailTemplateStudio/types'
import { BG_MOOD_PRESETS } from '@/lib/longform-v2/thumbnailTemplateStudio/bgMoodPresets'
import {
  THUMBNAIL_TEXT_REWRITE_PRESETS,
  type ThumbnailTextRewritePresetId,
} from '@/lib/longform-v2/youtube/thumbnailTextRewrite'
import {
  ThumbnailGenSettingsBar,
  ThumbnailGenStyleSelectionSummary,
} from './ThumbnailGenSettingsBar'
import type { ThumbnailGenSettings } from '@/lib/longform-v2/thumbnailTemplateStudio/thumbnailGenSettings'
import type { TopicStyleRecUi } from '@/lib/longform-v2/thumbnail-bridge/useTopicStyleRecommendations'

export type StudioSidebarTab =
  | 'text'
  | 'style'
  | 'elements'
  | 'layers'
  | 'background'
  | 'bgAiStyle'
  | 'ai'
  | 'works'

const NAV: { id: StudioSidebarTab; label: string; icon: string }[] = [
  { id: 'works', label: '불러오기', icon: '📂' },
  { id: 'text', label: '텍스트', icon: 'T' },
  { id: 'style', label: '스타일', icon: '◎' },
  { id: 'elements', label: '요소', icon: '◇' },
  { id: 'layers', label: '레이어', icon: '≡' },
  { id: 'background', label: '배경', icon: '▣' },
  { id: 'bgAiStyle', label: 'AI스타일', icon: '◈' },
  { id: 'ai', label: 'AI', icon: '✦' },
]

export type ThumbnailStudioSidebarProps = {
  activeTab: StudioSidebarTab
  onTabChange: (tab: StudioSidebarTab) => void
  selectedText?: TextItem
  selectedImage?: StudioImageLayer
  selectedShape?: StudioShapeLayer
  onAddShape: (kind: StudioShapeKind) => void
  onAddElementPreset?: (presetId: string) => void
  elementStickerPresetId?: string | null
  onUpdateShape: (id: string, patch: Partial<StudioShapeLayer>) => void
  newTextDraft: string
  onNewTextDraftChange: (v: string) => void
  onAddTextFromDraft: () => void
  onUpdateText: (id: string, patch: Partial<TextItem>) => void
  /** 캔버스 Shift+드래그 글자 선택 구간 */
  canvasTextFillRange?: TextFillSelectionRange | null
  /** 캔버스 더블클릭 인라인 편집 textarea */
  inlineTextInputRef?: React.RefObject<HTMLTextAreaElement | null>
  onApplyStylePreset: (presetId: string, scope: 'selected' | 'all') => void
  onPickOverlayImage: (files: File | File[] | null) => void
  onBackgroundFile: (file: File | null) => void
  extraBgHint: string
  onExtraBgHintChange: (v: string) => void
  thumbGenSettings: ThumbnailGenSettings
  onThumbGenSettingsChange: (next: ThumbnailGenSettings) => void
  genSettingsDisabled?: boolean
  topicStyleRec?: TopicStyleRecUi | null
  outputLanguage: string
  onApplyOutputLanguage: (v: string) => void
  languageApplyBusy?: boolean
  genBusy: boolean
  bgOnlyBusy: boolean
  textOnlyBusy: boolean
  onGenerateFull: () => void
  onRegenerateText: () => void
  onRegenerateBg: () => void
  onFitTextToBackground?: () => void
  layoutFitBusy?: boolean
  onVerifyThumbnail?: () => void
  verifyBusy?: boolean
  onClearCanvas: () => void
  onDeleteSelected: () => void
  onReorderLayer?: (op: StudioLayerReorderOp) => void
  onUpdateImage: (id: string, patch: Partial<StudioImageLayer>) => void
  onStartImageCrop?: (id: string) => void
  onApplyImageCrop?: () => void
  onCancelImageCrop?: () => void
  imageCropLayerId?: string | null
  onResetImageCrop?: (id: string) => void
  overlayLayers?: StudioOverlayLayer[]
  selectedOverlay?: StudioOverlayLayer
  onAddOverlay?: (preset: StudioOverlayPresetId) => void
  onSelectOverlay?: (id: string) => void
  onUpdateOverlay?: (id: string, patch: Partial<StudioOverlayLayer>) => void
  doc: ThumbnailStudioDocument
  selectedLayer: StudioLayerRef | null
  selectedLayers?: StudioLayerRef[]
  onSelectLayer: (ref: StudioLayerRef, modifiers?: { ctrl?: boolean; shift?: boolean }) => void
  onToggleLayerVisible: (ref: StudioLayerRef, visible: boolean) => void
  onAddWatermark?: (presetId: WatermarkPresetId) => void
  variants?: ThumbnailStudioVariant[]
  activeVariantId?: string | null
  variantBusy?: boolean
  onSaveVariant?: () => void
  onGenerateVariantAi?: () => void
  onApplyVariant?: (id: string) => void
  onRemoveVariant?: (id: string) => void
  savedWorks?: ThumbnailStudioSavedWorkMeta[]
  activeSavedWorkId?: string | null
  savedWorksLoading?: boolean
  savedWorksBusy?: boolean
  onRefreshSavedWorks?: () => void
  onSaveSavedWork?: () => void
  onLoadSavedWork?: (id: string) => void
  onRemoveSavedWork?: (id: string) => void
  hasBackgroundImage?: boolean
  backgroundLayout?: StudioBackgroundLayout
  backgroundLocked?: boolean
  backgroundFlipX?: boolean
  onBackgroundFlipXChange?: (flipX: boolean) => void
  onBackgroundLockedChange?: (locked: boolean) => void
  onUpdateBackgroundLayout?: (layout: StudioBackgroundLayout) => void
  backgroundScrim: StudioBackgroundScrim
  onUpdateBackgroundScrim: (patch: Partial<StudioBackgroundScrim>) => void
  backgroundGradientMask?: StudioImageGradientMask
  onUpdateBackgroundGradientMask?: (patch: Partial<StudioImageGradientMask>) => void
  exportFrame?: ThumbnailExportFrame | null
  onUpdateExportFrame?: (patch: Partial<ThumbnailExportFrame>) => void
  /** AI Magic — 벤치마크·팔레트·향상·훅 */
  analyzedBenchmarkStyle?: string | null
  benchmarkBusy?: boolean
  benchmarkRemixBusy?: boolean
  benchmarkSourceFileName?: string | null
  onBenchmarkFile?: (file: File | null) => void
  onBenchmarkRemix?: () => void
  onClearBenchmark?: () => void
  onApplyBgMood?: (hint: string) => void
  extractedPalette?: string[]
  paletteBusy?: boolean
  onExtractPalette?: () => void
  onApplyPaletteColor?: (hex: string, scope: 'selected' | 'all') => void
  onMagicEnhance?: () => void
  magicEnhanceBusy?: boolean
  onAutoTextContrast?: () => void
  autoContrastBusy?: boolean
  hookSuggestions?: string[]
  hookBusy?: boolean
  onGenerateHookSuggestions?: () => void
  onApplyHookSuggestion?: (text: string) => void
  onRewriteTextPreset?: (presetId: ThumbnailTextRewritePresetId) => void
  textRewriteBusy?: boolean
  /** 선택 슬롯만 대본·주제에서 새 카피 */
  onRegenerateSelectedText?: () => void
  textRegenerateBusy?: boolean
  /** 유튜브 참고 카피라이팅 모달 */
  onOpenCopyResearch?: () => void
}

function overlayFilesFromInput(list: FileList | null): File[] {
  if (!list?.length) return []
  return Array.from(list).filter((f) => f.type.startsWith('image/'))
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="thumb-ui-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="thumb-ui-toggle__track" aria-hidden />
    </label>
  )
}

export function ThumbnailStudioSidebar(props: ThumbnailStudioSidebarProps) {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const {
    activeTab,
    onTabChange,
    selectedText,
    selectedImage,
    selectedShape,
    onAddShape,
    onAddElementPreset,
    elementStickerPresetId = null,
    onUpdateShape,
    newTextDraft,
    onNewTextDraftChange,
    onAddTextFromDraft,
  onUpdateText,
  canvasTextFillRange = null,
  inlineTextInputRef,
  onApplyStylePreset,
    onPickOverlayImage,
    onBackgroundFile,
    extraBgHint,
    onExtraBgHintChange,
    thumbGenSettings,
    onThumbGenSettingsChange,
    genSettingsDisabled = false,
    topicStyleRec = null,
    outputLanguage,
    onApplyOutputLanguage,
    languageApplyBusy = false,
    genBusy,
    bgOnlyBusy,
    textOnlyBusy,
    onGenerateFull,
    onRegenerateText,
    onRegenerateBg,
    onFitTextToBackground,
    layoutFitBusy,
    onVerifyThumbnail,
    verifyBusy,
    onClearCanvas,
    onDeleteSelected,
    onReorderLayer,
    onUpdateImage,
    onStartImageCrop,
    onApplyImageCrop,
    onCancelImageCrop,
    imageCropLayerId,
    onResetImageCrop,
    overlayLayers = [],
    selectedOverlay,
    onAddOverlay,
    onSelectOverlay,
    onUpdateOverlay,
    doc,
    selectedLayer,
    selectedLayers = [],
    onSelectLayer,
    onToggleLayerVisible,
    onAddWatermark,
    variants = [],
    activeVariantId = null,
    variantBusy,
    onSaveVariant,
    onGenerateVariantAi,
    onApplyVariant,
    onRemoveVariant,
    savedWorks = [],
    activeSavedWorkId = null,
    savedWorksLoading,
    savedWorksBusy,
    onRefreshSavedWorks,
    onSaveSavedWork,
    onLoadSavedWork,
    onRemoveSavedWork,
    hasBackgroundImage,
    backgroundLayout,
    backgroundLocked,
    backgroundFlipX,
    onBackgroundFlipXChange,
    onBackgroundLockedChange,
    onUpdateBackgroundLayout,
    backgroundScrim,
    onUpdateBackgroundScrim,
    backgroundGradientMask,
    onUpdateBackgroundGradientMask,
    exportFrame,
    onUpdateExportFrame,
    analyzedBenchmarkStyle = null,
    benchmarkBusy,
    benchmarkRemixBusy,
    benchmarkSourceFileName = null,
    onBenchmarkFile,
    onBenchmarkRemix,
    onClearBenchmark,
    onApplyBgMood,
    extractedPalette = [],
    paletteBusy,
    onExtractPalette,
    onApplyPaletteColor,
    onMagicEnhance,
    magicEnhanceBusy,
    onAutoTextContrast,
    autoContrastBusy,
    hookSuggestions = [],
    hookBusy,
    onGenerateHookSuggestions,
    onApplyHookSuggestion,
    onRewriteTextPreset,
    textRewriteBusy,
    onRegenerateSelectedText,
    textRegenerateBusy,
    onOpenCopyResearch,
  } = props

  const positionY =
    selectedText != null ? Math.round((selectedText.y / STUDIO_CANVAS_H) * 100) : 50

  const getTextFillSelectionRange = useCallback((): TextFillSelectionRange | null => {
    const fromInline = readTextareaSelection(inlineTextInputRef?.current ?? null)
    if (fromInline) return fromInline
    return readTextareaSelection(textAreaRef.current)
  }, [inlineTextInputRef])

  const applyTextFillColor = useCallback(
    (color: string, savedRange: TextFillSelectionRange | null) => {
      if (!selectedText) return
      const live = getTextFillSelectionRange()
      const range =
        resolveTextFillSelectionRange(live, savedRange) ??
        (canvasTextFillRange && canvasTextFillRange.start !== canvasTextFillRange.end
          ? canvasTextFillRange
          : null)
      onUpdateText(selectedText.id, patchTextFillColor(selectedText, color, range))
    },
    [selectedText, canvasTextFillRange, getTextFillSelectionRange, onUpdateText],
  )

  const syncTextareaSelection = useCallback(() => {
    void getTextFillSelectionRange()
  }, [getTextFillSelectionRange])

  const hasLayerSelection = Boolean(selectedText || selectedImage || selectedShape || selectedOverlay)

  return (
    <div className="thumb-ui-sidebar">
      <nav className="thumb-ui-sidebar__nav" aria-label="편집 메뉴">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              'thumb-ui-sidebar__nav-btn' + (activeTab === item.id ? ' thumb-ui-sidebar__nav-btn--on' : '')
            }
            onClick={() => onTabChange(item.id)}
          >
            <span className="thumb-ui-sidebar__nav-icon" aria-hidden>
              {item.icon}
            </span>
            <span className="thumb-ui-sidebar__nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="thumb-ui-sidebar__panel">
        {hasLayerSelection && onReorderLayer ? (
          <section className="thumb-ui-section thumb-ui-section--layer-order">
            <h4 className="thumb-ui-section__title">레이어 순서</h4>
            <p className="thumb-ui-hint">
              캔버스에서 선택한{' '}
              {selectedText ? '텍스트' : selectedImage ? '이미지' : selectedOverlay ? '오버레이' : '도형'}의
              앞·뒤 겹침 순서를 바꿉니다. (배경 고정 그라데이션 제외)
            </p>
            <LayerOrderControls onReorder={onReorderLayer} />
          </section>
        ) : null}

        {activeTab === 'works' && (
          <>
            <h3 className="thumb-ui-panel__title">저장 작업 불러오기</h3>
            {onRefreshSavedWorks && onSaveSavedWork && onLoadSavedWork && onRemoveSavedWork ? (
              <ThumbnailSavedWorksPanel
                works={savedWorks}
                activeWorkId={activeSavedWorkId}
                loading={savedWorksLoading}
                busy={savedWorksBusy}
                onRefresh={onRefreshSavedWorks}
                onSaveCurrent={onSaveSavedWork}
                onLoad={onLoadSavedWork}
                onRemove={onRemoveSavedWork}
              />
            ) : null}
          </>
        )}

        {activeTab === 'text' && (
          <>
            <h3 className="thumb-ui-panel__title">텍스트 추가</h3>
            {onOpenCopyResearch ? (
              <section className="thumb-ui-section thumb-ui-section--copy-research">
                <h4 className="thumb-ui-section__title">카피라이팅</h4>
                <p className="thumb-ui-hint">
                  직접 문구를 쓸 때 YouTube 고조회 영상의 제목·썸네일 문구를 참고하거나, AI가
                  조합해 슬롯에 넣을 수 있습니다.
                </p>
                <button
                  type="button"
                  className="thumb-ui-btn thumb-ui-btn--outline"
                  onClick={onOpenCopyResearch}
                >
                  ✎ 카피라이팅 작업
                </button>
              </section>
            ) : null}
            <section className="thumb-ui-section">
              <label className="thumb-ui-label">텍스트</label>
              <p className="thumb-ui-hint">
                일부만 색 변경: 아래 입력란에서 글자를 드래그로 선택하거나, 캔버스에서{' '}
                <strong>Shift+드래그</strong>로 글자를 고른 뒤 「컬러」를 바꾸세요.
                줄바꿈은 <strong>Shift+Enter</strong>입니다.
              </p>
              <textarea
                ref={textAreaRef}
                className="thumb-ui-textarea"
                rows={3}
                placeholder="텍스트를 입력해주세요"
                value={selectedText?.text ?? newTextDraft}
                onSelect={syncTextareaSelection}
                onMouseUp={syncTextareaSelection}
                onKeyUp={syncTextareaSelection}
                onChange={(e) => {
                  const v = e.target.value
                  if (selectedText) {
                    onUpdateText(selectedText.id, {
                      text: v,
                      fillSpans: remapFillSpansOnTextChange(
                        selectedText.text,
                        v,
                        selectedText.fillSpans,
                        selectedText.fill,
                      ),
                    })
                  } else {
                    onNewTextDraftChange(v)
                  }
                }}
              />
              <button type="button" className="thumb-ui-btn thumb-ui-btn--primary" onClick={onAddTextFromDraft}>
                T 텍스트 추가하기
              </button>
            </section>

            {selectedText && onRegenerateSelectedText ? (
              <section className="thumb-ui-section thumb-ui-section--text-regen">
                <h4 className="thumb-ui-section__title">선택 문구 AI</h4>
                <button
                  type="button"
                  className="thumb-ui-btn thumb-ui-btn--outline thumb-ui-btn--text-regen"
                  disabled={
                    textRegenerateBusy ||
                    textRewriteBusy ||
                    textOnlyBusy ||
                    genBusy ||
                    bgOnlyBusy
                  }
                  onClick={onRegenerateSelectedText}
                >
                  {textRegenerateBusy ? '문구 재생성 중…' : '✦ AI 텍스트 재생성'}
                </button>
                <p className="thumb-ui-hint">
                  대본·주제·출력 언어를 바탕으로 <strong>이 줄만</strong> 새 카피를 씁니다. 1·2줄이 연결된
                  템플릿이면 두 줄을 함께 맞춥니다. 톤만 바꾸려면 AI 탭 → Magic Write를 사용하세요.
                </p>
              </section>
            ) : null}

            <section className="thumb-ui-section">
              <h4 className="thumb-ui-section__title">스타일</h4>
              <div className="thumb-ui-style-grid thumb-ui-style-grid--4">
                {THUMBNAIL_QUICK_TEXT_STYLES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={'thumb-ui-style-chip ' + p.previewClass}
                    onClick={() => onApplyStylePreset(p.id, selectedText ? 'selected' : 'all')}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </section>

            {selectedText ? (
              <section className="thumb-ui-section">
                <h4 className="thumb-ui-section__title">텍스트 속성</h4>
                <ThumbnailFontFamilyPicker
                  fontFamily={selectedText.fontFamily}
                  onChange={(fontFamily) => onUpdateText(selectedText.id, { fontFamily })}
                />
                <label className="thumb-ui-field">
                  <span>폰트크기</span>
                  <StudioNumericInput
                    min={12}
                    max={160}
                    value={selectedText.fontSize}
                    onChange={(fontSize) => onUpdateText(selectedText.id, { fontSize })}
                  />
                </label>
                <TextAlignControls
                  value={selectedText.textAlign}
                  onChange={(textAlign) => onUpdateText(selectedText.id, { textAlign })}
                />
                <TextFillColorField
                  value={selectedText.fill.startsWith('#') ? selectedText.fill : '#ffffff'}
                  onApplyColor={applyTextFillColor}
                  getSelectionRange={getTextFillSelectionRange}
                  hint={
                    canvasTextFillRange && canvasTextFillRange.start !== canvasTextFillRange.end
                      ? '캔버스 선택 적용'
                      : undefined
                  }
                />
                <TextStrokeControls
                  text={selectedText}
                  onPatch={(patch) => onUpdateText(selectedText.id, patch)}
                />
                <TextTypographyControls
                  text={selectedText}
                  onPatch={(patch) => onUpdateText(selectedText.id, patch)}
                />
                <Toggle
                  label="글자 뒤 박스"
                  checked={selectedText.boxBackground === true}
                  onChange={(on) => onUpdateText(selectedText.id, { boxBackground: on })}
                />
                <label className="thumb-ui-field">
                  <span>회전 ({Math.round(selectedText.rotation ?? 0)}°)</span>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    step={0.5}
                    value={selectedText.rotation ?? 0}
                    onChange={(e) =>
                      onUpdateText(selectedText.id, { rotation: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="thumb-ui-field">
                  <span>위치 (세로 {positionY}%)</span>
                  <input
                    type="range"
                    min={5}
                    max={95}
                    value={positionY}
                    onChange={(e) =>
                      onUpdateText(selectedText.id, {
                        y: (Number(e.target.value) / 100) * STUDIO_CANVAS_H,
                      })
                    }
                  />
                </label>
                <button type="button" className="thumb-ui-btn thumb-ui-btn--ghost" onClick={onDeleteSelected}>
                  선택 문구 삭제
                </button>
              </section>
            ) : (
              <p className="thumb-ui-hint">캔버스에서 문구를 클릭하면 속성을 편집할 수 있습니다.</p>
            )}
          </>
        )}

        {activeTab === 'style' && (
          <>
            <h3 className="thumb-ui-panel__title">스타일</h3>
            <p className="thumb-ui-hint">선택한 문구에 적용합니다. 선택이 없으면 모든 문구에 적용됩니다.</p>
            {exportFrame && onUpdateExportFrame ? (
              <section className="thumb-ui-section">
                <h4 className="thumb-ui-section__title">캔버스 테두리</h4>
                <p className="thumb-ui-hint">
                  이 템플릿 전용 외곽 프레임입니다. 꼭짓점은 직각이며, 색과 두께만 바꿀 수 있습니다.
                </p>
                <label className="thumb-ui-field thumb-ui-field--color">
                  <span>테두리 색</span>
                  <input
                    type="color"
                    value={exportFrame.color.startsWith('#') ? exportFrame.color : '#dc2626'}
                    onChange={(e) => onUpdateExportFrame({ color: e.target.value })}
                  />
                  <input
                    type="text"
                    className="thumb-ui-hex"
                    value={exportFrame.color.startsWith('#') ? exportFrame.color : '#dc2626'}
                    onChange={(e) => onUpdateExportFrame({ color: e.target.value })}
                  />
                </label>
                <label className="thumb-ui-field">
                  <span>테두리 두께 (px)</span>
                  <StudioNumericInput
                    min={4}
                    max={120}
                    value={exportFrame.width}
                    onChange={(width) => onUpdateExportFrame({ width })}
                  />
                  <input
                    type="range"
                    min={4}
                    max={80}
                    value={exportFrame.width}
                    onChange={(e) => onUpdateExportFrame({ width: Number(e.target.value) })}
                  />
                </label>
              </section>
            ) : null}
            <section className="thumb-ui-section">
              <h4 className="thumb-ui-section__title">자막 효과</h4>
              <div className="thumb-ui-effect-grid">
                {THUMBNAIL_TEXT_STYLE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={'thumb-ui-effect-card ' + p.previewClass}
                    onClick={() => onApplyStylePreset(p.id, selectedText ? 'selected' : 'all')}
                  >
                    <span className="thumb-ui-effect-card__sample">가나다</span>
                    <span className="thumb-ui-effect-card__label">{p.label}</span>
                  </button>
                ))}
              </div>
            </section>
            {selectedText ? (
              <>
                <section className="thumb-ui-section">
                  <h4 className="thumb-ui-section__title">메인컬러</h4>
                  <TextFillColorField
                    label="컬러"
                    value={selectedText.fill.startsWith('#') ? selectedText.fill : '#ffffff'}
                    onApplyColor={applyTextFillColor}
                    getSelectionRange={getTextFillSelectionRange}
                  />
                </section>
                <TextStrokeControls
                  text={selectedText}
                  onPatch={(patch) => onUpdateText(selectedText.id, patch)}
                />
              </>
            ) : null}
          </>
        )}

        {activeTab === 'elements' && (
          <>
            <h3 className="thumb-ui-panel__title">요소</h3>
            <section className="thumb-ui-section">
              <h4 className="thumb-ui-section__title">누끼 화살표</h4>
              <button
                type="button"
                className="thumb-ui-btn thumb-ui-btn--outline thumb-ui-btn--arrow-sticker"
                onClick={() => onAddShape('arrow')}
                title="투명 배경 화살표 스티커"
              >
                <img
                  src="/thumbnail-studio/arrow-red.png"
                  alt=""
                  className="thumb-ui-arrow-sticker-preview"
                  draggable={false}
                />
                PNG 화살표 스티커
              </button>
            </section>
            {onAddElementPreset ? (
              <section className="thumb-ui-section thumb-ui-section--elements">
                <h4 className="thumb-ui-section__title">도형 · 화살표 · 아이콘</h4>
                <StudioElementPicker
                  onSelect={onAddElementPreset}
                  disabled={Boolean(elementStickerPresetId)}
                  generatingPresetId={elementStickerPresetId}
                />
              </section>
            ) : (
              <section className="thumb-ui-section">
                <h4 className="thumb-ui-section__title">기본 도형</h4>
                <div className="thumb-ui-shape-grid">
                  <button type="button" className="thumb-ui-btn thumb-ui-btn--outline" onClick={() => onAddShape('line')}>
                    ─ 직선
                  </button>
                  <button type="button" className="thumb-ui-btn thumb-ui-btn--outline" onClick={() => onAddShape('rect')}>
                    ▢ 사각형
                  </button>
                  <button type="button" className="thumb-ui-btn thumb-ui-btn--outline" onClick={() => onAddShape('ellipse')}>
                    ◯ 타원
                  </button>
                </div>
              </section>
            )}
            {selectedShape ? (
              <section className="thumb-ui-section">
                <h4 className="thumb-ui-section__title">선택 도형</h4>
                {(() => {
                  const strokeOnlyRing =
                    selectedShape.kind === 'path' && selectedShape.strokeOnly === true
                  return (
                    <>
                <label className="thumb-ui-field thumb-ui-field--color">
                  <span>{strokeOnlyRing ? '테두리 색' : '선 색'}</span>
                  <input
                    type="color"
                    value={selectedShape.color.startsWith('#') ? selectedShape.color : '#ef4444'}
                    onChange={(e) => onUpdateShape(selectedShape.id, { color: e.target.value })}
                  />
                </label>
                <label className="thumb-ui-field">
                  <span>{strokeOnlyRing ? '테두리 두께' : '선 두께'}</span>
                  <StudioNumericInput
                    min={1}
                    max={48}
                    value={selectedShape.lineWidth}
                    onChange={(lineWidth) => onUpdateShape(selectedShape.id, { lineWidth })}
                  />
                </label>
                    </>
                  )
                })()}
                <label className="thumb-ui-field">
                  <span>불투명도</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={selectedShape.opacity}
                    onChange={(e) =>
                      onUpdateShape(selectedShape.id, { opacity: Number(e.target.value) })
                    }
                  />
                </label>
                {(selectedShape.kind === 'rect' ||
                  selectedShape.kind === 'ellipse' ||
                  (selectedShape.kind === 'path' && !selectedShape.strokeOnly)) && (
                  <label className="thumb-ui-field thumb-ui-field--color">
                    <span>채우기 (비우려면 비움)</span>
                    <input
                      type="color"
                      value={
                        selectedShape.fill?.startsWith('#')
                          ? selectedShape.fill
                          : '#22d3ee'
                      }
                      onChange={(e) =>
                        onUpdateShape(selectedShape.id, { fill: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="thumb-ui-btn thumb-ui-btn--ghost"
                      onClick={() => onUpdateShape(selectedShape.id, { fill: null })}
                    >
                      채우기 없음
                    </button>
                  </label>
                )}
                <button type="button" className="thumb-ui-btn thumb-ui-btn--ghost" onClick={onDeleteSelected}>
                  도형 삭제
                </button>
              </section>
            ) : null}
            <section className="thumb-ui-section">
              <h4 className="thumb-ui-section__title">이미지</h4>
              <p className="thumb-ui-hint">이미지를 추가해보세요</p>
              <label className="thumb-ui-btn thumb-ui-btn--outline">
                + 이미지 업로드
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = overlayFilesFromInput(e.target.files)
                    onPickOverlayImage(files.length ? files : null)
                    e.target.value = ''
                  }}
                />
              </label>
            </section>
            <section className="thumb-ui-section">
              <h4 className="thumb-ui-section__title">오버레이</h4>
              <p className="thumb-ui-hint">
                배경 위에 그라데이션·틴트를 깔아 글자 가독성을 높입니다. 여러 개를 겹칠 수 있습니다.
              </p>
              <div className="thumb-ui-overlay-grid">
                {OVERLAY_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={'thumb-ui-overlay-preset ' + preset.previewClass}
                    title={preset.label}
                    disabled={!onAddOverlay}
                    onClick={() => onAddOverlay?.(preset.id)}
                  >
                    <span className="thumb-ui-overlay-preset__label">{preset.label}</span>
                  </button>
                ))}
              </div>
              {overlayLayers.length ? (
                <div className="thumb-ui-overlay-list">
                  <p className="thumb-ui-section__label">적용된 오버레이</p>
                  {overlayLayers.map((layer) => (
                    <button
                      key={layer.id}
                      type="button"
                      className={
                        'thumb-ui-overlay-item' +
                        (selectedOverlay?.id === layer.id ? ' thumb-ui-overlay-item--on' : '')
                      }
                      onClick={() => onSelectOverlay?.(layer.id)}
                    >
                      <span>{layer.name}</span>
                      {!layer.visible ? <span className="thumb-ui-overlay-item__off">숨김</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedOverlay && onUpdateOverlay ? (
                <>
                  <Toggle
                    label="오버레이 표시"
                    checked={selectedOverlay.visible}
                    onChange={(on) => onUpdateOverlay(selectedOverlay.id, { visible: on })}
                  />
                  <label className="thumb-ui-field">
                    <span>프리셋</span>
                    <select
                      value={selectedOverlay.preset}
                      onChange={(e) =>
                        onUpdateOverlay(selectedOverlay.id, {
                          preset: e.target.value as StudioOverlayPresetId,
                          name: OVERLAY_PRESETS.find((p) => p.id === e.target.value)?.label,
                        })
                      }
                    >
                      {OVERLAY_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="thumb-ui-field">
                    <span>강도 ({Math.round(selectedOverlay.opacity * 100)}%)</span>
                    <input
                      type="range"
                      min={0.1}
                      max={0.95}
                      step={0.05}
                      value={selectedOverlay.opacity}
                      onChange={(e) =>
                        onUpdateOverlay(selectedOverlay.id, { opacity: Number(e.target.value) })
                      }
                    />
                  </label>
                  {isGradientOverlayPreset(selectedOverlay.preset) ? (
                    <>
                      <label className="thumb-ui-field">
                        <span>적용 범위</span>
                        <div className="thumb-ui-field__inline">
                          <input
                            type="range"
                            min={0.15}
                            max={1}
                            step={0.01}
                            value={selectedOverlay.extent ?? 1}
                            onChange={(e) =>
                              onUpdateOverlay(selectedOverlay.id, { extent: Number(e.target.value) })
                            }
                          />
                          <span className="thumb-ui-field__unit">
                            {Math.round((selectedOverlay.extent ?? 1) * 100)}%
                          </span>
                        </div>
                      </label>
                      <label className="thumb-ui-field">
                        <span>페이드</span>
                        <div className="thumb-ui-field__inline">
                          <input
                            type="range"
                            min={0.05}
                            max={1}
                            step={0.01}
                            value={selectedOverlay.feather ?? 1}
                            onChange={(e) =>
                              onUpdateOverlay(selectedOverlay.id, { feather: Number(e.target.value) })
                            }
                          />
                          <span className="thumb-ui-field__unit">
                            {Math.round((selectedOverlay.feather ?? 1) * 100)}%
                          </span>
                        </div>
                      </label>
                    </>
                  ) : null}
                  <button type="button" className="thumb-ui-btn thumb-ui-btn--ghost" onClick={onDeleteSelected}>
                    오버레이 삭제
                  </button>
                </>
              ) : null}
            </section>
            <section className="thumb-ui-section">
              <h4 className="thumb-ui-section__title">워터마크 / CTA</h4>
              <p className="thumb-ui-hint">NEW·LIVE·EP 등 배지를 한 번에 추가합니다. 추가 후 드래그로 위치를 조절하세요.</p>
              <div className="thumb-ui-watermark-grid">
                {WATERMARK_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="thumb-ui-watermark-chip"
                    disabled={!onAddWatermark}
                    onClick={() => onAddWatermark?.(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <label className="thumb-ui-btn thumb-ui-btn--outline">
                + 이미지 워터마크
                <input
                  type="file"
                  accept="image/png,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = overlayFilesFromInput(e.target.files)
                    onPickOverlayImage(files.length ? files : null)
                    e.target.value = ''
                  }}
                />
              </label>
            </section>
            {selectedImage ? (
              <section
                className={
                  imageCropLayerId === selectedImage.id
                    ? 'thumb-ui-section thumb-ui-section--crop-active'
                    : 'thumb-ui-section'
                }
              >
                <h4 className="thumb-ui-section__title">선택 이미지</h4>
                {imageCropLayerId === selectedImage.id ? (
                  <>
                    <p className="thumb-ui-hint thumb-ui-hint--accent">
                      자르기 모드 — 흰 테두리 안쪽이 남을 영역입니다. 바깥은 어둡게 표시됩니다.
                    </p>
                    <div className="thumb-ui-btn-row">
                      <button
                        type="button"
                        className="thumb-ui-btn thumb-ui-btn--primary"
                        onClick={() => onApplyImageCrop?.()}
                      >
                        자르기 적용
                      </button>
                      <button
                        type="button"
                        className="thumb-ui-btn thumb-ui-btn--ghost"
                        onClick={() => onCancelImageCrop?.()}
                      >
                        취소
                      </button>
                    </div>
                    {onResetImageCrop ? (
                      <button
                        type="button"
                        className="thumb-ui-btn thumb-ui-btn--ghost"
                        onClick={() => onResetImageCrop(selectedImage.id)}
                      >
                        전체 영역
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Toggle
                      checked={Boolean(selectedImage.locked)}
                      onChange={(v) => onUpdateImage(selectedImage.id, { locked: v })}
                      label="위치·크기 고정"
                    />
                    <button
                      type="button"
                      className={
                        selectedImage.flipX
                          ? 'thumb-ui-btn thumb-ui-btn--ghost thumb-ui-btn--on'
                          : 'thumb-ui-btn thumb-ui-btn--ghost'
                      }
                      onClick={() =>
                        onUpdateImage(selectedImage.id, { flipX: !selectedImage.flipX })
                      }
                      disabled={Boolean(selectedImage.locked)}
                    >
                      좌우 반전
                    </button>
                    {onStartImageCrop ? (
                      <button
                        type="button"
                        className="thumb-ui-btn thumb-ui-btn--outline"
                        disabled={Boolean(selectedImage.locked)}
                        onClick={() => onStartImageCrop(selectedImage.id)}
                      >
                        자르기
                      </button>
                    ) : null}
                    <p className="thumb-ui-hint">
                      {selectedImage.locked
                        ? '고정됨 — 드래그·크기 조절이 비활성화됩니다. 해제 후 다시 조절하세요.'
                        : '「자르기」로 사진 일부만 남길 수 있습니다. 크기 핸들은 이미지 전체 크기 조절용입니다.'}
                    </p>
                  </>
                )}
                <label className="thumb-ui-field">
                  <span>가로 위치</span>
                  <input
                    type="number"
                    disabled={Boolean(selectedImage.locked) || imageCropLayerId === selectedImage.id}
                    value={Math.round(selectedImage.x)}
                    onChange={(e) =>
                      onUpdateImage(selectedImage.id, { x: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="thumb-ui-field">
                  <span>세로 위치</span>
                  <input
                    type="number"
                    disabled={Boolean(selectedImage.locked) || imageCropLayerId === selectedImage.id}
                    value={Math.round(selectedImage.y)}
                    onChange={(e) =>
                      onUpdateImage(selectedImage.id, { y: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="thumb-ui-field">
                  <span>너비 (비율 유지)</span>
                  <input
                    type="number"
                    min={40}
                    disabled={Boolean(selectedImage.locked) || imageCropLayerId === selectedImage.id}
                    value={Math.round(selectedImage.width)}
                    onChange={(e) => {
                      const ratio = selectedImage.width / selectedImage.height || 1
                      const width = Math.max(40, Number(e.target.value) || 40)
                      onUpdateImage(selectedImage.id, {
                        width,
                        height: Math.max(40, Math.round(width / ratio)),
                      })
                    }}
                  />
                </label>
                <label className="thumb-ui-field">
                  <span>높이 (비율 유지)</span>
                  <input
                    type="number"
                    min={40}
                    disabled={Boolean(selectedImage.locked) || imageCropLayerId === selectedImage.id}
                    value={Math.round(selectedImage.height)}
                    onChange={(e) => {
                      const ratio = selectedImage.width / selectedImage.height || 1
                      const height = Math.max(40, Number(e.target.value) || 40)
                      onUpdateImage(selectedImage.id, {
                        height,
                        width: Math.max(40, Math.round(height * ratio)),
                      })
                    }}
                  />
                </label>
                <label className="thumb-ui-field">
                  <span>불투명도</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={selectedImage.opacity}
                    onChange={(e) =>
                      onUpdateImage(selectedImage.id, { opacity: Number(e.target.value) })
                    }
                  />
                </label>
                <ImageGradientMaskControls
                  mask={selectedImage.gradientMask}
                  onChange={(patch) =>
                    onUpdateImage(selectedImage.id, {
                      gradientMask: normalizeImageGradientMask({
                        ...normalizeImageGradientMask(selectedImage.gradientMask),
                        ...patch,
                      }),
                    })
                  }
                />
                <button type="button" className="thumb-ui-btn thumb-ui-btn--ghost" onClick={onDeleteSelected}>
                  삭제
                </button>
              </section>
            ) : null}
          </>
        )}

        {activeTab === 'layers' && (
          <>
            <h3 className="thumb-ui-panel__title">레이어</h3>
            <p className="thumb-ui-hint">
              위에서 아래 순(앞→뒤)입니다. Ctrl/Cmd+클릭 또는 Shift+클릭으로 여러 레이어를 선택할 수 있습니다.
            </p>
            <StudioLayerPanel
              doc={doc}
              selectedLayers={selectedLayers.length > 0 ? selectedLayers : selectedLayer ? [selectedLayer] : []}
              onSelectLayer={onSelectLayer}
              onToggleLayerVisible={onToggleLayerVisible}
            />
          </>
        )}

        {activeTab === 'background' && (
          <>
            <h3 className="thumb-ui-panel__title">배경</h3>
            <section className="thumb-ui-section">
              <p className="thumb-ui-hint">
                <strong>배경</strong>은 맨 뒤 전체 화면, <strong>이미지 추가</strong>는 로고·인물·스티커처럼
                글자 위에 올리는 레이어입니다.
              </p>
              <label className="thumb-ui-btn thumb-ui-btn--outline">
                배경 이미지 업로드
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    onBackgroundFile(e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                />
              </label>
              <label className="thumb-ui-btn thumb-ui-btn--outline">
                + 이미지 추가 (레이어)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = overlayFilesFromInput(e.target.files)
                    onPickOverlayImage(files.length ? files : null)
                    e.target.value = ''
                  }}
                />
              </label>
              <p className="thumb-ui-hint">
                AI 배경 생성은 왼쪽 메뉴 <strong>AI스타일</strong> 탭에서 모델·스타일을 고른 뒤 「배경만 AI
                생성」을 누르세요.
              </p>
            </section>
            {hasBackgroundImage && onUpdateBackgroundGradientMask ? (
              <ImageGradientMaskControls
                mask={backgroundGradientMask}
                onChange={onUpdateBackgroundGradientMask}
              />
            ) : null}
            <section className="thumb-ui-section">
              <h4 className="thumb-ui-section__title">그라데이션 오버레이</h4>
              <p className="thumb-ui-hint">
                배경 사진 위에 깔리고, 글자·스티커·도형보다 아래 레이어입니다.
              </p>
              <Toggle
                label="그라데이션 사용"
                checked={backgroundScrim.enabled}
                onChange={(on) => onUpdateBackgroundScrim({ enabled: on })}
              />
              {backgroundScrim.enabled ? (
                <>
                  <div
                    className="thumb-ui-scrim-preview"
                    style={{ background: buildScrimPreviewCss(backgroundScrim) }}
                    aria-hidden
                  />
                  <label className="thumb-ui-field">
                    <span>방향</span>
                    <select
                      value={backgroundScrim.direction}
                      onChange={(e) =>
                        onUpdateBackgroundScrim({
                          direction: e.target.value as StudioBackgroundScrim['direction'],
                        })
                      }
                    >
                      {SCRIM_DIRECTION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} — {opt.hint}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="thumb-ui-field thumb-ui-field--color">
                    <span>어두운 색</span>
                    <input
                      type="color"
                      value={backgroundScrim.color ?? '#000000'}
                      onChange={(e) => onUpdateBackgroundScrim({ color: e.target.value })}
                    />
                    <input
                      type="text"
                      value={backgroundScrim.color ?? '#000000'}
                      spellCheck={false}
                      onChange={(e) => {
                        const v = e.target.value.trim()
                        if (/^#[0-9a-fA-F]{3}$/.test(v) || /^#[0-9a-fA-F]{6}$/.test(v)) {
                          onUpdateBackgroundScrim({ color: v })
                        }
                      }}
                    />
                  </label>
                  <label className="thumb-ui-field">
                    <span>어두움</span>
                    <div className="thumb-ui-field__inline">
                      <input
                        type="range"
                        min={0.05}
                        max={0.95}
                        step={0.01}
                        value={backgroundScrim.opacity}
                        onChange={(e) =>
                          onUpdateBackgroundScrim({ opacity: Number(e.target.value) })
                        }
                      />
                      <input
                        type="number"
                        className="thumb-ui-field__number"
                        min={5}
                        max={95}
                        step={1}
                        value={Math.round(backgroundScrim.opacity * 100)}
                        onChange={(e) => {
                          const pct = Number(e.target.value)
                          if (!Number.isFinite(pct)) return
                          onUpdateBackgroundScrim({ opacity: pct / 100 })
                        }}
                      />
                      <span className="thumb-ui-field__unit">%</span>
                    </div>
                  </label>
                  <label className="thumb-ui-field">
                    <span>적용 범위</span>
                    <div className="thumb-ui-field__inline">
                      <input
                        type="range"
                        min={0.15}
                        max={1}
                        step={0.01}
                        value={backgroundScrim.extent ?? DEFAULT_BACKGROUND_SCRIM.extent}
                        onChange={(e) =>
                          onUpdateBackgroundScrim({ extent: Number(e.target.value) })
                        }
                      />
                      <input
                        type="number"
                        className="thumb-ui-field__number"
                        min={15}
                        max={100}
                        step={1}
                        value={Math.round((backgroundScrim.extent ?? DEFAULT_BACKGROUND_SCRIM.extent) * 100)}
                        onChange={(e) => {
                          const pct = Number(e.target.value)
                          if (!Number.isFinite(pct)) return
                          onUpdateBackgroundScrim({ extent: pct / 100 })
                        }}
                      />
                      <span className="thumb-ui-field__unit">%</span>
                    </div>
                    <p className="thumb-ui-hint">캔버스 높이(또는 방향 축) 중 그라데이션이 깔리는 비율입니다.</p>
                  </label>
                  <label className="thumb-ui-field">
                    <span>전환 위치</span>
                    <div className="thumb-ui-field__inline">
                      <input
                        type="range"
                        min={0.05}
                        max={0.95}
                        step={0.01}
                        value={backgroundScrim.midpoint ?? DEFAULT_BACKGROUND_SCRIM.midpoint}
                        onChange={(e) =>
                          onUpdateBackgroundScrim({ midpoint: Number(e.target.value) })
                        }
                      />
                      <input
                        type="number"
                        className="thumb-ui-field__number"
                        min={5}
                        max={95}
                        step={1}
                        value={Math.round((backgroundScrim.midpoint ?? DEFAULT_BACKGROUND_SCRIM.midpoint) * 100)}
                        onChange={(e) => {
                          const pct = Number(e.target.value)
                          if (!Number.isFinite(pct)) return
                          onUpdateBackgroundScrim({ midpoint: pct / 100 })
                        }}
                      />
                      <span className="thumb-ui-field__unit">%</span>
                    </div>
                    <p className="thumb-ui-hint">어두운 영역이 축을 따라 얼마나 길게 유지되는지 조절합니다.</p>
                  </label>
                  <label className="thumb-ui-field">
                    <span>페이드</span>
                    <div className="thumb-ui-field__inline">
                      <input
                        type="range"
                        min={0.05}
                        max={1}
                        step={0.01}
                        value={backgroundScrim.feather ?? DEFAULT_BACKGROUND_SCRIM.feather}
                        onChange={(e) =>
                          onUpdateBackgroundScrim({ feather: Number(e.target.value) })
                        }
                      />
                      <input
                        type="number"
                        className="thumb-ui-field__number"
                        min={5}
                        max={100}
                        step={1}
                        value={Math.round((backgroundScrim.feather ?? DEFAULT_BACKGROUND_SCRIM.feather) * 100)}
                        onChange={(e) => {
                          const pct = Number(e.target.value)
                          if (!Number.isFinite(pct)) return
                          onUpdateBackgroundScrim({ feather: pct / 100 })
                        }}
                      />
                      <span className="thumb-ui-field__unit">%</span>
                    </div>
                    <p className="thumb-ui-hint">낮을수록 어두운 쪽에 집중, 높을수록 부드럽게 퍼집니다.</p>
                  </label>
                </>
              ) : null}
            </section>
            {hasBackgroundImage && backgroundLayout && onUpdateBackgroundLayout ? (
              <section className="thumb-ui-section">
                <h4 className="thumb-ui-section__title">배경 위치·크기</h4>
                {onBackgroundLockedChange ? (
                  <Toggle
                    checked={Boolean(backgroundLocked)}
                    onChange={onBackgroundLockedChange}
                    label="배경 위치·크기 고정"
                  />
                ) : null}
                {onBackgroundFlipXChange ? (
                  <button
                    type="button"
                    className={
                      backgroundFlipX
                        ? 'thumb-ui-btn thumb-ui-btn--ghost thumb-ui-btn--on'
                        : 'thumb-ui-btn thumb-ui-btn--ghost'
                    }
                    onClick={() => onBackgroundFlipXChange(!backgroundFlipX)}
                  >
                    좌우 반전
                  </button>
                ) : null}
                <p className="thumb-ui-hint">
                  {backgroundLocked
                    ? '배경이 고정됨 — 드래그·크기 조절이 비활성화됩니다.'
                    : '캔버스에서 배경을 클릭한 뒤 드래그·모서리로 조절하세요. 크기는 비율이 유지됩니다.'}
                </p>
                <label className="thumb-ui-field">
                  <span>가로 위치</span>
                  <input
                    type="number"
                    disabled={Boolean(backgroundLocked)}
                    value={Math.round(backgroundLayout.x)}
                    onChange={(e) =>
                      onUpdateBackgroundLayout({
                        ...backgroundLayout,
                        x: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="thumb-ui-field">
                  <span>세로 위치</span>
                  <input
                    type="number"
                    disabled={Boolean(backgroundLocked)}
                    value={Math.round(backgroundLayout.y)}
                    onChange={(e) =>
                      onUpdateBackgroundLayout({
                        ...backgroundLayout,
                        y: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="thumb-ui-field">
                  <span>너비 (비율 유지)</span>
                  <input
                    type="number"
                    min={80}
                    disabled={Boolean(backgroundLocked)}
                    value={Math.round(backgroundLayout.width)}
                    onChange={(e) => {
                      const ratio = backgroundLayout.width / backgroundLayout.height || 1
                      const width = Math.max(80, Number(e.target.value) || 80)
                      onUpdateBackgroundLayout({
                        ...backgroundLayout,
                        width,
                        height: Math.max(80, Math.round(width / ratio)),
                      })
                    }}
                  />
                </label>
                <label className="thumb-ui-field">
                  <span>높이 (비율 유지)</span>
                  <input
                    type="number"
                    min={80}
                    disabled={Boolean(backgroundLocked)}
                    value={Math.round(backgroundLayout.height)}
                    onChange={(e) => {
                      const ratio = backgroundLayout.width / backgroundLayout.height || 1
                      const height = Math.max(80, Number(e.target.value) || 80)
                      onUpdateBackgroundLayout({
                        ...backgroundLayout,
                        height,
                        width: Math.max(80, Math.round(height * ratio)),
                      })
                    }}
                  />
                </label>
              </section>
            ) : null}
          </>
        )}

        {activeTab === 'bgAiStyle' && (
          <>
            <h3 className="thumb-ui-panel__title">AI 배경 스타일</h3>
            <p className="thumb-ui-hint">
              「배경만 AI 생성」 전에 이미지 모델·스타일·지역 풍을 설정합니다. 프로젝트에 저장되며, AI
              이미지(씬) 기본값과 같게 시작합니다.
            </p>
            <ThumbnailGenStyleSelectionSummary settings={thumbGenSettings} />
            <div className="thumb-ui-bg-ai-style">
              <ThumbnailGenSettingsBar
                settings={thumbGenSettings}
                onChange={onThumbGenSettingsChange}
                disabled={genSettingsDisabled || bgOnlyBusy || genBusy}
                topicStyleRec={topicStyleRec}
                embedded
              />
            </div>
            <section className="thumb-ui-section">
              <label className="thumb-ui-field">
                <span>AI 추가 지시 (선택)</span>
                <input
                  type="text"
                  value={extraBgHint}
                  onChange={(e) => onExtraBgHintChange(e.target.value)}
                  placeholder="인물은 오른쪽, 텍스트 없음"
                  disabled={bgOnlyBusy || genBusy}
                />
              </label>
              <button
                type="button"
                className="thumb-ui-btn thumb-ui-btn--primary"
                disabled={bgOnlyBusy || genBusy || genSettingsDisabled}
                onClick={onRegenerateBg}
              >
                {bgOnlyBusy ? '생성 중…' : '배경만 AI 생성'}
              </button>
            </section>
          </>
        )}

        {activeTab === 'ai' && (
          <>
            <h3 className="thumb-ui-panel__title">AI 편집</h3>
            {onSaveVariant && onGenerateVariantAi && onApplyVariant && onRemoveVariant ? (
              <ThumbnailVariantTray
                variants={variants}
                activeVariantId={activeVariantId}
                busy={variantBusy}
                onSaveCurrent={onSaveVariant}
                onGenerateAi={onGenerateVariantAi}
                onApply={onApplyVariant}
                onRemove={onRemoveVariant}
              />
            ) : null}
            <ThumbnailTabLanguagePicker
              variant="sidebar"
              appliedLanguage={outputLanguage}
              onApply={onApplyOutputLanguage}
              disabled={genBusy || bgOnlyBusy || textOnlyBusy || verifyBusy}
              applyBusy={languageApplyBusy}
            />
            <section className="thumb-ui-section thumb-ui-section--verify">
              <p className="thumb-ui-section__label">검증 단계</p>
              {onVerifyThumbnail ? (
                <button
                  type="button"
                  className="thumb-ui-btn thumb-ui-btn--verify"
                  disabled={
                    verifyBusy || genBusy || bgOnlyBusy || textOnlyBusy || layoutFitBusy
                  }
                  onClick={onVerifyThumbnail}
                >
                  {verifyBusy ? '검증 분석 중…' : '🔍 썸네일 CTR 검증'}
                </button>
              ) : null}
              <p className="thumb-ui-hint">
                썸네일을 만든 뒤 실행하세요. AI가 강점·보완점·후킹·사진 품질을 화살표로 분석해
                리포트 팝업을 띄웁니다.
              </p>
            </section>
            <section className="thumb-ui-section">
              <button
                type="button"
                className="thumb-ui-btn thumb-ui-btn--primary"
                disabled={genBusy || bgOnlyBusy || textOnlyBusy || verifyBusy}
                onClick={onGenerateFull}
              >
                {genBusy ? '생성 중…' : '✨ 배경 AI 생성'}
              </button>
              <p className="thumb-ui-hint">배경만 생성합니다. 문구는 아래 「문구만 AI 재생성」을 사용하세요.</p>
              <button
                type="button"
                className="thumb-ui-btn thumb-ui-btn--outline"
                disabled={textOnlyBusy || genBusy || verifyBusy}
                onClick={onRegenerateText}
              >
                {textOnlyBusy ? '문구 생성 중…' : '문구만 AI 재생성'}
              </button>
              {onFitTextToBackground ? (
                <button
                  type="button"
                  className="thumb-ui-btn thumb-ui-btn--outline"
                  disabled={
                    layoutFitBusy ||
                    genBusy ||
                    bgOnlyBusy ||
                    textOnlyBusy ||
                    verifyBusy ||
                    !hasBackgroundImage
                  }
                  onClick={onFitTextToBackground}
                >
                  {layoutFitBusy ? '배치 분석 중…' : '배경에 맞춰 문구 배치'}
                </button>
              ) : null}
              <button
                type="button"
                className="thumb-ui-btn thumb-ui-btn--ghost"
                onClick={onClearCanvas}
              >
                템플릿 초기화
              </button>
              <p className="thumb-ui-hint">
                배경에 맞춰 문구 배치: 현재 사진·AI 배경을 보고 글자 크기·위치를 자동 조정합니다.
                템플릿 초기화: 캔버스 전체를 비웁니다.
              </p>
            </section>

            {onBenchmarkFile ? (
              <section className="thumb-ui-section">
                <h4 className="thumb-ui-section__title">벤치마크 참고 (Canva 스타일)</h4>
                <p className="thumb-ui-hint">
                  잘 된 썸네일을 업로드하세요. <strong>참고 리믹스</strong>는 글자를 제거한 배경(인물은 살짝 다르게·흰 테두리)을
                  만들고, 원본 문구를 바탕으로 하단 2줄 카피를 생성합니다.
                </p>
                <label className="thumb-ui-btn thumb-ui-btn--outline">
                  {benchmarkBusy ? '분석 중…' : '벤치마크 썸네일 업로드'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    disabled={benchmarkBusy || benchmarkRemixBusy}
                    onChange={(e) => {
                      onBenchmarkFile(e.target.files?.[0] ?? null)
                      e.target.value = ''
                    }}
                  />
                </label>
                {benchmarkSourceFileName ? (
                  <p className="thumb-ui-hint" style={{ marginTop: 8 }}>
                    선택됨: {benchmarkSourceFileName}
                  </p>
                ) : null}
                {onBenchmarkRemix ? (
                  <button
                    type="button"
                    className="thumb-ui-btn thumb-ui-btn--primary"
                    style={{ marginTop: 8 }}
                    disabled={
                      benchmarkRemixBusy ||
                      benchmarkBusy ||
                      genBusy ||
                      bgOnlyBusy ||
                      textOnlyBusy ||
                      verifyBusy ||
                      !benchmarkSourceFileName
                    }
                    onClick={onBenchmarkRemix}
                  >
                    {benchmarkRemixBusy ? '리믹스 생성 중…' : '✦ 참고 리믹스 (배경·하단 2줄)'}
                  </button>
                ) : null}
                {analyzedBenchmarkStyle ? (
                  <>
                    <textarea
                      className="thumb-ui-textarea thumb-ui-textarea--compact"
                      rows={4}
                      readOnly
                      value={analyzedBenchmarkStyle}
                      aria-label="벤치마크 스타일 분석"
                    />
                    {onClearBenchmark ? (
                      <button
                        type="button"
                        className="thumb-ui-btn thumb-ui-btn--ghost"
                        onClick={onClearBenchmark}
                      >
                        벤치마크 분석 지우기
                      </button>
                    ) : null}
                  </>
                ) : null}
              </section>
            ) : null}

            {onApplyBgMood ? (
              <section className="thumb-ui-section">
                <h4 className="thumb-ui-section__title">배경 무드 프리셋</h4>
                <p className="thumb-ui-hint">원클릭으로 AI 배경 지시를 채웁니다. 선택 후 「배경 AI 생성」을 누르세요.</p>
                <div className="thumb-ui-mood-grid">
                  {BG_MOOD_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="thumb-ui-mood-chip"
                      disabled={genBusy || bgOnlyBusy}
                      onClick={() => onApplyBgMood(preset.hint)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {onGenerateHookSuggestions || onRewriteTextPreset ? (
              <section className="thumb-ui-section">
                <h4 className="thumb-ui-section__title">Magic Write</h4>
                <p className="thumb-ui-hint">
                  대본 기반 한 줄 훅 후보 또는 선택 문구 톤 변경. 문구를 선택한 뒤 톤 버튼을 누르세요.
                </p>
                {onGenerateHookSuggestions ? (
                  <button
                    type="button"
                    className="thumb-ui-btn thumb-ui-btn--outline"
                    disabled={hookBusy || textOnlyBusy || textRewriteBusy}
                    onClick={onGenerateHookSuggestions}
                  >
                    {hookBusy ? '훅 생성 중…' : '✦ 훅 후보 5개 생성'}
                  </button>
                ) : null}
                {hookSuggestions.length ? (
                  <div className="thumb-ui-hook-list">
                    {hookSuggestions.map((hook) => (
                      <button
                        key={hook}
                        type="button"
                        className="thumb-ui-hook-item"
                        disabled={!onApplyHookSuggestion}
                        onClick={() => onApplyHookSuggestion?.(hook)}
                      >
                        {hook}
                      </button>
                    ))}
                  </div>
                ) : null}
                {onRewriteTextPreset && selectedText ? (
                  <div className="thumb-ui-rewrite-grid">
                    {THUMBNAIL_TEXT_REWRITE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="thumb-ui-rewrite-chip"
                        disabled={textRewriteBusy}
                        onClick={() => onRewriteTextPreset(preset.id)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                ) : selectedText ? null : (
                  <p className="thumb-ui-hint">톤 변경: 캔버스에서 문구를 선택하세요.</p>
                )}
              </section>
            ) : null}

            {onExtractPalette || onMagicEnhance || onAutoTextContrast ? (
              <section className="thumb-ui-section">
                <h4 className="thumb-ui-section__title">Magic Design</h4>
                <p className="thumb-ui-hint">배경에서 색 추출·화질 보정·글자 가독성 자동 조정 (API 불필요).</p>
                {onExtractPalette ? (
                  <button
                    type="button"
                    className="thumb-ui-btn thumb-ui-btn--outline"
                    disabled={paletteBusy || !hasBackgroundImage}
                    onClick={onExtractPalette}
                  >
                    {paletteBusy ? '색 추출 중…' : '🎨 배경에서 색 팔레트 추출'}
                  </button>
                ) : null}
                {extractedPalette.length && onApplyPaletteColor ? (
                  <div className="thumb-ui-palette-row">
                    {extractedPalette.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        className="thumb-ui-palette-swatch"
                        style={{ background: hex }}
                        title={`${hex} — 클릭하면 ${selectedText ? '선택 문구' : '모든 문구'}에 적용`}
                        onClick={() => onApplyPaletteColor(hex, selectedText ? 'selected' : 'all')}
                      />
                    ))}
                  </div>
                ) : null}
                {onMagicEnhance ? (
                  <button
                    type="button"
                    className="thumb-ui-btn thumb-ui-btn--outline"
                    disabled={magicEnhanceBusy || !hasBackgroundImage}
                    onClick={onMagicEnhance}
                  >
                    {magicEnhanceBusy ? '보정 중…' : '✨ Magic Enhance (밝기·대비)'}
                  </button>
                ) : null}
                {onAutoTextContrast ? (
                  <button
                    type="button"
                    className="thumb-ui-btn thumb-ui-btn--outline"
                    disabled={autoContrastBusy || !hasBackgroundImage}
                    onClick={onAutoTextContrast}
                  >
                    {autoContrastBusy ? '분석 중…' : 'Aa 가독성 자동 (색·테두리)'}
                  </button>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

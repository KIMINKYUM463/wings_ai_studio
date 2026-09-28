'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { saveProjectThumbnail } from '@/lib/longform-v2/thumbnail-bridge/mediaApi'
import { getSceneImages } from '@/lib/longform-v2/thumbnail-bridge/sceneGenerationApi'
import { useRegisterStepToolbarSave, type StepToolbarSaveBinder } from '@/lib/longform-v2/thumbnail-bridge/useRegisterStepToolbarSave'
import type { TextItem } from './YoutubeThumbnailManualEditor'
import { ThumbnailStudioSidebar, type StudioSidebarTab } from './components/ThumbnailStudioSidebar'
import { useTopicStyleRecommendations } from '@/lib/longform-v2/thumbnail-bridge/useTopicStyleRecommendations'
import { TemplateReferencePanel } from './components/TemplateReferencePanel'
import { ThumbnailFeedPreviewModal } from './components/ThumbnailFeedPreviewModal'
import { ThumbnailTextCoordLog } from './components/ThumbnailTextCoordLog'
import { ThumbnailJpegDownloadSavedPanel } from './ThumbnailJpegDownloadSavedPanel'
import { ThumbnailTemplatePickerModal } from './components/ThumbnailTemplatePickerModal'
import { CustomTemplateEditorModal } from './components/CustomTemplateEditorModal'
import {
  ThumbnailStudioAiOverlay,
  resolveThumbnailAiOverlayPhase,
} from './components/ThumbnailStudioAiOverlay'
import { applyTextStylePresetToItem } from '@/lib/longform-v2/thumbnailTemplateStudio/textStylePresets'
import { DEFAULT_PRO_TEMPLATE_ID, getProTemplate } from '@/lib/longform-v2/thumbnailTemplateStudio/catalog'
import {
  getCustomTemplate,
  isCustomTemplateId,
  upsertCustomTemplate,
} from '@/lib/longform-v2/thumbnailTemplateStudio/customTemplateStorage'
import { buildCustomTemplateFromDocument } from '@/lib/longform-v2/thumbnailTemplateStudio/customTemplateFromDocument'
import { resolveExportFrame } from '@/lib/longform-v2/thumbnailTemplateStudio/exportFrame'
import {
  applyDragLiveOverlay,
  buildMultiMoveSnapshot,
  cloneStudioDocument,
  deleteStudioLayers,
  extractLayersForClipboard,
  nudgeStudioLayers,
  offsetShapeLayer,
  pasteStudioLayerClipboard,
  updateExportFrame,
  updateImageLayer,
  updateOverlayLayer,
  updateShapeLayer,
  type DragLiveOverlay,
  type StudioLayerClipboard,
} from '@/lib/longform-v2/thumbnailTemplateStudio/documentOps'
import {
  applyLayerClickSelection,
  drawableSelectedLayers,
  isStudioLayerRefSelected,
  primaryStudioLayerRef,
} from '@/lib/longform-v2/thumbnailTemplateStudio/layerSelection'
import {
  reorderStudioLayer,
  type StudioLayerReorderOp,
} from '@/lib/longform-v2/thumbnailTemplateStudio/layerOrder'
import {
  applyTemplateToDocument,
  applyTemplateToDocumentWithPreview,
  addSubCopyAsTextLayerToDocument,
  resolveTemplateSlotTexts,
  clearStudioCanvas,
  createEmptyStudioDocument,
  fillBackgroundImage,
  normalizeBackgroundScrim,
  updateBackgroundLayout,
  updateBackgroundScrim,
  updateBackgroundGradientMask,
} from '@/lib/longform-v2/thumbnailTemplateStudio/document'
import {
  coverLayoutForImageSource,
  ensureBackgroundCoverLayout,
  hitTestBounds,
  hitTestResizeHandle,
  isCornerResizeHandle,
  resolveStudioBackgroundLayout,
  resizeBoundsProportional,
  resizeBoundsWithHandle,
  resizeTextLayerWithHandle,
  type LayerBounds,
  type ResizeHandleId,
  type TextResizeAnchor,
} from '@/lib/longform-v2/thumbnailTemplateStudio/studioTransform'
import {
  applyCommittedImageCrop,
  cropToCanvasBounds,
  fullImageCanvasBounds,
  fullImageCrop,
  moveSourceCropOnCanvas,
  resolveImageLayerCrop,
  resizeSourceCropOnCanvas,
  type StudioImageCrop,
} from '@/lib/longform-v2/thumbnailTemplateStudio/imageLayerCrop'
import {
  getLayerRotateHandlePosition,
  hitTestLayerRotateHandle,
  imageLayerBounds,
  layerPivot,
  pointerToLocal,
  rotationFromPointerDrag,
} from '@/lib/longform-v2/thumbnailTemplateStudio/layerRotation'
import {
  applyShapeBoundsResize,
  applyShapeDragMove,
  createDefaultShape,
  createShapeFromPreset,
  getShapeRotateHandlePosition,
  hitTestShapeRotateHandle,
  hitTestTopOverlayLayer,
  shapeUnrotatedBounds,
  studioMaxZIndex,
  type StudioShapeKind,
  type StudioShapeLayer,
} from '@/lib/longform-v2/thumbnailTemplateStudio/shapeLayers'
import {
  createOverlayFromPreset,
  defaultOverlayZIndex,
  type StudioOverlayPresetId,
} from '@/lib/longform-v2/thumbnailTemplateStudio/overlayLayers'
import {
  buildArrowStickerImageLayer,
  fetchStudioArrowStickerDataUrl,
} from '@/lib/longform-v2/thumbnailTemplateStudio/studioStickers'
import { buildFallbackTemplateStyleSpec } from '@/lib/longform-v2/thumbnailTemplateStudio/fallbackStyle'
import { analyzeTemplatePreviewStyle } from '@/lib/longform-v2/thumbnailTemplateStudio/templateStyleAnalyze'
import { canonicalTemplateStyleSpec } from '@/lib/longform-v2/thumbnailTemplateStudio/templateLayout'
import { loadThumbnailStudioDraft } from '@/lib/longform-v2/thumbnailTemplateStudio/draft'
import { flushStudioDocumentPersist } from '@/lib/longform-v2/thumbnailTemplateStudio/draftPersist'
import { normalizeImageGradientMask } from '@/lib/longform-v2/thumbnailTemplateStudio/imageGradientMask'
import { loadStudioDocumentForProject } from '@/lib/longform-v2/thumbnailTemplateStudio/loadStudioDocument'
import { resolveStudioAssetUrl, resolveStudioAssetUrlWithCache } from '@/lib/longform-v2/thumbnailTemplateStudio/studioAssetUrl'
import { fitStudioTextLayoutToBackground } from '@/lib/longform-v2/thumbnailTemplateStudio/backgroundTextLayout'
import { ensureThumbnailCopyFullyVisible } from '@/lib/longform-v2/thumbnailTemplateStudio/textLayoutScale'
import { templateHasLinkedHookHighlight } from '@/lib/longform-v2/thumbnailTemplateStudio/copyLinkGroups'
import { regenerateThumbnailTextLayerFromScript } from '@/lib/longform-v2/thumbnailTemplateStudio/copywriter'
import { rewriteThumbnailTextLayer } from '@/lib/longform-v2/thumbnailTemplateStudio/textRewrite'
import { resolveScriptForThumbnailOutputLanguage } from '@/lib/longform-v2/thumbnailTemplateStudio/scriptForOutputLanguage'
import {
  createWatermarkTextLayer,
  WATERMARK_PRESETS,
  type WatermarkPresetId,
} from '@/lib/longform-v2/thumbnailTemplateStudio/watermarkPresets'
import {
  nextVariantLabel,
  pushStudioVariant,
  type ThumbnailStudioVariant,
} from '@/lib/longform-v2/thumbnailTemplateStudio/studioVariants'
import { THUMBNAIL_TEXT_REWRITE_PRESETS } from '@/lib/longform-v2/youtube/thumbnailTextRewrite'
import type { ThumbnailTextRewritePresetId } from '@/lib/longform-v2/youtube/thumbnailTextRewrite'
/** 버전 2 전용 — v1(`project-detail/YoutubeThumbnailTemplateStudio`)과 분리 */
import {
  generateStudioLayersFromTemplate,
  generateStudioOnTemplateSelect,
  regenerateStudioBackgroundOnly,
  regenerateStudioTextOnly,
  applyStudioTabOutputLanguage,
} from '@/lib/longform-v2/thumbnailTemplateStudio/v2/generateStudioV2'
import {
  loadThumbnailGenSettings,
  resolveSceneCustomStylePromptFromPayload,
  resolveThumbnailGenSettingsFromScenePayload,
  resolveThumbnailCustomStylePrompt,
  saveThumbnailGenSettings,
  thumbnailImageStyleHint,
  thumbnailStyleApiPayload,
  type ThumbnailGenSettings,
} from '@/lib/longform-v2/thumbnailTemplateStudio/thumbnailGenSettings'
import {
  renderStudioDocument,
  textItemToBounds,
  type ImageCropEditState,
  type StudioRenderAssets,
} from '@/lib/longform-v2/thumbnailTemplateStudio/render'
import {
  buildStudioRenderAssetsForExport,
  exportStudioDocumentToBlob,
} from '@/lib/longform-v2/thumbnailTemplateStudio/studioExport'
import {
  charIndexFromPointer,
  getTextRotateHandlePosition,
  hitTestTextOrientedBody,
  hitTestTextOrientedResizeHandle,
  hitTestTextRotateHandle,
  measureTextMetrics,
  patchTextAlignPreservingBounds,
  pointerToTextLocal,
} from '@/lib/longform-v2/thumbnailTemplateStudio/textGeometry'
import {
  patchTextFillColor,
} from '@/lib/longform-v2/thumbnailTemplateStudio/textFillSelection'
import { useStudioHistory } from '@/lib/longform-v2/thumbnailTemplateStudio/useStudioHistory'
import type { StudioLayerRef, StudioImageLayer, ThumbnailStudioDocument } from '@/lib/longform-v2/thumbnailTemplateStudio/types'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W, STUDIO_EDIT_BLEED, STUDIO_EDIT_CANVAS_H, STUDIO_EDIT_CANVAS_W, DEFAULT_THUMBNAIL_TEXT_STROKE_WIDTH } from '@/lib/longform-v2/thumbnailTemplateStudio/types'
import { postOpenProjectDataFolder, postOpenProjectSavedPath } from '@/lib/longform-v2/thumbnail-bridge/projectDataFolderApi'
import {
  deleteThumbnailStudioSavedWork,
  fetchThumbnailStudioSavedWorkDocument,
  fetchThumbnailStudioSavedWorks,
  saveThumbnailStudioSavedWork,
  type ThumbnailStudioSavedWorkMeta,
} from '@/lib/longform-v2/thumbnail-bridge/thumbnailStudioSavedWorksApi'
import {
  fetchThumbnailStudioTabs,
  saveThumbnailStudioTabsBestEffort,
} from '@/lib/longform-v2/thumbnail-bridge/thumbnailStudioTabsApi'
import {
  applyExternalizedAssetsFromSaveResponse,
  createStudioTab,
  duplicateStudioTab,
  duplicateStudioTabLabelForLanguage,
  loadStudioTabsSessionLocal,
  normalizeStudioTab,
  promoteSaveResponseIntoDocument,
  saveStudioTabsSessionLocal,
} from '@/lib/longform-v2/thumbnailTemplateStudio/studioTabsSession'
import type { ThumbnailStudioTab } from '@/lib/longform-v2/thumbnailTemplateStudio/studioTabsTypes'
import { defaultStudioTabLabel, MAX_STUDIO_TABS } from '@/lib/longform-v2/thumbnailTemplateStudio/studioTabsTypes'
import { normalizeTabOutputLanguage, THUMBNAIL_TAB_OUTPUT_LANGUAGE_OPTIONS } from '@/lib/longform-v2/thumbnailTemplateStudio/studioTabOutputLanguage'
import { ThumbnailStudioTabBar } from './components/ThumbnailStudioTabBar'
import {
  formatBlobDownloadSavedMessage,
  downloadStudioTabBlobs,
  triggerBlobDownload,
  type TriggerBlobDownloadResult,
} from '@/lib/longform-v2/thumbnail-bridge/thumbnailDownload'
import { openDownloadsFolder } from '@/lib/longform-v2/thumbnail-bridge/openDownloadsFolder'
import { extractPaletteFromImage } from '@/lib/longform-v2/thumbnailTemplateStudio/magicColors'
import { enhanceBackgroundImage } from '@/lib/longform-v2/thumbnailTemplateStudio/magicEnhance'
import {
  applyPaletteToTextLayers,
  applySmartTextContrast,
} from '@/lib/longform-v2/thumbnailTemplateStudio/smartTextContrast'
import { getElementPreset, resolveStickerSubject } from '@/lib/longform-v2/thumbnailTemplateStudio/elementPresets'
import {
  buildElementStickerImageLayer,
  fetchElementStickerCached,
  fetchElementStickerDataUrl,
} from '@/lib/longform-v2/thumbnailTemplateStudio/elementStickers'

import '../styles/thumbnail-template-studio.css'
import '../styles/thumbnail-verification.css'
import { postThumbnailVerify, postThumbnailBenchmarkAnalyze, postThumbnailHookSuggestions, postThumbnailReferenceRemix, fetchUrlAsBase64 } from '@/lib/longform-v2/thumbnail-bridge/thumbnailAiApi'
import type { ThumbnailVerificationReport } from '@/lib/longform-v2/youtube/thumbnailVerification'
import { improveStudioFromVerificationReport } from '@/lib/longform-v2/thumbnailTemplateStudio/verificationImprove'
import { ThumbnailVerificationModal } from './components/ThumbnailVerificationModal'
import { ThumbnailCopyResearchModal } from './components/ThumbnailCopyResearchModal'
import { CopyResearchReferencePanel } from './components/CopyResearchReferencePanel'
import { CopyComboReferencePanel } from './components/CopyComboReferencePanel'
import {
  loadCopyResearchSession,
  saveCopyResearchSession,
  type ThumbnailCopyResearchSession,
} from '@/lib/longform-v2/thumbnailTemplateStudio/copyResearchStorage'
import type { ThumbnailCopyCombo } from '@/lib/longform-v2/youtube/thumbnailCopyCombos'
import { subCopyToReplacement, type ThumbnailSubCopy } from '@/lib/longform-v2/youtube/thumbnailSubCopy'
import {
  applyCopyComboToDocument,
  applySlotReplacementsToDocument,
  resolveSubCopySlotSpec,
  resolveTwoLineCopySlotSpec,
} from '@/lib/longform-v2/thumbnailTemplateStudio/document'
import { postThumbnailSubCopies } from '@/lib/longform-v2/thumbnail-bridge/thumbnailCopyResearchApi'

import {
  DEFAULT_THUMBNAIL_FONT_STACK,
  ensureBundledFontsLoaded,
} from '@/lib/longform-v2/thumbnail-bridge/bundledFonts'
import { resolveTextTypography, splitTextLines } from '@/lib/longform-v2/thumbnailTemplateStudio/textTypography'

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `stl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function fileToBase64Parts(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const dataUrl = r.result as string
      const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
      if (!m) {
        reject(new Error('이미지 인코딩 실패'))
        return
      }
      resolve({ mimeType: m[1], base64: m[2] })
    }
    r.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'))
    r.readAsDataURL(file)
  })
}

/** 캔버스 strokeText 느낌 — textarea 에서 WebkitTextStroke 대신 사용 */
function inlineEditTextShadow(item: TextItem, fontSizePx: number): string | undefined {
  if (item.strokeWidth <= 0) return undefined
  const w = Math.max(1, Math.round(item.strokeWidth * (fontSizePx / item.fontSize)))
  const s = item.stroke
  return [
    `${w}px 0 0 ${s}`,
    `-${w}px 0 0 ${s}`,
    `0 ${w}px 0 ${s}`,
    `0 -${w}px 0 ${s}`,
    `${w}px ${w}px 0 ${s}`,
    `-${w}px -${w}px 0 ${s}`,
    `${w}px -${w}px 0 ${s}`,
    `-${w}px ${w}px 0 ${s}`,
  ].join(', ')
}

function hitTestText(
  ctx: CanvasRenderingContext2D,
  items: TextItem[],
  px: number,
  py: number,
): TextItem | null {
  const sorted = [...items].filter((t) => t.text.trim() && t.visible !== false).sort((a, b) => b.zIndex - a.zIndex)
  for (const t of sorted) {
    if (hitTestTextOrientedBody(ctx, t, px, py)) return t
  }
  return null
}

function migrateLegacyTemplateId(doc: ThumbnailStudioDocument): ThumbnailStudioDocument {
  if (doc.templateId === 'study_hook_right') {
    return { ...doc, templateId: 'historical_hook_right', templateStyle: undefined }
  }
  return doc
}

function normalizeStudioDocument(doc: ThumbnailStudioDocument): ThumbnailStudioDocument {
  const migrated = migrateLegacyTemplateId(doc)
  let next: ThumbnailStudioDocument = {
    ...migrated,
    shapeLayers: migrated.shapeLayers ?? [],
    overlayLayers: migrated.overlayLayers ?? [],
    background: {
      ...migrated.background,
      scrim: normalizeBackgroundScrim(migrated.background.scrim),
    },
  }
  if (next.templateStyle && getProTemplate(next.templateId)) {
    const canonical = canonicalTemplateStyleSpec(next.templateId, next.templateStyle)
    if (canonical) next = { ...next, templateStyle: canonical }
  }
  return next
}

function resolveTabDocumentUrls(document: ThumbnailStudioDocument): ThumbnailStudioDocument {
  return {
    ...document,
    background: {
      ...document.background,
      imageDataUrl: resolveStudioAssetUrl(document.background.imageDataUrl),
    },
    imageLayers: document.imageLayers.map((layer) => ({
      ...layer,
      imageDataUrl: resolveStudioAssetUrl(layer.imageDataUrl) ?? layer.imageDataUrl,
    })),
  }
}

function mergeActiveTabDocument(
  tabs: ThumbnailStudioTab[],
  activeTabId: string,
  document: ThumbnailStudioDocument,
  patch?: Partial<Pick<ThumbnailStudioTab, 'label' | 'previewUrl' | 'savedWorkId'>>,
): ThumbnailStudioTab[] {
  return tabs.map((t) =>
    t.id === activeTabId
      ? { ...t, document: cloneStudioDocument(document), ...patch }
      : t,
  )
}

function labelForTabDoc(doc: ThumbnailStudioDocument, index: number): string {
  const tpl = getProTemplate(doc.templateId)
  if (tpl?.label) return tpl.label
  if (isCustomTemplateId(doc.templateId)) {
    const custom = getCustomTemplate(doc.templateId)
    if (custom?.label) return custom.label
  }
  return defaultStudioTabLabel(index + 1)
}

function bootstrapStudioDocument(projectId: string): ThumbnailStudioDocument {
  const draft = loadThumbnailStudioDraft(projectId)
  if (draft?.document) {
    const migrated = normalizeStudioDocument(draft.document)
    if (getProTemplate(migrated.templateId)) return migrated
    const texts = draft.document.textLayers.map((t) => t.text)
    return applyTemplateToDocument(
      createEmptyStudioDocument(DEFAULT_PRO_TEMPLATE_ID),
      DEFAULT_PRO_TEMPLATE_ID,
      texts,
    )
  }
  return createEmptyStudioDocument(DEFAULT_PRO_TEMPLATE_ID)
}

async function hydrateStudioDocumentFromStorage(projectId: string): Promise<ThumbnailStudioDocument> {
  const loaded = await loadStudioDocumentForProject(projectId)
  return normalizeStudioDocument(loaded)
}

type MultiMoveSnapshot = ReturnType<typeof buildMultiMoveSnapshot>

type ImageCropSession = {
  layerId: string
  anchorLayer: StudioImageLayer
  fullCanvas: LayerBounds
  crop: StudioImageCrop
  imgW: number
  imgH: number
}

type DragState =
  | { kind: 'text'; id: string; ox: number; oy: number; startX: number; startY: number; multi?: MultiMoveSnapshot }
  | { kind: 'image'; id: string; ox: number; oy: number; startX: number; startY: number; multi?: MultiMoveSnapshot }
  | { kind: 'background'; ox: number; oy: number; startX: number; startY: number }
  | {
      kind: 'resize-image'
      id: string
      handle: ResizeHandleId
      anchor: LayerBounds
      startX: number
      startY: number
    }
  | {
      kind: 'resize-image-crop'
      id: string
      handle: ResizeHandleId
      anchorCrop: StudioImageCrop
      anchorCropCanvas: LayerBounds
      fullCanvas: LayerBounds
      layerAnchor: LayerBounds
      rotation: number
      imgW: number
      imgH: number
    }
  | {
      kind: 'move-image-crop'
      id: string
      anchorCrop: StudioImageCrop
      anchorCropCanvas: LayerBounds
      fullCanvas: LayerBounds
      layerAnchor: LayerBounds
      rotation: number
      imgW: number
      imgH: number
      startLocalX: number
      startLocalY: number
    }
  | {
      kind: 'resize-background'
      handle: ResizeHandleId
      anchor: LayerBounds
      startX: number
      startY: number
    }
  | {
      kind: 'resize-text'
      id: string
      handle: ResizeHandleId
      textAnchor: TextResizeAnchor
      pivotX: number
      pivotY: number
      rotation: number
      startX: number
      startY: number
    }
  | {
      kind: 'rotate-text'
      id: string
      pivotX: number
      pivotY: number
      startRotation: number
      startPointerX: number
      startPointerY: number
    }
  | {
      kind: 'shape-line'
      id: string
      part: 'start' | 'end' | 'move'
      startPx: number
      startPy: number
      origin: StudioShapeLayer
    }
  | {
      kind: 'shape-move'
      id: string
      startPx: number
      startPy: number
      origin: StudioShapeLayer
      multi?: MultiMoveSnapshot
    }
  | {
      kind: 'resize-shape'
      id: string
      handle: ResizeHandleId
      anchor: LayerBounds
      startX: number
      startY: number
      rotation: number
    }
  | {
      kind: 'rotate-shape'
      id: string
      pivotX: number
      pivotY: number
      startRotation: number
      startPointerX: number
      startPointerY: number
    }
  | {
      kind: 'rotate-image'
      id: string
      pivotX: number
      pivotY: number
      startRotation: number
      startPointerX: number
      startPointerY: number
    }
  | {
      kind: 'text-fill-select'
      id: string
      anchor: number
      start: number
      end: number
    }

export type YoutubeThumbnailTemplateStudioProps = {
  projectId: string
  topic: string
  script: string
  titleHint?: string
  downloadFileBaseName?: string
  thumbnailOutputLanguage?: string
  scriptByLanguage?: Record<string, string> | null
  /** `modal` — 전체 화면 팝업 안에서 사용 (캔바형) */
  layout?: 'inline' | 'modal'
  bindStepToolbarSave?: StepToolbarSaveBinder
  /** 모달 닫기 시 자동 저장에 연결 */
  bindModalCloseSave?: StepToolbarSaveBinder
  onDirtyChange?: (dirty: boolean) => void
  onSaved?: (thumbnailUrl: string) => void
}

export function YoutubeThumbnailTemplateStudio({
  projectId,
  topic,
  script,
  titleHint,
  downloadFileBaseName,
  thumbnailOutputLanguage = 'ko',
  scriptByLanguage,
  layout = 'inline',
  bindStepToolbarSave,
  bindModalCloseSave,
  onDirtyChange,
  onSaved,
}: YoutubeThumbnailTemplateStudioProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasStageRef = useRef<HTMLDivElement | null>(null)
  const canvasWrapRef = useRef<HTMLDivElement | null>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const bgLoadedUrlRef = useRef<string | null>(null)
  const studioLayerClipboardRef = useRef<StudioLayerClipboard | null>(null)
  const overlayRefs = useRef<Map<string, HTMLImageElement>>(new Map())
  const dragRef = useRef<DragState | null>(null)
  const hoveredLayerRef = useRef<StudioLayerRef | null>(null)
  const dragLiveRef = useRef<DragLiveOverlay | null>(null)
  const docRef = useRef<ThumbnailStudioDocument | null>(null)
  const rafPaintRef = useRef<number | null>(null)
  const savedSnapshotRef = useRef('')

  const bootDoc = useMemo(() => bootstrapStudioDocument(projectId), [projectId])
  const { doc, setDoc, replaceDocWithoutHistory, resetHistory, undo, redo, canUndo, canRedo } =
    useStudioHistory(bootDoc)
  const [docHydrating, setDocHydrating] = useState(true)
  const [studioTabs, setStudioTabs] = useState<ThumbnailStudioTab[]>([])
  const [activeTabId, setActiveTabId] = useState('')
  const [tabsBusy, setTabsBusy] = useState(false)
  const tabsHydratedRef = useRef(false)
  const studioTabsRef = useRef<ThumbnailStudioTab[]>([])
  const activeTabIdRef = useRef('')
  const tabsSaveGenRef = useRef(0)

  docRef.current = doc
  studioTabsRef.current = studioTabs
  activeTabIdRef.current = activeTabId

  const [selectedLayers, setSelectedLayers] = useState<StudioLayerRef[]>([])
  const selectedLayersRef = useRef<StudioLayerRef[]>([])
  const [imageCropSession, setImageCropSession] = useState<ImageCropSession | null>(null)
  const imageCropSessionRef = useRef<ImageCropSession | null>(null)
  imageCropSessionRef.current = imageCropSession
  const selected = useMemo(() => primaryStudioLayerRef(selectedLayers), [selectedLayers])
  const setSelected = useCallback((ref: StudioLayerRef | null) => {
    setSelectedLayers(ref ? [ref] : [])
  }, [])
  selectedLayersRef.current = selectedLayers
  const [sidebarTab, setSidebarTab] = useState<StudioSidebarTab>('text')
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [saveTemplateEditorOpen, setSaveTemplateEditorOpen] = useState(false)
  const [tplAnalyzeBusy, setTplAnalyzeBusy] = useState(false)
  const [newTextDraft, setNewTextDraft] = useState('')
  const [genBusy, setGenBusy] = useState(false)
  const [bgOnlyBusy, setBgOnlyBusy] = useState(false)
  const [layoutFitBusy, setLayoutFitBusy] = useState(false)
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [verifyImproveBusy, setVerifyImproveBusy] = useState(false)
  const [verifyModalOpen, setVerifyModalOpen] = useState(false)
  const [copyResearchOpen, setCopyResearchOpen] = useState(false)
  const [copyResearchSession, setCopyResearchSession] = useState<ThumbnailCopyResearchSession>(() =>
    loadCopyResearchSession(projectId),
  )
  const [copyManualPanelOpen, setCopyManualPanelOpen] = useState(
    () => loadCopyResearchSession(projectId).manualPanelOpen ?? false,
  )
  const [selectedCopyComboId, setSelectedCopyComboId] = useState<string | null>(null)
  const [selectedSubCopyId, setSelectedSubCopyId] = useState<string | null>(null)
  const [subCopiesLoading, setSubCopiesLoading] = useState(false)
  const [verifyReport, setVerifyReport] = useState<ThumbnailVerificationReport | null>(null)
  const [verifyPreviewUrl, setVerifyPreviewUrl] = useState('')
  const [textOnlyBusy, setTextOnlyBusy] = useState(false)
  const [languageApplyBusy, setLanguageApplyBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [lastJpegDownload, setLastJpegDownload] = useState<TriggerBlobDownloadResult | null>(null)
  const [openJpegPathBusy, setOpenJpegPathBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [coordOverlayRevision, setCoordOverlayRevision] = useState(0)
  const [localError, setLocalError] = useState<string | null>(null)
  const [extraBgHint, setExtraBgHint] = useState('')
  const [thumbGenSettings, setThumbGenSettings] = useState<ThumbnailGenSettings>(() =>
    loadThumbnailGenSettings(projectId),
  )
  const [sceneStyleLabel, setSceneStyleLabel] = useState('')
  const [sceneCustomStylePrompt, setSceneCustomStylePrompt] = useState('')
  const [displayScale, setDisplayScale] = useState(() =>
    layout === 'modal' ? 0.55 : Math.min(1, 640 / STUDIO_EDIT_CANVAS_W),
  )
  /** 화면 맞춤 배율 위에 적용 — 1이면 기존과 동일 */
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [canvasFocusOpen, setCanvasFocusOpen] = useState(false)
  const canvasZoomBeforeFocusRef = useRef(1)
  const fitScale = displayScale
  const effectiveDisplayScale = fitScale * canvasZoom
  const canvasZoomPercent = Math.round(canvasZoom * 100)
  const CANVAS_ZOOM_MIN = 0.25
  const CANVAS_ZOOM_MAX = 3
  const CANVAS_ZOOM_STEP = 0.1
  const bumpCanvasZoom = useCallback((delta: number) => {
    setCanvasZoom((z) => {
      const next = Math.round((z + delta) * 100) / 100
      return Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, next))
    })
  }, [])

  const computeFocusCanvasZoom = useCallback(() => {
    const stage = canvasStageRef.current
    if (!stage) return 1.5
    const r = stage.getBoundingClientRect()
    const pad = 32
    const availW = Math.max(240, r.width - pad)
    const availH = Math.max(180, r.height - pad)
    const baseW = STUDIO_EDIT_CANVAS_W * fitScale
    const baseH = STUDIO_EDIT_CANVAS_H * fitScale
    if (baseW < 1 || baseH < 1) return 1.5
    const z = Math.min(availW / baseW, availH / baseH)
    return Math.min(CANVAS_ZOOM_MAX, Math.max(1, Math.round(z * 100) / 100))
  }, [fitScale])

  const openCanvasFocus = useCallback(() => {
    canvasZoomBeforeFocusRef.current = canvasZoom
    setCanvasFocusOpen(true)
  }, [canvasZoom])

  const closeCanvasFocus = useCallback(() => {
    setCanvasFocusOpen(false)
    setCanvasZoom(canvasZoomBeforeFocusRef.current)
  }, [])

  const toggleCanvasFocus = useCallback(() => {
    if (canvasFocusOpen) closeCanvasFocus()
    else openCanvasFocus()
  }, [canvasFocusOpen, closeCanvasFocus, openCanvasFocus])
  const [inlineTextEdit, setInlineTextEdit] = useState<{ id: string; draft: string } | null>(null)
  const [textFillRange, setTextFillRange] = useState<{
    textId: string
    start: number
    end: number
  } | null>(null)
  const inlineInputRef = useRef<HTMLTextAreaElement | null>(null)
  const [textContextMenu, setTextContextMenu] = useState<{
    x: number
    y: number
    textId: string
  } | null>(null)
  const [textRewriteBusy, setTextRewriteBusy] = useState(false)
  const [textRegenerateBusy, setTextRegenerateBusy] = useState(false)
  const [feedPreviewOpen, setFeedPreviewOpen] = useState(false)
  const [feedPreviewSrc, setFeedPreviewSrc] = useState('')
  const [variants, setVariants] = useState<ThumbnailStudioVariant[]>([])
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null)
  const [variantBusy, setVariantBusy] = useState(false)
  const [savedWorks, setSavedWorks] = useState<ThumbnailStudioSavedWorkMeta[]>([])
  const [activeSavedWorkId, setActiveSavedWorkId] = useState<string | null>(null)
  const [savedWorksLoading, setSavedWorksLoading] = useState(false)
  const [savedWorksBusy, setSavedWorksBusy] = useState(false)
  const defaultOutputLanguage = thumbnailOutputLanguage || 'ko'
  const [analyzedBenchmarkStyle, setAnalyzedBenchmarkStyle] = useState<string | null>(null)
  const [benchmarkBusy, setBenchmarkBusy] = useState(false)
  const [benchmarkRemixBusy, setBenchmarkRemixBusy] = useState(false)
  const [benchmarkSourceFile, setBenchmarkSourceFile] = useState<File | null>(null)
  const [extractedPalette, setExtractedPalette] = useState<string[]>([])
  const [paletteBusy, setPaletteBusy] = useState(false)
  const [magicEnhanceBusy, setMagicEnhanceBusy] = useState(false)
  const [autoContrastBusy, setAutoContrastBusy] = useState(false)
  const [hookSuggestions, setHookSuggestions] = useState<string[]>([])
  const [hookBusy, setHookBusy] = useState(false)
  const [elementStickerPresetId, setElementStickerPresetId] = useState<string | null>(null)

  const outputLanguage = useMemo(() => {
    const tab = studioTabs.find((t) => t.id === activeTabId)
    return normalizeTabOutputLanguage(tab?.outputLanguage, defaultOutputLanguage)
  }, [studioTabs, activeTabId, defaultOutputLanguage])

  useEffect(() => {
    const loaded = loadCopyResearchSession(projectId)
    setCopyResearchSession(loaded)
    setCopyManualPanelOpen(loaded.manualPanelOpen ?? false)
  }, [projectId])

  useEffect(() => {
    saveCopyResearchSession(projectId, {
      ...copyResearchSession,
      manualPanelOpen: copyManualPanelOpen,
    })
  }, [projectId, copyResearchSession, copyManualPanelOpen])

  const handleApplyCopyCombo = useCallback(
    (combo: ThumbnailCopyCombo) => {
      const spec = copyResearchSession.slotSpec ?? resolveTwoLineCopySlotSpec(doc)
      if (!spec) {
        setLocalError('이 템플릿에서 2줄 슬롯을 찾을 수 없습니다.')
        return
      }
      setDoc(applyCopyComboToDocument(doc, combo, spec))
      setSelectedCopyComboId(combo.id)
      setCopyResearchSession((prev) => ({
        ...prev,
        manualPanelOpen: true,
        slotSpec: spec,
        aiCombos: prev.aiCombos ?? copyResearchSession.aiCombos,
      }))
      setCopyManualPanelOpen(true)
      setInfo('선택한 2줄 조합을 썸네일에 적용했습니다.')
      setLocalError(null)
    },
    [copyResearchSession.aiCombos, copyResearchSession.slotSpec, doc],
  )

  const subCopySlotSpec =
    copyResearchSession.subCopySlotSpec ?? resolveSubCopySlotSpec(doc)

  const handleAddSubCopyToCanvas = useCallback(
    (sub: ThumbnailSubCopy) => {
      const { document: next, layerId } = addSubCopyAsTextLayerToDocument(
        doc,
        sub.text,
        subCopySlotSpec?.subMax,
      )
      setDoc(next)
      setSelected({ kind: 'text', id: layerId })
      setSelectedSubCopyId(sub.id)
      setCopyResearchSession((prev) => ({ ...prev, manualPanelOpen: true }))
      setCopyManualPanelOpen(true)
      setSidebarTab('text')
      setInfo(`서브카피를 썸네일에 추가했습니다: ${sub.text}`)
      setLocalError(null)
    },
    [doc, subCopySlotSpec, setDoc],
  )

  const handleApplySubCopy = useCallback(
    (sub: ThumbnailSubCopy) => {
      const spec = subCopySlotSpec
      if (!spec) {
        void navigator.clipboard?.writeText(sub.text).then(() => {
          setSelectedSubCopyId(sub.id)
          setInfo(`서브카피를 클립보드에 복사했습니다: ${sub.text}`)
          setLocalError(null)
        }).catch(() => {
          setLocalError('이 템플릿에 서브카피 슬롯이 없습니다. 메모란에 적어 두세요.')
        })
        return
      }
      setDoc(applySlotReplacementsToDocument(doc, subCopyToReplacement(sub, spec)))
      setSelectedSubCopyId(sub.id)
      setCopyResearchSession((prev) => ({
        ...prev,
        manualPanelOpen: true,
        subCopySlotSpec: spec,
        aiSubCopies: prev.aiSubCopies ?? copyResearchSession.aiSubCopies,
      }))
      setCopyManualPanelOpen(true)
      setInfo(`서브카피를 썸네일에 적용했습니다: ${sub.text}`)
      setLocalError(null)
    },
    [copyResearchSession.aiSubCopies, doc, subCopySlotSpec],
  )

  const handleGenerateSubCopies = useCallback(async () => {
    const items = copyResearchSession.result?.items ?? []
    if (!items.length) {
      setLocalError('먼저 카피 참고 수집으로 유튜브 참고를 가져와 주세요.')
      return
    }
    const resolvedSpec = subCopySlotSpec ?? resolveSubCopySlotSpec(doc)
    const genSpec = resolvedSpec ?? { subKey: 'sub', subLabel: '서브카피', subMax: 16 }
    const scriptBody =
      script.trim() ||
      copyResearchSession.topicDraft.trim() ||
      titleHint?.trim() ||
      topic?.trim() ||
      ''
    if (!scriptBody) {
      setLocalError('대본 또는 주제가 필요합니다.')
      return
    }
    setSubCopiesLoading(true)
    try {
      const { subCopies } = await postThumbnailSubCopies({
        templateId: doc.templateId,
        topic: copyResearchSession.topicDraft.trim() || titleHint?.trim() || topic?.trim() || 'YouTube',
        scriptExcerpt: scriptBody,
        videoTitle: titleHint?.trim() || undefined,
        outputLanguage: defaultOutputLanguage,
        slotSpec: genSpec,
        researchItems: items,
        count: 10,
      })
      setCopyResearchSession((prev) => ({
        ...prev,
        manualPanelOpen: true,
        aiSubCopies: subCopies,
        subCopySlotSpec: resolvedSpec ?? prev.subCopySlotSpec,
      }))
      setCopyManualPanelOpen(true)
      setSelectedSubCopyId(null)
      setInfo(`서브카피 ${subCopies.length}개를 만들었습니다.`)
      setLocalError(null)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubCopiesLoading(false)
    }
  }, [
    copyResearchSession.result?.items,
    copyResearchSession.topicDraft,
    defaultOutputLanguage,
    doc,
    script,
    subCopySlotSpec,
    titleHint,
    topic,
  ])

  const showCopyReferencePanel =
    (copyManualPanelOpen ||
      (copyResearchSession.aiCombos?.length ?? 0) > 0 ||
      (copyResearchSession.aiSubCopies?.length ?? 0) > 0) &&
    ((copyResearchSession.result?.items?.length ?? 0) > 0 ||
      (copyResearchSession.aiCombos?.length ?? 0) > 0 ||
      (copyResearchSession.aiSubCopies?.length ?? 0) > 0)

  const showCopyComboPanel = (copyResearchSession.aiCombos?.length ?? 0) > 0

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let sceneDefault: ThumbnailGenSettings | null = null
      let styleLabel = ''
      let customPrompt = ''
      try {
        const payload = (await getSceneImages(projectId)) as Record<string, unknown>
        if (cancelled) return
        sceneDefault = resolveThumbnailGenSettingsFromScenePayload(payload)
        customPrompt = resolveSceneCustomStylePromptFromPayload(payload)
        const st = payload.settings
        if (st && typeof st === 'object' && !Array.isArray(st)) {
          const lbl = (st as Record<string, unknown>).styleLabel ?? (st as Record<string, unknown>).style_label
          if (typeof lbl === 'string') styleLabel = lbl.trim()
        }
      } catch {
        /* 씬 미저장 — 로컬/기본값만 */
      }
      if (cancelled) return
      setSceneCustomStylePrompt(customPrompt)
      setSceneStyleLabel(styleLabel)
      const loaded = loadThumbnailGenSettings(projectId, sceneDefault)
      setThumbGenSettings(loaded)
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const applyThumbGenSettings = useCallback(
    (next: ThumbnailGenSettings) => {
      setThumbGenSettings(next)
      saveThumbnailGenSettings(projectId, next)
    },
    [projectId],
  )

  const thumbGenApiOpts = useMemo(
    () => ({
      ...thumbnailStyleApiPayload(thumbGenSettings),
      imageStyle: thumbnailImageStyleHint(thumbGenSettings, sceneStyleLabel),
      customStylePrompt:
        sceneCustomStylePrompt ||
        resolveThumbnailCustomStylePrompt(thumbGenSettings) ||
        undefined,
    }),
    [thumbGenSettings, sceneCustomStylePrompt, sceneStyleLabel],
  )

  const effectiveScript = useMemo(
    () =>
      resolveScriptForThumbnailOutputLanguage({
        scriptKo: script,
        scriptByLanguage,
        outputLanguage,
      }),
    [script, scriptByLanguage, outputLanguage],
  )

  const topicStyleRec = useTopicStyleRecommendations({
    scriptExcerpt: effectiveScript,
    titleHint: titleHint ?? topic,
    enabled: sidebarTab === 'bgAiStyle',
  })

  const refreshSavedWorks = useCallback(async () => {
    setSavedWorksLoading(true)
    try {
      const list = await fetchThumbnailStudioSavedWorks(projectId)
      setSavedWorks(list)
    } catch {
      setSavedWorks([])
    } finally {
      setSavedWorksLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void refreshSavedWorks()
  }, [refreshSavedWorks])

  useEffect(() => {
    if (!selected || selected.kind !== 'text') {
      setTextFillRange(null)
      return
    }
    setTextFillRange((prev) => (prev && prev.textId !== selected.id ? null : prev))
  }, [selected])

  useEffect(() => {
    if (!textContextMenu) return
    const close = () => setTextContextMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [textContextMenu])

  const selectedText =
    selected?.kind === 'text' ? doc.textLayers.find((t) => t.id === selected.id) : undefined
  const selectedImage =
    selected?.kind === 'image' ? doc.imageLayers.find((l) => l.id === selected.id) : undefined
  const selectedShape =
    selected?.kind === 'shape' ? doc.shapeLayers.find((s) => s.id === selected.id) : undefined
  const selectedOverlay =
    selected?.kind === 'overlay' ? (doc.overlayLayers ?? []).find((o) => o.id === selected.id) : undefined
  const activeExportFrame = useMemo(() => resolveExportFrame(doc), [doc.templateId, doc.exportFrame])
  const linkedHookHighlight = templateHasLinkedHookHighlight(doc.templateId)

  const isDirty = useMemo(() => JSON.stringify(doc) !== savedSnapshotRef.current, [doc])

  useEffect(() => {
    if (!savedSnapshotRef.current) savedSnapshotRef.current = JSON.stringify(bootDoc)
  }, [bootDoc])

  useEffect(() => {
    let cancelled = false
    setDocHydrating(true)
    tabsHydratedRef.current = false
    void (async () => {
      try {
        let session = null
        try {
          session = await fetchThumbnailStudioTabs(projectId)
        } catch {
          session = null
        }
        if (!session) session = loadStudioTabsSessionLocal(projectId)
        if (!session) {
          const loaded = normalizeStudioDocument(
            resolveTabDocumentUrls(await hydrateStudioDocumentFromStorage(projectId)),
          )
          const tab = createStudioTab(loaded, labelForTabDoc(loaded, 0), defaultOutputLanguage)
          session = { v: 1, activeTabId: tab.id, tabs: [tab], updatedAt: Date.now() }
        } else {
          session = {
            ...session,
            tabs: session.tabs.map((t, i) => ({
              ...normalizeStudioTab(t, i, defaultOutputLanguage),
              document: normalizeStudioDocument(resolveTabDocumentUrls(t.document)),
              label: t.label?.trim() || labelForTabDoc(t.document, i),
            })),
          }
          if (!session.tabs.some((t) => t.id === session!.activeTabId)) {
            session.activeTabId = session.tabs[0]!.id
          }
        }
        if (cancelled) return
        const active = session.tabs.find((t) => t.id === session.activeTabId) ?? session.tabs[0]!
        setStudioTabs(session.tabs)
        studioTabsRef.current = session.tabs
        setActiveTabId(active.id)
        activeTabIdRef.current = active.id
        resetHistory(cloneStudioDocument(active.document))
        replaceDocWithoutHistory(cloneStudioDocument(active.document))
        savedSnapshotRef.current = JSON.stringify(active.document)
        saveStudioTabsSessionLocal(projectId, { ...session, v: 1 as const })
        tabsHydratedRef.current = true
      } catch {
        if (cancelled) return
        setLocalError('썸네일 작업을 불러오지 못했습니다. 새 캔버스로 시작합니다.')
        const tab = createStudioTab(bootDoc, defaultStudioTabLabel(1))
        setStudioTabs([tab])
        studioTabsRef.current = [tab]
        setActiveTabId(tab.id)
        activeTabIdRef.current = tab.id
        tabsHydratedRef.current = true
      } finally {
        if (!cancelled) setDocHydrating(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, bootDoc, defaultOutputLanguage, replaceDocWithoutHistory, resetHistory])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (docHydrating || !tabsHydratedRef.current || !activeTabId) return
    const merged = mergeActiveTabDocument(
      studioTabsRef.current,
      activeTabId,
      docRef.current ?? doc,
    )
    studioTabsRef.current = merged
    saveStudioTabsSessionLocal(projectId, {
      v: 1 as const,
      activeTabId,
      tabs: merged,
      updatedAt: Date.now(),
    })
    const timer = window.setTimeout(() => {
      const saveGen = ++tabsSaveGenRef.current
      void saveThumbnailStudioTabsBestEffort(
        projectId,
        {
          activeTabId: activeTabIdRef.current,
          tabs: studioTabsRef.current,
        },
        (session) => saveStudioTabsSessionLocal(projectId, session),
      ).then(({ session }) => {
        if (!session?.tabs?.length || saveGen !== tabsSaveGenRef.current) return
        const tabsBase = mergeActiveTabDocument(
          studioTabsRef.current,
          activeTabIdRef.current,
          docRef.current ?? doc,
        )
        const withScoped = applyExternalizedAssetsFromSaveResponse(tabsBase, session.tabs).map(
          (t, i) => ({
          ...t,
          document: normalizeStudioDocument(resolveTabDocumentUrls(t.document)),
          label: t.label?.trim() || labelForTabDoc(t.document, i),
        }))
        studioTabsRef.current = withScoped
        setStudioTabs(withScoped)
        saveStudioTabsSessionLocal(projectId, {
          v: 1,
          activeTabId: activeTabIdRef.current,
          tabs: withScoped,
          updatedAt: session.updatedAt,
        })
        const active = withScoped.find((t) => t.id === activeTabIdRef.current)
        if (!active) return
        setDoc((prev) => {
          const next = promoteSaveResponseIntoDocument(prev, active.document)
          const prevBg = prev.background.imageDataUrl?.trim() ?? ''
          const nextBg = next.background.imageDataUrl?.trim() ?? ''
          if (prevBg === nextBg) return prev
          bgLoadedUrlRef.current = null
          return next
        })
      })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [projectId, doc, docHydrating, activeTabId])

  const paintCanvasRef = useRef<() => void>(() => {})

  const paintCanvas = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const baseDoc = docRef.current
    if (!baseDoc) return
    let renderDoc = applyDragLiveOverlay(baseDoc, dragLiveRef.current)
    if (inlineTextEdit) {
      renderDoc = {
        ...renderDoc,
        textLayers: renderDoc.textLayers.map((t) =>
          t.id === inlineTextEdit.id ? { ...t, text: '' } : t,
        ),
      }
    }
    const assets: StudioRenderAssets = {
      backgroundImage: bgImageRef.current,
      overlayImages: overlayRefs.current,
    }
    const d = dragRef.current
    let paintSel: StudioLayerRef | null = selected
    if (!inlineTextEdit && d) {
      if (d?.kind === 'text' || d?.kind === 'resize-text' || d?.kind === 'rotate-text' || d?.kind === 'text-fill-select') {
        paintSel = { kind: 'text', id: d.id }
      } else if (d?.kind === 'image' || d?.kind === 'resize-image' || d?.kind === 'rotate-image' || d?.kind === 'resize-image-crop' || d?.kind === 'move-image-crop') {
        paintSel = { kind: 'image', id: d.id }
      } else if (
        d?.kind === 'shape-move' ||
        d?.kind === 'shape-line' ||
        d?.kind === 'resize-shape' ||
        d?.kind === 'rotate-shape'
      ) {
        paintSel = { kind: 'shape', id: d.id }
      } else if (d?.kind === 'background' || d?.kind === 'resize-background') {
        paintSel = { kind: 'background' }
      }
    }
    const fillHighlight =
      dragRef.current?.kind === 'text-fill-select'
        ? {
            textId: dragRef.current.id,
            start: dragRef.current.start,
            end: dragRef.current.end,
          }
        : textFillRange &&
            selected?.kind === 'text' &&
            textFillRange.textId === selected.id &&
            textFillRange.start !== textFillRange.end
          ? textFillRange
          : null
    const cropSession = imageCropSessionRef.current
    let imageCropEdit: ImageCropEditState | undefined
    if (cropSession) {
      const liveCrop = dragLiveRef.current?.image?.[cropSession.layerId]?.crop
      imageCropEdit = {
        layerId: cropSession.layerId,
        crop: liveCrop ?? cropSession.crop,
        fullCanvas: cropSession.fullCanvas,
        imgW: cropSession.imgW,
        imgH: cropSession.imgH,
      }
    }
    renderStudioDocument(
      ctx,
      renderDoc,
      assets,
      paintSel,
      {
        viewport: 'edit',
        ...(fillHighlight
          ? { textFillHighlight: { textId: fillHighlight.textId, start: fillHighlight.start, end: fillHighlight.end } }
          : {}),
        selectedLayers: inlineTextEdit ? [] : selectedLayersRef.current,
        ...(imageCropEdit ? { imageCropEdit } : {}),
        hoveredLayer:
          inlineTextEdit || dragRef.current ? null : hoveredLayerRef.current,
      },
    )
  }, [selectedLayers, inlineTextEdit, textFillRange, imageCropSession])

  paintCanvasRef.current = paintCanvas

  const scheduleCanvasPaint = useCallback(() => {
    if (rafPaintRef.current != null) return
    rafPaintRef.current = requestAnimationFrame(() => {
      rafPaintRef.current = null
      paintCanvasRef.current()
      if (dragLiveRef.current) {
        setCoordOverlayRevision((r) => r + 1)
      }
    })
  }, [])

  const coordLiveDoc = useMemo(
    () => applyDragLiveOverlay(doc, dragLiveRef.current),
    [doc, coordOverlayRevision],
  )

  useEffect(() => {
    void ensureBundledFontsLoaded().then(() => scheduleCanvasPaint())
  }, [doc, scheduleCanvasPaint])

  useEffect(() => {
    void ensureBundledFontsLoaded().then(() => scheduleCanvasPaint())
  }, [scheduleCanvasPaint])

  useEffect(() => {
    const fonts = document.fonts
    if (!fonts?.addEventListener) return
    const onDone = () => scheduleCanvasPaint()
    fonts.addEventListener('loadingdone', onDone)
    return () => fonts.removeEventListener('loadingdone', onDone)
  }, [scheduleCanvasPaint])

  useEffect(() => {
    scheduleCanvasPaint()
  }, [paintCanvas, scheduleCanvasPaint])

  useEffect(() => {
    const dataUrl = doc.background.imageDataUrl
    const updatedAt = doc.background.imageUpdatedAt?.trim() ?? ''
    if (!dataUrl) {
      bgImageRef.current = null
      bgLoadedUrlRef.current = null
      scheduleCanvasPaint()
      return
    }

    const loadKey = `${dataUrl}|${updatedAt}`
    if (
      bgLoadedUrlRef.current === loadKey &&
      bgImageRef.current?.complete &&
      (bgImageRef.current.naturalWidth || bgImageRef.current.width)
    ) {
      return
    }

    let cancelled = false
    const img = new Image()

    const applyLoadedImage = () => {
      if (cancelled) return
      bgImageRef.current = img
      bgLoadedUrlRef.current = loadKey
      const iw = img.naturalWidth || img.width
      const ih = img.naturalHeight || img.height
      if (iw && ih) {
        setDoc((prev) => {
          if (prev.background.imageDataUrl !== dataUrl) return prev
          if ((prev.background.imageUpdatedAt?.trim() ?? '') !== updatedAt) return prev
          const cover = ensureBackgroundCoverLayout(
            prev.background.layout,
            iw,
            ih,
            prev.background.layoutCustomized,
          )
          const cur = prev.background.layout
          if (
            cur &&
            Math.abs(cur.x - cover.x) < 0.5 &&
            Math.abs(cur.y - cover.y) < 0.5 &&
            Math.abs(cur.width - cover.width) < 0.5 &&
            Math.abs(cur.height - cover.height) < 0.5
          ) {
            return prev
          }
          return updateBackgroundLayout(prev, cover, false)
        })
      }
      scheduleCanvasPaint()
    }

    img.onload = () => {
      void (async () => {
        try {
          await img.decode()
        } catch {
          /* decode 미지원·실패 시 onload 결과 사용 */
        }
        applyLoadedImage()
      })()
    }
    img.onerror = () => {
      if (cancelled) return
      bgImageRef.current = null
      bgLoadedUrlRef.current = null
      setLocalError('배경 이미지를 불러오지 못했습니다.')
      scheduleCanvasPaint()
    }
    img.src = resolveStudioAssetUrlWithCache(dataUrl, updatedAt) ?? dataUrl
    return () => {
      cancelled = true
    }
  }, [doc.background.imageDataUrl, doc.background.imageUpdatedAt, setDoc, scheduleCanvasPaint])

  useEffect(() => {
    const map = overlayRefs.current
    for (const layer of doc.imageLayers) {
      if (!layer.visible || !layer.imageDataUrl) continue
      const src = resolveStudioAssetUrl(layer.imageDataUrl) ?? layer.imageDataUrl
      let img = map.get(layer.id)
      if (!img) {
        img = new Image()
        map.set(layer.id, img)
        img.onload = () => scheduleCanvasPaint()
      }
      if (img.src !== src) {
        img.src = src
      }
    }
    scheduleCanvasPaint()
  }, [doc.imageLayers, scheduleCanvasPaint])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    if (c.width !== STUDIO_EDIT_CANVAS_W || c.height !== STUDIO_EDIT_CANVAS_H) {
      c.width = STUDIO_EDIT_CANVAS_W
      c.height = STUDIO_EDIT_CANVAS_H
    }
    scheduleCanvasPaint()
  }, [])

  useEffect(() => {
    if (layout !== 'modal' && !canvasFocusOpen) {
      setDisplayScale(Math.min(1, 640 / STUDIO_EDIT_CANVAS_W))
      return
    }
    const el = canvasStageRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      const pad = 32
      const sw = Math.max(120, (r.width - pad) / STUDIO_EDIT_CANVAS_W)
      const sh = Math.max(120, (r.height - pad) / STUDIO_EDIT_CANVAS_H)
      setDisplayScale(Math.min(sw, sh, canvasFocusOpen ? 1.25 : 1))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [layout, canvasFocusOpen])

  useEffect(() => {
    if (!canvasFocusOpen) return
    const applyZoom = () => setCanvasZoom(computeFocusCanvasZoom())
    const t = requestAnimationFrame(applyZoom)
    window.addEventListener('resize', applyZoom)
    return () => {
      cancelAnimationFrame(t)
      window.removeEventListener('resize', applyZoom)
    }
  }, [canvasFocusOpen, computeFocusCanvasZoom, displayScale])

  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      const step = Math.min(
        CANVAS_ZOOM_STEP * 2,
        Math.max(CANVAS_ZOOM_STEP / 2, Math.abs(e.deltaY) / 400),
      )
      bumpCanvasZoom(e.deltaY < 0 ? step : -step)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [bumpCanvasZoom])

  useEffect(() => {
    if (!canvasFocusOpen || inlineTextEdit) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      closeCanvasFocus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canvasFocusOpen, closeCanvasFocus, inlineTextEdit])

  const exportCanvasBlob = useCallback(async (): Promise<Blob> => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) throw new Error('캔버스를 찾을 수 없습니다.')
    const currentDoc = docRef.current ?? doc
    const assets = await buildStudioRenderAssetsForExport(currentDoc, {
      backgroundImage: bgImageRef.current,
      overlayImages: overlayRefs.current,
    })
    const prevW = c.width
    const prevH = c.height
    c.width = STUDIO_CANVAS_W
    c.height = STUDIO_CANVAS_H
    const blob = await exportStudioDocumentToBlob(c, currentDoc, assets)
    c.width = prevW
    c.height = prevH
    const sel =
      selected?.kind === 'text'
        ? { kind: 'text' as const, id: selected.id }
        : selected?.kind === 'image'
          ? { kind: 'image' as const, id: selected.id }
          : selected?.kind === 'shape'
            ? { kind: 'shape' as const, id: selected.id }
            : selected?.kind === 'overlay'
              ? { kind: 'overlay' as const, id: selected.id }
              : null
    renderStudioDocument(ctx, currentDoc, assets, sel, { viewport: 'edit', selectedLayers: selectedLayersRef.current })
    scheduleCanvasPaint()
    return blob
  }, [doc, selected, scheduleCanvasPaint])

  const captureCanvasPreviewDataUrl = useCallback(async (): Promise<string | undefined> => {
    try {
      const blob = await exportCanvasBlob()
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('미리보기 캡처 실패'))
        reader.readAsDataURL(blob)
      })
    } catch {
      return undefined
    }
  }, [exportCanvasBlob])

  const switchStudioTab = useCallback(
    async (nextId: string) => {
      if (!nextId || nextId === activeTabIdRef.current || tabsBusy) return
      setTabsBusy(true)
      setLocalError(null)
      try {
        const preview = await captureCanvasPreviewDataUrl()
        const merged = mergeActiveTabDocument(
          studioTabsRef.current,
          activeTabIdRef.current,
          docRef.current ?? doc,
          preview ? { previewUrl: preview } : undefined,
        )
        const target = merged.find((t) => t.id === nextId)
        if (!target) return
        studioTabsRef.current = merged
        setStudioTabs(merged)
        setActiveTabId(nextId)
        activeTabIdRef.current = nextId
        bgLoadedUrlRef.current = null
        const normalized = cloneStudioDocument(target.document)
        resetHistory(normalized)
        replaceDocWithoutHistory(normalized)
        savedSnapshotRef.current = JSON.stringify(normalized)
        setSelected(null)
        setActiveVariantId(null)
        onDirtyChange?.(false)
        scheduleCanvasPaint()
      } finally {
        setTabsBusy(false)
      }
    },
    [
      captureCanvasPreviewDataUrl,
      doc,
      onDirtyChange,
      replaceDocWithoutHistory,
      resetHistory,
      scheduleCanvasPaint,
      tabsBusy,
    ],
  )

  const onNewStudioTab = useCallback(async () => {
    if (studioTabsRef.current.length >= MAX_STUDIO_TABS) {
      setLocalError(`썸네일 탭은 최대 ${MAX_STUDIO_TABS}개까지 만들 수 있습니다.`)
      return
    }
    setTabsBusy(true)
    setLocalError(null)
    try {
      const preview = await captureCanvasPreviewDataUrl()
      const merged = mergeActiveTabDocument(
        studioTabsRef.current,
        activeTabIdRef.current,
        docRef.current ?? doc,
        preview ? { previewUrl: preview } : undefined,
      )
      const newTab = createStudioTab(
        undefined,
        defaultStudioTabLabel(merged.length + 1),
        outputLanguage,
      )
      const nextTabs = [...merged, newTab]
      studioTabsRef.current = nextTabs
      setStudioTabs(nextTabs)
      setActiveTabId(newTab.id)
      activeTabIdRef.current = newTab.id
      const emptyDoc = cloneStudioDocument(newTab.document)
      resetHistory(emptyDoc)
      replaceDocWithoutHistory(emptyDoc)
      savedSnapshotRef.current = JSON.stringify(emptyDoc)
      setSelected(null)
      setActiveVariantId(null)
      onDirtyChange?.(false)
      setTemplateModalOpen(true)
      setInfo('새 썸네일 — 템플릿을 선택해 주세요.')
    } finally {
      setTabsBusy(false)
    }
  }, [captureCanvasPreviewDataUrl, doc, onDirtyChange, outputLanguage, replaceDocWithoutHistory, resetHistory])

  const onDuplicateStudioTab = useCallback(
    async (tabId?: string) => {
      if (studioTabsRef.current.length >= MAX_STUDIO_TABS) {
        setLocalError(`썸네일 탭은 최대 ${MAX_STUDIO_TABS}개까지 만들 수 있습니다.`)
        return
      }
      const sourceId = tabId ?? activeTabIdRef.current
      if (!sourceId) return

      setTabsBusy(true)
      setLocalError(null)
      try {
        const preview = await captureCanvasPreviewDataUrl()
        const merged = mergeActiveTabDocument(
          studioTabsRef.current,
          activeTabIdRef.current,
          docRef.current ?? doc,
          preview ? { previewUrl: preview } : undefined,
        )
        const sourceIdx = merged.findIndex((t) => t.id === sourceId)
        if (sourceIdx < 0) return

        const sourceTab = merged[sourceIdx]!
        const dupTab = duplicateStudioTab(
          sourceTab,
          merged.map((t) => t.label),
        )
        const nextTabs = [
          ...merged.slice(0, sourceIdx + 1),
          dupTab,
          ...merged.slice(sourceIdx + 1),
        ]
        studioTabsRef.current = nextTabs
        setStudioTabs(nextTabs)
        setActiveTabId(dupTab.id)
        activeTabIdRef.current = dupTab.id
        bgLoadedUrlRef.current = null
        const normalized = cloneStudioDocument(dupTab.document)
        resetHistory(normalized)
        replaceDocWithoutHistory(normalized)
        savedSnapshotRef.current = JSON.stringify(normalized)
        setSelected(null)
        setActiveVariantId(null)
        setActiveSavedWorkId(null)
        onDirtyChange?.(false)
        scheduleCanvasPaint()
        setInfo('썸네일을 복제했습니다. 배경·사진만 바꿔 보세요.')
      } finally {
        setTabsBusy(false)
      }
    },
    [
      captureCanvasPreviewDataUrl,
      doc,
      onDirtyChange,
      replaceDocWithoutHistory,
      resetHistory,
      scheduleCanvasPaint,
    ],
  )

  const onApplyTabOutputLanguage = useCallback(
    async (lang: string) => {
      if (!activeTabIdRef.current || !tabsHydratedRef.current || languageApplyBusy) return
      const normalized = normalizeTabOutputLanguage(lang, defaultOutputLanguage)
      const label =
        THUMBNAIL_TAB_OUTPUT_LANGUAGE_OPTIONS.find((o) => o.id === normalized)?.label ?? normalized
      const currentDoc = docRef.current ?? doc
      const hasText = currentDoc.textLayers.some((t) => t.text.trim())
      const activeTab = studioTabsRef.current.find((t) => t.id === activeTabIdRef.current)
      const currentLang = normalizeTabOutputLanguage(activeTab?.outputLanguage, defaultOutputLanguage)
      const isLanguageChange = normalized !== currentLang

      setLanguageApplyBusy(true)
      setLocalError(null)
      try {
        const preview = await captureCanvasPreviewDataUrl()
        let merged = mergeActiveTabDocument(
          studioTabsRef.current,
          activeTabIdRef.current,
          currentDoc,
          preview ? { previewUrl: preview } : undefined,
        )

        if (hasText && isLanguageChange) {
          if (merged.length >= MAX_STUDIO_TABS) {
            setLocalError(
              `썸네일 탭은 최대 ${MAX_STUDIO_TABS}개까지입니다. 다른 탭을 닫은 뒤 번역해 주세요.`,
            )
            return
          }

          const sourceId = activeTabIdRef.current
          const sourceIdx = merged.findIndex((t) => t.id === sourceId)
          if (sourceIdx < 0) return

          const sourceTab = merged[sourceIdx]!
          const dupTab = duplicateStudioTab(sourceTab, merged.map((t) => t.label))
          dupTab.label = duplicateStudioTabLabelForLanguage(
            sourceTab.label,
            label,
            merged.map((t) => t.label),
          )
          dupTab.outputLanguage = normalized

          const r = await applyStudioTabOutputLanguage({
            document: dupTab.document,
            topic,
            scriptKo: script,
            scriptByLanguage,
            titleHint,
            outputLanguage: normalized,
          })
          dupTab.document = r.document

          const nextTabs = [
            ...merged.slice(0, sourceIdx + 1),
            dupTab,
            ...merged.slice(sourceIdx + 1),
          ]
          studioTabsRef.current = nextTabs
          setStudioTabs(nextTabs)
          setActiveTabId(dupTab.id)
          activeTabIdRef.current = dupTab.id
          bgLoadedUrlRef.current = null
          const normalizedDoc = cloneStudioDocument(dupTab.document)
          resetHistory(normalizedDoc)
          replaceDocWithoutHistory(normalizedDoc)
          savedSnapshotRef.current = JSON.stringify(normalizedDoc)
          setSelected(null)
          setActiveVariantId(null)
          setActiveSavedWorkId(null)
          onDirtyChange?.(false)
          scheduleCanvasPaint()
          saveStudioTabsSessionLocal(projectId, {
            v: 1 as const,
            activeTabId: dupTab.id,
            tabs: nextTabs,
            updatedAt: Date.now(),
          })
          setInfo(`「${sourceTab.label}」을(를) 복제해 ${label}(으)로 번역했습니다.`)
          return
        }

        let nextDoc = currentDoc
        if (hasText) {
          const r = await applyStudioTabOutputLanguage({
            document: currentDoc,
            topic,
            scriptKo: script,
            scriptByLanguage,
            titleHint,
            outputLanguage: normalized,
          })
          nextDoc = r.document
          setDoc(nextDoc)
        }

        merged = mergeActiveTabDocument(merged, activeTabIdRef.current, nextDoc).map((t) =>
          t.id === activeTabIdRef.current ? { ...t, outputLanguage: normalized } : t,
        )
        studioTabsRef.current = merged
        setStudioTabs(merged)
        saveStudioTabsSessionLocal(projectId, {
          v: 1 as const,
          activeTabId: activeTabIdRef.current,
          tabs: merged,
          updatedAt: Date.now(),
        })

        if (hasText) {
          setInfo(`썸네일 문구를 ${label}(으)로 번역했습니다.`)
        } else {
          setInfo(`「${label}」 언어를 적용했습니다. 문구를 추가하면 같은 언어로 AI 생성됩니다.`)
        }
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : '언어 적용 실패')
      } finally {
        setLanguageApplyBusy(false)
      }
    },
    [
      captureCanvasPreviewDataUrl,
      defaultOutputLanguage,
      doc,
      languageApplyBusy,
      onDirtyChange,
      projectId,
      replaceDocWithoutHistory,
      resetHistory,
      scheduleCanvasPaint,
      script,
      scriptByLanguage,
      setDoc,
      titleHint,
      topic,
    ],
  )

  const onCloseStudioTab = useCallback(
    async (tabId: string) => {
      if (studioTabsRef.current.length <= 1) return
      const target = studioTabsRef.current.find((t) => t.id === tabId)
      if (
        tabId === activeTabIdRef.current &&
        isDirty &&
        !window.confirm('저장하지 않은 변경이 있습니다. 이 탭을 닫을까요?')
      ) {
        return
      }
      if (
        tabId !== activeTabIdRef.current &&
        !window.confirm(`「${target?.label ?? '썸네일'}」 탭을 닫을까요?`)
      ) {
        return
      }
      setTabsBusy(true)
      try {
        let merged = studioTabsRef.current.filter((t) => t.id !== tabId)
        if (tabId === activeTabIdRef.current) {
          const preview = await captureCanvasPreviewDataUrl()
          merged = mergeActiveTabDocument(
            studioTabsRef.current,
            activeTabIdRef.current,
            docRef.current ?? doc,
            preview ? { previewUrl: preview } : undefined,
          ).filter((t) => t.id !== tabId)
        }
        const nextActive = merged[0]
        if (!nextActive) return
        studioTabsRef.current = merged
        setStudioTabs(merged)
        setActiveTabId(nextActive.id)
        activeTabIdRef.current = nextActive.id
        const normalized = cloneStudioDocument(nextActive.document)
        resetHistory(normalized)
        replaceDocWithoutHistory(normalized)
        savedSnapshotRef.current = JSON.stringify(normalized)
        setSelected(null)
        onDirtyChange?.(false)
        scheduleCanvasPaint()
      } finally {
        setTabsBusy(false)
      }
    },
    [
      captureCanvasPreviewDataUrl,
      doc,
      isDirty,
      onDirtyChange,
      replaceDocWithoutHistory,
      resetHistory,
      scheduleCanvasPaint,
    ],
  )

  const openSaveTemplateEditor = useCallback(() => {
    if (!doc.textLayers.length) {
      setLocalError('저장할 문구 레이어가 없습니다. 텍스트를 추가한 뒤 다시 시도해 보세요.')
      return
    }
    setLocalError(null)
    setSaveTemplateEditorOpen(true)
  }, [doc.textLayers.length])

  const onSelectTemplate = async (templateId: string) => {
    const tpl = getProTemplate(templateId)
    if (!tpl) return

    const previousTpl = doc.templateId === templateId ? null : getProTemplate(doc.templateId)
    const slotTexts = resolveTemplateSlotTexts(tpl, doc.textLayers, previousTpl)
    const isCustom = isCustomTemplateId(templateId)

    setTplAnalyzeBusy(!isCustom)
    setGenBusy(false)
    setLocalError(null)
    setInfo(isCustom ? '커스텀 템플릿을 적용하는 중…' : '템플릿 미리보기에서 문구 위치·크기·기울기를 분석하는 중…')

    let workDoc: ThumbnailStudioDocument = doc
    try {
      const rawSpec = isCustom
        ? buildFallbackTemplateStyleSpec(templateId)
        : tpl.previewImageUrl
          ? (await analyzeTemplatePreviewStyle(templateId)) ??
            buildFallbackTemplateStyleSpec(templateId)
          : buildFallbackTemplateStyleSpec(templateId)
      const spec = rawSpec
        ? isCustom
          ? rawSpec
          : canonicalTemplateStyleSpec(templateId, rawSpec) ?? rawSpec
        : null
      workDoc = await applyTemplateToDocumentWithPreview(doc, templateId, slotTexts, spec)
      setDoc(workDoc)
    } catch (e) {
      const fallback = buildFallbackTemplateStyleSpec(templateId)
      try {
        workDoc = await applyTemplateToDocumentWithPreview(doc, templateId, slotTexts, fallback)
        setDoc(workDoc)
      } catch (e2) {
        setLocalError(
          e2 instanceof Error
            ? e2.message
            : e instanceof Error
              ? e.message
              : '템플릿 적용 실패',
        )
        return
      }
    } finally {
      setTplAnalyzeBusy(false)
    }

    setGenBusy(true)
    setInfo('AI로 썸네일 배경·문구를 생성하는 중…')
    try {
      if (!workDoc.templateStyle) {
        const fallback = buildFallbackTemplateStyleSpec(templateId)
        if (fallback) workDoc = { ...workDoc, templateStyle: fallback }
      }
      const r = await generateStudioOnTemplateSelect({
        document: workDoc,
        topic,
        script: effectiveScript,
        titleHint,
        outputLanguage: outputLanguage,
        ...thumbGenApiOpts,
        extraBackgroundHint: extraBgHint,
        analyzedBenchmarkStyle: analyzedBenchmarkStyle ?? undefined,
      })
      setDoc(r.document)
      const tabIdx = studioTabsRef.current.findIndex((t) => t.id === activeTabIdRef.current)
      const tabLabel = labelForTabDoc(r.document, tabIdx >= 0 ? tabIdx : 0)
      const nextTabs = mergeActiveTabDocument(
        studioTabsRef.current,
        activeTabIdRef.current,
        r.document,
        { label: tabLabel },
      )
      studioTabsRef.current = nextTabs
      setStudioTabs(nextTabs)
      setSelected({ kind: 'background' })
      const note =
        r.backgroundNote ||
        '주제·대본 기반 배경과 템플릿 위치의 문구를 생성했습니다.'
      setInfo(note)
      const failBits: string[] = []
      if (note.includes('배경 생성 실패')) {
        failBits.push(note.split('배경 생성 실패:')[1]?.split('(')[0]?.trim() || '배경 생성 실패')
      }
      if (note.includes('문구:') && note.includes('문구만 AI 재생성')) {
        const copyErr = note.split('문구:')[1]?.split('—')[0]?.trim()
        if (copyErr) failBits.push(`문구: ${copyErr}`)
      }
      if (failBits.length) {
        setLocalError(
          `일부 생성 실패 — ${failBits.join(' / ')}. Gemini·Replicate API 키를 설정에서 확인하세요.`,
        )
      } else {
        setLocalError(null)
      }
      setSidebarTab('text')
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '템플릿 AI 생성 실패')
    } finally {
      setGenBusy(false)
    }
  }

  const onGenerateFromTemplate = async () => {
    setGenBusy(true)
    setLocalError(null)
    setInfo('')
    try {
      let workDoc = doc
      if (!workDoc.templateStyle) {
        const fallback = buildFallbackTemplateStyleSpec(workDoc.templateId)
        if (fallback) workDoc = { ...workDoc, templateStyle: fallback }
      }
      const r = await generateStudioLayersFromTemplate({
        document: workDoc,
        topic,
        script: effectiveScript,
        titleHint,
        outputLanguage: outputLanguage,
        ...thumbGenApiOpts,
        extraBackgroundHint: extraBgHint,
        analyzedBenchmarkStyle: analyzedBenchmarkStyle ?? undefined,
      })
      setDoc(r.document)
      setSelected({ kind: 'background' })
      setInfo(r.backgroundNote)
      setSidebarTab('background')
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '생성 실패')
    } finally {
      setGenBusy(false)
    }
  }

  const applyStylePreset = useCallback(
    (presetId: string, scope: 'selected' | 'all') => {
      setDoc((prev) => {
        if (scope === 'selected' && selectedText) {
          return {
            ...prev,
            textLayers: prev.textLayers.map((t) =>
              t.id === selectedText.id ? applyTextStylePresetToItem(t, presetId) : t,
            ),
          }
        }
        return {
          ...prev,
          textLayers: prev.textLayers.map((t) => applyTextStylePresetToItem(t, presetId)),
        }
      })
      setInfo('스타일을 적용했습니다.')
    },
    [selectedText, setDoc],
  )

  const onRegenerateTextOnly = async () => {
    setTextOnlyBusy(true)
    setLocalError(null)
    try {
      const r = await regenerateStudioTextOnly({
        document: doc,
        topic,
        script: effectiveScript,
        titleHint,
        outputLanguage: outputLanguage,
      })
      setDoc(r.document)
      setInfo('문구를 AI로 다시 생성하고, 템플릿 분석 레이아웃에 맞춰 배치했습니다.')
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '문구 생성 실패')
    } finally {
      setTextOnlyBusy(false)
    }
  }

  const onClearTemplateCanvas = () => {
    if (
      !window.confirm(
        '캔버스를 비울까요?\n배경·문구·업로드 이미지·템플릿 분석 결과가 모두 지워지고 빈 화면이 됩니다.\n(템플릿 ID만 유지 — 「썸네일 템플릿」에서 다시 적용할 수 있습니다)',
      )
    ) {
      return
    }
    setDoc((prev) => clearStudioCanvas(prev))
    setSelected({ kind: 'background' })
    setInfo('캔버스를 비웠습니다. 「썸네일 템플릿」에서 다시 적용해 보세요.')
  }

  const reorderSelectedLayer = useCallback(
    (op: StudioLayerReorderOp) => {
      const layers = drawableSelectedLayers(selectedLayers)
      if (!layers.length) return
      setDoc((prev) => {
        let next = prev
        for (const ref of layers) {
          if (ref.kind === 'background') continue
          next = reorderStudioLayer(next, ref, op)
        }
        return next
      })
    },
    [selectedLayers, setDoc],
  )

  const deleteSelectedLayer = useCallback(() => {
    if (!selectedLayers.length) return
    const drawable = drawableSelectedLayers(selectedLayers)
    const deletingBackgroundImage =
      selectedLayers.some((r) => r.kind === 'background') && Boolean(doc.background.imageDataUrl)
    if (!drawable.length && !deletingBackgroundImage) return
    setDoc((prev) => deleteStudioLayers(prev, selectedLayers))
    if (deletingBackgroundImage && drawable.length === 0) {
      setSelected({ kind: 'background' })
    } else {
      setSelectedLayers([])
    }
  }, [selectedLayers, setDoc, doc.background.imageDataUrl, setSelected])

  const onRegenerateBackgroundOnly = async () => {
    if (!getProTemplate(doc.templateId)) return
    setBgOnlyBusy(true)
    setLocalError(null)
    setInfo('배경을 생성하고 문구 위치·크기를 분석하는 중…')
    try {
      let workDoc = doc
      if (!workDoc.templateStyle) {
        const fallback = buildFallbackTemplateStyleSpec(workDoc.templateId)
        if (fallback) workDoc = { ...workDoc, templateStyle: fallback }
      }
      const r = await regenerateStudioBackgroundOnly({
        document: workDoc,
        topic,
        script: effectiveScript,
        titleHint,
        outputLanguage: outputLanguage,
        ...thumbGenApiOpts,
        extraBackgroundHint: extraBgHint,
        analyzedBenchmarkStyle: analyzedBenchmarkStyle ?? undefined,
      })
      bgLoadedUrlRef.current = null
      setDoc(r.document)
      setInfo(r.backgroundNote)
      scheduleCanvasPaint()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '배경 생성 실패')
    } finally {
      setBgOnlyBusy(false)
    }
  }

  const onVerifyThumbnail = async () => {
    const hasText = doc.textLayers.some((t) => t.text.trim())
    if (!hasText && !doc.background.imageDataUrl) {
      setLocalError('검증할 썸네일이 비어 있습니다. 문구나 배경을 먼저 추가해 주세요.')
      return
    }
    setVerifyBusy(true)
    setLocalError(null)
    setVerifyReport(null)
    setVerifyPreviewUrl('')
    setVerifyModalOpen(true)
    setInfo('썸네일 CTR 검증을 실행하는 중…')
    try {
      const blob = await exportCanvasBlob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(new Error('썸네일 이미지 변환에 실패했습니다.'))
        r.readAsDataURL(blob)
      })
      setVerifyPreviewUrl(dataUrl)
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/i)
      if (!m?.[2]) throw new Error('썸네일 이미지 형식이 올바르지 않습니다.')
      const tpl = getProTemplate(doc.templateId)
      const { report } = await postThumbnailVerify({
        imageBase64: m[2],
        mimeType: m[1] || 'image/png',
        topic: topic.trim() || undefined,
        videoTitle: titleHint?.trim() || undefined,
        templateLabel: tpl?.label,
      })
      setVerifyReport(report)
      setInfo('썸네일 검증이 완료되었습니다.')
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '썸네일 검증 실패')
      setVerifyModalOpen(false)
    } finally {
      setVerifyBusy(false)
    }
  }

  const onApplyVerificationImprovements = async () => {
    if (!verifyReport) return
    setVerifyImproveBusy(true)
    setVerifyBusy(true)
    setLocalError(null)
    setInfo('검증 보완점을 반영해 문구·배치를 개선하는 중…')
    try {
      const prevScore = verifyReport.overallScore
      const { document: improved, improve, layoutNote } =
        await improveStudioFromVerificationReport({
          document: doc,
          report: verifyReport,
          topic,
          script: effectiveScript,
          titleHint,
          outputLanguage: outputLanguage,
        })
      setDoc(improved)
      scheduleCanvasPaint()

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

      const blob = await exportCanvasBlob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(new Error('썸네일 이미지 변환에 실패했습니다.'))
        r.readAsDataURL(blob)
      })
      setVerifyPreviewUrl(dataUrl)
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/i)
      if (!m?.[2]) throw new Error('썸네일 이미지 형식이 올바르지 않습니다.')
      const tpl = getProTemplate(improved.templateId)
      const { report: newReport } = await postThumbnailVerify({
        imageBase64: m[2],
        mimeType: m[1] || 'image/png',
        topic: topic.trim() || undefined,
        videoTitle: titleHint?.trim() || undefined,
        templateLabel: tpl?.label,
      })
      setVerifyReport(newReport)
      const delta = newReport.overallScore - prevScore
      const deltaNote =
        delta > 0
          ? ` (종합 ${prevScore}→${newReport.overallScore}, +${delta})`
          : delta < 0
            ? ` (종합 ${prevScore}→${newReport.overallScore})`
            : ` (종합 ${newReport.overallScore}점)`
      setInfo(
        [improve.summary, layoutNote, `재검증 완료${deltaNote}`].filter(Boolean).join(' · '),
      )
      setSidebarTab('text')
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '보완 반영 실패')
    } finally {
      setVerifyImproveBusy(false)
      setVerifyBusy(false)
    }
  }

  const onFitTextToBackground = async () => {
    if (!doc.background.imageDataUrl) {
      setLocalError('배경 이미지가 없습니다. AI 배경 생성 또는 이미지 업로드를 먼저 해 주세요.')
      return
    }
    setLayoutFitBusy(true)
    setLocalError(null)
    setInfo('배경을 분석해 문구 위치·크기를 조정하는 중…')
    try {
      const r = await fitStudioTextLayoutToBackground(doc)
      setDoc(r.document)
      setInfo(r.note)
      setSidebarTab('text')
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '문구 배치 분석 실패')
    } finally {
      setLayoutFitBusy(false)
    }
  }

  const updateText = useCallback(
    (id: string, patch: Partial<TextItem>) => {
      const nextPatch: Partial<TextItem> = { ...patch }
      if (nextPatch.fontSize !== undefined) {
        const fs = nextPatch.fontSize
        if (!Number.isFinite(fs) || fs <= 0) {
          return
        }
        nextPatch.fontSize = Math.min(160, Math.max(12, Math.round(fs)))
      }
      if (nextPatch.textAlign !== undefined) {
        const layer = docRef.current?.textLayers.find((t) => t.id === id)
        const ctx = canvasRef.current?.getContext('2d')
        if (layer && ctx && layer.textAlign !== nextPatch.textAlign) {
          const alignPatch = patchTextAlignPreservingBounds(ctx, layer, nextPatch.textAlign)
          Object.assign(nextPatch, alignPatch)
        }
      }
      setDoc((prev) => ({
        ...prev,
        textLayers: prev.textLayers.map((t) => (t.id === id ? { ...t, ...nextPatch } : t)),
      }))
    },
    [setDoc],
  )

  const commitInlineEdit = useCallback(() => {
    if (!inlineTextEdit) return
    const text = inlineTextEdit.draft.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    updateText(inlineTextEdit.id, { text })
    setInlineTextEdit(null)
  }, [inlineTextEdit, updateText])

  const cancelInlineEdit = useCallback(() => {
    setInlineTextEdit(null)
  }, [])

  const inlineEditLayer = inlineTextEdit
    ? doc.textLayers.find((t) => t.id === inlineTextEdit.id)
    : undefined

  const inlineEditorBox = useMemo(() => {
    if (!inlineTextEdit || !inlineEditLayer || !canvasRef.current || !canvasStageRef.current) {
      return null
    }
    const canvas = canvasRef.current
    const stage = canvasStageRef.current
    const canvasRect = canvas.getBoundingClientRect()
    const stageRect = stage.getBoundingClientRect()
    const scaleX = canvasRect.width / STUDIO_EDIT_CANVAS_W
    const scaleY = canvasRect.height / STUDIO_EDIT_CANVAS_H
    const item = inlineEditLayer
    const typo = resolveTextTypography(item)
    const ctx = canvas.getContext('2d')
    const measureStr = inlineTextEdit.draft || item.text
    const stageLeft = canvasRect.left - stageRect.left
    const stageTop = canvasRect.top - stageRect.top

    let left = stageLeft + (STUDIO_EDIT_BLEED + item.x) * scaleX
    let top = stageTop + (STUDIO_EDIT_BLEED + item.y) * scaleY
    let widthPx = Math.max(120, item.fontSize * scaleX * 4)
    let heightPx = item.fontSize * typo.lineHeight * scaleY
    let transformOrigin = '0% 50%'

    if (ctx && measureStr.trim()) {
      const met = measureTextMetrics(ctx, { ...item, text: measureStr })
      if (met) {
        const bleedLogical = Math.max(2, Math.ceil((item.strokeWidth ?? 0) * 0.35))
        const boxLeft = met.localLeft - bleedLogical
        const boxTop = met.localTop - bleedLogical
        const boxW = met.localRight - met.localLeft + bleedLogical * 2
        const boxH = met.localBottom - met.localTop + bleedLogical * 2

        left = stageLeft + (STUDIO_EDIT_BLEED + item.x + boxLeft) * scaleX
        top = stageTop + (STUDIO_EDIT_BLEED + item.y + boxTop) * scaleY
        widthPx = Math.max(40, boxW * scaleX)
        heightPx = Math.max(item.fontSize * scaleY * 0.5, boxH * scaleY)

        const pivotLocalX = met.centerX - item.x
        const pivotLocalY = met.centerY - item.y
        const originX = boxW > 0 ? ((pivotLocalX - boxLeft) / boxW) * 100 : 50
        const originY = boxH > 0 ? ((pivotLocalY - boxTop) / boxH) * 100 : 50
        transformOrigin = `${originX}% ${originY}%`
      }
    } else {
      heightPx = item.fontSize * typo.lineHeight * scaleY
      top -= heightPx / 2
      if (item.textAlign === 'center') left -= widthPx / 2
      if (item.textAlign === 'right') left -= widthPx
    }

    const rot = item.rotation ?? 0
    const scaleXF = typo.scaleX / 100
    const transforms: string[] = []
    if (rot) transforms.push(`rotate(${rot}deg)`)
    if (scaleXF !== 1) transforms.push(`scaleX(${scaleXF})`)
    const rowCount = Math.max(1, splitTextLines(measureStr).length)
    const contentLineHeightPx =
      rowCount === 1 ? heightPx : item.fontSize * typo.lineHeight * scaleY

    return {
      left,
      top,
      widthPx,
      heightPx,
      fontSizePx: item.fontSize * scaleY,
      lineHeightPx: contentLineHeightPx,
      rowCount,
      typo,
      item,
      transform: transforms.length ? transforms.join(' ') : undefined,
      transformOrigin,
    }
  }, [inlineTextEdit, inlineEditLayer, doc.textLayers, effectiveDisplayScale])

  useEffect(() => {
    if (!inlineTextEdit) return
    const el = inlineInputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [inlineTextEdit?.id])

  useEffect(() => {
    if (!inlineTextEdit) return
    scheduleCanvasPaint()
  }, [inlineTextEdit, scheduleCanvasPaint])

  const onAddTextFromDraft = useCallback(() => {
    const raw = (selectedText?.text ?? newTextDraft).trim()
    if (!raw) {
      setLocalError('텍스트를 입력해 주세요.')
      return
    }
    if (selectedText) {
      updateText(selectedText.id, { text: raw })
      setInfo('문구를 수정했습니다.')
      return
    }
    const t: TextItem = {
      id: newId(),
      kind: 'text',
      text: raw,
      x: STUDIO_CANVAS_W * 0.5,
      y: STUDIO_CANVAS_H * 0.5,
      fontSize: 56,
      fontFamily: DEFAULT_THUMBNAIL_FONT_STACK,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: DEFAULT_THUMBNAIL_TEXT_STROKE_WIDTH,
      textAlign: 'center',
      zIndex: 30 + doc.textLayers.length,
    }
    setDoc((prev) => ({ ...prev, textLayers: [...prev.textLayers, t] }))
    setSelected({ kind: 'text', id: t.id })
    setNewTextDraft('')
    setInfo('텍스트 레이어를 추가했습니다.')
  }, [selectedText, newTextDraft, doc.textLayers.length, setDoc, updateText])

  const copySelectedLayers = useCallback((): boolean => {
    const baseDoc = docRef.current ?? doc
    const clip = extractLayersForClipboard(baseDoc, selectedLayers)
    if (!clip) return false
    studioLayerClipboardRef.current = clip
    const n = clip.texts.length + clip.images.length + clip.shapes.length + clip.overlays.length
    setInfo(n > 1 ? `${n}개 레이어를 복사했습니다.` : '레이어를 복사했습니다.')
    return true
  }, [doc, selectedLayers])

  const pasteSelectedLayers = useCallback((): boolean => {
    const clip = studioLayerClipboardRef.current
    if (!clip) return false
    const baseDoc = docRef.current ?? doc
    const { document: nextDoc, newRefs } = pasteStudioLayerClipboard(baseDoc, clip)
    setDoc(nextDoc)
    setSelectedLayers(newRefs)
    setSidebarTab('elements')
    const n = newRefs.length
    setInfo(n > 1 ? `${n}개 레이어를 붙여넣었습니다.` : '레이어를 붙여넣었습니다.')
    return true
  }, [doc, setDoc])

  const onAddOverlay = useCallback(
    (preset: StudioOverlayPresetId) => {
      const layer = createOverlayFromPreset(preset, defaultOverlayZIndex(doc))
      setDoc((prev) => ({
        ...prev,
        overlayLayers: [...(prev.overlayLayers ?? []), layer],
      }))
      setSelected({ kind: 'overlay', id: layer.id })
      setSidebarTab('elements')
      setInfo(`${layer.name} 오버레이를 추가했습니다.`)
    },
    [doc, setDoc],
  )

  const onSelectLayer = useCallback(
    (ref: StudioLayerRef, modifiers?: { ctrl?: boolean; shift?: boolean }) => {
      setSelectedLayers((prev) => applyLayerClickSelection(prev, ref, modifiers ?? {}))
      if (ref.kind === 'text') setSidebarTab('text')
      else if (ref.kind === 'background') setSidebarTab('background')
      else if (ref.kind === 'overlay') setSidebarTab('layers')
      else if (ref.kind === 'shape' || ref.kind === 'image') setSidebarTab('elements')
      else setSidebarTab('layers')
    },
    [],
  )

  const pickCanvasLayerSelection = useCallback(
    (ref: StudioLayerRef, e: { ctrlKey: boolean; metaKey: boolean }) => {
      if (e.ctrlKey || e.metaKey) {
        const next = applyLayerClickSelection(selectedLayersRef.current, ref, { ctrl: true })
        setSelectedLayers(next)
        return { layers: next, active: isStudioLayerRefSelected(next, ref) }
      }
      setSelected(ref)
      return { layers: [ref], active: true }
    },
    [setSelected],
  )

  const multiMoveForLayer = useCallback(
    (ref: StudioLayerRef, layers: StudioLayerRef[]) => {
      const drawable = drawableSelectedLayers(layers)
      if (drawable.length <= 1 || !isStudioLayerRefSelected(drawable, ref)) return undefined
      const baseDoc = docRef.current
      if (!baseDoc) return undefined
      return buildMultiMoveSnapshot(baseDoc, drawable)
    },
    [],
  )

  const onToggleLayerVisible = useCallback(
    (ref: StudioLayerRef, visible: boolean) => {
      if (ref.kind === 'background') return
      setDoc((prev) => {
        if (ref.kind === 'text') {
          return {
            ...prev,
            textLayers: prev.textLayers.map((t) => (t.id === ref.id ? { ...t, visible } : t)),
          }
        }
        if (ref.kind === 'image') return updateImageLayer(prev, ref.id, { visible })
        if (ref.kind === 'overlay') return updateOverlayLayer(prev, ref.id, { visible })
        return updateShapeLayer(prev, ref.id, { visible })
      })
      scheduleCanvasPaint()
    },
    [setDoc, scheduleCanvasPaint],
  )

  const onAddWatermark = useCallback(
    (presetId: WatermarkPresetId) => {
      const preset = WATERMARK_PRESETS.find((p) => p.id === presetId)
      let custom: string | undefined
      if (preset?.editable) {
        const input = window.prompt(`${preset.label} 문구`, preset.defaultText)
        if (input === null) return
        custom = input
      }
      const layer = createWatermarkTextLayer(presetId, studioMaxZIndex(doc) + 1, custom)
      setDoc((prev) => ({ ...prev, textLayers: [...prev.textLayers, layer] }))
      setSelected({ kind: 'text', id: layer.id })
      setSidebarTab('text')
      setInfo(`${preset?.label ?? '워터마크'} 배지를 추가했습니다.`)
    },
    [doc, setDoc],
  )

  const onOpenFeedPreview = useCallback(async () => {
    setLocalError(null)
    try {
      const preview = await captureCanvasPreviewDataUrl()
      if (!preview) throw new Error('미리보기를 캡처하지 못했습니다.')
      setFeedPreviewSrc(preview)
      setFeedPreviewOpen(true)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '피드 미리보기 실패')
    }
  }, [captureCanvasPreviewDataUrl])

  const onSaveVariant = useCallback(async () => {
    setVariantBusy(true)
    setLocalError(null)
    try {
      const preview = await captureCanvasPreviewDataUrl()
      if (!preview) throw new Error('후보 미리보기 캡처 실패')
      const snapshot = cloneStudioDocument(docRef.current ?? doc)
      setVariants((prev) => {
        const next = pushStudioVariant(prev, {
          label: nextVariantLabel(prev),
          previewDataUrl: preview,
          document: snapshot,
        })
        const added = next[next.length - 1]
        if (added) setActiveVariantId(added.id)
        return next
      })
      setInfo('현재 캔버스를 A/B 후보로 저장했습니다.')
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '후보 저장 실패')
    } finally {
      setVariantBusy(false)
    }
  }, [captureCanvasPreviewDataUrl, doc])

  const onGenerateVariantAi = useCallback(async () => {
    setVariantBusy(true)
    setLocalError(null)
    try {
      const r = await regenerateStudioTextOnly({
        document: docRef.current ?? doc,
        topic,
        script: effectiveScript,
        titleHint,
        outputLanguage,
        ctrOptionIndex: variants.length % 10,
      })
      setDoc(r.document)
      scheduleCanvasPaint()
      await new Promise((resolve) => window.setTimeout(resolve, 120))
      const preview = await captureCanvasPreviewDataUrl()
      if (!preview) throw new Error('후보 미리보기 캡처 실패')
      const snapshot = cloneStudioDocument(r.document)
      setVariants((prev) => {
        const next = pushStudioVariant(prev, {
          label: nextVariantLabel(prev),
          previewDataUrl: preview,
          document: snapshot,
        })
        const added = next[next.length - 1]
        if (added) setActiveVariantId(added.id)
        return next
      })
      setInfo('AI 문구 후보를 생성해 저장했습니다.')
      setSidebarTab('ai')
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'AI 후보 생성 실패')
    } finally {
      setVariantBusy(false)
    }
  }, [
    topic,
    effectiveScript,
    titleHint,
    outputLanguage,
    setDoc,
    scheduleCanvasPaint,
    captureCanvasPreviewDataUrl,
  ])

  const onApplyVariant = useCallback(
    (id: string) => {
      const v = variants.find((x) => x.id === id)
      if (!v) return
      replaceDocWithoutHistory(cloneStudioDocument(v.document))
      setActiveVariantId(id)
      setSelected(null)
      scheduleCanvasPaint()
      setInfo(`「${v.label}」 후보를 캔버스에 적용했습니다.`)
    },
    [variants, replaceDocWithoutHistory, scheduleCanvasPaint],
  )

  const onRemoveVariant = useCallback((id: string) => {
    setVariants((prev) => prev.filter((x) => x.id !== id))
    setActiveVariantId((cur) => (cur === id ? null : cur))
  }, [])

  const onSaveSavedWork = useCallback(async () => {
    setSavedWorksBusy(true)
    setLocalError(null)
    try {
      const preview = await captureCanvasPreviewDataUrl()
      if (!preview) throw new Error('미리보기 캡처 실패')
      const snapshot = cloneStudioDocument(docRef.current ?? doc)
      const m = preview.match(/^data:[^;]+;base64,(.+)$/)
      const tpl = getProTemplate(snapshot.templateId)
      const meta = await saveThumbnailStudioSavedWork(projectId, {
        label: tpl?.label ?? snapshot.templateId,
        templateId: snapshot.templateId,
        source: 'manual',
        document: snapshot,
        previewBase64: m?.[1],
      })
      setActiveSavedWorkId(meta.id)
      await refreshSavedWorks()
      setInfo(`「${meta.label}」 작업을 프로젝트에 저장했습니다.`)
      setSidebarTab('works')
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '작업 저장 실패')
    } finally {
      setSavedWorksBusy(false)
    }
  }, [captureCanvasPreviewDataUrl, doc, projectId, refreshSavedWorks])

  const onLoadSavedWork = useCallback(
    async (id: string) => {
      setSavedWorksBusy(true)
      setLocalError(null)
      try {
        const { meta, document: loaded } = await fetchThumbnailStudioSavedWorkDocument(projectId, id)
        const withUrls: ThumbnailStudioDocument = {
          ...loaded,
          background: {
            ...loaded.background,
            imageDataUrl: resolveStudioAssetUrl(loaded.background.imageDataUrl),
          },
          imageLayers: loaded.imageLayers.map((layer) => ({
            ...layer,
            imageDataUrl: resolveStudioAssetUrl(layer.imageDataUrl) ?? layer.imageDataUrl,
          })),
        }
        const normalized = normalizeStudioDocument(withUrls)
        bgLoadedUrlRef.current = null
        resetHistory(normalized)
        replaceDocWithoutHistory(normalized)
        const mergedTabs = mergeActiveTabDocument(
          studioTabsRef.current,
          activeTabIdRef.current,
          normalized,
          { label: meta.label },
        )
        studioTabsRef.current = mergedTabs
        setStudioTabs(mergedTabs)
        savedSnapshotRef.current = JSON.stringify(normalized)
        setActiveSavedWorkId(meta.id)
        setActiveVariantId(null)
        setSelected(null)
        scheduleCanvasPaint()
        onDirtyChange?.(false)
        setInfo(`「${meta.label}」 저장 작업을 불러왔습니다.`)
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : '저장 작업 불러오기 실패')
      } finally {
        setSavedWorksBusy(false)
      }
    },
    [projectId, replaceDocWithoutHistory, resetHistory, scheduleCanvasPaint, onDirtyChange],
  )

  const onRemoveSavedWork = useCallback(
    async (id: string) => {
      const target = savedWorks.find((w) => w.id === id)
      if (
        !window.confirm(
          `「${target?.label ?? '저장 작업'}」을(를) 목록에서 삭제할까요?\n(프로젝트 썸네일 파일은 그대로입니다.)`,
        )
      ) {
        return
      }
      setSavedWorksBusy(true)
      setLocalError(null)
      try {
        await deleteThumbnailStudioSavedWork(projectId, id)
        setActiveSavedWorkId((cur) => (cur === id ? null : cur))
        await refreshSavedWorks()
        setInfo('저장 작업을 삭제했습니다.')
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : '삭제 실패')
      } finally {
        setSavedWorksBusy(false)
      }
    },
    [projectId, refreshSavedWorks, savedWorks],
  )

  const onAddShape = useCallback(
    (kind: StudioShapeKind) => {
      if (kind === 'arrow') {
        void (async () => {
          try {
            const dataUrl = await fetchStudioArrowStickerDataUrl()
            const layer = buildArrowStickerImageLayer(dataUrl, studioMaxZIndex(doc) + 1)
            setDoc((prev) => ({ ...prev, imageLayers: [...prev.imageLayers, layer] }))
            setSelected({ kind: 'image', id: layer.id })
            setSidebarTab('elements')
            setInfo('누끼 화살표 스티커를 추가했습니다. 드래그·모서리로 크기를 조절하세요.')
          } catch (e) {
            setLocalError(e instanceof Error ? e.message : '화살표 스티커를 불러오지 못했습니다.')
          }
        })()
        return
      }
      const shape = createDefaultShape(kind, studioMaxZIndex(doc) + 1)
      setDoc((prev) => ({ ...prev, shapeLayers: [...prev.shapeLayers, shape] }))
      setSelected({ kind: 'shape', id: shape.id })
      setSidebarTab('elements')
      setInfo(`${kind === 'line' ? '직선' : kind === 'rect' ? '사각형' : '타원'}을 추가했습니다.`)
    },
    [doc, setDoc],
  )

  const onAddElementPreset = useCallback(
    (presetId: string) => {
      const preset = getElementPreset(presetId)
      if (!preset) {
        setLocalError('요소를 찾을 수 없습니다.')
        return
      }
      setElementStickerPresetId(presetId)
      setLocalError(null)
      void (async () => {
        try {
          const hasSticker = await fetchElementStickerCached(presetId)
          if (!hasSticker && preset.pathD?.trim()) {
            setDoc((prev) => {
              const shape = createShapeFromPreset(preset, studioMaxZIndex(prev) + 1)
              setSelected({ kind: 'shape', id: shape.id })
              return { ...prev, shapeLayers: [...prev.shapeLayers, shape] }
            })
            setSidebarTab('elements')
            setInfo(`「${preset.label}」 도형을 추가했습니다.`)
            return
          }

          setInfo(`「${preset.label}」 AI 누끼 스티커 생성 중…`)
          const subject = resolveStickerSubject(preset)
          const { dataUrl, width, height } = await fetchElementStickerDataUrl(preset, subject)
          const aspect = width / Math.max(1, height)
          setDoc((prev) => {
            const layer = buildElementStickerImageLayer(
              preset,
              dataUrl,
              studioMaxZIndex(prev) + 1,
              aspect,
            )
            setSelected({ kind: 'image', id: layer.id })
            return { ...prev, imageLayers: [...prev.imageLayers, layer] }
          })
          setSidebarTab('elements')
          setInfo(`「${preset.label}」 누끼 스티커를 추가했습니다.`)
        } catch (e) {
          setLocalError(e instanceof Error ? e.message : 'AI 스티커 생성 실패')
        } finally {
          setElementStickerPresetId(null)
        }
      })()
    },
    [setDoc],
  )

  useEffect(() => {
    if (selected?.kind !== 'image') return
    const id = selected.id
    const layer = doc.imageLayers.find((l) => l.id === id)
    const img = overlayRefs.current.get(id)
    if (!layer || layer.crop || !img?.complete) return
    const iw = img.naturalWidth || img.width
    const ih = img.naturalHeight || img.height
    if (!iw || !ih) return
    setDoc((p) => updateImageLayer(p, id, { crop: fullImageCrop(iw, ih) }))
  }, [selected, doc.imageLayers, setDoc])

  const startImageCrop = useCallback(
    (id: string) => {
      const layer = docRef.current?.imageLayers.find((l) => l.id === id)
      const img = overlayRefs.current.get(id)
      if (!layer || layer.locked || !img?.complete) return
      const imgW = img.naturalWidth || img.width
      const imgH = img.naturalHeight || img.height
      if (!imgW || !imgH) return
      const crop = resolveImageLayerCrop(layer, imgW, imgH)
      const fullCanvas = fullImageCanvasBounds(layer, crop, imgW, imgH)
      setImageCropSession({
        layerId: id,
        anchorLayer: { ...layer, crop },
        fullCanvas,
        crop,
        imgW,
        imgH,
      })
      setSelected({ kind: 'image', id })
      setSidebarTab('elements')
      scheduleCanvasPaint()
    },
    [setSelected, scheduleCanvasPaint],
  )

  const cancelImageCrop = useCallback(() => {
    setImageCropSession(null)
    dragLiveRef.current = null
    scheduleCanvasPaint()
  }, [scheduleCanvasPaint])

  const applyImageCrop = useCallback(() => {
    const session = imageCropSessionRef.current
    if (!session) return
    const liveCrop = dragLiveRef.current?.image?.[session.layerId]?.crop
    const newCrop = liveCrop ?? session.crop
    const oldCrop = resolveImageLayerCrop(session.anchorLayer, session.imgW, session.imgH)
    const patch = applyCommittedImageCrop(session.anchorLayer, oldCrop, newCrop, session.imgW, session.imgH)
    setDoc((p) => updateImageLayer(p, session.layerId, patch))
    setImageCropSession(null)
    dragLiveRef.current = null
    scheduleCanvasPaint()
  }, [setDoc, scheduleCanvasPaint])

  useEffect(() => {
    if (!imageCropSession) return
    if (selected?.kind !== 'image' || selected.id !== imageCropSession.layerId) {
      setImageCropSession(null)
      dragLiveRef.current = null
    }
  }, [selected, imageCropSession])

  useEffect(() => {
    if (selected?.kind === 'text') setSidebarTab('text')
    if (selected?.kind === 'image' || selected?.kind === 'shape') setSidebarTab('elements')
    if (selected?.kind === 'overlay') setSidebarTab('layers')
    if (selected?.kind === 'background' && doc.background.imageDataUrl) setSidebarTab('background')
  }, [selected?.kind, doc.background.imageDataUrl])

  const buildOverlayLayer = useCallback(
    (
      file: File,
      dataUrl: string,
      size: { width: number; height: number },
      natural: { width: number; height: number },
      stackIndex: number,
      baseZ: number,
    ): StudioImageLayer => ({
      id: newId(),
      kind: 'image',
      name: file.name.slice(0, 24),
      imageDataUrl: dataUrl,
      x: STUDIO_CANVAS_W * 0.52,
      y: Math.round(STUDIO_CANVAS_H * 0.12 + stackIndex * 28),
      width: size.width,
      height: size.height,
      crop: fullImageCrop(natural.width, natural.height),
      opacity: 1,
      zIndex: baseZ + stackIndex,
      visible: true,
    }),
    [],
  )

  const measureOverlaySize = useCallback(
    (nw: number, nh: number): { width: number; height: number } => {
      const ratio = nw / nh
      let height = STUDIO_CANVAS_H * 0.55
      let width = height * ratio
      if (width > STUDIO_CANVAS_W * 0.45) {
        width = STUDIO_CANVAS_W * 0.45
        height = width / ratio
      }
      return { width: Math.round(width), height: Math.round(height) }
    },
    [],
  )

  const onPickOverlayImage = useCallback(
    (input: File | File[] | null) => {
      if (!input) return
      const files = (Array.isArray(input) ? input : [input]).filter((f) =>
        f.type.startsWith('image/'),
      )
      if (!files.length) {
        setLocalError('이미지 파일(JPEG, PNG, WebP)만 올릴 수 있습니다.')
        return
      }

      let pending = files.length
      const layers: StudioImageLayer[] = []
      const baseZ = studioMaxZIndex(docRef.current ?? doc) + 1

      const flush = () => {
        if (layers.length === 0) return
        setDoc((prev) => ({
          ...prev,
          imageLayers: [...prev.imageLayers, ...layers],
        }))
        const last = layers[layers.length - 1]!
        setSelected({ kind: 'image', id: last.id })
        setSidebarTab('elements')
        setInfo(
          layers.length === 1
            ? '이미지 레이어를 추가했습니다. 캔버스에서 드래그·크기 조절하세요.'
            : `이미지 ${layers.length}개를 레이어로 추가했습니다.`,
        )
      }

      files.forEach((file, fileIndex) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          const img = new Image()
          const done = (size: { width: number; height: number }, natural: { width: number; height: number }) => {
            layers.push(
              buildOverlayLayer(file, dataUrl, size, natural, fileIndex, baseZ),
            )
            pending -= 1
            if (pending === 0) flush()
          }
          img.onload = () => {
            const nw = img.naturalWidth || img.width || 1
            const nh = img.naturalHeight || img.height || 1
            done(measureOverlaySize(nw, nh), { width: nw, height: nh })
          }
          img.onerror = () => {
            const fallback = {
              width: Math.round(STUDIO_CANVAS_W * 0.38),
              height: Math.round(STUDIO_CANVAS_H * 0.55),
            }
            done(fallback, fallback)
          }
          img.src = dataUrl
        }
        reader.onerror = () => {
          pending -= 1
          if (pending === 0) flush()
        }
        reader.readAsDataURL(file)
      })
    },
    [buildOverlayLayer, measureOverlaySize, setDoc],
  )

  const canvasToLogical = (clientX: number, clientY: number) => {
    const c = canvasRef.current
    if (!c) return { px: 0, py: 0 }
    const rect = c.getBoundingClientRect()
    const scaleX = STUDIO_EDIT_CANVAS_W / rect.width
    const scaleY = STUDIO_EDIT_CANVAS_H / rect.height
    return {
      px: (clientX - rect.left) * scaleX - STUDIO_EDIT_BLEED,
      py: (clientY - rect.top) * scaleY - STUDIO_EDIT_BLEED,
    }
  }

  const getBackgroundBounds = useCallback((): LayerBounds | null => {
    if (!doc.background.imageDataUrl) return null
    return resolveStudioBackgroundLayout(doc.background.layout, bgImageRef.current, {
      layoutCustomized: doc.background.layoutCustomized,
    })
  }, [doc.background.imageDataUrl, doc.background.layout, doc.background.layoutCustomized])

  const onCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!ctx || tplAnalyzeBusy || genBusy) return
    const { px, py } = canvasToLogical(e.clientX, e.clientY)
    let hit = hitTestText(ctx, doc.textLayers, px, py)
    if (!hit && selected?.kind === 'text') {
      const sel = doc.textLayers.find((t) => t.id === selected.id)
      if (sel && hitTestTextOrientedBody(ctx, sel, px, py)) hit = sel
    }
    if (!hit) return

    e.preventDefault()
    dragRef.current = null
    dragLiveRef.current = null
    setSelected({ kind: 'text', id: hit.id })
    setInlineTextEdit({ id: hit.id, draft: hit.text })
    setSidebarTab('text')
  }

  const onCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!ctx || tplAnalyzeBusy || genBusy || textRewriteBusy || textRegenerateBusy) return
    const { px, py } = canvasToLogical(e.clientX, e.clientY)
    const hit = hitTestText(ctx, doc.textLayers, px, py)
    if (!hit?.text.trim()) return
    e.preventDefault()
    e.stopPropagation()
    setTextContextMenu({ x: e.clientX, y: e.clientY, textId: hit.id })
    setSelected({ kind: 'text', id: hit.id })
    setSidebarTab('text')
  }

  const onRewriteTextFromContextMenu = async (presetId: ThumbnailTextRewritePresetId) => {
    if (!textContextMenu) return
    setTextContextMenu(null)
    setTextRewriteBusy(true)
    setLocalError(null)
    try {
      const next = await rewriteThumbnailTextLayer({
        document: doc,
        textLayerId: textContextMenu.textId,
        presetId,
        topic,
        script: effectiveScript,
        titleHint,
        outputLanguage: outputLanguage,
      })
      setDoc(next)
      setInfo(
        linkedHookHighlight
          ? 'AI가 연결된 상단 문구(1·2줄)를 더 후킹되게 다시 썼습니다.'
          : 'AI가 문구를 더 후킹되게 다시 썼습니다.',
      )
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '문구 재작성 실패')
    } finally {
      setTextRewriteBusy(false)
    }
  }

  const onBenchmarkFile = async (file: File | null) => {
    setBenchmarkSourceFile(file)
    if (!file) {
      setAnalyzedBenchmarkStyle(null)
      return
    }
    setBenchmarkBusy(true)
    setLocalError(null)
    try {
      const { base64, mimeType } = await fileToBase64Parts(file)
      const { description } = await postThumbnailBenchmarkAnalyze({ imageBase64: base64, mimeType })
      setAnalyzedBenchmarkStyle(description)
      setInfo('벤치마크 스타일을 분석했습니다. 「참고 리믹스」로 배경·문구를 만들거나, 다음 배경 AI 생성에 반영할 수 있습니다.')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '벤치마크 분석 실패')
    } finally {
      setBenchmarkBusy(false)
    }
  }

  const onBenchmarkRemix = async () => {
    const file = benchmarkSourceFile
    if (!file) {
      setLocalError('먼저 참고 썸네일 이미지를 업로드해 주세요.')
      return
    }
    setBenchmarkRemixBusy(true)
    setLocalError(null)
    try {
      const { base64, mimeType } = await fileToBase64Parts(file)
      const tpl = getProTemplate(doc.templateId)
      const slotSpec = resolveTwoLineCopySlotSpec(doc)
      const line1Max = slotSpec?.line1Max ?? tpl?.textSlots.at(-2)?.maxCharacters ?? 24
      const line2Max = slotSpec?.line2Max ?? tpl?.textSlots.at(-1)?.maxCharacters ?? 28

      const result = await postThumbnailReferenceRemix({
        imageBase64: base64,
        mimeType,
        topic,
        script: effectiveScript,
        videoTitle: titleHint,
        outputLanguage,
        line1Max,
        line2Max,
        ...thumbGenApiOpts,
      })

      const { base64: imgB64, mimeType: imgMime } = await fetchUrlAsBase64(result.imageUrl)
      const mime = imgMime.startsWith('image/') ? imgMime : 'image/png'
      const dataUrl = `data:${mime};base64,${imgB64}`
      const cover = await coverLayoutForImageSource(dataUrl).catch(() => null)

      let nextDoc = fillBackgroundImage(doc, dataUrl, 'ai', cover)
      nextDoc = applyCopyComboToDocument(nextDoc, {
        id: 'reference-remix',
        line1: result.line1,
        line2: result.line2,
      })

      const fitted = await fitStudioTextLayoutToBackground(nextDoc)
      nextDoc = ensureThumbnailCopyFullyVisible(fitted.document)
      setDoc(nextDoc)
      setAnalyzedBenchmarkStyle(result.styleNote)
      setInfo(
        `참고 리믹스 완료 — 글자 없는 배경을 적용하고 하단 2줄 문구를 넣었습니다.\n1줄: ${result.line1}\n2줄: ${result.line2}`,
      )
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '참고 리믹스 실패')
    } finally {
      setBenchmarkRemixBusy(false)
    }
  }

  const onApplyBgMood = (hint: string) => {
    setExtraBgHint(hint)
    setInfo('배경 무드 지시를 적용했습니다. 「배경 AI 생성」을 눌러 반영하세요.')
    setSidebarTab('ai')
  }

  const onExtractPalette = async () => {
    const url = doc.background.imageDataUrl?.trim()
    if (!url) return
    setPaletteBusy(true)
    setLocalError(null)
    try {
      const palette = await extractPaletteFromImage(url)
      setExtractedPalette(palette)
      setInfo('배경에서 색 팔레트를 추출했습니다. 스와치를 클릭해 문구 색에 적용하세요.')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '색 추출 실패')
    } finally {
      setPaletteBusy(false)
    }
  }

  const onApplyPaletteColor = (hex: string, scope: 'selected' | 'all') => {
    setDoc((prev) =>
      applyPaletteToTextLayers(prev, [hex], scope, selectedText?.id),
    )
    setInfo(scope === 'selected' ? '선택 문구에 색을 적용했습니다.' : '모든 문구에 색을 적용했습니다.')
  }

  const onMagicEnhance = async () => {
    const url = doc.background.imageDataUrl?.trim()
    if (!url) return
    setMagicEnhanceBusy(true)
    setLocalError(null)
    try {
      const enhanced = await enhanceBackgroundImage(url)
      setDoc((prev) => fillBackgroundImage(prev, enhanced, prev.background.source, prev.background.layout ?? null))
      setInfo('배경 밝기·대비·채도를 자동 보정했습니다.')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '화질 보정 실패')
    } finally {
      setMagicEnhanceBusy(false)
    }
  }

  const onAutoTextContrast = async () => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!ctx) return
    setAutoContrastBusy(true)
    setLocalError(null)
    try {
      const next = await applySmartTextContrast(doc, ctx)
      setDoc(next)
      setInfo('배경 밝기에 맞춰 문구 색·테두리를 자동 조정했습니다.')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '가독성 보정 실패')
    } finally {
      setAutoContrastBusy(false)
    }
  }

  const onGenerateHookSuggestions = async () => {
    setHookBusy(true)
    setLocalError(null)
    try {
      const tpl = getProTemplate(doc.templateId)
      const maxChars = tpl?.textSlots[0]?.maxCharacters ?? 24
      const { hooks } = await postThumbnailHookSuggestions({
        topic,
        script: effectiveScript,
        videoTitle: titleHint,
        outputLanguage,
        maxCharacters: maxChars,
        count: 5,
      })
      setHookSuggestions(hooks)
      setInfo('훅 후보를 생성했습니다. 항목을 클릭하면 선택 문구(또는 첫 슬롯)에 적용됩니다.')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '훅 생성 실패')
    } finally {
      setHookBusy(false)
    }
  }

  const onApplyHookSuggestion = (text: string) => {
    const targetId =
      selectedText?.id ??
      doc.textLayers.find((t) => t.text.trim())?.id ??
      doc.textLayers[0]?.id
    if (!targetId) return
    setDoc((prev) => ({
      ...prev,
      textLayers: prev.textLayers.map((t) => (t.id === targetId ? { ...t, text } : t)),
    }))
    setSelected({ kind: 'text', id: targetId })
    setInfo('훅 문구를 적용했습니다.')
    setSidebarTab('text')
  }

  const runRegenerateTextLayer = async (textId: string) => {
    setTextRegenerateBusy(true)
    setLocalError(null)
    try {
      const next = await regenerateThumbnailTextLayerFromScript({
        document: doc,
        textLayerId: textId,
        topic,
        script: effectiveScript,
        titleHint,
        outputLanguage,
      })
      setDoc(next)
      const layer = next.textLayers.find((t) => t.id === textId)
      if (layer) setInlineTextEdit({ id: textId, draft: layer.text })
      setInfo(
        linkedHookHighlight
          ? '대본·주제 기준으로 연결된 1·2줄 문구를 새로 생성했습니다.'
          : '대본·주제 기준으로 선택 문구를 새로 생성했습니다.',
      )
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'AI 텍스트 재생성 실패')
    } finally {
      setTextRegenerateBusy(false)
    }
  }

  const onRegenerateSelectedText = async () => {
    const textId = selectedText?.id
    if (!textId) {
      setLocalError('재생성할 문구를 캔버스에서 선택하세요.')
      setSidebarTab('text')
      return
    }
    await runRegenerateTextLayer(textId)
  }

  const onRegenerateTextFromContextMenu = async () => {
    if (!textContextMenu || textRegenerateBusy || textRewriteBusy) return
    const textId = textContextMenu.textId
    setTextContextMenu(null)
    setSelected({ kind: 'text', id: textId })
    setSidebarTab('text')
    await runRegenerateTextLayer(textId)
  }

  const onRewriteTextPreset = async (presetId: ThumbnailTextRewritePresetId) => {
    const textId = selectedText?.id
    if (!textId) {
      setLocalError('톤을 바꿀 문구를 캔버스에서 선택하세요.')
      return
    }
    setTextRewriteBusy(true)
    setLocalError(null)
    try {
      const next = await rewriteThumbnailTextLayer({
        document: doc,
        textLayerId: textId,
        presetId,
        topic,
        script: effectiveScript,
        titleHint,
        outputLanguage,
      })
      setDoc(next)
      setInfo('AI가 선택 문구 톤을 변경했습니다.')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '문구 재작성 실패')
    } finally {
      setTextRewriteBusy(false)
    }
  }

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (inlineTextEdit) {
      commitInlineEdit()
    }
    hoveredLayerRef.current = null
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!ctx) return
    const { px, py } = canvasToLogical(e.clientX, e.clientY)

    if (selected?.kind === 'text') {
      const t = doc.textLayers.find((l) => l.id === selected.id)
      if (t?.text.trim()) {
        if (hitTestTextRotateHandle(ctx, t, px, py)) {
          const rotHandle = getTextRotateHandlePosition(ctx, t)
          if (rotHandle) {
            dragRef.current = {
              kind: 'rotate-text',
              id: t.id,
              pivotX: rotHandle.pivotX,
              pivotY: rotHandle.pivotY,
              startRotation: t.rotation ?? 0,
              startPointerX: px,
              startPointerY: py,
            }
          }
          e.currentTarget.setPointerCapture(e.pointerId)
          return
        }
        const bounds = textItemToBounds(ctx, t)
        if (bounds) {
          const handle = hitTestTextOrientedResizeHandle(ctx, t, px, py)
          if (handle) {
            const met = measureTextMetrics(ctx, t)
            dragRef.current = {
              kind: 'resize-text',
              id: t.id,
              handle,
              textAnchor: { bounds, fontSize: t.fontSize, textAlign: t.textAlign },
              pivotX: met?.centerX ?? t.x,
              pivotY: met?.centerY ?? t.y,
              rotation: t.rotation ?? 0,
              startX: px,
              startY: py,
            }
            e.currentTarget.setPointerCapture(e.pointerId)
            return
          }
        }
      }
    }
    if (selected?.kind === 'image') {
      const layer = doc.imageLayers.find((l) => l.id === selected.id)
      if (layer && !layer.locked) {
        const cropSession = imageCropSessionRef.current
        if (cropSession?.layerId === layer.id) {
          const bounds = imageLayerBounds(layer)
          const pivot = layerPivot(bounds)
          const local = pointerToLocal(px, py, pivot.x, pivot.y, layer.rotation ?? 0)
          const liveCrop = dragLiveRef.current?.image?.[layer.id]?.crop
          const crop = liveCrop ?? cropSession.crop
          const cropCanvas = cropToCanvasBounds(cropSession.fullCanvas, crop, cropSession.imgW, cropSession.imgH)
          const handle = hitTestResizeHandle(cropCanvas, local.x, local.y)
          if (handle) {
            dragRef.current = {
              kind: 'resize-image-crop',
              id: layer.id,
              handle,
              anchorCrop: crop,
              anchorCropCanvas: cropCanvas,
              fullCanvas: cropSession.fullCanvas,
              layerAnchor: bounds,
              rotation: layer.rotation ?? 0,
              imgW: cropSession.imgW,
              imgH: cropSession.imgH,
            }
            e.currentTarget.setPointerCapture(e.pointerId)
            return
          }
          if (hitTestBounds(cropCanvas, local.x, local.y)) {
            dragRef.current = {
              kind: 'move-image-crop',
              id: layer.id,
              anchorCrop: crop,
              anchorCropCanvas: cropCanvas,
              fullCanvas: cropSession.fullCanvas,
              layerAnchor: bounds,
              rotation: layer.rotation ?? 0,
              imgW: cropSession.imgW,
              imgH: cropSession.imgH,
              startLocalX: local.x,
              startLocalY: local.y,
            }
            e.currentTarget.setPointerCapture(e.pointerId)
            return
          }
          return
        }
        const bounds = imageLayerBounds(layer)
        if (hitTestLayerRotateHandle(bounds, layer.rotation ?? 0, px, py)) {
          const rotH = getLayerRotateHandlePosition(bounds, layer.rotation ?? 0)
          dragRef.current = {
            kind: 'rotate-image',
            id: layer.id,
            pivotX: rotH.pivotX,
            pivotY: rotH.pivotY,
            startRotation: layer.rotation ?? 0,
            startPointerX: px,
            startPointerY: py,
          }
          e.currentTarget.setPointerCapture(e.pointerId)
          return
        }
        const pivot = layerPivot(bounds)
        const local = pointerToLocal(px, py, pivot.x, pivot.y, layer.rotation ?? 0)
        const handle = hitTestResizeHandle(bounds, local.x, local.y)
        if (handle) {
          dragRef.current = {
            kind: 'resize-image',
            id: layer.id,
            handle,
            anchor: bounds,
            startX: px,
            startY: py,
          }
          e.currentTarget.setPointerCapture(e.pointerId)
          return
        }
      }
    }
    if (selected?.kind === 'background' && !doc.background.locked) {
      const bounds = getBackgroundBounds()
      if (bounds) {
        const handle = hitTestResizeHandle(bounds, px, py)
        if (handle) {
          dragRef.current = {
            kind: 'resize-background',
            handle,
            anchor: bounds,
            startX: px,
            startY: py,
          }
          e.currentTarget.setPointerCapture(e.pointerId)
          return
        }
      }
    }
    if (selected?.kind === 'shape') {
      const shape = doc.shapeLayers.find((s) => s.id === selected.id)
      if (shape) {
        if (hitTestShapeRotateHandle(shape, px, py)) {
          const rotH = getShapeRotateHandlePosition(shape)
          if (rotH) {
            dragRef.current = {
              kind: 'rotate-shape',
              id: shape.id,
              pivotX: rotH.pivotX,
              pivotY: rotH.pivotY,
              startRotation: shape.rotation ?? 0,
              startPointerX: px,
              startPointerY: py,
            }
            e.currentTarget.setPointerCapture(e.pointerId)
            return
          }
        }
        if (shape.kind === 'rect' || shape.kind === 'ellipse' || shape.kind === 'path') {
          const bounds = shapeUnrotatedBounds(shape)
          if (bounds) {
            const pivot = layerPivot(bounds)
            const local = pointerToLocal(px, py, pivot.x, pivot.y, shape.rotation ?? 0)
            const handle = hitTestResizeHandle(bounds, local.x, local.y)
            if (handle) {
              dragRef.current = {
                kind: 'resize-shape',
                id: shape.id,
                handle,
                anchor: bounds,
                startX: px,
                startY: py,
                rotation: shape.rotation ?? 0,
              }
              e.currentTarget.setPointerCapture(e.pointerId)
              return
            }
          }
        }
      }
    }

    const outsideExportFrame =
      px < 0 || py < 0 || px > STUDIO_CANVAS_W || py > STUDIO_CANVAS_H
    if (outsideExportFrame) {
      setSelectedLayers([])
      dragRef.current = null
      return
    }

    const top = hitTestTopOverlayLayer(doc, px, py, (x, y) => {
      const t = hitTestText(ctx, doc.textLayers, x, y)
      return t ? { id: t.id, zIndex: t.zIndex } : null
    })
    if (top?.kind === 'text') {
      const hitText = doc.textLayers.find((t) => t.id === top.id)!
      const pick = pickCanvasLayerSelection({ kind: 'text', id: hitText.id }, e)
      if (!pick.active) {
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
      if (e.detail >= 2) return
      if (e.shiftKey && hitText.text.trim()) {
        const idx = charIndexFromPointer(ctx, hitText, px, py)
        if (idx != null) {
          setTextFillRange({ textId: hitText.id, start: idx, end: idx })
          dragRef.current = {
            kind: 'text-fill-select',
            id: hitText.id,
            anchor: idx,
            start: idx,
            end: idx,
          }
          e.currentTarget.setPointerCapture(e.pointerId)
          scheduleCanvasPaint()
          return
        }
      }
      dragRef.current = {
        kind: 'text',
        id: hitText.id,
        ox: hitText.x,
        oy: hitText.y,
        startX: px,
        startY: py,
        multi: multiMoveForLayer({ kind: 'text', id: hitText.id }, pick.layers),
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (top?.kind === 'image') {
      const hitImg = doc.imageLayers.find((l) => l.id === top.id)!
      const pick = pickCanvasLayerSelection({ kind: 'image', id: hitImg.id }, e)
      if (!pick.active) {
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
      if (e.detail >= 2) return
      if (hitImg.locked) {
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
      dragRef.current = {
        kind: 'image',
        id: hitImg.id,
        ox: hitImg.x,
        oy: hitImg.y,
        startX: px,
        startY: py,
        multi: multiMoveForLayer({ kind: 'image', id: hitImg.id }, pick.layers),
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (top?.kind === 'shape') {
      const shape = doc.shapeLayers.find((s) => s.id === top.id)!
      const pick = pickCanvasLayerSelection({ kind: 'shape', id: shape.id }, e)
      if (!pick.active) {
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
      if (shape.kind === 'arrow' || shape.kind === 'line') {
        const part =
          top.shapeHit.part === 'start' || top.shapeHit.part === 'end' || top.shapeHit.part === 'move'
            ? top.shapeHit.part
            : 'move'
        dragRef.current = {
          kind: 'shape-line',
          id: shape.id,
          part,
          startPx: px,
          startPy: py,
          origin: shape,
        }
      } else {
        dragRef.current = {
          kind: 'shape-move',
          id: shape.id,
          startPx: px,
          startPy: py,
          origin: shape,
          multi: multiMoveForLayer({ kind: 'shape', id: shape.id }, pick.layers),
        }
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    const bgBounds = getBackgroundBounds()
    if (bgBounds && !doc.background.locked) {
      const handle = hitTestResizeHandle(bgBounds, px, py)
      if (handle) {
        setSelected({ kind: 'background' })
        dragRef.current = {
          kind: 'resize-background',
          handle,
          anchor: bgBounds,
          startX: px,
          startY: py,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
    }
    if (bgBounds && hitTestBounds(bgBounds, px, py)) {
      setSelected({ kind: 'background' })
      if (doc.background.locked) {
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
      dragRef.current = {
        kind: 'background',
        ox: bgBounds.x,
        oy: bgBounds.y,
        startX: px,
        startY: py,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    setSelectedLayers([])
    dragRef.current = null
  }

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    if (!d) {
      let nextHover: StudioLayerRef | null = null
      if (!inlineTextEdit && !tplAnalyzeBusy && !genBusy) {
        const c = canvasRef.current
        const ctx = c?.getContext('2d')
        if (ctx) {
          const { px, py } = canvasToLogical(e.clientX, e.clientY)
          const hit = hitTestText(ctx, docRef.current?.textLayers ?? [], px, py)
          if (
            hit &&
            !isStudioLayerRefSelected(selectedLayersRef.current, { kind: 'text', id: hit.id })
          ) {
            nextHover = { kind: 'text', id: hit.id }
          }
        }
      }
      const prev = hoveredLayerRef.current
      const hoverChanged =
        (prev === null) !== (nextHover === null) ||
        (prev !== null &&
          nextHover !== null &&
          (prev.kind !== nextHover.kind || prev.id !== nextHover.id))
      if (hoverChanged) {
        hoveredLayerRef.current = nextHover
        scheduleCanvasPaint()
      }
      return
    }
    e.preventDefault()
    const { px, py } = canvasToLogical(e.clientX, e.clientY)

    if (d.kind === 'text') {
      const dx = px - d.startX
      const dy = py - d.startY
      if (d.multi) {
        const text: NonNullable<DragLiveOverlay['text']> = {}
        for (const [id, o] of Object.entries(d.multi.text)) {
          text[id] = { x: o.ox + dx, y: o.oy + dy }
        }
        const image: NonNullable<DragLiveOverlay['image']> = {}
        for (const [id, o] of Object.entries(d.multi.image)) {
          const layer = docRef.current?.imageLayers.find((l) => l.id === id)
          image[id] = {
            x: o.ox + dx,
            y: o.oy + dy,
            width: layer?.width ?? 0,
            height: layer?.height ?? 0,
            rotation: layer?.rotation ?? 0,
          }
        }
        const shapes: NonNullable<DragLiveOverlay['shapes']> = {}
        for (const [id, origin] of Object.entries(d.multi.shape)) {
          shapes[id] = offsetShapeLayer(origin, dx, dy)
        }
        dragLiveRef.current = { text, image, shapes }
      } else {
        dragLiveRef.current = {
          text: { [d.id]: { x: d.ox + dx, y: d.oy + dy } },
        }
      }
      scheduleCanvasPaint()
      return
    }
    if (d.kind === 'text-fill-select') {
      const c = canvasRef.current
      const ctx = c?.getContext('2d')
      const layer = docRef.current?.textLayers.find((t) => t.id === d.id)
      if (ctx && layer) {
        const idx = charIndexFromPointer(ctx, layer, px, py) ?? d.anchor
        const start = Math.min(d.anchor, idx)
        const end = Math.max(d.anchor, idx)
        dragRef.current = { ...d, start, end }
        setTextFillRange({ textId: d.id, start, end })
        scheduleCanvasPaint()
      }
      return
    }
    if (d.kind === 'image') {
      const layer = docRef.current?.imageLayers.find((l) => l.id === d.id)
      const dx = px - d.startX
      const dy = py - d.startY
      if (d.multi) {
        const text: NonNullable<DragLiveOverlay['text']> = {}
        for (const [id, o] of Object.entries(d.multi.text)) {
          text[id] = { x: o.ox + dx, y: o.oy + dy }
        }
        const image: NonNullable<DragLiveOverlay['image']> = {}
        for (const [id, o] of Object.entries(d.multi.image)) {
          const imgLayer = docRef.current?.imageLayers.find((l) => l.id === id)
          image[id] = {
            x: o.ox + dx,
            y: o.oy + dy,
            width: imgLayer?.width ?? 0,
            height: imgLayer?.height ?? 0,
            rotation: imgLayer?.rotation ?? 0,
          }
        }
        const shapes: NonNullable<DragLiveOverlay['shapes']> = {}
        for (const [id, origin] of Object.entries(d.multi.shape)) {
          shapes[id] = offsetShapeLayer(origin, dx, dy)
        }
        dragLiveRef.current = { text, image, shapes }
      } else {
        dragLiveRef.current = {
          image: {
            [d.id]: {
              x: d.ox + dx,
              y: d.oy + dy,
              width: layer?.width ?? 0,
              height: layer?.height ?? 0,
              rotation: layer?.rotation ?? 0,
            },
          },
        }
      }
      scheduleCanvasPaint()
      return
    }
    if (d.kind === 'background') {
      const base = docRef.current
      dragLiveRef.current = {
        background: {
          x: d.ox + (px - d.startX),
          y: d.oy + (py - d.startY),
          width: base?.background.layout?.width ?? STUDIO_CANVAS_W,
          height: base?.background.layout?.height ?? STUDIO_CANVAS_H,
        },
      }
      scheduleCanvasPaint()
      return
    }
    if (d.kind === 'resize-image') {
      const layer = docRef.current?.imageLayers.find((l) => l.id === d.id)
      const rot = layer?.rotation ?? 0
      const pivot = layerPivot(d.anchor)
      const local = pointerToLocal(px, py, pivot.x, pivot.y, rot)
      const nextBounds = isCornerResizeHandle(d.handle)
        ? resizeBoundsProportional(d.anchor, d.handle, local.x, local.y)
        : resizeBoundsWithHandle(d.anchor, d.handle, local.x, local.y, d.anchor)
      dragLiveRef.current = {
        image: {
          [d.id]: {
            x: nextBounds.x,
            y: nextBounds.y,
            width: nextBounds.width,
            height: nextBounds.height,
            rotation: rot,
          },
        },
      }
      scheduleCanvasPaint()
      return
    }
    if (d.kind === 'resize-image-crop' || d.kind === 'move-image-crop') {
      const layer = docRef.current?.imageLayers.find((l) => l.id === d.id)
      if (!layer) return
      const pivot = layerPivot(d.layerAnchor)
      const local = pointerToLocal(px, py, pivot.x, pivot.y, d.rotation)
      const newCrop =
        d.kind === 'resize-image-crop'
          ? resizeSourceCropOnCanvas(
              d.anchorCropCanvas,
              d.fullCanvas,
              d.handle,
              local.x,
              local.y,
              d.imgW,
              d.imgH,
            )
          : moveSourceCropOnCanvas(
              d.anchorCropCanvas,
              d.fullCanvas,
              local.x - d.startLocalX,
              local.y - d.startLocalY,
              d.imgW,
              d.imgH,
            )
      dragLiveRef.current = {
        image: {
          [d.id]: {
            x: layer.x,
            y: layer.y,
            width: layer.width,
            height: layer.height,
            rotation: layer.rotation ?? 0,
            crop: newCrop,
          },
        },
      }
      scheduleCanvasPaint()
      return
    }
    if (d.kind === 'resize-background') {
      const next = isCornerResizeHandle(d.handle)
        ? resizeBoundsProportional(d.anchor, d.handle, px, py)
        : resizeBoundsWithHandle(d.anchor, d.handle, px, py, d.anchor)
      dragLiveRef.current = { background: next }
      scheduleCanvasPaint()
      return
    }
    if (d.kind === 'resize-text') {
      let lx = px
      let ly = py
      if (d.rotation) {
        const local = pointerToTextLocal(px, py, d.pivotX, d.pivotY, d.rotation)
        lx = local.x
        ly = local.y
      }
      const next = resizeTextLayerWithHandle(d.textAnchor, d.handle, lx, ly)
      dragLiveRef.current = { text: { [d.id]: next } }
      scheduleCanvasPaint()
      return
    }
    if (d.kind === 'rotate-text') {
      const layer = docRef.current?.textLayers.find((t) => t.id === d.id)
      const ox = layer?.x ?? 0
      const oy = layer?.y ?? 0
      const rotation = rotationFromPointerDrag(
        d.pivotX,
        d.pivotY,
        px,
        py,
        d.startPointerX,
        d.startPointerY,
        d.startRotation,
      )
      dragLiveRef.current = { text: { [d.id]: { x: ox, y: oy, rotation } } }
      scheduleCanvasPaint()
      return
    }
    if (d.kind === 'rotate-shape') {
      const base = docRef.current?.shapeLayers.find((s) => s.id === d.id)
      if (!base) return
      const rotation = rotationFromPointerDrag(
        d.pivotX,
        d.pivotY,
        px,
        py,
        d.startPointerX,
        d.startPointerY,
        d.startRotation,
      )
      dragLiveRef.current = { shapes: { [d.id]: { ...base, rotation } } }
      scheduleCanvasPaint()
      return
    }
    if (d.kind === 'rotate-image') {
      const layer = docRef.current?.imageLayers.find((l) => l.id === d.id)
      if (!layer) return
      const rotation = rotationFromPointerDrag(
        d.pivotX,
        d.pivotY,
        px,
        py,
        d.startPointerX,
        d.startPointerY,
        d.startRotation,
      )
      dragLiveRef.current = {
        image: {
          [d.id]: {
            x: layer.x,
            y: layer.y,
            width: layer.width,
            height: layer.height,
            rotation,
          },
        },
      }
      scheduleCanvasPaint()
      return
    }
    if (d.kind === 'shape-line' || d.kind === 'shape-move') {
      const base = docRef.current?.shapeLayers.find((s) => s.id === d.id)
      if (!base) return
      const part = d.kind === 'shape-line' ? d.part : 'move'
      let lx = px
      let ly = py
      let sx = d.startPx
      let sy = d.startPy
      /**
       * 끝점(start/end) 편집만 로컬 좌표 변환.
       * 이동(move)은 반드시 월드(화면) 델타를 써야 회전된 요소도 마우스와 같이 움직임.
       */
      if ((part === 'start' || part === 'end') && (base.rotation ?? 0)) {
        const b = shapeUnrotatedBounds(d.origin)
        if (b) {
          const pivot = layerPivot(b)
          const local = pointerToLocal(px, py, pivot.x, pivot.y, d.origin.rotation ?? 0)
          lx = local.x
          ly = local.y
        }
      }
      const next = applyShapeDragMove(base, part, lx, ly, sx, sy, d.origin)
      if (d.kind === 'shape-move' && d.multi) {
        const wdx = px - d.startPx
        const wdy = py - d.startPy
        const shapes: NonNullable<DragLiveOverlay['shapes']> = {}
        for (const [id, origin] of Object.entries(d.multi.shape)) {
          shapes[id] = id === d.id ? next : offsetShapeLayer(origin, wdx, wdy)
        }
        const text: NonNullable<DragLiveOverlay['text']> = {}
        for (const [id, o] of Object.entries(d.multi.text)) {
          text[id] = { x: o.ox + wdx, y: o.oy + wdy }
        }
        const image: NonNullable<DragLiveOverlay['image']> = {}
        for (const [id, o] of Object.entries(d.multi.image)) {
          const imgLayer = docRef.current?.imageLayers.find((l) => l.id === id)
          image[id] = {
            x: o.ox + wdx,
            y: o.oy + wdy,
            width: imgLayer?.width ?? 0,
            height: imgLayer?.height ?? 0,
            rotation: imgLayer?.rotation ?? 0,
          }
        }
        dragLiveRef.current = { shapes, text, image }
      } else {
        dragLiveRef.current = { shapes: { [d.id]: next } }
      }
      scheduleCanvasPaint()
      return
    }
    if (d.kind === 'resize-shape') {
      const base = docRef.current?.shapeLayers.find((s) => s.id === d.id)
      if (!base) return
      const pivot = layerPivot(d.anchor)
      const local = pointerToLocal(px, py, pivot.x, pivot.y, d.rotation)
      const nextBounds = resizeBoundsWithHandle(d.anchor, d.handle, local.x, local.y, d.anchor)
      const next = applyShapeBoundsResize(base, nextBounds)
      dragLiveRef.current = { shapes: { [d.id]: next } }
      scheduleCanvasPaint()
    }
  }

  const commitDragLiveToDoc = useCallback(() => {
    const live = dragLiveRef.current
    if (!live) return

    setDoc((prev) => {
      let next = prev
      if (live.text && Object.keys(live.text).length > 0) {
        next = {
          ...next,
          textLayers: next.textLayers.map((t) => {
            const p = live.text![t.id]
            if (!p) return t
            return {
              ...t,
              x: p.x,
              y: p.y,
              ...(p.fontSize != null ? { fontSize: p.fontSize } : {}),
              ...(p.rotation != null ? { rotation: p.rotation } : {}),
            }
          }),
        }
      }
      if (live.image && Object.keys(live.image).length > 0) {
        for (const [id, p] of Object.entries(live.image)) {
          next = updateImageLayer(next, id, p)
        }
      }
      if (live.shapes && Object.keys(live.shapes).length > 0) {
        next = {
          ...next,
          shapeLayers: next.shapeLayers.map((s) => live.shapes![s.id] ?? s),
        }
      }
      if (live.background) {
        next = updateBackgroundLayout(next, live.background, true)
      }
      return next
    })
  }, [setDoc])

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    if (d?.kind === 'resize-image-crop' || d?.kind === 'move-image-crop') {
      const liveCrop = dragLiveRef.current?.image?.[d.id]?.crop
      if (liveCrop) {
        setImageCropSession((prev) => (prev && prev.layerId === d.id ? { ...prev, crop: liveCrop } : prev))
      }
      dragRef.current = null
      dragLiveRef.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      scheduleCanvasPaint()
      return
    }
    if (dragRef.current) commitDragLiveToDoc()
    dragRef.current = null
    dragLiveRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    scheduleCanvasPaint()
  }

  const onSaveProject = useCallback(async (): Promise<boolean> => {
    setSaveBusy(true)
    setLocalError(null)
    try {
      const blob = await exportCanvasBlob()
      const { base64 } = await new Promise<{ base64: string }>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => {
          const dataUrl = r.result as string
          const m = dataUrl.match(/^data:[^;]+;base64,(.+)$/)
          if (!m) reject(new Error('인코딩 실패'))
          else resolve({ base64: m[1] })
        }
        r.onerror = () => reject(r.error ?? new Error('읽기 실패'))
        r.readAsDataURL(blob)
      })
      const previewDataUrl = `data:image/jpeg;base64,${base64}`
      const savedDoc = docRef.current ?? doc
      const tabIdx = studioTabsRef.current.findIndex((t) => t.id === activeTabIdRef.current)
      const tabLabel = labelForTabDoc(savedDoc, tabIdx >= 0 ? tabIdx : 0)
      const mergedTabs = mergeActiveTabDocument(studioTabsRef.current, activeTabIdRef.current, savedDoc, {
        label: tabLabel,
        previewUrl: previewDataUrl,
      })

      const tabsPayload = mergedTabs.map((t) => ({
        ...t,
        previewBase64:
          t.id === activeTabIdRef.current
            ? base64
            : t.previewUrl?.startsWith('data:')
              ? t.previewUrl.replace(/^data:[^;]+;base64,/, '')
              : undefined,
      }))

      const res = await saveProjectThumbnail(projectId, { imageBase64: base64 })

      const { session: savedSession, warning: tabsWarning } = await saveThumbnailStudioTabsBestEffort(
        projectId,
        {
          activeTabId: activeTabIdRef.current,
          tabs: tabsPayload,
        },
        (session) => saveStudioTabsSessionLocal(projectId, session),
      )
      let tabsForBackup = mergedTabs
      if (savedSession) {
        const withScoped = applyExternalizedAssetsFromSaveResponse(mergedTabs, savedSession.tabs).map(
          (t, i) => ({
          ...t,
          document: normalizeStudioDocument(resolveTabDocumentUrls(t.document)),
          label: t.label?.trim() || labelForTabDoc(t.document, i),
        }))
        studioTabsRef.current = withScoped
        setStudioTabs(withScoped)
        tabsForBackup = withScoped
        const activeScoped = withScoped.find((t) => t.id === activeTabIdRef.current)
        if (activeScoped) {
          const liveDoc = docRef.current ?? doc
          const promoted = promoteSaveResponseIntoDocument(liveDoc, activeScoped.document)
          savedSnapshotRef.current = JSON.stringify(promoted)
          bgLoadedUrlRef.current = null
          replaceDocWithoutHistory(cloneStudioDocument(promoted))
        }
      } else {
        studioTabsRef.current = mergedTabs
        setStudioTabs(mergedTabs)
      }

      const flushDoc =
        tabsForBackup.find((t) => t.id === activeTabIdRef.current)?.document ?? savedDoc
      await flushStudioDocumentPersist(projectId, flushDoc)
      onDirtyChange?.(false)

      for (const tab of tabsForBackup) {
        try {
          const previewB64 =
            tab.id === activeTabIdRef.current
              ? base64
              : tab.previewUrl?.startsWith('data:')
                ? tab.previewUrl.replace(/^data:[^;]+;base64,/, '')
                : undefined
          await saveThumbnailStudioSavedWork(projectId, {
            label: tab.label,
            templateId: tab.document.templateId,
            source: 'export',
            document: tab.document,
            previewBase64: previewB64,
          })
        } catch {
          /* 개별 백업 실패 무시 */
        }
      }
      void refreshSavedWorks()

      const rawUrl = res.thumbnailUrl
      const thumbUrl =
        rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')
          ? rawUrl
          : rawUrl.includes('?')
            ? `${rawUrl}&t=${Date.now()}`
            : `${rawUrl}?t=${Date.now()}`
      onSaved?.(thumbUrl)
      if (tabsWarning) {
        setInfo(
          `프로젝트 썸네일은 저장했습니다. 탭 ${tabsForBackup.length}개는 브라우저에만 보관 중입니다 — ${tabsWarning}`,
        )
      } else {
        setInfo(
          `프로젝트 썸네일로 저장했습니다. 열려 있는 ${tabsForBackup.length}개 작업도 함께 저장했습니다.`,
        )
      }
      return true
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '저장 실패')
      return false
    } finally {
      setSaveBusy(false)
    }
  }, [doc, exportCanvasBlob, onDirtyChange, onSaved, projectId, refreshSavedWorks])

  useRegisterStepToolbarSave(bindStepToolbarSave, onSaveProject)
  useRegisterStepToolbarSave(bindModalCloseSave, onSaveProject)

  const onDownload = async () => {
    setDownloadBusy(true)
    setLocalError(null)
    try {
      const blob = await exportCanvasBlob()
      const base = (downloadFileBaseName ?? projectId).replace(/[/\\?%*:|"<>]/g, '_').slice(0, 40) || 'thumbnail'
      const result = await triggerBlobDownload(blob, `${base}_template_studio.jpg`)
      if (result.cancelled) {
        setInfo(formatBlobDownloadSavedMessage(result))
        return
      }
      setLastJpegDownload(result)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '다운로드 실패')
    } finally {
      setDownloadBusy(false)
    }
  }

  const onDownloadAllTabs = useCallback(async () => {
    const c = canvasRef.current
    if (!c) {
      setLocalError('캔버스를 찾을 수 없습니다.')
      return
    }
    setDownloadBusy(true)
    setLocalError(null)
    try {
      const preview = await captureCanvasPreviewDataUrl()
      const merged = mergeActiveTabDocument(
        studioTabsRef.current,
        activeTabIdRef.current,
        docRef.current ?? doc,
        preview ? { previewUrl: preview } : undefined,
      )
      studioTabsRef.current = merged
      setStudioTabs(merged)

      const tabs =
        merged.length > 0
          ? merged
          : [
              {
                id: activeTabIdRef.current,
                label: labelForTabDoc(docRef.current ?? doc, 0),
                document: docRef.current ?? doc,
              },
            ]

      const exportRefs = {
        backgroundImage: bgImageRef.current,
        overlayImages: overlayRefs.current,
      }
      const items: Array<{ label: string; blob: Blob }> = []
      const prevW = c.width
      const prevH = c.height
      for (const tab of tabs) {
        const tabDoc = resolveTabDocumentUrls(cloneStudioDocument(tab.document))
        const assets = await buildStudioRenderAssetsForExport(tabDoc, exportRefs)
        c.width = STUDIO_CANVAS_W
        c.height = STUDIO_CANVAS_H
        items.push({
          label: tab.label?.trim() || labelForTabDoc(tabDoc, items.length),
          blob: await exportStudioDocumentToBlob(c, tabDoc, assets),
        })
      }
      c.width = prevW
      c.height = prevH

      const base =
        (downloadFileBaseName ?? projectId).replace(/[/\\?%*:|"<>]/g, '_').slice(0, 40) || 'thumbnail'
      const { saved, lastResult, cancelled } = await downloadStudioTabBlobs(items, base)
      scheduleCanvasPaint()

      if (cancelled) {
        setInfo(saved > 0 ? `JPEG ${saved}장 저장 후 취소되었습니다.` : '저장을 취소했습니다.')
        if (lastResult && saved > 0) setLastJpegDownload(lastResult)
        return
      }
      if (lastResult) setLastJpegDownload(lastResult)
      setInfo(
        saved <= 1
          ? formatBlobDownloadSavedMessage(lastResult!)
          : `썸네일 JPEG ${saved}장을 PC에 저장했습니다.`,
      )
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '일괄 저장 실패')
      scheduleCanvasPaint()
    } finally {
      setDownloadBusy(false)
    }
  }, [
    captureCanvasPreviewDataUrl,
    doc,
    downloadFileBaseName,
    projectId,
    scheduleCanvasPaint,
  ])

  const onOpenProjectThumbnailFolder = useCallback(async () => {
    setLocalError(null)
    try {
      await postOpenProjectDataFolder(projectId, 'thumbnail')
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    }
  }, [projectId])

  const onOpenLastJpegSavedLocation = useCallback(async () => {
    if (!lastJpegDownload) return
    setOpenJpegPathBusy(true)
    setLocalError(null)
    try {
      if (lastJpegDownload.savedPath) {
        await postOpenProjectSavedPath(projectId, lastJpegDownload.savedPath)
        return
      }
      const r = await openDownloadsFolder()
      setInfo(r.message)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '저장 위치를 열 수 없습니다.')
    } finally {
      setOpenJpegPathBusy(false)
    }
  }, [lastJpegDownload, projectId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Escape' && imageCropSessionRef.current) {
        e.preventDefault()
        cancelImageCrop()
        return
      }
      if (e.key === 'Enter' && imageCropSessionRef.current) {
        e.preventDefault()
        applyImageCrop()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void onSaveProject()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (copySelectedLayers()) {
          e.preventDefault()
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (pasteSelectedLayers()) {
          e.preventDefault()
        }
        return
      }
      if (inlineTextEdit) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const drawable = drawableSelectedLayers(selectedLayers)
        const deletingBackgroundImage =
          selectedLayers.some((r) => r.kind === 'background') && Boolean(doc.background.imageDataUrl)
        if (drawable.length > 0 || deletingBackgroundImage) {
          e.preventDefault()
          deleteSelectedLayer()
        }
        return
      }
      if (drawableSelectedLayers(selectedLayers).length > 0) {
        if (e.key === ']' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          reorderSelectedLayer(e.shiftKey ? 'front' : 'forward')
          return
        }
        if (e.key === '[' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          reorderSelectedLayer(e.shiftKey ? 'back' : 'backward')
          return
        }
      }
      if (drawableSelectedLayers(selectedLayers).length === 0) return
      const step = e.shiftKey ? 10 : 2
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        setDoc((prev) => nudgeStudioLayers(prev, selectedLayers, dx, dy))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    undo,
    redo,
    onSaveProject,
    selectedLayers,
    copySelectedLayers,
    pasteSelectedLayers,
    deleteSelectedLayer,
    reorderSelectedLayer,
    setDoc,
    inlineTextEdit,
    doc.background.imageDataUrl,
    cancelImageCrop,
    applyImageCrop,
  ])

  const isModal = layout === 'modal'
  const aiOverlayPhase = resolveThumbnailAiOverlayPhase({
    tplAnalyzeBusy,
    genBusy,
    bgOnlyBusy,
    layoutFitBusy,
    verifyBusy,
    textOnlyBusy,
    textRewriteBusy,
    textRegenerateBusy,
    benchmarkRemixBusy,
  })

  return (
    <div className={'thumb-studio' + (isModal ? ' thumb-studio--modal' : '')}>
      <ThumbnailTemplatePickerModal
        open={templateModalOpen}
        selectedId={doc.templateId}
        onClose={() => setTemplateModalOpen(false)}
        onSelect={onSelectTemplate}
        genSettings={thumbGenSettings}
        onGenSettingsChange={applyThumbGenSettings}
        genSettingsDisabled={tplAnalyzeBusy || genBusy}
        onSaveCurrentAsCustom={() => {
          setTemplateModalOpen(false)
          openSaveTemplateEditor()
        }}
      />
      <CustomTemplateEditorModal
        open={saveTemplateEditorOpen}
        mode={isCustomTemplateId(doc.templateId) ? 'edit' : 'create'}
        initial={
          isCustomTemplateId(doc.templateId) ? getCustomTemplate(doc.templateId) ?? null : null
        }
        slotCount={doc.textLayers.length}
        onClose={() => setSaveTemplateEditorOpen(false)}
        onSave={async (payload) => {
          const previewDataUrl = await captureCanvasPreviewDataUrl()
          const custom = await buildCustomTemplateFromDocument({
            doc,
            label: payload.label,
            description: payload.description,
            tags: payload.tags,
            previewDataUrl,
            existingId: isCustomTemplateId(doc.templateId) ? doc.templateId : undefined,
          })
          upsertCustomTemplate(custom)
          setDoc((prev) => ({
            ...prev,
            templateId: custom.id,
            exportFrame: custom.exportFrame ?? prev.exportFrame,
          }))
          setInfo(
            isCustomTemplateId(doc.templateId)
              ? '커스텀 템플릿 레이아웃을 갱신했습니다.'
              : '현재 레이아웃을 커스텀 템플릿으로 저장했습니다.',
          )
        }}
      />

      <div className="thumb-studio__toolbar">
        <button
          type="button"
          className="yt-upload__btn yt-upload__btn--ghost thumb-studio__tpl-btn"
          disabled={tplAnalyzeBusy || genBusy}
          onClick={() => setTemplateModalOpen(true)}
        >
          {tplAnalyzeBusy || genBusy ? 'AI 생성 중…' : '썸네일 템플릿'}
        </button>
        <button
          type="button"
          className="yt-upload__btn yt-upload__btn--ghost"
          disabled={tplAnalyzeBusy || genBusy || !doc.textLayers.length}
          onClick={openSaveTemplateEditor}
          title="현재 캔버스 문구 위치·스타일을 커스텀 템플릿으로 저장"
        >
          템플릿으로 저장
        </button>
        <button
          type="button"
          className="yt-upload__btn yt-upload__btn--ghost"
          disabled={!canUndo}
          onClick={undo}
          title="실행 취소 (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          type="button"
          className="yt-upload__btn yt-upload__btn--ghost"
          disabled={!canRedo}
          onClick={redo}
          title="다시 실행 (Ctrl+Y)"
        >
          ↷
        </button>
        <button
          type="button"
          className="yt-upload__btn yt-upload__btn--ghost"
          disabled={
            tabsBusy ||
            saveBusy ||
            studioTabs.length >= MAX_STUDIO_TABS ||
            !activeTabId
          }
          onClick={() => void onDuplicateStudioTab()}
          title="현재 썸네일 복제 — 문구·레이아웃 유지, 배경·사진만 바꿀 때"
        >
          썸네일 복제
        </button>
        <button
          type="button"
          className="yt-upload__btn yt-upload__btn--ghost"
          onClick={onClearTemplateCanvas}
          title="배경·문구·이미지를 모두 지우고 빈 캔버스로"
        >
          템플릿 초기화
        </button>
        <span className="thumb-studio__toolbar-spacer" />
        <button
          type="button"
          className="yt-upload__btn yt-upload__btn--ghost"
          disabled={genBusy || tplAnalyzeBusy}
          onClick={() => void onOpenFeedPreview()}
          title="유튜브 홈·검색에서 작게 보이는 크기 미리보기"
        >
          피드 미리보기
        </button>
        <button
          type="button"
          className="yt-upload__btn yt-upload__btn--primary"
          disabled={saveBusy}
          onClick={() => void onSaveProject()}
        >
          {saveBusy ? '저장 중…' : '프로젝트에 저장'}
        </button>
        <button
          type="button"
          className="pd-open-folder-btn thumb-studio__folder-btn"
          title="프로젝트에 저장한 썸네일 파일 폴더"
          onClick={() => void onOpenProjectThumbnailFolder()}
        >
          📁 썸네일 저장 폴더
        </button>
        <button
          type="button"
          className="yt-upload__btn yt-upload__btn--ghost"
          disabled={downloadBusy || tabsBusy || saveBusy || studioTabs.length < 1}
          onClick={() => void onDownloadAllTabs()}
          title="열린 모든 썸네일 탭을 JPEG 파일로 PC에 저장"
        >
          {downloadBusy ? 'JPEG 저장 중…' : 'JPEG 일괄저장'}
        </button>
        <button
          type="button"
          className="yt-upload__btn yt-upload__btn--ghost"
          disabled={downloadBusy}
          onClick={() => void onDownload()}
          title="현재 탭만 JPEG로 PC에 저장"
        >
          {downloadBusy ? 'JPEG 저장 중…' : 'JPEG 다운로드'}
        </button>
      </div>

      {studioTabs.length > 0 && activeTabId ? (
        <ThumbnailStudioTabBar
          tabs={studioTabs}
          activeTabId={activeTabId}
          busy={tabsBusy || saveBusy || tplAnalyzeBusy || genBusy}
          outputLanguage={outputLanguage}
          onApplyOutputLanguage={(lang) => void onApplyTabOutputLanguage(lang)}
          outputLanguageDisabled={
            genBusy || bgOnlyBusy || textOnlyBusy || verifyBusy || languageApplyBusy
          }
          languageApplyBusy={languageApplyBusy}
          onSelect={(id) => void switchStudioTab(id)}
          onNew={() => void onNewStudioTab()}
          onDuplicate={(id) => void onDuplicateStudioTab(id)}
          onClose={(id) => void onCloseStudioTab(id)}
        />
      ) : null}

      <div className="thumb-studio__workspace thumb-studio__workspace--sidebar">
        <ThumbnailStudioSidebar
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          selectedText={
            selectedText && inlineTextEdit?.id === selectedText.id
              ? { ...selectedText, text: inlineTextEdit.draft }
              : selectedText
          }
          selectedImage={selectedImage}
          selectedShape={selectedShape}
          onAddShape={onAddShape}
          onAddElementPreset={onAddElementPreset}
          elementStickerPresetId={elementStickerPresetId}
          onUpdateShape={(id, patch) => setDoc((p) => updateShapeLayer(p, id, patch))}
          newTextDraft={newTextDraft}
          onNewTextDraftChange={setNewTextDraft}
          onAddTextFromDraft={onAddTextFromDraft}
          onUpdateText={updateText}
          canvasTextFillRange={
            textFillRange && selectedText && textFillRange.textId === selectedText.id
              ? { start: textFillRange.start, end: textFillRange.end }
              : null
          }
          inlineTextInputRef={inlineInputRef}
          onApplyStylePreset={applyStylePreset}
          onPickOverlayImage={onPickOverlayImage}
          onBackgroundFile={(file) => {
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
              const url = reader.result as string
              void (async () => {
                setLocalError(null)
                try {
                  const cover = await coverLayoutForImageSource(url)
                  setDoc((prev) => fillBackgroundImage(prev, url, 'upload', cover))
                  setInfo('배경 이미지를 업로드했습니다.')
                  setSidebarTab('background')
                  setSelected({ kind: 'background' })
                } catch {
                  setDoc((prev) => fillBackgroundImage(prev, url, 'upload', null))
                  setInfo('배경 이미지를 업로드했습니다.')
                  setSidebarTab('background')
                }
              })()
            }
            reader.onerror = () => {
              setLocalError('이미지 파일을 읽지 못했습니다.')
            }
            reader.readAsDataURL(file)
          }}
          extraBgHint={extraBgHint}
          onExtraBgHintChange={setExtraBgHint}
          thumbGenSettings={thumbGenSettings}
          onThumbGenSettingsChange={applyThumbGenSettings}
          genSettingsDisabled={tplAnalyzeBusy || genBusy}
          topicStyleRec={topicStyleRec}
          outputLanguage={outputLanguage}
          onApplyOutputLanguage={(lang) => void onApplyTabOutputLanguage(lang)}
          languageApplyBusy={languageApplyBusy}
          genBusy={genBusy}
          bgOnlyBusy={bgOnlyBusy}
          textOnlyBusy={textOnlyBusy}
          onGenerateFull={() => void onGenerateFromTemplate()}
          onRegenerateText={() => void onRegenerateTextOnly()}
          onRegenerateBg={() => void onRegenerateBackgroundOnly()}
          onFitTextToBackground={() => void onFitTextToBackground()}
          layoutFitBusy={layoutFitBusy}
          onVerifyThumbnail={() => void onVerifyThumbnail()}
          verifyBusy={verifyBusy}
          onClearCanvas={onClearTemplateCanvas}
          onDeleteSelected={deleteSelectedLayer}
          onReorderLayer={reorderSelectedLayer}
          onUpdateImage={(id, patch) => setDoc((p) => updateImageLayer(p, id, patch))}
          onStartImageCrop={startImageCrop}
          onApplyImageCrop={applyImageCrop}
          onCancelImageCrop={cancelImageCrop}
          imageCropLayerId={imageCropSession?.layerId ?? null}
          onResetImageCrop={(id) => {
            const session = imageCropSessionRef.current
            const img = overlayRefs.current.get(id)
            const iw = img?.naturalWidth || img?.width
            const ih = img?.naturalHeight || img?.height
            if (!iw || !ih) return
            const crop = fullImageCrop(iw, ih)
            if (session?.layerId === id) {
              setImageCropSession((prev) => (prev ? { ...prev, crop } : null))
              dragLiveRef.current = null
              scheduleCanvasPaint()
              return
            }
            setDoc((p) => updateImageLayer(p, id, { crop }))
          }}
          overlayLayers={doc.overlayLayers ?? []}
          selectedOverlay={selectedOverlay}
          onAddOverlay={onAddOverlay}
          onSelectOverlay={(id) => setSelected({ kind: 'overlay', id })}
          onUpdateOverlay={(id, patch) => setDoc((p) => updateOverlayLayer(p, id, patch))}
          doc={doc}
          selectedLayer={selected}
          selectedLayers={selectedLayers}
          onSelectLayer={onSelectLayer}
          onToggleLayerVisible={onToggleLayerVisible}
          onAddWatermark={onAddWatermark}
          variants={variants}
          activeVariantId={activeVariantId}
          variantBusy={variantBusy}
          onSaveVariant={() => void onSaveVariant()}
          onGenerateVariantAi={() => void onGenerateVariantAi()}
          onApplyVariant={onApplyVariant}
          onRemoveVariant={onRemoveVariant}
          savedWorks={savedWorks}
          activeSavedWorkId={activeSavedWorkId}
          savedWorksLoading={savedWorksLoading}
          savedWorksBusy={savedWorksBusy}
          onRefreshSavedWorks={() => void refreshSavedWorks()}
          onSaveSavedWork={() => void onSaveSavedWork()}
          onLoadSavedWork={(id) => void onLoadSavedWork(id)}
          onRemoveSavedWork={(id) => void onRemoveSavedWork(id)}
          backgroundLayout={doc.background.layout ?? undefined}
          hasBackgroundImage={Boolean(doc.background.imageDataUrl)}
          backgroundLocked={Boolean(doc.background.locked)}
          backgroundFlipX={Boolean(doc.background.flipX)}
          onBackgroundFlipXChange={(flipX) =>
            setDoc((p) => ({ ...p, background: { ...p.background, flipX } }))
          }
          onBackgroundLockedChange={(locked) =>
            setDoc((p) => ({ ...p, background: { ...p.background, locked } }))
          }
          onUpdateBackgroundLayout={(layout) =>
            setDoc((p) => updateBackgroundLayout(p, layout, true))
          }
          backgroundScrim={normalizeBackgroundScrim(doc.background.scrim)}
          onUpdateBackgroundScrim={(patch) =>
            setDoc((p) => updateBackgroundScrim(p, patch))
          }
          backgroundGradientMask={normalizeImageGradientMask(doc.background.gradientMask)}
          onUpdateBackgroundGradientMask={(patch) =>
            setDoc((p) => updateBackgroundGradientMask(p, patch))
          }
          exportFrame={activeExportFrame}
          onUpdateExportFrame={(patch) => setDoc((p) => updateExportFrame(p, patch))}
          analyzedBenchmarkStyle={analyzedBenchmarkStyle}
          benchmarkBusy={benchmarkBusy}
          benchmarkRemixBusy={benchmarkRemixBusy}
          benchmarkSourceFileName={benchmarkSourceFile?.name ?? null}
          onBenchmarkFile={(file) => void onBenchmarkFile(file)}
          onBenchmarkRemix={() => void onBenchmarkRemix()}
          onClearBenchmark={() => {
            setAnalyzedBenchmarkStyle(null)
            setBenchmarkSourceFile(null)
          }}
          onApplyBgMood={onApplyBgMood}
          extractedPalette={extractedPalette}
          paletteBusy={paletteBusy}
          onExtractPalette={() => void onExtractPalette()}
          onApplyPaletteColor={onApplyPaletteColor}
          onMagicEnhance={() => void onMagicEnhance()}
          magicEnhanceBusy={magicEnhanceBusy}
          onAutoTextContrast={() => void onAutoTextContrast()}
          autoContrastBusy={autoContrastBusy}
          hookSuggestions={hookSuggestions}
          hookBusy={hookBusy}
          onGenerateHookSuggestions={() => void onGenerateHookSuggestions()}
          onApplyHookSuggestion={onApplyHookSuggestion}
          onRewriteTextPreset={(presetId) => void onRewriteTextPreset(presetId)}
          textRewriteBusy={textRewriteBusy}
          onRegenerateSelectedText={() => void onRegenerateSelectedText()}
          textRegenerateBusy={textRegenerateBusy}
          onOpenCopyResearch={() => setCopyResearchOpen(true)}
        />

        <div className="thumb-studio__canvas-area">
          <div
            ref={canvasWrapRef}
            className={
              'thumb-studio__canvas-wrap' +
              (aiOverlayPhase ? ' thumb-studio__canvas-wrap--ai-busy' : '') +
              (canvasFocusOpen ? ' thumb-studio__canvas-wrap--focus' : '')
            }
          >
          {!canvasFocusOpen ? (
            <TemplateReferencePanel templateId={doc.templateId} containerRef={canvasWrapRef} />
          ) : null}
          {!canvasFocusOpen && showCopyReferencePanel ? (
            <CopyResearchReferencePanel
              items={copyResearchSession.result?.items ?? []}
              subCopies={copyResearchSession.aiSubCopies ?? []}
              subCopiesLoading={subCopiesLoading}
              onGenerateSubCopies={() => void handleGenerateSubCopies()}
              onSelectSubCopy={handleApplySubCopy}
              onAddSubCopy={handleAddSubCopyToCanvas}
              selectedSubCopyId={selectedSubCopyId}
              subCopyApplyEnabled={!!subCopySlotSpec}
              containerRef={canvasWrapRef}
              onReopenModal={() => setCopyResearchOpen(true)}
              notes={copyResearchSession.userNotes ?? ''}
              onNotesChange={(userNotes) =>
                setCopyResearchSession((prev) => ({ ...prev, userNotes }))
              }
              panelHeight={copyResearchSession.panelHeight}
              onPanelHeightChange={(panelHeight) =>
                setCopyResearchSession((prev) => ({ ...prev, panelHeight }))
              }
              onClose={() => {
                setCopyManualPanelOpen(false)
                setCopyResearchSession((prev) => ({ ...prev, manualPanelOpen: false }))
              }}
            />
          ) : null}
          {!canvasFocusOpen && showCopyComboPanel ? (
            <CopyComboReferencePanel
              combos={copyResearchSession.aiCombos ?? []}
              selectedComboId={selectedCopyComboId}
              onSelectCombo={handleApplyCopyCombo}
              containerRef={canvasWrapRef}
            />
          ) : null}
          {aiOverlayPhase ? <ThumbnailStudioAiOverlay phase={aiOverlayPhase} /> : null}
          {canvasFocusOpen ? (
            <div className="thumb-studio__canvas-focus-bar">
              <span className="thumb-studio__canvas-focus-bar-title">썸네일 확대 편집</span>
              <span className="thumb-studio__canvas-focus-bar-hint">
                더블클릭·드래그로 세밀 조정 · Esc 닫기
              </span>
              <div className="thumb-studio__canvas-zoom" role="group" aria-label="확대 편집 배율">
                <button
                  type="button"
                  className="thumb-studio__canvas-zoom-btn"
                  title="축소"
                  aria-label="축소"
                  disabled={canvasZoom <= CANVAS_ZOOM_MIN + 1e-6}
                  onClick={() => bumpCanvasZoom(-CANVAS_ZOOM_STEP)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="thumb-studio__canvas-zoom-btn thumb-studio__canvas-zoom-btn--pct"
                  title="화면 맞춤 확대"
                  onClick={() => setCanvasZoom(computeFocusCanvasZoom())}
                >
                  {canvasZoomPercent}%
                </button>
                <button
                  type="button"
                  className="thumb-studio__canvas-zoom-btn"
                  title="확대"
                  aria-label="확대"
                  disabled={canvasZoom >= CANVAS_ZOOM_MAX - 1e-6}
                  onClick={() => bumpCanvasZoom(CANVAS_ZOOM_STEP)}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="thumb-studio__canvas-focus-bar-close"
                onClick={closeCanvasFocus}
              >
                닫기
              </button>
            </div>
          ) : null}
          <div className="thumb-studio__canvas-toolbar">
            <span className="thumb-studio__canvas-toolbar-hint">
              {canvasFocusOpen
                ? '1280×720 · 세밀 편집 모드'
                : '1280×720 · 더블클릭 편집 · Ctrl+휠 확대·축소 · Shift+드래그 부분 색 · 문구 우클릭 AI · Ctrl+C/V · [ ] 순서 · Delete · Ctrl+S'}
            </span>
            {!canvasFocusOpen ? (
            <div className="thumb-studio__canvas-zoom" role="group" aria-label="썸네일 미리보기 확대·축소">
              <button
                type="button"
                className="thumb-studio__canvas-zoom-btn"
                title="축소"
                aria-label="축소"
                disabled={canvasZoom <= CANVAS_ZOOM_MIN + 1e-6}
                onClick={() => bumpCanvasZoom(-CANVAS_ZOOM_STEP)}
              >
                −
              </button>
              <button
                type="button"
                className="thumb-studio__canvas-zoom-btn thumb-studio__canvas-zoom-btn--pct"
                title="확대·축소 100% (화면 맞춤 기준)"
                onClick={() => setCanvasZoom(1)}
              >
                {canvasZoomPercent}%
              </button>
              <button
                type="button"
                className="thumb-studio__canvas-zoom-btn"
                title="확대"
                aria-label="확대"
                disabled={canvasZoom >= CANVAS_ZOOM_MAX - 1e-6}
                onClick={() => bumpCanvasZoom(CANVAS_ZOOM_STEP)}
              >
                +
              </button>
            </div>
            ) : null}
          </div>
          {selectedText &&
          textFillRange &&
          textFillRange.textId === selectedText.id &&
          textFillRange.start !== textFillRange.end ? (
            <div className="thumb-studio__text-fill-bar" role="toolbar" aria-label="부분 글자색">
              <span className="thumb-studio__text-fill-bar-label">
                선택 {Math.abs(textFillRange.end - textFillRange.start)}자
              </span>
              <label className="thumb-studio__text-fill-bar-picker">
                <span className="sr-only">선택 구간 색상</span>
                <input
                  type="color"
                  value={selectedText.fill.startsWith('#') ? selectedText.fill : '#ffffff'}
                  onInput={(e) => {
                    updateText(
                      selectedText.id,
                      patchTextFillColor(selectedText, e.currentTarget.value, {
                        start: textFillRange.start,
                        end: textFillRange.end,
                      }),
                    )
                    scheduleCanvasPaint()
                  }}
                />
              </label>
              <span className="thumb-studio__text-fill-bar-hint">드래그로 고른 글자에 색 적용</span>
            </div>
          ) : null}
          <div className="thumb-studio__canvas-stage" ref={canvasStageRef}>
            <canvas
              ref={canvasRef}
              className={
                'thumb-studio__canvas' +
                (canvasZoom > 1.02 ? ' thumb-studio__canvas--zoomed' : '')
              }
              style={{
                width: STUDIO_EDIT_CANVAS_W * effectiveDisplayScale,
                height: STUDIO_EDIT_CANVAS_H * effectiveDisplayScale,
              }}
              width={STUDIO_EDIT_CANVAS_W}
              height={STUDIO_EDIT_CANVAS_H}
              onPointerDown={onCanvasPointerDown}
              onDoubleClick={onCanvasDoubleClick}
              onContextMenu={onCanvasContextMenu}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onPointerLeave={(e) => {
                if (!dragRef.current && hoveredLayerRef.current) {
                  hoveredLayerRef.current = null
                  scheduleCanvasPaint()
                }
                if (!dragRef.current) onCanvasPointerUp(e)
              }}
            />
            {inlineEditorBox && inlineTextEdit ? (
              <textarea
                ref={inlineInputRef}
                className="thumb-studio__inline-edit"
                rows={Math.max(1, splitTextLines(inlineTextEdit.draft).length)}
                value={inlineTextEdit.draft}
                spellCheck={false}
                style={{
                  left: inlineEditorBox.left,
                  top: inlineEditorBox.top,
                  width: inlineEditorBox.widthPx,
                  height: inlineEditorBox.heightPx,
                  fontSize: inlineEditorBox.fontSizePx,
                  lineHeight: `${inlineEditorBox.lineHeightPx}px`,
                  letterSpacing: `${inlineEditorBox.typo.letterSpacing}px`,
                  fontFamily: inlineEditorBox.item.fontFamily,
                  color: inlineEditorBox.item.fill,
                  WebkitTextFillColor: inlineEditorBox.item.fill,
                  caretColor: inlineEditorBox.item.fill,
                  textAlign: inlineEditorBox.item.textAlign,
                  whiteSpace: 'pre-wrap',
                  transform: inlineEditorBox.transform,
                  transformOrigin: inlineEditorBox.transformOrigin,
                  textShadow: inlineEditTextShadow(
                    inlineEditorBox.item,
                    inlineEditorBox.fontSizePx,
                  ),
                  background: inlineEditorBox.item.boxBackground
                    ? inlineEditorBox.item.boxBackgroundColor ?? 'rgba(0,0,0,0.92)'
                    : 'transparent',
                }}
                onChange={(ev) =>
                  setInlineTextEdit((prev) =>
                    prev ? { ...prev, draft: ev.target.value } : prev,
                  )
                }
                onBlur={() => commitInlineEdit()}
                onKeyDown={(ev) => {
                  if (ev.key === 'Escape') {
                    ev.preventDefault()
                    cancelInlineEdit()
                    scheduleCanvasPaint()
                  } else if (ev.key === 'Enter' && !ev.shiftKey) {
                    ev.preventDefault()
                    commitInlineEdit()
                    scheduleCanvasPaint()
                  }
                  ev.stopPropagation()
                }}
                onPointerDown={(ev) => ev.stopPropagation()}
              />
            ) : null}
          </div>
          <button
            type="button"
            className={
              canvasFocusOpen
                ? 'thumb-studio__canvas-focus-btn thumb-studio__canvas-focus-btn--on'
                : 'thumb-studio__canvas-focus-btn'
            }
            title={canvasFocusOpen ? '확대 편집 닫기 (Esc)' : '썸네일만 크게 — 세밀 편집'}
            aria-label={canvasFocusOpen ? '확대 편집 닫기' : '썸네일 확대 편집'}
            onClick={toggleCanvasFocus}
          >
            {canvasFocusOpen ? '닫기' : '확대'}
          </button>
        </div>
      </div>
      </div>

      {info ? <p className="thumb-studio__info">{info}</p> : null}
      {lastJpegDownload && !lastJpegDownload.cancelled ? (
        <ThumbnailJpegDownloadSavedPanel
          result={lastJpegDownload}
          openBusy={openJpegPathBusy}
          onOpenLocation={() => void onOpenLastJpegSavedLocation()}
        />
      ) : null}
      {localError ? <p className="thumb-studio__err">{localError}</p> : null}
      <ThumbnailTextCoordLog doc={doc} liveDoc={coordLiveDoc} />

      {textContextMenu ? (
        <div
          className="thumb-studio__text-ctx-menu"
          style={{ top: textContextMenu.y, left: textContextMenu.x }}
          role="menu"
          aria-label="썸네일 문구 AI 재작성"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className="thumb-studio__text-ctx-title">
            {linkedHookHighlight
              ? 'AI 문구 (1·2줄 연결 유지)'
              : 'AI 문구'}
          </p>
          <button
            type="button"
            role="menuitem"
            className="thumb-studio__text-ctx-item thumb-studio__text-ctx-item--regen"
            disabled={textRegenerateBusy || textRewriteBusy}
            onClick={() => void onRegenerateTextFromContextMenu()}
          >
            {textRegenerateBusy ? '문구 재생성 중…' : '✦ AI 텍스트 재생성'}
          </button>
          <p className="thumb-studio__text-ctx-sub">톤만 바꾸기 (Magic Write)</p>
          {THUMBNAIL_TEXT_REWRITE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="menuitem"
              className="thumb-studio__text-ctx-item"
              disabled={textRewriteBusy || textRegenerateBusy}
              onClick={() => void onRewriteTextFromContextMenu(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}

      <ThumbnailFeedPreviewModal
        open={feedPreviewOpen}
        previewSrc={feedPreviewSrc}
        title={titleHint?.trim() || topic.trim() || '영상 제목 미리보기'}
        onClose={() => setFeedPreviewOpen(false)}
      />

      <ThumbnailVerificationModal
        open={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        previewDataUrl={verifyPreviewUrl}
        report={verifyReport}
        busy={verifyBusy}
        improveBusy={verifyImproveBusy}
        onApplyImprovements={onApplyVerificationImprovements}
      />

      <ThumbnailCopyResearchModal
        open={copyResearchOpen}
        onClose={() => setCopyResearchOpen(false)}
        topic={topic}
        script={script}
        titleHint={titleHint}
        outputLanguage={outputLanguage}
        document={doc}
        onApplyDocument={(next) => setDoc(next)}
        session={copyResearchSession}
        onSessionChange={setCopyResearchSession}
        onManualWork={(nextSession) => {
          setCopyResearchSession(nextSession)
          setCopyResearchOpen(false)
          setCopyManualPanelOpen(true)
        }}
        selectedComboId={selectedCopyComboId}
        onSelectedComboChange={setSelectedCopyComboId}
        selectedSubCopyId={selectedSubCopyId}
        onSelectedSubCopyChange={setSelectedSubCopyId}
        onInfo={(msg) => setInfo(msg)}
        onError={(msg) => setLocalError(msg)}
      />
    </div>
  )
}

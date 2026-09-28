import { fetchThumbnailStudioDraft } from '@/lib/longform-v2/thumbnail-bridge/thumbnailStudioDraftApi'
import { DEFAULT_PRO_TEMPLATE_ID, getProTemplate } from './catalog'
import { normalizeOverlayLayer } from './overlayLayers'
import { normalizeImageGradientMask } from './imageGradientMask'
import { loadThumbnailStudioDraft } from './draft'
import { normalizeTextTypographyFields } from './textTypography'
import { applyTemplateToDocument, createEmptyStudioDocument } from './document'
import type { ThumbnailStudioDocument } from './types'
import { resolveStudioAssetUrl } from './studioAssetUrl'

function migrateLegacyTemplateId(doc: ThumbnailStudioDocument): ThumbnailStudioDocument {
  if (doc.templateId === 'study_hook_right') {
    return { ...doc, templateId: 'historical_hook_right', templateStyle: undefined }
  }
  return doc
}

function normalizeStudioDocument(doc: ThumbnailStudioDocument): ThumbnailStudioDocument {
  const migrated = migrateLegacyTemplateId(doc)
  return {
    ...migrated,
    shapeLayers: migrated.shapeLayers ?? [],
    overlayLayers: (migrated.overlayLayers ?? []).map((o) => normalizeOverlayLayer(o)),
    background: {
      ...migrated.background,
      imageDataUrl: resolveStudioAssetUrl(migrated.background.imageDataUrl),
      gradientMask: migrated.background.gradientMask
        ? normalizeImageGradientMask(migrated.background.gradientMask)
        : undefined,
    },
    imageLayers: migrated.imageLayers.map((layer) => ({
      ...layer,
      imageDataUrl: resolveStudioAssetUrl(layer.imageDataUrl) ?? layer.imageDataUrl,
      gradientMask: layer.gradientMask
        ? normalizeImageGradientMask(layer.gradientMask)
        : undefined,
    })),
    textLayers: migrated.textLayers.map((layer) => normalizeTextTypographyFields(layer)),
  }
}

/** localStorage + 서버 초안 중 최신 문서 로드 */
export async function loadStudioDocumentForProject(projectId: string): Promise<ThumbnailStudioDocument> {
  const pid = projectId.trim()
  if (!pid) return createEmptyStudioDocument(DEFAULT_PRO_TEMPLATE_ID)

  let remote: Awaited<ReturnType<typeof fetchThumbnailStudioDraft>> = null
  try {
    remote = await fetchThumbnailStudioDraft(pid)
  } catch {
    remote = null
  }

  const localDraft = loadThumbnailStudioDraft(pid)
  const localUpdatedAt = localDraft?.updatedAt ?? 0

  let chosen: ThumbnailStudioDocument | null = null
  if (remote && localDraft) {
    chosen = remote.updatedAt >= localUpdatedAt ? remote.document : localDraft.document
  } else if (remote) {
    chosen = remote.document
  } else if (localDraft) {
    chosen = localDraft.document
  }

  if (chosen) {
    const migrated = normalizeStudioDocument(chosen)
    if (getProTemplate(migrated.templateId)) return migrated
    const texts = chosen.textLayers.map((t) => t.text)
    return applyTemplateToDocument(
      createEmptyStudioDocument(DEFAULT_PRO_TEMPLATE_ID),
      DEFAULT_PRO_TEMPLATE_ID,
      texts,
    )
  }

  return createEmptyStudioDocument(DEFAULT_PRO_TEMPLATE_ID)
}

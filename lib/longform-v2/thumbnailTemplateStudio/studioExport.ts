import {
  exportStudioCanvasToBlob,
  renderStudioDocumentForExport,
  type StudioRenderAssets,
} from './render'
import type { ThumbnailStudioDocument } from './types'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'

const LOAD_TIMEOUT_MS = 25_000

function loadImage(src: string, existing?: HTMLImageElement | null): Promise<HTMLImageElement> {
  if (
    existing &&
    existing.src === src &&
    existing.complete &&
    (existing.naturalWidth || existing.width)
  ) {
    return Promise.resolve(existing)
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    const timer = window.setTimeout(() => {
      reject(new Error('이미지 로드 시간이 초과되었습니다. 잠시 후 다시 저장해 주세요.'))
    }, LOAD_TIMEOUT_MS)
    img.onload = () => {
      window.clearTimeout(timer)
      if (img.naturalWidth || img.width) resolve(img)
      else reject(new Error('이미지 크기를 읽을 수 없습니다.'))
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('이미지를 불러오지 못했습니다.'))
    }
    img.src = src
  })
}

/** 저장·다운로드 직전 — 배경·오버레이 이미지가 모두 로드될 때까지 대기 */
export async function buildStudioRenderAssetsForExport(
  doc: ThumbnailStudioDocument,
  refs: {
    backgroundImage: HTMLImageElement | null
    overlayImages: Map<string, HTMLImageElement>
  },
): Promise<StudioRenderAssets> {
  const bgUrl = doc.background.imageDataUrl?.trim()
  let backgroundImage: HTMLImageElement | null = null
  if (bgUrl) {
    backgroundImage = await loadImage(bgUrl, refs.backgroundImage)
    refs.backgroundImage = backgroundImage
  }

  const overlayImages = new Map<string, HTMLImageElement>()
  const visible = doc.imageLayers.filter((l) => l.visible)
  await Promise.all(
    visible.map(async (layer) => {
      const url = layer.imageDataUrl?.trim()
      if (!url) return
      const img = await loadImage(url, refs.overlayImages.get(layer.id))
      overlayImages.set(layer.id, img)
      refs.overlayImages.set(layer.id, img)
    }),
  )

  return { backgroundImage, overlayImages }
}

export async function exportStudioDocumentToBlob(
  canvas: HTMLCanvasElement,
  doc: ThumbnailStudioDocument,
  assets: StudioRenderAssets,
): Promise<Blob> {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 찾을 수 없습니다.')
  renderStudioDocumentForExport(ctx, doc, assets)
  return exportStudioCanvasToBlob(canvas)
}

export { STUDIO_CANVAS_W, STUDIO_CANVAS_H }

import type { ThumbnailBackgroundTransform, ThumbnailFilterState } from "@/lib/mvp-thumbnail-design"

export type MosaicPatchOptions = {
  stageW: number
  stageH: number
  patchCx: number
  patchCy: number
  patchW: number
  patchH: number
  blockPx: number
  transform: ThumbnailBackgroundTransform
  circle?: boolean
}

function coverDrawRect(
  stageW: number,
  stageH: number,
  imgW: number,
  imgH: number,
  transform: ThumbnailBackgroundTransform
): { drawX: number; drawY: number; drawW: number; drawH: number } {
  const scale = transform.scale / 100
  const imgR = imgW / imgH
  const stageR = stageW / stageH
  let drawW: number
  let drawH: number
  if (imgR > stageR) {
    drawH = stageH * scale
    drawW = drawH * imgR
  } else {
    drawW = stageW * scale
    drawH = drawW / imgR
  }
  const centerX = (transform.x / 100) * stageW
  const centerY = (transform.y / 100) * stageH
  return {
    drawX: centerX - drawW / 2,
    drawY: centerY - drawH / 2,
    drawW,
    drawH,
  }
}

/** 배경 이미지의 일부를 픽셀 모자이크로 캔버스에 그림 */
export function renderMosaicPatchToCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  opts: MosaicPatchOptions
): void {
  const { stageW, stageH, patchCx, patchCy, patchW, patchH, blockPx, transform, circle } = opts
  const patchWInt = Math.max(8, Math.round(patchW))
  const patchHInt = Math.max(8, Math.round(patchH))
  canvas.width = patchWInt
  canvas.height = patchHInt

  const ctx = canvas.getContext("2d")
  if (!ctx || !img.naturalWidth || !img.naturalHeight) return

  const { drawX, drawY, drawW, drawH } = coverDrawRect(
    stageW,
    stageH,
    img.naturalWidth,
    img.naturalHeight,
    transform
  )

  const patchX = patchCx - patchWInt / 2
  const patchY = patchCy - patchHInt / 2

  const sx = ((patchX - drawX) / drawW) * img.naturalWidth
  const sy = ((patchY - drawY) / drawH) * img.naturalHeight
  const sw = (patchWInt / drawW) * img.naturalWidth
  const sh = (patchHInt / drawH) * img.naturalHeight

  const block = Math.max(4, Math.min(24, blockPx))
  const smallW = Math.max(1, Math.floor(patchWInt / block))
  const smallH = Math.max(1, Math.floor(patchHInt / block))

  const tmp = document.createElement("canvas")
  tmp.width = smallW
  tmp.height = smallH
  const tctx = tmp.getContext("2d")
  if (!tctx) return

  tctx.drawImage(img, sx, sy, sw, sh, 0, 0, smallW, smallH)

  ctx.clearRect(0, 0, patchWInt, patchHInt)
  if (circle) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(patchWInt / 2, patchHInt / 2, Math.min(patchWInt, patchHInt) / 2, 0, Math.PI * 2)
    ctx.clip()
  }
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, 0, 0, smallW, smallH, 0, 0, patchWInt, patchHInt)
  if (circle) ctx.restore()
}

export function thumbnailFilterToCss(filter: ThumbnailFilterState): string {
  return `blur(${filter.blur}px) brightness(${filter.brightness}%) contrast(${filter.contrast}%) saturate(${filter.saturate}%)`
}

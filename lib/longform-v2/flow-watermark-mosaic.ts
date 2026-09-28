/** Flow 우하단 워터마크 → 모자이크 (브라우저 캔버스) */

export type FlowWatermarkMosaicParams = {
  widthRatio: number
  heightRatio: number
  marginRightRatio: number
  marginBottomRatio: number
  /** 클수록 거친 모자이크 */
  pixelSize: number
}

export const DEFAULT_FLOW_WATERMARK_MOSAIC_PARAMS: FlowWatermarkMosaicParams = {
  widthRatio: 0.13,
  heightRatio: 0.22,
  marginRightRatio: 0,
  marginBottomRatio: 0,
  pixelSize: 18,
}

function mosaicBoxPx(imgW: number, imgH: number, params: FlowWatermarkMosaicParams) {
  const boxW = Math.max(24, Math.round(imgW * params.widthRatio))
  const boxH = Math.max(24, Math.round(imgH * params.heightRatio))
  const left = Math.max(
    0,
    Math.min(imgW - boxW, imgW - boxW - Math.round(imgW * params.marginRightRatio))
  )
  const top = Math.max(
    0,
    Math.min(imgH - boxH, imgH - boxH - Math.round(imgH * params.marginBottomRatio))
  )
  return { left, top, boxW, boxH }
}

export function drawMosaicOnCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  params: FlowWatermarkMosaicParams,
  showSelection: boolean
): void {
  const w = "naturalWidth" in img ? img.naturalWidth : img.width
  const h = "naturalHeight" in img ? img.naturalHeight : img.height
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)

  const { left, top, boxW, boxH } = mosaicBoxPx(w, h, params)
  const cell = Math.max(4, Math.round(params.pixelSize))
  const smallW = Math.max(1, Math.round(boxW / cell))
  const smallH = Math.max(1, Math.round(boxH / cell))

  const off = document.createElement("canvas")
  off.width = boxW
  off.height = boxH
  const octx = off.getContext("2d")
  if (!octx) return
  octx.drawImage(img, left, top, boxW, boxH, 0, 0, boxW, boxH)

  const tiny = document.createElement("canvas")
  tiny.width = smallW
  tiny.height = smallH
  const tctx = tiny.getContext("2d")
  if (!tctx) return
  tctx.imageSmoothingEnabled = false
  tctx.drawImage(off, 0, 0, boxW, boxH, 0, 0, smallW, smallH)

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tiny, 0, 0, smallW, smallH, left, top, boxW, boxH)
  ctx.imageSmoothingEnabled = true

  if (!showSelection) return
  ctx.save()
  ctx.strokeStyle = "rgba(80, 180, 255, 0.95)"
  ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.003))
  ctx.setLineDash([8, 6])
  ctx.strokeRect(left + 1, top + 1, boxW - 2, boxH - 2)
  ctx.restore()
  const hs = Math.max(10, Math.round(Math.min(boxW, boxH) * 0.12))
  ctx.fillStyle = "rgba(80, 180, 255, 0.95)"
  ctx.fillRect(left, top, hs, hs)
}

/** 이미지 URL → 모자이크 적용 data URL (jpeg) */
export async function applyMosaicToImageUrl(
  imageUrl: string,
  params: FlowWatermarkMosaicParams
): Promise<string> {
  const img = await loadImage(imageUrl)
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("캔버스를 열 수 없습니다.")
  drawMosaicOnCanvas(ctx, img, params, false)
  return canvas.toDataURL("image/jpeg", 0.92)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = "async"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."))
    img.src = src
  })
}

/** 파일명에서 1-based 순번 추출: 1.jpg, 사진(2), scene_003.png */
export function numericStemFromFilename(name: string): number | null {
  const base = name.replace(/\.[^.]+$/i, "").trim()
  if (!base) return null
  const pure = /^(\d+)$/.exec(base)
  if (pure) return Number.parseInt(pure[1]!, 10)
  const paren = /[(\uFF08](\d+)[)\uFF09]/.exec(base)
  if (paren) return Number.parseInt(paren[1]!, 10)
  const trailing = /(?:^|[^\d])(\d+)$/.exec(base)
  if (trailing) return Number.parseInt(trailing[1]!, 10)
  const prefix = /^(\d+)/.exec(base)
  if (prefix) return Number.parseInt(prefix[1]!, 10)
  return null
}

/** 파일명 → 0-based 장면 인덱스 */
export function sceneIndexFromFilename(name: string): number | null {
  const n = numericStemFromFilename(name)
  if (n == null || n < 1) return null
  return n - 1
}

/**
 * 외부 이미지 파일 → 장면 매핑.
 * - 전부 숫자 파일명이면 1번 = 첫 장면
 * - 아니면 정렬 후 첫 장면부터 순서대로
 */
export function mapExternalSceneImageFiles(
  files: File[],
  sceneCount: number
): Array<{ sceneIndex: number; file: File }> {
  if (sceneCount <= 0 || files.length === 0) return []
  const indexed = files.map((file, fileIndex) => ({ file, fileIndex, name: file.name }))
  const sorted = [...indexed].sort((a, b) => {
    const na = numericStemFromFilename(a.name)
    const nb = numericStemFromFilename(b.name)
    if (na !== null && nb !== null) return na - nb
    if (na !== null) return -1
    if (nb !== null) return 1
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
  })
  const allNumbered = sorted.every((x) => numericStemFromFilename(x.name) !== null)
  if (allNumbered) {
    const seen = new Set<number>()
    const out: Array<{ sceneIndex: number; file: File }> = []
    for (const { file, name } of sorted) {
      const n = numericStemFromFilename(name)!
      const sceneIndex = n - 1
      if (sceneIndex < 0 || sceneIndex >= sceneCount) continue
      if (seen.has(sceneIndex)) continue
      seen.add(sceneIndex)
      out.push({ sceneIndex, file })
    }
    return out
  }
  return sorted.slice(0, sceneCount).map((x, i) => ({ sceneIndex: i, file: x.file }))
}

export function formatScenePromptsBatchCopy(
  rows: Array<{ label: string; prompt: string }>
): string {
  return rows
    .map((r) => `===== ${r.label} =====\n${r.prompt.trim()}`)
    .join("\n\n")
}

import type { ThumbnailBackgroundTransform, ThumbnailFilterState } from "@/lib/mvp-thumbnail-design"
import { thumbnailFilterToCss } from "@/lib/mvp-thumbnail-mosaic"

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

function resolveDrawableBackgroundUrl(url: string): string {
  const trimmed = url.trim()
  if (
    !trimmed ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("mvp-idb://")
  ) {
    return trimmed
  }
  // 쿠팡·CDN 등은 CORS 때문에 canvas/export가 실패 → 동일 출처 프록시
  if (/^https?:\/\//i.test(trimmed)) {
    return `/api/shotform/image-proxy?url=${encodeURIComponent(trimmed)}`
  }
  return trimmed
}

async function loadImageOnce(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (!src.startsWith("blob:") && !src.startsWith("data:")) {
      img.crossOrigin = "anonymous"
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("배경 이미지를 불러올 수 없습니다."))
    img.src = src
  })
}

/** 원격 URL은 프록시 폴백까지 시도 (미리보기는 되는데 PNG 적용만 실패하는 CORS 케이스) */
async function loadImage(url: string): Promise<HTMLImageElement> {
  const trimmed = url.trim()
  if (!trimmed) throw new Error("배경 이미지가 없습니다.")

  const candidates = [trimmed]
  const proxied = resolveDrawableBackgroundUrl(trimmed)
  if (proxied !== trimmed) candidates.unshift(proxied)

  let lastError: Error | null = null
  for (const src of candidates) {
    try {
      return await loadImageOnce(src)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }
  throw lastError || new Error("배경 이미지를 불러올 수 없습니다.")
}

/** 스튜디오와 동일한 배경 변환·필터로보내기 해상도 캔버스에 그림 */
export async function renderBackgroundToCanvas(
  backgroundUrl: string,
  transform: ThumbnailBackgroundTransform,
  filter: ThumbnailFilterState,
  width: number,
  height: number
): Promise<HTMLCanvasElement> {
  const img = await loadImage(backgroundUrl)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("캔버스를 사용할 수 없습니다.")

  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, width, height)

  const { drawX, drawY, drawW, drawH } = coverDrawRect(
    width,
    height,
    img.naturalWidth,
    img.naturalHeight,
    transform
  )
  ctx.filter = thumbnailFilterToCss(filter)
  ctx.drawImage(img, drawX, drawY, drawW, drawH)
  ctx.filter = "none"
  return canvas
}

/** 붓 미리보기 캔버스 → 인페인팅용 흑백 마스크 (흰색=지울 영역) */
export function brushPreviewToInpaintMask(
  previewCanvas: HTMLCanvasElement,
  exportWidth: number,
  exportHeight: number
): string {
  const mask = document.createElement("canvas")
  mask.width = exportWidth
  mask.height = exportHeight
  const ctx = mask.getContext("2d")
  if (!ctx) throw new Error("마스크 캔버스를 사용할 수 없습니다.")

  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, exportWidth, exportHeight)
  ctx.drawImage(previewCanvas, 0, 0, exportWidth, exportHeight)

  const imageData = ctx.getImageData(0, 0, exportWidth, exportHeight)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]!
    const on = alpha > 12 ? 255 : 0
    data[i] = on
    data[i + 1] = on
    data[i + 2] = on
    data[i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
  return mask.toDataURL("image/png")
}

export function canvasHasBrushStrokes(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d")
  if (!ctx || canvas.width <= 0 || canvas.height <= 0) return false
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! > 12) return true
  }
  return false
}

function parseReplicateImageOutput(output: unknown): string {
  if (typeof output === "string") return output
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0]
    if (typeof first === "string") return first
    if (first && typeof first === "object" && "url" in first) {
      return String((first as { url: string }).url)
    }
    return String(first)
  }
  if (output && typeof output === "object" && "url" in output) {
    return String((output as { url: string }).url)
  }
  return String(output)
}

/** 비공식 모델은 version 해시가 필요 (공식 모델 전용 /models/.../predictions 는 404) */
const INPAINT_MODEL_VERSION =
  "dpakkk/image-object-removal:40e67426e1bf78199d78b36580389fbbdcb4c9cdc2bc2b489e99d713f167b3c5"

const INLINE_DATA_URL_MAX_BYTES = 256 * 1024

function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",")
  if (comma < 0) return dataUrl.length
  const base64 = dataUrl.slice(comma + 1)
  return Math.ceil((base64.length * 3) / 4)
}

async function uploadDataUrlToReplicate(
  dataUrl: string,
  token: string,
  filename: string
): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s)
  if (!match) throw new Error("잘못된 이미지 데이터입니다.")

  const mimeType = match[1]!
  const bytes = Buffer.from(match[2]!, "base64")
  const form = new FormData()
  form.append("content", new Blob([bytes], { type: mimeType }), filename)

  const res = await fetch("https://api.replicate.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Replicate 파일 업로드 실패: ${res.status} - ${text.slice(0, 300)}`)
  }

  const data = (await res.json()) as { urls?: { get?: string } }
  const url = data.urls?.get?.trim()
  if (!url) throw new Error("Replicate 파일 URL을 받지 못했습니다.")
  return url
}

async function resolveReplicateImageInput(
  dataUrl: string,
  token: string,
  filename: string
): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl
  if (estimateDataUrlBytes(dataUrl) <= INLINE_DATA_URL_MAX_BYTES) return dataUrl
  return uploadDataUrlToReplicate(dataUrl, token, filename)
}

async function pollReplicatePrediction(predictionId: string, token: string, maxAttempts = 90): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!statusResponse.ok) {
      throw new Error(`Replicate 상태 확인 실패: ${statusResponse.status}`)
    }
    const statusData = (await statusResponse.json()) as {
      status?: string
      output?: unknown
      error?: string
    }
    if (statusData.status === "succeeded" && statusData.output) {
      return parseReplicateImageOutput(statusData.output)
    }
    if (statusData.status === "failed") {
      throw new Error(statusData.error || "인페인팅 실패")
    }
  }
  throw new Error("인페인팅 시간 초과")
}

function buildBrushMaskGrid(
  brushPreviewCanvas: HTMLCanvasElement,
  width: number,
  height: number
): Uint8Array {
  const scratch = document.createElement("canvas")
  scratch.width = width
  scratch.height = height
  const ctx = scratch.getContext("2d")
  if (!ctx) throw new Error("마스크를 만들 수 없습니다.")
  ctx.drawImage(brushPreviewCanvas, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height).data
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i++) {
    mask[i] = data[i * 4 + 3]! > 12 ? 1 : 0
  }
  return mask
}

function dilateMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return mask
  const out = new Uint8Array(mask)
  const r2 = radius * radius
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] !== 1) continue
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > r2) continue
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
            out[ny * width + nx] = 1
          }
        }
      }
    }
  }
  return out
}

const NEIGHBOR_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const

/**
 * 칠한 영역만 주변 배경 색으로 채움 (AI 없음).
 * 자막·워터마크처럼 좁은 글자 제거에 적합 — 나머지 배경 픽셀은 그대로 유지.
 */
export function localInpaintMaskedRegion(
  baseCanvas: HTMLCanvasElement,
  brushPreviewCanvas: HTMLCanvasElement,
  width: number,
  height: number
): string {
  let mask = buildBrushMaskGrid(brushPreviewCanvas, width, height)
  if (!mask.includes(1)) throw new Error("지울 영역이 없습니다.")

  mask = dilateMask(mask, width, height, 2)

  const baseCtx = baseCanvas.getContext("2d")
  if (!baseCtx) throw new Error("배경 캔버스를 읽을 수 없습니다.")
  const source = baseCtx.getImageData(0, 0, width, height)
  const out = new Uint8ClampedArray(source.data)
  const filled = new Uint8Array(mask.length)
  for (let i = 0; i < mask.length; i++) {
    filled[i] = mask[i] === 0 ? 1 : 0
  }

  const maxIter = Math.max(width, height)
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        if (mask[idx] === 0 || filled[idx] === 1) continue

        let r = 0
        let g = 0
        let b = 0
        let n = 0
        for (const [dx, dy] of NEIGHBOR_OFFSETS) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const nidx = ny * width + nx
          if (filled[nidx] === 0) continue
          const pi = nidx * 4
          r += out[pi]!
          g += out[pi + 1]!
          b += out[pi + 2]!
          n++
        }
        if (n > 0) {
          const pi = idx * 4
          out[pi] = Math.round(r / n)
          out[pi + 1] = Math.round(g / n)
          out[pi + 2] = Math.round(b / n)
          out[pi + 3] = 255
          filled[idx] = 1
          changed = true
        }
      }
    }
    if (!changed) break
  }

  const searchRadius = 64
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (mask[idx] === 0 || filled[idx] === 1) continue

      let bestDist = Infinity
      let bestPi = -1
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const nidx = ny * width + nx
          if (filled[nidx] === 0) continue
          const dist = dx * dx + dy * dy
          if (dist < bestDist) {
            bestDist = dist
            bestPi = nidx * 4
          }
        }
      }
      if (bestPi >= 0) {
        const pi = idx * 4
        out[pi] = out[bestPi]!
        out[pi + 1] = out[bestPi + 1]!
        out[pi + 2] = out[bestPi + 2]!
        out[pi + 3] = 255
      }
    }
  }

  const resultCanvas = document.createElement("canvas")
  resultCanvas.width = width
  resultCanvas.height = height
  const resultCtx = resultCanvas.getContext("2d")
  if (!resultCtx) throw new Error("결과 캔버스를 사용할 수 없습니다.")
  resultCtx.putImageData(new ImageData(out, width, height), 0, 0)
  return resultCanvas.toDataURL("image/jpeg", 0.92)
}

/**
 * AI 인페인팅 결과를 원본 배경 위 마스크 영역에만 합성.
 * (모델 출력이 투명·크롭된 경우에도 나머지 배경이 사라지지 않게 함)
 */
export async function compositeInpaintOntoBackground(
  baseCanvas: HTMLCanvasElement,
  brushPreviewCanvas: HTMLCanvasElement,
  inpaintImageUrl: string,
  width: number,
  height: number
): Promise<string> {
  const inpaintImg = await loadImage(inpaintImageUrl)

  const out = document.createElement("canvas")
  out.width = width
  out.height = height
  const ctx = out.getContext("2d")
  if (!ctx) throw new Error("합성 캔버스를 사용할 수 없습니다.")

  ctx.drawImage(baseCanvas, 0, 0, width, height)

  const inpaintLayer = document.createElement("canvas")
  inpaintLayer.width = width
  inpaintLayer.height = height
  const inpaintCtx = inpaintLayer.getContext("2d")
  if (!inpaintCtx) throw new Error("인페인팅 레이어를 사용할 수 없습니다.")
  inpaintCtx.drawImage(inpaintImg, 0, 0, width, height)

  const maskScratch = document.createElement("canvas")
  maskScratch.width = width
  maskScratch.height = height
  const maskCtx = maskScratch.getContext("2d")
  if (!maskCtx) throw new Error("마스크 레이어를 사용할 수 없습니다.")
  maskCtx.drawImage(brushPreviewCanvas, 0, 0, width, height)

  const outData = ctx.getImageData(0, 0, width, height)
  const inpaintData = inpaintCtx.getImageData(0, 0, width, height)
  const maskData = maskCtx.getImageData(0, 0, width, height)

  for (let i = 0; i < outData.data.length; i += 4) {
    if (maskData.data[i + 3]! > 12) {
      outData.data[i] = inpaintData.data[i]!
      outData.data[i + 1] = inpaintData.data[i + 1]!
      outData.data[i + 2] = inpaintData.data[i + 2]!
      outData.data[i + 3] = 255
    }
  }

  ctx.putImageData(outData, 0, 0)
  return out.toDataURL("image/jpeg", 0.92)
}

/** 붓 마스크 영역만 LaMa 인페인팅으로 제거 */
export async function inpaintBrushMaskRegions(
  imageDataUrl: string,
  maskDataUrl: string,
  replicateApiKey: string
): Promise<string> {
  const token = replicateApiKey.trim()
  if (!token) throw new Error("Replicate API 키가 필요합니다.")

  const [imageInput, maskInput] = await Promise.all([
    resolveReplicateImageInput(imageDataUrl, token, "inpaint-source.jpg"),
    resolveReplicateImageInput(maskDataUrl, token, "inpaint-mask.png"),
  ])

  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify({
      version: INPAINT_MODEL_VERSION,
      input: {
        image: imageInput,
        mask: maskInput,
        hd_strategy_resize_limit: 1080,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`인페인팅 실패: ${response.status} - ${errorText.slice(0, 300)}`)
  }

  const data = (await response.json()) as {
    id?: string
    status?: string
    output?: unknown
    error?: string
  }

  if (data.status === "succeeded" && data.output) {
    return parseReplicateImageOutput(data.output)
  }
  if ((data.status === "processing" || data.status === "starting") && data.id) {
    return pollReplicatePrediction(data.id, token)
  }
  throw new Error(data.error || data.status || "인페인팅 결과를 받지 못했습니다.")
}

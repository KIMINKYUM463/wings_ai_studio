/** 썰 채널형 쇼핑 숏폼 프레임 (1080×1920) */

export type SsulTemplate = "ssul-white" | "ssul-banner" | "ssul-split"

export const SSUL_WIDTH = 1080
export const SSUL_HEIGHT = 1920

/** 상단 텍스트 영역 비율 (흰/배너 공통 기준) */
export const SSUL_TEXT_RATIO = 0.42

export interface SsulFrameOptions {
  template: SsulTemplate
  hookTitle: string
  channelLabel?: string
  postTime?: string
  narration: string
  /** 하단/중앙에 그릴 이미지 (이미 로드된 HTMLImageElement) */
  mediaImage?: HTMLImageElement | null
  /** ssul-banner 강조색 */
  accentColor?: string
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 4
): string[] {
  const lines: string[] = []
  let current = ""
  for (const ch of text.replace(/\n/g, " ")) {
    const test = current + ch
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = ch
      if (lines.length >= maxLines) break
    } else {
      current = test
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  return lines.length ? lines : [""]
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const ir = img.naturalWidth / img.naturalHeight
  const tr = w / h
  let dw = w
  let dh = h
  let dx = x
  let dy = y
  if (ir > tr) {
    dh = h
    dw = h * ir
    dx = x + (w - dw) / 2
  } else {
    dw = w
    dh = w / ir
    dy = y + (h - dh) / 2
  }
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.restore()
}

/** 흰 배경 상단 + 하단 제품 (기본 썰) */
function drawWhite(
  ctx: CanvasRenderingContext2D,
  o: SsulFrameOptions,
  W: number,
  H: number
) {
  const textH = Math.round(H * SSUL_TEXT_RATIO)
  const mediaY = textH
  const mediaH = H - textH

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, textH)

  const padX = 56
  let y = 72

  ctx.fillStyle = "#0a0a0a"
  ctx.font = "bold 56px Pretendard, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  const titleLines = wrapText(ctx, o.hookTitle || "제목 없음", W - padX * 2, 3)
  for (const line of titleLines) {
    ctx.fillText(line, padX, y)
    y += 68
  }

  y += 12
  const meta = [o.channelLabel || "방구석", o.postTime || "14:25"].filter(Boolean).join(" | ")
  ctx.fillStyle = "#8a8a8a"
  ctx.font = "28px Pretendard, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
  ctx.fillText(meta, padX, y)
  y += 48

  ctx.strokeStyle = "#111111"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(padX, y)
  ctx.lineTo(W - padX, y)
  ctx.stroke()
  y += 36

  ctx.fillStyle = "#1a1a1a"
  ctx.font = "500 40px Pretendard, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
  ctx.textAlign = "center"
  const narrLines = wrapText(ctx, o.narration || "", W - padX * 2, 4)
  for (const line of narrLines) {
    ctx.fillText(line, W / 2, y)
    y += 52
  }

  ctx.fillStyle = "#f3f3f3"
  ctx.fillRect(0, mediaY, W, mediaH)
  if (o.mediaImage) {
    drawCoverImage(ctx, o.mediaImage, 0, mediaY, W, mediaH)
  } else {
    ctx.fillStyle = "#cccccc"
    ctx.font = "32px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("제품 이미지", W / 2, mediaY + mediaH / 2)
  }
}

/** 상단 네온/배너 훅 + 중앙 미디어 + 하단 자막 */
function drawBanner(
  ctx: CanvasRenderingContext2D,
  o: SsulFrameOptions,
  W: number,
  H: number
) {
  const accent = o.accentColor || "#39ff14"
  const headerH = Math.round(H * 0.28)
  const footerH = Math.round(H * 0.12)
  const mediaY = headerH
  const mediaH = H - headerH - footerH

  ctx.fillStyle = "#2a3328"
  ctx.fillRect(0, 0, W, headerH)

  const padX = 40
  let y = 48

  // 메인 훅 (2줄: 흰 + 네온)
  const parts = (o.hookTitle || "훅 제목").split(/\s+/).filter(Boolean)
  const mid = Math.max(1, Math.ceil(parts.length / 2))
  const line1 = parts.slice(0, mid).join(" ")
  const line2 = parts.slice(mid).join(" ") || parts[parts.length - 1] || ""

  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  ctx.font = "bold 58px Pretendard, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
  ctx.lineWidth = 10
  ctx.strokeStyle = "#000000"
  ctx.fillStyle = "#ffffff"
  ctx.strokeText(line1, W / 2, y)
  ctx.fillText(line1, W / 2, y)
  y += 72

  if (line2) {
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 12
    ctx.fillStyle = accent
    ctx.strokeText(line2, W / 2, y)
    ctx.fillText(line2, W / 2, y)
    y += 80
  }

  // 서브헤드 바
  const barH = 56
  const barY = headerH - barH - 24
  ctx.fillStyle = "#f0f0f0"
  ctx.fillRect(padX, barY, W - padX * 2, barH)
  ctx.fillStyle = "#111111"
  ctx.font = "600 28px Pretendard, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const sub = o.narration.slice(0, 28) || o.hookTitle
  ctx.fillText(sub, W / 2, barY + barH / 2)

  ctx.fillStyle = "#1a1a1a"
  ctx.fillRect(0, mediaY, W, mediaH)
  if (o.mediaImage) {
    drawCoverImage(ctx, o.mediaImage, 0, mediaY, W, mediaH)
  }

  ctx.fillStyle = "rgba(0,0,0,0.55)"
  ctx.fillRect(0, H - footerH, W, footerH)
  ctx.fillStyle = "#ffffff"
  ctx.strokeStyle = "#000000"
  ctx.lineWidth = 8
  ctx.font = "bold 44px Pretendard, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const cap = o.narration || ""
  ctx.strokeText(cap.slice(0, 22), W / 2, H - footerH / 2)
  ctx.fillText(cap.slice(0, 22), W / 2, H - footerH / 2)
}

/** 상단 고정 텍스트 + 하단만 미디어 (split) — white와 동일 구조, 미디어 비율 약간 더 큼 */
function drawSplit(
  ctx: CanvasRenderingContext2D,
  o: SsulFrameOptions,
  W: number,
  H: number
) {
  drawWhite(ctx, { ...o, template: "ssul-white" }, W, H)
}

export function drawSsulFrame(
  ctx: CanvasRenderingContext2D,
  options: SsulFrameOptions,
  width = SSUL_WIDTH,
  height = SSUL_HEIGHT
) {
  ctx.save()
  ctx.clearRect(0, 0, width, height)
  switch (options.template) {
    case "ssul-banner":
      drawBanner(ctx, options, width, height)
      break
    case "ssul-split":
      drawSplit(ctx, options, width, height)
      break
    case "ssul-white":
    default:
      drawWhite(ctx, options, width, height)
      break
  }
  ctx.restore()
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("이미지 로드 실패"))
    img.src = src
  })
}

/** dataURL로 썰 프레임 합성 */
export async function composeSsulFrameDataUrl(
  options: Omit<SsulFrameOptions, "mediaImage"> & { mediaUrl?: string | null },
  width = SSUL_WIDTH,
  height = SSUL_HEIGHT
): Promise<string> {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D를 사용할 수 없습니다.")
  let mediaImage: HTMLImageElement | null = null
  if (options.mediaUrl) {
    try {
      mediaImage = await loadImageElement(options.mediaUrl)
    } catch {
      mediaImage = null
    }
  }
  drawSsulFrame(ctx, { ...options, mediaImage }, width, height)
  return canvas.toDataURL("image/jpeg", 0.92)
}

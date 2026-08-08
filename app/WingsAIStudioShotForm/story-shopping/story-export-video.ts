"use client"

import {
  fixWebmBlobDuration,
  remuxWebmWithDuration,
} from "@/lib/mvp-webm-to-mp4"
import type { StoryFrameSettings } from "./story-types"

export type StoryExportProgress = {
  phase: "prepare" | "record" | "encode" | "done" | "error"
  message: string
  ratio: number
}

export type StoryExportMotionEffect =
  | "none"
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "shake"
  | "pulse"
  | "blur-in"
  | "flash"

export type StoryExportClip = {
  key: string
  startSec: number
  endSec: number
  durationSec: number
  text: string
  mediaUrl?: string
  mediaType?: "image" | "video"
  trimStartSec?: number
  trimEndSec?: number
  mediaFit?: "cover" | "contain"
  mediaScale?: number
  mediaOffsetX?: number
  mediaOffsetY?: number
  motionEffect?: StoryExportMotionEffect
  backgroundColor?: string
}

export type StoryExportMotion = {
  effect: StoryExportMotionEffect
  progress: number
  mediaScale: number
  mediaOffsetX: number
  mediaOffsetY: number
  fit: "cover" | "contain"
  backgroundColor: string
}

function pickRecorderMime(): string {
  // Windows 기본 플레이어는 VP8+Opus WebM을 VP9보다 잘 여는 경우가 많음
  const candidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8",
    "video/webm;codecs=vp9",
    "video/webm",
  ]
  for (const mime of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(mime)
    ) {
      return mime
    }
  }
  return "video/webm"
}

export async function downloadBlobAsFile(blob: Blob, filename: string) {
  if (!blob || blob.size < 64) {
    throw new Error("다운로드할 영상 데이터가 비어 있습니다. 다시 시도해주세요.")
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

/** 줌/팬용 — 시작·끝 모두 부드럽게 */
function easeInOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2
}

function resolveMotionTransform(
  effect: StoryExportMotionEffect,
  progress: number
): {
  scale: number
  txPct: number
  tyPct: number
  rotateDeg: number
  blurPx: number
  opacity: number
  brightness: number
} {
  const infinite = effect === "shake" || effect === "pulse"
  const p = infinite
    ? Math.max(0, progress)
    : Math.min(1, Math.max(0, progress))
  const e = easeInOutCubic(Math.min(1, p))

  switch (effect) {
    case "zoom-in":
      return {
        scale: 1 + 0.12 * e,
        txPct: 0,
        tyPct: 0,
        rotateDeg: 0,
        blurPx: 0,
        opacity: 1,
        brightness: 1,
      }
    case "zoom-out":
      return {
        scale: 1.12 - 0.12 * e,
        txPct: 0,
        tyPct: 0,
        rotateDeg: 0,
        blurPx: 0,
        opacity: 1,
        brightness: 1,
      }
    case "pan-left":
      return {
        scale: 1.08,
        txPct: 3.5 - 7 * e,
        tyPct: 0,
        rotateDeg: 0,
        blurPx: 0,
        opacity: 1,
        brightness: 1,
      }
    case "pan-right":
      return {
        scale: 1.08,
        txPct: -3.5 + 7 * e,
        tyPct: 0,
        rotateDeg: 0,
        blurPx: 0,
        opacity: 1,
        brightness: 1,
      }
    case "shake": {
      const cycle = p % 1
      const kicks: Array<[number, number, number]> = [
        [0, 0, 0],
        [-1.5, 0.7, -0.4],
        [1.2, -0.5, 0.35],
        [-0.8, -0.4, -0.25],
        [1, 0.5, 0.3],
        [0, 0, 0],
      ]
      const idx = Math.min(
        kicks.length - 2,
        Math.floor(cycle * (kicks.length - 1))
      )
      const local = cycle * (kicks.length - 1) - idx
      const a = kicks[idx]!
      const b = kicks[idx + 1]!
      return {
        scale: 1,
        txPct: a[0]! + (b[0]! - a[0]!) * local,
        tyPct: a[1]! + (b[1]! - a[1]!) * local,
        rotateDeg: a[2]! + (b[2]! - a[2]!) * local,
        blurPx: 0,
        opacity: 1,
        brightness: 1,
      }
    }
    case "pulse": {
      const wave = 0.5 - 0.5 * Math.cos(p * Math.PI * 2)
      return {
        scale: 1 + 0.055 * wave,
        txPct: 0,
        tyPct: 0,
        rotateDeg: 0,
        blurPx: 0,
        opacity: 1,
        brightness: 1,
      }
    }
    case "blur-in":
      return {
        scale: 1.08 - 0.08 * e,
        txPct: 0,
        tyPct: 0,
        rotateDeg: 0,
        blurPx: 16 * (1 - e),
        opacity: 0.4 + 0.6 * e,
        brightness: 1,
      }
    case "flash": {
      let brightness = 1
      if (p < 0.18) brightness = 1 + (1.8 * p) / 0.18
      else if (p < 0.45) brightness = 2.8 - ((2.8 - 1) * (p - 0.18)) / 0.27
      return {
        scale: 1,
        txPct: 0,
        tyPct: 0,
        rotateDeg: 0,
        blurPx: 0,
        opacity: 1,
        brightness,
      }
    }
    default:
      return {
        scale: 1,
        txPct: 0,
        tyPct: 0,
        rotateDeg: 0,
        blurPx: 0,
        opacity: 1,
        brightness: 1,
      }
  }
}

function drawFittedImage(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: "cover" | "contain",
  srcW: number,
  srcH: number
) {
  if (!srcW || !srcH || w <= 0 || h <= 0) return
  const ir = srcW / srcH
  const tr = w / h
  let dw = w
  let dh = h
  let dx = x
  let dy = y
  if (fit === "cover") {
    if (ir > tr) {
      dh = h
      dw = h * ir
      dx = x + (w - dw) / 2
    } else {
      dw = w
      dh = w / ir
      dy = y + (h - dh) / 2
    }
  } else if (ir > tr) {
    dw = w
    dh = w / ir
    dy = y + (h - dh) / 2
  } else {
    dh = h
    dw = h * ir
    dx = x + (w - dw) / 2
  }
  ctx.drawImage(source, dx, dy, dw, dh)
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
) {
  const lines: string[] = []
  let current = ""
  for (const ch of text.replace(/\s+/g, " ").trim()) {
    const next = current + ch
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current)
      current = ch
      if (lines.length >= maxLines) break
    } else {
      current = next
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  return lines.length ? lines : [""]
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  weight = "700"
) {
  let size = maxSize
  while (size > minSize) {
    ctx.font = `${weight} ${size}px Pretendard, "Noto Sans KR", Malgun Gothic, sans-serif`
    if (ctx.measureText(text).width <= maxWidth) return size
    size -= 2
  }
  return minSize
}

/** 미리보기(검색 바형)와 동일한 채널 크롬을 캔버스에 직접 그림 — CORS 오염 없음 */
function drawChannelChrome(
  ctx: CanvasRenderingContext2D,
  width: number,
  chromeH: number,
  settings: StoryFrameSettings,
  caption: string,
  headerColor: string
) {
  const headerH = Math.round(width * 0.145)
  const captionH = Math.round(width * 0.12)
  const titleH = Math.max(1, chromeH - headerH - captionH)

  // Header
  ctx.fillStyle = headerColor
  ctx.fillRect(0, 0, width, headerH)

  const pad = width * 0.05
  const icon = width * 0.065
  const cy = headerH / 2

  // Back arrow
  ctx.strokeStyle = "#111111"
  ctx.lineWidth = Math.max(3, width * 0.007)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.beginPath()
  ctx.moveTo(pad + icon * 0.55, cy - icon * 0.28)
  ctx.lineTo(pad + icon * 0.2, cy)
  ctx.lineTo(pad + icon * 0.55, cy + icon * 0.28)
  ctx.stroke()

  // Search pill (미리보기 ChannelPill: 흰 배경 + 검정 테두리)
  const pillH = icon * 1.15
  const pillW = width * 0.72
  const pillX = (width - pillW) / 2
  const pillY = cy - pillH / 2
  const r = pillH / 2
  ctx.fillStyle = "#ffffff"
  ctx.beginPath()
  ctx.moveTo(pillX + r, pillY)
  ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, r)
  ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, r)
  ctx.arcTo(pillX, pillY + pillH, pillX, pillY, r)
  ctx.arcTo(pillX, pillY, pillX + pillW, pillY, r)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = "#111111"
  ctx.lineWidth = Math.max(3, width * 0.007)
  ctx.stroke()

  ctx.fillStyle = "#111111"
  const nameSize = Math.round(width * 0.055)
  ctx.font = `800 ${nameSize}px Pretendard, "Noto Sans KR", Malgun Gothic, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(settings.channelName || "이야기 상점", width / 2 - icon * 0.2, cy)

  // Search icon
  const sx = pillX + pillW - pillH * 0.42
  ctx.strokeStyle = "#111111"
  ctx.lineWidth = Math.max(3, width * 0.006)
  ctx.beginPath()
  ctx.arc(sx, cy - 1, pillH * 0.16, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(sx + pillH * 0.12, cy + pillH * 0.1)
  ctx.lineTo(sx + pillH * 0.26, cy + pillH * 0.26)
  ctx.stroke()

  // Menu
  const mx = width - pad - icon * 0.15
  ctx.strokeStyle = "#111111"
  ctx.lineWidth = Math.max(3, width * 0.007)
  for (const dy of [-icon * 0.22, 0, icon * 0.22]) {
    ctx.beginPath()
    ctx.moveTo(mx - icon * 0.28, cy + dy)
    ctx.lineTo(mx + icon * 0.28, cy + dy)
    ctx.stroke()
  }

  // Title panel
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, headerH, width, titleH)
  ctx.fillStyle = "#000000"
  const titlePad = width * 0.08
  const titleMaxW = width - titlePad * 2
  const title = settings.videoTitle || ""
  let titleSize = Math.round(width * 0.058)
  ctx.font = `800 ${titleSize}px Pretendard, "Noto Sans KR", Malgun Gothic, sans-serif`
  let titleLines = wrapText(ctx, title, titleMaxW, 2)
  while (
    titleSize > Math.round(width * 0.038) &&
    titleLines.some((line) => ctx.measureText(line).width > titleMaxW)
  ) {
    titleSize -= 2
    ctx.font = `800 ${titleSize}px Pretendard, "Noto Sans KR", Malgun Gothic, sans-serif`
    titleLines = wrapText(ctx, title, titleMaxW, 2)
  }
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  let ty = headerH + width * 0.035
  for (const line of titleLines) {
    ctx.fillText(line, titlePad, ty)
    ty += titleSize * 1.25
  }
  ctx.fillStyle = "#999999"
  const metaSize = Math.round(width * 0.028)
  ctx.font = `700 ${metaSize}px Pretendard, "Noto Sans KR", Malgun Gothic, sans-serif`
  ctx.fillText(
    `조회수 ${settings.viewCountLabel || "177만"} | 좋아요 ${settings.likeCountLabel || "938개"}`,
    titlePad,
    headerH + titleH - metaSize - width * 0.028
  )

  // Caption
  const capY = headerH + titleH
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, capY, width, captionH)
  ctx.strokeStyle = "#111111"
  ctx.lineWidth = Math.max(2, width * 0.004)
  ctx.beginPath()
  ctx.moveTo(0, capY)
  ctx.lineTo(width, capY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, capY + captionH)
  ctx.lineTo(width, capY + captionH)
  ctx.stroke()

  const captionText = (caption || "").replace(/\.{2,}|…+/g, "").trim()
  const capSize = fitFontSize(
    ctx,
    captionText,
    width * 0.84,
    Math.round(width * 0.052),
    Math.round(width * 0.032)
  )
  ctx.fillStyle = "#000000"
  ctx.font = `700 ${capSize}px Pretendard, "Noto Sans KR", Malgun Gothic, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(captionText, width / 2, capY + captionH / 2)
}

function proxyMediaUrl(url: string) {
  const trimmed = url.trim()
  if (
    !trimmed ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("/")
  ) {
    return trimmed
  }
  return `/api/shotform/image-proxy?url=${encodeURIComponent(trimmed)}`
}

async function fetchAsObjectUrl(src: string): Promise<string> {
  const res = await fetch(src, { cache: "no-store" })
  if (!res.ok) throw new Error(`미디어 fetch 실패 (${res.status})`)
  const blob = await res.blob()
  if (!blob.size) throw new Error("미디어가 비어 있습니다.")
  return URL.createObjectURL(blob)
}

async function loadCorsImage(url: string): Promise<HTMLImageElement> {
  const candidates: string[] = []
  const trimmed = url.trim()
  const httpsUrl = trimmed.startsWith("http://")
    ? `https://${trimmed.slice("http://".length)}`
    : trimmed
  const proxied = proxyMediaUrl(httpsUrl)
  if (proxied !== httpsUrl) candidates.push(proxied)
  if (httpsUrl !== trimmed) candidates.push(proxyMediaUrl(trimmed))
  candidates.push(httpsUrl)
  if (httpsUrl !== trimmed) candidates.push(trimmed)

  let lastError: Error | null = null
  for (const src of candidates) {
    try {
      let finalSrc = src
      if (src.startsWith("/") || src.startsWith("http")) {
        finalSrc = await fetchAsObjectUrl(src)
      }
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => {
          if (el.naturalWidth < 2) {
            reject(new Error("이미지 크기가 유효하지 않습니다."))
            return
          }
          resolve(el)
        }
        el.onerror = () => reject(new Error("이미지 로드 실패"))
        el.src = finalSrc
      })
      return img
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }
  throw lastError || new Error("이미지를 불러오지 못했습니다.")
}

async function loadCorsVideo(
  url: string,
  trimStartSec = 0
): Promise<HTMLVideoElement> {
  const candidates: string[] = []
  if (!url.startsWith("blob:") && !url.startsWith("data:") && !url.startsWith("/")) {
    candidates.push(url)
  }
  candidates.push(url)

  let lastError: Error | null = null
  for (const src of candidates) {
    try {
      let finalSrc = src
      if (!src.startsWith("blob:") && !src.startsWith("data:")) {
        finalSrc = await fetchAsObjectUrl(src)
      }
      const video = document.createElement("video")
      video.muted = true
      video.playsInline = true
      video.preload = "auto"
      video.src = finalSrc
      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          cleanup()
          resolve()
        }
        const onError = () => {
          cleanup()
          reject(new Error("비디오 로드 실패"))
        }
        const cleanup = () => {
          video.removeEventListener("loadeddata", onReady)
          video.removeEventListener("error", onError)
        }
        video.addEventListener("loadeddata", onReady, { once: true })
        video.addEventListener("error", onError, { once: true })
        video.load()
        window.setTimeout(() => {
          if (video.readyState >= 2) onReady()
        }, 4000)
      })
      if (video.videoWidth < 2) throw new Error("비디오 프레임이 없습니다.")
      try {
        video.currentTime = Math.max(0, trimStartSec)
      } catch {
        /* ignore */
      }
      await wait(40)
      return video
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }
  throw lastError || new Error("비디오를 불러오지 못했습니다.")
}

type PreparedMedia =
  | { kind: "image"; image: HTMLImageElement }
  | { kind: "video"; video: HTMLVideoElement }
  | { kind: "none" }

async function loadPreparedMedia(
  url: string,
  mediaType: "image" | "video",
  trimStartSec = 0
): Promise<PreparedMedia> {
  const attempts = 3
  let lastError: unknown = null
  for (let i = 0; i < attempts; i++) {
    try {
      if (mediaType === "video") {
        const video = await loadCorsVideo(url, trimStartSec)
        return { kind: "video", video }
      }
      const image = await loadCorsImage(url)
      return { kind: "image", image }
    } catch (error) {
      lastError = error
      await wait(200 * (i + 1))
    }
  }
  // 타입이 잘못 지정된 경우 반대로 한 번 더
  try {
    if (mediaType === "video") {
      const image = await loadCorsImage(url)
      return { kind: "image", image }
    }
    const video = await loadCorsVideo(url, trimStartSec)
    return { kind: "video", video }
  } catch {
    console.warn("[StoryExport] 미디어 최종 로드 실패:", lastError)
    return { kind: "none" }
  }
}

function measureMediaBox(
  stageEl: HTMLElement,
  width: number,
  height: number
) {
  const mediaStage = stageEl.querySelector(
    '[data-story-media-stage="true"]'
  ) as HTMLElement | null
  const stageRect = stageEl.getBoundingClientRect()
  if (!mediaStage || stageRect.height < 2) {
    const y = Math.round(height * 0.42)
    return { x: 0, y, w: width, h: height - y }
  }
  const mediaRect = mediaStage.getBoundingClientRect()
  const topRatio = Math.min(
    0.85,
    Math.max(0.12, (mediaRect.top - stageRect.top) / stageRect.height)
  )
  const y = Math.round(height * topRatio)
  return { x: 0, y, w: width, h: Math.max(1, height - y) }
}

/** 자막 패널 위치 — 미디어 바로 위 형제 */
function measureCaptionBox(
  stageEl: HTMLElement,
  width: number,
  height: number,
  mediaBox: { x: number; y: number; w: number; h: number }
) {
  const mediaStage = stageEl.querySelector(
    '[data-story-media-stage="true"]'
  ) as HTMLElement | null
  const captionEl = mediaStage?.previousElementSibling as HTMLElement | null
  const stageRect = stageEl.getBoundingClientRect()
  if (captionEl && stageRect.height > 2) {
    const rect = captionEl.getBoundingClientRect()
    const y = Math.round(
      ((rect.top - stageRect.top) / stageRect.height) * height
    )
    const h = Math.max(
      1,
      Math.round((rect.height / stageRect.height) * height)
    )
    // 미디어와 겹치지 않게 클램프
    const maxH = Math.max(1, mediaBox.y - y)
    return { x: 0, y, w: width, h: Math.min(h, maxH) }
  }
  const h = Math.round(width * 0.11)
  return {
    x: 0,
    y: Math.max(0, mediaBox.y - h),
    w: width,
    h,
  }
}

/** 클립마다 바뀌는 대본 — 매 프레임 clip.text로 다시 그림 */
function drawLiveCaption(
  ctx: CanvasRenderingContext2D,
  width: number,
  box: { x: number; y: number; w: number; h: number },
  text: string
) {
  const captionText = (text || "").replace(/\.{2,}|…+/g, "").trim()
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(box.x, box.y, box.w, box.h)

  const border = Math.max(2, Math.round(width * 0.0035))
  ctx.strokeStyle = "#111111"
  ctx.lineWidth = border
  ctx.beginPath()
  ctx.moveTo(box.x, box.y)
  ctx.lineTo(box.x + box.w, box.y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(box.x, box.y + box.h)
  ctx.lineTo(box.x + box.w, box.y + box.h)
  ctx.stroke()

  const maxW = box.w * 0.86
  const size = fitFontSize(
    ctx,
    captionText || " ",
    maxW,
    Math.round(width * 0.048),
    Math.round(width * 0.028),
    "700"
  )
  ctx.fillStyle = "#000000"
  ctx.font = `700 ${size}px Pretendard, "Noto Sans KR", Malgun Gothic, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(captionText, box.x + box.w / 2, box.y + box.h / 2)
}

/**
 * 미리보기 DOM의 상단 UI만 캡처 (미디어 img/video 제거 → 캔버스 오염 방지)
 * → 검색바·제목·조회수·자막이 미리보기와 픽셀 단위로 동일
 */
async function capturePreviewChrome(opts: {
  stageEl: HTMLElement
  width: number
  height: number
  mediaBox: { x: number; y: number; w: number; h: number }
}): Promise<HTMLCanvasElement | null> {
  const { stageEl, width, height, mediaBox } = opts
  const { default: html2canvas } = await import("html2canvas-pro")
  const sw = Math.max(1, stageEl.clientWidth)
  const sh = Math.max(1, stageEl.clientHeight)
  const scale = Math.min(3, Math.max(2.5, width / sw))

  const shot = await html2canvas(stageEl, {
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false,
    scale,
    width: sw,
    height: sh,
    imageTimeout: 1500,
    onclone: (_doc, cloned) => {
      cloned.querySelectorAll("img, video, canvas").forEach((node) => {
        node.remove()
      })
      const media = cloned.querySelector(
        '[data-story-media-stage="true"]'
      ) as HTMLElement | null
      if (media) {
        media.innerHTML = ""
        media.style.backgroundColor = "#000000"
      }
    },
  })

  const chromeH = Math.max(1, Math.round((mediaBox.y / height) * shot.height))
  const chrome = document.createElement("canvas")
  chrome.width = width
  chrome.height = mediaBox.y
  const ctx = chrome.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, chrome.width, chrome.height)
  ctx.drawImage(
    shot,
    0,
    0,
    shot.width,
    chromeH,
    0,
    0,
    chrome.width,
    chrome.height
  )
  return chrome
}

/**
 * 미리보기와 동일한 숏폼 녹화
 * - 상단 UI: 실제 미리보기 DOM 캡처 (검색바·제목·자막 일치)
 * - 미디어/줌: CORS-safe 이미지·비디오를 30fps로 직접 그림 (0바이트·버벅임 방지)
 */
export async function recordStoryPreviewStage(opts: {
  stageEl: HTMLElement
  clips: StoryExportClip[]
  frameSettings: StoryFrameSettings
  headerColor?: string
  totalDurationSec: number
  audioStream?: MediaStream | null
  play: () => Promise<void>
  getPlayheadSec: () => number
  getClipKey?: () => string
  isActive: () => boolean
  onProgress?: (progress: StoryExportProgress) => void
  fileBaseName?: string
}): Promise<{ blob: Blob; filename: string }> {
  const {
    stageEl,
    clips,
    frameSettings,
    headerColor = "#f7cf68",
    totalDurationSec,
    audioStream,
    play,
    getPlayheadSec,
    getClipKey,
    isActive,
    onProgress,
    fileBaseName = "story-shopping",
  } = opts

  if (!clips.length) throw new Error("다운로드할 클립이 없습니다.")

  onProgress?.({
    phase: "prepare",
    message: "클립 이미지를 불러오는 중… (녹화 전 준비)",
    ratio: 0.03,
  })

  const width = 1080
  const height = 1920
  const fps = 30
  let mediaBox = measureMediaBox(stageEl, width, height)

  // 같은 URL은 한 번만 받고, 여러 개 동시에 로드해 앞부분 대기 시간을 줄입니다.
  const mediaByKey = new Map<string, PreparedMedia>()
  const uniqueJobs: Array<{
    cacheKey: string
    url: string
    mediaType: "image" | "video"
    trimStartSec: number
  }> = []
  const seen = new Set<string>()
  for (const clip of clips) {
    if (!clip.mediaUrl) {
      mediaByKey.set(clip.key, { kind: "none" })
      continue
    }
    const cacheKey = `${clip.mediaType || "image"}::${clip.mediaUrl}::${clip.trimStartSec || 0}`
    if (!seen.has(cacheKey)) {
      seen.add(cacheKey)
      uniqueJobs.push({
        cacheKey,
        url: clip.mediaUrl,
        mediaType: clip.mediaType === "video" ? "video" : "image",
        trimStartSec: clip.trimStartSec || 0,
      })
    }
  }

  const preparedByCache = new Map<string, PreparedMedia>()
  let loadedCount = 0
  const concurrency = Math.min(3, Math.max(1, uniqueJobs.length))
  let nextJob = 0

  const runWorker = async () => {
    while (nextJob < uniqueJobs.length) {
      if (!isActive()) return
      const jobIndex = nextJob
      nextJob += 1
      const job = uniqueJobs[jobIndex]!
      const prepared = await loadPreparedMedia(
        job.url,
        job.mediaType,
        job.trimStartSec
      )
      preparedByCache.set(job.cacheKey, prepared)
      loadedCount += 1
      onProgress?.({
        phase: "prepare",
        message: `클립 이미지 불러오는 중… ${loadedCount}/${uniqueJobs.length}`,
        ratio: 0.03 + (loadedCount / Math.max(1, uniqueJobs.length)) * 0.05,
      })
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()))

  // 실패한 URL은 녹화 전에 반드시 성공할 때까지 순차 재시도
  for (let round = 0; round < 3; round++) {
    const failedJobs = uniqueJobs.filter(
      (job) => preparedByCache.get(job.cacheKey)?.kind === "none"
    )
    if (!failedJobs.length) break
    onProgress?.({
      phase: "prepare",
      message: `누락 이미지 재시도 중… ${failedJobs.length}개 (${round + 1}/3)`,
      ratio: 0.08 + round * 0.02,
    })
    for (const job of failedJobs) {
      if (!isActive()) break
      await wait(150)
      const prepared = await loadPreparedMedia(
        job.url,
        job.mediaType,
        job.trimStartSec
      )
      preparedByCache.set(job.cacheKey, prepared)
    }
  }

  const stillFailed = uniqueJobs.filter(
    (job) => preparedByCache.get(job.cacheKey)?.kind === "none"
  )
  if (stillFailed.length) {
    throw new Error(
      `이미지 ${stillFailed.length}개를 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 다운로드해주세요.`
    )
  }

  for (const clip of clips) {
    if (!clip.mediaUrl) {
      mediaByKey.set(clip.key, { kind: "none" })
      continue
    }
    const cacheKey = `${clip.mediaType || "image"}::${clip.mediaUrl}::${clip.trimStartSec || 0}`
    mediaByKey.set(
      clip.key,
      preparedByCache.get(cacheKey) || { kind: "none" }
    )
  }

  const missingClips = clips.filter(
    (clip) =>
      Boolean(clip.mediaUrl) && mediaByKey.get(clip.key)?.kind === "none"
  )
  if (missingClips.length) {
    throw new Error(
      `일부 클립 이미지가 준비되지 않았습니다 (${missingClips.length}개). 다시 시도해주세요.`
    )
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  canvas.style.cssText =
    "position:fixed;left:-99999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none"
  document.body.appendChild(canvas)
  const ctx = canvas.getContext("2d", { alpha: false })
  if (!ctx) {
    canvas.remove()
    throw new Error("캔버스를 사용할 수 없습니다.")
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  const stream = canvas.captureStream(0) // 수동 requestFrame으로 프레임 밀어넣기 (끊김 감소)
  const videoTrack = stream.getVideoTracks()[0]
  if (audioStream) {
    for (const track of audioStream.getAudioTracks()) {
      stream.addTrack(track)
    }
  }

  const mimeType = pickRecorderMime()
  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 16_000_000,
      audioBitsPerSecond: 256_000,
    })
  } catch {
    recorder = new MediaRecorder(stream)
  }

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data)
  }
  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      resolve(
        new Blob(chunks, {
          type: recorder.mimeType || mimeType || "video/webm",
        })
      )
    }
    recorder.onerror = () => reject(new Error("영상 녹화에 실패했습니다."))
  })

  let drawing = true
  let frameIndex = 0
  let lastMediaKey = ""
  let lastChromeKey = ""
  let chromeCanvas: HTMLCanvasElement | null = null
  let chromeBusy = false
  let captionBox = measureCaptionBox(stageEl, width, height, mediaBox)
  /** 직전 성공 미디어 프레임 — 전환 시 언더레이/크로스페이드용 */
  let holdCanvas: HTMLCanvasElement | null = null
  let holdClipKey = ""
  let prevCaptionText = clips[0]?.text || ""
  /** 클립 전환 크로스페이드 — 너무 짧으면 뚝 끊긴 느낌 */
  const CROSSFADE_SEC = 0.62
  const reloadingKeys = new Set<string>()
  /** 클립별 첫 프레임 미리 구워 두어 전환 시 즉시 페이드 */
  const openingFrameByKey = new Map<string, HTMLCanvasElement>()

  const bakeOpeningFrames = () => {
    const { w, h } = mediaBox
    for (const clip of clips) {
      const media = mediaByKey.get(clip.key)
      if (!media || media.kind === "none") continue
      const frame = document.createElement("canvas")
      frame.width = Math.max(2, w)
      frame.height = Math.max(2, h)
      const fctx = frame.getContext("2d")
      if (!fctx) continue
      fctx.fillStyle = clip.backgroundColor || "#111111"
      fctx.fillRect(0, 0, frame.width, frame.height)
      const motion = {
        effect: (clip.motionEffect || "none") as StoryExportMotion["effect"],
        progress: 0,
        mediaScale: clip.mediaScale ?? 1,
        mediaOffsetX: clip.mediaOffsetX ?? 0,
        mediaOffsetY: clip.mediaOffsetY ?? 0,
        fit: (clip.mediaFit || "cover") as "cover" | "contain",
        backgroundColor: clip.backgroundColor || "#000000",
      }
      const effect = resolveMotionTransform(motion.effect, 0)
      const userScale = Math.max(0.2, motion.mediaScale)
      const scale = userScale * effect.scale
      fctx.save()
      fctx.translate(frame.width / 2, frame.height / 2)
      fctx.scale(scale, scale)
      fctx.translate(
        (motion.mediaOffsetX / 100) * frame.width +
          (effect.txPct / 100) * frame.width,
        (motion.mediaOffsetY / 100) * frame.height +
          (effect.tyPct / 100) * frame.height
      )
      fctx.translate(-frame.width / 2, -frame.height / 2)
      if (media.kind === "image") {
        drawFittedImage(
          fctx,
          media.image,
          0,
          0,
          frame.width,
          frame.height,
          motion.fit,
          media.image.naturalWidth,
          media.image.naturalHeight
        )
      } else if (media.video.videoWidth > 0) {
        drawFittedImage(
          fctx,
          media.video,
          0,
          0,
          frame.width,
          frame.height,
          motion.fit,
          media.video.videoWidth,
          media.video.videoHeight
        )
      }
      fctx.restore()
      openingFrameByKey.set(clip.key, frame)
    }
  }

  const ensureMediaForClip = (clip: StoryExportClip) => {
    if (!clip.mediaUrl) return
    const current = mediaByKey.get(clip.key)
    if (current && current.kind !== "none") return
    if (reloadingKeys.has(clip.key)) return
    reloadingKeys.add(clip.key)
    void loadPreparedMedia(
      clip.mediaUrl,
      clip.mediaType === "video" ? "video" : "image",
      clip.trimStartSec || 0
    )
      .then((prepared) => {
        if (prepared.kind !== "none") {
          mediaByKey.set(clip.key, prepared)
          const cacheKey = `${clip.mediaType || "image"}::${clip.mediaUrl}::${clip.trimStartSec || 0}`
          preparedByCache.set(cacheKey, prepared)
        }
      })
      .finally(() => {
        reloadingKeys.delete(clip.key)
      })
  }

  const clipAt = (sec: number) => {
    const t = Math.max(0, sec)
    for (const clip of clips) {
      if (t >= clip.startSec && t < clip.endSec - 0.0001) return clip
    }
    return clips[clips.length - 1]!
  }

  const clipIndexAt = (sec: number) => {
    const clip = clipAt(sec)
    return clips.findIndex((item) => item.key === clip.key)
  }

  const motionFor = (clip: StoryExportClip, playhead: number): StoryExportMotion => {
    const effect = clip.motionEffect || "none"
    const localSec = Math.max(0, playhead - clip.startSec)
    const effectDurationSec =
      effect === "shake"
        ? 0.5
        : effect === "pulse"
          ? 1
          : effect === "flash"
            ? 0.7
            : effect === "blur-in"
              ? 0.85
              : Math.max(0.8, clip.durationSec || 1)
    const progress =
      effectDurationSec > 0 ? localSec / effectDurationSec : 0
    return {
      effect,
      progress:
        effect === "shake" || effect === "pulse"
          ? progress
          : Math.min(1, progress),
      mediaScale: clip.mediaScale ?? 1,
      mediaOffsetX: clip.mediaOffsetX ?? 0,
      mediaOffsetY: clip.mediaOffsetY ?? 0,
      fit: clip.mediaFit || "cover",
      backgroundColor: clip.backgroundColor || "#000000",
    }
  }

  const refreshChrome = async (clip: StoryExportClip, force = false) => {
    if (chromeBusy) return
    if (!force && chromeCanvas) return
    chromeBusy = true
    try {
      await wait(40)
      mediaBox = measureMediaBox(stageEl, width, height)
      captionBox = measureCaptionBox(stageEl, width, height, mediaBox)
      const captured = await capturePreviewChrome({
        stageEl,
        width,
        height,
        mediaBox,
      })
      if (captured) {
        chromeCanvas = captured
        lastChromeKey = clip.key
      }
    } catch (error) {
      console.warn("[StoryExport] 미리보기 크롬 캡처 실패:", error)
    } finally {
      chromeBusy = false
    }
  }

  const ensureHoldCanvas = () => {
    const { w, h } = mediaBox
    if (!holdCanvas) {
      holdCanvas = document.createElement("canvas")
      holdCanvas.width = Math.max(2, w)
      holdCanvas.height = Math.max(2, h)
    } else if (holdCanvas.width !== w || holdCanvas.height !== h) {
      holdCanvas.width = Math.max(2, w)
      holdCanvas.height = Math.max(2, h)
    }
    return holdCanvas
  }

  const snapshotHoldFromMain = () => {
    const hold = ensureHoldCanvas()
    const { x, y, w, h } = mediaBox
    const lctx = hold.getContext("2d")
    if (!lctx) return
    lctx.drawImage(canvas, x, y, w, h, 0, 0, w, h)
  }

  /** 다음·다다음 클립 비디오를 미리 시크·디코드해 전환 끊김을 줄임 */
  const prefetchNextClipMedia = (playhead: number) => {
    const idx = clipIndexAt(playhead)
    for (const offset of [1, 2]) {
      const next = clips[idx + offset]
      if (!next) continue
      const media = mediaByKey.get(next.key)
      if (media?.kind === "video") {
        try {
          const target = Math.max(0, next.trimStartSec || 0)
          if (Math.abs(media.video.currentTime - target) > 0.12) {
            media.video.currentTime = target
          }
          // 메타만 깨워 두면 전환 직후 readyState가 빨리 올라감
          if (media.video.paused && media.video.readyState < 2) {
            void media.video.play().then(() => media.video.pause()).catch(() => undefined)
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  const paintMedia = (
    clip: StoryExportClip,
    motion: StoryExportMotion,
    effect: ReturnType<typeof resolveMotionTransform>,
    playhead: number
  ) => {
    const { x, y, w, h } = mediaBox
    const localSec = Math.max(0, playhead - clip.startSec)
    const timeToEnd = Math.max(0, clip.endSec - playhead)
    const clipIdx = clipIndexAt(playhead)
    const nextClip = clipIdx >= 0 ? clips[clipIdx + 1] : undefined
    const nextOpening = nextClip ? openingFrameByKey.get(nextClip.key) : undefined

    // 진입 페이드(이전→현재) + 종료 페이드(현재→다음 오프닝)로 끊김 완화
    const enterRaw =
      holdCanvas && holdClipKey && holdClipKey !== clip.key
        ? Math.min(1, localSec / CROSSFADE_SEC)
        : 1
    const exitRaw =
      nextOpening && timeToEnd < CROSSFADE_SEC && clip.durationSec > CROSSFADE_SEC * 1.35
        ? Math.min(1, timeToEnd / CROSSFADE_SEC)
        : 1
    const enterFade = easeInOutCubic(enterRaw)
    const exitFade = easeInOutCubic(exitRaw)
    const inExitCrossfade = Boolean(nextOpening && exitRaw < 0.999)

    // 1) 언더레이 — 종료 페이드 중엔 hold를 깔면 이중 노출로 탁해지므로 배경만
    if (inExitCrossfade) {
      ctx.fillStyle = motion.backgroundColor || "#111111"
      ctx.fillRect(x, y, w, h)
    } else if (holdCanvas) {
      ctx.drawImage(holdCanvas, x, y, w, h)
    } else {
      ctx.fillStyle = motion.backgroundColor || "#111111"
      ctx.fillRect(x, y, w, h)
    }

    const media = mediaByKey.get(clip.key)
    const opening = openingFrameByKey.get(clip.key)
    if ((!media || media.kind === "none") && !opening) {
      ensureMediaForClip(clip)
      return
    }

    const drawSource = (
      source: CanvasImageSource,
      srcW: number,
      srcH: number,
      alpha: number
    ) => {
      if (!srcW || !srcH) return false
      const cx = x + w / 2
      const cy = y + h / 2
      const userScale = Math.max(0.2, motion.mediaScale || 1)
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, w, h)
      ctx.clip()
      ctx.globalAlpha = Math.min(1, Math.max(0, alpha * effect.opacity))
      ctx.translate(cx, cy)
      ctx.rotate((effect.rotateDeg * Math.PI) / 180)
      ctx.scale(userScale * effect.scale, userScale * effect.scale)
      ctx.translate(
        (motion.mediaOffsetX / 100) * w + (effect.txPct / 100) * w,
        (motion.mediaOffsetY / 100) * h + (effect.tyPct / 100) * h
      )
      ctx.translate(-cx, -cy)
      const filters: string[] = []
      if (effect.blurPx > 0.1) filters.push(`blur(${effect.blurPx}px)`)
      if (Math.abs(effect.brightness - 1) > 0.01) {
        filters.push(`brightness(${effect.brightness})`)
      }
      ctx.filter = filters.length ? filters.join(" ") : "none"
      drawFittedImage(ctx, source, x, y, w, h, motion.fit, srcW, srcH)
      ctx.restore()
      return true
    }

    let drew = false

    // 비디오는 오프닝 페이드 중에도 미리 play/seek 해서 라이브 프레임이 바로 이어지게
    if (media?.kind === "video") {
      const video = media.video
      if (clip.key !== lastMediaKey) {
        try {
          const target = Math.max(0, clip.trimStartSec || 0)
          if (Math.abs(video.currentTime - target) > 0.08) {
            video.currentTime = target
          }
        } catch {
          /* ignore */
        }
        void video.play().catch(() => undefined)
      }
      if (clip.trimEndSec != null && video.currentTime >= clip.trimEndSec) {
        try {
          video.currentTime = Math.max(0, clip.trimStartSec || 0)
        } catch {
          /* ignore */
        }
      }
    }

    // 전환 초반: 미리 구운 첫 프레임으로 페이드 (비디오 seek 대기·끊김 방지)
    const videoReady =
      media?.kind === "video" &&
      media.video.readyState >= 2 &&
      media.video.videoWidth > 0
    const preferOpening =
      Boolean(opening) &&
      (enterRaw < 0.55 || (media?.kind === "video" && enterRaw < 0.72 && !videoReady))

    if (preferOpening && opening) {
      ctx.save()
      ctx.globalAlpha = enterFade * exitFade
      ctx.drawImage(opening, x, y, w, h)
      ctx.restore()
      drew = true
      // 비디오가 이미 준비됐으면 오프닝 위에 살짝 섞어 하드컷 방지
      if (videoReady && media?.kind === "video" && enterRaw > 0.2) {
        const blend = easeInOutCubic(Math.min(1, (enterRaw - 0.2) / 0.5))
        drawSource(
          media.video,
          media.video.videoWidth,
          media.video.videoHeight,
          enterFade * exitFade * blend
        )
      }
    } else if (media?.kind === "video") {
      const video = media.video
      if (videoReady) {
        drew = drawSource(
          video,
          video.videoWidth,
          video.videoHeight,
          enterFade * exitFade
        )
      } else if (opening) {
        ctx.save()
        ctx.globalAlpha = enterFade * exitFade
        ctx.drawImage(opening, x, y, w, h)
        ctx.restore()
        drew = true
      }
    } else if (media?.kind === "image") {
      const image = media.image
      drew = drawSource(
        image,
        image.naturalWidth,
        image.naturalHeight,
        enterFade * exitFade
      )
    } else if (opening) {
      ctx.save()
      ctx.globalAlpha = enterFade * exitFade
      ctx.drawImage(opening, x, y, w, h)
      ctx.restore()
      drew = true
    }

    // 클립 끝: 다음 오프닝을 올려 자연스럽게 이어 붙임
    if (nextOpening && exitRaw < 0.999) {
      ctx.save()
      ctx.globalAlpha = 1 - exitFade
      ctx.drawImage(nextOpening, x, y, w, h)
      ctx.restore()
      drew = true
    }

    if (
      drew &&
      !inExitCrossfade &&
      (enterRaw >= 0.97 || holdClipKey === clip.key || !holdCanvas)
    ) {
      // 종료 페이드 중 hold를 찍으면 다음 오프닝이 섞여 다음 진입이 탁해짐
      snapshotHoldFromMain()
      holdClipKey = clip.key
    }
  }

  const paintCaptionSmooth = (clip: StoryExportClip, playhead: number) => {
    const localSec = Math.max(0, playhead - clip.startSec)
    const captionFadeSec = 0.28
    const fade =
      localSec < captionFadeSec && prevCaptionText && prevCaptionText !== clip.text
        ? easeInOutCubic(localSec / captionFadeSec)
        : 1

    if (fade < 1 && prevCaptionText && prevCaptionText !== clip.text) {
      // 이전 대본 → 새 대본 크로스페이드
      drawLiveCaption(ctx, width, captionBox, prevCaptionText)
      ctx.save()
      // drawLiveCaption이 흰 배경을 깔으므로, 새 대본만 알파로 덮기 위해 직접 그림
      const box = captionBox
      ctx.globalAlpha = fade
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(box.x, box.y, box.w, box.h)
      const captionText = (clip.text || "").replace(/\.{2,}|…+/g, "").trim()
      const maxW = box.w * 0.86
      const size = fitFontSize(
        ctx,
        captionText || " ",
        maxW,
        Math.round(width * 0.048),
        Math.round(width * 0.028),
        "700"
      )
      ctx.fillStyle = "#000000"
      ctx.font = `700 ${size}px Pretendard, "Noto Sans KR", Malgun Gothic, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(captionText, box.x + box.w / 2, box.y + box.h / 2)
      ctx.restore()
    } else {
      drawLiveCaption(ctx, width, captionBox, clip.text)
    }
    if (localSec >= captionFadeSec) prevCaptionText = clip.text
  }

  const paintFrame = () => {
    const playhead = getPlayheadSec()
    const clip = clipAt(playhead)
    const motion = motionFor(clip, playhead)
    const effect = resolveMotionTransform(motion.effect, motion.progress)

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)

    if (chromeCanvas) {
      ctx.drawImage(chromeCanvas, 0, 0, width, mediaBox.y)
    } else {
      drawChannelChrome(
        ctx,
        width,
        mediaBox.y,
        frameSettings,
        clip.text,
        headerColor
      )
    }

    paintCaptionSmooth(clip, playhead)
    paintMedia(clip, motion, effect, playhead)
    lastMediaKey = clip.key
    prefetchNextClipMedia(playhead)

    if (!chromeCanvas && !chromeBusy) {
      void refreshChrome(clip)
    }

    frameIndex += 1
  }

  onProgress?.({
    phase: "prepare",
    message: "미리보기 UI 캡처 중…",
    ratio: 0.08,
  })
  await refreshChrome(clips[0]!, true)
  bakeOpeningFrames()

  for (let i = 0; i < 8; i++) {
    paintFrame()
    await wait(16)
  }
  // 첫 프레임 hold 확보
  snapshotHoldFromMain()
  holdClipKey = clips[0]?.key || ""

  if (!isActive()) {
    canvas.remove()
    throw new Error("녹화가 취소되었습니다.")
  }

  recorder.start(50)
  onProgress?.({
    phase: "record",
    message: "미리보기와 동일하게 녹화 중…",
    ratio: 0.1,
  })

  const recordStartedAt = performance.now()

  const frameInterval = 1000 / fps
  let nextFrameAt = performance.now()
  let lastProgressAt = 0
  const trackWithRequest = videoTrack as MediaStreamTrack & {
    requestFrame?: () => void
  }

  const drawLoop = () => {
    if (!drawing) return
    const now = performance.now()
    // 한 틱에 한 프레임만 — 밀린 프레임을 몰아서 그리면 뚝뚝 끊김
    if (now >= nextFrameAt) {
      paintFrame()
      trackWithRequest.requestFrame?.()
      nextFrameAt += frameInterval
      // 너무 뒤처지면 오디오 타임라인에 맞춰 리듬만 재동기화 (프레임 스킵 연사 금지)
      if (nextFrameAt < now - frameInterval * 2) {
        nextFrameAt = now + frameInterval
      }
    }

    if (now - lastProgressAt > 450) {
      lastProgressAt = now
      const playhead = getPlayheadSec()
      onProgress?.({
        phase: "record",
        message: `녹화 중… ${playhead.toFixed(1)}s / ${totalDurationSec.toFixed(1)}s`,
        ratio: Math.min(
          0.88,
          0.1 + (playhead / Math.max(0.1, totalDurationSec)) * 0.78
        ),
      })
    }
    requestAnimationFrame(drawLoop)
  }
  requestAnimationFrame(drawLoop)

  try {
    await play()
  } finally {
    /* keep drawing briefly */
  }

  const endAt = performance.now() + 350
  while (performance.now() < endAt) {
    paintFrame()
    trackWithRequest.requestFrame?.()
    await wait(frameInterval)
  }
  drawing = false
  paintFrame()
  trackWithRequest.requestFrame?.()

  const recordedWallSec = (performance.now() - recordStartedAt) / 1000

  try {
    recorder.requestData()
  } catch {
    /* ignore */
  }

  if (recorder.state === "recording" || recorder.state === "paused") {
    recorder.stop()
  }
  const webmBlob = await stopped

  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      /* ignore */
    }
  }
  canvas.remove()

  for (const media of mediaByKey.values()) {
    if (media.kind === "video") {
      try {
        media.video.pause()
        media.video.removeAttribute("src")
        media.video.load()
      } catch {
        /* ignore */
      }
    }
  }

  if (!webmBlob.size) {
    throw new Error(
      "녹화된 영상이 비어 있습니다. 브라우저를 새로고침한 뒤 다시 시도해주세요."
    )
  }

  // 실제 녹화 시간과 타임라인 중 더 긴 쪽을 길이로 사용 (Windows 즉시 종료 방지)
  const durationSec = Math.max(0.5, totalDurationSec, recordedWallSec * 0.98)

  onProgress?.({
    phase: "encode",
    message: "영상 길이 메타 보정 중…",
    ratio: 0.88,
  })

  let outBlob = webmBlob
  try {
    outBlob = await fixWebmBlobDuration(webmBlob, durationSec)
  } catch (error) {
    console.warn("[StoryExport] WebM duration 보정 실패:", error)
    outBlob = webmBlob
  }

  onProgress?.({
    phase: "encode",
    message: "Windows 재생용 WebM 정리 중…",
    ratio: 0.92,
  })

  try {
    outBlob = await remuxWebmWithDuration(outBlob, durationSec, (ratio) => {
      onProgress?.({
        phase: "encode",
        message: `Windows 재생용 WebM 정리 중… ${Math.round(ratio * 100)}%`,
        ratio: 0.92 + ratio * 0.07,
      })
    })
  } catch (error) {
    // remux 실패해도 duration 보정된 webm은 유지
    console.warn("[StoryExport] WebM 재패키징 실패, duration 보정본 사용:", error)
  }

  // remux 후에도 duration 한 번 더 보정
  try {
    outBlob = await fixWebmBlobDuration(outBlob, durationSec)
  } catch {
    /* ignore */
  }

  if (!outBlob.size) {
    throw new Error("변환된 영상이 비어 있습니다.")
  }

  const filename = `${fileBaseName}-${Date.now()}.webm`

  onProgress?.({
    phase: "done",
    message: "다운로드 준비 완료",
    ratio: 1,
  })

  return { blob: outBlob, filename }
}

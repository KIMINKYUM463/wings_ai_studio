/** 여행쇼핑숏폼 프레임 — 미리보기·MP4·썸네일이 모두 이 그리기 함수 하나를 씁니다 */

import {
  finalizeRecordedVideo,
  pickVideoRecorderMime,
  recorderContainerMime,
} from "@/lib/shotform-recorder-format"
import { startRenderTicker } from "@/lib/shotform-render-ticker"
import type {
  TravelInfo,
  TravelMotion,
  TravelPhoto,
  TravelScriptVariant,
} from "@/lib/travel-shorts/types"

export const TRAVEL_CANVAS_W = 1080
export const TRAVEL_CANVAS_H = 1920
/** 사진을 눈에 담을 시간 — 짧은 문장이어도 장면을 이만큼은 보여줌 */
export const TRAVEL_MIN_SCENE_SEC = 2.3
const FADE_SEC = 0.35
const CAPTION_POP_SEC = 0.2
const FONT = "'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif"
const ACCENT = "#ffe14d"

export type TravelTimeline = {
  scenes: Array<[number, number]>
  durationSec: number
}

export type TravelFrameInput = {
  variant: TravelScriptVariant
  images: Map<string, ImageBitmap>
  /** 사진 id → 움직이는 클립. 있으면 사진 대신 재생 */
  videos?: Map<string, HTMLVideoElement>
  timeline: TravelTimeline
  info: TravelInfo
  adLabel: boolean
  commentKeyword: string
}

/** 음성이 없을 때 글자 수로 장면 길이를 추정 (말하는 속도 ≈ 초당 6.5자) */
export function estimateTravelTimeline(variant: TravelScriptVariant): TravelTimeline {
  let t = 0
  const scenes = variant.scenes.map((scene) => {
    const chars = scene.line.replace(/\s/g, "").length
    const len = Math.max(TRAVEL_MIN_SCENE_SEC, chars / 6.5 + 0.4)
    const span: [number, number] = [t, t + len]
    t += len
    return span
  })
  return { scenes, durationSec: t }
}

export function sceneIndexAt(timeline: TravelTimeline, t: number): number {
  const idx = timeline.scenes.findIndex(([, end]) => t < end)
  return idx === -1 ? timeline.scenes.length - 1 : idx
}

/**
 * 상세페이지 사진은 가로 사진을 정사각 캔버스에 넣고 위아래를 흰색 등 단색으로 채운 경우가 많아,
 * 그대로 꽉 채우면 화면 위아래에 띠가 생김 → 모서리 색과 같은 줄·열을 바깥에서부터 걷어냄
 */
function contentBox(bmp: ImageBitmap): { sx: number; sy: number; sw: number; sh: number } | null {
  const scale = Math.min(1, 256 / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  const isBg = (x: number, y: number) => {
    const i = (y * w + x) * 4
    return Math.abs(data[i]! - data[0]!) + Math.abs(data[i + 1]! - data[1]!) + Math.abs(data[i + 2]! - data[2]!) < 24
  }
  const rowIsBg = (y: number) => {
    for (let x = 0; x < w; x += 1) if (!isBg(x, y)) return false
    return true
  }
  const colIsBg = (x: number, y0: number, y1: number) => {
    for (let y = y0; y < y1; y += 1) if (!isBg(x, y)) return false
    return true
  }
  let top = 0
  while (top < h && rowIsBg(top)) top += 1
  let bottom = h
  while (bottom > top && rowIsBg(bottom - 1)) bottom -= 1
  let left = 0
  while (left < w && colIsBg(left, top, bottom)) left += 1
  let right = w
  while (right > left && colIsBg(right - 1, top, bottom)) right -= 1
  if (top === 0 && left === 0 && bottom === h && right === w) return null
  // 단색 사진·로고처럼 거의 전부가 '여백'이면 자르지 않음
  if (right - left < w * 0.3 || bottom - top < h * 0.3) return null
  // 축소본 1px = 원본 여러 px → 경계의 번진 여백이 남지 않게 한 칸 더 안쪽으로
  const sx = Math.min(bmp.width - 1, Math.ceil((left + (left ? 1 : 0)) / scale))
  const sy = Math.min(bmp.height - 1, Math.ceil((top + (top ? 1 : 0)) / scale))
  const ex = Math.max(sx + 1, Math.floor((right - (right < w ? 1 : 0)) / scale))
  const ey = Math.max(sy + 1, Math.floor((bottom - (bottom < h ? 1 : 0)) / scale))
  return { sx, sy, sw: ex - sx, sh: ey - sy }
}

/** 단색 여백을 걷어낸 사진 */
async function loadPhotoBitmap(blob: Blob): Promise<ImageBitmap> {
  const bmp = await createImageBitmap(blob)
  const box = contentBox(bmp)
  if (!box) return bmp
  const cropped = await createImageBitmap(bmp, box.sx, box.sy, box.sw, box.sh)
  bmp.close()
  return cropped
}

export async function loadTravelImages(photos: TravelPhoto[]): Promise<Map<string, ImageBitmap>> {
  const entries = await Promise.all(photos.map(async (p) => [p.id, await loadPhotoBitmap(p.blob)] as const))
  return new Map(entries)
}

export async function loadTravelVideos(photos: TravelPhoto[]): Promise<Map<string, HTMLVideoElement>> {
  const entries = await Promise.all(
    photos
      .filter((p) => p.video)
      .map(
        (p) =>
          new Promise<[string, HTMLVideoElement] | null>((resolve) => {
            const video = document.createElement("video")
            video.muted = true
            video.playsInline = true
            video.preload = "auto"
            video.onloadeddata = () => resolve([p.id, video])
            video.onerror = () => resolve(null)
            video.src = URL.createObjectURL(p.video!)
          })
      )
  )
  return new Map(entries.filter((e): e is [string, HTMLVideoElement] => e !== null))
}

export function disposeTravelVideos(videos: Map<string, HTMLVideoElement>) {
  videos.forEach((video) => {
    video.pause()
    URL.revokeObjectURL(video.src)
    video.removeAttribute("src")
    video.load()
  })
}

/** 직접 올린 영상의 첫 장면을 정지 이미지로 (AI 분류·썸네일용) */
export async function videoPosterBlob(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement("video")
    video.muted = true
    video.playsInline = true
    video.src = url
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error("영상을 읽지 못했습니다. MP4 파일을 올려 주세요."))
    })
    video.currentTime = Math.min(0.5, (video.duration || 1) / 2)
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
    })
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")!.drawImage(video, 0, 0)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("첫 장면 추출 실패"))), "image/jpeg", 0.9)
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** AI 전송용 축소 JPEG data URL (여백 제거) */
export async function photoToSmallDataUrl(blob: Blob, maxSide = 640, quality = 0.72): Promise<string> {
  const bmp = await loadPhotoBitmap(blob)
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return canvas.toDataURL("image/jpeg", quality)
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)

/** 진행률 p(0~1)에 따른 확대·이동 — 화면을 항상 꽉 채우도록 1.0 이상으로만 확대 */
function motionTransform(motion: TravelMotion, p: number): { zoom: number; dx: number; dy: number } {
  const e = p * (2 - p) * 0.5 + p * 0.5
  switch (motion) {
    case "push-in":
      return { zoom: 1.04 + 0.12 * e, dx: 0, dy: 0 }
    case "pull-out":
      return { zoom: 1.16 - 0.12 * e, dx: 0, dy: 0 }
    case "pan-left":
      return { zoom: 1.14, dx: 0.05 - 0.1 * e, dy: 0 }
    case "pan-right":
      return { zoom: 1.14, dx: -0.05 + 0.1 * e, dy: 0 }
    case "rise":
      return { zoom: 1.14, dx: 0, dy: 0.05 - 0.1 * e }
  }
}

type SceneSource = ImageBitmap | HTMLVideoElement

function sourceSize(src: SceneSource): [number, number] {
  return src instanceof HTMLVideoElement ? [src.videoWidth, src.videoHeight] : [src.width, src.height]
}

/** 클립이 디코딩돼 있으면 클립, 아니면 사진 */
function sceneSource(input: TravelFrameInput, photoId: string): SceneSource | undefined {
  const video = input.videos?.get(photoId)
  return video && video.readyState >= 2 ? video : input.images.get(photoId)
}

/**
 * 지금 장면의 클립만 장면 시각에 맞춰 둠. 재생 중엔 클립이 스스로 흘러가고 크게 어긋날 때만 맞추며,
 * 클립이 장면보다 짧으면 마지막 프레임에서 멈춘 채 카메라 움직임만 이어짐
 */
function syncSceneVideos(input: TravelFrameInput, activeId: string, since: number, live: boolean) {
  input.videos?.forEach((video, id) => {
    if (id !== activeId) {
      if (!video.paused) video.pause()
      return
    }
    const end = Math.max(0, (video.duration || 0) - 0.05)
    const target = Math.min(since, end)
    if (Math.abs(video.currentTime - target) > (live ? 0.3 : 0.04)) video.currentTime = target
    if (live && video.paused && target < end) void video.play().catch(() => undefined)
    if (!live && !video.paused) video.pause()
  })
}

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  img: SceneSource | undefined,
  motion: TravelMotion,
  p: number,
  alpha: number
) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const [iw, ih] = img ? sourceSize(img) : [0, 0]
  if (!img || !iw || !ih) {
    ctx.fillStyle = "#1f2937"
    ctx.fillRect(0, 0, W, H)
    return
  }
  const { zoom, dx, dy } = motionTransform(motion, p)
  const cover = Math.max(W / iw, H / ih) * zoom
  const dw = iw * cover
  const dh = ih * cover
  const maxX = (dw - W) / 2
  const maxY = (dh - H) / 2
  const x = (W - dw) / 2 + Math.max(-maxX, Math.min(maxX, dx * W))
  const y = (H - dh) / 2 + Math.max(-maxY, Math.min(maxY, dy * H))
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(img, x, y, dw, dh)
  ctx.restore()
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number): number {
  let s = size
  ctx.font = `${weight} ${s}px ${FONT}`
  while (s > 18 && ctx.measureText(text).width > maxW) {
    s -= 2
    ctx.font = `${weight} ${s}px ${FONT}`
  }
  return s
}

function outlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  strokeW: number
) {
  ctx.lineJoin = "round"
  ctx.miterLimit = 2
  ctx.strokeStyle = "rgba(0,0,0,0.92)"
  ctx.lineWidth = strokeW
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function drawGradients(ctx: CanvasRenderingContext2D) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.34)
  top.addColorStop(0, "rgba(0,0,0,0.62)")
  top.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, H * 0.34)
  const bottom = ctx.createLinearGradient(0, H * 0.55, 0, H)
  bottom.addColorStop(0, "rgba(0,0,0,0)")
  bottom.addColorStop(1, "rgba(0,0,0,0.6)")
  ctx.fillStyle = bottom
  ctx.fillRect(0, H * 0.55, W, H * 0.45)
}

function drawHeadline(ctx: CanvasRenderingContext2D, headline: [string, string], u: number, big: boolean) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const maxW = W * 0.88
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  const base = big ? 1.45 : 1
  const y1 = H * (big ? 0.3 : 0.125)
  const s1 = fitFont(ctx, headline[0], 800, 68 * u * base, maxW)
  outlinedText(ctx, headline[0], W / 2, y1, "#ffffff", 12 * u * base)
  const s2 = fitFont(ctx, headline[1], 900, 84 * u * base, maxW)
  outlinedText(ctx, headline[1], W / 2, y1 + s1 * 0.25 + s2 * 1.05, ACCENT, 14 * u * base)
}

function drawAdBadge(ctx: CanvasRenderingContext2D, u: number) {
  ctx.font = `700 ${30 * u}px ${FONT}`
  const label = "광고"
  const w = ctx.measureText(label).width + 28 * u
  const x = 36 * u
  const y = 44 * u
  roundRect(ctx, x, y, w, 46 * u, 10 * u)
  ctx.fillStyle = "rgba(0,0,0,0.45)"
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(label, x + 14 * u, y + 24 * u)
}

function drawLocationChip(ctx: CanvasRenderingContext2D, text: string, u: number) {
  ctx.font = `700 ${30 * u}px ${FONT}`
  const label = `📍 ${text}`
  const w = ctx.measureText(label).width + 32 * u
  const x = ctx.canvas.width - 36 * u - w
  const y = 44 * u
  roundRect(ctx, x, y, w, 46 * u, 23 * u)
  ctx.fillStyle = "rgba(255,255,255,0.88)"
  ctx.fill()
  ctx.fillStyle = "#111827"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(label, x + 16 * u, y + 24 * u)
}

function drawCaption(ctx: CanvasRenderingContext2D, line: string, sinceStart: number, u: number) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const rows = line.split("\n").map((r) => r.trim()).filter(Boolean)
  if (!rows.length) return
  const k = easeOut(sinceStart / CAPTION_POP_SEC)
  const scale = 0.86 + 0.14 * k
  const size = Math.min(...rows.map((r) => fitFont(ctx, r, 800, 62 * u, W * 0.86)))
  const lineH = size * 1.28
  const cy = H * 0.66
  ctx.save()
  ctx.globalAlpha = k
  ctx.translate(W / 2, cy)
  ctx.scale(scale, scale)
  ctx.font = `800 ${size}px ${FONT}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  rows.forEach((row, i) => {
    const y = (i - (rows.length - 1) / 2) * lineH
    outlinedText(ctx, row, 0, y, "#ffffff", 11 * u)
  })
  ctx.restore()
}

function drawPriceTag(ctx: CanvasRenderingContext2D, price: string, u: number) {
  const H = ctx.canvas.height
  ctx.font = `900 ${44 * u}px ${FONT}`
  const w = ctx.measureText(price).width + 48 * u
  const x = 40 * u
  const y = H * 0.745
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.04)
  roundRect(ctx, 0, 0, w, 76 * u, 16 * u)
  ctx.fillStyle = ACCENT
  ctx.fill()
  ctx.fillStyle = "#111827"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(price, 24 * u, 40 * u)
  ctx.restore()
}

function drawCommentCta(ctx: CanvasRenderingContext2D, keyword: string, sinceStart: number, u: number) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const k = easeOut(sinceStart / 0.4)
  const w = W * 0.84
  const h = 150 * u
  const x = (W - w) / 2
  const y = H * 0.83 + (1 - k) * 60 * u
  ctx.save()
  ctx.globalAlpha = k
  roundRect(ctx, x, y, w, h, 28 * u)
  ctx.fillStyle = "rgba(255,255,255,0.94)"
  ctx.fill()
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const top = `댓글에 '${keyword}' 남겨주세요`
  ctx.fillStyle = "#111827"
  fitFont(ctx, top, 900, 46 * u, w - 48 * u)
  ctx.fillText(top, W / 2, y + 54 * u)
  ctx.font = `600 ${32 * u}px ${FONT}`
  ctx.fillStyle = "#4b5563"
  ctx.fillText("예약 링크를 바로 보내드려요", W / 2, y + 108 * u)
  ctx.restore()
}

function drawProgress(ctx: CanvasRenderingContext2D, ratio: number, u: number) {
  const W = ctx.canvas.width
  ctx.fillStyle = "rgba(255,255,255,0.25)"
  ctx.fillRect(0, 0, W, 6 * u)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W * Math.min(1, Math.max(0, ratio)), 6 * u)
}

/** @param live 재생·녹화 중이면 true — 클립을 재생시키고, 아니면 멈춘 채 해당 시각으로 이동 */
export function drawTravelFrame(ctx: CanvasRenderingContext2D, input: TravelFrameInput, t: number, live = false) {
  const { variant, timeline, info } = input
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const u = W / TRAVEL_CANVAS_W
  ctx.clearRect(0, 0, W, H)
  if (!variant.scenes.length) return

  const i = sceneIndexAt(timeline, t)
  const [start, end] = timeline.scenes[i]!
  const scene = variant.scenes[i]!
  const p = (t - start) / Math.max(0.01, end - start)
  const since = t - start
  syncSceneVideos(input, scene.photoId, since, live)

  if (i > 0 && since < FADE_SEC) {
    const prev = variant.scenes[i - 1]!
    drawPhoto(ctx, sceneSource(input, prev.photoId), prev.motion, 1, 1)
    drawPhoto(ctx, sceneSource(input, scene.photoId), scene.motion, p, since / FADE_SEC)
  } else {
    drawPhoto(ctx, sceneSource(input, scene.photoId), scene.motion, p, 1)
  }

  drawGradients(ctx)
  drawProgress(ctx, t / Math.max(0.01, timeline.durationSec), u)
  drawHeadline(ctx, variant.headline, u, false)
  if (input.adLabel) drawAdBadge(ctx, u)
  if (!info.hideName && info.region.trim()) drawLocationChip(ctx, info.region.trim(), u)
  drawCaption(ctx, scene.line, since, u)

  const isLast = i === variant.scenes.length - 1
  if (info.priceText.trim() && (i === 0 || isLast)) drawPriceTag(ctx, info.priceText.trim(), u)
  if (isLast && input.commentKeyword.trim()) drawCommentCta(ctx, input.commentKeyword.trim(), since, u)
}

/** 썸네일 — 첫 장면 사진 + 큰 헤드카피 */
export function drawTravelThumbnail(ctx: CanvasRenderingContext2D, input: TravelFrameInput) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const u = W / TRAVEL_CANVAS_W
  const first = input.variant.scenes[0]
  ctx.clearRect(0, 0, W, H)
  if (!first) return
  drawPhoto(ctx, input.images.get(first.photoId), first.motion, 0.5, 1)
  ctx.fillStyle = "rgba(0,0,0,0.28)"
  ctx.fillRect(0, 0, W, H)
  drawHeadline(ctx, input.variant.headline, u, true)
  if (input.adLabel) drawAdBadge(ctx, u)
  if (input.info.priceText.trim()) drawPriceTag(ctx, input.info.priceText.trim(), u)
}

const srtTime = (sec: number) => {
  const ms = Math.max(0, Math.round(sec * 1000))
  const pad = (n: number, l = 2) => String(n).padStart(l, "0")
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`
}

export function buildTravelSrt(variant: TravelScriptVariant, timeline: TravelTimeline): string {
  return variant.scenes
    .map((scene, i) => {
      const [s, e] = timeline.scenes[i] ?? [0, 0]
      return `${i + 1}\n${srtTime(s)} --> ${srtTime(e)}\n${scene.line.trim()}\n`
    })
    .join("\n")
}

/**
 * 캔버스를 실시간으로 그리며 녹화 (영상 길이만큼 걸림).
 * 크롬은 MP4, 그 외 브라우저는 WebM으로 저장됩니다.
 */
export async function recordTravelVideo(args: {
  input: TravelFrameInput
  audioBlob: Blob | null
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}): Promise<{ blob: Blob; ext: "mp4" | "webm" }> {
  const { input, audioBlob, onProgress, signal } = args
  const canvas = document.createElement("canvas")
  canvas.width = TRAVEL_CANVAS_W
  canvas.height = TRAVEL_CANVAS_H
  const ctx = canvas.getContext("2d")!
  const stream = canvas.captureStream(30)
  const audioCtx = new AudioContext()
  let source: AudioBufferSourceNode | null = null
  if (audioBlob) {
    const buffer = await audioCtx.decodeAudioData(await audioBlob.arrayBuffer())
    const dest = audioCtx.createMediaStreamDestination()
    source = audioCtx.createBufferSource()
    source.buffer = buffer
    source.connect(dest)
    dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track))
  }
  const mime = pickVideoRecorderMime(Boolean(audioBlob))
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 12_000_000,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
  })

  const duration = input.timeline.durationSec
  drawTravelFrame(ctx, input, 0)
  recorder.start(250)
  await audioCtx.resume()
  const t0 = audioCtx.currentTime
  source?.start()

  await new Promise<void>((resolve) => {
    // setInterval·rAF는 창이 비활성이면 느려져 녹화가 끊김 → Worker 타이머
    const stop = startRenderTicker(() => {
      const t = audioCtx.currentTime - t0
      if (signal?.aborted || t >= duration + 0.15) {
        stop()
        resolve()
        return
      }
      drawTravelFrame(ctx, input, Math.min(t, duration - 0.001), true)
      onProgress?.(t / duration)
    }, 30)
  })
  input.videos?.forEach((video) => video.pause())

  recorder.stop()
  await stopped
  source?.stop()
  stream.getTracks().forEach((track) => track.stop())
  void audioCtx.close()
  if (signal?.aborted) throw new DOMException("취소됨", "AbortError")
  const { blob, extension } = await finalizeRecordedVideo(
    chunks,
    recorderContainerMime(recorder, mime),
    duration
  )
  return { blob, ext: extension }
}

import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import {
  voiceSubtitleAtLineCues,
  type VoiceLineCue,
} from "@/lib/shotform-factory-line-tts"
import { isMvpThumbnailIntroTime } from "@/lib/mvp-thumbnail-intro"
import {
  resolveMvpPreviewVideoTime,
  syncMvpPreviewVideoToAudio,
  type MvpVideoAudioSyncState,
} from "@/lib/shotform-mvp-preview-sync"
import {
  hexToRgb,
  resolveSubtitleFontFamily,
  resolveSubtitleFontWeight,
} from "@/lib/mvp-subtitle-style"
import { setupMvpRenderAudioLayers } from "@/lib/mvp-preview-audio-mix"
import {
  DEFAULT_SUBTITLE_Y_PERCENT,
  normalizeSubtitleStyle,
  type MvpBgmClip,
  type MvpSubtitleStyle,
} from "@/lib/mvp-studio-types"
import {
  isMosaicCircleOverlay,
  isMosaicOverlay,
  mosaicOverlayBlockSize,
  mosaicOverlayDimensions,
  studioOverlayById,
  type PlacedStudioOverlay,
} from "@/lib/shotform-studio-overlay-catalog"
import { filterOverlaysAtVideoTime } from "@/lib/mvp-mosaic-overlay-utils"
import { drawVideoMosaicOnCanvas } from "@/lib/mvp-video-mosaic"
import {
  subtitleFromSchedule,
  type LineSubtitleCue,
} from "@/lib/shotform-mvp-edit-script"
import { convertWebmBlobToMp4 } from "@/lib/mvp-webm-to-mp4"
import type { EditPlanSegment } from "@/lib/shotform-auto-edit-types"
import {
  drawVideoContainWithSourceTransform,
  editPlanSegmentIndexAtOutputTime,
  getMvpEditPlanClipTransform,
  isDefaultMvpVideoSourceTransform,
  type MvpVideoSourceTransforms,
} from "@/lib/mvp-video-source-transform"

/** CapCut 미리보기 스테이지 너비(px) — `MvpCapCutEditor` max-w-[280px] */
export const MVP_PREVIEW_STAGE_WIDTH_PX = 280

export type MvpPreviewRenderInput = {
  videoUrl: string
  audioUrl: string
  voiceLineCues?: VoiceLineCue[] | null
  segments: NarrationSegment[]
  lineSchedule: LineSubtitleCue[]
  subtitleStyle: MvpSubtitleStyle
  thumbnailUrl?: string
  thumbnailIntroOn: boolean
  placedOverlays: PlacedStudioOverlay[]
  videoDurationSec: number
  audioDurationSec: number
  bgmClips?: MvpBgmClip[]
  editPlan?: readonly EditPlanSegment[]
  videoSourceTransforms?: MvpVideoSourceTransforms
  onProgress?: (ratio: number) => void
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("thumbnail load failed"))
    img.src = url
  })
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.muted = true
    video.playsInline = true
    video.preload = "auto"
    video.onloadedmetadata = () => resolve(video)
    video.onerror = () => reject(new Error("video load failed"))
    video.src = url
    video.load()
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  cw: number,
  ch: number
) {
  const iw = "videoWidth" in img ? img.videoWidth : (img as HTMLImageElement).naturalWidth
  const ih = "videoHeight" in img ? img.videoHeight : (img as HTMLImageElement).naturalHeight
  if (!iw || !ih) return
  const ia = iw / ih
  const ca = cw / ch
  let sx = 0
  let sy = 0
  let sw = iw
  let sh = ih
  if (ia > ca) {
    sw = ih * ca
    sx = (iw - sw) / 2
  } else {
    sh = iw / ca
    sy = (ih - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)
}

function drawVideoContain(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  cw: number,
  ch: number
) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return
  const va = vw / vh
  const ca = cw / ch
  let dw = cw
  let dh = ch
  let dx = 0
  let dy = 0
  if (va > ca) {
    dh = cw / va
    dy = (ch - dh) / 2
  } else {
    dw = ch * va
    dx = (cw - dw) / 2
  }
  ctx.drawImage(video, dx, dy, dw, dh)
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  ov: PlacedStudioOverlay,
  cw: number,
  ch: number,
  previewW: number,
  video?: HTMLVideoElement
) {
  if (isMosaicOverlay(ov.catalogId) && video && video.readyState >= 2) {
    const dims = mosaicOverlayDimensions(ov)
    drawVideoMosaicOnCanvas(ctx, video, cw, ch, {
      previewW,
      centerXPct: ov.x,
      centerYPct: ov.y,
      patchW: dims.w,
      patchH: dims.h,
      blockPx: mosaicOverlayBlockSize(ov),
      circle: isMosaicCircleOverlay(ov.catalogId),
      rotation: ov.rotation,
    })
    return
  }

  const scale = cw / previewW
  const x = (ov.x / 100) * cw
  const y = (ov.y / 100) * ch
  const size = ov.size * scale
  const entry = studioOverlayById(ov.catalogId)

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((ov.rotation * Math.PI) / 180)

  if (entry?.kind === "ring") {
    ctx.beginPath()
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2)
    ctx.strokeStyle = ov.color
    ctx.lineWidth = 2.5 * scale
    ctx.stroke()
  } else if (entry?.kind === "rounded-rect") {
    const rw = size
    const rh = size * 0.58
    roundRect(ctx, -rw / 2, -rh / 2, rw, rh, size * 0.15)
    ctx.fillStyle = ov.color
    ctx.globalAlpha = 0.85
    ctx.fill()
    ctx.globalAlpha = 1
  } else {
    ctx.beginPath()
    ctx.arc(0, 0, size / 2.4, 0, Math.PI * 2)
    ctx.strokeStyle = ov.color
    ctx.lineWidth = 2.5 * scale
    ctx.stroke()
  }

  ctx.restore()
}

function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: MvpSubtitleStyle,
  cw: number,
  ch: number,
  previewW: number
) {
  if (!text.trim()) return

  const scale = cw / previewW
  const x = ((style.x ?? 50) / 100) * cw
  const y = ((style.y ?? DEFAULT_SUBTITLE_Y_PERCENT) / 100) * ch
  const fontSize = style.sizePx * scale
  const fontFamily = resolveSubtitleFontFamily(style.fontId ?? "pretendard-bold")
  const weight = resolveSubtitleFontWeight(style)
  const maxW = cw * 0.92

  ctx.font = `${weight} ${fontSize}px ${fontFamily}`
  ctx.textAlign = (style.textAlign ?? "center") as CanvasTextAlign
  ctx.textBaseline = "middle"

  const metrics = ctx.measureText(text)

  if (style.bgOn) {
    const padX = 10 * scale
    const padY = 6 * scale
    const bgW = Math.min(maxW, metrics.width) + padX * 2
    const bgH = fontSize * 1.35 + padY * 2
    const { r, g, b } = hexToRgb(style.bgColor ?? "#000000")
    ctx.fillStyle = `rgba(${r},${g},${b},${(style.bgOpacity ?? 55) / 100})`
    roundRect(ctx, x - bgW / 2, y - bgH / 2, bgW, bgH, 6 * scale)
    ctx.fill()
  }

  if (style.textShadow) {
    ctx.shadowColor = "rgba(0,0,0,0.85)"
    ctx.shadowBlur = 6 * scale
    ctx.shadowOffsetX = 2 * scale
    ctx.shadowOffsetY = 2 * scale
  }

  if (style.outlineOn) {
    ctx.strokeStyle = style.outlineColor ?? "#000000"
    ctx.lineWidth = (style.outlineWidthPx ?? 1) * scale * 2
    ctx.lineJoin = "round"
    ctx.strokeText(text, x, y, maxW)
  }

  ctx.fillStyle = style.color
  ctx.fillText(text, x, y, maxW)

  ctx.shadowColor = "transparent"
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

function resolveSubtitleText(
  audioT: number,
  videoT: number,
  showThumbnail: boolean,
  cues: readonly VoiceLineCue[] | null | undefined,
  hasAudio: boolean,
  lineSchedule: readonly LineSubtitleCue[]
): string {
  if (showThumbnail) return ""
  if (cues?.length && hasAudio) {
    return voiceSubtitleAtLineCues(cues, audioT)
  }
  return subtitleFromSchedule(lineSchedule, videoT)
}

function pickRecorderMime(): { mimeType: string; ext: string } {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder unavailable")
  }
  const candidates = [
    "video/mp4;codecs=avc1,mp4a",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ]
  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return { mimeType, ext: mimeType.startsWith("video/mp4") ? "mp4" : "webm" }
    }
  }
  return { mimeType: "", ext: "webm" }
}

/** 미리보기와 동일 — 썸네일·영상·TTS·자막·오버레이 합성 */
export async function renderMvpPreviewToBlob(
  input: MvpPreviewRenderInput
): Promise<{ blob: Blob; ext: string }> {
  const {
    videoUrl,
    audioUrl,
    voiceLineCues,
    segments,
    lineSchedule,
    subtitleStyle: rawStyle,
    thumbnailUrl,
    thumbnailIntroOn,
    placedOverlays,
    videoDurationSec,
    audioDurationSec,
    bgmClips = [],
    editPlan = [],
    videoSourceTransforms = {},
    onProgress,
  } = input

  const subtitleStyle = normalizeSubtitleStyle(rawStyle)
  const canvas = document.createElement("canvas")
  canvas.width = 1080
  canvas.height = 1920
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas context failed")

  const video = await loadVideo(videoUrl)
  const audio = new Audio(audioUrl)
  audio.crossOrigin = "anonymous"
  audio.preload = "auto"

  await new Promise<void>((resolve, reject) => {
    audio.onloadedmetadata = () => resolve()
    audio.onerror = () => reject(new Error("audio load failed"))
    audio.load()
  })

  const thumbnailImg =
    thumbnailIntroOn && thumbnailUrl ? await loadImage(thumbnailUrl).catch(() => null) : null

  const audioDur = Math.max(0.1, audio.duration || audioDurationSec || 0.1)
  const videoDur = Math.max(0.1, video.duration || videoDurationSec || 0.1)

  const stream = canvas.captureStream(30)
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) throw new Error("AudioContext unavailable")

  const audioContext = new AudioCtx()
  if (audioContext.state === "suspended") {
    await audioContext.resume()
  }

  const source = audioContext.createMediaElementSource(audio)
  const destination = audioContext.createMediaStreamDestination()
  source.connect(destination)

  const renderLayers = await setupMvpRenderAudioLayers(audioContext, destination, {
    bgmClips,
  })

  const videoTrack = stream.getVideoTracks()[0]
  const audioTrack = destination.stream.getAudioTracks()[0]
  const combined = new MediaStream([videoTrack, audioTrack])

  const { mimeType, ext } = pickRecorderMime()
  const recorder = new MediaRecorder(
    combined,
    mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : { videoBitsPerSecond: 6_000_000 }
  )

  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const blobPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const type = mimeType || chunks[0]?.type || "video/webm"
      resolve(new Blob(chunks, { type }))
    }
    recorder.onerror = () => reject(new Error("recorder failed"))
  })

  const syncState: MvpVideoAudioSyncState = { lastScene: -1, lastCueKey: "" }

  video.currentTime = 0
  audio.currentTime = 0
  syncMvpPreviewVideoToAudio(
    video,
    0,
    voiceLineCues,
    segments,
    videoDur,
    audioDur,
    syncState,
    { forceSeek: true, holdOnEnd: true }
  )
  void video.play().catch(() => {})

  recorder.start(100)
  await audio.play()

  await new Promise<void>((resolve) => {
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      if (recorder.state !== "inactive") recorder.stop()
      video.pause()
      audio.pause()
      renderLayers.cleanup()
      try {
        source.disconnect()
      } catch {
        /* already disconnected */
      }
      void audioContext.close()
      resolve()
    }

    const renderFrame = () => {
      const audioT = audio.currentTime
      onProgress?.(Math.min(0.82, (audioT / audioDur) * 0.82))

      syncMvpPreviewVideoToAudio(
        video,
        audioT,
        voiceLineCues,
        segments,
        videoDur,
        audioDur,
        syncState,
        { holdOnEnd: true }
      )

      const videoT = resolveMvpPreviewVideoTime(
        video,
        audioT,
        voiceLineCues,
        segments,
        videoDur,
        audioDur,
        Boolean(audioUrl)
      )

      const showThumbnail =
        Boolean(thumbnailImg) &&
        thumbnailIntroOn &&
        isMvpThumbnailIntroTime(videoT)

      renderLayers.syncLayers(videoT, !audio.paused)

      ctx.fillStyle = "#000000"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (showThumbnail && thumbnailImg) {
        drawImageCover(ctx, thumbnailImg, canvas.width, canvas.height)
      } else if (video.readyState >= 2) {
        const clipIndex = editPlan.length ? editPlanSegmentIndexAtOutputTime(editPlan, videoT) : 0
        const sourceTransform = getMvpEditPlanClipTransform(videoSourceTransforms, clipIndex)
        if (isDefaultMvpVideoSourceTransform(sourceTransform)) {
          drawVideoContain(ctx, video, canvas.width, canvas.height)
        } else {
          drawVideoContainWithSourceTransform(
            ctx,
            video,
            canvas.width,
            canvas.height,
            sourceTransform
          )
        }
      }

      const overlayTimeSec = videoT

      for (const ov of filterOverlaysAtVideoTime(placedOverlays, overlayTimeSec, videoDur)) {
        drawOverlay(ctx, ov, canvas.width, canvas.height, MVP_PREVIEW_STAGE_WIDTH_PX, video)
      }

      const subText = resolveSubtitleText(
        audioT,
        videoT,
        showThumbnail,
        voiceLineCues,
        true,
        lineSchedule
      )
      drawSubtitle(ctx, subText, subtitleStyle, canvas.width, canvas.height, MVP_PREVIEW_STAGE_WIDTH_PX)

      if (!audio.paused && audioT < audioDur - 0.03) {
        requestAnimationFrame(renderFrame)
      } else {
        finish()
      }
    }

    audio.onended = () => finish()
    renderFrame()
  })

  const recorded = await blobPromise

  if (ext === "mp4" || recorded.type.includes("mp4")) {
    onProgress?.(1)
    return { blob: recorded, ext: "mp4" }
  }

  onProgress?.(0.84)
  const mp4 = await convertWebmBlobToMp4(recorded, (ratio) => {
    onProgress?.(0.84 + ratio * 0.16)
  })
  onProgress?.(1)
  return { blob: mp4, ext: "mp4" }
}

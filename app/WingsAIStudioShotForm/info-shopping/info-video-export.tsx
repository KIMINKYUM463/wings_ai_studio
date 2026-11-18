"use client"

/**
 * 카드뉴스 영상 내보내기.
 * 녹화 전에 카드 상태(슬라이드 × 공개 줄 수)를 전부 미리 캡처해 두고,
 * 녹화 중에는 캔버스 합성(스와이프 전환·줄 페이드·제품 컷 켄번즈)만 해서 끊김 없이 30fps를 유지한다.
 * 음성·효과음·배경음은 오디오 시계에 미리 예약해 화면과 정확히 맞춘다.
 */

import { createRoot, type Root } from "react-dom/client"
import {
  finalizeRecordedVideo,
  pickVideoRecorderMime,
  recorderContainerMime,
} from "@/lib/shotform-recorder-format"
import { startRenderTicker } from "@/lib/shotform-render-ticker"
import { bgmGainFromVolumePct } from "@/lib/shotform-factory-voice-preview-bgm"
import { getInfoSlideDisplayLines, InfoCardFrame } from "./InfoCardFrame"
import { makePopBuffer } from "./info-line-sfx"
import { INFO_TTS_CHAIN_TAIL_SKIP_SEC } from "./info-tts-audio"
import type { InfoSlide, InfoThemeId, InfoVoiceTrack } from "./info-types"

export const INFO_EXPORT_W = 1080
export const INFO_EXPORT_H = 1920

const FPS = 30
/** 카드 넘김(스와이프) 길이 */
const SWIPE_SEC = 0.45
/** 새 줄이 떠오르는 길이 */
const LINE_FADE_SEC = 0.22
/** 마지막 카드를 말 끝난 뒤 유지하는 시간 */
const END_HOLD_SEC = 0.9
/** 끝부분 화면·배경음 페이드아웃 */
const END_FADE_SEC = 0.5
const POP_VOLUME = 0.16
const BGM_FADE_IN_SEC = 0.6
const BGM_FADE_OUT_SEC = 1.2
/** 오디오 예약 여유 — 녹화 시작 직후 첫 소리가 잘리지 않게 */
const START_LEAD_SEC = 0.15

type ImageRect = { x: number; y: number; w: number; h: number; radius: number }

type CapturedCard = { frame: ImageBitmap; imageRect: ImageRect | null }

/** 외부/상대 이미지를 data URL로 바꿔 html2canvas·캔버스에 안전하게 넣음 */
export async function materializeImageDataUrl(rawUrl: string): Promise<string> {
  const trimmed = rawUrl.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith("data:image/")) return trimmed
  const src = /^https?:\/\//i.test(trimmed)
    ? `/api/shotform/image-proxy?url=${encodeURIComponent(trimmed)}`
    : trimmed
  const res = await fetch(src)
  if (!res.ok) throw new Error(`이미지 로드 실패 (${res.status})`)
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("이미지 변환 실패"))
    reader.readAsDataURL(blob)
  })
}

function waitForHostImages(host: HTMLElement): Promise<void> {
  const imgs = Array.from(host.querySelectorAll("img"))
  if (!imgs.length) return Promise.resolve()
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          const done = () => resolve()
          img.addEventListener("load", done, { once: true })
          img.addEventListener("error", done, { once: true })
          window.setTimeout(done, 12_000)
        })
    )
  ).then(() => undefined)
}

export type InfoCardCaptureSession = {
  capture: (
    slide: InfoSlide,
    themeId: InfoThemeId,
    slideIndex: number,
    slideCount: number,
    revealLines: number
  ) => Promise<{ canvas: HTMLCanvasElement; imageRect: ImageRect | null }>
  dispose: () => void
}

/**
 * 미리보기와 같은 InfoCardFrame DOM을 오프스크린에 그려 html2canvas로 캡처.
 * (구 캔버스 수동 드로잉은 글자 겹침·하이라이트·제품컷 누락이 났음)
 */
export function createInfoCardCaptureSession(): InfoCardCaptureSession {
  const host = document.createElement("div")
  host.setAttribute("aria-hidden", "true")
  // 화면 안쪽에 투명 배치 — 멀리 치우면 cqw/이미지 레이아웃이 깨질 수 있음
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${INFO_EXPORT_W}px`,
    "opacity:0",
    "pointer-events:none",
    "z-index:-1",
    "overflow:hidden",
  ].join(";")
  document.body.appendChild(host)
  const root: Root = createRoot(host)
  type Html2Canvas = (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>
  let html2canvasFn: Html2Canvas | null = null

  const capture: InfoCardCaptureSession["capture"] = async (
    slide,
    themeId,
    slideIndex,
    slideCount,
    revealLines
  ) => {
    if (!html2canvasFn) {
      const mod = await import("html2canvas-pro")
      html2canvasFn = (mod.default || mod) as Html2Canvas
    }

    await new Promise<void>((resolve) => {
      root.render(
        <InfoCardFrame
          slide={slide}
          themeId={themeId}
          slideIndex={slideIndex}
          slideCount={slideCount}
          revealLineCount={revealLines}
          captureMode
          className="!max-w-none w-[1080px] rounded-none shadow-none"
        />
      )
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined)
    }
    await waitForHostImages(host)
    // 레이아웃·이미지 decode 한 프레임 더 대기
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    const card = host.querySelector("[data-info-card-capture='1']") as HTMLElement | null
    if (!card) throw new Error("내보내기용 카드 프레임을 찾지 못했습니다.")

    const imageEl = card.querySelector("[data-info-card-image='1']") as HTMLElement | null
    let imageRect: ImageRect | null = null
    if (imageEl) {
      const cardBox = card.getBoundingClientRect()
      const box = imageEl.getBoundingClientRect()
      const scale = INFO_EXPORT_W / Math.max(1, cardBox.width)
      // 1px 테두리 안쪽만 덮어 테두리선은 그대로 보이게
      imageRect = {
        x: (box.left - cardBox.left) * scale + 1,
        y: (box.top - cardBox.top) * scale + 1,
        w: box.width * scale - 2,
        h: box.height * scale - 2,
        radius: (parseFloat(getComputedStyle(imageEl).borderTopLeftRadius) || 0) * scale,
      }
    }

    const canvas = await html2canvasFn(card, {
      width: INFO_EXPORT_W,
      height: INFO_EXPORT_H,
      windowWidth: INFO_EXPORT_W,
      windowHeight: INFO_EXPORT_H,
      scale: 1,
      useCORS: true,
      allowTaint: false,
      backgroundColor: null,
      logging: false,
      imageTimeout: 15_000,
      onclone: (_doc: Document, cloned: HTMLElement) => {
        cloned.style.width = `${INFO_EXPORT_W}px`
        cloned.style.height = `${INFO_EXPORT_H}px`
        cloned.style.maxWidth = "none"
        cloned.querySelectorAll("img").forEach((img) => {
          img.classList.remove("info-card-kenburns")
          ;(img as HTMLImageElement).style.transform = "none"
        })
      },
    })
    return { canvas, imageRect }
  }

  return {
    capture,
    dispose: () => {
      try {
        root.unmount()
      } catch {
        /* ignore */
      }
      host.remove()
    },
  }
}

type RevealEvent = { time: number; slideIndex: number; reveal: number }
type VoiceClip = { time: number; url: string; playSec: number }

type InfoVideoPlan = {
  events: RevealEvent[]
  slideStarts: number[]
  voice: VoiceClip[]
  speechEndSec: number
}

/**
 * 화면 타임라인 계산. 묶음 TTS(첫 줄만 오디오)는 오디오 길이를 글자 수 비율로 나눠
 * 줄마다 공개 시각을 정한다 (미리보기 재생과 같은 규칙).
 */
async function planInfoVideo(
  slides: InfoSlide[],
  tracks: InfoVoiceTrack[],
  decode: (url: string) => Promise<AudioBuffer>
): Promise<{ plan: InfoVideoPlan; buffers: Map<string, AudioBuffer> }> {
  const events: RevealEvent[] = []
  const slideStarts: number[] = []
  const voice: VoiceClip[] = []
  const buffers = new Map<string, AudioBuffer>()
  let cursor = 0

  for (let slideIndex = 0; slideIndex < slides.length; slideIndex += 1) {
    const slide = slides[slideIndex]!
    slideStarts.push(cursor)
    const displayLines = getInfoSlideDisplayLines(slide)
    const track = tracks.find((item) => item.slideId === slide.id)
    const lineAudios = track?.lineTracks?.length
      ? track.lineTracks
      : track?.audioUrl
        ? [{ lineIndex: 0, text: displayLines[0] || "", audioUrl: track.audioUrl }]
        : []
    const steps = Math.max(displayLines.length, lineAudios.length, 1)
    const revealOf = (step: number) => Math.min(displayLines.length, step + 1)

    for (let step = 0; step < steps; ) {
      const audioUrl = lineAudios[step]?.audioUrl
      if (!audioUrl) {
        events.push({ time: cursor, slideIndex, reveal: revealOf(step) })
        cursor += Math.max(0.38, ((slide.durationSec || 4) * 0.85) / steps)
        step += 1
        continue
      }

      let end = step
      while (end + 1 < steps && !lineAudios[end + 1]?.audioUrl) end += 1
      let buffer = buffers.get(audioUrl)
      if (!buffer) {
        buffer = await decode(audioUrl)
        buffers.set(audioUrl, buffer)
      }
      const hasMoreAfter = end + 1 < steps || slideIndex < slides.length - 1
      const playSec = Math.max(
        0.12,
        buffer.duration - (hasMoreAfter ? INFO_TTS_CHAIN_TAIL_SKIP_SEC : 0)
      )
      voice.push({ time: cursor, url: audioUrl, playSec })

      const groupSteps = Array.from({ length: end - step + 1 }, (_, k) => step + k)
      const weights = groupSteps.map((s) =>
        Math.max(1, (displayLines[s] || "").replace(/\s/g, "").length)
      )
      const weightSum = weights.reduce((a, b) => a + b, 0) || groupSteps.length
      let acc = 0
      groupSteps.forEach((s, gi) => {
        events.push({ time: cursor + (acc / weightSum) * playSec, slideIndex, reveal: revealOf(s) })
        acc += weights[gi]!
      })
      cursor += playSec
      step = end + 1
    }
  }

  return { plan: { events, slideStarts, voice, speechEndSec: cursor }, buffers }
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)
const easeInOutCubic = (x: number) => {
  const v = Math.min(1, Math.max(0, x))
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2
}

/** 제품 컷 켄번즈 — 슬라이드마다 확대/축소·좌우 방향을 번갈아 단조로움을 피함 */
function kenBurns(slideIndex: number, p: number): { zoom: number; panX: number } {
  const e = easeInOutCubic(p)
  const zoomIn = slideIndex % 2 === 0
  const zoom = zoomIn ? 1.0 + 0.1 * e : 1.1 - 0.1 * e
  const dir = slideIndex % 4 < 2 ? 1 : -1
  return { zoom, panX: dir * (e - 0.5) * 0.04 }
}

function drawProductImage(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  rect: ImageRect,
  zoom: number,
  panX: number
) {
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, rect.radius)
  ctx.clip()
  const cover = Math.max(rect.w / image.width, rect.h / image.height) * zoom
  const dw = image.width * cover
  const dh = image.height * cover
  const maxPan = (dw - rect.w) / 2
  const dx = rect.x + (rect.w - dw) / 2 + Math.max(-maxPan, Math.min(maxPan, panX * rect.w))
  const dy = rect.y + (rect.h - dh) / 2
  ctx.drawImage(image, dx, dy, dw, dh)
  // 카드 프레임의 하단 그림자(from-black/35)와 동일
  const shade = ctx.createLinearGradient(0, rect.y + rect.h * 0.7, 0, rect.y + rect.h)
  shade.addColorStop(0, "rgba(0,0,0,0)")
  shade.addColorStop(1, "rgba(0,0,0,0.35)")
  ctx.fillStyle = shade
  ctx.fillRect(rect.x, rect.y + rect.h * 0.7, rect.w, rect.h * 0.3)
  ctx.restore()
}

export type InfoVideoBgm = { src: string; volumePct: number }

export async function renderInfoVideo(opts: {
  slides: InfoSlide[]
  tracks: InfoVoiceTrack[]
  themeId: InfoThemeId
  /** false면 나레이션·효과음 없이 화면(+배경음)만 */
  withVoice: boolean
  bgm: InfoVideoBgm | null
  onStage?: (label: string) => void
}): Promise<{ blob: Blob; extension: "mp4" | "webm"; durationSec: number }> {
  const { slides, tracks, themeId, withVoice, bgm, onStage } = opts
  if (!slides.length) throw new Error("카드가 없습니다.")

  const audioCtx = new AudioContext()
  const captured = new Map<string, CapturedCard>()
  const productImages = new Map<number, ImageBitmap>()
  const session = createInfoCardCaptureSession()
  let stopTicker: (() => void) | null = null

  try {
    onStage?.("음성 타이밍 계산 중…")
    const decode = async (url: string) =>
      audioCtx.decodeAudioData((await (await fetch(url)).arrayBuffer()).slice(0))
    const { plan, buffers } = await planInfoVideo(slides, tracks, decode)
    const durationSec = plan.speechEndSec + END_HOLD_SEC

    // 외부 이미지를 data URL로 고정 → CORS/프록시 실패로 제품컷이 비는 문제 방지
    onStage?.("제품 컷 준비 중…")
    const exportSlides = await Promise.all(
      slides.map(async (slide, index) => {
        if (!slide.imageUrl) return slide
        const dataUrl = await materializeImageDataUrl(slide.imageUrl).catch(() => slide.imageUrl!)
        try {
          productImages.set(index, await createImageBitmap(await (await fetch(dataUrl)).blob()))
        } catch {
          /* 움직임 없이 캡처된 정지 컷으로 대체 */
        }
        return { ...slide, imageUrl: dataUrl }
      })
    )

    const stateKey = (slideIndex: number, reveal: number) => `${slideIndex}:${reveal}`
    const states = [...new Set(plan.events.map((e) => stateKey(e.slideIndex, e.reveal)))]
    for (let i = 0; i < states.length; i += 1) {
      onStage?.(`카드 프레임 준비 중… ${i + 1}/${states.length}`)
      const [slideIndex, reveal] = states[i]!.split(":").map(Number) as [number, number]
      const { canvas, imageRect } = await session.capture(
        exportSlides[slideIndex]!,
        themeId,
        slideIndex,
        exportSlides.length,
        reveal
      )
      captured.set(states[i]!, { frame: await createImageBitmap(canvas), imageRect })
    }

    const canvas = document.createElement("canvas")
    canvas.width = INFO_EXPORT_W
    canvas.height = INFO_EXPORT_H
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("캔버스를 사용할 수 없습니다.")

    const slideEnd = (slideIndex: number) => plan.slideStarts[slideIndex + 1] ?? durationSec

    const drawCard = (state: CapturedCard, slideIndex: number, t: number, alpha = 1) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.drawImage(state.frame, 0, 0, INFO_EXPORT_W, INFO_EXPORT_H)
      const image = productImages.get(slideIndex)
      if (image && state.imageRect) {
        const start = plan.slideStarts[slideIndex]!
        const p = (t - start) / Math.max(0.1, slideEnd(slideIndex) - start)
        const { zoom, panX } = kenBurns(slideIndex, p)
        drawProductImage(ctx, image, state.imageRect, zoom, panX)
      }
      ctx.restore()
    }

    /** 이 슬라이드에서 시각 t에 보이는 카드 (+ 줄 페이드 중이면 직전 상태) */
    const drawSlideAt = (slideIndex: number, t: number) => {
      let current = -1
      for (let i = 0; i < plan.events.length; i += 1) {
        const event = plan.events[i]!
        if (event.slideIndex !== slideIndex) continue
        if (event.time <= t || current === -1) current = i
        if (event.time > t) break
      }
      const event = plan.events[current]!
      const state = captured.get(stateKey(slideIndex, event.reveal))!
      const prev = plan.events[current - 1]
      const fade = (t - event.time) / LINE_FADE_SEC
      if (prev && prev.slideIndex === slideIndex && fade < 1) {
        drawCard(captured.get(stateKey(slideIndex, prev.reveal))!, slideIndex, t)
        drawCard(state, slideIndex, t, easeOutCubic(fade))
      } else {
        drawCard(state, slideIndex, t)
      }
    }

    const drawFrame = (t: number) => {
      let slideIndex = 0
      while (slideIndex + 1 < plan.slideStarts.length && plan.slideStarts[slideIndex + 1]! <= t) {
        slideIndex += 1
      }
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, INFO_EXPORT_W, INFO_EXPORT_H)

      const sinceStart = t - plan.slideStarts[slideIndex]!
      if (slideIndex > 0 && sinceStart < SWIPE_SEC) {
        // 카드 넘기기 — 이전 카드는 왼쪽으로 밀려나며 어두워지고, 새 카드가 오른쪽에서 들어옴
        const e = easeInOutCubic(sinceStart / SWIPE_SEC)
        ctx.save()
        ctx.translate(-INFO_EXPORT_W * 0.35 * e, 0)
        drawSlideAt(slideIndex - 1, t)
        ctx.fillStyle = `rgba(0,0,0,${0.45 * e})`
        ctx.fillRect(0, 0, INFO_EXPORT_W, INFO_EXPORT_H)
        ctx.restore()
        ctx.save()
        ctx.translate(INFO_EXPORT_W * (1 - e), 0)
        drawSlideAt(slideIndex, t)
        ctx.restore()
      } else {
        drawSlideAt(slideIndex, t)
      }

      const fadeOut = (t - (durationSec - END_FADE_SEC)) / END_FADE_SEC
      if (fadeOut > 0) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fadeOut) * 0.85})`
        ctx.fillRect(0, 0, INFO_EXPORT_W, INFO_EXPORT_H)
      }
    }

    const stream = canvas.captureStream(FPS)
    const hasAudio = withVoice || Boolean(bgm)
    const dest = audioCtx.createMediaStreamDestination()
    if (hasAudio) dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track))

    const mimeType = pickVideoRecorderMime(hasAudio)
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 192_000,
    })
    const containerMime = recorderContainerMime(recorder, mimeType)
    const chunks: BlobPart[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data)
    }
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })

    let bgmBuffer: AudioBuffer | null = null
    if (bgm) {
      onStage?.("배경음 준비 중…")
      bgmBuffer = await decode(bgm.src)
    }

    await audioCtx.resume()
    drawFrame(0)
    onStage?.("녹화 중…")
    recorder.start(250)
    const t0 = audioCtx.currentTime + START_LEAD_SEC

    if (withVoice) {
      for (const clip of plan.voice) {
        const source = audioCtx.createBufferSource()
        source.buffer = buffers.get(clip.url)!
        source.connect(dest)
        source.start(t0 + clip.time, 0, clip.playSec)
      }
      const pop = makePopBuffer(audioCtx)
      for (const event of plan.events) {
        const source = audioCtx.createBufferSource()
        const gain = audioCtx.createGain()
        source.buffer = pop
        gain.gain.value = POP_VOLUME
        source.connect(gain).connect(dest)
        source.start(t0 + event.time)
      }
    }
    if (bgmBuffer && bgm) {
      const source = audioCtx.createBufferSource()
      const gain = audioCtx.createGain()
      const level = bgmGainFromVolumePct(bgm.volumePct)
      source.buffer = bgmBuffer
      source.loop = true
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(level, t0 + BGM_FADE_IN_SEC)
      gain.gain.setValueAtTime(level, t0 + durationSec - BGM_FADE_OUT_SEC)
      gain.gain.linearRampToValueAtTime(0, t0 + durationSec)
      source.connect(gain).connect(dest)
      source.start(t0)
      source.stop(t0 + durationSec + 0.05)
    }

    await new Promise<void>((resolve) => {
      // 탭이 가려져도 끊기지 않게 Worker 타이머로 그림 (rAF는 백그라운드에서 멈춤)
      stopTicker = startRenderTicker(() => {
        const t = audioCtx.currentTime - t0
        if (t >= durationSec) {
          stopTicker?.()
          stopTicker = null
          resolve()
          return
        }
        drawFrame(Math.max(0, t))
        onStage?.(`녹화 중… ${Math.round((Math.max(0, t) / durationSec) * 100)}%`)
      }, FPS)
    })

    recorder.stop()
    await stopped
    stream.getTracks().forEach((track) => track.stop())
    const { blob, extension } = await finalizeRecordedVideo(chunks, containerMime, durationSec)
    return { blob, extension, durationSec }
  } finally {
    ;(stopTicker as (() => void) | null)?.()
    session.dispose()
    captured.forEach((state) => state.frame.close())
    productImages.forEach((image) => image.close())
    void audioCtx.close().catch(() => undefined)
  }
}

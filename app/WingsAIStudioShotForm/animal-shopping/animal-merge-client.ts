/** 클라이언트 전용 — 클립을 순차 녹화해 하나로 합침 (+ 선택 TTS 믹스) */

import {
  finalizeRecordedVideo,
  pickVideoRecorderMime,
  recorderContainerMime,
} from "@/lib/shotform-recorder-format"

export type AnimalMergeResult = {
  url: string
  blob: Blob
  durationSec: number
  hasAudio: boolean
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

async function loadVideo(url: string, index: number): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    // data:/blob: 에는 crossOrigin이 오히려 깨질 수 있음
    if (/^https?:\/\//i.test(url)) {
      video.crossOrigin = "anonymous"
    }
    video.preload = "auto"
    video.muted = true
    video.playsInline = true
    video.src = url
    video.onloadedmetadata = () => resolve(video)
    video.onerror = () =>
      reject(new Error(`영상 ${index + 1} 로드 실패 (URL이 만료됐을 수 있습니다)`))
  })
}

async function decodeTtsBuffer(
  audioContext: AudioContext,
  ttsAudioUrl: string
): Promise<AudioBuffer> {
  const res = await fetch(ttsAudioUrl)
  if (!res.ok) {
    throw new Error("TTS 오디오를 불러오지 못했습니다. 음성 단계에서 다시 생성해주세요.")
  }
  const arr = await res.arrayBuffer()
  if (arr.byteLength < 32) {
    throw new Error("TTS 오디오가 비어 있습니다. 음성 단계에서 다시 생성해주세요.")
  }
  try {
    return await audioContext.decodeAudioData(arr.slice(0))
  } catch {
    throw new Error(
      "TTS 오디오를 해석하지 못했습니다. 음성 단계에서 나레이션을 다시 생성해주세요."
    )
  }
}

const OUTPUT_WIDTH = 720
const OUTPUT_HEIGHT = 1280
const CROSSFADE_SEC = 0.2

function isPositiveSec(value: number | undefined | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

/** 비율이 다른 클립도 늘리지 않고 9:16을 꽉 채우도록 가운데 기준으로 잘라 그립니다. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number
) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return
  const scale = Math.max(width / vw, height / vh)
  const dw = vw * scale
  const dh = vh * scale
  ctx.drawImage(video, (width - dw) / 2, (height - dh) / 2, dw, dh)
}

/**
 * 영상 클립을 이어 붙이고, ttsAudioUrl이 있으면 같은 타임라인에 녹음합니다.
 * clipDurationsSec(씬별 TTS 길이)를 주면 각 클립을 그 길이만큼만 보여줘
 * 이어 붙인 씬 TTS와 화면 전환이 정확히 맞습니다. 클립이 더 짧으면 마지막 프레임을 유지합니다.
 */
export async function mergeAnimalVideosClient(
  videoUrls: string[],
  ttsAudioUrl?: string,
  opts?: { clipDurationsSec?: Array<number | undefined> }
): Promise<AnimalMergeResult> {
  const urls = videoUrls.filter(Boolean)
  if (urls.length === 0) throw new Error("합칠 영상이 없습니다.")

  const videos = await Promise.all(urls.map((url, index) => loadVideo(url, index)))
  const clipDurations = videos.map((video, i) => {
    const target = opts?.clipDurationsSec?.[i]
    if (isPositiveSec(target)) return target
    return isPositiveSec(video.duration) ? video.duration : 3
  })
  const clipStarts: number[] = []
  const videoDurationSec = clipDurations.reduce((sum, d) => {
    clipStarts.push(sum)
    return sum + d
  }, 0)

  const width = OUTPUT_WIDTH
  const height = OUTPUT_HEIGHT
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 컨텍스트를 가져올 수 없습니다.")

  const canvasStream = canvas.captureStream(30)
  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()]

  let audioContext: AudioContext | null = null
  let audioBuffer: AudioBuffer | null = null
  let audioDest: MediaStreamAudioDestinationNode | null = null
  let bufferSource: AudioBufferSourceNode | null = null
  let keepAlive: OscillatorNode | null = null
  let hasAudio = false

  if (ttsAudioUrl?.trim()) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    audioContext = new AudioCtx()
    if (audioContext.state === "suspended") {
      await audioContext.resume()
    }
    audioBuffer = await decodeTtsBuffer(audioContext, ttsAudioUrl)
    audioDest = audioContext.createMediaStreamDestination()

    // 트랙이 녹음 전에 끊기지 않도록 무음 유지
    keepAlive = audioContext.createOscillator()
    const keepGain = audioContext.createGain()
    keepGain.gain.value = 0.00001
    keepAlive.connect(keepGain)
    keepGain.connect(audioDest)
    keepAlive.start()

    const audioTrack = audioDest.stream.getAudioTracks()[0]
    if (audioTrack) {
      tracks.push(audioTrack)
      hasAudio = true
    }
  }

  const stream = new MediaStream(tracks)
  const mimeType = pickVideoRecorderMime(hasAudio)
  const recorderOpts: MediaRecorderOptions = {
    mimeType,
    videoBitsPerSecond: 4_000_000,
  }
  if (hasAudio) {
    recorderOpts.audioBitsPerSecond = 192_000
  }

  let mediaRecorder: MediaRecorder
  try {
    mediaRecorder = new MediaRecorder(stream, recorderOpts)
  } catch {
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: pickVideoRecorderMime(false),
      videoBitsPerSecond: 4_000_000,
    })
  }

  const chunks: BlobPart[] = []
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const recordedMime = recorderContainerMime(mediaRecorder, mimeType)

  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      try {
        stream.getTracks().forEach((t) => t.stop())
      } catch {
        /* ignore */
      }
      try {
        bufferSource?.stop()
      } catch {
        /* ignore */
      }
      try {
        keepAlive?.stop()
      } catch {
        /* ignore */
      }
      void audioContext?.close().catch(() => undefined)
    }

    const finishError = (error: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error instanceof Error ? error : new Error(String(error)))
    }

    mediaRecorder.onstop = () => {
      if (settled) return
      settled = true
      void (async () => {
        try {
          if (new Blob(chunks).size < 64) {
            cleanup()
            reject(new Error("합쳐진 영상이 비어 있습니다. 다시 이어 붙여 주세요."))
            return
          }

          const durationSec = Math.max(
            1,
            videoDurationSec,
            audioBuffer?.duration || 0
          )
          const { blob } = await finalizeRecordedVideo(chunks, recordedMime, durationSec)

          cleanup()
          resolve({
            url: URL.createObjectURL(blob),
            blob,
            durationSec,
            hasAudio,
          })
        } catch (error) {
          cleanup()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      })()
    }
    mediaRecorder.onerror = () =>
      finishError(new Error("영상 녹화 중 오류가 발생했습니다."))

    // TTS가 클립 합계보다 길면 마지막 프레임을 유지한 채 남은 음성까지 녹화
    const totalSec = Math.max(videoDurationSec, audioBuffer?.duration || 0) + 0.15
    let index = -1
    let raf = 0
    let startedAt = 0

    const clipIndexAt = (t: number) => {
      let i = 0
      while (i + 1 < clipStarts.length && t >= clipStarts[i + 1]!) i++
      return i
    }

    const switchTo = (next: number) => {
      videos[index]?.pause()
      index = next
      const video = videos[next]!
      try {
        video.currentTime = 0
      } catch {
        /* ignore */
      }
      void video.play().catch(() => undefined)
    }

    const draw = () => {
      const t = (performance.now() - startedAt) / 1000
      if (t >= totalSec) {
        videos[index]?.pause()
        if (mediaRecorder.state === "recording") mediaRecorder.stop()
        return
      }
      const want = clipIndexAt(t)
      if (want !== index) switchTo(want)

      const current = videos[index]!
      const previous = index > 0 ? videos[index - 1] : undefined
      const fade = previous ? Math.min(1, (t - clipStarts[index]!) / CROSSFADE_SEC) : 1
      if (fade < 1 && previous && previous.readyState >= 2) {
        ctx.globalAlpha = 1
        drawCover(ctx, previous, width, height)
      }
      if (current.readyState >= 2) {
        ctx.globalAlpha = fade
        drawCover(ctx, current, width, height)
        ctx.globalAlpha = 1
      }
      raf = requestAnimationFrame(draw)
    }

    const startTts = () => {
      if (!audioContext || !audioBuffer || !audioDest) return
      bufferSource = audioContext.createBufferSource()
      bufferSource.buffer = audioBuffer
      // 스피커로는 내지 않음 — 파일에만 들어가게 (미리듣기와 파일 불일치 방지)
      bufferSource.connect(audioDest)
      bufferSource.start(0)
    }

    void (async () => {
      try {
        ctx.fillStyle = "#000"
        ctx.fillRect(0, 0, width, height)
        // 첫 프레임이 준비된 뒤 녹화를 시작해야 앞부분이 검게 나오지 않음
        await videos[0]!.play()
        videos[0]!.pause()
        videos[0]!.currentTime = 0
        await wait(60)
        mediaRecorder.start(250)
        startTts()
        startedAt = performance.now()
        draw()
      } catch (error) {
        cancelAnimationFrame(raf)
        finishError(error)
      }
    })()
  })
}

export function isLikelyPlayableMediaUrl(url?: string | null): boolean {
  if (!url?.trim()) return false
  if (url.startsWith("blob:") || url.startsWith("data:")) return true
  if (/^https?:\/\//i.test(url)) return true
  return false
}

/** blob: 은 세션 안에서는 살아 있을 수 있음 — fetch로 한 번 확인 */
export async function isReachableMediaUrl(url?: string | null): Promise<boolean> {
  if (!url?.trim()) return false
  if (url.startsWith("data:")) return url.length > 32
  if (/^https?:\/\//i.test(url)) return true
  if (!url.startsWith("blob:")) return false
  try {
    const res = await fetch(url)
    if (!res.ok) return false
    const blob = await res.blob()
    return blob.size > 0
  } catch {
    return false
  }
}

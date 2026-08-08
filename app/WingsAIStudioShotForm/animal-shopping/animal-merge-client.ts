/** 클라이언트 전용 — 클립을 순차 녹화해 하나로 합침 (+ 선택 TTS 믹스) */

import { fixWebmBlobDuration } from "@/lib/mvp-webm-to-mp4"

export type AnimalMergeResult = {
  url: string
  blob: Blob
  durationSec: number
  hasAudio: boolean
}

function pickRecorderMime(hasAudio: boolean): string {
  const withAudio = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ]
  const videoOnly = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ]
  const candidates = hasAudio ? withAudio : videoOnly
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

/**
 * 영상 클립을 이어 붙이고, ttsAudioUrl이 있으면 같은 타임라인에 녹음합니다.
 * HTMLAudioElement 경로 대신 decodeAudioData + AudioBufferSourceNode를 써서
 * MediaRecorder에 실제 오디오 트랙이 들어가게 합니다.
 */
export async function mergeAnimalVideosClient(
  videoUrls: string[],
  ttsAudioUrl?: string
): Promise<AnimalMergeResult> {
  const urls = videoUrls.filter(Boolean)
  if (urls.length === 0) throw new Error("합칠 영상이 없습니다.")

  const videos = await Promise.all(urls.map((url, index) => loadVideo(url, index)))
  const videoDurationSec = videos.reduce((sum, video) => {
    const d = video.duration
    return sum + (Number.isFinite(d) && d > 0 ? d : 0)
  }, 0)

  const width = videos[0]!.videoWidth || 540
  const height = videos[0]!.videoHeight || 960
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
  const mimeType = pickRecorderMime(hasAudio)
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
      mimeType: pickRecorderMime(false),
      videoBitsPerSecond: 4_000_000,
    })
  }

  const chunks: BlobPart[] = []
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const recordedMime = mediaRecorder.mimeType || mimeType || "video/webm"

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
          let blob = new Blob(chunks, { type: recordedMime })
          if (blob.size < 64) {
            cleanup()
            reject(new Error("합쳐진 영상이 비어 있습니다. 다시 이어 붙여 주세요."))
            return
          }

          const durationSec = Math.max(
            1,
            videoDurationSec,
            audioBuffer?.duration || 0
          )

          try {
            blob = await fixWebmBlobDuration(blob, durationSec)
          } catch {
            /* Windows 속성창용 보정 실패해도 재생은 가능 */
          }

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

    mediaRecorder.start(250)

    let index = 0
    let raf = 0
    let ttsStarted = false
    const recordStartedAt = performance.now()

    const draw = () => {
      const video = videos[index]
      if (video && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, width, height)
      }
      raf = requestAnimationFrame(draw)
    }

    const startTts = () => {
      if (!audioContext || !audioBuffer || !audioDest || ttsStarted) return
      ttsStarted = true
      bufferSource = audioContext.createBufferSource()
      bufferSource.buffer = audioBuffer
      bufferSource.connect(audioDest)
      // 스피커로는 내지 않음 — 파일에만 들어가게 (미리듣기와 파일 불일치 방지)
      try {
        bufferSource.start(0)
      } catch (error) {
        finishError(error)
      }
    }

    const playNext = async () => {
      if (index >= videos.length) {
        cancelAnimationFrame(raf)
        // TTS가 영상보다 길면 남은 분량까지 녹음
        if (audioBuffer && ttsStarted) {
          const elapsed = (performance.now() - recordStartedAt) / 1000
          const remain = Math.max(0, audioBuffer.duration - elapsed)
          if (remain > 0.05) {
            await wait(Math.min(remain * 1000 + 300, 12000))
          }
        } else {
          await wait(300)
        }
        if (mediaRecorder.state === "recording") mediaRecorder.stop()
        return
      }

      const video = videos[index]!
      video.currentTime = 0
      const onEnded = () => {
        video.removeEventListener("ended", onEnded)
        index += 1
        void playNext()
      }
      video.addEventListener("ended", onEnded)

      try {
        startTts()
        await video.play()
      } catch (error) {
        video.removeEventListener("ended", onEnded)
        finishError(error)
      }
    }

    draw()
    void playNext()
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

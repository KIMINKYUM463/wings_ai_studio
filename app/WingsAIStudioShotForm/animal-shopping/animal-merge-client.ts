/** 클라이언트 전용 — 클립을 순차 녹화해 하나로 합침 (+ 선택 TTS 믹스) */

function pickRecorderMime(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
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

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

async function loadVideo(url: string, index: number): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.preload = "auto"
    video.muted = true
    video.playsInline = true
    video.src = url
    video.onloadedmetadata = () => resolve(video)
    video.onerror = () =>
      reject(new Error(`영상 ${index + 1} 로드 실패 (URL이 만료됐을 수 있습니다)`))
  })
}

/**
 * 영상 클립을 이어 붙이고, ttsAudioUrl이 있으면 같은 타임라인에 녹음합니다.
 * → 미리보기·다운로드 모두 TTS가 들어간 webm을 받을 수 있습니다.
 */
export async function mergeAnimalVideosClient(
  videoUrls: string[],
  ttsAudioUrl?: string
): Promise<string> {
  const urls = videoUrls.filter(Boolean)
  if (urls.length === 0) throw new Error("합칠 영상이 없습니다.")

  // TTS 없이 클립 1개면 그대로 써도 되지만, 다운로드에 음성이 필요하면 재녹화
  if (urls.length === 1 && !ttsAudioUrl?.trim()) {
    return urls[0]!
  }

  const videos = await Promise.all(urls.map((url, index) => loadVideo(url, index)))
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
  let ttsAudio: HTMLAudioElement | null = null

  if (ttsAudioUrl?.trim()) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    audioContext = new AudioCtx()
    if (audioContext.state === "suspended") {
      await audioContext.resume()
    }
    ttsAudio = document.createElement("audio")
    ttsAudio.crossOrigin = "anonymous"
    ttsAudio.preload = "auto"
    ttsAudio.src = ttsAudioUrl
    await new Promise<void>((resolve, reject) => {
      ttsAudio!.oncanplaythrough = () => resolve()
      ttsAudio!.onloadeddata = () => resolve()
      ttsAudio!.onerror = () =>
        reject(new Error("TTS 오디오를 불러오지 못했습니다. 음성 단계에서 다시 생성해주세요."))
      window.setTimeout(() => resolve(), 4000)
    })
    const source = audioContext.createMediaElementSource(ttsAudio)
    const dest = audioContext.createMediaStreamDestination()
    source.connect(dest)
    // 스피커로도 들리게 (미리보기 중 합칠 때)
    source.connect(audioContext.destination)
    const audioTrack = dest.stream.getAudioTracks()[0]
    if (audioTrack) tracks.push(audioTrack)
  }

  const stream = new MediaStream(tracks)
  const mimeType = pickRecorderMime()
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
    audioBitsPerSecond: 192_000,
  })
  const chunks: BlobPart[] = []
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const finishError = (error: unknown) => {
      if (settled) return
      settled = true
      try {
        stream.getTracks().forEach((t) => t.stop())
      } catch {
        /* ignore */
      }
      void audioContext?.close().catch(() => undefined)
      reject(error instanceof Error ? error : new Error(String(error)))
    }

    mediaRecorder.onstop = () => {
      if (settled) return
      settled = true
      try {
        stream.getTracks().forEach((t) => t.stop())
      } catch {
        /* ignore */
      }
      void audioContext?.close().catch(() => undefined)
      const blob = new Blob(chunks, { type: mimeType || "video/webm" })
      if (blob.size < 64) {
        reject(new Error("합쳐진 영상이 비어 있습니다. 다시 이어 붙여 주세요."))
        return
      }
      resolve(URL.createObjectURL(blob))
    }
    mediaRecorder.onerror = () => finishError(new Error("영상 녹화 중 오류가 발생했습니다."))

    mediaRecorder.start(100)

    let index = 0
    let raf = 0
    let ttsStarted = false

    const draw = () => {
      const video = videos[index]
      if (video && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, width, height)
      }
      raf = requestAnimationFrame(draw)
    }

    const playNext = async () => {
      if (index >= videos.length) {
        cancelAnimationFrame(raf)
        // TTS가 더 길면 잠깐 더 녹음
        if (ttsAudio && !ttsAudio.ended && Number.isFinite(ttsAudio.duration)) {
          const remain = Math.max(0, ttsAudio.duration - ttsAudio.currentTime)
          if (remain > 0.05) {
            await wait(Math.min(remain * 1000 + 200, 8000))
          }
        } else {
          await wait(250)
        }
        try {
          ttsAudio?.pause()
        } catch {
          /* ignore */
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
        if (ttsAudio && !ttsStarted) {
          ttsAudio.currentTime = 0
          await ttsAudio.play()
          ttsStarted = true
        }
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

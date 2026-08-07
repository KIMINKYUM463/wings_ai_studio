/** 클라이언트 전용 — 클립을 순차 녹화해 하나로 합침 */

export async function mergeAnimalVideosClient(videoUrls: string[]): Promise<string> {
  if (videoUrls.length === 0) throw new Error("합칠 영상이 없습니다.")
  if (videoUrls.length === 1) return videoUrls[0]

  const videos = await Promise.all(
    videoUrls.map(
      (url, index) =>
        new Promise<HTMLVideoElement>((resolve, reject) => {
          const video = document.createElement("video")
          video.crossOrigin = "anonymous"
          video.preload = "auto"
          video.muted = true
          video.playsInline = true
          video.src = url
          video.onloadedmetadata = () => resolve(video)
          video.onerror = () => reject(new Error(`영상 ${index + 1} 로드 실패`))
        })
    )
  )

  const width = videos[0].videoWidth || 540
  const height = videos[0].videoHeight || 960
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 컨텍스트를 가져올 수 없습니다.")

  const stream = canvas.captureStream(30)
  let mimeType = "video/webm;codecs=vp9"
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "video/mp4"
  }

  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2_500_000,
  })
  const chunks: Blob[] = []
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      stream.getTracks().forEach((t) => t.stop())
      resolve(URL.createObjectURL(blob))
    }
    mediaRecorder.onerror = () => {
      stream.getTracks().forEach((t) => t.stop())
      reject(new Error("영상 녹화 중 오류가 발생했습니다."))
    }

    mediaRecorder.start(100)

    let index = 0
    let raf = 0

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
        setTimeout(() => mediaRecorder.stop(), 200)
        return
      }
      const video = videos[index]
      video.currentTime = 0
      const onEnded = () => {
        video.removeEventListener("ended", onEnded)
        index += 1
        void playNext()
      }
      video.addEventListener("ended", onEnded)
      try {
        await video.play()
      } catch (error) {
        video.removeEventListener("ended", onEnded)
        reject(error instanceof Error ? error : new Error("영상 재생 실패"))
      }
    }

    draw()
    void playNext()
  })
}

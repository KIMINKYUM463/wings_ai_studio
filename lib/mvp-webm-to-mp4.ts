import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

let ffmpegInstance: FFmpeg | null = null
let ffmpegLoadPromise: Promise<FFmpeg> | null = null

async function loadFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const ffmpeg = new FFmpeg()
      const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm"
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      })
      ffmpegInstance = ffmpeg
      return ffmpeg
    })()
  }
  return ffmpegLoadPromise
}

/** 브라우저 MediaRecorder WebM → MP4 (H.264 + AAC) */
export async function convertWebmBlobToMp4(
  webm: Blob,
  onProgress?: (ratio: number) => void
): Promise<Blob> {
  const ffmpeg = await loadFfmpeg()
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const inName = `mvp_in_${stamp}.webm`
  const outName = `mvp_out_${stamp}.mp4`

  const progressHandler = ({ progress }: { progress: number }) => {
    const ratio = progress > 1 ? progress / 100 : progress
    onProgress?.(Math.min(1, Math.max(0, ratio)))
  }

  ffmpeg.on("progress", progressHandler)
  try {
    await ffmpeg.writeFile(inName, await fetchFile(webm))
    await ffmpeg.exec([
      "-i",
      inName,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      outName,
    ])
    const data = await ffmpeg.readFile(outName)
    const bytes =
      data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    return new Blob([copy], { type: "video/mp4" })
  } finally {
    ffmpeg.off("progress", progressHandler)
    await ffmpeg.deleteFile(inName).catch(() => {})
    await ffmpeg.deleteFile(outName).catch(() => {})
  }
}

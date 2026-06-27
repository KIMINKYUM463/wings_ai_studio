import { FFmpeg } from "@ffmpeg/ffmpeg"
import { THUMBNAIL_EXPORT_H, THUMBNAIL_EXPORT_W } from "@/lib/mvp-thumbnail-design"

let ffmpegInstance: FFmpeg | null = null
let ffmpegLoadPromise: Promise<FFmpeg> | null = null

/** blob URL(toBlobURL)은 Next.js worker에서 import 오류 — CDN 직접 URL (WebM→MP4 변환용) */
const FFMPEG_CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm"

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function wrapFfmpegLoadError(e: unknown): Error {
  if (e instanceof TypeError && /failed to fetch/i.test(e.message)) {
    return new Error(
      "ffmpeg.wasm CDN 로드 실패(Failed to fetch). 네트워크·방화벽을 확인하거나 「썸네일 맨 앞 표시」를 끄고 다시 시도해 주세요."
    )
  }
  if (e instanceof Error) return e
  return new Error("ffmpeg.wasm 로드 실패")
}

async function loadFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      try {
        const ffmpeg = new FFmpeg()
        await ffmpeg.load({
          coreURL: `${FFMPEG_CORE_BASE}/ffmpeg-core.js`,
          wasmURL: `${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`,
        })
        ffmpegInstance = ffmpeg
        return ffmpeg
      } catch (e) {
        ffmpegLoadPromise = null
        throw wrapFfmpegLoadError(e)
      }
    })()
  }
  return ffmpegLoadPromise
}

function bytesToMp4Blob(data: Uint8Array | string): Blob {
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy], { type: "video/mp4" })
}

async function runFfmpeg(
  ffmpeg: FFmpeg,
  args: string[],
  failLabel: string
): Promise<void> {
  const logs: string[] = []
  const logHandler = ({ message }: { message: string }) => {
    logs.push(message)
  }
  ffmpeg.on("log", logHandler)
  try {
    const code = await ffmpeg.exec(args)
    if (typeof code === "number" && code !== 0) {
      const tail = logs.slice(-10).join("\n").trim()
      throw new Error(
        `${failLabel} (ffmpeg exit ${code})${tail ? `\n${tail}` : ""}`
      )
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes(failLabel)) throw e
    const tail = logs.slice(-10).join("\n").trim()
    throw new Error(
      `${failLabel}${e instanceof Error ? `: ${e.message}` : ""}${tail ? `\n${tail}` : ""}`
    )
  } finally {
    ffmpeg.off("log", logHandler)
  }
}

/** 이미 로드된 img — 1080×1920 PNG (렌더용 고화질) */
export async function mvpThumbnailImageToPngDataUrl(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas")
  canvas.width = THUMBNAIL_EXPORT_W
  canvas.height = THUMBNAIL_EXPORT_H
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("썸네일 변환 실패")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/png")
}

/** 이미 로드된 img — fetch/CORS 실패 시 썸네일 PNG 바이트 폴백 */
export async function mvpThumbnailImageToPngBytes(img: HTMLImageElement): Promise<Uint8Array> {
  const dataUrl = await mvpThumbnailImageToPngDataUrl(img)
  const res = await fetch(dataUrl)
  return new Uint8Array(await res.arrayBuffer())
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
    await ffmpeg.writeFile(inName, await blobToBytes(webm))
    await runFfmpeg(
      ffmpeg,
      [
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
      ],
      "WebM→MP4 변환 실패"
    )
    const data = await ffmpeg.readFile(outName)
    return bytesToMp4Blob(data)
  } finally {
    ffmpeg.off("progress", progressHandler)
    await ffmpeg.deleteFile(inName).catch(() => {})
    await ffmpeg.deleteFile(outName).catch(() => {})
  }
}

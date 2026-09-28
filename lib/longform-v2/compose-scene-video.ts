/** 정지 이미지 + TTS 오디오 → MP4 (ffmpeg) */

import { spawnSync } from "child_process"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { randomUUID } from "crypto"
import {
  assertFfmpegExecutable,
  hasFfmpeg,
  resolveFfmpegPath,
} from "@/lib/ffmpeg-binaries"

const RENDER_W = 1920
const RENDER_H = 1080

function runFfmpeg(args: string[], label: string): void {
  const bin = resolveFfmpegPath()
  const r = spawnSync(bin, args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.error) throw r.error
  if (r.status !== 0) {
    const detail = `${r.stderr || ""}${r.stdout || ""}`.trim().slice(-1200)
    throw new Error(`${label}${detail ? `: ${detail}` : ""}`)
  }
}

function extFromMimeOrUrl(mimeOrUrl: string, fallback: string): string {
  const s = mimeOrUrl.toLowerCase()
  if (s.includes("png")) return ".png"
  if (s.includes("webp")) return ".webp"
  if (s.includes("jpeg") || s.includes("jpg")) return ".jpg"
  if (s.includes("wav")) return ".wav"
  if (s.includes("mpeg") || s.includes("mp3")) return ".mp3"
  if (s.includes("mp4") || s.includes("m4a") || s.includes("aac")) return ".m4a"
  if (s.includes("webm")) return ".webm"
  if (s.includes("ogg")) return ".ogg"
  return fallback
}

export async function bufferFromDataUrlOrHttp(source: string): Promise<{ buf: Buffer; ext: string }> {
  const src = source.trim()
  if (!src) throw new Error("미디어 URL이 비어 있습니다.")

  if (src.startsWith("data:")) {
    const m = src.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
    if (!m) throw new Error("data URL 형식이 올바르지 않습니다.")
    const mime = m[1] || "application/octet-stream"
    const isB64 = Boolean(m[2])
    const data = m[3] || ""
    const buf = isB64 ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "utf8")
    return { buf, ext: extFromMimeOrUrl(mime, ".bin") }
  }

  if (src.startsWith("http://") || src.startsWith("https://")) {
    const res = await fetch(src)
    if (!res.ok) throw new Error(`미디어 다운로드 실패 (${res.status})`)
    const mime = res.headers.get("content-type") || ""
    const arr = Buffer.from(await res.arrayBuffer())
    const urlExt = path.extname(new URL(src).pathname)
    return {
      buf: arr,
      ext: urlExt || extFromMimeOrUrl(mime, ".bin"),
    }
  }

  throw new Error("지원하지 않는 미디어 URL입니다. (http/https 또는 data URL)")
}

/**
 * 16:9 정지 이미지에 TTS 길만큼 루프 + 오디오 합성.
 * WingsStudio 최종영상과 같은 「이미지 스틸 + 나레이션」 형태.
 */
export async function composeStillImageWithAudioToMp4(opts: {
  imageSource: string
  audioSource: string
}): Promise<Buffer> {
  if (!hasFfmpeg()) {
    throw new Error(
      "서버에서 ffmpeg를 찾지 못했습니다. npm install 후 dev 서버를 재시작해 주세요."
    )
  }
  assertFfmpegExecutable()

  const tmpDir = path.join(os.tmpdir(), `lfv2-compose-${randomUUID()}`)
  await fs.mkdir(tmpDir, { recursive: true })

  try {
    const image = await bufferFromDataUrlOrHttp(opts.imageSource)
    const audio = await bufferFromDataUrlOrHttp(opts.audioSource)
    const imagePath = path.join(tmpDir, `still${image.ext || ".png"}`)
    const audioPath = path.join(tmpDir, `voice${audio.ext || ".wav"}`)
    const outPath = path.join(tmpDir, "out.mp4")

    await fs.writeFile(imagePath, image.buf)
    await fs.writeFile(audioPath, audio.buf)

    const vf = `scale=${RENDER_W}:${RENDER_H}:force_original_aspect_ratio=decrease,pad=${RENDER_W}:${RENDER_H}:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p`

    runFfmpeg(
      [
        "-y",
        "-loop",
        "1",
        "-i",
        imagePath,
        "-i",
        audioPath,
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-tune",
        "stillimage",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        outPath,
      ],
      "이미지·음성 최종영상 합성 실패"
    )

    const out = await fs.readFile(outPath)
    if (!out.length) throw new Error("합성된 MP4가 비어 있습니다.")
    return out
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Seedance 등 무음 AI 영상 + TTS → 최종 MP4
 * - 영상이 나레이션보다 짧으면 루프
 * - 길면 나레이션 길이에 맞춤 (-shortest)
 */
export async function composeMotionVideoWithAudioToMp4(opts: {
  videoSource: string
  audioSource: string
}): Promise<Buffer> {
  if (!hasFfmpeg()) {
    throw new Error(
      "서버에서 ffmpeg를 찾지 못했습니다. npm install 후 dev 서버를 재시작해 주세요.",
    )
  }
  assertFfmpegExecutable()

  const tmpDir = path.join(os.tmpdir(), `lfv2-motion-compose-${randomUUID()}`)
  await fs.mkdir(tmpDir, { recursive: true })

  try {
    const video = await bufferFromDataUrlOrHttp(opts.videoSource)
    const audio = await bufferFromDataUrlOrHttp(opts.audioSource)
    const videoExt =
      video.ext === ".bin" || !video.ext
        ? ".mp4"
        : video.ext.startsWith(".")
          ? video.ext
          : `.${video.ext}`
    const videoPath = path.join(tmpDir, `motion${videoExt}`)
    const audioPath = path.join(tmpDir, `voice${audio.ext || ".wav"}`)
    const outPath = path.join(tmpDir, "out.mp4")

    await fs.writeFile(videoPath, video.buf)
    await fs.writeFile(audioPath, audio.buf)

    const vf = `scale=${RENDER_W}:${RENDER_H}:force_original_aspect_ratio=decrease,pad=${RENDER_W}:${RENDER_H}:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p`

    // 오디오 길이에 맞춰 영상 루프 (-stream_loop -1) 후 -shortest
    runFfmpeg(
      [
        "-y",
        "-stream_loop",
        "-1",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-shortest",
        "-movflags",
        "+faststart",
        outPath,
      ],
      "AI영상·음성 최종영상 합성 실패",
    )

    const out = await fs.readFile(outPath)
    if (!out.length) throw new Error("합성된 MP4가 비어 있습니다.")
    return out
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

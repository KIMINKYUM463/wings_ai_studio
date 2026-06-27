import { spawnSync } from "child_process"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { randomUUID } from "crypto"
import {
  assertFfmpegExecutable,
  hasFfprobe,
  resolveFfmpegPath,
  resolveFfprobePath,
} from "@/lib/ffmpeg-binaries"
import { MVP_THUMBNAIL_INTRO_SEC } from "@/lib/mvp-thumbnail-intro"

const MVP_RENDER_W = 1080
const MVP_RENDER_H = 1920
const LANCZOS_SCALE = `scale=${MVP_RENDER_W}:${MVP_RENDER_H}:flags=lanczos+accurate_rnd+full_chroma_int:force_original_aspect_ratio=increase,crop=${MVP_RENDER_W}:${MVP_RENDER_H}:(iw-${MVP_RENDER_W})/2:(ih-${MVP_RENDER_H})/2`

/** 브라우저 WebM→MP4(convertWebmBlobToMp4)와 동일 */
const BROWSER_COMPAT_H264_ARGS = [
  "-c:v",
  "libx264",
  "-preset",
  "fast",
  "-crf",
  "23",
  "-pix_fmt",
  "yuv420p",
  "-profile:v",
  "high",
  "-level",
  "4.0",
] as const

function runFfmpeg(args: string[], label: string): void {
  const bin = resolveFfmpegPath()
  const r = spawnSync(bin, args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (r.error) throw r.error
  if (r.status !== 0) {
    const detail = `${r.stderr || ""}${r.stdout || ""}`.trim().slice(-800)
    throw new Error(`${label}${detail ? `: ${detail}` : ""}`)
  }
}

function probeImageSize(imagePath: string): { w: number; h: number } | null {
  if (!hasFfprobe()) return null
  const r = spawnSync(
    resolveFfprobePath(),
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=p=0",
      imagePath,
    ],
    { encoding: "utf8", windowsHide: true }
  )
  if (r.status !== 0 || !r.stdout?.trim()) return null
  const [wRaw, hRaw] = r.stdout.trim().split(",")
  const w = Number.parseInt(wRaw ?? "", 10)
  const h = Number.parseInt(hRaw ?? "", 10)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return null
  return { w, h }
}

function thumbVideoFilter(imagePath: string): string {
  const size = probeImageSize(imagePath)
  if (size?.w === MVP_RENDER_W && size?.h === MVP_RENDER_H) {
    return "format=yuv420p"
  }
  return `${LANCZOS_SCALE},format=yuv420p`
}

/**
 * 맨 앞 introSec 구간에 썸네일 PNG를 오버레이.
 * concat/trim 방식은 타임스탬프·fps 불일치로 영상·자막이 TTS보다 느리게 보일 수 있어
 * 타임라인을 건드리지 않고 픽셀만 덮는 방식을 사용합니다 (미리보기와 동일).
 */
export async function prependThumbnailIntroToMp4Buffer(args: {
  mainMp4: Buffer
  thumbPng: Buffer
  introSec?: number
  mainDurationSec: number
}): Promise<Buffer> {
  assertFfmpegExecutable()

  const introSec = args.introSec ?? MVP_THUMBNAIL_INTRO_SEC
  const dir = path.join(os.tmpdir(), "mvp-thumb-prepend", randomUUID())
  await fs.mkdir(dir, { recursive: true })

  const mainPath = path.join(dir, "main.mp4")
  const thumbPath = path.join(dir, "thumb.png")
  const outPath = path.join(dir, "out.mp4")

  const thumbVf = thumbVideoFilter(thumbPath)
  const overlayEnable = `lte(t\\,${introSec})`
  const filterComplex = `[1:v]${thumbVf}[thumb];[0:v][thumb]overlay=0:0:enable='${overlayEnable}'[v]`

  const encodeArgs = [
    "-y",
    "-i",
    mainPath,
    "-loop",
    "1",
    "-i",
    thumbPath,
    "-filter_complex",
    filterComplex,
    "-map",
    "[v]",
    "-map",
    "0:a?",
    ...BROWSER_COMPAT_H264_ARGS,
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    outPath,
  ]

  const encodeArgsAacFallback = [
    "-y",
    "-i",
    mainPath,
    "-loop",
    "1",
    "-i",
    thumbPath,
    "-filter_complex",
    filterComplex,
    "-map",
    "[v]",
    "-map",
    "0:a?",
    ...BROWSER_COMPAT_H264_ARGS,
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    outPath,
  ]

  try {
    await fs.writeFile(mainPath, args.mainMp4)
    await fs.writeFile(thumbPath, args.thumbPng)

    try {
      runFfmpeg(encodeArgs, "썸네일 오버레이 합성 실패")
    } catch {
      runFfmpeg(encodeArgsAacFallback, "썸네일 오버레이 합성 실패")
    }

    const out = await fs.readFile(outPath)
    if (out.length < 4096) {
      throw new Error("썸네일 합성 결과 MP4가 비어 있습니다.")
    }
    return out
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

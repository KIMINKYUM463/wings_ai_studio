import { spawnSync } from "child_process"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { randomUUID } from "crypto"
import { assertFfmpegExecutable, resolveFfmpegPath } from "@/lib/ffmpeg-binaries"

const MVP_RENDER_W = 1080
const MVP_RENDER_H = 1920

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

const SCALE_VF = `scale=${MVP_RENDER_W}:${MVP_RENDER_H}:flags=lanczos:force_original_aspect_ratio=increase,crop=${MVP_RENDER_W}:${MVP_RENDER_H},fps=30,format=yuv420p`

function runFfmpeg(args: string[], label: string): void {
  const bin = resolveFfmpegPath()
  const r = spawnSync(bin, args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  })
  if (r.error) throw r.error
  if (r.status !== 0) {
    const detail = `${r.stderr || ""}${r.stdout || ""}`.trim().slice(-1000)
    throw new Error(`${label}${detail ? `: ${detail}` : ""}`)
  }
}

/**
 * 리믹스 결과 MP4의 insertAtSec 지점에 clip을 clipDurationSec만큼 끼워 넣습니다.
 * head | clip(정규화 9:16) | tail 을 재인코딩 concat 합니다.
 */
export async function insertClipIntoMp4Buffer(args: {
  mainMp4: Buffer
  clipVideo: Buffer
  insertAtSec: number
  clipDurationSec: number
  /** 추가 클립에서 쓰기 시작할 시각(초) — 트림 시작점 */
  clipStartSec?: number
  mainDurationSec?: number
  /**
   * 지정 시 main의 [insertAtSec, replaceEndSec) 구간을 제거하고 클립으로 대체(공백 채우기).
   * 미지정 시 insertAtSec 지점에 끼워 넣어 전체 길이가 늘어납니다.
   */
  replaceEndSec?: number
}): Promise<Buffer> {
  assertFfmpegExecutable()

  const insertAt = Math.max(0, args.insertAtSec)
  const clipDurCap = args.replaceEndSec != null ? 120 : 8
  const clipDur = Math.max(0.4, Math.min(clipDurCap, args.clipDurationSec))
  const replaceEnd =
    args.replaceEndSec != null && Number.isFinite(args.replaceEndSec)
      ? Math.max(insertAt, args.replaceEndSec)
      : null
  const tailStart = replaceEnd != null ? replaceEnd : insertAt
  const dir = path.join(os.tmpdir(), "mvp-insert-clip", randomUUID())
  await fs.mkdir(dir, { recursive: true })

  const mainPath = path.join(dir, "main.mp4")
  const clipInPath = path.join(dir, "clip_in")
  const headPath = path.join(dir, "head.mp4")
  const midPath = path.join(dir, "mid.mp4")
  const tailPath = path.join(dir, "tail.mp4")
  const listPath = path.join(dir, "list.txt")
  const outPath = path.join(dir, "out.mp4")

  try {
    await fs.writeFile(mainPath, args.mainMp4)
    // 확장자 힌트 — 브라우저 webm/mp4 모두 허용
    const clipExt =
      args.clipVideo[4] === 0x66 && args.clipVideo[5] === 0x74
        ? ".mp4"
        : args.clipVideo[0] === 0x1a && args.clipVideo[1] === 0x45
          ? ".webm"
          : ".mp4"
    const clipPath = clipInPath + clipExt
    await fs.writeFile(clipPath, args.clipVideo)

    const parts: string[] = []

    if (insertAt > 0.05) {
      runFfmpeg(
        [
          "-y",
          "-i",
          mainPath,
          "-t",
          insertAt.toFixed(3),
          "-vf",
          SCALE_VF,
          ...BROWSER_COMPAT_H264_ARGS,
          "-an",
          "-movflags",
          "+faststart",
          headPath,
        ],
        "앞부분 자르기 실패"
      )
      parts.push(headPath)
    }

    runFfmpeg(
      [
        "-y",
        "-ss",
        Math.max(0, args.clipStartSec ?? 0).toFixed(3),
        "-i",
        clipPath,
        "-t",
        clipDur.toFixed(3),
        "-vf",
        SCALE_VF,
        ...BROWSER_COMPAT_H264_ARGS,
        "-an",
        "-movflags",
        "+faststart",
        midPath,
      ],
      "추가 클립 정규화 실패"
    )
    parts.push(midPath)

    const mainDur = args.mainDurationSec
    const needTail = mainDur == null || mainDur > tailStart + 0.08
    if (needTail) {
      runFfmpeg(
        [
          "-y",
          "-ss",
          tailStart.toFixed(3),
          "-i",
          mainPath,
          "-vf",
          SCALE_VF,
          ...BROWSER_COMPAT_H264_ARGS,
          "-an",
          "-movflags",
          "+faststart",
          tailPath,
        ],
        "뒷부분 자르기 실패"
      )
      parts.push(tailPath)
    }

    if (parts.length === 1) {
      return await fs.readFile(parts[0]!)
    }

    const listBody = parts
      .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n")
    await fs.writeFile(listPath, listBody, "utf8")

    try {
      runFfmpeg(
        [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listPath,
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          outPath,
        ],
        "클립 concat 실패"
      )
    } catch {
      runFfmpeg(
        [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listPath,
          ...BROWSER_COMPAT_H264_ARGS,
          "-an",
          "-movflags",
          "+faststart",
          outPath,
        ],
        "클립 concat 재인코딩 실패"
      )
    }

    const out = await fs.readFile(outPath)
    if (out.length < 4096) throw new Error("합성 결과 MP4가 비어 있습니다.")
    return out
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * main MP4에서 [removeStartSec, removeEndSec) 구간을 제거하고 앞뒤를 이어 붙입니다.
 */
export async function removeRangeFromMp4Buffer(args: {
  mainMp4: Buffer
  removeStartSec: number
  removeEndSec: number
  mainDurationSec?: number
}): Promise<Buffer> {
  assertFfmpegExecutable()

  const removeStart = Math.max(0, args.removeStartSec)
  const removeEnd = Math.max(removeStart + 0.05, args.removeEndSec)
  const dir = path.join(os.tmpdir(), "mvp-remove-range", randomUUID())
  await fs.mkdir(dir, { recursive: true })

  const mainPath = path.join(dir, "main.mp4")
  const headPath = path.join(dir, "head.mp4")
  const tailPath = path.join(dir, "tail.mp4")
  const listPath = path.join(dir, "list.txt")
  const outPath = path.join(dir, "out.mp4")

  try {
    await fs.writeFile(mainPath, args.mainMp4)
    const parts: string[] = []

    if (removeStart > 0.05) {
      runFfmpeg(
        [
          "-y",
          "-i",
          mainPath,
          "-t",
          removeStart.toFixed(3),
          "-vf",
          SCALE_VF,
          ...BROWSER_COMPAT_H264_ARGS,
          "-an",
          "-movflags",
          "+faststart",
          headPath,
        ],
        "삭제 앞부분 자르기 실패"
      )
      parts.push(headPath)
    }

    const mainDur = args.mainDurationSec
    const needTail = mainDur == null || mainDur > removeEnd + 0.08
    if (needTail) {
      runFfmpeg(
        [
          "-y",
          "-ss",
          removeEnd.toFixed(3),
          "-i",
          mainPath,
          "-vf",
          SCALE_VF,
          ...BROWSER_COMPAT_H264_ARGS,
          "-an",
          "-movflags",
          "+faststart",
          tailPath,
        ],
        "삭제 뒷부분 자르기 실패"
      )
      parts.push(tailPath)
    }

    if (parts.length === 0) {
      throw new Error("컷을 삭제하면 영상이 비게 됩니다. 다른 컷을 남겨 주세요.")
    }
    if (parts.length === 1) {
      return await fs.readFile(parts[0]!)
    }

    const listBody = parts
      .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n")
    await fs.writeFile(listPath, listBody, "utf8")

    try {
      runFfmpeg(
        [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listPath,
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          outPath,
        ],
        "삭제 후 concat 실패"
      )
    } catch {
      runFfmpeg(
        [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listPath,
          ...BROWSER_COMPAT_H264_ARGS,
          "-an",
          "-movflags",
          "+faststart",
          outPath,
        ],
        "삭제 후 concat 재인코딩 실패"
      )
    }

    const out = await fs.readFile(outPath)
    if (out.length < 4096) throw new Error("삭제 결과 MP4가 비어 있습니다.")
    return out
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * 현재 MP4의 여러 구간을 지정 순서로 잘라 이어 붙입니다(컷 순서 변경).
 */
export async function concatRangesFromMp4Buffer(args: {
  mainMp4: Buffer
  ranges: Array<{ startSec: number; endSec: number }>
  mainDurationSec?: number
}): Promise<Buffer> {
  assertFfmpegExecutable()
  if (!args.ranges.length) throw new Error("이어 붙일 구간이 없습니다.")

  const dir = path.join(os.tmpdir(), "mvp-reorder-ranges", randomUUID())
  await fs.mkdir(dir, { recursive: true })
  const mainPath = path.join(dir, "main.mp4")
  const listPath = path.join(dir, "list.txt")
  const outPath = path.join(dir, "out.mp4")

  try {
    await fs.writeFile(mainPath, args.mainMp4)
    const parts: string[] = []

    for (let i = 0; i < args.ranges.length; i++) {
      const r = args.ranges[i]!
      const start = Math.max(0, r.startSec)
      const end = Math.max(start + 0.05, r.endSec)
      const dur = end - start
      const partPath = path.join(dir, `part_${i}.mp4`)
      runFfmpeg(
        [
          "-y",
          "-ss",
          start.toFixed(3),
          "-i",
          mainPath,
          "-t",
          dur.toFixed(3),
          "-vf",
          SCALE_VF,
          ...BROWSER_COMPAT_H264_ARGS,
          "-an",
          "-movflags",
          "+faststart",
          partPath,
        ],
        `구간 ${i + 1} 추출 실패`
      )
      parts.push(partPath)
    }

    if (parts.length === 1) {
      return await fs.readFile(parts[0]!)
    }

    const listBody = parts
      .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n")
    await fs.writeFile(listPath, listBody, "utf8")

    try {
      runFfmpeg(
        [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listPath,
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          outPath,
        ],
        "순서 변경 concat 실패"
      )
    } catch {
      runFfmpeg(
        [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listPath,
          ...BROWSER_COMPAT_H264_ARGS,
          "-an",
          "-movflags",
          "+faststart",
          outPath,
        ],
        "순서 변경 concat 재인코딩 실패"
      )
    }

    const out = await fs.readFile(outPath)
    if (out.length < 4096) throw new Error("순서 변경 결과 MP4가 비어 있습니다.")
    return out
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

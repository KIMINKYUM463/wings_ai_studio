import { spawn } from "child_process"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { randomUUID } from "crypto"
import {
  assertFfmpegExecutable,
  hasFfmpeg,
  hasFfprobe,
  probeDurationViaFfmpeg,
  resolveFfmpegPath,
  resolveFfprobePath,
} from "@/lib/ffmpeg-binaries"
import { fetchUpstreamVideo } from "@/lib/video-upstream-fetch"

function ffmpegBin(): string {
  return resolveFfmpegPath()
}

function ffprobeBin(): string {
  return resolveFfprobePath()
}

export { hasFfmpeg, hasFfprobe }

function assertMp4Buffer(buf: Buffer, label: string): void {
  if (buf.length < 50_000) {
    throw new Error(`${label}: 파일이 너무 작습니다 (${buf.length} bytes). CDN 다운로드 실패 가능.`)
  }
  const sig = buf.subarray(4, 8).toString("ascii")
  if (sig !== "ftyp") {
    throw new Error(`${label}: 유효한 MP4가 아닙니다. 저장 버튼과 동일한 프록시 경로로 다시 시도해 주세요.`)
  }
}

export async function downloadSourceVideo(sourceUrl: string, destPath: string): Promise<void> {
  const res = await fetchUpstreamVideo(sourceUrl)
  const buf = Buffer.from(await res.arrayBuffer())
  assertMp4Buffer(buf, "원본 영상")
  await fs.writeFile(destPath, buf)
}

export async function saveUploadedVideoBuffer(buf: Buffer, destPath: string): Promise<void> {
  assertMp4Buffer(buf, "업로드 영상")
  await fs.writeFile(destPath, buf)
}

export async function createAutoEditWorkDir(jobId?: string): Promise<{ dir: string; id: string }> {
  const id = jobId || randomUUID()
  const dir = path.join(os.tmpdir(), "shotform-auto-edit", id)
  await fs.mkdir(dir, { recursive: true })
  return { dir, id }
}

/** 디코딩 가능한 비디오 스트림 존재 여부 */
export async function probeHasVideoStream(filePath: string): Promise<boolean> {
  if (!hasFfprobe()) return true
  return new Promise((resolve) => {
    const proc = spawn(
      ffprobeBin(),
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "csv=p=0",
        filePath,
      ],
      { windowsHide: true }
    )
    let out = ""
    proc.stdout.on("data", (d) => {
      out += String(d)
    })
    proc.on("close", (code) => {
      resolve(code === 0 && out.trim().toLowerCase().includes("video"))
    })
    proc.on("error", () => resolve(false))
  })
}

export async function probeVideoDuration(filePath: string, required = false): Promise<number> {
  if (!hasFfprobe()) {
    const viaFfmpeg = probeDurationViaFfmpeg(filePath)
    if (viaFfmpeg != null) return viaFfmpeg
    if (required) {
      throw new Error(
        "ffprobe/ffmpeg를 실행할 수 없습니다. Vercel 재배포 후 다시 시도해 주세요."
      )
    }
    const stat = await fs.stat(filePath)
    const guess = Math.max(15, Math.min(90, Math.round(stat.size / 180_000)))
    return guess
  }
  return new Promise((resolve, reject) => {
    const proc = spawn(
      ffprobeBin(),
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { windowsHide: true }
    )
    let out = ""
    let err = ""
    proc.stdout.on("data", (d) => {
      out += String(d)
    })
    proc.stderr.on("data", (d) => {
      err += String(d)
    })
    proc.on("close", (code) => {
      const n = parseFloat(out.trim())
      if (code === 0 && Number.isFinite(n) && n > 0) resolve(n)
      else {
        const viaFfmpeg = probeDurationViaFfmpeg(filePath)
        if (viaFfmpeg != null) resolve(viaFfmpeg)
        else reject(new Error(err.slice(0, 200) || "ffprobe duration 실패"))
      }
    })
  })
}

function runFfmpeg(args: string[], timeoutMs = 180_000): Promise<void> {
  const spawnArgs = isServerlessRender() ? ["-nostdin", ...args] : args
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin(), spawnArgs, { windowsHide: true })
    let err = ""
    const timer = setTimeout(() => {
      proc.kill("SIGKILL")
      reject(new Error(`ffmpeg timeout (${Math.round(timeoutMs / 1000)}s)`))
    }, timeoutMs)
    proc.stderr.on("data", (d) => {
      err += String(d)
    })
    proc.on("error", (e) => {
      clearTimeout(timer)
      reject(e)
    })
    proc.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(err.slice(-500) || `ffmpeg exit ${code}`))
    })
  })
}

function isServerlessRender(): boolean {
  return Boolean(process.env.VERCEL)
}

/** 9:16 쇼츠 — video_id별 소스에서 컷 후 concat, 목표 길이로 trim */
export async function renderEditPlanToMp4(args: {
  sourcePaths: Record<string, string>
  workDir: string
  segments: Array<{
    video_id: string
    source_start: number
    source_end: number
    output_start: number
    output_end: number
  }>
  outputPath: string
  targetDuration: number
  defaultVideoId?: string
}): Promise<void> {
  assertFfmpegExecutable()

  const { sourcePaths, workDir, segments, outputPath, targetDuration, defaultVideoId } = args
  const serverless = isServerlessRender()
  const w = serverless ? 720 : 1080
  const h = serverless ? 1280 : 1920
  const fallbackId =
    defaultVideoId || Object.keys(sourcePaths)[0] || "video_001"
  const scaled: string[] = []

  const renderOneSegment = async (seg: (typeof segments)[number], i: number): Promise<string | null> => {
    const vid = sourcePaths[seg.video_id] ? seg.video_id : fallbackId
    const sourcePath = sourcePaths[vid]
    if (!sourcePath) return null

    const clipDur = Math.max(0.15, seg.output_end - seg.output_start)
    const sourceAvail = Math.max(0.15, seg.source_end - seg.source_start)
    const dur = Math.min(clipDur, sourceAvail)
    const outSeg = path.join(workDir, `seg_${i}.mp4`)
    const segTimeout = serverless ? 120_000 : 180_000
    await runFfmpeg(
      [
        "-y",
        ...(serverless ? ["-threads", "1"] : []),
        "-i",
        sourcePath,
        "-ss",
        String(seg.source_start),
        "-t",
        String(dur),
        "-vf",
        `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-${w})/2:(ih-${h})/2`,
        "-r",
        "30",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        serverless ? "28" : "26",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outSeg,
      ],
      segTimeout
    )
    return outSeg
  }

  if (serverless) {
    for (let i = 0; i < segments.length; i++) {
      const p = await renderOneSegment(segments[i]!, i)
      if (p) scaled.push(p)
    }
  } else {
    const segPaths = await Promise.all(segments.map((seg, i) => renderOneSegment(seg, i)))
    for (const p of segPaths) {
      if (p) scaled.push(p)
    }
  }

  if (!scaled.length) {
    throw new Error("렌더할 컷이 없습니다.")
  }

  const listPath = path.join(workDir, "concat.txt")
  const listBody = scaled.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n")
  await fs.writeFile(listPath, listBody, "utf8")

  const rawOut = path.join(workDir, "concat_raw.mp4")
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", rawOut], 120_000)

  const concatDur = await probeVideoDuration(rawOut, true)
  const padSec = Math.max(0, targetDuration - concatDur)

  const finalPreset = serverless ? "ultrafast" : "fast"
  const finalCrf = serverless ? "26" : "23"
  const finalTimeout = serverless ? 180_000 : 120_000

  if (padSec > 0.12) {
    await runFfmpeg(
      [
        "-y",
        ...(serverless ? ["-threads", "1"] : []),
        "-i",
        rawOut,
        "-vf",
        `tpad=stop_mode=clone:stop_duration=${padSec.toFixed(3)}`,
        "-t",
        String(targetDuration),
        "-c:v",
        "libx264",
        "-preset",
        finalPreset,
        "-crf",
        finalCrf,
        "-an",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      finalTimeout
    )
  } else if (padSec <= 0.12 && !serverless) {
    await runFfmpeg(
      [
        "-y",
        "-i",
        rawOut,
        "-t",
        String(targetDuration),
        "-c:v",
        "libx264",
        "-preset",
        finalPreset,
        "-crf",
        finalCrf,
        "-an",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      finalTimeout
    )
  } else {
    await runFfmpeg(
      ["-y", "-i", rawOut, "-t", String(targetDuration), "-c", "copy", "-an", outputPath],
      finalTimeout
    )
  }
}

export async function validateRenderedMp4(
  outputPath: string,
  minSeconds = 1,
  expectedSeconds?: number
): Promise<number> {
  const stat = await fs.stat(outputPath)
  if (stat.size < 20_000) {
    throw new Error("렌더 결과 MP4가 비어 있습니다. 원본 영상 다운로드를 확인해 주세요.")
  }
  const dur = await probeVideoDuration(outputPath, true)
  if (dur < minSeconds) {
    throw new Error(`렌더 결과 길이가 너무 짧습니다 (${dur.toFixed(1)}초).`)
  }
  if (expectedSeconds != null) {
    if (dur < expectedSeconds - 0.75) {
      throw new Error(
        `렌더 결과(${dur.toFixed(1)}초)가 선택한 목표(${expectedSeconds}초)에 못 미칩니다. 영상·장면을 더 선택한 뒤 다시 짜집기해 주세요.`
      )
    }
    if (dur > expectedSeconds + 0.6) {
      throw new Error(
        `렌더 결과가 목표(${expectedSeconds}초)보다 깁니다 (${dur.toFixed(1)}초). 다시 시도해 주세요.`
      )
    }
  }
  return dur
}

function keyframeRatios(count: number): number[] {
  if (count <= 1) return [0.12]
  const ratios: number[] = []
  for (let i = 0; i < count; i++) {
    ratios.push(0.04 + (0.9 * i) / (count - 1))
  }
  return ratios
}

function clampKeyframeTime(timeSec: number, duration?: number): number {
  const t = Math.max(0, timeSec)
  if (duration == null || !Number.isFinite(duration) || duration <= 0) return t
  return Math.min(t, Math.max(0, duration - 0.04))
}

async function assertKeyframeOutput(framePath: string): Promise<void> {
  const stat = await fs.stat(framePath)
  if (stat.size < 400) {
    throw new Error("키프레임 이미지가 비어 있습니다.")
  }
}

async function extractSingleKeyframe(
  sourcePath: string,
  framePath: string,
  timeSec: number,
  duration?: number,
  opts?: { fast?: boolean }
): Promise<void> {
  await fs.mkdir(path.dirname(framePath), { recursive: true })
  const safeTime = clampKeyframeTime(timeSec, duration)
  const src = sourcePath.replace(/\\/g, "/")
  const out = framePath.replace(/\\/g, "/")
  const scale = opts?.fast ? "240:-1" : "480:-1"
  const vf = `scale=${scale}`
  const allAttempts: string[][] = [
    ["-y", "-ss", String(safeTime), "-i", src, "-map", "0:v:0", "-an", "-frames:v", "1", "-q:v", "5", "-vf", vf, out],
    ["-y", "-i", src, "-ss", String(safeTime), "-map", "0:v:0", "-an", "-frames:v", "1", "-q:v", "5", "-vf", vf, out],
    ["-y", "-i", src, "-map", "0:v:0", "-an", "-frames:v", "1", "-q:v", "5", "-vf", vf, out],
  ]
  const attempts = opts?.fast ? allAttempts.slice(0, 1) : allAttempts
  const timeoutMs = opts?.fast ? 7_000 : 45_000

  let lastErr = ""
  for (const args of attempts) {
    try {
      await runFfmpeg(args, timeoutMs)
      await assertKeyframeOutput(out)
      return
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
      await fs.unlink(out).catch(() => {})
    }
  }
  throw new Error(lastErr.slice(-280) || "키프레임 추출 실패")
}

/** Vision 분류용 키프레임 추출 */
export async function extractVideoKeyframes(
  sourcePath: string,
  workDir: string,
  duration: number,
  count = 5,
  opts?: { fast?: boolean }
): Promise<Array<{ path: string; timeSec: number }>> {
  await fs.mkdir(workDir, { recursive: true })
  const ratios = keyframeRatios(count)
  const fast = opts?.fast === true
  const settled = await Promise.all(
    ratios.map(async (ratio, i) => {
      const timeSec = Math.max(0, Math.min(Math.max(0, duration - 0.08), duration * ratio))
      const framePath = path.join(workDir, `kf_${i}.jpg`)
      try {
        await extractSingleKeyframe(sourcePath, framePath, timeSec, duration, { fast })
        return { path: framePath, timeSec }
      } catch {
        if (fast) return null
        const fallbackTime = clampKeyframeTime(duration * 0.5, duration)
        try {
          await extractSingleKeyframe(sourcePath, framePath, fallbackTime, duration, { fast })
          return { path: framePath, timeSec: fallbackTime }
        } catch {
          return null
        }
      }
    })
  )
  const out = settled.filter((row): row is { path: string; timeSec: number } => row != null)
  if (!out.length) {
    throw new Error("영상에서 키프레임을 추출하지 못했습니다. 다른 영상을 선택해 주세요.")
  }
  return out
}

/** 특정 시각 1장 추출 (짜집기 컷 정밀 캡션용) */
export async function extractVideoKeyframeAtTime(
  sourcePath: string,
  workDir: string,
  duration: number,
  timeSec: number,
  label = "cut",
  opts?: { fast?: boolean }
): Promise<{ path: string; timeSec: number }> {
  const t = clampKeyframeTime(timeSec, duration)
  const framePath = path.join(workDir, `${label}_${t.toFixed(2).replace(".", "_")}.jpg`)
  await extractSingleKeyframe(sourcePath, framePath, t, duration, opts)
  return { path: framePath, timeSec: t }
}

const PRECISION_KF_MIN = 6

/** 정밀 분석 — 비율 기반 bulk + 시각별 배치 추출 폴백 */
export async function extractPrecisionKeyframes(
  sourcePath: string,
  workDir: string,
  duration: number,
  times: number[]
): Promise<Array<{ path: string; timeSec: number }>> {
  await fs.mkdir(workDir, { recursive: true })
  const want = Math.min(times.length, 28)

  try {
    const bulk = await extractVideoKeyframes(sourcePath, workDir, duration, Math.min(20, want), {
      fast: false,
    })
    if (bulk.length >= PRECISION_KF_MIN) return bulk
  } catch {
    /* per-time 폴백 */
  }

  const out: Array<{ path: string; timeSec: number }> = []
  const concurrency = 3
  for (let i = 0; i < times.length; i += concurrency) {
    const chunk = times.slice(i, i + concurrency)
    const rows = await Promise.all(
      chunk.map((timeSec, j) =>
        extractVideoKeyframeAtTime(sourcePath, workDir, duration, timeSec, `pkf${i + j}`, { fast: true }).catch(
          () => null
        )
      )
    )
    for (const r of rows) if (r) out.push(r)
    if (out.length >= 12) break
  }
  if (out.length >= PRECISION_KF_MIN) return out

  return extractVideoKeyframes(sourcePath, workDir, duration, 12, { fast: true })
}

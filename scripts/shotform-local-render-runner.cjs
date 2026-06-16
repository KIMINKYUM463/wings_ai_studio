/** shotform-local-render.mjs — CommonJS runner (ffmpeg-static 로드) */
const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

const payload = JSON.parse(process.argv[2] || "{}")
const { workDir, jobId, segments, targetDuration, defaultVideoId } = payload

const sourcesDir = path.join(workDir, "sources")
const jobDir = path.join(workDir, "jobs", jobId)
const outputPath = path.join(jobDir, "output.mp4")

function ffmpegBin() {
  try {
    return require("ffmpeg-static")
  } catch {
    return "ffmpeg"
  }
}

function ffprobeBin() {
  try {
    return require("ffprobe-static").path
  } catch {
    return "ffprobe"
  }
}

function probeDuration(sourcePath) {
  const r = spawnSync(
    ffprobeBin(),
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      sourcePath,
    ],
    { encoding: "utf8" }
  )
  const n = parseFloat(String(r.stdout || "").trim())
  return Number.isFinite(n) && n > 0 ? n : null
}

function clampSeg(seg, sourceDuration) {
  const clipDur = Math.max(0.15, seg.output_end - seg.output_start)
  const sourceAvail = Math.max(0.15, seg.source_end - seg.source_start)
  let duration = Math.min(clipDur, sourceAvail)
  let sourceStart = Math.max(0, seg.source_start)
  if (sourceDuration != null && sourceDuration > 0.25) {
    const maxStart = Math.max(0, sourceDuration - 0.2)
    if (sourceStart > maxStart) sourceStart = maxStart
    duration = Math.min(duration, Math.max(0.15, sourceDuration - sourceStart))
  }
  return { sourceStart, duration }
}

function runFfmpeg(args) {
  const bin = ffmpegBin()
  const r = spawnSync(bin, ["-nostdin", "-y", ...args], { encoding: "utf8" })
  if (r.status !== 0) {
    console.error(r.stderr?.slice(-800) || `ffmpeg exit ${r.status}`)
    return false
  }
  return true
}

function renderSeg(sourcePath, outSeg, sourceStart, dur, w, h) {
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-${w})/2:(ih-${h})/2`
  return runFfmpeg([
    "-i",
    sourcePath,
    "-ss",
    String(sourceStart),
    "-t",
    String(dur),
    "-map",
    "0:v:0?",
    "-sn",
    "-dn",
    "-vf",
    vf,
    "-r",
    "30",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-avoid_negative_ts",
    "make_zero",
    outSeg,
  ])
}

const scaled = []
const w = 1080
const h = 1920

fs.mkdirSync(jobDir, { recursive: true })

for (let i = 0; i < segments.length; i++) {
  const seg = segments[i]
  const vid = seg.video_id || defaultVideoId
  const sourcePath = path.join(sourcesDir, `${vid}.mp4`)
  if (!fs.existsSync(sourcePath)) {
    console.error(`소스 없음: ${sourcePath}`)
    process.exit(1)
  }
  const sourceDuration = probeDuration(sourcePath)
  const { sourceStart, duration } = clampSeg(seg, sourceDuration)
  const outSeg = path.join(jobDir, `seg_${i}.mp4`)
  let ok = renderSeg(sourcePath, outSeg, sourceStart, duration, w, h)
  if (!ok || !fs.existsSync(outSeg) || fs.statSync(outSeg).size < 20_000) {
    const retryDur =
      sourceDuration != null
        ? Math.min(duration, Math.max(0.15, sourceDuration))
        : duration
    ok = renderSeg(sourcePath, outSeg, 0, retryDur, w, h)
  }
  if (!ok || !fs.existsSync(outSeg) || fs.statSync(outSeg).size < 20_000) {
    console.error(`세그먼트 ${i} 렌더 실패 (${vid}, ss=${sourceStart}, t=${duration})`)
    process.exit(1)
  }
  scaled.push(outSeg)
}

const listPath = path.join(jobDir, "concat.txt")
fs.writeFileSync(
  listPath,
  scaled.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"),
  "utf8"
)
const rawOut = path.join(jobDir, "concat_raw.mp4")
if (!runFfmpeg(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", rawOut])) process.exit(1)
if (
  !runFfmpeg([
    "-i",
    rawOut,
    "-t",
    String(targetDuration),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-an",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ])
) {
  process.exit(1)
}

console.log(`완료: ${outputPath}`)

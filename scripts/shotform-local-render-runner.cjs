/** shotform-local-render — CommonJS runner (ffmpeg-static 로드) */
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

function probeHasVideo(sourcePath) {
  const r = spawnSync(
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
      sourcePath,
    ],
    { encoding: "utf8" }
  )
  return r.status === 0 && String(r.stdout || "").trim().toLowerCase().includes("video")
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
  const r = spawnSync(bin, ["-nostdin", "-y", ...args], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 })
  if (r.status !== 0) {
    return { ok: false, err: r.stderr?.slice(-900) || `ffmpeg exit ${r.status}` }
  }
  return { ok: true, err: "" }
}

function cropVf(w, h) {
  return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-${w})/2:(ih-${h})/2`
}

function padVf(w, h) {
  return `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`
}

function encodeTail(outSeg) {
  return [
    "-r",
    "30",
    "-an",
    "-sn",
    "-dn",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    outSeg,
  ]
}

function renderSegAttempts(sourcePath, outSeg, sourceStart, duration, sourceDuration, w, h) {
  const retryDur =
    sourceDuration != null
      ? Math.min(duration, Math.max(0.15, sourceDuration))
      : duration
  const tries = [
    { input: ["-i", sourcePath, "-ss", String(sourceStart), "-t", String(duration)], vf: cropVf(w, h) },
    { input: ["-ss", String(sourceStart), "-i", sourcePath, "-t", String(duration)], vf: cropVf(w, h) },
    { input: ["-i", sourcePath, "-t", String(retryDur)], vf: cropVf(w, h) },
    { input: ["-i", sourcePath, "-ss", String(sourceStart), "-t", String(duration)], vf: padVf(w, h) },
  ]
  let lastErr = ""
  for (const t of tries) {
    if (fs.existsSync(outSeg)) {
      try {
        fs.unlinkSync(outSeg)
      } catch {
        /* ignore */
      }
    }
    const r = runFfmpeg([...t.input, "-vf", t.vf, ...encodeTail(outSeg)])
    if (r.ok && fs.existsSync(outSeg) && fs.statSync(outSeg).size >= 20_000) return { ok: true, err: "" }
    lastErr = r.err
  }
  return { ok: false, err: lastErr }
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
  if (!probeHasVideo(sourcePath)) {
    console.error(`${vid}: 영상 화면 스트림이 없습니다 (${sourcePath}). sources/ MP4를 다시 저장해 주세요.`)
    process.exit(1)
  }
  const sourceDuration = probeDuration(sourcePath)
  const { sourceStart, duration } = clampSeg(seg, sourceDuration)
  const outSeg = path.join(jobDir, `seg_${i}.mp4`)
  const rendered = renderSegAttempts(sourcePath, outSeg, sourceStart, duration, sourceDuration, w, h)
  if (!rendered.ok) {
    console.error(`세그먼트 ${i} 렌더 실패 (${vid}, ss=${sourceStart}, t=${duration})\n${rendered.err}`)
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
if (!runFfmpeg(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", rawOut]).ok) process.exit(1)
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
  ]).ok
) {
  process.exit(1)
}

console.log(`완료: ${outputPath}`)

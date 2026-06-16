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

function runFfmpeg(args) {
  const bin = ffmpegBin()
  const r = spawnSync(bin, ["-nostdin", "-y", ...args], { encoding: "utf8" })
  if (r.status !== 0) {
    console.error(r.stderr?.slice(-800) || `ffmpeg exit ${r.status}`)
    process.exit(1)
  }
}

const scaled = []
const w = 1080
const h = 1920

for (let i = 0; i < segments.length; i++) {
  const seg = segments[i]
  const vid = seg.video_id || defaultVideoId
  const sourcePath = path.join(sourcesDir, `${vid}.mp4`)
  if (!fs.existsSync(sourcePath)) {
    console.error(`소스 없음: ${sourcePath}`)
    process.exit(1)
  }
  const dur = Math.max(0.15, seg.output_end - seg.output_start)
  const outSeg = path.join(jobDir, `seg_${i}.mp4`)
  runFfmpeg([
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
    "fast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outSeg,
  ])
  scaled.push(outSeg)
}

const listPath = path.join(jobDir, "concat.txt")
fs.writeFileSync(
  listPath,
  scaled.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"),
  "utf8"
)
const rawOut = path.join(jobDir, "concat_raw.mp4")
runFfmpeg(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", rawOut])
runFfmpeg([
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

console.log(`완료: ${outputPath}`)

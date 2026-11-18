import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import ffmpegPath from "ffmpeg-static"
import ffprobe from "ffprobe-static"

const file = process.argv[2]
const expectedDuration = Number(process.argv[3] || 0)

if (!file || !existsSync(file)) {
  console.error("사용법: npm run validate:story-export -- <video.mp4> [expectedSeconds]")
  process.exit(2)
}

function run(binary, args) {
  const result = spawnSync(binary, args, { encoding: "utf8", windowsHide: true })
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || `${binary} 실행 실패`)
  }
  return `${result.stdout || ""}\n${result.stderr || ""}`
}

function frameRate(value) {
  const [numerator, denominator = "1"] = String(value || "0").split("/").map(Number)
  return denominator ? numerator / denominator : 0
}

const probe = JSON.parse(
  run(ffprobe.path, [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    file,
  ])
)
const video = probe.streams?.find((stream) => stream.codec_type === "video")
const audio = probe.streams?.find((stream) => stream.codec_type === "audio")
const duration = Number(probe.format?.duration || video?.duration || 0)
const fps = frameRate(video?.avg_frame_rate || video?.r_frame_rate)
const failures = []

if (!video) failures.push("비디오 스트림 없음")
if (!audio) failures.push("오디오 스트림 없음")
if (!String(probe.format?.format_name || "").includes("mp4")) failures.push("MP4 컨테이너 아님")
if (video && video.codec_name !== "h264") failures.push(`H.264 아님(${video.codec_name})`)
if (video && (video.width !== 1080 || video.height !== 1920)) {
  failures.push(`해상도 불일치(${video.width}x${video.height})`)
}
if (fps < 24) failures.push(`FPS 기준 미달(${fps.toFixed(2)})`)
if (!(duration > 0)) failures.push("재생 길이 없음")
if (expectedDuration > 0 && Math.abs(duration - expectedDuration) > 0.25) {
  failures.push(`길이 오차 ${Math.abs(duration - expectedDuration).toFixed(3)}초`)
}

// 시작·중간·끝 프레임을 실제 디코딩해 손상된 타임라인을 탐지합니다.
for (const sampleSec of [0, duration / 2, Math.max(0, duration - 0.1)]) {
  run(ffmpegPath, [
    "-v",
    "error",
    "-ss",
    String(sampleSec),
    "-i",
    file,
    "-frames:v",
    "1",
    "-f",
    "null",
    "-",
  ])
}

const volumeOutput = run(ffmpegPath, [
  "-hide_banner",
  "-i",
  file,
  "-af",
  "volumedetect",
  "-vn",
  "-f",
  "null",
  "-",
])
const maxVolume = Number(volumeOutput.match(/max_volume:\s*(-?[\d.]+)\s*dB/i)?.[1])
if (!Number.isFinite(maxVolume)) failures.push("오디오 레벨 분석 실패")
if (Number.isFinite(maxVolume) && maxVolume > -0.1) failures.push(`오디오 클리핑 위험(${maxVolume}dB)`)
if (Number.isFinite(maxVolume) && maxVolume < -40) failures.push(`오디오가 너무 작음(${maxVolume}dB)`)

const report = {
  file,
  passed: failures.length === 0,
  durationSec: Number(duration.toFixed(3)),
  fps: Number(fps.toFixed(2)),
  dimensions: video ? `${video.width}x${video.height}` : null,
  videoCodec: video?.codec_name || null,
  audioCodec: audio?.codec_name || null,
  maxVolumeDb: Number.isFinite(maxVolume) ? maxVolume : null,
  failures,
}
console.log(JSON.stringify(report, null, 2))
if (failures.length) process.exit(1)

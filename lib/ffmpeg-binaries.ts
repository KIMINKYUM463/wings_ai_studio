import fs from "fs"
import ffmpegStatic from "ffmpeg-static"
// ffprobe-static has no bundled types
import ffprobeStatic from "ffprobe-static"

function fileExists(p: string | null | undefined): p is string {
  if (!p) return false
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

/** PATH의 ffmpeg 또는 npm 패키지에 포함된 정적 바이너리 */
export function resolveFfmpegPath(): string {
  if (fileExists(ffmpegStatic)) return ffmpegStatic
  return "ffmpeg"
}

/** PATH의 ffprobe 또는 npm 패키지에 포함된 정적 바이너리 */
export function resolveFfprobePath(): string {
  const bundled = ffprobeStatic?.path
  if (fileExists(bundled)) return bundled
  return "ffprobe"
}

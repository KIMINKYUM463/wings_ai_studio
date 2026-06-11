/**
 * Vercel serverless — ffmpeg/ffprobe 바이너리를 vendor/에 복사 (outputFileTracingIncludes 대상)
 */
import fs from "fs"
import os from "os"
import path from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(path.join(root, "package.json"))

function copyIfExists(src, dest) {
  if (!src || !fs.existsSync(src)) return false
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  try {
    fs.chmodSync(dest, 0o755)
  } catch {
    /* windows */
  }
  console.log(`[copy-ffmpeg-vendor] ${path.basename(dest)} ← ${src}`)
  return true
}

const platform = os.platform()
const arch = os.arch()
let ok = false

try {
  const ffmpegPkg = path.dirname(require.resolve("ffmpeg-static/package.json"))
  const ffmpegName = platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
  const ffmpegSrc = path.join(ffmpegPkg, ffmpegName)
  const ffmpegDest = path.join(root, "vendor", "ffmpeg", `${platform}-${arch}-${ffmpegName}`)
  ok = copyIfExists(ffmpegSrc, ffmpegDest) || ok
} catch (e) {
  console.warn("[copy-ffmpeg-vendor] ffmpeg-static:", e.message)
}

try {
  const ffprobePkg = path.dirname(require.resolve("ffprobe-static/package.json"))
  const ffprobeName = platform === "win32" ? "ffprobe.exe" : "ffprobe"
  const ffprobeSrc = path.join(ffprobePkg, "bin", platform, arch, ffprobeName)
  const ffprobeDest = path.join(root, "vendor", "ffprobe", `${platform}-${arch}-${ffprobeName}`)
  ok = copyIfExists(ffprobeSrc, ffprobeDest) || ok
} catch (e) {
  console.warn("[copy-ffmpeg-vendor] ffprobe-static:", e.message)
}

if (!ok) {
  console.warn("[copy-ffmpeg-vendor] no binaries copied (dev without install?)")
}

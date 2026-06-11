import { spawnSync } from "child_process"
import { createRequire } from "module"
import fs from "fs"
import os from "os"
import path from "path"
import ffmpegStatic from "ffmpeg-static"
import ffprobeStatic from "ffprobe-static"

const prepared = new Map<"ffmpeg" | "ffprobe", string>()
const nodeRequire = createRequire(path.join(process.cwd(), "package.json"))

function fileExists(p: string | null | undefined): p is string {
  if (!p) return false
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function platformBinaryName(base: string): string {
  return os.platform() === "win32" ? `${base}.exe` : base
}

function vendorBinaryPath(kind: "ffmpeg" | "ffprobe"): string {
  const platform = os.platform()
  const arch = os.arch()
  const name = platformBinaryName(kind)
  return path.join(process.cwd(), "vendor", kind, `${platform}-${arch}-${name}`)
}

function packageResolvedPath(kind: "ffmpeg" | "ffprobe"): string | null {
  try {
    if (kind === "ffmpeg") {
      const exported = ffmpegStatic || (nodeRequire("ffmpeg-static") as string | null)
      if (fileExists(exported)) return exported
      const pkgDir = path.dirname(nodeRequire.resolve("ffmpeg-static/package.json"))
      const candidate = path.join(pkgDir, platformBinaryName("ffmpeg"))
      if (fileExists(candidate)) return candidate
    } else {
      const exported = ffprobeStatic?.path
      if (fileExists(exported)) return exported
      const pkgDir = path.dirname(nodeRequire.resolve("ffprobe-static/package.json"))
      const platform = os.platform()
      const arch = os.arch()
      const candidate = path.join(pkgDir, "bin", platform, arch, platformBinaryName("ffprobe"))
      if (fileExists(candidate)) return candidate
    }
  } catch {
    /* ignore */
  }
  return null
}

/** 패키지 export · vendor · cwd 순으로 후보 탐색 */
function candidatePaths(kind: "ffmpeg" | "ffprobe"): string[] {
  const platform = os.platform()
  const arch = os.arch()
  const out: string[] = []

  const resolved = packageResolvedPath(kind)
  if (resolved) out.push(resolved)

  out.push(vendorBinaryPath(kind))

  if (kind === "ffmpeg") {
    out.push(path.join(process.cwd(), "node_modules", "ffmpeg-static", platformBinaryName("ffmpeg")))
  } else {
    out.push(
      path.join(process.cwd(), "node_modules", "ffprobe-static", "bin", platform, arch, platformBinaryName("ffprobe")),
      path.join(process.cwd(), "node_modules", "ffprobe-static", "bin", platform, "x64", platformBinaryName("ffprobe"))
    )
  }

  return [...new Set(out)]
}

function findBundledBinary(kind: "ffmpeg" | "ffprobe"): string | null {
  const tried: string[] = []
  for (const candidate of candidatePaths(kind)) {
    tried.push(candidate)
    if (fileExists(candidate)) return candidate
  }
  if (process.env.VERCEL) {
    console.error(`[ffmpeg-binaries] ${kind} not found. tried:`, tried.join(" | "))
  }
  return null
}

/** Vercel/Linux serverless — /tmp에 복사 후 실행 권한 부여 */
function prepareBinaryForSpawn(kind: "ffmpeg" | "ffprobe"): string {
  const cached = prepared.get(kind)
  if (cached && fileExists(cached)) return cached

  const found = findBundledBinary(kind)
  if (!found) return kind

  if (process.env.VERCEL || os.platform() !== "win32") {
    try {
      const destDir = path.join(os.tmpdir(), "shotform-ffmpeg-bin")
      fs.mkdirSync(destDir, { recursive: true })
      const dest = path.join(destDir, `${kind}-${platformBinaryName(kind)}`)
      if (!fileExists(dest)) {
        fs.copyFileSync(found, dest)
      }
      fs.chmodSync(dest, 0o755)
      prepared.set(kind, dest)
      return dest
    } catch (e) {
      console.error(`[ffmpeg-binaries] prepare ${kind} failed:`, e)
    }
  }

  prepared.set(kind, found)
  return found
}

function spawnVersionCheck(bin: string): boolean {
  if (bin === "ffmpeg" || bin === "ffprobe") {
    const r = spawnSync(bin, ["-version"], { encoding: "utf8", windowsHide: true })
    return r.status === 0
  }
  const r = spawnSync(bin, ["-version"], { encoding: "utf8", windowsHide: true })
  return r.status === 0
}

export function resolveFfmpegPath(): string {
  return prepareBinaryForSpawn("ffmpeg")
}

export function resolveFfprobePath(): string {
  return prepareBinaryForSpawn("ffprobe")
}

export function hasFfmpeg(): boolean {
  return spawnVersionCheck(resolveFfmpegPath())
}

/** 렌더 전 ffmpeg 실행 가능 여부 확인 (Vercel serverless) */
export function assertFfmpegExecutable(): void {
  const bin = resolveFfmpegPath()
  if (bin === "ffmpeg") {
    throw new Error(
      "ffmpeg 바이너리를 찾지 못했습니다. Vercel 빌드 로그에서 copy-ffmpeg-vendor 실행 여부를 확인해 주세요."
    )
  }
  const r = spawnSync(bin, ["-version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 45_000,
  })
  if (r.error) throw r.error
  if (r.status !== 0) {
    throw new Error(r.stderr?.slice(0, 240) || "ffmpeg 실행 확인 실패")
  }
}

export function hasFfprobe(): boolean {
  const bin = resolveFfprobePath()
  if (bin !== "ffprobe" && spawnVersionCheck(bin)) return true
  return spawnVersionCheck("ffprobe")
}

/** ffprobe 없을 때 ffmpeg stderr에서 Duration 파싱 */
export function probeDurationViaFfmpeg(filePath: string): number | null {
  const bin = resolveFfmpegPath()
  const r = spawnSync(bin, ["-hide_banner", "-i", filePath, "-f", "null", "-"], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  })
  const err = `${r.stderr || ""}${r.stdout || ""}`
  const m = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!m) return null
  const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
  return Number.isFinite(sec) && sec > 0 ? sec : null
}

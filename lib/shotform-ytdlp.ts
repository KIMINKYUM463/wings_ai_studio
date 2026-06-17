import { spawn } from "child_process"

const YT_DLP_BIN = (process.env.YT_DLP_BIN || process.env.YT_DLP_PATH || "yt-dlp").trim()

function runYtDlp(args: string[], timeoutMs = 120_000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP_BIN, args, { windowsHide: true })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      proc.kill("SIGTERM")
      reject(new Error("yt-dlp 실행 시간 초과"))
    }, timeoutMs)

    proc.stdout.on("data", (d) => {
      stdout += String(d)
    })
    proc.stderr.on("data", (d) => {
      stderr += String(d)
    })
    proc.on("error", (e) => {
      clearTimeout(timer)
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("yt-dlp를 찾을 수 없습니다."))
      } else {
        reject(e)
      }
    })
    proc.on("close", (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, code: code ?? 1 })
    })
  })
}

let ytDlpAvailableCache: boolean | null = null

/** 서버에 yt-dlp 바이너리가 있는지 (로컬 dev·워커) */
export async function isYtDlpAvailable(): Promise<boolean> {
  if (ytDlpAvailableCache != null) return ytDlpAvailableCache
  try {
    const { code } = await runYtDlp(["--version"], 8_000)
    ytDlpAvailableCache = code === 0
  } catch {
    ytDlpAvailableCache = false
  }
  return ytDlpAvailableCache
}

/** YouTube·TikTok 페이지 URL → 직접 재생 URL + 제목 */
export async function resolveMediaUrlWithYtDlp(
  pageUrl: string
): Promise<{ videoUrl: string; title: string } | null> {
  const url = pageUrl.trim()
  if (!url.startsWith("http")) return null

  const format = "18/best[ext=mp4]/best[ext=mp4]/best"
  const { stdout, stderr, code } = await runYtDlp(
    ["--no-warnings", "--no-update", "-f", format, "--print", "%(title)s", "--print", "%(url)s", url],
    180_000
  )
  if (code !== 0) {
    const hint = (stderr || stdout).trim().slice(0, 240)
    throw new Error(hint || "yt-dlp 영상 URL 조회 실패")
  }

  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const videoUrl = lines.find((l) => l.startsWith("http")) || ""
  const title = lines.find((l) => !l.startsWith("http")) || ""
  if (!videoUrl.startsWith("http")) return null
  return { videoUrl, title: title.slice(0, 200) || "(영상)" }
}

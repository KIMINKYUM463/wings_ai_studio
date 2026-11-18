import { spawn } from "child_process"
import fs from "fs"
import path from "path"
import { ADAM_KIT_DIRNAME, ADAM_SERVER_HINT } from "@/lib/adam-tts"

const BOOT_WINDOW_MS = 10 * 60 * 1000

export function adamKitDir(): string {
  return path.join(process.cwd(), ADAM_KIT_DIRNAME)
}

/** 포트가 닫혀 있으면 키트 폴더에서 server.py를 한 번 띄운다. */
export function bootAdamServer(): "missing" | "booting" | "started" {
  const dir = adamKitDir()
  const script = path.join(dir, "server.py")
  if (!fs.existsSync(script)) return "missing"

  const lock = path.join(dir, ".booting")
  if (fs.existsSync(lock)) {
    const age = Date.now() - fs.statSync(lock).mtimeMs
    if (age < BOOT_WINDOW_MS) return "booting"
  }
  fs.writeFileSync(lock, new Date().toISOString(), "utf8")

  const logFd = fs.openSync(path.join(dir, "server.log"), "a")
  const bundled =
    process.platform === "win32"
      ? "C:\\Users\\a\\AppData\\Local\\Programs\\Python\\Python311\\python.exe"
      : ""
  const python =
    process.env.ADAM_PYTHON || (bundled && fs.existsSync(bundled) ? bundled : "python")
  const child = spawn(python, ["server.py"], {
    cwd: dir,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", logFd, logFd],
  })
  child.unref()
  return "started"
}

export function adamOfflineMessage(): string {
  const dir = adamKitDir()
  const boot = bootAdamServer()
  if (boot === "missing") {
    return `${ADAM_SERVER_HINT} 키트 폴더가 없습니다: ${dir}`
  }
  return `아담 서버를 켜는 중입니다. 처음에는 목소리 모델(약 2.5GB)을 받아서 1~3분 걸립니다. 잠시 뒤 미리듣기를 다시 누르세요. GPU가 없으면 CPU로 읽어서 느립니다. 폴더: ${dir}`
}

import { spawn } from "child_process"
import fs from "fs"
import path from "path"

const DEFAULT_PORT = Number(process.env.SHOTFORM_LOCAL_AGENT_PORT || 3847)

export function localAgentScriptPath(): string {
  return path.join(process.cwd(), "scripts", "shotform-local-agent.mjs")
}

export async function probeLocalAgentHealth(
  port = DEFAULT_PORT
): Promise<{ ok: boolean; ffmpeg?: boolean; defaultWorkDir?: string }> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    })
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      ffmpeg?: boolean
      defaultWorkDir?: string
    }
    if (!res.ok) return { ok: false }
    return {
      ok: Boolean(json.ok),
      ffmpeg: json.ffmpeg,
      defaultWorkDir: json.defaultWorkDir,
    }
  } catch {
    return { ok: false }
  }
}

export function spawnLocalAgentDetached(): { started: boolean; reason?: string } {
  if (process.env.VERCEL) {
    return { started: false, reason: "Vercel 환경에서는 에이전트를 시작할 수 없습니다." }
  }
  const script = localAgentScriptPath()
  if (!fs.existsSync(script)) {
    return { started: false, reason: `에이전트 스크립트를 찾지 못했습니다: ${script}` }
  }
  const child = spawn(process.execPath, [script], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
    windowsHide: true,
    env: { ...process.env },
  })
  child.unref()
  return { started: true }
}

/**
 * 터미널 창을 띄워 `npm run shotform:local-agent` 실행.
 * (로컬 Next가 이 PC에서 돌 때만 가능)
 */
export function spawnLocalAgentInTerminal(): { started: boolean; reason?: string } {
  if (process.env.VERCEL) {
    return { started: false, reason: "배포 서버에서는 사용자 PC 터미널을 열 수 없습니다." }
  }
  const cwd = process.cwd()
  const script = localAgentScriptPath()
  if (!fs.existsSync(script)) {
    return { started: false, reason: `에이전트 스크립트를 찾지 못했습니다: ${script}` }
  }

  try {
    if (process.platform === "win32") {
      // 새 cmd 창에서 npm run shotform:local-agent (창 유지)
      const child = spawn(
        "cmd.exe",
        [
          "/c",
          "start",
          "ShotForm Local Agent",
          "cmd.exe",
          "/k",
          "npm run shotform:local-agent",
        ],
        {
          cwd,
          detached: true,
          stdio: "ignore",
          windowsHide: false,
          env: { ...process.env },
        }
      )
      child.unref()
      return { started: true }
    }

    if (process.platform === "darwin") {
      const escaped = cwd.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      const child = spawn(
        "osascript",
        [
          "-e",
          `tell application "Terminal" to do script "cd \\"${escaped}\\" && npm run shotform:local-agent"`,
        ],
        { detached: true, stdio: "ignore", env: { ...process.env } }
      )
      child.unref()
      return { started: true }
    }

    // Linux — 가능하면 터미널 에뮬레이터, 없으면 백그라운드
    const child = spawn(
      "x-terminal-emulator",
      ["-e", "bash", "-lc", `cd "${cwd}" && npm run shotform:local-agent; exec bash`],
      { detached: true, stdio: "ignore", env: { ...process.env } }
    )
    child.on("error", () => {
      spawnLocalAgentDetached()
    })
    child.unref()
    return { started: true }
  } catch (e) {
    const fallback = spawnLocalAgentDetached()
    if (fallback.started) return fallback
    return {
      started: false,
      reason: e instanceof Error ? e.message : "터미널 실행 실패",
    }
  }
}

export function installAgentScriptPath(): string {
  return path.join(process.cwd(), "scripts", "install-shotform-agent-windows.ps1")
}

/**
 * `npm run shotform:install-agent` 와 동일 — Windows 프로토콜·시작프로그램 등록 + 에이전트 기동.
 * (이 PC에서 Next가 돌 때만 가능. Vercel 배포 서버에서는 불가)
 */
export function runInstallShotformAgentWindows(): Promise<{
  ok: boolean
  reason?: string
  stdout?: string
  stderr?: string
}> {
  if (process.env.VERCEL) {
    return Promise.resolve({
      ok: false,
      reason:
        "배포 서버에서는 PC 설치를 실행할 수 없습니다. 이 PC에서 로컬로 앱을 켠 뒤 「연결」을 누르거나, shotform-agent:// 가 등록돼 있어야 합니다.",
    })
  }
  if (process.platform !== "win32") {
    // Windows 외: 설치 스크립트 대신 에이전트만 기동
    const spawned = spawnLocalAgentDetached()
    return Promise.resolve(
      spawned.started
        ? { ok: true, stdout: "에이전트를 시작했습니다. (Windows 설치 스크립트는 건너뜀)" }
        : { ok: false, reason: spawned.reason }
    )
  }

  const ps1 = installAgentScriptPath()
  if (!fs.existsSync(ps1)) {
    return Promise.resolve({ ok: false, reason: `설치 스크립트 없음: ${ps1}` })
  }

  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1],
      {
        cwd: process.cwd(),
        windowsHide: true,
        env: { ...process.env },
      }
    )
    let stdout = ""
    let stderr = ""
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8")
    })
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8")
    })
    child.on("error", (err) => {
      resolve({ ok: false, reason: err.message, stdout, stderr })
    })
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, stdout, stderr })
        return
      }
      resolve({
        ok: false,
        reason: stderr.trim() || stdout.trim() || `설치 스크립트 종료 코드 ${code}`,
        stdout,
        stderr,
      })
    })
  })
}

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

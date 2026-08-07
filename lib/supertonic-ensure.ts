import { spawn } from "child_process"
import fs from "fs"
import path from "path"
import { getSupertonicBaseUrl } from "@/lib/supertonic-local"

export type SupertonicEnsurePhase =
  | "idle"
  | "checking"
  | "installing"
  | "starting"
  | "ready"
  | "error"

export type SupertonicEnsureStatus = {
  phase: SupertonicEnsurePhase
  message: string
  updatedAt: number
  pid?: number
  baseUrl?: string
  model?: string
  installed?: boolean
  online?: boolean
  health?: Record<string, unknown>
  logTail?: string
}

const STATUS_REL = path.join(".tmp", "supertonic-ensure-status.json")

export function supertonicEnsureStatusPath(): string {
  return path.join(process.cwd(), STATUS_REL)
}

export function ensureSupertonicScriptPath(): string {
  return path.join(process.cwd(), "scripts", "ensure-supertonic.mjs")
}

export function readSupertonicEnsureStatus(): SupertonicEnsureStatus | null {
  try {
    const raw = fs.readFileSync(supertonicEnsureStatusPath(), "utf8")
    const data = JSON.parse(raw) as SupertonicEnsureStatus
    if (!data || typeof data.phase !== "string") return null
    return data
  } catch {
    return null
  }
}

export function isSupertonicEnsureBusy(status: SupertonicEnsureStatus | null): boolean {
  if (!status) return false
  if (!["checking", "installing", "starting"].includes(status.phase)) return false
  // 상태가 오래 멈춘 경우(프로세스 사망) 재시도 허용
  const age = Date.now() - (status.updatedAt || 0)
  return age < 15 * 60 * 1000
}

export async function probeSupertonicHealth(
  baseUrl = getSupertonicBaseUrl()
): Promise<{ online: boolean; model?: string; baseUrl: string; raw?: Record<string, unknown> }> {
  const base = baseUrl.replace(/\/$/, "")
  try {
    const res = await fetch(`${base}/v1/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) return { online: false, baseUrl: base, raw: data }
    return {
      online: true,
      baseUrl: base,
      model: typeof data.model === "string" ? data.model : undefined,
      raw: data,
    }
  } catch {
    return { online: false, baseUrl: base }
  }
}

/** ensure 스크립트를 백그라운드로 기동 (이미 busy면 스킵) */
export function spawnSupertonicEnsureDetached(): { started: boolean; reason?: string } {
  if (process.env.VERCEL) {
    return {
      started: false,
      reason:
        "배포 서버에서는 Supertonic을 설치·기동할 수 없습니다. 로컬(`npm run dev`)에서 사용하거나 GPU 서버 URL을 SUPERTONIC_BASE_URL로 설정하세요.",
    }
  }
  const script = ensureSupertonicScriptPath()
  if (!fs.existsSync(script)) {
    return { started: false, reason: `스크립트를 찾지 못했습니다: ${script}` }
  }

  const busy = isSupertonicEnsureBusy(readSupertonicEnsureStatus())
  if (busy) {
    return { started: true, reason: "already-running" }
  }

  fs.mkdirSync(path.dirname(supertonicEnsureStatusPath()), { recursive: true })
  fs.writeFileSync(
    supertonicEnsureStatusPath(),
    JSON.stringify(
      {
        phase: "checking",
        message: "Supertonic 자동 설치·기동을 시작합니다…",
        updatedAt: Date.now(),
        online: false,
      } satisfies SupertonicEnsureStatus,
      null,
      2
    ),
    "utf8"
  )

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

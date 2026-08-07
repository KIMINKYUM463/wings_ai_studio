/** 브라우저에서 Supertonic 3 자동 설치·기동을 요청하고 완료까지 폴링 */

import {
  connectLocalAgent,
  resolveLocalCompanionUrl,
} from "@/lib/shotform-local-companion-client"
import { isBrowserOnDeployedHost } from "@/lib/supertonic-runtime-client"

export type SupertonicEnsureClientStatus = {
  success?: boolean
  phase?: string
  message?: string
  online?: boolean
  busy?: boolean
  installed?: boolean
  baseUrl?: string
  model?: string
  error?: string
}

async function ensureViaNextApi(opts?: {
  onProgress?: (status: SupertonicEnsureClientStatus) => void
  timeoutMs?: number
  pollMs?: number
}): Promise<SupertonicEnsureClientStatus> {
  const timeoutMs = opts?.timeoutMs ?? 12 * 60 * 1000
  const pollMs = opts?.pollMs ?? 2000
  const onProgress = opts?.onProgress

  const startRes = await fetch("/api/supertonic-ensure", { method: "POST" })
  const start = (await startRes.json().catch(() => ({}))) as SupertonicEnsureClientStatus
  onProgress?.(start)

  if (start.online || start.phase === "ready") {
    return { ...start, online: true, phase: "ready" }
  }
  if (!startRes.ok && start.phase === "error") {
    return start
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs))
    const res = await fetch("/api/supertonic-ensure", { cache: "no-store" })
    const status = (await res.json().catch(() => ({}))) as SupertonicEnsureClientStatus
    onProgress?.(status)

    if (status.online || status.phase === "ready") {
      return { ...status, online: true, phase: "ready" }
    }
    if (status.phase === "error") {
      return status
    }
  }

  const timedOut: SupertonicEnsureClientStatus = {
    success: false,
    phase: "error",
    online: false,
    message:
      "시간이 초과되었습니다. Python/네트워크를 확인한 뒤 다시 시도하거나, 터미널에서 `supertonic serve --host 127.0.0.1 --port 7788 --model supertonic-3` 를 실행하세요.",
  }
  onProgress?.(timedOut)
  return timedOut
}

async function ensureViaLocalAgent(opts?: {
  onProgress?: (status: SupertonicEnsureClientStatus) => void
  timeoutMs?: number
  pollMs?: number
}): Promise<SupertonicEnsureClientStatus> {
  const timeoutMs = opts?.timeoutMs ?? 12 * 60 * 1000
  const pollMs = opts?.pollMs ?? 2000
  const onProgress = opts?.onProgress
  const base = resolveLocalCompanionUrl().replace(/\/$/, "")

  onProgress?.({
    phase: "checking",
    message: "로컬 에이전트 연결 중… (터미널에서 npm run shotform:local-agent)",
  })
  const agent = await connectLocalAgent({
    requireFfmpeg: false,
    onProgress: (m) => onProgress?.({ phase: "checking", message: m }),
  })
  if (!agent.ok) {
    const fail: SupertonicEnsureClientStatus = {
      success: false,
      phase: "error",
      online: false,
      error: agent.error,
      message:
        agent.error ||
        "로컬 에이전트가 필요합니다. 쿠팡 수집기의 「에이전트 연결」을 먼저 실행해 주세요.",
    }
    onProgress?.(fail)
    return fail
  }

  onProgress?.({
    phase: "installing",
    message: "이 PC에 Supertonic 3 설치·기동 중… (최초 1회는 수 분 소요)",
  })
  try {
    const startRes = await fetch(`${base}/supertonic/ensure`, { method: "POST" })
    const start = (await startRes.json().catch(() => ({}))) as SupertonicEnsureClientStatus
    onProgress?.(start)
    if (start.online || start.phase === "ready") {
      return { ...start, online: true, phase: "ready", success: true }
    }
  } catch (e) {
    const fail: SupertonicEnsureClientStatus = {
      success: false,
      phase: "error",
      online: false,
      message: e instanceof Error ? e.message : "ensure 요청 실패",
    }
    onProgress?.(fail)
    return fail
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs))
    try {
      const res = await fetch(`${base}/supertonic/status`, { cache: "no-store" })
      const status = (await res.json().catch(() => ({}))) as SupertonicEnsureClientStatus
      onProgress?.(status)
      if (status.online || status.phase === "ready") {
        return { ...status, online: true, phase: "ready", success: true }
      }
      if (status.phase === "error") return status
    } catch {
      /* retry */
    }
  }

  const timedOut: SupertonicEnsureClientStatus = {
    success: false,
    phase: "error",
    online: false,
    message:
      "시간이 초과되었습니다. Python·네트워크를 확인한 뒤 다시 「설치·서버 자동 연결」을 눌러 주세요.",
  }
  onProgress?.(timedOut)
  return timedOut
}

/**
 * Supertonic 3 준비.
 * - localhost Next: 서버 API로 이 PC에 설치·기동 (기존과 동일)
 * - 배포 사이트: 사용자 PC 로컬 에이전트 → ensure-supertonic (Win/Mac)
 */
export async function ensureSupertonicReady(opts?: {
  onProgress?: (status: SupertonicEnsureClientStatus) => void
  timeoutMs?: number
  pollMs?: number
  /** 테스트용 — 배포 호스트에서도 Next API 강제 */
  preferCompanion?: boolean
}): Promise<SupertonicEnsureClientStatus> {
  const useCompanion =
    opts?.preferCompanion === true ||
    (opts?.preferCompanion !== false && isBrowserOnDeployedHost())

  if (useCompanion) {
    return ensureViaLocalAgent(opts)
  }
  return ensureViaNextApi(opts)
}

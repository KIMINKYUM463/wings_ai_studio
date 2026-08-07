import { NextResponse } from "next/server"
import {
  isSupertonicEnsureBusy,
  probeSupertonicHealth,
  readSupertonicEnsureStatus,
  spawnSupertonicEnsureDetached,
  type SupertonicEnsureStatus,
} from "@/lib/supertonic-ensure"
import { getSupertonicBaseUrl } from "@/lib/supertonic-local"

function mergeLive(
  status: SupertonicEnsureStatus | null,
  health: Awaited<ReturnType<typeof probeSupertonicHealth>>
): SupertonicEnsureStatus {
  if (health.online) {
    return {
      phase: "ready",
      message: `연결됨 · ${health.model || "supertonic-3"} · ${health.baseUrl}`,
      updatedAt: Date.now(),
      installed: true,
      online: true,
      baseUrl: health.baseUrl,
      model: health.model,
      health: health.raw,
      pid: status?.pid,
    }
  }
  return (
    status || {
      phase: "idle",
      message: "아직 시작되지 않았습니다.",
      updatedAt: Date.now(),
      online: false,
      baseUrl: getSupertonicBaseUrl(),
    }
  )
}

/** GET — 설치/기동 진행 상태 + 실시간 health */
export async function GET() {
  const health = await probeSupertonicHealth()
  const status = mergeLive(readSupertonicEnsureStatus(), health)
  return NextResponse.json({
    success: true,
    busy: isSupertonicEnsureBusy(status) && !health.online,
    ...status,
  })
}

/**
 * POST — PC에 Supertonic 3가 없으면 설치하고, 서버가 꺼져 있으면 자동 기동
 * (로컬 Next 서버에서만 동작. Vercel 등에서는 403)
 */
export async function POST() {
  if (process.env.VERCEL) {
    return NextResponse.json(
      {
        success: false,
        phase: "error",
        message:
          "배포 서버에서는 Supertonic을 자동 설치할 수 없습니다. 로컬 개발 환경에서 사용하세요.",
        online: false,
      },
      { status: 403 }
    )
  }

  const health = await probeSupertonicHealth()
  if (health.online) {
    return NextResponse.json({
      success: true,
      phase: "ready",
      message: `이미 실행 중 · ${health.model || "supertonic-3"} · ${health.baseUrl}`,
      online: true,
      installed: true,
      alreadyRunning: true,
      baseUrl: health.baseUrl,
      model: health.model,
      updatedAt: Date.now(),
    })
  }

  const existing = readSupertonicEnsureStatus()
  if (isSupertonicEnsureBusy(existing)) {
    return NextResponse.json({
      success: true,
      busy: true,
      alreadyStarted: true,
      ...existing,
      online: false,
    })
  }

  const spawned = spawnSupertonicEnsureDetached()
  if (!spawned.started) {
    return NextResponse.json(
      {
        success: false,
        phase: "error",
        message: spawned.reason || "자동 설치·기동을 시작하지 못했습니다.",
        online: false,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    busy: true,
    phase: "checking",
    message:
      spawned.reason === "already-running"
        ? "이미 설치·기동이 진행 중입니다…"
        : "Supertonic 확인 → 필요 시 설치 → 서버 기동을 시작했습니다…",
    online: false,
    updatedAt: Date.now(),
    baseUrl: getSupertonicBaseUrl(),
  })
}

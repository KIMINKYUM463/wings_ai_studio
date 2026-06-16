import { NextResponse } from "next/server"
import {
  probeLocalAgentHealth,
  spawnLocalAgentDetached,
} from "@/lib/shotform-local-agent-spawn"

/** POST — 로컬 dev 서버에서 ShotForm 로컬 에이전트 자동 기동 */
export async function POST() {
  if (process.env.VERCEL) {
    return NextResponse.json(
      {
        error:
          "배포 서버에서는 에이전트를 직접 시작할 수 없습니다. npm run shotform:install-agent 로 PC에 등록하세요.",
      },
      { status: 403 }
    )
  }

  const existing = await probeLocalAgentHealth()
  if (existing.ok) {
    return NextResponse.json({ ok: true, alreadyRunning: true, ...existing })
  }

  const spawned = spawnLocalAgentDetached()
  if (!spawned.started) {
    return NextResponse.json({ error: spawned.reason || "에이전트 시작 실패" }, { status: 500 })
  }

  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 400))
    const health = await probeLocalAgentHealth()
    if (health.ok) {
      return NextResponse.json({ ok: true, started: true, ...health })
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: "에이전트 프로세스는 시작했지만 응답이 없습니다. 방화벽·포트 3847을 확인해 주세요.",
    },
    { status: 504 }
  )
}

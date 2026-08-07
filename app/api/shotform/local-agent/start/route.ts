import { NextRequest, NextResponse } from "next/server"
import {
  probeLocalAgentHealth,
  spawnLocalAgentDetached,
  spawnLocalAgentInTerminal,
} from "@/lib/shotform-local-agent-spawn"

/**
 * POST — 로컬에서 `npm run shotform:local-agent` 실행.
 * body: { openTerminal?: boolean } 기본 true → 터미널 창 표시
 */
export async function POST(request: NextRequest) {
  if (process.env.VERCEL) {
    return NextResponse.json(
      {
        ok: false,
        useProtocol: true,
        error:
          "배포 서버에서는 터미널을 열 수 없습니다. PC에 에이전트가 등록돼 있으면 shotform-agent:// 로 연결을 시도하세요.",
      },
      { status: 403 }
    )
  }

  let openTerminal = true
  try {
    const body = (await request.json().catch(() => ({}))) as { openTerminal?: boolean }
    if (typeof body.openTerminal === "boolean") openTerminal = body.openTerminal
  } catch {
    /* empty body */
  }

  const existing = await probeLocalAgentHealth()
  if (existing.ok) {
    return NextResponse.json({
      ok: true,
      alreadyRunning: true,
      message: "로컬 에이전트가 이미 실행 중입니다. (http://127.0.0.1:3847)",
      ...existing,
    })
  }

  const spawned = openTerminal ? spawnLocalAgentInTerminal() : spawnLocalAgentDetached()
  if (!spawned.started) {
    return NextResponse.json(
      { ok: false, error: spawned.reason || "에이전트 시작 실패" },
      { status: 500 }
    )
  }

  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 500))
    const health = await probeLocalAgentHealth()
    if (health.ok) {
      return NextResponse.json({
        ok: true,
        started: true,
        openTerminal,
        message: openTerminal
          ? "터미널에서 npm run shotform:local-agent 를 실행했고 연결됐습니다."
          : "로컬 에이전트를 시작했습니다.",
        ...health,
      })
    }
  }

  return NextResponse.json(
    {
      ok: false,
      started: true,
      openTerminal,
      error:
        "터미널에서 에이전트를 시작했습니다. 아직 http://127.0.0.1:3847 응답이 없습니다. 터미널 창 오류를 확인해 주세요.",
    },
    { status: 504 }
  )
}

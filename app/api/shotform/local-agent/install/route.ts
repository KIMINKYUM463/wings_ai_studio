import { NextResponse } from "next/server"
import {
  probeLocalAgentHealth,
  runInstallShotformAgentWindows,
  spawnLocalAgentDetached,
} from "@/lib/shotform-local-agent-spawn"

/**
 * POST — `npm run shotform:install-agent` 와 동일 작업 후 헬스 확인.
 * 로컬 Next(사용자 PC)에서만 동작. Vercel에서는 403.
 */
export async function POST() {
  if (process.env.VERCEL) {
    return NextResponse.json(
      {
        ok: false,
        useProtocol: true,
        error:
          "배포 서버에서는 설치를 대신 실행할 수 없습니다. 브라우저가 shotform-agent:// 로 PC 에이전트를 켭니다.",
      },
      { status: 403 }
    )
  }

  const installed = await runInstallShotformAgentWindows()
  if (!installed.ok) {
    // 설치 실패 시라도 이미 스크립트가 있으면 기동만 시도
    spawnLocalAgentDetached()
  }

  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 400))
    const health = await probeLocalAgentHealth()
    if (health.ok) {
      return NextResponse.json({
        ok: true,
        installed: installed.ok,
        started: true,
        ...health,
        message: installed.ok
          ? "로컬 에이전트 설치·연결 완료"
          : "에이전트는 연결됐지만 설치 스크립트에 경고가 있었습니다.",
        installWarning: installed.ok ? undefined : installed.reason,
      })
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error:
        installed.reason ||
        "설치는 시도했지만 에이전트(http://127.0.0.1:3847)에 연결되지 않았습니다. Node.js 설치와 방화벽을 확인해 주세요.",
      stdout: installed.stdout,
      stderr: installed.stderr,
    },
    { status: 504 }
  )
}

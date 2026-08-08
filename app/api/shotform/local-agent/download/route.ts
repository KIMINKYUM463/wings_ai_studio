import fs from "fs"
import path from "path"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function resolveOrigin(req: Request): string {
  const url = new URL(req.url)
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (url.protocol === "http:" ? "http" : "https")
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host
  return `${proto}://${host}`.replace(/\/$/, "")
}

/** 배포·다른 PC에서 더블클릭 한 번으로 에이전트 기동 */
function buildStarterCmd(origin: string): string {
  const agentUrl = `${origin}/api/shotform/local-agent/download?file=agent`
  return [
    "@echo off",
    "chcp 65001 >nul",
    "title ShotForm Local Agent",
    "setlocal EnableExtensions",
    'set "DIR=%LOCALAPPDATA%\\ShotForm\\local-agent"',
    'set "AGENT=%DIR%\\shotform-local-agent-portable.mjs"',
    `set "AGENT_URL=${agentUrl}"`,
    "echo.",
    "echo ========================================",
    "echo   ShotForm 로컬 에이전트 (원클릭)",
    "echo ========================================",
    "echo.",
    "where node >nul 2>nul",
    "if errorlevel 1 (",
    "  echo [오류] Node.js가 없습니다.",
    "  echo https://nodejs.org 에서 LTS 설치 후 이 파일을 다시 더블클릭하세요.",
    "  echo.",
    '  start "" "https://nodejs.org/en/download"',
    "  pause",
    "  exit /b 1",
    ")",
    'if not exist "%DIR%" mkdir "%DIR%"',
    'cd /d "%DIR%"',
    "echo 에이전트 파일을 받는 중...",
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri \'%AGENT_URL%\' -OutFile \'%AGENT%\'"',
    "if errorlevel 1 (",
    "  echo 다운로드 실패. 인터넷/방화벽을 확인하세요.",
    "  echo URL: %AGENT_URL%",
    "  pause",
    "  exit /b 1",
    ")",
    "echo 브라우저 원클릭용 프로토콜 등록 중...",
    'for /f "delims=" %%N in (\'where node\') do set "NODE_EXE=%%N"',
    'reg add "HKCU\\Software\\Classes\\shotform-agent" /ve /d "URL:ShotForm Local Agent" /f >nul 2>&1',
    'reg add "HKCU\\Software\\Classes\\shotform-agent" /v "URL Protocol" /d "" /f >nul 2>&1',
    'reg add "HKCU\\Software\\Classes\\shotform-agent\\shell\\open\\command" /ve /d "\\"%NODE_EXE%\\" \\"%AGENT%\\"" /f >nul 2>&1',
    "echo.",
    "echo 에이전트를 시작합니다. 이 창을 닫지 마세요.",
    "echo Wings 숏폼으로 돌아가 「에이전트 연결」을 다시 누르면 연결됩니다.",
    "echo.",
    'node "%AGENT%"',
    "echo.",
    "echo 에이전트가 종료되었습니다.",
    "pause",
    "",
  ].join("\r\n")
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const file = (searchParams.get("file") || "cmd").toLowerCase()
  const origin = resolveOrigin(req)

  if (file === "agent" || file === "mjs") {
    const agentPath = path.join(
      process.cwd(),
      "scripts",
      "shotform-local-agent-portable.mjs"
    )
    if (!fs.existsSync(agentPath)) {
      return NextResponse.json(
        { error: "포터블 에이전트 파일이 배포물에 없습니다." },
        { status: 404 }
      )
    }
    const body = fs.readFileSync(agentPath, "utf8")
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Content-Disposition": 'attachment; filename="shotform-local-agent-portable.mjs"',
        "Cache-Control": "no-store",
      },
    })
  }

  const cmd = buildStarterCmd(origin)
  return new NextResponse(cmd, {
    status: 200,
    headers: {
      "Content-Type": "application/x-bat; charset=utf-8",
      "Content-Disposition": 'attachment; filename="start-shotform-agent.cmd"',
      "Cache-Control": "no-store",
    },
  })
}

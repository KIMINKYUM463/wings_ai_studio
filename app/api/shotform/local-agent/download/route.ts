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

/**
 * Windows cmd.exe + Korean UTF-8 breaks batch parsing.
 * Keep this file ASCII-only. No parentheses blocks.
 * Collector extension is NOT required — protocol shotform-agent:// opens a visible cmd.
 */
function buildStarterCmd(origin: string): string {
  const agentUrl = `${origin}/api/shotform/local-agent/download?file=agent`
  const lines = [
    "@echo off",
    "setlocal EnableExtensions",
    "title ShotForm Local Agent",
    'set "DIR=%LOCALAPPDATA%\\ShotForm\\local-agent"',
    'set "AGENT=%DIR%\\shotform-local-agent-portable.mjs"',
    `set "AGENT_URL=${agentUrl}"`,
    "echo.",
    "echo ========================================",
    "echo   ShotForm Local Agent",
    "echo ========================================",
    "echo.",
    "where node >nul 2>nul",
    "if errorlevel 1 goto NoNode",
    'if not exist "%DIR%" mkdir "%DIR%"',
    'cd /d "%DIR%"',
    "echo Downloading agent script...",
    'curl.exe -L --fail -o "%AGENT%" "%AGENT_URL%" 2>nul',
    "if errorlevel 1 goto TryPs",
    "goto Register",
    ":TryPs",
    "echo curl failed, trying PowerShell...",
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri '%AGENT_URL%' -OutFile '%AGENT%'"`,
    "if errorlevel 1 goto DlFail",
    ":Register",
    'if not exist "%AGENT%" goto DlFail',
    "echo Registering shotform-agent:// protocol...",
    'reg add "HKCU\\Software\\Classes\\shotform-agent" /ve /d "URL:ShotForm Local Agent" /f >nul 2>&1',
    'reg add "HKCU\\Software\\Classes\\shotform-agent" /v "URL Protocol" /d "" /f >nul 2>&1',
    // Visible console — Wings button uses this protocol (no collector needed)
    'reg add "HKCU\\Software\\Classes\\shotform-agent\\shell\\open\\command" /ve /d "cmd.exe /c start \\"ShotForm Local Agent\\" cmd.exe /k node \\"%AGENT%\\"" /f >nul 2>&1',
    "echo.",
    "echo Starting agent. Keep this window open.",
    "echo Next time: Wings button opens this via shotform-agent://",
    "echo.",
    'node "%AGENT%"',
    "echo.",
    "echo Agent stopped.",
    "pause",
    "exit /b 0",
    ":NoNode",
    "echo [ERROR] Node.js not found in PATH.",
    "echo Install Node.js LTS, then run this file again:",
    "echo https://nodejs.org/en/download",
    'start "" "https://nodejs.org/en/download"',
    "pause",
    "exit /b 1",
    ":DlFail",
    "echo [ERROR] Failed to download agent script.",
    "echo URL: %AGENT_URL%",
    "pause",
    "exit /b 1",
    "",
  ]
  return lines.join("\r\n")
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
      "Content-Type": "application/x-bat; charset=us-ascii",
      "Content-Disposition": 'attachment; filename="start-shotform-agent.cmd"',
      "Cache-Control": "no-store",
    },
  })
}

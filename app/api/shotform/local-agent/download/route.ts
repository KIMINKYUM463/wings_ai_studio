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
 * Finds node.exe in PATH and common install folders.
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
    'set "NODE_EXE="',
    "echo.",
    "echo ========================================",
    "echo   ShotForm Local Agent",
    "echo ========================================",
    "echo.",
    "echo Looking for Node.js...",
    // PATH
    'for /f "delims=" %%N in (\'where node 2^>nul\') do if not defined NODE_EXE set "NODE_EXE=%%N"',
    // Common install locations (no PATH yet / installer not refreshed)
    'if not defined NODE_EXE if exist "%ProgramFiles%\\nodejs\\node.exe" set "NODE_EXE=%ProgramFiles%\\nodejs\\node.exe"',
    'if not defined NODE_EXE if exist "%ProgramFiles(x86)%\\nodejs\\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\\nodejs\\node.exe"',
    'if not defined NODE_EXE if exist "%LOCALAPPDATA%\\Programs\\node\\node.exe" set "NODE_EXE=%LOCALAPPDATA%\\Programs\\node\\node.exe"',
    'if not defined NODE_EXE if exist "%APPDATA%\\nvm\\nodejs\\node.exe" set "NODE_EXE=%APPDATA%\\nvm\\nodejs\\node.exe"',
    'if not defined NODE_EXE if exist "%LOCALAPPDATA%\\fnm_multishells\\node.exe" set "NODE_EXE=%LOCALAPPDATA%\\fnm_multishells\\node.exe"',
    "if not defined NODE_EXE goto NoNode",
    "echo Found: %NODE_EXE%",
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
    'reg add "HKCU\\Software\\Classes\\shotform-agent\\shell\\open\\command" /ve /d "cmd.exe /c start \\"ShotForm Local Agent\\" cmd.exe /k \\"%NODE_EXE%\\" \\"%AGENT%\\"" /f >nul 2>&1',
    "echo.",
    "echo Starting agent. Keep this window open.",
    "echo Next time: Wings button opens this via shotform-agent://",
    "echo.",
    '"%NODE_EXE%" "%AGENT%"',
    "echo.",
    "echo Agent stopped.",
    "pause",
    "exit /b 0",
    ":NoNode",
    "echo [ERROR] Node.js is not installed on this PC.",
    "echo.",
    "echo 1. Install Node.js LTS from the page that opens",
    "echo 2. Close ALL cmd/Chrome windows",
    "echo 3. Click Wings 「에이전트 실행」 again",
    "echo.",
    "echo Download: https://nodejs.org/en/download",
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

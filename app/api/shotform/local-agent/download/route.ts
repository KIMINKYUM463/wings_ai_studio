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
 * ASCII-only batch.
 * - Finds absolute node.exe (PATH + Program Files)
 * - Writes run-agent.cmd with full paths (never bare `node`)
 * - Registers shotform-agent:// to that runner
 */
function buildStarterCmd(origin: string): string {
  const agentUrl = `${origin}/api/shotform/local-agent/download?file=agent`
  const ensureUrl = `${origin}/api/shotform/local-agent/download?file=ensure-supertonic`
  const lines = [
    "@echo off",
    "setlocal EnableExtensions",
    "title ShotForm Local Agent",
    "REM Refresh PATH from registry (Explorer double-click often has stale PATH after Python install)",
    'set "SYSPATH="',
    'set "USRPATH="',
    'for /f "tokens=2*" %%A in (\'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path 2^>nul\') do set "SYSPATH=%%B"',
    'for /f "tokens=2*" %%A in (\'reg query "HKCU\\Environment" /v Path 2^>nul\') do set "USRPATH=%%B"',
    'if defined SYSPATH if defined USRPATH set "PATH=%SYSPATH%;%USRPATH%"',
    'if defined SYSPATH if not defined USRPATH set "PATH=%SYSPATH%"',
    'if not defined SYSPATH if defined USRPATH set "PATH=%USRPATH%;%PATH%"',
    'set "DIR=%LOCALAPPDATA%\\ShotForm\\local-agent"',
    'set "SHOTFORM_HOME=%LOCALAPPDATA%\\ShotForm"',
    'set "AGENT=%DIR%\\shotform-local-agent-portable.mjs"',
    'set "ENSURE=%SHOTFORM_HOME%\\scripts\\ensure-supertonic.mjs"',
    'set "RUNNER=%DIR%\\run-agent.cmd"',
    `set "AGENT_URL=${agentUrl}"`,
    `set "ENSURE_URL=${ensureUrl}"`,
    `set "SHOTFORM_ORIGIN=${origin}"`,
    'set "NODE_EXE="',
    "echo.",
    "echo ========================================",
    "echo   ShotForm Local Agent",
    "echo ========================================",
    "echo.",
    "echo Looking for Node.js...",
    'for /f "delims=" %%N in (\'where node 2^>nul\') do if not defined NODE_EXE set "NODE_EXE=%%N"',
    'if not defined NODE_EXE if exist "%ProgramFiles%\\nodejs\\node.exe" set "NODE_EXE=%ProgramFiles%\\nodejs\\node.exe"',
    'if not defined NODE_EXE if exist "%ProgramFiles(x86)%\\nodejs\\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\\nodejs\\node.exe"',
    'if not defined NODE_EXE if exist "%LOCALAPPDATA%\\Programs\\nodejs\\node.exe" set "NODE_EXE=%LOCALAPPDATA%\\Programs\\nodejs\\node.exe"',
    'if not defined NODE_EXE if exist "%LOCALAPPDATA%\\Programs\\node\\node.exe" set "NODE_EXE=%LOCALAPPDATA%\\Programs\\node\\node.exe"',
    "if not defined NODE_EXE goto NoNode",
    "echo Found: %NODE_EXE%",
    'if not exist "%DIR%" mkdir "%DIR%"',
    'if not exist "%SHOTFORM_HOME%\\scripts" mkdir "%SHOTFORM_HOME%\\scripts"',
    'cd /d "%DIR%"',
    "echo Downloading agent script...",
    'curl.exe -L --fail -o "%AGENT%" "%AGENT_URL%" 2>nul',
    "if errorlevel 1 goto TryPs",
    "goto DlEnsure",
    ":TryPs",
    "echo curl failed, trying PowerShell...",
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri '%AGENT_URL%' -OutFile '%AGENT%'"`,
    "if errorlevel 1 goto DlFail",
    ":DlEnsure",
    'if not exist "%AGENT%" goto DlFail',
    "echo Downloading Supertonic ensure script...",
    'curl.exe -L --fail -o "%ENSURE%" "%ENSURE_URL%" 2>nul',
    "if errorlevel 1 (",
    `  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri '%ENSURE_URL%' -OutFile '%ENSURE%'"`,
    ")",
    "echo Writing run-agent.cmd ...",
    'echo @echo off> "%RUNNER%"',
    'echo title ShotForm Local Agent>> "%RUNNER%"',
    `echo set "SHOTFORM_ORIGIN=${origin}">> "%RUNNER%"`,
    `echo set "SHOTFORM_ENSURE_URL=${ensureUrl}">> "%RUNNER%"',
    'echo "%NODE_EXE%" "%AGENT%">> "%RUNNER%"',
    'echo if errorlevel 1 pause>> "%RUNNER%"',
    'if not exist "%RUNNER%" goto DlFail',
    "echo Fixing shotform-agent:// protocol to use full Node path...",
    'reg add "HKCU\\Software\\Classes\\shotform-agent" /ve /d "URL:ShotForm Local Agent" /f >nul 2>&1',
    'reg add "HKCU\\Software\\Classes\\shotform-agent" /v "URL Protocol" /d "" /f >nul 2>&1',
    'reg add "HKCU\\Software\\Classes\\shotform-agent\\shell\\open\\command" /ve /d "cmd.exe /c start \\"ShotForm Local Agent\\" cmd.exe /k \\"%RUNNER%\\"" /f >nul 2>&1',
    "echo.",
    "echo Checking Python (needed for Supertonic)...",
    "where py >nul 2>&1 && echo Python launcher (py) found.",
    "where python >nul 2>&1 && echo python found.",
    "where py >nul 2>&1 || where python >nul 2>&1 || echo [WARN] Python not in PATH. Install Python 3 with Add to PATH before Supertonic auto-start.",
    "echo.",
    "echo Starting agent. Keep this window open.",
    "echo.",
    'call "%RUNNER%"',
    "echo.",
    "echo Agent stopped.",
    "pause",
    "exit /b 0",
    ":NoNode",
    "echo [ERROR] Node.js not found.",
    "echo 1. Install LTS: https://nodejs.org/en/download",
    "echo 2. CLOSE all Chrome windows completely",
    "echo 3. Run this start-shotform-agent.cmd again",
    'start "" "https://nodejs.org/en/download"',
    "pause",
    "exit /b 1",
    ":DlFail",
    "echo [ERROR] Failed to prepare agent files.",
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

  if (file === "ensure-supertonic" || file === "ensure") {
    const ensurePath = path.join(process.cwd(), "scripts", "ensure-supertonic.mjs")
    if (!fs.existsSync(ensurePath)) {
      return NextResponse.json(
        { error: "ensure-supertonic.mjs 가 배포물에 없습니다." },
        { status: 404 }
      )
    }
    const body = fs.readFileSync(ensurePath, "utf8")
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ensure-supertonic.mjs"',
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

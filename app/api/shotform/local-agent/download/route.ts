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

function detectOsFromRequest(req: Request, param: string | null): "win" | "mac" {
  const p = (param || "").toLowerCase()
  if (p === "mac" || p === "darwin" || p === "osx" || p === "macos") return "mac"
  if (p === "win" || p === "windows" || p === "win32") return "win"
  const ua = req.headers.get("user-agent") || ""
  if (/Macintosh|Mac OS X|iPhone|iPad|iPod/i.test(ua) && !/Windows NT/i.test(ua)) {
    return "mac"
  }
  return "win"
}

/**
 * ASCII-only batch with CRLF.
 * Non-ASCII (em dash etc.) breaks cmd.exe on Korean Windows (CP949),
 * which shows as 'ho', 'to', 'exist' "not recognized" errors.
 */
function buildStarterCmd(origin: string): string {
  const agentUrl = `${origin}/api/shotform/local-agent/download?file=agent`
  const ensureUrl = `${origin}/api/shotform/local-agent/download?file=ensure-supertonic`
  const curl = "%SystemRoot%\\System32\\curl.exe"
  const ps =
    "%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
  const lines = [
    "@echo off",
    "setlocal EnableExtensions",
    "title ShotForm Local Agent",
    "REM Prepend registry PATH for newly installed Python - never replace whole PATH",
    'set "SYSPATH="',
    'set "USRPATH="',
    `for /f "tokens=2*" %%A in ('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path 2^>nul') do set "SYSPATH=%%B"`,
    `for /f "tokens=2*" %%A in ('reg query "HKCU\\Environment" /v Path 2^>nul') do set "USRPATH=%%B"`,
    'if defined USRPATH set "PATH=%USRPATH%;%PATH%"',
    'if defined SYSPATH set "PATH=%SYSPATH%;%PATH%"',
    'set "PATH=%SystemRoot%\\System32;%SystemRoot%\\System32\\WindowsPowerShell\\v1.0;%PATH%"',
    'set "DIR=%LOCALAPPDATA%\\ShotForm\\local-agent"',
    'set "SHOTFORM_HOME=%LOCALAPPDATA%\\ShotForm"',
    'set "AGENT=%DIR%\\shotform-local-agent-portable.mjs"',
    'set "ENSURE=%SHOTFORM_HOME%\\scripts\\ensure-supertonic.mjs"',
    'set "RUNNER=%DIR%\\run-agent.cmd"',
    `set "AGENT_URL=${agentUrl}"`,
    `set "ENSURE_URL=${ensureUrl}"`,
    `set "SHOTFORM_ORIGIN=${origin}"`,
    `set "CURL=${curl}"`,
    `set "PS=${ps}"`,
    'set "NODE_EXE="',
    "echo.",
    "echo ========================================",
    "echo   ShotForm Local Agent",
    "echo ========================================",
    "echo.",
    "echo Looking for Node.js...",
    `for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"`,
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
    `"%CURL%" -L --fail -o "%AGENT%" "%AGENT_URL%"`,
    "if errorlevel 1 goto TryPs",
    "goto AfterAgentDl",
    ":TryPs",
    "echo curl failed, trying PowerShell...",
    `"%PS%" -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri '%AGENT_URL%' -OutFile '%AGENT%'"`,
    "if errorlevel 1 goto AgentDlSoft",
    "goto AfterAgentDl",
    ":AgentDlSoft",
    'if exist "%AGENT%" (',
    "  echo [WARN] Download failed - using existing agent file.",
    "  goto AfterAgentDl",
    ")",
    "goto DlFail",
    ":AfterAgentDl",
    'if not exist "%AGENT%" goto DlFail',
    "echo Downloading Supertonic ensure script...",
    `"%CURL%" -L --fail -o "%ENSURE%" "%ENSURE_URL%"`,
    "if errorlevel 1 (",
    `  "%PS%" -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri '%ENSURE_URL%' -OutFile '%ENSURE%'"`,
    ")",
    "echo Writing run-agent.cmd ...",
    'echo @echo off> "%RUNNER%"',
    'echo title ShotForm Local Agent>> "%RUNNER%"',
    `echo set "SHOTFORM_ORIGIN=${origin}">> "%RUNNER%"`,
    `echo set "SHOTFORM_ENSURE_URL=${ensureUrl}">> "%RUNNER%"`,
    'echo set "PATH=%%SystemRoot%%\\System32;%%SystemRoot%%\\System32\\WindowsPowerShell\\v1.0;%%PATH%%">> "%RUNNER%"',
    'echo echo Updating agent script...>> "%RUNNER%"',
    `echo "%CURL%" -L --fail -o "%AGENT%" "${agentUrl}">> "%RUNNER%"`,
    `echo if errorlevel 1 "%PS%" -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri '${agentUrl}' -OutFile '%AGENT%'">> "%RUNNER%"`,
    'echo if not exist "%AGENT%" (echo [ERROR] agent missing ^& pause ^& exit /b 1)>> "%RUNNER%"',
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
    "echo Tip: open the URL in Chrome, save the .mjs into:",
    "echo   %AGENT%",
    "echo then run this .cmd again.",
    "pause",
    "exit /b 1",
    "",
  ]
  const body = lines.join("\r\n")
  return body.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "-")
}

/** macOS .command — bash, Homebrew/system Node 탐색 */
function buildStarterCommandMac(origin: string): string {
  const agentUrl = `${origin}/api/shotform/local-agent/download?file=agent`
  const ensureUrl = `${origin}/api/shotform/local-agent/download?file=ensure-supertonic`
  // 줄 단위로 조립해 JS 템플릿의 $ 확장을 피함
  const lines = [
    "#!/bin/bash",
    "set -euo pipefail",
    'export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$PATH"',
    `ORIGIN=${JSON.stringify(origin)}`,
    `AGENT_URL=${JSON.stringify(agentUrl)}`,
    `ENSURE_URL=${JSON.stringify(ensureUrl)}`,
    'SHOTFORM_HOME="$HOME/Library/Application Support/ShotForm"',
    'DIR="$SHOTFORM_HOME/local-agent"',
    'AGENT="$DIR/shotform-local-agent-portable.mjs"',
    'ENSURE="$SHOTFORM_HOME/scripts/ensure-supertonic.mjs"',
    'RUNNER="$DIR/run-agent.sh"',
    'echo ""',
    'echo "========================================"',
    'echo "  ShotForm Local Agent (macOS)"',
    'echo "========================================"',
    'echo ""',
    "find_node() {",
    "  if command -v node >/dev/null 2>&1; then",
    "    command -v node",
    "    return 0",
    "  fi",
    "  for p in /opt/homebrew/bin/node /usr/local/bin/node; do",
    '    if [ -x "$p" ]; then',
    '      echo "$p"',
    "      return 0",
    "    fi",
    "  done",
    '  if [ -d "$HOME/.nvm/versions/node" ]; then',
    "    local latest",
    '    latest=$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1 || true)',
    '    if [ -n "${latest:-}" ] && [ -x "$HOME/.nvm/versions/node/$latest/bin/node" ]; then',
    '      echo "$HOME/.nvm/versions/node/$latest/bin/node"',
    "      return 0",
    "    fi",
    "  fi",
    "  return 1",
    "}",
    'echo "Looking for Node.js..."',
    'if ! NODE_EXE="$(find_node)"; then',
    '  echo "[ERROR] Node.js not found."',
    '  echo "1. Install LTS: https://nodejs.org/en/download"',
    '  echo "   or: brew install node"',
    '  echo "2. Re-run this start-shotform-agent.command"',
    '  open "https://nodejs.org/en/download" 2>/dev/null || true',
    '  read -r -p "Press Enter to close..."',
    "  exit 1",
    "fi",
    'echo "Found: $NODE_EXE"',
    'mkdir -p "$DIR" "$SHOTFORM_HOME/scripts"',
    'cd "$DIR"',
    'echo "Downloading agent script..."',
    'if ! curl -L --fail -o "$AGENT" "$AGENT_URL"; then',
    '  if [ ! -f "$AGENT" ]; then',
    '    echo "[ERROR] Failed to download agent."',
    '    echo "URL: $AGENT_URL"',
    '    read -r -p "Press Enter to close..."',
    "    exit 1",
    "  fi",
    '  echo "[WARN] Download failed - using existing agent file."',
    "fi",
    'echo "Downloading Supertonic ensure script..."',
    'curl -L --fail -o "$ENSURE" "$ENSURE_URL" || true',
    'echo "Writing run-agent.sh ..."',
    // run-agent.sh 본문: 현재 셸 변수로 고정 경로를 박아 둠
    "cat > \"$RUNNER\" <<EOF",
    "#!/bin/bash",
    'export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\\$HOME/.local/bin:\\$PATH"',
    'export SHOTFORM_ORIGIN=$(printf %q "$ORIGIN")',
    'export SHOTFORM_ENSURE_URL=$(printf %q "$ENSURE_URL")',
    'echo "Updating agent script..."',
    'curl -L --fail -o $(printf %q "$AGENT") $(printf %q "$AGENT_URL") || true',
    'if [ ! -f $(printf %q "$AGENT") ]; then',
    '  echo "[ERROR] agent missing"',
    '  read -r -p "Press Enter..."',
    "  exit 1",
    "fi",
    'exec $(printf %q "$NODE_EXE") $(printf %q "$AGENT")',
    "EOF",
    'chmod +x "$RUNNER"',
    'chmod +x "$0" 2>/dev/null || true',
    'xattr -d com.apple.quarantine "$0" 2>/dev/null || true',
    'xattr -d com.apple.quarantine "$RUNNER" 2>/dev/null || true',
    'echo ""',
    'echo "Checking Python (needed for Supertonic)..."',
    "if command -v python3 >/dev/null 2>&1; then",
    "  python3 --version || true",
    "elif command -v python >/dev/null 2>&1; then",
    "  python --version || true",
    "else",
    '  echo "[WARN] Python not in PATH. Install Python 3 (brew install python) before Supertonic auto-start."',
    "fi",
    'echo ""',
    'echo "Starting agent. Keep this Terminal window open."',
    'echo ""',
    'exec "$RUNNER"',
    "",
  ]
  return lines.join("\n")
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const file = (searchParams.get("file") || "cmd").toLowerCase()
  const origin = resolveOrigin(req)
  const os = detectOsFromRequest(req, searchParams.get("os"))

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

  const wantMac =
    file === "command" ||
    file === "sh" ||
    file === "macos" ||
    ((file === "cmd" || file === "starter" || file === "launcher") && os === "mac")

  if (wantMac) {
    const body = buildStarterCommandMac(origin)
    return new NextResponse(Buffer.from(body, "utf8"), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition":
          'attachment; filename="start-shotform-agent.command"',
        "Cache-Control": "no-store",
      },
    })
  }

  const cmd = buildStarterCmd(origin)
  return new NextResponse(Buffer.from(cmd, "ascii"), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="start-shotform-agent.cmd"',
      "Cache-Control": "no-store",
    },
  })
}

/**
 * Supertonic 3 설치 여부 확인 → 없으면 pip 설치 → serve 자동 기동
 * 상태: .tmp/supertonic-ensure-status.json
 *
 * 사용: node scripts/ensure-supertonic.mjs
 */
import { spawn, execFile } from "child_process"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { promisify } from "util"

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const STATUS_PATH = path.join(ROOT, ".tmp", "supertonic-ensure-status.json")
const HOST = process.env.SUPERTONIC_HOST || "127.0.0.1"
const PORT = String(process.env.SUPERTONIC_PORT || "7788")
const MODEL = process.env.SUPERTONIC_MODEL || "supertonic-3"
const BASE = `http://${HOST}:${PORT}`
const HEALTH_URL = `${BASE}/v1/health`

function writeStatus(partial) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true })
  let prev = {}
  try {
    prev = JSON.parse(fs.readFileSync(STATUS_PATH, "utf8"))
  } catch {
    /* empty */
  }
  const next = {
    ...prev,
    ...partial,
    updatedAt: Date.now(),
    pid: process.pid,
    baseUrl: BASE,
    model: MODEL,
  }
  fs.writeFileSync(STATUS_PATH, JSON.stringify(next, null, 2), "utf8")
  console.log(`[ensure-supertonic] ${next.phase}: ${next.message || ""}`)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function probeHealth() {
  try {
    const res = await fetch(HEALTH_URL, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { online: false }
    return { online: true, ...data }
  } catch {
    return { online: false }
  }
}

async function tryExec(cmd, args, opts = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      windowsHide: true,
      timeout: opts.timeout ?? 20000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, PYTHONUTF8: "1" },
      ...opts,
    })
    return { ok: true, stdout: String(stdout || ""), stderr: String(stderr || "") }
  } catch (e) {
    return {
      ok: false,
      stdout: String(e.stdout || ""),
      stderr: String(e.stderr || e.message || ""),
      code: e.code,
    }
  }
}

/** Python 런처 탐색 (Windows py / python) */
async function findPython() {
  const candidates = [
    { cmd: "py", prefix: ["-3"] },
    { cmd: "python", prefix: [] },
    { cmd: "python3", prefix: [] },
  ]
  for (const c of candidates) {
    const r = await tryExec(c.cmd, [...c.prefix, "--version"], { timeout: 10000 })
    if (r.ok) return c
  }
  return null
}

/** PATH 또는 python Scripts 에서 supertonic 실행 파일 찾기 */
async function resolveSupertonicCmd(py) {
  const direct = await tryExec("supertonic", ["version"], { timeout: 20000 })
  if (direct.ok) return { cmd: "supertonic", argsPrefix: [] }

  if (py) {
    const which = await tryExec(
      py.cmd,
      [
        ...py.prefix,
        "-c",
        "import shutil,sys; p=shutil.which('supertonic'); print(p or '')",
      ],
      { timeout: 15000 }
    )
    const bin = which.stdout.trim()
    if (bin && fs.existsSync(bin)) {
      return { cmd: bin, argsPrefix: [] }
    }

    const scripts = await tryExec(
      py.cmd,
      [
        ...py.prefix,
        "-c",
        "import sysconfig; print(sysconfig.get_path('scripts') or '')",
      ],
      { timeout: 15000 }
    )
    const scriptsDir = scripts.stdout.trim()
    if (scriptsDir) {
      for (const name of ["supertonic.exe", "supertonic"]) {
        const full = path.join(scriptsDir, name)
        if (fs.existsSync(full)) return { cmd: full, argsPrefix: [] }
      }
    }

    // 패키지만 있고 엔트리포인트가 애매할 때
    const mod = await tryExec(py.cmd, [...py.prefix, "-c", "import supertonic; print('ok')"], {
      timeout: 20000,
    })
    if (mod.ok) {
      return { cmd: py.cmd, argsPrefix: [...py.prefix, "-m", "supertonic"] }
    }
  }

  return null
}

async function isPackageInstalled(py) {
  if (!py) return false
  const r = await tryExec(py.cmd, [...py.prefix, "-m", "pip", "show", "supertonic"], {
    timeout: 30000,
  })
  return r.ok && /Name:\s*supertonic/i.test(r.stdout)
}

async function installSupertonic(py) {
  writeStatus({
    phase: "installing",
    message: "Supertonic 3 설치 중… (pip install, 수 분 소요될 수 있음)",
    installed: false,
    online: false,
  })
  const r = await tryExec(
    py.cmd,
    [...py.prefix, "-m", "pip", "install", "--upgrade", "supertonic[serve]"],
    { timeout: 20 * 60 * 1000 }
  )
  if (!r.ok) {
    throw new Error(
      `설치 실패: ${(r.stderr || r.stdout || "pip 오류").slice(0, 600)}`
    )
  }
  writeStatus({
    phase: "installing",
    message: "설치 완료. 서버 실행 준비 중…",
    installed: true,
    online: false,
    logTail: (r.stdout || "").slice(-400),
  })
}

function spawnServe(stCmd) {
  writeStatus({
    phase: "starting",
    message: `서버 기동 중… (${BASE}, 첫 실행 시 모델 ~400MB 다운로드)`,
    installed: true,
    online: false,
  })
  const args = [
    ...stCmd.argsPrefix,
    "serve",
    "--host",
    HOST,
    "--port",
    PORT,
    "--model",
    MODEL,
  ]
  // argsPrefix 가 -m supertonic 이면 cmd 는 python
  const child = spawn(stCmd.cmd, args, {
    detached: true,
    stdio: "ignore",
    cwd: ROOT,
    windowsHide: true,
    env: { ...process.env, PYTHONUTF8: "1" },
  })
  child.unref()
  return child.pid
}

async function waitUntilOnline(maxMs = 12 * 60 * 1000) {
  const start = Date.now()
  let n = 0
  while (Date.now() - start < maxMs) {
    const health = await probeHealth()
    if (health.online) return health
    n += 1
    if (n % 5 === 0) {
      const elapsed = Math.round((Date.now() - start) / 1000)
      writeStatus({
        phase: "starting",
        message: `서버 응답 대기 중… ${elapsed}초 (모델 다운로드·로딩)`,
        installed: true,
        online: false,
      })
    }
    await sleep(2000)
  }
  return null
}

async function main() {
  writeStatus({
    phase: "checking",
    message: "Supertonic 상태 확인 중…",
    online: false,
  })

  const already = await probeHealth()
  if (already.online) {
    writeStatus({
      phase: "ready",
      message: `이미 실행 중 · ${already.model || MODEL}`,
      installed: true,
      online: true,
      health: already,
    })
    return
  }

  const py = await findPython()
  if (!py) {
    writeStatus({
      phase: "error",
      message:
        "Python을 찾지 못했습니다. https://www.python.org/downloads/ 에서 Python 3를 설치한 뒤 다시 시도하세요. (설치 시 Add to PATH 체크)",
      installed: false,
      online: false,
    })
    process.exitCode = 1
    return
  }

  let stCmd = await resolveSupertonicCmd(py)
  const packaged = await isPackageInstalled(py)

  if (!stCmd || !packaged) {
    try {
      await installSupertonic(py)
    } catch (e) {
      writeStatus({
        phase: "error",
        message: e instanceof Error ? e.message : String(e),
        installed: false,
        online: false,
      })
      process.exitCode = 1
      return
    }
    stCmd = await resolveSupertonicCmd(py)
    if (!stCmd) {
      writeStatus({
        phase: "error",
        message:
          "설치는 되었지만 supertonic 명령을 찾지 못했습니다. 터미널을 새로 연 뒤 `supertonic version` 을 확인해 주세요.",
        installed: true,
        online: false,
      })
      process.exitCode = 1
      return
    }
  } else {
    writeStatus({
      phase: "checking",
      message: "설치 확인됨. 서버를 시작합니다…",
      installed: true,
      online: false,
    })
  }

  spawnServe(stCmd)
  const health = await waitUntilOnline()
  if (!health) {
    writeStatus({
      phase: "error",
      message: `서버를 시작했지만 ${BASE} 응답이 없습니다. 방화벽·포트를 확인하거나 터미널에서 직접 \`supertonic serve --host ${HOST} --port ${PORT} --model ${MODEL}\` 를 실행해 보세요.`,
      installed: true,
      online: false,
    })
    process.exitCode = 1
    return
  }

  writeStatus({
    phase: "ready",
    message: `연결됨 · ${health.model || MODEL} · ${BASE}`,
    installed: true,
    online: true,
    health,
  })
}

main().catch((e) => {
  writeStatus({
    phase: "error",
    message: e instanceof Error ? e.message : String(e),
    online: false,
  })
  process.exitCode = 1
})

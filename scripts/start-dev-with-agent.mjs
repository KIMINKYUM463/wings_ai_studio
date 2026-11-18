/**
 * next dev + 로컬 에이전트 동시 실행
 */
import { spawn, execFileSync } from "child_process"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")
const PORT = process.env.SHOTFORM_LOCAL_AGENT_PORT || "3847"

function runAgent() {
  const child = spawn(process.execPath, [path.join(ROOT, "scripts", "shotform-local-agent.mjs")], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, SHOTFORM_LOCAL_AGENT_PORT: PORT },
    shell: false,
  })
  child.on("exit", (code) => {
    if (code && code !== 0) console.warn(`[dev] local-agent exited ${code}`)
  })
  return child
}

function listeningPids(port) {
  if (!/^\d+$/.test(port)) return []
  if (process.platform === "win32") {
    let output = ""
    try {
      output = execFileSync("netstat", ["-ano"], { encoding: "utf8" })
    } catch {
      return []
    }
    const pids = new Set()
    const portPattern = new RegExp(`:${port}(?:\\s|$)`)
    for (const line of output.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue
      const columns = line.trim().split(/\s+/)
      const localAddress = columns[1] || ""
      const pid = columns[columns.length - 1]
      if (!portPattern.test(localAddress)) continue
      if (!/^\d+$/.test(pid) || pid === "0" || pid === String(process.pid)) continue
      pids.add(pid)
    }
    return [...pids]
  }
  try {
    const output = execFileSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf8" })
    return [
      ...new Set(
        output
          .split(/\s+/)
          .filter((pid) => /^\d+$/.test(pid) && pid !== String(process.pid))
      ),
    ]
  } catch {
    return []
  }
}

function freePort(port) {
  const pids = listeningPids(port)
  for (const pid of pids) {
    try {
      if (process.platform === "win32") {
        execFileSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" })
      } else {
        process.kill(Number(pid), "SIGKILL")
      }
      console.log(`[dev] 포트 ${port}을 쓰던 프로세스 ${pid}를 종료했습니다.`)
    } catch (error) {
      console.warn(
        `[dev] 포트 ${port} 프로세스 ${pid} 종료 실패:`,
        error instanceof Error ? error.message : error
      )
    }
  }
  if (pids.length) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400)
}

function runNext() {
  const port = process.env.PORT || "3000"
  freePort(port)
  const child = spawn("npx", ["next", "dev", "-p", port], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  })
  return child
}

const agent = runAgent()
const next = runNext()

function shutdown() {
  try {
    agent.kill()
  } catch {
    /* ignore */
  }
  try {
    next.kill()
  } catch {
    /* ignore */
  }
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

console.log(`[dev] 로컬 에이전트 + Next.js 시작 (에이전트 http://127.0.0.1:${PORT})`)

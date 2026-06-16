/**
 * next dev + 로컬 에이전트 동시 실행
 */
import { spawn } from "child_process"
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

function runNext() {
  const port = process.env.PORT || "3000"
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

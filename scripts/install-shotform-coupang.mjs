/**
 * Playwright + Chromium을 프로젝트 .playwright-browsers 에 설치
 * (Windows 사용자 홈이 달라도 동일 경로 사용)
 */
import { spawnSync } from "child_process"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")
const browsersPath = path.join(ROOT, ".playwright-browsers")

fs.mkdirSync(browsersPath, { recursive: true })

const env = {
  ...process.env,
  PLAYWRIGHT_BROWSERS_PATH: browsersPath,
}

console.log("[shotform:install-coupang] browsers →", browsersPath)

const npmInstall = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["install", "playwright@1.49.1"],
  { cwd: ROOT, env, stdio: "inherit", shell: true }
)
if (npmInstall.status !== 0) process.exit(npmInstall.status || 1)

const cli = path.join(ROOT, "node_modules", "playwright", "cli.js")
const installBrowsers = spawnSync(process.execPath, [cli, "install", "chromium"], {
  cwd: ROOT,
  env,
  stdio: "inherit",
})
if (installBrowsers.status !== 0) process.exit(installBrowsers.status || 1)

const chromeHint = path.join(browsersPath, "chromium-1148", "chrome-win", "chrome.exe")
if (fs.existsSync(chromeHint)) {
  console.log("[shotform:install-coupang] OK:", chromeHint)
} else {
  console.log("[shotform:install-coupang] 설치 완료. 폴더:", browsersPath)
}
console.log("[shotform:install-coupang] 로컬 에이전트를 재시작한 뒤 「상품평 가져오기」를 다시 누르세요.")

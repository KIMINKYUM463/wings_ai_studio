#!/usr/bin/env node
/**
 * 로컬 작업 폴더에서 edit-plan.json + sources/ 로 ffmpeg 렌더만 재실행
 *
 * 사용:
 *   node scripts/shotform-local-render.mjs --work-dir "C:\ShotForm\auto-edit" --job-id <uuid>
 *
 * 전제: npm run dev 로 UI에서 로컬 렌더 1회 실행해 jobs/{jobId}/edit-plan.json 이 있어야 함
 */
import { spawnSync } from "child_process"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : ""
}

const workDir = path.resolve(arg("--work-dir") || arg("-w") || "")
const jobId = (arg("--job-id") || arg("-j") || "").trim()

if (!workDir || !jobId) {
  console.error("Usage: node scripts/shotform-local-render.mjs --work-dir <path> --job-id <uuid>")
  process.exit(1)
}

const jobDir = path.join(workDir, "jobs", jobId)
const planPath = path.join(jobDir, "edit-plan.json")
if (!fs.existsSync(planPath)) {
  console.error(`edit-plan 없음: ${planPath}`)
  process.exit(1)
}

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"))
const segments = plan.edit_plan || plan.segments
const targetDuration = plan.target_duration || plan.targetDuration
if (!Array.isArray(segments) || !segments.length) {
  console.error("edit-plan에 edit_plan 구간이 없습니다.")
  process.exit(1)
}

const payload = {
  workDir,
  jobId,
  segments,
  targetDuration,
  defaultVideoId: segments[0]?.video_id || "video_001",
}

const runner = path.join(root, "scripts", "shotform-local-render-runner.cjs")
const res = spawnSync(process.execPath, [runner, JSON.stringify(payload)], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: "" },
})

process.exit(res.status ?? 1)

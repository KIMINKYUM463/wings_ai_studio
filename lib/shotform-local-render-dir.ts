import fs from "fs/promises"
import os from "os"
import path from "path"

export type AutoEditRenderMode = "server" | "local"

const MIN_SOURCE_BYTES = 50_000

export function isLocalRenderAllowedOnServer(): boolean {
  return !process.env.VERCEL
}

export function defaultLocalWorkDir(): string {
  const fromEnv = process.env.SHOTFORM_LOCAL_WORK_DIR?.trim()
  if (fromEnv) return path.resolve(fromEnv)
  return path.join(os.homedir(), "ShotForm", "auto-edit")
}

/** 사용자·env 작업 폴더 — 절대경로로 정규화 */
export function normalizeLocalWorkDir(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error("로컬 작업 폴더 경로를 입력해 주세요.")
  }
  const resolved = path.resolve(trimmed)
  const segments = resolved.split(path.sep)
  if (segments.some((s) => s === "..")) {
    throw new Error("유효하지 않은 작업 폴더 경로입니다.")
  }
  return resolved
}

export function normalizeAutoEditRenderMode(raw: unknown): AutoEditRenderMode {
  return raw === "local" ? "local" : "server"
}

export function localSourcesDir(workRoot: string): string {
  return path.join(workRoot, "sources")
}

export function localSourceCachePath(workRoot: string, videoId: string): string {
  return path.join(localSourcesDir(workRoot), `${videoId}.mp4`)
}

export function localJobDir(workRoot: string, jobId: string): string {
  return path.join(workRoot, "jobs", jobId)
}

export function localJobOutputPath(workRoot: string, jobId: string): string {
  return path.join(localJobDir(workRoot, jobId), "output.mp4")
}

export function localJobEditPlanPath(workRoot: string, jobId: string): string {
  return path.join(localJobDir(workRoot, jobId), "edit-plan.json")
}

export function localJobMetaPath(workRoot: string, jobId: string): string {
  return path.join(localJobDir(workRoot, jobId), "job-meta.json")
}

export async function ensureLocalWorkRoot(workRoot: string): Promise<void> {
  await fs.mkdir(localSourcesDir(workRoot), { recursive: true })
  await fs.mkdir(path.join(workRoot, "jobs"), { recursive: true })
}

export async function createLocalAutoEditWorkDir(
  workRoot: string,
  jobId?: string
): Promise<{ dir: string; id: string; workRoot: string }> {
  if (!isLocalRenderAllowedOnServer()) {
    throw new Error("로컬 렌더는 Vercel 배포 환경에서 사용할 수 없습니다. npm run dev 로 로컬 서버를 실행해 주세요.")
  }
  const root = normalizeLocalWorkDir(workRoot)
  await ensureLocalWorkRoot(root)
  const { randomUUID } = await import("crypto")
  const id = jobId || randomUUID()
  const dir = localJobDir(root, id)
  await fs.mkdir(dir, { recursive: true })
  return { dir, id, workRoot: root }
}

async function isValidCachedMp4(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath)
    if (stat.size < MIN_SOURCE_BYTES) return false
    const head = Buffer.alloc(12)
    const fh = await fs.open(filePath, "r")
    try {
      await fh.read(head, 0, 12, 0)
    } finally {
      await fh.close()
    }
    return head.subarray(4, 8).toString("ascii") === "ftyp"
  } catch {
    return false
  }
}

/** 로컬 sources/ 캐시 → job 작업 폴더 (없으면 null) */
export async function copyCachedSourceToJob(
  workRoot: string,
  videoId: string,
  destPath: string
): Promise<boolean> {
  const cached = localSourceCachePath(workRoot, videoId)
  if (!(await isValidCachedMp4(cached))) return false
  await fs.copyFile(cached, destPath)
  return true
}

/** job 소스 → sources/ 캐시 저장 */
export async function persistSourceToLocalCache(
  workRoot: string,
  videoId: string,
  sourcePath: string
): Promise<void> {
  const cached = localSourceCachePath(workRoot, videoId)
  await fs.mkdir(path.dirname(cached), { recursive: true })
  await fs.copyFile(sourcePath, cached)
}

export async function writeLocalJobArtifacts(args: {
  workRoot: string
  jobId: string
  meta: Record<string, unknown>
  editPlan?: unknown
}): Promise<void> {
  const jobDir = localJobDir(args.workRoot, args.jobId)
  await fs.mkdir(jobDir, { recursive: true })
  await fs.writeFile(
    localJobMetaPath(args.workRoot, args.jobId),
    JSON.stringify({ ...args.meta, jobId: args.jobId, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  )
  if (args.editPlan) {
    await fs.writeFile(
      localJobEditPlanPath(args.workRoot, args.jobId),
      JSON.stringify(args.editPlan, null, 2),
      "utf8"
    )
  }
}

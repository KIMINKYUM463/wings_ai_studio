import fs from "fs/promises"
import os from "os"
import path from "path"
import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import {
  autoEditOutputStoragePath,
  downloadAutoEditOutputFromSupabase,
  loadAutoEditJobFromSupabase,
  persistAutoEditJobToSupabase,
} from "@/lib/shotform-auto-edit-job-store"

type JobRecord = AutoEditJobResult & {
  outputPath?: string
  outputStoragePath?: string | null
  createdAt: number
}

const jobs = new Map<string, JobRecord>()
const TTL_MS = 60 * 60 * 1000

function jobDir(jobId: string): string {
  return path.join(os.tmpdir(), "shotform-auto-edit", jobId)
}

function jobMetaPath(jobId: string): string {
  return path.join(jobDir(jobId), "job.json")
}

function shouldPersistToSupabase(): boolean {
  return Boolean(process.env.VERCEL || process.env.NEXT_PUBLIC_SUPABASE_URL)
}

async function syncJobToSupabase(job: JobRecord): Promise<void> {
  if (!shouldPersistToSupabase() || !job.jobId) return
  try {
    await persistAutoEditJobToSupabase({
      job,
      createdAt: job.createdAt,
      outputStoragePath: job.outputStoragePath,
    })
  } catch (e) {
    console.error("[shotform-auto-edit-jobs] Supabase persist failed:", e)
  }
}

async function persistJobToDisk(job: JobRecord): Promise<void> {
  if (!job.jobId || !job.outputPath) return
  try {
    await fs.mkdir(jobDir(job.jobId), { recursive: true })
    await fs.writeFile(
      jobMetaPath(job.jobId),
      JSON.stringify({
        jobId: job.jobId,
        outputPath: job.outputPath,
        outputStoragePath: job.outputStoragePath,
        createdAt: job.createdAt,
        title: job.analysis?.title || job.analyses?.[0]?.title || "shopping-short",
        outputDuration: job.outputDuration,
        step: job.step,
      }),
      "utf8"
    )
  } catch {
    /* 디스크 기록 실패는 무시 */
  }
}

async function loadJobFromDisk(jobId: string): Promise<JobRecord | undefined> {
  const dir = jobDir(jobId)
  const outputPath = path.join(dir, "output.mp4")
  try {
    const raw = await fs.readFile(jobMetaPath(jobId), "utf8")
    const meta = JSON.parse(raw) as {
      jobId?: string
      outputPath?: string
      outputStoragePath?: string | null
      createdAt?: number
      title?: string
      outputDuration?: number
      step?: AutoEditJobResult["step"]
    }
    const createdAt = meta.createdAt ?? Date.now()
    if (Date.now() - createdAt > TTL_MS) return undefined
    await fs.access(meta.outputPath || outputPath)
    return {
      jobId,
      step: meta.step || "done",
      outputPath: meta.outputPath || outputPath,
      outputStoragePath: meta.outputStoragePath,
      createdAt,
      analysis: meta.title ? ({ title: meta.title } as JobRecord["analysis"]) : undefined,
      outputDuration: meta.outputDuration,
    }
  } catch {
    try {
      const stat = await fs.stat(outputPath)
      if (stat.size < 20_000) return undefined
      return {
        jobId,
        step: "done",
        outputPath,
        createdAt: stat.mtimeMs,
      }
    } catch {
      return undefined
    }
  }
}

export function putAutoEditJob(job: JobRecord): void {
  jobs.set(job.jobId, job)
  pruneOldJobs()
  void syncJobToSupabase(job)
  if (job.outputPath && job.step === "done") {
    void persistJobToDisk(job)
  }
}

export function getAutoEditJob(jobId: string): JobRecord | undefined {
  const j = jobs.get(jobId)
  if (!j) return undefined
  if (Date.now() - j.createdAt > TTL_MS) {
    jobs.delete(jobId)
    return undefined
  }
  return j
}

export async function getAutoEditJobAsync(jobId: string): Promise<JobRecord | undefined> {
  const mem = getAutoEditJob(jobId)
  if (mem) return mem

  const remote = await loadAutoEditJobFromSupabase(jobId, TTL_MS)
  if (remote) {
    const record: JobRecord = {
      ...remote,
      outputPath: remote.outputStoragePath ? undefined : path.join(jobDir(jobId), "output.mp4"),
      outputStoragePath: remote.outputStoragePath,
    }
    jobs.set(jobId, record)
    return record
  }

  const disk = await loadJobFromDisk(jobId)
  if (disk) jobs.set(jobId, disk)
  return disk
}

/** @deprecated getAutoEditJobAsync 사용 */
export async function getAutoEditJobResolved(jobId: string): Promise<JobRecord | undefined> {
  return getAutoEditJobAsync(jobId)
}

export async function readAutoEditOutput(jobId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const job = await getAutoEditJobAsync(jobId)
  if (!job) return null

  const storageCandidates = [
    job.outputStoragePath,
    autoEditOutputStoragePath(jobId),
  ].filter((p, i, arr): p is string => Boolean(p) && arr.indexOf(p) === i)

  for (const storagePath of storageCandidates) {
    const remote = await downloadAutoEditOutputFromSupabase(storagePath)
    if (remote) {
      const title = job.analysis?.title || job.analyses?.[0]?.title || "shopping-short"
      const safe = title.slice(0, 32).replace(/[^\w\uac00-\ud7af\u4e00-\u9fff-]+/g, "_")
      return { buffer: remote, filename: `${safe || "auto-edit"}_${jobId.slice(0, 8)}.mp4` }
    }
  }

  if (!job.outputPath) return null
  try {
    const buffer = await fs.readFile(job.outputPath)
    if (buffer.length < 20_000) return null
    const title = job.analysis?.title || job.analyses?.[0]?.title || "shopping-short"
    const safe = title.slice(0, 32).replace(/[^\w\uac00-\ud7af\u4e00-\u9fff-]+/g, "_")
    return { buffer, filename: `${safe || "auto-edit"}_${jobId.slice(0, 8)}.mp4` }
  } catch {
    return null
  }
}

function pruneOldJobs(): void {
  const now = Date.now()
  for (const [id, j] of jobs) {
    if (now - j.createdAt > TTL_MS) jobs.delete(id)
  }
}

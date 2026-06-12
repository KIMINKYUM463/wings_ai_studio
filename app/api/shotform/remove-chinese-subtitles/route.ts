import fs from "fs/promises"
import os from "os"
import path from "path"
import { type NextRequest, NextResponse } from "next/server"
import { readAutoEditOutput } from "@/lib/shotform-auto-edit-jobs"
import { uploadAutoEditOutputToSupabase } from "@/lib/shotform-auto-edit-job-store"
import { withTimeout } from "@/lib/shotform-auto-edit-script-step"
import { VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS } from "@/lib/shotform-vmake-subtitle-removal"
import {
  isVmakeRouteNotFoundError,
  removeChineseSubtitlesFromLocalFile,
} from "@/lib/shotform-vmake-client"

export const maxDuration = 800
export const runtime = "nodejs"

async function resolveSourceBuffer(input: {
  jobId?: string
  videoFile?: File | null
}): Promise<Buffer | null> {
  if (input.videoFile && input.videoFile.size >= 20_000) {
    return Buffer.from(await input.videoFile.arrayBuffer())
  }
  const jobId = input.jobId?.trim()
  if (!jobId) return null
  const file = await readAutoEditOutput(jobId)
  return file?.buffer ?? null
}

export async function POST(req: NextRequest) {
  const workDir = path.join(os.tmpdir(), `vmake_rm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  const sourcePath = path.join(workDir, "input.mp4")
  const outputPath = path.join(workDir, "output.mp4")

  try {
    const contentType = req.headers.get("content-type") || ""
    let vmakeApiKey = ""
    let vmakeSecretAccessKey = ""
    let jobId = ""
    let videoFile: File | null = null

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      vmakeApiKey = String(form.get("vmakeApiKey") || "").trim()
      vmakeSecretAccessKey = String(form.get("vmakeSecretAccessKey") || "").trim()
      jobId = String(form.get("jobId") || "").trim()
      const raw = form.get("video")
      videoFile = raw instanceof File ? raw : null
    } else {
      const body = (await req.json().catch(() => ({}))) as {
        jobId?: string
        vmakeApiKey?: string
        vmakeSecretAccessKey?: string
      }
      jobId = body.jobId?.trim() || ""
      vmakeApiKey = body.vmakeApiKey?.trim() || ""
      vmakeSecretAccessKey = body.vmakeSecretAccessKey?.trim() || ""
    }

    if (!vmakeApiKey || !vmakeSecretAccessKey) {
      return NextResponse.json(
        {
          error:
            "Vmake AI API Key와 Secret Access Key가 필요합니다. 설정에서 shotform_vmake_api_key를 입력해 주세요.",
        },
        { status: 400 }
      )
    }

    const sourceBuffer = await resolveSourceBuffer({ jobId, videoFile })
    if (!sourceBuffer || sourceBuffer.length < 20_000) {
      return NextResponse.json(
        { error: "처리할 짜집기 영상을 찾지 못했습니다. 미리보기 영상이 준비된 뒤 다시 시도해 주세요." },
        { status: 400 }
      )
    }

    await fs.mkdir(workDir, { recursive: true })
    await fs.writeFile(sourcePath, sourceBuffer)

    try {
      await withTimeout(
        removeChineseSubtitlesFromLocalFile({
          apiKey: vmakeApiKey,
          secretAccessKey: vmakeSecretAccessKey,
          sourcePath,
          outputPath,
        }),
        VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS,
        "Vmake 자막 제거 시간 초과(약 7분). 잠시 후 다시 시도해 주세요."
      )
    } catch (e) {
      if (isVmakeRouteNotFoundError(e)) {
        return NextResponse.json({ error: e.message }, { status: 502 })
      }
      throw e
    }

    const outStat = await fs.stat(outputPath).catch(() => null)
    if (!outStat || outStat.size < 20_000) {
      return NextResponse.json({ error: "Vmake 처리 결과 영상이 비어 있습니다." }, { status: 502 })
    }

    if (jobId) {
      await uploadAutoEditOutputToSupabase(jobId, outputPath).catch(() => undefined)
    }

    const out = await fs.readFile(outputPath)
    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(out.length),
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "중국어 자막 제거 중 오류가 발생했습니다." },
      { status: 500 }
    )
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

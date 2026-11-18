import { execFile } from "child_process"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { promisify } from "util"
import { type NextRequest, NextResponse } from "next/server"
import { resolveFfmpegPath } from "@/lib/ffmpeg-binaries"
import { isLikelyMp4Buffer } from "@/lib/mvp-mp4-preview"
import { resolveAutoEditOutputPlayableUrl } from "@/lib/shotform-auto-edit-playable-url"
import { readAutoEditOutput } from "@/lib/shotform-auto-edit-jobs"
import { uploadAutoEditOutputToSupabase } from "@/lib/shotform-auto-edit-job-store"
import { withTimeout } from "@/lib/shotform-auto-edit-script-step"
import { VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS, VMAKE_SUBTITLE_REMOVAL_TIMEOUT_HINT } from "@/lib/shotform-vmake-subtitle-removal"
import {
  isVmakeRouteNotFoundError,
  removeChineseSubtitlesFromLocalFile,
} from "@/lib/shotform-vmake-client"
import { formatVmakeUserError } from "@/lib/vmake-skill-client"

export const maxDuration = 800
export const runtime = "nodejs"

/** Vercel serverless 응답 본문 제한 — 이보다 크면 Storage 경유 JSON 응답 */
const VERCEL_RESPONSE_MAX_BYTES = 4_000_000

const execFileAsync = promisify(execFile)

/**
 * Vmake 결과는 키프레임이 5초 간격이라 컷 경계 seek마다 최대 150프레임을 디코딩해
 * 미리보기·브라우저 렌더가 끊김 — 0.5초 간격 키프레임으로 다시 인코딩. 실패 시 원본 경로 반환.
 */
async function reencodeForFastSeek(inputPath: string, outputPath: string): Promise<string> {
  try {
    await execFileAsync(
      resolveFfmpegPath(),
      [
        "-hide_banner", "-y", "-i", inputPath,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
        "-g", "15", "-keyint_min", "15", "-sc_threshold", "0",
        "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart",
        outputPath,
      ],
      { windowsHide: true, timeout: 180_000, maxBuffer: 16 * 1024 * 1024 }
    )
    const stat = await fs.stat(outputPath).catch(() => null)
    return stat && stat.size >= 20_000 ? outputPath : inputPath
  } catch (e) {
    console.warn("[remove-chinese-subtitles] keyframe re-encode skipped:", e instanceof Error ? e.message.slice(0, 300) : e)
    return inputPath
  }
}

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
        {
          error: jobId
            ? "서버에 저장된 짜집기 영상을 찾지 못했습니다. 짜집기 완료 직후 다시 시도하거나, 미리보기가 재생되는지 확인해 주세요."
            : "처리할 짜집기 영상을 찾지 못했습니다. 미리보기 영상이 준비된 뒤 다시 시도해 주세요.",
        },
        { status: 400 }
      )
    }
    if (!isLikelyMp4Buffer(sourceBuffer)) {
      return NextResponse.json(
        {
          error:
            "서버에 저장된 짜집기 영상이 유효한 MP4가 아닙니다. Supabase Storage 업로드를 확인한 뒤 짜집기를 다시 실행해 주세요.",
        },
        { status: 400 }
      )
    }

    await fs.mkdir(workDir, { recursive: true })
    await fs.writeFile(sourcePath, sourceBuffer)

    const removalPromise = removeChineseSubtitlesFromLocalFile({
      apiKey: vmakeApiKey,
      secretAccessKey: vmakeSecretAccessKey,
      sourcePath,
      outputPath,
    })

    try {
      await withTimeout(
        removalPromise,
        VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS,
        VMAKE_SUBTITLE_REMOVAL_TIMEOUT_HINT
      )
    } catch (e) {
      if (isVmakeRouteNotFoundError(e)) {
        return NextResponse.json({ error: e.message }, { status: 502 })
      }
      const msg = e instanceof Error ? e.message : String(e)
      // 타임아웃 직후 Vmake가 늦게 끝나는 경우 — 최대 90초 더 기다려 결과 회수
      if (/시간 초과|timeout/i.test(msg)) {
        console.warn("[remove-chinese-subtitles] timeout — waiting up to 90s for late finish")
        const lateOk = await Promise.race([
          removalPromise.then(() => true).catch(() => false),
          new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(false), 90_000)
          }),
        ])
        const lateStat = await fs.stat(outputPath).catch(() => null)
        if (!lateOk && !(lateStat && lateStat.size >= 20_000)) {
          throw e
        }
        console.warn("[remove-chinese-subtitles] late finish recovered")
      } else {
        throw e
      }
    }

    const outStat = await fs.stat(outputPath).catch(() => null)
    if (!outStat || outStat.size < 20_000) {
      return NextResponse.json({ error: "Vmake 처리 결과 영상이 비어 있습니다." }, { status: 502 })
    }

    const deliverPath = await reencodeForFastSeek(outputPath, path.join(workDir, "output_seek.mp4"))
    const out = await fs.readFile(deliverPath)
    if (!isLikelyMp4Buffer(out)) {
      return NextResponse.json(
        { error: "Vmake 처리 결과가 유효한 MP4가 아닙니다. 잠시 후 다시 시도해 주세요." },
        { status: 502 }
      )
    }

    const preferStorageDelivery =
      Boolean(jobId) &&
      (process.env.VERCEL || out.length > VERCEL_RESPONSE_MAX_BYTES)

    if (preferStorageDelivery && jobId) {
      const storagePath = await uploadAutoEditOutputToSupabase(jobId, deliverPath)
      if (!storagePath) {
        return NextResponse.json(
          {
            error:
              "자막 제거는 완료됐지만 결과 MP4를 Storage에 저장하지 못했습니다. Supabase video-sources 버킷·권한을 확인해 주세요.",
          },
          { status: 502 }
        )
      }
      const playable = await resolveAutoEditOutputPlayableUrl(jobId)
      return NextResponse.json({
        success: true,
        jobId,
        size: out.length,
        delivery: "storage",
        playableUrl: playable?.url ?? undefined,
      })
    }

    if (jobId) {
      await uploadAutoEditOutputToSupabase(jobId, deliverPath).catch(() => undefined)
    }

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(out.length),
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    const raw = e instanceof Error ? e.message : "중국어 자막 제거 중 오류가 발생했습니다."
    console.error("[remove-chinese-subtitles]", raw)
    return NextResponse.json({ error: formatVmakeUserError(raw) }, { status: 500 })
  } finally {
    // 백그라운드 쓰기가 남아 있으면 잠깐 기다린 뒤 임시 폴더 삭제
    await new Promise((r) => setTimeout(r, 1500))
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

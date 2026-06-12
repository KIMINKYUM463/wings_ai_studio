import { type NextRequest, NextResponse } from "next/server"
import { autoEditDownloadUrl } from "@/lib/shotform-auto-edit-download"
import { buildQuickShoppingScript } from "@/lib/shotform-auto-edit-mix"
import { getAutoEditJobAsync, putAutoEditJob, readAutoEditOutput } from "@/lib/shotform-auto-edit-jobs"
import { finalizeAutoEditJobWithScript } from "@/lib/shotform-auto-edit-script-step"

/** POST — subtitle_removal 단계에서 멈춘 job을 자막 제거 없이 완료 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { jobId?: string }
    const jobId = body.jobId?.trim()
    if (!jobId) {
      return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 })
    }

    const job = await getAutoEditJobAsync(jobId)
    if (!job) {
      return NextResponse.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 })
    }

    if (job.step === "done") {
      const { outputPath: _o, createdAt: _c, ...clientJob } = job as typeof job & {
        outputPath?: string
        createdAt?: number
      }
      return NextResponse.json(clientJob)
    }

    if (job.step === "error") {
      return NextResponse.json({ error: job.error || "작업이 실패 상태입니다." }, { status: 400 })
    }

    if (job.step !== "subtitle_removal") {
      return NextResponse.json(
        { error: "자막 제거 단계가 아닙니다. 잠시 후 다시 조회해 주세요." },
        { status: 409 }
      )
    }

    if (!job.editPlan?.edit_plan?.length || !job.productAnalysis || !job.mixInfo || !job.analyses?.length) {
      return NextResponse.json(
        { error: "편집 정보가 없어 건너뛸 수 없습니다. 짜집기를 다시 실행해 주세요." },
        { status: 409 }
      )
    }

    const hasOutput = Boolean(job.downloadUrl || job.outputPath || job.outputStoragePath)
    const outputFile = hasOutput ? null : await readAutoEditOutput(jobId)
    if (!hasOutput && !outputFile) {
      return NextResponse.json(
        {
          error:
            "짜집기 MP4를 찾지 못했습니다. Vmake 처리 중 서버가 끊겼을 수 있습니다. 자막 제거 OFF로 짜집기를 다시 실행해 주세요.",
        },
        { status: 409 }
      )
    }

    const downloadUrl = job.downloadUrl || autoEditDownloadUrl(jobId)
    const script = buildQuickShoppingScript(
      job.productAnalysis,
      job.editPlan,
      job.analyses,
      job.mixInfo
    )

    const done = finalizeAutoEditJobWithScript(
      {
        ...job,
        downloadUrl,
        renderSkipped: false,
        subtitleRemovalSkipped: true,
        subtitleRemovalWarning:
          job.subtitleRemovalWarning ||
          "Vmake 자막 제거가 지연되어 건너뛰었습니다. 정보 탭에서 나중에 다시 시도할 수 있습니다.",
      },
      script
    )

    putAutoEditJob({ ...done, createdAt: job.createdAt })

    const { outputPath: _outputPath, createdAt: _createdAt, ...clientJob } = done as typeof done & {
      outputPath?: string
      createdAt?: number
    }
    return NextResponse.json(clientJob)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류" }, { status: 500 })
  }
}

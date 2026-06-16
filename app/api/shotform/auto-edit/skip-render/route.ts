import { type NextRequest, NextResponse } from "next/server"
import { getAutoEditJobAsync, putAutoEditJob } from "@/lib/shotform-auto-edit-jobs"
import {
  finalizeAutoEditJobWithScript,
  resolveAutoEditScript,
} from "@/lib/shotform-auto-edit-script-step"
import { normalizeAutoEditAnalysisMode } from "@/lib/shotform-auto-edit-types"

function openaiKey(body: Record<string, unknown>): string {
  return (
    (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) ||
    process.env.shotform_openai_api_key ||
    process.env.OPENAI_API_KEY ||
    ""
  )
}

/** POST — render 단계에서 멈춘 job을 MP4 없이 나레이션까지 완료 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : ""
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

    if (job.step !== "render") {
      return NextResponse.json(
        { error: "ffmpeg 렌더 단계가 아닙니다. 잠시 후 다시 조회해 주세요." },
        { status: 409 }
      )
    }

    if (!job.editPlan?.edit_plan?.length || !job.productAnalysis || !job.mixInfo || !job.analyses?.length) {
      return NextResponse.json(
        { error: "편집 정보가 없어 건너뛸 수 없습니다. 짜집기를 다시 실행해 주세요." },
        { status: 409 }
      )
    }

    const renderSkipReason =
      job.renderSkipReason ||
      "ffmpeg 렌더가 지연되어 건너뛰었습니다. 타임라인·나레이션은 사용할 수 있으며, MP4가 필요하면 「편집 실행」을 다시 눌러 주세요."

    const preScriptJob = {
      ...job,
      renderSkipped: true,
      renderSkipReason,
      downloadUrl: undefined,
      outputDuration: undefined,
      outputPath: undefined,
      outputStoragePath: undefined,
    }

    putAutoEditJob({ ...preScriptJob, step: "script", createdAt: job.createdAt })

    const script = await resolveAutoEditScript({
      openaiApiKey: openaiKey(body) || undefined,
      scriptTopic: typeof body.scriptTopic === "string" ? body.scriptTopic.trim() || undefined : undefined,
      productAnalysis: job.productAnalysis,
      mixInfo: job.mixInfo,
      editPlan: job.editPlan,
      analyses: job.analyses,
      analysisMode: normalizeAutoEditAnalysisMode(body.analysisMode),
      sourceKeywords: job.sourceKeywords,
    })

    const done = finalizeAutoEditJobWithScript(preScriptJob, script)
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

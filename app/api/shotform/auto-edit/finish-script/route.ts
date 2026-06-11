import { type NextRequest, NextResponse } from "next/server"
import { buildQuickShoppingScript } from "@/lib/shotform-auto-edit-mix"
import { getAutoEditJobAsync, putAutoEditJob } from "@/lib/shotform-auto-edit-jobs"
import { finalizeAutoEditJobWithScript } from "@/lib/shotform-auto-edit-script-step"

/** POST — script 단계에서 멈춘 job을 기본 나레이션으로 완료 */
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

    if (!job.editPlan?.edit_plan?.length || !job.productAnalysis || !job.mixInfo || !job.analyses?.length) {
      return NextResponse.json(
        { error: "나레이션을 생성할 편집 정보가 아직 없습니다. 잠시 후 다시 시도해 주세요." },
        { status: 409 }
      )
    }

    const script = buildQuickShoppingScript(
      job.productAnalysis,
      job.editPlan,
      job.analyses,
      job.mixInfo
    )

    const done = finalizeAutoEditJobWithScript(job, script)
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

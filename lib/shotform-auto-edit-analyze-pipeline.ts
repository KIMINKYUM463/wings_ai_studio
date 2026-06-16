import type {
  AutoEditAnalysisMode,
  AutoEditTargetDuration,
  AutoEditVideoInput,
  MixInfo,
  VideoAnalysis,
} from "@/lib/shotform-auto-edit-types"
import { AUTO_EDIT_ANALYSIS_MODE_DEFAULT } from "@/lib/shotform-auto-edit-types"
import type { ClientVideoMetaEntry } from "@/lib/shotform-client-video-meta"
import { analyzeOneVideoPrecision } from "@/lib/shotform-auto-edit-precision-analyze"
import {
  benchmarkFastAnalyzeAndMix,
  benchmarkProductAnalysisFromAnalyses,
} from "@/lib/shotform-auto-edit-benchmark-fast"
import { createMixPlanWithAi } from "@/lib/shotform-auto-edit-mix"

export type AutoEditAnalyzePhase = "keyframes" | "vision" | "mix"

export type AutoEditAnalyzeFailure = {
  video_id: string
  title: string
  reason: string
}

export async function runAutoEditAnalyzeAndMix(args: {
  apiKey: string
  videos: AutoEditVideoInput[]
  sourcePaths: Record<string, string>
  workDir: string
  targetDuration: AutoEditTargetDuration
  analysisMode?: AutoEditAnalysisMode
  clientVideoMeta?: Record<string, ClientVideoMetaEntry>
  onPhase?: (phase: AutoEditAnalyzePhase) => void
}): Promise<{
  analyses: VideoAnalysis[]
  mixInfo: MixInfo
  failures: AutoEditAnalyzeFailure[]
}> {
  const mode = args.analysisMode ?? AUTO_EDIT_ANALYSIS_MODE_DEFAULT
  if (mode === "precision") {
    return runPrecisionAnalyzeAndMix(args)
  }
  const result = await benchmarkFastAnalyzeAndMix({
    ...args,
    analysisMode: mode,
    clientVideoMeta: args.clientVideoMeta,
  })
  return { ...result, failures: [] }
}

async function runPrecisionAnalyzeAndMix(args: {
  apiKey: string
  videos: AutoEditVideoInput[]
  sourcePaths: Record<string, string>
  workDir: string
  targetDuration: AutoEditTargetDuration
  clientVideoMeta?: Record<string, ClientVideoMetaEntry>
  onPhase?: (phase: AutoEditAnalyzePhase) => void
}): Promise<{
  analyses: VideoAnalysis[]
  mixInfo: MixInfo
  failures: AutoEditAnalyzeFailure[]
}> {
  const { apiKey, videos, sourcePaths, workDir, targetDuration, clientVideoMeta, onPhase } = args
  onPhase?.("keyframes")

  const results: Awaited<ReturnType<typeof analyzeOneVideoPrecision>>[] = []

  for (let srcIndex = 0; srcIndex < videos.length; srcIndex++) {
    const video = videos[srcIndex]!
    const clientMeta = clientVideoMeta?.[video.video_id]
    const hasClientPrecisionKeyframes =
      (clientMeta?.precisionKeyframes?.filter((f) => f.keyframeDataUrl?.startsWith("data:image/"))
        .length ?? 0) >= 6
    const sourcePath = sourcePaths[video.video_id]
    if (!sourcePath && !hasClientPrecisionKeyframes) {
      results.push({
        ok: false,
        video_id: video.video_id,
        title: video.title || video.video_id,
        reason:
          "원본 영상 경로를 찾지 못했습니다. 로컬 렌더 모드면 브라우저 키프레임 준비 후 다시 실행해 주세요.",
      })
      continue
    }
    results.push(
      await analyzeOneVideoPrecision({
        apiKey,
        video,
        sourcePath: sourcePath || "",
        workDir,
        srcIndex,
        clientMeta,
      })
    )
  }

  const analyses: VideoAnalysis[] = []
  const failures: AutoEditAnalyzeFailure[] = []

  for (const row of results) {
    if (row.ok) {
      analyses.push({
        ...row.analysis,
        product_fit_reason: row.analysis.product_fit_reason || "정밀 장면 분석",
      })
    } else {
      failures.push({
        video_id: row.video_id,
        title: row.title,
        reason: row.reason,
      })
    }
  }

  if (!analyses.length) {
    const detail = failures.map((f) => `${f.title}: ${f.reason}`).join(" | ")
    throw new Error(detail || "정밀 분석에 성공한 영상이 없습니다.")
  }

  onPhase?.("vision")
  onPhase?.("mix")

  const productAnalysis = benchmarkProductAnalysisFromAnalyses(analyses)
  const mixInfo = await createMixPlanWithAi({
    apiKey,
    analyses,
    productAnalysis,
    targetDuration,
  })

  return { analyses, mixInfo, failures }
}

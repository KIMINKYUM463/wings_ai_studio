import type { MvpStudioPersistData } from "@/lib/mvp-studio-types"
import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import type { MvpTestProjectData } from "@/app/WingsAIStudioShotForm/shortform-studio/project-types"
import { slimStudioPersistForSave } from "@/lib/mvp-thumbnail-persist"

/** Supabase JSONB 저장용 — 분석 프레임 등 불필요한 대용량 필드 제거 */
export function slimPostEditResultForPersist(result: AutoEditJobResult): AutoEditJobResult {
  const slimAnalysis = (a: NonNullable<AutoEditJobResult["analyses"]>[number]) => ({
    video_id: a.video_id,
    title: a.title,
    platform: a.platform,
    duration: a.duration,
    source_url: a.source_url,
    scenes: a.scenes,
    visual_scenes: a.visual_scenes,
    productName: a.productName,
    category: a.category,
    targetKeywords: a.targetKeywords,
    videoStructure: a.videoStructure,
    summary: a.summary,
    src_index: a.src_index,
    product_fit: a.product_fit,
    product_fit_reason: a.product_fit_reason,
  })

  const out: AutoEditJobResult = {
    jobId: result.jobId,
    step: result.step,
    editPlan: result.editPlan,
    script: result.script,
    downloadUrl: result.downloadUrl,
    outputDuration: result.outputDuration,
    productAnalysis: result.productAnalysis,
    mixInfo: result.mixInfo,
    videoCount: result.videoCount,
    renderSkipped: result.renderSkipped,
    renderSkipReason: result.renderSkipReason,
    subtitleRemovalSkipped: result.subtitleRemovalSkipped,
    subtitleRemovalWarning: result.subtitleRemovalWarning,
    renderMode: result.renderMode,
    localWorkDir: result.localWorkDir,
    localOutputPath: result.localOutputPath,
    localRenderPending: result.localRenderPending,
  }

  if (result.analyses?.length) {
    out.analyses = result.analyses.map(slimAnalysis)
  } else if (result.analysis) {
    out.analysis = slimAnalysis(result.analysis)
  }

  return out
}

export function prepareMvpProjectDataForSave(data: MvpTestProjectData): MvpTestProjectData {
  const studioData: MvpStudioPersistData | undefined = data.postEditStudioData
    ? slimStudioPersistForSave({
        ...data.postEditStudioData,
        scriptOverrides: data.postEditStudioData.scriptOverrides ?? data.postEditScriptOverrides,
      })
    : data.postEditScriptOverrides && Object.keys(data.postEditScriptOverrides).length > 0
      ? { scriptOverrides: data.postEditScriptOverrides }
      : undefined

  return {
    sourceMode: data.sourceMode,
    directUrlText: data.directUrlText,
    keywordText: data.keywordText,
    multiKeyword: data.multiKeyword,
    keywordPairs: data.keywordPairs,
    sourceResult: data.sourceResult ?? null,
    editPicks: data.editPicks,
    analyzedVideoUrl: data.analyzedVideoUrl ?? null,
    postEditResult: data.postEditResult ? slimPostEditResultForPersist(data.postEditResult) : null,
    postEditScriptOverrides: data.postEditScriptOverrides,
    postEditStudioData: studioData,
  }
}

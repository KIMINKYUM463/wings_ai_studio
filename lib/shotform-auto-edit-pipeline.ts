import fs from "fs/promises"
import path from "path"
import type { AutoEditInput, AutoEditJobResult, AutoEditVideoInput } from "@/lib/shotform-auto-edit-types"
import { MAX_AUTO_EDIT_VIDEOS } from "@/lib/shotform-auto-edit-types"
import { runAutoEditAnalyzeAndMix } from "@/lib/shotform-auto-edit-analyze-pipeline"
import { benchmarkProductAnalysisFromAnalyses } from "@/lib/shotform-auto-edit-benchmark-fast"
import { buildOutputTimelineScenes } from "@/lib/shotform-visual-scene-match"
import {
  assertEditPlanMeetsTargetDuration,
  AUTO_EDIT_NO_USABLE_VIDEO_MESSAGE,
  buildEditPlanFromMix,
  buildQuickShoppingScript,
  enrichEditPlanWithCutCaptions,
  generateScriptFromMix,
} from "@/lib/shotform-auto-edit-mix"
import { autoEditDownloadUrl } from "@/lib/shotform-auto-edit-download"
import { resolveFfmpegPath } from "@/lib/ffmpeg-binaries"
import {
  createAutoEditWorkDir,
  downloadSourceVideo,
  renderEditPlanToMp4,
  saveUploadedVideoBuffer,
  validateRenderedMp4,
} from "@/lib/shotform-auto-edit-ffmpeg"
import { filterAnalysesForProductEdit } from "@/lib/shotform-auto-edit-product-filter"
import { putAutoEditJob } from "@/lib/shotform-auto-edit-jobs"
import { uploadAutoEditOutputToSupabase } from "@/lib/shotform-auto-edit-job-store"
import {
  isVmakeRouteNotFoundError,
  removeChineseSubtitlesFromLocalFile,
} from "@/lib/shotform-vmake-client"

function normalizeVideos(input: AutoEditInput): AutoEditVideoInput[] {
  return input.videos
    .filter((v) => v.videoUrl?.trim())
    .slice(0, MAX_AUTO_EDIT_VIDEOS)
    .map((v, i) => ({
      ...v,
      video_id: v.video_id || `video_${String(i + 1).padStart(3, "0")}`,
    }))
}

export async function runAutoEditPipeline(input: AutoEditInput): Promise<AutoEditJobResult> {
  const videos = normalizeVideos(input)
  if (!videos.length) {
    return { jobId: "", step: "error", error: "편집할 영상이 없습니다." }
  }

  const { dir, id: jobId } = input.presetWork ?? (await createAutoEditWorkDir())
  const createdAt = Date.now()
  const base: AutoEditJobResult = { jobId, step: "download", videoCount: videos.length }
  putAutoEditJob({ ...base, createdAt })

  const excludedVideos: AutoEditJobResult["excludedVideos"] = []

  try {
    resolveFfmpegPath()

    const sourcePaths: Record<string, string> = {}
    const uploads = input.uploadedVideos ?? {}
    const analysisMode = input.analysisMode ?? "fast"
    const clientVideoMeta = input.clientVideoMeta
    const canParallelAnalyze =
      analysisMode !== "precision" &&
      clientVideoMeta &&
      videos.length > 0 &&
      videos.every((v) => clientVideoMeta[v.video_id]?.keyframeDataUrl)

    const downloadAllSources = async () => {
      await Promise.all(
        videos.map(async (v) => {
          const sourcePath = path.join(dir, `source_${v.video_id}.mp4`)
          const uploaded = uploads[v.video_id]
          if (uploaded?.length) {
            await saveUploadedVideoBuffer(uploaded, sourcePath)
          } else {
            await downloadSourceVideo(v.videoUrl, sourcePath)
          }
          sourcePaths[v.video_id] = sourcePath
        })
      )
    }

    const runAnalyze = async () => {
      return runAutoEditAnalyzeAndMix({
        apiKey: input.openaiApiKey,
        videos,
        sourcePaths: canParallelAnalyze ? {} : sourcePaths,
        workDir: dir,
        targetDuration: input.targetDuration,
        analysisMode,
        clientVideoMeta,
        onPhase: (phase) => {
          if (phase === "mix") {
            putAutoEditJob({ ...base, step: "mix", createdAt })
          }
        },
      })
    }

    let analyses: Awaited<ReturnType<typeof runAutoEditAnalyzeAndMix>>["analyses"] = []
    let mixInfo: Awaited<ReturnType<typeof runAutoEditAnalyzeAndMix>>["mixInfo"]

    try {
      if (canParallelAnalyze) {
        putAutoEditJob({ ...base, step: "analyze", createdAt })
        const [, analyzed] = await Promise.all([downloadAllSources(), runAnalyze()])
        analyses = analyzed.analyses
        mixInfo = analyzed.mixInfo
        for (const fail of analyzed.failures) {
          excludedVideos.push({
            video_id: fail.video_id,
            title: fail.title,
            reason: fail.reason,
          })
        }
      } else {
        await downloadAllSources()
        putAutoEditJob({ ...base, step: "analyze", createdAt })
        const analyzed = await runAnalyze()
        analyses = analyzed.analyses
        mixInfo = analyzed.mixInfo
        for (const fail of analyzed.failures) {
          excludedVideos.push({
            video_id: fail.video_id,
            title: fail.title,
            reason: fail.reason,
          })
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "장면 분석 실패"
      throw new Error(msg)
    }

    const usable = filterAnalysesForProductEdit(analyses)
    for (const a of analyses) {
      if (usable.some((u) => u.video_id === a.video_id)) continue
      excludedVideos.push({
        video_id: a.video_id,
        title: a.title || a.video_id,
        reason: a.product_fit_reason || "분석 후 편집용 장면을 찾지 못해 제외했습니다.",
      })
    }
    if (!usable.length) {
      throw new Error(AUTO_EDIT_NO_USABLE_VIDEO_MESSAGE)
    }

    let productAnalysis = benchmarkProductAnalysisFromAnalyses(usable)

    putAutoEditJob({
      ...base,
      step: "mix",
      analyses: usable,
      analysis: usable[0],
      productAnalysis,
      mixInfo,
      excludedVideos,
      createdAt,
    })

    const videoIds = usable.map((a) => a.video_id)
    let { mixInfo: mixFinal, editPlan } = buildEditPlanFromMix(
      mixInfo,
      usable,
      videoIds,
      input.targetDuration
    )
    mixInfo = mixFinal
    assertEditPlanMeetsTargetDuration(editPlan)

    if (analysisMode === "precision" && input.openaiApiKey?.trim()) {
      const enriched = await enrichEditPlanWithCutCaptions({
        apiKey: input.openaiApiKey,
        editPlan,
        analyses: usable,
        sourcePaths,
        workDir: dir,
      })
      editPlan = enriched.editPlan
      for (const updated of enriched.analyses) {
        const idx = usable.findIndex((a) => a.video_id === updated.video_id)
        if (idx >= 0) usable[idx] = updated
      }
    }

    productAnalysis = {
      ...productAnalysis,
      scenes: buildOutputTimelineScenes(editPlan, usable, mixInfo),
      videoDuration: mixInfo.actualDuration,
    }

    putAutoEditJob({
      ...base,
      step: "edit_plan",
      analyses: usable,
      analysis: usable[0],
      productAnalysis,
      mixInfo,
      editPlan,
      excludedVideos,
      createdAt,
    })

    let downloadUrl: string | undefined
    let outputDuration: number | undefined
    let outputStoragePath: string | null | undefined
    let renderSkipped = false
    let renderSkipReason: string | undefined
    let subtitleRemovalSkipped = false
    let subtitleRemovalWarning: string | undefined
    const outputPath = path.join(dir, "output.mp4")
    const shouldRemoveSubtitles = Boolean(
      input.removeChineseSubtitles && input.vmakeApiKey?.trim() && input.vmakeSecretAccessKey?.trim()
    )

    putAutoEditJob({
      ...base,
      step: "render",
      analyses: usable,
      analysis: usable[0],
      productAnalysis,
      mixInfo,
      editPlan,
      excludedVideos,
      createdAt,
    })
    try {
      await renderEditPlanToMp4({
        sourcePaths,
        workDir: dir,
        segments: editPlan.edit_plan,
        outputPath,
        targetDuration: editPlan.target_duration,
        defaultVideoId: usable[0]!.video_id,
      })
      outputDuration = await validateRenderedMp4(outputPath, 1, editPlan.target_duration)

      if (shouldRemoveSubtitles) {
        putAutoEditJob({
          ...base,
          step: "subtitle_removal",
          analyses: usable,
          analysis: usable[0],
          productAnalysis,
          mixInfo,
          editPlan,
          excludedVideos,
          createdAt,
        })
        const cleanedPath = path.join(dir, "output_clean.mp4")
        try {
          await removeChineseSubtitlesFromLocalFile({
            apiKey: input.vmakeApiKey,
            secretAccessKey: input.vmakeSecretAccessKey,
            sourcePath: outputPath,
            outputPath: cleanedPath,
          })
          await fs.rename(cleanedPath, outputPath)
          outputDuration = await validateRenderedMp4(outputPath, 1, editPlan.target_duration)
        } catch (e) {
          if (isVmakeRouteNotFoundError(e)) {
            subtitleRemovalSkipped = true
            subtitleRemovalWarning = `${e.message} 짜집기 영상은 자막 제거 없이 사용합니다.`
            await fs.rm(cleanedPath, { force: true }).catch(() => undefined)
          } else {
            throw e
          }
        }
      }

      outputStoragePath = null
      for (let attempt = 0; attempt < 2; attempt++) {
        outputStoragePath = await uploadAutoEditOutputToSupabase(jobId, outputPath)
        if (outputStoragePath) break
      }
      if (process.env.VERCEL && !outputStoragePath) {
        throw new Error(
          "렌더는 완료됐지만 MP4를 Storage에 저장하지 못했습니다. Supabase video-sources 버킷·업로드 권한을 확인해 주세요."
        )
      }

      downloadUrl = autoEditDownloadUrl(jobId)
      putAutoEditJob({
        ...base,
        step: "render",
        analyses: usable,
        analysis: usable[0],
        productAnalysis,
        mixInfo,
        editPlan,
        excludedVideos,
        downloadUrl,
        outputDuration,
        createdAt,
        outputPath,
        outputStoragePath,
      })
    } catch (renderErr) {
      renderSkipped = true
      const msg = renderErr instanceof Error ? renderErr.message : String(renderErr)
      renderSkipReason =
        msg.includes("ffmpeg") || msg.includes("ENOENT")
          ? "서버 ffmpeg 렌더에 실패했습니다. 잠시 후 짜집기를 다시 실행해 주세요."
          : `짜집기 렌더 실패: ${msg.slice(0, 200)}`
      if (shouldRemoveSubtitles) {
        subtitleRemovalSkipped = true
        subtitleRemovalWarning = "렌더가 완료되지 않아 Vmake 자막 제거를 적용할 수 없습니다."
      }
    }

    putAutoEditJob({
      ...base,
      step: "script",
      analyses: usable,
      analysis: usable[0],
      productAnalysis,
      mixInfo,
      editPlan,
      excludedVideos,
      createdAt,
    })

    let script: Awaited<ReturnType<typeof generateScriptFromMix>>
    if (input.openaiApiKey?.trim()) {
      try {
        script = await generateScriptFromMix({
          apiKey: input.openaiApiKey,
          productAnalysis,
          mixInfo,
          editPlan,
          analyses: usable,
          scriptTopic: input.scriptTopic,
        })
      } catch {
        script = buildQuickShoppingScript(productAnalysis, editPlan, usable, mixInfo)
      }
    } else {
      script = buildQuickShoppingScript(productAnalysis, editPlan, usable, mixInfo)
    }

    const result: AutoEditJobResult = {
      jobId,
      step: "done",
      analyses: usable,
      analysis: usable[0],
      productAnalysis,
      mixInfo,
      editPlan,
      script,
      downloadUrl,
      outputDuration,
      renderSkipped,
      renderSkipReason,
      subtitleRemovalSkipped: subtitleRemovalSkipped || undefined,
      subtitleRemovalWarning,
      videoCount: usable.length,
      excludedVideos: excludedVideos.length ? excludedVideos : undefined,
    }
    putAutoEditJob({
      ...result,
      outputPath: renderSkipped ? undefined : outputPath,
      outputStoragePath: renderSkipped ? undefined : outputStoragePath ?? undefined,
      createdAt,
    })
    return result
  } catch (e) {
    const error = e instanceof Error ? e.message : "자동 편집 실패"
    const failed: AutoEditJobResult = {
      jobId,
      step: "error",
      error,
      videoCount: videos.length,
      excludedVideos: excludedVideos.length ? excludedVideos : undefined,
    }
    putAutoEditJob({ ...failed, createdAt })
    return failed
  }
}

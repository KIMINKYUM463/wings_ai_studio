import fs from "fs/promises"
import path from "path"
import type { AutoEditInput, AutoEditJobResult, AutoEditVideoInput } from "@/lib/shotform-auto-edit-types"
import { MAX_AUTO_EDIT_VIDEOS } from "@/lib/shotform-auto-edit-types"
import { runAutoEditAnalyzeAndMix } from "@/lib/shotform-auto-edit-analyze-pipeline"
import { normalizeUserSourceKeywords } from "@/lib/shotform-user-keyword-product"
import { buildOutputTimelineScenes } from "@/lib/shotform-visual-scene-match"
import { AUTO_EDIT_NO_USABLE_VIDEO_MESSAGE } from "@/lib/shotform-auto-edit-mix"
import { withTimeout } from "@/lib/shotform-auto-edit-script-step"
import { buildV2RemixPackage, type V2RemixPackage } from "@/lib/shotform-remix-v2-build"
import { VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS } from "@/lib/shotform-vmake-subtitle-removal"
import { autoEditDownloadUrl } from "@/lib/shotform-auto-edit-download"
import { resolveFfmpegPath, hasFfmpeg } from "@/lib/ffmpeg-binaries"
import {
  createAutoEditWorkDir,
  downloadSourceVideo,
  saveUploadedVideoBuffer,
  validateRenderedMp4,
} from "@/lib/shotform-auto-edit-ffmpeg"
import { shouldUseCloudRunForAutoEditRender } from "@/lib/shotform-auto-edit-cloud-run-render"
import { filterAnalysesForEmergencyEdit } from "@/lib/shotform-auto-edit-product-filter"
import {
  normalizeUsableAnalysesForMix,
  remapMixInfoSrcIndices,
} from "@/lib/shotform-analysis-src-index"
import { putAutoEditJob } from "@/lib/shotform-auto-edit-jobs"
import {
  copyCachedSourceToJob,
  createLocalAutoEditWorkDir,
  isLocalRenderAllowedOnServer,
  localJobOutputPath,
  normalizeLocalWorkDir,
  persistSourceToLocalCache,
  writeLocalJobArtifacts,
} from "@/lib/shotform-local-render-dir"
import {
  downloadAutoEditPrecisionMetaFromSupabase,
  downloadAutoEditSourceFromSupabase,
  uploadAutoEditOutputToSupabase,
} from "@/lib/shotform-auto-edit-job-store"
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

function formatAutoEditRenderError(msg: string): string {
  const lower = msg.toLowerCase()
  if (
    /다운로드 파일이 너무 작|invalid url|no scheme|403|404|forbidden|expired|video_mp4/i.test(
      lower
    )
  ) {
    return (
      "소스 영상 CDN 링크가 만료되었거나 렌더 서버에서 받을 수 없습니다. " +
      "「편집 실행」을 다시 누르거나, 소스 검색·URL 직접 입력으로 영상을 다시 추가해 주세요."
    )
  }
  if (/렌더용 소스 url|supabase|storage/i.test(lower)) {
    return msg.slice(0, 280)
  }
  return msg.length > 280 ? `${msg.slice(0, 280)}…` : msg
}

export async function runAutoEditPipeline(input: AutoEditInput): Promise<AutoEditJobResult> {
  const videos = normalizeVideos(input)
  if (!videos.length) {
    return { jobId: "", step: "error", error: "편집할 영상이 없습니다." }
  }

  const useLocalRender =
    input.renderMode === "local" &&
    Boolean(input.localWorkDir?.trim()) &&
    isLocalRenderAllowedOnServer()
  const deferLocalCompanionRender =
    input.renderMode === "local" &&
    Boolean(input.localWorkDir?.trim()) &&
    !isLocalRenderAllowedOnServer()
  const localWorkRoot = useLocalRender ? normalizeLocalWorkDir(input.localWorkDir!) : null
  const companionWorkDir = deferLocalCompanionRender ? input.localWorkDir!.trim() : undefined

  const { dir, id: jobId } =
    input.presetWork ??
    (useLocalRender && localWorkRoot
      ? await createLocalAutoEditWorkDir(localWorkRoot)
      : await createAutoEditWorkDir())
  const createdAt = Date.now()
  const sourceKeywords = normalizeUserSourceKeywords(input.sourceKeywords)
  const base: AutoEditJobResult = {
    jobId,
    step: "download",
    videoCount: videos.length,
    sourceKeywords: sourceKeywords.length ? sourceKeywords : undefined,
    renderMode: useLocalRender || deferLocalCompanionRender ? "local" : "server",
    localWorkDir: localWorkRoot ?? companionWorkDir,
  }
  putAutoEditJob({ ...base, createdAt })

  const excludedVideos: AutoEditJobResult["excludedVideos"] = []

  try {
    resolveFfmpegPath()
    if (useLocalRender && !hasFfmpeg()) {
      throw new Error(
        "로컬 ffmpeg를 찾지 못했습니다. npm install 후 npm run dev 로 실행하거나, 서버 렌더 모드를 사용해 주세요."
      )
    }

    const sourcePaths: Record<string, string> = {}
    const uploads = input.uploadedVideos ?? {}
    const analysisMode = input.analysisMode ?? "fast"
    let clientVideoMeta = input.clientVideoMeta
    if (analysisMode === "precision") {
      const merged: NonNullable<AutoEditInput["clientVideoMeta"]> = { ...(clientVideoMeta ?? {}) }
      for (const v of videos) {
        const existing = merged[v.video_id]
        if ((existing?.precisionKeyframes?.length ?? 0) >= 6) continue
        const remote = await downloadAutoEditPrecisionMetaFromSupabase(jobId, v.video_id)
        if (remote) merged[v.video_id] = { ...existing, ...remote }
      }
      if (Object.keys(merged).length) clientVideoMeta = merged
    }
    const canParallelAnalyze =
      analysisMode !== "precision" &&
      clientVideoMeta &&
      videos.length > 0 &&
      videos.every((v) => {
        const meta = clientVideoMeta[v.video_id]
        if (!meta || meta.duration <= 0) return false
        if (meta.keyframeDataUrl) return true
        return analysisMode === "fast"
      })

    const useCloudRunRender =
      !useLocalRender && !deferLocalCompanionRender && shouldUseCloudRunForAutoEditRender()
    const hasUploadedBuffers = videos.every((v) => uploads[v.video_id]?.length)
    const sourcesPreUploaded = Boolean(input.sourcesPreUploaded)
    const skipServerCdnDownload =
      hasUploadedBuffers ||
      sourcesPreUploaded ||
      deferLocalCompanionRender ||
      (useCloudRunRender && canParallelAnalyze)

    const downloadAllSources = async () => {
      await Promise.all(
        videos.map(async (v) => {
          if (sourcePaths[v.video_id]) return
          const sourcePath = path.join(dir, `source_${v.video_id}.mp4`)
          if (localWorkRoot && (await copyCachedSourceToJob(localWorkRoot, v.video_id, sourcePath))) {
            sourcePaths[v.video_id] = sourcePath
            return
          }
          const uploaded = uploads[v.video_id]
          if (uploaded?.length) {
            await saveUploadedVideoBuffer(uploaded, sourcePath)
            sourcePaths[v.video_id] = sourcePath
            if (localWorkRoot) await persistSourceToLocalCache(localWorkRoot, v.video_id, sourcePath)
            return
          }
          if (sourcesPreUploaded) {
            const remote = await downloadAutoEditSourceFromSupabase(jobId, v.video_id)
            if (remote?.length) {
              await saveUploadedVideoBuffer(remote, sourcePath)
              sourcePaths[v.video_id] = sourcePath
              if (localWorkRoot) await persistSourceToLocalCache(localWorkRoot, v.video_id, sourcePath)
              return
            }
          }
          await downloadSourceVideo(v.videoUrl, sourcePath)
          sourcePaths[v.video_id] = sourcePath
          if (localWorkRoot) await persistSourceToLocalCache(localWorkRoot, v.video_id, sourcePath)
        })
      )
    }

    let v2Pack: V2RemixPackage
    try {
      putAutoEditJob({ ...base, step: "download", createdAt })
      await downloadAllSources()
      v2Pack = await buildV2RemixPackage({
        jobId,
        videos,
        sourcePaths,
        keywords: sourceKeywords,
        scriptTemplateId: input.scriptTemplateId,
        mosaicMode: input.mosaicMode === "free" ? "free" : "paid",
        voice: {
          voiceId: input.ttsVoiceId ?? "",
          style: input.ttsVoiceStyle,
          speed: input.ttsSpeed,
          typecastApiKey: input.typecastApiKey,
          elevenlabsApiKey: input.elevenlabsApiKey,
        },
        onPhase: (phase) => {
          putAutoEditJob({
            ...base,
            step:
              phase === "script"
                ? "script"
                : phase === "edit_plan"
                  ? "mix"
                  : phase === "render"
                    ? "render"
                    : "analyze",
            createdAt,
          })
        },
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : "장면 나누기·대본 생성 실패"
      throw new Error(message)
    }

    const analyses: Awaited<ReturnType<typeof runAutoEditAnalyzeAndMix>>["analyses"] = v2Pack.analyses
    let mixInfo: Awaited<ReturnType<typeof runAutoEditAnalyzeAndMix>>["mixInfo"] = v2Pack.mixInfo

    let usable = analyses
    let usedEmergencyAnalyses = false
    for (const a of analyses) {
      if (usable.some((u) => u.video_id === a.video_id)) continue
      excludedVideos.push({
        video_id: a.video_id,
        title: a.title || a.video_id,
        reason: a.product_fit_reason || "분석 후 편집용 장면을 찾지 못해 제외했습니다.",
      })
    }
    if (!usable.length) {
      usable = filterAnalysesForEmergencyEdit(analyses)
      usedEmergencyAnalyses = usable.length > 0
      if (usedEmergencyAnalyses) {
        excludedVideos.push({
          video_id: "_mix_fallback",
          title: "짧은 버전 편집",
          reason: "편집용 안전 장면이 부족해 완화 규칙으로 짧은 영상을 만듭니다.",
        })
      }
    }
    if (!usable.length) {
      throw new Error(AUTO_EDIT_NO_USABLE_VIDEO_MESSAGE)
    }

    const { usable: usableNormalized, mixRemap } = normalizeUsableAnalysesForMix(analyses, usable)
    usable = usableNormalized
    if (mixInfo?.picks?.length) {
      mixInfo = remapMixInfoSrcIndices(mixInfo, mixRemap)
    }

    let productAnalysis = v2Pack.productAnalysis
    let editPlan = v2Pack.editPlan
    mixInfo = v2Pack.mixInfo

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
    if (localWorkRoot) {
      await writeLocalJobArtifacts({
        workRoot: localWorkRoot,
        jobId,
        meta: {
          step: "edit_plan",
          targetDuration: input.targetDuration,
          videoCount: videos.length,
          titles: videos.map((v) => v.title || v.video_id),
        },
        editPlan,
      })
    }

    let downloadUrl: string | undefined
    let outputDuration: number | undefined
    let outputStoragePath: string | null | undefined
    let renderSkipped = false
    let renderSkipReason: string | undefined
    let subtitleRemovalSkipped = false
    let subtitleRemovalWarning: string | undefined
    let localRenderPending = false
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
    if (!v2Pack.renderedVideoPath) {
      throw new Error("버전2 렌더 영상이 없습니다. 편집 실행을 다시 눌러 주세요.")
    }
    try {
      await fs.copyFile(v2Pack.renderedVideoPath, outputPath)
      outputDuration = await validateRenderedMp4(outputPath, 1)

      outputStoragePath = null
      if (!useLocalRender) {
        for (let attempt = 0; attempt < 2; attempt++) {
          outputStoragePath = await uploadAutoEditOutputToSupabase(jobId, outputPath)
          if (outputStoragePath) break
        }
        if (process.env.VERCEL && !outputStoragePath) {
          throw new Error(
            "렌더는 완료됐지만 MP4를 Storage에 저장하지 못했습니다. Supabase video-sources 버킷·업로드 권한을 확인해 주세요."
          )
        }
      }

      if (localWorkRoot) {
        await writeLocalJobArtifacts({
          workRoot: localWorkRoot,
          jobId,
          meta: {
            step: "render",
            outputPath,
            outputDuration,
            localOutputPath: localJobOutputPath(localWorkRoot, jobId),
          },
          editPlan,
        })
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
          downloadUrl,
          outputDuration,
          createdAt,
          outputPath,
          outputStoragePath,
        })
        const cleanedPath = path.join(dir, "output_clean.mp4")
        try {
          await withTimeout(
            removeChineseSubtitlesFromLocalFile({
              apiKey: input.vmakeApiKey,
              secretAccessKey: input.vmakeSecretAccessKey,
              sourcePath: outputPath,
              outputPath: cleanedPath,
            }),
            VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS,
            "Vmake 자막 제거 시간 초과(약 12분). 짜집기 영상은 자막 제거 없이 사용합니다."
          )
          await fs.rename(cleanedPath, outputPath)
          outputDuration = await validateRenderedMp4(
            outputPath,
            1,
            v2Pack.renderedVideoPath ? undefined : editPlan.target_duration,
          )
          outputStoragePath =
            (await uploadAutoEditOutputToSupabase(jobId, outputPath)) ?? outputStoragePath
        } catch (e) {
          subtitleRemovalSkipped = true
          const msg = e instanceof Error ? e.message : String(e)
          subtitleRemovalWarning = isVmakeRouteNotFoundError(e)
            ? `${msg} 짜집기 영상은 자막 제거 없이 사용합니다.`
            : `${msg} 정보 탭에서 나중에 다시 시도할 수 있습니다.`
          await fs.rm(cleanedPath, { force: true }).catch(() => undefined)
        }
      }
    } catch (renderErr) {
      const msg = renderErr instanceof Error ? renderErr.message : String(renderErr)
      throw new Error(
        msg.startsWith("버전2") ? msg : `버전2 렌더 영상을 저장하지 못했습니다: ${formatAutoEditRenderError(msg)}`
      )
    }

    const preScriptJob = {
      ...base,
      analyses: usable,
      analysis: usable[0],
      productAnalysis,
      mixInfo,
      editPlan,
      excludedVideos,
      downloadUrl,
      outputDuration,
      renderSkipped,
      renderSkipReason,
      subtitleRemovalSkipped: subtitleRemovalSkipped || undefined,
      subtitleRemovalWarning,
      createdAt,
      outputPath: renderSkipped ? undefined : outputPath,
      outputStoragePath: renderSkipped ? undefined : outputStoragePath ?? undefined,
      localOutputPath:
        !renderSkipped && localWorkRoot ? localJobOutputPath(localWorkRoot, jobId) : undefined,
      localRenderPending: localRenderPending || undefined,
    }

    putAutoEditJob({ ...preScriptJob, step: "script" })

    const script = v2Pack.script

    const result: AutoEditJobResult = {
      jobId,
      step: "done",
      sourceKeywords: sourceKeywords.length ? sourceKeywords : undefined,
      renderMode: useLocalRender || deferLocalCompanionRender ? "local" : "server",
      localWorkDir: localWorkRoot ?? companionWorkDir,
      localOutputPath:
        !renderSkipped && localWorkRoot ? localJobOutputPath(localWorkRoot, jobId) : undefined,
      localRenderPending: localRenderPending || undefined,
      analyses: usable,
      analysis: usable[0],
      productAnalysis,
      mixInfo,
      editPlan,
      script,
      voiceLineCues: v2Pack.voiceLineCues,
      v2Picture: true,
      mosaicMode: input.mosaicMode === "free" ? "free" : "paid",
      ttsVoiceId: input.ttsVoiceId,
      ttsVoiceStyle: input.ttsVoiceStyle,
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
      localOutputPath: result.localOutputPath,
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

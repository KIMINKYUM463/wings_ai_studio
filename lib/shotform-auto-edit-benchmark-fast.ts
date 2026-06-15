import fs from "fs/promises"
import path from "path"
import type {
  AutoEditAnalysisMode,
  AutoEditTargetDuration,
  AutoEditVideoInput,
  MixInfo,
  ProductAnalysis,
  SceneContentType,
  VideoAnalysis,
  VideoScene,
  VisualScene,
} from "@/lib/shotform-auto-edit-types"
import { AUTO_EDIT_ANALYSIS_MODE_DEFAULT } from "@/lib/shotform-auto-edit-types"
import { filterScenesForEdit } from "@/lib/shotform-auto-edit-product-filter"
import { boostSceneImportance, compareScenesByEditorialPriority } from "@/lib/shotform-scene-priority"
import {
  extractVideoKeyframeAtTime,
  extractVideoKeyframes,
  probeHasVideoStream,
  probeVideoDuration,
} from "@/lib/shotform-auto-edit-ffmpeg"
import {
  fillMixToTargetDuration,
  buildFallbackMix,
} from "@/lib/shotform-auto-edit-mix"
import { inferShotType } from "@/lib/shotform-visual-scene-match"
import type { ClientVideoMetaEntry } from "@/lib/shotform-client-video-meta"
import { visionClassifyFramesBatch } from "@/lib/shotform-auto-edit-vision"
import {
  type ActionFrameRow,
  buildActionScenesFromFrames,
  keyframeTimesForActionAnalysis,
  sampleKeyframeTimesAcrossDuration,
  refineActionScenesWithOpenAi,
  actionScenesToVideoScenes,
  actionScenesToVisualScenes,
} from "@/lib/shotform-scene-understanding"

async function writeDataUrlToJpeg(dataUrl: string, destPath: string): Promise<void> {
  const m = dataUrl.match(/^data:image\/\w+;base64,([\s\S]+)$/)
  if (!m?.[1]) throw new Error("키프레임 data URL이 올바르지 않습니다.")
  await fs.writeFile(destPath, Buffer.from(m[1], "base64"))
}

/** 행동 기반 분석용 키프레임 수 — 0.5~1초 간격 */
function keyframesForActionAnalysis(
  duration: number,
  mode: AutoEditAnalysisMode
): number {
  const interval = mode === "fast" ? 1 : 0.75
  return keyframeTimesForActionAnalysis(duration, interval).length
}

function keyframesForFastTarget(targetDuration: AutoEditTargetDuration): number {
  return Math.min(12, keyframesForActionAnalysis(targetDuration, "fast"))
}

function keyframesForBalancedTarget(targetDuration: AutoEditTargetDuration): number {
  return Math.min(18, keyframesForActionAnalysis(targetDuration, "balanced"))
}

const VISION_FAST_TIMEOUT_MS = 12_000

type BenchmarkModeConfig = {
  keyframeCount: number
  visionOnly: boolean
  fastKeyframes: boolean
  visionTimeoutMs: number | null
  productFitReason: string
}

function resolveBenchmarkModeConfig(
  mode: AutoEditAnalysisMode,
  targetDuration: AutoEditTargetDuration
): BenchmarkModeConfig {
  if (mode === "balanced") {
    return {
      keyframeCount: keyframesForBalancedTarget(targetDuration),
      visionOnly: false,
      fastKeyframes: false,
      visionTimeoutMs: null,
      productFitReason: "중간 모드 분석",
    }
  }
  const visionOnly = false
  return {
    keyframeCount: keyframesForFastTarget(targetDuration),
    visionOnly,
    fastKeyframes: mode === "fast",
    visionTimeoutMs: VISION_FAST_TIMEOUT_MS,
    productFitReason: "고속 행동 기반 Vision 분석",
  }
}

async function visionClassifyWithTimeout(
  apiKey: string,
  sources: Parameters<typeof visionClassifyFramesBatch>[1],
  timeoutMs: number | null
): Promise<Awaited<ReturnType<typeof visionClassifyFramesBatch>>> {
  if (!sources.length) return []
  if (timeoutMs == null) {
    try {
      return await visionClassifyFramesBatch(apiKey, sources)
    } catch {
      return []
    }
  }
  try {
    return await Promise.race([
      visionClassifyFramesBatch(apiKey, sources),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("vision timeout")), timeoutMs)
      }),
    ])
  } catch {
    return []
  }
}

function benchmarkTimelineForAnalysis(a: VideoAnalysis): VisualScene[] {
  if (a.visual_scenes?.length) return a.visual_scenes
  return a.scenes.map((s) => ({
    start: s.start,
    end: s.end,
    description: s.description,
    shot_type: inferShotType(s.description),
  }))
}

export function benchmarkProductAnalysisFromAnalyses(analyses: VideoAnalysis[]): ProductAnalysis {
  const first = analyses[0]!
  const keywords = new Set<string>()
  for (const a of analyses) {
    for (const k of a.targetKeywords ?? []) keywords.add(k)
  }
  return {
    productName: first.productName || first.title || "쇼핑 제품",
    category: first.category || "쇼핑",
    targetKeywords: [...keywords],
    videoStructure: first.videoStructure ?? { hook: "", body: "", cta: "" },
    summary:
      analyses
        .map((a) => a.summary)
        .filter(Boolean)
        .join(" ") || first.title,
    scenes: benchmarkTimelineForAnalysis(first).map((s) => ({
      start: s.start,
      end: s.end,
      description: s.description,
    })),
    videoDuration: Math.max(...analyses.map((a) => a.duration)),
  }
}

type SourceProbe = {
  video: AutoEditVideoInput
  sourcePath: string
  duration: number
  keyframes: Array<{ path: string; timeSec: number }>
}

function durationFallbackScenes(duration: number, title: string): VideoScene[] {
  const segmentCount = Math.min(5, Math.max(3, Math.ceil(duration / 8)))
  const span = duration / segmentCount
  return Array.from({ length: segmentCount }, (_, i) => ({
    start: Math.round(i * span * 10) / 10,
    end: Math.round(Math.min(duration, (i + 1) * span) * 10) / 10,
    description: `[미디엄샷] ${title || "영상"} ${i + 1}구간`,
    importance: 7,
    visual_type: "demo" as const,
    content_type: "product_in_use" as const,
  })).filter((sc) => sc.end > sc.start + 0.15)
}

type VisionFrameRow = {
  timeSec: number
  content_type: SceneContentType
  caption?: string
  shot_type?: string
  hand_action?: string
  product?: string
  product_use?: string
  ocr_text?: string
  scene_hint?: string
}

function visionRowsToActionFrames(rows: VisionFrameRow[]): ActionFrameRow[] {
  return rows.map((r) => ({
    timeSec: r.timeSec,
    content_type: r.content_type,
    caption: r.caption,
    shot_type: r.shot_type,
    hand_action: r.hand_action,
    product: r.product,
    product_use: r.product_use,
    ocr_text: r.ocr_text,
    scene_hint: r.scene_hint,
  }))
}

async function buildAnalysesFromActionVision(args: {
  apiKey: string
  probes: SourceProbe[]
  visionGrouped: Map<number, VisionFrameRow[]>
  productFitReason: string
  refineWithAi: boolean
}): Promise<VideoAnalysis[]> {
  const { apiKey, probes, visionGrouped, productFitReason, refineWithAi } = args
  return Promise.all(
    probes.map(async (p, srcIndex) => {
      const visionFrames = visionGrouped.get(srcIndex) ?? []
      const actionFrames = visionRowsToActionFrames(visionFrames)
      const action_scenes = refineWithAi
        ? await refineActionScenesWithOpenAi({
            apiKey,
            productTitle: p.video.title || p.video.video_id,
            duration: p.duration,
            frames: actionFrames,
          })
        : buildActionScenesFromFrames(actionFrames, p.duration)

      const visual_scenes = actionScenesToVisualScenes(action_scenes)
      let scenes = filterScenesForEdit(actionScenesToVideoScenes(action_scenes), visionFrames)
      if (!scenes.length) {
        scenes = filterScenesForEdit(durationFallbackScenes(p.duration, p.video.title || p.video.video_id))
      }
      scenes = boostSceneImportance(scenes).sort(compareScenesByEditorialPriority)

      return {
        video_id: p.video.video_id,
        title: p.video.title || p.video.video_id,
        platform: p.video.platform || "xiaohongshu",
        duration: p.duration,
        source_url: p.video.videoUrl,
        scenes,
        visual_scenes: visual_scenes.length ? visual_scenes : undefined,
        action_scenes,
        productName: p.video.title || "쇼핑 제품",
        category: "쇼핑",
        summary: p.video.title || "",
        videoStructure: {
          hook: "문제·후킹",
          body: "설치·사용·수납·기능",
          cta: "구매·마무리",
        },
        product_fit: "approved" as const,
        product_fit_reason: productFitReason,
        vision_frames: visionFrames,
        src_index: srcIndex,
      }
    })
  )
}

async function probeVideosForBenchmark(args: {
  videos: AutoEditVideoInput[]
  sourcePaths: Record<string, string>
  workDir: string
  keyframeCount: number
  fastKeyframes?: boolean
  clientVideoMeta?: Record<string, ClientVideoMetaEntry>
  lightProbe?: boolean
}): Promise<SourceProbe[]> {
  const { videos, sourcePaths, workDir, keyframeCount, fastKeyframes, clientVideoMeta, lightProbe } = args
  const probes = await Promise.all(
    videos.map(async (v) => {
      const client = clientVideoMeta?.[v.video_id]
      const kfDir = path.join(workDir, `fast_kf_${v.video_id}`)
      await fs.mkdir(kfDir, { recursive: true })

      if (client && client.duration > 0) {
        if (client.keyframeDataUrl) {
          const framePath = path.join(kfDir, "client_kf.jpg")
          try {
            await writeDataUrlToJpeg(client.keyframeDataUrl, framePath)
            return {
              video: v,
              sourcePath: sourcePaths[v.video_id] || "",
              duration: client.duration,
              keyframes: [{ path: framePath, timeSec: client.timeSec ?? client.duration * 0.12 }],
            }
          } catch {
            /* 클라이언트 키프레임 실패 시 서버 추출로 폴백 */
          }
        } else if (lightProbe) {
          return {
            video: v,
            sourcePath: sourcePaths[v.video_id] || "",
            duration: client.duration,
            keyframes: [],
          }
        }
      }

      const sourcePath = sourcePaths[v.video_id]
      if (!sourcePath) return null

      let duration: number
      if (lightProbe) {
        duration = await probeVideoDuration(sourcePath, false)
      } else {
        const [dur, hasVideo] = await Promise.all([
          probeVideoDuration(sourcePath, true),
          probeHasVideoStream(sourcePath),
        ])
        if (!hasVideo) {
          throw new Error(`${v.title || v.video_id}: 영상 화면 스트림이 없습니다.`)
        }
        duration = dur
      }

      let keyframes: Array<{ path: string; timeSec: number }> = []
      try {
        const times = sampleKeyframeTimesAcrossDuration(duration, Math.max(4, keyframeCount))
        if (times.length >= 4 && sourcePath) {
          const settled = await Promise.all(
            times.map((timeSec, i) =>
              extractVideoKeyframeAtTime(sourcePath, kfDir, duration, timeSec, `kf${i}`).catch(
                () => null
              )
            )
          )
          keyframes = settled.filter((row): row is { path: string; timeSec: number } => row != null)
        }
        if (!keyframes.length) {
          keyframes = await extractVideoKeyframes(sourcePath, kfDir, duration, Math.min(8, keyframeCount), {
            fast: fastKeyframes,
          })
        }
      } catch {
        /* 프레임 추출 실패 시 제목·길이만으로 분석 계속 */
      }
      return { video: v, sourcePath, duration, keyframes }
    })
  )
  return probes.filter((p): p is SourceProbe => p != null)
}

/** 벤치마킹 프로그램 방식 — Vision 1회 + (짧은 쇼츠는 로컬 mix) */
export async function benchmarkFastAnalyzeAndMix(args: {
  apiKey: string
  videos: AutoEditVideoInput[]
  sourcePaths: Record<string, string>
  workDir: string
  targetDuration: AutoEditTargetDuration
  analysisMode?: AutoEditAnalysisMode
  clientVideoMeta?: Record<string, ClientVideoMetaEntry>
  onPhase?: (phase: "keyframes" | "vision" | "mix") => void
}): Promise<{ analyses: VideoAnalysis[]; mixInfo: MixInfo }> {
  const { apiKey, videos, sourcePaths, workDir, targetDuration, onPhase, clientVideoMeta } = args
  const mode = args.analysisMode ?? AUTO_EDIT_ANALYSIS_MODE_DEFAULT
  const modeConfig = resolveBenchmarkModeConfig(mode, targetDuration)
  const { keyframeCount, visionOnly, fastKeyframes, visionTimeoutMs, productFitReason } = modeConfig
  const allClientKeyframes =
    clientVideoMeta &&
    videos.length > 0 &&
    videos.every((v) => clientVideoMeta[v.video_id]?.keyframeDataUrl)

  onPhase?.("keyframes")
  const probes = await probeVideosForBenchmark({
    videos,
    sourcePaths,
    workDir,
    keyframeCount,
    fastKeyframes,
    clientVideoMeta,
    lightProbe: mode === "fast" || Boolean(allClientKeyframes),
  })
  if (!probes.length) throw new Error("분석할 영상이 없습니다.")

  const visionSources = probes
    .map((p, srcIndex) => ({
      srcIndex,
      title: p.video.title || p.video.video_id,
      frames: p.keyframes,
    }))
    .filter((s) => s.frames.length > 0)

  onPhase?.("vision")
  const visionBySrc = visionSources.length
    ? visionOnly || visionTimeoutMs != null
      ? await visionClassifyWithTimeout(apiKey, visionSources, visionTimeoutMs)
      : await visionClassifyFramesBatch(apiKey, visionSources)
    : []

  const visionGrouped = new Map<number, VisionFrameRow[]>()
  for (const row of visionBySrc) {
    const list = visionGrouped.get(row.srcIndex) ?? []
    list.push({
      timeSec: row.timeSec,
      content_type: row.content_type,
      caption: row.caption,
      shot_type: row.shot_type,
      hand_action: row.hand_action,
      product: row.product,
      product_use: row.product_use,
      ocr_text: row.ocr_text,
      scene_hint: row.scene_hint,
    })
    visionGrouped.set(row.srcIndex, list)
  }

  onPhase?.("mix")
  const analyses = await buildAnalysesFromActionVision({
    apiKey,
    probes,
    visionGrouped,
    productFitReason,
    refineWithAi: mode !== "fast" || !visionTimeoutMs,
  })
  const mixInfo = fillMixToTargetDuration(
    buildFallbackMix(analyses, targetDuration),
    analyses,
    targetDuration
  )
  return { analyses, mixInfo }
}

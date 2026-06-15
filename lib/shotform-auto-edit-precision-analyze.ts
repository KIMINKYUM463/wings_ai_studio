import fs from "fs/promises"
import path from "path"
import type { AutoEditVideoInput, SceneContentType, VideoAnalysis } from "@/lib/shotform-auto-edit-types"
import { extractVideoKeyframeAtTime, probeHasVideoStream, probeVideoDuration } from "@/lib/shotform-auto-edit-ffmpeg"
import { filterScenesForEdit } from "@/lib/shotform-auto-edit-product-filter"
import { boostSceneImportance, compareScenesByEditorialPriority } from "@/lib/shotform-scene-priority"
import {
  actionScenesToVideoScenes,
  actionScenesToVisualScenes,
  refineActionScenesWithOpenAi,
  sampleKeyframeTimesAcrossDuration,
} from "@/lib/shotform-scene-understanding"
import { visionClassifyFramesBatch } from "@/lib/shotform-auto-edit-vision"

/** 정밀 모드 — 단일 URL 소스 최대 분석 길이(초) */
export const PRECISION_MAX_SOURCE_ANALYSIS_SEC = 120

/** 정밀 모드 키프레임 수 (2분 구간에 골고루) */
export const PRECISION_KEYFRAME_COUNT = 36

export type PrecisionAnalyzeResult =
  | { ok: true; analysis: VideoAnalysis; src_index: number }
  | { ok: false; video_id: string; title: string; reason: string }

function durationFallbackScenes(duration: number, title: string): VideoAnalysis["scenes"] {
  const segmentCount = Math.min(8, Math.max(4, Math.ceil(duration / 10)))
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

/** 정밀 모드 — URL 1개 최대 2분 구간 행동 기반 심층 분석 */
export async function analyzeOneVideoPrecision(args: {
  apiKey: string
  video: AutoEditVideoInput
  sourcePath: string
  workDir: string
  srcIndex: number
}): Promise<PrecisionAnalyzeResult> {
  const { apiKey, video, sourcePath, workDir, srcIndex } = args
  const title = video.title || video.video_id

  let duration: number
  try {
    duration = await probeVideoDuration(sourcePath, true)
  } catch {
    return { ok: false, video_id: video.video_id, title, reason: "영상 길이를 읽지 못했습니다." }
  }

  if (!(await probeHasVideoStream(sourcePath))) {
    return { ok: false, video_id: video.video_id, title, reason: "영상 화면 스트림이 없습니다." }
  }

  const analysisSpan = Math.min(duration, PRECISION_MAX_SOURCE_ANALYSIS_SEC)
  const kfDir = path.join(workDir, `precision_kf_${video.video_id}`)
  await fs.mkdir(kfDir, { recursive: true })

  const times = sampleKeyframeTimesAcrossDuration(analysisSpan, PRECISION_KEYFRAME_COUNT)
  const keyframes: Array<{ path: string; timeSec: number }> = []

  for (let i = 0; i < times.length; i++) {
    try {
      const row = await extractVideoKeyframeAtTime(sourcePath, kfDir, duration, times[i]!, `pkf${i}`)
      keyframes.push(row)
    } catch {
      /* 일부 프레임 실패 허용 */
    }
  }

  if (!keyframes.length) {
    return { ok: false, video_id: video.video_id, title, reason: "정밀 분석용 키프레임 추출에 실패했습니다." }
  }

  const visionBySrc = await visionClassifyFramesBatch(apiKey, [
    {
      srcIndex: 0,
      title,
      frames: keyframes,
    },
  ])

  const visionFrames = visionBySrc.map((row) => ({
    timeSec: row.timeSec,
    content_type: row.content_type as SceneContentType,
    caption: row.caption,
    shot_type: row.shot_type,
    hand_action: row.hand_action,
    product: row.product,
    product_use: row.product_use,
    ocr_text: row.ocr_text,
    scene_hint: row.scene_hint,
  }))

  const actionFrames = visionFrames.map((r) => ({
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
  const action_scenes = await refineActionScenesWithOpenAi({
    apiKey,
    productTitle: title,
    duration: analysisSpan,
    frames: actionFrames,
  })

  const visual_scenes = actionScenesToVisualScenes(action_scenes)
  let scenes = filterScenesForEdit(actionScenesToVideoScenes(action_scenes), visionFrames)
  if (!scenes.length) {
    scenes = filterScenesForEdit(durationFallbackScenes(duration, title))
  }
  scenes = boostSceneImportance(scenes).sort(compareScenesByEditorialPriority)

  if (!scenes.length) {
    return { ok: false, video_id: video.video_id, title, reason: "정밀 분석 장면을 만들지 못했습니다." }
  }

  return {
    ok: true,
    src_index: srcIndex,
    analysis: {
      video_id: video.video_id,
      title,
      platform: video.platform || "xiaohongshu",
      duration,
      source_url: video.videoUrl,
      scenes,
      visual_scenes: visual_scenes.length ? visual_scenes : undefined,
      action_scenes,
      productName: title,
      category: "쇼핑",
      summary: `${title} · 정밀 행동 분석 (${analysisSpan.toFixed(0)}초 구간)`,
      videoStructure: {
        hook: "문제·후킹",
        body: "설치·사용·기능·수납",
        cta: "구매·마무리",
      },
      product_fit: "approved",
      product_fit_reason: `정밀 행동 분석 (${keyframes.length}프레임·${analysisSpan.toFixed(0)}초)`,
      vision_frames: visionFrames,
      src_index: srcIndex,
    },
  }
}

import fs from "fs/promises"
import path from "path"
import type { AutoEditVideoInput, ClientVideoMetaEntry, SceneContentType, VideoAnalysis } from "@/lib/shotform-auto-edit-types"
import {
  extractPrecisionKeyframes,
  hasFfmpeg,
  probeHasVideoStream,
  probeVideoDuration,
} from "@/lib/shotform-auto-edit-ffmpeg"
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
export const PRECISION_KEYFRAME_COUNT = 28

export type PrecisionAnalyzeResult =
  | { ok: true; analysis: VideoAnalysis; src_index: number }
  | { ok: false; video_id: string; title: string; reason: string }

async function writeDataUrlToJpeg(dataUrl: string, destPath: string): Promise<void> {
  const m = dataUrl.match(/^data:image\/\w+;base64,([\s\S]+)$/)
  if (!m?.[1]) throw new Error("키프레임 data URL이 올바르지 않습니다.")
  await fs.writeFile(destPath, Buffer.from(m[1], "base64"))
}

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

async function keyframesFromClientMeta(
  clientMeta: ClientVideoMetaEntry | undefined,
  kfDir: string,
  duration: number,
  analysisSpan: number
): Promise<Array<{ path: string; timeSec: number }> | null> {
  const clientFrames = clientMeta?.precisionKeyframes?.filter((f) => f.keyframeDataUrl?.startsWith("data:image/"))
  if (clientFrames && clientFrames.length >= 6) {
    const out: Array<{ path: string; timeSec: number }> = []
    for (let i = 0; i < clientFrames.length; i++) {
      const row = clientFrames[i]!
      const framePath = path.join(kfDir, `client_${i}.jpg`)
      await writeDataUrlToJpeg(row.keyframeDataUrl, framePath)
      out.push({ path: framePath, timeSec: row.timeSec })
    }
    return out
  }
  return null
}

/** 정밀 모드 — URL 1개 최대 2분 구간 행동 기반 심층 분석 */
export async function analyzeOneVideoPrecision(args: {
  apiKey: string
  video: AutoEditVideoInput
  sourcePath: string
  workDir: string
  srcIndex: number
  clientMeta?: ClientVideoMetaEntry
}): Promise<PrecisionAnalyzeResult> {
  const { apiKey, video, sourcePath, workDir, srcIndex, clientMeta } = args
  const title = video.title || video.video_id

  let duration = clientMeta?.duration ?? 0
  if (!duration || duration <= 0) {
    try {
      await fs.access(sourcePath)
      duration = await probeVideoDuration(sourcePath, true)
    } catch {
      if (!clientMeta?.precisionKeyframes?.length) {
        return {
          ok: false,
          video_id: video.video_id,
          title,
          reason: "원본 영상을 읽지 못했습니다. 브라우저에서 영상 준비가 끝난 뒤 다시 실행해 주세요.",
        }
      }
      duration = Math.max(
        ...clientMeta.precisionKeyframes.map((f) => f.timeSec),
        PRECISION_MAX_SOURCE_ANALYSIS_SEC * 0.5
      )
    }
  }

  const analysisSpan = Math.min(duration, PRECISION_MAX_SOURCE_ANALYSIS_SEC)
  const kfDir = path.join(workDir, `precision_kf_${video.video_id}`)
  await fs.mkdir(kfDir, { recursive: true })

  let keyframes: Array<{ path: string; timeSec: number }> | null = await keyframesFromClientMeta(
    clientMeta,
    kfDir,
    duration,
    analysisSpan
  )

  if (!keyframes?.length) {
    if (!hasFfmpeg()) {
      return {
        ok: false,
        video_id: video.video_id,
        title,
        reason:
          "브라우저 키프레임이 서버에 전달되지 않았습니다. 페이지를 새로고침한 뒤 정밀 모드로 다시 실행해 주세요.",
      }
    }
    try {
      await fs.access(sourcePath)
      const stat = await fs.stat(sourcePath)
      if (stat.size < 50_000) {
        return {
          ok: false,
          video_id: video.video_id,
          title,
          reason: "원본 영상 파일이 비어 있습니다. 페이지 새로고침 후 다시 시도해 주세요.",
        }
      }
      if (!(await probeHasVideoStream(sourcePath))) {
        return {
          ok: false,
          video_id: video.video_id,
          title,
          reason: "서버 영상 디코딩 실패. 정밀 모드는 브라우저 키프레임 캡처가 필요합니다 — 잠시 후 재시도해 주세요.",
        }
      }
      const times = sampleKeyframeTimesAcrossDuration(analysisSpan, PRECISION_KEYFRAME_COUNT)
      keyframes = await extractPrecisionKeyframes(sourcePath, kfDir, duration, times)
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        video_id: video.video_id,
        title,
        reason: `정밀 분석용 키프레임 추출 실패: ${detail.slice(0, 120)}`,
      }
    }
  }

  if (!keyframes?.length) {
    return {
      ok: false,
      video_id: video.video_id,
      title,
      reason:
        "브라우저 키프레임 캡처에 실패했습니다. 영상 링크가 만료됐을 수 있으니 소스를 다시 추가한 뒤 정밀 모드로 실행해 주세요.",
    }
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
      product_fit_reason: `정밀 행동 분석 (${keyframes.length}프레임·${analysisSpan.toFixed(0)}초${clientMeta?.precisionKeyframes?.length ? "·브라우저" : ""})`,
      vision_frames: visionFrames,
      src_index: srcIndex,
    },
  }
}

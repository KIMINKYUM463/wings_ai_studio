import path from "path"
import type { AutoEditVideoInput } from "@/lib/shotform-auto-edit-types"
import { analyzeVideoWithAi } from "@/lib/shotform-auto-edit-ai"
import { probeHasVideoStream, probeVideoDuration } from "@/lib/shotform-auto-edit-ffmpeg"
import { screenVideoForProductContent } from "@/lib/shotform-auto-edit-vision"

export type AnalyzeOneVideoResult =
  | {
      ok: true
      analysis: Awaited<ReturnType<typeof analyzeVideoWithAi>>
      src_index: number
    }
  | {
      ok: false
      video_id: string
      title: string
      reason: string
    }

/** 영상 1개 — 벤치마킹 방식(경량 Vision + 의미 장면 분석) */
export async function analyzeOneVideoForAutoEdit(args: {
  apiKey: string
  video: AutoEditVideoInput
  sourcePath: string
  workDir: string
  srcIndex: number
}): Promise<AnalyzeOneVideoResult> {
  const { apiKey, video, sourcePath, workDir, srcIndex } = args
  const title = video.title || video.video_id

  let duration: number
  try {
    duration = await probeVideoDuration(sourcePath, true)
  } catch {
    return { ok: false, video_id: video.video_id, title, reason: "영상 길이를 읽지 못했습니다." }
  }

  if (!(await probeHasVideoStream(sourcePath))) {
    return {
      ok: false,
      video_id: video.video_id,
      title,
      reason: "영상 화면 스트림이 없습니다.",
    }
  }

  let vision: Awaited<ReturnType<typeof screenVideoForProductContent>>
  try {
    vision = await screenVideoForProductContent({
      apiKey,
      title: title || "쇼핑 숏폼",
      sourcePath,
      workDir: path.join(workDir, `vision_${video.video_id}`),
      duration,
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : "프레임 추출 실패"
    return {
      ok: false,
      video_id: video.video_id,
      title,
      reason: `영상 분석 준비 실패: ${detail.slice(0, 100)}`,
    }
  }

  const analysis = await analyzeVideoWithAi({
    apiKey,
    videoId: video.video_id,
    title: title || "쇼핑 숏폼",
    platform: video.platform || "xiaohongshu",
    duration,
    sourceUrl: video.videoUrl,
    vision,
  })

  if (!analysis.scenes.length) {
    return {
      ok: false,
      video_id: video.video_id,
      title,
      reason: "편집용 장면을 찾지 못했습니다.",
    }
  }

  return { ok: true, analysis: { ...analysis, src_index: srcIndex }, src_index: srcIndex }
}

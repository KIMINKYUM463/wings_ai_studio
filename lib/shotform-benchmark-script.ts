import type {
  EditPlan,
  MixInfo,
  SceneSubtitleBlock,
  ShotFormScriptBundle,
  VideoAnalysis,
  VisualScene,
} from "@/lib/shotform-auto-edit-types"
import { formatNarrationForSceneDuration } from "@/lib/shotform-narration-timing"
import {
  MAX_SCENE_BLOCK_SEC,
  buildCutScriptContexts,
  analysisByVideoId,
  formatBenchmarkSceneCard,
  visualSceneForSourceRange,
  type CutScriptContext,
} from "@/lib/shotform-visual-scene-match"

/** 벤치마킹 프로그램 실제 출력 (28.3초 청소기) — 프롬프트·검증 참고 */
export const BENCHMARK_SCRIPT_REFERENCE: ShotFormScriptBundle = {
  scripts: {
    conversion:
      "강력한 흡입력으로\n차량 틈새 먼지까지\n싹 제거하세요\n흡입 송풍\n일체형 디자인\n차량 컵홀더는 물론\n시트 틈새까지\n깔끔하게 청소하세요\n먼지 종이 조각도\n말끔하게 흡입\n발 매트도 걱정 마세요\n소파 틈새는 물론\n창문 틈새까지\n필터는 물로 헹구고\n쓰레기는 간편하게\n다양한 노즐로\n틈새까지 완벽 청소\n휴대성까지 완벽\n여행 캠핑 가정 모두",
    storytelling:
      "차량 내부 틈새\n청소하기 힘드셨죠?\n이젠 간편하게 해결\n흡입은 기본\n송풍까지 된다고\n차량 구석구석\n청소 고민은 그만\n완벽하게 해결해요\n이제 찌든 얼룩도\n먼지 걱정도 끝\n차 안은 항상 새 차처럼\n집 안 구석구석\n숨은 먼지도 싹\n필터 물 세척으로\n관리까지 간편하게\n필요에 따라\n노즐 변경도 OK\n여행 캠핑 가정\n어디든 유용하게",
  },
  headcopies: [
    ["차량 청소의 끝판왕", "이제 더 이상 망설이지 마세요"],
    ["흡입은 물론 송풍까지", "이 모든 걸 하나로 해결"],
    ["어디든 깨끗하게", "itutn 무선 청소기"],
  ],
  commentKeyword: "청소꿀템",
  sceneSubtitles: {
    conversion: [
      { start: 0, end: 5, text: "강력한 흡입력으로\n차량 틈새 먼지까지\n싹 제거하세요" },
      { start: 5, end: 7.5, text: "흡입 송풍\n일체형 디자인" },
      { start: 7.5, end: 12, text: "차량 컵홀더는 물론\n시트 틈새까지\n깔끔하게 청소하세요" },
      { start: 12, end: 17, text: "먼지 종이 조각도\n말끔하게 흡입\n발 매트도 걱정 마세요" },
      { start: 17, end: 19.5, text: "소파 틈새는 물론\n창문 틈새까지" },
      { start: 19.5, end: 22.5, text: "필터는 물로 헹구고\n쓰레기는 간편하게" },
      { start: 22.5, end: 24.5, text: "다양한 노즐로\n틈새까지 완벽 청소" },
      { start: 24.5, end: 28.3, text: "휴대성까지 완벽\n여행 캠핑 가정 모두" },
    ],
    storytelling: [
      { start: 0, end: 5, text: "차량 내부 틈새\n청소하기 힘드셨죠?\n이젠 간편하게 해결" },
      { start: 5, end: 7.5, text: "흡입은 기본\n송풍까지 된다고" },
      { start: 7.5, end: 12, text: "차량 구석구석\n청소 고민은 그만\n완벽하게 해결해요" },
      { start: 12, end: 17, text: "이제 찌든 얼룩도\n먼지 걱정도 끝\n차 안은 항상 새 차처럼" },
      { start: 17, end: 19.5, text: "집 안 구석구석\n숨은 먼지도 싹" },
      { start: 19.5, end: 22.5, text: "필터 물 세척으로\n관리까지 간편하게" },
      { start: 22.5, end: 24.5, text: "필요에 따라\n노즐 변경도 OK" },
      { start: 24.5, end: 28.3, text: "여행 캠핑 가정\n어디든 유용하게" },
    ],
  },
}

export type BenchmarkSceneBlock = {
  start: number
  end: number
  duration: number
  visual_card: string
  /** 장면당 권장 짧은 줄 수 */
  target_lines: number
}

/** 장면 길이 → 벤치마크 스타일 짧은 줄 개수 */
export function targetLineCountForScene(sceneDurSec: number): number {
  const d = Math.max(0.5, sceneDurSec)
  if (d <= 2.5) return 2
  if (d <= 4) return 3
  if (d <= 9) return Math.max(4, Math.round(d / 1.35))
  return Math.min(10, Math.max(6, Math.round(d / 1.55)))
}

function sceneMergeKey(ctx: CutScriptContext, byId: Map<string, VideoAnalysis>): string {
  const a = byId.get(ctx.video_id)
  const sc = a ? visualSceneForSourceRange(a, ctx.source_start, ctx.source_end) : null
  const desc = (sc?.description || ctx.reason || ctx.visual_card).trim()
  const shot = sc?.shot_type || ""
  return `${shot}:${desc.slice(0, 36)}`
}

/** 출력 타임라인 productAnalysis.scenes → sceneSubtitles 블록 */
export function buildBenchmarkSceneBlocksFromProductScenes(
  scenes: VisualScene[],
  targetDuration: number
): BenchmarkSceneBlock[] {
  if (!scenes.length) {
    return [
      {
        start: 0,
        end: targetDuration,
        duration: targetDuration,
        visual_card: "장면",
        target_lines: targetLineCountForScene(targetDuration),
      },
    ]
  }

  return scenes.map((s) => {
    const end = Math.min(targetDuration, s.end)
    const duration = Math.round((end - s.start) * 10) / 10
    return {
      start: s.start,
      end,
      duration,
      visual_card: formatBenchmarkSceneCard({ ...s, end }),
      target_lines: targetLineCountForScene(duration),
    }
  })
}

/** 출력 타임라인 — 벤치마크 sceneSubtitles 블록 (가변 길이, 장면 분석 기준 병합) */
export function buildBenchmarkSceneBlocksFromEditPlan(
  editPlan: EditPlan,
  analyses: VideoAnalysis[],
  mixInfo?: MixInfo,
  outputScenes?: VisualScene[]
): BenchmarkSceneBlock[] {
  if (outputScenes?.length) {
    return buildBenchmarkSceneBlocksFromProductScenes(outputScenes, editPlan.target_duration)
  }

  const contexts = buildCutScriptContexts(editPlan, analyses, mixInfo)
  const targetDuration = editPlan.target_duration
  const byId = analysisByVideoId(analyses)

  if (!contexts.length) {
    return [
      {
        start: 0,
        end: targetDuration,
        duration: targetDuration,
        visual_card: "장면",
        target_lines: targetLineCountForScene(targetDuration),
      },
    ]
  }

  const blocks: Array<{ start: number; end: number; visual_card: string; mergeKey: string }> = []
  let current: (typeof blocks)[number] | null = null

  for (const ctx of contexts) {
    const key = sceneMergeKey(ctx, byId)
    const segDur = ctx.output_end - ctx.output_start
    const canMerge =
      current &&
      key === current.mergeKey &&
      ctx.output_start - current.end < 2.5 &&
      current.end - current.start + segDur <= MAX_SCENE_BLOCK_SEC + 0.05
    if (canMerge && current) {
      current.end = ctx.output_end
    } else {
      current = {
        start: ctx.output_start,
        end: ctx.output_end,
        visual_card: ctx.visual_card,
        mergeKey: key,
      }
      blocks.push(current)
    }
  }

  return blocks.map((b) => {
    const duration = Math.round((b.end - b.start) * 10) / 10
    return {
      ...b,
      duration,
      target_lines: targetLineCountForScene(duration),
    }
  })
}

export function assembleScriptBundleFromScenes(
  scenes: SceneSubtitleBlock[],
  headcopies: string[][],
  commentKeyword: string
): ShotFormScriptBundle {
  const conversionText = scenes.map((s) => s.text.trim()).filter(Boolean).join("\n")
  const storytellingScenes = scenes.map((s) => ({ ...s }))
  return {
    scripts: { conversion: conversionText, storytelling: conversionText },
    headcopies,
    commentKeyword,
    sceneSubtitles: {
      conversion: scenes,
      storytelling: storytellingScenes,
    },
  }
}

export function formatSceneNarrationLines(text: string, sceneDurSec: number): string {
  return formatNarrationForSceneDuration(text, sceneDurSec)
}

/** 벤치마크 JSON few-shot (프롬프트용, 축약) */
export function benchmarkScriptFewShotJson(): string {
  return JSON.stringify(
    {
      scripts: BENCHMARK_SCRIPT_REFERENCE.scripts,
      headcopies: BENCHMARK_SCRIPT_REFERENCE.headcopies,
      commentKeyword: BENCHMARK_SCRIPT_REFERENCE.commentKeyword,
      sceneSubtitles: {
        conversion: BENCHMARK_SCRIPT_REFERENCE.sceneSubtitles.conversion,
        storytelling: BENCHMARK_SCRIPT_REFERENCE.sceneSubtitles.storytelling,
      },
    },
    null,
    0
  )
}

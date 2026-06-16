import type {
  AutoEditAnalysisMode,
  AutoEditJobResult,
  EditPlan,
  MixInfo,
  ProductAnalysis,
  SceneSubtitleBlock,
  ShoppingScript,
  VideoAnalysis,
} from "@/lib/shotform-auto-edit-types"
import { formatSceneNarrationLines } from "@/lib/shotform-benchmark-script"
import { buildQuickShoppingScript, generateScriptFromMix } from "@/lib/shotform-auto-edit-mix"
import {
  auditShoppingScriptWithAi,
  generatePrecisionScriptFromMix,
} from "@/lib/shotform-auto-edit-precision-script"
import {
  detectShoppingScriptQualityIssues,
  mitigateProductNameSpam,
} from "@/lib/shotform-narration-script-audit"
import {
  detectObviousProductCategoryLeak,
  normalizeUserSourceKeywords,
  primaryProductLabelFromKeywords,
} from "@/lib/shotform-user-keyword-product"
import { applyFlowRhythmToScript } from "@/lib/shotform-narration-flow-rhythm"

export const AUTO_EDIT_SCRIPT_TIMEOUT_MS = 120_000
export const AUTO_EDIT_PRECISION_SCRIPT_TIMEOUT_MS = 150_000

export async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function mergeAuditedScenesIntoScript(
  script: ShoppingScript,
  scenes: SceneSubtitleBlock[],
  editPlan: EditPlan
): ShoppingScript {
  const bundle = script.bundle
  if (!bundle) return script
  return {
    ...script,
    bundle: {
      ...bundle,
      sceneSubtitles: {
        ...bundle.sceneSubtitles,
        conversion: scenes,
      },
    },
    script: editPlan.edit_plan.map((seg, i) => ({
      start: seg.output_start,
      end: seg.output_end,
      text: scenes[i]?.text ?? "",
      video_id: seg.video_id,
    })),
  }
}

async function auditFastModeScript(args: {
  apiKey: string
  script: ShoppingScript
  productAnalysis: ProductAnalysis
  editPlan: EditPlan
  analyses: VideoAnalysis[]
  userKeywords: readonly string[]
}): Promise<ShoppingScript> {
  const { apiKey, script, productAnalysis, editPlan, analyses, userKeywords } = args
  const conversion = script.bundle?.sceneSubtitles?.conversion
  if (!conversion?.length) return script

  const primary = primaryProductLabelFromKeywords(userKeywords, productAnalysis.productName)
  const lines = conversion.map((s) => s.text)
  const issueSamples = [
    ...detectObviousProductCategoryLeak(lines, userKeywords),
    ...detectShoppingScriptQualityIssues(lines, primary),
  ]

  let scenes = await auditShoppingScriptWithAi({
    apiKey,
    userKeywords,
    productAnalysis,
    editPlan,
    analyses,
    scenes: conversion,
    targetDuration: editPlan.target_duration,
    issueSamples,
  })

  const mitigated = mitigateProductNameSpam(
    scenes.map((s) => s.text),
    primary
  )
  const flowed = applyFlowRhythmToScript(mitigated)
  scenes = scenes.map((s, i) => {
    const seg = editPlan.edit_plan[i]
    const dur = seg ? Math.max(0.5, seg.output_end - seg.output_start) : s.end - s.start
    return {
      ...s,
      text: formatSceneNarrationLines(flowed[i] ?? mitigated[i] ?? s.text, dur),
    }
  })

  return mergeAuditedScenesIntoScript(script, scenes, editPlan)
}

export async function resolveAutoEditScript(args: {
  openaiApiKey?: string
  scriptTopic?: string
  productAnalysis: ProductAnalysis
  mixInfo: MixInfo
  editPlan: EditPlan
  analyses: VideoAnalysis[]
  analysisMode?: AutoEditAnalysisMode
  sourceKeywords?: readonly string[]
  timeoutMs?: number
}): Promise<ShoppingScript> {
  const userKeywords = normalizeUserSourceKeywords(
    args.sourceKeywords?.length ? args.sourceKeywords : args.productAnalysis.targetKeywords
  )
  const quick = buildQuickShoppingScript(
    args.productAnalysis,
    args.editPlan,
    args.analyses,
    args.mixInfo,
    userKeywords
  )
  const apiKey = args.openaiApiKey?.trim()
  if (!apiKey) return quick

  const isPrecision = args.analysisMode === "precision"
  const timeout =
    args.timeoutMs ??
    (isPrecision ? AUTO_EDIT_PRECISION_SCRIPT_TIMEOUT_MS : AUTO_EDIT_SCRIPT_TIMEOUT_MS)

  try {
    if (isPrecision) {
      return await withTimeout(
        generatePrecisionScriptFromMix({
          apiKey,
          productAnalysis: args.productAnalysis,
          mixInfo: args.mixInfo,
          editPlan: args.editPlan,
          analyses: args.analyses,
          scriptTopic: args.scriptTopic,
          sourceKeywords: userKeywords,
        }),
        timeout,
        "정밀 모드 대본 검증 시간 초과"
      )
    }
    const script = await withTimeout(
      (async () => {
        const draft = await generateScriptFromMix({
          apiKey,
          productAnalysis: args.productAnalysis,
          mixInfo: args.mixInfo,
          editPlan: args.editPlan,
          analyses: args.analyses,
          scriptTopic: args.scriptTopic,
          sourceKeywords: userKeywords,
        })
        return auditFastModeScript({
          apiKey,
          script: draft,
          productAnalysis: args.productAnalysis,
          editPlan: args.editPlan,
          analyses: args.analyses,
          userKeywords,
        })
      })(),
      timeout,
      "장면맞춤 나레이션 생성·검수 시간 초과"
    )

    return script
  } catch (e) {
    console.warn("[auto-edit] AI narration failed, using quick script:", e)
    return quick
  }
}

/** script 단계에서 멈춘 job을 기본 나레이션으로 완료 */
export function finalizeAutoEditJobWithScript(
  job: AutoEditJobResult & { createdAt?: number },
  script: ShoppingScript
): AutoEditJobResult {
  return {
    ...job,
    step: "done",
    script,
  }
}

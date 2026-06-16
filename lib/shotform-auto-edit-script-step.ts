import type {
  AutoEditAnalysisMode,
  AutoEditJobResult,
  EditPlan,
  MixInfo,
  ProductAnalysis,
  ShoppingScript,
  VideoAnalysis,
} from "@/lib/shotform-auto-edit-types"
import { buildQuickShoppingScript, generateScriptFromMix } from "@/lib/shotform-auto-edit-mix"
import {
  auditShoppingScriptProductIdentity,
  generatePrecisionScriptFromMix,
} from "@/lib/shotform-auto-edit-precision-script"
import { detectObviousProductCategoryLeak, normalizeUserSourceKeywords } from "@/lib/shotform-user-keyword-product"
import { formatSceneNarrationLines } from "@/lib/shotform-benchmark-script"

export const AUTO_EDIT_SCRIPT_TIMEOUT_MS = 75_000
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
    let script = await withTimeout(
      generateScriptFromMix({
        apiKey,
        productAnalysis: args.productAnalysis,
        mixInfo: args.mixInfo,
        editPlan: args.editPlan,
        analyses: args.analyses,
        scriptTopic: args.scriptTopic,
        sourceKeywords: userKeywords,
      }),
      timeout,
      "장면맞춤 나레이션 생성 시간 초과"
    )

    if (userKeywords.length && script.bundle?.sceneSubtitles?.conversion?.length) {
      let scenes = script.bundle.sceneSubtitles.conversion
      let leaks = detectObviousProductCategoryLeak(
        scenes.map((s) => s.text),
        userKeywords
      )
      if (leaks.length) {
        scenes = await auditShoppingScriptProductIdentity({
          apiKey,
          userKeywords,
          productAnalysis: args.productAnalysis,
          editPlan: args.editPlan,
          analyses: args.analyses,
          scenes,
          targetDuration: args.editPlan.target_duration,
          leakSamples: leaks,
        })
        scenes = scenes.map((s, i) => {
          const hint = args.editPlan.edit_plan[i]
          const dur = hint ? Math.max(0.5, hint.output_end - hint.output_start) : s.end - s.start
          return { ...s, text: formatSceneNarrationLines(s.text, dur) }
        })
        leaks = detectObviousProductCategoryLeak(
          scenes.map((s) => s.text),
          userKeywords
        )
        if (leaks.length) {
          scenes = await auditShoppingScriptProductIdentity({
            apiKey,
            userKeywords,
            productAnalysis: args.productAnalysis,
            editPlan: args.editPlan,
            analyses: args.analyses,
            scenes,
            targetDuration: args.editPlan.target_duration,
            leakSamples: leaks,
          })
        }
        script = {
          ...script,
          bundle: {
            ...script.bundle!,
            sceneSubtitles: {
              ...script.bundle!.sceneSubtitles,
              conversion: scenes,
            },
          },
          script: args.editPlan.edit_plan.map((seg, i) => ({
            start: seg.output_start,
            end: seg.output_end,
            text: scenes[i]?.text ?? "",
            video_id: seg.video_id,
          })),
        }
      }
    }
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

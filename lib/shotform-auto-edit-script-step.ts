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
import { generatePrecisionScriptFromMix } from "@/lib/shotform-auto-edit-precision-script"

export const AUTO_EDIT_SCRIPT_TIMEOUT_MS = 75_000
export const AUTO_EDIT_PRECISION_SCRIPT_TIMEOUT_MS = 130_000

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
  timeoutMs?: number
}): Promise<ShoppingScript> {
  const quick = buildQuickShoppingScript(
    args.productAnalysis,
    args.editPlan,
    args.analyses,
    args.mixInfo
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
        }),
        timeout,
        "정밀 모드 대본 검증 시간 초과"
      )
    }
    return await withTimeout(
      generateScriptFromMix({
        apiKey,
        productAnalysis: args.productAnalysis,
        mixInfo: args.mixInfo,
        editPlan: args.editPlan,
        analyses: args.analyses,
        scriptTopic: args.scriptTopic,
      }),
      timeout,
      "장면맞춤 나레이션 생성 시간 초과"
    )
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

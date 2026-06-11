import type {
  AutoEditJobResult,
  EditPlan,
  MixInfo,
  ProductAnalysis,
  ShoppingScript,
  VideoAnalysis,
} from "@/lib/shotform-auto-edit-types"
import { buildQuickShoppingScript, generateScriptFromMix } from "@/lib/shotform-auto-edit-mix"

export const AUTO_EDIT_SCRIPT_TIMEOUT_MS = 75_000

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

  try {
    return await withTimeout(
      generateScriptFromMix({
        apiKey,
        productAnalysis: args.productAnalysis,
        mixInfo: args.mixInfo,
        editPlan: args.editPlan,
        analyses: args.analyses,
        scriptTopic: args.scriptTopic,
      }),
      args.timeoutMs ?? AUTO_EDIT_SCRIPT_TIMEOUT_MS,
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

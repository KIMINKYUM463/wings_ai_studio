/** 일괄 생성 모달 · 장면 배경(AI / 실사) 배분
 * WingsStudio `detailModeVideoBackground.assignVideoBackgroundSources` 와 동일 계열
 */

export type BatchVideoBgMode = "ai" | "stock" | "mix"

export type BatchTasks = {
  prompt: boolean
  image: boolean
  tts: boolean
  video: boolean
}

export type SceneBgKind = "ai" | "stock"

export type BatchGeneratePlan = {
  sceneIndexes: number[]
  tasks: BatchTasks
  videoBgMode: BatchVideoBgMode
  /** mix 일 때 AI 비율 0~100 (나머지 실사) */
  aiRatioPercent: number
  /** 실사 장면별 스톡 검색어 (scene index → query) */
  stockKeywords: Record<number, string>
  /** true면 이미 있는 결과도 다시 만들어 덮어씀 (재생성) */
  overwrite?: boolean
}

/** 장면이 선택한 작업 기준으로 아직 할 일이 있는지 (이어하기 판단) */
export function sceneHasPendingBatchWork(
  scene: { prompt?: string; imageUrl?: string; audioUrl?: string; videoUrl?: string },
  tasks: BatchTasks,
  overwrite: boolean
): boolean {
  if (overwrite) {
    // 재생성 직후에도 자산이 비어 있으면(실패) 이어하기 대상
    if (tasks.prompt && !scene.prompt?.trim()) return true
    if (tasks.image && !scene.imageUrl) return true
    if (tasks.tts && !scene.audioUrl) return true
    if (tasks.video && !scene.videoUrl) return true
    return false
  }
  if (tasks.prompt && !scene.prompt?.trim()) return true
  if (tasks.image && !scene.imageUrl) return true
  if (tasks.tts && !scene.audioUrl) return true
  if (tasks.video && !scene.videoUrl) return true
  return false
}

export function batchHasPendingWork(
  scenes: Array<{
    index: number
    prompt?: string
    imageUrl?: string
    audioUrl?: string
    videoUrl?: string
  }>,
  plan: Pick<BatchGeneratePlan, "sceneIndexes" | "tasks" | "overwrite">
): boolean {
  const overwrite = !!plan.overwrite
  for (const idx of plan.sceneIndexes) {
    const scene = scenes.find((s) => s.index === idx)
    if (!scene) continue
    if (sceneHasPendingBatchWork(scene, plan.tasks, overwrite)) return true
  }
  return false
}

export const DEFAULT_BATCH_TASKS: BatchTasks = {
  prompt: true,
  image: true,
  tts: true,
  video: true,
}

export const BATCH_VIDEO_BG_MODE_LABELS: Record<BatchVideoBgMode, string> = {
  ai: "모두 AI 이미지",
  stock: "모두 실사 영상(Pexels)",
  mix: "AI + 실사 영상(스톡) 비율",
}

/** WingsStudio `factoryVideoSceneTargetCount` — 비율(%) → AI 장면 수 */
export function factoryVideoSceneTargetCount(totalScenes: number, percent: number): number {
  const total = Math.max(0, Math.floor(totalScenes))
  const pct = Math.min(100, Math.max(0, Math.floor(percent)))
  if (total <= 0 || pct <= 0) return 0
  return Math.max(1, Math.min(total, Math.ceil((total * pct) / 100)))
}

/** WingsStudio `evenlySpacedSceneIndices` — 인덱스를 고르게 분산 */
export function evenlySpacedSceneIndices(total: number, pickCount: number): number[] {
  const n = Math.max(0, Math.floor(total))
  const k = Math.max(0, Math.min(n, Math.floor(pickCount)))
  if (k <= 0 || n <= 0) return []
  if (k >= n) return Array.from({ length: n }, (_, i) => i)
  if (k === 1) return [Math.floor((n - 1) / 2)]
  const out: number[] = []
  for (let i = 0; i < k; i++) {
    out.push(Math.round((i * (n - 1)) / (k - 1)))
  }
  return [...new Set(out)].sort((a, b) => a - b)
}

/**
 * 선택한 장면에 AI / 실사 배경을 고르게 배분합니다.
 * mix: AI 슬롯을 evenlySpaced 로 고른 뒤 나머지는 실사.
 */
export function assignSceneBgKinds(
  sceneIndexes: number[],
  mode: BatchVideoBgMode,
  aiRatioPercent = 50
): Map<number, SceneBgKind> {
  const map = new Map<number, SceneBgKind>()
  const n = sceneIndexes.length
  if (n === 0) return map

  if (mode === "ai") {
    for (const i of sceneIndexes) map.set(i, "ai")
    return map
  }
  if (mode === "stock") {
    for (const i of sceneIndexes) map.set(i, "stock")
    return map
  }

  const aiCount = factoryVideoSceneTargetCount(n, aiRatioPercent)
  const aiSlots = new Set(evenlySpacedSceneIndices(n, aiCount))
  sceneIndexes.forEach((sceneIndex, listPos) => {
    map.set(sceneIndex, aiSlots.has(listPos) ? "ai" : "stock")
  })
  return map
}

export function stockSceneIndexes(
  sceneIndexes: number[],
  mode: BatchVideoBgMode,
  aiRatioPercent: number
): number[] {
  const kinds = assignSceneBgKinds(sceneIndexes, mode, aiRatioPercent)
  return sceneIndexes.filter((i) => kinds.get(i) === "stock")
}

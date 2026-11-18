/** 쿠팡 링크 하나로 정보 → 사진 → 사진 분석 → 대본 → 음성까지 이어서 만들기 (브라우저 전용) */

import {
  classifyTravelPhotos,
  generateTravelScripts,
  importCoupangTravel,
  OPENAI_KEY_MISSING,
} from "@/lib/travel-shorts/ai-client"
import { buildTravelAudio } from "@/lib/travel-shorts/audio"
import { shotformOpenAiKey } from "@/lib/shotform-factory-seo"
import type { TravelProject } from "@/lib/travel-shorts/types"

export const AUTO_BUILD_STAGES = [
  { id: "import", label: "숙소 정보·사진 불러오기" },
  { id: "classify", label: "사진 분석·순서 정하기" },
  { id: "script", label: "대본 3가지 쓰기" },
  { id: "voice", label: "음성 만들기" },
] as const

export type AutoBuildStageId = (typeof AUTO_BUILD_STAGES)[number]["id"]

export type AutoBuildResult = {
  project: TravelProject
  /** 중간에 멈췄을 때 이유 — 거기까지 만든 결과는 project에 들어 있음 */
  error?: string
}

export async function autoBuildFromCoupang(
  base: TravelProject,
  url: string,
  hooks: {
    onStage: (stage: AutoBuildStageId, detail?: string) => void
    /** 단계가 끝날 때마다 저장용 */
    onProject: (project: TravelProject) => void
  }
): Promise<AutoBuildResult> {
  let project = base
  const commit = (next: TravelProject) => {
    project = { ...next, updatedAt: Date.now() }
    hooks.onProject(project)
  }
  const stop = (error: string): AutoBuildResult => ({ project, error })

  hooks.onStage("import")
  const imported = await importCoupangTravel(url)
  commit({
    ...project,
    name: imported.info.placeName || project.name,
    info: { ...project.info, ...imported.info },
    photos: imported.photos,
    step: "photos",
  })

  if (project.photos.length < 2) {
    return stop(`쿠팡에 올라온 사진이 ${project.photos.length}장뿐이에요. 사진을 1장 이상 더 넣고 '대본' 단계로 넘어가 주세요.`)
  }
  if (!shotformOpenAiKey()) return stop(`${OPENAI_KEY_MISSING} 사진까지만 불러왔어요.`)

  hooks.onStage("classify")
  try {
    commit({ ...project, photos: await classifyTravelPhotos(project.photos) })
  } catch {
    // 분류가 실패해도 쿠팡 사진 분류(전경·객실)로 계속 진행
  }

  hooks.onStage("script")
  try {
    const { variants, publish } = await generateTravelScripts(project)
    commit({ ...project, variants, publish, selectedVariant: 0, step: "voice" })
  } catch (e) {
    commit({ ...project, step: "script" })
    return stop(e instanceof Error ? e.message : "대본 생성에 실패했습니다.")
  }

  const variant = project.variants[0]
  if (!variant) return stop("대본이 비어 있습니다.")
  try {
    const audio = await buildTravelAudio(variant, project.voice, (detail) => hooks.onStage("voice", detail))
    commit({ ...project, audio, step: "preview" })
  } catch (e) {
    return stop(`음성 단계에서 멈췄어요: ${e instanceof Error ? e.message : "음성 생성 실패"}`)
  }
  return { project }
}

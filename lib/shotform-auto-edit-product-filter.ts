import type { VideoAnalysis, VideoScene } from "@/lib/shotform-auto-edit-types"

/** 장면 콘텐츠 — 짜집기 허용 여부 판단 */
export type SceneContentType =
  | "product_only"
  | "product_in_use"
  | "person_presenting"
  | "talking_head"
  | "mixed"
  | "text_overlay"
  | "other"

export type VideoProductFit = "approved" | "partial" | "rejected"

const PRODUCT_SAFE: Set<SceneContentType> = new Set(["product_only", "product_in_use"])

/** 口播·카메라 소개·립싱크 등 — 항상 차단 */
const STRICT_PRESENTER_DESC =
  /口播|博主.*讲|讲解|露脸|talking.?head|对着镜头|对着镜|카메라\s*응시|카메라를?\s*바라보며|바라보며\s*(말|설명|소개)|립싱크|lip\s*sync|직접\s*소개|인물\s*소개|안녕하세요\s*여러분|오늘\s*소개|vlog\s*소개|쇼호스트|호스트\s*소개|review\s*by|unboxing\s*by/i

/** 제품 사용·시연 묘사 — 얼굴 일부가 있어도 허용 후보 */
const PRODUCT_IN_USE_DESC =
  /사용|쓰는|쓰며|조작|들고|들어|착용|시연|데모|청소|닦|바르|칠|뿌리|착|손으로|손에|팔로|제품을|적용|설치|조립|개봉|펼치|누르|돌리|흡입|분사|hand|using|hold|demonstrat|apply|clean|operat/i

/** 제품 사용 맥락이 아닐 때만 차단하는 인물·얼굴 키워드 */
const FACE_PRESENTING_DESC =
  /얼굴\s*(클로즈|정면|대면)|正脸|人脸|出镜|인플루언서\s*소개|유튜버\s*소개|보며\s*이야기|입\s*모양|selfie|블로거\s*소개/i

/** 레거시 호환 — 넓은 패턴 (pick reason 등 보조 검사) */
const FACE_OR_PRESENTER_DESC =
  /인물|얼굴|face|faces|口播|博主|讲解|露脸|talking|presenter|vlog|主播|selfie|클로즈업.*얼굴|正脸|人脸|出镜|对着镜|对着镜头|主播|인플루언서|유튜버|보여\s*주며|말하며|말하고|말하는|설명하며|설명하는|소개하며|소개하는|카메라\s*응시|카메라를?\s*바라보며|바라보며|응시하|보며\s*(말|설명|소개)|입\s*모양|립싱크|lip\s*sync|블로거|리뷰어|쇼호스트|호스트|직접\s*소개/i

export function descriptionSuggestsProductInUse(text: string): boolean {
  const t = (text || "").trim()
  if (!t) return false
  return PRODUCT_IN_USE_DESC.test(t)
}

/** 장면·캡션·pick reason에 인물 소개·口播가 드러나는지 (제품 사용 장면은 완화) */
export function descriptionSuggestsPresenterOrFace(text: string): boolean {
  const t = (text || "").trim()
  if (!t) return false
  if (STRICT_PRESENTER_DESC.test(t)) return true
  if (descriptionSuggestsProductInUse(t)) {
    return FACE_PRESENTING_DESC.test(t)
  }
  return FACE_OR_PRESENTER_DESC.test(t) || FACE_PRESENTING_DESC.test(t)
}

/** 화면에 중국어·하드자막·텍스트 오버레이가 보이는 장면 */
const CHINESE_TEXT_OVERLAY_DESC =
  /中文|汉字|简体|繁体|字幕|副标题|硬字幕|자막|subtitle|caption|下屏|하단.*자막|화면.*글|텍스트.*표시|文字|字样|[\u4e00-\u9fff]{2,}/i

/** 로고·CTA·버튼만 있고 실제 제품 영상이 없는 엔딩/프로모 화면 */
const TEXT_ONLY_CTA_DESC =
  /记得点赞|获取更多|优惠信息|产品信息|点赞关注|加关注|双击点赞|关注收藏|点赞.*关注|follow\s*button|like\s*and\s*subscribe|subscribe\s*now|end\s*card|promo\s*card|call\s*to\s*action|cta\s*(화면|장면|버튼)?|엔드\s*카드|엔딩\s*카드|프로모\s*(화면|장면)|유도\s*문구|좋아요\s*(눌러|유도)|팔로우\s*버튼|플러스\s*버튼|빨간\s*원.*\+|\+.*버튼|손가락.*버튼|손\s*그래픽.*버튼|로고\s*(와|과)?\s*텍스트|텍스트\s*(와|과)\s*로고|브랜드\s*로고|로고\s*만|텍스트\s*만|문구\s*만|버튼\s*만|검은\s*배경.*(?:로고|텍스트|문구|버튼)|단색\s*배경.*(?:로고|텍스트|문구)|검은\s*화면.*(?:로고|텍스트)|오버레이\s*만|제품\s*(없|미노출)|실물\s*없|since\s*20\d{2}/i

const TEXT_ONLY_CTA_CAPTION =
  /记得点赞|获取更多|优惠信息|产品信息|点赞|关注|로고|logo|브랜드|검은\s*배경|단색\s*배경|텍스트|문구|버튼|cta|엔딩|프로모|좋아요|팔로우|\+.*기호|UI\s*요소/i

export function sceneHasChineseTextOverlay(scene: Pick<VideoScene, "description">): boolean {
  return CHINESE_TEXT_OVERLAY_DESC.test(scene.description || "")
}

const STRONG_TEXT_ONLY_CTA =
  /记得点赞|获取更多|优惠信息|产品信息|点赞关注|검은\s*배경.*로고|브랜드\s*로고|로고.*(?:记得|点赞|获取更多|버튼)|엔드\s*카드|엔딩\s*카드|실사용하면.*(?:로고|记得|点赞|버튼)|since\s*20\d{2}/i

/** 설명·캡션·pick reason이 텍스트·로고·CTA 전용 화면인지 (제품 시연 묘사가 있으면 제외) */
export function descriptionSuggestsTextOnlyCta(text: string): boolean {
  const t = (text || "").trim()
  if (!t) return false
  if (STRONG_TEXT_ONLY_CTA.test(t)) return true
  if (descriptionSuggestsProductInUse(t)) return false
  if (TEXT_ONLY_CTA_DESC.test(t)) return true
  if (TEXT_ONLY_CTA_CAPTION.test(t) && !PRODUCT_IN_USE_DESC.test(t)) {
    const hasCta =
      /记得|点赞|关注|优惠|获取更多|cta|엔딩|프로모|좋아요|팔로우|버튼|로고/i.test(t)
    const plainBg = /검은|단색|black|logo|로고/i.test(t)
    if (hasCta && plainBg) return true
  }
  return false
}

export function isProductOnlyVisualScene(scene: VideoScene): boolean {
  if (!isProductSafeScene(scene)) return false
  if (scene.content_type === "mixed") return false
  return true
}

function framesInSceneRange(
  scene: VideoScene,
  frames: Array<{ timeSec: number; content_type: SceneContentType }>
): Array<{ timeSec: number; content_type: SceneContentType }> {
  return frames.filter(
    (f) => f.timeSec >= scene.start - 0.15 && f.timeSec <= scene.end + 0.15
  )
}

type VisionFrameLabel = {
  timeSec: number
  content_type: SceneContentType
  caption?: string
}

function intervalTextOverlayDominant(
  frames: VisionFrameLabel[],
  start: number,
  end: number
): boolean {
  const inRange = frames.filter((f) => f.timeSec >= start - 0.08 && f.timeSec <= end + 0.08)
  if (!inRange.length) return false

  const textOverlay = inRange.filter((f) => f.content_type === "text_overlay").length
  const productFrames = inRange.filter(
    (f) => f.content_type === "product_in_use" || f.content_type === "product_only"
  ).length
  if (textOverlay >= Math.ceil(inRange.length * 0.4) && productFrames < Math.ceil(inRange.length * 0.25)) {
    return true
  }
  if (textOverlay >= Math.ceil(inRange.length * 0.55)) return true

  const ctaCaptions = inRange.filter((f) => f.caption && descriptionSuggestsTextOnlyCta(f.caption)).length
  return ctaCaptions >= Math.ceil(inRange.length * 0.4) && productFrames < Math.ceil(inRange.length * 0.25)
}

/** 장면 구간 Vision — 소개형·텍스트 CTA가 과반일 때 차단 (제품 사용 프레임이 있으면 허용) */
export function sceneHasUnsafeVision(scene: VideoScene, frames: VisionFrameLabel[]): boolean {
  if (!frames.length) return false
  const inRange = framesInSceneRange(scene, frames)
  if (!inRange.length) return false

  if (intervalTextOverlayDominant(frames, scene.start, scene.end)) return true

  const productInUse = inRange.filter((f) => f.content_type === "product_in_use").length
  if (productInUse >= Math.ceil(inRange.length * 0.35)) return false

  const unsafe = inRange.filter((f) => !isProductSafeContentType(f.content_type)).length
  const talking = inRange.filter(
    (f) => f.content_type === "talking_head" || f.content_type === "person_presenting"
  ).length
  if (talking >= Math.ceil(inRange.length * 0.4)) return true

  return unsafe / inRange.length > 0.7
}

/** 편집용 장면 — 텍스트·CTA·口播 전용 구간 제외 */
export function filterScenesForEdit(
  scenes: VideoScene[],
  visionFrames?: VisionFrameLabel[]
): VideoScene[] {
  let merged = scenes
  if (visionFrames?.length) {
    merged = mergeVisionIntoScenes(scenes, visionFrames, Number.POSITIVE_INFINITY)
  }
  return merged
    .filter((sc) => sc.end > sc.start + 0.15)
    .filter((sc) => isProductSafeScene(sc))
    .filter((sc) => !sceneHasUnsafeVision(sc, visionFrames ?? []))
    .map((sc) => ({
      ...sc,
      has_person_presenting: false,
    }))
}

function scenesFromVisualTimeline(analysis: Pick<VideoAnalysis, "visual_scenes" | "title" | "duration">): VideoScene[] {
  if (!analysis.visual_scenes?.length) return []
  return analysis.visual_scenes
    .filter((vs) => vs.end > vs.start + 0.15)
    .map((vs) => ({
      start: vs.start,
      end: vs.end,
      description: vs.description || analysis.title || "장면",
      importance: 7,
      visual_type: "demo" as const,
      content_type: "product_in_use" as const,
    }))
}

/** 안전 필터 통과 실패 시 — visual·전체 영상 등 최소 장면 */
function fallbackScenesForAnalysis(a: VideoAnalysis): VideoScene[] {
  const fromVisual = scenesFromVisualTimeline(a)
  if (fromVisual.length) return fromVisual
  if (a.duration > 0.3) {
    return [
      {
        start: 0,
        end: Math.round(a.duration * 10) / 10,
        description: a.title || "영상 장면",
        importance: 7,
        visual_type: "demo",
        content_type: "product_in_use",
      },
    ]
  }
  return []
}

/** 긴급 폴백 — 분석 장면·visual·전체 영상까지 활용 */
export function emergencyScenesForAnalysis(a: VideoAnalysis): VideoScene[] {
  const fromFallback = fallbackScenesForAnalysis(a)
  if (fromFallback.length) return fromFallback
  if (a.scenes?.length) {
    return a.scenes
      .filter((sc) => sc.end > sc.start + 0.1)
      .map((sc) => ({
        ...sc,
        content_type: "product_in_use" as const,
        has_person_presenting: false,
      }))
  }
  if (a.duration > 0.2) {
    return [
      {
        start: 0,
        end: Math.round(a.duration * 10) / 10,
        description: a.title || "영상 장면",
        importance: 5,
        visual_type: "demo",
        content_type: "product_in_use",
      },
    ]
  }
  return []
}

/** 편집 안전 장면이 없을 때 — 어떻게든 짧게라도 만들기 위한 완화 분석 목록 */
export function filterAnalysesForEmergencyEdit(analyses: VideoAnalysis[]): VideoAnalysis[] {
  return analyses
    .filter((a) => a.duration > 0.2)
    .map((a) => {
      const scenes = emergencyScenesForAnalysis(a)
      return {
        ...a,
        scenes: scenes.length
          ? scenes
          : [
              {
                start: 0,
                end: Math.max(0.5, Math.round(a.duration * 10) / 10),
                description: a.title || "영상 장면",
                importance: 5,
                visual_type: "demo" as const,
                content_type: "product_in_use" as const,
              },
            ],
        product_fit: "partial" as const,
      }
    })
    .filter((a) => a.scenes.length > 0)
}

/** 제목·설명 휴리스틱 — 인물 소개형 가능성 */
const PRESENTER_TITLE =
  /口播|真人|博主|主播|讲解|露脸|对着镜头|对着镜|测评师|种草说|vlog|开箱测评|真人测评|博主推荐|说课|介绍自己|我来给大家|姐妹们|宝子们|口播推荐|인물\s*소개|직접\s*소개|얼굴\s*나옴|유튜버|인플루언서|리뷰어\s*소개|쇼호스트|호스트\s*소개|제\s*얼굴|안녕하세요\s*여러분|오늘\s*소개|unboxing\s*by|review\s*by/i

export function isLikelyPresenterTitle(title: string): boolean {
  const t = title.trim()
  if (!t) return false
  return PRESENTER_TITLE.test(t)
}

export function isProductSafeContentType(t: SceneContentType | string | undefined): boolean {
  return PRODUCT_SAFE.has(t as SceneContentType)
}

export function isProductSafeScene(scene: VideoScene): boolean {
  if (scene.content_type === "text_overlay") return false
  if (descriptionSuggestsTextOnlyCta(scene.description)) return false

  if (scene.content_type === "product_in_use") {
    if (scene.visual_type === "other") return false
    if (sceneHasChineseTextOverlay(scene)) return false
    return !descriptionSuggestsPresenterOrFace(scene.description)
  }

  if (scene.content_type) {
    if (!isProductSafeContentType(scene.content_type)) return false
  }
  if (scene.has_person_presenting === true) return false
  if (scene.visual_type === "other") return false
  if (descriptionSuggestsPresenterOrFace(scene.description)) return false
  if (!scene.content_type) {
    return ["product_showcase", "demo", "result", "problem"].includes(scene.visual_type)
  }
  return true
}

export function filterProductSafeScenes(scenes: VideoScene[]): VideoScene[] {
  return scenes.filter(isProductSafeScene)
}

export function filterAnalysesForProductEdit(analyses: VideoAnalysis[]): VideoAnalysis[] {
  return analyses
    .map((a) => {
      let scenes = filterScenesForEdit(a.scenes, a.vision_frames)
      if (!scenes.length) scenes = fallbackScenesForAnalysis(a)
      return {
        ...a,
        scenes,
        product_fit: a.product_fit === "rejected" ? "partial" : a.product_fit ?? "approved",
      }
    })
    .filter((a) => a.scenes.length > 0)
}

function visionFramesSafeForInterval(frames: VisionFrameLabel[], start: number, end: number): boolean {
  const inRange = frames.filter((f) => f.timeSec >= start - 0.08 && f.timeSec <= end + 0.08)
  if (!inRange.length) return true

  if (intervalTextOverlayDominant(frames, start, end)) return false

  const productInUse = inRange.filter((f) => f.content_type === "product_in_use").length
  if (productInUse >= Math.ceil(inRange.length * 0.35)) return true

  const talking = inRange.filter(
    (f) => f.content_type === "talking_head" || f.content_type === "person_presenting"
  ).length
  if (talking >= Math.ceil(inRange.length * 0.45)) return false

  const safe = inRange.filter((f) => isProductSafeContentType(f.content_type)).length
  return safe / inRange.length >= 0.4
}

function scenesOverlappingInterval(
  analysis: Pick<VideoAnalysis, "scenes" | "visual_scenes" | "title" | "duration">,
  start: number,
  end: number
): VideoScene[] {
  const base = analysis.scenes?.length ? analysis.scenes : scenesFromVisualTimeline(analysis)
  return base.filter((sc) => {
    const overlap = Math.min(sc.end, end) - Math.max(sc.start, start)
    return overlap >= 0.15
  })
}

/** mix·편집 pick 구간 — 텍스트·CTA·口播 전용 구간 차단 */
export function pickIntervalIsProductSafe(
  analysis: Pick<VideoAnalysis, "scenes" | "vision_frames" | "visual_scenes" | "duration" | "title">,
  start: number,
  end: number,
  reason?: string
): boolean {
  if (end <= start || start < -0.05) return false
  if (end > (analysis.duration ?? 0) + 0.55) return false

  if (reason && descriptionSuggestsTextOnlyCta(reason)) return false

  const visionFrames = analysis.vision_frames
  if (visionFrames?.length && !visionFramesSafeForInterval(visionFrames, start, end)) return false

  for (const sc of scenesOverlappingInterval(analysis, start, end)) {
    if (!isProductSafeScene(sc)) return false
    if (sceneHasUnsafeVision(sc, visionFrames ?? [])) return false
  }

  return true
}

export function filteredScenesForMixPick(analysis: VideoAnalysis): VideoScene[] {
  const scenes = filterScenesForEdit(analysis.scenes, analysis.vision_frames)
  if (scenes.length) return scenes
  return fallbackScenesForAnalysis(analysis)
}

export function mergeVisionIntoScenes(
  scenes: VideoScene[],
  frameLabels: Array<{ timeSec: number; content_type: SceneContentType }>,
  duration: number
): VideoScene[] {
  if (!frameLabels.length) return scenes

  return scenes.map((sc) => {
    const inRange = framesInSceneRange(sc, frameLabels)
    const productInUseCount = inRange.filter((f) => f.content_type === "product_in_use").length
    const safeCount = inRange.filter((f) => isProductSafeContentType(f.content_type)).length

    const mid = (sc.start + sc.end) / 2
    let nearest = frameLabels[0]!
    let bestDist = Math.abs(nearest.timeSec - mid)
    for (const f of frameLabels) {
      const d = Math.abs(f.timeSec - mid)
      if (d < bestDist) {
        bestDist = d
        nearest = f
      }
    }

    let ct: SceneContentType = nearest.content_type
    if (inRange.length) {
      const textOverlayCount = inRange.filter((f) => f.content_type === "text_overlay").length
      if (textOverlayCount >= Math.ceil(inRange.length * 0.4)) {
        ct = "text_overlay"
      } else if (productInUseCount >= Math.ceil(inRange.length * 0.35)) {
        ct = "product_in_use"
      } else if (safeCount >= Math.ceil(inRange.length * 0.5)) {
        ct = inRange.find((f) => isProductSafeContentType(f.content_type))?.content_type ?? ct
      } else {
        ct = nearest.content_type
      }
    }

    return {
      ...sc,
      content_type: ct,
      has_person_presenting: false,
    }
  })
}

export function inferProductFitFromScenes(scenes: VideoScene[]): VideoProductFit {
  if (!scenes.length) return "rejected"
  return "approved"
}

import type {
  ActionScene,
  AutoEditAnalysisMode,
  SceneContentType,
  SceneRole,
  VideoScene,
  VisualScene,
} from "@/lib/shotform-auto-edit-types"
import { narrationBlockSimilarity } from "@/lib/shotform-narration-similarity"

/** Vision 프레임 1장 — 행동 기반 분석 필드 */
export type ActionFrameRow = {
  timeSec: number
  content_type: SceneContentType
  shot_type?: string
  hand_action?: string
  product?: string
  product_use?: string
  ocr_text?: string
  scene_hint?: string
  caption?: string
}

export const ACTION_VISION_FRAME_SYSTEM_PROMPT = `쇼핑 숏폼·릴스 제품 광고용 **행동 기반 장면 분석기**. 이미지 캡션이 아닙니다.

각 프레임마다 JSON 필드:
- content_type: product_only|product_in_use|person_presenting|talking_head|mixed|text_overlay|other
- shot_type: 클로즈업|미디엄샷|와이드샷|탑뷰|손 클로즈업 등
- hand_action: 손·사람이 **실제로 하는 행동** (예: "손이 벽에 거치대를 붙이는 중")
- product: 화면 핵심 제품명
- product_use: 제품이 어떻게 쓰이는지 (설치/수납/세척/시연 등)
- ocr_text: 화면에 보이는 중국어·영어 자막·로고 문구 (없으면 "")
- scene_hint: 문제제기|설치|사용|기능|수납|추가활용|세척|관리|구매포인트|마무리 중 하나

**금지**: "귀여운 디자인", "예쁜 제품", "깔끔한 모습" 같은 추상 표현만 쓰기
**필수**: 누가/무엇을/어떻게/무슨 순서인지 **행동**으로 기술

text_overlay: 제품 없이 텍스트·CTA만 있는 화면`

export const ACTION_SCENE_MERGE_SYSTEM_PROMPT = `쇼핑 숏폼 행동 기반 장면 편집 PD. JSON만 출력.

입력: 프레임별 행동 분석 목록 (timeSec 순)
출력: 행동이 바뀌는 시점마다 장면 분리. 비슷한 장면은 합치고, 같은 설명 반복 금지.

각 장면:
- shot_type
- scene_role: 문제 제기|설치 방법|사용 방법|기능 소개|수납 효과|추가 활용|세척|관리|구매 포인트|마무리|데모
- scene_description: 80~160자. [샷타입] + 손 행동 + 제품 사용 + OCR(있으면) + 상태 변화. 추상 칭찬 금지.
- script_lines: 1~3줄, 줄당 8~14자, 쇼츠 광고 톤, "~입니다" 최소화, 장면 행동 기반, 제품명 반복 금지

규칙:
- 같은 scene_role이 연속으로 나오지 않게
- script_lines는 장면 설명을 읽지 말고 **행동에서 파생된 후킹 광고 문구**
- OCR이 있으면 scene_description에 포함

JSON: {"scenes":[{"start":0,"end":2.5,"shot_type":"","scene_role":"","scene_description":"","script_lines":["",""]}]}`

const ABSTRACT_SCENE_RE =
  /귀여운\s*디자인|예쁜\s*제품|깔끔한\s*모습|작고\s*귀여운|다채로운\s*색상|색감이\s*깔끔|인테리어\s*포인트만|보기\s*좋은|예뻐요|귀여워요/i

const ROLE_FROM_HINT: Record<string, SceneRole> = {
  문제제기: "문제 제기",
  문제: "문제 제기",
  설치: "설치 방법",
  부착: "설치 방법",
  사용: "사용 방법",
  시연: "사용 방법",
  기능: "기능 소개",
  수납: "수납 효과",
  보관: "수납 효과",
  추가활용: "추가 활용",
  활용: "추가 활용",
  세척: "세척",
  씻: "세척",
  관리: "관리",
  구매포인트: "구매 포인트",
  마무리: "마무리",
  cta: "마무리",
}

const ROLE_ORDER: SceneRole[] = [
  "문제 제기",
  "설치 방법",
  "사용 방법",
  "기능 소개",
  "수납 효과",
  "추가 활용",
  "세척",
  "관리",
  "구매 포인트",
  "마무리",
  "데모",
]

function normalizeActionKey(text: string): string {
  return text
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase()
    .slice(0, 24)
}

export function inferSceneRoleFromFrame(f: ActionFrameRow): SceneRole {
  const blob = `${f.scene_hint || ""} ${f.product_use || ""} ${f.hand_action || ""}`.toLowerCase()
  for (const [k, role] of Object.entries(ROLE_FROM_HINT)) {
    if (blob.includes(k)) return role
  }
  if (/붙이|부착|설치|걸|매달|stick|mount/i.test(blob)) return "설치 방법"
  if (/씻|세척|물에|헹|wash|rinse/i.test(blob)) return "세척"
  if (/넣|꽂|보관|수납|정리|담/i.test(blob)) return "수납 효과"
  if (/안경|활용|다용도|추가/i.test(blob)) return "추가 활용"
  if (/문제|지저분|어지러|뒤죽/i.test(blob)) return "문제 제기"
  if (/구매|가격|할인|링크/i.test(blob)) return "구매 포인트"
  if (f.content_type === "text_overlay") return "마무리"
  return "데모"
}

export function composeActionSceneDescription(f: ActionFrameRow): string {
  const shot = f.shot_type?.trim() || "미디엄샷"
  const parts: string[] = [`[${shot}]`]
  if (f.hand_action?.trim()) parts.push(f.hand_action.trim())
  else if (f.product_use?.trim()) parts.push(f.product_use.trim())
  if (f.product?.trim()) parts.push(`제품: ${f.product.trim()}`)
  if (f.product_use?.trim() && f.hand_action?.trim()) parts.push(f.product_use.trim())
  if (f.ocr_text?.trim()) parts.push(`화면자막: ${f.ocr_text.trim()}`)
  const desc = parts.join(" · ").replace(/\s+/g, " ").trim()
  if (ABSTRACT_SCENE_RE.test(desc) && f.hand_action) {
    return `[${shot}] ${f.hand_action}${f.ocr_text ? ` · 화면자막: ${f.ocr_text}` : ""}`
  }
  return desc.slice(0, 200) || `[${shot}] 제품 사용 장면`
}

function framesSimilar(a: ActionFrameRow, b: ActionFrameRow): boolean {
  const ka = normalizeActionKey(`${a.hand_action || ""}${a.product_use || ""}`)
  const kb = normalizeActionKey(`${b.hand_action || ""}${b.product_use || ""}`)
  if (ka && kb && (ka === kb || ka.includes(kb) || kb.includes(ka))) return true
  if (inferSceneRoleFromFrame(a) === inferSceneRoleFromFrame(b)) {
    const sim = narrationBlockSimilarity(a.hand_action || "", b.hand_action || "")
    return sim >= 0.55
  }
  return false
}

/** 0.5~1초 간격 키프레임 시각 목록 (최대 24장) */
export function keyframeTimesForActionAnalysis(duration: number, intervalSec = 1): number[] {
  const interval = Math.max(0.5, Math.min(1, intervalSec))
  const times: number[] = []
  for (let t = 0.35; t < Math.max(0.5, duration - 0.15); t += interval) {
    times.push(Math.round(t * 10) / 10)
  }
  if (!times.length && duration > 0.2) times.push(Math.round(duration * 0.3 * 10) / 10)
  return times.slice(0, 24)
}

/** 소스 영상 전체 길이에 골고루 N장 샘플 — 앞 10초만 보지 않음 */
export function sampleKeyframeTimesAcrossDuration(duration: number, count: number): number[] {
  const n = Math.max(4, Math.min(24, Math.floor(count)))
  if (duration <= 0.5) return [Math.round(duration * 0.3 * 10) / 10]
  const start = 0.35
  const end = Math.max(start + 0.2, duration - 0.15)
  if (n === 1) return [Math.round(((start + end) / 2) * 10) / 10]
  const span = end - start
  return Array.from({ length: n }, (_, i) =>
    Math.round((start + (span * i) / (n - 1)) * 10) / 10
  )
}

/** 편집 실행 전 분석 단계 예상 소요(초) — UI 안내용 */
export function estimateAutoEditAnalyzeSeconds(args: {
  pickCount: number
  maxSourceDurationSec?: number
  mode: AutoEditAnalysisMode
  hasClientKeyframe: boolean
  skipServerDownload: boolean
}): { min: number; max: number; label: string } {
  const {
    pickCount,
    maxSourceDurationSec = 45,
    mode,
    hasClientKeyframe,
    skipServerDownload,
  } = args
  const dur = Math.max(15, maxSourceDurationSec)

  if (mode === "precision") {
    const base = 180 + pickCount * 120 + Math.min(180, dur * 0.5)
    return {
      min: Math.round(base * 0.75),
      max: Math.round(base * 1.4),
      label: "정밀",
    }
  }

  let base = 18 + pickCount * 8
  if (!skipServerDownload) base += 28
  if (!hasClientKeyframe) base += Math.min(55, dur / 2.2)
  base += 12
  return {
    min: Math.round(base * 0.65),
    max: Math.round(base * 1.35),
    label: "고속",
  }
}

function pickRepresentativeFrame(cluster: ActionFrameRow[]): ActionFrameRow {
  const mid = cluster[Math.floor(cluster.length / 2)]!
  const best = cluster.find((f) => f.hand_action?.trim()) || mid
  return { ...best, shot_type: best.shot_type || cluster[0]?.shot_type || "미디엄샷" }
}

function generateScriptLinesLocal(scene: {
  scene_role: SceneRole
  scene_description: string
  hand_action_hint?: string
}): string[] {
  const action = scene.hand_action_hint || scene.scene_description
  const role = scene.scene_role

  const pools: Partial<Record<SceneRole, string[][]>> = {
    "문제 제기": [
      ["욕실 정리", "이거 없으면", "지저분해요"],
      ["칫솔 뒤죽박죽", "이거 하나면", "끝나요"],
    ],
    "설치 방법": [
      ["벽에 착 붙이면 끝", "드릴도 필요 없어요", "욕실이 바로 정리"],
      ["손으로 눌러 붙이면", "끝나는 설치", "1분도 안 걸려요"],
    ],
    "사용 방법": [
      ["꽂기만 하면", "칫솔·치약 끝", "찾기 쉬워요"],
      ["이렇게 쓰면", "매일 편해요", "정리 습관 생겨요"],
    ],
    "수납 효과": [
      ["칫솔 두 개도", "흔들림 없이", "딱 맞아요"],
      ["세면대 위가", "한눈에 정리", "됩니다"],
    ],
    "추가 활용": [
      ["칫솔만 쓰는 거?", "안경도 걸려요", "활용도 미쳤죠"],
      ["컵·소품까지", "한곳에 모아", "찾기 쉬워요"],
    ],
    세척: [
      ["더러우면", "떼서 씻으면 끝", "관리까지 쉬워요"],
      ["물로 헹구면", "바로 재사용", "위생 걱정 없어요"],
    ],
    "기능 소개": [
      ["이 부분이", "포인트예요", "직접 보면 와요"],
      ["이렇게 되니", "차이가 보여요", "써보면 알아요"],
    ],
    "구매 포인트": [
      ["이 가격에", "이 구성이면", "가성비 좋아요"],
      ["지금 쓰는", "욕실템이면", "바꿀 때예요"],
    ],
    마무리: [
      ["욕실 정리", "이걸로 끝", "링크 남겨둘게요"],
      ["써보고 싶으면", "프로필 링크", "확인해보세요"],
    ],
    데모: [
      ["이 장면 보면", "쓰임이 보여요", "영상으로 확인"],
    ],
  }

  if (/붙이|부착|설치|벽에/.test(action)) {
    return ["벽에 착 붙이면 끝", "드릴도 필요 없어요", "욕실이 바로 정리"]
  }
  if (/안경|걸어|걸이/.test(action)) {
    return ["칫솔만 쓰는 거?", "안경도 걸려요", "활용도 미쳤죠"]
  }
  if (/씻|세척|물/.test(action)) {
    return ["더러우면", "떼서 씻으면 끝", "관리까지 쉬워요"]
  }
  if (/꽂|넣|수납|보관/.test(action)) {
    return ["꽂기만 하면", "칫솔·치약 끝", "찾기 쉬워요"]
  }

  const pool = pools[role] ?? pools["데모"]!
  const idx = Math.abs(normalizeActionKey(action).charCodeAt(0) || 0) % pool.length
  return pool[idx]!.map((line) => line.slice(0, 14))
}

/** 프레임 클러스터링 → 행동 기반 장면 */
export function buildActionScenesFromFrames(
  frames: ActionFrameRow[],
  duration: number
): ActionScene[] {
  const usable = frames
    .filter((f) => f.content_type !== "text_overlay" || f.ocr_text?.trim())
    .sort((a, b) => a.timeSec - b.timeSec)
  if (!usable.length) return []

  const clusters: ActionFrameRow[][] = []
  let current: ActionFrameRow[] = []

  for (const f of usable) {
    if (!current.length) {
      current.push(f)
      continue
    }
    const last = current[current.length - 1]!
    const gap = f.timeSec - last.timeSec
    if (gap < 1.3 && framesSimilar(f, last)) {
      current.push(f)
    } else {
      clusters.push(current)
      current = [f]
    }
  }
  if (current.length) clusters.push(current)

  const raw: ActionScene[] = clusters.map((cluster, i) => {
    const rep = pickRepresentativeFrame(cluster)
    const start = i === 0 ? 0 : Math.round(((clusters[i - 1]!.at(-1)!.timeSec + cluster[0]!.timeSec) / 2) * 10) / 10
    const end =
      i === clusters.length - 1
        ? Math.round(duration * 10) / 10
        : Math.round(((cluster.at(-1)!.timeSec + (clusters[i + 1]?.[0]?.timeSec ?? duration)) / 2) * 10) / 10
    const scene_role = inferSceneRoleFromFrame(rep)
    const scene_description = composeActionSceneDescription(rep)
    return {
      start,
      end: Math.max(start + 0.25, end),
      shot_type: rep.shot_type || "미디엄샷",
      scene_role,
      scene_description,
      script_lines: generateScriptLinesLocal({
        scene_role,
        scene_description,
        hand_action_hint: rep.hand_action || rep.product_use,
      }),
      ocr_text: rep.ocr_text,
      content_type: rep.content_type,
    }
  })

  return dedupeActionScenes(raw)
}

/** 같은 역할·유사 설명 병합 + 연속 동일 role 방지 */
export function dedupeActionScenes(scenes: ActionScene[]): ActionScene[] {
  if (scenes.length <= 1) return scenes

  const merged: ActionScene[] = []
  for (const sc of scenes) {
    const prev = merged[merged.length - 1]
    if (
      prev &&
      (prev.scene_role === sc.scene_role ||
        narrationBlockSimilarity(prev.scene_description, sc.scene_description) >= 0.62)
    ) {
      prev.end = sc.end
      if (sc.ocr_text && !prev.ocr_text) prev.ocr_text = sc.ocr_text
      if (sc.scene_description.length > prev.scene_description.length) {
        prev.scene_description = sc.scene_description
      }
      continue
    }
    merged.push({ ...sc })
  }

  let lastRole: SceneRole | null = null
  return merged.map((sc, i) => {
    let role = sc.scene_role
    if (role === lastRole) {
      const alt = ROLE_ORDER.find((r) => r !== lastRole && r !== role)
      if (alt) role = alt
    }
    lastRole = role
    return {
      ...sc,
      scene_role: role,
      script_lines: generateScriptLinesLocal({
        scene_role: role,
        scene_description: sc.scene_description,
      }),
    }
  })
}

export function actionScenesToVisualScenes(scenes: ActionScene[]): VisualScene[] {
  return scenes.map((s) => ({
    start: s.start,
    end: s.end,
    description: s.scene_description,
    shot_type: s.shot_type,
    scene_role: s.scene_role,
    script_lines: s.script_lines,
    ocr_text: s.ocr_text,
  }))
}

export function actionScenesToVideoScenes(scenes: ActionScene[]): VideoScene[] {
  return scenes.map((s, i) => ({
    start: s.start,
    end: s.end,
    description: s.scene_description,
    importance: Math.min(10, 9 - Math.floor(i / 2)),
    visual_type: sceneRoleToVisualType(s.scene_role),
    content_type: s.content_type ?? "product_in_use",
    shot_type: s.shot_type,
    scene_role: s.scene_role,
    script_lines: s.script_lines,
    ocr_text: s.ocr_text,
  }))
}

function sceneRoleToVisualType(role: SceneRole): VideoScene["visual_type"] {
  switch (role) {
    case "문제 제기":
      return "problem"
    case "구매 포인트":
    case "마무리":
      return "cta"
    case "사용 방법":
    case "설치 방법":
      return "demo"
    case "수납 효과":
    case "추가 활용":
      return "result"
    default:
      return "product_showcase"
  }
}

export function parseActionFrameFromVisionRow(row: Record<string, unknown>, timeSec: number, content_type: SceneContentType): ActionFrameRow {
  const shot_type = String(row.shot_type || row.shotType || "").trim()
  const hand_action = String(row.hand_action || row.handAction || row.action || "").trim()
  const product = String(row.product || "").trim()
  const product_use = String(row.product_use || row.productUse || "").trim()
  const ocr_text = String(row.ocr_text || row.ocr || row.text || "").trim()
  const scene_hint = String(row.scene_hint || row.sceneHint || "").trim()
  const legacyCaption = String(row.caption || "").trim()

  const frame: ActionFrameRow = {
    timeSec,
    content_type,
    ...(shot_type ? { shot_type } : {}),
    ...(hand_action ? { hand_action } : {}),
    ...(product ? { product } : {}),
    ...(product_use ? { product_use } : {}),
    ...(ocr_text ? { ocr_text } : {}),
    ...(scene_hint ? { scene_hint } : {}),
  }

  if (!hand_action && legacyCaption && !ABSTRACT_SCENE_RE.test(legacyCaption)) {
    frame.hand_action = legacyCaption.replace(/^\[[^\]]+\]\s*/, "")
  }

  frame.caption = composeActionSceneDescription(frame)
  return frame
}

/** OpenAI — 프레임 목록 → 행동 기반 장면 JSON */
export async function refineActionScenesWithOpenAi(args: {
  apiKey: string
  productTitle: string
  duration: number
  frames: ActionFrameRow[]
}): Promise<ActionScene[]> {
  const { apiKey, productTitle, duration, frames } = args
  if (!frames.length) return []

  const frameSummary = frames.map((f, i) => ({
    index: i,
    timeSec: f.timeSec,
    shot_type: f.shot_type,
    hand_action: f.hand_action,
    product: f.product,
    product_use: f.product_use,
    ocr_text: f.ocr_text,
    scene_hint: f.scene_hint,
    content_type: f.content_type,
  }))

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.35,
      max_tokens: 3200,
      response_format: { type: "json_object" as const },
      messages: [
        { role: "system", content: ACTION_SCENE_MERGE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `제품: ${productTitle}
영상 길이: ${duration}초

프레임 행동 분석:
${JSON.stringify(frameSummary, null, 0)}

행동이 바뀌는 시점마다 장면을 나누고 script_lines를 작성하세요.`,
        },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  })

  if (!res.ok) {
    return buildActionScenesFromFrames(frames, duration)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) return buildActionScenesFromFrames(frames, duration)

  try {
    const parsed = JSON.parse(content) as { scenes?: unknown }
    if (!Array.isArray(parsed.scenes)) return buildActionScenesFromFrames(frames, duration)

    const scenes: ActionScene[] = []
    for (const row of parsed.scenes) {
      if (!row || typeof row !== "object") continue
      const o = row as Record<string, unknown>
      const start = Number(o.start)
      const end = Number(o.end)
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
      const scene_role = String(o.scene_role || "데모") as SceneRole
      const script_lines = Array.isArray(o.script_lines)
        ? o.script_lines.map((l) => String(l).trim().slice(0, 16)).filter(Boolean).slice(0, 3)
        : generateScriptLinesLocal({ scene_role, scene_description: String(o.scene_description || "") })
      scenes.push({
        start: Math.max(0, start),
        end: Math.min(duration, end),
        shot_type: String(o.shot_type || "미디엄샷"),
        scene_role: ROLE_ORDER.includes(scene_role) ? scene_role : "데모",
        scene_description: String(o.scene_description || "").trim().slice(0, 220),
        script_lines: script_lines.length ? script_lines : ["이 장면", "직접 보면", "와닿아요"],
        ocr_text: String(o.ocr_text || "").trim() || undefined,
      })
    }

    if (!scenes.length) return buildActionScenesFromFrames(frames, duration)
    return dedupeActionScenes(scenes)
  } catch {
    return buildActionScenesFromFrames(frames, duration)
  }
}

export function actionScenesToExportJson(scenes: ActionScene[]): Array<{
  shot_type: string
  scene_role: string
  scene_description: string
  script_lines: string[]
}> {
  return scenes.map((s) => ({
    shot_type: s.shot_type,
    scene_role: s.scene_role,
    scene_description: s.scene_description,
    script_lines: s.script_lines,
  }))
}

/** 소스 구간과 겹치는 행동 기반 장면 */
export function actionSceneForSourceRange(
  analysis: { action_scenes?: ActionScene[] },
  sourceStart: number,
  sourceEnd: number
): ActionScene | null {
  const scenes = analysis.action_scenes
  if (!scenes?.length) return null
  let best: ActionScene | null = null
  let bestOverlap = 0
  for (const sc of scenes) {
    const overlap = Math.max(0, Math.min(sourceEnd, sc.end) - Math.max(sourceStart, sc.start))
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = sc
    }
  }
  return bestOverlap >= 0.12 ? best : null
}

/** 행동 기반 장면의 script_lines → 나레이션 텍스트 */
export function actionScriptTextForSourceRange(
  analysis: { action_scenes?: ActionScene[] },
  sourceStart: number,
  sourceEnd: number
): string {
  const scene = actionSceneForSourceRange(analysis, sourceStart, sourceEnd)
  if (!scene?.script_lines?.length) return ""
  return scene.script_lines
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\n")
}

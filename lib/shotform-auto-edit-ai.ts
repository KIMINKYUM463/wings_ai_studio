import type {
  AutoEditTargetDuration,
  EditPlan,
  ScriptLine,
  ShoppingScript,
  VideoAnalysis,
  VideoScene,
  VisualScene,
  SceneContentType,
} from "@/lib/shotform-auto-edit-types"
import {
  buildEditPlanFromScript,
  buildFallbackScriptFromScenes,
  buildSceneBasedEditPlan,
  finalizeEditPlan,
  normalizeScriptTiming,
} from "@/lib/shotform-auto-edit-plan-finalize"
import {
  filterScenesForEdit,
  mergeVisionIntoScenes,
} from "@/lib/shotform-auto-edit-product-filter"
import { boostSceneImportance, compareScenesByEditorialPriority, sceneEditorialScore } from "@/lib/shotform-scene-priority"
import { ACTION_SCENE_MERGE_SYSTEM_PROMPT } from "@/lib/shotform-scene-understanding"
import { normalizeBenchmarkVisualScenes } from "@/lib/shotform-visual-scene-match"

const BENCHMARK_VISION_HINT_MAX = 8
import type { VideoVisionScreenResult } from "@/lib/shotform-auto-edit-vision"

async function openaiJson<T>(apiKey: string, system: string, user: string, maxTokens = 1200): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.35,
      max_tokens: maxTokens,
      response_format: { type: "json_object" as const },
      messages: [
        { role: "system" as const, content: system },
        { role: "user" as const, content: user },
      ],
    }),
    signal: AbortSignal.timeout(55_000),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`OpenAI 실패 (${res.status}): ${t.slice(0, 180)}`)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("OpenAI 응답이 비어 있습니다.")
  return JSON.parse(content) as T
}

function heuristicScenes(duration: number): VideoScene[] {
  const count = Math.max(4, Math.min(12, Math.ceil(duration / 3.5)))
  const segLen = duration / count
  const types: VideoScene["visual_type"][] = ["demo", "product_showcase", "demo", "result", "problem"]
  const scenes: VideoScene[] = []
  for (let i = 0; i < count; i++) {
    const start = Math.round(i * segLen * 10) / 10
    const end = Math.round(Math.min(duration, (i + 1) * segLen) * 10) / 10
    const visual_type = types[i % types.length]!
    scenes.push({
      start,
      end,
      description: visual_type === "demo" ? `제품 사용·기능 장면 ${i + 1}` : `장면 ${i + 1}`,
      importance: visual_type === "demo" || visual_type === "product_showcase" ? 10 : 6,
      visual_type,
      content_type: visual_type === "demo" ? "product_in_use" : "product_only",
    })
  }
  return scenes
}

function normalizeScenes(raw: unknown, duration: number): VideoScene[] {
  if (!Array.isArray(raw)) return heuristicScenes(duration)
  const out: VideoScene[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const start = Number(o.start)
    const end = Number(o.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    out.push({
      start: Math.max(0, Math.min(duration, start)),
      end: Math.max(0, Math.min(duration, end)),
      description: String(o.description || "장면").trim(),
      importance: Math.min(10, Math.max(1, Math.round(Number(o.importance) || 7))),
      visual_type: (["product_showcase", "problem", "demo", "result", "cta", "other"].includes(
        String(o.visual_type)
      )
        ? String(o.visual_type)
        : "other") as VideoScene["visual_type"],
      content_type: normalizeContentType(o.content_type),
      has_person_presenting: Boolean(o.has_person_presenting),
    })
  }
  return out.length ? out.sort((a, b) => a.start - b.start) : heuristicScenes(duration)
}

function normalizeVisualScenes(raw: unknown, duration: number): VisualScene[] {
  return normalizeBenchmarkVisualScenes(raw, duration)
}

function normalizeContentType(raw: unknown): SceneContentType | undefined {
  const v = String(raw || "")
  if (
    v === "product_only" ||
    v === "product_in_use" ||
    v === "person_presenting" ||
    v === "talking_head" ||
    v === "mixed" ||
    v === "text_overlay" ||
    v === "other"
  ) {
    return v
  }
  return undefined
}

export async function analyzeVideoWithAi(args: {
  apiKey: string
  videoId: string
  title: string
  platform: string
  duration: number
  sourceUrl: string
  vision?: VideoVisionScreenResult
}): Promise<VideoAnalysis> {
  const { apiKey, videoId, title, platform, duration, sourceUrl, vision } = args
  const fallback = heuristicScenes(duration)

  try {
    const parsed = await openaiJson<{
      productName?: string
      category?: string
      targetKeywords?: unknown
      videoStructure?: { hook?: string; body?: string; cta?: string }
      summary?: string
      scenes?: unknown
      edit_scenes?: unknown
    }>(
      apiKey,
      `쇼핑 숏폼·릴스 **행동 기반 장면 분석**. 이미지 캡션 금지. JSON만 출력.

${ACTION_SCENE_MERGE_SYSTEM_PROMPT}

추가 필드:
productName, category, targetKeywords[](한국어), videoStructure{hook,body,cta}, summary(한국어)

edit_scenes[{start,end,description,importance,visual_type,content_type,scene_role,script_lines}] — 편집용.
- description = scene_description (행동 중심, [샷타입] 포함)
- importance 9~10: 후킹·설치·실사용 데모
- **중국어 자막·하단 텍스트만 있는 구간은 제외**`,
      `제목: ${title || "(없음)"}
플랫폼: ${platform}
영상 길이: ${duration.toFixed(1)}초
${
        vision?.frames.length
          ? `Vision 키프레임 (실제 화면 참고 — scenes는 3~12개 의미 장면으로 압축):
${JSON.stringify(
  vision.frames.slice(0, BENCHMARK_VISION_HINT_MAX).map((f) => ({
    timeSec: f.timeSec,
    content_type: f.content_type,
    caption: f.caption?.slice(0, 80),
  }))
)}`
          : ""
      }

JSON: {"productName":"","category":"","targetKeywords":[],"videoStructure":{"hook":"","body":"","cta":""},"summary":"","scenes":[],"edit_scenes":[]}`,
      2000
    )
    const semanticScenes = normalizeVisualScenes(parsed.scenes, duration)
    const keywords = Array.isArray(parsed.targetKeywords)
      ? parsed.targetKeywords.map((k) => String(k).trim()).filter(Boolean)
      : []
    let scenes = normalizeScenes(parsed.edit_scenes ?? parsed.scenes, duration)
    if (vision?.frames.length) {
      scenes = mergeVisionIntoScenes(scenes, vision.frames, duration)
    }
    scenes = filterScenesForEdit(scenes, vision?.frames)
    if (!scenes.length) {
      scenes = filterScenesForEdit(
        mergeVisionIntoScenes(fallback, vision?.frames ?? [], duration),
        vision?.frames
      )
    }
    scenes = boostSceneImportance(scenes).sort(compareScenesByEditorialPriority)
    return {
      video_id: videoId,
      title,
      platform,
      duration,
      source_url: sourceUrl,
      scenes,
      visual_scenes: semanticScenes.length ? semanticScenes : undefined,
      productName: parsed.productName || title,
      category: parsed.category || "쇼핑",
      targetKeywords: keywords,
      videoStructure: parsed.videoStructure
        ? {
            hook: String(parsed.videoStructure.hook || ""),
            body: String(parsed.videoStructure.body || ""),
            cta: String(parsed.videoStructure.cta || ""),
          }
        : undefined,
      summary: parsed.summary || "",
      product_fit: vision?.product_fit,
      product_fit_reason: vision?.product_fit_reason,
      vision_frames: vision?.frames,
    }
  } catch {
    let scenes = filterScenesForEdit(
      vision?.frames.length
        ? mergeVisionIntoScenes(fallback, vision.frames, duration)
        : fallback,
      vision?.frames
    )
    if (!scenes.length) scenes = filterScenesForEdit(fallback, vision?.frames)
    scenes = boostSceneImportance(scenes).sort(compareScenesByEditorialPriority)
    return {
      video_id: videoId,
      title,
      platform,
      duration,
      source_url: sourceUrl,
      scenes,
      productName: title,
      category: "쇼핑",
      summary: title,
      product_fit: vision?.product_fit,
      product_fit_reason: vision?.product_fit_reason,
      vision_frames: vision?.frames,
    }
  }
}

function targetLineCount(td: AutoEditTargetDuration): { min: number; max: number } {
  const min = Math.max(4, Math.round(td / 4))
  const max = Math.min(22, Math.max(min + 2, Math.round(td / 3.2)))
  return { min, max }
}

function scenesForPrompt(analyses: VideoAnalysis[]) {
  return analyses.map((a) => ({
    video_id: a.video_id,
    title: a.title,
    duration: a.duration,
    scenes: a.scenes
      .map((sc, scene_index) => ({ sc, scene_index }))
      .filter(({ sc }) => sc.end > sc.start + 0.15)
      .sort((x, y) => compareScenesByEditorialPriority(x.sc, y.sc))
      .map(({ sc, scene_index }) => ({
        scene_index,
        start: sc.start,
        end: sc.end,
        description: sc.description,
        importance: sc.importance,
        visual_type: sc.visual_type,
        content_type: sc.content_type,
        editorial_score: Math.round(sceneEditorialScore(sc) * 10) / 10,
      })),
  }))
}

/** 대본 scene_index 중복·연속 같은 video_id 방지 */
function enforceUniqueScriptScenes(lines: ScriptLine[], analyses: VideoAnalysis[]): ScriptLine[] {
  if (!lines.length) return lines

  const videoIds = analyses.map((a) => a.video_id)
  const byId = new Map(analyses.map((a) => [a.video_id, a]))
  const out: ScriptLine[] = lines.map((l) => ({ ...l }))
  const usedSceneRefs = new Set<string>()
  let lastVid: string | null = null

  function findUnusedScene(preferOtherThan?: string | null): { video_id: string; scene_index: number } | null {
    const order = preferOtherThan
      ? [...videoIds.filter((id) => id !== preferOtherThan), preferOtherThan]
      : videoIds

    for (const vid of order) {
      const a = byId.get(vid)
      if (!a) continue
      for (let si = 0; si < a.scenes.length; si++) {
        const sc = a.scenes[si]!
        if (sc.end <= sc.start + 0.15) continue
        const rk = `${vid}:${si}`
        if (usedSceneRefs.has(rk)) continue
        return { video_id: vid, scene_index: si }
      }
    }
    return null
  }

  for (let i = 0; i < out.length; i++) {
    let line = out[i]!

    if (line.video_id && line.scene_index != null) {
      const a = byId.get(line.video_id)
      const sc = a?.scenes[line.scene_index]
      const refKey = `${line.video_id}:${line.scene_index}`
      const invalid =
        !sc ||
        !a ||
        sc.end <= sc.start + 0.15 ||
        usedSceneRefs.has(refKey)

      if (invalid) {
        const alt = findUnusedScene(line.video_id === lastVid ? lastVid : null)
        if (alt) line = { ...line, ...alt }
        else line = { ...line, video_id: undefined, scene_index: undefined }
        out[i] = line
      }
    }

    if (videoIds.length > 1 && line.video_id && line.video_id === lastVid) {
      const alt = findUnusedScene(lastVid)
      if (alt) {
        line = { ...line, ...alt }
        out[i] = line
      }
    }

    if (line.video_id != null && line.scene_index != null) {
      usedSceneRefs.add(`${line.video_id}:${line.scene_index}`)
    }
    lastVid = out[i]!.video_id ?? lastVid
  }

  for (const vid of videoIds) {
    if (out.some((l) => l.video_id === vid)) continue
    const slot = out.findIndex((l, idx) => idx > 0)
    if (slot < 0) continue
    const alt = findUnusedScene(null)
    if (alt?.video_id === vid) out[slot] = { ...out[slot]!, ...alt }
  }

  return out
}

/** 1단계 — 분석된 장면에 맞춰 쇼핑 대본 작성 (편집보다 먼저) */
export async function generateShoppingScriptFromScenes(args: {
  apiKey: string
  analyses: VideoAnalysis[]
  targetDuration: AutoEditTargetDuration
}): Promise<ShoppingScript> {
  const { apiKey, analyses, targetDuration } = args
  const multi = analyses.length > 1
  const { min, max } = targetLineCount(targetDuration)
  const titleSummary = analyses.map((a) => `[${a.video_id}] ${a.title}`).join(" / ")

  try {
    const parsed = await openaiJson<{ script?: unknown; tone?: string }>(
      apiKey,
      `쇼핑숏폼 대본 작가. JSON만 출력.
톤: 빠른 설명, 구매욕 자극, 구어체.

**먼저 대본을 작성**하고, 각 줄마다 어울리는 장면(scene_index)을 지정하세요.
script 항목: start/end(초), text(한국어), video_id, scene_index(정수).

규칙:
- 전체 ${targetDuration}초. 마지막 end = ${targetDuration}.
- ${min}~${max}줄. **한 줄당 2.5~4초** (3~4초 리듬).
- 서사 순서: 후킹→문제→데모→결과→CTA.
- text 내용은 해당 scene description·visual_type과 맞출 것.
- person_presenting/talking_head/mixed scene_index 사용 금지. **얼굴 나오는 장면 금지.**
- scene_index는 입력 scenes[] 배열의 0부터 시작하는 인덱스.
- **동일 scene_index 재사용 금지** — 전체 대본에서 각 (video_id, scene_index) 조합은 1회만.
${
  multi
    ? `- **필수 짜집기**: ${analyses.length}개 영상(video_id)을 **번갈아** 사용. 연속 2줄 이상 같은 video_id 금지. 각 video_id 최소 2줄 이상 포함.`
    : ""
}`,
      `레퍼런스: ${titleSummary}
목표 길이: ${targetDuration}초

분석된 장면 (video_id별, scene_index 포함):
${JSON.stringify(scenesForPrompt(analyses), null, 0)}

JSON: {"tone":"쇼핑숏폼","script":[{"start":0,"end":3.5,"text":"","video_id":"video_001","scene_index":0}]}`,
      multi ? 2000 : 1600
    )

    const raw = Array.isArray(parsed.script)
      ? parsed.script
          .map((row) => {
            if (!row || typeof row !== "object") return null
            const o = row as Record<string, unknown>
            const start = Number(o.start)
            const end = Number(o.end)
            const text = String(o.text || "").trim()
            const video_id = typeof o.video_id === "string" ? o.video_id.trim() : undefined
            const scene_index =
              o.scene_index != null && Number.isFinite(Number(o.scene_index))
                ? Math.max(0, Math.floor(Number(o.scene_index)))
                : undefined
            if (!Number.isFinite(start) || !Number.isFinite(end) || !text) return null
            return { start, end, text, video_id, scene_index }
          })
          .filter(Boolean)
      : []

    if (raw.length) {
      const mixed = enforceUniqueScriptScenes(raw as ScriptLine[], analyses)
      return {
        tone: String(parsed.tone || "쇼핑숏폼"),
        script: normalizeScriptTiming(mixed, targetDuration),
      }
    }
  } catch {
    /* fallback below */
  }

  return buildFallbackScriptFromScenes(analyses, targetDuration)
}

/** 2단계 — 대본 줄 순서·타이밍에 맞춰 편집 지시서 생성 */
export function createEditPlanFromScript(args: {
  script: ShoppingScript
  analyses: VideoAnalysis[]
  targetDuration: AutoEditTargetDuration
}): EditPlan {
  return buildEditPlanFromScript(args.script, args.analyses, args.targetDuration)
}

/** @deprecated — script-first 파이프라인 사용 */
export async function createEditPlanWithAi(args: {
  apiKey: string
  analyses: VideoAnalysis[]
  targetDuration: AutoEditTargetDuration
}): Promise<EditPlan> {
  const { apiKey, analyses, targetDuration } = args
  const multi = analyses.length > 1

  const parsed = await openaiJson<{ edit_plan?: unknown; target_duration?: number }>(
    apiKey,
    `쇼핑 숏폼 편집 PD. JSON만 출력.
목표 최종 길이: 정확히 ${targetDuration}초 (output_end 마지막 = ${targetDuration}).
edit_plan 항목: video_id, source_start, source_end, output_start, output_end, reason(한국어).

규칙:
- **person_presenting/talking_head 구간은 절대 사용 금지.** product_only, product_in_use 장면만 컷.
- 각 컷: (output_end - output_start) = (source_end - source_start) — 같은 길이만큼 소스에서 잘라 타임라인에 배치.
- 모든 output 구간 합 = ${targetDuration}초.
- 장면 importance·visual_type을 보고 **짧은 하이라이트**만 선택 (컷당 2.5~4초). 긴 구간 통째로 붙이지 말 것.
${
  multi
    ? `여러 영상(${analyses.length}개) 짜집기 — video_id를 섞어 후킹→문제→데모→결과 순.`
    : "한 영상에서 서로 다른 장면 구간만 선택."
}`,
    `${multi ? "입력 영상 분석 (video_id별):" : "입력 영상:"}
${JSON.stringify(
  analyses.map((a) => ({
    video_id: a.video_id,
    title: a.title,
    duration: a.duration,
    scenes: a.scenes,
  })),
  null,
  0
)}

목표: ${targetDuration}초

JSON: {"target_duration":${targetDuration},"edit_plan":[]}`,
    multi ? 1600 : 1200
  )

  return finalizeEditPlan(
    normalizeEditPlanMulti(parsed, analyses, targetDuration),
    analyses
  )
}

function analysisMap(analyses: VideoAnalysis[]): Map<string, VideoAnalysis> {
  return new Map(analyses.map((a) => [a.video_id, a]))
}

function normalizeEditPlanMulti(
  parsed: { edit_plan?: unknown; target_duration?: number },
  analyses: VideoAnalysis[],
  targetDuration: AutoEditTargetDuration
): EditPlan {
  const byId = analysisMap(analyses)
  const defaultId = analyses[0]!.video_id
  const raw = Array.isArray(parsed.edit_plan) ? parsed.edit_plan : []
  const segments: EditPlan["edit_plan"] = []
  let outT = 0

  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const ss = Number(o.source_start)
    const se = Number(o.source_end)
    const os = Number(o.output_start)
    const oe = Number(o.output_end)
    if (![ss, se, os, oe].every(Number.isFinite)) continue
    if (se <= ss || oe <= os) continue
    const vid = String(o.video_id || defaultId)
    const analysis = byId.get(vid) || analyses[0]!
    segments.push({
      video_id: analysis.video_id,
      source_start: Math.max(0, Math.min(analysis.duration, ss)),
      source_end: Math.max(0, Math.min(analysis.duration, se)),
      output_start: os,
      output_end: oe,
      reason: String(o.reason || "").trim() || "선택 컷",
    })
    outT = Math.max(outT, oe)
  }

  if (segments.length === 0) {
    return buildSceneBasedEditPlan(analyses, targetDuration)
  }

  return { target_duration: targetDuration, edit_plan: segments }
}

/** @deprecated — generateShoppingScriptFromScenes 사용 */
export async function generateShoppingScriptWithAi(args: {
  apiKey: string
  analyses: VideoAnalysis[]
  editPlan: EditPlan
}): Promise<ShoppingScript> {
  const { apiKey, analyses, editPlan } = args
  const td = editPlan.target_duration
  const titleSummary = analyses.map((a) => `[${a.video_id}] ${a.title}`).join(" / ")

  const parsed = await openaiJson<{ script?: unknown; tone?: string }>(
    apiKey,
    `쇼핑숏폼 대본 작가. JSON만 출력.
톤: 빠른 설명, 구매욕 자극, 구어체.
script: start/end(초), text(한국어). 전체 ${td}초.
${analyses.length > 1 ? "여러 레퍼런스 영상을 짜집기한 하나의 쇼츠 대본." : ""}`,
    `레퍼런스: ${titleSummary}
목표 길이: ${td}초

편집 구성 (video_id별 컷):
${JSON.stringify(editPlan.edit_plan, null, 0)}

각 output 구간에 맞는 내레이션 대본 작성.

JSON: {"tone":"쇼핑숏폼","script":[{"start":0,"end":3,"text":""}]}`
  )

  const script = Array.isArray(parsed.script)
    ? parsed.script
        .map((row) => {
          if (!row || typeof row !== "object") return null
          const o = row as Record<string, unknown>
          const start = Number(o.start)
          const end = Number(o.end)
          const text = String(o.text || "").trim()
          if (!Number.isFinite(start) || !Number.isFinite(end) || !text) return null
          return { start, end, text }
        })
        .filter(Boolean)
    : []

  if (!script.length) {
    const fallbackTitle = analyses.map((a) => a.title).join(" · ")
    return {
      tone: "쇼핑숏폼",
      script: editPlan.edit_plan.map((seg) => ({
        start: seg.output_start,
        end: seg.output_end,
        text: seg.reason || fallbackTitle.slice(0, 40),
      })),
    }
  }

  return { tone: String(parsed.tone || "쇼핑숏폼"), script: script as ShoppingScript["script"] }
}

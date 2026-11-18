import { openaiChatJson } from "@/lib/longform-v2/openai"
import {
  BEAT_SCRIPT_TONE,
  type AutoEditTargetDuration,
  type EditPlan,
  type EditPlanSegment,
  type MixInfo,
  type ProductAnalysis,
  type SceneContentType,
  type ShoppingScript,
  type VideoAnalysis,
} from "@/lib/shotform-auto-edit-types"
import { NARRATION_PRODUCT_NAME_USAGE_RULE } from "@/lib/shotform-narration-script-audit"
import { narrationPlainCharCount } from "@/lib/shotform-narration-timing"
import { primaryProductLabelFromKeywords } from "@/lib/shotform-user-keyword-product"
import { describeSourceRangeFromAnalysis } from "@/lib/shotform-visual-scene-match"
import { buildRemixFlowPrompt } from "@/lib/remix-shopping-market-intelligence"

/** 컷 길이 산정용 낭독 속도(공백 제외 글자/초). 실제 TTS보다 약간 느리게 잡아 컷이 음성보다 살짝 길게 나온다 */
const BEAT_CUT_CHARS_PER_SEC = 6.3
/** 대본 분량 목표용 낭독 속도 — 1.1x Typecast·Supertonic 실측 사이 */
const BEAT_SCRIPT_CHARS_PER_SEC = 7
const BEAT_CUT_PAD_SEC = 0.15
const MIN_BEAT_CUT_SEC = 1.2
const MAX_LIBRARY_CLIP_SEC = 5
const MIN_LIBRARY_CLIP_SEC = 0.8
const MAX_LIBRARY_CLIPS = 60
const CONTIGUOUS_GAP_SEC = 0.2

const ROUND = (n: number) => Math.round(n * 100) / 100

type BeatClip = {
  id: string
  video_id: string
  start: number
  end: number
  desc: string
  shot?: string
  hasText: boolean
  q: number
}

type Beat = { text: string; clipId: string }

const CONTENT_QUALITY: Partial<Record<SceneContentType, number>> = {
  product_in_use: 5,
  product_only: 4,
  mixed: 3,
  person_presenting: 2,
  text_overlay: 1,
}

type RawClip = Omit<BeatClip, "id">

/** Vision 프레임마다 앞뒤 프레임과의 중간 지점까지를 한 클립으로 — 고속 분석의 장면 목록보다 훨씬 촘촘하다 */
function clipsFromVisionFrames(a: VideoAnalysis): RawClip[] {
  const frames = [...(a.vision_frames ?? [])].sort((x, y) => x.timeSec - y.timeSec)
  if (frames.length < 2) return []
  return frames.flatMap((f, i): RawClip[] => {
    // 말하는 얼굴 위주 화면은 리믹스 정책상 쓰지 않는다
    if (f.content_type === "talking_head") return []
    const start = i === 0 ? 0 : (frames[i - 1]!.timeSec + f.timeSec) / 2
    const end = i === frames.length - 1 ? a.duration : (f.timeSec + frames[i + 1]!.timeSec) / 2
    return [{
      video_id: a.video_id,
      start: ROUND(start),
      end: ROUND(end),
      desc: (f.caption || describeSourceRangeFromAnalysis(a, start, end)).slice(0, 90),
      shot: f.shot_type,
      hasText: Boolean(f.ocr_text?.trim()) || f.content_type === "text_overlay",
      q: CONTENT_QUALITY[f.content_type] ?? 2,
    }]
  })
}

/** Vision 프레임이 없을 때 — 장면 목록을 5초 이하로 나눈다 */
function clipsFromScenes(a: VideoAnalysis): RawClip[] {
  const scenes = a.scenes.length ? a.scenes : (a.visual_scenes ?? []).map((s) => ({ ...s, importance: 3 }))
  return scenes.flatMap((sc) => {
    const len = sc.end - sc.start
    if (len < MIN_LIBRARY_CLIP_SEC) return []
    const parts = Math.ceil(len / MAX_LIBRARY_CLIP_SEC)
    const step = len / parts
    return Array.from({ length: parts }, (_, p): RawClip => {
      const start = ROUND(sc.start + step * p)
      const end = ROUND(p === parts - 1 ? sc.end : sc.start + step * (p + 1))
      return {
        video_id: a.video_id,
        start,
        end,
        desc: describeSourceRangeFromAnalysis(a, start, end, sc.description).slice(0, 90),
        shot: sc.shot_type,
        hasText: Boolean(sc.ocr_text?.trim()),
        q: Math.max(1, Math.min(5, Math.round(("importance" in sc ? sc.importance : 3) || 3))),
      }
    })
  })
}

/** AI가 고를 클립 라이브러리 (shorts-maker의 컷 목록에 해당) */
function buildClipLibrary(analyses: VideoAnalysis[]): BeatClip[] {
  const clips: BeatClip[] = []
  analyses.forEach((a, vi) => {
    const raw = clipsFromVisionFrames(a)
    for (const c of raw.length ? raw : clipsFromScenes(a)) {
      if (c.end - c.start >= MIN_LIBRARY_CLIP_SEC) clips.push({ ...c, id: `v${vi + 1}c${clips.length + 1}` })
    }
  })
  if (clips.length <= MAX_LIBRARY_CLIPS) return clips
  const keep = new Set([...clips].sort((x, y) => y.q - x.q).slice(0, MAX_LIBRARY_CLIPS))
  return clips.filter((c) => keep.has(c))
}

function beatPrompt(args: {
  productName: string
  keywords: string[]
  productAnalysis: ProductAnalysis
  scriptTopic?: string
  library: BeatClip[]
  targetSec: number
}): { system: string; user: string } {
  const { productName, productAnalysis: pa, library, targetSec } = args
  const beats = Math.max(5, Math.round(targetSec / 3.5))
  const totalChars = Math.round(targetSec * BEAT_SCRIPT_CHARS_PER_SEC)
  const lib = library.map((c) => ({
    id: c.id,
    len: ROUND(c.end - c.start),
    desc: c.desc,
    shot: c.shot,
    text: c.hasText,
    q: c.q,
  }))
  const system =
    "너는 한국 쇼핑 숏폼 대본 작가다. 나레이션 대본을 쓰면서, 각 문장에 어울리는 영상 클립을 라이브러리에서 함께 고른다. JSON만 출력한다."
  const structure = pa.videoStructure
  const user = `[제품] ${productName}${pa.category ? ` (${pa.category})` : ""}
[키워드] ${args.keywords.join(", ")}
${args.scriptTopic?.trim() ? `[주제·요청] ${args.scriptTopic.trim()}\n` : ""}[원본 영상 구조]
- 포맷: ${structure?.format || "-"}
- 후킹: ${structure?.hook || "-"}
- 첫 화면: ${structure?.openingVisual || "-"}
- 본문: ${structure?.body || "-"}
- 증명: ${structure?.proof || "-"}
- 신뢰: ${structure?.trust || "-"}
- 마무리: ${structure?.cta || "-"}
- 컷 리듬: ${structure?.pacing || "-"}
- 장면 흐름: ${structure?.shotFlow?.join(" → ") || "-"}
${pa.summary ? `[원본 요약] ${pa.summary}\n` : ""}
[사용 가능한 클립 라이브러리] (len=초, text=화면 글자 박힘, q=소재 품질 1~5)
${JSON.stringify(lib)}

출력(JSON만):
{
  "headcopy": ["상단 고정 문구 1줄 (12자 이내)", "2줄 (12자 이내, 제품명이나 핵심 혜택)"],
  "beats": [ { "text": "나레이션 한 문장", "clipId": "라이브러리의 id" } ]
}

규칙:
- 전체 낭독 길이 약 ${targetSec}초 = 공백 제외 약 ${totalChars}자(±10%). 비트 ${beats}개 안팎.
${buildRemixFlowPrompt(beats)}
- **한 비트 = 한 문장**, 읽는 데 2~4초(공백 제외 13~28자). 문장 두 개를 한 비트에 넣지 마라.
- 첫 비트는 강한 후킹, 마지막 비트는 구매·댓글 유도.
- **각 비트의 clipId는 그 문장 내용과 화면이 가장 잘 맞는 클립**. 문장이 말하는 행동·사물이 실제로 보이는 클립을 골라라.
- 긴 문장에는 len이 긴 클립을 골라라. 같은 클립을 연속으로 쓰지 말고, 가능하면 클립을 고르게 써라.
- text:true 클립과 q가 낮은 클립은 되도록 피하라.
- 화면에 없는 기능을 지어내지 말고, 원본 문장을 베끼지 말고 새 구어체로 써라.
- ${NARRATION_PRODUCT_NAME_USAGE_RULE}
- 소스 영상 제목·화면 글자에 나오는 판매처·매장(다이소·쿠팡·올리브영 등)·채널명·가격 숫자는 말하지 마라. 이 영상은 시청자를 우리 구매 링크로 보내므로 다른 매장으로 가라는 말이 되면 안 된다. 마지막 CTA는 「지금 확인해 보세요」처럼 매장 없이 끝낸다.
- 음성으로 읽히므로 ㄷㄷ·ㅋㅋ·ㅠㅠ 같은 자모 표현, 이모지, 「컷1」 같은 라벨은 쓰지 마라. 숫자·영어는 읽기 쉽게 한글로 풀어 써도 좋다.`
  return { system, user }
}

const stripJamo = (text: string) =>
  text
    .split(/\s+/)
    .filter((w) => w && !/^[ㄱ-ㅎㅏ-ㅣ]+[!?.~]*$/.test(w))
    .join(" ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .trim()

/** AI 응답 정리 — 없는 clipId·직전과 같은 clipId는 덜 쓴 고품질 클립으로 바꾼다 */
function sanitizeBeats(raw: unknown, library: BeatClip[]): Beat[] {
  const rows = Array.isArray(raw) ? raw : []
  const byId = new Map(library.map((c) => [c.id, c]))
  const used = new Map<string, number>()
  const out: Beat[] = []
  for (const row of rows) {
    const r = (row ?? {}) as { text?: unknown; clipId?: unknown }
    const text = stripJamo(String(r.text ?? "").replace(/\s*\n\s*/g, " "))
    if (!text) continue
    const prev = out[out.length - 1]?.clipId
    let clipId = typeof r.clipId === "string" && byId.has(r.clipId) ? r.clipId : ""
    if (!clipId || clipId === prev) {
      clipId =
        [...library]
          .filter((c) => c.id !== prev)
          .sort((x, y) => (used.get(x.id) ?? 0) - (used.get(y.id) ?? 0) || y.q - x.q)[0]?.id ?? ""
    }
    if (!clipId) continue
    used.set(clipId, (used.get(clipId) ?? 0) + 1)
    out.push({ text, clipId })
  }
  return out
}

const scriptSec = (beats: Beat[]) =>
  beats.reduce((s, b) => s + narrationPlainCharCount(b.text), 0) / BEAT_SCRIPT_CHARS_PER_SEC

/**
 * 같은 영상에서 이어지는 라이브러리 클립을 합친 연속 구간 — 음성이 클립보다 길 때 다음 장면으로 이어 쓴다.
 * 다른 비트가 고른 클립은 건너뛰어 같은 화면이 두 번 나오지 않게 한다.
 */
function contiguousSpan(clip: BeatClip, library: BeatClip[], reserved: Set<string>): { start: number; end: number } {
  const same = library
    .filter((c) => c.video_id === clip.video_id && (c.id === clip.id || !reserved.has(c.id)))
    .sort((x, y) => x.start - y.start)
  let { start, end } = clip
  for (const c of same) if (c.start <= end + CONTIGUOUS_GAP_SEC && c.end > end) end = c.end
  for (const c of [...same].reverse()) if (c.end >= start - CONTIGUOUS_GAP_SEC && c.start < start) start = c.start
  return { start, end }
}

type Range = { start: number; end: number }
type Window = Range & { video_id: string; span: Range; limit: number }

/** 원본 영상 전체 범위 중 같은 영상을 쓰는 다른 컷과 겹치지 않는 구간 */
function freeSourceRange(w: Window, windows: Window[]): Range {
  let start = 0
  let end = w.limit
  for (const o of windows) {
    if (o === w || o.video_id !== w.video_id) continue
    if (o.end <= w.start + 0.01) start = Math.max(start, o.end)
    else if (o.start >= w.end - 0.01) end = Math.min(end, o.start)
  }
  return { start, end }
}

/** 원하는 길이만큼 창을 늘린다 — 클립 가운데 기준, bounds 안에서만 */
function growWindow(w: Window, want: number, bounds: Range): void {
  const need = want - (w.end - w.start)
  if (need <= 0) return
  const right = Math.min(need / 2, bounds.end - w.end)
  const left = Math.min(need - right, w.start - bounds.start)
  w.start -= left
  w.end += Math.min(need - left, bounds.end - w.end)
}

/**
 * 비트별 컷 범위 결정 (shorts-maker planBeat 방식).
 * 문장 낭독 길이에 맞춰 클립 가운데를 쓰고, 모자라면 같은 영상의 이어지는 장면까지 쓴다.
 * 전체 합은 목표 길이에 정확히 맞춘다 (렌더러가 모자란 길이를 마지막 프레임 정지로 채우기 때문).
 */
function planBeatSegments(
  beats: Beat[],
  library: BeatClip[],
  analyses: VideoAnalysis[],
  target: number
): EditPlanSegment[] {
  const byId = new Map(library.map((c) => [c.id, c]))
  const durationById = new Map(analyses.map((a) => [a.video_id, a.duration]))
  const want = beats.map((b) =>
    Math.max(MIN_BEAT_CUT_SEC, narrationPlainCharCount(b.text) / BEAT_CUT_CHARS_PER_SEC + BEAT_CUT_PAD_SEC)
  )
  const scale = target / want.reduce((s, d) => s + d, 0)
  const reserved = new Set(beats.map((b) => b.clipId))
  const windows: Window[] = beats.map((b) => {
    const clip = byId.get(b.clipId)!
    const mid = (clip.start + clip.end) / 2
    const span = contiguousSpan(clip, library, reserved)
    return { video_id: clip.video_id, start: mid, end: mid, span, limit: durationById.get(clip.video_id) ?? span.end }
  })
  // 1) 다른 비트가 고른 클립을 피해 이어지는 장면까지 → 2) 겹쳐도 라이브러리의 이어지는 장면
  // 화면이 멈춘 채 말하는 것보다 같은 장면이 한 번 더 나오는 편이 낫다. 그래도 짧은 비트는 재생 때 슬로모션으로 맞춘다
  const openSpans = beats.map((b) => contiguousSpan(byId.get(b.clipId)!, library, new Set()))
  windows.forEach((w, i) => growWindow(w, want[i]! * scale, w.span))
  windows.forEach((w, i) => growWindow(w, want[i]! * scale, openSpans[i]!))

  // 합이 목표보다 짧으면 여유 있는 비트들이 나눠 받는다. 원본 범위(라이브러리에서 뺀 얼굴 장면 포함 가능)는 최후 수단
  const total = () => windows.reduce((s, w) => s + (w.end - w.start), 0)
  const boundsOrder = [(w: Window) => w.span, (_: Window, i: number) => openSpans[i]!, (w: Window) => freeSourceRange(w, windows)]
  for (const boundsOf of boundsOrder) {
    for (let pass = 0; pass < 3 && target - total() > 0.01; pass++) {
      const deficit = target - total()
      const growable = windows.flatMap((w, i) => {
        const b = boundsOf(w, i)
        return w.start > b.start + 0.01 || w.end < b.end - 0.01 ? [{ w, b }] : []
      })
      if (!growable.length) break
      for (const { w, b } of growable) growWindow(w, w.end - w.start + deficit / growable.length, b)
    }
  }

  let cursor = 0
  return windows.map((w, i) => {
    const len = i === windows.length - 1 ? Math.max(0.3, ROUND(target - cursor)) : ROUND(w.end - w.start)
    const seg: EditPlanSegment = {
      video_id: w.video_id,
      source_start: ROUND(w.start),
      source_end: ROUND(w.start + len),
      output_start: ROUND(cursor),
      output_end: ROUND(cursor + len),
      reason: byId.get(beats[i]!.clipId)?.desc || "",
    }
    cursor += len
    return seg
  })
}

/**
 * shorts-maker 방식: 영상 분석 → 클립 라이브러리 → AI가 대본과 장면 배치를 한 번에 → 문장 길이로 컷 범위 결정.
 * 실패하면 null (호출부가 기존 자동 편집으로 대체).
 */
export async function buildBeatScriptEditPlan(args: {
  apiKey: string
  analyses: VideoAnalysis[]
  productAnalysis: ProductAnalysis
  sourceKeywords: string[]
  scriptTopic?: string
  targetDuration: AutoEditTargetDuration
}): Promise<{ editPlan: EditPlan; mixInfo: MixInfo; script: ShoppingScript } | null> {
  const library = buildClipLibrary(args.analyses)
  if (library.length < 2) return null

  const target = args.targetDuration
  const keywords = args.sourceKeywords.length ? args.sourceKeywords : args.productAnalysis.targetKeywords
  const prompt = beatPrompt({
    productName: primaryProductLabelFromKeywords(args.sourceKeywords, args.productAnalysis.productName),
    keywords,
    productAnalysis: args.productAnalysis,
    scriptTopic: args.scriptTopic,
    library,
    targetSec: target,
  })

  let user = prompt.user
  let best: Beat[] = []
  let headcopy: [string, string] = ["", ""]
  const lengthError = (beats: Beat[]) => Math.abs(scriptSec(beats) / target - 1)
  // 분량이 목표와 15% 넘게 다르면 필요한 글자 수를 알려 주고 한 번 더 쓰게 한다
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await openaiChatJson<{ beats?: unknown; headcopy?: unknown }>(args.apiKey, prompt.system, user, {
      temperature: 0.7,
    })
    const beats = sanitizeBeats(res.beats, library)
    if (beats.length >= 2 && (best.length < 2 || lengthError(beats) < lengthError(best))) {
      best = beats
      const hc = Array.isArray(res.headcopy) ? res.headcopy.map((s) => stripJamo(String(s ?? ""))) : []
      headcopy = [hc[0] ?? "", hc[1] ?? ""]
    }
    if (lengthError(beats) <= 0.15) break
    const sec = Math.round(scriptSec(beats))
    user += `\n\n[수정 요청] 방금 대본은 약 ${sec}초 분량으로 너무 ${sec < target ? "짧았다. 비트 수를 늘리고 정보를 더 넣어" : "길었다. 문장을 줄이거나 비트 수를 줄여"} 공백 제외 약 ${Math.round(target * BEAT_SCRIPT_CHARS_PER_SEC)}자(약 ${target}초)로 다시 써라.`
  }
  if (best.length < 2) return null

  const edit_plan = planBeatSegments(best, library, args.analyses, target)
  const videoIds = args.analyses.map((a) => a.video_id)
  const lines = edit_plan.map((s, i) => ({ start: s.output_start, end: s.output_end, text: best[i]!.text }))
  const fullScript = lines.map((l) => l.text).join("\n")
  return {
    editPlan: { target_duration: target, edit_plan },
    mixInfo: {
      sourceCount: videoIds.length,
      targetDuration: target,
      actualDuration: target,
      picks: edit_plan.map((s) => ({
        srcIndex: Math.max(0, videoIds.indexOf(s.video_id)),
        start: s.source_start,
        end: s.source_end,
        reason: s.reason,
      })),
    },
    script: {
      tone: BEAT_SCRIPT_TONE,
      script: lines.map((l, i) => ({ ...l, video_id: edit_plan[i]!.video_id })),
      // 스튜디오의 상단 고정 문구(headcopy)·전체 대본 표시용
      bundle: {
        scripts: { conversion: fullScript, storytelling: fullScript },
        headcopies: [headcopy],
        commentKeyword: "",
        sceneSubtitles: { conversion: lines, storytelling: lines },
      },
    },
  }
}

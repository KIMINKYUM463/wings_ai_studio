import fs from "fs/promises"
import os from "os"
import path from "path"
import { BEAT_SCRIPT_TONE, normalizeAutoEditTargetDuration } from "@/lib/shotform-auto-edit-types"
import type {
  AutoEditVideoInput,
  EditPlan,
  MixInfo,
  ProductAnalysis,
  ShoppingScript,
  VideoAnalysis,
} from "@/lib/shotform-auto-edit-types"
import type { VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import { synthesizeChosenLine, type RemixVoiceChoice } from "@/lib/shotform-remix-chosen-tts"
import { remixScriptTemplatePrompt } from "@/lib/shotform-remix-script-templates"
import { analysisFromKeywords } from "@/lib/wings-shopping-v2/from-remix"
import { describeClips, detectContentBox, detectTextBoxes, writeScript } from "@/lib/wings-shopping-v2/ai/gemini"
import {
  concatAudios,
  concatVideos,
  cutsToClips,
  detectScenes,
  extractFrame,
  FPS,
  probeDuration,
  renderPiece,
  runFfmpeg,
} from "@/lib/wings-shopping-v2/media/ffmpeg"
import type { ContentBox } from "@/lib/wings-shopping-v2/media/crop"
import { panDirection } from "@/lib/wings-shopping-v2/motion/ass"
import {
  masksForPiece,
  pieceFrameCounts,
  pieceOutputDuration,
  planBeat,
  type SegmentPiece,
} from "@/lib/wings-shopping-v2/sync"
import type { Clip } from "@/lib/wings-shopping-v2/types"

export type V2RemixPackage = {
  analyses: VideoAnalysis[]
  mixInfo: MixInfo
  productAnalysis: ProductAnalysis
  editPlan: EditPlan
  script: ShoppingScript
  voiceLineCues: VoiceLineCue[]
  narrationPath: string
  /** 모자이크가 입혀진 무음 9:16 영상. 목소리·자막·배경음은 기존 편집기가 올립니다. */
  renderedVideoPath: string
}

function spoken(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * 이미 쓴 시각 다음부터 문장 길이만큼만 자른다.
 * planBeat는 긴 클립의 가운데를 다시 집어 같은 화면이 반복되므로, 남은 길이가 문장보다 길면 앞에서부터 쓴다.
 */
function planForwardBeat(clip: Clip, later: Clip[], ttsDuration: number): SegmentPiece[] {
  const need = ttsDuration + 0.08
  const remain = clip.end - clip.start
  if (remain >= need) {
    return planBeat({ ...clip, end: clip.start + need }, [], ttsDuration)
  }
  return planBeat(clip, later, ttsDuration)
}

/** 소스마다 어디까지 썼는지 기억하고, 그 이전 장면으로는 돌아가지 않는다. */
function planFreshBeat(
  clips: Clip[],
  preferred: Clip,
  ttsDuration: number,
  cursor: Map<string, number>,
): SegmentPiece[] {
  const sources = [...new Set(clips.map((clip) => clip.sourceId))]
  const order = [preferred.sourceId, ...sources.filter((id) => id !== preferred.sourceId)]
  for (const sourceId of order) {
    const at = cursor.has(sourceId) ? cursor.get(sourceId)! : preferred.sourceId === sourceId ? preferred.start : 0
    const rows = clips
      .filter((clip) => clip.sourceId === sourceId && !clip.excluded && clip.end - Math.max(clip.start, at) >= 0.35)
      .sort((a, b) => a.start - b.start)
    const found = rows[0]
    if (!found) continue
    const head: Clip = { ...found, start: Math.max(found.start, at) }
    const later = clips
      .filter((clip) => clip.sourceId === sourceId && !clip.excluded && clip.id !== head.id && clip.start >= head.end - 1e-6)
      .sort((a, b) => a.start - b.start)
    const pieces = planForwardBeat(head, later, ttsDuration)
    for (const piece of pieces) {
      cursor.set(piece.sourceId, Math.max(cursor.get(piece.sourceId) ?? 0, piece.end))
    }
    return pieces
  }
  const last = clips.filter((clip) => !clip.excluded).sort((a, b) => a.end - b.end).at(-1) ?? preferred
  const tail = Math.max(last.start, last.end - 0.8)
  return planBeat({ ...last, start: tail }, [], ttsDuration)
}

function jobDir(jobId: string): string {
  return path.join(os.tmpdir(), "shotform-auto-edit", jobId)
}

function safeName(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "clip"
}

/**
 * 글자가 있는 칸을 장면 중간 화면 두 장으로 다시 찾습니다.
 * 영상 전체를 보고 짐작한 위치보다 모자이크가 정확합니다. 실패하면 기존 칸을 유지합니다.
 */
async function refineTextBoxes(clips: Clip[], sourcePaths: Record<string, string>, dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
  const images: { key: string; file: string }[] = []
  for (const clip of clips) {
    const file = sourcePaths[clip.sourceId]
    if (!file) continue
    const span = Math.max(0.05, clip.end - clip.start)
    for (const [suffix, ratio] of [["a", 0.3], ["b", 0.7]] as const) {
      const out = path.join(dir, `${safeName(clip.id)}_${suffix}.jpg`)
      const t = Math.min(Math.max(0, clip.end - 0.05), clip.start + span * ratio)
      try {
        await extractFrame(file, t, out, 720)
        images.push({ key: `${clip.id}_${suffix}`, file: out })
      } catch (e) {
        console.warn("[remix-v2] extractFrame", clip.id, e)
      }
    }
  }
  if (!images.length) return
  try {
    const found = await detectTextBoxes(images)
    for (const clip of clips) {
      const a = found[`${clip.id}_a`]
      const b = found[`${clip.id}_b`]
      if (a?.length || b?.length) clip.textBoxes = [...(a ?? []), ...(b ?? [])]
    }
  } catch (e) {
    console.warn("[remix-v2] detectTextBoxes", e)
  }
}

/** 제목 띠·앱 화면 안에 실제 영상이 있으면 그 영역만 남깁니다. 실패하면 화면 전체를 씁니다. */
async function findContentBox(file: string, duration: number, dir: string, sourceId: string): Promise<ContentBox | undefined> {
  try {
    const frames: string[] = []
    for (const ratio of [0.3, 0.7]) {
      const out = path.join(dir, `${safeName(sourceId)}_content_${ratio}.jpg`)
      await extractFrame(file, Math.max(0, duration * ratio), out, 540)
      frames.push(out)
    }
    return await detectContentBox(frames)
  } catch (e) {
    console.warn("[remix-v2] detectContentBox", sourceId, e)
    return undefined
  }
}

/**
 * 고른 원본으로 버전2와 같이 장면을 나누고, 대본과 Gemini 음성을 만든 뒤,
 * 글자 모자이크와 장면 길이를 영상에 입힙니다.
 * 자막과 배경음은 넣지 않습니다. 그 작업은 기존 편집기에서 합니다.
 */
export async function buildV2RemixPackage(args: {
  jobId: string
  videos: AutoEditVideoInput[]
  sourcePaths: Record<string, string>
  keywords: string[]
  scriptTemplateId?: string
  /** free면 Gemini 글자 찾기를 건너뛰고, 편집기 무료 OCR에 맡깁니다. */
  mosaicMode?: "paid" | "free"
  voice: RemixVoiceChoice
  onPhase?: (phase: "analyze" | "edit_plan" | "script" | "render") => void
}): Promise<V2RemixPackage> {
  const clips: Clip[] = []
  const analyses: VideoAnalysis[] = []
  const contentBoxes = new Map<string, ContentBox>()
  const root = jobDir(args.jobId)
  const frameDir = path.join(root, "v2-frames")

  args.onPhase?.("analyze")
  for (const [index, video] of args.videos.entries()) {
    const file = args.sourcePaths[video.video_id]
    if (!file) throw new Error(`${video.title || video.video_id} 원본 파일을 찾지 못했습니다.`)
    const duration = await probeDuration(file)
    const cuts = await detectScenes(file)
    const base = cutsToClips(cuts, duration, video.video_id)
    let described: Awaited<ReturnType<typeof describeClips>> = []
    try {
      described = await describeClips(file, base)
    } catch (e) {
      console.warn("[remix-v2] describeClips", video.video_id, e)
    }
    const byId = new Map(described.map((row) => [row.id, row]))
    const videoClips: Clip[] = base.map((clip) => {
      const row = byId.get(clip.id)
      return {
        ...clip,
        description: row?.description ?? "",
        shotType: row?.shotType ?? "",
        hasBurnedText: row?.hasBurnedText ?? false,
        quality: row?.quality ?? 3,
        textBoxes: row?.textBoxes ?? [],
      }
    })
    if (args.mosaicMode !== "free") await refineTextBoxes(videoClips, args.sourcePaths, frameDir)
    const content = await findContentBox(file, duration, frameDir, video.video_id)
    if (content) contentBoxes.set(video.video_id, content)
    clips.push(...videoClips)
    analyses.push({
      video_id: video.video_id,
      title: video.title || video.video_id,
      platform: video.platform || "",
      duration,
      source_url: video.videoUrl,
      src_index: index,
      product_fit: "approved",
      scenes: videoClips.map((clip) => ({
        start: clip.start,
        end: clip.end,
        description: clip.description || "장면",
        importance: clip.quality,
        visual_type: "demo",
        content_type: "product_in_use",
        shot_type: clip.shotType,
      })),
    })
  }
  if (!clips.length) throw new Error("나눌 장면이 없습니다.")

  args.onPhase?.("edit_plan")
  const analysis = analysisFromKeywords(args.keywords, args.videos[0]?.title)
  // 버전2와 같이 길이를 묻지 않는다. 원본이 길면 45초, 짧아도 20초를 기준으로 대본을 쓴다.
  const sourceSeconds = analyses.reduce((max, row) => Math.max(max, row.duration), 0)
  const targetSeconds = Math.min(45, Math.max(20, sourceSeconds || 30))
  const storedTarget = normalizeAutoEditTargetDuration(Math.round(targetSeconds / 5) * 5, 30)
  const script = await writeScript(
    analysis,
    clips,
    targetSeconds,
    remixScriptTemplatePrompt(args.scriptTemplateId),
  )
  if (!args.voice.voiceId.trim()) throw new Error("목소리를 골라 주세요.")
  const ttsDir = path.join(root, "v2-tts")
  await fs.mkdir(ttsDir, { recursive: true })

  args.onPhase?.("script")
  const ttsFiles: string[] = []
  const ttsDurations: number[] = []
  const cues: VoiceLineCue[] = []
  const segments: EditPlan["edit_plan"] = []
  const beatPieces: SegmentPiece[][] = []
  const footageCursor = new Map<string, number>()
  let outputAt = 0

  for (const [index, beat] of script.beats.entries()) {
    const text = spoken(beat.text)
    if (!text) continue
    const clip = clips.find((item) => item.id === beat.clipId) ?? clips[index % clips.length]!
    const made = await synthesizeChosenLine(args.voice, text, path.join(ttsDir, String(index)))
    const pieces = planFreshBeat(clips, clip, made.duration, footageCursor)
    const beatDur = pieces.reduce((sum, piece) => sum + pieceOutputDuration(piece), 0)
    const first = pieces[0]!
    segments.push({
      video_id: first.sourceId,
      source_start: Math.min(...pieces.map((piece) => piece.start)),
      source_end: Math.max(...pieces.map((piece) => piece.end)),
      output_start: outputAt,
      output_end: outputAt + beatDur,
      reason: clip.description || text,
      visual_caption: clip.description,
    })
    cues.push({
      text,
      startSec: outputAt,
      endSec: outputAt + made.duration,
      sceneIndex: cues.length,
      displayLines: beat.text.split("\n").map((line) => line.trim()).filter(Boolean),
      speed: args.voice.speed,
    })
    ttsFiles.push(made.file)
    ttsDurations.push(beatDur)
    beatPieces.push(pieces)
    outputAt += beatDur
  }
  if (!segments.length) throw new Error("대본을 만들지 못했습니다.")

  const narrationPath = path.join(root, "narration.wav")
  await fs.mkdir(root, { recursive: true })
  const m4a = path.join(ttsDir, "narration.m4a")
  await concatAudios(ttsFiles, ttsDurations, m4a)
  await runFfmpeg(["-y", "-i", m4a, "-ac", "1", "-ar", "44100", narrationPath])

  args.onPhase?.("render")
  const flat = beatPieces.flat()
  const frames = pieceFrameCounts(flat.map((piece) => pieceOutputDuration(piece)), FPS)
  const renderDir = path.join(root, "v2-pieces")
  await fs.mkdir(renderDir, { recursive: true })
  const pieceFiles: string[] = []
  for (const [k, piece] of flat.entries()) {
    const srcFile = args.sourcePaths[piece.sourceId]
    if (!srcFile) throw new Error("모자이크할 원본 영상을 찾지 못했습니다.")
    const piecePath = path.join(renderDir, `p${String(k).padStart(3, "0")}.mp4`)
    await renderPiece(
      srcFile,
      piece,
      piecePath,
      frames[k],
      args.mosaicMode === "free" ? [] : masksForPiece(clips, piece),
      undefined,
      contentBoxes.get(piece.sourceId),
      panDirection(k),
    )
    pieceFiles.push(piecePath)
  }
  const renderedVideoPath = path.join(root, "v2-picture.mp4")
  await concatVideos(pieceFiles, renderedVideoPath)

  const productAnalysis: ProductAnalysis = {
    productName: analysis.productName,
    category: analysis.category,
    targetKeywords: analysis.keywords,
    videoStructure: {
      hook: analysis.structure.hook,
      body: analysis.structure.body,
      cta: analysis.structure.cta,
    },
    summary: analysis.narrationTone,
    scenes: segments.map((segment) => ({
      start: segment.output_start,
      end: segment.output_end,
      description: segment.reason,
    })),
    videoDuration: outputAt,
  }
  const mixInfo: MixInfo = {
    sourceCount: args.videos.length,
    targetDuration: storedTarget,
    actualDuration: outputAt,
    picks: segments.map((segment) => ({
      srcIndex: Math.max(0, args.videos.findIndex((video) => video.video_id === segment.video_id)),
      start: segment.source_start,
      end: segment.source_end,
      reason: segment.reason,
    })),
  }
  const shopping: ShoppingScript = {
    tone: BEAT_SCRIPT_TONE,
    script: segments.map((segment, index) => ({
      start: segment.output_start,
      end: segment.output_end,
      text: cues[index]?.text ?? "",
      video_id: segment.video_id,
      scene_index: index,
    })),
    bundle: {
      scripts: { conversion: "", storytelling: cues.map((cue) => cue.text).join("\n") },
      headcopies: [[script.headcopy[0] ?? "", script.headcopy[1] ?? ""]],
      commentKeyword: "",
      sceneSubtitles: {
        conversion: [],
        storytelling: segments.map((segment, index) => ({
          start: segment.output_start,
          end: segment.output_end,
          text: cues[index]?.text ?? "",
        })),
      },
    },
  }

  return {
    analyses,
    mixInfo,
    productAnalysis,
    editPlan: { target_duration: storedTarget, edit_plan: segments, picture: "v2" },
    script: shopping,
    voiceLineCues: cues,
    narrationPath,
    renderedVideoPath,
  }
}

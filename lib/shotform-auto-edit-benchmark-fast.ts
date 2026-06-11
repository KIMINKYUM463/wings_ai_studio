import fs from "fs/promises"
import path from "path"
import type {
  AutoEditAnalysisMode,
  AutoEditTargetDuration,
  AutoEditVideoInput,
  MixInfo,
  MixPick,
  ProductAnalysis,
  SceneContentType,
  VideoAnalysis,
  VideoScene,
  VisualScene,
} from "@/lib/shotform-auto-edit-types"
import { AUTO_EDIT_ANALYSIS_MODE_DEFAULT } from "@/lib/shotform-auto-edit-types"
import {
  filterScenesForEdit,
  mergeVisionIntoScenes,
} from "@/lib/shotform-auto-edit-product-filter"
import { boostSceneImportance, compareScenesByEditorialPriority } from "@/lib/shotform-scene-priority"
import { extractVideoKeyframes, probeHasVideoStream, probeVideoDuration } from "@/lib/shotform-auto-edit-ffmpeg"
import {
  finalizeMixPicks,
  fillMixToTargetDuration,
  buildFallbackMix,
} from "@/lib/shotform-auto-edit-mix"
import {
  formatDescriptionWithShotBracket,
  inferShotType,
  normalizeBenchmarkVisualScenes,
} from "@/lib/shotform-visual-scene-match"
import type { ClientVideoMetaEntry } from "@/lib/shotform-client-video-meta"
import { visionClassifyFramesBatch } from "@/lib/shotform-auto-edit-vision"

const BENCHMARK_KEYFRAMES_PER_VIDEO = 4

async function writeDataUrlToJpeg(dataUrl: string, destPath: string): Promise<void> {
  const m = dataUrl.match(/^data:image\/\w+;base64,(.+)$/s)
  if (!m?.[1]) throw new Error("키프레임 data URL이 올바르지 않습니다.")
  await fs.writeFile(destPath, Buffer.from(m[1], "base64"))
}

/** 목표 길이별 키프레임 수 — 고속 모드: 짧은 쇼츠는 최소 프레임 */
function keyframesForFastTarget(targetDuration: AutoEditTargetDuration): number {
  if (targetDuration <= 30) return 1
  if (targetDuration <= 45) return 2
  return 3
}

/** 중간 모드 — 키프레임·Vision 품질 균형 */
function keyframesForBalancedTarget(targetDuration: AutoEditTargetDuration): number {
  if (targetDuration <= 30) return 3
  if (targetDuration <= 45) return 4
  return BENCHMARK_KEYFRAMES_PER_VIDEO
}

const VISION_FAST_TIMEOUT_MS = 18_000

type BenchmarkModeConfig = {
  keyframeCount: number
  visionOnly: boolean
  fastKeyframes: boolean
  visionTimeoutMs: number | null
  productFitReason: string
}

function resolveBenchmarkModeConfig(
  mode: AutoEditAnalysisMode,
  targetDuration: AutoEditTargetDuration
): BenchmarkModeConfig {
  if (mode === "balanced") {
    return {
      keyframeCount: keyframesForBalancedTarget(targetDuration),
      visionOnly: false,
      fastKeyframes: false,
      visionTimeoutMs: null,
      productFitReason: "중간 모드 분석",
    }
  }
  const visionOnly = useVisionOnlyFastPath(targetDuration)
  return {
    keyframeCount: keyframesForFastTarget(targetDuration),
    visionOnly,
    fastKeyframes: visionOnly,
    visionTimeoutMs: VISION_FAST_TIMEOUT_MS,
    productFitReason: "고속 Vision 분석",
  }
}

async function visionClassifyWithTimeout(
  apiKey: string,
  sources: Parameters<typeof visionClassifyFramesBatch>[1],
  timeoutMs: number | null
): Promise<Awaited<ReturnType<typeof visionClassifyFramesBatch>>> {
  if (!sources.length) return []
  if (timeoutMs == null) {
    try {
      return await visionClassifyFramesBatch(apiKey, sources)
    } catch {
      return []
    }
  }
  try {
    return await Promise.race([
      visionClassifyFramesBatch(apiKey, sources),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("vision timeout")), timeoutMs)
      }),
    ])
  } catch {
    return []
  }
}

/** 30초 이하 — Vision 캡션 + 로컬 mix만 (추가 OpenAI 분석 호출 생략) */
function useVisionOnlyFastPath(targetDuration: AutoEditTargetDuration): boolean {
  return targetDuration <= 30
}

type VisionFrameRow = { timeSec: number; content_type: SceneContentType; caption?: string }

async function openaiJson<T>(apiKey: string, system: string, user: string, maxTokens = 2800): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" as const },
      messages: [
        { role: "system" as const, content: system },
        { role: "user" as const, content: user },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
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

function normalizeEditScenes(raw: unknown, duration: number): VideoScene[] {
  if (!Array.isArray(raw)) return []
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
      importance: Math.min(10, Math.max(1, Math.round(Number(o.importance) || 8))),
      visual_type: (["product_showcase", "problem", "demo", "result", "cta", "other"].includes(
        String(o.visual_type)
      )
        ? String(o.visual_type)
        : "demo") as VideoScene["visual_type"],
      content_type: normalizeContentType(o.content_type) ?? "product_in_use",
    })
  }
  return out.length ? out.sort((a, b) => a.start - b.start) : []
}

function visionFramesToVisualScenes(
  frames: Array<{ timeSec: number; caption?: string }>,
  duration: number
): VisualScene[] {
  const captioned = frames.filter((f) => f.caption?.trim()).sort((a, b) => a.timeSec - b.timeSec)
  if (!captioned.length) return []
  return captioned.map((f, i) => {
    const prev = captioned[i - 1]
    const next = captioned[i + 1]
    const start = i === 0 ? 0 : Math.round(((prev!.timeSec + f.timeSec) / 2) * 10) / 10
    const end =
      i === captioned.length - 1
        ? Math.round(duration * 10) / 10
        : Math.round(((f.timeSec + next!.timeSec) / 2) * 10) / 10
    const desc = f.caption!.trim()
    return {
      start,
      end: Math.max(start + 0.2, end),
      description: formatDescriptionWithShotBracket(desc, inferShotType(desc)),
      shot_type: inferShotType(desc),
    }
  })
}

function benchmarkTimelineForAnalysis(a: VideoAnalysis): VisualScene[] {
  if (a.visual_scenes?.length) return a.visual_scenes
  return a.scenes.map((s) => ({
    start: s.start,
    end: s.end,
    description: s.description,
    shot_type: inferShotType(s.description),
  }))
}

export function benchmarkProductAnalysisFromAnalyses(analyses: VideoAnalysis[]): ProductAnalysis {
  const first = analyses[0]!
  const keywords = new Set<string>()
  for (const a of analyses) {
    for (const k of a.targetKeywords ?? []) keywords.add(k)
  }
  return {
    productName: first.productName || first.title || "쇼핑 제품",
    category: first.category || "쇼핑",
    targetKeywords: [...keywords],
    videoStructure: first.videoStructure ?? { hook: "", body: "", cta: "" },
    summary:
      analyses
        .map((a) => a.summary)
        .filter(Boolean)
        .join(" ") || first.title,
    scenes: benchmarkTimelineForAnalysis(first).map((s) => ({
      start: s.start,
      end: s.end,
      description: s.description,
    })),
    videoDuration: Math.max(...analyses.map((a) => a.duration)),
  }
}

type SourceProbe = {
  video: AutoEditVideoInput
  sourcePath: string
  duration: number
  keyframes: Array<{ path: string; timeSec: number }>
}

function durationFallbackScenes(duration: number, title: string): VideoScene[] {
  const segmentCount = Math.min(5, Math.max(3, Math.ceil(duration / 8)))
  const span = duration / segmentCount
  return Array.from({ length: segmentCount }, (_, i) => ({
    start: Math.round(i * span * 10) / 10,
    end: Math.round(Math.min(duration, (i + 1) * span) * 10) / 10,
    description: `[미디엄샷] ${title || "영상"} ${i + 1}구간`,
    importance: 7,
    visual_type: "demo" as const,
    content_type: "product_in_use" as const,
  })).filter((sc) => sc.end > sc.start + 0.15)
}

function buildAnalysesFromVision(
  probes: SourceProbe[],
  visionGrouped: Map<number, VisionFrameRow[]>,
  productFitReason = "고속 Vision 분석"
): VideoAnalysis[] {
  return probes.map((p, srcIndex) => {
    const visionFrames = visionGrouped.get(srcIndex) ?? []
    const visual_scenes = visionFramesToVisualScenes(visionFrames, p.duration)
    let scenes = filterScenesForEdit(
      visual_scenes.map((vs) => ({
        start: vs.start,
        end: vs.end,
        description: vs.description,
        importance: 7,
        visual_type: "demo" as const,
        content_type: "product_in_use" as const,
      })),
      visionFrames
    )
    if (!scenes.length) {
      scenes = filterScenesForEdit(durationFallbackScenes(p.duration, p.video.title || p.video.video_id))
    }
    scenes = boostSceneImportance(scenes).sort(compareScenesByEditorialPriority)
    return {
      video_id: p.video.video_id,
      title: p.video.title || p.video.video_id,
      platform: p.video.platform || "xiaohongshu",
      duration: p.duration,
      source_url: p.video.videoUrl,
      scenes,
      visual_scenes: visual_scenes.length ? visual_scenes : undefined,
      productName: p.video.title || "쇼핑 제품",
      category: "쇼핑",
      summary: p.video.title || "",
      videoStructure: {
        hook: "임팩트·선명함으로 시선 끌기",
        body: "설치·시연·사용·결과",
        cta: "완성·몰입·마무리",
      },
      product_fit: "approved" as const,
      product_fit_reason: productFitReason,
      vision_frames: visionFrames,
      src_index: srcIndex,
    }
  })
}

async function probeVideosForBenchmark(args: {
  videos: AutoEditVideoInput[]
  sourcePaths: Record<string, string>
  workDir: string
  keyframeCount: number
  fastKeyframes?: boolean
  clientVideoMeta?: Record<string, ClientVideoMetaEntry>
  lightProbe?: boolean
}): Promise<SourceProbe[]> {
  const { videos, sourcePaths, workDir, keyframeCount, fastKeyframes, clientVideoMeta, lightProbe } = args
  const probes = await Promise.all(
    videos.map(async (v) => {
      const client = clientVideoMeta?.[v.video_id]
      const kfDir = path.join(workDir, `fast_kf_${v.video_id}`)
      await fs.mkdir(kfDir, { recursive: true })

      if (client?.keyframeDataUrl && client.duration > 0) {
        const framePath = path.join(kfDir, "client_kf.jpg")
        try {
          await writeDataUrlToJpeg(client.keyframeDataUrl, framePath)
          return {
            video: v,
            sourcePath: sourcePaths[v.video_id] || "",
            duration: client.duration,
            keyframes: [{ path: framePath, timeSec: client.timeSec }],
          }
        } catch {
          /* 클라이언트 키프레임 실패 시 서버 추출로 폴백 */
        }
      }

      const sourcePath = sourcePaths[v.video_id]
      if (!sourcePath) return null

      let duration: number
      if (lightProbe) {
        duration = await probeVideoDuration(sourcePath, false)
      } else {
        const [dur, hasVideo] = await Promise.all([
          probeVideoDuration(sourcePath, true),
          probeHasVideoStream(sourcePath),
        ])
        if (!hasVideo) {
          throw new Error(`${v.title || v.video_id}: 영상 화면 스트림이 없습니다.`)
        }
        duration = dur
      }

      let keyframes: Array<{ path: string; timeSec: number }> = []
      try {
        keyframes = await extractVideoKeyframes(sourcePath, kfDir, duration, keyframeCount, {
          fast: fastKeyframes,
        })
      } catch {
        /* 프레임 추출 실패 시 제목·길이만으로 분석 계속 */
      }
      return { video: v, sourcePath, duration, keyframes }
    })
  )
  return probes.filter((p): p is SourceProbe => p != null)
}

/** 벤치마킹 프로그램 방식 — Vision 1회 + (짧은 쇼츠는 로컬 mix) */
export async function benchmarkFastAnalyzeAndMix(args: {
  apiKey: string
  videos: AutoEditVideoInput[]
  sourcePaths: Record<string, string>
  workDir: string
  targetDuration: AutoEditTargetDuration
  analysisMode?: AutoEditAnalysisMode
  clientVideoMeta?: Record<string, ClientVideoMetaEntry>
  onPhase?: (phase: "keyframes" | "vision" | "mix") => void
}): Promise<{ analyses: VideoAnalysis[]; mixInfo: MixInfo }> {
  const { apiKey, videos, sourcePaths, workDir, targetDuration, onPhase, clientVideoMeta } = args
  const mode = args.analysisMode ?? AUTO_EDIT_ANALYSIS_MODE_DEFAULT
  const modeConfig = resolveBenchmarkModeConfig(mode, targetDuration)
  const { keyframeCount, visionOnly, fastKeyframes, visionTimeoutMs, productFitReason } = modeConfig
  const allClientKeyframes =
    clientVideoMeta &&
    videos.length > 0 &&
    videos.every((v) => clientVideoMeta[v.video_id]?.keyframeDataUrl)

  onPhase?.("keyframes")
  const probes = await probeVideosForBenchmark({
    videos,
    sourcePaths,
    workDir,
    keyframeCount,
    fastKeyframes,
    clientVideoMeta,
    lightProbe: mode === "fast" || Boolean(allClientKeyframes),
  })
  if (!probes.length) throw new Error("분석할 영상이 없습니다.")

  const visionSources = probes
    .map((p, srcIndex) => ({
      srcIndex,
      title: p.video.title || p.video.video_id,
      frames: p.keyframes,
    }))
    .filter((s) => s.frames.length > 0)

  onPhase?.("vision")
  const visionBySrc = visionSources.length
    ? visionOnly || visionTimeoutMs != null
      ? await visionClassifyWithTimeout(apiKey, visionSources, visionTimeoutMs)
      : await visionClassifyFramesBatch(apiKey, visionSources)
    : []

  const visionGrouped = new Map<number, VisionFrameRow[]>()
  for (const row of visionBySrc) {
    const list = visionGrouped.get(row.srcIndex) ?? []
    list.push({
      timeSec: row.timeSec,
      content_type: row.content_type,
      caption: row.caption,
    })
    visionGrouped.set(row.srcIndex, list)
  }

  if (visionOnly) {
    onPhase?.("mix")
    const analyses = buildAnalysesFromVision(probes, visionGrouped, productFitReason)
    const mixInfo = fillMixToTargetDuration(
      buildFallbackMix(analyses, targetDuration),
      analyses,
      targetDuration
    )
    return { analyses, mixInfo }
  }

  const visionHint = probes.map((p, srcIndex) => ({
    srcIndex,
    title: p.video.title,
    duration: p.duration,
    frames: (visionGrouped.get(srcIndex) ?? []).map((f) => ({
      timeSec: f.timeSec,
      content_type: f.content_type,
      caption: f.caption?.slice(0, 80),
    })),
  }))

  let analyses: VideoAnalysis[] = []
  let mixInfo: MixInfo | null = null

  try {
    onPhase?.("mix")
    const parsed = await openaiJson<{
      productName?: string
      category?: string
      targetKeywords?: unknown
      videoStructure?: { hook?: string; body?: string; cta?: string }
      summary?: string
      sources?: unknown
      picks?: unknown
    }>(
      apiKey,
      `쇼핑 숏폼 분석+편집 PD (벤치마킹 프로그램). JSON만 출력. **한 번에** 장면 분석과 mix picks를 반환.

productName, category, targetKeywords[](한국어), videoStructure{hook,body,cta}, summary(한국어),

sources[] — 소스별 (srcIndex 0부터):
  scenes[{start,end,description}] — **의미 장면 3~10개** (촘촘한 키프레임 나열 금지). description은 [클로즈업]/[와이드샷] 등으로 시작.
  edit_scenes[{start,end,description,importance,visual_type,content_type}] — 편집용 장면 (인물·제품·시연 모두 포함)

picks[] — mixInfo:
  srcIndex, start, end(소스 초), reason(한국어)
  목표 **${targetDuration}~${targetDuration + 5}초** 합계, pick당 2~3.5초, 약 8~12개
  인물·제품·시연·결과 화면 모두 사용 가능, 후킹→기능→마무리 흐름
  ${probes.length > 1 ? "여러 소스 — srcIndex 번갈아 사용" : ""}`,
      `목표 길이: ${targetDuration}초

Vision 키프레임 (실제 화면):
${JSON.stringify(visionHint, null, 0)}

JSON: {"productName":"","category":"","targetKeywords":[],"videoStructure":{"hook":"","body":"","cta":""},"summary":"","sources":[{"srcIndex":0,"scenes":[],"edit_scenes":[]}],"picks":[{"srcIndex":0,"start":0,"end":2.5,"reason":""}]}`
    )

    const sharedProduct = {
      productName: String(parsed.productName || probes[0]!.video.title || "쇼핑 제품"),
      category: String(parsed.category || "쇼핑"),
      targetKeywords: Array.isArray(parsed.targetKeywords)
        ? parsed.targetKeywords.map((k) => String(k).trim()).filter(Boolean)
        : [],
      videoStructure: parsed.videoStructure
        ? {
            hook: String(parsed.videoStructure.hook || ""),
            body: String(parsed.videoStructure.body || ""),
            cta: String(parsed.videoStructure.cta || ""),
          }
        : undefined,
      summary: String(parsed.summary || ""),
    }

    const sourceRows = Array.isArray(parsed.sources) ? parsed.sources : []
    analyses = probes.map((p, srcIndex) => {
      const row = sourceRows.find(
        (r) => Number((r as Record<string, unknown>)?.srcIndex) === srcIndex
      ) as Record<string, unknown> | undefined
      const visionFrames = visionGrouped.get(srcIndex) ?? []
      const visual_scenes = row?.scenes
        ? normalizeBenchmarkVisualScenes(row.scenes, p.duration)
        : visionFramesToVisualScenes(visionFrames, p.duration)

      let scenes = normalizeEditScenes(row?.edit_scenes ?? row?.scenes, p.duration)
      if (visionFrames.length) {
        scenes = mergeVisionIntoScenes(scenes, visionFrames, p.duration)
      }
      scenes = filterScenesForEdit(scenes, visionFrames)
      if (!scenes.length && visual_scenes.length) {
        scenes = filterScenesForEdit(
          visual_scenes.map((vs) => ({
            start: vs.start,
            end: vs.end,
            description: vs.description,
            importance: 7,
            visual_type: "demo" as const,
            content_type: "product_in_use" as const,
          }))
        )
      }
      scenes = boostSceneImportance(scenes).sort(compareScenesByEditorialPriority)

      return {
        video_id: p.video.video_id,
        title: p.video.title || p.video.video_id,
        platform: p.video.platform || "xiaohongshu",
        duration: p.duration,
        source_url: p.video.videoUrl,
        scenes,
        visual_scenes: visual_scenes.length ? visual_scenes : undefined,
        productName: sharedProduct.productName,
        category: sharedProduct.category,
        targetKeywords: sharedProduct.targetKeywords,
        videoStructure: sharedProduct.videoStructure,
        summary: sharedProduct.summary,
        product_fit: "approved" as const,
        product_fit_reason: productFitReason,
        vision_frames: visionFrames,
        src_index: srcIndex,
      }
    })

    const rawPicks: MixPick[] = []
    if (Array.isArray(parsed.picks)) {
      for (const row of parsed.picks) {
        if (!row || typeof row !== "object") continue
        const o = row as Record<string, unknown>
        const srcIndex = Number(o.srcIndex)
        const start = Number(o.start)
        const end = Number(o.end)
        const reason = String(o.reason || "").trim()
        if (!Number.isFinite(srcIndex) || !Number.isFinite(start) || !Number.isFinite(end)) continue
        if (end <= start) continue
        rawPicks.push({
          srcIndex: Math.floor(srcIndex),
          start,
          end,
          reason: reason || "제품 장면",
        })
      }
    }

    if (rawPicks.length >= 2) {
      mixInfo = finalizeMixPicks(rawPicks, analyses, targetDuration)
      mixInfo = fillMixToTargetDuration(mixInfo, analyses, targetDuration)
    }
  } catch {
    /* fallback below */
  }

  if (!analyses.length) {
    analyses = buildAnalysesFromVision(probes, visionGrouped, productFitReason)
  }

  if (!mixInfo || mixInfo.picks.length < 2) {
    mixInfo = fillMixToTargetDuration(buildFallbackMix(analyses, targetDuration), analyses, targetDuration)
  }

  return { analyses, mixInfo }
}

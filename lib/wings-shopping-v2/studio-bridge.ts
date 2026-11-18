import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  BEAT_SCRIPT_TONE,
  normalizeAutoEditTargetDuration,
  type AutoEditJobResult,
  type EditPlanSegment,
  type MixInfo,
  type ProductAnalysis,
  type ShoppingScript,
  type VideoAnalysis,
} from '@/lib/shotform-auto-edit-types'
import { autoEditDownloadUrl } from '@/lib/shotform-auto-edit-download'
import { validateRenderedMp4 } from '@/lib/shotform-auto-edit-ffmpeg'
import { uploadAutoEditOutputToSupabase } from '@/lib/shotform-auto-edit-job-store'
import { putAutoEditJob } from '@/lib/shotform-auto-edit-jobs'
import { withTimeout } from '@/lib/shotform-auto-edit-script-step'
import type { VoiceLineCue } from '@/lib/shotform-factory-line-tts'
import { removeChineseSubtitlesFromLocalFile } from '@/lib/shotform-vmake-client'
import { VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS } from '@/lib/shotform-vmake-subtitle-removal'
import { ttsProviderFromVoiceId } from '@/lib/shotform-tts-providers'
import {
  FPS,
  concatAudios,
  concatVideos,
  renderPiece,
  runFfmpeg,
} from './media/ffmpeg'
import { panDirection } from './motion/ass'
import { runJob, ttsHash } from './pipeline'
import { getProject, projectDir, updateProject } from './store'
import { splitLines } from './subtitles'
import {
  PAD,
  continuationClips,
  masksForPiece,
  pieceFrameCounts,
  pieceOutputDuration,
  planBeat,
  type SegmentPiece,
} from './sync'
import type { Beat, Clip } from './types'

const rel = (id: string, ...parts: string[]) => path.join(projectDir(id), ...parts)
const exists = (f: string) => fs.access(f).then(() => true, () => false)

function spokenText(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

function expectedBeatTtsHash(
  beat: Beat,
  voice: { voiceId: string; speed: number },
  customVoice?: { voiceId: string; style: string; speed: number },
): string {
  if (customVoice?.voiceId && ttsProviderFromVoiceId(customVoice.voiceId)) {
    return ttsHash(beat.text, `${customVoice.voiceId}:${customVoice.style}`, customVoice.speed)
  }
  return ttsHash(beat.text, voice.voiceId, voice.speed)
}

function resolveVmakeCredentials(opts?: StudioRenderOptions): { apiKey: string; secretAccessKey: string } {
  const apiKey = (
    opts?.vmakeApiKey?.trim() ||
    process.env.shotform_vmake_api_key ||
    process.env.VMAKE_API_KEY ||
    ''
  ).trim()
  const secretAccessKey = (
    opts?.vmakeSecretAccessKey?.trim() ||
    process.env.shotform_vmake_secret_access_key ||
    process.env.VMAKE_SECRET_ACCESS_KEY ||
    ''
  ).trim()
  return { apiKey, secretAccessKey }
}

export type StudioRenderOptions = {
  vmakeApiKey?: string
  vmakeSecretAccessKey?: string
}

/**
 * 버전2의 문장·장면·음성 구성을 그대로 렌더링한 뒤,
 * 자막·배경음·효과음 편집을 위해 기존 편집기(MvpPostEditStudio)용 무음 9:16 MP4와 별도 나레이션 WAV를 생성합니다.
 * - mosaicMode === 'v2': Gemini가 찾은 글자·로고 영역을 버전2 픽셀 모자이크로 입힘
 * - mosaicMode === 'vmake': 픽셀 모자이크 없이 이어 붙인 뒤 Vmake AI로 중국어 하드 자막 제거
 */
export function runStudioRender(id: string, opts?: StudioRenderOptions): Promise<void> {
  return runJob(id, 'render', async (progress) => {
    const p = await getProject(id)
    const beats = p.script?.beats ?? []
    if (!beats.length) throw new Error('대본이 없습니다. 먼저 대본을 만들어 주세요.')

    // 스튜디오 경로는 STTN 을 아직 지원하지 않아 무료 자막 지우기를 고른 프로젝트는 모자이크로 처리한다
    const mosaicMode: 'v2' | 'vmake' = p.mosaicMode === 'vmake' ? 'vmake' : p.mosaicMode ? 'v2' : (p.mosaic === false ? 'vmake' : 'v2')
    const vmakeCreds = resolveVmakeCredentials(opts)
    if (mosaicMode === 'vmake' && (!vmakeCreds.apiKey || !vmakeCreds.secretAccessKey)) {
      throw new Error(
        'Vmake 유료 자막 제거를 쓰려면 ShotForm 홈 API 설정에서 Vmake AI API Key와 Secret Access Key를 입력해 주세요. (또는 「유료 · 버전2 모자이크」를 선택하세요.)',
      )
    }

    const clipsById = new Map(p.clips.map((c) => [c.id, c]))
    const sourcesById = new Map(p.sources.map((s) => [s.id, s]))

    for (const [i, b] of beats.entries()) {
      if (!b.clipId || !clipsById.has(b.clipId)) {
        throw new Error(`${i + 1}번 문장에 장면이 없습니다. 장면을 골라 주세요.`)
      }
      const expectedHash = expectedBeatTtsHash(b, p.voice, p.customVoice)
      if (!b.tts || b.tts.textHash !== expectedHash || !(await exists(rel(id, b.tts.file)))) {
        throw new Error(`${i + 1}번 문장의 음성을 먼저 생성해 주세요.`)
      }
    }

    const work = rel(id, 'studio-render')
    await fs.rm(work, { recursive: true, force: true })
    await fs.mkdir(work, { recursive: true })

    // 같은 클립 ID가 두 번 이상 쓰인 경우에만 앞부분부터 차례로 진행해 동일 프레임 반복을 막고,
    // 한 번만 쓰인 클립은 버전2 원본 planBeat와 100% 동일하게 동작한다.
    const clipTotalUses = new Map<string, number>()
    for (const b of beats) {
      if (b.clipId) clipTotalUses.set(b.clipId, (clipTotalUses.get(b.clipId) ?? 0) + 1)
    }
    const repeatedClipCursor = new Map<string, number>()

    const plan: { piece: SegmentPiece; srcFile: string; out: string }[] = []
    const durations: number[] = []
    const starts: number[] = []
    const segments: EditPlanSegment[] = []
    const voiceLineCues: VoiceLineCue[] = []
    const activeSpeed = p.customVoice?.speed ?? p.voice.speed
    let offset = 0

    for (const [i, b] of beats.entries()) {
      starts.push(offset)
      const baseClip = clipsById.get(b.clipId!)!
      const src = sourcesById.get(baseClip.sourceId)
      if (!src?.file) throw new Error(`${i + 1}번 문장의 소스 영상 파일이 없습니다.`)

      let targetClip: Clip = baseClip
      if ((clipTotalUses.get(baseClip.id) ?? 0) > 1) {
        const cursor = repeatedClipCursor.get(baseClip.id) ?? baseClip.start
        const need = b.tts!.duration + PAD
        if (baseClip.end - cursor >= 0.4) {
          const sliceEnd = baseClip.end - cursor >= need ? cursor + need : baseClip.end
          targetClip = { ...baseClip, start: cursor, end: sliceEnd }
        }
      }

      const nextSameSource = continuationClips(p.clips, targetClip)
      const beatPieces = planBeat(targetClip, nextSameSource, b.tts!.duration)
      if ((clipTotalUses.get(baseClip.id) ?? 0) > 1) {
        const lastInSameClip = beatPieces
          .filter((piece) => piece.sourceId === baseClip.sourceId)
          .reduce((m, piece) => Math.max(m, piece.end), targetClip.start)
        repeatedClipCursor.set(baseClip.id, lastInSameClip)
      }

      for (const [j, piece] of beatPieces.entries()) {
        const pieceSrc = sourcesById.get(piece.sourceId)
        if (!pieceSrc?.file) throw new Error(`${i + 1}번 문장의 이어붙일 소스 영상 파일이 없습니다.`)
        plan.push({
          piece,
          srcFile: rel(id, pieceSrc.file),
          out: path.join(work, `b${String(i).padStart(3, '0')}_${j}.mp4`),
        })
      }

      const d = b.tts!.duration + PAD
      durations.push(d)
      const text = spokenText(b.text)
      segments.push({
        video_id: baseClip.sourceId,
        source_start: Math.min(...beatPieces.map((piece) => piece.start)),
        source_end: Math.max(...beatPieces.map((piece) => piece.end)),
        output_start: offset,
        output_end: offset + d,
        reason: baseClip.description || text,
        visual_caption: baseClip.description,
      })
      voiceLineCues.push({
        text,
        startSec: offset,
        endSec: offset + b.tts!.duration,
        sceneIndex: i,
        displayLines: splitLines(b.text),
        speed: activeSpeed,
      })
      offset += d
    }

    const frames = pieceFrameCounts(plan.map((x) => pieceOutputDuration(x.piece)), FPS)
    const pieceFiles: string[] = []
    for (const [k, x] of plan.entries()) {
      await progress(`장면 편집 중... (${k + 1}/${plan.length})`, (k / plan.length) * 0.65)
      await renderPiece(
        x.srcFile,
        x.piece,
        x.out,
        frames[k],
        mosaicMode === 'v2' ? masksForPiece(p.clips, x.piece) : [],
        undefined,
        sourcesById.get(x.piece.sourceId)?.contentBox,
        panDirection(k),
      )
      pieceFiles.push(x.out)
    }

    await progress('장면 영상을 하나로 잇는 중...', 0.7)
    let finalVideoPath = path.join(work, 'video.mp4')
    await concatVideos(pieceFiles, finalVideoPath)

    if (mosaicMode === 'vmake') {
      await progress('Vmake AI로 중국어 자막을 제거하는 중... (1~3분 소요)', 0.76)
      const cleanedPath = path.join(work, 'video_vmake_clean.mp4')
      await withTimeout(
        removeChineseSubtitlesFromLocalFile({
          apiKey: vmakeCreds.apiKey,
          secretAccessKey: vmakeCreds.secretAccessKey,
          sourcePath: finalVideoPath,
          outputPath: cleanedPath,
        }),
        VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS,
        'Vmake 자막 제거 시간이 초과되었습니다(약 12분). 잠시 후 다시 시도하거나 버전2 모자이크를 선택해 주세요.',
      )
      finalVideoPath = cleanedPath
    }

    await progress('음성 트랙과 편집기 타임라인을 준비하는 중...', 0.9)
    const jobId = randomUUID()
    const autoEditDir = path.join(os.tmpdir(), 'shotform-auto-edit', jobId)
    await fs.mkdir(autoEditDir, { recursive: true })

    const m4aPath = path.join(work, 'narration.m4a')
    await concatAudios(
      beats.map((b) => rel(id, b.tts!.file)),
      durations,
      m4aPath,
    )
    const narrationWavPath = path.join(autoEditDir, 'narration.wav')
    await runFfmpeg(['-y', '-i', m4aPath, '-ac', '1', '-ar', '44100', narrationWavPath])

    const outputPath = path.join(autoEditDir, 'output.mp4')
    const studioRelFile = 'studio-output.mp4'
    const studioProjectVideoPath = rel(id, studioRelFile)
    await fs.copyFile(finalVideoPath, outputPath)
    await fs.copyFile(finalVideoPath, studioProjectVideoPath)

    const outputDuration = await validateRenderedMp4(outputPath, 1)
    let outputStoragePath: string | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      outputStoragePath = await uploadAutoEditOutputToSupabase(jobId, outputPath)
      if (outputStoragePath) break
    }

    const readySources = p.sources.filter((s) => s.status === 'ready')
    const analyses: VideoAnalysis[] = readySources.map((s, index) => {
      const sourceClips = p.clips.filter((c) => c.sourceId === s.id)
      return {
        video_id: s.id,
        title: s.title || s.id,
        platform: s.platform || '',
        duration: s.duration ?? 0,
        source_url: s.directUrl || s.url || '',
        src_index: index,
        product_fit: 'approved',
        scenes: sourceClips.map((clip) => ({
          start: clip.start,
          end: clip.end,
          description: clip.description || '장면',
          importance: clip.quality,
          visual_type: 'demo',
          content_type: 'product_in_use',
          shot_type: clip.shotType,
        })),
      }
    })

    const analysis = p.analysis ?? {
      productName: p.name || '쇼핑 제품',
      category: '쇼핑',
      keywords: [p.name || '쇼핑 제품'],
      structure: { hook: '', body: '', cta: '' },
      narrationTone: '',
    }
    const storedTarget = normalizeAutoEditTargetDuration(Math.round(offset / 5) * 5, 30)

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
      scenes: segments.map((seg) => ({
        start: seg.output_start,
        end: seg.output_end,
        description: seg.reason,
      })),
      videoDuration: offset,
    }

    const mixInfo: MixInfo = {
      sourceCount: Math.max(1, readySources.length),
      targetDuration: storedTarget,
      actualDuration: offset,
      picks: segments.map((seg) => ({
        srcIndex: Math.max(0, readySources.findIndex((s) => s.id === seg.video_id)),
        start: seg.source_start,
        end: seg.source_end,
        reason: seg.reason,
      })),
    }

    const headcopy: [string, string] = [
      p.script?.headcopy?.[0] ?? '',
      p.script?.headcopy?.[1] ?? '',
    ]
    const shoppingScript: ShoppingScript = {
      tone: BEAT_SCRIPT_TONE,
      script: segments.map((seg, index) => ({
        start: seg.output_start,
        end: seg.output_end,
        text: voiceLineCues[index]?.text ?? '',
        video_id: seg.video_id,
        scene_index: index,
      })),
      bundle: {
        scripts: {
          conversion: '',
          storytelling: voiceLineCues.map((cue) => cue.text).join('\n'),
        },
        headcopies: [headcopy],
        commentKeyword: p.script?.comment ?? '',
        sceneSubtitles: {
          conversion: [],
          storytelling: segments.map((seg, index) => ({
            start: seg.output_start,
            end: seg.output_end,
            text: voiceLineCues[index]?.text ?? '',
          })),
        },
      },
    }

    const createdAt = Date.now()
    const downloadUrl = autoEditDownloadUrl(jobId)
    const studioResult: AutoEditJobResult = {
      jobId,
      step: 'done',
      sourceKeywords: analysis.keywords?.length ? analysis.keywords : undefined,
      renderMode: 'server',
      analyses,
      analysis: analyses[0],
      productAnalysis,
      mixInfo,
      editPlan: {
        target_duration: storedTarget,
        edit_plan: segments,
        picture: 'v2',
      },
      script: shoppingScript,
      voiceLineCues,
      v2Picture: true,
      mosaicMode,
      ttsVoiceId: p.customVoice?.voiceId || undefined,
      ttsVoiceStyle: p.customVoice?.style || undefined,
      downloadUrl,
      outputDuration,
      videoCount: analyses.length,
    }

    putAutoEditJob({
      ...studioResult,
      outputPath,
      outputStoragePath,
      createdAt,
    })

    await updateProject(id, (x) => {
      x.studioResult = studioResult
      x.studioVideoAt = createdAt
    })
  })
}

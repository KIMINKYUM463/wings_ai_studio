import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import type { VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import type { LineSubtitleCue } from "@/lib/shotform-mvp-edit-script"
import { voicePreviewBgmSrc } from "@/lib/shotform-factory-voice-preview-bgm"
import type { MvpBgmClip } from "@/lib/mvp-studio-types"
import {
  buildCapCutExportZip,
  buildFactorySrt,
  capcutDirectoryPickerSupported,
  downloadBlob,
  fetchBlobForCapCut,
  formatSrtTimestamp,
  resolveCapCutFetchUrl,
  writeCapCutExportToDirectory,
  type FactoryCapCutExportInput,
} from "@/lib/shotform-factory-capcut-export"

export type MvpCapCutExportArgs = {
  result: AutoEditJobResult
  videoBlob: Blob | null
  videoUrl: string | null
  audioUrl: string | null
  ttsFallbackBlob: Blob | null
  voiceLineCues: VoiceLineCue[] | null
  sceneText: (sceneIndex0: number) => string
  voiceId: string
  voiceStyle: string
  videoDurationSec: number
  audioDurationSec: number
  projectLabel?: string
  seo?: FactoryCapCutExportInput["seo"]
  bgmClips?: MvpBgmClip[]
}

export function buildMvpCapCutExportInput(args: MvpCapCutExportArgs): FactoryCapCutExportInput {
  const previewSrc = args.videoUrl || args.result.downloadUrl || ""
  return {
    sceneText: args.sceneText,
    voiceLineCues: args.voiceLineCues,
    previewVideoBlob: args.videoBlob,
    previewVideoSrc: previewSrc || undefined,
    ttsCandidateUrls: [args.audioUrl].filter(Boolean) as string[],
    ttsAudioUrl: args.audioUrl,
    ttsFallbackBlob: args.ttsFallbackBlob,
    capCutSyncVideoDurationSec: args.videoDurationSec > 0.1 ? args.videoDurationSec : undefined,
    capCutSyncAudioDurationSec: args.audioDurationSec > 0.1 ? args.audioDurationSec : undefined,
    voiceId: args.voiceId,
    voiceStyle: args.voiceStyle,
    bgmPublicSrc: (() => {
      const factory = args.bgmClips?.find((c) => c.catalogId.startsWith("bgm-"))
      if (!factory) return null
      const id = factory.catalogId.replace(/^bgm-/, "")
      return voicePreviewBgmSrc(id)
    })(),
    seo: args.seo,
    projectLabel:
      args.projectLabel ||
      args.result.productAnalysis?.productName ||
      args.result.analyses?.[0]?.title?.slice(0, 24) ||
      "MVP",
  }
}

export async function fetchMvpVideoBlob(videoUrl: string | null, downloadUrl?: string | null): Promise<Blob | null> {
  for (const raw of [videoUrl, downloadUrl]) {
    if (!raw?.trim()) continue
    try {
      const href = resolveCapCutFetchUrl(raw)
      const b = await fetchBlobForCapCut(href)
      if (b.size > 4096) return b
    } catch {
      /* try next */
    }
  }
  return null
}

const MIN_TTS_BLOB_BYTES = 256

export async function fetchMvpTtsBlob(
  audioUrl: string | null,
  ttsFallbackBlob: Blob | null
): Promise<{ blob: Blob; ext: "wav" | "mp3" } | null> {
  if (ttsFallbackBlob && ttsFallbackBlob.size >= MIN_TTS_BLOB_BYTES) {
    return {
      blob: ttsFallbackBlob,
      ext: ttsFallbackBlob.type.includes("wav") ? "wav" : "mp3",
    }
  }
  if (!audioUrl?.trim()) return null
  try {
    const b = await fetchBlobForCapCut(resolveCapCutFetchUrl(audioUrl))
    if (!b || b.size < MIN_TTS_BLOB_BYTES) return null
    return { blob: b, ext: b.type.includes("wav") ? "wav" : "mp3" }
  } catch {
    return null
  }
}

/** 미리보기와 동일 — TTS 큐 우선, 없으면 영상 타임라인 자막 스케줄 */
export function buildMvpSubtitleSrt(opts: {
  voiceLineCues: VoiceLineCue[] | null
  lineSchedule: readonly LineSubtitleCue[]
  sceneText: (sceneIndex0: number) => string
  hasAudio: boolean
}): string {
  if (opts.voiceLineCues?.length && opts.hasAudio) {
    return buildFactorySrt(opts.voiceLineCues, opts.sceneText)
  }
  const cues = opts.lineSchedule.filter((c) => c.text.trim())
  if (cues.length) {
    return cues
      .map(
        (c, i) =>
          `${i + 1}\n${formatSrtTimestamp(c.start)} --> ${formatSrtTimestamp(c.end)}\n${c.text.replace(/\r/g, "")}\n`
      )
      .join("\n")
  }
  return buildFactorySrt(null, opts.sceneText)
}

export async function exportMvpCapCutProject(
  input: FactoryCapCutExportInput,
  opts?: { zipOnly?: boolean }
): Promise<{ mode: "folder"; folderName: string } | { mode: "zip"; filename: string }> {
  const tryFolder =
    !opts?.zipOnly &&
    capcutDirectoryPickerSupported() &&
    typeof window !== "undefined" &&
    "showDirectoryPicker" in window

  if (tryFolder) {
    try {
      const dir = await (
        window as Window & {
          showDirectoryPicker: (opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>
        }
      ).showDirectoryPicker({ mode: "readwrite" })
      const folderName = await writeCapCutExportToDirectory(dir, input)
      return { mode: "folder", folderName }
    } catch {
      /* ZIP fallback */
    }
  }

  const blob = await buildCapCutExportZip(input)
  const filename = `mvp_capcut_${Date.now()}.zip`
  downloadBlob(blob, filename)
  return { mode: "zip", filename }
}

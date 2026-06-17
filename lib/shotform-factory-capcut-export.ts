import JSZip from "jszip"
import { FACTORY_NARRATION_SEGMENTS, narrationScriptPlainText } from "@/lib/shotform-factory-narration-script"
import { trimAudioBlobToMaxDuration, type VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import {
  buildCapCutNativeDraftBundle,
  buildRootMetaDraftEntry,
  buildRootMetaInfoJson,
  defaultShotFormDraftFolderName,
  getBlobMediaDurationSec,
  getUrlMediaDurationSec,
  readDraftRootPathFromHandle,
  readRootMetaStore,
  secondsToCapCutUs,
  voiceLineCuesToCapCutSubtitles,
  type CapCutSubtitleCue,
} from "@/lib/capcut-draft-builder"

const MIN_TTS_BLOB_BYTES = 256
const MIN_BGM_BLOB_BYTES = 512
/** MP4가 아닌 HTML 에러 페이지 등 제외 */
const MIN_VIDEO_BLOB_BYTES = 4096

export function resolveCapCutFetchUrl(url: string): string {
  const t = url.trim()
  if (!t) return t
  if (t.startsWith("blob:") || t.startsWith("data:") || t.startsWith("http://") || t.startsWith("https://")) {
    return t
  }
  if (typeof window === "undefined") return t
  try {
    return new URL(t, window.location.origin).href
  } catch {
    return t
  }
}

export type FactoryCapCutExportInput = {
  sceneText: (sceneIndex0: number) => string
  voiceLineCues: VoiceLineCue[] | null
  /** URL fetch 실패 시 붙일 데모 미리보기 MP4(클라이언트에서 미리 fetch 권장) */
  previewVideoBlob?: Blob | null
  /** 레거시·폴백: 단일 TTS(또는 TTS+BGM 믹스) blob URL */
  ttsAudioUrl: string | null
  /**
   * 보내기 시 앞에서부터 fetch 시도할 URL 목록(중복 제거).
   * 예: [믹스 blob, merged TTS blob, 미리듣기 URL]
   */
  ttsCandidateUrls?: string[]
  /** 브라우저에서 만든 TTS+BGM 믹스 blob URL — 이 URL이 채택되면 별도 BGM 파일은 넣지 않음 */
  capCutMixedBlobUrl?: string | null
  /** 배경음 정적 경로(예 `/shotform-factory-bgm/bgm1.mp3`). 믹스 미채택이고 BGM 켜짐일 때만 사용 */
  bgmPublicSrc?: string | null
  /** URL fetch가 모두 실패할 때(예: blob URL + XHR status 0) 메모리 WAV */
  ttsFallbackBlob?: Blob | null
  /** `ttsFallbackBlob`이 TTS+BGM 믹스인지 — true면 CapCut에 별도 factory_bgm 안 넣음 */
  ttsExportIncludesBgm?: boolean
  /** 5단계 동기 프리뷰와 동일 — 영상 타임라인 길이(초) */
  capCutSyncVideoDurationSec?: number
  /** 5단계 음성 생성 길이(초). WAV 메타만 길면 끝만 잘라냄(변조 없음) */
  capCutSyncAudioDurationSec?: number
  previewVideoSrc?: string
  voiceId: string
  voiceStyle: string
  seo?: {
    title: string
    description: string
    tags: string[]
    hashtags: string[]
    hookShort: string
  }
  projectLabel?: string
}

const CAPCUT_README = `CapCut PC — Wings ShotForm AI 쇼핑 숏폼
==========================================

이 폴더는 CapCut PC 네이티브 프로젝트 형식입니다.

1. CapCut을 완전히 종료한 뒤 다시 실행하세요.
2. 홈 화면 「프로젝트」 목록에 「ShotForm_…」 프로젝트가 표시됩니다.
3. 열리지 않으면 CapCut drafts 폴더(com.lveditor.draft)에
   이 폴더 전체가 있는지, root_meta_info.json이 갱신됐는지 확인하세요.

포함 내용
- Resources/preview_video.mp4  영상
- Resources/narration.*        TTS (있을 때)
- Resources/factory_bgm.mp3  배경음(믹스본 미사용·BGM 선택 시)
- 타임라인 자막               TTS 큐 기준
- _shotform/meta/             스크립트·SEO 참고 파일

※ Chrome/Edge에서 drafts 폴더에 직접 저장하면 영상·음성 경로가 PC 절대 경로로 기록되어
   CapCut에서 「미디어 분실」 없이 열립니다. ZIP으로 받은 뒤 수동 복사 시에는 경로가 맞지 않을 수 있습니다.
`

export function formatSrtTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds)
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = Math.floor(safe % 60)
  const ms = Math.round((safe % 1) * 1000)
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(3, "0")},${String(ms).padStart(3, "0")}`
}

/** TTS 큐 우선, 없으면 나레이션 구간 타임코드 */
export function buildFactorySrt(
  cues: VoiceLineCue[] | null,
  sceneText: (sceneIndex0: number) => string
): string {
  if (cues && cues.length > 0) {
    return cues
      .map(
        (c, i) =>
          `${i + 1}\n${formatSrtTimestamp(c.startSec)} --> ${formatSrtTimestamp(c.endSec)}\n${c.text.replace(/\r/g, "")}\n`
      )
      .join("\n")
  }
  return FACTORY_NARRATION_SEGMENTS.map((seg, i) => {
    const text = sceneText(i).replace(/\n/g, " ").trim()
    return `${i + 1}\n${formatSrtTimestamp(seg.start)} --> ${formatSrtTimestamp(seg.end)}\n${text}\n`
  }).join("\n")
}

function buildFactorySubtitles(
  cues: VoiceLineCue[] | null,
  sceneText: (sceneIndex0: number) => string
): CapCutSubtitleCue[] {
  if (cues && cues.length > 0) return voiceLineCuesToCapCutSubtitles(cues)
  return FACTORY_NARRATION_SEGMENTS.map((seg, i) => ({
    startSec: seg.start,
    endSec: seg.end,
    text: sceneText(i).replace(/\n/g, " ").trim(),
  }))
}

export function buildFactoryScriptText(sceneText: (sceneIndex0: number) => string): string {
  return FACTORY_NARRATION_SEGMENTS.map((seg, i) => {
    const text = sceneText(i)
    return `[${seg.start.toFixed(1)}s – ${seg.end.toFixed(1)}s]\n${text}`
  }).join("\n\n")
}

export function buildFactorySeoText(seo: NonNullable<FactoryCapCutExportInput["seo"]>): string {
  const lines = [
    seo.title.trim(),
    "",
    seo.description.trim(),
    "",
    "업로드 태그 (유튜브 스튜디오 태그란):",
    seo.tags.join(", "),
  ]
  const hook = seo.hookShort.trim()
  if (hook) {
    lines.push("", "후킹:", hook)
  }
  return lines.join("\n")
}

async function fetchOnceForCapCut(url: string): Promise<Blob | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (res.ok) {
      const b = await res.blob()
      if (b.size > 0) return b
    }
  } catch {
    /* fall through */
  }
  if (typeof XMLHttpRequest === "undefined") return null
  return await new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest()
      xhr.open("GET", url)
      xhr.responseType = "blob"
      xhr.onload = () => {
        const b = xhr.response as Blob | undefined
        const blobOk = Boolean(b && b.size > 0)
        const statusOk =
          (xhr.status >= 200 && xhr.status < 300) ||
          (xhr.status === 0 && blobOk)
        if (statusOk && blobOk) resolve(b!)
        else resolve(null)
      }
      xhr.onerror = () => resolve(null)
      xhr.send()
    } catch {
      resolve(null)
    }
  })
}

/** `blob:`·상대 경로 등 — 절대 URL·XHR status 0(blob)·재시도 */
export async function fetchBlobForCapCut(url: string): Promise<Blob | null> {
  if (!url) return null
  const raw = url.trim()
  const resolved = resolveCapCutFetchUrl(raw)
  const first = await fetchOnceForCapCut(resolved)
  if (first) return first
  if (resolved !== raw) {
    const second = await fetchOnceForCapCut(raw)
    if (second) return second
  }
  return null
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

type PreparedCapCutMedia = {
  videoBlob: Blob | null
  videoContentDurationSec: number
  videoPlaybackSpeed: number
  audioBlob: Blob | null
  audioExt: "wav" | "mp3"
  audioFileDurationSec: number
  bgmBlob: Blob | null
  bgmDurationSec: number | null
  subtitles: CapCutSubtitleCue[]
  timelineDurationSec: number
}

/**
 * 동기 프리뷰와 동일: TTS 원본(1배속), 영상은 `vid.playbackRate = vDur/aDur`로 슬로우/빠르게.
 * UI에 보이는 길이(5단계 `voicePreviewAudioDuration`)를 우선해 타임라인을 맞춤.
 */
function resolveCapCutSyncTiming(input: {
  videoContentDurationSec: number
  audioFileDurationSec: number
  capCutSyncVideoDurationSec?: number
  capCutSyncAudioDurationSec?: number
  voiceLineCues: VoiceLineCue[] | null
}): {
  timelineDurationSec: number
  videoContentDurationSec: number
  videoPlaybackSpeed: number
  audioFileDurationSec: number
} {
  let videoContentDur = input.videoContentDurationSec
  if (input.capCutSyncVideoDurationSec && input.capCutSyncVideoDurationSec > 0.1) {
    videoContentDur = input.capCutSyncVideoDurationSec
  }

  let audioDur = input.audioFileDurationSec
  if (input.capCutSyncAudioDurationSec && input.capCutSyncAudioDurationSec > 0.1) {
    audioDur = input.capCutSyncAudioDurationSec
  }
  const cuesEnd = input.voiceLineCues?.at(-1)?.endSec
  if (cuesEnd && cuesEnd > 0.1) audioDur = Math.max(audioDur, cuesEnd)

  const timeline = Math.max(audioDur, 0.1)
  const videoSpeed =
    videoContentDur > 0.05 && timeline > 0.05 ? videoContentDur / timeline : 1

  return {
    timelineDurationSec: timeline,
    videoContentDurationSec: videoContentDur,
    videoPlaybackSpeed: videoSpeed,
    audioFileDurationSec: audioDur,
  }
}

function uniqueUrlList(urls: Array<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const u of urls) {
    if (!u || seen.has(u)) continue
    seen.add(u)
    out.push(u)
  }
  return out
}

async function prepareCapCutMedia(input: FactoryCapCutExportInput): Promise<PreparedCapCutMedia> {
  const subtitles = buildFactorySubtitles(input.voiceLineCues, input.sceneText)
  const videoSrcRaw = input.previewVideoSrc?.trim() ?? ""
  const videoUrlPrimary = videoSrcRaw ? resolveCapCutFetchUrl(videoSrcRaw) : ""

  let videoBlob =
    videoUrlPrimary
      ? ((await fetchBlobForCapCut(videoUrlPrimary)) ??
        (videoUrlPrimary !== videoSrcRaw ? await fetchBlobForCapCut(videoSrcRaw) : null))
      : null

  if ((!videoBlob || videoBlob.size < MIN_VIDEO_BLOB_BYTES) && input.previewVideoBlob) {
    if (input.previewVideoBlob.size >= MIN_VIDEO_BLOB_BYTES) {
      videoBlob = input.previewVideoBlob
    }
  }

  let videoDurationSec =
    (videoUrlPrimary ? await getUrlMediaDurationSec(videoUrlPrimary, "video") : null) ??
    (videoSrcRaw ? await getUrlMediaDurationSec(videoSrcRaw, "video") : null) ??
    subtitles.at(-1)?.endSec ??
    FACTORY_NARRATION_SEGMENTS.at(-1)?.end ??
    30

  if (videoBlob) {
    const fromBlob = await getBlobMediaDurationSec(videoBlob, "video")
    if (fromBlob && Number.isFinite(fromBlob)) videoDurationSec = fromBlob
  }

  let audioBlob: Blob | null = null
  let audioExt: "wav" | "mp3" = "wav"
  let audioDurationSec: number | null = null
  let chosenTtsUrl: string | null = null

  if (input.ttsFallbackBlob && input.ttsFallbackBlob.size >= MIN_TTS_BLOB_BYTES) {
    audioBlob = input.ttsFallbackBlob
    audioExt = "wav"
    audioDurationSec = await getBlobMediaDurationSec(audioBlob, "audio")
  }

  const ttsCandidates = uniqueUrlList([...(input.ttsCandidateUrls ?? []), input.ttsAudioUrl])
  for (const url of ttsCandidates) {
    if (audioBlob) break
    if (!url) continue
    const resolved = resolveCapCutFetchUrl(url)
    let b = await fetchBlobForCapCut(resolved)
    if (!b && resolved !== url.trim()) b = await fetchBlobForCapCut(url.trim())
    if (b && b.size >= MIN_TTS_BLOB_BYTES) {
      audioBlob = b
      chosenTtsUrl = url
      audioExt = b.type.includes("wav") ? "wav" : "mp3"
      audioDurationSec = await getBlobMediaDurationSec(b, "audio")
      break
    }
  }

  let bgmBlob: Blob | null = null
  let bgmDurationSec: number | null = null
  const mixed = input.capCutMixedBlobUrl ?? null
  const usedMixed =
    Boolean(input.ttsExportIncludesBgm) || Boolean(mixed && chosenTtsUrl === mixed)

  if (!usedMixed && input.bgmPublicSrc && typeof window !== "undefined") {
    const bgmAbs = new URL(input.bgmPublicSrc, window.location.origin).href
    const b = await fetchBlobForCapCut(bgmAbs)
    if (b && b.size >= MIN_BGM_BLOB_BYTES) {
      bgmBlob = b
      bgmDurationSec = await getBlobMediaDurationSec(b, "audio")
    }
  }

  const audioFileDurationSec = audioDurationSec ?? 0
  const sync = resolveCapCutSyncTiming({
    videoContentDurationSec: videoDurationSec,
    audioFileDurationSec,
    capCutSyncVideoDurationSec: input.capCutSyncVideoDurationSec,
    capCutSyncAudioDurationSec: input.capCutSyncAudioDurationSec,
    voiceLineCues: input.voiceLineCues,
  })

  if (!videoBlob || videoBlob.size < MIN_VIDEO_BLOB_BYTES) {
    throw new Error(
      "CapCut용 짜집기 영상(MP4)을 불러오지 못했습니다. 편집 탭에서 미리보기가 재생되는지 확인하고, 새로고침 후 다시 시도해 주세요. 반복되면 짜집기를 다시 실행해 주세요."
    )
  }
  if (!audioBlob || audioBlob.size < MIN_TTS_BLOB_BYTES) {
    throw new Error(
      "CapCut에 넣을 TTS 음성(narration.wav)을 읽지 못했습니다. 5단계에서 「음성 생성」이 완료된 뒤 미리듣기가 되는지 확인하고 다시 「CapCut 보내기」해 주세요."
    )
  }

  let exportAudioBlob = audioBlob
  let exportAudioExt = audioExt
  let syncOut = sync

  if (
    input.capCutSyncAudioDurationSec &&
    input.capCutSyncAudioDurationSec > 0.1 &&
    audioFileDurationSec > input.capCutSyncAudioDurationSec + 0.15
  ) {
    exportAudioBlob = await trimAudioBlobToMaxDuration(
      audioBlob,
      input.capCutSyncAudioDurationSec
    )
    exportAudioExt = "wav"
    syncOut = {
      ...sync,
      timelineDurationSec: input.capCutSyncAudioDurationSec,
      audioFileDurationSec: input.capCutSyncAudioDurationSec,
      videoPlaybackSpeed:
        sync.videoContentDurationSec > 0.05
          ? sync.videoContentDurationSec / input.capCutSyncAudioDurationSec
          : 1,
    }
  }

  return {
    videoBlob,
    videoContentDurationSec: syncOut.videoContentDurationSec,
    videoPlaybackSpeed: syncOut.videoPlaybackSpeed,
    audioBlob: exportAudioBlob,
    audioExt: exportAudioExt,
    audioFileDurationSec: syncOut.audioFileDurationSec,
    bgmBlob,
    bgmDurationSec: bgmBlob ? syncOut.timelineDurationSec : bgmDurationSec,
    subtitles,
    timelineDurationSec: syncOut.timelineDurationSec,
  }
}

function buildCapCutExportBundleParams(
  folderName: string,
  draftRootPath: string,
  media: PreparedCapCutMedia,
  useAbsoluteMediaPaths: boolean
) {
  const mediaBlobs: Record<string, Blob> = {}
  if (media.videoBlob) mediaBlobs["preview_video.mp4"] = media.videoBlob
  if (media.audioBlob) mediaBlobs[`narration.${media.audioExt}`] = media.audioBlob
  if (media.bgmBlob) mediaBlobs["factory_bgm.mp3"] = media.bgmBlob

  const timelineUs = secondsToCapCutUs(media.timelineDurationSec)
  const bgmSegSec = media.bgmBlob ? media.timelineDurationSec : 0

  return {
    folderName,
    draftName: folderName,
    draftRootPath,
    durationUs: timelineUs,
    video: media.videoBlob
      ? {
          fileName: "preview_video.mp4",
          width: 1080,
          height: 1920,
          durationUs: timelineUs,
          sourceDurationUs: secondsToCapCutUs(media.videoContentDurationSec),
          speed: media.videoPlaybackSpeed,
        }
      : undefined,
    audio: media.audioBlob
      ? {
          fileName: `narration.${media.audioExt}`,
          durationUs: secondsToCapCutUs(media.timelineDurationSec),
          volume: 1,
        }
      : undefined,
    bgm: media.bgmBlob
      ? {
          fileName: "factory_bgm.mp3",
          durationUs: timelineUs,
          volume: 0.22,
        }
      : undefined,
    subtitles: media.subtitles,
    mediaBlobs,
    useAbsoluteMediaPaths,
  }
}

async function writeHandleFile(
  dirHandle: FileSystemDirectoryHandle,
  path: string,
  data: Blob | string
) {
  const parts = path.split("/")
  let current = dirHandle
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i]!, { create: true })
  }
  const fileHandle = await current.getFileHandle(parts[parts.length - 1]!, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(data)
  await writable.close()
}

async function writeShotFormSidecarFiles(
  projectDir: FileSystemDirectoryHandle,
  input: FactoryCapCutExportInput
) {
  await writeHandleFile(projectDir, "README_CAPCUT.txt", CAPCUT_README)
  await writeHandleFile(projectDir, "_shotform/meta/script.txt", buildFactoryScriptText(input.sceneText))
  await writeHandleFile(projectDir, "_shotform/meta/script_timeline.txt", narrationScriptPlainText())
  if (input.seo) {
    await writeHandleFile(projectDir, "_shotform/meta/seo.txt", buildFactorySeoText(input.seo))
  }
  await writeHandleFile(
    projectDir,
    "_shotform/meta/project.json",
    JSON.stringify(
      {
        app: "wings-shotform-factory",
        version: 2,
        aspectRatio: "9:16",
        label: input.projectLabel ?? "shoppingshotform",
        voiceId: input.voiceId,
        voiceStyle: input.voiceStyle,
        exportedAt: new Date().toISOString(),
        sceneCount: FACTORY_NARRATION_SEGMENTS.length,
      },
      null,
      2
    )
  )
  await writeHandleFile(
    projectDir,
    "_shotform/subtitles/captions.srt",
    buildFactorySrt(input.voiceLineCues, input.sceneText)
  )
}

export async function buildCapCutExportZip(input: FactoryCapCutExportInput): Promise<Blob> {
  const media = await prepareCapCutMedia(input)
  const folderName = defaultShotFormDraftFolderName(input.projectLabel)
  const draftRootPath = "C:/CapCut/User Data/Projects/com.lveditor.draft"

  const bundle = buildCapCutNativeDraftBundle(
    buildCapCutExportBundleParams(folderName, draftRootPath, media, false)
  )

  const zip = new JSZip()
  const root = zip.folder(folderName)
  if (!root) throw new Error("ZIP 폴더를 만들 수 없습니다.")

  for (const [path, value] of Object.entries(bundle.files)) {
    if (typeof value === "string") root.file(path, value)
    else root.file(path, value)
  }

  root.file("README_CAPCUT.txt", CAPCUT_README)
  root.file("_shotform/meta/script.txt", buildFactoryScriptText(input.sceneText))
  root.file("_shotform/meta/script_timeline.txt", narrationScriptPlainText())
  if (input.seo) root.file("_shotform/meta/seo.txt", buildFactorySeoText(input.seo))
  root.file(
    "_shotform/subtitles/captions.srt",
    buildFactorySrt(input.voiceLineCues, input.sceneText)
  )
  root.file(
    "INSTALL.txt",
    `CapCut drafts 폴더(com.lveditor.draft)에 이 ZIP을 풀고 CapCut을 재시작하세요.\n\n` +
      `폴더 안의 ${folderName}/ 가 프로젝트입니다.\n` +
      `root_meta_info.json 은 브라우저 ZIP 모드에서는 갱신되지 않습니다.\n` +
      `Chrome/Edge에서 「CapCut 보내기」로 drafts 폴더를 직접 선택하면 자동 등록됩니다.\n`
  )

  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } })
}

/** Chrome/Edge: CapCut drafts 폴더에 네이티브 프로젝트 생성 + root_meta_info 등록 */
export async function writeCapCutExportToDirectory(
  draftsRootHandle: FileSystemDirectoryHandle,
  input: FactoryCapCutExportInput
): Promise<string> {
  const draftRootPath = await readDraftRootPathFromHandle(draftsRootHandle)
  if (!draftRootPath) {
    throw new Error(
      "CapCut drafts 폴더를 인식하지 못했습니다. com.lveditor.draft 또는 CapCut Drafts 폴더(root_meta_info.json 포함)를 선택해 주세요."
    )
  }

  const media = await prepareCapCutMedia(input)
  const folderName = defaultShotFormDraftFolderName(input.projectLabel)
  const projectDir = await draftsRootHandle.getDirectoryHandle(folderName, { create: true })

  const bundleParams = buildCapCutExportBundleParams(folderName, draftRootPath, media, true)
  const timelineMaterialsSize = Object.values(bundleParams.mediaBlobs).reduce((sum, b) => sum + b.size, 0)
  const durationUs = bundleParams.durationUs

  const bundle = buildCapCutNativeDraftBundle(bundleParams)

  for (const [path, value] of Object.entries(bundle.files)) {
    await writeHandleFile(projectDir, path, value)
  }

  await writeShotFormSidecarFiles(projectDir, input)

  const store = await readRootMetaStore(draftsRootHandle)
  const entry = buildRootMetaDraftEntry({
    draftId: bundle.draftId,
    draftName: folderName,
    foldPath: bundle.foldPath,
    draftRootPath,
    durationUs,
    timelineMaterialsSize: Math.max(timelineMaterialsSize, 1),
  })
  const rootMetaJson = buildRootMetaInfoJson(store, entry)
  await writeHandleFile(draftsRootHandle, "root_meta_info.json", rootMetaJson)

  return folderName
}

export function capcutDirectoryPickerSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window
}

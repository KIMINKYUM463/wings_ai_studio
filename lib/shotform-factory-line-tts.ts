/** AI 쇼핑 숏폼: 장면(컷)당 TTS 1회 — 자막만 표시용으로 줄 분할 */

import { cleanNarrationLineBreaks, narrationPlainCharCount } from "@/lib/shotform-narration-timing"
import { clampTtsSpeed } from "@/lib/shotform-tts-speed"

/** Supertone 등 TTS API 최소 글자 수 (1자 요청 시 400 오류) */
export const MIN_TTS_PLAIN_CHARS = 2

/** 1~2자짜리 잘린 조각을 앞 줄에 합침 */
export function consolidateTinySubtitleLines(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (narrationPlainCharCount(t) < MIN_TTS_PLAIN_CHARS && out.length) {
      out[out.length - 1] = `${out[out.length - 1]} ${t}`.trim()
      continue
    }
    if (narrationPlainCharCount(t) >= MIN_TTS_PLAIN_CHARS) {
      out.push(t)
    }
  }
  return out
}

export type VoiceLineCue = {
  /** TTS에 넣은 전체 대본 (장면당 1회) */
  text: string
  startSec: number
  endSec: number
  /** 0-based 나레이션 구간 인덱스 */
  sceneIndex: number
  /** 화면 자막 표시용 줄 — TTS와 무관, cue 구간 내 순차 표시 */
  displayLines?: string[]
}

/** 화면·자막용 — 한 줄 최대 글자 수 (쇼핑숏폼 가독성) */
export const SUBTITLE_MAX_PLAIN_CHARS = 22

/** 세로 숏폼 미리보기 — 한 줄에 들어갈 때까지의 글자 수 (넘으면 2줄 줄바꿈) */
export const SUBTITLE_DISPLAY_MAX_ONE_LINE_CHARS = 12

/** 화면·자막용 — 한 줄이 너무 길면 짧게 분할 (말줄임 방지) */
export function splitLongSubtitleLine(line: string, maxPlainChars = SUBTITLE_MAX_PLAIN_CHARS): string[] {
  const t = line.trim()
  if (!t) return []
  if (narrationPlainCharCount(t) <= maxPlainChars) return [t]

  const words = t.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    const out: string[] = []
    let cur = ""
    for (const w of words) {
      if (/^[.!?。！？…]+$/.test(w)) {
        if (cur) cur = `${cur}${w}`
        else if (out.length) out[out.length - 1] = `${out[out.length - 1]}${w}`
        continue
      }
      const next = cur ? `${cur} ${w}` : w
      if (narrationPlainCharCount(next) <= maxPlainChars) {
        cur = next
      } else {
        if (cur) out.push(cur)
        if (narrationPlainCharCount(w) <= maxPlainChars) {
          cur = w
        } else {
          out.push(...chunkPlainChars(w, maxPlainChars))
          cur = ""
        }
      }
    }
    if (cur) out.push(cur)
    return out
  }

  return chunkPlainChars(t, maxPlainChars)
}

function chunkPlainChars(text: string, maxPlainChars: number): string[] {
  const t = text.trim()
  if (!t) return []
  if (narrationPlainCharCount(t) <= maxPlainChars) return [t]

  const out: string[] = []
  let remaining = t
  while (remaining && narrationPlainCharCount(remaining) > maxPlainChars) {
    let cut = maxPlainChars
    const slice = remaining.slice(0, Math.min(remaining.length, maxPlainChars + 8))
    for (const re of [/(?<=[.!?…])\s*$/, /(?<=[요죠네다음])\s*$/, /(?<=[을를이가의에과와도로])\s*$/]) {
      const m = slice.match(re)
      if (m && (m.index ?? 0) >= 4) {
        cut = (m.index ?? 0) + m[0].length
        break
      }
    }
    const part = remaining.slice(0, cut).trim()
    if (!part) break
    out.push(part)
    remaining = remaining.slice(cut).trim()
  }
  if (remaining) out.push(remaining)
  return out.length ? out : [t]
}

/** 화면 자막 오버레이 — 항상 한 줄만 (여러 줄·`\n`은 스케줄에서 순차 큐로 분리) */
export function formatSubtitleDisplayText(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim()
}

/** 컷 대본 → TTS 1회용 문자열 (Enter 줄은 공백으로 이어 읽음) */
export function narrationTtsTextFromScene(text: string): string {
  const raw = text.replace(/\r/g, "").trim()
  if (!raw) return ""

  const blocks = raw
    .split("\n")
    .map((l) => cleanNarrationLineBreaks(l.trim()))
    .filter(Boolean)

  const joined = blocks.length ? blocks.join(" ") : raw
  return formatSubtitleDisplayText(joined)
}

/**
 * @deprecated 장면당 TTS 1회 — `narrationTtsTextFromScene` + `expandSubtitleScheduleLines` 사용
 */
export function narrationTtsLinesFromSceneText(text: string): string[] {
  const raw = text.replace(/\r/g, "").trim()
  if (!raw) return []

  const blocks = raw
    .split("\n")
    .map((l) => cleanNarrationLineBreaks(l.trim()))
    .filter(Boolean)

  const rows = (blocks.length ? blocks : [raw])
    .map((line) => formatSubtitleDisplayText(line))
    .filter((t) => t && narrationPlainCharCount(t) >= MIN_TTS_PLAIN_CHARS)

  if (rows.length) return consolidateTinySubtitleLines(rows)

  const single = formatSubtitleDisplayText(raw)
  return single && narrationPlainCharCount(single) >= MIN_TTS_PLAIN_CHARS ? [single] : []
}

/**
 * 화면 표시용 — 긴 한 줄을 짧게 분할 (미리보기 가독성). TTS 생성에는 사용하지 않음.
 * `\n`으로 나뉜 2~3줄은 각각 별도 큐.
 */
export function expandSubtitleScheduleLines(
  text: string,
  maxCharsPerCue = SUBTITLE_DISPLAY_MAX_ONE_LINE_CHARS,
): string[] {
  const raw = text.replace(/\r/g, "").trim()
  if (!raw) return []

  const blocks = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  const rows: string[] = []
  if (blocks.length > 1) {
    for (const block of blocks) {
      rows.push(...splitLongSubtitleLine(block.replace(/\s+/g, " ").trim(), maxCharsPerCue))
    }
  } else {
    for (const line of splitToSingleSubtitleLines(raw)) {
      const t = line.replace(/\s+/g, " ").trim()
      if (!t) continue
      rows.push(...splitLongSubtitleLine(t, maxCharsPerCue))
    }
  }

  return cleanNarrationLineBreaks(rows.filter(Boolean).join("\n"))
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
}

/** 나레이션 구간을 `\n`·문장 단위로 펼쳐 자막/TTS는 항상 한 줄씩 */
export function splitToSingleSubtitleLines(text: string): string[] {
  const blocks = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const out: string[] = []
  for (const block of blocks) {
    const parts = block
      .split(/(?<=[.!?。！？…])\s+|(?<=[요죠네다음][.!?]?)\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const rows = parts.length <= 1 ? (block ? [block] : []) : parts
    for (const row of rows) {
      out.push(...splitLongSubtitleLine(row))
    }
  }
  const merged = consolidateTinySubtitleLines(out.length ? out : splitLongSubtitleLine(text.trim()))
  return merged.length ? merged : consolidateTinySubtitleLines([text.trim()].filter(Boolean))
}

/** 장면당 TTS 1줄 + 화면 자막용 displayLines */
export function collectNarrationSubtitleLines(
  segments: readonly { text: string }[],
  sceneText: (sceneIndex: number) => string,
): Array<{ text: string; sceneIndex: number; displayLines: string[] }> {
  const out: Array<{ text: string; sceneIndex: number; displayLines: string[] }> = []
  for (let i = 0; i < segments.length; i++) {
    const raw = sceneText(i).replace(/\r/g, "").trim() || segments[i]!.text.trim()
    let ttsText = narrationTtsTextFromScene(raw)
    if (!ttsText) {
      const fallback = segments[i]!.text.trim()
      if (fallback) ttsText = narrationTtsTextFromScene(fallback)
    }
    if (!ttsText || narrationPlainCharCount(ttsText) < MIN_TTS_PLAIN_CHARS) continue

    const displayLines = expandSubtitleScheduleLines(raw)
    out.push({
      text: ttsText,
      sceneIndex: i,
      displayLines: displayLines.length ? displayLines : [ttsText],
    })
  }
  return out
}

export function buildVoiceLineCues(
  lines: Array<{ text: string; sceneIndex: number; durationSec: number; displayLines?: string[] }>,
): VoiceLineCue[] {
  let t = 0
  return lines.map((line) => {
    const startSec = t
    const endSec = startSec + Math.max(0.01, line.durationSec)
    t = endSec
    return {
      text: line.text,
      startSec,
      endSec,
      sceneIndex: line.sceneIndex,
      displayLines: line.displayLines,
    }
  })
}

export function voiceLineCueAtTime(cues: readonly VoiceLineCue[], audioTimeSec: number): VoiceLineCue | null {
  if (cues.length === 0) return null
  const t = Math.max(0, audioTimeSec)
  for (const c of cues) {
    if (t >= c.startSec && t < c.endSec - 1e-5) return c
  }
  const last = cues[cues.length - 1]!
  if (t >= last.startSec) return last
  return cues[0]!
}

export function voiceSubtitleAtLineCues(cues: readonly VoiceLineCue[], audioTimeSec: number): string {
  const cue = voiceLineCueAtTime(cues, audioTimeSec)
  if (!cue) return ""

  const lines = cue.displayLines?.length ? cue.displayLines : [cue.text]
  if (lines.length <= 1) return formatSubtitleDisplayText(lines[0] ?? cue.text)

  const elapsed = Math.max(0, audioTimeSec - cue.startSec)
  const dur = Math.max(0.01, cue.endSec - cue.startSec)
  const idx = Math.min(lines.length - 1, Math.floor((elapsed / dur) * lines.length))
  return formatSubtitleDisplayText(lines[idx]!)
}

export function voiceSceneIndexAtLineCues(cues: readonly VoiceLineCue[], audioTimeSec: number): number {
  return voiceLineCueAtTime(cues, audioTimeSec)?.sceneIndex ?? 0
}

function getAudioContext(): AudioContext {
  const Ctx = typeof window !== "undefined" ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined
  if (!Ctx) throw new Error("AudioContext를 사용할 수 없습니다.")
  return new Ctx()
}

/** data URL / blob URL 오디오의 재생 길이(초) */
export async function decodeAudioDurationSec(audioUrl: string): Promise<number> {
  const ctx = getAudioContext()
  try {
    const res = await fetch(audioUrl)
    const buf = await res.arrayBuffer()
    const decoded = await ctx.decodeAudioData(buf.slice(0))
    return decoded.duration
  } finally {
    void ctx.close()
  }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length
  const numberOfChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i))
  }

  writeString(0, "RIFF")
  view.setUint32(4, 36 + length * numberOfChannels * 2, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numberOfChannels * 2, true)
  view.setUint16(32, numberOfChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, "data")
  view.setUint32(40, length * numberOfChannels * 2, true)

  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]!))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return arrayBuffer
}

/** TTS 원본 그대로 — 지정 초까지만 잘라냄(피치 변조 없음). WAV가 메타만 길 때 사용 */
export async function trimAudioBlobToMaxDuration(
  audioBlob: Blob,
  maxDurationSec: number,
): Promise<Blob> {
  if (maxDurationSec <= 0.05) return audioBlob
  const ctx = getAudioContext()
  try {
    const decoded = await ctx.decodeAudioData((await audioBlob.arrayBuffer()).slice(0))
    if (decoded.duration <= maxDurationSec + 0.05) return audioBlob
    const samples = Math.max(1, Math.ceil(maxDurationSec * decoded.sampleRate))
    const out = ctx.createBuffer(decoded.numberOfChannels, samples, decoded.sampleRate)
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const src = decoded.getChannelData(Math.min(ch, decoded.numberOfChannels - 1))
      out.getChannelData(ch).set(src.subarray(0, samples))
    }
    return new Blob([audioBufferToWav(out)], { type: "audio/wav" })
  } finally {
    void ctx.close()
  }
}

/**
 * @deprecated CapCut 보내기에서는 사용하지 않음 — 목소리 변조됨. 영상 슬로우 방식 사용.
 */
export async function fitAudioBlobToVideoTimeline(
  audioBlob: Blob,
  sourceDurationSec: number,
  targetDurationSec: number,
): Promise<Blob> {
  if (targetDurationSec <= 0.05 || sourceDurationSec <= 0.05) return audioBlob
  if (Math.abs(sourceDurationSec - targetDurationSec) < 0.05) return audioBlob

  const ctx = getAudioContext()
  try {
    const decoded = await ctx.decodeAudioData((await audioBlob.arrayBuffer()).slice(0))
    const rate = decoded.duration / targetDurationSec
    const length = Math.max(1, Math.ceil(decoded.sampleRate * targetDurationSec))
    const offline = new OfflineAudioContext(decoded.numberOfChannels, length, decoded.sampleRate)
    const src = offline.createBufferSource()
    src.buffer = decoded
    src.playbackRate.value = rate
    src.connect(offline.destination)
    src.start(0)
    const rendered = await offline.startRendering()
    return new Blob([audioBufferToWav(rendered)], { type: "audio/wav" })
  } finally {
    void ctx.close()
  }
}

function trimBufferSilence(buffer: AudioBuffer, threshold = 0.012): AudioBuffer {
  const channels = buffer.numberOfChannels
  const length = buffer.length
  if (length === 0) return buffer

  let start = 0
  let end = length

  findStart: for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      if (Math.abs(buffer.getChannelData(ch)[i]!) > threshold) {
        start = i
        break findStart
      }
    }
  }

  findEnd: for (let i = length - 1; i >= start; i--) {
    for (let ch = 0; ch < channels; ch++) {
      if (Math.abs(buffer.getChannelData(ch)[i]!) > threshold) {
        end = i + 1
        break findEnd
      }
    }
  }

  const pad = Math.min(480, Math.floor(buffer.sampleRate * 0.006))
  start = Math.max(0, start - pad)
  end = Math.min(length, end + Math.floor(pad * 0.15))
  if (end <= start) return buffer

  const outLen = end - start
  const ctx = new OfflineAudioContext(channels, outLen, buffer.sampleRate)
  const out = ctx.createBuffer(channels, outLen, buffer.sampleRate)
  for (let ch = 0; ch < channels; ch++) {
    out.getChannelData(ch).set(buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1)).subarray(start, end))
  }
  return out
}

/** TTS 줄 오디오 배속 — API 미지원 provider·ElevenLabs 보조. 1.2 = 약 20% 짧은 음성 */
export async function applyPlaybackSpeedToAudioUrl(
  audioUrl: string,
  speed: number
): Promise<{ url: string; durationSec: number; wavBlob: Blob }> {
  const rate = clampTtsSpeed(speed)
  if (Math.abs(rate - 1) < 0.02) {
    const durationSec = await decodeAudioDurationSec(audioUrl)
    const res = await fetch(audioUrl)
    const wavBlob = await res.blob()
    return { url: audioUrl, durationSec, wavBlob }
  }

  const ctx = getAudioContext()
  try {
    const res = await fetch(audioUrl)
    const decoded = await ctx.decodeAudioData((await res.arrayBuffer()).slice(0))
    const outSamples = Math.max(1, Math.ceil(decoded.length / rate))
    const offline = new OfflineAudioContext(decoded.numberOfChannels, outSamples, decoded.sampleRate)
    const src = offline.createBufferSource()
    src.buffer = decoded
    src.playbackRate.value = rate
    src.connect(offline.destination)
    src.start(0)
    const rendered = await offline.startRendering()
    const wav = audioBufferToWav(rendered)
    const wavBlob = new Blob([wav], { type: "audio/wav" })
    return { url: URL.createObjectURL(wavBlob), durationSec: rendered.duration, wavBlob }
  } finally {
    void ctx.close()
  }
}

/** Supertone TTS 앞뒤 무음 제거 — 줄 사이 텀 방지 */
export async function trimSilenceFromAudioUrl(
  audioUrl: string,
  threshold = 0.012,
): Promise<{ blobUrl: string; durationSec: number; wavBlob: Blob }> {
  const ctx = getAudioContext()
  try {
    const res = await fetch(audioUrl)
    const decoded = await ctx.decodeAudioData((await res.arrayBuffer()).slice(0))
    const trimmed = trimBufferSilence(decoded, threshold)
    const wav = audioBufferToWav(trimmed)
    const blob = new Blob([wav], { type: "audio/wav" })
    return { blobUrl: URL.createObjectURL(blob), durationSec: trimmed.duration, wavBlob: blob }
  } finally {
    void ctx.close()
  }
}

/** 줄별 TTS WAV를 이어 붙여 하나의 blob URL과 총 길이를 반환 (각 클립 무음 trim) */
export async function mergeAudioUrlsToWavBlobUrl(
  audioUrls: string[],
  options?: { trimSilence?: boolean },
): Promise<{ blobUrl: string; wavBlob: Blob; totalDurationSec: number; lineDurationsSec: number[] }> {
  if (audioUrls.length === 0) throw new Error("합칠 오디오가 없습니다.")
  const trim = options?.trimSilence !== false
  const ctx = getAudioContext()
  try {
    const buffers: AudioBuffer[] = []
    const lineDurationsSec: number[] = []
    for (const url of audioUrls) {
      const res = await fetch(url)
      const ab = await res.arrayBuffer()
      let decoded = await ctx.decodeAudioData(ab.slice(0))
      if (trim) decoded = trimBufferSilence(decoded)
      buffers.push(decoded)
      lineDurationsSec.push(decoded.duration)
    }
    const sampleRate = buffers[0]!.sampleRate
    const channels = buffers[0]!.numberOfChannels
    const totalSamples = buffers.reduce((s, b) => s + b.length, 0)
    const merged = ctx.createBuffer(channels, totalSamples, sampleRate)
    let offset = 0
    for (const buf of buffers) {
      for (let ch = 0; ch < channels; ch++) {
        merged.getChannelData(ch).set(buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1)), offset)
      }
      offset += buf.length
    }
    const wav = audioBufferToWav(merged)
    const blob = new Blob([wav], { type: "audio/wav" })
    return {
      blobUrl: URL.createObjectURL(blob),
      wavBlob: blob,
      totalDurationSec: merged.duration,
      lineDurationsSec,
    }
  } finally {
    void ctx.close()
  }
}

/** BGM을 TTS 길이만큼 루프·리샘플한 버퍼 */
function buildLoopedBgmBuffer(
  ctx: BaseAudioContext,
  bgm: AudioBuffer,
  targetSampleRate: number,
  targetLength: number,
  channels: number,
): AudioBuffer {
  const out = ctx.createBuffer(channels, targetLength, targetSampleRate)
  const bgmLen = bgm.length
  const ratio = bgm.sampleRate / targetSampleRate
  for (let ch = 0; ch < channels; ch++) {
    const bgmCh = bgm.getChannelData(Math.min(ch, bgm.numberOfChannels - 1))
    const outCh = out.getChannelData(ch)
    for (let i = 0; i < targetLength; i++) {
      const srcIdx = (i * ratio) % bgmLen
      const idx0 = Math.floor(srcIdx)
      const idx1 = (idx0 + 1) % bgmLen
      const frac = srcIdx - idx0
      outCh[i] = bgmCh[idx0]! * (1 - frac) + bgmCh[idx1]! * frac
    }
  }
  return out
}

/**
 * TTS WAV 위에 BGM을 오프라인 믹스 — 프리뷰는 이 결과 하나만 재생 (이중 재생·seek 깨짐 방지).
 * @param bgmVolumePct 0–100 UI 슬라이더 값
 */
export async function mixTtsWithBgmWavBlobUrl(
  ttsUrl: string,
  bgmSrc: string,
  bgmVolumePct: number,
): Promise<{ blobUrl: string; wavBlob: Blob; totalDurationSec: number }> {
  const ctx = getAudioContext()
  try {
    const fetchDecode = async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`오디오를 불러오지 못했습니다: ${url}`)
      return ctx.decodeAudioData((await res.arrayBuffer()).slice(0))
    }
    const [ttsBuffer, bgmBuffer] = await Promise.all([fetchDecode(ttsUrl), fetchDecode(bgmSrc)])

    const sampleRate = ttsBuffer.sampleRate
    const channels = ttsBuffer.numberOfChannels
    const length = ttsBuffer.length
    const bgmGain = Math.min(1, Math.max(0, (bgmVolumePct / 100) * 0.38))

    const offline = new OfflineAudioContext(channels, length, sampleRate)
    const ttsSrc = offline.createBufferSource()
    ttsSrc.buffer = ttsBuffer
    ttsSrc.connect(offline.destination)

    const loopedBgm = buildLoopedBgmBuffer(offline, bgmBuffer, sampleRate, length, channels)
    const bgmSrcNode = offline.createBufferSource()
    bgmSrcNode.buffer = loopedBgm
    const bgmGainNode = offline.createGain()
    bgmGainNode.gain.value = bgmGain
    bgmSrcNode.connect(bgmGainNode)
    bgmGainNode.connect(offline.destination)

    ttsSrc.start(0)
    bgmSrcNode.start(0)
    const rendered = await offline.startRendering()

    const wav = audioBufferToWav(rendered)
    const blob = new Blob([wav], { type: "audio/wav" })
    return { blobUrl: URL.createObjectURL(blob), wavBlob: blob, totalDurationSec: rendered.duration }
  } finally {
    void ctx.close()
  }
}

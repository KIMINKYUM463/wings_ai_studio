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
  /** 장면 맞춤으로 합성에 사용한 TTS 배속 */
  speed?: number
}

/** 화면·자막용 — 한 줄 최대 글자 수 (쇼핑숏폼 가독성) */
export const SUBTITLE_MAX_PLAIN_CHARS = 22

/**
 * 세로 숏폼 미리보기 — 한 줄(큐) 최대 글자 수.
 * 넘치면 다음 큐로 넘깁니다(화면에서 줄바꿈하지 않음). 큰 글씨(32px) 기준.
 */
export const SUBTITLE_DISPLAY_MAX_ONE_LINE_CHARS = 10

/** 의미 구가 이보다 짧으면 앞 구에 합침 */
const SUBTITLE_MIN_MEANING_PHRASE_CHARS = 4

/** 화면·자막용 — 한 줄이 너무 길면 짧게 분할 (말줄임·화면 밖 방지) */
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
 * 대본을 의미 단위(문장·쉼표·연결어미)로 쪼갠 뒤, 한 줄 큐로 펼칩니다.
 * TTS에는 쓰지 않고 화면 자막 스케줄에만 사용합니다. 화면에는 항상 한 줄만 표시.
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
  for (const block of blocks.length ? blocks : [raw]) {
    const flat = block.replace(/\s+/g, " ").trim()
    if (!flat) continue
    const phrases = splitIntoMeaningPhrases(flat)
    const source = phrases.length ? phrases : [flat]
    for (const phrase of source) {
      rows.push(...splitLongSubtitleLine(phrase, maxCharsPerCue))
    }
  }

  const cleaned = cleanNarrationLineBreaks(rows.filter(Boolean).join("\n"))
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  const merged = consolidateTinySubtitleLines(cleaned)
  return merged.length ? merged : consolidateTinySubtitleLines([formatSubtitleDisplayText(raw)].filter(Boolean))
}

/** 구두점·연결어미 기준으로 의미 구 분할 */
function splitIntoMeaningPhrases(text: string): string[] {
  const normalized = text
    .replace(/…+/g, "…")
    .replace(/\.{2,}/g, "…")

  const raw = normalized
    .replace(/([.!?。！？,，、]|…)/g, "$1\u0001")
    .replace(
      /(는데|지만|면서|해서|니까|라도|거나|으며|하며|이고|하고|다가)\s+/g,
      "$1\u0001",
    )
    .replace(/(요|죠|네요|세요|까요|예요|이에요)\s+/g, "$1\u0001")
    .split("\u0001")
    .map((part) => part.replace(/…/g, "").trim())
    .filter(Boolean)

  return mergeTinyMeaningPhrases(raw)
}

function mergeTinyMeaningPhrases(parts: string[]): string[] {
  const out: string[] = []
  for (const part of parts) {
    const plain = part.replace(/\s/g, "")
    if (!plain) continue
    if (plain.length < SUBTITLE_MIN_MEANING_PHRASE_CHARS && out.length) {
      out[out.length - 1] = `${out[out.length - 1]} ${part}`.trim()
      continue
    }
    out.push(part)
  }
  return out
}

/** 나레이션 구간을 `\n`·의미 단위로 펼쳐 자막은 항상 한 줄씩 */
export function splitToSingleSubtitleLines(text: string): string[] {
  return expandSubtitleScheduleLines(text, SUBTITLE_MAX_PLAIN_CHARS)
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
  lines: Array<{
    text: string
    sceneIndex: number
    durationSec: number
    displayLines?: string[]
    speed?: number
  }>,
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
      ...(line.speed != null ? { speed: line.speed } : {}),
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

  // 저장된 displayLines가 있어도 의미 단위·한 줄 규칙으로 다시 펼침 (기존 프로젝트 포함)
  const source = cue.displayLines?.length
    ? cue.displayLines.join(" ")
    : cue.text
  const lines = expandSubtitleScheduleLines(source)
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

/** TTS 클립 끝 여유(초) — 마지막 트랙 말꼬리·렌더 flush용 (장면 사이에는 넣지 않음) */
export const TTS_CLIP_END_PAD_SEC = 0.08
/** TTS 클립 앞 여유(초) */
export const TTS_CLIP_START_PAD_SEC = 0.02
/** 장면 사이 기본 간격 — 거의 없음 (무음 구간 제거) */
export const TTS_INTER_CLIP_PAD_SEC = 0.02

function trimBufferSilence(
  buffer: AudioBuffer,
  threshold = 0.01
): { buffer: AudioBuffer; trimStartSec: number } {
  const channels = buffer.numberOfChannels
  const length = buffer.length
  if (length === 0) return { buffer, trimStartSec: 0 }

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

  // 끝 무음만 제거 — 말꼬리(약한 종성)는 낮은 임계값 + keepTail로 보존
  const endThreshold = Math.min(threshold, 0.005)
  const keepTail = Math.floor(buffer.sampleRate * 0.04)
  findEnd: for (let i = length - 1; i >= start; i--) {
    for (let ch = 0; ch < channels; ch++) {
      if (Math.abs(buffer.getChannelData(ch)[i]!) > endThreshold) {
        end = Math.min(length, i + 1 + keepTail)
        break findEnd
      }
    }
  }

  const startPad = Math.min(
    Math.floor(buffer.sampleRate * TTS_CLIP_START_PAD_SEC),
    Math.floor(buffer.sampleRate * 0.03)
  )
  start = Math.max(0, start - startPad)
  if (end <= start) return { buffer, trimStartSec: 0 }

  const outLen = end - start
  const ctx = new OfflineAudioContext(channels, outLen, buffer.sampleRate)
  const out = ctx.createBuffer(channels, outLen, buffer.sampleRate)
  for (let ch = 0; ch < channels; ch++) {
    out.getChannelData(ch).set(buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1)).subarray(start, end))
  }
  return {
    buffer: out,
    trimStartSec: start / buffer.sampleRate,
  }
}

/** 클립 뒤에 짧은 무음 패딩 — 장면 전환 시 말꼬리 보호 */
function appendSilencePad(buffer: AudioBuffer, padSec: number): AudioBuffer {
  const padSamples = Math.max(0, Math.floor(buffer.sampleRate * padSec))
  if (padSamples <= 0) return buffer
  const channels = buffer.numberOfChannels
  const outLen = buffer.length + padSamples
  const ctx = new OfflineAudioContext(channels, outLen, buffer.sampleRate)
  const out = ctx.createBuffer(channels, outLen, buffer.sampleRate)
  for (let ch = 0; ch < channels; ch++) {
    out.getChannelData(ch).set(buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1)), 0)
  }
  return out
}

/** TTS 줄 오디오 배속 — ffmpeg atempo로 피치(목소리) 유지. 1.4 = 약 1/1.4 길이 */
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

  const res = await fetch(audioUrl)
  const inputBlob = await res.blob()
  const { changeAudioTempoPreservePitch } = await import("@/lib/mvp-webm-to-mp4")
  const wavBlob = await changeAudioTempoPreservePitch(inputBlob, rate)
  const url = URL.createObjectURL(wavBlob)
  const durationSec = await decodeAudioDurationSec(url)
  return { url, durationSec, wavBlob }
}

/** Supertone TTS 앞뒤 무음 제거 — 줄 사이 텀 방지 */
export async function trimSilenceFromAudioUrl(
  audioUrl: string,
  threshold = 0.01,
): Promise<{
  blobUrl: string
  durationSec: number
  wavBlob: Blob
  /** 원본 기준 앞쪽 잘린 초 — Whisper 싱크 보정에 사용 */
  trimStartSec: number
  originalDurationSec: number
}> {
  const ctx = getAudioContext()
  try {
    const res = await fetch(audioUrl)
    const decoded = await ctx.decodeAudioData((await res.arrayBuffer()).slice(0))
    const { buffer: trimmed, trimStartSec } = trimBufferSilence(decoded, threshold)
    const padded = appendSilencePad(trimmed, TTS_CLIP_END_PAD_SEC * 0.5)
    const wav = audioBufferToWav(padded)
    const blob = new Blob([wav], { type: "audio/wav" })
    return {
      blobUrl: URL.createObjectURL(blob),
      durationSec: padded.duration,
      wavBlob: blob,
      trimStartSec,
      originalDurationSec: decoded.duration,
    }
  } finally {
    void ctx.close()
  }
}

/** decode 후 WAV 재인코딩 — 브라우저가 duration 메타를 짧게 읽어 말꼬리를 끊는 것 방지 */
export async function rebakeWavBlobUrl(
  input: Blob | string
): Promise<{ blobUrl: string; wavBlob: Blob; durationSec: number }> {
  const ctx = getAudioContext()
  try {
    const ab =
      typeof input === "string"
        ? await (await fetch(input)).arrayBuffer()
        : await input.arrayBuffer()
    const decoded = await ctx.decodeAudioData(ab.slice(0))
    // 전체 트랙 끝만 아주 짧게 — 장면 사이 무음을 늘리지 않음
    const padded = appendSilencePad(decoded, 0.05)
    const wav = audioBufferToWav(padded)
    const wavBlob = new Blob([wav], { type: "audio/wav" })
    return {
      blobUrl: URL.createObjectURL(wavBlob),
      wavBlob,
      durationSec: padded.duration,
    }
  } finally {
    void ctx.close()
  }
}

/** 클립 URL 끝에 무음 패딩 — 장면 단독 재생 시 말꼬리 보호 */
export async function padAudioUrlEnd(
  audioUrl: string,
  padSec: number = TTS_CLIP_END_PAD_SEC
): Promise<string> {
  const ctx = getAudioContext()
  try {
    const res = await fetch(audioUrl)
    const decoded = await ctx.decodeAudioData((await res.arrayBuffer()).slice(0))
    const padded = appendSilencePad(decoded, Math.max(0.05, padSec))
    const wav = audioBufferToWav(padded)
    return URL.createObjectURL(new Blob([wav], { type: "audio/wav" }))
  } finally {
    void ctx.close()
  }
}

/** 줄별 TTS WAV를 이어 붙임 — 장면 사이 무음 최소화, API 앞뒤 무음만 정리 */
export async function mergeAudioUrlsToWavBlobUrl(
  audioUrls: string[],
  options?: { trimSilence?: boolean; interClipPadSec?: number },
): Promise<{ blobUrl: string; wavBlob: Blob; totalDurationSec: number; lineDurationsSec: number[] }> {
  if (audioUrls.length === 0) throw new Error("합칠 오디오가 없습니다.")
  // 기본 ON: API가 붙인 앞·뒤 무음 제거 → 장면 사이 텀 제거 (말꼬리는 keepTail로 보존)
  const trim = options?.trimSilence !== false
  const interPad = options?.interClipPadSec ?? TTS_INTER_CLIP_PAD_SEC
  const ctx = getAudioContext()
  try {
    const buffers: AudioBuffer[] = []
    const lineDurationsSec: number[] = []
    for (let i = 0; i < audioUrls.length; i++) {
      const url = audioUrls[i]!
      const res = await fetch(url)
      const ab = await res.arrayBuffer()
      let decoded = await ctx.decodeAudioData(ab.slice(0))
      if (trim) decoded = trimBufferSilence(decoded).buffer
      // 장면 사이: 거의 붙임. 마지막 클립만 짧은 말꼬리/flush 패딩
      const pad =
        i < audioUrls.length - 1 ? Math.max(0, interPad) : Math.max(interPad, TTS_CLIP_END_PAD_SEC)
      if (pad > 0.001) decoded = appendSilencePad(decoded, pad)
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

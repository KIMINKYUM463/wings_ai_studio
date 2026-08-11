/** 브라우저에서 녹음 Blob → WAV (Voice Builder / 보관용) */

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = 1
  const sampleRate = buffer.sampleRate
  const samples = buffer.length
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = samples * blockAlign
  const out = new ArrayBuffer(44 + dataSize)
  const view = new DataView(out)

  writeString(view, 0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, "WAVE")
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, "data")
  view.setUint32(40, dataSize, true)

  const channel = buffer.getChannelData(0)
  let offset = 44
  for (let i = 0; i < samples; i++) {
    const s = Math.max(-1, Math.min(1, channel[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return out
}

/** MediaRecorder webm/ogg → 모노 WAV Blob */
export async function audioBlobToWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext()
  try {
    const ab = await blob.arrayBuffer()
    const decoded = await ctx.decodeAudioData(ab.slice(0))
    let mono: AudioBuffer
    if (decoded.numberOfChannels <= 1) {
      mono = decoded
    } else {
      mono = ctx.createBuffer(1, decoded.length, decoded.sampleRate)
      const out = mono.getChannelData(0)
      const ch0 = decoded.getChannelData(0)
      const ch1 = decoded.getChannelData(1)
      for (let i = 0; i < decoded.length; i++) out[i] = (ch0[i] + ch1[i]) * 0.5
    }
    return new Blob([encodeWav(mono)], { type: "audio/wav" })
  } finally {
    await ctx.close().catch(() => undefined)
  }
}

/** 한글/별칭 → Supertonic ASCII voice id */
const SUPERTONIC_VOICE_NAME_ALIASES: Record<string, string> = {
  다솜: "dasom",
  dasom: "dasom",
}

/** Voice Builder / .supertonic-3.json 파일명에서 import용 이름 추출 */
export function stripSupertonicVoiceFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/\.json$/i, "")
    .replace(/\.supertonic-3(\s*\(\d+\))?$/i, "")
    .replace(/\s*\(\d+\)$/i, "")
    .trim()
}

export function sanitizeSupertonicVoiceName(raw: string): string {
  const trimmed = raw.trim()
  const aliasHit =
    SUPERTONIC_VOICE_NAME_ALIASES[trimmed] ||
    SUPERTONIC_VOICE_NAME_ALIASES[stripSupertonicVoiceFileName(trimmed)]
  if (aliasHit) return aliasHit

  const cleaned = stripSupertonicVoiceFileName(trimmed)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48)
  return cleaned || `voice_${Date.now()}`
}

/** JSON / Voice Builder 파일인지 (확장자) */
export function isSupertonicVoiceJsonFileName(fileName: string): boolean {
  return /\.json$/i.test(fileName.trim())
}

export const SUPERTONIC_VOICE_BUILDER_URL = "https://supertonic.supertone.ai/voice-builder"

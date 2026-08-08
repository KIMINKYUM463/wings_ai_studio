/** 동물 쇼핑 스튜디오 — TTS 생성 헬퍼 (클라이언트) */

export type AnimalTtsResult = {
  audioUrl: string
  durationSec: number
}

function resolveSpeed(voiceId: string, ttsSpeed: number) {
  if (voiceId.startsWith("elevenlabs-")) {
    return Math.min(1.5, Math.max(0.8, Math.round(ttsSpeed * 10) / 10))
  }
  if (voiceId.startsWith("supertonic-")) {
    return Math.min(2, Math.max(0.7, Math.round(ttsSpeed * 100) / 100))
  }
  return Math.min(2, Math.max(0.5, Math.round(ttsSpeed * 10) / 10))
}

async function blobFromTtsResponse(data: {
  audioBase64?: string
  audioUrl?: string
  success?: boolean
  error?: string
}): Promise<Blob> {
  if (data.success === false) {
    throw new Error(data.error || "TTS 생성에 실패했습니다.")
  }
  if (data.audioBase64) {
    const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0))
    return new Blob([bytes], { type: "audio/mpeg" })
  }
  if (data.audioUrl) {
    const res = await fetch(data.audioUrl)
    return await res.blob()
  }
  throw new Error("TTS 응답에 오디오 데이터가 없습니다.")
}

function measureAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio()
    audio.preload = "metadata"
    audio.onloadedmetadata = () => {
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0)
    }
    audio.onerror = () => resolve(0)
    audio.src = url
  })
}

export async function generateAnimalTts(params: {
  script: string
  voiceId: string
  style: string
  speed: number
}): Promise<AnimalTtsResult> {
  const ttsText = params.script.trim()
  if (!ttsText) throw new Error("대본이 비어 있습니다.")

  const voiceId = params.voiceId || "elevenlabs-jB1Cifc2UQbq1gR3wnb0"
  const speed = resolveSpeed(voiceId, params.speed)
  let response: Response

  if (voiceId.startsWith("supertonic-")) {
    const id = voiceId.replace("supertonic-", "")
    const { fetchSupertonicTts } = await import("@/lib/supertonic-runtime-client")
    response = await fetchSupertonicTts({
      text: ttsText,
      voiceId: id,
      speed,
      lang: "ko",
    })
  } else if (voiceId.startsWith("supertone-")) {
    const id = voiceId.replace("supertone-", "")
    const apiKey = (localStorage.getItem("shotform_supertone_api_key") || "").trim()
    if (!apiKey) throw new Error("수퍼톤 API 키가 필요합니다. 설정에서 입력해주세요.")
    response = await fetch("/api/supertone-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: ttsText,
        voiceId: id,
        apiKey,
        style: params.style || "neutral",
        language: "ko",
        speed,
      }),
    })
  } else if (voiceId.startsWith("typecast-")) {
    const id = voiceId.replace("typecast-", "")
    const apiKey = (
      localStorage.getItem("shotform_typecast_api_key") ||
      localStorage.getItem("typecast_api_key") ||
      ""
    ).trim()
    if (!apiKey) throw new Error("타입캐스트 API 키가 필요합니다. 설정에서 입력해주세요.")
    response = await fetch("/api/typecast-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: ttsText,
        voiceId: id,
        apiKey,
        emotion: params.style || "normal",
        speed,
      }),
    })
  } else {
    const id = voiceId.replace("elevenlabs-", "")
    const apiKey = (localStorage.getItem("shotform_elevenlabs_api_key") || "").trim()
    if (!apiKey) throw new Error("ElevenLabs API 키가 필요합니다. 설정에서 입력해주세요.")
    response = await fetch("/api/elevenlabs-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: ttsText, voiceId: id, apiKey, speed }),
    })
  }

  if (!response.ok) {
    let message = "TTS 생성 실패"
    try {
      const err = await response.json()
      message = err.error || err.message || message
    } catch {
      message = (await response.text()) || message
    }
    throw new Error(message)
  }

  const data = await response.json()
  const blob = await blobFromTtsResponse(data)
  // blob: URL은 새로고침·탭 이동 후 깨져 "no supported sources"가 남 → data URL로 보관
  const audioUrl = await blobToDataUrl(blob)
  const durationSec = await measureAudioDuration(audioUrl)
  return { audioUrl, durationSec }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || "")
      if (!result.startsWith("data:")) {
        reject(new Error("오디오 data URL 변환 실패"))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error("오디오 파일을 읽지 못했습니다."))
    reader.readAsDataURL(blob)
  })
}

/** 여러 TTS URL을 하나로 이어 붙임 (미리보기용) */
export async function concatAnimalTtsUrls(
  audioUrls: string[]
): Promise<AnimalTtsResult> {
  const urls = audioUrls.filter(Boolean)
  if (urls.length === 0) throw new Error("이어 붙일 음성이 없습니다.")
  if (urls.length === 1) {
    const durationSec = await measureAudioDuration(urls[0])
    return { audioUrl: urls[0], durationSec }
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()
  const buffers: AudioBuffer[] = []
  for (const url of urls) {
    const res = await fetch(url)
    const arr = await res.arrayBuffer()
    buffers.push(await ctx.decodeAudioData(arr.slice(0)))
  }

  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0)
  const channels = Math.max(...buffers.map((b) => b.numberOfChannels))
  const sampleRate = buffers[0].sampleRate
  const merged = ctx.createBuffer(channels, totalLength, sampleRate)

  let offset = 0
  for (const buf of buffers) {
    for (let ch = 0; ch < channels; ch++) {
      const out = merged.getChannelData(ch)
      const src = buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1))
      out.set(src, offset)
    }
    offset += buf.length
  }

  // WAV encode → data URL (세션 유지)
  const wav = audioBufferToWav(merged)
  const blob = new Blob([wav], { type: "audio/wav" })
  const audioUrl = await blobToDataUrl(blob)
  await ctx.close()
  return { audioUrl, durationSec: merged.duration }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16
  const samples = buffer.length
  const blockAlign = (numChannels * bitDepth) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = samples * blockAlign
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeStr(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, "WAVE")
  writeStr(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeStr(36, "data")
  view.setUint32(40, dataSize, true)

  let offset = 44
  const channels: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch))
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return arrayBuffer
}

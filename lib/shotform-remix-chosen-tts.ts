import fs from "fs/promises"
import path from "path"
import { ADAM_SERVER_HINT, ADAM_TTS_ORIGIN, splitAdamText } from "@/lib/adam-tts"
import { concatWav } from "@/lib/adam-wav"
import { probeDuration, trimSpeechSilence } from "@/lib/wings-shopping-v2/media/ffmpeg"
import { explainTypecastApiError } from "@/lib/typecast-api-error"
import { clampTtsSpeed } from "@/lib/shotform-tts-speed"
import {
  isRetiredSupertoneVoiceId,
  parseBareVoiceId,
  RETIRED_SUPERTONE_MESSAGE,
  ttsApiKeyMissingMessage,
} from "@/lib/shotform-tts-providers"
import { getSupertonicBaseUrl } from "@/lib/supertonic-local"

export type RemixVoiceChoice = {
  voiceId: string
  style?: string
  speed?: number
  typecastApiKey?: string
  elevenlabsApiKey?: string
}

/** 편집기에서 고른 모델·목소리로 한 줄을 만들고, 그 길이를 돌려줍니다. */
export async function synthesizeChosenLine(
  choice: RemixVoiceChoice,
  text: string,
  outBase: string
): Promise<{ file: string; duration: number }> {
  const spoken = text.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim()
  if (!spoken) throw new Error("읽을 문장이 없습니다.")
  const fullId = choice.voiceId.trim()
  if (!fullId) throw new Error("목소리를 골라 주세요.")
  if (isRetiredSupertoneVoiceId(fullId)) throw new Error(RETIRED_SUPERTONE_MESSAGE)
  const parsed = parseBareVoiceId(fullId)
  if (!parsed) throw new Error("목소리 형식이 올바르지 않습니다. 모델과 목소리를 다시 골라 주세요.")
  const speed = clampTtsSpeed(choice.speed ?? 1)

  await fs.mkdir(path.dirname(outBase), { recursive: true })
  const file =
    parsed.provider === "elevenlabs" ? `${outBase}.mp3` : `${outBase}.wav`

  if (parsed.provider === "typecast") {
    await writeTypecast(spoken, parsed.bareId, choice.style, speed, choice.typecastApiKey, file)
  } else if (parsed.provider === "elevenlabs") {
    await writeElevenlabs(spoken, parsed.bareId, speed, choice.elevenlabsApiKey, file)
  } else if (parsed.provider === "supertonic") {
    await writeSupertonic(spoken, parsed.bareId, speed, file)
  } else {
    await writeAdam(spoken, speed, file)
  }

  const trimmedDuration = await trimSpeechSilence(file, file).catch(() => probeDuration(file))
  return { file, duration: trimmedDuration }
}

async function writeTypecast(
  text: string,
  voiceId: string,
  style: string | undefined,
  speed: number,
  apiKey: string | undefined,
  file: string
): Promise<void> {
  const key = apiKey?.trim()
  if (!key) throw new Error(ttsApiKeyMissingMessage("typecast"))
  const emotion = style?.trim() || "smart"
  const presetEmotions = new Set(["normal", "happy", "sad", "angry", "whisper", "toneup", "tonedown"])
  const prompt =
    emotion === "smart"
      ? { emotion_type: "smart" }
      : presetEmotions.has(emotion)
        ? { emotion_type: "preset", emotion_preset: emotion }
        : { emotion_type: "smart" }
  const response = await fetch("https://api.typecast.ai/v1/text-to-speech", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model: "ssfm-v30",
      voice_id: voiceId,
      prompt,
      output: { audio_format: "wav", audio_tempo: speed },
    }),
  })
  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    let message = errText.slice(0, 400)
    try {
      const body = JSON.parse(errText) as { message?: string; error?: string }
      message = body.message || body.error || message
    } catch {
      /* 원문 유지 */
    }
    throw new Error(explainTypecastApiError(response.status, message))
  }
  await fs.writeFile(file, Buffer.from(await response.arrayBuffer()))
}

async function writeElevenlabs(
  text: string,
  voiceId: string,
  speed: number,
  apiKey: string | undefined,
  file: string
): Promise<void> {
  const key = apiKey?.trim()
  if (!key) throw new Error(ttsApiKeyMissingMessage("elevenlabs"))
  const tempo = Math.min(1.5, Math.max(0.8, speed))
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": key,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.7, similarity_boost: 0.75, speed: tempo },
    }),
  })
  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    throw new Error(`ElevenLabs TTS 실패 (${response.status}): ${errText.slice(0, 240)}`)
  }
  await fs.writeFile(file, Buffer.from(await response.arrayBuffer()))
}

async function writeSupertonic(text: string, voiceId: string, speed: number, file: string): Promise<void> {
  const base = getSupertonicBaseUrl()
  let response: Response
  try {
    response = await fetch(`${base}/v1/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/wav" },
      body: JSON.stringify({
        text,
        voice: voiceId,
        lang: "ko",
        speed: Math.min(2, Math.max(0.7, speed)),
        total_steps: 8,
        response_format: "wav",
      }),
      signal: AbortSignal.timeout(180000),
    })
  } catch {
    throw new Error(ttsApiKeyMissingMessage("supertonic"))
  }
  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    throw new Error(errText.slice(0, 240) || `수퍼토닉3 TTS 실패 (${response.status})`)
  }
  await fs.writeFile(file, Buffer.from(await response.arrayBuffer()))
}

async function writeAdam(text: string, speed: number, file: string): Promise<void> {
  const chunks = splitAdamText(text).slice(0, 40)
  if (!chunks.length) throw new Error("읽을 문장이 없습니다.")
  const wavs: Buffer[] = []
  for (const chunk of chunks) {
    let response: Response
    try {
      response = await fetch(`${ADAM_TTS_ORIGIN}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk, tempo: speed, lang: "Korean" }),
        signal: AbortSignal.timeout(180000),
      })
    } catch {
      throw new Error(ADAM_SERVER_HINT)
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      throw new Error(detail.slice(0, 240) || `아담 TTS 실패 (${response.status})`)
    }
    wavs.push(Buffer.from(await response.arrayBuffer()))
  }
  await fs.writeFile(file, concatWav(wavs))
}

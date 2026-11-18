/** 장면별 TTS → 하나의 WAV + 장면 시간표 (브라우저 전용) */

import { mergeAudioUrlsToWavBlobUrl, mixTtsWithBgmWavBlobUrl } from "@/lib/shotform-factory-line-tts"
import { voicePreviewBgmSrc } from "@/lib/shotform-factory-voice-preview-bgm"
import { synthesizeTtsLine } from "@/lib/shotform-tts-providers"
import { TRAVEL_MIN_SCENE_SEC } from "@/lib/travel-shorts/render"
import {
  travelScriptKey,
  type TravelAudio,
  type TravelScriptVariant,
  type TravelVoiceSettings,
} from "@/lib/travel-shorts/types"

export const revokeIfBlob = (url: string) => {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url)
}

export async function buildTravelAudio(
  variant: TravelScriptVariant,
  voice: TravelVoiceSettings,
  onStatus?: (label: string) => void
): Promise<TravelAudio> {
  const lineUrls: string[] = []
  try {
    for (let i = 0; i < variant.scenes.length; i += 1) {
      onStatus?.(`장면 ${i + 1}/${variant.scenes.length} 음성 만드는 중`)
      const text = variant.scenes[i]!.line.replace(/\s*\n\s*/g, " ").trim()
      lineUrls.push(await synthesizeTtsLine({ fullVoiceId: voice.voiceId, text, speed: voice.speed }))
    }
    onStatus?.("하나로 합치는 중")
    const merged = await mergeAudioUrlsToWavBlobUrl(lineUrls, {
      interClipPadSec: 0.12,
      minClipSec: TRAVEL_MIN_SCENE_SEC,
    })
    let blob = merged.wavBlob
    const bgmSrc = voicePreviewBgmSrc(voice.bgmId)
    if (bgmSrc) {
      onStatus?.("배경음 섞는 중")
      const mixed = await mixTtsWithBgmWavBlobUrl(merged.blobUrl, bgmSrc, voice.bgmVolume)
      blob = mixed.wavBlob
      revokeIfBlob(mixed.blobUrl)
    }
    revokeIfBlob(merged.blobUrl)

    let t = 0
    const sceneTimes = merged.lineDurationsSec.map((d) => {
      const span: [number, number] = [t, t + d]
      t += d
      return span
    })
    return { blob, sceneTimes, durationSec: t, scriptKey: travelScriptKey(variant) }
  } finally {
    lineUrls.forEach(revokeIfBlob)
  }
}

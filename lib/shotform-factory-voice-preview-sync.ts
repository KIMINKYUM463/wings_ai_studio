/** 음성 생성(5단계): TTS·영상 비례 동기에 맞춰 한 줄 자막만 고르기 */

export type VoicePreviewSceneSync = {
  id: number
  v: number
  a: number
  text: string
}

/** 문장을 자막 한 줄 단위로 쪼갬(구두점 + 긴 덩어리는 글자 수로 분할) */
export function splitVoicePreviewPhrases(text: string, maxChunk = 12): string[] {
  const raw = text.replace(/\n/g, " ").trim()
  if (!raw) return []
  const byPunct = raw.split(/(?<=[,.!?。…,，、])\s+/).map((x) => x.trim()).filter(Boolean)
  const chunks = byPunct.length > 0 ? byPunct : [raw]
  const out: string[] = []
  for (const chunk of chunks) {
    if (chunk.length <= maxChunk) {
      out.push(chunk)
      continue
    }
    for (let i = 0; i < chunk.length; i += maxChunk) {
      const s = chunk.slice(i, i + maxChunk).trim()
      if (s) out.push(s)
    }
  }
  return out.length > 0 ? out : [raw]
}

function sceneAudioWeightTotal(scenes: readonly { a: number }[]): number {
  return scenes.reduce((s, x) => s + x.a, 0)
}

/**
 * 영상 타임라인 기준 시각(초) → 같은 비율로 스트레치된 오디오 시각(초).
 * `audioDuration`이 실제 TTS 길이일 때 영상과 동기됩니다.
 */
export function voicePreviewAudioTimeFromVideoTime(
  videoTimeSec: number,
  videoDurationSec: number,
  audioDurationSec: number,
): number {
  const vDur = videoDurationSec > 0 ? videoDurationSec : 1
  const aDur = audioDurationSec > 0 ? audioDurationSec : 1
  const r = Math.min(1, Math.max(0, videoTimeSec / vDur))
  return r * aDur
}

/**
 * 오디오 재생 위치(초)에 해당하는 **한 줄** 자막.
 * 장면 구간은 데모 `scenes[].a` 가중치로 실제 `audioDuration`에 선형 매핑합니다.
 */
export function voicePreviewSubtitleLineAtAudioTime(
  scenes: readonly VoicePreviewSceneSync[],
  sceneText: (sceneIndex: number) => string,
  audioTimeSec: number,
  audioDurationSec: number,
): string {
  if (scenes.length === 0) return ""
  const totalA = sceneAudioWeightTotal(scenes)
  if (totalA <= 0 || audioDurationSec <= 0) return ""
  const u = Math.min(Math.max(0, audioTimeSec / audioDurationSec), 1 - 1e-9) * totalA
  let acc = 0
  for (let i = 0; i < scenes.length; i++) {
    const ai = scenes[i]!.a
    const end = acc + ai
    const last = i === scenes.length - 1
    if (u < end - 1e-9 || last) {
      const span = Math.max(ai, 1e-6)
      const local = Math.min(1 - 1e-6, Math.max(0, (u - acc) / span))
      const phrases = splitVoicePreviewPhrases(sceneText(i))
      if (phrases.length === 0) return ""
      const idx = Math.min(phrases.length - 1, Math.floor(local * phrases.length))
      return phrases[idx]!
    }
    acc = end
  }
  return ""
}

function phraseCharWeight(text: string): number {
  const t = text.replace(/\s/g, "")
  return Math.max(1, t.length)
}

/**
 * 단일 TTS 스트림 기준: 나레이션 전체를 `splitVoicePreviewPhrases`로 펼친 뒤,
 * **글자 수 비례**로 재생 비율(`audioTime / audioDuration`)에 해당하는 한 줄만 반환.
 * (실제 발화 타이밍에 가깝게 맞추기 위해 데모 장면별 `a` 가중치는 쓰지 않음)
 */
export function voicePreviewSubtitleAtNarrationAudioTime(
  segments: readonly { text: string }[],
  sceneText: (sceneIndex: number) => string,
  audioTimeSec: number,
  audioDurationSec: number,
): string {
  if (segments.length === 0 || audioDurationSec <= 0) return ""
  const phrases: string[] = []
  for (let i = 0; i < segments.length; i++) {
    const parts = splitVoicePreviewPhrases(sceneText(i))
    for (const p of parts) phrases.push(p)
  }
  if (phrases.length === 0) return ""
  const weights = phrases.map((p) => phraseCharWeight(p))
  const totalW = weights.reduce((s, w) => s + w, 0)
  if (totalW <= 0) return phrases[0]!
  const p = Math.min(1 - 1e-9, Math.max(0, audioTimeSec / audioDurationSec))
  const target = p * totalW
  let acc = 0
  for (let i = 0; i < phrases.length; i++) {
    const w = weights[i]!
    if (target < acc + w - 1e-9 || i === phrases.length - 1) return phrases[i]!
    acc += w
  }
  return phrases[phrases.length - 1]!
}

/** 0-based 장면 인덱스 — 나레이션 구간별 글자 수 비례 */
export function narrationVoicePreviewSceneIndexAtAudioTime(
  segments: readonly { text: string }[],
  sceneText: (sceneIndex: number) => string,
  audioTimeSec: number,
  audioDurationSec: number,
): number {
  if (segments.length === 0 || audioDurationSec <= 0) return 0
  const segWeights = segments.map((_, i) => {
    const parts = splitVoicePreviewPhrases(sceneText(i))
    let w = 0
    for (const t of parts) w += phraseCharWeight(t)
    return Math.max(1, w)
  })
  const total = segWeights.reduce((s, x) => s + x, 0)
  const u = Math.min(Math.max(0, audioTimeSec / audioDurationSec), 1 - 1e-9) * total
  let acc = 0
  for (let i = 0; i < segWeights.length; i++) {
    const sw = segWeights[i]!
    if (u < acc + sw - 1e-9) return i
    acc += sw
  }
  return Math.max(0, segWeights.length - 1)
}

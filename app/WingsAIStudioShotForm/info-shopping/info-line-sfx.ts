/** 한 줄 등장 시 '뽁' 짧은 팝 효과음 (Web Audio) */

function makePopBuffer(ctx: AudioContext, durationSec = 0.09): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = Math.max(1, Math.floor(sampleRate * durationSec))
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate
    const env = Math.exp(-t * 55)
    // 짧은 하강 톤 + 살짝 노이즈 = '뽁'
    const tone = Math.sin(2 * Math.PI * (920 - t * 5200) * t)
    const noise = (Math.random() * 2 - 1) * 0.35
    data[i] = (tone * 0.55 + noise * 0.2) * env * 0.35
  }
  return buffer
}

/** 미리보기용 — fire-and-forget */
export function playInfoLinePop(volume = 0.16): void {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = makePopBuffer(ctx)
    gain.gain.value = volume
    source.connect(gain)
    gain.connect(ctx.destination)
    source.onended = () => {
      void ctx.close().catch(() => undefined)
    }
    source.start()
  } catch {
    // 브라우저 정책 등으로 실패해도 재생은 계속
  }
}

/** WebM 내보내기용 — MediaStream에 믹스 */
export function playInfoLinePopInto(
  audioCtx: AudioContext,
  dest: MediaStreamAudioDestinationNode,
  volume = 0.16
): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (audioCtx.state === "suspended") void audioCtx.resume()
      const source = audioCtx.createBufferSource()
      const gain = audioCtx.createGain()
      source.buffer = makePopBuffer(audioCtx)
      gain.gain.value = volume
      source.connect(gain)
      gain.connect(dest)
      gain.connect(audioCtx.destination)
      source.onended = () => resolve()
      source.start()
      // 안전 타임아웃
      window.setTimeout(() => resolve(), 120)
    } catch {
      resolve()
    }
  })
}

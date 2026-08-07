/**
 * 카드뉴스 TTS — 말꼬리 끊김 방지용 오디오 유틸
 * HTMLAudioElement는 duration 메타가 짧으면 ended가 먼저 떠서 말이 잘림.
 * → 항상 decode 후 AudioBufferSource로 전체 길이를 재생합니다.
 */

import { padAudioUrlEnd } from "@/lib/shotform-factory-line-tts"

/** 말꼬리 보호용 끝 무음 — 너무 길면 장면 사이 공백처럼 들림 */
const END_PAD_SEC = 0.08
/**
 * 이어 듣기/미리보기에서 다음 장면으로 바로 넘길 때
 * 끝 패딩·잔여 무음을 건너뛰는 길이(초)
 */
export const INFO_TTS_CHAIN_TAIL_SKIP_SEC = 0.1

function getAudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  )
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("오디오 변환 실패"))
    reader.readAsDataURL(blob)
  })
}

/** TTS 원본 → 끝 패딩 + data URL (저장·재생용) */
export async function hardenInfoTtsAudioUrl(rawUrl: string): Promise<string> {
  const paddedBlobUrl = await padAudioUrlEnd(rawUrl, END_PAD_SEC)
  try {
    const blob = await (await fetch(paddedBlobUrl)).blob()
    return (await blobToDataUrl(blob)) || rawUrl
  } finally {
    URL.revokeObjectURL(paddedBlobUrl)
  }
}

/**
 * 짧은 연결 문장을 앞 문장과 묶어 Supertonic이 말꼬리를 잘리지 않게 함.
 * 예: ["아침마다 …이,", "생각나는데"] → 한 번에 TTS
 */
export function groupInfoTtsLines(
  lines: string[]
): Array<{ text: string; lineIndexes: number[] }> {
  const groups: Array<{ text: string; lineIndexes: number[] }> = []
  let i = 0
  while (i < lines.length) {
    const indexes = [i]
    let text = lines[i]!.trim()
    while (i + 1 < lines.length) {
      const next = lines[i + 1]!.trim()
      const prevBare = text.replace(/[,，.。?？!！\s]+$/u, "")
      const nextBare = next.replace(/[,，.。?？!！\s]+$/u, "")
      const prevConnective = /(?:는데|한데|하고|지만|며|서|고|이)$/u.test(prevBare)
      const nextShort = nextBare.length > 0 && nextBare.length <= 14
      const nextConnective = /(?:는데|한데|하고|지만|며|서|고)$/u.test(nextBare)
      // 짧은 조각·연결어미는 한 호흡으로 합침
      if (nextShort || nextConnective || prevConnective) {
        text = `${text.replace(/[,，]\s*$/u, "")} ${next}`.replace(/\s+/g, " ").trim()
        i += 1
        indexes.push(i)
        continue
      }
      break
    }
    // 그룹 끝에 종결 부호가 없으면 마침표 — 엔진이 문장 끝내도록
    if (!/[.。?？!！]$/u.test(text)) {
      text = `${text}.`
    }
    groups.push({ text, lineIndexes: indexes })
    i += 1
  }
  return groups
}

export type InfoTtsPlayHandle = {
  stop: () => void
  done: Promise<void>
}

/**
 * 디코드된 PCM 전체를 AudioBufferSource로 재생.
 * onTick(localSec)은 재생 중 대략적 위치.
 */
export function playInfoTtsBuffer(
  url: string,
  options?: {
    isCancelled?: () => boolean
    onTick?: (localSec: number, durationSec: number) => void
    /**
     * 끝에서 이만큼 남기면 즉시 다음으로 (장면 사이 무음 패딩 스킵).
     * 단독 들어보기에서는 0 권장.
     */
    skipTailSec?: number
  }
): InfoTtsPlayHandle {
  let stopped = false
  let ctx: AudioContext | null = null
  let source: AudioBufferSourceNode | null = null
  let raf = 0
  let startedAt = 0
  let durationSec = 0

  const stop = () => {
    stopped = true
    if (raf) cancelAnimationFrame(raf)
    try {
      source?.stop()
    } catch {
      /* already stopped */
    }
    source = null
    if (ctx) {
      void ctx.close().catch(() => undefined)
      ctx = null
    }
  }

  const done = (async () => {
    const Ctor = getAudioContextCtor()
    if (!Ctor) throw new Error("AudioContext를 사용할 수 없습니다.")
    if (options?.isCancelled?.()) return

    ctx = new Ctor()
    if (ctx.state === "suspended") await ctx.resume().catch(() => undefined)

    const ab = await (await fetch(url)).arrayBuffer()
    if (stopped || options?.isCancelled?.()) {
      stop()
      return
    }
    const decoded = await ctx.decodeAudioData(ab.slice(0))
    durationSec = decoded.duration
    const skipTail = Math.max(0, options?.skipTailSec ?? 0)
    // 말 자체는 남기고, 끝 패딩·잔여 무음만 건너뜀
    const playUntil = Math.max(0.08, durationSec - skipTail)
    source = ctx.createBufferSource()
    source.buffer = decoded
    source.connect(ctx.destination)

    await new Promise<void>((resolve, reject) => {
      if (stopped || options?.isCancelled?.()) {
        resolve()
        return
      }
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        if (raf) cancelAnimationFrame(raf)
        try {
          source?.stop()
        } catch {
          /* noop */
        }
        resolve()
      }
      source!.onended = () => finish()
      startedAt = ctx!.currentTime
      try {
        source!.start(0)
      } catch (e) {
        reject(e instanceof Error ? e : new Error("재생 실패"))
        return
      }

      const tick = () => {
        if (settled || stopped || options?.isCancelled?.()) {
          finish()
          stop()
          return
        }
        const local = Math.min(durationSec, Math.max(0, ctx!.currentTime - startedAt))
        // UI 진행률은 playUntil 기준으로 (다음 장면 타이밍과 맞춤)
        options?.onTick?.(Math.min(local, playUntil), playUntil)
        if (local >= playUntil - 0.01) {
          finish()
          return
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      window.setTimeout(finish, Math.min(60000, playUntil * 1000 + 80))
    })

    stop()
  })()

  return { stop, done }
}

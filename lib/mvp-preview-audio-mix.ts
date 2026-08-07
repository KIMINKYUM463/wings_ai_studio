import type { MvpBgmClip, MvpEffectClip } from "@/lib/mvp-studio-types"

const DEFAULT_SOURCE_DURATION_SEC = 1.2

/** 상대경로(/story-shopping-sfx/...) vs 절대 URL 비교용 */
function resolveAudioSrc(src: string): string {
  if (!src) return ""
  if (typeof window === "undefined") return src
  try {
    return new URL(src, window.location.href).href
  } catch {
    return src
  }
}

/** metadata 로드 후 sourceOffset 위치로 seek — 로드 전 seek는 무시되어 앞 무음만 재생됨 */
function seekAudioWhenReady(
  audio: HTMLAudioElement,
  timeSec: number,
  thenPlay: boolean
): void {
  const apply = () => {
    const target = Math.max(0, timeSec)
    try {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = Math.min(target, Math.max(0, audio.duration - 0.02))
      } else {
        audio.currentTime = target
      }
    } catch {
      /* ignore seek errors before ready */
    }
    if (thenPlay) void audio.play().catch(() => {})
  }

  if (audio.readyState >= 1 && Number.isFinite(audio.duration) && audio.duration > 0) {
    apply()
    return
  }

  const onReady = () => {
    audio.removeEventListener("loadedmetadata", onReady)
    audio.removeEventListener("canplay", onReady)
    apply()
  }
  audio.addEventListener("loadedmetadata", onReady)
  audio.addEventListener("canplay", onReady)
  try {
    audio.load()
  } catch {
    /* ignore */
  }
}

/** 배경음 UI 0–100 → gain */
export function mvpBgmGainFromPct(volumePct: number): number {
  return Math.min(1, Math.max(0, (volumePct / 100) * 0.38))
}

export async function probeAudioDurationSec(src: string): Promise<number> {
  if (!src?.trim()) return DEFAULT_SOURCE_DURATION_SEC
  return new Promise((resolve) => {
    const a = new Audio()
    a.preload = "metadata"
    a.onloadedmetadata = () => {
      const d = a.duration
      resolve(Number.isFinite(d) && d > 0.05 ? Math.min(120, d) : DEFAULT_SOURCE_DURATION_SEC)
    }
    a.onerror = () => resolve(DEFAULT_SOURCE_DURATION_SEC)
    a.src = src
  })
}

function inClipRegion(playhead: number, clip: MvpBgmClip): boolean {
  return playhead >= clip.startSec - 0.02 && playhead < clip.endSec - 0.01
}

/** 타임라인 클립 시작 기준 — 원본 파일은 0초부터 순서대로 재생 */
function timelineOffsetSec(playhead: number, clip: MvpBgmClip): number {
  return Math.max(0, playhead - clip.startSec)
}

/** seek·구간 진입 시 한 번만 설정할 소스 위치 (루프 BGM은 원본 처음부터 이어짐) */
function sourceTimeForTimeline(playhead: number, clip: MvpBgmClip): number {
  const offset = timelineOffsetSec(playhead, clip)
  const dur = Math.max(0.05, clip.sourceDurationSec)
  return offset % dur
}

function shouldAudibleAt(playhead: number, clip: MvpBgmClip): boolean {
  return inClipRegion(playhead, clip)
}

/** 프리뷰 재생 — 구간별 배경음 클립 (자연 재생, 매 프레임 seek 없음) */
export class MvpPreviewAudioLayers {
  private byId = new Map<string, HTMLAudioElement>()
  private clips: MvpBgmClip[] = []
  /** 구간 안에서 이미 재생 중이면 currentTime을 건드리지 않음 */
  private armed = new Map<string, boolean>()
  private effects: MvpPreviewEffectLayers | null = null

  updateConfig(clips: readonly MvpBgmClip[]) {
    const prev = new Map(this.byId)
    this.byId.clear()
    this.armed.clear()
    this.clips = clips.map((c) => ({ ...c }))

    for (const clip of this.clips) {
      let el = prev.get(clip.id)
      if (!el || el.src !== clip.src) {
        el?.pause()
        el = new Audio(clip.src)
        el.preload = "auto"
      }
      el.loop = true
      el.volume = mvpBgmGainFromPct(clip.volumePct)
      this.byId.set(clip.id, el)
    }

    for (const [id, el] of prev) {
      if (!this.byId.has(id)) {
        el.pause()
        el.src = ""
      }
    }
  }

  updateEffects(clips: readonly MvpEffectClip[]) {
    this.effects ||= new MvpPreviewEffectLayers()
    this.effects.updateConfig(clips)
  }

  onSeek(playhead: number) {
    this.effects?.onSeek(playhead)
    for (const clip of this.clips) {
      const el = this.byId.get(clip.id)
      if (!el) continue
      el.pause()
      this.armed.set(clip.id, false)
      if (shouldAudibleAt(playhead, clip)) {
        el.currentTime = sourceTimeForTimeline(playhead, clip)
      }
    }
  }

  sync(playhead: number, playing: boolean) {
    this.effects?.sync(playhead, playing)
    for (const clip of this.clips) {
      const el = this.byId.get(clip.id)
      if (!el) continue
      const audible = playing && shouldAudibleAt(playhead, clip)
      if (!audible) {
        if (!el.paused) el.pause()
        this.armed.set(clip.id, false)
        continue
      }
      if (!this.armed.get(clip.id) || el.paused) {
        el.currentTime = sourceTimeForTimeline(playhead, clip)
        this.armed.set(clip.id, true)
        void el.play().catch(() => {})
      }
    }
  }

  stop() {
    this.effects?.stop()
    for (const [id, el] of this.byId) {
      el.pause()
      this.armed.set(id, false)
    }
  }

  dispose() {
    this.effects?.dispose()
    this.effects = null
    this.stop()
    for (const el of this.byId.values()) {
      el.pause()
      el.src = ""
    }
    this.byId.clear()
    this.clips = []
    this.armed.clear()
  }
}

function effectAudibleAt(playhead: number, clip: MvpEffectClip): boolean {
  return (
    playhead >= clip.startSec - 0.02 &&
    playhead < clip.startSec + clip.durationSec - 0.01
  )
}

function effectSourceTime(playhead: number, clip: MvpEffectClip): number {
  return Math.max(
    clip.sourceOffsetSec,
    clip.sourceOffsetSec + Math.max(0, playhead - clip.startSec)
  )
}

/** 클립 끝에서 소리가 잘리지 않게 페이드아웃 (초) */
export const MVP_EFFECT_FADE_OUT_SEC = 0.28

function effectVolumeAtPlayhead(playhead: number, clip: MvpEffectClip): number {
  const base = Math.min(1, Math.max(0, clip.volumePct / 100))
  const elapsed = playhead - clip.startSec
  if (elapsed < 0) return 0
  const remaining = clip.durationSec - elapsed
  if (remaining <= 0) return 0
  // 짧은 클립은 페이드가 전체를 덮지 않도록 길이의 35%로 제한
  const fadeSec = Math.min(MVP_EFFECT_FADE_OUT_SEC, Math.max(0.04, clip.durationSec * 0.35))
  if (remaining >= fadeSec) return base
  return base * Math.max(0, remaining / fadeSec)
}

/** 짧은 효과음을 타임라인 구간에서 한 번만 재생합니다. */
export class MvpPreviewEffectLayers {
  private byId = new Map<string, HTMLAudioElement>()
  private clips: MvpEffectClip[] = []
  private armed = new Map<string, boolean>()

  updateConfig(clips: readonly MvpEffectClip[]) {
    const previous = new Map(this.byId)
    const nextIds = new Set(clips.map((c) => c.id))
    this.clips = clips.map((clip) => ({ ...clip }))
    for (const clip of this.clips) {
      let audio = previous.get(clip.id)
      const resolved = resolveAudioSrc(clip.src)
      if (!audio || resolveAudioSrc(audio.src) !== resolved) {
        audio?.pause()
        audio = new Audio(clip.src)
        audio.preload = "auto"
        this.armed.set(clip.id, false)
      }
      audio.loop = false
      audio.volume = Math.min(1, Math.max(0, clip.volumePct / 100))
      this.byId.set(clip.id, audio)
    }
    for (const [id, audio] of previous) {
      if (!nextIds.has(id)) {
        audio.pause()
        audio.src = ""
        this.byId.delete(id)
        this.armed.delete(id)
      }
    }
  }

  onSeek(playhead: number) {
    for (const clip of this.clips) {
      const audio = this.byId.get(clip.id)
      if (!audio) continue
      audio.pause()
      this.armed.set(clip.id, false)
      if (effectAudibleAt(playhead, clip)) {
        seekAudioWhenReady(audio, effectSourceTime(playhead, clip), false)
      }
    }
  }

  sync(playhead: number, playing: boolean) {
    for (const clip of this.clips) {
      const audio = this.byId.get(clip.id)
      if (!audio) continue
      const audible = playing && effectAudibleAt(playhead, clip)
      if (!audible) {
        if (!audio.paused) audio.pause()
        this.armed.set(clip.id, false)
        continue
      }
      audio.volume = effectVolumeAtPlayhead(playhead, clip)
      if (!this.armed.get(clip.id) || audio.paused) {
        this.armed.set(clip.id, true)
        // 앞 무음 스킵(sourceOffset) — metadata 준비 후에야 seek가 먹음
        seekAudioWhenReady(audio, effectSourceTime(playhead, clip), true)
      }
    }
  }

  stop() {
    for (const audio of this.byId.values()) audio.pause()
    this.armed.clear()
  }

  dispose() {
    this.stop()
    for (const audio of this.byId.values()) audio.src = ""
    this.byId.clear()
    this.clips = []
  }
}

type RenderClipNode = {
  clip: MvpBgmClip
  audio: HTMLAudioElement
  armed: boolean
}

function waitAudioReady(el: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      el.removeEventListener("canplaythrough", done)
      el.removeEventListener("error", onErr)
      resolve()
    }
    const onErr = () => {
      el.removeEventListener("canplaythrough", done)
      el.removeEventListener("error", onErr)
      reject(new Error("audio load failed"))
    }
    if (el.readyState >= 3) {
      resolve()
      return
    }
    el.addEventListener("canplaythrough", done)
    el.addEventListener("error", onErr)
    el.load()
  })
}

/** 최종 MP4 렌더 — 구간별 배경음 클립 믹스 */
export async function setupMvpRenderAudioLayers(
  audioContext: AudioContext,
  destination: MediaStreamAudioDestinationNode,
  opts: {
    bgmClips: readonly MvpBgmClip[]
    effectClips?: readonly MvpEffectClip[]
  }
): Promise<{
  clipNodes: RenderClipNode[]
  syncLayers: (videoT: number, playing: boolean) => void
  cleanup: () => void
}> {
  const disconnects: Array<() => void> = []
  const clipNodes: RenderClipNode[] = []

  for (const clip of opts.bgmClips) {
    const el = new Audio(clip.src)
    el.loop = true
    el.crossOrigin = "anonymous"
    el.preload = "auto"
    await waitAudioReady(el).catch(() => {})
    try {
      const src = audioContext.createMediaElementSource(el)
      const gain = audioContext.createGain()
      gain.gain.value = mvpBgmGainFromPct(clip.volumePct)
      src.connect(gain)
      gain.connect(destination)
      disconnects.push(() => {
        try {
          src.disconnect()
          gain.disconnect()
        } catch {
          /* noop */
        }
      })
      clipNodes.push({ clip, audio: el, armed: false })
    } catch {
      el.pause()
      el.src = ""
    }
  }

  const effectNodes: Array<{
    clip: MvpEffectClip
    audio: HTMLAudioElement
    gain: GainNode
    armed: boolean
  }> = []
  for (const clip of opts.effectClips ?? []) {
    const audio = new Audio(clip.src)
    audio.loop = false
    audio.crossOrigin = "anonymous"
    audio.preload = "auto"
    await waitAudioReady(audio).catch(() => {})
    try {
      const src = audioContext.createMediaElementSource(audio)
      const gain = audioContext.createGain()
      gain.gain.value = Math.min(1, Math.max(0, clip.volumePct / 100))
      src.connect(gain)
      gain.connect(destination)
      disconnects.push(() => {
        try {
          src.disconnect()
          gain.disconnect()
        } catch {
          /* noop */
        }
      })
      effectNodes.push({ clip, audio, gain, armed: false })
    } catch {
      audio.pause()
      audio.src = ""
    }
  }

  return {
    clipNodes,
    syncLayers(videoT, playing) {
      for (const node of clipNodes) {
        const { clip, audio } = node
        const audible = playing && shouldAudibleAt(videoT, clip)
        if (!audible) {
          if (!audio.paused) audio.pause()
          node.armed = false
          continue
        }
        if (!node.armed || audio.paused) {
          audio.currentTime = sourceTimeForTimeline(videoT, clip)
          node.armed = true
          void audio.play().catch(() => {})
        }
      }
      for (const node of effectNodes) {
        const { clip, audio, gain } = node
        const audible = playing && effectAudibleAt(videoT, clip)
        if (!audible) {
          if (!audio.paused) audio.pause()
          node.armed = false
          continue
        }
        gain.gain.value = effectVolumeAtPlayhead(videoT, clip)
        if (!node.armed || audio.paused) {
          node.armed = true
          seekAudioWhenReady(audio, effectSourceTime(videoT, clip), true)
        }
      }
    },
    cleanup() {
      for (const n of clipNodes) {
        n.audio.pause()
        n.audio.src = ""
      }
      for (const node of effectNodes) {
        node.audio.pause()
        node.audio.src = ""
      }
      for (const d of disconnects) d()
    },
  }
}

import type { MvpBgmClip } from "@/lib/mvp-studio-types"

const DEFAULT_SOURCE_DURATION_SEC = 1.2

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

  onSeek(playhead: number) {
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
    for (const [id, el] of this.byId) {
      el.pause()
      this.armed.set(id, false)
    }
  }

  dispose() {
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
  opts: { bgmClips: readonly MvpBgmClip[] }
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
    },
    cleanup() {
      for (const n of clipNodes) {
        n.audio.pause()
        n.audio.src = ""
      }
      for (const d of disconnects) d()
    },
  }
}

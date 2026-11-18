/**
 * 리믹스 자동 연출 — 컷 전환 효과·장면 카메라 모션·전환 효과음·배경음악.
 * 미리보기(CSS)와 최종 렌더(canvas)가 같은 프레임 값을 쓰도록 순수 함수로 계산한다.
 * 시간 축은 TTS 음성 시간(voiceLineCues) 기준.
 */

import { voiceLineCueAtTime, type VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import { audioRangeForSceneIndex } from "@/lib/shotform-mvp-preview-sync"
import { STORY_SHOPPING_SFX_CATALOG } from "@/lib/story-shopping-sfx-catalog"
import { mvpAudioCatalogItem } from "@/lib/mvp-studio-audio-catalog"
import { VOICE_PREVIEW_BGM_OPTIONS } from "@/lib/shotform-factory-voice-preview-bgm"
import type { MvpBgmClip, MvpEffectClip } from "@/lib/mvp-studio-types"

export type MvpAutoFxSettings = {
  /** 컷 전환 효과 (줌 펀치·휙·플래시·흔들림) */
  transitions: boolean
  /** 장면마다 천천히 확대·축소·좌우 이동 */
  motion: boolean
  /** 컷 전환 순간 효과음 */
  transitionSfx: boolean
  /** 배경음악 자동 깔기 */
  bgm: boolean
}

export const DEFAULT_MVP_AUTO_FX: MvpAutoFxSettings = {
  transitions: true,
  motion: true,
  transitionSfx: true,
  bgm: true,
}

export function normalizeMvpAutoFx(raw?: Partial<MvpAutoFxSettings> | null): MvpAutoFxSettings {
  return { ...DEFAULT_MVP_AUTO_FX, ...(raw ?? {}) }
}

export type MvpTransitionKind = "zoom-punch" | "whip-left" | "flash" | "whip-right" | "shake"

/** 같은 전환이 연달아 나오지 않게 순환 */
const TRANSITION_CYCLE: readonly MvpTransitionKind[] = [
  "zoom-punch",
  "whip-left",
  "flash",
  "whip-right",
  "zoom-punch",
  "shake",
]

/** 장면 k(≥1) 시작 컷의 전환 종류. 첫 장면은 전환 없음 */
export function mvpTransitionKindForScene(sceneIndex: number): MvpTransitionKind | null {
  return sceneIndex <= 0 ? null : TRANSITION_CYCLE[(sceneIndex - 1) % TRANSITION_CYCLE.length]!
}

export const MVP_TRANSITION_SEC = 0.32
const FLASH_SEC = 0.2

type CameraMotion = "push-in" | "pan-left" | "push-out" | "pan-right"
const MOTION_CYCLE: readonly CameraMotion[] = ["push-in", "pan-left", "push-out", "pan-right"]

/** translate는 화면 크기 대비 %, 영상 가장자리가 드러나지 않도록 이동량보다 확대를 크게 잡는다 */
export type MvpFxFrame = {
  scale: number
  offsetXPct: number
  offsetYPct: number
  rotateDeg: number
  /** 흰 플래시 불투명도 0~1 */
  flashAlpha: number
}

export const MVP_FX_IDENTITY: MvpFxFrame = { scale: 1, offsetXPct: 0, offsetYPct: 0, rotateDeg: 0, flashAlpha: 0 }

const smooth = (p: number) => p * p * (3 - 2 * p)
const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function applyCameraMotion(f: MvpFxFrame, motion: CameraMotion, progress: number): void {
  const e = smooth(clamp01(progress))
  switch (motion) {
    case "push-in":
      f.scale *= 1 + 0.07 * e
      break
    case "push-out":
      f.scale *= 1.07 - 0.07 * e
      break
    case "pan-left":
      f.scale *= 1.08
      f.offsetXPct += 2.5 - 5 * e
      break
    case "pan-right":
      f.scale *= 1.08
      f.offsetXPct += -2.5 + 5 * e
      break
  }
}

function applyTransition(f: MvpFxFrame, kind: MvpTransitionKind, elapsedSec: number): void {
  const r = 1 - easeOutCubic(clamp01(elapsedSec / MVP_TRANSITION_SEC))
  switch (kind) {
    case "zoom-punch":
      f.scale *= 1 + 0.16 * r
      break
    case "whip-left":
      f.scale *= 1 + 0.2 * r
      f.offsetXPct += 9 * r
      break
    case "whip-right":
      f.scale *= 1 + 0.2 * r
      f.offsetXPct -= 9 * r
      break
    case "flash":
      f.scale *= 1 + 0.05 * r
      f.flashAlpha = Math.max(f.flashAlpha, 0.75 * (1 - clamp01(elapsedSec / FLASH_SEC)))
      break
    case "shake":
      f.scale *= 1 + 0.06 * r
      f.offsetXPct += Math.sin(elapsedSec * 70) * 1.6 * r
      f.offsetYPct += Math.cos(elapsedSec * 55) * 1.2 * r
      f.rotateDeg += Math.sin(elapsedSec * 60) * 0.8 * r
      break
  }
}

/** 음성 시각 audioT의 화면 변형값 */
export function mvpAutoFxFrame(
  audioT: number,
  cues: readonly VoiceLineCue[] | null | undefined,
  settings: MvpAutoFxSettings
): MvpFxFrame {
  if (!cues?.length || (!settings.motion && !settings.transitions)) return MVP_FX_IDENTITY
  const cue = voiceLineCueAtTime(cues, audioT)
  const range = cue ? audioRangeForSceneIndex(cue.sceneIndex, cues) : null
  if (!cue || !range) return MVP_FX_IDENTITY

  const f: MvpFxFrame = { ...MVP_FX_IDENTITY }
  if (settings.motion) {
    const span = Math.max(0.1, range.endSec - range.startSec)
    applyCameraMotion(f, MOTION_CYCLE[cue.sceneIndex % MOTION_CYCLE.length]!, (audioT - range.startSec) / span)
  }
  const kind = settings.transitions ? mvpTransitionKindForScene(cue.sceneIndex) : null
  const elapsed = audioT - range.startSec
  if (kind && elapsed >= 0 && elapsed < MVP_TRANSITION_SEC) applyTransition(f, kind, elapsed)
  return f
}

export function isMvpFxIdentity(f: MvpFxFrame): boolean {
  return (
    Math.abs(f.scale - 1) < 1e-4 &&
    Math.abs(f.offsetXPct) < 1e-3 &&
    Math.abs(f.offsetYPct) < 1e-3 &&
    Math.abs(f.rotateDeg) < 1e-3 &&
    f.flashAlpha <= 0
  )
}

/** 미리보기 CSS transform (요소 중심 기준, canvas 렌더와 같은 순서) */
export function mvpFxCssTransform(f: MvpFxFrame): string {
  return `translate3d(${f.offsetXPct}%, ${f.offsetYPct}%, 0) rotate(${f.rotateDeg}deg) scale(${f.scale})`
}

/** 렌더 canvas에 변형을 걸고 draw 후 원복 */
export function withMvpFxCanvasTransform(
  ctx: CanvasRenderingContext2D,
  f: MvpFxFrame,
  cw: number,
  ch: number,
  draw: () => void
): void {
  if (isMvpFxIdentity(f)) {
    draw()
    return
  }
  ctx.save()
  ctx.translate(cw / 2 + (f.offsetXPct / 100) * cw, ch / 2 + (f.offsetYPct / 100) * ch)
  ctx.rotate((f.rotateDeg * Math.PI) / 180)
  ctx.scale(f.scale, f.scale)
  ctx.translate(-cw / 2, -ch / 2)
  draw()
  ctx.restore()
}

export function drawMvpFxFlash(ctx: CanvasRenderingContext2D, f: MvpFxFrame, cw: number, ch: number): void {
  if (f.flashAlpha <= 0) return
  ctx.save()
  ctx.globalAlpha = f.flashAlpha
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, cw, ch)
  ctx.restore()
}

/* ───────── 전환 효과음 ───────── */

export const AUTO_TRANSITION_SFX_ID_PREFIX = "effect_transition_"

/** leadSec: 소리의 가장 센 부분이 컷 순간에 오도록 앞당기는 시간 */
const TRANSITION_SFX: Record<
  MvpTransitionKind,
  { catalogId: string; sourceDurationSec: number; maxDurationSec: number; leadSec: number; volumePct: number }
> = {
  "zoom-punch": { catalogId: "213", sourceDurationSec: 0.48, maxDurationSec: 0.48, leadSec: 0.18, volumePct: 70 },
  "whip-left": { catalogId: "214", sourceDurationSec: 0.44, maxDurationSec: 0.44, leadSec: 0.18, volumePct: 80 },
  "whip-right": { catalogId: "215", sourceDurationSec: 0.36, maxDurationSec: 0.36, leadSec: 0.15, volumePct: 80 },
  flash: { catalogId: "084", sourceDurationSec: 0.47, maxDurationSec: 0.47, leadSec: 0.03, volumePct: 40 },
  shake: { catalogId: "004", sourceDurationSec: 1.08, maxDurationSec: 0.7, leadSec: 0.22, volumePct: 50 },
}

export function isAutoTransitionSfxClip(clip: Pick<MvpEffectClip, "id">): boolean {
  return clip.id.startsWith(AUTO_TRANSITION_SFX_ID_PREFIX)
}

export function buildMvpTransitionSfxClips(cues: readonly VoiceLineCue[]): MvpEffectClip[] {
  const sceneCount = cues.reduce((n, c) => Math.max(n, c.sceneIndex + 1), 0)
  const out: MvpEffectClip[] = []
  for (let scene = 1; scene < sceneCount; scene++) {
    const kind = mvpTransitionKindForScene(scene)
    const range = audioRangeForSceneIndex(scene, cues)
    const spec = kind ? TRANSITION_SFX[kind] : null
    const item = spec ? STORY_SHOPPING_SFX_CATALOG.find((s) => s.id === spec.catalogId) : null
    if (!range || !spec || !item) continue
    out.push({
      id: `${AUTO_TRANSITION_SFX_ID_PREFIX}${scene}`,
      catalogId: item.id,
      label: `전환 · ${item.label}`,
      src: item.src,
      startSec: Math.max(0, range.startSec - spec.leadSec),
      durationSec: spec.maxDurationSec,
      sourceOffsetSec: 0,
      sourceDurationSec: spec.sourceDurationSec,
      volumePct: spec.volumePct,
      autoPlaced: true,
      autoReason: "장면 전환",
    })
  }
  return out
}

/** 사용자가 직접 넣은 효과음은 두고 자동 전환 효과음만 교체 */
export function syncAutoTransitionSfx(
  clips: readonly MvpEffectClip[],
  cues: readonly VoiceLineCue[] | null | undefined,
  enabled: boolean
): MvpEffectClip[] {
  const manual = clips.filter((c) => !isAutoTransitionSfxClip(c))
  return enabled && cues?.length ? [...manual, ...buildMvpTransitionSfxClips(cues)] : manual
}

/* ───────── 배경음악 ───────── */

export const AUTO_BGM_ID_PREFIX = "bgm_auto_"
/** 배경음 UI 0~100 (실제 gain은 mvpBgmGainFromPct가 0.38배로 낮춤) — 나레이션보다 확실히 작게 */
export const AUTO_BGM_VOLUME_PCT = 45

export function isAutoBgmClip(clip: Pick<MvpBgmClip, "id">): boolean {
  return clip.id.startsWith(AUTO_BGM_ID_PREFIX)
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function buildMvpAutoBgmClip(trackId: string, durationSec: number, volumePct = AUTO_BGM_VOLUME_PCT): MvpBgmClip | null {
  const factory = VOICE_PREVIEW_BGM_OPTIONS.find((o) => o.id === trackId)
  const catalogId = factory ? `bgm-${factory.id}` : trackId
  const item = mvpAudioCatalogItem(catalogId)
  const src = item?.src ?? factory?.src
  if (!src) return null
  const idSuffix = factory?.id ?? catalogId
  return {
    id: `${AUTO_BGM_ID_PREFIX}${idSuffix}`,
    catalogId,
    label: item?.label ?? factory?.label ?? "배경음",
    src,
    startSec: 0,
    endSec: Math.max(0.5, durationSec),
    volumePct,
    sourceDurationSec: item?.durationSec ?? factory?.durationSec ?? 60,
  }
}

/** 프로젝트(작업)마다 다른 곡이 고정으로 고르게 선택되도록 */
export function pickMvpAutoBgmTrackId(seedKey: string): string {
  return VOICE_PREVIEW_BGM_OPTIONS[hashString(seedKey) % VOICE_PREVIEW_BGM_OPTIONS.length]!.id
}

/**
 * - 꺼짐: 자동 배경음만 제거
 * - 켜짐: 사용자가 직접 넣은 배경음이 있으면 그대로, 자동 배경음은 영상 길이에 맞춰 갱신, 없으면 새로 추가
 */
export function syncAutoBgm(
  clips: readonly MvpBgmClip[],
  enabled: boolean,
  seedKey: string,
  durationSec: number
): MvpBgmClip[] {
  const manual = clips.filter((c) => !isAutoBgmClip(c))
  if (!enabled || manual.length || durationSec <= 0) return manual
  const current = clips.find(isAutoBgmClip)
  const trackId =
    current?.catalogId && mvpAudioCatalogItem(current.catalogId)
      ? current.catalogId
      : pickMvpAutoBgmTrackId(seedKey)
  const clip = buildMvpAutoBgmClip(trackId, durationSec, current?.volumePct)
  return clip ? [clip] : []
}

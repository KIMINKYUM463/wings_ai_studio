import type { CSSProperties } from "react"
import type { AutoEditJobResult, EditPlanSegment } from "@/lib/shotform-auto-edit-types"

export const MVP_VIDEO_SOURCE_SCALE_MIN = 0.5
export const MVP_VIDEO_SOURCE_SCALE_MAX = 2.5

export type MvpVideoSourceTransform = {
  /** 0.5 = 축소, 1 = 기본, 2.5 = 최대 확대 */
  scale: number
  flipH: boolean
}

export type MvpVideoSourceTransforms = Record<string, MvpVideoSourceTransform>

export function defaultMvpVideoSourceTransform(): MvpVideoSourceTransform {
  return { scale: 1, flipH: false }
}

export function clampMvpVideoSourceScale(scale: number): number {
  const n = Number(scale)
  if (!Number.isFinite(n)) return 1
  return Math.min(MVP_VIDEO_SOURCE_SCALE_MAX, Math.max(MVP_VIDEO_SOURCE_SCALE_MIN, n))
}

export function normalizeMvpVideoSourceTransforms(
  raw?: Record<string, Partial<MvpVideoSourceTransform>> | null
): MvpVideoSourceTransforms {
  if (!raw) return {}
  const out: MvpVideoSourceTransforms = {}
  for (const [id, t] of Object.entries(raw)) {
    if (!id?.trim()) continue
    out[id] = {
      scale: clampMvpVideoSourceScale(t?.scale ?? 1),
      flipH: Boolean(t?.flipH),
    }
  }
  return out
}

export function getMvpVideoSourceTransform(
  map: MvpVideoSourceTransforms,
  videoId: string | null | undefined
): MvpVideoSourceTransform {
  if (!videoId) return defaultMvpVideoSourceTransform()
  return map[videoId] ?? defaultMvpVideoSourceTransform()
}

export function mvpVideoSourceTransformStyle(
  transform: MvpVideoSourceTransform
): CSSProperties {
  const scale = clampMvpVideoSourceScale(transform.scale)
  const flipX = transform.flipH ? -scale : scale
  return {
    transform: `scale(${flipX}, ${scale})`,
    transformOrigin: "center center",
  }
}

export function editPlanSegmentAtOutputTime(
  plan: readonly EditPlanSegment[],
  outputSec: number
): EditPlanSegment | null {
  if (!plan.length) return null
  for (const seg of plan) {
    if (outputSec >= seg.output_start - 0.02 && outputSec < seg.output_end - 0.01) return seg
  }
  const last = plan[plan.length - 1]!
  if (outputSec >= last.output_start - 0.02) return last
  return plan[0]!
}

/** 출력 타임라인 기준 짜집기 클립 인덱스 */
export function editPlanSegmentIndexAtOutputTime(
  plan: readonly EditPlanSegment[],
  outputSec: number
): number {
  if (!plan.length) return 0
  for (let i = 0; i < plan.length; i++) {
    const seg = plan[i]!
    if (outputSec >= seg.output_start - 0.02 && outputSec < seg.output_end - 0.01) return i
  }
  const last = plan.length - 1
  if (outputSec >= plan[last]!.output_start - 0.02) return last
  return 0
}

export const MVP_EDIT_PLAN_CLIP_KEY_PREFIX = "clip:"

/** 짜집기 타임라인 클립별 transform 키 (video_id 공유 클립도 개별 조정) */
export function mvpEditPlanClipKey(clipIndex: number): string {
  return `${MVP_EDIT_PLAN_CLIP_KEY_PREFIX}${clipIndex}`
}

export function parseMvpEditPlanClipKey(key: string): number | null {
  if (!key.startsWith(MVP_EDIT_PLAN_CLIP_KEY_PREFIX)) return null
  const n = parseInt(key.slice(MVP_EDIT_PLAN_CLIP_KEY_PREFIX.length), 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function getMvpEditPlanClipTransform(
  map: MvpVideoSourceTransforms,
  clipIndex: number | null | undefined
): MvpVideoSourceTransform {
  if (clipIndex == null || clipIndex < 0) return defaultMvpVideoSourceTransform()
  return getMvpVideoSourceTransform(map, mvpEditPlanClipKey(clipIndex))
}

export function isDefaultMvpVideoSourceTransform(transform: MvpVideoSourceTransform): boolean {
  return !transform.flipH && Math.abs(clampMvpVideoSourceScale(transform.scale) - 1) <= 0.001
}

/** object-contain 배치 후 중심 기준 확대·좌우반전 (미리보기 CSS transform과 동일) */
export function drawVideoContainWithSourceTransform(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  cw: number,
  ch: number,
  transform: MvpVideoSourceTransform
) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return

  const scale = clampMvpVideoSourceScale(transform.scale)
  const flipX = transform.flipH ? -1 : 1
  const va = vw / vh
  const ca = cw / ch
  let dw = cw
  let dh = ch
  let dx = 0
  let dy = 0
  if (va > ca) {
    dh = cw / va
    dy = (ch - dh) / 2
  } else {
    dw = ch * va
    dx = (cw - dw) / 2
  }

  ctx.save()
  ctx.translate(cw / 2, ch / 2)
  ctx.scale(flipX * scale, scale)
  ctx.translate(-cw / 2, -ch / 2)
  ctx.drawImage(video, dx, dy, dw, dh)
  ctx.restore()
}

export function videoSourceLabel(result: AutoEditJobResult, videoId: string): string {
  if (videoId === "__blank__") return "공백"
  const title = result.analyses?.find((a) => a.video_id === videoId)?.title?.trim()
  if (title) return title.length > 20 ? `${title.slice(0, 18)}…` : title
  return videoId.replace(/^v_/, "").slice(0, 14) || "영상 소스"
}

import { STUDIO_CANVAS_H } from './types'
import type { TemplateTextSlotDef } from './types'

/** 템플릿1 좌측 정렬 */
export const HISTORICAL_HOOK_RIGHT_XN = 0.055

/**
 * 템플릿1 실측 피벗 — 하단 로그의 「피벗 x=… y=…」를 그대로 복사해 넣습니다.
 * yn만 넣지 마세요 (피벗 y와 어긋남).
 */
export const HISTORICAL_HOOK_RIGHT_MEASURED_PIVOTS = {
  hook: { xn: 0.055, pivotXPx: 82, pivotYPx: 413 },
  highlight: { xn: 0.055, pivotXPx: 77, pivotYPx: 532 },
  main_title: { xn: 0.055, pivotXPx: 68, pivotYPx: 611 },
} as const satisfies Record<
  string,
  { xn: number; pivotXPx: number; pivotYPx: number }
>

function ynFromPivotYPx(slot: TemplateTextSlotDef, pivotY: number): number {
  const padY = slot.boxPaddingY ?? (slot.boxBackground ? 8 : 10)
  const lineH = slot.fontSize * 1.1
  const boxH = slot.boxBackground ? lineH + padY * 2 : lineH
  const ynAnchor = slot.ynAnchor ?? 'top-left'
  if (ynAnchor === 'center') return pivotY / STUDIO_CANVAS_H
  return (pivotY - boxH / 2) / STUDIO_CANVAS_H
}

/** 템플릿1 — MEASURED_PIVOTS 피벗을 캔버스에 그대로 적용 */
export function buildHistoricalHookRightTextSlots(
  baseSlots: readonly TemplateTextSlotDef[],
): TemplateTextSlotDef[] {
  return baseSlots.map((slot) => {
    const measured =
      HISTORICAL_HOOK_RIGHT_MEASURED_PIVOTS[
        slot.slotKey as keyof typeof HISTORICAL_HOOK_RIGHT_MEASURED_PIVOTS
      ]

    if (!measured) {
      return { ...slot, xn: HISTORICAL_HOOK_RIGHT_XN }
    }

    return {
      ...slot,
      xn: measured.xn,
      yn: ynFromPivotYPx(slot, measured.pivotYPx),
      pivotXPx: measured.pivotXPx,
      pivotYPx: measured.pivotYPx,
    }
  })
}

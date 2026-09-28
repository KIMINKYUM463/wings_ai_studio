import { STUDIO_CANVAS_H } from './types'
import type { TemplateTextSlotDef } from './types'

export const DIPLOMATIC_DUAL_BOTTOM_CENTER_XN = 0.5

/** 템플릿13 실측 피벗 — 로그의 피벗 x/y 복사 */
export const DIPLOMATIC_DUAL_BOTTOM_CENTER_MEASURED_PIVOTS = {
  hook: { xn: 0.5, pivotXPx: 434, pivotYPx: 481 },
  main_title: { xn: 0.5, pivotXPx: 639, pivotYPx: 602 },
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

export function buildDiplomaticDualBottomCenterTextSlots(
  baseSlots: readonly TemplateTextSlotDef[],
): TemplateTextSlotDef[] {
  return baseSlots.map((slot) => {
    const measured =
      DIPLOMATIC_DUAL_BOTTOM_CENTER_MEASURED_PIVOTS[
        slot.slotKey as keyof typeof DIPLOMATIC_DUAL_BOTTOM_CENTER_MEASURED_PIVOTS
      ]

    if (!measured) {
      return { ...slot, xn: slot.xn ?? DIPLOMATIC_DUAL_BOTTOM_CENTER_XN }
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

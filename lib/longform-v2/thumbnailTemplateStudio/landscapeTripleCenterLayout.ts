import { STUDIO_CANVAS_H } from './types'
import type { TemplateTextSlotDef } from './types'

export const LANDSCAPE_TRIPLE_CENTER_XN = 0.5

/** 템플릿14 실측 피벗 — 로그의 피벗 x/y 복사 */
export const LANDSCAPE_TRIPLE_CENTER_MEASURED_PIVOTS = {
  hook: { xn: 0.5, pivotXPx: 646, pivotYPx: 411 },
  highlight: { xn: 0.5, pivotXPx: 658, pivotYPx: 499 },
  main_title: { xn: 0.5, pivotXPx: 648, pivotYPx: 603 },
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

export function buildLandscapeTripleCenterTextSlots(
  baseSlots: readonly TemplateTextSlotDef[],
): TemplateTextSlotDef[] {
  return baseSlots.map((slot) => {
    const measured =
      LANDSCAPE_TRIPLE_CENTER_MEASURED_PIVOTS[
        slot.slotKey as keyof typeof LANDSCAPE_TRIPLE_CENTER_MEASURED_PIVOTS
      ]

    if (!measured) {
      return { ...slot, xn: slot.xn ?? LANDSCAPE_TRIPLE_CENTER_XN }
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

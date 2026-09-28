import { STUDIO_CANVAS_H } from './types'
import type { TemplateTextSlotDef } from './types'

export const ASTRONAUT_SPARKS_RIGHT_XN = 0.06

/** 템플릿5 실측 피벗 — 로그의 피벗 x/y 복사 */
export const ASTRONAUT_SPARKS_RIGHT_MEASURED_PIVOTS = {
  hook: { xn: 0.06, pivotXPx: 76, pivotYPx: 58 },
  highlight: { xn: 0.06, pivotXPx: 56, pivotYPx: 510 },
  main_title: { xn: 0.06, pivotXPx: 60, pivotYPx: 624 },
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

export function buildAstronautSparksRightTextSlots(
  baseSlots: readonly TemplateTextSlotDef[],
): TemplateTextSlotDef[] {
  return baseSlots.map((slot) => {
    const measured =
      ASTRONAUT_SPARKS_RIGHT_MEASURED_PIVOTS[
        slot.slotKey as keyof typeof ASTRONAUT_SPARKS_RIGHT_MEASURED_PIVOTS
      ]

    if (!measured) {
      return { ...slot, xn: slot.xn ?? ASTRONAUT_SPARKS_RIGHT_XN }
    }

    return {
      ...slot,
      xn: measured.xn,
      yn: ynFromPivotYPx(slot, measured.pivotYPx),
      pivotXPx: measured.pivotXPx,
      pivotYPx: measured.pivotYPx,
      rotationDeg: slot.slotKey === 'hook' ? 0 : slot.rotationDeg,
    }
  })
}

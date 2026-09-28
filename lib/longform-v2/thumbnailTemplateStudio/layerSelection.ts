import type { StudioLayerRef } from './types'

export function studioLayerRefKey(ref: StudioLayerRef): string {
  if (ref.kind === 'background') return 'background'
  return `${ref.kind}:${ref.id}`
}

export function studioLayerRefsEqual(a: StudioLayerRef, b: StudioLayerRef): boolean {
  return studioLayerRefKey(a) === studioLayerRefKey(b)
}

export function isStudioLayerRefSelected(selected: StudioLayerRef[], ref: StudioLayerRef): boolean {
  return selected.some((r) => studioLayerRefsEqual(r, ref))
}

export function primaryStudioLayerRef(selected: StudioLayerRef[]): StudioLayerRef | null {
  return selected.length > 0 ? selected[selected.length - 1]! : null
}

export type LayerClickModifiers = {
  ctrl?: boolean
  shift?: boolean
}

/** Ctrl/Cmd+클릭 토글, Shift+클릭 추가, 일반 클릭 단일 선택. 배경은 항상 단독 선택. */
export function applyLayerClickSelection(
  current: StudioLayerRef[],
  ref: StudioLayerRef,
  modifiers: LayerClickModifiers = {},
): StudioLayerRef[] {
  if (ref.kind === 'background') return [ref]

  const withoutBackground = current.filter((r) => r.kind !== 'background')
  const toggle = Boolean(modifiers.ctrl)
  const additive = Boolean(modifiers.shift)

  if (toggle) {
    if (isStudioLayerRefSelected(withoutBackground, ref)) {
      const next = withoutBackground.filter((r) => !studioLayerRefsEqual(r, ref))
      return next.length > 0 ? next : [ref]
    }
    return [...withoutBackground, ref]
  }

  if (additive) {
    if (isStudioLayerRefSelected(withoutBackground, ref)) return withoutBackground
    return [...withoutBackground, ref]
  }

  return [ref]
}

export function drawableSelectedLayers(selected: StudioLayerRef[]): StudioLayerRef[] {
  return selected.filter((r) => r.kind !== 'background')
}

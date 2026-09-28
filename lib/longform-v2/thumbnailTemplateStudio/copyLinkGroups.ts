import { getProTemplate } from './catalog'

/** hook + highlight — 한 문장·호흡으로 이어지는 상단 2줄 */
export function getLinkedCopyPartner(
  templateId: string,
  slotKey: string,
  slotIndex: number,
): { slotKey: string; slotIndex: number } | null {
  const tpl = getProTemplate(templateId)
  if (!tpl) return null

  const slots = tpl.textSlots
  const hookIdx = slots.findIndex((s) => s.slotKey === 'hook')
  const highlightIdx = slots.findIndex((s) => s.slotKey === 'highlight')

  if (hookIdx < 0 || highlightIdx < 0) return null
  if (Math.abs(hookIdx - highlightIdx) !== 1) return null

  if (slotKey === 'hook' && slotIndex === hookIdx) {
    return { slotKey: 'highlight', slotIndex: highlightIdx }
  }
  if (slotKey === 'highlight' && slotIndex === highlightIdx) {
    return { slotKey: 'hook', slotIndex: hookIdx }
  }
  return null
}

export function templateHasLinkedHookHighlight(templateId: string): boolean {
  const tpl = getProTemplate(templateId)
  if (!tpl) return false
  const keys = tpl.textSlots.map((s) => s.slotKey)
  const hi = keys.indexOf('hook')
  const hl = keys.indexOf('highlight')
  return hi >= 0 && hl >= 0 && Math.abs(hi - hl) === 1
}

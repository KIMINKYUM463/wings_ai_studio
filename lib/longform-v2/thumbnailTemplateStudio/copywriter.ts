import { postThumbnailTemplateCopy, postThumbnailThreeSlotCopy, postThumbnailText } from '@/lib/longform-v2/thumbnail-bridge/thumbnailAiApi'
import type { ThumbnailCopywriterRequest } from '@/lib/longform-v2/youtube/thumbnailCopywriter'
import { getProTemplate } from './catalog'
import type { ThumbnailProTemplate } from './types'
import { clampThumbnailSlotCopy } from './catalogTextStyle'
import { getLinkedCopyPartner } from './copyLinkGroups'
import { applySlotReplacementsToDocument, buildCopywriterFramesFromDocument } from './document'
import type { ThumbnailStudioDocument } from './types'

function slotCopyRoleHint(slotKey: string, label: string): string {
  switch (slotKey) {
    case 'hook':
      return `${label} — 1줄(상단): 설정·맥락 — 2줄과 **한 세트** (예: ~뻔했던, ~숨겨진)`
    case 'highlight':
      return `${label} — 2줄(중간): 1줄과 **연결** — ~한 이유 / ~했을까? (hook과 한 호흡)`
    case 'sub':
      return `${label} — 3줄(중간): 보조 강조`
    case 'main_title':
      return `${label} — 하단(대형): 1줄과 **연결된** ~한 진짜 이유 / ~했을까? / 핵심 명사`
    case 'accent':
      return `${label} — 강조(보조): 핵심 키워드·결론 한 줄`
    case 'line1':
      return `${label} — 1줄(위): 설정·조건 — line2와 **한 이야기**`
    case 'line2':
      return `${label} — 2줄(아래): line1과 **연결** — ~한 진짜 이유 / ~했을까? / ~일까?`
    default:
      return label
  }
}

/** 슬롯 maxCharacters — 화면·AI 모두 동일 상한 */
function clampSlot(text: string, max: number): string {
  return clampThumbnailSlotCopy(text, max)
}

function countFilledSlots(tpl: ThumbnailProTemplate, map: Record<string, string>): number {
  return tpl.textSlots.filter((s) => Boolean(map[s.slotKey]?.trim())).length
}

function mergeReplacementMaps(
  tpl: ThumbnailProTemplate,
  ...maps: Record<string, string>[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const slot of tpl.textSlots) {
    for (const map of maps) {
      let rep = map[slot.slotKey]?.trim()
      if (!rep) {
        for (const [key, val] of Object.entries(map)) {
          if (key.toLowerCase() === slot.slotKey.toLowerCase() && val.trim()) {
            rep = val.trim()
            break
          }
        }
      }
      if (rep) {
        out[slot.slotKey] = clampSlot(rep, slot.maxCharacters)
        break
      }
    }
  }
  const ordered = maps.flatMap((m) => tpl.textSlots.map((s) => m[s.slotKey]?.trim()).filter(Boolean) as string[])
  tpl.textSlots.forEach((slot, i) => {
    if (out[slot.slotKey]?.trim()) return
    if (ordered[i]) out[slot.slotKey] = clampSlot(ordered[i], slot.maxCharacters)
  })
  return out
}

/** line1/line2 API 결과 → 템플릿 슬롯 키 */
export function mapLinesToTemplateSlots(
  tpl: ThumbnailProTemplate,
  line1: string,
  line2: string,
): Record<string, string> {
  const l1 = line1.trim()
  const l2 = line2.trim()
  const out: Record<string, string> = {}

  for (const slot of tpl.textSlots) {
    const max = slot.maxCharacters
    switch (slot.slotKey) {
      case 'hook':
        if (l1) out.hook = clampSlot(l1, max)
        break
      case 'highlight':
        if (l2 || l1) out.highlight = clampSlot(l2 || l1, max)
        break
      case 'sub':
        if (l2) out.sub = clampSlot(l2, max)
        break
      case 'main_title':
        if (l2 || l1) out.main_title = clampSlot(l2 || l1, max)
        break
      case 'accent':
        if (l2) out.accent = clampSlot(l2, max)
        break
      case 'line1':
        if (l1) out.line1 = clampSlot(l1, max)
        break
      case 'line2':
        if (l2) out.line2 = clampSlot(l2, max)
        break
      default:
        break
    }
  }

  tpl.textSlots.forEach((slot, i) => {
    if (out[slot.slotKey]?.trim()) return
    const line = i === 0 ? l1 : i === 1 ? l2 : l2 || l1
    if (line) out[slot.slotKey] = clampSlot(line, slot.maxCharacters)
  })

  return out
}

async function fetchTemplateCopyReplacements(opts: {
  document: ThumbnailStudioDocument
  topic: string
  script: string
  titleHint?: string
  outputLanguage?: string
}): Promise<Record<string, string>> {
  const frame = buildCopywriterFramesFromDocument(opts.document)
  if (!frame) throw new Error('템플릿을 찾을 수 없습니다.')

  const tpl = getProTemplate(opts.document.templateId)
  if (!tpl) throw new Error('템플릿을 찾을 수 없습니다.')

  const topic = opts.topic.trim() || opts.titleHint?.trim() || ''
  const scriptBody =
    opts.script.trim() ||
    topic ||
    [opts.titleHint, opts.topic].filter((s) => typeof s === 'string' && s.trim()).join('\n').trim()
  if (!scriptBody) {
    throw new Error('대본 또는 주제를 입력해야 AI 문구를 생성할 수 있습니다.')
  }

  const slotsPayload = tpl.textSlots.map((s) => ({
    slotKey: s.slotKey,
    label: slotCopyRoleHint(s.slotKey, s.label),
    maxCharacters: s.maxCharacters,
  }))

  const errors: string[] = []

  /** 1) 3슬롯 JSON — 파싱이 가장 안정적 */
  let threeMap: Record<string, string> = {}
  try {
    const { replacements } = await postThumbnailThreeSlotCopy({
      topic: topic || opts.titleHint?.trim() || 'YouTube',
      scriptExcerpt: scriptBody,
      videoTitle: opts.titleHint?.trim() || undefined,
      outputLanguage: opts.outputLanguage ?? 'ko',
      slots: slotsPayload,
    })
    threeMap = replacements ?? {}
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
  }

  let templateMap: Record<string, string> = {}
  try {
    const payload: ThumbnailCopywriterRequest = {
      templateId: opts.document.templateId,
      topic: topic || 'YouTube',
      scriptExcerpt: scriptBody,
      videoTitle: opts.titleHint?.trim() || undefined,
      outputLanguage: opts.outputLanguage ?? 'ko',
      frames: [frame],
    }
    const { replacements } = await postThumbnailTemplateCopy(payload)
    templateMap = replacements ?? {}
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
  }

  let merged = mergeReplacementMaps(tpl, threeMap, templateMap)
  if (countFilledSlots(tpl, merged) >= tpl.textSlots.length) return merged

  /** 2) line1/line2 폴백 */
  try {
    const { line1, line2 } = await postThumbnailText({
      script: scriptBody,
      title: opts.titleHint?.trim() || topic || undefined,
      outputLanguage: opts.outputLanguage ?? 'ko',
    })
    const fromLines = mapLinesToTemplateSlots(tpl, line1, line2)
    merged = mergeReplacementMaps(tpl, merged, fromLines)
    if (countFilledSlots(tpl, merged) > 0) return merged
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
  }

  if (countFilledSlots(tpl, merged) > 0) return merged

  throw new Error(
    errors.length
      ? `썸네일 문구 AI 생성 실패: ${errors[errors.length - 1]}`
      : '모든 문구 슬롯을 생성하지 못했습니다.',
  )
}

export async function generateTemplateCopyForDocument(opts: {
  document: ThumbnailStudioDocument
  topic: string
  script: string
  titleHint?: string
  outputLanguage?: string
}): Promise<{ document: ThumbnailStudioDocument; replacements: Record<string, string> }> {
  const replacements = await fetchTemplateCopyReplacements(opts)
  const document = applySlotReplacementsToDocument(opts.document, replacements)
  return { document, replacements }
}

function buildCopywriterFrameForLayerIndices(
  doc: ThumbnailStudioDocument,
  layerIndices: number[],
): { frameId: string; layers: { textKey: string; label: string; original: string; maxCharacters: number }[] } | null {
  const tpl = getProTemplate(doc.templateId)
  if (!tpl) return null
  const layers = layerIndices
    .filter((i) => i >= 0 && i < tpl.textSlots.length)
    .map((i) => {
      const slot = tpl.textSlots[i]!
      return {
        textKey: slot.slotKey,
        label: slotCopyRoleHint(slot.slotKey, slot.label),
        original: '',
        maxCharacters: slot.maxCharacters,
      }
    })
  if (layers.length === 0) return null
  return { frameId: tpl.id, layers }
}

/** 선택 텍스트 슬롯만 대본·주제에서 새 카피 생성 (연결 슬롯이 있으면 함께) */
export async function regenerateThumbnailTextLayerFromScript(opts: {
  document: ThumbnailStudioDocument
  textLayerId: string
  topic: string
  script: string
  titleHint?: string
  outputLanguage?: string
}): Promise<ThumbnailStudioDocument> {
  const tpl = getProTemplate(opts.document.templateId)
  if (!tpl) throw new Error('템플릿을 찾을 수 없습니다.')

  const layerIndex = opts.document.textLayers.findIndex((t) => t.id === opts.textLayerId)
  if (layerIndex < 0) throw new Error('텍스트 레이어를 찾을 수 없습니다.')

  const slot = tpl.textSlots[layerIndex]
  if (!slot) throw new Error('템플릿 슬롯을 찾을 수 없습니다.')

  const topic = opts.topic.trim() || opts.titleHint?.trim() || ''
  const scriptBody =
    opts.script.trim() ||
    topic ||
    [opts.titleHint, opts.topic].filter((s) => typeof s === 'string' && s.trim()).join('\n').trim()
  if (!scriptBody) {
    throw new Error('대본 또는 제목이 없어 AI 문구를 생성할 수 없습니다.')
  }

  const indices = new Set<number>([layerIndex])
  const partner = getLinkedCopyPartner(opts.document.templateId, slot.slotKey, layerIndex)
  if (partner) indices.add(partner.slotIndex)

  const frame = buildCopywriterFrameForLayerIndices(opts.document, [...indices])
  if (!frame) throw new Error('카피 프레임을 만들 수 없습니다.')

  const payload: ThumbnailCopywriterRequest = {
    templateId: opts.document.templateId,
    topic: topic || 'YouTube',
    scriptExcerpt: scriptBody,
    videoTitle: opts.titleHint?.trim() || undefined,
    outputLanguage: opts.outputLanguage ?? 'ko',
    frames: [frame],
  }

  const { replacements } = await postThumbnailTemplateCopy(payload)
  const picked: Record<string, string> = {}
  for (const i of indices) {
    const sk = tpl.textSlots[i]?.slotKey
    if (!sk) continue
    const rep = replacements[sk]?.trim()
    if (rep) picked[sk] = clampSlot(rep, tpl.textSlots[i]!.maxCharacters)
  }

  if (!picked[slot.slotKey]?.trim()) {
    throw new Error('AI가 이 슬롯 문구를 생성하지 못했습니다. 대본·Gemini 키를 확인하세요.')
  }

  return applySlotReplacementsToDocument(opts.document, picked)
}

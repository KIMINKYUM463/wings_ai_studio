import { postThumbnailCtrPackage } from '@/lib/longform-v2/thumbnail-bridge/thumbnailAiApi'
import type { CtrThumbnailPackageOption } from '@/lib/longform-v2/youtube/youtubeCtrThumbnailPackageKo'
import {
  polishCtrThumbnailOption,
} from '@/lib/longform-v2/youtube/youtubeCtrThumbnailPackageKo'
import { clampCopyComboLine, MAIN_COPY_LINE2_VIRTUAL_KEY } from '@/lib/longform-v2/youtube/thumbnailCopyCombos'
import { clampSubCopyText } from '@/lib/longform-v2/youtube/thumbnailSubCopy'
import { getProTemplate } from './catalog'
import {
  applyCopyComboToDocument,
  applySlotReplacementsToDocument,
  addSubCopyAsTextLayerToDocument,
  resolveSubCopySlotSpec,
  resolveTwoLineCopySlotSpec,
} from './document'
import { mapLinesToTemplateSlots } from './copywriter'
import type { ThumbnailStudioDocument } from './types'

export type CtrPackageApplyResult = {
  document: ThumbnailStudioDocument
  replacements: Record<string, string>
  option: CtrThumbnailPackageOption
  subCopyApplied?: string
}

export async function fetchCtrThumbnailPackage(opts: {
  script: string
  titleHint?: string
  topic?: string
  outputLanguage?: string
  optionIndex?: number
}): Promise<CtrThumbnailPackageOption> {
  const scriptBody =
    opts.script.trim() ||
    opts.topic?.trim() ||
    opts.titleHint?.trim() ||
    ''
  if (!scriptBody) {
    throw new Error('대본 또는 제목이 없어 CTR 썸네일 패키지를 생성할 수 없습니다.')
  }

  const { options } = await postThumbnailCtrPackage({
    scriptExcerpt: scriptBody,
    videoTitle: opts.titleHint?.trim() || undefined,
    topic: opts.topic?.trim() || undefined,
    outputLanguage: opts.outputLanguage ?? 'ko',
    count: 10,
  })

  if (!options.length) {
    throw new Error('CTR 썸네일 패키지를 파싱하지 못했습니다. 다시 시도해 주세요.')
  }

  const startIdx = Math.max(0, Math.min(options.length - 1, opts.optionIndex ?? 0))
  for (let i = 0; i < options.length; i++) {
    const idx = (startIdx + i) % options.length
    const candidate = options[idx]!
    if (candidate.mainLine1?.trim() && candidate.mainLine2?.trim()) {
      return candidate
    }
  }

  return options[startIdx]!
}

/** CTR 패키지 1옵션 → 메인 2줄 + 서브카피 1개(첫 번째) 적용 */
export function applyCtrPackageOptionToDocument(
  doc: ThumbnailStudioDocument,
  option: CtrThumbnailPackageOption,
  subCopyPickIndex = 0,
): CtrPackageApplyResult {
  const polished = polishCtrThumbnailOption(option)
  const spec = resolveTwoLineCopySlotSpec(doc)
  let nextDoc = doc
  const replacements: Record<string, string> = {}

  if (spec) {
    nextDoc = applyCopyComboToDocument(nextDoc, {
      id: polished.id,
      angle: polished.angle,
      line1: polished.mainLine1,
      line2: polished.mainLine2,
    }, spec)
    replacements[spec.line1Key] = clampCopyComboLine(polished.mainLine1, spec.line1Max)
    if (spec.line2Key !== MAIN_COPY_LINE2_VIRTUAL_KEY) {
      replacements[spec.line2Key] = clampCopyComboLine(polished.mainLine2, spec.line2Max)
    }
  } else {
    const tpl = getProTemplate(doc.templateId)
    if (!tpl) throw new Error('템플릿을 찾을 수 없습니다.')
    const fromLines = mapLinesToTemplateSlots(tpl, polished.mainLine1, polished.mainLine2)
    Object.assign(replacements, fromLines)
    nextDoc = applySlotReplacementsToDocument(doc, fromLines)
  }

  const subIdx = Math.max(0, Math.min(2, subCopyPickIndex))
  const subRaw = polished.subCopies[subIdx]?.trim()
  let subCopyApplied: string | undefined

  if (subRaw) {
    const subSpec = resolveSubCopySlotSpec(nextDoc)
    const subText = clampSubCopyText(subRaw, subSpec?.subMax ?? 10)
    if (subSpec) {
      replacements[subSpec.subKey] = subText
      nextDoc = applySlotReplacementsToDocument(nextDoc, { [subSpec.subKey]: subText })
    } else {
      const added = addSubCopyAsTextLayerToDocument(nextDoc, subText, 10)
      nextDoc = added.document
    }
    subCopyApplied = subText
  }

  return { document: nextDoc, replacements, option: polished, subCopyApplied }
}

export async function generateCtrPackageCopyForDocument(opts: {
  document: ThumbnailStudioDocument
  topic: string
  script: string
  titleHint?: string
  outputLanguage?: string
  optionIndex?: number
  subCopyPickIndex?: number
}): Promise<CtrPackageApplyResult> {
  const option = await fetchCtrThumbnailPackage({
    script: opts.script,
    topic: opts.topic,
    titleHint: opts.titleHint,
    outputLanguage: opts.outputLanguage,
    optionIndex: opts.optionIndex,
  })
  return applyCtrPackageOptionToDocument(
    opts.document,
    option,
    opts.subCopyPickIndex ?? 0,
  )
}

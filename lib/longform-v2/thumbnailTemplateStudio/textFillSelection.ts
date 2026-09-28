import type { TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import { applyFillSpanRange, type TextFillSpan } from './textFillSpans'

export type TextFillSelectionRange = {
  start: number
  end: number
}

export function readTextareaSelection(el: HTMLTextAreaElement | null): TextFillSelectionRange | null {
  if (!el) return null
  const start = el.selectionStart
  const end = el.selectionEnd
  if (start === end) return null
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

/** color input 클릭 시 textarea selection이 풀리므로 미리 저장한 구간 사용 */
export function resolveTextFillSelectionRange(
  live: TextFillSelectionRange | null,
  saved: TextFillSelectionRange | null,
): TextFillSelectionRange | null {
  if (live) return live
  if (saved && saved.start !== saved.end) return saved
  return null
}

export function patchTextFillColor(
  text: TextItem,
  color: string,
  range: TextFillSelectionRange | null,
): Partial<Pick<TextItem, 'fill' | 'fillSpans'>> {
  if (range && range.start !== range.end) {
    return {
      fillSpans: applyFillSpanRange(
        text.text,
        text.fill,
        text.fillSpans,
        range.start,
        range.end,
        color,
      ) as TextFillSpan[] | undefined,
    }
  }
  return { fill: color, fillSpans: undefined }
}

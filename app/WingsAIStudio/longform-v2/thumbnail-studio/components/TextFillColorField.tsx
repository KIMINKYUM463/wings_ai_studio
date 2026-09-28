import { useCallback, useRef } from 'react'
import type { TextFillSelectionRange } from '@/lib/longform-v2/thumbnailTemplateStudio/textFillSelection'

type Props = {
  label?: string
  value: string
  onApplyColor: (color: string, range: TextFillSelectionRange | null) => void
  getSelectionRange: () => TextFillSelectionRange | null
  hint?: string
}

function normalizeHex(color: string): string {
  return color.startsWith('#') ? color : '#ffffff'
}

/** textarea selection 유지 — color picker 클릭 전 구간 저장 */
export function TextFillColorField({
  label = '컬러',
  value,
  onApplyColor,
  getSelectionRange,
  hint,
}: Props) {
  const savedRangeRef = useRef<TextFillSelectionRange | null>(null)
  const hex = normalizeHex(value)

  const captureSelection = useCallback(() => {
    const live = getSelectionRange()
    if (live) savedRangeRef.current = live
  }, [getSelectionRange])

  const apply = useCallback(
    (color: string) => {
      onApplyColor(color, savedRangeRef.current)
    },
    [onApplyColor],
  )

  return (
    <label className="thumb-ui-field thumb-ui-field--color">
      <span>
        {label}
        {hint ? <span className="thumb-ui-field__subhint"> · {hint}</span> : null}
      </span>
      <input
        type="color"
        value={hex}
        onMouseDown={captureSelection}
        onFocus={captureSelection}
        onInput={(e) => apply(e.currentTarget.value)}
      />
      <input
        type="text"
        className="thumb-ui-hex"
        value={hex}
        onFocus={captureSelection}
        onChange={(e) => apply(e.target.value)}
      />
    </label>
  )
}

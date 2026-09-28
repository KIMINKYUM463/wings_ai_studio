import type { TextItem } from '../YoutubeThumbnailManualEditor'
import { StudioNumericInput } from './StudioNumericInput'
import {
  DEFAULT_TEXT_LETTER_SPACING,
  DEFAULT_TEXT_LINE_HEIGHT,
  DEFAULT_TEXT_SCALE_X,
  resolveTextTypography,
} from '@/lib/longform-v2/thumbnailTemplateStudio/textTypography'

type TextTypographyControlsProps = {
  text: TextItem
  onPatch: (patch: Partial<TextItem>) => void
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="thumb-ui-field">
      <span>{label}</span>
      <div className="thumb-ui-field__inline">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <StudioNumericInput
          className="thumb-ui-field__number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
        />
        {unit ? <span className="thumb-ui-field__unit">{unit}</span> : null}
      </div>
    </label>
  )
}

export function TextTypographyControls({ text, onPatch }: TextTypographyControlsProps) {
  const typo = resolveTextTypography(text)
  return (
    <section className="thumb-ui-section thumb-ui-section--text-typography">
      <h4 className="thumb-ui-section__title">글자 간격</h4>
      <SliderField
        label="자간"
        value={typo.letterSpacing}
        min={-20}
        max={40}
        step={1}
        onChange={(letterSpacing) => onPatch({ letterSpacing })}
      />
      <SliderField
        label="행간"
        value={typo.lineHeight}
        min={0.8}
        max={2.5}
        step={0.01}
        onChange={(lineHeight) => onPatch({ lineHeight })}
      />
      <SliderField
        label="장평"
        value={typo.scaleX}
        min={50}
        max={200}
        step={1}
        unit="%"
        onChange={(scaleX) => onPatch({ scaleX })}
      />
    </section>
  )
}

export {
  DEFAULT_TEXT_LETTER_SPACING,
  DEFAULT_TEXT_LINE_HEIGHT,
  DEFAULT_TEXT_SCALE_X,
}

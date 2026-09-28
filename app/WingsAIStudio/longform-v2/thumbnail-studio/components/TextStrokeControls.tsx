import { useRef } from 'react'
import type { TextItem } from '../YoutubeThumbnailManualEditor'
import { DEFAULT_THUMBNAIL_TEXT_STROKE_WIDTH } from '@/lib/longform-v2/thumbnailTemplateStudio/types'

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="thumb-ui-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="thumb-ui-toggle__track" aria-hidden />
    </label>
  )
}

export type TextStrokeControlsProps = {
  text: TextItem
  onPatch: (patch: Partial<TextItem>) => void
  /** 수동 편집기 등 다른 UI 스킨 */
  variant?: 'studio' | 'manual'
}

export function TextStrokeControls({ text, onPatch, variant = 'studio' }: TextStrokeControlsProps) {
  const lastWidthRef = useRef(DEFAULT_THUMBNAIL_TEXT_STROKE_WIDTH)
  const outlineOn = text.strokeWidth > 0

  const setOutlineOn = (on: boolean) => {
    if (on) {
      const w =
        lastWidthRef.current > 0 ? lastWidthRef.current : DEFAULT_THUMBNAIL_TEXT_STROKE_WIDTH
      onPatch({ strokeWidth: Math.max(4, w) })
    } else {
      if (text.strokeWidth > 0) lastWidthRef.current = text.strokeWidth
      onPatch({ strokeWidth: 0 })
    }
  }

  if (variant === 'manual') {
    return (
      <div className="yt-thumb-manual__section">
        <label className="yt-thumb-manual__mini yt-thumb-manual__check">
          <input type="checkbox" checked={outlineOn} onChange={(e) => setOutlineOn(e.target.checked)} />
          글자 외곽선
        </label>
        {outlineOn ? (
          <div className="yt-thumb-manual__row yt-thumb-manual__row--wrap" style={{ marginTop: 8 }}>
            <label className="yt-thumb-manual__mini">
              외곽선 색
              <input
                type="color"
                value={text.stroke.startsWith('#') ? text.stroke : '#000000'}
                onChange={(e) => onPatch({ stroke: e.target.value })}
              />
            </label>
            <label className="yt-thumb-manual__mini">
              두께
              <input
                type="range"
                min={4}
                max={36}
                value={text.strokeWidth}
                onChange={(e) => {
                  const w = Number(e.target.value)
                  lastWidthRef.current = w
                  onPatch({ strokeWidth: w })
                }}
              />
              <span>{text.strokeWidth}px</span>
            </label>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <section className="thumb-ui-section thumb-ui-section--compact">
      <Toggle label="글자 외곽선" checked={outlineOn} onChange={setOutlineOn} />
      {outlineOn ? (
        <>
          <label className="thumb-ui-field thumb-ui-field--color">
            <span>외곽선 색</span>
            <input
              type="color"
              value={text.stroke.startsWith('#') ? text.stroke : '#000000'}
              onChange={(e) => onPatch({ stroke: e.target.value })}
            />
            <input
              type="text"
              className="thumb-ui-hex"
              value={text.stroke.startsWith('#') ? text.stroke : '#000000'}
              onChange={(e) => onPatch({ stroke: e.target.value })}
            />
          </label>
          <label className="thumb-ui-field">
            <span>외곽선 두께 ({text.strokeWidth}px)</span>
            <input
              type="range"
              min={4}
              max={36}
              value={text.strokeWidth}
              onChange={(e) => {
                const w = Number(e.target.value)
                lastWidthRef.current = w
                onPatch({ strokeWidth: w })
              }}
            />
          </label>
        </>
      ) : (
        <p className="thumb-ui-hint">끄면 글자 테두리 없이 채움색만 표시됩니다.</p>
      )}
    </section>
  )
}

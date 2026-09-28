import type { CanvasTextAlign } from '../YoutubeThumbnailManualEditor'

const ALIGN_OPTIONS: { id: CanvasTextAlign; label: string; title: string }[] = [
  { id: 'left', label: '좌', title: '좌측 정렬' },
  { id: 'center', label: '중', title: '가운데 정렬' },
  { id: 'right', label: '우', title: '우측 정렬' },
]

function AlignIcon({ align }: { align: CanvasTextAlign }) {
  const lines =
    align === 'left'
      ? ['short', 'long', 'mid']
      : align === 'center'
        ? ['short', 'long', 'mid']
        : ['short', 'long', 'mid']
  return (
    <span className={`thumb-ui-align__icon thumb-ui-align__icon--${align}`} aria-hidden>
      {lines.map((kind, i) => (
        <span key={i} className={`thumb-ui-align__line thumb-ui-align__line--${kind}`} />
      ))}
    </span>
  )
}

export type TextAlignControlsProps = {
  value: CanvasTextAlign
  onChange: (align: CanvasTextAlign) => void
}

export function TextAlignControls({ value, onChange }: TextAlignControlsProps) {
  return (
    <div className="thumb-ui-field">
      <span className="thumb-ui-label">정렬</span>
      <div className="thumb-ui-align" role="group" aria-label="텍스트 정렬">
        {ALIGN_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={
              value === opt.id
                ? 'thumb-ui-align__btn thumb-ui-align__btn--on'
                : 'thumb-ui-align__btn'
            }
            title={opt.title}
            aria-label={opt.title}
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
          >
            <AlignIcon align={opt.id} />
            <span className="thumb-ui-align__label">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

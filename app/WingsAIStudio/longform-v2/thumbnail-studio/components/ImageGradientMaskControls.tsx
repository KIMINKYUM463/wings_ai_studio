import { useState } from 'react'
import {
  buildImageGradientMaskPreviewCss,
  IMAGE_GRADIENT_MASK_DIRECTION_OPTIONS,
  normalizeImageGradientMask,
  type ImageGradientMaskDirection,
  type StudioImageGradientMask,
} from '@/lib/longform-v2/thumbnailTemplateStudio/imageGradientMask'

function DirectionIcon({ direction }: { direction: ImageGradientMaskDirection }) {
  const arrows: Record<ImageGradientMaskDirection, string> = {
    down: '↓',
    up: '↑',
    right: '→',
    left: '←',
  }
  return (
    <span className="thumb-ui-mask-dir__icon" aria-hidden>
      {arrows[direction]}
    </span>
  )
}

export type ImageGradientMaskControlsProps = {
  mask: StudioImageGradientMask | undefined
  onChange: (patch: Partial<StudioImageGradientMask>) => void
}

/** 썸네일 스튜디오 — 사진 그라데이션 마스크 (캡컷 스타일) */
export function ImageGradientMaskControls({ mask, onChange }: ImageGradientMaskControlsProps) {
  const [open, setOpen] = useState(true)
  const m = normalizeImageGradientMask(mask)
  const isRadial = m.type === 'radial'

  return (
    <section className="thumb-ui-mask">
      <div className="thumb-ui-mask__head">
        <button
          type="button"
          className="thumb-ui-mask__title-btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className={`thumb-ui-mask__chev${open ? ' thumb-ui-mask__chev--open' : ''}`} aria-hidden>
            ›
          </span>
          그라데이션 마스크
        </button>
        <label className="thumb-ui-toggle thumb-ui-toggle--compact">
          <span className="visually-hidden">그라데이션 마스크 사용</span>
          <input
            type="checkbox"
            checked={m.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          <span className="thumb-ui-toggle__track" aria-hidden />
        </label>
      </div>
      {open && m.enabled ? (
        <div className="thumb-ui-mask__body">
          <div
            className="thumb-ui-mask__preview"
            style={{ background: buildImageGradientMaskPreviewCss(m) }}
            aria-hidden
          />
          <div className="thumb-ui-mask__row">
            <span className="thumb-ui-mask__lbl">타입</span>
            <div className="thumb-ui-mask-type" role="group" aria-label="마스크 타입">
              <button
                type="button"
                title="원형 — 중심 유지·바깥 페이드"
                className={
                  isRadial
                    ? 'thumb-ui-mask-type__btn thumb-ui-mask-type__btn--on'
                    : 'thumb-ui-mask-type__btn'
                }
                onClick={() => onChange({ type: 'radial' })}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                  <circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
              <button
                type="button"
                title="선형 — 방향 선택"
                className={
                  !isRadial
                    ? 'thumb-ui-mask-type__btn thumb-ui-mask-type__btn--on'
                    : 'thumb-ui-mask-type__btn'
                }
                onClick={() => onChange({ type: 'rect', direction: m.direction ?? 'up' })}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                  <rect x="3.5" y="3.5" width="11" height="11" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            </div>
          </div>
          {!isRadial ? (
            <div className="thumb-ui-mask__row">
              <span className="thumb-ui-mask__lbl">방향</span>
              <div className="thumb-ui-mask-dir" role="group" aria-label="마스크 방향">
                {IMAGE_GRADIENT_MASK_DIRECTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={`${opt.label} — ${opt.hint}`}
                    className={
                      m.direction === opt.id
                        ? 'thumb-ui-mask-dir__btn thumb-ui-mask-dir__btn--on'
                        : 'thumb-ui-mask-dir__btn'
                    }
                    onClick={() => onChange({ type: 'rect', direction: opt.id })}
                  >
                    <DirectionIcon direction={opt.id} />
                    <span className="thumb-ui-mask-dir__label">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <label className="thumb-ui-field">
            <span>범위</span>
            <div className="thumb-ui-field__inline">
              <input
                type="range"
                min={5}
                max={100}
                step={1}
                value={m.range}
                onChange={(e) => onChange({ range: Number(e.target.value) })}
              />
              <input
                type="number"
                className="thumb-ui-field__number"
                min={5}
                max={100}
                step={1}
                value={m.range}
                onChange={(e) => {
                  const pct = Number(e.target.value)
                  if (!Number.isFinite(pct)) return
                  onChange({ range: pct })
                }}
              />
              <span className="thumb-ui-field__unit">%</span>
            </div>
          </label>
        </div>
      ) : null}
    </section>
  )
}

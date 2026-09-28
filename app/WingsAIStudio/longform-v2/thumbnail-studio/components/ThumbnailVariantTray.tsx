import type { ThumbnailStudioVariant } from '@/lib/longform-v2/thumbnailTemplateStudio/studioVariants'
import { MAX_STUDIO_VARIANTS } from '@/lib/longform-v2/thumbnailTemplateStudio/studioVariants'

type Props = {
  variants: ThumbnailStudioVariant[]
  activeVariantId: string | null
  busy?: boolean
  onSaveCurrent: () => void
  onGenerateAi: () => void
  onApply: (id: string) => void
  onRemove: (id: string) => void
}

export function ThumbnailVariantTray({
  variants,
  activeVariantId,
  busy,
  onSaveCurrent,
  onGenerateAi,
  onApply,
  onRemove,
}: Props) {
  return (
    <section className="thumb-ui-section thumb-ui-section--variants">
      <h4 className="thumb-ui-section__title">A/B 후보 ({variants.length}/{MAX_STUDIO_VARIANTS})</h4>
      <p className="thumb-ui-hint">
        여러 버전을 저장·비교한 뒤 마음에 드는 후보를 캔버스에 적용하세요.
      </p>
      <div className="thumb-variant-tray__actions">
        <button
          type="button"
          className="thumb-ui-btn thumb-ui-btn--outline"
          disabled={busy || variants.length >= MAX_STUDIO_VARIANTS}
          onClick={onSaveCurrent}
        >
          ＋ 현재 후보 저장
        </button>
        <button
          type="button"
          className="thumb-ui-btn thumb-ui-btn--primary"
          disabled={busy}
          onClick={onGenerateAi}
        >
          {busy ? 'AI 생성 중…' : '✨ AI 문구 후보'}
        </button>
      </div>
      {variants.length ? (
        <div className="thumb-variant-tray__grid">
          {variants.map((v) => (
            <div
              key={v.id}
              className={
                'thumb-variant-tray__item' +
                (activeVariantId === v.id ? ' thumb-variant-tray__item--on' : '')
              }
            >
              <button type="button" className="thumb-variant-tray__thumb" onClick={() => onApply(v.id)}>
                <img src={v.previewDataUrl} alt="" />
                <span className="thumb-variant-tray__label">{v.label}</span>
              </button>
              <button
                type="button"
                className="thumb-variant-tray__remove"
                title="후보 삭제"
                aria-label={`${v.label} 삭제`}
                onClick={() => onRemove(v.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="thumb-ui-hint">저장된 후보가 없습니다.</p>
      )}
    </section>
  )
}

import type { ThumbnailStudioSavedWorkMeta } from '@/lib/longform-v2/thumbnail-bridge/thumbnailStudioSavedWorksApi'
import { savedWorkSourceLabel } from '@/lib/longform-v2/thumbnail-bridge/thumbnailStudioSavedWorksApi'
import { getApiBase } from '@/lib/longform-v2/thumbnail-bridge/apiBase'

type Props = {
  works: ThumbnailStudioSavedWorkMeta[]
  activeWorkId: string | null
  loading?: boolean
  busy?: boolean
  onRefresh: () => void
  onSaveCurrent: () => void
  onLoad: (id: string) => void
  onRemove: (id: string) => void
}

function previewSrc(url: string): string {
  const raw = url.trim()
  if (!raw) return ''
  if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) return raw
  const base = getApiBase().replace(/\/$/, '')
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw.replace(/^\/+/, '')}`
}

function formatWhen(ts: number): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/** 프로젝트에 저장된 템플릿 썸네일 작업 목록 */
export function ThumbnailSavedWorksPanel({
  works,
  activeWorkId,
  loading,
  busy,
  onRefresh,
  onSaveCurrent,
  onLoad,
  onRemove,
}: Props) {
  return (
    <section className="thumb-ui-section thumb-ui-section--saved-works">
      <h4 className="thumb-ui-section__title">저장된 썸네일 작업</h4>
      <p className="thumb-ui-hint">
        이 프로젝트에서 템플릿으로 만든 작업(자동화·수동 저장)을 불러와 이어서 편집할 수 있습니다.
      </p>
      <div className="thumb-variant-tray__actions">
        <button
          type="button"
          className="thumb-ui-btn thumb-ui-btn--outline"
          disabled={busy}
          onClick={onSaveCurrent}
        >
          ＋ 현재 작업 저장
        </button>
        <button
          type="button"
          className="thumb-ui-btn thumb-ui-btn--ghost"
          disabled={loading || busy}
          onClick={onRefresh}
        >
          {loading ? '목록 불러오는 중…' : '↻ 새로고침'}
        </button>
      </div>
      {works.length ? (
        <div className="thumb-variant-tray__grid thumb-saved-works__grid">
          {works.map((w) => {
            const src = previewSrc(w.previewUrl)
            return (
              <div
                key={w.id}
                className={
                  'thumb-variant-tray__item' +
                  (activeWorkId === w.id ? ' thumb-variant-tray__item--on' : '')
                }
              >
                <button
                  type="button"
                  className="thumb-variant-tray__thumb"
                  disabled={busy}
                  onClick={() => onLoad(w.id)}
                  title={`${w.label} · ${savedWorkSourceLabel(w.source)}`}
                >
                  {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : (
                    <span className="thumb-saved-works__placeholder" aria-hidden>
                      🖼
                    </span>
                  )}
                  <span className="thumb-variant-tray__label">{w.label}</span>
                  <span className="thumb-saved-works__meta">
                    {savedWorkSourceLabel(w.source)}
                    {formatWhen(w.createdAt) ? ` · ${formatWhen(w.createdAt)}` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  className="thumb-variant-tray__remove"
                  title="저장 목록에서 삭제"
                  aria-label={`${w.label} 삭제`}
                  disabled={busy}
                  onClick={() => onRemove(w.id)}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="thumb-ui-hint">
          {loading ? '저장된 작업을 확인하는 중…' : '저장된 작업이 없습니다. 자동화 실행 후 또는 「현재 작업 저장」으로 추가하세요.'}
        </p>
      )}
    </section>
  )
}

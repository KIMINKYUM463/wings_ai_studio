import { getApiBase } from '@/lib/longform-v2/thumbnail-bridge/apiBase'
import type { ThumbnailStudioTab } from '@/lib/longform-v2/thumbnailTemplateStudio/studioTabsTypes'
import { MAX_STUDIO_TABS } from '@/lib/longform-v2/thumbnailTemplateStudio/studioTabsTypes'
import { tabOutputLanguageShort } from '@/lib/longform-v2/thumbnailTemplateStudio/studioTabOutputLanguage'
import { ThumbnailTabLanguagePicker } from './ThumbnailTabLanguagePicker'

type Props = {
  tabs: ThumbnailStudioTab[]
  activeTabId: string
  busy?: boolean
  outputLanguage: string
  onApplyOutputLanguage: (lang: string) => void
  outputLanguageDisabled?: boolean
  languageApplyBusy?: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onDuplicate?: (id: string) => void
  onClose?: (id: string) => void
}

function previewSrc(url: string | undefined): string {
  const raw = url?.trim() ?? ''
  if (!raw) return ''
  if (raw.startsWith('data:') || raw.startsWith('https://') || raw.startsWith('http://')) return raw
  const base = getApiBase().replace(/\/$/, '')
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw.replace(/^\/+/, '')}`
}

export function ThumbnailStudioTabBar({
  tabs,
  activeTabId,
  busy,
  outputLanguage,
  onApplyOutputLanguage,
  outputLanguageDisabled,
  languageApplyBusy,
  onSelect,
  onNew,
  onDuplicate,
  onClose,
}: Props) {
  return (
    <div className="thumb-studio__tabs-row">
      <div className="thumb-studio__tabs" role="tablist" aria-label="썸네일 작업 탭">
        {tabs.map((tab, i) => {
          const src = previewSrc(tab.previewUrl)
          const on = tab.id === activeTabId
          const langShort = tabOutputLanguageShort(tab.outputLanguage ?? 'ko')
          return (
            <div
              key={tab.id}
              className={'thumb-studio__tab-wrap' + (on ? ' thumb-studio__tab-wrap--on' : '')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={on}
                className={'thumb-studio__tab' + (on ? ' thumb-studio__tab--on' : '')}
                disabled={busy}
                onClick={() => onSelect(tab.id)}
                title={`${tab.label} · ${langShort}`}
              >
                <span className="thumb-studio__tab-thumb">
                  {src ? (
                    <img src={src} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="thumb-studio__tab-thumb-ph" aria-hidden>
                      {i + 1}
                    </span>
                  )}
                </span>
                <span className="thumb-studio__tab-meta">
                  <span className="thumb-studio__tab-label">{tab.label}</span>
                  <span className="thumb-studio__tab-lang" aria-hidden>
                    {langShort}
                  </span>
                </span>
              </button>
              {onDuplicate ? (
                <button
                  type="button"
                  className="thumb-studio__tab-dup"
                  aria-label={`${tab.label} 복제`}
                  title="썸네일 복제 (문구·레이아웃 유지)"
                  disabled={busy || tabs.length >= MAX_STUDIO_TABS}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDuplicate(tab.id)
                  }}
                >
                  ⧉
                </button>
              ) : null}
              {onClose && tabs.length > 1 ? (
                <button
                  type="button"
                  className="thumb-studio__tab-close"
                  aria-label={`${tab.label} 탭 닫기`}
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose(tab.id)
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          )
        })}
        <button
          type="button"
          className="thumb-studio__tab thumb-studio__tab--new"
          disabled={busy || tabs.length >= MAX_STUDIO_TABS}
          onClick={onNew}
          title={tabs.length >= MAX_STUDIO_TABS ? `최대 ${MAX_STUDIO_TABS}개` : '새 썸네일 만들기'}
        >
          <span className="thumb-studio__tab-new-icon" aria-hidden>
            +
          </span>
          새로 만들기
        </button>
      </div>
      <ThumbnailTabLanguagePicker
        variant="compact"
        appliedLanguage={outputLanguage}
        onApply={onApplyOutputLanguage}
        disabled={busy || outputLanguageDisabled}
        applyBusy={languageApplyBusy}
      />
    </div>
  )
}

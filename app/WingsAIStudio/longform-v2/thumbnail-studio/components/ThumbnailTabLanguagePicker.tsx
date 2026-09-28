import { useEffect, useState } from 'react'
import { THUMBNAIL_TAB_OUTPUT_LANGUAGE_OPTIONS } from '@/lib/longform-v2/thumbnailTemplateStudio/studioTabOutputLanguage'

export type ThumbnailTabLanguagePickerProps = {
  /** 현재 탭에 적용된 언어 */
  appliedLanguage: string
  onApply: (lang: string) => void | Promise<void>
  disabled?: boolean
  applyBusy?: boolean
  /** 탭 줄(compact) / 사이드바 */
  variant?: 'compact' | 'sidebar'
}

export function ThumbnailTabLanguagePicker({
  appliedLanguage,
  onApply,
  disabled,
  applyBusy,
  variant = 'compact',
}: ThumbnailTabLanguagePickerProps) {
  const [draft, setDraft] = useState(appliedLanguage)

  useEffect(() => {
    setDraft(appliedLanguage)
  }, [appliedLanguage])

  const pending = draft !== appliedLanguage
  const blocked = Boolean(disabled || applyBusy)

  const handleApply = () => {
    void Promise.resolve(onApply(draft))
  }

  if (variant === 'sidebar') {
    return (
      <section className="thumb-ui-section">
        <label className="thumb-ui-field">
          <span>썸네일 문구 언어</span>
          <select
            value={draft}
            disabled={blocked}
            aria-label="썸네일 AI 문구 출력 언어"
            onChange={(e) => setDraft(e.target.value)}
          >
            {THUMBNAIL_TAB_OUTPUT_LANGUAGE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="thumb-ui-btn thumb-ui-btn--outline"
          disabled={blocked || !pending}
          onClick={handleApply}
        >
          {applyBusy ? '문구 변경 중…' : pending ? '언어 적용' : '적용됨'}
        </button>
        <p className="thumb-ui-hint">
          언어를 고른 뒤 「언어 적용」을 누르면 <strong>원본 썸네일은 그대로</strong> 두고, 탭이
          복제된 뒤 <strong>복제본에 번역된 문구</strong>가 표시됩니다.
        </p>
      </section>
    )
  }

  return (
    <div className="thumb-studio__tab-lang-picker">
      <span className="thumb-studio__tab-lang-picker-label">썸네일 언어</span>
      <div className="thumb-studio__tab-lang-picker-row">
        <select
          value={draft}
          disabled={blocked}
          aria-label="선택한 썸네일에 적용할 AI 문구 출력 언어"
          onChange={(e) => setDraft(e.target.value)}
        >
          {THUMBNAIL_TAB_OUTPUT_LANGUAGE_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="thumb-studio__tab-lang-apply"
          disabled={blocked || !pending}
          onClick={handleApply}
          title={
            applyBusy
              ? '썸네일을 복제해 문구를 번역하는 중'
              : pending
                ? '탭을 복제한 뒤 선택한 언어로 문구 번역'
                : '이미 적용된 언어입니다'
          }
        >
          {applyBusy ? '…' : '적용'}
        </button>
      </div>
    </div>
  )
}

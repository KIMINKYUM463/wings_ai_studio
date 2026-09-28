import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { StoredCustomThumbnailTemplate } from '@/lib/longform-v2/thumbnailTemplateStudio/customTemplateStorage'

import '../../styles/thumbnail-template-studio.css'

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  initial?: StoredCustomThumbnailTemplate | null
  slotCount?: number
  onClose: () => void
  onSave: (payload: {
    label: string
    description: string
    tags: string[]
  }) => void | Promise<void>
  onDelete?: () => void | Promise<void>
}

export function CustomTemplateEditorModal({
  open,
  mode,
  initial,
  slotCount = 0,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [tagsText, setTagsText] = useState('커스텀')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLabel(initial?.label ?? '내 템플릿')
    setDescription(initial?.description ?? '')
    setTagsText((initial?.tags ?? ['커스텀']).join(', '))
    setError(null)
  }, [open, initial])

  if (!open) return null

  const title = mode === 'edit' ? '커스텀 템플릿 편집' : '커스텀 템플릿 추가'

  const handleSave = async () => {
    const trimmed = label.trim()
    if (!trimmed) {
      setError('템플릿 이름을 입력해 주세요.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const tags = tagsText
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean)
      await onSave({
        label: trimmed,
        description: description.trim(),
        tags: tags.length ? tags : ['커스텀'],
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    if (!window.confirm('이 커스텀 템플릿을 삭제할까요?')) return
    setBusy(true)
    setError(null)
    try {
      await onDelete()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="thumb-tpl-editor"
      role="dialog"
      aria-modal="true"
      aria-labelledby="thumb-tpl-editor-title"
    >
      <button type="button" className="thumb-tpl-editor__backdrop" aria-label="닫기" onClick={onClose} />
      <div className="thumb-tpl-editor__panel">
        <header className="thumb-tpl-editor__head">
          <h2 id="thumb-tpl-editor-title" className="thumb-tpl-editor__title">
            {title}
          </h2>
          <button type="button" className="thumb-tpl-modal__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <p className="thumb-tpl-editor__hint">
          문구 위치·색·크기는 캔버스에서 직접 수정한 뒤 <strong>「현재 레이아웃 저장」</strong>으로 슬롯을
          갱신할 수 있습니다.
          {slotCount > 0 ? (
            <>
              {' '}
              현재 <strong>{slotCount}개</strong> 문구 슬롯이 포함됩니다.
            </>
          ) : null}
        </p>

        <label className="thumb-tpl-editor__field">
          <span className="thumb-tpl-editor__label">이름</span>
          <input
            type="text"
            className="thumb-tpl-editor__input"
            value={label}
            maxLength={40}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 내 2단 하단 템플릿"
          />
        </label>

        <label className="thumb-tpl-editor__field">
          <span className="thumb-tpl-editor__label">설명</span>
          <textarea
            className="thumb-tpl-editor__textarea"
            value={description}
            rows={3}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="템플릿 용도를 간단히 적어 주세요."
          />
        </label>

        <label className="thumb-tpl-editor__field">
          <span className="thumb-tpl-editor__label">태그 (쉼표 구분)</span>
          <input
            type="text"
            className="thumb-tpl-editor__input"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="커스텀, 2단, 하단"
          />
        </label>

        {error ? <p className="thumb-tpl-editor__error">{error}</p> : null}

        <div className="thumb-tpl-editor__actions">
          {mode === 'edit' && onDelete ? (
            <button
              type="button"
              className="yt-upload__btn yt-upload__btn--ghost thumb-tpl-editor__delete"
              disabled={busy}
              onClick={() => void handleDelete()}
            >
              삭제
            </button>
          ) : (
            <span />
          )}
          <div className="thumb-tpl-editor__actions-right">
            <button type="button" className="yt-upload__btn yt-upload__btn--ghost" disabled={busy} onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className="yt-upload__btn yt-upload__btn--primary"
              disabled={busy}
              onClick={() => void handleSave()}
            >
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { StepToolbarSaveBinder } from '@/lib/longform-v2/thumbnail-bridge/useRegisterStepToolbarSave'
import { YoutubeThumbnailTemplateStudio } from './YoutubeThumbnailTemplateStudio'

import '../styles/thumbnail-template-studio.css'

export type ThumbnailTemplateStudioModalProps = {
  open: boolean
  onClose: () => void
  bindStepToolbarSave?: StepToolbarSaveBinder
  projectId: string
  topic: string
  script: string
  titleHint?: string
  downloadFileBaseName?: string
  thumbnailOutputLanguage?: string
  scriptByLanguage?: Record<string, string> | null
  onSaved?: (thumbnailUrl: string) => void
}

export function ThumbnailTemplateStudioModal({
  open,
  onClose,
  onSaved,
  bindStepToolbarSave,
  ...studioProps
}: ThumbnailTemplateStudioModalProps) {
  const [closing, setClosing] = useState(false)
  const saveOnCloseRef = useRef<(() => Promise<boolean>) | null>(null)

  const bindModalCloseSave = useCallback<StepToolbarSaveBinder>((fn) => {
    saveOnCloseRef.current = fn as (() => Promise<boolean>) | null
  }, [])

  const handleSaved = useCallback(
    (thumbnailUrl: string) => {
      onSaved?.(thumbnailUrl)
    },
    [onSaved],
  )

  const requestClose = useCallback(async () => {
    if (closing) return
    setClosing(true)
    try {
      const save = saveOnCloseRef.current
      if (save) {
        const ok = await save()
        if (!ok) return
      }
      onClose()
    } finally {
      setClosing(false)
    }
  }, [closing, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closing) void requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closing, requestClose])

  if (!open) return null

  return createPortal(
    <div
      className="thumb-studio-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="thumb-studio-modal-title"
    >
      <button
        type="button"
        className="thumb-studio-modal__backdrop"
        aria-label="편집기 닫기"
        disabled={closing}
        onClick={() => void requestClose()}
      />
      <div className="thumb-studio-modal__shell">
        <header className="thumb-studio-modal__header">
          <div className="thumb-studio-modal__brand">
            <span className="thumb-studio-modal__logo" aria-hidden>
              🖼
            </span>
            <div>
              <h2 id="thumb-studio-modal-title" className="thumb-studio-modal__title">
                썸네일 편집기
              </h2>
              <p className="thumb-studio-modal__sub">AI 썸네일 템플릿</p>
            </div>
          </div>
          <button
            type="button"
            className="thumb-studio-modal__close"
            onClick={() => void requestClose()}
            disabled={closing}
            aria-label={closing ? '저장 중' : '닫기'}
          >
            {closing ? '…' : '✕'}
          </button>
        </header>
        <div className="thumb-studio-modal__body">
          <YoutubeThumbnailTemplateStudio
            key={studioProps.projectId}
            layout="modal"
            bindStepToolbarSave={bindStepToolbarSave}
            bindModalCloseSave={bindModalCloseSave}
            onSaved={handleSaved}
            {...studioProps}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}

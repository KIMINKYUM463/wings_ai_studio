import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  previewSrc: string
  title?: string
  channelName?: string
  onClose: () => void
}

function MockCard({
  width,
  label,
  previewSrc,
  title,
  channelName,
}: {
  width: number
  label: string
  previewSrc: string
  title: string
  channelName: string
}) {
  const thumbH = Math.round((width * 9) / 16)
  return (
    <div className="thumb-feed-preview__card">
      <p className="thumb-feed-preview__card-label">{label}</p>
      <div className="thumb-feed-preview__mock" style={{ width }}>
        <div
          className="thumb-feed-preview__thumb"
          style={{
            width,
            height: thumbH,
            background: previewSrc
              ? `center/cover no-repeat url(${previewSrc})`
              : 'linear-gradient(135deg, #334155, #64748b)',
          }}
        />
        <div className="thumb-feed-preview__meta">
          <div className="thumb-feed-preview__avatar" aria-hidden />
          <div className="thumb-feed-preview__lines">
            <p className="thumb-feed-preview__video-title">{title}</p>
            <p className="thumb-feed-preview__channel">{channelName}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ThumbnailFeedPreviewModal({
  open,
  previewSrc,
  title = '영상 제목 미리보기 — 작게 봤을 때 글자가 읽히는지 확인하세요',
  channelName = '내 채널',
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="thumb-feed-preview" role="dialog" aria-modal="true" aria-label="유튜브 피드 미리보기">
      <button type="button" className="thumb-feed-preview__backdrop" aria-label="닫기" onClick={onClose} />
      <div className="thumb-feed-preview__panel">
        <header className="thumb-feed-preview__head">
          <div>
            <h2 className="thumb-feed-preview__title-main">유튜브 피드 미리보기</h2>
            <p className="thumb-feed-preview__sub">실제 노출 크기에서 글자·대비·후킹이 보이는지 확인하세요.</p>
          </div>
          <button type="button" className="thumb-feed-preview__close" onClick={onClose}>
            닫기 ✕
          </button>
        </header>
        <div className="thumb-feed-preview__grid">
          <MockCard width={320} label="홈 피드 (데스크톱)" previewSrc={previewSrc} title={title} channelName={channelName} />
          <MockCard width={168} label="홈 피드 (축소)" previewSrc={previewSrc} title={title} channelName={channelName} />
          <MockCard width={120} label="검색·추천 (작게)" previewSrc={previewSrc} title={title} channelName={channelName} />
          <MockCard width={96} label="모바일 (매우 작게)" previewSrc={previewSrc} title={title} channelName={channelName} />
        </div>
      </div>
    </div>,
    document.body,
  )
}

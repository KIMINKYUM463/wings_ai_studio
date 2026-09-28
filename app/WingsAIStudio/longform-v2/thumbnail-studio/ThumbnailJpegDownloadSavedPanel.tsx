import { useEffect, useState } from 'react'
import { formatBlobDownloadSavedMessage, type TriggerBlobDownloadResult } from '@/lib/longform-v2/thumbnail-bridge/thumbnailDownload'

type Props = {
  result: TriggerBlobDownloadResult
  openBusy: boolean
  onOpenLocation: () => void
  className?: string
}

function collapsedSummary(result: TriggerBlobDownloadResult): string {
  if (result.savedPath) {
    const parts = result.savedPath.replace(/\\/g, '/').split('/')
    const name = parts[parts.length - 1] || result.filename
    return `PC에 저장됨 · ${name}`
  }
  return `「${result.filename}」 저장됨`
}

export function ThumbnailJpegDownloadSavedPanel({ result, openBusy, onOpenLocation, className }: Props) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setExpanded(false)
  }, [result.savedPath, result.filename, result.mode])

  if (result.cancelled) return null

  const rootClass = ['thumb-studio__download-saved', className].filter(Boolean).join(' ')
  const summary = formatBlobDownloadSavedMessage(result)

  if (!expanded) {
    return (
      <div className={`${rootClass} thumb-studio__download-saved--collapsed`}>
        <p className="thumb-studio__download-saved-collapsedText">{collapsedSummary(result)}</p>
        <button
          type="button"
          className="thumb-studio__download-saved-toggle"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
        >
          펼치기
        </button>
      </div>
    )
  }

  return (
    <div className={rootClass}>
      <div className="thumb-studio__download-saved-head">
        <p className="thumb-studio__info thumb-studio__download-saved-summary">{summary}</p>
        <button
          type="button"
          className="thumb-studio__download-saved-toggle"
          onClick={() => setExpanded(false)}
          aria-expanded
        >
          접기
        </button>
      </div>
      <p className="thumb-studio__download-saved-label">JPEG 저장 위치</p>
      {result.savedPath ? (
        <code className="thumb-studio__download-saved-path" title={result.savedPath}>
          {result.savedPath}
        </code>
      ) : (
        <p className="thumb-studio__download-saved-hint">
          브라우저「다운로드」폴더에 「{result.filename}」으로 저장되었습니다.
        </p>
      )}
      <button
        type="button"
        className="yt-upload__btn yt-upload__btn--ghost thumb-studio__download-saved-open"
        disabled={openBusy}
        onClick={() => void onOpenLocation()}
      >
        {openBusy ? '여는 중…' : '저장 위치 열기'}
      </button>
    </div>
  )
}

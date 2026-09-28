import { useCallback, useState } from 'react'

type Props = {
  text: string
  lineClassName: string
  rowClassName?: string
  copyClassName?: string
  onCopied?: (text: string) => void
}

/** 추천 조합 1줄 + 클립보드 복사 */
export function CopyComboLineRow({
  text,
  lineClassName,
  rowClassName = 'thumb-studio__copy-ref-combo-line-row',
  copyClassName = 'thumb-studio__copy-ref-combo-line-copy',
  onCopied,
}: Props) {
  const [copied, setCopied] = useState(false)

  const copyLine = useCallback(() => {
    const value = text.trim()
    if (!value) return
    void navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true)
        onCopied?.(value)
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => {
        /* clipboard denied — ignore */
      },
    )
  }, [onCopied, text])

  return (
    <div className={rowClassName}>
      <p className={lineClassName}>{text}</p>
      <button
        type="button"
        className={copyClassName + (copied ? ' thumb-studio__copy-ref-combo-line-copy--done' : '')}
        title="클립보드에 복사"
        aria-label={`"${text}" 복사`}
        onClick={copyLine}
      >
        {copied ? '복사됨' : '복사'}
      </button>
    </div>
  )
}

import { useMemo } from 'react'
import { buildThumbnailTextCoordLogLines } from '@/lib/longform-v2/thumbnailTemplateStudio/textCoordLogLines'
import type { ThumbnailStudioDocument } from '@/lib/longform-v2/thumbnailTemplateStudio/types'

type Props = {
  doc: ThumbnailStudioDocument
  /** 드래그 중 실시간 좌표 (applyDragLiveOverlay 적용 문서) */
  liveDoc?: ThumbnailStudioDocument | null
}

export function ThumbnailTextCoordLog({ doc, liveDoc }: Props) {
  const lines = useMemo(
    () => buildThumbnailTextCoordLogLines(liveDoc ?? doc),
    [doc, liveDoc],
  )

  if (!lines.length) return null

  return (
    <div className="thumb-studio__coord-log" aria-label="문구 좌표 로그">
      <p className="thumb-studio__coord-log-title">문구 좌표 (1280×720)</p>
      <pre className="thumb-studio__coord-log-pre">
        {lines.map((line) => (
          <span key={line} className="thumb-studio__coord-log-line">
            {line}
            {'\n'}
          </span>
        ))}
      </pre>
    </div>
  )
}

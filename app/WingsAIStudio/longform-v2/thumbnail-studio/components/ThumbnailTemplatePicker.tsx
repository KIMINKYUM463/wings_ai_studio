import { useState } from 'react'
import { THUMBNAIL_PRO_TEMPLATES } from '@/lib/longform-v2/thumbnailTemplateStudio/catalog'
import {
  ThumbnailTemplateCard,
  type ThumbnailPreviewZoomPayload,
} from './ThumbnailTemplateCard'
import { ThumbnailPreviewLightbox } from './ThumbnailPreviewLightbox'

type Props = {
  selectedId: string
  onSelect: (id: string) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function ThumbnailTemplatePicker({ selectedId, onSelect, collapsed, onToggleCollapse }: Props) {
  const [previewLightbox, setPreviewLightbox] = useState<ThumbnailPreviewZoomPayload | null>(null)

  if (collapsed) {
    const cur = THUMBNAIL_PRO_TEMPLATES.find((t) => t.id === selectedId)
    return (
      <div className="thumb-studio__templates">
        <div className="thumb-studio__templates-head">
          <p className="thumb-studio__templates-title">선택 템플릿: {cur?.label ?? selectedId}</p>
          {onToggleCollapse ? (
            <button type="button" className="yt-upload__btn yt-upload__btn--ghost" onClick={onToggleCollapse}>
              템플릿 변경
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="thumb-studio__templates">
      <div className="thumb-studio__templates-head">
        <p className="thumb-studio__templates-title">썸네일 템플릿 선택</p>
        {onToggleCollapse ? (
          <button type="button" className="yt-upload__btn yt-upload__btn--ghost" onClick={onToggleCollapse}>
            접기
          </button>
        ) : null}
      </div>
      <p className="yt-upload__muted" style={{ margin: '0 0 0.65rem', fontSize: '0.82rem' }}>
        미리보기 이미지는 글자 위치·스타일 샘플입니다(사극·우주 등 주제와 무관). 배경·인물은 주제·대본으로
        생성되며, 문구·위치는 캔버스에서 수정할 수 있습니다. 샘플 사진은 <strong>확대</strong> 버튼으로 크게 볼 수
        있습니다.
      </p>
      <div className="thumb-studio__template-grid" role="listbox" aria-label="썸네일 템플릿">
        {THUMBNAIL_PRO_TEMPLATES.map((t) => (
          <ThumbnailTemplateCard
            key={t.id}
            template={t}
            selected={selectedId === t.id}
            variant="grid"
            onSelect={() => onSelect(t.id)}
            onPreviewZoom={setPreviewLightbox}
          />
        ))}
      </div>
      {previewLightbox ? (
        <ThumbnailPreviewLightbox
          src={previewLightbox.src}
          template={previewLightbox.template}
          caption={previewLightbox.caption}
          onClose={() => setPreviewLightbox(null)}
        />
      ) : null}
    </div>
  )
}

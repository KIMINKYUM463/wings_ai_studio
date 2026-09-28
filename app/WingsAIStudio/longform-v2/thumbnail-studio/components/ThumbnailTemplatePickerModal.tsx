import { useEffect, useMemo, useState, type MouseEvent } from 'react'

import { createPortal } from 'react-dom'

import { THUMBNAIL_PRO_TEMPLATES } from '@/lib/longform-v2/thumbnailTemplateStudio/catalog'

import type { ThumbnailProTemplate } from '@/lib/longform-v2/thumbnailTemplateStudio/types'

import {

  createBlankCustomTemplate,

  cloneBuiltinAsCustom,

  deleteCustomTemplate,

  loadCustomTemplates,

  subscribeCustomTemplates,

  upsertCustomTemplate,

  type StoredCustomThumbnailTemplate,

} from '@/lib/longform-v2/thumbnailTemplateStudio/customTemplateStorage'

import {
  ThumbnailTemplateCard,
  type ThumbnailPreviewZoomPayload,
} from './ThumbnailTemplateCard'

import { ThumbnailPreviewLightbox } from './ThumbnailPreviewLightbox'

import { CustomTemplateEditorModal } from './CustomTemplateEditorModal'

import { ThumbnailGenSettingsBar, ThumbnailGenStyleSelectionSummary } from './ThumbnailGenSettingsBar'
import { getProTemplate } from '@/lib/longform-v2/thumbnailTemplateStudio/catalog'

import type { ThumbnailGenSettings } from '@/lib/longform-v2/thumbnailTemplateStudio/thumbnailGenSettings'



import '../../styles/thumbnail-template-studio.css'



type Props = {

  open: boolean

  selectedId: string

  onClose: () => void

  onSelect: (id: string) => void

  onSaveCurrentAsCustom?: () => void

  genSettings: ThumbnailGenSettings

  onGenSettingsChange: (next: ThumbnailGenSettings) => void

  genSettingsDisabled?: boolean

}



type EditorState = { mode: 'edit'; template: StoredCustomThumbnailTemplate } | null



export function ThumbnailTemplatePickerModal({

  open,

  selectedId,

  onClose,

  onSelect,

  onSaveCurrentAsCustom,

  genSettings,

  onGenSettingsChange,

  genSettingsDisabled = false,

}: Props) {

  const [previewLightbox, setPreviewLightbox] = useState<ThumbnailPreviewZoomPayload | null>(null)

  const [customTemplates, setCustomTemplates] = useState(() => loadCustomTemplates())

  const [editor, setEditor] = useState<EditorState>(null)

  const selectedTemplateLabel = useMemo(() => {
    const custom = customTemplates.find((t) => t.id === selectedId)
    if (custom) return custom.label
    return getProTemplate(selectedId)?.label ?? selectedId
  }, [customTemplates, selectedId])

  useEffect(() => {

    if (!open) setPreviewLightbox(null)

  }, [open])



  useEffect(() => subscribeCustomTemplates(() => setCustomTemplates(loadCustomTemplates())), [])



  const handleDuplicateBuiltin = (tpl: ThumbnailProTemplate, e: MouseEvent) => {

    e.preventDefault()

    e.stopPropagation()

    const cloned = cloneBuiltinAsCustom(tpl)

    upsertCustomTemplate(cloned)

    setEditor({ mode: 'edit', template: cloned })

  }



  const handleCreateBlank = () => {

    const blank = createBlankCustomTemplate()

    upsertCustomTemplate(blank)

    setEditor({ mode: 'edit', template: blank })

  }



  const handleEditCustom = (tpl: StoredCustomThumbnailTemplate, e: MouseEvent) => {

    e.preventDefault()

    e.stopPropagation()

    setEditor({ mode: 'edit', template: tpl })

  }



  const handleDeleteCustom = (id: string, e: MouseEvent) => {

    e.preventDefault()

    e.stopPropagation()

    if (!window.confirm('이 커스텀 템플릿을 삭제할까요?')) return

    deleteCustomTemplate(id)

  }



  return (

    <>

      {open

        ? createPortal(

            <div

              className="thumb-tpl-modal"

              role="dialog"

              aria-modal="true"

              aria-labelledby="thumb-tpl-modal-title"

            >

              <button

                type="button"

                className="thumb-tpl-modal__backdrop"

                aria-label="닫기"

                onClick={onClose}

              />

              <div className="thumb-tpl-modal__panel thumb-tpl-modal__panel--wide thumb-tpl-modal__panel--split">

                <header className="thumb-tpl-modal__head">

                  <h2 id="thumb-tpl-modal-title" className="thumb-tpl-modal__title">

                    썸네일 템플릿 선택

                  </h2>

                  <div className="thumb-tpl-modal__head-actions">

                    {onSaveCurrentAsCustom ? (

                      <button

                        type="button"

                        className="yt-upload__btn yt-upload__btn--ghost"

                        onClick={onSaveCurrentAsCustom}

                      >

                        현재 레이아웃 저장

                      </button>

                    ) : null}

                    <button

                      type="button"

                      className="yt-upload__btn yt-upload__btn--primary"

                      onClick={handleCreateBlank}

                    >

                      + 커스텀 추가

                    </button>

                    <button

                      type="button"

                      className="thumb-tpl-modal__close"

                      onClick={onClose}

                      aria-label="닫기"

                    >

                      ✕

                    </button>

                  </div>

                </header>

                <p className="thumb-tpl-modal__lead">

                  미리보기는 <strong>글자 배치 샘플</strong>입니다. 배경·인물은 주제·대본으로 생성됩니다.

                  기본 템플릿은 <strong>복제</strong>해 커스텀으로 수정할 수 있고, 캔버스에서 편집한 뒤{' '}

                  <strong>현재 레이아웃 저장</strong>으로 내 템플릿을 만들 수 있습니다.

                </p>

                <div className="thumb-tpl-modal__main">
                <div className="thumb-tpl-modal__scroll">

                {customTemplates.length > 0 ? (

                  <section className="thumb-tpl-modal__section">

                    <h3 className="thumb-tpl-modal__section-title">내 템플릿</h3>

                    <div className="thumb-tpl-modal__grid" role="listbox" aria-label="커스텀 템플릿">

                      {customTemplates.map((t) => (

                        <ThumbnailTemplateCard

                          key={t.id}

                          template={t}

                          selected={selectedId === t.id}

                          variant="modal"

                          isCustom

                          onSelect={() => {

                            onSelect(t.id)

                            onClose()

                          }}

                          onPreviewZoom={setPreviewLightbox}

                          onEdit={(e) => handleEditCustom(t, e)}

                          onDelete={(e) => handleDeleteCustom(t.id, e)}

                        />

                      ))}

                    </div>

                  </section>

                ) : null}



                <section className="thumb-tpl-modal__section">

                  <h3 className="thumb-tpl-modal__section-title">기본 템플릿</h3>

                  <div className="thumb-tpl-modal__grid" role="listbox" aria-label="기본 썸네일 템플릿">

                    {THUMBNAIL_PRO_TEMPLATES.map((t) => (

                      <ThumbnailTemplateCard

                        key={t.id}

                        template={t}

                        selected={selectedId === t.id}

                        variant="modal"

                        onSelect={() => {

                          onSelect(t.id)

                          onClose()

                        }}

                        onPreviewZoom={setPreviewLightbox}

                        onDuplicate={(e) => handleDuplicateBuiltin(t, e)}

                      />

                    ))}

                  </div>

                </section>

                </div>

                <aside className="thumb-tpl-modal__settings" aria-label="AI 배경 이미지 설정">
                <ThumbnailGenStyleSelectionSummary
                  settings={genSettings}
                  selectedTemplateLabel={selectedTemplateLabel}
                />

                <ThumbnailGenSettingsBar
                  settings={genSettings}
                  onChange={onGenSettingsChange}
                  disabled={genSettingsDisabled}
                />
                </aside>
                </div>

              </div>

            </div>,

            document.body,

          )

        : null}

      {previewLightbox ? (
        <ThumbnailPreviewLightbox
          src={previewLightbox.src}
          template={previewLightbox.template}
          caption={previewLightbox.caption}
          onClose={() => setPreviewLightbox(null)}
        />
      ) : null}

      <CustomTemplateEditorModal

        open={editor !== null}

        mode="edit"

        initial={editor?.template ?? null}

        slotCount={editor?.template.textSlots.length ?? 0}

        onClose={() => setEditor(null)}

        onSave={async (payload) => {

          if (editor?.template) {

            upsertCustomTemplate({

              ...editor.template,

              ...payload,

            })

          }

        }}

        onDelete={

          editor?.template

            ? async () => {

                deleteCustomTemplate(editor.template.id)

              }

            : undefined

        }

      />

    </>

  )

}



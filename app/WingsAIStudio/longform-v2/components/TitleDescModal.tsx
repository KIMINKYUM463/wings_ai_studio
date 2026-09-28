"use client"

export type TitleItem = { title: string; description: string }

export type TitleMeta = {
  description: string
  hashtags: string
  uploadTags: string[]
  pinnedComment: string
  loading: boolean
  error: string | null
}

type Props = {
  open: boolean
  busy: boolean
  items: TitleItem[]
  selectedTitle: string
  selectedItem: TitleItem | null
  selectedMeta?: TitleMeta
  onClose: () => void
  onSelectTitle: (title: string) => void
  onCopyField: (label: string, text: string) => void
  onRegenerate: () => void
}

/** WingsStudio DetailModeTitleDescModal 대응 */
export function TitleDescModal({
  open,
  busy,
  items,
  selectedTitle,
  selectedItem,
  selectedMeta,
  onClose,
  onSelectTitle,
  onCopyField,
  onRegenerate,
}: Props) {
  if (!open) return null

  const showResults = items.length > 0
  const metaReady =
    selectedMeta &&
    !selectedMeta.loading &&
    !selectedMeta.error &&
    (selectedMeta.description.trim() || selectedMeta.uploadTags.length > 0)
  const tagsText = selectedMeta?.uploadTags?.length ? selectedMeta.uploadTags.join(", ") : ""

  return (
    <div
      className="dm-batch-overlay"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dm-title-modal" role="dialog" aria-modal="true" aria-labelledby="lfv2-title-desc-title">
        <header className="dm-batch-head">
          <h3 id="lfv2-title-desc-title">✨ 제목/설명 생성</h3>
          <button type="button" className="dm-close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>

        <p className="dm-title-modal__lead">
          대본을 참고해 유튜브 업로드용 제목·설명 후보를 만듭니다. 제목 카드를 누르면 전체 설명과 태그가
          아래에 표시됩니다.
        </p>

        <div className={"dm-title-modal__body" + (busy ? " dm-title-modal__body--busy" : "")}>
          {busy && !showResults ? (
            <div className="dm-title-modal__loading" role="status">
              <span className="dm-title-modal__spinner" aria-hidden />
              Gemini가 제목·설명 후보를 만들고 있습니다…
            </div>
          ) : null}

          {!busy && !showResults ? (
            <p className="dm-muted dm-title-modal__empty">후보가 없습니다. 아래 「생성하기」를 눌러 주세요.</p>
          ) : null}

          {showResults ? (
            <div className={"dm-title-modal__results" + (busy ? " dm-title-modal__results--busy" : "")}>
              {busy ? (
                <div className="dm-title-modal__loading dm-title-modal__loading--inline" role="status">
                  <span className="dm-title-modal__spinner" aria-hidden />
                  다시 생성 중…
                </div>
              ) : null}
              <div className="dm-title-panel__head">
                <span className="dm-title-panel__label">후보 {items.length}개</span>
                {selectedItem ? (
                  <div className="dm-title-panel__copy">
                    <button
                      type="button"
                      className="dm-btn dm-btn--ghost dm-title-panel__copy-btn"
                      onClick={() => onCopyField("제목", selectedItem.title)}
                    >
                      제목 복사
                    </button>
                    {metaReady && selectedMeta?.description ? (
                      <button
                        type="button"
                        className="dm-btn dm-btn--ghost dm-title-panel__copy-btn"
                        onClick={() => onCopyField("설명", selectedMeta.description)}
                      >
                        설명 복사
                      </button>
                    ) : null}
                    {metaReady && tagsText ? (
                      <button
                        type="button"
                        className="dm-btn dm-btn--ghost dm-title-panel__copy-btn"
                        onClick={() => onCopyField("태그", tagsText)}
                      >
                        태그 복사
                      </button>
                    ) : null}
                    {metaReady ? (
                      <button
                        type="button"
                        className="dm-btn dm-btn--ghost dm-title-panel__copy-btn"
                        onClick={() =>
                          onCopyField(
                            "제목·설명·태그",
                            [
                              selectedItem.title,
                              selectedMeta?.description ?? "",
                              selectedMeta?.hashtags ? `\n${selectedMeta.hashtags}` : "",
                              tagsText ? `\n\n태그: ${tagsText}` : "",
                            ]
                              .filter(Boolean)
                              .join("\n\n")
                          )
                        }
                      >
                        전체 복사
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="dm-btn dm-btn--ghost dm-title-panel__copy-btn"
                        onClick={() =>
                          onCopyField(
                            "제목·요약",
                            selectedItem.description
                              ? `${selectedItem.title}\n\n${selectedItem.description}`
                              : selectedItem.title
                          )
                        }
                      >
                        제목·요약 복사
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="dm-muted">제목 카드를 눌러 선택하세요</span>
                )}
              </div>
              <div className="dm-title-grid">
                {items.map((item, idx) => {
                  const on = selectedTitle === item.title
                  return (
                    <button
                      key={`${idx}-${item.title.slice(0, 24)}`}
                      type="button"
                      className={"dm-title-card" + (on ? " dm-title-card--on" : "")}
                      onClick={() => onSelectTitle(item.title)}
                    >
                      <span className="dm-title-card__num">{idx + 1}</span>
                      <span className="dm-title-card__title">{item.title}</span>
                      {item.description ? (
                        <span className="dm-title-card__desc">{item.description}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              {selectedItem ? (
                <section className="dm-title-detail" aria-live="polite">
                  <h4 className="dm-title-detail__head">선택: {selectedItem.title}</h4>
                  {selectedMeta?.loading ? (
                    <div className="dm-title-detail__loading" role="status">
                      <span className="dm-title-modal__spinner" aria-hidden />
                      유튜브 설명·해시태그·업로드 태그 생성 중…
                    </div>
                  ) : null}
                  {selectedMeta?.error ? (
                    <p className="dm-title-detail__err">{selectedMeta.error}</p>
                  ) : null}
                  {metaReady ? (
                    <>
                      {selectedMeta.description ? (
                        <div className="dm-title-detail__block">
                          <div className="dm-title-detail__block-head">
                            <span className="dm-title-detail__label">설명</span>
                            <button
                              type="button"
                              className="dm-scene-prompt-copy"
                              onClick={() => onCopyField("설명", selectedMeta.description)}
                            >
                              복사
                            </button>
                          </div>
                          <pre className="dm-title-detail__pre">{selectedMeta.description}</pre>
                        </div>
                      ) : null}
                      {selectedMeta.hashtags ? (
                        <div className="dm-title-detail__block">
                          <div className="dm-title-detail__block-head">
                            <span className="dm-title-detail__label">해시태그</span>
                            <button
                              type="button"
                              className="dm-scene-prompt-copy"
                              onClick={() => onCopyField("해시태그", selectedMeta.hashtags)}
                            >
                              복사
                            </button>
                          </div>
                          <p className="dm-title-detail__tags">{selectedMeta.hashtags}</p>
                        </div>
                      ) : null}
                      {selectedMeta.uploadTags.length > 0 ? (
                        <div className="dm-title-detail__block">
                          <div className="dm-title-detail__block-head">
                            <span className="dm-title-detail__label">
                              업로드 태그 ({selectedMeta.uploadTags.length}개)
                            </span>
                            <button
                              type="button"
                              className="dm-scene-prompt-copy"
                              onClick={() => onCopyField("업로드 태그", tagsText)}
                            >
                              복사
                            </button>
                          </div>
                          <p className="dm-title-detail__tags">{tagsText}</p>
                        </div>
                      ) : null}
                      {selectedMeta.pinnedComment ? (
                        <div className="dm-title-detail__block">
                          <div className="dm-title-detail__block-head">
                            <span className="dm-title-detail__label">고정 댓글</span>
                            <button
                              type="button"
                              className="dm-scene-prompt-copy"
                              onClick={() => onCopyField("고정 댓글", selectedMeta.pinnedComment)}
                            >
                              복사
                            </button>
                          </div>
                          <pre className="dm-title-detail__pre">{selectedMeta.pinnedComment}</pre>
                        </div>
                      ) : null}
                    </>
                  ) : !selectedMeta?.loading && !selectedMeta?.error ? (
                    <p className="dm-muted dm-title-detail__hint">제목을 선택하면 설명과 태그를 불러옵니다.</p>
                  ) : null}
                </section>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="dm-batch-foot">
          <button type="button" className="dm-btn dm-btn--ghost" onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className="dm-btn dm-btn--accent"
            disabled={busy}
            onClick={() => void onRegenerate()}
          >
            {busy ? "생성 중…" : showResults ? "다시 생성" : "생성하기"}
          </button>
        </footer>
      </div>
    </div>
  )
}

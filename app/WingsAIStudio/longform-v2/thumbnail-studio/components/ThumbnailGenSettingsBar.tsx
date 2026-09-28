import { useMemo } from 'react'
import {
  SCENE_STYLE_CATALOG,
  sceneStyleCategoryLabel,
  sceneStyleSampleDataUrl,
  sceneStyleSampleUrl,
  type SceneStyleCategory,
} from '@/lib/longform-v2/image-styles'
import {
  SCENE_IMAGE_MODEL_OPTIONS,
  sceneImageModelLabel,
  type SceneImageModelId,
} from '@/lib/longform-v2/thumbnail-bridge/sceneImageModelOptions'
import type { ImageLocaleMode } from '@/lib/longform-v2/youtube/imageLocaleMode'
import { imageLocaleModeLabel } from '@/lib/longform-v2/youtube/imageLocaleMode'
import type { TopicStyleRecUi } from '@/lib/longform-v2/thumbnail-bridge/useTopicStyleRecommendations'
import { TopicStyleRecommendBanner } from '../TopicStyleRecommendBanner'
import { SceneStyleCardBadge } from '../SceneStyleRecBadge'
import {
  thumbnailGenSelectedStyleItem,
  thumbnailGenSettingsFullSummary,
  thumbnailStyleCategoriesForModel,
  type ThumbnailGenSettings,
} from '@/lib/longform-v2/thumbnailTemplateStudio/thumbnailGenSettings'

type Props = {
  settings: ThumbnailGenSettings
  onChange: (next: ThumbnailGenSettings) => void
  disabled?: boolean
  /** 템플릿 선택 모달 — 선택 요약만 표시 */
  summaryOnly?: boolean
  /** 사이드바 AI스타일 탭 — 제목·여백 축소 */
  embedded?: boolean
  /** null이면 주제 맞춤 스타일 추천 숨김 */
  topicStyleRec?: TopicStyleRecUi | null
}

/** 템플릿 그리드 아래 — 현재 선택된 AI 스타일 미리보기 */
export function ThumbnailGenStyleSelectionSummary({
  settings,
  selectedTemplateLabel,
}: {
  settings: ThumbnailGenSettings
  selectedTemplateLabel?: string
}) {
  const styleItem = thumbnailGenSelectedStyleItem(settings)
  const fileSrc = sceneStyleSampleUrl(settings.styleCategory, styleItem.id)

  return (
    <div className="thumb-tpl-modal__picked-bar" aria-live="polite">
      {selectedTemplateLabel ? (
        <p className="thumb-tpl-modal__picked-line">
          <span className="thumb-tpl-modal__picked-label">선택 템플릿</span>
          <strong>{selectedTemplateLabel}</strong>
        </p>
      ) : null}
      <div className="thumb-tpl-modal__picked-style">
        <span className="thumb-tpl-modal__picked-label">선택 이미지 스타일</span>
        <span className="thumb-tpl-modal__picked-style-thumb">
          <img
            src={fileSrc}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const img = e.currentTarget
              img.onerror = null
              img.src = sceneStyleSampleDataUrl(
                styleItem.hue,
                styleItem.label,
                settings.styleCategory,
                styleItem.id,
              )
            }}
          />
        </span>
        <p className="thumb-tpl-modal__picked-style-text">{thumbnailGenSettingsFullSummary(settings)}</p>
      </div>
    </div>
  )
}

export function ThumbnailGenSettingsBar({
  settings,
  onChange,
  disabled = false,
  summaryOnly = false,
  embedded = false,
  topicStyleRec = null,
}: Props) {
  const categories = useMemo(
    () => thumbnailStyleCategoriesForModel(settings.imageModel),
    [settings.imageModel],
  )
  const styles = useMemo(() => {
    const rows = SCENE_STYLE_CATALOG[settings.styleCategory] ?? SCENE_STYLE_CATALOG.실사
    if (!topicStyleRec?.hasAny) return rows
    return [...rows].sort((a, b) => {
      const ar = topicStyleRec.isRecommended(settings.styleCategory, a.id) ? 0 : 1
      const br = topicStyleRec.isRecommended(settings.styleCategory, b.id) ? 0 : 1
      if (ar !== br) return ar - br
      return 0
    })
  }, [settings.styleCategory, topicStyleRec])

  function setModel(imageModel: SceneImageModelId) {
    const cats = thumbnailStyleCategoriesForModel(imageModel)
    let styleCategory = settings.styleCategory
    if (!cats.includes(styleCategory)) styleCategory = cats[0] ?? '실사'
    const list = SCENE_STYLE_CATALOG[styleCategory] ?? SCENE_STYLE_CATALOG.실사
    const styleTemplateId = list.find((s) => s.id === settings.styleTemplateId)?.id ?? list[0]!.id
    onChange({
      imageModel,
      styleCategory,
      styleTemplateId,
      imagesLocaleMode: settings.imagesLocaleMode,
    })
  }

  function setCategory(styleCategory: SceneStyleCategory) {
    const list = SCENE_STYLE_CATALOG[styleCategory] ?? SCENE_STYLE_CATALOG.실사
    onChange({ ...settings, styleCategory, styleTemplateId: list[0]!.id })
  }

  function setLocale(imagesLocaleMode: ImageLocaleMode) {
    onChange({ ...settings, imagesLocaleMode })
  }

  if (summaryOnly) {
    return <ThumbnailGenStyleSelectionSummary settings={settings} />
  }

  return (
    <footer
      className={
        'thumb-tpl-modal__gen-footer' + (embedded ? ' thumb-tpl-modal__gen-footer--embedded' : '')
      }
      aria-label="썸네일 AI 배경 생성 설정"
    >
      {!embedded ? (
        <>
          <p className="thumb-tpl-modal__gen-footer-title">AI 배경 이미지 설정</p>
          <p className="thumb-tpl-modal__gen-footer-hint">
            기본값은 「AI 이미지」에서 선택한 모델·스타일·지역 풍과 같습니다. 아래에서 바꾸면 이 프로젝트에만
            저장됩니다. (Gemini 나노바나나 1·2는 Replicate 나노바나나 Pro로 생성)
          </p>
        </>
      ) : (
        <p className="thumb-tpl-modal__gen-footer-hint thumb-tpl-modal__gen-footer-hint--compact">
          모델·스타일·지역 풍을 고른 뒤 아래 「배경만 AI 생성」을 누르세요.
        </p>
      )}

      <div className="thumb-tpl-modal__gen-block">
        <span className="thumb-tpl-modal__gen-label">이미지 모델</span>
        <div className="thumb-tpl-modal__gen-model-row" role="group" aria-label="이미지 모델">
          {SCENE_IMAGE_MODEL_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={
                settings.imageModel === opt.id
                  ? 'thumb-tpl-modal__gen-model thumb-tpl-modal__gen-model--on thumb-tpl-modal__gen-model--pick'
                  : 'thumb-tpl-modal__gen-model thumb-tpl-modal__gen-model--pick'
              }
              disabled={disabled}
              title={opt.desc}
              onClick={() => setModel(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="thumb-tpl-modal__gen-meta">{sceneImageModelLabel(settings.imageModel)}</span>
      </div>

      <div className="thumb-tpl-modal__gen-block">
        <span className="thumb-tpl-modal__gen-label">스타일</span>
        {topicStyleRec ? (
          <TopicStyleRecommendBanner
            loading={topicStyleRec.loading}
            hasAny={topicStyleRec.hasAny}
            summary={topicStyleRec.summary}
            activeCategory={settings.styleCategory}
            categorySet={topicStyleRec.categorySet}
            scriptReady={topicStyleRec.scriptReady}
          />
        ) : null}
        <div className="thumb-tpl-modal__gen-cat-row" role="tablist" aria-label="스타일 카테고리">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={settings.styleCategory === cat}
              className={[
                settings.styleCategory === cat
                  ? 'thumb-tpl-modal__gen-cat thumb-tpl-modal__gen-cat--on'
                  : 'thumb-tpl-modal__gen-cat',
                topicStyleRec?.categorySet.has(cat) ? 'scene-gen__cat--topic-rec' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={disabled}
              onClick={() => setCategory(cat)}
            >
              {sceneStyleCategoryLabel(cat)}
            </button>
          ))}
        </div>
        <div className="thumb-tpl-modal__gen-style-row" role="listbox" aria-label="스타일 템플릿">
          {styles.map((s) => {
            const fileSrc = sceneStyleSampleUrl(settings.styleCategory, s.id)
            const topicRec = topicStyleRec?.isRecommended(settings.styleCategory, s.id) ?? false
            const topicReason = topicStyleRec?.reasonFor(settings.styleCategory, s.id)
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={settings.styleTemplateId === s.id}
                className={[
                  settings.styleTemplateId === s.id
                    ? 'thumb-tpl-modal__gen-style thumb-tpl-modal__gen-style--on'
                    : 'thumb-tpl-modal__gen-style',
                  topicRec && settings.styleTemplateId !== s.id ? 'scene-gen__style-card--topic-rec' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={disabled}
                title={topicRec && topicReason ? `${s.label} · ${topicReason}` : s.label}
                onClick={() => onChange({ ...settings, styleTemplateId: s.id })}
              >
                <span className="thumb-tpl-modal__gen-style-thumb">
                  <SceneStyleCardBadge item={s} topicRec={topicRec} topicReason={topicReason} />
                  <img
                    src={fileSrc}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const img = e.currentTarget
                      img.onerror = null
                      img.src = sceneStyleSampleDataUrl(
                        s.hue,
                        s.label,
                        settings.styleCategory,
                        s.id,
                      )
                    }}
                  />
                </span>
                <span className="thumb-tpl-modal__gen-style-label">{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="thumb-tpl-modal__gen-block">
        <span className="thumb-tpl-modal__gen-label">지역·인물 풍</span>
        <div className="thumb-tpl-modal__gen-locale-row" role="group" aria-label="한국풍 외국풍">
          {(['korean', 'foreign', 'auto'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={
                settings.imagesLocaleMode === mode
                  ? 'thumb-tpl-modal__gen-locale thumb-tpl-modal__gen-locale--on'
                  : 'thumb-tpl-modal__gen-locale'
              }
              disabled={disabled}
              onClick={() => setLocale(mode)}
            >
              {imageLocaleModeLabel(mode)}
            </button>
          ))}
        </div>
        <p className="thumb-tpl-modal__gen-locale-hint">
          {settings.imagesLocaleMode === 'korean'
            ? '한국 대상·한국 제도·일상 영상 — 인물·거리·간판이 한국풍으로 나오도록 고정합니다.'
            : settings.imagesLocaleMode === 'foreign'
              ? '해외·서양사·국제 맥락 — 비한국 인물·배경이 나오도록 고정합니다.'
              : '주제·대본 문맥으로 AI가 한 구면당 한국풍/외국풍을 판단합니다.'}
        </p>
      </div>
    </footer>
  )
}

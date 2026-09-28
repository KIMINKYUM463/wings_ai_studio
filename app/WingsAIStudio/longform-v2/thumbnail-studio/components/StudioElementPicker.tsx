import { useEffect, useMemo, useState } from 'react'
import {
  ELEMENT_PRESET_CATEGORIES,
  ELEMENT_PRESETS,
  countElementPresets,
  elementCategoryLabel,
  type ElementPresetCategory,
  type ElementPresetDef,
} from '@/lib/longform-v2/thumbnailTemplateStudio/elementPresets'
import {
  elementStickerPreviewUrl,
  fetchElementStickerCached,
} from '@/lib/longform-v2/thumbnailTemplateStudio/elementStickers'

type Props = {
  onSelect: (presetId: string) => void
  disabled?: boolean
  generatingPresetId?: string | null
}

function PresetVectorPreview({ preset }: { preset: ElementPresetDef }) {
  const fill =
    preset.strokeOnly || preset.defaultFill == null
      ? 'none'
      : (preset.defaultFill ?? preset.defaultColor)
  const stroke = preset.defaultColor
  const sw = Math.max(1.5, preset.defaultLineWidth * 0.28)

  return (
    <svg
      viewBox={`0 0 ${preset.viewBoxW} ${preset.viewBoxH}`}
      className="thumb-ui-element-preview-svg"
      aria-hidden
    >
      <path
        d={preset.pathD}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        fillRule="evenodd"
      />
    </svg>
  )
}

function StickerThumb({ preset }: { preset: ElementPresetDef }) {
  const [cached, setCached] = useState<boolean | null>(null)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setCached(null)
    setImgFailed(false)
    void fetchElementStickerCached(preset.id).then((ok) => {
      if (!cancelled) setCached(ok)
    })
    return () => {
      cancelled = true
    }
  }, [preset.id])

  if (cached === null) {
    return (
      <span className="thumb-ui-element-preview-ph thumb-ui-element-preview-ph--idle" aria-hidden>
        …
      </span>
    )
  }

  if (cached && !imgFailed) {
    return (
      <img
        src={`${elementStickerPreviewUrl(preset.id)}?v=1`}
        alt=""
        className="thumb-ui-element-preview-img"
        draggable={false}
        onError={() => setImgFailed(true)}
      />
    )
  }

  return <PresetVectorPreview preset={preset} />
}

export function StudioElementPicker({ onSelect, disabled, generatingPresetId }: Props) {
  const [category, setCategory] = useState<ElementPresetCategory | 'all'>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ELEMENT_PRESETS.filter((p) => {
      if (category !== 'all' && p.category !== category) return false
      if (!q) return true
      return (
        p.label.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.id.toLowerCase().includes(q)
      )
    })
  }, [category, query])

  return (
    <div className="thumb-ui-element-picker">
      <p className="thumb-ui-hint">
        총 {countElementPresets()}개 요소 — PNG 스티커가 있으면 즉시 추가, 없으면 벡터 도형 또는 클릭 시
        Gemini AI로 생성됩니다.
      </p>
      <input
        type="search"
        className="thumb-ui-element-search"
        placeholder="화살표, 밑줄, NEW, VS… 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        aria-label="요소 검색"
      />
      <div className="thumb-ui-element-cats" role="tablist" aria-label="요소 카테고리">
        <button
          type="button"
          role="tab"
          className={'thumb-ui-element-cat' + (category === 'all' ? ' thumb-ui-element-cat--on' : '')}
          onClick={() => setCategory('all')}
          disabled={disabled}
        >
          전체
        </button>
        {ELEMENT_PRESET_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            className={'thumb-ui-element-cat' + (category === cat ? ' thumb-ui-element-cat--on' : '')}
            onClick={() => setCategory(cat)}
            disabled={disabled}
          >
            {elementCategoryLabel(cat)}
          </button>
        ))}
      </div>
      <div className="thumb-ui-element-grid" role="list">
        {filtered.map((preset) => {
          const busy = generatingPresetId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              className={
                'thumb-ui-element-card' + (busy ? ' thumb-ui-element-card--busy' : '')
              }
              title={preset.label}
              disabled={disabled || Boolean(generatingPresetId)}
              onClick={() => onSelect(preset.id)}
              role="listitem"
            >
              <StickerThumb preset={preset} />
              <span className="thumb-ui-element-card__label">
                {busy ? 'AI 생성 중…' : preset.label}
              </span>
            </button>
          )
        })}
      </div>
      {!filtered.length ? (
        <p className="thumb-ui-hint">검색 결과가 없습니다.</p>
      ) : null}
    </div>
  )
}

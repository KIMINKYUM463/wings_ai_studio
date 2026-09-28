import {
  defaultWeightForFamily,
  ensureBundledFontForCssFamily,
  familyHasWeightPicker,
  getFontFamilyOption,
  resolveFontFamilySelection,
  stackForFontSelection,
  THUMBNAIL_FONT_FAMILIES,
  type FontFamilySelection,
} from '@/lib/longform-v2/thumbnail-bridge/bundledFonts'

function pickWeightOnFamilyChange(
  familyId: string,
  prevWeightId: string | null,
): FontFamilySelection {
  const fam = getFontFamilyOption(familyId)
  if (!fam) return { familyId: 'gmarket-sans', weightId: 'bold' }
  if (!familyHasWeightPicker(familyId)) return { familyId, weightId: null }
  const weights = fam.weights ?? []
  const keep = prevWeightId && weights.some((w) => w.id === prevWeightId)
  const weightId = keep
    ? prevWeightId
    : (defaultWeightForFamily(fam)?.id ?? weights[0]?.id ?? null)
  return { familyId, weightId }
}

type Props = {
  fontFamily: string
  onChange: (fontFamily: string) => void
  /** studio | manual 클래스 접두 */
  variant?: 'studio' | 'manual'
}

export function ThumbnailFontFamilyPicker({
  fontFamily,
  onChange,
  variant = 'studio',
}: Props) {
  const sel = resolveFontFamilySelection(fontFamily)
  const familyOpt = getFontFamilyOption(sel.familyId)
  const showWeight = familyHasWeightPicker(sel.familyId)
  const weights = familyOpt?.weights ?? []

  /** PC에 없어도 public/fonts 번들을 먼저 로드한 뒤 적용 */
  const apply = (next: FontFamilySelection) => {
    const stack = stackForFontSelection(next)
    void ensureBundledFontForCssFamily(stack).finally(() => {
      onChange(stack)
    })
  }

  if (variant === 'manual') {
    return (
      <div className="yt-thumb-manual__font-pick">
        <label className="yt-thumb-manual__mini">
          폰트
          <select
            className="yt-thumb-manual__select"
            value={sel.familyId}
            onChange={(e) => apply(pickWeightOnFamilyChange(e.target.value, sel.weightId))}
          >
            {THUMBNAIL_FONT_FAMILIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        {showWeight ? (
          <label className="yt-thumb-manual__mini">
            굵기
            <select
              className="yt-thumb-manual__select"
              value={sel.weightId ?? weights[0]?.id ?? ''}
              onChange={(e) => apply({ familyId: sel.familyId, weightId: e.target.value })}
            >
              {weights.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <label className="thumb-ui-field">
        <span>폰트</span>
        <select
          value={sel.familyId}
          onChange={(e) => {
            const familyId = e.target.value
            const fam = getFontFamilyOption(familyId)
            if (!fam) return
            if (familyHasWeightPicker(familyId)) {
              const def = fam.weights?.find((w) => w.id === 'bold') ?? fam.weights?.[0]
              apply({ familyId, weightId: def?.id ?? null })
            } else {
              apply({ familyId, weightId: null })
            }
          }}
        >
          {THUMBNAIL_FONT_FAMILIES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      {showWeight ? (
        <label className="thumb-ui-field">
          <span>굵기</span>
          <select
            value={sel.weightId ?? weights[0]?.id ?? ''}
            onChange={(e) => apply({ familyId: sel.familyId, weightId: e.target.value })}
          >
            {weights.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  )
}

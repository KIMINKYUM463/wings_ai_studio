/** 글자 구간별 채우기 색 (start 포함, end 미포함) */
export type TextFillSpan = {
  start: number
  end: number
  fill: string
}

export function buildTextFillSegments(
  text: string,
  defaultFill: string,
  spans?: TextFillSpan[],
): { slice: string; fill: string }[] {
  if (!text) return []
  if (!spans?.length) return [{ slice: text, fill: defaultFill }]

  const colors = Array<string>(text.length).fill(defaultFill)
  for (const sp of spans) {
    const a = Math.max(0, Math.min(text.length, sp.start))
    const b = Math.max(0, Math.min(text.length, sp.end))
    for (let i = a; i < b; i++) colors[i] = sp.fill
  }

  const out: { slice: string; fill: string }[] = []
  let i = 0
  while (i < text.length) {
    const fill = colors[i]
    let j = i + 1
    while (j < text.length && colors[j] === fill) j++
    out.push({ slice: text.slice(i, j), fill })
    i = j
  }
  return out
}

function colorsFromSpans(text: string, defaultFill: string, spans?: TextFillSpan[]): string[] {
  const colors = Array<string>(text.length).fill(defaultFill)
  if (!spans?.length) return colors
  for (const sp of spans) {
    const a = Math.max(0, Math.min(text.length, sp.start))
    const b = Math.max(0, Math.min(text.length, sp.end))
    for (let i = a; i < b; i++) colors[i] = sp.fill
  }
  return colors
}

function compressFillSpans(colors: string[], defaultFill: string): TextFillSpan[] | undefined {
  const spans: TextFillSpan[] = []
  let i = 0
  while (i < colors.length) {
    const fill = colors[i]
    if (fill !== defaultFill) {
      let j = i + 1
      while (j < colors.length && colors[j] === fill) j++
      spans.push({ start: i, end: j, fill })
      i = j
    } else {
      i++
    }
  }
  return spans.length ? spans : undefined
}

/** 선택 구간에만 fill 적용 */
export function applyFillSpanRange(
  text: string,
  defaultFill: string,
  spans: TextFillSpan[] | undefined,
  selStart: number,
  selEnd: number,
  fill: string,
): TextFillSpan[] | undefined {
  const a = Math.max(0, Math.min(selStart, selEnd))
  const b = Math.min(text.length, Math.max(selStart, selEnd))
  if (b <= a) return spans

  const colors = colorsFromSpans(text, defaultFill, spans)
  for (let i = a; i < b; i++) colors[i] = fill
  return compressFillSpans(colors, defaultFill)
}

/** 문구 수정 시 구간 인덱스 보정 */
export function remapFillSpansOnTextChange(
  prevText: string,
  nextText: string,
  spans: TextFillSpan[] | undefined,
  defaultFill: string,
): TextFillSpan[] | undefined {
  if (!spans?.length) return spans
  if (prevText === nextText) return spans

  const colors = colorsFromSpans(prevText, defaultFill, spans)
  const nextColors: string[] = []
  const shared = Math.min(prevText.length, nextText.length)
  for (let i = 0; i < shared; i++) {
    if (prevText[i] === nextText[i]) nextColors.push(colors[i])
    else nextColors.push(defaultFill)
  }
  for (let i = shared; i < nextText.length; i++) nextColors.push(defaultFill)

  return compressFillSpans(nextColors, defaultFill)
}

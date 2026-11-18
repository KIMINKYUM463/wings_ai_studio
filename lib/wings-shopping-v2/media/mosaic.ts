/** Gemini 박스 형식: [ymin, xmin, ymax, xmax], 0~1000 정규화 */
export type NormBox = number[];
export type TimedNormBox = { box: NormBox; startOffset: number; endOffset: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type TimedRect = Rect & { startOffset?: number; endOffset?: number };

const PAD = 0.03; // 박스 주변 여유 (프레임 대비)
const MIN_SIDE = 0.005;
const MAX_AREA = 0.6; // 화면 대부분을 덮는 박스는 오검출로 보고 무시

const even = (n: number) => Math.floor(n / 2) * 2;
const evenUp = (n: number) => Math.ceil(n / 2) * 2;

function singleBoxToPixel(b: NormBox, width: number, height: number): Rect | null {
  if (!Array.isArray(b) || b.length !== 4) return null;
  const [ymin, xmin, ymax, xmax] = b.map((v) => Math.min(1000, Math.max(0, v)) / 1000);
  if (xmax - xmin < MIN_SIDE || ymax - ymin < MIN_SIDE) return null;
  if ((xmax - xmin) * (ymax - ymin) > MAX_AREA) return null;
  // 최종 9:16 화면에 보이는 폭의 30%보다 넓은 띠는 자막 줄로 보고 좌우 끝까지 가린다
  // (가로 영상은 가운데 일부만 보이므로 보이는 폭 기준으로 판단)
  const visible = Math.min(1, (height * 9) / 16 / width);
  const band = xmax - xmin > 0.3 * visible;
  const x0 = band ? 0 : Math.max(0, even((xmin - PAD) * width));
  const y0 = Math.max(0, even((ymin - PAD) * height));
  const x1 = band ? even(width) : Math.min(even(width), evenUp((xmax + PAD) * width));
  const y1 = Math.min(even(height), evenUp((ymax + PAD) * height));
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function boxesToPixels(boxes: NormBox[], width: number, height: number): Rect[] {
  const out: Rect[] = [];
  for (const b of boxes) {
    const r = singleBoxToPixel(b, width, height);
    if (r) out.push(r);
  }
  return out;
}

function rectsNearlySame(a: Rect, b: Rect, tol = 28): boolean {
  return (
    Math.abs(a.x - b.x) <= tol &&
    Math.abs(a.y - b.y) <= tol &&
    Math.abs(a.x + a.w - (b.x + b.w)) <= tol &&
    Math.abs(a.y + a.h - (b.y + b.h)) <= tol
  );
}

/**
 * 시간대별 정규화 박스를 픽셀 좌표로 변환하고,
 * 같은 자막 줄 위치에 연속·인접해 있는 박스들은 하나로 병합해 깜빡임과 필터 개수를 줄인다.
 */
export function timedBoxesToPixels(items: TimedNormBox[], width: number, height: number): TimedRect[] {
  const raw: TimedRect[] = [];
  for (const item of items) {
    const r = singleBoxToPixel(item.box, width, height);
    if (!r) continue;
    if (item.endOffset <= item.startOffset + 0.01) continue;
    raw.push({
      ...r,
      startOffset: Math.max(0, item.startOffset),
      endOffset: item.endOffset,
    });
  }
  raw.sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0));

  const merged: TimedRect[] = [];
  for (const cur of raw) {
    const match = merged.find(
      (m) =>
        rectsNearlySame(m, cur) &&
        m.endOffset != null &&
        cur.startOffset != null &&
        cur.startOffset <= m.endOffset + 0.25,
    );
    if (match) {
      const x0 = even(Math.min(match.x, cur.x));
      const y0 = even(Math.min(match.y, cur.y));
      const x1 = evenUp(Math.max(match.x + match.w, cur.x + cur.w));
      const y1 = evenUp(Math.max(match.y + match.h, cur.y + cur.h));
      match.x = x0;
      match.y = y0;
      match.w = x1 - x0;
      match.h = y1 - y0;
      match.endOffset = Math.max(match.endOffset ?? 0, cur.endOffset ?? 0);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged.slice(0, 24);
}

/** [0:v]에서 시작해 각 사각형을 픽셀화(모자이크)하고 결과를 [label]로 내보내는 filter_complex 조각 */
export function mosaicFilter(rects: TimedRect[], label: string): string {
  if (!rects.length) return `[0:v]null[${label}]`;
  const n = rects.length;
  const parts: string[] = [`[0:v]split=${n + 1}[mb0]${rects.map((_, i) => `[mc${i}]`).join('')}`];
  rects.forEach((r, i) => {
    const block = Math.max(8, Math.round(Math.min(r.w, r.h) / 5));
    const sw = Math.max(2, Math.round(r.w / block));
    const sh = Math.max(2, Math.round(r.h / block));
    parts.push(`[mc${i}]crop=${r.w}:${r.h}:${r.x}:${r.y},scale=${sw}:${sh},scale=${r.w}:${r.h}:flags=neighbor[mp${i}]`);
  });
  rects.forEach((r, i) => {
    const inLabel = i === 0 ? 'mb0' : `mo${i - 1}`;
    const outLabel = i === n - 1 ? label : `mo${i}`;
    const enable =
      r.startOffset != null && r.endOffset != null
        ? `:enable='between(t,${r.startOffset.toFixed(3)},${r.endOffset.toFixed(3)})'`
        : '';
    parts.push(`[${inLabel}][mp${i}]overlay=${r.x}:${r.y}${enable}[${outLabel}]`);
  });
  return parts.join(';');
}

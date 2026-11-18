/** 실제 영상(푸티지)이 있는 영역 [ymin, xmin, ymax, xmax] (0~1000). 템플릿 UI·제목 띠·레터박스를 잘라내는 데 쓴다. */
export type ContentBox = number[];

const even = (n: number) => Math.floor(n / 2) * 2;

/** 푸티지 영역 → 픽셀 crop. 거의 전체 화면(90% 이상)이거나 비정상이면 null (자르지 않음). */
export function contentCrop(box: ContentBox | undefined, width: number, height: number): { x: number; y: number; w: number; h: number } | null {
  if (!box || box.length !== 4 || box.some((v) => typeof v !== 'number')) return null;
  const [ymin, xmin, ymax, xmax] = box.map((v) => Math.min(1000, Math.max(0, v)) / 1000);
  const wr = xmax - xmin;
  const hr = ymax - ymin;
  if (wr < 0.2 || hr < 0.15) return null;
  if (wr * hr > 0.9) return null;
  const x = even(xmin * width);
  const y = even(ymin * height);
  return { x, y, w: Math.min(even(wr * width), even(width) - x), h: Math.min(even(hr * height), even(height) - y) };
}

/**
 * 템플릿의 영상 자리 비율 바꾸기 (1080x1920 기준).
 * - default: 템플릿 그대로
 * - square: 1:1 정사각
 * - fill: 영상 자리 아래 끝을 화면 아래까지 늘림 (보드형이면 약 2:3)
 * 영상 아래에 빈 공간이 있는 템플릿(게시판·스토리 ver1 등)에만 적용한다.
 */
export type VideoFit = 'default' | 'square' | 'fill';
export const VIDEO_FITS: VideoFit[] = ['default', 'square', 'fill'];

const H = 1920;

export function canFitVideo(video: { y: number; h: number }): boolean {
  return video.y > 0 && video.y + video.h < H - 4;
}

export function applyVideoFit<T extends { video: { x: number; y: number; w: number; h: number } }>(t: T, fit?: string): T {
  if (!fit || fit === 'default' || !canFitVideo(t.video)) return t;
  const room = H - t.video.y;
  const h = fit === 'square' ? Math.min(t.video.w, room) : fit === 'fill' ? room : t.video.h;
  return { ...t, video: { ...t.video, h } };
}

/** 쇼핑숏폼과 동일 — 유튜브 쇼츠 첫 프레임용 썸네일 길이(초) */
export const MVP_THUMBNAIL_INTRO_SEC = 0.0001

export function isMvpThumbnailIntroTime(timelineSec: number): boolean {
  return timelineSec < MVP_THUMBNAIL_INTRO_SEC
}

/** 미리보기·타임라인 playhead — 블록 배치와 동일한 영상 시간축 */
export function mvpPreviewTimelineSec(_audioUrl: string | null | undefined, videoPlayhead: number): number {
  return videoPlayhead
}

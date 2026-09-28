/** 유튜브 검색 참고 — 썸네일·제목 카피 리서치 */

export type ThumbnailCopyResearchItem = {
  videoId: string
  title: string
  channelTitle: string
  viewCount: number
  url: string
  thumbnailUrl?: string
  /** 썸네일 이미지에서 읽은 온-이미지 문구 (위→아래) */
  thumbnailLines: string[]
  searchKeyword: string
}

export type ThumbnailCopyResearchResult = {
  topic: string
  keywords: string[]
  items: ThumbnailCopyResearchItem[]
  /** 일부 썸네일 OCR 실패 시 안내 */
  ocrWarnings?: string[]
}

export type ThumbnailCopyResearchRequest = {
  topic: string
  /** 비어 있으면 topic에서 자동 추출 */
  keywords?: string[]
  maxItems?: number
  months?: number
  regionCode?: string
}

export type ThumbnailCopyFromResearchRequest = {
  templateId: string
  topic: string
  scriptExcerpt: string
  videoTitle?: string
  outputLanguage?: string
  frames: import('./thumbnailCopywriter').ThumbnailCopyFrameInput[]
  researchItems: ThumbnailCopyResearchItem[]
}

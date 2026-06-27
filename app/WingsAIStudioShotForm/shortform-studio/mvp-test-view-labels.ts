/** MvpTestView UI 한글 라벨 — UTF-8 인코딩 깨짐 방지용 */

import { MAX_AUTO_EDIT_VIDEOS } from "@/lib/shotform-auto-edit-types"

/** 재가공 AI편집(YouTube·TikTok) 탭 — 일시 비노출 */
export const MVP_REPROCESS_SOURCE_ENABLED = false

export const MVP_LABELS = {
  sourceFind: "1. 소스 찾기",
  tabKeyword: "키워드로 소스 찾기",
  tabDirectUrl: `URL 직접 입력 (多源混剪, 최대 ${MAX_AUTO_EDIT_VIDEOS}개)`,
  tabReprocess: "재가공 AI편집 (YouTube·TikTok)",
  keywordHint:
    "한국어로 입력하면 GPT가 간체 中文로 바꿉니다. 「소스찾기」를 누르면 抖音·小红书에서 비슷한 영상을 동시에 찾습니다.",
  multiKeyword: "여러 키워드 (줄바꿈·쉼표)",
  keywordPlaceholder: "예: 차량용 청소기",
  multiKeywordPlaceholder: "차량용 청소기\n무선 차량 청소기",
  translating: "中文 변환 중…",
  openaiKeyHint: "OpenAI 키 저장 시 中文 변환 미리보기가 표시됩니다.",
  searching: "소스 찾는 중…",
  searchBtn: "소스찾기",
  directUrlHint:
    `抖音·小红书 URL을 입력한 뒤 「URL 해석」으로 영상을 확인하세요. 하단 「AI 짜집기」로 편집을 시작합니다. 기본 2칸, + 버튼으로 최대 ${MAX_AUTO_EDIT_VIDEOS}개까지 넣을 수 있으며, 짜집기는 버튼을 눌러야 시작됩니다.`,
  reprocessHint:
    "YouTube·TikTok URL을 넣고 「AI 짜집기」를 누르면 영상을 받아온 뒤 바로 짜집기가 시작됩니다.",
  apifyLoading: "抖音 · 小红书 검색 중… (최대 수 분)",
  steps: {
    urlInput: "URL 입력",
    urlResolve: "URL 해석",
    keywordInput: "키워드 입력",
    zhConvert: "中文 변환",
    sourceSearch: "소스 검색",
    videoPick: "영상 선택",
    aiEdit: "AI 짜집기",
    videoEdit: "영상 편집",
    scriptSubtitle: "자막·대본",
    thumbnail: "썸네일",
    export: "보내기",
    sourceCollect: "소스 수집",
  },
  footer: {
    direct:
      "URL을 해석하면 최대 {count}개 영상이 소스로 선택됩니다. 하단 「AI 짜집기」로 편집을 시작하세요. 이후 TTS·자막·썸네일·보내기 순으로 진행합니다.",
    reprocess:
      "URL 해석 후 AI 짜집기가 바로 실행됩니다. 이후 TTS·자막·썸네일·보내기까지 기존과 같습니다.",
    keyword:
      "抖音·小红书에서 영상을 최대 {max}개까지 골라 AI 짜집기를 실행하세요. 이후 영상 편집에서 TTS·자막을 만들고 썸네일·보내기까지 이어갑니다.",
  },
  videoCard: {
    presenterTitle: "口播·블로거 소개 영상 (짜집기 제외)",
    deselect: "선택 해제",
    add: "영상에 추가",
    douyin: "抖音",
    xhs: "小红书",
    presenterBadge: "口播 추정",
    length: "길이",
    views: "조회",
    likes: "좋아요",
    relevance: "관련도",
    openOriginal: "원본 보기",
  },
  platform: {
    douyinTitle: "抖音 Douyin",
    xhsTitle: "小红书 XHS",
    videoCount: "영상",
    countUnit: "건",
    retrying: "다시 찾는 중",
    retry: "다시 소스 찾기",
    retryingEmpty: "다시 소스 찾는 중",
    empty: "표시할 영상이 없습니다.",
    emptyDouyin: "「다시 소스 찾기」를 누르면 같은 검색어로 다시 시도합니다.",
    emptyXhs: "「다시 소스 찾기」로 최대 {max}회까지 재시도할 수 있습니다.",
  },
  errors: {
    saveFailed: "저장에 실패했습니다.",
    noUserId: "로그인 사용자 ID가 없습니다. 다시 로그인 후 시도해 주세요.",
    presenterPick:
      "口播·블로거 소개 영상은 짜집기에 넣을 수 없습니다. 다른 영상을 골라 주세요.",
    maxPicks: "최대 {max}개까지만 선택할 수 있습니다.",
    maxEdit: "짜집기는 최대 {max}개 영상까지만 가능합니다.",
    urlRefreshed: "{count}개 영상의 만료된 URL을 갱신했습니다.",
    urlRefreshFail: "{first} 외 {rest}개 URL 갱신 실패",
    urlRefreshDone: "{count}개 URL 갱신 완료",
    urlRefreshErrors: "{count}개 갱신 실패",
    keywordRequired: "키워드를 입력해 주세요.",
    openaiKey: "ShotForm 설정에서 OpenAI API 키를 저장해 주세요.",
    apifyToken: "ShotForm 설정에서 소스 검색 토큰(shotform_apify_token)을 저장해 주세요.",
    sourceFail: "소스 찾기 실패",
    network: "네트워크 오류",
    searchFirst: "먼저 소스찾기를 실행해 주세요.",
    apifyRequired: "소스 검색 토큰이 필요합니다.",
    retryFail: "재시도 실패",
  },
} as const

export function formatVideoPickLabel(count: number, max: number): string {
  return `영상 선택 (${count}/${max})`
}

export function formatSearchRetryNotice(queries: string[], douyin: number, xhs: number): string {
  return `검색어「${queries.join(" · ")}」— 抖音 ${douyin}건 · 小红书 ${xhs}건`
}

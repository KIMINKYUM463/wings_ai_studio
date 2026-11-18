/** AI 여행쇼핑숏폼 — 숙소·여행상품 사진 몇 장으로 세로 숏폼을 만드는 프로젝트 데이터 */

export type TravelStep = "info" | "photos" | "script" | "voice" | "preview"

export const TRAVEL_STEPS: Array<{ id: TravelStep; label: string; description: string }> = [
  { id: "info", label: "숙소·상품", description: "이름·가격·링크" },
  { id: "photos", label: "사진", description: "업로드·AI 분류" },
  { id: "script", label: "대본", description: "후킹 3안" },
  { id: "voice", label: "음성", description: "TTS·배경음" },
  { id: "preview", label: "완성", description: "미리보기·내보내기" },
]

export type TravelPlatform =
  | "coupang-travel"
  | "yeogi"
  | "yanolja"
  | "agoda"
  | "myrealtrip"
  | "klook"
  | "other"

export const TRAVEL_PLATFORMS: Array<{ id: TravelPlatform; label: string }> = [
  { id: "coupang-travel", label: "쿠팡 트래블" },
  { id: "yeogi", label: "여기어때" },
  { id: "yanolja", label: "야놀자" },
  { id: "agoda", label: "아고다" },
  { id: "myrealtrip", label: "마이리얼트립" },
  { id: "klook", label: "클룩" },
  { id: "other", label: "기타" },
]

export type TravelPhotoRole = "hero" | "room" | "unique" | "food" | "around"

export const TRAVEL_PHOTO_ROLES: Array<{ id: TravelPhotoRole; label: string; hint: string }> = [
  { id: "hero", label: "시선 강탈", hint: "수영장·오션뷰·야경처럼 첫 컷에 쓸 장면" },
  { id: "room", label: "객실", hint: "침대·욕실·창밖 뷰" },
  { id: "unique", label: "여기만의 공간", hint: "루프탑·산책로·스파 등 차별 포인트" },
  { id: "food", label: "식사", hint: "조식·디너·라운지" },
  { id: "around", label: "주변", hint: "해변·관광지·이동 동선" },
]

/** 장면마다 다른 카메라 움직임 — 정지 사진을 영상처럼 */
export type TravelMotion = "push-in" | "pull-out" | "pan-left" | "pan-right" | "rise"

export type TravelPhoto = {
  id: string
  /** 정지 이미지 — 영상 클립이 있으면 그 첫 프레임 (AI 분류·썸네일용) */
  blob: Blob
  /** 장면에서 재생할 움직이는 클립 (직접 올린 영상 또는 AI 영상화 결과) */
  video?: Blob
  role: TravelPhotoRole
  /** AI가 본 장면 한 줄 설명 */
  note?: string
}

export type TravelInfo = {
  placeName: string
  region: string
  platform: TravelPlatform
  bookingUrl: string
  /** 예: 1박 18만원대 */
  priceText: string
  /** 사용자가 아는 장점 (줄바꿈 구분) */
  highlights: string
  /** 영상·자막에서 숙소명·지역을 빼고 댓글로 유도 */
  hideName: boolean
}

export type TravelScene = {
  photoId: string
  /** 나레이션 겸 자막 — 줄바꿈 = 자막 한 줄 */
  line: string
  motion: TravelMotion
}

export type TravelAngle = "price" | "secret" | "compare"

export const TRAVEL_ANGLE_LABELS: Record<TravelAngle, string> = {
  price: "가격 반전형",
  secret: "숨은 명소형",
  compare: "비교형",
}

export type TravelScriptVariant = {
  angle: TravelAngle
  /** 화면 상단 고정 두 줄 */
  headline: [string, string]
  scenes: TravelScene[]
}

export type TravelPublishMeta = {
  titles: string[]
  caption: string
  hashtags: string[]
  /** 댓글로 받을 단어 */
  commentKeyword: string
}

export type TravelVoiceSettings = {
  voiceId: string
  speed: number
  bgmId: string
  bgmVolume: number
}

export type TravelAudio = {
  blob: Blob
  /** 장면별 [시작, 끝] 초 */
  sceneTimes: Array<[number, number]>
  durationSec: number
  /** 어떤 대본으로 만들었는지 — 대본이 바뀌면 다시 생성 안내 */
  scriptKey: string
}

export type TravelProject = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  step: TravelStep
  info: TravelInfo
  photos: TravelPhoto[]
  variants: TravelScriptVariant[]
  selectedVariant: number
  publish: TravelPublishMeta | null
  voice: TravelVoiceSettings
  audio: TravelAudio | null
  adLabel: boolean
}

export const EMPTY_TRAVEL_INFO: TravelInfo = {
  placeName: "",
  region: "",
  platform: "coupang-travel",
  bookingUrl: "",
  priceText: "",
  highlights: "",
  hideName: false,
}

export const DEFAULT_TRAVEL_VOICE: TravelVoiceSettings = {
  voiceId: "supertonic-F1",
  speed: 1.1,
  bgmId: "1",
  bgmVolume: 35,
}

export const TRAVEL_MAX_PHOTOS = 10

export function newTravelProject(name: string): TravelProject {
  const now = Date.now()
  return {
    id: `travel-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    createdAt: now,
    updatedAt: now,
    step: "info",
    info: { ...EMPTY_TRAVEL_INFO },
    photos: [],
    variants: [],
    selectedVariant: 0,
    publish: null,
    voice: { ...DEFAULT_TRAVEL_VOICE },
    audio: null,
    adLabel: true,
  }
}

export function selectedTravelScript(project: TravelProject): TravelScriptVariant | null {
  return project.variants[project.selectedVariant] ?? project.variants[0] ?? null
}

/** 음성이 지금 대본으로 만들어졌는지 판별용 키 */
export function travelScriptKey(variant: TravelScriptVariant | null): string {
  if (!variant) return ""
  return variant.scenes.map((s) => `${s.photoId}:${s.line}`).join("|")
}

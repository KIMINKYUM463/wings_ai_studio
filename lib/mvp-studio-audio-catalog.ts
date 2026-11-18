import { VOICE_PREVIEW_BGM_OPTIONS } from "@/lib/shotform-factory-voice-preview-bgm"
import {
  legacySfxToBgmCatalogId,
  MVP_EXTRA_BGM_OPTIONS,
} from "@/lib/shotform-mvp-sfx-catalog"
import { WINGS_SSUL_BGM } from "@/lib/wings-ssul-bgm"

export type MvpAudioCatalogGroup = "story" | "added" | "shopping" | "legacy"

export type MvpAudioCatalogItem = {
  id: string
  label: string
  src: string
  /** 버튼에 쓰는 짧은 이름 */
  shortLabel: string
  durationSec: number
  group: MvpAudioCatalogGroup
}

/** ffprobe로 잰 스토리 음원 길이. 루프 지점이 파일보다 앞에서 끊기지 않게 보관합니다. */
const STORY_BGM_DURATION_SEC: Record<string, number> = {
  "1": 73.6,
  "2": 62.7,
  "3": 68.3,
  "4": 81.2,
  "5": 32.8,
  "6": 64.7,
  "7": 58.1,
  "8": 52.5,
  "9": 49.7,
  "10": 40.5,
  "11": 41.2,
  "12": 78.3,
  "13": 121.2,
  "14": 146.7,
  "15": 24.7,
  "16": 54.7,
  "17": 21.2,
  "18": 25.4,
  "19": 84.3,
  "20": 133.7,
}

const STORY_SHORT_LABEL: Record<string, string> = {
  "13": "Wow",
  "14": "Lemonade",
}

export const MVP_AUDIO_CATALOG: readonly MvpAudioCatalogItem[] = [
  ...WINGS_SSUL_BGM.map((track) => ({
    id: track.id === "13" ? "bgm-wow-galaxy-beats" : track.id === "14" ? "bgm-lemonade-anna-graceman" : `ssul-${track.id}`,
    label: track.pickerGroup === "added" || track.id === "13" || track.id === "14" ? track.label : `스토리 · ${track.label}`,
    shortLabel: STORY_SHORT_LABEL[track.id] ?? track.shortLabel ?? `윙스 ${track.id}`,
    src: track.src,
    durationSec: STORY_BGM_DURATION_SEC[track.id] ?? 60,
    group: track.pickerGroup ?? "story",
  })),
  ...VOICE_PREVIEW_BGM_OPTIONS.map((o) => ({
    id: `bgm-${o.id}`,
    label: `쇼핑 · ${o.label}`,
    shortLabel: o.label,
    src: o.src,
    durationSec: o.durationSec,
    group: "shopping" as const,
  })),
  // 파일 내용이 쇼핑 배경음 1~5와 같습니다. 예전에 저장된 클립 id만 유지합니다.
  ...MVP_EXTRA_BGM_OPTIONS.map((o, index) => ({
    id: `bgm-${o.id}`,
    label: o.label,
    shortLabel: o.label,
    src: o.src,
    durationSec: VOICE_PREVIEW_BGM_OPTIONS[index]?.durationSec ?? 60,
    group: "legacy" as const,
  })),
]

/** 화면용 랜덤 분위기 이름 (파일 id는 그대로 두고 표시만 바꿉니다) */
const PICKER_RANDOM_NAMES = [
  "햇살 브리즈",
  "소프트 팝",
  "네온 드라이브",
  "코지 라운지",
  "민트 스파클",
  "시티 워크",
  "골드 웨이브",
  "피치 소다",
  "미드나잇 팝",
  "구름 카페",
  "러시 비트",
  "라벤더 무드",
  "선셋 드라이브",
  "젤리 비트",
  "블루 모닝",
  "코튼 캔디",
  "스파클 샵",
  "허니 글로우",
  "바이올렛 팝",
  "아쿠아 비트",
  "체리 팝",
  "모카 라운지",
  "아이스 민트",
  "핑크 소다",
  "스카이라인",
  "올리브 그루브",
  "레몬 스파클",
] as const

/** 고정 시드로 섞어 새로고침해도 같은 순서가 나오게 합니다 */
function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items]
  let s = seed >>> 0
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function withRandomPickerName(item: MvpAudioCatalogItem, index: number): MvpAudioCatalogItem {
  const name = PICKER_RANDOM_NAMES[index % PICKER_RANDOM_NAMES.length]!
  return { ...item, shortLabel: name, label: name }
}

/** 고를 수 있는 배경음. 추가·스토리·쇼핑을 한 목록으로 합치고 랜덤 이름으로 보여 줍니다. */
export function mvpBgmPickerGroups(): { label: string; items: MvpAudioCatalogItem[] }[] {
  const base = MVP_AUDIO_CATALOG.filter((item) => item.group !== "legacy")
  const shuffled = seededShuffle(base, 20261115).map(withRandomPickerName)
  return [{ label: "배경음악", items: shuffled }]
}

/** FxPanel 등에서 그룹 없이 한 번에 고를 때 쓰는 평탄 목록 */
export function mvpBgmPickerItems(): MvpAudioCatalogItem[] {
  return mvpBgmPickerGroups()[0]?.items ?? []
}

/** 선택 표시용: 카탈로그 id → 랜덤 표시 이름 */
export function mvpBgmDisplayName(catalogId: string): string | null {
  const item = mvpBgmPickerItems().find((o) => o.id === catalogId)
  return item?.shortLabel ?? null
}

export function normalizeMvpAudioCatalogId(catalogId: string): string {
  return legacySfxToBgmCatalogId(catalogId) ?? catalogId
}

export function mvpAudioCatalogItem(catalogId: string): MvpAudioCatalogItem | null {
  const id = normalizeMvpAudioCatalogId(catalogId)
  return MVP_AUDIO_CATALOG.find((o) => o.id === id) ?? null
}

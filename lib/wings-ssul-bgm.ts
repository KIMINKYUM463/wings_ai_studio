/**
 * 윙스 썰 수동 제작에 쓰던 배경음악과 추가 등록 음원.
 * 원본: "윙스 영상 제작 자료/3. bgm". 파일은 public/wings-ssul-bgm.
 */

export type WingsSsulBgmTrack = {
  id: string
  label: string
  src: string
  /** 리믹스 버튼에 보이는 짧은 이름. 없으면 윙스 N */
  shortLabel?: string
  /** 리믹스 목록 묶음. 없으면 스토리 */
  pickerGroup?: "story" | "added"
}

export const WINGS_SSUL_BGM: readonly WingsSsulBgmTrack[] = [
  { id: "1", label: "윙스 BGM 1", src: "/wings-ssul-bgm/wings-bgm-1.mp3" },
  { id: "2", label: "윙스 BGM 2", src: "/wings-ssul-bgm/wings-bgm-2.mp3" },
  { id: "3", label: "윙스 BGM 3", src: "/wings-ssul-bgm/wings-bgm-3.mp3" },
  { id: "4", label: "윙스 BGM 4", src: "/wings-ssul-bgm/wings-bgm-4.mp3" },
  { id: "5", label: "윙스 BGM 5", src: "/wings-ssul-bgm/wings-bgm-5.mp3" },
  { id: "6", label: "윙스 BGM 6", src: "/wings-ssul-bgm/wings-bgm-6.mp3" },
  { id: "7", label: "윙스 BGM 7", src: "/wings-ssul-bgm/wings-bgm-7.mp3" },
  { id: "8", label: "윙스 BGM 8", src: "/wings-ssul-bgm/wings-bgm-8.mp3" },
  { id: "9", label: "윙스 BGM 9", src: "/wings-ssul-bgm/wings-bgm-9.mp3" },
  { id: "10", label: "윙스 BGM 10", src: "/wings-ssul-bgm/wings-bgm-10.mp3" },
  { id: "11", label: "윙스 BGM 11", src: "/wings-ssul-bgm/wings-bgm-11.mp3" },
  { id: "12", label: "윙스 BGM 12", src: "/wings-ssul-bgm/wings-bgm-12.mp3" },
  {
    id: "13",
    label: "Wow · Giulio Cercato · Electronic Galaxy Beats 2.0",
    src: "/wings-ssul-bgm/wow-giulio-cercato-electronic-galaxy-beats-2.mp3",
  },
  {
    id: "14",
    label: "Lemonade · Anna Graceman",
    src: "/wings-ssul-bgm/lemonade-anna-graceman.mp3",
  },
  {
    id: "15",
    label: "엉뚱귀염1",
    shortLabel: "엉뚱귀염1",
    pickerGroup: "added",
    src: "/wings-ssul-bgm/quirky-cute-1.mp3",
  },
  {
    id: "16",
    label: "엉뚱귀염2",
    shortLabel: "엉뚱귀염2",
    pickerGroup: "added",
    src: "/wings-ssul-bgm/quirky-cute-2.mp3",
  },
  {
    id: "17",
    label: "리빙1",
    shortLabel: "리빙1",
    pickerGroup: "added",
    src: "/wings-ssul-bgm/living-1.mp3",
  },
  {
    id: "18",
    label: "리빙2",
    shortLabel: "리빙2",
    pickerGroup: "added",
    src: "/wings-ssul-bgm/living-2.mp3",
  },
  {
    id: "19",
    label: "궁금1",
    shortLabel: "궁금1",
    pickerGroup: "added",
    src: "/wings-ssul-bgm/curious-1.mp3",
  },
  {
    id: "20",
    label: "궁금2",
    shortLabel: "궁금2",
    pickerGroup: "added",
    src: "/wings-ssul-bgm/curious-2.mp3",
  },
]

/** 빈 문자열은 "없음". 값이 없으면 호출하는 쪽에서 기본곡을 정합니다. */
export function wingsSsulBgmSrc(id: string | undefined): string | null {
  if (!id) return null
  return WINGS_SSUL_BGM.find((track) => track.id === id)?.src ?? null
}

/**
 * 배경음악 볼륨(0~100) → 실제 게인.
 * 100이어도 0.5라 나레이션보다 작게 깔립니다. 기본값 30은 은은한 수준입니다.
 */
export function wingsSsulBgmGain(volumePct: number | undefined): number {
  const pct = Math.min(100, Math.max(0, volumePct ?? 30))
  return (pct / 100) * 0.5
}

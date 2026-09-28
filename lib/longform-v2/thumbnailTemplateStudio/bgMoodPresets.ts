/** Canva/Miricanvas 스타일 AI 배경 무드 원클릭 프롬프트 */
export type BgMoodPreset = {
  id: string
  label: string
  hint: string
}

export const BG_MOOD_PRESETS: readonly BgMoodPreset[] = [
  {
    id: 'cinematic',
    label: '시네마틱',
    hint: '영화 포스터 느낌, 드라마틱 조명, 얕은 심도, 인물은 한쪽에 배치, 텍스트 공간 확보',
  },
  {
    id: 'bright_clean',
    label: '밝고 깨끗',
    hint: '밝은 자연광, 깨끗한 배경, 고키 대비, 유튜브 썸네일용 여백',
  },
  {
    id: 'dark_mood',
    label: '다크 무드',
    hint: '어두운 톤, 네온 포인트, 긴장감, 인물 실루엣 강조',
  },
  {
    id: 'neon_pop',
    label: '네온 팝',
    hint: '선명한 네온 색, 대담한 대비, Z세대 썸네일 스타일',
  },
  {
    id: 'subject_right',
    label: '인물 오른쪽',
    hint: '주 피사체는 오른쪽 1/3, 왼쪽은 텍스트용 여백, 배경은 흐릿하게',
  },
  {
    id: 'subject_left',
    label: '인물 왼쪽',
    hint: '주 피사체는 왼쪽 1/3, 오른쪽은 텍스트용 여백',
  },
  {
    id: 'minimal',
    label: '미니멀',
    hint: '단순 배경, 2~3색 팔레트, 피사체 하나만, 군더더기 없음',
  },
  {
    id: 'warm_vlog',
    label: '따뜻한 브이로그',
    hint: '따뜻한 색온도, 일상 브이로그 느낌, 친근한 조명',
  },
]

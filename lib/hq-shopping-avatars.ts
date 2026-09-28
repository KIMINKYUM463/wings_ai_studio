/**
 * 고퀄리티 AI 쇼핑숏폼 — 한국 인물 페르소나 10명 (나이대별)
 * UI 선택용 샘플 얼굴(previewSrc)만 보여 주고, Seedance에는 얼굴 이미지를 넣지 않고
 * personaKo / appearanceEn 텍스트로만 인물을 지정합니다. (실사 얼굴 E005 회피)
 * 기본값: 20대 여성 (지우)
 */

export type HqAvatarAgeGroup = "10s" | "20s" | "30s" | "40s" | "50s"

export interface HqShoppingAvatar {
  id: string
  nameKo: string
  ageGroup: HqAvatarAgeGroup
  ageLabelKo: string
  /** Seedance/대본용 페르소나 (예: 30대 여성 주부) — 얼굴 이미지 대신 사용 */
  personaKo: string
  gender: "female" | "male"
  /** UI 카드 배경 그라데이션 */
  accent: string
  /** 영상 프롬프트용 영문 외형·톤 설명 (얼굴 레퍼런스 없이 텍스트만) */
  appearanceEn: string
  /** UI용 한줄 설명 */
  blurbKo: string
  /** UI 선택 미리보기만 — API에는 전달하지 않음 */
  previewSrc: string
}

export const HQ_AVATAR_AGE_ORDER: HqAvatarAgeGroup[] = [
  "10s",
  "20s",
  "30s",
  "40s",
  "50s",
]

export const HQ_AVATAR_AGE_LABEL: Record<HqAvatarAgeGroup, string> = {
  "10s": "10대",
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50s": "50대",
}

/** 기본 선택 아바타 (20대 여성) */
export const HQ_DEFAULT_AVATAR_ID = "kr-f-20s-jiwoo"

export const HQ_SHOPPING_AVATARS: HqShoppingAvatar[] = [
  {
    id: "kr-f-10s-sua",
    nameKo: "수아",
    ageGroup: "10s",
    ageLabelKo: "10대 여성",
    personaKo: "10대 여학생",
    gender: "female",
    accent: "from-pink-400/40 to-rose-600/30",
    appearanceEn:
      "fictional Korean teenage girl host around 18, soft black hair with bangs, bright polite smile, casual pastel outfit, wholesome student vibe — original character, not a real person",
    blurbKo: "청량한 10대 · 틴 뷰티",
    previewSrc: "/hq-avatars/kr-f-10s-sua.png",
  },
  {
    id: "kr-m-10s-minjun",
    nameKo: "민준",
    ageGroup: "10s",
    ageLabelKo: "10대 남성",
    personaKo: "10대 남학생",
    gender: "male",
    accent: "from-sky-400/40 to-blue-700/30",
    appearanceEn:
      "fictional Korean teenage boy host around 18, neat black hair, friendly expression, casual hoodie — original character, not a real person",
    blurbKo: "밝은 10대 · 캐주얼",
    previewSrc: "/hq-avatars/kr-m-10s-minjun.png",
  },
  {
    id: "kr-f-20s-jiwoo",
    nameKo: "지우",
    ageGroup: "20s",
    ageLabelKo: "20대 여성",
    personaKo: "20대 여성 직장 초년생",
    gender: "female",
    accent: "from-fuchsia-400/40 to-violet-700/30",
    appearanceEn:
      "fictional Korean woman in her mid-20s, neat natural look, soft wavy black hair, polite smile, trendy everyday fashion, shopping-host vibe — original character, not a real person",
    blurbKo: "기본값 · 20대 여성 UGC",
    previewSrc: "/hq-avatars/kr-f-20s-jiwoo.png",
  },
  {
    id: "kr-m-20s-hyunwoo",
    nameKo: "현우",
    ageGroup: "20s",
    ageLabelKo: "20대 남성",
    personaKo: "20대 남성 직장인",
    gender: "male",
    accent: "from-cyan-400/40 to-indigo-700/30",
    appearanceEn:
      "fictional Korean man in his mid-20s, clean short black hair, approachable smile, modern casual wear — original character, not a real person",
    blurbKo: "20대 남성 · 라이프스타일",
    previewSrc: "/hq-avatars/kr-m-20s-hyunwoo.png",
  },
  {
    id: "kr-f-30s-seoyeon",
    nameKo: "서연",
    ageGroup: "30s",
    ageLabelKo: "30대 여성",
    personaKo: "30대 여성 주부",
    gender: "female",
    accent: "from-amber-400/40 to-orange-700/30",
    appearanceEn:
      "fictional Korean woman in her early 30s, shoulder-length dark hair, warm refined smile, smart casual home outfit, trustworthy homemaker presenter — original character, not a real person",
    blurbKo: "30대 여성 주부 · 신뢰감",
    previewSrc: "/hq-avatars/kr-f-30s-seoyeon.png",
  },
  {
    id: "kr-m-30s-junho",
    nameKo: "준호",
    ageGroup: "30s",
    ageLabelKo: "30대 남성",
    personaKo: "30대 남성 회사원",
    gender: "male",
    accent: "from-emerald-400/40 to-teal-800/30",
    appearanceEn:
      "fictional Korean man in his early 30s, neat side-part hair, calm confident smile, business-casual outfit, office-worker host — original character, not a real person",
    blurbKo: "30대 회사원 · 성숙한 톤",
    previewSrc: "/hq-avatars/kr-m-30s-junho.png",
  },
  {
    id: "kr-f-40s-mikyeong",
    nameKo: "미경",
    ageGroup: "40s",
    ageLabelKo: "40대 여성",
    personaKo: "40대 여성 주부",
    gender: "female",
    accent: "from-rose-300/40 to-red-800/30",
    appearanceEn:
      "fictional Korean woman in her early 40s, soft medium-length hair, gentle mature smile, polished everyday fashion, motherly homemaker presenter — original character, not a real person",
    blurbKo: "40대 여성 주부 · 생활감",
    previewSrc: "/hq-avatars/kr-f-40s-mikyeong.png",
  },
  {
    id: "kr-m-40s-seongmin",
    nameKo: "성민",
    ageGroup: "40s",
    ageLabelKo: "40대 남성",
    personaKo: "40대 남성 회사원",
    gender: "male",
    accent: "from-slate-400/40 to-slate-800/40",
    appearanceEn:
      "fictional Korean man in his early 40s, short neat hair, warm fatherly smile, smart casual knitwear, reliable office-worker presenter — original character, not a real person",
    blurbKo: "40대 회사원 · 가장 톤",
    previewSrc: "/hq-avatars/kr-m-40s-seongmin.png",
  },
  {
    id: "kr-f-50s-yeonghui",
    nameKo: "영희",
    ageGroup: "50s",
    ageLabelKo: "50대 여성",
    personaKo: "50대 여성 주부",
    gender: "female",
    accent: "from-lime-300/30 to-green-800/30",
    appearanceEn:
      "fictional Korean woman in her early 50s, soft silver-black hair, kind smile, neat blouse, wholesome neighborly homemaker — original character, not a real person",
    blurbKo: "50대 여성 주부 · 친근함",
    previewSrc: "/hq-avatars/kr-f-50s-yeonghui.png",
  },
  {
    id: "kr-m-50s-cheolho",
    nameKo: "철호",
    ageGroup: "50s",
    ageLabelKo: "50대 남성",
    personaKo: "50대 남성 회사원",
    gender: "male",
    accent: "from-stone-400/40 to-stone-800/40",
    appearanceEn:
      "fictional Korean man in his early 50s, short salt-and-pepper hair, calm smile, polo shirt, trustworthy senior office-worker presenter — original character, not a real person",
    blurbKo: "50대 회사원 · 든든함",
    previewSrc: "/hq-avatars/kr-m-50s-cheolho.png",
  },
]

export function getHqAvatarById(id: string | undefined | null): HqShoppingAvatar {
  return (
    HQ_SHOPPING_AVATARS.find((a) => a.id === id) ||
    HQ_SHOPPING_AVATARS.find((a) => a.id === HQ_DEFAULT_AVATAR_ID)!
  )
}

export function groupHqAvatarsByAge(): Record<HqAvatarAgeGroup, HqShoppingAvatar[]> {
  const grouped = {} as Record<HqAvatarAgeGroup, HqShoppingAvatar[]>
  for (const age of HQ_AVATAR_AGE_ORDER) grouped[age] = []
  for (const avatar of HQ_SHOPPING_AVATARS) {
    grouped[avatar.ageGroup].push(avatar)
  }
  return grouped
}

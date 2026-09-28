/**
 * 롱폼 v2 TTS 보이스 → UI용 가명·얼굴 (실제 TTS id는 그대로 사용)
 * 엔진(Supertonic / ElevenLabs / Supertone)마다 카탈로그·인물이 다름
 */

import { HQ_SHOPPING_AVATARS } from "@/lib/hq-shopping-avatars"
import { ELEVENLABS_SAMPLE_VOICES } from "@/lib/shotform-tts-providers"

export type LongformVoicePersona = {
  /** TTS voice id (F1, M2, ElevenLabs id …) */
  voiceId: string
  /** UI 가명 */
  aliasKo: string
  /** 한 줄 소개 */
  blurbKo: string
  gender: "female" | "male" | "unknown"
  previewSrc: string
  accent: string
}

const BY_ID = Object.fromEntries(HQ_SHOPPING_AVATARS.map((a) => [a.id, a])) as Record<
  string,
  (typeof HQ_SHOPPING_AVATARS)[number]
>

/** 내장 Supertonic 보이스 고정 매핑 */
const SUPERTONIC_PERSONA: Record<
  string,
  { aliasKo: string; blurbKo: string; avatarId: string; gender: "female" | "male" }
> = {
  F1: { aliasKo: "하린", blurbKo: "Supertonic · 또렷한 여성", avatarId: "kr-f-20s-jiwoo", gender: "female" },
  F2: { aliasKo: "수아", blurbKo: "Supertonic · 밝은 여성", avatarId: "kr-f-10s-sua", gender: "female" },
  F3: { aliasKo: "서연", blurbKo: "Supertonic · 따뜻한 여성", avatarId: "kr-f-30s-seoyeon", gender: "female" },
  F4: { aliasKo: "미경", blurbKo: "Supertonic · 신뢰감 있는 여성", avatarId: "kr-f-40s-mikyeong", gender: "female" },
  F5: { aliasKo: "영희", blurbKo: "Supertonic · 차분한 시니어 여성", avatarId: "kr-f-50s-yeonghui", gender: "female" },
  M1: { aliasKo: "준호", blurbKo: "Supertonic · 안정적인 남성", avatarId: "kr-m-30s-junho", gender: "male" },
  M2: { aliasKo: "현우", blurbKo: "Supertonic · 젊은 남성", avatarId: "kr-m-20s-hyunwoo", gender: "male" },
  M3: { aliasKo: "성민", blurbKo: "Supertonic · 무게감 있는 남성", avatarId: "kr-m-40s-seongmin", gender: "male" },
  M4: { aliasKo: "민준", blurbKo: "Supertonic · 밝은 남성", avatarId: "kr-m-10s-minjun", gender: "male" },
  M5: { aliasKo: "철호", blurbKo: "Supertonic · 깊은 시니어 남성", avatarId: "kr-m-50s-cheolho", gender: "male" },
  dasom: { aliasKo: "다솜", blurbKo: "Supertonic · 커스텀 여성", avatarId: "kr-f-20s-jiwoo", gender: "female" },
  yeoseong1: { aliasKo: "예린", blurbKo: "Supertonic · 커스텀 여성", avatarId: "kr-f-30s-seoyeon", gender: "female" },
  hq1: { aliasKo: "퀄좋은 목소리1", blurbKo: "Supertonic 3 · 고품질 남성", avatarId: "kr-m-30s-junho", gender: "male" },
  hq2: { aliasKo: "퀄좋은 목소리2", blurbKo: "Supertonic 3 · 고품질 남성", avatarId: "kr-m-20s-hyunwoo", gender: "male" },
  hq3: { aliasKo: "퀄좋은 목소리3", blurbKo: "Supertonic 3 · 고품질 남성", avatarId: "kr-m-40s-seongmin", gender: "male" },
  hq4: { aliasKo: "퀄좋은 목소리4", blurbKo: "Supertonic 3 · 고품질 남성", avatarId: "kr-m-50s-cheolho", gender: "male" },
}

/**
 * ElevenLabs 추천 5종 — 쇼핑숏폼과 동일 ID, UI만 한국어 인물
 * (API 계정 보이스도 아래에 없으면 해시 가명으로 표시)
 */
const ELEVENLABS_PERSONA: Record<
  string,
  { aliasKo: string; blurbKo: string; avatarId: string; gender: "female" | "male" }
> = {
  jB1Cifc2UQbq1gR3wnb0: {
    aliasKo: "레이첼",
    blurbKo: "ElevenLabs · 여성 · 기본",
    avatarId: "kr-f-20s-jiwoo",
    gender: "female",
  },
  "8jHHF8rMqMlg8if2mOUe": {
    aliasKo: "소연",
    blurbKo: "ElevenLabs · 여성 · 밝음",
    avatarId: "kr-f-10s-sua",
    gender: "female",
  },
  uyVNoMrnUku1dZyVEXwD: {
    aliasKo: "하늘",
    blurbKo: "ElevenLabs · 여성 · 내레이션",
    avatarId: "kr-f-30s-seoyeon",
    gender: "female",
  },
  "1KNqBv4TutQtzSIACsMC": {
    aliasKo: "도현",
    blurbKo: "ElevenLabs · 남성 · 캐주얼",
    avatarId: "kr-m-20s-hyunwoo",
    gender: "male",
  },
  "4JJwo477JUAx3HV0T7n7": {
    aliasKo: "재우",
    blurbKo: "ElevenLabs · 남성 · 무게감",
    avatarId: "kr-m-40s-seongmin",
    gender: "male",
  },
  // 페이지 폴백에 있던 공식 보이스
  EXAVITQu4vr4xnSDxMaL: {
    aliasKo: "사라",
    blurbKo: "ElevenLabs · Sarah",
    avatarId: "kr-f-30s-seoyeon",
    gender: "female",
  },
  "21m00Tcm4TlvDq8ikWAM": {
    aliasKo: "레이첼",
    blurbKo: "ElevenLabs · Rachel",
    avatarId: "kr-f-20s-jiwoo",
    gender: "female",
  },
}

/** 자주 쓰는 Supertone 보이스 가명 (API name이 영문/ID일 때) */
const SUPERTONE_PERSONA: Record<
  string,
  { aliasKo: string; blurbKo: string; avatarId: string; gender: "female" | "male" }
> = {
  // 계정마다 ID가 달라 API name 우선. 알려진 슬러그만 보강
  default: {
    aliasKo: "수퍼톤",
    blurbKo: "Supertone · 기본",
    avatarId: "kr-f-20s-jiwoo",
    gender: "female",
  },
}

const FALLBACK_FEMALE = ["kr-f-20s-jiwoo", "kr-f-30s-seoyeon", "kr-f-10s-sua", "kr-f-40s-mikyeong", "kr-f-50s-yeonghui"]
const FALLBACK_MALE = ["kr-m-20s-hyunwoo", "kr-m-30s-junho", "kr-m-10s-minjun", "kr-m-40s-seongmin", "kr-m-50s-cheolho"]

const ALIAS_POOL_F = ["하린", "예진", "소희", "나은", "채원", "지안", "유나", "가은"]
const ALIAS_POOL_M = ["도윤", "시우", "건우", "재현", "태민", "우진", "승호", "민재"]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function stripPrefix(voiceId: string): string {
  return String(voiceId || "")
    .replace(/^supertonic-/, "")
    .replace(/^supertone-/, "")
    .replace(/^elevenlabs-/, "")
    .trim()
}

/** ElevenLabs류 긴 영문 ID — 가명으로 쓰면 안 됨 */
function looksLikeCloudVoiceId(id: string): boolean {
  return /^[A-Za-z0-9_-]{12,}$/.test(id) && !/^[FM]\d$/i.test(id)
}

function isHumanLabel(label: string): boolean {
  const t = label.trim()
  if (!t) return false
  if (/[가-힣]/.test(t)) return true
  if (looksLikeCloudVoiceId(t)) return false
  if (t.length <= 28 && /[A-Za-z]/.test(t)) return true
  return false
}

function inferGender(voiceId: string, label: string): "female" | "male" | "unknown" {
  const id = voiceId.trim()
  const t = `${id} ${label}`
  if (/^F/i.test(id) || /여|female|woman|yeo|girl|rachel|sarah|soft/i.test(t)) return "female"
  if (/^M/i.test(id) || /남|male|man|nam|boy|adam|josh/i.test(t)) return "male"
  return "unknown"
}

function pickAvatar(gender: "female" | "male" | "unknown", seed: string) {
  const pool =
    gender === "male" ? FALLBACK_MALE : gender === "female" ? FALLBACK_FEMALE : [...FALLBACK_FEMALE, ...FALLBACK_MALE]
  const id = pool[hashStr(seed) % pool.length]
  return BY_ID[id] || HQ_SHOPPING_AVATARS[0]
}

function fromFixed(
  id: string,
  fixed: { aliasKo: string; blurbKo: string; avatarId: string; gender: "female" | "male" }
): LongformVoicePersona {
  const av = BY_ID[fixed.avatarId] || HQ_SHOPPING_AVATARS[0]
  return {
    voiceId: id,
    aliasKo: fixed.aliasKo,
    blurbKo: fixed.blurbKo,
    gender: fixed.gender,
    previewSrc: av.previewSrc,
    accent: av.accent,
  }
}

/** 학습 보이스 n1 → 가명 */
function recordedAlias(voiceId: string): string | null {
  const m = /^n(\d{1,3})$/i.exec(voiceId.trim())
  if (!m) return null
  const n = m[1]
  const pool = [...ALIAS_POOL_F, ...ALIAS_POOL_M]
  return `${pool[hashStr(voiceId) % pool.length]}${n}`
}

/**
 * @param catalogLabel API/카탈로그에 표시된 이름 (Rachel, 민준 …)
 * @param engine 선택 시 엔진별 고정 매핑 우선
 */
export function resolveVoicePersona(
  voiceId: string,
  catalogLabel?: string,
  engine?: "supertonic" | "elevenlabs" | "supertone"
): LongformVoicePersona {
  const id = stripPrefix(voiceId)
  const label = (catalogLabel || "").trim()

  if (engine === "elevenlabs" || (!engine && ELEVENLABS_PERSONA[id])) {
    const hit = ELEVENLABS_PERSONA[id]
    if (hit) return fromFixed(id, hit)
  }

  if (engine === "supertone" || (!engine && SUPERTONE_PERSONA[id])) {
    const hit = SUPERTONE_PERSONA[id]
    if (hit) return fromFixed(id, hit)
  }

  if (engine === "supertonic" || (!engine && SUPERTONIC_PERSONA[id])) {
    const hit = SUPERTONIC_PERSONA[id]
    if (hit) return fromFixed(id, hit)
  }

  // 엔진 미지정 시에도 알려진 ID는 매핑
  if (ELEVENLABS_PERSONA[id]) return fromFixed(id, ELEVENLABS_PERSONA[id])
  if (SUPERTONIC_PERSONA[id]) return fromFixed(id, SUPERTONIC_PERSONA[id])
  if (SUPERTONE_PERSONA[id]) return fromFixed(id, SUPERTONE_PERSONA[id])

  const recorded = recordedAlias(id)
  if (recorded) {
    const gender = inferGender(id, label)
    const av = pickAvatar(gender === "unknown" ? "female" : gender, id)
    return {
      voiceId: id,
      aliasKo: recorded,
      blurbKo: "내 목소리 · 학습 보이스",
      gender,
      previewSrc: av.previewSrc,
      accent: av.accent,
    }
  }

  const gender = inferGender(id, label)
  const av = pickAvatar(gender, id || label)
  const pool = gender === "male" ? ALIAS_POOL_M : ALIAS_POOL_F

  let aliasKo: string
  if (isHumanLabel(label)) {
    // "한국어 · 기본" → 기본, "Rachel" → Rachel 짧은 한글 대체는 아래에서
    const short = label.replace(/^.*·\s*/, "").trim()
    aliasKo =
      short.length <= 10 && !looksLikeCloudVoiceId(short)
        ? short
        : pool[hashStr(id || label) % pool.length]
  } else {
    aliasKo = pool[hashStr(id || label) % pool.length]
  }

  const engineBlurb =
    engine === "elevenlabs"
      ? "ElevenLabs"
      : engine === "supertone"
        ? "Supertone"
        : engine === "supertonic"
          ? "Supertonic"
          : ""

  return {
    voiceId: id || voiceId,
    aliasKo,
    blurbKo:
      (engineBlurb ? `${engineBlurb} · ` : "") +
      (isHumanLabel(label)
        ? label
        : gender === "male"
          ? "남성 보이스"
          : gender === "female"
            ? "여성 보이스"
            : "커스텀 보이스"),
    gender,
    previewSrc: av.previewSrc,
    accent: av.accent,
  }
}

export function personaLabelForVoice(
  voiceId: string,
  catalogLabel?: string,
  engine?: "supertonic" | "elevenlabs" | "supertone"
): string {
  return resolveVoicePersona(voiceId, catalogLabel, engine).aliasKo
}

/** ElevenLabs UI용 기본 목록 (API 키 없을 때 · 엔진 전환 직후) */
export function elevenlabsVoiceOptions(): { id: string; label: string }[] {
  return ELEVENLABS_SAMPLE_VOICES.map((v) => {
    const p = ELEVENLABS_PERSONA[v.id]
    return {
      id: v.id,
      label: p ? `${p.aliasKo} · ${v.name}` : v.name,
    }
  })
}

export function defaultVoiceIdForEngine(engine: "supertonic" | "elevenlabs" | "supertone"): string {
  if (engine === "elevenlabs") return ELEVENLABS_SAMPLE_VOICES[0]!.id
  if (engine === "supertone") return "default"
  return "F1"
}

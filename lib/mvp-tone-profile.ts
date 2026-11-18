/**
 * 말투 프로필 — 참고 대본에서 뽑은 말투·전개 규칙.
 * 브라우저에 목록으로 저장하고, 프로젝트에는 선택한 프로필 사본을 둡니다.
 */

export type MvpToneProfile = {
  id: string
  name: string
  /** 누가 말하는지 (예: 직접 써 본 30대 직장인) */
  persona: string
  /** 존댓말/반말/섞음 */
  speechLevel: string
  /** 속도·텐션 */
  energy: string
  /** 첫 문장으로 붙잡는 방식 */
  opener: string
  /** 몸통 전개 순서 */
  flow: string[]
  /** 마무리·행동 유도 방식 */
  closer: string
  /** 자주 쓰는 표현 (그대로 복사 말고 느낌만) */
  signatureExpressions: string[]
  /** 피해야 할 것 */
  avoid: string[]
  /** 한 문장 평균 길이 감 */
  sentenceRhythm: string
  createdAt: number
}

const STORAGE_KEY = "mvp_tone_profiles_v1"
const MAX_LIST = 6

const str = (v: unknown, max = 160) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const strList = (v: unknown, n: number, max = 80) =>
  Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []

export function normalizeToneProfile(raw: unknown): MvpToneProfile | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const profile: MvpToneProfile = {
    id: str(r.id, 60) || `tone-${Date.now().toString(36)}`,
    name: str(r.name, 30) || "내 말투",
    persona: str(r.persona),
    speechLevel: str(r.speechLevel, 40),
    energy: str(r.energy, 80),
    opener: str(r.opener, 200),
    flow: strList(r.flow, 6, 100),
    closer: str(r.closer, 200),
    signatureExpressions: strList(r.signatureExpressions, 6, 40),
    avoid: strList(r.avoid, 5, 80),
    sentenceRhythm: str(r.sentenceRhythm, 100),
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
  }
  return profile.persona || profile.opener || profile.flow.length ? profile : null
}

export function loadToneProfiles(): MvpToneProfile[] {
  if (typeof window === "undefined") return []
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as unknown[]
    return list.map(normalizeToneProfile).filter((p): p is MvpToneProfile => Boolean(p))
  } catch {
    return []
  }
}

function writeToneProfiles(list: MvpToneProfile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_LIST)))
}

export function saveToneProfile(profile: MvpToneProfile): MvpToneProfile[] {
  const next = [profile, ...loadToneProfiles().filter((p) => p.id !== profile.id)]
  writeToneProfiles(next)
  return next.slice(0, MAX_LIST)
}

export function deleteToneProfile(id: string): MvpToneProfile[] {
  const next = loadToneProfiles().filter((p) => p.id !== id)
  writeToneProfiles(next)
  return next
}

/** 대본 생성 프롬프트에 붙일 블록 — 문장 복사가 아니라 규칙만 전달 */
export function buildToneProfilePromptBlock(profile: MvpToneProfile | null | undefined): string {
  const p = normalizeToneProfile(profile)
  if (!p) return ""
  const lines = [
    `**말투 프로필 「${p.name}」 적용 (화면 정합성 규칙보다 우선하지 않음)**`,
    p.persona && `- 화자: ${p.persona}`,
    p.speechLevel && `- 말 높임: ${p.speechLevel}`,
    p.energy && `- 텐션·속도: ${p.energy}`,
    p.sentenceRhythm && `- 문장 리듬: ${p.sentenceRhythm}`,
    p.opener && `- 첫 컷 시작 방식: ${p.opener}`,
    p.flow.length && `- 전개 순서: ${p.flow.join(" → ")}`,
    p.closer && `- 마지막 컷 마무리: ${p.closer}`,
    p.signatureExpressions.length &&
      `- 말맛 참고(그대로 복사 금지, 비슷한 결로만): ${p.signatureExpressions.join(" / ")}`,
    p.avoid.length && `- 피할 것: ${p.avoid.join(" / ")}`,
  ]
  return lines.filter(Boolean).join("\n")
}

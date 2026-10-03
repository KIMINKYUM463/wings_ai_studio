export type SignupClassGroup = "VIP반" | "정규반"

export type SignupRosterMember = {
  name: string
  phone: string
  email: string
  classGroup: SignupClassGroup
}

/** 가입 시 자동 승인할 수강생 명단 (이메일 또는 전화번호 일치) */
export const SIGNUP_AUTO_APPROVE_ROSTER: SignupRosterMember[] = [
  { name: "한귀주", phone: "01021073134", email: "km3752@naver.com", classGroup: "VIP반" },
  { name: "고재원", phone: "01058529949", email: "brownkoh5852@gmail.com", classGroup: "VIP반" },
  { name: "김종태", phone: "01085333647", email: "gjongtae@gmail.com", classGroup: "VIP반" },
  { name: "조영미", phone: "01047490413", email: "maki1202@naver.com", classGroup: "VIP반" },
  { name: "이영길", phone: "01027973068", email: "lyg1688@kakao.com", classGroup: "VIP반" },
  { name: "박상현", phone: "01024395813", email: "psh5813@naver.com", classGroup: "VIP반" },
  { name: "장종필", phone: "12134461086", email: "mopis21@gmail.com", classGroup: "VIP반" },
  { name: "윤미진", phone: "01040888143", email: "dkdltmfn0706@naver.com", classGroup: "VIP반" },
  { name: "이정란", phone: "01033124966", email: "choi02815@daum.net", classGroup: "VIP반" },
  { name: "김가연", phone: "01063169161", email: "sulsa1987@gmail.com", classGroup: "VIP반" },
  { name: "이정화", phone: "01026320963", email: "hwa0930@daum.net", classGroup: "VIP반" },
  { name: "손현숙", phone: "01057658828", email: "songive12@naver.com", classGroup: "VIP반" },
  { name: "김주연", phone: "01029073325", email: "gunbass613@naver.com", classGroup: "VIP반" },
  { name: "이준수", phone: "01087151378", email: "designlyb@kakao.com", classGroup: "VIP반" },
  { name: "이지원", phone: "01087621714", email: "point38@hanmail.net", classGroup: "VIP반" },
  { name: "허선화", phone: "01023357073", email: "red-wine@kakao.com", classGroup: "VIP반" },
  { name: "천미향", phone: "01084748788", email: "mhreborn@naver.com", classGroup: "VIP반" },
  { name: "맹호", phone: "01030050898", email: "ttllout119@nate.com", classGroup: "VIP반" },
  { name: "이수연", phone: "01075120507", email: "hallocoffee@naver.com", classGroup: "VIP반" },
  { name: "유은정", phone: "01028885812", email: "hey80633@gmail.com", classGroup: "VIP반" },
  { name: "한승훈", phone: "01087864244", email: "mnihsh@naver.com", classGroup: "VIP반" },
  { name: "김지은", phone: "01093012709", email: "lunaticjj@naver.com", classGroup: "VIP반" },
  { name: "박주현", phone: "01082760678", email: "wngusl935@nate.com", classGroup: "VIP반" },
  { name: "박상균", phone: "01088355670", email: "kd4654@naver.com", classGroup: "VIP반" },
  { name: "신정희", phone: "01026257882", email: "happy103@kakao.com", classGroup: "VIP반" },
  { name: "강광중", phone: "01032309640", email: "gawonyan@naver.com", classGroup: "VIP반" },
  { name: "이형진", phone: "01041606663", email: "hyungjin86@gmail.com", classGroup: "VIP반" },
  { name: "권미애", phone: "01062219214", email: "loveset_26@naver.com", classGroup: "VIP반" },
  { name: "김용기", phone: "01053668500", email: "acetiger@kakao.com", classGroup: "VIP반" },
  { name: "강양훈", phone: "01088241460", email: "gangco@daum.net", classGroup: "VIP반" },
  { name: "이고은", phone: "01088897600", email: "34dew@hanmail.net", classGroup: "VIP반" },
  { name: "최효영", phone: "01031433759", email: "chlgydms1004@hanmail.net", classGroup: "VIP반" },
  { name: "김민권", phone: "01071785533", email: "cc_c@kakao.com", classGroup: "VIP반" },
  { name: "이수빈", phone: "01027929963", email: "dltn0707@daum.net", classGroup: "VIP반" },
  { name: "안영희", phone: "01056104137", email: "a6100016@naver.com", classGroup: "VIP반" },
  { name: "이현정", phone: "01075291601", email: "olivia930729@gmail.com", classGroup: "VIP반" },
  { name: "장경선", phone: "01053131667", email: "jaks22@nate.com", classGroup: "VIP반" },
  { name: "오용섭", phone: "01085085274", email: "blastbrute@naver.com", classGroup: "VIP반" },
  { name: "권혁정", phone: "61434415351", email: "jace.hj.kwon@gmail.com", classGroup: "VIP반" },
  { name: "김경민", phone: "01056329658", email: "11allalla@naver.com", classGroup: "VIP반" },
  { name: "김보준", phone: "01041360926", email: "rurusky@nate.com", classGroup: "VIP반" },
  { name: "변경원", phone: "01047629977", email: "yanncool@naver.com", classGroup: "VIP반" },
  { name: "양은성", phone: "01092381455", email: "eunice_yang@naver.com", classGroup: "VIP반" },
  { name: "황조일", phone: "01037080331", email: "hji123@hanmail.net", classGroup: "정규반" },
  { name: "홍길표", phone: "01092600209", email: "atmall@naver.com", classGroup: "정규반" },
  { name: "민경선", phone: "01043204177", email: "mks164@kakao.com", classGroup: "정규반" },
  { name: "조국열", phone: "01041331542", email: "dukyoon2@hanmail.net", classGroup: "정규반" },
]

function normalizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase()
}

/** 카카오(+82 10-xxxx) / 국내 010 / 해외번호를 비교용 숫자열로 통일 */
export function normalizePhoneDigits(phone: string | null | undefined): string {
  const digits = (phone || "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("82") && digits.length >= 11) {
    return `0${digits.slice(2)}`
  }
  if (digits.startsWith("61") && digits.length >= 11) {
    return digits
  }
  if (digits.length === 10 && digits.startsWith("10")) {
    return `0${digits}`
  }
  return digits
}

const EMAIL_SET = new Set(
  SIGNUP_AUTO_APPROVE_ROSTER.map((m) => normalizeEmail(m.email)).filter(Boolean)
)

const PHONE_SET = new Set(
  SIGNUP_AUTO_APPROVE_ROSTER.map((m) => normalizePhoneDigits(m.phone)).filter(Boolean)
)

const PHONE_TAIL8_SET = new Set(
  [...PHONE_SET].filter((p) => p.length >= 8).map((p) => p.slice(-8))
)

export function findSignupRosterMatch(input: {
  email?: string | null
  phone?: string | null
}): SignupRosterMember | null {
  const email = normalizeEmail(input.email)
  if (email && EMAIL_SET.has(email)) {
    return SIGNUP_AUTO_APPROVE_ROSTER.find((m) => normalizeEmail(m.email) === email) || null
  }

  const phone = normalizePhoneDigits(input.phone)
  if (phone && PHONE_SET.has(phone)) {
    return SIGNUP_AUTO_APPROVE_ROSTER.find((m) => normalizePhoneDigits(m.phone) === phone) || null
  }

  const tail8 = phone.length >= 8 ? phone.slice(-8) : ""
  if (tail8 && PHONE_TAIL8_SET.has(tail8)) {
    return (
      SIGNUP_AUTO_APPROVE_ROSTER.find((m) => normalizePhoneDigits(m.phone).slice(-8) === tail8) ||
      null
    )
  }

  return null
}

export function shouldAutoApproveSignup(input: {
  email?: string | null
  phone?: string | null
}): boolean {
  return Boolean(findSignupRosterMatch(input))
}

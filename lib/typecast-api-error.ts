/**
 * 타입캐스트 API 오류를 사용자에게 읽기 쉬운 한국어로 바꿉니다.
 * 403의 “free accounts / Unusual account activity”는 우리 앱 버그가 아니라
 * Typecast 쪽 계정·요금제(Studio vs API) 이슈입니다.
 */

export const TYPECAST_API_GUIDE_CODE = "TYPECAST_API_PLAN_403"
export const TYPECAST_API_GUIDE_EVENT = "wings:typecast-api-guide"

export const TYPECAST_API_GUIDE = {
  title: "타입캐스트 API가 이 키를 거절했습니다",
  subtitle: "윙즈 오류가 아닙니다. 타입캐스트가 API 요청을 막은 상태입니다.",
  body: [
    "웹(스튜디오)에서 유료 결제하셨고 크레딧이 남아 있어도, 윙즈 TTS는 그와 다른 「API 키」로 동작합니다.",
    "스튜디오 요금제와 API 요금제는 별개입니다. API 키가 무료 한도이거나 차단되면 이 403이 납니다.",
  ],
  steps: [
    "typecast.ai/api 에 로그인해 API 콘솔을 엽니다.",
    "API 요금제가 유료인지 확인합니다. (스튜디오 결제와 다릅니다)",
    "콘솔에서 API 키를 새로 발급합니다. 예전 Starter 키는 지금 API와 안 맞을 수 있습니다.",
    "윙즈 설정 → Typecast API Key에 그 키를 붙여넣습니다.",
    "한 키를 여러 명이 같이 쓰지 마세요. 공유하면 차단이 더 잘 납니다.",
  ],
  links: [
    { href: "https://typecast.ai/api", label: "API 콘솔 · 키 발급" },
    { href: "https://typecast.ai/pricing/api", label: "API 요금제 안내" },
  ],
} as const

export function isTypecastApi403Guide(message: string | null | undefined): boolean {
  if (!message) return false
  const t = message.toLowerCase()
  return (
    t.includes("typecast_api_plan_403") ||
    t.includes("unusual account activity") ||
    t.includes("abuse of free accounts") ||
    (t.includes("typecast") && t.includes("403") && t.includes("pricing/api")) ||
    t.includes("웹(스튜디오) 유료 구독") ||
    t.includes("api가 이 키를 거절")
  )
}

export function explainTypecastApiError(status: number, raw: string): string {
  const text = (raw || "").replace(/\s+/g, " ").trim()
  const lower = text.toLowerCase()

  if (
    status === 403 &&
    (lower.includes("unusual account activity") ||
      lower.includes("abuse of free accounts") ||
      lower.includes("pricing/api"))
  ) {
    return (
      `[${TYPECAST_API_GUIDE_CODE}] 타입캐스트 API가 이 키를 거절했습니다 (403). ` +
      "웹(스튜디오) 유료 구독·크레딧과 API 요금제는 별개입니다. " +
      "아래 안내문을 따라 API 콘솔에서 키를 다시 발급해 주세요."
    )
  }

  if (status === 403) {
    return (
      "타입캐스트 API 권한 오류 (403). 예전 Starter 키이거나 계정 휴면일 수 있습니다. " +
      "typecast.ai/api 에서 현재 API 키를 다시 발급해 주세요."
    )
  }

  if (status === 401) {
    return "타입캐스트 API 키가 올바르지 않습니다 (401). 설정에 넣은 키를 확인해 주세요."
  }

  if (status === 402) {
    return "타입캐스트 API 크레딧이 부족합니다 (402). API 대시보드에서 잔액을 확인해 주세요. (스튜디오 크레딧과 다릅니다)"
  }

  if (status === 429) {
    return "타입캐스트 API 호출이 너무 많습니다 (429). 잠시 후 다시 시도해 주세요."
  }

  return text ? `타입캐스트 TTS 실패 (${status}): ${text.slice(0, 280)}` : `타입캐스트 TTS 실패 (${status})`
}

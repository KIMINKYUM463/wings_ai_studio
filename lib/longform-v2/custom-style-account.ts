/** 계정별 커스텀 그림체 메타 (이미지 바이너리는 IndexedDB) */

export type AccountCustomStyle = {
  styleHint: string
  labelKo: string
  descriptionKo: string
  updatedAt: string
}

const PREFIX = "wings_longform_v2_account_custom_style:"

export async function resolveLongformAccountId(): Promise<string> {
  if (typeof window === "undefined") return "anonymous"
  try {
    const res = await fetch("/api/kakao/user", { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as {
      user?: { id?: string | number; email?: string }
    }
    if (data?.user) {
      const email = String(data.user.email || "").trim()
      if (email) return email
      if (data.user.id != null && String(data.user.id)) return `kakao_${data.user.id}`
    }
  } catch {
    /* fall through */
  }
  try {
    return (
      localStorage.getItem("user_id")?.trim() ||
      localStorage.getItem("user_email")?.trim() ||
      "anonymous"
    )
  } catch {
    return "anonymous"
  }
}

function storageKey(accountId: string) {
  return PREFIX + encodeURIComponent(accountId || "anonymous")
}

export function loadAccountCustomStyle(accountId: string): AccountCustomStyle | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(storageKey(accountId))
    if (!raw) return null
    const data = JSON.parse(raw) as AccountCustomStyle
    if (!data?.styleHint?.trim()) return null
    return {
      styleHint: String(data.styleHint || "").trim(),
      labelKo: String(data.labelKo || "커스텀 그림체").trim() || "커스텀 그림체",
      descriptionKo: String(data.descriptionKo || "").trim(),
      updatedAt: String(data.updatedAt || ""),
    }
  } catch {
    return null
  }
}

export function saveAccountCustomStyle(
  accountId: string,
  style: Omit<AccountCustomStyle, "updatedAt"> & { updatedAt?: string }
): AccountCustomStyle {
  const next: AccountCustomStyle = {
    styleHint: style.styleHint.trim(),
    labelKo: (style.labelKo || "커스텀 그림체").trim() || "커스텀 그림체",
    descriptionKo: (style.descriptionKo || "").trim(),
    updatedAt: style.updatedAt || new Date().toISOString(),
  }
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(next))
  } catch {
    /* quota — ignore */
  }
  return next
}

export function clearAccountCustomStyle(accountId: string) {
  try {
    localStorage.removeItem(storageKey(accountId))
  } catch {
    /* ignore */
  }
}

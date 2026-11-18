import "server-only"

import { cookies } from "next/headers"
import { NextResponse } from "next/server"

type KakaoCookieUser = {
  id?: string | number
  email?: string
  accessToken?: string
}

export type StoryAuthenticatedUser = {
  kakaoId: string
  userId: string
}

const verifiedUsers = new Map<
  string,
  { expiresAt: number; user: StoryAuthenticatedUser }
>()
const requestBuckets = new Map<string, { startedAt: number; count: number }>()
const dailyQuotaBuckets = new Map<string, { day: string; count: number }>()

function userIdFromKakao(user: KakaoCookieUser): string {
  const email = String(user.email || "").trim()
  return email || `kakao_${String(user.id || "").trim()}`
}

/**
 * kakao_user 쿠키는 과거 버전에서 서명 없이 저장됐으므로 쿠키 값만 신뢰하지 않습니다.
 * access token을 Kakao에 재검증하고 짧게 캐시합니다.
 */
function parseKakaoCookie(raw: string): KakaoCookieUser {
  const attempts = [raw]
  try {
    attempts.push(decodeURIComponent(raw))
  } catch {
    // ignore
  }
  for (const value of attempts) {
    try {
      return JSON.parse(value) as KakaoCookieUser
    } catch {
      // next
    }
  }
  throw new Error("로그인 정보가 올바르지 않습니다.")
}

export async function requireStoryUser(): Promise<StoryAuthenticatedUser> {
  const cookieStore = await cookies()
  const raw = cookieStore.get("kakao_user")?.value
  if (!raw) throw new Error("로그인이 필요합니다.")

  const cookieUser = parseKakaoCookie(raw)
  const token = String(cookieUser.accessToken || "").trim()
  if (!token) throw new Error("로그인이 만료되었습니다. 다시 로그인해주세요.")

  const cached = verifiedUsers.get(token)
  if (cached && cached.expiresAt > Date.now()) return cached.user

  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) {
    verifiedUsers.delete(token)
    throw new Error("로그인이 만료되었습니다. 다시 로그인해주세요.")
  }
  const verified = (await response.json()) as {
    id?: number | string
    kakao_account?: { email?: string }
  }
  const kakaoId = String(verified.id || "").trim()
  if (!kakaoId || kakaoId !== String(cookieUser.id || "").trim()) {
    throw new Error("로그인 사용자 확인에 실패했습니다.")
  }
  const user: StoryAuthenticatedUser = {
    kakaoId,
    userId:
      String(verified.kakao_account?.email || "").trim() ||
      userIdFromKakao(cookieUser),
  }
  verifiedUsers.set(token, { expiresAt: Date.now() + 60_000, user })
  return user
}

export async function requireStoryUserId(expected?: string): Promise<string> {
  const user = await requireStoryUser()
  if (expected && expected.trim() !== user.userId) {
    throw new Error("다른 사용자의 데이터에는 접근할 수 없습니다.")
  }
  return user.userId
}

/** 서버리스 인스턴스 단위 방어. 외부 영속 rate limiter를 붙이기 전에도 폭주를 막습니다. */
export async function guardStoryApiRequest(
  request: Request,
  options: {
    limit?: number
    windowMs?: number
    maxBytes?: number
    maxDaily?: number
    quotaCost?: number
  } = {}
): Promise<
  | { user: StoryAuthenticatedUser; error?: never }
  | { user?: never; error: NextResponse }
> {
  try {
    const user = await requireStoryUser()
    const limit = options.limit ?? 20
    const windowMs = options.windowMs ?? 60_000
    const contentLength = Number(request.headers.get("content-length") || 0)
    if (contentLength > (options.maxBytes ?? 1_000_000)) {
      return {
        error: NextResponse.json(
          { error: "요청 데이터가 너무 큽니다." },
          { status: 413 }
        ),
      }
    }
    const key = `${user.kakaoId}:${new URL(request.url).pathname}`
    const now = Date.now()
    const bucket = requestBuckets.get(key)
    if (!bucket || now - bucket.startedAt >= windowMs) {
      requestBuckets.set(key, { startedAt: now, count: 1 })
    } else {
      bucket.count += 1
      if (bucket.count > limit) {
        return {
          error: NextResponse.json(
            { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
            { status: 429, headers: { "Retry-After": "60" } }
          ),
        }
      }
    }

    const day = new Date(now).toISOString().slice(0, 10)
    const quotaCost = Math.max(1, Math.floor(options.quotaCost ?? 1))
    const maxDaily = Math.max(quotaCost, options.maxDaily ?? 200)
    const quota = dailyQuotaBuckets.get(key)
    if (!quota || quota.day !== day) {
      dailyQuotaBuckets.set(key, { day, count: quotaCost })
    } else if (quota.count + quotaCost > maxDaily) {
      return {
        error: NextResponse.json(
          { error: "오늘의 사용 한도를 초과했습니다. 내일 다시 시도해주세요." },
          { status: 429 }
        ),
      }
    } else {
      quota.count += quotaCost
    }

    // 장시간 실행되는 서버 인스턴스의 메모리를 제한합니다.
    if (requestBuckets.size > 5_000) {
      for (const [bucketKey, value] of requestBuckets) {
        if (now - value.startedAt > windowMs * 2) requestBuckets.delete(bucketKey)
      }
    }
    if (dailyQuotaBuckets.size > 5_000) {
      for (const [bucketKey, value] of dailyQuotaBuckets) {
        if (value.day !== day) dailyQuotaBuckets.delete(bucketKey)
      }
    }
    return { user }
  } catch (error) {
    return {
      error: NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "로그인이 필요합니다.",
        },
        { status: 401 }
      ),
    }
  }
}

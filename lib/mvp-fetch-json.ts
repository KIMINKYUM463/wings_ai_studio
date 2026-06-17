/** fetch 응답이 JSON이 아닐 때(413 등)도 읽기 쉬운 에러 메시지 */
export async function readFetchJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text.trim()) {
    if (!res.ok) throw new Error(`요청 실패 (${res.status})`)
    return {} as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 120)
    if (res.status === 413 || /entity too large/i.test(text)) {
      throw new Error("업로드 용량이 너무 큽니다. 프레임을 나눠 다시 시도합니다.")
    }
    if (res.status === 502 || res.status === 503 || res.status === 504 || res.status === 524) {
      throw new Error(
        `서버 게이트웨이 오류 (${res.status}). 잠시 후 자동 재시도하거나, 새로고침 후 다시 실행해 주세요.`
      )
    }
    if (/<!DOCTYPE html>/i.test(text) || /<html/i.test(text)) {
      throw new Error(
        `서버 연결 오류 (${res.status}). Vercel/Cloudflare 타임아웃일 수 있습니다. 잠시 후 다시 시도해 주세요.`
      )
    }
    throw new Error(snippet || `요청 실패 (${res.status})`)
  }
}

/** WingsStudio youtubeLongformGemini 설명 파서 (jsonrepair 없이) */

export type YoutubeDescriptionResult = {
  description: string
  hashtags: string
  uploadTags: string[]
  pinnedComment: string
}

function stripMarkdownFence(text: string): string {
  let t = text.trim()
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  }
  return t
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function asTags(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => String(x || "").replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 30)
}

export function stripHashtagLinesFromYoutubeDescription(description: string): string {
  const lines = description.replace(/\r\n/g, "\n").split("\n")
  const filtered = lines.filter((line) => {
    const t = line.trim()
    if (!t) return true
    // 해시태그만 있는 줄 제거 (본문에서 분리 표시용)
    if (/^(#[\w가-힣]+(?:\s+#[\w가-힣]+)*)$/u.test(t)) return false
    return true
  })
  return filtered.join("\n").trim()
}

export function parseYoutubeDescriptionJson(raw: string): YoutubeDescriptionResult {
  const cleaned = stripMarkdownFence(raw)
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (!m) throw new Error("설명 JSON을 파싱하지 못했습니다.")
    parsed = JSON.parse(m[0]) as Record<string, unknown>
  }

  const description = asStr(parsed.description)
  const hashtags = asStr(parsed.hashtags)
  const pinnedComment = asStr(parsed.pinnedComment)
  const uploadTags = asTags(parsed.uploadTags)

  if (!description && !hashtags) {
    throw new Error("설명·해시태그가 비어 있습니다.")
  }

  return {
    description: stripHashtagLinesFromYoutubeDescription(description),
    hashtags,
    uploadTags,
    pinnedComment,
  }
}

export const YOUTUBE_DESCRIPTION_SYSTEM = `당신은 유튜브 롱폼 메타데이터 전문가입니다. 응답은 반드시 JSON 한 객체만 출력하세요(앞뒤 설명·마크다운 코드펜스 금지).

JSON 키:
- "description" (string): 유튜브 설명란. 이모지 사용 가능.
  - 첫 줄: 핵심 해시태그 정확히 3개(#키워드 형식). 반드시 "hashtags" 필드와 동일한 3개여야 함.
  - 둘째 줄부터: 훅·소개·혜택·감성·CTA·⏱ 타임라인(스포일러 금지, 대본 문장을 인용·복사하지 말고 구간별 짧은 주제와 분:초만)·구독 유도 등.
  - 마지막 줄: 첫 줄 3개와 겹치지 않는 추가 해시태그만 한 줄에.
- "pinnedComment" (string): 고정댓글 3~5줄, 참여 유도, 한글.
- "hashtags" (string): 핵심 해시태그 3개만 한 줄 (예: "#키워드1 #키워드2 #키워드3").
- "uploadTags" (string[]): 유튜브 업로드용 태그 20~25개. # 없이 단어만. hashtags의 3개와 동일한 단어(대소문자 무시)는 넣지 말 것.

JSON 문법 (필수): 문자열 값 안에 ASCII 큰따옴표(")를 쓰지 마세요. 인용·강조는 『』「」 또는 작은따옴표(')만 사용.

공통 제약: 한글 위주. 과장 클릭베이트·불법·성인·폭력·담배 등 부적절 표현 금지. 타임라인에 본문 대사를 붙이지 말 것.`

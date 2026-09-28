export const AI_TOPIC_MAX = 2000

export function topicForThumbnail(project: {
  title?: string | null
  script?: string | null
}): string {
  const t = project.title?.trim()
  if (t) return t
  const s = project.script?.trim() ?? ""
  if (s.length) return s.length > 120 ? `${s.slice(0, 120)}…` : s
  return "영상 주제"
}

/**
 * Replicate 썸네일 프롬프트용 주제 — YouTube 업로드 제목·설명을 우선.
 */
export function buildAiThumbnailTopic(
  project: {
    title?: string | null
    script?: string | null
    youtubeTitle?: string | null
    youtubeDescription?: string | null
  },
  youtubeTitle: string,
  youtubeDescription: string,
): string {
  const ytT = youtubeTitle.trim() || project.youtubeTitle?.trim() || ""
  const ytD = youtubeDescription.trim() || project.youtubeDescription?.trim() || ""
  const script = project.script?.trim() ?? ""

  const ctxFromDesc = ytD.length >= 24 ? (ytD.length > 520 ? `${ytD.slice(0, 517)}…` : ytD) : ""
  const ctxFromScript =
    !ctxFromDesc && script.length >= 24
      ? script.length > 520
        ? `${script.slice(0, 517)}…`
        : script
      : ""

  if (ytT) {
    const body = ctxFromDesc || ctxFromScript
    const out = body ? `${ytT}\n\n주제·내용: ${body}` : ytT
    return out.length > AI_TOPIC_MAX ? `${out.slice(0, AI_TOPIC_MAX - 1)}…` : out
  }

  if (ctxFromDesc) return ctxFromDesc.length > AI_TOPIC_MAX ? `${ctxFromDesc.slice(0, AI_TOPIC_MAX - 1)}…` : ctxFromDesc
  if (script.length) {
    const s = script.length > 600 ? `${script.slice(0, 597)}…` : script
    return s.length > AI_TOPIC_MAX ? `${s.slice(0, AI_TOPIC_MAX - 1)}…` : s
  }

  return topicForThumbnail(project)
}

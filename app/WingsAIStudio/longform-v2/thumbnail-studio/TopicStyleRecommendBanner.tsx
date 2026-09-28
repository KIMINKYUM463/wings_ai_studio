type Props = {
  loading: boolean
  hasAny: boolean
  summary: string | null
  activeCategory: string
  categorySet: Set<string>
  scriptReady: boolean
  className?: string
}

/** AI 이미지·자동화 — Gemini 주제 맞춤 스타일 추천 안내 (웹: 비활성 시 null) */
export function TopicStyleRecommendBanner({
  loading,
  hasAny,
  summary,
  activeCategory,
  categorySet,
  scriptReady,
  className,
}: Props) {
  const rootClass = ["scene-gen__topic-rec-banner", className].filter(Boolean).join(" ")
  void activeCategory
  void categorySet

  if (!scriptReady && !loading) return null

  if (loading) {
    return (
      <p className={`${rootClass} scene-gen__topic-rec-banner--loading`}>
        주제·대본에 맞는 스타일을 분석 중…
      </p>
    )
  }

  if (!hasAny) return null

  return (
    <p className={rootClass}>
      {summary?.trim() || "이 주제에 잘 맞는 스타일을 추천합니다."}
    </p>
  )
}

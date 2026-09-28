type Props = {
  variant: "topic" | "catalog"
  title?: string
}

export function SceneStyleRecBadge({ variant, title }: Props) {
  if (variant === "topic") {
    return (
      <span className="scene-gen__style-rec scene-gen__style-rec--topic" title={title}>
        주제 추천
      </span>
    )
  }
  return (
    <span className="scene-gen__style-rec" title={title ?? "추천"}>
      추천
    </span>
  )
}

/** 스타일 카드 뱃지 — 주제 추천 > 카탈로그 추천 */
export function SceneStyleCardBadge(props: {
  item: { recommended?: boolean }
  topicRec?: boolean
  topicReason?: string
}) {
  const { item, topicRec, topicReason } = props
  if (topicRec) return <SceneStyleRecBadge variant="topic" title={topicReason} />
  if (item.recommended) return <SceneStyleRecBadge variant="catalog" />
  return null
}

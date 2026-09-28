import { useCallback, useMemo, useState } from "react"

export type SceneStyleCategory = string

export type TopicStyleRecUi = Pick<
  TopicStyleRecommendations,
  "loading" | "hasAny" | "summary" | "categorySet" | "scriptReady" | "isRecommended" | "reasonFor"
>

export type TopicStyleRecommendations = {
  items: Array<{ category: string; templateId: string; reason?: string }>
  summary: string | null
  loading: boolean
  hasAny: boolean
  scriptReady: boolean
  categorySet: Set<string>
  isRecommended: (category: SceneStyleCategory, templateId: string) => boolean
  reasonFor: (category: SceneStyleCategory, templateId: string) => string | undefined
}

/** 웹: 스타일 추천 API 미이식 — UI는 동작하되 추천 하이라이트만 비활성 */
export function useTopicStyleRecommendations(_opts: {
  scriptExcerpt: string
  titleHint?: string
  genre?: string
  enabled?: boolean
  minScriptLen?: number
}): TopicStyleRecommendations {
  const [items] = useState<TopicStyleRecommendations["items"]>([])
  const categorySet = useMemo(() => new Set<string>(), [])
  const isRecommended = useCallback(() => false, [])
  const reasonFor = useCallback(() => undefined, [])
  return {
    items,
    summary: null,
    loading: false,
    hasAny: false,
    scriptReady: false,
    categorySet,
    isRecommended,
    reasonFor,
  }
}

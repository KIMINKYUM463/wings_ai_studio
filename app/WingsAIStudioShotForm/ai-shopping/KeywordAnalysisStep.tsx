"use client"

import {
  ArrowRight,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { KeywordAnalysisSnapshot } from "@/lib/shotform-keyword-analysis-types"
import { Ver2StepShell } from "./Ver2StepShell"
import { NaverShoppingTrendPanel } from "./NaverShoppingTrendPanel"
import { CoupangShoppingRankPanel } from "./CoupangShoppingRankPanel"
import { WeeklyKeywordBestPanel } from "./WeeklyKeywordBestPanel"

type Props = {
  snapshot: KeywordAnalysisSnapshot | null
  onSnapshotChange: (snapshot: KeywordAnalysisSnapshot) => void
  onNext: () => void
}

const emptySnapshot = (query: string, mode: KeywordAnalysisSnapshot["coupangMode"]): KeywordAnalysisSnapshot => ({
  query,
  naverKeywords: [],
  coupangProducts: [],
  coupangMode: mode,
  collectedAt: new Date().toISOString(),
})

export function KeywordAnalysisStep({
  snapshot,
  onSnapshotChange,
  onNext,
}: Props) {
  const fetchCoupang = async (
    keyword: string,
    mode: KeywordAnalysisSnapshot["coupangMode"] = "search"
  ) => {
    try {
      const params = new URLSearchParams({ mode })
      if (keyword) params.set("query", keyword)
      const response = await fetch(`/api/shotform/keyword-analysis/coupang?${params.toString()}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "쿠팡 순위 조회 실패")
      return data.products || []
    } catch {
      return null
    }
  }

  const selectNaverKeyword = async (keyword: string) => {
    const products = await fetchCoupang(keyword, "search")
    onSnapshotChange({
      ...(snapshot || emptySnapshot(keyword, "search")),
      query: keyword,
      selectedKeyword: keyword,
      coupangMode: "search",
      coupangProducts: products ?? snapshot?.coupangProducts ?? [],
      collectedAt: new Date().toISOString(),
    })
  }

  return (
    <Ver2StepShell
      stepLabel="1단계"
      title="키워드 분석"
      description="네이버·쿠팡 쇼핑 흐름과 AI 주간 키워드 분석을 한 화면에서 확인합니다."
      icon={BarChart3}
      accent="sky"
      headerRight={
        <Button
          type="button"
          onClick={onNext}
          className="bg-sky-500 font-semibold text-white hover:bg-sky-400"
        >
          다음 · 제품 서칭
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      }
    >
      <WeeklyKeywordBestPanel onKeywordSelect={(keyword) => void selectNaverKeyword(keyword)} />
      <NaverShoppingTrendPanel onKeywordSelect={(keyword) => void selectNaverKeyword(keyword)} />
      <CoupangShoppingRankPanel />
    </Ver2StepShell>
  )
}

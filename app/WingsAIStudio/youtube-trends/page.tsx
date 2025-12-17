"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, TrendingUp, TrendingDown, Minus, Loader2, ArrowLeft, Settings, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

interface TrendData {
  keyword: string
  searchVolume: number
  trend: "up" | "down" | "stable"
  trendScore: number
  recentVideos: number
  avgViews: number
  competition: "low" | "medium" | "high"
  relatedKeywords: string[]
}

export default function YouTubeTrendsPage() {
  const [keyword, setKeyword] = useState("")
  const [loading, setLoading] = useState(false)
  const [trendData, setTrendData] = useState<TrendData | null>(null)
  const [error, setError] = useState("")
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [youtubeApiKey, setYoutubeApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)

  // localStorage에서 API 키 불러오기 (통일된 키 이름 사용)
  useEffect(() => {
    // 먼저 새로운 키 이름으로 확인
    let savedKey = localStorage.getItem("wings_youtube_data_api_key")
    
    // 기존 키 이름으로 저장된 값이 있으면 마이그레이션
    if (!savedKey) {
      const oldKey = localStorage.getItem("youtube_api_key")
      if (oldKey) {
        localStorage.setItem("wings_youtube_data_api_key", oldKey)
        savedKey = oldKey
      }
    }
    
    if (savedKey) {
      setYoutubeApiKey(savedKey)
    }
  }, [])

  const handleSaveApiKey = () => {
    if (youtubeApiKey.trim()) {
      localStorage.setItem("wings_youtube_data_api_key", youtubeApiKey.trim())
      alert("YouTube API 키가 저장되었습니다.")
      setShowApiKeyInput(false)
    }
  }

  const getApiKey = () => {
    if (typeof window === "undefined") return undefined
    return localStorage.getItem("wings_youtube_data_api_key") || undefined
  }

  const analyzeTrend = async () => {
    if (!keyword.trim()) {
      setError("키워드를 입력해주세요")
      return
    }

    const apiKey = getApiKey()
    if (!apiKey) {
      setError("YouTube Data API Key를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
      return
    }

    setLoading(true)
    setError("")
    setTrendData(null)

    try {
      const response = await fetch("/api/youtube-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim(), apiKey: apiKey }),
      })

      if (!response.ok) {
        throw new Error("분석에 실패했습니다")
      }

      const data = await response.json()
      setTrendData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다")
    } finally {
      setLoading(false)
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-5 h-5 text-green-500" />
      case "down":
        return <TrendingDown className="w-5 h-5 text-red-500" />
      default:
        return <Minus className="w-5 h-5 text-yellow-500" />
    }
  }

  const getCompetitionColor = (competition: string) => {
    switch (competition) {
      case "low":
        return "bg-green-500/20 text-green-700 dark:text-green-300"
      case "medium":
        return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"
      case "high":
        return "bg-red-500/20 text-red-700 dark:text-red-300"
      default:
        return "bg-gray-500/20 text-gray-700 dark:text-gray-300"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        <Link href="/WingsAIStudio">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            홈으로 돌아가기
          </Button>
        </Link>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">유튜브 실시간 분석</h1>
            <p className="text-xl text-muted-foreground">
              Google Trends 기반으로 YouTube 키워드 트렌드를 실시간으로 분석합니다
            </p>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>키워드 분석</CardTitle>
              <CardDescription>분석하고 싶은 YouTube 키워드를 입력하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  placeholder="예: 쇼츠 편집, 유튜브 마케팅"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && analyzeTrend()}
                  className="flex-1"
                />
                <Button onClick={analyzeTrend} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      분석하기
                    </>
                  )}
                </Button>
              </div>
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </CardContent>
          </Card>

          {trendData && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getTrendIcon(trendData.trend)}
                    {trendData.keyword} 트렌드 분석
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">트렌드 점수</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-primary h-full transition-all duration-500"
                            style={{ width: `${trendData.trendScore}%` }}
                          />
                        </div>
                        <span className="text-2xl font-bold">{trendData.trendScore}</span>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground mb-2">경쟁 강도</p>
                      <Badge className={getCompetitionColor(trendData.competition)}>
                        {trendData.competition === "low" && "낮음 - 진입 용이"}
                        {trendData.competition === "medium" && "보통 - 적당한 경쟁"}
                        {trendData.competition === "high" && "높음 - 치열한 경쟁"}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground mb-1">월간 검색량</p>
                        <p className="text-2xl font-bold">{trendData.searchVolume.toLocaleString()}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground mb-1">최근 업로드</p>
                        <p className="text-2xl font-bold">{trendData.recentVideos.toLocaleString()}개</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground mb-1">평균 조회수</p>
                        <p className="text-2xl font-bold">{trendData.avgViews.toLocaleString()}</p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>관련 키워드</CardTitle>
                  <CardDescription>함께 검색하면 좋은 키워드들입니다</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {trendData.relatedKeywords.map((kw, index) => (
                      <Badge key={index} variant="secondary" className="cursor-pointer hover:bg-primary/20">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle>분석 결과 요약</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="font-semibold text-lg">
                        {trendData.trendScore >= 70 && "🎯 매우 유망한 키워드입니다!"}
                        {trendData.trendScore >= 40 &&
                          trendData.trendScore < 70 &&
                          "⚡ 적절한 전략이 필요한 키워드입니다"}
                        {trendData.trendScore < 40 && "⚠️ 신중한 접근이 필요한 키워드입니다"}
                      </div>

                      {/* 검색량 분석 */}
                      <div className="pl-4 border-l-2 border-primary/30">
                        <p className="font-medium mb-1">📊 검색량 분석</p>
                        <p className="text-sm text-muted-foreground">
                          {trendData.searchVolume >= 100000 &&
                            `월간 ${(trendData.searchVolume / 10000).toFixed(1)}만 이상의 높은 검색량으로 많은 시청자가 관심을 가지고 있습니다. 높은 노출 기회가 예상됩니다.`}
                          {trendData.searchVolume >= 50000 &&
                            trendData.searchVolume < 100000 &&
                            `월간 ${(trendData.searchVolume / 10000).toFixed(1)}만의 적절한 검색량으로 안정적인 조회수를 기대할 수 있습니다.`}
                          {trendData.searchVolume < 50000 &&
                            `월간 ${trendData.searchVolume.toLocaleString()}의 검색량으로 니치 마켓에 적합합니다. 타겟 시청자에게 집중하세요.`}
                        </p>
                      </div>

                      {/* 경쟁 강도 분석 */}
                      <div className="pl-4 border-l-2 border-primary/30">
                        <p className="font-medium mb-1">🎮 경쟁 강도 분석</p>
                        <p className="text-sm text-muted-foreground">
                          {trendData.competition === "low" &&
                            `최근 30일간 ${trendData.recentVideos}개의 영상만 업로드되어 경쟁이 낮습니다. 신규 크리에이터에게 유리하며, 상위 노출 가능성이 높습니다. 지금이 진입하기 좋은 시기입니다.`}
                          {trendData.competition === "medium" &&
                            `최근 30일간 ${trendData.recentVideos}개의 영상이 업로드되어 적당한 경쟁 수준입니다. 차별화된 콘텐츠와 매력적인 썸네일로 승부하세요. 꾸준한 업로드가 중요합니다.`}
                          {trendData.competition === "high" &&
                            `최근 30일간 ${trendData.recentVideos}개 이상의 영상이 업로드되어 경쟁이 치열합니다. 독창적인 관점과 높은 퀄리티가 필수입니다. 롱테일 키워드 조합을 고려하세요.`}
                        </p>
                      </div>

                      {/* 트렌드 방향 분석 */}
                      <div className="pl-4 border-l-2 border-primary/30">
                        <p className="font-medium mb-1">📈 트렌드 방향</p>
                        <p className="text-sm text-muted-foreground">
                          {trendData.trend === "up" &&
                            "상승 트렌드로 관심이 증가하고 있습니다. 지금 콘텐츠를 제작하면 트렌드를 타고 빠른 성장이 가능합니다. 시리즈 콘텐츠로 확장하는 것을 추천합니다."}
                          {trendData.trend === "stable" &&
                            "안정적인 트렌드로 꾸준한 수요가 있습니다. 장기적인 콘텐츠 전략에 적합하며, 에버그린 콘텐츠로 제작하면 지속적인 조회수를 기대할 수 있습니다."}
                          {trendData.trend === "down" &&
                            "하락 트렌드로 관심이 감소하고 있습니다. 새로운 각도나 최신 정보를 추가하여 차별화하거나, 다른 키워드와 조합하는 전략이 필요합니다."}
                        </p>
                      </div>

                      {/* 예상 성과 */}
                      <div className="pl-4 border-l-2 border-primary/30">
                        <p className="font-medium mb-1">🎯 예상 성과</p>
                        <p className="text-sm text-muted-foreground">
                          평균 조회수 {trendData.avgViews.toLocaleString()}회를 기준으로,
                          {trendData.avgViews >= 100000 &&
                            " 10만 이상의 높은 조회수가 예상됩니다. 수익화 및 채널 성장에 큰 도움이 될 것입니다."}
                          {trendData.avgViews >= 10000 &&
                            trendData.avgViews < 100000 &&
                            " 1만~10만 사이의 조회수가 예상됩니다. 안정적인 성장을 기대할 수 있습니다."}
                          {trendData.avgViews < 10000 &&
                            " 1만 이하의 조회수가 예상됩니다. 니치 시청자 확보에 집중하세요."}
                        </p>
                      </div>

                      {/* 콘텐츠 제작 가이드 */}
                      <div className="pl-4 border-l-2 border-primary/30">
                        <p className="font-medium mb-1">💡 콘텐츠 제작 가이드</p>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                          <li>썸네일: 키워드를 명확히 표시하고 시선을 끄는 디자인 사용</li>
                          <li>제목: "{trendData.keyword}"를 포함하되 클릭을 유도하는 문구 추가</li>
                          <li>
                            영상 길이:{" "}
                            {trendData.avgViews >= 50000 ? "10분 이상의 심층 콘텐츠" : "5-8분의 간결한 콘텐츠"} 추천
                          </li>
                          <li>
                            업로드 시기:{" "}
                            {trendData.trend === "up" ? "즉시 업로드하여 트렌드 활용" : "주말 저녁 시간대 업로드 권장"}
                          </li>
                        </ul>
                      </div>

                      {/* 주의사항 */}
                      {(trendData.competition === "high" || trendData.trendScore < 40) && (
                        <div className="pl-4 border-l-2 border-red-500/30">
                          <p className="font-medium mb-1 text-red-600 dark:text-red-400">⚠️ 주의사항</p>
                          <p className="text-sm text-muted-foreground">
                            {trendData.competition === "high" && "높은 경쟁으로 인해 상위 노출이 어려울 수 있습니다. "}
                            {trendData.trendScore < 40 && "낮은 트렌드 점수로 기대 이하의 성과가 나올 수 있습니다. "}
                            관련 키워드를 조합하거나 더 구체적인 주제로 좁혀보세요.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

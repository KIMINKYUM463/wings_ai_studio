"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Sparkles, CheckCircle2, Circle, Info, Bookmark, Play, Brain, TrendingUp, BarChart3, Eye, Heart, MessageSquare, Home } from "lucide-react"
import { useRouter } from "next/navigation"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface VideoCategory {
  id: string
  title: string
}

interface TrendingVideo {
  id: string
  title: string
  thumbnail: string
  channelTitle: string
  publishedAt: string
  viewCount: number
  likeCount: number
  commentCount: number
  popularityScore: number
  duration: number
}

type Step = "input" | "analyzing" | "complete"

export default function TrendingAnalysisPage() {
  const router = useRouter()
  const [keyword, setKeyword] = useState("")
  const [categoryId, setCategoryId] = useState("all")
  const [duration, setDuration] = useState("all")
  const [minViews, setMinViews] = useState("all")
  const [maxResults, setMaxResults] = useState("50")
  const [sortBy, setSortBy] = useState<"popularity" | "views" | "date">("popularity")
  const [isLoading, setIsLoading] = useState(false)
  const [trendingVideos, setTrendingVideos] = useState<TrendingVideo[]>([])
  const [categories, setCategories] = useState<VideoCategory[]>([])
  const [currentStep, setCurrentStep] = useState<Step>("input")
  const [stats, setStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    analyzedCount: 0,
    targetCount: 50,
  })
  const [youtubeApiKey, setYoutubeApiKey] = useState("")

  // YouTube API Key 가져오기 (youmaker 설정에서 저장된 키 사용)
  useEffect(() => {
    const apiKey = localStorage.getItem("youmaker_youtube_api_key") || ""
    setYoutubeApiKey(apiKey)
  }, [])

  // 카테고리 목록 가져오기
  useEffect(() => {
    if (!youtubeApiKey) return

    const fetchCategories = async () => {
      try {
        const response = await fetch(`/api/youmaker/video-categories?apiKey=${encodeURIComponent(youtubeApiKey)}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setCategories(data.categories || [])
          }
        }
      } catch (error) {
        console.error("카테고리 로드 실패:", error)
      }
    }

    fetchCategories()
  }, [youtubeApiKey])

  // 떡상 영상 분석
  const handleTrendingAnalysis = async () => {
    if (!keyword.trim()) {
      alert("키워드를 입력해주세요.")
      return
    }

    if (!youtubeApiKey) {
      alert("YouTube Data API Key를 설정해주세요.")
      router.push("/youmaker")
      return
    }

    setIsLoading(true)
    setCurrentStep("analyzing")

    try {
      const response = await fetch("/api/youmaker/search-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          categoryId: categoryId === "all" ? undefined : categoryId,
          duration: duration === "all" ? undefined : duration,
          minViews: minViews === "all" ? undefined : minViews,
          maxResults: parseInt(maxResults),
          apiKey: youtubeApiKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "영상 검색에 실패했습니다.")
      }

      const data = await response.json()

      if (data.success) {
        // API에서 이미 인기 점수로 정렬되어 있으므로 그대로 사용
        setTrendingVideos(data.videos || [])
        setStats({
          totalViews: data.totalViews || 0,
          totalLikes: data.totalLikes || 0,
          totalComments: data.totalComments || 0,
          analyzedCount: data.analyzedCount || 0,
          targetCount: data.targetCount || 50,
        })
        setCurrentStep("complete")
      } else {
        throw new Error(data.error || "영상 검색에 실패했습니다.")
      }
    } catch (error) {
      console.error("영상 분석 실패:", error)
      alert(error instanceof Error ? error.message : "영상 분석에 실패했습니다.")
      setCurrentStep("input")
    } finally {
      setIsLoading(false)
    }
  }

  // 영상 선택 시 댓글 분석으로 이동
  const handleVideoSelect = (video: TrendingVideo) => {
    router.push(`/youmaker/comment-analysis?videoId=${video.id}&title=${encodeURIComponent(video.title)}`)
  }

  // 정렬된 영상 목록
  const sortedVideos = [...trendingVideos].sort((a, b) => {
    if (sortBy === "popularity") {
      return b.popularityScore - a.popularityScore
    } else if (sortBy === "views") {
      return b.viewCount - a.viewCount
    } else if (sortBy === "date") {
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    }
    return 0
  })

  // 인기 점수 분포 차트 데이터 생성
  const chartData = sortedVideos.slice(0, 50).map((video, index) => ({
    index: index + 1,
    score: Math.round(video.popularityScore),
  }))

  // 숫자 포맷팅
  const formatNumber = (num: number): string => {
    if (num >= 100000000) {
      return `${(num / 100000000).toFixed(1)}억`
    } else if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}만`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}천`
    }
    return num.toLocaleString()
  }

  // 영상 길이 포맷팅
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`
    }
    return `${secs}초`
  }

  const steps = [
    { id: "input", label: "키워드 입력", description: "분석할 키워드를 입력하세요" },
    { id: "analyzing", label: "영상 분석 중", description: "1개월간 조회수 높은 영상 수집 중..." },
    { id: "complete", label: "분석 완료", description: `${maxResults}개의 인기 영상을 찾았습니다` },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push("/youmaker")}
            className="mb-4"
          >
            ← 메인으로
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/youmaker")}
            className="mb-4 bg-gradient-to-r from-orange-50 to-red-50 border-orange-300 text-orange-700 hover:from-orange-100 hover:to-red-100"
          >
            <Home className="w-4 h-4 mr-2" />
            홈으로
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 좌측 진행 과정 */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 sticky top-24">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  진행 과정
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {steps.map((step, index) => {
                    const isActive = step.id === currentStep
                    const isCompleted = steps.findIndex(s => s.id === currentStep) > index

                    return (
                      <div key={step.id} className="relative">
                        {/* 연결선 */}
                        {index < steps.length - 1 && (
                          <div className="absolute left-6 top-12 w-0.5 h-14 bg-slate-200">
                            <div
                              className={`h-full transition-all duration-500 ${
                                isCompleted ? "bg-gradient-to-b from-orange-500 to-red-500" : "bg-slate-200"
                              }`}
                              style={{
                                height: isCompleted ? "100%" : "0%",
                              }}
                            />
                          </div>
                        )}

                        <div className="flex items-start gap-4">
                          {/* 아이콘 */}
                          <div className="relative z-10">
                            {isCompleted ? (
                              <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-full blur-lg opacity-50 animate-pulse"></div>
                                <div className="relative w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-xl">
                                  <CheckCircle2 className="w-6 h-6 text-white" />
                                </div>
                              </div>
                            ) : isActive ? (
                              <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-full blur-lg opacity-50 animate-pulse"></div>
                                <div className="relative w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-xl">
                                  <Sparkles className="w-6 h-6 text-white animate-spin" style={{ animationDuration: '1s' }} />
                                </div>
                                <div className="absolute -top-1 -right-1">
                                  <div className="w-4 h-4 bg-orange-400 rounded-full animate-ping"></div>
                                </div>
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center border-2 border-slate-300">
                                <Circle className="w-6 h-6 text-slate-400" />
                              </div>
                            )}
                          </div>

                          {/* 텍스트 */}
                          <div className="flex-1 pt-1.5">
                            <h3
                              className={`font-bold text-sm mb-1 transition-colors ${
                                isActive || isCompleted
                                  ? "text-orange-600"
                                  : "text-slate-400"
                              }`}
                            >
                              {step.label}
                            </h3>
                            <p className="text-xs text-slate-500 leading-relaxed">{step.description}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 우측 메인 컨텐츠 */}
          <div className="lg:col-span-3">
            <div className="space-y-6">
              {/* 검색 필터 카드 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-orange-500" />
                    떡상 영상 분석
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {/* 필터 입력 영역 */}
                  <div className="flex flex-nowrap gap-2 items-end">
                    <div className="flex-1 min-w-[180px]">
                      <Input
                        placeholder="분석할 키워드를 입력하세요"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleTrendingAnalysis()}
                        className="h-12 text-base bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                        disabled={isLoading}
                      />
                    </div>
                    <Select value={categoryId} onValueChange={setCategoryId} disabled={isLoading}>
                      <SelectTrigger className="h-12 w-[160px] bg-white border-slate-300 text-slate-900">
                        <SelectValue placeholder="모든 카테고리" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-slate-900 border-slate-300">
                        <SelectItem value="all">모든 카테고리</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={duration} onValueChange={setDuration} disabled={isLoading}>
                      <SelectTrigger className="h-12 w-[150px] bg-white border-slate-300 text-slate-900">
                        <SelectValue placeholder="전체 길이" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-slate-900 border-slate-300">
                        <SelectItem value="all">전체 길이</SelectItem>
                        <SelectItem value="short">4분 이하 (숏폼)</SelectItem>
                        <SelectItem value="medium">4분~20분</SelectItem>
                        <SelectItem value="long">20분 이상</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={minViews} onValueChange={setMinViews} disabled={isLoading}>
                      <SelectTrigger className="h-12 w-[150px] bg-white border-slate-300 text-slate-900">
                        <SelectValue placeholder="전체 조회수" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-slate-900 border-slate-300">
                        <SelectItem value="all">전체 조회수</SelectItem>
                        <SelectItem value="10000">1만회 이상</SelectItem>
                        <SelectItem value="50000">5만회 이상</SelectItem>
                        <SelectItem value="100000">10만회 이상</SelectItem>
                        <SelectItem value="500000">50만회 이상</SelectItem>
                        <SelectItem value="1000000">100만회 이상</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={maxResults} onValueChange={setMaxResults} disabled={isLoading}>
                      <SelectTrigger className="h-12 w-[100px] bg-white border-slate-300 text-slate-900">
                        <SelectValue placeholder="50개" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-slate-900 border-slate-300">
                        <SelectItem value="50">50개</SelectItem>
                        <SelectItem value="100">100개</SelectItem>
                        <SelectItem value="200">200개</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleTrendingAnalysis}
                      disabled={isLoading || !keyword.trim()}
                      className="h-12 px-6 bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 hover:from-orange-600 hover:via-red-500 hover:to-red-600 text-white flex-shrink-0 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 font-semibold"
                      size="lg"
                    >
                      <Search className="w-5 h-5 mr-2" />
                      분석 시작
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Info className="w-4 h-4 text-slate-500" />
                    <span>① 더 많은 영상을 분석하면 API 할당량 소모가 증가하고 분석 시간이 길어질 수 있습니다.</span>
                  </div>
                </CardContent>
              </Card>

              {isLoading && (
                <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 overflow-hidden">
                  <CardContent className="py-16 text-center relative">
                    {/* AI 분석 애니메이션 배경 */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-orange-400/20 rounded-full blur-3xl animate-pulse"></div>
                      <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-red-400/20 rounded-full blur-3xl animate-pulse delay-300"></div>
                      <div className="absolute bottom-1/4 left-1/2 w-36 h-36 bg-pink-400/20 rounded-full blur-3xl animate-pulse delay-700"></div>
                    </div>
                    
                    {/* AI 아이콘 애니메이션 */}
                    <div className="relative z-10">
                      <div className="relative inline-block mb-6">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                        <div className="relative bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 p-6 rounded-full shadow-2xl">
                          <Brain className="w-12 h-12 text-white animate-pulse" />
                        </div>
                        <div className="absolute -top-2 -right-2">
                          <Sparkles className="w-6 h-6 text-yellow-400 animate-spin" style={{ animationDuration: '2s' }} />
                        </div>
                        <div className="absolute -bottom-2 -left-2">
                          <TrendingUp className="w-5 h-5 text-orange-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                        </div>
                      </div>
                      
                      <h3 className="text-2xl font-bold text-slate-800 mb-2">AI가 영상을 분석하고 있습니다</h3>
                      <p className="text-slate-600 mb-6">1개월간 조회수 높은 영상을 수집 중...</p>
                      
                      {/* 진행 바 */}
                      <div className="w-full max-w-md mx-auto bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-full animate-progress-bar"></div>
                      </div>
                      
                      {/* 로딩 도트 애니메이션 */}
                      <div className="flex justify-center gap-2 mt-6">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {trendingVideos.length > 0 && (
                <>
                  {/* 통계 카드 */}
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                      <div className="mb-2">
                        <div className="text-base font-semibold text-slate-800 mb-1 flex items-center gap-2">
                          <Search className="w-4 h-4 text-orange-500" />
                          키워드: <span className="text-orange-600">"{keyword}"</span>
                        </div>
                        <div className="text-sm text-slate-600">
                          검색 결과 분석 (상위 {stats.analyzedCount}개 영상 / 목표 {stats.targetCount}개)
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-6 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 hover:shadow-lg transition-all">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 mb-3 shadow-lg">
                            <Eye className="w-6 h-6 text-white" />
                          </div>
                          <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-2">
                            {formatNumber(stats.totalViews)}
                          </div>
                          <div className="text-sm font-semibold text-slate-700">총 조회수</div>
                        </div>
                        <div className="text-center p-6 rounded-xl bg-gradient-to-br from-red-50 to-red-100 border border-red-200 hover:shadow-lg transition-all">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 mb-3 shadow-lg">
                            <Heart className="w-6 h-6 text-white" />
                          </div>
                          <div className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent mb-2">
                            {formatNumber(stats.totalLikes)}
                          </div>
                          <div className="text-sm font-semibold text-slate-700">총 좋아요</div>
                        </div>
                        <div className="text-center p-6 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 hover:shadow-lg transition-all">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 mb-3 shadow-lg">
                            <MessageSquare className="w-6 h-6 text-white" />
                          </div>
                          <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent mb-2">
                            {formatNumber(stats.totalComments)}
                          </div>
                          <div className="text-sm font-semibold text-slate-700">총 댓글</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 인기 점수 분포 차트 */}
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                      <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-orange-500" />
                        "{keyword}" 검색 결과 인기 점수 분포 (상위 {Math.min(50, trendingVideos.length)}개)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis
                            dataKey="index"
                            stroke="#6B7280"
                            label={{ value: "순위", position: "insideBottom", offset: -5, fill: "#6B7280" }}
                          />
                          <YAxis
                            stroke="#6B7280"
                            label={{ value: "인기 점수", angle: -90, position: "insideLeft", fill: "#6B7280" }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #E5E7EB",
                              color: "#1F2937",
                              borderRadius: "8px",
                            }}
                            formatter={(value: number) => [`${value}점`, "인기 점수"]}
                          />
                          <defs>
                            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#F97316" stopOpacity={1} />
                              <stop offset="100%" stopColor="#EF4444" stopOpacity={0.8} />
                            </linearGradient>
                          </defs>
                          <Bar dataKey="score" fill="url(#colorGradient)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* 영상 목록 */}
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                          <Play className="w-6 h-6 text-orange-500" />
                          검색 결과
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-600">정렬:</span>
                          <Select value={sortBy} onValueChange={(value: "popularity" | "views" | "date") => setSortBy(value)}>
                            <SelectTrigger className="h-10 w-[140px] bg-white border-slate-300 text-slate-900 font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white text-slate-900 border-slate-300">
                              <SelectItem value="popularity">인기순</SelectItem>
                              <SelectItem value="views">조회수순</SelectItem>
                              <SelectItem value="date">최신순</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sortedVideos.map((video, index) => (
                          <Card
                            key={video.id}
                            className="cursor-pointer hover:shadow-2xl transition-all border-slate-200 bg-white hover:bg-gradient-to-br hover:from-orange-50 hover:to-red-50 hover:scale-[1.02] hover:border-orange-300 group"
                            onClick={() => handleVideoSelect(video)}
                          >
                            <CardContent className="p-5">
                              <div className="flex gap-4">
                                <div className="relative flex-shrink-0 group-hover:scale-105 transition-transform">
                                  <img
                                    src={video.thumbnail}
                                    alt={video.title}
                                    className="w-36 h-24 object-cover rounded-lg shadow-lg"
                                  />
                                  <div className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-lg">
                                    #{index + 1}
                                  </div>
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-bold text-sm text-slate-900 line-clamp-2 flex-1 group-hover:text-orange-600 transition-colors">
                                      {video.title}
                                    </h3>
                                    <Bookmark className="w-4 h-4 text-slate-400 ml-2 flex-shrink-0 group-hover:text-orange-500 transition-colors" />
                                  </div>
                                  <p className="text-xs text-slate-600 mb-2 truncate font-medium">{video.channelTitle}</p>
                                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                                    <span>{new Date(video.publishedAt).toLocaleDateString("ko-KR")}</span>
                                    <span>•</span>
                                    <span>{formatDuration(video.duration)}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-slate-600 mb-3">
                                    <span className="flex items-center gap-1">
                                      <Eye className="w-3 h-3" />
                                      {formatNumber(video.viewCount)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Heart className="w-3 h-3" />
                                      {formatNumber(video.likeCount)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <MessageSquare className="w-3 h-3" />
                                      {formatNumber(video.commentCount)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xs font-semibold text-slate-700">인기 점수</span>
                                    <Progress
                                      value={Math.min(100, video.popularityScore)}
                                      className="flex-1 h-2.5"
                                    />
                                    <span className="text-xs font-bold text-orange-600">
                                      {video.popularityScore.toFixed(1)}
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="w-full bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 hover:from-orange-600 hover:via-red-500 hover:to-red-600 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank')
                                    }}
                                  >
                                    <Play className="w-4 h-4 mr-1.5" />
                                    영상보기
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

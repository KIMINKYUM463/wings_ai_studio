"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BarChart3, Loader2, Home, Sparkles, Brain, TrendingUp, FileText, CheckCircle2, AlertCircle, Target, Zap, Eye, Heart, MessageSquare, Clock, Bookmark, Square, User } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface AnalyzedVideo {
  title: string
  viewCount: number
  likeCount: number
  commentCount: number
  publishedAt: string
  popularityScore: number
  videoId: string
  thumbnailUrl: string
  description: string
}

interface StrategyAnalysis {
  coreConcept: {
    title: string
    description: string
  }
  detailedPlan: {
    contentDirection: string
    uploadSchedule: string
    keywordStrategy: string
  }
  revenueModel: string
}

interface GrowthAnalysis {
  overallSummary: string
  phases: Array<{
    phaseTitle: string
    period: string
    strategyAnalysis: string
  }>
}

interface ConsultingAnalysis {
  overallDiagnosis: string
  detailedAnalysis: Array<{
    area: string
    problem: string
    solution: string
  }>
  actionPlan: {
    shortTerm: string[]
    longTerm: string[]
  }
}

interface ChannelAnalysisResult {
  channelInfo: {
    title: string
    subscriberCount: string
    videoCount: string
    viewCount: string
    thumbnailUrl: string
    publishedAt: string
    description: string
  }
  videos: AnalyzedVideo[]
  metadata: {
    channelCreationDate: string
    firstUploadDate: string
    averageUploadCycle: string
    recentUploadCycle: string
  }
  strategy: StrategyAnalysis
  growth: GrowthAnalysis
  consulting: ConsultingAnalysis
}

export default function ChannelAnalysisPage() {
  const router = useRouter()
  const [channelId, setChannelId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<ChannelAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 채널 분석 실행
  const handleAnalyze = async () => {
    if (!channelId.trim()) {
      setError("채널 ID, URL 또는 채널명을 입력해주세요.")
      return
    }

    setIsLoading(true)
    setError(null)
    setAnalysisResult(null)

    try {
      // 로컬 스토리지에서 API 키 가져오기
      const youtubeApiKey = localStorage.getItem("youmaker_youtube_api_key") || ""
      const geminiApiKey = localStorage.getItem("youmaker_gemini_api_key") || ""

      if (!youtubeApiKey) {
        throw new Error("YouTube API Key를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
      }

      if (!geminiApiKey) {
        throw new Error("Gemini API Key를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
      }

      // API 호출 (채널 ID, URL 또는 채널명 모두 전달)
      const response = await fetch("/api/youmaker/analyze-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channelId.trim(), // 원본 입력값 그대로 전달 (API에서 처리)
          youtubeApiKey,
          geminiApiKey,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "채널 분석에 실패했습니다.")
      }

      if (data.success) {
        setAnalysisResult(data.result)
      } else {
        throw new Error(data.error || "채널 분석에 실패했습니다.")
      }
    } catch (error) {
      console.error("채널 분석 실패:", error)
      setError(error instanceof Error ? error.message : "채널 분석에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

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

        <div className="space-y-6">
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
            <CardHeader>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-blue-500" />
                채널 분석
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2 font-medium">
                YouTube 채널의 데이터를 수집하고 AI가 전략, 성장, 진단을 종합적으로 분석합니다
              </p>
            </CardHeader>
          </Card>

          {!analysisResult ? (
            <>
              {/* 채널 입력 섹션 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Target className="w-6 h-6 text-blue-500" />
                    채널 정보 입력
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <div>
                      <Label htmlFor="channel-id" className="text-base font-bold text-slate-800 mb-2 block">
                        채널 ID, URL 또는 채널명
                      </Label>
                      <p className="text-sm text-slate-600 mb-4">
                        YouTube 채널 ID (UC로 시작), 채널 URL, 또는 채널명을 입력하세요.
                        <br />
                        예: UC..., https://youtube.com/channel/UC..., 또는 채널명 (예: "PewDiePie")
                      </p>
                      <Input
                        id="channel-id"
                        type="text"
                        placeholder="UC... 또는 https://youtube.com/channel/UC..."
                        value={channelId}
                        onChange={(e) => setChannelId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isLoading) {
                            handleAnalyze()
                          }
                        }}
                        className="text-base"
                      />
                    </div>
                    {error && (
                      <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                        <div className="flex items-center gap-2 text-red-700">
                          <AlertCircle className="w-5 h-5" />
                          <span className="font-medium">{error}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button
                        onClick={handleAnalyze}
                        disabled={isLoading || !channelId.trim()}
                        size="lg"
                        className="bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 hover:from-blue-600 hover:via-cyan-600 hover:to-blue-700 text-white font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 px-8 py-6"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            분석 중...
                          </>
                        ) : (
                          <>
                            <Brain className="w-5 h-5 mr-2" />
                            채널 분석 시작
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {isLoading && (
                <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 overflow-hidden">
                  <CardContent className="py-16 text-center relative">
                    {/* AI 분석 애니메이션 배경 */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
                      <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-cyan-400/20 rounded-full blur-3xl animate-pulse delay-300"></div>
                      <div className="absolute bottom-1/4 left-1/2 w-36 h-36 bg-indigo-400/20 rounded-full blur-3xl animate-pulse delay-700"></div>
                    </div>
                    
                    {/* AI 아이콘 애니메이션 */}
                    <div className="relative z-10">
                      <div className="relative inline-block mb-6">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                        <div className="relative bg-gradient-to-br from-blue-500 via-cyan-500 to-indigo-500 p-6 rounded-full shadow-2xl">
                          <Brain className="w-12 h-12 text-white animate-pulse" />
                        </div>
                        <div className="absolute -top-2 -right-2">
                          <Sparkles className="w-6 h-6 text-yellow-400 animate-spin" style={{ animationDuration: '2s' }} />
                        </div>
                        <div className="absolute -bottom-2 -left-2">
                          <BarChart3 className="w-5 h-5 text-blue-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                        </div>
                      </div>
                      
                      <h3 className="text-2xl font-bold text-slate-800 mb-2">AI가 채널을 분석하고 있습니다</h3>
                      <p className="text-slate-600 mb-6">데이터 수집 및 전략/성장/진단 분석 중...</p>
                      
                      {/* 진행 바 */}
                      <div className="w-full max-w-md mx-auto bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500 rounded-full animate-progress-bar"></div>
                      </div>
                      
                      {/* 로딩 도트 애니메이션 */}
                      <div className="flex justify-center gap-2 mt-6">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              {/* 채널 정보 헤더 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-800 to-slate-900">
                <CardContent className="p-6">
                  <div className="flex items-start gap-6">
                    {/* 왼쪽: 프로필 이미지 및 채널명 */}
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        {analysisResult.channelInfo.thumbnailUrl ? (
                          <img
                            src={analysisResult.channelInfo.thumbnailUrl}
                            alt={analysisResult.channelInfo.title}
                            className="w-20 h-20 rounded-full object-cover border-4 border-slate-700"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center border-4 border-slate-700">
                            <span className="text-white font-bold text-lg">
                              {analysisResult.channelInfo.title.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-1">{analysisResult.channelInfo.title}</h2>
                        <p className="text-slate-400 text-sm mb-3">채널 분석 결과</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                        >
                          <Bookmark className="w-4 h-4 mr-2" />
                          즐겨찾기
                        </Button>
                      </div>
                    </div>

                    {/* 중앙: 주요 지표 */}
                    <div className="flex-1 flex items-center gap-6">
                      <div>
                        <p className="text-slate-400 text-sm mb-1">구독자 수</p>
                        <p className="text-2xl font-bold text-red-500">
                          {parseInt(analysisResult.channelInfo.subscriberCount) >= 10000
                            ? `${(parseInt(analysisResult.channelInfo.subscriberCount) / 10000).toFixed(0)}만`
                            : parseInt(analysisResult.channelInfo.subscriberCount).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm mb-1">총 조회수</p>
                        <p className="text-2xl font-bold text-white">
                          {parseInt(analysisResult.channelInfo.viewCount) >= 10000
                            ? `${(parseInt(analysisResult.channelInfo.viewCount) / 10000).toFixed(0)}만`
                            : parseInt(analysisResult.channelInfo.viewCount).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm mb-1">총 영상 수</p>
                        <p className="text-2xl font-bold text-white">{parseInt(analysisResult.channelInfo.videoCount).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* 오른쪽: 채널 메타데이터 */}
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 min-w-[280px]">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">채널 개설일</span>
                          <span className="text-white font-medium">{analysisResult.metadata.channelCreationDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">최초 업로드</span>
                          <span className="text-white font-medium">{analysisResult.metadata.firstUploadDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">평균 업로드 주기</span>
                          <span className="text-white font-medium">{analysisResult.metadata.averageUploadCycle}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">최근 업로드 주기</span>
                          <span className="text-white font-medium">{analysisResult.metadata.recentUploadCycle}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 메인 분석 탭 */}
              <Tabs defaultValue="strategy" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-lg">
                  <TabsTrigger value="strategy" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md">
                    <Square className="w-4 h-4 mr-2" />
                    경쟁 전략 분석
                  </TabsTrigger>
                  <TabsTrigger value="growth" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    성장 과정 분석
                  </TabsTrigger>
                  <TabsTrigger value="consulting" className="data-[state=active]:bg-green-500 data-[state=active]:text-white data-[state=active]:shadow-md">
                    <User className="w-4 h-4 mr-2" />
                    AI 채널 컨설팅
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* 하위 탭 (인기 점수, 조회수, 좋아요, 댓글, 타임라인, 콘텐츠 포맷) */}
              <Tabs defaultValue="popularity" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-6 bg-slate-100 p-1 rounded-lg">
                    <TabsTrigger value="popularity" className="data-[state=active]:bg-red-500 data-[state=active]:text-white data-[state=active]:shadow-md text-xs">
                      <BarChart3 className="w-3 h-3 mr-1" />
                      인기 점수
                    </TabsTrigger>
                    <TabsTrigger value="views" className="data-[state=active]:bg-white data-[state=active]:shadow-md text-xs">
                      <Eye className="w-3 h-3 mr-1" />
                      조회수
                    </TabsTrigger>
                    <TabsTrigger value="likes" className="data-[state=active]:bg-white data-[state=active]:shadow-md text-xs">
                      <Heart className="w-3 h-3 mr-1" />
                      좋아요
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="data-[state=active]:bg-white data-[state=active]:shadow-md text-xs">
                      <MessageSquare className="w-3 h-3 mr-1" />
                      댓글
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="data-[state=active]:bg-white data-[state=active]:shadow-md text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      타임라인
                    </TabsTrigger>
                    <TabsTrigger value="format" className="data-[state=active]:bg-white data-[state=active]:shadow-md text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      콘텐츠 포맷
                    </TabsTrigger>
                  </TabsList>

                  {/* 인기 점수 분포 차트 */}
                  <TabsContent value="popularity" className="space-y-6">
                    <Card className="border-0 shadow-xl bg-white">
                      <CardHeader>
                        <CardTitle className="text-xl font-bold text-slate-800">인기 점수 분포 (상위 20개)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={analysisResult.videos.slice(0, 20).map((v, i) => ({
                            name: v.title.length > 20 ? v.title.substring(0, 20) + "..." : v.title,
                            score: v.popularityScore,
                            fullTitle: v.title,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis
                              dataKey="name"
                              angle={-45}
                              textAnchor="end"
                              height={120}
                              tick={{ fontSize: 10 }}
                              interval={0}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                                      <p className="font-semibold text-slate-900 mb-1">{payload[0].payload.fullTitle}</p>
                                      <p className="text-red-600 font-bold">인기 점수: {payload[0].value}</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Bar dataKey="score" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* 조회수 차트 */}
                  <TabsContent value="views" className="space-y-6">
                    <Card className="border-0 shadow-xl bg-white">
                      <CardHeader>
                        <CardTitle className="text-xl font-bold text-slate-800">조회수 분포 (상위 20개)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={analysisResult.videos.slice(0, 20).map((v, i) => ({
                            name: v.title.length > 20 ? v.title.substring(0, 20) + "..." : v.title,
                            views: v.viewCount,
                            fullTitle: v.title,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis
                              dataKey="name"
                              angle={-45}
                              textAnchor="end"
                              height={120}
                              tick={{ fontSize: 10 }}
                              interval={0}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                                      <p className="font-semibold text-slate-900 mb-1">{payload[0].payload.fullTitle}</p>
                                      <p className="text-blue-600 font-bold">조회수: {payload[0].value?.toLocaleString()}</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Bar dataKey="views" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* 좋아요 차트 */}
                  <TabsContent value="likes" className="space-y-6">
                    <Card className="border-0 shadow-xl bg-white">
                      <CardHeader>
                        <CardTitle className="text-xl font-bold text-slate-800">좋아요 분포 (상위 20개)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={analysisResult.videos.slice(0, 20).map((v, i) => ({
                            name: v.title.length > 20 ? v.title.substring(0, 20) + "..." : v.title,
                            likes: v.likeCount,
                            fullTitle: v.title,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis
                              dataKey="name"
                              angle={-45}
                              textAnchor="end"
                              height={120}
                              tick={{ fontSize: 10 }}
                              interval={0}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                                      <p className="font-semibold text-slate-900 mb-1">{payload[0].payload.fullTitle}</p>
                                      <p className="text-pink-600 font-bold">좋아요: {payload[0].value?.toLocaleString()}</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Bar dataKey="likes" fill="#ec4899" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* 댓글 차트 */}
                  <TabsContent value="comments" className="space-y-6">
                    <Card className="border-0 shadow-xl bg-white">
                      <CardHeader>
                        <CardTitle className="text-xl font-bold text-slate-800">댓글 수 분포 (상위 20개)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={analysisResult.videos.slice(0, 20).map((v, i) => ({
                            name: v.title.length > 20 ? v.title.substring(0, 20) + "..." : v.title,
                            comments: v.commentCount,
                            fullTitle: v.title,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis
                              dataKey="name"
                              angle={-45}
                              textAnchor="end"
                              height={120}
                              tick={{ fontSize: 10 }}
                              interval={0}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                                      <p className="font-semibold text-slate-900 mb-1">{payload[0].payload.fullTitle}</p>
                                      <p className="text-cyan-600 font-bold">댓글: {payload[0].value?.toLocaleString()}</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Bar dataKey="comments" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* 타임라인 */}
                  <TabsContent value="timeline" className="space-y-6">
                    <Card className="border-0 shadow-xl bg-white">
                      <CardHeader>
                        <CardTitle className="text-xl font-bold text-slate-800">영상 업로드 타임라인</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {analysisResult.videos.slice(0, 20).map((video, index) => (
                            <div key={index} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shrink-0">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-slate-900 mb-1">{video.title}</p>
                                <p className="text-sm text-slate-500">
                                  {new Date(video.publishedAt).toLocaleDateString("ko-KR")} • 조회수: {video.viewCount.toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-red-600">인기 점수: {video.popularityScore.toFixed(1)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* 콘텐츠 포맷 */}
                  <TabsContent value="format" className="space-y-6">
                    <Card className="border-0 shadow-xl bg-white">
                      <CardHeader>
                        <CardTitle className="text-xl font-bold text-slate-800">콘텐츠 포맷 분석</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-slate-600">콘텐츠 포맷 분석 기능은 곧 제공될 예정입니다.</p>
                      </CardContent>
                    </Card>
                  </TabsContent>
              </Tabs>

              {/* 메인 분석 탭 내용 */}
              <Tabs defaultValue="strategy" className="space-y-6">
                {/* 경쟁 전략 분석 */}
                <TabsContent value="strategy" className="space-y-6">
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b">
                      <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Target className="w-6 h-6 text-orange-500" />
                        초격차 경쟁 전략
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <div className="p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border-2 border-orange-200">
                        <h3 className="text-xl font-bold text-orange-900 mb-3">{analysisResult.strategy.coreConcept.title}</h3>
                        <p className="text-slate-900 leading-relaxed">{analysisResult.strategy.coreConcept.description}</p>
                      </div>

                      <div className="space-y-4">
                        <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
                          <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                            <Zap className="w-5 h-5" />
                            콘텐츠 방향성
                          </h4>
                          <p className="text-slate-800">{analysisResult.strategy.detailedPlan.contentDirection}</p>
                        </div>

                        <div className="p-5 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl border-2 border-cyan-200">
                          <h4 className="font-bold text-cyan-900 mb-2 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5" />
                            추천 업로드 스케줄
                          </h4>
                          <p className="text-slate-800">{analysisResult.strategy.detailedPlan.uploadSchedule}</p>
                        </div>

                        <div className="p-5 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border-2 border-indigo-200">
                          <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                            <Sparkles className="w-5 h-5" />
                            키워드 전략
                          </h4>
                          <p className="text-slate-800">{analysisResult.strategy.detailedPlan.keywordStrategy}</p>
                        </div>
                      </div>

                      <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                        <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5" />
                          수익화 제안
                        </h4>
                        <p className="text-slate-900 leading-relaxed">{analysisResult.strategy.revenueModel}</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* 성장 과정 분석 */}
                <TabsContent value="growth" className="space-y-6 mt-6">
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
                      <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-purple-500" />
                        성장 과정 분석
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                        <h3 className="text-xl font-bold text-purple-900 mb-3">채널 성장사 총평</h3>
                        <p className="text-slate-900 leading-relaxed">{analysisResult.growth.overallSummary}</p>
                      </div>

                      <div className="space-y-4">
                        {analysisResult.growth.phases.map((phase, index) => (
                          <Card key={index} className="border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50">
                            <CardHeader>
                              <CardTitle className="text-lg font-bold text-purple-900 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center text-sm font-bold">
                                  {index + 1}
                                </span>
                                {phase.phaseTitle}
                              </CardTitle>
                              <p className="text-sm text-purple-700 font-medium">{phase.period}</p>
                            </CardHeader>
                            <CardContent>
                              <p className="text-slate-800 leading-relaxed">{phase.strategyAnalysis}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* 채널 진단 */}
                <TabsContent value="consulting" className="space-y-6 mt-6">
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b">
                      <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-teal-500" />
                        채널 주치의 진단
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <div className="p-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border-2 border-teal-200">
                        <h3 className="text-xl font-bold text-teal-900 mb-3">종합 진단 결과</h3>
                        <p className="text-slate-900 leading-relaxed">{analysisResult.consulting.overallDiagnosis}</p>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          <Brain className="w-5 h-5 text-teal-500" />
                          상세 분석
                        </h4>
                        {analysisResult.consulting.detailedAnalysis.map((item, index) => (
                          <Card key={index} className="border-2 border-teal-200 bg-gradient-to-br from-white to-teal-50">
                            <CardHeader>
                              <CardTitle className="text-base font-bold text-teal-900">{item.area}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div>
                                <p className="text-sm font-semibold text-red-700 mb-1">문제점:</p>
                                <p className="text-slate-800">{item.problem}</p>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-green-700 mb-1">해결책:</p>
                                <p className="text-slate-800">{item.solution}</p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
                          <CardHeader>
                            <CardTitle className="text-lg font-bold text-orange-900 flex items-center gap-2">
                              <Zap className="w-5 h-5" />
                              단기 액션 플랜
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {analysisResult.consulting.actionPlan.shortTerm.map((action, index) => (
                                <li key={index} className="flex items-start gap-2 text-slate-800">
                                  <CheckCircle2 className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                                  <span>{action}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>

                        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader>
                            <CardTitle className="text-lg font-bold text-blue-900 flex items-center gap-2">
                              <TrendingUp className="w-5 h-5" />
                              장기 액션 플랜
                            </CardTitle>
          </CardHeader>
          <CardContent>
                            <ul className="space-y-2">
                              {analysisResult.consulting.actionPlan.longTerm.map((action, index) => (
                                <li key={index} className="flex items-start gap-2 text-slate-800">
                                  <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                                  <span>{action}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      </div>
          </CardContent>
        </Card>
                </TabsContent>
              </Tabs>

              {/* 최근 영상 목록 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-slate-500" />
                    최근 업로드 영상
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analysisResult.videos.slice(0, 12).map((video, index) => (
                      <Card
                        key={video.videoId || index}
                        className="border-2 border-slate-200 bg-white hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer group"
                        onClick={() => {
                          if (video.videoId) {
                            window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank')
                          }
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="relative mb-3">
                            {video.thumbnailUrl ? (
                              <img
                                src={video.thumbnailUrl}
                                alt={video.title}
                                className="w-full h-40 object-cover rounded-lg group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-40 bg-gradient-to-br from-slate-200 to-slate-300 rounded-lg flex items-center justify-center">
                                <FileText className="w-12 h-12 text-slate-400" />
                              </div>
                            )}
                            <div className="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                              #{index + 1}
                            </div>
                            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                              {new Date(video.publishedAt).toLocaleDateString("ko-KR", {
                                month: "short",
                                day: "numeric",
                              })}
                            </div>
                          </div>
                          <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {video.title}
                          </h3>
                          <div className="flex items-center gap-4 text-xs text-slate-600">
                            <div className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              <span>{video.viewCount >= 10000 ? `${(video.viewCount / 10000).toFixed(1)}만` : video.viewCount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              <span>{video.likeCount >= 1000 ? `${(video.likeCount / 1000).toFixed(1)}K` : video.likeCount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              <span>{video.commentCount >= 1000 ? `${(video.commentCount / 1000).toFixed(1)}K` : video.commentCount.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">인기 점수</span>
                              <span className="text-sm font-bold text-red-600">{video.popularityScore.toFixed(1)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 다시 분석하기 버튼 */}
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setAnalysisResult(null)
                    setChannelId("")
                    setError(null)
                  }}
                  variant="outline"
                  size="lg"
                  className="border-2 border-slate-300 hover:bg-slate-50 font-semibold"
                >
                  다시 분석하기
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

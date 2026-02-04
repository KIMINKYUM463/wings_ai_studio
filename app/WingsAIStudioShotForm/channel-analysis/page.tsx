"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BarChart3, Loader2, Home, TrendingUp, AlertCircle, Target, Brain, FileText, Eye, Heart, MessageSquare, Bookmark, ShoppingBag, ExternalLink, Play, Sparkles } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { extractKeywordFromVideo } from "./actions"

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
}

interface ProductInfo {
  productName: string
  viewCount: number
  videoTitle: string
  videoId: string
  thumbnailUrl: string
}

export default function ChannelAnalysisPage() {
  const router = useRouter()
  const [channelId, setChannelId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<ChannelAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showProductDialog, setShowProductDialog] = useState(false)
  const [products, setProducts] = useState<ProductInfo[]>([])
  const [isExtractingProducts, setIsExtractingProducts] = useState(false)


  // 잘뜬 제품 찾기
  const handleFindProducts = async () => {
    if (!analysisResult) return
    
    setIsExtractingProducts(true)
    setShowProductDialog(true)
    
    try {
      // OpenAI API 키 가져오기
      const openaiApiKey = localStorage.getItem("shotform_openai_api_key") || ""
      
      if (!openaiApiKey) {
        throw new Error("OpenAI API Key를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
      }

      // 영상을 조회수 순으로 정렬하고 상위 10개만 선택
      const sortedVideos = [...analysisResult.videos]
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 10) // 상위 10개만 추출
      
      // 각 영상에서 AI를 활용하여 핵심 키워드 추출 (영상당 하나씩)
      const productsList: ProductInfo[] = []
      
      // 각 영상에 대해 순차적으로 키워드 추출 (너무 많은 동시 요청 방지)
      for (const video of sortedVideos) {
        try {
          const keyword = await extractKeywordFromVideo(
            video.title,
            video.description || "",
            openaiApiKey
          )
          
          // 키워드가 추출된 경우에만 추가
          if (keyword) {
            productsList.push({
              productName: keyword,
              viewCount: video.viewCount,
              videoTitle: video.title,
              videoId: video.videoId,
              thumbnailUrl: video.thumbnailUrl,
            })
          }
        } catch (error) {
          console.error(`영상 "${video.title}" 키워드 추출 실패:`, error)
          // 개별 영상 추출 실패해도 계속 진행
        }
      }
      
      setProducts(productsList)
    } catch (error) {
      console.error("제품 추출 실패:", error)
      setError(error instanceof Error ? error.message : "제품 추출에 실패했습니다.")
    } finally {
      setIsExtractingProducts(false)
    }
  }

  // 쿠팡 검색 링크 생성
  const getCoupangSearchUrl = (productName: string): string => {
    const encodedProductName = encodeURIComponent(productName)
    return `https://www.coupang.com/np/search?q=${encodedProductName}`
  }

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
      const youtubeApiKey = localStorage.getItem("shotform_youtube_data_api_key") || ""

      if (!youtubeApiKey) {
        throw new Error("YouTube API Key를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
      }

      // API 호출 (채널 ID, URL 또는 채널명 모두 전달)
      const response = await fetch("/api/youmaker/analyze-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channelId.trim(), // 원본 입력값 그대로 전달 (API에서 처리)
          youtubeApiKey,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push("/WingsAIStudioShotForm")}
            className="text-slate-400 hover:text-white hover:bg-slate-800/50"
          >
            ← 홈으로
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/WingsAIStudioShotForm")}
            className="border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white hover:border-slate-600"
          >
            <Home className="w-4 h-4 mr-2" />
            홈으로
          </Button>
        </div>

        <div className="space-y-8">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-cyan-500/20 to-purple-600/20 blur-3xl rounded-3xl"></div>
            <Card className="relative border-0 bg-slate-800/50 backdrop-blur-xl shadow-2xl">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-4 mb-2">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/50">
                    <BarChart3 className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-4xl font-bold text-white mb-1">
                      채널 분석
                    </CardTitle>
                    <p className="text-slate-400 text-sm font-medium">
                      YouTube 채널의 데이터를 수집하고 AI가 전략, 성장, 진단을 종합적으로 분석합니다
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>

          {!analysisResult ? (
            <>
              {/* 채널 입력 섹션 */}
              <Card className="border border-slate-700/50 bg-slate-800/30 backdrop-blur-xl shadow-2xl">
                <CardHeader className="border-b border-slate-700/50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                      <Target className="w-5 h-5 text-blue-400" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">
                      채널 정보 입력
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <div>
                      <Label htmlFor="channel-id" className="text-sm font-semibold text-slate-300 mb-3 block">
                        채널 ID, URL 또는 채널명
                      </Label>
                      <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                        YouTube 채널 ID (UC로 시작), 채널 URL, 또는 채널명을 입력하세요.
                        <br />
                        <span className="text-slate-500">예: UC..., https://youtube.com/channel/UC..., 또는 채널명 (예: "PewDiePie")</span>
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
                        className="text-base bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                    {error && (
                      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-red-400">
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
                        className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 hover:from-blue-500 hover:via-cyan-400 hover:to-blue-500 text-white font-semibold shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/50 transform hover:scale-[1.02] transition-all duration-300 px-8 py-6 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <Card className="border border-slate-700/50 bg-slate-800/30 backdrop-blur-xl shadow-2xl overflow-hidden">
                  <CardContent className="py-20 text-center relative">
                    {/* AI 분석 애니메이션 배경 */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
                      <div className="absolute top-1/2 right-1/4 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                      <div className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.7s' }}></div>
                    </div>
                    
                    {/* AI 아이콘 애니메이션 */}
                    <div className="relative z-10">
                      <div className="relative inline-block mb-8">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-purple-500 rounded-full blur-2xl opacity-60 animate-pulse"></div>
                        <div className="relative bg-gradient-to-br from-blue-500 via-cyan-500 to-purple-500 p-8 rounded-3xl shadow-2xl shadow-blue-500/50">
                          <Brain className="w-16 h-16 text-white" />
                        </div>
                        <div className="absolute -top-3 -right-3">
                          <div className="p-2 rounded-full bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30">
                            <Sparkles className="w-6 h-6 text-yellow-400 animate-spin" style={{ animationDuration: '2s' }} />
                          </div>
                        </div>
                        <div className="absolute -bottom-3 -left-3">
                          <div className="p-2 rounded-full bg-blue-500/20 backdrop-blur-sm border border-blue-500/30">
                            <BarChart3 className="w-5 h-5 text-blue-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                          </div>
                        </div>
                      </div>
                      
                      <h3 className="text-3xl font-bold text-white mb-3">AI가 채널을 분석하고 있습니다</h3>
                      <p className="text-slate-400 mb-8 text-lg">데이터 수집 및 전략/성장/진단 분석 중...</p>
                      
                      {/* 진행 바 */}
                      <div className="w-full max-w-md mx-auto bg-slate-700/50 rounded-full h-2 overflow-hidden backdrop-blur-sm">
                        <div className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-purple-500 rounded-full animate-pulse shadow-lg shadow-blue-500/50"></div>
                      </div>
                      
                      {/* 로딩 도트 애니메이션 */}
                      <div className="flex justify-center gap-3 mt-8">
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce shadow-lg shadow-blue-500/50" style={{ animationDelay: '0s' }}></div>
                        <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce shadow-lg shadow-cyan-500/50" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce shadow-lg shadow-purple-500/50" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              {/* 채널 정보 헤더 */}
              <Card className="border border-slate-700/50 bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl shadow-2xl overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-cyan-500/10 to-purple-600/10"></div>
                <CardContent className="p-8 relative z-10">
                  <div className="flex items-start gap-8">
                    {/* 왼쪽: 프로필 이미지 및 채널명 */}
                    <div className="flex items-start gap-5">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full blur-md opacity-50"></div>
                        {analysisResult.channelInfo.thumbnailUrl ? (
                          <img
                            src={analysisResult.channelInfo.thumbnailUrl}
                            alt={analysisResult.channelInfo.title}
                            className="relative w-24 h-24 rounded-full object-cover border-4 border-slate-700/50 shadow-xl"
                          />
                        ) : (
                          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center border-4 border-slate-700/50 shadow-xl">
                            <span className="text-white font-bold text-2xl">
                              {analysisResult.channelInfo.title.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold text-white mb-2">{analysisResult.channelInfo.title}</h2>
                        <p className="text-slate-400 text-sm mb-4">채널 분석 결과</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-600/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white hover:border-slate-500 backdrop-blur-sm"
                        >
                          <Bookmark className="w-4 h-4 mr-2" />
                          즐겨찾기
                        </Button>
                      </div>
                    </div>

                    {/* 중앙: 주요 지표 */}
                    <div className="flex-1 flex items-center gap-8">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-600/10 border border-red-500/20 backdrop-blur-sm">
                        <p className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">구독자 수</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-red-400 to-red-500 bg-clip-text text-transparent">
                          {parseInt(analysisResult.channelInfo.subscriberCount) >= 10000
                            ? `${(parseInt(analysisResult.channelInfo.subscriberCount) / 10000).toFixed(0)}만`
                            : parseInt(analysisResult.channelInfo.subscriberCount).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 backdrop-blur-sm">
                        <p className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">총 조회수</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                          {parseInt(analysisResult.channelInfo.viewCount) >= 10000
                            ? `${(parseInt(analysisResult.channelInfo.viewCount) / 10000).toFixed(0)}만`
                            : parseInt(analysisResult.channelInfo.viewCount).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 backdrop-blur-sm">
                        <p className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">총 영상 수</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                          {parseInt(analysisResult.channelInfo.videoCount).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* 오른쪽: 채널 메타데이터 */}
                    <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50 min-w-[300px] backdrop-blur-sm">
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                          <span className="text-slate-400 font-medium">채널 개설일</span>
                          <span className="text-white font-semibold">{analysisResult.metadata.channelCreationDate}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                          <span className="text-slate-400 font-medium">최초 업로드</span>
                          <span className="text-white font-semibold">{analysisResult.metadata.firstUploadDate}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                          <span className="text-slate-400 font-medium">평균 업로드 주기</span>
                          <span className="text-white font-semibold">{analysisResult.metadata.averageUploadCycle}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-slate-400 font-medium">최근 업로드 주기</span>
                          <span className="text-white font-semibold">{analysisResult.metadata.recentUploadCycle}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 잘뜬 제품 찾기 버튼 */}
              <div className="flex justify-center">
                <Button
                  onClick={handleFindProducts}
                  disabled={isExtractingProducts}
                  size="lg"
                  className="bg-gradient-to-r from-orange-600 via-red-500 to-pink-600 hover:from-orange-500 hover:via-red-400 hover:to-pink-500 text-white font-semibold shadow-lg shadow-orange-500/50 hover:shadow-xl hover:shadow-orange-500/50 transform hover:scale-[1.02] transition-all duration-300 px-8 py-6"
                >
                  {isExtractingProducts ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      제품 추출 중...
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-5 h-5 mr-2" />
                      잘뜬 제품 찾기
                    </>
                  )}
                </Button>
              </div>

              {/* 하위 탭 (인기 점수, 조회수, 좋아요, 댓글, 타임라인) */}
              <Tabs defaultValue="popularity" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-5 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                    <TabsTrigger 
                      value="popularity" 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-red-500/50 text-xs text-slate-300 data-[state=active]:border-0 transition-all"
                    >
                      <BarChart3 className="w-3 h-3 mr-1" />
                      인기 점수
                    </TabsTrigger>
                    <TabsTrigger 
                      value="views" 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/50 text-xs text-slate-300 data-[state=active]:border-0 transition-all"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      조회수
                    </TabsTrigger>
                    <TabsTrigger 
                      value="likes" 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-pink-500/50 text-xs text-slate-300 data-[state=active]:border-0 transition-all"
                    >
                      <Heart className="w-3 h-3 mr-1" />
                      좋아요
                    </TabsTrigger>
                    <TabsTrigger 
                      value="comments" 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-cyan-500/50 text-xs text-slate-300 data-[state=active]:border-0 transition-all"
                    >
                      <MessageSquare className="w-3 h-3 mr-1" />
                      댓글
                    </TabsTrigger>
                    <TabsTrigger 
                      value="timeline" 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/50 text-xs text-slate-300 data-[state=active]:border-0 transition-all"
                    >
                      <TrendingUp className="w-3 h-3 mr-1" />
                      타임라인
                    </TabsTrigger>
                  </TabsList>

                  {/* 인기 점수 분포 차트 */}
                  <TabsContent value="popularity" className="space-y-6">
                    <Card className="border border-slate-700/50 bg-slate-800/30 backdrop-blur-xl shadow-2xl">
                      <CardHeader className="border-b border-slate-700/50">
                        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30">
                            <BarChart3 className="w-4 h-4 text-red-400" />
                          </div>
                          인기 점수 분포 (상위 20개)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={analysisResult.videos.slice(0, 20).map((v, i) => ({
                            name: v.title.length > 20 ? v.title.substring(0, 20) + "..." : v.title,
                            score: v.popularityScore,
                            fullTitle: v.title,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.3} />
                            <XAxis
                              dataKey="name"
                              angle={-45}
                              textAnchor="end"
                              height={120}
                              tick={{ fontSize: 10, fill: '#94a3b8' }}
                              interval={0}
                            />
                            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-slate-800/95 backdrop-blur-xl p-4 border border-slate-700/50 rounded-xl shadow-2xl">
                                      <p className="font-semibold text-white mb-2 text-sm">{payload[0].payload.fullTitle}</p>
                                      <p className="text-red-400 font-bold text-lg">인기 점수: {payload[0].value}</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Bar dataKey="score" fill="url(#redGradient)" radius={[8, 8, 0, 0]} />
                            <defs>
                              <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* 조회수 차트 */}
                  <TabsContent value="views" className="space-y-6">
                    <Card className="border border-slate-700/50 bg-slate-800/30 backdrop-blur-xl shadow-2xl">
                      <CardHeader className="border-b border-slate-700/50">
                        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                            <Eye className="w-4 h-4 text-blue-400" />
                          </div>
                          조회수 분포 (상위 20개)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={analysisResult.videos.slice(0, 20).map((v, i) => ({
                            name: v.title.length > 20 ? v.title.substring(0, 20) + "..." : v.title,
                            views: v.viewCount,
                            fullTitle: v.title,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.3} />
                            <XAxis
                              dataKey="name"
                              angle={-45}
                              textAnchor="end"
                              height={120}
                              tick={{ fontSize: 10, fill: '#94a3b8' }}
                              interval={0}
                            />
                            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-slate-800/95 backdrop-blur-xl p-4 border border-slate-700/50 rounded-xl shadow-2xl">
                                      <p className="font-semibold text-white mb-2 text-sm">{payload[0].payload.fullTitle}</p>
                                      <p className="text-blue-400 font-bold text-lg">조회수: {payload[0].value?.toLocaleString()}</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Bar dataKey="views" fill="url(#blueGradient)" radius={[8, 8, 0, 0]} />
                            <defs>
                              <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* 좋아요 차트 */}
                  <TabsContent value="likes" className="space-y-6">
                    <Card className="border border-slate-700/50 bg-slate-800/30 backdrop-blur-xl shadow-2xl">
                      <CardHeader className="border-b border-slate-700/50">
                        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-pink-500/30">
                            <Heart className="w-4 h-4 text-pink-400" />
                          </div>
                          좋아요 분포 (상위 20개)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={analysisResult.videos.slice(0, 20).map((v, i) => ({
                            name: v.title.length > 20 ? v.title.substring(0, 20) + "..." : v.title,
                            likes: v.likeCount,
                            fullTitle: v.title,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.3} />
                            <XAxis
                              dataKey="name"
                              angle={-45}
                              textAnchor="end"
                              height={120}
                              tick={{ fontSize: 10, fill: '#94a3b8' }}
                              interval={0}
                            />
                            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-slate-800/95 backdrop-blur-xl p-4 border border-slate-700/50 rounded-xl shadow-2xl">
                                      <p className="font-semibold text-white mb-2 text-sm">{payload[0].payload.fullTitle}</p>
                                      <p className="text-pink-400 font-bold text-lg">좋아요: {payload[0].value?.toLocaleString()}</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Bar dataKey="likes" fill="url(#pinkGradient)" radius={[8, 8, 0, 0]} />
                            <defs>
                              <linearGradient id="pinkGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ec4899" stopOpacity={1} />
                                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* 댓글 차트 */}
                  <TabsContent value="comments" className="space-y-6">
                    <Card className="border border-slate-700/50 bg-slate-800/30 backdrop-blur-xl shadow-2xl">
                      <CardHeader className="border-b border-slate-700/50">
                        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30">
                            <MessageSquare className="w-4 h-4 text-cyan-400" />
                          </div>
                          댓글 수 분포 (상위 20개)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={analysisResult.videos.slice(0, 20).map((v, i) => ({
                            name: v.title.length > 20 ? v.title.substring(0, 20) + "..." : v.title,
                            comments: v.commentCount,
                            fullTitle: v.title,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.3} />
                            <XAxis
                              dataKey="name"
                              angle={-45}
                              textAnchor="end"
                              height={120}
                              tick={{ fontSize: 10, fill: '#94a3b8' }}
                              interval={0}
                            />
                            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-slate-800/95 backdrop-blur-xl p-4 border border-slate-700/50 rounded-xl shadow-2xl">
                                      <p className="font-semibold text-white mb-2 text-sm">{payload[0].payload.fullTitle}</p>
                                      <p className="text-cyan-400 font-bold text-lg">댓글: {payload[0].value?.toLocaleString()}</p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Bar dataKey="comments" fill="url(#cyanGradient)" radius={[8, 8, 0, 0]} />
                            <defs>
                              <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* 타임라인 */}
                  <TabsContent value="timeline" className="space-y-6">
                    <Card className="border border-slate-700/50 bg-slate-800/30 backdrop-blur-xl shadow-2xl">
                      <CardHeader className="border-b border-slate-700/50">
                        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30">
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                          </div>
                          영상 업로드 타임라인
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          {analysisResult.videos.slice(0, 20).map((video, index) => (
                            <div key={index} className="flex items-center gap-4 p-4 border border-slate-700/50 rounded-xl hover:bg-slate-700/30 hover:border-purple-500/50 transition-all backdrop-blur-sm">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold shrink-0 shadow-lg shadow-purple-500/50">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-white mb-1">{video.title}</p>
                                <p className="text-sm text-slate-400">
                                  {new Date(video.publishedAt).toLocaleDateString("ko-KR")} • 조회수: {video.viewCount.toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold bg-gradient-to-r from-red-400 to-red-500 bg-clip-text text-transparent">인기 점수: {video.popularityScore.toFixed(1)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

              </Tabs>

              {/* 최근 영상 목록 */}
              <Card className="border border-slate-700/50 bg-slate-800/30 backdrop-blur-xl shadow-2xl">
                <CardHeader className="bg-gradient-to-r from-slate-700/30 to-slate-800/30 border-b border-slate-700/50">
                  <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-slate-600/20 to-slate-700/20 border border-slate-600/30">
                      <TrendingUp className="w-6 h-6 text-slate-400" />
                    </div>
                    최근 업로드 영상
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {analysisResult.videos.slice(0, 12).map((video, index) => (
                      <Card
                        key={video.videoId || index}
                        className="border border-slate-700/50 bg-slate-800/50 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/20 transition-all cursor-pointer group backdrop-blur-sm overflow-hidden"
                        onClick={() => {
                          if (video.videoId) {
                            window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank')
                          }
                        }}
                      >
                        <CardContent className="p-0">
                          <div className="relative overflow-hidden">
                            {video.thumbnailUrl ? (
                              <img
                                src={video.thumbnailUrl}
                                alt={video.title}
                                className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-40 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                                <FileText className="w-12 h-12 text-slate-500" />
                              </div>
                            )}
                            <div className="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-lg">
                              #{index + 1}
                            </div>
                            <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-lg border border-white/10">
                              {new Date(video.publishedAt).toLocaleDateString("ko-KR", {
                                month: "short",
                                day: "numeric",
                              })}
                            </div>
                          </div>
                          <div className="p-4">
                            <h3 className="font-semibold text-white mb-3 line-clamp-2 group-hover:text-blue-400 transition-colors text-sm">
                              {video.title}
                            </h3>
                            <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
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
                            <div className="pt-3 border-t border-slate-700/50">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400">인기 점수</span>
                                <span className="text-sm font-bold bg-gradient-to-r from-red-400 to-red-500 bg-clip-text text-transparent">{video.popularityScore.toFixed(1)}</span>
                              </div>
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
                  className="border border-slate-700/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white hover:border-slate-600 font-semibold backdrop-blur-sm"
                >
                  다시 분석하기
                </Button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* 잘뜬 제품 찾기 다이얼로그 */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-3xl w-[90vw] max-h-[80vh] overflow-y-auto overflow-x-hidden bg-slate-800/95 backdrop-blur-xl border border-slate-700/50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-orange-400" />
              잘뜬 제품 찾기
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              조회수 높은 영상에서 추출한 제품 목록입니다. 각 제품을 클릭하면 쿠팡에서 검색됩니다.
            </DialogDescription>
          </DialogHeader>
          
          {isExtractingProducts ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-orange-400 mx-auto mb-4" />
                <p className="text-slate-300">제품 정보를 추출하고 있습니다...</p>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">추출된 제품이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {products.map((product, index) => (
                <Card
                  key={index}
                  className="border border-slate-700/50 bg-slate-800/50 hover:border-orange-500/50 hover:bg-slate-700/30 transition-all backdrop-blur-sm"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4 w-full">
                      {/* 순위 배지 */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-orange-500/50">
                          {index + 1}
                        </div>
                      </div>
                      
                      {/* 제품 정보 */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className="font-bold text-white mb-1 text-lg break-words">{product.productName}</h3>
                        <p className="text-sm text-slate-400 mb-2 break-words line-clamp-2">{product.videoTitle}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <Eye className="w-3 h-3 flex-shrink-0" />
                            <span className="whitespace-nowrap">{product.viewCount >= 10000 ? `${(product.viewCount / 10000).toFixed(1)}만` : product.viewCount.toLocaleString()} 조회</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* 버튼 그룹 */}
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {/* YouTube 영상 링크 버튼 */}
                        {product.videoId && (
                          <Button
                            onClick={() => window.open(`https://www.youtube.com/watch?v=${product.videoId}`, '_blank')}
                            variant="outline"
                            size="sm"
                            className="border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-400 whitespace-nowrap"
                          >
                            <Play className="w-4 h-4 mr-1.5" />
                            영상 보기
                          </Button>
                        )}
                        {/* 쿠팡 검색 버튼 */}
                        <Button
                          onClick={() => window.open(getCoupangSearchUrl(product.productName), '_blank')}
                          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-semibold shadow-lg shadow-orange-500/50 whitespace-nowrap"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          쿠팡 검색
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Home,
  Settings,
  TrendingUp,
  MessageSquare,
  FileText,
  BarChart3,
  Activity,
  ImageIcon,
  Newspaper,
  Palette,
  Mic,
  Zap,
  Save,
  Eye,
  EyeOff,
  Sparkles,
  Play,
  User,
} from "lucide-react"
import { useRouter } from "next/navigation"

interface TrendingVideo {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  viewCount: number
  likeCount: number
  publishedAt: string
}

interface TrendKeyword {
  keyword: string
  totalViews: number
  videoCount: number
  trendScore: number
  videos: Array<{
    title: string
    channelTitle: string
    viewCount: number
  }>
}

interface RisingCreator {
  channelTitle: string
  channelId: string
  videoCount: number
  totalViews: number
  averageViews: number
  highlight: string
  videos: Array<{
    title: string
    viewCount: number
  }>
}

// Header 컴포넌트
function Header({ onSettingsClick }: { onSettingsClick: () => void }) {
  const router = useRouter()

  return (
    <header className="w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 좌측: Home, Settings 아이콘 */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => router.push("/")}
              title="홈"
            >
              <Home className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={onSettingsClick}
              title="설정"
            >
              <Settings className="w-5 h-5" />
            </Button>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-200/50 text-orange-700 text-sm font-semibold">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              YouMaker
            </div>
          </div>

          {/* 우측 메뉴 */}
          <nav className="hidden md:flex items-center gap-6">
            <Button variant="ghost" className="text-slate-700 hover:text-slate-900">
              가이드
            </Button>
            <Button variant="ghost" className="text-slate-700 hover:text-slate-900">
              공지사항
            </Button>
          </nav>
        </div>
      </div>
    </header>
  )
}

// 설정 모달 컴포넌트
function SettingsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [youtubeApiKey, setYoutubeApiKey] = useState("")
  const [geminiApiKey, setGeminiApiKey] = useState("")
  const [replicateApiKey, setReplicateApiKey] = useState("")
  const [showYoutubeKey, setShowYoutubeKey] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showReplicateKey, setShowReplicateKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // 로컬 스토리지에서 API 키 불러오기
  useEffect(() => {
    if (open) {
      const savedYoutubeKey = localStorage.getItem("youmaker_youtube_api_key") || ""
      const savedGeminiKey = localStorage.getItem("youmaker_gemini_api_key") || ""
      const savedReplicateKey = localStorage.getItem("youmaker_replicate_api_key")
      const defaultReplicateKey = "r8_AgOeBCpTw8baE7gXQsErwViD1taChAB19ZHLA"
      
      setYoutubeApiKey(savedYoutubeKey)
      setGeminiApiKey(savedGeminiKey)
      setReplicateApiKey(savedReplicateKey || defaultReplicateKey)
      
      // Replicate API 키가 없으면 기본값으로 저장
      if (!savedReplicateKey) {
        localStorage.setItem("youmaker_replicate_api_key", defaultReplicateKey)
      }
    }
  }, [open])

  // API 키 저장
  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      // 로컬 스토리지에 저장
      localStorage.setItem("youmaker_youtube_api_key", youtubeApiKey)
      localStorage.setItem("youmaker_gemini_api_key", geminiApiKey)
      localStorage.setItem("youmaker_replicate_api_key", replicateApiKey)

      setSaveMessage({ type: "success", text: "설정이 저장되었습니다." })
      
      // 3초 후 메시지 제거
      setTimeout(() => {
        setSaveMessage(null)
      }, 3000)
    } catch (error) {
      console.error("설정 저장 실패:", error)
      setSaveMessage({ type: "error", text: "설정 저장에 실패했습니다." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">설정</DialogTitle>
          <DialogDescription>
            YouTube Data API Key, Gemini API Key, Replicate API Key를 입력하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* YouTube Data API Key */}
          <div className="space-y-2">
            <Label htmlFor="youtube-api-key" className="text-base font-semibold">
              YouTube Data API Key
            </Label>
            <p className="text-sm text-slate-600">
              YouTube 영상 분석을 위해 필요합니다.{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-600 underline"
              >
                Google Cloud Console
              </a>
              에서 발급받을 수 있습니다.
            </p>
            <div className="relative">
              <Input
                id="youtube-api-key"
                type={showYoutubeKey ? "text" : "password"}
                placeholder="YouTube Data API Key를 입력하세요"
                value={youtubeApiKey}
                onChange={(e) => setYoutubeApiKey(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowYoutubeKey(!showYoutubeKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showYoutubeKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-2">
            <Label htmlFor="gemini-api-key" className="text-base font-semibold">
              Gemini API Key
            </Label>
            <p className="text-sm text-slate-600">
              AI 분석 및 대본 각색을 위해 필요합니다.{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-600 underline"
              >
                Google AI Studio
              </a>
              에서 발급받을 수 있습니다.
            </p>
            <div className="relative">
              <Input
                id="gemini-api-key"
                type={showGeminiKey ? "text" : "password"}
                placeholder="Gemini API Key를 입력하세요"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showGeminiKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Replicate API Key */}
          <div className="space-y-2">
            <Label htmlFor="replicate-api-key" className="text-base font-semibold">
              Replicate API Key
            </Label>
            <p className="text-sm text-slate-600">
              나노바나나 AI 썸네일 생성을 위해 필요합니다.{" "}
              <a
                href="https://replicate.com/account/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-600 underline"
              >
                Replicate
              </a>
              에서 발급받을 수 있습니다. (기본값이 설정되어 있습니다)
            </p>
            <div className="relative">
              <Input
                id="replicate-api-key"
                type={showReplicateKey ? "text" : "password"}
                placeholder="Replicate API Key를 입력하세요"
                value={replicateApiKey}
                onChange={(e) => setReplicateApiKey(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowReplicateKey(!showReplicateKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showReplicateKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* 저장 버튼 및 메시지 */}
          <div className="space-y-4">
            {saveMessage && (
              <div
                className={`p-4 rounded-lg ${
                  saveMessage.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {saveMessage.text}
              </div>
            )}
            <div className="flex justify-end gap-4">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                size="lg"
              >
                닫기
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              >
                {isSaving ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    저장
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 급상승 트렌드 뷰 컴포넌트
function TrendingView() {
  const [activeTab, setActiveTab] = useState("videos")
  const [isLoading, setIsLoading] = useState(false)
  const [videos, setVideos] = useState<TrendingVideo[]>([])
  const [trends, setTrends] = useState<TrendKeyword[]>([])
  const [creators, setCreators] = useState<RisingCreator[]>([])

  // 데이터 로드
  useEffect(() => {
    loadTrendingData()
  }, [])

  const loadTrendingData = async () => {
    setIsLoading(true)
    try {
      // 로컬 스토리지에서 API 키 가져오기
      const youtubeApiKey = localStorage.getItem("youmaker_youtube_api_key")
      const geminiApiKey = localStorage.getItem("youmaker_gemini_api_key")

      if (!youtubeApiKey) {
        alert("YouTube Data API Key를 설정해주세요.")
        setIsLoading(false)
        return
      }

      // 캐시 확인 (1시간 = 3600000ms)
      const CACHE_KEY = "youmaker_trending_data"
      const CACHE_TIMESTAMP_KEY = "youmaker_trending_data_timestamp"
      const CACHE_DURATION = 60 * 60 * 1000 // 1시간

      const cachedData = localStorage.getItem(CACHE_KEY)
      const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
      const now = Date.now()

      // 캐시가 있고 1시간이 지나지 않았으면 캐시 사용 (애니메이션 효과를 위해 약간의 딜레이)
      if (cachedData && cachedTimestamp) {
        const cacheAge = now - parseInt(cachedTimestamp)
        if (cacheAge < CACHE_DURATION) {
          // 실시간 업데이트처럼 보이도록 약간의 로딩 시간 추가
          await new Promise((resolve) => setTimeout(resolve, 800))
          
          const data = JSON.parse(cachedData)
          // 데이터를 순차적으로 표시하기 위해 빈 배열로 시작
          setVideos([])
          setTrends([])
          setCreators([])
          
          // 약간의 딜레이 후 데이터 표시 (애니메이션 효과)
          setTimeout(() => {
            setVideos(data.videos || [])
            setTrends(data.trends || [])
            setCreators(data.creators || [])
          }, 100)
          
          setIsLoading(false)
          return
        }
      }

      // 캐시가 없거나 만료되었으면 새로 가져오기
      // 1. YouTube Data API로 인기 동영상 가져오기
      const videosResponse = await fetch(`/api/youmaker/trending-videos?apiKey=${encodeURIComponent(youtubeApiKey)}`)
      if (!videosResponse.ok) {
        throw new Error("인기 동영상을 불러오는데 실패했습니다.")
      }
      const videosData = await videosResponse.json()
      const fetchedVideos = videosData.videos || []
      
      // 데이터를 순차적으로 표시하기 위해 빈 배열로 시작
      setVideos([])

      let fetchedTrends: TrendKeyword[] = []
      let fetchedCreators: RisingCreator[] = []

      // 2. Gemini AI로 트렌드 키워드 분석
      if (geminiApiKey && fetchedVideos.length > 0) {
        const trendsResponse = await fetch("/api/youmaker/analyze-trends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videos: fetchedVideos,
            geminiApiKey,
          }),
        })
        if (trendsResponse.ok) {
          const trendsData = await trendsResponse.json()
          fetchedTrends = trendsData.trends || []
        }

        // 3. Gemini AI로 라이징 크리에이터 분석
        const creatorsResponse = await fetch("/api/youmaker/rising-creators", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videos: fetchedVideos,
            geminiApiKey,
          }),
        })
        if (creatorsResponse.ok) {
          const creatorsData = await creatorsResponse.json()
          fetchedCreators = creatorsData.creators || []
        }
      }

      // 애니메이션 효과를 위해 순차적으로 데이터 표시
      setTimeout(() => {
        setVideos(fetchedVideos)
        setTrends(fetchedTrends)
        setCreators(fetchedCreators)
      }, 300)

      // 캐시에 저장
      const cacheData = {
        videos: fetchedVideos,
        trends: fetchedTrends,
        creators: fetchedCreators,
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
      localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString())
    } catch (error) {
      console.error("트렌드 데이터 로드 실패:", error)
      alert("트렌드 데이터를 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <CardHeader className="border-b border-slate-700/50 pb-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between">
            <TabsList className="bg-transparent border-0 p-0 h-auto">
              <TabsTrigger
                value="videos"
                className="text-white data-[state=active]:text-red-500 data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none bg-transparent hover:bg-slate-800/50"
              >
                급상승 동영상
              </TabsTrigger>
              <TabsTrigger
                value="trends"
                className="text-white data-[state=active]:text-red-500 data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none bg-transparent hover:bg-slate-800/50"
              >
                실시간 트렌드
              </TabsTrigger>
              <TabsTrigger
                value="creators"
                className="text-white data-[state=active]:text-red-500 data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none bg-transparent hover:bg-slate-800/50"
              >
                라이징 크리에이터
              </TabsTrigger>
            </TabsList>
            {/* 실시간 업데이트 인디케이터 */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="relative">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping opacity-75" />
              </div>
              <span className="text-xs text-slate-400 font-medium">실시간 업데이트 중</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-1 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-1 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>

          <CardContent className="p-6 relative">
            {isLoading && videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Sparkles className="w-8 h-8 mb-4 animate-spin text-orange-500" />
                <p className="text-white">최신 트렌드 데이터를 불러오는 중...</p>
                <div className="mt-4 w-full max-w-md">
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {isLoading && videos.length > 0 && (
                  <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg pointer-events-none">
                    <div className="text-center bg-slate-800/90 px-6 py-4 rounded-lg shadow-xl">
                      <Sparkles className="w-6 h-6 mx-auto mb-2 animate-spin text-orange-500" />
                      <p className="text-white text-sm">데이터 업데이트 중...</p>
                    </div>
                  </div>
                )}
                <TabsContent value="videos" className="mt-0">
                  <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {videos.map((video, index) => (
                        <Card 
                          key={video.id} 
                          className="border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 hover:from-slate-700/90 hover:to-slate-800/90 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/10 group animate-in fade-in slide-in-from-bottom-4"
                          style={{
                            animationDelay: `${index * 30}ms`,
                            animationDuration: '500ms',
                            animationFillMode: 'both',
                          }}
                          onClick={() => window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank')}
                        >
                          <CardContent className="p-0">
                            <div className="relative overflow-hidden rounded-t-lg">
                              <img
                                src={video.thumbnail}
                                alt={video.title}
                                className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              <div className="absolute top-3 right-3">
                                <Badge className="bg-red-500/90 backdrop-blur-sm text-white border border-red-400/50 shadow-lg">
                                  <Play className="w-3 h-3 mr-1" />
                                  {video.viewCount >= 1000000
                                    ? `${(video.viewCount / 1000000).toFixed(1)}M`
                                    : video.viewCount >= 1000
                                    ? `${(video.viewCount / 1000).toFixed(1)}K`
                                    : video.viewCount.toLocaleString()}
                                </Badge>
                              </div>
                            </div>
                            <div className="p-4 space-y-2">
                              <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem] group-hover:text-orange-400 transition-colors">
                                {video.title}
                              </h3>
                              <p className="text-slate-400 text-xs truncate">{video.channelTitle}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>{new Date(video.publishedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="trends" className="mt-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-slate-800/50">
                        <TableHead className="text-white">순위</TableHead>
                        <TableHead className="text-white">키워드</TableHead>
                        <TableHead className="text-white">총 조회수</TableHead>
                        <TableHead className="text-white">영상 수</TableHead>
                        <TableHead className="text-white">트렌드 점수</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trends.map((trend, index) => (
                        <TableRow key={index} className="border-slate-700 hover:bg-slate-800/50">
                          <TableCell className="text-white font-bold">{index + 1}</TableCell>
                          <TableCell className="text-white font-medium">{trend.keyword}</TableCell>
                          <TableCell className="text-slate-300">{trend.totalViews.toLocaleString()}</TableCell>
                          <TableCell className="text-slate-300">{trend.videoCount}</TableCell>
                          <TableCell className="text-orange-400 font-semibold">{trend.trendScore}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="creators" className="mt-0">
                  <div className="space-y-4">
                    {creators.map((creator, index) => (
                      <Card key={index} className="border-slate-700 bg-slate-800/50">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white font-bold">
                              <User className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-white font-semibold text-lg mb-1">{creator.channelTitle}</h3>
                              <p className="text-slate-400 text-sm mb-2">{creator.highlight}</p>
                              <div className="flex gap-4 text-sm">
                                <span className="text-slate-300">영상: {creator.videoCount}개</span>
                                <span className="text-slate-300">총 조회수: {creator.totalViews.toLocaleString()}</span>
                                <span className="text-orange-400">평균: {creator.averageViews.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </>
            )}
          </CardContent>
        </Tabs>
      </CardHeader>
    </Card>
  )
}

export default function YouMakerPage() {
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(251, 146, 60, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(251, 146, 60, 0.7);
        }
      `}</style>
      <Header onSettingsClick={() => setSettingsOpen(true)} />
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 헤더 섹션 */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-slate-900 mb-4 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
            유튜브 분석 도구
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            데이터 기반 인사이트로 채널 성장을 돕습니다
          </p>
        </div>

        {/* 급상승 트렌드 뷰 */}
        <div className="mb-8">
          <TrendingView />
        </div>

        {/* 기능 버튼 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 원클릭 분석 */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 cursor-pointer transition-all hover:scale-105">
            <CardContent className="p-8 text-center text-white">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-4">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">원클릭 분석</h3>
              <p className="text-white/90 text-sm mb-4">
                키워드 입력으로 떡상 영상 분석부터 썸네일 생성까지 자동 진행
              </p>
              <Button
                onClick={() => router.push("/youmaker/trending-analysis")}
                size="lg"
                className="bg-white text-orange-600 hover:bg-white/90 font-semibold"
              >
                시작하기
              </Button>
            </CardContent>
          </Card>

          {/* 채널 분석 */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 cursor-pointer transition-all hover:scale-105">
            <CardContent className="p-8 text-center text-white">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-4">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">채널 분석</h3>
              <p className="text-white/90 text-sm mb-4">
                채널 데이터를 종합적으로 분석하여 성장 전략을 제시합니다
              </p>
              <Button
                onClick={() => router.push("/youmaker/channel-analysis")}
                size="lg"
                className="bg-white text-blue-600 hover:bg-white/90 font-semibold"
              >
                시작하기
              </Button>
            </CardContent>
          </Card>

          {/* 실시간 뉴스 트렌드 */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 cursor-pointer transition-all hover:scale-105">
            <CardContent className="p-8 text-center text-white">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-4">
                <Newspaper className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">실시간 뉴스 트렌드</h3>
              <p className="text-white/90 text-sm mb-4">
                뉴스와 연관된 트렌드를 실시간으로 추적하고 분석합니다
              </p>
              <Button
                onClick={() => router.push("/youmaker/realtime-news")}
                size="lg"
                className="bg-white text-teal-600 hover:bg-white/90 font-semibold"
              >
                시작하기
              </Button>
            </CardContent>
          </Card>

          {/* AI 이미지 스튜디오 */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 cursor-pointer transition-all hover:scale-105">
            <CardContent className="p-8 text-center text-white">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-4">
                <Palette className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">AI 이미지 스튜디오</h3>
              <p className="text-white/90 text-sm mb-4">
                AI로 썸네일, 배경 이미지 등을 자동으로 생성합니다
              </p>
              <Button
                onClick={() => router.push("/youmaker/ai-image-studio")}
                size="lg"
                className="bg-white text-purple-600 hover:bg-white/90 font-semibold"
              >
                시작하기
              </Button>
            </CardContent>
          </Card>

          {/* AI 보이스 스튜디오 */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 cursor-pointer transition-all hover:scale-105">
            <CardContent className="p-8 text-center text-white">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-4">
                <Mic className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">AI 보이스 스튜디오</h3>
              <p className="text-white/90 text-sm mb-4">
                AI로 자연스러운 음성을 생성하고 편집합니다
              </p>
              <Button
                onClick={() => router.push("/youmaker/ai-voice-studio")}
                size="lg"
                className="bg-white text-green-600 hover:bg-white/90 font-semibold"
              >
                시작하기
              </Button>
            </CardContent>
          </Card>

          {/* AI 썸네일 분석 */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 cursor-pointer transition-all hover:scale-105">
            <CardContent className="p-8 text-center text-white">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-4">
                <ImageIcon className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">AI 썸네일 분석</h3>
              <p className="text-white/90 text-sm mb-4">
                썸네일을 업로드하면 AI가 클릭률을 높이는 전략을 분석합니다
              </p>
              <Button
                onClick={() => router.push("/youmaker/thumbnail-analysis")}
                size="lg"
                className="bg-white text-indigo-600 hover:bg-white/90 font-semibold"
              >
                시작하기
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

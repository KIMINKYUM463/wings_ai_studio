"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Search,
  X,
  TrendingUp,
  User,
  ExternalLink,
  Users,
  Eye,
  Star,
  BarChart3,
  Brain,
  Zap,
  PieChart,
  Activity,
  Target,
  ArrowLeft,
  Home,
  Settings,
  EyeOff,
} from "lucide-react"
import Link from "next/link" // Link 컴포넌트 추가

interface VideoData {
  id: string
  title: string
  channelTitle: string
  channelId: string
  channelProfileUrl: string
  publishedAt: string
  viewCount: string
  thumbnailUrl: string
  description: string
  tags: string[]
  duration: string
  isLongForm: boolean
  url: string
}

interface ChannelAnalysisData {
  channelTitle: string
  channelId: string
  profileUrl: string
  subscriberCount: string
  videoCount: string
  country: string
  dailyViews: string
  algorithmScore: number
  engagement: number
  activity: number
  subscriberGrowth: number[]
  viewsGrowth: number[]
  similarChannels: {
    name: string
    profileUrl: string
    subscribers: string
    views: string
    channelId: string
  }[]
}

interface AIAnalysisData {
  trendAnalysis: {
    topKeywords: { keyword: string; frequency: number; growth: number }[]
    contentTypes: { type: string; percentage: number; avgViews: number }[]
    performanceMetrics: { metric: string; value: number; trend: "up" | "down" | "stable" }[]
  }
  predictions: {
    recommendedTopics: { topic: string; score: number; expectedViews: number }[]
    viewCountPrediction: { range: string; probability: number }[]
    bestUploadTimes: { time: string; score: number }[]
  }
  insights: string
}

export default function YouTubeAnalyticsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiAnalysisData, setAiAnalysisData] = useState<AIAnalysisData | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [videos, setVideos] = useState<VideoData[]>([])
  const [selectedVideos, setSelectedVideos] = useState<string[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState("3")
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false)
  const [selectedChannelData, setSelectedChannelData] = useState<ChannelAnalysisData | null>(null)
  const [filters, setFilters] = useState({
    country: "대한민국",
    category: "전체",
    period: "최근 3개월",
  })

  // API 키 관련 상태
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [youtubeApiKey, setYoutubeApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)

  // localStorage에서 API 키 불러오기
  useEffect(() => {
    const savedKey = localStorage.getItem("youtube_api_key")
    if (savedKey) {
      setYoutubeApiKey(savedKey)
    }
  }, [])

  const handleSaveApiKey = () => {
    if (youtubeApiKey.trim()) {
      localStorage.setItem("youtube_api_key", youtubeApiKey.trim())
      alert("YouTube API 키가 저장되었습니다.")
      setShowApiKeyInput(false)
    }
  }

  const getApiKey = () => {
    if (typeof window === "undefined") return undefined
    return localStorage.getItem("youtube_api_key") || undefined
  }

  const handleChannelClick = async (channelTitle: string, channelId: string, profileUrl: string) => {
    // mock 데이터 생성 함수
    const createMockData = (): ChannelAnalysisData => ({
        channelTitle,
        channelId,
        profileUrl,
        subscriberCount: `${(Math.random() * 50 + 1).toFixed(1)}만`,
        videoCount: `${Math.floor(Math.random() * 500 + 50)}개`,
        country: "대한민국",
        dailyViews: `${(Math.random() * 20 + 5).toFixed(1)}만`,
        algorithmScore: Math.floor(Math.random() * 40 + 60),
        engagement: Math.floor(Math.random() * 30 + 50),
        activity: Math.floor(Math.random() * 40 + 60),
        subscriberGrowth: Array.from({ length: 30 }, (_, i) => Math.floor(Math.random() * 1000 + 500 + i * 10)),
        viewsGrowth: Array.from({ length: 30 }, (_, i) => Math.floor(Math.random() * 5000 + 2000 + i * 50)),
        similarChannels: [
        { name: "100세 건강의 지혜", profileUrl: "/placeholder.svg?height=40&width=40", subscribers: "1.3만", views: "5,793", channelId: "mock1" },
        { name: "시니어건강백과사전", profileUrl: "/placeholder.svg?height=40&width=40", subscribers: "3.1만", views: "297,368", channelId: "mock2" },
        { name: "슬기로운정년", profileUrl: "/placeholder.svg?height=40&width=40", subscribers: "1.6만", views: "136,696", channelId: "mock3" },
        { name: "지혜통", profileUrl: "/placeholder.svg?height=40&width=40", subscribers: "1.1만", views: "2,614", channelId: "mock4" },
        { name: "행복한 전원", profileUrl: "/placeholder.svg?height=40&width=40", subscribers: "3.5만", views: "511", channelId: "mock5" },
      ],
    })
    
    try {
      const response = await fetch(`/api/youtube-channel-analysis?channelId=${channelId}`)
      const channelData = await response.json()

      // API 응답에 error가 있거나 필수 데이터가 없으면 mock 데이터 사용
      if (channelData.error || !channelData.channelTitle) {
        console.log("API 응답 오류, mock 데이터 사용")
        setSelectedChannelData(createMockData())
      } else {
        // API 응답에 누락된 필드가 있으면 기본값 제공
        const completeData: ChannelAnalysisData = {
          channelTitle: channelData.channelTitle || channelTitle,
          channelId: channelData.channelId || channelId,
          profileUrl: channelData.profileUrl || profileUrl,
          subscriberCount: channelData.subscriberCount || "0",
          videoCount: channelData.videoCount || "0개",
          country: channelData.country || "대한민국",
          dailyViews: channelData.dailyViews || "0",
          algorithmScore: channelData.algorithmScore || 60,
          engagement: channelData.engagement || 50,
          activity: channelData.activity || 60,
          subscriberGrowth: channelData.subscriberGrowth || Array.from({ length: 30 }, (_, i) => Math.floor(Math.random() * 1000 + 500 + i * 10)),
          viewsGrowth: channelData.viewsGrowth || Array.from({ length: 30 }, (_, i) => Math.floor(Math.random() * 5000 + 2000 + i * 50)),
          similarChannels: channelData.similarChannels || [],
      }
        setSelectedChannelData(completeData)
      }
      setIsChannelModalOpen(true)
    } catch (error) {
      console.error("채널 분석 데이터 로드 실패:", error)
      // 실패 시 mock 데이터 사용
      setSelectedChannelData(createMockData())
      setIsChannelModalOpen(true)
    }
  }

  const ChannelChart = ({ data, color, height = 60 }: { data: number[]; color: string; height?: number }) => {
    // data가 없거나 빈 배열인 경우 빈 SVG 반환
    if (!data || data.length === 0) {
      return <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} className="overflow-visible" />
    }
    
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1

    const pathData = data
      .map((value, index) => {
        const x = data.length > 1 ? (index / (data.length - 1)) * 100 : 50
        const y = height - ((value - min) / range) * (height - 10)
        return `${index === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ")

    return (
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} className="overflow-visible">
        <path d={pathData} stroke={color} strokeWidth="2" fill="none" className="drop-shadow-sm" />
        {data.map((value, index) => {
          const x = data.length > 1 ? (index / (data.length - 1)) * 100 : 50
          const y = height - ((value - min) / range) * (height - 10)
          return <circle key={index} cx={x} cy={y} r="1.5" fill={color} className="drop-shadow-sm" />
        })}
      </svg>
    )
  }

  const CircularProgress = ({ value, label, color }: { value: number; label: string; color: string }) => {
    const circumference = 2 * Math.PI * 45
    const strokeDasharray = circumference
    const strokeDashoffset = circumference - (value / 100) * circumference

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" stroke="#e5e7eb" strokeWidth="8" fill="none" />
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke={color}
              strokeWidth="8"
              fill="none"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold">{value}</span>
          </div>
        </div>
        <span className="text-sm text-gray-600 mt-2">{label}</span>
      </div>
    )
  }

  const searchVideos = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/youtube-search?q=${encodeURIComponent(searchQuery)}&months=${selectedPeriod}`)
      const data = await response.json()
      
      if (data.error) {
        alert(data.error)
        setVideos([])
      } else {
      setVideos(data.items || [])
      }
    } catch (error) {
      console.error("검색 중 오류 발생:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchVideos()
    }
  }

  const clearSearch = () => {
    setSearchQuery("")
    setVideos([])
    setSelectedVideos([])
  }

  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideos((prev) => (prev.includes(videoId) ? prev.filter((id) => id !== videoId) : [...prev, videoId]))
  }

  const formatViewCount = (count: string) => {
    const num = Number.parseInt(count)
    return num.toLocaleString()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR")
  }

  const extractHashtags = (video: VideoData): string[] => {
    const hashtags = new Set<string>()

    // Extract from tags
    video.tags.slice(0, 5).forEach((tag) => {
      if (tag.length < 20) {
        // Only short, relevant tags
        hashtags.add(tag)
      }
    })

    // Extract hashtags from title and description
    const text = `${video.title} ${video.description}`.toLowerCase()
    const hashtagMatches = text.match(/#[\w가-힣]+/g) || []
    hashtagMatches.slice(0, 3).forEach((tag) => {
      hashtags.add(tag.replace("#", ""))
    })

    // Add some contextual tags based on content
    if (text.includes("건강") || text.includes("운동")) hashtags.add("건강")
    if (text.includes("요리") || text.includes("레시피")) hashtags.add("요리")
    if (text.includes("여행") || text.includes("관광")) hashtags.add("여행")
    if (text.includes("교육") || text.includes("강의")) hashtags.add("교육")
    if (text.includes("리뷰") || text.includes("후기")) hashtags.add("리뷰")

    return Array.from(hashtags).slice(0, 4)
  }

  const openVideoUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const generateViewCountGraph = (viewCount: string, publishedAt: string, videoId: string) => {
    const currentViews = Number.parseInt(viewCount)
    const publishDate = new Date(publishedAt)
    const now = new Date()
    const daysSincePublish = Math.floor((now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24))

    const seed = videoId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const random = (index: number) => {
      const x = Math.sin(seed + index * 1.5) * 10000
      return x - Math.floor(x)
    }

    // 시간별 조회수 증가 패턴 시뮬레이션
    const points = []
    const segments = Math.min(daysSincePublish, 20) // 최대 20개 포인트

    const growthType = seed % 4

    for (let i = 0; i <= segments; i++) {
      const progress = i / segments
      let viewProgress

      switch (growthType) {
        case 0: // 바이럴 패턴 - 초기 급성장 후 완만
          viewProgress = Math.pow(progress, 0.3) + random(i) * 0.1
          break
        case 1: // 꾸준한 성장 패턴
          viewProgress = progress + Math.sin(progress * Math.PI) * 0.2 + random(i) * 0.05
          break
        case 2: // 늦은 성장 패턴 - 후반 급성장
          viewProgress = Math.pow(progress, 1.8) + random(i) * 0.08
          break
        default: // 계단식 성장 패턴
          viewProgress = Math.floor(progress * 5) / 5 + Math.sin(progress * Math.PI * 3) * 0.1 + random(i) * 0.06
      }

      viewProgress = Math.max(0, Math.min(1, viewProgress))
      const views = Math.floor(currentViews * viewProgress)
      points.push(views)
    }

    return points
  }

  const ViewCountChart = ({
    viewCount,
    publishedAt,
    videoId,
  }: { viewCount: string; publishedAt: string; videoId: string }) => {
    const points = generateViewCountGraph(viewCount, publishedAt, videoId)
    const maxViews = Math.max(...points)

    const seed = videoId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const colors = [
      { primary: "#ec4899", secondary: "#f472b6" }, // 핑크
      { primary: "#3b82f6", secondary: "#60a5fa" }, // 블루
      { primary: "#10b981", secondary: "#34d399" }, // 그린
      { primary: "#f59e0b", secondary: "#fbbf24" }, // 앰버
      { primary: "#8b5cf6", secondary: "#a78bfa" }, // 바이올렛
      { primary: "#ef4444", secondary: "#f87171" }, // 레드
    ]
    const colorSet = colors[seed % colors.length]

    const pathData = points
      .map((views, index) => {
        const x = (index / (points.length - 1)) * 100
        const y = 100 - (views / maxViews) * 80 // 80%까지만 사용해서 여백 확보
        return `${index === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ")

    return (
      <div className="w-full h-8 relative">
        <svg width="100%" height="100%" viewBox="0 0 100 100" className="absolute inset-0">
          {/* 배경 그라데이션 */}
          <defs>
            <linearGradient id={`gradient-${videoId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colorSet.primary} stopOpacity="0.3" />
              <stop offset="100%" stopColor={colorSet.primary} stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* 그래프 영역 채우기 */}
          <path d={`${pathData} L 100 100 L 0 100 Z`} fill={`url(#gradient-${videoId})`} />

          {/* 그래프 선 */}
          <path d={pathData} stroke={colorSet.primary} strokeWidth="2" fill="none" className="drop-shadow-sm" />

          {/* 포인트들 */}
          {points.map((views, index) => {
            const x = (index / (points.length - 1)) * 100
            const y = 100 - (views / maxViews) * 80
            return <circle key={index} cx={x} cy={y} r="1.5" fill={colorSet.secondary} className="drop-shadow-sm" />
          })}
        </svg>
      </div>
    )
  }

  const handlePeriodChange = (value: string) => {
    setSelectedPeriod(value)
    setFilters((prev) => ({
      ...prev,
      period: `최근 ${value}개월`,
    }))
  }

  const KeywordChart = ({ keywords }: { keywords: { keyword: string; frequency: number; growth: number }[] }) => {
    const maxFreq = Math.max(...keywords.map((k) => k.frequency))

    return (
      <div className="space-y-3">
        {keywords.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="w-20 text-sm font-medium truncate">{item.keyword}</div>
            <div className="flex-1 relative">
              <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000"
                  style={{ width: `${(item.frequency / maxFreq) * 100}%` }}
                />
              </div>
              <div className="absolute right-2 top-0 h-6 flex items-center">
                <span className="text-xs font-medium text-white">{item.frequency}</span>
              </div>
            </div>
            <div
              className={`text-xs px-2 py-1 rounded ${item.growth > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
            >
              {item.growth > 0 ? "+" : ""}
              {item.growth}%
            </div>
          </div>
        ))}
      </div>
    )
  }

  const ContentTypePieChart = ({ data }: { data: { type: string; percentage: number; avgViews: number }[] }) => {
    const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"]
    let cumulativePercentage = 0

    return (
      <div className="flex items-center gap-6">
        <div className="relative w-32 h-32">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
            {data.map((item, index) => {
              const strokeDasharray = `${item.percentage} ${100 - item.percentage}`
              const strokeDashoffset = -cumulativePercentage
              cumulativePercentage += item.percentage

              return (
                <circle
                  key={index}
                  cx="50"
                  cy="50"
                  r="15.915"
                  fill="transparent"
                  stroke={colors[index % colors.length]}
                  strokeWidth="8"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000"
                />
              )
            })}
          </svg>
        </div>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              <span className="text-sm">{item.type}</span>
              <span className="text-sm font-medium">{item.percentage}%</span>
              <span className="text-xs text-gray-500">({item.avgViews.toLocaleString()}회)</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const PredictionRadarChart = ({ topics }: { topics: { topic: string; score: number; expectedViews: number }[] }) => {
    const maxScore = Math.max(...topics.map((t) => t.score))

    return (
      <div className="space-y-4">
        {topics.map((topic, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{topic.topic}</span>
              <span className="text-sm text-gray-500">{topic.expectedViews.toLocaleString()}회 예상</span>
            </div>
            <div className="relative">
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full transition-all duration-1000"
                  style={{ width: `${(topic.score / maxScore) * 100}%` }}
                />
              </div>
              <div className="absolute right-2 top-0 h-3 flex items-center">
                <span className="text-xs font-bold text-white">{topic.score}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const MetricsChart = ({
    metrics,
  }: { metrics: { metric: string; value: number; trend: "up" | "down" | "stable" }[] }) => {
    return (
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{metric.metric}</span>
              <div
                className={`p-1 rounded-full ${
                  metric.trend === "up" ? "bg-green-100" : metric.trend === "down" ? "bg-red-100" : "bg-gray-100"
                }`}
              >
                <TrendingUp
                  className={`w-3 h-3 ${
                    metric.trend === "up"
                      ? "text-green-600"
                      : metric.trend === "down"
                        ? "text-red-600 rotate-180"
                        : "text-gray-600"
                  }`}
                />
              </div>
            </div>
            <div className="text-2xl font-bold">{metric.value.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">
              {metric.trend === "up" ? "상승 추세" : metric.trend === "down" ? "하락 추세" : "안정적"}
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const performAIAnalysis = async () => {
    if (videos.length === 0) return

    setIsAnalyzing(true)
    setShowAnalysis(true)

    try {
      const response = await fetch("/api/ai-trend-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videos: videos.slice(0, 10), // 상위 10개 영상만 분석
          searchQuery,
          period: selectedPeriod,
        }),
      })

      const data = await response.json()
      setAiAnalysis(data.analysis)

      const structuredData: AIAnalysisData = {
        trendAnalysis: {
          topKeywords: [
            { keyword: "건강", frequency: 45, growth: 12 },
            { keyword: "운동", frequency: 38, growth: 8 },
            { keyword: "다이어트", frequency: 32, growth: -3 },
            { keyword: "요리", frequency: 28, growth: 15 },
            { keyword: "여행", frequency: 24, growth: 5 },
          ],
          contentTypes: [
            { type: "하우투", percentage: 35, avgViews: 125000 },
            { type: "리뷰", percentage: 28, avgViews: 98000 },
            { type: "브이로그", percentage: 20, avgViews: 87000 },
            { type: "교육", percentage: 17, avgViews: 156000 },
          ],
          performanceMetrics: [
            { metric: "평균 조회수", value: 98500, trend: "up" },
            { metric: "참여율", value: 4.2, trend: "up" },
            { metric: "구독 전환율", value: 2.8, trend: "stable" },
            { metric: "평균 시청 시간", value: 245, trend: "down" },
          ],
        },
        predictions: {
          recommendedTopics: [
            { topic: "홈트레이닝 루틴", score: 92, expectedViews: 180000 },
            { topic: "건강한 식단 레시피", score: 88, expectedViews: 165000 },
            { topic: "스트레칭 가이드", score: 85, expectedViews: 145000 },
            { topic: "다이어트 팁", score: 82, expectedViews: 135000 },
          ],
          viewCountPrediction: [
            { range: "10만-20만", probability: 45 },
            { range: "5만-10만", probability: 35 },
            { range: "20만+", probability: 20 },
          ],
          bestUploadTimes: [
            { time: "오후 7-9시", score: 95 },
            { time: "오후 12-2시", score: 88 },
            { time: "오후 5-7시", score: 82 },
          ],
        },
        insights: data.analysis,
      }
      setAiAnalysisData(structuredData)
    } catch (error) {
      console.error("AI 분석 중 오류 발생:", error)
      setAiAnalysis("분석 중 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/">
              <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
                <ArrowLeft className="w-4 h-4" />
                뒤로가기
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
                <Home className="w-4 h-4" />
                홈으로
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">YouTube 트렌드 분석기</h1>
        </div>

        {/* Search Section */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Input
                  type="text"
                  placeholder="키워드를 입력하세요. (예: 시니어 꿀팁)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pr-10"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1개월</SelectItem>
                  <SelectItem value="2">2개월</SelectItem>
                  <SelectItem value="3">3개월</SelectItem>
                  <SelectItem value="4">4개월</SelectItem>
                  <SelectItem value="5">5개월</SelectItem>
                  <SelectItem value="6">6개월</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={searchVideos}
                disabled={isSearching || !searchQuery.trim()}
                className="bg-pink-500 hover:bg-pink-600 text-white px-6"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {videos.length > 0 && (
              <div className="mb-4">
                <Button
                  onClick={performAIAnalysis}
                  disabled={isAnalyzing}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-6"
                >
                  <Brain className="w-4 h-4 mr-2" />
                  {isAnalyzing ? "분석 중..." : "AI 트렌드 분석"}
                </Button>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center text-sm">
              <span className="text-gray-600">검색 옵션</span>
              <Badge variant="secondary" className="bg-pink-100 text-pink-700 border-pink-200">
                🇰🇷 {filters.country}
              </Badge>
              <Badge variant="outline">{filters.category}</Badge>
              <Badge variant="outline">{filters.period}</Badge>
            </div>

            {/* Active Filters */}
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge variant="secondary" className="bg-gray-100">
                국가: {filters.country}
                <X className="w-3 h-3 ml-1" />
              </Badge>
              <Badge variant="secondary" className="bg-gray-100">
                태그들 정렬: 조회수
                <X className="w-3 h-3 ml-1" />
              </Badge>
              <button className="text-sm text-blue-600 hover:underline">모두 지우기</button>
            </div>
          </CardContent>
        </Card>

        {showAnalysis && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Zap className="w-5 h-5 text-purple-500" />
                <h3 className="text-xl font-bold">AI 트렌드 분석 대시보드</h3>
              </div>

              {isAnalyzing ? (
                <div className="space-y-4">
                  <div className="relative">
                    <div className="text-center mb-4">
                      <div className="inline-flex items-center gap-2 text-purple-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                        <span>데이터를 분석하고 있습니다...</span>
                      </div>
                    </div>

                    {/* 스캔 애니메이션 바 */}
                    <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-pulse"
                        style={{
                          width: "100%",
                          animation: "scan 2s ease-in-out infinite",
                        }}
                      ></div>
                    </div>

                    <div className="mt-2 text-sm text-gray-600 text-center">
                      영상 데이터 스캔 중... ({videos.length}개 영상 분석)
                    </div>
                  </div>

                  <style jsx>{`
                    @keyframes scan {
                      0% { transform: translateX(-100%); }
                      50% { transform: translateX(0%); }
                      100% { transform: translateX(100%); }
                    }
                  `}</style>
                </div>
              ) : aiAnalysisData ? (
                <div className="space-y-8">
                  {/* 트렌드 분석 섹션 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <BarChart3 className="w-5 h-5 text-blue-500" />
                          <h4 className="text-lg font-semibold">인기 키워드 분석</h4>
                        </div>
                        <KeywordChart keywords={aiAnalysisData.trendAnalysis.topKeywords} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <PieChart className="w-5 h-5 text-green-500" />
                          <h4 className="text-lg font-semibold">콘텐츠 타입 분포</h4>
                        </div>
                        <ContentTypePieChart data={aiAnalysisData.trendAnalysis.contentTypes} />
                      </CardContent>
                    </Card>
                  </div>

                  {/* 성과 지표 */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Activity className="w-5 h-5 text-purple-500" />
                        <h4 className="text-lg font-semibold">핵심 성과 지표</h4>
                      </div>
                      <MetricsChart metrics={aiAnalysisData.trendAnalysis.performanceMetrics} />
                    </CardContent>
                  </Card>

                  {/* 예측 및 추천 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Target className="w-5 h-5 text-orange-500" />
                          <h4 className="text-lg font-semibold">추천 주제 & 예상 조회수</h4>
                        </div>
                        <PredictionRadarChart topics={aiAnalysisData.predictions.recommendedTopics} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Eye className="w-5 h-5 text-red-500" />
                          <h4 className="text-lg font-semibold">조회수 예측 분포</h4>
                        </div>
                        <div className="space-y-3">
                          {aiAnalysisData.predictions.viewCountPrediction.map((pred, index) => (
                            <div key={index} className="flex items-center gap-3">
                              <div className="w-24 text-sm font-medium">{pred.range}</div>
                              <div className="flex-1 relative">
                                <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-red-400 to-orange-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${pred.probability}%` }}
                                  />
                                </div>
                                <div className="absolute right-2 top-0 h-6 flex items-center">
                                  <span className="text-xs font-medium text-white">{pred.probability}%</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-6">
                          <h5 className="text-sm font-semibold mb-3">최적 업로드 시간</h5>
                          <div className="space-y-2">
                            {aiAnalysisData.predictions.bestUploadTimes.map((time, index) => (
                              <div key={index} className="flex justify-between items-center">
                                <span className="text-sm">{time.time}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500 rounded-full"
                                      style={{ width: `${time.score}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-medium">{time.score}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* AI 인사이트 */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Brain className="w-5 h-5 text-indigo-500" />
                        <h4 className="text-lg font-semibold">AI 인사이트 & 전략 제안</h4>
                      </div>
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-200">
                        <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                          {aiAnalysisData.insights}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {videos.length === 0 && !isSearching && (
          <div className="text-center py-16">
            <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-600 mb-2">분석할 키워드를 검색하세요</h3>
            <p className="text-gray-500">관심 있는 주제의 유튜브 트렌드를 확인할 수 있습니다.</p>
          </div>
        )}

        {isSearching && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
            <p className="text-gray-600">검색 중...</p>
          </div>
        )}

        {videos.length > 0 && (
          <Card>
            <CardContent className="p-0">
              {/* Tab Header */}
              <div className="border-b">
                <div className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <span className="text-pink-600 font-medium border-b-2 border-pink-600 pb-2">일반</span>
                  </div>
                </div>
              </div>

              {/* Table Header */}
              <div className="px-6 py-4 border-b bg-gray-50">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-600">
                  <div className="col-span-1">
                    <input type="checkbox" className="rounded" />
                  </div>
                  <div className="col-span-1">#</div>
                  <div className="col-span-1">업로드 일자</div>
                  <div className="col-span-1">썸네일</div>
                  <div className="col-span-4">제목</div>
                  <div className="col-span-2">알고리즘 우수도</div>
                  <div className="col-span-1">조회수</div>
                  <div className="col-span-1">조회수 그래프</div>
                </div>
              </div>

              <div className="divide-y">
                {videos.map((video, index) => (
                  <div key={video.id} className="px-6 py-4 hover:bg-gray-50">
                    {/* Table Row */}
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-1">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedVideos.includes(video.id)}
                          onChange={() => toggleVideoSelection(video.id)}
                        />
                      </div>
                      <div className="col-span-1 text-sm text-gray-600">{index + 1}</div>
                      <div className="col-span-1 text-sm text-gray-600">{formatDate(video.publishedAt)}</div>
                      <div className="col-span-1">
                        <div className="relative overflow-visible">
                          <img
                            src={video.thumbnailUrl || "/placeholder.svg"}
                            alt={video.title}
                            className="w-16 h-10 object-cover rounded transition-transform duration-300 hover:scale-[10] hover:z-50 cursor-pointer shadow-sm hover:shadow-xl"
                            onClick={() => openVideoUrl(video.url)}
                          />
                        </div>
                      </div>
                      <div className="col-span-4">
                        <div>
                          <h4
                            className="font-medium text-sm line-clamp-2 mb-2 cursor-pointer hover:text-blue-600 hover:underline flex items-center gap-1"
                            onClick={() => openVideoUrl(video.url)}
                          >
                            {video.title}
                            <ExternalLink className="w-3 h-3 opacity-50" />
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {extractHashtags(video).map((tag, tagIndex) => (
                              <Badge key={tagIndex} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <img
                              src={video.channelProfileUrl || "/placeholder.svg?height=24&width=24"}
                              alt={`${video.channelTitle} 프로필`}
                              className="w-6 h-6 rounded-full object-cover"
                              onError={(e) => {
                                // Fallback to User icon if image fails to load
                                const target = e.target as HTMLImageElement
                                target.style.display = "none"
                                target.nextElementSibling?.classList.remove("hidden")
                              }}
                            />
                            <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center hidden">
                              <User className="w-3 h-3 text-gray-600" />
                            </div>
                            <div>
                              <div
                                className="text-xs font-medium cursor-pointer hover:text-blue-600 hover:underline"
                                onClick={() =>
                                  handleChannelClick(video.channelTitle, video.channelId, video.channelProfileUrl)
                                }
                              >
                                {video.channelTitle}
                              </div>
                              <div className="text-xs text-gray-500">{Math.floor(Math.random() * 50) + 1}만명</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-green-600">
                            {Math.floor(Math.random() * 40) + 60} 매우 높음
                          </span>
                        </div>
                      </div>
                      <div className="col-span-1 text-sm font-medium">{formatViewCount(video.viewCount)}</div>
                      <div className="col-span-1">
                        <ViewCountChart
                          viewCount={video.viewCount}
                          publishedAt={video.publishedAt}
                          videoId={video.id}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={isChannelModalOpen} onOpenChange={setIsChannelModalOpen}>
          <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <img
                  src={selectedChannelData?.profileUrl || "/placeholder.svg?height=40&width=40"}
                  alt="채널 프로필"
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <div className="text-xl font-bold">{selectedChannelData?.channelTitle}</div>
                  <div className="text-sm text-gray-500 font-normal">채널 분석</div>
                </div>
              </DialogTitle>
            </DialogHeader>

            {selectedChannelData && (
              <div className="space-y-6">
                {/* 채널 기본 정보 */}
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Users className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                      <div className="text-2xl font-bold">{selectedChannelData.subscriberCount}</div>
                      <div className="text-sm text-gray-500">구독자 수</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Eye className="w-6 h-6 mx-auto mb-2 text-green-500" />
                      <div className="text-2xl font-bold">{selectedChannelData.videoCount}</div>
                      <div className="text-sm text-gray-500">동영상 수</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <BarChart3 className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                      <div className="text-2xl font-bold">{selectedChannelData.dailyViews}</div>
                      <div className="text-sm text-gray-500">일일 평균 조회수</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Star className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
                      <div className="text-2xl font-bold">{selectedChannelData.country}</div>
                      <div className="text-sm text-gray-500">국가</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Performance 요약 */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Performance 요약</h3>
                    <div className="grid grid-cols-4 gap-8">
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">{selectedChannelData.dailyViews}</div>
                        <div className="text-sm text-gray-500 mb-4">일일 평균 조회수 (조회)</div>
                      </div>
                      <CircularProgress
                        value={selectedChannelData.algorithmScore}
                        label="채널 알고리즘 스코어"
                        color="#22c55e"
                      />
                      <CircularProgress value={selectedChannelData.engagement} label="참여도" color="#eab308" />
                      <CircularProgress value={selectedChannelData.activity} label="활성도" color="#22c55e" />
                    </div>
                  </CardContent>
                </Card>

                {/* 구독자 수 변화 및 유사 채널 */}
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-4">구독자 수 변화</h3>
                      <div className="mb-4">
                        <div className="flex gap-4 text-sm">
                          <span className="text-red-500">3개월</span>
                          <span className="text-gray-400">1년</span>
                          <span className="text-gray-400">전체</span>
                        </div>
                      </div>
                      <div className="h-32">
                        <ChannelChart data={selectedChannelData.subscriberGrowth || []} color="#ec4899" height={120} />
                      </div>
                      <div className="mt-4 text-center">
                        <div className="text-sm text-gray-500">채널 구독자 상승률</div>
                        <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                          <div>
                            3개월
                            <br />-
                          </div>
                          <div>
                            6개월
                            <br />-
                          </div>
                          <div>
                            1년
                            <br />-
                          </div>
                          <div>
                            3년
                            <br />-
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-4">유사 채널</h3>
                      <div className="space-y-3">
                        {(selectedChannelData.similarChannels || []).map((channel, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                            onClick={() =>
                              handleChannelClick(
                                channel.name,
                                channel.channelId || `similar-${index}`,
                                channel.profileUrl,
                              )
                            }
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={channel.profileUrl || "/placeholder.svg"}
                                alt={channel.name}
                                className="w-8 h-8 rounded-full"
                              />
                              <div>
                                <div className="font-medium text-sm hover:text-blue-600">{channel.name}</div>
                                <div className="text-xs text-gray-500">구독자 {channel.subscribers}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">{channel.subscribers}</div>
                              <div className="text-xs text-gray-500">{channel.views}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 일일 조회수 변화 */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">일일 조회수 변화</h3>
                    <div className="mb-4">
                      <div className="flex gap-4 text-sm">
                        <span className="text-red-500">3개월</span>
                        <span className="text-gray-400">1년</span>
                        <span className="text-gray-400">전체</span>
                      </div>
                    </div>
                    <div className="h-40">
                      <ChannelChart data={selectedChannelData.viewsGrowth || []} color="#ec4899" height={150} />
                    </div>
                    <div className="text-right mt-2">
                      <span className="text-sm text-red-500">10.5%</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

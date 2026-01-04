"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Lightbulb,
  FileText,
  Wand2,
  User,
  Video,
  Type,
  MessageSquare,
  ArrowLeft,
  Play,
  Download,
  Sparkles,
  Clock,
  Target,
  Copy,
  CheckCircle,
  ImageIcon,
  BarChart3,
  Check,
  Loader2,
  Volume2,
  Pause,
  Upload,
  Home,
  TrendingUp,
  ExternalLink,
  Zap,
  Newspaper,
  X,
  Scissors,
  Settings,
  Youtube,
  Calendar,
} from "lucide-react"
import Link from "next/link"
import {
  generateTopics,
  generateTrendingTopics,
  generateScriptPlan,
  generateScriptDraft,
  generateFinalScript,
  improveScriptPlan,
  analyzeScriptPlan,
  generateFullScript, // Gemini API 대본 생성 함수 import 추가
  generateYouTubeTitles, // 유튜브 제목 생성 함수 import 추가
  generateThumbnailText, // 썸네일 텍스트 생성 함수 import 추가
  extractKeywordsFromScript, // 대본에서 키워드 추출 함수 import 추가
  generateDoctorImage,
  generateYouTubeDescription,
  generateImagePrompt, // 이미지 프롬프트 생성 함수 import 추가
  generateImageWithReplicate, // Replicate 이미지 생성 함수 import 추가
  generateAIThumbnail, // AI 썸네일 생성 함수 import 추가
  summarizeScriptForShorts, // 쇼츠 대본 요약 함수 import 추가
} from "./actions"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getApiKey } from "@/lib/api-keys"
import { generateShortsHookingTitle } from "../shorts/actions"

// <-- FFmpeg imports 제거 -->

const AIGeneratingAnimation = ({ type }: { type: string }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
        <div className="relative mb-6">
          {/* 중앙 AI 아이콘 */}
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white animate-pulse" />
          </div>

          {/* 회전하는 원들 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 border-2 border-blue-200 rounded-full animate-spin">
              <div
                className="w-4 h-4 bg-blue-500 rounded-full animate-bounce"
                style={{ marginTop: "-8px", marginLeft: "40px" }}
              ></div>
            </div>
          </div>

          {/* 떠다니는 파티클들 */}
          <div className="absolute inset-0">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-ping"
                style={{
                  left: `${20 + i * 15}%`,
                  top: `${30 + (i % 2) * 40}%`,
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: "2s",
                }}
              ></div>
            ))}
          </div>
        </div>

        <h3 className="text-xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          AI가 {type}{type === "맞춤 주제" ? "를" : "을"} 생성하고 있습니다
        </h3>
        <p className="text-gray-600 mb-4">고급 AI 모델이 최적의 결과를 만들어내고 있어요</p>

        <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full progress-bar-loading"></div>
        </div>

        {/* 타이핑 효과 */}
        <div className="flex justify-center space-x-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.1}s` }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  )
}

const sidebarItems = [
  { id: "topic", title: "주제 추천", icon: Lightbulb, description: "60대 시니어층 맞춤 주제 추천" },
  { id: "planning", title: "대본 기획 및 초안", icon: FileText, description: "선택한 주제 기반 대본 구조 설계" },
  { id: "script", title: "대본 생성", icon: Wand2, description: "20분 분량의 대본 자동 생성" },
  { id: "image", title: "이미지 생성", icon: User, description: "한국 인물 생성" },
  { id: "video", title: "TTS 생성", icon: Volume2, description: "텍스트를 음성으로 변환" },
  { id: "render", title: "영상 렌더링", icon: Video, description: "이미지 + 음성 + 자막 합성" },
  { id: "title", title: "제목/설명 생성", icon: Type, description: "최적화된 유튜브 제목 자동 생성" },
  { id: "thumbnail", title: "썸네일 생성기", icon: ImageIcon, description: "클릭률 높은 썸네일 디자인 생성" },
  { id: "shorts", title: "쇼츠 생성기", icon: Scissors, description: "롱폼 대본을 쇼츠 영상으로 변환" },
]

const parseAnalysisForCharts = (analysis: string) => {
  // 기본 점수 데이터 (실제로는 AI 분석 결과에서 추출)
  const qualityScores = [
    { category: "구조", score: Math.floor(Math.random() * 15) + 85, maxScore: 100 },
    { category: "흥미도", score: Math.floor(Math.random() * 12) + 88, maxScore: 100 },
    { category: "정보성", score: Math.floor(Math.random() * 10) + 90, maxScore: 100 },
    { category: "시청 유지", score: Math.floor(Math.random() * 18) + 82, maxScore: 100 },
    { category: "호출 행동", score: Math.floor(Math.random() * 20) + 80, maxScore: 100 },
  ]

  const improvementAreas = [
    { area: "인트로 개선", priority: Math.floor(Math.random() * 15) + 85 },
    { area: "스토리텔링", priority: Math.floor(Math.random() * 12) + 88 },
    { area: "시각적 요소", priority: Math.floor(Math.random() * 10) + 90 },
    { area: "마무리 강화", priority: Math.floor(Math.random() * 18) + 82 },
  ]

  const expectedMetrics = [
    { metric: "예상 조회수", value: Math.floor(Math.random() * 100000) + 50000, unit: "회" },
    { metric: "시청 시간", value: Math.floor(Math.random() * 7) + 8, unit: "분" },
    { metric: "참여율", value: Math.floor(Math.random() * 7) + 5, unit: "%" },
    { metric: "구독 전환", value: Math.floor(Math.random() * 5) + 3, unit: "%" },
  ]

  return { qualityScores, improvementAreas, expectedMetrics }
}

// cleanTitle 함수 추가
const cleanTitle = (title: string) => {
  return title
    .trim()
    .replace(/^\d+\.\s*/, "") // 숫자 제거
    .replace(/^\[.*?\]\s*/, "") // [경고형], [질문형] 등 태그 제거
    .replace(/^【.*?】\s*/, "") // 【】 형태 태그 제거
    .replace(/^$$.*?$$\s*/, "") // () 형태 태그 제거
    .trim()
}

type AutoImage = {
  id: string
  url: string
  keyword: string
  startTime: number
  endTime: number
  motion: "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "static"
}

export default function LongformContentPage() {
  // <-- CHANGE: Component name changed
  const [activeStep, setActiveStep] = useState("topic")
  
  // API 키 가져오기 헬퍼 함수
  const getApiKey = (keyName?: string) => {
    if (typeof window === "undefined") return undefined
    if (keyName) {
      return localStorage.getItem(keyName) || undefined
    }
    return localStorage.getItem("openai_api_key") || undefined
  }
  const [keywords, setKeywords] = useState("")
  const [selectedTopic, setSelectedTopic] = useState("")
  const [generatedTopics, setGeneratedTopics] = useState<string[]>([])
  const [trendingTopics, setTrendingTopics] = useState<Array<{ title: string; videoId: string }>>([])
  const [isLoadingTrending, setIsLoadingTrending] = useState(false)
  const [selectedTrendingVideoId, setSelectedTrendingVideoId] = useState<string | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [isAnalyzingTopic, setIsAnalyzingTopic] = useState(false)
  const [topicAnalysisResult, setTopicAnalysisResult] = useState<{
    videoInfo: {
      title: string
      description: string
      viewCount: string
      likeCount: string
      videoId: string
      thumbnailUrl: string
    }
    analysis: {
      mainTopic: string
      recommendedTopics: string[]
    }
  } | null>(null)
  const [crawledNews, setCrawledNews] = useState<Array<{ title: string; link: string; description: string }>>([])
  const [isCrawlingNews, setIsCrawlingNews] = useState(false)
  const [customTopic, setCustomTopic] = useState("")
  const [isCustomTopicSelected, setIsCustomTopicSelected] = useState(false)
  const [script, setScript] = useState("")
  const [scriptLines, setScriptLines] = useState<Array<{ id: number; text: string }>>([])
  const [selectedLineIds, setSelectedLineIds] = useState<Set<number>>(new Set())
  const [scriptDuration, setScriptDuration] = useState<number>(20) // 대본 시간 (분)
  const [generatedImages, setGeneratedImages] = useState<Array<{ lineId: number; imageUrl: string; prompt: string; order?: number; isUserUploaded?: boolean }>>([])
  const [isGeneratingImages, setIsGeneratingImages] = useState(false)
  const [imageGenerationProgress, setImageGenerationProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("jB1Cifc2UQbq1gR3wnb0") // 기본: Rachel
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null)
  const [generatedAudios, setGeneratedAudios] = useState<Array<{ lineId: number; audioUrl: string; audioBase64: string }>>([])
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false)
  const [ttsGenerationProgress, setTtsGenerationProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [customScript, setCustomScript] = useState("")
  const [scriptPlan, setScriptPlan] = useState("")
  const [scriptDraft, setScriptDraft] = useState("")
  const [generatedImage, setGeneratedImage] = useState("")
  const [doctorPrompt, setDoctorPrompt] = useState("")
  const [youtubeTitle, setYoutubeTitle] = useState("")
  const [youtubeDescription, setYoutubeDescription] = useState<{
    description: string
    pinnedComment: string
    hashtags: string
    uploadTags: string[]
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [improvementRequest, setImprovementRequest] = useState("")
  const [analysisResult, setAnalysisResult] = useState("")
  const [showDirectScriptInput, setShowDirectScriptInput] = useState(false)
  const [directScript, setDirectScript] = useState("")
  const [selectedDoctorType, setSelectedDoctorType] = useState<"clinic" | "podcast" | "custom">("clinic")
  const [customDescription, setCustomDescription] = useState("")
  const [doctorKoreanDescription, setDoctorKoreanDescription] = useState("")
  const [userTtsApiKey, setUserTtsApiKey] = useState("")
  const [selectedVoice] = useState("ko-KR-Neural2-B")
  const [videoData, setVideoData] = useState<{
    audioUrl: string
    subtitles: Array<{ id: number; start: number; end: number; text: string }>
    duration: number
    autoImages?: Array<{
      id: string
      url: string
      startTime: number
      endTime: number
      keyword: string
      motion?: string
    }>
  } | null>(null)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [currentSubtitle, setCurrentSubtitle] = useState("")
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)
  const [audioTrackElements, setAudioTrackElements] = useState<Map<string, HTMLAudioElement>>(new Map()) // 효과음 및 배경음악 오디오 요소
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([])
  const [selectedTitle, setSelectedTitle] = useState<string>("")
  const [customTitle, setCustomTitle] = useState("")
  const [referenceTitle, setReferenceTitle] = useState("")
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false)
  const [thumbnailText, setThumbnailText] = useState<string[]>([])
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false)
  const [thumbnailMode, setThumbnailMode] = useState<"manual" | "ai">("manual") // 썸네일 생성 모드
  const [aiThumbnailUrl, setAiThumbnailUrl] = useState<string | null>(null) // AI 생성 썸네일 URL
  const [isGeneratingAIThumbnail, setIsGeneratingAIThumbnail] = useState(false) // AI 썸네일 생성 중 상태
  const [selectedThumbnailTemplate, setSelectedThumbnailTemplate] = useState<string | null>(null) // 선택된 썸네일 템플릿
  const [thumbnailBackgroundImage, setThumbnailBackgroundImage] = useState<string | null>(null) // 썸네일 배경 이미지
  const [thumbnailOverlayImage, setThumbnailOverlayImage] = useState<string | null>(null) // 썸네일 오버레이 이미지 (선택 가능한 이미지)
  const [overlayImageSize, setOverlayImageSize] = useState({ width: 50, height: 50 }) // 오버레이 이미지 크기 (%)
  const [overlayImagePosition, setOverlayImagePosition] = useState({ x: 50, y: 50 }) // 오버레이 이미지 위치 (%)
  const [selectedTextIndex, setSelectedTextIndex] = useState<number | null>(null)
  const [textPositions, setTextPositions] = useState<Array<{ x: number; y: number }>>([
    { x: 8, y: 25 },
    { x: 8, y: 40 },
    { x: 8, y: 55 },
    { x: 8, y: 70 },
  ])
  const [suggestedTexts, setSuggestedTexts] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [editingText, setEditingText] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  // 자동화 모드 상태
  const [workflowMode, setWorkflowMode] = useState<"auto" | "manual" | null>(null) // null = 선택 안함
  const [isAutoRunning, setIsAutoRunning] = useState(false)
  const [autoProgress, setAutoProgress] = useState<{
    step: number
    totalSteps: number
    currentStepName: string
    message: string
    isComplete: boolean
  }>({
    step: 0,
    totalSteps: 9,
    currentStepName: "",
    message: "",
    isComplete: false,
  })
  // 기존 자동화 모드 상태 (호환성 유지)
  const [isAutoMode, setIsAutoMode] = useState(false)
  const [autoModeStep, setAutoModeStep] = useState<string>("")
  const [autoModeProgress, setAutoModeProgress] = useState<{ current: string; total: number }>({ current: "", total: 7 })
  // 유튜브 업로드 관련 상태 (추후 구현)
  const [youtubeScheduleDate, setYoutubeScheduleDate] = useState<string>("")
  const [youtubeScheduleTime, setYoutubeScheduleTime] = useState<string>("18:00")
  const [isReadyForUpload, setIsReadyForUpload] = useState(false)
  const [showScheduleSelector, setShowScheduleSelector] = useState(false) // 업로드 일자 선택 UI 표시
  
  // 영상 효과 설정
  const [introVideo, setIntroVideo] = useState<string | null>(null) // 앞부분 10초 동영상
  const [logoImage, setLogoImage] = useState<string | null>(null) // 우측 상단 로고
  const [logoSize, setLogoSize] = useState(120) // 로고 크기 (px)
  const [logoPositionX, setLogoPositionX] = useState(95) // 로고 X 위치 (% - 우측에서)
  const [logoPositionY, setLogoPositionY] = useState(5) // 로고 Y 위치 (% - 상단에서)
  const [enableZoom, setEnableZoom] = useState(true) // 줌인 효과 활성화
  const introVideoRef = useRef<HTMLVideoElement | null>(null) // 앞부분 동영상 ref
  
  // 로고 드래그 및 리사이즈 상태
  const [isLogoSelected, setIsLogoSelected] = useState(false) // 로고 선택 상태
  const [isDraggingLogo, setIsDraggingLogo] = useState(false)
  const [isResizingLogo, setIsResizingLogo] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string>("") // 리사이즈 방향 (n, s, e, w, ne, nw, se, sw)
  const [logoDragStart, setLogoDragStart] = useState({ x: 0, y: 0, startX: 0, startY: 0 })
  const [logoResizeStart, setLogoResizeStart] = useState({ 
    size: 0, 
    startX: 0, 
    startY: 0, 
    startSize: 0,
    startPositionX: 0,
    startPositionY: 0,
  })
  
  // 쇼츠 생성기 상태
  const [shortsDuration, setShortsDuration] = useState<1 | 2 | 3>(1) // 쇼츠 길이 (1분, 2분, 3분)
  const [summarizedScript, setSummarizedScript] = useState<string>("") // 요약된 대본
  const [isSummarizingScript, setIsSummarizingScript] = useState(false) // 대본 요약 중
  const [shortsScriptLines, setShortsScriptLines] = useState<Array<{ id: number; text: string; startTime: number; endTime: number }>>([]) // 쇼츠 대본 라인
  const [shortsHookingTitle, setShortsHookingTitle] = useState<{ line1: string; line2: string } | null>(null) // 쇼츠 제목
  const [isGeneratingShortsTitle, setIsGeneratingShortsTitle] = useState(false) // 쇼츠 제목 생성 중
  const [shortsTtsAudioUrl, setShortsTtsAudioUrl] = useState<string>("") // 쇼츠 TTS 오디오 URL
  const [isGeneratingShortsTts, setIsGeneratingShortsTts] = useState(false) // 쇼츠 TTS 생성 중
  const [shortsVideoUrl, setShortsVideoUrl] = useState<string>("") // 쇼츠 영상 URL
  const [isRenderingShorts, setIsRenderingShorts] = useState(false) // 쇼츠 영상 렌더링 중
  const shortsCanvasRef = useRef<HTMLCanvasElement>(null) // 쇼츠 캔버스 ref
  const shortsVideoRef = useRef<HTMLVideoElement>(null) // 쇼츠 비디오 ref
  const shortsAnimationFrameRef = useRef<number | null>(null) // 쇼츠 애니메이션 프레임 ref
  const shortsPreviewAudio = useRef<HTMLAudioElement | null>(null) // 쇼츠 미리보기 오디오 ref
  const [isPlayingShorts, setIsPlayingShorts] = useState(false) // 쇼츠 재생 중
  const [shortsCurrentTime, setShortsCurrentTime] = useState(0) // 쇼츠 현재 시간
  const [testImageFile, setTestImageFile] = useState<File | null>(null) // 테스트용 이미지 파일
  const [testImageUrl, setTestImageUrl] = useState<string | null>(null) // 테스트용 이미지 URL
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  
  // 역사 카테고리 스타일 선택 (애니메이션/실사)
  const [historyStyle, setHistoryStyle] = useState<"animation" | "realistic">("animation")
  
  // 이미지 커스텀 생성 상태
  const [customImageDialogOpen, setCustomImageDialogOpen] = useState<number | null>(null)
  const [customImagePrompt, setCustomImagePrompt] = useState("")
  const [isGeneratingCustomImage, setIsGeneratingCustomImage] = useState(false)
  const [hoveredImageId, setHoveredImageId] = useState<number | null>(null)
  const [selectedImagesForVideo, setSelectedImagesForVideo] = useState<Set<number>>(new Set()) // 영상으로 변환할 이미지 선택
  const [isConvertingToVideo, setIsConvertingToVideo] = useState(false) // 영상 변환 중 상태
  const [convertedVideos, setConvertedVideos] = useState<Map<number, string>>(new Map()) // 변환된 영상 URL 저장
  
  // 효과음 및 배경음악 설정
  type AudioTrack = {
    id: string
    type: "sound_effect" | "background_music"
    file: File
    url: string
    startTime: number // 시작 시간 (초)
    endTime: number // 끝 시간 (초)
    volume: number // 볼륨 (0-1)
  }
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]) // 효과음 및 배경음악 목록
  const [draggingAudioTrack, setDraggingAudioTrack] = useState<string | null>(null) // 드래그 중인 오디오 트랙 ID
  const [resizingAudioTrack, setResizingAudioTrack] = useState<{ id: string; side: "left" | "right" } | null>(null) // 리사이즈 중인 오디오 트랙
  const [audioTrackDragStart, setAudioTrackDragStart] = useState<{ id: string; startX: number; startTime: number } | null>(null) // 드래그 시작 위치
  const [audioTrackResizeStart, setAudioTrackResizeStart] = useState<{ id: string; side: "left" | "right"; startX: number; startTime: number; endTime: number } | null>(null) // 리사이즈 시작 위치
  
  const [textStyles, setTextStyles] = useState<
    Array<{
      color: string
      fontSize: number
      fontWeight: string
      textShadow: string
      stroke: string
      letterSpacing: number
      backgroundColor?: string
      strokeWidth?: number
      strokeColor?: string
    }>
  >([
    {
      color: "#B8860B",
      fontSize: 120,
      fontWeight: "900",
      textShadow: "none",
      stroke: "none",
      letterSpacing: -2,
      backgroundColor: "transparent",
      strokeWidth: 0,
      strokeColor: "#000000",
    },
    {
      color: "#FFFFFF",
      fontSize: 120,
      fontWeight: "900",
      textShadow: "none",
      stroke: "none",
      letterSpacing: -2,
      backgroundColor: "transparent",
      strokeWidth: 0,
      strokeColor: "#000000",
    },
    {
      color: "#2E8B57",
      fontSize: 120,
      fontWeight: "900",
      textShadow: "none",
      stroke: "none",
      letterSpacing: -2,
      backgroundColor: "transparent",
      strokeWidth: 0,
      strokeColor: "#000000",
    },
    {
      color: "#8B0000",
      fontSize: 120,
      fontWeight: "900",
      textShadow: "none",
      stroke: "none",
      letterSpacing: -2,
      backgroundColor: "transparent",
      strokeWidth: 0,
      strokeColor: "#000000",
    },
  ])
  const [doctorImagePosition, setDoctorImagePosition] = useState({ x: 75, y: 0 })
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [selectedImageElement, setSelectedImageElement] = useState(false)
  const [gradientMask, setGradientMask] = useState({
    direction: "from-black via-black/50 to-transparent",
    opacity: 0.9,
  })
  const [generatedThumbnails, setGeneratedThumbnails] = useState<string[]>([])
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState(0)
  const [isAIReviewing, setIsAIReviewing] = useState(false)
  const [aiReviewResult, setAiReviewResult] = useState<{
    videoAnalysis: string
    titleAnalysis: string
    contentAnalysis: string
    improvements: string[]
    overallScore: number
    expectedViews: number
    expectedLikes: number
    subscriberGrowth: number
    engagementRate: number
  } | null>(null)
  const [selectedVideoForAnalysis, setSelectedVideoForAnalysis] = useState<string | null>(null)
  const [selectedTitleForAnalysis, setSelectedTitleForAnalysis] = useState<string | null>(null)
  const [selectedThumbnailForAnalysis, setSelectedThumbnailForAnalysis] = useState<string | null>(null)
  const [autoImages, setAutoImages] = useState<AutoImage[]>([])
  const [isLoadingAutoImages, setIsLoadingAutoImages] = useState(false)
  const [generatingVideoProgress, setGeneratingVideoProgress] = useState(0)
  // <-- New state variables for FFmpeg export -->
  // const [exportProgress, setExportProgress] = useState(0)
  // const [exportStatus, setExportStatus] = useState("")
  // const ffmpegRef = useRef<FFmpeg | null>(null)
  // const [ffmpegLoaded, setFfmpegLoaded] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  // <-- End of new state variables -->

  // 카테고리 타입 정의
  const [selectedCategory, setSelectedCategory] = useState<
    | "wisdom"
    | "religion"
    | "health"
    | "domestic_story"
    | "international_story"
    | "romance_of_three_kingdoms"
    | "folktale"
    | "science"
    | "history"
    | "horror"
    | "society"
    | "northkorea"
    | "space"
    | "self_improvement"
    | "economy"
    | "war"
    | "affair"
    | "ancient"
    | "biology"
    | "greek_roman_mythology"
    | "death"
    | "ai"
    | "alien"
    | "palmistry"
    | "physiognomy"
    | "fortune_telling"
    | "urban_legend"
    | "serial_crime"
    | "unsolved_case"
    | "reserve_army"
    | "elementary_school"
  >("health")
  
  // 기본 주제/틈새 주제 토글 상태
  const [showBasicCategories, setShowBasicCategories] = useState(false)

  const isStepActive = (stepId: string) => activeStep === stepId
  const isStepCompleted = (stepId: string) => completedSteps.includes(stepId)

  useEffect(() => {
    const savedApiKey = localStorage.getItem("user_tts_api_key")
    if (savedApiKey) {
      setUserTtsApiKey(savedApiKey)
    }
  }, [])

  // 일주일간 인기 주제 로드 함수
  const loadTrendingTopics = async () => {
    if (!selectedCategory) {
      alert("카테고리를 먼저 선택해주세요.")
      return
    }
    
    setIsLoadingTrending(true)
    try {
      const apiKey = getApiKey()
      const topics = await generateTrendingTopics(selectedCategory, apiKey)
      // string[]을 { title: string; videoId: string }[] 형식으로 변환
      // topics가 문자열 배열인지 확인하고 안전하게 처리
      const formattedTopics = topics.map((item, idx) => {
        // item이 문자열인 경우
        if (typeof item === 'string') {
          return { title: item, videoId: `topic_${Date.now()}_${idx}_${Math.random()}` }
        }
        // item이 객체인 경우 (이미 title 속성이 있을 수 있음)
        if (typeof item === 'object' && item !== null) {
          const title = (item as any).title || String(item)
          return { title, videoId: `topic_${Date.now()}_${idx}_${Math.random()}` }
        }
        // 그 외의 경우 문자열로 변환
        return { title: String(item), videoId: `topic_${Date.now()}_${idx}_${Math.random()}` }
      })
      setTrendingTopics(formattedTopics)
    } catch (error) {
      console.error("인기 주제 로드 실패:", error)
      setTrendingTopics([])
      alert("인기 주제를 불러오는데 실패했습니다.")
    } finally {
      setIsLoadingTrending(false)
    }
  }

  const handleSaveApiKey = () => {
    if (userTtsApiKey.trim()) {
      localStorage.setItem("user_tts_api_key", userTtsApiKey.trim())
      alert("API 키가 저장되었습니다.")
    }
  }

  // 주제 목록으로 스크롤하기 위한 ref
  const generatedTopicsRef = useRef<HTMLDivElement>(null)

  // ============================================
  // 자동화 모드 파이프라인 함수
  // ============================================
  const runAutomationPipeline = async () => {
    if (!selectedTopic) {
      alert("주제를 먼저 선택해주세요.")
      return
    }

    setIsAutoRunning(true)
    setAutoProgress({
      step: 0,
      totalSteps: 9,
      currentStepName: "시작",
      message: "자동화 파이프라인을 시작합니다...",
      isComplete: false,
    })

    const apiKey = localStorage.getItem("openai_api_key") || undefined
    const replicateApiKey = localStorage.getItem("replicate_api_key") || undefined
    const elevenlabsApiKey = localStorage.getItem("elevenlabs_api_key") || undefined

    if (!apiKey) {
      alert("OpenAI API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      setIsAutoRunning(false)
      return
    }

    try {
      // 자동화용 영상 길이 설정 (테스트: 5분)
      const autoDurationMinutes = 5

      // Step 1: 대본 기획 생성
      setAutoProgress({
        step: 1,
        totalSteps: 9,
        currentStepName: "대본 기획",
        message: `${autoDurationMinutes}분 영상용 대본 기획안을 생성하고 있습니다...`,
        isComplete: false,
      })
      // 자동화 중에는 activeStep을 변경하지 않음 (주제 추천 화면 유지)
      
      const planResult = await generateScriptPlan(selectedTopic, selectedCategory, keywords || undefined, apiKey, autoDurationMinutes)
      setScriptPlan(planResult)
      setCompletedSteps((prev) => [...new Set([...prev, "planning"])])
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Step 2: 대본 초안 생성 (planning 단계 유지)
      setAutoProgress({
        step: 2,
        totalSteps: 9,
        currentStepName: "대본 초안",
        message: `${autoDurationMinutes}분 대본 초안을 작성하고 있습니다...`,
        isComplete: false,
      })
      // activeStep은 planning으로 유지 (별도의 draft UI가 없음)
      
      const draftResult = await generateScriptDraft(planResult, selectedTopic, apiKey)
      setScriptDraft(draftResult)
      setCompletedSteps((prev) => [...new Set([...prev, "draft"])])
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Step 3: 대본 전체 생성 (초안을 기반으로 최종 대본 생성 - 수동 모드와 동일)
      setAutoProgress({
        step: 3,
        totalSteps: 9,
        currentStepName: "대본 생성",
        message: `${autoDurationMinutes}분 분량(약 ${autoDurationMinutes * 300}자)의 전체 대본을 생성하고 있습니다...`,
        isComplete: false,
      })
      // 자동화 중에는 activeStep을 변경하지 않음 (주제 추천 화면 유지)
      
      // 수동 모드와 동일하게 초안(draft)을 기반으로 최종 대본 생성
      const targetChars = Math.floor(autoDurationMinutes * 60 * 6.9) // 1초당 6.9자
      const scriptResult = await generateFinalScript(
        draftResult,
        selectedTopic,
        apiKey,
        autoDurationMinutes,
        targetChars
      )
      setScript(scriptResult)
      
      // 문장 라인 파싱 (수동 모드와 동일하게 splitScriptIntoLines 함수 사용)
      const sentences = splitScriptIntoLines(scriptResult)
      setScriptLines(sentences)
      setSelectedLineIds(new Set(sentences.map((s: { id: number }) => s.id)))
      setCompletedSteps((prev) => [...new Set([...prev, "script"])])
      console.log(`[자동화] 대본 생성 완료, 문장 그룹 수: ${sentences.length}개`)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 로컬 변수로 이미지와 오디오 결과를 추적 (React state는 비동기라서 바로 반영 안됨)
      let localImageResults: Array<{ lineId: number; imageUrl: string; prompt: string }> = []
      let localAudioResults: Array<{ lineId: number; audioUrl: string; audioBase64: string }> = []

      // Step 4: 이미지 생성 (수동 모드와 동일하게 전체 문장에 대해 생성)
      if (replicateApiKey) {
        setAutoProgress({
          step: 4,
          totalSteps: 9,
          currentStepName: "이미지 생성",
          message: `AI 이미지를 생성하고 있습니다... (총 ${sentences.length}개)`,
          isComplete: false,
        })
        // 자동화 중에는 activeStep을 변경하지 않음 (주제 추천 화면 유지)
        
        let successCount = 0
        let failCount = 0
        
        // 수동 모드와 동일하게 전체 문장에 대해 이미지 생성
        for (let i = 0; i < sentences.length; i++) {
          const line = sentences[i]
          setAutoProgress({
            step: 4,
            totalSteps: 9,
            currentStepName: "이미지 생성",
            message: `이미지 생성 중... (${i + 1}/${sentences.length}) - 성공: ${successCount}, 실패: ${failCount}`,
            isComplete: false,
          })
          
          try {
            console.log(`[자동화] 이미지 생성 시작 (${i + 1}/${sentences.length}): ${line.text.substring(0, 30)}...`)
            const prompt = await generateImagePrompt(line.text, apiKey, selectedCategory)
            console.log(`[자동화] 이미지 프롬프트 생성 완료: ${prompt.substring(0, 50)}...`)
            
            const imageUrl = await generateImageWithReplicate(prompt, replicateApiKey, "16:9")
            console.log(`[자동화] 이미지 생성 완료: ${imageUrl.substring(0, 50)}...`)
            
            localImageResults.push({ lineId: line.id, imageUrl, prompt })
            setGeneratedImages([...localImageResults])
            successCount++
          } catch (error) {
            console.error(`[자동화] 이미지 생성 실패 (문장 ${line.id}):`, error)
            failCount++
            // 실패해도 계속 진행
            setAutoProgress({
              step: 4,
              totalSteps: 9,
              currentStepName: "이미지 생성",
              message: `이미지 ${i + 1}번 생성 실패, 다음으로 진행... (성공: ${successCount}, 실패: ${failCount})`,
              isComplete: false,
            })
          }
          
          // 각 이미지 생성 사이에 약간의 딜레이 추가 (API 제한 방지)
          await new Promise(resolve => setTimeout(resolve, 300))
        }
        
        console.log(`[자동화] 이미지 생성 완료 - 총 ${successCount}개 성공, ${failCount}개 실패`)
        
        if (localImageResults.length > 0) {
          setCompletedSteps((prev) => [...new Set([...prev, "image"])])
        }
      } else {
        console.log("Replicate API 키가 없어 이미지 생성을 건너뜁니다.")
        setAutoProgress({
          step: 4,
          totalSteps: 9,
          currentStepName: "이미지 생성",
          message: "Replicate API 키가 없어 이미지 생성을 건너뜁니다.",
          isComplete: false,
        })
      }
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Step 5: TTS 생성 (수동 모드와 동일하게 전체 문장에 대해 생성)
      if (elevenlabsApiKey) {
        setAutoProgress({
          step: 5,
          totalSteps: 9,
          currentStepName: "TTS 생성",
          message: `음성을 생성하고 있습니다... (총 ${sentences.length}개)`,
          isComplete: false,
        })
        // 자동화 중에는 activeStep을 변경하지 않음 (주제 추천 화면 유지)
        
        let ttsSuccessCount = 0
        let ttsFailCount = 0
        
        // 수동 모드와 동일하게 전체 문장에 대해 TTS 생성
        for (let i = 0; i < sentences.length; i++) {
          const line = sentences[i]
          setAutoProgress({
            step: 5,
            totalSteps: 9,
            currentStepName: "TTS 생성",
            message: `음성 생성 중... (${i + 1}/${sentences.length}) - 성공: ${ttsSuccessCount}, 실패: ${ttsFailCount}`,
            isComplete: false,
          })
          
          try {
            console.log(`[자동화] TTS 생성 시작 (${i + 1}/${sentences.length}): ${line.text.substring(0, 30)}...`)
            const response = await fetch("/api/elevenlabs-tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: line.text,
                voiceId: selectedVoiceId,
                apiKey: elevenlabsApiKey,
              }),
            })
            
            if (response.ok) {
              const data = await response.json()
              localAudioResults.push({
                lineId: line.id,
                audioUrl: data.audioUrl,
                audioBase64: data.audioBase64 || "",
              })
              setGeneratedAudios([...localAudioResults])
              ttsSuccessCount++
              console.log(`[자동화] TTS 생성 완료 (${i + 1}/${sentences.length})`)
            } else {
              console.error(`[자동화] TTS API 오류:`, response.status)
              ttsFailCount++
            }
          } catch (error) {
            console.error(`[자동화] TTS 생성 실패 (문장 ${line.id}):`, error)
            ttsFailCount++
          }
          
          // API 제한 방지를 위한 딜레이
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        
        console.log(`[자동화] TTS 생성 완료 - 총 ${ttsSuccessCount}개 성공, ${ttsFailCount}개 실패`)
        
        if (localAudioResults.length > 0) {
          setCompletedSteps((prev) => [...new Set([...prev, "video"])]) // 사이드바 ID는 "video"
        }
      } else {
        console.log("ElevenLabs API 키가 없어 TTS 생성을 건너뜁니다.")
        setAutoProgress({
          step: 5,
          totalSteps: 9,
          currentStepName: "TTS 생성",
          message: "ElevenLabs API 키가 없어 TTS 생성을 건너뜁니다.",
          isComplete: false,
        })
      }
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Step 6: 영상 렌더링 및 다운로드 (수동 모드와 완전히 동일한 방식)
      console.log(`[자동화] ========== Step 6: 영상 렌더링 시작 ==========`)
      console.log(`[자동화] 이미지: ${localImageResults.length}개, 오디오: ${localAudioResults.length}개`)
      
      if (localImageResults.length === 0) {
        console.error("[자동화] 오류: 생성된 이미지가 없습니다!")
        setAutoProgress({
          step: 6,
          totalSteps: 9,
          currentStepName: "영상 렌더링",
          message: "⚠️ 생성된 이미지가 없어 영상 렌더링을 건너뜁니다.",
          isComplete: false,
        })
      } else if (localAudioResults.length === 0) {
        console.error("[자동화] 오류: 생성된 오디오가 없습니다!")
        setAutoProgress({
          step: 6,
          totalSteps: 9,
          currentStepName: "영상 렌더링",
          message: "⚠️ 생성된 오디오가 없어 영상 렌더링을 건너뜁니다.",
          isComplete: false,
        })
      } else {
        setAutoProgress({
          step: 6,
          totalSteps: 9,
          currentStepName: "영상 렌더링",
          message: "영상을 렌더링하고 있습니다... (오디오 분석 중)",
          isComplete: false,
        })
        
        try {
          console.log("[자동화] 영상 렌더링 시작")
          setIsGeneratingVideo(true)
          setGeneratingVideoProgress(0)
          
          // ===== 수동 모드의 handleRenderVideo와 완전히 동일한 로직 =====
          
          // 1. 각 TTS 오디오의 정확한 길이 측정 (수동 모드와 동일)
          const audioDurations: Array<{ lineId: number; duration: number; audioBuffer?: AudioBuffer }> = []
          const audioContextForAnalysis = new (window.AudioContext || (window as any).webkitAudioContext)()

          for (let i = 0; i < sentences.length; i++) {
            const line = sentences[i]
            const audio = localAudioResults.find((a) => a.lineId === line.id)
            if (audio) {
              try {
                setAutoProgress({
                  step: 6,
                  totalSteps: 9,
                  currentStepName: "영상 렌더링",
                  message: `오디오 분석 중... (${i + 1}/${sentences.length})`,
                  isComplete: false,
                })
                
                const response = await fetch(audio.audioUrl)
                const arrayBuffer = await response.arrayBuffer()
                const audioBuffer = await audioContextForAnalysis.decodeAudioData(arrayBuffer)
                audioDurations.push({ lineId: line.id, duration: audioBuffer.duration, audioBuffer })
              } catch (error) {
                console.error(`[자동화] 오디오 ${line.id} 분석 실패:`, error)
                audioDurations.push({ lineId: line.id, duration: 3 })
              }
            }
          }

          // 2. 자막 생성 (각 문장을 여러 줄로 나누어 정확한 타이밍 계산) - 수동 모드와 완전히 동일
          const subtitles: Array<{ id: number; start: number; end: number; text: string }> = []
          
          // splitIntoSubtitleLines 함수 (수동 모드와 완전히 동일 - 단어 단위로 나누어 TTS와 정확히 동기화)
          const splitIntoSubtitleLines = (text: string, audioBuffer?: AudioBuffer, totalDuration: number = 0): Array<{ text: string; startTime: number; endTime: number }> => {
            const words = text.split(" ").filter(w => w.trim().length > 0)
            if (words.length === 0) return [{ text, startTime: 0, endTime: totalDuration }]
            
            const result: Array<{ text: string; startTime: number; endTime: number }> = []
            
            // 오디오 버퍼가 있으면 웨이브폼 분석으로 침묵 구간 찾기
            let wordStartTimes: number[] = []
            
            if (audioBuffer && totalDuration > 0) {
              // 각 단어의 예상 시작 시간 계산 (단어 길이 기반)
              const totalChars = words.reduce((sum, w) => sum + w.length, 0)
              let currentTime = 0
              
              for (const word of words) {
                const wordRatio = word.length / totalChars
                const wordDuration = wordRatio * totalDuration
                wordStartTimes.push(currentTime)
                currentTime += wordDuration
              }
            } else {
              // Fallback: 균등 분배
              const timePerWord = totalDuration / words.length
              for (let i = 0; i < words.length; i++) {
                wordStartTimes.push(i * timePerWord)
              }
            }
            
            // 단어들을 묶어서 자막 라인 생성 (공백 포함 최대 25자)
            let currentLine: string[] = []
            let lineStartTime = 0
            const maxChars = 25 // 공백 포함 25자까지
            
            for (let i = 0; i < words.length; i++) {
              const word = words[i]
              const testLine = currentLine.length > 0 ? currentLine.join(" ") + " " + word : word
              
              // 25자를 초과하면 줄 분리 (25자까지는 나오도록)
              if (testLine.length > maxChars && currentLine.length >= 1) {
                if (currentLine.length > 0) {
                  const lineEndTime = i < wordStartTimes.length ? wordStartTimes[i] : totalDuration
                  result.push({
                    text: currentLine.join(" "),
                    startTime: lineStartTime,
                    endTime: lineEndTime,
                  })
                }
                currentLine = [word]
                lineStartTime = wordStartTimes[i] || (i * (totalDuration / words.length))
              } else {
                currentLine.push(word)
              }
            }
            
            // 마지막 줄 처리
            if (currentLine.length > 0) {
              result.push({
                text: currentLine.join(" "),
                startTime: lineStartTime,
                endTime: totalDuration,
              })
            }
            
            return result.length > 0 ? result : [{ text, startTime: 0, endTime: totalDuration }]
          }

          let subtitleTime = 0
          let subtitleId = 1

          for (const line of sentences) {
            const audioData = audioDurations.find((d) => d.lineId === line.id)
            const audioDuration = audioData?.duration || 0
            const audioBuffer = audioData?.audioBuffer
            
            if (audioDuration > 0) {
              // 문장을 단어 단위로 나누고 오디오 버퍼를 사용해 정확한 타이밍 계산
              const subtitleLines = splitIntoSubtitleLines(line.text, audioBuffer, audioDuration)
              
              // 각 자막 생성 (오디오 버퍼 분석 기반 정확한 타이밍)
              for (let j = 0; j < subtitleLines.length; j++) {
                const subtitleLine = subtitleLines[j]
                const start = subtitleTime + subtitleLine.startTime
                const end = subtitleTime + subtitleLine.endTime

                subtitles.push({
                  id: subtitleId++,
                  start: Number.parseFloat(start.toFixed(3)), // 0.001초 단위로 정밀도 향상
                  end: Number.parseFloat(end.toFixed(3)),
                  text: subtitleLine.text
                })
              }
            } else {
              // 오디오가 없으면 기본값 사용 (3초)
              subtitles.push({
                id: subtitleId++,
                start: subtitleTime,
                end: subtitleTime + 3,
                text: line.text
              })
            }
            
            subtitleTime += audioDuration > 0 ? audioDuration : 3
          }

          const totalDuration = subtitleTime
          console.log(`[자동화] 자막 ${subtitles.length}개 생성 완료 (수동 모드와 동일한 분할 방식)`)
          console.log(`[자동화] 총 영상 길이: ${totalDuration.toFixed(2)}초`)

          // 3. 이미지 매핑 (수동 모드와 완전히 동일한 로직) - 오디오 합치기 전에 먼저 실행
          console.log("[자동화] 이미지 매핑 시작")
          const autoImagesForRender: Array<{
            id: string
            url: string
            startTime: number
            endTime: number
            keyword: string
            motion?: string
          }> = []

          let imageTime = 0
          for (const line of sentences) {
            const image = localImageResults.find((img) => img.lineId === line.id)
            const audioData = audioDurations.find((d) => d.lineId === line.id)
            const audioDuration = audioData?.duration || 3

            if (image) {
              // 같은 이미지를 사용하는 문장 그룹 찾기 (수동 모드와 동일)
              const sameImageLines = sentences.filter((l) => {
                const img = localImageResults.find((img) => img.lineId === l.id)
                return img && img.imageUrl === image.imageUrl
              })

              const imageStartTime = imageTime
              let imageEndTime = imageStartTime
              for (const sameLine of sameImageLines) {
                const duration = audioDurations.find((d) => d.lineId === sameLine.id)?.duration || 3
                imageEndTime += duration
              }

              if (!autoImagesForRender.find((img) => img.startTime === imageStartTime)) {
                autoImagesForRender.push({
                  id: `image_${line.id}`,
                  url: image.imageUrl,
                  startTime: imageStartTime,
                  endTime: imageEndTime,
                  keyword: `문장 ${line.id}`,
                  motion: "static",
                })
              }
              imageTime += audioDuration
            } else {
              imageTime += audioDuration
            }
          }
          autoImagesForRender.sort((a, b) => a.startTime - b.startTime)
          console.log(`[자동화] 이미지 매핑 완료: ${autoImagesForRender.length}개`)

          setAutoProgress({
            step: 6,
            totalSteps: 9,
            currentStepName: "영상 렌더링",
            message: `오디오 합치는 중... (총 ${Math.floor(totalDuration / 60)}분 ${Math.floor(totalDuration % 60)}초)`,
            isComplete: false,
          })

          // 4. 오디오 합치기
          const targetSampleRate = 44100
          const totalSamples = Math.ceil(totalDuration * targetSampleRate)
          const mergedBuffer = audioContextForAnalysis.createBuffer(1, totalSamples, targetSampleRate)
          const channelData = mergedBuffer.getChannelData(0)

          let sampleOffset = 0
          for (const audioDuration of audioDurations) {
            if (audioDuration.audioBuffer) {
              const sourceData = audioDuration.audioBuffer.getChannelData(0)
              const resampleRatio = audioDuration.audioBuffer.sampleRate / targetSampleRate

              for (let i = 0; i < Math.floor(audioDuration.duration * targetSampleRate); i++) {
                const sourceIndex = Math.floor(i * resampleRatio)
                if (sourceIndex < sourceData.length && sampleOffset + i < channelData.length) {
                  channelData[sampleOffset + i] = sourceData[sourceIndex]
                }
              }
              sampleOffset += Math.floor(audioDuration.duration * targetSampleRate)
            }
          }

          // 4. WAV 파일 생성
          const wavData = audioBufferToWav(mergedBuffer)
          const audioBlob = new Blob([wavData], { type: "audio/wav" })
          const audioUrl = URL.createObjectURL(audioBlob)

          console.log(`[자동화] 합쳐진 오디오 크기: ${Math.round(audioBlob.size / 1024)}KB`)

          // 5. videoData 설정 (autoImages 포함 - 수동 모드와 동일)
          const newVideoData = {
            audioUrl,
            subtitles,
            duration: totalDuration,
            autoImages: autoImagesForRender.map((img) => ({
              id: img.id,
              url: img.url,
              startTime: img.startTime,
              endTime: img.endTime,
              keyword: img.keyword,
              motion: (img.motion || "static") as "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "static",
            })),
          }
          setVideoData(newVideoData)
          console.log(`[자동화] videoData 설정 완료 - autoImages: ${autoImagesForRender.length}개`)

          // autoImages state도 업데이트 (미리보기에서 사용) - 수동 모드와 동일
          setAutoImages(autoImagesForRender.map((img) => ({
            id: img.id,
            url: img.url,
            startTime: img.startTime,
            endTime: img.endTime,
            keyword: img.keyword,
            motion: (img.motion || "static") as "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "static",
          })))
          console.log(`[자동화] autoImages state 업데이트 완료: ${autoImagesForRender.length}개`)

          setIsGeneratingVideo(false)
          setGeneratingVideoProgress(100)
          setCompletedSteps((prev) => [...new Set([...prev, "render"])])
          console.log("[자동화] 영상 렌더링 완료")

          // 6. 빠른 다운로드 실행 (수동 모드의 handleFastDownload와 동일)
          setAutoProgress({
            step: 6,
            totalSteps: 9,
            currentStepName: "영상 다운로드",
            message: "영상을 다운로드하고 있습니다...",
            isComplete: false,
          })

          try {
            console.log("[자동화] 빠른 다운로드 시작")
            setIsExporting(true)

            // 오디오를 base64로 변환
            const audioResponse = await fetch(audioUrl)
            const audioBlob = await audioResponse.blob()
            
            console.log("[자동화] 원본 오디오 크기:", Math.round(audioBlob.size / 1024), "KB")
            
            // Web Audio API로 오디오 재인코딩 (샘플레이트 낮추기)
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            const arrayBuffer = await audioBlob.arrayBuffer()
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
            
            // 11025Hz 모노로 압축
            const compressSampleRate = 11025
            const offlineContext = new OfflineAudioContext(
              1,
              Math.floor(audioBuffer.length * compressSampleRate / audioBuffer.sampleRate),
              compressSampleRate
            )
            
            const source = offlineContext.createBufferSource()
            source.buffer = audioBuffer
            source.connect(offlineContext.destination)
            source.start(0)
            
            const compressedBuffer = await offlineContext.startRendering()
            const compressedWav = audioBufferToWav(compressedBuffer)
            const compressedBlob = new Blob([compressedWav], { type: "audio/wav" })
            
            console.log("[자동화] 압축된 오디오 크기:", Math.round(compressedBlob.size / 1024), "KB")
            
            // base64로 변환
            const reader = new FileReader()
            const audioBase64 = await new Promise<string>((resolve) => {
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(",")[1]
                resolve(base64)
              }
              reader.readAsDataURL(compressedBlob)
            })

            // 이미 위에서 autoImagesForRender를 생성했으므로 바로 사용
            const firstImage = localImageResults[0]
            if (!firstImage) {
              throw new Error("이미지가 없습니다.")
            }

            console.log("[자동화] Cloud Run 렌더링 요청 - 이미지:", autoImagesForRender.length, "개")

            // Cloud Run 렌더링 API 호출
            const renderResponse = await fetch("/api/ai/render", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                audioBase64,
                subtitles: subtitles.map((s) => ({
                  id: s.id,
                  start: s.start,
                  end: s.end,
                  text: s.text,
                })),
                characterImage: firstImage.imageUrl,
                autoImages: autoImagesForRender,
                duration: totalDuration,
                config: {
                  width: 1920,
                  height: 1080,
                  fps: 30,
                },
              }),
            })

            if (!renderResponse.ok) {
              const errorData = await renderResponse.json()
              throw new Error(errorData.error || "Cloud Run 렌더링 실패")
            }

            const renderResult = await renderResponse.json()

            if (!renderResult.success) {
              throw new Error("렌더링 결과를 받을 수 없습니다.")
            }

            console.log("[자동화] Cloud Run 렌더링 완료")

            let videoBlob: Blob

            // 방법 1: base64 데이터로 받은 경우
            if (renderResult.videoBase64) {
              console.log("[자동화] base64 데이터로 영상 다운로드")
              const binaryString = atob(renderResult.videoBase64)
              const bytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
              }
              videoBlob = new Blob([bytes], { type: "video/mp4" })
            }
            // 방법 2: URL로 받은 경우
            else if (renderResult.videoUrl) {
              console.log("[자동화] URL로 영상 다운로드 시작:", renderResult.videoUrl)
              const videoResponse = await fetch(renderResult.videoUrl, {
                method: "GET",
                mode: "cors",
              })
              
              if (!videoResponse.ok) {
                throw new Error(`영상 다운로드 실패: ${videoResponse.status} ${videoResponse.statusText}`)
              }
              
              videoBlob = await videoResponse.blob()
            } else {
              throw new Error("영상 데이터 또는 URL을 받을 수 없습니다.")
            }

            // 영상 다운로드
            const downloadUrl = URL.createObjectURL(videoBlob)
            const a = document.createElement("a")
            a.href = downloadUrl
            a.download = `${selectedTopic.substring(0, 20).replace(/[^가-힣a-zA-Z0-9]/g, "_")}_자동화_${new Date().toISOString().slice(0, 10)}.mp4`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)

            setTimeout(() => {
              URL.revokeObjectURL(downloadUrl)
            }, 100)

            console.log("[자동화] 영상 다운로드 완료")
            setIsExporting(false)

          } catch (downloadError) {
            console.error("[자동화] 빠른 다운로드 실패:", downloadError)
            setIsExporting(false)
            // 다운로드 실패해도 나머지 단계는 계속 진행
          }

        } catch (error) {
          console.error("[자동화] 영상 렌더링 실패:", error)
          setAutoProgress({
            step: 6,
            totalSteps: 9,
            currentStepName: "영상 렌더링",
            message: `영상 렌더링 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
            isComplete: false,
          })
          setIsGeneratingVideo(false)
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Step 7: 제목 생성
      setAutoProgress({
        step: 7,
        totalSteps: 9,
        currentStepName: "제목 생성",
        message: "유튜브 제목을 생성하고 있습니다...",
        isComplete: false,
      })
      
      const titles = await generateYouTubeTitles(selectedTopic, scriptResult, apiKey)
      setGeneratedTitles(titles)
      
      // 랜덤으로 제목 선택 (수동 모드에서 사용자가 선택하는 것처럼)
      if (titles.length > 0) {
        const randomIndex = Math.floor(Math.random() * titles.length)
        const selectedRandomTitle = titles[randomIndex]
        setSelectedTitle(selectedRandomTitle)
        setYoutubeTitle(selectedRandomTitle)
        console.log(`[자동화] 제목 ${titles.length}개 중 ${randomIndex + 1}번째 선택: ${selectedRandomTitle}`)
      }
      await new Promise(resolve => setTimeout(resolve, 500))

      // Step 8: 설명 생성 (선택된 제목 기반 - 수동 모드와 동일)
      setAutoProgress({
        step: 8,
        totalSteps: 9,
        currentStepName: "설명 생성",
        message: "유튜브 설명을 생성하고 있습니다...",
        isComplete: false,
      })
      
      // 수동 모드와 동일하게 호출: (script, category, title, apiKey)
      const selectedRandomTitle = youtubeTitle || titles[0] || selectedTopic
      const description = await generateYouTubeDescription(scriptResult, selectedCategory, selectedRandomTitle, apiKey)
      setYoutubeDescription(description)
      setCompletedSteps((prev) => [...new Set([...prev, "title"])])
      console.log("[자동화] 제목/설명 생성 완료")
      await new Promise(resolve => setTimeout(resolve, 500))

      // Step 9: AI 썸네일 생성 (썸네일 생성기 - AI로 썸네일 만들기)
      setAutoProgress({
        step: 9,
        totalSteps: 9,
        currentStepName: "AI 썸네일 생성",
        message: "썸네일 생성기로 이동 중...",
        isComplete: false,
      })
      
      // 썸네일 모드를 AI로 설정
      setThumbnailMode("ai")
      console.log("[자동화] 썸네일 생성기 - AI로 썸네일 만들기 시작")
      
      if (replicateApiKey) {
        setAutoProgress({
          step: 9,
          totalSteps: 9,
          currentStepName: "AI 썸네일 생성",
          message: `AI가 "${selectedTopic}" 주제로 썸네일을 생성하고 있습니다...`,
          isComplete: false,
        })
        
        try {
          console.log(`[자동화] AI 썸네일 생성 시작 - 주제: ${selectedTopic}`)
          const thumbnailUrl = await generateAIThumbnail(selectedTopic, replicateApiKey)
          setAiThumbnailUrl(thumbnailUrl)
          setCompletedSteps((prev) => [...new Set([...prev, "thumbnail"])])
          console.log(`[자동화] AI 썸네일 생성 완료: ${thumbnailUrl.substring(0, 50)}...`)
          
          setAutoProgress({
            step: 9,
            totalSteps: 9,
            currentStepName: "AI 썸네일 생성",
            message: "AI 썸네일이 생성되었습니다!",
            isComplete: false,
          })
        } catch (error) {
          console.error("[자동화] AI 썸네일 생성 실패:", error)
          setAutoProgress({
            step: 9,
            totalSteps: 9,
            currentStepName: "AI 썸네일 생성",
            message: `AI 썸네일 생성 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
            isComplete: false,
          })
        }
      } else {
        console.log("[자동화] Replicate API 키가 없어 AI 썸네일 생성을 건너뜁니다.")
        setAutoProgress({
          step: 9,
          totalSteps: 9,
          currentStepName: "AI 썸네일 생성",
          message: "Replicate API 키가 없어 AI 썸네일 생성을 건너뜁니다. 수동으로 생성해주세요.",
          isComplete: false,
        })
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 완료
      setAutoProgress({
        step: 9,
        totalSteps: 9,
        currentStepName: "완료",
        message: "🎉 자동화가 완료되었습니다! 각 단계를 확인하고 필요시 수정해주세요.",
        isComplete: true,
      })
      setIsReadyForUpload(true)
      console.log("[자동화] 전체 파이프라인 완료")
      
      alert("🎉 자동화가 완료되었습니다!\n\n결과를 확인하고 필요시 수정한 후, 유튜브에 업로드할 수 있습니다.")
      
    } catch (error) {
      console.error("자동화 파이프라인 오류:", error)
      setAutoProgress({
        step: autoProgress.step,
        totalSteps: 9,
        currentStepName: "오류",
        message: `오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        isComplete: false,
      })
      alert(`자동화 중 오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsAutoRunning(false)
    }
  }

  // 모드 선택 후 진행 함수
  const handleModeSelection = (mode: "auto" | "manual") => {
    setWorkflowMode(mode)
    if (mode === "auto") {
      // 자동화 모드: 업로드 일자 선택 UI 표시
      setShowScheduleSelector(true)
      // 기본 날짜를 오늘로 설정
      const today = new Date()
      setYoutubeScheduleDate(today.toISOString().split('T')[0])
    } else {
      // 수동 모드: 다음 단계로 이동
      setShowScheduleSelector(false)
      setActiveStep("planning")
    }
  }

  // 자동화 시작 (업로드 일자 선택 후)
  const handleStartAutomation = () => {
    setShowScheduleSelector(false)
    runAutomationPipeline()
  }

  const handleTopicGeneration = async () => {
    setIsGenerating(true)
    try {
      // 로컬스토리지에서 API 키 가져오기
      const apiKey = localStorage.getItem("openai_api_key") || undefined
      
      // 키워드는 선택 사항 (빈 문자열이면 undefined로 전달)
      const keywordsValue = keywords.trim() || undefined
      
      console.log("[v0] 주제 생성 시작, 카테고리:", selectedCategory, "키워드:", keywordsValue) // 디버깅 로그 추가
      const topics = await generateTopics(selectedCategory, keywordsValue, undefined, apiKey)
      console.log("[v0] 생성된 주제:", topics) // 디버깅 로그 추가
      setGeneratedTopics(topics)
      setCompletedSteps((prev) => [...prev, "topic"])
      
      // 주제 생성 완료 후 주제 목록으로 스크롤
      setTimeout(() => {
        generatedTopicsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 100)
    } catch (error) {
      console.error("주제 생성 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      alert(`주제 생성에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsGenerating(false)
    }
  }

  // 테스트 데이터 로드 함수
  const handleLoadTestData = () => {
    // 테스트 주제 설정
    const testTopic = "조선시대 무덤의 비밀"
    setSelectedTopic(testTopic)
    setIsCustomTopicSelected(false)
    
    // 테스트 대본 기획
    const testScriptPlan = `# 대본 기획

## 주제: 조선시대 무덤의 비밀

### 1. 도입부 (0-2분)
- 조선시대 무덤의 특징 소개
- 무덤의 구조와 의미
- 왜 무덤에 비밀이 있는가?

### 2. 본론 (2-15분)
- 조선시대 무덤의 종류
- 왕릉과 일반 무덤의 차이
- 무덤에 담긴 역사적 의미
- 무덤 발굴의 중요성

### 3. 결론 (15-20분)
- 무덤이 전해주는 메시지
- 역사 보존의 중요성
- 마무리`

    // 테스트 대본 초안
    const testScriptDraft = `안녕하세요. 오늘은 조선시대 무덤에 대해 이야기해보겠습니다.

조선시대 무덤은 우리 역사를 이해하는 중요한 단서입니다. 무덤의 구조와 형태는 당시 사람들의 삶과 사상을 보여줍니다.

조선시대 무덤은 크게 왕릉과 일반 무덤으로 나뉩니다. 왕릉은 규모가 크고 정교하게 만들어졌으며, 일반 무덤은 비교적 간단한 형태입니다.

무덤에는 많은 비밀이 담겨 있습니다. 발굴을 통해 우리는 과거 사람들의 생활 방식을 알 수 있고, 역사의 진실을 밝힐 수 있습니다.`

    // 테스트 대본
    const testScript = `안녕하세요. 오늘은 조선시대 무덤의 비밀에 대해 이야기해보겠습니다.

조선시대 무덤은 우리 역사를 이해하는 중요한 단서입니다. 무덤의 구조와 형태는 당시 사람들의 삶과 사상을 보여줍니다.

조선시대 무덤은 크게 왕릉과 일반 무덤으로 나뉩니다. 왕릉은 규모가 크고 정교하게 만들어졌으며, 일반 무덤은 비교적 간단한 형태입니다.

무덤에는 많은 비밀이 담겨 있습니다. 발굴을 통해 우리는 과거 사람들의 생활 방식을 알 수 있고, 역사의 진실을 밝힐 수 있습니다.

조선시대 무덤의 특징 중 하나는 풍수지리설의 영향입니다. 좋은 자리에 무덤을 만들면 자손이 번영한다고 믿었기 때문입니다.

무덤의 구조는 시대에 따라 변화했습니다. 초기에는 간단한 형태였지만, 후기로 갈수록 더 정교해졌습니다.

무덤 발굴은 역사 연구에 매우 중요합니다. 발굴된 유물과 유적을 통해 우리는 과거를 재구성할 수 있습니다.

조선시대 무덤은 단순히 시신을 묻는 장소가 아닙니다. 그것은 당시 사람들의 세계관과 가치관을 보여주는 문화유산입니다.

오늘날 우리는 이러한 무덤을 보존하고 연구함으로써 우리의 역사를 더 잘 이해할 수 있습니다.`

    // 테스트 대본 라인 설정
    const testScriptLines = testScript
      .split(/[.!?。！？]\s*/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0)
      .map((s: string, index: number) => ({
        id: index + 1,
        text: s + (s.endsWith(".") || s.endsWith("!") || s.endsWith("?") ? "" : "."),
      }))

    // 테스트 이미지 설정 (사용자가 업로드한 이미지가 있으면 사용, 없으면 기본 이미지)
    const imageUrlToUse = testImageUrl || `https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop`
    const testImages = testScriptLines.map((line, index) => ({
      lineId: line.id,
      imageUrl: imageUrlToUse,
      prompt: `조선시대 무덤, 역사적 유적, 고고학`,
    }))

    // 상태 업데이트
    setScriptPlan(testScriptPlan)
    setScriptDraft(testScriptDraft)
    setScript(testScript)
    setScriptLines(testScriptLines)
    setGeneratedImages(testImages)
    
    // 완료된 단계 설정
    setCompletedSteps(["topic", "planning", "script", "image"])
    
    alert("테스트 데이터가 로드되었습니다! 이제 쇼츠 생성기를 테스트할 수 있습니다.")
  }

  // CHANGE: generateScript 함수의 이름은 그대로 두고, 실제 호출하는 곳에서 올바르게 사용
  const handleScriptGeneration = async () => {
    if (!selectedTopic) return

    setIsGenerating(true)
    if (isAutoMode) {
      setAutoModeStep("대본 재구성 중...")
      setAutoModeProgress({ current: "3/7", total: 7 })
    }
    try {
      // generateScript 함수는 action 파일에 존재하므로, 이를 호출하도록 수정
      const generatedScript = await generateFullScript(scriptPlan, selectedTopic, selectedCategory, getApiKey()) // scriptPlan 사용
      setScript(generatedScript)
      setCompletedSteps((prev) => [...prev, "script"])
      
      // 자동화 모드일 때 다음 단계 자동 진행 (이미지 생성)
      if (isAutoMode) {
        console.log("[v0] 자동화 모드: 이미지 생성 시작")
        // 대본을 문장으로 분할
        const lines = generatedScript.split(/[.!?。！？]+/).filter((s: string) => s.trim().length > 0).map((s: string, idx: number) => ({
          id: idx + 1,
          text: s.trim()
        }))
        setScriptLines(lines)
        setTimeout(() => handleGenerateImagesForLines(), 2000)
      }
    } catch (error) {
      console.error("대본 생성 실패:", error)
      alert("대본 생성에 실패했습니다. 다시 시도해주세요.")
      if (isAutoMode) {
        setIsAutoMode(false)
        setAutoModeStep("")
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCharacterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      setGeneratedImage(imageUrl)
      setDoctorPrompt("사용자 업로드 이미지")
      setDoctorKoreanDescription("직접 업로드한 인물 이미지")
      setCompletedSteps((prev) => [...prev, "image"])
    }
    reader.readAsDataURL(file)
  }

  const handleImageGeneration = async () => {
    if (selectedDoctorType === "custom" && !customDescription.trim()) {
      alert("원하는 인물 설명을 입력해주세요.")
      return
    }

    setIsGenerating(true)
    try {
      console.log("[v0] 클라이언트: 이미지 생성 시작")
      const result = await generateDoctorImage(selectedDoctorType, customDescription)
      console.log("[v0] 클라이언트: 이미지 생성 성공", result)

      setGeneratedImage(result.imageUrl)
      setDoctorPrompt(result.prompt)
      setDoctorKoreanDescription(result.koreanDescription)
      setCompletedSteps((prev) => [...prev, "image"])

      if (result.imageUrl.includes("placeholder.svg")) {
        alert("이미지 생성에 실패하여 기본 이미지를 사용합니다. 콘솔 로그를 확인해주세요.")
      }
    } catch (error) {
      console.error("[v0] 클라이언트: 이미지 생성 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다"
      alert(`이미지 생성에 실패했습니다.\n\n오류: ${errorMessage}\n\n자세한 내용은 개발자 도구 콘솔을 확인해주세요.`)
    } finally {
      setIsGenerating(false)
    }
  }

  // CHANGE: 제목 생성 함수 수정 - 배열로 받아서 저장
  const handleTitleGeneration = async () => {
    if (!script) {
      alert("대본이 필요합니다. 먼저 대본을 생성해주세요.")
      return
    }

    setIsGeneratingTitles(true)
    try {
      const apiKey = getApiKey()
      const titles = await generateYouTubeTitles(script, selectedCategory, apiKey)
      setGeneratedTitles(titles)
    } catch (error) {
      console.error("제목 생성 실패:", error)
      alert(`제목 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingTitles(false)
    }
  }

  // CHANGE: handleDescriptionGeneration을 새로운 API 응답 구조에 맞춤
  const handleDescriptionGeneration = async () => {
    if (!script || !selectedTitle) {
      alert("대본과 제목이 필요합니다.")
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateYouTubeDescription(script, selectedCategory, selectedTitle, getApiKey())
      setYoutubeDescription(result)
      setCompletedSteps((prev) => [...prev, "description"])
    } catch (error) {
      console.error("설명 생성 실패:", error)
      alert(`설명 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const generateSuggestedTexts = (currentText: string, lineIndex: number) => {
    // 각 줄별 추천 문구 세트
    const suggestionSets = [
      // 첫 번째 줄 (충격적인 시작)
      [
        "병원에서 절대 말하지 않는",
        "의사들이 숨기는 진실",
        "60대가 꼭 알아야 할",
        "당신의 건강을 위협하는",
        "놓치면 후회하는 건강정보",
      ],
      // 두 번째 줄 (구체적인 내용)
      [
        "혈압약의 숨겨진 부작용",
        "관절염 완치의 비밀",
        "당뇨병 예방법 대공개",
        "심장병 조기 발견법",
        "치매 예방의 핵심",
      ],
      // 세 번째 줄 (대상 강조)
      ["60대 이상 필수 정보", "중년층 건강 가이드", "시니어 맞춤 건강법", "노년기 건강 관리법", "평생 건강 유지 비법"],
      // 네 번째 줄 (행동 유도)
      [
        "지금 바로 확인하세요!",
        "놓치면 평생 후회합니다",
        "오늘부터 시작하세요",
        "당장 실천해야 할 것들",
        "건강한 노후의 시작",
      ],
    ]

    // 현재 줄에 해당하는 추천 문구 가져오기
    const suggestions = suggestionSets[lineIndex] || suggestionSets[0]

    // 현재 텍스트와 다른 추천 문구만 필터링
    const filteredSuggestions = suggestions.filter((suggestion) => suggestion !== currentText).slice(0, 5)

    setSuggestedTexts(filteredSuggestions)
    setShowSuggestions(true)
  }

  const handleThumbnailGeneration = async () => {
    if (!script) {
      alert("먼저 대본을 생성해주세요.")
      return
    }

    setIsGeneratingThumbnail(true)
    try {
      console.log("[v0] 썸네일 텍스트 생성 요청 시작")
      const result: any = await generateThumbnailText(script, undefined, getApiKey())
      
      // 결과가 문자열인 경우 (actions.tsx)와 객체인 경우 (actions.ts) 모두 처리
      let lines: string[] = []
      
      if (typeof result === "string") {
        // 문자열인 경우 줄바꿈으로 분리
        lines = result
          .split("\n")
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 0)
          .slice(0, 4)
      } else if (result && typeof result === "object" && "line1" in result) {
        // 객체인 경우 line1, line2 사용
        lines = [result.line1, result.line2]
          .filter((line: string) => line && line.trim())
          .slice(0, 4)
      }

      if (lines.length === 0) {
        throw new Error("생성된 텍스트가 없습니다.")
      }

      setThumbnailText(lines)
      
      // 선택된 템플릿이 있으면 스타일 자동 적용
      if (selectedThumbnailTemplate === "yellow-white") {
        // 두 줄로만 제한
        const limitedLines = lines.slice(0, 2)
        setThumbnailText(limitedLines)
        
        const templateStyles = limitedLines.map((_, index) => ({
          color: index === 0 ? "#FFD700" : "#FFFFFF", // 첫 번째 줄은 노란색, 두 번째 줄은 흰색
          backgroundColor: "transparent",
          strokeWidth: 0,
          strokeColor: "#000000",
          fontSize: 120,
          fontWeight: "900" as const,
          textShadow: "none",
          stroke: "none",
          letterSpacing: -2,
        }))
        const templatePositions = limitedLines.map((_, index) => ({
          x: 5,
          y: 75 + index * 10, // 하단에 세로로 배치
        }))
        setTextStyles(templateStyles)
        setTextPositions(templatePositions)
      } else if (selectedThumbnailTemplate === "blank") {
        // 빈 템플릿 - 기본 스타일
        const defaultStyles = lines.map(() => ({
          color: "#FFFFFF",
          backgroundColor: "transparent",
          strokeWidth: 0,
          strokeColor: "#000000",
          fontSize: 120,
          fontWeight: "900" as const,
          textShadow: "none",
          stroke: "none",
          letterSpacing: -2,
        }))
        const defaultPositions = lines.map((_, index) => ({
          x: 8,
          y: 25 + index * 15,
        }))
        setTextStyles(defaultStyles)
        setTextPositions(defaultPositions)
      }
      
      setCompletedSteps((prev) => [...prev.filter((step) => step !== "thumbnail"), "thumbnail"])
      console.log("[v0] 썸네일 텍스트 설정 완료:", lines)
    } catch (error) {
      console.error("[v0] 썸네일 텍스트 생성 실패:", error)

      // 에러 발생 시에도 기본 텍스트 제공
      const fallbackLines = [
        "병원 비밀 대공개!",
        "당신의 건강을 위협하는 것",
        "60대 이상 필수 건강정보",
        "지금 바로 확인하세요!",
      ]
      setThumbnailText(fallbackLines)
      setCompletedSteps((prev) => [...prev.filter((step) => step !== "thumbnail"), "thumbnail"])

      alert("AI 생성에 실패했지만 기본 썸네일 텍스트를 제공했습니다. 직접 편집하여 사용하세요.")
    } finally {
      setIsGeneratingThumbnail(false)
    }
  }

  // AI 썸네일 생성 함수
  const handleAIGenerateThumbnail = async () => {
    if (!selectedTopic) {
      alert("먼저 주제를 선택해주세요.")
      return
    }

    const replicateApiKey = getApiKey("replicate_api_key")
    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingAIThumbnail(true)
    try {
      console.log("[v0] AI 썸네일 생성 시작, 주제:", selectedTopic)
      const imageUrl = await generateAIThumbnail(selectedTopic, replicateApiKey)
      setAiThumbnailUrl(imageUrl)
      setCompletedSteps((prev) => [...prev.filter((step) => step !== "thumbnail"), "thumbnail"])
      console.log("[v0] AI 썸네일 생성 완료:", imageUrl)
    } catch (error) {
      console.error("[v0] AI 썸네일 생성 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      alert(`AI 썸네일 생성에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsGeneratingAIThumbnail(false)
    }
  }

  // 쇼츠 대본 요약 함수
  const handleSummarizeScriptForShorts = async () => {
    if (!script || script.trim().length === 0) {
      alert("먼저 대본을 생성해주세요.")
      return
    }

    if (generatedImages.length === 0) {
      alert("먼저 이미지를 생성해주세요.")
      return
    }

    const openaiApiKey = getApiKey("openai_api_key")
    if (!openaiApiKey) {
      alert("OpenAI API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      return
    }

    setIsSummarizingScript(true)
    try {
      // API 라우트를 통해 대본 요약
      const response = await fetch("/api/summarize-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          script,
          duration: shortsDuration,
          openaiApiKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "대본 요약에 실패했습니다.")
      }

      const data = await response.json()
      const summarized = data.summarizedScript
      setSummarizedScript(summarized)

      // 요약된 대본을 문장 단위로 분할
      const lines: Array<{ id: number; text: string; startTime: number; endTime: number }> = []
      let currentTime = 0
      const charsPerSecond = 6.9 // 초당 문자 수

      const sentences = summarized
        .split(/[.!?。！？]\s*/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
        .map((s: string) => {
          if (!s.endsWith(".") && !s.endsWith("!") && !s.endsWith("?") && !s.endsWith("。") && !s.endsWith("！") && !s.endsWith("？")) {
            return s + "."
          }
          return s
        })

      sentences.forEach((sentence: string, index: number) => {
        const duration = (sentence.length / charsPerSecond) * 1000
        lines.push({
          id: index + 1,
          text: sentence,
          startTime: currentTime,
          endTime: currentTime + duration,
        })
        currentTime += duration
      })

      setShortsScriptLines(lines)

      // 대본 요약 후 자동으로 제목 생성
      if (selectedTopic && summarized) {
        try {
          const title = await generateShortsHookingTitle(selectedTopic, summarized, openaiApiKey)
          setShortsHookingTitle(title)
          console.log("[Shorts] 자동 생성된 제목:", title)
        } catch (error) {
          console.error("[Shorts] 자동 제목 생성 실패:", error)
          // 제목 생성 실패해도 계속 진행
        }
      }
    } catch (error) {
      console.error("대본 요약 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      alert(`대본 요약에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsSummarizingScript(false)
    }
  }

  // 쇼츠 제목 생성 함수
  const handleGenerateShortsTitle = async () => {
    if (!selectedTopic || !summarizedScript) {
      alert("주제와 요약된 대본이 필요합니다.")
      return
    }

    const openaiApiKey = getApiKey("openai_api_key")
    if (!openaiApiKey) {
      alert("OpenAI API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingShortsTitle(true)
    try {
      const title = await generateShortsHookingTitle(selectedTopic, summarizedScript, openaiApiKey)
      setShortsHookingTitle(title)
      console.log("[Shorts] 생성된 제목:", title)
    } catch (error) {
      console.error("제목 생성 실패:", error)
      alert("제목 생성에 실패했습니다.")
    } finally {
      setIsGeneratingShortsTitle(false)
    }
  }

  // Blob을 Base64로 변환하는 함수
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // 쇼츠 TTS 생성 함수 (쇼츠 페이지와 동일한 방식)
  const handleGenerateShortsTTS = async () => {
    if (shortsScriptLines.length === 0) {
      alert("생성된 문장 리스트가 없습니다. 먼저 대본을 요약해주세요.")
      return
    }

    const elevenlabsApiKey = getApiKey("elevenlabs_api_key")
    if (!elevenlabsApiKey) {
      alert("ElevenLabs API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingShortsTts(true)
    setTtsGenerationProgress({ current: 0, total: shortsScriptLines.length })
    
    let successCount = 0
    const collectedAudios: Array<{ lineId: number; audioUrl?: string; audioBase64?: string; audioBuffer?: AudioBuffer; duration?: number }> = []

    try {
      // 각 라인별로 TTS 생성
      for (let i = 0; i < shortsScriptLines.length; i++) {
        const line = shortsScriptLines[i]
        setTtsGenerationProgress({ current: i + 1, total: shortsScriptLines.length })

        try {
          console.log(`[Shorts] TTS 생성 중... (${i + 1}/${shortsScriptLines.length})`)
          const response = await fetch("/api/elevenlabs-tts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: line.text,
              voiceId: selectedVoiceId,
              apiKey: elevenlabsApiKey,
            }),
          })

          if (!response.ok) {
            let errorMessage = "TTS 생성 실패"
            try {
              const errorData = await response.json()
              errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
            } catch (e) {
              const errorText = await response.text()
              errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`
            }
            console.error(`[Shorts] TTS API 오류 (줄 ${line.id}):`, errorMessage)
            throw new Error(errorMessage)
          }

          const data = await response.json()
          
          if (!data.audioBase64 && !data.audioUrl) {
            console.error(`[Shorts] TTS 응답에 오디오 데이터 없음 (줄 ${line.id}):`, data)
            throw new Error("TTS 응답에 오디오 데이터가 없습니다.")
          }
          
          console.log(`[Shorts] TTS 생성 완료 (줄 ${line.id}):`, data.audioUrl ? "URL 있음" : "URL 없음", data.audioBase64 ? "Base64 있음" : "Base64 없음")

          const audioData = {
            lineId: line.id,
            audioUrl: data.audioUrl,
            audioBase64: data.audioBase64,
          }
          collectedAudios.push(audioData)
          successCount++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`[Shorts] TTS 생성 실패 (줄 ${line.id}):`, errorMessage)
          console.error(`[Shorts] 실패한 텍스트:`, line.text.substring(0, 50) + "...")
          if (i === 0) {
            console.warn(`[Shorts] 첫 번째 TTS 생성 실패. 계속 진행합니다...`)
          }
        }
      }

      console.log("[Shorts] 모든 TTS 생성 완료, 성공:", successCount, "개 / 전체:", shortsScriptLines.length, "개")

      if (successCount > 0) {
        if (successCount < shortsScriptLines.length) {
          alert(`${successCount}개의 TTS가 생성되었습니다. (${shortsScriptLines.length - successCount}개 실패)\n\n실패한 항목은 브라우저 콘솔을 확인해주세요.`)
        } else {
          alert(`${successCount}개의 TTS가 모두 생성되었습니다!`)
        }
        
        // 각 TTS 오디오의 실제 길이 측정 및 오디오 버퍼 저장
        console.log("[Shorts] 각 오디오의 실제 길이 측정 및 버퍼 저장 시작")
        const audioContextForAnalysis = new (window.AudioContext || (window as any).webkitAudioContext)()
        
        // 실제 오디오 길이에 맞춰 scriptLines의 startTime과 endTime 업데이트
        let currentTime = 0
        const updatedScriptLines = []

        for (const line of shortsScriptLines) {
          const audio = collectedAudios.find((a) => a.lineId === line.id)
          if (audio) {
            try {
              let audioUrl = audio.audioUrl
              if (audio.audioBase64 && !audioUrl) {
                audioUrl = `data:audio/mpeg;base64,${audio.audioBase64}`
              }
              
              if (audioUrl) {
                const audioResponse = await fetch(audioUrl)
                const audioArrayBuffer = await audioResponse.arrayBuffer()
                const audioBuffer = await audioContextForAnalysis.decodeAudioData(audioArrayBuffer)
                
                const preciseDuration = audioBuffer.duration
                
                // 실제 오디오 길이에 맞춰 startTime과 endTime 업데이트
                updatedScriptLines.push({
                  ...line,
                  startTime: currentTime * 1000, // 밀리초로 변환
                  endTime: (currentTime + preciseDuration) * 1000,
                })
                
                // collectedAudios에 오디오 버퍼와 duration 추가
                const audioIndex = collectedAudios.findIndex((a) => a.lineId === line.id)
                if (audioIndex >= 0) {
                  collectedAudios[audioIndex] = {
                    ...collectedAudios[audioIndex],
                    audioBuffer,
                    duration: preciseDuration,
                  }
                }
                
                currentTime += preciseDuration
                console.log(`[Shorts] 오디오 ${line.id} 정확한 길이: ${preciseDuration.toFixed(3)}초`)
              } else {
                // 오디오 URL이 없으면 기존 시간 사용
                updatedScriptLines.push(line)
              }
            } catch (error) {
              console.error(`[Shorts] 오디오 로드 실패 (줄 ${line.id}):`, error)
              updatedScriptLines.push(line)
            }
          } else {
            // TTS 생성 실패한 라인은 기존 시간 사용
            updatedScriptLines.push(line)
          }
        }

        // scriptLines 업데이트
        setShortsScriptLines(updatedScriptLines)

        // 오디오 합치기
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const audioBuffers: AudioBuffer[] = []

        for (const audio of collectedAudios) {
          if (audio.audioBuffer) {
            audioBuffers.push(audio.audioBuffer)
          } else {
            let audioUrl = audio.audioUrl
            if (audio.audioBase64 && !audioUrl) {
              audioUrl = `data:audio/mpeg;base64,${audio.audioBase64}`
            }
            if (audioUrl) {
              const response = await fetch(audioUrl)
              const arrayBuffer = await response.arrayBuffer()
              const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
              audioBuffers.push(audioBuffer)
            }
          }
        }

        if (audioBuffers.length > 0) {
          const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0)
          const mergedBuffer = audioContext.createBuffer(
            audioBuffers[0].numberOfChannels,
            totalLength,
            audioBuffers[0].sampleRate
          )

          let offset = 0
          for (const buffer of audioBuffers) {
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
              const mergedData = mergedBuffer.getChannelData(channel)
              const bufferData = buffer.getChannelData(channel)
              mergedData.set(bufferData, offset)
            }
            offset += buffer.length
          }

          const wav = audioBufferToWav(mergedBuffer)
          const blob = new Blob([wav], { type: "audio/wav" })
          const url = URL.createObjectURL(blob)
          setShortsTtsAudioUrl(url)
        }
      } else {
        const errorMessage = "TTS 생성에 실패했습니다.\n\n가능한 원인:\n1. ElevenLabs API 키가 올바르지 않습니다\n2. API 키의 사용량이 초과되었습니다\n3. 네트워크 연결 문제\n\n브라우저 콘솔(F12)에서 자세한 오류를 확인해주세요."
        alert(errorMessage)
      }
    } catch (error) {
      console.error("쇼츠 TTS 생성 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      alert(`쇼츠 TTS 생성에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsGeneratingShortsTts(false)
      setTtsGenerationProgress({ current: 0, total: 0 })
    }
  }

  // 쇼츠 영상 렌더링 함수
  const handleRenderShortsVideo = async () => {
    if (generatedImages.length === 0 || !shortsTtsAudioUrl || !shortsCanvasRef.current) {
      alert("이미지와 TTS가 모두 준비되어야 합니다.")
      return
    }

    setIsRenderingShorts(true)
    try {
      const canvas = shortsCanvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Canvas context를 생성할 수 없습니다.")
      }

      // 오디오 로드
      const audioResponse = await fetch(shortsTtsAudioUrl)
      const audioBlob = await audioResponse.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)

      await new Promise<void>((resolve, reject) => {
        audio.onloadeddata = () => resolve()
        audio.onerror = reject
      })

      const actualAudioDuration = audio.duration

      // MediaRecorder 설정
      const stream = canvas.captureStream(30)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioContext.createMediaElementSource(audio)
      const destination = audioContext.createMediaStreamDestination()
      source.connect(destination)

      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = destination.stream.getAudioTracks()[0]
      const combinedStream = new MediaStream([videoTrack, audioTrack])

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 5000000,
      })

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: "video/webm" })
        const videoUrl = URL.createObjectURL(videoBlob)
        setShortsVideoUrl(videoUrl)
        URL.revokeObjectURL(audioUrl)
        setIsRenderingShorts(false)
        alert("쇼츠 영상 렌더링이 완료되었습니다!")
      }

      // 이미지 미리 로드
      const images: HTMLImageElement[] = []
      for (const imgData of generatedImages) {
        const img = new Image()
        img.crossOrigin = "anonymous"
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = reject
          img.src = imgData.imageUrl
        })
        images.push(img)
      }

      // 렌더링 시작
      mediaRecorder.start()
      audio.play()

      const renderFrame = () => {
        const elapsed = audio.currentTime

        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // 제목 그리기 (쇼츠 페이지와 동일한 스타일)
        if (shortsHookingTitle) {
          const line1 = shortsHookingTitle.line1 || ""
          const line2 = shortsHookingTitle.line2 || ""
          
          const lineHeight = 100
          const topMargin = 80
          const totalTitleHeight = 200 + topMargin + 20
          
          ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
          ctx.fillRect(0, 0, canvas.width, totalTitleHeight)
          
          // 텍스트가 잘리지 않도록 폰트 크기 동적 조정
          const maxWidth = canvas.width * 0.9 // 캔버스 너비의 90%를 최대 너비로 설정
          let fontSize = 96
          ctx.font = `bold ${fontSize}px Arial`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          
          // line1 폰트 크기 조정
          let line1Metrics = ctx.measureText(line1)
          while (line1Metrics.width > maxWidth && fontSize > 40) {
            fontSize -= 2
            ctx.font = `bold ${fontSize}px Arial`
            line1Metrics = ctx.measureText(line1)
          }
          
          // 첫 번째 줄: 노란색
          ctx.fillStyle = "yellow"
          ctx.fillText(line1, canvas.width / 2, 50 + topMargin)
          
          // line2 폰트 크기 조정 (line1과 동일한 크기 사용)
          const line2Metrics = ctx.measureText(line2)
          if (line2Metrics.width > maxWidth) {
            let fontSize2 = fontSize
            while (ctx.measureText(line2).width > maxWidth && fontSize2 > 40) {
              fontSize2 -= 2
              ctx.font = `bold ${fontSize2}px Arial`
            }
          }
          
          // 두 번째 줄: 흰색
          ctx.fillStyle = "white"
          ctx.fillText(line2, canvas.width / 2, 50 + topMargin + lineHeight)
        } else if (selectedTopic) {
          // hookingTitle이 없으면 원본 제목 표시 (하위 호환성)
          const lineHeight = 100
          const topMargin = 80
          const totalTitleHeight = 200 + topMargin + 20
          
          ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
          ctx.fillRect(0, 0, canvas.width, totalTitleHeight)
          
          ctx.font = "bold 96px Arial"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          
          // 주제를 두 줄로 나누기
          const words = selectedTopic.split(" ")
          let line1 = ""
          let line2 = ""
          for (const word of words) {
            if (line1.length + word.length <= 6) {
              line1 += (line1 ? " " : "") + word
            } else if (line2.length + word.length <= 6) {
              line2 += (line2 ? " " : "") + word
            } else {
              break
            }
          }
          if (!line1) line1 = selectedTopic.substring(0, 6)
          if (!line2) line2 = selectedTopic.substring(6, 12) || ""
          
          // 첫 번째 줄: 노란색
          ctx.fillStyle = "yellow"
          ctx.fillText(line1, canvas.width / 2, 50 + topMargin)
          
          // 두 번째 줄: 흰색
          if (line2) {
            ctx.fillStyle = "white"
            ctx.fillText(line2, canvas.width / 2, 50 + topMargin + lineHeight)
          }
        }

        // 현재 시간에 맞는 이미지 찾기
        const currentLine = shortsScriptLines.find(
          (line) => elapsed >= line.startTime / 1000 && elapsed <= line.endTime / 1000
        ) || shortsScriptLines[shortsScriptLines.length - 1]

        if (currentLine) {
          let imageIndex = generatedImages.findIndex((img) => img.lineId === currentLine.id)

          if (imageIndex < 0) {
            const currentLineIndex = shortsScriptLines.findIndex((line) => line.id === currentLine.id)
            for (let i = currentLineIndex; i >= 0; i--) {
              const prevLine = shortsScriptLines[i]
              const prevImageIndex = generatedImages.findIndex((img) => img.lineId === prevLine.id)
              if (prevImageIndex >= 0) {
                imageIndex = prevImageIndex
                break
              }
            }
          }

          if (imageIndex >= 0 && images[imageIndex]) {
            const img = images[imageIndex]
            const imageWidth = canvas.width
            const imageHeight = canvas.width
            const imageX = 0
            // 제목 영역 높이 계산
            const titleHeight = shortsHookingTitle || selectedTopic ? 300 : 0 // 200 + 80 (위쪽 여백) + 20 (추가 간격)
            const imageY = titleHeight + 30 // 제목 밑에 30px 여백 추가

            const baseScale = 1.0
            const maxScale = 1.15

            const easeInOutSmooth = (t: number): number => {
              return t * t * (3 - 2 * t)
            }

            const imageStartTime = currentLine.startTime / 1000
            const imageEndTime = currentLine.endTime / 1000
            const imageDuration = imageEndTime - imageStartTime
            const timeInImage = elapsed - imageStartTime
            // 줌인 속도를 매우 느리게 조정 (0.2배 속도로 매우 느리게)
            let zoomProgress = Math.min(Math.max((timeInImage / imageDuration) * 0.2, 0), 1)
            // 매우 부드러운 easing 적용 (3번 적용하여 더 부드럽게)
            zoomProgress = easeInOutSmooth(easeInOutSmooth(easeInOutSmooth(zoomProgress)))

            const zoomScale = baseScale + (maxScale - baseScale) * zoomProgress

            // 각 이미지마다 고정된 랜덤 방향 생성 (lineId 기반)
            const zoomDirection = currentLine.id % 2 === 0 ? "left-to-right" : "right-to-left"
            
            // 크롭할 영역 계산 (16:9 이미지를 1:1로 크롭)
            let sourceX = 0
            let sourceY = 0
            let sourceWidth = img.width
            let sourceHeight = img.height
            
            if (img.width === img.height) {
              // 정확히 1:1인 경우
              const cropSize = img.width / zoomScale
              const maxOffsetX = (img.width - cropSize) * zoomProgress
              
              if (zoomDirection === "left-to-right") {
                sourceX = maxOffsetX
              } else {
                sourceX = (img.width - cropSize) - maxOffsetX
              }
              sourceY = (img.height - cropSize) / 2
              sourceWidth = cropSize
              sourceHeight = cropSize
            } else {
              // 16:9 또는 다른 비율인 경우, 중앙에서 1:1 영역만 크롭하여 표시
              const sourceSize = Math.min(img.width, img.height)
              const cropSize = sourceSize / zoomScale
              const maxOffsetX = (sourceSize - cropSize) * zoomProgress
              
              // 16:9 이미지의 경우 가로가 길므로, 중앙에서 세로 높이만큼만 크롭
              const baseX = (img.width - sourceSize) / 2
              const baseY = (img.height - sourceSize) / 2
              
              if (zoomDirection === "left-to-right") {
                sourceX = baseX + maxOffsetX
              } else {
                sourceX = baseX + (sourceSize - cropSize) - maxOffsetX
              }
              sourceY = baseY + (sourceSize - cropSize) / 2
              sourceWidth = cropSize
              sourceHeight = cropSize
            }
            
            // 크롭된 영역을 캔버스에 그리기
            ctx.drawImage(
              img,
              sourceX, sourceY, sourceWidth, sourceHeight,
              imageX, imageY, imageWidth, imageHeight
            )

            // 자막 그리기 (쇼츠 페이지와 동일한 방식)
            const subtitleText = currentLine.text
            ctx.font = "bold 60px Arial"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            
            // 화면 너비에 맞춰 자막 나누기 (좌우 여백 40px)
            const maxWidth = canvas.width - 80
            
            // splitIntoSubtitleLines 함수 (쇼츠 페이지와 동일)
            const splitIntoSubtitleLines = (text: string, audioBuffer?: AudioBuffer, totalDuration: number = 0): Array<{ text: string; startTime: number; endTime: number }> => {
              const words = text.split(" ").filter(w => w.trim().length > 0)
              if (words.length === 0) return [{ text, startTime: 0, endTime: totalDuration }]
              
              const result: Array<{ text: string; startTime: number; endTime: number }> = []
              
              // 각 단어의 예상 시작 시간 계산 (단어 길이 기반)
              let wordStartTimes: number[] = []
              if (audioBuffer && totalDuration > 0) {
                const totalChars = words.reduce((sum, w) => sum + w.length, 0)
                let currentTime = 0
                
                for (const word of words) {
                  const wordRatio = word.length / totalChars
                  const wordDuration = wordRatio * totalDuration
                  wordStartTimes.push(currentTime)
                  currentTime += wordDuration
                }
              } else {
                // Fallback: 균등 분배
                const timePerWord = totalDuration / words.length
                for (let i = 0; i < words.length; i++) {
                  wordStartTimes.push(i * timePerWord)
                }
              }
              
              // 단어들을 묶어서 자막 라인 생성 (화면 너비에 맞춰)
              let currentSubtitleLine: string[] = []
              let lineStartTime = 0
              
              for (let i = 0; i < words.length; i++) {
                const word = words[i]
                const testLine = currentSubtitleLine.length > 0 ? currentSubtitleLine.join(" ") + " " + word : word
                const textWidth = ctx.measureText(testLine).width
                
                // 화면 너비를 초과하면 줄 분리
                if (textWidth > maxWidth && currentSubtitleLine.length >= 1) {
                  if (currentSubtitleLine.length > 0) {
                    const lineEndTime = i < wordStartTimes.length ? wordStartTimes[i] : totalDuration
                    result.push({
                      text: currentSubtitleLine.join(" "),
                      startTime: lineStartTime,
                      endTime: lineEndTime,
                    })
                  }
                  currentSubtitleLine = [word]
                  lineStartTime = wordStartTimes[i] || (i * (totalDuration / words.length))
                } else {
                  currentSubtitleLine.push(word)
                }
              }
              
              // 마지막 줄 처리
              if (currentSubtitleLine.length > 0) {
                result.push({
                  text: currentSubtitleLine.join(" "),
                  startTime: lineStartTime,
                  endTime: totalDuration,
                })
              }
              
              return result.length > 0 ? result : [{ text, startTime: 0, endTime: totalDuration }]
            }
            
            // 오디오 버퍼 기반으로 자막 라인 생성
            const audioDuration = (currentLine.endTime - currentLine.startTime) / 1000
            const subtitleLines = splitIntoSubtitleLines(subtitleText, undefined, audioDuration)
            
            // 현재 시간에 맞는 자막 라인 찾기
            const timeInLine = elapsed - (currentLine.startTime / 1000)
            const currentSubtitleLine = subtitleLines.find(
              (line) => timeInLine >= line.startTime && timeInLine <= line.endTime
            ) || subtitleLines[0] || { text: subtitleText, startTime: 0, endTime: audioDuration }
            
            const displayLine = currentSubtitleLine.text

            // 자막 배경 (한 줄만 표시하므로 고정 높이)
            const subtitleHeight = 100
            ctx.fillStyle = "rgba(0, 0, 0, 0.75)"
            ctx.fillRect(0, canvas.height - subtitleHeight - 250, canvas.width, subtitleHeight)

            // 자막 텍스트 (한 줄만 표시, 화면 너비 확인)
            ctx.fillStyle = "white"
            // 텍스트가 여전히 너무 길면 자르기
            let finalText = displayLine
            if (ctx.measureText(finalText).width > maxWidth) {
              // 텍스트를 자르고 "..." 추가
              while (ctx.measureText(finalText + "...").width > maxWidth && finalText.length > 0) {
                finalText = finalText.slice(0, -1)
              }
              finalText = finalText + "..."
            }
            ctx.fillText(finalText, canvas.width / 2, canvas.height - 250 - 50)
          }
        }

        if (!audio.paused && elapsed < actualAudioDuration) {
          requestAnimationFrame(renderFrame)
        } else {
          mediaRecorder.stop()
          audio.pause()
        }
      }

      renderFrame()
    } catch (error) {
      console.error("쇼츠 영상 렌더링 실패:", error)
      alert("쇼츠 영상 렌더링에 실패했습니다.")
      setIsRenderingShorts(false)
    }
  }

  // AI 썸네일 다운로드 함수
  const handleDownloadAIThumbnail = async () => {
    if (!aiThumbnailUrl) {
      alert("다운로드할 썸네일이 없습니다.")
      return
    }

    try {
      const response = await fetch(aiThumbnailUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ai-thumbnail-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("썸네일 다운로드 실패:", error)
      alert("썸네일 다운로드에 실패했습니다.")
    }
  }

  const updateTextStyle = (index: number, property: string, value: any) => {
    setTextStyles((prev) => prev.map((style, i) => (i === index ? { ...style, [property]: value } : style)))
  }

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    if (e.detail === 2) return // 더블클릭 방지

    setIsDragging(true)
    setSelectedTextIndex(index)
    setSelectedImageElement(false) // 텍스트 선택 시 이미지 선택 해제

    const rect = e.currentTarget.getBoundingClientRect()
    const containerRect = e.currentTarget.closest(".thumbnail-container")?.getBoundingClientRect()
    if (!containerRect) return

    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || selectedTextIndex === null) return

    const containerRect = e.currentTarget.getBoundingClientRect()
    const newX = ((e.clientX - containerRect.left - dragOffset.x) / containerRect.width) * 100
    const newY = ((e.clientY - containerRect.top - dragOffset.y) / containerRect.height) * 100

    setTextPositions((prev) =>
      prev.map((pos, i) =>
        i === selectedTextIndex ? { x: Math.max(0, Math.min(80, newX)), y: Math.max(5, Math.min(90, newY)) } : pos,
      ),
    )
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // The original handleCanvasClick was removed because it was redeclared.
  // This is the correct implementation for the thumbnail canvas.
  const handleThumbnailCanvasClick = (e: React.MouseEvent) => {
    // 이벤트가 텍스트나 이미지에서 발생한 경우가 아니라면 선택 해제
    if (e.target === e.currentTarget) {
      setSelectedTextIndex(null)
      setSelectedImageElement(false)
      setShowSuggestions(false)
    }
  }

  const handleTextEdit = (index: number, newText: string) => {
    setThumbnailText((prev) => prev.map((text, i) => (i === index ? newText : text)))
  }

  const applySuggestedText = (suggestedText: string) => {
    if (selectedTextIndex !== null) {
      handleTextEdit(selectedTextIndex, suggestedText)
      setShowSuggestions(false)
    }
  }

  const handleScriptPlanGeneration = async () => {
    if (!selectedTopic && !customTopic) {
      alert("주제를 선택하거나 입력해주세요.")
      return
    }

    setIsGenerating(true)
    if (isAutoMode) {
      setAutoModeStep("대본 기획 생성 중...")
      setAutoModeProgress({ current: "1/7", total: 7 })
    }
    try {
      console.log("[v0] 대본 기획 생성 시작, 주제:", selectedTopic || customTopic)
      const topic = isCustomTopicSelected ? customTopic : selectedTopic
      const plan = await generateScriptPlan(topic, selectedCategory, undefined, getApiKey())
      console.log("[v0] 대본 기획 생성 완료")
      setScriptPlan(plan)
      setScriptDraft("") // 기획안이 새로 생성되면 초안 초기화
      setCompletedSteps((prev) => [...prev, "planning"])
      
      // 자동화 모드일 때 다음 단계 자동 진행
      if (isAutoMode) {
        console.log("[v0] 자동화 모드: 대본 초안 생성 시작")
        setTimeout(() => handleScriptDraftGeneration(), 1000)
      }
    } catch (error) {
      console.error("대본 기획 생성 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      alert(`대본 기획 생성에 실패했습니다: ${errorMessage}`)
      if (isAutoMode) {
        setIsAutoMode(false)
        setAutoModeStep("")
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleScriptDraftGeneration = async () => {
    if (!scriptPlan) {
      alert("대본 기획안을 먼저 생성해주세요.")
      return
    }

    setIsGenerating(true)
    if (isAutoMode) {
      setAutoModeStep("대본 초안 생성 중...")
      setAutoModeProgress({ current: "2/7", total: 7 })
    }
    try {
      console.log("[v0] 대본 초안 생성 시작")
      const topic = isCustomTopicSelected ? customTopic : selectedTopic
      const draft = await generateScriptDraft(scriptPlan, topic || "", getApiKey())
      console.log("[v0] 대본 초안 생성 완료")
      setScriptDraft(draft)
      // 대본 초안 생성 후 자동으로 대본 생성 단계로 이동
      setActiveStep("script")
      
      // 자동화 모드일 때 다음 단계 자동 진행 (대본 재구성)
      if (isAutoMode) {
        console.log("[v0] 자동화 모드: 대본 재구성 시작")
        setTimeout(() => {
          // generateFullScript 호출
          handleFullScriptGeneration()
        }, 1000)
      }
    } catch (error) {
      console.error("대본 초안 생성 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      alert(`대본 초안 생성에 실패했습니다: ${errorMessage}`)
      if (isAutoMode) {
        setIsAutoMode(false)
        setAutoModeStep("")
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleScriptImprovement = async () => {
    if (!scriptPlan || !improvementRequest.trim()) return

    setIsGenerating(true)
    try {
      console.log("[v0] 대본 개선 시작")
      const improvedScript = await improveScriptPlan(scriptPlan, improvementRequest)
      setScriptPlan(improvedScript)
      setImprovementRequest("")
      console.log("[v0] 대본 개선 완료")
    } catch (error) {
      console.error("대본 개선 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      alert(`대본 개선에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleScriptAnalysis = async () => {
    if (!scriptPlan) return

    setIsScanning(true)

    try {
      console.log("[v0] 대본 분석 시작")
      const analysis = await analyzeScriptPlan(scriptPlan, getApiKey())
      setAnalysisResult(analysis)
      console.log("[v0] 대본 분석 완료")
    } catch (error) {
      console.error("대본 분석 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      alert(`대본 분석에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsScanning(false)
    }
  }

  // 대본을 적절한 길이의 문장 그룹으로 나누는 함수
  const splitScriptIntoLines = (scriptText: string): Array<{ id: number; text: string }> => {
    // 문장 부호로 먼저 나누기
    const sentences = scriptText
      .split(/[.!?。！？]\s*/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0)
    
    const groupedLines: Array<{ id: number; text: string }> = []
    let currentGroup: string[] = []
    let lineId = 1
    const MAX_LINE_LENGTH = 200 // 한 문장 그룹의 최대 길이 (자)
    const MIN_LINE_LENGTH = 30 // 한 문장 그룹의 최소 길이 (자)
    const MAX_SINGLE_SENTENCE_LENGTH = 150 // 한 문장의 최대 길이 (자)
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]
      const currentGroupText = currentGroup.join(" ")
      const potentialGroupText = currentGroupText ? currentGroupText + " " + sentence : sentence
      
      // 한 문장이 너무 길면 쉼표나 연결어를 기준으로 더 나누기
      if (sentence.length > MAX_SINGLE_SENTENCE_LENGTH) {
        // 먼저 현재 그룹이 있으면 저장
        if (currentGroup.length > 0) {
          groupedLines.push({
            id: lineId++,
            text: currentGroup.join(" "),
          })
          currentGroup = []
        }
        
        // 긴 문장을 쉼표나 연결어를 기준으로 나누기
        const subParts = sentence.split(/([,，]\s*|그리고|또한|그런데|하지만|그러나|그래서|따라서|그러므로|그러면|그런)/)
        let subGroup: string[] = []
        
        for (const part of subParts) {
          const trimmedPart = part.trim()
          if (!trimmedPart) continue
          
          const subGroupText = subGroup.join(" ")
          const potentialSubGroupText = subGroupText ? subGroupText + " " + trimmedPart : trimmedPart
          
          // 하위 그룹이 최대 길이를 넘으면 저장하고 새로 시작
          if (potentialSubGroupText.length > MAX_LINE_LENGTH && subGroup.length > 0) {
            groupedLines.push({
              id: lineId++,
              text: subGroup.join(" "),
            })
            subGroup = [trimmedPart]
          } else {
            subGroup.push(trimmedPart)
          }
        }
        
        // 남은 하위 그룹 처리
        if (subGroup.length > 0) {
          const subGroupText = subGroup.join(" ")
          // 최소 길이를 만족하면 별도 그룹으로, 아니면 다음 문장과 합치기
          if (subGroupText.length >= MIN_LINE_LENGTH) {
            groupedLines.push({
              id: lineId++,
              text: subGroupText,
            })
          } else {
            currentGroup = [...subGroup]
          }
        }
      } 
      // 현재 그룹에 추가했을 때 최대 길이를 넘으면 저장하고 새로 시작
      else if (potentialGroupText.length > MAX_LINE_LENGTH && currentGroup.length > 0) {
        groupedLines.push({
          id: lineId++,
          text: currentGroup.join(" "),
        })
        currentGroup = [sentence]
      }
      // 2개 문장이 모이고 최소 길이를 만족하면 묶기
      else if (currentGroup.length >= 2 && potentialGroupText.length >= MIN_LINE_LENGTH) {
        groupedLines.push({
          id: lineId++,
          text: potentialGroupText,
        })
        currentGroup = []
      }
      // 그 외에는 현재 그룹에 추가
      else {
        currentGroup.push(sentence)
      }
    }
    
    // 남은 문장들 처리
    if (currentGroup.length > 0) {
      const remainingText = currentGroup.join(" ")
      // 최소 길이를 만족하면 저장, 아니면 이전 그룹에 합치기
      if (remainingText.length >= MIN_LINE_LENGTH || groupedLines.length === 0) {
        groupedLines.push({
          id: lineId++,
          text: remainingText,
        })
      } else if (groupedLines.length > 0) {
        // 마지막 그룹에 합치기
        const lastIndex = groupedLines.length - 1
        groupedLines[lastIndex] = {
          ...groupedLines[lastIndex],
          text: groupedLines[lastIndex].text + " " + remainingText,
        }
      }
    }
    
    // ID 재정렬
    return groupedLines.map((l, index) => ({ ...l, id: index + 1 }))
  }

  const handleFullScriptGeneration = async () => {
    if (!scriptDraft) {
      alert("대본 초안을 먼저 생성해주세요.")
      return
    }

    setIsGenerating(true)
    try {
      console.log("[v0] 최종 대본 생성 시작")
      const topic = isCustomTopicSelected ? customTopic : selectedTopic
      // 선택한 시간에 맞춰 대본 길이 계산 (1초당 6.9자)
      const targetChars = Math.floor(scriptDuration * 60 * 6.9)
      const fullScript = await generateFinalScript(scriptDraft, topic || "", getApiKey(), scriptDuration, targetChars)
      setScript(fullScript)
      
      // 대본을 문장 단위로 분리하고 적절한 길이로 묶기
      const groupedLines = splitScriptIntoLines(fullScript)
      
      setScriptLines(groupedLines)
      setCompletedSteps((prev) => [...prev, "script"])
      console.log("[v0] 최종 대본 생성 완료, 문장 그룹 수:", groupedLines.length)
    } catch (error) {
      console.error("최종 대본 생성 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      alert(`최종 대본 생성에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDirectScriptSubmit = () => {
    if (!directScript.trim()) return

    setScript(directScript)
    
    // 대본을 문장 단위로 분리하고 적절한 길이로 묶기
    const groupedLines = splitScriptIntoLines(directScript)
    
    setScriptLines(groupedLines)
    setCompletedSteps((prev) => [...prev, "script"])
    setShowDirectScriptInput(false)
    console.log("[v0] 직접 입력된 대본 적용 완료, 문장 그룹 수:", groupedLines.length)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // 커스텀 이미지 생성 (한글 프롬프트 입력)
  const handleGenerateCustomImage = async (lineId: number) => {
    if (!customImagePrompt.trim()) {
      alert("이미지 설명을 입력해주세요.")
      return
    }

    const openaiApiKey = getApiKey("openai_api_key")
    const replicateApiKey = getApiKey("replicate_api_key")

    if (!openaiApiKey) {
      alert("OpenAI API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      return
    }

    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingCustomImage(true)
    try {
      // 한글 프롬프트를 영어로 변환
      console.log(`[v0] 커스텀 이미지 생성 시작 (줄 ${lineId}):`, customImagePrompt)
      
      // generateCustomPrompt 함수 사용
      const { generateCustomPrompt } = await import("./actions")
      let englishPrompt = await generateCustomPrompt(customImagePrompt, openaiApiKey)
      
      // 카테고리별 프롬프트 추가 (16:9 비율 강제)
      if (selectedCategory === "history" && historyStyle) {
        // 역사 카테고리는 generateImagePrompt 사용
        englishPrompt = await generateImagePrompt(customImagePrompt, openaiApiKey, "history", historyStyle)
      } else {
        // 다른 카테고리는 기본 프롬프트에 16:9 강제 추가
        if (!englishPrompt.toLowerCase().includes("16:9") && !englishPrompt.toLowerCase().includes("aspect ratio")) {
          englishPrompt = `${englishPrompt}, 16:9 aspect ratio, cinematic composition`
        }
      }
      
      console.log(`[v0] 변환된 영어 프롬프트:`, englishPrompt)

      // 이미지 생성
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scriptText: customImagePrompt,
          openaiApiKey,
          replicateApiKey,
          category: selectedCategory || "health",
          historyStyle: selectedCategory === "history" ? historyStyle : undefined,
          customPrompt: englishPrompt, // 직접 프롬프트 전달
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "이미지 생성 실패")
      }

      const data = await response.json()
      console.log(`[v0] 커스텀 이미지 생성 완료:`, data.imageUrl)

      // 생성된 이미지 업데이트
      setGeneratedImages((prev) => {
        const filtered = prev.filter((img) => img.lineId !== lineId)
        return [
          ...filtered,
          {
            lineId: lineId,
            imageUrl: data.imageUrl,
            prompt: englishPrompt,
          },
        ]
      })

      setCustomImageDialogOpen(null)
      setCustomImagePrompt("")
      alert("이미지가 생성되었습니다!")
    } catch (error) {
      console.error(`[v0] 커스텀 이미지 생성 실패 (줄 ${lineId}):`, error)
      alert(`이미지 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingCustomImage(false)
    }
  }

  // 이미지 업로드 핸들러
  const handleImageUpload = async (lineId: number, file: File) => {
    try {
      // 16:9 비율로 이미지 리사이즈
      const resizedImage = await resizeImageTo16_9(file)
      
      // Base64로 변환
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        const imageUrl = base64

        // 업로드된 이미지 업데이트
        setGeneratedImages((prev) => {
          const filtered = prev.filter((img) => img.lineId !== lineId)
          return [
            ...filtered,
            {
              lineId: lineId,
              imageUrl: imageUrl,
              prompt: "사용자 업로드 이미지",
            },
          ]
        })

        alert("이미지가 업로드되었습니다!")
      }
      reader.readAsDataURL(resizedImage)
    } catch (error) {
      console.error(`[v0] 이미지 업로드 실패 (줄 ${lineId}):`, error)
      alert(`이미지 업로드에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    }
  }

  // 이미지를 16:9 비율로 리사이즈하는 함수
  const resizeImageTo16_9 = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas context를 가져올 수 없습니다."))
          return
        }

        // 16:9 비율 계산
        const targetAspect = 16 / 9
        const imgAspect = img.width / img.height

        let drawWidth = img.width
        let drawHeight = img.height
        let x = 0
        let y = 0

        if (imgAspect > targetAspect) {
          // 이미지가 더 넓음 - 높이 기준으로 크롭
          drawHeight = img.height
          drawWidth = img.height * targetAspect
          x = (img.width - drawWidth) / 2
        } else {
          // 이미지가 더 높음 - 너비 기준으로 크롭
          drawWidth = img.width
          drawHeight = img.width / targetAspect
          y = (img.height - drawHeight) / 2
        }

        canvas.width = 1920 // 고해상도
        canvas.height = 1080

        ctx.drawImage(img, x, y, drawWidth, drawHeight, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("이미지 변환에 실패했습니다."))
            return
          }
          const resizedFile = new File([blob], file.name, { type: "image/jpeg" })
          resolve(resizedFile)
        }, "image/jpeg", 0.9)
      }
      img.onerror = () => reject(new Error("이미지 로드에 실패했습니다."))
      img.src = URL.createObjectURL(file)
    })
  }

  // 선택한 이미지를 영상으로 변환하는 핸들러
  const handleConvertImagesToVideo = async () => {
    if (selectedImagesForVideo.size === 0) {
      alert("영상으로 변환할 이미지를 선택해주세요.")
      return
    }

    setIsConvertingToVideo(true)
    // 로컬스토리지에서 직접 가져오기 (다른 부분과 동일한 방식)
    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      setIsConvertingToVideo(false)
      return
    }

    try {
      const selectedImageIds = Array.from(selectedImagesForVideo)
      let successCount = 0

      for (const imageId of selectedImageIds) {
        const image = generatedImages.find((img) => img.lineId === imageId)
        if (!image) continue

        try {
          console.log(`[Video] 이미지-투-비디오 변환 시작 (문장 ${imageId}):`, image.imageUrl)
          
          // 서버 액션 호출
          const { convertImageToVideo } = await import("./actions")
          const videoUrl = await convertImageToVideo(image.imageUrl, replicateApiKey)
          
          if (videoUrl) {
            setConvertedVideos((prev) => {
              const newMap = new Map(prev)
              newMap.set(imageId, videoUrl)
              return newMap
            })
            successCount++
            console.log(`[Video] 이미지-투-비디오 변환 완료 (문장 ${imageId}):`, videoUrl)
          }
        } catch (error) {
          console.error(`[Video] 이미지-투-비디오 변환 실패 (문장 ${imageId}):`, error)
          // 실패해도 계속 진행
        }
      }

      if (successCount > 0) {
        alert(`${successCount}개의 이미지가 영상으로 변환되었습니다!`)
        // 선택 해제
        setSelectedImagesForVideo(new Set())
      } else {
        alert("영상 변환에 실패했습니다. 다시 시도해주세요.")
      }
    } catch (error) {
      console.error("[Video] 영상 변환 실패:", error)
      alert("영상 변환 중 오류가 발생했습니다.")
    } finally {
      setIsConvertingToVideo(false)
    }
  }

  // 새로운 이미지 생성 핸들러 (문장 리스트 기반)
  const handleGenerateImagesForLines = async () => {
    if (scriptLines.length === 0) {
      alert("생성된 문장 리스트가 없습니다. 먼저 대본을 생성해주세요.")
      return
    }

    const openaiApiKey = getApiKey("openai_api_key")
    const replicateApiKey = getApiKey("replicate_api_key")

    if (!openaiApiKey) {
      alert("OpenAI API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      if (isAutoMode) {
        setIsAutoMode(false)
        setAutoModeStep("")
      }
      return
    }

    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      if (isAutoMode) {
        setIsAutoMode(false)
        setAutoModeStep("")
      }
      return
    }

    setIsGeneratingImages(true)
    if (isAutoMode) {
      setAutoModeStep("이미지 생성 중...")
      setAutoModeProgress({ current: "4/7", total: 7 })
    }
    setImageGenerationProgress({ current: 0, total: scriptLines.length })
    // 기존 이미지 초기화
    setGeneratedImages([])

    let successCount = 0

    try {
      for (let i = 0; i < scriptLines.length; i++) {
        const line = scriptLines[i]
        setImageGenerationProgress({ current: i + 1, total: scriptLines.length })

        try {
          // API route를 통해 이미지 생성
          console.log(`[v0] 이미지 생성 중... (${i + 1}/${scriptLines.length})`)
          const response = await fetch("/api/generate-image", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              scriptText: line.text,
              openaiApiKey,
              replicateApiKey,
              category: selectedCategory || "health",
              historyStyle: selectedCategory === "history" ? historyStyle : undefined,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || "이미지 생성 실패")
          }

          const data = await response.json()
          console.log(`[v0] 이미지 생성 완료:`, data.imageUrl)

          // 이미지가 생성되면 즉시 state 업데이트 (실시간 표시)
          setGeneratedImages((prev) => [
            ...prev,
            {
              lineId: line.id,
              imageUrl: data.imageUrl,
              prompt: data.prompt,
            },
          ])
          successCount++
        } catch (error) {
          console.error(`[v0] 이미지 생성 실패 (줄 ${line.id}):`, error)
          // 실패해도 계속 진행
        }
      }

      console.log("[v0] 모든 이미지 생성 완료, 성공:", successCount, "개")
      
      // 이미지가 하나라도 생성되었으면 완료 표시
      if (successCount > 0) {
        setCompletedSteps((prev) => {
          if (!prev.includes("image")) return [...prev, "image"]
          return prev
        })
        if (!isAutoMode) {
          alert(`${successCount}개의 이미지가 생성되었습니다!`)
        }
        
        // 자동화 모드일 때 다음 단계 자동 진행 (TTS 생성)
        if (isAutoMode) {
          console.log("[v0] 자동화 모드: TTS 생성 시작")
          setTimeout(() => handleGenerateTTSForLines(), 2000)
        }
      } else {
        alert("이미지 생성에 실패했습니다. 다시 시도해주세요.")
        if (isAutoMode) {
          setIsAutoMode(false)
          setAutoModeStep("")
        }
      }
    } catch (error) {
      console.error("이미지 생성 실패:", error)
      alert("이미지 생성 중 오류가 발생했습니다.")
      if (isAutoMode) {
        setIsAutoMode(false)
        setAutoModeStep("")
      }
    } finally {
      setIsGeneratingImages(false)
      setImageGenerationProgress({ current: 0, total: 0 })
    }
  }

  // 목소리 미리듣기 함수
  const handlePreviewVoice = async (voiceId: string) => {
    const elevenlabsApiKey = getApiKey("elevenlabs_api_key")
    
    if (!elevenlabsApiKey) {
      alert("ElevenLabs API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      return
    }

    setPreviewingVoiceId(voiceId)
    
    try {
      const response = await fetch("/api/elevenlabs-tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: "윙스 AI에 오실걸 환영합니다",
          voiceId: voiceId,
          apiKey: elevenlabsApiKey,
        }),
      })

      if (!response.ok) {
        let errorMessage = "미리듣기 실패"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
        } catch (e) {
          const errorText = await response.text()
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      if (data.audioUrl) {
        setPreviewAudioUrl(data.audioUrl)
        // 오디오 재생
        const audio = new Audio(data.audioUrl)
        audio.play()
        audio.onended = () => {
          setPreviewingVoiceId(null)
          setPreviewAudioUrl(null)
        }
        audio.onerror = () => {
          setPreviewingVoiceId(null)
          setPreviewAudioUrl(null)
        }
      } else if (data.audioBase64) {
        // Base64를 Blob URL로 변환
        const binaryString = atob(data.audioBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: "audio/mpeg" })
        const audioUrl = URL.createObjectURL(blob)
        setPreviewAudioUrl(audioUrl)
        
        const audio = new Audio(audioUrl)
        audio.play()
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          setPreviewingVoiceId(null)
          setPreviewAudioUrl(null)
        }
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl)
          setPreviewingVoiceId(null)
          setPreviewAudioUrl(null)
        }
      }
    } catch (error) {
      console.error("미리듣기 실패:", error)
      alert(`미리듣기에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      setPreviewingVoiceId(null)
      setPreviewAudioUrl(null)
    }
  }

  // TTS 생성 핸들러 (문장 리스트 기반)
  const handleGenerateTTSForLines = async () => {
    if (scriptLines.length === 0) {
      alert("생성된 문장 리스트가 없습니다. 먼저 대본을 생성해주세요.")
      return
    }

    const elevenlabsApiKey = getApiKey("elevenlabs_api_key")

    if (!elevenlabsApiKey) {
      alert("ElevenLabs API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      if (isAutoMode) {
        setIsAutoMode(false)
        setAutoModeStep("")
      }
      return
    }

    setIsGeneratingTTS(true)
    if (isAutoMode) {
      setAutoModeStep("TTS 생성 중...")
      setAutoModeProgress({ current: "5/7", total: 7 })
    }
    setTtsGenerationProgress({ current: 0, total: scriptLines.length })
    // 기존 오디오 초기화
    setGeneratedAudios([])

    let successCount = 0

    try {
      for (let i = 0; i < scriptLines.length; i++) {
        const line = scriptLines[i]
        setTtsGenerationProgress({ current: i + 1, total: scriptLines.length })

        try {
          // ElevenLabs API를 통해 TTS 생성
          console.log(`[v0] TTS 생성 중... (${i + 1}/${scriptLines.length})`)
          const response = await fetch("/api/elevenlabs-tts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: line.text,
              voiceId: selectedVoiceId,
              apiKey: elevenlabsApiKey,
            }),
          })

          if (!response.ok) {
            let errorMessage = "TTS 생성 실패"
            try {
              const errorData = await response.json()
              errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
            } catch (e) {
              const errorText = await response.text()
              errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`
            }
            console.error(`[v0] TTS API 오류 (줄 ${line.id}):`, errorMessage)
            throw new Error(errorMessage)
          }

          const data = await response.json()
          
          if (!data.audioBase64 && !data.audioUrl) {
            console.error(`[v0] TTS 응답에 오디오 데이터 없음 (줄 ${line.id}):`, data)
            throw new Error("TTS 응답에 오디오 데이터가 없습니다.")
          }
          
          console.log(`[v0] TTS 생성 완료 (줄 ${line.id}):`, data.audioUrl ? "URL 있음" : "URL 없음", data.audioBase64 ? "Base64 있음" : "Base64 없음")

          // TTS가 생성되면 즉시 state 업데이트 (실시간 표시)
          setGeneratedAudios((prev) => [
            ...prev,
            {
              lineId: line.id,
              audioUrl: data.audioUrl,
              audioBase64: data.audioBase64,
            },
          ])
          successCount++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`[v0] TTS 생성 실패 (줄 ${line.id}):`, errorMessage)
          console.error(`[v0] 실패한 텍스트:`, line.text.substring(0, 50) + "...")
          // 실패해도 계속 진행하되, 사용자에게 알림
          if (i === 0) {
            // 첫 번째 실패 시에만 경고 (모든 실패는 마지막에 요약)
            console.warn(`[v0] 첫 번째 TTS 생성 실패. 계속 진행합니다...`)
          }
        }
      }

      console.log("[v0] 모든 TTS 생성 완료, 성공:", successCount, "개 / 전체:", scriptLines.length, "개")

      // TTS가 하나라도 생성되었으면 완료 표시
      if (successCount > 0) {
        setCompletedSteps((prev) => {
          if (!prev.includes("video")) return [...prev, "video"]
          return prev
        })
        
        if (!isAutoMode) {
          if (successCount < scriptLines.length) {
            alert(`${successCount}개의 TTS가 생성되었습니다. (${scriptLines.length - successCount}개 실패)\n\n실패한 항목은 브라우저 콘솔을 확인해주세요.`)
          } else {
            alert(`${successCount}개의 TTS가 모두 생성되었습니다!`)
          }
        }
        
        // 자동화 모드일 때 다음 단계 자동 진행 (영상 생성)
        if (isAutoMode) {
          console.log("[v0] 자동화 모드: 영상 생성 시작")
          setTimeout(() => handleRenderVideo(), 2000)
        }
      } else {
        const errorMessage = "TTS 생성에 실패했습니다.\n\n가능한 원인:\n1. ElevenLabs API 키가 올바르지 않습니다\n2. API 키의 사용량이 초과되었습니다\n3. 네트워크 연결 문제\n\n브라우저 콘솔(F12)에서 자세한 오류를 확인해주세요."
        alert(errorMessage)
        if (isAutoMode) {
          setIsAutoMode(false)
          setAutoModeStep("")
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error("TTS 생성 실패:", errorMessage, error)
      alert(`TTS 생성 중 오류가 발생했습니다:\n\n${errorMessage}\n\n브라우저 콘솔(F12)에서 자세한 오류를 확인해주세요.`)
      if (isAutoMode) {
        setIsAutoMode(false)
        setAutoModeStep("")
      }
    } finally {
      setIsGeneratingTTS(false)
      setTtsGenerationProgress({ current: 0, total: 0 })
    }
  }

  const handleAutoGenerateImages = async () => {
    if (!script) {
      alert("대본이 필요합니다.")
      return
    }

    setIsLoadingAutoImages(true)
    try {
      console.log("[v0] 대본 분석 및 이미지 자동 생성 시작")

      // 1. 대본에서 키워드 추출
      const keywords = await extractKeywordsFromScript(script)
      console.log("[v0] 추출된 키워드:", keywords)

      // 2. 각 키워드로 이미지 검색
      const keywordResults = []
      for (let i = 0; i < keywords.length; i++) {
        const item = keywords[i]
        try {
          const response = await fetch(`/api/unsplash-search?query=${encodeURIComponent(item.keyword)}`)
          const data = await response.json()

          if (data.images && data.images.length > 0) {
            const image = data.images[0] // 첫 번째 이미지 선택
            keywordResults.push({
              keyword: item.keyword,
              time: i * 15, // 각 키워드마다 15초 간격으로 시간 할당
              imageUrl: image.url,
            })
          }
        } catch (error) {
          console.error(`이미지 검색 실패 (${item.keyword}):`, error)
        }
      }

      const newAutoImages: AutoImage[] = keywordResults.map((result) => ({
        id: `auto-${Date.now()}-${Math.random()}`,
        url: result.imageUrl,
        keyword: result.keyword,
        startTime: result.time,
        endTime: result.time + 15, // 15초 동안 표시
        motion: ["zoom-in", "zoom-out", "pan-left", "pan-right", "static"][
          Math.floor(Math.random() * 5)
        ] as AutoImage["motion"],
      }))

      setAutoImages(newAutoImages)
      console.log("[v0] 자동 이미지 생성 완료:", newAutoImages.length, "개")
      alert(`${newAutoImages.length}개의 이미지가 자동으로 추가되었습니다!`)
    } catch (error) {
      console.error("자동 이미지 생성 실패:", error)
      alert("자동 이미지 생성에 실패했습니다.")
    } finally {
      setIsLoadingAutoImages(false)
    }
  }

  // CHANGE: handleGenerateVideo를 API Route 호출로 변경
  const handleGenerateVideo = async () => {
    // Using script and generatedImage as they are defined in the component's state
    if (!script.trim()) {
      alert("대본을 입력해주세요.")
      return
    }

    setIsGeneratingVideo(true)
    setGeneratingVideoProgress(0) // Reset progress

    try {
      console.log("[v0] 영상 생성 시작")

      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          script: script,
          voiceModel: "ko-KR-Neural2-C",
          autoImages: autoImages,
          userApiKey: userTtsApiKey, // Using the state variable for the API key
          characterImage: generatedImage, // Passing the generated character image
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "영상 생성 실패")
      }

      // Stream the response for progress updates
      const reader = response.body?.getReader()
      let receivedLength = 0
      const chunks = []

      while (true) {
        const { done, value } = await reader!.read()
        if (done) break

        const chunkText = new TextDecoder().decode(value, { stream: true })
        chunks.push(chunkText)

        // Process chunks to update progress (this part might need refinement based on API response format)
        try {
          const progressData = JSON.parse(chunkText)
          if (progressData.progress !== undefined) {
            setGeneratingVideoProgress(progressData.progress)
            console.log(`[v0] 영상 생성 진행률: ${progressData.progress}%`)
          }
          if (progressData.audioBase64) {
            receivedLength += progressData.audioBase64.length
          }
        } catch (e) {
          // Ignore if not a progress update JSON
        }
      }

      const fullResponseText = chunks.join("")
      const result = JSON.parse(fullResponseText) // Assume the final response is JSON

      console.log(`[v0] Base64 오디오 데이터 수신, 크기: ${Math.round(receivedLength / 1024)} KB`)

      // Base64를 Blob URL로 변환
      const binaryString = atob(result.audioBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: "audio/mpeg" }) // Use mpeg for compatibility
      const audioUrl = URL.createObjectURL(blob)

      console.log("[v0] Blob URL 생성 완료:", audioUrl)

      const audio = new Audio(audioUrl)
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener("loadedmetadata", () => {
          const realDuration = audio.duration
          console.log(
            `[v0] 실제 오디오 길이: ${realDuration.toFixed(3)}초 (서버 계산: ${result.duration.toFixed(3)}초)`,
          )

          const scaleFactor = realDuration / result.duration
          console.log(`[v0] 자막 타이밍 스케일 팩터: ${scaleFactor.toFixed(3)}`)

          const scaledSubtitles = result.subtitles.map((s: any, index: number) => ({
            id: index + 1,
            text: s.text,
            start: s.start * scaleFactor,
            end: s.end * scaleFactor,
          }))

          setVideoData({
            audioUrl,
            subtitles: scaledSubtitles,
            duration: realDuration,
          })

          setCompletedSteps((prev) => [...prev, "video"]) // Mark video step as completed
          resolve()
        })
        audio.addEventListener("error", reject)
      })

      console.log("[v0] 영상 생성 완료")
    } catch (error) {
      console.error("[v0] 영상 생성 실패:", error)
      alert(`영상 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingVideo(false)
      setGeneratingVideoProgress(0) // Reset progress
    }
  }

  // <-- FFmpeg 초기화 함수 추가 -->
  // const loadFFmpeg = async () => {
  //   if (ffmpegRef.current) return

  //   const ffmpeg = new FFmpeg()
  //   ffmpegRef.current = ffmpeg

  //   ffmpeg.on("log", ({ message }) => {
  //     console.log("[v0] FFmpeg:", message)
  //   })

  //   ffmpeg.on("progress", ({ progress }) => {
  //     setExportProgress(Math.round(progress * 100))
  //   })

  //   try {
  //     const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm"
  //     await ffmpeg.load({
  //       coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
  //       wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  //       workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript"),
  //     })
  //     setFfmpegLoaded(true)
  //     console.log("[v0] FFmpeg 로드 완료")
  //   } catch (error) {
  //     console.error("[v0] FFmpeg 로드 실패:", error)
  //     alert("FFmpeg 로드에 실패했습니다. 기존 브라우저 방식으로 전환합니다.")
  //     setFfmpegLoaded(false)
  //   }
  // }

  // useEffect(() => {
  //   loadFFmpeg()
  // }, [])

  // 오디오 버퍼를 WAV로 변환하는 헬퍼 함수
  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length
    const numberOfChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const bytesPerSample = 2
    const blockAlign = numberOfChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = length * blockAlign
    const bufferSize = 44 + dataSize

    const arrayBuffer = new ArrayBuffer(bufferSize)
    const view = new DataView(arrayBuffer)

    // WAV 헤더 작성
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, "RIFF")
    view.setUint32(4, bufferSize - 8, true)
    writeString(8, "WAVE")
    writeString(12, "fmt ")
    view.setUint32(16, 16, true) // fmt chunk size
    view.setUint16(20, 1, true) // audio format (1 = PCM)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, 16, true) // bits per sample
    writeString(36, "data")
    view.setUint32(40, dataSize, true)

    // 오디오 데이터 작성
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
        offset += 2
      }
    }

    return arrayBuffer
  }

  // 영상 미리보기 생성 핸들러 (클라이언트 사이드에서 오디오 합치고 자막 생성)
  const handleRenderVideo = async () => {
    if (scriptLines.length === 0 || generatedImages.length === 0 || generatedAudios.length === 0) {
      alert("이미지, TTS, 대본이 모두 준비되어야 합니다.")
      return
    }

    setIsGeneratingVideo(true)
    setGeneratingVideoProgress(0)

    try {
      console.log("[v0] 영상 렌더링 시작")

      // 1. 각 TTS 오디오의 정확한 길이 측정 (AudioBuffer 사용)
      const audioDurations: Array<{ lineId: number; duration: number; audioBuffer?: AudioBuffer }> = []
      const audioContextForAnalysis = new (window.AudioContext || (window as any).webkitAudioContext)()

      for (const line of scriptLines) {
        const audio = generatedAudios.find((a) => a.lineId === line.id)
        if (audio) {
          try {
            // AudioBuffer로 로드하여 정확한 duration 측정
            const audioResponse = await fetch(audio.audioUrl)
            const audioArrayBuffer = await audioResponse.arrayBuffer()
            const audioBuffer = await audioContextForAnalysis.decodeAudioData(audioArrayBuffer)
            
            // 정확한 duration (샘플 수 / 샘플레이트)
            const preciseDuration = audioBuffer.duration
            
            audioDurations.push({
              lineId: line.id,
              duration: preciseDuration,
              audioBuffer: audioBuffer, // 나중에 웨이브폼 분석에 사용
            })
            
            console.log(`[v0] 오디오 ${line.id} 정확한 길이: ${preciseDuration.toFixed(3)}초`)
          } catch (error) {
            console.error(`오디오 로드 실패 (줄 ${line.id}):`, error)
            // Fallback: AudioElement 사용
            const audioElement = new Audio(audio.audioUrl)
            await new Promise((resolve) => {
              audioElement.addEventListener("loadedmetadata", () => {
                audioDurations.push({
                  lineId: line.id,
                  duration: audioElement.duration,
                })
                resolve(null)
              })
              audioElement.addEventListener("error", () => {
                audioDurations.push({
                  lineId: line.id,
                  duration: 0,
                })
                resolve(null)
              })
            })
          }
        }
      }

      // 2. 자막 생성 (각 문장을 여러 줄로 나누어 정확한 타이밍 계산)
      const subtitles: Array<{ id: number; start: number; end: number; text: string }> = []
      
      // splitIntoSubtitleLines 함수 (단어 단위로 나누어 TTS와 정확히 동기화)
      const splitIntoSubtitleLines = (text: string, audioBuffer?: AudioBuffer, totalDuration: number = 0): Array<{ text: string; startTime: number; endTime: number }> => {
        const words = text.split(" ").filter(w => w.trim().length > 0)
        if (words.length === 0) return [{ text, startTime: 0, endTime: totalDuration }]
        
        const result: Array<{ text: string; startTime: number; endTime: number }> = []
        
        // 오디오 버퍼가 있으면 웨이브폼 분석으로 침묵 구간 찾기
        let silenceThreshold = 0.01 // 침묵 임계값
        let wordStartTimes: number[] = []
        
        if (audioBuffer && totalDuration > 0) {
          // 각 단어의 예상 시작 시간 계산 (단어 길이 기반)
          const totalChars = words.reduce((sum, w) => sum + w.length, 0)
          let currentTime = 0
          
          for (const word of words) {
            const wordRatio = word.length / totalChars
            const wordDuration = wordRatio * totalDuration
            wordStartTimes.push(currentTime)
            currentTime += wordDuration
          }
        } else {
          // Fallback: 균등 분배
          const timePerWord = totalDuration / words.length
          for (let i = 0; i < words.length; i++) {
            wordStartTimes.push(i * timePerWord)
          }
        }
        
        // 단어들을 묶어서 자막 라인 생성 (공백 포함 최대 25자)
        let currentLine: string[] = []
        let lineStartTime = 0
        const maxChars = 25 // 공백 포함 25자까지
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i]
          const testLine = currentLine.length > 0 ? currentLine.join(" ") + " " + word : word
          
          // 25자를 초과하면 줄 분리 (25자까지는 나오도록)
          if (testLine.length > maxChars && currentLine.length >= 1) {
            if (currentLine.length > 0) {
              const lineEndTime = i < wordStartTimes.length ? wordStartTimes[i] : totalDuration
              result.push({
                text: currentLine.join(" "),
                startTime: lineStartTime,
                endTime: lineEndTime,
              })
            }
            currentLine = [word]
            lineStartTime = wordStartTimes[i] || (i * (totalDuration / words.length))
          } else {
            currentLine.push(word)
          }
        }
        
        // 마지막 줄 처리
        if (currentLine.length > 0) {
          result.push({
            text: currentLine.join(" "),
            startTime: lineStartTime,
            endTime: totalDuration,
          })
        }
        
        return result.length > 0 ? result : [{ text, startTime: 0, endTime: totalDuration }]
      }

      let subtitleTime = 0
      let subtitleId = 1

      for (const line of scriptLines) {
        const audioData = audioDurations.find((d) => d.lineId === line.id)
        const audioDuration = audioData?.duration || 0
        const audioBuffer = audioData?.audioBuffer
        
        if (audioDuration > 0) {
          // 문장을 단어 단위로 나누고 오디오 버퍼를 사용해 정확한 타이밍 계산
          const subtitleLines = splitIntoSubtitleLines(line.text, audioBuffer, audioDuration)
          
          // 각 자막 생성 (오디오 버퍼 분석 기반 정확한 타이밍)
          for (let j = 0; j < subtitleLines.length; j++) {
            const subtitleLine = subtitleLines[j]
            const start = subtitleTime + subtitleLine.startTime
            const end = subtitleTime + subtitleLine.endTime

            subtitles.push({
              id: subtitleId++,
              start: Number.parseFloat(start.toFixed(3)), // 0.001초 단위로 정밀도 향상
              end: Number.parseFloat(end.toFixed(3)),
              text: subtitleLine.text,
            })
          }

          subtitleTime += audioDuration
        }
      }

      // 3. 이미지 매핑 (문장 그룹별)
      const autoImages: Array<{
        id: string
        url: string
        startTime: number
        endTime: number
        keyword: string
        motion?: string
      }> = []

      let imageTime = 0
      for (const line of scriptLines) {
        const image = generatedImages.find((img) => img.lineId === line.id)
        const audioDuration = audioDurations.find((d) => d.lineId === line.id)?.duration || 0

        if (image) {
          // 같은 이미지를 사용하는 문장 그룹 찾기
          const sameImageLines = scriptLines.filter((l) => {
            const img = generatedImages.find((img) => img.lineId === l.id)
            return img && img.imageUrl === image.imageUrl
          })

          // 이미지 시작 시간 계산
          const imageStartTime = imageTime

          // 이미지 종료 시간 계산 (같은 이미지를 사용하는 모든 문장의 TTS 길이 합)
          let imageEndTime = imageStartTime
          for (const sameLine of sameImageLines) {
            const duration = audioDurations.find((d) => d.lineId === sameLine.id)?.duration || 0
            imageEndTime += duration
          }

          // 이미지가 이미 추가되지 않았으면 추가
          if (!autoImages.find((img) => img.startTime === imageStartTime)) {
            autoImages.push({
              id: `image_${line.id}`,
              url: image.imageUrl,
              startTime: imageStartTime,
              endTime: imageEndTime,
              keyword: `문장 ${line.id}`,
              motion: "static",
            })
          }

          imageTime += audioDuration
        } else {
          // 이미지가 없으면 시간만 진행
          imageTime += audioDuration
        }
      }

      // 4. 모든 TTS 오디오를 하나로 합치기
      const calculatedTotalDuration = audioDurations.reduce((sum, d) => sum + d.duration, 0)

      // 첫 번째 이미지를 기본 배경으로 사용
      const firstImage = generatedImages[0]
      if (!firstImage) {
        throw new Error("이미지가 없습니다.")
      }

      // 5. 모든 오디오를 순차적으로 합치기 (Web Audio API 사용)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioBuffers: AudioBuffer[] = []

      for (const line of scriptLines) {
        const audio = generatedAudios.find((a) => a.lineId === line.id)
        if (audio) {
          try {
            const audioResponse = await fetch(audio.audioUrl)
            const audioArrayBuffer = await audioResponse.arrayBuffer()
            const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer)
            audioBuffers.push(audioBuffer)
          } catch (error) {
            console.error(`오디오 디코딩 실패 (줄 ${line.id}):`, error)
            // 실패한 오디오는 무시하고 계속 진행
          }
        }
      }

      if (audioBuffers.length === 0) {
        throw new Error("합칠 수 있는 오디오가 없습니다.")
      }

      // 모든 오디오 버퍼를 하나로 합치기
      const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0)
      const numberOfChannels = audioBuffers[0].numberOfChannels
      const sampleRate = audioBuffers[0].sampleRate

      const mergedBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate)

      let offset = 0
      for (const buffer of audioBuffers) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const mergedData = mergedBuffer.getChannelData(channel)
          const bufferData = buffer.getChannelData(channel)
          mergedData.set(bufferData, offset)
        }
        offset += buffer.length
      }

      // 병합된 오디오의 실제 길이 측정 (샘플 수 / 샘플레이트)
      const actualMergedDuration = mergedBuffer.duration
      console.log(`[v0] 계산된 총 길이: ${calculatedTotalDuration.toFixed(3)}초, 실제 병합된 오디오 길이: ${actualMergedDuration.toFixed(3)}초`)
      
      // 실제 병합된 오디오 길이와 계산된 길이의 비율 계산
      const durationRatio = actualMergedDuration > 0 && calculatedTotalDuration > 0 
        ? actualMergedDuration / calculatedTotalDuration 
        : 1.0
      
      console.log(`[v0] Duration ratio: ${durationRatio.toFixed(4)}`)
      
      // 자막 타이밍을 실제 병합된 오디오 길이에 맞춰 조정
      if (durationRatio !== 1.0) {
        console.log(`[v0] 자막 타이밍 조정 중... (ratio: ${durationRatio.toFixed(4)})`)
        for (let i = 0; i < subtitles.length; i++) {
          const originalStart = subtitles[i].start
          const originalEnd = subtitles[i].end
          subtitles[i].start = Number.parseFloat((originalStart * durationRatio).toFixed(3))
          subtitles[i].end = Number.parseFloat((originalEnd * durationRatio).toFixed(3))
        }
        
        // 이미지 타이밍도 조정
        for (let i = 0; i < autoImages.length; i++) {
          const originalStart = autoImages[i].startTime
          const originalEnd = autoImages[i].endTime
          autoImages[i].startTime = Number.parseFloat((originalStart * durationRatio).toFixed(3))
          autoImages[i].endTime = Number.parseFloat((originalEnd * durationRatio).toFixed(3))
        }
        console.log(`[v0] 자막 및 이미지 타이밍 조정 완료`)
      }
      
      // 실제 병합된 오디오 길이를 사용
      const totalDuration = actualMergedDuration

      // 미리보기용 오디오는 원본 품질 유지 (압축하지 않음)
      // 압축은 다운로드 시에만 적용
      console.log("[v0] 미리보기용 오디오 생성 (원본 품질 유지)")

      // 합쳐진 오디오를 WAV로 변환 (원본 그대로)
      const wav = audioBufferToWav(mergedBuffer)
      const uint8Array = new Uint8Array(wav)
      
      // 큰 배열을 안전하게 base64로 변환 (chunk 단위로 처리)
      let binaryString = ""
      const chunkSize = 8192 // 8KB씩 처리
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize)
        binaryString += String.fromCharCode.apply(null, Array.from(chunk))
      }
      const audioBase64 = btoa(binaryString)

      console.log("[v0] 미리보기 생성 시작")
      console.log("[v0] 자막 수:", subtitles.length)
      console.log("[v0] 이미지 수:", autoImages.length)
      console.log("[v0] 총 영상 길이:", totalDuration, "초")

      // 6. 합쳐진 오디오를 Blob URL로 변환
      const audioBlob = new Blob([wav], { type: "audio/wav" })
      const audioUrl = URL.createObjectURL(audioBlob)

      console.log("[v0] 오디오 Blob URL 생성 완료:", audioUrl)

      // 7. videoData에 저장 (미리보기용) - autoImages도 함께 저장
      setVideoData({
        audioUrl,
        subtitles,
        duration: totalDuration,
        autoImages: autoImages.map((img) => ({
          id: img.id,
          url: img.url,
          startTime: img.startTime,
          endTime: img.endTime,
          keyword: img.keyword,
          motion: (img.motion || "static") as "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "static",
        })),
      })

      // 8. autoImages도 state에 저장 (미리보기에서 사용)
      setAutoImages(autoImages.map((img) => ({
        id: img.id,
        url: img.url,
        startTime: img.startTime,
        endTime: img.endTime,
        keyword: img.keyword,
        motion: (img.motion || "static") as "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "static",
      })))

      console.log("[v0] 미리보기 데이터 생성 완료")
      setIsGeneratingVideo(false)
      setGeneratingVideoProgress(100)
      
      // 자동화 모드일 때 다음 단계 자동 진행 (빠른다운로드)
      if (isAutoMode) {
        setAutoModeStep("빠른다운로드 중...")
        setAutoModeProgress({ current: "7/7", total: 7 })
        console.log("[v0] 자동화 모드: 빠른다운로드 시작")
        setTimeout(() => handleFastDownload(), 2000)
      } else {
        alert("영상 미리보기가 준비되었습니다!")
      }
    } catch (error) {
      console.error("[v0] 미리보기 생성 오류:", error)
      alert(`미리보기 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      setIsGeneratingVideo(false)
      setGeneratingVideoProgress(0)
      if (isAutoMode) {
        setIsAutoMode(false)
        setAutoModeStep("")
      }
    }
  }

  // 빠른다운로드: Cloud Run 사용
  const handleFastDownload = async () => {
    if (!videoData || scriptLines.length === 0 || generatedImages.length === 0 || generatedAudios.length === 0) {
      alert("영상 데이터가 없습니다. 먼저 미리보기를 생성해주세요.")
      return
    }

    setIsExporting(true)

    try {
      console.log("[v0] Cloud Run 렌더링 시작 (빠른다운로드)")

      // 1. 오디오를 base64로 변환 (원본 그대로 전송, 압축 없음)
      // 압축은 Cloud Run에서 FFmpeg로 처리하여 오디오 품질 보장
      const audioResponse = await fetch(videoData.audioUrl)
      const audioBlob = await audioResponse.blob()
      
      console.log("[v0] 원본 오디오 크기:", Math.round(audioBlob.size / 1024), "KB", "타입:", audioBlob.type)
      console.log("[v0] 클라이언트에서는 압축하지 않고 원본 그대로 전송합니다.")
      
      let processedAudioBlob: Blob = audioBlob
      
      try {
        // Web Audio API로 오디오 재인코딩 (샘플레이트 낮추기)
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const arrayBuffer = await audioBlob.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        console.log("[v0] 원본 샘플레이트:", audioBuffer.sampleRate, "Hz", audioBuffer.numberOfChannels, "채널")
        
        // 1단계: 11025Hz 모노로 통일 압축
        const firstStageSampleRate = 11025
        const firstStageChannels = 1
        
        const offlineContext = new OfflineAudioContext(
          firstStageChannels,
          Math.floor(audioBuffer.length * firstStageSampleRate / audioBuffer.sampleRate),
          firstStageSampleRate
        )
        
        const source = offlineContext.createBufferSource()
        
        // 스테레오를 모노로 변환
        if (audioBuffer.numberOfChannels > 1) {
          const merger = offlineContext.createChannelMerger(1)
          const splitter = offlineContext.createChannelSplitter(audioBuffer.numberOfChannels)
          
          source.buffer = audioBuffer
          source.connect(splitter)
          
          for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            const gainNode = offlineContext.createGain()
            gainNode.gain.value = 1 / audioBuffer.numberOfChannels
            splitter.connect(gainNode, i)
            gainNode.connect(merger, 0, 0)
          }
          
          merger.connect(offlineContext.destination)
        } else {
          source.connect(offlineContext.destination)
        }
        
        source.start()
        const firstStageBuffer = await offlineContext.startRendering()
        
        const firstStageWav = audioBufferToWav(firstStageBuffer)
        processedAudioBlob = new Blob([firstStageWav], { type: "audio/wav" })
        
        console.log(`[v0] 1단계 압축 완료 (${firstStageSampleRate}Hz 모노), 새 크기:`, Math.round(processedAudioBlob.size / 1024), "KB")
      } catch (error) {
        console.warn("[v0] 1단계 압축 실패, 원본 사용:", error)
        processedAudioBlob = audioBlob
      }
      
      // 2단계 압축: 크기에 따라 추가 압축
      // 빠른다운로드: 강한 압축 (20MB 이상이면 무조건 추가 압축)
      const compressionThreshold = 20 * 1024 * 1024
      
      if (processedAudioBlob.size > compressionThreshold) {
        console.log("[v0] 오디오 크기가 큽니다. 샘플레이트를 낮춰서 압축 시도...")
        
        try {
          // Web Audio API로 오디오 재인코딩 (샘플레이트 낮추기)
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const arrayBuffer = await audioBlob.arrayBuffer()
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
          
          console.log("[v0] 원본 샘플레이트:", audioBuffer.sampleRate, "Hz")
          
          // 빠른다운로드: 강한 압축 (8000Hz 모노)
          const targetSampleRate = 8000
          const targetChannels = 1 // 모두 모노로 변환
          
          const offlineContext = new OfflineAudioContext(
            targetChannels,
            Math.floor(audioBuffer.length * targetSampleRate / audioBuffer.sampleRate),
            targetSampleRate
          )
          
          const source = offlineContext.createBufferSource()
          
          // 스테레오를 모노로 변환 (두 채널 평균)
          if (audioBuffer.numberOfChannels > 1) {
            const merger = offlineContext.createChannelMerger(1)
            const splitter = offlineContext.createChannelSplitter(audioBuffer.numberOfChannels)
            
            source.buffer = audioBuffer
            source.connect(splitter)
            
            // 모든 채널을 모노로 합치기
            for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
              const gainNode = offlineContext.createGain()
              gainNode.gain.value = 1 / audioBuffer.numberOfChannels // 채널 수로 나눠서 평균
              splitter.connect(gainNode, i)
              gainNode.connect(merger, 0, 0)
            }
            
            merger.connect(offlineContext.destination)
          } else {
            source.connect(offlineContext.destination)
          }
          
          source.start()
          
          const resampledBuffer = await offlineContext.startRendering()
          
          // 다시 WAV로 변환
          const wav = audioBufferToWav(resampledBuffer)
          processedAudioBlob = new Blob([wav], { type: "audio/wav" })
          
          console.log(`[v0] 오디오 재인코딩 완료 (${targetSampleRate}Hz ${targetChannels === 1 ? "모노" : "스테레오"}), 새 크기:`, Math.round(processedAudioBlob.size / 1024), "KB")
        } catch (error) {
          console.warn("[v0] 오디오 재인코딩 실패, 원본 사용:", error)
          processedAudioBlob = audioBlob
        }
      }

      let audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64String = reader.result as string
          const base64 = base64String.split(",")[1]
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(audioBlob) // 원본 그대로 사용
      })

      let base64SizeMB = audioBase64.length / 1024 / 1024
      console.log("[v0] 오디오 base64 변환 완료, 크기:", Math.round(base64SizeMB * 1024), "KB", `(${base64SizeMB.toFixed(2)}MB)`)
      
      // Cloud Storage 사용 여부 결정 (30MB 이상이면 Cloud Storage 사용)
      const useCloudStorage = audioBase64.length > 30 * 1024 * 1024
      let audioGcsUrl: string | null = null
      
      if (useCloudStorage) {
        console.log("[v0] 오디오가 큽니다. Cloud Storage에 업로드합니다...")
        
        // Cloud Storage에 업로드
        const uploadResponse = await fetch("/api/upload-to-gcs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileBase64: audioBase64,
            fileName: `audio_${Date.now()}.wav`,
            contentType: "audio/wav",
          }),
        })
        
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || "Cloud Storage 업로드 실패")
        }
        
        const uploadResult = await uploadResponse.json()
        audioGcsUrl = uploadResult.url
        console.log("[v0] Cloud Storage 업로드 완료:", audioGcsUrl)
      }
      
      // base64 인코딩 후 크기 확인 (약 33% 증가, Cloud Run 제한 32MB)
      // 빠른다운로드: 28MB 이상이면 추가 압축 시도 (Cloud Storage 미사용 시)
      const additionalCompressionThreshold = 28 * 1024 * 1024
      
      if (!useCloudStorage && audioBase64.length > additionalCompressionThreshold) {
        console.warn("[v0] ⚠️ 오디오가 여전히 큽니다. 추가 압축 시도...")
        
        // 추가 압축: 더 낮은 샘플레이트로 재시도
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const arrayBuffer = await processedAudioBlob.arrayBuffer()
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
          
          // 빠른다운로드: 6000Hz 모노로 강하게 압축
          const ultraLowSampleRate = 6000
          const ultraLowChannels = 1
          
          const ultraOfflineContext = new OfflineAudioContext(
            ultraLowChannels,
            Math.floor(audioBuffer.length * ultraLowSampleRate / audioBuffer.sampleRate),
            ultraLowSampleRate
          )
          
          const ultraSource = ultraOfflineContext.createBufferSource()
          
          if (audioBuffer.numberOfChannels > 1) {
            const merger = ultraOfflineContext.createChannelMerger(1)
            const splitter = ultraOfflineContext.createChannelSplitter(audioBuffer.numberOfChannels)
            
            ultraSource.buffer = audioBuffer
            ultraSource.connect(splitter)
            
            for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
              const gainNode = ultraOfflineContext.createGain()
              gainNode.gain.value = 1 / audioBuffer.numberOfChannels
              splitter.connect(gainNode, i)
              gainNode.connect(merger, 0, 0)
            }
            
            merger.connect(ultraOfflineContext.destination)
          } else {
            ultraSource.connect(ultraOfflineContext.destination)
          }
          
          ultraSource.start()
          const ultraResampledBuffer = await ultraOfflineContext.startRendering()
          const ultraWav = audioBufferToWav(ultraResampledBuffer)
          processedAudioBlob = new Blob([ultraWav], { type: "audio/wav" })
          
          // 다시 base64로 변환
          audioBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => {
              const base64String = reader.result as string
              const base64 = base64String.split(",")[1]
              resolve(base64)
            }
            reader.onerror = reject
            reader.readAsDataURL(processedAudioBlob)
          })
          
          base64SizeMB = audioBase64.length / 1024 / 1024
          console.log(`[v0] 추가 압축 완료 (${ultraLowSampleRate}Hz 모노), 새 크기:`, Math.round(base64SizeMB * 1024), "KB", `(${base64SizeMB.toFixed(2)}MB)`)
          
          // 최종 압축 시도
          if (audioBase64.length > 28 * 1024 * 1024) {
            // 마지막 시도: 더 낮은 샘플레이트 (6000Hz)
            console.warn("[v0] ⚠️ 여전히 큽니다. 최종 압축 시도 (6000Hz)...")
            try {
              const finalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
              const finalArrayBuffer = await processedAudioBlob.arrayBuffer()
              const finalAudioBuffer = await finalAudioContext.decodeAudioData(finalArrayBuffer)
              
              const finalSampleRate = 6000
              const finalChannels = 1
              
              const finalOfflineContext = new OfflineAudioContext(
                finalChannels,
                Math.floor(finalAudioBuffer.length * finalSampleRate / finalAudioBuffer.sampleRate),
                finalSampleRate
              )
              
              const finalSource = finalOfflineContext.createBufferSource()
              
              if (finalAudioBuffer.numberOfChannels > 1) {
                const merger = finalOfflineContext.createChannelMerger(1)
                const splitter = finalOfflineContext.createChannelSplitter(finalAudioBuffer.numberOfChannels)
                
                finalSource.buffer = finalAudioBuffer
                finalSource.connect(splitter)
                
                for (let i = 0; i < finalAudioBuffer.numberOfChannels; i++) {
                  const gainNode = finalOfflineContext.createGain()
                  gainNode.gain.value = 1 / finalAudioBuffer.numberOfChannels
                  splitter.connect(gainNode, i)
                  gainNode.connect(merger, 0, 0)
                }
                
                merger.connect(finalOfflineContext.destination)
              } else {
                finalSource.connect(finalOfflineContext.destination)
              }
              
              finalSource.start()
              const finalResampledBuffer = await finalOfflineContext.startRendering()
              const finalWav = audioBufferToWav(finalResampledBuffer)
              processedAudioBlob = new Blob([finalWav], { type: "audio/wav" })
              
              audioBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => {
                  const base64String = reader.result as string
                  const base64 = base64String.split(",")[1]
                  resolve(base64)
                }
                reader.onerror = reject
                reader.readAsDataURL(processedAudioBlob)
              })
              
              base64SizeMB = audioBase64.length / 1024 / 1024
              console.log("[v0] 최종 압축 완료 (6000Hz 모노), 새 크기:", Math.round(base64SizeMB * 1024), "KB", `(${base64SizeMB.toFixed(2)}MB)`)
            } catch (finalError) {
              console.error("[v0] 최종 압축 실패:", finalError)
            }
            
            // 최종 확인
            if (audioBase64.length > 30 * 1024 * 1024) {
              alert(
                `오디오 파일이 너무 큽니다 (base64: ${base64SizeMB.toFixed(2)}MB). ` +
                `Cloud Run 요청 크기 제한(32MB)을 초과합니다. ` +
                `오디오 길이를 줄이거나 더 작은 파일로 다시 시도해주세요.`
              )
              setIsExporting(false)
              return
            }
          }
        } catch (error) {
          console.error("[v0] 추가 압축 실패:", error)
          alert(
            `오디오 파일이 너무 큽니다 (base64: ${base64SizeMB.toFixed(2)}MB). ` +
            `Cloud Run 요청 크기 제한(32MB)을 초과합니다. ` +
            `오디오 길이를 줄이거나 더 작은 파일로 다시 시도해주세요.`
          )
          setIsExporting(false)
          return
        }
      }

      // 2. 이미지 매핑 - videoData에 저장된 autoImages 사용 (없으면 재계산)
      let autoImagesForRender: Array<{
        id: string
        url: string
        startTime: number
        endTime: number
        keyword: string
        motion?: string
      }> = []

      if (videoData.autoImages && videoData.autoImages.length > 0) {
        // videoData에 저장된 autoImages 사용
        autoImagesForRender = videoData.autoImages
        console.log("[v0] videoData에서 autoImages 사용:", autoImagesForRender.length, "개")
      } else {
        // videoData에 없으면 재계산
        console.log("[v0] autoImages 재계산 중...")
        for (const line of scriptLines) {
          const image = generatedImages.find((img) => img.lineId === line.id)
          if (image) {
            // 해당 line의 자막들을 찾기
            const lineSubtitles = videoData.subtitles.filter((s) => {
              return s.text && line.text.includes(s.text.substring(0, Math.min(10, s.text.length)))
            })

            if (lineSubtitles.length > 0) {
              const startTime = Math.min(...lineSubtitles.map((s) => s.start))
              const endTime = Math.max(...lineSubtitles.map((s) => s.end))

              // 같은 이미지를 사용하는 문장 그룹 찾기
              const sameImageLines = scriptLines.filter((l) => {
                const img = generatedImages.find((img) => img.lineId === l.id)
                return img && img.imageUrl === image.imageUrl
              })

              // 같은 이미지를 사용하는 모든 문장의 자막 시간 범위 계산
              let imageStartTime = startTime
              let imageEndTime = endTime

              for (const sameLine of sameImageLines) {
                const sameLineSubtitles = videoData.subtitles.filter((s) => {
                  return s.text && sameLine.text.includes(s.text.substring(0, Math.min(10, s.text.length)))
                })
                if (sameLineSubtitles.length > 0) {
                  imageStartTime = Math.min(imageStartTime, Math.min(...sameLineSubtitles.map((s) => s.start)))
                  imageEndTime = Math.max(imageEndTime, Math.max(...sameLineSubtitles.map((s) => s.end)))
                }
              }

              // 이미지가 이미 추가되지 않았으면 추가
              if (!autoImagesForRender.find((img) => Math.abs(img.startTime - imageStartTime) < 0.1)) {
                autoImagesForRender.push({
                  id: `image_${line.id}`,
                  url: image.imageUrl,
                  startTime: imageStartTime,
                  endTime: imageEndTime,
                  keyword: `문장 ${line.id}`,
                  motion: "static",
                })
              }
            }
          }
        }
      }

      // 첫 번째 이미지를 기본 배경으로 사용
      const firstImage = generatedImages[0]
      if (!firstImage) {
        throw new Error("이미지가 없습니다.")
      }

      // 3. Cloud Run 렌더링 API 호출
      const renderResponse = await fetch("/api/ai/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Cloud Storage URL이 있으면 사용, 없으면 base64 사용
          ...(audioGcsUrl ? { audioGcsUrl } : { audioBase64 }),
          subtitles: videoData.subtitles.map((s) => ({
            id: s.id,
            start: s.start,
            end: s.end,
            text: s.text,
          })),
          characterImage: firstImage.imageUrl,
          autoImages: autoImagesForRender,
          duration: videoData.duration,
          config: {
            width: 1920,
            height: 1080,
            fps: 30,
          },
        }),
      })

      if (!renderResponse.ok) {
        const errorData = await renderResponse.json()
        throw new Error(errorData.error || "Cloud Run 렌더링 실패")
      }

      const renderResult = await renderResponse.json()

      if (!renderResult.success) {
        throw new Error("렌더링 결과를 받을 수 없습니다.")
      }

      console.log("[v0] Cloud Run 렌더링 완료")
      console.log("[v0] 렌더링 결과:", {
        hasVideoBase64: !!renderResult.videoBase64,
        hasVideoUrl: !!renderResult.videoUrl,
        videoUrl: renderResult.videoUrl,
      })

      let videoBlob: Blob

      // 방법 1: base64 데이터로 받은 경우
      if (renderResult.videoBase64) {
        console.log("[v0] base64 데이터로 영상 다운로드")
        const binaryString = atob(renderResult.videoBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        videoBlob = new Blob([bytes], { type: "video/mp4" })
        console.log("[v0] base64에서 Blob 생성 완료:", videoBlob.size, "bytes")
      }
      // 방법 2: URL로 받은 경우
      else if (renderResult.videoUrl) {
        console.log("[v0] URL로 영상 다운로드 시작:", renderResult.videoUrl)
        try {
          const videoResponse = await fetch(renderResult.videoUrl, {
            method: "GET",
            mode: "cors",
          })
          console.log("[v0] fetch 응답 상태:", videoResponse.status, videoResponse.statusText)
          
          if (!videoResponse.ok) {
            const errorText = await videoResponse.text()
            console.error("[v0] 영상 다운로드 실패 응답:", errorText.substring(0, 200))
            throw new Error(`영상 다운로드 실패: ${videoResponse.status} ${videoResponse.statusText}`)
          }
          
          videoBlob = await videoResponse.blob()
          console.log("[v0] URL에서 Blob 생성 완료:", videoBlob.size, "bytes", "타입:", videoBlob.type)
        } catch (fetchError) {
          console.error("[v0] fetch 오류:", fetchError)
          // CORS 문제일 수 있으므로 직접 다운로드 링크 제공
          if (fetchError instanceof Error && fetchError.message.includes("CORS")) {
            console.log("[v0] CORS 문제 감지, 직접 다운로드 링크 사용")
            // 직접 다운로드 링크로 전환
            const a = document.createElement("a")
            a.href = renderResult.videoUrl
            a.download = `longform-video-${Date.now()}.mp4`
            a.target = "_blank"
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            alert("영상 다운로드가 시작되었습니다. 브라우저에서 다운로드를 확인해주세요.")
            setIsExporting(false)
            return
          }
          throw fetchError
        }
      } else {
        console.error("[v0] 렌더링 결과에 videoBase64 또는 videoUrl이 없습니다:", renderResult)
        throw new Error("영상 데이터 또는 URL을 받을 수 없습니다.")
      }

      // 다운로드 실행
      console.log("[v0] 다운로드 실행 시작...")
      const videoUrl = URL.createObjectURL(videoBlob)
      console.log("[v0] Object URL 생성:", videoUrl)
      
      const a = document.createElement("a")
      a.href = videoUrl
      a.download = `longform-video-${Date.now()}.mp4`
      document.body.appendChild(a)
      console.log("[v0] 다운로드 링크 클릭 실행...")
      a.click()
      
      // 약간의 지연 후 정리
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(videoUrl)
        console.log("[v0] 다운로드 링크 정리 완료")
      }, 100)

      console.log("[v0] 영상 다운로드 완료")
      
      // 렌더링 단계 완료 표시
      setCompletedSteps((prev) => {
        if (!prev.includes("render")) {
          return [...prev, "render"]
        }
        return prev
      })
      
      // 자동화 모드 완료 처리
      if (isAutoMode) {
        setIsAutoMode(false)
        setAutoModeStep("")
        setAutoModeProgress({ current: "", total: 7 })
        alert("자동화 작업이 완료되었습니다! 영상 다운로드가 완료되었습니다.")
      } else {
        alert("영상 렌더링이 완료되었습니다!")
      }
      setIsExporting(false)
    } catch (error) {
      console.error("[v0] 영상 렌더링 오류:", error)
      alert(`영상 렌더링 중 오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      if (isAutoMode) {
        setIsAutoMode(false)
        setAutoModeStep("")
        setAutoModeProgress({ current: "", total: 7 })
      }
      setIsExporting(false)
    }

    // 클라이언트 사이드 렌더링 (주석 처리 - Cloud Run 사용 시 불필요)
    /*
      // Canvas 생성
      const canvas = document.createElement("canvas")
      canvas.width = 1920
      canvas.height = 1080
      const ctx = canvas.getContext("2d")!

      // 인물 이미지 로드
      const img = new Image()
      img.crossOrigin = "anonymous"
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = generatedImage
      })

      // 자동 이미지 로드
      const autoImageElements = new Map<string, HTMLImageElement>()
      for (const autoImg of autoImages) {
        const imgElement = new Image()
        imgElement.crossOrigin = "anonymous"
        await new Promise((resolve, reject) => {
          imgElement.onload = resolve
          imgElement.onerror = () => {
            console.error(`자동 이미지 로드 실패: ${autoImg.url}`)
            resolve(null)
          }
          imgElement.src = autoImg.url
        })
        autoImageElements.set(autoImg.id, imgElement)
      }

      // 오디오 스트림 생성
      const audioContext = new AudioContext()
      const audioResponse = await fetch(videoData.audioUrl)
      const audioArrayBuffer = await audioResponse.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer)

      const audioSource = audioContext.createBufferSource()
      audioSource.buffer = audioBuffer

      const dest = audioContext.createMediaStreamDestination()
      audioSource.connect(dest)

      // Canvas 스트림 생성
      const canvasStream = canvas.captureStream(30)
      const videoTrack = canvasStream.getVideoTracks()[0]
      const audioTrack = dest.stream.getAudioTracks()[0]

      const combinedStream = new MediaStream([videoTrack, audioTrack])

      // MediaRecorder 설정
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 10000000,
      })

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `longform-video-${Date.now()}.webm`
        a.click()
        URL.revokeObjectURL(url)
        setIsExporting(false)
      }

      mediaRecorder.start()
      audioSource.start()

      // 프레임 렌더링
      const fps = 30
      const frameDuration = 1000 / fps
      let frameIndex = 0

      const renderFrame = () => {
        const currentTime = frameIndex / fps

        if (currentTime >= videoData.duration) {
          mediaRecorder.stop()
          audioSource.stop()
          return
        }

        // 배경 이미지 그리기
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // 60초 이후 자동 이미지 표시
        const activeAutoImage = autoImages.find(
          (autoImg) => currentTime >= autoImg.startTime && currentTime <= autoImg.endTime && autoImg.startTime >= 60,
        )

        if (activeAutoImage) {
          const autoImgElement = autoImageElements.get(activeAutoImage.id)
          if (autoImgElement) {
            ctx.fillStyle = "black"
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            const progress =
              (currentTime - activeAutoImage.startTime) / (activeAutoImage.endTime - activeAutoImage.startTime)

            ctx.save()

            const imgRatio = autoImgElement.width / autoImgElement.height
            const canvasRatio = canvas.width / canvas.height

            let drawWidth, drawHeight, drawX, drawY, scale = 1, translateX = 0

            if (imgRatio > canvasRatio) {
              drawHeight = canvas.height
              drawWidth = drawHeight * imgRatio
              drawX = (canvas.width - drawWidth) / 2
              drawY = 0
            } else {
              drawWidth = canvas.width
              drawHeight = drawWidth / imgRatio
              drawX = 0
              drawY = (canvas.height - drawHeight) / 2
            }

            switch (activeAutoImage.motion) {
              case "zoom-in":
                scale = 1 + progress * 0.3
                break
              case "zoom-out":
                scale = 1.3 - progress * 0.3
                break
              case "pan-left":
                scale = 1.2
                translateX = -progress * drawWidth * 0.2
                break
              case "pan-right":
                scale = 1.2
                translateX = progress * drawWidth * 0.2
                break
            }

            ctx.translate(canvas.width / 2, canvas.height / 2)
            ctx.scale(scale, scale)
            ctx.translate(-canvas.width / 2 + translateX, -canvas.height / 2)

            ctx.drawImage(autoImgElement, drawX, drawY, drawWidth, drawHeight)
            ctx.restore()
          }
        }

        // 자막 렌더링
        const subtitle = videoData.subtitles.find((s) => currentTime >= s.start && currentTime < s.end)

        if (subtitle) {
          const padding = 40
          const lines = [subtitle.text]
          const lineHeight = 80
          const fontSize = 60
          const totalHeight = lines.length * lineHeight + padding * 2

          ctx.fillStyle = "rgba(0, 0, 0, 0.75)"
          ctx.fillRect(100, canvas.height - totalHeight - 100, canvas.width - 200, totalHeight)

          ctx.fillStyle = "white"
          ctx.font = `bold ${fontSize}px Arial, sans-serif`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"

          lines.forEach((line, index) => {
            ctx.fillText(
              line,
              canvas.width / 2,
              canvas.height - totalHeight - 100 + padding + lineHeight * (index + 0.5),
            )
          })
        }

        frameIndex++
        setTimeout(renderFrame, frameDuration)
      }

      renderFrame()
    } catch (error) {
      console.error("영상 내보내기 오류:", error)
      alert("영상 내보내기 중 오류가 발생했습니다.")
      setIsExporting(false)
    }
    */
  }

  // 보통다운로드: MediaRecorder 사용 (클라이언트 사이드)
  const handleNormalDownload = async () => {
    if (!videoData || scriptLines.length === 0 || generatedImages.length === 0 || generatedAudios.length === 0) {
      alert("영상 데이터가 없습니다. 먼저 미리보기를 생성해주세요.")
      return
    }

    setIsExporting(true)

    try {
      console.log("[v0] MediaRecorder 렌더링 시작 (보통다운로드)")

      // Canvas 생성
      const canvas = document.createElement("canvas")
      canvas.width = 1920
      canvas.height = 1080
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Canvas context를 생성할 수 없습니다.")
      }

      // 오디오 로드
      const audioResponse = await fetch(videoData.audioUrl)
      const audioBlob = await audioResponse.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      
      await new Promise<void>((resolve, reject) => {
        audio.onloadeddata = () => resolve()
        audio.onerror = reject
      })

      // 효과음 및 배경음악 로드
      const audioBuffers: Array<{ buffer: AudioBuffer; track: AudioTrack }> = []
      if (audioTracks.length > 0) {
        const audioContextForTracks = new (window.AudioContext || (window as any).webkitAudioContext)()
        for (const track of audioTracks) {
          try {
            const response = await fetch(track.url)
            const arrayBuffer = await response.arrayBuffer()
            const buffer = await audioContextForTracks.decodeAudioData(arrayBuffer)
            audioBuffers.push({ buffer, track })
          } catch (error) {
            console.error(`오디오 트랙 로드 실패 (${track.file.name}):`, error)
          }
        }
      }

      // MediaRecorder 설정
      const stream = canvas.captureStream(30) // 30fps
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // 메인 오디오 소스
      const source = audioContext.createMediaElementSource(audio)
      const destination = audioContext.createMediaStreamDestination()
      source.connect(destination)
      
      // 효과음 및 배경음악 추가
      const gainNodes: Array<{ node: GainNode; source: AudioBufferSourceNode; track: AudioTrack }> = []
      for (const { buffer, track } of audioBuffers) {
        const trackSource = audioContext.createBufferSource()
        trackSource.buffer = buffer
        const gainNode = audioContext.createGain()
        gainNode.gain.value = track.volume
        trackSource.connect(gainNode)
        gainNode.connect(destination)
        gainNodes.push({ node: gainNode, source: trackSource, track })
      }
      
      // 비디오 스트림과 오디오 스트림 합치기
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = destination.stream.getAudioTracks()[0]
      const combinedStream = new MediaStream([videoTrack, audioTrack])

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 5000000, // 5Mbps
      })

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: "video/webm" })
        const videoUrl = URL.createObjectURL(videoBlob)
        const a = document.createElement("a")
        a.href = videoUrl
        a.download = `longform-video-${Date.now()}.webm`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(videoUrl)
        URL.revokeObjectURL(audioUrl)
        
        // 효과음 및 배경음악 정리
        for (const track of audioTracks) {
          URL.revokeObjectURL(track.url)
        }
        
        console.log("[v0] MediaRecorder 렌더링 완료")
        setCompletedSteps((prev) => {
          if (!prev.includes("render")) {
            return [...prev, "render"]
          }
          return prev
        })
        alert("영상 렌더링이 완료되었습니다!")
        setIsExporting(false)
      }

      // 앞부분 10초 동영상 로드
      let introVideoElement: HTMLVideoElement | null = null
      if (introVideo) {
        introVideoElement = document.createElement("video")
        introVideoElement.src = introVideo
        introVideoElement.crossOrigin = "anonymous"
        await new Promise<void>((resolve, reject) => {
          introVideoElement!.onloadeddata = () => resolve()
          introVideoElement!.onerror = reject
        })
      }

      // 로고 이미지 로드
      let logoImg: HTMLImageElement | null = null
      if (logoImage) {
        logoImg = new Image()
        logoImg.crossOrigin = "anonymous"
        await new Promise<void>((resolve, reject) => {
          logoImg!.onload = () => resolve()
          logoImg!.onerror = reject
          logoImg!.src = logoImage
        })
      }

      // 렌더링 시작
      mediaRecorder.start()
      
      // 앞부분 동영상이 있으면 10초 후에 오디오 재생, 없으면 바로 재생
      if (introVideo) {
        setTimeout(() => {
          audio.play()
          // 효과음 및 배경음악 재생 시작
          for (const { source, track } of gainNodes) {
            const adjustedStartTime = track.startTime + (introVideo ? 10 : 0)
            const currentTime = audioContext.currentTime
            if (adjustedStartTime <= videoData.duration) {
              source.start(currentTime + adjustedStartTime)
              // 끝 시간에 맞춰 중지
              const duration = track.endTime - track.startTime
              source.stop(currentTime + adjustedStartTime + duration)
            }
          }
        }, 10000) // 10초 후 재생
      } else {
        audio.play()
        // 효과음 및 배경음악 재생 시작
        for (const { source, track } of gainNodes) {
          const currentTime = audioContext.currentTime
          if (track.startTime <= videoData.duration) {
            source.start(currentTime + track.startTime)
            // 끝 시간에 맞춰 중지
            const duration = track.endTime - track.startTime
            source.stop(currentTime + track.startTime + duration)
          }
        }
      }

      // 이미지와 비디오 렌더링
      const images: HTMLImageElement[] = []
      const videos: Map<number, HTMLVideoElement> = new Map() // 변환된 비디오 저장
      
      // 이미지/비디오 미리 로드
      for (const imgData of videoData.autoImages || []) {
        // lineId 추출 (image_1 -> 1)
        const lineId = Number.parseInt(imgData.id.split("_").pop() || "0")
        
        // 변환된 비디오가 있는지 확인
        if (convertedVideos.has(lineId)) {
          const video = document.createElement("video")
          video.crossOrigin = "anonymous"
          video.preload = "auto"
          video.muted = true
          await new Promise<void>((resolve, reject) => {
            video.onloadeddata = () => resolve()
            video.onerror = reject
            video.src = convertedVideos.get(lineId)!
          })
          videos.set(lineId, video)
          // 비디오가 있으면 이미지는 스킵
          const placeholderImg = new Image()
          placeholderImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" // 1x1 투명 이미지
          images.push(placeholderImg)
        } else {
          // 비디오가 없으면 이미지 로드
          const img = new Image()
          img.crossOrigin = "anonymous"
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
            img.src = imgData.url
          })
          images.push(img)
        }
      }

      // 줌인 효과 설정 (랜덤)
      const zoomDirection = Math.random() > 0.5 ? "left-to-right" : "right-to-left" // 좌→우 또는 우→좌
      const zoomStartTime = introVideo ? 10 : 0 // 앞부분 동영상이 있으면 10초 후부터
      const zoomDuration = 3 // 3초 동안 줌인
      const baseScale = 1.0
      const maxScale = 1.15 // 최대 15% 확대 (더 부드럽게)

      // Easing 함수 (매우 부드러운 전환) - easeOutCubic 사용
      const easeOutCubic = (t: number): number => {
        return 1 - Math.pow(1 - t, 3)
      }
      
      // 더 부드러운 easeInOutQuad
      const easeInOutQuad = (t: number): number => {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      }
      
      // 줌인용 매우 부드러운 easing
      const easeInOutSmooth = (t: number): number => {
        // cubic-bezier(0.4, 0, 0.2, 1)와 유사한 매우 부드러운 곡선
        return t < 0.5 
          ? 4 * t * t * t * (1 - t) + t * t
          : 1 - 4 * (1 - t) * (1 - t) * (1 - t) * t - (1 - t) * (1 - t)
      }

      // 이미지 전환 페이드 시간 (초) - 더 자연스러운 전환을 위해 길게 설정
      const fadeDuration = 1.2

      let previousImage: AutoImage | null = null
      let previousImageElement: HTMLImageElement | null = null
      let previousImageIndex = -1

      const startTime = Date.now()
      const renderFrame = () => {
        const currentTime = (Date.now() - startTime) / 1000
        
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // 앞부분 10초는 동영상 재생
        if (introVideoElement && currentTime < 10) {
          introVideoElement.currentTime = currentTime
          ctx.drawImage(introVideoElement, 0, 0, canvas.width, canvas.height)
        } else {
          // 현재 시간에 맞는 이미지 찾기
          const adjustedTime = introVideo ? currentTime - 10 : currentTime // 앞부분 동영상이 있으면 10초 빼기
          const currentImage = videoData.autoImages?.find(
            (img) => adjustedTime >= img.startTime && adjustedTime <= img.endTime
          )
          
          // 현재 이미지 인덱스 찾기
          const currentImageIndex = currentImage ? videoData.autoImages?.indexOf(currentImage) || -1 : -1
          
          // 이전 이미지 찾기 (전환 중일 때) - 더 정확하게 찾기
          let previousImageData: typeof currentImage | null = null
          if (currentImageIndex > 0 && currentImageIndex !== previousImageIndex) {
            // 이전 이미지가 있고, 현재 이미지가 바뀌었을 때
            const prevIndex = currentImageIndex - 1
            previousImageData = videoData.autoImages?.[prevIndex] || null
            
            // 이전 이미지가 전환 시간 내에 있는지 확인
            if (previousImageData) {
              const timeSincePrevEnd = adjustedTime - previousImageData.endTime
              if (timeSincePrevEnd > fadeDuration) {
                previousImageData = null // 전환 시간이 지났으면 이전 이미지 표시 안 함
              }
            }
          } else if (currentImageIndex === previousImageIndex && previousImage) {
            // 같은 이미지가 계속 표시되는 경우
            previousImageData = previousImage
          }
          
          // 이미지 전환 페이드 계산
          let fadeProgress = 1 // 1 = 완전히 새 이미지, 0 = 완전히 이전 이미지
          if (previousImageData && currentImage && previousImageData.id !== currentImage.id) {
            const transitionStartTime = currentImage.startTime
            const timeSinceTransition = adjustedTime - transitionStartTime
            fadeProgress = Math.min(Math.max(timeSinceTransition / fadeDuration, 0), 1)
            fadeProgress = easeInOutQuad(fadeProgress) // 부드러운 전환
          }
          
          // 이전 이미지 업데이트
          if (currentImageIndex !== previousImageIndex && currentImage) {
            previousImage = currentImage as AutoImage
            previousImageIndex = currentImageIndex
          }
          
          // 현재 이미지 그리기
          if (currentImage) {
            const imgIndex = videoData.autoImages?.indexOf(currentImage) || 0
            const lineId = Number.parseInt(currentImage.id.split("_").pop() || "0")
            const hasVideo = convertedVideos.has(lineId)
            
            if (imgIndex < images.length) {
              const img = images[imgIndex]
              
              // 줌인 효과 계산 - 이미지 크기는 그대로 유지하고 일부 영역을 크롭해서 확대
              let sourceX = 0
              let sourceY = 0
              let sourceWidth = img.width
              let sourceHeight = img.height
              
              if (enableZoom && currentImage) {
                // 각 이미지마다 고정된 랜덤 방향 생성 (이미지 ID 기반)
                const imageHash = currentImage.id.split("_").pop() || "0"
                const zoomDirection = Number.parseInt(imageHash) % 2 === 0 ? "left-to-right" : "right-to-left"
                
                // 이미지가 표시되는 전체 시간 동안 서서히 확대
                const imageStartTime = currentImage.startTime
                const imageEndTime = currentImage.endTime
                const imageDuration = imageEndTime - imageStartTime
                const timeInImage = adjustedTime - imageStartTime
                let zoomProgress = Math.min(Math.max(timeInImage / imageDuration, 0), 1) // 0~1 사이
                
                // Easing 적용 (부드러운 줌인) - 단일 적용으로 자연스러움 유지
                zoomProgress = easeInOutSmooth(zoomProgress)
                
                // 서서히 확대 (1.0배에서 1.15배까지)
                const zoomScale = baseScale + (maxScale - baseScale) * zoomProgress
                
                // 크롭할 영역 계산 (이미지 중앙에서 시작해서 점점 작은 영역 선택)
                const cropWidth = img.width / zoomScale
                const cropHeight = img.height / zoomScale
                
                // 줌인 방향에 따라 크롭 영역 이동
                if (zoomDirection === "left-to-right") {
                  // 좌→우: 왼쪽에서 시작해서 오른쪽으로 이동
                  const maxOffsetX = (img.width - cropWidth) * zoomProgress
                  sourceX = maxOffsetX
                } else {
                  // 우→좌: 오른쪽에서 시작해서 왼쪽으로 이동
                  const maxOffsetX = (img.width - cropWidth) * (1 - zoomProgress)
                  sourceX = maxOffsetX
                }
                
                // 세로는 중앙 고정
                sourceY = (img.height - cropHeight) / 2
                sourceWidth = cropWidth
                sourceHeight = cropHeight
              }
              
              // 이전 이미지/비디오가 있고 전환 중이면 이전 이미지/비디오 먼저 그리기
              if (previousImageData && previousImageData.id !== currentImage.id && fadeProgress < 1) {
                const prevImgIndex = videoData.autoImages?.indexOf(previousImageData) || 0
                const prevLineId = Number.parseInt(previousImageData.id.split("_").pop() || "0")
                const prevHasVideo = convertedVideos.has(prevLineId)
                
                if (prevHasVideo) {
                  // 이전 비디오 재생
                  const prevVideo = videos.get(prevLineId)
                  if (prevVideo) {
                    const prevImageStartTime = previousImageData.startTime
                    const prevImageEndTime = previousImageData.endTime
                    const prevTimeInImage = Math.min(adjustedTime - prevImageStartTime, prevImageEndTime - prevImageStartTime)
                    const prevVideoDuration = prevVideo.duration || 6
                    // 비디오가 문장 시간보다 짧으면 반복 재생
                    const prevVideoTime = prevTimeInImage % prevVideoDuration
                    prevVideo.currentTime = prevVideoTime
                    
                    ctx.globalAlpha = 1 - fadeProgress
                    ctx.drawImage(prevVideo, 0, 0, canvas.width, canvas.height)
                    ctx.globalAlpha = 1
                  }
                } else if (prevImgIndex < images.length && prevImgIndex >= 0) {
                  // 이전 이미지 그리기 (기존 로직)
                  const prevImg = images[prevImgIndex]
                  
                  // 이전 이미지의 줌인 효과 계산 (마지막 상태 유지)
                  let prevSourceX = 0
                  let prevSourceY = 0
                  let prevSourceWidth = prevImg.width
                  let prevSourceHeight = prevImg.height
                  
                  if (enableZoom && previousImageData) {
                    const imageHash = previousImageData.id.split("_").pop() || "0"
                    const zoomDirection = Number.parseInt(imageHash) % 2 === 0 ? "left-to-right" : "right-to-left"
                    const imageEndTime = previousImageData.endTime
                    const prevZoomProgress = 1 // 마지막 상태 (완전히 확대된 상태)
                    const prevZoomScale = maxScale
                    const prevCropWidth = prevImg.width / prevZoomScale
                    const prevCropHeight = prevImg.height / prevZoomScale
                    
                    if (zoomDirection === "left-to-right") {
                      prevSourceX = (prevImg.width - prevCropWidth) * prevZoomProgress
                    } else {
                      prevSourceX = (prevImg.width - prevCropWidth) * (1 - prevZoomProgress)
                    }
                    prevSourceY = (prevImg.height - prevCropHeight) / 2
                    prevSourceWidth = prevCropWidth
                    prevSourceHeight = prevCropHeight
                  }
                  
                  // 이전 이미지 그리기 (반투명)
                  ctx.globalAlpha = 1 - fadeProgress
                  ctx.drawImage(
                    prevImg,
                    prevSourceX, prevSourceY, prevSourceWidth, prevSourceHeight,
                    0, 0, canvas.width, canvas.height
                  )
                  ctx.globalAlpha = 1
                }
              }
              
              // 현재 이미지/비디오 그리기
              if (!hasVideo) {
                // 현재 이미지 그리기 (크롭된 영역을 캔버스 전체에 그리기)
                ctx.globalAlpha = fadeProgress
                ctx.drawImage(
                  img,
                  sourceX, sourceY, sourceWidth, sourceHeight, // 소스: 크롭할 영역
                  0, 0, canvas.width, canvas.height // 대상: 캔버스 전체
                )
                ctx.globalAlpha = 1
              }
              
              // 이전 이미지 업데이트
              if (previousImage?.id !== currentImage.id) {
                previousImage = currentImage as AutoImage
                previousImageElement = img
              }
            }
          }
        }

        // 로고 그리기 (크기와 위치 조절 가능)
        if (logoImg) {
          const logoWidth = logoSize
          const logoHeight = logoSize
          // X 위치: logoPositionX% (0% = 좌측, 100% = 우측)
          const logoX = (canvas.width * logoPositionX) / 100 - logoWidth / 2
          // Y 위치: logoPositionY% (0% = 상단, 100% = 하단)
          const logoY = (canvas.height * logoPositionY) / 100 - logoHeight / 2
          ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight)
        }

        // 현재 시간에 맞는 자막 찾기
        const adjustedTimeForSubtitles = introVideo ? currentTime - 10 : currentTime
        const currentSubtitles = videoData.subtitles.filter(
          (s) => adjustedTimeForSubtitles >= s.start && adjustedTimeForSubtitles <= s.end
        )

        if (currentSubtitles.length > 0) {
          // 자막 그리기
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
          ctx.fillRect(0, canvas.height - 200, canvas.width, 200)

          ctx.fillStyle = "white"
          ctx.font = "bold 48px Arial"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          
          const subtitleText = currentSubtitles.map((s) => s.text).join(" ")
          const lines = subtitleText.match(/.{1,40}/g) || [subtitleText]
          lines.forEach((line, index) => {
            ctx.fillText(line, canvas.width / 2, canvas.height - 150 + index * 60)
          })
        }

        const totalDuration = introVideo ? videoData.duration + 10 : videoData.duration
        if (currentTime < totalDuration) {
          requestAnimationFrame(renderFrame)
        } else {
          mediaRecorder.stop()
          audio.pause()
          if (introVideoElement) {
            introVideoElement.pause()
          }
          // 정리
          if (introVideo) {
            URL.revokeObjectURL(introVideo)
          }
        }
      }

      renderFrame()
    } catch (error) {
      console.error("[v0] MediaRecorder 렌더링 오류:", error)
      alert(`영상 렌더링 중 오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      setIsExporting(false)
    }
  }

  // 클라이언트 사이드 렌더링 함수 (주석 처리 - Cloud Run 사용 시 불필요)
  /*
  const handleDownloadVideoOld = async () => {
    if (!videoData || !generatedImage) {
      alert("영상 데이터가 없습니다.")
      return
    }

    setIsExporting(true)

    try {
      // Canvas 생성
      const canvas = document.createElement("canvas")
      canvas.width = 1920
      canvas.height = 1080
      const ctx = canvas.getContext("2d")!

      // 인물 이미지 로드
      const img = new Image()
      img.crossOrigin = "anonymous"
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = generatedImage
      })

      // 자동 이미지 로드
      const autoImageElements = new Map<string, HTMLImageElement>()
      for (const autoImg of autoImages) {
        const imgElement = new Image()
        imgElement.crossOrigin = "anonymous"
        await new Promise((resolve, reject) => {
          imgElement.onload = resolve
          imgElement.onerror = () => {
            console.error(`자동 이미지 로드 실패: ${autoImg.url}`)
            resolve(null)
          }
          imgElement.src = autoImg.url
        })
        autoImageElements.set(autoImg.id, imgElement)
      }

      // 오디오 스트림 생성
      const audioContext = new AudioContext()
      const audioResponse = await fetch(videoData.audioUrl)
      const audioArrayBuffer = await audioResponse.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer)

      const audioSource = audioContext.createBufferSource()
      audioSource.buffer = audioBuffer

      const dest = audioContext.createMediaStreamDestination()
      audioSource.connect(dest)

      // Canvas 스트림 생성
      const canvasStream = canvas.captureStream(30)
      const videoTrack = canvasStream.getVideoTracks()[0]
      const audioTrack = dest.stream.getAudioTracks()[0]

      const combinedStream = new MediaStream([videoTrack, audioTrack])

      // MediaRecorder 설정 (높은 비트레이트로 품질 향상)
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 10000000, // 10 Mbps
      })

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `longform-video-${Date.now()}.webm`
        a.click()
        URL.revokeObjectURL(url)
        setIsExporting(false)
      }

      mediaRecorder.start()
      audioSource.start()

      // 프레임 렌더링
      const fps = 30
      const frameDuration = 1000 / fps
      let frameIndex = 0
      const totalFrames = Math.ceil(videoData.duration * fps)

      const renderFrame = () => {
        const currentTime = frameIndex / fps

        if (currentTime >= videoData.duration) {
          mediaRecorder.stop()
          audioSource.stop()
          return
        }

        // 배경 이미지 그리기
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // 60초 이후 자동 이미지 표시
        const activeAutoImage = autoImages.find(
          (autoImg) => currentTime >= autoImg.startTime && currentTime <= autoImg.endTime && autoImg.startTime >= 60,
        )

        if (activeAutoImage) {
          const autoImgElement = autoImageElements.get(activeAutoImage.id)
          if (autoImgElement) {
            ctx.fillStyle = "black"
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            const progress =
              (currentTime - activeAutoImage.startTime) / (activeAutoImage.endTime - activeAutoImage.startTime)

            ctx.save()

            const imgRatio = autoImgElement.width / autoImgElement.height
            const canvasRatio = canvas.width / canvas.height

            let drawWidth,
              drawHeight,
              drawX,
              drawY,
              scale = 1,
              translateX = 0

            if (imgRatio > canvasRatio) {
              drawHeight = canvas.height
              drawWidth = canvas.height * imgRatio
              drawX = (canvas.width - drawWidth) / 2
              drawY = 0
            } else {
              drawWidth = canvas.width
              drawHeight = canvas.width / imgRatio
              drawX = 0
              drawY = (canvas.height - drawHeight) / 2
            }

            switch (activeAutoImage.motion) {
              case "zoom-in":
                scale = 1 + progress * 0.3
                break
              case "zoom-out":
                scale = 1.3 - progress * 0.3
                break
              case "pan-left":
                scale = 1.2
                translateX = -progress * drawWidth * 0.2
                break
              case "pan-right":
                scale = 1.2
                translateX = progress * drawWidth * 0.2
                break
            }

            ctx.translate(canvas.width / 2, canvas.height / 2)
            ctx.scale(scale, scale)
            ctx.translate(-canvas.width / 2 + translateX, -canvas.height / 2)

            ctx.drawImage(autoImgElement, drawX, drawY, drawWidth, drawHeight)
            ctx.restore()
          }
        }

        // 자막 렌더링
        const subtitle = videoData.subtitles.find((s) => currentTime >= s.start && currentTime < s.end)

        if (subtitle) {
          const padding = 40
          const lines = [subtitle.text]
          const lineHeight = 80
          const fontSize = 60
          const totalHeight = lines.length * lineHeight + padding * 2

          ctx.fillStyle = "rgba(0, 0, 0, 0.75)"
          ctx.fillRect(100, canvas.height - totalHeight - 100, canvas.width - 200, totalHeight)

          ctx.fillStyle = "white"
          ctx.font = `bold ${fontSize}px Arial, sans-serif`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"

          lines.forEach((line, index) => {
            ctx.fillText(
              line,
              canvas.width / 2,
              canvas.height - totalHeight - 100 + padding + lineHeight * (index + 0.5),
            )
          })
        }

        frameIndex++
        setTimeout(renderFrame, frameDuration)
      }

      renderFrame()
    } catch (error) {
      console.error("영상 내보내기 오류:", error)
      alert("영상 내보내기 중 오류가 발생했습니다.")
      setIsExporting(false)
    }
  }
  */

  const handleSaveThumbnailImage = async () => {
    if (!generatedImage) {
      alert("인물 이미지가 없습니다.")
      return
    }

    try {
      const canvas = document.createElement("canvas")
      canvas.width = 1280
      canvas.height = 720
      const ctx = canvas.getContext("2d")!

      ctx.imageSmoothingEnabled = false

      // 검은 배경
      ctx.fillStyle = "black"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // 인물 이미지 로드
      const img = new Image()
      img.crossOrigin = "anonymous"
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = generatedImage
      })

      const containerWidth = canvas.width * 0.5
      const containerHeight = canvas.height

      const imgRatio = img.width / img.height
      const containerRatio = containerWidth / containerHeight

      let drawWidth, drawHeight, drawX, drawY

      if (imgRatio > containerRatio) {
        // 이미지가 더 넓음 - 높이를 맞추고 너비를 잘라냄
        drawHeight = containerHeight
        drawWidth = drawHeight * imgRatio
        drawY = 0
        drawX = -(drawWidth - containerWidth) / 2
      } else {
        // 이미지가 더 높음 - 너비를 맞추고 높이를 잘라냄
        drawWidth = containerWidth
        drawHeight = drawWidth / imgRatio
        drawX = 0
        drawY = -(drawHeight - containerHeight) / 2
      }

      const containerX = (canvas.width * doctorImagePosition.x) / 100 - containerWidth / 2
      const containerY = (canvas.height * doctorImagePosition.y) / 100

      ctx.save()
      ctx.beginPath()
      ctx.rect(containerX, containerY, containerWidth, containerHeight)
      ctx.clip()

      // 이미지 그리기 (object-cover 효과)
      ctx.drawImage(img, containerX + drawX, containerY + drawY, drawWidth, drawHeight)

      ctx.restore()

      const gradient = ctx.createLinearGradient(containerX, 0, containerX + containerWidth, 0)

      // Tailwind 클래스를 Canvas gradient로 정확히 변환
      if (gradientMask.direction.includes("from-transparent")) {
        // 우→좌 (from-transparent to-black)
        gradient.addColorStop(0, "rgba(0, 0, 0, 0)")
        gradient.addColorStop(0.5, `rgba(0, 0, 0, ${gradientMask.opacity * 0.5})`)
        gradient.addColorStop(1, `rgba(0, 0, 0, ${gradientMask.opacity})`)
      } else if (gradientMask.direction.includes("from-black")) {
        // 좌→우 (from-black to-transparent) - 기본값
        gradient.addColorStop(0, `rgba(0, 0, 0, ${gradientMask.opacity})`)
        gradient.addColorStop(0.5, `rgba(0, 0, 0, ${gradientMask.opacity * 0.5})`)
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)")
      }

      ctx.fillStyle = gradient
      ctx.fillRect(containerX, containerY, containerWidth, containerHeight)

      thumbnailText.forEach((text, index) => {
        const style = textStyles[index]
        const position = textPositions[index]

        ctx.fillStyle = style.color
        ctx.font = `${style.fontWeight} ${style.fontSize}px Arial Black, Arial, sans-serif`
        ctx.textAlign = "left"
        ctx.textBaseline = "top"

        // 텍스트 그림자 (미리보기 크기의 2배)
        if (style.textShadow && style.textShadow !== "none") {
          const shadowMatch = style.textShadow.match(/(\d+)px\s+(\d+)px\s+(\d+)px\s+(.+)/)
          if (shadowMatch) {
            ctx.shadowOffsetX = Number.parseInt(shadowMatch[1]) * 2
            ctx.shadowOffsetY = Number.parseInt(shadowMatch[2]) * 2
            ctx.shadowBlur = Number.parseInt(shadowMatch[3]) * 2
            ctx.shadowColor = shadowMatch[4]
          }
        }

        // 텍스트 외곽선 (미리보기 크기의 2배)
        if (style.stroke && style.stroke !== "none") {
          const strokeMatch = style.stroke.match(/([\d.]+)px\s+(.+)/)
          if (strokeMatch) {
            ctx.strokeStyle = strokeMatch[2]
            ctx.lineWidth = Number.parseFloat(strokeMatch[1]) * 2
            ctx.strokeText(text, (canvas.width * position.x) / 100, (canvas.height * position.y) / 100)
          }
        }

        ctx.fillText(text, (canvas.width * position.x) / 100, (canvas.height * position.y) / 100)

        // 그림자 초기화
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
        ctx.shadowBlur = 0
      })

      // Canvas를 이미지로 변환하여 다운로드
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `thumbnail-${Date.now()}.jpg`
            a.click()
            URL.revokeObjectURL(url)
          }
        },
        "image/jpeg",
        0.95,
      )
    } catch (error) {
      console.error("썸네일 저장 오류:", error)
      alert("썸네일 저장에 실패했습니다.")
    }
  }

  const handleImageMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingImage(true)
    setSelectedImageElement(true)
    setSelectedTextIndex(null) // 이미지 선택 시 텍스트 선택 해제
  }

  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingImage) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    // 오버레이 이미지가 선택된 경우
    if (thumbnailOverlayImage && selectedImageElement) {
      setOverlayImagePosition({
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      })
    } else if (generatedImage) {
      // 인물 이미지가 선택된 경우
      setDoctorImagePosition({
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      })
    }
  }

  const handleImageMouseUp = () => {
    setIsDraggingImage(false)
  }

  // The second handleCanvasClick was removed as it was a duplicate.
  // The `handleThumbnailCanvasClick` function is used instead for the thumbnail canvas.

  const renderStepContent = () => {
    switch (activeStep) {
      case "topic":
        return (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* 중앙 메인 영역 */}
            <div className="flex-1 space-y-6">
              {/* 제목 & 설명 */}
              <div className="space-y-2 mb-6">
                <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">주제 추천</h1>
                <p className="text-sm md:text-base text-gray-500">AI가 최적의 영상 주제를 추천해드립니다</p>
              </div>

              {/* 카테고리 선택 및 주제 생성 통합 카드 */}
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-slate-900">카테고리 선택</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* 기본 주제/틈새 주제 토글 */}
                  <div className="flex items-center justify-center mb-4">
                    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                      <button
                        type="button"
                        onClick={() => setShowBasicCategories(true)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                          showBasicCategories
                            ? "bg-white text-red-600 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        기본 주제
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBasicCategories(false)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                          !showBasicCategories
                            ? "bg-white text-red-600 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        틈새 주제
                      </button>
                    </div>
                  </div>

                  {/* 기본 주제 */}
                  {showBasicCategories && (
            <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">기본 주제</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                          { id: "wisdom", name: "지혜(명언)", icon: "💡", gradient: "from-yellow-400 to-orange-500", available: true },
                          { id: "religion", name: "종교", icon: "✝️", gradient: "from-purple-400 to-indigo-500", available: true },
                          { id: "health", name: "건강", icon: "🏥", gradient: "from-green-400 to-emerald-500", available: true },
                          { id: "domestic_story", name: "국내 사연", icon: "🇰🇷", gradient: "from-rose-400 to-red-500", available: true },
                          { id: "international_story", name: "해외 감동사연", icon: "🌍", gradient: "from-teal-400 to-blue-500", available: true },
                ].map((category) => (
                          <div
                    key={category.id}
                            className={`group relative overflow-hidden rounded-lg cursor-pointer transition-all duration-200 ${
                              selectedCategory === category.id
                                ? "bg-red-50 border border-red-300 text-red-700 scale-105"
                                : "bg-gray-50 hover:bg-gray-100 hover:scale-105 hover:shadow-xs"
                    } ${!category.available ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={() => {
                      if (category.available) {
                        setSelectedCategory(category.id as any)
                                setKeywords("") // 카테고리 변경 시 키워드 초기화
                              }
                            }}
                          >
                            <div className="relative p-4 h-full flex flex-col items-center justify-center text-center space-y-2">
                              <div className="text-3xl md:text-4xl mb-1">{category.icon}</div>
                              <div className={`font-medium text-sm md:text-base ${selectedCategory === category.id ? "text-red-700" : "text-gray-800"}`}>{category.name}</div>
                        </div>
                      </div>
                ))}
              </div>
            </div>
                  )}

                  {/* 틈새 주제 */}
                  {!showBasicCategories && (
            <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">틈새 주제</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2">
                        {[
                          { id: "romance_of_three_kingdoms", name: "삼국지", icon: "⚔️", gradient: "from-orange-500 to-red-500", available: true },
                          { id: "folktale", name: "옛날이야기(민담)", icon: "📖", gradient: "from-amber-500 to-yellow-500", available: true },
                          { id: "science", name: "과학", icon: "🔬", gradient: "from-cyan-400 to-blue-500", available: true },
                          { id: "history", name: "역사", icon: "📜", gradient: "from-blue-400 to-cyan-500", available: true },
                          { id: "horror", name: "호러", icon: "👻", gradient: "from-gray-600 to-gray-800", available: true },
                          { id: "society", name: "사회(트렌드)", icon: "📱", gradient: "from-violet-400 to-purple-500", available: true },
                          { id: "northkorea", name: "북한", icon: "🇰🇵", gradient: "from-red-400 to-pink-500", available: true },
                          { id: "space", name: "우주", icon: "🌌", gradient: "from-indigo-600 to-purple-600", available: true },
                          { id: "self_improvement", name: "자기계발", icon: "📚", gradient: "from-indigo-400 to-blue-500", available: true },
                          { id: "economy", name: "경제", icon: "💰", gradient: "from-amber-400 to-yellow-500", available: true },
                          { id: "war", name: "전쟁", icon: "⚔️", gradient: "from-red-600 to-orange-600", available: true },
                          { id: "affair", name: "불륜", icon: "💔", gradient: "from-pink-500 to-rose-600", available: true },
                          { id: "ancient", name: "고대시대", icon: "🏛️", gradient: "from-amber-600 to-yellow-700", available: true },
                          { id: "biology", name: "생물", icon: "🦋", gradient: "from-green-500 to-emerald-600", available: true },
                          { id: "greek_roman_mythology", name: "그리스로마신화", icon: "⚡", gradient: "from-purple-600 to-indigo-700", available: true },
                          { id: "death", name: "죽음", icon: "💀", gradient: "from-gray-700 to-slate-800", available: true },
                          { id: "ai", name: "인공지능", icon: "🤖", gradient: "from-blue-500 to-cyan-600", available: true },
                          { id: "alien", name: "외계인설", icon: "👽", gradient: "from-green-500 to-emerald-600", available: true },
                          { id: "palmistry", name: "손금풀이", icon: "✋", gradient: "from-pink-400 to-rose-500", available: true },
                          { id: "physiognomy", name: "관상이야기", icon: "👁️", gradient: "from-purple-400 to-indigo-500", available: true },
                          { id: "fortune_telling", name: "사주팔자", icon: "🔮", gradient: "from-violet-500 to-purple-600", available: true },
                          { id: "urban_legend", name: "도시괴담", icon: "🏙️", gradient: "from-gray-500 to-slate-600", available: true },
                          { id: "serial_crime", name: "연쇄범죄", icon: "⚠️", gradient: "from-red-500 to-orange-600", available: true },
                          { id: "unsolved_case", name: "미제사건", icon: "🔍", gradient: "from-amber-500 to-yellow-600", available: true },
                          { id: "reserve_army", name: "예비군이야기", icon: "🪖", gradient: "from-green-600 to-emerald-700", available: true },
                          { id: "elementary_school", name: "국민학교", icon: "🏫", gradient: "from-orange-400 to-amber-500", available: true },
                        ].map((category) => (
                          <div
                            key={category.id}
                            className={`group relative overflow-hidden rounded-lg cursor-pointer transition-all duration-200 ${
                              selectedCategory === category.id
                                ? "bg-red-50 border border-red-300 text-red-700 scale-105"
                                : "bg-gray-50 hover:bg-gray-100 hover:scale-105 hover:shadow-xs"
                            } ${!category.available ? "opacity-50 cursor-not-allowed" : ""}`}
                            onClick={() => {
                              if (category.available) {
                                setSelectedCategory(category.id as any)
                                setKeywords("") // 카테고리 변경 시 키워드 초기화
                              }
                            }}
                          >
                            <div className="relative p-4 h-full flex flex-col items-center justify-center text-center space-y-2">
                              <div className="text-3xl md:text-4xl mb-1">{category.icon}</div>
                              <div className={`font-medium text-sm md:text-base ${selectedCategory === category.id ? "text-red-700" : "text-gray-800"}`}>{category.name}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 주제 생성 카드 */}
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-slate-900">주제 생성</CardTitle>
                  <p className="text-sm text-gray-500 mt-2">
                    키워드를 입력하지 않으면 선택한 카테고리 기준으로 주제를 생성합니다.
                  </p>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="keywords" className="text-sm font-medium text-gray-700">
                      키워드 입력 (선택 사항)
                    </Label>
                <Input
                      id="keywords"
                      placeholder="키워드를 입력하면 해당 키워드 중심으로 주제를 생성합니다"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                      className="h-12 border-gray-300 focus:ring-red-500 focus:border-red-500 rounded-lg"
                    />
                  </div>

                  {/* 테스트용 이미지 업로드 */}
                  <div className="space-y-2">
                    <Label htmlFor="testImage" className="text-sm font-medium text-gray-700">
                      테스트용 이미지 업로드 (선택 사항)
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="testImage"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setTestImageFile(file)
                            const url = URL.createObjectURL(file)
                            setTestImageUrl(url)
                          }
                        }}
                        className="h-12 border-gray-300 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
                      />
                      {testImageUrl && (
                        <div className="flex items-center gap-2">
                          <img src={testImageUrl} alt="테스트 이미지" className="w-12 h-12 object-cover rounded" />
                          <Button
                            onClick={() => {
                              setTestImageFile(null)
                              setTestImageUrl(null)
                            }}
                            variant="ghost"
                            size="sm"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      테스트 데이터 로드 시 이 이미지가 사용됩니다.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handleTopicGeneration}
                      disabled={isGenerating}
                      className="h-12 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      size="lg"
                    >
                      {isGenerating ? (
                        <>
                          <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                          AI가 주제를 생성하고 있습니다...
                        </>
                      ) : (
                        <>
                          <Target className="w-5 h-5 mr-2" />
                          주제 15개 생성하기
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleLoadTestData}
                      className="h-12 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold"
                      size="lg"
                    >
                      <FileText className="w-5 h-5 mr-2" />
                      테스트 데이터 로드
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 추천 주제 목록 - 주제 생성 카드 바로 아래 */}
            {generatedTopics.length > 0 && (
                <Card ref={generatedTopicsRef} className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-slate-900">추천 주제 선택</CardTitle>
                  <p className="text-sm text-gray-500 mt-2">
                    생성된 주제 중 하나를 선택하거나 직접 입력할 수 있습니다
                  </p>
                </CardHeader>
                <CardContent className="pt-6">
                <div className="grid gap-3">
                  {generatedTopics.map((topic, index) => (
                      <div
                      key={index}
                        className={`group relative overflow-hidden rounded-lg cursor-pointer transition-all duration-200 border ${
                          selectedTopic === topic && !isCustomTopicSelected
                            ? "border-red-300 bg-red-50 ring-2 ring-red-200 ring-offset-1"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                      }`}
                      onClick={() => {
                        setSelectedTopic(topic)
                        setIsCustomTopicSelected(false)
                          setCompletedSteps((prev) => {
                            if (!prev.includes("topic")) {
                              return [...prev, "topic"]
                            }
                            return prev
                          })
                        }}
                      >
                        <div className="p-4">
                          <div className="flex items-center gap-4">
                            {/* 번호 배지 */}
                            <div
                              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                                selectedTopic === topic && !isCustomTopicSelected
                                  ? "bg-red-500 text-white"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {index + 1}
                        </div>
                            
                            {/* 주제 텍스트 */}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm md:text-base font-medium leading-relaxed ${
                                selectedTopic === topic && !isCustomTopicSelected
                                  ? "text-red-700"
                                  : "text-gray-900"
                              }`}>
                                {topic}
                              </p>
                            </div>

                            {/* 선택 표시 */}
                            {selectedTopic === topic && !isCustomTopicSelected && (
                              <div className="flex-shrink-0">
                                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* 직접 입력 옵션 */}
                    <div
                      className={`group relative overflow-hidden rounded-lg cursor-pointer transition-all duration-200 border-2 border-dashed ${
                        isCustomTopicSelected
                          ? "border-red-300 bg-red-50 ring-2 ring-red-200 ring-offset-1"
                          : "border-gray-300 bg-white hover:border-gray-400"
                    }`}
                    onClick={() => {
                      setIsCustomTopicSelected(true)
                      setSelectedTopic("")
                    }}
                  >
                      <div className="p-4">
                        <div className="flex items-center justify-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            isCustomTopicSelected ? "bg-red-100" : "bg-gray-100 group-hover:bg-gray-200"
                          }`}>
                            <FileText className={`w-4 h-4 transition-colors ${
                              isCustomTopicSelected ? "text-red-600" : "text-gray-500"
                            }`} />
                          </div>
                          <span className={`text-sm md:text-base font-medium transition-colors ${
                            isCustomTopicSelected ? "text-red-700" : "text-gray-600"
                          }`}>
                            적절한 주제가 없음 (직접 입력)
                          </span>
                          {isCustomTopicSelected && (
                            <div className="ml-auto">
                              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                      </div>
                    </CardContent>
                  </Card>
              )}

              {/* 자동화 진행 상황 표시 - 주제 추천 바로 아래 */}
              {isAutoRunning && (
                <Card className="border-2 border-red-300 rounded-2xl shadow-lg bg-white animate-fade-in">
                  <CardHeader className="pb-4 border-b border-red-100">
                    <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                      자동화 진행 중...
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      선택한 주제: <span className="font-semibold text-red-600">{selectedTopic}</span>
                    </p>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {/* 진행률 바 */}
                      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500 ease-out"
                          style={{ width: `${(autoProgress.step / autoProgress.totalSteps) * 100}%` }}
                        />
                      </div>
                      
                      {/* 진행 정보 */}
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">
                          {autoProgress.currentStepName}
                        </span>
                        <span className="text-sm text-gray-500">
                          {autoProgress.step} / {autoProgress.totalSteps} 단계
                        </span>
                      </div>
                      
                      {/* 상세 메시지 */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">{autoProgress.message}</p>
                      </div>
                      
                      {/* 단계별 체크리스트 */}
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-4">
                        {[
                          { step: 1, name: "대본 기획" },
                          { step: 2, name: "대본 초안" },
                          { step: 3, name: "대본 생성" },
                          { step: 4, name: "이미지" },
                          { step: 5, name: "TTS" },
                          { step: 6, name: "영상 렌더링" },
                          { step: 7, name: "제목" },
                          { step: 8, name: "설명" },
                          { step: 9, name: "썸네일" },
                        ].map((item) => (
                          <div
                            key={item.step}
                            className={`p-2 rounded-lg text-xs text-center transition-all ${
                              autoProgress.step > item.step
                                ? "bg-green-100 text-green-700"
                                : autoProgress.step === item.step
                                ? "bg-red-100 text-red-700 animate-pulse"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {autoProgress.step > item.step ? "✓ " : autoProgress.step === item.step ? "⏳ " : "○ "}
                            {item.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 자동화 완료 후 유튜브 업로드 준비 UI */}
              {autoProgress.isComplete && isReadyForUpload && (
                <Card className="border-2 border-green-300 rounded-2xl shadow-lg bg-gradient-to-br from-white to-green-50 animate-fade-in">
                  <CardHeader className="pb-4 border-b border-green-100">
                    <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500" />
                      자동화 완료! 🎉
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600 mb-4">
                      모든 콘텐츠가 생성되었습니다. 각 단계를 확인하고 필요시 수정한 후 유튜브에 업로드하세요.
                    </p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveStep("script")}
                        className="text-xs"
                      >
                        📝 대본 확인
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveStep("image")}
                        className="text-xs"
                      >
                        🖼️ 이미지 확인
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveStep("tts")}
                        className="text-xs"
                      >
                        🔊 TTS 확인
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveStep("thumbnail")}
                        className="text-xs"
                      >
                        🎨 썸네일 확인
                      </Button>
                    </div>
                    
                    {/* 유튜브 업로드 예약 (추후 구현) */}
                    <div className="border-t border-green-100 pt-4">
                      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Youtube className="w-4 h-4 text-red-500" />
                        유튜브 업로드 예약 (준비 중)
                      </h4>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <Label className="text-xs text-gray-600">예약 날짜</Label>
                          <Input
                            type="date"
                            value={youtubeScheduleDate}
                            onChange={(e) => setYoutubeScheduleDate(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">예약 시간</Label>
                          <Input
                            type="time"
                            value={youtubeScheduleTime}
                            onChange={(e) => setYoutubeScheduleTime(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <Button
                        className="w-full bg-red-500 hover:bg-red-600 text-white"
                        disabled={true}
                      >
                        <Youtube className="w-4 h-4 mr-2" />
                        유튜브 업로드 예약 (Google 연동 필요)
                      </Button>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        ※ 유튜브 업로드 기능은 Google Cloud Console 설정 후 사용 가능합니다.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 모드 선택 UI - 주제가 선택되면 표시 */}
              {selectedTopic && !isAutoRunning && (
                <Card className="border-2 border-red-200 rounded-2xl shadow-lg bg-gradient-to-br from-white to-red-50">
                  <CardHeader className="pb-4 border-b border-red-100">
                    <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-red-500" />
                      작업 모드 선택
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      선택한 주제: <span className="font-semibold text-red-600">{selectedTopic}</span>
                    </p>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 자동화 모드 */}
                      <div
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg ${
                          workflowMode === "auto"
                            ? "border-red-500 bg-red-50 shadow-md"
                            : "border-gray-200 bg-white hover:border-red-300"
                        }`}
                        onClick={() => handleModeSelection("auto")}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                            <Zap className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-gray-900">🚀 자동화 모드</h3>
                            <p className="text-xs text-gray-500">원클릭으로 모든 작업 완료</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                          대본 기획부터 썸네일 생성까지 모든 과정을 AI가 자동으로 처리합니다.
                        </p>
                        <ul className="text-xs text-gray-500 space-y-1">
                          <li>✓ 대본 기획 → 초안 → 완성</li>
                          <li>✓ AI 이미지 자동 생성</li>
                          <li>✓ TTS 음성 자동 생성</li>
                          <li>✓ 제목/설명/썸네일 자동 생성</li>
                        </ul>
                      </div>

                      {/* 수동 모드 */}
                      <div
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg ${
                          workflowMode === "manual"
                            ? "border-blue-500 bg-blue-50 shadow-md"
                            : "border-gray-200 bg-white hover:border-blue-300"
                        }`}
                        onClick={() => handleModeSelection("manual")}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                            <Settings className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-gray-900">⚙️ 수동 모드</h3>
                            <p className="text-xs text-gray-500">각 단계를 직접 컨트롤</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                          각 단계별로 결과를 확인하고 수정하면서 진행합니다.
                        </p>
                        <ul className="text-xs text-gray-500 space-y-1">
                          <li>✓ 단계별 결과 확인 가능</li>
                          <li>✓ 중간에 수정 가능</li>
                          <li>✓ 세밀한 컨트롤</li>
                          <li>✓ 원하는 단계만 선택 실행</li>
                        </ul>
                      </div>
                    </div>

                    {/* 자동화 모드 선택 시 업로드 일자 선택 UI */}
                    {showScheduleSelector && workflowMode === "auto" && (
                      <div className="mt-6 pt-6 border-t border-red-200">
                        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
                          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-orange-500" />
                            📅 유튜브 업로드 예약 설정
                          </h4>
                          <p className="text-sm text-gray-600 mb-4">
                            자동화 완료 후 유튜브에 업로드할 날짜와 시간을 선택하세요.
                          </p>
                          
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <Label className="text-sm font-medium text-gray-700 mb-2 block">업로드 날짜</Label>
                              <Input
                                type="date"
                                value={youtubeScheduleDate}
                                onChange={(e) => setYoutubeScheduleDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="bg-white"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-700 mb-2 block">업로드 시간</Label>
                              <Input
                                type="time"
                                value={youtubeScheduleTime}
                                onChange={(e) => setYoutubeScheduleTime(e.target.value)}
                                className="bg-white"
                              />
                            </div>
                          </div>

                          <div className="bg-white/50 rounded-lg p-3 mb-4">
                            <p className="text-sm text-gray-700">
                              <span className="font-semibold">예약 일시:</span>{" "}
                              {youtubeScheduleDate ? (
                                <>
                                  {new Date(youtubeScheduleDate).toLocaleDateString('ko-KR', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    weekday: 'long'
                                  })} {youtubeScheduleTime}
                                </>
                              ) : (
                                "날짜를 선택해주세요"
                              )}
                            </p>
                          </div>

                          <div className="flex gap-3">
                            <Button
                              onClick={handleStartAutomation}
                              disabled={!youtubeScheduleDate}
                              className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold py-3"
                            >
                              <Zap className="w-4 h-4 mr-2" />
                              자동화 시작하기 🚀
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowScheduleSelector(false)
                                setWorkflowMode(null)
                              }}
                              className="px-4"
                            >
                              취소
                            </Button>
                          </div>
                          
                          <p className="text-xs text-gray-500 mt-3 text-center">
                            ※ 실제 유튜브 업로드는 Google Cloud Console 연동 후 가능합니다.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

                </div>

            {/* 우측 사이드 패널 */}
            {selectedCategory && (
              <div className="w-full lg:w-80 xl:w-96 order-2 lg:order-3">
                <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white sticky top-4">
                  <CardHeader className="pb-4 border-b border-gray-100">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-gray-600" />
                        <CardTitle className="text-sm md:text-base font-semibold text-gray-700">
                          일주일간 인기 주제
                        </CardTitle>
                      </div>
                      <Button
                        onClick={loadTrendingTopics}
                        disabled={isLoadingTrending || !selectedCategory}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                      >
                        {isLoadingTrending ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            로딩중
                          </>
                        ) : (
                          "불러오기"
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      최근 일주일간 조회수가 높았던 주제
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoadingTrending ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    ) : trendingTopics.length > 0 ? (
                      <div className="space-y-1 max-h-[500px] overflow-y-auto px-4 pb-4 custom-scrollbar">
                        {trendingTopics.map((topic, index) => (
                          <div
                            key={index}
                            className={`group p-3 rounded-lg transition-all cursor-pointer ${
                              selectedTrendingVideoId === topic.videoId
                                ? "bg-gray-50"
                                : "bg-white hover:bg-gray-50"
                            }`}
                            onClick={() => {
                              setSelectedTopic(topic.title)
                              setIsCustomTopicSelected(false)
                              setCompletedSteps((prev) => {
                                if (!prev.includes("topic")) {
                                  return [...prev, "topic"]
                                }
                                return prev
                              })
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xs font-semibold mt-0.5">
                                {index + 1}
                              </div>
                              <p className="text-sm font-medium text-gray-800 leading-relaxed flex-1 line-clamp-2">
                                {topic.title}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedTrendingVideoId(
                                    selectedTrendingVideoId === topic.videoId ? null : topic.videoId
                                  )
                                }}
                                className={`flex-shrink-0 p-1.5 rounded-md transition-colors ${
                                  selectedTrendingVideoId === topic.videoId
                                    ? "bg-gray-200 text-gray-700"
                                    : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                                }`}
                                title="영상 미리보기"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-sm text-gray-500 px-4">
                        위의 "불러오기" 버튼을 클릭하여 인기 주제를 불러오세요
                      </div>
                    )}
                  </CardContent>

                  {/* 뉴스기사 긁어오기 버튼 (사회 트렌드 카테고리일 때만 표시) */}
                  {selectedCategory === "society" && (
                    <div className="p-4 border-t border-gray-100">
                      <Button
                        onClick={async () => {
                          setIsCrawlingNews(true)
                          setCrawledNews([])
                          try {
                            // 키워드로 뉴스 검색 (카테고리명 또는 선택된 주제 사용)
                            const keyword = selectedTopic || "사회 트렌드"
                            console.log("[News] 뉴스 크롤링 시작, 키워드:", keyword)
                            
                            const response = await fetch("/api/crawl-news", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({ keyword }),
                            })

                            if (!response.ok) {
                              throw new Error(`뉴스 크롤링 실패: ${response.status}`)
                            }

                            const data = await response.json()
                            console.log("[News] 뉴스 크롤링 결과:", data)
                            
                            if (data.success && data.news) {
                              setCrawledNews(data.news)
                              alert(`뉴스 ${data.count}개를 가져왔습니다!`)
                            } else {
                              throw new Error(data.error || "뉴스 크롤링에 실패했습니다.")
                            }
                          } catch (error) {
                            console.error("[News] 뉴스 크롤링 오류:", error)
                            alert(`뉴스 크롤링에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
                          } finally {
                            setIsCrawlingNews(false)
                          }
                        }}
                        disabled={isCrawlingNews}
                        className="w-full"
                        variant="outline"
                      >
                        {isCrawlingNews ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            뉴스 크롤링 중...
                          </>
                        ) : (
                          <>
                            <Newspaper className="w-4 h-4 mr-2" />
                            뉴스기사 긁어오기
                          </>
                        )}
                      </Button>
                      
                      {/* 크롤링된 뉴스 표시 */}
                      {crawledNews.length > 0 && (
                        <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">크롤링된 뉴스 ({crawledNews.length}개)</h4>
                          {crawledNews.map((news, index) => (
                            <div
                              key={index}
                              className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                            >
                              <a
                                href={news.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <h5 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2 hover:text-red-600 transition-colors">
                                  {news.title}
                                </h5>
                                {news.description && (
                                  <p className="text-xs text-gray-600 line-clamp-2">
                                    {news.description}
                                  </p>
                                )}
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 유튜브 영상 미리보기 */}
                  {selectedTrendingVideoId && (
                    <div className="p-4 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">영상 미리보기</h3>
                        <button
                          onClick={() => setSelectedTrendingVideoId(null)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                        <iframe
                          src={`https://www.youtube.com/embed/${selectedTrendingVideoId}?autoplay=0&rel=0`}
                          className="absolute top-0 left-0 w-full h-full rounded-lg"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                      <a
                        href={`https://www.youtube.com/watch?v=${selectedTrendingVideoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        유튜브에서 보기
                      </a>
                    </div>
                  )}
                </Card>

                {/* 잘뜨는 주제 URL 넣어 주제 분석 */}
                <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white sticky top-4 mt-4">
                  <CardHeader className="pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Youtube className="w-4 h-4 text-gray-600" />
                      <CardTitle className="text-sm md:text-base font-semibold text-gray-700">
                        잘뜨는 주제 URL 넣어 주제 분석
                      </CardTitle>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      YouTube 영상 URL을 입력하면 주제를 분석하고 유사 주제를 추천합니다
                    </p>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        className="w-full"
                        disabled={isAnalyzingTopic}
                      />
                      <Button
                        onClick={async () => {
                          if (!youtubeUrl.trim()) {
                            alert("YouTube URL을 입력해주세요.")
                            return
                          }

                          setIsAnalyzingTopic(true)
                          setTopicAnalysisResult(null)

                          try {
                            const youtubeApiKey = localStorage.getItem("youtube_api_key") || undefined
                            const openaiApiKey = getApiKey()

                            const response = await fetch("/api/youtube-analyze-topic", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                url: youtubeUrl.trim(),
                                youtubeApiKey,
                                openaiApiKey,
                              }),
                            })

                            if (!response.ok) {
                              const errorData = await response.json().catch(() => ({}))
                              throw new Error(errorData.error || `분석 실패: ${response.status}`)
                            }

                            const data = await response.json()
                            
                            if (data.success) {
                              setTopicAnalysisResult(data)
                            } else {
                              throw new Error(data.error || "분석에 실패했습니다.")
                            }
                          } catch (error) {
                            console.error("주제 분석 오류:", error)
                            alert(`주제 분석에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
                          } finally {
                            setIsAnalyzingTopic(false)
                          }
                        }}
                        disabled={isAnalyzingTopic || !youtubeUrl.trim()}
                        className="w-full"
                        variant="outline"
                      >
                        {isAnalyzingTopic ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            분석 중...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            주제 분석하기
                          </>
                        )}
                      </Button>
                    </div>

                    {/* 분석 결과 표시 */}
                    {topicAnalysisResult && (
                      <div className="space-y-4 pt-4 border-t border-gray-100">
                        {/* 영상 정보 */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-700">영상 정보</h4>
                          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            {topicAnalysisResult.videoInfo.thumbnailUrl && (
                              <img
                                src={topicAnalysisResult.videoInfo.thumbnailUrl}
                                alt={topicAnalysisResult.videoInfo.title}
                                className="w-full rounded-lg"
                              />
                            )}
                            <h5 className="text-sm font-medium text-gray-900 line-clamp-2">
                              {topicAnalysisResult.videoInfo.title}
                            </h5>
                            <div className="flex items-center gap-4 text-xs text-gray-600">
                              <span>조회수: {Number.parseInt(topicAnalysisResult.videoInfo.viewCount).toLocaleString()}</span>
                              <span>좋아요: {Number.parseInt(topicAnalysisResult.videoInfo.likeCount).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* 핵심 주제 */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-700">핵심 주제</h4>
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-sm text-gray-800">{topicAnalysisResult.analysis.mainTopic}</p>
                          </div>
                        </div>

                        {/* 추천 주제 */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-700">추천 주제 (5개)</h4>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {topicAnalysisResult.analysis.recommendedTopics.map((topic, index) => (
                              <div
                                key={index}
                                className="group p-3 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer"
                                onClick={() => {
                                  setSelectedTopic(topic)
                                  setIsCustomTopicSelected(false)
                                  setCompletedSteps((prev) => {
                                    if (!prev.includes("topic")) {
                                      return [...prev, "topic"]
                                    }
                                    return prev
                                  })
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-semibold mt-0.5">
                                    {index + 1}
                                  </div>
                                  <p className="text-sm font-medium text-gray-800 leading-relaxed flex-1">
                                    {topic}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
            {isGenerating && <AIGeneratingAnimation type="맞춤 주제" />}
          </div>
        )

      case "planning":
        return (
          <div className="space-y-6">
            {/* 제목 & 설명 */}
            <div className="space-y-2 mb-6">
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">대본 기획 및 초안</h1>
              <p className="text-sm md:text-base text-gray-500">선택한 주제 기반 대본 구조 설계</p>
            </div>

            {isCustomTopicSelected ? (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-slate-900">주제 직접 입력</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">원하는 주제를 입력하세요</label>
                    <Input
                      placeholder="예: 60대를 위한 고혈압 관리 방법"
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      className="text-lg"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        console.log("[v0] 주제 확정하기 버튼 클릭됨, customTopic:", customTopic) // 디버깅 로그 추가
                        if (customTopic.trim()) {
                          setSelectedTopic(customTopic)
                          setCompletedSteps((prev) => [...prev, "topic"]) // "topic" 대신 "planning" 완료로 설정
                          // 자동화 모드가 아니면 다음 단계로 이동
                          if (!isAutoMode) {
                            setActiveStep("script")
                          }
                        }
                      }}
                      disabled={!customTopic.trim()}
                      className="flex-1"
                    >
                      주제 확정하기
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCustomTopicSelected(false)
                        setCustomTopic("")
                      }}
                    >
                      취소
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : selectedTopic ? (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-slate-900">선택된 주제</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className="text-base font-medium text-gray-900 mb-4">{selectedTopic}</p>
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsCustomTopicSelected(true)
                        setCustomTopic(selectedTopic)
                      }}
                    >
                      주제 수정하기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardContent className="p-8 text-center">
                  <p className="text-gray-500 mb-4">먼저 주제를 선택해주세요</p>
                  <Button onClick={() => setActiveStep("topic")} variant="outline" className="border-gray-300">
                    주제 선택하러 가기
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
              <CardHeader className="pb-4 border-b border-gray-100">
                <CardTitle className="text-lg font-semibold text-slate-900">벤치마킹 대본 입력 (선택사항)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="참고할 대본이 있다면 여기에 입력하세요..."
                  value={customScript}
                  onChange={(e) => setCustomScript(e.target.value)}
                  className="min-h-[200px]"
                />
              </CardContent>
            </Card>

            {selectedTopic && (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-slate-900">대본 기획 생성</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {/* 대본 기획 생성 버튼에 애니메이션 추가 */}
                  <Button onClick={handleScriptPlanGeneration} disabled={isGenerating || isScanning} className="w-full h-12 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold">
                    {isGenerating && !isScanning ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        AI가 대본 기획을 생성하고 있습니다...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        대본 기획하기
                      </>
                    )}
                  </Button>

                  {scriptPlan && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">생성된 대본 기획안</label>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(scriptPlan)}>
                            <Copy className="w-4 h-4 mr-2" />
                            복사
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setActiveStep("script")}>
                            대본 생성으로 이동
                          </Button>
                        </div>
                      </div>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Wand2 className="w-5 h-5" />
                            AI 대본 에디터
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="relative">
                            <Textarea
                              value={scriptPlan}
                              onChange={(e) => setScriptPlan(e.target.value)}
                              className="min-h-[400px] font-mono text-sm"
                              placeholder="대본 기획안이 여기에 표시됩니다..."
                            />
                            {isScanning && (
                              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-md">
                                <div className="scan-line" />
                                <div className="absolute inset-0 bg-blue-500/5" />
                              </div>
                            )}
                          </div>

                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>글자 수: {scriptPlan.length.toLocaleString()}자</span>
                          </div>

                          <div className="border-t pt-4 space-y-3">
                            <h4 className="font-medium text-sm">AI 개선 요청</h4>
                            <div className="flex gap-2">
                              <Input
                                placeholder="예: 더 친근한 톤으로 바꿔줘, 의학적 근거를 더 추가해줘"
                                value={improvementRequest}
                                onChange={(e) => setImprovementRequest(e.target.value)}
                                className="flex-1"
                              />
                              <Button
                                onClick={handleScriptImprovement}
                                disabled={!improvementRequest.trim() || isGenerating}
                                size="sm"
                              >
                                {isGenerating ? (
                                  <Sparkles className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Wand2 className="w-4 h-4 mr-2" />
                                    개선하기
                                  </>
                                )}
                              </Button>
                            </div>

                            {/* 대본 초안 생성 버튼 */}
                            <div className="border-t pt-4 mt-4">
                              <Button
                                onClick={handleScriptDraftGeneration}
                                disabled={isGenerating || !scriptPlan}
                                className="w-full"
                                variant="default"
                              >
                                {isGenerating ? (
                                  <>
                                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                                    AI가 대본 초안을 생성하고 있습니다...
                                  </>
                                ) : (
                                  <>
                                    <FileText className="w-4 h-4 mr-2" />
                                    대본 초안 생성하기
                                  </>
                                )}
                              </Button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setImprovementRequest("더 친근하고 따뜻한 톤으로 바꿔줘")}
                              >
                                친근한 톤
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setImprovementRequest("의학적 근거와 통계를 더 추가해줘")}
                              >
                                의학적 근거 강화
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setImprovementRequest("실제 환자 사례를 더 구체적으로 만들어줘")}
                              >
                                사례 구체화
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setImprovementRequest("시청자의 관심을 더 끌 수 있는 훅을 만들어줘")}
                              >
                                훅 강화
                              </Button>
                            </div>
                          </div>

                          <div className="border-t pt-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm">대본 품질 분석</h4>
                              <Button
                                onClick={handleScriptAnalysis}
                                disabled={isGenerating}
                                variant="outline"
                                size="sm"
                              >
                                {isGenerating ? (
                                  <Sparkles className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Target className="w-4 h-4 mr-2" />
                                    분석하기
                                  </>
                                )}
                              </Button>
                            </div>

                            {analysisResult && (
                              <div className="space-y-6">
                                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                                  <CardContent className="p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                      <BarChart3 className="w-5 h-5 text-blue-600" />
                                      <h4 className="font-semibold text-blue-900">품질 점수 분석</h4>
                                    </div>

                                    {(() => {
                                      const { qualityScores, improvementAreas, expectedMetrics } =
                                        parseAnalysisForCharts(analysisResult)
                                      return (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                          {/* 품질 점수 레이더 차트 */}
                                          <div className="bg-white rounded-lg p-4 shadow-sm">
                                            <h5 className="font-medium mb-3 text-gray-800">품질 점수 분석</h5>
                                            <div className="space-y-3">
                                              {qualityScores.map((item, index) => (
                                                <div key={index} className="space-y-1">
                                                  <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600">{item.category}</span>
                                                    <span className="font-medium text-blue-600">{item.score}/100</span>
                                                  </div>
                                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-1000 ease-out"
                                                      style={{ width: `${item.score}%` }}
                                                    />
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>

                                          {/* 개선 우선순위 차트 */}
                                          <div className="bg-white rounded-lg p-4 shadow-sm">
                                            <h5 className="font-medium mb-3 text-gray-800">개선 우선순위</h5>
                                            <div className="space-y-3">
                                              {improvementAreas.map((item, index) => (
                                                <div key={index} className="flex items-center gap-3">
                                                  <div className="w-16 text-sm text-gray-600">{item.area}</div>
                                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                    <div
                                                      className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-1000 ease-out"
                                                      style={{ width: `${item.priority}%` }}
                                                    />
                                                  </div>
                                                  <div className="w-8 text-sm font-medium text-orange-600">
                                                    {item.priority}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>

                                          {/* 예상 성과 지표 */}
                                          <div className="bg-white rounded-lg p-4 shadow-sm lg:col-span-2">
                                            <h5 className="font-medium mb-3 text-gray-800">예상 성과 지표</h5>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                              {expectedMetrics.map((metric, index) => (
                                                <div
                                                  key={index}
                                                  className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200"
                                                >
                                                  <div className="text-2xl font-bold text-green-600 mb-1">
                                                    {metric.value.toLocaleString()}
                                                  </div>
                                                  <div className="text-xs text-green-700 mb-1">{metric.unit}</div>
                                                  <div className="text-xs text-gray-600">{metric.metric}</div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>

                                          {/* AI 분석 텍스트 요약 */}
                                          <div className="bg-white rounded-lg p-4 shadow-sm lg:col-span-2">
                                            <h5 className="font-medium mb-3 text-gray-800 flex items-center gap-2">
                                              <Sparkles className="w-4 h-4 text-purple-500" />
                                              AI 분석 요약
                                            </h5>
                                            <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg">
                                              {analysisResult}
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })()}
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* 대본 초안 표시 */}
                      {scriptDraft && (
                        <Card className="mt-4">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <FileText className="w-5 h-5" />
                              대본 초안
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="relative">
                              <Textarea
                                value={scriptDraft}
                                onChange={(e) => setScriptDraft(e.target.value)}
                                className="min-h-[500px] font-mono text-sm"
                                placeholder="대본 초안이 여기에 표시됩니다..."
                              />
                            </div>
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                              <span>글자 수: {scriptDraft.length.toLocaleString()}자</span>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => copyToClipboard(scriptDraft)}>
                                <Copy className="w-4 h-4 mr-2" />
                                복사
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setScript(scriptDraft)
                                  setActiveStep("script")
                                }}
                              >
                                대본 생성으로 이동
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {isGenerating && activeStep === "planning" && <AIGeneratingAnimation type="대본 기획" />}
          </div>
        )

      case "script":
        return (
          <div className="space-y-6">
            {/* 제목 & 설명 */}
            <div className="space-y-2 mb-6">
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">대본 생성</h1>
              <p className="text-sm md:text-base text-gray-500">20분 분량의 대본 자동 생성</p>
            </div>

            <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
              <CardHeader className="pb-4 border-b border-gray-100">
                <CardTitle className="text-lg font-semibold text-slate-900">선택된 주제</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-base text-gray-700">{selectedTopic || "주제를 먼저 선택해주세요"}</p>
              </CardContent>
            </Card>

            {scriptPlan && (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-slate-900">대본 기획안</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                    <div className="whitespace-pre-wrap text-sm text-gray-700">{scriptPlan}</div>
                  </div>
                  <div className="flex justify-between items-center mt-4 text-xs text-gray-500">
                    <span>기획안 글자 수: {scriptPlan.length.toLocaleString()}자</span>
                    <Button variant="outline" size="sm" onClick={() => setActiveStep("planning")} className="border-gray-300">
                      기획안 수정하기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {scriptDraft ? (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-slate-900">대본 초안</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto mb-4">
                    <div className="whitespace-pre-wrap text-sm text-gray-700">{scriptDraft.substring(0, 500)}...</div>
                  </div>
                  <div className="flex justify-between items-center mb-4 text-xs text-gray-500">
                    <span>초안 글자 수: {scriptDraft.length.toLocaleString()}자</span>
                    <Button variant="outline" size="sm" onClick={() => setActiveStep("planning")} className="border-gray-300">
                      초안 수정하기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : scriptPlan ? (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-slate-900">대본 기획안</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                    <div className="whitespace-pre-wrap text-sm text-gray-700">{scriptPlan}</div>
                  </div>
                  <div className="flex justify-between items-center mt-4 text-xs text-gray-500">
                    <span>기획안 글자 수: {scriptPlan.length.toLocaleString()}자</span>
                    <Button variant="outline" size="sm" onClick={() => setActiveStep("planning")} className="border-gray-300">
                      기획안 수정하기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {scriptDraft && (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-slate-900">최종 대본 생성</CardTitle>
                  <p className="text-sm text-gray-500 mt-2">
                    위의 대본 초안을 바탕으로 AIPASOA 포맷으로 재구성하여 최종 대본을 생성합니다.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    위의 대본 초안을 바탕으로 AIPASOA 포맷으로 재구성하여 최종 대본을 생성합니다.
                  </p>
                  <p className="text-xs text-red-600">
                    ※ 대본 초안이 먼저 작성되어 있어야 합니다.
                  </p>
                  
                  {/* 대본 시간 선택 드롭다운 */}
                  <div className="space-y-2">
                    <Label htmlFor="script-duration" className="text-sm font-medium">
                      대본 시간 선택
                    </Label>
                    <Select
                      value={scriptDuration.toString()}
                      onValueChange={(value) => setScriptDuration(Number.parseInt(value, 10))}
                    >
                      <SelectTrigger id="script-duration" className="w-full">
                        <SelectValue placeholder="대본 시간을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5분 (약 {Math.floor(5 * 60 * 6.9).toLocaleString()}자, 약 5k 토큰)</SelectItem>
                        <SelectItem value="10">10분 (약 {Math.floor(10 * 60 * 6.9).toLocaleString()}자, 약 9.5k 토큰)</SelectItem>
                        <SelectItem value="20">20분 (약 {Math.floor(20 * 60 * 6.9).toLocaleString()}자, 약 19k 토큰)</SelectItem>
                        <SelectItem value="25">25분 (약 {Math.floor(25 * 60 * 6.9).toLocaleString()}자, 약 24k 토큰)</SelectItem>
                        <SelectItem value="30">30분 (약 {Math.floor(30 * 60 * 6.9).toLocaleString()}자, 약 28.5k 토큰)</SelectItem>
                        <SelectItem value="35">35분 (약 {Math.floor(35 * 60 * 6.9).toLocaleString()}자, 약 33k 토큰)</SelectItem>
                        <SelectItem value="40">40분 (약 {Math.floor(40 * 60 * 6.9).toLocaleString()}자, 약 38k 토큰)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      선택한 시간에 맞춰 대본이 생성됩니다.
                      {(() => {
                        const requiredTokens = Math.ceil(Math.floor(scriptDuration * 60 * 6.9) * 2.3 * 1.1)
                        const maxPossibleChars = Math.floor(100000 / 2.3 / 1.1)
                        const maxPossibleMinutes = Math.floor(maxPossibleChars / 6.9 / 60)
                        if (requiredTokens > 100000) {
                          return (
                            <span className="block mt-1 text-amber-600 font-medium">
                              ⚠️ {scriptDuration}분은 약 {requiredTokens.toLocaleString()} 토큰이 필요하지만, 
                              o4-mini의 max_tokens 제한(100,000)에 걸립니다. 
                              최대 가능한 대본 길이는 약 {maxPossibleChars.toLocaleString()}자 (약 {maxPossibleMinutes}분)입니다. 
                              대본이 완전히 생성되지 않을 수 있습니다.
                            </span>
                          )
                        }
                        return null
                      })()}
                    </p>
                  </div>
                  
                  {/* 대본 생성 버튼에 애니메이션 추가 */}
                  <Button 
                    onClick={handleFullScriptGeneration} 
                    disabled={isGenerating} 
                    className="w-full bg-red-600 hover:bg-red-700 text-white" 
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        대본 재구성 중...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        대본 재구성 (AIPASOA)
                      </>
                    )}
                  </Button>

                  <div className="grid grid-cols-1 gap-2">
                    <Button onClick={() => setShowDirectScriptInput(true)} variant="outline" className="w-full" size="lg">
                      <FileText className="w-4 h-4 mr-2" />
                      직접 대본 넣기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {showDirectScriptInput && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">직접 대본 입력</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    이미 준비된 대본이 있다면 여기에 직접 입력하세요. 19,000자 분량을 권장합니다.
                  </p>
                  <Textarea
                    placeholder="대본을 여기에 입력하세요..."
                    value={directScript}
                    onChange={(e) => setDirectScript(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                  />
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>글자 수: {directScript.length.toLocaleString()}자</span>
                    <span>예상 영상 길이: {Math.floor(directScript.length / 6.9 / 60)}분 {Math.floor((directScript.length / 6.9) % 60)}초</span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleDirectScriptSubmit} disabled={!directScript.trim()} className="flex-1">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      대본 적용하기
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDirectScriptInput(false)
                        setDirectScript("")
                      }}
                    >
                      취소
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!scriptPlan && (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground mb-4">먼저 대본 기획을 완료해주세요</p>
                  <Button onClick={() => setActiveStep("planning")} variant="outline">
                    대본 기획하러 가기
                  </Button>
                </CardContent>
              </Card>
            )}

            {scriptLines.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">생성된 문장 리스트</CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          if (script) {
                            copyToClipboard(script)
                            alert("최종 대본이 복사되었습니다.")
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        최종 대본 복사
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          const textToCopy = scriptLines.map((line) => `${line.id}. ${line.text}`).join("\n")
                          copyToClipboard(textToCopy)
                          alert("문장 리스트가 복사되었습니다.")
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        문장 리스트 복사
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-12">
                              <Checkbox
                                checked={selectedLineIds.size === scriptLines.length && scriptLines.length > 0}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedLineIds(new Set(scriptLines.map((l) => l.id)))
                                  } else {
                                    setSelectedLineIds(new Set())
                                  }
                                }}
                              />
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-20">번호</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">문장</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {scriptLines.map((line) => (
                            <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 align-top pt-4">
                                <Checkbox
                                  checked={selectedLineIds.has(line.id)}
                                  onCheckedChange={(checked) => {
                                    const newSelected = new Set(selectedLineIds)
                                    if (checked) {
                                      newSelected.add(line.id)
                                    } else {
                                      newSelected.delete(line.id)
                                    }
                                    setSelectedLineIds(newSelected)
                                  }}
                                />
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 align-top pt-4">{line.id}</td>
                              <td className="px-4 py-3">
                                <Textarea
                                  value={line.text}
                                  onChange={(e) => {
                                    setScriptLines((prev) =>
                                      prev.map((l) => (l.id === line.id ? { ...l, text: e.target.value } : l))
                                    )
                                  }}
                                  className="min-h-[60px] text-sm font-mono resize-y"
                                  placeholder="문장을 입력하세요..."
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        총 {scriptLines.length}개의 문장 그룹이 생성되었습니다. 각 그룹은 1~2개의 문장으로 구성됩니다.
                        {scriptLines.length > 0 && (
                          <span className="ml-2">
                            (예상 영상 길이: 약 {Math.floor(scriptLines.reduce((sum, l) => sum + l.text.length, 0) / 6.9 / 60)}분 {Math.floor((scriptLines.reduce((sum, l) => sum + l.text.length, 0) / 6.9) % 60)}초)
                          </span>
                        )}
                      </div>
                      {selectedLineIds.size > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm(`선택한 ${selectedLineIds.size}개의 문장을 삭제하시겠습니까?`)) {
                              // 삭제 및 ID 재정렬을 한 번에 처리
                              setScriptLines((prev) => {
                                const filtered = prev.filter((l) => !selectedLineIds.has(l.id))
                                return filtered.map((l, index) => ({ ...l, id: index + 1 }))
                              })
                              setSelectedLineIds(new Set())
                              alert("선택한 문장이 삭제되었습니다.")
                            }
                          }}
                        >
                          선택한 {selectedLineIds.size}개 삭제
                        </Button>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      💡 각 문장을 직접 수정할 수 있습니다. 체크박스로 선택하여 삭제할 수도 있습니다. 수정 후 이미지 생성이나 TTS 생성을 진행하세요.
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {script && (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white mb-6">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-slate-900">생성된 대본 (전체 보기 및 편집)</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium">대본 전체 내용 (수정 가능)</label>
                <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          // 수정된 대본을 다시 문장 리스트로 변환
                          const groupedLines = splitScriptIntoLines(script)
                          
                          // ID 재정렬
                          const renumberedLines = groupedLines.map((l, index) => ({ ...l, id: index + 1 }))
                          setScriptLines(renumberedLines)
                          setSelectedLineIds(new Set()) // 선택 초기화
                          alert(`대본이 ${renumberedLines.length}개의 문장 그룹으로 변환되었습니다.`)
                        }}
                        disabled={!script.trim()}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        문장 리스트로 변환
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(script)}>
                    <Copy className="w-4 h-4 mr-2" />
                    복사
                  </Button>
                </div>
              </div>
              <Textarea
                    placeholder="대본이 여기에 생성됩니다. 수정 후 '문장 리스트로 변환' 버튼을 클릭하세요..."
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />
                  <div className="mt-2 text-xs text-muted-foreground">
                    💡 대본을 수정한 후 "문장 리스트로 변환" 버튼을 클릭하면 수정된 내용이 반영됩니다.
            </div>
                </CardContent>
              </Card>
            )}
            {isGenerating && activeStep === "script" && <AIGeneratingAnimation type="완전한 대본" />}
          </div>
        )

      case "image":
        return (
          <div className="space-y-6">
            {/* 제목 & 설명 */}
            <div className="space-y-2 mb-6">
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">이미지 생성</h1>
              <p className="text-sm md:text-base text-gray-500">문장별 이미지 생성</p>
            </div>

            {/* 역사 카테고리 스타일 선택 */}
            {selectedCategory === "history" && (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white mb-6">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-slate-900">이미지 스타일 선택</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                <Button
                      variant={historyStyle === "animation" ? "default" : "outline"}
                      onClick={() => setHistoryStyle("animation")}
                      className="flex-1"
                    >
                      애니메이션
                </Button>
                    <Button
                      variant={historyStyle === "realistic" ? "default" : "outline"}
                      onClick={() => setHistoryStyle("realistic")}
                      className="flex-1"
                    >
                      실사
                    </Button>
              </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {historyStyle === "animation" 
                      ? "고품질 2D 애니메이션 영화 스타일로 역사적 장면을 표현합니다. 모든 이미지가 동일한 시대와 문화권을 유지하며, 실사 스타일은 절대 사용하지 않습니다." 
                      : "실사 스타일로 역사적 장면을 사실적으로 표현합니다. 모든 이미지가 동일한 시대와 문화권을 유지합니다."}
                  </p>
                </CardContent>
              </Card>
            )}

            {scriptLines.length === 0 ? (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardContent className="p-8 text-center">
                  <p className="text-gray-500 mb-4">먼저 대본을 생성해주세요</p>
                  <Button onClick={() => setActiveStep("script")} variant="outline" className="border-gray-300">
                    대본 생성하러 가기
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                  <CardHeader className="pb-4 border-b border-gray-100">
                    <CardTitle className="text-lg font-semibold text-slate-900">생성된 문장 리스트</CardTitle>
                    <p className="text-sm text-gray-500 mt-2">
                      각 문장 그룹에 맞는 이미지를 자동으로 생성합니다.
                    </p>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                <Button
                      onClick={handleGenerateImagesForLines}
                      disabled={isGeneratingImages || scriptLines.length === 0}
                      className="w-full h-12 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold"
                      size="lg"
                    >
                      {isGeneratingImages ? (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                          이미지 생성 중... ({imageGenerationProgress.current}/{imageGenerationProgress.total})
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-4 h-4 mr-2" />
                          모든 문장에 이미지 생성하기
                        </>
                      )}
                </Button>

                {/* 선택한 이미지를 영상으로 변환 버튼 */}
                {generatedImages.length > 0 && selectedImagesForVideo.size > 0 && (
                  <Button
                    onClick={handleConvertImagesToVideo}
                    disabled={isConvertingToVideo || selectedImagesForVideo.size === 0}
                    className="w-full h-12 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold"
                    size="lg"
                  >
                    {isConvertingToVideo ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        영상 변환 중... ({Array.from(selectedImagesForVideo).length}개)
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4 mr-2" />
                        선택한 이미지 {selectedImagesForVideo.size}개를 영상으로 변환
                      </>
                    )}
                  </Button>
                )}

                    {imageGenerationProgress.total > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-red-600 h-2.5 rounded-full transition-all duration-300"
                          style={{
                            width: `${(imageGenerationProgress.current / imageGenerationProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scriptLines.map((line) => {
                    const generatedImage = generatedImages.find((img) => img.lineId === line.id)
                    return (
                      <Card 
                        key={line.id}
                        onMouseEnter={() => setHoveredImageId(line.id)}
                        onMouseLeave={() => setHoveredImageId(null)}
                        className={`relative border border-gray-200 rounded-2xl shadow-sm bg-white ${selectedImagesForVideo.has(line.id) ? "ring-2 ring-blue-500" : ""}`}
                      >
                        <CardHeader className="pb-3 border-b border-gray-100">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold text-slate-900">문장 {line.id}</CardTitle>
                            {generatedImage && (
                              <input
                                type="checkbox"
                                checked={selectedImagesForVideo.has(line.id)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedImagesForVideo)
                                  if (e.target.checked) {
                                    newSelected.add(line.id)
                                  } else {
                                    newSelected.delete(line.id)
                                  }
                                  setSelectedImagesForVideo(newSelected)
                                }}
                                className="w-4 h-4"
                              />
                        )}
                      </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-xs text-muted-foreground line-clamp-3">{line.text}</p>
                          <div className="relative aspect-video w-full">
                            {generatedImage ? (
                              <div className="space-y-2">
                                <div className="relative aspect-video w-full">
                                  {convertedVideos.has(line.id) ? (
                                    <video
                                      src={convertedVideos.get(line.id)}
                                      controls
                                      className="w-full h-full object-cover rounded-lg border aspect-video"
                                    />
                                  ) : (
                                    <img
                                      src={generatedImage.imageUrl}
                                      alt={`문장 ${line.id} 이미지`}
                                      className="w-full h-full object-cover rounded-lg border aspect-video"
                                    />
                                  )}
                                  {/* Hover 시 버튼 표시 */}
                                  {hoveredImageId === line.id && (
                                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center gap-2">
                                      <Dialog open={customImageDialogOpen === line.id} onOpenChange={(open) => {
                                        if (!open) {
                                          setCustomImageDialogOpen(null)
                                          setCustomImagePrompt("")
                                        } else {
                                          setCustomImageDialogOpen(line.id)
                                        }
                                      }}>
                                        <DialogTrigger asChild>
                                          <Button
                                            size="sm"
                                            className="bg-blue-600 hover:bg-blue-700"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setCustomImageDialogOpen(line.id)
                                            }}
                                          >
                                            <Sparkles className="w-4 h-4 mr-1" />
                                            AI생성
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader>
                                            <DialogTitle>커스텀 이미지 생성</DialogTitle>
                                            <DialogDescription>
                                              원하는 이미지 내용을 한글로 입력하세요. 영어 프롬프트로 자동 변환되어 이미지가 생성됩니다.
                                            </DialogDescription>
                                          </DialogHeader>
                                          <div className="space-y-4">
                                            <Textarea
                                              placeholder="예: 조선시대 궁중에서 왕이 신하들과 회의하는 장면"
                                              value={customImagePrompt}
                                              onChange={(e) => setCustomImagePrompt(e.target.value)}
                                              className="min-h-[100px]"
                                            />
                                            <div className="flex gap-2">
                                              <Button
                                                onClick={() => handleGenerateCustomImage(line.id)}
                                                disabled={isGeneratingCustomImage || !customImagePrompt.trim()}
                                                className="flex-1"
                                              >
                                                {isGeneratingCustomImage ? (
                                                  <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    생성 중...
                                                  </>
                                                ) : (
                                                  <>
                                                    <Sparkles className="w-4 h-4 mr-2" />
                                                    이미지 생성
                                                  </>
                                                )}
                                              </Button>
                                              <Button
                                                variant="outline"
                                                onClick={() => {
                                                  setCustomImageDialogOpen(null)
                                                  setCustomImagePrompt("")
                                                }}
                                              >
                                                취소
                                              </Button>
                      </div>
                      </div>
                                        </DialogContent>
                                      </Dialog>
                                      <label>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) {
                                              handleImageUpload(line.id, file)
                                            }
                                          }}
                                        />
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="bg-white hover:bg-gray-100"
                                          asChild
                                        >
                                          <span>
                                            <Upload className="w-4 h-4 mr-1" />
                                            업로드
                                          </span>
                                        </Button>
                                      </label>
                    </div>
                                  )}
                  </div>
                                <div className="text-xs text-muted-foreground">
                                  <p className="font-medium mb-1">생성된 프롬프트:</p>
                                  <p className="line-clamp-2">{generatedImage.prompt}</p>
                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative aspect-video">
                                {hoveredImageId === line.id ? (
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <Dialog open={customImageDialogOpen === line.id} onOpenChange={(open) => {
                                      if (!open) {
                                        setCustomImageDialogOpen(null)
                                        setCustomImagePrompt("")
                                      } else {
                                        setCustomImageDialogOpen(line.id)
                                      }
                                    }}>
                                      <DialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          className="bg-blue-600 hover:bg-blue-700"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setCustomImageDialogOpen(line.id)
                                          }}
                                        >
                                          <Sparkles className="w-4 h-4 mr-1" />
                                          AI생성
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>커스텀 이미지 생성</DialogTitle>
                                          <DialogDescription>
                                            원하는 이미지 내용을 한글로 입력하세요. 영어 프롬프트로 자동 변환되어 이미지가 생성됩니다.
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                    <Textarea
                                            placeholder="예: 조선시대 궁중에서 왕이 신하들과 회의하는 장면"
                                            value={customImagePrompt}
                                            onChange={(e) => setCustomImagePrompt(e.target.value)}
                                            className="min-h-[100px]"
                                          />
                                          <div className="flex gap-2">
                                            <Button
                                              onClick={() => handleGenerateCustomImage(line.id)}
                                              disabled={isGeneratingCustomImage || !customImagePrompt.trim()}
                                              className="flex-1"
                                            >
                                              {isGeneratingCustomImage ? (
                                                <>
                                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                  생성 중...
                  </>
                ) : (
                  <>
                                                  <Sparkles className="w-4 h-4 mr-2" />
                                                  이미지 생성
                  </>
                )}
              </Button>
                                            <Button
                                              variant="outline"
                                              onClick={() => {
                                                setCustomImageDialogOpen(null)
                                                setCustomImagePrompt("")
                                              }}
                                            >
                                              취소
                                            </Button>
            </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                    <label>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) {
                                            handleImageUpload(line.id, file)
                                          }
                                        }}
                                      />
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        asChild
                                      >
                                        <span>
                                          <Upload className="w-4 h-4 mr-1" />
                                          업로드
                                        </span>
                                      </Button>
                                    </label>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">이미지 미생성</p>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
              </div>
                  </>
                )}

            {doctorKoreanDescription && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">선택된 인물 정보</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="font-medium text-blue-800">👨‍⚕️ {doctorKoreanDescription}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {doctorPrompt && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">영어 프롬프트</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-sm font-mono text-green-800">{doctorPrompt}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(doctorPrompt)}>
                      <Copy className="w-4 h-4 mr-2" />
                      프롬프트 복사
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {generatedImage && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">생성된 인물 이미지 (16:9 비율)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                      <img
                        src={generatedImage || "/placeholder.svg"}
                        alt="생성된 한국 인물 이미지"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                        <Download className="w-4 h-4 mr-2" />
                        이미지 다운로드
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )

      case "video":
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold mb-6">TTS 생성</h2>

            {scriptLines.length === 0 ? (
            <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground mb-4">먼저 대본을 생성해주세요</p>
                  <Button onClick={() => setActiveStep("script")} variant="outline">
                    대본 생성하러 가기
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
            <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
              <CardHeader className="pb-4 border-b border-gray-100">
                    <CardTitle className="text-lg font-semibold text-slate-900">목소리 선택</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { id: "jB1Cifc2UQbq1gR3wnb0", name: "Rachel", note: "기본(Default)" },
                          { id: "8jHHF8rMqMlg8if2mOUe", name: "Voice 2", note: "사용자 선택형" },
                          { id: "uyVNoMrnUku1dZyVEXwD", name: "Voice 3", note: "" },
                          { id: "1W00lGEmNmwmmsDeVy7ag", name: "Voice 4", note: "" },
                          { id: "AW5wrnGtJiVzO0YYR1Oo", name: "Voice 5", note: "" },
                          { id: "ZJCNdZEjWwOkEIxugmW2", name: "Voice 6", note: "" },
                          { id: "U1cYS4EdbaHmfR7YzHd", name: "Voice 7", note: "" },
                          { id: "kIstIVt9vWf3zgie2OhT", name: "Voice 8", note: "" },
                        ].map((voice) => (
                          <div
                            key={voice.id}
                            className={`p-3 border-2 rounded-lg transition-all ${
                              selectedVoiceId === voice.id
                                ? "border-red-500 bg-red-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-center space-x-2 mb-2">
                              <div
                                className={`w-4 h-4 rounded-full border-2 cursor-pointer ${
                                  selectedVoiceId === voice.id ? "border-red-500 bg-red-500" : "border-gray-300"
                                }`}
                                onClick={() => setSelectedVoiceId(voice.id)}
                              >
                                {selectedVoiceId === voice.id && (
                                  <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                                )}
                              </div>
                              <div className="flex-1" onClick={() => setSelectedVoiceId(voice.id)}>
                                <p className="text-sm font-medium">{voice.name}</p>
                                {voice.note && <p className="text-xs text-muted-foreground">{voice.note}</p>}
                              </div>
                            </div>
                          <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePreviewVoice(voice.id)
                              }}
                              disabled={previewingVoiceId === voice.id}
                            >
                              {previewingVoiceId === voice.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  재생 중...
                              </>
                            ) : (
                              <>
                                  <Volume2 className="w-3 h-3 mr-1" />
                                  미리듣기
                              </>
                            )}
                          </Button>
                                </div>
                              ))}
                            </div>
                          </div>

                        <Button
                      onClick={handleGenerateTTSForLines}
                      disabled={isGeneratingTTS || scriptLines.length === 0}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                      size="lg"
                    >
                      {isGeneratingTTS ? (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                          TTS 생성 중... ({ttsGenerationProgress.current}/{ttsGenerationProgress.total})
                            </>
                          ) : (
                              <>
                          <Volume2 className="w-4 h-4 mr-2" />
                          모든 문장에 TTS 생성하기
                              </>
                          )}
                        </Button>

                    {ttsGenerationProgress.total > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-red-600 h-2.5 rounded-full transition-all duration-300"
                          style={{
                            width: `${(ttsGenerationProgress.current / ttsGenerationProgress.total) * 100}%`,
                          }}
                        />
                          </div>
                        )}
                      </CardContent>
                    </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scriptLines.map((line) => {
                    const generatedAudio = generatedAudios.find((audio) => audio.lineId === line.id)
                    return (
                      <Card key={line.id}>
                        <CardHeader>
                          <CardTitle className="text-sm">문장 {line.id}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-xs text-muted-foreground line-clamp-3">{line.text}</p>
                          {generatedAudio ? (
                            <div className="space-y-2">
                              <audio controls className="w-full" src={generatedAudio.audioUrl} />
                        <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  const link = document.createElement("a")
                                  link.href = generatedAudio.audioUrl
                                  link.download = `tts_line_${line.id}.mp3`
                                  link.click()
                                }}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                다운로드
                              </Button>
                            </div>
                          ) : (
                            <div className="w-full h-20 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                              <p className="text-xs text-muted-foreground">TTS 미생성</p>
                  </div>
                )}
              </CardContent>
            </Card>
                    )
                  })}
                  </div>
              </>
            )}
          </div>
        )

      case "render":
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold mb-6">영상 렌더링</h2>
            
            <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
              <CardHeader className="pb-4 border-b border-gray-100">
                <CardTitle className="text-lg font-semibold text-slate-900">영상 미리보기</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div
                  ref={previewContainerRef}
                  className="aspect-video bg-muted rounded-lg relative overflow-hidden mb-4"
                  style={{ height: "500px" }}
                  onMouseMove={(e) => {
                    // 드래그 중일 때는 위치만 변경 (크기는 절대 변경하지 않음)
                    if (isDraggingLogo && previewContainerRef.current && isLogoSelected) {
                      // 리사이즈 중이 아닐 때만 위치 변경
                      if (!isResizingLogo) {
                        const rect = previewContainerRef.current.getBoundingClientRect()
                        // 로고의 중심점 기준으로 위치 계산
                        const logoCenterX = e.clientX - rect.left - logoDragStart.startX
                        const logoCenterY = e.clientY - rect.top - logoDragStart.startY
                        
                        // 로고 크기를 고려하여 경계 내에 유지
                        const logoHalfWidth = (logoSize / 2) / rect.width * 100
                        const logoHalfHeight = (logoSize / 2) / rect.height * 100
                        
                        const x = (logoCenterX / rect.width) * 100
                        const y = (logoCenterY / rect.height) * 100
                        
                        // 로고가 컨테이너 밖으로 나가지 않도록 제한 (크기는 유지)
                        setLogoPositionX(Math.max(logoHalfWidth, Math.min(100 - logoHalfWidth, x)))
                        setLogoPositionY(Math.max(logoHalfHeight, Math.min(100 - logoHalfHeight, y)))
                      }
                    }
                    // 리사이즈 중일 때만 크기 변경 (드래그와 완전히 분리)
                    else if (isResizingLogo && previewContainerRef.current) {
                      const rect = previewContainerRef.current.getBoundingClientRect()
                      const deltaX = e.clientX - logoResizeStart.startX
                      const deltaY = e.clientY - logoResizeStart.startY
                      
                      let newSize = logoResizeStart.startSize
                      let newX = logoResizeStart.startPositionX
                      let newY = logoResizeStart.startPositionY
                      
                      // 방향에 따라 크기 조절
                      if (resizeDirection.includes("e")) { // 동쪽 (우측)
                        newSize = logoResizeStart.startSize + deltaX * 0.5
                      } else if (resizeDirection.includes("w")) { // 서쪽 (좌측)
                        newSize = logoResizeStart.startSize - deltaX * 0.5
                        const rectWidth = rect.width
                        newX = logoResizeStart.startPositionX - (deltaX / rectWidth) * 100
                      }
                      
                      if (resizeDirection.includes("s")) { // 남쪽 (하단)
                        newSize = logoResizeStart.startSize + deltaY * 0.5
                      } else if (resizeDirection.includes("n")) { // 북쪽 (상단)
                        newSize = logoResizeStart.startSize - deltaY * 0.5
                        const rectHeight = rect.height
                        newY = logoResizeStart.startPositionY - (deltaY / rectHeight) * 100
                      }
                      
                      newSize = Math.max(50, Math.min(300, newSize))
                      setLogoSize(newSize)
                      
                      if (resizeDirection.includes("w")) {
                        setLogoPositionX(Math.max(0, Math.min(100, newX)))
                      }
                      if (resizeDirection.includes("n")) {
                        setLogoPositionY(Math.max(0, Math.min(100, newY)))
                      }
                    }
                  }}
                  onMouseUp={() => {
                    setIsDraggingLogo(false)
                    setIsResizingLogo(false)
                    setResizeDirection("")
                  }}
                  onMouseLeave={() => {
                    setIsDraggingLogo(false)
                    setIsResizingLogo(false)
                    setResizeDirection("")
                  }}
                  onClick={(e) => {
                    // 로고가 아닌 영역 클릭 시 선택 해제
                    if (e.target === previewContainerRef.current || (e.target as HTMLElement).closest('.logo-container') === null) {
                      setIsLogoSelected(false)
                    }
                  }}
                >
                  {videoData ? (
                    <>
                      {/* 앞부분 10초 동영상 또는 현재 시간에 맞는 이미지 표시 */}
                      {(() => {
                        // 앞부분 10초는 동영상 표시
                        if (introVideo && currentTime < 10) {
                          return (
                            <div className="absolute inset-0 w-full h-full bg-black">
                              <video
                                ref={(video) => {
                                  if (video && introVideoRef.current !== video) {
                                    introVideoRef.current = video
                                  }
                                }}
                                src={introVideo}
                                className="w-full h-full object-cover"
                                style={{ objectFit: "cover" }}
                                muted
                                playsInline
                              />
                              {/* 로고 표시 (클릭 선택 후 드래그 및 리사이즈 가능) */}
                              {logoImage && (
                                <div
                                  className={`logo-container absolute z-10 ${isLogoSelected ? "ring-2 ring-blue-500" : ""}`}
                                  style={{
                                    left: `${logoPositionX}%`,
                                    top: `${logoPositionY}%`,
                                    transform: "translate(-50%, -50%)", // 중앙 정렬
                                    cursor: isLogoSelected ? "move" : "pointer",
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setIsLogoSelected(true)
                                  }}
                                  onMouseDown={(e) => {
                                    // 리사이즈 핸들이 아닐 때만 드래그 시작
                                    const target = e.target as HTMLElement
                                    const isResizeHandle = target.classList.contains("resize-handle") || 
                                                          target.closest(".resize-handle") !== null
                                    
                                    if (!isResizeHandle && isLogoSelected) {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      if (previewContainerRef.current) {
                                        const rect = previewContainerRef.current.getBoundingClientRect()
                                        // 마우스 클릭 위치와 로고 중심점의 오프셋 계산
                                        const logoCenterX = (rect.width * logoPositionX) / 100
                                        const logoCenterY = (rect.height * logoPositionY) / 100
                                        const mouseX = e.clientX - rect.left
                                        const mouseY = e.clientY - rect.top
                                        
                                        setLogoDragStart({
                                          x: logoPositionX,
                                          y: logoPositionY,
                                          startX: mouseX - logoCenterX,
                                          startY: mouseY - logoCenterY,
                                        })
                                        // 드래그 시작 시 리사이즈 상태 완전히 해제
                                        setIsResizingLogo(false)
                                        setResizeDirection("")
                                        setIsDraggingLogo(true)
                                      }
                                    }
                                  }}
                                >
                                  <img
                                    src={logoImage}
                                    alt="로고"
                                    className="object-contain pointer-events-none select-none"
                                    style={{
                                      width: `${logoSize}px`,
                                      height: `${logoSize}px`,
                                    }}
                                    draggable={false}
                                  />
                                  {/* 리사이즈 핸들들 (8방향) - 선택된 경우에만 표시 */}
                                  {isLogoSelected && (
                                    <>
                                      {/* 상단 중앙 */}
                                      <div
                                        className="resize-handle absolute top-0 left-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize"
                                        style={{ transform: "translate(-50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          // 리사이즈 시작 시 드래그 상태 완전히 해제
                                          setIsDraggingLogo(false)
                                          setResizeDirection("n")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 하단 중앙 */}
                                      <div
                                        className="resize-handle absolute bottom-0 left-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize"
                                        style={{ transform: "translate(-50%, 50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("s")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 좌측 중앙 */}
                                      <div
                                        className="resize-handle absolute left-0 top-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize"
                                        style={{ transform: "translate(-50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("w")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 우측 중앙 */}
                                      <div
                                        className="resize-handle absolute right-0 top-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize"
                                        style={{ transform: "translate(50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("e")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 좌측 상단 (북서) */}
                                      <div
                                        className="resize-handle absolute top-0 left-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize"
                                        style={{ transform: "translate(-50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("nw")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 우측 상단 (북동) */}
                                      <div
                                        className="resize-handle absolute top-0 right-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize"
                                        style={{ transform: "translate(50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("ne")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 좌측 하단 (남서) */}
                                      <div
                                        className="resize-handle absolute bottom-0 left-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize"
                                        style={{ transform: "translate(-50%, 50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("sw")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 우측 하단 (남동) */}
                                      <div
                                        className="resize-handle absolute bottom-0 right-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize"
                                        style={{ transform: "translate(50%, 50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("se")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        }

                        // 앞부분 동영상 시간 조정
                        const adjustedTime = introVideo ? currentTime - 10 : currentTime
                        
                        const currentImage = autoImages.find(
                          (img) => adjustedTime >= img.startTime && adjustedTime <= img.endTime
                        )
                        
                        // lineId 추출 (image_1 -> 1)
                        const lineId = currentImage ? Number.parseInt(currentImage.id.split("_").pop() || "0") : null
                        const hasVideo = lineId !== null && convertedVideos.has(lineId)
                        
                        const imageUrl = currentImage
                          ? currentImage.url
                          : generatedImages.length > 0
                            ? generatedImages[0].imageUrl
                            : null

                        if (!imageUrl && !hasVideo) {
                          return (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <p className="text-muted-foreground">이미지 없음</p>
                            </div>
                          )
                        }
                        
                        // 비디오가 있으면 비디오 재생
                        if (hasVideo && lineId !== null) {
                          const videoUrl = convertedVideos.get(lineId)!
                          const imageStartTime = currentImage!.startTime
                          const timeInImage = adjustedTime - imageStartTime
                          
                          return (
                            <div className="absolute inset-0 w-full h-full bg-black">
                              <video
                                src={videoUrl}
                        className="w-full h-full object-cover"
                                style={{ objectFit: "cover" }}
                                autoPlay
                                loop
                                muted
                                playsInline
                                ref={(videoElement) => {
                                  if (videoElement) {
                                    const videoDuration = videoElement.duration || 6
                                    // 비디오가 문장 시간보다 짧으면 반복 재생
                                    const videoTime = timeInImage % videoDuration
                                    videoElement.currentTime = videoTime
                                  }
                                }}
                              />
                              {/* 로고 표시 */}
                              {logoImage && (
                                <div
                                  className={`logo-container absolute z-10 ${isLogoSelected ? "ring-2 ring-blue-500" : ""}`}
                                  style={{
                                    left: `${logoPositionX}%`,
                                    top: `${logoPositionY}%`,
                                    transform: "translate(-50%, -50%)",
                                    cursor: isLogoSelected ? "move" : "pointer",
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setIsLogoSelected(true)
                                  }}
                                  onMouseDown={(e) => {
                                    const target = e.target as HTMLElement
                                    const isResizeHandle = target.classList.contains("resize-handle") || 
                                                          target.closest(".resize-handle") !== null
                                    
                                    if (!isResizeHandle && isLogoSelected) {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      if (previewContainerRef.current) {
                                        const rect = previewContainerRef.current.getBoundingClientRect()
                                        const logoCenterX = (rect.width * logoPositionX) / 100
                                        const logoCenterY = (rect.height * logoPositionY) / 100
                                        const mouseX = e.clientX - rect.left
                                        const mouseY = e.clientY - rect.top
                                        
                                        setLogoDragStart({
                                          x: logoPositionX,
                                          y: logoPositionY,
                                          startX: mouseX - logoCenterX,
                                          startY: mouseY - logoCenterY,
                                        })
                                        setIsResizingLogo(false)
                                        setResizeDirection("")
                                        setIsDraggingLogo(true)
                                      }
                                    }
                                  }}
                                >
                                  <img
                                    src={logoImage}
                                    alt="로고"
                                    className="object-contain pointer-events-none select-none"
                                    style={{
                                      width: `${logoSize}px`,
                                      height: `${logoSize}px`,
                                    }}
                                    draggable={false}
                                  />
                                  {isLogoSelected && (
                                    <>
                                      {/* 리사이즈 핸들들 (8방향) - 이전과 동일 */}
                                      <div className="resize-handle absolute top-0 left-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize" style={{ transform: "translate(-50%, -50%)" }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingLogo(false); setResizeDirection("n"); setLogoResizeStart({ size: logoSize, startX: e.clientX, startY: e.clientY, startSize: logoSize, startPositionX: logoPositionX, startPositionY: logoPositionY }); setIsResizingLogo(true); }} />
                                      <div className="resize-handle absolute bottom-0 left-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize" style={{ transform: "translate(-50%, 50%)" }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingLogo(false); setResizeDirection("s"); setLogoResizeStart({ size: logoSize, startX: e.clientX, startY: e.clientY, startSize: logoSize, startPositionX: logoPositionX, startPositionY: logoPositionY }); setIsResizingLogo(true); }} />
                                      <div className="resize-handle absolute left-0 top-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize" style={{ transform: "translate(-50%, -50%)" }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingLogo(false); setResizeDirection("w"); setLogoResizeStart({ size: logoSize, startX: e.clientX, startY: e.clientY, startSize: logoSize, startPositionX: logoPositionX, startPositionY: logoPositionY }); setIsResizingLogo(true); }} />
                                      <div className="resize-handle absolute right-0 top-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize" style={{ transform: "translate(50%, -50%)" }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingLogo(false); setResizeDirection("e"); setLogoResizeStart({ size: logoSize, startX: e.clientX, startY: e.clientY, startSize: logoSize, startPositionX: logoPositionX, startPositionY: logoPositionY }); setIsResizingLogo(true); }} />
                                      <div className="resize-handle absolute top-0 left-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize" style={{ transform: "translate(-50%, -50%)" }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingLogo(false); setResizeDirection("nw"); setLogoResizeStart({ size: logoSize, startX: e.clientX, startY: e.clientY, startSize: logoSize, startPositionX: logoPositionX, startPositionY: logoPositionY }); setIsResizingLogo(true); }} />
                                      <div className="resize-handle absolute top-0 right-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize" style={{ transform: "translate(50%, -50%)" }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingLogo(false); setResizeDirection("ne"); setLogoResizeStart({ size: logoSize, startX: e.clientX, startY: e.clientY, startSize: logoSize, startPositionX: logoPositionX, startPositionY: logoPositionY }); setIsResizingLogo(true); }} />
                                      <div className="resize-handle absolute bottom-0 left-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize" style={{ transform: "translate(-50%, 50%)" }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingLogo(false); setResizeDirection("sw"); setLogoResizeStart({ size: logoSize, startX: e.clientX, startY: e.clientY, startSize: logoSize, startPositionX: logoPositionX, startPositionY: logoPositionY }); setIsResizingLogo(true); }} />
                                      <div className="resize-handle absolute bottom-0 right-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize" style={{ transform: "translate(50%, 50%)" }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingLogo(false); setResizeDirection("se"); setLogoResizeStart({ size: logoSize, startX: e.clientX, startY: e.clientY, startSize: logoSize, startPositionX: logoPositionX, startPositionY: logoPositionY }); setIsResizingLogo(true); }} />
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        }

                        const currentImg = currentImage || autoImages[0]
                        const progress = currentImg
                          ? (adjustedTime - currentImg.startTime) / (currentImg.endTime - currentImg.startTime)
                          : 0
                        let transform = "scale(1)"
                          const transformOrigin = "center center"

                        // Easing 함수 (매우 부드러운 전환) - 한 번만 정의
                        const easeOutCubic = (t: number): number => {
                          return 1 - Math.pow(1 - t, 3)
                        }
                        
                        const easeInOutQuad = (t: number): number => {
                          return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
                        }
                        
                        // 줌인용 부드러운 easing - smoothstep (가장 자연스러운 곡선)
                        const easeInOutSmooth = (t: number): number => {
                          // smoothstep 함수 - 매우 부드럽고 자연스러운 곡선
                          return t * t * (3 - 2 * t)
                        }

                        // 이미지 전환 페이드 시간 (초) - 더 자연스러운 전환을 위해 길게 설정
                        const fadeDuration = 1.2

                        // 현재 이미지 인덱스 찾기
                        const currentImageIndex = autoImages.indexOf(currentImg)
                        
                        // 이전 이미지 찾기 (전환 중일 때) - 더 정확하게 찾기
                        let previousImage: typeof currentImg | null = null
                        if (currentImageIndex > 0) {
                          const prevIndex = currentImageIndex - 1
                          const prevImg = autoImages[prevIndex]
                          
                          // 이전 이미지가 전환 시간 내에 있는지 확인
                          if (prevImg) {
                            const timeSincePrevEnd = adjustedTime - prevImg.endTime
                            if (timeSincePrevEnd <= fadeDuration && adjustedTime >= prevImg.startTime) {
                              previousImage = prevImg
                            }
                          }
                        }
                        const previousImageUrl = previousImage?.url

                        // 이미지 전환 페이드 계산 - 한 번만 정의
                        let fadeProgress = 1 // 1 = 완전히 새 이미지, 0 = 완전히 이전 이미지
                        if (previousImage && previousImage.id !== currentImg.id) {
                          const transitionStartTime = currentImg.startTime
                          const timeSinceTransition = adjustedTime - transitionStartTime
                          fadeProgress = Math.min(Math.max(timeSinceTransition / fadeDuration, 0), 1)
                          // 더 부드러운 전환을 위한 easing (smoothstep 사용)
                          fadeProgress = fadeProgress * fadeProgress * (3 - 2 * fadeProgress)
                        }

                        // 줌인 효과 적용 (랜덤 좌→우 또는 우→좌) - 이미지 크기는 그대로 유지하고 일부 영역을 크롭해서 확대
                        if (enableZoom && currentImg && adjustedTime >= 0) {
                          // 각 이미지마다 고정된 랜덤 방향 생성 (이미지 ID 기반)
                          const imageHash = currentImg.id.split("_").pop() || "0"
                          const zoomDirection = Number.parseInt(imageHash) % 2 === 0 ? "left-to-right" : "right-to-left"
                          
                          // 이미지가 표시되는 전체 시간 동안 서서히 확대
                          const imageStartTime = currentImg.startTime
                          const imageEndTime = currentImg.endTime
                          const imageDuration = imageEndTime - imageStartTime
                          const timeInImage = adjustedTime - imageStartTime
                          let zoomProgress = Math.min(Math.max(timeInImage / imageDuration, 0), 1) // 0~1 사이
                          
                          // Easing 적용 (부드러운 줌인) - Framer Motion이 spring으로 처리하므로 단일 적용
                          zoomProgress = easeInOutSmooth(zoomProgress)
                          
                          // 서서히 확대 (1.0배에서 1.15배까지 - 더 부드럽게)
                          const baseScale = 1.0
                          const maxScale = 1.15
                          const zoomScale = baseScale + (maxScale - baseScale) * zoomProgress
                          
                          // 크롭할 영역 계산 (이미지 중앙에서 시작해서 점점 작은 영역 선택)
                          // CSS로는 직접 크롭이 어려우므로, 이미지를 배경으로 사용하고 background-size와 background-position으로 구현
                          const cropPercent = 100 / zoomScale // 크롭 비율 (100%에서 점점 작아짐)
                          
                          // 줌인 방향에 따라 배경 위치 이동
                          let backgroundPositionX = "50%"
                          if (zoomDirection === "left-to-right") {
                            // 좌→우: 왼쪽에서 시작해서 오른쪽으로 이동
                            const minPos = 0
                            const maxPos = 100 - cropPercent
                            backgroundPositionX = `${minPos + (maxPos - minPos) * zoomProgress}%`
                          } else {
                            // 우→좌: 오른쪽에서 시작해서 왼쪽으로 이동
                            const minPos = 100 - cropPercent
                            const maxPos = 0
                            backgroundPositionX = `${minPos + (maxPos - minPos) * zoomProgress}%`
                          }
                          
                          // 배경 이미지로 크롭 효과 구현 - Framer Motion 사용
                          return (
                            <div className="absolute inset-0 w-full h-full bg-black">
                              {/* 이전 이미지 (전환 중일 때) */}
                              {previousImageUrl && previousImage && previousImage.id !== currentImg.id && fadeProgress < 1 && (
                                <motion.div
                                  className="absolute inset-0 w-full h-full"
                                  style={{
                                    backgroundImage: `url(${previousImageUrl})`,
                                    backgroundSize: `${100 * maxScale}% auto`,
                                    backgroundPosition: zoomDirection === "left-to-right" ? `${100 - cropPercent}% 50%` : `${cropPercent}% 50%`,
                                    backgroundRepeat: "no-repeat",
                                  }}
                                  animate={{
                                    opacity: 1 - fadeProgress,
                                  }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 20,
                                    damping: 30,
                                    mass: 1.0,
                                  }}
                                />
                              )}
                              {/* 현재 이미지 - Framer Motion으로 부드러운 줌인 */}
                              <motion.div
                                className="absolute inset-0 w-full h-full"
                                style={{
                                  backgroundImage: `url(${imageUrl})`,
                                  backgroundRepeat: "no-repeat",
                                }}
                                animate={{
                                  backgroundSize: `${100 * zoomScale}% auto`,
                                  backgroundPosition: `${backgroundPositionX} 50%`,
                                  opacity: fadeProgress,
                                }}
                                transition={{
                                  type: "spring",
                                  stiffness: 20,
                                  damping: 30,
                                  mass: 1.0,
                                }}
                              />
                              {/* 로고 표시 (클릭 선택 후 드래그 및 리사이즈 가능) */}
                              {logoImage && (
                                <div
                                  className={`logo-container absolute z-10 ${isLogoSelected ? "ring-2 ring-blue-500" : ""}`}
                                  style={{
                                    left: `${logoPositionX}%`,
                                    top: `${logoPositionY}%`,
                                    transform: "translate(-50%, -50%)", // 중앙 정렬
                                    cursor: isLogoSelected ? "move" : "pointer",
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setIsLogoSelected(true)
                                  }}
                                  onMouseDown={(e) => {
                                    // 리사이즈 핸들이 아닐 때만 드래그 시작
                                    const target = e.target as HTMLElement
                                    const isResizeHandle = target.classList.contains("resize-handle") || 
                                                          target.closest(".resize-handle") !== null
                                    
                                    if (!isResizeHandle && isLogoSelected) {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      if (previewContainerRef.current) {
                                        const rect = previewContainerRef.current.getBoundingClientRect()
                                        // 마우스 클릭 위치와 로고 중심점의 오프셋 계산
                                        const logoCenterX = (rect.width * logoPositionX) / 100
                                        const logoCenterY = (rect.height * logoPositionY) / 100
                                        const mouseX = e.clientX - rect.left
                                        const mouseY = e.clientY - rect.top
                                        
                                        setLogoDragStart({
                                          x: logoPositionX,
                                          y: logoPositionY,
                                          startX: mouseX - logoCenterX,
                                          startY: mouseY - logoCenterY,
                                        })
                                        // 드래그 시작 시 리사이즈 상태 완전히 해제
                                        setIsResizingLogo(false)
                                        setResizeDirection("")
                                        setIsDraggingLogo(true)
                                      }
                                    }
                                  }}
                                >
                                  <img
                                    src={logoImage}
                                    alt="로고"
                                    className="object-contain pointer-events-none select-none"
                                    style={{
                                      width: `${logoSize}px`,
                                      height: `${logoSize}px`,
                                    }}
                                    draggable={false}
                                  />
                                  {/* 리사이즈 핸들들 (8방향) - 선택된 경우에만 표시 */}
                                  {isLogoSelected && (
                                    <>
                                      {/* 상단 중앙 */}
                                      <div
                                        className="resize-handle absolute top-0 left-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize"
                                        style={{ transform: "translate(-50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          // 리사이즈 시작 시 드래그 상태 완전히 해제
                                          setIsDraggingLogo(false)
                                          setResizeDirection("n")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 하단 중앙 */}
                                      <div
                                        className="resize-handle absolute bottom-0 left-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize"
                                        style={{ transform: "translate(-50%, 50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("s")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 좌측 중앙 */}
                                      <div
                                        className="resize-handle absolute left-0 top-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize"
                                        style={{ transform: "translate(-50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("w")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 우측 중앙 */}
                                      <div
                                        className="resize-handle absolute right-0 top-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize"
                                        style={{ transform: "translate(50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("e")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 좌측 상단 (북서) */}
                                      <div
                                        className="resize-handle absolute top-0 left-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize"
                                        style={{ transform: "translate(-50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("nw")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 우측 상단 (북동) */}
                                      <div
                                        className="resize-handle absolute top-0 right-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize"
                                        style={{ transform: "translate(50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("ne")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 좌측 하단 (남서) */}
                                      <div
                                        className="resize-handle absolute bottom-0 left-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize"
                                        style={{ transform: "translate(-50%, 50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("sw")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 우측 하단 (남동) */}
                                      <div
                                        className="resize-handle absolute bottom-0 right-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize"
                                        style={{ transform: "translate(50%, 50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("se")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        } else if (currentImg && currentImg.motion) {
                          // 기존 motion 효과 (줌인 효과가 비활성화된 경우)
                          switch (currentImg.motion) {
                            case "zoom-in":
                              const zoomInScale = 1 + progress * 0.3
                              transform = `scale(${zoomInScale})`
                              break
                            case "zoom-out":
                              const zoomOutScale = 1.3 - progress * 0.3
                              transform = `scale(${zoomOutScale})`
                              break
                            case "pan-left":
                              const panLeftX = -progress * 10
                              transform = `translateX(${panLeftX}%) scale(1.2)`
                              break
                            case "pan-right":
                              const panRightX = progress * 10
                              transform = `translateX(${panRightX}%) scale(1.2)`
                              break
                            default:
                              transform = "scale(1)"
                          }
                          }

                          return (
                          <div className="absolute inset-0 w-full h-full bg-black">
                            {/* 이전 이미지 (전환 중일 때) */}
                            {previousImageUrl && previousImage && previousImage.id !== currentImg.id && fadeProgress < 1 && (
                            <div
                                className="absolute inset-0 w-full h-full"
                              style={{
                                transform,
                                transformOrigin,
                                  opacity: 1 - fadeProgress,
                                  transition: "transform 0.1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.1s ease-in-out",
                              }}
                            >
                              <img
                                  src={previousImageUrl}
                                  alt={previousImage?.keyword || "이전 이미지"}
                                className="w-full h-full object-cover"
                              />
                              </div>
                            )}
                            {/* 현재 이미지 */}
                            {imageUrl && (
                            <div
                              className="absolute inset-0 w-full h-full"
                              style={{
                                transform,
                                transformOrigin,
                                opacity: fadeProgress,
                                transition: "transform 0.1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.1s ease-in-out",
                              }}
                            >
                              <img
                                src={imageUrl}
                                alt={currentImg?.keyword || "영상 이미지"}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            )}
                              {/* 로고 표시 (클릭 선택 후 드래그 및 리사이즈 가능) */}
                              {logoImage && (
                                <div
                                  className={`logo-container absolute z-10 ${isLogoSelected ? "ring-2 ring-blue-500" : ""}`}
                                  style={{
                                    left: `${logoPositionX}%`,
                                    top: `${logoPositionY}%`,
                                    transform: "translate(-50%, -50%)", // 중앙 정렬
                                    cursor: isLogoSelected ? "move" : "pointer",
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setIsLogoSelected(true)
                                  }}
                                  onMouseDown={(e) => {
                                    // 리사이즈 핸들이 아닐 때만 드래그 시작
                                    const target = e.target as HTMLElement
                                    const isResizeHandle = target.classList.contains("resize-handle") || 
                                                          target.closest(".resize-handle") !== null
                                    
                                    if (!isResizeHandle && isLogoSelected) {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      if (previewContainerRef.current) {
                                        const rect = previewContainerRef.current.getBoundingClientRect()
                                        // 마우스 클릭 위치와 로고 중심점의 오프셋 계산
                                        const logoCenterX = (rect.width * logoPositionX) / 100
                                        const logoCenterY = (rect.height * logoPositionY) / 100
                                        const mouseX = e.clientX - rect.left
                                        const mouseY = e.clientY - rect.top
                                        
                                        setLogoDragStart({
                                          x: logoPositionX,
                                          y: logoPositionY,
                                          startX: mouseX - logoCenterX,
                                          startY: mouseY - logoCenterY,
                                        })
                                        // 드래그 시작 시 리사이즈 상태 완전히 해제
                                        setIsResizingLogo(false)
                                        setResizeDirection("")
                                        setIsDraggingLogo(true)
                                      }
                                    }
                                  }}
                                >
                                  <img
                                    src={logoImage}
                                    alt="로고"
                                    className="object-contain pointer-events-none select-none"
                                    style={{
                                      width: `${logoSize}px`,
                                      height: `${logoSize}px`,
                                    }}
                                    draggable={false}
                                  />
                                  {/* 리사이즈 핸들들 (8방향) - 선택된 경우에만 표시 */}
                                  {isLogoSelected && (
                                    <>
                                      {/* 상단 중앙 */}
                                      <div
                                        className="resize-handle absolute top-0 left-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize"
                                        style={{ transform: "translate(-50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          // 리사이즈 시작 시 드래그 상태 완전히 해제
                                          setIsDraggingLogo(false)
                                          setResizeDirection("n")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 하단 중앙 */}
                                      <div
                                        className="resize-handle absolute bottom-0 left-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize"
                                        style={{ transform: "translate(-50%, 50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("s")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 좌측 중앙 */}
                                      <div
                                        className="resize-handle absolute left-0 top-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize"
                                        style={{ transform: "translate(-50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("w")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 우측 중앙 */}
                                      <div
                                        className="resize-handle absolute right-0 top-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize"
                                        style={{ transform: "translate(50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("e")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 좌측 상단 (북서) */}
                                      <div
                                        className="resize-handle absolute top-0 left-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize"
                                        style={{ transform: "translate(-50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("nw")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 우측 상단 (북동) */}
                                      <div
                                        className="resize-handle absolute top-0 right-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize"
                                        style={{ transform: "translate(50%, -50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("ne")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 좌측 하단 (남서) */}
                                      <div
                                        className="resize-handle absolute bottom-0 left-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize"
                                        style={{ transform: "translate(-50%, 50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("sw")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                      {/* 우측 하단 (남동) */}
                                      <div
                                        className="resize-handle absolute bottom-0 right-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize"
                                        style={{ transform: "translate(50%, 50%)" }}
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setResizeDirection("se")
                                          setLogoResizeStart({
                                            size: logoSize,
                                            startX: e.clientX,
                                            startY: e.clientY,
                                            startSize: logoSize,
                                            startPositionX: logoPositionX,
                                            startPositionY: logoPositionY,
                                          })
                                          setIsResizingLogo(true)
                                        }}
                                      />
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                      })()}

                      {/* 자막 오버레이 */}
                      {currentSubtitle && (
                        <div className="absolute bottom-8 left-8 right-8 bg-black/70 text-white p-6 rounded-xl text-center shadow-2xl border border-white/20 z-10">
                          <p className="text-4xl font-bold">{currentSubtitle}</p>
                        </div>
                      )}
                      
                      {/* 효과음 및 배경음악 (숨김) */}
                      {audioTracks.map((track) => (
                        <audio
                          key={track.id}
                          ref={(audioElement) => {
                            if (audioElement && audioTrackElements.get(track.id) !== audioElement) {
                              setAudioTrackElements((prev) => {
                                const newMap = new Map(prev)
                                newMap.set(track.id, audioElement)
                                return newMap
                              })
                            }
                          }}
                          src={track.url}
                          loop={track.type === "background_music"}
                          className="hidden"
                        />
                      ))}
                    </>
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <p className="text-muted-foreground">영상 미리보기를 생성해주세요</p>
                    </div>
                  )}
                </div>

                {videoData && (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-4 mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const audioElement = audioRef
                          if (audioElement) {
                            if (audioElement.paused) {
                              audioElement.play()
                            } else {
                              audioElement.pause()
                            }
                          }
                        }}
                      >
                        {!audioRef || audioRef.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      </Button>

                      <div className="flex items-center gap-4 flex-1">
                        <Volume2 className="h-4 w-4 text-muted-foreground" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          defaultValue="100"
                          className="flex-1 h-2"
                          onChange={(e) => {
                            if (audioRef) {
                              audioRef.volume = Number.parseInt(e.target.value) / 100
                            }
                          }}
                        />
                      </div>

                      <div className="text-sm text-muted-foreground">
                        {Math.floor(currentTime / 60)}분 {Math.floor(currentTime % 60)}초 / {Math.floor(videoData.duration / 60)}분 {Math.floor(videoData.duration % 60)}초
                      </div>
                    </div>

                    {/* 숨겨진 오디오 엘리먼트 */}
                    <audio
                      ref={(audio) => {
                        if (audio) {
                          setAudioRef(audio)
                        }
                      }}
                      src={videoData.audioUrl}
                      className="hidden"
                      onTimeUpdate={(e) => {
                        const audioElement = e.target as HTMLAudioElement
                        const audioCurrentTime = audioElement.currentTime
                        // 앞부분 동영상이 있으면 10초를 더한 시간 사용
                        const totalCurrentTime = introVideo ? audioCurrentTime + 10 : audioCurrentTime
                        
                        // 앞부분 동영상 currentTime 업데이트
                        if (introVideoRef.current && totalCurrentTime < 10) {
                          introVideoRef.current.currentTime = totalCurrentTime
                          if (introVideoRef.current.paused && !audioElement.paused) {
                            introVideoRef.current.play()
                          } else if (!introVideoRef.current.paused && audioElement.paused) {
                            introVideoRef.current.pause()
                          }
                        }
                        
                        // 효과음 및 배경음악 재생 시간 동기화
                        for (const track of audioTracks) {
                          const trackElement = audioTrackElements.get(track.id)
                          if (trackElement) {
                            const adjustedStartTime = track.startTime + (introVideo ? 10 : 0)
                            if (totalCurrentTime >= adjustedStartTime && totalCurrentTime < track.endTime + (introVideo ? 10 : 0)) {
                              const trackTime = totalCurrentTime - adjustedStartTime
                              const trackDuration = trackElement.duration || 0
                              if (trackDuration > 0) {
                                // 반복 재생 (배경음악의 경우)
                                if (track.type === "background_music") {
                                  trackElement.currentTime = trackTime % trackDuration
                                } else {
                                  trackElement.currentTime = Math.min(trackTime, trackDuration)
                                }
                                if (trackElement.paused && !audioElement.paused) {
                                  trackElement.play()
                                }
                                trackElement.volume = track.volume
                              }
                            } else {
                              if (!trackElement.paused) {
                                trackElement.pause()
                              }
                            }
                          }
                        }
                        
                        // 오디오 시간을 그대로 사용 (이미 합쳐진 오디오이므로)
                        // 자막이 1초 늦게 나오는 문제 해결: 자막 시작 시간을 1초 앞당겨서 비교
                        const subtitle = videoData.subtitles.find((s) => {
                          // 자막 시작 시간을 1초 앞당겨서 비교 (실제 타이밍과 맞추기)
                          const adjustedStart = Math.max(0, s.start - 1.0)
                          return audioCurrentTime >= adjustedStart && audioCurrentTime < s.end
                        })
                        setCurrentSubtitle(subtitle?.text || "")
                        setCurrentTime(totalCurrentTime)
                        setIsPlaying(!audioElement.paused)
                      }}
                      onPlay={() => {
                        setIsPlaying(true)
                        // 효과음 및 배경음악 재생
                        for (const track of audioTracks) {
                          const trackElement = audioTrackElements.get(track.id)
                          if (trackElement) {
                            const adjustedStartTime = track.startTime + (introVideo ? 10 : 0)
                            const currentTime = introVideo ? audioRef?.currentTime || 0 + 10 : audioRef?.currentTime || 0
                            if (currentTime >= adjustedStartTime && currentTime < track.endTime + (introVideo ? 10 : 0)) {
                              trackElement.play()
                            }
                          }
                        }
                      }}
                      onPause={() => {
                        setIsPlaying(false)
                        // 효과음 및 배경음악 일시정지
                        for (const track of audioTracks) {
                          const trackElement = audioTrackElements.get(track.id)
                          if (trackElement) {
                            trackElement.pause()
                          }
                        }
                      }}
                    />

                    {/* 메인 타임라인 바 - 클릭 가능 */}
                    <div
                      className="relative h-12 bg-muted rounded-lg overflow-hidden cursor-pointer border border-border"
                      onClick={(e) => {
                        const audioElement = audioRef
                        if (!audioElement) return

                        const rect = e.currentTarget.getBoundingClientRect()
                        const x = e.clientX - rect.left
                        const percentage = x / rect.width
                        const newTime = percentage * videoData.duration
                        audioElement.currentTime = newTime
                        setCurrentTime(newTime)
                      }}
                    >
                      {/* 자막 트랙 */}
                      <div className="absolute top-0 left-0 right-0 h-6 bg-blue-500/20">
                        {videoData.subtitles.map((subtitle) => (
                          <div
                            key={subtitle.id}
                            className="absolute h-full bg-blue-500/60 border-l border-r border-blue-600 hover:bg-blue-500/80 transition-colors"
                            style={{
                              left: `${(subtitle.start / videoData.duration) * 100}%`,
                              width: `${((subtitle.end - subtitle.start) / videoData.duration) * 100}%`,
                            }}
                            title={`${subtitle.text} (${Math.floor(subtitle.start / 60)}분 ${Math.floor(subtitle.start % 60)}초 - ${Math.floor(subtitle.end / 60)}분 ${Math.floor(subtitle.end % 60)}초)`}
                          />
                        ))}
                      </div>

                      {/* 이미지 트랙 */}
                      <div className="absolute bottom-0 left-0 right-0 h-6 bg-green-500/20">
                        {autoImages.map((img) => (
                          <div
                            key={img.id}
                            className="absolute h-full bg-green-500/60 border-l border-r border-green-600 hover:bg-green-500/80 transition-colors flex items-center justify-center"
                            style={{
                              left: `${(img.startTime / videoData.duration) * 100}%`,
                              width: `${((img.endTime - img.startTime) / videoData.duration) * 100}%`,
                            }}
                            title={`${img.keyword} (${Math.floor(img.startTime / 60)}분 ${Math.floor(img.startTime % 60)}초 - ${Math.floor(img.endTime / 60)}분 ${Math.floor(img.endTime % 60)}초)`}
                          >
                            <ImageIcon className="h-3 w-3 text-white" />
                          </div>
                        ))}
                      </div>

                      {/* 재생 헤드 */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                        style={{ left: `${(currentTime / videoData.duration) * 100}%` }}
                      >
                        <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
                      </div>
                    </div>

                    {/* 범례 */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-500/60 rounded" />
                        <span>자막</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-500/60 rounded" />
                        <span>이미지</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-0.5 h-3 bg-red-500" />
                        <span>재생 위치</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 효과음 및 배경음악 타임라인 에디터 */}
                {videoData && audioTracks.length > 0 && (
                  <Card className="mb-4">
                    <CardHeader>
                      <CardTitle className="text-lg">효과음 및 배경음악 타임라인</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2" id="audio-timeline-container">
                        {audioTracks.map((track) => {
                          const leftPercent = (track.startTime / videoData.duration) * 100
                          const widthPercent = ((track.endTime - track.startTime) / videoData.duration) * 100
                          const trackColor = track.type === "background_music" ? "bg-purple-500" : "bg-orange-500"
                          
                          return (
                            <div key={track.id} className="space-y-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Select
                                  value={track.type}
                                  onValueChange={(value: "sound_effect" | "background_music") => {
                                    setAudioTracks((prev) =>
                                      prev.map((t) => (t.id === track.id ? { ...t, type: value } : t))
                                    )
                                  }}
                                >
                                  <SelectTrigger className="w-32 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="sound_effect">효과음</SelectItem>
                                    <SelectItem value="background_music">배경음악</SelectItem>
                                  </SelectContent>
                                </Select>
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {track.file.name}
                                </span>
                                <div className="flex items-center gap-2 ml-auto">
                                  <div className="flex items-center gap-1">
                                    <label className="text-xs text-muted-foreground">볼륨</label>
                                    <input
                                      type="range"
                                      min="0"
                                      max="1"
                                      step="0.01"
                                      value={track.volume}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value)
                                        setAudioTracks((prev) =>
                                          prev.map((t) => (t.id === track.id ? { ...t, volume: value } : t))
                                        )
                                      }}
                                      className="w-20"
                                    />
                                    <span className="text-xs text-muted-foreground w-10">{Math.round(track.volume * 100)}%</span>
                                  </div>
                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      URL.revokeObjectURL(track.url)
                                      setAudioTracks((prev) => prev.filter((t) => t.id !== track.id))
                                    }}
                                  >
                                    삭제
                                  </Button>
                                </div>
                              </div>
                              
                              {/* 타임라인 바 */}
                              <div className="relative h-12 bg-gray-100 rounded border-2 border-gray-300 cursor-pointer"
                                onMouseDown={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  const clickX = e.clientX - rect.left
                                  const clickPercent = clickX / rect.width
                                  const clickTime = clickPercent * videoData.duration
                                  
                                  // 왼쪽 끝 10% 영역 클릭 시 리사이즈
                                  if (clickPercent < 0.1 && clickTime < track.startTime + 0.5) {
                                    setResizingAudioTrack({ id: track.id, side: "left" })
                                    setAudioTrackResizeStart({
                                      id: track.id,
                                      side: "left",
                                      startX: e.clientX,
                                      startTime: track.startTime,
                                      endTime: track.endTime,
                                    })
                                  }
                                  // 오른쪽 끝 10% 영역 클릭 시 리사이즈
                                  else if (clickPercent > 0.9 && clickTime > track.endTime - 0.5) {
                                    setResizingAudioTrack({ id: track.id, side: "right" })
                                    setAudioTrackResizeStart({
                                      id: track.id,
                                      side: "right",
                                      startX: e.clientX,
                                      startTime: track.startTime,
                                      endTime: track.endTime,
                                    })
                                  }
                                  // 중간 영역 클릭 시 드래그
                                  else {
                                    setDraggingAudioTrack(track.id)
                                    setAudioTrackDragStart({
                                      id: track.id,
                                      startX: e.clientX,
                                      startTime: track.startTime,
                                    })
                                  }
                                }}
                              >
                                {/* 오디오 트랙 바 */}
                                <div
                                  className={`absolute top-0 bottom-0 ${trackColor} border-2 border-white rounded cursor-move hover:opacity-80 transition-opacity flex items-center justify-center`}
                                  style={{
                                    left: `${leftPercent}%`,
                                    width: `${widthPercent}%`,
                                    minWidth: "2%",
                                  }}
                                  title={`${track.file.name} (${Math.floor(track.startTime)}초 - ${Math.floor(track.endTime)}초)`}
                                >
                                  <span className="text-xs text-white font-medium truncate px-1">
                                    {track.file.name.length > 15 ? track.file.name.substring(0, 15) + "..." : track.file.name}
                                  </span>
                                  
                                  {/* 왼쪽 리사이즈 핸들 */}
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-2 bg-white/50 hover:bg-white cursor-ew-resize"
                                    style={{ borderLeft: "2px solid white" }}
                                  />
                                  
                                  {/* 오른쪽 리사이즈 핸들 */}
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 hover:bg-white cursor-ew-resize"
                                    style={{ borderRight: "2px solid white" }}
                                  />
                                </div>
                                
                                {/* 재생 헤드 */}
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                                  style={{ left: `${(currentTime / videoData.duration) * 100}%` }}
                                >
                                  <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      
                      {/* 마우스 이벤트 핸들러 (전역) */}
                      <div
                        className="fixed inset-0 z-50"
                        style={{ pointerEvents: draggingAudioTrack || resizingAudioTrack ? "auto" : "none" }}
                        onMouseMove={(e) => {
                          if (draggingAudioTrack && audioTrackDragStart && videoData) {
                            // 타임라인 컨테이너 찾기
                            const container = document.getElementById('audio-timeline-container')
                            const timelineContainers = container?.querySelectorAll('.relative.h-12.bg-gray-100')
                            if (timelineContainers && timelineContainers.length > 0) {
                              const timelineContainer = timelineContainers[0] as HTMLElement
                              const rect = timelineContainer.getBoundingClientRect()
                              const deltaX = e.clientX - audioTrackDragStart.startX
                              const deltaPercent = (deltaX / rect.width) * 100
                              const deltaTime = (deltaPercent / 100) * videoData.duration
                              const track = audioTracks.find((t) => t.id === draggingAudioTrack)
                              if (track) {
                                const duration = track.endTime - track.startTime
                                const newStartTime = Math.max(0, Math.min(videoData.duration - duration, audioTrackDragStart.startTime + deltaTime))
                                const newEndTime = Math.min(videoData.duration, newStartTime + duration)
                                setAudioTracks((prev) =>
                                  prev.map((t) =>
                                    t.id === draggingAudioTrack
                                      ? { ...t, startTime: newStartTime, endTime: newEndTime }
                                      : t
                                  )
                                )
                              }
                            }
                          }
                          
                          if (resizingAudioTrack && audioTrackResizeStart && videoData) {
                            // 타임라인 컨테이너 찾기
                            const container = document.getElementById('audio-timeline-container')
                            const timelineContainers = container?.querySelectorAll('.relative.h-12.bg-gray-100')
                            if (timelineContainers && timelineContainers.length > 0) {
                              const timelineContainer = timelineContainers[0] as HTMLElement
                              const rect = timelineContainer.getBoundingClientRect()
                              const deltaX = e.clientX - audioTrackResizeStart.startX
                              const deltaPercent = (deltaX / rect.width) * 100
                              const deltaTime = (deltaPercent / 100) * videoData.duration
                              const track = audioTracks.find((t) => t.id === resizingAudioTrack.id)
                              
                              if (track) {
                                if (resizingAudioTrack.side === "left") {
                                  const newStartTime = Math.max(0, Math.min(audioTrackResizeStart.endTime - 0.5, audioTrackResizeStart.startTime + deltaTime))
                                  setAudioTracks((prev) =>
                                    prev.map((t) =>
                                      t.id === resizingAudioTrack.id
                                        ? { ...t, startTime: newStartTime }
                                        : t
                                    )
                                  )
                                } else {
                                  const newEndTime = Math.min(videoData.duration, Math.max(audioTrackResizeStart.startTime + 0.5, audioTrackResizeStart.endTime + deltaTime))
                                  setAudioTracks((prev) =>
                                    prev.map((t) =>
                                      t.id === resizingAudioTrack.id
                                        ? { ...t, endTime: newEndTime }
                                        : t
                                    )
                                  )
                                }
                              }
                            }
                          }
                        }}
                        onMouseUp={() => {
                          setDraggingAudioTrack(null)
                          setResizingAudioTrack(null)
                          setAudioTrackDragStart(null)
                          setAudioTrackResizeStart(null)
                        }}
                        onMouseLeave={() => {
                          setDraggingAudioTrack(null)
                          setResizingAudioTrack(null)
                          setAudioTrackDragStart(null)
                          setAudioTrackResizeStart(null)
                        }}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* 영상 효과 설정 */}
                <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white mb-4">
                  <CardHeader className="pb-4 border-b border-gray-100">
                    <CardTitle className="text-lg font-semibold text-slate-900">영상 효과 설정</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {/* 앞부분 10초 동영상 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">앞부분 10초 동영상 (선택사항)</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="video/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const url = URL.createObjectURL(file)
                              setIntroVideo(url)
                            }
                          }}
                          className="flex-1"
                        />
                        {introVideo && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              URL.revokeObjectURL(introVideo)
                              setIntroVideo(null)
                            }}
                          >
                            제거
                          </Button>
                        )}
                      </div>
                      {introVideo && (
                        <video src={introVideo} controls className="w-full rounded-lg" style={{ maxHeight: "200px" }} />
                      )}
                    </div>

                    {/* 효과음 및 배경음악 */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">효과음 및 배경음악</label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const input = document.createElement("input")
                            input.type = "file"
                            input.accept = "audio/*"
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0]
                              if (file) {
                                const url = URL.createObjectURL(file)
                                const newTrack: AudioTrack = {
                                  id: `audio_${Date.now()}`,
                                  type: "sound_effect",
                                  file,
                                  url,
                                  startTime: 0,
                                  endTime: 10,
                                  volume: 0.5,
                                }
                                setAudioTracks((prev) => [...prev, newTrack])
                              }
                            }
                            input.click()
                          }}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          오디오 추가
                        </Button>
                      </div>
                      
                      {audioTracks.length > 0 && (
                        <div className="space-y-3">
                          {audioTracks.map((track) => (
                            <Card key={track.id} className="p-3">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Select
                                      value={track.type}
                                      onValueChange={(value: "sound_effect" | "background_music") => {
                                        setAudioTracks((prev) =>
                                          prev.map((t) => (t.id === track.id ? { ...t, type: value } : t))
                                        )
                                      }}
                                    >
                                      <SelectTrigger className="w-32">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="sound_effect">효과음</SelectItem>
                                        <SelectItem value="background_music">배경음악</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                      {track.file.name}
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      URL.revokeObjectURL(track.url)
                                      setAudioTracks((prev) => prev.filter((t) => t.id !== track.id))
                                    }}
                                  >
                                    삭제
                                  </Button>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">시작 시간 (초)</label>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      value={track.startTime}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0
                                        setAudioTracks((prev) =>
                                          prev.map((t) =>
                                            t.id === track.id ? { ...t, startTime: value, endTime: Math.max(t.endTime, value + 0.1) } : t
                                          )
                                        )
                                      }}
                                      className="h-8"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">끝 시간 (초)</label>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min={track.startTime + 0.1}
                                      value={track.endTime}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value) || track.startTime + 0.1
                                        setAudioTracks((prev) =>
                                          prev.map((t) => (t.id === track.id ? { ...t, endTime: Math.max(value, t.startTime + 0.1) } : t))
                                        )
                                      }}
                                      className="h-8"
                                    />
                                  </div>
                                </div>
                                
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="text-xs text-muted-foreground">볼륨</label>
                                    <span className="text-xs text-muted-foreground">{Math.round(track.volume * 100)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={track.volume}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value)
                                      setAudioTracks((prev) =>
                                        prev.map((t) => (t.id === track.id ? { ...t, volume: value } : t))
                                      )
                                    }}
                  className="w-full"
                                  />
                                </div>
                                
                                <audio src={track.url} controls className="w-full h-8" />
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 로고 추가 */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">로고 추가 (선택사항)</label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                const reader = new FileReader()
                                reader.onload = (e) => {
                                  setLogoImage(e.target?.result as string)
                                  // 기본 위치: 우측 상단
                                  setLogoPositionX(95)
                                  setLogoPositionY(5)
                                  setIsLogoSelected(true) // 로고 추가 시 자동 선택
                                }
                                reader.readAsDataURL(file)
                              }
                            }}
                            className="flex-1"
                          />
                          {logoImage && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLogoImage(null)
                              }}
                            >
                              제거
                            </Button>
                          )}
                        </div>
                        {logoImage && (
                          <img src={logoImage} alt="로고" className="w-32 h-32 object-contain rounded-lg border" />
                        )}
                      </div>

                      {/* 로고 크기 조절 */}
                      {logoImage && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">로고 크기: {logoSize}px</label>
                          <input
                            type="range"
                            min="50"
                            max="300"
                            value={logoSize}
                            onChange={(e) => setLogoSize(Number.parseInt(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      )}

                      {/* 로고 위치 조절 */}
                      {logoImage && (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">로고 X 위치 (좌→우): {logoPositionX}%</label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={logoPositionX}
                              onChange={(e) => setLogoPositionX(Number.parseInt(e.target.value))}
                              className="w-full"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">로고 Y 위치 (상→하): {logoPositionY}%</label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={logoPositionY}
                              onChange={(e) => setLogoPositionY(Number.parseInt(e.target.value))}
                              className="w-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 줌인 효과 */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="enableZoom"
                        checked={enableZoom}
                        onChange={(e) => setEnableZoom(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="enableZoom" className="text-sm font-medium cursor-pointer">
                        줌인 효과 활성화 (랜덤 좌→우 또는 우→좌)
                      </label>
                    </div>
                  </CardContent>
                </Card>

                {/* 영상 미리보기 생성 버튼 */}
                <Button
                  onClick={handleRenderVideo}
                  disabled={isGeneratingVideo || scriptLines.length === 0 || generatedImages.length === 0 || generatedAudios.length === 0}
                  className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingVideo ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      미리보기 생성 중... ({generatingVideoProgress}%)
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      영상 생성
                    </>
                  )}
                </Button>

                {videoData && !isExporting && (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex gap-2">
                  <Button
                      onClick={handleFastDownload}
                      disabled={isExporting}
                      variant="default"
                    size="lg"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      빠른다운로드
                      <span className="ml-2 text-xs opacity-80">(Cloud Run)</span>
                    </Button>
                    <Button
                      onClick={handleNormalDownload}
                    disabled={isExporting}
                      variant="outline"
                      size="lg"
                      className="flex-1"
                    >
                        <Download className="w-4 h-4 mr-2" />
                      보통다운로드
                      <span className="ml-2 text-xs opacity-80">(MediaRecorder)</span>
                    </Button>
                    </div>
                    <p className="text-sm text-red-600 mt-1">
                      ⚠️ 이미지생성 1시간이 지나면 다운로드 시 오류가 발생합니다. 꼭 이미지 생성 후 한시간 이내 다운로드 부탁드립니다
                    </p>
                  </div>
                )}
                
                {videoData && isExporting && (
                  <Button
                    className="w-full mt-2"
                    size="lg"
                    variant="outline"
                    disabled={true}
                  >
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    렌더링 중...
                  </Button>
                )}

                {videoData && (
                  <Button
                    className="w-full mt-2 bg-transparent"
                    size="lg"
                    variant="outline"
                    onClick={handleSaveThumbnailImage}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    썸네일 저장
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* 스크립트 입력 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">스크립트</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="대본을 입력하거나 이전 단계에서 생성된 대본이 자동으로 표시됩니다..."
                  className="min-h-[200px] font-mono text-sm"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                />
                <div className="text-xs text-muted-foreground mt-2">
                  {script.length} 글자 / 예상 영상 길이: {Math.floor(script.length / 6.9 / 60)}분{" "}
                  {Math.floor((script.length / 6.9) % 60)}초
                </div>
              </CardContent>
            </Card>

            {/* 자막 미리보기 */}
            {videoData?.subtitles && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">자막 미리보기</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {videoData.subtitles.slice(0, 10).map((subtitle) => (
                      <div key={subtitle.id} className="flex gap-3 text-sm">
                        <span className="text-muted-foreground min-w-[60px]">{Math.floor(subtitle.start)}s</span>
                        <span>{subtitle.text}</span>
                      </div>
                    ))}
                    {videoData.subtitles.length > 10 && (
                      <p className="text-sm text-muted-foreground">... 외 {videoData.subtitles.length - 10}개 자막</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )

      case "render":
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold mb-6">영상 렌더링</h2>

            {scriptLines.length === 0 || generatedImages.length === 0 || generatedAudios.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    {scriptLines.length === 0 && "대본을 먼저 생성해주세요"}
                    {scriptLines.length > 0 && generatedImages.length === 0 && "이미지를 먼저 생성해주세요"}
                    {scriptLines.length > 0 && generatedImages.length > 0 && generatedAudios.length === 0 && "TTS를 먼저 생성해주세요"}
                  </p>
                  <div className="flex gap-2 justify-center">
                    {scriptLines.length === 0 && (
                      <Button onClick={() => setActiveStep("script")} variant="outline">
                        대본 생성하러 가기
                      </Button>
                    )}
                    {scriptLines.length > 0 && generatedImages.length === 0 && (
                      <Button onClick={() => setActiveStep("image")} variant="outline">
                        이미지 생성하러 가기
                      </Button>
                    )}
                    {scriptLines.length > 0 && generatedImages.length > 0 && generatedAudios.length === 0 && (
                      <Button onClick={() => setActiveStep("video")} variant="outline">
                        TTS 생성하러 가기
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">영상 렌더링 준비</CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">
                      생성된 이미지, TTS, 자막을 합성하여 최종 영상을 생성합니다.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{generatedImages.length}</p>
                    <p className="text-sm text-muted-foreground">이미지</p>
                    {generatedImages.length === 0 && (
                      <p className="text-xs text-red-600 mt-1">⚠️ 필요</p>
                    )}
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{generatedAudios.length}</p>
                    <p className="text-sm text-muted-foreground">TTS</p>
                    {generatedAudios.length === 0 && (
                      <p className="text-xs text-red-600 mt-1">⚠️ 필요</p>
                    )}
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{scriptLines.length}</p>
                    <p className="text-sm text-muted-foreground">문장</p>
                    {scriptLines.length === 0 && (
                      <p className="text-xs text-red-600 mt-1">⚠️ 필요</p>
                    )}
                  </div>
                </div>

                {/* 디버깅 정보 */}
                <div className="p-3 bg-gray-100 rounded-lg text-xs font-mono">
                  <p>디버깅 정보:</p>
                  <p>scriptLines: {scriptLines.length}개</p>
                  <p>generatedImages: {generatedImages.length}개</p>
                  <p>generatedAudios: {generatedAudios.length}개</p>
                  <p>isExporting: {isExporting ? "true" : "false"}</p>
                  <p className="mt-2 font-semibold">
                    버튼 활성화 조건: {scriptLines.length > 0 && generatedImages.length > 0 && generatedAudios.length > 0 && !isExporting ? "✅ 활성화 가능" : "❌ 비활성화"}
                  </p>
                </div>

                    <Button
                      onClick={handleRenderVideo}
                      disabled={isExporting || scriptLines.length === 0 || generatedImages.length === 0 || generatedAudios.length === 0}
                      className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      size="lg"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          영상 렌더링 중...
                        </>
                      ) : (
                        <>
                          <Video className="mr-2 h-5 w-5" />
                          영상 렌더링 시작
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )

      case "title":
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold mb-6">제목/설명 생성</h2>
            <div>
              <h3 className="text-xl font-semibold mb-4">유튜브 제목 생성</h3>
              <p className="text-muted-foreground mb-6">
                생성된 대본을 바탕으로 SEO에 최적화된 유튜브 제목 5개를 추천해드립니다.
              </p>

              <div className="space-y-4 mb-6">
                <Button onClick={handleTitleGeneration} disabled={!script || isGeneratingTitles} className="w-full">
                  {isGeneratingTitles ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                      AI가 제목을 생성하고 있습니다...
                    </>
                  ) : (
                    <>
                      <Type className="w-4 h-4 mr-2" />
                      SEO 최적화 제목 5개 생성하기
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-4 mb-6">
                <h4 className="text-lg font-medium">또는 직접 제목 입력</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="유튜브 제목을 직접 입력하세요"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      if (customTitle.trim()) {
                        setSelectedTitle(customTitle.trim())
                        setCustomTitle("")
                      }
                    }}
                    disabled={!customTitle.trim()}
                  >
                    사용
                  </Button>
                </div>
              </div>

              {generatedTitles.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-medium">추천 제목 (선택하세요)</h4>
                  <div className="space-y-3">
                    {generatedTitles.map((title, index) => {
                      const cleanedTitle = cleanTitle(title) // Use the cleanTitle function

                      return (
                        <Card
                          key={index}
                          className={`cursor-pointer transition-all border rounded-lg ${
                            selectedTitle === cleanedTitle
                              ? "border-red-300 bg-red-50 ring-2 ring-red-200"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                          onClick={async () => {
                            setSelectedTitle(cleanedTitle)
                            // 제목 선택 시 자동으로 설명 생성
                            if (script && cleanedTitle) {
                              setIsGenerating(true)
                              try {
                                const result = await generateYouTubeDescription(script, selectedCategory, cleanedTitle, getApiKey())
                                setYoutubeDescription(result)
                                setCompletedSteps((prev) => {
                                  const newSteps = [...prev.filter((step) => step !== "description"), "description"]
                                  return newSteps
                                })
                              } catch (error) {
                                console.error("설명 생성 실패:", error)
                                // 설명 생성 실패해도 제목은 선택된 상태 유지
                              } finally {
                                setIsGenerating(false)
                              }
                            }
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                selectedTitle === cleanedTitle ? "bg-red-500 text-white" : "bg-red-50 text-red-600"
                              }`}>
                                {index + 1}
                              </div>
                              <p className={`text-sm flex-1 ${
                                selectedTitle === cleanedTitle ? "text-red-700" : "text-gray-900"
                              }`}>{cleanedTitle}</p>
                              {selectedTitle === cleanedTitle && (
                                <div className="flex-shrink-0 text-red-500">
                                  <Check className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>

                  {selectedTitle && (
                    <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm text-gray-500 mb-2">선택된 제목:</p>
                      <p className="text-base font-medium text-red-700">{selectedTitle}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 설명 생성 결과 표시 */}
              {selectedTitle && youtubeDescription && (
                <div className="mt-6 space-y-6">
                  <h3 className="text-xl font-semibold mb-4">생성된 설명란</h3>
                  
                  {/* 설명란 (해시태그 포함) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-medium">유튜브 설명란</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(`${youtubeDescription.description}\n\n${youtubeDescription.hashtags}`)
                        }
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        복사
                      </Button>
                    </div>
                    <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                      <CardContent className="p-6">
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                          {youtubeDescription.description}
                        </pre>
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-500">{youtubeDescription.hashtags}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 고정댓글 */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-semibold text-slate-900">고정댓글</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(youtubeDescription.pinnedComment)}
                        className="border-gray-300"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        복사
                      </Button>
                    </div>
                    <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                      <CardContent className="p-6">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
                          {youtubeDescription.pinnedComment}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 업로드 태그 */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-semibold text-slate-900">업로드 태그 ({youtubeDescription.uploadTags.length}개)</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(youtubeDescription.uploadTags.join(", "))}
                        className="border-gray-300"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        복사
                      </Button>
                    </div>
                    <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                      <CardContent className="p-6">
                        <div className="flex flex-wrap gap-2">
                          {youtubeDescription.uploadTags.map((tag, index) => (
                            <Badge 
                              key={index} 
                              variant="secondary" 
                              className="text-xs group relative pr-6 cursor-pointer hover:bg-gray-300 transition-colors"
                            >
                              {tag}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const newTags = youtubeDescription.uploadTags.filter((_, i) => i !== index)
                                  setYoutubeDescription({
                                    ...youtubeDescription,
                                    uploadTags: newTags,
                                  })
                                }}
                                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-400 rounded-full p-0.5"
                                title="태그 삭제"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* 설명 생성 중 표시 */}
              {selectedTitle && isGenerating && (
                <div className="mt-6">
                  <AIGeneratingAnimation type="영상 설명" />
                </div>
              )}
            </div>
            {isGeneratingTitles && <AIGeneratingAnimation type="SEO 최적화 제목" />}
          </div>
        )

      case "description":
        return (
          <div className="space-y-6">
            {/* 제목 & 설명 */}
            <div className="space-y-2 mb-6">
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">유튜브 설명 생성</h1>
              <p className="text-sm md:text-base text-gray-500">생성된 대본과 제목을 바탕으로 SEO에 최적화된 영상 설명, 고정댓글, 업로드 태그를 생성해드립니다.</p>
            </div>
            <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
              <CardHeader className="pb-4 border-b border-gray-100">
                <CardTitle className="text-lg font-semibold text-slate-900">유튜브 설명 생성</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
              {!selectedTitle && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ 먼저 유튜브 제목을 선택해주세요. 제목이 선택되어야 설명을 생성할 수 있습니다.
                  </p>
                </div>
              )}

              <Button
                onClick={handleDescriptionGeneration}
                disabled={!script || !selectedTitle || isGenerating}
                  className="w-full h-12 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold"
              >
                {isGenerating && activeStep === "description" ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    AI가 설명을 생성하고 있습니다...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    SEO 최적화된 영상 설명 생성하기
                  </>
                )}
              </Button>

              {youtubeDescription && (
                <div className="space-y-6">
                  {/* 설명란 (해시태그 포함) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-medium">유튜브 설명란</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(`${youtubeDescription.description}\n\n${youtubeDescription.hashtags}`)
                        }
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        복사
                      </Button>
                    </div>
                    <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                      <CardContent className="p-6">
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                          {youtubeDescription.description}
                        </pre>
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-500">{youtubeDescription.hashtags}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 고정댓글 */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-semibold text-slate-900">고정댓글</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(youtubeDescription.pinnedComment)}
                        className="border-gray-300"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        복사
                      </Button>
                    </div>
                    <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                      <CardContent className="p-6">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
                          {youtubeDescription.pinnedComment}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 업로드 태그 */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-semibold text-slate-900">업로드 태그 ({youtubeDescription.uploadTags.length}개)</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(youtubeDescription.uploadTags.join(", "))}
                        className="border-gray-300"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        복사
                      </Button>
                    </div>
                    <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                      <CardContent className="p-6">
                        <div className="flex flex-wrap gap-2">
                          {youtubeDescription.uploadTags.map((tag, index) => (
                            <span 
                              key={index} 
                              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm group relative pr-8 cursor-pointer hover:bg-gray-200 transition-colors"
                            >
                              {tag}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const newTags = youtubeDescription.uploadTags.filter((_, i) => i !== index)
                                  setYoutubeDescription({
                                    ...youtubeDescription,
                                    uploadTags: newTags,
                                  })
                                }}
                                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-300 rounded-full p-0.5"
                                title="태그 삭제"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
              </CardContent>
            </Card>
            {isGenerating && activeStep === "description" && <AIGeneratingAnimation type="영상 설명" />}
          </div>
        )

      case "thumbnail":
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold mb-6">썸네일 생성기</h2>
            <Tabs value={thumbnailMode} onValueChange={(value) => setThumbnailMode(value as "manual" | "ai")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="manual">직접 썸네일 만들기</TabsTrigger>
                <TabsTrigger value="ai">AI로 썸네일 만들기</TabsTrigger>
              </TabsList>

              {/* 직접 썸네일 만들기 탭 */}
              <TabsContent value="manual" className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-4">썸네일 생성</h3>
                  <p className="text-muted-foreground mb-6">
                    생성된 대본을 바탕으로 클릭률이 높은 썸네일 문구를 생성하고 직접 디자인할 수 있습니다.
                  </p>

                  {/* 썸네일 템플릿 선택 */}
                  <div className="mb-6">
                    <label className="text-sm font-medium mb-2 block">썸네일 템플릿 선택</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => {
                          setSelectedThumbnailTemplate("blank")
                          // 빈 템플릿 - 기본 스타일 초기화
                          if (thumbnailText.length > 0) {
                            const defaultStyles = thumbnailText.map(() => ({
                              color: "#FFFFFF",
                              backgroundColor: "transparent",
                              strokeWidth: 0,
                              strokeColor: "#000000",
                              fontSize: 120,
                              fontWeight: "900" as const,
                              textShadow: "none",
                              stroke: "none",
                              letterSpacing: -2,
                            }))
                            const defaultPositions = thumbnailText.map((_, index) => ({
                              x: 8,
                              y: 25 + index * 15,
                            }))
                            setTextStyles(defaultStyles)
                            setTextPositions(defaultPositions)
                          }
                        }}
                        className={`p-4 border-2 rounded-lg text-left transition-all ${
                          selectedThumbnailTemplate === "blank"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded bg-white border border-gray-300"></div>
                          <span className="font-semibold text-sm">빈 템플릿</span>
                        </div>
                        <p className="text-xs text-gray-600">기본 스타일</p>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedThumbnailTemplate("yellow-white")
                          // 노란색/흰색 템플릿 적용 (텍스트가 있는 경우에만, 두 줄로 제한)
                          if (thumbnailText.length > 0) {
                            const limitedLines = thumbnailText.slice(0, 2)
                            setThumbnailText(limitedLines)
                            
                            const templateStyles = limitedLines.map((_, index) => ({
                              color: index === 0 ? "#FFD700" : "#FFFFFF", // 첫 번째 줄은 노란색, 두 번째 줄은 흰색
                              backgroundColor: "transparent",
                              strokeWidth: 0,
                              strokeColor: "#000000",
                              fontSize: 120,
                              fontWeight: "900" as const,
                              textShadow: "none",
                              stroke: "none",
                              letterSpacing: -2,
                            }))
                            const templatePositions = limitedLines.map((_, index) => ({
                              x: 5,
                              y: 75 + index * 10, // 하단에 세로로 배치
                            }))
                            setTextStyles(templateStyles)
                            setTextPositions(templatePositions)
                          }
                        }}
                        className={`p-4 border-2 rounded-lg text-left transition-all ${
                          selectedThumbnailTemplate === "yellow-white"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded border-2 border-yellow-400 bg-gradient-to-b from-yellow-400 to-white"></div>
                          <span className="font-semibold text-sm">노란색/흰색</span>
                        </div>
                        <p className="text-xs text-gray-600">위 노란색, 아래 흰색</p>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedThumbnailTemplate("custom")
                        }}
                        className={`p-4 border-2 rounded-lg text-left transition-all ${
                          selectedThumbnailTemplate === "custom"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded bg-gray-300"></div>
                          <span className="font-semibold text-sm">커스텀</span>
                        </div>
                        <p className="text-xs text-gray-600">직접 디자인</p>
                      </button>
                    </div>
                  </div>

                  {/* 이미지 업로드 (선택 가능한 이미지) */}
                  <div className="mb-6">
                    <label className="text-sm font-medium mb-2 block">이미지 추가 (선택 및 편집 가능)</label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onload = (event) => {
                              const result = event.target?.result as string
                              setThumbnailOverlayImage(result)
                              setSelectedImageElement(true)
                              setSelectedTextIndex(null)
                            }
                            reader.readAsDataURL(file)
                          }
                        }}
                        className="flex-1"
                      />
                      {thumbnailOverlayImage && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setThumbnailOverlayImage(null)
                            setSelectedImageElement(false)
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 썸네일 생성 버튼에 애니메이션 추가 */}
                  <Button
                    onClick={handleThumbnailGeneration}
                    disabled={!script || isGeneratingThumbnail}
                    className="w-full mb-6"
                  >
                    {isGeneratingThumbnail ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        AI가 썸네일 문구를 생성하고 있습니다...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 mr-2" />
                        AI 썸네일 문구 생성하기
                      </>
                    )}
                  </Button>

                  {/* 텍스트 관리 */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">텍스트 관리</label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newText = `새 텍스트 ${thumbnailText.length + 1}`
                          setThumbnailText([...thumbnailText, newText])
                          setTextPositions([...textPositions, { x: 8, y: 25 + thumbnailText.length * 15 }])
                          setTextStyles([
                            ...textStyles,
                            {
                              color: "#FFFFFF",
                              fontSize: 120,
                              fontWeight: "900",
                              textShadow: "none",
                              stroke: "none",
                              letterSpacing: -2,
                              backgroundColor: "transparent",
                              strokeWidth: 0,
                              strokeColor: "#000000",
                            },
                          ])
                        }}
                      >
                        <Type className="w-4 h-4 mr-2" />
                        텍스트 추가
                      </Button>
                    </div>
                    {thumbnailText.length > 0 && (
                      <div className="space-y-2">
                        {thumbnailText.map((text, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 border rounded">
                            <span className="flex-1 text-sm truncate">{text || `텍스트 ${index + 1}`}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setThumbnailText(thumbnailText.filter((_, i) => i !== index))
                                setTextPositions(textPositions.filter((_, i) => i !== index))
                                setTextStyles(textStyles.filter((_, i) => i !== index))
                                if (selectedTextIndex === index) {
                                  setSelectedTextIndex(null)
                                } else if (selectedTextIndex !== null && selectedTextIndex > index) {
                                  setSelectedTextIndex(selectedTextIndex - 1)
                                }
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {thumbnailText.length > 0 && (
                    <div className="flex flex-col lg:flex-row gap-6">
                  {/* 썸네일 미리보기 */}
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium">썸네일 미리보기</h4>
                      <Button onClick={handleSaveThumbnailImage} variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        이미지 저장
                      </Button>
                    </div>
                    <div
                      className="thumbnail-container relative mx-auto"
                      style={{
                        width: "640px",
                        height: "360px", // 1280:720 = 640:360
                        overflow: "hidden",
                        backgroundColor: "#000000",
                      }}
                      onMouseMove={(e) => {
                        if (isDraggingImage) {
                          handleImageMouseMove(e)
                        } else {
                          handleMouseMove(e)
                        }
                      }}
                      onMouseUp={(e) => {
                        if (isDraggingImage) {
                          handleImageMouseUp()
                        } else {
                          handleMouseUp()
                        }
                      }}
                      onMouseLeave={() => {
                        handleMouseUp()
                        handleImageMouseUp()
                      }}
                      onClick={handleThumbnailCanvasClick}
                    >
                      {generatedImage && (
                        <div
                          className={`absolute w-1/2 h-full cursor-move hover:opacity-90 transition-opacity ${
                            selectedImageElement ? "ring-2 ring-blue-400" : ""
                          }`}
                          style={{
                            left: `${doctorImagePosition.x}%`,
                            top: `${doctorImagePosition.y}%`,
                            transform: "translate(-50%, 0)",
                          }}
                          onMouseDown={handleImageMouseDown}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedImageElement(true)
                            setSelectedTextIndex(null)
                          }}
                        >
                          <img
                            src={generatedImage || "/placeholder.svg"}
                            alt="인물 이미지"
                            className="w-full h-full object-cover"
                            style={{
                              imageRendering: "crisp-edges",
                            } as React.CSSProperties}
                          />
                          <div
                            className={`absolute inset-0 ${
                              gradientMask.direction.includes("|bg-gradient-to-b")
                                ? `bg-gradient-to-b ${gradientMask.direction.split("|")[0]}`
                                : gradientMask.direction.includes("|bg-gradient-to-t")
                                ? `bg-gradient-to-t ${gradientMask.direction.split("|")[0]}`
                                : gradientMask.direction.includes("|")
                                ? `bg-gradient-to-r ${gradientMask.direction.split("|")[0]}`
                                : `bg-gradient-to-r ${gradientMask.direction}`
                            }`}
                            style={{ opacity: gradientMask.opacity }}
                          ></div>
                        </div>
                      )}

                      {/* 오버레이 이미지 (선택 가능한 이미지) */}
                      {thumbnailOverlayImage && (
                        <div
                          className={`absolute cursor-move hover:opacity-90 transition-opacity ${
                            selectedImageElement ? "ring-2 ring-blue-400" : ""
                          }`}
                          style={{
                            left: `${overlayImagePosition.x}%`,
                            top: `${overlayImagePosition.y}%`,
                            width: `${overlayImageSize.width}%`,
                            height: `${overlayImageSize.height}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingImage(true)
                            setSelectedImageElement(true)
                            setSelectedTextIndex(null)
                            
                            const rect = e.currentTarget.getBoundingClientRect()
                            const containerRect = e.currentTarget.closest(".thumbnail-container")?.getBoundingClientRect()
                            if (containerRect) {
                              setDragOffset({
                                x: e.clientX - rect.left,
                                y: e.clientY - rect.top,
                              })
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedImageElement(true)
                            setSelectedTextIndex(null)
                          }}
                        >
                          <img
                            src={thumbnailOverlayImage}
                            alt="오버레이 이미지"
                            className="w-full h-full object-cover"
                          />
                          <div
                            className={`absolute inset-0 ${
                              gradientMask.direction.includes("|bg-gradient-to-b")
                                ? `bg-gradient-to-b ${gradientMask.direction.split("|")[0]}`
                                : gradientMask.direction.includes("|bg-gradient-to-t")
                                ? `bg-gradient-to-t ${gradientMask.direction.split("|")[0]}`
                                : gradientMask.direction.includes("|")
                                ? `bg-gradient-to-r ${gradientMask.direction.split("|")[0]}`
                                : `bg-gradient-to-r ${gradientMask.direction}`
                            }`}
                            style={{ opacity: gradientMask.opacity }}
                          ></div>
                        </div>
                      )}

                      {thumbnailText.map((text, index) => {
                        const style = textStyles[index] || {}
                        const strokeWidth = style.strokeWidth || 0
                        const strokeColor = style.strokeColor || "#000000"
                        const backgroundColor = style.backgroundColor || "transparent"
                        
                        return (
                          <div
                            key={index}
                            className={`absolute cursor-move hover:opacity-80 transition-opacity select-none ${
                              selectedTextIndex === index ? "ring-2 ring-blue-400" : ""
                            }`}
                            style={{
                              left: `${textPositions[index]?.x || 2}%`,
                              top: `${textPositions[index]?.y || 15 + index * 18}%`,
                              fontSize: `${(style.fontSize || 120) * 0.5}px`,
                              fontWeight: style.fontWeight || "900",
                              letterSpacing: `${style.letterSpacing || -2}px`,
                              lineHeight: 1.1,
                              fontFamily: "Arial Black, Arial, sans-serif",
                              textRendering: "geometricPrecision",
                              WebkitFontSmoothing: "antialiased",
                              MozOsxFontSmoothing: "grayscale",
                              transform: "translateZ(0)",
                              backfaceVisibility: "hidden",
                              textAlign: "left",
                              whiteSpace: "nowrap",
                              maxWidth: selectedThumbnailTemplate === "yellow-white" ? "90%" : "45%",
                              backgroundColor: backgroundColor !== "transparent" ? backgroundColor : undefined,
                              padding: backgroundColor !== "transparent" ? "6px 12px" : undefined,
                              borderRadius: backgroundColor !== "transparent" ? "4px" : undefined,
                            }}
                            onMouseDown={(e) => handleMouseDown(e, index)}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedTextIndex(index)
                              setEditingText(text)
                              setSelectedImageElement(false)
                              generateSuggestedTexts(text, index)
                            }}
                          >
                            {/* 한 단어씩 스트로크 적용 */}
                            {text.split(/(\s+)/).map((word, wordIndex) => {
                              if (!word.trim()) {
                                // 공백인 경우
                                return <span key={wordIndex}>{word}</span>
                              }
                              // 단어인 경우 (스트로크 없음)
                              return (
                                <span
                                  key={wordIndex}
                                  style={{
                                    color: style.color || "#FFFFFF",
                                    WebkitTextStroke: "none",
                                    textShadow: style.textShadow || "none",
                                    display: "inline-block",
                                  }}
                                >
                                  {word}
                                </span>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* 편집 패널 */}
                  <div className="flex-1 min-w-[280px] space-y-4">
                    <h4 className="text-lg font-medium">편집 패널</h4>

                    {/* 이미지 설정 (오버레이 이미지 또는 인물 이미지) */}
                    {selectedImageElement && (thumbnailOverlayImage || generatedImage) && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">이미지 설정</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {thumbnailOverlayImage && (
                            <>
                              <div>
                                <label className="text-xs font-medium mb-2 block">
                                  가로 위치: {Math.round(overlayImagePosition.x)}%
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={overlayImagePosition.x}
                                  onChange={(e) =>
                                    setOverlayImagePosition((prev) => ({
                                      ...prev,
                                      x: Number.parseInt(e.target.value),
                                    }))
                                  }
                                  className="w-full"
                                />
                              </div>

                              <div>
                                <label className="text-xs font-medium mb-2 block">
                                  세로 위치: {Math.round(overlayImagePosition.y)}%
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={overlayImagePosition.y}
                                  onChange={(e) =>
                                    setOverlayImagePosition((prev) => ({
                                      ...prev,
                                      y: Number.parseInt(e.target.value),
                                    }))
                                  }
                                  className="w-full"
                                />
                              </div>

                              <div>
                                <label className="text-xs font-medium mb-2 block">
                                  가로 크기: {Math.round(overlayImageSize.width)}%
                                </label>
                                <input
                                  type="range"
                                  min="10"
                                  max="100"
                                  value={overlayImageSize.width}
                                  onChange={(e) =>
                                    setOverlayImageSize((prev) => ({
                                      ...prev,
                                      width: Number.parseInt(e.target.value),
                                    }))
                                  }
                                  className="w-full"
                                />
                              </div>

                              <div>
                                <label className="text-xs font-medium mb-2 block">
                                  세로 크기: {Math.round(overlayImageSize.height)}%
                                </label>
                                <input
                                  type="range"
                                  min="10"
                                  max="100"
                                  value={overlayImageSize.height}
                                  onChange={(e) =>
                                    setOverlayImageSize((prev) => ({
                                      ...prev,
                                      height: Number.parseInt(e.target.value),
                                    }))
                                  }
                                  className="w-full"
                                />
                              </div>
                            </>
                          )}

                          {generatedImage && (
                            <>
                              <div>
                                <label className="text-xs font-medium mb-2 block">
                                  가로 위치: {Math.round(doctorImagePosition.x)}%
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={doctorImagePosition.x}
                                  onChange={(e) =>
                                    setDoctorImagePosition((prev) => ({
                                      ...prev,
                                      x: Number.parseInt(e.target.value),
                                    }))
                                  }
                                  className="w-full"
                                />
                              </div>

                              <div>
                                <label className="text-xs font-medium mb-2 block">
                                  세로 위치: {Math.round(doctorImagePosition.y)}%
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={doctorImagePosition.y}
                                  onChange={(e) =>
                                    setDoctorImagePosition((prev) => ({
                                      ...prev,
                                      y: Number.parseInt(e.target.value),
                                    }))
                                  }
                                  className="w-full"
                                />
                              </div>
                            </>
                          )}

                          <div>
                            <label className="text-xs font-medium mb-2 block">그라데이션 방향</label>
                            <select
                              value={gradientMask.direction}
                              onChange={(e) =>
                                setGradientMask((prev) => ({
                                  ...prev,
                                  direction: e.target.value,
                                }))
                              }
                              className="w-full p-2 border rounded text-sm"
                            >
                              <option value="from-black via-black/50 to-transparent">좌→우 (기본)</option>
                              <option value="from-transparent via-black/50 to-black">우→좌</option>
                              <option value="from-black via-black/30 to-transparent">좌→우 (연한)</option>
                              <option value="from-black to-transparent">좌→우 (단순)</option>
                              <option value="from-black via-black/50 to-transparent|bg-gradient-to-b">위→아래</option>
                              <option value="from-black via-black/50 to-transparent|bg-gradient-to-t">아래→위</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-medium mb-2 block">
                              마스크 강도: {Math.round(gradientMask.opacity * 100)}%
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={gradientMask.opacity}
                              onChange={(e) =>
                                setGradientMask((prev) => ({
                                  ...prev,
                                  opacity: Number.parseFloat(e.target.value),
                                }))
                              }
                              className="w-full"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* 텍스트 편집 */}
                    {selectedTextIndex !== null ? (
                      <div className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">{selectedTextIndex + 1}번째 줄 편집</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <label className="text-xs font-medium mb-2 block">텍스트 내용</label>
                              <input
                                type="text"
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onBlur={() => handleTextEdit(selectedTextIndex, editingText)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleTextEdit(selectedTextIndex, editingText)
                                    e.currentTarget.blur()
                                  }
                                }}
                                className="w-full p-2 border rounded text-sm"
                                placeholder="텍스트를 입력하세요"
                              />
                            </div>

                            {/* 위치 조정 */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-medium mb-2 block">X 위치 (%)</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={Math.round(textPositions[selectedTextIndex]?.x || 2)}
                                  onChange={(e) => {
                                    const newX = Number.parseFloat(e.target.value) || 0
                                    setTextPositions((prev) =>
                                      prev.map((pos, i) => (i === selectedTextIndex ? { ...pos, x: Math.max(0, Math.min(100, newX)) } : pos))
                                    )
                                  }}
                                  className="w-full p-2 border rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium mb-2 block">Y 위치 (%)</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={Math.round(textPositions[selectedTextIndex]?.y || 15)}
                                  onChange={(e) => {
                                    const newY = Number.parseFloat(e.target.value) || 0
                                    setTextPositions((prev) =>
                                      prev.map((pos, i) => (i === selectedTextIndex ? { ...pos, y: Math.max(0, Math.min(100, newY)) } : pos))
                                    )
                                  }}
                                  className="w-full p-2 border rounded text-sm"
                                />
                              </div>
                            </div>

                            {/* 색상 선택 */}
                            <div>
                              <label className="text-xs font-medium mb-2 block">텍스트 색상</label>
                              <div className="flex gap-2 mb-2 flex-wrap">
                                {[
                                  { color: "#FFD700", name: "노란색" },
                                  { color: "#FFFFFF", name: "흰색" },
                                  { color: "#FF0000", name: "빨간색" },
                                  { color: "#000000", name: "검은색" },
                                  { color: "#00FF00", name: "초록색" },
                                  { color: "#0000FF", name: "파란색" },
                                  { color: "#FFA500", name: "주황색" },
                                  { color: "#800080", name: "보라색" },
                                ].map((item) => (
                                  <button
                                    key={item.color}
                                    className={`w-10 h-10 rounded border-2 transition-all ${
                                      textStyles[selectedTextIndex]?.color === item.color
                                        ? "border-blue-500 scale-110"
                                        : "border-gray-300 hover:border-gray-400"
                                    }`}
                                    style={{ backgroundColor: item.color }}
                                    onClick={() => updateTextStyle(selectedTextIndex, "color", item.color)}
                                    title={item.name}
                                  />
                                ))}
                              </div>
                              <input
                                type="color"
                                value={textStyles[selectedTextIndex]?.color || "#FFFFFF"}
                                onChange={(e) => updateTextStyle(selectedTextIndex, "color", e.target.value)}
                                className="w-full h-8 rounded border"
                              />
                            </div>

                            {/* 텍스트 배경색 */}
                            <div>
                              <label className="text-xs font-medium mb-2 block">배경색 (선택사항)</label>
                              <div className="flex gap-2 mb-2 flex-wrap">
                                {[
                                  { color: "#FFD700", name: "노란색" },
                                  { color: "transparent", name: "없음" },
                                  { color: "#000000", name: "검은색" },
                                  { color: "#FFFFFF", name: "흰색" },
                                  { color: "#FF0000", name: "빨간색" },
                                ].map((item) => (
                                  <button
                                    key={item.color}
                                    className={`w-10 h-10 rounded border-2 transition-all ${
                                      textStyles[selectedTextIndex]?.backgroundColor === item.color
                                        ? "border-blue-500 scale-110"
                                        : "border-gray-300 hover:border-gray-400"
                                    }`}
                                    style={{
                                      backgroundColor: item.color === "transparent" ? "transparent" : item.color,
                                      backgroundImage: item.color === "transparent" ? "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)" : undefined,
                                      backgroundSize: item.color === "transparent" ? "10px 10px" : undefined,
                                      backgroundPosition: item.color === "transparent" ? "0 0, 5px 5px" : undefined,
                                    }}
                                    onClick={() => updateTextStyle(selectedTextIndex, "backgroundColor", item.color)}
                                    title={item.name}
                                  />
                                ))}
                              </div>
                              <input
                                type="color"
                                value={textStyles[selectedTextIndex]?.backgroundColor || "#00000000"}
                                onChange={(e) => updateTextStyle(selectedTextIndex, "backgroundColor", e.target.value)}
                                className="w-full h-8 rounded border"
                              />
                            </div>

                            {/* 텍스트 테두리 */}
                            <div>
                              <label className="text-xs font-medium mb-2 block">테두리 (스트로크)</label>
                              <div className="flex items-center gap-4">
                                <div className="flex-1">
                                  <label className="text-xs text-gray-600 mb-1 block">두께</label>
                                  <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    value={textStyles[selectedTextIndex]?.strokeWidth || 0}
                                    onChange={(e) => {
                                      const width = Number.parseInt(e.target.value)
                                      updateTextStyle(selectedTextIndex, "strokeWidth", width)
                                      if (width > 0) {
                                        const currentStyle = textStyles[selectedTextIndex]
                                        updateTextStyle(selectedTextIndex, "stroke", currentStyle?.strokeColor || "#000000")
                                      } else {
                                        updateTextStyle(selectedTextIndex, "stroke", "none")
                                      }
                                    }}
                                    className="w-full"
                                  />
                                  <span className="text-xs text-gray-500">
                                    {textStyles[selectedTextIndex]?.strokeWidth || 0}px
                                  </span>
                                </div>
                                {(textStyles[selectedTextIndex]?.strokeWidth || 0) > 0 && (
                                  <div className="flex-1">
                                    <label className="text-xs text-gray-600 mb-1 block">색상</label>
                                    <input
                                      type="color"
                                      value={textStyles[selectedTextIndex]?.strokeColor || "#000000"}
                                      onChange={(e) => {
                                        updateTextStyle(selectedTextIndex, "strokeColor", e.target.value)
                                        updateTextStyle(selectedTextIndex, "stroke", e.target.value)
                                      }}
                                      className="w-full h-8 rounded border"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-medium mb-2 block">
                                글씨 크기: {textStyles[selectedTextIndex]?.fontSize || 120}px
                              </label>
                              <input
                                type="range"
                                min="24"
                                max="150"
                                value={textStyles[selectedTextIndex]?.fontSize || 120}
                                onChange={(e) =>
                                  updateTextStyle(selectedTextIndex, "fontSize", Number.parseInt(e.target.value))
                                }
                                className="w-full"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-medium mb-2 block">
                                자간: {textStyles[selectedTextIndex]?.letterSpacing || -2}px
                              </label>
                              <input
                                type="range"
                                min="-5"
                                max="10"
                                value={textStyles[selectedTextIndex]?.letterSpacing || -2}
                                onChange={(e) =>
                                  updateTextStyle(selectedTextIndex, "letterSpacing", Number.parseInt(e.target.value))
                                }
                                className="w-full"
                              />
                            </div>

                            {/* 글씨 굵기 */}
                            <div>
                              <label className="text-xs font-medium mb-2 block">글씨 굵기</label>
                              <select
                                value={textStyles[selectedTextIndex]?.fontWeight || "900"}
                                onChange={(e) => updateTextStyle(selectedTextIndex, "fontWeight", e.target.value)}
                                className="w-full p-2 border rounded text-sm"
                              >
                                <option value="normal">보통</option>
                                <option value="bold">굵게</option>
                                <option value="900">매우 굵게</option>
                              </select>
                            </div>
                          </CardContent>
                        </Card>

                        {showSuggestions && suggestedTexts.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-sm">추천 문구</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {suggestedTexts.map((suggestion, index) => (
                                <button
                                  key={index}
                                  onClick={() => applySuggestedText(suggestion)}
                                  className="w-full p-2 text-left text-sm border rounded hover:bg-gray-50 transition-colors"
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="p-6 text-center text-muted-foreground">
                          편집할 텍스트를 클릭하세요
                          <br />
                          <small className="text-xs">드래그로 위치 조정 가능</small>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* AI로 썸네일 만들기 탭 */}
              <TabsContent value="ai" className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-4">AI 썸네일 생성</h3>
                  <p className="text-muted-foreground mb-6">
                    선택한 주제를 기반으로 AI가 유튜브 썸네일을 자동으로 생성합니다. 16:9 비율로 최적화된 썸네일을 제공합니다.
                  </p>

                  {!selectedTopic && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        주제를 먼저 선택해주세요. 주제 추천 단계에서 주제를 선택한 후 사용할 수 있습니다.
                      </p>
                    </div>
                  )}

                  <div className="mb-6">
                    <p className="text-sm text-muted-foreground mb-2">
                      선택된 주제: <span className="font-semibold text-gray-900">{selectedTopic || "없음"}</span>
                    </p>
                  </div>

                  <Button
                    onClick={handleAIGenerateThumbnail}
                    disabled={!selectedTopic || isGeneratingAIThumbnail}
                    className="w-full mb-6"
                  >
                    {isGeneratingAIThumbnail ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        AI가 썸네일을 생성하고 있습니다...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI 썸네일 생성하기
                      </>
                    )}
                  </Button>

                  {aiThumbnailUrl && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-medium">생성된 썸네일</h4>
                        <Button onClick={handleDownloadAIThumbnail} variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-2" />
                          다운로드
                        </Button>
                      </div>
                      <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
                        <img
                          src={aiThumbnailUrl}
                          alt="AI 생성 썸네일"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground text-center">
                        유튜브 썸네일 규격 (16:9)으로 생성되었습니다.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )

      case "shorts":
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold mb-6">쇼츠 생성기</h2>
            <p className="text-muted-foreground mb-6">
              생성된 롱폼 대본과 이미지를 활용하여 쇼츠 영상을 생성합니다.
            </p>

            {/* 대본 및 이미지 확인 */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">준비 상태 확인</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{script ? "✓" : "✗"}</p>
                    <p className="text-sm text-muted-foreground">대본 생성</p>
                    {!script && <p className="text-xs text-red-600 mt-1">⚠️ 필요</p>}
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{generatedImages.length}</p>
                    <p className="text-sm text-muted-foreground">이미지</p>
                    {generatedImages.length === 0 && <p className="text-xs text-red-600 mt-1">⚠️ 필요</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 이미지 업로드 (쇼츠 생성기용) */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">이미지 추가 (선택사항)</CardTitle>
                  <span className="text-xs text-muted-foreground">이미지는 한장씩 업로드해주세요</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  쇼츠 영상에 사용할 이미지를 추가로 업로드할 수 있습니다.
                </p>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files
                    if (!files || files.length === 0) return

                    // 모든 파일을 먼저 읽고, 한 번에 상태 업데이트
                    const fileArray = Array.from(files)
                    const validFiles = fileArray.filter(file => file.type.startsWith("image/"))
                    
                    if (validFiles.length !== fileArray.length) {
                      alert("일부 파일은 이미지 파일이 아닙니다.")
                    }

                    if (validFiles.length === 0) return

                    // 모든 파일을 Promise로 읽기
                    const readPromises = validFiles.map((file) => {
                      return new Promise<string>((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onload = (e) => {
                          const imageUrl = e.target?.result as string
                          resolve(imageUrl)
                        }
                        reader.onerror = () => reject(new Error(`파일 읽기 실패: ${file.name}`))
                        reader.readAsDataURL(file)
                      })
                    })

                    // 모든 파일을 읽은 후 한 번에 상태 업데이트
                    Promise.all(readPromises)
                      .then((imageUrls) => {
                        setGeneratedImages((prev) => {
                          // 현재 존재하는 이미지 URL 목록
                          const existingUrls = new Set(prev.map(img => img.imageUrl))
                          
                          // 중복되지 않은 이미지만 필터링
                          const newImageUrls = imageUrls.filter(url => !existingUrls.has(url))
                          
                          if (newImageUrls.length === 0) {
                            console.log("[롱폼 쇼츠] 모든 이미지가 이미 존재합니다")
                            return prev
                          }

                          // 새로운 이미지들 추가 (lineId는 임시로 음수 사용하여 구분)
                          const newImages = newImageUrls.map((imageUrl, index) => ({
                            lineId: -(Date.now() + index), // 음수로 임시 ID 생성
                            imageUrl,
                            prompt: "사용자 업로드 이미지",
                            order: prev.length + index,
                            isUserUploaded: true,
                          }))

                          return [...prev, ...newImages]
                        })
                      })
                      .catch((error) => {
                        console.error("[롱폼 쇼츠] 이미지 업로드 오류:", error)
                        alert("이미지 업로드 중 오류가 발생했습니다.")
                      })

                    // input 초기화
                    e.target.value = ""
                  }}
                  className="w-full"
                />
              </CardContent>
            </Card>

            {/* 이미지 선택 및 순서 조정 */}
            {generatedImages.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">이미지 선택 및 순서 조정</CardTitle>
                    {(() => {
                      // 두 가지 방법으로 업로드한 이미지 확인
                      const uploadedImages1 = generatedImages.filter(img => img.prompt === "사용자 업로드 이미지")
                      const uploadedImages2 = generatedImages.filter(img => img.isUserUploaded === true)
                      const uploadedImages = uploadedImages1.length > 0 ? uploadedImages1 : uploadedImages2
                      const uploadedCount = uploadedImages.length
                      
                      console.log("[롱폼 쇼츠] ===== 이미지 초기화 버튼 체크 =====")
                      console.log("[롱폼 쇼츠] 전체 이미지 개수:", generatedImages.length)
                      console.log("[롱폼 쇼츠] 전체 이미지 상세:", generatedImages.map(img => ({ 
                        lineId: img.lineId, 
                        prompt: img.prompt, 
                        isUserUploaded: img.isUserUploaded 
                      })))
                      console.log("[롱폼 쇼츠] prompt로 필터링한 업로드 이미지:", uploadedImages1.length)
                      console.log("[롱폼 쇼츠] isUserUploaded로 필터링한 업로드 이미지:", uploadedImages2.length)
                      console.log("[롱폼 쇼츠] 최종 업로드 이미지 개수:", uploadedCount)
                      
                      if (uploadedCount > 0) {
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!confirm("업로드한 모든 사진을 삭제하시겠습니까?")) {
                                return
                              }
                              setGeneratedImages((prev) => {
                                // 업로드한 이미지가 아닌 것만 필터링 (AI 생성 이미지 유지)
                                const filtered = prev.filter((img) => 
                                  img.prompt !== "사용자 업로드 이미지" && img.isUserUploaded !== true
                                )
                                console.log("[롱폼 쇼츠] 초기화 후 이미지 개수:", filtered.length)
                                return filtered
                              })
                            }}
                            className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                          >
                            <X className="w-4 h-4 mr-2" />
                            사진 초기화 ({uploadedCount}개)
                          </Button>
                        )
                      }
                      return null
                    })()}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {generatedImages.map((img, index) => {
                      const isUserUploaded = img.prompt === "사용자 업로드 이미지"
                      return (
                        <div
                          key={img.lineId}
                          className="relative group border-2 rounded-lg overflow-hidden"
                        >
                          <div className="aspect-square w-full bg-muted">
                            <img
                              src={img.imageUrl}
                              alt={`Image ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {isUserUploaded && (
                            <div className="absolute top-2 left-2 z-10">
                              <Badge variant="secondary" className="bg-blue-500 text-white text-xs">
                                <Upload className="w-3 h-3 mr-1" />
                                업로드
                              </Badge>
                            </div>
                          )}
                          <div className="absolute top-2 right-2 z-10">
                            <Badge variant="secondary" className="bg-purple-600 text-white">
                              {index + 1}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 쇼츠 길이 선택 */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">쇼츠 길이 선택</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((duration) => (
                    <button
                      key={duration}
                      onClick={() => setShortsDuration(duration as 1 | 2 | 3)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        shortsDuration === duration
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className="text-2xl font-bold">{duration}분</p>
                      <p className="text-sm text-muted-foreground">쇼츠</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 대본 요약 */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">대본 요약</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleSummarizeScriptForShorts}
                  disabled={!script || generatedImages.length === 0 || isSummarizingScript}
                  className="w-full"
                >
                  {isSummarizingScript ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      AI가 대본을 요약하고 있습니다...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {shortsDuration}분 길이로 대본 요약하기
                    </>
                  )}
                </Button>

                {summarizedScript && (
                  <div className="mt-4">
                    <Label className="mb-2 block">요약된 대본</Label>
                    <Textarea
                      value={summarizedScript}
                      readOnly
                      className="min-h-[200px]"
                      placeholder="요약된 대본이 여기에 표시됩니다..."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 제목 생성 */}
            {summarizedScript && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">제목 생성</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={handleGenerateShortsTitle}
                    disabled={!selectedTopic || !summarizedScript || isGeneratingShortsTitle}
                    className="w-full"
                    size="lg"
                  >
                    {isGeneratingShortsTitle ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        제목 생성 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        후킹 제목 생성하기
                      </>
                    )}
                  </Button>
                  {shortsHookingTitle && (
                    <div className="p-4 bg-muted rounded-lg space-y-3">
                      <p className="text-sm font-semibold mb-2">생성된 제목 (수정 가능):</p>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">첫 번째 줄 (꾸며주는 말)</Label>
                          <Input
                            value={shortsHookingTitle.line1}
                            onChange={(e) => setShortsHookingTitle({ ...shortsHookingTitle, line1: e.target.value })}
                            className="text-lg font-bold text-yellow-600 bg-yellow-50 border-yellow-300"
                            placeholder="첫 번째 줄 입력"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">두 번째 줄 (핵심 내용)</Label>
                          <Input
                            value={shortsHookingTitle.line2}
                            onChange={(e) => setShortsHookingTitle({ ...shortsHookingTitle, line2: e.target.value })}
                            className="text-lg font-bold text-white bg-black border-gray-600"
                            placeholder="두 번째 줄 입력"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* TTS 생성 */}
            {summarizedScript && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">TTS 생성</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleGenerateShortsTTS}
                    disabled={!summarizedScript || isGeneratingShortsTts}
                    className="w-full"
                  >
                    {isGeneratingShortsTts ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        TTS 생성 중...
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 mr-2" />
                        TTS 생성하기
                      </>
                    )}
                  </Button>
                  {shortsTtsAudioUrl && (
                    <div className="mt-4">
                      <audio controls src={shortsTtsAudioUrl} className="w-full" />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 영상 렌더링 */}
            {shortsTtsAudioUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">영상 렌더링</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 캔버스 (숨김) */}
                  <canvas
                    ref={shortsCanvasRef}
                    width={1080}
                    height={1920}
                    className="hidden"
                  />

                  <Button
                    onClick={handleRenderShortsVideo}
                    disabled={!shortsTtsAudioUrl || isRenderingShorts}
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isRenderingShorts ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        영상 렌더링 중...
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4 mr-2" />
                        쇼츠 영상 렌더링 시작
                      </>
                    )}
                  </Button>

                  {shortsVideoUrl && (
                    <div className="mt-4">
                      <div className="flex justify-center">
                        <video
                          ref={shortsVideoRef}
                          src={shortsVideoUrl}
                          controls
                          className="rounded-lg max-w-md w-full"
                          style={{ maxHeight: "600px" }}
                        />
                      </div>
                      <Button
                        onClick={() => {
                          const a = document.createElement("a")
                          a.href = shortsVideoUrl
                          a.download = `shorts-${Date.now()}.webm`
                          a.click()
                        }}
                        className="w-full mt-4"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        영상 다운로드
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )

      case "analysis":
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-slate-800 mb-4">종합 분석</h1>
              <p className="text-slate-600 text-lg">유튜브 업로드 전 최종 미리보기</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* 제목 선택 */}
              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">제목 선택</h3>
                {generatedTitles.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {generatedTitles.map((title, index) => {
                      const cleanedTitle = cleanTitle(title) // Use the cleanTitle function

                      return (
                        <div
                          key={index}
                          className={`p-2 rounded-lg border cursor-pointer transition-all text-sm ${
                            selectedTitleForAnalysis === cleanedTitle
                              ? "border-purple-500 bg-purple-50"
                              : "border-gray-200 hover:border-purple-300"
                          }`}
                          onClick={() => setSelectedTitleForAnalysis(cleanedTitle)}
                        >
                          {cleanedTitle}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">생성된 제목이 없습니다</p>
                )}
              </div>

              {/* 썸네일 선택 */}
              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">썸네일 선택</h3>
                {generatedImage ? (
                  <div
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedThumbnailForAnalysis === generatedImage
                        ? "border-purple-500"
                        : "border-gray-200 hover:border-purple-300"
                    }`}
                    onClick={() => setSelectedThumbnailForAnalysis(generatedImage)}
                  >
                    <img
                      src={generatedImage || "/placeholder.svg"}
                      alt="Generated thumbnail"
                      className="w-full h-20 object-cover"
                    />
                    {selectedThumbnailForAnalysis === generatedImage && (
                      <div className="absolute inset-0 bg-purple-500 bg-opacity-20 flex items-center justify-center">
                        <Check className="w-6 h-6 text-purple-600" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500 text-sm">썸네일 없음</p>
                  </div>
                )}
              </div>
            </div>

            {/* The AI Review section is removed as per the updates */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gray-900 p-4">
                <div className="max-w-4xl mx-auto">
                  {/* Video 플레이어 */}
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
                    {selectedThumbnailForAnalysis ? (
                      <img
                        src={selectedThumbnailForAnalysis || "/placeholder.svg"}
                        alt="선택된 썸네일"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">썸네일을 선택해주세요</div>
                    )}
                  </div>

                  {/* Video Info */}
                  <div className="mt-4 space-y-3">
                    <h2 className="text-xl font-bold text-white">
                      {selectedTitleForAnalysis || "제목을 선택해주세요"}
                    </h2>
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <span>채널명</span>
                      <span>•</span>
                      <span>구독자 수</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">설명</h3>
                  {youtubeDescription && (
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(youtubeDescription.description)}>
                      <Copy className="w-4 h-4 mr-2" />
                      복사
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {youtubeDescription?.description || "설명을 생성해주세요"}
                </p>
              </div>

              {youtubeDescription && (
                <>
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">고정댓글</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(youtubeDescription.pinnedComment)}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        복사
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {youtubeDescription.pinnedComment}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">해시태그</h3>
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(youtubeDescription.hashtags)}>
                        <Copy className="w-4 h-4 mr-2" />
                        복사
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{youtubeDescription.hashtags}</p>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">업로드 태그 ({youtubeDescription.uploadTags.length}개)</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(youtubeDescription.uploadTags.join(", "))}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        복사
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {youtubeDescription.uploadTags.map((tag, index) => (
                        <span 
                          key={index} 
                          className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs group relative pr-6 cursor-pointer hover:bg-blue-100 transition-colors"
                        >
                          {tag}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const newTags = youtubeDescription.uploadTags.filter((_, i) => i !== index)
                              setYoutubeDescription({
                                ...youtubeDescription,
                                uploadTags: newTags,
                              })
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-200 rounded-full p-0.5"
                            title="태그 삭제"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )

      default:
        return (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              <Sparkles className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">기능 준비 중</h3>
              <p>이 기능은 곧 출시될 예정입니다.</p>
            </div>
          </div>
        )
    }
  }

  // AI 종합 검토 함수 제거 (업데이트에 따라 제거됨)
  // const handleAIReview = async () => {
  //   if (!selectedTitleForAnalysis) {
  //     alert("검토할 제목을 선택해주세요.");
  //     return;
  //   }

  //   setIsAIReviewing(true);
  //   try {
  //     console.log("[v0] AI 종합 검토 시작");
  //     // Call the API with all relevant data
  //     const reviewResult = await generateAIReview(
  //       script || "", // Pass script if available
  //       selectedTitleForAnalysis,
  //       selectedThumbnailForAnalysis || "", // Pass selected thumbnail if available
  //       // Pass performance metrics if they are available and the API expects them
  //       // For now, assuming the API might generate them or use them internally
  //     );
  //     setAiReviewResult(reviewResult);
  //     console.log("[v0] AI 종합 검토 완료:", reviewResult);
  //   } catch (error) {
  //     console.error("AI 종합 검토 실패:", error);
  //     const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
  //     alert(`AI 종합 검토에 실패했습니다: ${errorMessage}`);
  //   } finally {
  //     setIsAIReviewing(false);
  //   }
  // };

  // 단계 번호 매핑
  const getStepNumber = (stepId: string) => {
    const stepIndex = sidebarItems.findIndex((item) => item.id === stepId)
    return stepIndex + 1
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  메인으로
              </Button>
              </Link>
              <h1 className="text-lg font-semibold text-gray-800">
                wingsAIStudio - AI 기반 영상 자동 제작 툴
                </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar - 모바일에서는 하단으로 */}
        <aside className="w-full lg:w-60 bg-white border-r border-gray-200 lg:min-h-screen order-3 lg:order-1">
          <div className="p-4 lg:p-6">
            {/* Logo */}
            <div className="mb-6 lg:mb-8">
              <h2 className="text-xl lg:text-2xl font-bold text-red-600 mb-1">wingsAIStudio</h2>
              <p className="text-xs lg:text-sm text-gray-600">AI 영상 자동 제작</p>
            </div>

            {/* Navigation */}
            <nav className="space-y-1">
              {sidebarItems.map((item, index) => {
              const Icon = item.icon
              const itemIsActive = isStepActive(item.id)
                const stepNumber = index + 1

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveStep(item.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all relative ${
                      itemIsActive
                        ? "bg-red-50 text-red-600 border-l-4 border-red-500"
                        : "hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isStepCompleted(item.id) ? (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-green-500 text-white flex-shrink-0">
                          <Check className="w-4 h-4" />
                    </div>
                      ) : (
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                            itemIsActive ? "bg-red-500 text-white" : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {stepNumber}
                      </div>
                      )}
                      <span className="font-medium text-sm">{item.title}</span>
                  </div>
                </button>
              )
            })}
          </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-gray-50 order-1 lg:order-2">
          <div className="p-4 md:p-6 lg:p-8">
            {/* Content */}
            <div className="max-w-5xl mx-auto">{renderStepContent()}</div>
          </div>
        </main>
      </div>

      {isExporting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>영상 내보내기</CardTitle>
              {/* <CardDescription>{exportStatus}</CardDescription> */}
            </CardHeader>
            <CardContent>
              {/* <Progress value={exportProgress} className="w-full" /> */}
              {/* <p className="text-sm text-muted-foreground mt-2 text-center">{exportProgress}%</p> */}
              <p className="text-center text-muted-foreground">영상 생성 중...</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 푸터 - 저작권 문구 */}
      <footer className="border-t border-slate-200/50 bg-white/80 backdrop-blur-sm mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-900">© 2025 wingsAIStudio. All Rights Reserved.</p>
            <p>
              <strong>저작권 보호:</strong> 본 소프트웨어의 코드, 알고리즘, 프롬프트 엔지니어링, 비즈니스 로직은 저작권법에 의해 보호받습니다. 
              무단 복제, 배포, 수정, 리버스 엔지니어링, 벤치마킹, 모방을 엄격히 금지합니다.
            </p>
            <p className="text-red-600 font-medium">
              ⚠️ 본 소프트웨어를 분석하거나 따라하는 행위는 저작권 침해에 해당하며 법적 처벌을 받을 수 있습니다.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

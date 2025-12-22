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
  Search,
  RefreshCw,
  Plus,
  Key,
  Eye,
  EyeOff,
  Square,
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
  extractTopicFromScript, // 대본에서 주제 추출 함수 import 추가
  summarizeScriptForShorts, // 쇼츠 대본 요약 함수 import 추가
  generateHookingVideoPrompt, // 후킹 영상 프롬프트 생성 함수 import 추가
  // generateCommonStylePrompt, // 공통 스타일 프롬프트 생성 함수 import 추가 (임시 주석 처리)
} from "./actions"
import { generateRefinedScript, decomposeScriptIntoScenes, decomposeSingleScene, autoSplitScriptByMeaning } from "./refined-script-actions"
import { generateSceneImagePrompts, generateSingleSceneImagePrompts, extractHistoricalContext } from "./scene-prompt-actions"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getApiKey } from "@/lib/api-keys"
import { generateShortsHookingTitle } from "../shorts/actions"
import { getProjects, createProject, updateProject, deleteProject, getProject, type LongformProject, type ProjectData } from "./project-actions"
import { Trash2, Folder, FolderPlus, Save } from "lucide-react"

// <-- FFmpeg imports 제거 -->

// 이미지를 분석하여 스타일 프롬프트를 생성하는 함수 (Gemini API 사용)
const analyzeImageForStyle = async (base64Image: string, imageType: "character" | "background" | "art-style", geminiApiKey: string): Promise<string> => {
  // base64 이미지에서 data URL prefix 제거 (Gemini API는 순수 base64만 필요)
  const base64Data = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image
  
  const systemInstruction = imageType === "character" 
    ? `You are an expert image style analyzer specializing in character design. Analyze the uploaded character image in extreme detail and create a comprehensive English prompt that describes the character's visual style, appearance, and design elements. The prompt should be detailed enough to recreate similar characters in image generation.

Focus on:
- Character design style (cartoon, realistic, anime, etc.)
- Facial features and expressions
- Body proportions and pose
- Clothing and accessories
- Color palette and shading style
- Art style and rendering technique
- Any unique visual characteristics

Output only the English prompt, no explanations or additional text.`
    : imageType === "art-style"
    ? `You are an expert image style analyzer specializing in art style and visual aesthetics. Analyze the uploaded image in extreme detail and extract ONLY the art style, visual style, rendering technique, and artistic characteristics. Focus exclusively on the artistic style elements that can be applied to other images, NOT the specific content, characters, or objects in the image.

Focus ONLY on:
- Art style (cartoon, realistic, anime, watercolor, oil painting, digital art, etc.)
- Rendering technique (cel-shading, soft shading, flat colors, etc.)
- Color palette and color treatment
- Line art style (thick lines, thin lines, no lines, etc.)
- Visual texture and surface treatment
- Lighting style and mood
- Overall artistic aesthetic and visual approach

DO NOT describe:
- Specific characters, objects, or content
- Scene composition or layout
- Background details
- Narrative elements

Output only the English art style prompt, no explanations or additional text.`
    : `You are an expert image style analyzer specializing in background and environment design. Analyze the uploaded background image in extreme detail and create a comprehensive English prompt that describes the background's visual style, atmosphere, and design elements. The prompt should be detailed enough to recreate similar backgrounds in image generation.

Focus on:
- Environment type and setting
- Color palette and mood
- Lighting and atmosphere
- Art style and rendering technique
- Composition and perspective
- Textures and details
- Any unique visual characteristics

Output only the English prompt, no explanations or additional text.`

  const userPrompt = imageType === "character"
    ? "Analyze this character image in extreme detail and create a comprehensive English prompt describing the character's visual style and design."
    : imageType === "art-style"
    ? "Analyze this image and extract ONLY the art style, visual style, and rendering technique. Describe the artistic style elements that can be applied to other images, focusing on style characteristics rather than specific content."
    : "Analyze this background image in extreme detail and create a comprehensive English prompt describing the background's visual style and atmosphere."

  // 서버 API 라우트를 통해 호출 (API 키 노출 방지)
  const response = await fetch("/api/gemini/generate-content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            {
              text: `${systemInstruction}\n\n${userPrompt}`,
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1000,
      },
      apiKey: geminiApiKey,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorData.error || errorData.details || "알 수 없는 오류"}`)
  }

  const data = await response.json()
  const prompt = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!prompt) {
    throw new Error("프롬프트 생성에 실패했습니다.")
  }

  const trimmedPrompt = prompt.trim()
  
  // Gemini 안전 필터 응답 확인
  if (trimmedPrompt.toLowerCase().includes("i'm sorry") || 
      trimmedPrompt.toLowerCase().includes("can't help") ||
      trimmedPrompt.toLowerCase().includes("cannot help") ||
      trimmedPrompt.toLowerCase().includes("unable to")) {
    throw new Error("이미지 분석에 실패했습니다. 다른 이미지를 시도해주세요.")
  }

  return trimmedPrompt
}

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
          AI가 {type === "장면을 분해하고" ? "장면을 분해하고 있습니다" : type === "영상 미리보기" ? "편집을 하고있습니다" : type === "맞춤 주제" ? `${type}를 생성하고 있습니다` : `${type}을 생성하고 있습니다`}
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
  { id: "planning", title: "대본 기획", icon: FileText, description: "선택한 주제 기반 대본 구조 설계" },
  { id: "script", title: "대본 생성", icon: Wand2, description: "20분 분량의 대본 자동 생성" },
  { id: "image", title: "이미지 생성", icon: User, description: "한국 인물 생성" },
  { id: "video", title: "TTS 생성", icon: Volume2, description: "텍스트를 음성으로 변환" },
  { id: "render", title: "영상 렌더링", icon: Video, description: "이미지 + 음성 + 자막 합성" },
  { id: "title", title: "제목/설명 생성", icon: Type, description: "최적화된 유튜브 제목 자동 생성" },
  { id: "thumbnail", title: "썸네일 생성기", icon: ImageIcon, description: "클릭률 높은 썸네일 디자인 생성" },
  { id: "shorts", title: "쇼츠 생성기", icon: Scissors, description: "롱폼 대본을 쇼츠 영상으로 변환" },
  // { id: "hooking-video", title: "후킹 영상 프롬프트", icon: Plus, description: "소라2용 30초 후킹 영상 프롬프트 생성", isSpecial: true }, // 비활성화
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
  
  // 프로젝트 관리 상태
  const [projects, setProjects] = useState<LongformProject[]>([])
  const [currentProject, setCurrentProject] = useState<LongformProject | null>(null)
  const [showProjectList, setShowProjectList] = useState(true) // 프로젝트 목록 화면 표시 여부
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false)
  const [userId, setUserId] = useState<string>("") // 사용자 ID (이메일 또는 사용자 식별자)
  
  // API 키 가져오기 헬퍼 함수
  const getApiKey = (keyName?: string) => {
    if (typeof window === "undefined") return undefined
    if (keyName) {
      return localStorage.getItem(keyName) || undefined
    }
    return localStorage.getItem("openai_api_key") || undefined
  }
  
  // Gemini API 키 가져오기 헬퍼 함수
  const getGeminiApiKey = () => {
    if (typeof window === "undefined") return undefined
    return localStorage.getItem("gemini_api_key") || undefined
  }
  
  // 사용자 ID 가져오기 (카카오 로그인 사용자 정보)
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch("/api/kakao/user")
        const data = await response.json()
        
        if (data.loggedIn && data.user) {
          // 카카오 로그인 사용자: 이메일 우선, 없으면 ID 사용
          const userIdentifier = data.user.email || `kakao_${data.user.id}`
          setUserId(userIdentifier)
          console.log("[Projects] 로그인한 사용자:", userIdentifier)
        } else {
          // 로그인하지 않은 경우: 로컬 스토리지 또는 기본값
          const storedUserId = localStorage.getItem("user_id") || localStorage.getItem("user_email") || "anonymous"
          setUserId(storedUserId)
          console.log("[Projects] 로그인하지 않음, 기본 사용자:", storedUserId)
        }
      } catch (error) {
        console.error("[Projects] 사용자 정보 조회 실패:", error)
        // 에러 발생 시 기본값 사용
        const storedUserId = localStorage.getItem("user_id") || localStorage.getItem("user_email") || "anonymous"
        setUserId(storedUserId)
      }
    }
    
    fetchUserInfo()
  }, [])
  const [keywords, setKeywords] = useState("")
  const [selectedTopic, setSelectedTopic] = useState("")
  const [generatedTopics, setGeneratedTopics] = useState<string[]>([])
  const [trendingTopics, setTrendingTopics] = useState<Array<{ title: string; videoId: string }>>([])
  const [isLoadingTrending, setIsLoadingTrending] = useState(false)
  const [selectedTrendingVideoId, setSelectedTrendingVideoId] = useState<string | null>(null)
  const [crawledNews, setCrawledNews] = useState<Array<{ title: string; link: string; description: string }>>([])
  const [isCrawlingNews, setIsCrawlingNews] = useState(false)
  const [customTopic, setCustomTopic] = useState("")
  const [isCustomTopicSelected, setIsCustomTopicSelected] = useState(false)
  const [isDirectInputSelected, setIsDirectInputSelected] = useState(false) // 직접입력 선택 여부
  const [benchmarkScript, setBenchmarkScript] = useState("") // 벤치마킹 대본
  const [isDirectScriptInput, setIsDirectScriptInput] = useState(false) // 대본 직접 넣기 모드
  const [directScript, setDirectScript] = useState("") // 직접 입력한 대본
  const [isStoryMode, setIsStoryMode] = useState(false) // 스토리 형태 모드 (false = 교훈형, true = 스토리형)
  const [script, setScript] = useState("")
  const [decomposedScenes, setDecomposedScenes] = useState("") // 장면 분해 결과
  const [scriptLines, setScriptLines] = useState<Array<{ id: number; text: string }>>([])
  const [sceneImagePrompts, setSceneImagePrompts] = useState<Array<{ sceneNumber: number; images: Array<{ imageNumber: number; prompt: string; sceneText: string; visualInstruction?: string; imageUrl?: string }> }>>([]) // Scene별 이미지 프롬프트
  const [isGeneratingScenePrompts, setIsGeneratingScenePrompts] = useState(false) // Scene 프롬프트 생성 중
  const [scenePromptProgress, setScenePromptProgress] = useState<{ current: number; total: number } | null>(null) // 이미지 프롬프트 생성 진행률
  const [isGeneratingSceneImages, setIsGeneratingSceneImages] = useState(false) // Scene 이미지 생성 중
  const [sceneImageGenerationProgress, setSceneImageGenerationProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 }) // Scene 이미지 생성 진행도
  const [generatingImageIds, setGeneratingImageIds] = useState<Set<string>>(new Set()) // 개별 이미지 생성 중인 ID들 (형식: "sceneNumber-imageNumber")
  const shouldStopImageGeneration = useRef(false) // 이미지 생성 중단 플래그
  const [selectedLineIds, setSelectedLineIds] = useState<Set<number>>(new Set())
  const [scriptDuration, setScriptDuration] = useState<number>(20) // 대본 시간 (분)
  const [generatedImages, setGeneratedImages] = useState<Array<{ lineId: number; imageUrl: string; prompt: string }>>([])
  const [isGeneratingImages, setIsGeneratingImages] = useState(false)
  const [imageGenerationProgress, setImageGenerationProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("ttsmaker-여성1") // 기본: TTSMaker 여성1
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null)
  const [generatedAudios, setGeneratedAudios] = useState<Array<{ lineId: number; audioUrl: string; audioBase64: string; alignment?: any }>>([])
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false)
  const [generatingTTSForLine, setGeneratingTTSForLine] = useState<Set<number>>(new Set()) // 개별 문장 TTS 생성 중인 문장 ID 추적
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
  const [scriptGenerationProgress, setScriptGenerationProgress] = useState<{ progress: number; elapsedTime: number; estimatedTime: number } | null>(null) // 정교한 대본 생성 진행률
  const [isDecomposingScenes, setIsDecomposingScenes] = useState(false) // 장면 분해 중 상태
  const [sceneDecompositionProgress, setSceneDecompositionProgress] = useState<{ current: number; total: number; progress: number; elapsedTime: number; estimatedTime: number } | null>(null) // 장면 분해 진행률
  const [maxScenesPerScene, setMaxScenesPerScene] = useState<1 | 2 | 3>(3) // 씬당 최대 장면 개수
  const [isSplittingScenes, setIsSplittingScenes] = useState(false) // 씬 나누기 중 상태
  const [isScanning, setIsScanning] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [improvementRequest, setImprovementRequest] = useState("")
  const [analysisResult, setAnalysisResult] = useState("")
  const [showDirectScriptInput, setShowDirectScriptInput] = useState(false)
  const [selectedDoctorType, setSelectedDoctorType] = useState<"clinic" | "podcast" | "custom">("clinic")
  const [customDescription, setCustomDescription] = useState("")
  const [doctorKoreanDescription, setDoctorKoreanDescription] = useState("")
  const [userTtsApiKey, setUserTtsApiKey] = useState("")
  const [selectedVoice] = useState("ko-KR-Neural2-B")
  const [videoData, setVideoData] = useState<{
    audioUrl: string
    subtitles: Array<{ id: number; start: number; end: number; text: string }>
    duration: number
    videoUrl?: string // 렌더링된 영상 URL (GCS 또는 Cloud Run)
    autoImages?: Array<{
      id: string
      url: string
      startTime: number
      endTime: number
      keyword: string
      motion?: string
    }>
  } | null>(null)
  const videoDataRef = useRef(videoData) // 최신 videoData 참조용
  
  // videoData가 변경될 때마다 ref 업데이트
  useEffect(() => {
    videoDataRef.current = videoData
  }, [videoData])

  // 설정 다이얼로그 상태
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [apiKeys, setApiKeys] = useState({
    openai: "",
    elevenlabs: "",
    replicate: "",
    gemini: "",
    ttsmaker: "",
  })
  const [showKeys, setShowKeys] = useState({
    openai: false,
    elevenlabs: false,
    replicate: false,
    gemini: false,
    ttsmaker: false,
  })
  const [saved, setSaved] = useState(false)
  
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [currentSubtitle, setCurrentSubtitle] = useState("")
  const [showSubtitles, setShowSubtitles] = useState(true) // 자막 표시 여부 (기본값: true)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)
  const [audioTrackElements, setAudioTrackElements] = useState<Map<string, HTMLAudioElement>>(new Map()) // 효과음 및 배경음악 오디오 요소
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([])
  const [selectedTitle, setSelectedTitle] = useState<string>("")
  const [customTitle, setCustomTitle] = useState("")
  const [referenceTitle, setReferenceTitle] = useState("")
  const [referenceScript, setReferenceScript] = useState("") // 레퍼런스 대본
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false)
  const [thumbnailText, setThumbnailText] = useState<string[]>([])
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false)
  const [thumbnailMode, setThumbnailMode] = useState<"manual" | "ai">("manual") // 썸네일 생성 모드
  const [aiThumbnailUrl, setAiThumbnailUrl] = useState<string | null>(null) // AI 생성 썸네일 URL
  const [isGeneratingAIThumbnail, setIsGeneratingAIThumbnail] = useState(false) // AI 썸네일 생성 중 상태
  const [selectedThumbnailTemplate, setSelectedThumbnailTemplate] = useState<string | null>(null) // 선택된 썸네일 템플릿
  const [thumbnailCustomText, setThumbnailCustomText] = useState<string>("") // 썸네일 커스텀 문구
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
  const [showAutomationSettingsDialog, setShowAutomationSettingsDialog] = useState(false) // 자동화 설정 팝업 표시
  const [youtubeConnected, setYoutubeConnected] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [finalTitle, setFinalTitle] = useState<string>("")
  const [finalDescription, setFinalDescription] = useState<string>("")
  
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
  const [hookingVideoPrompt, setHookingVideoPrompt] = useState<string>("") // 후킹 영상 프롬프트
  const [isGeneratingHookingPrompt, setIsGeneratingHookingPrompt] = useState(false) // 후킹 영상 프롬프트 생성 중
  const [isGeneratingShortsTitle, setIsGeneratingShortsTitle] = useState(false) // 쇼츠 제목 생성 중
  const [shortsTtsAudioUrl, setShortsTtsAudioUrl] = useState<string>("") // 쇼츠 TTS 오디오 URL
  const [isGeneratingShortsTts, setIsGeneratingShortsTts] = useState(false) // 쇼츠 TTS 생성 중
  const [shortsVideoUrl, setShortsVideoUrl] = useState<string>("") // 쇼츠 영상 URL
  const [isRenderingShorts, setIsRenderingShorts] = useState(false) // 쇼츠 영상 렌더링 중
  const shortsCanvasRef = useRef<HTMLCanvasElement>(null) // 쇼츠 캔버스 ref
  const thumbnailPreviewRef = useRef<HTMLDivElement>(null) // 썸네일 미리보기 ref
  const shortsVideoRef = useRef<HTMLVideoElement>(null) // 쇼츠 비디오 ref
  const shortsAnimationFrameRef = useRef<number | null>(null) // 쇼츠 애니메이션 프레임 ref
  const shortsPreviewAudio = useRef<HTMLAudioElement | null>(null) // 쇼츠 미리보기 오디오 ref
  const [isPlayingShorts, setIsPlayingShorts] = useState(false) // 쇼츠 재생 중
  const [shortsCurrentTime, setShortsCurrentTime] = useState(0) // 쇼츠 현재 시간
  const [testImageFile, setTestImageFile] = useState<File | null>(null) // 테스트용 이미지 파일

  // 상태 저장 (localStorage에 저장, 새로고침 시에만 초기화)
  useEffect(() => {
    // 새로고침 플래그 확인
    const isRefresh = sessionStorage.getItem("longform_refresh_flag")
    if (isRefresh) {
      // 새로고침이면 초기화하고 플래그 제거
      sessionStorage.removeItem("longform_refresh_flag")
      localStorage.removeItem("longform_state")
      return
    }

    // 상태 저장 (audioBase64는 용량이 크므로 제외하고 audioUrl만 저장)
    const stateToSave = {
      activeStep,
      keywords,
      selectedTopic,
      generatedTopics,
      script,
      scriptLines,
      sceneImagePrompts,
      generatedImages,
      // audioBase64는 용량이 크므로 localStorage에 저장하지 않음 (audioUrl만 저장)
      generatedAudios: generatedAudios.map(audio => ({
        lineId: audio.lineId,
        audioUrl: audio.audioUrl,
        // audioBase64 제외
        alignment: audio.alignment,
      })),
      videoData,
      selectedVoiceId,
      youtubeTitle,
      youtubeDescription,
      thumbnailText,
      selectedTitle,
      customTitle,
      scriptPlan,
      scriptDraft,
    }
    
    try {
      localStorage.setItem("longform_state", JSON.stringify(stateToSave))
    } catch (error) {
      // localStorage 용량 초과 시 에러 처리
      if (error instanceof Error && error.name === "QuotaExceededError") {
        console.warn("[localStorage] 용량 초과로 상태 저장 실패. 일부 데이터를 제외하고 저장합니다.")
        // 더 작은 버전으로 저장 시도 (generatedImages도 제외)
        const minimalState = {
          activeStep,
          keywords,
          selectedTopic,
          generatedTopics,
          script,
          scriptLines,
          sceneImagePrompts,
          // generatedImages 제외 (이미지 URL만 저장)
          generatedImages: generatedImages.map(img => ({
            lineId: img.lineId,
            imageUrl: img.imageUrl,
            prompt: img.prompt,
          })),
          generatedAudios: generatedAudios.map(audio => ({
            lineId: audio.lineId,
            audioUrl: audio.audioUrl,
            alignment: audio.alignment,
          })),
          videoData,
          selectedVoiceId,
          youtubeTitle,
          youtubeDescription,
          thumbnailText,
          selectedTitle,
          customTitle,
          scriptPlan,
          scriptDraft,
        }
        try {
          localStorage.setItem("longform_state", JSON.stringify(minimalState))
        } catch (retryError) {
          console.error("[localStorage] 최소 상태 저장도 실패:", retryError)
        }
      } else {
        throw error
      }
    }
  }, [
    activeStep,
    keywords,
    selectedTopic,
    generatedTopics,
    script,
    scriptLines,
    sceneImagePrompts,
    generatedImages,
    generatedAudios,
    videoData,
    selectedVoiceId,
    youtubeTitle,
    youtubeDescription,
    thumbnailText,
    selectedTitle,
    customTitle,
    scriptPlan,
    scriptDraft,
  ])

  // 상태 복원 (컴포넌트 마운트 시)
  useEffect(() => {
    // 새로고침 플래그가 없으면 복원
    const isRefresh = sessionStorage.getItem("longform_refresh_flag")
    if (isRefresh) {
      return
    }

    const savedState = localStorage.getItem("longform_state")
    if (savedState) {
      try {
        const state = JSON.parse(savedState)
        if (state.activeStep) setActiveStep(state.activeStep)
        if (state.keywords) setKeywords(state.keywords)
        if (state.selectedTopic) setSelectedTopic(state.selectedTopic)
        if (state.generatedTopics) setGeneratedTopics(state.generatedTopics)
        if (state.script) setScript(state.script)
        if (state.scriptLines) setScriptLines(state.scriptLines)
        if (state.sceneImagePrompts) setSceneImagePrompts(state.sceneImagePrompts)
        if (state.generatedImages) setGeneratedImages(state.generatedImages)
        if (state.generatedAudios) setGeneratedAudios(state.generatedAudios)
        if (state.videoData) setVideoData(state.videoData)
        if (state.selectedVoiceId) setSelectedVoiceId(state.selectedVoiceId)
        if (state.youtubeTitle) setYoutubeTitle(state.youtubeTitle)
        if (state.youtubeDescription) setYoutubeDescription(state.youtubeDescription)
        if (state.thumbnailText) setThumbnailText(state.thumbnailText)
        if (state.selectedTitle) setSelectedTitle(state.selectedTitle)
        if (state.customTitle) setCustomTitle(state.customTitle)
        if (state.scriptPlan) setScriptPlan(state.scriptPlan)
        if (state.scriptDraft) setScriptDraft(state.scriptDraft)
      } catch (error) {
        console.error("상태 복원 실패:", error)
      }
    }
  }, [])

  // 새로고침 감지
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem("longform_refresh_flag", "true")
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [])

  // API 키 로드
  useEffect(() => {
    const storedOpenAI = localStorage.getItem("openai_api_key") || ""
    const storedElevenLabs = localStorage.getItem("elevenlabs_api_key") || ""
    const storedReplicate = localStorage.getItem("replicate_api_key") || ""
    const storedGemini = localStorage.getItem("gemini_api_key") || ""
    const storedTTSMaker = localStorage.getItem("ttsmaker_api_key") || ""

    setApiKeys({
      openai: storedOpenAI,
      elevenlabs: storedElevenLabs,
      replicate: storedReplicate,
      gemini: storedGemini,
      ttsmaker: storedTTSMaker,
    })
  }, [])

  // API 키 저장
  const handleSaveApiKeys = () => {
    localStorage.setItem("openai_api_key", apiKeys.openai)
    localStorage.setItem("elevenlabs_api_key", apiKeys.elevenlabs)
    localStorage.setItem("replicate_api_key", apiKeys.replicate)
    localStorage.setItem("gemini_api_key", apiKeys.gemini)
    localStorage.setItem("ttsmaker_api_key", apiKeys.ttsmaker)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
    }, 2000)
  }
  const [testImageUrl, setTestImageUrl] = useState<string | null>(null) // 테스트용 이미지 URL
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  
  // 이미지 스타일 선택
  const [imageStyle, setImageStyle] = useState<string>("stickman-animation")
  const [hoveredStyle, setHoveredStyle] = useState<string | null>(null)
  // 실사화 인물 타입 선택 (한국인/외국인)
  const [realisticCharacterType, setRealisticCharacterType] = useState<"korean" | "foreign" | null>(null)
  
  // 샘플 이미지 URL 매핑 (ImgBB 직접 이미지 링크)
  // ImgBB 페이지 URL: https://ibb.co/{hash} -> 직접 이미지 URL: https://i.ibb.co/{hash}/{filename}.{ext}
  const styleSampleImages: Record<string, string> = {
    "animation2": "https://i.ibb.co/cSzvWRYJ/image.jpg",
    "animation3": "https://i.ibb.co/9m9XZX8B/image.jpg",
    "realistic": "https://i.ibb.co/sd4GV7WY/image.jpg",
    "realistic2": "https://i.ibb.co/0Rwj4wBW/image.jpg",
    "stickman-animation": "https://i.ibb.co/LXYjHLVz/image.jpg",
  }
  
  // 커스텀 이미지 스타일 생성 상태
  const [customStyleCharacterImage, setCustomStyleCharacterImage] = useState<string | null>(null) // 캐릭터 사진
  const [customStyleBackgroundImage, setCustomStyleBackgroundImage] = useState<string | null>(null) // 배경 풍경
  const [customStyleBackgroundText, setCustomStyleBackgroundText] = useState<string>("") // 배경 풍경 텍스트 (이미 스타일 프롬프트를 가지고 있는 경우)
  const [customStyleResult, setCustomStyleResult] = useState<string | null>(null) // 생성된 커스텀 스타일 (이미지 URL)
  const [customStylePrompt, setCustomStylePrompt] = useState<string | null>(null) // 생성된 커스텀 스타일 프롬프트
  const [isGeneratingCustomStyle, setIsGeneratingCustomStyle] = useState(false) // 커스텀 스타일 생성 중
  
  // 이미지 커스텀 생성 상태
  const [customImageDialogOpen, setCustomImageDialogOpen] = useState<number | null>(null)
  const [customImagePrompt, setCustomImagePrompt] = useState("")
  const [isGeneratingCustomImage, setIsGeneratingCustomImage] = useState(false)
  const [audioExportDialogOpen, setAudioExportDialogOpen] = useState(false)
  const [hoveredImageId, setHoveredImageId] = useState<number | null>(null)
  const [selectedImagesForVideo, setSelectedImagesForVideo] = useState<Set<number>>(new Set()) // 영상으로 변환할 이미지 선택
  const [isConvertingToVideo, setIsConvertingToVideo] = useState(false) // 영상 변환 중 상태
  const [convertedVideos, setConvertedVideos] = useState<Map<number, string>>(new Map()) // 변환된 영상 URL 저장
  const [convertedSceneVideos, setConvertedSceneVideos] = useState<Map<string, string>>(new Map()) // Scene 이미지 변환된 영상 URL 저장 (key: "sceneNumber-imageNumber")
  const [isConvertingSceneVideo, setIsConvertingSceneVideo] = useState<Set<string>>(new Set()) // Scene 이미지 영상 변환 중 상태 (key: "sceneNumber-imageNumber")
  
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
  // 틈새 주제 검색어
  const [nicheCategorySearch, setNicheCategorySearch] = useState("")

  const isStepActive = (stepId: string) => activeStep === stepId
  const isStepCompleted = (stepId: string) => completedSteps.includes(stepId)

  // 영상 생성 버튼 활성화 상태 디버깅
  useEffect(() => {
    const hasSceneImages = sceneImagePrompts.length > 0 && sceneImagePrompts.some(s => 
      s.images && s.images.some(img => img.imageUrl)
    )
    const hasRegularImages = generatedImages.length > 0
    const hasImages = hasSceneImages || hasRegularImages
    const hasAudios = generatedAudios.length > 0
    
    console.log("[영상 생성 버튼] 상태 변경 감지:", {
      activeStep,
      hasSceneImages,
      hasRegularImages,
      hasImages,
      hasAudios,
      generatedAudiosLength: generatedAudios.length,
      sceneImagePromptsLength: sceneImagePrompts.length,
      sceneImagePromptsDetails: sceneImagePrompts.map(s => ({
        sceneNumber: s.sceneNumber,
        images: s.images?.map(img => ({ imageNumber: img.imageNumber, hasUrl: !!img.imageUrl })) || [],
      })),
      canActivate: hasImages && hasAudios,
    })
  }, [activeStep, sceneImagePrompts, generatedImages, generatedAudios])

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
      const youtubeDataApiKey = getApiKey("wings_youtube_data_api_key")
      // 실제 인기 주제 불러오기
      const trending = await generateTrendingTopics(selectedCategory, youtubeDataApiKey)
      // 호환성 유지: item이 객체거나 문자열일 수 있으므로 변환
      const normalizedTrending = trending.map((item: any) => {
        if (typeof item === 'object' && item !== null && 'title' in item && 'videoId' in item) {
          return { title: item.title, videoId: item.videoId }
        }
        // 문자열인 경우 (이전 버전 호환성)
        if (typeof item === 'string') {
          console.warn("generateTrendingTopics가 문자열 배열을 반환했습니다. videoId가 없습니다.")
          return { title: item, videoId: "" }
        }
        // 그 외는 무시
        // generateTrendingTopics가 문자열, 객체, 혹은 예외 값(null/undefined 등)을 반환할 수 있으니
        // 타입 가드를 명확히 해서 title, videoId가 정상적인 것만 필터링함
        }).filter(
          (item: any): item is { title: string; videoId: string } =>
            item &&
            typeof item === "object" &&
            typeof item.title === "string" &&
            typeof item.videoId === "string"
        );
        setTrendingTopics(normalizedTrending);
      } catch (error) {
        console.error("인기 주제 로드 실패:", error);
        setTrendingTopics([]);
        alert("인기 주제를 불러오는데 실패했습니다.");
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
      
      const geminiApiKey = getGeminiApiKey()
      if (!geminiApiKey) {
        alert("Gemini API 키를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
        return
      }
      const planResult = await generateScriptPlan(selectedTopic, selectedCategory, undefined, geminiApiKey, autoDurationMinutes, referenceScript || undefined) // 자동화 모드는 기본 교훈형
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
      
      const draftResult = await generateScriptDraft(planResult, selectedTopic, apiKey, selectedCategory, isStoryMode)
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
        targetChars,
        selectedCategory,
        isStoryMode
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
      let localAudioResults: Array<{ lineId: number; audioUrl: string; audioBase64: string; alignment?: any }> = []

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
            
            // 재시도 로직이 포함된 이미지 생성 (생성될 때까지 계속 시도)
            let imageUrl: string | null = null
            let attempt = 1
            
            while (!imageUrl) {
              try {
                console.log(`[자동화] 이미지 생성 시도 ${attempt}...`)
                imageUrl = await generateImageWithReplicate(prompt, replicateApiKey, "16:9", imageStyle)
                console.log(`[자동화] 이미지 생성 완료 (시도 ${attempt}): ${imageUrl.substring(0, 50)}...`)
                break // 성공하면 루프 종료
              } catch (error) {
                console.error(`[자동화] 이미지 생성 재시도 ${attempt} 실패:`, error)
                attempt++
                // 재시도 전 대기 (지수 백오프, 최대 10초)
                const delay = Math.min(1000 * attempt, 10000)
                console.log(`[자동화] ${delay}ms 후 재시도...`)
                await new Promise(resolve => setTimeout(resolve, delay))
              }
            }
            
            if (imageUrl) {
              localImageResults.push({ lineId: line.id, imageUrl, prompt })
              setGeneratedImages([...localImageResults])
              successCount++
            }
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
      // TTSMaker는 API 키 필요, ElevenLabs인 경우만 필요
      if (selectedVoiceId?.startsWith("ttsmaker-") || elevenlabsApiKey) {
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
            
            // 재시도 로직이 포함된 TTS 생성
            const data = await generateTTSWithRetry(line, selectedVoiceId)
            
            localAudioResults.push({
              lineId: line.id,
              audioUrl: data.audioUrl,
              audioBase64: data.audioBase64 || "",
            })
            setGeneratedAudios([...localAudioResults])
            ttsSuccessCount++
            console.log(`[자동화] TTS 생성 완료 (${i + 1}/${sentences.length})`)
          } catch (error) {
            console.error(`[자동화] TTS 생성 최종 실패 (문장 ${line.id}):`, error)
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
          const audioDurations: Array<{ lineId: number; duration: number; audioBuffer?: AudioBuffer; alignment?: any }> = []
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
                audioDurations.push({ 
                  lineId: line.id, 
                  duration: audioBuffer.duration, 
                  audioBuffer,
                  alignment: audio.alignment || undefined // alignment 데이터 포함
                })
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
            
            // 단어들을 묶어서 자막 라인 생성 (공백 포함 최대 20자)
            let currentLine: string[] = []
            let lineStartTime = 0
            const maxChars = 20 // 공백 포함 20자까지
            
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
            const alignment = audioData?.alignment
            
            if (audioDuration > 0) {
              // ElevenLabs alignment가 있으면 정확한 타이밍 사용
              if (alignment && selectedVoiceId && !selectedVoiceId.startsWith("ttsmaker-")) {
                try {
                  const geminiApiKey = getGeminiApiKey()
                  if (geminiApiKey) {
                    // 의미 단위 세그먼트 생성
                    const semanticSegments = await generateSemanticSegments(line.text, geminiApiKey)
                    // alignment와 세그먼트 매칭하여 정확한 타이밍 계산
                    const phrases = alignmentToPhrases(alignment, 20, semanticSegments)
                    
                    // 각 자막 생성 (alignment 기반 정확한 타이밍)
                    for (const phrase of phrases) {
                      const start = subtitleTime + phrase.start
                      const end = subtitleTime + phrase.end

                      subtitles.push({
                        id: subtitleId++,
                        start: Number.parseFloat(start.toFixed(3)),
                        end: Number.parseFloat(end.toFixed(3)),
                        text: phrase.text
                      })
                    }
                  } else {
                    // Gemini API 키가 없으면 기존 방식 사용
              const subtitleLines = splitIntoSubtitleLines(line.text, audioBuffer, audioDuration)
                    for (let j = 0; j < subtitleLines.length; j++) {
                      const subtitleLine = subtitleLines[j]
                      const start = subtitleTime + subtitleLine.startTime
                      const end = subtitleTime + subtitleLine.endTime

                      subtitles.push({
                        id: subtitleId++,
                        start: Number.parseFloat(start.toFixed(3)),
                        end: Number.parseFloat(end.toFixed(3)),
                        text: subtitleLine.text
                      })
                    }
                  }
                } catch (error) {
                  console.error(`[자막 생성] alignment 사용 실패 (줄 ${line.id}), 기존 방식 사용:`, error)
                  // 실패 시 기존 방식 사용
                  const subtitleLines = splitIntoSubtitleLines(line.text, audioBuffer, audioDuration)
              for (let j = 0; j < subtitleLines.length; j++) {
                const subtitleLine = subtitleLines[j]
                const start = subtitleTime + subtitleLine.startTime
                const end = subtitleTime + subtitleLine.endTime

                subtitles.push({
                  id: subtitleId++,
                      start: Number.parseFloat(start.toFixed(3)),
                  end: Number.parseFloat(end.toFixed(3)),
                  text: subtitleLine.text
                })
                  }
                }
              } else {
                // alignment가 없거나 ElevenLabs가 아니면 기존 방식 사용
                const subtitleLines = splitIntoSubtitleLines(line.text, audioBuffer, audioDuration)
                
                for (let j = 0; j < subtitleLines.length; j++) {
                  const subtitleLine = subtitleLines[j]
                  const start = subtitleTime + subtitleLine.startTime
                  const end = subtitleTime + subtitleLine.endTime

                  subtitles.push({
                    id: subtitleId++,
                    start: Number.parseFloat(start.toFixed(3)),
                    end: Number.parseFloat(end.toFixed(3)),
                    text: subtitleLine.text
                  })
                }
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

            // 오디오를 base64로 변환 (원본 그대로 사용 - 압축하지 않음)
            const audioResponse = await fetch(audioUrl)
            const audioBlob = await audioResponse.blob()
            
            console.log("[자동화] 원본 오디오 크기:", Math.round(audioBlob.size / 1024), "KB")
            console.log("[자동화] 원본 오디오를 그대로 사용 (압축하지 않음)")
            
            // 원본 오디오를 그대로 base64로 변환 (압축하지 않음)
            const reader = new FileReader()
            let audioBase64 = await new Promise<string>((resolve) => {
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(",")[1]
                resolve(base64)
              }
              reader.readAsDataURL(audioBlob)
            })

            // Cloud Storage 사용 여부 결정 (20MB 이상이면 Cloud Storage 사용)
            const base64SizeMB = audioBase64.length / 1024 / 1024
            console.log("[자동화] 오디오 base64 변환 완료, 크기:", Math.round(base64SizeMB * 1024), "KB", `(${base64SizeMB.toFixed(2)}MB)`)
            
            const useCloudStorage = audioBase64.length > 20 * 1024 * 1024
            let audioGcsUrl: string | null = null
            
            if (useCloudStorage) {
              console.log("[자동화] 오디오가 큽니다. Cloud Storage에 업로드합니다...")
              
              try {
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
                console.log("[자동화] Cloud Storage 업로드 완료:", audioGcsUrl)
                
                // Cloud Storage 업로드 성공 시 base64는 빈 문자열로 설정 (전송하지 않음)
                audioBase64 = ""
              } catch (uploadError) {
                console.error("[자동화] Cloud Storage 업로드 실패:", uploadError)
                // 업로드 실패 시 경고만 표시하고 계속 진행 (base64로 전송 시도)
                console.warn("[자동화] Cloud Storage 업로드 실패, base64로 전송 시도")
              }
            }

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
                // Cloud Storage URL이 있으면 사용, 없으면 base64 사용
                ...(audioGcsUrl ? { audioGcsUrl } : { audioBase64 }),
                subtitles: subtitles.map((s) => ({
                  id: s.id,
                  // 자막 타이밍을 0.5초 앞당겨서 전달 (TTS와 동기화 개선)
                  start: Math.max(0, s.start - 0.5),
                  end: Math.max(0, s.end - 0.5),
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
            let videoUrlForUpload = ""

            // 방법 1: base64 데이터로 받은 경우
            if (renderResult.videoBase64) {
              console.log("[자동화] base64 데이터로 영상 다운로드")
              const binaryString = atob(renderResult.videoBase64)
              const bytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
              }
              videoBlob = new Blob([bytes], { type: "video/mp4" })
              // base64인 경우 blob URL 생성 (업로드 예약용)
              videoUrlForUpload = URL.createObjectURL(videoBlob)
              console.log("[자동화] base64 영상 blob URL 생성:", videoUrlForUpload)
            }
            // 방법 2: URL로 받은 경우
            else if (renderResult.videoUrl) {
              console.log("[자동화] URL로 영상 다운로드 시작:", renderResult.videoUrl)
              videoUrlForUpload = renderResult.videoUrl // GCS URL 사용
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

            // videoData에 videoUrl 저장 (업로드 예약용)
            // videoData가 이미 설정되어 있으므로 업데이트
            setVideoData((prev) => {
              if (prev && videoUrlForUpload) {
                const updated = {
                  ...prev,
                  videoUrl: videoUrlForUpload,
                }
                videoDataRef.current = updated // ref도 업데이트
                console.log("[자동화] videoData 업데이트 완료 - videoUrl:", videoUrlForUpload)
                return updated
              } else if (prev) {
                console.warn("[자동화] videoUrlForUpload가 없어서 videoData를 업데이트하지 않음:", videoUrlForUpload)
              } else {
                console.warn("[자동화] videoData가 null이어서 업데이트하지 않음")
              }
              return prev
            })
            
            console.log("[자동화] videoData에 videoUrl 저장 완료:", videoUrlForUpload)

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
      console.log("[자동화] 제목/설명 생성 완료:", description)
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
          // 캐릭터 정보 추출 (첫 번째 장면의 첫 번째 이미지 프롬프트에서)
          let characterDescription: string | undefined = undefined
          if (sceneImagePrompts.length > 0 && sceneImagePrompts[0].images && sceneImagePrompts[0].images.length > 0) {
            const firstImagePrompt = sceneImagePrompts[0].images[0].prompt
            const characterMatch = firstImagePrompt.match(/(?:A|An|The)\s+([a-zA-Z\s]+?)(?:\s+(?:looking|standing|sitting|wearing|with|in)|,|\.|$)/i)
            if (characterMatch && characterMatch[1]) {
              characterDescription = characterMatch[1].trim()
            } else {
              const promptWords = firstImagePrompt.split(',').slice(0, 2).join(',').trim()
              if (promptWords.length > 0 && promptWords.length < 100) {
                characterDescription = promptWords
              }
            }
          }
          
          console.log(`[자동화] AI 썸네일 생성 시작 - 주제: ${selectedTopic}`)
          const thumbnailUrl = await generateAIThumbnail(
            selectedTopic, 
            replicateApiKey, 
            imageStyle, 
            thumbnailCustomText.trim() || undefined,
            customStylePrompt || undefined,
            characterDescription
          )
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

      // 썸네일 생성 완료 후 자동 예약 실행 (자동화 모드이고 예약 날짜가 설정된 경우)
      if (workflowMode === "auto" && youtubeScheduleDate && youtubeScheduleTime) {
        // 제목과 설명을 미리 계산 (클로저 문제 방지)
        // 설명은 이미 Step 8에서 생성되었으므로 바로 사용
        const finalTitleValue = youtubeTitle || titles[0] || selectedTopic
        let finalDescriptionValue = ""
        
        // 설명 추출 (다양한 형식 지원)
        if (youtubeDescription) {
          if (typeof youtubeDescription === "string") {
            finalDescriptionValue = youtubeDescription
          } else if (youtubeDescription.description) {
            finalDescriptionValue = youtubeDescription.description
          }
        }
        
        // 설명이 없으면 기본 설명 생성
        if (!finalDescriptionValue || finalDescriptionValue.trim() === "") {
          console.warn("[자동화] 설명이 없어 기본 설명을 생성합니다.", {
            youtubeDescription,
            descriptionType: typeof youtubeDescription,
          })
          finalDescriptionValue = `이 영상은 "${finalTitleValue}"에 대한 내용입니다.\n\n시청해 주셔서 감사합니다!\n구독과 좋아요 부탁드립니다.`
        }
        
        const currentThumbnailUrl = aiThumbnailUrl
        
        console.log("[자동화] 썸네일 생성 완료 - 자동 예약 준비 중...", {
          finalTitleValue,
          finalDescriptionValue: finalDescriptionValue?.substring(0, 100) + "...",
          finalDescriptionLength: finalDescriptionValue?.length,
          hasThumbnail: !!currentThumbnailUrl,
          youtubeTitle,
          titlesLength: titles.length,
          selectedTopic,
          youtubeDescription,
          youtubeDescriptionType: typeof youtubeDescription,
        })
        
        // 제목과 설명이 있는지 확인
        if (!finalTitleValue || !finalDescriptionValue) {
          console.error("[자동화] 필수 데이터 누락:", {
            finalTitleValue,
            finalDescriptionValue,
            youtubeTitle,
            titles,
            selectedTopic,
            youtubeDescription,
          })
          alert(`자동 예약 실패: 제목 또는 설명이 없습니다.\n\n제목: ${finalTitleValue || "(없음)"}\n설명: ${finalDescriptionValue ? "(있음)" : "(없음)"}\n\n수동으로 예약해주세요.`)
        } else {
          // YouTube 토큰 확인
          const tokensStr = localStorage.getItem("youtube_tokens")
          let isYoutubeConnected = false
          if (tokensStr) {
            try {
              const tokens = JSON.parse(tokensStr)
              const expiresAt = new Date(tokens.expires_at)
              const now = new Date()
              isYoutubeConnected = !(expiresAt < now) && !!tokens.access_token
              console.log("[자동화] YouTube 연결 상태:", { isYoutubeConnected, expiresAt, now })
            } catch (e) {
              console.warn("[자동화] YouTube 토큰 확인 실패:", e)
            }
          } else {
            console.warn("[자동화] YouTube 토큰이 없습니다.")
          }
          
          if (isYoutubeConnected) {
            // videoData.videoUrl이 준비될 때까지 대기 후 자동 예약
            console.log("[자동화] videoUrl 대기 중...")
            
            let retryCount = 0
            const maxRetries = 40 // 최대 20초 대기 (40회 * 0.5초)
            const checkAndSchedule = setInterval(async () => {
              retryCount++
              
              // videoDataRef를 사용하여 최신 videoData 확인
              const currentVideoData = videoDataRef.current
              
              console.log(`[자동화] 자동 예약 확인 (${retryCount}/${maxRetries}):`, {
                hasVideoData: !!currentVideoData,
                hasVideoUrl: !!currentVideoData?.videoUrl,
                videoUrl: currentVideoData?.videoUrl?.substring(0, 50) + "...",
              })
              
              if ((currentVideoData?.videoUrl || retryCount >= maxRetries) && retryCount > 2) {
                clearInterval(checkAndSchedule)
                
                if (currentVideoData?.videoUrl) {
                  try {
                    const scheduledDateTime = new Date(`${youtubeScheduleDate}T${youtubeScheduleTime}`)
                    const scheduledTimeISO = scheduledDateTime.toISOString()
                    
                    // 예약 시간이 과거인지 확인
                    if (scheduledDateTime <= new Date()) {
                      alert(`자동 예약 실패: 예약 시간(${new Date(scheduledTimeISO).toLocaleString("ko-KR")})이 현재 시간보다 이전입니다.\n\n수동으로 예약해주세요.`)
                      return
                    }
                    
                    console.log("[자동화] 자동 예약 시작 (썸네일 생성 완료 후):", {
                      videoUrl: currentVideoData.videoUrl,
                      scheduledTime: scheduledTimeISO,
                      title: finalTitleValue,
                      description: finalDescriptionValue.substring(0, 50) + "...",
                      thumbnailUrl: currentThumbnailUrl,
                    })
                    
                    // YouTube 토큰 및 Client ID/Secret 가져오기
                    const tokensStr = localStorage.getItem("youtube_tokens")
                    const clientId = localStorage.getItem("youtube_client_id")
                    const clientSecret = localStorage.getItem("youtube_client_secret")
                    
                    if (!tokensStr) {
                      alert("YouTube 계정이 연결되지 않았습니다. 설정에서 연결해주세요.")
                      return
                    }

                    if (!clientId || !clientSecret) {
                      alert("YouTube Client ID와 Secret이 설정되지 않았습니다. 설정에서 입력해주세요.")
                      return
                    }

                    let tokens
                    try {
                      tokens = JSON.parse(tokensStr)
                      const expiresAt = new Date(tokens.expires_at)
                      const now = new Date()
                      if (expiresAt < now) {
                        alert("YouTube 토큰이 만료되었습니다. 설정에서 다시 연결해주세요.")
                        return
                      }
                    } catch (e) {
                      alert("YouTube 토큰을 읽을 수 없습니다. 설정에서 다시 연결해주세요.")
                      return
                    }

                    // blob URL인 경우 base64로 변환
                    let videoBase64: string | undefined = undefined
                    if (currentVideoData.videoUrl?.startsWith("blob:")) {
                      try {
                        const videoResponse = await fetch(currentVideoData.videoUrl)
                        const videoBlob = await videoResponse.blob()
                        const arrayBuffer = await videoBlob.arrayBuffer()
                        // 브라우저에서 base64 변환
                        const bytes = new Uint8Array(arrayBuffer)
                        let binary = ""
                        for (let i = 0; i < bytes.length; i++) {
                          binary += String.fromCharCode(bytes[i])
                        }
                        videoBase64 = btoa(binary)
                        console.log("[자동화] blob URL을 base64로 변환 완료:", videoBase64.length, "bytes")
                      } catch (e) {
                        console.error("[자동화] blob URL 변환 실패:", e)
                        alert("영상 데이터 변환에 실패했습니다. 다시 시도해주세요.")
                        return
                      }
                    }

                    // 실제 YouTube 업로드 API 호출
                    const response = await fetch("/api/youtube/upload", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        videoUrl: currentVideoData.videoUrl,
                        videoBase64, // blob URL인 경우 base64 데이터
                        title: finalTitleValue,
                        description: finalDescriptionValue,
                        thumbnailUrl: currentThumbnailUrl || null,
                        scheduledTime: scheduledTimeISO,
                        tags: [],
                        categoryId: "22",
                        privacyStatus: "private",
                        tokens, // 토큰을 요청 본문에 포함
                        clientId, // Client ID 전달
                        clientSecret, // Client Secret 전달
                      }),
                    })
                    
                    if (response.ok) {
                      const result = await response.json()
                      
                      // 예약 정보를 로컬스토리지에 저장
                      const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                      const scheduleData = {
                        id: scheduleId,
                        videoId: result.videoId,
                        videoUrl: result.videoUrl,
                        title: finalTitleValue,
                        description: finalDescriptionValue,
                        thumbnailUrl: currentThumbnailUrl || null,
                        scheduledTime: scheduledTimeISO,
                        tags: [],
                        categoryId: "22",
                        privacyStatus: "private",
                        status: "scheduled",
                        createdAt: new Date().toISOString(),
                      }
                      
                      const existingSchedules = JSON.parse(localStorage.getItem("youtube_schedules") || "[]")
                      existingSchedules.push(scheduleData)
                      localStorage.setItem("youtube_schedules", JSON.stringify(existingSchedules))
                      
                      console.log("[자동화] 자동 예약 완료:", result)
                      alert(`✅ 자동 예약 완료!\n\n예약 시간: ${new Date(scheduledTimeISO).toLocaleString("ko-KR")}\n\nYouTube에서 확인하세요: ${result.videoUrl}`)
                    } else {
                      let errorMessage = "알 수 없는 오류"
                      try {
                        const errorData = await response.json()
                        errorMessage = errorData.error || errorMessage
                        console.error("[자동화] 자동 예약 실패 (상세):", {
                          status: response.status,
                          statusText: response.statusText,
                          error: errorData,
                        })
                      } catch (e) {
                        console.error("[자동화] 자동 예약 실패 (응답 파싱 실패):", {
                          status: response.status,
                          statusText: response.statusText,
                        })
                      }
                      alert(`자동 예약에 실패했습니다: ${errorMessage}\n\n수동으로 예약해주세요.`)
                    }
                  } catch (error) {
                    console.error("[자동화] 자동 예약 오류 (상세):", error)
                    alert(`자동 예약 중 오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}\n\n수동으로 예약해주세요.`)
                  }
                } else {
                  console.warn("[자동화] videoUrl을 찾을 수 없어 자동 예약을 건너뜁니다. (최대 재시도 횟수 도달)")
                  alert("영상 URL을 찾을 수 없어 자동 예약을 건너뜁니다. 영상 렌더링이 완료되었는지 확인하고 수동으로 예약해주세요.")
                }
              }
            }, 500) // 0.5초마다 확인
          } else {
            console.log("[자동화] YouTube 연결되지 않아 자동 예약을 건너뜁니다.")
          }
        }
      }

      // 완료
      setAutoProgress({
        step: 9,
        totalSteps: 9,
        currentStepName: "완료",
        message: "🎉 자동화가 완료되었습니다! 각 단계를 확인하고 필요시 수정해주세요.",
        isComplete: true,
      })
      setIsReadyForUpload(true)
      // 최종 제목과 설명 저장
      setFinalTitle(youtubeTitle || titles[0] || selectedTopic)
      const descriptionText = typeof youtubeDescription === "string" ? youtubeDescription : youtubeDescription?.description || ""
      setFinalDescription(descriptionText)
      console.log("[자동화] 전체 파이프라인 완료")
      
      // YouTube 연결 상태 확인 (로컬스토리지에서)
      let isYoutubeConnected = false
      try {
        const tokensStr = localStorage.getItem("youtube_tokens")
        if (tokensStr) {
          try {
            const tokens = JSON.parse(tokensStr)
            const expiresAt = new Date(tokens.expires_at)
            const now = new Date()
            const isExpired = expiresAt < now
            isYoutubeConnected = !isExpired && !!tokens.access_token
            setYoutubeConnected(isYoutubeConnected)
          } catch (e) {
            setYoutubeConnected(false)
          }
        } else {
          setYoutubeConnected(false)
        }
      } catch (error) {
        console.error("[자동화] YouTube 연결 상태 확인 실패:", error)
        setYoutubeConnected(false)
      }
      
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
      // 자동화 모드: 대본 시간과 목소리 선택 팝업 표시
      setShowAutomationSettingsDialog(true)
    } else {
      // 수동 모드: 다음 단계로 이동
      setShowScheduleSelector(false)
      setActiveStep("planning")
    }
  }

  // 자동화 설정 확인 (대본 시간과 목소리 선택 후)
  const handleAutomationSettingsConfirm = () => {
    setShowAutomationSettingsDialog(false)
    // 업로드 일자 선택 UI 표시
    setShowScheduleSelector(true)
    // 기본 날짜를 오늘로 설정
    const today = new Date()
    setYoutubeScheduleDate(today.toISOString().split('T')[0])
  }

  // 자동화 시작 (업로드 일자 선택 후)
  const handleStartAutomation = () => {
    setShowScheduleSelector(false)
    runAutomationPipeline()
  }

  // YouTube 업로드 예약
  const handleYoutubeSchedule = async () => {
    if (!youtubeScheduleDate || !videoData || !videoData.videoUrl) {
      alert("예약 날짜와 영상 URL이 필요합니다. 영상 렌더링이 완료되었는지 확인해주세요.")
      return
    }

    // YouTube 토큰 확인
    const tokensStr = localStorage.getItem("youtube_tokens")
    if (!tokensStr) {
      alert("YouTube 계정이 연결되지 않았습니다. 설정에서 연결해주세요.")
      return
    }

    let tokens
    try {
      tokens = JSON.parse(tokensStr)
      const expiresAt = new Date(tokens.expires_at)
      const now = new Date()
      if (expiresAt < now) {
        alert("YouTube 토큰이 만료되었습니다. 설정에서 다시 연결해주세요.")
        return
      }
    } catch (e) {
      alert("YouTube 토큰을 읽을 수 없습니다. 설정에서 다시 연결해주세요.")
      return
    }

    setIsScheduling(true)
    try {
      // 예약 시간 조합
      const scheduledDateTime = new Date(`${youtubeScheduleDate}T${youtubeScheduleTime}`)
      const scheduledTimeISO = scheduledDateTime.toISOString()

      // 영상 URL 확인
      const videoUrl = videoData.videoUrl
      
      if (!videoUrl) {
        alert("영상 URL을 찾을 수 없습니다. 영상을 먼저 렌더링해주세요.")
        setIsScheduling(false)
        return
      }

      // YouTube 토큰 및 Client ID/Secret 가져오기
      const tokensStr = localStorage.getItem("youtube_tokens")
      const clientId = localStorage.getItem("youtube_client_id")
      const clientSecret = localStorage.getItem("youtube_client_secret")
      
      if (!tokensStr) {
        alert("YouTube 계정이 연결되지 않았습니다. 설정에서 연결해주세요.")
        setIsScheduling(false)
        return
      }

      if (!clientId || !clientSecret) {
        alert("YouTube Client ID와 Secret이 설정되지 않았습니다. 설정에서 입력해주세요.")
        setIsScheduling(false)
        return
      }

      let tokens
      try {
        tokens = JSON.parse(tokensStr)
        const expiresAt = new Date(tokens.expires_at)
        const now = new Date()
        if (expiresAt < now) {
          alert("YouTube 토큰이 만료되었습니다. 설정에서 다시 연결해주세요.")
          setIsScheduling(false)
          return
        }
      } catch (e) {
        alert("YouTube 토큰을 읽을 수 없습니다. 설정에서 다시 연결해주세요.")
        setIsScheduling(false)
        return
      }

      // blob URL인 경우 base64로 변환
      let videoBase64: string | undefined = undefined
      if (videoUrl.startsWith("blob:")) {
        try {
          const videoResponse = await fetch(videoUrl)
          const videoBlob = await videoResponse.blob()
          const arrayBuffer = await videoBlob.arrayBuffer()
          // 브라우저에서 base64 변환
          const bytes = new Uint8Array(arrayBuffer)
          let binary = ""
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          videoBase64 = btoa(binary)
          console.log("[수동 예약] blob URL을 base64로 변환 완료:", videoBase64.length, "bytes")
        } catch (e) {
          console.error("[수동 예약] blob URL 변환 실패:", e)
          alert("영상 데이터 변환에 실패했습니다. 다시 시도해주세요.")
          setIsScheduling(false)
          return
        }
      }

      // 실제 YouTube 업로드 API 호출
      const response = await fetch("/api/youtube/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl: videoUrl,
          videoBase64, // blob URL인 경우 base64 데이터
          title: finalTitle || youtubeTitle || selectedTopic,
          description: finalDescription || (typeof youtubeDescription === "string" ? youtubeDescription : youtubeDescription?.description || ""),
          thumbnailUrl: aiThumbnailUrl || null,
          scheduledTime: scheduledTimeISO,
          tags: [],
          categoryId: "22",
          privacyStatus: "private",
          tokens, // 토큰을 요청 본문에 포함
          clientId, // Client ID 전달
          clientSecret, // Client Secret 전달
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "예약에 실패했습니다.")
      }

      const result = await response.json()
      
      // 예약 정보를 로컬스토리지에 저장
      const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const scheduleData = {
        id: scheduleId,
        videoId: result.videoId,
        videoUrl: result.videoUrl,
        title: finalTitle || youtubeTitle || selectedTopic,
        description: finalDescription || (typeof youtubeDescription === "string" ? youtubeDescription : youtubeDescription?.description || ""),
        thumbnailUrl: aiThumbnailUrl || null,
        scheduledTime: scheduledTimeISO,
        tags: [],
        categoryId: "22",
        privacyStatus: "private",
        status: "scheduled",
        createdAt: new Date().toISOString(),
      }
      
      const existingSchedules = JSON.parse(localStorage.getItem("youtube_schedules") || "[]")
      existingSchedules.push(scheduleData)
      localStorage.setItem("youtube_schedules", JSON.stringify(existingSchedules))
      
      alert(`✅ YouTube 업로드가 예약되었습니다!\n\n예약 시간: ${new Date(scheduledTimeISO).toLocaleString("ko-KR")}\n\nYouTube에서 확인하세요: ${result.videoUrl}`)
      
      // 성공 시 상태 초기화 (선택사항)
      // setYoutubeScheduleDate("")
      // setYoutubeScheduleTime("18:00")
    } catch (error) {
      console.error("[YouTube] 업로드 예약 오류:", error)
      alert(`업로드 예약에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsScheduling(false)
    }
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
      // 제목/설명 생성 단계 체크
      setCompletedSteps((prev) => [...new Set([...prev, "title"])])
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
    // 주제가 없으면 대본에서 주제 추출
    let topicToUse = selectedTopic
    
    if (!topicToUse) {
      if (!script) {
        alert("주제 또는 대본이 필요합니다. 먼저 주제를 선택하거나 대본을 생성해주세요.")
        return
      }
      
      // 대본에서 주제 추출 시도
      const openaiApiKey = getApiKey("openai_api_key")
      if (openaiApiKey) {
        setIsGeneratingAIThumbnail(true)
        try {
          console.log("[v0] 대본에서 주제 추출 중...")
          topicToUse = await extractTopicFromScript(script, openaiApiKey)
          console.log("[v0] 추출된 주제:", topicToUse)
        } catch (error) {
          console.error("[v0] 주제 추출 실패, 대본 요약 사용:", error)
          // 주제 추출 실패 시 대본의 앞부분을 주제로 사용
          topicToUse = script.substring(0, 100).replace(/\n/g, " ").trim()
          if (topicToUse.length > 50) {
            topicToUse = topicToUse.substring(0, 50) + "..."
          }
          console.log("[v0] 대본 요약을 주제로 사용:", topicToUse)
        }
      } else {
        // OpenAI API 키가 없으면 대본의 앞부분을 주제로 사용
        topicToUse = script.substring(0, 100).replace(/\n/g, " ").trim()
        if (topicToUse.length > 50) {
          topicToUse = topicToUse.substring(0, 50) + "..."
        }
        console.log("[v0] 대본 요약을 주제로 사용:", topicToUse)
      }
    }

    const replicateApiKey = getApiKey("replicate_api_key")
    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      setIsGeneratingAIThumbnail(false)
      return
    }

    setIsGeneratingAIThumbnail(true)
    try {
      // 캐릭터 정보 추출 (첫 번째 장면의 첫 번째 이미지 프롬프트에서)
      let characterDescription: string | undefined = undefined
      if (sceneImagePrompts.length > 0 && sceneImagePrompts[0].images && sceneImagePrompts[0].images.length > 0) {
        const firstImagePrompt = sceneImagePrompts[0].images[0].prompt
        // 프롬프트에서 캐릭터 관련 부분 추출 (간단한 추출)
        // 예: "A detective", "The main character", "A person" 등의 패턴 찾기
        const characterMatch = firstImagePrompt.match(/(?:A|An|The)\s+([a-zA-Z\s]+?)(?:\s+(?:looking|standing|sitting|wearing|with|in)|,|\.|$)/i)
        if (characterMatch && characterMatch[1]) {
          characterDescription = characterMatch[1].trim()
        } else {
          // 간단하게 프롬프트의 처음 부분 사용
          const promptWords = firstImagePrompt.split(',').slice(0, 2).join(',').trim()
          if (promptWords.length > 0 && promptWords.length < 100) {
            characterDescription = promptWords
          }
        }
      }
      
      console.log("[v0] AI 썸네일 생성 시작, 주제:", topicToUse, "이미지 스타일:", imageStyle, "커스텀 문구:", thumbnailCustomText, "캐릭터:", characterDescription)
      const imageUrl = await generateAIThumbnail(
        topicToUse, 
        replicateApiKey, 
        imageStyle, 
        thumbnailCustomText.trim() || undefined,
        customStylePrompt || undefined,
        characterDescription
      )
      setAiThumbnailUrl(imageUrl)
      setCompletedSteps((prev) => [...new Set([...prev, "thumbnail"])])
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

    // 씬별 이미지와 일반 이미지 모두 확인
    const hasSceneImages = sceneImagePrompts.length > 0 && sceneImagePrompts.some(scene => 
      scene.images && scene.images.some(img => img.imageUrl)
    )
    const hasRegularImages = generatedImages.length > 0
    const hasImages = hasSceneImages || hasRegularImages
    
    if (!hasImages) {
      alert("먼저 이미지를 생성해주세요. (장면별 이미지 또는 일반 이미지)")
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

  // 쇼츠 TTS 생성 함수 (롱폼에서 선택한 TTS 사용)
  const handleGenerateShortsTTS = async () => {
    if (shortsScriptLines.length === 0) {
      alert("생성된 문장 리스트가 없습니다. 먼저 대본을 요약해주세요.")
      return
    }

    // TTSMaker와 ElevenLabs는 API 키 필요
    if (selectedVoiceId?.startsWith("ttsmaker-")) {
      const ttsmakerApiKey = getApiKey("ttsmaker_api_key")
      if (!ttsmakerApiKey) {
        alert("TTSMaker API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
        return
      }
    } else {
      const elevenlabsApiKey = getApiKey("elevenlabs_api_key")
      if (!elevenlabsApiKey) {
        alert("ElevenLabs API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
        return
      }
    }

    setIsGeneratingShortsTts(true)
    setTtsGenerationProgress({ current: 0, total: shortsScriptLines.length })
    
    let successCount = 0
    const collectedAudios: Array<{ lineId: number; audioUrl?: string; audioBase64?: string; audioBuffer?: AudioBuffer; duration?: number }> = []

    try {
      // 각 라인별로 TTS 생성 (롱폼과 동일한 generateTTSWithRetry 함수 사용)
      for (let i = 0; i < shortsScriptLines.length; i++) {
        const line = shortsScriptLines[i]
        setTtsGenerationProgress({ current: i + 1, total: shortsScriptLines.length })

        try {
          console.log(`[Shorts] TTS 생성 중... (${i + 1}/${shortsScriptLines.length})`)
          
          // 롱폼에서 사용하는 generateTTSWithRetry 함수 사용
          const data = await generateTTSWithRetry(line, selectedVoiceId)
          
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
          // alert(`${successCount}개의 TTS가 생성되었습니다. (${shortsScriptLines.length - successCount}개 실패)\n\n실패한 항목은 브라우저 콘솔을 확인해주세요.`) // 완료 알림 제거
        } else {
          // alert(`${successCount}개의 TTS가 모두 생성되었습니다!`) // 완료 알림 제거
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
        const errorMessage = "TTS 생성에 실패했습니다.\n\n가능한 원인:\n1. API 키가 올바르지 않습니다\n2. API 키의 사용량이 초과되었습니다\n3. 네트워크 연결 문제\n\n브라우저 콘솔(F12)에서 자세한 오류를 확인해주세요."
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
    // 씬별 이미지와 일반 이미지 모두 확인
    const hasSceneImages = sceneImagePrompts.length > 0 && sceneImagePrompts.some(scene => 
      scene.images && scene.images.some(img => img.imageUrl)
    )
    const hasRegularImages = generatedImages.length > 0
    const hasImages = hasSceneImages || hasRegularImages
    
    if (!hasImages || !shortsTtsAudioUrl || !shortsCanvasRef.current) {
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
        // alert("쇼츠 영상 렌더링이 완료되었습니다!") // 완료 알림 제거
      }

      // 이미지 미리 로드 - sceneImagePrompts와 generatedImages 모두 포함
      const images: HTMLImageElement[] = []
      const imageLineIdMap: Map<number, number> = new Map() // lineId -> imageIndex 매핑
      
      // sceneImagePrompts의 이미지는 나중에 allImageUrls에 포함시킬 예정이므로 여기서는 건너뜀
      // (generatedImages가 없을 때 사용하기 위해)
      let imageIndex = 0
      
      // 그 다음 generatedImages 추가 - shortsScriptLines와 순서대로 매칭
      // generatedImages를 lineId 순서로 정렬
      const sortedGeneratedImages = [...generatedImages].sort((a, b) => a.lineId - b.lineId)
      
      // sceneImagePrompts에서 이미지 URL 수집 (generatedImages가 없을 때 사용)
      const sceneImageUrls: string[] = []
      for (const scene of sceneImagePrompts) {
        for (const imgData of scene.images || []) {
          if (imgData.imageUrl && !sceneImageUrls.includes(imgData.imageUrl)) {
            sceneImageUrls.push(imgData.imageUrl)
          }
        }
      }
      
      // 모든 사용 가능한 이미지 URL 수집
      const allImageUrls: string[] = []
      for (const imgData of sortedGeneratedImages) {
        if (imgData.imageUrl && !allImageUrls.includes(imgData.imageUrl)) {
          allImageUrls.push(imgData.imageUrl)
        }
      }
      // generatedImages가 없으면 sceneImagePrompts의 이미지 사용
      if (allImageUrls.length === 0) {
        allImageUrls.push(...sceneImageUrls)
      }
      
      console.log(`[Shorts 렌더링] 사용 가능한 이미지 수: ${allImageUrls.length}개 (generatedImages: ${sortedGeneratedImages.length}개, sceneImages: ${sceneImageUrls.length}개)`)
      
      // shortsScriptLines의 각 라인에 대해 순서대로 이미지 매칭
      for (let i = 0; i < shortsScriptLines.length; i++) {
        const shortsLine = shortsScriptLines[i]
        
        // 사용 가능한 이미지가 있으면 순서대로 매칭
        if (allImageUrls.length > 0) {
          const imageUrl = allImageUrls[i % allImageUrls.length]
          
          // 이미 로드된 이미지인지 확인
          let existingImageIndex = -1
          for (let j = 0; j < images.length; j++) {
            if (images[j].src === imageUrl || images[j].src.includes(imageUrl.split('/').pop() || '')) {
              existingImageIndex = j
              break
            }
          }
          
          if (existingImageIndex >= 0) {
            // 이미 로드된 이미지 사용
            imageLineIdMap.set(shortsLine.id, existingImageIndex)
          } else {
            // 새 이미지 로드
            try {
              const img = new Image()
              img.crossOrigin = "anonymous"
              await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve()
                img.onerror = (error) => {
                  console.error(`[Shorts 렌더링] 이미지 로드 실패: ${imageUrl}`, error)
                  reject(error)
                }
                img.src = imageUrl
              })
              images.push(img)
              imageLineIdMap.set(shortsLine.id, imageIndex)
              imageIndex++
              console.log(`[Shorts 렌더링] 이미지 로드 완료 (라인 ${shortsLine.id}): ${imageUrl.substring(0, 50)}...`)
            } catch (error) {
              console.error(`[Shorts 렌더링] 이미지 로드 실패 (라인 ${shortsLine.id}):`, error)
              // 이미지 로드 실패해도 계속 진행
            }
          }
        }
      }
      
      console.log(`[Shorts 렌더링] 총 로드된 이미지 수: ${images.length}개, 매핑된 라인 수: ${imageLineIdMap.size}개`)
      
      if (images.length === 0) {
        alert("이미지를 로드할 수 없습니다. 이미지가 생성되었는지 확인해주세요.")
        setIsRenderingShorts(false)
        return
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

        // 현재 시간에 맞는 이미지 찾기 (자막이 1초 늦게 나오는 문제 해결: 각 자막의 시작 시간을 1초 앞당김)
        const currentLine = shortsScriptLines.find(
          (line) => elapsed >= (line.startTime / 1000) - 1 && elapsed <= (line.endTime / 1000) - 1
        ) || shortsScriptLines[shortsScriptLines.length - 1]

        if (currentLine) {
          // imageLineIdMap에서 먼저 찾기 (sceneImagePrompts와 generatedImages 모두 포함)
          let imageIndex = imageLineIdMap.get(currentLine.id) ?? -1

          // 찾지 못한 경우 이전 라인에서 이미지 찾기
          if (imageIndex < 0) {
            const currentLineIndex = shortsScriptLines.findIndex((line) => line.id === currentLine.id)
            for (let i = currentLineIndex; i >= 0; i--) {
              const prevLine = shortsScriptLines[i]
              const prevImageIndex = imageLineIdMap.get(prevLine.id)
              if (prevImageIndex !== undefined && prevImageIndex >= 0) {
                imageIndex = prevImageIndex
                break
              }
            }
          }

          // 여전히 이미지를 찾지 못한 경우 첫 번째 이미지 사용
          if (imageIndex < 0 && images.length > 0) {
            imageIndex = 0
          }

          if (imageIndex >= 0 && images[imageIndex]) {
            const img = images[imageIndex]
            const imageWidth = canvas.width
            const imageHeight = canvas.width
            const imageX = 0
            // 제목 영역 높이 계산
            const titleHeight = shortsHookingTitle || selectedTopic ? 300 : 0 // 200 + 80 (위쪽 여백) + 20 (추가 간격)
            const imageY = titleHeight + 30 // 제목 밑에 30px 여백 추가

            // 줌인 효과 제거 - 이미지를 그대로 그리기
            // 16:9 이미지를 1:1로 크롭 (중앙 기준)
            let sourceX = 0
            let sourceY = 0
            let sourceWidth = img.width
            let sourceHeight = img.height
            
            if (img.width !== img.height) {
              // 16:9 또는 다른 비율인 경우, 중앙에서 1:1 영역만 크롭하여 표시
              const sourceSize = Math.min(img.width, img.height)
              const baseX = (img.width - sourceSize) / 2
              const baseY = (img.height - sourceSize) / 2
              sourceX = baseX
              sourceY = baseY
              sourceWidth = sourceSize
              sourceHeight = sourceSize
            }
            
            // 이미지를 캔버스에 그리기 (줌인 효과 없음)
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
            
            // 현재 시간에 맞는 자막 라인 찾기 (자막이 1초 늦게 나오는 문제 해결: 시작 시간을 1초 앞당김)
            const timeInLine = Math.max(0, elapsed - ((currentLine.startTime / 1000) - 1))
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
    // 직접입력 모드에서는 주제 체크를 건너뜀 (벤치마킹 대본 기반으로 생성)
    if (!isDirectInputSelected && !selectedTopic && !customTopic) {
      alert("주제를 선택하거나 입력해주세요.")
      return
    }
    
    // 직접입력 모드에서 벤치마킹 대본이 있으면 referenceScript에 설정
    if (isDirectInputSelected && benchmarkScript.trim()) {
      setReferenceScript(benchmarkScript)
    }

    setIsGenerating(true)
    if (isAutoMode) {
      setAutoModeStep("대본 기획 생성 중...")
      setAutoModeProgress({ current: "1/7", total: 7 })
    }
    try {
      console.log("[v0] 대본 기획 생성 시작, 주제:", selectedTopic || customTopic)
      const topic = isCustomTopicSelected ? customTopic : selectedTopic
      const geminiApiKey = getGeminiApiKey()
      if (!geminiApiKey) {
        alert("Gemini API 키를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
        setIsGenerating(false)
        return
      }
      const plan = await generateScriptPlan(
        topic,
        selectedCategory || "health",
        keywords || undefined,
        geminiApiKey,
        scriptDuration,
        referenceScript || undefined
      )
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
      const draft = await generateScriptDraft(scriptPlan, topic || "", getApiKey(), selectedCategory, isStoryMode)
      console.log("[v0] 대본 초안 생성 완료")
      setScriptDraft(draft)
      // 대본 초안 생성 후 자동으로 대본 생성 단계로 이동
      setActiveStep("script")
      
      // 자동화 모드일 때 다음 단계 자동 진행 (대본 재구성)
      if (isAutoMode) {
        console.log("[v0] 자동화 모드: 대본 재구성 시작")
        setTimeout(() => {
          // 정교한 대본 생성 호출
          handleRefinedScriptGeneration()
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
  // 새로운 장면 분해 형식을 파싱하여 scriptLines로 변환하는 함수
  const parseSceneBlocks = (sceneText: string): Array<{ id: number; text: string }> => {
    if (!sceneText || sceneText.trim().length === 0) {
      return []
    }

    const lines: Array<{ id: number; text: string }> = []
    let currentId = 1

    // 씬 블록을 찾기 위한 정규식
    // 형식: 씬 {number}\n[장면 1]\n(텍스트)\n[장면 2]\n(텍스트)...
    // 플래그 's'는 ES2018 이상이 필요하므로 제거하여 호환성 높임
    const sceneRegex = /씬\s+(\d+)\s*\n\[장면\s+(\d+)\]\s*\n([^[]+?)(?=\[장면\s+\d+\]|씬\s+\d+|$)/g

    let match
    while ((match = sceneRegex.exec(sceneText)) !== null) {
      const sceneNum = match[1]
      const shotNum = match[2]
      const shotText = match[3].trim()

      if (shotText) {
        lines.push({
          id: currentId++,
          text: shotText,
        })
      }
    }

    // 정규식으로 매칭되지 않은 경우, 간단한 파싱 시도
    if (lines.length === 0) {
      // [장면 N] 형식으로 직접 파싱
      const shotRegex = /\[장면\s+\d+\]\s*\n([^\[]+?)(?=\[장면\s+\d+\]|씬\s+\d+|$)/g
      let shotMatch
      while ((shotMatch = shotRegex.exec(sceneText)) !== null) {
        const shotText = shotMatch[1].trim()
        if (shotText) {
          lines.push({
            id: currentId++,
            text: shotText,
          })
        }
      }
    }

    return lines
  }

  // Gemini API를 사용하여 의미 단위 세그먼트 생성
  const generateSemanticSegments = async (text: string, geminiApiKey: string): Promise<string[]> => {
    try {
      // 서버 API 라우트를 통해 호출 (API 키 노출 방지)
      const response = await fetch("/api/gemini/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash-exp",
          contents: [{
            parts: [{
              text: `다음 텍스트를 의미 단위로 분할해주세요. 각 의미 단위는 독립적인 문장이나 구절이어야 합니다. 결과는 JSON 배열 형식으로 반환해주세요.\n\n텍스트: ${text}\n\n결과 형식: ["의미 단위 1", "의미 단위 2", ...]`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorData.error || errorData.details || "알 수 없는 오류"}`)
      }

      const data = await response.json()
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
      
      // JSON 배열 추출
      const jsonMatch = resultText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const segments = JSON.parse(jsonMatch[0])
        return Array.isArray(segments) ? segments : [text]
      }
      
      // JSON이 없으면 줄바꿈으로 분할
      return resultText.split('\n').filter((s: string) => s.trim().length > 0)
    } catch (error) {
      console.error("[의미 단위 세그먼트 생성 실패]:", error)
      // 실패 시 기본 분할 (문장 단위)
      return text.split(/[.!?。！？]\s*/).filter(s => s.trim().length > 0)
    }
  }

  // Alignment와 세그먼트를 매칭하여 정확한 자막 타이밍 생성
  const alignmentToPhrases = (
    alignment: any,
    charLimit: number,
    semanticSegments: string[]
  ): Array<{ text: string; start: number; end: number }> => {
    if (!alignment || !alignment.characters || !alignment.character_start_times_seconds || !alignment.character_end_times_seconds) {
      // alignment가 없으면 fallback
      return []
    }

    const characters = alignment.characters
    const startTimes = alignment.character_start_times_seconds
    const endTimes = alignment.character_end_times_seconds

    const phrases: Array<{ text: string; start: number; end: number }> = []
    let currentPhrase = ""
    let phraseStart = 0
    let phraseEnd = 0
    let charIndex = 0

    // semantic segments와 alignment 매칭
    for (const segment of semanticSegments) {
      const segmentStartChar = charIndex
      const segmentEndChar = charIndex + segment.length
      
      // 세그먼트의 시작/종료 문자 인덱스 찾기
      let segmentStartTime = 0
      let segmentEndTime = 0
      
      // 세그먼트의 첫 문자와 마지막 문자의 시간 찾기
      for (let i = 0; i < characters.length; i++) {
        if (i >= segmentStartChar && i < segmentEndChar) {
          if (segmentStartTime === 0 && startTimes[i] !== undefined) {
            segmentStartTime = startTimes[i]
          }
          if (endTimes[i] !== undefined) {
            segmentEndTime = endTimes[i]
          }
        }
      }

      // 세그먼트를 charLimit 단위로 나누기
      let currentLine = ""
      let lineStart = segmentStartTime
      let lineEnd = segmentStartTime

      for (let i = 0; i < segment.length; i++) {
        const char = segment[i]
        const charIdx = segmentStartChar + i
        
        if (charIdx < characters.length) {
          const charStart = startTimes[charIdx] || segmentStartTime
          const charEnd = endTimes[charIdx] || segmentEndTime
          
          const testLine = currentLine + char
          
          if (testLine.length > charLimit && currentLine.length > 0) {
            // 현재 줄 저장
            phrases.push({
              text: currentLine.trim(),
              start: lineStart,
              end: lineEnd,
            })
            // 새 줄 시작
            currentLine = char
            lineStart = charStart
            lineEnd = charEnd
          } else {
            currentLine = testLine
            lineEnd = charEnd
          }
        } else {
          currentLine += char
        }
      }

      // 마지막 줄 저장
      if (currentLine.trim().length > 0) {
        phrases.push({
          text: currentLine.trim(),
          start: lineStart,
          end: segmentEndTime > 0 ? segmentEndTime : lineEnd,
        })
      }

      charIndex = segmentEndChar
    }

    return phrases.length > 0 ? phrases : []
  }

  const splitScriptIntoLines = (scriptText: string, isRefined: boolean = false): Array<{ id: number; text: string }> => {
    if (!scriptText || scriptText.trim().length === 0) {
      return []
    }

    // 정교한 대본의 경우: 의미/장면 단위로 나뉘어 있으므로 줄바꿈을 기준으로 처리
    if (isRefined) {
      // 빈 줄(줄바꿈 2개 이상) 또는 단일 줄바꿈을 기준으로 의미 단위 분리
      const meaningUnits = scriptText.split(/\n\s*\n/).filter(unit => unit.trim().length > 0)
      
      const groupedLines: Array<{ id: number; text: string }> = []
      const TARGET_LINE_LENGTH = 60 // 목표 길이 (10~15초 분량)
      const MIN_LINE_LENGTH = 35 // 최소 길이
      const MAX_LINE_LENGTH = 90 // 최대 길이
      
      for (const unit of meaningUnits) {
        const trimmedUnit = unit.trim().replace(/\n/g, " ") // 단일 줄바꿈은 공백으로 변환
        const unitLength = trimmedUnit.length
        
        // 의미 단위가 이미 적절한 길이면 그대로 사용
        if (unitLength >= MIN_LINE_LENGTH && unitLength <= MAX_LINE_LENGTH) {
          groupedLines.push({
            id: groupedLines.length + 1,
            text: trimmedUnit,
          })
        }
        // 의미 단위가 너무 짧으면 다음 단위와 합치거나 그대로 사용
        else if (unitLength < MIN_LINE_LENGTH) {
          if (groupedLines.length > 0) {
            // 이전 그룹에 합치기
            const lastIndex = groupedLines.length - 1
            const combined = groupedLines[lastIndex].text + " " + trimmedUnit
            if (combined.length <= MAX_LINE_LENGTH) {
              groupedLines[lastIndex] = {
                ...groupedLines[lastIndex],
                text: combined,
              }
            } else {
              // 합치면 너무 길면 별도로 추가
              groupedLines.push({
                id: groupedLines.length + 1,
                text: trimmedUnit,
              })
            }
          } else {
            // 첫 번째 그룹이면 그대로 추가
            groupedLines.push({
              id: groupedLines.length + 1,
              text: trimmedUnit,
            })
          }
        }
        // 의미 단위가 너무 길면 문장 단위로 나누기
        else {
          // 문장 부호로 나누기
          const sentences = trimmedUnit.split(/([.!?。！？]\s*)/).filter(s => s.trim().length > 0)
          let currentGroup = ""
          
          for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i].trim()
            if (!sentence) continue
            
            const potentialLength = currentGroup ? (currentGroup + " " + sentence).length : sentence.length
            
            if (potentialLength > MAX_LINE_LENGTH && currentGroup) {
              groupedLines.push({
                id: groupedLines.length + 1,
                text: currentGroup,
              })
              currentGroup = sentence
            } else if (potentialLength >= TARGET_LINE_LENGTH && potentialLength <= MAX_LINE_LENGTH) {
              const finalText = currentGroup ? currentGroup + " " + sentence : sentence
              groupedLines.push({
                id: groupedLines.length + 1,
                text: finalText,
              })
              currentGroup = ""
            } else {
              currentGroup = currentGroup ? currentGroup + " " + sentence : sentence
            }
          }
          
          if (currentGroup) {
            if (groupedLines.length > 0 && currentGroup.length < MIN_LINE_LENGTH) {
              const lastIndex = groupedLines.length - 1
              groupedLines[lastIndex] = {
                ...groupedLines[lastIndex],
                text: groupedLines[lastIndex].text + " " + currentGroup,
              }
            } else {
              groupedLines.push({
                id: groupedLines.length + 1,
                text: currentGroup,
              })
            }
          }
        }
      }
      
      return groupedLines.map((l, index) => {
        let text = l.text.trim()
        if (text.length > 0 && !/[.!?。！？]$/.test(text)) {
          text = text + "."
        }
        return { ...l, id: index + 1, text }
      })
    }

    // 기본 대본의 경우: 기존 로직 사용 (문장 부호 기준 + 길이 기반 그룹화)
    // 문장 부호를 보존하면서 문장 단위로 나누기
    const sentences: string[] = []
    const sentenceEndRegex = /([.!?。！？])\s*/g
    let lastIndex = 0
    let match
    
    while ((match = sentenceEndRegex.exec(scriptText)) !== null) {
      const sentence = scriptText.substring(lastIndex, match.index + match[0].length).trim()
      if (sentence.length > 0) {
        sentences.push(sentence)
      }
      lastIndex = sentenceEndRegex.lastIndex
    }
    
    // 마지막 부분 처리
    if (lastIndex < scriptText.length) {
      const lastSentence = scriptText.substring(lastIndex).trim()
      if (lastSentence.length > 0) {
        sentences.push(lastSentence)
      }
    }

    if (sentences.length === 0) {
      return []
    }

    const groupedLines: Array<{ id: number; text: string }> = []
    // TTS 속도: 분당 약 200-250자 기준
    // 10초 = 약 33~42자, 15초 = 약 50~63자
    const TARGET_LINE_LENGTH = 60 // 목표 길이 (10~15초 분량, 약 50~60자)
    const MIN_LINE_LENGTH = 35 // 최소 길이 (약 10초 분량)
    const MAX_LINE_LENGTH = 90 // 최대 길이 (약 15초 분량)
    
    let currentGroup: string[] = []
    let currentLength = 0
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]
      const sentenceLength = sentence.length
      const potentialLength = currentLength + (currentLength > 0 ? 1 : 0) + sentenceLength // 공백 포함
      
      // 현재 그룹이 비어있으면 추가
      if (currentGroup.length === 0) {
        currentGroup.push(sentence)
        currentLength = sentenceLength
        // 한 문장이 이미 최대 길이를 넘으면 바로 저장
        if (sentenceLength > MAX_LINE_LENGTH) {
          groupedLines.push({
            id: groupedLines.length + 1,
            text: sentence,
          })
          currentGroup = []
          currentLength = 0
        }
        continue
      }
      
      // 현재 그룹에 추가했을 때 최대 길이를 넘으면 현재 그룹 저장하고 새로 시작
      if (potentialLength > MAX_LINE_LENGTH) {
        if (currentGroup.length > 0) {
          const groupText = currentGroup.join(" ")
          groupedLines.push({
            id: groupedLines.length + 1,
            text: groupText,
          })
        }
        currentGroup = [sentence]
        currentLength = sentenceLength
        // 한 문장이 이미 최대 길이를 넘으면 바로 저장
        if (sentenceLength > MAX_LINE_LENGTH) {
          groupedLines.push({
            id: groupedLines.length + 1,
            text: sentence,
          })
          currentGroup = []
          currentLength = 0
        }
        continue
      }
      
      // 목표 길이에 도달하면 (목표 길이 이상이고 최대 길이 미만) 그룹 저장
      if (potentialLength >= TARGET_LINE_LENGTH && potentialLength <= MAX_LINE_LENGTH) {
        currentGroup.push(sentence)
        const groupText = currentGroup.join(" ")
        groupedLines.push({
          id: groupedLines.length + 1,
          text: groupText,
        })
        currentGroup = []
        currentLength = 0
        continue
      }
      
      // 목표 길이보다 작으면 계속 추가
      if (potentialLength < TARGET_LINE_LENGTH) {
        currentGroup.push(sentence)
        currentLength = potentialLength
        continue
      }
    }
    
    // 남은 문장들 처리
    if (currentGroup.length > 0) {
      const remainingText = currentGroup.join(" ")
      // 최소 길이를 만족하거나 마지막 그룹이면 저장
      if (remainingText.length >= MIN_LINE_LENGTH || groupedLines.length === 0) {
        groupedLines.push({
          id: groupedLines.length + 1,
          text: remainingText,
        })
      } else if (groupedLines.length > 0) {
        // 최소 길이 미만이면 마지막 그룹에 합치기
        const lastIndex = groupedLines.length - 1
        groupedLines[lastIndex] = {
          ...groupedLines[lastIndex],
          text: groupedLines[lastIndex].text + " " + remainingText,
        }
      }
    }
    
    // ID 재정렬 및 마침표 추가
    return groupedLines.map((l, index) => {
      let text = l.text.trim()
      // 문장 끝에 마침표가 없으면 추가
      if (text.length > 0 && !/[.!?。！？]$/.test(text)) {
        text = text + "."
      }
      return { ...l, id: index + 1, text }
    })
  }

  const handleBasicScriptGeneration = async () => {
    if (!scriptPlan) {
      alert("대본 기획안을 먼저 생성해주세요.")
      return
    }

    setIsGenerating(true)
    try {
      console.log("[v0] 기본 대본 생성 시작")
      const topic = isCustomTopicSelected ? customTopic : selectedTopic
      // 선택한 시간에 맞춰 대본 길이 계산 (1초당 6.9자)
      const targetChars = Math.floor(scriptDuration * 60 * 6.9)
      const fullScript = await generateFinalScript(scriptPlan, topic || "", getApiKey(), scriptDuration, targetChars, selectedCategory, isStoryMode)
      setScript(fullScript)
      
      // 대본을 문장 단위로 분리하고 적절한 길이로 묶기
      const groupedLines = splitScriptIntoLines(fullScript)
      
      setScriptLines(groupedLines)
      setCompletedSteps((prev) => [...prev, "script"])
      console.log("[v0] 기본 대본 생성 완료, 문장 그룹 수:", groupedLines.length)
    } catch (error) {
      console.error("기본 대본 생성 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      alert(`기본 대본 생성에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRefinedScriptGeneration = async () => {
    if (!scriptPlan) {
      alert("대본 기획안을 먼저 생성해주세요.")
      return
    }

    setIsGenerating(true)
    const startTime = Date.now()
    
    // 목표 글자수 기반 예상 시간 계산 (1000자당 약 10-15초 소요 가정)
    const topic = isCustomTopicSelected ? customTopic : selectedTopic
    const targetChars = Math.floor(scriptDuration * 60 * 6.9)
    const estimatedSeconds = Math.max(30, Math.ceil(targetChars / 1000 * 12)) // 최소 30초, 1000자당 12초
    const estimatedTime = estimatedSeconds * 1000 // 밀리초로 변환
    
    // 진행률 업데이트 인터벌 시작
    const progressInterval = setInterval(() => {
      const elapsedTime = Date.now() - startTime
      // 진행률 계산: 경과 시간 / 예상 시간 (최대 95%까지, 실제 완료 전까지는 100%로 표시하지 않음)
      const progress = Math.min(95, Math.floor((elapsedTime / estimatedTime) * 100))
      setScriptGenerationProgress({
        progress,
        elapsedTime: Math.floor(elapsedTime / 1000), // 초 단위
        estimatedTime: Math.floor(estimatedTime / 1000) // 초 단위
      })
    }, 500) // 0.5초마다 업데이트
    
    try {
      console.log("[v0] 정교한 대본 생성 시작")
      const geminiApiKey = getGeminiApiKey()
      if (!geminiApiKey) {
        clearInterval(progressInterval)
        setScriptGenerationProgress(null)
        alert("Gemini API 키를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
        return
      }
      const fullScript = await generateRefinedScript(scriptPlan, topic || "", scriptDuration, targetChars, isStoryMode, geminiApiKey)
      setScript(fullScript)
      
      // 정교한 대본은 의미/장면 기반으로 나누기
      const groupedLines = splitScriptIntoLines(fullScript, true)
      
      setScriptLines(groupedLines)
      setCompletedSteps((prev) => [...prev, "script"])
      console.log("[v0] 정교한 대본 생성 완료, 문장 그룹 수:", groupedLines.length)
      
      // 완료 시 100% 표시
      setScriptGenerationProgress({
        progress: 100,
        elapsedTime: Math.floor((Date.now() - startTime) / 1000),
        estimatedTime: Math.floor(estimatedTime / 1000)
      })
    } catch (error) {
      console.error("정교한 대본 생성 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      alert(`정교한 대본 생성에 실패했습니다: ${errorMessage}`)
    } finally {
      clearInterval(progressInterval)
      setIsGenerating(false)
      // 완료 후 1초 뒤 진행률 초기화
      setTimeout(() => {
        setScriptGenerationProgress(null)
      }, 1000)
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
    
    // 이미지 생성 시작 시 해당 이미지의 영상 데이터 초기화
    setConvertedVideos((prev) => {
      const newMap = new Map(prev)
      newMap.delete(lineId)
      return newMap
    })
    
    try {
      // 한글 프롬프트를 영어로 변환
      console.log(`[v0] 커스텀 이미지 생성 시작 (줄 ${lineId}):`, customImagePrompt)
      
      // generateCustomPrompt 함수 사용
      const { generateCustomPrompt } = await import("./actions")
      let englishPrompt = await generateCustomPrompt(customImagePrompt, openaiApiKey)
      
      // 카테고리별 프롬프트 추가 (16:9 비율 강제)
      // 모든 카테고리에서 스타일 적용
      if (imageStyle) {
        englishPrompt = await generateImagePrompt(customImagePrompt, openaiApiKey, selectedCategory || "health", imageStyle)
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
          historyStyle: imageStyle,
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
      // alert("이미지가 생성되었습니다!") // 완료 알림 제거
    } catch (error) {
      console.error(`[v0] 커스텀 이미지 생성 실패 (줄 ${lineId}):`, error)
      alert(`이미지 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingCustomImage(false)
    }
  }

  // 이미지/영상 업로드 핸들러
  const handleImageUpload = async (lineId: number, file: File) => {
    try {
      const isVideo = file.type.startsWith("video/")
      
      if (isVideo) {
        // 영상 파일인 경우
        const reader = new FileReader()
        reader.onloadend = () => {
          const videoUrl = reader.result as string
          
          // 업로드된 영상 업데이트
          setGeneratedImages((prev) => {
            const filtered = prev.filter((img) => img.lineId !== lineId)
            return [
              ...filtered,
              {
                lineId: lineId,
                imageUrl: videoUrl, // 영상 URL도 imageUrl에 저장
                prompt: "사용자 업로드 영상",
              },
            ]
          })
          
          // convertedVideos에도 저장 (영상으로 표시하기 위해)
          setConvertedVideos((prev) => {
            const newMap = new Map(prev)
            newMap.set(lineId, videoUrl)
            return newMap
          })
          
          // alert("영상이 업로드되었습니다!") // 완료 알림 제거
        }
        reader.readAsDataURL(file)
      } else {
        // 이미지 파일인 경우
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
          
          // 이미지로 교체했으므로 변환된 영상 제거
          setConvertedVideos((prev) => {
            const newMap = new Map(prev)
            newMap.delete(lineId)
            return newMap
          })

          // alert("이미지가 업로드되었습니다!") // 완료 알림 제거
        }
        reader.readAsDataURL(resizedImage)
      }
    } catch (error) {
      console.error(`[v0] 파일 업로드 실패 (줄 ${lineId}):`, error)
      alert(`파일 업로드에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    }
  }

  // Scene 이미지/영상 업로드 핸들러
  const handleSceneImageUpload = async (sceneNumber: number, imageNumber: number, file: File) => {
    try {
      const isVideo = file.type.startsWith("video/")
      
      if (isVideo) {
        // 영상 파일인 경우
        const reader = new FileReader()
        reader.onloadend = () => {
          const videoUrl = reader.result as string
          
          // 업로드된 영상 업데이트
          setSceneImagePrompts((prev) => {
            return prev.map((scene) => {
              if (scene.sceneNumber === sceneNumber) {
                return {
                  ...scene,
                  images: scene.images.map((img) => {
                    if (img.imageNumber === imageNumber) {
                      return {
                        ...img,
                        imageUrl: videoUrl, // 영상 URL도 imageUrl에 저장
                      }
                    }
                    return img
                  }),
                }
              }
              return scene
            })
          })
          
          // convertedSceneVideos에도 저장 (영상으로 표시하기 위해)
          setConvertedSceneVideos((prev) => {
            const newMap = new Map(prev)
            newMap.set(`${sceneNumber}-${imageNumber}`, videoUrl)
            return newMap
          })
          
          // alert("영상이 업로드되었습니다!") // 완료 알림 제거
        }
        reader.readAsDataURL(file)
      } else {
        // 이미지 파일인 경우
        // 16:9 비율로 이미지 리사이즈
        const resizedImage = await resizeImageTo16_9(file)
        
        // Base64로 변환
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          const imageUrl = base64

          // 업로드된 이미지 업데이트
          setSceneImagePrompts((prev) => {
            return prev.map((scene) => {
              if (scene.sceneNumber === sceneNumber) {
                return {
                  ...scene,
                  images: scene.images.map((img) => {
                    if (img.imageNumber === imageNumber) {
                      return {
                        ...img,
                        imageUrl: imageUrl,
                      }
                    }
                    return img
                  }),
                }
              }
              return scene
            })
          })
          
          // 이미지로 교체했으므로 변환된 영상 제거
          setConvertedSceneVideos((prev) => {
            const newMap = new Map(prev)
            newMap.delete(`${sceneNumber}-${imageNumber}`)
            return newMap
          })

          // alert("이미지가 업로드되었습니다!") // 완료 알림 제거
        }
        reader.readAsDataURL(resizedImage)
      }
    } catch (error) {
      console.error(`[Scene] 파일 업로드 실패 (Scene ${sceneNumber}, Image ${imageNumber}):`, error)
      alert(`파일 업로드에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
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

  // Scene 이미지를 영상으로 변환하는 핸들러
  const handleConvertSceneImageToVideo = async (sceneNumber: number, imageNumber: number, imageUrl: string) => {
    const videoKey = `${sceneNumber}-${imageNumber}`
    
    if (isConvertingSceneVideo.has(videoKey)) {
      return
    }

    setIsConvertingSceneVideo((prev) => new Set(prev).add(videoKey))
    
    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      setIsConvertingSceneVideo((prev) => {
        const newSet = new Set(prev)
        newSet.delete(videoKey)
        return newSet
      })
      return
    }

    try {
      const { convertImageToVideo } = await import("./actions")
      const videoUrl = await convertImageToVideo(imageUrl, replicateApiKey)
      
      if (videoUrl) {
        setConvertedSceneVideos((prev) => {
          const newMap = new Map(prev)
          newMap.set(videoKey, videoUrl)
          return newMap
        })
        console.log(`[Scene Video] 이미지-투-비디오 변환 완료 (Scene ${sceneNumber}, Image ${imageNumber}):`, videoUrl)
      }
    } catch (error) {
      console.error(`[Scene Video] 이미지-투-비디오 변환 실패 (Scene ${sceneNumber}, Image ${imageNumber}):`, error)
      alert(`영상 변환에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsConvertingSceneVideo((prev) => {
        const newSet = new Set(prev)
        newSet.delete(videoKey)
        return newSet
      })
    }
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
    // 변환된 영상 데이터 초기화 (영상 제거)
    setConvertedVideos(new Map())

    let successCount = 0
    let commonStylePrompt: string | undefined = undefined

    try {
      // 1. 전체 대본의 공통 스타일 프롬프트 생성 (첫 번째 이미지 생성 전)
      const topic = isCustomTopicSelected ? customTopic : selectedTopic
      if (topic) {
        try {
          // commonStylePrompt = await generateCommonStylePrompt(
          //   topic,
          //   selectedCategory || "health",
          //   openaiApiKey,
          //   imageStyle
          // )
          // 임시로 주석 처리 (import 에러 해결 후 활성화)
          commonStylePrompt = undefined
          // console.log("[v0] 공통 스타일 프롬프트 생성 완료:", commonStylePrompt)
        } catch (error) {
          console.warn("[v0] 공통 스타일 프롬프트 생성 실패, 계속 진행:", error)
          // 공통 스타일 생성 실패해도 계속 진행
        }
      }

      // 2. 각 문장에 대해 이미지 생성
      shouldStopImageGeneration.current = false // 중단 플래그 초기화
      for (let i = 0; i < scriptLines.length; i++) {
        // 중단 체크
        if (shouldStopImageGeneration.current) {
          console.log("[v0] 이미지 생성 중단됨")
          // alert(`이미지 생성을 중단했습니다. (${successCount}개 생성 완료)`) // 완료 알림 제거
          break
        }
        
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
              historyStyle: imageStyle, // 모든 카테고리에서 스타일 적용
              commonStylePrompt, // 공통 스타일 프롬프트 전달
              topic: isCustomTopicSelected ? customTopic : selectedTopic, // 주제 전달 (시대적 배경 파악용)
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
          // alert(`${successCount}개의 이미지가 생성되었습니다!`) // 완료 알림 제거
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
      shouldStopImageGeneration.current = false // 중단 플래그 초기화
    }
  }

  // 목소리 미리듣기 함수
  const handlePreviewVoice = async (voiceId: string) => {
    setPreviewingVoiceId(voiceId)
    
    try {
      let response: Response
      
      // Google TTS인 경우
      if (voiceId?.startsWith("ttsmaker-")) {
        // TTSMaker인 경우
        const voiceName = voiceId.replace("ttsmaker-", "")
        // 남성5는 음높이 -10% (pitch 0.9)
        const pitch = voiceName === "남성5" ? 0.9 : 1.0
        const ttsmakerApiKey = getApiKey("ttsmaker_api_key")
        
        if (!ttsmakerApiKey) {
          alert("TTSMaker API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
          setPreviewingVoiceId(null)
          return
        }
        
        console.log(`[미리듣기] TTSMaker voice: ${voiceId} -> ${voiceName}, pitch: ${pitch}`)
        response = await fetch("/api/ttsmaker", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "여러분 환영합니다",
            voice: voiceName,
            speed: 1.0,
            pitch: pitch,
            apiKey: ttsmakerApiKey,
          }),
        })
      } else {
        // ElevenLabs인 경우
        const elevenlabsApiKey = getApiKey("elevenlabs_api_key")
        
        if (!elevenlabsApiKey) {
          alert("ElevenLabs API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
          setPreviewingVoiceId(null)
          return
        }
        
        response = await fetch("/api/elevenlabs-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "여러분 환영합니다",
            voiceId: voiceId,
            apiKey: elevenlabsApiKey,
          }),
        })
      }

      if (!response.ok) {
        let errorMessage = "미리듣기 실패"
        try {
          // response를 clone해서 읽기 (원본 response는 나중에 사용할 수 있도록)
          const clonedResponse = response.clone()
          const errorData = await clonedResponse.json()
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
        } catch (e) {
          // JSON 파싱 실패 시 텍스트로 읽기 시도
          try {
            const errorText = await response.text()
            errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`
          }
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

  // 6.25만 한글로 변환하는 함수 (6.25 -> 육이오)
  const convertNumbersToKorean = (text: string): string => {
    // 6.25만 "육이오"로 변환
    return text.replace(/6\.25/g, "육이오")
  }

  // TTS 생성 재시도 헬퍼 함수
  const generateTTSWithRetry = async (
    line: { id: number; text: string },
    selectedVoiceId: string,
    maxRetries: number = 5
  ): Promise<{ audioUrl: string; audioBase64: string; alignment?: any }> => {
    let lastError: Error | null = null
    
    // 숫자를 한글로 변환
    const convertedText = convertNumbersToKorean(line.text)
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let response: Response
        
        // TTSMaker인 경우
        if (selectedVoiceId?.startsWith("ttsmaker-")) {
          // TTSMaker인 경우
          const voiceName = selectedVoiceId.replace("ttsmaker-", "")
          const pitch = voiceName === "남성5" ? 0.9 : 1.0
          const ttsmakerApiKey = getApiKey("ttsmaker_api_key")
          
          if (!ttsmakerApiKey) {
            throw new Error("TTSMaker API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
          }
          
          response = await fetch("/api/ttsmaker", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: convertedText,
              voice: voiceName,
              speed: 1.0,
              pitch: pitch,
              apiKey: ttsmakerApiKey,
            }),
          })
        } else {
          // ElevenLabs API를 통해 TTS 생성
          const elevenlabsApiKey = getApiKey("elevenlabs_api_key")
          response = await fetch("/api/elevenlabs-tts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: convertedText,
              voiceId: selectedVoiceId,
              apiKey: elevenlabsApiKey,
            }),
          })
        }

        if (!response.ok) {
          let errorMessage = "TTS 생성 실패"
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
        
        if (!data.audioBase64 && !data.audioUrl) {
          throw new Error("TTS 응답에 오디오 데이터가 없습니다.")
        }
        
        // 성공 시 반환 (alignment 데이터 포함)
        return {
          audioUrl: data.audioUrl,
          audioBase64: data.audioBase64,
          alignment: data.alignment || undefined, // alignment 데이터 포함
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`[TTS 재시도] 시도 ${attempt}/${maxRetries} 실패 (줄 ${line.id}):`, lastError.message)
        
        // 마지막 시도가 아니면 대기 후 재시도
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // 지수 백오프, 최대 10초
          console.log(`[TTS 재시도] ${delay}ms 후 재시도...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    // 모든 재시도 실패
    throw lastError || new Error("TTS 생성에 실패했습니다.")
  }

  // 개별 문장 TTS 생성 핸들러
  const handleGenerateTTSForSingleLine = async (lineId: number) => {
    const line = scriptLines.find((l) => l.id === lineId)
    if (!line) {
      alert("문장을 찾을 수 없습니다.")
      return
    }

    // TTSMaker와 ElevenLabs는 API 키 필요
    if (selectedVoiceId?.startsWith("ttsmaker-")) {
      const ttsmakerApiKey = getApiKey("ttsmaker_api_key")
      if (!ttsmakerApiKey) {
        alert("TTSMaker API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
        return
      }
    } else {
      const elevenlabsApiKey = getApiKey("elevenlabs_api_key")
      if (!elevenlabsApiKey) {
        alert("ElevenLabs API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
        return
      }
    }

    // 이미 생성된 TTS가 있는지 확인
    const existingAudio = generatedAudios.find((audio) => audio.lineId === lineId)
    if (existingAudio) {
      const confirmReplace = confirm("이미 생성된 TTS가 있습니다. 다시 생성하시겠습니까?")
      if (!confirmReplace) return
      
      // 기존 TTS 제거
      setGeneratedAudios((prev) => prev.filter((audio) => audio.lineId !== lineId))
    }

    setGeneratingTTSForLine((prev) => new Set(prev).add(lineId))

    try {
      console.log(`[개별 TTS] 문장 ${lineId} TTS 생성 시작: ${line.text.substring(0, 30)}...`)
      
      // 재시도 로직이 포함된 TTS 생성
      const data = await generateTTSWithRetry(line, selectedVoiceId)
      
      console.log(`[개별 TTS] 문장 ${lineId} TTS 생성 완료`)

      // TTS가 생성되면 state 업데이트
      setGeneratedAudios((prev) => {
        // 기존 항목 제거 (있으면)
        const filtered = prev.filter((audio) => audio.lineId !== lineId)
        return [
          ...filtered,
          {
            lineId: line.id,
            audioUrl: data.audioUrl,
            audioBase64: data.audioBase64,
          },
        ]
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[개별 TTS] 문장 ${lineId} TTS 생성 실패:`, errorMessage)
      alert(`문장 ${lineId}의 TTS 생성에 실패했습니다: ${errorMessage}`)
    } finally {
      setGeneratingTTSForLine((prev) => {
        const newSet = new Set(prev)
        newSet.delete(lineId)
        return newSet
      })
    }
  }

  // TTS 생성 핸들러 (문장 리스트 기반)
  const handleGenerateTTSForLines = async () => {
    if (scriptLines.length === 0) {
      alert("생성된 문장 리스트가 없습니다. 먼저 대본을 생성해주세요.")
      return
    }

    // TTSMaker와 ElevenLabs는 API 키 필요
    if (!selectedVoiceId?.startsWith("ttsmaker-")) {
      const elevenlabsApiKey = getApiKey("elevenlabs_api_key")
      if (!elevenlabsApiKey) {
        alert("ElevenLabs API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
        if (isAutoMode) {
          setIsAutoMode(false)
          setAutoModeStep("")
        }
        return
      }
    }

    setIsGeneratingTTS(true)
    if (isAutoMode) {
      setAutoModeStep("TTS 생성 중...")
      setAutoModeProgress({ current: "5/7", total: 7 })
    }
    
    // 씬별 처리 여부 확인
    const useSceneBasedTTS = decomposedScenes && decomposedScenes.trim().length > 0
    
    if (useSceneBasedTTS) {
      console.log("[TTS] 씬별 TTS 생성 모드 사용")
      
      // 씬별로 파싱
      const sceneBlocks = decomposedScenes.split(/(?=씬\s+\d+)/).filter(block => block.trim().length > 0)
      const parsedScenes: Array<{
        sceneNumber: number
        scenes: Array<{ imageNumber: number; text: string }>
      }> = []
      
      for (const sceneBlock of sceneBlocks) {
        const sceneNumMatch = sceneBlock.match(/씬\s+(\d+)/)
        if (!sceneNumMatch) continue
        
        const sceneNum = parseInt(sceneNumMatch[1])
        const sceneImages: Array<{ imageNumber: number; text: string }> = []
        
        const imageRegex = /\[장면\s+(\d+)\]\s*\n([\s\S]*?)(?=\[장면\s+\d+\]|씬\s+\d+|$)/g
        let imageMatch
        
        while ((imageMatch = imageRegex.exec(sceneBlock)) !== null) {
          const imageNum = parseInt(imageMatch[1])
          const imageText = imageMatch[2].trim()
          
          if (imageText) {
            sceneImages.push({
              imageNumber: imageNum,
              text: imageText,
            })
          }
        }
        
        if (sceneImages.length > 0) {
          parsedScenes.push({
            sceneNumber: sceneNum,
            scenes: sceneImages,
          })
        }
      }
      
      console.log(`[TTS] 파싱된 씬 수: ${parsedScenes.length}`)
      parsedScenes.forEach(scene => {
        console.log(`[TTS] 씬 ${scene.sceneNumber}: ${scene.scenes.length}개의 장면 발견`)
        scene.scenes.forEach(img => {
          console.log(`[TTS]   - 장면 ${img.imageNumber}: "${img.text.substring(0, 50)}..."`)
        })
      })
      
      // 각 장면의 텍스트를 그대로 하나의 TTS로 생성 (문장 분리 없이)
      const sceneTextsForTTS: Array<{ sceneNumber: number; imageNumber: number; text: string; lineId: number }> = []
      let lineIdCounter = 1
      
      for (const parsedScene of parsedScenes) {
        for (const scene of parsedScene.scenes) {
          // 각 장면의 텍스트를 그대로 사용 (문장 분리 없이)
          const text = scene.text.trim()
          
          if (text.length > 0) {
            sceneTextsForTTS.push({
              sceneNumber: parsedScene.sceneNumber,
              imageNumber: scene.imageNumber,
              text: text,
              lineId: lineIdCounter++,
            })
            
            console.log(`[TTS] 씬 ${parsedScene.sceneNumber} 장면 ${scene.imageNumber} 추가: "${text.substring(0, 50)}..."`)
          }
        }
      }
      
      console.log(`[TTS] 총 ${sceneTextsForTTS.length}개의 장면에 대해 TTS 생성`)
      
      setTtsGenerationProgress({ current: 0, total: sceneTextsForTTS.length })
      setGeneratedAudios([])
      
      let successCount = 0
      let currentProgress = 0
      
      try {
        // 각 장면별로 TTS 생성
        console.log(`[TTS] TTS 생성 시작: 총 ${sceneTextsForTTS.length}개 문장`)
        console.log(`[TTS] 장면별 분포:`, sceneTextsForTTS.reduce((acc, item) => {
          const key = `씬${item.sceneNumber}-장면${item.imageNumber}`
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {} as Record<string, number>))
        
        for (let i = 0; i < sceneTextsForTTS.length; i++) {
          const sceneText = sceneTextsForTTS[i]
          currentProgress++
          setTtsGenerationProgress({ current: currentProgress, total: sceneTextsForTTS.length })
          
          try {
            console.log(`[TTS] [${i + 1}/${sceneTextsForTTS.length}] 씬 ${sceneText.sceneNumber} 장면 ${sceneText.imageNumber} TTS 생성 시작: "${sceneText.text.substring(0, 50)}..."`)
            
            const data = await generateTTSWithRetry({ id: sceneText.lineId, text: sceneText.text }, selectedVoiceId)
            
            console.log(`[TTS] [${i + 1}/${sceneTextsForTTS.length}] 씬 ${sceneText.sceneNumber} 장면 ${sceneText.imageNumber} TTS 생성 완료`)
            
            setGeneratedAudios((prev) => {
              const newAudios = [
                ...prev,
                {
                  lineId: sceneText.lineId,
                  audioUrl: data.audioUrl,
                  audioBase64: data.audioBase64,
                  alignment: data.alignment || undefined, // alignment 데이터 저장
                },
              ]
              console.log(`[TTS] 현재 생성된 TTS 개수: ${newAudios.length}`)
              return newAudios
            })
            successCount++
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.error(`[TTS] [${i + 1}/${sceneTextsForTTS.length}] 씬 ${sceneText.sceneNumber} 장면 ${sceneText.imageNumber} TTS 생성 실패:`, errorMessage)
          }
        }
        
        console.log("[TTS] 모든 장면별 TTS 생성 완료, 성공:", successCount, "개 / 전체:", sceneTextsForTTS.length, "개")
        
        if (successCount > 0) {
          console.log("[TTS] TTS 생성 완료 - 사이드바 완료 표시 업데이트")
          setCompletedSteps((prev) => {
            if (!prev.includes("video")) {
              console.log("[TTS] 'video' 단계를 완료 목록에 추가")
              return [...prev, "video"]
            }
            console.log("[TTS] 'video' 단계는 이미 완료 목록에 있음")
            return prev
          })
          
          if (!isAutoMode) {
            if (successCount < sceneTextsForTTS.length) {
              // alert(`${successCount}개의 TTS가 생성되었습니다. (${sceneTextsForTTS.length - successCount}개 실패)\n\n실패한 항목은 브라우저 콘솔을 확인해주세요.`) // 완료 알림 제거
            } else {
              // alert(`${successCount}개의 TTS가 모두 생성되었습니다!`) // 완료 알림 제거
            }
          }
          
          if (isAutoMode) {
            console.log("[TTS] 자동화 모드: 영상 생성 시작")
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
      
      return
    }
    
    // 기존 로직 (씬별 TTS가 아닌 경우)
    setTtsGenerationProgress({ current: 0, total: scriptLines.length })
    // 기존 오디오 초기화
    setGeneratedAudios([])

    let successCount = 0

    try {
      for (let i = 0; i < scriptLines.length; i++) {
        const line = scriptLines[i]
        setTtsGenerationProgress({ current: i + 1, total: scriptLines.length })

        try {
          console.log(`[v0] TTS 생성 시작 (${i + 1}/${scriptLines.length}): ${line.text.substring(0, 30)}...`)
          
          // 재시도 로직이 포함된 TTS 생성
          const data = await generateTTSWithRetry(line, selectedVoiceId)
          
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
          console.error(`[v0] TTS 생성 최종 실패 (줄 ${line.id}):`, errorMessage)
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
            // alert(`${successCount}개의 TTS가 생성되었습니다. (${scriptLines.length - successCount}개 실패)\n\n실패한 항목은 브라우저 콘솔을 확인해주세요.`) // 완료 알림 제거
          } else {
            // alert(`${successCount}개의 TTS가 모두 생성되었습니다!`) // 완료 알림 제거
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
    if (scriptLines.length === 0 || generatedAudios.length === 0) {
      alert("TTS와 대본이 모두 준비되어야 합니다.")
      return
    }

    // 씬별 이미지가 있는지 확인 (sceneImagePrompts)
    const hasSceneImages = sceneImagePrompts.length > 0 && sceneImagePrompts.some(scene => 
      scene.images.some(img => img.imageUrl)
    )
    
    if (!hasSceneImages && generatedImages.length === 0) {
      alert("이미지가 필요합니다. 씬별 이미지 또는 일반 이미지를 생성해주세요.")
      return
    }

    setIsGeneratingVideo(true)
    setGeneratingVideoProgress(0)

    try {
      console.log("[v0] 영상 렌더링 시작")
      
      // 씬별 처리 여부 확인
      const useSceneBasedRendering = decomposedScenes && decomposedScenes.trim().length > 0 && hasSceneImages
      
      if (useSceneBasedRendering) {
        console.log("[v0] 씬별 렌더링 모드 사용")
        
        // 씬별로 파싱
        const sceneBlocks = decomposedScenes.split(/(?=씬\s+\d+)/).filter(block => block.trim().length > 0)
        const parsedScenes: Array<{
          sceneNumber: number
          scenes: Array<{ imageNumber: number; text: string }>
        }> = []
        
        for (const sceneBlock of sceneBlocks) {
          const sceneNumMatch = sceneBlock.match(/씬\s+(\d+)/)
          if (!sceneNumMatch) continue
          
          const sceneNum = parseInt(sceneNumMatch[1])
          const sceneImages: Array<{ imageNumber: number; text: string }> = []
          
          // Scene 블록 내에서 모든 [장면 N] 패턴 찾기
          const imageRegex = /\[장면\s+(\d+)\]\s*\n([\s\S]*?)(?=\[장면\s+\d+\]|씬\s+\d+|$)/g
          let imageMatch
          
          while ((imageMatch = imageRegex.exec(sceneBlock)) !== null) {
            const imageNum = parseInt(imageMatch[1])
            const imageText = imageMatch[2].trim()
            
            if (imageText) {
              sceneImages.push({
                imageNumber: imageNum,
                text: imageText,
              })
            }
          }
          
          if (sceneImages.length > 0) {
            parsedScenes.push({
              sceneNumber: sceneNum,
              scenes: sceneImages,
            })
          }
        }
        
        console.log(`[v0] 파싱된 씬 수: ${parsedScenes.length}`)
        
        // 씬별로 오디오와 이미지 매핑 (각 장면의 텍스트에 맞는 TTS 사용)
        const sceneAudioMapping: Map<number, Array<{ lineId: number; text: string; imageNumber: number }>> = new Map()
        let globalLineId = 1
        
        for (const parsedScene of parsedScenes) {
          const sceneData = sceneImagePrompts.find(s => s.sceneNumber === parsedScene.sceneNumber)
          if (!sceneData) continue
          
          // 각 장면의 텍스트에 맞는 TTS 매핑 (장면 분해 결과의 텍스트를 직접 사용)
          const sceneLines: Array<{ lineId: number; text: string; imageNumber: number }> = []
          
          for (const scene of parsedScene.scenes) {
            // 각 장면의 텍스트에 해당하는 lineId 찾기 (TTS 생성 시 사용된 lineId와 일치)
            // TTS 생성 시 lineIdCounter로 생성했으므로, 같은 순서로 매칭
            const lineId = globalLineId++
            
            sceneLines.push({
              lineId: lineId,
              text: scene.text,
              imageNumber: scene.imageNumber,
            })
            
            console.log(`[v0] 씬 ${parsedScene.sceneNumber} 장면 ${scene.imageNumber} 매핑: lineId=${lineId}, 텍스트="${scene.text.substring(0, 30)}..."`)
          }
          
          sceneAudioMapping.set(parsedScene.sceneNumber, sceneLines)
        }
        
        // 1. 각 TTS 오디오의 정확한 길이 측정 (씬별)
        const audioDurations: Array<{ lineId: number; duration: number; audioBuffer?: AudioBuffer }> = []
        const audioContextForAnalysis = new (window.AudioContext || (window as any).webkitAudioContext)()
        
        // 모든 씬의 오디오 길이 측정
        for (const [sceneNum, lines] of sceneAudioMapping.entries()) {
          for (const line of lines) {
            const audio = generatedAudios.find((a) => a.lineId === line.lineId)
            if (audio) {
              try {
                const audioResponse = await fetch(audio.audioUrl)
                const audioArrayBuffer = await audioResponse.arrayBuffer()
                const audioBuffer = await audioContextForAnalysis.decodeAudioData(audioArrayBuffer)
                const preciseDuration = audioBuffer.duration
                
                audioDurations.push({
                  lineId: line.lineId,
                  duration: preciseDuration,
                  audioBuffer: audioBuffer,
                })
                
                console.log(`[v0] 씬 ${sceneNum} 오디오 ${line.lineId} 길이: ${preciseDuration.toFixed(3)}초`)
              } catch (error) {
                console.error(`오디오 로드 실패 (씬 ${sceneNum}, 줄 ${line.lineId}):`, error)
                const audioElement = new Audio(audio.audioUrl)
                await new Promise((resolve) => {
                  audioElement.addEventListener("loadedmetadata", () => {
                    audioDurations.push({
                      lineId: line.lineId,
                      duration: audioElement.duration,
                    })
                    resolve(null)
                  })
                  audioElement.addEventListener("error", () => {
                    audioDurations.push({
                      lineId: line.lineId,
                      duration: 0,
                    })
                    resolve(null)
                  })
                })
              }
            }
          }
        }
        
        // 2. 자막 생성 (씬별)
        const subtitles: Array<{ id: number; start: number; end: number; text: string }> = []
        
        const splitIntoSubtitleLines = (text: string, audioBuffer?: AudioBuffer, totalDuration: number = 0): Array<{ text: string; startTime: number; endTime: number }> => {
          const words = text.split(" ").filter(w => w.trim().length > 0)
          if (words.length === 0) return [{ text, startTime: 0, endTime: totalDuration }]
          
          const result: Array<{ text: string; startTime: number; endTime: number }> = []
          let silenceThreshold = 0.01
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
            const timePerWord = totalDuration / words.length
            for (let i = 0; i < words.length; i++) {
              wordStartTimes.push(i * timePerWord)
            }
          }
          
          let currentLine: string[] = []
          let lineStartTime = 0
          const maxChars = 20 // 공백 포함 20자까지
          
          for (let i = 0; i < words.length; i++) {
            const word = words[i]
            const testLine = currentLine.length > 0 ? currentLine.join(" ") + " " + word : word
            
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
        
        // 씬별로 자막 생성
        for (const [sceneNum, lines] of sceneAudioMapping.entries()) {
          for (const line of lines) {
            const audioData = audioDurations.find((d) => d.lineId === line.lineId)
            const audioDuration = audioData?.duration || 0
            const audioBuffer = audioData?.audioBuffer
            
            if (audioDuration > 0) {
              const subtitleLines = splitIntoSubtitleLines(line.text, audioBuffer, audioDuration)
              
              for (let j = 0; j < subtitleLines.length; j++) {
                const subtitleLine = subtitleLines[j]
                const start = subtitleTime + subtitleLine.startTime
                const end = subtitleTime + subtitleLine.endTime
                
                subtitles.push({
                  id: subtitleId++,
                  start: Number.parseFloat(start.toFixed(3)),
                  end: Number.parseFloat(end.toFixed(3)),
                  text: subtitleLine.text,
                })
              }
              
              subtitleTime += audioDuration
            }
          }
        }
        
        // 3. 이미지 매핑 (씬별)
        const autoImages: Array<{
          id: string
          url: string
          startTime: number
          endTime: number
          keyword: string
          motion?: string
        }> = []
        
        let imageTime = 0
        
        // 씬별로 이미지 매핑 (각 장면의 TTS와 정확히 매칭)
        for (const parsedScene of parsedScenes) {
          const sceneData = sceneImagePrompts.find(s => s.sceneNumber === parsedScene.sceneNumber)
          if (!sceneData) continue
          
          const sceneLines = sceneAudioMapping.get(parsedScene.sceneNumber) || []
          
          // 각 장면의 TTS와 이미지를 정확히 매칭
          for (const line of sceneLines) {
            const audioDuration = audioDurations.find(d => d.lineId === line.lineId)?.duration || 0
            
            if (audioDuration > 0) {
              // 해당 장면의 이미지 찾기 (imageNumber로 매칭)
              const image = sceneData.images.find(img => img.imageNumber === line.imageNumber && img.imageUrl)
              
              if (image && image.imageUrl) {
                // 영상으로 변환된 이미지가 있으면 영상 URL 사용, 없으면 이미지 URL 사용
                const videoKey = `${parsedScene.sceneNumber}-${line.imageNumber}`
                const videoUrl = convertedSceneVideos.get(videoKey)
                const finalUrl = videoUrl || image.imageUrl
                
                autoImages.push({
                  id: `scene_${parsedScene.sceneNumber}_image_${line.imageNumber}`,
                  url: finalUrl,
                  startTime: imageTime,
                  endTime: imageTime + audioDuration,
                  keyword: line.text.substring(0, 30),
                  motion: "static",
                })
                
                console.log(`[v0] 씬 ${parsedScene.sceneNumber} 장면 ${line.imageNumber} 매핑: ${videoUrl ? "영상" : "이미지"}=${finalUrl.substring(0, 50)}..., TTS 길이=${audioDuration.toFixed(3)}초`)
              }
              
              imageTime += audioDuration
            }
          }
        }
        
        // 4. 모든 TTS 오디오를 하나로 합치기
        const calculatedTotalDuration = audioDurations.reduce((sum, d) => sum + d.duration, 0)
        
        const firstImage = autoImages[0]
        if (!firstImage) {
          throw new Error("이미지가 없습니다.")
        }
        
        // 5. 모든 오디오를 순차적으로 합치기
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const audioBuffers: AudioBuffer[] = []
        
        // 씬별로 오디오 수집
        for (const [sceneNum, lines] of sceneAudioMapping.entries()) {
          for (const line of lines) {
            const audio = generatedAudios.find((a) => a.lineId === line.lineId)
            if (audio) {
              try {
                const audioResponse = await fetch(audio.audioUrl)
                const audioArrayBuffer = await audioResponse.arrayBuffer()
                const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer)
                audioBuffers.push(audioBuffer)
              } catch (error) {
                console.error(`오디오 디코딩 실패 (씬 ${sceneNum}, 줄 ${line.lineId}):`, error)
              }
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
        
        const actualMergedDuration = mergedBuffer.duration
        console.log(`[v0] 계산된 총 길이: ${calculatedTotalDuration.toFixed(3)}초, 실제 병합된 오디오 길이: ${actualMergedDuration.toFixed(3)}초`)
        
        const durationRatio = actualMergedDuration > 0 && calculatedTotalDuration > 0 
          ? actualMergedDuration / calculatedTotalDuration 
          : 1.0
        
        console.log(`[v0] Duration ratio: ${durationRatio.toFixed(4)}`)
        
        if (durationRatio !== 1.0) {
          console.log(`[v0] 자막 타이밍 조정 중... (ratio: ${durationRatio.toFixed(4)})`)
          for (let i = 0; i < subtitles.length; i++) {
            subtitles[i].start = Number.parseFloat((subtitles[i].start * durationRatio).toFixed(3))
            subtitles[i].end = Number.parseFloat((subtitles[i].end * durationRatio).toFixed(3))
          }
          
          for (let i = 0; i < autoImages.length; i++) {
            autoImages[i].startTime = Number.parseFloat((autoImages[i].startTime * durationRatio).toFixed(3))
            autoImages[i].endTime = Number.parseFloat((autoImages[i].endTime * durationRatio).toFixed(3))
          }
          console.log(`[v0] 자막 및 이미지 타이밍 조정 완료`)
        }
        
        const totalDuration = actualMergedDuration
        
        console.log("[v0] 미리보기용 오디오 생성 (원본 품질 유지)")
        
        const wav = audioBufferToWav(mergedBuffer)
        const uint8Array = new Uint8Array(wav)
        
        let binaryString = ""
        const chunkSize = 8192
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize)
          binaryString += String.fromCharCode.apply(null, Array.from(chunk))
        }
        const audioBase64 = btoa(binaryString)
        
        console.log("[v0] 미리보기 생성 시작")
        console.log("[v0] 자막 수:", subtitles.length)
        console.log("[v0] 이미지 수:", autoImages.length)
        console.log("[v0] 총 영상 길이:", totalDuration, "초")
        
        const audioBlob = new Blob([wav], { type: "audio/wav" })
        const audioUrl = URL.createObjectURL(audioBlob)
        
        console.log("[v0] 오디오 Blob URL 생성 완료:", audioUrl)
        
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
        
        setAutoImages(autoImages.map((img) => ({
          id: img.id,
          url: img.url,
          startTime: img.startTime,
          endTime: img.endTime,
          keyword: img.keyword,
          motion: (img.motion || "static") as "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "static",
        })))
        
        console.log("[v0] 미리보기 데이터 생성 완료 (씬별 렌더링)")
        setIsGeneratingVideo(false)
        setGeneratingVideoProgress(100)
        // 영상 렌더링 단계 체크
        setCompletedSteps((prev) => [...new Set([...prev, "render"])])
        
        if (isAutoMode) {
          setAutoModeStep("빠른다운로드 중...")
          setAutoModeProgress({ current: "7/7", total: 7 })
          console.log("[v0] 자동화 모드: 빠른다운로드 시작")
          setTimeout(() => handleFastDownload(), 2000)
        } else {
          alert("영상 미리보기가 준비되었습니다!")
        }
        
        return
      }
      
      // 기존 로직 (씬별 렌더링이 아닌 경우)
      console.log("[v0] 일반 렌더링 모드 사용")

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
        
        // 단어들을 묶어서 자막 라인 생성 (공백 포함 최대 20자)
        let currentLine: string[] = []
        let lineStartTime = 0
        const maxChars = 20 // 공백 포함 20자까지
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i]
          const testLine = currentLine.length > 0 ? currentLine.join(" ") + " " + word : word
          
          // 20자를 초과하면 줄 분리 (20자까지는 나오도록)
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
            // 영상으로 변환된 이미지가 있으면 영상 URL 사용, 없으면 이미지 URL 사용
            const videoUrl = convertedVideos.get(line.id)
            const finalUrl = videoUrl || image.imageUrl
            
            autoImages.push({
              id: `image_${line.id}`,
              url: finalUrl,
              startTime: imageStartTime,
              endTime: imageEndTime,
              keyword: `문장 ${line.id}`,
              motion: "static",
            })
            
            console.log(`[v0] 문장 ${line.id} 매핑: ${videoUrl ? "영상" : "이미지"}=${finalUrl.substring(0, 50)}...`)
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
      // 영상 렌더링 단계 체크
      setCompletedSteps((prev) => [...new Set([...prev, "render"])])
      
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

  // 이미지를 1920x1080으로 리사이즈하는 헬퍼 함수
  const resizeImageTo1920x1080 = async (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas")
          canvas.width = 1920
          canvas.height = 1080
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("Canvas context를 생성할 수 없습니다."))
            return
          }

          // 이미지를 1920x1080에 맞게 중앙 크롭
          const targetWidth = 1920
          const targetHeight = 1080
          const targetRatio = targetWidth / targetHeight
          const imgRatio = img.width / img.height

          let sourceX = 0
          let sourceY = 0
          let sourceWidth = img.width
          let sourceHeight = img.height

          if (imgRatio > targetRatio) {
            // 이미지가 더 넓은 경우: 높이 기준으로 크롭 (좌우 잘림)
            sourceHeight = img.height
            sourceWidth = img.height * targetRatio
            sourceX = (img.width - sourceWidth) / 2
            sourceY = 0
          } else {
            // 이미지가 더 높은 경우: 너비 기준으로 크롭 (상하 잘림)
            sourceWidth = img.width
            sourceHeight = img.width / targetRatio
            sourceX = 0
            sourceY = (img.height - sourceHeight) / 2
          }

          // 이미지를 1920x1080에 딱 맞게 그리기
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, targetWidth, targetHeight
          )

          // base64로 변환
          const base64 = canvas.toDataURL("image/png")
          resolve(base64)
        } catch (error) {
          reject(error)
        }
      }
      img.onerror = () => reject(new Error("이미지 로드 실패"))
      img.src = imageUrl
    })
  }

  // 빠른다운로드: Cloud Run 사용
  const handleFastDownload = async () => {
    // 씬별 이미지가 있는지 확인
    const hasSceneImages = sceneImagePrompts.length > 0 && sceneImagePrompts.some(scene => 
      scene.images.some(img => img.imageUrl)
    )
    const hasImages = hasSceneImages || generatedImages.length > 0
    
    // 디버깅 정보
    console.log("[빠른다운로드] videoData 확인:", {
      hasVideoData: !!videoData,
      videoDataKeys: videoData ? Object.keys(videoData) : [],
      scriptLinesCount: scriptLines.length,
      hasImages,
      hasSceneImages,
      generatedImagesCount: generatedImages.length,
      generatedAudiosCount: generatedAudios.length,
    })
    
    if (!videoData) {
      alert("영상 데이터가 없습니다. 먼저 '영상 생성' 버튼을 클릭하여 미리보기를 생성해주세요.")
      return
    }
    
    if (scriptLines.length === 0 || !hasImages || generatedAudios.length === 0) {
      alert("필수 데이터가 부족합니다. 대본, 이미지, TTS가 모두 준비되어야 합니다.")
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
      
      // 원본 오디오를 그대로 사용 (압축하지 않음)
      console.log("[v0] 원본 오디오를 그대로 사용 (압축하지 않음)")
      
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
      
      // 압축 로직 제거 - 원본 그대로 사용
      
      // Cloud Storage 사용 여부 결정
      // Vercel의 요청 크기 제한(4.5MB)을 고려하여 base64 크기가 3MB 이상이면 Cloud Storage 사용
      // base64 인코딩으로 인해 실제 크기가 더 커질 수 있으므로 여유있게 설정
      // 개발 환경과 배포 환경 모두에서 안전하게 작동하도록 낮은 임계값 사용
      const useCloudStorage = audioBase64.length > 3 * 1024 * 1024 // 3MB 이상이면 Cloud Storage 사용
      let audioGcsUrl: string | null = null
      
      if (useCloudStorage) {
        console.log("[v0] 오디오가 큽니다. Cloud Storage에 직접 업로드합니다...")
        
        try {
          // 1. Signed URL 요청 (작은 요청만 서버로 전송)
          const signedUrlResponse = await fetch("/api/upload-to-gcs/signed-url", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileName: `audio_${Date.now()}.wav`,
              contentType: "audio/wav",
            }),
          })
          
          if (!signedUrlResponse.ok) {
            const errorData = await signedUrlResponse.json()
            throw new Error(errorData.error || "Signed URL 생성 실패")
          }
          
          const { signedUrl, publicUrl } = await signedUrlResponse.json()
          console.log("[v0] Signed URL 생성 완료, 직접 업로드 시작...")
          
          // 2. base64를 Blob으로 변환
          const binaryString = atob(audioBase64)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          const audioBlob = new Blob([bytes], { type: "audio/wav" })
          
          // 3. Signed URL을 사용하여 클라이언트에서 직접 Cloud Storage에 업로드
          const uploadResponse = await fetch(signedUrl, {
            method: "PUT",
            headers: {
              "Content-Type": "audio/wav",
            },
            body: audioBlob,
          })
          
          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text()
            throw new Error(`Cloud Storage 직접 업로드 실패 (${uploadResponse.status}): ${errorText.substring(0, 200)}`)
          }
          
          // 4. 파일을 공개로 설정 (별도 API 호출)
          // 공개 URL 사용을 위해 파일을 공개로 설정
          try {
            await fetch(`/api/upload-to-gcs/make-public`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                fileName: publicUrl.split("/").pop() || "",
              }),
            })
          } catch (makePublicError) {
            console.warn("[v0] 파일 공개 설정 실패 (무시하고 계속 진행):", makePublicError)
            // 공개 설정 실패해도 계속 진행 (signed URL로 접근 가능)
          }
          
          audioGcsUrl = publicUrl
          console.log("[v0] Cloud Storage 직접 업로드 완료:", audioGcsUrl)
          
          // Cloud Storage 업로드 성공 시 base64는 null로 설정 (전송하지 않음)
          audioBase64 = ""
        } catch (uploadError) {
          console.error("[v0] Cloud Storage 업로드 실패:", uploadError)
          // 업로드 실패 시 오류 표시하고 중단
          const errorMessage = uploadError instanceof Error ? uploadError.message : "알 수 없는 오류"
          alert(
            `Cloud Storage 업로드에 실패했습니다.\n\n` +
            `오류: ${errorMessage}\n\n` +
            `Cloud Storage 설정을 확인해주세요.`
          )
          setIsExporting(false)
          return
        }
      }
      
      // base64 인코딩 후 크기 확인 (약 33% 증가, Cloud Run 제한 32MB)
      // 압축 로직 제거 - 원본 그대로 사용
      // Cloud Run에서 오디오 품질을 보장하므로 클라이언트에서는 압축하지 않음
      
      // 크기 확인 (Vercel 제한: 4.5MB) - Cloud Storage를 사용하지 않는 경우에만
      // base64 인코딩으로 인해 실제 크기가 더 커지므로 3MB로 제한
      if (!audioGcsUrl && audioBase64.length > 3 * 1024 * 1024) {
        alert(
          `오디오 파일이 너무 큽니다 (base64: ${base64SizeMB.toFixed(2)}MB). ` +
          `Vercel 요청 크기 제한(4.5MB)을 초과할 수 있습니다. ` +
          `Cloud Storage 업로드를 다시 시도하거나 오디오 길이를 줄여주세요.`
        )
        setIsExporting(false)
        return
      }

      // 2. 이미지 매핑 - videoData에 저장된 autoImages 사용 (없으면 재계산)
      let autoImagesForRender: Array<{
        id: string
        url: string
        startTime: number
        endTime: number
        keyword: string
        motion?: string
        isVideo?: boolean
      }> = []

      if (videoData.autoImages && videoData.autoImages.length > 0) {
        // videoData에 저장된 autoImages 사용 (영상 URL 확인)
        autoImagesForRender = videoData.autoImages.map((img) => {
          // id에서 lineId 또는 scene 정보 추출
          const idParts = img.id.split("_")
          let videoUrl: string | undefined = undefined
          
          if (idParts[0] === "scene") {
            // 씬별 이미지: scene_1_image_1 -> 1-1
            const sceneNumber = Number.parseInt(idParts[1] || "0")
            const imageNumber = Number.parseInt(idParts[3] || "0")
            const sceneVideoKey = `${sceneNumber}-${imageNumber}`
            videoUrl = convertedSceneVideos.get(sceneVideoKey)
          } else {
            // 일반 이미지: image_1 -> 1
            const lineId = Number.parseInt(idParts.pop() || "0")
            videoUrl = convertedVideos.get(lineId)
          }
          
          // 영상 URL이 있으면 사용, 없으면 원본 이미지 URL 사용
          return {
            ...img,
            url: videoUrl || img.url,
            isVideo: !!videoUrl,
          }
        })
        console.log("[v0] videoData에서 autoImages 사용:", autoImagesForRender.length, "개 (영상 포함:", autoImagesForRender.filter(img => img.isVideo).length, "개)")
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
                // 영상 URL 확인
                const videoUrl = convertedVideos.get(line.id)
                
                autoImagesForRender.push({
                  id: `image_${line.id}`,
                  url: videoUrl || image.imageUrl,
                  startTime: imageStartTime,
                  endTime: imageEndTime,
                  keyword: `문장 ${line.id}`,
                  motion: "static",
                  isVideo: !!videoUrl,
                })
              }
            }
          }
        }
      }

      // 첫 번째 이미지를 기본 배경으로 사용
      // 우선순위: autoImagesForRender > 씬별 이미지 > generatedImages
      let firstImage: { imageUrl: string } | null = null
      
      if (autoImagesForRender.length > 0) {
        // autoImagesForRender에서 첫 번째 이미지 사용
        firstImage = { imageUrl: autoImagesForRender[0].url }
        console.log("[v0] autoImagesForRender에서 첫 번째 이미지 사용:", firstImage.imageUrl)
      } else if (sceneImagePrompts.length > 0) {
        // 씬별 이미지에서 첫 번째 이미지 찾기
        for (const scene of sceneImagePrompts) {
          const sceneImage = scene.images.find(img => img.imageUrl)
          if (sceneImage && sceneImage.imageUrl) {
            firstImage = { imageUrl: sceneImage.imageUrl as string }
            console.log("[v0] 씬별 이미지에서 첫 번째 이미지 사용:", firstImage.imageUrl)
            break
          }
        }
      } else if (generatedImages.length > 0) {
        // generatedImages에서 첫 번째 이미지 사용
        firstImage = generatedImages[0]
        console.log("[v0] generatedImages에서 첫 번째 이미지 사용:", firstImage.imageUrl)
      }
      
      if (!firstImage || !firstImage.imageUrl) {
        console.error("[v0] 이미지 없음 - 상태 확인:", {
          autoImagesForRenderCount: autoImagesForRender.length,
          sceneImagePromptsCount: sceneImagePrompts.length,
          generatedImagesCount: generatedImages.length,
          hasSceneImages: sceneImagePrompts.some(s => s.images.some(img => img.imageUrl)),
        })
        throw new Error("이미지가 없습니다. 이미지를 생성해주세요.")
      }

      // 3. 이미지를 1920x1080으로 리사이즈 (영상이 아닌 경우만)
      console.log("[v0] 이미지 리사이즈 시작 (1920x1080)...")
      
      // characterImage가 영상인지 확인
      const firstImageIdParts = autoImagesForRender.length > 0 ? autoImagesForRender[0].id.split("_") : []
      let firstImageIsVideo = false
      if (firstImageIdParts.length > 0) {
        if (firstImageIdParts[0] === "scene") {
          const sceneNumber = Number.parseInt(firstImageIdParts[1] || "0")
          const imageNumber = Number.parseInt(firstImageIdParts[3] || "0")
          const sceneVideoKey = `${sceneNumber}-${imageNumber}`
          firstImageIsVideo = convertedSceneVideos.has(sceneVideoKey)
        } else {
          const lineId = Number.parseInt(firstImageIdParts.pop() || "0")
          firstImageIsVideo = convertedVideos.has(lineId)
        }
      }
      
      // characterImage 리사이즈 (영상이 아닌 경우만)
      let resizedCharacterImageBase64: string
      if (firstImageIsVideo) {
        // 영상인 경우 원본 URL 사용 (리사이즈하지 않음)
        resizedCharacterImageBase64 = firstImage!.imageUrl
        console.log("[v0] characterImage는 영상이므로 리사이즈하지 않음")
      } else {
        resizedCharacterImageBase64 = await resizeImageTo1920x1080(firstImage!.imageUrl)
        console.log("[v0] characterImage 리사이즈 완료")
      }
      
      // autoImages 리사이즈 (영상이 아닌 경우만)
      const resizedAutoImagesBase64 = await Promise.all(
        autoImagesForRender.map(async (img) => {
          // 영상인 경우 리사이즈하지 않고 원본 URL 사용
          if (img.isVideo) {
            return {
              ...img,
              url: img.url, // 영상 URL 그대로 사용
            }
          }
          // 이미지인 경우 리사이즈
          const resizedUrl = await resizeImageTo1920x1080(img.url)
          return {
            ...img,
            url: resizedUrl, // base64로 변환된 이미지
          }
        })
      )
      console.log("[v0] autoImages 처리 완료:", resizedAutoImagesBase64.length, "개 (영상:", resizedAutoImagesBase64.filter(img => img.isVideo).length, "개)")

      // 4. 이미지를 Cloud Storage에 업로드 (크기가 큰 경우)
      // base64 크기 계산 (영상 URL은 크기 계산에서 제외)
      const characterImageSize = firstImageIsVideo ? 0 : resizedCharacterImageBase64.length
      const totalAutoImagesSize = resizedAutoImagesBase64.reduce((sum, img) => {
        // 영상인 경우 크기 계산에서 제외
        return img.isVideo ? sum : sum + img.url.length
      }, 0)
      const totalImagesSize = characterImageSize + totalAutoImagesSize
      
      console.log("[v0] 이미지 크기:", {
        characterImage: firstImageIsVideo ? "영상 (크기 계산 제외)" : `${Math.round(characterImageSize / 1024)} KB`,
        autoImages: `${Math.round(totalAutoImagesSize / 1024)} KB`,
        total: `${Math.round(totalImagesSize / 1024)} KB`,
      })

      // 이미지도 Cloud Storage에 업로드 (500KB 이상이면 업로드 - 더 엄격한 기준)
      // 단, 영상 URL은 업로드하지 않음 (원본 URL 사용)
      let characterImageGcsUrl: string | null = null
      let autoImagesGcsUrls: Array<{ id: string; url: string; startTime: number; endTime: number; keyword: string; motion?: string; isVideo?: boolean }> = []
      
      // 개별 이미지가 300KB 이상이거나 전체 이미지 크기가 500KB 이상이면 업로드 (더 적극적으로)
      // 단, characterImage가 영상인 경우 업로드하지 않음
      const shouldUploadImagesToGcs = !firstImageIsVideo && (characterImageSize > 300 * 1024 || totalImagesSize > 500 * 1024)
      
      if (shouldUploadImagesToGcs) {
        console.log("[v0] 이미지가 큽니다. Cloud Storage에 업로드합니다...")
        
        try {
          // characterImage 업로드 (재시도 로직 포함) - 영상이 아닌 경우만
          if (!firstImageIsVideo) {
            const charImageBase64 = resizedCharacterImageBase64.includes(",") 
              ? resizedCharacterImageBase64.split(",")[1] 
              : resizedCharacterImageBase64
            
            // base64를 Blob으로 변환
            const binaryString = atob(charImageBase64)
            const charBytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              charBytes[i] = binaryString.charCodeAt(i)
            }
            const charImageBlob = new Blob([charBytes], { type: "image/png" })
            
            // characterImage 업로드 재시도 (최대 3회)
            let charUploadSuccess = false
            for (let retry = 0; retry < 3; retry++) {
              try {
                const charSignedUrlResponse = await fetch("/api/upload-to-gcs/signed-url", {
        method: "POST",
                  headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
                    fileName: `character_image_${Date.now()}_${retry}.png`,
                    contentType: "image/png",
                  }),
                })
                
                if (!charSignedUrlResponse.ok) {
                  throw new Error(`Signed URL 생성 실패: ${charSignedUrlResponse.status}`)
                }
                
                const { signedUrl, publicUrl } = await charSignedUrlResponse.json()
                const uploadResponse = await fetch(signedUrl, {
                  method: "PUT",
                  headers: { "Content-Type": "image/png" },
                  body: charImageBlob,
                })
                
                if (uploadResponse.ok) {
                  characterImageGcsUrl = publicUrl
                  console.log("[v0] characterImage Cloud Storage 업로드 완료:", characterImageGcsUrl)
                  charUploadSuccess = true
                  break
                } else {
                  throw new Error(`업로드 실패: ${uploadResponse.status}`)
                }
              } catch (error) {
                console.warn(`[v0] characterImage 업로드 시도 ${retry + 1}/3 실패:`, error)
                if (retry < 2) {
                  await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1))) // 1초, 2초 대기
                } else {
                  throw new Error(`characterImage 업로드 실패 (3회 시도): ${error instanceof Error ? error.message : String(error)}`)
                }
              }
            }
            
            if (!charUploadSuccess) {
              throw new Error("characterImage 업로드에 실패했습니다.")
            }
          }
          
          // autoImages 업로드 (재시도 로직 포함) - 영상이 아닌 경우만
          autoImagesGcsUrls = await Promise.all(
            resizedAutoImagesBase64.map(async (img, index) => {
              // 영상인 경우 업로드하지 않고 원본 URL 사용
              if (img.isVideo) {
                return {
                  ...img,
                  url: img.url, // 영상 URL 그대로 사용
                }
              }
              
              // 이미지인 경우에만 base64 디코딩 및 업로드
              const imgBase64 = img.url.includes(",") 
                ? img.url.split(",")[1] 
                : img.url
              
              // base64를 Blob으로 변환
              const binaryString = atob(imgBase64)
              const imgBytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                imgBytes[i] = binaryString.charCodeAt(i)
              }
              const imgBlob = new Blob([imgBytes], { type: "image/png" })
              
              // autoImage 업로드 재시도 (최대 3회)
              for (let retry = 0; retry < 3; retry++) {
                try {
                  const signedUrlResponse = await fetch("/api/upload-to-gcs/signed-url", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      fileName: `auto_image_${Date.now()}_${index}_${retry}_${img.id}.png`,
                      contentType: "image/png",
                    }),
                  })
                  
                  if (!signedUrlResponse.ok) {
                    throw new Error(`Signed URL 생성 실패: ${signedUrlResponse.status}`)
                  }
                  
                  const { signedUrl, publicUrl } = await signedUrlResponse.json()
                  const uploadResponse = await fetch(signedUrl, {
                    method: "PUT",
                    headers: { "Content-Type": "image/png" },
                    body: imgBlob,
                  })
                  
                  if (uploadResponse.ok) {
                    return {
                      ...img,
                      url: publicUrl,
                    }
                  } else {
                    throw new Error(`업로드 실패: ${uploadResponse.status}`)
                  }
                } catch (error) {
                  console.warn(`[v0] autoImage ${img.id} 업로드 시도 ${retry + 1}/3 실패:`, error)
                  if (retry < 2) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1))) // 1초, 2초 대기
                  } else {
                    throw new Error(`autoImage ${img.id} 업로드 실패 (3회 시도): ${error instanceof Error ? error.message : String(error)}`)
                  }
                }
              }
              
              // 여기 도달하면 안 됨 (위에서 throw됨)
              throw new Error(`autoImage ${img.id} 업로드 실패`)
            })
          )
          
          console.log("[v0] autoImages Cloud Storage 업로드 완료:", autoImagesGcsUrls.length, "개")
        } catch (imageUploadError) {
          console.error("[v0] 이미지 Cloud Storage 업로드 실패:", imageUploadError)
          const errorMessage = imageUploadError instanceof Error ? imageUploadError.message : String(imageUploadError)
          alert(`이미지 업로드에 실패했습니다: ${errorMessage}\n\n다시 시도해주세요.`)
          setIsExporting(false)
          return
        }
      }

      // 5. 이미지 URL 검증 및 로깅
      const finalCharacterImage = characterImageGcsUrl || resizedCharacterImageBase64
      if (!finalCharacterImage) {
        throw new Error("characterImage가 없습니다. 이미지 리사이즈에 실패했을 수 있습니다.")
      }
      
      // 전체 요청 크기 계산 (JSON 문자열화 전 크기 추정)
      // 영상 URL은 크기가 작으므로 크기 계산에서 제외
      const requestBodyForSizeEstimate = {
          // Cloud Storage URL이 있으면 사용, 없으면 base64 사용
        ...(audioGcsUrl ? { audioGcsUrl: audioGcsUrl } : { audioBase64: audioBase64 }),
          subtitles: videoData.subtitles.map((s) => ({
            id: s.id,
            // 자막 타이밍을 0.5초 앞당겨서 전달 (TTS와 동기화 개선)
            start: Math.max(0, s.start - 0.5),
            end: Math.max(0, s.end - 0.5),
            text: s.text,
          })),
        // 이미지: Cloud Storage URL이 있으면 base64 전송하지 않음
        // 영상인 경우 URL만 전송 (크기 작음)
        ...(characterImageGcsUrl 
          ? { characterImageGcsUrl: characterImageGcsUrl } 
          : (firstImageIsVideo 
            ? { characterImageUrl: resizedCharacterImageBase64 } // 영상 URL
            : { characterImage: resizedCharacterImageBase64 })), // 이미지 base64
        // autoImages: 영상인 경우 URL만, 이미지인 경우 base64 또는 GCS URL
        autoImages: (autoImagesGcsUrls.length > 0 && autoImagesGcsUrls.every(img => !img.url.startsWith("data:"))) 
          ? autoImagesGcsUrls.map(img => ({
              ...img,
              // 영상인 경우 URL만 전송 (크기 작음)
              url: img.isVideo ? img.url : img.url
            }))
          : resizedAutoImagesBase64.map(img => ({
              ...img,
              // 영상인 경우 URL만 전송 (크기 작음)
              url: img.isVideo ? img.url : img.url
            })),
          duration: videoData.duration,
          config: {
            width: 1920,
            height: 1080,
            fps: 30,
          },
      }
      
      // 요청 크기 추정 (JSON 문자열화)
      // 영상 URL은 크기가 작으므로 크기 계산에서 제외하기 위해 별도 계산
      let estimatedRequestSize = 0
      
      // 오디오 크기
      if (audioGcsUrl) {
        estimatedRequestSize += audioGcsUrl.length // URL 크기 (작음)
      } else if (audioBase64) {
        estimatedRequestSize += audioBase64.length
      }
      
      // 자막 크기 (대략적 추정)
      estimatedRequestSize += JSON.stringify(videoData.subtitles).length
      
      // characterImage 크기
      if (characterImageGcsUrl) {
        estimatedRequestSize += Math.min(characterImageGcsUrl.length, 500) // URL 크기 (작음, 최대 500 bytes)
      } else if (firstImageIsVideo) {
        // 영상 URL은 크기가 작음 (약 100-500 bytes, 최대 1000 bytes로 제한)
        estimatedRequestSize += Math.min(resizedCharacterImageBase64.length, 1000)
      } else {
        estimatedRequestSize += resizedCharacterImageBase64.length // 이미지 base64 크기
      }
      
      // autoImages 크기
      const autoImagesForSize = (autoImagesGcsUrls.length > 0 && autoImagesGcsUrls.every(img => !img.url.startsWith("data:"))) 
        ? autoImagesGcsUrls 
        : resizedAutoImagesBase64
      
      for (const img of autoImagesForSize) {
        if (img.isVideo) {
          // 영상 URL은 크기가 작음 (약 100-500 bytes, 최대 1000 bytes로 제한)
          estimatedRequestSize += Math.min(img.url.length, 1000)
        } else {
          // 이미지 base64 또는 GCS URL
          if (img.url.startsWith("data:")) {
            estimatedRequestSize += img.url.length // base64 크기
          } else {
            estimatedRequestSize += Math.min(img.url.length, 500) // GCS URL 크기 (작음, 최대 500 bytes)
          }
        }
      }
      
      // 기타 필드 크기 (대략적 추정)
      estimatedRequestSize += 1000 // duration, config, JSON 구조 등
      
      const estimatedRequestSizeMB = estimatedRequestSize / 1024 / 1024
      
      // 요청 크기가 4MB를 초과하면 이미지 업로드를 강제로 시도
      if (estimatedRequestSizeMB > 4.0) {
        // 이미지 업로드를 강제로 시도 (이미 업로드되지 않은 경우)
        const needsImageUpload = !firstImageIsVideo && !characterImageGcsUrl && characterImageSize > 0
        const needsAutoImagesUpload = resizedAutoImagesBase64.some(img => !img.isVideo && img.url.startsWith("data:"))
        
        if (needsImageUpload || needsAutoImagesUpload) {
          console.log("[v0] 요청 크기 초과로 인해 이미지 업로드를 강제로 시도합니다...")
          // 이미지 업로드 재시도
          try {
            // characterImage 업로드 (영상이 아닌 경우만)
            if (!firstImageIsVideo && !characterImageGcsUrl && characterImageSize > 0) {
              const charImageBase64 = resizedCharacterImageBase64.includes(",") 
                ? resizedCharacterImageBase64.split(",")[1] 
                : resizedCharacterImageBase64
              
              const binaryString = atob(charImageBase64)
              const charBytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                charBytes[i] = binaryString.charCodeAt(i)
              }
              const charImageBlob = new Blob([charBytes], { type: "image/png" })
              
              for (let retry = 0; retry < 3; retry++) {
                try {
                  const charSignedUrlResponse = await fetch("/api/upload-to-gcs/signed-url", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      fileName: `character_image_${Date.now()}_${retry}.png`,
                      contentType: "image/png",
                    }),
                  })
                  
                  if (charSignedUrlResponse.ok) {
                    const { signedUrl, publicUrl } = await charSignedUrlResponse.json()
                    const uploadResponse = await fetch(signedUrl, {
                      method: "PUT",
                      headers: { "Content-Type": "image/png" },
                      body: charImageBlob,
                    })
                    
                    if (uploadResponse.ok) {
                      characterImageGcsUrl = publicUrl
                      console.log("[v0] characterImage 강제 업로드 완료:", characterImageGcsUrl)
                      break
                    }
                  }
                } catch (error) {
                  console.warn(`[v0] characterImage 강제 업로드 시도 ${retry + 1}/3 실패:`, error)
                }
              }
            }
            
            // autoImages 업로드 (영상이 아닌 이미지만)
            const imagesToUpload = resizedAutoImagesBase64.filter(img => !img.isVideo && img.url.startsWith("data:"))
            if (imagesToUpload.length > 0 && autoImagesGcsUrls.length === 0) {
              console.log(`[v0] ${imagesToUpload.length}개의 이미지를 강제 업로드 시도...`)
              const uploadedImages = await Promise.all(
                imagesToUpload.map(async (img, index) => {
                  const imgBase64 = img.url.includes(",") 
                    ? img.url.split(",")[1] 
                    : img.url
                  
                  const binaryString = atob(imgBase64)
                  const imgBytes = new Uint8Array(binaryString.length)
                  for (let i = 0; i < binaryString.length; i++) {
                    imgBytes[i] = binaryString.charCodeAt(i)
                  }
                  const imgBlob = new Blob([imgBytes], { type: "image/png" })
                  
                  for (let retry = 0; retry < 3; retry++) {
                    try {
                      const signedUrlResponse = await fetch("/api/upload-to-gcs/signed-url", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          fileName: `auto_image_${Date.now()}_${index}_${retry}_${img.id}.png`,
                          contentType: "image/png",
                        }),
                      })
                      
                      if (signedUrlResponse.ok) {
                        const { signedUrl, publicUrl } = await signedUrlResponse.json()
                        const uploadResponse = await fetch(signedUrl, {
                          method: "PUT",
                          headers: { "Content-Type": "image/png" },
                          body: imgBlob,
                        })
                        
                        if (uploadResponse.ok) {
                          return {
                            ...img,
                            url: publicUrl,
                          }
                        }
                      }
                    } catch (error) {
                      console.warn(`[v0] autoImage ${img.id} 강제 업로드 시도 ${retry + 1}/3 실패:`, error)
                    }
                  }
                  
                  // 업로드 실패 시 원본 반환
                  return img
                })
              )
              
              // 업로드 성공한 이미지만 GCS URL로 교체
              autoImagesGcsUrls = resizedAutoImagesBase64.map(img => {
                const uploaded = uploadedImages.find(u => u.id === img.id)
                return uploaded && !uploaded.url.startsWith("data:") ? uploaded : img
              })
              
              console.log(`[v0] autoImages 강제 업로드 완료: ${uploadedImages.filter(img => !img.url.startsWith("data:")).length}/${imagesToUpload.length}개`)
            }
          } catch (error) {
            console.error("[v0] 이미지 강제 업로드 실패:", error)
          }
        }
        
        // 업로드 후 크기 재계산
        let finalEstimatedSize = 0
        
        // 오디오 크기
        if (audioGcsUrl) {
          finalEstimatedSize += Math.min(audioGcsUrl.length, 500)
        } else if (audioBase64) {
          finalEstimatedSize += audioBase64.length
        }
        
        // 자막 크기
        finalEstimatedSize += JSON.stringify(videoData.subtitles).length
        
        // characterImage 크기
        if (characterImageGcsUrl) {
          finalEstimatedSize += Math.min(characterImageGcsUrl.length, 500)
        } else if (firstImageIsVideo) {
          finalEstimatedSize += Math.min(resizedCharacterImageBase64.length, 1000)
        } else {
          finalEstimatedSize += resizedCharacterImageBase64.length
        }
        
        // autoImages 크기
        const finalAutoImages = (autoImagesGcsUrls.length > 0 && autoImagesGcsUrls.some(img => !img.url.startsWith("data:"))) 
          ? autoImagesGcsUrls 
          : resizedAutoImagesBase64
        
        for (const img of finalAutoImages) {
          if (img.isVideo) {
            finalEstimatedSize += Math.min(img.url.length, 1000)
          } else {
            if (img.url.startsWith("data:")) {
              finalEstimatedSize += img.url.length
            } else {
              finalEstimatedSize += Math.min(img.url.length, 500)
            }
          }
        }
        
        finalEstimatedSize += 1000 // 기타 필드
        
        const finalEstimatedSizeMB = finalEstimatedSize / 1024 / 1024
        
        if (finalEstimatedSizeMB > 4.0) {
          const errorMsg = `요청 크기가 너무 큽니다 (예상: ${finalEstimatedSizeMB.toFixed(2)}MB). ` +
            `이미지나 오디오를 Cloud Storage에 업로드해야 합니다. ` +
            `이미지 업로드가 실패했을 수 있습니다. 다시 시도해주세요.`
          console.error("[v0] 요청 크기 초과:", errorMsg)
          alert(errorMsg)
          setIsExporting(false)
          return
        }
      }
      
      console.log("[v0] 렌더링 요청 준비:", {
        characterImage: characterImageGcsUrl ? "Cloud Storage" : (firstImageIsVideo ? "영상 URL" : "base64"),
        characterImageSize: characterImageGcsUrl ? 0 : (firstImageIsVideo ? resizedCharacterImageBase64.length : resizedCharacterImageBase64.length),
        autoImagesCount: autoImagesGcsUrls.length || resizedAutoImagesBase64.length,
        autoImagesVideoCount: (autoImagesGcsUrls.length > 0 ? autoImagesGcsUrls : resizedAutoImagesBase64).filter(img => img.isVideo).length,
        duration: videoData.duration,
        subtitlesCount: videoData.subtitles.length,
        audioGcsUrl: audioGcsUrl ? "있음" : "없음",
        audioBase64Length: audioBase64 ? audioBase64.length : 0,
        estimatedRequestSizeMB: estimatedRequestSizeMB.toFixed(2),
      })
      
      // 요청 크기가 4MB를 초과하면 이미지 업로드를 강제로 시도
      if (estimatedRequestSizeMB > 4.0) {
        // 이미지 업로드를 강제로 시도 (이미 업로드되지 않은 경우)
        const needsImageUpload = !firstImageIsVideo && !characterImageGcsUrl && characterImageSize > 0
        const needsAutoImagesUpload = resizedAutoImagesBase64.some(img => !img.isVideo && img.url.startsWith("data:"))
        
        if (needsImageUpload || needsAutoImagesUpload) {
          console.log("[v0] 요청 크기 초과로 인해 이미지 업로드를 강제로 시도합니다...")
          // 이미지 업로드 재시도
          try {
            // characterImage 업로드 (영상이 아닌 경우만)
            if (!firstImageIsVideo && !characterImageGcsUrl && characterImageSize > 0) {
              const charImageBase64 = resizedCharacterImageBase64.includes(",") 
                ? resizedCharacterImageBase64.split(",")[1] 
                : resizedCharacterImageBase64
              
              const binaryString = atob(charImageBase64)
              const charBytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                charBytes[i] = binaryString.charCodeAt(i)
              }
              const charImageBlob = new Blob([charBytes], { type: "image/png" })
              
              for (let retry = 0; retry < 3; retry++) {
                try {
                  const charSignedUrlResponse = await fetch("/api/upload-to-gcs/signed-url", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      fileName: `character_image_${Date.now()}_${retry}.png`,
                      contentType: "image/png",
                    }),
                  })
                  
                  if (charSignedUrlResponse.ok) {
                    const { signedUrl, publicUrl } = await charSignedUrlResponse.json()
                    const uploadResponse = await fetch(signedUrl, {
                      method: "PUT",
                      headers: { "Content-Type": "image/png" },
                      body: charImageBlob,
                    })
                    
                    if (uploadResponse.ok) {
                      characterImageGcsUrl = publicUrl
                      console.log("[v0] characterImage 강제 업로드 완료:", characterImageGcsUrl)
                      break
                    }
                  }
                } catch (error) {
                  console.warn(`[v0] characterImage 강제 업로드 시도 ${retry + 1}/3 실패:`, error)
                }
              }
            }
            
            // autoImages 업로드 (영상이 아닌 이미지만)
            const imagesToUpload = resizedAutoImagesBase64.filter(img => !img.isVideo && img.url.startsWith("data:"))
            if (imagesToUpload.length > 0 && autoImagesGcsUrls.length === 0) {
              console.log(`[v0] ${imagesToUpload.length}개의 이미지를 강제 업로드 시도...`)
              const uploadedImages = await Promise.all(
                imagesToUpload.map(async (img, index) => {
                  const imgBase64 = img.url.includes(",") 
                    ? img.url.split(",")[1] 
                    : img.url
                  
                  const binaryString = atob(imgBase64)
                  const imgBytes = new Uint8Array(binaryString.length)
                  for (let i = 0; i < binaryString.length; i++) {
                    imgBytes[i] = binaryString.charCodeAt(i)
                  }
                  const imgBlob = new Blob([imgBytes], { type: "image/png" })
                  
                  for (let retry = 0; retry < 3; retry++) {
                    try {
                      const signedUrlResponse = await fetch("/api/upload-to-gcs/signed-url", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          fileName: `auto_image_${Date.now()}_${index}_${retry}_${img.id}.png`,
                          contentType: "image/png",
                        }),
                      })
                      
                      if (signedUrlResponse.ok) {
                        const { signedUrl, publicUrl } = await signedUrlResponse.json()
                        const uploadResponse = await fetch(signedUrl, {
                          method: "PUT",
                          headers: { "Content-Type": "image/png" },
                          body: imgBlob,
                        })
                        
                        if (uploadResponse.ok) {
                          return {
                            ...img,
                            url: publicUrl,
                          }
                        }
                      }
                    } catch (error) {
                      console.warn(`[v0] autoImage ${img.id} 강제 업로드 시도 ${retry + 1}/3 실패:`, error)
                    }
                  }
                  
                  // 업로드 실패 시 원본 반환
                  return img
                })
              )
              
              // 업로드 성공한 이미지만 GCS URL로 교체
              autoImagesGcsUrls = resizedAutoImagesBase64.map(img => {
                const uploaded = uploadedImages.find(u => u.id === img.id)
                return uploaded && !uploaded.url.startsWith("data:") ? uploaded : img
              })
              
              console.log(`[v0] autoImages 강제 업로드 완료: ${uploadedImages.filter(img => !img.url.startsWith("data:")).length}/${imagesToUpload.length}개`)
            }
          } catch (error) {
            console.error("[v0] 이미지 강제 업로드 실패:", error)
          }
        }
      }

      // 6. Cloud Run 렌더링 API 호출
      // requestBody는 위에서 이미 생성되었으므로 여기서는 업데이트된 변수 사용
      
      // characterImage 관련 필드 결정
      let characterImageField: Record<string, string> = {}
      if (characterImageGcsUrl) {
        characterImageField.characterImageGcsUrl = characterImageGcsUrl
        console.log("[v0] characterImageGcsUrl 사용:", characterImageGcsUrl.substring(0, 50))
      } else if (firstImageIsVideo) {
        // 영상 URL인 경우 characterImageUrl 사용
        characterImageField.characterImageUrl = resizedCharacterImageBase64 // 영상 URL
        console.log("[v0] characterImageUrl 사용 (영상):", resizedCharacterImageBase64.substring(0, 100))
      } else {
        characterImageField.characterImage = resizedCharacterImageBase64 // 이미지 base64
        console.log("[v0] characterImage 사용 (base64):", resizedCharacterImageBase64.substring(0, 50) + "...")
      }
      
      // characterImageField가 비어있는지 확인
      if (Object.keys(characterImageField).length === 0) {
        console.error("[v0] characterImageField가 비어있습니다!", {
          characterImageGcsUrl,
          firstImageIsVideo,
          resizedCharacterImageBase64: resizedCharacterImageBase64 ? resizedCharacterImageBase64.substring(0, 50) : "null",
        })
        throw new Error("이미지 데이터가 없습니다. 이미지를 먼저 생성해주세요.")
      }
      
      // 오디오 필드 결정 (null이나 빈 문자열 체크)
      const audioField: Record<string, string> = {}
      if (audioGcsUrl) {
        audioField.audioGcsUrl = audioGcsUrl
      } else if (audioBase64 && audioBase64.trim() !== "") {
        audioField.audioBase64 = audioBase64
      } else {
        throw new Error("오디오 데이터가 없습니다. TTS를 먼저 생성해주세요.")
      }
      
      // characterImage 필드 확인
      if (Object.keys(characterImageField).length === 0) {
        console.error("[v0] characterImageField가 비어있습니다!", {
          characterImageGcsUrl,
          firstImageIsVideo,
          resizedCharacterImageBase64: resizedCharacterImageBase64 ? resizedCharacterImageBase64.substring(0, 50) : "null",
        })
        throw new Error("이미지 데이터가 없습니다. 이미지를 먼저 생성해주세요.")
      }
      
      console.log("[v0] characterImageField 결정:", {
        keys: Object.keys(characterImageField),
        firstImageIsVideo,
        hasCharacterImageGcsUrl: !!characterImageGcsUrl,
        valuePreview: Object.values(characterImageField)[0]?.substring(0, 100),
      })
      
      // characterImageField 값이 비어있거나 null인지 확인
      const characterImageValue = Object.values(characterImageField)[0]
      if (!characterImageValue || characterImageValue.trim() === "") {
        console.error("[v0] characterImageField 값이 비어있습니다!", {
          characterImageField,
          characterImageValue,
        })
        throw new Error("이미지 데이터가 비어있습니다. 이미지를 먼저 생성해주세요.")
      }
      
      // duration 검증
      const duration = videoData.duration
      if (!duration || duration <= 0 || !isFinite(duration)) {
        console.error("[v0] 유효하지 않은 duration:", duration)
        throw new Error(`유효하지 않은 영상 길이입니다: ${duration}. TTS를 다시 생성해주세요.`)
      }
      
      const finalRequestBody = {
        // Cloud Storage URL이 있으면 사용, 없으면 base64 사용
        ...audioField,
        // 자막 표시 여부에 따라 자막 포함/제외
        showSubtitles: showSubtitles, // 자막 표시 여부 명시적으로 전달
        ...(showSubtitles ? {
          subtitles: videoData.subtitles.map((s) => ({
            id: s.id,
            // 자막 타이밍을 0.5초 앞당겨서 전달 (TTS와 동기화 개선)
            start: Math.max(0, s.start - 0.5),
            end: Math.max(0, s.end - 0.5),
            text: s.text,
          })),
        } : {
          subtitles: [], // 자막 빼기 선택 시 빈 배열
        }),
        // 이미지: Cloud Storage URL이 있으면 base64 전송하지 않음
        // 영상인 경우 URL만 전송
        ...characterImageField,
        autoImages: (autoImagesGcsUrls.length > 0 && autoImagesGcsUrls.some(img => !img.url.startsWith("data:"))) 
          ? autoImagesGcsUrls 
          : resizedAutoImagesBase64,
        duration: duration, // 검증된 duration 사용
        config: {
          width: 1920,
          height: 1080,
          fps: 30,
        },
      }
      
      const requestBodyString = JSON.stringify(finalRequestBody)
      
      // 디버깅: 요청 본문 확인
      console.log("[v0] 최종 요청 본문 키:", Object.keys(finalRequestBody))
      console.log("[v0] 오디오 관련:", {
        hasAudioGcsUrl: 'audioGcsUrl' in finalRequestBody && !!finalRequestBody.audioGcsUrl,
        hasAudioBase64: 'audioBase64' in finalRequestBody && !!finalRequestBody.audioBase64,
        audioGcsUrl: audioGcsUrl,
        audioBase64Length: audioBase64 ? audioBase64.length : 0,
      })
      console.log("[v0] characterImage 관련:", {
        hasCharacterImage: 'characterImage' in finalRequestBody && !!finalRequestBody.characterImage,
        hasCharacterImageGcsUrl: 'characterImageGcsUrl' in finalRequestBody && !!finalRequestBody.characterImageGcsUrl,
        hasCharacterImageUrl: 'characterImageUrl' in finalRequestBody && !!finalRequestBody.characterImageUrl,
        firstImageIsVideo,
        characterImageFieldKeys: Object.keys(characterImageField),
        characterImageFieldValue: Object.values(characterImageField)[0]?.substring(0, 100),
      })
      console.log("[v0] subtitles:", {
        count: finalRequestBody.subtitles.length,
        first: finalRequestBody.subtitles[0],
      })
      console.log("[v0] 최종 요청 본문 (일부):", JSON.stringify(finalRequestBody).substring(0, 500))
      
      // 긴 렌더링을 위해 Cloud Run을 직접 호출 (Vercel API 라우트 우회)
      // Vercel API 라우트는 최대 800초(약 13분) 제한이 있지만, 실제로는 10분 이상부터 불안정할 수 있음
      // 클라이언트 사이드에서 직접 호출 (타임아웃 제한 없음)
      const CLOUD_RUN_URL = "https://my-project-350911437561.asia-northeast1.run.app"
      const estimatedDurationMinutes = finalRequestBody.duration / 60
      
      // 10분 이상이면 Cloud Run 직접 호출, 그 이하는 Vercel API 라우트 사용
      // 10분 기준으로 낮춰서 타임아웃 방지
      const useDirectCloudRun = estimatedDurationMinutes >= 10
      
      let renderResponse
      if (useDirectCloudRun) {
        console.log(`[v0] 긴 렌더링 작업 (${estimatedDurationMinutes.toFixed(1)}분) - Cloud Run 직접 호출`)
        // Cloud Run 직접 호출 (타임아웃 없음)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60 * 60 * 1000) // 60분 타임아웃
        
        try {
          renderResponse = await fetch(`${CLOUD_RUN_URL}/render`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: requestBodyString,
            signal: controller.signal,
          })
          clearTimeout(timeoutId)
        } catch (fetchError: any) {
          clearTimeout(timeoutId)
          if (fetchError.name === 'AbortError') {
            throw new Error("렌더링 시간이 너무 오래 걸립니다. (60분 초과)")
          }
          throw fetchError
        }
      } else {
        console.log(`[v0] 일반 렌더링 작업 (${estimatedDurationMinutes.toFixed(1)}분) - Vercel API 라우트 사용`)
        // Vercel API 라우트 사용 (최대 800초)
        renderResponse = await fetch("/api/ai/render", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: requestBodyString,
        })
      }

      if (!renderResponse.ok) {
        // 413 오류 (요청 크기 초과) 처리
        if (renderResponse.status === 413) {
          throw new Error(
            "요청 크기가 너무 큽니다. Cloud Storage 업로드를 다시 시도하거나 오디오 길이를 줄여주세요. " +
            "(Vercel 요청 크기 제한: 4.5MB)"
          )
        }
        
        // 응답이 JSON인지 확인
        const contentType = renderResponse.headers.get("content-type") || ""
        let errorData: any = null
        if (contentType.includes("application/json")) {
          try {
            errorData = await renderResponse.json()
            console.error("[v0] Cloud Run 렌더링 오류 응답:", JSON.stringify(errorData, null, 2))
          } catch (e) {
            // JSON 파싱 실패 시 텍스트로 읽기
            const errorText = await renderResponse.text()
            console.error("[v0] Cloud Run 렌더링 오류 (텍스트):", errorText)
            throw new Error(`Cloud Run 렌더링 실패 (${renderResponse.status}): ${errorText.substring(0, 500)}`)
          }
        } else {
          // HTML 응답인 경우 (413 오류 페이지 등)
          const errorText = await renderResponse.text()
          console.error("[v0] Cloud Run 렌더링 오류 (HTML):", errorText.substring(0, 500))
          if (renderResponse.status === 413) {
            throw new Error(
              "요청 크기가 너무 큽니다. Cloud Storage 업로드를 다시 시도하거나 오디오 길이를 줄여주세요. " +
              "(Vercel 요청 크기 제한: 4.5MB)"
            )
          }
          throw new Error(`Cloud Run 렌더링 실패 (${renderResponse.status}): ${errorText.substring(0, 500)}`)
        }
        
        // 오류 메시지 구성
        let errorMessage = "렌더링 실패"
        let fullErrorDetails = ""
        
        if (errorData) {
          // details 필드가 있으면 전체 내용 저장 (콘솔용)
          if (errorData.details) {
            fullErrorDetails = errorData.details
            console.error("[v0] Cloud Run 렌더링 오류 상세 정보 (전체):", fullErrorDetails)
          }
          
          if (errorData.error) {
            errorMessage = errorData.error
            
            // FFmpeg 오류인지 확인
            const isFFmpegError = errorData.error.includes("ffmpeg") || 
                                 errorData.error.includes("Segment") ||
                                 (errorData.details && errorData.details.includes("ffmpeg"))
            
            if (isFFmpegError) {
              errorMessage = "FFmpeg 렌더링 오류가 발생했습니다.\n\n"
              errorMessage += "가능한 원인:\n"
              errorMessage += "1. 이미지 파일 형식 문제\n"
              errorMessage += "2. 오디오 파일 문제\n"
              errorMessage += "3. 영상 길이(duration) 문제\n"
              errorMessage += "4. 서버 측 FFmpeg 설정 문제\n\n"
              errorMessage += "해결 방법:\n"
              errorMessage += "- 다른 이미지로 다시 시도해보세요\n"
              errorMessage += "- 오디오 파일을 확인해주세요\n"
              errorMessage += "- 브라우저 콘솔(F12)에서 전체 오류 내용을 확인하세요"
            }
            
            // details가 있으면 사용자에게도 일부 표시 (더 긴 내용)
            if (errorData.details) {
              // FFmpeg 버전 정보는 제외하고 실제 오류 내용만 추출
              let detailsText = errorData.details
              
              // Traceback과 Exception 정보 추출
              const tracebackStart = detailsText.indexOf("Traceback")
              const exceptionStart = detailsText.indexOf("Exception:")
              
              if (exceptionStart > 0) {
                // Exception 이후의 내용 추출
                let exceptionText = detailsText.substring(exceptionStart)
                
                // "Segment X rendering failed:" 이후의 실제 FFmpeg 오류 찾기
                const segmentFailedIndex = exceptionText.indexOf("Segment") 
                if (segmentFailedIndex >= 0) {
                  const afterSegment = exceptionText.substring(segmentFailedIndex)
                  // "ffmpeg version" 이후의 실제 오류 찾기
                  const ffmpegVersionIndex = afterSegment.indexOf("ffmpeg version")
                  if (ffmpegVersionIndex >= 0) {
                    // FFmpeg 버전 정보 이후의 실제 오류 메시지 찾기
                    // 보통 버전 정보 다음에 실제 오류가 나오지만, 500자 제한으로 잘림
                    // 그래서 최소한 Exception 메시지는 보여주기
                    detailsText = exceptionText
                  } else {
                    detailsText = exceptionText
                  }
                } else {
                  detailsText = exceptionText
                }
              } else if (tracebackStart >= 0) {
                // Traceback만 있는 경우
                detailsText = detailsText.substring(tracebackStart)
              }
              
              // FFmpeg 버전 정보 제거 시도
              const versionInfoPattern = /ffmpeg version[\s\S]*?configuration:[\s\S]*?(?=Exception:|Error:|$)/i
              detailsText = detailsText.replace(versionInfoPattern, "")
              
              const detailsPreview = detailsText.length > 1500 
                ? detailsText.substring(0, 1500) + "\n... (전체 내용은 콘솔에서 확인하세요)"
                : detailsText
              
              if (!isFFmpegError) {
                errorMessage += `\n\n상세 정보:\n${detailsPreview}`
              } else {
                // FFmpeg 오류인 경우에도 실제 오류 내용이 있으면 표시
                if (detailsText.trim().length > 0 && !detailsText.includes("ffmpeg version")) {
                  errorMessage += `\n\n서버 오류 상세:\n${detailsPreview}`
                }
              }
            }
          } else if (errorData.message) {
            errorMessage = errorData.message
            if (errorData.details) {
              const detailsPreview = errorData.details.length > 2000 
                ? errorData.details.substring(0, 2000) + "\n... (전체 내용은 콘솔에서 확인하세요)"
                : errorData.details
              errorMessage += `\n\n상세 정보:\n${detailsPreview}`
            }
          } else {
            errorMessage = JSON.stringify(errorData).substring(0, 1000)
          }
        }
        
        console.error("[v0] Cloud Run 렌더링 실패:", {
          status: renderResponse.status,
          errorData,
          errorMessage,
          fullErrorDetails: fullErrorDetails || "없음",
        })
        
        // 사용자에게 표시할 메시지 (더 명확하게)
        const userMessage = errorMessage.length > 3000 
          ? errorMessage.substring(0, 3000) + "\n\n... (전체 오류 내용은 브라우저 콘솔(F12)에서 확인하세요)"
          : errorMessage
        
        throw new Error(`렌더링 실패: ${userMessage}`)
      }

      // 응답이 JSON인지 확인
      const contentType = renderResponse.headers.get("content-type") || ""
      let renderResult
      if (contentType.includes("application/json")) {
        try {
          renderResult = await renderResponse.json()
        } catch (e) {
          const errorText = await renderResponse.text()
          throw new Error(`응답 파싱 실패: ${errorText.substring(0, 200)}`)
        }
      } else {
        const errorText = await renderResponse.text()
        throw new Error(`예상하지 못한 응답 형식: ${errorText.substring(0, 200)}`)
      }

      if (!renderResult.success) {
        // renderResult에 오류 정보가 있으면 사용
        let errorMsg = renderResult.error || renderResult.message || "렌더링 결과를 받을 수 없습니다."
        let errorDetails = ""
        
        // FFmpeg 오류인지 확인
        const isFFmpegError = errorMsg.includes("ffmpeg") || 
                             errorMsg.includes("Segment") ||
                             (renderResult.details && renderResult.details.includes("ffmpeg"))
        
        if (isFFmpegError) {
          errorMsg = "⚠️ FFmpeg 렌더링 오류가 발생했습니다\n\n"
          errorMsg += "오류 내용: Segment 0 (첫 번째 세그먼트) 렌더링 실패\n\n"
          errorMsg += "🔍 가능한 원인:\n"
          errorMsg += "1. 이미지 파일 형식, 크기, 또는 손상 문제\n"
          errorMsg += "2. 오디오 파일 형식 또는 손상 문제\n"
          errorMsg += "3. 서버 측 FFmpeg 설정 또는 리소스 부족\n"
          errorMsg += "4. 이미지 URL 접근 불가 (CORS 또는 권한 문제)\n\n"
          errorMsg += "💡 해결 방법:\n"
          errorMsg += "1. 다른 이미지로 다시 시도해보세요\n"
          errorMsg += "2. 이미지가 공개적으로 접근 가능한지 확인하세요\n"
          errorMsg += "3. 오디오 파일을 다시 생성해보세요\n"
          errorMsg += "4. 브라우저 콘솔(F12)에서 전체 오류 내용을 확인하세요\n"
          errorMsg += "5. '보통다운로드'를 시도해보세요 (MediaRecorder 사용)"
        }
        
        if (renderResult.details) {
          // FFmpeg 버전 정보는 제외하고 실제 오류 내용만 추출
          let detailsText = renderResult.details
          // FFmpeg 버전 정보 제거 (실제 오류 내용 찾기)
          const versionInfoEnd = detailsText.indexOf("configuration:")
          if (versionInfoEnd > 0) {
            const afterVersion = detailsText.substring(versionInfoEnd)
            const errorStart = Math.max(
              afterVersion.indexOf("Exception:"),
              afterVersion.indexOf("Error:")
            )
            if (errorStart > 0) {
              detailsText = afterVersion.substring(errorStart)
            }
          }
          
          errorDetails = detailsText.length > 1500 
            ? `\n\n상세 정보:\n${detailsText.substring(0, 1500)}\n... (전체 내용은 콘솔에서 확인하세요)`
            : `\n\n상세 정보:\n${detailsText}`
        }
        
        console.error("[v0] 렌더링 실패 응답:", {
          renderResult,
          isFFmpegError,
          errorMsg,
          errorDetails,
        })
        
        throw new Error(`${errorMsg}${errorDetails}`)
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
        // alert("자동화 작업이 완료되었습니다! 영상 다운로드가 완료되었습니다.") // 완료 알림 제거
      } else {
        // alert("영상 렌더링이 완료되었습니다!") // 완료 알림 제거
      }
      setIsExporting(false)
    } catch (error) {
      console.error("[v0] 영상 렌더링 오류:", error)
      
      // 오류 메시지 구성
      let errorMessage = "알 수 없는 오류"
      if (error instanceof Error) {
        errorMessage = error.message
        
        // 오류 메시지가 너무 길면 일부만 표시하고 콘솔 안내
        if (errorMessage.length > 2000) {
          const shortMessage = errorMessage.substring(0, 2000) + "\n\n... (전체 오류 내용은 브라우저 콘솔(F12)에서 확인하세요)"
          alert(`영상 렌더링 중 오류가 발생했습니다:\n\n${shortMessage}`)
        } else {
          alert(`영상 렌더링 중 오류가 발생했습니다:\n\n${errorMessage}`)
        }
      } else {
        alert(`영상 렌더링 중 오류가 발생했습니다: ${errorMessage}`)
      }
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
    // 씬별 이미지가 있는지 확인
    const hasSceneImages = sceneImagePrompts.length > 0 && sceneImagePrompts.some(scene => 
      scene.images.some(img => img.imageUrl)
    )
    const hasImages = hasSceneImages || generatedImages.length > 0
    
    // 디버깅 정보
    console.log("[보통다운로드] videoData 확인:", {
      hasVideoData: !!videoData,
      videoDataKeys: videoData ? Object.keys(videoData) : [],
      scriptLinesCount: scriptLines.length,
      hasImages,
      hasSceneImages,
      generatedImagesCount: generatedImages.length,
      generatedAudiosCount: generatedAudios.length,
    })
    
    if (!videoData) {
      alert("영상 데이터가 없습니다. 먼저 '영상 생성' 버튼을 클릭하여 미리보기를 생성해주세요.")
      return
    }
    
    if (scriptLines.length === 0 || !hasImages || generatedAudios.length === 0) {
      alert("필수 데이터가 부족합니다. 대본, 이미지, TTS가 모두 준비되어야 합니다.")
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
        // alert("영상 렌더링이 완료되었습니다!") // 완료 알림 제거
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
      const videos: Map<string, HTMLVideoElement> = new Map() // 변환된 비디오 저장 (key: imgData.id)
      
      // 이미지/비디오 미리 로드
      for (const imgData of videoData.autoImages || []) {
        // id에서 lineId 또는 scene 정보 추출
        const idParts = imgData.id.split("_")
        let videoUrl: string | undefined = undefined
        
        if (idParts[0] === "scene") {
          // 씬별 이미지: scene_1_image_1 -> 1-1
          const sceneNumber = Number.parseInt(idParts[1] || "0")
          const imageNumber = Number.parseInt(idParts[3] || "0")
          const sceneVideoKey = `${sceneNumber}-${imageNumber}`
          videoUrl = convertedSceneVideos.get(sceneVideoKey)
        } else {
          // 일반 이미지: image_1 -> 1
          const lineId = Number.parseInt(idParts.pop() || "0")
          videoUrl = convertedVideos.get(lineId)
        }
        
        // 변환된 비디오가 있으면 비디오 사용
        if (videoUrl) {
          const video = document.createElement("video")
          video.crossOrigin = "anonymous"
          video.preload = "auto"
          video.muted = true
          await new Promise<void>((resolve, reject) => {
            video.onloadeddata = () => resolve()
            video.onerror = reject
            video.src = videoUrl!
          })
          videos.set(imgData.id, video)
          // 비디오가 있으면 이미지는 스킵
          const placeholderImg = new Image()
          placeholderImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" // 1x1 투명 이미지
          images.push(placeholderImg)
        } else {
          // 비디오가 없으면 이미지 로드 및 1920x1080으로 리사이즈
          const img = new Image()
          img.crossOrigin = "anonymous"
          await new Promise<void>((resolve, reject) => {
            img.onload = async () => {
              try {
                // 이미지를 1920x1080으로 리사이즈
                const resizedBase64 = await resizeImageTo1920x1080(imgData.url)
                img.src = resizedBase64 // 리사이즈된 이미지로 교체
                await new Promise<void>((resolve2) => {
                  img.onload = () => resolve2()
                  img.onerror = reject
                })
                resolve()
              } catch (error) {
                console.warn("[보통다운로드] 이미지 리사이즈 실패, 원본 사용:", error)
                resolve() // 리사이즈 실패해도 원본 이미지 사용
              }
            }
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
      let audioStartTime = 0 // 오디오 실제 재생 시작 시간
      let isAudioStarted = false
      
      // 오디오 재생 시작 시간 추적
      audio.addEventListener('play', () => {
        if (!isAudioStarted) {
          audioStartTime = Date.now()
          isAudioStarted = true
        }
      })
      
      const renderFrame = () => {
        // 오디오의 실제 재생 시간 사용 (정확한 동기화)
        let currentTime: number
        if (isAudioStarted && !audio.paused) {
          // 오디오가 재생 중이면 오디오의 currentTime 사용
          currentTime = audio.currentTime + (introVideo ? 10 : 0)
        } else {
          // 오디오가 아직 시작되지 않았거나 일시정지 상태면 Date.now() 사용
          currentTime = (Date.now() - startTime) / 1000
        }
        
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
          
          // 전환 효과 제거 - 바로 이미지 전환
          
          // 이전 이미지 업데이트
          if (currentImageIndex !== previousImageIndex && currentImage) {
            previousImage = currentImage as AutoImage
            previousImageIndex = currentImageIndex
          }
          
          // 현재 이미지 그리기
          if (currentImage) {
            const imgIndex = videoData.autoImages?.indexOf(currentImage) || 0
            const hasVideo = videos.has(currentImage.id)
            
            if (hasVideo) {
              // 비디오 재생
              const video = videos.get(currentImage.id)!
              const imageStartTime = currentImage.startTime
              const timeInImage = adjustedTime - imageStartTime
              const videoDuration = video.duration || 6
              const videoTime = timeInImage % videoDuration
              video.currentTime = videoTime
              
              // 비디오를 1920x1080에 딱 맞게 그리기
              ctx.drawImage(video, 0, 0, 1920, 1080)
            } else if (imgIndex < images.length) {
              const img = images[imgIndex]
              
              // 이미지를 1920x1080에 딱 맞게 조정 (잘려도 됨)
              const targetWidth = 1920
              const targetHeight = 1080
              const targetRatio = targetWidth / targetHeight
              const imgRatio = img.width / img.height
              
              let sourceX = 0
              let sourceY = 0
              let sourceWidth = img.width
              let sourceHeight = img.height
              
              // 이미지를 1920x1080 비율에 맞게 중앙 크롭
              if (imgRatio > targetRatio) {
                // 이미지가 더 넓은 경우: 높이 기준으로 크롭 (좌우 잘림)
                sourceHeight = img.height
                sourceWidth = img.height * targetRatio
                sourceX = (img.width - sourceWidth) / 2
                sourceY = 0
              } else {
                // 이미지가 더 높은 경우: 너비 기준으로 크롭 (상하 잘림)
                sourceWidth = img.width
                sourceHeight = img.width / targetRatio
                sourceX = 0
                sourceY = (img.height - sourceHeight) / 2
              }
              
              // 현재 이미지를 1920x1080에 딱 맞게 그리기
                ctx.drawImage(
                  img,
                  sourceX, sourceY, sourceWidth, sourceHeight, // 소스: 크롭할 영역
                0, 0, targetWidth, targetHeight // 대상: 1920x1080 전체
                )
              }
              
              // 이전 이미지 업데이트
              if (previousImage?.id !== currentImage.id) {
                previousImage = currentImage as AutoImage
              if (imgIndex < images.length) {
                previousImageElement = images[imgIndex]
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

        // 현재 시간에 맞는 자막 찾기 (오디오 currentTime 기반으로 정확한 동기화)
        // 자막이 0.5초 늦게 나오므로 0.5초 앞당겨서 TTS와 싱크 맞춤
        let adjustedTimeForSubtitles: number
        if (isAudioStarted && !audio.paused) {
          // 오디오가 재생 중이면 오디오의 currentTime 직접 사용 (가장 정확)
          // introVideo가 있으면 오디오는 10초부터 시작하므로 자막 타이밍도 10초를 빼야 함
          // 자막이 0.5초 늦게 나오므로 0.5초를 더해서 앞당김
          adjustedTimeForSubtitles = introVideo ? audio.currentTime - 10 + 0.5 : audio.currentTime + 0.5
        } else {
          // 오디오가 아직 시작되지 않았거나 일시정지 상태면 계산된 시간 사용
          // 자막이 0.5초 늦게 나오므로 0.5초를 더해서 앞당김
          adjustedTimeForSubtitles = introVideo ? currentTime - 10 + 0.5 : currentTime + 0.5
        }
        
        // 자막 타이밍을 정확히 매칭 (TTS와 동기화)
        const currentSubtitles = videoData.subtitles.filter(
          (s) => adjustedTimeForSubtitles >= s.start && adjustedTimeForSubtitles <= s.end
        )

        // 자막 표시 여부 확인
        if (showSubtitles && currentSubtitles.length > 0) {
          // 자막 그리기 (한 줄, 큰 글씨) - 줄바꿈 강제 제거
          let subtitleText = currentSubtitles.map((s) => s.text).join(" ")
          // 모든 줄바꿈 문자 제거 (한 줄로 강제)
          subtitleText = subtitleText.replace(/\n/g, " ").replace(/\r/g, " ").replace(/\s+/g, " ").trim()
          
          // 자막 배경
          ctx.fillStyle = "rgba(0, 0, 0, 0.75)"
          ctx.fillRect(0, canvas.height - 180, canvas.width, 180)

          // 자막 텍스트 (한 줄로 표시, 크기 조정)
          ctx.fillStyle = "white"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          
          // 폰트 크기를 동적으로 조정하여 한 줄에 맞추기
          let fontSize = 80  // 크기 증가
          ctx.font = `bold ${fontSize}px "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif`
          
          // 텍스트가 화면 너비를 초과하면 폰트 크기 줄이기
          const maxWidth = canvas.width - 120 // 좌우 여백 60px씩
          let textWidth = ctx.measureText(subtitleText).width
          
          while (textWidth > maxWidth && fontSize > 45) {
            fontSize -= 2
            ctx.font = `bold ${fontSize}px "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif`
            textWidth = ctx.measureText(subtitleText).width
          }
          
          // 텍스트가 여전히 길면 말줄임표 추가 (한 줄 유지)
          let displayText = subtitleText
          if (textWidth > maxWidth) {
            while (ctx.measureText(displayText + "...").width > maxWidth && displayText.length > 0) {
              displayText = displayText.slice(0, -1)
            }
            displayText += "..."
          }
          
          // 한 줄로만 표시 (절대 두 줄로 나누지 않음)
          ctx.fillText(displayText, canvas.width / 2, canvas.height - 90)
          setCurrentSubtitle(displayText)
        } else {
          setCurrentSubtitle("")
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

  // SRT 파일로 내보내기
  const handleExportSRT = () => {
    if (!videoData || !videoData.subtitles || videoData.subtitles.length === 0) {
      alert("자막 데이터가 없습니다. 먼저 '영상 생성' 버튼을 클릭하여 미리보기를 생성해주세요.")
      return
    }

    // 초를 SRT 시간 형식으로 변환 (HH:MM:SS,mmm)
    const formatSRTTime = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = Math.floor(seconds % 60)
      const milliseconds = Math.floor((seconds % 1) * 1000)
      
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
    }

    // 자막을 시간순으로 정렬
    const sortedSubtitles = [...videoData.subtitles].sort((a, b) => a.start - b.start)

    // SRT 형식으로 변환
    let srtContent = ""
    sortedSubtitles.forEach((subtitle, index) => {
      const startTime = formatSRTTime(subtitle.start)
      const endTime = formatSRTTime(subtitle.end)
      
      srtContent += `${index + 1}\n`
      srtContent += `${startTime} --> ${endTime}\n`
      srtContent += `${subtitle.text}\n`
      srtContent += `\n`
    })

    // 파일로 다운로드
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `subtitles_${Date.now()}.srt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // 사진만 내보내기
  const handleExportImages = async () => {
    const images: Array<{ url: string; order: number }> = []

    // 1. sceneImagePrompts에서 이미지 수집
    sceneImagePrompts.forEach((scene) => {
      scene.images.forEach((img) => {
        if (img.imageUrl) {
          images.push({ url: img.imageUrl, order: scene.sceneNumber * 1000 + img.imageNumber })
        }
      })
    })

    // 2. generatedImages에서 이미지 수집
    generatedImages.forEach((img) => {
      images.push({ url: img.imageUrl, order: img.lineId })
    })

    // 3. videoData.autoImages에서 이미지 수집
    if (videoData?.autoImages) {
      videoData.autoImages.forEach((img) => {
        images.push({ url: img.url, order: img.startTime })
      })
    }

    if (images.length === 0) {
      alert("내보낼 이미지가 없습니다.")
      return
    }

    // order 기준으로 정렬
    images.sort((a, b) => a.order - b.order)

    // 각 이미지를 순서대로 다운로드
    for (let i = 0; i < images.length; i++) {
      try {
        const response = await fetch(images[i].url)
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        
        // 확장자 추출 (URL에서 또는 blob type에서)
        let extension = 'jpg'
        const urlPath = images[i].url.split('?')[0] // 쿼리 파라미터 제거
        const urlExtension = urlPath.split('.').pop()?.toLowerCase()
        if (urlExtension && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(urlExtension)) {
          extension = urlExtension === 'jpeg' ? 'jpg' : urlExtension
        } else if (blob.type) {
          const mimeExtension = blob.type.split('/')[1]
          if (mimeExtension && ['jpeg', 'png', 'gif', 'webp'].includes(mimeExtension)) {
            extension = mimeExtension === 'jpeg' ? 'jpg' : mimeExtension
          }
        }
        
        link.download = `사진${i + 1}.${extension}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        // 다운로드 간격을 두어 브라우저가 처리할 시간 제공
        if (i < images.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      } catch (error) {
        console.error(`이미지 ${i + 1} 다운로드 실패:`, error)
      }
    }
  }

  // 음성만 내보내기 (전체)
  const handleExportFullAudio = async () => {
    if (!videoData || !videoData.audioUrl) {
      alert("오디오 데이터가 없습니다.")
      return
    }

    try {
      const response = await fetch(videoData.audioUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `전체음악.mp3`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("전체 오디오 다운로드 실패:", error)
      alert("오디오 다운로드 중 오류가 발생했습니다.")
    }
  }

  // 음성만 내보내기 (각각)
  const handleExportIndividualAudios = async () => {
    if (!generatedAudios || generatedAudios.length === 0) {
      alert("개별 오디오 데이터가 없습니다.")
      return
    }

    for (let i = 0; i < generatedAudios.length; i++) {
      try {
        const audio = generatedAudios[i]
        const response = await fetch(audio.audioUrl)
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `음악${i + 1}.mp3`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        // 다운로드 간격을 두어 브라우저가 처리할 시간 제공
        if (i < generatedAudios.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      } catch (error) {
        console.error(`오디오 ${i + 1} 다운로드 실패:`, error)
      }
    }
  }

  const handleSaveThumbnailImage = async () => {
    if (!thumbnailPreviewRef.current) {
      alert("썸네일 미리보기를 찾을 수 없습니다.")
      return
    }

    try {
      // html2canvas-pro를 사용하여 실제 미리보기 div를 캡처 (oklch 색상 지원)
      const html2canvas = (await import("html2canvas-pro")).default
      
      const element = thumbnailPreviewRef.current
      
      // 원본 요소를 직접 사용 (html2canvas-pro가 oklch를 지원하므로 원본 사용 가능)
      // 이미지가 로드될 때까지 기다리기
      // 이미지가 로드될 때까지 기다리기
      const images = element.querySelectorAll('img')
      const imagePromises = Array.from(images).map((img) => {
        if (img.complete && img.naturalWidth > 0) {
          return Promise.resolve()
        }
        return new Promise<void>((resolve) => {
          const timeout = setTimeout(() => resolve(), 5000) // 5초 타임아웃
          img.onload = () => {
            clearTimeout(timeout)
            resolve()
          }
          img.onerror = () => {
            clearTimeout(timeout)
            resolve() // 에러가 나도 계속 진행
          }
        })
      })
      
      await Promise.all(imagePromises)
      
      // html2canvas-pro는 oklch를 지원하므로 복잡한 변환 로직 불필요
      // 실제 미리보기 크기 그대로 유지 (640x360)
      const canvas = await html2canvas(element, {
        width: element.offsetWidth || 640,
        height: element.offsetHeight || 360,
        scale: 1, // 실제 크기 그대로 저장
        backgroundColor: "#000000",
        useCORS: true,
        allowTaint: true,
        logging: false,
      })

      // Canvas를 이미지로 변환하여 다운로드
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `thumbnail-${Date.now()}.jpg`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          } else {
            alert("이미지 저장에 실패했습니다.")
          }
        },
        "image/jpeg",
        0.95,
      )
    } catch (error) {
      console.error("썸네일 저장 오류:", error)
      alert(`썸네일 저장에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
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

  // 프로젝트 관리 함수들
  // 프로젝트 목록 불러오기
  const loadProjects = async () => {
    if (!userId) return
    
    setIsLoadingProjects(true)
    try {
      const projectList = await getProjects(userId)
      setProjects(projectList)
    } catch (error) {
      console.error("[Projects] 프로젝트 목록 불러오기 실패:", error)
      alert("프로젝트 목록을 불러오는데 실패했습니다.")
    } finally {
      setIsLoadingProjects(false)
    }
  }

  // 모든 상태 초기화 함수
  const resetAllStates = () => {
    // 주제 관련
    setKeywords("")
    setSelectedTopic("")
    setGeneratedTopics([])
    setTrendingTopics([])
    setSelectedTrendingVideoId(null)
    setCrawledNews([])
    setCustomTopic("")
    setIsCustomTopicSelected(false)
    setIsDirectInputSelected(false)
    setBenchmarkScript("")
    setIsDirectScriptInput(false)
    setDirectScript("")
    setIsStoryMode(false)
    setSelectedCategory("wisdom" as any)
    setShowBasicCategories(true)
    
    // 대본 관련
    setScript("")
    setScriptPlan("")
    setScriptDraft("")
    setDecomposedScenes("")
    setScriptLines([])
    setScriptDuration(20)
    setMaxScenesPerScene(3)
    setReferenceTitle("")
    setReferenceScript("")
    
    // 이미지 관련
    setSceneImagePrompts([])
    setGeneratedImages([])
    setImageStyle("stickman-animation")
    setCustomStylePrompt(null)
    setCustomStyleCharacterImage(null)
    setCustomStyleBackgroundImage(null)
    setRealisticCharacterType(null)
    setConvertedVideos(new Map())
    setConvertedSceneVideos(new Map())
    
    // TTS 관련
    setSelectedVoiceId("ttsmaker-여성1")
    setGeneratedAudios([])
    
    // 영상 관련
    setVideoData(null)
    
    // 제목 관련
    setGeneratedTitles([])
    setSelectedTitle("")
    setCustomTitle("")
    
    // 썸네일 관련
    setYoutubeTitle("")
    setYoutubeDescription(null)
    setAiThumbnailUrl(null)
    setThumbnailCustomText("")
    setThumbnailText([])
    setThumbnailBackgroundImage(null)
    setThumbnailOverlayImage(null)
    setSelectedThumbnailTemplate(null)
    
    // 기타
    setCompletedSteps([])
    setActiveStep("topic")
  }

  // 프로젝트 생성
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert("프로젝트 이름을 입력해주세요.")
      return
    }
    
    if (!userId) {
      alert("사용자 정보를 찾을 수 없습니다.")
      return
    }

    setIsSavingProject(true)
    try {
      // 새 프로젝트 생성 전 모든 상태 초기화
      resetAllStates()
      
      // 빈 데이터로 프로젝트 생성
      const project = await createProject(userId, newProjectName.trim(), newProjectDescription.trim() || undefined, {})
      setProjects([project, ...projects])
      setCurrentProject(project)
      setShowProjectList(false)
      setShowCreateProjectDialog(false)
      setNewProjectName("")
      setNewProjectDescription("")
    } catch (error) {
      console.error("[Projects] 프로젝트 생성 실패:", error)
      alert("프로젝트 생성에 실패했습니다.")
    } finally {
      setIsSavingProject(false)
    }
  }

  // 프로젝트 선택
  const handleSelectProject = async (project: LongformProject) => {
    setCurrentProject(project)
    setShowProjectList(false)
    
    // 프로젝트 데이터 불러오기
    try {
      const projectData = project.data as ProjectData
      
      // 상태 복원
      // 주제 관련
      if (projectData.selectedTopic) setSelectedTopic(projectData.selectedTopic)
      if (projectData.keywords) setKeywords(projectData.keywords)
      if (projectData.customTopic) setCustomTopic(projectData.customTopic)
      if (projectData.isCustomTopicSelected !== undefined) setIsCustomTopicSelected(projectData.isCustomTopicSelected)
      if (projectData.isDirectInputSelected !== undefined) setIsDirectInputSelected(projectData.isDirectInputSelected)
      if (projectData.benchmarkScript) setBenchmarkScript(projectData.benchmarkScript)
      if (projectData.isDirectScriptInput !== undefined) setIsDirectScriptInput(projectData.isDirectScriptInput)
      if (projectData.directScript) setDirectScript(projectData.directScript)
      if (projectData.isStoryMode !== undefined) setIsStoryMode(projectData.isStoryMode)
      if (projectData.generatedTopics) setGeneratedTopics(projectData.generatedTopics)
      if (projectData.selectedCategory) setSelectedCategory(projectData.selectedCategory as any)
      
      // 대본 관련
      if (projectData.script) setScript(projectData.script)
      if (projectData.scriptPlan) setScriptPlan(projectData.scriptPlan)
      if (projectData.scriptDraft) setScriptDraft(projectData.scriptDraft)
      if (projectData.decomposedScenes) setDecomposedScenes(projectData.decomposedScenes)
      if (projectData.scriptLines) setScriptLines(projectData.scriptLines)
      if (projectData.scriptDuration) setScriptDuration(projectData.scriptDuration)
      if (projectData.maxScenesPerScene) setMaxScenesPerScene(projectData.maxScenesPerScene)
      if (projectData.referenceTitle) setReferenceTitle(projectData.referenceTitle)
      if (projectData.referenceScript) setReferenceScript(projectData.referenceScript)
      
      // 이미지 관련
      if (projectData.sceneImagePrompts) setSceneImagePrompts(projectData.sceneImagePrompts)
      if (projectData.generatedImages) setGeneratedImages(projectData.generatedImages)
      if (projectData.imageStyle) setImageStyle(projectData.imageStyle)
      if (projectData.customStylePrompt) setCustomStylePrompt(projectData.customStylePrompt)
      if (projectData.customStyleCharacterImage !== undefined) setCustomStyleCharacterImage(projectData.customStyleCharacterImage)
      if (projectData.customStyleBackgroundImage !== undefined) setCustomStyleBackgroundImage(projectData.customStyleBackgroundImage)
      if (projectData.realisticCharacterType !== undefined) setRealisticCharacterType(projectData.realisticCharacterType)
      // stickmanCharacterDescription는 이미지 프롬프트 생성 시 지역 변수로만 사용되므로 복원하지 않음
      // 변환된 영상 복원 (배열을 Map으로 변환)
      if (projectData.convertedVideos) {
        const convertedVideosMap = new Map<number, string>()
        projectData.convertedVideos.forEach(({ lineId, videoUrl }) => {
          convertedVideosMap.set(lineId, videoUrl)
        })
        setConvertedVideos(convertedVideosMap)
      }
      if (projectData.convertedSceneVideos) {
        const convertedSceneVideosMap = new Map<string, string>()
        projectData.convertedSceneVideos.forEach(({ key, videoUrl }) => {
          convertedSceneVideosMap.set(key, videoUrl)
        })
        setConvertedSceneVideos(convertedSceneVideosMap)
      }
      
      // TTS 관련
      if (projectData.selectedVoiceId) setSelectedVoiceId(projectData.selectedVoiceId)
      if (projectData.generatedAudios) {
        // audioBase64는 용량이 커서 저장하지 않음 (Server Actions 1MB 제한)
        // audioUrl만 저장되므로, audioBase64는 빈 문자열로 설정
        // alignment는 저장하지 않음
        setGeneratedAudios(projectData.generatedAudios.map(audio => ({
          lineId: audio.lineId,
          audioUrl: audio.audioUrl,
          audioBase64: "", // audioBase64는 저장하지 않으므로 항상 빈 문자열
          alignment: undefined, // alignment는 저장하지 않았으므로 undefined
        })))
      }
      
      // 영상 관련
      if (projectData.videoData) setVideoData(projectData.videoData)
      
      // 제목 관련
      if (projectData.generatedTitles) setGeneratedTitles(projectData.generatedTitles)
      if (projectData.selectedTitle) setSelectedTitle(projectData.selectedTitle)
      if (projectData.customTitle) setCustomTitle(projectData.customTitle)
      
      // 썸네일 관련
      if (projectData.youtubeTitle) setYoutubeTitle(projectData.youtubeTitle)
      if (projectData.youtubeDescription) setYoutubeDescription(projectData.youtubeDescription)
      if (projectData.aiThumbnailUrl !== undefined) setAiThumbnailUrl(projectData.aiThumbnailUrl)
      if (projectData.thumbnailCustomText) setThumbnailCustomText(projectData.thumbnailCustomText)
      if (projectData.thumbnailText) setThumbnailText(projectData.thumbnailText)
      
      // 기타
      if (projectData.completedSteps) setCompletedSteps(projectData.completedSteps)
      if (projectData.activeStep) setActiveStep(projectData.activeStep)
    } catch (error) {
      console.error("[Projects] 프로젝트 데이터 복원 실패:", error)
    }
  }

  // 프로젝트 저장 (자동 저장용 - 에러 알림 없음)
  const handleAutoSaveProject = async (silent: boolean = true): Promise<boolean> => {
    if (!currentProject) {
      if (!silent) {
        alert("저장할 프로젝트가 없습니다. 먼저 프로젝트를 생성하거나 선택해주세요.")
      }
      return false
    }

    // 이미 저장 중이면 스킵
    if (isSavingProject) {
      return false
    }

    setIsSavingProject(true)
    try {
      // 현재 상태를 프로젝트 데이터로 변환
      // Map을 배열로 변환 (convertedVideos, convertedSceneVideos)
      const convertedVideosArray = Array.from(convertedVideos.entries()).map(([lineId, videoUrl]) => ({
        lineId,
        videoUrl,
      }))
      const convertedSceneVideosArray = Array.from(convertedSceneVideos.entries()).map(([key, videoUrl]) => ({
        key,
        videoUrl,
      }))
      
      const projectData: ProjectData = {
        // 주제 관련
        selectedTopic,
        keywords,
        customTopic,
        isCustomTopicSelected,
        isDirectInputSelected,
        benchmarkScript,
        isDirectScriptInput,
        directScript,
        isStoryMode,
        generatedTopics,
        selectedCategory,
        
        // 대본 관련
        script,
        scriptPlan,
        scriptDraft,
        decomposedScenes,
        scriptLines,
        scriptDuration,
        maxScenesPerScene,
        referenceTitle,
        referenceScript,
        
        // 이미지 관련
        // sceneImagePrompts와 generatedImages에서 base64 이미지 제거 (URL만 저장)
        sceneImagePrompts: sceneImagePrompts.map(scene => ({
          ...scene,
          images: scene.images.map(img => ({
            ...img,
            // base64 이미지는 제외하고 URL만 저장
            imageUrl: img.imageUrl?.startsWith("data:") ? undefined : img.imageUrl,
          })),
        })),
        generatedImages: generatedImages.map(img => ({
          ...img,
          // base64 이미지는 제외하고 URL만 저장
          imageUrl: img.imageUrl?.startsWith("data:") ? "" : img.imageUrl,
        })),
        imageStyle,
        customStylePrompt,
        // customStyleCharacterImage와 customStyleBackgroundImage는 base64일 수 있어 용량이 크므로 URL만 저장
        customStyleCharacterImage: customStyleCharacterImage?.startsWith("data:") ? null : customStyleCharacterImage,
        customStyleBackgroundImage: customStyleBackgroundImage?.startsWith("data:") ? null : customStyleBackgroundImage,
        realisticCharacterType,
        // stickmanCharacterDescription는 이미지 프롬프트 생성 시 지역 변수로만 사용되므로 저장하지 않음
        convertedVideos: convertedVideosArray,
        convertedSceneVideos: convertedSceneVideosArray,
        
        // TTS 관련
        selectedVoiceId,
        // audioBase64는 용량이 커서 Server Actions의 1MB 제한을 초과할 수 있으므로 제외
        // audioUrl만 저장 (TTSMaker/ElevenLabs는 이미 URL을 제공)
        generatedAudios: generatedAudios.map(audio => ({
          lineId: audio.lineId,
          audioUrl: audio.audioUrl,
          // audioBase64는 용량이 커서 제외 (Server Actions 1MB 제한)
          // alignment는 용량이 클 수 있으므로 제외
        })),
        
        // 영상 관련
        // videoData의 autoImages에서 base64 이미지 제거 (URL만 저장)
        videoData: videoData ? {
          ...videoData,
          autoImages: videoData.autoImages?.map(img => ({
            ...img,
            // base64 이미지는 제외하고 URL만 저장
            url: img.url?.startsWith("data:") ? "" : img.url,
          })),
        } : null,
        
        // 제목 관련
        generatedTitles,
        selectedTitle,
        customTitle,
        
        // 썸네일 관련
        youtubeTitle,
        youtubeDescription,
        aiThumbnailUrl,
        thumbnailCustomText,
        thumbnailText,
        
        // 기타
        completedSteps,
        activeStep,
      }

      // 데이터 직렬화 테스트 및 크기 확인
      try {
        const serialized = JSON.stringify(projectData)
        const dataSizeMB = serialized.length / 1024 / 1024
        console.log(`[Projects] 자동 저장할 데이터 크기: ${dataSizeMB.toFixed(2)}MB`)
        
        if (dataSizeMB > 1) {
          console.warn(`[Projects] 데이터 크기가 1MB를 초과합니다: ${dataSizeMB.toFixed(2)}MB`)
        }
      } catch (serializeError) {
        console.error("[Projects] 데이터 직렬화 실패:", serializeError)
        console.error("[Projects] 직렬화 실패한 데이터 일부:", {
          generatedAudiosCount: projectData.generatedAudios?.length || 0,
          generatedAudiosSample: projectData.generatedAudios?.slice(0, 2),
        })
        if (!silent) {
          alert(`프로젝트 저장 실패: 데이터 직렬화 오류가 발생했습니다. ${serializeError instanceof Error ? serializeError.message : String(serializeError)}`)
        }
        return false
      }

      await updateProject(currentProject.id, { data: projectData })
      
      // 프로젝트 목록 업데이트 (자동 저장 시에는 생략하여 성능 향상)
      // await loadProjects()
      
      // 현재 프로젝트 업데이트
      const updatedProject = await getProject(currentProject.id)
      if (updatedProject) {
        setCurrentProject(updatedProject)
      }
      
      return true
    } catch (error) {
      console.error("[Projects] 프로젝트 자동 저장 실패:", error)
      if (!silent) {
        const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
        alert(`프로젝트 저장에 실패했습니다: ${errorMessage}`)
      }
      return false
    } finally {
      setIsSavingProject(false)
    }
  }

  // 프로젝트 저장 (수동 저장용)
  const handleSaveProject = async () => {
    if (!currentProject) {
      alert("저장할 프로젝트가 없습니다. 먼저 프로젝트를 생성하거나 선택해주세요.")
      return
    }

    setIsSavingProject(true)
    try {
      // 현재 상태를 프로젝트 데이터로 변환
      // Map을 배열로 변환 (convertedVideos, convertedSceneVideos)
      const convertedVideosArray = Array.from(convertedVideos.entries()).map(([lineId, videoUrl]) => ({
        lineId,
        videoUrl,
      }))
      const convertedSceneVideosArray = Array.from(convertedSceneVideos.entries()).map(([key, videoUrl]) => ({
        key,
        videoUrl,
      }))
      
      const projectData: ProjectData = {
        // 주제 관련
        selectedTopic,
        keywords,
        customTopic,
        isCustomTopicSelected,
        isDirectInputSelected,
        benchmarkScript,
        isDirectScriptInput,
        directScript,
        isStoryMode,
        generatedTopics,
        selectedCategory,
        
        // 대본 관련
        script,
        scriptPlan,
        scriptDraft,
        decomposedScenes,
        scriptLines,
        scriptDuration,
        maxScenesPerScene,
        referenceTitle,
        referenceScript,
        
        // 이미지 관련
        // sceneImagePrompts와 generatedImages에서 base64 이미지 제거 (URL만 저장)
        sceneImagePrompts: sceneImagePrompts.map(scene => ({
          ...scene,
          images: scene.images.map(img => ({
            ...img,
            // base64 이미지는 제외하고 URL만 저장
            imageUrl: img.imageUrl?.startsWith("data:") ? undefined : img.imageUrl,
          })),
        })),
        generatedImages: generatedImages.map(img => ({
          ...img,
          // base64 이미지는 제외하고 URL만 저장
          imageUrl: img.imageUrl?.startsWith("data:") ? "" : img.imageUrl,
        })),
        imageStyle,
        customStylePrompt,
        // customStyleCharacterImage와 customStyleBackgroundImage는 base64일 수 있어 용량이 크므로 URL만 저장
        customStyleCharacterImage: customStyleCharacterImage?.startsWith("data:") ? null : customStyleCharacterImage,
        customStyleBackgroundImage: customStyleBackgroundImage?.startsWith("data:") ? null : customStyleBackgroundImage,
        realisticCharacterType,
        // stickmanCharacterDescription는 이미지 프롬프트 생성 시 지역 변수로만 사용되므로 저장하지 않음
        convertedVideos: convertedVideosArray,
        convertedSceneVideos: convertedSceneVideosArray,
        
        // TTS 관련
        selectedVoiceId,
        // audioBase64는 용량이 커서 Server Actions의 1MB 제한을 초과할 수 있으므로 제외
        // audioUrl만 저장 (TTSMaker/ElevenLabs는 이미 URL을 제공)
        generatedAudios: generatedAudios.map(audio => ({
          lineId: audio.lineId,
          audioUrl: audio.audioUrl,
          // audioBase64는 용량이 커서 제외 (Server Actions 1MB 제한)
          // alignment는 용량이 클 수 있으므로 제외
        })),
        
        // 영상 관련
        // videoData의 autoImages에서 base64 이미지 제거 (URL만 저장)
        videoData: videoData ? {
          ...videoData,
          autoImages: videoData.autoImages?.map(img => ({
            ...img,
            // base64 이미지는 제외하고 URL만 저장
            url: img.url?.startsWith("data:") ? "" : img.url,
          })),
        } : null,
        
        // 제목 관련
        generatedTitles,
        selectedTitle,
        customTitle,
        
        // 썸네일 관련
        youtubeTitle,
        youtubeDescription,
        aiThumbnailUrl,
        thumbnailCustomText,
        thumbnailText,
        
        // 기타
        completedSteps,
        activeStep,
      }

      // 데이터 직렬화 테스트 및 크기 확인
      try {
        const serialized = JSON.stringify(projectData)
        const dataSizeMB = serialized.length / 1024 / 1024
        console.log(`[Projects] 저장할 데이터 크기: ${dataSizeMB.toFixed(2)}MB`)
        
        if (dataSizeMB > 1) {
          console.warn(`[Projects] 데이터 크기가 1MB를 초과합니다: ${dataSizeMB.toFixed(2)}MB`)
          // 1MB를 초과하면 경고만 표시하고 계속 진행 (Supabase JSONB는 더 큰 데이터도 지원)
        }
      } catch (serializeError) {
        console.error("[Projects] 데이터 직렬화 실패:", serializeError)
        console.error("[Projects] 직렬화 실패한 데이터 일부:", {
          generatedAudiosCount: projectData.generatedAudios?.length || 0,
          generatedAudiosSample: projectData.generatedAudios?.slice(0, 2),
          generatedImagesCount: projectData.generatedImages?.length || 0,
          sceneImagePromptsCount: projectData.sceneImagePrompts?.length || 0,
        })
        alert(`프로젝트 저장 실패: 데이터 직렬화 오류가 발생했습니다. ${serializeError instanceof Error ? serializeError.message : String(serializeError)}`)
        return
      }

      await updateProject(currentProject.id, { data: projectData })
      
      // 프로젝트 목록 업데이트
      await loadProjects()
      
      // 현재 프로젝트 업데이트
      const updatedProject = await getProject(currentProject.id)
      if (updatedProject) {
        setCurrentProject(updatedProject)
      }
    } catch (error) {
      console.error("[Projects] 프로젝트 저장 실패:", error)
      alert("프로젝트 저장에 실패했습니다.")
    } finally {
      setIsSavingProject(false)
    }
  }

  // 프로젝트 삭제
  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm("정말 이 프로젝트를 삭제하시겠습니까?")) {
      return
    }

    try {
      await deleteProject(projectId)
      setProjects(projects.filter(p => p.id !== projectId))
      
      // 현재 선택된 프로젝트가 삭제된 경우
      if (currentProject?.id === projectId) {
        setCurrentProject(null)
        setShowProjectList(true)
      }
    } catch (error) {
      console.error("[Projects] 프로젝트 삭제 실패:", error)
      alert("프로젝트 삭제에 실패했습니다.")
    }
  }

  // 프로젝트 목록 화면 표시
  const handleShowProjectList = () => {
    setShowProjectList(true)
    setCurrentProject(null)
  }

  // 프로젝트 목록 불러오기 (컴포넌트 마운트 시)
  useEffect(() => {
    if (userId) {
      loadProjects()
    }
  }, [userId])

  // 프로젝트 목록 화면 렌더링
  const renderProjectList = () => {
    // 로그인하지 않은 경우 안내
    if (userId === "anonymous" || !userId) {
      return (
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">롱폼 프로젝트</h1>
              <p className="text-gray-600">작업한 내용을 저장하고 관리하세요</p>
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>안내사항:</strong> 이미지는 1시간 후에 삭제가 되기에 미리 저장 또는 렌더링 부탁드립니다. TTS 용량이 크면 저장이 안될 수 있습니다. 참고바랍니다.
                </p>
              </div>
            </div>
            
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">로그인이 필요합니다</h3>
                <p className="text-gray-600 mb-6">
                  프로젝트를 생성하고 관리하려면 먼저 로그인해주세요.
                </p>
                <Button
                  onClick={() => window.location.href = "/"}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  로그인하러 가기
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">롱폼 프로젝트</h1>
            <p className="text-gray-600">작업한 내용을 저장하고 관리하세요</p>
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>안내사항:</strong> 이미지는 1시간 후에 삭제가 되기에 미리 저장 또는 렌더링 부탁드립니다. TTS 용량이 크면 저장이 안될 수 있습니다. 참고바랍니다.
              </p>
            </div>
          </div>

          <div className="mb-6 flex justify-end">
            <Button
              onClick={() => setShowCreateProjectDialog(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              새 프로젝트 만들기
            </Button>
          </div>

          {isLoadingProjects ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : projects.length === 0 ? (
            <Card className="p-12 text-center">
              <Folder className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">프로젝트가 없습니다</h3>
              <p className="text-gray-600 mb-6">새 프로젝트를 만들어 시작하세요</p>
              <Button
                onClick={() => setShowCreateProjectDialog(true)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                새 프로젝트 만들기
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleSelectProject(project)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{project.name}</CardTitle>
                        {project.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => handleDeleteProject(project.id, e)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-gray-500">
                      <p>수정: {new Date(project.updated_at).toLocaleString("ko-KR")}</p>
                      <p>생성: {new Date(project.created_at).toLocaleString("ko-KR")}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* 프로젝트 생성 다이얼로그 */}
        <Dialog open={showCreateProjectDialog} onOpenChange={setShowCreateProjectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 프로젝트 만들기</DialogTitle>
              <DialogDescription>
                프로젝트 이름을 입력하고 작업을 시작하세요
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="project-name">프로젝트 이름 *</Label>
                <Input
                  id="project-name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="예: 건강 영상 프로젝트"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="project-description">프로젝트 설명 (선택사항)</Label>
                <Textarea
                  id="project-description"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="프로젝트에 대한 간단한 설명을 입력하세요"
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateProjectDialog(false)
                    setNewProjectName("")
                    setNewProjectDescription("")
                  }}
                >
                  취소
                </Button>
                <Button
                  onClick={handleCreateProject}
                  disabled={isSavingProject || !newProjectName.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isSavingProject ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    "생성"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // 프로젝트 목록 화면이 표시되어야 하면 프로젝트 목록 렌더링
  if (showProjectList) {
    return renderProjectList()
  }

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
                          { id: "health", name: "건강", icon: "🏥", gradient: "from-green-400 to-emerald-500", available: false },
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
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">틈새 주제</h3>
                        <div className="relative w-48">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            type="text"
                            placeholder="카테고리 검색..."
                            value={nicheCategorySearch}
                            onChange={(e) => setNicheCategorySearch(e.target.value)}
                            className="pl-9 pr-3 py-1.5 text-sm border-gray-300 focus:ring-red-500 focus:border-red-500"
                          />
                        </div>
                      </div>
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
                          { id: "direct_input", name: "직접입력", icon: "✍️", gradient: "from-purple-500 to-pink-500", available: true, isDirectInput: true },
                        ]
                          .filter((category) => {
                            if (!nicheCategorySearch.trim()) return true
                            return category.name.toLowerCase().includes(nicheCategorySearch.toLowerCase())
                          })
                          .map((category: any) => (
                          <div
                            key={category.id}
                            className={`group relative overflow-hidden rounded-lg cursor-pointer transition-all duration-200 ${
                              (category.isDirectInput && isDirectInputSelected) || (!category.isDirectInput && selectedCategory === category.id)
                                ? "bg-red-50 border border-red-300 text-red-700 scale-105"
                                : "bg-gray-50 hover:bg-gray-100 hover:scale-105 hover:shadow-xs"
                            } ${!category.available ? "opacity-50 cursor-not-allowed" : ""}`}
                            onClick={() => {
                              if (category.available) {
                                if (category.isDirectInput) {
                                  // 직접입력 선택
                                  setIsDirectInputSelected(true)
                                  setSelectedCategory("health" as any) // 기본 카테고리로 설정
                                  setKeywords("") // 키워드 초기화
                                } else {
                                  // 일반 카테고리 선택
                                  setIsDirectInputSelected(false)
                                  setBenchmarkScript("") // 벤치마킹 대본 초기화
                                  setSelectedCategory(category.id as any)
                                  setKeywords("") // 카테고리 변경 시 키워드 초기화
                                }
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
                    {isDirectScriptInput
                      ? "외부에서 생성한 대본을 붙여넣으면 대본 기획 및 초안 단계를 생략하고 바로 대본 생성 단계로 이동합니다."
                      : isDirectInputSelected 
                      ? "벤치마킹 대본을 입력하면 해당 대본을 기반으로 대본 기획이 생성됩니다."
                      : "키워드를 입력하지 않으면 선택한 카테고리 기준으로 주제를 생성합니다."}
                  </p>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* 대본 직접 넣기 버튼 */}
                  {!isDirectScriptInput && !isDirectInputSelected && (
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsDirectScriptInput(true)
                          setIsDirectInputSelected(false)
                          setKeywords("")
                        }}
                        className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        대본 직접 넣기
                      </Button>
                    </div>
                  )}

                  {/* 대본 직접 넣기 모드 */}
                  {isDirectScriptInput ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="direct-script" className="text-sm font-medium text-gray-700">
                          대본 직접 입력
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsDirectScriptInput(false)
                            setDirectScript("")
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          취소
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        외부 AI 툴로 생성한 완성된 대본을 붙여넣으세요. 대본 기획 및 초안 단계를 생략하고 바로 사용할 수 있습니다.
                      </p>
                      <Textarea
                        id="direct-script"
                        value={directScript}
                        onChange={(e) => setDirectScript(e.target.value)}
                        placeholder="완성된 대본을 붙여넣으세요..."
                        className="min-h-[300px] resize-y border-gray-300 focus:ring-purple-500 focus:border-purple-500 rounded-lg"
                      />
                      <Button
                        onClick={() => {
                          if (!directScript.trim()) {
                            alert("대본을 입력해주세요.")
                            return
                          }
                          
                          // 대본을 바로 script state에 설정
                          setScript(directScript)
                          
                          // 대본을 줄 단위로 분리하여 scriptLines 설정
                          const lines = directScript
                            .split("\n")
                            .filter((line) => line.trim())
                            .map((line, index) => ({
                              id: index + 1,
                              text: line.trim(),
                            }))
                          setScriptLines(lines)
                          
                          // 대본 기획 및 초안 단계를 완료 처리
                          setCompletedSteps((prev) => {
                            const newSteps = [...prev]
                            if (!newSteps.includes("topic")) newSteps.push("topic")
                            if (!newSteps.includes("planning")) newSteps.push("planning")
                            if (!newSteps.includes("draft")) newSteps.push("draft")
                            return newSteps
                          })
                          
                          // 대본 생성 단계로 바로 이동
                          setActiveStep("script")
                          
                          alert("대본이 설정되었습니다. 대본 생성 단계로 이동합니다.")
                        }}
                        disabled={!directScript.trim()}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        대본 적용하고 다음 단계로
                      </Button>
                    </div>
                  ) : isDirectInputSelected ? (
                    <div className="space-y-2">
                      <Label htmlFor="benchmark-script" className="text-sm font-medium text-gray-700">
                        벤치마킹 대본 입력
                      </Label>
                      <p className="text-xs text-gray-500 mb-3">
                        참고할 대본을 입력하세요. 이 대본을 기반으로 대본 기획이 생성됩니다.
                      </p>
                      <Textarea
                        id="benchmark-script"
                        value={benchmarkScript}
                        onChange={(e) => setBenchmarkScript(e.target.value)}
                        placeholder="벤치마킹 대본을 입력하세요..."
                        className="min-h-[200px] resize-y border-gray-300 focus:ring-red-500 focus:border-red-500 rounded-lg"
                      />
                    </div>
                  ) : (
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
                  )}

                  <div className="grid grid-cols-1 gap-3">
                    {isDirectInputSelected ? (
                      <Button
                        onClick={async () => {
                          if (!benchmarkScript.trim()) {
                            alert("벤치마킹 대본을 입력해주세요.")
                            return
                          }
                          
                          // 벤치마킹 대본을 referenceScript에 설정
                          setReferenceScript(benchmarkScript)
                          
                          // 벤치마킹 대본에서 주제 추출 (간단하게 첫 50자 또는 기본값 사용)
                          const extractedTopic = benchmarkScript.substring(0, 50).trim() || "벤치마킹 대본 기반 주제"
                          setSelectedTopic(extractedTopic)
                          setIsCustomTopicSelected(false)
                          
                          // 대본 기획 단계로 이동
                          setActiveStep("planning")
                          
                          // 대본 기획 생성 시작
                          setIsGenerating(true)
                          try {
                            const geminiApiKey = getGeminiApiKey()
                            if (!geminiApiKey) {
                              alert("Gemini API 키를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
                              setIsGenerating(false)
                              return
                            }
                            const plan = await generateScriptPlan(
                              extractedTopic,
                              selectedCategory || "health",
                              keywords || undefined,
                              geminiApiKey,
                              scriptDuration,
                              benchmarkScript || undefined
                            )
                            setScriptPlan(plan)
                            setScriptDraft("") // 기획안이 새로 생성되면 초안 초기화
                            setCompletedSteps((prev) => {
                              const newSteps = [...prev]
                              if (!newSteps.includes("topic")) newSteps.push("topic")
                              if (!newSteps.includes("planning")) newSteps.push("planning")
                              return newSteps
                            })
                          } catch (error) {
                            console.error("대본 기획 생성 실패:", error)
                            const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
                            alert(`대본 기획 생성에 실패했습니다: ${errorMessage}`)
                          } finally {
                            setIsGenerating(false)
                          }
                        }}
                        disabled={isGenerating || !benchmarkScript.trim()}
                        className="h-12 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        size="lg"
                      >
                        {isGenerating ? (
                          <>
                            <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                            AI가 대본 기획을 생성하고 있습니다...
                          </>
                        ) : (
                          <>
                            <FileText className="w-5 h-5 mr-2" />
                            대본 기획 생성하기
                          </>
                        )}
                      </Button>
                    ) : (
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
                    )}
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
                        setIsDirectInputSelected(false) // 직접입력 모드 해제
                        setCompletedSteps((prev) => {
                          if (!prev.includes("topic")) {
                            return [...prev, "topic"]
                          }
                          return prev
                        })
                        
                        // 벤치마킹 대본이 있으면 referenceScript에 설정
                        if (benchmarkScript.trim()) {
                          setReferenceScript(benchmarkScript)
                        }
                        
                        // 주제 선택 후 모드 선택 UI가 표시됨 (planning 단계로 자동 이동하지 않음)
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
                    
                    {/* 레퍼런스 대본 입력 (직접입력이 아닐 때만 표시) */}
                    {!isDirectInputSelected && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <Label htmlFor="reference-script" className="text-sm font-medium text-gray-700 mb-2 block">
                          레퍼런스 대본 (선택사항)
                        </Label>
                        <p className="text-xs text-gray-500 mb-3">
                          참고할 대본이 있다면 입력해주세요. 이 대본을 기반으로 새로운 관점의 대본을 생성합니다.
                        </p>
                        <Textarea
                          id="reference-script"
                          value={referenceScript}
                          onChange={(e) => setReferenceScript(e.target.value)}
                          placeholder="레퍼런스 대본을 입력하세요..."
                          className="min-h-[120px] resize-y"
                        />
                      </div>
                    )}
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
                        disabled={!youtubeConnected || isScheduling || !youtubeScheduleDate || !videoData || !videoData?.videoUrl}
                        onClick={handleYoutubeSchedule}
                      >
                        <Youtube className="w-4 h-4 mr-2" />
                        {isScheduling ? "예약 중..." : "유튜브 업로드 예약"}
                      </Button>
                      {!youtubeConnected && (
                        <p className="text-xs text-red-500 mt-2 text-center">
                          ※ 설정에서 YouTube 계정을 먼저 연결해주세요.
                        </p>
                      )}
                      {youtubeConnected && (!videoData || !videoData.videoUrl) && (
                        <p className="text-xs text-yellow-500 mt-2 text-center">
                          ※ 영상 렌더링이 완료되어야 업로드할 수 있습니다.
                        </p>
                      )}
                      {youtubeConnected && videoData && videoData.videoUrl && !youtubeScheduleDate && (
                        <p className="text-xs text-yellow-500 mt-2 text-center">
                          ※ 예약 날짜를 선택해주세요.
                        </p>
                      )}
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
                      {/* 자동화 모드 (비활성화) */}
                      <div
                        className="p-6 rounded-xl border-2 border-gray-200 bg-gray-50 cursor-not-allowed opacity-60 relative"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
                            <Zap className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-gray-600">🚀 자동화 모드</h3>
                            <p className="text-xs text-gray-400">원클릭으로 모든 작업 완료</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                          대본 기획부터 썸네일 생성까지 모든 과정을 AI가 자동으로 처리합니다.
                        </p>
                        <ul className="text-xs text-gray-400 space-y-1">
                          <li>✓ 대본 기획 → 초안 → 완성</li>
                          <li>✓ AI 이미지 자동 생성</li>
                          <li>✓ TTS 음성 자동 생성</li>
                          <li>✓ 제목/설명/썸네일 자동 생성</li>
                        </ul>
                        <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                          12월 28일 오픈예정
                        </div>
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

                    {/* 자동화 설정 팝업 (대본 시간 및 목소리 선택) */}
                    <Dialog open={showAutomationSettingsDialog} onOpenChange={setShowAutomationSettingsDialog}>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-red-500" />
                            자동화 설정
                          </DialogTitle>
                          <DialogDescription className="text-sm text-gray-600">
                            대본 생성에 필요한 시간과 목소리를 선택해주세요.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-6 mt-4">
                          {/* 대본 시간 선택 */}
                          <div className="space-y-2">
                            <Label htmlFor="automation-script-duration" className="text-sm font-medium text-gray-700">
                              대본 시간 선택
                            </Label>
                            <Select
                              value={scriptDuration.toString()}
                              onValueChange={(value) => setScriptDuration(Number.parseInt(value, 10))}
                            >
                              <SelectTrigger id="automation-script-duration" className="w-full">
                                <SelectValue placeholder="대본 시간을 선택하세요" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">5분 (약 {Math.floor(5 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                                <SelectItem value="10">10분 (약 {Math.floor(10 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                                <SelectItem value="15">15분 (약 {Math.floor(15 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                                <SelectItem value="20">20분 (약 {Math.floor(20 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                                <SelectItem value="25">25분 (약 {Math.floor(25 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                                <SelectItem value="30">30분 (약 {Math.floor(30 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                                <SelectItem value="35">35분 (약 {Math.floor(35 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                                <SelectItem value="40">40분 (약 {Math.floor(40 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500">
                              선택한 시간에 맞춰 대본이 생성됩니다.
                            </p>
                          </div>

                          {/* 목소리 선택 */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">목소리 선택</Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto p-2 border border-gray-200 rounded-lg">
                              {[
                                // { id: "jB1Cifc2UQbq1gR3wnb0", name: "Rachel", note: "기본(Default)", provider: "elevenlabs" }, // 숨김
                                // { id: "8jHHF8rMqMlg8if2mOUe", name: "Voice 2", note: "사용자 선택형", provider: "elevenlabs" }, // 숨김
                                // { id: "uyVNoMrnUku1dZyVEXwD", name: "Voice 3", note: "", provider: "elevenlabs" }, // 숨김
                                { id: "ttsmaker-여성1", name: "TTSMaker 여성1", note: "ID: 503", provider: "ttsmaker" },
                                { id: "ttsmaker-여성2", name: "TTSMaker 여성2", note: "ID: 509", provider: "ttsmaker" },
                                { id: "ttsmaker-여성6", name: "TTSMaker 여성3", note: "ID: 5802", provider: "ttsmaker" },
                                { id: "ttsmaker-남성1", name: "TTSMaker 남성1", note: "ID: 5501", provider: "ttsmaker" },
                                { id: "ttsmaker-남성4", name: "TTSMaker 남성2", note: "ID: 5888", provider: "ttsmaker" },
                                { id: "ttsmaker-남성5", name: "TTSMaker 남성3", note: "ID: 5888 (음높이 -10%)", provider: "ttsmaker" },
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
                            {previewAudioUrl && (
                              <audio
                                src={previewAudioUrl}
                                autoPlay
                                onEnded={() => {
                                  setPreviewAudioUrl(null)
                                  setPreviewingVoiceId(null)
                                }}
                                className="w-full"
                              />
                            )}
                          </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                          <Button
                            onClick={handleAutomationSettingsConfirm}
                            className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold"
                          >
                            확인
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowAutomationSettingsDialog(false)
                              setWorkflowMode(null)
                            }}
                            className="px-4"
                          >
                            취소
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

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
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">대본 기획</h1>
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
                  {/* 대본 기획 생성/재생성 버튼 */}
                  {!scriptPlan ? (
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
                  ) : (
                    <Button onClick={handleScriptPlanGeneration} disabled={isGenerating || isScanning} variant="outline" className="w-full">
                      {isGenerating && !isScanning ? (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                          재생성 중...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          대본 기획 재생성
                        </>
                      )}
                    </Button>
                  )}

                  {scriptPlan && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">생성된 대본 기획안</label>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(scriptPlan)}>
                            <Copy className="w-4 h-4 mr-2" />
                            복사
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

                        </CardContent>
                      </Card>
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


            {scriptPlan && (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="text-lg font-semibold text-slate-900">최종 대본 생성</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-gray-600">
                    ※ 대본 기획안을 바탕으로 최종 대본을 생성합니다.
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
                        <SelectItem value="5">5분 (최소 {Math.floor(5 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                        <SelectItem value="10">10분 (최소 {Math.floor(10 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                        <SelectItem value="15">15분 (최소 {Math.floor(15 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                        <SelectItem value="20">20분 (최소 {Math.floor(20 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                        <SelectItem value="25">25분 (최소 {Math.floor(25 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                        <SelectItem value="30">30분 (최소 {Math.floor(30 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                        <SelectItem value="35">35분 (최소 {Math.floor(35 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                        <SelectItem value="40">40분 (최소 {Math.floor(40 * 60 * 6.9).toLocaleString()}자)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      대략적인 시간이고 TTS속도에 따라 시간이 줄거나 늘어날 수 있음
                    </p>
                  </div>
                  
                  {/* 대본 생성 버튼 */}
                  <Button 
                    onClick={handleRefinedScriptGeneration} 
                    disabled={isGenerating} 
                    className="w-full bg-red-500 hover:bg-red-600 text-white" 
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        대본 생성 중...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        정교한 대본 생성하기
                      </>
                    )}
                  </Button>
                  
                  {/* 로딩 다이얼로그 */}
                  <Dialog open={isGenerating} onOpenChange={() => {}}>
                    <DialogContent className="sm:max-w-md" showCloseButton={false}>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 animate-spin text-blue-500" />
                          정교한 대본 생성 중...
                        </DialogTitle>
                        <DialogDescription>
                          AI가 대본을 생성하고 있습니다. 잠시만 기다려주세요.
                        </DialogDescription>
                      </DialogHeader>
                      
                      {scriptGenerationProgress && (
                        <div className="space-y-4 py-4">
                          {/* 진행률 바 */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium">진행률</span>
                              <span className="text-blue-600 font-semibold">{scriptGenerationProgress.progress}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
                                style={{ width: `${scriptGenerationProgress.progress}%` }}
                              >
                                {scriptGenerationProgress.progress > 10 && (
                                  <span className="text-xs text-white font-medium">{scriptGenerationProgress.progress}%</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* 시간 정보 */}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                              <p className="text-muted-foreground">경과 시간</p>
                              <p className="font-semibold">
                                {Math.floor(scriptGenerationProgress.elapsedTime / 60)}분 {scriptGenerationProgress.elapsedTime % 60}초
                              </p>
                            </div>
                            {scriptGenerationProgress.progress < 95 && (
                              <div className="space-y-1">
                                <p className="text-muted-foreground">예상 시간</p>
                                <p className="font-semibold">
                                  {Math.floor(scriptGenerationProgress.estimatedTime / 60)}분 {scriptGenerationProgress.estimatedTime % 60}초
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {/* 남은 시간 (예상) */}
                          {scriptGenerationProgress.progress < 95 && scriptGenerationProgress.estimatedTime > scriptGenerationProgress.elapsedTime && (
                            <div className="text-center text-sm text-muted-foreground">
                              예상 남은 시간: 약 {Math.floor((scriptGenerationProgress.estimatedTime - scriptGenerationProgress.elapsedTime) / 60)}분 {(scriptGenerationProgress.estimatedTime - scriptGenerationProgress.elapsedTime) % 60}초
                            </div>
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>

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
                    onClick={async () => {
                      if (!script || script.trim().length === 0) {
                        alert("대본이 없습니다.")
                        return
                      }
                      
                      setIsSplittingScenes(true)
                      try {
                        const geminiApiKey = getGeminiApiKey()
                        if (!geminiApiKey) {
                          alert("Gemini API 키를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
                          return
                        }
                        
                        console.log("[씬 나누기] 시작...")
                        const splitResult = await autoSplitScriptByMeaning(script, geminiApiKey)
                        setScript(splitResult)
                        console.log("[씬 나누기] 완료")
                        alert("대본이 의미 단위로 나뉘었습니다.")
                      } catch (error) {
                        console.error("[씬 나누기] 에러:", error)
                        const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
                        alert(`씬 나누기에 실패했습니다: ${errorMessage}`)
                      } finally {
                        setIsSplittingScenes(false)
                      }
                    }}
                    disabled={isSplittingScenes || !script.trim()}
                  >
                    {isSplittingScenes ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        나누는 중...
                      </>
                    ) : (
                      <>
                        <Scissors className="w-4 h-4 mr-2" />
                        씬 나누기
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(script)}>
                    <Copy className="w-4 h-4 mr-2" />
                    복사
                  </Button>
                </div>
              </div>
              <Textarea
                    placeholder="대본이 여기에 생성됩니다. 수정 후 '장면 분해' 버튼을 클릭하세요..."
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />
                  <div className="mt-2 flex justify-between items-center text-xs text-muted-foreground">
                    <span>💡 대본을 수정한 후 "장면 분해" 버튼을 클릭하면 수정된 내용이 반영됩니다.</span>
                    {script && <span>글자 수: {script.length.toLocaleString()}자</span>}
            </div>
                </CardContent>
                {/* 장면 분해 버튼 - 카드 테두리 밑 */}
                <div className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-4">
                  {/* 최대 장면 개수 선택 */}
                  <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">씬당 최대 장면 개수:</Label>
                    <div className="flex gap-2">
                      {[1, 2, 3].map((num) => (
                        <Button
                          key={num}
                          variant={maxScenesPerScene === num ? "default" : "outline"}
                          size="sm"
                          onClick={() => setMaxScenesPerScene(num as 1 | 2 | 3)}
                          className={maxScenesPerScene === num ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
                        >
                          최대 {num}개
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={async () => {
                      console.log("[장면 분해 버튼] 클릭됨")
                      if (!script || script.trim().length === 0) {
                        console.warn("[장면 분해 버튼] 대본이 없음")
                        alert("대본이 없습니다.")
                        return
                      }
                      console.log(`[장면 분해 버튼] 대본 길이: ${script.length}자`)
                      setIsDecomposingScenes(true)
                      
                      // 1단계: 총 씬 개수 먼저 분석
                      console.log("[장면 분해] 총 씬 개수 분석 시작...")
                      
                      // 대본을 의미 단위(씬)로 나누기 (빈 줄 기준 또는 자연스러운 구분)
                      let scenes = script.split(/\n\s*\n/).filter(s => s.trim().length > 0)
                      
                      if (scenes.length === 0) {
                        // 빈 줄이 없으면 전체를 하나의 씬으로 처리
                        scenes = [script]
                      }
                      
                      // 긴 씬을 여러 씬으로 분할 (각 씬이 1500자 이상이면 분할)
                      const MAX_SCENE_LENGTH = 1500
                      const splitScenes: string[] = []
                      
                      for (let idx = 0; idx < scenes.length; idx++) {
                        const scene = scenes[idx]
                        
                        if (scene.length <= MAX_SCENE_LENGTH) {
                          splitScenes.push(scene)
                        } else {
                          // 긴 씬을 문장 단위로 분할
                          const sentences = scene.split(/([.!?。！？]\s*)/).filter(s => s.trim().length > 0)
                          let currentChunk = ""
                          
                          for (let i = 0; i < sentences.length; i++) {
                            const sentence = sentences[i]
                            if (currentChunk.length + sentence.length <= MAX_SCENE_LENGTH) {
                              currentChunk += sentence
                            } else {
                              if (currentChunk.trim().length > 0) {
                                splitScenes.push(currentChunk.trim())
                              }
                              currentChunk = sentence
                            }
                          }
                          
                          if (currentChunk.trim().length > 0) {
                            splitScenes.push(currentChunk.trim())
                          }
                        }
                      }
                      
                      const totalScenes = splitScenes.length
                      console.log(`[장면 분해] 총 씬 개수 분석 완료: ${totalScenes}개 씬`)
                      
                      const startTime = Date.now()
                      
                      // 최대 1개를 선택했을 때는 AI 호출 없이 바로 형식만 변환
                      if (maxScenesPerScene === 1) {
                        console.log("[장면 분해] 최대 1개 선택됨 - AI 호출 없이 바로 형식 변환")
                        
                        // 진행률 초기화
                        setSceneDecompositionProgress({
                          current: 0,
                          total: totalScenes,
                          progress: 0,
                          elapsedTime: 0,
                          estimatedTime: 1
                        })
                        
                        // 씬별로 바로 형식 변환
                        const allResults: string[] = []
                        
                        for (let i = 0; i < splitScenes.length; i++) {
                          const sceneText = splitScenes[i]
                          const sceneNumber = i + 1
                          
                          // 진행률 업데이트
                          setSceneDecompositionProgress({
                            current: i + 1,
                            total: totalScenes,
                            progress: Math.floor(((i + 1) / totalScenes) * 100),
                            elapsedTime: Math.floor((Date.now() - startTime) / 1000),
                            estimatedTime: 1
                          })
                          
                          // 각 씬을 [장면 1] 형식으로 변환
                          const formattedResult = `씬 ${sceneNumber}\n\n[장면 1]\n\n${sceneText.trim()}`
                          allResults.push(formattedResult)
                          
                          // 실시간으로 결과 업데이트
                          const partialResult = allResults.join("\n\n")
                          setDecomposedScenes(partialResult)
                        }
                        
                        const finalResult = allResults.join("\n\n")
                        console.log(`[장면 분해] 형식 변환 완료, 최종 결과 길이: ${finalResult.length}자`)
                        
                        // 최종 결과 저장
                        setDecomposedScenes(finalResult)
                        
                        // 최종 결과 파싱
                        const scenes = parseSceneBlocks(finalResult)
                        
                        if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
                          throw new Error("장면 파싱에 실패했습니다.")
                        }
                        
                        setScriptLines(scenes)
                        setCompletedSteps((prev) => [...new Set([...prev, "script"])])
                        
                        // 완료 시 100% 표시
                        setSceneDecompositionProgress({
                          current: totalScenes,
                          total: totalScenes,
                          progress: 100,
                          elapsedTime: Math.floor((Date.now() - startTime) / 1000),
                          estimatedTime: 1
                        })
                        
                        // 1초 후 진행률 초기화
                        setTimeout(() => {
                          setSceneDecompositionProgress(null)
                        }, 1000)
                        
                        // alert(`대본이 ${scenes.length}개의 장면으로 분해되었습니다.`) // 완료 알림 제거
                        setIsDecomposingScenes(false)
                        return
                      }
                      
                      // 최대 2개 이상일 때는 기존 AI 호출 로직 사용
                      // 씬당 약 15-20초 소요 가정
                      const estimatedSeconds = Math.max(30, totalScenes * 18)
                      const estimatedTime = estimatedSeconds * 1000
                      
                      // 진행률 초기화
                      setSceneDecompositionProgress({
                        current: 0,
                        total: totalScenes,
                        progress: 0,
                        elapsedTime: 0,
                        estimatedTime: estimatedSeconds
                      })
                      
                      // 진행률 업데이트 인터벌
                      let currentProcessedScene = 0
                      const progressInterval = setInterval(() => {
                        const elapsedTime = Date.now() - startTime
                        const elapsedSeconds = Math.floor(elapsedTime / 1000)
                        // 씬당 예상 소요 시간으로 현재 씬 번호 추정
                        const estimatedTimePerScene = estimatedSeconds / totalScenes
                        const estimatedCurrentScene = Math.min(
                          totalScenes, 
                          Math.max(1, Math.floor(elapsedSeconds / estimatedTimePerScene) + 1)
                        )
                        
                        // 진행률 계산: 추정된 현재 씬 / 총 씬 개수 (최대 95%까지)
                        const progress = Math.min(95, Math.floor((estimatedCurrentScene / totalScenes) * 100))
                        
                        setSceneDecompositionProgress({
                          current: estimatedCurrentScene,
                          total: totalScenes,
                          progress,
                          elapsedTime: elapsedSeconds,
                          estimatedTime: estimatedSeconds
                        })
                      }, 500) // 0.5초마다 업데이트
                      
                      try {
                        console.log("[장면 분해 버튼] Gemini API 키 확인 중...")
                        const geminiApiKey = getGeminiApiKey()
                        if (!geminiApiKey) {
                          clearInterval(progressInterval)
                          setSceneDecompositionProgress(null)
                          console.error("[장면 분해 버튼] Gemini API 키 없음")
                          alert("Gemini API 키를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
                          setIsDecomposingScenes(false)
                          return
                        }
                        console.log("[장면 분해 버튼] API 키 확인 완료, 씬별 순차 처리 시작")
                        console.log(`[장면 분해 버튼] 총 ${totalScenes}개 씬 처리 예정`)
                        
                        // 씬별로 순차 처리하면서 결과를 실시간으로 업데이트
                        const allResults: string[] = []
                        
                        for (let i = 0; i < splitScenes.length; i++) {
                          const sceneText = splitScenes[i]
                          const sceneNumber = i + 1
                          
                          console.log(`[장면 분해] 씬 ${sceneNumber} 처리 시작 (${i + 1}/${totalScenes})`)
                          
                          // 진행률 업데이트
                          setSceneDecompositionProgress({
                            current: i,
                            total: totalScenes,
                            progress: Math.floor((i / totalScenes) * 100),
                            elapsedTime: Math.floor((Date.now() - startTime) / 1000),
                            estimatedTime: estimatedSeconds
                          })
                          
                          try {
                            // 단일 씬 처리 (API 키 및 최대 장면 개수 전달)
                            const sceneResult = await decomposeSingleScene(sceneText, sceneNumber, geminiApiKey, maxScenesPerScene)
                            
                            if (sceneResult && sceneResult.trim().length > 0) {
                              allResults.push(sceneResult)
                              console.log(`[장면 분해] 씬 ${sceneNumber} 처리 완료 (${allResults.length}/${totalScenes})`)
                              
                              // 실시간으로 결과 업데이트 (부분 결과)
                              const partialResult = allResults.join("\n\n")
                              setDecomposedScenes(partialResult)
                              
                              // 부분 결과를 파싱하여 scriptLines 업데이트
                              try {
                                const partialScenes = parseSceneBlocks(partialResult)
                                if (partialScenes && Array.isArray(partialScenes) && partialScenes.length > 0) {
                                  setScriptLines(partialScenes)
                                }
                              } catch (parseError) {
                                console.warn(`[장면 분해] 씬 ${sceneNumber} 부분 파싱 실패 (무시):`, parseError)
                              }
                            } else {
                              console.warn(`[장면 분해] 씬 ${sceneNumber} 결과가 비어있음, 기본 형식 사용`)
                              const defaultResult = `씬 ${sceneNumber}\n\n[장면 1]\n\n${sceneText.trim()}`
                              allResults.push(defaultResult)
                            }
                          } catch (sceneError) {
                            console.error(`[장면 분해] 씬 ${sceneNumber} 처리 실패:`, sceneError)
                            // 실패한 씬은 기본 형식으로 추가
                            const defaultResult = `씬 ${sceneNumber}\n\n[장면 1]\n\n${sceneText.trim()}`
                            allResults.push(defaultResult)
                            console.log(`[장면 분해] 씬 ${sceneNumber} 기본 형식으로 추가됨`)
                          }
                          
                          // 씬 처리 간 딜레이 (API 제한 방지)
                          if (i < splitScenes.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 2000)) // 2초 대기
                          }
                        }
                        
                        // 최종 결과 검증
                        if (allResults.length === 0) {
                          throw new Error("장면 분해 결과가 비어있습니다. 다시 시도해주세요.")
                        }
                        
                        const finalResult = allResults.join("\n\n")
                        console.log(`[장면 분해 버튼] 모든 씬 처리 완료, 최종 결과 길이: ${finalResult.length}자`)
                        
                        // 최종 결과 저장
                        setDecomposedScenes(finalResult)
                        
                        // 최종 결과 파싱
                        console.log("[장면 분해 버튼] parseSceneBlocks 호출 중...")
                        const scenes = parseSceneBlocks(finalResult)
                        
                        // scenes 검증
                        if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
                          throw new Error("장면 파싱에 실패했습니다. 결과를 확인할 수 없습니다.")
                        }
                        
                        console.log(`[장면 분해 버튼] parseSceneBlocks 완료: ${scenes.length}개 장면`)
                        setScriptLines(scenes)
                        
                        // 대본 생성 단계 완료 표시
                        setCompletedSteps((prev) => [...new Set([...prev, "script"])])
                        
                        // 완료 시 100% 표시
                        clearInterval(progressInterval)
                        const finalElapsedTime = Math.floor((Date.now() - startTime) / 1000)
                        setSceneDecompositionProgress({
                          current: totalScenes,
                          total: totalScenes,
                          progress: 100,
                          elapsedTime: finalElapsedTime,
                          estimatedTime: estimatedSeconds
                        })
                        
                        // 1초 후 진행률 초기화
                        setTimeout(() => {
                          setSceneDecompositionProgress(null)
                        }, 1000)
                        
                        // alert(`대본이 ${scenes.length}개의 장면으로 분해되었습니다.`) // 완료 알림 제거
                      } catch (error) {
                        clearInterval(progressInterval)
                        setSceneDecompositionProgress(null)
                        console.error("[장면 분해 버튼] 에러 발생:", error)
                        console.error("[장면 분해 버튼] 에러 상세:", {
                          name: error instanceof Error ? error.name : "Unknown",
                          message: error instanceof Error ? error.message : String(error),
                          stack: error instanceof Error ? error.stack : undefined,
                        })
                        const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
                        alert(`장면 분해에 실패했습니다: ${errorMessage}`)
                      } finally {
                        console.log("[장면 분해 버튼] finally 블록 실행")
                        setIsDecomposingScenes(false)
                      }
                    }}
                    disabled={isDecomposingScenes || !script.trim()}
                  >
                    {isDecomposingScenes ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        장면 분해 중...
                      </>
                    ) : (
                      <>
                        <Scissors className="w-4 h-4 mr-2" />
                        장면 분해
                      </>
                    )}
                  </Button>
                  
                  {/* 장면 분해 진행률 다이얼로그 */}
                  <Dialog open={isDecomposingScenes} onOpenChange={() => {}}>
                    <DialogContent className="sm:max-w-md" showCloseButton={false}>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Scissors className="w-5 h-5 animate-pulse text-blue-500" />
                          장면 분해 중...
                        </DialogTitle>
                        <DialogDescription>
                          대본을 장면 단위로 분해하고 있습니다. 잠시만 기다려주세요.
                        </DialogDescription>
                      </DialogHeader>
                      
                      {sceneDecompositionProgress && (
                        <div className="space-y-4 py-4">
                          {/* 씬 진행률 */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium">씬 처리 중</span>
                              <span className="text-blue-600 font-semibold">
                                {sceneDecompositionProgress.current} / {sceneDecompositionProgress.total} 씬
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
                                style={{ width: `${sceneDecompositionProgress.progress}%` }}
                              >
                                {sceneDecompositionProgress.progress > 10 && (
                                  <span className="text-xs text-white font-medium">{sceneDecompositionProgress.progress}%</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* 시간 정보 */}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                              <p className="text-muted-foreground">경과 시간</p>
                              <p className="font-semibold">
                                {Math.floor(sceneDecompositionProgress.elapsedTime / 60)}분 {sceneDecompositionProgress.elapsedTime % 60}초
                              </p>
                            </div>
                            {sceneDecompositionProgress.progress < 95 && (
                              <div className="space-y-1">
                                <p className="text-muted-foreground">예상 시간</p>
                                <p className="font-semibold">
                                  {Math.floor(sceneDecompositionProgress.estimatedTime / 60)}분 {sceneDecompositionProgress.estimatedTime % 60}초
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {/* 남은 시간 (예상) */}
                          {sceneDecompositionProgress.progress < 95 && sceneDecompositionProgress.estimatedTime > sceneDecompositionProgress.elapsedTime && (
                            <div className="text-center text-sm text-muted-foreground">
                              예상 남은 시간: 약 {Math.floor((sceneDecompositionProgress.estimatedTime - sceneDecompositionProgress.elapsedTime) / 60)}분 {(sceneDecompositionProgress.estimatedTime - sceneDecompositionProgress.elapsedTime) % 60}초
                            </div>
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </Card>
            )}

            {decomposedScenes && (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white mb-6">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-slate-900">장면 분해 결과</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        copyToClipboard(decomposedScenes)
                        alert("장면 분해 결과가 복사되었습니다.")
                      }}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      복사
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    <div className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                      {decomposedScenes}
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-gray-500">
                    총 {scriptLines.length}개의 장면이 생성되었습니다.
                  </div>
                </CardContent>
              </Card>
            )}

            {isGenerating && activeStep === "script" && !isDecomposingScenes && <AIGeneratingAnimation type="완전한 대본" />}
            {isDecomposingScenes && activeStep === "script" && <AIGeneratingAnimation type="장면을 분해하고" />}
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

            {/* 이미지 스타일 선택 및 생성 - 좌우 배치 */}
            <div className="flex flex-col lg:flex-row items-start gap-6 mb-6">
            {/* 이미지 스타일 선택 */}
              {!customStylePrompt && (
              <div className={`flex-1 relative ${(customStyleCharacterImage !== null || customStyleBackgroundImage !== null) ? 'opacity-50' : ''}`}>
                <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
              <CardHeader className="pb-4 border-b border-gray-100">
                <CardTitle className="text-lg font-semibold text-slate-900">이미지 스타일 선택</CardTitle>
              </CardHeader>
              <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={imageStyle === "stickman-animation" ? "default" : "outline"}
                    onClick={() => setImageStyle("stickman-animation")}
                        onMouseEnter={() => setHoveredStyle("stickman-animation")}
                        onMouseLeave={() => setHoveredStyle(null)}
                    className="flex-1"
                    disabled={customStyleCharacterImage !== null || customStyleBackgroundImage !== null}
                  >
                    스틱맨 애니메이션
                  </Button>
                  <Button
                        variant={imageStyle === "realistic" ? "default" : "outline"}
                        onClick={() => {
                          setImageStyle("realistic")
                          if (!realisticCharacterType) {
                            setRealisticCharacterType("korean") // 기본값: 한국인
                          }
                        }}
                        onMouseEnter={() => setHoveredStyle("realistic")}
                        onMouseLeave={() => setHoveredStyle(null)}
                    className="flex-1"
                    disabled={customStyleCharacterImage !== null || customStyleBackgroundImage !== null}
                  >
                        실사화
                  </Button>
                  <Button
                        variant={imageStyle === "realistic2" ? "default" : "outline"}
                        onClick={() => {
                          setImageStyle("realistic2")
                          if (!realisticCharacterType) {
                            setRealisticCharacterType("korean") // 기본값: 한국인
                          }
                        }}
                        onMouseEnter={() => setHoveredStyle("realistic2")}
                        onMouseLeave={() => setHoveredStyle(null)}
                    className="flex-1"
                    disabled={customStyleCharacterImage !== null || customStyleBackgroundImage !== null}
                  >
                        실사화2
                  </Button>
                  <Button
                        variant={imageStyle === "animation2" ? "default" : "outline"}
                        onClick={() => setImageStyle("animation2")}
                        onMouseEnter={() => setHoveredStyle("animation2")}
                        onMouseLeave={() => setHoveredStyle(null)}
                    className="flex-1"
                    disabled={customStyleCharacterImage !== null || customStyleBackgroundImage !== null}
                  >
                        애니메이션2
                  </Button>
                  <Button
                        variant={imageStyle === "animation3" ? "default" : "outline"}
                        onClick={() => setImageStyle("animation3")}
                        onMouseEnter={() => setHoveredStyle("animation3")}
                        onMouseLeave={() => setHoveredStyle(null)}
                    className="flex-1"
                    disabled={customStyleCharacterImage !== null || customStyleBackgroundImage !== null}
                  >
                        유럽풍 그래픽 노블
                  </Button>
                    </div>
                    {/* 실사화/실사화2 선택 시 인물 타입 선택 */}
                    {(imageStyle === "realistic" || imageStyle === "realistic2") && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">인물 타입 선택</p>
                        <div className="flex gap-2">
                          <Button
                            variant={realisticCharacterType === "korean" ? "default" : "outline"}
                            onClick={() => setRealisticCharacterType("korean")}
                            className="flex-1"
                            size="sm"
                          >
                            한국인
                          </Button>
                          <Button
                            variant={realisticCharacterType === "foreign" ? "default" : "outline"}
                            onClick={() => setRealisticCharacterType("foreign")}
                            className="flex-1"
                            size="sm"
                          >
                            외국인
                          </Button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-3">
                      선택한 스타일이 모든 이미지에 일관되게 적용됩니다.
                    </p>
                  </CardContent>
                </Card>
                
                {/* 호버 시 샘플 이미지 팝업 - 카드 좌측에 표시 */}
                {hoveredStyle && (
                  <div 
                    className="absolute z-[100] right-full mr-4 top-0 w-96 bg-white border-2 border-gray-300 rounded-lg shadow-2xl overflow-hidden"
                    style={{ pointerEvents: 'none' }}
                  >
                    <div className="p-2 bg-gray-50 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-700 text-center">
                        {hoveredStyle === "stickman-animation" ? "스틱맨 애니메이션" :
                         hoveredStyle === "realistic" ? "실사화" :
                         hoveredStyle === "realistic2" ? "실사화2" :
                         hoveredStyle === "animation2" ? "애니메이션2" :
                         hoveredStyle === "animation3" ? "유럽풍 그래픽 노블" : ""} 샘플
                      </p>
                    </div>
                    {styleSampleImages[hoveredStyle] ? (
                      <img
                        src={styleSampleImages[hoveredStyle]}
                        alt={`${hoveredStyle} 샘플`}
                        className="w-full h-auto"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          // ImgBB 직접 이미지 URL이 실패할 경우 다른 확장자 시도
                          const target = e.target as HTMLImageElement
                          const styleName = hoveredStyle
                          if (!styleName || !styleSampleImages[styleName]) return
                          
                          const baseUrl = styleSampleImages[styleName]
                          const extensions = ['png', 'jpeg', 'webp']
                          const triedExtensions = target.dataset.triedExtensions?.split(',') || []
                          const currentExt = baseUrl.split('.').pop()?.split('?')[0] || 'jpg'
                          
                          if (!triedExtensions.includes(currentExt)) {
                            triedExtensions.push(currentExt)
                          }
                          target.dataset.triedExtensions = triedExtensions.join(',')
                          
                          // 다른 확장자 시도
                          const nextExt = extensions.find(ext => !triedExtensions.includes(ext))
                          if (nextExt) {
                            target.src = baseUrl.replace(/\.(jpg|jpeg|png|webp)$/i, `.${nextExt}`)
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-64 bg-gray-100 flex items-center justify-center">
                        <p className="text-sm text-gray-400">샘플 이미지를 불러올 수 없습니다</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* OR 구분선 */}
              {!customStylePrompt && (
              <div className="flex items-center justify-center w-full lg:w-auto my-4 lg:my-0">
                <div className="flex items-center gap-2 w-full lg:w-auto">
                  <div className="flex-1 lg:flex-none h-px bg-gray-300"></div>
                  <span className="text-sm font-medium text-gray-500 px-2">OR</span>
                  <div className="flex-1 lg:flex-none h-px bg-gray-300"></div>
                </div>
              </div>
              )}

              {/* 이미지 스타일 생성 */}
            <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white flex-1">
              <CardHeader className="pb-4 border-b border-gray-100">
                <CardTitle className="text-lg font-semibold text-slate-900">이미지 스타일 생성</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <p className="text-sm text-gray-600">
                  원하는 캐릭터 사진과 그림체를 업로드하여 커스텀 스타일을 생성할 수 있습니다.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 캐릭터 사진 업로드 */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">캐릭터 사진</Label>
                    <div 
                      className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer relative"
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.classList.add("border-blue-500", "bg-blue-50")
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.classList.remove("border-blue-500", "bg-blue-50")
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.classList.remove("border-blue-500", "bg-blue-50")
                        const file = e.dataTransfer.files?.[0]
                        if (file && file.type.startsWith("image/")) {
                          const url = URL.createObjectURL(file)
                          setCustomStyleCharacterImage(url)
                        } else {
                          alert("이미지 파일만 업로드 가능합니다.")
                        }
                      }}
                      onClick={() => {
                        if (!customStyleCharacterImage) {
                          document.getElementById("character-image-upload")?.click()
                        }
                      }}
                    >
                      {customStyleCharacterImage ? (
                        <div className="space-y-2">
                          <img 
                            src={customStyleCharacterImage} 
                            alt="캐릭터 사진" 
                            className="w-full h-48 object-cover rounded-lg"
                          />
                  <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (customStyleCharacterImage.startsWith("blob:")) {
                                URL.revokeObjectURL(customStyleCharacterImage)
                              }
                              setCustomStyleCharacterImage(null)
                            }}
                            className="w-full"
                          >
                            제거
                  </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-8 h-8 mx-auto text-gray-400" />
                          <p className="text-sm text-gray-600">
                            클릭하거나 드래그하여 업로드
                          </p>
                          <p className="text-xs text-gray-400">
                            JPG, PNG, WEBP 지원
                          </p>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                if (!file.type.startsWith("image/")) {
                                  alert("이미지 파일만 업로드 가능합니다.")
                                  return
                                }
                                const url = URL.createObjectURL(file)
                                setCustomStyleCharacterImage(url)
                              }
                            }}
                            className="hidden"
                            id="character-image-upload"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 그림체 업로드 */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">그림체</Label>
                    <div 
                      className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer relative"
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.classList.add("border-blue-500", "bg-blue-50")
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.classList.remove("border-blue-500", "bg-blue-50")
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.classList.remove("border-blue-500", "bg-blue-50")
                        const file = e.dataTransfer.files?.[0]
                        if (file && file.type.startsWith("image/")) {
                          const url = URL.createObjectURL(file)
                          setCustomStyleBackgroundImage(url)
                        } else {
                          alert("이미지 파일만 업로드 가능합니다.")
                        }
                      }}
                      onClick={() => {
                        if (!customStyleBackgroundImage) {
                          document.getElementById("background-image-upload")?.click()
                        }
                      }}
                    >
                      {customStyleBackgroundImage ? (
                        <div className="space-y-2">
                          <img 
                            src={customStyleBackgroundImage} 
                            alt="그림체" 
                            className="w-full h-48 object-cover rounded-lg"
                          />
                  <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (customStyleBackgroundImage.startsWith("blob:")) {
                                URL.revokeObjectURL(customStyleBackgroundImage)
                              }
                              setCustomStyleBackgroundImage(null)
                            }}
                            className="w-full"
                          >
                            제거
                  </Button>
                </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-8 h-8 mx-auto text-gray-400" />
                          <p className="text-sm text-gray-600">
                            클릭하거나 드래그하여 업로드
                          </p>
                          <p className="text-xs text-gray-400">
                            JPG, PNG, WEBP 지원
                          </p>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                if (!file.type.startsWith("image/")) {
                                  alert("이미지 파일만 업로드 가능합니다.")
                                  return
                                }
                                const url = URL.createObjectURL(file)
                                setCustomStyleBackgroundImage(url)
                              }
                            }}
                            className="hidden"
                            id="background-image-upload"
                          />
                        </div>
                      )}
                    </div>
                    {/* 그림체 텍스트 입력 (이미지가 없을 때만 표시) */}
                    {!customStyleBackgroundImage && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-600">또는 그림체 프롬프트 직접 입력</Label>
                        <Textarea
                          value={customStyleBackgroundText}
                          onChange={(e) => setCustomStyleBackgroundText(e.target.value)}
                          placeholder="이미 가지고 있는 그림체 스타일 프롬프트를 입력하세요..."
                          className="min-h-[192px] resize-none border-2 border-dashed border-gray-300 rounded-lg p-4 text-sm overflow-y-auto"
                          style={{ height: "192px" }} // 그림체 이미지 업로드 영역과 동일한 높이 (h-48 = 192px)
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 스타일 생성 버튼 */}
                <Button
                  onClick={async () => {
                    if (!customStyleCharacterImage && !customStyleBackgroundImage && !customStyleBackgroundText.trim()) {
                      alert("캐릭터 사진, 그림체 이미지, 또는 그림체 텍스트 중 최소 하나 이상 입력해주세요.")
                      return
                    }

                    setIsGeneratingCustomStyle(true)
                    try {
                      const geminiApiKey = typeof window !== "undefined" ? localStorage.getItem("gemini_api_key") || undefined : undefined
                      
                      if (!geminiApiKey) {
                        alert("Gemini API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
                        setIsGeneratingCustomStyle(false)
                        return
                      }

                      console.log("[Custom Style] 스타일 생성 시작")
                      
                      // 이미지를 base64로 변환하는 함수
                      const imageToBase64 = async (imageUrl: string): Promise<string> => {
                        if (imageUrl.startsWith("data:")) {
                          return imageUrl
                        }
                        const response = await fetch(imageUrl)
                        const blob = await response.blob()
                        return new Promise((resolve, reject) => {
                          const reader = new FileReader()
                          reader.onloadend = () => resolve(reader.result as string)
                          reader.onerror = reject
                          reader.readAsDataURL(blob)
                        })
                      }

                      // 각 이미지를 분석하여 프롬프트 생성
                      const prompts: string[] = []
                      const errors: string[] = []
                      
                      if (customStyleCharacterImage) {
                        try {
                          const base64Image = await imageToBase64(customStyleCharacterImage)
                          const characterPrompt = await analyzeImageForStyle(base64Image, "character", geminiApiKey)
                          if (characterPrompt && !characterPrompt.toLowerCase().includes("i'm sorry") && !characterPrompt.toLowerCase().includes("can't help")) {
                            prompts.push(characterPrompt)
                          } else {
                            errors.push("캐릭터 이미지 분석 실패: 실제 사람이 포함된 이미지는 분석할 수 없습니다.")
                          }
                        } catch (error) {
                          console.error("[Custom Style] 캐릭터 이미지 분석 실패:", error)
                          errors.push(`캐릭터 이미지 분석 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
                        }
                      }
                      
                      if (customStyleBackgroundImage) {
                        try {
                          const base64Image = await imageToBase64(customStyleBackgroundImage)
                          // 그림체 스타일만 추출 (art-style 타입 사용)
                          const artStylePrompt = await analyzeImageForStyle(base64Image, "art-style", geminiApiKey)
                          if (artStylePrompt && !artStylePrompt.toLowerCase().includes("i'm sorry") && !artStylePrompt.toLowerCase().includes("can't help")) {
                            prompts.push(artStylePrompt)
                            console.log("[Custom Style] 그림체 스타일 추출 완료:", artStylePrompt)
                          } else {
                            errors.push("그림체 이미지 분석 실패: 이미지를 분석할 수 없습니다.")
                          }
                        } catch (error) {
                          console.error("[Custom Style] 그림체 이미지 분석 실패:", error)
                          errors.push(`그림체 이미지 분석 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
                        }
                      } else if (customStyleBackgroundText.trim()) {
                        // 그림체 이미지가 없고 텍스트가 입력된 경우, 텍스트를 직접 프롬프트로 사용
                        prompts.push(customStyleBackgroundText.trim())
                        console.log("[Custom Style] 그림체 텍스트 사용:", customStyleBackgroundText.trim())
                      }
                      
                      // 프롬프트가 하나라도 생성되었는지 확인
                      if (prompts.length === 0) {
                        throw new Error(`모든 이미지 분석에 실패했습니다.\n${errors.join("\n")}`)
                      }
                      
                      // 프롬프트 결합
                      const combinedPrompt = prompts.join(", ")
                      setCustomStylePrompt(combinedPrompt)
                      setImageStyle("custom-style")
                      
                      // 경고 메시지 표시 (일부 실패한 경우)
                      if (errors.length > 0) {
                        alert(`일부 이미지 분석에 실패했지만, 성공한 이미지의 프롬프트를 생성했습니다.\n\n${errors.join("\n")}`)
                      }
                      
                      console.log("[Custom Style] 생성된 프롬프트:", combinedPrompt)
                    } catch (error) {
                      console.error("[Custom Style] 스타일 생성 실패:", error)
                      alert(`스타일 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
                    } finally {
                      setIsGeneratingCustomStyle(false)
                    }
                  }}
                  disabled={(!customStyleCharacterImage && !customStyleBackgroundImage && !customStyleBackgroundText.trim()) || isGeneratingCustomStyle}
                  className="w-full"
                  size="lg"
                >
                  {isGeneratingCustomStyle ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      스타일 생성 중...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      커스텀 스타일 생성
                    </>
                  )}
                </Button>

              </CardContent>
              </Card>
              
              {/* 생성된 커스텀 스타일 프롬프트 표시 - 오른쪽에 배치 */}
              {customStylePrompt && (
                <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white flex-1">
                  <CardHeader className="pb-4 border-b border-gray-100">
                    <CardTitle className="text-lg font-semibold text-slate-900">생성된 커스텀 스타일</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">영어 프롬프트</Label>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <p className="text-sm font-mono text-gray-800 whitespace-pre-wrap break-words">
                            {customStylePrompt}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(customStylePrompt)
                            alert("프롬프트가 복사되었습니다.")
                          }}
                    className="flex-1"
                  >
                          <Copy className="w-4 h-4 mr-2" />
                          프롬프트 복사
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCustomStylePrompt(null)
                            setCustomStyleCharacterImage(null)
                            setCustomStyleBackgroundImage(null)
                            setImageStyle("stickman-animation") // 기본값으로 리셋
                          }}
                        >
                          제거
                  </Button>
                </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-800">
                          💡 이 커스텀 스타일 프롬프트가 이미지 생성 시 자동으로 적용됩니다.
                </p>
                      </div>
                    </div>
              </CardContent>
            </Card>
              )}
            </div>

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
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                <Button
                      onClick={async () => {
                        if (!decomposedScenes || decomposedScenes.trim().length === 0) {
                          alert("먼저 장면 분해를 완료해주세요.")
                          return
                        }
                        const openaiApiKey = getApiKey("openai_api_key")
                        if (!openaiApiKey) {
                          alert("OpenAI API 키를 설정해주세요.")
                          return
                        }
                        setIsGeneratingScenePrompts(true)
                        
                        // 이미지 프롬프트 재생성 시 기존 이미지 데이터는 유지 (영상은 유지됨)
                        // setGeneratedImages([]) 제거 - 기존 영상 유지
                        
                        // 총 씬 개수 먼저 계산
                        const sceneBlocks = decomposedScenes.split(/(?=씬\s+\d+)/).filter(block => block.trim().length > 0)
                        const totalScenes = sceneBlocks.length
                        console.log(`[이미지 프롬프트 생성] 총 씬 개수: ${totalScenes}개`)
                        
                        // 진행률 초기화
                        setScenePromptProgress({
                          current: 0,
                          total: totalScenes
                        })
                        
                        // 진행률 업데이트 인터벌 (씬당 약 5-8초 소요 가정)
                        const startTime = Date.now()
                        const estimatedTimePerScene = 6 // 씬당 약 6초
                        const progressInterval = setInterval(() => {
                          const elapsedTime = Date.now() - startTime
                          const elapsedSeconds = Math.floor(elapsedTime / 1000)
                          // 씬당 예상 소요 시간으로 현재 씬 번호 추정
                          const estimatedCurrentScene = Math.min(
                            totalScenes, 
                            Math.max(1, Math.floor(elapsedSeconds / estimatedTimePerScene) + 1)
                          )
                          
                          setScenePromptProgress({
                            current: estimatedCurrentScene,
                            total: totalScenes
                          })
                        }, 500) // 0.5초마다 업데이트
                        
                        try {
                          console.log("[이미지 프롬프트 생성] decomposedScenes 확인:", decomposedScenes.substring(0, 500))
                          console.log("[이미지 프롬프트 생성] customStylePrompt:", customStylePrompt)
                          
                          // 시대적 배경 추출 (한 번만)
                          const historicalContext = await extractHistoricalContext(selectedTopic || undefined, script || undefined, openaiApiKey).catch(() => null)
                          
                          // 씬별로 순차 처리
                          const allResults: Array<{ sceneNumber: number; images: Array<{ imageNumber: number; prompt: string; sceneText: string; visualInstruction?: string; imageUrl?: string }> }> = []
                          let stickmanCharacterDescription: string | null = null
                          
                          for (let i = 0; i < sceneBlocks.length; i++) {
                            const sceneBlock = sceneBlocks[i]
                            const sceneNumMatch = sceneBlock.match(/씬\s+(\d+)/)
                            if (!sceneNumMatch) continue
                            
                            const sceneNum = parseInt(sceneNumMatch[1])
                            console.log(`[이미지 프롬프트 생성] 씬 ${sceneNum} 처리 시작 (${i + 1}/${totalScenes})`)
                            
                            // 진행률 업데이트
                            setScenePromptProgress({
                              current: i,
                              total: totalScenes
                            })
                            
                            try {
                              const sceneImages = await generateSingleSceneImagePrompts(
                                sceneBlock,
                                sceneNum,
                                imageStyle,
                                customStylePrompt || undefined,
                                historicalContext || undefined,
                                stickmanCharacterDescription || undefined,
                                openaiApiKey,
                                realisticCharacterType || undefined
                              )
                              
                              // 스틱맨 애니메이션의 경우 첫 번째 씬에서 캐릭터 설명 추출
                              if (imageStyle === "stickman-animation" && sceneNum === 1 && sceneImages.length > 0) {
                                const firstPrompt = sceneImages[0]?.prompt || ""
                                const characterMatch = firstPrompt.match(/(?:the same stickman character|the main stickman character|the protagonist stickman)\s*\(([^)]+)\)/i)
                                if (characterMatch) {
                                  stickmanCharacterDescription = characterMatch[1]
                                } else {
                                  const firstSceneText = sceneImages[0]?.sceneText || ""
                                  const roleMatch = firstSceneText.match(/(?:탐정|의사|선생님|학생|경찰|요리사|운동선수|가수|배우|기자|변호사|간호사|엔지니어|프로그래머|디자이너|예술가|작가|음악가)/)
                                  stickmanCharacterDescription = roleMatch ? roleMatch[0] : "the main protagonist"
                                }
                                console.log(`[이미지 프롬프트 생성] 씬 1 스틱맨 캐릭터 설명 저장: ${stickmanCharacterDescription}`)
                              }
                              
                              allResults.push({
                                sceneNumber: sceneNum,
                                images: sceneImages,
                              })
                              
                              console.log(`[이미지 프롬프트 생성] 씬 ${sceneNum} 처리 완료 (${allResults.length}/${totalScenes})`)
                              
                              // 실시간으로 결과 업데이트
                              setSceneImagePrompts([...allResults])
                              
                            } catch (sceneError) {
                              console.error(`[이미지 프롬프트 생성] 씬 ${sceneNum} 처리 실패:`, sceneError)
                              // 실패한 씬은 빈 결과로 추가
                              allResults.push({
                                sceneNumber: sceneNum,
                                images: [],
                              })
                            }
                            
                            // 씬 처리 간 딜레이 (API 제한 방지)
                            if (i < sceneBlocks.length - 1) {
                              await new Promise(resolve => setTimeout(resolve, 2000)) // 2초 대기
                            }
                          }
                          
                          // 최종 결과 검증
                          if (allResults.length === 0) {
                            throw new Error("프롬프트 생성 결과가 올바르지 않습니다.")
                          }
                          
                          console.log("[이미지 프롬프트 생성] 모든 씬 처리 완료, 최종 결과:", allResults.length)
                          setSceneImagePrompts(allResults)
                          
                          // 완료 시 진행률 업데이트
                          clearInterval(progressInterval)
                          setScenePromptProgress({
                            current: totalScenes,
                            total: totalScenes
                          })
                          
                          // 1초 후 진행률 초기화
                          setTimeout(() => {
                            setScenePromptProgress(null)
                          }, 1000)
                        } catch (error) {
                          clearInterval(progressInterval)
                          setScenePromptProgress(null)
                          console.error("이미지 프롬프트 생성 실패:", error)
                          const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
                          alert(`이미지 프롬프트 생성에 실패했습니다: ${errorMessage}`)
                        } finally {
                          setIsGeneratingScenePrompts(false)
                        }
                      }}
                      disabled={isGeneratingScenePrompts || isGeneratingSceneImages || !decomposedScenes || decomposedScenes.trim().length === 0}
                      className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold"
                      size="lg"
                    >
                      {isGeneratingScenePrompts ? (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                          1. 이미지 프롬프트 생성 중...
                          {scenePromptProgress && (
                            <span className="ml-2 text-sm opacity-90">
                              ({scenePromptProgress.current}/{scenePromptProgress.total} 씬)
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 mr-2" />
                          1. 이미지 프롬프트 생성
                        </>
                      )}
                </Button>
                <Button
                      onClick={async () => {
                        if (sceneImagePrompts.length === 0) {
                          alert("먼저 이미지 프롬프트를 생성해주세요.")
                          return
                        }
                        const replicateApiKey = getApiKey("replicate_api_key")
                        if (!replicateApiKey) {
                          alert("Replicate API 키를 설정해주세요.")
                          return
                        }
                        
                        setIsGeneratingSceneImages(true)
                        
                        // 이미지 생성 시작 시 기존 이미지와 영상 데이터 초기화
                        setGeneratedImages([])
                        // 변환된 영상 데이터 초기화 (영상 제거)
                        setConvertedSceneVideos(new Map())
                        setConvertedVideos(new Map())
                        // sceneImagePrompts의 imageUrl 제거 (기존 이미지 제거) - 단, 이미 생성된 이미지는 유지
                        setSceneImagePrompts((prev) => {
                          return prev.map((scene) => ({
                            ...scene,
                            images: scene.images.map((img) => {
                              // 이미 생성된 이미지는 유지 (개별 생성 버튼으로 생성한 이미지 보존)
                              if (img.imageUrl) {
                                return img
                              }
                              return { ...img, imageUrl: undefined }
                            })
                          }))
                        })
                        
                        const totalImages = sceneImagePrompts.reduce((sum, scene) => sum + scene.images.length, 0)
                        setSceneImageGenerationProgress({ current: 0, total: totalImages })
                        
                        try {
                          let currentIndex = 0
                          const updatedPrompts = [...sceneImagePrompts]
                          let hasGeneratedImages = false
                          shouldStopImageGeneration.current = false // 중단 플래그 초기화
                          
                          // 재시도 함수 (최대 5번 시도)
                          const generateImageWithRetry = async (
                            prompt: string,
                            replicateApiKey: string,
                            imageStyle: string | undefined,
                            sceneText: string | undefined
                          ): Promise<string | null> => {
                            const maxRetries = 5
                            let attempt = 1
                            
                            while (attempt <= maxRetries) {
                              // 중단 체크
                              if (shouldStopImageGeneration.current) {
                                throw new Error("이미지 생성이 중단되었습니다.")
                              }
                              
                              try {
                                console.log(`[Scene Image] 이미지 생성 시도 ${attempt}/${maxRetries}...`)
                                const imageUrl = await generateImageWithReplicate(
                                  prompt,
                                  replicateApiKey,
                                  "16:9",
                                  imageStyle,
                                  sceneText
                                )
                                console.log(`[Scene Image] 이미지 생성 성공 (시도 ${attempt})`)
                                return imageUrl
                              } catch (error) {
                                // 중단된 경우 재시도하지 않음
                                if (shouldStopImageGeneration.current) {
                                  throw error
                                }
                                console.error(`[Scene Image] 재시도 ${attempt}/${maxRetries} 실패:`, error)
                                
                                // 마지막 시도가 아니면 재시도
                                if (attempt < maxRetries) {
                                  attempt++
                                  // 재시도 전 대기 (지수 백오프, 최대 10초)
                                  const delay = Math.min(1000 * attempt, 10000)
                                  console.log(`[Scene Image] ${delay}ms 후 재시도...`)
                                  await new Promise(resolve => setTimeout(resolve, delay))
                                } else {
                                  // 최대 재시도 횟수 도달
                                  console.warn(`[Scene Image] 최대 재시도 횟수(${maxRetries}) 도달, 다음 이미지로 넘어갑니다.`)
                                  return null
                                }
                              }
                            }
                            
                            return null
                          }
                          
                          for (const scene of updatedPrompts) {
                            // 중단 체크
                            if (shouldStopImageGeneration.current) {
                              console.log("[Scene Image] 이미지 생성 중단됨")
                              alert(`이미지 생성을 중단했습니다. (${currentIndex}/${totalImages}개 처리 완료)`)
                              break
                            }
                            
                            for (const image of scene.images) {
                              // 중단 체크
                              if (shouldStopImageGeneration.current) {
                                console.log("[Scene Image] 이미지 생성 중단됨")
                                alert(`이미지 생성을 중단했습니다. (${currentIndex}/${totalImages}개 처리 완료)`)
                                break
                              }
                              // 이미 생성된 이미지는 건너뛰기
                              if (image.imageUrl) {
                                currentIndex++
                                setSceneImageGenerationProgress({ current: currentIndex, total: totalImages })
                                console.log(`[Scene Image] 이미지 건너뛰기 (이미 생성됨): Scene ${scene.sceneNumber}, Image ${image.imageNumber}`)
                                continue
                              }
                              
                              currentIndex++
                              setSceneImageGenerationProgress({ current: currentIndex, total: totalImages })
                              
                              try {
                                console.log(`[Scene Image] 이미지 생성 중... (${currentIndex}/${totalImages}): Scene ${scene.sceneNumber}, Image ${image.imageNumber}`)
                                
                                // 재시도 로직이 포함된 이미지 생성 (생성될 때까지 계속 시도)
                                let imageUrl = await generateImageWithRetry(
                                  image.prompt,
                                  replicateApiKey,
                                  imageStyle,
                                  image.sceneText
                                )
                                
                                if (imageUrl) {
                                  console.log(`[Scene Image] 이미지 생성 완료:`, imageUrl)
                                  
                                  // 해당 이미지에 imageUrl 추가
                                  const sceneIndex = updatedPrompts.findIndex(s => s.sceneNumber === scene.sceneNumber)
                                  if (sceneIndex !== -1) {
                                    const imageIndex = updatedPrompts[sceneIndex].images.findIndex(img => img.imageNumber === image.imageNumber)
                                    if (imageIndex !== -1) {
                                      updatedPrompts[sceneIndex].images[imageIndex].imageUrl = imageUrl
                                      setSceneImagePrompts([...updatedPrompts])
                                      hasGeneratedImages = true
                                    }
                                  }
                                } else {
                                  console.warn(`[Scene Image] 이미지 생성 실패 (Scene ${scene.sceneNumber}, Image ${image.imageNumber}): 이미지 URL을 받지 못함`)
                                }
                              } catch (error) {
                                console.error(`[Scene Image] 이미지 생성 실패 (Scene ${scene.sceneNumber}, Image ${image.imageNumber}):`, error)
                                // 실패해도 계속 진행
                              }
                              
                              // API 제한 방지를 위한 딜레이 (5초 간격)
                              if (currentIndex < totalImages) {
                                await new Promise(resolve => setTimeout(resolve, 5000))
                              }
                            }
                          }
                          
                          // 이미지 생성 완료 상태 업데이트
                          if (hasGeneratedImages) {
                            console.log("[Scene Image] 이미지 생성 완료 - 사이드바 완료 표시 업데이트")
                            setCompletedSteps((prev) => {
                              if (!prev.includes("image")) {
                                console.log("[Scene Image] 'image' 단계를 완료 목록에 추가")
                                return [...prev, "image"]
                              }
                              return prev
                            })
                          }
                        } catch (error) {
                          console.error("장면 이미지 생성 실패:", error)
                          alert(`이미지 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
                        } finally {
                          setIsGeneratingSceneImages(false)
                          setSceneImageGenerationProgress({ current: 0, total: 0 })
                          shouldStopImageGeneration.current = false // 중단 플래그 초기화
                          
                          // 최종적으로 sceneImagePrompts 상태를 확인하여 완료 표시
                          setTimeout(() => {
                            setSceneImagePrompts((currentPrompts) => {
                              const hasAnyImage = currentPrompts.some(scene => 
                                scene.images.some(img => img.imageUrl)
                              )
                              if (hasAnyImage) {
                                console.log("[Scene Image] 최종 확인 - 이미지가 있으므로 완료 표시")
                                setCompletedSteps((prev) => {
                                  if (!prev.includes("image")) {
                                    return [...prev, "image"]
                                  }
                                  return prev
                                })
                              }
                              return currentPrompts
                            })
                          }, 500)
                          
                          // 최종적으로 sceneImagePrompts 상태를 확인하여 완료 표시
                          setTimeout(() => {
                            const hasAnyImage = sceneImagePrompts.some(scene => 
                              scene.images.some(img => img.imageUrl)
                            )
                            if (hasAnyImage) {
                              console.log("[Scene Image] 최종 확인 - 이미지가 있으므로 완료 표시")
                              setCompletedSteps((prev) => {
                                if (!prev.includes("image")) {
                                  return [...prev, "image"]
                                }
                                return prev
                              })
                            }
                          }, 500)
                        }
                      }}
                      disabled={isGeneratingSceneImages || sceneImagePrompts.length === 0}
                      className="w-full h-12 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold"
                      size="lg"
                    >
                      {isGeneratingSceneImages ? (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                          2. 이미지 생성 중... ({sceneImageGenerationProgress.current}/{sceneImageGenerationProgress.total})
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-4 h-4 mr-2" />
                          2. 모든 장면 이미지 생성하기
                        </>
                      )}
                </Button>

                {/* 이미지 생성 중단 버튼 */}
                {isGeneratingSceneImages && (
                  <Button
                    onClick={() => {
                      shouldStopImageGeneration.current = true
                      console.log("[Scene Image] 이미지 생성 중단 요청")
                    }}
                    className="w-full h-12 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
                    size="lg"
                  >
                    <X className="w-4 h-4 mr-2" />
                    이미지 생성 중단
                  </Button>
                )}

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

                    {/* Scene별 이미지 프롬프트 트리 구조 표시 */}
                    {sceneImagePrompts.length > 0 && (
                      <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white mt-6">
                        <CardHeader className="pb-4 border-b border-gray-100">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-semibold text-slate-900">생성된 이미지 프롬프트 (트리 구조)</CardTitle>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const textToCopy = sceneImagePrompts.map(scene => 
                                  `Scene ${scene.sceneNumber}\n${scene.images.map(img => `  Image ${img.imageNumber}:\n    ${img.prompt}`).join("\n")}`
                                ).join("\n\n")
                                copyToClipboard(textToCopy)
                                alert("이미지 프롬프트가 복사되었습니다.")
                              }}
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              전체 복사
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="space-y-6">
                            {sceneImagePrompts.map((scene) => (
                              <div key={scene.sceneNumber} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="font-semibold text-lg mb-3 text-blue-600">
                                  Scene {scene.sceneNumber}
                                </div>
                                <div className="space-y-3 ml-4">
                                  {scene.images.map((image) => (
                                    <div key={image.imageNumber} className="border-l-2 border-blue-300 pl-4 py-2 bg-white rounded">
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="font-medium text-sm text-gray-600">
                                          Image {image.imageNumber}:
                                        </div>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            copyToClipboard(image.prompt)
                                            alert(`Image ${image.imageNumber} 프롬프트가 복사되었습니다.`)
                                          }}
                                          className="h-7 px-2"
                                        >
                                          <Copy className="w-3 h-3 mr-1" />
                                          복사
                                        </Button>
                                      </div>
                                      <div className="text-xs text-gray-500 mb-2 italic">
                                        {image.visualInstruction || image.sceneText.substring(0, 100)}{(!image.visualInstruction && image.sceneText.length > 100) ? "..." : ""}
                                      </div>
                                      <div className="flex gap-3">
                                        <div className="flex-1 text-sm font-mono bg-gray-50 p-2 rounded border">
                                          {image.prompt}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                          <Button
                                            size="sm"
                                            variant="default"
                                            className="bg-green-500 hover:bg-green-600 text-white"
                                            disabled={
                                              isGeneratingSceneImages || 
                                              generatingImageIds.has(`${scene.sceneNumber}-${image.imageNumber}`)
                                            }
                                            onClick={async () => {
                                              const replicateApiKey = getApiKey("replicate_api_key")
                                              if (!replicateApiKey) {
                                                alert("Replicate API 키를 설정해주세요.")
                                                return
                                              }
                                              
                                              const imageId = `${scene.sceneNumber}-${image.imageNumber}`
                                              
                                              // 로딩 시작
                                              setGeneratingImageIds((prev) => new Set(prev).add(imageId))
                                              
                                              // 이미지 생성 시작 시 해당 이미지의 영상 데이터 초기화
                                              setConvertedSceneVideos((prev) => {
                                                const newMap = new Map(prev)
                                                newMap.delete(imageId)
                                                return newMap
                                              })
                                              
                                              try {
                                                console.log(`[Scene Image] 개별 이미지 생성 시작: Scene ${scene.sceneNumber}, Image ${image.imageNumber}`)
                                                
                                                // 재시도 로직이 포함된 이미지 생성 (최대 5번 시도)
                                                let imageUrl: string | null = null
                                                const maxRetries = 5
                                                let attempt = 1
                                                
                                                while (attempt <= maxRetries && !imageUrl) {
                                                  try {
                                                    console.log(`[Scene Image] 개별 이미지 생성 시도 ${attempt}/${maxRetries}...`)
                                                    imageUrl = await generateImageWithReplicate(
                                                      image.prompt,
                                                      replicateApiKey,
                                                      "16:9",
                                                      imageStyle,
                                                      image.sceneText
                                                    )
                                                    console.log(`[Scene Image] 개별 이미지 생성 성공 (시도 ${attempt})`)
                                                    break // 성공하면 루프 종료
                                                  } catch (error) {
                                                    console.error(`[Scene Image] 개별 이미지 생성 재시도 ${attempt}/${maxRetries} 실패:`, error)
                                                    
                                                    // 마지막 시도가 아니면 재시도
                                                    if (attempt < maxRetries) {
                                                      attempt++
                                                      // 재시도 전 대기 (지수 백오프, 최대 10초)
                                                      const delay = Math.min(1000 * attempt, 10000)
                                                      console.log(`[Scene Image] ${delay}ms 후 재시도...`)
                                                      await new Promise(resolve => setTimeout(resolve, delay))
                                                    } else {
                                                      // 최대 재시도 횟수 도달
                                                      console.warn(`[Scene Image] 최대 재시도 횟수(${maxRetries}) 도달, 다음 이미지로 넘어갑니다.`)
                                                      break
                                                    }
                                                  }
                                                }
                                                
                                                // imageUrl이 없으면 다음 이미지로 넘어감 (에러 throw하지 않음)
                                                if (imageUrl) {
                                                  console.log(`[Scene Image] 개별 이미지 생성 완료:`, imageUrl)
                                                  
                                                  // 해당 이미지에 imageUrl 추가
                                                  setSceneImagePrompts((prev) => {
                                                    return prev.map((s) => {
                                                      if (s.sceneNumber === scene.sceneNumber) {
                                                        return {
                                                          ...s,
                                                          images: s.images.map((img) => {
                                                            if (img.imageNumber === image.imageNumber) {
                                                              return { ...img, imageUrl: imageUrl ? imageUrl : undefined }
                                                            }
                                                            return img
                                                          }),
                                                        }
                                                      }
                                                      return s
                                                    })
                                                  })
                                                } else {
                                                  console.warn(`[Scene Image] 이미지 생성 실패 (Scene ${scene.sceneNumber}, Image ${image.imageNumber}), 다음 이미지로 넘어갑니다.`)
                                                }
                                                
                                                // 완료 표시 업데이트
                                                setCompletedSteps((prev) => {
                                                  if (!prev.includes("image")) {
                                                    return [...prev, "image"]
                                                  }
                                                  return prev
                                                })
                                              } catch (error) {
                                                console.error(`[Scene Image] 개별 이미지 생성 실패:`, error)
                                                alert(`이미지 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
                                              } finally {
                                                // 로딩 종료
                                                setGeneratingImageIds((prev) => {
                                                  const newSet = new Set(prev)
                                                  newSet.delete(imageId)
                                                  return newSet
                                                })
                                              }
                                            }}
                                          >
                                            {generatingImageIds.has(`${scene.sceneNumber}-${image.imageNumber}`) ? (
                                              <>
                                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                생성 중...
                                              </>
                                            ) : (
                                              <>
                                                <ImageIcon className="w-4 h-4 mr-1" />
                                                {image.imageUrl ? "이미지 재생성" : "이미지 생성"}
                                              </>
                                            )}
                                          </Button>
                                          {image.imageUrl ? (
                                            <div className="w-80 rounded border overflow-hidden">
                                              <div className="aspect-video overflow-hidden">
                                              {(() => {
                                                const videoUrl = convertedSceneVideos.get(`${scene.sceneNumber}-${image.imageNumber}`)
                                                const isVideo = videoUrl || (image.imageUrl && (image.imageUrl.startsWith("data:video/") || image.imageUrl.includes("video")))
                                                const displayUrl = videoUrl || image.imageUrl
                                                
                                                if (isVideo && displayUrl) {
                                                  return (
                                                    <video
                                                      src={displayUrl}
                                                      controls
                                                      className="w-full h-full object-cover"
                                                    />
                                                  )
                                                } else if (image.imageUrl) {
                                                  return (
                                                    <img
                                                      src={image.imageUrl}
                                                      alt={`Scene ${scene.sceneNumber} Image ${image.imageNumber}`}
                                                      className="w-full h-full object-cover"
                                                    />
                                                  )
                                                }
                                                return null
                                              })()}
                                              </div>
                                              <div className="p-2 flex items-center justify-center gap-2 bg-gray-50 border-t">
                                                <label className="cursor-pointer">
                                                <input
                                                  type="file"
                                                  accept="image/*,video/*"
                                                  className="hidden"
                                                  onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                      handleSceneImageUpload(scene.sceneNumber, image.imageNumber, file)
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
                                                    교체
                                                  </span>
                                                </Button>
                                                </label>
                                                {!convertedSceneVideos.has(`${scene.sceneNumber}-${image.imageNumber}`) && (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="bg-white hover:bg-gray-100"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      handleConvertSceneImageToVideo(scene.sceneNumber, image.imageNumber, image.imageUrl!)
                                                    }}
                                                    disabled={isConvertingSceneVideo.has(`${scene.sceneNumber}-${image.imageNumber}`)}
                                                  >
                                                    {isConvertingSceneVideo.has(`${scene.sceneNumber}-${image.imageNumber}`) ? (
                                                      <>
                                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                        변환 중...
                                                      </>
                                                    ) : (
                                                      <>
                                                        <Video className="w-4 h-4 mr-1" />
                                                        영상 변환
                                                      </>
                                                    )}
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          ) : (
                                            <label className="w-80 aspect-video rounded border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors">
                                              <input
                                                type="file"
                                                accept="image/*,video/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                  const file = e.target.files?.[0]
                                                  if (file) {
                                                    handleSceneImageUpload(scene.sceneNumber, image.imageNumber, file)
                                                  }
                                                }}
                                              />
                                              <div className="text-center">
                                                <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                                                <p className="text-xs text-gray-500">이미지/영상 업로드</p>
                                              </div>
                                            </label>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
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
                          // { id: "jB1Cifc2UQbq1gR3wnb0", name: "Rachel", note: "기본(Default)", provider: "elevenlabs" }, // 숨김
                          // { id: "8jHHF8rMqMlg8if2mOUe", name: "Voice 2", note: "사용자 선택형", provider: "elevenlabs" }, // 숨김
                          // { id: "uyVNoMrnUku1dZyVEXwD", name: "Voice 3", note: "", provider: "elevenlabs" }, // 숨김
                          { id: "ttsmaker-여성1", name: "TTSMaker 여성1", note: "ID: 503", provider: "ttsmaker" },
                          { id: "ttsmaker-여성2", name: "TTSMaker 여성2", note: "ID: 509", provider: "ttsmaker" },
                          { id: "ttsmaker-여성6", name: "TTSMaker 여성3", note: "ID: 5802", provider: "ttsmaker" },
                          { id: "ttsmaker-남성1", name: "TTSMaker 남성1", note: "ID: 5501", provider: "ttsmaker" },
                          { id: "ttsmaker-남성4", name: "TTSMaker 남성2", note: "ID: 5888", provider: "ttsmaker" },
                          { id: "ttsmaker-남성5", name: "TTSMaker 남성3", note: "ID: 5888 (음높이 -10%)", provider: "ttsmaker" },
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
                  {(() => {
                    // 장면 분해 결과가 있으면 그것을 사용, 없으면 scriptLines 사용
                    let displayLines: Array<{ id: number; text: string; sceneNumber?: number; imageNumber?: number }> = []
                    
                    if (decomposedScenes && decomposedScenes.trim().length > 0) {
                      // 장면 분해 결과 파싱
                      const sceneBlocks = decomposedScenes.split(/(?=씬\s+\d+)/).filter(block => block.trim().length > 0)
                      let globalLineId = 1
                      
                      for (const sceneBlock of sceneBlocks) {
                        const sceneNumMatch = sceneBlock.match(/씬\s+(\d+)/)
                        if (!sceneNumMatch) continue
                        
                        const sceneNum = parseInt(sceneNumMatch[1])
                        const imageRegex = /\[장면\s+(\d+)\]\s*\n([\s\S]*?)(?=\[장면\s+\d+\]|씬\s+\d+|$)/g
                        let imageMatch
                        
                        while ((imageMatch = imageRegex.exec(sceneBlock)) !== null) {
                          const imageNum = parseInt(imageMatch[1])
                          const imageText = imageMatch[2].trim()
                          
                          if (imageText) {
                            displayLines.push({
                              id: globalLineId++,
                              text: imageText,
                              sceneNumber: sceneNum,
                              imageNumber: imageNum,
                            })
                          }
                        }
                      }
                    } else {
                      // 기존 scriptLines 사용
                      displayLines = scriptLines.map(line => ({ id: line.id, text: line.text }))
                    }
                    
                    return displayLines.map((line) => {
                      const generatedAudio = generatedAudios.find((audio) => audio.lineId === line.id)
                      const title = line.sceneNumber && line.imageNumber 
                        ? `씬 ${line.sceneNumber} - 장면 ${line.imageNumber}`
                        : `문장 ${line.id}`
                      
                      return (
                        <Card key={line.id}>
                          <CardHeader>
                            <CardTitle className="text-sm">{title}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-xs text-muted-foreground line-clamp-3">{line.text}</p>
                            {generatedAudio ? (
                              <div className="space-y-2">
                                <audio controls className="w-full" src={generatedAudio.audioUrl} />
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
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
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleGenerateTTSForSingleLine(line.id)}
                                    disabled={generatingTTSForLine.has(line.id)}
                                  >
                                    {generatingTTSForLine.has(line.id) ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        생성 중...
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 className="w-4 h-4 mr-2" />
                                        다시 생성
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => handleGenerateTTSForSingleLine(line.id)}
                                disabled={generatingTTSForLine.has(line.id)}
                              >
                                {generatingTTSForLine.has(line.id) ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    생성 중...
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-4 h-4 mr-2" />
                                    TTS 생성
                                  </>
                                )}
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })
                  })()}
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
                  className="aspect-video bg-muted rounded-lg relative overflow-hidden mb-4 w-full"
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
                        
                        // lineId 추출 (image_1 -> 1 또는 scene_1_image_1 -> 1-1)
                        let lineId: number | null = null
                        let sceneVideoKey: string | null = null
                        let hasVideo = false
                        
                        if (currentImage) {
                          const idParts = currentImage.id.split("_")
                          if (idParts[0] === "scene") {
                            // 씬별 이미지: scene_1_image_1 -> 1-1
                            const sceneNumber = Number.parseInt(idParts[1] || "0")
                            const imageNumber = Number.parseInt(idParts[3] || "0")
                            sceneVideoKey = `${sceneNumber}-${imageNumber}`
                            hasVideo = convertedSceneVideos.has(sceneVideoKey)
                          } else {
                            // 일반 이미지: image_1 -> 1
                            lineId = Number.parseInt(idParts.pop() || "0")
                            hasVideo = convertedVideos.has(lineId)
                          }
                        }
                        
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
                        if (hasVideo && currentImage) {
                          const videoUrl = sceneVideoKey 
                            ? convertedSceneVideos.get(sceneVideoKey)! 
                            : (lineId !== null ? convertedVideos.get(lineId)! : null)
                          
                          if (videoUrl) {
                            const imageStartTime = currentImage.startTime
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

                        // 줌인 효과와 전환 효과 제거 - 이미지를 그대로 표시
                        return (
                          <div className="absolute inset-0 w-full h-full bg-black">
                            {/* 현재 이미지 - 줌인 및 전환 효과 없음 */}
                            <img
                              src={imageUrl || ""}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover"
                              style={{
                                opacity: 1,
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
                      })()}

                      {/* 자막 오버레이 */}
                      {showSubtitles && currentSubtitle && (
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
                  <div className="mt-4 space-y-4 w-full">
                    <div className="flex items-center gap-4 mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!videoData || !videoData.audioUrl}
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

                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4 text-muted-foreground" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={audioRef ? Math.round(audioRef.volume * 100) : 100}
                          className="volume-slider w-24 h-2 rounded-full appearance-none cursor-pointer bg-slate-300 dark:bg-slate-600"
                          style={{
                            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${audioRef ? (audioRef.volume * 100) : 100}%, rgb(203 213 225) ${audioRef ? (audioRef.volume * 100) : 100}%, rgb(203 213 225) 100%)`
                          }}
                          onChange={(e) => {
                            if (audioRef) {
                              audioRef.volume = Number.parseInt(e.target.value) / 100
                            }
                          }}
                        />
                      </div>
                      <style dangerouslySetInnerHTML={{__html: `
                        .volume-slider::-webkit-slider-thumb {
                          -webkit-appearance: none;
                          appearance: none;
                          width: 16px;
                          height: 16px;
                          border-radius: 50%;
                          background: rgb(100 116 139) !important;
                          cursor: pointer;
                          border: 2px solid white;
                          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                        }
                        .volume-slider::-moz-range-thumb {
                          width: 16px;
                          height: 16px;
                          border-radius: 50%;
                          background: rgb(100 116 139) !important;
                          cursor: pointer;
                          border: 2px solid white;
                          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                        }
                      `}} />

                      <div className="flex-1" /> {/* 공간 채우기 */}

                      <div className="text-sm text-muted-foreground whitespace-nowrap">
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
                        // 자막 표시 여부에 따라 자막 업데이트
                        if (showSubtitles) {
                          const subtitle = videoData.subtitles.find((s) => audioCurrentTime >= s.start && audioCurrentTime < s.end)
                          setCurrentSubtitle(subtitle?.text || "")
                        } else {
                          setCurrentSubtitle("")
                        }
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

                    {/* 메인 타임라인 바 - 클릭 가능 (고급스러운 디자인) */}
                    <div
                      className="relative h-14 w-full bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-xl overflow-hidden cursor-pointer border-2 border-slate-300 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-200"
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
                      {/* 진행 바 배경 (그라데이션) */}
                      <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-pink-500/30 transition-all duration-300"
                        style={{ width: `${(currentTime / videoData.duration) * 100}%` }}
                      />
                      
                      {/* 자막 트랙 */}
                      <div className="absolute top-0 left-0 right-0 h-6 bg-blue-500/20 backdrop-blur-sm">
                        {videoData.subtitles.map((subtitle) => (
                          <div
                            key={subtitle.id}
                            className="absolute h-full bg-gradient-to-r from-blue-500/70 to-blue-600/70 border-l border-r border-blue-400/50 hover:from-blue-500/90 hover:to-blue-600/90 transition-all duration-200 shadow-sm"
                            style={{
                              left: `${(subtitle.start / videoData.duration) * 100}%`,
                              width: `${((subtitle.end - subtitle.start) / videoData.duration) * 100}%`,
                            }}
                            title={`${subtitle.text} (${Math.floor(subtitle.start / 60)}분 ${Math.floor(subtitle.start % 60)}초 - ${Math.floor(subtitle.end / 60)}분 ${Math.floor(subtitle.end % 60)}초)`}
                          />
                        ))}
                      </div>

                      {/* 이미지 트랙 */}
                      <div className="absolute bottom-0 left-0 right-0 h-6 bg-green-500/20 backdrop-blur-sm">
                        {autoImages.map((img) => (
                          <div
                            key={img.id}
                            className="absolute h-full bg-gradient-to-r from-green-500/70 to-emerald-600/70 border-l border-r border-green-400/50 hover:from-green-500/90 hover:to-emerald-600/90 transition-all duration-200 shadow-sm flex items-center justify-center"
                            style={{
                              left: `${(img.startTime / videoData.duration) * 100}%`,
                              width: `${((img.endTime - img.startTime) / videoData.duration) * 100}%`,
                            }}
                            title={`${img.keyword} (${Math.floor(img.startTime / 60)}분 ${Math.floor(img.startTime % 60)}초 - ${Math.floor(img.endTime / 60)}분 ${Math.floor(img.endTime % 60)}초)`}
                          >
                            <ImageIcon className="h-3 w-3 text-white drop-shadow-sm" />
                          </div>
                        ))}
                      </div>

                      {/* 재생 헤드 (고급스러운 디자인) */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-red-400 via-red-500 to-red-600 z-20 pointer-events-none shadow-lg"
                        style={{ left: `${(currentTime / videoData.duration) * 100}%` }}
                      >
                        <div className="absolute -top-2 -left-2.5 w-5 h-5 bg-gradient-to-br from-red-400 to-red-600 rounded-full shadow-lg border-2 border-white dark:border-slate-800 ring-2 ring-red-200 dark:ring-red-900" />
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
                  <CardHeader className="pb-3 border-b border-gray-100">
                    <CardTitle className="text-lg font-semibold text-slate-900">영상 효과 설정</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    {/* 자막 표시 설정 */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">자막 표시</label>
                        <div className="flex gap-2">
                          <Button
                            variant={showSubtitles ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowSubtitles(true)}
                            className={showSubtitles ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
                          >
                            자막 넣기
                          </Button>
                          <Button
                            variant={!showSubtitles ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowSubtitles(false)}
                            className={!showSubtitles ? "bg-gray-600 hover:bg-gray-700 text-white" : ""}
                          >
                            자막 빼기
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {showSubtitles 
                          ? "영상에 자막이 표시됩니다." 
                          : "영상에 자막이 표시되지 않으며, TTS 음성만 포함됩니다."}
                      </p>
                    </div>

                  </CardContent>
                </Card>

                {/* 영상 미리보기 생성 버튼 */}
                <Button
                  onClick={handleRenderVideo}
                  disabled={
                    activeStep !== "render" || 
                    isExporting || 
                    isGeneratingVideo ||
                    scriptLines.length === 0 || 
                    (!sceneImagePrompts.some(s => s.images.some(img => img.imageUrl)) && generatedImages.length === 0) || 
                    generatedAudios.length === 0
                  }
                  className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting || isGeneratingVideo ? (
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

                {/* 영상 미리보기 생성 중 애니메이션 */}
                {isGeneratingVideo && (
                  <AIGeneratingAnimation type="영상 미리보기" />
                )}

                {videoData && !isExporting && !isGeneratingVideo && (
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
                      </Button>
                    </div>
                    <Button
                      onClick={handleExportSRT}
                      disabled={isExporting}
                      variant="outline"
                      size="lg"
                      className="w-full"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      SRT로 내보내기
                    </Button>
                    <Button
                      onClick={handleExportImages}
                      disabled={isExporting}
                      variant="outline"
                      size="lg"
                      className="w-full"
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      사진만 내보내기
                    </Button>
                    <Dialog open={audioExportDialogOpen} onOpenChange={setAudioExportDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          disabled={isExporting}
                          variant="outline"
                          size="lg"
                          className="w-full"
                        >
                          <Volume2 className="w-4 h-4 mr-2" />
                          음성만 내보내기
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>음성 내보내기</DialogTitle>
                          <DialogDescription>
                            전체 음악 또는 개별 음악을 선택하여 내보낼 수 있습니다.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-2 mt-4">
                          <Button
                            onClick={() => {
                              handleExportFullAudio()
                              setAudioExportDialogOpen(false)
                            }}
                            variant="default"
                            size="lg"
                            className="w-full"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            전체음악 내보내기
                          </Button>
                          <Button
                            onClick={() => {
                              handleExportIndividualAudios()
                              setAudioExportDialogOpen(false)
                            }}
                            variant="outline"
                            size="lg"
                            className="w-full"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            각각 음악 내보내기
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
                
                {isExporting && (
                  <AIGeneratingAnimation type="영상 미리보기" />
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

              </CardContent>
            </Card>

            {/* 스크립트 입력 */}
            <Card className="border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 shadow-sm">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">스크립트</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Textarea
                  placeholder="대본을 입력하거나 이전 단계에서 생성된 대본이 자동으로 표시됩니다..."
                  className="min-h-[200px] font-mono text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400"
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
              <Card className="border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 shadow-sm">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">자막 미리보기</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="max-h-60 overflow-y-auto space-y-2 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    {videoData.subtitles.slice(0, 10).map((subtitle) => (
                      <div key={subtitle.id} className="flex gap-3 text-sm p-2 rounded-md hover:bg-white dark:hover:bg-slate-800 transition-colors">
                        <span className="text-muted-foreground min-w-[60px] font-medium">{Math.floor(subtitle.start)}s</span>
                        <span className="text-slate-700 dark:text-slate-300">{subtitle.text}</span>
                      </div>
                    ))}
                    {videoData.subtitles.length > 10 && (
                      <p className="text-sm text-muted-foreground pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">... 외 {videoData.subtitles.length - 10}개 자막</p>
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
                    버튼 활성화 조건: {(() => {
                      const hasSceneImages = sceneImagePrompts.some(s => s.images.some(img => img.imageUrl))
                      const hasRegularImages = generatedImages.length > 0
                      const hasImages = hasSceneImages || hasRegularImages
                      const hasDecomposedScenes = decomposedScenes && decomposedScenes.trim().length > 0
                      const hasScriptContent = scriptLines.length > 0 || hasDecomposedScenes
                      const canActivate = hasScriptContent && hasImages && generatedAudios.length > 0 && !isExporting
                      return canActivate ? "✅ 활성화 가능" : "❌ 비활성화"
                    })()}
                  </p>
                  <p className="text-xs mt-1 text-gray-600">
                    씬 이미지: {sceneImagePrompts.some(s => s.images.some(img => img.imageUrl)) ? "✅ 있음" : "❌ 없음"} | 
                    일반 이미지: {generatedImages.length}개 | 
                    TTS: {generatedAudios.length}개 | 
                    대본: {scriptLines.length > 0 ? `${scriptLines.length}줄` : decomposedScenes && decomposedScenes.trim().length > 0 ? "장면분해됨" : "❌ 없음"}
                  </p>
                  <p className="text-xs mt-1 text-gray-600">
                    이미지 생성 완료: {completedSteps.includes("image") ? "✅" : "❌"} | 
                    TTS 생성 완료: {completedSteps.includes("video") ? "✅" : "❌"}
                  </p>
                  <p className="text-xs mt-1 text-red-600">
                    {(() => {
                      const imageCompleted = completedSteps.includes("image")
                      const ttsCompleted = completedSteps.includes("video")
                      const issues = []
                      if (isExporting) issues.push("렌더링 중")
                      if (!imageCompleted) issues.push("이미지 생성 미완료")
                      if (!ttsCompleted) issues.push("TTS 생성 미완료")
                      return issues.length > 0 ? `비활성화 이유: ${issues.join(", ")}` : "✅ 모든 조건 충족"
                    })()}
                  </p>
                </div>

                    <Button
                      onClick={handleRenderVideo}
                      disabled={
                        activeStep !== "render" || 
                        isExporting || 
                        scriptLines.length === 0 || 
                        (!sceneImagePrompts.some(s => s.images.some(img => img.imageUrl)) && generatedImages.length === 0) || 
                        generatedAudios.length === 0
                      }
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
                                // 제목/설명 생성 단계 체크 (사이드바 ID는 "title")
                                setCompletedSteps((prev) => [...new Set([...prev, "title"])])
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
                      ref={thumbnailPreviewRef}
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

                  {/* 썸네일 커스텀 문구 입력 */}
                  <div className="mb-6 space-y-2">
                    <Label htmlFor="thumbnail-custom-text" className="text-sm font-medium">
                      썸네일 문구 (선택사항)
                    </Label>
                    <Textarea
                      id="thumbnail-custom-text"
                      value={thumbnailCustomText}
                      onChange={(e) => setThumbnailCustomText(e.target.value)}
                      placeholder="썸네일에 포함하고 싶은 문구를 입력하세요. 예: '충격적인 진실', '꼭 알아야 할 사실' 등"
                      className="min-h-[100px] resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      입력한 문구가 썸네일 생성 프롬프트에 포함됩니다.
                    </p>
                  </div>

                  <Button
                    onClick={handleAIGenerateThumbnail}
                    disabled={(!selectedTopic && !script) || isGeneratingAIThumbnail}
                    className="w-full mb-6"
                  >
                    {isGeneratingAIThumbnail ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {selectedTopic ? "AI가 썸네일을 생성하고 있습니다..." : "대본에서 주제를 추출하고 있습니다..."}
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
                    {(() => {
                      // 씬별 이미지와 일반 이미지 모두 확인
                      const hasSceneImages = sceneImagePrompts.length > 0 && sceneImagePrompts.some(scene => 
                        scene.images && scene.images.some(img => img.imageUrl)
                      )
                      const hasRegularImages = generatedImages.length > 0
                      const totalImageCount = generatedImages.length + (hasSceneImages ? sceneImagePrompts.reduce((sum, scene) => 
                        sum + (scene.images?.filter(img => img.imageUrl).length || 0), 0
                      ) : 0)
                      const hasImages = hasSceneImages || hasRegularImages
                      
                      return (
                        <>
                          <p className="text-2xl font-bold text-green-600">{totalImageCount}</p>
                          <p className="text-sm text-muted-foreground">이미지</p>
                          {!hasImages && <p className="text-xs text-red-600 mt-1">⚠️ 필요</p>}
                        </>
                      )
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>

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
                  disabled={(() => {
                    const hasSceneImages = sceneImagePrompts.length > 0 && sceneImagePrompts.some(scene => 
                      scene.images && scene.images.some(img => img.imageUrl)
                    )
                    const hasRegularImages = generatedImages.length > 0
                    return !script || (!hasSceneImages && !hasRegularImages) || isSummarizingScript
                  })()}
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

      case "hooking-video":
        return (
          <div className="space-y-6">
            <div className="space-y-2 mb-6">
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">후킹 영상 프롬프트</h1>
              <p className="text-sm md:text-base text-gray-500">소라2용 30초 후킹 영상 프롬프트를 생성합니다</p>
            </div>

            <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
              <CardHeader className="pb-4 border-b border-gray-100">
                <CardTitle className="text-lg font-semibold text-slate-900">후킹 영상 프롬프트 생성</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* 대본 확인 */}
                {!script || !script.trim() ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <X className="w-5 h-5" />
                      <p className="font-medium">대본이 필요합니다</p>
                    </div>
                    <p className="text-sm text-yellow-700 mt-2">
                      먼저 "대본 생성" 단계에서 대본을 생성해주세요. 생성된 대본을 기반으로 후킹 영상 프롬프트가 만들어집니다.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">사용할 대본</Label>
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">
                          "대본 생성" 단계에서 생성된 대본이 자동으로 사용됩니다.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          대본 길이: {script.length}자
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={async () => {
                          if (!script || !script.trim()) {
                            alert("대본이 필요합니다. 먼저 '대본 생성' 단계에서 대본을 생성해주세요.")
                            return
                          }

                          if (!selectedTopic || !selectedTopic.trim()) {
                            alert("주제가 필요합니다. 먼저 '주제 추천' 단계에서 주제를 선택해주세요.")
                            return
                          }

                          const geminiApiKey = getGeminiApiKey()
                          if (!geminiApiKey) {
                            alert("Gemini API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
                            return
                          }

                          setIsGeneratingHookingPrompt(true)
                          try {
                            const prompt = await generateHookingVideoPrompt(
                              selectedTopic,
                              script,
                              geminiApiKey
                            )
                            setHookingVideoPrompt(prompt)
                            setCompletedSteps((prev) => [...new Set([...prev, "hooking-video"])])
                          } catch (error) {
                            console.error("후킹 영상 프롬프트 생성 실패:", error)
                            alert(
                              `후킹 영상 프롬프트 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
                            )
                          } finally {
                            setIsGeneratingHookingPrompt(false)
                          }
                        }}
                        disabled={isGeneratingHookingPrompt || !script || !script.trim() || !selectedTopic || !selectedTopic.trim()}
                        className="flex-1"
                      >
                        {isGeneratingHookingPrompt ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            생성 중...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4 mr-2" />
                            프롬프트 생성
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}

                {hookingVideoPrompt && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">생성된 프롬프트</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(hookingVideoPrompt)
                          alert("프롬프트가 클립보드에 복사되었습니다.")
                        }}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        복사
                      </Button>
                    </div>
                    <Textarea
                      value={hookingVideoPrompt}
                      onChange={(e) => setHookingVideoPrompt(e.target.value)}
                      className="min-h-[300px] resize-none font-mono text-sm"
                      placeholder="생성된 프롬프트가 여기에 표시됩니다..."
                    />
                    <p className="text-xs text-muted-foreground">
                      생성된 프롬프트를 수정할 수 있습니다. 소라2에 직접 사용하세요.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
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
              <Link href="/WingsAIStudio">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  메인으로
              </Button>
              </Link>
              <h1 className="text-lg font-semibold text-gray-800">
                wingsAIStudio - AI 기반 영상 자동 제작 툴
                </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setSettingsDialogOpen(true)}
                title="설정"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 설정 다이얼로그 */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API 키 설정
            </DialogTitle>
            <DialogDescription>
              AI 서비스 사용을 위한 API 키를 입력해주세요. 키는 브라우저에 안전하게 저장됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* OpenAI API Key */}
            <div className="space-y-2">
              <Label htmlFor="openai-key" className="text-sm font-medium">
                OpenAI API Key
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="openai-key"
                  type={showKeys.openai ? "text" : "password"}
                  placeholder="sk-..."
                  value={apiKeys.openai}
                  onChange={(e) => setApiKeys({ ...apiKeys, openai: e.target.value })}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, openai: !showKeys.openai })}
                  className="shrink-0"
                >
                  {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKeys.openai)
                  }}
                  disabled={!apiKeys.openai}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">GPT 모델 사용에 필요합니다</p>
            </div>

            {/* TTSMaker API Key */}
            <div className="space-y-2">
              <Label htmlFor="ttsmaker-key" className="text-sm font-medium">
                TTSMaker API Key
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="ttsmaker-key"
                  type={showKeys.ttsmaker ? "text" : "password"}
                  placeholder="입력하세요"
                  value={apiKeys.ttsmaker}
                  onChange={(e) => setApiKeys({ ...apiKeys, ttsmaker: e.target.value })}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, ttsmaker: !showKeys.ttsmaker })}
                  className="shrink-0"
                >
                  {showKeys.ttsmaker ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKeys.ttsmaker)
                  }}
                  disabled={!apiKeys.ttsmaker}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">TTSMaker 음성 합성에 사용됩니다</p>
            </div>

            {/* Replicate API Key */}
            <div className="space-y-2">
              <Label htmlFor="replicate-key" className="text-sm font-medium">
                Replicate API Key
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="replicate-key"
                  type={showKeys.replicate ? "text" : "password"}
                  placeholder="r8_..."
                  value={apiKeys.replicate}
                  onChange={(e) => setApiKeys({ ...apiKeys, replicate: e.target.value })}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, replicate: !showKeys.replicate })}
                  className="shrink-0"
                >
                  {showKeys.replicate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKeys.replicate)
                  }}
                  disabled={!apiKeys.replicate}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">AI 모델 실행에 사용됩니다</p>
            </div>

            {/* Gemini API Key */}
            <div className="space-y-2">
              <Label htmlFor="gemini-key" className="text-sm font-medium">
                Gemini API Key
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="gemini-key"
                  type={showKeys.gemini ? "text" : "password"}
                  placeholder="입력하세요"
                  value={apiKeys.gemini}
                  onChange={(e) => setApiKeys({ ...apiKeys, gemini: e.target.value })}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, gemini: !showKeys.gemini })}
                  className="shrink-0"
                >
                  {showKeys.gemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKeys.gemini)
                  }}
                  disabled={!apiKeys.gemini}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">대본 기획 및 생성에 사용됩니다</p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button onClick={handleSaveApiKeys} variant="default">
                {saved ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    저장됨
                  </>
                ) : (
                  "저장"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar - 모바일에서는 하단으로 */}
        <aside className="w-full lg:w-60 bg-white border-r border-gray-200 lg:min-h-screen order-3 lg:order-1">
          <div className="p-4 lg:p-6">
            {/* Logo */}
            <div className="mb-6 lg:mb-8">
              <h2 className="text-xl lg:text-2xl font-bold text-red-600 mb-1">wingsAIStudio</h2>
              <p className="text-xs lg:text-sm text-gray-600">AI 영상 자동 제작</p>
            </div>

            {/* 프로젝트 관리 버튼 */}
            {currentProject && (
              <div className="mb-6 space-y-2">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">현재 프로젝트</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{currentProject.name}</p>
                </div>
                <Button
                  onClick={handleSaveProject}
                  disabled={isSavingProject}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  size="sm"
                >
                  {isSavingProject ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      프로젝트 저장
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleShowProjectList}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  <Folder className="w-4 h-4 mr-2" />
                  프로젝트 목록
                </Button>
              </div>
            )}

            {/* Navigation */}
            <nav className="space-y-1">
              {sidebarItems.map((item, index) => {
              const Icon = item.icon
              const itemIsActive = isStepActive(item.id)
                const stepNumber = index + 1

              return (
                <button
                  key={item.id}
                  onClick={async () => {
                    // 단계 변경 전 자동 저장
                    if (currentProject) {
                      await handleAutoSaveProject(true)
                    }
                    setActiveStep(item.id)
                  }}
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

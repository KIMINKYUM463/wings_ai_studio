"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Scissors,
  Film,
  BarChart3,
  MessageSquare,
  LineChart,
  ArrowRight,
  Settings,
  Key,
  CheckCircle2,
  ShoppingBag,
  User,
  BookOpen,
  CreditCard,
  FileText,
  ImageIcon,
  Volume2,
  Sparkles,
  Zap,
  Play,
  Search,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Youtube,
  Link2,
  Unlink,
  X,
  Loader2,
} from "lucide-react"
import { useRouter } from "next/navigation"

// 비디오 제작 서비스
const videoProductionServices = [
  {
    id: "shorts",
    title: "쇼츠",
    icon: Scissors,
    description: "15초 만에 완성하는 AI 쇼츠 영상",
    url: "/WingsAIStudio/shorts",
    gradient: "from-pink-500 via-red-500 to-orange-500",
    hoverGradient: "from-pink-600 via-red-600 to-orange-600",
  },
  {
    id: "longform",
    title: "롱폼",
    icon: Film,
    description: "대본부터 편집까지, 긴 영상도 자동 제작",
    url: "/WingsAIStudio/longform",
    gradient: "from-blue-500 via-cyan-500 to-teal-500",
    hoverGradient: "from-blue-600 via-cyan-600 to-teal-600",
    featured: true, // 추천 배지 표시
  },
  {
    id: "shopping",
    title: "쿠팡파트너스",
    icon: ShoppingBag,
    description: "쿠팡 상품으로 15초 쇼핑 영상을 빠르게 제작",
    url: "/WingsAIStudio/shopping",
    gradient: "from-orange-500 via-amber-500 to-yellow-500",
    hoverGradient: "from-orange-600 via-amber-600 to-yellow-600",
    locked: true, // 잠금 처리
  },
]

const analysisToolsServices = [
  {
    id: "analytics",
    title: "유튜브 분석",
    icon: BarChart3,
    description: "데이터 기반 인사이트로 채널 성장을 돕습니다",
    url: "/WingsAIStudio/youtube-analytics",
    gradient: "from-purple-500 via-indigo-500 to-blue-500",
    hoverGradient: "from-purple-600 via-indigo-600 to-blue-600",
  },
  {
    id: "youtube-trends",
    title: "유튜브 실시간 분석",
    icon: LineChart,
    description: "실시간 키워드 트렌드를 한눈에 확인",
    url: "/WingsAIStudio/youtube-trends",
    gradient: "from-violet-500 via-fuchsia-500 to-pink-500",
    hoverGradient: "from-violet-600 via-fuchsia-600 to-pink-600",
  },
  {
    id: "chatbot",
    title: "윙스AI 1:1봇",
    icon: MessageSquare,
    description: "AI가 1:1로 답변해드립니다",
    url: "/WingsAIStudio/wings-chatbot",
    gradient: "from-green-500 via-emerald-500 to-teal-500",
    hoverGradient: "from-green-600 via-emerald-600 to-teal-600",
  },
]

// 수강생들 필요한 기능 서비스
const otherToolsServices = [
  {
    id: "niche-analyzer",
    title: "틈새주제 분석기",
    icon: Search,
    description: "검색량이 적은 틈새 주제를 AI가 분석해드립니다",
    url: "#",
    gradient: "from-cyan-500 via-blue-500 to-indigo-500",
    hoverGradient: "from-cyan-600 via-blue-600 to-indigo-600",
    locked: true,
  },
  {
    id: "keyword-optimizer",
    title: "키워드 최적화",
    icon: Search,
    description: "SEO에 최적화된 키워드를 추천해드립니다",
    url: "#",
    gradient: "from-purple-500 to-pink-500",
    hoverGradient: "from-purple-600 to-pink-600",
    locked: true,
  },
  {
    id: "competitor-analysis",
    title: "경쟁채널 분석",
    icon: BarChart3,
    description: "경쟁 채널의 전략을 분석해드립니다",
    url: "#",
    gradient: "from-blue-500 to-cyan-500",
    hoverGradient: "from-blue-600 to-cyan-600",
    locked: true,
  },
  {
    id: "viral-predictor",
    title: "바이럴 예측기",
    icon: LineChart,
    description: "콘텐츠의 바이럴 가능성을 예측해드립니다",
    url: "#",
    gradient: "from-orange-500 to-red-500",
    hoverGradient: "from-orange-600 to-red-600",
    locked: true,
  },
  {
    id: "thumbnail-ab",
    title: "썸네일 A/B 테스트",
    icon: ImageIcon,
    description: "최적의 썸네일을 테스트해드립니다",
    url: "#",
    gradient: "from-green-500 to-emerald-500",
    hoverGradient: "from-green-600 to-emerald-600",
    locked: true,
  },
  {
    id: "upload-scheduler",
    title: "업로드 스케줄러",
    icon: Play,
    description: "최적의 업로드 시간을 분석해드립니다",
    url: "#",
    gradient: "from-violet-500 to-purple-500",
    hoverGradient: "from-violet-600 to-purple-600",
    locked: true,
  },
  {
    id: "comment-analyzer",
    title: "댓글 분석기",
    icon: MessageSquare,
    description: "댓글 감정을 AI로 분석해드립니다",
    url: "#",
    gradient: "from-pink-500 to-rose-500",
    hoverGradient: "from-pink-600 to-rose-600",
    locked: true,
  },
  {
    id: "revenue-calculator",
    title: "수익 계산기",
    icon: BarChart3,
    description: "예상 수익을 계산해드립니다",
    url: "#",
    gradient: "from-amber-500 to-orange-500",
    hoverGradient: "from-amber-600 to-orange-600",
    locked: true,
  },
  {
    id: "hashtag-generator",
    title: "해시태그 생성기",
    icon: Sparkles,
    description: "최적의 해시태그를 생성해드립니다",
    url: "#",
    gradient: "from-teal-500 to-cyan-500",
    hoverGradient: "from-teal-600 to-cyan-600",
    locked: true,
  },
  {
    id: "content-calendar",
    title: "콘텐츠 캘린더",
    icon: FileText,
    description: "콘텐츠 일정을 관리해드립니다",
    url: "#",
    gradient: "from-indigo-500 to-blue-500",
    hoverGradient: "from-indigo-600 to-blue-600",
    locked: true,
  },
]

// Header 컴포넌트
function Header({ onSettingsClick, onFeedbackClick }: { onSettingsClick: () => void; onFeedbackClick: () => void }) {
  const router = useRouter()
  
  return (
    <header className="w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/50 text-blue-700 text-sm font-semibold">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              wingsAIStudio
            </div>
          </div>

          {/* 메뉴 */}
          <nav className="hidden md:flex items-center gap-6">
            <Button 
              variant="ghost" 
              className="text-slate-700 hover:text-slate-900"
              onClick={() => router.push('/')}
            >
              부스텍AI홈
            </Button>
            <Button 
              variant="ghost" 
              className="text-slate-700 hover:text-slate-900"
              onClick={() => window.open('https://loud-cowl-c24.notion.site/WingsAIStudio-2c9565477d598027b595e528e18a974a', '_blank')}
            >
              가이드
            </Button>
            <Button 
              variant="ghost" 
              className="text-slate-700 hover:text-slate-900"
              onClick={onFeedbackClick}
            >
              프로그램 개선사항
            </Button>
          </nav>

          {/* 우측 아이콘들 */}
          <div className="flex items-center gap-2">
            {/* 설정 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={onSettingsClick}
              title="설정"
            >
              <Settings className="w-5 h-5" />
            </Button>

            {/* 사용자 메뉴 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>계정 설정</DropdownMenuLabel>
                <DropdownMenuSeparator />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}

// 자동화 파이프라인 애니메이션 컴포넌트
function AutomationPipeline() {
  const [activeStep, setActiveStep] = useState(0)
  
  const steps = [
    { icon: FileText, label: "대본", color: "from-blue-500 to-cyan-500" },
    { icon: ImageIcon, label: "이미지", color: "from-purple-500 to-pink-500" },
    { icon: Volume2, label: "음성", color: "from-green-500 to-emerald-500" },
    { icon: Play, label: "영상", color: "from-orange-500 to-red-500" },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % (steps.length + 1))
    }, 1200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative py-8">
      {/* 파이프라인 아이콘들 */}
      <div className="flex items-center justify-center gap-2 md:gap-4">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = activeStep > index
          const isCurrent = activeStep === index + 1
          
          return (
            <div key={index} className="flex items-center">
              {/* 단계 아이콘 */}
              <div
                className={`relative flex flex-col items-center transition-all duration-500 ${
                  isCurrent ? "scale-110" : ""
                }`}
              >
                <div
                  className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg ${
                    isActive
                      ? `bg-gradient-to-br ${step.color} shadow-xl`
                      : isCurrent
                      ? `bg-gradient-to-br ${step.color} animate-pulse shadow-xl ring-4 ring-white/50`
                      : "bg-white/80 border-2 border-slate-200"
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 md:w-7 md:h-7 transition-colors duration-500 ${
                      isActive || isCurrent ? "text-white" : "text-slate-400"
                    }`}
                  />
                  
                  {/* 완료 체크 표시 */}
                  {isActive && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center animate-scale-in">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                
                {/* 라벨 */}
                <span
                  className={`mt-2 text-xs md:text-sm font-medium transition-colors duration-500 ${
                    isActive || isCurrent ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
                
                {/* 현재 진행 중 표시 */}
                {isCurrent && (
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
                  </div>
                )}
              </div>
              
              {/* 연결선 */}
              {index < steps.length - 1 && (
                <div className="relative w-8 md:w-16 h-1 mx-1 md:mx-2">
                  <div className="absolute inset-0 bg-slate-200 rounded-full" />
                  <div
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out`}
                    style={{
                      width: activeStep > index + 1 ? "100%" : activeStep === index + 1 ? "50%" : "0%",
                    }}
                  />
                  {/* 움직이는 점 */}
                  {activeStep === index + 1 && (
                    <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg animate-move-dot" 
                      style={{ left: "50%" }} />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 상태 메시지 */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-purple-200/50">
          <Zap className="w-4 h-4 text-purple-500 animate-pulse" />
          <span className="text-sm font-medium text-slate-700">
            {activeStep === 0 && "AI가 자동으로 처리합니다"}
            {activeStep === 1 && "대본을 생성하고 있습니다..."}
            {activeStep === 2 && "이미지를 생성하고 있습니다..."}
            {activeStep === 3 && "음성을 생성하고 있습니다..."}
            {activeStep === 4 && "영상 완성까지 완료!"}
          </span>
        </div>
      </div>
    </div>
  )
}

// Hero Section 컴포넌트
function HeroSection() {
  const router = useRouter()
  const [displayText, setDisplayText] = useState("")
  const fullText = "AI 영상 자동 제작"
  
  // 타이핑 효과
  useEffect(() => {
    let index = 0
    const timer = setInterval(() => {
      if (index <= fullText.length) {
        setDisplayText(fullText.slice(0, index))
        index++
      } else {
        clearInterval(timer)
      }
    }, 100)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="text-center py-8 md:py-12 lg:py-16 space-y-6">
      {/* 타이틀 with 타이핑 효과 */}
      <div className="relative">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent min-h-[1.2em]">
          {displayText}
          <span className="animate-blink text-slate-400">|</span>
      </h1>
        
        {/* 배경 블러 효과 */}
        <div className="absolute inset-0 -z-10 blur-3xl opacity-30">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-full animate-pulse" />
        </div>
      </div>
      
      <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: "1s" }}>
        모든 영상 제작 과정을 한 곳에서
      </p>

      {/* 자동화 파이프라인 애니메이션 */}
      <div className="pt-4 animate-fade-in-up" style={{ animationDelay: "1.2s" }}>
        <AutomationPipeline />
      </div>
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-fade-in-up" style={{ animationDelay: "1.5s" }}>
        <Button
          size="lg"
          className="w-full sm:w-auto px-8 text-base font-semibold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          onClick={() => router.push("/WingsAIStudio/shorts")}
        >
          <Zap className="w-4 h-4 mr-2" />
          지금 바로 쇼츠 만들기
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-auto px-8 text-base font-semibold border-2"
          onClick={() => {
            document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
          }}
        >
          모든 기능 살펴보기
        </Button>
      </div>
    </section>
  )
}

// Feature Card 컴포넌트
function FeatureCard({
  service,
  index,
  onServiceClick,
}: {
  service: (typeof videoProductionServices)[0] | (typeof analysisToolsServices)[0] | (typeof otherToolsServices)[0]
  index: number
  onServiceClick: (service: (typeof videoProductionServices)[0] | (typeof analysisToolsServices)[0] | (typeof otherToolsServices)[0]) => void
}) {
  const Icon = service.icon
  const isLocked = 'locked' in service && service.locked

  return (
    <Card
      className={`group relative overflow-hidden border-0 shadow-lg transition-all duration-300 bg-white/80 backdrop-blur-sm ${
        isLocked 
          ? "cursor-not-allowed opacity-60" 
          : "hover:shadow-2xl cursor-pointer hover:scale-[1.02]"
      } ${
        'featured' in service && service.featured ? "ring-2 ring-pink-200 ring-offset-2" : ""
      }`}
      onClick={() => !isLocked && onServiceClick(service)}
      style={{
        animationDelay: `${index * 100}ms`,
      }}
    >
      {/* 잠금 오버레이 (모자이크 효과) */}
      {isLocked && (
        <div className="absolute inset-0 z-20 bg-slate-300/90 backdrop-blur-[4px] flex flex-col items-center justify-center gap-2">
          <Lock className="w-8 h-8 text-slate-400" />
          {service.id === "shopping" && (
            <span className="text-sm font-semibold text-slate-600">보너스주차 오픈</span>
          )}
        </div>
      )}

      {/* 추천 배지 */}
      {'featured' in service && service.featured && (
        <div className="absolute top-3 left-3 z-10">
          <Badge className="bg-gradient-to-r from-pink-500 to-orange-500 text-white border-0 shadow-md">
            추천
          </Badge>
        </div>
      )}

      {/* 호버 그라데이션 배경 */}
      {!isLocked && (
        <>
          <div
            className={`absolute inset-0 bg-gradient-to-br ${service.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 group-hover:from-transparent group-hover:to-transparent transition-all duration-300" />
        </>
      )}

      <CardContent className="relative p-6 md:p-8 h-full flex flex-col min-h-[220px]">
        {/* 아이콘 */}
        <div
          className={`p-4 rounded-2xl bg-gradient-to-br ${service.gradient} shadow-lg ${!isLocked ? "group-hover:scale-110" : ""} transition-transform duration-300 w-fit mb-4`}
        >
          <Icon className="w-8 h-8 text-white" />
        </div>

        {/* 제목 */}
        <h3 className={`text-xl md:text-2xl font-bold text-slate-900 ${!isLocked ? "group-hover:text-white" : ""} transition-colors duration-300 mb-2`}>
          {service.title}
        </h3>

        {/* 설명 */}
        <p className={`text-sm md:text-base text-slate-600 ${!isLocked ? "group-hover:text-white/90" : ""} transition-colors duration-300 flex-grow`}>
          {service.description}
        </p>

        {/* 시작 버튼 */}
        {!isLocked && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-500 group-hover:text-white/70 transition-colors duration-300">
              바로 시작하기
            </span>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all duration-300" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Feature Section 컴포넌트
function FeatureSection({
  title,
  subtitle,
  services,
  onServiceClick,
  columns = 3,
}: {
  title: string
  subtitle: string
  services: typeof videoProductionServices | typeof analysisToolsServices | typeof otherToolsServices
  onServiceClick: (service: (typeof services)[0]) => void
  columns?: number
}) {
  const gridCols = columns === 5 
    ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5" 
    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
  
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h2>
        <p className="text-base text-slate-600">{subtitle}</p>
      </div>
      <div className={`grid ${gridCols} gap-6`}>
        {services.map((service, index) => (
          <FeatureCard
            key={service.id}
            service={service}
            index={index}
            onServiceClick={onServiceClick}
          />
        ))}
      </div>
    </section>
  )
}

// 메인 컴포넌트
export default function HomePage() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [apiKeys, setApiKeys] = useState({
    openai: "",
    elevenlabs: "",
    replicate: "",
    gemini: "",
    ttsmaker: "",
    supertone: "",
    youtubeClientId: "",
    youtubeClientSecret: "",
    youtubeDataApiKey: "",
  })
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showKeys, setShowKeys] = useState({
    openai: false,
    elevenlabs: false,
    replicate: false,
    gemini: false,
    ttsmaker: false,
    supertone: false,
    youtubeClientId: false,
    youtubeClientSecret: false,
    youtubeDataApiKey: false,
  })
  const [youtubeConnected, setYoutubeConnected] = useState(false)
  const [checkingYoutube, setCheckingYoutube] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [testingKeys, setTestingKeys] = useState<{ [key: string]: boolean }>({})
  const [testResults, setTestResults] = useState<{ [key: string]: { success: boolean; message: string } }>({})
  const [isCheckingLogin, setIsCheckingLogin] = useState(true)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isPasswordAuthenticated, setIsPasswordAuthenticated] = useState(false)
  
  // 업데이트 팝업 관련 상태
  const [announcement, setAnnouncement] = useState<{ id: string; title: string; content: string; created_at: string } | null>(null)
  const [isAnnouncementClosed, setIsAnnouncementClosed] = useState(false)
  
  // 개선사항 관련 상태
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  const [feedbackContent, setFeedbackContent] = useState("")
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  // 로그인 상태 확인 및 비밀번호 인증 확인
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const response = await fetch('/api/kakao/user')
        if (response.ok) {
          const data = await response.json()
          if (data.loggedIn) {
            setIsLoggedIn(true)
            
            // 비밀번호 인증 확인 (sessionStorage)
            const passwordAuth = sessionStorage.getItem('wingsaistudio_password_auth')
            if (passwordAuth === 'true') {
              setIsPasswordAuthenticated(true)
            } else {
              // 비밀번호 인증이 안 되어 있으면 다이얼로그 표시
              setShowPasswordDialog(true)
            }
          } else {
            // 로그인하지 않은 경우 메인 페이지로 리다이렉트
            router.push('/?redirect=/WingsAIStudio')
            return
          }
        } else {
          // 로그인하지 않은 경우 메인 페이지로 리다이렉트
          router.push('/?redirect=/WingsAIStudio')
          return
        }
      } catch (error) {
        console.error('로그인 상태 확인 실패:', error)
        // 오류 발생 시에도 메인 페이지로 리다이렉트
        router.push('/?redirect=/WingsAIStudio')
        return
      } finally {
        setIsCheckingLogin(false)
      }
    }

    checkLoginStatus()
  }, [router])

  // 업데이트 내용 불러오기
  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const response = await fetch('/api/announcements')
        if (response.ok) {
          const data = await response.json()
          if (data.announcement) {
            // 이미 본 업데이트인지 확인
            const viewedAnnouncements = localStorage.getItem('viewed_announcements')
            const viewedIds = viewedAnnouncements ? JSON.parse(viewedAnnouncements) : []
            
            // 이 업데이트를 아직 보지 않았으면 팝업 표시
            if (!viewedIds.includes(data.announcement.id)) {
              setAnnouncement(data.announcement)
              setIsAnnouncementClosed(false)
            }
          }
        }
      } catch (error) {
        console.error("[Announcements] 업데이트 내용 불러오기 실패:", error)
      }
    }
    
    // 비밀번호 인증이 완료된 후에만 업데이트 내용 불러오기
    if (isPasswordAuthenticated) {
      fetchAnnouncement()
    }
  }, [isPasswordAuthenticated])

  // 비밀번호 확인 핸들러
  const handlePasswordSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    
    setPasswordError("")
    
    if (password === "1235") {
      // 비밀번호가 맞으면 sessionStorage에 저장
      sessionStorage.setItem('wingsaistudio_password_auth', 'true')
      setIsPasswordAuthenticated(true)
      setShowPasswordDialog(false)
      setPassword("")
    } else {
      setPasswordError("비밀번호가 올바르지 않습니다.")
      setPassword("")
    }
  }

  // 로컬스토리지에서 API 키 불러오기
  useEffect(() => {
    // 로그인 및 비밀번호 인증 확인 후에만 실행
    if (!isCheckingLogin && isLoggedIn && isPasswordAuthenticated) {
      const storedOpenAI = localStorage.getItem("openai_api_key") || ""
      const storedElevenLabs = localStorage.getItem("elevenlabs_api_key") || ""
      const storedReplicate = localStorage.getItem("replicate_api_key") || ""
      const storedGemini = localStorage.getItem("gemini_api_key") || ""
      const storedTTSMaker = localStorage.getItem("ttsmaker_api_key") || ""
      const storedSupertone = localStorage.getItem("supertone_api_key") || ""
      const storedYoutubeClientId = localStorage.getItem("youtube_client_id") || ""
      const storedYoutubeClientSecret = localStorage.getItem("youtube_client_secret") || ""
      const storedYoutubeDataApiKey = localStorage.getItem("wings_youtube_data_api_key") || ""

      setApiKeys({
        openai: storedOpenAI,
        elevenlabs: storedElevenLabs,
        replicate: storedReplicate,
        gemini: storedGemini,
        ttsmaker: storedTTSMaker,
        supertone: storedSupertone,
        youtubeClientId: storedYoutubeClientId,
        youtubeClientSecret: storedYoutubeClientSecret,
        youtubeDataApiKey: storedYoutubeDataApiKey,
      })

      // YouTube 연결 상태 확인
      checkYoutubeConnection()
    }
  }, [isCheckingLogin, isLoggedIn, isPasswordAuthenticated])

  // YouTube 연결 상태 확인 (로컬스토리지에서)
  const checkYoutubeConnection = async () => {
    setCheckingYoutube(true)
    try {
      // 로컬스토리지에서 토큰 확인
      const tokensStr = localStorage.getItem("youtube_tokens")
      if (tokensStr) {
        try {
          const tokens = JSON.parse(tokensStr)
          const expiresAt = new Date(tokens.expires_at)
          const now = new Date()
          const isExpired = expiresAt < now
          setYoutubeConnected(!isExpired && !!tokens.access_token)
        } catch (e) {
          setYoutubeConnected(false)
        }
      } else {
        setYoutubeConnected(false)
      }
    } catch (error) {
      console.error("YouTube 연결 상태 확인 실패:", error)
      setYoutubeConnected(false)
    } finally {
      setCheckingYoutube(false)
    }
  }

  // URL 파라미터에서 토큰 받아서 로컬스토리지에 저장
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get("youtube_connected") === "true") {
      const accessToken = urlParams.get("access_token")
      const refreshToken = urlParams.get("refresh_token")
      const expiresAt = urlParams.get("expires_at")
      
      if (accessToken && refreshToken && expiresAt) {
        const tokens = {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
        }
        localStorage.setItem("youtube_tokens", JSON.stringify(tokens))
        setYoutubeConnected(true)
        
        // URL 정리
        window.history.replaceState({}, "", window.location.pathname)
      }
    }
  }, [])

  // YouTube 연결 시작
  const handleYoutubeConnect = () => {
    if (!apiKeys.youtubeClientId || !apiKeys.youtubeClientSecret) {
      alert("YouTube Client ID와 Secret을 먼저 입력하고 저장해주세요.")
      return
    }
    // 로컬스토리지에서 직접 읽어서 쿼리 파라미터로 전달
    const clientId = apiKeys.youtubeClientId
    const clientSecret = apiKeys.youtubeClientSecret
    window.location.href = `/api/youtube/auth?clientId=${encodeURIComponent(clientId)}&clientSecret=${encodeURIComponent(clientSecret)}`
  }

  // YouTube 연결 해제 (로컬스토리지에서 삭제)
  const handleYoutubeDisconnect = async () => {
    try {
      localStorage.removeItem("youtube_tokens")
      setYoutubeConnected(false)
      alert("YouTube 연결이 해제되었습니다.")
    } catch (error) {
      console.error("YouTube 연결 해제 실패:", error)
      alert("연결 해제 중 오류가 발생했습니다.")
    }
  }


  // API 키 저장 (모두 로컬스토리지에 저장)
  const handleSave = () => {
    localStorage.setItem("openai_api_key", apiKeys.openai)
    localStorage.setItem("elevenlabs_api_key", apiKeys.elevenlabs)
    localStorage.setItem("replicate_api_key", apiKeys.replicate)
    localStorage.setItem("gemini_api_key", apiKeys.gemini)
    localStorage.setItem("ttsmaker_api_key", apiKeys.ttsmaker || "")
    localStorage.setItem("supertone_api_key", apiKeys.supertone || "")
    localStorage.setItem("youtube_client_id", apiKeys.youtubeClientId)
    localStorage.setItem("youtube_client_secret", apiKeys.youtubeClientSecret)
    localStorage.setItem("wings_youtube_data_api_key", apiKeys.youtubeDataApiKey)
    
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
    }, 2000)
  }

  // API 키 연결 확인 함수
  const testApiKey = async (keyType: string) => {
    if (!apiKeys[keyType as keyof typeof apiKeys]) {
      setTestResults({
        ...testResults,
        [keyType]: { success: false, message: "API 키를 먼저 입력해주세요." }
      })
      return
    }

    setTestingKeys({ ...testingKeys, [keyType]: true })
    setTestResults({ ...testResults, [keyType]: { success: false, message: "" } })

    try {
      switch (keyType) {
        case "openai": {
          const response = await fetch("https://api.openai.com/v1/models", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKeys.openai}`,
            },
          })
          if (response.ok) {
            setTestResults({
              ...testResults,
              [keyType]: { success: true, message: "연결 성공!" }
            })
          } else {
            const error = await response.json()
            setTestResults({
              ...testResults,
              [keyType]: { success: false, message: `연결 실패: ${error.error?.message || response.statusText}` }
            })
          }
          break
        }
        case "gemini": {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKeys.gemini}`,
            {
              method: "GET",
            }
          )
          if (response.ok) {
            setTestResults({
              ...testResults,
              [keyType]: { success: true, message: "연결 성공!" }
            })
          } else {
            const error = await response.json()
            setTestResults({
              ...testResults,
              [keyType]: { success: false, message: `연결 실패: ${error.error?.message || response.statusText}` }
            })
          }
          break
        }
        case "replicate": {
          // 서버 사이드 API를 통해 테스트 (CORS 문제 해결)
          const response = await fetch("/api/test-replicate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ apiKey: apiKeys.replicate }),
          })
          const result = await response.json()
          setTestResults({
            ...testResults,
            [keyType]: { success: result.success, message: result.message }
          })
          break
        }
        case "youtubeDataApiKey": {
          const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&key=${apiKeys.youtubeDataApiKey}&maxResults=1`,
            {
              method: "GET",
            }
          )
          if (response.ok) {
            setTestResults({
              ...testResults,
              [keyType]: { success: true, message: "연결 성공!" }
            })
          } else {
            const error = await response.json()
            setTestResults({
              ...testResults,
              [keyType]: { success: false, message: `연결 실패: ${error.error?.message || response.statusText}` }
            })
          }
          break
        }
        case "ttsmaker": {
          // 서버 사이드 API를 통해 테스트 (TTSMaker API)
          const response = await fetch("/api/test-ttsmaker", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ apiKey: apiKeys.ttsmaker }),
          })
          const result = await response.json()
          setTestResults({
            ...testResults,
            [keyType]: { success: result.success, message: result.message }
          })
          break
        }
        case "elevenlabs": {
          // ElevenLabs API 키는 연결 확인만 표시 (실제 API 호출 없음)
          setTestResults({
            ...testResults,
            [keyType]: { success: true, message: "연결 확인" }
          })
          break
        }
        case "supertone": {
          // Supertone API 키는 연결 확인만 표시 (실제 API 호출 없음)
          setTestResults({
            ...testResults,
            [keyType]: { success: true, message: "연결 확인" }
          })
          break
        }
        default:
          setTestResults({
            ...testResults,
            [keyType]: { success: false, message: "지원하지 않는 API 키입니다." }
          })
      }
    } catch (error: any) {
      setTestResults({
        ...testResults,
        [keyType]: { success: false, message: `연결 실패: ${error.message || "알 수 없는 오류"}` }
      })
    } finally {
      setTestingKeys({ ...testingKeys, [keyType]: false })
    }
  }

  const handleServiceClick = (service: (typeof videoProductionServices)[0] | (typeof analysisToolsServices)[0] | (typeof otherToolsServices)[0]) => {
    if (service.url.startsWith("http")) {
      window.open(service.url, "_blank")
    } else {
      router.push(service.url)
    }
  }

  // 로그인 확인 중이면 로딩 화면 표시
  if (isCheckingLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-600">로그인 확인 중...</p>
        </div>
      </div>
    )
  }

  // 로그인하지 않은 경우 아무것도 렌더링하지 않음 (이미 리다이렉트됨)
  if (!isLoggedIn) {
    return null
  }

  // 비밀번호 인증이 안 되어 있으면 다이얼로그만 표시
  if (!isPasswordAuthenticated) {
    return (
      <Dialog open={showPasswordDialog} onOpenChange={(open) => {
        if (!open) {
          // 다이얼로그를 닫으려고 하면 메인 페이지로 리다이렉트
          router.push('/')
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              WingsAIStudio 접근 인증
            </DialogTitle>
            <DialogDescription>
              WingsAIStudio에 접근하려면 비밀번호를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit}>
            <div className="space-y-4 py-4">
              {/* 경고 메시지 */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 font-medium">
                  ⚠️ 매일 수강생인지 확인 후 아닐 시 영구정지됩니다.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setPasswordError("")
                  }}
                  placeholder="비밀번호를 입력하세요"
                  autoFocus
                  className={passwordError ? "border-red-500" : ""}
                />
                {passwordError && (
                  <p className="text-sm text-red-500">{passwordError}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/')}
              >
                취소
              </Button>
              <Button type="submit">
                확인
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  // 업데이트 팝업 닫기 핸들러
  const handleCloseAnnouncement = () => {
    if (announcement) {
      // 본 업데이트 ID를 localStorage에 저장
      const viewedAnnouncements = localStorage.getItem('viewed_announcements')
      const viewedIds = viewedAnnouncements ? JSON.parse(viewedAnnouncements) : []
      if (!viewedIds.includes(announcement.id)) {
        viewedIds.push(announcement.id)
        localStorage.setItem('viewed_announcements', JSON.stringify(viewedIds))
      }
    }
    setIsAnnouncementClosed(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* 배경 장식 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-pink-200/20 to-orange-200/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-cyan-100/10 to-blue-100/10 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <Header onSettingsClick={() => setOpen(true)} onFeedbackClick={() => setShowFeedbackDialog(true)} />

      {/* 업데이트 팝업 (왼쪽 고정 패널) */}
      {announcement && !isAnnouncementClosed && (
        <div className="fixed left-4 top-20 z-50 w-80 max-h-[calc(100vh-6rem)] bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-2xl flex flex-col animate-slide-in-right">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900">업데이트 내용</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={handleCloseAnnouncement}
            >
              <X className="w-4 h-4 text-gray-600" />
            </Button>
          </div>
          
          {/* 내용 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-3">
              <h4 className="font-bold text-lg text-gray-900 mb-1">{announcement.title}</h4>
              <p className="text-xs text-gray-500">
                {new Date(announcement.created_at).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div 
              className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: announcement.content.replace(/\n/g, '<br />') }}
            />
          </div>
          
          {/* 프로그램 개선사항 버튼 */}
          <div className="p-4 border-t border-gray-200">
            <Button
              onClick={() => setShowFeedbackDialog(true)}
              variant="outline"
              className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-200 text-blue-700"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              프로그램 개선사항
            </Button>
          </div>
        </div>
      )}

      {/* 개선사항 작성 다이얼로그 */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              프로그램 개선사항
            </DialogTitle>
            <DialogDescription>
              개선하고 싶은 사항이나 제안하고 싶은 기능을 자유롭게 작성해주세요.
            </DialogDescription>
          </DialogHeader>
          
          {feedbackSubmitted ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">제출 완료</h3>
              <p className="text-sm text-gray-600 mb-6">
                소중한 의견 감사합니다. 검토 후 반영하겠습니다.
              </p>
              <Button
                onClick={() => {
                  setShowFeedbackDialog(false)
                  setFeedbackSubmitted(false)
                  setFeedbackContent("")
                }}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                확인
              </Button>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!feedbackContent.trim()) {
                  alert("개선사항을 입력해주세요.")
                  return
                }
                
                setIsSubmittingFeedback(true)
                try {
                  // 사용자 ID 가져오기
                  let userId = null
                  try {
                    const userResponse = await fetch('/api/kakao/user')
                    if (userResponse.ok) {
                      const userData = await userResponse.json()
                      if (userData.loggedIn && userData.user) {
                        userId = userData.user.email || userData.user.id || null
                      }
                    }
                  } catch (error) {
                    console.error("[Feedback] 사용자 정보 가져오기 실패:", error)
                  }
                  
                  const response = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      content: feedbackContent.trim(),
                      userId: userId,
                    }),
                  })
                  
                  if (response.ok) {
                    setFeedbackSubmitted(true)
                    setFeedbackContent("")
                  } else {
                    const errorData = await response.json()
                    alert(errorData.error || "개선사항 제출에 실패했습니다.")
                  }
                } catch (error) {
                  console.error("[Feedback] 제출 실패:", error)
                  alert("개선사항 제출 중 오류가 발생했습니다.")
                } finally {
                  setIsSubmittingFeedback(false)
                }
              }}
            >
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="feedback-content" className="text-sm font-medium">
                    개선사항
                  </Label>
                  <Textarea
                    id="feedback-content"
                    value={feedbackContent}
                    onChange={(e) => setFeedbackContent(e.target.value)}
                    placeholder="예: 새로운 기능 추가, 버그 수정, UI 개선 등 자유롭게 작성해주세요."
                    className="min-h-[150px] resize-none mt-2"
                    disabled={isSubmittingFeedback}
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowFeedbackDialog(false)
                      setFeedbackContent("")
                    }}
                    disabled={isSubmittingFeedback}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingFeedback || !feedbackContent.trim()}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    {isSubmittingFeedback ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        제출 중...
                      </>
                    ) : (
                      "제출"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 메인 컨텐츠 */}
      <main className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
          {/* Hero Section */}
      <HeroSection />

          {/* Features Section */}
          <div id="features" className="space-y-12 md:space-y-16 mt-16 md:mt-24">
            {/* 영상 제작 섹션 */}
            <FeatureSection
              title="영상 제작"
              subtitle="AI로 쇼츠부터 롱폼까지 자동 제작"
              services={videoProductionServices}
              onServiceClick={handleServiceClick}
            />

            {/* 분석 & 도구 섹션 */}
            <FeatureSection
              title="분석 & 도구"
              subtitle="채널 성장과 운영을 돕는 보조 도구"
              services={analysisToolsServices}
              onServiceClick={handleServiceClick}
            />

            {/* 수강생들 필요한 기능 섹션 */}
            <FeatureSection
              title="수강생들 필요한 기능"
              subtitle="수강생들이 필요한 기능을 요청해주시면 아래 개발해드립니다"
              services={otherToolsServices}
              onServiceClick={handleServiceClick}
              columns={5}
            />
          </div>
        </div>
    </main>

      {/* API 키 설정 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API 키 설정
            </DialogTitle>
            <DialogDescription>
              AI 서비스 사용을 위한 API 키를 입력해주세요. 키는 브라우저에 안전하게 저장됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4 overflow-y-auto flex-1">
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
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  disabled={!apiKeys.openai}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("openai")}
                  disabled={testingKeys.openai || !apiKeys.openai}
                  className="shrink-0 text-xs"
                >
                  {testingKeys.openai ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.openai && (
                <p className={`text-xs ${testResults.openai.success ? "text-green-600" : "text-red-600"}`}>
                  {testResults.openai.message}
                </p>
              )}
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
                  value={apiKeys.ttsmaker || ""}
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
                    navigator.clipboard.writeText(apiKeys.ttsmaker || "")
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  disabled={!apiKeys.ttsmaker}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("ttsmaker")}
                  disabled={testingKeys.ttsmaker || !apiKeys.ttsmaker}
                  className="shrink-0 text-xs"
                >
                  {testingKeys.ttsmaker ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.ttsmaker && (
                <p className={`text-xs ${testResults.ttsmaker.success ? "text-green-600" : "text-red-600"}`}>
                  {testResults.ttsmaker.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">TTSMaker 음성 합성에 사용됩니다</p>
            </div>

            {/* ElevenLabs API Key */}
            <div className="space-y-2">
              <Label htmlFor="elevenlabs-key" className="text-sm font-medium">
                ElevenLabs API Key
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="elevenlabs-key"
                  type={showKeys.elevenlabs ? "text" : "password"}
                  placeholder="입력하세요"
                  value={apiKeys.elevenlabs}
                  onChange={(e) => setApiKeys({ ...apiKeys, elevenlabs: e.target.value })}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, elevenlabs: !showKeys.elevenlabs })}
                  className="shrink-0"
                >
                  {showKeys.elevenlabs ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKeys.elevenlabs)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  disabled={!apiKeys.elevenlabs}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("elevenlabs")}
                  disabled={testingKeys.elevenlabs || !apiKeys.elevenlabs}
                  className="shrink-0 text-xs"
                >
                  {testingKeys.elevenlabs ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.elevenlabs && (
                <p className={`text-xs ${testResults.elevenlabs.success ? "text-green-600" : "text-red-600"}`}>
                  {testResults.elevenlabs.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">ElevenLabs 음성 합성에 사용됩니다</p>
            </div>

            {/* Supertone API Key */}
            <div className="space-y-2">
              <Label htmlFor="supertone-key" className="text-sm font-medium">
                Supertone API Key
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="supertone-key"
                  type={showKeys.supertone ? "text" : "password"}
                  placeholder="입력하세요"
                  value={apiKeys.supertone || ""}
                  onChange={(e) => setApiKeys({ ...apiKeys, supertone: e.target.value })}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, supertone: !showKeys.supertone })}
                  className="shrink-0"
                >
                  {showKeys.supertone ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKeys.supertone || "")
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  disabled={!apiKeys.supertone}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("supertone")}
                  disabled={testingKeys.supertone || !apiKeys.supertone}
                  className="shrink-0 text-xs"
                >
                  {testingKeys.supertone ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.supertone && (
                <p className={`text-xs ${testResults.supertone.success ? "text-green-600" : "text-red-600"}`}>
                  {testResults.supertone.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Supertone 음성 합성에 사용됩니다 (롱폼과 연동)</p>
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
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  disabled={!apiKeys.replicate}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("replicate")}
                  disabled={testingKeys.replicate || !apiKeys.replicate}
                  className="shrink-0 text-xs"
                >
                  {testingKeys.replicate ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.replicate && (
                <p className={`text-xs ${testResults.replicate.success ? "text-green-600" : "text-red-600"}`}>
                  {testResults.replicate.message}
                </p>
              )}
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
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  disabled={!apiKeys.gemini}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("gemini")}
                  disabled={testingKeys.gemini || !apiKeys.gemini}
                  className="shrink-0 text-xs"
                >
                  {testingKeys.gemini ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.gemini && (
                <p className={`text-xs ${testResults.gemini.success ? "text-green-600" : "text-red-600"}`}>
                  {testResults.gemini.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">대본 기획 및 생성에 사용됩니다</p>
            </div>

            {/* 구분선 */}
            <div className="border-t border-slate-200 my-4" />

            {/* YouTube Data API Key */}
            <div className="space-y-2">
              <Label htmlFor="youtube-data-api-key" className="text-sm font-medium">
                YouTube Data API Key
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="youtube-data-api-key"
                  type={showKeys.youtubeDataApiKey ? "text" : "password"}
                  placeholder="Google Cloud Console에서 발급받은 API Key"
                  value={apiKeys.youtubeDataApiKey}
                  onChange={(e) => setApiKeys({ ...apiKeys, youtubeDataApiKey: e.target.value })}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, youtubeDataApiKey: !showKeys.youtubeDataApiKey })}
                  className="shrink-0"
                >
                  {showKeys.youtubeDataApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKeys.youtubeDataApiKey)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  disabled={!apiKeys.youtubeDataApiKey}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("youtubeDataApiKey")}
                  disabled={testingKeys.youtubeDataApiKey || !apiKeys.youtubeDataApiKey}
                  className="shrink-0 text-xs"
                >
                  {testingKeys.youtubeDataApiKey ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.youtubeDataApiKey && (
                <p className={`text-xs ${testResults.youtubeDataApiKey.success ? "text-green-600" : "text-red-600"}`}>
                  {testResults.youtubeDataApiKey.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                유튜브 분석, 유튜브 실시간 분석, 롱폼의 '일주일간 인기 주제' 기능에 사용됩니다.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t pt-4 mt-4 shrink-0">
            <div className="flex items-center gap-2 text-sm text-green-600">
              {saved && (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>저장되었습니다</span>
                </>
              )}
              {copied && (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>복사되었습니다</span>
                </>
              )}
            </div>
            <Button onClick={handleSave} className="min-w-[100px]">
              저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 푸터 - 저작권 문구 */}
      <footer className="relative z-10 border-t border-slate-200/50 bg-white/80 backdrop-blur-sm mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-4">
            <div className="text-center text-sm text-slate-600 space-y-2">
              <p className="font-semibold text-slate-900">© 2025 wingsAIStudio. All Rights Reserved.</p>
              <div className="space-y-1 text-xs">
                <p>
                  <strong>저작권 보호:</strong> 본 소프트웨어 및 모든 관련 코드, 디자인, 알고리즘, 프롬프트 엔지니어링, 
                  비즈니스 로직은 저작권법에 의해 보호받습니다.
                </p>
                <p>
                  <strong>무단 사용 금지:</strong> 본 소프트웨어의 무단 복제, 배포, 수정, 리버스 엔지니어링, 
                  벤치마킹, 모방, 또는 상업적 이용을 엄격히 금지합니다.
                </p>
                <p>
                  <strong>법적 책임:</strong> 본 소프트웨어의 무단 사용, 복제, 또는 모방으로 인한 모든 법적 책임은 
                  사용자에게 있으며, 저작권 침해 시 민사 및 형사상의 법적 조치가 취해질 수 있습니다.
                </p>
                <p className="text-red-600 font-medium">
                  ⚠️ 본 소프트웨어의 코드, 구조, 알고리즘, 프롬프트를 분석하거나 따라하는 행위는 저작권 침해에 해당하며 
                  법적 처벌을 받을 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}



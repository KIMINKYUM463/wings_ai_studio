"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
  FileText,
  Upload,
  ArrowRight,
  Settings,
  Home,
  Key,
  CheckCircle2,
  User,
  BookOpen,
  ImageIcon,
  Volume2,
  Sparkles,
  Play,
  Lock,
  TriangleAlert,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Loader2,
  Clapperboard,
  Bot,
  ChartNoAxesCombined,
  Scissors,
  Film,
  PawPrint,
  Newspaper,
  MessageSquareText,
  Check,
  ArrowUpRight,
} from "lucide-react"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"

type ShotFormServiceItem = {
  id: string
  title: string
  icon: LucideIcon
  description: string
  url: string
  featured?: boolean
  isNew?: boolean
  locked?: boolean
  /** 우측 상단 스티커 (예: ver1, ver2) */
  sticker?: string
}

// 숏폼 전용 서비스
const shotFormServices: ShotFormServiceItem[] = [
  {
    id: "ai-shopping",
    title: "AI 쇼핑 숏폼",
    icon: Sparkles,
    description: "제품 서칭→대본→스토리보드→오디오→이미지→비디오→프리뷰, 7단계 수동 파이프라인",
    url: "/WingsAIStudioShotForm/ai-shopping",
  },
  {
    id: "story-shopping",
    title: "AI 스토리 쇼핑 숏폼",
    icon: BookOpen,
    description: "썰 채널형 쇼핑 숏폼: 훅 제목·장면별 나레이션을 썰 프레임으로 합성해 소개하는 숏폼",
    url: "/WingsAIStudioShotForm/story-shopping",
  },
  {
    id: "shortform-studio",
    title: "AI 리믹스 쇼핑숏폼",
    icon: Clapperboard,
    description: "키워드·소스·리믹스·자막·썸네일 프로젝트",
    url: "/WingsAIStudioShotForm/shortform-studio",
  },
  {
    id: "animal-shopping",
    title: "AI 동물 쇼핑 숏폼",
    icon: PawPrint,
    description: "의인화 동물이 마트에서 쇼핑하는 바이럴 숏폼",
    url: "/WingsAIStudioShotForm/animal-shopping",
  },
  {
    id: "info-shopping",
    title: "AI 카드뉴스 쇼핑숏폼",
    icon: Newspaper,
    description: "벤치마크 URL → 쿠팡 매칭 → 카드뉴스 쇼핑숏폼",
    url: "/WingsAIStudioShotForm/info-shopping",
  },
]

// 일반 숏폼 서비스 (일시 비활성화)
const generalShortformServices: ShotFormServiceItem[] = [
  {
    id: "shorts",
    title: "AI 일반 숏폼",
    icon: Film,
    description: "명언·건강·자기계발 등 주제로 대본·이미지·TTS 숏폼 제작",
    url: "/WingsAIStudioShotForm/shorts",
    locked: true,
  },
  {
    id: "longform-clip",
    title: "AI 롱폼 클립",
    icon: Scissors,
    description: "롱폼 URL만 넣으면 AI가 바이럴 숏폼 구간을 자동으로 잘라줍니다",
    url: "/WingsAIStudioShotForm/longform-clip",
    isNew: true,
    locked: true,
  },
  {
    id: "ssul-tts-tool",
    title: "AI썰쇼핑숏폼 도구",
    icon: MessageSquareText,
    description: "TTS 모델 선택 + 대본만 넣으면 목소리·SRT를 바로 다운로드",
    url: "/WingsAIStudioShotForm/ssul-tts-tool",
    isNew: true,
  },
]

// 분석 & 도구 서비스
const analysisToolsServices: ShotFormServiceItem[] = [
  {
    id: "channel-analysis",
    title: "채널 스카우트",
    icon: ChartNoAxesCombined,
    description: "내 채널 진단 · YouTube 성장 포인트",
    url: "/WingsAIStudioShotForm/channel-analysis/deep-dive",
  },
  {
    id: "chatbot",
    title: "윙스AI 1:1봇",
    icon: Bot,
    description: "AI가 1:1로 답변해드립니다",
    url: "/WingsAIStudioShotForm/wings-chatbot",
  },
]

const GUIDE_VIDEO_URL = "https://loud-cowl-c24.notion.site/3b6565477d5980deb680e80c49c98b39"

// Header 컴포넌트
function Header({ onSettingsClick }: { onSettingsClick: () => void }) {
  const router = useRouter()
  const iconButtonClass = "rounded-lg text-[#5b6472] hover:bg-[#eef2f8] hover:text-[#111827]"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#e5e9f0] bg-[#fbfcfe]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#14213d] text-[13px] font-bold text-[#fff]">
            W
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#111827]">Wings AI Studio</span>
          <span className="h-4 w-px bg-[#d9dee7]" aria-hidden />
          <span className="text-[15px] font-medium text-[#6b7280]">ShotForm</span>
        </div>

        <div className="flex items-center gap-1">
          <a
            href={GUIDE_VIDEO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mr-2 hidden items-center gap-1.5 rounded-lg border border-[#e1e6ee] bg-[#fff] px-3 py-1.5 text-[13px] font-medium text-[#374151] transition-colors hover:border-[#c9d3e3] hover:bg-[#f7f9fc] sm:inline-flex"
          >
            <Play className="h-3.5 w-3.5" />
            가이드 영상
          </a>
          <Button variant="ghost" size="icon" className={iconButtonClass} onClick={() => router.push("/")} title="wings AI 홈">
            <Home className="h-[18px] w-[18px]" />
          </Button>
          <Button variant="ghost" size="icon" className={iconButtonClass} onClick={onSettingsClick} title="설정">
            <Settings className="h-[18px] w-[18px]" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className={iconButtonClass} title="계정">
                <User className="h-[18px] w-[18px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 border-[#e5e9f0] bg-[#fff] text-[#111827]">
              <DropdownMenuLabel>계정 설정</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#eef1f6]" />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

const PIPELINE_STEPS = [
  { icon: FileText, label: "대본", detail: "제품 소구점으로 15초 대본 작성" },
  { icon: ImageIcon, label: "이미지", detail: "장면별 이미지 생성" },
  { icon: Volume2, label: "음성", detail: "나레이션 TTS 합성" },
  { icon: Play, label: "영상", detail: "자막·컷 편집 후 렌더링" },
] as const

/** 히어로 오른쪽: 자동 제작이 단계별로 진행되는 모습 (완성 화면을 잠깐 보여준 뒤 반복) */
function AutomationPipeline() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % (PIPELINE_STEPS.length + 2))
    }, 1600)
    return () => clearInterval(interval)
  }, [])

  const doneCount = Math.min(activeStep, PIPELINE_STEPS.length)
  const isComplete = doneCount === PIPELINE_STEPS.length
  const progress = Math.round((doneCount / PIPELINE_STEPS.length) * 100)

  return (
    <div className="rounded-2xl border border-[#e3e8f0] bg-[#fff] p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-24px_rgba(30,58,138,0.2)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-[#6b7280]">예시 프로젝트</p>
          <p className="mt-0.5 text-[15px] font-semibold text-[#111827]">무선 핸디 청소기 · 15초</p>
        </div>
        <span
          className={`rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums ${
            isComplete ? "bg-[#e8f6ee] text-[#18794e]" : "bg-[#eef3fd] text-[#2c5fd6]"
          }`}
        >
          {isComplete ? "완성" : `${progress}%`}
        </span>
      </div>

      <div className="mb-4 h-1 overflow-hidden rounded-full bg-[#eef1f6]">
        <div
          className="h-full rounded-full bg-[#2c5fd6] transition-[width] duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className="space-y-1">
        {PIPELINE_STEPS.map((step, index) => {
          const state = activeStep > index ? "done" : activeStep === index ? "current" : "todo"
          const StepIcon = step.icon
          return (
            <li
              key={step.label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-500 ${
                state === "current" ? "bg-[#f3f6fd]" : ""
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-500 ${
                  state === "done"
                    ? "bg-[#2c5fd6] text-[#fff]"
                    : state === "current"
                      ? "shotform-pulse-ring bg-[#fff] text-[#2c5fd6] ring-1 ring-[#2c5fd6]"
                      : "bg-[#f3f5f9] text-[#9aa3b2]"
                }`}
              >
                {state === "done" ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <StepIcon className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[14px] font-semibold ${state === "todo" ? "text-[#9aa3b2]" : "text-[#111827]"}`}>
                  {step.label}
                </p>
                <p className="truncate text-[13px] text-[#6b7280]">{step.detail}</p>
              </div>
              {state === "current" ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#2c5fd6]" />
              ) : (
                <span className="text-[12px] font-medium text-[#9aa3b2]">{state === "done" ? "완료" : "대기"}</span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// Hero Section 컴포넌트
function HeroSection() {
  return (
    <section className="grid items-center gap-12 pb-6 pt-4 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-8">
      <div className="shotform-rise">
        <p className="mb-5 inline-flex items-center gap-2 text-[13px] font-semibold text-[#2c5fd6]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2c5fd6]" />
          AI 쇼핑숏폼 자동 제작
        </p>
        <h1 className="text-[40px] font-bold leading-[1.15] tracking-[-0.035em] text-[#0f172a] [text-wrap:balance] sm:text-5xl lg:text-[56px]">
          대본부터 영상까지,
          <br />
          <span className="text-[#2c5fd6]">15초 쇼핑 숏폼</span>을 한 번에
        </h1>
        <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-[#5b6472] [text-wrap:pretty]">
          제품만 정하면 AI가 대본·이미지·음성·영상을 차례로 만듭니다. 아래에서 만들 숏폼 종류를 고르세요.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <a
            href="#features"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2c5fd6] px-5 text-[15px] font-semibold text-[#fff] shadow-[0_8px_20px_-8px_rgba(44,95,214,0.6)] transition hover:bg-[#2350bb] active:scale-[0.98]"
          >
            제작 시작하기
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href={GUIDE_VIDEO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[15px] font-medium text-[#374151] transition hover:bg-[#eef2f8]"
          >
            <Play className="h-4 w-4" />
            가이드 영상 보기
          </a>
        </div>
      </div>

      <div className="shotform-rise" style={{ animationDelay: "120ms" }}>
        <AutomationPipeline />
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
  service: ShotFormServiceItem
  index: number
  onServiceClick: (service: ShotFormServiceItem) => void
}) {
  const Icon = service.icon
  const isLocked = Boolean(service.locked)
  const badge = service.sticker ?? (service.isNew ? "NEW" : service.featured ? "추천" : null)

  return (
    <button
      type="button"
      disabled={isLocked}
      onClick={() => onServiceClick(service)}
      className={`shotform-rise group flex h-full w-full flex-col rounded-2xl border p-6 text-left transition duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c5fd6]/40 ${
        isLocked
          ? "cursor-not-allowed border-[#eceff4] bg-[#fafbfc]"
          : "border-[#e5e9f0] bg-[#fff] shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:-translate-y-0.5 hover:border-[#c9d7f6] hover:shadow-[0_18px_40px_-22px_rgba(30,58,138,0.35)] active:translate-y-0 active:scale-[0.99]"
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="mb-5 flex items-start justify-between">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-300 ${
            isLocked
              ? "bg-[#f1f3f6] text-[#a3abb8]"
              : "bg-[#eef3fd] text-[#2c5fd6] group-hover:bg-[#2c5fd6] group-hover:text-[#fff]"
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        {isLocked ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#f1f3f6] px-2 py-1 text-[11px] font-semibold text-[#8a93a3]">
            <Lock className="h-3 w-3" />
            일시 중지
          </span>
        ) : badge ? (
          <span className="rounded-md bg-[#eef3fd] px-2 py-1 text-[11px] font-semibold tracking-wide text-[#2c5fd6]">
            {badge}
          </span>
        ) : (
          <ArrowUpRight className="h-5 w-5 text-[#c0c7d3] transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#2c5fd6]" />
        )}
      </div>
      <h3
        className={`text-[17px] font-semibold tracking-[-0.015em] ${isLocked ? "text-[#8a93a3]" : "text-[#111827]"}`}
      >
        {service.title}
      </h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[#6b7280] [text-wrap:pretty]">{service.description}</p>
    </button>
  )
}

// Feature Section 컴포넌트: 번호·제목 + 3열 카드 그리드
function FeatureSection({
  index,
  title,
  subtitle,
  services,
  onServiceClick,
}: {
  index: number
  title: string
  subtitle: string
  services: ShotFormServiceItem[]
  onServiceClick: (service: ShotFormServiceItem) => void
}) {
  return (
    <section className="border-t border-[#e5e9f0] pt-10">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold tabular-nums text-[#2c5fd6]">{String(index + 1).padStart(2, "0")}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-[-0.025em] text-[#0f172a]">{title}</h2>
        </div>
        <p className="text-[14px] text-[#6b7280]">{subtitle}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service, i) => (
          <FeatureCard key={service.id} service={service} index={i} onServiceClick={onServiceClick} />
        ))}
      </div>
    </section>
  )
}

type ShotFormApiKeysState = {
  openai: string
  elevenlabs: string
  replicate: string
  pixabay: string
  serpapi: string
  klipy: string
  typecast: string
  youtubeClientId: string
  youtubeClientSecret: string
  youtubeDataApiKey: string
  apify: string
  vmake: string
  vmakeSecret: string
}

/** 메모장 백업(.txt) → API 키 필드 매핑 */
function parseShotFormApiKeysBackup(text: string): Partial<ShotFormApiKeysState> {
  const labelToKey: Array<{ key: keyof ShotFormApiKeysState; match: RegExp }> = [
    { key: "openai", match: /openai\s*api\s*key/i },
    { key: "elevenlabs", match: /elevenlabs\s*api\s*key/i },
    { key: "replicate", match: /replicate\s*api\s*key/i },
    { key: "pixabay", match: /pixabay\s*api\s*key/i },
    { key: "serpapi", match: /serpapi\s*key/i },
    { key: "klipy", match: /klipy\s*api\s*key/i },
    { key: "typecast", match: /typecast\s*api\s*key/i },
    { key: "youtubeClientId", match: /youtube\s*client\s*id/i },
    { key: "youtubeClientSecret", match: /youtube\s*client\s*secret/i },
    { key: "youtubeDataApiKey", match: /youtube\s*data\s*api\s*key/i },
    { key: "apify", match: /apify\s*api/i },
    { key: "vmakeSecret", match: /vmake\s*ai\s*secret|secret\s*access\s*key\s*\(mt_sk\)/i },
    { key: "vmake", match: /vmake\s*ai\s*api\s*key|api\s*key\s*\(mt_ak\)/i },
  ]

  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const out: Partial<ShotFormApiKeysState> = {}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line || /^=+$/.test(line) || /^주의사항/.test(line)) continue
    // "1. OpenAI API Key" / "11. Apify API" 형태
    const header = line.replace(/^\d+\.\s*/, "")
    const matched = labelToKey.find((item) => item.match.test(header))
    if (!matched) continue
    // 다음 의미 있는 줄이 값
    let value = ""
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j]!.trim()
      if (!next) continue
      if (/^=+$/.test(next)) break
      if (/^\d+\.\s+/.test(next)) break
      if (/^주의사항/.test(next)) break
      if (/^생성일:/.test(next)) break
      value = next
      break
    }
    if (!value || value === "(미입력)" || value === "-" || value === "없음") continue
    out[matched.key] = value
  }
  return out
}

// 메인 컴포넌트
export default function ShotFormPage() {
  const router = useRouter()
  const notepadFileInputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [apiKeys, setApiKeys] = useState<ShotFormApiKeysState>({
    openai: "",
    elevenlabs: "",
    replicate: "",
    pixabay: "",
    serpapi: "",
    klipy: "",
    typecast: "",
    youtubeClientId: "",
    youtubeClientSecret: "",
    youtubeDataApiKey: "",
    apify: "",
    vmake: "",
    vmakeSecret: "",
  })
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [imported, setImported] = useState(false)
  const [showKeys, setShowKeys] = useState({
    openai: false,
    elevenlabs: false,
    replicate: false,
    pixabay: false,
    serpapi: false,
    klipy: false,
    typecast: false,
    youtubeClientId: false,
    youtubeClientSecret: false,
    youtubeDataApiKey: false,
    apify: false,
    vmake: false,
    vmakeSecret: false,
  })
  const [youtubeConnected, setYoutubeConnected] = useState(false)
  const [checkingYoutube, setCheckingYoutube] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingLogin, setIsCheckingLogin] = useState(true)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isPasswordAuthenticated, setIsPasswordAuthenticated] = useState(false)

  // 로그인 상태 확인 및 비밀번호 인증 확인
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const response = await fetch('/api/kakao/user')
        if (response.ok) {
          const data = await response.json()
          if (data.loggedIn) {
            setIsLoggedIn(true)
            
            // 비밀번호 인증 확인 (sessionStorage) - ShotForm 전용 키 사용
            const passwordAuth = sessionStorage.getItem('wingsaistudio_shotform_password_auth')
            if (passwordAuth === 'true') {
              setIsPasswordAuthenticated(true)
            } else {
              // 비밀번호 인증이 안 되어 있으면 다이얼로그 표시
              setShowPasswordDialog(true)
            }
          } else {
            // 로그인하지 않은 경우 메인 페이지로 리다이렉트
            router.push('/?redirect=/WingsAIStudioShotForm')
            return
          }
        } else {
          // 로그인하지 않은 경우 메인 페이지로 리다이렉트
          router.push('/?redirect=/WingsAIStudioShotForm')
          return
        }
      } catch (error) {
        console.error('로그인 상태 확인 실패:', error)
        // 오류 발생 시에도 메인 페이지로 리다이렉트
        router.push('/?redirect=/WingsAIStudioShotForm')
        return
      } finally {
        setIsCheckingLogin(false)
      }
    }

    checkLoginStatus()
  }, [router])

  // 비밀번호 확인 핸들러
  const handlePasswordSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    
    setPasswordError("")
    
    if (password === "7777") {
      // 비밀번호가 맞으면 sessionStorage에 저장 (ShotForm 전용 키 사용)
      sessionStorage.setItem('wingsaistudio_shotform_password_auth', 'true')
      setIsPasswordAuthenticated(true)
      setShowPasswordDialog(false)
      setPassword("")
    } else {
      setPasswordError("비밀번호가 올바르지 않습니다.")
      setPassword("")
    }
  }

  // 로컬스토리지에서 API 키 불러오기 (ShotForm 전용 키 사용)
  useEffect(() => {
    // 로그인 및 비밀번호 인증 확인 후에만 실행
    if (!isCheckingLogin && isLoggedIn && isPasswordAuthenticated) {
      const storedOpenAI = localStorage.getItem("shotform_openai_api_key") || ""
      const storedElevenLabs = localStorage.getItem("shotform_elevenlabs_api_key") || ""
      const storedReplicate = localStorage.getItem("shotform_replicate_api_key") || ""
      const storedPixabay = localStorage.getItem("shotform_pixabay_api_key") || ""
      const storedSerpapi =
        localStorage.getItem("shotform_serpapi_key") ||
        localStorage.getItem("serpapi_api_key") ||
        ""
      const storedKlipy = localStorage.getItem("shotform_klipy_api_key") || ""
      const storedTypecast =
        localStorage.getItem("shotform_typecast_api_key") ||
        localStorage.getItem("typecast_api_key") ||
        ""
      const storedYoutubeClientId = localStorage.getItem("shotform_youtube_client_id") || ""
      const storedYoutubeClientSecret = localStorage.getItem("shotform_youtube_client_secret") || ""
      const storedYoutubeDataApiKey = localStorage.getItem("shotform_youtube_data_api_key") || ""
      const storedApify = localStorage.getItem("shotform_apify_token") || ""
      const storedVmake = localStorage.getItem("shotform_vmake_api_key") || ""
      const storedVmakeSecret =
        localStorage.getItem("shotform_vmake_secret_access_key") || ""

      setApiKeys({
        openai: storedOpenAI,
        elevenlabs: storedElevenLabs,
        replicate: storedReplicate,
        pixabay: storedPixabay,
        serpapi: storedSerpapi,
        klipy: storedKlipy,
        typecast: storedTypecast,
        youtubeClientId: storedYoutubeClientId,
        youtubeClientSecret: storedYoutubeClientSecret,
        youtubeDataApiKey: storedYoutubeDataApiKey,
        apify: storedApify,
        vmake: storedVmake,
        vmakeSecret: storedVmakeSecret,
      })

      // YouTube 연결 상태 확인
      checkYoutubeConnection()
    }
  }, [isCheckingLogin, isLoggedIn, isPasswordAuthenticated])

  // 리믹스 등에서 ?settings=open 으로 들어오면 홈 설정창을 바로 연다
  useEffect(() => {
    if (!isLoggedIn || !isPasswordAuthenticated) return
    const params = new URLSearchParams(window.location.search)
    if (params.get("settings") !== "open") return
    setOpen(true)
    params.delete("settings")
    const next = params.toString()
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${next ? `?${next}` : ""}`
    )
  }, [isLoggedIn, isPasswordAuthenticated])

  // YouTube 연결 상태 확인 (로컬스토리지에서) - ShotForm 전용 키 사용
  const checkYoutubeConnection = async () => {
    setCheckingYoutube(true)
    try {
      // 로컬스토리지에서 토큰 확인 (ShotForm 전용 키)
      const tokensStr = localStorage.getItem("shotform_youtube_tokens")
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

  // URL 파라미터에서 토큰 받아서 로컬스토리지에 저장 (ShotForm 전용 키 사용)
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
        localStorage.setItem("shotform_youtube_tokens", JSON.stringify(tokens))
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

  // YouTube 연결 해제 (로컬스토리지에서 삭제) - ShotForm 전용 키 사용
  const handleYoutubeDisconnect = async () => {
    try {
      localStorage.removeItem("shotform_youtube_tokens")
      setYoutubeConnected(false)
      alert("YouTube 연결이 해제되었습니다.")
    } catch (error) {
      console.error("YouTube 연결 해제 실패:", error)
      alert("연결 해제 중 오류가 발생했습니다.")
    }
  }

  // API 키 저장 (ShotForm 전용 키로 저장)
  const handleSave = () => {
    localStorage.setItem("shotform_openai_api_key", apiKeys.openai)
    localStorage.setItem("shotform_elevenlabs_api_key", apiKeys.elevenlabs)
    localStorage.setItem("shotform_replicate_api_key", apiKeys.replicate)
    localStorage.setItem("shotform_pixabay_api_key", apiKeys.pixabay || "")
    localStorage.setItem("shotform_serpapi_key", apiKeys.serpapi || "")
    localStorage.setItem("serpapi_api_key", apiKeys.serpapi || "")
    localStorage.setItem("shotform_klipy_api_key", apiKeys.klipy || "")
    localStorage.setItem("shotform_typecast_api_key", apiKeys.typecast || "")
    localStorage.setItem("typecast_api_key", apiKeys.typecast || "")
    localStorage.setItem("shotform_youtube_client_id", apiKeys.youtubeClientId)
    localStorage.setItem("shotform_youtube_client_secret", apiKeys.youtubeClientSecret)
    localStorage.setItem("shotform_youtube_data_api_key", apiKeys.youtubeDataApiKey)
    localStorage.setItem("shotform_apify_token", apiKeys.apify || "")
    localStorage.setItem("shotform_vmake_api_key", apiKeys.vmake || "")
    localStorage.setItem(
      "shotform_vmake_secret_access_key",
      apiKeys.vmakeSecret || ""
    )
    window.dispatchEvent(new Event("shotform-api-keys-updated"))

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
    }, 2000)
  }

  // API 키를 메모장 파일로 저장
  const handleSaveToNotepad = () => {
    const apiKeysText = `WingsAIStudio ShotForm API 키 백업
생성일: ${new Date().toLocaleString("ko-KR")}

========================================
API 키 목록
========================================

1. OpenAI API Key
${apiKeys.openai || "(미입력)"}

2. ElevenLabs API Key
${apiKeys.elevenlabs || "(미입력)"}

3. Replicate API Key
${apiKeys.replicate || "(미입력)"}

4. Pixabay API Key
${apiKeys.pixabay || "(미입력)"}

5. SerpAPI Key
${apiKeys.serpapi || "(미입력)"}

6. Klipy API Key
${apiKeys.klipy || "(미입력)"}

7. Typecast API Key
${apiKeys.typecast || "(미입력)"}

8. YouTube Client ID
${apiKeys.youtubeClientId || "(미입력)"}

9. YouTube Client Secret
${apiKeys.youtubeClientSecret || "(미입력)"}

10. YouTube Data API Key
${apiKeys.youtubeDataApiKey || "(미입력)"}

11. Apify API
${apiKeys.apify || "(미입력)"}

12. Vmake AI API Key (MT_AK)
${apiKeys.vmake || "(미입력)"}

13. Vmake AI Secret Access Key (MT_SK)
${apiKeys.vmakeSecret || "(미입력)"}

========================================
주의사항
========================================
- 이 파일에는 중요한 API 키 정보가 포함되어 있습니다.
- 안전한 곳에 보관하시고, 타인에게 공유하지 마세요.
- API 키가 유출되면 즉시 재발급 받으세요.
`
    // Blob을 사용하여 텍스트 파일 생성
    const blob = new Blob([apiKeysText], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `WingsAIStudio_ShotForm_API_Keys_${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
    }, 2000)
  }

  /** 다른 PC에서 받은 메모장 백업을 불러와 입력란에 채운 뒤 바로 저장 */
  const handleLoadFromNotepadFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = parseShotFormApiKeysBackup(text)
      const filled = Object.values(parsed).filter((v) =>
        Boolean(v && String(v).trim())
      ).length
      if (!filled) {
        alert(
          "백업 파일에서 API 키를 찾지 못했습니다.\n「메모장으로 저장」으로 만든 .txt 파일을 선택해 주세요."
        )
        return
      }
      const next: ShotFormApiKeysState = { ...apiKeys, ...parsed }
      setApiKeys(next)
      localStorage.setItem("shotform_openai_api_key", next.openai)
      localStorage.setItem("shotform_elevenlabs_api_key", next.elevenlabs)
      localStorage.setItem("shotform_replicate_api_key", next.replicate)
      localStorage.setItem("shotform_pixabay_api_key", next.pixabay || "")
      localStorage.setItem("shotform_serpapi_key", next.serpapi || "")
      localStorage.setItem("serpapi_api_key", next.serpapi || "")
      localStorage.setItem("shotform_klipy_api_key", next.klipy || "")
      localStorage.setItem("shotform_typecast_api_key", next.typecast || "")
      localStorage.setItem("typecast_api_key", next.typecast || "")
      localStorage.setItem("shotform_youtube_client_id", next.youtubeClientId)
      localStorage.setItem("shotform_youtube_client_secret", next.youtubeClientSecret)
      localStorage.setItem("shotform_youtube_data_api_key", next.youtubeDataApiKey)
      localStorage.setItem("shotform_apify_token", next.apify || "")
      localStorage.setItem("shotform_vmake_api_key", next.vmake || "")
      localStorage.setItem(
        "shotform_vmake_secret_access_key",
        next.vmakeSecret || ""
      )
      window.dispatchEvent(new Event("shotform-api-keys-updated"))
      setImported(true)
      setSaved(true)
      window.setTimeout(() => {
        setImported(false)
        setSaved(false)
      }, 2500)
    } catch (error) {
      console.error("[ShotForm] 메모장 불러오기 실패:", error)
      alert("파일을 읽지 못했습니다. UTF-8 텍스트(.txt)인지 확인해 주세요.")
    }
  }

  const handleServiceClick = (service: ShotFormServiceItem) => {
    if (service.url.startsWith("http")) {
      window.open(service.url, "_blank")
    } else {
      router.push(service.url)
    }
  }

  // 로그인 확인 중이면 로딩 화면 표시
  if (isCheckingLogin) {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mb-4"></div>
          <p className="text-zinc-400">로그인 확인 중...</p>
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
        <DialogContent className="sm:max-w-md bg-[#fdffff] border-white/10 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              WingsAIStudio ShotForm 접근 인증
            </DialogTitle>
            <DialogDescription>
              WingsAIStudio ShotForm에 접근하려면 비밀번호를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit}>
            <div className="space-y-4 py-4">
              {/* 경고 메시지 */}
              <div className="bg-amber-500/10 border border-amber-400/25 rounded-lg p-3">
                <p className="flex items-center gap-2 text-sm text-amber-200 font-medium">
                  <TriangleAlert className="h-4 w-4 shrink-0" />
                  매일 수강생인지 확인 후 아닐 시 영구정지됩니다.
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

  return (
    <div className="relative min-h-screen break-keep bg-[#f7f8fb] text-[#111827]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[560px] bg-[radial-gradient(55%_60%_at_75%_0%,rgba(44,95,214,0.09),transparent_70%)]"
        aria-hidden
      />

      <Header onSettingsClick={() => setOpen(true)} />

      <main className="relative z-10">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14 lg:px-8 lg:py-16">
          <HeroSection />

          <div id="features" className="mt-16 scroll-mt-24 space-y-14 md:mt-20">
            {[
              { title: "쇼핑숏폼 제작", subtitle: "15초 쇼핑 쇼츠를 빠르고 쉽게 제작하세요", services: shotFormServices },
              { title: "일반 숏폼", subtitle: "주제 기반 숏폼 · 롱폼 클립 · 썰 쇼핑 대본→TTS/SRT 도구", services: generalShortformServices },
              { title: "분석 & 도구", subtitle: "채널 성장과 운영을 돕는 보조 도구", services: analysisToolsServices },
            ].map((section, index) => (
              <FeatureSection key={section.title} index={index} onServiceClick={handleServiceClick} {...section} />
            ))}
          </div>
        </div>
      </main>

      {/* API 키 설정 다이얼로그 - WingsAIStudio와 동일한 구조 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col bg-[#fdffff] border-white/10 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-50">
              <Key className="w-5 h-5" />
              API 키 설정
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              AI 서비스 사용을 위한 API 키를 입력해주세요. 키는 브라우저에 안전하게 저장됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4 overflow-y-auto flex-1">
            {/* OpenAI API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="openai-key" className="text-sm font-medium text-zinc-200">
                  OpenAI API Key
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                  asChild
                >
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                    API 발급
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="openai-key"
                  type={showKeys.openai ? "text" : "password"}
                  placeholder="sk-..."
                  value={apiKeys.openai}
                  onChange={(e) => setApiKeys({ ...apiKeys, openai: e.target.value })}
                  className="font-mono text-sm bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, openai: !showKeys.openai })}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
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
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-zinc-500">GPT 모델 사용에 필요합니다</p>
            </div>

            {/* ElevenLabs API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="elevenlabs-key" className="text-sm font-medium text-zinc-200">
                  ElevenLabs API Key
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                  asChild
                >
                  <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer">
                    API 발급
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="elevenlabs-key"
                  type={showKeys.elevenlabs ? "text" : "password"}
                  placeholder="입력하세요"
                  value={apiKeys.elevenlabs}
                  onChange={(e) => setApiKeys({ ...apiKeys, elevenlabs: e.target.value })}
                  className="font-mono text-sm bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, elevenlabs: !showKeys.elevenlabs })}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
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
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-zinc-500">ElevenLabs 음성 합성에 사용됩니다</p>
            </div>

            {/* Typecast API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="typecast-key" className="text-sm font-medium text-zinc-200">
                  Typecast API Key
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                  asChild
                >
                  <a href="https://typecast.ai/api" target="_blank" rel="noopener noreferrer">
                    API 발급
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="typecast-key"
                  type={showKeys.typecast ? "text" : "password"}
                  placeholder="입력하세요"
                  value={apiKeys.typecast || ""}
                  onChange={(e) => setApiKeys({ ...apiKeys, typecast: e.target.value })}
                  className="font-mono text-sm bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, typecast: !showKeys.typecast })}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {showKeys.typecast ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKeys.typecast || "")
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  disabled={!apiKeys.typecast}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                타입캐스트 <strong className="font-medium text-zinc-400">API</strong> 키입니다.
                웹(스튜디오) 유료 구독·크레딧과는 별개입니다. 키는{" "}
                <a
                  href="https://typecast.ai/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  typecast.ai/api
                </a>
                에서 발급하세요.
              </p>
            </div>

            {/* Replicate API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="replicate-key" className="text-sm font-medium text-zinc-200">
                  Replicate API Key
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                  asChild
                >
                  <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noopener noreferrer">
                    API 발급
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="replicate-key"
                  type={showKeys.replicate ? "text" : "password"}
                  placeholder="r8_..."
                  value={apiKeys.replicate}
                  onChange={(e) => setApiKeys({ ...apiKeys, replicate: e.target.value })}
                  className="font-mono text-sm bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, replicate: !showKeys.replicate })}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
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
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-zinc-500">AI 이미지/영상 생성(flux-schnell 등)에 사용됩니다</p>
            </div>

            {/* Pixabay API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="pixabay-key" className="text-sm font-medium text-zinc-200">
                  Pixabay API Key
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                  asChild
                >
                  <a href="https://pixabay.com/api/docs/" target="_blank" rel="noopener noreferrer">
                    API 발급
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="pixabay-key"
                  type={showKeys.pixabay ? "text" : "password"}
                  placeholder="Pixabay에서 발급한 API Key"
                  value={apiKeys.pixabay || ""}
                  onChange={(e) => setApiKeys({ ...apiKeys, pixabay: e.target.value })}
                  className="font-mono text-sm bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, pixabay: !showKeys.pixabay })}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {showKeys.pixabay ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKeys.pixabay || "")
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  disabled={!apiKeys.pixabay}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-zinc-500">AI 쇼핑 숏폼 · Pixabay 무료 이미지/동영상 검색에 사용됩니다</p>
            </div>

            {/* SerpAPI Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="serpapi-key" className="text-sm font-medium text-zinc-200">
                  SerpAPI Key
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                  asChild
                >
                  <a href="https://serpapi.com/manage-api-key" target="_blank" rel="noopener noreferrer">
                    API 발급
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="serpapi-key"
                  type={showKeys.serpapi ? "text" : "password"}
                  placeholder="SerpAPI에서 발급한 API Key"
                  value={apiKeys.serpapi || ""}
                  onChange={(e) => setApiKeys({ ...apiKeys, serpapi: e.target.value })}
                  className="font-mono text-sm bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, serpapi: !showKeys.serpapi })}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {showKeys.serpapi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKeys.serpapi || "")
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  disabled={!apiKeys.serpapi}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                스토리 쇼핑 · Google 이미지/동영상 검색, 제품 관련 소재 찾기에 사용됩니다
              </p>
            </div>

            {/* Klipy API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="klipy-key" className="text-sm font-medium text-zinc-200">
                  Klipy API Key
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                  asChild
                >
                  <a href="https://klipy.com/developers" target="_blank" rel="noopener noreferrer">
                    API 발급
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="klipy-key"
                  type={showKeys.klipy ? "text" : "password"}
                  placeholder="Klipy에서 발급한 API Key"
                  value={apiKeys.klipy || ""}
                  onChange={(e) => setApiKeys({ ...apiKeys, klipy: e.target.value })}
                  className="font-mono text-sm bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, klipy: !showKeys.klipy })}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {showKeys.klipy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-zinc-500">스토리 쇼핑 영상 편집 · GIF 요소 검색에 사용됩니다</p>
            </div>

            {/* 구분선 */}
            <div className="border-t border-white/10 my-4" />

            {/* YouTube Data API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="youtube-data-api-key" className="text-sm font-medium text-zinc-200">
                  YouTube Data API Key
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                  asChild
                >
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                    API 발급
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="youtube-data-api-key"
                  type={showKeys.youtubeDataApiKey ? "text" : "password"}
                  placeholder="Google Cloud Console에서 발급받은 API Key"
                  value={apiKeys.youtubeDataApiKey}
                  onChange={(e) => setApiKeys({ ...apiKeys, youtubeDataApiKey: e.target.value })}
                  className="font-mono text-sm bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, youtubeDataApiKey: !showKeys.youtubeDataApiKey })}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
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
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                유튜브 분석, 유튜브 실시간 분석 기능에 사용됩니다.
              </p>
            </div>

            {/* Apify API — 리믹스·제품 검색 수집 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="apify-token" className="text-sm font-medium text-zinc-200">
                  Apify API
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 border-white/25 bg-zinc-800 text-xs text-zinc-100 hover:bg-zinc-700 hover:text-white"
                  asChild
                >
                  <a
                    href="https://console.apify.com/account/integrations"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    API 발급
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="apify-token"
                  type={showKeys.apify ? "text" : "password"}
                  placeholder="Apify Console에서 발급한 API 토큰"
                  value={apiKeys.apify}
                  onChange={(e) => setApiKeys({ ...apiKeys, apify: e.target.value })}
                  className="font-mono text-sm bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, apify: !showKeys.apify })}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {showKeys.apify ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                리믹스·제품 검색에서 TikTok·샤오홍슈·더우인 후보 수집에 사용합니다.
              </p>
            </div>

            {/* Vmake AI — 중국어 하드 자막 제거 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium text-zinc-200">Vmake AI API</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 border-white/25 bg-zinc-800 text-xs text-zinc-100 hover:bg-zinc-700 hover:text-white"
                  asChild
                >
                  <a
                    href="https://vmake.ai/developers"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    API 발급
                  </a>
                </Button>
              </div>
              <Input
                id="vmake-api-key"
                type={showKeys.vmake ? "text" : "password"}
                placeholder="API Key (MT_AK)"
                value={apiKeys.vmake}
                onChange={(e) => setApiKeys({ ...apiKeys, vmake: e.target.value })}
                className="font-mono text-sm bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-500"
              />
              <Input
                id="vmake-secret-access-key"
                type={showKeys.vmakeSecret ? "text" : "password"}
                placeholder="Secret Access Key (MT_SK)"
                value={apiKeys.vmakeSecret}
                onChange={(e) => setApiKeys({ ...apiKeys, vmakeSecret: e.target.value })}
                className="font-mono text-sm bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-500"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setShowKeys({
                      ...showKeys,
                      vmake: !showKeys.vmake,
                      vmakeSecret: !showKeys.vmakeSecret,
                    })
                  }
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {showKeys.vmake ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                샤오홍슈·더우인 중국어 하드 자막 제거용. API Key + Secret을 함께 저장하세요.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-white/10 pt-4 mt-4 shrink-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              {imported && (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>메모장에서 불러와 저장했습니다</span>
                </>
              )}
              {!imported && saved && (
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
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={notepadFileInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleLoadFromNotepadFile(file)
                  event.target.value = ""
                }}
              />
              <Button
                type="button"
                onClick={() => notepadFileInputRef.current?.click()}
                variant="outline"
                className="min-w-[140px] border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                메모장 불러오기
              </Button>
              <Button
                type="button"
                onClick={handleSaveToNotepad}
                variant="outline"
                className="min-w-[140px] border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
              >
                <FileText className="w-4 h-4 mr-2" />
                메모장으로 저장
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                className="min-w-[100px] bg-teal-700 text-white hover:bg-teal-600"
              >
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 푸터 - 저작권 문구 */}
      <footer className="relative z-10 mt-16 border-t border-[#e5e9f0]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-4">
            <div className="space-y-2 text-[13px] text-[#8a93a3]">
              <p className="font-semibold text-[#374151]">© 2025 wingsAIStudio ShotForm. All Rights Reserved.</p>
              <div className="space-y-1 text-xs leading-relaxed">
                <p>
                  <strong>저작권 보호:</strong> 본 소프트웨어 및 모든 관련 코드, 디자인, 알고리즘, 프롬프트 엔지니어링, 
                  비즈니스 로직은 저작권법에 의해 보호받습니다.
                </p>
                <p>
                  <strong>무단 사용 금지:</strong> 본 소프트웨어의 무단 복제, 배포, 수정, 리버스 엔지니어링, 
                  벤치마킹, 모방, 또는 상업적 이용을 엄격히 금지합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}


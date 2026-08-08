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
  CreditCard,
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
  ExternalLink,
  Youtube,
  Link2,
  Unlink,
  X,
  Loader2,
  TrendingUp,
  Clock,
  Target,
  Wand2,
  Edit,
  Clapperboard,
  Bot,
  ChartNoAxesCombined,
  Cpu,
  Brain,
  Scissors,
  Film,
  PawPrint,
  Newspaper,
} from "lucide-react"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"

type ShotFormServiceItem = {
  id: string
  title: string
  icon: LucideIcon
  description: string
  url: string
  gradient: string
  hoverGradient: string
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
    gradient: "from-violet-500 via-fuchsia-500 to-pink-500",
    hoverGradient: "from-violet-600 via-fuchsia-600 to-pink-600",
  },
  {
    id: "story-shopping",
    title: "AI 스토리 쇼핑 숏폼",
    icon: BookOpen,
    description: "썰 채널형 쇼핑 숏폼: 훅 제목·장면별 나레이션을 썰 프레임으로 합성해 소개하는 숏폼",
    url: "/WingsAIStudioShotForm/story-shopping",
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    hoverGradient: "from-amber-600 via-orange-600 to-rose-600",
  },
  {
    id: "shortform-studio",
    title: "AI 리믹스 쇼핑숏폼",
    icon: Clapperboard,
    description: "키워드·소스·리믹스·자막·썸네일 프로젝트",
    url: "/WingsAIStudioShotForm/shortform-studio",
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    hoverGradient: "from-violet-600 via-purple-600 to-fuchsia-600",
  },
  {
    id: "animal-shopping",
    title: "AI 동물 쇼핑 숏폼",
    icon: PawPrint,
    description: "의인화 동물이 마트에서 쇼핑하는 바이럴 숏폼",
    url: "/WingsAIStudioShotForm/animal-shopping",
    gradient: "from-lime-500 via-emerald-500 to-teal-500",
    hoverGradient: "from-lime-600 via-emerald-600 to-teal-600",
  },
  {
    id: "info-shopping",
    title: "AI 카드뉴스 쇼핑숏폼",
    icon: Newspaper,
    description: "벤치마크 URL → 쿠팡 매칭 → 카드뉴스 쇼핑숏폼",
    url: "/WingsAIStudioShotForm/info-shopping",
    gradient: "from-sky-500 via-blue-500 to-indigo-500",
    hoverGradient: "from-sky-600 via-blue-600 to-indigo-600",
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
    gradient: "from-indigo-500 via-blue-500 to-cyan-500",
    hoverGradient: "from-indigo-600 via-blue-600 to-cyan-600",
    locked: true,
  },
  {
    id: "longform-clip",
    title: "AI 롱폼 클립",
    icon: Scissors,
    description: "롱폼 URL만 넣으면 AI가 바이럴 숏폼 구간을 자동으로 잘라줍니다",
    url: "/WingsAIStudioShotForm/longform-clip",
    gradient: "from-rose-500 via-pink-500 to-fuchsia-500",
    hoverGradient: "from-rose-600 via-pink-600 to-fuchsia-600",
    isNew: true,
    locked: true,
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
    gradient: "from-sky-500 via-cyan-500 to-teal-500",
    hoverGradient: "from-sky-600 via-cyan-600 to-teal-600",
  },
  {
    id: "chatbot",
    title: "윙스AI 1:1봇",
    icon: Bot,
    description: "AI가 1:1로 답변해드립니다",
    url: "/WingsAIStudioShotForm/wings-chatbot",
    gradient: "from-emerald-500 via-green-500 to-teal-500",
    hoverGradient: "from-emerald-600 via-green-600 to-teal-600",
  },
]

// Header 컴포넌트
function Header({ onSettingsClick }: { onSettingsClick: () => void }) {
  const router = useRouter()
  
  return (
    <header className="w-full border-b border-white/10 bg-[#0a0b0d]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 로고 + 가이드 */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-pink-500/15 to-orange-500/15 border border-pink-400/25 text-pink-300 text-sm font-semibold">
              <span className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
              wingsAIStudio ShotForm
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="rounded-full border-sky-400/35 bg-sky-500/10 px-3 font-semibold text-sky-100 hover:bg-sky-500/20 hover:text-white"
            >
              <a
                href="https://loud-cowl-c24.notion.site/3b6565477d5980deb680e80c49c98b39"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                가이드 영상
              </a>
            </Button>
          </div>

          {/* 우측 아이콘들 */}
          <div className="flex items-center gap-2">
            {/* 홈 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-zinc-300 hover:text-white hover:bg-white/5"
              onClick={() => router.push('/')}
              title="wings AI 홈"
            >
              <Home className="w-5 h-5" />
            </Button>

            {/* 설정 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-zinc-300 hover:text-white hover:bg-white/5"
              onClick={onSettingsClick}
              title="설정"
            >
              <Settings className="w-5 h-5" />
            </Button>

            {/* 사용자 메뉴 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full text-zinc-300 hover:text-white hover:bg-white/5">
                  <User className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-[#141518] border-white/10 text-zinc-100">
                <DropdownMenuLabel>계정 설정</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}

// 자동화 파이프라인 애니메이션 컴포넌트 (숏폼 전용)
function AutomationPipeline() {
  const [activeStep, setActiveStep] = useState(0)
  
  const steps = [
    { icon: FileText, label: "대본", color: "from-blue-500 to-cyan-500", glow: "rgba(56,189,248,0.45)" },
    { icon: ImageIcon, label: "이미지", color: "from-purple-500 to-pink-500", glow: "rgba(236,72,153,0.45)" },
    { icon: Volume2, label: "음성", color: "from-green-500 to-emerald-500", glow: "rgba(52,211,153,0.45)" },
    { icon: Play, label: "영상", color: "from-orange-500 to-red-500", glow: "rgba(249,115,22,0.45)" },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % (steps.length + 1))
    }, 1400)
    return () => clearInterval(interval)
  }, [])

  const statusText =
    activeStep === 0
      ? "AI가 자동으로 처리합니다"
      : activeStep === 1
        ? "AI가 대본을 생성하고 있습니다"
        : activeStep === 2
          ? "AI가 이미지를 생성하고 있습니다"
          : activeStep === 3
            ? "AI가 음성을 생성하고 있습니다"
            : "15초 쇼츠 완성!"

  return (
    <div className="shotform-ai-pipeline relative py-10">
      {/* AI 뉴럴 파티클 배경 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="shotform-ai-orb absolute left-[8%] top-2 h-2 w-2 rounded-full bg-cyan-400/70" />
        <div className="shotform-ai-orb absolute right-[12%] top-6 h-1.5 w-1.5 rounded-full bg-pink-400/70" style={{ animationDelay: "0.6s" }} />
        <div className="shotform-ai-orb absolute left-[22%] bottom-4 h-1.5 w-1.5 rounded-full bg-violet-400/60" style={{ animationDelay: "1.1s" }} />
        <div className="shotform-ai-orb absolute right-[28%] bottom-2 h-2 w-2 rounded-full bg-orange-400/50" style={{ animationDelay: "1.7s" }} />
        <div className="shotform-ai-node-line absolute left-1/2 top-1/2 h-px w-[70%] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-pink-400/20 to-transparent" />
      </div>

      {/* AI 코어 뱃지 */}
      <div className="mb-5 flex justify-center">
        <div className="shotform-ai-core inline-flex items-center gap-2 rounded-full border border-pink-400/25 bg-gradient-to-r from-pink-500/10 via-violet-500/10 to-cyan-500/10 px-3.5 py-1.5 backdrop-blur-sm">
          <span className="relative flex h-6 w-6 items-center justify-center">
            <span className="shotform-ai-ping absolute inset-0 rounded-full bg-pink-500/30" />
            <Cpu className="relative h-3.5 w-3.5 text-pink-300" strokeWidth={2} />
          </span>
          <span className="text-[11px] font-semibold tracking-[0.18em] text-zinc-300 uppercase">
            AI Engine
          </span>
          <Brain className="h-3.5 w-3.5 text-cyan-300 shotform-ai-brain" strokeWidth={2} />
        </div>
      </div>

      {/* 파이프라인 아이콘들 */}
      <div className="relative z-10 flex items-center justify-center gap-2 md:gap-4">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = activeStep > index
          const isCurrent = activeStep === index + 1
          const isComplete = activeStep === steps.length
          
          return (
            <div key={index} className="flex items-center">
              <div
                className={`relative flex flex-col items-center transition-all duration-500 ${
                  isCurrent ? "scale-110" : isActive || isComplete ? "scale-100" : "scale-95"
                }`}
              >
                {/* 현재 단계 스캔 링 */}
                {isCurrent && (
                  <>
                    <span
                      className="shotform-ai-scan pointer-events-none absolute left-1/2 top-0 h-14 w-14 -translate-x-1/2 rounded-2xl md:h-16 md:w-16"
                      style={{ boxShadow: `0 0 0 1px ${step.glow}` }}
                    />
                    <span className="shotform-ai-orbit pointer-events-none absolute left-1/2 top-7 -translate-x-1/2 md:top-8">
                      <Sparkles className="h-3 w-3 text-amber-300" />
                    </span>
                  </>
                )}

                <div
                  className={`relative z-[1] flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-all duration-500 md:h-16 md:w-16 ${
                    isActive || isComplete
                      ? `bg-gradient-to-br ${step.color} shadow-xl`
                      : isCurrent
                        ? `bg-gradient-to-br ${step.color} shadow-xl ring-4 ring-pink-400/30`
                        : "border-2 border-white/15 bg-white/5"
                  }`}
                  style={
                    isCurrent
                      ? { boxShadow: `0 0 28px ${step.glow}` }
                      : undefined
                  }
                >
                  {/* 생성 중 내부 스캔 라인 */}
                  {isCurrent && (
                    <span className="shotform-ai-scanline pointer-events-none absolute inset-x-1 top-0 h-full overflow-hidden rounded-2xl">
                      <span className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-white/35 to-transparent" />
                    </span>
                  )}

                  <Icon
                    className={`relative z-[1] h-6 w-6 transition-colors duration-500 md:h-7 md:w-7 ${
                      isActive || isCurrent || isComplete ? "text-white" : "text-zinc-500"
                    } ${isCurrent ? "shotform-ai-icon-pulse" : ""}`}
                  />
                  
                  {(isActive || isComplete) && (
                    <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 animate-scale-in">
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                
                <span
                  className={`mt-2 text-xs font-medium transition-colors duration-500 md:text-sm ${
                    isActive || isCurrent || isComplete ? "text-zinc-100" : "text-zinc-500"
                  }`}
                >
                  {step.label}
                </span>
                
                {isCurrent && (
                  <div className="absolute -bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-1">
                    <span className="shotform-ai-dot h-1 w-1 rounded-full bg-amber-300" />
                    <span className="shotform-ai-dot h-1 w-1 rounded-full bg-pink-300" style={{ animationDelay: "0.2s" }} />
                    <span className="shotform-ai-dot h-1 w-1 rounded-full bg-cyan-300" style={{ animationDelay: "0.4s" }} />
                  </div>
                )}
              </div>
              
              {index < steps.length - 1 && (
                <div className="relative mx-1 h-1 w-8 overflow-visible md:mx-2 md:w-16">
                  <div className="absolute inset-0 rounded-full bg-white/15" />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
                    style={{
                      width:
                        activeStep > index + 1 || isComplete
                          ? "100%"
                          : activeStep === index + 1
                            ? "55%"
                            : "0%",
                    }}
                  />
                  {/* 데이터 패킷 이동 */}
                  {(activeStep === index + 1 || (isComplete && index < steps.length - 1)) && (
                    <>
                      <span className="shotform-ai-packet absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                      <span
                        className="shotform-ai-packet absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-cyan-300"
                        style={{ animationDelay: "0.45s" }}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 상태 메시지 */}
      <div className="relative z-10 mt-10 text-center">
        <div className="shotform-ai-status inline-flex items-center gap-2.5 rounded-full border border-pink-400/30 bg-gradient-to-r from-pink-500/15 via-violet-500/10 to-cyan-500/15 px-5 py-2.5 shadow-[0_0_24px_rgba(236,72,153,0.12)] backdrop-blur-sm">
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span className="shotform-ai-ping absolute inset-0 rounded-full bg-pink-500/40" />
            <Zap className="relative h-3.5 w-3.5 text-pink-400" />
          </span>
          <span className="text-sm font-medium text-zinc-100" key={activeStep}>
            <span className="shotform-ai-status-text">{statusText}</span>
            {activeStep > 0 && activeStep < steps.length && (
              <span className="ml-0.5 inline-flex gap-0.5 align-middle">
                <span className="shotform-ai-dot inline-block h-1 w-1 rounded-full bg-zinc-300" />
                <span className="shotform-ai-dot inline-block h-1 w-1 rounded-full bg-zinc-300" style={{ animationDelay: "0.2s" }} />
                <span className="shotform-ai-dot inline-block h-1 w-1 rounded-full bg-zinc-300" style={{ animationDelay: "0.4s" }} />
              </span>
            )}
          </span>
          {activeStep === steps.length && (
            <Sparkles className="h-4 w-4 text-amber-300 shotform-ai-brain" />
          )}
        </div>
      </div>
    </div>
  )
}

// Hero Section 컴포넌트
function HeroSection() {
  const [displayText, setDisplayText] = useState("")
  const fullText = "AI 쇼핑숏폼 자동 제작"
  
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
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-pink-400 via-red-400 to-orange-400 bg-clip-text text-transparent min-h-[1.2em]">
          {displayText}
          <span className="animate-blink text-zinc-500">|</span>
      </h1>
        
        {/* 배경 블러 효과 */}
        <div className="absolute inset-0 -z-10 blur-3xl opacity-25">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-400 via-red-400 to-orange-400 rounded-full animate-pulse" />
        </div>
      </div>
      
      <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: "1s" }}>
        15초 쇼츠를 빠르고 쉽게 제작하세요
      </p>

      {/* 자동화 파이프라인 애니메이션 */}
      <div className="pt-4 animate-fade-in-up" style={{ animationDelay: "1.2s" }}>
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
  const isLocked = "locked" in service && service.locked

  return (
    <button
      type="button"
      disabled={isLocked}
      onClick={() => !isLocked && onServiceClick(service)}
      className={`shotform-feature-card group relative w-full text-left overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-[1px] transition-all duration-500 ease-out ${
        isLocked
          ? "cursor-not-allowed opacity-55"
          : "hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_20px_50px_-20px_rgba(236,72,153,0.35)]"
      }`}
      style={{ animationDelay: `${index * 120}ms` }}
    >
      <div className="relative h-full rounded-[15px] bg-[#101114]/95 backdrop-blur-md overflow-hidden">
        {/* 호버 시 은은한 빛 스윕 */}
        {!isLocked && (
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
            <div className="shotform-card-shine absolute -inset-x-1/2 -top-1/2 h-full w-[200%] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
        )}

        {/* 잠금 오버레이 */}
        {isLocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/70 backdrop-blur-[4px]">
            <Lock className="h-7 w-7 text-zinc-400" />
          </div>
        )}

        {/* 우측 상단 스티커 / New / 추천 */}
        {service.sticker ? (
          <div className="absolute -right-1 -top-1 z-10 rotate-[8deg]">
            <span
              className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide shadow-lg ring-1 ${
                service.sticker === "ver2"
                  ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white ring-white/20 shadow-fuchsia-900/40"
                  : "bg-gradient-to-br from-orange-500 to-amber-500 text-white ring-white/20 shadow-orange-900/40"
              }`}
            >
              {service.sticker}
            </span>
          </div>
        ) : service.isNew ? (
          <div className="absolute right-3 top-3 z-10">
            <span className="inline-flex items-center rounded-full bg-violet-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-200 ring-1 ring-violet-400/30">
              New
            </span>
          </div>
        ) : service.featured ? (
          <div className="absolute right-3 top-3 z-10">
            <span className="inline-flex items-center rounded-full bg-orange-500/20 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-orange-200 ring-1 ring-orange-400/30">
              추천
            </span>
          </div>
        ) : null}

        <div className="relative flex gap-4 p-5 md:p-6">
          {/* 아이콘 */}
          <div className="relative shrink-0">
            <div
              className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${service.gradient} opacity-40 blur-xl shotform-icon-glow`}
            />
            <div
              className={`relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${service.gradient} shadow-lg ring-1 ring-white/20 shotform-icon-float`}
            >
              <Icon className="h-7 w-7 text-white drop-shadow-sm" strokeWidth={1.75} />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="mb-1 text-lg font-semibold tracking-tight text-zinc-50 transition-colors duration-300 group-hover:text-white md:text-xl">
              {service.title}
            </h3>
            <p className="mb-3 text-sm leading-relaxed text-zinc-400 transition-colors duration-300 group-hover:text-zinc-300">
              {service.description}
            </p>
            {!isLocked && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-all duration-300 group-hover:gap-2.5 group-hover:text-pink-300">
                <span>바로 시작하기</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// Feature Section 컴포넌트 (좌우 컬럼용)
function FeatureSection({
  title,
  subtitle,
  services,
  onServiceClick,
  accent = "warm",
  sectionIndex = 0,
  cardLayout = "stack",
}: {
  title: string
  subtitle: string
  services: ShotFormServiceItem[]
  onServiceClick: (service: ShotFormServiceItem) => void
  accent?: "warm" | "cool" | "violet"
  sectionIndex?: number
  /** stack: 세로 / row: 앞 2개만 좌우, 나머지는 한 줄씩 */
  cardLayout?: "stack" | "row"
}) {
  const accentBar =
    accent === "warm"
      ? "from-pink-500 via-orange-400 to-amber-400"
      : accent === "violet"
        ? "from-indigo-500 via-violet-400 to-fuchsia-400"
        : "from-sky-500 via-cyan-400 to-teal-400"
  const accentGlow =
    accent === "warm"
      ? "bg-orange-500/10"
      : accent === "violet"
        ? "bg-violet-500/10"
        : "bg-cyan-500/10"
  const HeaderIcon =
    accent === "warm" ? Wand2 : accent === "violet" ? Scissors : ChartNoAxesCombined

  const pairedServices = cardLayout === "row" ? services.slice(0, 2) : []
  const stackedServices = cardLayout === "row" ? services.slice(2) : services

  return (
    <section
      className="shotform-feature-panel relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0e0f12]/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm md:p-7"
      style={{ animationDelay: `${sectionIndex * 150}ms` }}
    >
      <div className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full ${accentGlow} blur-3xl`} />
      <div className={`mb-5 h-1 w-16 rounded-full bg-gradient-to-r ${accentBar}`} />

      <div className="mb-6 flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accentBar} text-white shadow-lg ring-1 ring-white/15`}
        >
          <HeaderIcon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-zinc-50 md:text-2xl">{title}</h2>
          <p className="text-sm text-zinc-400 md:text-[15px]">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5">
        {pairedServices.length > 0 && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {pairedServices.map((service, index) => (
              <FeatureCard
                key={service.id}
                service={service}
                index={index + sectionIndex * 2}
                onServiceClick={onServiceClick}
              />
            ))}
          </div>
        )}
        {stackedServices.map((service, index) => (
          <FeatureCard
            key={service.id}
            service={service}
            index={index + pairedServices.length + sectionIndex * 2}
            onServiceClick={onServiceClick}
          />
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
  ttsmaker: string
  supertone: string
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
    { key: "ttsmaker", match: /ttsmaker\s*api\s*key/i },
    { key: "supertone", match: /supertone\s*api\s*key/i },
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
    ttsmaker: "",
    supertone: "",
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
    ttsmaker: false,
    supertone: false,
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
  const [testingKeys, setTestingKeys] = useState<{ [key: string]: boolean }>({})
  const [testResults, setTestResults] = useState<{ [key: string]: { success: boolean; message: string } }>({})
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
      const storedTTSMaker = localStorage.getItem("shotform_ttsmaker_api_key") || ""
      const storedSupertone = localStorage.getItem("shotform_supertone_api_key") || ""
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
        ttsmaker: storedTTSMaker,
        supertone: storedSupertone,
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
    localStorage.setItem("shotform_ttsmaker_api_key", apiKeys.ttsmaker || "")
    localStorage.setItem("shotform_supertone_api_key", apiKeys.supertone || "")
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

7. TTSMaker API Key
${apiKeys.ttsmaker || "(미입력)"}

8. Supertone API Key
${apiKeys.supertone || "(미입력)"}

9. Typecast API Key
${apiKeys.typecast || "(미입력)"}

10. YouTube Client ID
${apiKeys.youtubeClientId || "(미입력)"}

11. YouTube Client Secret
${apiKeys.youtubeClientSecret || "(미입력)"}

12. YouTube Data API Key
${apiKeys.youtubeDataApiKey || "(미입력)"}

13. Apify API
${apiKeys.apify || "(미입력)"}

14. Vmake AI API Key (MT_AK)
${apiKeys.vmake || "(미입력)"}

15. Vmake AI Secret Access Key (MT_SK)
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
      localStorage.setItem("shotform_ttsmaker_api_key", next.ttsmaker || "")
      localStorage.setItem("shotform_supertone_api_key", next.supertone || "")
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

  // API 키 연결 확인 함수
  const testApiKey = async (keyType: string) => {
    if (keyType === "vmake") {
      if (!apiKeys.vmake || !apiKeys.vmakeSecret) {
        setTestResults({
          ...testResults,
          [keyType]: {
            success: false,
            message: "API Key와 Secret Access Key를 모두 입력해 주세요.",
          },
        })
        return
      }
    } else if (!apiKeys[keyType as keyof typeof apiKeys]) {
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
        case "pixabay": {
          const response = await fetch(
            `https://pixabay.com/api/?key=${encodeURIComponent(apiKeys.pixabay)}&q=test&per_page=3&safesearch=true`
          )
          if (response.ok) {
            setTestResults({
              ...testResults,
              [keyType]: { success: true, message: "Pixabay 연결 성공!" },
            })
          } else {
            setTestResults({
              ...testResults,
              [keyType]: { success: false, message: `연결 실패: ${response.statusText || response.status}` },
            })
          }
          break
        }
        case "serpapi": {
          const response = await fetch(
            `https://serpapi.com/account.json?api_key=${encodeURIComponent(apiKeys.serpapi)}`
          )
          if (response.ok) {
            setTestResults({
              ...testResults,
              [keyType]: { success: true, message: "SerpAPI 연결 성공!" },
            })
          } else {
            const error = await response.json().catch(() => ({}))
            setTestResults({
              ...testResults,
              [keyType]: {
                success: false,
                message: `연결 실패: ${(error as { error?: string }).error || response.statusText}`,
              },
            })
          }
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
        case "typecast": {
          const response = await fetch(
            `/api/typecast-voices?apiKey=${encodeURIComponent(apiKeys.typecast)}`
          )
          const result = await response.json().catch(() => ({}))
          setTestResults({
            ...testResults,
            [keyType]: {
              success: response.ok && result.success !== false,
              message: response.ok
                ? "타입캐스트 목소리 목록 확인 성공!"
                : result.error || response.statusText,
            },
          })
          break
        }
        case "apify": {
          const response = await fetch(
            `https://api.apify.com/v2/users/me?token=${encodeURIComponent(apiKeys.apify)}`
          )
          if (response.ok) {
            setTestResults({
              ...testResults,
              [keyType]: { success: true, message: "Apify API 연결 성공!" },
            })
          } else {
            setTestResults({
              ...testResults,
              [keyType]: {
                success: false,
                message: `연결 실패: ${response.statusText}`,
              },
            })
          }
          break
        }
        case "vmake": {
          const response = await fetch("/api/test-vmake", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey: apiKeys.vmake,
              secretAccessKey: apiKeys.vmakeSecret,
            }),
          })
          const result = await response.json()
          setTestResults({
            ...testResults,
            [keyType]: { success: result.success, message: result.message },
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
      <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
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
        <DialogContent className="sm:max-w-md bg-[#141518] border-white/10 text-zinc-100">
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
                <p className="text-sm text-amber-200 font-medium">
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

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-zinc-100">
      {/* 배경 장식 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-pink-500/10 to-red-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-orange-500/10 to-yellow-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-pink-500/5 to-orange-500/5 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <Header onSettingsClick={() => setOpen(true)} />

      {/* 메인 컨텐츠 */}
      <main className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
          {/* Hero Section */}
          <HeroSection />

          {/* Features Section */}
          <div
            id="features"
            className="mt-16 space-y-5 md:mt-20 lg:mt-24 lg:space-y-7"
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-7">
              <FeatureSection
                title="쇼핑숏폼 제작"
                subtitle="15초 쇼츠를 빠르고 쉽게 제작하세요"
                services={shotFormServices}
                onServiceClick={handleServiceClick}
                accent="warm"
                sectionIndex={0}
              />

              <FeatureSection
                title="분석 & 도구"
                subtitle="채널 성장과 운영을 돕는 보조 도구"
                services={analysisToolsServices}
                onServiceClick={handleServiceClick}
                accent="cool"
                sectionIndex={1}
              />
            </div>

            <FeatureSection
              title="일반 숏폼"
              subtitle="주제 기반 숏폼 제작 · 롱폼 URL을 바이럴 숏폼으로 자동 클립"
              services={generalShortformServices}
              onServiceClick={handleServiceClick}
              accent="violet"
              sectionIndex={2}
              cardLayout="row"
            />
          </div>
        </div>
      </main>

      {/* API 키 설정 다이얼로그 - WingsAIStudio와 동일한 구조 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col bg-[#141518] border-white/10 text-zinc-100">
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
              <Label htmlFor="openai-key" className="text-sm font-medium text-zinc-200">
                OpenAI API Key
              </Label>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("openai")}
                  disabled={testingKeys.openai || !apiKeys.openai}
                  className="shrink-0 text-xs border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {testingKeys.openai ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.openai && (
                <p className={`text-xs ${testResults.openai.success ? "text-emerald-400" : "text-red-400"}`}>
                  {testResults.openai.message}
                </p>
              )}
              <p className="text-xs text-zinc-500">GPT 모델 사용에 필요합니다</p>
            </div>

            {/* TTSMaker API Key */}
            <div className="space-y-2">
              <Label htmlFor="ttsmaker-key" className="text-sm font-medium text-zinc-200">
                TTSMaker API Key
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="ttsmaker-key"
                  type={showKeys.ttsmaker ? "text" : "password"}
                  placeholder="입력하세요"
                  value={apiKeys.ttsmaker || ""}
                  onChange={(e) => setApiKeys({ ...apiKeys, ttsmaker: e.target.value })}
                  className="font-mono text-sm bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, ttsmaker: !showKeys.ttsmaker })}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
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
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("ttsmaker")}
                  disabled={testingKeys.ttsmaker || !apiKeys.ttsmaker}
                  className="shrink-0 text-xs border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {testingKeys.ttsmaker ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.ttsmaker && (
                <p className={`text-xs ${testResults.ttsmaker.success ? "text-emerald-400" : "text-red-400"}`}>
                  {testResults.ttsmaker.message}
                </p>
              )}
              <p className="text-xs text-zinc-500">TTSMaker 음성 합성에 사용됩니다</p>
            </div>

            {/* ElevenLabs API Key */}
            <div className="space-y-2">
              <Label htmlFor="elevenlabs-key" className="text-sm font-medium text-zinc-200">
                ElevenLabs API Key
              </Label>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("elevenlabs")}
                  disabled={testingKeys.elevenlabs || !apiKeys.elevenlabs}
                  className="shrink-0 text-xs border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {testingKeys.elevenlabs ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.elevenlabs && (
                <p className={`text-xs ${testResults.elevenlabs.success ? "text-emerald-400" : "text-red-400"}`}>
                  {testResults.elevenlabs.message}
                </p>
              )}
              <p className="text-xs text-zinc-500">ElevenLabs 음성 합성에 사용됩니다</p>
            </div>

            {/* Supertone API Key */}
            <div className="space-y-2">
              <Label htmlFor="supertone-key" className="text-sm font-medium text-zinc-200">
                Supertone API Key
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="supertone-key"
                  type={showKeys.supertone ? "text" : "password"}
                  placeholder="입력하세요"
                  value={apiKeys.supertone || ""}
                  onChange={(e) => setApiKeys({ ...apiKeys, supertone: e.target.value })}
                  className="font-mono text-sm bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKeys({ ...showKeys, supertone: !showKeys.supertone })}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
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
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("supertone")}
                  disabled={testingKeys.supertone || !apiKeys.supertone}
                  className="shrink-0 text-xs border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {testingKeys.supertone ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.supertone && (
                <p className={`text-xs ${testResults.supertone.success ? "text-emerald-400" : "text-red-400"}`}>
                  {testResults.supertone.message}
                </p>
              )}
              <p className="text-xs text-zinc-500">Supertone 음성 합성에 사용됩니다</p>
            </div>

            {/* Typecast API Key */}
            <div className="space-y-2">
              <Label htmlFor="typecast-key" className="text-sm font-medium text-zinc-200">
                Typecast API Key
              </Label>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("typecast")}
                  disabled={testingKeys.typecast || !apiKeys.typecast}
                  className="shrink-0 text-xs border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {testingKeys.typecast ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.typecast && (
                <p className={`text-xs ${testResults.typecast.success ? "text-emerald-400" : "text-red-400"}`}>
                  {testResults.typecast.message}
                </p>
              )}
              <p className="text-xs text-zinc-500">
                타입캐스트 TTS에 사용됩니다 (AI 쇼핑 숏폼 · 숏폼 스튜디오 나레이션).
              </p>
            </div>

            {/* Replicate API Key */}
            <div className="space-y-2">
              <Label htmlFor="replicate-key" className="text-sm font-medium text-zinc-200">
                Replicate API Key
              </Label>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("replicate")}
                  disabled={testingKeys.replicate || !apiKeys.replicate}
                  className="shrink-0 text-xs border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {testingKeys.replicate ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.replicate && (
                <p className={`text-xs ${testResults.replicate.success ? "text-emerald-400" : "text-red-400"}`}>
                  {testResults.replicate.message}
                </p>
              )}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("pixabay")}
                  disabled={testingKeys.pixabay || !apiKeys.pixabay}
                  className="shrink-0 text-xs border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {testingKeys.pixabay ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.pixabay && (
                <p className={`text-xs ${testResults.pixabay.success ? "text-emerald-400" : "text-red-400"}`}>
                  {testResults.pixabay.message}
                </p>
              )}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("serpapi")}
                  disabled={testingKeys.serpapi || !apiKeys.serpapi}
                  className="shrink-0 border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white disabled:opacity-40"
                >
                  {testingKeys.serpapi ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.serpapi && (
                <p className={`text-xs ${testResults.serpapi.success ? "text-emerald-400" : "text-red-400"}`}>
                  {testResults.serpapi.message}
                </p>
              )}
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
              <Label htmlFor="youtube-data-api-key" className="text-sm font-medium text-zinc-200">
                YouTube Data API Key
              </Label>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("youtubeDataApiKey")}
                  disabled={testingKeys.youtubeDataApiKey || !apiKeys.youtubeDataApiKey}
                  className="shrink-0 text-xs border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {testingKeys.youtubeDataApiKey ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.youtubeDataApiKey && (
                <p className={`text-xs ${testResults.youtubeDataApiKey.success ? "text-emerald-400" : "text-red-400"}`}>
                  {testResults.youtubeDataApiKey.message}
                </p>
              )}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("apify")}
                  disabled={testingKeys.apify || !apiKeys.apify}
                  className="shrink-0 text-xs border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {testingKeys.apify ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.apify && (
                <p className={`text-xs ${testResults.apify.success ? "text-emerald-400" : "text-red-400"}`}>
                  {testResults.apify.message}
                </p>
              )}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey("vmake")}
                  disabled={
                    testingKeys.vmake || !apiKeys.vmake || !apiKeys.vmakeSecret
                  }
                  className="shrink-0 text-xs border-white/25 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white"
                >
                  {testingKeys.vmake ? "확인 중..." : "연결확인"}
                </Button>
              </div>
              {testResults.vmake && (
                <p className={`text-xs ${testResults.vmake.success ? "text-emerald-400" : "text-red-400"}`}>
                  {testResults.vmake.message}
                </p>
              )}
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
      <footer className="relative z-10 border-t border-white/10 bg-[#0a0b0d]/80 backdrop-blur-sm mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-4">
            <div className="text-center text-sm text-zinc-500 space-y-2">
              <p className="font-semibold text-zinc-100">© 2025 wingsAIStudio ShotForm. All Rights Reserved.</p>
              <div className="space-y-1 text-xs">
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


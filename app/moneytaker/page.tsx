"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  FileText,
  Users,
  Newspaper,
  LayoutDashboard,
  History,
  Settings,
  LogOut,
  Sparkles,
  TrendingUp,
  BarChart3,
  Filter,
  Download,
  RefreshCw,
  ArrowRight,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Brain,
  Zap,
  Image as ImageIcon,
  Upload,
  PenTool,
  Save,
  FolderOpen,
  Info,
  Loader2,
  Copy,
  Check,
  Edit,
  RefreshCw as RefreshCwIcon,
  MessageCircle,
  X as XIcon,
  Send,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// 키워드 데이터 타입
interface KeywordData {
  keyword: string
  pc: number
  mobile: number
  total: number
  category?: "세부키워드" | "중형키워드" | "대형키워드"
}

// 사이드바 네비게이션 컴포넌트
function Sidebar({ 
  activeTab, 
  onTabChange, 
  isCollapsed, 
  onToggleCollapse 
}: { 
  activeTab: string
  onTabChange: (tab: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}) {
  const router = useRouter()

  const navItems = [
    { id: "keyword-analysis", label: "키워드 분석", icon: Search, color: "from-violet-500 to-purple-600" },
    { id: "blog-ai", label: "블로그 AI", icon: FileText, color: "from-blue-500 to-cyan-600" },
    { id: "experience-ai", label: "체험단 AI", icon: Users, color: "from-pink-500 to-rose-600" },
    { id: "reporter-ai", label: "기자단 AI", icon: Newspaper, color: "from-orange-500 to-amber-600" },
  ]

  const generalItems = [
    { id: "history", label: "히스토리", icon: History },
    { id: "settings", label: "설정", icon: Settings },
  ]

  return (
    <div className={`${isCollapsed ? "w-20" : "w-72"} bg-white border-r border-slate-200 h-screen fixed left-0 top-0 overflow-y-auto shadow-xl transition-all duration-300 z-50`}>
      {/* 로고 영역 */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-indigo-50 to-purple-50 relative">
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} mb-1`}>
          <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                MoneyTaker AI
              </h1>
              <p className="text-xs text-slate-500 font-medium">AI 블로그 자동화</p>
            </div>
          )}
        </div>
        {/* 접기/펼치기 버튼 */}
        <button
          onClick={onToggleCollapse}
          className="absolute top-6 right-4 p-1.5 rounded-lg hover:bg-white/50 transition-colors"
          title={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-600" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          )}
        </button>
      </div>

      {/* 메인 네비게이션 */}
      <nav className="p-4 space-y-2">
        {!isCollapsed && (
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">주요 기능</p>
        )}
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center ${isCollapsed ? "justify-center" : "gap-3"} px-4 py-3.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? `bg-gradient-to-r ${item.color} text-white shadow-lg`
                  : "text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-500 group-hover:text-indigo-600"}`} />
              {!isCollapsed && (
                <>
                  <span className="font-semibold text-sm">{item.label}</span>
                  {isActive && <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>}
                </>
              )}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-slate-100 my-2 mx-4" />

      {/* 일반 메뉴 */}
      <nav className="p-4 space-y-2">
        {!isCollapsed && (
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">기타</p>
        )}
        {generalItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center ${isCollapsed ? "justify-center" : "gap-3"} px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all duration-200 group`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
              {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-slate-100 my-2 mx-4" />

      {/* 부스텍AI */}
      <div className="p-4">
        <button
          onClick={() => router.push("/")}
          className={`w-full flex items-center ${isCollapsed ? "justify-center" : "gap-3"} px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white transition-all duration-200 shadow-lg hover:shadow-xl group`}
          title={isCollapsed ? "부스텍AI" : undefined}
        >
          <Brain className="w-5 h-5" />
          {!isCollapsed && <span className="font-semibold text-sm">부스텍AI</span>}
        </button>
      </div>
    </div>
  )
}

export default function MoneyTakerPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("keyword-analysis")
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<KeywordData[]>([])
  const [relatedKeywords, setRelatedKeywords] = useState<KeywordData[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isSortedByVolume, setIsSortedByVolume] = useState(false) // 검색량순 정렬 상태
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = useState(false) // AI 분석 다이얼로그
  const [analyzingKeyword, setAnalyzingKeyword] = useState<string>("") // 분석 중인 키워드
  const [analysisResult, setAnalysisResult] = useState<string>("") // 분석 결과
  const [isAnalyzing, setIsAnalyzing] = useState(false) // 분석 중 상태

  // 블로그 AI 관련 state
  const [blogAIKeyword, setBlogAIKeyword] = useState("")
  const [workflow, setWorkflow] = useState<"automation" | "custom">("automation")
  const [imageMode, setImageMode] = useState<"ai" | "wash" | "none">("ai")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState("")
  const [blogTitle, setBlogTitle] = useState("") // 블로그 제목
  const [isEditingContent, setIsEditingContent] = useState(false) // 에디터 모드
  const [editedContent, setEditedContent] = useState("") // 편집 중인 콘텐츠
  const [isRegeneratingTitle, setIsRegeneratingTitle] = useState(false) // 제목 재생성 중
  const [personaInfo, setPersonaInfo] = useState({
    businessName: "",
    industry: "",
    representativeName: "",
    salesLocation: "",
    differentiator: "",
    customerCharacteristics: "",
  })
  const [washOptions, setWashOptions] = useState({
    transparentOverlay: false,
    angleRotation: false,
    frame: false,
  })
  const [uploadedImages, setUploadedImages] = useState<File[]>([])
  const [isCopied, setIsCopied] = useState(false) // 복사 상태
  const [streamingContent, setStreamingContent] = useState("") // 스트리밍 콘텐츠
  const [generatedImages, setGeneratedImages] = useState<string[]>([]) // 생성된 이미지 URLs
  const imageGenerationStartedRef = useRef(false) // 이미지 생성 시작 여부 추적
  const [isUploadingToNaver, setIsUploadingToNaver] = useState(false) // 네이버 업로드 중 상태
  const [isNaverUploadDialogOpen, setIsNaverUploadDialogOpen] = useState(false) // 네이버 업로드 다이얼로그
  const [naverUploadInfo, setNaverUploadInfo] = useState({
    title: "",
    category: "일반",
    publishType: "immediate" as "immediate" | "scheduled",
    scheduledDate: "",
    scheduledTime: "",
    tags: "",
    visibility: "public" as "public" | "private" | "unlisted",
  })
  
  // 블로그 AI 선택사항 관련 state
  const [blogTopPosts, setBlogTopPosts] = useState<any[]>([]) // 상위 1~3등 글
  const [blogCommonKeywords, setBlogCommonKeywords] = useState<string[]>([]) // 공통 키워드
  const [blogRequiredMorphemes, setBlogRequiredMorphemes] = useState<string[]>([]) // 필수 포함 형태소
  const [blogExcludedKeywords, setBlogExcludedKeywords] = useState<string[]>([]) // 제외할 키워드
  const [isBlogCrawling, setIsBlogCrawling] = useState(false) // 블로그 크롤링 중
  const [blogLinkUrl, setBlogLinkUrl] = useState("") // 블로그 링크
  const [isAnalyzingBlogLink, setIsAnalyzingBlogLink] = useState(false) // 블로그 링크 분석 중
  const [blogLinkAnalysis, setBlogLinkAnalysis] = useState<any>(null) // 블로그 링크 분석 결과
  const [isAnalyzingPostStructure, setIsAnalyzingPostStructure] = useState(false) // 글 구조 분석 중
  const [postStructureAnalysis, setPostStructureAnalysis] = useState<any>(null) // 글 구조 분석 결과
  
  // MoneyTaker 봇 관련 state
  const [isChatbotOpen, setIsChatbotOpen] = useState(false) // 채팅봇 열림/닫힘
  const [chatbotMessages, setChatbotMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: "안녕하세요! MoneyTaker AI입니다. 블로그 마케팅, 키워드 분석, 콘텐츠 생성 등에 대해 무엇이든 물어보세요!",
    },
  ])
  const [chatbotInput, setChatbotInput] = useState("")
  const [isChatbotLoading, setIsChatbotLoading] = useState(false)
  const chatbotMessagesEndRef = useRef<HTMLDivElement>(null)

  // 채팅봇 메시지 전송
  const handleChatbotSend = async () => {
    if (!chatbotInput.trim() || isChatbotLoading) return

    const userMessage = chatbotInput.trim()
    setChatbotInput("")
    setChatbotMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setIsChatbotLoading(true)

    try {
      const OPENAI_API_KEY = "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"

      const systemPrompt = `당신은 블로그 마케팅 전문가 AI 어시스턴트 'MoneyTaker AI'입니다.

당신의 역할:
- 블로그 마케팅 전략 제공
- 키워드 분석 및 SEO 최적화 조언
- 콘텐츠 기획 및 아이디어 제안
- 상위노출 전략 및 백링크 전략
- 체험단/기자단 마케팅 가이드
- 블로그 수익화 전략
- 네이버 블로그 최적화 방법
- 키워드 기반 콘텐츠 작성 팁

답변 스타일:
- 친근하고 전문적인 톤
- 구체적이고 실행 가능한 조언 제공
- 필요시 예시와 함께 설명
- 한국 블로그 시장에 특화된 정보 제공
- 최신 SEO 트렌드와 알고리즘 변화 반영

항상 사용자의 질문에 정확하고 도움이 되는 답변을 제공하세요.`

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            ...chatbotMessages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            {
              role: "user",
              content: userMessage,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "메시지 전송에 실패했습니다.")
      }

      const data = await response.json()
      const assistantMessage = data.choices?.[0]?.message?.content || "죄송합니다. 답변을 생성할 수 없습니다."
      setChatbotMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }])
    } catch (error) {
      console.error("채팅봇 메시지 전송 실패:", error)
      setChatbotMessages((prev) => [
        ...prev,
        { role: "assistant", content: "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요." },
      ])
    } finally {
      setIsChatbotLoading(false)
    }
  }

  // 채팅봇 스크롤
  useEffect(() => {
    if (isChatbotOpen && chatbotMessagesEndRef.current) {
      chatbotMessagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [chatbotMessages, isChatbotOpen])

  // 체험단 AI 관련 state
  const [experienceMode, setExperienceMode] = useState<"auto" | "manual">("auto") // 자동 모드 or 수동 모드
  const [placeUrl, setPlaceUrl] = useState("") // 플레이스 URL
  const [experienceInfo, setExperienceInfo] = useState({
    businessName: "",
    serviceContent: "",
    businessFeatures: "",
    recruitmentCount: "",
    targetKeyword: "",
  })
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false) // 가이드 생성 중
  const [generatedGuide, setGeneratedGuide] = useState("") // 생성된 가이드
  const [isGeneratingRecruitment, setIsGeneratingRecruitment] = useState(false) // 구인글 생성 중
  const [generatedRecruitment, setGeneratedRecruitment] = useState("") // 생성된 구인글

  // 기자단 AI 관련 state
  const [reporterKeyword, setReporterKeyword] = useState("") // 목표 키워드
  const [isCrawling, setIsCrawling] = useState(false) // 크롤링 중
  const [topPosts, setTopPosts] = useState<any[]>([]) // 상위 1~3등 글
  const [commonKeywords, setCommonKeywords] = useState<string[]>([]) // 공통 키워드
  const [requiredMorphemes, setRequiredMorphemes] = useState<string[]>([]) // 필수 포함 형태소
  const [excludedKeywords, setExcludedKeywords] = useState<string[]>([]) // 제외할 키워드
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false) // 원고 생성 중
  const [generatedDraft, setGeneratedDraft] = useState("") // 생성된 원고
  const [draftTitle, setDraftTitle] = useState("") // 원고 제목
  const [reporterImageMode, setReporterImageMode] = useState<"generate" | "wash" | "none">("generate") // 이미지 생성 방식
  const [reporterImages, setReporterImages] = useState<string[]>([]) // 생성된 이미지
  const [reporterUploadedImages, setReporterUploadedImages] = useState<File[]>([]) // 업로드된 이미지 (세탁용)
  const [contractInfo, setContractInfo] = useState({ // 계약서 정보
    date: "",
    businessName: "",
    amount: "",
    period: "",
  })
  const [quoteInfo, setQuoteInfo] = useState({ // 견적서 정보
    businessName: "",
    items: [] as { name: string; quantity: number; price: number }[],
  })

  // 키워드 분류 함수
  const categorizeKeyword = (total: number): "세부키워드" | "중형키워드" | "대형키워드" => {
    if (total < 1000) return "세부키워드"
    if (total < 5000) return "중형키워드"
    return "대형키워드"
  }

  // 키워드 입력 처리
  const handleKeywordInput = (value: string) => {
    setKeywordInput(value)
    const lines = value.split("\n").filter((line) => line.trim().length > 0)
    setKeywords(lines.slice(0, 5)) // 최대 5개
  }

  // 키워드 검색량 조회
  const handleSearch = async () => {
    if (keywords.length === 0) {
      alert("키워드를 입력해주세요.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/moneytaker/keyword-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "키워드 검색에 실패했습니다.")
      }

      // 실제 API 응답이 있을 때만 결과 표시
      if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        const results: KeywordData[] = data.results.map((item: any) => ({
          keyword: item.keyword,
          pc: item.pc || 0,
          mobile: item.mobile || 0,
          total: item.total || 0,
          category: categorizeKeyword(item.total || 0),
        }))
        setSearchResults(results)
      } else {
        setSearchResults([])
      }

      if (data.relatedKeywords && Array.isArray(data.relatedKeywords) && data.relatedKeywords.length > 0) {
        const related: KeywordData[] = data.relatedKeywords.map((item: any) => ({
          keyword: item.keyword,
          pc: item.pc || 0,
          mobile: item.mobile || 0,
          total: item.total || 0,
          category: categorizeKeyword(item.total || 0),
        }))
        setRelatedKeywords(related)
      } else {
        setRelatedKeywords([])
      }
    } catch (error) {
      console.error("키워드 검색 실패:", error)
      alert(error instanceof Error ? error.message : "키워드 검색에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  // 카테고리별 필터링 및 정렬
  const filteredRelatedKeywords = (() => {
    let filtered = selectedCategory
      ? relatedKeywords.filter((k) => k.category === selectedCategory)
      : relatedKeywords

    // 검색량순 정렬 적용
    if (isSortedByVolume) {
      filtered = [...filtered].sort((a, b) => b.total - a.total)
    }

    return filtered
  })()

  // 카테고리별 개수 계산
  const categoryCounts = {
    세부키워드: relatedKeywords.filter((k) => k.category === "세부키워드").length,
    중형키워드: relatedKeywords.filter((k) => k.category === "중형키워드").length,
    대형키워드: relatedKeywords.filter((k) => k.category === "대형키워드").length,
  }

  // 검색량 포맷팅 함수 (10 미만인 경우 깔끔하게 표시)
  const formatSearchCount = (count: number): string => {
    if (count < 10) {
      return "10 미만"
    }
    return count.toLocaleString()
  }

  // 마크다운 파싱 함수 (볼드, 헤더 등 처리, 이미지 삽입)
  const parseMarkdown = (text: string, images: string[] = []): JSX.Element[] => {
    const lines = text.split('\n')
    const elements: JSX.Element[] = []
    
    console.log("[MoneyTaker] parseMarkdown 호출 - 이미지 개수:", images.length, "이미지 URLs:", images)
    
    // 먼저 문단만 추출 (헤더 제외)
    const paragraphs: number[] = []
    lines.forEach((line, index) => {
      if (line.trim() !== '' && !line.trim().startsWith('#')) {
        paragraphs.push(index)
      }
    })
    
    console.log("[MoneyTaker] 문단 개수:", paragraphs.length)
    
    // 이미지 삽입 위치 계산 (문단 사이에 균등하게 배치)
    const imagePositions: number[] = []
    if (images.length > 0 && paragraphs.length > 0) {
      const sectionsPerImage = Math.ceil(paragraphs.length / (images.length + 1))
      console.log("[MoneyTaker] 섹션당 이미지:", sectionsPerImage)
      for (let i = 0; i < images.length; i++) {
        const position = Math.min((i + 1) * sectionsPerImage, paragraphs.length - 1)
        if (position < paragraphs.length) {
          imagePositions.push(paragraphs[position])
        }
      }
      console.log("[MoneyTaker] 이미지 삽입 위치:", imagePositions)
    }
    
    let imageIndex = 0
    
    lines.forEach((line, index) => {
      // 헤더 처리 (###, ##, #)
      if (line.trim().startsWith('###')) {
        const content = line.replace(/^###+\s*/, '').trim()
        if (content) {
          elements.push(
            <h3 key={index} className="text-xl font-bold text-slate-900 mt-6 mb-3 first:mt-0">
              {parseInlineMarkdown(content)}
            </h3>
          )
        }
      } else if (line.trim().startsWith('##')) {
        const content = line.replace(/^##+\s*/, '').trim()
        if (content) {
          elements.push(
            <h2 key={index} className="text-2xl font-bold text-slate-900 mt-8 mb-4 first:mt-0">
              {parseInlineMarkdown(content)}
            </h2>
          )
        }
      } else if (line.trim().startsWith('#')) {
        const content = line.replace(/^#+\s*/, '').trim()
        if (content) {
          elements.push(
            <h1 key={index} className="text-3xl font-bold text-slate-900 mt-8 mb-4 first:mt-0">
              {parseInlineMarkdown(content)}
            </h1>
          )
        }
      } else if (line.trim() === '') {
        // 빈 줄은 여백으로
        elements.push(<div key={index} className="h-2" />)
      } else {
        // 일반 텍스트 (볼드 처리)
        elements.push(
          <p key={index} className="text-slate-700 leading-relaxed mb-3">
            {parseInlineMarkdown(line)}
          </p>
        )
        
        // 이미지를 문단 다음에 삽입
        if (imageIndex < imagePositions.length && imagePositions[imageIndex] === index) {
          console.log("[MoneyTaker] 이미지 삽입:", imageIndex, "위치:", index, "URL:", images[imageIndex])
          elements.push(
            <div key={`image-${imageIndex}`} className="my-6 rounded-lg overflow-hidden border border-slate-200 shadow-md">
              <img
                src={images[imageIndex]}
                alt={`생성된 이미지 ${imageIndex + 1}`}
                className="w-full h-auto object-cover"
                onError={(e) => {
                  console.error("[MoneyTaker] 이미지 로드 실패:", images[imageIndex])
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )
          imageIndex++
        }
      }
    })
    
    // 남은 이미지가 있으면 마지막에 추가
    while (imageIndex < images.length) {
      elements.push(
        <div key={`image-${imageIndex}`} className="my-6 rounded-lg overflow-hidden border border-slate-200 shadow-md">
          <img
            src={images[imageIndex]}
            alt={`생성된 이미지 ${imageIndex + 1}`}
            className="w-full h-auto object-cover"
          />
        </div>
      )
      imageIndex++
    }
    
    return elements
  }

  // 인라인 마크다운 파싱 (볼드, 이탤릭 등)
  const parseInlineMarkdown = (text: string): JSX.Element[] => {
    const parts: (string | JSX.Element)[] = []
    let currentIndex = 0
    
    // **볼드** 처리
    const boldRegex = /\*\*(.+?)\*\*/g
    let match
    
    while ((match = boldRegex.exec(text)) !== null) {
      // 볼드 앞의 텍스트
      if (match.index > currentIndex) {
        parts.push(text.substring(currentIndex, match.index))
      }
      // 볼드 텍스트
      parts.push(
        <strong key={`bold-${match.index}`} className="font-bold text-slate-900">
          {match[1]}
        </strong>
      )
      currentIndex = match.index + match[0].length
    }
    
    // 남은 텍스트
    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex))
    }
    
    // 매치가 없으면 원본 텍스트 반환
    if (parts.length === 0) {
      return [<span key="text">{text}</span>]
    }
    
    return parts.map((part, index) => 
      typeof part === 'string' ? <span key={`text-${index}`}>{part}</span> : part
    )
  }

  // 엑셀 다운로드 함수 (CSV 형식) - 검색 결과용 (분류 없음)
  const downloadExcelSearchResults = (data: KeywordData[], filename: string) => {
    // CSV 헤더
    const headers = ["순서", "키워드", "PC 검색량", "모바일 검색량", "월 검색량"]
    const rows = data.map((item, index) => [
      index + 1,
      item.keyword,
      item.pc,
      item.mobile,
      item.total,
    ])

    // CSV 내용 생성
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    // BOM 추가 (한글 깨짐 방지)
    const BOM = "\uFEFF"
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  // 엑셀 다운로드 함수 (CSV 형식) - 연관 키워드용 (분류 포함)
  const downloadExcelRelatedKeywords = (data: KeywordData[], filename: string) => {
    // CSV 헤더
    const headers = ["순서", "키워드", "분류", "PC 검색량", "모바일 검색량", "월 검색량"]
    const rows = data.map((item, index) => [
      index + 1,
      item.keyword,
      item.category || "",
      item.pc,
      item.mobile,
      item.total,
    ])

    // CSV 내용 생성
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    // BOM 추가 (한글 깨짐 방지)
    const BOM = "\uFEFF"
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  // 검색 결과 엑셀 다운로드
  const handleDownloadSearchResults = () => {
    if (searchResults.length === 0) {
      alert("다운로드할 검색 결과가 없습니다.")
      return
    }
    downloadExcelSearchResults(searchResults, "검색결과")
  }

  // 연관 키워드 엑셀 다운로드
  const handleDownloadRelatedKeywords = () => {
    const dataToDownload = isSortedByVolume
      ? [...filteredRelatedKeywords].sort((a, b) => b.total - a.total)
      : filteredRelatedKeywords

    if (dataToDownload.length === 0) {
      alert("다운로드할 연관 키워드가 없습니다.")
      return
    }
    downloadExcelRelatedKeywords(dataToDownload, "연관키워드")
  }

  // 검색량순 정렬 토글
  const handleSortByVolume = () => {
    setIsSortedByVolume(!isSortedByVolume)
  }

  // 초기화 함수
  const handleReset = () => {
    setSearchResults([])
    setRelatedKeywords([])
    setKeywordInput("")
    setKeywords([])
    setSelectedCategory(null)
    setIsSortedByVolume(false)
  }

  // AI 분석 함수
  const handleAIAnalysis = async (keyword: string, keywordData: KeywordData) => {
    setIsAnalysisDialogOpen(true)
    setAnalyzingKeyword(keyword)
    setAnalysisResult("")
    setIsAnalyzing(true)

    try {
      // OpenAI API 키 (하드코딩)
      const OPENAI_API_KEY = "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"

      const prompt = `다음 키워드에 대한 상세한 분석을 제공해주세요:

키워드: ${keyword}
PC 검색량: ${keywordData.pc.toLocaleString()}
모바일 검색량: ${keywordData.mobile.toLocaleString()}
월 총 검색량: ${keywordData.total.toLocaleString()}
키워드 분류: ${keywordData.category || "미분류"}

다음 항목들을 포함하여 분석해주세요:
1. 키워드의 시장 잠재력 및 경쟁도 분석
2. 검색량 데이터 기반 트렌드 분석
3. 타겟 고객층 및 니즈 분석
4. 블로그 콘텐츠 기획 제안
5. SEO 최적화 방안
6. 마케팅 활용 전략

분석은 구체적이고 실행 가능한 인사이트를 제공해주세요.`

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "당신은 키워드 분석 전문가입니다. 주어진 키워드의 검색량 데이터를 바탕으로 상세하고 실용적인 분석을 제공합니다.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "AI 분석에 실패했습니다.")
      }

      const data = await response.json()
      const analysis = data.choices?.[0]?.message?.content || "분석 결과를 생성할 수 없습니다."

      setAnalysisResult(analysis)
    } catch (error) {
      console.error("AI 분석 실패:", error)
      setAnalysisResult(
        error instanceof Error
          ? `분석 중 오류가 발생했습니다: ${error.message}`
          : "AI 분석에 실패했습니다. 다시 시도해주세요."
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  // AI 생성 버튼 클릭
  const handleAIGenerate = (keyword: string) => {
    setBlogAIKeyword(keyword)
    setActiveTab("blog-ai")
  }

  // 이미지 업로드 처리
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadedImages((prev) => [...prev, ...files])
  }

  // 드래그 앤 드롭 처리
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    setUploadedImages((prev) => [...prev, ...files])
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // 콘텐츠 기반 이미지 생성 함수 (병렬 처리)
  const generateImagesForContent = async (content: string, onImageGenerated?: (imageUrl: string) => void) => {
    // 이미 이미지 생성이 시작되었으면 중복 실행 방지
    if (imageGenerationStartedRef.current) {
      return
    }
    imageGenerationStartedRef.current = true
    
    try {
      // OpenAI API 키 (하드코딩)
      const OPENAI_API_KEY = "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"
      
      // 생성된 콘텐츠를 기반으로 이미지 프롬프트 생성
      const imagePromptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an expert at creating natural, realistic image prompts. Generate 3-4 detailed image prompts in English based on the blog content. Each prompt should describe a different scene or concept from the blog. IMPORTANT: Create natural, candid, lifestyle images with people in realistic everyday situations. Avoid staged or artificial poses. Focus on authentic moments, natural expressions, and real environments. The people should look natural and Korean in appearance, but this should be subtle and realistic, not forced or stereotypical. Return only the prompts, one per line, without numbering or bullet points.",
            },
            {
              role: "user",
              content: `Based on this blog content, generate 3-4 natural, realistic image prompts in English. Create candid, lifestyle images with people in authentic everyday situations. The images should feel natural and unposed, with real expressions and environments:\n\n${content.substring(0, 2000)}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      })

      if (!imagePromptResponse.ok) {
        throw new Error("이미지 프롬프트 생성 실패")
      }

      const imagePromptData = await imagePromptResponse.json()
      const promptsText = imagePromptData.choices?.[0]?.message?.content || ""
      console.log("[MoneyTaker] 생성된 이미지 프롬프트 텍스트:", promptsText)
      const imagePrompts = promptsText
        .split("\n")
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0)
        .slice(0, 4) // 최대 4개

      console.log("[MoneyTaker] 파싱된 이미지 프롬프트:", imagePrompts)

      if (imagePrompts.length === 0) {
        console.warn("[MoneyTaker] 이미지 프롬프트가 생성되지 않음")
        return
      }

      // 각 프롬프트로 이미지 생성 (병렬 처리, 완료되는 대로 추가)
      imagePrompts.forEach(async (prompt: string, index: number) => {
        try {
          console.log("[MoneyTaker] 이미지 생성 요청:", prompt.substring(0, 50) + "...")
          
          const imageResponse = await fetch("/api/moneytaker/generate-image", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt }),
          })

          if (imageResponse.ok) {
            const data = await imageResponse.json()
            if (data.success && data.imageUrl) {
              console.log("[MoneyTaker] 이미지 생성 성공:", data.imageUrl)
              // 이미지가 생성되면 즉시 상태에 추가
              setGeneratedImages((prev) => [...prev, data.imageUrl])
              // 콜백 호출 (실시간 업데이트)
              if (onImageGenerated) {
                onImageGenerated(data.imageUrl)
              }
            } else {
              console.error("[MoneyTaker] 이미지 생성 실패:", data.error)
            }
          } else {
            const errorData = await imageResponse.json().catch(() => ({}))
            console.error("[MoneyTaker] 이미지 생성 API 오류:", imageResponse.status, errorData)
          }
        } catch (error) {
          console.error("[MoneyTaker] 이미지 생성 실패:", error)
        }
      })
    } catch (error) {
      console.error("이미지 생성 중 오류:", error)
      // 이미지 생성 실패해도 콘텐츠는 계속 진행
    }
  }

  // 네이버 블로그 업로드 다이얼로그 열기
  const handleOpenNaverUploadDialog = () => {
    if (!generatedContent.trim()) {
      alert("업로드할 콘텐츠가 없습니다. 먼저 AI 콘텐츠를 생성해주세요.")
      return
    }

    // 다이얼로그 열 때 기본값 설정
    const uploadInfo = {
      title: blogTitle || blogAIKeyword || "AI 생성 블로그 포스트",
      category: "일반",
      publishType: "immediate" as "immediate" | "scheduled",
      scheduledDate: "",
      scheduledTime: "",
      tags: blogAIKeyword || "",
      visibility: "public" as "public" | "private" | "unlisted",
    }
    
    setNaverUploadInfo(uploadInfo)
    // 상태 업데이트를 강제하기 위해 setTimeout 사용
    setTimeout(() => {
      setIsNaverUploadDialogOpen(true)
    }, 0)
  }

  // 네이버 블로그 자동 업로드 실행
  const handleUploadToNaver = async () => {
    setIsUploadingToNaver(true)

    try {
      // 콘텐츠를 HTML로 변환 (마크다운 파싱 결과를 HTML로)
      const htmlContent = convertContentToHTML(generatedContent, generatedImages)

      // 예약발행 날짜/시간 처리
      let publishDate: string | undefined = undefined
      if (naverUploadInfo.publishType === "scheduled" && naverUploadInfo.scheduledDate && naverUploadInfo.scheduledTime) {
        const dateTime = new Date(`${naverUploadInfo.scheduledDate}T${naverUploadInfo.scheduledTime}`)
        publishDate = dateTime.toISOString()
      }

      // 태그 배열로 변환
      const tagsArray = naverUploadInfo.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)

      const response = await fetch("/api/moneytaker/upload-to-naver", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: naverUploadInfo.title,
          content: htmlContent,
          category: naverUploadInfo.category,
          publishType: naverUploadInfo.publishType,
          scheduledDate: publishDate,
          tags: tagsArray,
          visibility: naverUploadInfo.visibility,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "네이버 블로그 업로드에 실패했습니다.")
      }

      const data = await response.json()
      
      if (naverUploadInfo.publishType === "scheduled") {
        alert(`네이버 블로그에 예약 발행이 설정되었습니다!\n\n예약 시간: ${naverUploadInfo.scheduledDate} ${naverUploadInfo.scheduledTime}\n포스트 URL: ${data.postUrl || "확인 필요"}`)
      } else {
        alert(`네이버 블로그에 성공적으로 업로드되었습니다!\n\n포스트 URL: ${data.postUrl || "확인 필요"}`)
      }
      
      setIsNaverUploadDialogOpen(false)
    } catch (error) {
      console.error("네이버 업로드 실패:", error)
      alert(
        error instanceof Error
          ? `업로드 중 오류가 발생했습니다: ${error.message}`
          : "네이버 블로그 업로드에 실패했습니다. 다시 시도해주세요."
      )
    } finally {
      setIsUploadingToNaver(false)
    }
  }

  // 콘텐츠를 HTML로 변환하는 함수
  const convertContentToHTML = (content: string, images: string[]): string => {
    const lines = content.split("\n")
    let html = ""
    let imageIndex = 0
    const paragraphs: number[] = []

    // 문단 위치 찾기
    lines.forEach((line, index) => {
      if (line.trim() !== "" && !line.trim().startsWith("#")) {
        paragraphs.push(index)
      }
    })

    // 이미지 삽입 위치 계산
    const imagePositions: number[] = []
    if (images.length > 0 && paragraphs.length > 0) {
      const sectionsPerImage = Math.ceil(paragraphs.length / (images.length + 1))
      for (let i = 0; i < images.length; i++) {
        const position = Math.min((i + 1) * sectionsPerImage, paragraphs.length - 1)
        if (position < paragraphs.length) {
          imagePositions.push(paragraphs[position])
        }
      }
    }

    lines.forEach((line, index) => {
      if (line.trim().startsWith("###")) {
        const text = line.replace(/^###+\s*/, "").trim()
        if (text) {
          html += `<h3>${text}</h3>\n`
        }
      } else if (line.trim().startsWith("##")) {
        const text = line.replace(/^##+\s*/, "").trim()
        if (text) {
          html += `<h2>${text}</h2>\n`
        }
      } else if (line.trim().startsWith("#")) {
        const text = line.replace(/^#+\s*/, "").trim()
        if (text) {
          html += `<h1>${text}</h1>\n`
        }
      } else if (line.trim() === "") {
        html += `<br/>\n`
      } else {
        // 볼드 처리
        let text = line
        text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        html += `<p>${text}</p>\n`

        // 이미지 삽입
        if (imageIndex < imagePositions.length && imagePositions[imageIndex] === index) {
          html += `<img src="${images[imageIndex]}" alt="생성된 이미지 ${imageIndex + 1}" style="max-width: 100%; height: auto; margin: 20px 0;" />\n`
          imageIndex++
        }
      }
    })

    // 남은 이미지 추가
    while (imageIndex < images.length) {
      html += `<img src="${images[imageIndex]}" alt="생성된 이미지 ${imageIndex + 1}" style="max-width: 100%; height: auto; margin: 20px 0;" />\n`
      imageIndex++
    }

    return html
  }

  // 블로그 AI: 상위노출 글 분석
  const handleBlogTopPostsAnalysis = async () => {
    if (!blogAIKeyword.trim()) {
      alert("키워드를 입력해주세요.")
      return
    }

    setIsBlogCrawling(true)
    setBlogTopPosts([])
    setBlogCommonKeywords([])
    setBlogRequiredMorphemes([])
    setBlogExcludedKeywords([])

    try {
      const response = await fetch("/api/moneytaker/crawl-blog-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword: blogAIKeyword,
          count: 3,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "블로그 글 크롤링에 실패했습니다.")
      }

      const data = await response.json()
      if (data.success && data.posts) {
        setBlogTopPosts(data.posts)
        if (data.commonKeywords && Array.isArray(data.commonKeywords)) {
          setBlogCommonKeywords(data.commonKeywords)
        }
      }
    } catch (error) {
      console.error("크롤링 실패:", error)
      alert(error instanceof Error ? error.message : "블로그 글 크롤링에 실패했습니다.")
    } finally {
      setIsBlogCrawling(false)
    }
  }

  // 블로그 AI: 상위 글 구조 분석
  const handleAnalyzePostStructure = async () => {
    if (blogTopPosts.length === 0) {
      alert("먼저 상위노출 글 분석을 진행해주세요.")
      return
    }

    setIsAnalyzingPostStructure(true)
    setPostStructureAnalysis(null)

    try {
      const OPENAI_API_KEY = "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"

      const structurePrompt = `다음 상위노출 블로그 글들의 구조를 분석해주세요:

${blogTopPosts.map((post, idx) => `${idx + 1}. 제목: ${post.title}\n   설명: ${post.description}`).join("\n\n")}

다음 항목들을 분석하여 JSON 형식으로 반환해주세요:
1. 제목 구조 (길이, 키워드 배치, 문체)
2. 본문 구조 (소제목 개수, 소제목 배치 패턴, 문단 길이)
3. 키워드 배치 패턴 (제목, 소제목, 본문에서의 키워드 사용 빈도)
4. 이미지/미디어 배치 패턴 (있는 경우)
5. CTA(행동 유도) 위치 및 방식
6. 전체적인 글의 흐름과 구조

분석 결과를 JSON 형식으로 반환해주세요:
{
  "titleStructure": "제목 구조 분석",
  "bodyStructure": "본문 구조 분석",
  "keywordPattern": "키워드 배치 패턴",
  "mediaPattern": "미디어 배치 패턴",
  "ctaPattern": "CTA 패턴",
  "overallFlow": "전체 흐름 분석"
}`

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "당신은 블로그 글 구조 분석 전문가입니다. 상위노출 글의 구조적 특징을 정확하게 분석합니다.",
            },
            {
              role: "user",
              content: structurePrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "글 구조 분석에 실패했습니다.")
      }

      const data = await response.json()
      const analysisText = data.choices?.[0]?.message?.content || ""

      // JSON 파싱 시도
      let analysis: any = {}
      
      // 객체나 JSON 구조를 제거하고 순수 텍스트만 추출하는 함수
      const extractCleanText = (value: any): string => {
        if (value === null || value === undefined) return '분석 없음'
        if (typeof value === 'string') {
          // JSON 형식의 문자열인 경우 파싱 시도
          try {
            const parsed = JSON.parse(value)
            return extractCleanText(parsed)
          } catch {
            // JSON이 아니면 그대로 반환 (하지만 코드 블록이나 특수 문자 제거)
            return value
              .replace(/```[\s\S]*?```/g, '') // 코드 블록 제거
              .replace(/`[^`]+`/g, '') // 인라인 코드 제거
              .replace(/\{[\s\S]*?\}/g, '') // JSON 객체 제거
              .replace(/\[[\s\S]*?\]/g, '') // 배열 제거
              .replace(/\([\s\S]*?\)/g, '') // 괄호 내용 제거
              .replace(/length|Length|LENGTH/g, '') // length 키워드 제거
              .replace(/[{}[\]]/g, '') // 남은 괄호 제거
              .replace(/\s+/g, ' ') // 연속된 공백 제거
              .trim()
          }
        }
        if (typeof value === 'object') {
          // 객체인 경우 값들만 추출
          const values = Object.values(value)
            .filter(v => v !== null && v !== undefined)
            .map(v => {
              if (typeof v === 'string') {
                return v.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '').replace(/\{[\s\S]*?\}/g, '').replace(/\[[\s\S]*?\]/g, '').replace(/\([\s\S]*?\)/g, '').replace(/length|Length|LENGTH/g, '').trim()
              }
              return String(v).replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '').replace(/\{[\s\S]*?\}/g, '').replace(/\[[\s\S]*?\]/g, '').replace(/\([\s\S]*?\)/g, '').replace(/length|Length|LENGTH/g, '').trim()
            })
            .filter(v => v && v.length > 0)
          return values.join(' ').replace(/\s+/g, ' ').trim() || '분석 없음'
        }
        return String(value)
          .replace(/```[\s\S]*?```/g, '')
          .replace(/`[^`]+`/g, '')
          .replace(/\{[\s\S]*?\}/g, '')
          .replace(/\[[\s\S]*?\]/g, '')
          .replace(/\([\s\S]*?\)/g, '')
          .replace(/length|Length|LENGTH/g, '')
          .trim()
      }
      
      try {
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          // 각 필드를 깔끔한 텍스트로 변환
          analysis = {
            titleStructure: extractCleanText(parsed.titleStructure),
            bodyStructure: extractCleanText(parsed.bodyStructure),
            keywordPattern: extractCleanText(parsed.keywordPattern),
            mediaPattern: extractCleanText(parsed.mediaPattern),
            ctaPattern: extractCleanText(parsed.ctaPattern),
            overallFlow: extractCleanText(parsed.overallFlow),
          }
        } else {
          // JSON 형식이 아니면 텍스트를 정리하여 저장
          const cleanText = extractCleanText(analysisText)
          const textLength = cleanText.length
          const segmentLength = Math.floor(textLength / 6)
          
          analysis = {
            titleStructure: textLength > 0 ? cleanText.substring(0, segmentLength) : "분석 없음",
            bodyStructure: textLength > segmentLength ? cleanText.substring(segmentLength, segmentLength * 2) : "분석 없음",
            keywordPattern: textLength > segmentLength * 2 ? cleanText.substring(segmentLength * 2, segmentLength * 3) : "분석 없음",
            mediaPattern: textLength > segmentLength * 3 ? cleanText.substring(segmentLength * 3, segmentLength * 4) : "분석 필요",
            ctaPattern: textLength > segmentLength * 4 ? cleanText.substring(segmentLength * 4, segmentLength * 5) : "분석 필요",
            overallFlow: textLength > segmentLength * 5 ? cleanText.substring(segmentLength * 5) : "분석 없음",
          }
        }
      } catch (parseError) {
        // 파싱 실패 시 텍스트 정리하여 저장
        const cleanText = extractCleanText(analysisText)
        const textLength = cleanText.length
        const segmentLength = Math.floor(textLength / 6)
        
        analysis = {
          titleStructure: textLength > 0 ? cleanText.substring(0, segmentLength) : "분석 실패",
          bodyStructure: textLength > segmentLength ? cleanText.substring(segmentLength, segmentLength * 2) : "분석 실패",
          keywordPattern: textLength > segmentLength * 2 ? cleanText.substring(segmentLength * 2, segmentLength * 3) : "분석 실패",
          mediaPattern: "분석 필요",
          ctaPattern: "분석 필요",
          overallFlow: textLength > segmentLength * 5 ? cleanText.substring(segmentLength * 5) : "분석 실패",
        }
      }

      setPostStructureAnalysis(analysis)
    } catch (error) {
      console.error("글 구조 분석 실패:", error)
      alert(error instanceof Error ? error.message : "글 구조 분석에 실패했습니다.")
    } finally {
      setIsAnalyzingPostStructure(false)
    }
  }

  // 블로그 AI: 블로그링크 분석
  const handleBlogLinkAnalysis = async () => {
    if (!blogLinkUrl.trim()) {
      alert("블로그 링크를 입력해주세요.")
      return
    }

    setIsAnalyzingBlogLink(true)
    setBlogLinkAnalysis(null)

    try {
      const response = await fetch("/api/moneytaker/analyze-blog-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: blogLinkUrl,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "블로그 링크 분석에 실패했습니다.")
      }

      const data = await response.json()
      if (data.success) {
        setBlogLinkAnalysis(data.analysis)
      }
    } catch (error) {
      console.error("블로그 링크 분석 실패:", error)
      alert(error instanceof Error ? error.message : "블로그 링크 분석에 실패했습니다.")
    } finally {
      setIsAnalyzingBlogLink(false)
    }
  }

  // AI 콘텐츠 생성
  const handleGenerateContent = async () => {
    if (!blogAIKeyword.trim()) {
      alert("키워드를 입력해주세요.")
      return
    }

    // 이전 콘텐츠와 이미지 모두 초기화
    setIsGenerating(true)
    setGeneratedContent("")
    setBlogTitle("")
    setEditedContent("")
    setStreamingContent("")
    setGeneratedImages([]) // 이전 이미지 제거
    setIsEditingContent(false)
    imageGenerationStartedRef.current = false // 이미지 생성 시작 플래그 초기화
    
    console.log("[MoneyTaker] 이전 이미지 제거, 새 콘텐츠 생성 시작")

    try {
      // OpenAI API 키 (하드코딩)
      const OPENAI_API_KEY = "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"

      let prompt = ""
      
      // 선택사항 분석 결과를 프롬프트에 포함
      let analysisContext = ""
      if (blogTopPosts.length > 0 && blogRequiredMorphemes.length > 0) {
        analysisContext += `\n\n상위노출 글 분석 결과:
- 상위 1~3등 글에서 추출한 공통 키워드: ${blogCommonKeywords.join(", ")}
- 필수 포함 형태소: ${blogRequiredMorphemes.join(", ")}
- 상위노출 글 제목 예시:
${blogTopPosts.slice(0, 3).map((post, idx) => `${idx + 1}. ${post.title}`).join("\n")}

위 분석 결과를 참고하여 상위노출 글과 유사한 구조와 키워드 배치를 사용하되, 더 나은 콘텐츠로 작성해주세요.`
      }
      
      if (postStructureAnalysis) {
        analysisContext += `\n\n상위노출 글 구조 분석 결과:
- 제목 구조: ${postStructureAnalysis.titleStructure || "없음"}
- 본문 구조: ${postStructureAnalysis.bodyStructure || "없음"}
- 키워드 배치 패턴: ${postStructureAnalysis.keywordPattern || "없음"}
- 미디어 배치 패턴: ${postStructureAnalysis.mediaPattern || "없음"}
- CTA 패턴: ${postStructureAnalysis.ctaPattern || "없음"}
- 전체 흐름: ${postStructureAnalysis.overallFlow || "없음"}

위 구조 분석 결과를 참고하여 동일한 구조 패턴을 따르되, 더 나은 콘텐츠로 작성해주세요.`
      }
      
      if (blogLinkAnalysis) {
        analysisContext += `\n\n블로그 링크 분석 결과:
- 분석된 키워드: ${blogLinkAnalysis.keywords?.join(", ") || "없음"}
- 주요 내용: ${blogLinkAnalysis.summary || "없음"}

위 분석 결과를 참고하여 유사한 스타일과 키워드를 활용하되, 더 개선된 콘텐츠로 작성해주세요.`
      }
      
      if (postStructureAnalysis) {
        analysisContext += `\n\n상위노출 글 구조 분석 결과:
- 제목 구조: ${postStructureAnalysis.titleStructure || "없음"}
- 본문 구조: ${postStructureAnalysis.bodyStructure || "없음"}
- 키워드 배치 패턴: ${postStructureAnalysis.keywordPattern || "없음"}
- 미디어 배치 패턴: ${postStructureAnalysis.mediaPattern || "없음"}
- CTA 패턴: ${postStructureAnalysis.ctaPattern || "없음"}
- 전체 흐름: ${postStructureAnalysis.overallFlow || "없음"}

위 구조 분석 결과를 참고하여 동일한 구조 패턴을 따르되, 더 나은 콘텐츠로 작성해주세요.`
      }

      if (workflow === "automation") {
        prompt = `다음 키워드로 블로그 글을 작성해주세요. 머니테이커의 블로그 공식을 적용하여 키워드 상위노출과 전환을 동시에 잡는 글을 작성해주세요.

키워드: ${blogAIKeyword}${analysisContext}

요구사항:
1. 먼저 SEO 최적화된 제목을 작성해주세요 (제목: 로 시작)
2. 그 다음 2000자 이상의 상세한 본문을 작성해주세요
3. 독자의 니즈를 정확히 파악한 콘텐츠
4. 자연스러운 키워드 배치${blogRequiredMorphemes.length > 0 ? `\n5. 필수 포함 형태소(${blogRequiredMorphemes.join(", ")})를 각각 1회 이상 포함` : ""}
${blogRequiredMorphemes.length > 0 ? "6" : "5"}. 행동 유도(CTA) 포함
${blogRequiredMorphemes.length > 0 ? "7" : "6"}. 전문적이면서도 읽기 쉬운 문체

작성 형식:
제목: [여기에 SEO 최적화된 제목 작성]

[여기에 본문 내용 작성]`
      } else {
        prompt = `다음 정보를 바탕으로 블로그 글을 작성해주세요.

키워드: ${blogAIKeyword}
사업체명: ${personaInfo.businessName || "미입력"}
업종: ${personaInfo.industry || "미입력"}
대표명: ${personaInfo.representativeName || "미입력"}
판매 위치: ${personaInfo.salesLocation || "미입력"}
업체 차별점: ${personaInfo.differentiator || "미입력"}
고객 특징: ${personaInfo.customerCharacteristics || "미입력"}${analysisContext}

요구사항:
1. 먼저 SEO 최적화된 제목을 작성해주세요 (제목: 로 시작)
2. 그 다음 2000자 이상의 전문적인 본문을 작성해주세요
3. 페르소나 정보를 활용한 맞춤형 콘텐츠
4. 업체 차별점을 강조
5. 타겟 고객층에게 어필하는 내용
6. 전환율 극대화를 위한 설득력 있는 문구
7. 자연스러운 키워드 배치${blogRequiredMorphemes.length > 0 ? `\n8. 필수 포함 형태소(${blogRequiredMorphemes.join(", ")})를 각각 1회 이상 포함` : ""}

작성 형식:
제목: [여기에 SEO 최적화된 제목 작성]

[여기에 본문 내용 작성]`
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "당신은 블로그 콘텐츠 전문 작가입니다. SEO 최적화와 전환율을 고려한 고품질 블로그 글을 작성합니다.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "콘텐츠 생성에 실패했습니다.")
      }

      const data = await response.json()
      const fullContent = data.choices?.[0]?.message?.content || "콘텐츠를 생성할 수 없습니다."

      // 제목과 본문 분리 (제목: 형식으로 시작하는 경우)
      const lines = fullContent.split("\n")
      let title = ""
      let content = ""

      // "제목:" 또는 "제목 :" 형식으로 시작하는 경우
      const titlePattern = /^제목\s*[:：]\s*(.+)$/i
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim()
        const titleMatch = line.match(titlePattern)
        if (titleMatch) {
          title = titleMatch[1].trim()
          // 제목 다음 줄부터 본문 시작
          content = lines.slice(i + 1).join("\n").trim()
          break
        }
      }

      // 제목을 찾지 못한 경우 첫 줄이 짧으면 제목으로 간주
      if (!title && lines.length > 0) {
        const firstLine = lines[0].trim()
        if (firstLine.length > 0 && firstLine.length < 100 && !firstLine.includes("##") && !firstLine.includes("**")) {
          title = firstLine.replace(/^#+\s*/, "").trim()
          content = lines.slice(1).join("\n").trim()
        } else {
          // 제목이 없으면 본문 전체를 사용하고, AI로 제목 생성
          content = fullContent.trim()
          try {
            const titleResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content: "당신은 SEO 최적화된 블로그 제목 전문가입니다. 키워드를 자연스럽게 포함한 매력적인 제목을 작성합니다.",
                  },
                  {
                    role: "user",
                    content: `키워드: ${blogAIKeyword}\n본문 내용: ${content.substring(0, 500)}\n\n위 정보를 바탕으로 SEO 최적화된 블로그 제목을 하나만 생성해주세요. 제목만 작성하고 다른 설명은 하지 마세요.`,
                  },
                ],
                temperature: 0.7,
                max_tokens: 100,
              }),
            })

            if (titleResponse.ok) {
              const titleData = await titleResponse.json()
              title = titleData.choices?.[0]?.message?.content?.trim() || blogAIKeyword || "AI 생성 블로그 포스트"
            } else {
              title = blogAIKeyword || "AI 생성 블로그 포스트"
            }
          } catch (error) {
            console.error("제목 생성 실패:", error)
            title = blogAIKeyword || "AI 생성 블로그 포스트"
          }
        }
      }

      // 제목이 여전히 없으면 키워드로 설정
      if (!title) {
        title = blogAIKeyword || "AI 생성 블로그 포스트"
      }

      setBlogTitle(title)
      setEditedContent(content) // 편집용 콘텐츠도 설정

      // 이미지 생성은 타이핑 애니메이션 중에 시작 (병렬 처리)

      // 타이핑 애니메이션 효과를 위한 시뮬레이션
      setStreamingContent("")
      let currentIndex = 0
      const typingInterval = setInterval(() => {
        if (currentIndex < content.length) {
          const chunk = content.slice(0, currentIndex + 1)
          setStreamingContent(chunk)
          currentIndex += Math.floor(Math.random() * 3) + 1 // 1-3 글자씩 랜덤하게
          
          // 글의 일정 부분이 생성되면 이미지 프롬프트 생성 시작 (병렬 처리)
          if (imageMode === "ai" && currentIndex > content.length * 0.3 && !imageGenerationStartedRef.current) {
            // 첫 30% 생성되면 이미지 프롬프트 생성 시작
            const partialContent = content.substring(0, currentIndex)
            generateImagesForContent(partialContent)
          }
        } else {
          clearInterval(typingInterval)
          setGeneratedContent(content)
          setEditedContent(content) // 편집용 콘텐츠도 업데이트
          setStreamingContent("")
          
          // 제목이 없으면 키워드로 설정
          if (!blogTitle) {
            setBlogTitle(blogAIKeyword || "AI 생성 블로그 포스트")
          }
          
          // 콘텐츠 생성 완료
          // 이미지 생성은 병렬로 진행 중이므로, 콘텐츠 생성 완료 후에도 계속 진행
          if (imageMode !== "ai") {
            setIsGenerating(false)
          } else {
            // AI 모드일 때는 이미지 생성이 완료될 때까지 대기하지 않음 (병렬 처리)
            // 콘텐츠 생성이 완료되면 즉시 isGenerating을 false로 설정 (이미지는 계속 생성됨)
            setIsGenerating(false)
          }
        }
      }, 20) // 20ms마다 업데이트 (타이핑 속도 조절)

      // 에러 발생 시 interval 정리를 위한 저장
      ;(window as any).__typingInterval = typingInterval
    } catch (error) {
      console.error("콘텐츠 생성 실패:", error)
      // 에러 발생 시 interval 정리
      if ((window as any).__typingInterval) {
        clearInterval((window as any).__typingInterval)
        ;(window as any).__typingInterval = null
      }
      setStreamingContent("")
      alert(error instanceof Error ? error.message : "콘텐츠 생성에 실패했습니다.")
      setIsGenerating(false)
    }
  }

  // 체험단 AI 가이드 생성 함수
  const handleGenerateGuide = async () => {
    if (experienceMode === "auto" && !placeUrl.trim()) {
      alert("플레이스 URL을 입력해주세요.")
      return
    }
    if (experienceMode === "manual") {
      if (!experienceInfo.businessName.trim() || !experienceInfo.targetKeyword.trim()) {
        alert("업체명과 목표 키워드를 입력해주세요.")
        return
      }
    }

    setIsGeneratingGuide(true)
    setGeneratedGuide("")

    try {
      const OPENAI_API_KEY = "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"

      let prompt = ""
      if (experienceMode === "auto") {
        // 자동 모드: 플레이스 URL에서 정보 추출 (실제로는 URL 파싱 필요)
        prompt = `플레이스 URL: ${placeUrl}
목표 키워드: ${experienceInfo.targetKeyword}

위 정보를 바탕으로 체험단/기자단용 상위노출 가이드를 작성해주세요.`
      } else {
        // 수동 모드
        prompt = `업체명: ${experienceInfo.businessName}
서비스 내용: ${experienceInfo.serviceContent}
업체 특징: ${experienceInfo.businessFeatures}
모집 인원: ${experienceInfo.recruitmentCount}
목표 키워드: ${experienceInfo.targetKeyword}

위 정보를 바탕으로 체험단/기자단용 상위노출 가이드를 작성해주세요.`
      }

      const guidePrompt = `${prompt}

다음 형식으로 1PAGE 가이드를 작성해주세요:

1. 업체명
2. 블로그 내 필수 키워드 (메인 키워드: 제목 + 본문에 5회 이상 사용, 서브 키워드 제안)
3. 블로그 글 제목 예시
4. 블로그 글 작성 조건 (글자 수: 1300자 이상, 맞춤법/띄어쓰기 철저, 사진 15장 이상, 영상 1개)
5. 본문에서 어필할 내용 (제품/공간의 특징, 타사 대비 차별점, 실제 사용 후기 느낌, 타겟 공감 요소)
6. 필수 링크 (스마트스토어, 상세페이지 링크, 지도 링크)
7. 마감 기한 (제품 수령 or 체험 후 3일 이내 포스팅 제출)
8. 주의사항 및 저작권 안내 (포스팅 3개월 이상 유지, 가이드 미준수 시 수정/삭제 요청 가능, 사진/영상 브랜드 홍보용 사용 가능)

가이드는 실제 체험단에게 바로 전달할 수 있도록 명확하고 구체적으로 작성해주세요.`

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "당신은 체험단/기자단 마케팅 전문가입니다. 상위노출을 위한 실전 가이드를 작성합니다.",
            },
            {
              role: "user",
              content: guidePrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "가이드 생성에 실패했습니다.")
      }

      const data = await response.json()
      const guide = data.choices?.[0]?.message?.content || "가이드를 생성할 수 없습니다."
      setGeneratedGuide(guide)
    } catch (error) {
      console.error("가이드 생성 실패:", error)
      alert(error instanceof Error ? error.message : "가이드 생성에 실패했습니다.")
    } finally {
      setIsGeneratingGuide(false)
    }
  }

  // 체험단 구인글 생성 함수
  const handleGenerateRecruitment = async () => {
    if (!generatedGuide.trim()) {
      alert("먼저 상위노출 가이드를 생성해주세요.")
      return
    }

    setIsGeneratingRecruitment(true)
    setGeneratedRecruitment("")

    try {
      const OPENAI_API_KEY = "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"

      const recruitmentPrompt = `다음 체험단 가이드를 바탕으로 오픈채팅 모집글을 작성해주세요:

${generatedGuide}

아래 형식으로 작성해주세요:
- 제목 (이모지 포함)
- 체험 혜택 요약
- 모집 대상
- 후기 작성 조건
- 신청 링크 안내 (네이버폼 or 구글폼)
- 지도 링크 있을 경우, 지역명과 함께 명시

친근하고 매력적인 톤으로 작성해주세요.`

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "당신은 체험단 모집 전문가입니다. 매력적이고 친근한 톤으로 모집글을 작성합니다.",
            },
            {
              role: "user",
              content: recruitmentPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "구인글 생성에 실패했습니다.")
      }

      const data = await response.json()
      const recruitment = data.choices?.[0]?.message?.content || "구인글을 생성할 수 없습니다."
      setGeneratedRecruitment(recruitment)
    } catch (error) {
      console.error("구인글 생성 실패:", error)
      alert(error instanceof Error ? error.message : "구인글 생성에 실패했습니다.")
    } finally {
      setIsGeneratingRecruitment(false)
    }
  }

  // 가이드 다운로드 함수 (텍스트 파일)
  const handleDownloadGuide = () => {
    if (!generatedGuide.trim()) {
      alert("다운로드할 가이드가 없습니다.")
      return
    }

    const blob = new Blob([generatedGuide], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `체험단_가이드_${experienceInfo.businessName || "업체명"}_${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 기자단 AI: 상위 1~3등 글 크롤링
  const handleCrawlTopPosts = async () => {
    if (!reporterKeyword.trim()) {
      alert("목표 키워드를 입력해주세요.")
      return
    }

    setIsCrawling(true)
    setTopPosts([])
    setCommonKeywords([])
    setRequiredMorphemes([])
    setExcludedKeywords([])

    try {
      const response = await fetch("/api/moneytaker/crawl-blog-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword: reporterKeyword,
          count: 3, // 상위 1~3등
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "블로그 글 크롤링에 실패했습니다.")
      }

      const data = await response.json()
      if (data.success && data.posts) {
        setTopPosts(data.posts)

        // API에서 추출된 키워드 사용
        if (data.commonKeywords && Array.isArray(data.commonKeywords)) {
          setCommonKeywords(data.commonKeywords)
        } else {
          // API에서 키워드가 없으면 기본 추출 방식 사용 (fallback)
          const allText = data.posts
            .map((post: any) => `${post.title || ""} ${post.description || ""}`)
            .join(" ")
            .toLowerCase()

          const words = allText.match(/[가-힣]{2,}/g) || []
          const wordCount: Record<string, number> = {}
          words.forEach((word: string) => {
            wordCount[word] = (wordCount[word] || 0) + 1
          })

          const common = Object.entries(wordCount)
            .filter(([_, count]) => count >= 2)
            .sort(([_, a], [__, b]) => (b as number) - (a as number))
            .slice(0, 20)
            .map(([word]) => word)

          setCommonKeywords(common)
        }
      }
    } catch (error) {
      console.error("크롤링 실패:", error)
      alert(error instanceof Error ? error.message : "블로그 글 크롤링에 실패했습니다.")
    } finally {
      setIsCrawling(false)
    }
  }

  // 기자단 AI: 원고 생성
  const handleGenerateDraft = async () => {
    if (!reporterKeyword.trim()) {
      alert("목표 키워드를 입력해주세요.")
      return
    }

    if (requiredMorphemes.length === 0) {
      alert("필수 포함 형태소를 선택해주세요.")
      return
    }

    setIsGeneratingDraft(true)
    setGeneratedDraft("")
    setDraftTitle("")
    setReporterImages([])

    try {
      const OPENAI_API_KEY = "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"

      const prompt = `목표 키워드: ${reporterKeyword}
필수 포함 형태소: ${requiredMorphemes.join(", ")}

위 정보를 바탕으로 약 2,000자 정도의 블로그 원고를 작성해주세요.

요구사항:
1. 목표 키워드를 본문에 7회 이상 자연스럽게 포함
2. 필수 포함 형태소를 각각 1회 이상 포함
3. 제목도 포함하여 작성 (제목은 첫 줄에 작성)
4. SEO 최적화된 구조
5. 읽기 쉽고 전문적인 문체
6. 구체적이고 실용적인 내용

원고를 작성해주세요.`

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "당신은 SEO 최적화된 블로그 원고 전문 작가입니다. 키워드를 자연스럽게 포함한 고품질 원고를 작성합니다.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 3000,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "원고 생성에 실패했습니다.")
      }

      const data = await response.json()
      const fullContent = data.choices?.[0]?.message?.content || "원고를 생성할 수 없습니다."

      // 제목과 본문 분리
      const lines = fullContent.split("\n")
      let title = ""
      let content = ""

      // 첫 번째 줄이 짧으면 제목으로 간주
      if (lines[0].trim().length < 100) {
        title = lines[0].replace(/^#+\s*/, "").trim()
        content = lines.slice(1).join("\n").trim()
      } else {
        title = reporterKeyword
        content = fullContent
      }

      setDraftTitle(title)
      setGeneratedDraft(content)

      // 이미지 생성 (AI 생성 모드인 경우)
      if (reporterImageMode === "generate") {
        generateReporterImages(content)
      }
    } catch (error) {
      console.error("원고 생성 실패:", error)
      alert(error instanceof Error ? error.message : "원고 생성에 실패했습니다.")
    } finally {
      setIsGeneratingDraft(false)
    }
  }

  // 기자단 AI: 이미지 생성
  const generateReporterImages = async (content: string) => {
    try {
      const OPENAI_API_KEY = "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"

      // 이미지 프롬프트 생성
      const promptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "당신은 이미지 프롬프트 생성 전문가입니다. 블로그 원고 내용에 맞는 이미지 프롬프트를 생성합니다.",
            },
            {
              role: "user",
              content: `다음 블로그 원고 내용을 바탕으로 이미지 프롬프트 3~4개를 생성해주세요. 각 프롬프트는 한 줄씩 작성해주세요.

원고 내용:
${content.substring(0, 1000)}

각 프롬프트는 한국 사람, 한국 모습, 자연스러운, 현실적인, 일상적인, 라이프스타일 사진 스타일로 작성해주세요.`,
            },
          ],
          temperature: 0.8,
          max_tokens: 500,
        }),
      })

      if (promptResponse.ok) {
        const promptData = await promptResponse.json()
        const promptsText = promptData.choices?.[0]?.message?.content || ""
        const imagePrompts = promptsText
          .split("\n")
          .map((p: string) => p.trim())
          .filter((p: string) => p.length > 0 && !p.match(/^\d+\./))
          .slice(0, 4)

        // 각 프롬프트로 이미지 생성
        imagePrompts.forEach(async (prompt: string) => {
          try {
            const imageResponse = await fetch("/api/moneytaker/generate-image", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ prompt }),
            })

            if (imageResponse.ok) {
              const data = await imageResponse.json()
              if (data.success && data.imageUrl) {
                setReporterImages((prev) => [...prev, data.imageUrl])
              }
            }
          } catch (error) {
            console.error("이미지 생성 실패:", error)
          }
        })
      }
    } catch (error) {
      console.error("이미지 프롬프트 생성 실패:", error)
    }
  }

  // 기자단 AI: 문서 저장
  const handleSaveReporterDocument = () => {
    if (!generatedDraft.trim()) {
      alert("저장할 원고가 없습니다.")
      return
    }

    const fullDocument = `${draftTitle}\n\n${generatedDraft}`
    const blob = new Blob([fullDocument], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `기자단_원고_${reporterKeyword || "키워드"}_${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 기자단 AI: 계약서 생성
  const handleGenerateContract = () => {
    if (!contractInfo.date || !contractInfo.businessName || !contractInfo.amount || !contractInfo.period) {
      alert("계약서 정보를 모두 입력해주세요.")
      return
    }

    const contractText = `계약서

계약일자: ${contractInfo.date}
업체명: ${contractInfo.businessName}
계약금액: ${contractInfo.amount}원
계약기간: ${contractInfo.period}

위 내용으로 계약을 체결합니다.

계약자: ${contractInfo.businessName}
날짜: ${contractInfo.date}`

    const blob = new Blob([contractText], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `계약서_${contractInfo.businessName}_${contractInfo.date}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 기자단 AI: 견적서 생성
  const handleGenerateQuote = () => {
    if (!quoteInfo.businessName || quoteInfo.items.length === 0) {
      alert("업체명과 항목을 입력해주세요.")
      return
    }

    const total = quoteInfo.items.reduce((sum, item) => sum + item.quantity * item.price, 0)
    const quoteText = `견적서

업체명: ${quoteInfo.businessName}
견적일자: ${new Date().toISOString().split("T")[0]}

항목:
${quoteInfo.items
  .map((item, index) => `${index + 1}. ${item.name} - 수량: ${item.quantity}, 단가: ${item.price.toLocaleString()}원, 소계: ${(item.quantity * item.price).toLocaleString()}원`)
  .join("\n")}

총액: ${total.toLocaleString()}원`

    const blob = new Blob([quoteText], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `견적서_${quoteInfo.businessName}_${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (activeTab !== "keyword-analysis" && activeTab !== "blog-ai" && activeTab !== "experience-ai" && activeTab !== "reporter-ai") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <div className={`${isSidebarCollapsed ? "ml-20" : "ml-72"} transition-all duration-300 p-12`}>
          <div className="max-w-4xl">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              {activeTab === "history" && "히스토리"}
              {activeTab === "settings" && "설정"}
            </h2>
            <p className="text-slate-500 text-lg">곧 구현될 예정입니다.</p>
          </div>
        </div>
      </div>
    )
  }

  // 블로그 AI 탭 렌더링
  if (activeTab === "blog-ai") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <div className={`${isSidebarCollapsed ? "ml-20" : "ml-72"} transition-all duration-300 p-8`}>
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              당신의 글을 수익으로 전환하세요
            </h1>
            <p className="text-slate-500 text-lg">
              AI 기반 콘텐츠 생성, 즉각적인 상위 노출 결과
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* 왼쪽: 설정 영역 */}
            <div className="col-span-7 space-y-6">
              {/* Step 1: 키워드 입력 */}
              <Card className="border-0 shadow-xl bg-white">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-indigo-600 mb-4">
                    Step 1. 키워드를 입력하세요
                  </h2>
                  <Input
                    value={blogAIKeyword}
                    onChange={(e) => setBlogAIKeyword(e.target.value)}
                    placeholder="예: 강남한의원"
                    className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500"
                  />
                </CardContent>
              </Card>

              {/* Step 2: 워크플로우 선택 */}
              <Card className="border-0 shadow-xl bg-white">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-indigo-600 mb-4">
                    Step 2. 워크플로우를 선택하세요
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <button
                      onClick={() => setWorkflow("automation")}
                      className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                        workflow === "automation"
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <Zap className="w-6 h-6 mb-2 mx-auto" />
                      <div className="font-semibold">자동화 모드</div>
                    </button>
                    <button
                      onClick={() => setWorkflow("custom")}
                      className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                        workflow === "custom"
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <Settings className="w-6 h-6 mb-2 mx-auto" />
                      <div className="font-semibold">커스텀 모드</div>
                    </button>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-4 flex items-start gap-3">
                    <Info className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-700">
                      {workflow === "automation"
                        ? "머니테이커만의 블로그 공식을 적용하여, 키워드 상위노출과 전환을 동시에 잡는 글을 자동으로 완성합니다."
                        : "페르소나 정보를 직접 입력하여 전환율을 극대화하는 커스텀 전문 콘텐츠를 생성합니다."}
                    </p>
                  </div>

                  {/* 커스텀 모드: 페르소나 정보 입력 */}
                  {workflow === "custom" && (
                    <div className="mt-6 space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-indigo-600">페르소나 정보 입력</h3>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            저장하기
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-300 text-slate-600 hover:bg-slate-50"
                          >
                            <FolderOpen className="w-4 h-4 mr-2" />
                            불러오기
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-slate-600 mb-2 block">사업체명</label>
                          <Input
                            value={personaInfo.businessName}
                            onChange={(e) =>
                              setPersonaInfo({ ...personaInfo, businessName: e.target.value })
                            }
                            placeholder="ex) 강남한의원"
                            className="bg-slate-50 border-slate-200 text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-slate-600 mb-2 block">업종</label>
                          <Input
                            value={personaInfo.industry}
                            onChange={(e) =>
                              setPersonaInfo({ ...personaInfo, industry: e.target.value })
                            }
                            placeholder="ex) 한의원"
                            className="bg-slate-50 border-slate-200 text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-slate-600 mb-2 block">대표명</label>
                          <Input
                            value={personaInfo.representativeName}
                            onChange={(e) =>
                              setPersonaInfo({ ...personaInfo, representativeName: e.target.value })
                            }
                            placeholder="ex) 홍길동"
                            className="bg-slate-50 border-slate-200 text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-slate-600 mb-2 block">판매 위치</label>
                          <Input
                            value={personaInfo.salesLocation}
                            onChange={(e) =>
                              setPersonaInfo({ ...personaInfo, salesLocation: e.target.value })
                            }
                            placeholder="ex) 서울 강남구"
                            className="bg-slate-50 border-slate-200 text-slate-900"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-slate-600 mb-2 block">업체 차별점</label>
                        <Textarea
                          value={personaInfo.differentiator}
                          onChange={(e) =>
                            setPersonaInfo({ ...personaInfo, differentiator: e.target.value })
                          }
                          placeholder="ex) 초진 시 30분 이상 1:1 맞춤 상담으로 증상·생활습관·체질을 함께 분석합니다."
                          className="bg-slate-50 border-slate-200 text-slate-900 min-h-[100px]"
                        />
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          차별점은 숫자로 표현될 수 있는 것이 좋습니다.
                        </p>
                      </div>
                      <div>
                        <label className="text-sm text-slate-600 mb-2 block">고객 특징</label>
                        <Textarea
                          value={personaInfo.customerCharacteristics}
                          onChange={(e) =>
                            setPersonaInfo({ ...personaInfo, customerCharacteristics: e.target.value })
                          }
                          placeholder="ex) 서울에 거주하거나 근무하며 만성 통증·근골격계 질환으로 일상에 불편을 겪는 20~60대입니다."
                          className="bg-slate-50 border-slate-200 text-slate-900 min-h-[100px]"
                        />
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          "누가 / 어떤 상태에서 / 왜 찾아오는지" 한 문장에 담아주세요.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Step 3: 이미지 생성 방식 */}
              <Card className="border-0 shadow-xl bg-white">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-indigo-600 mb-4">
                    Step 3. 이미지 생성 방식을 선택하세요
                  </h2>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <button
                      onClick={() => setImageMode("ai")}
                      className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                        imageMode === "ai"
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <Sparkles className="w-6 h-6 mb-2 mx-auto" />
                      <div className="font-semibold">AI 생성</div>
                    </button>
                    <button
                      onClick={() => setImageMode("wash")}
                      className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                        imageMode === "wash"
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <ImageIcon className="w-6 h-6 mb-2 mx-auto" />
                      <div className="font-semibold">이미지 세탁</div>
                    </button>
                    <button
                      onClick={() => setImageMode("none")}
                      className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                        imageMode === "none"
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <X className="w-6 h-6 mb-2 mx-auto" />
                      <div className="font-semibold">이미지 없음</div>
                    </button>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-4 flex items-start gap-3">
                    <ImageIcon className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-700">
                      {imageMode === "ai"
                        ? "AI를 활용하여 원고에 맞는 고품질 이미지를 자동으로 생성합니다."
                        : imageMode === "wash"
                        ? "업로드한 이미지를 세탁하여 고유한 이미지로 변환합니다."
                        : "이미지 없이 텍스트만으로 콘텐츠를 생성합니다."}
                    </p>
                  </div>

                  {/* 이미지 세탁 모드: 업로드 영역 및 옵션 */}
                  {imageMode === "wash" && (
                    <div className="mt-6 space-y-4">
                      <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-indigo-500 transition-colors cursor-pointer"
                      >
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="image-upload"
                        />
                        <label htmlFor="image-upload" className="cursor-pointer">
                          <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                          <p className="text-slate-700 font-medium mb-2">이곳에 이미지를 올려주세요</p>
                          <p className="text-sm text-slate-500">폴더를 선택하거나 이미지를 드래그하세요</p>
                        </label>
                      </div>
                      {uploadedImages.length > 0 && (
                        <div className="text-sm text-slate-600">
                          {uploadedImages.length}개의 이미지가 업로드되었습니다.
                        </div>
                      )}

                      <div className="mt-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">사진 세탁 옵션</h3>
                        <div className="space-y-3">
                          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer">
                            <Checkbox
                              checked={washOptions.transparentOverlay}
                              onCheckedChange={(checked) =>
                                setWashOptions({ ...washOptions, transparentOverlay: !!checked })
                              }
                              className="border-slate-300"
                            />
                            <span className="text-slate-700">반투명 겹치기</span>
                          </label>
                          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer">
                            <Checkbox
                              checked={washOptions.angleRotation}
                              onCheckedChange={(checked) =>
                                setWashOptions({ ...washOptions, angleRotation: !!checked })
                              }
                              className="border-slate-300"
                            />
                            <span className="text-slate-700">각도 회전(랜덤)</span>
                          </label>
                          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer">
                            <Checkbox
                              checked={washOptions.frame}
                              onCheckedChange={(checked) =>
                                setWashOptions({ ...washOptions, frame: !!checked })
                              }
                              className="border-slate-300"
                            />
                            <span className="text-slate-700">프레임 씌우기 (랜덤)</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 선택사항: 상위노출 분석 및 블로그링크 분석 */}
              <Card className="border-0 shadow-xl bg-white border-2 border-dashed border-indigo-200">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-indigo-600 mb-2">
                    선택사항 (선택)
                  </h2>
                  <p className="text-sm text-slate-500 mb-4">
                    상위노출 글 분석이나 블로그 링크 분석을 통해 더 정확한 콘텐츠를 생성할 수 있습니다.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* 상위노출 글 분석 */}
                    <div className="space-y-3">
                      <Button
                        onClick={handleBlogTopPostsAnalysis}
                        disabled={isBlogCrawling || !blogAIKeyword.trim()}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white disabled:opacity-50"
                      >
                        {isBlogCrawling ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            분석 중...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4 mr-2" />
                            상위노출 글 분석 (1~3위)
                          </>
                        )}
                      </Button>
                      
                      {blogTopPosts.length > 0 && (
                        <div className="space-y-2 mt-3">
                          <div className="text-xs font-semibold text-slate-700">상위 1~3등 글</div>
                          <div className="space-y-1">
                            {blogTopPosts.slice(0, 3).map((post, index) => (
                              <div key={index} className="p-2 bg-slate-50 rounded text-xs flex items-center justify-between gap-2">
                                <div className="font-medium text-slate-900 truncate flex-1">{post.title}</div>
                                {post.link && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-xs flex-shrink-0"
                                    onClick={() => window.open(post.link, "_blank")}
                                  >
                                    <ArrowRight className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                          
                          {blogTopPosts.length > 0 && (
                            <Button
                              onClick={handleAnalyzePostStructure}
                              disabled={isAnalyzingPostStructure}
                              size="sm"
                              variant="outline"
                              className="w-full mt-3 text-xs"
                            >
                              {isAnalyzingPostStructure ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                  구조 분석 중...
                                </>
                              ) : (
                                <>
                                  <FileText className="w-3 h-3 mr-2" />
                                  글 구조 분석
                                </>
                              )}
                            </Button>
                          )}
                          
                          {postStructureAnalysis && (
                            <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                              <div className="font-semibold text-indigo-900 mb-3 text-sm">구조 분석 완료</div>
                              <div className="space-y-3 text-xs">
                                {postStructureAnalysis.titleStructure && (
                                  <div className="bg-white p-2 rounded border border-indigo-100">
                                    <div className="font-semibold text-indigo-800 mb-1">📌 제목 구조</div>
                                    <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                      {typeof postStructureAnalysis.titleStructure === 'string' 
                                        ? postStructureAnalysis.titleStructure 
                                        : JSON.stringify(postStructureAnalysis.titleStructure, null, 2)}
                                    </div>
                                  </div>
                                )}
                                {postStructureAnalysis.bodyStructure && (
                                  <div className="bg-white p-2 rounded border border-indigo-100">
                                    <div className="font-semibold text-indigo-800 mb-1">📝 본문 구조</div>
                                    <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                      {typeof postStructureAnalysis.bodyStructure === 'string' 
                                        ? postStructureAnalysis.bodyStructure 
                                        : JSON.stringify(postStructureAnalysis.bodyStructure, null, 2)}
                                    </div>
                                  </div>
                                )}
                                {postStructureAnalysis.keywordPattern && (
                                  <div className="bg-white p-2 rounded border border-indigo-100">
                                    <div className="font-semibold text-indigo-800 mb-1">🔑 키워드 패턴</div>
                                    <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                      {typeof postStructureAnalysis.keywordPattern === 'string' 
                                        ? postStructureAnalysis.keywordPattern 
                                        : JSON.stringify(postStructureAnalysis.keywordPattern, null, 2)}
                                    </div>
                                  </div>
                                )}
                                {postStructureAnalysis.mediaPattern && postStructureAnalysis.mediaPattern !== '분석 필요' && (
                                  <div className="bg-white p-2 rounded border border-indigo-100">
                                    <div className="font-semibold text-indigo-800 mb-1">🖼️ 미디어 패턴</div>
                                    <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                      {typeof postStructureAnalysis.mediaPattern === 'string' 
                                        ? postStructureAnalysis.mediaPattern 
                                        : JSON.stringify(postStructureAnalysis.mediaPattern, null, 2)}
                                    </div>
                                  </div>
                                )}
                                {postStructureAnalysis.ctaPattern && postStructureAnalysis.ctaPattern !== '분석 필요' && (
                                  <div className="bg-white p-2 rounded border border-indigo-100">
                                    <div className="font-semibold text-indigo-800 mb-1">📢 CTA 패턴</div>
                                    <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                      {typeof postStructureAnalysis.ctaPattern === 'string' 
                                        ? postStructureAnalysis.ctaPattern 
                                        : JSON.stringify(postStructureAnalysis.ctaPattern, null, 2)}
                                    </div>
                                  </div>
                                )}
                                {postStructureAnalysis.overallFlow && (
                                  <div className="bg-white p-2 rounded border border-indigo-100">
                                    <div className="font-semibold text-indigo-800 mb-1">🌊 전체 흐름</div>
                                    <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                      {typeof postStructureAnalysis.overallFlow === 'string' 
                                        ? postStructureAnalysis.overallFlow 
                                        : JSON.stringify(postStructureAnalysis.overallFlow, null, 2)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {blogCommonKeywords.length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-slate-700 mb-2">공통 키워드</div>
                              <div className="flex flex-wrap gap-1">
                                {blogCommonKeywords.slice(0, 10).map((keyword, index) => (
                                  <Badge
                                    key={index}
                                    className={`cursor-pointer text-xs ${
                                      blogRequiredMorphemes.includes(keyword)
                                        ? "bg-orange-500 text-white"
                                        : blogExcludedKeywords.includes(keyword)
                                        ? "bg-red-200 text-red-700"
                                        : "bg-slate-200 text-slate-700"
                                    }`}
                                    onClick={() => {
                                      if (blogExcludedKeywords.includes(keyword)) {
                                        setBlogExcludedKeywords(blogExcludedKeywords.filter((k) => k !== keyword))
                                      } else if (blogRequiredMorphemes.includes(keyword)) {
                                        setBlogRequiredMorphemes(blogRequiredMorphemes.filter((k) => k !== keyword))
                                        setBlogExcludedKeywords([...blogExcludedKeywords, keyword])
                                      } else {
                                        setBlogRequiredMorphemes([...blogRequiredMorphemes, keyword])
                                      }
                                    }}
                                  >
                                    {keyword}
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                클릭: 주황색(필수 포함) → 빨간색(제외) → 회색(일반)
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* 블로그링크 분석 */}
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Input
                          value={blogLinkUrl}
                          onChange={(e) => setBlogLinkUrl(e.target.value)}
                          placeholder="블로그 링크를 입력하세요"
                          className="bg-slate-50 border-slate-200 text-slate-900 text-sm"
                        />
                        <Button
                          onClick={handleBlogLinkAnalysis}
                          disabled={isAnalyzingBlogLink || !blogLinkUrl.trim()}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white disabled:opacity-50"
                        >
                          {isAnalyzingBlogLink ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              분석 중...
                            </>
                          ) : (
                            <>
                              <FileText className="w-4 h-4 mr-2" />
                              블로그링크 분석
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {blogLinkAnalysis && (
                        <div className="mt-3 p-3 bg-slate-50 rounded text-xs">
                          <div className="font-semibold text-slate-900 mb-1">분석 완료</div>
                          <div className="text-slate-600">
                            키워드: {blogLinkAnalysis.keywords?.slice(0, 5).join(", ") || "없음"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 생성 버튼 */}
              <Button
                onClick={handleGenerateContent}
                disabled={isGenerating || !blogAIKeyword.trim()}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-6 text-lg font-semibold shadow-lg shadow-indigo-500/30 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    AI 콘텐츠 생성하기
                  </>
                )}
              </Button>

              {/* 네이버 자동 업로드 버튼 */}
              {generatedContent && (
                <Button
                  onClick={handleOpenNaverUploadDialog}
                  disabled={isUploadingToNaver || !generatedContent.trim()}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-6 text-lg font-semibold shadow-lg shadow-green-500/30 disabled:opacity-50 mt-3"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  네이버 자동 업로드
                </Button>
              )}
            </div>

            {/* 오른쪽: 생성된 콘텐츠 미리보기 */}
            <div className="col-span-5">
              <Card className="border-0 shadow-xl bg-white h-full sticky top-8">
                <CardContent className="p-6 h-full flex flex-col">
                  {isGenerating ? (
                    <div className="flex-1 overflow-y-auto">
                      <div className="flex items-center gap-2 mb-4">
                        <PenTool className="w-5 h-5 text-indigo-600 animate-pulse" />
                        <h3 className="text-xl font-semibold text-slate-900">AI가 글을 작성 중입니다...</h3>
                      </div>
                      <div className="prose prose-slate max-w-none">
                        <div className="text-slate-700 leading-relaxed">
                          {streamingContent ? (
                            <>
                              {parseMarkdown(streamingContent, generatedImages)}
                              <span className="inline-block w-2 h-5 bg-indigo-600 ml-1 animate-pulse" />
                            </>
                          ) : generatedContent ? (
                            // 타이핑 애니메이션이 끝나고 콘텐츠가 있으면 표시
                            parseMarkdown(generatedContent, generatedImages)
                          ) : (
                            <div className="flex items-center gap-2 text-slate-400">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>생성 중...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : generatedContent ? (
                    <div className="flex-1 overflow-y-auto">
                      {/* 제목 영역 */}
                      <div className="mb-6 pb-6 border-b border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-semibold text-slate-600">제목</label>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              setIsRegeneratingTitle(true)
                              try {
                                const OPENAI_API_KEY = "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"
                                
                                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                                  },
                                  body: JSON.stringify({
                                    model: "gpt-4o-mini",
                                    messages: [
                                      {
                                        role: "system",
                                        content: "당신은 SEO 최적화된 블로그 제목 전문가입니다. 키워드를 자연스럽게 포함한 매력적인 제목을 작성합니다.",
                                      },
                                      {
                                        role: "user",
                                        content: `키워드: ${blogAIKeyword}\n본문 내용: ${generatedContent.substring(0, 500)}\n\n위 정보를 바탕으로 SEO 최적화된 블로그 제목을 하나만 생성해주세요. 제목만 작성하고 다른 설명은 하지 마세요.`,
                                      },
                                    ],
                                    temperature: 0.7,
                                    max_tokens: 100,
                                  }),
                                })

                                if (!response.ok) {
                                  throw new Error("제목 재생성에 실패했습니다.")
                                }

                                const data = await response.json()
                                const newTitle = data.choices?.[0]?.message?.content?.trim() || blogTitle
                                setBlogTitle(newTitle)
                              } catch (error) {
                                console.error("제목 재생성 실패:", error)
                                alert(error instanceof Error ? error.message : "제목 재생성에 실패했습니다.")
                              } finally {
                                setIsRegeneratingTitle(false)
                              }
                            }}
                            disabled={isRegeneratingTitle}
                            className="border-slate-300 text-slate-600 hover:bg-slate-50"
                          >
                            {isRegeneratingTitle ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                재생성 중...
                              </>
                            ) : (
                              <>
                                <RefreshCwIcon className="w-4 h-4 mr-2" />
                                제목 재생성
                              </>
                            )}
                          </Button>
                        </div>
                        <Input
                          value={blogTitle}
                          onChange={(e) => setBlogTitle(e.target.value)}
                          className="text-xl font-bold text-slate-900 bg-slate-50 border-slate-200"
                          placeholder="블로그 제목"
                        />
                      </div>

                      {/* 콘텐츠 영역 */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <PenTool className="w-5 h-5 text-indigo-600" />
                          <h3 className="text-xl font-semibold text-slate-900">생성된 콘텐츠</h3>
                        </div>
                        <div className="flex gap-2">
                          {isEditingContent ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setGeneratedContent(editedContent)
                                  setIsEditingContent(false)
                                }}
                                className="border-green-500 text-green-600 hover:bg-green-50"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                저장
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditedContent(generatedContent)
                                  setIsEditingContent(false)
                                }}
                                className="border-slate-300 text-slate-600 hover:bg-slate-50"
                              >
                                취소
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditedContent(generatedContent)
                                  setIsEditingContent(true)
                                }}
                                className="border-slate-300 text-slate-600 hover:bg-slate-50"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                수정
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    const fullText = `${blogTitle}\n\n${generatedContent}`
                                    await navigator.clipboard.writeText(fullText)
                                    setIsCopied(true)
                                    setTimeout(() => setIsCopied(false), 2000)
                                  } catch (error) {
                                    console.error("복사 실패:", error)
                                    alert("복사에 실패했습니다.")
                                  }
                                }}
                                className="border-slate-300 text-slate-600 hover:bg-slate-50"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-4 h-4 mr-2" />
                                    복사됨
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4 mr-2" />
                                    전체 복사
                                  </>
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {isEditingContent ? (
                        <Textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="min-h-[500px] font-mono text-sm bg-slate-50 border-slate-200 text-slate-900"
                          placeholder="콘텐츠를 수정하세요..."
                        />
                      ) : (
                        <div className="prose prose-slate max-w-none">
                          <div className="text-slate-700 leading-relaxed">
                            {parseMarkdown(generatedContent, generatedImages)}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <PenTool className="w-16 h-16 text-slate-300 mb-4" />
                      <h3 className="text-xl font-semibold text-slate-400 mb-2">Your AI-Drafted Content</h3>
                      <p className="text-slate-500">결과가 여기에 표시됩니다.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className={`${isSidebarCollapsed ? "ml-20" : "ml-72"} transition-all duration-300 p-8`}>
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">키워드 분석</h1>
            </div>
            <Button
              onClick={handleSearch}
              disabled={isLoading || keywords.length === 0}
              size="lg"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 px-8 py-6 text-base font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-5 h-5 mr-2" />
              {isLoading ? "분석 중..." : "키워드 분석"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* 왼쪽: 키워드 입력 및 필터 */}
          <div className="col-span-4 space-y-6">
            {/* 키워드 입력 */}
            <Card className="border-0 shadow-xl bg-white">
              <CardContent className="p-6">
                <div className="mb-4">
                  <label className="text-sm font-bold text-slate-700 mb-3 block flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    키워드 입력
                  </label>
                  <textarea
                    value={keywordInput}
                    onChange={(e) => handleKeywordInput(e.target.value)}
                    placeholder="예시:&#10;강남한의원&#10;강남 변호사&#10;역삼 피부과"
                    className="w-full h-40 bg-slate-50 border-2 border-slate-200 rounded-xl p-4 text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    최대 5개 키워드까지 입력 가능
                  </p>
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold">
                    {keywords.length}/5
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* 키워드 분류 필터 */}
            {relatedKeywords.length > 0 && (
              <Card className="border-0 shadow-xl bg-white">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-700">키워드 분류</h3>
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border-2 ${
                        selectedCategory === null
                          ? "bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-300 text-indigo-700 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>전체 키워드</span>
                        <Badge className="bg-slate-200 text-slate-700">{relatedKeywords.length}</Badge>
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedCategory("세부키워드")}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border-2 ${
                        selectedCategory === "세부키워드"
                          ? "bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300 text-blue-700 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-blue-600">세부키워드</span>
                        <Badge className="bg-blue-100 text-blue-700">{categoryCounts.세부키워드}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">1,000 미만</p>
                    </button>
                    <button
                      onClick={() => setSelectedCategory("중형키워드")}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border-2 ${
                        selectedCategory === "중형키워드"
                          ? "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300 text-amber-700 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-amber-600">중형키워드</span>
                        <Badge className="bg-amber-100 text-amber-700">{categoryCounts.중형키워드}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">1,000 ~ 5,000</p>
                    </button>
                    <button
                      onClick={() => setSelectedCategory("대형키워드")}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border-2 ${
                        selectedCategory === "대형키워드"
                          ? "bg-gradient-to-r from-rose-50 to-pink-50 border-rose-300 text-rose-700 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-rose-600">대형키워드</span>
                        <Badge className="bg-rose-100 text-rose-700">{categoryCounts.대형키워드}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">5,000 이상</p>
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 오른쪽: 검색 결과 */}
          <div className="col-span-8 space-y-6">
            {isLoading ? (
              <Card className="border-0 shadow-xl bg-white">
                <CardContent className="p-16 text-center">
                  {/* AI 분석 로딩 애니메이션 */}
                  <div className="relative mb-8">
                    {/* 회전하는 뇌 아이콘 */}
                    <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 mb-6 relative">
                      <Brain className="w-16 h-16 text-indigo-600 animate-pulse" />
                      {/* 회전하는 파티클 효과 */}
                      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 border-r-purple-500 animate-spin" style={{ animationDuration: '2s' }}></div>
                      <div className="absolute inset-0 rounded-full border-4 border-transparent border-b-pink-500 border-l-purple-500 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }}></div>
                    </div>
                    
                    {/* 점 애니메이션 */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                      <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                  
                  <h3 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
                    AI가 키워드를 분석 중입니다...
                  </h3>
                  
                  <div className="space-y-2 mb-6">
                    <p className="text-slate-500 text-sm">
                      잠시만 기다려주세요
                    </p>
                  </div>
                  
                  {/* 진행 바 애니메이션 */}
                  <div className="w-full max-w-md mx-auto bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full animate-pulse" style={{ width: '60%', animation: 'shimmer 2s infinite' }}></div>
                  </div>
                  
                  <style jsx>{`
                    @keyframes shimmer {
                      0% { transform: translateX(-100%); }
                      100% { transform: translateX(400%); }
                    }
                  `}</style>
                </CardContent>
              </Card>
            ) : searchResults.length === 0 && relatedKeywords.length === 0 ? (
              <Card className="border-0 shadow-xl bg-white">
                <CardContent className="p-16 text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-100 mb-6">
                    <BarChart3 className="w-12 h-12 text-indigo-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">키워드 분석 시작하기</h3>
                  <p className="text-slate-500 mb-2 max-w-md mx-auto text-lg">
                    왼쪽에 키워드를 입력하고 분석 버튼을 클릭하여<br />
                    검색량 데이터를 확인하세요.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* 안내 메시지 */}
                {relatedKeywords.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-2xl p-5 shadow-lg">
                    <p className="text-sm text-amber-800 flex items-center gap-2 font-medium">
                      <span className="text-amber-600 font-bold">💡</span>
                      키워드를 선택하고 <strong>"AI 생성"</strong> 버튼을 클릭하면 블로그 AI 페이지로 이동합니다.
                    </p>
                  </div>
                )}

                {/* 키워드 검색량 조회 결과 */}
                {searchResults.length > 0 && (
                  <Card className="border-0 shadow-xl bg-white">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          <Search className="w-5 h-5 text-indigo-600" />
                          검색 결과
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-200 hover:bg-slate-50"
                            onClick={handleReset}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            초기화
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-200 hover:bg-slate-50"
                            onClick={handleDownloadSearchResults}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            엑셀 다운로드
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-xl overflow-hidden border border-slate-200">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50 border-b border-slate-200">
                              <TableHead className="text-slate-600 font-bold">순서</TableHead>
                              <TableHead className="text-slate-600 font-bold">키워드</TableHead>
                              <TableHead className="text-slate-600 font-bold">PC</TableHead>
                              <TableHead className="text-slate-600 font-bold">모바일</TableHead>
                              <TableHead className="text-slate-600 font-bold">월 검색량</TableHead>
                              <TableHead className="text-slate-600 font-bold">AI 분석</TableHead>
                              <TableHead className="text-slate-600 font-bold">AI 생성</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {searchResults.map((result, index) => (
                              <TableRow key={index} className="border-b border-slate-100 hover:bg-indigo-50/50 transition-colors">
                                <TableCell className="text-slate-500 font-medium">{index + 1}</TableCell>
                                <TableCell className="text-slate-900 font-bold">{result.keyword}</TableCell>
                                <TableCell className="text-slate-600">{formatSearchCount(result.pc)}</TableCell>
                                <TableCell className="text-slate-600">{formatSearchCount(result.mobile)}</TableCell>
                                <TableCell className="text-indigo-600 font-bold text-lg">
                                  {formatSearchCount(result.total)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    onClick={() => handleAIAnalysis(result.keyword, result)}
                                    size="sm"
                                    disabled={isAnalyzing}
                                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                                  >
                                    <Brain className="w-3 h-3 mr-1" />
                                    AI 분석
                                  </Button>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    onClick={() => handleAIGenerate(result.keyword)}
                                    size="sm"
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                                  >
                                    AI 생성 <ArrowRight className="w-3 h-3 ml-1" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 연관 키워드 검색량 */}
                {filteredRelatedKeywords.length > 0 && (
                  <Card className="border-0 shadow-xl bg-white">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-indigo-600" />
                          연관 키워드
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-200 hover:bg-slate-50"
                            onClick={handleReset}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            초기화
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`border-slate-200 hover:bg-slate-50 ${
                              isSortedByVolume ? "bg-indigo-50 border-indigo-300 text-indigo-700" : ""
                            }`}
                            onClick={handleSortByVolume}
                          >
                            검색량 순
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-200 hover:bg-slate-50"
                            onClick={handleDownloadRelatedKeywords}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            엑셀 다운로드
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-xl overflow-hidden border border-slate-200">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50 border-b border-slate-200">
                              <TableHead className="text-slate-600 font-bold">순서</TableHead>
                              <TableHead className="text-slate-600 font-bold">키워드</TableHead>
                              <TableHead className="text-slate-600 font-bold">분류</TableHead>
                              <TableHead className="text-slate-600 font-bold">PC</TableHead>
                              <TableHead className="text-slate-600 font-bold">모바일</TableHead>
                              <TableHead className="text-slate-600 font-bold">월 검색량</TableHead>
                              <TableHead className="text-slate-600 font-bold">AI 생성</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredRelatedKeywords.map((keyword, index) => (
                              <TableRow key={index} className="border-b border-slate-100 hover:bg-indigo-50/50 transition-colors">
                                <TableCell className="text-slate-500 font-medium">{index + 1}</TableCell>
                                <TableCell className="text-slate-900 font-bold">{keyword.keyword}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={
                                      keyword.category === "세부키워드"
                                        ? "border-blue-300 bg-blue-50 text-blue-700 font-semibold"
                                        : keyword.category === "중형키워드"
                                        ? "border-amber-300 bg-amber-50 text-amber-700 font-semibold"
                                        : "border-rose-300 bg-rose-50 text-rose-700 font-semibold"
                                    }
                                  >
                                    {keyword.category}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-slate-600">{formatSearchCount(keyword.pc)}</TableCell>
                                <TableCell className="text-slate-600">{formatSearchCount(keyword.mobile)}</TableCell>
                                <TableCell
                                  className={`font-bold text-lg ${
                                    keyword.category === "세부키워드"
                                      ? "text-blue-600"
                                      : keyword.category === "중형키워드"
                                      ? "text-amber-600"
                                      : "text-rose-600"
                                  }`}
                                >
                                  {formatSearchCount(keyword.total)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    onClick={() => handleAIGenerate(keyword.keyword)}
                                    size="sm"
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                                  >
                                    AI 생성 <ArrowRight className="w-3 h-3 ml-1" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* AI 분석 다이얼로그 */}
      <Dialog open={isAnalysisDialogOpen} onOpenChange={setIsAnalysisDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-600" />
              키워드 AI 분석
            </DialogTitle>
            <DialogDescription className="text-base font-semibold text-slate-700 mt-2">
              {analyzingKeyword}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative mb-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 via-pink-100 to-purple-100 relative">
                    <Brain className="w-10 h-10 text-purple-600 animate-pulse" />
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 border-r-pink-500 animate-spin" style={{ animationDuration: '2s' }}></div>
                  </div>
                </div>
                <p className="text-slate-600 font-medium">AI가 키워드를 분석 중입니다...</p>
              </div>
            ) : analysisResult ? (
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="prose prose-slate max-w-none">
                  <div className="text-slate-700">
                    {parseMarkdown(analysisResult)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                분석 결과가 없습니다.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 네이버 업로드 다이얼로그 - 커스텀 모달 */}
      {isNaverUploadDialogOpen && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={() => setIsNaverUploadDialogOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4"
            style={{ zIndex: 100000 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Upload className="w-6 h-6 text-green-600" />
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    네이버 블로그 업로드 설정
                  </h2>
                </div>
                <button
                  onClick={() => setIsNaverUploadDialogOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-base text-slate-600 mb-6">
                업로드할 포스트의 정보를 입력하고 예약 발행을 설정할 수 있습니다.
              </p>

              <div className="space-y-6">
            {/* 제목 */}
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">제목 *</label>
              <Input
                value={naverUploadInfo.title}
                onChange={(e) => setNaverUploadInfo({ ...naverUploadInfo, title: e.target.value })}
                placeholder="블로그 포스트 제목"
                className="bg-slate-50 border-slate-200 text-slate-900"
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">카테고리</label>
              <select
                value={naverUploadInfo.category}
                onChange={(e) => setNaverUploadInfo({ ...naverUploadInfo, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900"
              >
                <option value="일반">일반</option>
                <option value="IT/기술">IT/기술</option>
                <option value="경제/금융">경제/금융</option>
                <option value="생활/취미">생활/취미</option>
                <option value="여행">여행</option>
                <option value="음식">음식</option>
                <option value="건강">건강</option>
                <option value="교육">교육</option>
                <option value="기타">기타</option>
              </select>
            </div>

            {/* 발행 방식 */}
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-3 block">발행 방식</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setNaverUploadInfo({ ...naverUploadInfo, publishType: "immediate" })}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                    naverUploadInfo.publishType === "immediate"
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="font-semibold">즉시 발행</div>
                  <div className="text-xs mt-1 text-slate-500">지금 바로 업로드</div>
                </button>
                <button
                  onClick={() => setNaverUploadInfo({ ...naverUploadInfo, publishType: "scheduled" })}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                    naverUploadInfo.publishType === "scheduled"
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="font-semibold">예약 발행</div>
                  <div className="text-xs mt-1 text-slate-500">날짜/시간 지정</div>
                </button>
              </div>
            </div>

            {/* 예약 발행 날짜/시간 */}
            {naverUploadInfo.publishType === "scheduled" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">예약 날짜 *</label>
                  <Input
                    type="date"
                    value={naverUploadInfo.scheduledDate}
                    onChange={(e) => setNaverUploadInfo({ ...naverUploadInfo, scheduledDate: e.target.value })}
                    min={new Date().toISOString().split("T")[0]}
                    className="bg-slate-50 border-slate-200 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">예약 시간 *</label>
                  <Input
                    type="time"
                    value={naverUploadInfo.scheduledTime}
                    onChange={(e) => setNaverUploadInfo({ ...naverUploadInfo, scheduledTime: e.target.value })}
                    className="bg-slate-50 border-slate-200 text-slate-900"
                  />
                </div>
              </div>
            )}

            {/* 태그 */}
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">태그 (쉼표로 구분)</label>
              <Input
                value={naverUploadInfo.tags}
                onChange={(e) => setNaverUploadInfo({ ...naverUploadInfo, tags: e.target.value })}
                placeholder="예: 블로그, 마케팅, SEO"
                className="bg-slate-50 border-slate-200 text-slate-900"
              />
              <p className="text-xs text-slate-500 mt-1">태그는 쉼표(,)로 구분하여 입력하세요.</p>
            </div>

            {/* 공개 설정 */}
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">공개 설정</label>
              <select
                value={naverUploadInfo.visibility}
                onChange={(e) => setNaverUploadInfo({ ...naverUploadInfo, visibility: e.target.value as "public" | "private" | "unlisted" })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900"
              >
                <option value="public">공개</option>
                <option value="private">비공개</option>
                <option value="unlisted">링크 공개</option>
              </select>
            </div>

            {/* 업로드 버튼 */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleUploadToNaver}
                disabled={isUploadingToNaver || !naverUploadInfo.title.trim() || (naverUploadInfo.publishType === "scheduled" && (!naverUploadInfo.scheduledDate || !naverUploadInfo.scheduledTime))}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
              >
                {isUploadingToNaver ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {naverUploadInfo.publishType === "scheduled" ? "예약 발행 설정" : "업로드하기"}
                  </>
                )}
              </Button>
              <Button
                onClick={() => setIsNaverUploadDialogOpen(false)}
                variant="outline"
                className="border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                취소
              </Button>
            </div>
          </div>
            </div>
          </div>
        </div>
      )}

      {/* 체험단 AI 탭 렌더링 */}
      {activeTab === "experience-ai" && (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
          <Sidebar 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
          <div className={`${isSidebarCollapsed ? "ml-20" : "ml-72"} transition-all duration-300 p-8`}>
            <div className="max-w-7xl mx-auto">
              <h1 className="text-4xl font-bold text-slate-900 mb-2">체험단 AI</h1>
              <p className="text-slate-600 mb-8">체험단/기자단 마케팅을 위한 상위노출 가이드와 구인글을 자동으로 생성합니다.</p>

              <div className="grid grid-cols-12 gap-6">
                {/* 왼쪽: 입력 폼 */}
                <div className="col-span-7 space-y-6">
                  {/* Step 1: 업체 정보 입력 */}
                  <Card className="border-0 shadow-xl bg-white">
                    <CardContent className="p-6">
                      <h2 className="text-lg font-semibold text-pink-600 mb-4">
                        Step 1. 업체 정보 입력
                      </h2>
                      
                      {/* 모드 선택 */}
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <button
                          onClick={() => setExperienceMode("auto")}
                          className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                            experienceMode === "auto"
                              ? "border-pink-500 bg-pink-50 text-pink-700"
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <Sparkles className="w-5 h-5 mb-2 mx-auto" />
                          <div className="font-semibold text-sm">자동 모드</div>
                          <div className="text-xs mt-1">플레이스 URL</div>
                        </button>
                        <button
                          onClick={() => setExperienceMode("manual")}
                          className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                            experienceMode === "manual"
                              ? "border-pink-500 bg-pink-50 text-pink-700"
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <PenTool className="w-5 h-5 mb-2 mx-auto" />
                          <div className="font-semibold text-sm">수동 모드</div>
                          <div className="text-xs mt-1">직접 입력</div>
                        </button>
                      </div>

                      {/* 자동 모드 */}
                      {experienceMode === "auto" && (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm text-slate-600 mb-2 block">플레이스 URL</label>
                            <Input
                              value={placeUrl}
                              onChange={(e) => setPlaceUrl(e.target.value)}
                              placeholder="https://place.map.naver.com/..."
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-slate-600 mb-2 block">목표 키워드</label>
                            <Input
                              value={experienceInfo.targetKeyword}
                              onChange={(e) => setExperienceInfo({ ...experienceInfo, targetKeyword: e.target.value })}
                              placeholder="ex) 강남 고깃집 추천"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                          </div>
                        </div>
                      )}

                      {/* 수동 모드 */}
                      {experienceMode === "manual" && (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm text-slate-600 mb-2 block">업체명 *</label>
                            <Input
                              value={experienceInfo.businessName}
                              onChange={(e) => setExperienceInfo({ ...experienceInfo, businessName: e.target.value })}
                              placeholder="ex) 르마"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-slate-600 mb-2 block">서비스 내용</label>
                            <Textarea
                              value={experienceInfo.serviceContent}
                              onChange={(e) => setExperienceInfo({ ...experienceInfo, serviceContent: e.target.value })}
                              placeholder="ex) 건조기시트"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                              rows={2}
                            />
                          </div>
                          <div>
                            <label className="text-sm text-slate-600 mb-2 block">업체 특징</label>
                            <Textarea
                              value={experienceInfo.businessFeatures}
                              onChange={(e) => setExperienceInfo({ ...experienceInfo, businessFeatures: e.target.value })}
                              placeholder="ex) 3배 고농축 원액, 더마테스트 최고등급"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                              rows={2}
                            />
                          </div>
                          <div>
                            <label className="text-sm text-slate-600 mb-2 block">모집 인원</label>
                            <Input
                              value={experienceInfo.recruitmentCount}
                              onChange={(e) => setExperienceInfo({ ...experienceInfo, recruitmentCount: e.target.value })}
                              placeholder="ex) 10명"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-slate-600 mb-2 block">목표 키워드 *</label>
                            <Input
                              value={experienceInfo.targetKeyword}
                              onChange={(e) => setExperienceInfo({ ...experienceInfo, targetKeyword: e.target.value })}
                              placeholder="ex) 건조기시트 추천"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Step 2: 상위노출 가이드 생성 */}
                  <Card className="border-0 shadow-xl bg-white">
                    <CardContent className="p-6">
                      <h2 className="text-lg font-semibold text-pink-600 mb-4">
                        Step 2. 상위노출 가이드 생성
                      </h2>
                      <Button
                        onClick={handleGenerateGuide}
                        disabled={isGeneratingGuide}
                        className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white py-6 text-lg font-semibold shadow-lg shadow-pink-500/30 disabled:opacity-50"
                      >
                        {isGeneratingGuide ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            가이드 생성 중...
                          </>
                        ) : (
                          <>
                            <FileText className="w-5 h-5 mr-2" />
                            상위노출 가이드 생성하기
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Step 3: 체험단 구인글 생성 */}
                  {generatedGuide && (
                    <Card className="border-0 shadow-xl bg-white">
                      <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-pink-600 mb-4">
                          Step 3. 체험단 구인글 생성
                        </h2>
                        <Button
                          onClick={handleGenerateRecruitment}
                          disabled={isGeneratingRecruitment}
                          className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white py-6 text-lg font-semibold shadow-lg shadow-pink-500/30 disabled:opacity-50"
                        >
                          {isGeneratingRecruitment ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              구인글 생성 중...
                            </>
                          ) : (
                            <>
                              <Users className="w-5 h-5 mr-2" />
                              체험단 구인글 생성하기
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* 오른쪽: 생성된 결과 */}
                <div className="col-span-5">
                  <Card className="border-0 shadow-xl bg-white h-full sticky top-8">
                    <CardContent className="p-6 h-full flex flex-col">
                      {generatedGuide ? (
                        <div className="flex-1 overflow-y-auto">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-semibold text-slate-900">상위노출 가이드</h3>
                            <Button
                              onClick={handleDownloadGuide}
                              size="sm"
                              className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              다운로드
                            </Button>
                          </div>
                          <div className="prose prose-slate max-w-none">
                            <div className="text-slate-700 leading-relaxed">
                              {parseMarkdown(generatedGuide)}
                            </div>
                          </div>
                          {generatedRecruitment && (
                            <div className="mt-8 pt-8 border-t border-slate-200">
                              <h3 className="text-xl font-semibold text-slate-900 mb-4">체험단 구인글</h3>
                              <div className="prose prose-slate max-w-none">
                                <div className="text-slate-700 leading-relaxed">
                                  {parseMarkdown(generatedRecruitment)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                          <Users className="w-16 h-16 text-slate-300 mb-4" />
                          <p className="text-slate-400">업체 정보를 입력하고 가이드를 생성해주세요.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 기자단 AI 탭 렌더링 */}
      {activeTab === "reporter-ai" && (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
          <Sidebar 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
          <div className={`${isSidebarCollapsed ? "ml-20" : "ml-72"} transition-all duration-300 p-8`}>
            <div className="max-w-7xl mx-auto">
              <h1 className="text-4xl font-bold text-slate-900 mb-2">기자단 AI</h1>
              <p className="text-slate-600 mb-8">상위노출 분석과 원고 생성을 자동화하여 기자단 작업을 효율화합니다.</p>

              <div className="grid grid-cols-12 gap-6">
                {/* 왼쪽: 입력 폼 */}
                <div className="col-span-7 space-y-6">
                  {/* Step 1: 목표 키워드 입력 */}
                  <Card className="border-0 shadow-xl bg-white">
                    <CardContent className="p-6">
                      <h2 className="text-lg font-semibold text-orange-600 mb-4">
                        Step 1. 목표 키워드 입력
                      </h2>
                      <Input
                        value={reporterKeyword}
                        onChange={(e) => setReporterKeyword(e.target.value)}
                        placeholder="ex) 강남 고깃집 추천"
                        className="bg-slate-50 border-slate-200 text-slate-900"
                      />
                    </CardContent>
                  </Card>

                  {/* Step 2: 상위노출 작업 */}
                  <Card className="border-0 shadow-xl bg-white">
                    <CardContent className="p-6">
                      <h2 className="text-lg font-semibold text-orange-600 mb-4">
                        Step 2. 상위노출 작업
                      </h2>
                      <Button
                        onClick={handleCrawlTopPosts}
                        disabled={isCrawling || !reporterKeyword.trim()}
                        className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white py-6 text-lg font-semibold shadow-lg shadow-orange-500/30 disabled:opacity-50 mb-4"
                      >
                        {isCrawling ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            크롤링 중...
                          </>
                        ) : (
                          <>
                            <Search className="w-5 h-5 mr-2" />
                            1~3등 글 크롤링 및 공통 키워드 추출
                          </>
                        )}
                      </Button>

                      {topPosts.length > 0 && (
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-2">상위 1~3등 글</h3>
                            <div className="space-y-2">
                              {topPosts.map((post, index) => (
                                <div key={index} className="p-3 bg-slate-50 rounded-lg">
                                  <div className="font-medium text-slate-900">{post.title?.replace(/<[^>]*>/g, "")}</div>
                                  <div className="text-xs text-slate-500 mt-1">{post.description?.replace(/<[^>]*>/g, "").substring(0, 100)}...</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-2">공통 키워드</h3>
                            <div className="flex flex-wrap gap-2">
                              {commonKeywords.map((keyword, index) => (
                                <Badge
                                  key={index}
                                  className={`cursor-pointer ${
                                    requiredMorphemes.includes(keyword)
                                      ? "bg-orange-500 text-white"
                                      : excludedKeywords.includes(keyword)
                                      ? "bg-red-200 text-red-700"
                                      : "bg-slate-200 text-slate-700"
                                  }`}
                                  onClick={() => {
                                    if (excludedKeywords.includes(keyword)) {
                                      setExcludedKeywords(excludedKeywords.filter((k) => k !== keyword))
                                    } else if (requiredMorphemes.includes(keyword)) {
                                      setRequiredMorphemes(requiredMorphemes.filter((k) => k !== keyword))
                                      setExcludedKeywords([...excludedKeywords, keyword])
                                    } else {
                                      setRequiredMorphemes([...requiredMorphemes, keyword])
                                    }
                                  }}
                                >
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                              클릭: 주황색(필수 포함) → 빨간색(제외) → 회색(일반)
                            </p>
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-2">필수 포함 형태소</h3>
                            <div className="flex flex-wrap gap-2">
                              {requiredMorphemes.map((morpheme, index) => (
                                <Badge key={index} className="bg-orange-500 text-white">
                                  {morpheme}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Step 3: 원고 생성 */}
                  {requiredMorphemes.length > 0 && (
                    <Card className="border-0 shadow-xl bg-white">
                      <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-orange-600 mb-4">
                          Step 3. 원고 생성
                        </h2>
                        <Button
                          onClick={handleGenerateDraft}
                          disabled={isGeneratingDraft}
                          className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white py-6 text-lg font-semibold shadow-lg shadow-orange-500/30 disabled:opacity-50"
                        >
                          {isGeneratingDraft ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              원고 생성 중...
                            </>
                          ) : (
                            <>
                              <PenTool className="w-5 h-5 mr-2" />
                              원고 생성하기
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Step 4: 이미지 생성 or 변형 */}
                  {generatedDraft && (
                    <Card className="border-0 shadow-xl bg-white">
                      <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-orange-600 mb-4">
                          Step 4. 이미지 생성 or 변형
                        </h2>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <button
                            onClick={() => setReporterImageMode("generate")}
                            className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                              reporterImageMode === "generate"
                                ? "border-orange-500 bg-orange-50 text-orange-700"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <Sparkles className="w-5 h-5 mb-2 mx-auto" />
                            <div className="font-semibold text-sm">AI 생성</div>
                          </button>
                          <button
                            onClick={() => setReporterImageMode("wash")}
                            className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                              reporterImageMode === "wash"
                                ? "border-orange-500 bg-orange-50 text-orange-700"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <ImageIcon className="w-5 h-5 mb-2 mx-auto" />
                            <div className="font-semibold text-sm">이미지 세탁</div>
                          </button>
                          <button
                            onClick={() => setReporterImageMode("none")}
                            className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                              reporterImageMode === "none"
                                ? "border-orange-500 bg-orange-50 text-orange-700"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <X className="w-5 h-5 mb-2 mx-auto" />
                            <div className="font-semibold text-sm">이미지 없음</div>
                          </button>
                        </div>
                        {reporterImageMode === "wash" && (
                          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => setReporterUploadedImages(Array.from(e.target.files || []))}
                              className="hidden"
                              id="reporter-image-upload"
                            />
                            <label htmlFor="reporter-image-upload" className="cursor-pointer">
                              <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                              <p className="text-slate-600">이미지를 업로드하세요</p>
                            </label>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Step 5: 문서 저장 */}
                  {generatedDraft && (
                    <Card className="border-0 shadow-xl bg-white">
                      <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-orange-600 mb-4">
                          Step 5. 문서 저장
                        </h2>
                        <Button
                          onClick={handleSaveReporterDocument}
                          className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white py-6 text-lg font-semibold shadow-lg shadow-orange-500/30"
                        >
                          <Download className="w-5 h-5 mr-2" />
                          원고 문서 저장
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* 서류 파트 */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* 계약서 */}
                    <Card className="border-0 shadow-xl bg-white">
                      <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-orange-600 mb-4">계약서</h2>
                        <div className="space-y-3">
                          <Input
                            value={contractInfo.date}
                            onChange={(e) => setContractInfo({ ...contractInfo, date: e.target.value })}
                            placeholder="계약일자 (YYYY-MM-DD)"
                            className="bg-slate-50 border-slate-200 text-slate-900"
                          />
                          <Input
                            value={contractInfo.businessName}
                            onChange={(e) => setContractInfo({ ...contractInfo, businessName: e.target.value })}
                            placeholder="업체명"
                            className="bg-slate-50 border-slate-200 text-slate-900"
                          />
                          <Input
                            value={contractInfo.amount}
                            onChange={(e) => setContractInfo({ ...contractInfo, amount: e.target.value })}
                            placeholder="계약금액"
                            className="bg-slate-50 border-slate-200 text-slate-900"
                          />
                          <Input
                            value={contractInfo.period}
                            onChange={(e) => setContractInfo({ ...contractInfo, period: e.target.value })}
                            placeholder="계약기간"
                            className="bg-slate-50 border-slate-200 text-slate-900"
                          />
                          <Button
                            onClick={handleGenerateContract}
                            className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            계약서 다운로드
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* 견적서 */}
                    <Card className="border-0 shadow-xl bg-white">
                      <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-orange-600 mb-4">견적서</h2>
                        <div className="space-y-3">
                          <Input
                            value={quoteInfo.businessName}
                            onChange={(e) => setQuoteInfo({ ...quoteInfo, businessName: e.target.value })}
                            placeholder="업체명"
                            className="bg-slate-50 border-slate-200 text-slate-900"
                          />
                          <Button
                            onClick={() => setQuoteInfo({ ...quoteInfo, items: [...quoteInfo.items, { name: "", quantity: 1, price: 0 }] })}
                            className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                            size="sm"
                          >
                            항목 추가
                          </Button>
                          {quoteInfo.items.map((item, index) => (
                            <div key={index} className="grid grid-cols-3 gap-2">
                              <Input
                                value={item.name}
                                onChange={(e) => {
                                  const newItems = [...quoteInfo.items]
                                  newItems[index].name = e.target.value
                                  setQuoteInfo({ ...quoteInfo, items: newItems })
                                }}
                                placeholder="항목명"
                                className="bg-slate-50 border-slate-200 text-slate-900"
                              />
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newItems = [...quoteInfo.items]
                                  newItems[index].quantity = parseInt(e.target.value) || 0
                                  setQuoteInfo({ ...quoteInfo, items: newItems })
                                }}
                                placeholder="수량"
                                className="bg-slate-50 border-slate-200 text-slate-900"
                              />
                              <Input
                                type="number"
                                value={item.price}
                                onChange={(e) => {
                                  const newItems = [...quoteInfo.items]
                                  newItems[index].price = parseInt(e.target.value) || 0
                                  setQuoteInfo({ ...quoteInfo, items: newItems })
                                }}
                                placeholder="단가"
                                className="bg-slate-50 border-slate-200 text-slate-900"
                              />
                            </div>
                          ))}
                          <Button
                            onClick={handleGenerateQuote}
                            className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            견적서 다운로드
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* 오른쪽: 생성된 결과 */}
                <div className="col-span-5">
                  <Card className="border-0 shadow-xl bg-white h-full sticky top-8">
                    <CardContent className="p-6 h-full flex flex-col">
                      {generatedDraft ? (
                        <div className="flex-1 overflow-y-auto">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-semibold text-slate-900">생성된 원고</h3>
                            <Button
                              onClick={handleSaveReporterDocument}
                              size="sm"
                              className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              저장
                            </Button>
                          </div>
                          <div className="prose prose-slate max-w-none">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">{draftTitle}</h2>
                            <div className="text-slate-700 leading-relaxed">
                              {parseMarkdown(generatedDraft, reporterImages)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                          <Newspaper className="w-16 h-16 text-slate-300 mb-4" />
                          <p className="text-slate-400">목표 키워드를 입력하고 상위노출 작업을 진행해주세요.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MoneyTaker 봇 - 우측 하단 고정 */}
      {!isChatbotOpen ? (
        <button
          onClick={() => setIsChatbotOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full shadow-2xl flex items-center justify-center z-50 transition-all duration-300 hover:scale-110"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      ) : (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col border border-slate-200">
          {/* 채팅봇 헤더 */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">MoneyTaker AI</h3>
                <p className="text-xs text-white/80">블로그 마케팅 전문가</p>
              </div>
            </div>
            <button
              onClick={() => setIsChatbotOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* 채팅 메시지 영역 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {chatbotMessages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                      : "bg-white border border-slate-200 text-slate-900"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-slate-600">U</span>
                  </div>
                )}
              </div>
            ))}
            {isChatbotLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <div
                      className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                    <div
                      className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatbotMessagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="border-t border-slate-200 p-4 bg-white rounded-b-2xl">
            <div className="flex gap-2">
              <Input
                value={chatbotInput}
                onChange={(e) => setChatbotInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleChatbotSend()
                  }
                }}
                placeholder="메시지를 입력하세요..."
                disabled={isChatbotLoading}
                className="flex-1 bg-slate-50 border-slate-200 text-slate-900"
              />
              <Button
                onClick={handleChatbotSend}
                disabled={isChatbotLoading || !chatbotInput.trim()}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

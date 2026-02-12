"use client"

import { useState, useRef, useEffect } from "react"
import Anthropic from "@anthropic-ai/sdk"
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
  Hourglass,
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]) // 중복 선택 가능한 카테고리
  const [sortOrder, setSortOrder] = useState<"none" | "asc" | "desc">("none") // 검색량 정렬: none(정렬 없음), asc(낮은 순), desc(높은 순)
  const [aiGenerateDialogOpen, setAiGenerateDialogOpen] = useState(false) // AI 생성 선택 다이얼로그
  const [selectedKeywordForAI, setSelectedKeywordForAI] = useState<string>("") // AI 생성에 선택된 키워드
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
  const [isGeneratingImages, setIsGeneratingImages] = useState(false) // 이미지 생성 중 여부
  const [totalImageCount, setTotalImageCount] = useState(0) // 전체 이미지 개수
  const [regeneratingImageIndex, setRegeneratingImageIndex] = useState<number | null>(null) // 재생성 중인 이미지 인덱스
  const imageGenerationStartedRef = useRef(false) // 이미지 생성 시작 여부 추적
  const [generationStep, setGenerationStep] = useState<"keyword" | "top-exposure" | "writing" | "seo" | "final">("keyword") // 생성 단계
  const [generationProgress, setGenerationProgress] = useState(0) // 생성 진행률 (0-100)
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
    advertiserName: "", // 광고주
    advertiserAddress: "", // 광고주 주소
    advertiserCEO: "", // 광고주 대표이사
    agencyName: "", // 광고대행사
    agencyAddress: "", // 광고대행사 주소
    agencyCEO: "", // 광고대행사 대표이사
    contractStartDate: "", // 계약 시작일
    contractEndDate: "", // 계약 종료일
    serviceScope: "", // 서비스 범위
  })
  const [quoteInfo, setQuoteInfo] = useState({ // 견적서 정보
    quoteNo: "", // 견적서 번호
    date: "", // 견적일자
    supplierName: "", // 공급자 상호
    supplierAddress: "", // 공급자 소재지
    supplierPhone: "", // 공급자 전화번호
    supplierCEO: "", // 공급자 대표
    supplierBusinessNo: "", // 공급자 사업자번호
    recipientName: "", // 수신인 상호
    recipientAddress: "", // 수신인 소재지
    recipientPhone: "", // 수신인 전화번호
    recipientCEO: "", // 수신인 대표
    items: [] as { name: string; category: string; price: number; quantity: number; remarks: string }[],
  })
  const [documentFormat, setDocumentFormat] = useState<"pdf" | "html" | "docx" | "word">("pdf") // 문서 형식

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
    // 카테고리 필터링 (중복 선택 가능)
    let filtered = selectedCategories.length > 0
      ? relatedKeywords.filter((k) => selectedCategories.includes(k.category))
      : relatedKeywords

    // 검색량순 정렬 적용
    if (sortOrder === "asc") {
      filtered = [...filtered].sort((a, b) => a.total - b.total) // 낮은 순
    } else if (sortOrder === "desc") {
      filtered = [...filtered].sort((a, b) => b.total - a.total) // 높은 순
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
  const parseMarkdown = (text: string, images: string[] = [], onRegenerateImage?: (index: number) => void, onUploadImage?: (index: number) => void, regeneratingIndex?: number | null): JSX.Element[] => {
    const lines = text.split('\n')
    const elements: JSX.Element[] = []
    
    console.log("[MoneyTaker] parseMarkdown 호출 - 이미지 개수:", images.length, "이미지 URLs:", images)
    
    // 이미지 제안 위치 찾기
    const imageSuggestionPositions: number[] = []
    lines.forEach((line, index) => {
      if (line.includes('**[이미지 제안:') || line.includes('**이미지 제안:')) {
        imageSuggestionPositions.push(index)
      }
    })
    
    console.log("[MoneyTaker] 이미지 제안 위치:", imageSuggestionPositions)
    
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
      } else if (line.includes('**[이미지 제안:') || line.includes('**이미지 제안:')) {
        // 이미지 제안 위치 - 텍스트는 숨기고 이미지만 표시
        const currentImageIndex = imageSuggestionPositions.indexOf(index)
        console.log(`[MoneyTaker Parse] 이미지 제안 발견 - 라인 인덱스: ${index}, 이미지 인덱스: ${currentImageIndex}`)
        
        // 이미지가 생성된 경우
        if (currentImageIndex >= 0 && currentImageIndex < images.length && images[currentImageIndex] && images[currentImageIndex] !== "") {
          console.log(`[MoneyTaker Parse] ✅ 이미지 표시 - 인덱스 ${currentImageIndex}에 이미지 있음`)
          const isRegenerating = regeneratingIndex === currentImageIndex
          elements.push(
            <div key={`image-${currentImageIndex}`} className="my-6 rounded-lg overflow-hidden border border-slate-200 shadow-md relative group">
              {isRegenerating ? (
                // 재생성 중일 때 로딩 오버레이
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-20 rounded-lg">
                  <div className="bg-white rounded-xl p-8 flex flex-col items-center shadow-2xl min-w-[200px]">
                    <div className="relative mb-4">
                      <Hourglass className="w-12 h-12 text-indigo-600 animate-spin" style={{ animationDuration: '2s' }} />
                    </div>
                    <p className="text-base font-semibold text-slate-900">이미지 재생성 중...</p>
                    <p className="text-xs text-slate-500 mt-1">잠시만 기다려주세요</p>
                  </div>
                </div>
              ) : null}
              <img
                src={images[currentImageIndex]}
                alt={`생성된 이미지 ${currentImageIndex + 1}`}
                className="w-full h-auto object-cover"
                onError={(e) => {
                  console.error("[MoneyTaker] 이미지 로드 실패:", images[currentImageIndex])
                  e.currentTarget.style.display = 'none'
                }}
              />
              {/* Hover 시 재생성 및 업로드 버튼 표시 */}
              {!isRegenerating && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <Button
                    onClick={() => {
                      if (onRegenerateImage) {
                        onRegenerateImage(currentImageIndex)
                      } else {
                        regenerateImageAtIndex(currentImageIndex, text)
                      }
                    }}
                    className="bg-white/90 hover:bg-white text-slate-900 shadow-lg"
                    size="sm"
                    disabled={isRegenerating}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    이미지 재생성
                  </Button>
                  <Button
                    onClick={() => {
                      if (onUploadImage) {
                        onUploadImage(currentImageIndex)
                      } else {
                        handleImageUploadAtIndex(currentImageIndex)
                      }
                    }}
                    className="bg-white/90 hover:bg-white text-slate-900 shadow-lg"
                    size="sm"
                    disabled={isRegenerating}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    이미지 업로드
                  </Button>
                </div>
              )}
            </div>
          )
        } 
        // 이미지 생성 중인 경우
        else if (isGeneratingImages && currentImageIndex >= 0 && currentImageIndex < totalImageCount) {
          console.log(`[MoneyTaker Parse] 🔄 이미지 생성 중 - 인덱스 ${currentImageIndex}`)
          elements.push(
            <div key={`image-loading-${currentImageIndex}`} className="my-6 rounded-lg border-2 border-dashed border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 p-12 flex flex-col items-center justify-center min-h-[300px]">
              <div className="relative mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 relative">
                  <ImageIcon className="w-8 h-8 text-indigo-600 animate-pulse" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 border-r-purple-500 animate-spin" style={{ animationDuration: '2s' }}></div>
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-b-pink-500 border-l-purple-500 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }}></div>
                </div>
              </div>
              <p className="text-indigo-600 font-semibold text-sm">AI가 이미지를 생성하고 있습니다...</p>
              <p className="text-slate-500 text-xs mt-2">잠시만 기다려주세요 ({currentImageIndex + 1}/{totalImageCount})</p>
            </div>
          )
        }
        // 이미지 생성이 아직 시작되지 않았거나 대기 중인 경우
        else {
          console.log(`[MoneyTaker Parse] ⏳ 이미지 대기 중 - 인덱스 ${currentImageIndex}`)
          elements.push(
            <div key={`image-placeholder-${currentImageIndex}`} className="my-6 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-12 flex flex-col items-center justify-center min-h-[300px]">
              <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-slate-400 text-sm">이미지 생성 대기 중...</p>
            </div>
          )
        }
        // 이미지 제안 텍스트는 표시하지 않음 (이미지로 대체)
      } else {
        // 일반 텍스트 (볼드 처리)
        elements.push(
          <p key={index} className="text-slate-700 leading-relaxed mb-3">
            {parseInlineMarkdown(line)}
          </p>
        )
      }
    })
    
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
    const dataToDownload = sortOrder === "desc"
      ? [...filteredRelatedKeywords].sort((a, b) => b.total - a.total)
      : sortOrder === "asc"
      ? [...filteredRelatedKeywords].sort((a, b) => a.total - b.total)
      : filteredRelatedKeywords

    if (dataToDownload.length === 0) {
      alert("다운로드할 연관 키워드가 없습니다.")
      return
    }
    downloadExcelRelatedKeywords(dataToDownload, "연관키워드")
  }

  // 검색량순 정렬 변경
  const handleSortByVolume = () => {
    if (sortOrder === "none") {
      setSortOrder("desc") // 높은 순
    } else if (sortOrder === "desc") {
      setSortOrder("asc") // 낮은 순
    } else {
      setSortOrder("none") // 정렬 없음
    }
  }

  // 카테고리 선택 토글 (중복 선택 가능)
  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category)
      } else {
        return [...prev, category]
      }
    })
  }

  // 초기화 함수
  const handleReset = () => {
    setSearchResults([])
    setRelatedKeywords([])
    setKeywordInput("")
    setKeywords([])
    setSelectedCategories([])
    setSortOrder("none")
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

  // AI 생성 버튼 클릭 (다이얼로그 열기)
  const handleAIGenerate = (keyword: string) => {
    setSelectedKeywordForAI(keyword)
    setAiGenerateDialogOpen(true)
  }

  // AI 생성 타입 선택 후 실행
  const handleAIGenerateConfirm = (aiType: "blog" | "experience" | "reporter") => {
    if (aiType === "blog") {
      setBlogAIKeyword(selectedKeywordForAI)
      setActiveTab("blog-ai")
    } else if (aiType === "experience") {
      setExperienceInfo((prev) => ({ ...prev, targetKeyword: selectedKeywordForAI }))
      setActiveTab("experience-ai")
    } else if (aiType === "reporter") {
      setReporterKeyword(selectedKeywordForAI)
      setActiveTab("reporter-ai")
    }
    setAiGenerateDialogOpen(false)
    setSelectedKeywordForAI("")
  }

  // 블로그 AI 초기화 함수
  const handleResetBlogAI = () => {
    if (confirm("생성된 콘텐츠를 모두 초기화하시겠습니까?")) {
      setGeneratedContent("")
      setBlogTitle("")
      setEditedContent("")
      setStreamingContent("")
      setGeneratedImages([])
      setIsGeneratingImages(false)
      setTotalImageCount(0)
      setRegeneratingImageIndex(null)
      setIsEditingContent(false)
      imageGenerationStartedRef.current = false
      // 타이핑 애니메이션 interval 정리
      if ((window as any).__typingInterval) {
        clearInterval((window as any).__typingInterval)
        ;(window as any).__typingInterval = null
      }
    }
  }

  // 이미지 업로드 처리
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadedImages((prev) => [...prev, ...files])
  }

  // 특정 인덱스의 이미지 재생성 함수
  const regenerateImageAtIndex = async (imageIndex: number, content: string) => {
    setRegeneratingImageIndex(imageIndex)
    try {
      console.log(`[MoneyTaker] 이미지 ${imageIndex + 1} 재생성 시작`)
      
      // OpenAI API 키
      const OPENAI_API_KEY = "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"
      
      // 해당 이미지에 대한 프롬프트 생성
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
              content: "You are an expert at creating natural, realistic image prompts. Generate a detailed image prompt in English based on the blog content. ABSOLUTE MANDATORY REQUIREMENT: ALL people in the image MUST be Korean people only. Use Korean appearance, Korean ethnicity, Korean facial features, Korean skin tone, Korean hair, Korean eyes. The setting MUST be Korean style - Korean office, Korean consultation room, Korean business environment, Korean atmosphere, Korean culture, Korean lifestyle. ABSOLUTELY DO NOT include: Western people, Caucasian, European, American, Japanese, Chinese, or any other ethnicity. NO foreign languages, NO English text, NO foreign signs, NO foreign architecture, NO foreign style, NO foreign elements. Every single person must be Korean. NO EXCEPTIONS. Create natural, candid, lifestyle images with Korean people only in Korean settings. Include Korean office scenes, Korean consultation rooms, Korean professional settings, or Korean business environments when appropriate. Return only one prompt, without numbering or bullet points.",
            },
            {
              role: "user",
              content: `Keyword (MAIN SUBJECT/HERO): ${blogAIKeyword}\n\nBased on this blog content and keyword, generate one photorealistic, realistic photography image prompt in English. The keyword "${blogAIKeyword}" must be the MAIN SUBJECT and HERO of the image. CRITICAL: Image must be PHOTOREALISTIC, REALISTIC PHOTOGRAPHY - use terms like 'photorealistic', 'realistic photography', 'professional photography', 'high-quality photo', 'lifelike', 'cinematic photo'. NOT illustration, NOT cartoon, NOT drawing, NOT painting. ABSOLUTE MANDATORY: ALL people in the image MUST be Korean people only. Use Korean appearance, Korean ethnicity, Korean facial features, Korean skin tone, Korean hair, Korean eyes. The setting MUST be Korean style - Korean office, Korean consultation room, Korean business environment, Korean atmosphere, Korean culture, Korean lifestyle. ABSOLUTELY DO NOT include: Western people, Caucasian, European, American, Japanese, Chinese, or any other ethnicity. NO foreign languages, NO English text, NO foreign signs, NO foreign architecture, NO foreign style, NO foreign elements. NO illustrations, NO cartoons, NO drawings, NO paintings, NO AI-generated look. Every single person must be Korean. NO EXCEPTIONS. Create a photorealistic, candid, lifestyle photography with Korean people only in Korean settings. The keyword "${blogAIKeyword}" must be prominently featured as the main subject. Include Korean professional office scenes, Korean consultation rooms, or Korean business environments when relevant:\n\n${content.substring(0, 2000)}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      })

      if (!imagePromptResponse.ok) {
        throw new Error("이미지 프롬프트 생성 실패")
      }

      const imagePromptData = await imagePromptResponse.json()
      const prompt = imagePromptData.choices?.[0]?.message?.content?.trim() || "Professional Korean consultation scene with Korean people only in Korean office setting, Korean style, Korean atmosphere, no foreign elements, no foreign languages, no foreign signs"
      
      console.log(`[MoneyTaker] 생성된 프롬프트:`, prompt.substring(0, 100))
      
      // 이미지 생성 (재시도 포함)
      const result = await generateImageWithRetry(prompt, 5)
      
      if (result.success && result.imageUrl) {
        console.log(`[MoneyTaker] ✅ 이미지 ${imageIndex + 1} 재생성 성공`)
        // 이미지 상태 업데이트
        setGeneratedImages((prev) => {
          const newImages = [...prev]
          while (newImages.length <= imageIndex) {
            newImages.push("")
          }
          newImages[imageIndex] = result.imageUrl!
          return newImages
        })
        return true
      } else {
        throw new Error(data.error || "이미지 생성 실패")
      }
    } catch (error) {
      console.error(`[MoneyTaker] ❌ 이미지 ${imageIndex + 1} 재생성 실패:`, error)
      alert(`이미지 재생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      return false
    } finally {
      setRegeneratingImageIndex(null)
    }
  }

  // 기자단 AI: 특정 인덱스의 이미지 재생성 함수
  const regenerateReporterImageAtIndex = async (imageIndex: number, content: string) => {
    setRegeneratingImageIndex(imageIndex)
    try {
      console.log(`[Reporter AI] 이미지 ${imageIndex + 1} 재생성 시작`)
      
      // OpenAI API 키
      const OPENAI_API_KEY = "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"
      
      // 해당 이미지에 대한 프롬프트 생성
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
              content: "You are an expert at creating photorealistic, realistic image prompts. Generate a detailed, photorealistic image prompt in English based on the blog content and keyword. CRITICAL: The keyword is the MAIN SUBJECT/HERO of the image. The keyword must be the central focus and protagonist of the image. ABSOLUTE MANDATORY REQUIREMENT: The image MUST be PHOTOREALISTIC, REALISTIC PHOTOGRAPHY, NOT illustration, NOT cartoon, NOT drawing, NOT painting. Use terms like 'photorealistic', 'realistic photography', 'professional photography', 'high-quality photo', 'lifelike', 'cinematic photo'. ALL people in the image MUST be Korean people only. Use Korean appearance, Korean ethnicity, Korean facial features, Korean skin tone, Korean hair, Korean eyes. The setting MUST be Korean style - Korean office, Korean consultation room, Korean business environment, Korean atmosphere, Korean culture, Korean lifestyle. ABSOLUTELY DO NOT include: Western people, Caucasian, European, American, Japanese, Chinese, or any other ethnicity. NO foreign languages, NO English text, NO foreign signs, NO foreign architecture, NO foreign style, NO foreign elements. NO illustrations, NO cartoons, NO drawings, NO paintings, NO AI-generated look, NO artificial appearance. Every single person must be Korean. NO EXCEPTIONS. Create photorealistic, natural, candid, lifestyle photography with Korean people only in Korean settings. The keyword must be prominently featured as the main subject. Include Korean office scenes, Korean consultation rooms, Korean professional settings, or Korean business environments when appropriate. Return only one prompt, without numbering or bullet points.",
            },
            {
              role: "user",
              content: `Keyword (MAIN SUBJECT/HERO): ${reporterKeyword}\n\nBased on this blog content and keyword, generate one photorealistic, realistic photography image prompt in English. The keyword "${reporterKeyword}" must be the MAIN SUBJECT and HERO of the image. CRITICAL: Image must be PHOTOREALISTIC, REALISTIC PHOTOGRAPHY - use terms like 'photorealistic', 'realistic photography', 'professional photography', 'high-quality photo', 'lifelike', 'cinematic photo'. NOT illustration, NOT cartoon, NOT drawing, NOT painting. ABSOLUTE MANDATORY: ALL people in the image MUST be Korean people only. Use Korean appearance, Korean ethnicity, Korean facial features, Korean skin tone, Korean hair, Korean eyes. The setting MUST be Korean style - Korean office, Korean consultation room, Korean business environment, Korean atmosphere, Korean culture, Korean lifestyle. ABSOLUTELY DO NOT include: Western people, Caucasian, European, American, Japanese, Chinese, or any other ethnicity. NO foreign languages, NO English text, NO foreign signs, NO foreign architecture, NO foreign style, NO foreign elements. NO illustrations, NO cartoons, NO drawings, NO paintings, NO AI-generated look. Every single person must be Korean. NO EXCEPTIONS. Create a photorealistic, candid, lifestyle photography with Korean people only in Korean settings. The keyword "${reporterKeyword}" must be prominently featured as the main subject. Include Korean professional office scenes, Korean consultation rooms, or Korean business environments when relevant:\n\n${content.substring(0, 2000)}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      })

      if (!imagePromptResponse.ok) {
        throw new Error("이미지 프롬프트 생성 실패")
      }

      const imagePromptData = await imagePromptResponse.json()
      const prompt = imagePromptData.choices?.[0]?.message?.content?.trim() || `Photorealistic, realistic photography of ${reporterKeyword || "Korean consultation scene"} with Korean people only in Korean office setting, Korean style, Korean atmosphere, professional photography, high-quality photo, lifelike, no foreign elements, no foreign languages, no foreign signs, NOT illustration, NOT cartoon`
      
      console.log(`[Reporter AI] 생성된 프롬프트:`, prompt.substring(0, 100))
      
      // 이미지 생성 (재시도 포함)
      const result = await generateImageWithRetry(prompt, 5)
      
      if (result.success && result.imageUrl) {
        console.log(`[Reporter AI] ✅ 이미지 ${imageIndex + 1} 재생성 성공`)
        // 이미지 상태 업데이트
        setReporterImages((prev) => {
          const newImages = [...prev]
          while (newImages.length <= imageIndex) {
            newImages.push("")
          }
          newImages[imageIndex] = result.imageUrl!
          return newImages
        })
        return true
      } else {
        throw new Error(data.error || "이미지 생성 실패")
      }
    } catch (error) {
      console.error(`[Reporter AI] ❌ 이미지 ${imageIndex + 1} 재생성 실패:`, error)
      alert(`이미지 재생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      return false
    } finally {
      setRegeneratingImageIndex(null)
    }
  }

  // 기자단 AI: 특정 인덱스에 이미지 업로드하는 함수
  const handleReporterImageUploadAtIndex = (imageIndex: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // 파일을 URL로 변환
        const reader = new FileReader()
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string
          if (imageUrl) {
            // 해당 인덱스에 이미지 저장
            setReporterImages((prev) => {
              const newImages = [...prev]
              while (newImages.length <= imageIndex) {
                newImages.push("")
              }
              newImages[imageIndex] = imageUrl
              console.log(`[Reporter AI] 이미지 업로드 완료 - 인덱스 ${imageIndex}에 저장됨`)
              return newImages
            })
          }
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
  }

  // 특정 인덱스에 이미지 업로드하는 함수
  const handleImageUploadAtIndex = (imageIndex: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // 파일을 URL로 변환
        const reader = new FileReader()
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string
          if (imageUrl) {
            // 해당 인덱스에 이미지 저장
            setGeneratedImages((prev) => {
              const newImages = [...prev]
              while (newImages.length <= imageIndex) {
                newImages.push("")
              }
              newImages[imageIndex] = imageUrl
              console.log(`[MoneyTaker] 이미지 업로드 완료 - 인덱스 ${imageIndex}에 저장됨`)
              return newImages
            })
          }
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
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
  // 이미지 생성 재시도 헬퍼 함수
  const generateImageWithRetry = async (prompt: string, maxRetries: number = 5): Promise<{ success: boolean; imageUrl?: string; error?: string }> => {
    let lastError: string = ""
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[MoneyTaker] 이미지 생성 시도 ${attempt}/${maxRetries}:`, prompt.substring(0, 50) + "...")
        
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
            console.log(`[MoneyTaker] ✅ 이미지 생성 성공 (시도 ${attempt}/${maxRetries})`)
            return { success: true, imageUrl: data.imageUrl }
          } else {
            lastError = data.error || "이미지 생성 실패"
            console.warn(`[MoneyTaker] ⚠️ 이미지 생성 실패 (시도 ${attempt}/${maxRetries}):`, lastError)
          }
        } else {
          const errorData = await imageResponse.json().catch(() => ({}))
          lastError = errorData.error || `HTTP ${imageResponse.status}`
          console.warn(`[MoneyTaker] ⚠️ 이미지 생성 API 오류 (시도 ${attempt}/${maxRetries}):`, imageResponse.status, lastError)
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "알 수 없는 오류"
        console.warn(`[MoneyTaker] ⚠️ 이미지 생성 예외 (시도 ${attempt}/${maxRetries}):`, lastError)
      }
      
      // 마지막 시도가 아니면 잠시 대기 후 재시도
      if (attempt < maxRetries) {
        const delay = attempt * 1000 // 1초, 2초, 3초, 4초씩 증가
        console.log(`[MoneyTaker] ${delay}ms 후 재시도...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    console.error(`[MoneyTaker] ❌ 이미지 생성 최종 실패 (${maxRetries}번 시도 후):`, lastError)
    return { success: false, error: lastError }
  }

  const generateImagesForContent = async (content: string, onImageGenerated?: (imageUrl: string) => void) => {
    // 이미 이미지 생성이 시작되었으면 중복 실행 방지
    if (imageGenerationStartedRef.current) {
      return
    }
    imageGenerationStartedRef.current = true
    
    try {
      // 콘텐츠에서 이미지 제안 개수 추출
      const imageSuggestionMatches = content.match(/\*\*\[?이미지 제안:/g)
      const imageSuggestionCount = imageSuggestionMatches ? imageSuggestionMatches.length : 4
      console.log("[MoneyTaker] 이미지 제안 개수:", imageSuggestionCount)
      
      // 이미지 생성 시작 상태 설정
      setIsGeneratingImages(true)
      setTotalImageCount(imageSuggestionCount)
      
      // OpenAI API 키 (하드코딩)
      const OPENAI_API_KEY = "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"
      
      // 콘텐츠에서 이미지 제안 위치 및 설명 추출
      const imageSuggestionRegex = /\*\*\[?이미지 제안:\s*([^\]]+)\]?\*\*/g
      const imageSuggestions: string[] = []
      let match
      while ((match = imageSuggestionRegex.exec(content)) !== null) {
        imageSuggestions.push(match[1].trim())
      }
      
      // 이미지 제안 설명을 포함한 프롬프트 생성
      const imageSuggestionContext = imageSuggestions.length > 0
        ? `\n\n이미지 제안 설명 (각 이미지는 해당 설명에 정확히 맞춰야 합니다):\n${imageSuggestions.map((desc, idx) => `${idx + 1}. ${desc}`).join("\n")}\n\n각 이미지 프롬프트는 해당 순서의 이미지 제안 설명과 정확히 일치해야 합니다.`
        : ""
      
      // 생성된 콘텐츠를 기반으로 이미지 프롬프트 생성 (전체 내용 사용)
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
              content: "You are an expert at creating photorealistic, realistic image prompts. Generate detailed, photorealistic image prompts in English based on the blog content, keyword, and image suggestion descriptions. CRITICAL: The keyword is the MAIN SUBJECT/HERO of each image. The keyword must be the central focus and protagonist of the image. Each prompt must accurately match the corresponding image suggestion description and be directly related to the specific content around that image suggestion location in the blog. ABSOLUTE MANDATORY REQUIREMENT: ALL images MUST be PHOTOREALISTIC, REALISTIC PHOTOGRAPHY, NOT illustration, NOT cartoon, NOT drawing, NOT painting. Use terms like 'photorealistic', 'realistic photography', 'professional photography', 'high-quality photo', 'lifelike', 'cinematic photo'. ALL people in ALL images MUST be Korean people only. Use Korean appearance, Korean ethnicity, Korean facial features, Korean skin tone, Korean hair, Korean eyes. The setting MUST be Korean style - Korean office, Korean consultation room, Korean business environment, Korean atmosphere, Korean culture, Korean lifestyle. ABSOLUTELY DO NOT include: Western people, Caucasian, European, American, Japanese, Chinese, or any other ethnicity. NO foreign languages, NO English text, NO foreign signs, NO foreign architecture, NO foreign style, NO foreign elements. NO illustrations, NO cartoons, NO drawings, NO paintings, NO AI-generated look, NO artificial appearance. Every single person in every image must be Korean. NO EXCEPTIONS. Create photorealistic, natural, candid, lifestyle photography with Korean people only in Korean settings. The keyword must be prominently featured as the main subject. Include Korean office scenes, Korean consultation rooms, Korean professional settings, or Korean business environments. The images should feature Korean professionals, clients, or people in authentic Korean professional or service industry contexts. Avoid staged or artificial poses. Focus on authentic Korean moments, natural Korean expressions, and real Korean environments. IMPORTANT: Each image prompt must be directly related to the blog content context where the image suggestion appears, and the keyword must be the central focus. Return only the prompts, one per line, without numbering or bullet points.",
            },
            {
              role: "user",
              content: `Keyword (MAIN SUBJECT/HERO): ${blogAIKeyword}\n\nBased on this blog content and keyword, generate ${imageSuggestionCount} photorealistic, realistic photography image prompts in English. The keyword "${blogAIKeyword}" must be the MAIN SUBJECT and HERO of each image. Each prompt must match the corresponding image suggestion description and be directly related to the specific content context where that image appears in the blog. CRITICAL: Images must be PHOTOREALISTIC, REALISTIC PHOTOGRAPHY - use terms like 'photorealistic', 'realistic photography', 'professional photography', 'high-quality photo', 'lifelike', 'cinematic photo'. NOT illustration, NOT cartoon, NOT drawing, NOT painting. ABSOLUTE MANDATORY: ALL people in ALL images MUST be Korean people only. Use Korean appearance, Korean ethnicity, Korean facial features, Korean skin tone, Korean hair, Korean eyes. The setting MUST be Korean style - Korean office, Korean consultation room, Korean business environment, Korean atmosphere, Korean culture, Korean lifestyle. ABSOLUTELY DO NOT include: Western people, Caucasian, European, American, Japanese, Chinese, or any other ethnicity. NO foreign languages, NO English text, NO foreign signs, NO foreign architecture, NO foreign style, NO foreign elements. NO illustrations, NO cartoons, NO drawings, NO paintings, NO AI-generated look. Every single person in every image must be Korean. NO EXCEPTIONS. Create photorealistic, candid, lifestyle photography with Korean people only in Korean settings. The keyword "${blogAIKeyword}" must be prominently featured as the main subject in each image. Include Korean professional office scenes, Korean consultation rooms, or Korean business environments when relevant. The images should feel natural and unposed, with real Korean expressions and Korean environments.${imageSuggestionContext}\n\nFull blog content:\n${content}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      })

      if (!imagePromptResponse.ok) {
        throw new Error("이미지 프롬프트 생성 실패")
      }

      const imagePromptData = await imagePromptResponse.json()
      const promptsText = imagePromptData.choices?.[0]?.message?.content || ""
      console.log("[MoneyTaker] 생성된 이미지 프롬프트 텍스트:", promptsText)
      let imagePrompts = promptsText
        .split("\n")
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0)
        .slice(0, imageSuggestionCount)

      console.log("[MoneyTaker] 파싱된 이미지 프롬프트:", imagePrompts)
      console.log("[MoneyTaker] 이미지 제안 개수:", imageSuggestionCount, "프롬프트 개수:", imagePrompts.length)

      // 프롬프트 개수가 부족하면 기본 프롬프트로 채우기
      while (imagePrompts.length < imageSuggestionCount) {
        imagePrompts.push("Professional Korean consultation scene with Korean people only in Korean office setting, Korean style, Korean atmosphere, no foreign elements, no foreign languages, no foreign signs")
      }
      // 초과하면 자르기
      if (imagePrompts.length > imageSuggestionCount) {
        imagePrompts = imagePrompts.slice(0, imageSuggestionCount)
      }

      if (imagePrompts.length === 0) {
        console.warn("[MoneyTaker] 이미지 프롬프트가 생성되지 않음")
        setIsGeneratingImages(false)
        return
      }

      // 이미지 배열을 이미지 제안 개수만큼 초기화 (빈 문자열로)
      const initialImages = new Array(imageSuggestionCount).fill("")
      setGeneratedImages(initialImages)

      // 각 프롬프트로 이미지 생성 (병렬 처리, Promise.all 사용)
      // 각 이미지는 정확히 하나의 인덱스에만 저장되도록 보장
      const imagePromises = imagePrompts.map(async (prompt: string, index: number) => {
        try {
          console.log(`[MoneyTaker] 이미지 ${index + 1}/${imageSuggestionCount} 생성 요청 시작:`, prompt.substring(0, 50) + "...")
          
          // 재시도 로직이 포함된 이미지 생성
          const result = await generateImageWithRetry(prompt, 5)
          
          if (result.success && result.imageUrl) {
            console.log(`[MoneyTaker] ✅ 이미지 ${index + 1}/${imageSuggestionCount} 생성 성공`)
            
            // 함수형 업데이트로 정확한 인덱스에 저장 (중복 방지)
            setGeneratedImages((prev) => {
              // 이전 상태를 복사
              const newImages = [...prev]
              
              // 배열이 충분히 크도록 확장
              while (newImages.length < imageSuggestionCount) {
                newImages.push("")
              }
              
              // 해당 인덱스가 비어있을 때만 저장 (중복 방지)
              // 인덱스 범위 체크 추가
              if (index >= 0 && index < imageSuggestionCount) {
                if (!newImages[index] || newImages[index] === "") {
                  newImages[index] = result.imageUrl!
                  console.log(`[MoneyTaker] ✅ 이미지 저장 완료 - 인덱스 ${index}에 저장됨 (배열 길이: ${newImages.length}, 총 ${imageSuggestionCount}개 중 ${index + 1}번째)`)
                } else {
                  console.log(`[MoneyTaker] ⚠️ 인덱스 ${index}에 이미 이미지가 있음, 건너뜀 (기존 이미지 유지)`)
                }
              } else {
                console.error(`[MoneyTaker] ❌ 잘못된 인덱스: ${index} (범위: 0-${imageSuggestionCount - 1})`)
              }
              
              return newImages
            })
            
            // 콜백 호출 (실시간 업데이트)
            if (onImageGenerated) {
              onImageGenerated(result.imageUrl)
            }
            return { index, success: true, imageUrl: result.imageUrl }
          } else {
            console.error(`[MoneyTaker] ❌ 이미지 ${index + 1} 생성 최종 실패 (5번 시도 후):`, result.error)
            return { index, success: false, error: result.error }
          }
        } catch (error) {
          console.error(`[MoneyTaker] ❌ 이미지 ${index + 1} 생성 예외:`, error)
          return { index, success: false, error: error instanceof Error ? error.message : "알 수 없는 오류" }
        }
      })

      // 모든 이미지 생성 완료 대기
      console.log(`[MoneyTaker] ========================================`)
      console.log(`[MoneyTaker] 총 ${imagePromises.length}개의 이미지 생성 시작 (각 인덱스: 0~${imagePromises.length - 1})`)
      console.log(`[MoneyTaker] 이미지 제안 개수: ${imageSuggestionCount}`)
      console.log(`[MoneyTaker] ========================================`)
      
      const results = await Promise.all(imagePromises)
      
      const successCount = results.filter(r => r.success).length
      const skippedCount = results.filter(r => (r as any).skipped).length
      console.log(`[MoneyTaker] ========================================`)
      console.log(`[MoneyTaker] ✅ 이미지 생성 완료: ${successCount}/${imagePromises.length}개 성공 (건너뜀: ${skippedCount}개)`)
      console.log(`[MoneyTaker] ========================================`)
      
      // 최종 이미지 배열 상태 확인
      setGeneratedImages((prev) => {
        const filledCount = prev.filter(img => img && img !== "").length
        console.log(`[MoneyTaker] 최종 이미지 배열 상태: ${filledCount}/${imageSuggestionCount}개 채워짐`)
        console.log(`[MoneyTaker] 이미지 배열 상세:`, prev.map((img, idx) => `[${idx}]: ${img ? '있음' : '없음'}`).join(', '))
        return prev
      })
      
      // 모든 이미지 생성이 완료되면 상태 업데이트
      setIsGeneratingImages(false)
      imageGenerationStartedRef.current = false
    } catch (error) {
      console.error("이미지 생성 중 오류:", error)
      setIsGeneratingImages(false)
      imageGenerationStartedRef.current = false
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
      setIsGeneratingImages(false) // 이미지 생성 중 상태 초기화
      setTotalImageCount(0) // 전체 이미지 개수 초기화
      setRegeneratingImageIndex(null) // 재생성 중인 이미지 인덱스 초기화
      setIsEditingContent(false)
      imageGenerationStartedRef.current = false // 이미지 생성 시작 플래그 초기화
      setGenerationStep("keyword") // 생성 단계 초기화
      setGenerationProgress(0) // 진행률 초기화
    
    console.log("[MoneyTaker] 이전 이미지 제거, 새 콘텐츠 생성 시작")

    try {
      // Step 1: 키워드 분석 (20%)
      setGenerationStep("keyword")
      setGenerationProgress(20)
      await new Promise(resolve => setTimeout(resolve, 4000)) // 4초 대기
      
      // Step 2: 상위노출 작업 (40%)
      setGenerationStep("top-exposure")
      setGenerationProgress(40)
      await new Promise(resolve => setTimeout(resolve, 4000)) // 4초 대기
      
      // Step 3: AI 글 작성 (60%)
      setGenerationStep("writing")
      setGenerationProgress(60)
      // Anthropic API 키
      const ANTHROPIC_API_KEY = "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"
      
      const anthropic = new Anthropic({
        apiKey: ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true, // 브라우저 환경에서 실행 허용
      })

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
        const optionalKeywordsText = blogRequiredMorphemes.length > 0 ? blogRequiredMorphemes.join(", ") : ""
        
        prompt = `# 역할

당신은 전문 서비스업(의료, 법률, 세무, 상담 등) 마케팅에 특화된 블로그 카피라이터입니다.
키워드만으로 업종을 파악하고, "고객 의심 제거 → 객관 정보 → 차별점 자연스럽게 연결" 구조의 신뢰도 높은 4단 구성 글을 작성합니다.

---

# 입력 정보

**목표 키워드**: ${blogAIKeyword} (본문에 최소 5회 이상 자연스럽게 포함 필수)
**필수 포함 형태소** (선택): ${optionalKeywordsText || "없음"} (각 단어를 본문에 최소 1회 이상 자연스럽게 포함)

---

# Step 1: 키워드 분석 (내부 처리, 사용자에게 보이지 않음)

키워드: ${blogAIKeyword}

다음을 분석하세요:

1. **업종 카테고리**: 의료/법률/세무/상담/교육/기타 중 선택
2. **고객 호칭**: 환자/의뢰인/고객/학부모 등
3. **서비스 호칭**: 치료/상담/시술/수업/소송 등
4. **핵심 의심**: 고객이 가장 두려워하는 것 (예: 효과, 비용, 시간, 잘못된 선택, 준비 부족)
5. **가격대 추정**: 업종 일반 시장 가격 (예: 1회 5~10만 원, 착수금 300~800만 원)
6. **전문성 지표**: 이 업종에서 신뢰를 주는 요소 (예: 경력, 사건 경험, 장비, 성공률)

---

# Step 2: 제목 선택

${blogAIKeyword}, [아래 패턴 중 독자의 핵심 의심에 가장 적합한 1개 선택]

**제목 패턴 7가지:**

1. **경고/주의형**: "${blogAIKeyword}, [흔한 실수]하지 마세요"
   - 사용 시기: 독자가 "잘못된 선택에 대한 두려움"을 가진 경우
   - 예: "이혼전문변호사, 유명하다는 이유로 선임하지 마세요"
2. **체크리스트형**: "${blogAIKeyword}? [상황]에서 확인해야 할 N가지"
   - 사용 시기: 독자가 "뭘 확인해야 할지 모르는 상태"인 경우
   - 예: "이혼전문변호사? 초기 상담에서 확인해야 할 2가지"
3. **통계/놓침 강조형**: "${blogAIKeyword}, N건 중 M건이 놓치는 [핵심 정보]"
   - 사용 시기: 독자가 "놓치고 있는 정보가 있을까 불안"한 경우
   - 예: "이혼전문변호사, 10건 중 8건이 놓치는 주의사항"
4. **성공 사례 분석형**: "${blogAIKeyword} [행동] 후 [결과] 얻은 N가지 이유"
   - 사용 시기: 독자가 "효과에 대한 확신이 필요"한 경우
   - 예: "이혼전문변호사 선임 후 원하는 결과 얻은 3가지 이유"
5. **조건부 해결책형**: "${blogAIKeyword}, [핵심 고민]다면 이것부터 확인하세요"
   - 사용 시기: 독자가 "특정 고민 때문에 망설임"이 명확한 경우
   - 예: "이혼전문변호사, 비용 부담스럽다면 이것부터 확인하세요"
6. **질문형**: "${blogAIKeyword}, [핵심 의심을 질문으로]?"
   - 사용 시기: 독자가 "결정을 앞두고 마지막 확신이 필요"한 경우
   - 예: "도수치료효과, 비용 대비 가치 있는 선택일까?"
7. **비교/대조형**: "${blogAIKeyword}, [A] vs [B] 어떻게 다를까?"
   - 사용 시기: 독자가 "선택지 간 차이를 모르는" 경우
   - 예: "이혼전문변호사, 일반 변호사와 어떻게 다를까?"

---

# Step 3: 4단 구조 글 작성

## 1. 서론

선택한 제목 패턴에 따라 아래 중 적절한 패턴을 사용하세요.

"[고객 직접 인용 1 - 비용/선택 관련 고민, ${blogAIKeyword} 자연스럽게 포함]"

"[고객 직접 인용 2 - 효과/결과 불확실성 또는 잘못된 선택에 대한 두려움]"

안녕하세요. [업종명] [가상 원장/대표명]입니다.

지난 [N]년간 [고객 호칭]분들을 만나면서, 위와 같은 고민을 정말 많이 들었습니다.
[서비스 비용]은 만만치 않은데 [결과]는 불확실하니 당연히 망설여지시겠죠.

특히 [업종 특성상 민감한 부분 - 예: 평생 한두 번 겪을까 말까 한 일, 내 건강이 걸린 문제]일 때는 더욱 신중해지실 수밖에 없습니다.

그래서 오늘은 ${blogAIKeyword}를 고민하시는 분들께 [핵심 질문 - 예: 어떤 기준으로 선택해야 하는지, 정말 효과가 있는지]에 대해 솔직하게 말씀드리려 합니다.

이 글이 여러분의 현명한 선택에 도움이 되길 바랍니다.

**[이미지 제안: 전문가 상담 장면 또는 사무실/병원 전경]**

---

**[체크리스트형 제목을 선택한 경우 대안 서론]**

"[고객 직접 인용 1 - 막막함/혼란]"

"[고객 직접 인용 2 - 후회/불안]"

지난 [N]년간 [업종명]을 운영하면서 많은 [고객 호칭]분들을 만나왔습니다.
그분들 중 상당수가 [초기 단계]에서 무엇을 [행동]해야 할지 몰라 중요한 기회를 놓치셨더라고요.

${blogAIKeyword}를 찾는 분들도 마찬가지일 겁니다.

막상 [상황]에 앉으면 머릿속이 하얘지고, 준비했던 질문들도 다 까먹게 되죠.
그러다 [이후]에야 '아, 이것도 [행동]할 걸' 하며 후회하게 됩니다.

오늘은 ${blogAIKeyword} [상황]에서 반드시 확인해야 할 [N]가지 핵심 사항을 정리해 드리겠습니다.
이것만 제대로 체크하셔도, [목표]에 큰 도움이 되실 겁니다.

3분만 집중해서 읽어보세요.

**[이미지 제안: 체크리스트 노트와 펜, 또는 진지한 상담 장면]**

---

## 2. 본문 1

많은 분들이 ${blogAIKeyword}를 고려하실 때 가장 궁금해하시는 부분이 바로 '[구체적 질문]'입니다.

일반적으로 [업종]에서는 [구체적 가격대], [기간], [절차] 정도가 소요됩니다.
[추가 객관 정보 2~3문장. ${optionalKeywordsText ? `이 부분에 ${optionalKeywordsText} 중 1~2개를 자연스럽게 포함` : ""}]

**그런데 [업종 특성]상 단순히 [A]만으로는 [문제점].**
왜냐하면 [이유 1], [이유 2], [이유 3] 등 복합적 요소를 함께 고려해야 하기 때문입니다.

선택한 제목 패턴과 업종 특성에 따라 아래 패턴 중 가장 적합한 것을 사용하세요:

---

**[패턴 옵션 1: 독자 액션 가이드형]**

그렇다면 이런 문제를 어떻게 보완할 수 있을까요?

가장 중요한 것은 [핵심 해결 방법]입니다.

단순히 "[일반적 답변]"가 아니라, [고객 호칭]의 [상황 요소들]을 충분히 파악한 후 예상 [기간/비용]을 투명하게 안내하는 곳인지 살펴보세요.

또한 [추가 체크포인트]도 반드시 확인해야 합니다.

이러한 점들을 꼭 기억하시길 바랍니다.

저희 [가상 브랜드명] 역시 이러한 원칙을 지키기 위해 [구체적 실천 사항]를 하고 있습니다.

---

**[패턴 옵션 2: 체크리스트형]**

그렇다면 [서비스/업체] 선택 시 무엇을 확인해야 할까요?

**✓ 첫째, [체크포인트 1]**
[설명 2~3문장]

**✓ 둘째, [체크포인트 2]**
[설명 2~3문장]

**✓ 셋째, [체크포인트 3]**
[설명 2~3문장]

저희는 이 세 가지를 모두 충족하기 위해 [구체적 시스템/정책]을 운영하고 있습니다.

---

**[패턴 옵션 3: 구체적 예시 중심형]**

예를 들어, [구체적 상황 1]은 단순한 [A] 지식만으로는 불가능합니다. [B], [C], [D]까지 꼼꼼하게 [행동]할 수 있는 실전 경험이 필요하죠.

[구체적 상황 2]도 마찬가지입니다. [법원/기관]은 "[X]"가 아니라 "[Y]"를 중심으로 판단합니다. [구체적 증거 예시] 등을 입증할 수 있어야 합니다.

그래서 [초기 단계]에서 "[실전 질문 1]", "[실전 질문 2]"라고 구체적으로 질문해 보시길 권합니다. 막연한 답변이 아니라, 현실적인 전략과 예상 시나리오를 들려주는 곳이 진짜 경험 있는 곳입니다.

---

**[패턴 옵션 4: 비유 연결형]**

저희 [가상 브랜드명]에서도 [초기 상황] 시 [N]분 이상 충분한 시간을 드립니다. 단순히 [A]만 듣는 게 아니라, [B], [C], [D]까지 종합적으로 파악해야 정확한 [진단/전략]을 세울 수 있기 때문입니다.

${blogAIKeyword}를 선택할 때도 똑같습니다. [짧은 시간]에 "[성급한 결론]"라고 성급하게 결론 내리는 곳은 조심하셔야 합니다.

[서비스]는 단순히 [표면적 문제]이 아닙니다. 그 안에는 [복잡한 요소들]이 복잡하게 얽혀 있죠. 이 모든 맥락을 이해하지 못하면, [부정적 결과]를 당할 수 있습니다.

그렇기에 [초기 단계]에서 당신의 이야기를 끝까지 경청하고, 궁금한 점에 대해 투명하게 설명해 주는 곳인지 확인해 보세요.

---

**[패턴 옵션 5: 대조 구조형 - 체크리스트 제목일 때 적합]**

**[소제목 - 질문형]**
[핵심 이슈], [구체적 질문]하나요?

가장 먼저 확인해야 할 것은 '[핵심 질문]'입니다.

단순히 "[막연한 답변]"라는 말만 하는 곳이 있고, "[구체적이고 상세한 답변 + 예시]"라고 구체적으로 설명하는 곳이 있습니다.

두 곳의 차이는 명확합니다. [차이점 설명]

실제로 [서비스]는 단순히 [X]에서 끝나는 게 아닙니다. [복잡한 요소들]이 복잡하게 얽혀 있죠.

그래서 [상황]에서 "[질문 1]", "[질문 2]"라고 구체적으로 질문해 보시길 권합니다.

---

**[이미지 제안: 상담 자료, 투명한 비용 안내서, 또는 전문 장비/자료 사진]**

---

## 3. 본문 2

선택한 제목 패턴에 따라 아래 중 하나를 사용하세요.

---

**[제목이 "통계/놓침 강조형" 또는 "체크리스트형"인 경우]**

**[첫 번째 이슈 또는 확인사항]**

**[소제목]**
[핵심 이슈], [결과]하나요?
또는
재산분할, 증거 없으면 내 것도 못 받습니다

많은 분들이 '[잘못된 믿음]'라고 생각하며 [실수]를 합니다.

[항목 1], [항목 2], [항목 3], [항목 4] 등을 [행동]해두셔야 합니다.
(각 항목은 매우 구체적이고 실행 가능해야 함. ${optionalKeywordsText ? `${optionalKeywordsText} 중 1~2개를 이 부분에 자연스럽게 포함` : ""})

[논리적 이유]. [부정적 결과].

실제로 [N]건 중 [M]건의 [상황]에서, [문제]가 발생하고 있습니다.

[이렇게 하면], 오히려 [역효과]가 발생할 수 있습니다.

저희 [가상 브랜드명]에서도 [고객 호칭]분들의 [상황]을 정밀하게 [진단/파악]하고, [세부 요소]까지 꼼꼼히 살피는 것처럼, ${blogAIKeyword} 역시 처음부터 [디테일한 접근]을 하는 것이 핵심입니다.

**[이미지 제안: 관련 서류/자료 정리 이미지 또는 체크리스트]**

---

**[두 번째 이슈 또는 확인사항]**

**[소제목]**

[일반적 오해] vs [실제 기준]

[항목 1], [항목 2], [항목 3] 등을 [행동]하는 것이 중요합니다.

[함정]은 오히려 [역효과]가 발생할 수 있습니다.

[보완 방법]도 유리하게 작용합니다.

'[감정]'이 아니라, '[논리]'를 제시해야 합니다.

**[이미지 제안: 관련 이미지]**

---

**[제목이 경고형/성공사례형/조건부해결형/질문형/비교대조형인 경우]**

그렇다면 ${blogAIKeyword}는 언제 비용 대비 가치가 있을까요?

**첫째, [상황 A]입니다.**
[구체적 예시 + 왜 가치 있는지 이유. ${optionalKeywordsText ? `이 부분에 ${optionalKeywordsText} 중 1~2개를 자연스럽게 포함` : ""}]

**둘째, [상황 B]입니다.**
[구체적 예시 + 장기적 이득]

**셋째, [상황 C]입니다.**
[근본 해결의 중요성]

**반대로 솔직히 말씀드리면,** [이런 경우]라면 [대안]만으로도 충분히 해결 가능합니다.
이런 경우까지 무리하게 [서비스]를 권하지는 않습니다.

[고객 호칭]님께 진정으로 필요한 것이 무엇인지 명확히 안내하는 것,
그것이 저희가 지키고 싶은 원칙입니다.

**[이미지 제안: 전후 비교 사례, 또는 프로세스 인포그래픽]**

---

## 4. 결론

선택한 제목 패턴에 따라 아래 중 적절한 패턴을 사용하세요.

---

**[경고형, 성공사례형 제목인 경우]**

${blogAIKeyword}를 고민하시는 분들께 오늘 꼭 전해드리고 싶었던 말씀은 이겁니다.

'비용 대비 가치'는 단순히 가격표만 보고 판단할 수 없다는 것.
중요한 건 [핵심 가치 1]과 [핵심 가치 2], 그리고 투명한 소통입니다.

[서비스]는 인생에서 가장 힘든 결정 중 하나입니다. 그 과정에서 느끼는 [감정들]은 몸과 마음 모두를 힘들게 합니다.

그래서 말씀드리고 싶습니다. [잘못된 선택 기준]만 보고 성급하게 결정하지 마시고, 당신의 상황을 진심으로 이해하고 현실적인 해결책을 제시하는 곳을 찾으시길 바랍니다.

[좋은 곳의 기준 3가지 재강조]

그런 곳이라면 [표면적 문제]뿐 아니라 당신의 [근본적 회복]도 함께 이끌어줄 수 있을 겁니다.

끝까지 읽어주셔서 감사합니다. 지금 힘든 시간을 보내고 계실 당신께, 이 글이 작은 위로와 도움이 되었으면 합니다.

**[이미지 제안: 따뜻한 느낌의 상담 장면 또는 희망적인 이미지]**

---

**[체크리스트형 제목인 경우]**

${blogAIKeyword}를 찾는 과정은 쉽지 않습니다. [감정 표현 - 예: 마음도 힘들고, 앞으로가 불안하기도 하죠].

그렇기에 [초기 상담/첫 만남]은 단순히 정보를 얻는 자리가 아닙니다.

이 [전문가]가:

- 나의 상황을 얼마나 진지하게 듣는지
- 구체적인 해결책을 제시하는지
- 나를 존중하며 투명하게 소통하는지

확인할 수 있는 유일한 기회입니다.

오늘 말씀드린 [N]가지 [확인사항/기준]만 꼭 기억하셔서, 여러분께 맞는 [전문가]를 찾으시길 바랍니다.

끝까지 읽어주셔서 감사합니다. 이 글이 조금이나마 도움이 되셨으면 좋겠습니다.

**[이미지 제안: 안심하는 표정의 상담 장면 또는 체크 완료된 리스트]**

---

오늘은 ${blogAIKeyword}에 대해 말씀드렸습니다.

[키워드에서 추론한 업종]을 고민 중이시라면, 어떤 곳을 선택하시든 위에서 설명드린 요소들을 꼼꼼히 살펴보시길 권장드립니다.

혹시 더 궁금하신 점이 있거나 도움이 필요하시다면, 언제든 편하게 문의 주셔도 좋습니다.

**[이미지 제안: 따뜻한 상담 장면 또는 연락처 안내]**

**[링크/연락처]**
📞 문의하기
(네이버 플레이스 혹은 홈페이지 링크)

---

# 작성 원칙

1. **4단 구조 필수**: 서론 → 본문1 → 본문2 → 결론
2. **톤**: 전문성 + 공감 + 정직함 (광고 느낌 제거)
3. **신뢰 구축 필수 요소**:
   - "솔직히 말씀드리면" 또는 "정직하게 말씀드리면" 포함
   - 불필요한 경우를 명시 (서비스를 권하지 않는 경우)
   - 구체적 숫자 사용 (가격대, 기간, 비율, 통계)
4. **금지 사항**:
   - 과장 ("100% 성공", "단 1회 해결", "완치 보장")
   - USP 나열식 강조 (자연스럽게 녹여야 함)
   - 과도하게 긴 문단 (각 섹션 적절한 길이 유지)
   - 존재하지 않는 브랜드명/인명 구체적으로 명시 (가상 브랜드명, 가상 원장명으로 표기)
   - 패턴명이나 기술적 용어를 본문에 노출하지 말 것
5. **필수 요소**:
   - 고객 직접 인용 2개 (서론)
   - 반대 케이스 제시 (가치 조건 패턴 사용 시)
   - 이미지 제안 4곳 이상
   - "그것이 저희가 지키고 싶은 원칙입니다" 또는 유사 문장 (해당되는 경우)
6. **SEO 필수 요구사항**:
   - **목표 키워드**: 본문에 최소 5회 이상 자연스럽게 포함 (제목 제외)
   - **필수 포함 형태소**: ${optionalKeywordsText ? `입력된 경우, 각 단어를 본문에 최소 1회 이상 자연스럽게 포함` : "없음"}
   - 키워드를 억지로 반복하지 말고, 문맥에 맞게 자연스럽게 배치
   - 각 섹션별 키워드 분산 권장: 서론 2회, 본문1 1회, 본문2 1회, 결론 1회
7. **자연스러움 체크**:
   - 각 문단이 광고가 아닌 '유용한 정보 제공'처럼 읽혀야 함
   - USP는 "문제 해결 방법" 또는 "좋은 곳의 기준"으로 포지셔닝
   - 독자가 스스로 판단할 수 있는 기준 제시
   - 키워드와 필수 형태소가 억지스럽지 않고 자연스럽게 녹아들어야 함
   - "3분만 집중해서 읽어보세요" 같은 독자 유익 약속 포함
8. **소제목 활용**:
   - 본문1, 본문2에서 소제목 적극 활용
   - 소제목 패턴: 질문형("~하나요?"), 명령형("~하세요"), 임팩트형("A, B하지 못합니다")

---

이제 아래 정보로 4단 구조의 완성된 글을 작성해주세요:

**목표 키워드**: ${blogAIKeyword}
**필수 포함 형태소** (선택): ${optionalKeywordsText || "없음"}

${analysisContext}`
      } else {
        // 커스텀 모드: 페르소나 정보 활용
        const optionalKeywordsText = blogRequiredMorphemes.length > 0 ? blogRequiredMorphemes.join(", ") : ""
        
        prompt = `# 역할
당신은 전문 서비스업(의료, 법률, 세무, 상담 등) 마케팅에 특화된 블로그 카피라이터입니다.
사용자가 제공한 페르소나 정보를 바탕으로 업체 차별점이 자연스럽게 드러나는 맞춤형 4단 구조 글을 작성합니다.

---

# 입력 정보

**[필수]**
- 목표 키워드: ${blogAIKeyword}
- 사업체명: ${personaInfo.businessName || "미입력"}
- 업종: ${personaInfo.industry || "미입력"}
- 대표명: ${personaInfo.representativeName || "미입력"}
- 판매 위치: ${personaInfo.salesLocation || "미입력"}
- 업체 차별점: ${personaInfo.differentiator || "미입력"}
- 고객 특징: ${personaInfo.customerCharacteristics || "미입력"}

**[선택]**
- 필수 포함 형태소: ${optionalKeywordsText || "없음"}

---

# Step 0: 입력 자동 보완 시스템

## 0-1. 입력 품질 검사

### 업체 차별점 검사
다음 중 하나라도 해당하면 "불충분" 판정:
- 길이 < 10자
- "열심히", "최고", "잘", "좋은", "친절", "성실" 등 추상어만 포함
- 숫자, 시간, 구체적 서비스명 없음

### 고객 특징 검사
다음 중 하나라도 해당하면 "불충분" 판정:
- 길이 < 15자
- "모르겠", "없음", "???", "x", "-" 포함
- "누가/어떤 상태/왜" 구조 없음

---

## 0-2. 업종별 USP 카테고리 템플릿

업종에 따라 아래 카테고리를 로드하세요:

### 인테리어
1. 상담/소통 방식
2. 시공 품질/기술력
3. 사후 관리/보장

### 한의원
1. 진료 시간/상담 방식
2. 치료 장비/한약 품질
3. 접근성/편의성

### 법률사무소
1. 상담 시간/방식
2. 전문성/사건 경험
3. 비용 투명성/분납

### 세무사무소
1. 상담/소통 방식
2. 전문 분야/경력
3. 신속성/정확성

### 치과
1. 진료 시간/예약 시스템
2. 장비/기술력
3. 통증 관리/사후 케어

### 피부과
1. 상담 시간/맞춤 진단
2. 장비/시술 종류
3. 부작용 관리/AS

### 정형외과
1. 진료 시간/정밀 검사
2. 물리치료 장비/재활
3. 수술 경험/사후 관리

### 미용실
1. 상담/디자이너 배정
2. 기술력/제품 품질
3. 가격/회원 혜택

### 부동산
1. 상담/매물 정보
2. 지역 전문성/거래 경험
3. 사후 관리/법률 지원

### 학원
1. 상담/학습 진단
2. 강사 경력/커리큘럼
3. 학습 관리/피드백

### 카페/음식점
1. 메뉴 구성/품질
2. 분위기/인테리어
3. 서비스/접근성

### 헬스장/필라테스
1. 상담/체형 분석
2. 프로그램/강사 경력
3. 시설/장비

### 네일샵
1. 상담/디자인 제안
2. 기술력/제품 품질
3. 가격/회원 혜택

### 기타 업종
1. 상담/고객 응대
2. 전문성/차별화 요소
3. 편의성/사후 관리

---

## 0-3. 업체 차별점 자동 보완

**업체 차별점이 불충분으로 판정되면:**

${personaInfo.industry || "업종"}에 해당하는 USP 카테고리 3가지를 로드하고,
각 카테고리별로 자연스럽고 구체적인 내용을 생성하세요.

**생성 원칙:**
1. 추상적 표현 금지 ("최고", "열심히" 등)
2. 가능하면 시간/정도 암시 ("충분한", "다양한" 등)
3. ${personaInfo.salesLocation || "지역"} 지역 특성 가능하면 반영
4. 업종 표준을 따르되 획일적이지 않게
5. 3가지 USP는 서로 다른 카테고리에서 생성

---

## 0-4. 고객 특징 자동 보완

**고객 특징이 불충분으로 판정되면:**

${personaInfo.industry || "업종"}의 일반적인 고객을 분석하여 
"누가 / 어떤 상태에서 / 왜" 구조로 1문장 생성하세요.

**생성 원칙:**
1. 업종별 가장 보편적인 고객 1~2개 선택
2. 구체적이면서 너무 좁지 않게
3. 고객의 핵심 고민/욕구 반영
4. 자연스러운 한 문장으로 연결

---

## 0-5. 보완 완료

보완된 정보로 다음 단계 진행:
- 사업체명: ${personaInfo.businessName || "미입력"} [원본 유지]
- 대표명: ${personaInfo.representativeName || "미입력"} [원본 유지]
- 판매 위치: ${personaInfo.salesLocation || "미입력"} [원본 유지]
- 키워드: ${blogAIKeyword} [원본 유지]
- 업체 차별점: [보완된 3가지 USP 또는 원본]
- 고객 특징: [보완된 1문장 또는 원본]
- 필수 포함 형태소: ${optionalKeywordsText || "없음"} [원본 유지]

---

# Step 1: 업종 및 키워드 분석

${personaInfo.industry || "업종"}와 ${blogAIKeyword}를 분석하여:

- **고객 호칭**: 한의원/병원→환자, 법률→의뢰인, 세무→고객, 상담→내담자, 미용→고객, 음식점→손님
- **서비스 호칭**: 한의원→치료, 법률→소송/상담, 세무→신고, 미용→시술, 음식점→메뉴
- **일반 가격대**: 업종 표준 시장 가격
- **전문성 지표**: 경력, 장비, 자격증 등

${personaInfo.customerCharacteristics || "고객 특징"}에서 핵심 반박 5가지 추론:
1. 효과/결과 의심
2. 비용 부담
3. 시간/기간 불확실
4. 신뢰성 의심
5. 리스크/부작용 걱정

---

# Step 2: 제목 생성

${personaInfo.salesLocation || "지역"} ${blogAIKeyword}, [독자의 핵심 반박에 맞는 패턴 1개 선택]

**제목 패턴:**
1. 경고형: "${personaInfo.salesLocation || "지역"} ${blogAIKeyword}, [흔한 실수]하지 마세요"
2. 체크리스트형: "${personaInfo.salesLocation || "지역"} ${blogAIKeyword}? [상황]에서 확인해야 할 N가지"
3. 통계/놓침형: "${personaInfo.salesLocation || "지역"} ${blogAIKeyword}, N건 중 M건이 놓치는 주의사항"
4. 성공사례형: "${personaInfo.salesLocation || "지역"} ${blogAIKeyword} [행동] 후 [결과] 얻은 N가지 이유"
5. 조건부해결형: "${personaInfo.salesLocation || "지역"} ${blogAIKeyword}, [고민]다면 이것부터 확인하세요"
6. 질문형: "${personaInfo.salesLocation || "지역"} ${blogAIKeyword}, [핵심 의심]?"
7. 비교대조형: "${personaInfo.salesLocation || "지역"} ${blogAIKeyword}, [A] vs [B] 어떻게 다를까?"

---

# Step 3: 4단 구조 글 작성

## 1. 서론

"[고객 직접 인용 1 - 추론한 핵심 반박 1, ${blogAIKeyword} 포함]"

"[고객 직접 인용 2 - 추론한 핵심 반박 2]"

안녕하세요. ${personaInfo.salesLocation || "지역"}에서 ${personaInfo.businessName || "업체명"}을(를) 운영하고 있는 ${personaInfo.representativeName || "대표명"}입니다.

지난 [N]년간 [고객 호칭]분들을 만나면서, 위와 같은 고민을 정말 많이 들었습니다. 
[서비스]는 비용 부담도 있고 결과도 불확실하니 당연히 망설여지시겠죠.

특히 ${personaInfo.customerCharacteristics || "고객 특징"}에서 "어떤 상태"일 때는 더욱 신중해질 수밖에 없습니다.

저희 ${personaInfo.businessName || "업체명"}을(를) 찾아오시는 분들도 ${personaInfo.customerCharacteristics || "고객 특징"}입니다.

그래서 오늘은 ${personaInfo.salesLocation || "지역"} ${blogAIKeyword}를 고민하시는 분들께 [핵심 질문]에 대해 솔직하게 말씀드리려 합니다.

이 글이 여러분의 현명한 선택에 도움이 되길 바랍니다.

**[이미지 제안: ${personaInfo.industry || "업종"} 상담 장면 또는 ${personaInfo.businessName || "업체명"} 전경]**

---

**[체크리스트형 제목일 때 대안]**

"[고객 직접 인용 1 - 막막함]"

"[고객 직접 인용 2 - 후회]"

지난 [N]년간 ${personaInfo.salesLocation || "지역"}에서 ${personaInfo.industry || "업종"}을 운영하면서 많은 [고객 호칭]분들을 만나왔습니다. 
그분들 중 상당수가 ${personaInfo.customerCharacteristics || "고객 특징"}의 "어떤 상태"에서 무엇을 확인해야 할지 몰라 중요한 기회를 놓치셨더라고요.

${personaInfo.salesLocation || "지역"} ${blogAIKeyword}를 찾는 분들도 마찬가지일 겁니다.

막상 상담실에 앉으면 머릿속이 하얘지고, 준비했던 질문들도 다 까먹게 되죠.

오늘은 ${personaInfo.salesLocation || "지역"} ${blogAIKeyword} 선택 시 반드시 확인해야 할 핵심 사항을 정리해 드리겠습니다.

3분만 집중해서 읽어보세요.

**[이미지 제안: 체크리스트와 펜]**

---

## 2. 본문 1 (USP 자연스럽게 녹이기)

많은 분들이 ${personaInfo.salesLocation || "지역"} ${blogAIKeyword}를 고려하실 때 가장 궁금해하시는 부분이 바로 '[구체적 질문]'입니다.

일반적으로 ${personaInfo.salesLocation || "지역"} 지역 ${personaInfo.industry || "업종"}은(는) [가격대], [기간], [절차] 정도가 소요됩니다.
[추가 객관 정보. ${optionalKeywordsText ? `${optionalKeywordsText} 1~2개 포함` : ""}]

**그런데 ${personaInfo.industry || "업종"}은(는) 단순히 [A]만으로 판단할 수 없습니다.**
왜냐하면 [이유 1], [이유 2], [이유 3] 때문입니다.

---

**[패턴: 체크리스트형 - USP 녹이기 최적]**

그렇다면 ${personaInfo.salesLocation || "지역"} ${personaInfo.industry || "업종"} 선택 시 무엇을 확인해야 할까요?

업체 차별점의 3가지를 각 체크포인트에 배치:

**✓ 첫째, [업체 차별점 1번째]**
[설명 2~3문장. 업체 차별점의 구체적 내용을 자연스럽게 풀어서 설명]

**✓ 둘째, [업체 차별점 2번째]**
[설명 2~3문장]

**✓ 셋째, [업체 차별점 3번째]**
[설명 2~3문장]

저희 ${personaInfo.businessName || "업체명"}은(는) 이 세 가지를 모두 충족하기 위해:
- [업체 차별점 1번째를 간결하게]
- [업체 차별점 2번째를 간결하게]
- [업체 차별점 3번째를 간결하게]

이러한 시스템을 운영하고 있습니다.

---

**[대안: 비유 연결형]**

저희 ${personaInfo.businessName || "업체명"}에서도 [업체 차별점 1번째 핵심]을(를) 드립니다. 
단순히 [A]만 듣는 게 아니라, [B], [C]까지 종합적으로 파악해야 정확한 [진단/계획]을 세울 수 있기 때문입니다.

${personaInfo.salesLocation || "지역"} ${blogAIKeyword}를 선택할 때도 똑같습니다. 
[성급한 대응]은 조심하셔야 합니다.

${personaInfo.customerCharacteristics || "고객 특징"}의 "어떤 상태"를 근본적으로 개선하려면 [복잡한 요소들]을 모두 고려해야 하죠.

그렇기에 초기 단계에서 당신의 이야기를 끝까지 경청하고, 궁금한 점에 투명하게 설명해 주는 곳인지 확인하세요.

또한 [업체 차별점 2번째], [업체 차별점 3번째]도 함께 체크하시길 바랍니다.

---

**[이미지 제안: 상담 장면, 장비 사진, 또는 투명한 안내]**

---

## 3. 본문 2 (가치 제시)

**[제목이 통계/놓침형 또는 체크리스트형일 때]**

**[첫 번째 이슈]**

**[소제목]**

많은 분들이 '[추론한 핵심 반박 중 하나]'라고 생각하며 [실수]를 합니다.

[항목들] 등을 [행동]해두셔야 합니다.

[논리적 이유]. [부정적 결과].

실제로 [N]건 중 [M]건의 경우, [문제]가 발생하고 있습니다.

저희 ${personaInfo.businessName || "업체명"}에서도 [고객 호칭]분들의 [상황]을 정밀하게 파악합니다.

**[이미지 제안: 관련 자료]**

---

**[두 번째 이슈]**

**[소제목]**

[일반적 오해] vs [실제 기준]

[항목들]을 [행동]하는 것이 중요합니다.

**[이미지 제안: 관련 이미지]**

---

**[제목이 경고형/성공사례형/조건부해결형/질문형/비교대조형일 때]**

그렇다면 ${personaInfo.salesLocation || "지역"} ${blogAIKeyword}는 언제 비용 대비 가치가 있을까요?

**첫째, ${personaInfo.customerCharacteristics || "고객 특징"}의 "어떤 상태"일 때입니다.**
[구체적 예시. ${optionalKeywordsText ? `${optionalKeywordsText} 1~2개 포함` : ""}]

**둘째, [상황 B]일 때입니다.**
[구체적 예시]

**셋째, [상황 C]일 때입니다.**
[근본 해결의 중요성]

**반대로 솔직히 말씀드리면,** [이런 경우]라면 [대안]으로도 충분합니다.
이런 경우까지 무리하게 [서비스]를 권하지는 않습니다.

[고객 호칭]님께 진정으로 필요한 것이 무엇인지 명확히 안내하는 것,
그것이 저희 ${personaInfo.businessName || "업체명"}이(가) 지키고 싶은 원칙입니다.

**[이미지 제안: 전후 비교 또는 프로세스]**

---

## 4. 결론 (USP 종합)

**[경고형, 성공사례형 제목일 때]**

${personaInfo.salesLocation || "지역"} ${blogAIKeyword}를 고민하시는 분들께 오늘 꼭 전해드리고 싶었던 말씀은 이겁니다.

'좋은 ${personaInfo.industry || "업종"}'은(는) 단순히 [잘못된 기준]만 보고 판단할 수 없다는 것.
중요한 건 [핵심 가치]와 투명한 소통입니다.

${personaInfo.customerCharacteristics || "고객 특징"}이신 분들에게 [서비스]는 [핵심 목표]을(를) 이루는 중요한 결정입니다.

저희 ${personaInfo.businessName || "업체명"}은(는) [고객 호칭]님께:
- [업체 차별점 1번째를 자연스럽게]
- [업체 차별점 2번째를 자연스럽게]
- [업체 차별점 3번째를 자연스럽게]

이러한 시스템으로 함께하고 있습니다.

${personaInfo.salesLocation || "지역"}에서 [핵심 목표]을(를) 진심으로 원하신다면, 
당신의 상황을 이해하고 현실적인 해결책을 제시하는 곳을 찾으시길 바랍니다.

끝까지 읽어주셔서 감사합니다. 지금 힘든 시간을 보내고 계실 당신께, 이 글이 작은 위로와 도움이 되었으면 합니다.

**[이미지 제안: 따뜻한 상담 장면]**

---

**[체크리스트형 제목일 때]**

${personaInfo.salesLocation || "지역"} ${blogAIKeyword}를 찾는 과정은 쉽지 않습니다. 
${personaInfo.customerCharacteristics || "고객 특징"}의 "어떤 상태"에서는 더욱 그렇죠.

그렇기에 초기 상담은 단순히 정보를 얻는 자리가 아닙니다. 

이 ${personaInfo.industry || "업종"}이(가):
- 나의 상황을 얼마나 진지하게 듣는지
- 구체적인 해결책을 제시하는지
- 나를 존중하며 투명하게 소통하는지

확인할 수 있는 유일한 기회입니다.

저희 ${personaInfo.businessName || "업체명"}은(는) ${personaInfo.salesLocation || "지역"}에서 ${personaInfo.customerCharacteristics || "고객 특징"}이신 분들과 함께하고 있습니다.

끝까지 읽어주셔서 감사합니다.

**[이미지 제안: 안심하는 상담 장면]**

---

오늘은 ${blogAIKeyword}에 대해 말씀드렸습니다.

${personaInfo.industry || "업종"}을 고민 중이시라면, 어떤 곳을 선택하시든 위에서 설명드린 요소들을 꼼꼼히 살펴보시길 권장드립니다.

혹시 더 궁금하신 점이 있거나 도움이 필요하시다면, 언제든 편하게 문의 주셔도 좋습니다.

**[이미지 제안: 따뜻한 상담 장면 또는 연락처 안내]**

**[링크/연락처]**
📞 문의하기
(네이버 플레이스 혹은 홈페이지 링크)

---

# 작성 원칙

## 1. 실제 정보 정확 반영
- 사업체명: 오타 없이 정확히
- 대표명: 존칭 없이 이름만
- 판매 위치: 제목 1회 + 본문 3~5회
- 업체 차별점: 본문1에서 3가지 모두 명시
- 고객 특징: 서론, 본문2, 결론에 녹임

## 2. USP 활용 전략
- 본문1 체크리스트: USP 3개 각각 배치
- 결론: USP 3개 종합 정리
- 표현: 구체적이고 자연스럽게

## 3. 톤
- 전문성 + 공감 + 정직함
- "솔직히 말씀드리면" 포함
- 광고 아닌 정보 제공 느낌

## 4. SEO
- 키워드: 5회 이상
- 지역: 4회 이상
- 업체명: 3회 이상
- 형태소: 각 1회 이상

## 5. 금지
- 과장 표현
- USP 단순 나열
- 패턴명 노출

---

이제 입력 정보로 맞춤형 글을 작성해주세요.

${analysisContext}`
      }

      // Step 3: AI 글 작성 (60%)
      setGenerationStep("writing")
      setGenerationProgress(60)
      
      const msg = await anthropic.messages.create({
        model: "claude-opus-4-5-20251101",
        max_tokens: 20000,
        temperature: 1,
        messages: [
          {
            role: "user",
            content: `당신은 블로그 콘텐츠 전문 작가입니다. SEO 최적화와 전환율을 고려한 고품질 블로그 글을 작성합니다.\n\n${prompt}`,
          },
        ],
      })

      const fullContent = msg.content[0].type === "text" ? msg.content[0].text : "콘텐츠를 생성할 수 없습니다."

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
            const titleMsg = await anthropic.messages.create({
              model: "claude-opus-4-5-20251101",
              max_tokens: 200,
              temperature: 1,
              messages: [
                {
                  role: "user",
                  content: `당신은 SEO 최적화된 블로그 제목 전문가입니다. 키워드를 자연스럽게 포함한 매력적인 제목을 작성합니다.\n\n키워드: ${blogAIKeyword}\n본문 내용: ${content.substring(0, 500)}\n\n위 정보를 바탕으로 SEO 최적화된 블로그 제목을 하나만 생성해주세요. 제목만 작성하고 다른 설명은 하지 마세요.`,
                },
              ],
            })

            title = titleMsg.content[0].type === "text" ? titleMsg.content[0].text.trim() : blogAIKeyword || "AI 생성 블로그 포스트"
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

      // Step 3: AI 글 작성 완료 - 타이핑 애니메이션 시작
      // 타이핑 애니메이션 효과를 위한 시뮬레이션
      setStreamingContent("")
      let currentIndex = 0
      const typingInterval = setInterval(async () => {
        if (currentIndex < content.length) {
          const chunk = content.slice(0, currentIndex + 1)
          setStreamingContent(chunk)
          currentIndex += Math.floor(Math.random() * 3) + 1 // 1-3 글자씩 랜덤하게
        } else {
          clearInterval(typingInterval)
          
          // 타이핑 애니메이션 완료 - SEO 최적화 단계로 전환
          // Step 4: SEO 최적화 (80%)
          setGenerationStep("seo")
          setGenerationProgress(80)
          
          // SEO 최적화 단계 시뮬레이션 (2초)
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Step 5: 최종 검수 (100%)
          setGenerationStep("final")
          setGenerationProgress(100)
          
          // 최종 검수 단계 시뮬레이션 (2초)
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // 모든 단계 완료 후 콘텐츠 표시
          setGeneratedContent(content)
          setEditedContent(content) // 편집용 콘텐츠도 업데이트
          setStreamingContent("")
          
          // 제목이 없으면 키워드로 설정
          if (!blogTitle) {
            setBlogTitle(blogAIKeyword || "AI 생성 블로그 포스트")
          }
          
          // 이미지 생성 시작 (병렬 처리)
          if (imageMode === "ai" && !imageGenerationStartedRef.current) {
            console.log("[MoneyTaker] 콘텐츠 생성 완료, 이미지 생성 시작")
            generateImagesForContent(content)
          }
          
          // 모든 단계 완료 - 로딩 UI 종료
          setIsGenerating(false)
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

      const guidePrompt = `## 📍 4단계: 1PAGE 가이드 자동 작성

사용자가 키워드를 고르면, 아래 포맷에 맞춰 실무용 가이드를 작성해줘.

※ **업체명/제품 정보만 바뀌고 나머지 구성은 90% 이상 고정될 것**

### 📑 1PAGE 가이드 구성

**1. 업체명**

(예: 🍃 [르마]) : 여기에는 처음에 작성한 업체명이 들어가야 해.

**2. 블로그 내 필수 키워드**

- 메인 키워드: 제목 + 본문에 5회 이상
- 서브 키워드: 메인 키워드를 중심으로 검색 확장된 키워드 제안
    - 예: 신혼부부 선물 추천, 아기옷 건조기, 향기 좋은 세탁용품
    📌 "서브 키워드는 참고용입니다.
    업체 상황에 맞게 직접 수정해주시면 좋습니다."

**3. 블로그 글 제목 예시**

- 메인 키워드를 앞에 넣어 후기 느낌으로 작성
(예: [건조기시트 추천] 신혼부부 집들이 선물로 최고였어요!)

**4. 블로그 글 작성 조건**

- 글자 수: 1300자 이상
- 맞춤법/띄어쓰기 철저
- 사진 15장 이상 (직접 촬영 / 다양한 배경)
- 영상 1개 (gif 가능)

📌 "**상세페이지 캡처는 금지입니다.**

단, 고깃집이나 오프라인 서비스 업종은 이 항목은 생략 가능합니다."

**5. 본문에서 어필할 내용**

- 제품/공간의 특징
- 타사 대비 차별점
- 실제 사용 후기 느낌 (포장, 향, 사용감 등)
- 타겟 공감 요소 반영

**6. 필수 링크**

- 📌 "여기에 스마트스토어, 상세페이지 링크를 꼭 넣어주세요."
- 🗺️ "오프라인 업체의 경우, 지도 링크도 함께 삽입해주세요."
(예: https://naver.me/abc123)

**7. 마감 기한**

- 제품 수령 or 체험 후 **3일 이내** 포스팅 제출 필수

**8. 주의사항 및 저작권 안내**

- 포스팅은 3개월 이상 유지
- 가이드 미준수 시 수정 또는 삭제 요청 가능
- 사진/영상은 브랜드 홍보용으로 사용될 수 있음

---

입력 정보:
${prompt}

위 정보를 바탕으로 위 포맷에 맞춰 1PAGE 가이드를 작성해주세요. 서식은 코드 블록 없이 일반 텍스트로만 보여줘.`

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
              content: "당신은 체험단/기자단 마케팅 전문가입니다. 검색 유입 → 체험 → 후기 전환까지 이어지는 설계자처럼 행동해야 합니다. 업체명/제품 정보만 바뀌고 나머지 구성은 90% 이상 고정된 포맷으로 실무용 가이드를 작성합니다.",
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

      const recruitmentPrompt = `## 📍 5단계: 오픈채팅 모집글 작성 (요청 시)

다음 체험단 가이드를 바탕으로 오픈채팅 모집글을 작성해주세요:

${generatedGuide}

아래 구조로 작성:

📣 제목 (이모지 포함)

🛍️ 체험 혜택 요약

📝 모집 대상

📷 후기 작성 조건

📌 신청 링크 안내:

→ "신청 링크는 네이버폼 or 구글폼으로 직접 입력해주세요 :)"

📌 지도 링크 있을 경우, 지역명과 함께 반드시 명시

---

서식은 코드 블록 없이 일반 텍스트로만 보여줘. 친근하고 매력적인 톤으로 작성해주세요.`

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

      // 이미지 생성 모드인 경우 이미지 제안 위치를 포함한 프롬프트 생성
      const imagePromptPart = reporterImageMode === "generate" 
        ? `\n7. 본문 중간에 이미지를 삽입할 위치를 표시해주세요. 이미지 제안 위치는 다음과 같이 표시하세요:
   **[이미지 제안: 이미지 설명]**
   예: **[이미지 제안: 전문가 상담 장면 또는 사무실/병원 전경]**
   이미지 제안은 본문의 적절한 위치에 3~4곳 배치해주세요.`
        : ""

      const prompt = `목표 키워드: ${reporterKeyword}
필수 포함 형태소: ${requiredMorphemes.join(", ")}

위 정보를 바탕으로 약 2,000자 정도의 블로그 원고를 작성해주세요.

요구사항:
1. 목표 키워드를 본문에 7회 이상 자연스럽게 포함
2. 필수 포함 형태소를 각각 1회 이상 포함
3. 제목도 포함하여 작성 (제목은 첫 줄에 작성)
4. SEO 최적화된 구조
5. 읽기 쉽고 전문적인 문체
6. 구체적이고 실용적인 내용${imagePromptPart}
7. 원고 마지막에 반드시 다음 형식의 CTA(Call To Action) 섹션을 포함해주세요:

---
오늘은 ${reporterKeyword}에 대해 말씀드렸습니다.

[키워드에서 추론한 업종]을 고민 중이시라면, 어떤 곳을 선택하시든 위에서 설명드린 요소들을 꼼꼼히 살펴보시길 권장드립니다.

혹시 더 궁금하신 점이 있거나 도움이 필요하시다면, 언제든 편하게 문의 주셔도 좋습니다.

**[이미지 제안: 따뜻한 상담 장면 또는 연락처 안내]**

**[링크/연락처]**
📞 문의하기
(네이버 플레이스 혹은 홈페이지 링크)
---

위 CTA 섹션을 원고 마지막에 자연스럽게 포함하여 작성해주세요. 업종은 키워드를 기반으로 적절히 추론하여 작성해주세요.

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

      // 이미지 생성 (AI 생성 모드인 경우) - 블로그 AI와 동일한 방식
      if (reporterImageMode === "generate") {
        generateReporterImagesForContent(content)
      }
    } catch (error) {
      console.error("원고 생성 실패:", error)
      alert(error instanceof Error ? error.message : "원고 생성에 실패했습니다.")
    } finally {
      setIsGeneratingDraft(false)
    }
  }

  // 기자단 AI: 이미지 생성 (블로그 AI와 동일한 방식)
  const generateReporterImagesForContent = async (content: string) => {
    try {
      // 콘텐츠에서 이미지 제안 개수 및 설명 추출
      const imageSuggestionRegex = /\*\*\[?이미지 제안:\s*([^\]]+)\]?\*\*/g
      const imageSuggestions: string[] = []
      let match
      while ((match = imageSuggestionRegex.exec(content)) !== null) {
        imageSuggestions.push(match[1].trim())
      }
      const imageSuggestionCount = imageSuggestions.length
      
      if (imageSuggestionCount === 0) {
        console.log("[Reporter AI] 이미지 제안 위치가 없습니다.")
        return
      }

      console.log("[Reporter AI] 이미지 제안 개수:", imageSuggestionCount)
      console.log("[Reporter AI] 이미지 제안 설명:", imageSuggestions)
      
      // 이미지 생성 시작 상태 설정
      setIsGeneratingImages(true)
      setTotalImageCount(imageSuggestionCount)
      
      // OpenAI API 키
      const OPENAI_API_KEY = "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"
      
      // 이미지 제안 설명을 포함한 프롬프트 생성
      const imageSuggestionContext = imageSuggestions.length > 0
        ? `\n\n이미지 제안 설명:\n${imageSuggestions.map((desc, idx) => `${idx + 1}. ${desc}`).join("\n")}\n\n각 이미지 제안 설명에 맞는 구체적인 이미지를 생성해주세요.`
        : ""
      
      // 생성된 콘텐츠를 기반으로 이미지 프롬프트 생성 (전체 내용 사용)
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
              content: "You are an expert at creating photorealistic, realistic image prompts. Generate detailed, photorealistic image prompts in English based on the blog content, keyword, and image suggestion descriptions. CRITICAL: The keyword is the MAIN SUBJECT/HERO of each image. The keyword must be the central focus and protagonist of the image. Each prompt should describe a different scene or concept from the blog that matches the corresponding image suggestion. ABSOLUTE MANDATORY REQUIREMENT: ALL images MUST be PHOTOREALISTIC, REALISTIC PHOTOGRAPHY, NOT illustration, NOT cartoon, NOT drawing, NOT painting. Use terms like 'photorealistic', 'realistic photography', 'professional photography', 'high-quality photo', 'lifelike', 'cinematic photo'. ALL people in ALL images MUST be Korean people only. Use Korean appearance, Korean ethnicity, Korean facial features, Korean skin tone, Korean hair, Korean eyes. The setting MUST be Korean style - Korean office, Korean consultation room, Korean business environment, Korean atmosphere, Korean culture, Korean lifestyle. ABSOLUTELY DO NOT include: Western people, Caucasian, European, American, Japanese, Chinese, or any other ethnicity. NO foreign languages, NO English text, NO foreign signs, NO foreign architecture, NO foreign style, NO foreign elements. NO illustrations, NO cartoons, NO drawings, NO paintings, NO AI-generated look, NO artificial appearance. Every single person in every image must be Korean. NO EXCEPTIONS. Create photorealistic, natural, candid, lifestyle photography with Korean people only in Korean settings. The keyword must be prominently featured as the main subject. Include Korean office scenes, Korean consultation rooms, Korean professional settings, or Korean business environments when appropriate. The images should feature Korean professionals, clients, or people in authentic Korean professional or service industry contexts. Avoid staged or artificial poses. Focus on authentic Korean moments, natural Korean expressions, and real Korean environments. Return only the prompts, one per line, without numbering or bullet points.",
            },
            {
              role: "user",
              content: `Keyword (MAIN SUBJECT/HERO): ${reporterKeyword}\n\nBased on this blog content and keyword, generate ${imageSuggestionCount} photorealistic, realistic photography image prompts in English. The keyword "${reporterKeyword}" must be the MAIN SUBJECT and HERO of each image. Each prompt should match the corresponding image suggestion description and be relevant to the blog content. CRITICAL: Images must be PHOTOREALISTIC, REALISTIC PHOTOGRAPHY - use terms like 'photorealistic', 'realistic photography', 'professional photography', 'high-quality photo', 'lifelike', 'cinematic photo'. NOT illustration, NOT cartoon, NOT drawing, NOT painting. ABSOLUTE MANDATORY: ALL people in ALL images MUST be Korean people only. Use Korean appearance, Korean ethnicity, Korean facial features, Korean skin tone, Korean hair, Korean eyes. The setting MUST be Korean style - Korean office, Korean consultation room, Korean business environment, Korean atmosphere, Korean culture, Korean lifestyle. ABSOLUTELY DO NOT include: Western people, Caucasian, European, American, Japanese, Chinese, or any other ethnicity. NO foreign languages, NO English text, NO foreign signs, NO foreign architecture, NO foreign style, NO foreign elements. NO illustrations, NO cartoons, NO drawings, NO paintings, NO AI-generated look. Every single person in every image must be Korean. NO EXCEPTIONS. Create photorealistic, candid, lifestyle photography with Korean people only in Korean settings. The keyword "${reporterKeyword}" must be prominently featured as the main subject in each image. Include Korean professional office scenes, Korean consultation rooms, or Korean business environments when relevant. The images should feel natural and unposed, with real Korean expressions and Korean environments.${imageSuggestionContext}\n\nBlog content:\n${content}`,
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
      console.log("[Reporter AI] 생성된 이미지 프롬프트 텍스트:", promptsText)
      let imagePrompts = promptsText
        .split("\n")
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0)
        .slice(0, imageSuggestionCount)

      console.log("[Reporter AI] 파싱된 이미지 프롬프트:", imagePrompts)
      console.log("[Reporter AI] 이미지 제안 개수:", imageSuggestionCount, "프롬프트 개수:", imagePrompts.length)

      // 프롬프트 개수가 부족하면 기본 프롬프트로 채우기
      while (imagePrompts.length < imageSuggestionCount) {
        imagePrompts.push(`Photorealistic, realistic photography of ${reporterKeyword || "Korean consultation scene"} with Korean people only in Korean office setting, Korean style, Korean atmosphere, professional photography, high-quality photo, lifelike, no foreign elements, no foreign languages, no foreign signs, NOT illustration, NOT cartoon`)
      }
      // 초과하면 자르기
      if (imagePrompts.length > imageSuggestionCount) {
        imagePrompts = imagePrompts.slice(0, imageSuggestionCount)
      }

      if (imagePrompts.length === 0) {
        console.warn("[Reporter AI] 이미지 프롬프트가 생성되지 않음")
        setIsGeneratingImages(false)
        return
      }

      // 이미지 배열을 이미지 제안 개수만큼 초기화 (빈 문자열로)
      const initialImages = new Array(imageSuggestionCount).fill("")
      setReporterImages(initialImages)

      // 각 프롬프트로 이미지 생성 (병렬 처리, Promise.all 사용)
      const imagePromises = imagePrompts.map(async (prompt: string, index: number) => {
        try {
          console.log(`[Reporter AI] 이미지 ${index + 1}/${imageSuggestionCount} 생성 요청 시작:`, prompt.substring(0, 50) + "...")
          
          // 재시도 로직이 포함된 이미지 생성
          const result = await generateImageWithRetry(prompt, 5)
          
          if (result.success && result.imageUrl) {
            console.log(`[Reporter AI] ✅ 이미지 ${index + 1}/${imageSuggestionCount} 생성 성공`)
            
            // 함수형 업데이트로 정확한 인덱스에 저장 (중복 방지)
            setReporterImages((prev) => {
              const newImages = [...prev]
              
              // 배열이 충분히 크도록 확장
              while (newImages.length < imageSuggestionCount) {
                newImages.push("")
              }
              
              // 해당 인덱스가 비어있을 때만 저장 (중복 방지)
              if (index >= 0 && index < imageSuggestionCount) {
                if (!newImages[index] || newImages[index] === "") {
                  newImages[index] = result.imageUrl!
                  console.log(`[Reporter AI] ✅ 이미지 저장 완료 - 인덱스 ${index}에 저장됨 (배열 길이: ${newImages.length}, 총 ${imageSuggestionCount}개 중 ${index + 1}번째)`)
                } else {
                  console.log(`[Reporter AI] ⚠️ 인덱스 ${index}에 이미 이미지가 있음, 건너뜀 (기존 이미지 유지)`)
                }
              } else {
                console.error(`[Reporter AI] ❌ 잘못된 인덱스: ${index} (범위: 0-${imageSuggestionCount - 1})`)
              }
              
              return newImages
            })
            
            return { index, success: true, imageUrl: result.imageUrl }
          } else {
            console.error(`[Reporter AI] ❌ 이미지 ${index + 1} 생성 최종 실패 (5번 시도 후):`, result.error)
            return { index, success: false, error: result.error }
          }
        } catch (error) {
          console.error(`[Reporter AI] ❌ 이미지 ${index + 1} 생성 예외:`, error)
          return { index, success: false, error: error instanceof Error ? error.message : "알 수 없는 오류" }
        }
      })

      // 모든 이미지 생성 완료 대기
      console.log(`[Reporter AI] ========================================`)
      console.log(`[Reporter AI] 총 ${imagePromises.length}개의 이미지 생성 시작 (각 인덱스: 0~${imagePromises.length - 1})`)
      console.log(`[Reporter AI] 이미지 제안 개수: ${imageSuggestionCount}`)
      console.log(`[Reporter AI] ========================================`)
      
      const results = await Promise.all(imagePromises)
      
      const successCount = results.filter(r => r.success).length
      const skippedCount = results.filter(r => (r as any).skipped).length
      console.log(`[Reporter AI] ========================================`)
      console.log(`[Reporter AI] ✅ 이미지 생성 완료: ${successCount}/${imagePromises.length}개 성공 (건너뜀: ${skippedCount}개)`)
      console.log(`[Reporter AI] ========================================`)
      
      // 최종 이미지 배열 상태 확인
      setReporterImages((prev) => {
        const filledCount = prev.filter(img => img && img !== "").length
        console.log(`[Reporter AI] 최종 이미지 배열 상태: ${filledCount}/${imageSuggestionCount}개 채워짐`)
        console.log(`[Reporter AI] 이미지 배열 상세:`, prev.map((img, idx) => `[${idx}]: ${img ? '있음' : '없음'}`).join(', '))
        return prev
      })
      
      // 모든 이미지 생성이 완료되면 상태 업데이트
      setIsGeneratingImages(false)
    } catch (error) {
      console.error("이미지 생성 중 오류:", error)
      setIsGeneratingImages(false)
    }
  }

  // 기자단 AI: 이미지 생성 (구버전 - 호환성 유지)
  const generateReporterImages = async (content: string) => {
    // 새로운 함수로 리다이렉트
    return generateReporterImagesForContent(content)
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

  // HTML을 RTF 형식으로 변환하는 함수
  const convertHTMLToRTF = (html: string): string => {
    // HTML 태그를 제거하고 텍스트만 추출
    const tempDiv = document.createElement("div")
    tempDiv.innerHTML = html
    
    // 기본 RTF 헤더 (한글 폰트 지원)
    let rtf = "{\\rtf1\\ansi\\ansicpg949\\deff0\\nouicompat\\deflang1033{\\fonttbl{\\f0\\fnil\\fcharset0 Times New Roman;}{\\f1\\fnil\\fcharset129 \\ub9d1\\uc740 \\uace0\\ub515;}{\\f2\\fnil\\fcharset129 \\ub9d1\\uc740 \\uace0\\ub515;}}\\f1\\fs24\\lang18 "
    
    // 텍스트를 유니코드로 변환하는 헬퍼 함수
    const escapeRTF = (text: string): string => {
      let result = ""
      for (let i = 0; i < text.length; i++) {
        const char = text[i]
        const code = char.charCodeAt(0)
        if (code < 128) {
          // ASCII 문자
          if (char === "\\") result += "\\\\"
          else if (char === "{") result += "\\{"
          else if (char === "}") result += "\\}"
          else if (char === "\n") result += "\\par "
          else result += char
        } else {
          // 유니코드 문자 (한글 등)
          result += `\\u${code}?`
        }
      }
      return result
    }
    
    // HTML 요소를 RTF로 변환
    const convertNode = (node: Node): string => {
      let result = ""
      
      if (node.nodeType === Node.TEXT_NODE) {
        // 텍스트 노드: 특수 문자 이스케이프 및 유니코드 변환
        const text = node.textContent || ""
        result = escapeRTF(text)
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        const tagName = element.tagName.toLowerCase()
        
        if (tagName === "br") {
          result = "\\par "
        } else if (tagName === "p") {
          const content = Array.from(node.childNodes).map(convertNode).join("")
          result = "\\par " + content + "\\par "
        } else if (tagName === "strong" || tagName === "b") {
          result = "{\\b " + Array.from(node.childNodes).map(convertNode).join("") + "}"
        } else if (tagName === "em" || tagName === "i") {
          result = "{\\i " + Array.from(node.childNodes).map(convertNode).join("") + "}"
        } else if (tagName === "u") {
          result = "{\\ul " + Array.from(node.childNodes).map(convertNode).join("") + "}"
        } else if (tagName === "h1" || tagName === "h2" || tagName === "h3" || tagName === "h4") {
          result = "{\\b\\fs32 " + Array.from(node.childNodes).map(convertNode).join("") + "}\\par "
        } else if (tagName === "div") {
          const classList = element.classList
          let content = Array.from(node.childNodes).map(convertNode).join("")
          
          // 제목 스타일 처리
          if (classList && classList.contains("contract-title")) {
            result = "{\\qc\\b\\f1\\fs60 " + content + "}\\par\\par "
          } else if (classList && classList.contains("contract-date")) {
            result = "{\\qc\\f1\\fs32 " + content + "}\\par\\par "
          } else if (classList && classList.contains("signature-section-page1")) {
            result = "{\\qc\\f1 " + content + "}\\par "
          } else if (classList && classList.contains("article-title")) {
            result = "{\\b\\f1\\fs30 " + content + "}\\par "
          } else if (classList && classList.contains("article-content")) {
            result = "{\\f1 " + content + "}\\par "
          } else if (classList && classList.contains("preamble")) {
            result = "{\\f1 " + content + "}\\par\\par "
          } else {
            result = "{\\f1 " + content + "}"
          }
        } else if (tagName === "table") {
          result = Array.from(node.childNodes).map(convertNode).join("") + "\\par "
        } else if (tagName === "tr") {
          const cells = Array.from(node.childNodes).map(convertNode).join(" | ")
          result = cells + "\\par "
        } else if (tagName === "td" || tagName === "th") {
          result = Array.from(node.childNodes).map(convertNode).join("")
        } else if (tagName === "style" || tagName === "script" || tagName === "head") {
          // 스타일과 스크립트는 무시
          result = ""
        } else {
          result = Array.from(node.childNodes).map(convertNode).join("")
        }
      }
      
      return result
    }
    
    // body 내용만 변환
    const body = tempDiv.querySelector("body") || tempDiv
    
    // .page 요소들을 찾아서 페이지 구분 추가
    const pageElements = body.querySelectorAll(".page")
    if (pageElements.length > 0) {
      pageElements.forEach((pageEl, index) => {
        if (index > 0) {
          rtf += "\\page "
        }
        rtf += Array.from(pageEl.childNodes).map(convertNode).join("")
      })
    } else {
      // .page 요소가 없으면 일반 변환
      rtf += Array.from(body.childNodes).map(convertNode).join("")
    }
    
    rtf += "}"
    return rtf
  }

  // 기자단 AI: 계약서 생성
  const handleGenerateContract = async () => {
    if (!contractInfo.advertiserName || !contractInfo.agencyName || !contractInfo.contractStartDate || !contractInfo.contractEndDate) {
      alert("계약서 정보를 모두 입력해주세요.")
      return
    }

    // 날짜 포맷팅
    const formatDate = (dateStr: string) => {
      if (!dateStr) return ""
      // YYYY-MM-DD 형식 또는 YYYY년 MM월 DD일 형식 처리
      const match = dateStr.match(/(\d{4})[년\-\/]?\s*(\d{1,2})[월\-\/]?\s*(\d{1,2})일?/)
      if (match) {
        return `${match[1]}년 ${parseInt(match[2])}월 ${parseInt(match[3])}일`
      }
      return dateStr
    }

    const contractDate = contractInfo.date ? formatDate(contractInfo.date) : 
      `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월 ${new Date().getDate()}일`
    const startDate = formatDate(contractInfo.contractStartDate)
    const endDate = formatDate(contractInfo.contractEndDate)

    // 계약서 HTML 생성 (제공된 이미지 형식에 정확히 맞춤)
    const contractHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
      margin: 0;
      padding: 0;
      line-height: 1.8;
      font-size: 14px;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm 25mm;
      box-sizing: border-box;
      page-break-after: always;
      position: relative;
    }
    .page:last-child {
      page-break-after: auto;
    }
    .attachment-label {
      position: absolute;
      top: 20mm;
      left: 25mm;
      font-size: 14px;
    }
    .contract-title {
      text-align: center;
      font-size: 30px;
      font-weight: bold;
      margin: 80px auto 40px auto;
      padding: 20px 35px;
      display: block;
      width: fit-content;
      max-width: 80%;
      box-sizing: border-box;
      background: #fff;
      border: none;
      box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.15);
      letter-spacing: 0.3px;
    }
    .contract-date {
      text-align: center;
      margin: 20px 0 60px 0;
      font-size: 16px;
    }
    .signature-section-page1 {
      position: absolute;
      bottom: 30mm;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      width: 100%;
    }
    .signature-box-page1 {
      margin-bottom: 10px;
      font-size: 14px;
    }
    .contract-body {
      margin: 20px 0;
    }
    .preamble {
      margin: 20px 0 30px 0;
      line-height: 1.8;
      text-align: justify;
    }
    .article {
      margin: 25px 0;
    }
    .article-title {
      font-weight: bold;
      font-size: 15px;
      margin: 20px 0 10px 0;
    }
    .article-content {
      margin: 10px 0 10px 0;
      line-height: 1.8;
      text-align: justify;
    }
    .article-content .sub-item {
      margin-left: 20px;
      margin-top: 8px;
    }
    .article-content .sub-item-number {
      margin-left: 0;
      margin-top: 8px;
    }
    .signature-section {
      margin: 50px 0 30px 0;
      text-align: center;
    }
    .signature-date {
      text-align: center;
      margin: 30px 0;
      font-size: 16px;
    }
    .signature-blocks {
      display: flex;
      justify-content: space-around;
      margin-top: 40px;
    }
    .signature-block {
      text-align: left;
      min-width: 200px;
    }
    .signature-label {
      font-weight: bold;
      margin-bottom: 15px;
      font-size: 14px;
    }
    .signature-info {
      margin: 8px 0;
      font-size: 14px;
    }
    p {
      margin: 15px 0;
      line-height: 1.8;
      text-align: justify;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
    }
  </style>
</head>
<body>
  <!-- 1페이지: 표지 -->
  <div class="page">
    <div class="attachment-label">(별첨#1)광고주-대행사</div>
    <div class="contract-title">온라인 광고 대행 계약서</div>
    <div class="contract-date">${contractDate}</div>
    <div class="signature-section-page1">
      <div class="signature-box-page1">${contractInfo.advertiserName ? `(주)${contractInfo.advertiserName}` : "(주)광고주"}</div>
      <div class="signature-box-page1">${contractInfo.agencyName ? `(주)${contractInfo.agencyName}` : "(주)광고대행사"}</div>
    </div>
  </div>

  <!-- 2페이지: 서문 및 제1~4조 시작 -->
  <div class="page">
    <div class="contract-body">
      <div class="preamble">
        주식회사 ${contractInfo.advertiserName || "광고주"} (이하 "갑"이라 함)과 주식회사 ${contractInfo.agencyName || "광고대행사"} (이하 "을"이라 함)은 갑의 온라인 광고 캠페인을 위한 광고물 제작 및 광고 의뢰 업무의 대행(이하 "서비스"라 함)에 있어 상호간의 포괄적인 상호협력 관계를 구축하기 위하여 다음과 같이 본 계약을 체결한다.
      </div>
      
      <div class="article">
        <div class="article-title">제1조 (계약의 목적)</div>
        <div class="article-content">
          본 계약은 갑과 을 간의 사업 제휴에 있어 발생하는 권리, 의무 및 필요한 사항을 정함을 목적으로 한다.
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제2조 (서비스의 정의)</div>
        <div class="article-content">
          본 계약에서 "서비스"라 함은 을이 갑에게 제공하는 제3조에 규정된 범위 내의 서비스를 말한다.
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제3조 (서비스의 범위)</div>
        <div class="article-content">
          <div class="sub-item-number">① 을은 다음 각 호의 서비스를 수행하며, 세부 계획은 갑의 사전 승인을 받아야 한다.</div>
          <div class="sub-item">1. 온라인 광고의 기획</div>
          <div class="sub-item">2. 온라인 광고의 예산편성 및 그 집행</div>
          <div class="sub-item">3. 온라인 광고물의 제작</div>
          <div class="sub-item">4. 온라인 광고 매체선정에 관한 건의 및 섭외</div>
          <div class="sub-item">5. 온라인 프로모션(이벤트, Publicity, 판촉 등) 업무</div>
          <div class="sub-item">6. 온라인 광고활동에 필요한 여론조사 및 자료수집</div>
          <div class="sub-item">7. 기타 온라인 광고 및 판촉에 관련된 제업무</div>
          <div class="sub-item-number" style="margin-top: 15px;">② 본 계약에서 "온라인 광고"라 함은 "온라인 환경 상에서 광고 집행을 위해 진행되는 모든 부분"을 의미한다.</div>
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제4조 (계약 일반)</div>
        <div class="article-content">
          <div class="sub-item-number">① 계약기간</div>
          <div class="sub-item">"서비스"의 유효기간은 ${startDate}부터 ${endDate}까지로 한다. 단,</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 3페이지: 제4조 계속 및 제5조 -->
  <div class="page">
    <div class="contract-body">
      <div class="article">
        <div class="article-content" style="margin-top: 0;">
          <div class="sub-item">계약기간 만료 일(1)개월 전까지 당사자 일방이 상대방에 대하여 서면으로 갱신거절의 의사를 통지하거나 계약내용의 변경을 요청하지 아니하면, 본 계약은 계약만료 익일부터 일(1)년씩 동일 조건으로 자동연장된다.</div>
          <div class="sub-item-number" style="margin-top: 15px;">② "갑"의 독점적 지위</div>
          <div class="sub-item">"갑"의 독점적 지위는 광고진행세부내역에 의한다.</div>
          <div class="sub-item-number" style="margin-top: 15px;">③ "서비스"의 내용</div>
          <div class="sub-item">"서비스"의 구체적인 내용은 "을"의 본계약외 별도의 문서(이하 "광고게재신청서"라 한다)를 통해서 확정하며 "서비스"의 내용이 변경되는 경우에도 "광고게재신청서"를 수정하여 변경ㆍ확정한다.</div>
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제5조 (광고비)</div>
        <div class="article-content">
          <div class="sub-item-number">① 광고비는 매체비, 제작비, 프로모션비, 경품비, 기타 제비용 등으로 구분하며, "을"은 최소한의 저렴한 가격으로 할 수 있도록 의무를 다한다.</div>
          <div class="sub-item-number" style="margin-top: 15px;">② 매체비는 집행된 매체별 광고단가를 기준으로 산정한다. 단, 매체대행수수료는 "을"과 각 매체간의 계약관계에 따라, 집행매체로부터 지급받는 것을 원칙으로 한다.</div>
          <div class="sub-item-number" style="margin-top: 15px;">③ 제작비는 외주비 등을 포함한 "을"의 총비용에 제작대행수수료를 합한 금액으로 한다. 단, 제작대행수수료는 "갑"과 "을"의 상호협의로 정한 금액으로 한다.</div>
          <div class="sub-item-number" style="margin-top: 15px;">④ 프로모션비와 경품비는 "을"의 관련 총비용에 대행수수료를 합한 금액으로 한다. 단, 대행수수료는 "갑"과 "을"의 상호협의로 정한 금액으로 한다.</div>
          <div class="sub-item-number" style="margin-top: 15px;">⑥ 기타 제비용은 "갑"과 "을"의 상호 협의 하에 정하기로 한다.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 4페이지: 제6조, 제7조, 제8조, 제9조, 제10조 시작 -->
  <div class="page">
    <div class="contract-body">
      <div class="article">
        <div class="article-title">제6조(광고비의 청구 및 지급)</div>
        <div class="article-content">
          <div class="sub-item-number">① "을"은 매월 온라인광고 집행내역을 첨부하여 집행월 말일자로 세금계산서를 발행하여 "갑"에게 청구한다.</div>
          <div class="sub-item-number" style="margin-top: 15px;">② "갑"은 "을"의 청구에 세금계산서 발행일 기준 30일 (1개월)이내에 현금으로 광고비를 지급한다.</div>
          <div style="margin-top: 15px; text-decoration: underline;">신용</div>
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제7조(제작물의 귀속 및 책임)</div>
        <div class="article-content">
          <div class="sub-item-number">① "갑"이 비용을 지불 또는 사용을 위해서 인수한 모든 제작물(미완성 제작물 및 "갑"의 제작물)의 저작권은 관련 법령이 허용하는 범위 내에서 "갑"에게 귀속되며, "을"은 "갑"의 제작물을 타사에 제공하여서는 안 된다.</div>
          <div class="sub-item-number" style="margin-top: 15px;">② "을"이 제작한 광고물에 대한 모든 민ㆍ형사상 법적 책임은 "을"이 부담하며, 제3자가 "을"을 상대로 법적 책임을 묻는 경우 "을"은 "을"의 노력과 비용으로 대응하며, 이로 인해 "갑"에게 발생한 손해를 배상할 것을 동의한다.</div>
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제8조 (계약의 양도)</div>
        <div class="article-content">
          "을"은 "갑"의 서면 동의 없이 본 계약상의 권리 및 의무의 전부 또는 일부를 제3자에게 양도, 전양하거나 담보로 제공할 수 없다.
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제9조 (계약의 해지)</div>
        <div class="article-content">
          <div class="sub-item-number">① "갑" 또는 "을"(이하 "해지권자"라 함)은 다음 각 호의 사유가 발생한 경우 상대방(이하 "귀책당사자"라 함)에게 서면으로 통지함으로써 본 계약을 즉시 해지할 수 있다.</div>
          <div class="sub-item">1. "귀책당사자"가 "해지권자"가 10일 이상의 기간을 정하여 이행을 최고하고도 본 계약을 위반한 채무를 이행하지 아니한 경우</div>
          <div class="sub-item">2. "귀책당사자"가 발행한 어음 또는 수표의 지급거절, 파산, 회사정리, 화의, 워크아웃 신청 등이 있는 경우</div>
          <div class="sub-item">3. "귀책당사자"가 "해지권자"의 사전 서면 동의 없이 본 계약상의 권리, 의무 등을 제3자에게 양도한 경우</div>
          <div class="sub-item-number" style="margin-top: 15px;">② 본 계약의 목적 달성이 현저히 불가능하게 되어 양 당사자가 서면으로 합의한 경우 본 계약은 해지된다.</div>
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제10조 (자료제공 및 기밀 유지)</div>
        <div class="article-content">
          <div class="sub-item-number">① "갑" 또는 "을"은 본 계약 체결 및 이행 과정에서 상대방으로부터 취득한 영업비밀, 기술정보 및 자료(이하 "비밀등"이라 함)를 본 계약의 이행 목적으로만 사용하여야 하며, 계약기간 종료 시 모든 "비밀등"을 상대방에게 반환하여야 한다.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 5페이지: 제10조 계속 및 제11~16조 -->
  <div class="page">
    <div class="contract-body">
      <div class="article">
        <div class="article-content" style="margin-top: 0;">
          <div class="sub-item-number">② "갑" 또는 "을"은 상대방으로부터 제공받은 "비밀등"을 계약기간 종료 후에도 상대방의 사전 서면 동의 없이 제3자에게 누설하거나 공개하여서는 안 되며, 누설 또는 외부 유출에 대한 모든 민ㆍ형사상 책임을 부담한다.</div>
          <div class="sub-item-number" style="margin-top: 15px;">③ "갑" 또는 "을"은 자사의 임직원 및 관련자에게 전항과 동일한 의무를 부과하여야 한다.</div>
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제11조 (신의성실의 의무)</div>
        <div class="article-content">
          "갑" 또는 "을"은 본 계약의 목적을 달성하기 위하여 상호 관련 업무에 대하여 신의성실의 원칙에 따라 협력하여야 한다.
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제12조 (손해 배상)</div>
        <div class="article-content">
          본 계약의 해지 또는 위반으로 인하여 상대방에게 손해가 발생한 경우 귀책당사자는 그 손해를 배상할 책임을 진다.
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제13조 (불가항력)</div>
        <div class="article-content">
          "갑" 또는 "을"이 천재지변, 전쟁, 내란, 폭동, 정부의 규제 등 통상적인 사회적 관념상 예측할 수 없는 불가항력적 사유(단, 노동쟁의는 제외)로 인하여 본 계약상의 의무를 이행할 수 없는 경우 그 책임을 면한다.
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제14조 (소송의 합의 관할)</div>
        <div class="article-content">
          본 계약에 관하여 "갑"과 "을" 사이에 분쟁이 발생한 경우 서울중앙지방법원을 전속적 합의관할 법원으로 한다.
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제15조 (효력 및 해석)</div>
        <div class="article-content">
          본 계약의 효력은 계약일로부터 발생하며, 본 계약에 명시되지 않은 사항은 일반 상관례에 따른다.
        </div>
      </div>
      
      <div class="article">
        <div class="article-title">제16조 (예약서의 보완)</div>
        <div class="article-content">
          본 계약서의 세부적인 이행사항에 관하여 내용 보완이 필요한 경우 "갑", "을"은 상호 협의하여 결정한다.
        </div>
      </div>
    </div>
  </div>

  <!-- 6페이지: 제16조 계속 및 서명란 -->
  <div class="page">
    <div class="contract-body">
      <div class="article">
        <div class="article-content" style="margin-top: 0;">
          본 계약의 체결을 증명하기 위하여 본 계약서를 이(2)부 작성, 날인 후 "갑","을"이 각각 일(1)부씩 보관한다.
        </div>
      </div>
      
      <div class="signature-date">${contractDate}</div>
      
      <div class="signature-blocks">
        <div class="signature-block">
          <div class="signature-label">갑</div>
          <div class="signature-info">주식회사 ${contractInfo.advertiserName || "광고주"}</div>
          <div class="signature-info">주소</div>
          <div class="signature-info">대표이사</div>
          <div class="signature-info" style="margin-top: 20px;">(인)</div>
        </div>
        <div class="signature-block">
          <div class="signature-label">을</div>
          <div class="signature-info">주식회사 ${contractInfo.agencyName || "광고대행사"}</div>
          <div class="signature-info">주소</div>
          <div class="signature-info">대표이사</div>
          <div class="signature-info" style="margin-top: 20px;">(인)</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`

    // 파일 형식에 따라 다운로드
    if (documentFormat === "html") {
      const blob = new Blob([contractHTML], { type: "text/html;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `계약서_${contractInfo.advertiserName}_${contractInfo.date || new Date().toISOString().split("T")[0]}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else if (documentFormat === "pdf") {
      // PDF 생성 (html2canvas-pro와 jsPDF 사용)
      try {
        const { default: html2canvas } = await import("html2canvas-pro")
        const { default: jsPDF } = await import("jspdf")
        
        // 임시 div에 HTML 삽입
        const tempDiv = document.createElement("div")
        tempDiv.innerHTML = contractHTML
        tempDiv.style.position = "absolute"
        tempDiv.style.left = "-9999px"
        tempDiv.style.width = "210mm" // A4 너비
        document.body.appendChild(tempDiv)
        
        // 각 .page 요소를 개별적으로 렌더링
        const pageElements = tempDiv.querySelectorAll(".page")
        const pdf = new jsPDF("p", "mm", "a4")
        
        // PDF 여백 설정
        const marginX = 20
        const marginY = 20
        
        for (let i = 0; i < pageElements.length; i++) {
          if (i > 0) {
            pdf.addPage()
          }
          
          const pageElement = pageElements[i] as HTMLElement
          
          // 각 페이지를 개별적으로 캔버스로 렌더링
          const canvas = await html2canvas(pageElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            width: pageElement.offsetWidth || 794, // 210mm in pixels at 96dpi
            height: pageElement.offsetHeight || 1123, // 297mm in pixels at 96dpi
          })
          
          const imgData = canvas.toDataURL("image/png")
          const imgWidth = 210 - (marginX * 2) // 170mm
          const imgHeight = (canvas.height * imgWidth) / canvas.width
          
          // 페이지 높이를 초과하지 않도록 조정
          const maxHeight = 297 - (marginY * 2) // 257mm
          const finalHeight = Math.min(imgHeight, maxHeight)
          const finalWidth = (canvas.width * finalHeight) / canvas.height
          
          pdf.addImage(
            imgData,
            "PNG",
            marginX,
            marginY,
            finalWidth,
            finalHeight
          )
        }
        
        pdf.save(`계약서_${contractInfo.advertiserName}_${contractInfo.date || new Date().toISOString().split("T")[0]}.pdf`)
        
        document.body.removeChild(tempDiv)
      } catch (error) {
        console.error("PDF 생성 실패:", error)
        alert("PDF 생성에 실패했습니다. HTML 형식으로 다운로드합니다.")
        // HTML로 대체 다운로드
        const blob = new Blob([contractHTML], { type: "text/html;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `계약서_${contractInfo.advertiserName}_${contractInfo.date || new Date().toISOString().split("T")[0]}.html`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } else if (documentFormat === "word") {
      // 워드(DOCX) 형식으로 다운로드
      try {
        // HTML을 RTF 형식으로 변환 (워드에서 열 수 있음)
        const rtfContent = convertHTMLToRTF(contractHTML)
        const blob = new Blob([rtfContent], { type: "application/rtf;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `계약서_${contractInfo.advertiserName}_${contractInfo.date || new Date().toISOString().split("T")[0]}.rtf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error("워드 파일 생성 실패:", error)
        alert("워드 파일 생성에 실패했습니다. HTML 형식으로 다운로드합니다.")
        const blob = new Blob([contractHTML], { type: "text/html;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `계약서_${contractInfo.advertiserName}_${contractInfo.date || new Date().toISOString().split("T")[0]}.html`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } else if (documentFormat === "hwp") {
      // 한글(HWP) 형식으로 다운로드 (RTF 형식으로 변환하여 한글에서 열 수 있도록)
      try {
        const rtfContent = convertHTMLToRTF(contractHTML)
        const blob = new Blob([rtfContent], { type: "application/rtf;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `계약서_${contractInfo.advertiserName}_${contractInfo.date || new Date().toISOString().split("T")[0]}.rtf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        alert("RTF 파일로 다운로드되었습니다. 한글과 한글 뷰어에서 열 수 있습니다.")
      } catch (error) {
        console.error("한글 파일 생성 실패:", error)
        alert("한글 파일 생성에 실패했습니다. HTML 형식으로 다운로드합니다.")
        const blob = new Blob([contractHTML], { type: "text/html;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `계약서_${contractInfo.advertiserName}_${contractInfo.date || new Date().toISOString().split("T")[0]}.html`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } else if (documentFormat === "docx") {
      // 구글독스로 내보내기 (HTML을 구글독스로 변환)
      const googleDocsUrl = `https://docs.google.com/document/create?usp=drive_web`
      window.open(googleDocsUrl, "_blank")
      alert("구글독스를 열었습니다. HTML 내용을 복사하여 붙여넣으세요.")
    }
  }

  // 기자단 AI: 견적서 생성
  const handleGenerateQuote = async () => {
    if (!quoteInfo.supplierName || !quoteInfo.recipientName || quoteInfo.items.length === 0) {
      alert("공급자, 수신인 정보와 항목을 모두 입력해주세요.")
      return
    }

    const total = quoteInfo.items.reduce((sum, item) => sum + item.quantity * item.price, 0)
    const vat = Math.floor(total * 0.1) // 부가세 10%
    const totalWithVat = total + vat

    // 견적서 HTML 생성 (제공된 이미지 형식에 맞춤)
    const quoteHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
      margin: 0;
      padding: 60px 80px;
      line-height: 1.8;
    }
    .quote-title {
      text-align: center;
      font-size: 28px;
      font-weight: bold;
      margin: 40px 0 40px 0;
    }
    .quote-header {
      display: flex;
      justify-content: space-between;
      margin: 30px 0 40px 0;
      padding: 0 20px;
    }
    .quote-no {
      text-align: left;
      font-size: 14px;
    }
    .quote-date {
      text-align: right;
      font-size: 14px;
    }
    .quote-intro {
      text-align: center;
      margin: 30px 0 40px 0;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
    }
    table, th, td {
      border: 1px solid #000;
    }
    th, td {
      padding: 15px 12px;
      text-align: center;
      font-size: 14px;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .info-table {
      margin: 40px 0;
    }
    .items-table {
      margin: 40px 0;
    }
    .total-row {
      font-weight: bold;
      background-color: #f9f9f9;
    }
    .text-left {
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="quote-title">견적서</div>
  
  <div class="quote-header">
    <div class="quote-no">
      <div>NO.</div>
      <div>${quoteInfo.quoteNo || ""}</div>
    </div>
    <div class="quote-date">
      <div>${quoteInfo.date || new Date().toLocaleDateString('ko-KR')}</div>
    </div>
  </div>
  
  <div class="quote-intro">아래와 같이 견적드립니다.</div>
  
  <table class="info-table">
    <tr>
      <th rowspan="2">공급자</th>
      <th>상호</th>
      <th rowspan="2">대표</th>
      <th rowspan="2">사업자번호</th>
    </tr>
    <tr>
      <td>${quoteInfo.supplierName}</td>
    </tr>
    <tr>
      <td></td>
      <td>소재지: ${quoteInfo.supplierAddress || ""}</td>
      <td>${quoteInfo.supplierCEO || ""}</td>
      <td>${quoteInfo.supplierBusinessNo || ""}</td>
    </tr>
    <tr>
      <td></td>
      <td>전화번호: ${quoteInfo.supplierPhone || ""}</td>
      <td></td>
      <td></td>
    </tr>
  </table>
  
  <table class="info-table">
    <tr>
      <th rowspan="2">수신인</th>
      <th>상호</th>
      <th rowspan="2">대표</th>
      <th rowspan="2"></th>
    </tr>
    <tr>
      <td>${quoteInfo.recipientName}</td>
    </tr>
    <tr>
      <td></td>
      <td>소재지: ${quoteInfo.recipientAddress || ""}</td>
      <td>${quoteInfo.recipientCEO || ""}</td>
      <td></td>
    </tr>
    <tr>
      <td></td>
      <td>전화번호: ${quoteInfo.recipientPhone || ""}</td>
      <td></td>
      <td></td>
    </tr>
  </table>
  
  <table class="items-table">
    <tr>
      <th rowspan="2" colspan="2">합계금액</th>
      <th>원整</th>
      <th rowspan="2">#</th>
      <th rowspan="2">(부가세포함)</th>
    </tr>
    <tr>
      <th>금액</th>
    </tr>
    <tr>
      <th>품명</th>
      <th>품목</th>
      <th>금액</th>
      <th>수량</th>
      <th>합계</th>
      <th>비고</th>
    </tr>
    ${quoteInfo.items.map((item, index) => `
    <tr>
      <td>${item.name || ""}</td>
      <td>${item.category || ""}</td>
      <td>${item.price.toLocaleString()}</td>
      <td>${item.quantity}</td>
      <td>${(item.price * item.quantity).toLocaleString()}</td>
      <td>${item.remarks || ""}</td>
    </tr>
    `).join("")}
    <tr class="total-row">
      <td colspan="4"></td>
      <td>합계</td>
      <td>₩ ${totalWithVat.toLocaleString()}</td>
    </tr>
  </table>
</body>
</html>`

    // 파일 형식에 따라 다운로드
    if (documentFormat === "html") {
      const blob = new Blob([quoteHTML], { type: "text/html;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `견적서_${quoteInfo.supplierName}_${quoteInfo.date || new Date().toISOString().split("T")[0]}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else if (documentFormat === "pdf") {
      // PDF 생성 (html2canvas-pro와 jsPDF 사용)
      try {
        const { default: html2canvas } = await import("html2canvas-pro")
        const { default: jsPDF } = await import("jspdf")
        
        // 임시 div에 HTML 삽입
        const tempDiv = document.createElement("div")
        tempDiv.innerHTML = quoteHTML
        tempDiv.style.position = "absolute"
        tempDiv.style.left = "-9999px"
        tempDiv.style.width = "210mm" // A4 너비
        document.body.appendChild(tempDiv)
        
        const canvas = await html2canvas(tempDiv, {
          scale: 2,
          useCORS: true,
          logging: false,
        })
        
        const imgData = canvas.toDataURL("image/png")
        const pdf = new jsPDF("p", "mm", "a4")
        
        // PDF 여백 설정 (좌우 20mm, 상하 20mm)
        const marginX = 20
        const marginY = 20
        const pageWidth = 210
        const pageHeight = 297
        const contentWidth = pageWidth - (marginX * 2) // 170mm
        const contentHeight = pageHeight - (marginY * 2) // 257mm
        
        // 페이지 경계 여백 설정 (잘릴 때 위아래 여백)
        const pageBreakMargin = 15 // 페이지 경계에서 위아래 여백 (mm)
        const effectiveContentHeight = contentHeight - (pageBreakMargin * 2) // 실제 콘텐츠 높이
        
        // 이미지 크기 계산 (여백을 고려)
        const imgWidth = contentWidth
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        const totalPages = Math.ceil(imgHeight / effectiveContentHeight)
        
        // 각 페이지에 이미지의 해당 부분 추가
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) {
            pdf.addPage()
          }
          
          // 현재 페이지에 표시할 이미지의 Y 위치 계산
          // 페이지 경계 여백을 고려하여 위치 조정
          const yOffset = -(page * effectiveContentHeight) + pageBreakMargin
          
          pdf.addImage(
            imgData,
            "PNG",
            marginX,
            marginY + yOffset,
            imgWidth,
            imgHeight
          )
        }
        
        pdf.save(`견적서_${quoteInfo.supplierName}_${quoteInfo.date || new Date().toISOString().split("T")[0]}.pdf`)
        
        document.body.removeChild(tempDiv)
      } catch (error) {
        console.error("PDF 생성 실패:", error)
        alert("PDF 생성에 실패했습니다. HTML 형식으로 다운로드합니다.")
        // HTML로 대체 다운로드
        const blob = new Blob([quoteHTML], { type: "text/html;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `견적서_${quoteInfo.supplierName}_${quoteInfo.date || new Date().toISOString().split("T")[0]}.html`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } else if (documentFormat === "word") {
      // 워드(DOCX) 형식으로 다운로드
      try {
        // HTML을 RTF 형식으로 변환 (워드에서 열 수 있음)
        const rtfContent = convertHTMLToRTF(quoteHTML)
        const blob = new Blob([rtfContent], { type: "application/rtf;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `견적서_${quoteInfo.supplierName}_${quoteInfo.date || new Date().toISOString().split("T")[0]}.rtf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error("워드 파일 생성 실패:", error)
        alert("워드 파일 생성에 실패했습니다. HTML 형식으로 다운로드합니다.")
        const blob = new Blob([quoteHTML], { type: "text/html;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `견적서_${quoteInfo.supplierName}_${quoteInfo.date || new Date().toISOString().split("T")[0]}.html`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } else if (documentFormat === "hwp") {
      // 한글(HWP) 형식으로 다운로드 (RTF 형식으로 변환하여 한글에서 열 수 있도록)
      try {
        const rtfContent = convertHTMLToRTF(quoteHTML)
        const blob = new Blob([rtfContent], { type: "application/rtf;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `견적서_${quoteInfo.supplierName}_${quoteInfo.date || new Date().toISOString().split("T")[0]}.rtf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        alert("RTF 파일로 다운로드되었습니다. 한글과 한글 뷰어에서 열 수 있습니다.")
      } catch (error) {
        console.error("한글 파일 생성 실패:", error)
        alert("한글 파일 생성에 실패했습니다. HTML 형식으로 다운로드합니다.")
        const blob = new Blob([quoteHTML], { type: "text/html;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `견적서_${quoteInfo.supplierName}_${quoteInfo.date || new Date().toISOString().split("T")[0]}.html`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } else if (documentFormat === "docx") {
      // 구글독스로 내보내기
      const googleDocsUrl = `https://docs.google.com/document/create?usp=drive_web`
      window.open(googleDocsUrl, "_blank")
      alert("구글독스를 열었습니다. HTML 내용을 복사하여 붙여넣으세요.")
    }
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
            <div className={`${generatedContent ? "col-span-3" : "col-span-4"} transition-all duration-500 space-y-6`}>
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
                      <div className="font-semibold">이미지 선택</div>
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
                        ? "업로드한 이미지를 선택하여 콘텐츠에 사용합니다."
                        : "이미지 없이 텍스트만으로 콘텐츠를 생성합니다."}
                    </p>
                  </div>

                  {/* 이미지 선택 모드: 업로드 영역 및 옵션 */}
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
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">이미지 옵션</h3>
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
            <div className={`${generatedContent ? "col-span-9" : "col-span-8"} transition-all duration-500`}>
              <Card className="border-0 shadow-xl bg-white h-full sticky top-8">
                <CardContent className="p-6 h-full flex flex-col">
                  {isGenerating && !streamingContent ? (
                    <div className="flex-1 overflow-y-auto">
                      <div className="flex flex-col items-center justify-center min-h-[600px] p-8 bg-gradient-to-b from-slate-50 to-white">
                        {/* 상단 애니메이션 영역 - 모래시계 */}
                        <div className="relative w-full max-w-md mb-8">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 opacity-60"></div>
                          </div>
                          <div className="relative flex items-center justify-center">
                            <Hourglass className="w-20 h-20 text-blue-600 animate-spin" style={{ animationDuration: '2s' }} />
                          </div>
                        </div>

                        {/* 진행률 바 */}
                        <div className="w-full max-w-md mb-8">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-slate-700">진행률</span>
                            <span className="text-sm font-bold text-blue-600">{generationProgress}%</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-500 ease-out"
                              style={{ width: `${generationProgress}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* 현재 단계 메시지 */}
                        <div className="text-center mb-10">
                          <div className="flex items-center justify-center gap-2 mb-4">
                            <Zap className="w-6 h-6 text-yellow-500" />
                            <h3 className="text-2xl font-bold text-slate-900">
                              {generationStep === "keyword" && "키워드 분석"}
                              {generationStep === "top-exposure" && "상위노출 작업"}
                              {generationStep === "writing" && "AI 글 작성"}
                              {generationStep === "seo" && "SEO 최적화"}
                              {generationStep === "final" && "최종 검수"}
                            </h3>
                          </div>
                          <p className="text-slate-600 text-base leading-relaxed">
                            {generationStep === "keyword" && "입력하신 키워드의 검색량과 경쟁도를 분석 중입니다"}
                            {generationStep === "top-exposure" && "상위 글들의 공통점을 분석하여 상위노출 분석 진행중입니다"}
                            {generationStep === "writing" && "마케팅 전문 AI가 본문을 작성 중입니다"}
                            {generationStep === "seo" && "제목, 소제목, 키워드 배치를 최적화 중입니다"}
                            {generationStep === "final" && "맞춤법과 문맥을 최종 점검 중입니다"}
                          </p>
                        </div>

                        {/* 단계별 아이콘 - 5단계 */}
                        <div className="w-full max-w-2xl mb-8">
                          <div className="flex items-center justify-between px-4">
                            {/* 키워드 */}
                            <div className="flex flex-col items-center">
                              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                                generationStep === "keyword" 
                                  ? "bg-blue-500 text-white ring-4 ring-blue-200 shadow-lg scale-110" 
                                  : generationProgress >= 20
                                  ? "bg-blue-100 text-blue-600"
                                  : "bg-slate-100 text-slate-400"
                              }`}>
                                <Search className="w-7 h-7" />
                              </div>
                              <span className="text-xs mt-3 font-medium text-slate-700">키워드</span>
                            </div>

                            {/* 상위노출 */}
                            <div className="flex flex-col items-center">
                              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                                generationStep === "top-exposure" 
                                  ? "bg-blue-500 text-white ring-4 ring-blue-200 shadow-lg scale-110" 
                                  : generationProgress >= 40
                                  ? "bg-blue-100 text-blue-600"
                                  : "bg-slate-100 text-slate-400"
                              }`}>
                                <TrendingUp className="w-7 h-7" />
                              </div>
                              <span className="text-xs mt-3 font-medium text-slate-700">상위노출</span>
                            </div>

                            {/* AI */}
                            <div className="flex flex-col items-center">
                              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                                generationStep === "writing" 
                                  ? "bg-blue-500 text-white ring-4 ring-blue-200 shadow-lg scale-110" 
                                  : generationProgress >= 60
                                  ? "bg-blue-100 text-blue-600"
                                  : "bg-slate-100 text-slate-400"
                              }`}>
                                <Brain className="w-7 h-7" />
                              </div>
                              <span className="text-xs mt-3 font-medium text-slate-700">AI</span>
                            </div>

                            {/* SEO */}
                            <div className="flex flex-col items-center">
                              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                                generationStep === "seo" 
                                  ? "bg-blue-500 text-white ring-4 ring-blue-200 shadow-lg scale-110" 
                                  : generationProgress >= 80
                                  ? "bg-blue-100 text-blue-600"
                                  : "bg-slate-100 text-slate-400"
                              }`}>
                                <BarChart3 className="w-7 h-7" />
                              </div>
                              <span className="text-xs mt-3 font-medium text-slate-700">SEO</span>
                            </div>

                            {/* 최종 */}
                            <div className="flex flex-col items-center">
                              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                                generationStep === "final" 
                                  ? "bg-blue-500 text-white ring-4 ring-blue-200 shadow-lg scale-110" 
                                  : generationProgress >= 100
                                  ? "bg-blue-100 text-blue-600"
                                  : "bg-slate-100 text-slate-400"
                              }`}>
                                <CheckCircle2 className="w-7 h-7" />
                              </div>
                              <span className="text-xs mt-3 font-medium text-slate-700">최종</span>
                            </div>
                          </div>
                        </div>

                        {/* 하단 안내 메시지 */}
                        <div className="mt-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm max-w-md">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-500" />
                            <p className="text-sm text-slate-700 font-medium">
                              상위노출과 전환율을 동시에 잡는 전문 블로그 글을 제작 중입니다
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : isGenerating && streamingContent ? (
                    <div className="flex-1 overflow-y-auto flex flex-col">
                      {/* 단계별 진행 UI - 상단에 고정 */}
                      <div className="mb-6 pb-6 border-b border-slate-200 bg-white sticky top-0 z-10">
                        {/* 프로그레스 바 */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-600">
                              {generationStep === "writing" && "AI 글 작성 중..."}
                              {generationStep === "seo" && "SEO 최적화 중..."}
                              {generationStep === "final" && "최종 검수 중..."}
                            </span>
                            <span className="text-sm font-semibold text-blue-600">{generationProgress}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-500 ease-out"
                              style={{ width: `${generationProgress}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* 현재 단계 메시지 */}
                        <div className="text-center mb-4">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-yellow-500" />
                            <h3 className="text-lg font-bold text-slate-900">
                              {generationStep === "writing" && "AI 글 작성"}
                              {generationStep === "seo" && "SEO 최적화"}
                              {generationStep === "final" && "최종 검수"}
                            </h3>
                          </div>
                          <p className="text-slate-600 text-xs">
                            {generationStep === "writing" && "마케팅 전문 AI가 본문을 작성 중입니다"}
                            {generationStep === "seo" && "제목, 소제목, 키워드 배치를 최적화 중입니다"}
                            {generationStep === "final" && "맞춤법과 문맥을 최종 점검 중입니다"}
                          </p>
                        </div>

                        {/* 단계별 아이콘 - 5단계 */}
                        <div className="w-full max-w-xl mx-auto">
                          <div className="flex items-center justify-between px-2">
                            {/* 키워드 */}
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                                <Search className="w-4 h-4" />
                              </div>
                              <span className="text-xs mt-1 font-medium text-slate-700">키워드</span>
                            </div>

                            {/* 상위노출 */}
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                                <TrendingUp className="w-4 h-4" />
                              </div>
                              <span className="text-xs mt-1 font-medium text-slate-700">상위노출</span>
                            </div>

                            {/* AI */}
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                                generationStep === "writing" 
                                  ? "bg-blue-500 text-white ring-2 ring-blue-200 shadow-md scale-110" 
                                  : "bg-blue-100 text-blue-600"
                              }`}>
                                <Brain className="w-4 h-4" />
                              </div>
                              <span className="text-xs mt-1 font-medium text-slate-700">AI</span>
                            </div>

                            {/* SEO */}
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                                generationStep === "seo" 
                                  ? "bg-blue-500 text-white ring-2 ring-blue-200 shadow-md scale-110" 
                                  : generationProgress >= 80
                                  ? "bg-blue-100 text-blue-600"
                                  : "bg-slate-100 text-slate-400"
                              }`}>
                                <BarChart3 className="w-4 h-4" />
                              </div>
                              <span className="text-xs mt-1 font-medium text-slate-700">SEO</span>
                            </div>

                            {/* 최종 */}
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                                generationStep === "final" 
                                  ? "bg-blue-500 text-white ring-2 ring-blue-200 shadow-md scale-110" 
                                  : "bg-slate-100 text-slate-400"
                              }`}>
                                <CheckCircle2 className="w-4 h-4" />
                              </div>
                              <span className="text-xs mt-1 font-medium text-slate-700">최종</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 타이핑 애니메이션 콘텐츠 */}
                      <div className="flex-1 overflow-y-auto">
                        <div className="prose prose-slate max-w-none">
                          <div className="text-slate-700 leading-relaxed">
                            {parseMarkdown(streamingContent, generatedImages, (index) => regenerateImageAtIndex(index, streamingContent || generatedContent || ""), handleImageUploadAtIndex, regeneratingImageIndex)}
                            <span className="inline-block w-2 h-5 bg-indigo-600 ml-1 animate-pulse" />
                          </div>
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleResetBlogAI}
                            className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            초기화
                          </Button>
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
    <>
      {/* 키워드 분석 탭 렌더링 */}
      {activeTab === "keyword-analysis" && (
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
                      onClick={() => setSelectedCategories([])}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border-2 ${
                        selectedCategories.length === 0
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
                      onClick={() => handleCategoryToggle("세부키워드")}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border-2 ${
                        selectedCategories.includes("세부키워드")
                          ? "bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300 text-blue-700 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-blue-600">세부키워드</span>
                        <div className="flex items-center gap-2">
                          {selectedCategories.includes("세부키워드") && (
                            <span className="text-blue-600 text-xs">✓</span>
                          )}
                          <Badge className="bg-blue-100 text-blue-700">{categoryCounts.세부키워드}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">1,000 미만</p>
                    </button>
                    <button
                      onClick={() => handleCategoryToggle("중형키워드")}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border-2 ${
                        selectedCategories.includes("중형키워드")
                          ? "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300 text-amber-700 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-amber-600">중형키워드</span>
                        <div className="flex items-center gap-2">
                          {selectedCategories.includes("중형키워드") && (
                            <span className="text-amber-600 text-xs">✓</span>
                          )}
                          <Badge className="bg-amber-100 text-amber-700">{categoryCounts.중형키워드}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">1,000 ~ 5,000</p>
                    </button>
                    <button
                      onClick={() => handleCategoryToggle("대형키워드")}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border-2 ${
                        selectedCategories.includes("대형키워드")
                          ? "bg-gradient-to-r from-rose-50 to-pink-50 border-rose-300 text-rose-700 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-rose-600">대형키워드</span>
                        <div className="flex items-center gap-2">
                          {selectedCategories.includes("대형키워드") && (
                            <span className="text-rose-600 text-xs">✓</span>
                          )}
                          <Badge className="bg-rose-100 text-rose-700">{categoryCounts.대형키워드}</Badge>
                        </div>
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
                              sortOrder !== "none" ? "bg-indigo-50 border-indigo-300 text-indigo-700" : ""
                            }`}
                            onClick={handleSortByVolume}
                          >
                            {sortOrder === "none" ? "검색량 정렬" : sortOrder === "desc" ? "검색량 높은 순" : "검색량 낮은 순"}
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

      {/* AI 생성 선택 다이얼로그 */}
      <Dialog open={aiGenerateDialogOpen} onOpenChange={setAiGenerateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              AI 생성 타입 선택
            </DialogTitle>
            <DialogDescription className="text-base font-semibold text-slate-700 mt-2">
              키워드: <span className="font-bold text-indigo-600">{selectedKeywordForAI}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-6 space-y-3">
            <button
              onClick={() => handleAIGenerateConfirm("blog")}
              className="w-full text-left px-6 py-4 rounded-xl border-2 border-indigo-200 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-bold text-blue-700">블로그 AI</div>
                    <div className="text-xs text-slate-600 mt-1">SEO 최적화된 블로그 글 생성</div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => handleAIGenerateConfirm("experience")}
              className="w-full text-left px-6 py-4 rounded-xl border-2 border-pink-200 bg-gradient-to-r from-pink-50 to-rose-50 hover:from-pink-100 hover:to-rose-100 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-pink-600" />
                  <div>
                    <div className="font-bold text-pink-700">체험단 AI</div>
                    <div className="text-xs text-slate-600 mt-1">체험단/기자단 가이드 생성</div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-pink-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => handleAIGenerateConfirm("reporter")}
              className="w-full text-left px-6 py-4 rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PenTool className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="font-bold text-purple-700">기자단 AI</div>
                    <div className="text-xs text-slate-600 mt-1">기자단 원고 생성</div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
        </div>
      )}

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
                <div className={`${generatedGuide || generatedRecruitment ? "col-span-3" : "col-span-4"} transition-all duration-500 space-y-6`}>
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
                <div className={`${generatedGuide || generatedRecruitment ? "col-span-9" : "col-span-8"} transition-all duration-500`}>
                  <Card className="border-0 shadow-xl bg-white h-full sticky top-8">
                    <CardContent className="p-6 h-full flex flex-col">
                      {generatedGuide ? (
                        <div className="flex-1 overflow-y-auto">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-semibold text-slate-900">상위노출 가이드</h3>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  navigator.clipboard.writeText(generatedGuide)
                                  alert("가이드가 클립보드에 복사되었습니다.")
                                }}
                                size="sm"
                                variant="outline"
                                className="border-slate-300 hover:bg-slate-50"
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                복사
                              </Button>
                              <Button
                                onClick={handleDownloadGuide}
                                size="sm"
                                className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                다운로드
                              </Button>
                            </div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                            <pre className="whitespace-pre-wrap text-slate-700 leading-relaxed font-sans text-sm">
{generatedGuide}
                            </pre>
                          </div>
                          {generatedRecruitment && (
                            <div className="mt-8 pt-8 border-t border-slate-200">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-slate-900">체험단 구인글</h3>
                                <Button
                                  onClick={() => {
                                    navigator.clipboard.writeText(generatedRecruitment)
                                    alert("구인글이 클립보드에 복사되었습니다.")
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-300 hover:bg-slate-50"
                                >
                                  <Copy className="w-4 h-4 mr-2" />
                                  복사
                                </Button>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                                <pre className="whitespace-pre-wrap text-slate-700 leading-relaxed font-sans text-sm">
{generatedRecruitment}
                                </pre>
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
                <div className={`${generatedDraft ? "col-span-3" : "col-span-4"} transition-all duration-500 space-y-6`}>
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
                            상위노출 로직 적용
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

                  {/* Step 3: 이미지 생성 옵션 */}
                  {requiredMorphemes.length > 0 && (
                    <Card className="border-0 shadow-xl bg-white">
                      <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-orange-600 mb-4">
                          Step 3. 이미지 생성 옵션
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
                            <div className="text-xs mt-1 text-slate-500">원고에 자동 삽입</div>
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
                            <div className="text-xs mt-1 text-slate-500">업로드한 이미지 사용</div>
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
                            <div className="text-xs mt-1 text-slate-500">텍스트만 생성</div>
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

                  {/* Step 4: 원고 생성 */}
                  {requiredMorphemes.length > 0 && (
                    <Card className="border-0 shadow-xl bg-white">
                      <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-orange-600 mb-4">
                          Step 4. 원고 생성
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
                        {reporterImageMode === "generate" && (
                          <p className="text-xs text-slate-500 mt-2 text-center">
                            원고 생성 시 이미지가 자동으로 삽입됩니다.
                          </p>
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
                  <div className="space-y-6">
                    {/* 파일 형식 선택 */}
                    <Card className="border-0 shadow-xl bg-white">
                      <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-orange-600 mb-4">파일 형식 선택</h2>
                        <div className="grid grid-cols-5 gap-3">
                          <button
                            onClick={() => setDocumentFormat("pdf")}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              documentFormat === "pdf"
                                ? "border-orange-500 bg-orange-50 text-orange-700"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <FileText className="w-5 h-5 mx-auto mb-1" />
                            <div className="text-sm font-semibold">PDF</div>
                          </button>
                          <button
                            onClick={() => setDocumentFormat("html")}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              documentFormat === "html"
                                ? "border-orange-500 bg-orange-50 text-orange-700"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <FileText className="w-5 h-5 mx-auto mb-1" />
                            <div className="text-sm font-semibold">HTML</div>
                          </button>
                          <button
                            onClick={() => setDocumentFormat("word")}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              documentFormat === "word"
                                ? "border-orange-500 bg-orange-50 text-orange-700"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <FileText className="w-5 h-5 mx-auto mb-1" />
                            <div className="text-sm font-semibold">워드</div>
                          </button>
                          <button
                            onClick={() => setDocumentFormat("docx")}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              documentFormat === "docx"
                                ? "border-orange-500 bg-orange-50 text-orange-700"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <FileText className="w-5 h-5 mx-auto mb-1" />
                            <div className="text-sm font-semibold">구글독스</div>
                          </button>
                        </div>
                      </CardContent>
                    </Card>

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
                            <div className="text-sm font-semibold text-slate-700">광고주 (갑)</div>
                            <Input
                              value={contractInfo.advertiserName}
                              onChange={(e) => setContractInfo({ ...contractInfo, advertiserName: e.target.value })}
                              placeholder="광고주 회사명"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              value={contractInfo.advertiserAddress}
                              onChange={(e) => setContractInfo({ ...contractInfo, advertiserAddress: e.target.value })}
                              placeholder="광고주 주소"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              value={contractInfo.advertiserCEO}
                              onChange={(e) => setContractInfo({ ...contractInfo, advertiserCEO: e.target.value })}
                              placeholder="광고주 대표이사"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <div className="text-sm font-semibold text-slate-700 mt-3">광고대행사 (을)</div>
                            <Input
                              value={contractInfo.agencyName}
                              onChange={(e) => setContractInfo({ ...contractInfo, agencyName: e.target.value })}
                              placeholder="광고대행사 회사명"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              value={contractInfo.agencyAddress}
                              onChange={(e) => setContractInfo({ ...contractInfo, agencyAddress: e.target.value })}
                              placeholder="광고대행사 주소"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              value={contractInfo.agencyCEO}
                              onChange={(e) => setContractInfo({ ...contractInfo, agencyCEO: e.target.value })}
                              placeholder="광고대행사 대표이사"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              value={contractInfo.contractStartDate}
                              onChange={(e) => setContractInfo({ ...contractInfo, contractStartDate: e.target.value })}
                              placeholder="계약 시작일 (YYYY-MM-DD)"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              value={contractInfo.contractEndDate}
                              onChange={(e) => setContractInfo({ ...contractInfo, contractEndDate: e.target.value })}
                              placeholder="계약 종료일 (YYYY-MM-DD)"
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
                              value={quoteInfo.quoteNo}
                              onChange={(e) => setQuoteInfo({ ...quoteInfo, quoteNo: e.target.value })}
                              placeholder="견적서 번호 (NO.)"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              type="date"
                              value={quoteInfo.date}
                              onChange={(e) => setQuoteInfo({ ...quoteInfo, date: e.target.value })}
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <div className="text-sm font-semibold text-slate-700">공급자</div>
                            <Input
                              value={quoteInfo.supplierName}
                              onChange={(e) => setQuoteInfo({ ...quoteInfo, supplierName: e.target.value })}
                              placeholder="공급자 상호"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              value={quoteInfo.supplierAddress}
                              onChange={(e) => setQuoteInfo({ ...quoteInfo, supplierAddress: e.target.value })}
                              placeholder="공급자 소재지"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              value={quoteInfo.supplierPhone}
                              onChange={(e) => setQuoteInfo({ ...quoteInfo, supplierPhone: e.target.value })}
                              placeholder="공급자 전화번호"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              value={quoteInfo.supplierCEO}
                              onChange={(e) => setQuoteInfo({ ...quoteInfo, supplierCEO: e.target.value })}
                              placeholder="공급자 대표"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              value={quoteInfo.supplierBusinessNo}
                              onChange={(e) => setQuoteInfo({ ...quoteInfo, supplierBusinessNo: e.target.value })}
                              placeholder="공급자 사업자번호"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <div className="text-sm font-semibold text-slate-700 mt-3">수신인</div>
                            <Input
                              value={quoteInfo.recipientName}
                              onChange={(e) => setQuoteInfo({ ...quoteInfo, recipientName: e.target.value })}
                              placeholder="수신인 상호"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              value={quoteInfo.recipientAddress}
                              onChange={(e) => setQuoteInfo({ ...quoteInfo, recipientAddress: e.target.value })}
                              placeholder="수신인 소재지"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              value={quoteInfo.recipientPhone}
                              onChange={(e) => setQuoteInfo({ ...quoteInfo, recipientPhone: e.target.value })}
                              placeholder="수신인 전화번호"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Input
                              value={quoteInfo.recipientCEO}
                              onChange={(e) => setQuoteInfo({ ...quoteInfo, recipientCEO: e.target.value })}
                              placeholder="수신인 대표"
                              className="bg-slate-50 border-slate-200 text-slate-900"
                            />
                            <Button
                              onClick={() => setQuoteInfo({ ...quoteInfo, items: [...quoteInfo.items, { name: "", category: "", quantity: 1, price: 0, remarks: "" }] })}
                              className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                              size="sm"
                            >
                              항목 추가
                            </Button>
                            {quoteInfo.items.map((item, index) => (
                              <div key={index} className="grid grid-cols-2 gap-2">
                                <Input
                                  value={item.name}
                                  onChange={(e) => {
                                    const newItems = [...quoteInfo.items]
                                    newItems[index].name = e.target.value
                                    setQuoteInfo({ ...quoteInfo, items: newItems })
                                  }}
                                  placeholder="품명"
                                  className="bg-slate-50 border-slate-200 text-slate-900"
                                />
                                <Input
                                  value={item.category}
                                  onChange={(e) => {
                                    const newItems = [...quoteInfo.items]
                                    newItems[index].category = e.target.value
                                    setQuoteInfo({ ...quoteInfo, items: newItems })
                                  }}
                                  placeholder="품목"
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
                                  placeholder="금액"
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
                                  value={item.remarks}
                                  onChange={(e) => {
                                    const newItems = [...quoteInfo.items]
                                    newItems[index].remarks = e.target.value
                                    setQuoteInfo({ ...quoteInfo, items: newItems })
                                  }}
                                  placeholder="비고"
                                  className="bg-slate-50 border-slate-200 text-slate-900 col-span-2"
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
                </div>

                {/* 오른쪽: 생성된 결과 */}
                <div className={`${generatedDraft ? "col-span-9" : "col-span-8"} transition-all duration-500`}>
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
                              {parseMarkdown(generatedDraft, reporterImages, (index) => regenerateReporterImageAtIndex(index, generatedDraft), handleReporterImageUploadAtIndex, regeneratingImageIndex)}
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
    </>
  )
}

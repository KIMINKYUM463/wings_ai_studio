"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Newspaper, Loader2, Home, ExternalLink, Calendar, Sparkles, Brain } from "lucide-react"
import { useRouter } from "next/navigation"

interface NewsItem {
  title: string
  description: string
  link: string
  pubDate: string
  originallink?: string
}

interface NewsResponse {
  success: boolean
  news: NewsItem[]
  count: number
  total: number
  source: string
}

const CATEGORIES = [
  { value: "종합", label: "종합" },
  { value: "정치", label: "정치" },
  { value: "경제", label: "경제" },
  { value: "사회", label: "사회" },
  { value: "IT/과학", label: "IT/과학" },
  { value: "연예", label: "연예" },
]

export default function RealtimeNewsPage() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState("종합")
  const [isLoading, setIsLoading] = useState(false)
  const [newsData, setNewsData] = useState<NewsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentDateTime, setCurrentDateTime] = useState("")

  // 현재 날짜/시간 업데이트
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, "0")
      const day = String(now.getDate()).padStart(2, "0")
      const hours = String(now.getHours()).padStart(2, "0")
      const minutes = String(now.getMinutes()).padStart(2, "0")
      const seconds = String(now.getSeconds()).padStart(2, "0")
      const ampm = now.getHours() >= 12 ? "오후" : "오전"
      const displayHours = now.getHours() > 12 ? now.getHours() - 12 : now.getHours()
      
      setCurrentDateTime(`${year}. ${month}. ${day}. ${ampm} ${displayHours}:${minutes}:${seconds}`)
    }

    updateDateTime()
    const interval = setInterval(updateDateTime, 1000)

    return () => clearInterval(interval)
  }, [])

  // 페이지 로드 시 자동으로 뉴스 가져오기
  useEffect(() => {
    handleFetchNews()
  }, [selectedCategory])

  const handleFetchNews = async () => {
    setIsLoading(true)
    setError(null)
    setNewsData(null)

    try {
      // 네이버 뉴스 API 호출
      const response = await fetch("/api/crawl-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: selectedCategory === "종합" ? "뉴스" : selectedCategory,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "뉴스 데이터를 불러오지 못했습니다.")
      }

      if (data.success) {
        setNewsData(data)
      } else {
        throw new Error(data.error || "뉴스 데이터를 불러오지 못했습니다.")
      }
    } catch (err) {
      console.error("뉴스 수집 실패:", err)
      setError(err instanceof Error ? err.message : "뉴스 데이터를 불러오지 못했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push("/youmaker")}
            className="mb-4"
          >
            ← 메인으로
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/youmaker")}
            className="mb-4 bg-gradient-to-r from-orange-50 to-red-50 border-orange-300 text-orange-700 hover:from-orange-100 hover:to-red-100"
          >
            <Home className="w-4 h-4 mr-2" />
            홈으로
          </Button>
        </div>

        <div className="space-y-6">
          {/* 헤더 */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
            <CardHeader>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-3">
                <Newspaper className="w-8 h-8 text-teal-500" />
                실시간 뉴스 트렌드 (네이버 뉴스)
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2 font-medium">
                주요 네이버 뉴스를 한눈에 확인하세요.
              </p>
            </CardHeader>
            <CardContent>
              {/* 카테고리 버튼 */}
              <div className="flex flex-wrap gap-3">
                {CATEGORIES.map((category) => (
                  <Button
                    key={category.value}
                    onClick={() => setSelectedCategory(category.value)}
                    variant="outline"
                    className={
                      selectedCategory === category.value
                        ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-white border-teal-500 hover:from-teal-600 hover:to-cyan-600 font-semibold shadow-md"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }
                  >
                    {category.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 로딩 중 */}
          {isLoading && (
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 overflow-hidden">
              <CardContent className="py-16 text-center relative">
                {/* AI 수집 애니메이션 배경 */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-teal-400/20 rounded-full blur-3xl animate-pulse"></div>
                  <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-cyan-400/20 rounded-full blur-3xl animate-pulse delay-300"></div>
                  <div className="absolute bottom-1/4 left-1/2 w-36 h-36 bg-blue-400/20 rounded-full blur-3xl animate-pulse delay-700"></div>
                </div>
                
                {/* AI 아이콘 애니메이션 */}
                <div className="relative z-10">
                  <div className="relative inline-block mb-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                    <div className="relative bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-500 p-6 rounded-full shadow-2xl">
                      <Newspaper className="w-12 h-12 text-white animate-pulse" />
                    </div>
                    <div className="absolute -top-2 -right-2">
                      <Sparkles className="w-6 h-6 text-yellow-400 animate-spin" style={{ animationDuration: '2s' }} />
                    </div>
                    <div className="absolute -bottom-2 -left-2">
                      <Brain className="w-5 h-5 text-teal-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">실시간 뉴스를 수집하고 있습니다</h3>
                  <p className="text-slate-600 mb-6">네이버 뉴스 API를 활용하여 최신 뉴스를 검색 중...</p>
                  
                  {/* 진행 바 */}
                  <div className="w-full max-w-md mx-auto bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 rounded-full animate-progress-bar"></div>
                  </div>
                  
                  {/* 로딩 도트 애니메이션 */}
                  <div className="flex justify-center gap-2 mt-6">
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                    <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 에러 메시지 */}
          {error && !isLoading && (
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
              <CardContent className="py-16 text-center">
                <p className="text-slate-700 mb-6 text-lg">{error}</p>
                <Button
                  onClick={handleFetchNews}
                  className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 shadow-md"
                >
                  다시 시도
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 뉴스 목록 */}
          {newsData && newsData.news && newsData.news.length > 0 && !isLoading && (
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
              <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Newspaper className="w-6 h-6 text-teal-500" />
                    수집된 뉴스 ({newsData.news.length}개)
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="w-4 h-4" />
                    <span>{currentDateTime}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {newsData.news.map((item, index) => (
                    <Card
                      key={index}
                      className="border-2 border-slate-200 bg-white hover:border-teal-300 hover:shadow-lg transition-all"
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-900 mb-2 leading-tight">
                                  {item.title.replace(/<[^>]*>/g, "")}
                                </h3>
                                {item.description && (
                                  <p className="text-slate-600 text-sm mb-3 leading-relaxed line-clamp-2">
                                    {item.description.replace(/<[^>]*>/g, "")}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                  {item.pubDate && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(item.pubDate).toLocaleString("ko-KR", {
                                        year: "numeric",
                                        month: "2-digit",
                                        day: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 border-teal-300 text-teal-700 hover:bg-teal-50"
                            onClick={() => {
                              const url = item.originallink || item.link
                              if (url) {
                                window.open(url, "_blank")
                              }
                            }}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            보기
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 뉴스 없음 */}
          {newsData && (!newsData.news || newsData.news.length === 0) && !isLoading && (
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
              <CardContent className="py-16 text-center">
                <p className="text-slate-600 mb-6 text-lg">뉴스 데이터를 불러오지 못했습니다.</p>
                <Button
                  onClick={handleFetchNews}
                  className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 shadow-md"
                >
                  다시 시도
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

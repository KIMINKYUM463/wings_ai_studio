"use client"

import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, ArrowRight, FileText, Sparkles, Brain, Loader2, Home } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

interface CommentAnalysis {
  sentiment: {
    positive: number
    negative: number
    neutral: number
  }
  bestKeywords: string[]
  summary: string
  pros: string[]
  cons: string[]
}

function CommentAnalysisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const videoId = searchParams.get("videoId")
  const videoTitle = searchParams.get("title")
  const [isLoading, setIsLoading] = useState(false)
  const [commentAnalysis, setCommentAnalysis] = useState<CommentAnalysis | null>(null)

  useEffect(() => {
    if (videoId) {
      loadCommentAnalysis()
    }
  }, [videoId])

  const loadCommentAnalysis = async () => {
    if (!videoId) return

    setIsLoading(true)
    try {
      // 로컬 스토리지에서 API 키 가져오기
      const youtubeApiKey = localStorage.getItem("youmaker_youtube_api_key") || ""
      const geminiApiKey = localStorage.getItem("youmaker_gemini_api_key") || ""

      if (!youtubeApiKey) {
        alert("YouTube Data API Key를 설정해주세요.")
        router.push("/youmaker")
        return
      }

      if (!geminiApiKey) {
        alert("Gemini API Key를 설정해주세요.")
        router.push("/youmaker")
        return
      }

      // 실제 API 호출
      const response = await fetch("/api/youmaker/analyze-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          youtubeApiKey,
          geminiApiKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "댓글 분석에 실패했습니다.")
      }

      const data = await response.json()

      if (data.success) {
        setCommentAnalysis(data)
        // 댓글 분석 결과를 로컬 스토리지에 저장 (대본 각색에 활용)
        localStorage.setItem("youmaker_comment_analysis_data", JSON.stringify(data))
      } else {
        throw new Error(data.error || "댓글 분석에 실패했습니다.")
      }
    } catch (error) {
      console.error("댓글 분석 실패:", error)
      alert(error instanceof Error ? error.message : "댓글 분석에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNextStep = () => {
    router.push(`/youmaker/script-benchmarking?videoId=${videoId}&title=${encodeURIComponent(videoTitle || "")}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push("/youmaker/trending-analysis")}
            className="mb-4"
          >
            ← 이전 단계
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
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
            <CardHeader>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                댓글 민심 분석
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2 font-medium">{videoTitle || "영상 제목"}</p>
            </CardHeader>
          </Card>

          {isLoading && (
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 overflow-hidden">
              <CardContent className="py-16 text-center relative">
                {/* AI 분석 애니메이션 배경 */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
                  <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-300"></div>
                  <div className="absolute bottom-1/4 left-1/2 w-36 h-36 bg-pink-400/20 rounded-full blur-3xl animate-pulse delay-700"></div>
                </div>
                
                {/* AI 아이콘 애니메이션 */}
                <div className="relative z-10">
                  <div className="relative inline-block mb-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                    <div className="relative bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-6 rounded-full shadow-2xl">
                      <Brain className="w-12 h-12 text-white animate-pulse" />
                    </div>
                    <div className="absolute -top-2 -right-2">
                      <Sparkles className="w-6 h-6 text-yellow-400 animate-spin" style={{ animationDuration: '2s' }} />
                    </div>
                    <div className="absolute -bottom-2 -left-2">
                      <Sparkles className="w-5 h-5 text-blue-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">AI가 댓글을 분석하고 있습니다</h3>
                  <p className="text-slate-600 mb-6">잠시만 기다려주세요...</p>
                  
                  {/* 진행 바 */}
                  <div className="w-full max-w-md mx-auto bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-progress-bar"></div>
                  </div>
                  
                  {/* 로딩 도트 애니메이션 */}
                  <div className="flex justify-center gap-2 mt-6">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {commentAnalysis && (
            <>
              {/* 감정 분석 차트 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-orange-500" />
                    감정 분석 차트
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
                    {/* 긍정 */}
                    <div className="text-center group">
                      <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                        <div className="relative w-36 h-36 mx-auto rounded-full bg-gradient-to-br from-green-400 via-green-500 to-green-600 flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform duration-300">
                          <span className="text-4xl font-bold text-white drop-shadow-lg">
                            {commentAnalysis.sentiment.positive}%
                          </span>
                        </div>
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full animate-ping"></div>
                      </div>
                      <p className="text-base font-semibold text-slate-700 mt-2">긍정</p>
                      <div className="mt-3 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${commentAnalysis.sentiment.positive}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* 부정 */}
                    <div className="text-center group">
                      <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-red-600 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                        <div className="relative w-36 h-36 mx-auto rounded-full bg-gradient-to-br from-red-400 via-red-500 to-red-600 flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform duration-300">
                          <span className="text-4xl font-bold text-white drop-shadow-lg">
                            {commentAnalysis.sentiment.negative}%
                          </span>
                        </div>
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-ping"></div>
                      </div>
                      <p className="text-base font-semibold text-slate-700 mt-2">부정</p>
                      <div className="mt-3 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${commentAnalysis.sentiment.negative}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* 중립 */}
                    <div className="text-center group">
                      <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                        <div className="relative w-36 h-36 mx-auto rounded-full bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform duration-300">
                          <span className="text-4xl font-bold text-white drop-shadow-lg">
                            {commentAnalysis.sentiment.neutral}%
                          </span>
                        </div>
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-gray-500 rounded-full animate-ping"></div>
                      </div>
                      <p className="text-base font-semibold text-slate-700 mt-2">중립</p>
                      <div className="mt-3 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-gray-400 to-gray-600 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${commentAnalysis.sentiment.neutral}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 베스트 키워드 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-orange-500" />
                    베스트 키워드
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap gap-3">
                    {commentAnalysis.bestKeywords.map((keyword, index) => (
                      <Badge
                        key={index}
                        className="px-5 py-2.5 bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 text-white hover:from-orange-600 hover:via-red-500 hover:to-red-600 text-sm font-semibold shadow-lg transform hover:scale-105 transition-all duration-200 cursor-default"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <Sparkles className="w-3 h-3 mr-1.5 inline" />
                        #{keyword}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI 5줄 요약 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Brain className="w-6 h-6 text-purple-500" />
                    AI 5줄 요약 (총평)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-400 to-pink-400 rounded-full"></div>
                    <p className="text-slate-700 leading-relaxed text-base pl-6 font-medium">{commentAnalysis.summary}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Pros & Cons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-green-50 overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-white border-b">
                    <CardTitle className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      </div>
                      장점
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ul className="space-y-4">
                      {commentAnalysis.pros.map((pro, index) => (
                        <li 
                          key={index} 
                          className="flex items-start gap-3 p-3 rounded-lg bg-white/50 hover:bg-white transition-colors"
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          <div className="p-1 bg-green-100 rounded-full mt-0.5 shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          </div>
                          <span className="text-slate-700 font-medium flex-1">{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-red-50 overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-red-50 to-white border-b">
                    <CardTitle className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <XCircle className="w-6 h-6 text-red-600" />
                      </div>
                      아쉬운 점 (피드백)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ul className="space-y-4">
                      {commentAnalysis.cons.map((con, index) => (
                        <li 
                          key={index} 
                          className="flex items-start gap-3 p-3 rounded-lg bg-white/50 hover:bg-white transition-colors"
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          <div className="p-1 bg-red-100 rounded-full mt-0.5 shrink-0">
                            <XCircle className="w-4 h-4 text-red-600" />
                          </div>
                          <span className="text-slate-700 font-medium flex-1">{con}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* 다음 단계 버튼 */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleNextStep}
                  disabled={isLoading}
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 hover:from-orange-600 hover:via-red-500 hover:to-red-600 text-white font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 px-8 py-6"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  스크립트 벤치마킹 시작
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default function CommentAnalysisPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <p className="text-slate-600">로딩 중...</p>
      </div>
    }>
      <CommentAnalysisContent />
    </Suspense>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, ArrowRight, FileText } from "lucide-react"
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

export default function CommentAnalysisPage() {
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
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/youmaker/trending-analysis")}
            className="mb-4"
          >
            ← 이전 단계
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">댓글 민심 분석</CardTitle>
              <p className="text-sm text-slate-600 mt-2">{videoTitle || "영상 제목"}</p>
            </CardHeader>
          </Card>

          {isLoading && (
            <Card className="border-0 shadow-lg">
              <CardContent className="py-12 text-center">
                <p className="text-slate-600">댓글을 분석하고 있습니다...</p>
              </CardContent>
            </Card>
          )}

          {commentAnalysis && (
            <>
              {/* 감정 분석 차트 */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl">감정 분석 차트</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-6 mb-6">
                    <div className="text-center">
                      <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-2 shadow-lg">
                        <span className="text-3xl font-bold text-white">
                          {commentAnalysis.sentiment.positive}%
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-700">긍정</p>
                    </div>
                    <div className="text-center">
                      <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center mb-2 shadow-lg">
                        <span className="text-3xl font-bold text-white">
                          {commentAnalysis.sentiment.negative}%
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-700">부정</p>
                    </div>
                    <div className="text-center">
                      <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center mb-2 shadow-lg">
                        <span className="text-3xl font-bold text-white">
                          {commentAnalysis.sentiment.neutral}%
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-700">중립</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 베스트 키워드 */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl">베스트 키워드</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {commentAnalysis.bestKeywords.map((keyword, index) => (
                      <Badge
                        key={index}
                        className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 text-sm"
                      >
                        #{keyword}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI 5줄 요약 */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl">AI 5줄 요약 (총평)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 leading-relaxed text-base">{commentAnalysis.summary}</p>
                </CardContent>
              </Card>

              {/* Pros & Cons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      장점
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {commentAnalysis.pros.map((pro, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                          <span className="text-slate-700">{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <XCircle className="w-5 h-5 text-red-500" />
                      아쉬운 점 (피드백)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {commentAnalysis.cons.map((con, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                          <span className="text-slate-700">{con}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* 다음 단계 버튼 */}
              <div className="flex justify-end">
                <Button
                  onClick={handleNextStep}
                  disabled={isLoading}
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  스크립트 벤치마킹 시작
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}



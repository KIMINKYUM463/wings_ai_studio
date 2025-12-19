"use client"

import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ImageIcon, ArrowRight, Sparkles, Brain, FileText, Wand2, Type, Palette, Loader2, Home } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

interface ScriptAdaptation {
  cleanedScript: string
  summary: {
    title: string
    coreMessage: string
    structure: string[]
    summaryPoints: string[]
  }
  adaptedScript: string
  titles: {
    fresh: string[]
    stable: string[]
  }
  thumbnailTexts: {
    emotional: string[]
    informational: string[]
    visual: string[]
  }
}

function ScriptBenchmarkingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const videoId = searchParams.get("videoId")
  const videoTitle = searchParams.get("title")
  const [scriptInput, setScriptInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [scriptAdaptation, setScriptAdaptation] = useState<ScriptAdaptation | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [autoAdaptTimeout, setAutoAdaptTimeout] = useState<NodeJS.Timeout | null>(null)
  const [commentAnalysis, setCommentAnalysis] = useState<any>(null)

  // 로컬 스토리지에서 댓글 분석 결과 가져오기
  useEffect(() => {
    try {
      const commentAnalysisStr = localStorage.getItem("youmaker_comment_analysis_data")
      if (commentAnalysisStr) {
        const commentData = JSON.parse(commentAnalysisStr)
        setCommentAnalysis(commentData)
      }
    } catch (error) {
      console.error("로컬 스토리지에서 댓글 분석 데이터 로드 실패:", error)
    }
  }, [])


  // 대본 각색 실행
  const handleScriptAdaptation = async () => {
    // scriptInput이 비어있으면 현재 입력값 사용, 아니면 전달받은 값 사용
    const scriptToUse = scriptInput.trim()
    
    if (!scriptToUse) {
      alert("대본을 입력해주세요.")
      return
    }

    setIsLoading(true)
    try {
      // 로컬 스토리지에서 API 키 가져오기
      const geminiApiKey = localStorage.getItem("youmaker_gemini_api_key") || ""

      if (!geminiApiKey) {
        alert("Gemini API Key를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
        setIsLoading(false)
        return
      }

      // API 호출로 실제 대본 각색 수행 (댓글 분석 결과 포함)
      const response = await fetch("/api/youmaker/adapt-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: scriptToUse,
          geminiApiKey,
          commentAnalysis: commentAnalysis, // 댓글 분석 결과 전달
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "대본 각색에 실패했습니다.")
      }

      if (data.success) {
        setScriptAdaptation({
          cleanedScript: data.cleanedScript,
          summary: data.summary,
          adaptedScript: data.adaptedScript,
          titles: data.titles,
          thumbnailTexts: data.thumbnailTexts,
        })
      setShowResults(true)
      } else {
        throw new Error(data.error || "대본 각색에 실패했습니다.")
      }
    } catch (error) {
      console.error("대본 각색 실패:", error)
      alert(error instanceof Error ? error.message : "대본 각색에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNextStep = () => {
    if (scriptAdaptation) {
      // 각색된 대본과 제목, 썸네일 문구를 로컬 스토리지에 저장 (HTTP 431 오류 방지)
      const adaptationData = {
        adaptedScript: scriptAdaptation.adaptedScript,
        titles: scriptAdaptation.titles,
        thumbnailTexts: scriptAdaptation.thumbnailTexts,
      }
      localStorage.setItem("youmaker_script_adaptation_data", JSON.stringify(adaptationData))
      
      // 쿼리 파라미터는 최소한의 정보만 전달
      const params = new URLSearchParams({
        videoId: videoId || "",
        title: videoTitle || "",
      })
      router.push(`/youmaker/thumbnail-generation?${params.toString()}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push(`/youmaker/comment-analysis?videoId=${videoId}&title=${encodeURIComponent(videoTitle || "")}`)}
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
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent flex items-center gap-3">
                <FileText className="w-8 h-8 text-orange-500" />
                대본 입력 및 각색
              </CardTitle>
              <div className="mt-2 space-y-2">
                <p className="text-sm text-slate-600 font-medium">{videoTitle || "영상 제목"}</p>
                {videoId && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">YouTube URL:</span>
                    <a
                      href={`https://www.youtube.com/watch?v=${videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-orange-600 hover:text-orange-700 hover:underline font-medium break-all"
                    >
                      https://www.youtube.com/watch?v={videoId}
                    </a>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {!showResults ? (
            <>
              {/* 대본 입력 섹션 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-full blur-lg opacity-50"></div>
                      <div className="relative w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center text-lg font-bold shadow-xl">
                        1
                      </div>
                    </div>
                    <FileText className="w-6 h-6 text-orange-500" />
                    대본 입력
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div>
                    <Label htmlFor="script" className="text-base font-bold text-slate-800">
                      벤치마킹할 대본을 입력하세요
                    </Label>
                    <p className="text-sm text-slate-600 mt-1 mb-4">
                      참고할 벤치마킹 대본을 입력해주세요. 대본을 입력하면 자동으로 각색이 시작됩니다.
                    </p>
                    <div className="relative">
                      <Textarea
                        id="script"
                        placeholder="벤치마킹할 대본을 입력하세요..."
                        value={scriptInput}
                        onChange={(e) => {
                          const newValue = e.target.value
                          setScriptInput(newValue)
                          
                          // 이전 타이머 취소
                          if (autoAdaptTimeout) {
                            clearTimeout(autoAdaptTimeout)
                          }
                          
                          // 대본이 입력되면 자동으로 각색 시작 (입력이 완료된 후)
                          if (newValue.trim().length > 100 && !isLoading) {
                            // 최소 100자 이상 입력되고 2초간 입력이 없으면 자동 각색 시작
                            const timeoutId = setTimeout(() => {
                              if (newValue.trim().length > 100 && !isLoading) {
                                handleScriptAdaptation()
                              }
                            }, 2000) // 2초 후 자동 시작
                            
                            setAutoAdaptTimeout(timeoutId)
                          }
                        }}
                        onBlur={() => {
                          // 포커스를 잃었을 때 대본이 있으면 자동 각색 시작
                          if (scriptInput.trim().length > 50 && !isLoading) {
                            if (autoAdaptTimeout) {
                              clearTimeout(autoAdaptTimeout)
                            }
                            handleScriptAdaptation()
                          }
                        }}
                        className="min-h-[300px] max-h-[400px] text-base border-2 border-slate-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-200 transition-all resize-none overflow-y-auto"
                        disabled={isLoading}
                        style={{ height: 'auto' }}
                      />
                      {scriptInput.length > 0 && (
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                            {scriptInput.length}자
                          </Badge>
                        </div>
                      )}
                    </div>
                    {isLoading && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-orange-600 font-medium">
                        <Sparkles className="w-4 h-4 animate-spin" />
                        <span>대본을 각색하고 있습니다...</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {isLoading && (
                <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 overflow-hidden">
                  <CardContent className="py-16 text-center relative">
                    {/* AI 분석 애니메이션 배경 */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-orange-400/20 rounded-full blur-3xl animate-pulse"></div>
                      <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-red-400/20 rounded-full blur-3xl animate-pulse delay-300"></div>
                      <div className="absolute bottom-1/4 left-1/2 w-36 h-36 bg-pink-400/20 rounded-full blur-3xl animate-pulse delay-700"></div>
                    </div>
                    
                    {/* AI 아이콘 애니메이션 */}
                    <div className="relative z-10">
                      <div className="relative inline-block mb-6">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                        <div className="relative bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 p-6 rounded-full shadow-2xl">
                          <Brain className="w-12 h-12 text-white animate-pulse" />
                        </div>
                        <div className="absolute -top-2 -right-2">
                          <Sparkles className="w-6 h-6 text-yellow-400 animate-spin" style={{ animationDuration: '2s' }} />
                        </div>
                        <div className="absolute -bottom-2 -left-2">
                          <Wand2 className="w-5 h-5 text-orange-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                        </div>
                      </div>
                      
                      <h3 className="text-2xl font-bold text-slate-800 mb-2">AI가 대본을 각색하고 있습니다</h3>
                      <p className="text-slate-600 mb-6">잠시만 기다려주세요...</p>
                      
                      {/* 진행 바 */}
                      <div className="w-full max-w-md mx-auto bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-full animate-progress-bar"></div>
                      </div>
                      
                      {/* 로딩 도트 애니메이션 */}
                      <div className="flex justify-center gap-2 mt-6">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              {/* 각색 결과 섹션 */}
              {scriptAdaptation && (
                <>
                  {/* Step 1: 원본 대본 정리 및 교정 */}
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur-lg opacity-50"></div>
                          <div className="relative w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white flex items-center justify-center text-lg font-bold shadow-xl">
                            1
                          </div>
                        </div>
                        <FileText className="w-6 h-6 text-blue-500" />
                        원본 대본 정리 및 교정
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200 shadow-inner max-h-[400px] overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-slate-900 text-base leading-relaxed font-medium">
                          {scriptAdaptation.cleanedScript}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 2: 핵심 내용 요약 */}
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full blur-lg opacity-50"></div>
                          <div className="relative w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center justify-center text-lg font-bold shadow-xl">
                            2
                          </div>
                        </div>
                        <Brain className="w-6 h-6 text-green-500" />
                        핵심 내용 요약
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div>
                        <Label className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2">
                          <Type className="w-4 h-4 text-blue-500" />
                          핵심 제목
                        </Label>
                        <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
                          <p className="text-slate-900 font-bold text-lg">{scriptAdaptation.summary.title}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2">
                          <Brain className="w-4 h-4 text-green-500" />
                          핵심 메시지
                        </Label>
                        <div className="p-5 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 shadow-md hover:shadow-lg transition-shadow">
                          <p className="text-slate-900 font-medium leading-relaxed">{scriptAdaptation.summary.coreMessage}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-500" />
                          논리적 구조
                        </Label>
                        <div className="space-y-3">
                          {scriptAdaptation.summary.structure.map((point, index) => (
                            <div
                              key={index}
                              className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
                            >
                              <p className="text-slate-900 font-medium">{index + 1}. {point}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          요약 포인트
                        </Label>
                        <div className="space-y-3">
                          {scriptAdaptation.summary.summaryPoints.map((point, index) => (
                            <div
                              key={index}
                              className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border-2 border-amber-200 shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
                            >
                              <p className="text-slate-900 font-medium">{index + 1}. {point}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 3: 새로운 대본 재창조 */}
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-full blur-lg opacity-50"></div>
                          <div className="relative w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center text-lg font-bold shadow-xl">
                            3
                          </div>
                        </div>
                        <Wand2 className="w-6 h-6 text-orange-500" />
                        새로운 대본 재창조
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border-2 border-orange-200 shadow-inner max-h-[400px] overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-slate-900 text-base leading-relaxed font-medium">
                          {scriptAdaptation.adaptedScript}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 4: 제목 생성 */}
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full blur-lg opacity-50"></div>
                          <div className="relative w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white flex items-center justify-center text-lg font-bold shadow-xl">
                            4
                          </div>
                        </div>
                        <Type className="w-6 h-6 text-pink-500" />
                        클릭 유도형 제목 생성
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                      <div>
                        <Label className="text-sm font-bold text-slate-700 mb-3 block flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-pink-500" />
                          호기심 자극형 (5개)
                        </Label>
                        <div className="mt-2 space-y-3">
                          {scriptAdaptation.titles.fresh.map((title, index) => (
                            <div
                              key={index}
                              className="p-5 bg-gradient-to-r from-pink-50 via-rose-50 to-pink-100 rounded-xl border-2 border-pink-200 shadow-md hover:shadow-xl transition-all hover:scale-[1.02]"
                            >
                              <p className="text-slate-900 font-bold text-base">{title}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-bold text-slate-700 mb-3 block flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500" />
                          이득 제시형 (5개)
                        </Label>
                        <div className="mt-2 space-y-3">
                          {scriptAdaptation.titles.stable.map((title, index) => (
                            <div
                              key={index}
                              className="p-5 bg-gradient-to-r from-blue-50 via-cyan-50 to-blue-100 rounded-xl border-2 border-blue-200 shadow-md hover:shadow-xl transition-all hover:scale-[1.02]"
                            >
                              <p className="text-slate-900 font-bold text-base">{title}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 5: 썸네일 문구 제작 */}
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full blur-lg opacity-50"></div>
                          <div className="relative w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white flex items-center justify-center text-lg font-bold shadow-xl">
                            5
                          </div>
                        </div>
                        <Palette className="w-6 h-6 text-purple-500" />
                        썸네일 문구 제작
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                      <div>
                        <Label className="text-sm font-bold text-slate-700 mb-3 block flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-pink-500" />
                          Emotional (감정)
                        </Label>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {scriptAdaptation.thumbnailTexts.emotional.map((text, index) => (
                            <Badge
                              key={index}
                              className="px-5 py-2.5 bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white hover:from-pink-600 hover:via-rose-600 hover:to-pink-700 text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                            >
                              {text}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-bold text-slate-700 mb-3 block flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500" />
                          Informational (정보)
                        </Label>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {scriptAdaptation.thumbnailTexts.informational.map((text, index) => (
                            <Badge
                              key={index}
                              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 text-white hover:from-blue-600 hover:via-cyan-600 hover:to-blue-700 text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                            >
                              {text}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-bold text-slate-700 mb-3 block flex items-center gap-2">
                          <Palette className="w-4 h-4 text-purple-500" />
                          Visual (시각적 지침)
                        </Label>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {scriptAdaptation.thumbnailTexts.visual.map((text, index) => (
                            <Badge
                              key={index}
                              className="px-5 py-2.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 text-white hover:from-purple-600 hover:via-indigo-600 hover:to-purple-700 text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                            >
                              {text}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 다음 단계 버튼 */}
                  <div className="flex justify-end gap-4 pt-4">
                    <Button
                      onClick={() => {
                        setShowResults(false)
                        setScriptAdaptation(null)
                      }}
                      variant="outline"
                      size="lg"
                      className="border-2 border-slate-300 hover:bg-slate-50 font-semibold"
                    >
                      다시 입력하기
                    </Button>
                    <Button
                      onClick={handleNextStep}
                      disabled={isLoading}
                      size="lg"
                      className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 hover:from-orange-600 hover:via-red-500 hover:to-red-600 text-white font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 px-8 py-6"
                    >
                      <ImageIcon className="w-5 h-5 mr-2" />
                      썸네일 생성 시작
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default function ScriptBenchmarkingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <p className="text-slate-600">로딩 중...</p>
      </div>
    }>
      <ScriptBenchmarkingContent />
    </Suspense>
  )
}

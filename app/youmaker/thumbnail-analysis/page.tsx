"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Upload, ImageIcon, Sparkles, Brain, Loader2, Home, Eye, CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface ThumbnailAnalysis {
  visibility: {
    score: number
    analysis: string
    recommendations: string[]
  }
  psychologicalTrigger: {
    score: number
    analysis: string
    recommendations: string[]
  }
  designBalance: {
    score: number
    analysis: string
    recommendations: string[]
  }
  overallScore: number
  summary: string
  improvements: string[]
}

export default function ThumbnailAnalysisPage() {
  const router = useRouter()
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [analysis, setAnalysis] = useState<ThumbnailAnalysis | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 썸네일 파일 선택
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("이미지 파일만 업로드할 수 있습니다.")
        return
      }
      setThumbnailFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setAnalysis(null) // 새 파일 선택 시 이전 분석 결과 초기화
    }
  }

  // 썸네일 분석 실행
  const handleAnalyze = async () => {
    if (!thumbnailFile) {
      alert("썸네일 이미지를 업로드해주세요.")
      return
    }

    setIsLoading(true)
    try {
      // 이미지를 base64로 변환
      const reader = new FileReader()
      const base64Image = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string
          // data:image/...;base64, 부분 제거
          const base64 = result.split(",")[1]
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(thumbnailFile)
      })

      // 로컬 스토리지에서 API 키 가져오기
      const geminiApiKey = localStorage.getItem("youmaker_gemini_api_key") || ""

      if (!geminiApiKey) {
        alert("Gemini API Key를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
        setIsLoading(false)
        return
      }

      // API 호출
      const response = await fetch("/api/youmaker/analyze-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Image,
          mimeType: thumbnailFile.type,
          geminiApiKey,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "썸네일 분석에 실패했습니다.")
      }

      if (data.success) {
        setAnalysis(data.analysis)
      } else {
        throw new Error(data.error || "썸네일 분석에 실패했습니다.")
      }
    } catch (error) {
      console.error("썸네일 분석 실패:", error)
      alert(error instanceof Error ? error.message : "썸네일 분석에 실패했습니다.")
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
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
            <CardHeader>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
                <ImageIcon className="w-8 h-8 text-indigo-500" />
                AI 썸네일 분석
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2 font-medium">
                썸네일을 업로드하면 AI가 클릭률을 높이는 전략을 분석합니다
              </p>
            </CardHeader>
          </Card>

          {!analysis ? (
            <>
              {/* 썸네일 업로드 섹션 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Upload className="w-6 h-6 text-indigo-500" />
                    썸네일 업로드
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <div>
                      <Label htmlFor="thumbnail-upload" className="text-base font-bold text-slate-800 mb-2 block">
                        분석할 썸네일 이미지
                      </Label>
                      <p className="text-sm text-slate-600 mb-4">
                        썸네일 이미지를 업로드하면 AI가 시인성, 심리적 자극, 디자인 밸런스를 분석합니다.
                      </p>
                      <div
                        className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer relative"
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.currentTarget.classList.add("border-indigo-500", "bg-indigo-50")
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove("border-indigo-500", "bg-indigo-50")
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.currentTarget.classList.remove("border-indigo-500", "bg-indigo-50")
                          const file = e.dataTransfer.files[0]
                          if (file && file.type.startsWith("image/")) {
                            setThumbnailFile(file)
                            const reader = new FileReader()
                            reader.onloadend = () => {
                              setThumbnailPreview(reader.result as string)
                            }
                            reader.readAsDataURL(file)
                            setAnalysis(null)
                          }
                        }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {thumbnailPreview ? (
                          <div className="relative">
                            <img
                              src={thumbnailPreview}
                              alt="썸네일 미리보기"
                              className="max-w-full max-h-96 mx-auto rounded-lg shadow-lg"
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={(e) => {
                                e.stopPropagation()
                                setThumbnailFile(null)
                                setThumbnailPreview(null)
                                if (fileInputRef.current) {
                                  fileInputRef.current.value = ""
                                }
                              }}
                            >
                              삭제
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white mb-4">
                              <Upload className="w-8 h-8" />
                            </div>
                            <p className="text-slate-700 font-medium">클릭하거나 드래그하여 이미지 업로드</p>
                            <p className="text-sm text-slate-500">PNG, JPG, JPEG 형식 지원</p>
                          </div>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                          id="thumbnail-upload"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={handleAnalyze}
                        disabled={isLoading || !thumbnailFile}
                        size="lg"
                        className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-700 text-white font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 px-8 py-6"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            분석 중...
                          </>
                        ) : (
                          <>
                            <Brain className="w-5 h-5 mr-2" />
                            썸네일 분석 시작
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {isLoading && (
                <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 overflow-hidden">
                  <CardContent className="py-16 text-center relative">
                    {/* AI 분석 애니메이션 배경 */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-indigo-400/20 rounded-full blur-3xl animate-pulse"></div>
                      <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-300"></div>
                      <div className="absolute bottom-1/4 left-1/2 w-36 h-36 bg-pink-400/20 rounded-full blur-3xl animate-pulse delay-700"></div>
                    </div>
                    
                    {/* AI 아이콘 애니메이션 */}
                    <div className="relative z-10">
                      <div className="relative inline-block mb-6">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                        <div className="relative bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 rounded-full shadow-2xl">
                          <Brain className="w-12 h-12 text-white animate-pulse" />
                        </div>
                        <div className="absolute -top-2 -right-2">
                          <Sparkles className="w-6 h-6 text-yellow-400 animate-spin" style={{ animationDuration: '2s' }} />
                        </div>
                        <div className="absolute -bottom-2 -left-2">
                          <Eye className="w-5 h-5 text-indigo-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                        </div>
                      </div>
                      
                      <h3 className="text-2xl font-bold text-slate-800 mb-2">AI가 썸네일을 분석하고 있습니다</h3>
                      <p className="text-slate-600 mb-6">시인성, 심리적 자극, 디자인 밸런스를 종합적으로 분석 중...</p>
                      
                      {/* 진행 바 */}
                      <div className="w-full max-w-md mx-auto bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full animate-progress-bar"></div>
                      </div>
                      
                      {/* 로딩 도트 애니메이션 */}
                      <div className="flex justify-center gap-2 mt-6">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              {/* 분석 결과 섹션 */}
              {thumbnailPreview && (
                <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                    <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                      <ImageIcon className="w-6 h-6 text-indigo-500" />
                      분석된 썸네일
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex justify-center">
                      <img
                        src={thumbnailPreview}
                        alt="분석된 썸네일"
                        className="max-w-full max-h-96 rounded-xl shadow-xl"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 종합 점수 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                    종합 점수
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="relative inline-block mb-4">
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-2xl opacity-50"></div>
                      <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl">
                        <span className="text-5xl font-bold text-white">{analysis.overallScore}</span>
                      </div>
                    </div>
                    <p className="text-xl font-semibold text-slate-800 mb-4">총점 / 100점</p>
                    <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200">
                      <p className="text-slate-900 font-medium leading-relaxed">{analysis.summary}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 시인성 분석 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Eye className="w-6 h-6 text-blue-500" />
                    시인성 (Visibility) 분석
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-4xl font-bold text-blue-600">{analysis.visibility.score}</div>
                    <div className="flex-1">
                      <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000"
                          style={{ width: `${analysis.visibility.score}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-600">/ 100점</span>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
                    <p className="text-slate-900 font-medium leading-relaxed mb-4">{analysis.visibility.analysis}</p>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700">개선 권장사항:</Label>
                      <ul className="space-y-2">
                        {analysis.visibility.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-2 text-slate-800">
                            <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 심리적 자극 분석 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Brain className="w-6 h-6 text-purple-500" />
                    심리적 자극 (Psychological Trigger) 분석
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-4xl font-bold text-purple-600">{analysis.psychologicalTrigger.score}</div>
                    <div className="flex-1">
                      <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-1000"
                          style={{ width: `${analysis.psychologicalTrigger.score}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-600">/ 100점</span>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
                    <p className="text-slate-900 font-medium leading-relaxed mb-4">{analysis.psychologicalTrigger.analysis}</p>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700">개선 권장사항:</Label>
                      <ul className="space-y-2">
                        {analysis.psychologicalTrigger.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-2 text-slate-800">
                            <CheckCircle2 className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 디자인 밸런스 분석 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-pink-500" />
                    디자인 밸런스 (Design Balance) 분석
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-4xl font-bold text-pink-600">{analysis.designBalance.score}</div>
                    <div className="flex-1">
                      <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-pink-500 to-pink-600 rounded-full transition-all duration-1000"
                          style={{ width: `${analysis.designBalance.score}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-600">/ 100점</span>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl border-2 border-pink-200">
                    <p className="text-slate-900 font-medium leading-relaxed mb-4">{analysis.designBalance.analysis}</p>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700">개선 권장사항:</Label>
                      <ul className="space-y-2">
                        {analysis.designBalance.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-2 text-slate-800">
                            <CheckCircle2 className="w-4 h-4 text-pink-500 mt-0.5 shrink-0" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 종합 개선사항 */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-orange-500" />
                    종합 개선사항
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {analysis.improvements.map((improvement, index) => (
                      <div
                        key={index}
                        className="p-4 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-100 rounded-xl border-2 border-orange-200 shadow-md hover:shadow-lg transition-all"
                      >
                        <p className="text-slate-900 font-medium flex items-start gap-2">
                          <span className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                            {index + 1}
                          </span>
                          <span>{improvement}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 다시 분석하기 버튼 */}
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setAnalysis(null)
                    setThumbnailFile(null)
                    setThumbnailPreview(null)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ""
                    }
                  }}
                  variant="outline"
                  size="lg"
                  className="border-2 border-slate-300 hover:bg-slate-50 font-semibold"
                >
                  다시 분석하기
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}



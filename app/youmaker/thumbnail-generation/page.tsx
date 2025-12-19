"use client"

import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Sparkles, ImageIcon, Palette, Wand2, Brain, Loader2, Download, Eye, ArrowRight, Home } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

function ThumbnailGenerationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const videoId = searchParams.get("videoId")
  const videoTitle = searchParams.get("title")
  
  const [isLoading, setIsLoading] = useState(false)
  const [thumbnailGeneration, setThumbnailGeneration] = useState<{
    generatedThumbnails: Array<{
      id: string
      imageUrl: string
      prompt: string
      style: string
    }>
  } | null>(null)

  // 로컬 스토리지에서 각색 데이터 가져오기 (HTTP 431 오류 방지)
  const [titles, setTitles] = useState<any>(null)
  const [thumbnailTexts, setThumbnailTexts] = useState<any>(null)
  const [adaptedScript, setAdaptedScript] = useState<string | null>(null)

  useEffect(() => {
    // 로컬 스토리지에서 각색 데이터 로드
    try {
      const adaptationDataStr = localStorage.getItem("youmaker_script_adaptation_data")
      if (adaptationDataStr) {
        const adaptationData = JSON.parse(adaptationDataStr)
        setAdaptedScript(adaptationData.adaptedScript || null)
        setTitles(adaptationData.titles || null)
        setThumbnailTexts(adaptationData.thumbnailTexts || null)
    }
    } catch (error) {
      console.error("로컬 스토리지에서 각색 데이터 로드 실패:", error)
    }
  }, [])

  // useEffect 제거 - 버튼 클릭 시에만 생성하도록 변경

  const loadThumbnailGeneration = async () => {
    setIsLoading(true)
    try {
      // 로컬 스토리지에서 API 키 가져오기
      const geminiApiKey = localStorage.getItem("youmaker_gemini_api_key") || ""
      const replicateApiKey = localStorage.getItem("youmaker_replicate_api_key") || ""

      if (!geminiApiKey) {
        alert("Gemini API Key를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
        setIsLoading(false)
        return
      }

      if (!replicateApiKey) {
        alert("Replicate API Key를 설정해주세요. 나노바나나 모델을 사용하기 위해 설정 페이지에서 API 키를 입력하고 저장해주세요.")
        setIsLoading(false)
        return
      }

      // 썸네일 1개만 생성
      const generatedThumbnails = []

      // 첫 번째로 사용 가능한 썸네일 문구로 1개만 생성
      let thumbnailText = ""
      let thumbnailStyle = ""

      if (thumbnailTexts?.emotional && thumbnailTexts.emotional.length > 0) {
        thumbnailText = thumbnailTexts.emotional[0]
        thumbnailStyle = "Emotional"
      } else if (thumbnailTexts?.informational && thumbnailTexts.informational.length > 0) {
        thumbnailText = thumbnailTexts.informational[0]
        thumbnailStyle = "Informational"
      } else if (thumbnailTexts?.visual && thumbnailTexts.visual.length > 0) {
        thumbnailText = thumbnailTexts.visual[0]
        thumbnailStyle = "Visual"
      }

      if (thumbnailText) {
        try {
          const response = await fetch("/api/youmaker/generate-thumbnail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: titles?.fresh?.[0] || titles?.stable?.[0] || videoTitle || "",
              thumbnailText: thumbnailText,
              geminiApiKey,
              replicateApiKey,
            }),
          })

          const data = await response.json()

          if (data.success && data.imageUrl) {
            generatedThumbnails.push({
              id: "thumbnail-0",
              imageUrl: data.imageUrl,
              prompt: data.prompt || thumbnailText,
              style: thumbnailStyle,
            })
          }
        } catch (error) {
          console.error("썸네일 생성 실패:", error)
        }
      }

      if (generatedThumbnails.length === 0) {
        throw new Error("썸네일 생성에 실패했습니다.")
      }

      setThumbnailGeneration({
        generatedThumbnails,
      })
    } catch (error) {
      console.error("썸네일 생성 실패:", error)
      alert(error instanceof Error ? error.message : "썸네일 생성에 실패했습니다.")
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
            onClick={() => router.push(`/youmaker/script-benchmarking?videoId=${videoId}&title=${encodeURIComponent(videoTitle || "")}`)}
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
                <ImageIcon className="w-8 h-8 text-orange-500" />
                썸네일 생성
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2 font-medium">
                각색된 대본과 생성된 제목, 썸네일 문구를 기반으로 AI가 썸네일을 생성합니다.
              </p>
            </CardHeader>
          </Card>

          {/* 생성된 제목 및 썸네일 문구 미리보기 */}
          {titles && thumbnailTexts && (
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Palette className="w-6 h-6 text-purple-500" />
                  생성된 제목 및 썸네일 문구
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div>
                  <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-pink-500" />
                    추천 제목 (Fresh)
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {titles.fresh?.slice(0, 3).map((title: string, index: number) => (
                      <Badge key={index} className="px-5 py-2 bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                        {title}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-purple-500" />
                    썸네일 문구
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {thumbnailTexts.emotional?.slice(0, 2).map((text: string, index: number) => (
                      <Badge key={index} className="px-5 py-2 bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                        {text}
                      </Badge>
                    ))}
                    {thumbnailTexts.informational?.slice(0, 2).map((text: string, index: number) => (
                      <Badge key={index} className="px-5 py-2 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                        {text}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 썸네일 생성 버튼 */}
          {!thumbnailGeneration && !isLoading && (
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
              <CardContent className="py-12 text-center">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-full blur-xl opacity-50"></div>
                  <div className="relative bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 p-6 rounded-full shadow-2xl">
                    <ImageIcon className="w-12 h-12 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">AI 썸네일 생성</h3>
                <p className="text-slate-600 mb-6">나노바나나 AI로 고품질 썸네일을 생성합니다.</p>
                <Button
                  onClick={loadThumbnailGeneration}
                  disabled={isLoading}
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 hover:from-orange-600 hover:via-red-500 hover:to-red-600 text-white font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 px-8 py-6"
                >
                  <Wand2 className="w-5 h-5 mr-2" />
                  썸네일 생성하기
                </Button>
              </CardContent>
            </Card>
          )}

          {isLoading && (
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 overflow-hidden">
              <CardContent className="py-16 text-center relative">
                {/* AI 생성 애니메이션 배경 */}
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
                      <ImageIcon className="w-12 h-12 text-white animate-pulse" />
                    </div>
                    <div className="absolute -top-2 -right-2">
                      <Sparkles className="w-6 h-6 text-yellow-400 animate-spin" style={{ animationDuration: '2s' }} />
                    </div>
                    <div className="absolute -bottom-2 -left-2">
                      <Palette className="w-5 h-5 text-orange-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">AI가 썸네일을 생성하고 있습니다</h3>
                  <p className="text-slate-600 mb-2">나노바나나 AI로 고품질 썸네일을 생성 중...</p>
                  <p className="text-sm text-slate-500 mb-6">약 10-30초 소요됩니다</p>
                  
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

          {thumbnailGeneration && (
            <>
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <ImageIcon className="w-6 h-6 text-orange-500" />
                    생성된 썸네일
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {thumbnailGeneration.generatedThumbnails.map((thumbnail) => (
                      <Card key={thumbnail.id} className="border-0 shadow-xl bg-white overflow-hidden hover:shadow-2xl transition-all hover:scale-[1.02] group">
                        <CardContent className="p-0">
                          <div className="relative overflow-hidden">
                            <img
                              src={thumbnail.imageUrl}
                              alt={thumbnail.prompt}
                              className="w-full h-56 object-cover transition-transform duration-300 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <Badge className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold shadow-lg">
                              {thumbnail.style}
                            </Badge>
                            <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="w-full bg-white/90 hover:bg-white text-slate-900 font-semibold"
                                onClick={() => window.open(thumbnail.imageUrl, '_blank')}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                크게 보기
                              </Button>
                            </div>
                          </div>
                          <div className="p-5">
                            <p className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                              <Wand2 className="w-3 h-3" />
                              프롬프트
                            </p>
                            <p className="text-sm font-medium text-slate-900 leading-relaxed line-clamp-3">{thumbnail.prompt}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 via-emerald-50 to-green-100">
                <CardContent className="p-8 text-center">
                  <div className="relative inline-block mb-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
                    <div className="relative bg-gradient-to-br from-green-500 to-emerald-500 p-6 rounded-full shadow-2xl">
                      <CheckCircle2 className="w-12 h-12 text-white" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold text-slate-900 mb-3">원클릭 분석 완료!</h3>
                  <p className="text-slate-700 mb-6 text-lg font-medium">
                    떡상 영상 분석부터 썸네일 생성까지 모든 과정이 완료되었습니다.
                  </p>
                  <Button
                    onClick={() => router.push("/youmaker")}
                    size="lg"
                    className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 hover:from-orange-600 hover:via-red-500 hover:to-red-600 text-white font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 px-8 py-6"
                  >
                    메인으로 돌아가기
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default function ThumbnailGenerationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <p className="text-slate-600">로딩 중...</p>
      </div>
    }>
      <ThumbnailGenerationContent />
    </Suspense>
  )
}

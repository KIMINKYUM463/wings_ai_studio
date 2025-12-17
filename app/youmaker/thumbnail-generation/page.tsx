"use client"

import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Sparkles } from "lucide-react"
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
      const replicateApiKey = localStorage.getItem("youmaker_replicate_api_key") || "" // fallback용 (선택사항)

      if (!geminiApiKey) {
        alert("Gemini API Key를 설정해주세요. 설정 페이지에서 API 키를 입력하고 저장해주세요.")
        setIsLoading(false)
        return
      }

      // 각 썸네일 문구별로 썸네일 생성
      const generatedThumbnails = []

      // Emotional 스타일 썸네일 생성 (최대 3개)
      if (thumbnailTexts?.emotional && thumbnailTexts.emotional.length > 0) {
        for (let i = 0; i < Math.min(3, thumbnailTexts.emotional.length); i++) {
          try {
            const response = await fetch("/api/youmaker/generate-thumbnail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: titles?.fresh?.[0] || videoTitle || "",
                thumbnailText: thumbnailTexts.emotional[i],
                geminiApiKey,
                replicateApiKey, // fallback용
              }),
            })

            const data = await response.json()

            if (data.success && data.imageUrl) {
              generatedThumbnails.push({
                id: `emotional-${i}`,
                imageUrl: data.imageUrl,
                prompt: data.prompt || thumbnailTexts.emotional[i],
            style: "Emotional",
              })
            }
          } catch (error) {
            console.error(`Emotional 썸네일 ${i + 1} 생성 실패:`, error)
          }
        }
      }

      // Informational 스타일 썸네일 생성 (최대 2개)
      if (thumbnailTexts?.informational && thumbnailTexts.informational.length > 0) {
        for (let i = 0; i < Math.min(2, thumbnailTexts.informational.length); i++) {
          try {
            const response = await fetch("/api/youmaker/generate-thumbnail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: titles?.stable?.[0] || videoTitle || "",
                thumbnailText: thumbnailTexts.informational[i],
                geminiApiKey,
                replicateApiKey, // fallback용
              }),
            })

            const data = await response.json()

            if (data.success && data.imageUrl) {
              generatedThumbnails.push({
                id: `informational-${i}`,
                imageUrl: data.imageUrl,
                prompt: data.prompt || thumbnailTexts.informational[i],
            style: "Informational",
              })
            }
          } catch (error) {
            console.error(`Informational 썸네일 ${i + 1} 생성 실패:`, error)
          }
        }
      }

      // Visual 스타일 썸네일 생성 (최대 1개)
      if (thumbnailTexts?.visual && thumbnailTexts.visual.length > 0) {
        try {
          const response = await fetch("/api/youmaker/generate-thumbnail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: titles?.fresh?.[0] || videoTitle || "",
              thumbnailText: thumbnailTexts.visual[0],
              geminiApiKey,
              replicateApiKey, // fallback용
            }),
          })

          const data = await response.json()

          if (data.success && data.imageUrl) {
            generatedThumbnails.push({
              id: "visual-0",
              imageUrl: data.imageUrl,
              prompt: data.prompt || thumbnailTexts.visual[0],
            style: "Visual",
            })
          }
        } catch (error) {
          console.error("Visual 썸네일 생성 실패:", error)
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
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/youmaker/script-benchmarking?videoId=${videoId}&title=${encodeURIComponent(videoTitle || "")}`)}
            className="mb-4"
          >
            ← 이전 단계
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">썸네일 생성</CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                각색된 대본과 생성된 제목, 썸네일 문구를 기반으로 썸네일을 생성합니다.
              </p>
            </CardHeader>
          </Card>

          {/* 생성된 제목 및 썸네일 문구 미리보기 */}
          {titles && thumbnailTexts && (
            <Card className="border-0 shadow-lg bg-slate-50">
              <CardHeader>
                <CardTitle className="text-lg">생성된 제목 및 썸네일 문구</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">추천 제목 (Fresh):</p>
                  <div className="flex flex-wrap gap-2">
                    {titles.fresh?.slice(0, 3).map((title: string, index: number) => (
                      <Badge key={index} className="px-3 py-1 bg-pink-500 text-white text-xs">
                        {title}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">썸네일 문구:</p>
                  <div className="flex flex-wrap gap-2">
                    {thumbnailTexts.emotional?.slice(0, 2).map((text: string, index: number) => (
                      <Badge key={index} className="px-3 py-1 bg-pink-500 text-white text-xs">
                        {text}
                      </Badge>
                    ))}
                    {thumbnailTexts.informational?.slice(0, 2).map((text: string, index: number) => (
                      <Badge key={index} className="px-3 py-1 bg-blue-500 text-white text-xs">
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
            <Card className="border-0 shadow-lg">
              <CardContent className="py-8 text-center">
                <p className="text-slate-600 mb-4">썸네일을 생성하려면 아래 버튼을 클릭하세요.</p>
                  <Button
                  onClick={loadThumbnailGeneration}
                  disabled={isLoading}
                    size="lg"
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                  >
                  {isLoading ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      썸네일 생성하기
            </>
          )}
          </Button>
              </CardContent>
            </Card>
          )}

          {isLoading && (
            <Card className="border-0 shadow-lg">
              <CardContent className="py-12 text-center">
                <Sparkles className="w-8 h-8 mx-auto mb-4 animate-spin text-orange-500" />
                <p className="text-slate-600">썸네일을 생성하고 있습니다...</p>
                <p className="text-sm text-slate-500 mt-2">잠시만 기다려주세요. (각 썸네일당 약 10-30초 소요)</p>
              </CardContent>
            </Card>
          )}

          {thumbnailGeneration && (
            <>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl">생성된 썸네일</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {thumbnailGeneration.generatedThumbnails.map((thumbnail) => (
                      <Card key={thumbnail.id} className="border-0 shadow-lg overflow-hidden">
                        <CardContent className="p-0">
                          <div className="relative">
                            <img
                              src={thumbnail.imageUrl}
                              alt={thumbnail.prompt}
                              className="w-full h-48 object-cover"
                            />
                            <Badge className="absolute top-2 right-2 bg-orange-500 text-white">
                              {thumbnail.style}
                            </Badge>
                          </div>
                          <div className="p-4">
                            <p className="text-sm text-slate-600 mb-2">프롬프트:</p>
                            <p className="text-sm font-medium text-slate-900">{thumbnail.prompt}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50">
                <CardContent className="p-6 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-900 mb-2">원클릭 분석 완료!</h3>
                  <p className="text-slate-600 mb-4">
                    떡상 영상 분석부터 썸네일 생성까지 모든 과정이 완료되었습니다.
                  </p>
                  <Button
                    onClick={() => router.push("/youmaker")}
                    size="lg"
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                  >
                    메인으로 돌아가기
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

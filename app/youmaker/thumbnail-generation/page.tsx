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
  const adaptedScript = searchParams.get("adaptedScript")
  const titlesParam = searchParams.get("titles")
  const thumbnailTextsParam = searchParams.get("thumbnailTexts")
  
  const [isLoading, setIsLoading] = useState(false)
  const [thumbnailGeneration, setThumbnailGeneration] = useState<{
    generatedThumbnails: Array<{
      id: string
      imageUrl: string
      prompt: string
      style: string
    }>
  } | null>(null)

  const titles = titlesParam ? JSON.parse(decodeURIComponent(titlesParam)) : null
  const thumbnailTexts = thumbnailTextsParam ? JSON.parse(decodeURIComponent(thumbnailTextsParam)) : null

  useEffect(() => {
    if (videoId && titles && thumbnailTexts) {
      loadThumbnailGeneration()
    }
  }, [videoId, titles, thumbnailTexts])

  const loadThumbnailGeneration = async () => {
    setIsLoading(true)
    try {
      // TODO: API 호출로 실제 썸네일 생성
      // 각색된 대본과 생성된 제목, 썸네일 문구를 기반으로 썸네일 생성
      await new Promise((resolve) => setTimeout(resolve, 2000)) // 로딩 시뮬레이션

      const mockThumbnailGeneration = {
        generatedThumbnails: [
          {
            id: "thumb-1",
            imageUrl: "https://via.placeholder.com/1280x720?text=Thumbnail+1",
            prompt: thumbnailTexts?.emotional?.[0] || "충격적인 이미지",
            style: "Emotional",
          },
          {
            id: "thumb-2",
            imageUrl: "https://via.placeholder.com/1280x720?text=Thumbnail+2",
            prompt: thumbnailTexts?.informational?.[0] || "수익 3배 증가",
            style: "Informational",
          },
          {
            id: "thumb-3",
            imageUrl: "https://via.placeholder.com/1280x720?text=Thumbnail+3",
            prompt: thumbnailTexts?.visual?.[0] || "강렬한 색상",
            style: "Visual",
          },
        ],
      }

      setThumbnailGeneration(mockThumbnailGeneration)
    } catch (error) {
      console.error("썸네일 생성 실패:", error)
      alert("썸네일 생성에 실패했습니다.")
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

          {isLoading && (
            <Card className="border-0 shadow-lg">
              <CardContent className="py-12 text-center">
                <Sparkles className="w-8 h-8 mx-auto mb-4 animate-spin text-orange-500" />
                <p className="text-slate-600">썸네일을 생성하고 있습니다...</p>
                <p className="text-sm text-slate-500 mt-2">잠시만 기다려주세요.</p>
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
